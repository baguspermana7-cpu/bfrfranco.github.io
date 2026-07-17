/* ─── LAYER 13 · DETERMINISTIC DECISION PROVIDER (no LLM) ─────────────────────
 * A "super-intelligent" rule algorithm that reads the engine-output snapshot and
 * emits an explainable recommendation. Pure + deterministic + unit-testable —
 * same inputs always yield the same result. Reference behaviour (owner example):
 *   budget $30M → "Tier IV not feasible → recommend Tier III+, right-size MW,
 *   liquid cooling, ROI ~X yr".
 * Every rule appends a RationaleStep so the "why" is fully traceable in the UI.
 * ──────────────────────────────────────────────────────────────────────────── */

import type {
    DecisionProvider, DecisionRequest, DecisionResult, RationaleStep,
    DecisionRecommendation, Tier,
} from './types';
import { DECISION_DISCLAIMER } from './types';

// Tier CAPEX intensity multipliers (Uptime tier availability drives redundancy
// cost). Descriptive planning heuristics, not a substitute for CapexEngine.
const TIER_CAPEX_MULT: Record<Tier, number> = { 2: 1.0, 3: 1.35, 4: 1.85 };
const TIER_AVAILABILITY: Record<Tier, number> = { 2: 99.741, 3: 99.982, 4: 99.995 };

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }

export const deterministicProvider: DecisionProvider = {
    id: 'deterministic',

    async decide(req: DecisionRequest): Promise<DecisionResult> {
        const { context: c, constraints = {}, objectives = [] } = req;
        const rationale: RationaleStep[] = [];
        const recommendations: DecisionRecommendation[] = [];

        const itLoadKw = c.inputs.itLoadKw || 0;
        const itLoadMw = itLoadKw / 1000;
        let recommendedTier: Tier = c.inputs.tier;
        let feasible = true;

        // ── Rule 1: budget vs tier feasibility ────────────────────────────────
        const knownCapex = c.capex?.totalUsd;
        if (constraints.budgetUsd && knownCapex && knownCapex > 0) {
            if (knownCapex > constraints.budgetUsd) {
                // Estimate the tier that fits by scaling on the tier multiplier.
                const perTierBase = knownCapex / TIER_CAPEX_MULT[c.inputs.tier];
                const fits = ([4, 3, 2] as Tier[]).find(
                    (t) => perTierBase * TIER_CAPEX_MULT[t] <= constraints.budgetUsd!
                );
                if (fits && fits < c.inputs.tier) {
                    recommendedTier = fits;
                    rationale.push({
                        engine: 'capex',
                        observation: `Tier ${c.inputs.tier} CAPEX ≈ $${(knownCapex / 1e6).toFixed(1)}M exceeds the $${(constraints.budgetUsd / 1e6).toFixed(1)}M budget`,
                        rule: 'budget < tierCapex → downgrade to the highest tier that fits',
                        conclusion: `Recommend Tier ${fits}${fits === 3 ? '+' : ''} (availability ${TIER_AVAILABILITY[fits]}%)`,
                        severity: 'warn',
                    });
                    recommendations.push({
                        title: `Target Tier ${fits}${fits === 3 ? '+' : ''} instead of Tier ${c.inputs.tier}`,
                        detail: `Tier ${c.inputs.tier} is not feasible within budget; Tier ${fits} keeps ${TIER_AVAILABILITY[fits]}% availability while fitting the envelope.`,
                        confidence: 0.8,
                        tags: ['tier', 'budget'],
                    });
                } else if (!fits) {
                    feasible = false;
                    rationale.push({
                        engine: 'capex',
                        observation: `Even Tier 2 CAPEX exceeds the $${(constraints.budgetUsd / 1e6).toFixed(1)}M budget`,
                        rule: 'no tier fits budget → infeasible at this capacity',
                        conclusion: 'Reduce IT load or raise budget',
                        severity: 'critical',
                    });
                }
            } else {
                rationale.push({
                    engine: 'capex',
                    observation: `CAPEX ≈ $${(knownCapex / 1e6).toFixed(1)}M within the $${(constraints.budgetUsd / 1e6).toFixed(1)}M budget`,
                    rule: 'capex ≤ budget → tier is affordable',
                    conclusion: `Tier ${c.inputs.tier} is fundable`,
                    severity: 'info',
                });
            }
        }

        // ── Rule 2: cooling choice by density ─────────────────────────────────
        const rackKw = itLoadKw > 0 && c.capacity?.totalMw ? (itLoadKw / (c.capacity.totalMw * 1000)) : 0;
        const density = itLoadMw >= 10 ? 'high' : itLoadMw >= 3 ? 'medium' : 'low';
        if ((c.inputs.coolingType === 'air' || !c.inputs.coolingType) && density === 'high') {
            recommendations.push({
                title: 'Adopt direct liquid cooling',
                detail: `At ${itLoadMw.toFixed(1)} MW the thermal density favours liquid/immersion cooling — lower PUE and rack footprint than air.`,
                confidence: 0.75,
                tags: ['cooling', 'pue'],
            });
            rationale.push({
                engine: 'architecture',
                observation: `IT load ${itLoadMw.toFixed(1)} MW is high-density`,
                rule: 'high MW density → liquid cooling beats air on PUE/footprint',
                conclusion: 'Recommend liquid cooling',
                severity: 'info',
            });
        }
        void rackKw;

        // ── Rule 3: PUE constraint ────────────────────────────────────────────
        if (constraints.maxPue && c.carbon?.pue && c.carbon.pue > constraints.maxPue) {
            recommendations.push({
                title: `Improve PUE toward ≤ ${constraints.maxPue}`,
                detail: `Modelled PUE ${c.carbon.pue.toFixed(2)} exceeds the ${constraints.maxPue} target — consider liquid cooling, higher chilled-water temps, or economisation.`,
                confidence: 0.7,
                tags: ['pue', 'sustainability'],
            });
            rationale.push({
                engine: 'sustainability',
                observation: `PUE ${c.carbon.pue.toFixed(2)} > target ${constraints.maxPue}`,
                rule: 'pue > maxPue → efficiency intervention',
                conclusion: 'Flag PUE gap',
                severity: 'warn',
            });
        }

        // ── Rule 4: availability constraint ───────────────────────────────────
        if (constraints.minAvailabilityPct && c.reliability?.availabilityPct &&
            c.reliability.availabilityPct < constraints.minAvailabilityPct) {
            feasible = false;
            rationale.push({
                engine: 'reliability',
                observation: `Availability ${c.reliability.availabilityPct}% < required ${constraints.minAvailabilityPct}%`,
                rule: 'availability < min → raise redundancy/tier',
                conclusion: 'Increase redundancy or tier',
                severity: 'critical',
            });
        }

        // ── Rule 5: schedule constraint ───────────────────────────────────────
        if (constraints.deadlineMonths && c.capex?.timelineMonths &&
            c.capex.timelineMonths > constraints.deadlineMonths) {
            recommendations.push({
                title: 'Consider modular / phased delivery',
                detail: `Estimated ${c.capex.timelineMonths} mo build exceeds the ${constraints.deadlineMonths} mo deadline — modular construction or phasing can pull in first-power.`,
                confidence: 0.65,
                tags: ['schedule', 'construction'],
            });
            rationale.push({
                engine: 'construction',
                observation: `Timeline ${c.capex.timelineMonths} mo > deadline ${constraints.deadlineMonths} mo`,
                rule: 'timeline > deadline → modular/phased delivery',
                conclusion: 'Recommend phasing',
                severity: 'warn',
            });
        }

        // ── Rule 6: ROI read ──────────────────────────────────────────────────
        const roiYears = c.financial?.paybackYears;
        if (roiYears != null && isFinite(roiYears)) {
            const good = roiYears <= 7;
            rationale.push({
                engine: 'financial',
                observation: `Payback ≈ ${roiYears.toFixed(1)} yr (IRR ${c.financial?.irrPct?.toFixed(1) ?? '—'}%)`,
                rule: 'payback ≤ 7 yr → attractive; else review revenue/opex',
                conclusion: good ? 'Return profile is attractive' : 'Return profile needs review',
                severity: good ? 'info' : 'warn',
            });
        }

        // ── Objective-aware nudges ────────────────────────────────────────────
        if (objectives.includes('minCarbon')) {
            recommendations.push({
                title: 'Add on-site renewables / PPA',
                detail: 'A solar-PV + BESS blend or a renewable PPA cuts Scope-2 emissions materially at these loads.',
                confidence: 0.6,
                tags: ['carbon', 'renewables'],
            });
        }

        // ── Confidence & summary ──────────────────────────────────────────────
        const dataCoverage = [c.capex, c.opex, c.financial, c.carbon, c.reliability]
            .filter(Boolean).length / 5;
        const confidence = clamp01(0.45 + 0.5 * dataCoverage);

        const tierLabel = `Tier ${recommendedTier}${recommendedTier === 3 && recommendedTier !== c.inputs.tier ? '+' : ''}`;
        const summary = feasible
            ? `${tierLabel} · ${itLoadMw ? itLoadMw.toFixed(0) + ' MW' : 'capacity TBD'}${c.financial?.paybackYears ? ' · payback ~' + c.financial.paybackYears.toFixed(1) + ' yr' : ''} — feasible within the stated constraints.`
            : `Not feasible as configured — see critical items below.`;

        return {
            summary,
            recommendations,
            rationale,
            metrics: { feasible, roiYears: roiYears ?? undefined, confidence },
            provider: 'deterministic',
            generatedFor: { itLoadKw, tier: recommendedTier, region: c.inputs.region },
            disclaimer: DECISION_DISCLAIMER,
        };
    },
};
