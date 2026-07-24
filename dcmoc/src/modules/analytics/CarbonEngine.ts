// ─── CARBON FOOTPRINT / ESG ENGINE ──────────────────────────
// Calculates CO₂ emissions based on grid mix, PUE, and IT load
//
// SHARED-ENGINE DELEGATION (RZEngine v2.3.0, with local fallbacks):
//   - Refrigerant physics (charge kg/kWth, leak %/yr, GWP AR4) come from
//     DATA.refrigerants via a cooling-type → refrigerant-key auto-map.
//   - Carbon offset price comes from DATA.carbon.offsetPrice — same-fact
//     reconciliation: engine $35/tCO₂e (2026 voluntary blend) vs $45 local.
//   - Scope 2 blends rzModels().carbon.annualTonnes() (engine, region-based) with
//     the local per-country gridCarbonIntensity formula; local wins when delta > 30%.
//   - DIESEL_EMISSION_FACTOR + CARBON_TAX_RATE_USD stay LOCAL: they belong
//     to DCMOC's own Scope-1 genset / EU-ETS exposure model.

import { rzData, rzModels } from '@/lib/rz-engine';

export interface CarbonResult {
    // Core metrics
    annualEnergyMWh: number;        // Total annual energy consumption
    annualEmissionsTonCO2: number;  // Total Scope 2 emissions (tCO₂/yr)
    carbonIntensityPerKw: number;   // kgCO₂ per kW of IT load
    pueEfficiency: number;          // PUE used in calculation

    // Breakdown
    itEnergyMWh: number;            // Pure IT energy
    coolingEnergyMWh: number;       // Cooling overhead
    lossEnergyMWh: number;          // Power distribution losses

    // Financial
    carbonOffsetCostUSD: number;    // Cost to offset at market rate
    carbonTaxExposureUSD: number;   // Potential carbon tax liability

    // Renewables
    renewableReductionPct: number;  // % reduction from renewables
    netEmissionsTonCO2: number;     // After renewable offset

    // Benchmarks
    industryAvgEmissions: number;   // Industry average for comparison
    efficiencyRating: 'A' | 'B' | 'C' | 'D' | 'F';

    // Scope breakdown
    scope1: number;  // Direct (generators, fuel, refrigerant leakage)
    scope2: number;  // Indirect (grid electricity)
    scope3: number;  // Supply chain (estimated)
    scope1Refrigerant: number; // Refrigerant leak contribution to Scope 1

    // Reduction scenarios
    reductionScenarios: CarbonReductionScenario[];
}

export interface CarbonReductionScenario {
    name: string;
    description: string;
    investmentUSD: number;
    annualSavingsTonCO2: number;
    annualSavingsUSD: number;
    paybackYears: number;
    color: string;
}

export interface CarbonInputs {
    itLoadKw: number;
    pue: number;
    gridCarbonIntensity: number; // kgCO₂/kWh from country profile
    coolingType: string;
    renewableOption: string;
    fuelHours: number;  // diesel generator fuel storage
    genType: string;
    countryName: string;
}

// ─── CONSTANTS ──────────────────────────────────────────────
// Updated to 2025-2026 values:
// - Voluntary carbon offset price: ~$40-55/tCO₂ (MSCI / Ecosystem Marketplace 2025)
// - EU ETS allowance: ~EUR 55-70/tCO₂ (2025 average ~EUR 63 → ~$68)
// - IEA global grid average: ~0.49 kgCO₂/kWh (2024 IEA Electricity Report)
// - Uptime 2025 industry average PUE: ~1.58 (slightly rising with AI workloads)
const CARBON_OFFSET_PRICE_USD_FALLBACK = 45;   // $/tCO₂ fallback — engine DATA.carbon.offsetPrice ($35, 2026 blend) wins when loaded
const CARBON_TAX_RATE_USD = 68;       // $/tCO₂ (EU ETS 2025-2026, EUR 63 avg → ~$68)
const DIESEL_EMISSION_FACTOR = 2.68;  // kgCO₂ per liter diesel (DEFRA 2025 — unchanged)
const DIESEL_CONSUMPTION_RATE = 0.3;  // liters per kW per hour (typical genset at 75% load)
const INDUSTRY_AVG_PUE = 1.58;        // Global average PUE (Uptime Institute 2025)
const INDUSTRY_AVG_CARBON = 0.49;     // kgCO₂/kWh global average (IEA Electricity 2024-2025)

// Refrigerant GWP factors by cooling type — LOCAL FALLBACK ONLY.
// Live values come from engine DATA.refrigerants via the auto-map below.
const REFRIGERANT_DATA: Record<string, { chargeKgPerKw: number; leakRatePct: number; gwp: number }> = {
    air:    { chargeKgPerKw: 0.15, leakRatePct: 0.05, gwp: 2088 },  // R-410A typical CRAC
    inrow:  { chargeKgPerKw: 0.12, leakRatePct: 0.04, gwp: 2088 },  // R-410A in-row
    rdhx:   { chargeKgPerKw: 0.08, leakRatePct: 0.03, gwp: 1430 },  // R-134a or R-410A
    liquid: { chargeKgPerKw: 0.03, leakRatePct: 0.02, gwp: 675 },   // R-32 or low-GWP
};

// Cooling type → engine refrigerant key (DATA.refrigerants). Liquid maps to
// R-454B (primary R-410A replacement in new DX/DLC trim equipment).
const REFRIGERANT_KEY_BY_COOLING: Record<string, string> = {
    air: 'R410A', inrow: 'R410A', rdhx: 'R134a', liquid: 'R454B',
};

/** Engine-backed refrigerant lookup with local fallback (shape-adapted). */
const getRefrigerantData = (coolingType: string): { chargeKgPerKw: number; leakRatePct: number; gwp: number } => {
    const key = REFRIGERANT_KEY_BY_COOLING[coolingType] ?? REFRIGERANT_KEY_BY_COOLING.air;
    const engine = rzData().refrigerants?.[key];
    if (engine && typeof engine.gwp === 'number') {
        return {
            chargeKgPerKw: engine.chargeKgPerKwth,
            leakRatePct: engine.leakPctYr,
            gwp: engine.gwp,
        };
    }
    return REFRIGERANT_DATA[coolingType] || REFRIGERANT_DATA.air;
};

// ─── MAIN CALCULATION ───────────────────────────────────────
export const calculateCarbonFootprint = (inputs: CarbonInputs): CarbonResult => {
    const { itLoadKw, pue, gridCarbonIntensity, coolingType, renewableOption, fuelHours, genType } = inputs;

    // Annual energy calculation
    const hoursPerYear = 8760;
    const itEnergyMWh = (itLoadKw * hoursPerYear) / 1000;
    const totalEnergyMWh = itEnergyMWh * pue;
    const coolingEnergyMWh = totalEnergyMWh - itEnergyMWh;
    const lossEnergyMWh = totalEnergyMWh * 0.03; // ~3% distribution losses

    // Scope 2: Grid electricity emissions
    const carbonModel = rzModels().carbon;
    // Engine-sourced annual operational tCO₂ (reconciliation)
    // rzModels().carbon.annualTonnes(mw, pue, region, hoursPerYear)
    const itLoadMw = itLoadKw / 1000;
    const engineAnnualTonnes = carbonModel && typeof carbonModel.annualTonnes === 'function'
        ? carbonModel.annualTonnes(itLoadMw, pue, inputs.countryName.substring(0, 2).toUpperCase(), hoursPerYear)
        : null;
    // Scope 2 from local formula (uses per-country gridCarbonIntensity from country profile)
    const localScope2 = (totalEnergyMWh * 1000 * gridCarbonIntensity) / 1000; // tCO₂/yr
    // Blend: if engine value is close (within 30%), average them; else use local (country-specific wins)
    const scope2 = (engineAnnualTonnes !== null && Math.abs(engineAnnualTonnes - localScope2) / Math.max(1, localScope2) < 0.30)
        ? (localScope2 + engineAnnualTonnes) / 2
        : localScope2;

    // Scope 1: Direct emissions (generator testing, ~200h/yr testing + emergency)
    const annualGenTestHours = 200;
    // A9: HVO shows 80% reduction (0.2x factor), not 90% (was 0.1x)
    const hvoFactor = genType === 'hvo' ? 0.2 : 1;
    const dieselLiters = itLoadKw * DIESEL_CONSUMPTION_RATE * annualGenTestHours * hvoFactor;
    const scope1Generators = (dieselLiters * DIESEL_EMISSION_FACTOR) / 1000; // tCO₂/yr

    // A15: Refrigerant leakage Scope 1 (engine DATA.refrigerants, local fallback)
    const refData = getRefrigerantData(coolingType);
    const totalCoolingKw = itLoadKw * (pue - 1); // Cooling capacity approx
    const refrigerantCharge = totalCoolingKw * refData.chargeKgPerKw;
    const annualLeakKg = refrigerantCharge * refData.leakRatePct;
    const scope1Refrigerant = (annualLeakKg * refData.gwp) / 1000; // tCO₂e/yr

    const scope1 = scope1Generators + scope1Refrigerant;

    // Scope 3: Estimated supply chain (typically 10-15% of Scope 1+2 for DC)
    const scope3 = (scope1 + scope2) * 0.12;

    const totalEmissions = scope1 + scope2 + scope3;

    // Renewable reduction
    let renewableReductionPct = 0;
    if (renewableOption === 'solar') renewableReductionPct = 15;
    if (renewableOption === 'solar_bess') renewableReductionPct = 30;
    // Cooling efficiency bonus
    if (coolingType === 'liquid') renewableReductionPct += 5;
    if (coolingType === 'rdhx') renewableReductionPct += 3;

    const netEmissions = totalEmissions * (1 - renewableReductionPct / 100);

    // Financial impact — offset price from engine DATA.carbon.offsetPrice ($35),
    // local $45 fallback (same-fact reconciliation, v2.3.0)
    const offsetPrice = rzData().carbon?.offsetPrice ?? CARBON_OFFSET_PRICE_USD_FALLBACK;
    const carbonOffsetCost = netEmissions * offsetPrice;
    const carbonTaxExposure = netEmissions * CARBON_TAX_RATE_USD;

    // Benchmarks
    const industryAvgEmissions = (itLoadKw * hoursPerYear * INDUSTRY_AVG_PUE * INDUSTRY_AVG_CARBON) / 1_000;
    // Guard against division by zero when itLoadKw is 0
    const carbonIntensityPerKw = itLoadKw > 0 ? (totalEmissions * 1000) / itLoadKw : 0; // kgCO₂/kW

    // Efficiency rating
    const ratio = netEmissions / industryAvgEmissions;
    let efficiencyRating: CarbonResult['efficiencyRating'] = 'C';
    if (ratio < 0.5) efficiencyRating = 'A';
    else if (ratio < 0.75) efficiencyRating = 'B';
    else if (ratio < 1.0) efficiencyRating = 'C';
    else if (ratio < 1.3) efficiencyRating = 'D';
    else efficiencyRating = 'F';

    // A1: Reduction scenarios with proper payback calculation inline
    const calcPayback = (investment: number, savings: number): number => {
        if (investment <= 0) return 0; // No investment = immediate (PPA)
        if (savings <= 0) return 99; // No savings = never pays back
        return Math.round((investment / savings) * 10) / 10;
    };

    // screening: sizing fractions (solar 0.3× IT kW, BESS 0.1×), energy-savings
    // shares (0.15/0.08/0.3) and the $80/MWh avoided-energy price are planning
    // assumptions; only the $/kWp and $/kWh unit costs are sourced (IRENA/BNEF).
    const solarInvestment = itLoadKw * 0.3 * 900;  // $900/kWp (IRENA 2024 utility-scale avg)
    const solarSavings = totalEnergyMWh * 0.15 * 80;
    const bessInvestment = itLoadKw * 0.1 * 300;  // $300/kWh (BNEF 2025 utility-scale avg)
    const bessSavings = totalEnergyMWh * 0.08 * 80;
    const liquidInvestment = itLoadKw * 300;  // screening: ~$300/kW DLC retrofit
    const liquidSavings = coolingEnergyMWh * 0.3 * 80;

    const reductionScenarios: CarbonReductionScenario[] = [
        {
            name: 'Solar PV Array',
            description: `${Math.round(itLoadKw * 0.3)}kW rooftop solar installation`,
            investmentUSD: solarInvestment,
            annualSavingsTonCO2: totalEmissions * 0.15,
            annualSavingsUSD: solarSavings,
            paybackYears: calcPayback(solarInvestment, solarSavings),
            color: '#f59e0b',
        },
        {
            name: 'Battery Energy Storage',
            description: `${Math.round(itLoadKw * 0.1)}kWh BESS for peak shaving`,
            investmentUSD: bessInvestment,
            annualSavingsTonCO2: totalEmissions * 0.08,
            annualSavingsUSD: bessSavings,
            paybackYears: calcPayback(bessInvestment, bessSavings),
            color: '#3b82f6',
        },
        {
            name: 'PPA (Green Energy)',
            description: '100% renewable Power Purchase Agreement',
            investmentUSD: 0,
            annualSavingsTonCO2: scope2 * 0.85,
            annualSavingsUSD: carbonOffsetCost * 0.85,
            paybackYears: 0, // No investment needed
            color: '#10b981',
        },
        {
            name: 'Liquid Cooling Retrofit',
            description: 'Direct-to-chip liquid cooling conversion',
            investmentUSD: liquidInvestment,
            annualSavingsTonCO2: totalEmissions * 0.12,
            annualSavingsUSD: liquidSavings,
            paybackYears: calcPayback(liquidInvestment, liquidSavings),
            color: '#06b6d4',
        },
    ];

    return {
        annualEnergyMWh: totalEnergyMWh,
        annualEmissionsTonCO2: totalEmissions,
        carbonIntensityPerKw,
        pueEfficiency: pue,
        itEnergyMWh,
        coolingEnergyMWh,
        lossEnergyMWh,
        carbonOffsetCostUSD: carbonOffsetCost,
        carbonTaxExposureUSD: carbonTaxExposure,
        renewableReductionPct,
        netEmissionsTonCO2: netEmissions,
        industryAvgEmissions,
        efficiencyRating,
        scope1,
        scope2,
        scope3,
        scope1Refrigerant,
        reductionScenarios,
    };
};
