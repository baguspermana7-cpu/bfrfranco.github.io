// ─── SENSITIVITY ANALYSIS ENGINE ────────────────────────────
// Perturbs each input ±20% and measures TCO impact

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
    buildingSize: number;
}

// Simple linearized TCO model for sensitivity (avoids importing full engines)
// Approximates annual TCO = OPEX + (CAPEX / projectLife)
const estimateTCO = (inputs: SensitivityInputs, baseSalaryAvg: number, capexPerKw: number): number => {
    const projectLife = 10;

    // Staffing OPEX (monthly × 12)
    const totalStaff = inputs.headcount_Engineer + inputs.headcount_Technician +
        inputs.headcount_ShiftLead + (inputs.headcount_Engineer > 0 ? 2 : 0); // admin+janitor
    const staffOpex = totalStaff * baseSalaryAvg * 12;

    // Turnover cost
    const turnover = (inputs.turnoverRate || 0.15) * totalStaff * baseSalaryAvg * 3; // 3 months replacement cost

    // Maintenance OPEX (simplified)
    const maintenanceOpex = inputs.itLoad * 50 * (1 - inputs.hybridRatio * 0.1); // $50/kW base

    // Energy OPEX
    const pue = inputs.tierLevel >= 4 ? 1.3 : inputs.tierLevel >= 3 ? 1.4 : 1.6;
    const energyOpex = inputs.itLoad * pue * 8760 * 0.10 / 1000; // $0.10/kWh

    // CAPEX annualized
    const capex = inputs.itLoad * capexPerKw;
    const softCosts = capex * ((inputs.designFee + inputs.pmFee) / 100);
    const contingencyCost = capex * (inputs.contingency / 100);
    const annualizedCapex = (capex + softCosts + contingencyCost) / projectLife;

    return staffOpex + turnover + maintenanceOpex + energyOpex + annualizedCapex;
};

export const runSensitivityAnalysis = (
    inputs: SensitivityInputs,
    baseSalaryAvg: number = 3000,
    capexPerKw: number = 12000,
    perturbation: number = 0.20
): SensitivityResult[] => {
    const baseTCO = estimateTCO(inputs, baseSalaryAvg, capexPerKw);

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

        const lowTCO = estimateTCO(lowInputs, baseSalaryAvg, capexPerKw);
        const highTCO = estimateTCO(highInputs, baseSalaryAvg, capexPerKw);

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
