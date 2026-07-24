'use client';

/* ─── Dynamic SVG renderer + pan/zoom + legend (Phase C + SYM) ───────────────
 * Renders the DiagramModel (layout.ts) — logical & SLD skins of the SAME
 * graph. Each node IS an engineering symbol (IEC single-line-diagram style,
 * palette.tsx → assets/engineering) centred in its cell, with the title/sub as
 * a label BELOW it — no filled box, just a faint hairline cell so the symbols
 * read like a real schematic. Group rects are labelled group boxes with an
 * uppercase header. Pan = drag, zoom = wheel/buttons. No diagram library.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useArchitectureStore } from '@/store/architecture';
import type { DiagramModel, DiagBlock, DiagEdge, EdgeKind } from './layout';
import { SymbolGlyph } from './palette';
import { NodeDetailModal } from './NodeDetailModal';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

const EDGE_STYLE: Record<EdgeKind, { stroke: string; dash?: string; label: string }> = {
    normal: { stroke: '#3b82f6', label: 'Normal Power' },
    backup: { stroke: '#f97316', label: 'Backup Power' },
    control: { stroke: '#22c55e', dash: '4 3', label: 'Control / Monitoring' },
    coolSupply: { stroke: '#14b8a6', label: 'Cooling Supply' },
    coolReturn: { stroke: '#14b8a6', dash: '5 4', label: 'Cooling Return' },
};

/* Lane accent colours (logical view). Symbols + labels recolour by lane; in
 * SLD they render neutral slate. Surfaces prefer CSS vars with a hex fallback
 * so the diagram follows day/night without hardcoding a single palette. */
const LANE_STROKE: Record<DiagBlock['lane'], string> = {
    power: '#3b82f6', gen: '#f97316', cooling: '#14b8a6', it: '#7DDDB4', bms: '#22c55e',
};
const LANE_FILL: Record<DiagBlock['lane'], string> = {
    power: '#1e293b', gen: '#292018', cooling: '#0f2a2a', it: '#1c2440', bms: '#231c38',
};

/* Diagram canvas surfaces — CSS-var-driven with the existing hexes as fallback. */
const BG = 'var(--rz-base, #0b1020)';
const CELL_STROKE = 'var(--rz-border, #334155)';
const LABEL_MAIN = 'var(--rz-text, #e2e8f0)';
const LABEL_SUB = 'var(--rz-text-dim, #94a3b8)';
const SLD_NEUTRAL = '#cbd5e1';

const SYMBOL_SIZE = 44;

function anchor(b: DiagBlock, side: 'l' | 'r') {
    return { x: side === 'l' ? b.x : b.x + b.w, y: b.y + b.h / 2 };
}

function edgePath(from: DiagBlock, to: DiagBlock, offset = 0): string {
    const a = anchor(from, 'r'); const b = anchor(to, 'l');
    // orthogonal H-V-H; when target is to the LEFT (feedback edge), route below
    if (b.x <= a.x) {
        const dropY = Math.max(from.y + from.h, to.y + to.h) + 16 + Math.abs(offset);
        return `M${a.x},${a.y + offset} H${a.x + 10} V${dropY} H${b.x - 10} V${b.y + offset} H${b.x}`;
    }
    const midX = (a.x + b.x) / 2 + offset;
    return `M${a.x},${a.y + offset} H${midX} V${b.y + offset} H${b.x}`;
}

/** Midpoint for an engineering edge label — mirrors edgePath routing: same-row
 *  → above the horizontal run; different rows → at the elbow midpoint;
 *  feedback (target left of source) → above the drop segment. */
function edgeLabelPos(from: DiagBlock, to: DiagBlock, offset = 0): { x: number; y: number } {
    const a = anchor(from, 'r'); const b = anchor(to, 'l');
    if (b.x <= a.x) {
        const dropY = Math.max(from.y + from.h, to.y + to.h) + 16 + Math.abs(offset);
        return { x: (a.x + b.x) / 2, y: dropY - 3 };
    }
    if (Math.abs(a.y - b.y) < 1) return { x: (a.x + b.x) / 2, y: a.y + offset - 4 };
    const midX = (a.x + b.x) / 2 + offset;
    return { x: midX, y: (a.y + b.y) / 2 };
}

export function DiagramSvg({ model, onNodeClick }: { model: DiagramModel; onNodeClick?: (b: DiagBlock) => void }) {
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
    const onDown = (e: React.PointerEvent) => {
        drag.current = { x: e.clientX, y: e.clientY, px: panX, py: panY };
        downPt.current = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e: React.PointerEvent) => {
        if (!drag.current) return;
        set({ panX: drag.current.px + (e.clientX - drag.current.x) / zoom, panY: drag.current.py + (e.clientY - drag.current.y) / zoom });
    };
    const onUp = () => { drag.current = null; };

    const [vx, vy, vw, vh] = model.viewBox;

    /* hover: highlight a node + the edges it touches, dim the rest, show a rich tooltip */
    const wrapRef = React.useRef<HTMLDivElement>(null);
    const [hover, setHover] = React.useState<string | null>(null);
    const [tip, setTip] = React.useState<{ x: number; y: number; b: DiagBlock } | null>(null);
    const connected = React.useMemo(() => {
        if (!hover) return null;
        const nodes = new Set<string>([hover]);
        model.edges.forEach((e) => { if (e.from === hover) nodes.add(e.to); if (e.to === hover) nodes.add(e.from); });
        return nodes;
    }, [hover, model.edges]);
    const enterNode = (b: DiagBlock) => (e: React.PointerEvent) => {
        const r = wrapRef.current?.getBoundingClientRect();
        setHover(b.id);
        setTip({ x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0), b });
    };
    const moveNode = (b: DiagBlock) => (e: React.PointerEvent) => {
        if (drag.current) return;
        const r = wrapRef.current?.getBoundingClientRect();
        setTip({ x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0), b });
    };
    const leaveNode = () => { setHover(null); setTip(null); };

    /* click → subsystem detail modal — opens only on a true click (pointer
     * travelled < 5px between down and up), so a pan-drag never triggers it */
    const downPt = React.useRef<{ x: number; y: number } | null>(null);
    const [detail, setDetail] = React.useState<DiagBlock | null>(null);
    const clickNode = (b: DiagBlock) => (e: React.PointerEvent) => {
        const d = downPt.current;
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) {
            setDetail(b);
            onNodeClick?.(b);
        }
    };

    return (
        <div className="relative" ref={wrapRef}>
            <div className="absolute right-2 top-2 z-10 flex gap-1">
                <button onClick={() => set({ zoom: Math.min(3, zoom * 1.2) })} className="rounded bg-slate-800/80 p-1 text-slate-300 hover:text-white"><ZoomIn className="h-3.5 w-3.5" /></button>
                <button onClick={() => set({ zoom: Math.max(0.5, zoom * 0.85) })} className="rounded bg-slate-800/80 p-1 text-slate-300 hover:text-white"><ZoomOut className="h-3.5 w-3.5" /></button>
                <button onClick={resetView} className="rounded bg-slate-800/80 p-1 text-slate-300 hover:text-white"><Maximize2 className="h-3.5 w-3.5" /></button>
            </div>
            <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} className="w-full cursor-grab rounded-xl active:cursor-grabbing" style={{ background: BG, minHeight: 320 }}
                onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
                <g transform={`translate(${panX},${panY}) scale(${zoom})`} style={{ transformOrigin: 'center' }}>
                    {/* labelled group containment boxes (under everything) */}
                    {model.groups?.map((gr, i) => {
                        // SLD hides cooling/bms NODES; drop their group frame too so no empty box remains
                        if (sld && (gr.lane === 'cooling' || gr.lane === 'bms')) return null;
                        const accent = LANE_STROKE[gr.lane];
                        return (
                            <g key={'grp' + i}>
                                <rect x={gr.x} y={gr.y} width={gr.w} height={gr.h} rx={8}
                                    fill={sld ? 'none' : LANE_FILL[gr.lane]} fillOpacity={sld ? 0 : 0.14}
                                    stroke={accent} strokeWidth={0.9} strokeDasharray="6 4" opacity={0.75}>
                                    <title>{gr.title}</title>
                                </rect>
                                {/* uppercase header on the group top edge */}
                                <text x={gr.x + 12} y={gr.y - 4} fontSize="8" fontWeight={800} letterSpacing="1.1"
                                    fill={accent} style={{ textTransform: 'uppercase' }}>{gr.title}</text>
                            </g>
                        );
                    })}
                    {/* A/B bus bars — thick busbar with junction + tap dots + voltage label */}
                    {model.buses?.map((b, i) => {
                        const c = b.spare ? '#f97316' : '#3b82f6';
                        return (
                            <g key={'bus' + i}>
                                <line x1={b.x1} y1={b.y} x2={b.x2} y2={b.y}
                                    stroke={c} strokeWidth={b.spare ? 2 : 3.4}
                                    strokeDasharray={b.spare ? '4 3' : undefined} opacity={0.95} strokeLinecap="round">
                                    <title>{b.label} — {b.spare ? 'spare trunk (2N+1)' : 'main distribution bus'}</title>
                                </line>
                                <circle cx={b.x1} cy={b.y} r={2.4} fill={c} />
                                <circle cx={b.x2} cy={b.y} r={2.4} fill={c} />
                                <circle cx={(b.x1 + b.x2) / 2} cy={b.y} r={1.6} fill={BG} stroke={b.spare ? '#fb923c' : '#60a5fa'} strokeWidth={0.8} />
                                <text x={(b.x1 + b.x2) / 2} y={b.y - 5} fontSize="6.5" fontWeight={700} textAnchor="middle"
                                    fill={b.spare ? '#fb923c' : '#60a5fa'}>{b.label}</text>
                            </g>
                        );
                    })}
                    {/* edges under blocks */}
                    {model.edges.map((e: DiagEdge, i) => {
                        const from = byId[e.from]; const to = byId[e.to];
                        if (!from || !to) return null;
                        const s = EDGE_STYLE[e.kind];
                        const hidden = sld && (e.kind === 'coolSupply' || e.kind === 'coolReturn' || e.kind === 'control');
                        if (hidden) return null;
                        const on = !hover || e.from === hover || e.to === hover;
                        const stroke = sld ? (e.kind === 'backup' ? '#f97316' : '#94a3b8') : s.stroke;
                        const lp = e.label && !sld ? edgeLabelPos(from, to, e.offset ?? 0) : null;
                        return (
                            <g key={i} opacity={on ? (hover ? 1 : 0.85) : 0.1} style={{ transition: 'opacity .15s' }}>
                                <path d={edgePath(from, to, e.offset ?? 0)} fill="none"
                                    stroke={stroke}
                                    strokeWidth={on && hover ? (sld ? 2.2 : 2.6) : (sld ? 1.4 : 1.6)} strokeDasharray={s.dash}
                                    style={{ transition: 'stroke-width .15s' }} />
                                {/* engineering edge label — supply/return °C + screening flow */}
                                {lp && (
                                    <text x={lp.x} y={lp.y} fontSize="6.5" fontWeight={700} textAnchor="middle" fill={stroke}>{e.label}</text>
                                )}
                            </g>
                        );
                    })}
                    {/* NODES: the engineering symbol IS the node, label BELOW it */}
                    {model.blocks.map((b) => {
                        const hidden = sld && (b.lane === 'cooling' || b.lane === 'bms');
                        if (hidden) return null;
                        const accent = sld ? SLD_NEUTRAL : LANE_STROKE[b.lane];
                        const cx = b.x + b.w / 2;
                        // symbol occupies the upper part of the cell, labels below it
                        const symTop = b.y + 6;
                        const labelY = symTop + SYMBOL_SIZE + 11;
                        const isHover = hover === b.id;
                        const dim = !!connected && !connected.has(b.id);
                        return (
                            <g key={b.id} onPointerEnter={enterNode(b)} onPointerMove={moveNode(b)} onPointerLeave={leaveNode}
                                onPointerUp={clickNode(b)}
                                style={{ opacity: dim ? 0.32 : 1, transition: 'opacity .15s', cursor: 'pointer' }}>
                                {/* hittable cell — faint hairline (dashed = standby unit); lights up on hover */}
                                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6}
                                    fill={isHover ? accent : 'transparent'} fillOpacity={isHover ? 0.08 : 0}
                                    stroke={isHover ? accent : CELL_STROKE} strokeWidth={isHover ? 1.3 : 0.7} strokeOpacity={isHover ? 0.9 : 0.5}
                                    strokeDasharray={b.standby ? '4 3' : undefined}
                                    style={{ transition: 'fill-opacity .15s, stroke .15s' }}>
                                    <title>{b.hover ?? `${b.title}${b.sub ? ` — ${b.sub}` : ''}`}</title>
                                </rect>
                                {b.kind && (
                                    <SymbolGlyph kind={b.kind} x={cx - SYMBOL_SIZE / 2} y={symTop} s={SYMBOL_SIZE} color={accent} sld={sld} />
                                )}
                                {/* real unit count badge (×N) when a stage aggregates many units */}
                                {b.units != null && b.units > 1 && (
                                    <g>
                                        <rect x={b.x + b.w - 26} y={b.y + 5} width={22} height={13} rx={6}
                                            fill={BG} stroke={accent} strokeWidth={0.7} opacity={0.95} />
                                        <text x={b.x + b.w - 15} y={b.y + 14.5} fontSize="8" fontWeight={700} textAnchor="middle" fill={accent}>×{b.units}</text>
                                    </g>
                                )}
                                {/* label below the symbol */}
                                <text x={cx} y={labelY} fontSize="9.5" fontWeight={700} textAnchor="middle" fill={LABEL_MAIN}>{b.title}</text>
                                {b.sub && <text x={cx} y={labelY + 11} fontSize="7.5" textAnchor="middle" fill={LABEL_SUB}>{b.sub}</text>}
                                {b.badge && (b.kind ? (
                                    /* symbol nodes: badge as a top-LEFT corner pill so it never collides with the
                                       title/sub labels below the symbol (units ×N sits top-right) */
                                    <>
                                        <rect x={b.x + 4} y={b.y + 5} width={Math.max(20, b.badge.length * 5 + 8)} height={11} rx={5.5} fill="#7DDDB422" stroke="#7DDDB4" strokeWidth={0.5} />
                                        <text x={b.x + 4 + Math.max(20, b.badge.length * 5 + 8) / 2} y={b.y + 13} fontSize="6.5" textAnchor="middle" fill="#a7f3d0">{b.badge}</text>
                                    </>
                                ) : (
                                    /* label-only nodes (phase boxes): badge centered at the bottom of the box */
                                    <>
                                        <rect x={cx - 20} y={b.y + b.h - 13} width={40} height={11} rx={5.5} fill="#7DDDB422" stroke="#7DDDB4" strokeWidth={0.5} />
                                        <text x={cx} y={b.y + b.h - 4.5} fontSize="6.5" textAnchor="middle" fill="#a7f3d0">{b.badge}</text>
                                    </>
                                ))}
                            </g>
                        );
                    })}
                </g>
            </svg>
            {/* rich hover tooltip — equipment detail, follows the cursor */}
            {tip && (
                <div className="pointer-events-none absolute z-20 max-w-[240px] rounded-lg border px-2.5 py-1.5 text-[11px] shadow-xl"
                    style={{ left: Math.min(tip.x + 14, (wrapRef.current?.clientWidth ?? 400) - 240), top: Math.max(4, tip.y - 8),
                        background: 'var(--rz-elevated, #0f172a)', borderColor: LANE_STROKE[tip.b.lane], color: 'var(--rz-text, #e2e8f0)' }}>
                    <div className="flex items-center gap-1.5 font-semibold">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: LANE_STROKE[tip.b.lane] }} />
                        {tip.b.title}{tip.b.badge ? ` · ${tip.b.badge}` : ''}
                    </div>
                    {tip.b.sub && <div className="mt-0.5 text-slate-400">{tip.b.sub}</div>}
                    {tip.b.hover && tip.b.hover !== tip.b.sub && <div className="mt-1 leading-snug text-slate-300">{tip.b.hover}</div>}
                </div>
            )}
            {/* node-click subsystem detail modal (portal) */}
            {detail && <NodeDetailModal block={detail} model={model} onClose={() => setDetail(null)} />}
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
