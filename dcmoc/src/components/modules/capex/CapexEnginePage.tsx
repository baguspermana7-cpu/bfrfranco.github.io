'use client';

/* ─── CAPEX Engine — output/analysis page (Phase E) ──────────────────────────
 * Owner: "capex engine = output analysis of the existing inputs." Analysis
 * sections per the DC-OS reference; ALL inputs keep their home — the full
 * legacy CapexDashboard (config panel + its views) is absorbed BY COMPOSITION
 * as the "Assumptions & Config" tab. Shared canonicals live in Requirements.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { TraceValue } from '@/components/ui/TraceValue';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import CapexDashboard from '@/components/modules/CapexDashboard';
import {
    categorize, riskBand, sweepItLoad, tornadoDrivers, contingencyBreakdown,
    escalationTable, PAYMENT_TERMS, boqRows, capexInsights,
} from '@/state/adapters/capex-adapter';
import { fmtMoney } from '@/lib/format';
import { Building, ChevronRight, FileDown, ClipboardList } from 'lucide-react';
import { rzData } from '@/lib/rz-engine';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';
import { buildBoqModel, openBoqDossier, withProjectMeta } from '@/modules/reporting/boq/BoqDossier';
import { useRequirementsStore } from '@/store/requirements';

export function CapexEnginePage() {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const inputs = useCapexStore((s) => s.inputs);
    const results = useCapexStore((s) => s.results);
    const runCalculation = useCapexStore((s) => s.runCalculation);
    const [tab, setTab] = React.useState<'analysis' | 'config'>('analysis');
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => { if (!results) runCalculation(); }, [results, runCalculation]);

    const model = React.useMemo(() => {
        if (!results) return null;
        const cats = categorize(results, inputs.itLoad);
        const band = riskBand(results.total);
        return {
            cats, band,
            sweep: sweepItLoad(inputs),
            tornado: tornadoDrivers(inputs),
            cont: contingencyBreakdown(results, inputs),
            esc: escalationTable(),
            boq: boqRows(results),
            insights: capexInsights(results, inputs, cats.rows),
        };
    }, [results, inputs]);

    if (!results || !model) return <div className="p-8 text-center text-sm text-slate-500">Calculating CAPEX…</div>;
    const { cats, band } = model;
    // Whole-dollar $/kW for display (engine metrics.perKw carries decimals — "$9,073.341" audit fix)
    const perKw = Math.round(results.metrics?.perKw ?? results.total / Math.max(1, inputs.itLoad));

    const exportPdf = async () => {
        setBusy(true);
        try {
            const narrativeMetrics = { perKw, p50: band.p50, p80: band.p80, contingencyPct: inputs.contingency };
            await generatePillarPDF({
                title: 'CAPEX Engine', layer: 'CAPEX Engine', project: '—',
                kpis: [
                    { label: 'Total CAPEX (P50)', value: fmtMoney(band.p50), sub: 'base estimate' },
                    { label: 'P80 (Risk-Adjusted)', value: fmtMoney(band.p80), sub: `+${(((band.p80 - band.p50) / band.p50) * 100).toFixed(1)}% vs P50` },
                    { label: 'P10 (Optimistic)', value: fmtMoney(band.p10), sub: `${(((band.p10 - band.p50) / band.p50) * 100).toFixed(1)}% vs P50` },
                    { label: '$ / kW', value: `$${perKw.toLocaleString()}`, sub: `${(inputs.itLoad / 1000).toFixed(1)} MW IT` },
                    { label: 'Contingency', value: fmtMoney(results.contingency ?? 0), sub: `${inputs.contingency}% (= design margin)` },
                    { label: 'Estimate Class', value: 'AACE Class 4', sub: '−30% / +50% (engine truth)' },
                ],
                config: [
                    ['IT Load', `${(inputs.itLoad / 1000).toFixed(1)} MW`],
                    ['Contingency', `${inputs.contingency}%`],
                    ['Project Year', String(inputs.projYear)],
                    ['Fuel Storage', `${inputs.fuelHours} h`],
                    ['Renewable Option', String(inputs.renewableOption ?? 'none')],
                    ['Green Certification', String(inputs.greenCert ?? 'none')],
                    ['Estimate Class', 'AACE Class 4 (−30% / +50%)'],
                ],
                sections: [
                    { title: 'CAPEX Breakdown (P50)', head: ['Category', 'Total', '%'], rows: cats.rows.map((r) => [r.name, fmtMoney(r.usd), `${r.pct}%`]) },
                    { title: 'BOQ Summary (by category)', head: ['Line Item', 'Category', 'Total', '%'], rows: model.boq.map((r) => [r.line, r.category, fmtMoney(r.usd), `${r.pctOfTotal}%`]) },
                    { title: 'Contingency & Soft Costs', head: ['Type', 'Basis', 'Total'], rows: model.cont.map((c) => [c.type, c.basis, fmtMoney(c.usd)]) },
                    { title: 'Cost Escalation (projYear index)', head: ['Year', 'Multiplier'], rows: model.esc.map((e) => [`${e.year}${e.year === inputs.projYear ? ' · selected' : ''}`, `×${e.mult.toFixed(2)}`]) },
                ],
                donut: { title: 'CAPEX Breakdown (P50)', unitLabel: 'total CAPEX', slices: cats.rows.map((r) => ({ label: r.name, value: r.usd, color: r.color })) },
                callouts: model.insights.map((s, idx) => ({ title: `Key Insight ${idx + 1}`, body: s, tone: 'info' as const })),
                assessment: buildAssessment('capex', narrativeMetrics),
                actions: buildActions('capex', narrativeMetrics),
                summaryBand: [
                    { label: 'P10', value: fmtMoney(band.p10) },
                    { label: 'P50', value: fmtMoney(band.p50) },
                    { label: 'P80', value: fmtMoney(band.p80) },
                    { label: 'P90', value: fmtMoney(band.p90) },
                    { label: '$ / kW', value: `$${perKw.toLocaleString()}` },
                    { label: 'Contingency', value: fmtMoney(results.contingency ?? 0) },
                ],
                note: `Deterministic engine-derived analysis — cost DB v${rzVersion()}. AACE Class 4 band (−30%/+50%), deterministic normal approximation; IT fit-out (racks/servers) excluded — no engine cost model.`,
            } as StandardReport);
        } finally { setBusy(false); }
    };

    const openBoq = () => {
        if (!results) return;
        const m = buildBoqModel(inputs, results);
        if (!m) return;
        const meta = withProjectMeta(m, {
            projectName: useRequirementsStore.getState().overview.projectName,
            tierLevel: useSimulationStore.getState().inputs.tierLevel,
        }).projectMeta;
        openBoqDossier(m, meta);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg"><Building className="h-6 w-6 text-white" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">CAPEX Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Estimate, analyze and optimize total capital expenditure with risk-adjusted forecasting</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                        {(['analysis', 'config'] as const).map((t) => (
                            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-xs font-medium ${tab === t ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                {t === 'analysis' ? 'Cost Analysis' : 'Assumptions & Config'}
                            </button>
                        ))}
                    </div>
                    <button onClick={exportPdf} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-violet-400"><FileDown className="h-3.5 w-3.5" />{busy ? '…' : 'Export'}</button>
                    <button onClick={openBoq} title="Bill of Quantities — line items by discipline, disclosed margin, safety factors (save as PDF)" className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/60 px-2.5 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10"><ClipboardList className="h-3.5 w-3.5" />BOQ</button>
                    <button onClick={() => setActiveTab('construction')} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">Next: Construction <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'config' ? (
                <div>
                    <p className="mb-2 rounded-lg border border-violet-500/30 bg-violet-600/5 px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300">
                        Shared canonicals (IT load, cooling, redundancy, country, rack class) are owned by <button className="font-semibold text-violet-500" onClick={() => setActiveTab('requirements')}>Requirements</button> — edit them there. CAPEX-only assumptions below.
                    </p>
                    <CapexDashboard />
                </div>
            ) : (
                <div className="space-y-4">
                    {/* KPI row */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                            { label: 'Total CAPEX (P50)', value: fmtMoney(band.p50), sub: 'base estimate', trace: 'capex.total' },
                            { label: 'P80 (Risk-Adjusted)', value: fmtMoney(band.p80), sub: `+${(((band.p80 - band.p50) / band.p50) * 100).toFixed(1)}% vs P50`, trace: 'capex.p80' },
                            { label: 'P10 (Optimistic)', value: fmtMoney(band.p10), sub: `${(((band.p10 - band.p50) / band.p50) * 100).toFixed(1)}% vs P50`, trace: 'capex.p10' },
                            { label: '$ / kW', value: `$${perKw.toLocaleString()}`, sub: `${(inputs.itLoad / 1000).toFixed(1)} MW IT`, trace: 'capex.perKw' },
                            { label: 'Contingency', value: fmtMoney(results.contingency ?? 0), sub: `${inputs.contingency}% (= design margin)`, trace: 'capex.contingency' },
                            { label: 'Estimate Class', value: 'AACE Class 4', sub: '−30% / +50% (engine truth)' },
                        ].map((k) => (
                            <div key={k.label} title={`${k.label}: ${k.value}${(k as {sub?: string}).sub ? " — " + (k as {sub?: string}).sub : ""}`} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</div>
                                {(k as { trace?: string }).trace ? (
                                    <TraceValue traceId={(k as { trace?: string }).trace!}>
                                        <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                    </TraceValue>
                                ) : (
                                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                )}
                                <div className="truncate text-[10px] text-slate-500">{k.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        {/* breakdown */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">CAPEX Breakdown (P50)</h2>
                            <div className="flex items-center gap-3">
                                <div className="h-40 w-40 shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={cats.rows} dataKey="usd" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2}>
                                                {cats.rows.map((r) => <Cell key={r.name} fill={r.color} />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => fmtMoney(Number(v))} contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="min-w-0 flex-1 space-y-0.5">
                                    {cats.rows.map((r) => (
                                        <div key={r.name} className="flex items-center gap-1.5 text-[10px]">
                                            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: r.color }} />
                                            <span className="truncate text-slate-600 dark:text-slate-300">{r.name}</span>
                                            <span className="ml-auto shrink-0 tabular-nums text-slate-500">{fmtMoney(r.usd)} · {r.pct}%</span>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-1.5 border-t border-slate-200 dark:border-slate-800 pt-0.5 text-[10px]">
                                        <span className="text-slate-400">IT fit-out (racks/servers)</span>
                                        <span className="ml-auto rounded bg-slate-500/15 px-1 py-0.5 text-[8px] font-semibold text-slate-400">EXCLUDED — no engine cost model</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* risk curve */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">CAPEX Forecast (Risk-Adjusted) <span className="ml-1 text-[9px] normal-case text-slate-400">AACE band · deterministic normal approx</span></h2>
                            <div className="h-40">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={band.curve}>
                                        <XAxis dataKey="x" tick={{ fontSize: 8 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                                        <YAxis hide />
                                        <Tooltip formatter={() => ''} labelFormatter={(v) => fmtMoney(Number(v))} contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                        <Area dataKey="y" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.25} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-1 grid grid-cols-4 gap-2 text-center text-[10px]">
                                {[['P10', band.p10, 'text-emerald-500', 'capex.p10'], ['P50 · Base', band.p50, 'text-violet-500', 'capex.total'], ['P80', band.p80, 'text-amber-500', 'capex.p80'], ['P90', band.p90, 'text-rose-500', 'capex.p90']].map(([l, v, c, t]) => (
                                    <div key={l as string}>
                                        <TraceValue traceId={t as string}>
                                            <div className={`font-bold tabular-nums ${c}`}>{fmtMoney(v as number)}</div>
                                        </TraceValue>
                                        <div className="text-slate-500">{l}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        {/* BOQ */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">BOQ Summary (by category) <span className="ml-1 text-[9px] normal-case text-slate-400">assembly-level Class-4 budgetary — not a QTO</span></h2>
                            <div className="max-h-64 overflow-y-auto">
                                <table className="w-full text-[11px]">
                                    <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">Line Item</th><th className="text-right">Total</th><th className="text-right">%</th></tr></thead>
                                    <tbody>
                                        {model.boq.map((r) => (
                                            <tr key={r.line} className="border-b border-slate-100 dark:border-slate-800/60">
                                                <td className="py-1"><span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: r.color }} /><span className="text-slate-700 dark:text-slate-200">{r.line}</span> <span className="text-[9px] text-slate-400">· {r.category}</span></td>
                                                <td className="text-right tabular-nums text-slate-600 dark:text-slate-300">{fmtMoney(r.usd)}</td>
                                                <td className="text-right tabular-nums text-slate-500">{r.pctOfTotal}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* sensitivity sweep + tornado */}
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cost Sensitivity — IT Load sweep</h2>
                                <div className="h-36">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={model.sweep}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                            <XAxis dataKey="itMw" tick={{ fontSize: 9 }} unit=" MW" />
                                            <YAxis tick={{ fontSize: 8 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} />
                                            <Tooltip formatter={(v) => fmtMoney(Number(v))} contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                            <Legend wrapperStyle={{ fontSize: 9 }} />
                                            <Line dataKey="p90" name="P90" stroke="#fb7185" strokeWidth={1.5} dot={false} />
                                            <Line dataKey="p50" name="P50" stroke="#a78bfa" strokeWidth={2} dot={{ r: 2 }} />
                                            <Line dataKey="p10" name="P10" stroke="#34d399" strokeWidth={1.5} dot={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Top Cost Drivers (one-at-a-time swing)</h2>
                                <div className="space-y-1">
                                    {model.tornado.map((d) => {
                                        const max = model.tornado[0]?.swing ?? 1;
                                        return (
                                            <div key={d.name} className="flex items-center gap-2 text-[11px]">
                                                <span className="w-44 truncate text-slate-600 dark:text-slate-300">{d.name}</span>
                                                <div className="h-2.5 flex-1 rounded bg-slate-100 dark:bg-slate-800"><div className="h-2.5 rounded bg-amber-500" style={{ width: `${(d.swing / max) * 100}%` }} /></div>
                                                <span className="w-16 text-right tabular-nums text-slate-500">{fmtMoney(d.swing)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* bottom row */}
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Contingency & Soft Costs</h3>
                            {model.cont.map((c) => (
                                <div key={c.type} className="flex justify-between gap-2 py-0.5 text-[11px]">
                                    <span className="text-slate-600 dark:text-slate-300">{c.type}<span className="block text-[9px] text-slate-400">{c.basis}</span></span>
                                    <span className="tabular-nums font-medium text-slate-800 dark:text-slate-200">{fmtMoney(c.usd)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Cost Escalation <span className="text-[8px] normal-case text-slate-400">· basis: projYear index (engine-real, no commodity indices)</span></h3>
                            {model.esc.map((e) => (
                                <div key={e.year} className={`flex justify-between py-0.5 text-[11px] ${e.year === inputs.projYear ? 'font-semibold text-violet-500' : 'text-slate-600 dark:text-slate-300'}`}>
                                    <span>{e.year}{e.year === inputs.projYear ? ' · selected' : ''}</span>
                                    <span className="tabular-nums">×{e.mult.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Payment Terms <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-semibold text-amber-500">ASSUMPTION</span></h3>
                            <div className="h-24">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={PAYMENT_TERMS}>
                                        <XAxis dataKey="milestone" tick={{ fontSize: 7 }} interval={0} angle={-18} height={34} textAnchor="end" />
                                        <YAxis hide />
                                        <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                        <Bar dataKey="pct" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-violet-500/30 bg-violet-600/5 p-3">
                        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-500">Key Insights</h3>
                        <ul className="space-y-0.5">
                            {model.insights.map((s, idx) => <li key={idx} className="flex gap-1.5 text-[11px] text-slate-700 dark:text-slate-300"><span className="text-violet-500">✓</span>{s}</li>)}
                        </ul>
                        <p className="mt-1 text-[9px] text-slate-400">Deterministic engine-derived analysis — cost DB v{rzVersion()}.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

function rzVersion(): string {
    return rzData()?.version ?? '—';
}
