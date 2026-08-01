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
import { Tooltip as InfoTip } from '@/components/ui/Tooltip';
import { Explain } from '@/components/ui/Explain';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useConstructionTracking, isPlanMode } from '@/store/constructionTracking';
import { plannedSchedule, evm, pvCurve, procurementRows, manpowerCurve, healthScore } from '@/state/adapters/construction-adapter';
import { rzModels } from '@/lib/rz-engine';
import { CreatableCombobox, type ComboValue } from '@/components/ui/CreatableCombobox';
import GanttChart from '@/components/visualizations/GanttChart';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';
import { fmtMoney } from '@/lib/format';
import { TraceValue } from '@/components/ui/TraceValue';
import { ScoreValue } from '@/components/ui/ScoreValue';
import { RedValue, type Diagnosis } from '@/components/ui/RedValue';
import { HardHat, ChevronRight, FileDown, ClipboardList, ShieldCheck } from 'lucide-react';
import { buildBoqModel, openBoqDossier, withProjectMeta } from '@/modules/reporting/boq/BoqDossier';
import { buildDeliveryGovernanceModel, openDeliveryGovernanceDossier } from '@/modules/reporting/dossier/DeliveryGovernanceDossier';
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
    /* 4-level WBS (Workstream E1): engine detailedSchedule expands the CAPEX timeline
     * into phase → sub-phase → task → work-package, each with a duration basis +
     * procurement critical-path flag. Legacy 2-level fallback when engine absent. */
    const itLoadKw = useSimulationStore((s) => s.inputs.itLoad); // subscribe so the tree re-derives when IT load changes
    const wbsTree = React.useMemo(() => {
        if (!results?.timeline) return null;
        try {
            const m = rzModels();
            if (m?.construction?.detailedSchedule) {
                return m.construction.detailedSchedule(results.timeline, { itLoadKw }).tree;
            }
        } catch { /* engine still loading */ }
        return null;
    }, [results, itLoadKw]);
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
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-10 text-center text-sm text-slate-500">
                Run the CAPEX engine first — the construction schedule derives from the CAPEX timeline.
                <div className="mt-3"><button onClick={() => setActiveTab('capex')} className="rounded-lg bg-rz-signal px-3 py-1.5 text-xs font-semibold text-rz-base">Open CAPEX Engine</button></div>
            </div>
        );
    }

    const statusVal: ComboValue<number> | null = t.statusMonth == null ? null : { value: t.statusMonth, isCustom: true };

    /* ── Owner-mandate red-value diagnostics (shared RedValue modal) ─────────
     * SPI/CPI < 1 only in tracking mode (Plan Mode values are definitional
     * 1.00). Reason + levers embed the LIVE EV/PV/AC numbers from this page's
     * own EVM — never a separate estimate. */
    const behindLabels = e.behindKeys.map((k) => sched.rows.find((r) => r.key === k)?.label ?? k);
    const spiDiag: Diagnosis | null = !planMode && e.spi < 1 ? {
        title: 'SPI (Schedule Performance Index)',
        reason: `Behind plan: earned value ${fmtMoney(e.evUsd)} vs planned value ${fmtMoney(e.pvUsd)} at status month M${t.statusMonth ?? '—'} — the site has earned only ${Math.round(e.spi * 100)}¢ of every planned dollar of work.${behindLabels.length ? ` Behind-plan phases (>5 pp under plan): ${behindLabels.join(', ')}.` : ''} Forecast completion M${e.forecastTotalMonths}${e.delayMonths > 0 ? ` (+${e.delayMonths} mo vs plan M${sched.totalMonths})` : ''}.`,
        actual: String(e.spi), threshold: '≥ 1.00',
        gap: `EV −${fmtMoney(e.pvUsd - e.evUsd)} vs PV`,
        levers: [
            {
                label: 'Re-sequence / crew-up',
                detail: `Recover the ${fmtMoney(e.pvUsd - e.evUsd)} earned-value shortfall on ${behindLabels.length ? behindLabels.join(', ') : 'the tracked phases'} — planned peak crew is ${t.peakManpowerPlanned}${t.manpowerOnSite != null ? ` (${t.manpowerOnSite} on site)` : ''}; sustained SPI < 0.9 warrants acceleration or a formal re-baseline.`,
                tab: 'construction',
            },
            {
                label: 'Scope / variation review',
                detail: 'If the slip is scope growth, capture it as a change order in the Financial revisions ledger — an approved revision re-baselines PV instead of dragging SPI.',
                tab: 'finance',
            },
        ],
        tab: 'construction',
        note: 'EVM from this page\'s tracking store: EV = Σ phase actual % × phase weight × budget; PV from the engine CPM schedule.',
    } : null;
    const cpiDiag: Diagnosis | null = !planMode && e.cpi < 1 ? {
        title: 'CPI (Cost Performance Index)',
        reason: `Over budget: earned value ${fmtMoney(e.evUsd)} vs actual cost ${fmtMoney(e.acUsd)} — every dollar spent is earning only ${Math.round(e.cpi * 100)}¢ of planned work (overrun to date ${fmtMoney(e.acUsd - e.evUsd)} against budget ${fmtMoney(budget)}). Industry experience: CPI rarely recovers once it drops below ~0.9 — act early.`,
        actual: String(e.cpi), threshold: '≥ 1.00',
        gap: `AC exceeds EV by ${fmtMoney(e.acUsd - e.evUsd)}`,
        levers: [
            {
                label: 'Scope / variation review',
                detail: `Review change orders in the Financial revisions ledger: the ${fmtMoney(e.acUsd - e.evUsd)} overrun either becomes an approved revision (re-baseline) or a recovery target on the remaining ${fmtMoney(Math.max(0, budget - e.acUsd))} of budget.`,
                tab: 'finance',
            },
            {
                label: 'Verify phase actuals & AC',
                detail: `AC is user-entered (${fmtMoney(e.acUsd)}); confirm the per-phase actual % in the tracking panel — under-reported progress reads as cost overrun.`,
                tab: 'construction',
            },
        ],
        tab: 'construction',
        note: 'CPI = EV ÷ AC on this page\'s tracking store — the Financial Engine consumes this same figure (single source).',
    } : null;

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
        const sim = useSimulationStore.getState();
        const meta = withProjectMeta(m, {
            projectName: useRequirementsStore.getState().overview.projectName,
            tierLevel: sim.inputs.tierLevel,
            location: sim.selectedCountry?.name ?? undefined,
            itMw: +(sim.inputs.itLoad / 1000).toFixed(2),
        }).projectMeta;
        if (!openBoqDossier(m, meta)) {
            window.alert('Popup blocked — allow popups for this site to open the BOQ dossier.');
        }
    };

    const openPmDossier = () => {
        if (!results) return;
        const sim = useSimulationStore.getState();
        const m = buildDeliveryGovernanceModel(capexInputs, results, t, sim, {
            projectName: useRequirementsStore.getState().overview.projectName,
            schedule: sched,
        });
        if (!m) return;
        if (!openDeliveryGovernanceDossier(m)) {
            window.alert('Popup blocked — allow popups for this site to open the Delivery Governance dossier.');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded border border-rz-2 bg-rz-elevated"><HardHat className="h-6 w-6 text-rz-info" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Construction Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Plan, track and control construction from mobilization to handover</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[10px] uppercase text-slate-500">Status month <InfoTip content="Reporting cut-off month, counted from NTP (M0). Enter the current elapsed month — together with per-phase actual % — to switch from baseline Plan Mode into live EVM tracking (SPI/CPI). Leave blank to stay in Plan Mode." />
                        <div className="w-28 normal-case">
                            <CreatableCombobox<number> options={[6, 12, 18, 24].map((v) => ({ value: v, label: `M${v}` }))}
                                value={statusVal} min={0} max={Math.ceil(sched.totalMonths)} unit="mo" placeholder="Plan Mode"
                                onChange={(v) => t.actions.set({ statusMonth: v?.value ?? null })} />
                        </div>
                    </label>
                    <button onClick={openBoq} title="Bill of Quantities — line items by discipline, disclosed margin, safety factors (save as PDF)" className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"><ClipboardList className="h-3.5 w-3.5" />Bill of Quantities (BOQ)</button>
                    <button onClick={openPmDossier} title="Delivery Governance — document playbooks, decision bands scaled to this CAPEX, live risk/issue log, PM framework (save as PDF)" className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"><ShieldCheck className="h-3.5 w-3.5" />Delivery Governance</button>
                    <button onClick={exportPdf} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-rz-mint"><FileDown className="h-3.5 w-3.5" />{busy ? '…' : 'Export'}</button>
                    <button onClick={() => setActiveTab('commissioning')} className="inline-flex items-center gap-1 rounded-lg bg-rz-signal px-3 py-1.5 text-xs font-semibold text-rz-base hover:bg-rz-signal/90">Next: Commissioning <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {planMode && (
                <div className="rounded-xl border border-rz-mint/40 bg-rz-signal/10 px-3 py-2 text-[11px] text-rz-mint">
                    <b>Plan Mode</b> — showing the baseline plan; no site actuals entered. SPI/CPI = 1.00 by definition. Set a status month + phase actuals to start tracking.
                </div>
            )}

            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {[
                    /* audit #8: `baselineChip` marks KPIs that are DEFINITIONAL in Plan Mode
                     * (EV≡PV → 100% progress, AC≡PV → 100% spend, SPI/CPI≡1.00) — a grey chip
                     * keeps the perfect-looking figures honest. Presentation only, no math change. */
                    { label: 'Overall Progress', value: `${e.overallPct}%`, sub: planMode ? 'baseline' : `PV ${e.pvPct}%`, trace: 'constr.progressPct', baselineChip: planMode, score: e.overallPct, tip: 'Percent complete = Earned Value ÷ Budget at Completion (standard EVM). In Plan Mode (no actuals entered) EV ≡ PV, so this shows the baseline plan percentage — set a status month and per-phase actual % to make it a measured figure. Moves with real site progress entered in the tracking panel.' },
                    { label: 'Planned Completion', value: `M${sched.totalMonths}`, sub: `${Math.round(sched.totalMonths / 12 * 10) / 10} years`, tip: 'Baseline construction duration in months from NTP (M0), from the engine CPM schedule derived from the CAPEX timeline (L2 phase detail). Long-lead equipment — transformers, gensets, switchgear — usually sets the critical path, so procurement dates matter more than site pace.' },
                    { label: 'Forecast Completion', value: `M${e.forecastTotalMonths}`, sub: e.delayMonths > 0 ? `+${e.delayMonths} mo delay` : 'on plan', trace: 'constr.forecastMonths', tip: 'Schedule-performance-adjusted finish month: planned duration stretched by the current SPI. SPI below 1.0 pushes this out and shows as "+N mo delay". Only meaningful once actuals are entered — in Plan Mode it equals the planned completion by definition.' },
                    { label: 'Budget (Cumulative)', value: fmtMoney(budget), sub: `AC ${fmtMoney(e.acUsd)} (${budget > 0 ? Math.round((e.acUsd / budget) * 100) : 0}%)`, trace: 'capex.total', baselineChip: planMode, explain: 'total-capex', tip: 'Budget at Completion = the total CAPEX from the CAPEX engine — the cost baseline CPI measures performance against. AC is the actual cost spent to date (user-entered); the percentage is spend against budget. Re-running CAPEX with different inputs re-baselines this figure.' },
                    { label: 'SPI', value: String(e.spi), sub: planMode ? 'baseline' : e.spi >= 1 ? 'on/ahead' : 'behind', trace: 'constr.spi', baselineChip: planMode, explain: 'spi', red: spiDiag, score: e.spi, scoreMax: 1.2, tip: 'Schedule Performance Index = EV ÷ PV. 1.0 = on plan, below 1.0 = behind schedule, above = ahead. In Plan Mode it is 1.00 by definition. Sustained SPI under ~0.9 usually warrants acceleration measures or a formal re-baseline — it also drives the forecast completion above.' },
                    { label: 'CPI', value: String(e.cpi), sub: planMode ? 'baseline' : e.cpi >= 1 ? 'under budget' : 'over budget', trace: 'constr.cpi', baselineChip: planMode, explain: 'cpi', red: cpiDiag, score: e.cpi, scoreMax: 1.2, tip: 'Cost Performance Index = EV ÷ AC. 1.0 = on budget; below 1.0 means each dollar spent is earning less than a dollar of planned work (over budget). In Plan Mode it is 1.00 by definition. Industry experience: CPI rarely recovers once it drops below ~0.9 — act early.' },
                ].map((k) => (
                    <div key={k.label} title={`${k.label}: ${k.value}${(k as {sub?: string}).sub ? " — " + (k as {sub?: string}).sub : ""}${(k as { baselineChip?: boolean }).baselineChip ? ' — Plan Mode: definitional baseline values, no actuals yet' : ''}`} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label} {(k as { tip?: string }).tip && <InfoTip content={(k as { tip?: string }).tip!} />}{(k as { explain?: string }).explain && <Explain k={(k as { explain?: string }).explain!} />}</div>
                        {(k as { trace?: string }).trace ? (
                            (k as { red?: Diagnosis | null }).red ? (
                                <TraceValue traceId={(k as { trace?: string }).trace!}>
                                    <RedValue className="text-lg font-bold tabular-nums" diagnosis={(k as { red?: Diagnosis | null }).red!}>{k.value}</RedValue>
                                </TraceValue>
                            ) : (k as { score?: number }).score != null ? (
                                /* Workstream M — ScoreValue: gradient color + ƒx trace on the non-red path */
                                <ScoreValue value={(k as { score?: number }).score!} max={(k as { scoreMax?: number }).scoreMax ?? 100}
                                    display={k.value} traceId={(k as { trace?: string }).trace!} className="text-lg" />
                            ) : (
                                <TraceValue traceId={(k as { trace?: string }).trace!}>
                                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                </TraceValue>
                            )
                        ) : (
                            <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                        )}
                        <div className="truncate text-[10px] text-slate-500">{k.sub}</div>
                        {(k as { baselineChip?: boolean }).baselineChip && (
                            <span className="mt-1 inline-block rounded bg-slate-400/15 px-1 py-0.5 text-[8px] font-semibold leading-tight text-slate-500">Plan Mode — baseline (no actuals yet)</span>
                        )}
                    </div>
                ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
                <div className="min-w-0 space-y-4">
                    {/* master schedule */}
                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Master Construction Schedule <InfoTip content="Baseline construction plan from the engine CPM (Critical Path Method) schedule, expanded to L2 phase detail from the CAPEX timeline. Each bar spans a phase's start-to-end months; enter an actual % per phase to track earned value. Red bars are phases running behind plan." /> <span className="ml-1 text-[9px] normal-case text-slate-400">engine CPM · L2 detail from CAPEX timeline</span></h2>
                        <div className="mb-3 space-y-1">
                            {sched.rows.map((r) => {
                                const pctVal: ComboValue<number> | null = t.phaseActualPct[r.key] == null ? null : { value: t.phaseActualPct[r.key]!, isCustom: true };
                                const behind = e.behindKeys.includes(r.key);
                                return (
                                    <div key={r.key} className="flex items-center gap-2 text-[11px]">
                                        <span className="w-32 truncate text-slate-600 dark:text-slate-300">{r.label}</span>
                                        <div className="relative h-3 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                                            <div className={`absolute h-3 rounded ${behind ? 'bg-rose-500/70' : 'bg-rz-mint/70'}`}
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
                        {results.timeline && <GanttChart tree={wbsTree ?? undefined} phases={results.timeline.phases} subPhases={results.timeline.subPhases} totalMonths={results.timeline.totalMonths} />}
                    </div>

                    {/* S-curve + manpower */}
                    <div className="grid gap-4 xl:grid-cols-2">
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Progress S-Curve (PV{planMode ? '' : ' vs EV'}) <InfoTip content="Cumulative planned progress (Planned Value %) across the build — an S-shaped curve: slow at mobilization, fast mid-build, tapering at commissioning. Once actuals are entered, the Earned Value point plots against it to show whether the project is ahead of or behind plan." /></h2>
                            <div className="h-44">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={curve}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                        <XAxis dataKey="month" tick={{ fontSize: 9 }} unit="mo" />
                                        <YAxis tick={{ fontSize: 9 }} unit="%" domain={[0, 100]} />
                                        <Tooltip contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                        <Area dataKey="pvPct" name="Planned %" stroke="#7DDDB4" fill="#7DDDB4" fillOpacity={0.15} />
                                        {!planMode && t.statusMonth != null && (
                                            <Line data={[{ month: t.statusMonth, ev: e.evPct }]} dataKey="ev" name="Actual (EV) %" stroke="#34d399" dot={{ r: 5 }} />
                                        )}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Manpower Plan <InfoTip content="Planned site head-count (crew) over the build, peaking mid-construction. A screening estimate shaped from the peak-crew figure below — not a fully resourced staffing plan. Drives labor logistics, site welfare and safety sizing." /> <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-semibold text-amber-500">SCREENING MODEL</span></h2>
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
                                <span className="inline-flex items-center gap-1">Peak crew: <InfoTip content="Maximum number of workers on site at the busiest point of construction (persons). Sets the height and shape of the manpower curve — larger builds and compressed schedules need higher peaks." /></span>
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
                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Procurement & Delivery <InfoTip content="Long-lead equipment order tracker. The engine back-calculates the latest PO date needed to meet the power-on milestone from each item's lead time. Items flagged 'Order now' are on the critical path and risk delaying energization if not ordered." /> <span className="ml-1 text-[9px] normal-case text-slate-400">engine long-lead data · 2024-26 supply-constrained market · vendors = examples</span></h2>
                        <table className="w-full text-[11px]">
                            <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">Item <InfoTip content="Long-lead equipment package (e.g. transformers, gensets, switchgear, chillers) whose delivery can gate the schedule." /></th><th className="text-left">Vendor <InfoTip content="Illustrative example supplier — not a procurement recommendation." /></th><th className="text-right">Lead <InfoTip content="Procurement lead time in months from purchase order to on-site delivery." /></th><th className="text-right">PO by <InfoTip content="Latest month (from NTP, M0) to place the purchase order so the item arrives before it is needed on the critical path." /></th><th className="text-right">ETA <InfoTip content="Expected on-site delivery month, counted from NTP (M0)." /></th><th className="text-right">Status <InfoTip content="'Order now' = critical, the PO date has passed or is imminent and the item threatens the power-on date; 'In window' = still enough lead time." /></th></tr></thead>
                            <tbody>
                                {proc.rows.map((r) => (
                                    <tr key={r.item} className="border-b border-slate-100 dark:border-slate-800/60">
                                        <td className="py-1 capitalize text-slate-700 dark:text-slate-200">{r.item}</td>
                                        <td className="text-slate-400">{r.vendorExample}</td>
                                        <td className="text-right tabular-nums text-slate-500">{r.leadMonths} mo</td>
                                        <td className="text-right tabular-nums text-slate-500">M{r.poMonth}</td>
                                        <td className="text-right tabular-nums text-slate-500">M{r.etaMonth}</td>
                                        <td className="text-right"><span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${r.critical ? 'bg-rose-500/15 text-rose-500' : 'bg-rz-data/15 text-rz-data'}`}>{r.critical ? 'Order now' : 'In window'}</span></td>
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
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 text-center">
                            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Health Score <InfoTip content="Composite construction health 0-100: SPI contributes 40 pts, CPI 30, schedule position 15, open issues 15. ≥85 = healthy, 65-84 = watch, <65 = intervene. In Plan Mode SPI/CPI are definitional 1.00, so the score only becomes meaningful once site actuals are entered." /></h3>
                            {/* Workstream M — ScoreValue: continuous gradient color (no trace node exists; label InfoTip explains) */}
                            <div><ScoreValue value={health.score} unit="/100" className="text-3xl" /></div>
                            <div className="text-[10px] text-slate-500">{health.band} · SPI 40 + CPI 30 + schedule 15 + issues 15</div>
                            {planMode && (
                                <span className="mt-1 inline-block rounded bg-slate-400/15 px-1 py-0.5 text-[8px] font-semibold text-slate-500">Plan Mode — baseline (no actuals yet)</span>
                            )}
                        </div>
                    )}
                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Milestones (engine) <InfoTip content="Key schedule dates from the engine CPM, in months from NTP (M0) — e.g. power-on/energization, topping-out, handover. Final handover reflects the SPI-adjusted forecast completion." /></h3>
                        <div className="space-y-1 text-[11px]">
                            {Object.entries(sched.milestones).map(([k, v]) => (
                                <div key={k} className="flex justify-between"><span className="capitalize text-slate-600 dark:text-slate-300">{k.replace(/([A-Z])/g, ' $1')}</span><span className="tabular-nums text-slate-500">M{(v as number).toFixed(1)}</span></div>
                            ))}
                            <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1 font-semibold"><span className="text-slate-700 dark:text-slate-200">Final handover</span><span className="tabular-nums text-rz-mint">M{e.forecastTotalMonths}</span></div>
                        </div>
                    </div>
                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Risks (Top) <InfoTip content="Top construction risks (potential future events) from the tracking store, each ranked by impact severity and probability. Items marked EXAMPLE are illustrative placeholders — replace with project-specific risks." /></h3>
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
                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Issues ({openIssues} open) <InfoTip content="Open construction issues — problems already occurring (vs risks, which are potential) — from the tracking store, with status and owner. EXAMPLE items are placeholders." /></h3>
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
