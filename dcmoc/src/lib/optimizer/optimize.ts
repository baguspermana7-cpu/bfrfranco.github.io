/* ─── Deterministic optimizer core (Workstream D) ────────────────────────────
 * Manual = trace → diagnostic → revise one lever. AUTO = solve the minimal
 * tunable move that clears the breached objective — deterministic bisection /
 * coordinate descent over the SAME model closures the page renders from
 * (never a separate estimate). No LLM. Preview-then-Apply only; the caller
 * writes stores AFTER an explicit user Apply, guarded by assertNotLocked.
 * Technology–economics stance: objectives maximize value/efficiency subject
 * to constraints — never "more redundancy/sophistication" for its own sake.
 * ──────────────────────────────────────────────────────────────────────── */

import { assertNotLocked, isTunable, TUNABLES } from './tunables';

export interface OptimizeProposalItem {
    key: string;
    label: string;
    from: number;
    to: number;
    unit: string;
}

export interface OptimizeProposal {
    items: OptimizeProposalItem[];
    before: Record<string, number>;
    after: Record<string, number>;
    objective: string;
    feasible: boolean;         // objective actually cleared inside the bands
    narrative: string;
}

/** Monotone bisection: find the minimal x in [lo,hi] where metricAt(x) >= target
 *  (increasing=true) or <= target (increasing=false). Returns null if even the
 *  band edge cannot reach the target (honest infeasibility, no silent clamp). */
export function bisectToTarget(opts: {
    lo: number; hi: number; target: number;
    metricAt: (x: number) => number;
    increasing?: boolean; iterations?: number;
}): number | null {
    const { lo, hi, target, metricAt } = opts;
    const inc = opts.increasing !== false;
    const reaches = (v: number) => (inc ? v >= target : v <= target);
    if (reaches(metricAt(lo))) return lo;           // already clear at the floor
    if (!reaches(metricAt(hi))) return null;        // band edge can't clear it
    let a = lo, b = hi;
    const n = opts.iterations ?? 40;
    for (let i = 0; i < n; i++) {
        const m = (a + b) / 2;
        if (reaches(metricAt(m))) b = m; else a = m;
    }
    return b;
}

/** Solve the minimal revenue $/kW·mo that lifts a computed IRR to the hurdle.
 *  computeIrrAt re-runs the page's OWN cash-flow closure at a given revenue. */
export function optimizeRevenueForHurdle(opts: {
    baseRev: number;
    hurdlePct: number;
    computeIrrAt: (rev: number) => number;
    computeNpvAt?: (rev: number) => number;
}): OptimizeProposal {
    const spec = TUNABLES.find((t) => t.key === 'revenuePerKwMonth')!;
    const lo = Math.max(spec.min, opts.baseRev);
    const hi = spec.max;
    const irr0 = opts.computeIrrAt(opts.baseRev);
    const solved = bisectToTarget({ lo, hi, target: opts.hurdlePct, metricAt: opts.computeIrrAt });
    const feasible = solved != null;
    const to = feasible ? Math.ceil(solved!) : hi;
    const irr1 = opts.computeIrrAt(to);
    const before: Record<string, number> = { blendedIrrPct: +irr0.toFixed(1) };
    const after: Record<string, number> = { blendedIrrPct: +irr1.toFixed(1) };
    if (opts.computeNpvAt) {
        before.npvUsd = Math.round(opts.computeNpvAt(opts.baseRev));
        after.npvUsd = Math.round(opts.computeNpvAt(to));
    }
    const pct = ((to - opts.baseRev) / opts.baseRev) * 100;
    return {
        items: [{ key: 'revenuePerKwMonth', label: spec.label, from: opts.baseRev, to, unit: spec.unit }],
        before, after,
        objective: `blended IRR ≥ ${opts.hurdlePct}% hurdle`,
        feasible,
        narrative: feasible
            ? `Minimal move: revenue $${opts.baseRev} → $${to}/kW·mo (+${pct.toFixed(1)}%) lifts blended IRR ${irr0.toFixed(1)}% → ${irr1.toFixed(1)}% (≥ ${opts.hurdlePct}% hurdle). No requirement base data touched.`
            : `Infeasible inside the pricing band: even $${hi}/kW·mo reaches only ${irr1.toFixed(1)}% IRR — the economics need a CAPEX/scope lever, not more price. (Honest verdict; nothing applied.)`,
    };
}

/** Guard + shape-check a store patch derived from a proposal (call before Apply). */
export function proposalToPatch(p: OptimizeProposal): Record<string, number> {
    const patch: Record<string, number> = {};
    for (const it of p.items) {
        if (!isTunable(it.key)) throw new Error(`Optimizer guard: "${it.key}" is not in the tunables allowlist.`);
        patch[it.key] = it.to;
    }
    assertNotLocked(patch);
    return patch;
}
