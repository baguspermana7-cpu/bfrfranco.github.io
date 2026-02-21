// ─── TAX & INCENTIVE ENGINE ─────────────────────────────────
// Calculates tax incentive value and its impact on financial returns

import { CountryProfile } from '@/constants/countries';
import { calculateIRR } from './FinancialEngine';

export interface TaxIncentiveInput {
    country: CountryProfile;
    totalCapex: number;
    annualRevenue: number;
    annualOpex: number;
    projectLifeYears: number;
    discountRate: number;
    equipmentCapexShare: number; // Fraction of CAPEX that is equipment (for import duty)
}

export interface TaxIncentiveResult {
    yearlyTaxSavings: number[];
    totalIncentiveValue: number;
    effectiveTaxTimeline: number[];
    ftzBenefits: number;
    landSubsidyValue: number;
    incentiveSummary: string[];
    countryRanking: number;
    npvWithIncentives: number;
    npvWithoutIncentives: number;
    irrWithIncentives: number;
    irrWithoutIncentives: number;
    totalTaxPaidWithIncentives: number;
    totalTaxPaidWithoutIncentives: number;
}

export const calculateTaxIncentives = (input: TaxIncentiveInput): TaxIncentiveResult => {
    const { country, totalCapex, annualRevenue, annualOpex, projectLifeYears, discountRate, equipmentCapexShare } = input;
    const tax = country.taxIncentives;
    const standardRate = country.economy.taxRate;

    // Defaults
    const taxHolidayYears = tax?.taxHolidayYears ?? 0;
    const taxHolidayRate = tax?.taxHolidayRate ?? standardRate;
    const importDutyExemption = tax?.importDutyExemption ?? false;
    const landSubsidy = tax?.landSubsidy ?? false;

    const depreciation = totalCapex / Math.min(20, projectLifeYears);
    const yearlyTaxSavings: number[] = [];
    const effectiveTaxTimeline: number[] = [];

    // --- Year-by-Year Tax Calculation ---
    const irrWithCashflows: number[] = [-totalCapex];
    const irrWithoutCashflows: number[] = [-totalCapex];
    let npvWith = -totalCapex;
    let npvWithout = -totalCapex;
    let totalTaxWith = 0;
    let totalTaxWithout = 0;

    for (let y = 0; y < projectLifeYears; y++) {
        const yearRevenue = annualRevenue * Math.pow(1.03, y); // 3% escalation
        const yearOpex = annualOpex * Math.pow(1.04, y);
        const taxableIncome = Math.max(0, yearRevenue - yearOpex - depreciation);

        // Effective rate for this year
        const effectiveRate = y < taxHolidayYears ? taxHolidayRate : standardRate;
        effectiveTaxTimeline.push(effectiveRate);

        const taxWithIncentive = taxableIncome * effectiveRate;
        const taxWithoutIncentive = taxableIncome * standardRate;
        const savings = taxWithoutIncentive - taxWithIncentive;
        yearlyTaxSavings.push(Math.round(savings));

        totalTaxWith += taxWithIncentive;
        totalTaxWithout += taxWithoutIncentive;

        // Cashflows for IRR
        const cashflowWith = yearRevenue - yearOpex - taxWithIncentive;
        const cashflowWithout = yearRevenue - yearOpex - taxWithoutIncentive;
        irrWithCashflows.push(cashflowWith);
        irrWithoutCashflows.push(cashflowWithout);

        // NPV
        const df = Math.pow(1 + discountRate, y + 1);
        npvWith += cashflowWith / df;
        npvWithout += cashflowWithout / df;
    }

    // --- FTZ Benefits (Import Duty Savings) ---
    // Typical import duty on DC equipment: 5-15%
    const importDutyRate = 0.05; // Conservative 5%
    const ftzBenefits = importDutyExemption ? Math.round(totalCapex * equipmentCapexShare * importDutyRate) : 0;

    // --- Land Subsidy ---
    // Estimate: 10% of land cost, land = 8% of CAPEX
    const landSubsidyValue = landSubsidy ? Math.round(totalCapex * 0.08 * 0.10) : 0;

    // --- Total Incentive Value (NPV) ---
    let totalIncentiveValue = ftzBenefits + landSubsidyValue;
    for (let y = 0; y < projectLifeYears; y++) {
        totalIncentiveValue += yearlyTaxSavings[y] / Math.pow(1 + discountRate, y + 1);
    }
    totalIncentiveValue = Math.round(totalIncentiveValue);

    // --- IRR ---
    const irrWithIncentives = Math.round(calculateIRR(irrWithCashflows) * 1000) / 10;
    const irrWithoutIncentives = Math.round(calculateIRR(irrWithoutCashflows) * 1000) / 10;

    // --- Summary ---
    const incentiveSummary: string[] = [];
    if (taxHolidayYears > 0) {
        incentiveSummary.push(`${taxHolidayYears}-year tax holiday at ${(taxHolidayRate * 100).toFixed(1)}% (vs ${(standardRate * 100).toFixed(1)}% standard)`);
    }
    if (importDutyExemption) {
        incentiveSummary.push(`Import duty exemption on DC equipment (saving ~$${(ftzBenefits / 1000).toFixed(0)}K)`);
    }
    if (landSubsidy) {
        incentiveSummary.push(`Government land subsidy available (~$${(landSubsidyValue / 1000).toFixed(0)}K)`);
    }
    if (tax?.incentivePrograms) {
        tax.incentivePrograms.forEach(p => incentiveSummary.push(p));
    }
    if (incentiveSummary.length === 0) {
        incentiveSummary.push('No significant DC-specific incentives available');
    }

    return {
        yearlyTaxSavings,
        totalIncentiveValue,
        effectiveTaxTimeline,
        ftzBenefits,
        landSubsidyValue,
        incentiveSummary,
        countryRanking: 0, // populated by dashboard
        npvWithIncentives: Math.round(npvWith),
        npvWithoutIncentives: Math.round(npvWithout),
        irrWithIncentives,
        irrWithoutIncentives,
        totalTaxPaidWithIncentives: Math.round(totalTaxWith),
        totalTaxPaidWithoutIncentives: Math.round(totalTaxWithout),
    };
};
