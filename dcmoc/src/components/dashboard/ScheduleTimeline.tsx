'use client';

import React from 'react';
import { TraceValue } from '@/components/ui/TraceValue';

/* ─── Schedule & Milestones — clean, responsive phase timeline ────────────────
 * Replaces the engineering Gantt inside the dashboard. Phase rows with a shared
 * month axis + positioned colored bars — no fixed left column, no horizontal
 * scrollbar. Durations/positions are engine-real (capex.timeline). A phase is
 * "Active" when it straddles the notional design-phase start (month 0), else
 * "Planned" — honest to the project's Design & Planning status.
 * ──────────────────────────────────────────────────────────────────────────── */

interface Phase { name: string; start: number; end: number; color: string }

/* CPM phase name → value-trace id (durations are engine-real, CapexEngine.computeTimeline) */
const PHASE_TRACE: Partial<Record<string, string>> = {
    'Design & Engineering': 'constr.phaseDesignMo',
    'Permitting': 'constr.phasePermitMo',
    'Civil Construction': 'constr.phaseCivilMo',
    'MEP Installation': 'constr.phaseMepMo',
    'Commissioning': 'constr.phaseCxMo',
};

const fmtQ = (month: number, startYear: number) => {
    const q = Math.floor(month / 3) % 4 + 1;
    const y = startYear + Math.floor(month / 12);
    return `Q${q} ${y}`;
};

export function ScheduleTimeline({ phases, totalMonths, startYear = 2025 }: { phases: Phase[]; totalMonths: number; startYear?: number }) {
    if (!phases?.length || !totalMonths) return <p className="text-xs text-slate-500">Run the CAPEX engine for the build schedule.</p>;
    // axis ticks every ~quarter, capped to keep it readable
    const step = totalMonths > 24 ? 6 : totalMonths > 12 ? 3 : 2;
    const ticks: number[] = [];
    for (let m = 0; m <= totalMonths; m += step) ticks.push(m);

    return (
        <div className="text-xs">
            {/* axis */}
            <div className="grid grid-cols-[92px_1fr] items-end gap-x-2 mb-1">
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">Phase</span>
                <div className="relative h-3">
                    {ticks.map((m) => (
                        <span key={m} className="absolute -translate-x-1/2 text-[8px] text-slate-400 tabular-nums" style={{ left: `${(m / totalMonths) * 100}%` }}>
                            {fmtQ(m, startYear)}
                        </span>
                    ))}
                </div>
            </div>

            <div className="space-y-1.5">
                {phases.map((p) => {
                    const dur = Math.max(p.end - p.start, 0.5);
                    const active = p.start <= 0 && p.end > 0;
                    return (
                        <div key={p.name} className="grid grid-cols-[92px_1fr] items-center gap-x-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color }} />
                                <span className="text-[10px] text-slate-600 dark:text-slate-300 truncate">{p.name}</span>
                            </div>
                            <div className="relative h-4 rounded bg-slate-100 dark:bg-white/[0.04]">
                                {/* gridlines */}
                                {ticks.map((m) => (
                                    <div key={m} className="absolute top-0 bottom-0 w-px bg-slate-200/70 dark:bg-white/5" style={{ left: `${(m / totalMonths) * 100}%` }} />
                                ))}
                                <div
                                    className="absolute top-0.5 bottom-0.5 rounded flex items-center px-1.5"
                                    style={{ left: `${(p.start / totalMonths) * 100}%`, width: `${(dur / totalMonths) * 100}%`, background: p.color, opacity: active ? 1 : 0.7 }}
                                    title={`${p.name} · month ${p.start}–${p.end} (${(p.end - p.start)}mo)`}
                                >
                                    {PHASE_TRACE[p.name] ? (
                                        <TraceValue traceId={PHASE_TRACE[p.name]!}>
                                            <span className="text-[8px] font-bold text-white/90 drop-shadow tabular-nums whitespace-nowrap">{p.end - p.start}mo</span>
                                        </TraceValue>
                                    ) : (
                                        <span className="text-[8px] font-bold text-white/90 drop-shadow tabular-nums whitespace-nowrap">{p.end - p.start}mo</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* legend */}
            <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-100 dark:border-white/5 text-[9px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cyan-500" /> Active</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-400 opacity-70" /> Planned</span>
                <span className="ml-auto tabular-nums">{totalMonths} mo · ~{(totalMonths / 12).toFixed(1)} yr</span>
            </div>
        </div>
    );
}

export default ScheduleTimeline;
