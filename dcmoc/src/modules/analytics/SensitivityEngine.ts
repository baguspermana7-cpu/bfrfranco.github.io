// ─── SENSITIVITY ANALYSIS ENGINE ────────────────────────────
// Perturbs each input ±20% and measures TCO impact

import { CountryProfile } from '@/constants/countries';

export interface SensitivityResult {
    parameter: string;
    label: string;
    baseValue: number;
    lowValue: number;
    highValue: number;
    baseTCO: number;
    lowTCO: number;
    highTCO: number;
    deltaLow: number;   // % change from base
    deltaHigh: number;   // % change from base
    absoluteSpread: number; // |highTCO - lowTCO|
}

interface SensitivityInputs {
    itLoad: number;
    tierLevel: number;
    headcount_Engineer: number;
    headcount_Technician: number;
    headcount_ShiftLead: number;
    contingency: number;
    designFee: number;
    pmFee: number;
    fuelHours: number;
    turnoverRate: number | null;
    hybridRatio: number;
    maintenanceModel: 'in-house' | 'hybrid' | 'vendor';
    buildingSize: number;
}

// A4 + A14: Use country-specific energy rate and improved TCO model
const estimateTCO = (inputs: SensitivityInputs, baseSalaryAvg: number, capexPerKw: number, country?: CountryProfile): number => {
    const projectLife = 10;

    // Staffing OPEX (monthly × 12)
    const totalStaff = inputs.headcount_Engineer + inputs.headcount_Technician +
        inputs.headcount_ShiftLead + (inputs.headcount_Engineer > 0 ? 2 : 0); // admin+janitor
    const staffOpex = totalStaff * baseSalaryAvg * 12;

    // Turnover cost
    const turnover = (inputs.turnoverRate || 0.15) * totalStaff * baseSalaryAvg * 3; // 3 months replacement cost

    // Maintenance OPEX — in-house is cheapest labor but needs full staff; vendor adds 30% premium
    // hybridRatio=1.0 (fully in-house) → 1.0x, hybridRatio=0 (fully vendor) → 1.30x
    const maintModel = inputs.maintenanceModel || 'hybrid';
    const hr = inputs.hybridRatio ?? 0.5;
    const maintCostMult = maintModel === 'in-house' ? 1.0
        : maintModel === 'vendor' ? 1.30
        : (hr * 1.0) + ((1 - hr) * 1.30); // blend
    const maintenanceOpex = inputs.itLoad * 50 * maintCostMult; // $50/kW base

    // A4: Country-specific electricity rate (default $0.10/kWh for backward compat)
    const electricityRate = country?.economy?.electricityRate ?? 0.10;
    // A8: Updated PUE estimates per tier
    const pue = inputs.tierLevel >= 4 ? 1.20 : inputs.tierLevel >= 3 ? 1.28 : 1.45;
    const energyOpex = inputs.itLoad * pue * 8760 * electricityRate / 1000;

    // A14: Improved annualized CAPEX with tax depreciation benefit
    const taxRate = country?.economy?.taxRate ?? 0.30;
    const capex = inputs.itLoad * capexPerKw;
    const softCosts = capex * ((inputs.designFee + inputs.pmFee) / 100);
    const contingencyCost = capex * (inputs.contingency / 100);
    const totalCapex = capex + softCosts + contingencyCost;
    const annualDepreciation = totalCapex / 20; // 20-year straight-line
    const depreciationTaxShield = annualDepreciation * taxRate;
    const annualizedCapex = (totalCapex / projectLife) - depreciationTaxShield;

    return staffOpex + turnover + maintenanceOpex + energyOpex + annualizedCapex;
};

export const runSensitivityAnalysis = (
    inputs: SensitivityInputs,
    baseSalaryAvg: number = 3000,
    capexPerKw: number = 12000,
    perturbation: number = 0.20,
    country?: CountryProfile
): SensitivityResult[] => {
    const baseTCO = estimateTCO(inputs, baseSalaryAvg, capexPerKw, country);

    const parameters: { key: keyof SensitivityInputs; label: string; minClamp?: number }[] = [
        { key: 'itLoad', label: 'IT Load (kW)' },
        { key: 'headcount_Engineer', label: 'Engineers', minClamp: 1 },
        { key: 'headcount_Technician', label: 'Technicians', minClamp: 1 },
        { key: 'headcount_ShiftLead', label: 'Shift Leads', minClamp: 1 },
        { key: 'contingency', label: 'Contingency %', minClamp: 0 },
        { key: 'designFee', label: 'Design Fee %', minClamp: 0 },
        { key: 'pmFee', label: 'PM Fee %', minClamp: 0 },
        { key: 'fuelHours', label: 'Fuel Storage (hrs)', minClamp: 12 },
        { key: 'hybridRatio', label: 'In-house Ratio', minClamp: 0 },
        { key: 'buildingSize', label: 'Building Size (m²)', minClamp: 100 },
    ];

    const results: SensitivityResult[] = [];

    for (const param of parameters) {
        const baseVal = inputs[param.key] as number;
        if (baseVal === null || baseVal === undefined || baseVal === 0) continue;

        const low = Math.max(param.minClamp ?? 0, baseVal * (1 - perturbation));
        const high = baseVal * (1 + perturbation);

        const lowInputs = { ...inputs, [param.key]: low };
        const highInputs = { ...inputs, [param.key]: high };

        const lowTCO = estimateTCO(lowInputs, baseSalaryAvg, capexPerKw, country);
        const highTCO = estimateTCO(highInputs, baseSalaryAvg, capexPerKw, country);

        results.push({
            parameter: param.key,
            label: param.label,
            baseValue: baseVal,
            lowValue: low,
            highValue: high,
            baseTCO,
            lowTCO,
            highTCO,
            deltaLow: ((lowTCO - baseTCO) / baseTCO) * 100,
            deltaHigh: ((highTCO - baseTCO) / baseTCO) * 100,
            absoluteSpread: Math.abs(highTCO - lowTCO),
        });
    }

    // Sort by biggest impact (absolute spread)
    return results.sort((a, b) => b.absoluteSpread - a.absoluteSpread);
};
