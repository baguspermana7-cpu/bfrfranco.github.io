// ─── CARBON FOOTPRINT / ESG ENGINE ──────────────────────────
// Calculates CO₂ emissions based on grid mix, PUE, and IT load

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
const CARBON_OFFSET_PRICE_USD = 25;   // $/tCO₂ (voluntary market average)
const CARBON_TAX_RATE_USD = 50;       // $/tCO₂ (EU ETS approximate)
const DIESEL_EMISSION_FACTOR = 2.68;  // kgCO₂ per liter diesel
const DIESEL_CONSUMPTION_RATE = 0.3;  // liters per kW per hour
const INDUSTRY_AVG_PUE = 1.58;        // Global average PUE (Uptime Institute)
const INDUSTRY_AVG_CARBON = 0.475;    // kgCO₂/kWh global average

// Refrigerant GWP factors by cooling type
const REFRIGERANT_DATA: Record<string, { chargeKgPerKw: number; leakRatePct: number; gwp: number }> = {
    air:    { chargeKgPerKw: 0.15, leakRatePct: 0.05, gwp: 2088 },  // R-410A typical CRAC
    inrow:  { chargeKgPerKw: 0.12, leakRatePct: 0.04, gwp: 2088 },  // R-410A in-row
    rdhx:   { chargeKgPerKw: 0.08, leakRatePct: 0.03, gwp: 1430 },  // R-134a or R-410A
    liquid: { chargeKgPerKw: 0.03, leakRatePct: 0.02, gwp: 675 },   // R-32 or low-GWP
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
    const scope2 = (totalEnergyMWh * 1000 * gridCarbonIntensity) / 1000; // tCO₂/yr

    // Scope 1: Direct emissions (generator testing, ~200h/yr testing + emergency)
    const annualGenTestHours = 200;
    // A9: HVO shows 80% reduction (0.2x factor), not 90% (was 0.1x)
    const hvoFactor = genType === 'hvo' ? 0.2 : 1;
    const dieselLiters = itLoadKw * DIESEL_CONSUMPTION_RATE * annualGenTestHours * hvoFactor;
    const scope1Generators = (dieselLiters * DIESEL_EMISSION_FACTOR) / 1000; // tCO₂/yr

    // A15: Refrigerant leakage Scope 1
    const refData = REFRIGERANT_DATA[coolingType] || REFRIGERANT_DATA.air;
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

    // Financial impact
    const carbonOffsetCost = netEmissions * CARBON_OFFSET_PRICE_USD;
    const carbonTaxExposure = netEmissions * CARBON_TAX_RATE_USD;

    // Benchmarks
    const industryAvgEmissions = (itLoadKw * hoursPerYear * INDUSTRY_AVG_PUE * INDUSTRY_AVG_CARBON) / 1_000;
    const carbonIntensityPerKw = (totalEmissions * 1000) / itLoadKw; // kgCO₂/kW

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

    const solarInvestment = itLoadKw * 0.3 * 1200;
    const solarSavings = totalEnergyMWh * 0.15 * 80;
    const bessInvestment = itLoadKw * 0.1 * 500;
    const bessSavings = totalEnergyMWh * 0.08 * 80;
    const liquidInvestment = itLoadKw * 300;
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
