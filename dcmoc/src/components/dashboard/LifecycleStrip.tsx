'use client';

import React from 'react';
import {
    ClipboardList, MapPin, Boxes, Layers, Building, HardHat, CheckCircle2,
    Wrench, Activity, ShieldCheck, Leaf, TrendingUp, BrainCircuit, Check, GitBranch,
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

/** The 13-engine Project Lifecycle Workflow strip (icons + status ✓ + arrows). */
export function LifecycleStrip({ onOpen }: { onOpen: (tab?: TabId) => void }) {
    return (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-3.5">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Project Lifecycle · Engine Workflow</h2>
                <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Auto-Calculated Flow</span>
                    <button className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-slate-200 dark:border-white/10 text-slate-500 hover:text-cyan-400">
                        <GitBranch className="w-3 h-3" /> View Engine Graph
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
                                className={`group shrink-0 flex flex-col items-center gap-1 rounded-lg border ${TONE[e.status]} bg-slate-50 dark:bg-white/[0.02] px-2 py-2 min-w-[62px] ${e.tab ? 'hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer' : 'cursor-default'} transition-colors`}
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
        </div>
    );
}

export default LifecycleStrip;
