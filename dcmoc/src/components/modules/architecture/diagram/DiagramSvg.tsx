'use client';

/* ─── Dynamic SVG renderer + pan/zoom + legend (Phase C) ─────────────────────
 * Renders the DiagramModel (layout.ts) — logical & SLD skins of the SAME
 * graph. Pan = drag, zoom = wheel/buttons. No diagram library.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useArchitectureStore } from '@/store/architecture';
import type { DiagramModel, DiagBlock, DiagEdge, EdgeKind } from './layout';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

const EDGE_STYLE: Record<EdgeKind, { stroke: string; dash?: string; label: string }> = {
    normal: { stroke: '#3b82f6', label: 'Normal Power' },
    backup: { stroke: '#f97316', label: 'Backup Power' },
    control: { stroke: '#22c55e', dash: '4 3', label: 'Control / Monitoring' },
    coolSupply: { stroke: '#14b8a6', label: 'Cooling Supply' },
    coolReturn: { stroke: '#14b8a6', dash: '5 4', label: 'Cooling Return' },
};

const LANE_FILL: Record<DiagBlock['lane'], string> = {
    power: '#1e293b', gen: '#292018', cooling: '#0f2a2a', it: '#1c2440', bms: '#231c38',
};
const LANE_STROKE: Record<DiagBlock['lane'], string> = {
    power: '#3b82f6', gen: '#f97316', cooling: '#14b8a6', it: '#a78bfa', bms: '#22c55e',
};

function anchor(b: DiagBlock, side: 'l' | 'r') {
    return { x: side === 'l' ? b.x : b.x + b.w, y: b.y + b.h / 2 };
}

function edgePath(from: DiagBlock, to: DiagBlock, offset = 0): string {
    const a = anchor(from, 'r'); const b = anchor(to, 'l');
    // orthogonal H-V-H; when target is to the LEFT (feedback edge), route below
    if (b.x <= a.x) {
        const dropY = Math.max(from.y + from.h, to.y + to.h) + 14 + Math.abs(offset);
        return `M${a.x},${a.y + offset} H${a.x + 8} V${dropY} H${b.x - 8} V${b.y + offset} H${b.x}`;
    }
    const midX = (a.x + b.x) / 2 + offset;
    return `M${a.x},${a.y + offset} H${midX} V${b.y + offset} H${b.x}`;
}

export function DiagramSvg({ model }: { model: DiagramModel }) {
    const view = useArchitectureStore((s) => s.diagramView);
    const zoom = useArchitectureStore((s) => s.zoom);
    const panX = useArchitectureStore((s) => s.panX);
    const panY = useArchitectureStore((s) => s.panY);
    const set = useArchitectureStore((s) => s.actions.set);
    const resetView = useArchitectureStore((s) => s.actions.resetView);
    const drag = React.useRef<{ x: number; y: number; px: number; py: number } | null>(null);
    const byId = React.useMemo(() => Object.fromEntries(model.blocks.map((b) => [b.id, b])), [model]);
    const sld = view === 'sld';

    const onWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        set({ zoom: Math.min(3, Math.max(0.5, zoom * (e.deltaY > 0 ? 0.9 : 1.1))) });
    };
    const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, px: panX, py: panY }; };
    const onMove = (e: React.PointerEvent) => {
        if (!drag.current) return;
        set({ panX: drag.current.px + (e.clientX - drag.current.x) / zoom, panY: drag.current.py + (e.clientY - drag.current.y) / zoom });
    };
    const onUp = () => { drag.current = null; };

    const [vx, vy, vw, vh] = model.viewBox;

    return (
        <div className="relative">
            <div className="absolute right-2 top-2 z-10 flex gap-1">
                <button onClick={() => set({ zoom: Math.min(3, zoom * 1.2) })} className="rounded bg-slate-800/80 p-1 text-slate-300 hover:text-white"><ZoomIn className="h-3.5 w-3.5" /></button>
                <button onClick={() => set({ zoom: Math.max(0.5, zoom * 0.85) })} className="rounded bg-slate-800/80 p-1 text-slate-300 hover:text-white"><ZoomOut className="h-3.5 w-3.5" /></button>
                <button onClick={resetView} className="rounded bg-slate-800/80 p-1 text-slate-300 hover:text-white"><Maximize2 className="h-3.5 w-3.5" /></button>
            </div>
            <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} className="w-full cursor-grab rounded-xl active:cursor-grabbing" style={{ background: '#0b1020', minHeight: 260 }}
                onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
                <g transform={`translate(${panX},${panY}) scale(${zoom})`} style={{ transformOrigin: 'center' }}>
                    {/* edges under blocks */}
                    {model.edges.map((e: DiagEdge, i) => {
                        const from = byId[e.from]; const to = byId[e.to];
                        if (!from || !to) return null;
                        const s = EDGE_STYLE[e.kind];
                        const hidden = sld && (e.kind === 'coolSupply' || e.kind === 'coolReturn' || e.kind === 'control');
                        if (hidden) return null;
                        return <path key={i} d={edgePath(from, to, e.offset ?? 0)} fill="none"
                            stroke={sld ? (e.kind === 'backup' ? '#f97316' : '#94a3b8') : s.stroke}
                            strokeWidth={sld ? 1.4 : 1.6} strokeDasharray={s.dash} opacity={0.9} />;
                    })}
                    {model.blocks.map((b) => {
                        const hidden = sld && (b.lane === 'cooling' || b.lane === 'bms');
                        if (hidden) return null;
                        return (
                            <g key={b.id}>
                                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={sld ? 2 : 8}
                                    fill={sld ? '#0f172a' : LANE_FILL[b.lane]} stroke={sld ? '#94a3b8' : LANE_STROKE[b.lane]} strokeWidth={1} />
                                <text x={b.x + 8} y={b.y + 16} fontSize="9" fontWeight={700} fill="#e2e8f0">{b.title}</text>
                                {b.sub && <text x={b.x + 8} y={b.y + 28} fontSize="7.5" fill="#94a3b8">{b.sub}</text>}
                                {b.badge && (
                                    <>
                                        <rect x={b.x + b.w - 34} y={b.y + 4} width={30} height={11} rx={5} fill="#a78bfa22" stroke="#a78bfa" strokeWidth={0.5} />
                                        <text x={b.x + b.w - 19} y={b.y + 12.5} fontSize="6.5" textAnchor="middle" fill="#c4b5fd">{b.badge}</text>
                                    </>
                                )}
                                {b.glyphs != null && Array.from({ length: b.glyphs }, (_, gi) => (
                                    sld
                                        ? <circle key={gi} cx={b.x + 12 + gi * 12} cy={b.y + b.h - 9} r={3.4} fill="none" stroke="#cbd5e1" strokeWidth={0.8} />
                                        : <rect key={gi} x={b.x + 8 + gi * 12} y={b.y + b.h - 13} width={8} height={8} rx={1.5} fill={LANE_STROKE[b.lane]} opacity={0.55} />
                                ))}
                            </g>
                        );
                    })}
                </g>
            </svg>
            {/* legend */}
            <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 text-[9px] text-slate-500">
                <span className="font-semibold uppercase">Legend:</span>
                {(Object.keys(EDGE_STYLE) as EdgeKind[]).map((k) => (
                    <span key={k} className="inline-flex items-center gap-1">
                        <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke={EDGE_STYLE[k].stroke} strokeWidth="2" strokeDasharray={EDGE_STYLE[k].dash} /></svg>
                        {EDGE_STYLE[k].label}
                    </span>
                ))}
            </div>
        </div>
    );
}
