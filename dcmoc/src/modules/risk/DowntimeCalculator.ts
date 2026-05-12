/**
 * Calculates financial risk associated with downtime and SLA breaches.
 * Based on Uptime Institute Tier Standards (2025) & Business Criticality.
 *
 * Tier availability figures (Uptime Institute Tier Standard 2025):
 *  Tier II  — 99.741%  → 1,361 min/yr  (~22.7 hours)   [unchanged]
 *  Tier III — 99.982%  → 95.3 min/yr   (~1.6 hours)    [unchanged]
 *  Tier IV  — 99.9999% → 0.4 min/yr    (26 min/yr target; Uptime Institute quotes ≤26.3 min)
 *
 * Downtime cost benchmarks (Uptime Institute 2025 Global DC Survey):
 *  - Median major outage cost: $1.0M–$1.9M
 *  - Severe outage (>$1M): affects ~26% of organizations
 *  - Average cost per minute: $8,000–$12,000 for Tier III/IV colocation
 *  - Significant uplift since 2021 due to AI workloads and SLA penalties
 */

import { CountryProfile } from '@/constants/countries';

export interface DowntimeRisk {
    tier: 2 | 3 | 4;
    availability: number;
    availabilityNines: string; // e.g. "3.65 nines"
    expectedDowntimeMinutes: number;
    expectedDowntimeHours: number;
    financialImpact: number;
    slaBreachProbability: 'Low' | 'Medium' | 'High';
    costPerMinute: number;
    annualEventProbability: number; // Probability of ≥1 outage event per year
}

// Uptime Institute Tier Standard 2025
// Tier II: "Redundant capacity" — 99.741%, 1361 min/yr
// Tier III: "Concurrently maintainable" — 99.982%, 95 min/yr
// Tier IV: "Fault tolerant" — 99.9999% theoretical; standard benchmarks to 26 min/yr
const TIER_STATS = {
    2: { name: 'Tier II',  availability: 99.741,  downtimeMinutes: 1361, nines: '2.57 nines', annualEventProb: 0.92 },
    3: { name: 'Tier III', availability: 99.982,  downtimeMinutes: 95,   nines: '3.74 nines', annualEventProb: 0.35 },
    4: { name: 'Tier IV',  availability: 99.99943, downtimeMinutes: 26,  nines: '4.26 nines', annualEventProb: 0.08 },
};

// A5: Country-specific downtime cost with configurable override
// 2026 update: Uptime Institute 2025 benchmarks show median cost per minute
// for critical outages is now $8K-$12K/min for Tier III/IV; $2K-$5K for Tier II.
export const calculateDowntimeRisk = (
    tierLevel: 2 | 3 | 4,
    costPerMinute?: number,
    slaResponseTimeHours: number = 4,
    country?: CountryProfile
): DowntimeRisk => {
    const validTier = ([2, 3, 4] as const).includes(tierLevel as 2 | 3 | 4) ? tierLevel : 3;
    const stats = TIER_STATS[validTier];

    // 2026 defaults: Uptime Institute Global DC Survey 2025
    // Tier II median: ~$2,500/min (smaller facilities, less critical SLAs)
    // Tier III median: ~$8,000/min (mission-critical enterprise / colo)
    // Tier IV median: ~$12,000/min (financial services, hyperscale)
    const defaultCostPerMin = validTier === 4 ? 12000 : validTier === 3 ? 8000 : 2500;

    // Use provided cost, then country cost, then tier-specific default
    const rawCostPerMin = costPerMinute ?? country?.risk?.downtimeCostPerMin ?? defaultCostPerMin;
    const effectiveCostPerMin = Math.max(100, rawCostPerMin); // floor at $100/min

    // Financial Impact = expected annual downtime × cost per minute
    const financialImpact = stats.downtimeMinutes * effectiveCostPerMin;

    // SLA Breach Probability based on tier and response SLA
    let probability: 'Low' | 'Medium' | 'High' = 'Low';
    if (validTier === 2) probability = 'High';
    else if (validTier === 3 && slaResponseTimeHours < 4) probability = 'Medium';
    else if (validTier === 3 && slaResponseTimeHours >= 4) probability = 'Medium';
    else probability = 'Low'; // Tier IV

    return {
        tier: validTier,
        availability: stats.availability,
        availabilityNines: stats.nines,
        expectedDowntimeMinutes: stats.downtimeMinutes,
        expectedDowntimeHours: Math.round(stats.downtimeMinutes / 60 * 10) / 10,
        financialImpact: Math.round(financialImpact),
        slaBreachProbability: probability,
        costPerMinute: effectiveCostPerMin,
        annualEventProbability: stats.annualEventProb,
    };
};
