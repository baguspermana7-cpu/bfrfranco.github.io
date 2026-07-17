'use client';

import React from 'react';
import {
    ClipboardList, MapPin, Boxes, Layers, Building, HardHat, CheckCircle2,
    Wrench, Activity, ShieldCheck, Leaf, TrendingUp, BrainCircuit, Check, GitBranch, X,
} from 'lucide-react';

type TabId = string;
export interface EngineNode { num: number; label: string; icon: React.ElementType; status: 'engine' | 'partial' | 'local'; tab?: TabId; }

export const ENGINES: EngineNode[] = [
    { num: 1, label: 'Requirements', icon: ClipboardList, status: 'engine', tab: 'sim' },
    { num: 2, label: 'Site Intel', icon: MapPin, status: 'engine', tab: 'disaster' },
    { num: 3, label: 'Architecture', icon: Boxes, status: 'engine', tab: 'capex' },
    { num: 4, label: 'Capacity', icon: Layers, status: 'partial', tab: 'capacity' },
    { num: 5, label: 'CAPEX', icon: Building, status: 'partial', tab: 'capex' },
    { num: 6, label: 'Construction', icon: HardHat, status: 'engine', tab: 'phased-finance' },
    { num: 7, label: 'Commissioning', icon: CheckCircle2, status: 'engine' },
    { num: 8, label: 'Operations', icon: Wrench, status: 'partial', tab: 'staff' },
    { num: 9, label: 'Assets', icon: Activity, status: 'engine', tab: 'asset-lifecycle' },
    { num: 10, label: 'Reliability', icon: ShieldCheck, status: 'engine', tab: 'reliability' },
    { num: 11, label: 'Sustainability', icon: Leaf, status: 'partial', tab: 'carbon' },
    { num: 12, label: 'Financial', icon: TrendingUp, status: 'engine', tab: 'finance' },
    { num: 13, label: 'AI Decision', icon: BrainCircuit, status: 'engine' },
];

const TONE: Record<string, string> = {
    engine: 'text-emerald-400 border-emerald-500/40',
    partial: 'text-amber-400 border-amber-500/40',
    local: 'text-slate-400 border-slate-500/30',
};

const STATUS_COLOR: Record<string, string> = {
    engine: '#34d399',
    partial: '#fbbf24',
    local: '#94a3b8',
};

/** Inline engine dependency graph — shown when "View Engine Graph" is clicked and no onViewGraph prop is set. */
function EngineGraph({ onClose }: { onClose: () => void }) {
    return (
        <div className="mt-3 rounded-xl border border-cyan-400/20 bg-[#0a0f1e]/90 p-4 relative">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">Engine Dependency Graph</span>
                <button
                    onClick={onClose}
                    className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/10 transition-colors"
                    aria-label="Close graph"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="overflow-x-auto pb-2">
                <div className="flex items-center gap-0 min-w-max">
                    {ENGINES.map((e, i) => {
                        const Icon = e.icon;
                        const col = STATUS_COLOR[e.status];
                        return (
                            <React.Fragment key={e.num}>
                                <div className="flex flex-col items-center gap-1">
                                    <div
                                        className="w-10 h-10 rounded-lg border flex items-center justify-center relative"
                                        style={{ borderColor: `${col}50`, background: `${col}12` }}
                                    >
                                        <Icon className="w-4 h-4" style={{ color: col }} />
                                        <span
                                            className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center"
                                            style={{ background: col, color: '#0a0f1e' }}
                                        >
                                            {e.num}
                                        </span>
                                    </div>
                                    <span className="text-[7px] text-slate-400 text-center w-12 leading-tight">{e.label}</span>
                                </div>
                                {i < ENGINES.length - 1 && (
                                    <svg width="20" height="12" className="shrink-0 mt-[-10px]" aria-hidden="true">
                                        <line x1="0" y1="6" x2="16" y2="6" stroke="#22d3ee" strokeWidth="1" strokeOpacity="0.4" />
                                        <polygon points="13,3 20,6 13,9" fill="#22d3ee" fillOpacity="0.4" />
                                    </svg>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5">
                {(['engine', 'partial', 'local'] as const).map((s) => (
                    <span key={s} className="flex items-center gap-1 text-[9px] text-slate-400">
                        <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                        {s === 'engine' ? 'Engine-backed' : s === 'partial' ? 'Partial' : 'Local only'}
                    </span>
                ))}
            </div>
        </div>
    );
}

/** The 13-engine Project Lifecycle Workflow strip (icons + status ✓ + arrows). */
export function LifecycleStrip({ onOpen, onViewGraph }: { onOpen: (tab?: TabId) => void; onViewGraph?: () => void }) {
    const [graphOpen, setGraphOpen] = React.useState(false);

    const handleViewGraph = () => {
        if (onViewGraph) {
            onViewGraph();
        } else {
            setGraphOpen((v) => !v);
        }
    };

    return (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-3.5">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Project Lifecycle · Engine Workflow</h2>
                <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Auto-Calculated Flow</span>
                    <button
                        onClick={handleViewGraph}
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-all hover:border-cyan-400/50 hover:text-cyan-400 hover:bg-cyan-500/10 active:scale-[0.97] ${graphOpen ? 'border-cyan-400/40 text-cyan-400 bg-cyan-500/10' : 'border-slate-200 dark:border-white/10 text-slate-500'}`}
                    >
                        <GitBranch className="w-3 h-3" /> {graphOpen ? 'Hide Graph' : 'View Engine Graph'}
                    </button>
                </div>
            </div>
            <div className="flex items-stretch gap-0.5 overflow-x-auto pb-1">
                {ENGINES.map((e, i) => {
                    const Icon = e.icon;
                    return (
                        <React.Fragment key={e.num}>
                            <button
                                onClick={() => onOpen(e.tab)}
                                disabled={!e.tab}
                                title={`${e.num}. ${e.label} — ${e.status}`}
                                className={`group shrink-0 flex flex-col items-center gap-1 rounded-lg border ${TONE[e.status]} bg-slate-50 dark:bg-white/[0.02] px-2 py-2 min-w-[62px] transition-all ${e.tab ? 'hover:ring-1 hover:ring-cyan-400/60 hover:scale-[1.03] hover:bg-cyan-500/10 hover:border-cyan-400/50 cursor-pointer active:scale-[0.98] active:bg-cyan-500/15' : 'cursor-default'}`}
                            >
                                <div className="relative">
                                    <Icon className="w-4 h-4" />
                                    {e.status !== 'local' && (
                                        <Check className="absolute -bottom-1 -right-1 w-2.5 h-2.5 text-emerald-500" strokeWidth={4} />
                                    )}
                                </div>
                                <span className="text-[8px] font-medium leading-tight text-center text-slate-600 dark:text-slate-300">{e.num}.{e.label}</span>
                            </button>
                            {i < ENGINES.length - 1 && (
                                <div className="shrink-0 self-center text-slate-300 dark:text-slate-700 text-[10px] px-0.5">›</div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
            {graphOpen && !onViewGraph && <EngineGraph onClose={() => setGraphOpen(false)} />}
        </div>
    );
}

export default LifecycleStrip;
