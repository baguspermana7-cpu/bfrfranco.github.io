'use client';

/* ─── DYNAMIC SYMBOL PALETTE (Phase AF + BB visual-depth round) ──────────────
 * Data-driven equipment symbol registry: the layout engine composes the
 * diagram ONLY from these parametric glyphs — adding an equipment kind is
 * one registry entry. Each symbol renders a compact 22×22 glyph with a
 * logical skin and an IEC-flavoured SLD skin, inheriting the lane color.
 * BB round: second-order detail — transformer winding coil pairs, genset
 * engine+alternator, UPS with integrated battery cells, chiller compressor+
 * evap/cond barrels, rack U-unit grid, fuel saddle tank, tower fill louvers.
 * Strokes only — thin-line instrumentation character preserved.
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

/* winding coil: n semicircle bumps along a horizontal run (IEC inductor idiom) */
const coil = (x: number, y: number, w: number, n: number, up: boolean) => {
    const r = w / (2 * n);
    let d = `M${x},${y}`;
    for (let i = 0; i < n; i++) d += ` a${r},${r} 0 0 ${up ? 1 : 0} ${2 * r},0`;
    return d;
};

export const SYMBOLS: Record<SymbolKind, Glyph> = {
    utility: ({ x, y, s = 22, color }) => (
        <g>{/* transmission pylon: lattice mast + cross-arms + insulator drops */}
            <path d={`M${x + s * 0.5},${y + s * 0.06} L${x + s * 0.22},${y + s * 0.92} M${x + s * 0.5},${y + s * 0.06} L${x + s * 0.78},${y + s * 0.92}`} {...st(color)} />
            <path d={`M${x + s * 0.36},${y + s * 0.5} L${x + s * 0.64},${y + s * 0.72} M${x + s * 0.64},${y + s * 0.5} L${x + s * 0.36},${y + s * 0.72}`} {...st(color, 0.6)} />
            <path d={`M${x + s * 0.16},${y + s * 0.34} H${x + s * 0.84} M${x + s * 0.24},${y + s * 0.58} H${x + s * 0.76}`} {...st(color, 0.9)} />
            <path d={`M${x + s * 0.2},${y + s * 0.34} v${s * 0.08} M${x + s * 0.8},${y + s * 0.34} v${s * 0.08}`} {...st(color, 0.7)} />
        </g>
    ),
    transformer: ({ x, y, s = 22, color, sld }) => sld ? (
        <g>{/* IEC: two overlapping circles */}
            <circle cx={x + s * 0.5} cy={y + s * 0.36} r={s * 0.24} {...st(color)} />
            <circle cx={x + s * 0.5} cy={y + s * 0.64} r={s * 0.24} {...st(color)} />
        </g>
    ) : (
        <g>{/* primary/secondary winding coil pairs + core bars between */}
            <rect x={x + s * 0.1} y={y + s * 0.12} width={s * 0.8} height={s * 0.76} rx={2} {...st(color, 0.9)} />
            <path d={coil(x + s * 0.2, y + s * 0.34, s * 0.6, 3, true)} {...st(color, 1)} />
            <path d={`M${x + s * 0.22},${y + s * 0.46} H${x + s * 0.78} M${x + s * 0.22},${y + s * 0.54} H${x + s * 0.78}`} {...st(color, 0.7)} />
            <path d={coil(x + s * 0.2, y + s * 0.66, s * 0.6, 3, false)} {...st(color, 1)} />
        </g>
    ),
    switchgear: ({ x, y, s = 22, color, sld }) => (
        <g>
            <rect x={x + s * 0.14} y={y + s * 0.12} width={s * 0.72} height={s * 0.76} rx={sld ? 0 : 2} {...st(color)} />
            {/* breaker: diagonal blade + contact dots */}
            <path d={`M${x + s * 0.5},${y + s * 0.2} V${y + s * 0.38} M${x + s * 0.5},${y + s * 0.4} L${x + s * 0.68},${y + s * 0.56} M${x + s * 0.5},${y + s * 0.62} V${y + s * 0.8}`} {...st(color, 1)} />
            <circle cx={x + s * 0.5} cy={y + s * 0.4} r={s * 0.035} fill={color} />
            <circle cx={x + s * 0.5} cy={y + s * 0.62} r={s * 0.035} fill={color} />
        </g>
    ),
    genset: ({ x, y, s = 22, color }) => (
        <g>{/* engine block + shaft + alternator "G" circle (real genset idiom) */}
            <rect x={x + s * 0.08} y={y + s * 0.3} width={s * 0.36} height={s * 0.42} rx={1.5} {...st(color)} />
            <path d={`M${x + s * 0.14},${y + s * 0.3} v-${s * 0.08} h${s * 0.08} M${x + s * 0.3},${y + s * 0.3} v-${s * 0.08} h${s * 0.08}`} {...st(color, 0.7)} />
            <path d={`M${x + s * 0.44},${y + s * 0.51} H${x + s * 0.54}`} {...st(color, 1.2)} />
            <circle cx={x + s * 0.72} cy={y + s * 0.51} r={s * 0.2} {...st(color)} />
            <text x={x + s * 0.72} y={y + s * 0.58} textAnchor="middle" fontSize={s * 0.24} fill={color} fontWeight={700}>G</text>
        </g>
    ),
    fuel: ({ x, y, s = 22, color }) => (
        <g>{/* saddle tank + level line + fill stub */}
            <rect x={x + s * 0.1} y={y + s * 0.28} width={s * 0.8} height={s * 0.42} rx={s * 0.21} {...st(color)} />
            <path d={`M${x + s * 0.18},${y + s * 0.52} H${x + s * 0.82}`} {...st(color, 0.6)} strokeDasharray="2 1.6" />
            <path d={`M${x + s * 0.5},${y + s * 0.28} V${y + s * 0.14} h${s * 0.1}`} {...st(color, 0.9)} />
            <path d={`M${x + s * 0.24},${y + s * 0.7} v${s * 0.14} M${x + s * 0.76},${y + s * 0.7} v${s * 0.14}`} {...st(color, 0.9)} />
        </g>
    ),
    ups: ({ x, y, s = 22, color, sld }) => (
        <g>{/* AC~/=DC converter halves + INTEGRATED battery cell stack on the right */}
            <rect x={x + s * 0.06} y={y + s * 0.15} width={s * 0.58} height={s * 0.7} rx={sld ? 0 : 2} {...st(color)} />
            <path d={`M${x + s * 0.06},${y + s * 0.5} L${x + s * 0.64},${y + s * 0.5}`} {...st(color, 0.7)} />
            <path d={`M${x + s * 0.14},${y + s * 0.34} q${s * 0.07},-${s * 0.1} ${s * 0.14},0 q${s * 0.07},${s * 0.1} ${s * 0.14},0`} {...st(color, 0.9)} />
            <path d={`M${x + s * 0.16},${y + s * 0.64} H${x + s * 0.4} M${x + s * 0.16},${y + s * 0.72} H${x + s * 0.4}`} {...st(color, 0.9)} />
            {/* battery stack: 3 cells + terminal */}
            <rect x={x + s * 0.72} y={y + s * 0.24} width={s * 0.2} height={s * 0.58} rx={1} {...st(color, 0.8)} />
            <path d={`M${x + s * 0.72},${y + s * 0.43} H${x + s * 0.92} M${x + s * 0.72},${y + s * 0.62} H${x + s * 0.92}`} {...st(color, 0.6)} />
            <path d={`M${x + s * 0.78},${y + s * 0.24} v-${s * 0.06} h${s * 0.08} v${s * 0.06}`} {...st(color, 0.7)} />
            <path d={`M${x + s * 0.64},${y + s * 0.5} H${x + s * 0.72}`} {...st(color, 0.8)} />
        </g>
    ),
    battery: ({ x, y, s = 22, color }) => (
        <g>{/* long/short plates */}
            <path d={`M${x + s * 0.3},${y + s * 0.2} V${y + s * 0.8} M${x + s * 0.45},${y + s * 0.35} V${y + s * 0.65} M${x + s * 0.6},${y + s * 0.2} V${y + s * 0.8} M${x + s * 0.75},${y + s * 0.35} V${y + s * 0.65}`} {...st(color, 1.1)} />
        </g>
    ),
    pdu: ({ x, y, s = 22, color }) => (
        <g>{/* cabinet + breaker rows + outlet dots */}
            <rect x={x + s * 0.18} y={y + s * 0.12} width={s * 0.64} height={s * 0.76} rx={2} {...st(color)} />
            <path d={`M${x + s * 0.26},${y + s * 0.3} H${x + s * 0.74} M${x + s * 0.26},${y + s * 0.44} H${x + s * 0.74}`} {...st(color, 0.6)} />
            {[0.6, 0.74].map((f) => (
                <g key={f}>
                    <circle cx={x + s * 0.34} cy={y + s * f} r={s * 0.045} fill={color} />
                    <circle cx={x + s * 0.5} cy={y + s * f} r={s * 0.045} fill={color} />
                    <circle cx={x + s * 0.66} cy={y + s * f} r={s * 0.045} fill={color} />
                </g>
            ))}
        </g>
    ),
    rack: ({ x, y, s = 22, color }) => (
        <g>{/* U-unit grid: dense shelf rows + vertical rails */}
            <rect x={x + s * 0.18} y={y + s * 0.06} width={s * 0.64} height={s * 0.88} rx={1.5} {...st(color)} />
            <path d={`M${x + s * 0.26},${y + s * 0.06} V${y + s * 0.94} M${x + s * 0.74},${y + s * 0.06} V${y + s * 0.94}`} {...st(color, 0.5)} />
            {[0.18, 0.3, 0.42, 0.54, 0.66, 0.78].map((f) => <path key={f} d={`M${x + s * 0.26},${y + s * f} H${x + s * 0.74}`} {...st(color, 0.6)} />)}
            <circle cx={x + s * 0.68} cy={y + s * 0.24} r={s * 0.025} fill={color} />
            <circle cx={x + s * 0.68} cy={y + s * 0.48} r={s * 0.025} fill={color} />
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
        <g>{/* evap + cond barrels + compressor circle on top (centrifugal idiom) */}
            <rect x={x + s * 0.1} y={y + s * 0.4} width={s * 0.8} height={s * 0.2} rx={s * 0.1} {...st(color, 0.9)} />
            <rect x={x + s * 0.1} y={y + s * 0.66} width={s * 0.8} height={s * 0.2} rx={s * 0.1} {...st(color, 0.9)} />
            <circle cx={x + s * 0.5} cy={y + s * 0.24} r={s * 0.13} {...st(color)} />
            <path d={`M${x + s * 0.44},${y + s * 0.24} L${x + s * 0.56},${y + s * 0.18} V${y + s * 0.3} Z`} {...st(color, 0.6)} />
            <path d={`M${x + s * 0.3},${y + s * 0.37} V${y + s * 0.4} M${x + s * 0.7},${y + s * 0.37} V${y + s * 0.4} M${x + s * 0.3},${y + s * 0.6} V${y + s * 0.66} M${x + s * 0.7},${y + s * 0.6} V${y + s * 0.66}`} {...st(color, 0.7)} />
        </g>
    ),
    coolingTower: ({ x, y, s = 22, color }) => (
        <g>{/* hyperbolic profile + fan cross + fill louvers */}
            <path d={`M${x + s * 0.25},${y + s * 0.88} C${x + s * 0.38},${y + s * 0.5} ${x + s * 0.38},${y + s * 0.4} ${x + s * 0.3},${y + s * 0.14} H${x + s * 0.7} C${x + s * 0.62},${y + s * 0.4} ${x + s * 0.62},${y + s * 0.5} ${x + s * 0.75},${y + s * 0.88} Z`} {...st(color)} />
            <circle cx={x + s * 0.5} cy={y + s * 0.24} r={s * 0.1} {...st(color, 0.7)} />
            <path d={`M${x + s * 0.42},${y + s * 0.24} h${s * 0.16} M${x + s * 0.5},${y + s * 0.16} v${s * 0.16}`} {...st(color, 0.8)} />
            <path d={`M${x + s * 0.33},${y + s * 0.66} h${s * 0.34} M${x + s * 0.31},${y + s * 0.74} h${s * 0.38}`} {...st(color, 0.55)} />
        </g>
    ),
    cdu: ({ x, y, s = 22, color }) => (
        <g>{/* pump circle + flow arrow + brazed-plate HX stack */}
            <circle cx={x + s * 0.3} cy={y + s * 0.5} r={s * 0.17} {...st(color)} />
            <path d={`M${x + s * 0.3},${y + s * 0.33} L${x + s * 0.44},${y + s * 0.5} L${x + s * 0.3},${y + s * 0.67}`} {...st(color, 0.8)} />
            <rect x={x + s * 0.56} y={y + s * 0.26} width={s * 0.32} height={s * 0.48} rx={1} {...st(color, 0.8)} />
            <path d={`M${x + s * 0.64},${y + s * 0.26} V${y + s * 0.74} M${x + s * 0.72},${y + s * 0.26} V${y + s * 0.74} M${x + s * 0.8},${y + s * 0.26} V${y + s * 0.74}`} {...st(color, 0.6)} />
        </g>
    ),
    crah: ({ x, y, s = 22, color }) => (
        <g>{/* cabinet + fan wheel + airflow arrows */}
            <rect x={x + s * 0.15} y={y + s * 0.12} width={s * 0.7} height={s * 0.76} rx={2} {...st(color)} />
            <circle cx={x + s * 0.5} cy={y + s * 0.42} r={s * 0.18} {...st(color, 0.9)} />
            <path d={`M${x + s * 0.5},${y + s * 0.28} L${x + s * 0.6},${y + s * 0.52} L${x + s * 0.4},${y + s * 0.52} Z`} {...st(color, 0.6)} />
            <path d={`M${x + s * 0.32},${y + s * 0.74} h${s * 0.1} m${s * 0.08},0 h${s * 0.1} m${s * 0.08},0 h${s * 0.1}`} {...st(color, 0.7)} />
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
