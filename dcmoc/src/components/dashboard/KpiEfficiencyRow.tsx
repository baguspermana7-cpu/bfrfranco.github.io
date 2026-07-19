'use client';

import React from 'react';
import { Gauge, Droplets, Leaf, Activity, DollarSign } from 'lucide-react';
import { Explain } from '@/components/ui/Explain';
import { TraceValue } from '@/components/ui/TraceValue';
import type { DashboardData } from './useDashboardData';

const fmtUsd = (n: number | null) => n == null ? '—' : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${(n / 1e3).toFixed(0)}K`;

/** Sustainability / efficiency KPI row — PUE / WUE / CUE / Availability / LCC.
 *  `tip` = RZExplain glossary key (knowledge-DB sourced, not hardcoded). */
export function KpiEfficiencyRow({ d }: { d: DashboardData }) {
    const cards: { icon: React.ElementType; label: string; value: string; color: string; tip: string; trace?: string }[] = [
        { icon: Gauge, label: 'PUE (Design)', value: d.pue.toFixed(2), color: 'text-cyan-400', tip: 'pue', trace: 'engine.pueTier3' },
        { icon: Droplets, label: 'WUE (L/kWh)', value: d.wue != null ? d.wue.toFixed(2) : '—', color: 'text-blue-400', tip: 'wue', trace: 'sus.wue' },
        { icon: Leaf, label: 'CUE (kgCO₂/kWh)', value: d.cue != null ? d.cue.toFixed(3) : '—', color: 'text-emerald-400', tip: 'cue', trace: 'sus.cue' },
        { icon: Activity, label: 'Availability', value: d.availabilityPct != null ? `${d.availabilityPct}%` : '—', color: 'text-violet-400', tip: 'availability', trace: 'rel.systemAvailability' },
        { icon: DollarSign, label: 'LCC (15yr)', value: fmtUsd(d.lcc), color: 'text-amber-400', tip: 'tco', trace: 'fin.lcc15' },
    ];
    return (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Key Performance Indicators</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {cards.map((c) => {
                    const Icon = c.icon;
                    return (
                        <div key={c.label} className="group rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 p-2.5 transition-all hover:-translate-y-0.5 hover:border-cyan-400/50 hover:bg-cyan-500/[0.06] hover:shadow-md hover:shadow-cyan-900/10">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Icon className={`w-3.5 h-3.5 ${c.color}`} />
                                <span className="text-[9px] uppercase tracking-wide text-slate-500 flex-1">{c.label}</span>
                                <span className="opacity-50 group-hover:opacity-100 transition-opacity"><Explain k={c.tip} /></span>
                            </div>
                            {c.trace ? (
                                <TraceValue traceId={c.trace}>
                                    <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{c.value}</div>
                                </TraceValue>
                            ) : (
                                <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{c.value}</div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default KpiEfficiencyRow;
