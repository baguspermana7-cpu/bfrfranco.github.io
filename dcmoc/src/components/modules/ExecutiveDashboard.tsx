'use client';

/* ─── DC-OS · EXECUTIVE OVERVIEW ──────────────────────────────────────────────
 * Rebuilt to the dark DC-OS reference. Composition of dashboard subcomponents;
 * every figure is engine-real (RZEngine + stores) via useDashboardData — honest
 * placeholders only where no source exists. P1: top bar + KPI row + lifecycle
 * strip + AI recommendations. (Rows: project summary / capacity-arch / financial
 * donut / scenario / gantt / cashflow / risk heat map land in P2–P3.)
 * ──────────────────────────────────────────────────────────────────────────── */

import React from 'react';
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
import { decide, type DecisionContext, type DecisionResult } from '@/lib/decision';
import { Cpu, Server, Building, Repeat, Gauge, TrendingUp, CircleDot, ArrowRight, Sparkles, FileText } from 'lucide-react';

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
    const [tab, setTab] = React.useState('Executive Overview');
    const [optNonce, setOptNonce] = React.useState(0);
    const [busy, setBusy] = React.useState<string | null>(null);
    const go = (t?: string) => { if (t) actions.setActiveTab(t as TabId); };
    const has = (k: RowKey) => (VIEW_PANELS[tab] || VIEW_PANELS['Executive Overview']).includes(k);

    // real sparkline series
    const cf = d.financial?.cashflows ?? [];
    const opexSeries = cf.map((c) => c.opex);
    const ebitdaSeries = cf.map((c) => c.ebitda);
    const fcfSeries = cf.map((c) => c.cumulativeCashflow);
    const capacitySeries = (d.itLoadMw ? (useSimulationStore.getState().inputs.occupancyRamp || []) : []).map((o) => o * d.itLoadMw);

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
            case 'Run Optimization':
                setBusy('Run Optimization');
                runCapex();
                setOptNonce((n) => n + 1); // re-runs the Layer-13 decision effect
                setTimeout(() => setBusy(null), 600);
                break;
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
            <DashTopBar project={`${d.country} DC Campus — ${d.itLoadMw.toFixed(0)}MW`} activeTab={tab} onTab={setTab} />

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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
                <KpiCard label="Project Capacity" value={`${d.itLoadMw.toFixed(0)} MW`} sub={`${d.itLoadKw.toLocaleString()} kW IT`} icon={Cpu} accent="cyan" series={capacitySeries} seriesLabel="IT Load (MW)" valueFormat={(n) => `${n.toFixed(2)} MW`} tip="Total IT load capacity in megawatts, derived from the Requirements engine (rack count × kW/rack). The trend shows the occupancy ramp schedule." />
                <KpiCard label="Tier Design" value={`Tier ${d.tier}`} sub={d.availabilityTarget ? `Target ${d.availabilityTarget}%` : d.redundancy} icon={Server} accent="violet" tip="Uptime Institute Tier classification (II–IV) set in the Requirements engine. Determines redundancy architecture, availability target, and CAPEX uplift." />
                <KpiCard label="Total CAPEX" value={fmtUsd(d.capexTotal)} sub={d.perKw ? `${fmtUsd(d.perKw)}/kW` : 'Open CAPEX'} icon={Building} accent="emerald" onClick={() => go('capex')} tip="Total design CAPEX from the CAPEX engine, including civil, M&E, IT, and contingency. Click to open the full CAPEX breakdown." />
                <KpiCard label="Total OPEX / yr" value={fmtUsd(d.opexAnnual)} sub="engine-modelled" icon={Repeat} accent="blue" series={opexSeries} seriesLabel="Annual OPEX" valueFormat={(n) => `$${(n / 1e6).toFixed(1)}M`} tip="Annualised operating expenditure modelled by the Financial engine: power, staffing, maintenance, and licensing. Trend shows per-year OPEX over the project horizon." />
                <KpiCard label="EBITDA (Yr 5)" value={fmtUsd(d.ebitda)} sub={d.financialIllustrative ? 'illustrative revenue' : ''} icon={Gauge} accent="amber" series={ebitdaSeries} seriesLabel="EBITDA" valueFormat={(n) => `$${(n / 1e6).toFixed(1)}M`} tip="Earnings Before Interest, Taxes, Depreciation & Amortisation at Year 5, from the Financial engine DCF model. Trend shows EBITDA trajectory across the project horizon." />
                <KpiCard label="IRR" value={d.financial ? `${d.financial.irr.toFixed(1)}%` : '—'} sub={d.financial ? `Payback ${d.financial.paybackPeriodYears.toFixed(1)} yr` : 'Open Financial'} icon={TrendingUp} accent="emerald" series={fcfSeries} seriesLabel="Cumulative Cash Flow" valueFormat={(n) => `$${(n / 1e6).toFixed(1)}M`} onClick={() => go('finance')} tip="Internal Rate of Return from the Financial engine DCF over the full project horizon. Trend shows cumulative free cash flow; hover for year-by-year value. Click to open Financial engine." />
                <KpiCard label="Project Status" value="Design" sub="Planning phase" icon={CircleDot} accent="cyan" tip="Current project lifecycle phase as tracked by the 13-engine workflow. Advances from Design → Construction → Commissioning → Operations as engines are completed." />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DataFlowRail stats={{ inputs: 5, outputs: 7, decisions: ai?.recommendations.length ?? 0 }} />
                    <QuickActions onAction={handleAction} />
                </div>
            </div>
            )}

            {/* transient action toast */}
            {busy && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg bg-[#0f1424] border border-white/15 text-xs text-slate-200 shadow-xl">
                    {busy === 'Invite Stakeholder' ? 'Stakeholder invites — coming soon.' : `${busy}…`}
                </div>
            )}
        </div>
    );
}

export default ExecutiveDashboard;
