'use client';

/* ─── GanttChart — recursive N-level WBS (Workstream E1) ─────────────────────
 * Two APIs:
 *   • tree:   nested WbsNode[] from models.construction.detailedSchedule
 *             (4-level: phase → sub-phase → task → work-package), collapse/
 *             expand per node, per-bar DIAGNOSIS tooltip (duration basis,
 *             depends-on, critical-path + procurement risk).
 *   • legacy: phases + subPhases (2-level) — still used by CapexDashboard.
 * The legacy pair is converted into a tree so ONE renderer draws both.
 * ──────────────────────────────────────────────────────────────────────── */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Milestone, AlertTriangle } from 'lucide-react';

interface Phase {
    name: string;
    start: number;
    end: number;
    color: string;
}

interface SubPhase extends Phase {
    parent: string;
}

export interface WbsNode {
    id: string;
    name: string;
    level: number;          // 1..4
    start: number;
    end: number;
    months?: number;
    color: string;
    basis?: string;         // duration basis (diagnosis)
    dependsOn?: string | null;
    critical?: boolean;     // on the procurement/critical path
    risk?: string | null;
    children?: WbsNode[];
}

interface GanttChartProps {
    phases?: Phase[];
    subPhases?: SubPhase[];
    /** nested 4-level WBS — preferred; overrides phases/subPhases */
    tree?: WbsNode[];
    totalMonths: number;
}

/** Convert the legacy 2-level API into a WbsNode tree (single renderer). */
function legacyToTree(phases: Phase[], subPhases: SubPhase[]): WbsNode[] {
    return phases.map((p) => ({
        id: `1:${p.name}`, name: p.name, level: 1, start: p.start, end: p.end, color: p.color,
        children: subPhases.filter((s) => s.parent === p.name).map((s) => ({
            id: `2:${s.name}`, name: s.name, level: 2, start: s.start, end: s.end, color: s.color, children: [],
        })),
    }));
}

const LEVEL_STYLE: Record<number, { barH: string; rowH: string; text: string; pad: number; opacity: number }> = {
    1: { barH: 'h-5', rowH: 'h-7', text: 'text-xs font-semibold text-slate-700 dark:text-slate-200', pad: 8, opacity: 0.85 },
    2: { barH: 'h-3.5', rowH: 'h-5', text: 'text-[11px] text-slate-500 dark:text-slate-400', pad: 26, opacity: 0.65 },
    3: { barH: 'h-2.5', rowH: 'h-[18px]', text: 'text-[10px] text-slate-500 dark:text-slate-500', pad: 44, opacity: 0.5 },
    4: { barH: 'h-1.5', rowH: 'h-4', text: 'text-[9px] text-slate-400 dark:text-slate-600', pad: 62, opacity: 0.4 },
};

const GanttChart: React.FC<GanttChartProps> = ({ phases = [], subPhases = [], tree, totalMonths }) => {
    const nodes = React.useMemo(() => tree ?? legacyToTree(phases, subPhases), [tree, phases, subPhases]);
    // default expanded: levels 1-2 open, 3+ collapsed (detail on demand)
    const [expanded, setExpanded] = useState<Set<string>>(() => {
        const s = new Set<string>();
        const walk = (ns: WbsNode[]) => ns.forEach((n) => { if (n.level <= 2) s.add(n.id); walk(n.children ?? []); });
        walk(tree ?? legacyToTree(phases, subPhases));
        return s;
    });
    const toggle = (id: string) => setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const months = Array.from({ length: totalMonths + 1 }, (_, i) => i);
    const l1 = nodes;

    // Milestones (kept consistent with the legacy renderer; derived from L1 ends)
    const milestones = [
        { month: l1.find((p) => p.name === 'Design & Engineering')?.end ?? 0, label: 'Design Complete', color: '#10b981' },
        { month: l1.find((p) => p.name === 'Permitting')?.end ?? 0, label: 'Permits Secured', color: '#f59e0b' },
        { month: l1.find((p) => p.name === 'Civil Construction')?.end ?? 0, label: 'Building Ready', color: '#3b82f6' },
        { month: l1.find((p) => p.name === 'MEP Installation')?.end ?? 0, label: 'MEP Complete', color: '#7DDDB4' },
        { month: totalMonths, label: 'Go-Live', color: '#ec4899' },
    ].filter((m) => m.month > 0);

    const renderNode = (n: WbsNode): React.ReactNode => {
        const st = LEVEL_STYLE[n.level] ?? LEVEL_STYLE[4];
        const hasKids = (n.children?.length ?? 0) > 0;
        const isOpen = expanded.has(n.id);
        const dur = +(n.end - n.start).toFixed(1);
        return (
            <div key={n.id}>
                <div
                    className={`flex items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 group ${hasKids ? 'cursor-pointer' : ''}`}
                    onClick={hasKids ? () => toggle(n.id) : undefined}
                >
                    <div className="w-56 min-w-[224px] shrink-0 flex items-center gap-1.5 py-0.5 pr-2" style={{ paddingLeft: st.pad }}>
                        {hasKids
                            ? (isOpen ? <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />)
                            : <span className="w-3 shrink-0" />}
                        {n.level === 1 && <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: n.color }} />}
                        <span className={`${st.text} truncate`}>{n.name}</span>
                        {n.critical && <AlertTriangle className="w-3 h-3 text-rz-alert shrink-0" aria-label="critical path" />}
                    </div>
                    <div className={`flex-1 relative ${st.rowH} flex items-center`}>
                        <div
                            className={`absolute ${st.barH} rounded group/bar`}
                            style={{
                                left: `${(n.start / totalMonths) * 100}%`,
                                width: `${Math.max(((n.end - n.start) / totalMonths) * 100, 1.2)}%`,
                                backgroundColor: n.color,
                                opacity: st.opacity,
                                outline: n.critical ? '1px solid #FF3030' : undefined,
                                outlineOffset: n.critical ? '1px' : undefined,
                            }}
                        >
                            {n.level === 1 && (
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-sm">{dur}mo</span>
                            )}
                            {/* diagnosis tooltip */}
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full w-64 bg-slate-800 dark:bg-slate-700 text-white text-[10px] px-2 py-1.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-20 whitespace-normal leading-snug shadow-xl">
                                <div className="font-bold">{n.name} · M{n.start}–M{n.end} ({dur} mo)</div>
                                {n.basis && <div className="mt-0.5 text-slate-300">{n.basis}</div>}
                                {n.dependsOn && <div className="mt-0.5 text-cyan-300">after: {n.dependsOn}</div>}
                                {n.critical && <div className="mt-0.5 font-semibold text-red-300">CRITICAL PATH{n.risk ? ` — ${n.risk}` : ''}</div>}
                            </div>
                        </div>
                    </div>
                </div>
                {isOpen && hasKids && n.children!.map(renderNode)}
            </div>
        );
    };

    return (
        <div className="w-full">
            {/* Month header grid */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-1">
                <div className="w-56 min-w-[224px] shrink-0" />
                <div className="flex-1 flex relative">
                    {months.map((m) => (
                        <div key={m} className="text-[10px] text-slate-400 dark:text-slate-500 text-center font-mono" style={{ width: `${100 / (totalMonths + 1)}%` }}>
                            M{m}
                        </div>
                    ))}
                </div>
            </div>

            <div className="relative">
                {/* Vertical grid lines */}
                <div className="absolute inset-0 flex pointer-events-none" style={{ left: '224px', right: 0 }}>
                    {months.map((m) => (
                        <div key={m} className="border-l border-slate-100 dark:border-slate-800 h-full" style={{ width: `${100 / (totalMonths + 1)}%` }} />
                    ))}
                </div>

                {l1.map(renderNode)}

                {/* Milestones row */}
                <div className="flex items-center border-t border-slate-200 dark:border-slate-700 mt-1 pt-1">
                    <div className="w-56 min-w-[224px] shrink-0 py-1 px-2">
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Milestones</span>
                    </div>
                    <div className="flex-1 relative h-6">
                        {milestones.map((ms, i) => (
                            <div key={i} className="absolute top-0 flex flex-col items-center group/ms" style={{ left: `${(ms.month / totalMonths) * 100}%` }}>
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
                    {l1.map((p) => (
                        <div key={p.id} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{p.name}</span>
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    {tree && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                            <AlertTriangle className="w-3 h-3 text-rz-alert" /> critical path (procurement-bound)
                        </span>
                    )}
                    <span className="text-xs text-slate-400 dark:text-slate-500">~{(totalMonths / 12).toFixed(1)} yrs</span>
                </div>
            </div>
        </div>
    );
};

export default GanttChart;
