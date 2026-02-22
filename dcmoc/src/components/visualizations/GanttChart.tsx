'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Milestone } from 'lucide-react';

interface Phase {
    name: string;
    start: number;
    end: number;
    color: string;
}

interface SubPhase extends Phase {
    parent: string;
}

interface GanttChartProps {
    phases: Phase[];
    subPhases: SubPhase[];
    totalMonths: number;
}

const GanttChart: React.FC<GanttChartProps> = ({ phases, subPhases, totalMonths }) => {
    const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(phases.map(p => p.name)));

    const togglePhase = (name: string) => {
        setExpandedPhases(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    // Generate month markers
    const months = Array.from({ length: totalMonths + 1 }, (_, i) => i);

    // Milestones
    const milestones = [
        { month: phases.find(p => p.name === 'Design & Engineering')?.end ?? 0, label: 'Design Complete', color: '#10b981' },
        { month: phases.find(p => p.name === 'Permitting')?.end ?? 0, label: 'Permits Secured', color: '#f59e0b' },
        { month: phases.find(p => p.name === 'Civil Construction')?.end ?? 0, label: 'Building Ready', color: '#3b82f6' },
        { month: phases.find(p => p.name === 'MEP Installation')?.end ?? 0, label: 'MEP Complete', color: '#8b5cf6' },
        { month: totalMonths, label: 'Go-Live', color: '#ec4899' },
    ];

    return (
        <div className="w-full">
            {/* Month header grid */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-1">
                <div className="w-44 min-w-[176px] shrink-0" />
                <div className="flex-1 flex relative">
                    {months.map(m => (
                        <div
                            key={m}
                            className="text-[10px] text-slate-400 dark:text-slate-500 text-center font-mono"
                            style={{ width: `${100 / (totalMonths + 1)}%` }}
                        >
                            M{m}
                        </div>
                    ))}
                </div>
            </div>

            {/* Grid lines + phases */}
            <div className="relative">
                {/* Vertical grid lines */}
                <div className="absolute inset-0 flex pointer-events-none" style={{ left: '176px', right: 0 }}>
                    {months.map(m => (
                        <div
                            key={m}
                            className="border-l border-slate-100 dark:border-slate-800 h-full"
                            style={{ width: `${100 / (totalMonths + 1)}%` }}
                        />
                    ))}
                </div>

                {/* Phase rows */}
                {phases.map(phase => {
                    const isExpanded = expandedPhases.has(phase.name);
                    const children = subPhases.filter(sp => sp.parent === phase.name);
                    const duration = phase.end - phase.start;

                    return (
                        <div key={phase.name}>
                            {/* L1 Phase header row */}
                            <div
                                className="flex items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer group"
                                onClick={() => togglePhase(phase.name)}
                            >
                                <div className="w-44 min-w-[176px] shrink-0 flex items-center gap-1.5 py-1.5 px-2">
                                    {isExpanded
                                        ? <ChevronDown className="w-3 h-3 text-slate-400" />
                                        : <ChevronRight className="w-3 h-3 text-slate-400" />
                                    }
                                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: phase.color }} />
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                                        {phase.name}
                                    </span>
                                </div>
                                <div className="flex-1 relative h-7 flex items-center">
                                    <div
                                        className="absolute h-5 rounded-md opacity-30"
                                        style={{
                                            left: `${(phase.start / totalMonths) * 100}%`,
                                            width: `${(duration / totalMonths) * 100}%`,
                                            backgroundColor: phase.color,
                                        }}
                                    />
                                    <div
                                        className="absolute h-5 rounded-md flex items-center justify-center"
                                        style={{
                                            left: `${(phase.start / totalMonths) * 100}%`,
                                            width: `${(duration / totalMonths) * 100}%`,
                                            backgroundColor: phase.color,
                                            opacity: 0.85,
                                        }}
                                    >
                                        <span className="text-[10px] font-bold text-white drop-shadow-sm">
                                            {duration}mo
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* L2 Sub-phase rows */}
                            {isExpanded && children.map(sub => {
                                const subDuration = sub.end - sub.start;
                                return (
                                    <div key={sub.name} className="flex items-center hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                        <div className="w-44 min-w-[176px] shrink-0 py-1 pl-8 pr-2">
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                                                {sub.name}
                                            </span>
                                        </div>
                                        <div className="flex-1 relative h-5 flex items-center">
                                            <div
                                                className="absolute h-3.5 rounded group/bar"
                                                style={{
                                                    left: `${(sub.start / totalMonths) * 100}%`,
                                                    width: `${Math.max((subDuration / totalMonths) * 100, 1.5)}%`,
                                                    backgroundColor: sub.color,
                                                    opacity: 0.65,
                                                }}
                                            >
                                                {/* Duration tooltip on hover */}
                                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 dark:bg-slate-700 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                    M{sub.start}–M{sub.end} ({subDuration}mo)
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}

                {/* Milestones row */}
                <div className="flex items-center border-t border-slate-200 dark:border-slate-700 mt-1 pt-1">
                    <div className="w-44 min-w-[176px] shrink-0 py-1 px-2">
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                            Milestones
                        </span>
                    </div>
                    <div className="flex-1 relative h-6">
                        {milestones.map((ms, i) => (
                            <div
                                key={i}
                                className="absolute top-0 flex flex-col items-center group/ms"
                                style={{ left: `${(ms.month / totalMonths) * 100}%` }}
                            >
                                <Milestone className="w-3 h-3" style={{ color: ms.color }} />
                                <div className="absolute top-5 bg-slate-800 dark:bg-slate-700 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover/ms:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                    M{ms.month}: {ms.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Summary footer */}
            <div className="mt-3 flex items-center justify-between px-2 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Total Duration</div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200">{totalMonths} months</div>
                </div>
                <div className="flex gap-3 flex-wrap">
                    {phases.map(p => (
                        <div key={p.name} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{p.name}</span>
                        </div>
                    ))}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500">
                    ~{(totalMonths / 12).toFixed(1)} yrs
                </div>
            </div>
        </div>
    );
};

export default GanttChart;
