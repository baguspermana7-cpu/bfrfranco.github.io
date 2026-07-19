'use client';

/* ─── DYNAMIC SYMBOL PALETTE (Phase AF) ──────────────────────────────────────
 * Data-driven equipment symbol registry: the layout engine composes the
 * diagram ONLY from these parametric glyphs — adding an equipment kind is
 * one registry entry. Each symbol renders a compact 22×22 glyph with a
 * logical skin and an IEC-flavoured SLD skin, inheriting the lane color.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';

export type SymbolKind =
    | 'utility' | 'transformer' | 'switchgear' | 'genset' | 'fuel'
    | 'ups' | 'battery' | 'pdu' | 'rack' | 'fabric'
    | 'chiller' | 'coolingTower' | 'cdu' | 'crah' | 'bms' | 'itload';

export interface SymbolProps { x: number; y: number; s?: number; color: string; sld: boolean }

/* Every glyph draws inside a s×s box anchored at (x,y). Strokes only —
 * matches the thin-line instrumentation character. */
type Glyph = (p: SymbolProps) => React.ReactElement;

const st = (color: string, w = 1.1) => ({ stroke: color, strokeWidth: w, fill: 'none' as const });

export const SYMBOLS: Record<SymbolKind, Glyph> = {
    utility: ({ x, y, s = 22, color }) => (
        <g>{/* pylon */}
            <path d={`M${x + s * 0.5},${y + s * 0.08} L${x + s * 0.2},${y + s * 0.92} M${x + s * 0.5},${y + s * 0.08} L${x + s * 0.8},${y + s * 0.92}`} {...st(color)} />
            <path d={`M${x + s * 0.28},${y + s * 0.42} H${x + s * 0.72} M${x + s * 0.24},${y + s * 0.65} H${x + s * 0.76}`} {...st(color, 0.9)} />
        </g>
    ),
    transformer: ({ x, y, s = 22, color, sld }) => sld ? (
        <g>{/* IEC: two overlapping circles */}
            <circle cx={x + s * 0.5} cy={y + s * 0.36} r={s * 0.24} {...st(color)} />
            <circle cx={x + s * 0.5} cy={y + s * 0.64} r={s * 0.24} {...st(color)} />
        </g>
    ) : (
        <g>
            <rect x={x + s * 0.15} y={y + s * 0.2} width={s * 0.7} height={s * 0.6} rx={2} {...st(color)} />
            <circle cx={x + s * 0.38} cy={y + s * 0.5} r={s * 0.14} {...st(color, 0.9)} />
            <circle cx={x + s * 0.62} cy={y + s * 0.5} r={s * 0.14} {...st(color, 0.9)} />
        </g>
    ),
    switchgear: ({ x, y, s = 22, color, sld }) => (
        <g>
            <rect x={x + s * 0.14} y={y + s * 0.12} width={s * 0.72} height={s * 0.76} rx={sld ? 0 : 2} {...st(color)} />
            {/* breaker: diagonal blade */}
            <path d={`M${x + s * 0.5},${y + s * 0.24} L${x + s * 0.5},${y + s * 0.4} L${x + s * 0.68},${y + s * 0.58} M${x + s * 0.5},${y + s * 0.62} V${y + s * 0.78}`} {...st(color, 1)} />
        </g>
    ),
    genset: ({ x, y, s = 22, color }) => (
        <g>
            <circle cx={x + s * 0.5} cy={y + s * 0.5} r={s * 0.34} {...st(color)} />
            <text x={x + s * 0.5} y={y + s * 0.62} textAnchor="middle" fontSize={s * 0.36} fill={color} fontWeight={700}>G</text>
        </g>
    ),
    fuel: ({ x, y, s = 22, color }) => (
        <g>{/* horizontal tank */}
            <rect x={x + s * 0.12} y={y + s * 0.3} width={s * 0.76} height={s * 0.4} rx={s * 0.2} {...st(color)} />
            <path d={`M${x + s * 0.5},${y + s * 0.3} V${y + s * 0.16}`} {...st(color, 0.9)} />
        </g>
    ),
    ups: ({ x, y, s = 22, color, sld }) => (
        <g>
            <rect x={x + s * 0.12} y={y + s * 0.15} width={s * 0.76} height={s * 0.7} rx={sld ? 0 : 2} {...st(color)} />
            {/* AC~ / =DC halves */}
            <path d={`M${x + s * 0.12},${y + s * 0.5} L${x + s * 0.88},${y + s * 0.5}`} {...st(color, 0.7)} />
            <path d={`M${x + s * 0.24},${y + s * 0.34} q${s * 0.08},-${s * 0.1} ${s * 0.16},0 q${s * 0.08},${s * 0.1} ${s * 0.16},0`} {...st(color, 0.9)} />
            <path d={`M${x + s * 0.26},${y + s * 0.66} H${x + s * 0.5} M${x + s * 0.26},${y + s * 0.74} H${x + s * 0.5}`} {...st(color, 0.9)} />
        </g>
    ),
    battery: ({ x, y, s = 22, color }) => (
        <g>{/* long/short plates */}
            <path d={`M${x + s * 0.3},${y + s * 0.2} V${y + s * 0.8} M${x + s * 0.45},${y + s * 0.35} V${y + s * 0.65} M${x + s * 0.6},${y + s * 0.2} V${y + s * 0.8} M${x + s * 0.75},${y + s * 0.35} V${y + s * 0.65}`} {...st(color, 1.1)} />
        </g>
    ),
    pdu: ({ x, y, s = 22, color }) => (
        <g>
            <rect x={x + s * 0.18} y={y + s * 0.15} width={s * 0.64} height={s * 0.7} rx={2} {...st(color)} />
            {[0.35, 0.5, 0.65].map((f) => <circle key={f} cx={x + s * 0.5} cy={y + s * f} r={s * 0.05} fill={color} />)}
        </g>
    ),
    rack: ({ x, y, s = 22, color }) => (
        <g>
            <rect x={x + s * 0.2} y={y + s * 0.1} width={s * 0.6} height={s * 0.8} rx={1.5} {...st(color)} />
            {[0.28, 0.44, 0.6, 0.76].map((f) => <path key={f} d={`M${x + s * 0.26},${y + s * f} H${x + s * 0.74}`} {...st(color, 0.7)} />)}
        </g>
    ),
    fabric: ({ x, y, s = 22, color }) => (
        <g>{/* spine-leaf cross links */}
            {[0.3, 0.7].map((fx) => <circle key={'s' + fx} cx={x + s * fx} cy={y + s * 0.25} r={s * 0.09} {...st(color)} />)}
            {[0.2, 0.5, 0.8].map((fx) => <circle key={'l' + fx} cx={x + s * fx} cy={y + s * 0.75} r={s * 0.09} {...st(color)} />)}
            {[0.3, 0.7].map((sx) => [0.2, 0.5, 0.8].map((lx) => (
                <path key={sx + '-' + lx} d={`M${x + s * sx},${y + s * 0.34} L${x + s * lx},${y + s * 0.66}`} {...st(color, 0.55)} />
            )))}
        </g>
    ),
    chiller: ({ x, y, s = 22, color }) => (
        <g>
            <rect x={x + s * 0.12} y={y + s * 0.22} width={s * 0.76} height={s * 0.56} rx={2} {...st(color)} />
            <circle cx={x + s * 0.35} cy={y + s * 0.5} r={s * 0.13} {...st(color, 0.9)} />
            <path d={`M${x + s * 0.55},${y + s * 0.38} v${s * 0.24} m${s * 0.12},-${s * 0.24} v${s * 0.24}`} {...st(color, 0.9)} />
        </g>
    ),
    coolingTower: ({ x, y, s = 22, color }) => (
        <g>{/* hyperbolic profile + fan */}
            <path d={`M${x + s * 0.25},${y + s * 0.88} C${x + s * 0.38},${y + s * 0.5} ${x + s * 0.38},${y + s * 0.4} ${x + s * 0.3},${y + s * 0.14} H${x + s * 0.7} C${x + s * 0.62},${y + s * 0.4} ${x + s * 0.62},${y + s * 0.5} ${x + s * 0.75},${y + s * 0.88} Z`} {...st(color)} />
            <path d={`M${x + s * 0.4},${y + s * 0.24} h${s * 0.2} M${x + s * 0.5},${y + s * 0.14} v${s * 0.2}`} {...st(color, 0.8)} />
        </g>
    ),
    cdu: ({ x, y, s = 22, color }) => (
        <g>{/* pump circle + HX plates */}
            <circle cx={x + s * 0.32} cy={y + s * 0.5} r={s * 0.16} {...st(color)} />
            <path d={`M${x + s * 0.32},${y + s * 0.34} L${x + s * 0.44},${y + s * 0.5} L${x + s * 0.32},${y + s * 0.66}`} {...st(color, 0.8)} />
            <path d={`M${x + s * 0.58},${y + s * 0.28} v${s * 0.44} m${s * 0.09},-${s * 0.44} v${s * 0.44} m${s * 0.09},-${s * 0.44} v${s * 0.44}`} {...st(color, 0.9)} />
        </g>
    ),
    crah: ({ x, y, s = 22, color }) => (
        <g>
            <rect x={x + s * 0.15} y={y + s * 0.15} width={s * 0.7} height={s * 0.7} rx={2} {...st(color)} />
            <circle cx={x + s * 0.5} cy={y + s * 0.5} r={s * 0.2} {...st(color, 0.9)} />
            <path d={`M${x + s * 0.5},${y + s * 0.32} L${x + s * 0.62},${y + s * 0.6} L${x + s * 0.38},${y + s * 0.6} Z`} {...st(color, 0.7)} />
        </g>
    ),
    bms: ({ x, y, s = 22, color }) => (
        <g>
            <rect x={x + s * 0.14} y={y + s * 0.18} width={s * 0.72} height={s * 0.5} rx={2} {...st(color)} />
            <path d={`M${x + s * 0.22},${y + s * 0.5} l${s * 0.12},-${s * 0.14} l${s * 0.12},${s * 0.2} l${s * 0.12},-${s * 0.12} l${s * 0.12},${s * 0.06}`} {...st(color, 0.9)} />
            <path d={`M${x + s * 0.4},${y + s * 0.68} v${s * 0.14} h${s * 0.2} v-${s * 0.14}`} {...st(color, 0.8)} />
        </g>
    ),
    itload: ({ x, y, s = 22, color }) => (
        <g>
            <rect x={x + s * 0.16} y={y + s * 0.2} width={s * 0.68} height={s * 0.46} rx={2} {...st(color)} />
            <path d={`M${x + s * 0.34},${y + s * 0.78} h${s * 0.32} M${x + s * 0.5},${y + s * 0.66} v${s * 0.12}`} {...st(color, 0.9)} />
            <text x={x + s * 0.5} y={y + s * 0.5} textAnchor="middle" fontSize={s * 0.24} fill={color} fontWeight={700}>IT</text>
        </g>
    ),
};

export function SymbolGlyph({ kind, ...p }: SymbolProps & { kind: SymbolKind }) {
    const G = SYMBOLS[kind];
    return G ? G(p) : null;
}
