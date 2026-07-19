/* ─── SPARES DATA ADAPTER (Phase Z) ──────────────────────────────────────────
 * Pure per-class spares model binding operations-maintenance-assets to
 * models.spares.newsvendor: fleet counts from commissioning.equipScale,
 * MTBF/MTTR from DATA.reliability.components (IEEE-493 engine data),
 * lead times from MaintenanceStrategyEngine LEAD_TIMES (country, days),
 * and the newsvendor critical-fractile run per equipment class.
 *
 * Provenance discipline: every economically-material figure is labeled
 * 'engine' (shared RZEngine data), 'screening' (documented assumption,
 * user-overridable in the UI) or 'user' (page-local override). No
 * Math.random, no fabricated numbers — engine absent → engineReady:false.
 * ──────────────────────────────────────────────────────────────────────── */

import { rzModels, rzData } from '@/lib/rz-engine';
import { LEAD_TIMES } from '@/modules/maintenance/MaintenanceStrategyEngine';

export type SparesClassKey = 'switchgear' | 'ups' | 'generator' | 'chiller' | 'crac' | 'pdu';
export type Provenance = 'engine' | 'screening' | 'user';
export type Criticality = 'Critical' | 'Major';

export interface SparesClassOverride { unitCost?: number; leadWeeks?: number; fillRatePct?: number; }
export type SparesOverrides = Partial<Record<SparesClassKey, SparesClassOverride>>;

/* Engine class ↔ equipScale fleet key ↔ criticality / fill-rate target. */
export const SPARES_CLASSES: Record<SparesClassKey, { equipKey: string; criticality: Criticality; fillTargetPct: number }> = {
    switchgear: { equipKey: 'switchgear', criticality: 'Critical', fillTargetPct: 99 },
    ups: { equipKey: 'ups_modules', criticality: 'Critical', fillTargetPct: 99 },
    generator: { equipKey: 'generators', criticality: 'Critical', fillTargetPct: 99 },
    chiller: { equipKey: 'chillers', criticality: 'Critical', fillTargetPct: 99 },
    crac: { equipKey: 'cooling_units', criticality: 'Critical', fillTargetPct: 99 },
    pdu: { equipKey: 'pdus', criticality: 'Major', fillTargetPct: 97 },
};

/* Fallback screening unit costs — used ONLY when the engine's researched
 * DATA.sparesPricing table (v2.5.2, sourced public list-price bands) is
 * unavailable. User-overridable per class in the UI. */
export const UNIT_COST_SCREENING: Record<SparesClassKey, number> = {
    ups: 45_000, generator: 120_000, chiller: 90_000, crac: 15_000, pdu: 8_000, switchgear: 25_000,
};

/* Map each spares class to its researched DATA.sparesPricing class (mid band).
 * switchgear has no researched class yet — stays screening. */
const SPARES_PRICE_CLASS: Partial<Record<SparesClassKey, string>> = {
    ups: 'ups_module_50kw',
    generator: 'genset_top_overhaul',
    chiller: 'chiller_compressor',
    crac: 'crah_ec_fan_kit',
    pdu: 'pdu_breaker_mccb',
};

/** Researched engine price (mid band) else screening fallback. */
function unitCostDefault(classKey: SparesClassKey): { cost: number; fromEngine: boolean } {
    try {
        const key = SPARES_PRICE_CLASS[classKey];
        const band = key ? (rzData() as { sparesPricing?: { classes?: Record<string, { mid?: number }> } })?.sparesPricing?.classes?.[key] : undefined;
        if (band && typeof band.mid === 'number' && band.mid > 0) return { cost: band.mid, fromEngine: true };
    } catch { /* engine absent */ }
    return { cost: UNIT_COST_SCREENING[classKey], fromEngine: false };
}

/* ASSUMPTION (screening-grade, USD per stockout event) — cost of an unfilled
 * critical-spare demand (expedite + downtime exposure) by criticality. */
export const UNDERSTOCK_COST_SCREENING: Record<Criticality, number> = { Critical: 85_000, Major: 45_000 };

/* ASSUMPTION — inventory carrying rate (%/yr of unit value) and repairable
 * part service life (years) used for the overstock cost Co = rate·cost·life. */
export const CARRY_RATE_PCT = 25;
export const PART_LIFE_YRS = 8;

/* Engine newsvendor default lead time (weeks) when no country lead is known. */
export const ENGINE_DEFAULT_LEAD_WEEKS = 16;

export interface SparesRowProv { mtbf: Provenance; unitCost: Provenance; leadWeeks: Provenance; }

export interface SparesRow {
    classKey: SparesClassKey; label: string; criticality: Criticality;
    fleet: number; mtbf: number; mttr: number; demandYr: number;
    unitCost: number; leadWeeks: number; fillTargetPct: number;
    cr: number; qStar: number; rop: number; safetyStock: number;
    fillAchieved: number; annualCost: number; usedPoissonMode: boolean;
    prov: SparesRowProv;
}

export interface SparesTotals {
    inventoryValue: number;   // Σ Q* × unit cost
    annualCost: number;       // Σ per-class holding + shortage cost
    weightedFillPct: number;  // demand-weighted achieved fill rate (%)
    belowTarget: number;      // classes with achieved fill < target
}

export interface SparesResult {
    engineReady: boolean;
    rows: SparesRow[];
    totals: SparesTotals | null;
    leadBasis: string; // human-readable default lead-time basis for UI/PDF
}

export interface SparesComputeInput {
    itLoadKw: number;
    densityBucket: 'standard' | 'medium' | 'high' | 'ai_hpc';
    countryId?: string;
    overrides?: SparesOverrides;
}

/** Country lead time (MaintenanceStrategyEngine LEAD_TIMES, days) → weeks.
 *  Unknown country → engine newsvendor default (16 wk). */
export function defaultLeadWeeks(countryId?: string): { weeks: number; basis: string } {
    const days = countryId ? LEAD_TIMES[countryId] : undefined;
    if (days != null) {
        const weeks = Math.max(1, Math.ceil(days / 7));
        return { weeks, basis: `${countryId} lead ${days} d → ${weeks} wk (screening)` };
    }
    return { weeks: ENGINE_DEFAULT_LEAD_WEEKS, basis: `engine default ${ENGINE_DEFAULT_LEAD_WEEKS} wk (screening)` };
}

/** Per-class newsvendor spares recommendation over the equipScale fleet.
 *  Pure: same input → same output; engine absent → honest engineReady:false. */
export function computeSpares(input: SparesComputeInput): SparesResult {
    const models = rzModels();
    const data = rzData();
    const newsvendor = models?.spares?.newsvendor;
    const equipScale = models?.commissioning?.equipScale;
    const components = data?.reliability?.components;
    const lead = defaultLeadWeeks(input.countryId);

    if (typeof newsvendor !== 'function' || typeof equipScale !== 'function' || !components) {
        return { engineReady: false, rows: [], totals: null, leadBasis: lead.basis };
    }

    const fleetMap = equipScale({ itLoad: input.itLoadKw, rackDensity: input.densityBucket }) ?? {};
    const overrides = input.overrides ?? {};

    const rows: SparesRow[] = (Object.keys(SPARES_CLASSES) as SparesClassKey[]).flatMap((classKey) => {
        const def = SPARES_CLASSES[classKey];
        const comp = components[classKey];
        const fleet = Number(fleetMap[def.equipKey]) || 0;
        if (!comp || !(comp.mtbf > 0) || fleet <= 0) return [];

        const ov = overrides[classKey] ?? {};
        const demandYr = (fleet * 8760) / comp.mtbf;
        const priceDefault = unitCostDefault(classKey);
        const unitCost = ov.unitCost != null ? ov.unitCost : priceDefault.cost;
        const leadWeeks = ov.leadWeeks != null ? ov.leadWeeks : lead.weeks;
        const fillTargetPct = ov.fillRatePct != null ? ov.fillRatePct : def.fillTargetPct;

        const nv = newsvendor({
            unitCost,
            understockCostPerEvent: UNDERSTOCK_COST_SCREENING[def.criticality],
            carryRatePct: CARRY_RATE_PCT,
            partLifeYrs: PART_LIFE_YRS,
            muAnnual: demandYr,
            ltWeeks: leadWeeks,
            fillRatePct: fillTargetPct,
        });

        return [{
            classKey,
            label: String(comp.label ?? classKey),
            criticality: def.criticality,
            fleet,
            mtbf: comp.mtbf,
            mttr: comp.mttr,
            demandYr: +demandYr.toFixed(2),
            unitCost,
            leadWeeks,
            fillTargetPct,
            cr: nv.cr,
            qStar: nv.qStar,
            rop: nv.rop,
            safetyStock: nv.safetyStock,
            fillAchieved: nv.fillAchieved,
            annualCost: nv.annualCost,
            usedPoissonMode: !!nv.usedPoissonMode,
            prov: {
                mtbf: 'engine',
                unitCost: ov.unitCost != null ? 'user' : (priceDefault.fromEngine ? 'engine' : 'screening'),
                leadWeeks: ov.leadWeeks != null ? 'user' : 'screening',
            },
        }];
    });

    if (rows.length === 0) {
        return { engineReady: true, rows: [], totals: null, leadBasis: lead.basis };
    }

    const demandSum = rows.reduce((s, r) => s + r.demandYr, 0);
    const totals: SparesTotals = {
        inventoryValue: rows.reduce((s, r) => s + r.qStar * r.unitCost, 0),
        annualCost: rows.reduce((s, r) => s + r.annualCost, 0),
        weightedFillPct: demandSum > 0
            ? +(rows.reduce((s, r) => s + r.fillAchieved * r.demandYr, 0) / demandSum * 100).toFixed(1)
            : 0,
        belowTarget: rows.filter((r) => r.fillAchieved < r.fillTargetPct / 100).length,
    };

    return { engineReady: true, rows, totals, leadBasis: lead.basis };
}
