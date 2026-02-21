// ─── DISASTER RISK ENGINE ───────────────────────────────────
// Natural disaster risk scoring and cost impact assessment

import { CountryProfile } from '@/constants/countries';

export interface DisasterRiskInput {
    country: CountryProfile;
    totalCapex: number;
    itLoadKw: number;
    annualRevenue: number;
}

export interface MitigationOption {
    name: string;
    cost: number;
    riskReduction: number;
    roi: number;
    description: string;
}

export interface DisasterRiskResult {
    compositeScore: number;
    riskCategory: 'Low' | 'Moderate' | 'High' | 'Extreme';
    annualInsuranceCost: number;
    structuralCostAdder: number;
    expectedAnnualLoss: number;
    businessInterruptionDays: number;
    revenueAtRisk: number;
    mitigationOptions: MitigationOption[];
    riskBreakdown: { type: string; score: number; weight: number; impact: string }[];
    totalRiskAdjustedCost: number;
}

export const calculateDisasterRisk = (input: DisasterRiskInput): DisasterRiskResult => {
    const { country, totalCapex, itLoadKw, annualRevenue } = input;
    const disaster = country.naturalDisaster;

    // Defaults
    const seismicZone = disaster?.seismicZone ?? 1;
    const floodRisk = disaster?.floodRisk ?? 'low';
    const typhoonRisk = disaster?.typhoonRisk ?? 'none';
    const volcanoRisk = disaster?.volcanoRisk ?? 'none';
    const tsunamiRisk = disaster?.tsunamiRisk ?? 'none';
    const baseCompositeScore = disaster?.compositeScore ?? 20;
    const insuranceMultiplier = disaster?.insuranceMultiplier ?? 1.0;
    const structuralReinforcement = disaster?.structuralReinforcement ?? 0.0;

    // --- Score Breakdown ---
    const seismicScore = seismicZone * 25; // 0-100
    const floodScore = floodRisk === 'extreme' ? 100 : floodRisk === 'high' ? 70 : floodRisk === 'moderate' ? 40 : 10;
    const typhoonScore = typhoonRisk === 'high' ? 100 : typhoonRisk === 'moderate' ? 60 : typhoonRisk === 'low' ? 25 : 0;
    const volcanoScore = volcanoRisk === 'moderate' ? 80 : volcanoRisk === 'low' ? 30 : 0;
    const tsunamiScore = tsunamiRisk === 'high' ? 100 : tsunamiRisk === 'moderate' ? 60 : tsunamiRisk === 'low' ? 25 : 0;

    // Weighted composite
    const compositeScore = Math.round(
        seismicScore * 0.30 + floodScore * 0.25 + typhoonScore * 0.20 + volcanoScore * 0.15 + tsunamiScore * 0.10
    );

    const riskCategory: 'Low' | 'Moderate' | 'High' | 'Extreme' =
        compositeScore >= 70 ? 'Extreme' : compositeScore >= 45 ? 'High' : compositeScore >= 20 ? 'Moderate' : 'Low';

    // --- Insurance Cost ---
    // Base insurance: 0.15% of CAPEX per year for a standard facility
    const baseInsuranceRate = 0.0015;
    const annualInsuranceCost = Math.round(totalCapex * baseInsuranceRate * insuranceMultiplier);

    // --- Structural Reinforcement ---
    const structuralCostAdder = Math.round(totalCapex * structuralReinforcement);

    // --- Expected Annual Loss ---
    // Probability-based: composite score maps to annual loss probability
    const annualLossProbability = compositeScore / 1000; // 0.1% per 10 points
    const potentialLoss = totalCapex * 0.15 + annualRevenue * 0.25; // 15% of asset + 25% of revenue
    const expectedAnnualLoss = Math.round(annualLossProbability * potentialLoss);

    // --- Business Interruption ---
    const businessInterruptionDays = Math.round(compositeScore * 0.15);
    const dailyRevenue = annualRevenue / 365;
    const revenueAtRisk = Math.round(businessInterruptionDays * dailyRevenue);

    // --- Risk Breakdown ---
    const riskBreakdown = [
        { type: 'Seismic', score: seismicScore, weight: 30, impact: seismicZone >= 3 ? 'Critical' : seismicZone >= 2 ? 'Moderate' : 'Low' },
        { type: 'Flood', score: floodScore, weight: 25, impact: floodRisk === 'extreme' || floodRisk === 'high' ? 'Critical' : floodRisk === 'moderate' ? 'Moderate' : 'Low' },
        { type: 'Typhoon/Cyclone', score: typhoonScore, weight: 20, impact: typhoonRisk === 'high' ? 'Critical' : typhoonRisk === 'moderate' ? 'Moderate' : 'Low' },
        { type: 'Volcano', score: volcanoScore, weight: 15, impact: volcanoRisk === 'moderate' ? 'Critical' : volcanoRisk === 'low' ? 'Low' : 'None' },
        { type: 'Tsunami', score: tsunamiScore, weight: 10, impact: tsunamiRisk === 'high' ? 'Critical' : tsunamiRisk === 'moderate' ? 'Moderate' : 'Low' },
    ];

    // --- Mitigation Options ---
    const mitigationOptions: MitigationOption[] = [];

    if (seismicZone >= 2) {
        const cost = totalCapex * 0.05;
        const reduction = 20;
        mitigationOptions.push({
            name: 'Seismic Base Isolation',
            cost: Math.round(cost),
            riskReduction: reduction,
            roi: Math.round((expectedAnnualLoss * reduction / 100 * 20) / cost * 100) / 100,
            description: 'Base isolation system reduces seismic force transfer by 60-80%.',
        });
    }

    if (floodRisk === 'high' || floodRisk === 'extreme') {
        const cost = totalCapex * 0.02;
        const reduction = 15;
        mitigationOptions.push({
            name: 'Elevated Platform + Flood Barriers',
            cost: Math.round(cost),
            riskReduction: reduction,
            roi: Math.round((expectedAnnualLoss * reduction / 100 * 20) / cost * 100) / 100,
            description: 'Raise critical infrastructure 2m above flood plain with deployable barriers.',
        });
    }

    if (typhoonRisk === 'moderate' || typhoonRisk === 'high') {
        const cost = totalCapex * 0.03;
        const reduction = 18;
        mitigationOptions.push({
            name: 'Wind-Rated Envelope (Cat 5)',
            cost: Math.round(cost),
            riskReduction: reduction,
            roi: Math.round((expectedAnnualLoss * reduction / 100 * 20) / cost * 100) / 100,
            description: 'Reinforce roof and walls to withstand 250+ km/h winds.',
        });
    }

    if (compositeScore >= 30) {
        const cost = totalCapex * 0.01;
        const reduction = 10;
        mitigationOptions.push({
            name: 'Geographic Redundancy (DR Site)',
            cost: Math.round(cost * 10), // Ongoing annual cost
            riskReduction: reduction,
            roi: Math.round((revenueAtRisk * reduction / 100) / (cost * 10) * 100) / 100,
            description: 'Active-passive DR site in low-risk location.',
        });
    }

    const totalRiskAdjustedCost = annualInsuranceCost + expectedAnnualLoss + (structuralCostAdder / 20); // Amortized over 20yr

    return {
        compositeScore,
        riskCategory,
        annualInsuranceCost,
        structuralCostAdder,
        expectedAnnualLoss,
        businessInterruptionDays,
        revenueAtRisk,
        mitigationOptions,
        riskBreakdown,
        totalRiskAdjustedCost: Math.round(totalRiskAdjustedCost),
    };
};
