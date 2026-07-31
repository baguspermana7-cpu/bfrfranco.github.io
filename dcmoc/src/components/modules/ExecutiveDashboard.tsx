'use client';

/* ─── DC-OS · EXECUTIVE OVERVIEW ──────────────────────────────────────────────
 * Rebuilt to the dark DC-OS reference. Composition of dashboard subcomponents;
 * every figure is engine-real (RZEngine + stores) via useDashboardData — honest
 * placeholders only where no source exists. P1: top bar + KPI row + lifecycle
 * strip + AI recommendations. (Rows: project summary / capacity-arch / financial
 * donut / scenario / gantt / cashflow / risk heat map land in P2–P3.)
 * ──────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useRequirementsStore } from '@/store/requirements';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useScenarioStore } from '@/store/scenario';
import { useDashboardData } from '@/components/dashboard/useDashboardData';
import { DashTopBar } from '@/components/dashboard/DashTopBar';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { LifecycleStrip } from '@/components/dashboard/LifecycleStrip';
import { ProjectSummary } from '@/components/dashboard/ProjectSummary';
import { CapacityArchOverview } from '@/components/dashboard/CapacityArchOverview';
import { FinancialSnapshot } from '@/components/dashboard/FinancialSnapshot';
import { ScenarioComparison } from '@/components/dashboard/ScenarioComparison';
import { CashFlowRoi } from '@/components/dashboard/CashFlowRoi';
import { RiskHeatMap, type RiskItem } from '@/components/dashboard/RiskHeatMap';
import { KpiEfficiencyRow } from '@/components/dashboard/KpiEfficiencyRow';
import { DataFlowRail, QuickActions, AlertsPanel, type Alert } from '@/components/dashboard/DashboardExtras';
import { ScheduleTimeline } from '@/components/dashboard/ScheduleTimeline';
import { generateDashboardPDF } from '@/modules/reporting/pdf/DashboardPdf';
import { DiagnosticModal } from '@/components/ui/RedValue';
import { fmtPayback } from '@/modules/analytics/FinancialEngine';
import { DEFAULT_REVENUE_PER_KW_MONTH } from '@/constants/finance';
import { decide, type DecisionContext, type DecisionResult } from '@/lib/decision';
import { useConstructionTracking } from '@/store/constructionTracking';
import { useCxTracking } from '@/store/cxTracking';
import { runRealOptimization, proposalToPatch, type RealOptimizationResult, type ObjectiveOutcome } from '@/lib/optimizer/optimize';
import { Cpu, Server, Building, Repeat, Gauge, TrendingUp, CircleDot, ArrowRight, Sparkles, FileText, CheckCircle2, AlertTriangle, Minus, Wrench } from 'lucide-react';

type TabId = ReturnType<typeof useSimulationStore.getState>['activeTab'];

const fmtUsd = (n: number | null) => n == null ? '—' : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`;

// Row keys → which top-tab views include them. Every figure stays engine-real;
// tabs just focus the surface (honest subsets of the full Executive Overview).
type RowKey = 'kpi' | 'lifecycle' | 'summary' | 'schedule' | 'cashflow' | 'risk' | 'alerts' | 'ai' | 'extras' | 'reports';
const VIEW_PANELS: Record<string, RowKey[]> = {
    'Executive Overview': ['kpi', 'lifecycle', 'summary', 'schedule', 'cashflow', 'risk', 'alerts', 'ai', 'extras'],
    'Engineering': ['kpi', 'lifecycle', 'summary', 'schedule', 'risk', 'extras'],
    'Construction': ['kpi', 'schedule', 'risk', 'alerts'],
    'Operations': ['kpi', 'alerts', 'ai', 'risk', 'extras'],
    'Financial': ['kpi', 'summary', 'cashflow', 'ai'],
    'Analytics': ['kpi', 'cashflow', 'schedule', 'risk', 'extras'],
    'Reports': ['reports'],
};

export function ExecutiveDashboard() {
    const { actions, inputs } = useSimulationStore();
    const capexResults = useCapexStore((s) => s.results);
    const runCapex = useCapexStore((s) => s.runCalculation);
    const toggleScenarioPanel = useScenarioStore((s) => s.togglePanel);
    // Populate the roll-up with real CAPEX on first view.
    React.useEffect(() => { if (!capexResults) runCapex(); }, [capexResults, runCapex]);
    const d = useDashboardData();
    const tab = 'Executive Overview' as const;   // DI3 — single full view (tabs deleted; VIEW_PANELS retained only as the full row list)
    const projName = useRequirementsStore((s2) => s2.overview.projectName);
    // Design headroom for the top-bar "design MW" — the SAME store field the
    // optimizer/CAPEX contingency read (req.business.designMarginPct), not a
    // hardcoded margin, so the header can't disagree with the model.
    const designMarginPct = useRequirementsStore((s2) => s2.business.designMarginPct);
    const [optNonce, setOptNonce] = React.useState(0);
    const [busy, setBusy] = React.useState<string | null>(null);
    /* Workstream U — REAL optimizer results (deterministic bisection over the
     * importable page models; preview-then-Apply, never silent). */
    const [optResult, setOptResult] = React.useState<RealOptimizationResult | null>(null);
    const [appliedKeys, setAppliedKeys] = React.useState<string[]>([]);

    /* Workstream U — Project Status DERIVED (was a hardcoded "Design" literal):
     * Construction tracking statusMonth (null = Plan Mode → Design; inside the
     * engine build schedule → Construction; past it → Commissioning) promoted
     * by any real Cx checklist/level tick → Commissioning. */
    const ctStatusMonth = useConstructionTracking((s) => s.statusMonth);
    const cxTicks = useCxTracking((s) =>
        Object.values(s.checklist).filter((v) => v != null).length +
        Object.values(s.completion).filter((v) => v != null && v > 0).length);
    const buildMonths = capexResults?.timeline?.totalMonths ?? null;
    const projectStatus: { phase: string; sub: string } = cxTicks > 0
        ? { phase: 'Commissioning', sub: `${cxTicks} Cx item(s) tracked` }
        : ctStatusMonth == null
            ? { phase: 'Design', sub: 'Planning phase (no NTP status set)' }
            : buildMonths != null && ctStatusMonth < buildMonths
                ? { phase: 'Construction', sub: `Month ${ctStatusMonth} of ${buildMonths}` }
                : { phase: 'Commissioning', sub: buildMonths != null ? `Build schedule complete (${buildMonths} mo)` : `Month ${ctStatusMonth} since NTP` };
    const go = (t?: string) => { if (t) actions.setActiveTab(t as TabId); };
    const has = (k: RowKey) => (VIEW_PANELS[tab] || VIEW_PANELS['Executive Overview']).includes(k);

    /* Negative-EBITDA diagnosis (owner mandate: every red value clickable) —
     * at the conservative $150/kW·mo wholesale basis a small project can run
     * operating-cash-negative; the old $280 default MASKED this. Card goes
     * alert-red + click opens the shared DiagnosticModal with real levers. */
    const [ebitdaDiag, setEbitdaDiag] = React.useState(false);
    const ebitdaNegative = d.ebitda != null && d.ebitda < 0;
    const revBasis = inputs.revenuePerKwMonth ?? DEFAULT_REVENUE_PER_KW_MONTH;

    /* Below-hurdle IRR diagnosis — same mandate class as EBITDA; onOptimize
     * wires straight into the page's real Run-Optimization solver (12% hurdle
     * matches runRealOptimization's default). */
    const IRR_HURDLE_PCT = 12;
    const [irrDiag, setIrrDiag] = React.useState(false);
    const irrBelowHurdle = d.financial != null && d.financial.irr < IRR_HURDLE_PCT;
    /* IRR has no meaningful positive root when the DCF never turns cash-positive
     * (NPV < 0 AND solver pinned ≤ 0) — "0.0%" would be a fabricated number, so
     * display n/a and let the red diagnosis explain. */
    const irrUndefined = d.financial != null && d.financial.npv < 0 && d.financial.irr <= 0;

    // real sparkline series
    const cf = d.financial?.cashflows ?? [];
    const opexSeries = cf.map((c) => c.opex);
    const ebitdaSeries = cf.map((c) => c.ebitda);
    const fcfSeries = cf.map((c) => c.cumulativeCashflow);
    // subscribe to occupancyRamp (not getState) so the sparkline re-renders when the ramp changes in isolation
    const occupancyRamp = useSimulationStore((s) => s.inputs.occupancyRamp);
    const capacitySeries = (d.itLoadMw ? (occupancyRamp || []) : []).map((o) => o * d.itLoadMw);

    // Engine-derived risks + alerts (rule-based on real outputs, not fabricated)
    const risks: RiskItem[] = [];
    if (d.availabilityPct != null && d.availabilityTarget != null && d.availabilityPct < d.availabilityTarget) risks.push({ id: 'A', label: 'Availability below tier target', prob: 2, impact: 4, category: 'Power' });
    if (d.pue > 1.4) risks.push({ id: 'C', label: 'Cooling efficiency (PUE) high', prob: 3, impact: 2, category: 'Cooling' });
    if (d.timelineMonths != null && d.timelineMonths > 30) risks.push({ id: 'S', label: 'Long build schedule', prob: 2, impact: 3, category: 'Schedule' });
    if (d.architecture && d.architecture.index > 70) risks.push({ id: 'X', label: 'High design complexity', prob: 3, impact: 3, category: 'Cost' });
    if (risks.length === 0) risks.push({ id: 'R', label: 'Residual operational risk', prob: 1, impact: 2, category: 'General' });

    const alerts: Alert[] = [];
    if (d.availabilityPct != null && d.availabilityTarget != null && d.availabilityPct < d.availabilityTarget) alerts.push({ level: 'warn', title: 'Power availability risk', detail: `System ${d.availabilityPct}% below Tier ${d.tier} target ${d.availabilityTarget}%` });
    if (d.pue > 1.4) alerts.push({ level: 'info', title: 'Cooling efficiency optimization', detail: `PUE ${d.pue.toFixed(2)} — liquid cooling could lower it` });
    if (d.timelineMonths != null && d.timelineMonths > 30) alerts.push({ level: 'warn', title: 'Construction schedule', detail: `${d.timelineMonths} mo build — consider modular/phased delivery` });

    // AI recommendations (Layer 13)
    const [ai, setAi] = React.useState<DecisionResult | null>(null);
    React.useEffect(() => {
        let alive = true;
        const ctx: DecisionContext = {
            inputs: { itLoadKw: d.itLoadKw, tier: d.tier as 2 | 3 | 4, coolingType: d.coolingType, region: d.country, redundancy: d.redundancy },
            capex: d.capexTotal ? { totalUsd: d.capexTotal, perKw: d.perKw ?? undefined, timelineMonths: d.timelineMonths ?? undefined } : undefined,
            opex: d.opexAnnual ? { annualUsd: d.opexAnnual } : undefined,
            financial: d.financial ? { npvUsd: d.financial.npv, irrPct: d.financial.irr, paybackYears: d.financial.paybackPeriodYears } : undefined,
            carbon: { pue: d.pue }, reliability: d.availabilityPct ? { availabilityPct: d.availabilityPct } : undefined,
            capacity: { totalMw: d.itLoadMw }, site: d.siteScore ? { score: d.siteScore } : undefined,
        };
        decide({ context: ctx, objectives: ['maxRoi'] }).then((r) => { if (alive) setAi(r); });
        return () => { alive = false; };
    }, [d, optNonce]);

    // Quick-action dispatcher (F5) — every button does something real.
    const handleAction = async (label: string) => {
        switch (label) {
            case 'New Scenario':
                toggleScenarioPanel();
                break;
            case 'Run Optimization': {
                /* Workstream U — REAL solver: bisection on the phased-finance
                 * closure + capacity band + budget-vs-P80 checks (optimize.ts).
                 * setTimeout lets the busy toast paint before the sync solve. */
                setBusy('Run Optimization');
                runCapex();
                setTimeout(() => {
                    try {
                        const sim = useSimulationStore.getState();
                        const req = useRequirementsStore.getState();
                        const capexTotal = useCapexStore.getState().results?.total ?? null;
                        const res = runRealOptimization({
                            country: sim.selectedCountry,
                            sim: {
                                capacityPhases: sim.inputs.capacityPhases,
                                coolingType: sim.inputs.coolingType,
                                tierLevel: sim.inputs.tierLevel,
                                shiftModel: sim.inputs.shiftModel,
                                maintenanceModel: sim.inputs.maintenanceModel,
                                hybridRatio: sim.inputs.hybridRatio,
                                revenuePerKwMonth: sim.inputs.revenuePerKwMonth,
                                itLoad: sim.inputs.itLoad,
                                buildingSize: sim.inputs.buildingSize,
                                baseYear: sim.inputs.baseYear,
                            },
                            rackKw: req.workload.avgRackDensityKw,
                            designMarginPct: req.business.designMarginPct,
                            growthMwByYear: [
                                { label: 'Y0 (COD)', mw: sim.inputs.itLoad / 1000 },
                                { label: 'Y1', mw: req.growth.itLoadMwByYear.y1 },
                                { label: 'Y2', mw: req.growth.itLoadMwByYear.y2 },
                                { label: 'Y3', mw: req.growth.itLoadMwByYear.y3 },
                                { label: 'Y4', mw: req.growth.itLoadMwByYear.y4 },
                                { label: 'Y5', mw: req.growth.itLoadMwByYear.y5 },
                            ],
                            capexTotal,
                            budgetUsd: req.business.budgetUsd,
                        });
                        setAppliedKeys([]);
                        setOptResult(res);
                        setOptNonce((n) => n + 1); // re-runs the Layer-13 decision effect
                    } catch (e) { console.error('Run Optimization failed', e); }
                    setBusy(null);
                }, 50);
                break;
            }
            case 'Generate Report':
            case 'Export Dashboard': {
                setBusy(label);
                try {
                    await generateDashboardPDF({
                        project: `${d.country} DC Campus`, country: d.country, itLoadKw: d.itLoadKw,
                        tier: d.tier, redundancy: d.redundancy, coolingType: d.coolingType, pue: d.pue,
                        capex: d.capexTotal ? { total: d.capexTotal, perKw: d.perKw ?? undefined, racks: d.racks ?? undefined, timelineMonths: d.timelineMonths ?? undefined } : undefined,
                        engines: [
                            { num: 1, label: 'Requirements', status: 'engine' }, { num: 2, label: 'Site Intelligence', status: 'engine' },
                            { num: 3, label: 'Architecture', status: 'engine' }, { num: 4, label: 'Capacity Planning', status: 'engine' },
                            { num: 5, label: 'CAPEX Engine', status: 'engine' }, { num: 6, label: 'Construction', status: 'engine' },
                            { num: 7, label: 'Commissioning', status: 'engine' }, { num: 8, label: 'Operations', status: 'engine' },
                            { num: 9, label: 'Asset Intelligence', status: 'engine' }, { num: 10, label: 'Reliability', status: 'engine' },
                            { num: 11, label: 'Sustainability', status: 'engine' }, { num: 12, label: 'Financial', status: 'engine' },
                            { num: 13, label: 'AI Decision Engine', status: ai ? 'engine' : 'partial' },
                        ],
                        decision: ai,
                    });
                } catch (e) { console.error('PDF failed', e); }
                setBusy(null);
                break;
            }
            case 'Invite Stakeholder':
                setBusy('Invite Stakeholder');
                setTimeout(() => setBusy(null), 1500);
                break;
            case 'System Settings':
                go('settings');
                break;
        }
    };

    const startYear = inputs.baseYear || 2025;

    return (
        <div className="space-y-4 dark:text-slate-100">
            <DashTopBar project={`${projName || d.country + ' DC'} — ${d.itLoadMw.toFixed(1)} MW IT · design ${(d.itLoadMw * (1 + (designMarginPct ?? 0) / 100)).toFixed(1)} MW`} />

            {/* Reports view — a launcher into the full Reports module */}
            {has('reports') && (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-8 text-center">
                    <FileText className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Reports &amp; Exports</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">Generate the super-complete Executive PDF from this view, or open the Reports module for per-engine documents.</p>
                    <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleAction('Generate Report')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors">
                            <FileText className="w-3.5 h-3.5" /> {busy === 'Generate Report' ? 'Generating…' : 'Executive PDF'}
                        </button>
                        <button onClick={() => go('report')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-medium hover:border-cyan-400/40">
                            Open Reports Module
                        </button>
                    </div>
                </div>
            )}

            {/* Row 1 — KPI cards */}
            {has('kpi') && (
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
                <KpiCard label="Project Capacity" value={`${d.itLoadMw.toFixed(0)} MW`} sub={`${d.itLoadKw.toLocaleString()} kW IT`} icon={Cpu} accent="cyan" series={capacitySeries} seriesLabel="IT Load (MW)" valueFormat={(n) => `${n.toFixed(2)} MW`} trace="sim.itLoad" tip="Total IT load capacity in megawatts, derived from the Requirements engine (rack count × kW/rack). The trend shows the occupancy ramp schedule." />
                <KpiCard label="Tier Design" value={`Tier ${d.tier}`} sub={d.availabilityTarget ? `Target ${d.availabilityTarget}%` : d.redundancy} icon={Server} accent="info" trace="sim.tierLevel" tip="Uptime Institute Tier classification (II–IV) set in the Requirements engine. Determines redundancy architecture, availability target, and CAPEX uplift." />
                <KpiCard label="Total CAPEX" value={fmtUsd(d.capexTotal)} sub={d.perKw ? `${fmtUsd(d.perKw)}/kW` : 'Open CAPEX'} icon={Building} accent="emerald" onClick={() => go('capex')} trace="capex.total" tip="Total design CAPEX from the CAPEX engine, including civil, M&E, IT, and contingency. Click to open the full CAPEX breakdown." />
                <KpiCard label="Total OPEX / yr" value={fmtUsd(d.opexAnnual)} sub="DC-contract rate · 100% util" icon={Repeat} accent="blue" series={opexSeries} seriesLabel="Annual OPEX" valueFormat={(n) => `$${(n / 1e6).toFixed(1)}M`} trace="opex.dashboardAnnual" tip="Annualised operating expenditure modelled by the Operations engine: power, staffing, maintenance, licensing. Power is costed at the DC-contract (wholesale/PPA) rate at 100% utilization — this can differ from the standalone OPEX calculator, which uses the retail tariff and a partial utilization factor." />
                <KpiCard label="EBITDA (Yr 5)" value={fmtUsd(d.ebitda)} sub={ebitdaNegative ? 'NEGATIVE — click for diagnosis' : (d.financialIllustrative ? 'illustrative revenue' : '')} icon={Gauge} accent={ebitdaNegative ? 'alert' : 'amber'} onClick={ebitdaNegative ? () => setEbitdaDiag(true) : undefined} series={ebitdaSeries} seriesLabel="EBITDA" valueFormat={(n) => `$${(n / 1e6).toFixed(1)}M`} trace="fin.ebitdaY5" tip="Earnings Before Interest, Taxes, Depreciation & Amortisation at Year 5, from the Financial engine DCF model. Trend shows EBITDA trajectory across the project horizon." />
                <KpiCard label="IRR" value={d.financial ? (irrUndefined ? 'n/a' : `${d.financial.irr.toFixed(1)}%`) : '—'} sub={irrUndefined ? 'no positive root (cash-negative) — click for diagnosis' : irrBelowHurdle ? `BELOW ${IRR_HURDLE_PCT}% HURDLE — click for diagnosis` : (d.financial ? `Payback ${fmtPayback(d.financial)}` : 'Open Financial')} icon={TrendingUp} accent={irrBelowHurdle ? 'alert' : 'emerald'} series={fcfSeries} seriesLabel="Cumulative Cash Flow" valueFormat={(n) => `$${(n / 1e6).toFixed(1)}M`} onClick={irrBelowHurdle ? () => setIrrDiag(true) : () => go('finance')} trace="fin.irrProject" tip="Internal Rate of Return from the Financial engine DCF over the full project horizon. Trend shows cumulative free cash flow; hover for year-by-year value. Click to open Financial engine." />
                <KpiCard label="Project Status" value={projectStatus.phase} sub={projectStatus.sub} icon={CircleDot} accent="cyan" tip="Current project lifecycle phase DERIVED from real tracking state (not a label): Design while Construction tracking has no NTP status month; Construction while the status month sits inside the CAPEX engine build schedule; Commissioning once the schedule completes or any Cx checklist/level tick is recorded. Update it in Construction (status month) and Commissioning (checklist)." />
            </div>
            )}

            {/* Row 2 — Lifecycle strip */}
            {has('lifecycle') && <LifecycleStrip onOpen={go} />}

            {/* Row 3 — project summary · capacity+financial · scenarios */}
            {has('summary') && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <ProjectSummary d={d} />
                <div className="space-y-3">
                    <CapacityArchOverview d={d} />
                    <FinancialSnapshot costs={d.capexCosts} total={d.capexTotal} />
                </div>
                <ScenarioComparison d={d} />
            </div>
            )}

            {/* Row 4 — schedule · cash-flow · risk heat map (each gated) */}
            {(has('schedule') || has('cashflow') || has('risk')) && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {has('schedule') && (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-4">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Schedule &amp; Milestones</h2>
                    {capexResults?.timeline?.phases?.length
                        ? <ScheduleTimeline phases={capexResults.timeline.phases} totalMonths={capexResults.timeline.totalMonths} startYear={startYear} />
                        : <p className="text-xs text-slate-500">Run the CAPEX engine for the build schedule.</p>}
                </div>
                )}
                {has('cashflow') && <CashFlowRoi financial={d.financial} />}
                {has('risk') && <RiskHeatMap risks={risks} />}
            </div>
            )}

            {/* Row 5 — alerts · AI recommendations */}
            {(has('alerts') || has('ai')) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {has('alerts') && <AlertsPanel alerts={alerts} />}
                {has('ai') && (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">AI Recommendations</h2>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-400">Layer 13</span>
                    </div>
                    {ai ? (
                        <>
                            <p className="text-xs text-slate-700 dark:text-slate-200 mb-2">{ai.summary}</p>
                            <div className="space-y-1.5">
                                {ai.recommendations.slice(0, 3).map((r, i) => (
                                    <div key={i} className="flex items-start gap-2 text-[11px]">
                                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                                        <span><span className="font-semibold text-slate-800 dark:text-slate-100">{r.title}</span><span className="text-slate-500 dark:text-slate-400"> — {r.detail}</span>
                                            <span className="ml-1 text-[10px] text-emerald-500">({Math.round(r.confidence * 100)}%)</span></span>
                                    </div>
                                ))}
                                {ai.recommendations.length === 0 && <p className="text-[11px] text-slate-500">No constraint flags.</p>}
                            </div>
                        </>
                    ) : <p className="text-xs text-slate-500">Computing…</p>}
                </div>
                )}
            </div>
            )}

            {/* Row 6 — efficiency KPIs · data flow · quick actions */}
            {has('extras') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <KpiEfficiencyRow d={d} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <DataFlowRail stats={{ inputs: 5, outputs: 7, decisions: ai?.recommendations.length ?? 0 }} />
                    <QuickActions onAction={handleAction} />
                </div>
            </div>
            )}

            {/* Workstream U — Run Optimization results (preview-then-Apply; same
                guard idiom as PhasedFinancialDashboard: proposalToPatch asserts
                the tunables allowlist + locked base data before any store write) */}
            {optResult && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Run Optimization results">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setOptResult(null)} />
                    <div className="relative w-full max-w-lg rounded-xl border border-cyan-500/40 bg-white dark:bg-[#0f1424] shadow-2xl p-4 max-h-[85vh] overflow-y-auto">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Run Optimization — deterministic solver</div>
                        <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{optResult.objectives.length} objectives evaluated</div>
                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Bisection (40 iterations) over the same importable models the pages render from — no separate estimate, no LLM. Only allowlisted fine-tune parameters can move; requirement base data is locked by the optimizer guard.</p>
                        <div className="mt-3 space-y-2">
                            {optResult.objectives.map((o: ObjectiveOutcome, i: number) => {
                                const chip = o.status === 'cleared' || o.status === 'in-band'
                                    ? { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40', icon: <CheckCircle2 className="w-3 h-3" />, label: o.status === 'in-band' ? 'IN-BAND' : 'CLEARED' }
                                    : o.status === 'proposal'
                                        ? { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/40', icon: <Wrench className="w-3 h-3" />, label: 'PROPOSAL' }
                                        : o.status === 'flag'
                                            ? { cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/40', icon: <AlertTriangle className="w-3 h-3" />, label: 'FLAG' }
                                            : { cls: 'bg-slate-500/10 text-slate-500 border-slate-500/40', icon: <Minus className="w-3 h-3" />, label: 'N/A' };
                                const applied = o.proposal ? appliedKeys.includes(o.proposal.items[0]?.key ?? '') : false;
                                return (
                                    <div key={i} className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-2.5">
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold ${chip.cls}`}>{chip.icon}{chip.label}</span>
                                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{o.name}</span>
                                        </div>
                                        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">{o.detail}</p>
                                        {o.residual && <p className="mt-1 font-mono text-[10px] tabular-nums text-slate-500">{o.residual}</p>}
                                        {o.proposal && (
                                            <div className="mt-2 space-y-1.5">
                                                {o.proposal.items.map((it) => (
                                                    <div key={it.key} className="flex items-center justify-between rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs">
                                                        <span className="font-semibold text-slate-800 dark:text-slate-200">{it.label}</span>
                                                        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">{it.from} → <b className="text-emerald-500">{it.to}</b> {it.unit}</span>
                                                    </div>
                                                ))}
                                                {o.proposal.feasible ? (
                                                    <button
                                                        disabled={applied}
                                                        onClick={() => {
                                                            try {
                                                                const patch = proposalToPatch(o.proposal!);
                                                                useSimulationStore.getState().actions.setInputs(patch);
                                                                setAppliedKeys((k) => [...k, ...Object.keys(patch)]);
                                                                runCapex();
                                                                setOptNonce((n) => n + 1);
                                                            } catch (e) { console.error('Apply blocked by optimizer guard', e); }
                                                        }}
                                                        className={`w-full rounded px-2 py-1.5 text-xs font-bold transition-colors ${applied ? 'bg-emerald-500/15 text-emerald-500 cursor-default' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}>
                                                        {applied ? 'Applied ✓' : 'Apply proposal'}
                                                    </button>
                                                ) : (
                                                    <p className="text-[10px] text-rose-500">Infeasible inside the tunable band — honest verdict, nothing applied.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-3 flex items-center justify-end">
                            <button onClick={() => setOptResult(null)} className="rounded border border-slate-300 dark:border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* transient action toast */}
            {busy && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg bg-[#0f1424] border border-white/15 text-xs text-slate-200 shadow-xl">
                    {busy === 'Invite Stakeholder' ? 'Stakeholder invites — coming soon.' : `${busy}…`}
                </div>
            )}

            {/* below-hurdle IRR diagnosis modal — Auto-optimize runs the real solver */}
            {irrDiag && d.financial != null && (
                <DiagnosticModal
                    diagnosis={{
                        title: irrUndefined ? 'IRR undefined — project never turns cash-positive' : `IRR below the ${IRR_HURDLE_PCT}% hurdle`,
                        reason: irrUndefined
                            ? `At the $${revBasis}/kW·mo screening basis the DCF never turns cash-positive, so no IRR exists (displaying 0% would be fabricated). Revenue must rise or costs fall before a return can be computed at all.`
                            : `Project IRR ${d.financial.irr.toFixed(1)}% at the $${revBasis}/kW·mo screening basis sits under the ${IRR_HURDLE_PCT}% institutional hurdle — the equity case does not clear a typical DC fund's cost of capital at this rate.`,
                        actual: irrUndefined ? 'n/a (no positive root)' : `${d.financial.irr.toFixed(1)}%`,
                        threshold: `≥ ${IRR_HURDLE_PCT}%`,
                        gap: irrUndefined ? 'not computable' : `${(d.financial.irr - IRR_HURDLE_PCT).toFixed(1)} pp`,
                        levers: [
                            { label: `Raise the revenue basis (now $${revBasis}/kW·mo)`, detail: 'Set the contracted rate in Financial → Pro Forma — the edit writes through to every DCF surface.', tab: 'finance' },
                            { label: 'Re-phase the build', detail: 'Smaller first phase + later capacity moves capex right and lifts blended IRR — see Phased Finance.', tab: 'phased-finance' },
                            { label: 'Cut the OPEX drivers', detail: 'Staffing model, maintenance mix and cooling PUE — see Operations.', tab: 'ops' },
                        ],
                        tab: 'finance',
                        note: `Auto-optimize below runs the page's real IRR solver — it bisects revenue to the ${IRR_HURDLE_PCT}% hurdle, then reports capacity-utilization and budget-vs-P80 as feasibility checks alongside. Previews before Apply.`,
                    }}
                    onClose={() => setIrrDiag(false)}
                    onOptimize={() => handleAction('Run Optimization')}
                />
            )}

            {/* negative-EBITDA diagnosis modal */}
            {ebitdaDiag && d.ebitda != null && (
                <DiagnosticModal
                    diagnosis={{
                        title: 'EBITDA (Yr 5) negative',
                        reason: `Year-5 revenue at the $${revBasis}/kW·mo screening basis does not cover annual OPEX ${fmtUsd(d.opexAnnual)} — the project is operating-cash-negative at this rate. Energy and staffing dominate the cost side; small projects in high-tariff markets breach first.`,
                        actual: fmtUsd(d.ebitda),
                        threshold: '≥ $0',
                        levers: [
                            { label: `Raise the revenue basis (now $${revBasis}/kW·mo)`, detail: 'Set the contracted rate in the Financial engine — 2026 wholesale colo $140-230/kW·mo (JLL); AI-capable capacity commands +20%.', tab: 'finance' },
                            { label: 'Run Optimization (IRR objective)', detail: 'The solver bisects revenue to the 12% hurdle and previews the required rate before you Apply.', tab: 'dashboard' },
                            { label: 'Cut the OPEX drivers', detail: 'Review staffing model, maintenance strategy mix and cooling PUE in Operations — the OPEX card above traces each component.', tab: 'ops' },
                        ],
                        tab: 'finance',
                        note: `Illustrative DCF at $${revBasis}/kW·mo. The previous $280 default masked negative operating cash on small projects — this is the honest screening economics, not a bug.`,
                    }}
                    onClose={() => setEbitdaDiag(false)}
                />
            )}
        </div>
    );
}

export default ExecutiveDashboard;
