/* ─── score-color (Workstream M) ─────────────────────────────────────────────
 * ONE shared semantic color scale for every score/parameter (owner mandate:
 * "risk 17/100 lower is better → thin green; gradient to red when bad").
 * Continuous interpolation across the instrument palette:
 *   good  →  data-green  #00FF88
 *   mid   →  signal-amber #FFAA00
 *   bad   →  fault-red   #FF3030
 * direction: 'higher' = higher is better (health/score), 'lower' = lower is
 * better (risk/cost indexes). Replaces the per-page ad-hoc color maps.
 * ──────────────────────────────────────────────────────────────────────── */

export interface ScoreScaleOpts {
    direction?: 'higher' | 'lower';
    /** scale maximum (default 100) — e.g. 25 for a /25 sub-score */
    max?: number;
    min?: number;
}

const GOOD = [0x00, 0xff, 0x88];
const MID = [0xff, 0xaa, 0x00];
const BAD = [0xff, 0x30, 0x30];

function mix(a: number[], b: number[], t: number): string {
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** goodness 0..1 (1 = best) for a value under the given direction/scale. */
export function scoreGoodness(value: number, opts: ScoreScaleOpts = {}): number {
    const { direction = 'higher', max = 100, min = 0 } = opts;
    const t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
    return direction === 'higher' ? t : 1 - t;
}

/** Continuous hex color for a score value. */
export function scoreColor(value: number, opts: ScoreScaleOpts = {}): string {
    const g = scoreGoodness(value, opts);
    return g >= 0.5 ? mix(MID, GOOD, (g - 0.5) * 2) : mix(BAD, MID, g * 2);
}

export type ScoreBand = 'good' | 'watch' | 'bad';

/** Discrete band for chips/thresholds (good ≥ 0.7 · watch ≥ 0.4 · bad below). */
export function scoreBand(value: number, opts: ScoreScaleOpts = {}): ScoreBand {
    const g = scoreGoodness(value, opts);
    return g >= 0.7 ? 'good' : g >= 0.4 ? 'watch' : 'bad';
}

export const BAND_CHIP: Record<ScoreBand, string> = {
    good: 'bg-rz-data/10 text-rz-data border-rz-data/30',
    watch: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    bad: 'bg-rz-alert/10 text-rz-alert border-rz-alert/30',
};
