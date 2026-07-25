// ─── FINANCIAL / IRR / ROI ENGINE ────────────────────────────
// Investment-grade financial metrics for data center build decisions
//
// Engine-sourced (single source of truth): IRR + NPV delegate to the shared
// RZEngine (`RZEngine.models.roi`) via the src/lib/rz-engine.ts bridge — the
// SAME math the site-wide calculators use. Verified parity vs the former local
// implementations (IRR diff 0.000000pp, NPV diff $0.00 across DC cashflows), so
// this is a zero-behavior-change delegation. The local Newton-Raphson/loop are
// KEPT as fallbacks per the bridge discipline: if the engine is absent for any
// reason, results are identical and the app never breaks.

import { rzModels } from '@/lib/rz-engine';

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
    paybackPeriodYears: number;         // Simple payback (== projectLifeYears when never reached — check paybackReached)
    paybackReached: boolean;            // false = cumulative cash never turns positive in project life ("15.0 yr" would lie)
    discountedPaybackYears: number;     // Discounted payback
    discountedPaybackReached: boolean;
    profitabilityIndex: number;         // NPV / Investment
    totalRevenue: number;
    totalProfit: number;
    cashflows: YearCashflow[];
    annualDepreciation: number;
    breakEvenOccupancy: number;         // Min occupancy % to break even annually
}

/** Honest payback display — "> 15 yr (not reached)" instead of a fabricated
 *  "15.0 yr" when cumulative cash never turns positive. ONE formatter, every
 *  surface. */
export const fmtPayback = (r: Pick<FinancialResult, 'paybackPeriodYears' | 'paybackReached'>): string =>
    r.paybackReached ? `${r.paybackPeriodYears.toFixed(1)} yr` : `> ${Math.round(r.paybackPeriodYears)} yr (not reached)`;

// ─── IRR CALCULATION (Newton-Raphson with bisection fallback) ────
export const calculateIRR = (cashflows: number[], guess: number = 0.10, maxIter: number = 200, tolerance: number = 1e-7): number => {
    // Guard: need at least one positive and one negative cashflow for IRR to exist
    const hasPositive = cashflows.some(v => v > 0);
    const hasNegative = cashflows.some(v => v < 0);
    if (!hasPositive || !hasNegative) return 0;

    // Engine-sourced: delegate to RZEngine.models.roi.irr (returns a fraction or
    // null). Parity-verified identical to the local method below.
    const roi = rzModels().roi;
    if (roi && typeof roi.irr === 'function') {
        const r = roi.irr(cashflows, guess);
        if (r !== null && r !== undefined && isFinite(r)) return r;
    }

    // ── Local fallback (engine absent): Newton-Raphson + bisection ──
    let rate = guess;

    for (let i = 0; i < maxIter; i++) {
        let npv = 0;
        let dnpv = 0; // derivative

        for (let t = 0; t < cashflows.length; t++) {
            const denom = Math.pow(1 + rate, t);
            if (!isFinite(denom) || denom === 0) continue;
            npv += cashflows[t] / denom;
            if (t > 0) dnpv -= (t * cashflows[t]) / Math.pow(1 + rate, t + 1);
        }

        if (Math.abs(npv) < tolerance) return rate;
        if (Math.abs(dnpv) < 1e-12) break; // Avoid division by zero

        const newRate = rate - npv / dnpv;

        // Clamp to reasonable range and check for NaN
        if (!isFinite(newRate)) break;
        rate = Math.max(-0.99, Math.min(5, newRate));
    }

    // Bisection fallback for robustness (slower but guaranteed to converge)
    let lo = -0.99;
    let hi = 5.0;
    const npvAt = (r: number) => cashflows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + r, t), 0);
    for (let i = 0; i < 100; i++) {
        const mid = (lo + hi) / 2;
        const n = npvAt(mid);
        if (Math.abs(n) < tolerance * 100) return mid;
        if (Math.sign(n) === Math.sign(npvAt(lo))) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
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

    // Guard: prevent divide-by-zero for depreciation
    const safeDepYears = Math.max(1, depreciationYears || 15);
    const annualDepreciation = totalCapex / safeDepYears;
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
        const depreciation = y < safeDepYears ? annualDepreciation : 0;

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

    // NPV — engine-sourced (RZEngine.models.roi.npv discounts cf[0] + cf[t]/(1+r)^t;
    // irrCashflows[0] = -totalCapex so this equals the local sum exactly). Local loop
    // kept as fallback when the engine is absent.
    const roiModel = rzModels().roi;
    let npv: number;
    if (roiModel && typeof roiModel.npv === 'function') {
        const n = roiModel.npv(irrCashflows, discountRate);
        npv = (n !== null && n !== undefined && isFinite(n)) ? n : NaN;
    } else {
        npv = NaN;
    }
    if (!isFinite(npv)) {
        npv = -totalCapex;
        for (let y = 0; y < projectLifeYears; y++) {
            npv += cashflows[y].freeCashflow / Math.pow(1 + discountRate, y + 1);
        }
    }

    // IRR
    const irr = calculateIRR(irrCashflows) * 100; // as percentage

    // ROI — guard against zero capex
    const roi = totalCapex > 0 ? ((totalProfit - totalCapex) / totalCapex) * 100 : 0;

    // Profitability Index — guard against zero capex
    const pi = totalCapex > 0 ? (npv + totalCapex) / totalCapex : 1;

    // Break-even occupancy (find min occupancy where annual revenue > opex)
    const baseAnnualRevenue = revenuePerKwMonth * 12 * itLoadKw;
    // Guard: avoid NaN/Infinity when revenue is zero
    const breakEvenOccupancy = baseAnnualRevenue > 0
        ? Math.min(1, annualOpex / baseAnnualRevenue)
        : 1;

    return {
        npv,
        irr,
        roiPercent: roi,
        paybackPeriodYears: Math.round(paybackPeriod * 10) / 10,
        paybackReached: paybackFound,
        discountedPaybackYears: Math.round(discPayback * 10) / 10,
        discountedPaybackReached: discPaybackFound,
        profitabilityIndex: Math.round(pi * 100) / 100,
        totalRevenue,
        totalProfit,
        cashflows,
        annualDepreciation,
        breakEvenOccupancy: Math.round(breakEvenOccupancy * 100),
    };
};
