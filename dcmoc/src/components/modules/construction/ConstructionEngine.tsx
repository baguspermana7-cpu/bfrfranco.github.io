'use client';

/* ─── Construction Engine — page (Phase F) ───────────────────────────────────
 * PLANNED plane engine-real (fixed schedule mapping, PV S-curve, milestones,
 * long-lead procurement); ACTUAL plane user-entered (tracking store) with a
 * PLAN MODE banner default. EVM (SPI/CPI) derived here is the single source
 * later consumed by Financial. Absorbs the old ConstructionDashboard content
 * (empty-state, phase bars, long-lead card, PDF).
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useConstructionTracking, isPlanMode } from '@/store/constructionTracking';
import { plannedSchedule, evm, pvCurve, procurementRows, manpowerCurve, healthScore } from '@/state/adapters/construction-adapter';
import { CreatableCombobox, type ComboValue } from '@/components/ui/CreatableCombobox';
import GanttChart from '@/components/visualizations/GanttChart';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';
import { fmtMoney } from '@/lib/format';
import { TraceValue } from '@/components/ui/TraceValue';
import { HardHat, ChevronRight, FileDown, ClipboardList } from 'lucide-react';
import { buildBoqModel, openBoqDossier, withProjectMeta } from '@/modules/reporting/boq/BoqDossier';
import { useRequirementsStore } from '@/store/requirements';

const PCT_PRESETS = [0, 10, 25, 50, 75, 90, 100].map((v) => ({ value: v, label: `${v}%` }));

export function ConstructionEngine() {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const results = useCapexStore((s) => s.results);
    const capexInputs = useCapexStore((s) => s.inputs);
    const runCalculation = useCapexStore((s) => s.runCalculation);
    const t = useConstructionTracking();
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => { if (!results) runCalculation(); }, [results, runCalculation]);

    const sched = React.useMemo(() => plannedSchedule(results?.timeline), [results]);
    const budget = results?.total ?? 0;
    const e = React.useMemo(() => sched ? evm(sched, budget, t.statusMonth, t.phaseActualPct, t.acSpentUsd) : null, [sched, budget, t.statusMonth, t.phaseActualPct, t.acSpentUsd]);
    const curve = React.useMemo(() => sched ? pvCurve(sched, budget) : [], [sched, budget]);
    const proc = React.useMemo(() => sched ? procurementRows(sched.milestones?.powerOn ?? sched.totalMonths * 0.85) : { rows: [], recommendEarlyOrder: false }, [sched]);
    const manpower = React.useMemo(() => sched ? manpowerCurve(sched.totalMonths, t.peakManpowerPlanned) : [], [sched, t.peakManpowerPlanned]);
    const planMode = isPlanMode(t);
    const openIssues = t.issues.filter((i) => i.status !== 'closed').length;
    const health = e ? healthScore(e, openIssues) : null;

    if (!results || !sched || !e) {
        return (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-10 text-center text-sm text-slate-500">
                Run the CAPEX engine first — the construction schedule derives from the CAPEX timeline.
                <div className="mt-3"><button onClick={() => setActiveTab('capex')} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">Open CAPEX Engine</button></div>
            </div>
        );
    }

    const statusVal: ComboValue<number> | null = t.statusMonth == null ? null : { value: t.statusMonth, isCustom: true };
    const exportPdf = async () => {
        setBusy(true);
        try {
            const narrativeMetrics = { spi: e.spi, cpi: e.cpi };
            await generatePillarPDF({
                title: 'Construction', layer: 'Layer 6 · Construction Engine', project: '—',
                kpis: [
                    { label: 'Overall Progress', value: `${e.overallPct}%`, sub: planMode ? 'baseline (Plan Mode)' : `PV ${e.pvPct}%` },
                    { label: 'Total Build', value: `${sched.totalMonths} mo`, sub: `forecast ${e.forecastTotalMonths} mo` },
                    { label: 'SPI / CPI', value: `${e.spi} / ${e.cpi}`, sub: planMode ? 'baseline 1.00' : 'from tracking' },
                    { label: 'Budget', value: fmtMoney(budget), sub: `AC ${fmtMoney(e.acUsd)}` },
                ],
                sections: [
                    { title: 'Schedule (engine CPM)', head: ['Phase', 'Start', 'End', 'Months'], rows: sched.rows.map((r) => [r.label, `M${r.startMonth}`, `M${r.endMonth.toFixed(1)}`, String(r.months)]) },
                    { title: 'Long-Lead Procurement', head: ['Item', 'Lead (mo)', 'PO by', 'ETA'], rows: proc.rows.map((r) => [r.item, String(r.leadMonths), `M${r.poMonth}`, `M${r.etaMonth}`]) },
                ],
                config: [
                    ['Start', 'M0 (NTP)'],
                    ['Status Month', t.statusMonth == null ? 'Plan Mode (no actuals)' : `M${t.statusMonth}`],
                    ['Phases', String(sched.rows.length)],
                    ['Budget (CAPEX total)', fmtMoney(budget)],
                    ['Planned Duration', `${sched.totalMonths} mo`],
                    ['Peak Crew (planned)', String(t.peakManpowerPlanned)],
                ],
                callouts: [
                    {
                        title: `EVM Health — SPI ${e.spi} / CPI ${e.cpi}`,
                        body: planMode
                            ? 'Plan Mode — baseline plan shown; no site actuals entered, so SPI/CPI = 1.00 by definition. Set a status month + phase actuals to start tracking.'
                            : `Schedule performance ${e.spi >= 1 ? 'on/ahead of plan' : 'behind plan'} (SPI ${e.spi}); cost performance ${e.cpi >= 1 ? 'under budget' : 'over budget'} (CPI ${e.cpi}). Forecast completion M${e.forecastTotalMonths}${e.delayMonths > 0 ? ` (+${e.delayMonths} mo delay)` : ' (on plan)'}.`,
                        tone: planMode ? ('info' as const) : (e.spi >= 1 && e.cpi >= 1 ? ('good' as const) : ('warn' as const)),
                    },
                    ...(health ? [{
                        title: `Health Score ${health.score}/100 — ${health.band}`,
                        body: `Composite of SPI (40) + CPI (30) + schedule (15) + open issues (15). ${openIssues} open issue(s).`,
                        tone: health.score >= 85 ? ('good' as const) : health.score >= 65 ? ('info' as const) : ('warn' as const),
                    }] : []),
                ],
                assessment: buildAssessment('construction', narrativeMetrics),
                actions: [
                    ...buildActions('construction', narrativeMetrics),
                    ...t.risks.filter((r) => r.status !== 'closed').slice(0, 5).map((r) => ({
                        priority: r.impact === 'high' ? ('HIGH' as const) : r.impact === 'medium' ? ('MEDIUM' as const) : ('LOW' as const),
                        action: `${r.risk} — impact ${r.impact}, probability ${r.probability}, ${r.status}${r.isExample ? ' (example)' : ''}`,
                    })),
                ],
                summaryBand: [
                    { label: 'Progress', value: `${e.overallPct}%` },
                    { label: 'Planned', value: `M${sched.totalMonths}` },
                    { label: 'Forecast', value: `M${e.forecastTotalMonths}` },
                    { label: 'SPI', value: String(e.spi) },
                    { label: 'CPI', value: String(e.cpi) },
                    { label: 'AC Spent', value: fmtMoney(e.acUsd) },
                ],
                note: 'Planned plane engine-real (CPM schedule + long-lead data); actuals user-entered; EVM deterministic. Lead times: 2024-26 supply-constrained market.',
            } as StandardReport);
        } finally { setBusy(false); }
    };

    const openBoq = () => {
        if (!results) return;
        const m = buildBoqModel(capexInputs, results);
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
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg"><HardHat className="h-6 w-6 text-white" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Construction Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Plan, track and control construction from mobilization to handover</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[10px] uppercase text-slate-500">Status month
                        <div className="w-28 normal-case">
                            <CreatableCombobox<number> options={[6, 12, 18, 24].map((v) => ({ value: v, label: `M${v}` }))}
                                value={statusVal} min={0} max={Math.ceil(sched.totalMonths)} unit="mo" placeholder="Plan Mode"
                                onChange={(v) => t.actions.set({ statusMonth: v?.value ?? null })} />
                        </div>
                    </label>
                    <button onClick={openBoq} title="Bill of Quantities — line items by discipline, disclosed margin, safety factors (save as PDF)" className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"><ClipboardList className="h-3.5 w-3.5" />Bill of Quantities (BOQ)</button>
                    <button onClick={exportPdf} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-violet-400"><FileDown className="h-3.5 w-3.5" />{busy ? '…' : 'Export'}</button>
                    <button onClick={() => setActiveTab('commissioning')} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">Next: Commissioning <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {planMode && (
                <div className="rounded-xl border border-violet-500/40 bg-violet-600/10 px-3 py-2 text-[11px] text-violet-500">
                    <b>Plan Mode</b> — showing the baseline plan; no site actuals entered. SPI/CPI = 1.00 by definition. Set a status month + phase actuals to start tracking.
                </div>
            )}

            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {[
                    /* audit #8: `baselineChip` marks KPIs that are DEFINITIONAL in Plan Mode
                     * (EV≡PV → 100% progress, AC≡PV → 100% spend, SPI/CPI≡1.00) — a grey chip
                     * keeps the perfect-looking figures honest. Presentation only, no math change. */
                    { label: 'Overall Progress', value: `${e.overallPct}%`, sub: planMode ? 'baseline' : `PV ${e.pvPct}%`, trace: 'constr.progressPct', baselineChip: planMode },
                    { label: 'Planned Completion', value: `M${sched.totalMonths}`, sub: `${Math.round(sched.totalMonths / 12 * 10) / 10} years` },
                    { label: 'Forecast Completion', value: `M${e.forecastTotalMonths}`, sub: e.delayMonths > 0 ? `+${e.delayMonths} mo delay` : 'on plan', trace: 'constr.forecastMonths' },
                    { label: 'Budget (Cumulative)', value: fmtMoney(budget), sub: `AC ${fmtMoney(e.acUsd)} (${budget > 0 ? Math.round((e.acUsd / budget) * 100) : 0}%)`, trace: 'capex.total', baselineChip: planMode },
                    { label: 'SPI', value: String(e.spi), sub: planMode ? 'baseline' : e.spi >= 1 ? 'on/ahead' : 'behind', trace: 'constr.spi', baselineChip: planMode },
                    { label: 'CPI', value: String(e.cpi), sub: planMode ? 'baseline' : e.cpi >= 1 ? 'under budget' : 'over budget', trace: 'constr.cpi', baselineChip: planMode },
                ].map((k) => (
                    <div key={k.label} title={`${k.label}: ${k.value}${(k as {sub?: string}).sub ? " — " + (k as {sub?: string}).sub : ""}${(k as { baselineChip?: boolean }).baselineChip ? ' — Plan Mode: definitional baseline values, no actuals yet' : ''}`} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</div>
                        {(k as { trace?: string }).trace ? (
                            <TraceValue traceId={(k as { trace?: string }).trace!}>
                                <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                            </TraceValue>
                        ) : (
                            <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                        )}
                        <div className="truncate text-[10px] text-slate-500">{k.sub}</div>
                        {(k as { baselineChip?: boolean }).baselineChip && (
                            <span className="mt-1 inline-block rounded bg-slate-400/15 px-1 py-0.5 text-[8px] font-semibold leading-tight text-slate-500">Plan Mode — baseline (belum ada actuals)</span>
                        )}
                    </div>
                ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
                <div className="min-w-0 space-y-4">
                    {/* master schedule */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Master Construction Schedule <span className="ml-1 text-[9px] normal-case text-slate-400">engine CPM · L2 detail from CAPEX timeline</span></h2>
                        <div className="mb-3 space-y-1">
                            {sched.rows.map((r) => {
                                const pctVal: ComboValue<number> | null = t.phaseActualPct[r.key] == null ? null : { value: t.phaseActualPct[r.key]!, isCustom: true };
                                const behind = e.behindKeys.includes(r.key);
                                return (
                                    <div key={r.key} className="flex items-center gap-2 text-[11px]">
                                        <span className="w-32 truncate text-slate-600 dark:text-slate-300">{r.label}</span>
                                        <div className="relative h-3 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                                            <div className={`absolute h-3 rounded ${behind ? 'bg-rose-500/70' : 'bg-violet-500/70'}`}
                                                style={{ left: `${(r.startMonth / sched.totalMonths) * 100}%`, width: `${(r.months / sched.totalMonths) * 100}%` }} />
                                        </div>
                                        <span className="w-20 text-right tabular-nums text-slate-500">M{r.startMonth}–M{r.endMonth.toFixed(0)}</span>
                                        <div className="w-24">
                                            <CreatableCombobox<number> options={PCT_PRESETS} value={pctVal} min={0} max={100} unit="%" placeholder="—"
                                                onChange={(v) => t.actions.setPhasePct(r.key, v?.value ?? null)} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {results.timeline && <GanttChart phases={results.timeline.phases} subPhases={results.timeline.subPhases} totalMonths={results.timeline.totalMonths} />}
                    </div>

                    {/* S-curve + manpower */}
                    <div className="grid gap-4 xl:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Progress S-Curve (PV{planMode ? '' : ' vs EV'})</h2>
                            <div className="h-44">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={curve}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                        <XAxis dataKey="month" tick={{ fontSize: 9 }} unit="mo" />
                                        <YAxis tick={{ fontSize: 9 }} unit="%" domain={[0, 100]} />
                                        <Tooltip contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                        <Area dataKey="pvPct" name="Planned %" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.15} />
                                        {!planMode && t.statusMonth != null && (
                                            <Line data={[{ month: t.statusMonth, ev: e.evPct }]} dataKey="ev" name="Actual (EV) %" stroke="#34d399" dot={{ r: 5 }} />
                                        )}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Manpower Plan <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-semibold text-amber-500">SCREENING MODEL</span></h2>
                            <div className="h-44">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={manpower}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                        <XAxis dataKey="month" tick={{ fontSize: 9 }} unit="mo" />
                                        <YAxis tick={{ fontSize: 9 }} />
                                        <Tooltip contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                        <Area dataKey="planned" name="Planned crew" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.15} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                                Peak crew:
                                <div className="w-28">
                                    <CreatableCombobox<number> options={[250, 500, 800, 1500].map((v) => ({ value: v, label: String(v) }))}
                                        value={{ value: t.peakManpowerPlanned, isCustom: true }} min={10} max={20000}
                                        onChange={(v) => t.actions.set({ peakManpowerPlanned: v?.value ?? 800 })} />
                                </div>
                                {t.manpowerOnSite != null && <span>· on site {t.manpowerOnSite}</span>}
                            </div>
                        </div>
                    </div>

                    {/* procurement */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Procurement & Delivery <span className="ml-1 text-[9px] normal-case text-slate-400">engine long-lead data · 2024-26 supply-constrained market · vendors = examples</span></h2>
                        <table className="w-full text-[11px]">
                            <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">Item</th><th className="text-left">Vendor</th><th className="text-right">Lead</th><th className="text-right">PO by</th><th className="text-right">ETA</th><th className="text-right">Status</th></tr></thead>
                            <tbody>
                                {proc.rows.map((r) => (
                                    <tr key={r.item} className="border-b border-slate-100 dark:border-slate-800/60">
                                        <td className="py-1 capitalize text-slate-700 dark:text-slate-200">{r.item}</td>
                                        <td className="text-slate-400">{r.vendorExample}</td>
                                        <td className="text-right tabular-nums text-slate-500">{r.leadMonths} mo</td>
                                        <td className="text-right tabular-nums text-slate-500">M{r.poMonth}</td>
                                        <td className="text-right tabular-nums text-slate-500">M{r.etaMonth}</td>
                                        <td className="text-right"><span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${r.critical ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/15 text-emerald-500'}`}>{r.critical ? 'Order now' : 'In window'}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {proc.recommendEarlyOrder && <p className="mt-1.5 text-[10px] text-amber-500">⚠ Critical long-lead item(s) exceed the power-on window — pre-order to protect the schedule.</p>}
                    </div>
                </div>

                {/* rail */}
                <aside className="space-y-4 lg:sticky lg:top-4 self-start">
                    {health && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 text-center">
                            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Health Score</h3>
                            <div className={`text-3xl font-bold tabular-nums ${health.score >= 85 ? 'text-emerald-500' : health.score >= 65 ? 'text-amber-500' : 'text-rose-500'}`}>{health.score}<span className="text-sm text-slate-400">/100</span></div>
                            <div className="text-[10px] text-slate-500">{health.band} · SPI 40 + CPI 30 + schedule 15 + issues 15</div>
                            {planMode && (
                                <span className="mt-1 inline-block rounded bg-slate-400/15 px-1 py-0.5 text-[8px] font-semibold text-slate-500">Plan Mode — baseline (belum ada actuals)</span>
                            )}
                        </div>
                    )}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Milestones (engine)</h3>
                        <div className="space-y-1 text-[11px]">
                            {Object.entries(sched.milestones).map(([k, v]) => (
                                <div key={k} className="flex justify-between"><span className="capitalize text-slate-600 dark:text-slate-300">{k.replace(/([A-Z])/g, ' $1')}</span><span className="tabular-nums text-slate-500">M{(v as number).toFixed(1)}</span></div>
                            ))}
                            <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1 font-semibold"><span className="text-slate-700 dark:text-slate-200">Final handover</span><span className="tabular-nums text-violet-500">M{e.forecastTotalMonths}</span></div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Risks (Top)</h3>
                        <div className="space-y-1">
                            {t.risks.slice(0, 5).map((r) => (
                                <div key={r.id} className="text-[11px]">
                                    <div className="flex items-center gap-1.5">
                                        <span className="truncate text-slate-700 dark:text-slate-200">{r.risk}</span>
                                        {r.isExample && <span className="rounded bg-amber-500/15 px-1 text-[8px] font-semibold text-amber-500">EXAMPLE</span>}
                                    </div>
                                    <div className="text-[9px] text-slate-400">impact {r.impact} · prob {r.probability} · {r.status}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Issues ({openIssues} open)</h3>
                        <div className="space-y-1">
                            {t.issues.slice(0, 5).map((i2) => (
                                <div key={i2.id} className="text-[11px]">
                                    <div className="flex items-center gap-1.5">
                                        <span className="truncate text-slate-700 dark:text-slate-200">{i2.title}</span>
                                        {i2.isExample && <span className="rounded bg-amber-500/15 px-1 text-[8px] font-semibold text-amber-500">EXAMPLE</span>}
                                    </div>
                                    <div className="text-[9px] text-slate-400">{i2.status.replace('_', ' ')} · {i2.owner}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
