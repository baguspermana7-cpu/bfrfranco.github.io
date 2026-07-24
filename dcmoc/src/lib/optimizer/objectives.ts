/* ─── Optimizer objectives (Workstream U) ────────────────────────────────────
 * Headless objective evaluators for the Executive "Run Optimization" action.
 * Each objective re-runs the SAME importable pure models the pages render
 * from — never a second estimate. No LLM; deterministic; preview-then-Apply
 * only (the caller writes stores AFTER an explicit user Apply).
 *
 * PARITY NOTE (blended IRR): the phased-finance verdict closure lives inside
 * PhasedFinancialDashboard's useMemo and cannot be imported without editing
 * that page (owned by a parallel workstream). This file therefore MIRRORS its
 * phase cash-flow parameterization line-for-line — same engines, same
 * constants ($50/kW·yr opex base, 12% hurdle, 10% base discount + disaster
 * risk premium, 20-yr life, 3% escalation, capex-weighted IRR). Any change
 * to the page's phase model MUST be reflected here (drift = wrong optimizer
 * verdicts). Preferred end-state: the page imports THIS closure.
 * ──────────────────────────────────────────────────────────────────────── */

import { calculateCapacityPlan } from '@/modules/capacity/CapacityPlanningEngine';
import { calculateFinancials } from '@/modules/analytics/FinancialEngine';
import { calculateDisasterRisk } from '@/modules/risk/DisasterRiskEngine';
import { calculateGridReliability } from '@/modules/infrastructure/GridReliabilityEngine';
import { calculateTalentAvailability } from '@/modules/staffing/TalentAvailabilityEngine';
import type { CountryProfile } from '@/constants/countries';
import { DEFAULT_REVENUE_PER_KW_MONTH } from '@/constants/finance';

export interface BlendedPhase {
    id: string;
    label: string;
    itLoadKw: number;
    startMonth: number;
    buildMonths: number;
    occupancyRamp: number[];
}

/** Subset of the simulation-store inputs the blended-IRR model consumes. */
export interface BlendedSimInputs {
    capacityPhases: BlendedPhase[];
    coolingType: 'air' | 'inrow' | 'rdhx' | 'liquid';
    tierLevel: 2 | 3 | 4;
    shiftModel: '8h' | '12h';
    maintenanceModel: 'in-house' | 'vendor' | 'hybrid';
    hybridRatio: number;
    revenuePerKwMonth?: number;
}

export interface BlendedIrrClosure {
    baseRev: number;
    /** capex-weighted blended IRR (%) at a candidate revenue $/kW·mo. */
    computeIrrAt: (rev: number) => number;
    /** summed phase NPV ($) at a candidate revenue $/kW·mo. */
    computeNpvAt: (rev: number) => number;
}

/** Build the phased-finance blended-IRR closure headlessly — the EXACT
 *  parameterization PhasedFinancialDashboard uses for its verdict (see the
 *  parity note above). Returns null when no country is selected. */
export function buildBlendedIrrClosure(country: CountryProfile | null, sim: BlendedSimInputs): BlendedIrrClosure | null {
    if (!country || sim.capacityPhases.length === 0) return null;

    // 1. Capacity plan — same engine call as the page.
    const capPlan = calculateCapacityPlan({
        phases: sim.capacityPhases,
        country,
        coolingType: sim.coolingType,
        tierLevel: sim.tierLevel,
        shiftModel: sim.shiftModel,
        maintenanceModel: sim.maintenanceModel,
        hybridRatio: sim.hybridRatio,
    });
    if (capPlan.phases.length === 0 || capPlan.totalItLoadKw <= 0) return null;

    const baseRev = sim.revenuePerKwMonth ?? DEFAULT_REVENUE_PER_KW_MONTH;

    // 2. Cross-module adjustments feeding the cash flows (mirrors the page;
    //    the tax-incentive engine call is narrative-only there and omitted).
    const disasterResult = calculateDisasterRisk({
        country,
        totalCapex: capPlan.totalCapex,
        itLoadKw: capPlan.totalItLoadKw,
        annualRevenue: capPlan.totalItLoadKw * baseRev * 12,
    });
    const gridResult = calculateGridReliability({
        country,
        itLoadKw: capPlan.totalItLoadKw,
        tierLevel: sim.tierLevel,
        coolingType: sim.coolingType,
    });
    const lastFte = capPlan.phases[capPlan.phases.length - 1]?.fte ?? 10;
    const talentResult = calculateTalentAvailability({
        country,
        totalFTE: lastFte,
        annualStaffCost: lastFte * 3000 * 12,
    });

    const effectiveTaxRate = country.taxIncentives?.effectiveTaxRate ?? country.economy.taxRate;
    const baseDiscount = 0.10;
    const riskPremium = disasterResult.compositeScore > 50 ? 0.02 : disasterResult.compositeScore > 30 ? 0.01 : 0;
    const adjustedDiscount = baseDiscount + riskPremium;
    const gridOpexAdder = gridResult.gridRiskAdjustedOpex;
    const insuranceOpex = disasterResult.annualInsuranceCost;
    const talentCostAdder = (talentResult.adjustedSalaryMultiplier - 1) * lastFte * 3000 * 12;

    // 3. Per-phase model closures (verdict math = capex-weighted IRR).
    const phaseRunners: { capex: number; run: (revMult: number) => { irr: number; npv: number } }[] = [];
    for (let pi = 0; pi < capPlan.phases.length; pi++) {
        const phase = capPlan.phases[pi];
        const phaseOccRamp = sim.capacityPhases[pi]?.occupancyRamp ?? [0.3, 0.6, 0.85, 0.95];
        const phaseCapex = phase.capex + disasterResult.structuralCostAdder * (phase.itLoadKw / capPlan.totalItLoadKw);
        const phaseOpex = phase.itLoadKw * 50 * 12 + (gridOpexAdder + insuranceOpex + talentCostAdder) * (phase.itLoadKw / capPlan.totalItLoadKw);
        phaseRunners.push({
            capex: phaseCapex,
            run: (revMult: number) => {
                const f = calculateFinancials({
                    totalCapex: phaseCapex,
                    annualOpex: phaseOpex,
                    revenuePerKwMonth: baseRev * revMult,
                    itLoadKw: phase.itLoadKw,
                    discountRate: adjustedDiscount,
                    projectLifeYears: 20,
                    escalationRate: 0.03,
                    opexEscalation: country.economy.inflationRate,
                    occupancyRamp: phaseOccRamp.concat(Array(16).fill(0.95)),
                    taxRate: effectiveTaxRate,
                    depreciationYears: 20,
                });
                return { irr: f.irr, npv: f.npv };
            },
        });
    }
    const totalCapex = phaseRunners.reduce((s, p) => s + p.capex, 0);
    if (totalCapex <= 0) return null;

    const evalAt = (rev: number): { irr: number; npv: number } => {
        const mult = rev / baseRev;
        let wIrr = 0, nSum = 0;
        for (const pr of phaseRunners) {
            const f = pr.run(mult);
            wIrr += f.irr * (pr.capex / totalCapex);
            nSum += f.npv;
        }
        return { irr: wIrr, npv: nSum };
    };

    return {
        baseRev,
        computeIrrAt: (rev) => evalAt(rev).irr,
        computeNpvAt: (rev) => evalAt(rev).npv,
    };
}
