'use client';

/* ─── Financial Engine — page (Phase H) ──────────────────────────────────────
 * Budget baseline engine-real (capex.total + approved revisions); committed/
 * paid from the tracking ledger (fraction-scaled EXAMPLE seeds, Plan Mode);
 * CPI/SPI = PASSTHROUGH from the Construction EVM (single source — never
 * recomputed here); OPEX YTD via models.opex.totalAnnual with the Phase-Q
 * 'dcContract' basis preset (labeled). Legacy FinancialDashboard + Investment
 * survive by composition/deep-link — nothing lost.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useFinancialTracking } from '@/store/financialTracking';
import { useConstructionTracking } from '@/store/constructionTracking';
import { plannedSchedule, evm, pvCurve } from '@/state/adapters/construction-adapter';
import { rzModels } from '@/lib/rz-engine';
import FinancialDashboard from '@/components/modules/FinancialDashboard';
import { fmtMoney } from '@/lib/format';
import { TrendingUp, ChevronRight } from 'lucide-react';

const OPEX_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#64748b', '#14b8a6'];

export function FinancialPage() {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const inputs = useSimulationStore((s) => s.inputs);
    const country = useSimulationStore((s) => s.selectedCountry);
    const results = useCapexStore((s) => s.results);
    const runCalculation = useCapexStore((s) => s.runCalculation);
    const fin = useFinancialTracking();
    const ct = useConstructionTracking();
    const [tab, setTab] = React.useState<'overview' | 'ledger' | 'proforma'>('overview');

    React.useEffect(() => { if (!results) runCalculation(); }, [results, runCalculation]);

    const model = React.useMemo(() => {
        if (!results) return null;
        const baseline = results.total;
        const approvedRev = fin.revisions.filter((r) => r.approved).reduce((s, r) => s + r.amountFrac * baseline, 0);
        const revised = baseline + approvedRev;
        const committed = fin.transactions.filter((t) => ['committed', 'approved', 'paid'].includes(t.status)).reduce((s, t) => s + t.amountFrac * baseline, 0);
        const paid = fin.transactions.filter((t) => t.status === 'paid').reduce((s, t) => s + t.amountFrac * baseline, 0);
        // EVM passthrough — single source (Construction tracking)
        const sched = plannedSchedule(results.timeline);
        const e = sched ? evm(sched, revised, ct.statusMonth, ct.phaseActualPct, ct.acSpentUsd) : null;
        const cpi = e?.cpi ?? 1, spi = e?.spi ?? 1;
        const fac = e && !e.planMode ? Math.round(e.acUsd + (revised - e.evUsd) / Math.max(0.5, cpi)) : revised;
        const curve = sched ? pvCurve(sched, revised) : [];
        // OPEX (engine, dcContract preset) — annual + YTD proxy at status month
        let opex: Record<string, number> | null = null;
        try {
            const m = rzModels();
            if (m?.opex?.totalAnnual) {
                opex = m.opex.totalAnnual(inputs.itLoad / 1000, undefined, country?.id ?? 'US',
                    (inputs.headcount_ShiftLead ?? 0) + (inputs.headcount_Engineer ?? 0) + (inputs.headcount_Technician ?? 0) + (inputs.headcount_Admin ?? 0),
                    { capex: baseline, extendedOpex: true, basisPreset: 'dcContract' });
            }
        } catch { /* */ }
        const opexDonut = opex ? [
            { name: 'Utilities (power)', v: opex.power }, { name: 'Maintenance', v: opex.maintenance },
            { name: 'Labor', v: opex.staffing }, { name: 'Services (contract)', v: opex.contract },
            { name: 'Insurance', v: opex.insurance }, { name: 'Others', v: (opex.overhead ?? 0) + (opex.water ?? 0) + (opex.carbon ?? 0) + (opex.connectivity ?? 0) },
        ].filter((x) => x.v > 0) : [];
        // health composite (documented): 0.3 budget-variance + 0.35 cpi + 0.35 spi
        const bv = revised > 0 ? Math.max(0, 1 - Math.abs(fac - revised) / revised * 5) : 1;
        const health = Math.round(100 * (0.3 * bv + 0.35 * Math.min(1, cpi) + 0.35 * Math.min(1, spi)));
        const grade = health >= 85 ? 'A' : health >= 70 ? 'B' : health >= 55 ? 'C' : health >= 40 ? 'D' : 'E';
        return { baseline, approvedRev, revised, committed, paid, cpi, spi, fac, curve, opex, opexDonut, health, grade, planMode: e?.planMode ?? true };
    }, [results, fin.transactions, fin.revisions, ct.statusMonth, ct.phaseActualPct, ct.acSpentUsd, inputs, country]);

    if (!results || !model) return <div className="p-8 text-center text-sm text-slate-500">Calculating…</div>;

    const insights = [
        `Budget baseline ${fmtMoney(model.baseline)} + approved changes ${fmtMoney(model.approvedRev)} → revised ${fmtMoney(model.revised)}.`,
        model.planMode ? 'Plan Mode — FAC ≡ revised budget (no construction actuals yet).' : `FAC ${fmtMoney(model.fac)} at CPI ${model.cpi} (from Construction tracking — single source).`,
        model.opex ? `Annual OPEX ${fmtMoney(model.opex.totalExtended ?? model.opex.total)} on the DC-contract 100%-util basis (engine preset).` : 'OPEX engine loading…',
        `Committed ${Math.round((model.committed / model.revised) * 100)}% · paid ${Math.round((model.paid / model.revised) * 100)}% of revised budget${fin.touched ? '' : ' (EXAMPLE ledger)'}.`,
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg"><TrendingUp className="h-6 w-6 text-white" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Financial Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Financial performance & analytics across the project lifecycle</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                        {([['overview', 'Overview'], ['ledger', 'Transactions & AR/AP'], ['proforma', 'Pro Forma (Full)']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                        ))}
                    </div>
                    <button onClick={() => setActiveTab('invest')} className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-violet-400">Investment & Capitalization</button>
                    <button onClick={() => setActiveTab('report')} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">Next: Results <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'proforma' ? <FinancialDashboard /> : tab === 'ledger' ? (
                <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recent Financial Transactions {fin.touched ? '' : <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-semibold text-amber-500">EXAMPLE LEDGER</span>}</h2>
                        <div className="space-y-1">
                            {fin.transactions.map((t) => (
                                <div key={t.id} className="flex items-center gap-2 text-[11px]">
                                    <span className={`rounded px-1 py-0.5 text-[8.5px] font-semibold uppercase ${t.type === 'po' ? 'bg-violet-500/15 text-violet-500' : t.type === 'invoice' ? 'bg-cyan-500/15 text-cyan-500' : 'bg-emerald-500/15 text-emerald-500'}`}>{t.type}</span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-slate-700 dark:text-slate-200">{t.description}</span>
                                        <span className="block truncate text-[9px] text-slate-400">{t.vendor}</span>
                                    </span>
                                    <span className="tabular-nums text-slate-600 dark:text-slate-300">{fmtMoney(t.amountFrac * model.baseline)}</span>
                                    <select className="rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1 py-0.5 text-[9px] text-slate-500"
                                        value={t.status} onChange={(ev) => fin.actions.setTxnStatus(t.id, ev.target.value as typeof t.status)}>
                                        {['pending', 'committed', 'approved', 'paid'].map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => fin.actions.addTxn({ date: 'now', type: 'invoice', vendor: 'New vendor', description: 'New transaction', amountFrac: 0.001, status: 'pending' })}
                            className="mt-2 rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:border-violet-400">＋ New Financial Entry</button>
                    </div>
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Outstanding Invoices (AR/AP)</h2>
                            <div className="space-y-1">
                                {fin.invoices.map((iv) => (
                                    <div key={iv.id} className="flex items-center gap-2 text-[11px]">
                                        <span className={`rounded px-1 py-0.5 text-[8.5px] font-bold ${iv.direction === 'AP' ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/15 text-emerald-500'}`}>{iv.direction}</span>
                                        <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{iv.vendor} <span className="text-[9px] text-slate-400">{iv.invoiceNo} · {iv.dueLabel}</span></span>
                                        <span className="tabular-nums text-slate-600 dark:text-slate-300">{fmtMoney(iv.amountFrac * model.baseline)}</span>
                                        <select className="rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1 py-0.5 text-[9px] text-slate-500"
                                            value={iv.status} onChange={(ev) => fin.actions.setInvoiceStatus(iv.id, ev.target.value as typeof iv.status)}>
                                            {['outstanding', 'overdue', 'paid'].map((s) => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Budget Revisions (change orders)</h2>
                            {fin.revisions.map((r) => (
                                <label key={r.id} className="flex items-center gap-2 py-0.5 text-[11px]">
                                    <input type="checkbox" checked={r.approved} onChange={() => fin.actions.toggleRevision(r.id)} className="accent-violet-500" />
                                    <span className="flex-1 truncate text-slate-700 dark:text-slate-200">{r.description}</span>
                                    <span className="tabular-nums text-slate-500">{fmtMoney(r.amountFrac * model.baseline)}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* KPI row */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                            { label: 'Total Budget (Baseline)', value: fmtMoney(model.baseline), sub: 'engine capex P50' },
                            { label: 'Revised Budget', value: fmtMoney(model.revised), sub: `+${fmtMoney(model.approvedRev)} approved changes` },
                            { label: 'Total Committed', value: fmtMoney(model.committed), sub: `${Math.round((model.committed / model.revised) * 100)}% of revised` },
                            { label: 'Total Actual (Paid)', value: fmtMoney(model.paid), sub: `${Math.round((model.paid / model.revised) * 100)}% of revised` },
                            { label: 'Forecast at Completion', value: fmtMoney(model.fac), sub: model.planMode ? 'Plan Mode ≡ revised' : `variance ${fmtMoney(model.fac - model.revised)}` },
                            { label: 'CPI / SPI', value: `${model.cpi} / ${model.spi}`, sub: 'from Construction EVM (single source)' },
                        ].map((k) => (
                            <div key={k.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</div>
                                <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                <div className="truncate text-[10px] text-slate-500">{k.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
                        <div className="min-w-0 space-y-4">
                            {/* budget curve */}
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Budget vs Plan Over Time <span className="text-[9px] normal-case text-slate-400">PV from the engine CPM schedule</span></h2>
                                <div className="h-52">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={model.curve}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                            <XAxis dataKey="month" tick={{ fontSize: 9 }} unit="mo" />
                                            <YAxis tick={{ fontSize: 8 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                                            <Tooltip formatter={(v) => fmtMoney(Number(v))} contentStyle={{ fontSize: 10 }} />
                                            <Legend wrapperStyle={{ fontSize: 10 }} />
                                            <Area dataKey="pvUsd" name="Planned Value (cumulative)" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.15} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* OPEX */}
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Annual OPEX by Type <span className="text-[9px] normal-case text-slate-400">engine models.opex · DC-contract basis (Phase-Q preset)</span></h2>
                                {model.opex ? (
                                    <div className="flex items-center gap-3">
                                        <div className="h-36 w-36 shrink-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={model.opexDonut} dataKey="v" nameKey="name" innerRadius={34} outerRadius={54} paddingAngle={2}>
                                                        {model.opexDonut.map((_, idx) => <Cell key={idx} fill={OPEX_COLORS[idx]} />)}
                                                    </Pie>
                                                    <Tooltip formatter={(v) => fmtMoney(Number(v))} contentStyle={{ fontSize: 10 }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="min-w-0 flex-1 space-y-0.5">
                                            {model.opexDonut.map((r, idx) => (
                                                <div key={r.name} className="flex items-center gap-1.5 text-[10px]">
                                                    <span className="h-2 w-2 rounded-sm" style={{ background: OPEX_COLORS[idx] }} />
                                                    <span className="text-slate-600 dark:text-slate-300">{r.name}</span>
                                                    <span className="ml-auto tabular-nums text-slate-500">{fmtMoney(r.v)}</span>
                                                </div>
                                            ))}
                                            <div className="border-t border-slate-200 dark:border-slate-800 pt-0.5 text-[11px] font-bold text-slate-900 dark:text-white">
                                                {fmtMoney(model.opex.totalExtended ?? model.opex.total)} <span className="font-normal text-slate-400">/ year</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : <p className="text-xs text-slate-500">Engine loading…</p>}
                            </div>
                        </div>

                        {/* rail */}
                        <aside className="space-y-4 lg:sticky lg:top-4 self-start">
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 text-center">
                                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Financial Health</h3>
                                <div className={`text-4xl font-bold ${model.grade === 'A' ? 'text-emerald-500' : model.grade === 'B' ? 'text-lime-500' : model.grade === 'C' ? 'text-amber-500' : 'text-rose-500'}`}>{model.grade}</div>
                                <div className="text-[10px] text-slate-500">{model.health}/100 · 0.3 budget-var + 0.35 CPI + 0.35 SPI</div>
                                <div className="mt-1.5 space-y-0.5 text-left text-[11px]">
                                    <div className="flex justify-between"><span className="text-slate-500">Budget Variance</span><span className={`tabular-nums ${Math.abs(model.fac - model.revised) / model.revised < 0.02 ? 'text-emerald-500' : 'text-amber-500'}`}>{((model.fac - model.revised) / model.revised * 100).toFixed(1)}%</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">CPI</span><span className="tabular-nums text-slate-700 dark:text-slate-200">{model.cpi}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">SPI</span><span className="tabular-nums text-slate-700 dark:text-slate-200">{model.spi}</span></div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-violet-500/30 bg-violet-600/5 p-3">
                                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-500">Key Insights</h3>
                                <ul className="space-y-0.5">
                                    {insights.map((s, idx) => <li key={idx} className="flex gap-1.5 text-[11px] text-slate-700 dark:text-slate-300"><span className="text-violet-500">✓</span>{s}</li>)}
                                </ul>
                            </div>
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Deep Dives</h3>
                                <div className="space-y-1 text-[11px]">
                                    {([['invest', 'Investment & Capitalization'], ['montecarlo', 'Monte Carlo'], ['portfolio', 'Portfolio'], ['benchmark', 'Benchmarks'], ['strategic', 'Strategic Planning']] as const).map(([id, l]) => (
                                        <button key={id} onClick={() => setActiveTab(id)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-left text-slate-600 dark:text-slate-300 hover:border-violet-400">{l} →</button>
                                    ))}
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            )}
        </div>
    );
}
