'use client';

import React from 'react';

/** 5×5 likelihood × impact risk heat map. Cells colored by score; key project
 *  risks plotted from engine-derived flags with a real hover tooltip, numbered
 *  cells, a category filter + a legend — matches the DC-OS reference. */
const LIKELIHOOD = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];
const IMPACT = ['Minimal', 'Minor', 'Moderate', 'Major', 'Severe'];

function cellColor(prob: number, impact: number): string {
    const score = (prob + 1) * (impact + 1); // 1..25
    if (score >= 20) return '#ef4444';
    if (score >= 12) return '#f59e0b';
    if (score >= 6) return '#eab308';
    return '#10b981';
}
function scoreOf(r: RiskItem) { return (r.prob + 1) * (r.impact + 1); }

export interface RiskItem { id: string; label: string; prob: number; impact: number; category?: string }

export function RiskHeatMap({ risks }: { risks: RiskItem[] }) {
    const [cat, setCat] = React.useState('All Categories');
    const [hover, setHover] = React.useState<{ r: RiskItem; x: number; y: number } | null>(null);

    const cats = React.useMemo(() => ['All Categories', ...Array.from(new Set(risks.map((r) => r.category || 'General')))], [risks]);
    const shown = risks.filter((r) => cat === 'All Categories' || (r.category || 'General') === cat);
    // number the shown risks 1..n for the plotted badges
    const num = new Map(shown.map((r, i) => [r.id, i + 1]));
    const at = (p: number, i: number) => shown.find((r) => r.prob === p && r.impact === i);

    return (
        <div className="relative rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-4">
            <div className="flex items-center justify-between mb-3 gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Risk Heat Map</h2>
                {cats.length > 2 && (
                    <select value={cat} onChange={(e) => setCat(e.target.value)}
                        className="text-[10px] rounded-md border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 px-1.5 py-0.5 focus:outline-none">
                        {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                )}
            </div>
            <div className="flex gap-2">
                <div className="flex items-center text-[8px] text-slate-500">
                    <span style={{ writingMode: 'vertical-rl' } as React.CSSProperties} className="rotate-180">Impact →</span>
                </div>
                <div className="flex-1">
                    <div className="grid grid-rows-5 gap-1">
                        {[4, 3, 2, 1, 0].map((impact) => (
                            <div key={impact} className="grid grid-cols-5 gap-1">
                                {[0, 1, 2, 3, 4].map((prob) => {
                                    const r = at(prob, impact);
                                    return (
                                        <div
                                            key={prob}
                                            onMouseEnter={r ? (e) => setHover({ r, x: e.currentTarget.offsetLeft, y: e.currentTarget.offsetTop }) : undefined}
                                            onMouseLeave={r ? () => setHover(null) : undefined}
                                            className={`relative aspect-[2/1] rounded ${r ? 'cursor-pointer ring-1 ring-white/40' : ''}`}
                                            style={{ background: cellColor(prob, impact), opacity: r ? 1 : 0.22 }}
                                        >
                                            {r && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">{num.get(r.id)}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-5 gap-1 mt-1 text-[7px] text-slate-500 text-center">
                        {LIKELIHOOD.map((a) => <span key={a} className="truncate">{a}</span>)}
                    </div>
                    <div className="text-[8px] text-slate-500 text-center mt-0.5">Likelihood →</div>
                </div>
            </div>

            {/* legend */}
            <div className="mt-3 space-y-1">
                {shown.map((r) => (
                    <div key={r.id} className="flex items-center gap-1.5 text-[10px]">
                        <span className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: cellColor(r.prob, r.impact) }}>{num.get(r.id)}</span>
                        <span className="text-slate-600 dark:text-slate-300 truncate flex-1">{r.label}</span>
                        <span className="text-slate-400 tabular-nums shrink-0">{scoreOf(r)}</span>
                    </div>
                ))}
            </div>

            {/* hover tooltip */}
            {hover && (
                <div className="absolute z-20 pointer-events-none rounded-lg border border-white/15 bg-[#0f1424] shadow-xl px-2.5 py-1.5 text-[10px] w-44"
                    style={{ left: Math.min(hover.x + 44, 180), top: hover.y + 30 }}>
                    <div className="font-semibold text-white mb-0.5">#{num.get(hover.r.id)} · {hover.r.label}</div>
                    <div className="text-slate-400">Likelihood <span className="text-slate-200">{LIKELIHOOD[hover.r.prob]}</span> · Impact <span className="text-slate-200">{IMPACT[hover.r.impact]}</span></div>
                    <div className="text-slate-400">Score <span className="font-bold" style={{ color: cellColor(hover.r.prob, hover.r.impact) }}>{scoreOf(hover.r)}</span> / 25{hover.r.category ? ` · ${hover.r.category}` : ''}</div>
                </div>
            )}
        </div>
    );
}

export default RiskHeatMap;
