'use client';

/* ─── ScoreValue (Workstream M) — the 100%-coverage score primitive ──────────
 * OWNER MANDATE: every score/parameter carries (1) the ƒx TRACE tooltip
 * (where the number comes from — TraceValue chain), (2) an EXPLANATION
 * tooltip (what the score is + what it shows — Explain DB key or detailed
 * tip), and (3) SEMANTIC VALUE COLOR (continuous green→amber→red gradient,
 * direction-aware: risk scores are lower-better). One component, adopted
 * everywhere — never re-implement per page.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { TraceValue } from '@/components/ui/TraceValue';
import type { InlineTrace } from '@/lib/value-trace';
import { Explain } from '@/components/ui/Explain';
import { Tooltip } from '@/components/ui/Tooltip';
import { scoreColor, scoreBand, BAND_CHIP, type ScoreScaleOpts } from '@/lib/score-color';

export interface ScoreValueProps {
    /** numeric score for the color scale */
    value: number;
    /** rendered text (defaults to the number) — e.g. "17" while unit shows "/100" */
    display?: React.ReactNode;
    unit?: string;
    /** 'higher' = higher is better (default) · 'lower' = lower is better (risk) */
    direction?: 'higher' | 'lower';
    /** scale max (default 100) — e.g. 25 for a /25 sub-score */
    max?: number;
    /** value-trace id → ƒx trace tooltip; omit when no trace node exists (yet) */
    traceId?: string;
    /** inline trace spec → ƒx for per-row / component-local values the registry can't reach */
    trace?: InlineTrace;
    /** RZ_EXPLAIN_DB key → rich explanation tooltip */
    explainKey?: string;
    /** detailed fallback tip when no DB key exists */
    tip?: string;
    /** optional grade/category chip text (A/B/C, Low/High, Easy/Difficult) */
    grade?: string;
    className?: string;
}

export function ScoreValue({ value, display, unit, direction = 'higher', max = 100, traceId, trace, explainKey, tip, grade, className = '' }: ScoreValueProps) {
    const color = Number.isFinite(value) ? scoreColor(value, { direction, max }) : undefined;
    const band = Number.isFinite(value) ? scoreBand(value, { direction, max }) : 'watch';
    const num = (
        <span className={`font-bold tabular-nums ${className}`} style={color ? { color } : undefined}>
            {display ?? value}
            {unit && <span className="ml-0.5 text-[0.7em] font-semibold opacity-70">{unit}</span>}
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1">
            {traceId || trace ? <TraceValue traceId={traceId} trace={trace}>{num}</TraceValue> : num}
            {grade && <span className={`rounded border px-1 py-0.5 text-[9px] font-bold ${BAND_CHIP[band]}`}>{grade}</span>}
            {explainKey ? <Explain k={explainKey} /> : tip ? <Tooltip content={tip} /> : null}
        </span>
    );
}

export default ScoreValue;
