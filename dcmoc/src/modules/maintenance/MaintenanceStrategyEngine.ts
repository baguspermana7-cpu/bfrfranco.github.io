/**
 * MaintenanceStrategyEngine — Phase 28
 * 
 * Three analytical models:
 * 1. Predictive vs Reactive vs Planned cost comparison
 * 2. Vendor SLA tier comparison (NBD / 4hr / 2hr)
 * 3. Spare parts inventory optimization
 */

import { AssetCount } from '@/lib/AssetGenerator';
import { ASSETS, AssetTemplate } from '@/constants/assets';
import { MaintenanceEvent } from './ScheduleEngine';
import { CountryProfile } from '@/constants/countries';
import { rzData } from '@/lib/rz-engine';

// ═══════════════════════════════════════════════════════════════
// 1. STRATEGY COMPARISON (Reactive / Planned / Predictive)
// ═══════════════════════════════════════════════════════════════

export interface StrategyProfile {
    id: 'reactive' | 'planned' | 'predictive';
    label: string;
    description: string;
    annualLaborCost: number;
    annualPartsCost: number;
    annualDowntimeCost: number;
    unplannedFailures: number;       // Estimated failures/year
    sensorCapex: number;             // CBM sensor investment (predictive only)
    totalAnnualCost: number;
    fiveYearNPV: number;
    taskReduction: number;           // % reduction vs planned baseline
    reliabilityIndex: number;        // 0-100 scale
    color: string;
}

export interface StrategyComparison {
    strategies: StrategyProfile[];
    recommended: 'reactive' | 'planned' | 'predictive';
    recommendationReason: string;
    fiveYearSavings: number;         // Savings of recommended vs worst
}

// A6: Country-specific labor rates (fallback to 2026 US defaults)
// 2026: US DC technician internal rate: $48-$55/hr (BLS 2025, +5% YoY)
// Emergency/on-call premium: 6-7x normal in US; 4-5x in APAC
const getLabor = (country?: CountryProfile) => {
    const base = country?.labor?.laborRatePerHour ?? 50; // 2026 US default $50/hr
    return {
        internal: base,
        emergency: base * (country?.id === 'US' ? 6.5 : country?.region === 'APAC' ? 4.5 : 5.5),
    };
};
const getDowntimeCost = (country?: CountryProfile) => country?.risk?.downtimeCostPerMin ?? 5000;

export const calculateStrategyComparison = (
    assets: AssetCount[],
    schedule: MaintenanceEvent[],
    tierLevel: 3 | 4,
    country?: CountryProfile,
    maintenanceModel: 'in-house' | 'hybrid' | 'vendor' = 'in-house',
    hybridRatio: number = 0.5
): StrategyComparison => {
    const labor = getLabor(country);
    const COST_PER_MINUTE_DOWN = getDowntimeCost(country);

    // Engine-sourced maintenance economics (RZEngine DATA.maintenance) with local
    // fallbacks — values are parity-identical to the former inline literals.
    const MNT = (rzData().maintenance || {}) as {
        vendorPremium?: number; reactiveFailureMult?: number;
        predictiveTaskReduction?: number; predictiveFailureReduction?: number;
    };

    // Maintenance model cost multiplier:
    // In-house: 100% internal labor rate
    // Hybrid: internal portion at 1.0x + vendor portion at 1.3x premium
    // Vendor: 10% oversight at internal + 90% at vendor 1.35x premium
    const internalPortion = maintenanceModel === 'in-house' ? 1.0
        : maintenanceModel === 'hybrid' ? Math.max(0.1, hybridRatio)
        : 0.10; // vendor = 10% oversight
    const vendorPortion = 1.0 - internalPortion;
    const vendorPremium = MNT.vendorPremium ?? 1.35; // Vendor labor costs 35% more (engine-sourced)
    const modelMult = internalPortion + (vendorPortion * vendorPremium);

    // Planned Preventive (Baseline) — current SFG20 schedule
    const plannedTotalHours = schedule.reduce((a, e) => a + e.durationHours, 0);
    const plannedLaborCost = plannedTotalHours * labor.internal * modelMult;
    const plannedPartsCost = calculatePartsCost(assets);
    const plannedFailures = tierLevel === 4 ? 1.2 : 2.5; // Expected unplanned failures/year
    const plannedDowntimeCost = plannedFailures * 45 * COST_PER_MINUTE_DOWN * 0.01; // 45min avg, 1% probability each
    const plannedTotal = plannedLaborCost + plannedPartsCost + plannedDowntimeCost;

    // Reactive — No planned maintenance, fix when broken
    const reactiveFailures = plannedFailures * (MNT.reactiveFailureMult ?? 3.5);   // engine-sourced
    const reactiveDowntimeMinutes = reactiveFailures * 90; // 90 min avg per failure (vs 45 planned)
    const reactiveDowntimeCost = reactiveDowntimeMinutes * COST_PER_MINUTE_DOWN * 0.03;
    const reactiveLaborCost = reactiveFailures * 6 * labor.emergency * modelMult; // 6hr avg emergency fix
    const reactivePartsCost = plannedPartsCost * 0.6; // Less consumables but emergency parts cost 2x
    const reactiveEmergencyParts = reactiveFailures * 2500; // $2500 avg emergency part
    const reactiveTotal = reactiveLaborCost + reactivePartsCost + reactiveEmergencyParts + reactiveDowntimeCost;

    // Predictive (CBM) — Condition-based monitoring
    const sensorCapex = calculateSensorCapex(assets);
    const predictiveTaskReduction = MNT.predictiveTaskReduction ?? 0.25; // engine-sourced (25% fewer tasks via CBM)
    const predictiveLaborCost = plannedLaborCost * (1 - predictiveTaskReduction);
    const predictivePartsCost = plannedPartsCost * 0.85; // Optimized replacement timing
    const predictiveFailures = plannedFailures * (1 - (MNT.predictiveFailureReduction ?? 0.70)); // engine-sourced (70% fewer)
    const predictiveDowntimeCost = predictiveFailures * 30 * COST_PER_MINUTE_DOWN * 0.005;
    const predictiveTotal = predictiveLaborCost + predictivePartsCost + predictiveDowntimeCost;

    // Discount rate for NPV
    const discountRate = 0.08;
    const npv = (annual: number, capex: number = 0) => {
        let total = capex;
        for (let y = 0; y < 5; y++) {
            // screening 3%/yr cost escalation inside the 5-yr NPV
            total += annual * Math.pow(1.03, y) / Math.pow(1 + discountRate, y + 1);
        }
        return total;
    };

    const strategies: StrategyProfile[] = [
        {
            id: 'reactive',
            label: 'Reactive (Run-to-Failure)',
            description: 'No scheduled maintenance. Fix equipment only when it breaks. Lowest upfront cost but highest risk.',
            annualLaborCost: reactiveLaborCost,
            annualPartsCost: reactivePartsCost + reactiveEmergencyParts,
            annualDowntimeCost: reactiveDowntimeCost,
            unplannedFailures: reactiveFailures,
            sensorCapex: 0,
            totalAnnualCost: reactiveTotal,
            fiveYearNPV: npv(reactiveTotal),
            taskReduction: -100,
            reliabilityIndex: 35,
            color: '#ef4444' // Red
        },
        {
            id: 'planned',
            label: 'Planned Preventive (SFG20)',
            description: 'Industry-standard scheduled maintenance per SFG20/ASHRAE. Balanced cost and reliability.',
            annualLaborCost: plannedLaborCost,
            annualPartsCost: plannedPartsCost,
            annualDowntimeCost: plannedDowntimeCost,
            unplannedFailures: plannedFailures,
            sensorCapex: 0,
            totalAnnualCost: plannedTotal,
            fiveYearNPV: npv(plannedTotal),
            taskReduction: 0,
            reliabilityIndex: 72,
            color: '#3b82f6' // Blue
        },
        {
            id: 'predictive',
            label: 'Predictive (CBM)',
            description: 'Condition-based monitoring with IoT sensors. Highest upfront cost, lowest long-term risk.',
            annualLaborCost: predictiveLaborCost,
            annualPartsCost: predictivePartsCost,
            annualDowntimeCost: predictiveDowntimeCost,
            unplannedFailures: predictiveFailures,
            sensorCapex,
            totalAnnualCost: predictiveTotal,
            fiveYearNPV: npv(predictiveTotal, sensorCapex),
            taskReduction: predictiveTaskReduction * 100,
            reliabilityIndex: 92,
            color: '#10b981' // Emerald
        }
    ];

    // Recommend strategy based on tier
    const sorted = [...strategies].sort((a, b) => a.fiveYearNPV - b.fiveYearNPV);
    const recommended = sorted[0].id;
    const worst = sorted[sorted.length - 1];
    const best = sorted[0];

    let reason: string;
    if (recommended === 'predictive') {
        reason = `Predictive (CBM) saves ${formatUSD(worst.fiveYearNPV - best.fiveYearNPV)} over 5 years vs ${worst.label}. Sensor CAPEX of ${formatUSD(sensorCapex)} pays back in ${(sensorCapex / (plannedTotal - predictiveTotal)).toFixed(1)} years.`;
    } else if (recommended === 'planned') {
        reason = `Planned Preventive is optimal for this configuration. CBM CAPEX of ${formatUSD(sensorCapex)} does not justify the marginal savings at current scale.`;
    } else {
        reason = 'Reactive is only recommended for non-critical assets with full redundancy.';
    }

    return {
        strategies,
        recommended,
        recommendationReason: reason,
        fiveYearSavings: worst.fiveYearNPV - best.fiveYearNPV
    };
};

function calculatePartsCost(assets: AssetCount[]): number {
    let total = 0;
    assets.forEach(ac => {
        const template = ASSETS.find(a => a.id === ac.assetId);
        if (!template) return;
        // Consumables
        if (template.consumables) {
            template.consumables.forEach(c => {
                const replacementsPerYear = 12 / c.baseLifeMonths;
                total += replacementsPerYear * c.costPerUnit * ac.count;
            });
        }
        // Critical spares annualized cost (holding + expected consumption)
        if (template.criticalSpares) {
            template.criticalSpares.forEach(cs => {
                const qty = Math.max(cs.minStock, Math.ceil(ac.count * cs.stockPercent));
                const holdingCost = qty * cs.costPerUnit * HOLDING_COST_RATE;
                const expectedConsumption = ac.count * cs.stockPercent * 0.3 * cs.costPerUnit;
                total += holdingCost + expectedConsumption;
            });
        }
    });
    return total;
}

function calculateSensorCapex(assets: AssetCount[]): number {
    // 2026 CBM sensor costs (IIoT market survey 2025):
    // Power quality analyzers: $3,200-$4,500/unit → $3,500 avg
    // Vibration + thermal combos: $1,800-$2,800 → $2,300 avg
    // Fire status sensors: $450-$600 → $500 avg
    // Misc: $200-$350 → $250 avg
    let total = 0;
    assets.forEach(ac => {
        const template = ASSETS.find(a => a.id === ac.assetId);
        if (!template) return;
        const cat = template.category;
        if (cat === 'Critical Power') total += ac.count * 3500;     // Power quality monitors (2026)
        else if (cat === 'Cooling') total += ac.count * 2300;       // Vibration + thermal (2026)
        else if (cat === 'Fire Safety') total += ac.count * 500;    // Status monitoring
        else total += ac.count * 250;
    });
    return total;
}


// ═══════════════════════════════════════════════════════════════
// 2. VENDOR SLA COMPARISON
// ═══════════════════════════════════════════════════════════════

export type OmContractTierKey = 'comprehensive' | 'preventive' | 'onCall';

/** Annual USD band (low/mid/high) for a vendor contract tier. */
export interface SLAContractBand { low: number; mid: number; high: number }

export interface SLATier {
    id: 'nbd' | '4hr' | '2hr';
    label: string;
    responseTime: string;
    annualCost: number;
    coverageScope: string;
    riskExposure: number;         // $/year expected uninsured downtime cost
    breakEvenDowntimeCost: number; // At what $/min this tier breaks even vs NBD
    netAnnualCost: number;         // SLA cost - risk reduction vs NBD
    recommended: boolean;
    /* Engine DATA.omContracts binding (present only when the sourced band drove the cost) */
    omTierKey?: OmContractTierKey;      // which sourced contract tier maps to this SLA tier
    contractBand?: SLAContractBand;     // annual USD band = $/kW-yr band × IT kW × multipliers
    contractPerKwYr?: SLAContractBand;  // sourced $/kW-yr band as published
}

/** Provenance / multiplier metadata for the vendor contract pricing. */
export interface SLAContractBasis {
    fromEngine: boolean;          // true = DATA.omContracts sourced band; false = verbatim local fallback
    basis: string;                // human-readable pricing basis (engine DATA.omContracts.basis)
    itLoadKw: number;
    thirdPartyApplied: boolean;   // third-party (non-OEM) contract multiplier applied
    agingApplied: boolean;        // facility >10yr multiplier applied
    thirdPartyMultiplier: number;
    agingFacilityMultiplier: number;
}

export interface SLAComparison {
    tiers: SLATier[];
    recommended: 'nbd' | '4hr' | '2hr';
    analysis: string;
    contractBasis: SLAContractBasis;
}

/** Optional engine-contract inputs: IT load (kW) activates the DATA.omContracts
 *  $/kW-yr pricing; third-party + facility-age drive the sourced multipliers. */
export interface SLAContractOptions {
    itLoadKw?: number;
    thirdParty?: boolean;
    facilityAgeYears?: number;
}

/* SLA tier ↔ engine O&M contract tier mapping (scope-matched):
 * NBD ≈ onCall (T&M on failure), 4hr ≈ preventive (PM + corrective billed),
 * 2hr ≈ comprehensive (full parts+labor+emergency, OEM-grade SLA). */
const OM_TIER_FOR_SLA: Record<'nbd' | '4hr' | '2hr', OmContractTierKey> = {
    nbd: 'onCall', '4hr': 'preventive', '2hr': 'comprehensive',
};

export const calculateSLAComparison = (
    assets: AssetCount[],
    tierLevel: 3 | 4,
    country?: CountryProfile,
    contract?: SLAContractOptions
): SLAComparison => {
    const criticalAssets = assets.filter(a => {
        const t = ASSETS.find(at => at.id === a.assetId);
        return t && (t.category === 'Critical Power' || t.category === 'Cooling' || t.category === 'Fire Safety');
    });
    const totalCritical = criticalAssets.reduce((a, c) => a + c.count, 0);

    // Expected annual failure incidents (critical path)
    const baseFailures = tierLevel === 4 ? 0.8 : 2.0;

    // Regional cost multiplier
    const regionMult = country?.id === 'US' ? 1.3 : country?.id === 'SG' ? 1.2 : country?.id === 'JP' ? 1.4 : 1.0;

    // ── Vendor contract cost per tier — engine DATA.omContracts (v2.5.2 sourced
    // $/kW-yr bands) × IT kW, with third-party (×0.65) and >10yr-facility (×1.5)
    // multipliers. Verbatim per-critical-asset fallback kept below for when the
    // engine (or IT load) is unavailable.
    const om = (rzData().omContracts || null) as {
        tiers?: Record<OmContractTierKey, { low?: number; mid?: number; high?: number; scope?: string }>;
        thirdPartyMultiplier?: number; agingFacilityMultiplier?: number; basis?: string;
    } | null;
    const itLoadKw = contract?.itLoadKw ?? 0;
    const omReady = !!(om?.tiers?.comprehensive && om?.tiers?.preventive && om?.tiers?.onCall && itLoadKw > 0);
    const thirdPartyMultiplier = om?.thirdPartyMultiplier ?? 0.65;
    const agingFacilityMultiplier = om?.agingFacilityMultiplier ?? 1.5;
    const thirdPartyApplied = !!contract?.thirdParty;
    const agingApplied = (contract?.facilityAgeYears ?? 0) > 10;
    const contractMult = (thirdPartyApplied ? thirdPartyMultiplier : 1) * (agingApplied ? agingFacilityMultiplier : 1);

    // Verbatim local fallback — SLA costs scale with number of critical assets
    const fallbackAnnual: Record<'nbd' | '4hr' | '2hr', number> = {
        nbd: totalCritical * 800 * regionMult,  // ~$800/asset/year for NBD
        '4hr': totalCritical * 2200 * regionMult,
        '2hr': totalCritical * 4500 * regionMult,
    };

    const perKwBand = (slaId: 'nbd' | '4hr' | '2hr'): SLAContractBand | undefined => {
        if (!omReady) return undefined;
        const t = om!.tiers![OM_TIER_FOR_SLA[slaId]];
        return { low: t.low ?? 0, mid: t.mid ?? 0, high: t.high ?? 0 };
    };
    const annualBand = (slaId: 'nbd' | '4hr' | '2hr'): SLAContractBand | undefined => {
        const b = perKwBand(slaId);
        if (!b) return undefined;
        return { low: b.low * itLoadKw * contractMult, mid: b.mid * itLoadKw * contractMult, high: b.high * itLoadKw * contractMult };
    };
    const contractAnnual = (slaId: 'nbd' | '4hr' | '2hr'): number =>
        omReady ? annualBand(slaId)!.mid : fallbackAnnual[slaId];

    const nbdBaseCost = contractAnnual('nbd');
    const fourHrBaseCost = contractAnnual('4hr');
    const twoHrBaseCost = contractAnnual('2hr');

    // Risk exposure: downtime cost that SLA doesn't cover
    // NBD: avg 16hr response → 960 min downtime per incident
    // 4hr: avg 4hr → 240 min
    // 2hr: avg 2hr → 120 min
    const slaCostPerMin = getDowntimeCost(country);
    const nbdDowntime = baseFailures * 960 * slaCostPerMin * 0.01; // 1% probability weighting
    const fourHrDowntime = baseFailures * 240 * slaCostPerMin * 0.01;
    const twoHrDowntime = baseFailures * 120 * slaCostPerMin * 0.01;

    const nbdBreakEven = 0; // Baseline
    const fourHrBreakEven = (fourHrBaseCost - nbdBaseCost) / (baseFailures * (960 - 240) * 0.01);
    const twoHrBreakEven = (twoHrBaseCost - nbdBaseCost) / (baseFailures * (960 - 120) * 0.01);

    const tiers: SLATier[] = [
        {
            id: 'nbd',
            label: 'Next Business Day',
            responseTime: '8-24 hours',
            annualCost: nbdBaseCost,
            coverageScope: 'Parts replacement, remote diagnostics, business hours only',
            riskExposure: nbdDowntime,
            breakEvenDowntimeCost: nbdBreakEven,
            netAnnualCost: nbdBaseCost + nbdDowntime,
            recommended: false,
            ...(omReady ? { omTierKey: OM_TIER_FOR_SLA.nbd, contractBand: annualBand('nbd'), contractPerKwYr: perKwBand('nbd') } : {})
        },
        {
            id: '4hr',
            label: '4-Hour Response',
            responseTime: '4 hours (24/7)',
            annualCost: fourHrBaseCost,
            coverageScope: 'Parts + on-site engineer, 24/7 critical spares cache',
            riskExposure: fourHrDowntime,
            breakEvenDowntimeCost: fourHrBreakEven,
            netAnnualCost: fourHrBaseCost + fourHrDowntime,
            recommended: false,
            ...(omReady ? { omTierKey: OM_TIER_FOR_SLA['4hr'], contractBand: annualBand('4hr'), contractPerKwYr: perKwBand('4hr') } : {})
        },
        {
            id: '2hr',
            label: '2-Hour Response',
            responseTime: '2 hours (24/7)',
            annualCost: twoHrBaseCost,
            coverageScope: 'Dedicated engineer, on-site spares locker, priority escalation',
            riskExposure: twoHrDowntime,
            breakEvenDowntimeCost: twoHrBreakEven,
            netAnnualCost: twoHrBaseCost + twoHrDowntime,
            recommended: false,
            ...(omReady ? { omTierKey: OM_TIER_FOR_SLA['2hr'], contractBand: annualBand('2hr'), contractPerKwYr: perKwBand('2hr') } : {})
        }
    ];

    // Recommend based on net annual cost (SLA + risk exposure)
    const sorted = [...tiers].sort((a, b) => a.netAnnualCost - b.netAnnualCost);
    sorted[0].recommended = true;
    // Also mark the original
    const rec = tiers.find(t => t.id === sorted[0].id);
    if (rec) rec.recommended = true;

    const recommended = sorted[0].id;
    const analysis = tierLevel === 4
        ? `For Tier IV operations, ${sorted[0].label} SLA provides the best balance of cost (${formatUSD(sorted[0].annualCost)}/yr) and risk exposure (${formatUSD(sorted[0].riskExposure)}/yr). The break-even downtime cost for upgrading from NBD to 4-Hour is ${formatUSD(fourHrBreakEven)}/min.`
        : `For Tier III, the ${sorted[0].label} SLA is recommended. Upgrading to 4-Hour response is justified when downtime costs exceed ${formatUSD(fourHrBreakEven)}/min.`;

    const contractBasis: SLAContractBasis = {
        fromEngine: omReady,
        basis: omReady
            ? (om?.basis ?? 'Engine DATA.omContracts $/kW-yr fixed-fee bands')
            : 'Local screening fallback — per-critical-asset rates × regional multiplier',
        itLoadKw,
        thirdPartyApplied,
        agingApplied,
        thirdPartyMultiplier,
        agingFacilityMultiplier,
    };

    return { tiers, recommended, analysis, contractBasis };
};


// ═══════════════════════════════════════════════════════════════
// 3. SPARE PARTS OPTIMIZATION
// ═══════════════════════════════════════════════════════════════

export interface SparePartItem {
    assetId: string;
    assetName: string;
    partName: string;
    category: string;
    criticality: 'Critical' | 'Major' | 'Minor';
    quantity: number;          // Recommended on-site stock
    unitCost: number;
    annualConsumption: number; // Units consumed per year
    holdingCost: number;       // Annual cost to keep in stock (15% of value)
    leadTimeDays: number;
    reorderPoint: number;      // When to reorder
    totalAnnualCost: number;   // Consumption cost + holding cost
}

export interface SparesOptimization {
    items: SparePartItem[];
    totalInventoryValue: number;
    totalAnnualConsumptionCost: number;
    totalHoldingCost: number;
    totalAnnualSparesBudget: number;
    criticalSpares: number;    // Count of critical items
    recommendations: string[];
}

const HOLDING_COST_RATE = 0.15; // 15% of inventory value per year

export const LEAD_TIMES: Record<string, number> = {
    'US': 5, 'SG': 7, 'JP': 7, 'MY': 14, 'ID': 21, 'AU': 10, 'IN': 18, 'DE': 7, 'GB': 5
};

const CRITICALITY_MAP: Record<string, 'Critical' | 'Major' | 'Minor'> = {
    'Critical Power': 'Critical',
    'Cooling': 'Critical',
    'Fire Safety': 'Major',
    'Fuel System': 'Major',
    'BMS & IT': 'Minor',
    'Security': 'Minor',
    'Water Treatment': 'Minor',
    'Civil': 'Minor'
};

export const calculateSparesOptimization = (
    assets: AssetCount[],
    tierLevel: 3 | 4,
    country?: CountryProfile
): SparesOptimization => {
    const items: SparePartItem[] = [];
    const countryId = country?.id || 'US';
    const leadTime = LEAD_TIMES[countryId] || 14;

    assets.forEach(ac => {
        const template = ASSETS.find(a => a.id === ac.assetId);
        if (!template) return;

        const criticality = CRITICALITY_MAP[template.category] || 'Minor';

        // Consumables (regular replacement items)
        if (template.consumables) {
            template.consumables.forEach(c => {
                const annualConsumption = (12 / c.baseLifeMonths) * ac.count;

                // Safety stock: Critical = 3 months, Major = 2 months, Minor = 1 month
                const safetyMonths = criticality === 'Critical' ? 3 : criticality === 'Major' ? 2 : 1;
                const safetyStock = Math.ceil((annualConsumption / 12) * safetyMonths);

                // Lead time demand
                const leadTimeDemand = Math.ceil((annualConsumption / 365) * leadTime);

                // Reorder point = lead time demand + safety stock
                const reorderPoint = leadTimeDemand + safetyStock;

                // Recommended quantity = reorder point + 1 buffer
                const quantity = Math.max(1, reorderPoint + 1);

                const holdingCost = quantity * c.costPerUnit * HOLDING_COST_RATE;
                const consumptionCost = annualConsumption * c.costPerUnit;

                items.push({
                    assetId: template.id,
                    assetName: template.name,
                    partName: c.name,
                    category: template.category,
                    criticality,
                    quantity,
                    unitCost: c.costPerUnit,
                    annualConsumption: Math.round(annualConsumption * 10) / 10,
                    holdingCost: Math.round(holdingCost),
                    leadTimeDays: leadTime,
                    reorderPoint,
                    totalAnnualCost: Math.round(consumptionCost + holdingCost)
                });
            });
        }

        // Critical Spares (insurance stock — rarely consumed but essential)
        if (template.criticalSpares) {
            template.criticalSpares.forEach(cs => {
                const quantity = Math.max(cs.minStock, Math.ceil(ac.count * cs.stockPercent));
                const holdingCost = quantity * cs.costPerUnit * HOLDING_COST_RATE;
                // Critical spares have very low annual consumption (typically 0-1 per year)
                const annualConsumption = Math.max(0.1, ac.count * cs.stockPercent * 0.3); // ~30% chance of use per year

                items.push({
                    assetId: template.id,
                    assetName: template.name,
                    partName: `[SPARE] ${cs.name}`,
                    category: template.category,
                    criticality: 'Critical',
                    quantity,
                    unitCost: cs.costPerUnit,
                    annualConsumption: Math.round(annualConsumption * 10) / 10,
                    holdingCost: Math.round(holdingCost),
                    leadTimeDays: cs.leadTimeWeeks * 7,
                    reorderPoint: quantity, // Always keep at minimum stock
                    totalAnnualCost: Math.round(annualConsumption * cs.costPerUnit + holdingCost)
                });
            });
        }
    });

    // Sort by criticality then cost
    const critOrder = { 'Critical': 0, 'Major': 1, 'Minor': 2 };
    items.sort((a, b) => critOrder[a.criticality] - critOrder[b.criticality] || b.totalAnnualCost - a.totalAnnualCost);

    const totalInventoryValue = items.reduce((a, i) => a + i.quantity * i.unitCost, 0);
    const totalAnnualConsumptionCost = items.reduce((a, i) => a + i.annualConsumption * i.unitCost, 0);
    const totalHoldingCost = items.reduce((a, i) => a + i.holdingCost, 0);
    const criticalSpares = items.filter(i => i.criticality === 'Critical').length;

    // Generate recommendations
    const recommendations: string[] = [];

    if (leadTime > 14) {
        recommendations.push(`Extended lead times (${leadTime} days) in ${country?.name || 'this region'} require higher safety stock. Consider establishing a regional spares cache.`);
    }

    if (criticalSpares > 5) {
        recommendations.push(`${criticalSpares} critical spares identified. Consider a vendor-managed inventory (VMI) agreement to reduce holding costs by ~30%.`);
    }

    const highCostItems = items.filter(i => i.totalAnnualCost > 5000);
    if (highCostItems.length > 0) {
        recommendations.push(`${highCostItems.length} items exceed $5K/year. Negotiate volume discounts or framework agreements for: ${highCostItems.map(i => i.partName).join(', ')}.`);
    }

    if (tierLevel === 4) {
        recommendations.push('Tier IV operations should maintain 2x safety stock for Critical Power and Cooling consumables to ensure concurrent maintainability.');
    }

    return {
        items,
        totalInventoryValue: Math.round(totalInventoryValue),
        totalAnnualConsumptionCost: Math.round(totalAnnualConsumptionCost),
        totalHoldingCost: Math.round(totalHoldingCost),
        totalAnnualSparesBudget: Math.round(totalAnnualConsumptionCost + totalHoldingCost),
        criticalSpares,
        recommendations
    };
};


// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function formatUSD(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
}
