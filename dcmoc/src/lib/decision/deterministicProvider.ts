/* ─── LAYER 13 · DETERMINISTIC DECISION PROVIDER (no LLM) ─────────────────────
 * A "super-intelligent" rule algorithm that reads the engine-output snapshot and
 * emits explainable, ALWAYS-ON recommendations — it does not need user-set
 * constraints to have something valid to say. When a constraint is absent it
 * derives a best-practice target (tier availability, cooling PUE band, cost/kW
 * band) and reasons against that. Pure + deterministic + unit-testable — same
 * inputs always yield the same result. Every rule appends a RationaleStep so the
 * "why" is fully traceable in the UI. Guidance only — not investment advice.
 * ──────────────────────────────────────────────────────────────────────────── */

import type {
    DecisionProvider, DecisionRequest, DecisionResult, RationaleStep,
    DecisionRecommendation, Tier, EngineId,
} from './types';
import { DECISION_DISCLAIMER } from './types';

// ── Descriptive planning benchmarks (Uptime Institute tier availability, JLL/
//    CBRE 2025 build-cost ranges, ASHRAE/industry PUE bands). These are honest
//    planning heuristics for guidance, NOT a substitute for the CapexEngine. ──
const TIER_CAPEX_MULT: Record<Tier, number> = { 2: 1.0, 3: 1.35, 4: 1.85 };
const TIER_AVAILABILITY: Record<Tier, number> = { 2: 99.741, 3: 99.982, 4: 99.995 };
// $/kW all-in build band by tier (mid-market, 2025 USD).
const PERKW_BAND: Record<Tier, { lean: number; premium: number }> = {
    2: { lean: 7000, premium: 10000 },
    3: { lean: 10000, premium: 15000 },
    4: { lean: 15000, premium: 22000 },
};
// Best-practice design PUE by cooling family.
const PUE_TARGET: Record<string, number> = { air: 1.5, inrow: 1.4, rdhx: 1.35, liquid: 1.2, immersion: 1.1 };
// Tier → the redundancy topology the design should carry.
const TIER_REDUNDANCY: Record<Tier, string[]> = { 2: ['n', 'n+1'], 3: ['n+1', 'n1', '2n'], 4: ['2n', '2n1', '2n+1'] };

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }
function normRed(r?: string): string { return (r || '').toLowerCase().replace(/\s+/g, ''); }
const SEV_WEIGHT: Record<RationaleStep['severity'], number> = { info: 1, warn: 2, critical: 3 };

export const deterministicProvider: DecisionProvider = {
    id: 'deterministic',

    async decide(req: DecisionRequest): Promise<DecisionResult> {
        const { context: c, constraints = {}, objectives = [] } = req;
        const rationale: RationaleStep[] = [];
        const recs: (DecisionRecommendation & { _sev?: number })[] = [];

        const push = (rec: DecisionRecommendation, step: RationaleStep) => {
            recs.push({ ...rec, _sev: SEV_WEIGHT[step.severity] });
            rationale.push(step);
        };
        const note = (step: RationaleStep) => rationale.push(step);

        const itLoadKw = c.inputs.itLoadKw || 0;
        const itLoadMw = itLoadKw / 1000;
        const tier = c.inputs.tier;
        let recommendedTier: Tier = tier;
        let feasible = true;

        // ── Rule 1: budget vs tier feasibility (constraint-driven) ────────────
        const knownCapex = c.capex?.totalUsd;
        if (constraints.budgetUsd && knownCapex && knownCapex > 0) {
            if (knownCapex > constraints.budgetUsd) {
                const perTierBase = knownCapex / TIER_CAPEX_MULT[tier];
                const fits = ([4, 3, 2] as Tier[]).find((t) => perTierBase * TIER_CAPEX_MULT[t] <= constraints.budgetUsd!);
                if (fits && fits < tier) {
                    recommendedTier = fits;
                    push({
                        title: `Target Tier ${fits}${fits === 3 ? '+' : ''} instead of Tier ${tier}`,
                        detail: `Tier ${tier} CAPEX ≈ $${(knownCapex / 1e6).toFixed(1)}M exceeds the $${(constraints.budgetUsd / 1e6).toFixed(1)}M budget. Tier ${fits} holds ${TIER_AVAILABILITY[fits]}% availability while fitting the envelope.`,
                        confidence: 0.8, tags: ['tier', 'budget', 'capex'],
                    }, { engine: 'capex', observation: `Tier ${tier} CAPEX ≈ $${(knownCapex / 1e6).toFixed(1)}M > budget $${(constraints.budgetUsd / 1e6).toFixed(1)}M`, rule: 'budget < tierCapex → downgrade to the highest tier that fits', conclusion: `Recommend Tier ${fits}${fits === 3 ? '+' : ''}`, severity: 'warn' });
                } else if (!fits) {
                    feasible = false;
                    push({
                        title: 'Reduce IT load or raise the budget',
                        detail: `Even Tier 2 CAPEX exceeds the $${(constraints.budgetUsd / 1e6).toFixed(1)}M budget at ${itLoadMw.toFixed(1)} MW. Right-size the first phase or increase funding.`,
                        confidence: 0.85, tags: ['budget', 'capacity'],
                    }, { engine: 'capex', observation: `Even Tier 2 CAPEX > budget $${(constraints.budgetUsd / 1e6).toFixed(1)}M`, rule: 'no tier fits budget → infeasible at this capacity', conclusion: 'Reduce load or raise budget', severity: 'critical' });
                }
            } else {
                note({ engine: 'capex', observation: `CAPEX ≈ $${(knownCapex / 1e6).toFixed(1)}M within the $${(constraints.budgetUsd / 1e6).toFixed(1)}M budget`, rule: 'capex ≤ budget → tier is affordable', conclusion: `Tier ${tier} is fundable`, severity: 'info' });
            }
        }

        // ── Rule 2: cost/kW vs benchmark band (always-on) ─────────────────────
        const perKw = c.capex?.perKw;
        if (perKw && perKw > 0) {
            const band = PERKW_BAND[tier];
            if (perKw > band.premium) {
                push({
                    title: 'Cost/kW is above the tier benchmark',
                    detail: `$${Math.round(perKw).toLocaleString()}/kW sits above the Tier ${tier} premium band (~$${(band.premium / 1000).toFixed(0)}k). Review cooling topology, redundancy scope, and site/market premiums — value-engineer toward the standard band.`,
                    confidence: 0.7, tags: ['capex', 'cost', 'value-engineering'],
                }, { engine: 'capex', observation: `Cost/kW $${Math.round(perKw).toLocaleString()} > Tier ${tier} premium ~$${band.premium.toLocaleString()}`, rule: 'perKw > tier premium band → value-engineer', conclusion: 'Flag cost premium', severity: 'warn' });
            } else if (perKw < band.lean) {
                note({ engine: 'capex', observation: `Cost/kW $${Math.round(perKw).toLocaleString()} below Tier ${tier} lean band ~$${band.lean.toLocaleString()}`, rule: 'perKw < lean band → verify scope completeness', conclusion: 'Lean cost — confirm nothing is under-scoped', severity: 'info' });
            } else {
                note({ engine: 'capex', observation: `Cost/kW $${Math.round(perKw).toLocaleString()} within the Tier ${tier} benchmark band`, rule: 'lean ≤ perKw ≤ premium → on-benchmark', conclusion: 'Build cost is on-benchmark', severity: 'info' });
            }
        }

        // ── Rule 3: PUE vs best-in-class band (always-on) ─────────────────────
        const cooling = (c.inputs.coolingType || 'air').toLowerCase();
        const pue = c.carbon?.pue;
        const pueTarget = constraints.maxPue ?? PUE_TARGET[cooling] ?? 1.5;
        if (pue && pue > 0) {
            if (pue > pueTarget + 0.03) {
                const canLiquid = cooling === 'air' || cooling === 'inrow';
                push({
                    title: canLiquid ? 'Improve PUE — cooling upgrade available' : `Improve PUE toward ≤ ${pueTarget.toFixed(2)}`,
                    detail: `Modelled PUE ${pue.toFixed(2)} is above the ${pueTarget.toFixed(2)} target for ${cooling} cooling. ${canLiquid ? 'Direct liquid / rear-door cooling, ' : ''}higher chilled-water temperatures and air-side/water-side economisation are the primary levers.`,
                    confidence: 0.72, tags: ['pue', 'cooling', 'sustainability'],
                }, { engine: 'sustainability', observation: `PUE ${pue.toFixed(2)} > target ${pueTarget.toFixed(2)} (${cooling})`, rule: 'pue > cooling-band target → efficiency intervention', conclusion: 'Flag PUE gap', severity: 'warn' });
            } else {
                note({ engine: 'sustainability', observation: `PUE ${pue.toFixed(2)} ≤ target ${pueTarget.toFixed(2)}`, rule: 'pue ≤ band target → efficient', conclusion: 'Cooling efficiency meets best-practice', severity: 'info' });
            }
        }

        // ── Rule 4: availability vs tier target (always-on) ───────────────────
        const avail = c.reliability?.availabilityPct;
        const availTarget = constraints.minAvailabilityPct ?? TIER_AVAILABILITY[tier];
        if (avail != null) {
            if (avail < availTarget - 0.002) {
                feasible = feasible && !constraints.minAvailabilityPct;
                push({
                    title: 'Raise redundancy to hit the tier availability target',
                    detail: `Modelled availability ${avail.toFixed(3)}% is below the Tier ${tier} target ${availTarget.toFixed(3)}%. Add UPS/generator/distribution redundancy or concurrent-maintainability paths to close the gap.`,
                    confidence: 0.75, tags: ['reliability', 'redundancy', 'tier'],
                }, { engine: 'reliability', observation: `Availability ${avail.toFixed(3)}% < Tier ${tier} target ${availTarget.toFixed(3)}%`, rule: 'availability < tier target → raise redundancy', conclusion: 'Increase redundancy', severity: constraints.minAvailabilityPct ? 'critical' : 'warn' });
            } else {
                note({ engine: 'reliability', observation: `Availability ${avail.toFixed(3)}% ≥ Tier ${tier} target ${availTarget.toFixed(3)}%`, rule: 'availability ≥ target → meets tier', conclusion: 'Design meets its tier availability', severity: 'info' });
            }
        }

        // ── Rule 5: redundancy ↔ tier consistency (always-on) ─────────────────
        const red = normRed(c.inputs.redundancy);
        if (red) {
            const expected = TIER_REDUNDANCY[tier];
            if (!expected.some((e) => red.includes(e) || e.includes(red))) {
                const under = tier === 4 && !red.startsWith('2n');
                push({
                    title: under ? 'Redundancy is light for the target tier' : 'Check redundancy ↔ tier alignment',
                    detail: `Tier ${tier} typically carries ${expected.join(' / ').toUpperCase()} topology; the design specifies "${c.inputs.redundancy}". ${under ? 'Move to 2N for fault tolerance,' : 'Confirm the topology matches the tier claim,'} or restate the tier so the availability math is consistent.`,
                    confidence: 0.68, tags: ['redundancy', 'tier', 'consistency'],
                }, { engine: 'reliability', observation: `Redundancy "${c.inputs.redundancy}" vs Tier ${tier} expected ${expected.join('/').toUpperCase()}`, rule: 'redundancy topology must match tier claim', conclusion: 'Flag tier/redundancy mismatch', severity: under ? 'warn' : 'info' });
            }
        }

        // ── Rule 6: OPEX intensity (always-on) ────────────────────────────────
        if (c.opex?.annualUsd && knownCapex && knownCapex > 0) {
            const ratio = c.opex.annualUsd / knownCapex; // annual run-rate as % of capex
            if (ratio > 0.12) {
                push({
                    title: 'Operating run-rate is high vs CAPEX',
                    detail: `Annual OPEX is ${(ratio * 100).toFixed(1)}% of CAPEX (healthy ≈ 6–10%). Energy price, PUE, and staffing model are the main drivers — a PUE or staffing-model change compounds over the asset life.`,
                    confidence: 0.66, tags: ['opex', 'tco', 'efficiency'],
                }, { engine: 'operations', observation: `OPEX/CAPEX ${(ratio * 100).toFixed(1)}% > healthy ~10%`, rule: 'opex intensity > band → attack run-rate', conclusion: 'Flag high run-rate', severity: 'warn' });
            } else {
                note({ engine: 'operations', observation: `OPEX/CAPEX ${(ratio * 100).toFixed(1)}% within healthy band`, rule: 'opex intensity in band → efficient run-rate', conclusion: 'Operating run-rate is healthy', severity: 'info' });
            }
        }

        // ── Rule 7: financial read (always-on recommendation) ─────────────────
        const roiYears = c.financial?.paybackYears;
        const irr = c.financial?.irrPct;
        const npv = c.financial?.npvUsd;
        if (roiYears != null && isFinite(roiYears)) {
            const good = roiYears <= 7 && (irr == null || irr >= 12);
            if (good) {
                push({
                    title: 'Return profile is attractive',
                    detail: `Payback ≈ ${roiYears.toFixed(1)} yr${irr != null ? `, IRR ${irr.toFixed(1)}%` : ''}${npv != null ? `, NPV ${npv >= 0 ? '+' : ''}$${(npv / 1e6).toFixed(1)}M` : ''}. The illustrative economics clear a typical hurdle — validate with real lease/PPA terms in the Financial engine.`,
                    confidence: 0.6, tags: ['financial', 'roi'],
                }, { engine: 'financial', observation: `Payback ≈ ${roiYears.toFixed(1)} yr, IRR ${irr?.toFixed(1) ?? '—'}%`, rule: 'payback ≤ 7 yr & IRR ≥ 12% → attractive', conclusion: 'Return profile is attractive', severity: 'info' });
            } else {
                push({
                    title: 'Strengthen the return profile',
                    detail: `Payback ≈ ${roiYears.toFixed(1)} yr${irr != null ? `, IRR ${irr.toFixed(1)}%` : ''} is below a typical hurdle. Levers: raise realised $/kW revenue, phase CAPEX to defer spend, or cut OPEX via PUE — test them in the Financial engine.`,
                    confidence: 0.64, tags: ['financial', 'roi', 'revenue'],
                }, { engine: 'financial', observation: `Payback ≈ ${roiYears.toFixed(1)} yr, IRR ${irr?.toFixed(1) ?? '—'}%`, rule: 'payback > 7 yr or IRR < 12% → review revenue/opex/phasing', conclusion: 'Return profile needs work', severity: 'warn' });
            }
        }

        // ── Rule 8: density → cooling (always-on) ─────────────────────────────
        const density = itLoadMw >= 10 ? 'high' : itLoadMw >= 3 ? 'medium' : 'low';
        if ((cooling === 'air' || !c.inputs.coolingType) && density === 'high') {
            push({
                title: 'Adopt direct liquid cooling',
                detail: `At ${itLoadMw.toFixed(1)} MW the thermal density favours liquid/immersion cooling — materially lower PUE and rack footprint than air, and it de-risks future AI/HPC density.`,
                confidence: 0.75, tags: ['cooling', 'pue', 'architecture'],
            }, { engine: 'architecture', observation: `IT load ${itLoadMw.toFixed(1)} MW is high-density on air`, rule: 'high MW density on air → liquid cooling wins on PUE/footprint', conclusion: 'Recommend liquid cooling', severity: 'info' });
        }

        // ── Rule 9: schedule length (always-on, even without a deadline) ──────
        const months = c.capex?.timelineMonths;
        if (months && (constraints.deadlineMonths ? months > constraints.deadlineMonths : months > 30)) {
            const over = constraints.deadlineMonths ? ` exceeds the ${constraints.deadlineMonths} mo deadline` : ' is long for a single-shot build';
            push({
                title: 'Consider modular / phased delivery',
                detail: `Estimated ${months} mo build${over}. Modular construction or phasing pulls in first-power/first-revenue and de-risks supply-chain lead times (switchgear, generators).`,
                confidence: 0.6, tags: ['schedule', 'construction', 'phasing'],
            }, { engine: 'construction', observation: `Timeline ${months} mo${over}`, rule: 'long timeline → modular/phased delivery', conclusion: 'Recommend phasing', severity: constraints.deadlineMonths ? 'warn' : 'info' });
        }

        // ── Rule 10: site score (always-on) ───────────────────────────────────
        const siteScore = c.site?.score;
        if (siteScore != null && siteScore < 60) {
            push({
                title: 'Mitigate site weaknesses',
                detail: `Composite site score ${siteScore}/100 is below the comfortable band. Revisit the weakest factors (power/grid, water, latency, hazard) or weigh an alternative site before committing CAPEX.`,
                confidence: 0.62, tags: ['site', 'risk'],
            }, { engine: 'site', observation: `Site score ${siteScore}/100 < 60`, rule: 'low site score → mitigate or reconsider siting', conclusion: 'Flag site weakness', severity: 'warn' });
        }

        // ── Rule 11: carbon / sustainability (objective- or scale-driven) ─────
        const tonnes = c.carbon?.annualTonnes;
        if (objectives.includes('minCarbon') || (tonnes && tonnes > 20000)) {
            push({
                title: 'Add on-site renewables / PPA + heat reuse',
                detail: `${tonnes ? `≈ ${Math.round(tonnes).toLocaleString()} tCO₂e/yr at PUE ${pue?.toFixed(2) ?? '—'}. ` : ''}A solar-PV + BESS blend or a renewable PPA cuts Scope-2 materially; waste-heat reuse improves the ESG and TCO story.`,
                confidence: 0.6, tags: ['carbon', 'renewables', 'esg'],
            }, { engine: 'sustainability', observation: `${tonnes ? `Carbon ≈ ${Math.round(tonnes).toLocaleString()} tCO₂e/yr` : 'minCarbon objective set'}`, rule: 'high carbon or minCarbon objective → renewables/PPA/heat-reuse', conclusion: 'Recommend decarbonisation levers', severity: 'info' });
        }

        // ── Objective-aware ranking + top-N cap ───────────────────────────────
        const OBJ_TAGS: Record<string, string[]> = {
            maxRoi: ['roi', 'financial', 'cost', 'capex', 'revenue'], minCost: ['cost', 'capex', 'value-engineering', 'opex'],
            minCarbon: ['carbon', 'renewables', 'pue', 'sustainability', 'esg'], maxReliability: ['reliability', 'redundancy', 'tier'],
            fastestDelivery: ['schedule', 'construction', 'phasing'],
        };
        const objTags = new Set(objectives.flatMap((o) => OBJ_TAGS[o] || []));
        const score = (r: DecisionRecommendation & { _sev?: number }) =>
            (r._sev ?? 1) * 10 + r.confidence * 5 + (r.tags.some((t) => objTags.has(t)) ? 4 : 0);
        recs.sort((a, b) => score(b) - score(a));
        const recommendations: DecisionRecommendation[] = recs.slice(0, 6).map(({ _sev, ...r }) => { void _sev; return r; });

        // ── Never-empty guarantee: a positive confirmation when nothing flagged ─
        if (recommendations.length === 0) {
            recommendations.push({
                title: 'Design is balanced — no material flags',
                detail: `Tier ${tier} · ${itLoadMw.toFixed(1)} MW · PUE ${pue?.toFixed(2) ?? '—'}${roiYears != null ? ` · payback ~${roiYears.toFixed(1)} yr` : ''}. Cost, efficiency, reliability, and schedule all sit within best-practice bands. Set a budget/PUE/deadline constraint to stress-test further.`,
                confidence: clamp01(0.5 + 0.1 * rationale.length), tags: ['balanced', 'confirmation'],
            });
        }

        // ── Confidence & summary ──────────────────────────────────────────────
        const dataCoverage = [c.capex, c.opex, c.financial, c.carbon, c.reliability, c.site]
            .filter(Boolean).length / 6;
        const confidence = clamp01(0.4 + 0.5 * dataCoverage);
        const flags = rationale.filter((r) => r.severity !== 'info').length;
        const tierLabel = `Tier ${recommendedTier}${recommendedTier === 3 && recommendedTier !== tier ? '+' : ''}`;
        const headline = recommendations[0]?.title;
        const summary = !feasible
            ? `Not feasible as configured — ${headline ?? 'see the critical items below'}.`
            : `${tierLabel} · ${itLoadMw ? itLoadMw.toFixed(0) + ' MW' : 'capacity TBD'}${pue ? ' · PUE ' + pue.toFixed(2) : ''}${roiYears != null ? ' · payback ~' + roiYears.toFixed(1) + ' yr' : ''} — ${flags > 0 ? `${flags} optimization${flags > 1 ? 's' : ''} identified` : 'balanced within best-practice bands'}.`;

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

// re-export for callers that want the engine id list without importing types
export type { EngineId };
