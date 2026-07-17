'use client';

/* ─── DC-OS · EXECUTIVE OVERVIEW (Layer 14 / Layer 0 surface) ─────────────────
 * The landing dashboard. Shows the 13-engine lifecycle, the genuinely-computed
 * roll-up KPIs (CAPEX/PUE/capacity/timeline from the shared engine), and the
 * Layer-13 AI Decision read on the available context. HONESTY: values that are
 * not yet engine-wired are shown as "Open engine" prompts — never fabricated.
 * ──────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { getPUE } from '@/constants/pue';
import { decide, type DecisionContext, type DecisionResult } from '@/lib/decision';
import { generateDashboardPDF } from '@/modules/reporting/pdf/DashboardPdf';
import {
    LayoutDashboard, Building, Cpu, Gauge, Server, CalendarClock,
    ClipboardList, MapPin, Boxes, Layers, HardHat, CheckCircle2, Wrench,
    Activity, ShieldCheck, Leaf, TrendingUp, BrainCircuit, ArrowRight, Sparkles,
    FileDown,
} from 'lucide-react';

type TabId = ReturnType<typeof useSimulationStore.getState>['activeTab'];

const ENGINE_STRIP: { num: number; label: string; icon: React.ElementType; wired: 'engine' | 'partial' | 'local'; tab?: TabId }[] = [
    { num: 1, label: 'Requirements', icon: ClipboardList, wired: 'local', tab: 'sim' },
    { num: 2, label: 'Site Intel', icon: MapPin, wired: 'local', tab: 'disaster' },
    { num: 3, label: 'Architecture', icon: Boxes, wired: 'local', tab: 'capex' },
    { num: 4, label: 'Capacity', icon: Layers, wired: 'local', tab: 'capacity' },
    { num: 5, label: 'CAPEX', icon: Building, wired: 'partial', tab: 'capex' },
    { num: 6, label: 'Construction', icon: HardHat, wired: 'local', tab: 'phased-finance' },
    { num: 7, label: 'Commissioning', icon: CheckCircle2, wired: 'local' },
    { num: 8, label: 'Operations', icon: Wrench, wired: 'local', tab: 'staff' },
    { num: 9, label: 'Asset Intel', icon: Activity, wired: 'local', tab: 'asset-lifecycle' },
    { num: 10, label: 'Reliability', icon: ShieldCheck, wired: 'local', tab: 'risk' },
    { num: 11, label: 'Sustainability', icon: Leaf, wired: 'partial', tab: 'carbon' },
    { num: 12, label: 'Financial', icon: TrendingUp, wired: 'engine', tab: 'finance' },
    { num: 13, label: 'AI Decision', icon: BrainCircuit, wired: 'engine' },
];

const fmtUsd = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`;

export function ExecutiveDashboard() {
    const { inputs, selectedCountry, actions } = useSimulationStore();
    const capex = useCapexStore((s) => s.results);
    const runCapex = useCapexStore((s) => s.runCalculation);

    const pue = getPUE(inputs.coolingType);
    const itLoadMw = inputs.itLoad / 1000;

    // Real AI-decision read from genuinely-available engine outputs (Layer 13).
    const [aiResult, setAiResult] = React.useState<DecisionResult | null>(null);
    React.useEffect(() => {
        let alive = true;
        const ctx: DecisionContext = {
            inputs: { itLoadKw: inputs.itLoad, tier: inputs.tierLevel, coolingType: inputs.coolingType, region: selectedCountry?.id || '—', redundancy: inputs.powerRedundancy },
            capex: capex ? { totalUsd: capex.total, perKw: capex.metrics?.perKw, timelineMonths: capex.timeline?.totalMonths } : undefined,
            carbon: { pue },
            capacity: { totalMw: itLoadMw },
        };
        decide({ context: ctx, objectives: ['maxRoi'] }).then((r) => { if (alive) setAiResult(r); });
        return () => { alive = false; };
    }, [inputs, selectedCountry, capex, pue, itLoadMw]);

    const go = (tab?: TabId) => { if (tab) actions.setActiveTab(tab); };

    const [exporting, setExporting] = React.useState(false);
    const handleExport = async () => {
        setExporting(true);
        try {
            await generateDashboardPDF({
                project: 'Data Center Project',
                country: selectedCountry?.name || '—',
                itLoadKw: inputs.itLoad,
                tier: inputs.tierLevel,
                redundancy: inputs.powerRedundancy,
                coolingType: inputs.coolingType,
                pue,
                capex: capex ? { total: capex.total, perKw: capex.metrics?.perKw, racks: capex.metrics?.racks, timelineMonths: capex.timeline?.totalMonths } : undefined,
                engines: ENGINE_STRIP.map((e) => ({ num: e.num, label: e.label, status: e.wired })),
                decision: aiResult,
            });
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-900/40">
                        <LayoutDashboard className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Executive Overview</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">DC-OS · Data Center Intelligence Platform</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono hidden sm:block">
                        {selectedCountry?.name || '—'} · Tier {inputs.tierLevel} · {itLoadMw.toFixed(1)} MW
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-cyan-700 dark:hover:bg-cyan-700 text-white text-xs font-medium transition-colors disabled:opacity-60"
                    >
                        <FileDown className="w-3.5 h-3.5" />
                        {exporting ? 'Generating…' : 'Generate Report'}
                    </button>
                </div>
            </div>

            {/* 13-engine lifecycle strip */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Project Lifecycle · 13 Engines</h2>
                    <span className="text-[10px] text-slate-400">Auto-calculated flow (Layer 0 orchestrator)</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-13 gap-2">
                    {ENGINE_STRIP.map((e) => {
                        const Icon = e.icon;
                        const tone = e.wired === 'engine' ? 'text-emerald-500 border-emerald-500/40 bg-emerald-500/5'
                            : e.wired === 'partial' ? 'text-amber-500 border-amber-500/40 bg-amber-500/5'
                                : 'text-slate-400 border-slate-300/50 dark:border-slate-700/50';
                        return (
                            <button key={e.num} onClick={() => go(e.tab)} disabled={!e.tab}
                                className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors ${tone} ${e.tab ? 'hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer' : 'opacity-70 cursor-default'}`}
                                title={`${e.label}${e.wired === 'engine' ? ' — engine-sourced' : e.wired === 'partial' ? ' — partly engine-sourced' : ' — scheduled'}`}>
                                <Icon className="w-4 h-4" />
                                <span className="text-[9px] font-medium leading-tight">{e.num}. {e.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Roll-up KPIs (genuinely computed) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Kpi icon={Cpu} label="IT Load" value={`${itLoadMw.toFixed(1)} MW`} sub={`${inputs.itLoad.toLocaleString()} kW`} />
                <Kpi icon={Server} label="Tier" value={`Tier ${inputs.tierLevel}`} sub={inputs.powerRedundancy} />
                <Kpi icon={Building} label="Total CAPEX" value={capex ? fmtUsd(capex.total) : '—'} sub={capex ? `${fmtUsd(capex.metrics?.perKw || 0)}/kW` : 'Open CAPEX engine'} onClick={() => go('capex')} />
                <Kpi icon={Gauge} label="PUE (design)" value={pue.toFixed(2)} sub={inputs.coolingType} />
                <Kpi icon={Boxes} label="Racks" value={capex ? String(capex.metrics?.racks ?? '—') : '—'} sub={capex ? 'computed' : 'Open CAPEX engine'} onClick={() => go('capex')} />
                <Kpi icon={CalendarClock} label="Build Timeline" value={capex ? `${capex.timeline?.totalMonths ?? '—'} mo` : '—'} sub={capex ? 'engine' : 'Open CAPEX engine'} onClick={() => go('capex')} />
            </div>

            {/* AI Decision (Layer 13) + Financial CTA */}
            <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-cyan-500" />
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">AI Decision Engine</h2>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">deterministic</span>
                    </div>
                    {aiResult ? (
                        <>
                            <p className="text-sm text-slate-700 dark:text-slate-200 mb-3">{aiResult.summary}</p>
                            <div className="space-y-2">
                                {aiResult.recommendations.slice(0, 3).map((r, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs">
                                        <ArrowRight className="w-3.5 h-3.5 text-cyan-500 mt-0.5 shrink-0" />
                                        <div>
                                            <span className="font-semibold text-slate-800 dark:text-slate-100">{r.title}</span>
                                            <span className="text-slate-500 dark:text-slate-400"> — {r.detail}</span>
                                        </div>
                                    </div>
                                ))}
                                {aiResult.recommendations.length === 0 && (
                                    <p className="text-xs text-slate-500">No constraint flags — configuration is within typical envelopes. Set a budget/deadline in an engine to get targeted recommendations.</p>
                                )}
                            </div>
                            <p className="mt-3 text-[10px] text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-2">{aiResult.disclaimer}</p>
                        </>
                    ) : (
                        <p className="text-xs text-slate-500">Computing recommendation…</p>
                    )}
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Financial</h2>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">engine-sourced</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex-1">
                        NPV / IRR / payback are computed by the shared RZEngine (models.roi) — the same math as the site calculators. Open the Financial engine to set revenue assumptions and view the full cashflow + report.
                    </p>
                    <button onClick={() => go('finance')} className="mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors">
                        Open Financial Engine <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Data-flow / digital thread */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Data Flow &amp; Digital Thread</h2>
                <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500 dark:text-slate-400 overflow-x-auto">
                    {['Input Data', 'Engines', 'Models', 'Outputs', 'Decisions', 'Actions'].map((s, i, arr) => (
                        <React.Fragment key={s}>
                            <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 whitespace-nowrap font-medium">{s}</span>
                            {i < arr.length - 1 && <ArrowRight className="w-3 h-3 shrink-0" />}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {!capex && (
                <div className="text-center text-xs text-slate-500">
                    <button onClick={runCapex} className="underline hover:text-cyan-500">Run the CAPEX engine</button> to populate the roll-up KPIs.
                </div>
            )}
        </div>
    );
}

function Kpi({ icon: Icon, label, value, sub, onClick }: { icon: React.ElementType; label: string; value: string; sub?: string; onClick?: () => void }) {
    return (
        <button onClick={onClick} disabled={!onClick}
            className={`text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 ${onClick ? 'hover:border-cyan-400/50 cursor-pointer' : 'cursor-default'} transition-colors`}>
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{value}</div>
            {sub && <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{sub}</div>}
        </button>
    );
}

export default ExecutiveDashboard;
