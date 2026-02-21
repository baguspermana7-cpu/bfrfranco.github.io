/**
 * Calculates financial risk associated with downtime and SLA breaches.
 * Based on Uptime Institute Tier Standards & Business Criticiality.
 */

import { CountryProfile } from '@/constants/countries';

export interface DowntimeRisk {
    tier: 2 | 3 | 4;
    availability: number;
    expectedDowntimeMinutes: number;
    financialImpact: number;
    slaBreachProbability: 'Low' | 'Medium' | 'High';
    costPerMinute: number; // Expose for transparency
}

const TIER_STATS = {
    2: { name: 'Tier II', availability: 99.741, downtimeMinutes: 1361 }, // ~22.7 hours
    3: { name: 'Tier III', availability: 99.982, downtimeMinutes: 95 },  // ~1.6 hours
    4: { name: 'Tier IV', availability: 99.995, downtimeMinutes: 26 }    // ~0.4 hours
};

// A5: Country-specific downtime cost with configurable override
export const calculateDowntimeRisk = (
    tierLevel: 2 | 3 | 4,
    costPerMinute?: number,
    slaResponseTimeHours: number = 4,
    country?: CountryProfile
): DowntimeRisk => {
    const stats = TIER_STATS[tierLevel];

    // Use provided cost, then country cost, then fallback to $5000 (US default)
    const effectiveCostPerMin = costPerMinute ?? country?.risk?.downtimeCostPerMin ?? 5000;

    // Financial Impact
    const financialImpact = stats.downtimeMinutes * effectiveCostPerMin;

    // SLA Breach Probability
    let probability: 'Low' | 'Medium' | 'High' = 'Low';

    if (tierLevel === 2) probability = 'High';
    if (tierLevel === 3 && slaResponseTimeHours < 4) probability = 'Medium';
    if (tierLevel === 4) probability = 'Low';

    return {
        tier: tierLevel,
        availability: stats.availability,
        expectedDowntimeMinutes: stats.downtimeMinutes,
        financialImpact,
        slaBreachProbability: probability,
        costPerMinute: effectiveCostPerMin,
    };
};
