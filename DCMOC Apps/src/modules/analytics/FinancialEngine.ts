// ─── FINANCIAL / IRR / ROI ENGINE ────────────────────────────
// Investment-grade financial metrics for data center build decisions

export interface FinancialInputs {
    totalCapex: number;           // Total CAPEX investment ($)
    annualOpex: number;           // Total annual OPEX ($)
    revenuePerKwMonth: number;    // Revenue per kW per month ($)
    itLoadKw: number;             // IT capacity (kW)
    discountRate: number;         // WACC or hurdle rate (decimal, e.g. 0.10)
    projectLifeYears: number;     // Analysis period (years)
    escalationRate: number;       // Annual revenue escalation (decimal)
    opexEscalation: number;       // Annual OPEX escalation (decimal)
    occupancyRamp: number[];      // Occupancy % per year [0.3, 0.5, 0.7, 0.85, 0.95, 1, 1, ...]
    taxRate: number;              // Corporate tax rate (decimal)
    depreciationYears: number;    // Straight-line depreciation period
}

export interface YearCashflow {
    year: number;
    revenue: number;
    opex: number;
    depreciation: number;
    ebitda: number;
    taxableIncome: number;
    tax: number;
    netIncome: number;
    freeCashflow: number;
    cumulativeCashflow: number;
    discountedCashflow: number;
    cumulativeDiscountedCashflow: number;
}

export interface FinancialResult {
    npv: number;                        // Net Present Value
    irr: number;                        // Internal Rate of Return (%)
    roiPercent: number;                 // Simple ROI %
    paybackPeriodYears: number;         // Simple payback
    discountedPaybackYears: number;     // Discounted payback
    profitabilityIndex: number;         // NPV / Investment
    totalRevenue: number;
    totalProfit: number;
    cashflows: YearCashflow[];
    annualDepreciation: number;
    breakEvenOccupancy: number;         // Min occupancy % to break even annually
}

// ─── IRR CALCULATION (Newton-Raphson) ───────────────────────
const calculateIRR = (cashflows: number[], guess: number = 0.10, maxIter: number = 200, tolerance: number = 1e-7): number => {
    let rate = guess;

    for (let i = 0; i < maxIter; i++) {
        let npv = 0;
        let dnpv = 0; // derivative

        for (let t = 0; t < cashflows.length; t++) {
            const denom = Math.pow(1 + rate, t);
            npv += cashflows[t] / denom;
            if (t > 0) dnpv -= (t * cashflows[t]) / Math.pow(1 + rate, t + 1);
        }

        if (Math.abs(npv) < tolerance) return rate;
        if (Math.abs(dnpv) < 1e-12) break; // Avoid division by zero

        rate = rate - npv / dnpv;

        // Clamp to reasonable range
        if (rate < -0.99) rate = -0.5;
        if (rate > 5) rate = 2;
    }

    return rate; // Best estimate
};

// ─── DEFAULT OCCUPANCY RAMP ─────────────────────────────────
export const defaultOccupancyRamp = (years: number): number[] => {
    const ramp: number[] = [];
    for (let y = 0; y < years; y++) {
        if (y === 0) ramp.push(0.25);       // Construction tail, 25%
        else if (y === 1) ramp.push(0.50);   // Ramp year 1
        else if (y === 2) ramp.push(0.70);   // Ramp year 2
        else if (y === 3) ramp.push(0.85);   // Approaching full
        else ramp.push(Math.min(0.95, 0.85 + (y - 3) * 0.025)); // Steady state ~95%
    }
    return ramp;
};

// ─── MAIN CALCULATION ───────────────────────────────────────
export const calculateFinancials = (inputs: FinancialInputs): FinancialResult => {
    const {
        totalCapex, annualOpex, revenuePerKwMonth, itLoadKw,
        discountRate, projectLifeYears, escalationRate, opexEscalation,
        occupancyRamp, taxRate, depreciationYears
    } = inputs;

    const annualDepreciation = totalCapex / depreciationYears;
    const cashflows: YearCashflow[] = [];
    const irrCashflows: number[] = [-totalCapex]; // Year 0 = investment

    let cumulativeCashflow = -totalCapex;
    let cumulativeDiscounted = -totalCapex / 1; // Year 0
    let paybackFound = false;
    let discPaybackFound = false;
    let paybackPeriod = projectLifeYears;
    let discPayback = projectLifeYears;
    let totalRevenue = 0;
    let totalProfit = 0;

    for (let y = 0; y < projectLifeYears; y++) {
        const occupancy = occupancyRamp[y] ?? 0.95;
        const yearRevenue = revenuePerKwMonth * 12 * itLoadKw * occupancy * Math.pow(1 + escalationRate, y);
        const yearOpex = annualOpex * Math.pow(1 + opexEscalation, y);
        const depreciation = y < depreciationYears ? annualDepreciation : 0;

        const ebitda = yearRevenue - yearOpex;
        const taxableIncome = Math.max(0, ebitda - depreciation);
        const tax = taxableIncome * taxRate;
        const netIncome = ebitda - tax;
        const freeCashflow = netIncome; // Simplified (no capex maintenance)

        cumulativeCashflow += freeCashflow;
        const discountFactor = Math.pow(1 + discountRate, y + 1);
        const discountedCf = freeCashflow / discountFactor;
        cumulativeDiscounted += discountedCf;

        totalRevenue += yearRevenue;
        totalProfit += netIncome;

        // Payback detection
        if (!paybackFound && cumulativeCashflow >= 0) {
            // Linear interpolation for fractional year
            const prevCum = cumulativeCashflow - freeCashflow;
            paybackPeriod = y + (prevCum < 0 ? Math.abs(prevCum) / freeCashflow : 0);
            paybackFound = true;
        }

        if (!discPaybackFound && cumulativeDiscounted >= 0) {
            const prevCum = cumulativeDiscounted - discountedCf;
            discPayback = y + (prevCum < 0 ? Math.abs(prevCum) / discountedCf : 0);
            discPaybackFound = true;
        }

        cashflows.push({
            year: y + 1,
            revenue: yearRevenue,
            opex: yearOpex,
            depreciation,
            ebitda,
            taxableIncome,
            tax,
            netIncome,
            freeCashflow,
            cumulativeCashflow,
            discountedCashflow: discountedCf,
            cumulativeDiscountedCashflow: cumulativeDiscounted,
        });

        irrCashflows.push(freeCashflow);
    }

    // NPV
    let npv = -totalCapex;
    for (let y = 0; y < projectLifeYears; y++) {
        npv += cashflows[y].freeCashflow / Math.pow(1 + discountRate, y + 1);
    }

    // IRR
    const irr = calculateIRR(irrCashflows) * 100; // as percentage

    // ROI
    const roi = ((totalProfit - totalCapex) / totalCapex) * 100;

    // Profitability Index
    const pi = (npv + totalCapex) / totalCapex;

    // Break-even occupancy (find min occupancy where annual revenue > opex)
    const baseAnnualRevenue = revenuePerKwMonth * 12 * itLoadKw;
    const breakEvenOccupancy = Math.min(1, annualOpex / baseAnnualRevenue);

    return {
        npv,
        irr,
        roiPercent: roi,
        paybackPeriodYears: Math.round(paybackPeriod * 10) / 10,
        discountedPaybackYears: Math.round(discPayback * 10) / 10,
        profitabilityIndex: Math.round(pi * 100) / 100,
        totalRevenue,
        totalProfit,
        cashflows,
        annualDepreciation,
        breakEvenOccupancy: Math.round(breakEvenOccupancy * 100),
    };
};
