
/* ─── SHARED-ENGINE DELEGATION (RZEngine v2.3.0 DATA.capexDetail) ───────────
 * The 9 same-name multiplier tables (redundancy/cooling/rack/building/seismic/
 * fireSuppression/fireAlarm/ups/gen) plus yearEscalation + substationCosts
 * (shape-adapted: engine stores plain numbers, DCMOC {mult,note}/{base,label})
 * are read from the engine at calc time, with the capex-data.ts locals as
 * fallbacks. Per SUPER_ENGINE.md §Z.3, DCMOC's FINER-grained data stays LOCAL
 * and is NOT delegated: costFactors (A7 2025 bases — engine provenance says
 * explicitly NOT merged), cityData, CountryProfile constructionIndex,
 * locationMultipliers, permitRegionMult, testingRedundancyMult.
 * ──────────────────────────────────────────────────────────────────────── */
import { rzData, rzModels } from './rz-engine';
import type { ArchKey } from './requirementsMappings';
import { archExtraCostMeta } from './capex-data';
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
    testingRedundancyMult,
    distributionMultipliers,
    pduMultipliers,
    cablingMultipliers,
    floorMultipliers,
    securityMultipliers,
    fiberEntryMultipliers,
    siteConditionMultipliers,
    marketConditionMultipliers,
    txLeadMultipliers,
    txTypeMultipliers,
    deliveryMethodMultipliers
} from './capex-data';
import { CountryProfile } from '@/constants/countries';
import { getPUE } from '@/constants/pue';

export interface CapexInput {
    itLoad: number; // kW
    location: string; // 'sea', 'usa', etc.
    country?: CountryProfile; // NEW: Direct Country Profile
    cityMarket: string; // 'none', 'silicon_valley', etc.
    buildingType: string;
    coolingType: string;
    redundancy: string;
    rackType: string;
    rackForm?: string;   // Workstream C — 'std42u'|'tall48u'|'ocp'; floor-space m²/rack factor
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
    powerDistribution?: string;
    transformerType?: string;
    pduType?: string;
    cablingType?: string;
    floorType?: string;
    siteCondition?: string;
    securityLevel?: string;
    fiberEntry?: string;
    /* Owner S9 — capex-calculator questionnaire parity (shared single source;
     * deepSea also drives models.cooling.deepSea + the CDU advanced section). */
    seismicZone?: string;               // 'zone0'..'zone4'
    refrigerantType?: string;           // engine DATA.refrigerants key
    deepSea?: boolean;                  // Deep Sea Water Cooling enabled
    dsDepthM?: number;                  // intake depth (m)
    dsPipelineKm?: number;              // pipeline length (km)
    dsDeltaTC?: number;                 // loop ΔT (°C)
    renewSolarMwp?: number;             // on-site solar sizing
    renewBessMwh?: number;              // BESS sizing
    /* Ship-A — selected AI reference architecture (engine archProfiles key).
     * Drives a MARGINAL power-provisioning uplift on electrical/UPS/generator
     * (peak-sized power plant) + an optional GB300 cooling-kit line + interconnect
     * estimates. Consumed via the shared engine (models.requirements.*). */
    archKey?: ArchKey;
    /* Workstream A — power topology. 'prime' = off-grid (Ireland DNO-less case):
     * NO utility substation/grid-connection front-of-meter cost, oversized gensets
     * (prime-rated). 'hybrid' = partial grid. Drives genset CAPEX × gensetCapMult
     * and front-of-meter grid infra × gridCapexMult from engine DATA.fuelGen. */
    powerSource?: 'utility-backup' | 'prime' | 'hybrid';
}

/** Ship-A — analyst interconnect fabric estimates, EXCLUDED from the infra total. */
export interface CapexInterconnect {
    infiniband: number;
    ethernet: number;
    gpuCount: number;
    note: string;
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
        subPhases: { parent: string; name: string; start: number; end: number; color: string }[];
        totalMonths: number;
    };
    /** Ship-A — analyst interconnect estimates (EXCLUDED from `total` and `costs`). */
    interconnect?: CapexInterconnect;
}

export const calculateCapex = (input: CapexInput): CapexResult => {
    const {
        itLoad, location, country, cityMarket, buildingType, coolingType, redundancy,
        rackType, upsType, genType, fuelHours, fireType, alarmType,
        projYear, designFee, pmFee, contingency, includeFOM,
        substationType, utilityRate, greenCert, renewableOption, archKey
    } = input;

    /* Workstream A — power-source multipliers from engine DATA.fuelGen.powerSourceModel
     * (single source shared with FuelGenEngine). Prime power: gensets oversized
     * (gensetCapMult ~1.5×) and grid infra = 0 (gridCapexMult 0). Hybrid: partial. */
    const powerSource = input.powerSource ?? 'utility-backup';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const psModel = (rzData() as any)?.fuelGen?.powerSourceModel?.[powerSource];
    const gensetCapMult: number = psModel?.gensetCapMult ?? 1.0;
    const gridCapexMult: number = psModel?.gridCapexMult ?? 1.0;

    /* Ship-A — arch-aware MARGINAL power-provisioning uplift (electrical/UPS/gen
     * only). The engine's powerProvisionUplift already divides peak/nominal by
     * baselinePeakRatio (~1.2×) so the CPU-era headroom priced into the base
     * $/kW is not double-counted. Returns 1.0 (no-op) when arch is absent. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reqModel = (rzModels() as any)?.requirements;
    const powerUplift: number = archKey && reqModel?.powerProvisionUplift
        ? (reqModel.powerProvisionUplift(archKey) || 1.0)
        : 1.0;

    // 1. Determine Base Multipliers — engine DATA.capexDetail tables first
    // (same names), locals from capex-data.ts as fallback (see header note).
    const cd = rzData().capexDetail ?? {};
    const redMult = (cd.redundancyMult ?? redundancyMultipliers)[redundancy] || 1.0;
    const coolMult = (cd.coolingMult ?? coolingMultipliers)[coolingType] || 1.0;
    const rackMult = (cd.rackMult ?? rackMultipliers)[rackType] || 1.0;
    const buildMult = (cd.buildingMult ?? buildingMultipliers)[buildingType] || 1.0;
    const seismicMult = (cd.seismicMult ?? seismicMultipliers)[input.seismicZone ?? 'zone2'] || 1.0; // wired to input.seismicZone (zone2 default) — now consistent with the BOQ take-off basis
    const fireSupMult = (cd.fireSuppressionMult ?? fireSuppressionMultipliers)[fireType] || 1.0;
    const alarmMult = (cd.fireAlarmMult ?? fireAlarmMultipliers)[alarmType] || 1.0;
    const upsMult = (cd.upsMult ?? upsMultipliers)[upsType] || 1.0;
    const genMult = (cd.genMult ?? genMultipliers)[genType] || 1.0;
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

    // Shape-adapted: engine yearEscalation is a plain number, local is {mult,note}
    const yearMult = cd.yearEscalation?.[projYear] ?? yearEscalation[projYear]?.mult ?? 1.0;
    const globalMult = yearMult; // Simplified for now

    // 2. Calculate Hard Costs
    const costs: Record<string, number> = {};
    let totalHardCost = 0;

    for (const [key, factor] of Object.entries(costFactors)) {
        let multiplier = locMult;

        // Ship-C: per-category landed cost (import duty × equipment share). Engine
        // returns 1.0 for labor-heavy categories and FTA/no-country → no-op unless
        // the country carries a duty band. Supersedes the dormant importDifficultyFactor.
        const landedFactor = (rzModels() as any)?.supplyChain?.landedFactor ? (rzModels() as any).supplyChain.landedFactor(country ?? null, key) : 1.0;
        multiplier *= landedFactor;

        if (key === 'building') multiplier *= buildMult * rackMult;
        else if (key === 'seismic') multiplier *= seismicMult * buildMult;
        else if (key === 'electrical') multiplier *= redMult * rackMult * upsMult * powerUplift;
        else if (key === 'ups') multiplier *= redMult * rackMult * upsMult * powerUplift;
        else if (key === 'generator') multiplier *= redMult * fuelMult * genMult * powerUplift * gensetCapMult;
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
    // rack density classes (screening): standard 6 / medium 12.5 / high 25 / extreme 75 kW·rack
    const racks = Math.ceil(itLoad / (rackType === 'standard' ? 6 : rackType === 'medium' ? 12.5 : rackType === 'high' ? 25 : 75));

    /* Ship-A — GB300 (any arch carrying coolingKitUsdPerRack) adds a real infra
     * cooling-kit line = coolingKitUsdPerRack × racks INTO costs + total. */
    if (archKey) {
        const archProfile = reqModel?.archProfile ? reqModel.archProfile(archKey) : null;
        const kitPerRack: number = archProfile?.coolingKitUsdPerRack ?? 0;
        if (kitPerRack > 0) {
            /* imported hardware → apply the same per-country landed factor (this line
             * is added after the cost loop, so it needs its own landedFactor call). */
            const kitLanded = (rzModels() as any)?.supplyChain?.landedFactor ? (rzModels() as any).supplyChain.landedFactor(country ?? null, 'coolingKit') : 1.0;
            const kitCost = kitPerRack * racks * kitLanded;
            costs.coolingKit = kitCost;
            totalHardCost += kitCost;
        }
    }

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

    /* Quality / site / market factors — wire the CapexDashboard FOM selects that
     * were declared-but-unused (dead controls: user picked them, they did nothing).
     * Each defaults to 1.0 at the UI default option so baseline projects are
     * unchanged; only non-default picks move CAPEX. Screening ±% per DATA.capexDetail
     * (engine-primary, capex-data twin fallback). */
    const qm = (map: Record<string, number>, engineMap: Record<string, number> | undefined, val: string | undefined, def: string): number =>
        ((engineMap ?? map)[val ?? def]) || 1.0;
    const qualityM =
        qm(distributionMultipliers, cd.fomDistMult, input.powerDistribution, 'busway') *
        qm(pduMultipliers, cd.fomPduMult, input.pduType, 'monitored') *
        qm(cablingMultipliers, cd.fomCablingMult, input.cablingType, 'cat6a') *
        qm(floorMultipliers, cd.fomFloorMult, input.floorType, 'raised') *
        qm(securityMultipliers, cd.fomSecurityMult, input.securityLevel, 'standard') *
        qm(fiberEntryMultipliers, cd.fomFiberEntryMult, input.fiberEntry, 'single') *
        qm(siteConditionMultipliers, cd.fomSiteMult, input.siteCondition, 'greenfield') *
        qm(marketConditionMultipliers, cd.fomMarketMult, input.marketCondition, 'normal') *
        qm(txLeadMultipliers, cd.fomTxLeadMult, input.transformerLead, 'standard') *
        qm(txTypeMultipliers, cd.fomTxTypeMult, input.transformerType, 'dry') *
        qm(deliveryMethodMultipliers, cd.fomDeliveryMult, input.deliveryMethod, 'design_build');
    if (qualityM !== 1.0) {
        currentTotal *= qualityM;
    }

    const contingencyVal = currentTotal * (contingency / 100);
    currentTotal += contingencyVal;

    // 5. FOM
    let fomTotal = 0;
    if (includeFOM) {
        // Shape-adapted: engine substationCosts is a plain number, local is {base,label}
        // Front-of-meter grid infra (substation + utility connection) scales with the
        // power source: prime power is off-grid → gridCapexMult 0 removes it entirely;
        // hybrid ~0.5. Switchgear stays (needed to distribute genset power off-grid too).
        const subCost = (cd.substationCosts?.[substationType] ?? substationCosts[substationType]?.base ?? 1000000) * gridCapexMult;
        const gridConnection = itLoad * 0.001 * 500000 * gridCapexMult;
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
    // A8: PUE from shared constants (modern 2025 standards)
    const pue = getPUE(coolingType);
    const annualEnergy = itLoad * pue * 8760 * 0.10; // Global avg estimate; country-specific rate used in SensitivityEngine
    // Workstream C — rack form factor drives floor-space m²/rack (48U tall packs
    // denser → 0.90×; OCP 21" open rack → 1.15×). Engine DATA.requirements.rackFormFactor.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rackFormFactor: number = ((rzData() as any)?.requirements?.rackFormFactor?.[input.rackForm ?? 'std42u']) ?? 1.0;
    const floorSpace = Math.ceil(racks * 2.5 * rackFormFactor); // 2.5 m2 per rack × form factor

    // Compute Timeline
    const timeline = computeTimeline(redundancy, buildingType, coolingType, effectiveRegion);

    /* Ship-A — interconnect fabric estimates (ANALYST). Returned as a SEPARATE
     * field, EXCLUDED from `total` and `costs` (not vendor list price; the IT
     * hardware fabric is out of the infrastructure CAPEX scope). */
    let interconnect: CapexInterconnect | undefined;
    if (archKey) {
        const archProfile = reqModel?.archProfile ? reqModel.archProfile(archKey) : null;
        const gpuCount: number = archProfile?.gpuCount ?? 0;
        if (gpuCount > 0 && reqModel?.interconnectCost) {
            interconnect = {
                infiniband: reqModel.interconnectCost('infiniband', gpuCount) || 0,
                ethernet: reqModel.interconnectCost('ethernet', gpuCount) || 0,
                gpuCount,
                note: 'ANALYST estimate · not vendor list · excluded from infra total',
            };
        }
    }

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
        timeline,
        interconnect
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

    // L2 sub-phases for detailed Gantt chart
    const subPhases = [
        // Design & Engineering
        { parent: 'Design & Engineering', name: 'Concept Design', start: startDesign, end: startDesign + Math.ceil(design * 0.3), color: '#10b981' },
        { parent: 'Design & Engineering', name: 'Detailed Design', start: startDesign + Math.ceil(design * 0.25), end: startDesign + Math.ceil(design * 0.65), color: '#10b981' },
        { parent: 'Design & Engineering', name: 'Equipment Specification', start: startDesign + Math.ceil(design * 0.5), end: startDesign + Math.ceil(design * 0.85), color: '#10b981' },
        { parent: 'Design & Engineering', name: 'Vendor Selection', start: startDesign + Math.ceil(design * 0.7), end: startDesign + design, color: '#10b981' },
        // Permitting
        { parent: 'Permitting', name: 'Environmental Assessment', start: startPermit, end: startPermit + Math.ceil(permit * 0.5), color: '#f59e0b' },
        { parent: 'Permitting', name: 'Building Permit', start: startPermit + Math.ceil(permit * 0.2), end: startPermit + Math.ceil(permit * 0.75), color: '#f59e0b' },
        { parent: 'Permitting', name: 'Utility Connection', start: startPermit + Math.ceil(permit * 0.4), end: startPermit + Math.ceil(permit * 0.9), color: '#f59e0b' },
        { parent: 'Permitting', name: 'Fire Safety Approval', start: startPermit + Math.ceil(permit * 0.5), end: startPermit + permit, color: '#f59e0b' },
        // Civil Construction
        { parent: 'Civil Construction', name: 'Site Prep & Excavation', start: startCivil, end: startCivil + Math.ceil(civil * 0.2), color: '#3b82f6' },
        { parent: 'Civil Construction', name: 'Foundations & Structural', start: startCivil + Math.ceil(civil * 0.15), end: startCivil + Math.ceil(civil * 0.55), color: '#3b82f6' },
        { parent: 'Civil Construction', name: 'Building Envelope', start: startCivil + Math.ceil(civil * 0.4), end: startCivil + Math.ceil(civil * 0.8), color: '#3b82f6' },
        { parent: 'Civil Construction', name: 'Raised Floor & Containment', start: startCivil + Math.ceil(civil * 0.65), end: startCivil + civil, color: '#3b82f6' },
        // MEP Installation
        { parent: 'MEP Installation', name: 'HV/LV Electrical', start: startMep, end: startMep + Math.ceil(mep * 0.5), color: '#8b5cf6' },
        { parent: 'MEP Installation', name: 'UPS & Battery', start: startMep + Math.ceil(mep * 0.2), end: startMep + Math.ceil(mep * 0.6), color: '#8b5cf6' },
        { parent: 'MEP Installation', name: 'Cooling Plant', start: startMep + Math.ceil(mep * 0.15), end: startMep + Math.ceil(mep * 0.7), color: '#8b5cf6' },
        { parent: 'MEP Installation', name: 'BMS / EPMS', start: startMep + Math.ceil(mep * 0.5), end: startMep + Math.ceil(mep * 0.85), color: '#8b5cf6' },
        { parent: 'MEP Installation', name: 'Fire Suppression', start: startMep + Math.ceil(mep * 0.4), end: startMep + Math.ceil(mep * 0.75), color: '#8b5cf6' },
        { parent: 'MEP Installation', name: 'Security Systems', start: startMep + Math.ceil(mep * 0.6), end: startMep + mep, color: '#8b5cf6' },
        // Commissioning
        { parent: 'Commissioning', name: 'IST (Individual System Test)', start: startComm, end: startComm + Math.ceil(comm * 0.35), color: '#ec4899' },
        { parent: 'Commissioning', name: 'IFC (Integrated Functional)', start: startComm + Math.ceil(comm * 0.25), end: startComm + Math.ceil(comm * 0.65), color: '#ec4899' },
        { parent: 'Commissioning', name: 'Load Testing', start: startComm + Math.ceil(comm * 0.5), end: startComm + Math.ceil(comm * 0.85), color: '#ec4899' },
        { parent: 'Commissioning', name: 'Handover & Documentation', start: startComm + Math.ceil(comm * 0.7), end: startComm + comm, color: '#ec4899' },
    ];

    return {
        totalMonths,
        phases: [
            { name: 'Design & Engineering', start: startDesign, end: startDesign + design, color: '#10b981' },
            { name: 'Permitting', start: startPermit, end: startPermit + permit, color: '#f59e0b' },
            { name: 'Civil Construction', start: startCivil, end: startCivil + civil, color: '#3b82f6' },
            { name: 'MEP Installation', start: startMep, end: startMep + mep, color: '#8b5cf6' },
            { name: 'Commissioning', start: startComm, end: startComm + comm, color: '#ec4899' }
        ],
        subPhases
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
