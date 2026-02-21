/**
 * Calculates financial risk associated with downtime and SLA breaches.
 * Based on Uptime Institute Tier Standards & Business Criticiality.
 */

export interface DowntimeRisk {
    tier: 2 | 3 | 4;
    availability: number;
    expectedDowntimeMinutes: number;
    financialImpact: number;
    slaBreachProbability: 'Low' | 'Medium' | 'High';
}

const TIER_STATS = {
    2: { name: 'Tier II', availability: 99.741, downtimeMinutes: 1361 }, // ~22.7 hours
    3: { name: 'Tier III', availability: 99.982, downtimeMinutes: 95 },  // ~1.6 hours
    4: { name: 'Tier IV', availability: 99.995, downtimeMinutes: 26 }    // ~0.4 hours
};

export const calculateDowntimeRisk = (
    tierLevel: 2 | 3 | 4,
    costPerMinute: number = 5000, // Default $5k/min for enterprise
    slaResponseTimeHours: number = 4
): DowntimeRisk => {
    const stats = TIER_STATS[tierLevel];

    // Financial Impact
    const financialImpact = stats.downtimeMinutes * costPerMinute;

    // SLA Breach Probability
    // If expected downtime events (MTTR) exceed SLA response, risk is high.
    // Simplifying: Tier 2 has single paths, higher failure prob.
    let probability: 'Low' | 'Medium' | 'High' = 'Low';

    if (tierLevel === 2) probability = 'High';
    if (tierLevel === 3 && slaResponseTimeHours < 4) probability = 'Medium';
    if (tierLevel === 4) probability = 'Low';

    return {
        tier: tierLevel,
        availability: stats.availability,
        expectedDowntimeMinutes: stats.downtimeMinutes,
        financialImpact,
        slaBreachProbability: probability
    };
};
