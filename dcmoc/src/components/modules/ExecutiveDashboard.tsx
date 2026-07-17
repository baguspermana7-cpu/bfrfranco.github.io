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
import { useDashboardData } from '@/components/dashboard/useDashboardData';
import { DashTopBar } from '@/components/dashboard/DashTopBar';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { LifecycleStrip } from '@/components/dashboard/LifecycleStrip';
import { ProjectSummary } from '@/components/dashboard/ProjectSummary';
import { CapacityArchOverview } from '@/components/dashboard/CapacityArchOverview';
import { FinancialSnapshot } from '@/components/dashboard/FinancialSnapshot';
import { ScenarioComparison } from '@/components/dashboard/ScenarioComparison';
import { decide, type DecisionContext, type DecisionResult } from '@/lib/decision';
import { Cpu, Server, Building, Repeat, Gauge, TrendingUp, CircleDot, ArrowRight, Sparkles } from 'lucide-react';

type TabId = ReturnType<typeof useSimulationStore.getState>['activeTab'];

const fmtUsd = (n: number | null) => n == null ? '—' : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`;

export function ExecutiveDashboard() {
    const { actions } = useSimulationStore();
    const capexResults = useCapexStore((s) => s.results);
    const runCapex = useCapexStore((s) => s.runCalculation);
    // Populate the roll-up with real CAPEX on first view.
    React.useEffect(() => { if (!capexResults) runCapex(); }, [capexResults, runCapex]);
    const d = useDashboardData();
    const [tab, setTab] = React.useState('Executive Overview');
    const go = (t?: string) => { if (t) actions.setActiveTab(t as TabId); };

    // real sparkline series
    const cf = d.financial?.cashflows ?? [];
    const opexSeries = cf.map((c) => c.opex);
    const ebitdaSeries = cf.map((c) => c.ebitda);
    const fcfSeries = cf.map((c) => c.cumulativeCashflow);
    const capacitySeries = (d.itLoadMw ? (useSimulationStore.getState().inputs.occupancyRamp || []) : []).map((o) => o * d.itLoadMw);

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
    }, [d]);

    return (
        <div className="space-y-4 dark:text-slate-100">
            <DashTopBar project={`${d.country} DC Campus — ${d.itLoadMw.toFixed(0)}MW`} activeTab={tab} onTab={setTab} />

            {/* Row 1 — KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
                <KpiCard label="Project Capacity" value={`${d.itLoadMw.toFixed(0)} MW`} sub={`${d.itLoadKw.toLocaleString()} kW IT`} icon={Cpu} accent="cyan" series={capacitySeries} />
                <KpiCard label="Tier Design" value={`Tier ${d.tier}`} sub={d.availabilityTarget ? `Target ${d.availabilityTarget}%` : d.redundancy} icon={Server} accent="violet" />
                <KpiCard label="Total CAPEX" value={fmtUsd(d.capexTotal)} sub={d.perKw ? `${fmtUsd(d.perKw)}/kW` : 'Open CAPEX'} icon={Building} accent="emerald" onClick={() => go('capex')} />
                <KpiCard label="Total OPEX / yr" value={fmtUsd(d.opexAnnual)} sub="engine-modelled" icon={Repeat} accent="blue" series={opexSeries} />
                <KpiCard label="EBITDA (Yr 5)" value={fmtUsd(d.ebitda)} sub={d.financialIllustrative ? 'illustrative revenue' : ''} icon={Gauge} accent="amber" series={ebitdaSeries} />
                <KpiCard label="IRR" value={d.financial ? `${d.financial.irr.toFixed(1)}%` : '—'} sub={d.financial ? `Payback ${d.financial.paybackPeriodYears.toFixed(1)} yr` : 'Open Financial'} icon={TrendingUp} accent="emerald" series={fcfSeries} onClick={() => go('finance')} />
                <KpiCard label="Project Status" value="Design" sub="Planning phase" icon={CircleDot} accent="cyan" />
            </div>

            {/* Row 2 — Lifecycle strip */}
            <LifecycleStrip onOpen={go} />

            {/* Row 3 — project summary · capacity+financial · scenarios */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <ProjectSummary d={d} />
                <div className="space-y-3">
                    <CapacityArchOverview d={d} />
                    <FinancialSnapshot costs={d.capexCosts} total={d.capexTotal} />
                </div>
                <ScenarioComparison d={d} />
            </div>

            {/* AI Recommendations (Layer 13) — interim; full panel grid lands in P3 */}
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">AI Recommendations</h2>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-400">Layer 13 · deterministic</span>
                </div>
                {ai ? (
                    <>
                        <p className="text-sm text-slate-700 dark:text-slate-200 mb-2">{ai.summary}</p>
                        <div className="space-y-1.5">
                            {ai.recommendations.slice(0, 4).map((r, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs">
                                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                                    <span><span className="font-semibold text-slate-800 dark:text-slate-100">{r.title}</span><span className="text-slate-500 dark:text-slate-400"> — {r.detail}</span>
                                        <span className="ml-1 text-[10px] text-emerald-500">({Math.round(r.confidence * 100)}%)</span></span>
                                </div>
                            ))}
                            {ai.recommendations.length === 0 && <p className="text-xs text-slate-500">No constraint flags — configuration within typical envelopes.</p>}
                        </div>
                        <p className="mt-2 text-[10px] text-slate-500 border-t border-white/10 pt-2">{ai.disclaimer}</p>
                    </>
                ) : <p className="text-xs text-slate-500">Computing…</p>}
            </div>
        </div>
    );
}

export default ExecutiveDashboard;
