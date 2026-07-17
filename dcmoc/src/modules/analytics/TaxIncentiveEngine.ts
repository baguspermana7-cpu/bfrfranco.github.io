// ─── TAX & INCENTIVE ENGINE ─────────────────────────────────
// Calculates tax incentive value and its impact on financial returns
// Updated 2026: US bonus depreciation phase-down, IRA ITC/PTC updates,
// EU ETS pricing, IRA/CHIPS Act credits, regional DC-specific breaks

import { CountryProfile } from '@/constants/countries';
import { calculateIRR } from './FinancialEngine';
import { rzData } from '@/lib/rz-engine';

// Engine-sourced US tax-incentive rates (RZEngine DATA.tax) with local fallbacks
// parity-identical to the former literals.
const _tax = (rzData().tax || {}) as { usBonusDepreciation2026?: number; iraSolarItc?: number; iraDomesticContentBonus?: number };

// ─── US BONUS DEPRECIATION PHASE-DOWN (IRA / TCJA 2026) ─────
// TCJA set 100% bonus dep for 2017-2022, then phases down:
// 2023: 80%, 2024: 60%, 2025: 40%, 2026: 20%, 2027+: 0%
export const US_BONUS_DEPRECIATION_2026 = _tax.usBonusDepreciation2026 ?? 0.20; // engine-sourced (20% in 2026)

// IRA Section 48C Investment Tax Credit — on-site solar/storage at DC
// Domestic content bonus: +10%, Energy community bonus: +10%
// Base ITC for on-site solar: 30% (IRA extended through 2032)
export const IRA_SOLAR_ITC = _tax.iraSolarItc ?? 0.30;
export const IRA_DOMESTIC_CONTENT_BONUS = _tax.iraDomesticContentBonus ?? 0.10;

// State-level DC incentives (selected major markets, 2025-2026)
export const STATE_DC_INCENTIVES: Record<string, { name: string; value: number; type: string }> = {
    'US-VA': { name: 'Virginia Enterprise Zone + Data Center exemption', value: 0.06, type: 'sales_tax_exemption' },
    'US-TX': { name: 'Texas sales tax exemption on DC equipment', value: 0.0825, type: 'sales_tax_exemption' },
    'US-NV': { name: 'Nevada sales/use tax abatement (partial)', value: 0.04, type: 'sales_tax_exemption' },
    'US-OH': { name: 'Ohio IT equipment sales tax exemption', value: 0.0575, type: 'sales_tax_exemption' },
    'US-AZ': { name: 'Arizona TPT (sales tax) exemption', value: 0.056, type: 'sales_tax_exemption' },
};

export interface TaxIncentiveInput {
    country: CountryProfile;
    totalCapex: number;
    annualRevenue: number;
    annualOpex: number;
    projectLifeYears: number;
    discountRate: number;
    equipmentCapexShare: number; // Fraction of CAPEX that is equipment (for import duty)
    /** US-specific: On-site solar CAPEX fraction (0-1) for ITC calculation */
    solarCapexFraction?: number;
    /** US state code for state-level incentive lookup */
    usStateCode?: string;
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
    const {
        country, totalCapex, annualRevenue, annualOpex,
        projectLifeYears, discountRate, equipmentCapexShare,
        solarCapexFraction = 0, usStateCode,
    } = input;

    // Input guards
    const safeTotalCapex = Math.max(0, totalCapex || 0);
    const safeRevenue = Math.max(0, annualRevenue || 0);
    const safeOpex = Math.max(0, annualOpex || 0);
    const safeYears = Math.max(1, Math.min(30, projectLifeYears || 10));
    const safeDiscount = Math.max(0.01, Math.min(0.30, discountRate || 0.10));
    const safeEquipShare = Math.max(0, Math.min(1, equipmentCapexShare || 0.60));

    const tax = country.taxIncentives;
    const standardRate = Math.max(0, Math.min(0.60, country.economy.taxRate));

    // Defaults
    const taxHolidayYears = tax?.taxHolidayYears ?? 0;
    const taxHolidayRate = tax?.taxHolidayRate ?? standardRate;
    const importDutyExemption = tax?.importDutyExemption ?? false;
    const landSubsidy = tax?.landSubsidy ?? false;

    // Depreciation — 15-year blended (equipment 5-7yr for bonus dep, structure 39yr)
    // For US we use MACRS 5-year for IT equipment (dominant class)
    const depreciation = safeTotalCapex / Math.min(15, safeYears);
    const yearlyTaxSavings: number[] = [];
    const effectiveTaxTimeline: number[] = [];

    // --- Year-by-Year Tax Calculation ---
    const irrWithCashflows: number[] = [-safeTotalCapex];
    const irrWithoutCashflows: number[] = [-safeTotalCapex];
    let npvWith = -safeTotalCapex;
    let npvWithout = -safeTotalCapex;
    let totalTaxWith = 0;
    let totalTaxWithout = 0;

    for (let y = 0; y < safeYears; y++) {
        const yearRevenue = safeRevenue * Math.pow(1.03, y); // 3% escalation
        const yearOpex = safeOpex * Math.pow(1.04, y);
        const taxableIncome = Math.max(0, yearRevenue - yearOpex - depreciation);

        // Effective rate for this year
        const effectiveRate = Math.max(0, y < taxHolidayYears ? taxHolidayRate : standardRate);
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
        const df = Math.pow(1 + safeDiscount, y + 1);
        npvWith += cashflowWith / df;
        npvWithout += cashflowWithout / df;
    }

    // --- FTZ Benefits (Import Duty Savings) ---
    // Typical import duty on DC equipment: 5-15% depending on country
    // US: MFN duty 0% for servers/switches, ~3-5% for cooling/power equipment
    // ASEAN: 5-10% before FTZ exemption. EU: 0-3.7%
    const importDutyRate = country.id === 'ID' || country.id === 'IN' ? 0.075
        : country.id === 'US' ? 0.03
        : country.id === 'CN' ? 0.08
        : 0.05;
    const ftzBenefits = importDutyExemption ? Math.round(safeTotalCapex * safeEquipShare * importDutyRate) : 0;

    // --- Land Subsidy ---
    // Estimate: 15% of land cost, land = ~8-10% of CAPEX in most markets
    const landSubsidyValue = landSubsidy ? Math.round(safeTotalCapex * 0.09 * 0.15) : 0;

    // --- US-specific: IRA on-site solar ITC (2026) ---
    // IRA Section 48 ITC: 30% base + 10% domestic content bonus if qualifying
    // Only applicable when solarCapexFraction > 0 and country = US
    const iraSolarItcValue = (country.id === 'US' && solarCapexFraction > 0)
        ? Math.round(safeTotalCapex * solarCapexFraction * (IRA_SOLAR_ITC + IRA_DOMESTIC_CONTENT_BONUS))
        : 0;

    // --- US-specific: 2026 bonus depreciation (20%) ---
    // Applied in year 1 for qualifying equipment. Creates present-value benefit vs. straight-line.
    // PV benefit = bonus dep rate × equipment capex × tax rate × discount factor
    const usBonusDepValue = (country.id === 'US' && safeEquipShare > 0)
        ? Math.round(
            safeTotalCapex * safeEquipShare * US_BONUS_DEPRECIATION_2026 * standardRate
            // Year 1 timing benefit vs straight-line average (rough NPV lift)
            * (1 - Math.pow(1 + safeDiscount, -Math.min(5, safeYears)) / 5)
          )
        : 0;

    // --- State sales tax exemption (US) ---
    const stateIncentiveValue = (country.id === 'US' && usStateCode && STATE_DC_INCENTIVES[usStateCode])
        ? Math.round(safeTotalCapex * safeEquipShare * STATE_DC_INCENTIVES[usStateCode].value)
        : 0;

    // --- Total Incentive Value (NPV) ---
    let totalIncentiveValue = ftzBenefits + landSubsidyValue + iraSolarItcValue + usBonusDepValue + stateIncentiveValue;
    for (let y = 0; y < safeYears; y++) {
        totalIncentiveValue += yearlyTaxSavings[y] / Math.pow(1 + safeDiscount, y + 1);
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
    if (iraSolarItcValue > 0) {
        incentiveSummary.push(`IRA Section 48 ITC (2026) on-site solar: ~$${(iraSolarItcValue / 1000).toFixed(0)}K (30%+10% domestic content)`);
    }
    if (usBonusDepValue > 0) {
        incentiveSummary.push(`US 2026 bonus depreciation (20% of equipment CAPEX, phasing down from 100% in 2022): ~$${(usBonusDepValue / 1000).toFixed(0)}K PV benefit`);
    }
    if (stateIncentiveValue > 0 && usStateCode) {
        const si = STATE_DC_INCENTIVES[usStateCode];
        incentiveSummary.push(`${si.name}: ~$${(stateIncentiveValue / 1000).toFixed(0)}K on equipment`);
    }
    if (tax?.incentivePrograms) {
        tax.incentivePrograms.forEach(p => incentiveSummary.push(p));
    }
    if (incentiveSummary.length === 0) {
        incentiveSummary.push('No significant DC-specific incentives available in this jurisdiction');
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
