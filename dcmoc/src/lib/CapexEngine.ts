
import {
    costFactors,
    redundancyMultipliers,
    coolingMultipliers,
    rackMultipliers,
    buildingMultipliers,
    seismicMultipliers,
    fireSuppressionMultipliers,
    fireAlarmMultipliers,
    upsMultipliers,
    genMultipliers,
    locationMultipliers,
    cityData,
    yearEscalation,
    substationCosts,
    permitRegionMult,
    testingRedundancyMult
} from './capex-data';
import { CountryProfile } from '@/constants/countries';

export interface CapexInput {
    itLoad: number; // kW
    location: string; // 'sea', 'usa', etc.
    country?: CountryProfile; // NEW: Direct Country Profile
    cityMarket: string; // 'none', 'silicon_valley', etc.
    buildingType: string;
    coolingType: string;
    redundancy: string;
    rackType: string;
    upsType: string;
    genType: string;
    fuelHours: number;
    fireType: string;
    alarmType: string;
    // Advanced fields
    projYear: string;
    designFee: number; // %
    pmFee: number; // %
    contingency: number; // %
    includeFOM: boolean;
    substationType: string;
    transformerLead: string;
    utilityRate: number; // %
    greenCert: string; // 'none', 'silver', etc.
    renewableOption: string; // 'none', 'solar', etc.
    // ... add more as needed for advanced mode logic if fully implementing
    deliveryMethod?: string;
    marketCondition?: string;
    contractorAvail?: string;
    powerDistribution?: string;
    transformerType?: string;
    pduType?: string;
    cablingType?: string;
    floorType?: string;
    siteCondition?: string;
    securityLevel?: string;
    fiberEntry?: string;
}

export interface CapexResult {
    total: number;
    costs: Record<string, number>;
    softCosts: { design?: number; pm?: number };
    contingency: number;
    fomTotal: number;
    pue: number;
    metrics: {
        perKw: number;
        annualEnergy: number;
        floorSpace: number;
        racks: number;
        timelineMonths: number;
    };
    timeline: {
        phases: { name: string; start: number; end: number; color: string }[];
        totalMonths: number;
    };
}

export const calculateCapex = (input: CapexInput): CapexResult => {
    const {
        itLoad, location, country, cityMarket, buildingType, coolingType, redundancy,
        rackType, upsType, genType, fuelHours, fireType, alarmType,
        projYear, designFee, pmFee, contingency, includeFOM,
        substationType, utilityRate, greenCert, renewableOption
    } = input;

    // 1. Determine Base Multipliers
    const redMult = redundancyMultipliers[redundancy] || 1.0;
    const coolMult = coolingMultipliers[coolingType] || 1.0;
    const rackMult = rackMultipliers[rackType] || 1.0;
    const buildMult = buildingMultipliers[buildingType] || 1.0;
    const seismicMult = seismicMultipliers['zone2'] || 1.0; // Defaulting to Zone 2 for now
    const fireSupMult = fireSuppressionMultipliers[fireType] || 1.0;
    const alarmMult = fireAlarmMultipliers[alarmType] || 1.0;
    const upsMult = upsMultipliers[upsType] || 1.0;
    const genMult = genMultipliers[genType] || 1.0;
    const fuelMult = 1 + (fuelHours - 24) * 0.008;

    // Location & Year Logic
    // PRIORITY: Country Index > City Data > Legacy Location Map
    let locMult = 1.0;
    let effectiveRegion = location;

    if (country && country.constructionIndex) {
        locMult = country.constructionIndex;
        // Adjust effective region for permits if needed
        if (country.region === 'APAC') effectiveRegion = 'sea'; // Fallback mapping
        if (country.id === 'JP') effectiveRegion = 'japan';
        if (country.id === 'CN') effectiveRegion = 'china';
        if (country.id === 'IN') effectiveRegion = 'india';
        if (country.id === 'AU') effectiveRegion = 'australia';
        if (country.region === 'EMEA') effectiveRegion = 'europe';
        if (country.region === 'AMER') effectiveRegion = 'usa';
    } else {
        // Fallback to legacy
        locMult = locationMultipliers[location] || 1.0;
    }

    if (cityMarket !== 'none' && cityData[cityMarket]) {
        const city = cityData[cityMarket];
        effectiveRegion = city.region;
        // If city data exists, it might override country index or blend? 
        // For now let's let specific city data override country index if provided
        locMult = city.perW / 13.0;
    }

    const yearMult = yearEscalation[projYear]?.mult || 1.0;
    const globalMult = yearMult; // Simplified for now

    // 2. Calculate Hard Costs
    const costs: Record<string, number> = {};
    let totalHardCost = 0;

    for (const [key, factor] of Object.entries(costFactors)) {
        let multiplier = locMult;

        if (key === 'building') multiplier *= buildMult * rackMult;
        else if (key === 'seismic') multiplier *= seismicMult * buildMult;
        else if (key === 'electrical') multiplier *= redMult * rackMult * upsMult;
        else if (key === 'ups') multiplier *= redMult * rackMult * upsMult;
        else if (key === 'generator') multiplier *= redMult * fuelMult * genMult;
        else if (key === 'cooling') multiplier *= coolMult * rackMult;
        else if (key === 'fireSuppression') multiplier *= fireSupMult;
        else if (key === 'fireAlarm') multiplier *= alarmMult;
        else if (key === 'commissioning') multiplier *= redMult;
        else if (key === 'testing') {
            const regionTest = permitRegionMult[effectiveRegion] || permitRegionMult.usa;
            const redTest = testingRedundancyMult[redundancy] || 1.0;
            multiplier *= regionTest.testing * redTest;
        } else if (key === 'permits') {
            const regionPermit = permitRegionMult[effectiveRegion] || permitRegionMult.usa;
            multiplier *= regionPermit.permits;
        }

        costs[key] = factor.base * itLoad * multiplier * globalMult;
        totalHardCost += costs[key];
    }

    // Fixed Costs (PDU, Cabling - Simplified for MVP)
    const racks = Math.ceil(itLoad / (rackType === 'standard' ? 6 : rackType === 'medium' ? 12.5 : rackType === 'high' ? 25 : 75));

    // 3. Soft Costs
    const softCosts: { design?: number; pm?: number } = {};
    softCosts.design = totalHardCost * (designFee / 100);
    softCosts.pm = totalHardCost * (pmFee / 100);
    const totalSoft = (softCosts.design || 0) + (softCosts.pm || 0);

    // 4. Contingency
    let currentTotal = totalHardCost + totalSoft;

    // Green Cert
    const greenM = greenCert === 'none' ? 1.0 : (greenCert === 'silver' ? 1.02 : (greenCert === 'gold' ? 1.04 : 1.08));
    if (greenM > 1.0) {
        const greenPremium = currentTotal * (greenM - 1.0);
        currentTotal += greenPremium;
    }

    const contingencyVal = currentTotal * (contingency / 100);
    currentTotal += contingencyVal;

    // 5. FOM
    let fomTotal = 0;
    if (includeFOM) {
        const subCost = substationCosts[substationType]?.base || 1000000;
        const gridConnection = itLoad * 0.001 * 500000;
        const switchgear = itLoad * 0.001 * 300000;
        const utilRateVal = utilityRate / 100;
        fomTotal = (subCost + gridConnection + switchgear) * (1 + utilRateVal) * yearMult;
        currentTotal += fomTotal;
    }

    // 6. Renewables
    let renewableCost = 0;
    if (renewableOption === 'solar') renewableCost = 1200000 * (itLoad / 1000);
    if (renewableOption === 'solar_bess') renewableCost = 2500000 * (itLoad / 1000);
    currentTotal += renewableCost * globalMult;

    // Metrics
    // A8: Updated PUE to modern 2025 standards
    const pue = coolingType === 'air' ? 1.35 : (coolingType === 'inrow' ? 1.28 : (coolingType === 'rdhx' ? 1.18 : 1.08));
    const annualEnergy = itLoad * pue * 8760 * 0.10; // $0.10/kWh default
    const floorSpace = Math.ceil(racks * 2.5); // 2.5 m2 per rack

    // Compute Timeline
    const timeline = computeTimeline(redundancy, buildingType, coolingType, effectiveRegion);

    return {
        total: currentTotal,
        costs,
        softCosts,
        contingency: contingencyVal,
        fomTotal,
        pue,
        metrics: {
            perKw: currentTotal / itLoad,
            annualEnergy,
            floorSpace,
            racks,
            timelineMonths: timeline.totalMonths
        },
        timeline
    };
};

export const computeTimeline = (redundancy: string, building: string, cooling: string, region: string) => {
    // Base Calculation
    const bases = {
        n: { design: 4, permit: 3, civil: 8, mep: 6, commission: 2 },
        n1: { design: 5, permit: 3, civil: 10, mep: 8, commission: 3 },
        '2n': { design: 6, permit: 4, civil: 12, mep: 10, commission: 4 },
        '2n1': { design: 7, permit: 4, civil: 14, mep: 12, commission: 5 }
    };
    // @ts-ignore
    const base = bases[redundancy] || bases['n1'];

    // Multipliers
    const buildMult = building === 'warehouse' ? 0.7 : (building === 'modular' ? 0.6 : (building === 'highrise' ? 1.4 : 1.0));
    const coolMult = cooling === 'liquid' ? 1.3 : 1.0;
    const permitMult = ['sea', 'india', 'china', 'japan', 'australia'].includes(region) ? 1.4 : 1.0;

    const design = Math.ceil(base.design);
    const permit = Math.ceil(base.permit * permitMult);
    const civil = Math.ceil(base.civil * buildMult);
    const mep = Math.ceil(base.mep * coolMult);
    const comm = Math.ceil(base.commission);

    const startDesign = 0;
    const startPermit = 2;
    const startCivil = startPermit + permit - 1;
    const startMep = startCivil + Math.floor(civil * 0.4);
    const startComm = startMep + mep - 2;

    const endComm = startComm + comm;
    const totalMonths = endComm;

    return {
        totalMonths,
        phases: [
            { name: 'Design & Engineering', start: startDesign, end: startDesign + design, color: '#10b981' },
            { name: 'Permitting', start: startPermit, end: startPermit + permit, color: '#f59e0b' },
            { name: 'Civil Construction', start: startCivil, end: startCivil + civil, color: '#3b82f6' },
            { name: 'MEP Installation', start: startMep, end: startMep + mep, color: '#8b5cf6' },
            { name: 'Commissioning', start: startComm, end: startComm + comm, color: '#ec4899' }
        ]
    };
};

// A13: Equipment Lifecycle Replacement Schedule
export interface LifecycleItem {
    component: string;
    replacementYears: number;
    costPerKw: number;
    annualizedCostPerKw: number;
}

export const getLifecycleReplacements = (itLoadKw: number): { items: LifecycleItem[]; totalAnnualized: number; total20Year: number } => {
    const items: LifecycleItem[] = [
        { component: 'UPS Batteries (VRLA)', replacementYears: 5, costPerKw: 120, annualizedCostPerKw: 120 / 5 },
        { component: 'UPS Batteries (Li-Ion)', replacementYears: 10, costPerKw: 180, annualizedCostPerKw: 180 / 10 },
        { component: 'Diesel Generators', replacementYears: 15, costPerKw: 350, annualizedCostPerKw: 350 / 15 },
        { component: 'CRAC/CRAH Units', replacementYears: 12, costPerKw: 200, annualizedCostPerKw: 200 / 12 },
        { component: 'Fire Suppression Cylinders', replacementYears: 10, costPerKw: 30, annualizedCostPerKw: 30 / 10 },
        { component: 'PDU/RPP', replacementYears: 15, costPerKw: 80, annualizedCostPerKw: 80 / 15 },
        { component: 'BMS/DCIM Upgrade', replacementYears: 7, costPerKw: 40, annualizedCostPerKw: 40 / 7 },
    ];
    const totalAnnualized = items.reduce((sum, i) => sum + i.annualizedCostPerKw, 0) * itLoadKw;
    const total20Year = items.reduce((sum, i) => sum + (Math.floor(20 / i.replacementYears) * i.costPerKw), 0) * itLoadKw;
    return { items, totalAnnualized, total20Year };
};

export const generateCapexNarrative = (result: CapexResult): string => {
    const { total, metrics, pue } = result;
    const perKw = metrics.perKw;

    let narrative = `Estimated Total CAPEX is **$${(total / 1000000).toFixed(2)} Million** ($${Math.round(perKw).toLocaleString()}/kW). `;

    if (perKw < 8000) narrative += "This falls within the **Low Cost** range, typical for hyperscale or simplified redundancy facilities. ";
    else if (perKw < 15000) narrative += "This represents a **Standard Market** rate for Tier III enterprise facilities. ";
    else narrative += "This indicates a **Premium/High-Spec** facility, likely due to 2N redundancy, advanced cooling, or high construction costs in the region. ";

    narrative += `The facility achieves a PUE of **${pue.toFixed(2)}**, `;
    if (pue < 1.3) narrative += "which is **Best-in-Class** efficiency.";
    else if (pue < 1.5) narrative += "reflecting **Good** modern efficiency standards.";
    else narrative += "which is typical for legacy or basic air-cooled designs.";

    return narrative;
};
