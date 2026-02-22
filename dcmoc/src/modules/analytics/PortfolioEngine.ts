// ─── PORTFOLIO COMPARISON ENGINE ──────────────────────────────
// Runs calculations for multiple DC sites and produces comparative analysis

import { SiteConfig } from '@/store/portfolio';
import { COUNTRIES } from '@/constants/countries';
import { calculateCapex, CapexInput, CapexResult } from '@/lib/CapexEngine';
import { calculateFinancials, defaultOccupancyRamp, FinancialResult } from './FinancialEngine';
import { calculateCarbonFootprint, CarbonResult } from './CarbonEngine';
import { calculateStaffing, calculateAutoHeadcount } from '@/modules/staffing/ShiftEngine';

export interface SiteResult {
    site: SiteConfig;
    countryName: string;
    capex: CapexResult;
    financial: FinancialResult;
    carbon: CarbonResult;
    totalStaff: number;
    annualStaffCost: number;
    annualOpex: number;
    pue: number;
    // Derived
    capexPerKw: number;
    opexPerKw: number;
    staffPerMw: number;
}

export interface PortfolioResult {
    sites: SiteResult[];
    // Portfolio totals
    totalCapex: number;
    totalAnnualOpex: number;
    totalStaff: number;
    totalItLoadKw: number;
    totalAnnualCO2: number;
    weightedPue: number;
    portfolioNpv: number;
    // Rankings
    bestCapexPerKw: string;     // site id
    bestPue: string;
    bestIrr: string;
    lowestRisk: string;         // site with best uptime tier
}

export function calculatePortfolio(sites: SiteConfig[]): PortfolioResult {
    const siteResults: SiteResult[] = sites.map(site => {
        const country = COUNTRIES[site.countryId];
        if (!country) {
            throw new Error(`Country not found: ${site.countryId}`);
        }

        // Build capex inputs
        const capexInput: CapexInput = {
            itLoad: site.itLoad,
            location: getLocationFromCountry(site.countryId),
            cityMarket: 'none',
            buildingType: 'purpose',
            coolingType: site.coolingType === 'inrow' ? 'inrow' : site.coolingType === 'rdhx' ? 'rdhx' : site.coolingType === 'liquid' ? 'liquid' : 'air',
            redundancy: site.powerRedundancy === '2N+1' ? '2n1' : site.powerRedundancy === '2N' ? '2n' : 'n1',
            rackType: 'standard',
            upsType: 'modular',
            genType: 'diesel',
            fuelHours: 48,
            fireType: 'novec',
            alarmType: 'addressable',
            projYear: '2025',
            designFee: 8,
            pmFee: 5,
            contingency: 10,
            includeFOM: false,
            substationType: 'dedicated_33kv',
            transformerLead: 'standard',
            utilityRate: 9,
            greenCert: 'none',
            renewableOption: 'none',
            ...site.capexInputs,
        };

        const capexResult = calculateCapex(capexInput);

        // Auto headcount
        const auto = calculateAutoHeadcount(
            site.itLoad,
            site.tierLevel,
            site.shiftModel,
            site.staffingModel,
            site.maintenanceStrategy === 'predictive' ? 'in-house' : 'hybrid',
            site.maintenanceStrategy,
            0.5
        );

        // Calculate staffing costs
        const roles: Array<{ role: 'shift-lead' | 'engineer' | 'technician' | 'admin' | 'janitor'; count: number; is24x7: boolean }> = [
            { role: 'shift-lead', count: auto.headcounts['shift-lead'], is24x7: true },
            { role: 'engineer', count: auto.headcounts['engineer'], is24x7: true },
            { role: 'technician', count: auto.headcounts['technician'], is24x7: false },
            { role: 'admin', count: auto.headcounts['admin'], is24x7: false },
            { role: 'janitor', count: auto.headcounts['janitor'], is24x7: false },
        ];

        const annualStaffCost = roles.reduce((sum, r) => {
            const res = calculateStaffing(r.role, r.count, site.shiftModel, country, r.is24x7);
            return sum + res.monthlyCost * 12;
        }, 0);
        const totalStaff = auto.totalFTE;

        const pue = capexResult.pue;
        const annualEnergy = site.itLoad * pue * 8760 / 1000; // MWh
        const annualEnergyCost = annualEnergy * (country.economy.electricityRate * 1000);
        const annualOpex = annualStaffCost + annualEnergyCost + (country.compliance.annualComplianceCost || 50000);

        // Financial
        const financialResult = calculateFinancials({
            totalCapex: capexResult.total,
            annualOpex,
            revenuePerKwMonth: 120,
            itLoadKw: site.itLoad,
            discountRate: 0.10,
            projectLifeYears: 10,
            escalationRate: 0.03,
            opexEscalation: country.economy.inflationRate,
            occupancyRamp: defaultOccupancyRamp(10),
            taxRate: country.economy.taxRate,
            depreciationYears: 7,
        });

        // Carbon
        const carbonResult = calculateCarbonFootprint({
            itLoadKw: site.itLoad,
            pue,
            gridCarbonIntensity: country.environment.gridCarbonIntensity,
            coolingType: site.coolingType,
            renewableOption: 'none',
            fuelHours: 50,
            genType: 'diesel',
            countryName: country.name,
        });

        return {
            site,
            countryName: country.name,
            capex: capexResult,
            financial: financialResult,
            carbon: carbonResult,
            totalStaff,
            annualStaffCost,
            annualOpex,
            pue,
            capexPerKw: capexResult.metrics.perKw,
            opexPerKw: site.itLoad > 0 ? annualOpex / site.itLoad : 0,
            staffPerMw: site.itLoad > 0 ? totalStaff / (site.itLoad / 1000) : 0,
        };
    });

    // Portfolio aggregates
    const totalCapex = siteResults.reduce((sum, r) => sum + r.capex.total, 0);
    const totalAnnualOpex = siteResults.reduce((sum, r) => sum + r.annualOpex, 0);
    const totalStaff = siteResults.reduce((sum, r) => sum + r.totalStaff, 0);
    const totalItLoadKw = siteResults.reduce((sum, r) => sum + r.site.itLoad, 0);
    const totalAnnualCO2 = siteResults.reduce((sum, r) => sum + r.carbon.annualEmissionsTonCO2, 0);
    const weightedPue = totalItLoadKw > 0
        ? siteResults.reduce((sum, r) => sum + r.pue * r.site.itLoad, 0) / totalItLoadKw
        : 0;
    const portfolioNpv = siteResults.reduce((sum, r) => sum + r.financial.npv, 0);

    // Rankings
    const byCapexPerKw = [...siteResults].sort((a, b) => a.capexPerKw - b.capexPerKw);
    const byPue = [...siteResults].sort((a, b) => a.pue - b.pue);
    const byIrr = [...siteResults].sort((a, b) => b.financial.irr - a.financial.irr);
    const byTier = [...siteResults].sort((a, b) => b.site.tierLevel - a.site.tierLevel);

    return {
        sites: siteResults,
        totalCapex,
        totalAnnualOpex,
        totalStaff,
        totalItLoadKw,
        totalAnnualCO2,
        weightedPue,
        portfolioNpv,
        bestCapexPerKw: byCapexPerKw[0]?.site.id || '',
        bestPue: byPue[0]?.site.id || '',
        bestIrr: byIrr[0]?.site.id || '',
        lowestRisk: byTier[0]?.site.id || '',
    };
}

function getLocationFromCountry(countryId: string): string {
    const map: Record<string, string> = {
        US: 'usa', GB: 'europe', DE: 'europe', NL: 'europe', IE: 'europe', FR: 'europe', SE: 'europe',
        PL: 'europe', SG: 'sea', JP: 'japan', AU: 'australia', IN: 'india', CN: 'china',
        KR: 'south_korea', AE: 'mena', SA: 'mena', QA: 'mena',
        BR: 'south_america', CL: 'south_america', MX: 'south_america', CO: 'south_america',
        ZA: 'africa', NG: 'africa', KE: 'africa',
    };
    return map[countryId] || 'sea';
}
