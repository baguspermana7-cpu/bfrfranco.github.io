// ─── GRID RELIABILITY ENGINE ────────────────────────────────
// Evaluates power grid quality and calculates backup infrastructure costs

import { CountryProfile } from '@/constants/countries';

export interface GridReliabilityInput {
    country: CountryProfile;
    itLoadKw: number;
    tierLevel: 2 | 3 | 4;
    coolingType: 'air' | 'inrow' | 'rdhx' | 'liquid';
}

export interface GridReliabilityResult {
    reliabilityScore: number;
    reliabilityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    annualExpectedOutages: number;
    annualOutageMinutes: number;
    requiredGenCapacity: number;
    recommendedFuelHours: number;
    annualFuelCost: number;
    annualUpsReplacementCost: number;
    gridRiskAdjustedOpex: number;
    availabilityWithBackup: number;
    dualFeedRecommendation: boolean;
    solarViabilityScore: number;
    batteryStorageROI: number;
    costBreakdown: { label: string; value: number }[];
    countryComparison: { country: string; score: number; uptime: number }[];
}

export const calculateGridReliability = (input: GridReliabilityInput): GridReliabilityResult => {
    const { country, itLoadKw, tierLevel, coolingType } = input;
    const grid = country.gridReliability;

    // Defaults if grid data not available
    const gridUptime = grid?.gridUptime ?? 99.9;
    const voltageStability = grid?.voltageStability ?? 'moderate';
    const brownoutFreq = grid?.brownoutFrequency ?? 5;
    const avgOutageDuration = grid?.averageOutageDuration ?? 15;
    const gridTier = grid?.gridTier ?? 2;
    const backupFuelPremium = grid?.backupFuelPremium ?? 0.05;
    const recommendedGenHoursBase = grid?.recommendedGenHours ?? 48;
    const renewableReadiness = grid?.renewableReadiness ?? 50;

    // --- Score Calculation ---
    // Uptime score (40%): 99.999% = 100, 99% = 50, <95% = 0
    const uptimeScore = Math.max(0, Math.min(100, ((gridUptime - 95) / 5) * 100));

    // Voltage stability (20%)
    const voltageScore = voltageStability === 'stable' ? 100 : voltageStability === 'moderate' ? 50 : 10;

    // Brownout frequency (20%): 0 = 100, 50+ = 0
    const brownoutScore = Math.max(0, 100 - brownoutFreq * 2);

    // Outage duration (20%): <5min = 100, >120min = 0
    const durationScore = Math.max(0, Math.min(100, (120 - avgOutageDuration) / 1.2));

    const reliabilityScore = Math.round(
        uptimeScore * 0.4 + voltageScore * 0.2 + brownoutScore * 0.2 + durationScore * 0.2
    );

    const reliabilityGrade: 'A' | 'B' | 'C' | 'D' | 'F' =
        reliabilityScore >= 90 ? 'A' : reliabilityScore >= 75 ? 'B' : reliabilityScore >= 55 ? 'C' : reliabilityScore >= 35 ? 'D' : 'F';

    // --- Outage Estimation ---
    const annualExpectedOutages = brownoutFreq + Math.round((100 - gridUptime) * 365 / 100);
    const annualOutageMinutes = annualExpectedOutages * avgOutageDuration;

    // --- Generator Sizing ---
    const pue = coolingType === 'liquid' ? 1.08 : coolingType === 'rdhx' ? 1.18 : coolingType === 'inrow' ? 1.28 : 1.35;
    const redundancyFactor = tierLevel === 4 ? 2.0 : tierLevel === 3 ? 1.5 : 1.25;
    const requiredGenCapacity = Math.ceil(itLoadKw * pue * redundancyFactor);

    // Fuel hours recommendation
    const recommendedFuelHours = Math.max(recommendedGenHoursBase, gridTier === 3 ? 168 : gridTier === 2 ? 72 : 48);

    // --- Cost Calculations ---
    // Fuel cost: assume diesel generator at 0.3 liters/kWh, $1.2/liter
    const fuelConsumptionRate = 0.3; // liters per kWh
    const fuelPricePerLiter = 1.2;
    const expectedRunHoursPerYear = (annualOutageMinutes / 60) + (recommendedFuelHours * 0.1); // runtime + monthly tests
    const annualFuelCost = Math.round(
        requiredGenCapacity * expectedRunHoursPerYear * fuelConsumptionRate * fuelPricePerLiter * (1 + backupFuelPremium)
    );

    // UPS battery stress from brownouts
    const brownoutStressFactor = Math.min(2.0, 1.0 + brownoutFreq * 0.02);
    const baseUpsReplacementCost = itLoadKw * 24; // $24/kW/year baseline for VRLA
    const annualUpsReplacementCost = Math.round(baseUpsReplacementCost * brownoutStressFactor);

    // Dual feed recommendation
    const dualFeedRecommendation = gridTier >= 2 || reliabilityScore < 70 || tierLevel >= 3;

    // Dual feed cost (if recommended)
    const dualFeedCost = dualFeedRecommendation ? Math.round(itLoadKw * 50) : 0; // $50/kW annualized

    // Total grid risk adjusted OPEX
    const gridRiskAdjustedOpex = annualFuelCost + annualUpsReplacementCost + dualFeedCost;

    // Availability with backup
    const backupAvailabilityBoost = tierLevel === 4 ? 0.0009 : tierLevel === 3 ? 0.005 : 0.01;
    const availabilityWithBackup = Math.min(99.999, gridUptime + (100 - gridUptime) * (1 - backupAvailabilityBoost / (100 - gridUptime + 0.001)));

    // Solar viability
    const solarViabilityScore = renewableReadiness;

    // Battery storage ROI (years to payback)
    const bessCostPerKwh = 400; // $/kWh
    const bessCapacity = itLoadKw * 0.5; // 30 mins of storage
    const bessTotalCost = bessCapacity * bessCostPerKwh;
    const annualBessSavings = annualFuelCost * 0.4 + annualUpsReplacementCost * 0.2;
    const batteryStorageROI = annualBessSavings > 0 ? Math.round((bessTotalCost / annualBessSavings) * 10) / 10 : 99;

    const costBreakdown = [
        { label: 'Generator Fuel', value: annualFuelCost },
        { label: 'UPS Battery Replacement', value: annualUpsReplacementCost },
        { label: 'Dual Feed (Annualized)', value: dualFeedCost },
    ];

    return {
        reliabilityScore,
        reliabilityGrade,
        annualExpectedOutages,
        annualOutageMinutes,
        requiredGenCapacity,
        recommendedFuelHours,
        annualFuelCost,
        annualUpsReplacementCost,
        gridRiskAdjustedOpex,
        availabilityWithBackup,
        dualFeedRecommendation,
        solarViabilityScore,
        batteryStorageROI,
        costBreakdown,
        countryComparison: [], // populated by dashboard
    };
};
