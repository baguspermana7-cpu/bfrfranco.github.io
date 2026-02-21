
import { CountryProfile } from '@/constants/countries';
import { StaffingResult } from '@/modules/staffing/ShiftEngine';
import { CapexResult } from '@/lib/CapexEngine';
import { FinancialResult } from '@/modules/analytics/FinancialEngine';
import { calculateStrategyComparison, calculateSLAComparison } from '@/modules/maintenance/MaintenanceStrategyEngine';
import { AssetCount } from '@/lib/AssetGenerator';

export interface ExecSummarySection {
    id: string;
    title: string;
    content: string;
    keyMetric?: string;
    status: 'positive' | 'neutral' | 'negative';
}

/**
 * Generates a C-Suite level narrative summary of the entire simulation.
 * Uses rule-based logic to construct natural language paragraphs.
 */
export const generateExecutiveSummary = (
    country: CountryProfile,
    inputs: any,
    capex: CapexResult | null,
    finance: FinancialResult | null,
    staffing: { eng: StaffingResult; tech: StaffingResult } | null,
    maintenance: { strategy: any; sla: any } | null
): ExecSummarySection[] => {
    const sections: ExecSummarySection[] = [];

    // Validations
    if (!capex || !finance || !staffing) {
        return [{
            id: 'error',
            title: 'Simulation Incomplete',
            content: 'Please configure CAPEX, Staffing, and Financial parameters to generate the executive summary.',
            status: 'neutral'
        }];
    }

    // 1. OPENING HOOK
    // ════════════════════════════════════════════════
    const safeFinance = finance as FinancialResult;
    const safeCapex = capex as CapexResult;
    const safeStaffing = staffing as { eng: StaffingResult; tech: StaffingResult };

    const tierLabel = `Tier ${inputs.tierLevel}`;
    const powerLabel = `${(inputs.itLoad / 1000).toFixed(1)}MW`;
    const locLabel = `${country.name}`;

    const taxRate = inputs.taxRate || 0.25;
    sections.push({
        id: 'overview',
        title: 'Strategic Overview',
        content: `This feasibility study evaluates a ${powerLabel} ${tierLabel} data center deployment in ${locLabel}. The simulation projects a ${(safeFinance.irr).toFixed(1)}% Internal Rate of Return (IRR) over a ${inputs.projectLifeYears}-year lifecycle, driven by a ${inputs.powerRedundancy} power topology and ${inputs.coolingType} cooling architecture. market conditions in ${country.name} present a ${taxRate < 0.25 ? 'favorable' : 'challenging'} tax environment (${(taxRate * 100).toFixed(0)}%).`,
        keyMetric: `${(safeFinance.irr).toFixed(1)}% IRR`,
        status: safeFinance.irr > inputs.discountRate * 100 ? 'positive' : 'negative'
    });

    // 2. FINANCIAL PERFORMANCE
    // ════════════════════════════════════════════════
    const npvMillions = (safeFinance.npv / 1_000_000).toFixed(1);
    const payback = safeFinance.paybackPeriodYears.toFixed(1);
    const roi = safeFinance.roiPercent.toFixed(0);

    let finNarrative = `The project requires an initial CAPEX investment of $${(safeCapex.total / 1_000_000).toFixed(1)}M. `;
    if (safeFinance.npv > 0) {
        finNarrative += `Financial projections are strong, yielding a Net Present Value (NPV) of $${npvMillions}M and a payback period of ${payback} years. The Return on Investment (ROI) stands at ${roi}%, indicating healthy capital efficiency.`;
    } else {
        finNarrative += `Financial projections indicate challenges, with a negative NPV of $${npvMillions}M. The project may need value engineering or revenue optimization to meet the ${(inputs.discountRate * 100).toFixed(0)}% hurdle rate.`;
    }

    sections.push({
        id: 'financial',
        title: 'Financial Viability',
        content: finNarrative,
        keyMetric: `$${npvMillions}M NPV`,
        status: safeFinance.npv > 0 ? 'positive' : 'negative'
    });

    // 3. OPERATIONAL STRATEGY
    // ════════════════════════════════════════════════
    const shiftModel = inputs.shiftModel === '8h' ? '3-Shift (8h)' : '2-Shift (12h)';
    const staffingModel = inputs.staffingModel;
    const headcount = safeStaffing.eng.headcount + safeStaffing.tech.headcount;
    const maintStrategy = inputs.maintenanceStrategy; // 'statutory' | 'standard' | 'ultimate'

    let opsNarrative = `Operations will utilize a ${staffingModel} model with ${headcount} FTEs on a ${shiftModel} roster. `;

    if (maintStrategy === 'reactive') {
        opsNarrative += `The selected 'Reactive' maintenance strategy minimizes upfront OPEX but exposes the facility to higher risk of unplanned downtime and emergency repair costs.`;
    } else if (maintStrategy === 'predictive') {
        opsNarrative += `The 'ultimate/predictive' maintenance strategy ensures maximum reliability through sensor-driven interventions, though it carries a higher OPEX premium.`;
    } else {
        opsNarrative += `A 'Standard' maintenance strategy balances cost and reliability, adhering to SFG20/ASHRAE guidelines.`;
    }

    sections.push({
        id: 'operations',
        title: 'Operational Strategy & Maintenance',
        content: opsNarrative,
        keyMetric: `${maintStrategy} Strat`,
        status: maintStrategy === 'reactive' && inputs.tierLevel > 2 ? 'negative' : 'neutral'
    });

    // 4. RISK & SUSTAINABILITY
    // ════════════════════════════════════════════════
    const availability = inputs.tierLevel === 4 ? 99.995 : inputs.tierLevel === 3 ? 99.982 : 99.741;
    const downtime = inputs.tierLevel === 4 ? 26 : inputs.tierLevel === 3 ? 95 : 1361;
    const pue = safeCapex.pue;

    let riskNarrative = `The ${inputs.tierLevel === 4 ? 'Fault Tolerant' : 'Concurrent Maintainable'} design confirms a projected availability of ${availability}%, with an estimated annual downtime of ${downtime} minutes. `;

    if (pue < 1.4) {
        riskNarrative += `Sustainability metrics are excellent with a design PUE of ${pue.toFixed(2)}, minimizing Scope 2 carbon footprint. `;
    } else {
        riskNarrative += `Design PUE is ${pue.toFixed(2)}, which may face scrutiny in strict regulatory markets. Consider liquid cooling options to improve efficiency. `;
    }

    // C2: Add benchmark context
    const industryAvgPUE = 1.58;
    const pueDelta = ((industryAvgPUE - pue) / industryAvgPUE * 100).toFixed(0);
    if (pue < industryAvgPUE) {
        riskNarrative += `This represents a ${pueDelta}% improvement over the industry average PUE of ${industryAvgPUE}, translating to significant long-term energy savings.`;
    } else {
        riskNarrative += `The design PUE is above the industry average of ${industryAvgPUE}. Immediate efficiency interventions are recommended.`;
    }

    sections.push({
        id: 'risk',
        title: 'Risk & Sustainability',
        content: riskNarrative,
        keyMetric: `${pue.toFixed(2)} PUE`,
        status: pue < 1.5 ? 'positive' : 'neutral'
    });

    // C2: 5. MARKET CONTEXT & RECOMMENDATION (New section)
    // ════════════════════════════════════════════════
    const escalation = country.economy?.laborEscalation ?? 0.05;
    let marketNarrative = `The ${country.name} market presents `;
    if (escalation < 0.04) {
        marketNarrative += `stable labor costs with annual escalation of ${(escalation * 100).toFixed(1)}%, favorable for long-term OPEX predictability. `;
    } else if (escalation < 0.07) {
        marketNarrative += `moderate labor cost pressure with ${(escalation * 100).toFixed(1)}% annual escalation, requiring careful headcount management. `;
    } else {
        marketNarrative += `aggressive labor cost inflation at ${(escalation * 100).toFixed(1)}% per annum, which will significantly impact 5-year TCO. `;
    }

    // C14: Industry benchmark comparison
    const benchPerKw = safeCapex.metrics.perKw;
    const industryAvgPerKw = 12000; // Industry average $/kW
    const staffingRatio = headcount / (inputs.itLoad / 1000); // FTEs per MW
    const industryStaffRatio = 8; // Industry benchmark

    marketNarrative += `CAPEX efficiency is $${Math.round(benchPerKw).toLocaleString()}/kW (industry avg: $${industryAvgPerKw.toLocaleString()}/kW). `;
    marketNarrative += `Staffing density of ${staffingRatio.toFixed(1)} FTEs/MW ${staffingRatio <= industryStaffRatio ? 'is within' : 'exceeds'} the industry benchmark of ${industryStaffRatio} FTEs/MW.`;

    sections.push({
        id: 'market',
        title: 'Market Context & Benchmarks',
        content: marketNarrative,
        keyMetric: `$${Math.round(benchPerKw).toLocaleString()}/kW`,
        status: benchPerKw <= industryAvgPerKw ? 'positive' : 'neutral'
    });

    return sections;
};

// ═══════════════════════════════════════════════════════════════
// INDIVIDUAL SECTION NARRATIVE GENERATORS
// ═══════════════════════════════════════════════════════════════

export const generateCapexSectionNarrative = (capex: CapexResult, tier: number, loc: string): string => {
    const totalM = (capex.total / 1_000_000).toFixed(1);
    const perKw = capex.metrics.perKw.toFixed(0);
    const timeline = capex.metrics.timelineMonths;

    let text = `The total estimated capital expenditure (CAPEX) for this Tier ${tier} facility in ${loc} is $${totalM} Million, which translates to $${perKw} per kW of IT load. `;

    if (capex.metrics.perKw < 8000) {
        text += `This indicates a highly cost-efficient build, reflecting favorable local construction markets and an optimized value-engineered design. `;
    } else if (capex.metrics.perKw > 15000) {
        text += `This premium cost per kW is driven by high-redundancy requirements, specialized cooling systems, and premium labor markets. `;
    } else {
        text += `This aligns with industry averages for enterprise-grade data centers in this region. `;
    }

    text += `The projected timeline for delivery, spanning design through commissioning, is estimated at ${timeline} months.`;

    return text;
};

export const generateTCONarrative = (finance: FinancialResult): string => {
    const irr = finance.irr.toFixed(1);
    const payback = finance.paybackPeriodYears.toFixed(1);
    const npv = (finance.npv / 1_000_000).toFixed(1);

    let text = `Over the analysis period, the project demonstrates a ${irr}% Internal Rate of Return (IRR) achieving payback in ${payback} years. The cumulative Net Present Value (NPV) stands at $${npv}M. `;

    if (finance.npv > 0) {
        text += `These metrics suggest a highly viable commercial model, capable of absorbing moderate escalations in OPEX without compromising profitability.`;
    } else {
        text += `The negative NPV indicates that the current revenue assumptions or capital outlays do not meet the targeted hurdle rate. Strategic value engineering or tariff adjustments are recommended.`;
    }

    return text;
};

export const generateCostWaterfallNarrative = (capex: CapexResult, finance: FinancialResult, totalOpex: number): string => {
    const capexPct = (capex.total / (capex.total + totalOpex)) * 100;
    const opexPct = 100 - capexPct;

    let text = `Total Cost of Ownership (TCO) is heavily influenced by the initial CAPEX (${capexPct.toFixed(0)}%) relative to the lifetime OPEX (${opexPct.toFixed(0)}%). `;

    if (capexPct > 60) {
        text += `The model is CAPEX-heavy, typical for high-tier facilities. Strategies to optimize day-one footprint, such as phased modular build-outs, could improve near-term cash flow.`;
    } else {
        text += `The model shifts a significant portion of costs to OPEX, making the operation highly sensitive to utility rate hikes and labor market escalations over the lifecycle.`;
    }

    return text;
};

export const generateMaintenanceNarrative = (strategy: any, sla: any, spares: any): string => {
    let text = '';
    if (strategy && strategy.recommended) {
        text += `The recommended localized asset strategy is ${strategy.recommended.toUpperCase()}. ${strategy.recommendationReason} `;
    }
    if (sla && sla.recommended) {
        text += `${sla.analysis} `;
    }
    if (spares && spares.criticalSpares > 0) {
        text += `Inventory optimization highlights ${spares.criticalSpares} critical spares requiring on-site caching to maintain SLAs.`;
    }
    return text;
};

export const generateRiskNarrative = (riskAgg: any): string => {
    if (!riskAgg) return "Risk analysis pending.";

    const score = riskAgg.normalizedScore;
    let text = `The facility's overall quantified risk score is ${score}/100. `;

    if (score < 30) {
        text += `This represents a Low Risk profile, indicating strong design resilience and favorable environmental factors. `;
    } else if (score < 60) {
        text += `This is a Medium Risk profile, driven by specific geographic or operational vulnerabilities that require active mitigation via SLA and maintenance rigor. `;
    } else {
        text += `This indicates a High Risk environment, heavily exposed to systemic vulnerabilities or extreme single points of failure. Immediate design remediation is advised. `;
    }

    if (riskAgg.topRisks && riskAgg.topRisks.length > 0) {
        text += `The primary concern is "${riskAgg.topRisks[0].title}" (${riskAgg.topRisks[0].probability} probability, ${riskAgg.topRisks[0].impact} impact).`;
    }

    return text;
};

export const generateCarbonNarrative = (carbon: any): string => {
    if (!carbon) return "Carbon analysis pending.";

    const total = carbon.annualEmissionsTonCO2.toFixed(1);
    const pue = carbon.pueEfficiency.toFixed(2);
    const rating = carbon.efficiencyRating;
    const renewablePct = carbon.renewableReductionPct.toFixed(1);

    let text = `The facility's total projected annual carbon footprint is ${total} tCO₂. `;

    if (rating === 'A' || rating === 'B') {
        text += `This represents an excellent Efficiency Rating (${rating}), significantly outperforming industry averages. `;
    } else if (rating === 'C') {
        text += `This indicates an average Efficiency Rating (C), in line with standard facilities operating at a PUE of ${pue}. `;
    } else {
        text += `The Efficiency Rating is poor (${rating}). Immediate consideration of liquid cooling retrofits or aggressive renewable procurement is advised. `;
    }

    if (carbon.renewableReductionPct > 0) {
        text += `Renewable energy strategies successfully offset ${renewablePct}% of total emissions, reducing overall tax exposure. `;
    } else {
        text += `The facility currently relies completely on grid power. Securing green PPAs or on-site renewable generation could significantly mitigate future regulatory penalties.`;
    }

    return text;
};
