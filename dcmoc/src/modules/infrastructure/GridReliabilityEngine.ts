// ─── GRID RELIABILITY ENGINE ────────────────────────────────
// Evaluates power grid quality and calculates backup infrastructure costs

import { CountryProfile } from '@/constants/countries';
import { getPUE } from '@/constants/pue';

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
    const pue = getPUE(coolingType);
    const redundancyFactor = tierLevel === 4 ? 2.0 : tierLevel === 3 ? 1.5 : 1.25;
    const requiredGenCapacity = Math.ceil(itLoadKw * pue * redundancyFactor);

    // Fuel hours recommendation
    const recommendedFuelHours = Math.max(recommendedGenHoursBase, gridTier === 3 ? 168 : gridTier === 2 ? 72 : 48);

    // --- Cost Calculations ---
    // Fuel cost: diesel generator at 0.27-0.30 L/kWh (modern Tier 4 engines ~0.27 L/kWh)
    // Global diesel (IEA 2025): ~$1.10-$1.40/L for commercial/industrial
    // Using $1.25/L as 2026 global commercial baseline
    const fuelConsumptionRate = 0.27; // L/kWh (Tier 4 Final engines, 2026 standard)
    const fuelPricePerLiter = 1.25;   // USD/L (2026 global commercial diesel benchmark)
    const expectedRunHoursPerYear = (annualOutageMinutes / 60) + (recommendedFuelHours * 0.12); // runtime + monthly/quarterly tests
    const annualFuelCost = Math.round(
        requiredGenCapacity * expectedRunHoursPerYear * fuelConsumptionRate * fuelPricePerLiter * (1 + backupFuelPremium)
    );

    // UPS battery stress from brownouts
    // 2026: VRLA replacement cost $26-$30/kW/yr; Li-ion (now common) $18-$22/kW/yr
    // Using $27/kW/yr blended (60% VRLA, 40% Li-ion market shift per Uptime 2025)
    const brownoutStressFactor = Math.min(2.0, 1.0 + brownoutFreq * 0.02);
    const baseUpsReplacementCost = itLoadKw * 27; // $27/kW/year blended (2026)
    const annualUpsReplacementCost = Math.round(baseUpsReplacementCost * brownoutStressFactor);

    // Dual feed recommendation
    const dualFeedRecommendation = gridTier >= 2 || reliabilityScore < 70 || tierLevel >= 3;

    // Dual feed cost (if recommended)
    const dualFeedCost = dualFeedRecommendation ? Math.round(itLoadKw * 50) : 0; // $50/kW annualized

    // Total grid risk adjusted OPEX
    const gridRiskAdjustedOpex = annualFuelCost + annualUpsReplacementCost + dualFeedCost;

    // Availability with backup: backup covers a fraction of unavailability
    // Tier 4 backup covers 99.9% of outages, Tier 3 covers 99%, Tier 2 covers 95%
    const backupCoverage = tierLevel === 4 ? 0.999 : tierLevel === 3 ? 0.99 : 0.95;
    const unavailabilityPct = (100 - gridUptime) / 100;
    const residualUnavailability = unavailabilityPct * (1 - backupCoverage);
    const availabilityWithBackup = Math.min(99.999, (1 - residualUnavailability) * 100);

    // Solar viability
    const solarViabilityScore = renewableReadiness;

    // Battery storage ROI (years to payback)
    // BNEF 2025/2026: utility-scale BESS ~$220-$270/kWh; commercial/industrial ~$300-$380/kWh
    // Using $300/kWh for DC application (2026 C&I BESS benchmark, BloombergNEF)
    const bessCostPerKwh = 300; // $/kWh (2026 C&I BESS, down from $400 in 2023)
    const bessCapacity = itLoadKw * 0.5; // 30 mins of storage at full IT load
    const bessTotalCost = bessCapacity * bessCostPerKwh;
    const annualBessSavings = annualFuelCost * 0.45 + annualUpsReplacementCost * 0.25; // improved savings with lower BESS cost
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
