// ─── INVESTMENT / CAPITALIZATION ENGINE ───────────────────────
// Expert-level DC investment modeling: capital structure, levered returns,
// multi-method valuation, IPO/acquisition pricing, readiness scoring

import { calculateIRR } from './FinancialEngine';
import type { YearCashflow } from './FinancialEngine';

// ─── TYPES ───────────────────────────────────────────────────

export interface InvestmentInputs {
    // From existing stores
    totalCapex: number;
    unleveredCashflows: YearCashflow[];
    itLoadKw: number;
    taxRate: number;

    // Capital Structure
    debtRatio: number;          // 0.50 - 0.80
    debtCostAnnual: number;     // annual interest rate, e.g. 0.05
    debtTermYears: number;      // e.g. 12
    equityCostOfCapital: number; // e.g. 0.12

    // Exit
    exitYear: number;           // 3-10
    exitEbitdaMultiple: number; // 12-25x
    terminalCapRate: number;    // e.g. 0.065

    // IPO/Acquisition
    controlPremiumPct: number;  // e.g. 0.25
}

export interface DebtAmortRow {
    year: number;
    openingBalance: number;
    payment: number;
    interest: number;
    principal: number;
    closingBalance: number;
}

export interface LeveredFCFRow {
    year: number;
    unleveredFCF: number;
    debtService: number;
    leveredFCF: number;
    cumulativeLevered: number;
    cashOnCashPct: number;
    dscr: number;
}

export interface ValuationResult {
    evEbitda: number;
    capRateVal: number;
    perKwVal: number;
    dollarPerKw: number;
}

export interface AcquisitionRow {
    multiple: number;
    enterpriseValue: number;
    equityValue: number;
    impliedDollarPerKw: number;
}

export interface ReadinessCheck {
    label: string;
    target: string;
    actual: string;
    pass: boolean;
    weight: number;
}

export interface SensitivityCell {
    debtRatio: number;
    exitMultiple: number;
    equityIRR: number;
}

export interface InvestmentResult {
    // Capital Structure
    totalDebt: number;
    totalEquity: number;
    wacc: number;
    annualDebtPayment: number;

    // Debt Amortization
    debtSchedule: DebtAmortRow[];

    // Levered Returns
    equityIRR: number;
    moic: number;
    minDSCR: number;
    year1CashOnCash: number;
    leveredFCFTable: LeveredFCFRow[];

    // Valuation
    valuation: ValuationResult;
    stabilizedEBITDA: number;
    stabilizedNOI: number;

    // Exit
    exitEV: number;
    exitRemainingDebt: number;
    exitEquityValue: number;

    // IPO/Acquisition
    ipoPrice: number;
    acquisitionTable: AcquisitionRow[];

    // Readiness
    readinessChecks: ReadinessCheck[];
    readinessScore: number;
    readinessLabel: 'Ready' | 'Conditional' | 'Not Ready';

    // Sensitivity
    sensitivityMatrix: SensitivityCell[];

    // Payback
    paybackYear: number;
}

// ─── PMT FUNCTION ────────────────────────────────────────────
// Standard annuity payment: debt × r / (1 - (1+r)^-n)
function pmt(principal: number, rate: number, periods: number): number {
    if (rate === 0) return principal / periods;
    return principal * rate / (1 - Math.pow(1 + rate, -periods));
}

// ─── MAIN CALCULATION ────────────────────────────────────────
export function calculateInvestment(inputs: InvestmentInputs): InvestmentResult {
    const {
        totalCapex, unleveredCashflows, itLoadKw, taxRate,
        debtRatio, debtCostAnnual, debtTermYears, equityCostOfCapital,
        exitYear, exitEbitdaMultiple, terminalCapRate, controlPremiumPct
    } = inputs;

    const equityRatio = 1 - debtRatio;
    const totalDebt = totalCapex * debtRatio;
    const totalEquity = totalCapex * equityRatio;

    // WACC
    const wacc = debtRatio * debtCostAnnual * (1 - taxRate) + equityRatio * equityCostOfCapital;

    // Annual debt payment (fixed annuity)
    const annualDebtPayment = pmt(totalDebt, debtCostAnnual, debtTermYears);

    // ─── Debt Amortization Schedule ──────────────────────
    const debtSchedule: DebtAmortRow[] = [];
    let balance = totalDebt;
    for (let y = 1; y <= debtTermYears; y++) {
        const interest = balance * debtCostAnnual;
        const principal = annualDebtPayment - interest;
        const closing = Math.max(0, balance - principal);
        debtSchedule.push({
            year: y,
            openingBalance: balance,
            payment: annualDebtPayment,
            interest,
            principal,
            closingBalance: closing,
        });
        balance = closing;
    }

    // ─── Levered FCF Table ───────────────────────────────
    const projectYears = unleveredCashflows.length;
    const leveredFCFTable: LeveredFCFRow[] = [];
    let cumulativeLevered = 0;
    const leveredCashflowsForIRR: number[] = [-totalEquity];

    for (let y = 0; y < projectYears; y++) {
        const cf = unleveredCashflows[y];
        const yearNum = y + 1;
        const debtService = yearNum <= debtTermYears ? annualDebtPayment : 0;
        const leveredFCF = cf.freeCashflow - debtService;
        cumulativeLevered += leveredFCF;
        const cashOnCash = totalEquity > 0 ? (leveredFCF / totalEquity) * 100 : 0;
        const dscr = debtService > 0 ? cf.ebitda / debtService : 99;

        leveredFCFTable.push({
            year: yearNum,
            unleveredFCF: cf.freeCashflow,
            debtService,
            leveredFCF,
            cumulativeLevered,
            cashOnCashPct: cashOnCash,
            dscr,
        });

        leveredCashflowsForIRR.push(leveredFCF);
    }

    // ─── Stabilized metrics (use year 5 or last available) ──
    const stabYear = Math.min(4, projectYears - 1);
    const stabilizedEBITDA = unleveredCashflows[stabYear]?.ebitda ?? 0;
    const stabilizedNOI = stabilizedEBITDA * 0.95; // NOI ~ 95% of EBITDA

    // ─── Exit Calculation ────────────────────────────────
    const exitIdx = Math.min(exitYear - 1, projectYears - 1);
    const exitEBITDA = unleveredCashflows[exitIdx]?.ebitda ?? stabilizedEBITDA;
    const exitEV = exitEBITDA * exitEbitdaMultiple;
    const exitRemainingDebt = exitYear <= debtTermYears
        ? (debtSchedule[exitIdx]?.closingBalance ?? 0)
        : 0;
    const exitEquityValue = exitEV - exitRemainingDebt;

    // Add terminal value to IRR cashflows at exit year
    const irrCashflows = [...leveredCashflowsForIRR];
    if (exitIdx + 1 < irrCashflows.length) {
        irrCashflows[exitIdx + 1] += exitEquityValue;
        // Truncate to exit year
        irrCashflows.length = exitIdx + 2;
    }

    // Equity IRR
    const equityIRR = calculateIRR(irrCashflows, 0.12) * 100;

    // MOIC
    const totalDistributions = leveredFCFTable
        .slice(0, exitYear)
        .reduce((sum, r) => sum + Math.max(0, r.leveredFCF), 0);
    const moic = totalEquity > 0 ? (totalDistributions + exitEquityValue) / totalEquity : 0;

    // Min DSCR
    const dscrValues = leveredFCFTable.filter(r => r.dscr < 99).map(r => r.dscr);
    const minDSCR = dscrValues.length > 0 ? Math.min(...dscrValues) : 0;

    // Year-1 Cash-on-Cash
    const year1CashOnCash = leveredFCFTable[0]?.cashOnCashPct ?? 0;

    // ─── Valuation ──────────────────────────────────────
    const evEbitda = stabilizedEBITDA * exitEbitdaMultiple;
    const capRateVal = terminalCapRate > 0 ? stabilizedNOI / terminalCapRate : 0;
    const dollarPerKw = itLoadKw > 0 ? evEbitda / itLoadKw : 0;

    const valuation: ValuationResult = {
        evEbitda,
        capRateVal,
        perKwVal: evEbitda,
        dollarPerKw,
    };

    // ─── IPO/Acquisition Pricing ────────────────────────
    const ipoPrice = evEbitda * (1 + controlPremiumPct);

    const acquisitionTable: AcquisitionRow[] = [];
    for (let m = 14; m <= 22; m += 2) {
        const ev = stabilizedEBITDA * m;
        const eq = ev - exitRemainingDebt;
        acquisitionTable.push({
            multiple: m,
            enterpriseValue: ev,
            equityValue: eq,
            impliedDollarPerKw: itLoadKw > 0 ? ev / itLoadKw : 0,
        });
    }

    // ─── Readiness Scoring ──────────────────────────────
    const paybackRow = leveredFCFTable.find(r => r.cumulativeLevered >= 0);
    const paybackYear = paybackRow ? paybackRow.year : projectYears;

    // Occupancy ramp check: year 3 should be >= 70%
    const occY3 = unleveredCashflows.length >= 3 ? true : false;

    const readinessChecks: ReadinessCheck[] = [
        {
            label: 'DSCR',
            target: '≥ 1.25x',
            actual: `${minDSCR.toFixed(2)}x`,
            pass: minDSCR >= 1.25,
            weight: 20,
        },
        {
            label: 'MOIC',
            target: '≥ 2.0x',
            actual: `${moic.toFixed(2)}x`,
            pass: moic >= 2.0,
            weight: 20,
        },
        {
            label: 'Equity IRR',
            target: '≥ 15%',
            actual: `${equityIRR.toFixed(1)}%`,
            pass: equityIRR >= 15,
            weight: 20,
        },
        {
            label: 'Payback Period',
            target: '≤ 7 years',
            actual: `${paybackYear} yrs`,
            pass: paybackYear <= 7,
            weight: 15,
        },
        {
            label: 'Occupancy Ramp',
            target: 'Realistic trajectory',
            actual: occY3 ? 'On track' : 'Insufficient data',
            pass: occY3,
            weight: 10,
        },
        {
            label: 'Cash-on-Cash (Y1)',
            target: '≥ 8%',
            actual: `${year1CashOnCash.toFixed(1)}%`,
            pass: year1CashOnCash >= 8,
            weight: 15,
        },
    ];

    const readinessScore = readinessChecks.reduce((score, check) => {
        return score + (check.pass ? check.weight : 0);
    }, 0);

    const readinessLabel: 'Ready' | 'Conditional' | 'Not Ready' =
        readinessScore >= 80 ? 'Ready' : readinessScore >= 50 ? 'Conditional' : 'Not Ready';

    // ─── Sensitivity Matrix ─────────────────────────────
    const sensitivityMatrix: SensitivityCell[] = [];
    const debtRatios = [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80];
    const exitMultiples = [14, 16, 18, 20, 22];

    for (const dr of debtRatios) {
        for (const em of exitMultiples) {
            const debt = totalCapex * dr;
            const equity = totalCapex * (1 - dr);
            const payment = pmt(debt, debtCostAnnual, debtTermYears);

            const cfs: number[] = [-equity];
            for (let y = 0; y < Math.min(exitYear, projectYears); y++) {
                const fcf = unleveredCashflows[y]?.freeCashflow ?? 0;
                const ds = (y + 1) <= debtTermYears ? payment : 0;
                cfs.push(fcf - ds);
            }
            // Add exit equity
            const exEBITDA = unleveredCashflows[Math.min(exitYear - 1, projectYears - 1)]?.ebitda ?? 0;
            const exEV = exEBITDA * em;
            const exDebtRemaining = exitYear <= debtTermYears
                ? Math.max(0, debt - debtSchedule.slice(0, exitYear).reduce((s, r) => s + r.principal, 0) * (debt / totalDebt))
                : 0;
            cfs[cfs.length - 1] += (exEV - exDebtRemaining);

            const irr = calculateIRR(cfs, 0.12) * 100;
            sensitivityMatrix.push({ debtRatio: dr, exitMultiple: em, equityIRR: irr });
        }
    }

    return {
        totalDebt,
        totalEquity,
        wacc,
        annualDebtPayment,
        debtSchedule,
        equityIRR,
        moic,
        minDSCR,
        year1CashOnCash,
        leveredFCFTable,
        valuation,
        stabilizedEBITDA,
        stabilizedNOI,
        exitEV,
        exitRemainingDebt,
        exitEquityValue,
        ipoPrice,
        acquisitionTable,
        readinessChecks,
        readinessScore,
        readinessLabel,
        sensitivityMatrix,
        paybackYear,
    };
}
