// ─── GRID RELIABILITY ENGINE ────────────────────────────────
// Evaluates power grid quality and calculates backup infrastructure costs

import { CountryProfile } from '@/constants/countries';
import { getPUE } from '@/constants/pue';
import { rzData, rzModels } from '@/lib/rz-engine';

/* ─── Backup-economics constants (sourced, screening) — X-audit Y-slice hoist.
 * One place instead of inline literals scattered through the calc:
 *  · diesel $/L    — IEA 2025 commercial/industrial band $1.10-1.40, 2026 midpoint
 *  · UPS $/kW·yr   — blended VRLA $26-30 / Li-ion $18-22 at the ~60/40 fleet
 *                    mix shift (Uptime 2025)
 *  · dual-feed     — second utility feed annualized $/kW (screening)
 *  · BESS $/kWh    — BloombergNEF 2026 C&I benchmark (down from ~$400 in 2023)
 * Fuel rate itself comes from DATA.fuelGen.genEfficiencyLPerKwh (EPA Tier 4
 * Final, same source FuelGenEngine uses) with a parity fallback.            */
const DIESEL_PRICE_USD_PER_L = 1.25;
const UPS_REPLACEMENT_USD_PER_KW_YR = 27;
const DUAL_FEED_USD_PER_KW_YR = 50;
const BESS_USD_PER_KWH = 300;

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

    const localScore = Math.round(uptimeScore * 0.4 + voltageScore * 0.2 + brownoutScore * 0.2 + durationScore * 0.2);
    const gridModel = rzModels().grid;
    const reliabilityScore = gridModel && typeof gridModel.score === 'function'
        ? Math.round(localScore * 0.5 + gridModel.score(gridUptime) * 100 * 0.5)
        : localScore;

    const reliabilityGrade: 'A' | 'B' | 'C' | 'D' | 'F' =
        reliabilityScore >= 90 ? 'A' : reliabilityScore >= 75 ? 'B' : reliabilityScore >= 55 ? 'C' : reliabilityScore >= 35 ? 'D' : 'F';

    // --- Outage Estimation ---
    // DM audit phase 3: `gridReliability.brownoutFrequency` + `averageOutageDuration` existed in
    // COUNTRIES but were dead in the engine-present path (outage minutes came from the uptime-SAIDI
    // model alone). When BOTH country fields are present we now blend two independent estimates:
    //   saidiMin   = uptime-derived SAIDI minutes (RZEngine grid.annualOutageHours(uptime)×60;
    //                local fallback (100−uptime)% × 525,600 min/yr — same math)
    //   eventMin   = brownoutFrequency × averageOutageDuration   (event-based, from country data)
    //   outage minutes/yr = 0.5·saidiMin + 0.5·eventMin          (equal-weight blend, screening)
    //   outages/yr        = brownoutFrequency + saidiMin / max(averageOutageDuration, 1)
    //                       (brownout events + sustained-outage events implied by SAIDI at the
    //                        country's average outage duration — categories are additive)
    // Fallback when either field is absent: legacy formulas verbatim (defaults 5 events / 15 min).
    const engineSaidiMin = gridModel && typeof gridModel.annualOutageHours === 'function'
        ? gridModel.annualOutageHours(gridUptime) * 60
        : null;
    const hasOutageData = grid?.brownoutFrequency != null && grid?.averageOutageDuration != null;
    const legacyExpectedOutages = brownoutFreq + Math.round((100 - gridUptime) * 365 / 100);
    const uptimeSaidiMin = engineSaidiMin ?? ((100 - gridUptime) / 100) * 525600;
    const annualExpectedOutages = hasOutageData
        ? Math.round(brownoutFreq + uptimeSaidiMin / Math.max(avgOutageDuration, 1))
        : legacyExpectedOutages;
    const annualOutageMinutes = hasOutageData
        ? Math.round(0.5 * uptimeSaidiMin + 0.5 * brownoutFreq * avgOutageDuration)
        : (engineSaidiMin ?? legacyExpectedOutages * avgOutageDuration);

    // --- Generator Sizing ---
    const pue = getPUE(coolingType);
    const redundancyFactor = tierLevel === 4 ? 2.0 : tierLevel === 3 ? 1.5 : 1.25;
    const requiredGenCapacity = Math.ceil(itLoadKw * pue * redundancyFactor);

    // Fuel hours recommendation
    const recommendedFuelHours = Math.max(recommendedGenHoursBase, gridTier === 3 ? 168 : gridTier === 2 ? 72 : 48);

    // --- Cost Calculations ---
    // Fuel rate: DATA.fuelGen (EPA Tier 4 Final ~0.27 L/kWh @ 75% load) — same
    // single source FuelGenEngine reads; diesel price from the sourced constant.
    const fuelConsumptionRate = (rzData().fuelGen as { genEfficiencyLPerKwh?: number } | undefined)?.genEfficiencyLPerKwh ?? 0.27; // L/kWh
    const fuelPricePerLiter = DIESEL_PRICE_USD_PER_L;
    const expectedRunHoursPerYear = (annualOutageMinutes / 60) + (recommendedFuelHours * 0.12); // runtime + monthly/quarterly tests
    const annualFuelCost = Math.round(
        requiredGenCapacity * expectedRunHoursPerYear * fuelConsumptionRate * fuelPricePerLiter * (1 + backupFuelPremium)
    );

    // UPS battery stress from brownouts (blended $/kW·yr sourced constant above)
    const brownoutStressFactor = Math.min(2.0, 1.0 + brownoutFreq * 0.02);
    const baseUpsReplacementCost = itLoadKw * UPS_REPLACEMENT_USD_PER_KW_YR;
    const annualUpsReplacementCost = Math.round(baseUpsReplacementCost * brownoutStressFactor);

    // Dual feed recommendation
    const dualFeedRecommendation = gridTier >= 2 || reliabilityScore < 70 || tierLevel >= 3;

    // Dual feed cost (if recommended)
    const dualFeedCost = dualFeedRecommendation ? Math.round(itLoadKw * DUAL_FEED_USD_PER_KW_YR) : 0; // annualized second-feed

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

    // Battery storage ROI (years to payback) — BESS $/kWh sourced constant above
    const bessCostPerKwh = BESS_USD_PER_KWH;
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
