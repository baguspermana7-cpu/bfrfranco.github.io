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
    scope1: number;  // Direct (generators, fuel)
    scope2: number;  // Indirect (grid electricity)
    scope3: number;  // Supply chain (estimated)

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
    const dieselLiters = itLoadKw * DIESEL_CONSUMPTION_RATE * annualGenTestHours * (genType === 'hvo' ? 0.1 : 1);
    const scope1 = (dieselLiters * DIESEL_EMISSION_FACTOR) / 1000; // tCO₂/yr

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
    const industryAvgEmissions = (itLoadKw * hoursPerYear * INDUSTRY_AVG_PUE * INDUSTRY_AVG_CARBON) / 1_000_000;
    const carbonIntensityPerKw = (totalEmissions * 1000) / itLoadKw; // kgCO₂/kW

    // Efficiency rating
    const ratio = netEmissions / industryAvgEmissions;
    let efficiencyRating: CarbonResult['efficiencyRating'] = 'C';
    if (ratio < 0.5) efficiencyRating = 'A';
    else if (ratio < 0.75) efficiencyRating = 'B';
    else if (ratio < 1.0) efficiencyRating = 'C';
    else if (ratio < 1.3) efficiencyRating = 'D';
    else efficiencyRating = 'F';

    // Reduction scenarios
    const reductionScenarios: CarbonReductionScenario[] = [
        {
            name: 'Solar PV Array',
            description: `${Math.round(itLoadKw * 0.3)}kW rooftop solar installation`,
            investmentUSD: itLoadKw * 0.3 * 1200,
            annualSavingsTonCO2: totalEmissions * 0.15,
            annualSavingsUSD: totalEnergyMWh * 0.15 * 80, // $80/MWh avoided
            paybackYears: 0,
            color: '#f59e0b',
        },
        {
            name: 'Battery Energy Storage',
            description: `${Math.round(itLoadKw * 0.1)}kWh BESS for peak shaving`,
            investmentUSD: itLoadKw * 0.1 * 500,
            annualSavingsTonCO2: totalEmissions * 0.08,
            annualSavingsUSD: totalEnergyMWh * 0.08 * 80,
            paybackYears: 0,
            color: '#3b82f6',
        },
        {
            name: 'PPA (Green Energy)',
            description: '100% renewable Power Purchase Agreement',
            investmentUSD: 0,
            annualSavingsTonCO2: scope2 * 0.85,
            annualSavingsUSD: carbonOffsetCost * 0.85,
            paybackYears: 0,
            color: '#10b981',
        },
        {
            name: 'Liquid Cooling Retrofit',
            description: 'Direct-to-chip liquid cooling conversion',
            investmentUSD: itLoadKw * 300,
            annualSavingsTonCO2: totalEmissions * 0.12,
            annualSavingsUSD: coolingEnergyMWh * 0.3 * 80,
            paybackYears: 0,
            color: '#06b6d4',
        },
    ];

    // Calculate payback
    reductionScenarios.forEach(s => {
        s.paybackYears = s.investmentUSD > 0 && s.annualSavingsUSD > 0
            ? Math.round((s.investmentUSD / s.annualSavingsUSD) * 10) / 10
            : 0;
    });

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
        reductionScenarios,
    };
};
