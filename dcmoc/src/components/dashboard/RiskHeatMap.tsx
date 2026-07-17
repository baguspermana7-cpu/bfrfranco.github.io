'use client';

import React from 'react';

/** 5×5 probability × impact risk heat map. Cells colored by score; key project
 *  risks plotted from engine-derived flags. */
const AXIS = ['Low', 'Medium', 'High', 'Very High', 'Almost Certain'];

function cellColor(prob: number, impact: number): string {
    const score = (prob + 1) * (impact + 1); // 1..25
    if (score >= 20) return '#ef4444';
    if (score >= 12) return '#f59e0b';
    if (score >= 6) return '#eab308';
    return '#10b981';
}

export interface RiskItem { id: string; label: string; prob: number; impact: number; }

export function RiskHeatMap({ risks }: { risks: RiskItem[] }) {
    // map risks onto cells
    const at = (p: number, i: number) => risks.find((r) => r.prob === p && r.impact === i);
    return (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Risk Heat Map</h2>
            <div className="flex gap-2">
                <div className="flex flex-col justify-between text-[8px] text-slate-500 py-0.5 writing-mode-vertical">
                    <span className="rotate-180" style={{ writingMode: 'vertical-rl' } as React.CSSProperties}>Impact →</span>
                </div>
                <div className="flex-1">
                    <div className="grid grid-rows-5 gap-1">
                        {[4, 3, 2, 1, 0].map((impact) => (
                            <div key={impact} className="grid grid-cols-5 gap-1">
                                {[0, 1, 2, 3, 4].map((prob) => {
                                    const r = at(prob, impact);
                                    return (
                                        <div key={prob} className="relative aspect-[2/1] rounded" style={{ background: cellColor(prob, impact), opacity: r ? 1 : 0.28 }} title={r ? r.label : ''}>
                                            {r && <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">{r.id}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-5 gap-1 mt-1 text-[7px] text-slate-500 text-center">
                        {AXIS.map((a) => <span key={a}>{a}</span>)}
                    </div>
                    <div className="text-[8px] text-slate-500 text-center mt-0.5">Likelihood →</div>
                </div>
            </div>
            <div className="mt-2 space-y-0.5">
                {risks.map((r) => (
                    <div key={r.id} className="flex items-center gap-1.5 text-[10px]">
                        <span className="w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ background: cellColor(r.prob, r.impact) }}>{r.id}</span>
                        <span className="text-slate-500 dark:text-slate-400 truncate">{r.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default RiskHeatMap;
