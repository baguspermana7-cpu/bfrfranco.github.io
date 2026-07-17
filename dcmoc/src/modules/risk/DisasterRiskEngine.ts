// ─── DISASTER RISK ENGINE ───────────────────────────────────
// Natural disaster risk scoring and cost impact assessment
// 2026 update: Added wildfire + extreme heat risk factors;
// updated insurance rates to reflect 2025 hardening market;
// seismic weights updated per USGS NSHM 2023 model

import { CountryProfile } from '@/constants/countries';
import { rzModels } from '@/lib/rz-engine';

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
    insuranceTrend: string; // market hardening context
}

export const calculateDisasterRisk = (input: DisasterRiskInput): DisasterRiskResult => {
    const { country, totalCapex, itLoadKw, annualRevenue } = input;
    const disaster = country.naturalDisaster;

    // Input guards
    const safeCapex = Math.max(0, totalCapex || 0);
    const safeRevenue = Math.max(0, annualRevenue || 0);

    // Defaults
    const seismicZone = disaster?.seismicZone ?? 1;
    const floodRisk = disaster?.floodRisk ?? 'low';
    const typhoonRisk = disaster?.typhoonRisk ?? 'none';
    const volcanoRisk = disaster?.volcanoRisk ?? 'none';
    const tsunamiRisk = disaster?.tsunamiRisk ?? 'none';
    const insuranceMultiplier = disaster?.insuranceMultiplier ?? 1.0;
    const structuralReinforcement = disaster?.structuralReinforcement ?? 0.0;

    // --- Score Breakdown (2026: weights updated, wildfire added) ---
    // Seismic: USGS NSHM 2023 — Zone 0=0, Zone1=15, Zone2=45, Zone3=75, Zone4=100
    const seismicScore = seismicZone === 0 ? 0 : seismicZone === 1 ? 15 : seismicZone === 2 ? 45 : seismicZone === 3 ? 75 : 100;
    const floodScore = floodRisk === 'extreme' ? 100 : floodRisk === 'high' ? 70 : floodRisk === 'moderate' ? 40 : 10;
    const typhoonScore = typhoonRisk === 'high' ? 100 : typhoonRisk === 'moderate' ? 60 : typhoonRisk === 'low' ? 25 : 0;
    const volcanoScore = volcanoRisk === 'moderate' ? 80 : volcanoRisk === 'low' ? 30 : 0;
    const tsunamiScore = tsunamiRisk === 'high' ? 100 : tsunamiRisk === 'moderate' ? 60 : tsunamiRisk === 'low' ? 25 : 0;

    // Wildfire risk proxy (2026): derived from flood+seismic region context
    // US West Coast, AU, Mediterranean, Southern Africa: elevated wildfire
    const wildfireScore = ['AU', 'US', 'CL', 'PT', 'GR', 'ZA'].includes(country.id)
        ? (seismicZone >= 2 ? 50 : 30) // West Coast / Mediterranean proxy
        : ['ID', 'MY', 'TH'].includes(country.id) ? 35 // peat fire risk
        : 5;

    // 2026 weights: seismic 28%, flood 22%, typhoon 18%, volcano 12%, tsunami 10%, wildfire 10%
    const hazards = {
        seismic: seismicZone / 4,
        flood: floodRisk === 'extreme' ? 1 : floodRisk === 'high' ? 0.7 : floodRisk === 'moderate' ? 0.4 : 0.1,
        typhoon: typhoonRisk === 'high' ? 1 : typhoonRisk === 'moderate' ? 0.6 : typhoonRisk === 'low' ? 0.25 : 0,
        volcano: volcanoRisk === 'moderate' ? 0.8 : volcanoRisk === 'low' ? 0.3 : 0,
        tsunami: tsunamiRisk === 'high' ? 1 : tsunamiRisk === 'moderate' ? 0.6 : tsunamiRisk === 'low' ? 0.25 : 0,
    };
    const riskModel = rzModels().risk;
    const engineGeo = riskModel && typeof riskModel.geo === 'function' ? riskModel.geo(hazards) : null;
    const compositeScore = engineGeo ? Math.min(100, Math.round(engineGeo.risk)) : Math.min(100, Math.round(
        seismicScore * 0.28 + floodScore * 0.22 + typhoonScore * 0.18 +
        volcanoScore * 0.12 + tsunamiScore * 0.10 + wildfireScore * 0.10
    ));

    const riskCategory: 'Low' | 'Moderate' | 'High' | 'Extreme' =
        compositeScore >= 70 ? 'Extreme' : compositeScore >= 45 ? 'High' : compositeScore >= 20 ? 'Moderate' : 'Low';

    // --- Insurance Cost ---
    // 2026 market hardening: Property/casualty DC insurance +15-25% YoY (Marsh 2025)
    // Base rate now 0.18% of replacement value for standard Tier III facility
    // High-risk: 0.25-0.40% (seismic zone 3+, extreme flood)
    const baseInsuranceRate = compositeScore >= 60 ? 0.0035 : compositeScore >= 35 ? 0.0022 : 0.0018;
    const annualInsuranceCost = Math.round(safeCapex * baseInsuranceRate * Math.max(1.0, insuranceMultiplier));

    // --- Structural Reinforcement ---
    const structuralCostAdder = Math.round(safeCapex * Math.max(0, structuralReinforcement));

    // --- Expected Annual Loss ---
    // Probability-based: composite score maps to annual loss probability
    // 2026: Munich Re / Swiss Re data: ~0.08% per 10-point composite
    const annualLossProbability = compositeScore / 1250; // ~0.08% per 10 points
    const potentialLoss = safeCapex * 0.15 + safeRevenue * 0.25; // 15% of asset + 25% of revenue
    const expectedAnnualLoss = Math.round(annualLossProbability * potentialLoss);

    // --- Business Interruption ---
    const businessInterruptionDays = Math.max(0, Math.round(compositeScore * 0.12));
    const dailyRevenue = safeRevenue / 365;
    const revenueAtRisk = Math.round(businessInterruptionDays * dailyRevenue);

    // Insurance trend context
    const insuranceTrend = compositeScore >= 60
        ? 'Extreme risk market — expect 20-40% YoY premium increases (Marsh 2025)'
        : compositeScore >= 35
        ? 'Moderate risk — market hardening +10-20% (property/casualty, 2026)'
        : 'Low-moderate risk — standard market rates apply (~+5-8% 2026)';

    // --- Risk Breakdown ---
    const riskBreakdown = [
        { type: 'Seismic', score: seismicScore, weight: 28, impact: seismicZone >= 3 ? 'Critical' : seismicZone >= 2 ? 'Moderate' : 'Low' },
        { type: 'Flood', score: floodScore, weight: 22, impact: floodRisk === 'extreme' || floodRisk === 'high' ? 'Critical' : floodRisk === 'moderate' ? 'Moderate' : 'Low' },
        { type: 'Typhoon/Cyclone', score: typhoonScore, weight: 18, impact: typhoonRisk === 'high' ? 'Critical' : typhoonRisk === 'moderate' ? 'Moderate' : 'Low' },
        { type: 'Volcano', score: volcanoScore, weight: 12, impact: volcanoRisk === 'moderate' ? 'Critical' : volcanoRisk === 'low' ? 'Low' : 'None' },
        { type: 'Tsunami', score: tsunamiScore, weight: 10, impact: tsunamiRisk === 'high' ? 'Critical' : tsunamiRisk === 'moderate' ? 'Moderate' : 'Low' },
        { type: 'Wildfire', score: wildfireScore, weight: 10, impact: wildfireScore >= 50 ? 'Moderate' : wildfireScore >= 30 ? 'Low' : 'None' },
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

    // Add wildfire mitigation if relevant
    if (wildfireScore >= 30) {
        const cost = safeCapex * 0.015;
        const reduction = 12;
        mitigationOptions.push({
            name: 'Ember-resistant Envelope + Defensible Zone',
            cost: Math.round(cost),
            riskReduction: reduction,
            roi: Math.round((expectedAnnualLoss * reduction / 100 * 20) / Math.max(1, cost) * 100) / 100,
            description: 'Non-combustible exterior cladding, cleared perimeter zone, and HVAC intake ember filters.',
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
        insuranceTrend,
    };
};
