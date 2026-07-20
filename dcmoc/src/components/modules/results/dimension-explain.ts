/* ─── RESULTS DIMENSION EXPLAIN (owner mandate rollout — final DL surface) ───
 * Every Fair/Poor dimension row (<60) on the Results scorecard + every
 * overall grade below "Good" gets the decision-explain treatment: (a) a
 * computed REASON built from the SAME dimension formula the page renders
 * (the score functions live HERE and the page imports them — one source,
 * mirrored read-only by value-trace results.*), and (b) 1-2 QUANTIFIED
 * levers whose magnitudes are SOLVED by explainThresholdMetric bisection
 * (lib/decision-explain) or by evaluating the real engine tables/models at
 * discrete candidate configs (pueMatrix, tierAvailability, architecture
 * .complexity, requirements.completeness, roi cashflow chain). Dimensions
 * with no sensible lever get an honest note, never generic advice.
 * Follows site-intel/axis-explain.ts + CapacityPlanningPage adoption.
 * ──────────────────────────────────────────────────────────────────────── */

import { explainThresholdMetric, type DecisionLever, type ThresholdLeverSpec } from '@/lib/decision-explain';
import { rzModels, rzData } from '@/lib/rz-engine';
import { fmtMoney } from '@/lib/format';
import { AXIS_LABELS, type AxisKey, type SiteScoreResult } from '@/types/site-intel';

/** Fair/Poor floor — dimension rows below this get the explain chip. */
export const DIM_CHIP_FLOOR = 60;
/** Overall "Good" (grade B) floor — below this the grade summary renders. */
export const GRADE_B_FLOOR = 70;

/* ─── Dimension score formulas — SINGLE SOURCE (page renders with these; the
 * explain solvers bisect over the SAME functions, so lever numbers can never
 * drift from the rendered score). Semantics identical to the pre-extraction
 * inline expressions (value-trace results.* mirrors them read-only). ────── */

/** CAPEX Efficiency: $/kW vs the engine cx reference band. */
export const capexScoreOf = (perKw: number, band: number): number =>
    Math.round(Math.max(10, Math.min(100, 100 - ((perKw - band * 0.6) / (band * 0.8)) * 60)));

/** Sustainability: design PUE positioned on the 1.10–1.60 band. */
export const susScoreOf = (pue: number): number =>
    Math.round(Math.max(0, Math.min(100, (1.6 - pue) / 0.5 * 100)));

/** Financial: screening IRR vs the fixed 10% scorecard hurdle. */
export const finScoreOf = (irr: number | null): number =>
    Math.round(Math.max(10, Math.min(100, 50 + (irr != null ? (irr - 0.10) * 400 : 0))));

/** Construction: SPI/CPI blend from tracking EVM (capped at 100). */
export const constrScoreOf = (spi: number, cpi: number): number =>
    Math.min(100, Math.round(50 * Math.min(1.2, spi) + 50 * Math.min(1.2, cpi)));

/** Operational Readiness: tier design availability positioned on 99.700–99.995%. */
export const opsScoreOf = (avail: number): number =>
    Math.max(0, Math.min(100, Math.round((avail - 0.997) / (0.99995 - 0.997) * 100)));

/** Architecture: 100 − soft complexity penalty (complexity = cost-of-delivery). */
export const archScoreOf = (complexityIndex: number): number =>
    Math.round(100 - complexityIndex * 0.35);

/* ─── Financial screening chain (page + explain share ONE closure set) ────── */

export interface FinScreen {
    revenue: number;
    opexAnnual: number;
    npv: number;
    irr: number | null;
    revenuePerKwMonth: number;
    /** Re-runs the SAME 15y screening cashflow (engine roi/opex models) with scaled revenue / capex → IRR fraction. */
    irrAt: (mods: { revMult?: number; capexMult?: number }) => number | null;
}

/**
 * The page's financial screening: revenue = engine decision rate × IT load,
 * opex = engine opex.totalAnnual (dcContract basis), 15y flat flows, NPV@10%
 * + IRR. Returns null when the engine roi model is absent (page falls back
 * to its neutral 60 default, as before).
 */
export function finScreening(itLoadKw: number, pue: number, countryId: string, capexTotal: number): FinScreen | null {
    const m = rzModels();
    if (!m?.roi?.npv) return null;
    const rate = rzData()?.decision?.revenuePerKwMonth ?? 280;
    const build = (revMult: number, capexMult: number): { capex: number; revenue: number; opexAnnual: number; flows: number[] } => {
        const capex = capexTotal * capexMult;
        const revenue = rate * itLoadKw * 12 * revMult;
        const opexAnnual: number = m?.opex?.totalAnnual
            ? m.opex.totalAnnual(itLoadKw / 1000, pue, countryId, 12, { capex, basisPreset: 'dcContract' }).total
            : revenue * 0.4;
        return { capex, revenue, opexAnnual, flows: Array.from({ length: 15 }, () => revenue - opexAnnual) };
    };
    const base = build(1, 1);
    const npv: number = m.roi.npv(base.flows, 0.1) - capexTotal;
    const irr: number | null = m.roi.irr ? m.roi.irr([-capexTotal, ...base.flows]) : null;
    return {
        revenue: base.revenue,
        opexAnnual: base.opexAnnual,
        npv,
        irr,
        revenuePerKwMonth: rate,
        irrAt: (mods) => {
            if (!m.roi.irr) return null;
            const b = build(mods.revMult ?? 1, mods.capexMult ?? 1);
            return m.roi.irr([-b.capex, ...b.flows]);
        },
    };
}

/* ─── Explain plumbing ────────────────────────────────────────────────────── */

export type DimKey = 'req' | 'site' | 'arch' | 'capex' | 'constr' | 'ops' | 'sus' | 'fin';

/** Dimension → owning engine shell tab (the ↗ navigation target). */
export const DIM_TABS: Record<DimKey, { tab: string; label: string }> = {
    req: { tab: 'requirements', label: 'Requirements' },
    site: { tab: 'site', label: 'Site Intelligence' },
    arch: { tab: 'architecture', label: 'Architecture Engine' },
    capex: { tab: 'capex', label: 'CAPEX Engine' },
    constr: { tab: 'construction', label: 'Construction Engine' },
    ops: { tab: 'reliability', label: 'Reliability Engine' },
    sus: { tab: 'carbon', label: 'Sustainability Engine' },
    fin: { tab: 'finance', label: 'Financial' },
};

/** Live context the page's model memo already computed — nothing re-derived. */
export interface DimContext {
    itLoadKw: number;
    tier: 2 | 3 | 4;
    coolingType: 'air' | 'inrow' | 'rdhx' | 'liquid';
    /** Engine redundancy token ('n1' | '2n' | '2n1') as the page maps it. */
    redundancy: string;
    /** The exact intake object the page passed to requirements.validate. */
    intake: Record<string, unknown>;
    reqMissing: string[];
    perKw: number;
    band: number;
    capexTotal: number;
    pue: number;
    evm: { spi: number; cpi: number; planMode?: boolean } | null;
    tierAvail: Record<number, number>;
    siteBest: SiteScoreResult | null;
    siteName?: string;
    complexityIndex: number | null;
    fin: FinScreen | null;
}

export interface DimExplain {
    reason: string;
    levers: DecisionLever[];
    targetTab: string;
    targetLabel: string;
}

const REQ_FIELD_LABELS: Record<string, string> = {
    itLoadKw: 'IT Load', targetTier: 'Target Tier', region: 'Region',
    useCase: 'Use Case', budgetUsd: 'Budget (USD)', deadlineMonths: 'Deadline (months)',
};

const RED_LABELS: Record<string, string> = { n: 'N', n1: 'N+1', '2n': '2N', '2n1': '2N+1' };

const pct1 = (v: number): string => `${(v * 100).toFixed(1)}%`;

/* ── per-dimension explainers (each returns reason + levers) ── */

function explainReq(score: number, target: number, ctx: DimContext): DimExplain {
    const m = rzModels();
    const requiredCount: number = rzData()?.requirements?.required?.length ?? 6;
    const missing = ctx.reqMissing;
    const have = requiredCount - missing.length;
    const missLabels = missing.map((k) => REQ_FIELD_LABELS[k] ?? k);
    const reason = `Requirements ${score}/100 = intake completeness engine (${have}/${requiredCount} required fields filled in)` +
        (missing.length ? ` — empty: ${missLabels.join(', ')}.` : '.');
    const levers: DecisionLever[] = [];
    const compAt = (extra: Record<string, unknown>): number => {
        try { return m?.requirements?.completeness?.({ ...ctx.intake, ...extra })?.pct ?? score; } catch { return score; }
    };
    /* fillable = missing fields DCMOC actually maps to an input (deadlineMonths is not one) */
    const fillable = missing.filter((k) => k !== 'deadlineMonths');
    if (fillable.length) {
        const achieved = compAt(Object.fromEntries(fillable.map((k) => [k, 1])));
        levers.push({
            label: `Fill in ${fillable.map((k) => REQ_FIELD_LABELS[k] ?? k).join(' + ')}`,
            detail: `Filling in ${fillable.map((k) => REQ_FIELD_LABELS[k] ?? k).join(', ')} (Requirements → intake) brings completeness ${score} → ${Math.round(achieved)}${achieved >= target ? ` (≥${target})` : ''} — recomputed through the engine requirements.completeness, each field worth ${(100 / requiredCount).toFixed(1)} pts.`,
            targetTab: 'requirements',
            priority: achieved >= target ? 'HIGH' : 'MED',
        });
    }
    if (missing.includes('deadlineMonths')) {
        const ceiling = compAt(Object.fromEntries(fillable.map((k) => [k, 1]).concat([['deadlineMonths', 1]])));
        levers.push({
            label: 'Deadline: not a DCMOC input',
            detail: `The engine field deadlineMonths is not mapped to a DCMOC input — the maximum completeness reachable from the UI is ${Math.round(compAt(Object.fromEntries(fillable.map((k) => [k, 1]))))} (theoretically ${Math.round(ceiling)} if that field existed). Honest note, not a lever.`,
            targetTab: 'requirements',
            priority: 'MED',
        });
    }
    return { reason, levers, targetTab: DIM_TABS.req.tab, targetLabel: DIM_TABS.req.label };
}

function explainSite(score: number, ctx: DimContext): DimExplain {
    const r = ctx.siteBest;
    if (!r) {
        return {
            reason: `Site Intelligence ${score}/100 — no site candidate can be scored yet (neutral fallback 50).`,
            levers: [{
                label: 'Add a site candidate',
                detail: 'Add at least one candidate in Site Intelligence so the score is computed from the engine scoreSite (not the neutral fallback).',
                targetTab: 'site', priority: 'MED',
            }],
            targetTab: DIM_TABS.site.tab, targetLabel: DIM_TABS.site.label,
        };
    }
    const axesAsc = (Object.entries(r.axes) as [AxisKey, number][]).sort((a, b) => a[1] - b[1]);
    const weak = axesAsc.slice(0, 2);
    const reason = `Site Intelligence ${score}/100 = engine site score of the best candidate${ctx.siteName ? ` (${ctx.siteName})` : ''} — weakest axes: ${weak.map(([k, v]) => `${AXIS_LABELS[k]} ${Math.round(v)}/100`).join(', ')}; factor coverage ${Math.round(r.engine.coverage * 100)}%${r.engine.missing.length ? ` (${r.engine.missing.length} factors still on neutral default)` : ''}.`;
    const levers: DecisionLever[] = [{
        label: `Improve the ${AXIS_LABELS[weak[0][0]]} axis`,
        detail: `The per-axis lever solver lives in Site Intelligence: the ${AXIS_LABELS[weak[0][0]]} ${Math.round(weak[0][1])}/100 (Poor/Fair) chip opens a panel with levers solved from the live scoreSite formula (Edit Criteria) — this dimension's number follows the best-candidate engine score as-is.`,
        targetTab: 'site', priority: 'MED',
    }];
    if (r.engine.missing.length) {
        levers.push({
            label: `Fill in attributes (${r.engine.missing.length} neutral factors)`,
            detail: `Factors ${r.engine.missing.join(', ')} use the neutral default — entering actual data can shift the score in EITHER direction (sharpening, not a promise to rise). Honest note.`,
            targetTab: 'site', priority: 'MED',
        });
    }
    return { reason, levers, targetTab: DIM_TABS.site.tab, targetLabel: DIM_TABS.site.label };
}

function explainArch(score: number, target: number, ctx: DimContext): DimExplain {
    const m = rzModels();
    const idx = ctx.complexityIndex;
    const reason = idx != null
        ? `Architecture ${score}/100 = 100 − 0.35 × complexity index ${idx}/100 (engine: cooling ${ctx.coolingType} × Tier ${ctx.tier} × ${RED_LABELS[ctx.redundancy] ?? ctx.redundancy}). Complexity = cost-of-delivery, not a design flaw.`
        : `Architecture ${score}/100 — engine complexity model unavailable (neutral fallback 60).`;
    const levers: DecisionLever[] = [];
    if (idx != null && m?.architecture?.complexity) {
        /* discrete candidates: one-step-lower redundancy / cooling, evaluated via the REAL engine model */
        const redOrder = ['n', 'n1', '2n', '2n1'];
        const coolOrder = ['air', 'inrow', 'rdhx', 'liquid'];
        const cand: { label: string; inp: { coolingType: string; tier: number; redundancy: string } }[] = [];
        const ri = redOrder.indexOf(ctx.redundancy);
        if (ri > 1) cand.push({ label: `Redundancy ${RED_LABELS[ctx.redundancy]} → ${RED_LABELS[redOrder[ri - 1]]}`, inp: { coolingType: ctx.coolingType, tier: ctx.tier, redundancy: redOrder[ri - 1] } });
        const ci = coolOrder.indexOf(ctx.coolingType);
        if (ci > 0) cand.push({ label: `Cooling ${ctx.coolingType} → ${coolOrder[ci - 1]}`, inp: { coolingType: coolOrder[ci - 1], tier: ctx.tier, redundancy: ctx.redundancy } });
        for (const c of cand) {
            try {
                const r2 = m.architecture.complexity(c.inp);
                if (!r2) continue;
                const s2 = archScoreOf(r2.index);
                if (s2 >= target && s2 > score) {
                    levers.push({
                        label: c.label,
                        detail: `${c.label} lowers the complexity index ${idx} → ${r2.index} so the score ${score} → ${s2} (≥${target}) — computed from the engine architecture.complexity. TRADE-OFF: this step trades away redundancy/cooling capability (availability & density), not a free optimization.`,
                        targetTab: 'architecture', priority: 'HIGH',
                    });
                    break;
                }
            } catch { /* engine guard */ }
        }
    }
    levers.push({
        label: 'Complexity ≠ badness',
        detail: 'This score measures the design delivery burden (cooling × tier × redundancy multiplier). Lowering it means lowering the specification — a trade-off-aware architecture decision, not an optimization target. Honest note.',
        targetTab: 'architecture', priority: 'MED',
    });
    return { reason, levers: levers.slice(0, 2), targetTab: DIM_TABS.arch.tab, targetLabel: DIM_TABS.arch.label };
}

function explainCapex(score: number, target: number, ctx: DimContext): DimExplain {
    const { perKw, band, capexTotal } = ctx;
    const specs: ThresholdLeverSpec[] = [{
        lo: perKw,
        hi: band * 0.6, // band floor → formula = 100
        metricAt: (x) => capexScoreOf(x, band),
        render: (x, achieved) => {
            const cutPct = (1 - x / perKw) * 100;
            const totalTarget = capexTotal * (x / perKw);
            return {
                label: `CAPEX $/kW −${cutPct.toFixed(0)}%`,
                detail: `Lower $/kW $${Math.round(perKw).toLocaleString()} → $${Math.round(x).toLocaleString()} (−${cutPct.toFixed(1)}%; total ${fmtMoney(capexTotal)} → ${fmtMoney(totalTarget)}) so the score reaches ${achieved} (≥${target}) — solved by bisection over the same score formula; the top drivers are in the CAPEX Engine tornado.`,
            };
        },
        unreachable: (atHi) => ({
            label: 'Even the band floor is not enough',
            detail: `Even at $${Math.round(band * 0.6).toLocaleString()}/kW the score is only ${Math.round(atHi)} — check the engine reference band.`,
        }),
        targetTab: 'capex',
    }];
    const solved = explainThresholdMetric({
        metricLabel: 'CAPEX Efficiency',
        value: score,
        threshold: target,
        direction: 'atLeast',
        fmtValue: (v) => `${Math.round(v)}/100`,
        because: `$${Math.round(perKw).toLocaleString()}/kW vs reference band $${band.toLocaleString()}/kW (engine cx capexPerKw standard) — score = 100 − ((perKw − 0.6×band)/(0.8×band))×60`,
        levers: specs,
    });
    const levers = solved.levers;
    levers.push({
        label: 'Band = benchmark, not a verdict',
        detail: `The $${band.toLocaleString()}/kW band is the cx standard-build benchmark — a premium configuration (high tier/cooling/redundancy) is reasonably above it; value-engineer specific drivers, don't cut across the board.`,
        targetTab: 'capex', priority: 'MED',
    });
    return { reason: solved.reason, levers: levers.slice(0, 2), targetTab: DIM_TABS.capex.tab, targetLabel: DIM_TABS.capex.label };
}

function explainConstr(score: number, target: number, ctx: DimContext): DimExplain {
    const e = ctx.evm;
    if (!e || e.planMode) {
        return {
            reason: `Construction ${score}/100 — Plan Mode (SPI/CPI baseline 1.00); a low score only appears once actual EVM tracking is running.`,
            levers: [],
            targetTab: DIM_TABS.constr.tab, targetLabel: DIM_TABS.constr.label,
        };
    }
    const specs: ThresholdLeverSpec[] = [
        {
            lo: e.spi, hi: 1.2,
            metricAt: (s) => constrScoreOf(s, e.cpi),
            render: (x, achieved) => ({
                label: `SPI ${e.spi.toFixed(2)} → ${x.toFixed(2)}`,
                detail: `Recover schedule performance to SPI ${x.toFixed(2)} (CPI held at ${e.cpi.toFixed(2)}) → score ${achieved} (≥${target}) — solved from the formula 50×min(1.2,SPI)+50×min(1.2,CPI).`,
            }),
            unreachable: (atHi) => ({
                label: 'Schedule recovery alone is not enough',
                detail: `Even SPI 1.20 only brings the score to ${Math.round(atHi)} — CPI ${e.cpi.toFixed(2)} is the binding constraint; cost control must be recovered too.`,
            }),
            targetTab: 'construction',
        },
        {
            lo: e.cpi, hi: 1.2,
            metricAt: (c) => constrScoreOf(e.spi, c),
            render: (x, achieved) => ({
                label: `CPI ${e.cpi.toFixed(2)} → ${x.toFixed(2)}`,
                detail: `OR recover cost performance to CPI ${x.toFixed(2)} (SPI held at ${e.spi.toFixed(2)}) → score ${achieved} (≥${target}) — same score formula.`,
            }),
            unreachable: (atHi) => ({
                label: 'Cost control alone is not enough',
                detail: `Even CPI 1.20 only brings the score to ${Math.round(atHi)} — SPI ${e.spi.toFixed(2)} is the binding constraint; schedule recovery must follow.`,
            }),
            targetTab: 'construction',
        },
    ];
    const solved = explainThresholdMetric({
        metricLabel: 'Construction',
        value: score,
        threshold: target,
        direction: 'atLeast',
        fmtValue: (v) => `${Math.round(v)}/100`,
        because: `live EVM tracking: SPI ${e.spi.toFixed(2)} · CPI ${e.cpi.toFixed(2)} — score = 50×min(1.2,SPI) + 50×min(1.2,CPI)`,
        levers: specs,
    });
    solved.levers.push({
        label: 'SPI/CPI = actual field data',
        detail: 'These numbers come from actual progress & spend (Construction tracking), not design parameters — the real lever is a recovery plan (crash schedule / cost control), and the SPI/CPI targets above are the recovery magnitudes that must be reached.',
        targetTab: 'construction', priority: 'MED',
    });
    return { reason: solved.reason, levers: solved.levers.slice(0, 3), targetTab: DIM_TABS.constr.tab, targetLabel: DIM_TABS.constr.label };
}

function explainOps(score: number, target: number, ctx: DimContext): DimExplain {
    const avail = ctx.tierAvail[ctx.tier] ?? 0.9998;
    const reason = `Operational Readiness ${score}/100 = Tier ${ctx.tier} design availability (${(avail * 100).toFixed(3)}%) positioned on the 99.700–99.995% band (engine tierAvailability).`;
    const levers: DecisionLever[] = [];
    for (let t = ctx.tier + 1; t <= 4; t++) {
        const a2 = ctx.tierAvail[t];
        if (a2 == null) continue;
        const s2 = opsScoreOf(a2);
        if (s2 >= target && s2 > score) {
            levers.push({
                label: `Tier ${ctx.tier} → Tier ${t}`,
                detail: `Upgrading to Tier ${t} raises design availability ${(avail * 100).toFixed(3)}% → ${(a2 * 100).toFixed(3)}% (engine table) so the score ${score} → ${s2} (≥${target}). TRADE-OFF: a higher tier raises CAPEX & complexity (check CAPEX/Architecture).`,
                targetTab: 'reliability', priority: 'HIGH',
            });
            break;
        }
    }
    levers.push({
        label: 'Score = design tier position',
        detail: 'This dimension purely positions the CHOSEN tier availability on the 99.700–99.995% band — not an actual operational metric. If the current Tier genuinely fits the SLA requirement, a low score is a deliberate consequence, not a defect. Honest note.',
        targetTab: 'reliability', priority: 'MED',
    });
    return { reason, levers: levers.slice(0, 2), targetTab: DIM_TABS.ops.tab, targetLabel: DIM_TABS.ops.label };
}

function explainSus(score: number, target: number, ctx: DimContext): DimExplain {
    const matrix = rzData()?.pueMatrix ?? {};
    const tierKey = 'tier' + ctx.tier;
    const reason = `Sustainability ${score}/100 = (1.60 − PUE ${ctx.pue}) / 0.50 × 100 — PUE from the engine pueMatrix (${ctx.coolingType} × Tier ${ctx.tier}) on the 1.10–1.60 band.`;
    const levers: DecisionLever[] = [];
    const order: DimContext['coolingType'][] = ['air', 'inrow', 'rdhx', 'liquid'];
    const ci = order.indexOf(ctx.coolingType);
    const options: { cool: string; pue: number; score: number }[] = [];
    for (const cand of order.slice(ci + 1)) {
        const p2 = matrix?.[cand]?.[tierKey];
        if (typeof p2 !== 'number' || p2 >= ctx.pue) continue;
        options.push({ cool: cand, pue: p2, score: susScoreOf(p2) });
    }
    const first = options.find((o) => o.score >= target);
    if (first) {
        const strongest = options[options.length - 1];
        levers.push({
            label: `Cooling ${ctx.coolingType} → ${first.cool}`,
            detail: `Upgrading cooling to ${first.cool} lowers PUE ${ctx.pue} → ${first.pue} (engine pueMatrix, Tier ${ctx.tier}) so the score ${score} → ${first.score} (≥${target})` +
                (strongest && strongest.cool !== first.cool ? `; strongest option: ${strongest.cool} (PUE ${strongest.pue} → score ${strongest.score})` : '') +
                `. The delta is computed from the engine PUE matrix — a cooling change shifts CAPEX & complexity (Architecture).`,
            targetTab: 'carbon', priority: 'HIGH',
        });
    } else if (options.length) {
        const best = options[options.length - 1];
        levers.push({
            label: 'Cooling upgrade: not enough on its own',
            detail: `Even ${best.cool} (PUE ${best.pue}) only brings the score to ${best.score} (<${target}) at Tier ${ctx.tier} — check the tier too (pueMatrix improves at higher tiers).`,
            targetTab: 'carbon', priority: 'MED',
        });
    }
    levers.push({
        label: 'Renewables do NOT enter this score',
        detail: 'The dimension formula only reads PUE — the renewable/carbon share does NOT change this score (that lives in the Sustainability Engine). The only formula lever is PUE via cooling/tier. Honest note.',
        targetTab: 'carbon', priority: 'MED',
    });
    return { reason, levers: levers.slice(0, 2), targetTab: DIM_TABS.sus.tab, targetLabel: DIM_TABS.sus.label };
}

function explainFin(score: number, target: number, ctx: DimContext): DimExplain {
    const fin = ctx.fin;
    if (!fin) {
        return {
            reason: `Financial ${score}/100 — engine roi model unavailable; screening not computed (neutral default).`,
            levers: [],
            targetTab: DIM_TABS.fin.tab, targetLabel: DIM_TABS.fin.label,
        };
    }
    const because = `15-yr screening: revenue ${fmtMoney(fin.revenue)}/yr (${fmtMoney(fin.revenuePerKwMonth)}/kW/mo × ${ctx.itLoadKw.toLocaleString()} kW) − opex ${fmtMoney(fin.opexAnnual)}/yr vs CAPEX ${fmtMoney(ctx.capexTotal)}; IRR ${fin.irr != null ? pct1(fin.irr) : 'not converged'} vs 10% hurdle — score = 50 + (IRR − 10%)×400`;
    const specs: ThresholdLeverSpec[] = [
        {
            lo: 1, hi: 2.5,
            metricAt: (mult) => finScoreOf(fin.irrAt({ revMult: mult })),
            render: (x, achieved) => {
                const irr2 = fin.irrAt({ revMult: x });
                return {
                    label: `Revenue +${((x - 1) * 100).toFixed(0)}%`,
                    detail: `Revenue up +${((x - 1) * 100).toFixed(1)}% (tariff ${fmtMoney(fin.revenuePerKwMonth)} → ${fmtMoney(fin.revenuePerKwMonth * x)}/kW/mo) brings IRR to ${irr2 != null ? pct1(irr2) : '—'} → score ${achieved} (≥${target}) — solved by bisection over the same screening cashflow chain (engine roi).`,
                };
            },
            unreachable: (atHi) => ({
                label: 'Even revenue +150% is not enough',
                detail: `Even revenue ×2.5 only brings the score to ${Math.round(atHi)} — the cost structure (CAPEX + opex) is the binding constraint, not the tariff.`,
            }),
            targetTab: 'finance',
        },
        {
            lo: 0, hi: 0.6,
            metricAt: (cut) => finScoreOf(fin.irrAt({ capexMult: 1 - cut })),
            render: (x, achieved) => {
                const irr2 = fin.irrAt({ capexMult: 1 - x });
                return {
                    label: `CAPEX −${(x * 100).toFixed(0)}%`,
                    detail: `OR CAPEX down −${(x * 100).toFixed(1)}% (to ${fmtMoney(ctx.capexTotal * (1 - x))}) brings IRR to ${irr2 != null ? pct1(irr2) : '—'} → score ${achieved} (≥${target}) — opex is recomputed too (the dcContract basis includes a capex component).`,
                };
            },
            unreachable: (atHi) => ({
                label: 'Even CAPEX −60% is not enough',
                detail: `Even CAPEX −60% only brings the score to ${Math.round(atHi)} — the revenue/opex side is the binding constraint.`,
            }),
            targetTab: 'capex',
        },
    ];
    const solved = explainThresholdMetric({
        metricLabel: 'Financial',
        value: score,
        threshold: target,
        direction: 'atLeast',
        fmtValue: (v) => `${Math.round(v)}/100`,
        because,
        levers: specs,
    });
    solved.levers.push({
        label: 'Hurdle & discount = scorecard constants',
        detail: 'The score uses a flat 10% hurdle + 10% discount (screening scorecard) — not your project WACC/hurdle; the IRR itself is unaffected by the discount. The full financial decision (adjustable hurdle/discount) lives in the Financial engine.',
        targetTab: 'finance', priority: 'MED',
    });
    return { reason: solved.reason, levers: solved.levers.slice(0, 3), targetTab: DIM_TABS.fin.tab, targetLabel: DIM_TABS.fin.label };
}

/**
 * Explain one scorecard dimension. Deterministic; every lever magnitude is
 * either solved by bisection over the SAME score formula the page renders,
 * or evaluated from the real engine tables at discrete candidate configs.
 * `score` may also be ≥60 (called from the overall-grade summary) — then the
 * solve target lifts to the Good floor (70).
 */
export function explainDimension(key: DimKey, score: number, ctx: DimContext): DimExplain {
    const target = score < DIM_CHIP_FLOOR ? DIM_CHIP_FLOOR : GRADE_B_FLOOR;
    switch (key) {
        case 'req': return explainReq(score, target, ctx);
        case 'site': return explainSite(score, ctx);
        case 'arch': return explainArch(score, target, ctx);
        case 'capex': return explainCapex(score, target, ctx);
        case 'constr': return explainConstr(score, target, ctx);
        case 'ops': return explainOps(score, target, ctx);
        case 'sus': return explainSus(score, target, ctx);
        case 'fin': return explainFin(score, target, ctx);
    }
}

/* ─── Overall grade summary (grade < B → two weakest dims + top levers) ───── */

export interface OverallWeakSpot {
    key: DimKey;
    label: string;
    score: number;
    weight: number;
    topLever: DecisionLever | null;
    targetTab: string;
    targetLabel: string;
    /** Overall points gained if this dimension reaches its solve target — same weighted formula. */
    liftPts: number;
    liftTarget: number;
}

export interface OverallExplain {
    reason: string;
    spots: OverallWeakSpot[];
    note: string;
}

/**
 * Overall < 70 ("Good"/B floor): name the two weakest dimensions, attach each
 * one's top solved lever, and recompute the SAME weighted overall with both
 * lifted to their targets — honest about whether that alone reaches Good.
 */
export function explainOverall(
    dims: { key: string; label: string; score: number; weight: number }[],
    overall: number,
    grade: string,
    ctx: DimContext,
): OverallExplain {
    const totalW = dims.reduce((s, d) => s + d.weight, 0);
    const asc = [...dims].sort((a, b) => a.score - b.score);
    const spots: OverallWeakSpot[] = asc.slice(0, 2).map((d) => {
        const ex = explainDimension(d.key as DimKey, d.score, ctx);
        const topLever = ex.levers.find((l) => l.priority === 'HIGH') ?? ex.levers[0] ?? null;
        const liftTarget = Math.max(d.score, d.score < DIM_CHIP_FLOOR ? DIM_CHIP_FLOOR : GRADE_B_FLOOR);
        return {
            key: d.key as DimKey, label: d.label, score: d.score, weight: d.weight,
            topLever, targetTab: ex.targetTab, targetLabel: ex.targetLabel,
            liftPts: Math.round(((liftTarget - d.score) * d.weight / totalW) * 10) / 10,
            liftTarget,
        };
    });
    const reason = `Grade ${grade} (${overall}/100 < ${GRADE_B_FLOOR} "Good") — held back mainly by ${spots.map((s) => `${s.label} ${s.score}/100 (${Math.round(s.weight * 100)}% weight)`).join(' and ')}.`;
    /* recompute the SAME weighted overall with both spots lifted to target */
    const lifted = Math.round(dims.reduce((s, d) => {
        const spot = spots.find((x) => x.key === d.key);
        return s + (spot ? spot.liftTarget : d.score) * d.weight;
    }, 0) / totalW);
    const note = lifted >= GRADE_B_FLOOR
        ? `Lifting both to their targets brings overall ${overall} → ~${lifted} (reaching Good) — the same weighted formula.`
        : `Honestly: even lifting both to their targets only brings overall ${overall} → ~${lifted} (<${GRADE_B_FLOOR}) — other dimensions hold it back too; see the table for the next chip.`;
    return { reason, spots, note };
}
