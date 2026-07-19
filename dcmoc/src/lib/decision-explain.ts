/* ─── DECISION EXPLAIN (owner mandate: no naked NO-GO chips) ────────────────
 * Every GO / NO-GO verdict must carry (a) a computed REASON with the live
 * numbers behind it and (b) a QUANTIFIED list of what must change — each
 * lever found by deterministic bisection on the SAME cashflow model the page
 * already uses. The page passes a `recompute` closure wrapping its own
 * calculateFinancials call; this module never re-implements the cashflow
 * math and never fabricates a number. Pure functions, no randomness.
 * ──────────────────────────────────────────────────────────────────────── */

import { fmtMoney, fmtPct } from '@/lib/format';

export interface DecisionLever {
    /** Short headline, e.g. "Revenue +23%" */
    label: string;
    /** Full quantified sentence with target values. */
    detail: string;
    /** Shell tab to navigate to for fine-tuning this parameter. */
    targetTab: string;
    /** Optional same-page element id — scroll/focus this input instead of a tab hop. */
    targetSelector?: string;
    /** HIGH = solved lever that reaches the threshold; MED = quantified honesty note. */
    priority?: 'HIGH' | 'MED';
}

export interface DecisionExplain {
    verdict: 'go' | 'no-go';
    /** One computed sentence: why the verdict is what it is, with live numbers. */
    reason: string;
    /** Quantified "what must change" rows (NO-GO) or headroom notes (GO). */
    levers: DecisionLever[];
}

export interface DecisionExplainInput {
    irrPct: number;
    hurdlePct: number;
    npv: number;
    capex: number;
    payback: number;
    /** Base revenue rate the model uses, for rendering absolute targets ($ /kW/mo). */
    revenuePerKwMonth?: number;
    /** Re-runs the page's own cashflow model with scaled revenue / capex. */
    recompute: (mods: { revMult?: number; capexMult?: number }) => { irrPct: number; npv: number };
}

/* Search bounds — beyond these the honest answer is "structure, not tuning". */
const REV_MULT_MAX = 2.5;   // +150% revenue
const CAPEX_MULT_MIN = 0.4; // −60% CAPEX
const REV_HEADROOM_MIN = 0.4; // GO downside probe: −60% revenue
const BISECT_ITERS = 36;    // 2^-36 interval — deterministic, cheap
const TYPICAL_HURDLE_PCT = 10;

/**
 * Bisect for the smallest x in [lo, hi] where `pred(x)` is true.
 * Contract: pred is monotonic (false → true across [lo, hi]) and pred(hi) is
 * true (caller checks the bound first). Returns the upper bracket after
 * BISECT_ITERS halvings.
 */
const bisectMin = (lo: number, hi: number, pred: (x: number) => boolean): number => {
    let a = lo;
    let b = hi;
    for (let i = 0; i < BISECT_ITERS; i++) {
        const mid = (a + b) / 2;
        if (pred(mid)) b = mid;
        else a = mid;
    }
    return b;
};

/** Minimum revenue multiplier (≥1) reaching the hurdle, or null if unreachable in-bounds. */
const solveRevenueUplift = (input: DecisionExplainInput): number | null => {
    const reaches = (m: number): boolean => input.recompute({ revMult: m }).irrPct >= input.hurdlePct;
    if (!reaches(REV_MULT_MAX)) return null;
    if (reaches(1)) return 1;
    return bisectMin(1, REV_MULT_MAX, reaches);
};

/** Minimum CAPEX reduction fraction (0..0.6) reaching the hurdle, or null if unreachable. */
const solveCapexCut = (input: DecisionExplainInput): number | null => {
    const reaches = (cut: number): boolean => input.recompute({ capexMult: 1 - cut }).irrPct >= input.hurdlePct;
    const maxCut = 1 - CAPEX_MULT_MIN;
    if (!reaches(maxCut)) return null;
    if (reaches(0)) return 0;
    return bisectMin(0, maxCut, reaches);
};

/** GO case: how far revenue can FALL before breaching the hurdle (fraction 0..0.6, or null = still GO at −60%). */
const solveRevenueHeadroom = (input: DecisionExplainInput): number | null => {
    const breaches = (drop: number): boolean => input.recompute({ revMult: 1 - drop }).irrPct < input.hurdlePct;
    const maxDrop = 1 - REV_HEADROOM_MIN;
    if (!breaches(maxDrop)) return null; // rock solid even at −60%
    if (breaches(0)) return 0;
    // smallest drop that breaches → headroom is just under it
    return bisectMin(0, maxDrop, breaches);
};

/**
 * Explain one phase (or the blended portfolio) GO / NO-GO verdict.
 * Deterministic: same inputs → same output. All lever numbers come from
 * re-running the caller's own cashflow model via `recompute`.
 */
export function explainPhaseDecision(input: DecisionExplainInput): DecisionExplain {
    const { irrPct, hurdlePct, npv, capex, payback } = input;
    const verdict: DecisionExplain['verdict'] = irrPct >= hurdlePct ? 'go' : 'no-go';
    const revBase = input.revenuePerKwMonth;

    if (verdict === 'go') {
        const reason =
            `GO karena IRR ${fmtPct(irrPct)} ≥ hurdle ${fmtPct(hurdlePct, 0)} dengan NPV ${fmtMoney(npv)}` +
            (Number.isFinite(payback) && payback > 0 ? ` dan payback ${payback.toFixed(1)} th` : '') +
            ' pada discount rate yang dipakai.';

        const levers: DecisionLever[] = [];
        const headroom = solveRevenueHeadroom(input);
        if (headroom === null) {
            levers.push({
                label: 'Headroom revenue > 60%',
                detail: `Sangat kokoh — bahkan revenue −60% (ke ${revBase ? fmtMoney(revBase * REV_HEADROOM_MIN) + '/kW/bln' : '40% dari basis'}) IRR masih ≥ hurdle ${fmtPct(hurdlePct, 0)}.`,
                targetTab: 'finance',
            });
        } else {
            const dropPct = headroom * 100;
            levers.push({
                label: `Headroom revenue −${dropPct.toFixed(0)}%`,
                detail: `Revenue bisa turun hingga −${dropPct.toFixed(1)}%` +
                    (revBase ? ` (ke ${fmtMoney(revBase * (1 - headroom))}/kW/bln)` : '') +
                    ` sebelum IRR jatuh di bawah hurdle ${fmtPct(hurdlePct, 0)} — buffer terhadap asumsi tarif/okupansi.`,
                targetTab: 'finance',
            });
        }
        return { verdict, reason, levers };
    }

    // ── NO-GO ──
    const reason =
        `NO-GO karena IRR ${fmtPct(irrPct)} < hurdle ${fmtPct(hurdlePct, 0)}` +
        (npv < 0 ? ` dan NPV ${fmtMoney(npv)} negatif pada discount rate yang dipakai` : ` meski NPV ${fmtMoney(npv)} positif`) +
        '.';

    const levers: DecisionLever[] = [];

    const revMult = solveRevenueUplift(input);
    if (revMult === null) {
        levers.push({
            label: 'Revenue: struktur biaya perlu ditinjau',
            detail: `Bahkan +${((REV_MULT_MAX - 1) * 100).toFixed(0)}% revenue tidak mencapai hurdle ${fmtPct(hurdlePct, 0)} — struktur biaya (CAPEX + OPEX adders) perlu ditinjau, bukan sekadar tarif.`,
            targetTab: 'finance',
        });
    } else if (revMult > 1) {
        const upPct = (revMult - 1) * 100;
        const check = input.recompute({ revMult });
        levers.push({
            label: `Revenue +${upPct.toFixed(0)}%`,
            detail: `Revenue perlu naik +${upPct.toFixed(1)}%` +
                (revBase ? ` (ke ${fmtMoney(revBase * revMult)}/kW/bln dari ${fmtMoney(revBase)})` : '') +
                ` agar IRR mencapai ${fmtPct(check.irrPct)} ≥ hurdle ${fmtPct(hurdlePct, 0)}.`,
            targetTab: 'finance',
        });
    }

    const capexCut = solveCapexCut(input);
    if (capexCut === null) {
        levers.push({
            label: 'CAPEX: pengurangan saja tidak cukup',
            detail: `Bahkan CAPEX −${((1 - CAPEX_MULT_MIN) * 100).toFixed(0)}% (ke ${fmtMoney(capex * CAPEX_MULT_MIN)}) tidak mencapai hurdle ${fmtPct(hurdlePct, 0)} — sisi pendapatan/OPEX yang mengikat.`,
            targetTab: 'capex',
        });
    } else if (capexCut > 0) {
        const check = input.recompute({ capexMult: 1 - capexCut });
        levers.push({
            label: `CAPEX −${(capexCut * 100).toFixed(0)}%`,
            detail: `ATAU CAPEX turun −${(capexCut * 100).toFixed(1)}% (ke ${fmtMoney(capex * (1 - capexCut))} dari ${fmtMoney(capex)}) agar IRR mencapai ${fmtPct(check.irrPct)} ≥ hurdle ${fmtPct(hurdlePct, 0)}.`,
            targetTab: 'capex',
        });
    }

    // Informational screening note: passes a typical 10% hurdle but not the chosen one.
    if (hurdlePct > TYPICAL_HURDLE_PCT && irrPct >= TYPICAL_HURDLE_PCT) {
        levers.push({
            label: `Layak pada hurdle ${TYPICAL_HURDLE_PCT}%`,
            detail: `IRR ${fmtPct(irrPct)} melewati hurdle tipikal ${TYPICAL_HURDLE_PCT}% tetapi di bawah hurdle terpilih ${fmtPct(hurdlePct, 0)} — verdict sensitif terhadap pilihan hurdle (screening, bukan kegagalan absolut).`,
            targetTab: 'finance',
        });
    }

    return { verdict, reason, levers };
}

/* ─── GENERIC THRESHOLD-METRIC EXPLAIN (owner mandate rollout) ──────────────
 * Any pass/fail metric (DSCR vs covenant, equity IRR vs target, payback vs
 * limit, availability vs tier target, …) gets the same treatment as the
 * phase GO/NO-GO: a computed reason with the live numbers, plus levers whose
 * magnitudes are SOLVED by bisection against the caller's own model via
 * `metricAt` closures. Nothing here re-implements or fabricates model math.
 * ──────────────────────────────────────────────────────────────────────── */

export interface ThresholdLeverSpec {
    /**
     * Lever-magnitude search bounds. Contract: `metricAt` is monotonic toward
     * passing across [lo, hi]; lo = current config (fails the threshold),
     * hi = the strongest realistic move. The solver bisects for the SMALLEST
     * magnitude that passes; if even `hi` fails, `unreachable` renders an
     * honest quantified note instead.
     */
    lo: number;
    hi: number;
    /** Re-runs the caller's own model at lever magnitude x → metric value. */
    metricAt: (x: number) => number;
    /** Renders the solved lever (x = minimal passing magnitude, achieved = metricAt(x)). */
    render: (x: number, achieved: number) => { label: string; detail: string };
    /** Rendered when even x = hi does not pass (receives metricAt(hi)). */
    unreachable?: (atHi: number) => { label: string; detail: string };
    /** Shell tab where this parameter is fine-tuned. */
    targetTab: string;
    /** Optional same-page element id — scroll/focus beats a tab hop. */
    targetSelector?: string;
}

export interface ThresholdMetricInput {
    /** e.g. "Min DSCR" */
    metricLabel: string;
    /** Live computed value from the page's model. */
    value: number;
    threshold: number;
    /** Pass when value ≥ threshold ('atLeast') or ≤ threshold ('atMost'). */
    direction: 'atLeast' | 'atMost';
    fmtValue: (v: number) => string;
    /** Live-number computed cause, e.g. "debt service $8.1M vs EBITDA $9.0M pada debt ratio 65%". */
    because?: string;
    levers: ThresholdLeverSpec[];
}

export interface ThresholdMetricExplain {
    pass: boolean;
    /** One computed sentence with the live numbers behind the verdict. */
    reason: string;
    /** Solved (HIGH) + honesty-note (MED) levers; empty when the metric passes. */
    levers: DecisionLever[];
}

/**
 * Explain one threshold verdict. Deterministic; every lever number comes from
 * bisection over the caller's own model closure (`metricAt`).
 */
export function explainThresholdMetric(input: ThresholdMetricInput): ThresholdMetricExplain {
    const { metricLabel, value, threshold, direction, fmtValue, because } = input;
    const passes = (v: number): boolean => direction === 'atLeast' ? v >= threshold : v <= threshold;
    const pass = passes(value);
    const cmp = direction === 'atLeast' ? (pass ? '≥' : '<') : (pass ? '≤' : '>');
    const reason =
        `${metricLabel} ${fmtValue(value)} ${cmp} threshold ${fmtValue(threshold)}` +
        (because ? (pass ? ` — ${because}` : ` karena ${because}`) : '') + '.';

    if (pass) return { pass, reason, levers: [] };

    const levers: DecisionLever[] = [];
    for (const spec of input.levers) {
        const ok = (x: number): boolean => passes(spec.metricAt(x));
        const atHi = spec.metricAt(spec.hi);
        if (!passes(atHi)) {
            if (spec.unreachable) {
                levers.push({
                    ...spec.unreachable(atHi),
                    targetTab: spec.targetTab,
                    targetSelector: spec.targetSelector,
                    priority: 'MED',
                });
            }
            continue;
        }
        const x = ok(spec.lo) ? spec.lo : bisectMin(spec.lo, spec.hi, ok);
        levers.push({
            ...spec.render(x, spec.metricAt(x)),
            targetTab: spec.targetTab,
            targetSelector: spec.targetSelector,
            priority: 'HIGH',
        });
    }
    return { pass, reason, levers };
}
