// ─── REVENUE MODEL ENGINE (NRC + MRC) ───────────────────────
// Hyperscale / Colocation revenue modelling with:
//   NRC (Non-Recurring Charge) — upfront setup/fit-out fee
//   MRC (Monthly Recurring Charge) — $/kW/month recurring revenue
// ─────────────────────────────────────────────────────────────

export interface RevenueInputs {
    itLoadKw: number;               // Total IT capacity (kW)

    // ─── NRC ────────────────────────────────────────────
    nrcPerKw: number;               // One-time setup fee per kW ($/kW)
    nrcCustomFitout: number;        // Custom fit-out / build-to-suit ($)
    nrcCrossConnect: number;        // Cross-connect & network setup ($)

    // ─── MRC ────────────────────────────────────────────
    mrcPerKwMonth: number;          // Monthly recurring charge per kW ($/kW/month)
    mrcEscalation: number;          // Annual MRC escalation (decimal, e.g. 0.03)
    mrcCrossConnectMonthly: number; // Monthly cross-connect & bandwidth ($)

    // ─── Contract Terms ─────────────────────────────────
    contractYears: number;          // Lease term (years)
    takeOrPayPct: number;           // Minimum committed occupancy (decimal, e.g. 0.70)

    // ─── Occupancy ──────────────────────────────────────
    occupancyRamp: number[];        // Occupancy % per year [0.30, 0.50, ...]
}

export interface RevenueYearDetail {
    year: number;
    occupancy: number;              // Fraction
    billedKw: number;               // max(takeOrPay, actual occupancy) × itLoad
    mrcMonthly: number;             // MRC billed per month this year
    mrcAnnual: number;              // Total MRC for the year
    crossConnectAnnual: number;     // Cross-connect recurring
    totalRecurring: number;         // MRC + cross-connect
    nrc: number;                    // NRC (year 1 only)
    totalRevenue: number;           // NRC + recurring
    cumulativeRevenue: number;      // Running total
}

export interface RevenueResult {
    // Summary
    totalNRC: number;
    totalMRC_lifetime: number;
    totalRevenue_lifetime: number;
    avgMrcPerKwMonth: number;
    contractValue: number;          // Total contract value (TCV)
    effectiveRate: number;          // Blended $/kW/month over contract life

    // Breakdown
    yearDetails: RevenueYearDetail[];

    // Benchmarks
    revenuePerMW_year1: number;     // Revenue per MW in first full year
    blendedMonthlyRevenue: number;  // Average monthly revenue over contract
}

// ─── DEFAULT OCCUPANCY RAMP ─────────────────────────────────
export const defaultRevenueOccupancy = (years: number): number[] => {
    const ramp: number[] = [];
    for (let y = 0; y < years; y++) {
        if (y === 0) ramp.push(0.30);       // Initial fill
        else if (y === 1) ramp.push(0.55);  // Sales ramp
        else if (y === 2) ramp.push(0.75);  // Approaching steady
        else if (y === 3) ramp.push(0.88);  // Near full
        else ramp.push(Math.min(0.97, 0.88 + (y - 3) * 0.02)); // Steady state
    }
    return ramp;
};

// ─── DEFAULT INPUTS ─────────────────────────────────────────
export const defaultRevenueInputs: RevenueInputs = {
    itLoadKw: 1000,
    nrcPerKw: 250,
    nrcCustomFitout: 50000,
    nrcCrossConnect: 15000,
    mrcPerKwMonth: 150,
    mrcEscalation: 0.03,
    mrcCrossConnectMonthly: 5000,
    contractYears: 10,
    takeOrPayPct: 0.70,
    occupancyRamp: defaultRevenueOccupancy(10),
};

// ─── MAIN CALCULATION ───────────────────────────────────────
export const calculateRevenue = (inputs: RevenueInputs): RevenueResult => {
    const {
        itLoadKw, nrcPerKw, nrcCustomFitout, nrcCrossConnect,
        mrcPerKwMonth, mrcEscalation, mrcCrossConnectMonthly,
        contractYears, takeOrPayPct, occupancyRamp
    } = inputs;

    // Total NRC (one-time)
    const totalNRC = (nrcPerKw * itLoadKw) + nrcCustomFitout + nrcCrossConnect;

    const yearDetails: RevenueYearDetail[] = [];
    let cumulativeRevenue = 0;
    let totalMRC = 0;

    for (let y = 0; y < contractYears; y++) {
        const occupancy = occupancyRamp[y] ?? 0.95;

        // Take-or-pay floor: billed kW = max(committed %, actual occupancy) × capacity
        const effectiveOccupancy = Math.max(takeOrPayPct, occupancy);
        const billedKw = effectiveOccupancy * itLoadKw;

        // MRC with annual escalation
        const escalatedMrc = mrcPerKwMonth * Math.pow(1 + mrcEscalation, y);
        const mrcMonthly = billedKw * escalatedMrc;
        const mrcAnnual = mrcMonthly * 12;

        // Cross-connect recurring (also escalates)
        const crossConnectAnnual = mrcCrossConnectMonthly * 12 * Math.pow(1 + mrcEscalation, y);

        const totalRecurring = mrcAnnual + crossConnectAnnual;
        const nrc = y === 0 ? totalNRC : 0;
        const totalRevenue = nrc + totalRecurring;

        cumulativeRevenue += totalRevenue;
        totalMRC += mrcAnnual;

        yearDetails.push({
            year: y + 1,
            occupancy,
            billedKw,
            mrcMonthly,
            mrcAnnual,
            crossConnectAnnual,
            totalRecurring,
            nrc,
            totalRevenue,
            cumulativeRevenue,
        });
    }

    const totalRevenue_lifetime = cumulativeRevenue;
    const avgMrcPerKwMonth = totalMRC / (contractYears * 12 * itLoadKw);
    const contractValue = totalRevenue_lifetime;
    const effectiveRate = totalRevenue_lifetime / (contractYears * 12 * itLoadKw);

    // Year 1 full revenue (for benchmarking)
    const year1 = yearDetails[0];
    const revenuePerMW_year1 = year1 ? (year1.totalRecurring / (itLoadKw / 1000)) : 0;

    const blendedMonthlyRevenue = totalRevenue_lifetime / (contractYears * 12);

    return {
        totalNRC,
        totalMRC_lifetime: totalMRC,
        totalRevenue_lifetime,
        avgMrcPerKwMonth,
        contractValue,
        effectiveRate,
        yearDetails,
        revenuePerMW_year1,
        blendedMonthlyRevenue,
    };
};
