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
import { buildBlendedIrrClosure, type BlendedSimInputs, type BlendedPhase } from './objectives';
import { sanitizeCap, facilitySnapshot, utilization, utilBands } from '@/state/adapters/capacity-adapter';
import { riskBand } from '@/state/adapters/capex-adapter';
import type { CountryProfile } from '@/constants/countries';

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

/* ─── Workstream U — the REAL "Run Optimization" solver ──────────────────────
 * Sequentially evaluates every objective that can be computed headlessly from
 * importable pure models (no page closures, no second estimates):
 *   1. Blended IRR ≥ hurdle  — phased-finance closure (objectives.ts, page-
 *      parity mirror) solved by 40-iteration bisection on revenuePerKwMonth.
 *   2. Capacity utilization  — margin-aware band check via the capacity
 *      adapter (report-only when in-band; flagged with the worst row when not).
 *   3. Budget vs CAPEX P80   — deterministic AACE Class-4 band (report-only).
 * Nothing is applied here — proposals go through preview-then-Apply with
 * proposalToPatch + the tunables guard, exactly like PhasedFinancialDashboard.
 * ──────────────────────────────────────────────────────────────────────── */

export type ObjectiveStatus = 'cleared' | 'proposal' | 'in-band' | 'flag' | 'unavailable';

export interface ObjectiveOutcome {
    name: string;
    status: ObjectiveStatus;
    /** honest one-paragraph finding — always rendered. */
    detail: string;
    /** precision line, e.g. "IRR 12.02% vs 12% target, residual +0.02pp". */
    residual?: string;
    /** present only when a tunable move is proposed (status 'proposal'). */
    proposal?: OptimizeProposal;
}

export interface RealOptimizationResult {
    objectives: ObjectiveOutcome[];
    residuals: string[];
}

export interface RealOptimizationInput {
    country: CountryProfile | null;
    sim: BlendedSimInputs & {
        itLoad: number;              // kW
        buildingSize: number;        // m²
        baseYear: number;
        capacityPhases: BlendedPhase[];
    };
    /** Requirements-side parameters (read-only). */
    rackKw: number;
    designMarginPct: number;
    growthMwByYear: { label: string; mw: number }[];
    /** CAPEX engine result total (P50) — null when not yet run. */
    capexTotal: number | null;
    /** Owner budget from Requirements → Business — null when unset. */
    budgetUsd: number | null;
    hurdlePct?: number;              // default 12
}

export function runRealOptimization(x: RealOptimizationInput): RealOptimizationResult {
    const hurdle = x.hurdlePct ?? 12;
    const objectives: ObjectiveOutcome[] = [];

    /* ── Objective 1: blended IRR ≥ hurdle (solvable — revenue tunable) ── */
    const closure = buildBlendedIrrClosure(x.country, x.sim);
    if (!closure) {
        objectives.push({
            name: `Blended IRR ≥ ${hurdle}% hurdle`,
            status: 'unavailable',
            detail: 'Phased-finance model unavailable — select a country and configure capacity phases first.',
        });
    } else {
        const irr0 = closure.computeIrrAt(closure.baseRev);
        if (irr0 >= hurdle) {
            objectives.push({
                name: `Blended IRR ≥ ${hurdle}% hurdle`,
                status: 'cleared',
                detail: `Blended IRR ${irr0.toFixed(2)}% already clears the ${hurdle}% hurdle at the current revenue $${closure.baseRev}/kW·mo — no move needed.`,
                residual: `IRR ${irr0.toFixed(2)}% vs ${hurdle}% target, residual +${(irr0 - hurdle).toFixed(2)}pp`,
            });
        } else {
            const proposal = optimizeRevenueForHurdle({
                baseRev: closure.baseRev,
                hurdlePct: hurdle,
                computeIrrAt: closure.computeIrrAt,
                computeNpvAt: closure.computeNpvAt,
            });
            // full-precision residual (proposal.after is display-rounded to 1dp)
            const irr1 = closure.computeIrrAt(proposal.items[0]?.to ?? closure.baseRev);
            objectives.push({
                name: `Blended IRR ≥ ${hurdle}% hurdle`,
                status: 'proposal',
                detail: proposal.narrative,
                residual: `IRR ${irr1.toFixed(2)}% vs ${hurdle}% target, residual ${irr1 >= hurdle ? '+' : ''}${(irr1 - hurdle).toFixed(2)}pp`,
                proposal,
            });
        }
    }

    /* ── Objective 2: capacity utilization band (report-only check) ── */
    try {
        const cap = sanitizeCap({
            itLoadKw: x.sim.itLoad,
            tier: x.sim.tierLevel,
            coolingType: x.sim.coolingType,
            rackKw: x.rackKw,
            whiteFloorM2: x.sim.buildingSize,
            baseYear: x.sim.baseYear,
            marketType: 'wholesale',
            phases: x.sim.capacityPhases,
            designMarginPct: x.designMarginPct,
            growthMwByYear: x.growthMwByYear,
        });
        const snap = facilitySnapshot(cap);
        const rows = utilization(cap, snap.facilityMw).rows;
        const bands = utilBands(cap);
        const worst = rows.reduce((a, b) => (b.pct > a.pct ? b : a), rows[0]);
        const inBand = worst.pct < bands.watchMax;
        objectives.push({
            name: 'Capacity utilization in-band',
            status: inBand ? 'in-band' : 'flag',
            detail: inBand
                ? `All capacity rows sit inside the margin-aware band (worst: ${worst.label} at ${worst.pct}%, watch threshold ${bands.watchMax}%; structural floor ${bands.floorPct}% from the ${x.designMarginPct}% design margin). No optimizer move required.`
                : `${worst.label} at ${worst.pct}% exceeds the ${bands.watchMax}% band — a design-margin or phase-plan lever is needed (fine-tune in Capacity Planning); the optimizer does not move capacity base data.`,
            residual: `worst utilization ${worst.pct}% vs ${bands.watchMax}% band edge, residual ${worst.pct < bands.watchMax ? '' : '+'}${(worst.pct - bands.watchMax).toFixed(0)}pp`,
        });
    } catch {
        objectives.push({
            name: 'Capacity utilization in-band',
            status: 'unavailable',
            detail: 'Capacity adapter unavailable — open Capacity Planning once to initialize.',
        });
    }

    /* ── Objective 3: budget vs CAPEX P80 (report-only check) ── */
    if (x.capexTotal == null || x.capexTotal <= 0) {
        objectives.push({
            name: 'Budget covers CAPEX P80',
            status: 'unavailable',
            detail: 'CAPEX engine has not produced a total yet — run the CAPEX engine first.',
        });
    } else {
        const band = riskBand(x.capexTotal);
        if (x.budgetUsd == null || x.budgetUsd <= 0) {
            objectives.push({
                name: 'Budget covers CAPEX P80',
                status: 'flag',
                detail: `No owner budget is set (Requirements → Business). The risk-adjusted P80 of ${fmtUsdShort(band.p80)} (AACE Class-4 deterministic band over the ${fmtUsdShort(band.p50)} P50) is the recommended budget-approval basis.`,
                residual: `P80 ${fmtUsdShort(band.p80)} — no budget to compare`,
            });
        } else {
            const gap = x.budgetUsd - band.p80;
            const cleared = gap >= 0;
            objectives.push({
                name: 'Budget covers CAPEX P80',
                status: cleared ? 'cleared' : 'flag',
                detail: cleared
                    ? `Budget ${fmtUsdShort(x.budgetUsd)} covers the risk-adjusted P80 ${fmtUsdShort(band.p80)} with ${fmtUsdShort(gap)} headroom — approval basis is sound.`
                    : `Budget ${fmtUsdShort(x.budgetUsd)} is ${fmtUsdShort(-gap)} BELOW the risk-adjusted P80 ${fmtUsdShort(band.p80)} — an ~80% chance of a within-budget outcome requires either more budget or a scope/CAPEX lever. Report-only: the optimizer never cuts contingency to fake a fit.`,
                residual: `budget vs P80 residual ${gap >= 0 ? '+' : '−'}${fmtUsdShort(Math.abs(gap))}`,
            });
        }
    }

    return { objectives, residuals: objectives.flatMap((o) => (o.residual ? [`${o.name}: ${o.residual}`] : [])) };
}

function fmtUsdShort(n: number): string {
    const a = Math.abs(n);
    if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${Math.round(n)}`;
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
