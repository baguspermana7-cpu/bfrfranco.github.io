// ─── FUEL/DIESEL GENERATOR ENGINE ───────────────────────────
// Models data center backup generator sizing, fuel consumption, costs, and emissions

import { CountryProfile } from '@/constants/countries';
import { COUNTRIES } from '@/constants/countries';
import { generateAssetCounts } from '@/lib/AssetGenerator';
import { getPUE } from '@/constants/pue';

export type TestingRegime = 'minimal' | 'complete';

export interface FuelGenInput {
    country: CountryProfile;
    itLoadKw: number;
    tierLevel: 2 | 3 | 4;
    coolingType: string;
    coolingTopology?: 'in-row' | 'perimeter' | 'dlc';
    powerRedundancy?: 'N+1' | '2N' | '2N+1';
    testingRegime?: TestingRegime;
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
    countryComparison: CountryFuelComparison[];
    editableParams: EditableParam[];
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
    const genEfficiency = overrides?.genEfficiency ?? 0.27; // L/kWh
    const fuelStorageHours = overrides?.fuelStorageHours ?? (tierLevel === 4 ? 96 : tierLevel === 3 ? 72 : 48);
    const monthlyTestHours = overrides?.monthlyTestHours ?? 2;
    const annualFullLoadTestHours = overrides?.annualFullLoadTestHours ?? 4;

    // PUE from shared constants
    const pueFactor = getPUE(coolingType);
    const totalFacilityLoadKw = itLoadKw * pueFactor;

    // Generator sizing — sync with AssetGenerator for consistency with Maintenance module
    const genUnitCapacity = 2500; // kW per generator
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
    const fuelPerHour = totalFacilityLoadKw * genEfficiency;
    const storageLiters = Math.min(fuelPerHour * fuelStorageHours, storageLimitLiters * 2);
    const tankSize = 20000; // liters per tank
    const tankCount = Math.ceil(storageLiters / tankSize);
    const daysOfAutonomy = storageLiters / fuelPerHour / 24;

    const storage: FuelStorage = {
        totalLiters: Math.round(storageLiters),
        tankCount,
        daysOfAutonomy: Math.round(daysOfAutonomy * 10) / 10,
    };

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

    // Outage consumption: based on grid reliability
    const outageHoursPerYear = grid ? (grid.brownoutFrequency * grid.averageOutageDuration / 60) : 24;
    const annualOutageLiters = outageHoursPerYear * totalFacilityLoadKw * genEfficiency;

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

    // Costs
    const dieselPriceWithTax = dieselPrice * (1 + fuelTaxRate);
    const annualFuelCost = totalLitersPerYear * dieselPriceWithTax;
    const monthlyFuelCost = annualFuelCost / 12;

    // Maintenance: per-gen maintenance
    const annualMaintenanceUsd = genCount * 15000 + (totalGenCapacity * 5);

    // Environmental compliance
    const annualEnvCompliance = envPermitRequired ? (genCount * 2500 + 5000) : 0;

    const totalAnnualGenOpex = annualFuelCost + annualMaintenanceUsd + annualEnvCompliance;

    const cost: FuelCost = {
        monthlyFuelCostUsd: Math.round(monthlyFuelCost),
        annualFuelCostUsd: Math.round(annualFuelCost),
        annualMaintenanceUsd: Math.round(annualMaintenanceUsd),
        annualEnvironmentalComplianceUsd: Math.round(annualEnvCompliance),
        totalAnnualGenOpex: Math.round(totalAnnualGenOpex),
        dieselPriceWithTax: Math.round(dieselPriceWithTax * 100) / 100,
    };

    // CO2 emissions: 2.68 kgCO2 per liter of diesel
    const co2Kg = totalLitersPerYear * 2.68;

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
        countryComparison: comparisonCountries,
        editableParams,
    };
}
