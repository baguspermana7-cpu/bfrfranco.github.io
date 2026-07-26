// ─── FUEL/DIESEL GENERATOR ENGINE ───────────────────────────
// Models data center backup generator sizing, fuel consumption, costs, and emissions

import { CountryProfile } from '@/constants/countries';
import { COUNTRIES } from '@/constants/countries';
import { generateAssetCounts } from '@/lib/AssetGenerator';
import { getPUE } from '@/constants/pue';
import { rzData, rzModels } from '@/lib/rz-engine';

export type TestingRegime = 'minimal' | 'complete';

export interface FuelGenInput {
    country: CountryProfile;
    itLoadKw: number;
    tierLevel: 2 | 3 | 4;
    coolingType: string;
    coolingTopology?: 'in-row' | 'perimeter' | 'dlc';
    powerRedundancy?: 'N+1' | '2N' | '2N+1';
    testingRegime?: TestingRegime;
    /** v1.115.72 — power delivery model: grid+backup (default), prime off-grid, or hybrid */
    powerSource?: 'utility-backup' | 'prime' | 'hybrid';
    /** v1.115.72 — genset fuel: diesel (default), hvo, natural-gas, solar-hybrid, fuel-cell, biogas */
    fuelType?: 'diesel' | 'hvo' | 'natural-gas' | 'solar-hybrid' | 'fuel-cell' | 'biogas';
    overrides?: {
        dieselPricePerLiter?: number;
        genEfficiency?: number;
        fuelStorageHours?: number;
        monthlyTestHours?: number;
        annualFullLoadTestHours?: number;
    };
}

export interface EditableParam {
    key: string;
    label: string;
    value: number;
    defaultValue: number;
    unit: string;
    min: number;
    max: number;
    step: number;
}

export interface GeneratorSpec {
    count: number;
    capacityKw: number;
    redundancyModel: string;
    totalCapacityKw: number;
}

export interface FuelConsumption {
    monthlyTestLiters: number;
    annualTestLiters: number;
    annualOutageLiters: number;
    annualPolishingLiters: number;
    totalLitersPerYear: number;
    totalLitersPerMonth: number;
}

export interface FuelCost {
    monthlyFuelCostUsd: number;
    annualFuelCostUsd: number;
    annualMaintenanceUsd: number;
    annualEnvironmentalComplianceUsd: number;
    totalAnnualGenOpex: number;
    dieselPriceWithTax: number;
    /** DM audit phase 3: maintenance uplift from countries.ts fuelDiesel.fuelQualityRating
     *  (high ×1.00 / moderate ×1.05 / low ×1.15 — screening; 1.00 when field absent). */
    fuelQualityMaintenanceMultiplier: number;
}

/** DM audit phase 3: HVO (renewable diesel) as a real fuel alternative when
 *  countries.ts fuelDiesel.hvoAvailable && hvoPricePerLiter > 0. Screening-level
 *  comparison at the SAME duty cycle as the diesel baseline. */
export interface HvoComparison {
    hvoPricePerLiter: number;        // pump price, USD/L (country data)
    hvoPriceWithTax: number;         // ×(1 + fuelTaxRate), same tax treatment as diesel
    annualLiters: number;            // diesel litres ×1.03 (HVO ~3% lower volumetric energy density)
    annualFuelCostUsd: number;       // annualLiters × hvoPriceWithTax
    annualDeltaVsDieselUsd: number;  // HVO annual fuel cost − diesel annual fuel cost (+ = premium)
    co2SavingsTonsPerYear: number;   // ~90% lifecycle CO2 reduction vs fossil diesel (EN 15940 screening)
}

export interface FuelStorage {
    totalLiters: number;
    tankCount: number;
    daysOfAutonomy: number;
}

export interface TestingSchedule {
    weeklyNoLoad: { frequency: string; durationMin: number; fuelLiters: number };
    monthlyLoadBank: { frequency: string; durationHours: number; fuelLiters: number };
    quarterlyFullLoad: { frequency: string; durationHours: number; fuelLiters: number };
    annualOverhaul: { frequency: string; durationHours: number; fuelLiters: number };
}

export interface CountryFuelComparison {
    countryId: string;
    countryName: string;
    dieselPrice: number;
    annualCost: number;
}

export interface FuelGenResult {
    generator: GeneratorSpec;
    storage: FuelStorage;
    consumption: FuelConsumption;
    cost: FuelCost;
    testing: TestingSchedule;
    testingRegime: TestingRegime;
    co2EmissionsKgPerYear: number;
    co2EmissionsTonsPerYear: number;
    /** null when country has no HVO supply data (hvoAvailable false or price 0). */
    hvo: HvoComparison | null;
    countryComparison: CountryFuelComparison[];
    editableParams: EditableParam[];
    /** v1.115.72 — power-source + fuel-type context for the dashboard */
    powerSource: 'utility-backup' | 'prime' | 'hybrid';
    fuelType: 'diesel' | 'hvo' | 'natural-gas' | 'solar-hybrid' | 'fuel-cell' | 'biogas';
    powerSourceLabel: string;
    fuelTypeLabel: string;
    runHoursPerYear: number;
}

export function calculateFuelGen(input: FuelGenInput): FuelGenResult {
    const { country, itLoadKw, tierLevel, coolingType, coolingTopology, powerRedundancy, overrides, testingRegime: regime } = input;
    const testingRegime: TestingRegime = regime ?? 'minimal';
    const fuel = country.fuelDiesel;
    const grid = country.gridReliability;

    // Defaults for fuel data
    const baseDieselPrice = fuel?.dieselPricePerLiter ?? 1.05;
    const fuelTaxRate = fuel?.fuelTaxRate ?? 0.05;
    const storageLimitLiters = fuel?.storageLimitLiters ?? 50000;
    const envPermitRequired = fuel?.environmentalPermitRequired ?? true;

    // Editable parameters with overrides
    const dieselPrice = overrides?.dieselPricePerLiter ?? baseDieselPrice;
    // 2026: Modern Tier 4 Final diesel generators consume 0.25-0.27 L/kWh at 75% load
    // Previous default was 0.27; keeping at 0.27 as conservative (matches EPA Tier 4 benchmark)
    // Engine-sourced fuel/gen economics (RZEngine DATA.fuelGen) with local fallbacks
    // parity-identical to the former inline literals.
    type SourceModel = { runHoursMode: 'outage' | 'continuous' | 'fraction'; utilisation?: number; yearFraction?: number; maintMult: number; gensetCapMult: number; gridCapexMult: number; label: string };
    type FuelModel = { effLPerKwh: number; co2PerUnit: number; costMult: number; runHoursMult: number; label: string };
    const FG = (rzData().fuelGen || {}) as {
        genEfficiencyLPerKwh?: number; fuelStorageHoursByTier?: Record<number, number>;
        genUnitKwSmall?: number; genUnitKwLarge?: number; genUnitScaleMw?: number;
        tankSizeLiters?: number; maintPerGenUsd?: number; maintPerKwUsd?: number;
        envCompliancePerGenUsd?: number;
        powerSourceModel?: Record<string, SourceModel>; fuelTypeModel?: Record<string, FuelModel>;
    };
    // v1.115.72 — resolve power-source + fuel-type models (default = backup/diesel)
    const powerSource = input.powerSource ?? 'utility-backup';
    const fuelType = input.fuelType ?? 'diesel';
    const srcModel: SourceModel = FG.powerSourceModel?.[powerSource] ?? { runHoursMode: 'outage', maintMult: 1, gensetCapMult: 1, gridCapexMult: 1, label: 'Utility grid + standby gensets' };
    const fuelSpec: FuelModel = FG.fuelTypeModel?.[fuelType] ?? { effLPerKwh: FG.genEfficiencyLPerKwh ?? 0.27, co2PerUnit: 2.68, costMult: 1, runHoursMult: 1, label: 'Diesel' };
    const genEfficiency = overrides?.genEfficiency ?? fuelSpec.effLPerKwh; // L/kWh — from the selected fuel type
    const fuelStorageHours = overrides?.fuelStorageHours ?? FG.fuelStorageHoursByTier?.[tierLevel] ?? (tierLevel === 4 ? 96 : tierLevel === 3 ? 72 : 48);
    const monthlyTestHours = overrides?.monthlyTestHours ?? 2;
    const annualFullLoadTestHours = overrides?.annualFullLoadTestHours ?? 4;

    // PUE from shared constants
    const pueFactor = getPUE(coolingType);
    const totalFacilityLoadKw = itLoadKw * pueFactor;

    // Generator sizing — DATA.fuelGen unit classes, same ≤100MW/>100MW breakpoint
    // as AssetGenerator gensetKw (was a flat 2500 that contradicted AssetGenerator's
    // 3000 kW units above 100 MW — spec/qty now agree at every scale)
    const genUnitCapacity = (itLoadKw / 1000) <= (FG.genUnitScaleMw ?? 100)
        ? (FG.genUnitKwSmall ?? 2500)
        : (FG.genUnitKwLarge ?? 3000); // kW per generator
    const effectiveTier: 3 | 4 = tierLevel === 2 ? 3 : tierLevel as 3 | 4;
    const coolingMap: 'air' | 'pumped' = coolingType === 'liquid' || coolingType === 'rdhx' ? 'pumped' : 'air';
    const effectiveCoolingTopology = coolingTopology ?? 'perimeter';
    const effectivePowerRedundancy = powerRedundancy ?? '2N';
    const assetCounts = generateAssetCounts(itLoadKw, effectiveTier, coolingMap, Math.ceil(itLoadKw * 0.6), effectiveCoolingTopology, effectivePowerRedundancy);
    const genFromAssets = assetCounts.find(a => a.assetId === 'gen-set');
    const genCount = genFromAssets?.count ?? Math.ceil(totalFacilityLoadKw / genUnitCapacity);
    const redundancy = effectivePowerRedundancy;
    const totalGenCapacity = genCount * genUnitCapacity;

    const generator: GeneratorSpec = {
        count: genCount,
        capacityKw: genUnitCapacity,
        redundancyModel: redundancy,
        totalCapacityKw: totalGenCapacity,
    };

    // Fuel storage
    const fuelModel = rzModels().fuel;
    // Engine-sourced consumption rate (L/h) — uses DATA.fuelGen.genEfficiencyLPerKwh internally
    const fuelPerHour = fuelModel && typeof fuelModel.consumptionLPerHour === 'function'
        ? fuelModel.consumptionLPerHour(totalFacilityLoadKw)
        : totalFacilityLoadKw * genEfficiency;
    // Engine-sourced storage requirement
    const engineStorageLiters = fuelModel && typeof fuelModel.storageLiters === 'function'
        ? fuelModel.storageLiters(totalFacilityLoadKw, tierLevel)
        : null;
    const storageLiters = Math.min(
        engineStorageLiters ?? (fuelPerHour * fuelStorageHours),
        storageLimitLiters * 2
    );
    const tankSize = FG.tankSizeLiters ?? 20000; // liters per tank (DATA.fuelGen, UL-142-class module)
    const tankCount = Math.ceil(storageLiters / tankSize);
    const daysOfAutonomy = storageLiters / fuelPerHour / 24;

    const storage: FuelStorage = {
        totalLiters: Math.round(storageLiters),
        tankCount,
        daysOfAutonomy: Math.round(daysOfAutonomy * 10) / 10,
    };

    // Engine-sourced annual test fuel (informational cross-reference; local testing schedule remains authoritative)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const engineTestFuel = fuelModel && typeof fuelModel.annualTestFuelLiters === 'function'
        ? fuelModel.annualTestFuelLiters(totalFacilityLoadKw)
        : null;

    // Testing schedule — varies by regime
    // Minimal: Monthly no-load run + Annual full loadbank test only
    // Complete: Weekly no-load + Monthly loadbank + Quarterly full load + Annual overhaul
    const weeklyNoLoadFuel = genCount * 15 * 0.05; // 15 min, minimal fuel
    const monthlyNoLoadFuel = genCount * 30 * 0.05; // 30 min no-load for minimal regime
    const monthlyLoadBankFuel = genCount * monthlyTestHours * genUnitCapacity * 0.5 * genEfficiency; // 50% load
    const quarterlyFullLoadFuel = genCount * 2 * genUnitCapacity * 0.75 * genEfficiency; // 2hr, 75% load
    const annualOverhaulFuel = genCount * annualFullLoadTestHours * genUnitCapacity * genEfficiency; // full load

    const testing: TestingSchedule = testingRegime === 'minimal' ? {
        weeklyNoLoad: { frequency: 'N/A', durationMin: 0, fuelLiters: 0 },
        monthlyLoadBank: { frequency: 'Monthly', durationHours: 0.5, fuelLiters: Math.round(monthlyNoLoadFuel) },
        quarterlyFullLoad: { frequency: 'N/A', durationHours: 0, fuelLiters: 0 },
        annualOverhaul: { frequency: 'Annual', durationHours: annualFullLoadTestHours, fuelLiters: Math.round(annualOverhaulFuel) },
    } : {
        weeklyNoLoad: { frequency: 'Weekly', durationMin: 15, fuelLiters: Math.round(weeklyNoLoadFuel) },
        monthlyLoadBank: { frequency: 'Monthly', durationHours: monthlyTestHours, fuelLiters: Math.round(monthlyLoadBankFuel) },
        quarterlyFullLoad: { frequency: 'Quarterly', durationHours: 2, fuelLiters: Math.round(quarterlyFullLoadFuel) },
        annualOverhaul: { frequency: 'Annual', durationHours: annualFullLoadTestHours, fuelLiters: Math.round(annualOverhaulFuel) },
    };

    // Annual consumption breakdown — differs by regime
    let annualTestLiters: number;
    let monthlyTestLiters: number;
    if (testingRegime === 'minimal') {
        // Minimal: 12 monthly no-load runs + 1 annual full loadbank
        annualTestLiters = (monthlyNoLoadFuel * 12) + annualOverhaulFuel;
        monthlyTestLiters = monthlyNoLoadFuel;
    } else {
        // Complete: weekly no-load + monthly loadbank + quarterly full load + annual overhaul
        annualTestLiters = (weeklyNoLoadFuel * 52) + (monthlyLoadBankFuel * 12) + (quarterlyFullLoadFuel * 4) + annualOverhaulFuel;
        monthlyTestLiters = monthlyLoadBankFuel;
    }

    // Run-hours by POWER SOURCE (v1.115.72): backup = grid outage hours only;
    // prime = 8760 × utilisation (gensets ARE the primary power, off-grid);
    // hybrid = yearFraction × 8760. Solar-hybrid fuel shaves run-hours ×runHoursMult.
    const gridOutageHours = grid ? (grid.brownoutFrequency * grid.averageOutageDuration / 60) : 24;
    const runHoursBase =
        srcModel.runHoursMode === 'continuous' ? 8760 * (srcModel.utilisation ?? 0.85)
        : srcModel.runHoursMode === 'fraction' ? 8760 * (srcModel.yearFraction ?? 0.55)
        : gridOutageHours;
    const runHoursPerYear = runHoursBase * fuelSpec.runHoursMult;
    const annualOutageLiters = runHoursPerYear * totalFacilityLoadKw * genEfficiency;

    // Fuel polishing: recirculate 10% of total storage monthly
    const annualPolishingLiters = storageLiters * 0.10 * 12 * 0.01; // Small consumption during polishing

    const totalLitersPerYear = annualTestLiters + annualOutageLiters + annualPolishingLiters;
    const totalLitersPerMonth = totalLitersPerYear / 12;

    const consumption: FuelConsumption = {
        monthlyTestLiters: Math.round(monthlyTestLiters),
        annualTestLiters: Math.round(annualTestLiters),
        annualOutageLiters: Math.round(annualOutageLiters),
        annualPolishingLiters: Math.round(annualPolishingLiters),
        totalLitersPerYear: Math.round(totalLitersPerYear),
        totalLitersPerMonth: Math.round(totalLitersPerMonth),
    };

    // Costs — fuel price scaled by the selected fuel type's cost multiplier
    // (HVO +15%, natural gas −25%, biogas +10%, fuel cell +60% vs diesel).
    const dieselPriceWithTax = dieselPrice * (1 + fuelTaxRate) * fuelSpec.costMult;
    const annualFuelCost = totalLitersPerYear * dieselPriceWithTax;
    const monthlyFuelCost = annualFuelCost / 12;

    // Maintenance: per-generator annual service
    // 2026: Tier 4 Final generator annual PM costs $16,000-$22,000 per unit
    // (CBRE FM benchmark 2025; includes oil/filters, inspections, load bank test)
    // Using $18,000/gen + $5/kW capacity-based variable
    // DM audit phase 3: countries.ts fuelDiesel.fuelQualityRating was dead — poor local fuel
    // quality (water/sulphur/particulates) fouls injectors + filters and shortens PM intervals.
    // Screening multiplier on generator maintenance: high ×1.00, moderate ×1.05, low ×1.15.
    // Fallback (field absent): ×1.00 — no effect, legacy cost verbatim.
    const fuelQualityMaintMult =
        fuel?.fuelQualityRating === 'low' ? 1.15 :
        fuel?.fuelQualityRating === 'moderate' ? 1.05 : 1.00;
    // × power-source maintenance multiplier (prime/continuous duty ≈ 2.5×, hybrid ≈ 1.4×)
    const annualMaintenanceUsd = (genCount * (FG.maintPerGenUsd ?? 18000) + (totalGenCapacity * (FG.maintPerKwUsd ?? 5))) * fuelQualityMaintMult * srcModel.maintMult;

    // Environmental compliance — DM audit: country-specific annual permitting cost
    // (countries.ts compliance.environmentalPermitCostPerYear, screening band US $8k /
    // JP $15k / EU ~$4.5-6.5k / emerging $2-3.5k); fallback = legacy flat $5,000 site fee.
    const envPermitSiteFee = country.compliance.environmentalPermitCostPerYear ?? 5000;
    const annualEnvCompliance = envPermitRequired ? (genCount * (FG.envCompliancePerGenUsd ?? 2500) + envPermitSiteFee) : 0;

    const totalAnnualGenOpex = annualFuelCost + annualMaintenanceUsd + annualEnvCompliance;

    const cost: FuelCost = {
        monthlyFuelCostUsd: Math.round(monthlyFuelCost),
        annualFuelCostUsd: Math.round(annualFuelCost),
        annualMaintenanceUsd: Math.round(annualMaintenanceUsd),
        annualEnvironmentalComplianceUsd: Math.round(annualEnvCompliance),
        totalAnnualGenOpex: Math.round(totalAnnualGenOpex),
        dieselPriceWithTax: Math.round(dieselPriceWithTax * 100) / 100,
        fuelQualityMaintenanceMultiplier: fuelQualityMaintMult,
    };

    // DM audit phase 3: HVO comparison — countries.ts fuelDiesel.hvoPricePerLiter was dead.
    // When the country reports HVO supply (hvoAvailable && price > 0), model running the SAME
    // annual duty cycle (tests + outages + polishing) on HVO100:
    //   litres ×1.03 (HVO volumetric energy density ~3% below diesel, EN 15940)
    //   price ×(1 + fuelTaxRate) — same tax treatment as diesel (screening)
    //   CO2 savings = diesel lifecycle CO2 × 90% (HVO ~90% lifecycle reduction, screening)
    // Fallback: null when fuelDiesel absent, hvoAvailable false, or price 0 — result unchanged.
    let hvo: HvoComparison | null = null;
    if (fuel?.hvoAvailable && fuel.hvoPricePerLiter > 0) {
        const hvoPriceWithTax = fuel.hvoPricePerLiter * (1 + fuelTaxRate);
        const hvoLiters = totalLitersPerYear * 1.03; // HVO ~3% higher volumetric burn (lower energy density, screening)
        const hvoAnnualCost = hvoLiters * hvoPriceWithTax;
        hvo = {
            hvoPricePerLiter: fuel.hvoPricePerLiter,
            hvoPriceWithTax: Math.round(hvoPriceWithTax * 100) / 100,
            annualLiters: Math.round(hvoLiters),
            annualFuelCostUsd: Math.round(hvoAnnualCost),
            annualDeltaVsDieselUsd: Math.round(hvoAnnualCost - annualFuelCost),
            // 2.68 kgCO2/L diesel (EPA/DEFRA factor) × ~90% HVO lifecycle reduction
            co2SavingsTonsPerYear: Math.round((totalLitersPerYear * 2.68 * 0.90) / 1000 * 10) / 10,
        };
    }

    // CO2 emissions — per-unit factor from the selected fuel type (diesel 2.68,
    // HVO 0.268 = −90% lifecycle, natural gas 2.04, biogas 0.30 near-neutral).
    const co2Kg = totalLitersPerYear * fuelSpec.co2PerUnit;

    // Country comparison (sorted by diesel price)
    const comparisonCountries = Object.values(COUNTRIES)
        .filter(c => c.fuelDiesel)
        .map(c => {
            const cPrice = c.fuelDiesel!.dieselPricePerLiter * (1 + c.fuelDiesel!.fuelTaxRate);
            return {
                countryId: c.id,
                countryName: c.name,
                dieselPrice: Math.round(cPrice * 100) / 100,
                annualCost: Math.round(totalLitersPerYear * cPrice),
            };
        })
        .sort((a, b) => a.dieselPrice - b.dieselPrice);

    // Editable params
    const editableParams: EditableParam[] = [
        { key: 'dieselPricePerLiter', label: 'Diesel Price', value: dieselPrice, defaultValue: baseDieselPrice, unit: 'USD/L', min: 0.1, max: 5.0, step: 0.05 },
        { key: 'genEfficiency', label: 'Gen Efficiency', value: genEfficiency, defaultValue: 0.27, unit: 'L/kWh', min: 0.20, max: 0.40, step: 0.01 },
        { key: 'fuelStorageHours', label: 'Fuel Storage', value: fuelStorageHours, defaultValue: tierLevel === 4 ? 96 : tierLevel === 3 ? 72 : 48, unit: 'hours', min: 24, max: 168, step: 12 },
        { key: 'monthlyTestHours', label: 'Monthly Test', value: monthlyTestHours, defaultValue: 2, unit: 'hours', min: 1, max: 8, step: 0.5 },
        { key: 'annualFullLoadTestHours', label: 'Annual Full Load Test', value: annualFullLoadTestHours, defaultValue: 4, unit: 'hours', min: 2, max: 12, step: 1 },
    ];

    return {
        generator,
        storage,
        consumption,
        cost,
        testing,
        testingRegime,
        co2EmissionsKgPerYear: Math.round(co2Kg),
        co2EmissionsTonsPerYear: Math.round(co2Kg / 1000 * 10) / 10,
        hvo,
        countryComparison: comparisonCountries,
        editableParams,
        powerSource,
        fuelType,
        powerSourceLabel: srcModel.label,
        fuelTypeLabel: fuelSpec.label,
        runHoursPerYear: Math.round(runHoursPerYear),
    };
}
