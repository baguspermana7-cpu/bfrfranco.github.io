
import { CountryProfile } from '@/constants/countries';
import { AssetCount } from '@/lib/AssetGenerator';

export interface RiskScenario {
    id: string;
    category: 'Natural' | 'Operational' | 'Financial' | 'Labor';
    title: string;
    description: string;
    probability: 'Low' | 'Medium' | 'High' | 'Critical';
    impact: 'Low' | 'Medium' | 'High' | 'Catastrophic';
    mitigation: string;
}

export const calculateRiskProfile = (
    country: CountryProfile,
    tierLevel: 3 | 4,
    assets: AssetCount[]
): RiskScenario[] => {
    const risks: RiskScenario[] = [];

    // 1. Natural Risks (Geo-based)
    // 1. Natural Risks (Geo-based)
    if (country.id === 'ID') {
        risks.push({
            id: 'risk-seismic',
            category: 'Natural',
            title: 'Seismic Activity',
            description: 'High probability of earthquakes in the Ring of Fire region.',
            probability: 'High',
            impact: 'Catastrophic',
            mitigation: 'Ensure structural compliance with SNI 1726:2019 via Seismic isolating dampers.'
        });
    } else if (country.id === 'JP') {
        risks.push({
            id: 'risk-seismic',
            category: 'Natural',
            title: 'Seismic Activity (JIS)',
            description: 'Major fault lines. Frequent tremors.',
            probability: 'High',
            impact: 'Catastrophic',
            mitigation: 'Strict adherence to JIS A 0101 and base isolation systems.'
        });
    } else if (country.id === 'US') {
        risks.push({
            id: 'risk-seismic-us',
            category: 'Natural',
            title: 'Seismic Risk (San Andreas)',
            description: 'Dependent on state. CA highly vulnerable.',
            probability: 'Medium',
            impact: 'High',
            mitigation: 'ASCE 7-16 compliance for data centers category IV.'
        });
    }

    if (country.id === 'ID' || country.id === 'SG' || country.id === 'MY') {
        risks.push({
            id: 'risk-humidity',
            category: 'Natural',
            title: 'High Humidity / Condensation',
            description: 'Tropical climate leading to latent cooling load spikes and potential condensation.',
            probability: 'High',
            impact: 'Medium',
            mitigation: 'Dehumidification coils in PAUs and vapour barrier enforcement.'
        });
    }

    if (country.id === 'ID' && tierLevel < 4) {
        risks.push({
            id: 'risk-flood',
            category: 'Natural',
            title: 'Flash Flooding',
            description: 'Monsoon season risk for ground-level infrastructure.',
            probability: 'Medium',
            impact: 'High',
            mitigation: 'Elevate critical plant 1.2m above 100-year flood line.'
        });
    }

    // 2. Operational Risks (Asset-based)
    const singlePoints = assets.filter(a => a.count === 1 && !a.assetId.includes('access') && !a.assetId.includes('cctv'));
    if (singlePoints.length > 0) {
        risks.push({
            id: 'risk-spof',
            category: 'Operational',
            title: 'Single Points of Failure (SPOF)',
            description: `Identified ${singlePoints.length} assets with N redundancy (e.g. ${singlePoints[0].assetId}).`,
            probability: 'Medium',
            impact: 'High',
            mitigation: 'Maintain critical spares on-site and 4-hour SLA vendor contracts.'
        });
    }

    if (tierLevel === 3) {
        risks.push({
            id: 'risk-maint',
            category: 'Operational',
            title: 'Concurrent Maintainability Gaps',
            description: 'Tier III requires active path maintenance without downtime. Human error risk during switching.',
            probability: 'Medium',
            impact: 'High',
            mitigation: 'Strict MOP/SOP adherence and electrical interlock checks.'
        });
    }

    // 3. Labor Risks
    if (country.id === 'ID') {
        risks.push({
            id: 'risk-labor-ot',
            category: 'Labor',
            title: 'Overtime Compliance (PP 35/2021)',
            description: 'Strict limits on overtime (4h/day, 18h/week). Exceeding this poses legal and burnout risks.',
            probability: 'High',
            impact: 'Medium',
            mitigation: 'Implement 4-shift roster or increase headcount to reduce OT dependency.'
        });
    }

    return risks;
};

// --- Numeric helpers for risk matrix ---
const PROBABILITY_MAP: Record<string, number> = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };
const IMPACT_MAP: Record<string, number> = { 'Low': 1, 'Medium': 2, 'High': 3, 'Catastrophic': 4 };

export interface RiskMatrixCell {
    likelihood: number; // 1-5
    impact: number; // 1-5
    score: number;
    risks: RiskScenario[];
}

export interface RiskAggregation {
    totalScore: number; // Sum of all individual scores
    maxScore: number; // Theoretical max
    normalizedScore: number; // 0-100
    matrix: RiskMatrixCell[][];
    topRisks: (RiskScenario & { score: number })[];
    slaBreachProbability: number; // 0-1
    fiveYearProjection: { year: number; score: number; label: string }[];
}

export const calculateRiskScore = (risks: RiskScenario[], tierLevel: 3 | 4): RiskAggregation => {
    // Build 5x5 matrix
    const matrix: RiskMatrixCell[][] = Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => ({
            likelihood: col + 1,
            impact: row + 1,
            score: (col + 1) * (row + 1),
            risks: []
        }))
    );

    // Place each risk in matrix
    const scored = risks.map(r => {
        const prob = PROBABILITY_MAP[r.probability] || 2;
        const imp = IMPACT_MAP[r.impact] || 2;
        const score = prob * imp;
        if (prob <= 5 && imp <= 5) {
            matrix[imp - 1][prob - 1].risks.push(r);
        }
        return { ...r, score };
    });

    const totalScore = scored.reduce((a, r) => a + r.score, 0);
    const maxScore = risks.length * 16; // Max possible = 4*4 per risk

    // SLA breach probability based on tier
    const baseSLA = tierLevel === 4 ? 0.005 : 0.025;
    const riskFactor = totalScore / Math.max(maxScore, 1);
    const slaBreachProbability = Math.min(0.95, baseSLA + riskFactor * 0.15);

    // 5-year projection (risk grows ~5-8% per year without mitigation)
    const growthRate = 0.06;
    const fiveYearProjection = Array.from({ length: 6 }, (_, i) => ({
        year: 2025 + i,
        score: Math.round(totalScore * Math.pow(1 + growthRate, i)),
        label: i === 0 ? 'Baseline' : `Year ${i}`
    }));

    return {
        totalScore,
        maxScore,
        normalizedScore: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
        matrix,
        topRisks: scored.sort((a, b) => b.score - a.score),
        slaBreachProbability,
        fiveYearProjection
    };
};
