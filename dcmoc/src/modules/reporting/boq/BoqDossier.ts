/* ─── BOQ DOSSIER — Bill of Quantities technical dossier surface ─────────────
 * Consumes the SHARED engine BOQ models (rzModels().boq.generate + .summary)
 * and renders a screening-grade Bill of Quantities as a complete, styled HTML5
 * document (dark/instrument theme, A4 print CSS). The document is opened in a
 * print window (same idiom as PrintReport.openStandardReport) so the owner can
 * view it in the browser and export to PDF via the print dialog.
 *
 * IMPORTANT — the margin is DISCLOSED, never "added on top": the T&T / C&W
 * benchmark $/kW already embed contractor margin, so summary() backs it out of
 * the subtotal (m/(1+m)). It is shown as a transparent disclosed line.
 *
 * Engine contract (see prompt / rz-engine.js models.boq):
 *   generate(costs, {racks,floorSpace,pue}, input, {locMult}) → BoqGenerated
 *   summary(costs, softCosts, contingency, fomTotal, capexTotal, {epcMarginPct?})
 *     → BoqSummary
 * All engine access is null-guarded — a missing engine yields a null model and
 * the caller (button) toasts / no-ops rather than throwing.
 * ──────────────────────────────────────────────────────────────────────── */

import { rzData, rzModels } from '@/lib/rz-engine';
import type { CapexInput, CapexResult } from '@/lib/CapexEngine';
import { equipmentBrands } from '@/lib/capex-data';

/* ── engine output types (named, mirrors the documented shape) ── */

export type BoqConfidence = 'high' | 'med' | 'low';

export interface BoqLine {
    desc: string;
    spec: string;
    unit: string;
    qty: number;
    unitRate: number;
    matCost: number;
    laborCost: number;
    total: number;
    confidence: BoqConfidence;
    source: string;
}

/** A subsystem grouping WITHIN a discipline — the deepened (Phase-4) engine
 *  splits each discipline's flat line list into named subsystems, each with
 *  its own component lines + rolled-up subtotal. Optional for backward-compat
 *  with older engines that only expose the flat `lines` union. */
export interface BoqSubsystem {
    key: string;
    label: string;
    lines: BoqLine[];
    subtotal: number;
}

export interface BoqDiscipline {
    key: string;
    label: string;
    categories: string[];
    categoryTotal: number;
    reconcileFactor: number;
    bottomUpRaw: number;
    /** Flat union of every component line across all subsystems — kept for
     *  backward-compat (older engines expose only this). */
    lines: BoqLine[];
    /** Deepened 3-level tree: discipline → subsystem → component lines.
     *  Missing/empty on older engines (the render falls back to `lines`). */
    subsystems?: BoqSubsystem[];
}

export interface BoqDrivers {
    mw: number;
    itKw: number;
    racks: number;
    floorSpaceM2: number;
    gfaM2: number;
    coolingKw: number;
    protectedM3: number;
}

export interface BoqGenerated {
    disciplines: BoqDiscipline[];
    drivers: BoqDrivers;
    hardTotal: number;
}

export interface BoqSafetyFactors {
    electricalContinuous: number;
    structuralLRFD: string;
    cableAmpacityDerate: number;
    coolingRedundancy: string;
    seismic?: string;
}

export interface BoqSummary {
    directCost: number;
    embeddedMargin: number;
    marginPctGross: number;
    marginMarkupOnCost: number;
    hardSubtotal: number;
    softCosts: number;
    contingency: number;
    fom: number;
    grandTotal: number;
    reconciles: boolean;
    unaccounted: number;
    safetyFactors: BoqSafetyFactors;
    aaceClass: number;
    aaceBand: string;
    disclaimer: string;
    marginNote: string;
}

export interface BoqEquipmentItem {
    discipline: string;
    equipment: string;
    spec: string;
    unit: string;
    capacityKw: number;
    qtyN: number;
    qtyInstalled: number;
    redundancy: string;
    leadTimeWk: number;
    category: string;
    confidence: BoqConfidence;
}

/** Phase-C — an equipment-schedule row enriched with a representative make/model
 *  (from equipmentBrands), a rating string, efficiency (when the brand carries it)
 *  and an indicative unit cost (engine unitRates rateKey). Fields are optional so
 *  the render degrades gracefully when a brand/rate is unavailable (never fabricated). */
export interface BoqEquipmentDeep extends BoqEquipmentItem {
    make?: string;
    modelName?: string;
    rating?: string;
    efficiency?: string;
    unitCost?: number;
    unitCostBasis?: string;
    unitCostConfidence?: BoqConfidence;
}

/** Phase-C — one critical-spares stock row (rzModels().boq.criticalSpares). */
export interface BoqSpareRow {
    key: string;
    label: string;
    component: string;
    mtbfHours: number;
    installedQty: number;
    failRatePerYr: number;
    recommendedStockQty: number;
    unitCost: number;
    holdingCost: number;
    annualReplacementCost: number;
    serviceLevelPct: number;
    priceClass: string;
    confidence: BoqConfidence;
    source: string;
}

/** Phase-C — one preventive-maintenance schedule row (rzModels().boq.pmSchedule). */
export interface BoqPmRow {
    key: string;
    system: string;
    installedQty: number;
    pmInterval: string;
    tasks: string;
    annualLaborHr: number;
    annualPmCost: number;
    confidence: BoqConfidence;
    source: string;
}

export interface BoqPackage {
    pkgNo: string;
    name: string;
    scope: string;
    disciplines: string[];
    tenderMethod: string;
    leadTimeWk: number;
    fatSat: string;
    warrantyYr: number;
    estValue: number;
    confidence: BoqConfidence;
    source: string;
}

export interface BoqProjectMeta {
    projectName: string;
    location: string;
    itMw: number;
    tierLevel: number;
    version: string;
}

/* ── Ship-C supply-chain types (mirror rzModels().supplyChain + DATA.supplyChain) ── */

/** Export-control advisory — rzModels().supplyChain.exportControl(country, archKey).
 *  PROXY/screening only (US BIS Fed-Register proxy; AI Diffusion Rule rescinded). */
export interface BoqExportControl {
    tier: number;
    label: string;
    note: string;
    frontier: boolean;
    restricted: boolean;
}

/** Per-category landed-cost uplift row (duty applies to the imported-equipment
 *  fraction of the category only — labor/civil already in the construction index). */
export interface BoqLandedCategory {
    category: string;
    share: number;
    landedFactor: number;
    /** BOQ Ship-D — the live CapexResult category $ (base cost before landed
     *  uplift), for the per-category landed-cost WORKED example. 0 when the
     *  category is not in result.costs. */
    categoryUsd: number;
    /** BOQ Ship-D — the effective duty rate (fraction) on this country's imports,
     *  for the worked line (category $ × share × duty → uplift $). */
    dutyRate: number;
}

/** Supply-chain & import screening block — computed from input.country + input.archKey.
 *  Null when no country is selected (the section renders a "no country" note). */
export interface BoqSupplyChain {
    country: string;
    dutyBand: string;
    dutyRatePct: number;
    exportTier: number;
    exportLabel: string;
    exportNote: string;
    exportControl: BoqExportControl;
    archKey: string | null;
    customsLeadWk: number;
    perCategoryLanded: BoqLandedCategory[];
}

/* ── dossier types (mirror rzData().dossier + rzModels().dossier) ── */

/** Executive summary — rzModels().dossier.executiveSummary(input, result). */
export interface DossierExecSummary {
    capacityMw: number;
    redundancy: string;
    cooling: string;
    pue: number;
    totalCapex: number;
    perKw: number;
    timelineMonths: number;
    racks: number;
}

/** Coarse risk band used by the permitting matrix + risk register chips. */
export type DossierRisk = 'high' | 'med' | 'low';

export interface PermitRow {
    permit: string;
    authority: string;
    durationWk: number;
    dependency: string;
    risk: DossierRisk;
    standard: string;
}

export interface DesignBasisRow {
    discipline: string;
    basis: string;
    standard: string;
    engineRef: string;
}

export interface RiskRow {
    id: string;
    category: string;
    risk: string;
    probability: DossierRisk;
    impact: DossierRisk;
    mitigation: string;
    owner: string;
    /** BOQ Ship-D — screening $-impact as a %-of-CAPEX band [lo, hi] (order-of-
     *  magnitude, NOT a quotation). Optional (older engines omit it). */
    costImpactPctBand?: [number, number];
    /** BOQ Ship-D — schedule slip (weeks) if unmitigated. Optional. */
    scheduleSlipWk?: number;
    /** BOQ Ship-D — post-mitigation residual risk band. Optional. */
    residual?: DossierRisk;
    /** BOQ Ship-D — the leading indicator to watch. Optional. */
    earlyWarning?: string;
}

/** BOQ Ship-D — one country-specific location risk row, derived live from the
 *  selected country's hazard/grid/talent fields (models.dossier.countryRisks). */
export interface CountryRiskRow {
    hazard: string;
    metric: string;
    severity: DossierRisk;
    mitigation: string;
    standard: string;
}

/** BOQ Ship-D — one document-delivery-schedule row (DATA.dossier.documentSchedule). */
export interface DocScheduleRow {
    deliverable: string;
    phase: string;
    approver: string;
}

export interface OpsReadyRow {
    item: string;
    owner: string;
    gate: string;
    engineRef?: string;
}

/** One labelled input / step / result value inside a worked-calc sheet. */
export interface EngCalcValue {
    label: string;
    value: number | string;
    unit: string;
    /** Present on step rows only — the arithmetic expression evaluated. */
    expr?: string;
}

/** A REAL worked engineering calculation — rzModels().dossier.engineeringCalcs(input, result).
 *  Formula + input values + arithmetic steps + a highlighted result, each tagged
 *  with a standard reference + [high|med|low] confidence. AACE Class-4 screening. */
export interface EngCalcSheet {
    id: string;
    title: string;
    discipline: string;
    standard: string;
    confidence: BoqConfidence;
    formula: string;
    inputs: EngCalcValue[];
    steps: EngCalcValue[];
    result: EngCalcValue;
}

/** Legacy flat reference-table row (older engines expose only DATA.dossier.engineeringCalcs). */
export interface EngCalcRow {
    calc: string;
    engineRef: string;
    standard: string;
}

/** Static dossier scaffold — rzData().dossier. */
export interface DossierData {
    permittingMatrix: PermitRow[];
    designBasis: DesignBasisRow[];
    riskRegister: RiskRow[];
    documentRegister: string[];
    opsReadiness: OpsReadyRow[];
    engineeringCalcs: EngCalcRow[];
    /** BOQ Ship-D — document delivery schedule (deliverable × phase × approver).
     *  Optional (older engines omit it). */
    documentSchedule?: DocScheduleRow[];
    /** BOQ Ship-D — version-control convention applied to the schedule. Optional. */
    documentControlNote?: string;
}

export interface BoqModel {
    generated: BoqGenerated;
    summary: BoqSummary;
    projectMeta: BoqProjectMeta;
    /** INFORMATIONAL — indicative equipment counts + N+redundancy sizing;
     *  NOT reconciled to $. Empty when the engine does not expose it. */
    equipment: BoqEquipmentItem[];
    /** Phase-C — equipment rows enriched with make/model/rating/efficiency +
     *  indicative unit cost. Empty when the engine equipment schedule is empty. */
    equipmentDeep: BoqEquipmentDeep[];
    /** Phase-C — critical-spares stock rows (rzModels().boq.criticalSpares).
     *  Empty when the engine does not expose the model. */
    spares: BoqSpareRow[];
    /** Phase-C — preventive-maintenance schedule rows (rzModels().boq.pmSchedule).
     *  Empty when the engine does not expose the model. */
    pmSchedule: BoqPmRow[];
    /** INDICATIVE procurement scope envelopes — values OVERLAP across packages
     *  and are NOT additive to the CAPEX total. Empty when unavailable. */
    procurement: BoqPackage[];
    /** Live executive summary (capacity/CAPEX/PUE/timeline). Null when the
     *  engine dossier model is unavailable. */
    executiveSummary: DossierExecSummary | null;
    /** Static EPC dossier scaffold (permitting / design basis / risk / …).
     *  Null when the engine does not expose DATA.dossier. */
    dossier: DossierData | null;
    /** REAL worked engineering calculations (formula + inputs + steps + result),
     *  computed live from the CAPEX input + result. Empty when the engine does
     *  not expose models.dossier.engineeringCalcs (older engines — the render
     *  falls back to the flat DATA.dossier.engineeringCalcs reference table). */
    engineeringCalcs: EngCalcSheet[];
    /** Ship-C per-country supply-chain & import screening (landed cost /
     *  export-control / customs lead). Null when no country is selected or the
     *  engine does not expose models.supplyChain. */
    supplyChain: BoqSupplyChain | null;
    /** BOQ Ship-D — country-specific location risks derived live from the
     *  selected country (models.dossier.countryRisks). Empty when no country is
     *  selected or the engine does not expose the model. */
    countryRisks: CountryRiskRow[];
}

export interface BuildBoqOpts {
    /** Override the disclosed EPC margin % (gross). Defaults to the engine basis. */
    epcMarginPct?: number;
}

/* ── build ─────────────────────────────────────────────────────────────── */

/** Structural view of a CountryProfile as consumed by the engine supply-chain
 *  models (they read `.name` + `.supplyChain.{importDutyBand,…}`). */
interface CountryProfileLike {
    name?: string;
    supplyChain?: { importDutyBand?: string; gpuExportTier?: number; customsLeadBand?: string };
}

/** Equipment categories surfaced in the per-category landed-cost table — ALL
 *  import-exposed disciplines that CapexEngine actually applies duty to (kept in
 *  sync with DATA.supplyChain.equipmentShareByCategory > 0), so the disclosed
 *  table matches the cost math. Labor-heavy (commissioning/testing/permits ≈ 0)
 *  are omitted. Order is the reporting order. */
const SUPPLY_CHAIN_CATEGORIES: readonly string[] = [
    'electrical',
    'ups',
    'generator',
    'cooling',
    'network',
    'bms',
    'security',
    'fireSuppression',
    'fireAlarm',
] as const;

/** Location multiplier for the bottom-up take-off: country constructionIndex
 *  (the same primary driver CapexEngine uses) or 1.0 when unavailable. */
function locMultOf(input: CapexInput): number {
    return input.country?.constructionIndex ?? 1.0;
}

/**
 * Build the combined BOQ model from the CAPEX input + result via the shared
 * engine. Returns null when the engine (or its boq models) is unavailable.
 */
export function buildBoqModel(
    input: CapexInput,
    result: CapexResult,
    opts?: BuildBoqOpts,
): BoqModel | null {
    const models = rzModels() as {
        boq?: {
            generate?: (
                costs: Record<string, number>,
                metrics: { racks: number; floorSpace: number; pue: number },
                input: CapexInput,
                o: { locMult: number },
            ) => BoqGenerated;
            summary?: (
                costs: Record<string, number>,
                softCosts: { design?: number; pm?: number },
                contingency: number,
                fomTotal: number,
                capexTotal: number,
                o: { epcMarginPct?: number },
            ) => BoqSummary;
            equipmentSchedule?: (
                costs: Record<string, number>,
                metrics: { racks: number; floorSpace: number; pue: number },
                input: CapexInput,
            ) => BoqEquipmentItem[];
            procurementPackages?: (costs: Record<string, number>) => BoqPackage[];
            equipmentUnitCost?: (
                equipKey: string,
            ) => { rateKey: string; unitUsd: number; confidence: BoqConfidence; unit: string } | null;
            criticalSpares?: (
                input: CapexInput,
                metrics: { pue: number },
                serviceLevelPct?: number,
            ) => BoqSpareRow[];
            pmSchedule?: (input: CapexInput, metrics: { pue: number }) => BoqPmRow[];
        };
        dossier?: {
            executiveSummary?: (input: CapexInput, result: CapexResult) => DossierExecSummary;
            engineeringCalcs?: (input: CapexInput, result: CapexResult) => EngCalcSheet[];
            countryRisks?: (country: unknown) => CountryRiskRow[];
        };
        supplyChain?: {
            dutyRate?: (country: CountryProfileLike | null) => number;
            landedFactor?: (country: CountryProfileLike | null, category: string) => number;
            exportTier?: (country: CountryProfileLike | null) => number;
            exportControl?: (country: CountryProfileLike | null, archKey?: string) => BoqExportControl;
            leadTimeCustomsWk?: (country: CountryProfileLike | null) => number;
        };
    };
    const boq = models.boq;
    if (!boq?.generate || !boq?.summary) return null;

    const metrics = {
        racks: result.metrics.racks,
        floorSpace: result.metrics.floorSpace,
        pue: result.pue,
    };

    const generated = boq.generate(result.costs, metrics, input, { locMult: locMultOf(input) });
    const summary = boq.summary(
        result.costs,
        result.softCosts,
        result.contingency,
        result.fomTotal,
        result.total,
        { epcMarginPct: opts?.epcMarginPct },
    );

    // Ship-2 informational surfaces — null-guarded (older engines omit them).
    const equipment: BoqEquipmentItem[] = boq.equipmentSchedule
        ? boq.equipmentSchedule(result.costs, metrics, input)
        : [];
    const procurement: BoqPackage[] = boq.procurementPackages
        ? boq.procurementPackages(result.costs)
        : [];

    // Phase-C — enrich the equipment schedule with a representative make/model +
    // rating + efficiency (from equipmentBrands, LOCAL) and an indicative unit cost
    // (engine unitRates rateKey). Missing fields are omitted, never fabricated.
    const equipmentDeep: BoqEquipmentDeep[] = equipment.map((e) =>
        enrichEquipment(e, input, boq.equipmentUnitCost),
    );

    // Phase-C — critical spares (newsvendor over MTBF-driven demand) + PM schedule.
    // Both null-guarded; both read only existing engine models/data.
    const spares: BoqSpareRow[] = boq.criticalSpares
        ? (boq.criticalSpares(input, { pue: result.pue }, 99) ?? [])
        : [];
    const pmSchedule: BoqPmRow[] = boq.pmSchedule
        ? (boq.pmSchedule(input, { pue: result.pue }) ?? [])
        : [];

    // Ship-3 dossier surfaces — null-guarded (older engines omit them).
    const executiveSummary: DossierExecSummary | null = models.dossier?.executiveSummary
        ? models.dossier.executiveSummary(input, result)
        : null;

    // Ship-3 (deepened) — REAL worked engineering calculations. Null-guarded:
    // older engines omit the model, so the render falls back to the flat table.
    const engineeringCalcs: EngCalcSheet[] = models.dossier?.engineeringCalcs
        ? (models.dossier.engineeringCalcs(input, result) ?? [])
        : [];

    // BOQ Ship-D — country-specific location risks (seismic / flood / grid / talent).
    // Null-guarded: empty when no country is selected or the engine omits the model.
    const countryRisks: CountryRiskRow[] = (models.dossier?.countryRisks && input.country)
        ? (models.dossier.countryRisks(input.country) ?? [])
        : [];

    const data = rzData() as {
        version?: string;
        dossier?: DossierData;
        supplyChain?: { equipmentShareByCategory?: Record<string, number> };
    };
    const dossier: DossierData | null = data.dossier ?? null;

    // Ship-C supply-chain surface — null when no country is selected (the
    // section then renders a "no country" note) or the engine omits the models.
    const supplyChain: BoqSupplyChain | null = buildSupplyChain(input, models.supplyChain, data.supplyChain, result.costs);

    const projectMeta: BoqProjectMeta = {
        projectName: '',       // filled by the caller (requirements store)
        location: input.country?.name ?? input.location,
        itMw: +(input.itLoad / 1000).toFixed(2),
        tierLevel: 0,          // filled by the caller (simulation store)
        version: data.version ?? '—',
    };

    return { generated, summary, projectMeta, equipment, equipmentDeep, spares, pmSchedule, procurement, executiveSummary, engineeringCalcs, dossier, supplyChain, countryRisks };
}

/* ── Phase-C equipment enrichment ──────────────────────────────────────────
 * Pick a representative brand row from equipmentBrands (LOCAL DCMOC data — the
 * capex-data.ts header keeps it local, not engine-merged) keyed by the item's
 * category + the project's upsType/genType/coolingType selection, and attach an
 * indicative unit cost from the engine unitRates rateKey. Every enriched field is
 * OPTIONAL — when a brand table or rate is missing, we omit it (never fabricate). */

interface BrandRow { brand?: string; model?: string; range?: string; efficiency?: string; note?: string }

/** Map an equipment item (by engine category) to (a) its brand-table family + the
 *  input-selected variant key, and (b) the engine equipmentUnitCost key. */
const EQUIP_META: Record<string, { costKey: string; brandFamily?: keyof typeof equipmentBrands; variantOf?: (i: CapexInput) => string }> = {
    ups: { costKey: 'ups', brandFamily: 'ups', variantOf: (i) => i.upsType },
    generator: { costKey: 'generator', brandFamily: 'generator', variantOf: (i) => i.genType },
    // MV transformer + PDU/RPP share the 'electrical' category — no dedicated brand
    // table, but they DO have their own unitRates rateKey (transformer / pdu).
    electrical: { costKey: 'transformer' },
    cooling: { costKey: 'crah', brandFamily: 'cooling', variantOf: (i) => i.coolingType },
};

/** Pick the first brand row of a family/variant, or the family's first available. */
function pickBrand(family: keyof typeof equipmentBrands, variant: string): BrandRow | null {
    const fam = equipmentBrands[family] as Record<string, unknown> | undefined;
    if (!fam) return null;
    const rows = (fam[variant] ?? Object.values(fam)[0]) as BrandRow[] | undefined;
    return Array.isArray(rows) && rows.length ? rows[0] : null;
}

/** Human rating string from the item's capacityKw (kW below 1 MVA, MVA for the
 *  transformer whose capacityKw carries MVA×1000). */
function ratingOf(e: BoqEquipmentItem): string {
    if (!Number.isFinite(e.capacityKw) || e.capacityKw <= 0) return '';
    if (e.equipment === 'MV transformer') return `${(e.capacityKw / 1000).toLocaleString()} MVA`;
    if (e.capacityKw >= 1000) return `${(e.capacityKw / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} MW`;
    return `${e.capacityKw.toLocaleString()} kW`;
}

function enrichEquipment(
    e: BoqEquipmentItem,
    input: CapexInput,
    unitCostFn?: (k: string) => { rateKey: string; unitUsd: number; confidence: BoqConfidence; unit: string } | null,
): BoqEquipmentDeep {
    // Route PDU/RPP to its own rate; keep the transformer on 'transformer'.
    const isPdu = /PDU/i.test(e.equipment);
    const meta = EQUIP_META[e.category] ?? (e.category === 'electrical' ? EQUIP_META.electrical : undefined);
    const costKey = isPdu ? 'pdu' : meta?.costKey;
    const brand = meta?.brandFamily && meta.variantOf ? pickBrand(meta.brandFamily, meta.variantOf(input)) : null;
    const uc = costKey && unitCostFn ? unitCostFn(costKey) : null;
    return {
        ...e,
        make: brand?.brand,
        modelName: brand?.model,
        rating: ratingOf(e),
        efficiency: brand?.efficiency,
        unitCost: uc?.unitUsd,
        unitCostBasis: uc ? `unitRates.${uc.rateKey} (${uc.unit})` : undefined,
        unitCostConfidence: uc?.confidence,
    };
}

/** Engine supply-chain model surface (subset consumed here). */
interface SupplyChainModels {
    dutyRate?: (country: CountryProfileLike | null) => number;
    landedFactor?: (country: CountryProfileLike | null, category: string) => number;
    exportTier?: (country: CountryProfileLike | null) => number;
    exportControl?: (country: CountryProfileLike | null, archKey?: string) => BoqExportControl;
    leadTimeCustomsWk?: (country: CountryProfileLike | null) => number;
}

/** Compute the supply-chain screening block from the CAPEX input + the shared
 *  engine models. Returns null when no country is selected or the engine does
 *  not expose models.supplyChain (both degrade to a "no country" note). */
function buildSupplyChain(
    input: CapexInput,
    models: SupplyChainModels | undefined,
    scData: { equipmentShareByCategory?: Record<string, number> } | undefined,
    costs: Record<string, number>,
): BoqSupplyChain | null {
    const country = input.country;
    if (!country || !models?.exportControl || !models?.landedFactor) return null;

    const c = country as CountryProfileLike;
    const archKey: string | null = input.archKey ?? null;
    const shares = scData?.equipmentShareByCategory ?? {};

    const dutyRate = models.dutyRate ? models.dutyRate(c) : 0;
    const dutyRatePct = dutyRate * 100;
    const exportControl = models.exportControl(c, input.archKey);
    const perCategoryLanded: BoqLandedCategory[] = SUPPLY_CHAIN_CATEGORIES.map((category) => ({
        category,
        share: shares[category] ?? 0,
        landedFactor: models.landedFactor!(c, category),
        categoryUsd: Number.isFinite(costs[category]) ? costs[category] : 0,
        dutyRate,
    }));

    return {
        country: country.name ?? '—',
        dutyBand: country.supplyChain?.importDutyBand ?? 'n/a',
        dutyRatePct,
        exportTier: exportControl.tier,
        exportLabel: exportControl.label,
        exportNote: exportControl.note,
        exportControl,
        archKey,
        customsLeadWk: models.leadTimeCustomsWk ? models.leadTimeCustomsWk(c) : 0,
        perCategoryLanded,
    };
}

/** Return a copy of the model with projectName / tierLevel filled from the
 *  UI stores (the engine build can't reach them). Immutable. */
export function withProjectMeta(
    model: BoqModel,
    fields: { projectName?: string; tierLevel?: number; location?: string; itMw?: number },
): BoqModel {
    return {
        ...model,
        projectMeta: {
            ...model.projectMeta,
            projectName: fields.projectName ?? model.projectMeta.projectName,
            tierLevel: fields.tierLevel ?? model.projectMeta.tierLevel,
            // location + itMw come from the SIMULATION SSOT (same source as the app
            // top bar) so the dossier header can never diverge from the live project.
            location: fields.location ?? model.projectMeta.location,
            itMw: fields.itMw ?? model.projectMeta.itMw,
        },
    };
}

/* ── formatting (self-contained so the HTML document is standalone) ─────── */

const esc = (v: unknown): string =>
    String(v ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** $ money — compact $M/$B above a million, thousands-grouped below. */
const money = (n: number): string => {
    if (!Number.isFinite(n)) return '—';
    const a = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    if (a >= 1e9) return `${sign}$${(a / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 })}B`;
    if (a >= 1e6) return `${sign}$${(a / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`;
    return `${sign}$${Math.round(a).toLocaleString()}`;
};

/** Full grouped dollars (no scaling) — used in line-item cells for auditability. */
const dollarsFull = (n: number): string =>
    Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : '—';

/** Quantity with thousands grouping; small fractional quantities keep 1 dp. */
const qtyFmt = (n: number): string => {
    if (!Number.isFinite(n)) return '—';
    if (n !== 0 && Math.abs(n) < 100) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
    return Math.round(n).toLocaleString();
};

const rateFmt = (n: number): string =>
    Number.isFinite(n) ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—';

/* ── instrument theme tokens — resistancezero.com brand (--rz-*) ──
 * instrument-cyan measured/headers · signal-amber money/estimates ·
 * data-green good · fault-red risk. Base #0a0e1a, elevated #111827,
 * hairlines for borders. No violet, no gradients-as-fill, 4px radii. */
const T = {
    bg: '#0a0e1a',
    surface: '#111827',
    surfaceAlt: '#0f1620',
    line: '#1e2a36',
    text: '#e6edf3',
    muted: '#8b9bab',
    cyan: '#00DDFF',
    amber: '#FFAA00',
    emerald: '#00FF88',
    slate: '#94a3b8',
    fault: '#f87171',
} as const;

/* Confidence chip palette (high=data-green, med=signal-amber, low=slate/"rule-of-thumb"). */
const CONF: Record<BoqConfidence, { bg: string; fg: string; label: string }> = {
    high: { bg: 'rgba(0,255,136,0.16)', fg: T.emerald, label: 'high' },
    med: { bg: 'rgba(255,170,0,0.16)', fg: T.amber, label: 'med' },
    low: { bg: 'rgba(148,163,184,0.16)', fg: T.slate, label: 'rule-of-thumb' },
};

function confChip(c: BoqConfidence): string {
    const s = CONF[c] ?? CONF.low;
    return `<span style="display:inline-block;padding:1px 7px;border-radius:999px;background:${s.bg};color:${s.fg};font-size:9px;font-weight:700;letter-spacing:.3px;">${esc(s.label)}</span>`;
}

/* Risk band chip (high=fault-red, med=signal-amber, low=slate). */
const RISK_CHIP: Record<DossierRisk, { bg: string; fg: string }> = {
    high: { bg: 'rgba(248,113,113,0.16)', fg: T.fault },
    med: { bg: 'rgba(255,170,0,0.16)', fg: T.amber },
    low: { bg: 'rgba(148,163,184,0.16)', fg: T.slate },
};

function riskChip(r: DossierRisk): string {
    const s = RISK_CHIP[r] ?? RISK_CHIP.low;
    return `<span style="display:inline-block;padding:1px 7px;border-radius:999px;background:${s.bg};color:${s.fg};font-size:9px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;">${esc(r)}</span>`;
}

/* Section header — numbered, matches the ToC. */
function secHead(no: number, title: string, note?: string): string {
    return `<h2 class="sec-title" style="margin-top:28px;">${no}. ${esc(title)}${note ? ` <span style="font-size:8.5px;color:${T.slate};letter-spacing:.5px;text-transform:none;">— ${esc(note)}</span>` : ''}</h2>`;
}

/* ── document sections ─────────────────────────────────────────────────── */

function coverSection(model: BoqModel): string {
    const { projectMeta: p, summary } = model;
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const cell = (label: string, value: string) =>
        `<div style="flex:1;min-width:120px;">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${T.muted};">${esc(label)}</div>
            <div style="font-size:13px;font-weight:700;color:${T.text};margin-top:2px;font-family:'JetBrains Mono',monospace;">${esc(value)}</div>
        </div>`;
    return `<section class="cover">
        <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${T.cyan};">DC-OS · Technical Project Dossier</div>
        <h1 style="font-size:28px;font-weight:800;color:${T.text};margin:8px 0 4px;line-height:1.15;">Technical Project Dossier<br><span style="font-size:15px;font-weight:600;color:${T.muted};">Bill of Quantities &amp; EPC Reference</span></h1>
        <div style="display:flex;flex-wrap:wrap;gap:16px;margin:20px 0 14px;padding:14px 16px;border:1px solid ${T.line};border-radius:12px;background:${T.surface};">
            ${cell('Project', p.projectName || 'Untitled Project')}
            ${cell('Location', p.location)}
            ${cell('IT Capacity', `${p.itMw.toLocaleString()} MW`)}
            ${cell('Tier', p.tierLevel ? `Tier ${p.tierLevel}` : '—')}
            ${cell('Generated', dateStr)}
        </div>
        <div style="display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:4px;background:${T.surface};border:1px solid ${T.line};border-left:3px solid ${T.amber};">
            <div style="flex:1;">
                <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${T.muted};">Grand Total (= Parametric CAPEX)</div>
                <div style="font-size:34px;font-weight:800;color:${T.amber};font-family:'JetBrains Mono',monospace;line-height:1.1;">${money(summary.grandTotal)}</div>
            </div>
            <div style="text-align:right;font-size:10px;color:${T.muted};line-height:1.6;">
                AACE Class ${esc(summary.aaceClass)}<br>${esc(summary.aaceBand)}<br>
                <span style="color:${T.slate};">screening-grade</span>
            </div>
        </div>
    </section>`;
}

function disclaimerSection(model: BoqModel): string {
    const { summary } = model;
    const sf = summary.safetyFactors;
    const sfRow = (name: string, value: string, note: string) =>
        `<tr>
            <td style="padding:5px 8px;border-bottom:1px solid ${T.line};color:${T.text};font-size:10.5px;">${esc(name)}</td>
            <td style="padding:5px 8px;border-bottom:1px solid ${T.line};color:${T.cyan};font-family:'JetBrains Mono',monospace;font-size:10.5px;">${esc(value)}</td>
            <td style="padding:5px 8px;border-bottom:1px solid ${T.line};color:${T.muted};font-size:10px;">${esc(note)}</td>
        </tr>`;
    return `<section class="block">
        <div style="border-left:3px solid ${T.fault};background:rgba(248,113,113,0.07);border-radius:0 10px 10px 0;padding:12px 14px;margin-bottom:14px;">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${T.fault};margin-bottom:5px;">⚠ Screening-Grade — Read First</div>
            <p style="font-size:10.5px;line-height:1.65;color:${T.text};margin:0 0 6px;">${esc(summary.disclaimer)}</p>
            <div style="font-size:10px;color:${T.muted};">Estimate class: <b style="color:${T.text};">AACE Class ${esc(summary.aaceClass)}</b> — band <b style="color:${T.text};">${esc(summary.aaceBand)}</b>.</div>
        </div>

        <h2 class="sec-title">Design Safety Factors (basis of the take-off)</h2>
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Factor</th><th style="text-align:left;">Applied</th><th style="text-align:left;">Basis</th>
            </tr></thead>
            <tbody>
                ${sfRow('Electrical continuous load', `×${sf.electricalContinuous}`, 'NEC 210.19 / 215.2 — 125% continuous')}
                ${sfRow('Structural (LRFD)', sf.structuralLRFD, 'ASCE 7 load combination')}
                ${sfRow('Cable ampacity derate', `×${sf.cableAmpacityDerate}`, 'grouping / thermal derate')}
                ${sfRow('Cooling redundancy', sf.coolingRedundancy, 'mechanical availability path')}
                ${sf.seismic ? sfRow('Seismic', sf.seismic, 'zone factor') : ''}
            </tbody>
        </table>

        <h2 class="sec-title" style="margin-top:16px;">Disclosed Margin (backed out — NOT added on top)</h2>
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:6px;">
            <div class="mini-stat"><div class="mini-k">Margin (% gross)</div><div class="mini-v">${summary.marginPctGross.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</div></div>
            <div class="mini-stat"><div class="mini-k">Markup on cost</div><div class="mini-v">${summary.marginMarkupOnCost.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</div></div>
            <div class="mini-stat"><div class="mini-k">Embedded margin $</div><div class="mini-v">${money(summary.embeddedMargin)}</div></div>
        </div>
        <p style="font-size:10px;line-height:1.6;color:${T.muted};margin:4px 0 0;">${esc(summary.marginNote)}</p>
    </section>`;
}

function commercialSummarySection(model: BoqModel): string {
    const { summary } = model;
    const row = (label: string, value: number, opts?: { emphasis?: boolean; disclosed?: boolean }) =>
        `<tr${opts?.emphasis ? ` style="background:rgba(255,170,0,0.08);"` : ''}>
            <td style="padding:7px 10px;border-bottom:1px solid ${T.line};font-size:11px;${opts?.emphasis ? `font-weight:800;color:${T.amber};` : `color:${T.text};`}">
                ${esc(label)}${opts?.disclosed ? `<span style="margin-left:6px;font-size:8.5px;font-weight:700;color:${T.cyan};letter-spacing:.5px;">DISCLOSED</span>` : ''}
            </td>
            <td style="padding:7px 10px;border-bottom:1px solid ${T.line};text-align:right;font-family:'JetBrains Mono',monospace;font-size:11.5px;${opts?.emphasis ? `font-weight:800;color:${T.amber};` : `color:${T.text};`}">${money(value)}</td>
        </tr>`;
    return `<section class="block">
        <h2 class="sec-title">Commercial Summary</h2>
        <table class="tbl">
            <tbody>
                ${row('Direct cost (bottom-up, ex-margin)', summary.directCost)}
                ${row('+ Embedded contractor margin', summary.embeddedMargin, { disclosed: true })}
                ${row('= Hard subtotal (equipment + install)', summary.hardSubtotal)}
                ${row('+ Soft costs (design + PM)', summary.softCosts)}
                ${row('+ Contingency', summary.contingency)}
                ${row('+ First-of-a-kind / owner (FOM)', summary.fom)}
                ${row('+ Unaccounted (green-cert / renewables residual)', summary.unaccounted)}
                ${row('GRAND TOTAL (= CAPEX total)', summary.grandTotal, { emphasis: true })}
            </tbody>
        </table>
        <p style="font-size:9.5px;color:${T.muted};margin:6px 0 0;">
            ${summary.reconciles
            ? `<span style="color:${T.emerald};">✓ Reconciles</span> — the decomposition ties to the parametric CAPEX total.`
            : `<span style="color:${T.amber};">Note</span> — a residual of ${money(summary.unaccounted)} is carried as "unaccounted" to tie to the CAPEX total.`}
        </p>
    </section>`;
}

/** One component-line <tr> — shared by the nested subsystem tables and the
 *  flat fallback table so both stay pixel-identical. */
function boqLineRow(l: BoqLine, i: number): string {
    return `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};">${esc(l.desc)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(l.spec)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};text-align:center;">${esc(l.unit)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};">${qtyFmt(l.qty)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.muted};">${rateFmt(l.unitRate)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.muted};">${dollarsFull(l.matCost)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.muted};">${dollarsFull(l.laborCost)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};font-weight:700;">${dollarsFull(l.total)}</td>
            <td style="padding:5px 8px;text-align:center;">${confChip(l.confidence)}</td>
            <td style="padding:5px 8px;font-size:9px;color:${T.muted};">${esc(l.source)}</td>
        </tr>`;
}

/** Component-line table (header + body) — shared by the nested + flat paths. */
function boqLineTable(lines: BoqLine[]): string {
    const rows = lines.map(boqLineRow).join('');
    return `<table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Description</th>
                <th style="text-align:left;">Spec</th>
                <th style="text-align:center;">Unit</th>
                <th style="text-align:right;">Qty</th>
                <th style="text-align:right;">Unit Rate</th>
                <th style="text-align:right;">Material</th>
                <th style="text-align:right;">Labor</th>
                <th style="text-align:right;">Total</th>
                <th style="text-align:center;">Confidence</th>
                <th style="text-align:left;">Source</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

/** One subsystem block within a discipline — h3-style sub-heading row (label +
 *  subtotal) over its component-line table. `page-break-inside:avoid` keeps a
 *  subsystem intact across PDF pages. */
function subsystemBlock(s: BoqSubsystem): string {
    return `<div style="page-break-inside:avoid;margin:12px 0 0;">
        <div style="display:flex;align-items:baseline;gap:10px;border-bottom:1px solid ${T.line};padding-bottom:3px;margin:0 0 5px;">
            <h3 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${T.cyan};margin:0;">${esc(s.label)}</h3>
            <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:800;color:${T.amber};">${money(s.subtotal)}</span>
        </div>
        ${boqLineTable(s.lines)}
    </div>`;
}

function disciplineSection(d: BoqDiscipline): string {
    // Deepened tree when the engine exposes non-empty subsystems; otherwise
    // fall back to the legacy flat line table (backward-compat / older engine).
    const hasTree = Array.isArray(d.subsystems) && d.subsystems.length > 0;
    const body = hasTree
        ? d.subsystems!.map(subsystemBlock).join('')
        : boqLineTable(d.lines);
    const rf = Number.isFinite(d.reconcileFactor) ? d.reconcileFactor.toFixed(2) : '—';
    return `<section class="discipline">
        <div style="display:flex;align-items:baseline;gap:10px;border-bottom:2px solid ${T.cyan};padding-bottom:5px;margin:0 0 8px;">
            <h2 style="font-size:14px;font-weight:800;color:${T.text};margin:0;">${esc(d.label)}</h2>
            <span style="font-size:9px;color:${T.muted};text-transform:uppercase;letter-spacing:1px;">${esc(d.categories.join(' · '))}</span>
            <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:800;color:${T.amber};">${money(d.categoryTotal)}</span>
        </div>
        ${body}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:4px 8px;background:${T.surface};border-radius:4px;border:1px solid ${T.line};">
            <span style="font-size:9.5px;color:${T.muted};">Bottom-up raw ${money(d.bottomUpRaw)} · reconciled ×${rf} to the parametric CAPEX category</span>
            <span style="font-size:11px;font-weight:800;color:${T.text};font-family:'JetBrains Mono',monospace;">Subtotal ${money(d.categoryTotal)}</span>
        </div>
    </section>`;
}

/** Lead-time threshold (weeks) above which an item is flagged as long-lead
 *  (schedule-driving) and highlighted in amber. */
const LONG_LEAD_WK = 52;

/** Group a deepened equipment list by discipline (keeps reporting order). */
function groupByDiscipline(items: BoqEquipmentDeep[]): { label: string; rows: BoqEquipmentDeep[] }[] {
    const LABELS: Record<string, string> = {
        electrical: 'Electrical',
        mechanical_cooling: 'Mechanical / Cooling',
    };
    const order: string[] = [];
    const map = new Map<string, BoqEquipmentDeep[]>();
    for (const e of items) {
        if (!map.has(e.discipline)) { map.set(e.discipline, []); order.push(e.discipline); }
        map.get(e.discipline)!.push(e);
    }
    return order.map((k) => ({ label: LABELS[k] ?? esc(k), rows: map.get(k)! }));
}

function equipmentScheduleSection(items: BoqEquipmentDeep[], customsLeadWk?: number): string {
    if (!items.length) return '';
    const makeRows = (rows: BoqEquipmentDeep[]) => rows.map((e, i) => {
        const longLead = Number.isFinite(e.leadTimeWk) && e.leadTimeWk >= LONG_LEAD_WK;
        const rowBg = longLead ? 'rgba(255,170,0,0.10)' : (i % 2 ? T.surfaceAlt : 'transparent');
        const makeModel = [e.make, e.modelName].filter(Boolean).join(' ') || '—';
        const ltCell = longLead
            ? `<td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.amber};font-weight:800;">${qtyFmt(e.leadTimeWk)}<span style="margin-left:4px;font-size:7.5px;font-weight:700;letter-spacing:.4px;">LONG</span></td>`
            : `<td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.muted};">${qtyFmt(e.leadTimeWk)}</td>`;
        return `<tr style="background:${rowBg};">
            <td style="padding:5px 8px;font-size:10px;color:${T.text};font-weight:700;">${esc(e.equipment)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(makeModel)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};">${esc(e.rating || '—')}</td>
            <td style="padding:5px 8px;font-size:9.5px;text-align:center;color:${T.muted};">${esc(e.efficiency || '—')}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};">${qtyFmt(e.qtyN)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};font-weight:700;">${qtyFmt(e.qtyInstalled)}</td>
            <td style="padding:5px 8px;font-size:9.5px;text-align:center;color:${T.muted};text-transform:uppercase;letter-spacing:.5px;">${esc(e.redundancy)}</td>
            ${ltCell}
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${Number.isFinite(e.unitCost) ? T.amber : T.muted};">${Number.isFinite(e.unitCost) ? money(e.unitCost!) : '—'}</td>
            <td style="padding:5px 8px;text-align:center;">${confChip(e.confidence)}</td>
        </tr>`;
    }).join('');
    const head = `<thead><tr>
            <th style="text-align:left;">Equipment</th>
            <th style="text-align:left;">Make / Model</th>
            <th style="text-align:right;">Rating</th>
            <th style="text-align:center;">Efficiency</th>
            <th style="text-align:right;">Qty (N)</th>
            <th style="text-align:right;">Installed</th>
            <th style="text-align:center;">Redundancy</th>
            <th style="text-align:right;">Lead (wk)</th>
            <th style="text-align:right;">Indic. Unit Cost</th>
            <th style="text-align:center;">Conf.</th>
        </tr></thead>`;
    const groups = groupByDiscipline(items).map((g) => `<div style="page-break-inside:avoid;margin:10px 0 0;">
        <h3 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${T.cyan};margin:0 0 4px;border-bottom:1px solid ${T.line};padding-bottom:3px;">${esc(g.label)}</h3>
        <table class="tbl">${head}<tbody>${makeRows(g.rows)}</tbody></table>
    </div>`).join('');
    return `<section class="block">
        ${secHead(5, SECTION_TITLES[4], 'informational, not reconciled to $')}
        ${groups}
        <p style="font-size:9.5px;line-height:1.6;color:${T.muted};margin:8px 0 0;">
            <span style="color:${T.amber};">Amber rows</span> are long-lead (≥ ${LONG_LEAD_WK} wk) — they drive the delivery programme, order early.
            Make / model are <b style="color:${T.text};">representative</b> selections from the brand library for the chosen UPS / generator / cooling type — real selection per detailed design.
            Indicative unit cost is the screening <b style="color:${T.text};">unitRates</b> figure used in the take-off (per unit, or per MVA for the transformer).${Number.isFinite(customsLeadWk) && (customsLeadWk ?? 0) > 0
            ? ` Add <b style="color:${T.text};">+${qtyFmt(customsLeadWk!)} wk</b> customs / inland-logistics lead on imported items (see Supply Chain &amp; Import).`
            : ''}
        </p>
    </section>`;
}

/* ── Phase-C: critical spares + PM schedule (Operations Readiness sub-sections) ── */

/** Format an MTBF in hours → compact "250k h (~29 yr)" screening string. */
function mtbfFmt(hours: number): string {
    if (!Number.isFinite(hours) || hours <= 0) return '—';
    const yr = hours / 8760;
    const hStr = hours >= 1000 ? `${(hours / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k h` : `${hours.toLocaleString()} h`;
    return `${hStr} · ~${yr.toLocaleString(undefined, { maximumFractionDigits: 0 })} yr`;
}

function criticalSparesBlock(rows: BoqSpareRow[]): string {
    if (!rows.length) return '';
    const sl = rows[0]?.serviceLevelPct ?? 99;
    const body = rows.map((s, i) => `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};font-weight:700;">${esc(s.label)}</td>
            <td style="padding:5px 8px;font-size:9.5px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.muted};">${esc(mtbfFmt(s.mtbfHours))}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};">${qtyFmt(s.installedQty)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};">${s.failRatePerYr.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.cyan};font-weight:800;">${qtyFmt(s.recommendedStockQty)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.muted};">${money(s.unitCost)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.muted};">${money(s.holdingCost)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.amber};font-weight:700;">${money(s.annualReplacementCost)}</td>
            <td style="padding:5px 8px;text-align:center;">${confChip(s.confidence)}</td>
        </tr>`).join('');
    return `<div style="page-break-inside:avoid;margin:14px 0 0;">
        <h3 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${T.cyan};margin:0 0 4px;border-bottom:1px solid ${T.line};padding-bottom:3px;">Critical Spares — newsvendor stock (${sl}% service level)</h3>
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Component</th>
                <th style="text-align:right;">MTBF</th>
                <th style="text-align:right;">Installed</th>
                <th style="text-align:right;">Failures / yr</th>
                <th style="text-align:right;">Rec. Stock</th>
                <th style="text-align:right;">Unit Cost</th>
                <th style="text-align:right;">Holding / yr</th>
                <th style="text-align:right;">Annual Replace</th>
                <th style="text-align:center;">Conf.</th>
            </tr></thead>
            <tbody>${body}</tbody>
        </table>
        <p style="font-size:9px;line-height:1.55;color:${T.slate};margin:5px 0 0;">
            Failure demand = installed qty × 8760 / MTBF (IEEE 493 Gold Book). Recommended stock = critical-fractile
            newsvendor (Φ⁻¹ / Poisson) over lead-time demand; ≥1 critical spare always carried. Holding = 25% carry × unit cost × stock.
            SCREENING — validate against OEM RCM data.
        </p>
    </div>`;
}

function pmScheduleBlock(rows: BoqPmRow[]): string {
    if (!rows.length) return '';
    const totalHr = rows.reduce((s, r) => s + (r.annualLaborHr || 0), 0);
    const totalCost = rows.reduce((s, r) => s + (r.annualPmCost || 0), 0);
    const body = rows.map((p, i) => `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};font-weight:700;">${esc(p.system)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(p.pmInterval)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(p.tasks)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};">${qtyFmt(p.annualLaborHr)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.amber};font-weight:700;">${money(p.annualPmCost)}</td>
            <td style="padding:5px 8px;text-align:center;">${confChip(p.confidence)}</td>
        </tr>`).join('');
    return `<div style="page-break-inside:avoid;margin:14px 0 0;">
        <h3 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${T.cyan};margin:0 0 4px;border-bottom:1px solid ${T.line};padding-bottom:3px;">Preventive-Maintenance Schedule</h3>
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">System</th>
                <th style="text-align:left;">PM Interval</th>
                <th style="text-align:left;">Tasks</th>
                <th style="text-align:right;">Annual Labor-hr</th>
                <th style="text-align:right;">Annual PM Cost</th>
                <th style="text-align:center;">Conf.</th>
            </tr></thead>
            <tbody>${body}</tbody>
            <tfoot><tr>
                <td colspan="3" style="padding:5px 8px;font-size:9.5px;color:${T.muted};text-align:right;text-transform:uppercase;letter-spacing:.5px;">Total (major systems)</td>
                <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};font-weight:800;">${qtyFmt(totalHr)}</td>
                <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.amber};font-weight:800;">${money(totalCost)}</td>
                <td></td>
            </tr></tfoot>
        </table>
        <p style="font-size:9px;line-height:1.55;color:${T.slate};margin:5px 0 0;">
            PM intervals + tasks are STANDARD-PRACTICE (OEM / NFPA 110 genset / ASHRAE chiller). Annual labor-hr = installed qty × visits/yr × hr/visit.
            Annual PM cost allocated from the O&amp;M preventive $/kW-yr band (DATA.omContracts) by system weight. SCREENING — validate against OEM RCM + vendor SLA.
        </p>
    </div>`;
}

/** BOQ Ship-D — procurement critical-path / sequencing sub-view. Sorts packages
 *  by lead-time (descending), flags the longest-lead gating items, and computes
 *  an "order-by" week measured back from power-on (= construction timeline in
 *  weeks). Packages whose lead-time exceeds the available construction window
 *  gate power-on and must be ordered before mobilisation (order-by ≤ 0). */
function procurementSequencing(pkgs: BoqPackage[], timelineMonths: number): string {
    const withLead = pkgs.filter((p) => Number.isFinite(p.leadTimeWk) && p.leadTimeWk > 0);
    if (!withLead.length) return '';
    const timelineWk = Number.isFinite(timelineMonths) && timelineMonths > 0 ? timelineMonths * 4.345 : 0;
    const sorted = [...withLead].sort((a, b) => b.leadTimeWk - a.leadTimeWk);
    const maxLead = sorted[0].leadTimeWk;
    // Gating threshold: within ~15% of the longest lead OR exceeds the construction window.
    const gatingCut = maxLead * 0.85;
    const body = sorted.map((p, i) => {
        // Order-by week (measured from project start): power-on week − lead-time.
        // Negative ⇒ must be ordered before / at mobilisation (long-lead gating).
        const orderByWk = timelineWk > 0 ? Math.round(timelineWk - p.leadTimeWk) : NaN;
        const gates = p.leadTimeWk >= gatingCut || (timelineWk > 0 && p.leadTimeWk >= timelineWk);
        const orderByStr = timelineWk > 0
            ? (orderByWk <= 0 ? `pre-mobilise (${qtyFmt(orderByWk)})` : `wk ${qtyFmt(orderByWk)}`)
            : '—';
        return `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;font-family:'JetBrains Mono',monospace;color:${T.cyan};font-weight:700;">${esc(p.pkgNo)}</td>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};font-weight:${gates ? 700 : 400};">${esc(p.name)}${gates ? ` <span style="font-size:8px;color:${T.fault};font-weight:800;text-transform:uppercase;letter-spacing:.5px;">◆ gates power-on</span>` : ''}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${gates ? T.fault : T.muted};font-weight:${gates ? 700 : 400};">${qtyFmt(p.leadTimeWk)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${orderByWk <= 0 ? T.fault : T.amber};font-weight:700;">${esc(orderByStr)}</td>
        </tr>`;
    }).join('');
    const gatingNames = sorted.filter((p) => p.leadTimeWk >= gatingCut || (timelineWk > 0 && p.leadTimeWk >= timelineWk)).map((p) => `${p.name} (${qtyFmt(p.leadTimeWk)} wk)`);
    return `<div style="page-break-inside:avoid;margin-top:14px;">
        <h3 style="font-size:11px;font-weight:800;color:${T.cyan};text-transform:uppercase;letter-spacing:.8px;margin:0 0 6px;">
            Critical-Path Sequencing <span style="font-size:8.5px;color:${T.slate};letter-spacing:.5px;text-transform:none;font-weight:600;">— longest-lead items gate power-on; order-by measured back from RFS</span>
        </h3>
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Pkg #</th>
                <th style="text-align:left;">Package</th>
                <th style="text-align:right;">Lead (wk)</th>
                <th style="text-align:right;">Order-By</th>
            </tr></thead>
            <tbody>${body}</tbody>
        </table>
        <div style="border-left:3px solid ${T.fault};background:rgba(248,113,113,0.08);border-radius:0 8px 8px 0;padding:8px 12px;margin-top:8px;">
            <p style="font-size:9.5px;line-height:1.6;color:${T.text};margin:0;">
                <b style="color:${T.fault};">Gating (power-on-critical):</b> ${esc(gatingNames.length ? gatingNames.join('; ') : 'none flagged')}.
                ${timelineWk > 0
                    ? `Construction window ≈ ${qtyFmt(Math.round(timelineWk))} wk (${qtyFmt(timelineMonths)} mo). Any package with <b>order-by ≤ 0</b> must be committed at or before mobilisation, else it slips ready-for-service (RFS).`
                    : `No live timeline — order-by shown relative to lead-time only. The longest-lead package is the schedule pacer.`}
            </p>
        </div>
    </div>`;
}

function procurementPackagesSection(pkgs: BoqPackage[], timelineMonths: number): string {
    if (!pkgs.length) return '';
    const rows = pkgs.map((p, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;font-family:'JetBrains Mono',monospace;color:${T.cyan};font-weight:700;">${esc(p.pkgNo)}</td>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};font-weight:700;">${esc(p.name)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(p.scope)}</td>
            <td style="padding:5px 8px;font-size:9.5px;text-align:center;color:${T.muted};text-transform:uppercase;letter-spacing:.4px;">${esc(p.tenderMethod)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.muted};">${qtyFmt(p.leadTimeWk)}</td>
            <td style="padding:5px 8px;font-size:9.5px;text-align:center;color:${T.muted};">${esc(p.fatSat)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};">${qtyFmt(p.warrantyYr)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.amber};font-weight:700;">${money(p.estValue)}</td>
            <td style="padding:5px 8px;text-align:center;">${confChip(p.confidence)}</td>
        </tr>`,
    ).join('');
    return `<section class="block">
        ${secHead(7, SECTION_TITLES[6])}
        <div style="border-left:3px solid ${T.amber};background:rgba(255,170,0,0.08);border-radius:0 10px 10px 0;padding:10px 13px;margin-bottom:10px;">
            <p style="font-size:10px;line-height:1.6;color:${T.text};margin:0;">
                <b style="color:${T.amber};">Indicative scope envelopes</b> — package values <b>OVERLAP</b> (the electrical / mechanical
                categories span several packages) and are <b>NOT additive</b> to the CAPEX total; shown for procurement
                planning, not cost rollup.
            </p>
        </div>
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Pkg #</th>
                <th style="text-align:left;">Name</th>
                <th style="text-align:left;">Scope</th>
                <th style="text-align:center;">Tender Method</th>
                <th style="text-align:right;">Lead Time (wk)</th>
                <th style="text-align:center;">FAT/SAT</th>
                <th style="text-align:right;">Warranty (yr)</th>
                <th style="text-align:right;">Indicative Value</th>
                <th style="text-align:center;">Confidence</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
        ${procurementSequencing(pkgs, timelineMonths)}
    </section>`;
}

/* ── supply-chain & import section (Ship-C) ────────────────────────────── */

function supplyChainSection(no: number, sc: BoqSupplyChain | null): string {
    if (!sc) {
        return `<section class="block">
            ${secHead(no, SECTION_TITLES[no - 1], 'screening / proxy — not statutory')}
            <p style="font-size:10.5px;line-height:1.65;color:${T.muted};margin:0;">
                No country selected — pick a country in Requirements to compute the per-country
                landed-cost uplift, import-duty band and export-control screening.
            </p>
        </section>`;
    }
    const dutyPct = Number.isFinite(sc.dutyRatePct)
        ? sc.dutyRatePct.toLocaleString(undefined, { maximumFractionDigits: 1 })
        : '—';
    const kpi = (label: string, value: string) =>
        `<div class="mini-stat"><div class="mini-k">${esc(label)}</div><div class="mini-v">${esc(value)}</div></div>`;
    const rows = sc.perCategoryLanded.map((r, i) => {
        const upliftPct = Number.isFinite(r.landedFactor) ? (r.landedFactor - 1) * 100 : 0;
        return `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};text-transform:capitalize;">${esc(r.category)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.muted};">${(r.share * 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}%</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};">×${r.landedFactor.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${upliftPct > 0 ? T.amber : T.muted};font-weight:${upliftPct > 0 ? 700 : 400};">${upliftPct > 0 ? '+' : ''}${upliftPct.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</td>
        </tr>`;
    }).join('');
    const banner = sc.exportControl.restricted
        ? `<div style="border:1.5px solid ${T.fault};background:rgba(248,113,113,0.12);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${T.fault};">⚠ Export-control advisory</div>
            <p style="font-size:10.5px;line-height:1.6;color:${T.text};margin:5px 0 0;">
                Frontier GPU (<b style="font-family:'JetBrains Mono',monospace;">${esc(sc.archKey ?? '—')}</b>) to a Tier-3 jurisdiction —
                PROXY assessment, AI Diffusion Rule rescinded, policy fluid, NOT legal advice.
            </p>
        </div>`
        : '';
    return `<section class="block">
        ${secHead(no, SECTION_TITLES[no - 1], 'screening / proxy — not statutory')}
        ${banner}
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
            ${kpi('Country', sc.country)}
            ${kpi('Export tier', `${sc.exportTier} · ${sc.exportLabel.replace(/^Tier \d+ /, '').replace(/[()]/g, '')}`)}
            ${kpi('Import-duty band', `${sc.dutyBand} · ${dutyPct}%`)}
            ${kpi('Customs lead', `+${qtyFmt(sc.customsLeadWk)} wk`)}
        </div>
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Category</th>
                <th style="text-align:right;">Equipment Share</th>
                <th style="text-align:right;">Landed Factor</th>
                <th style="text-align:right;">Uplift</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <p style="font-size:9.5px;line-height:1.6;color:${T.muted};margin:6px 0 0;">
            Duty applies to the <b style="color:${T.text};">imported-equipment fraction only</b> — local labor / civil is already
            captured in the construction index, so the landed factor lifts just the equipment share of each category.
        </p>
        ${supplyChainWorkedExample(sc)}
        <p style="font-size:9px;line-height:1.55;color:${T.slate};margin:4px 0 0;">
            ${esc(sc.exportNote)} Import-duty band + export tier are SCREENING / PROXY (US BIS Fed-Register proxy;
            AI Diffusion Rule rescinded — advisory, not statutory / not legal advice).
        </p>
    </section>`;
}

/** Categories shown in the landed-cost worked example — the equipment-heavy
 *  disciplines (per the prompt), in reporting order. */
const SUPPLY_CHAIN_WORKED_CATEGORIES: readonly string[] = ['electrical', 'ups', 'generator', 'cooling', 'network'] as const;

/** BOQ Ship-D — supply-chain landed-cost WORKED example for the top equipment-
 *  heavy categories: category $ × equipment-share × duty-rate → landed uplift $,
 *  plus a customs-lead vs construction-window note. Omitted when there is no
 *  live category $ or no duty (FTA/no-country → zero uplift, nothing to show). */
function supplyChainWorkedExample(sc: BoqSupplyChain): string {
    const rows = sc.perCategoryLanded.filter((r) =>
        SUPPLY_CHAIN_WORKED_CATEGORIES.includes(r.category) && r.categoryUsd > 0 && r.share > 0);
    if (!rows.length) return '';
    const dutyPct = (sc.dutyRatePct).toLocaleString(undefined, { maximumFractionDigits: 1 });
    let totalUplift = 0;
    const body = rows.map((r, i) => {
        const upliftUsd = r.categoryUsd * r.share * r.dutyRate;
        totalUplift += upliftUsd;
        const expr = `${money(r.categoryUsd)} × ${(r.share * 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}% × ${dutyPct}%`;
        return `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:4px 8px;font-size:10px;color:${T.text};text-transform:capitalize;">${esc(r.category)}</td>
            <td style="padding:4px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.muted};">${money(r.categoryUsd)}</td>
            <td style="padding:4px 8px;font-size:9.5px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.slate};">${esc(expr)}</td>
            <td style="padding:4px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${upliftUsd > 0 ? T.amber : T.muted};font-weight:700;">${money(upliftUsd)}</td>
        </tr>`;
    }).join('');
    return `<div style="page-break-inside:avoid;margin-top:14px;">
        <h3 style="font-size:11px;font-weight:800;color:${T.cyan};text-transform:uppercase;letter-spacing:.8px;margin:0 0 6px;">
            Landed-Cost Worked Example <span style="font-size:8.5px;color:${T.slate};letter-spacing:.5px;text-transform:none;font-weight:600;">— category $ × equipment-share × duty-rate → import uplift $ (screening)</span>
        </h3>
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Category</th>
                <th style="text-align:right;">Category $</th>
                <th style="text-align:right;">$ × share × duty</th>
                <th style="text-align:right;">Landed Uplift $</th>
            </tr></thead>
            <tbody>${body}</tbody>
            <tfoot><tr style="border-top:1px solid ${T.line};">
                <td colspan="3" style="padding:5px 8px;font-size:10px;text-align:right;color:${T.muted};font-weight:700;">Σ import uplift (shown categories)</td>
                <td style="padding:5px 8px;font-size:11px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.amber};font-weight:800;">${money(totalUplift)}</td>
            </tr></tfoot>
        </table>
        <div style="border-left:3px solid ${T.amber};background:rgba(255,170,0,0.08);border-radius:0 8px 8px 0;padding:8px 12px;margin-top:8px;">
            <p style="font-size:9.5px;line-height:1.6;color:${T.text};margin:0;">
                <b style="color:${T.amber};">Customs window:</b> add <b style="font-family:'JetBrains Mono',monospace;">+${qtyFmt(sc.customsLeadWk)} wk</b> customs-clearance
                + inland-logistics lead on imported long-lead equipment — this stacks on top of the OEM lead-times in the
                procurement critical-path (Section 7), so an import from a slow-clearance jurisdiction must be ordered
                <b>${qtyFmt(sc.customsLeadWk)} wk earlier</b> than a domestically-sourced equivalent to hit the same power-on date.
            </p>
        </div>
    </div>`;
}

/* ── dossier sections (Ship-3) ─────────────────────────────────────────── */

/** Ordered section titles — single source for both the ToC and the numbered
 *  headers, so they can never drift. */
const SECTION_TITLES: readonly string[] = [
    'Executive Summary',
    'Regulatory & Permitting Matrix',
    'Design Basis',
    'Engineering Calculations',
    'Equipment Schedule',
    'Bill of Quantities',
    'Procurement Packages',
    'Supply Chain & Import',
    'Risk Register',
    'Operations Readiness',
    'Document Register',
] as const;

function dossierBannerSection(): string {
    return `<section class="block" style="margin-top:16px;">
        <div style="border-left:3px solid ${T.amber};background:rgba(255,170,0,0.08);border-radius:0 10px 10px 0;padding:10px 13px;">
            <p style="font-size:10px;line-height:1.6;color:${T.text};margin:0;">
                <b style="color:${T.amber};">STANDARD-PRACTICE EPC reference</b> — permitting durations + risks indicative;
                validate against the AHJ and a full engineering design. Not a quotation or tender.
            </p>
        </div>
    </section>`;
}

function tocSection(): string {
    const items = SECTION_TITLES.map((t, i) =>
        `<li style="display:flex;align-items:baseline;gap:8px;padding:3px 0;border-bottom:1px solid ${T.line};">
            <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${T.cyan};font-weight:700;min-width:22px;">${i + 1}.</span>
            <span style="font-size:11px;color:${T.text};">${esc(t)}</span>
        </li>`,
    ).join('');
    return `<section class="block">
        <h2 class="sec-title">Contents</h2>
        <ol style="list-style:none;margin:0;padding:0;">${items}</ol>
    </section>`;
}

function execSummarySection(no: number, s: DossierExecSummary): string {
    const kpi = (label: string, value: string) =>
        `<div class="mini-stat"><div class="mini-k">${esc(label)}</div><div class="mini-v">${esc(value)}</div></div>`;
    const pueStr = Number.isFinite(s.pue) && s.pue > 0 ? s.pue.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';
    const perKwStr = Number.isFinite(s.perKw) && s.perKw > 0 ? `$${Math.round(s.perKw).toLocaleString()}` : '—';
    const monthsStr = Number.isFinite(s.timelineMonths) && s.timelineMonths > 0 ? `${qtyFmt(s.timelineMonths)} mo` : '—';
    return `<section class="block">
        ${secHead(no, SECTION_TITLES[no - 1])}
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
            ${kpi('IT Capacity', `${s.capacityMw.toLocaleString()} MW`)}
            ${kpi('Redundancy', s.redundancy)}
            ${kpi('Cooling', s.cooling)}
            ${kpi('PUE (design)', pueStr)}
            ${kpi('Total CAPEX', money(s.totalCapex))}
            ${kpi('$/kW IT', perKwStr)}
            ${kpi('Timeline', monthsStr)}
            ${kpi('Racks', qtyFmt(s.racks))}
        </div>
        <p style="font-size:10.5px;line-height:1.65;color:${T.muted};margin:0;">
            A <b style="color:${T.text};">${esc(`${s.capacityMw.toLocaleString()} MW`)}</b> IT facility on a
            <b style="color:${T.text};">${esc(s.redundancy)}</b> topology with
            <b style="color:${T.text};">${esc(s.cooling)}</b> cooling (design PUE
            <b style="color:${T.text};">${esc(pueStr)}</b>). The screening-grade parametric CAPEX is
            <b style="color:${T.amber};">${money(s.totalCapex)}</b> (${esc(perKwStr)}/kW IT) across
            <b style="color:${T.text};">${qtyFmt(s.racks)}</b> racks, on an indicative
            <b style="color:${T.text};">${esc(monthsStr)}</b> delivery programme. Figures are computed live by the
            shared engine from the current requirement + CAPEX inputs.
        </p>
    </section>`;
}

function permittingSection(no: number, rows: PermitRow[]): string {
    if (!rows.length) return '';
    const body = rows.map((r, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};">${esc(r.permit)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(r.authority)}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};">${qtyFmt(r.durationWk)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(r.dependency)}</td>
            <td style="padding:5px 8px;text-align:center;">${riskChip(r.risk)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(r.standard)}</td>
        </tr>`,
    ).join('');
    return `<section class="block">
        ${secHead(no, SECTION_TITLES[no - 1])}
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Permit</th>
                <th style="text-align:left;">Authority</th>
                <th style="text-align:right;">Duration (wk)</th>
                <th style="text-align:left;">Dependency</th>
                <th style="text-align:center;">Risk</th>
                <th style="text-align:left;">Standard</th>
            </tr></thead>
            <tbody>${body}</tbody>
        </table>
    </section>`;
}

/** Live design inputs threaded into the Design Basis narrative. */
interface DesignBasisInputs {
    coolingType: string;
    redundancy: string;
    tierLevel: number;
    pue: number;
}

/** BOQ Ship-D — per-discipline engineering rationale + a short sensitivity note,
 *  computed from the live inputs (cooling / redundancy / tier / PUE). Screening
 *  guidance — matched to the design-basis discipline by keyword. Returns '' when
 *  no discipline-specific narrative applies. */
function designBasisNarrative(discipline: string, s: DesignBasisInputs): string {
    const d = discipline.toLowerCase();
    const cool = (s.coolingType || 'air').toLowerCase();
    const red = (s.redundancy || 'n1').toUpperCase();
    const is2N = /2N/.test(red);
    const tier = s.tierLevel || 3;
    const pueStr = Number.isFinite(s.pue) && s.pue > 0 ? s.pue.toFixed(2) : '—';

    if (/electric/.test(d)) {
        return `${red} electrical distribution is set by the Tier-${tier} availability target — ${is2N
            ? '2N gives fully-independent A/B paths with no shared single point of failure, at roughly double the switchgear/UPS/genset count of an N topology.'
            : 'N+1 provides one redundant module per bus, a lighter first-cost than 2N but with a shared-path exposure that a fault-tree study should confirm meets the SLA.'} Sensitivity: moving N+1→2N typically adds ~40–60% to electrical CAPEX for a step-change in concurrent-maintainability.`;
    }
    if (/mechanical|cooling/.test(d)) {
        const coolLabel = cool.includes('liquid') || cool.includes('dlc') ? 'direct liquid cooling'
            : cool.includes('immersion') ? 'immersion cooling'
            : cool.includes('deep') || cool.includes('sea') ? 'deep-sea / seawater cooling'
            : 'air cooling';
        return `${coolLabel.charAt(0).toUpperCase() + coolLabel.slice(1)} was selected for the target rack density and a design PUE of ${pueStr}. ${cool.includes('air')
            ? 'Air is lowest first-cost and simplest to service but caps rack density and holds PUE higher; a liquid retrofit path should be kept open for AI-density growth.'
            : 'Liquid/immersion paths carry a higher plant first-cost but unlock high-density AI racks and materially lower PUE (less mechanical energy per IT watt).'} Sensitivity: each 0.1 reduction in PUE cuts facility (non-IT) power ~proportionally, compounding the OPEX case over the asset life.`;
    }
    if (/structural/.test(d)) {
        return `Floor loading and seismic detailing follow the site's hazard profile (see the Location Risk supplement). ${cool.includes('immersion')
            ? 'Immersion tanks impose a heavy concentrated floor load that drives slab/foundation design.'
            : 'Raised-floor / slab loading is sized to the equipment schedule plus a live-load margin.'} Sensitivity: a higher seismic zone raises structural reinforcement and can shift plant to grade-level, affecting layout and cost.`;
    }
    if (/fire|life safety/.test(d)) {
        return `Detection + clean-agent suppression are sized to the protected volume and the Tier-${tier} continuity requirement (a discharge must not force an unplanned shutdown of the redundant path). Sensitivity: liquid-cooled halls change the fire model (reduced air volume, coolant considerations) versus a conventional air-cooled white space.`;
    }
    if (/availability|tier|reliab/.test(d)) {
        return `The Tier-${tier} topology fixes the availability target and, with it, the ${red} redundancy of every critical system above. Sensitivity: each Tier step tightens the concurrent-maintainability / fault-tolerance requirement and compounds the redundancy cost across electrical, mechanical and controls together — it is the single biggest CAPEX lever in this basis.`;
    }
    return '';
}

function designBasisSection(no: number, rows: DesignBasisRow[], inputs: DesignBasisInputs): string {
    if (!rows.length) return '';
    const body = rows.map((r, i) => {
        const narrative = designBasisNarrative(r.discipline, inputs);
        const narrativeRow = narrative
            ? `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
                <td colspan="4" style="padding:2px 8px 8px 8px;font-size:9.5px;line-height:1.6;color:${T.slate};border-bottom:1px solid ${T.line};">
                    <span style="color:${T.amber};font-weight:700;">Rationale (screening):</span> ${esc(narrative)}
                </td>
            </tr>`
            : '';
        return `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px 2px;font-size:10px;color:${T.text};font-weight:700;">${esc(r.discipline)}</td>
            <td style="padding:5px 8px 2px;font-size:9.5px;color:${T.muted};">${esc(r.basis)}</td>
            <td style="padding:5px 8px 2px;font-size:9.5px;color:${T.muted};">${esc(r.standard)}</td>
            <td style="padding:5px 8px 2px;font-size:9px;font-family:'JetBrains Mono',monospace;color:${T.cyan};">${esc(r.engineRef)}</td>
        </tr>${narrativeRow}`;
    }).join('');
    return `<section class="block">
        ${secHead(no, SECTION_TITLES[no - 1], 'with live engineering rationale + sensitivity — screening guidance')}
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Discipline</th>
                <th style="text-align:left;">Basis</th>
                <th style="text-align:left;">Standard</th>
                <th style="text-align:left;">Engine Reference</th>
            </tr></thead>
            <tbody>${body}</tbody>
        </table>
    </section>`;
}

/** Format a worked-calc value cell — numbers get JetBrains Mono thousands-grouped
 *  (1 dp when small-fractional); strings pass through escaped. */
function calcVal(v: number | string): string {
    if (typeof v === 'number') {
        if (!Number.isFinite(v)) return '—';
        return Math.abs(v) !== 0 && Math.abs(v) < 100
            ? v.toLocaleString(undefined, { maximumFractionDigits: 4 })
            : Math.round(v).toLocaleString();
    }
    return esc(v);
}

const mono = (s: string): string =>
    `<span style="font-family:'JetBrains Mono',monospace;">${s}</span>`;

/** One worked-calc sheet CARD — title + discipline + standard + confidence chip,
 *  then Formula (mono), an Inputs table, the Steps (expr → value), and a
 *  highlighted Result. `page-break-inside:avoid` keeps each card intact. */
function engCalcCard(c: EngCalcSheet): string {
    const inputRows = c.inputs.map((v, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:3px 8px;font-size:9.5px;color:${T.muted};">${esc(v.label)}</td>
            <td style="padding:3px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.text};">${calcVal(v.value)}</td>
            <td style="padding:3px 8px;font-size:9px;color:${T.muted};">${esc(v.unit)}</td>
        </tr>`,
    ).join('');
    const stepRows = c.steps.map((s, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:3px 8px;font-size:9.5px;color:${T.text};">${esc(s.label)}</td>
            <td style="padding:3px 8px;font-size:9.5px;color:${T.muted};font-family:'JetBrains Mono',monospace;">${s.expr ? esc(s.expr) : ''}</td>
            <td style="padding:3px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${T.cyan};">${calcVal(s.value)}</td>
            <td style="padding:3px 8px;font-size:9px;color:${T.muted};">${esc(s.unit)}</td>
        </tr>`,
    ).join('');
    return `<div style="page-break-inside:avoid;border:1px solid ${T.line};border-radius:8px;background:${T.surface};padding:12px 14px;margin:0 0 12px;">
        <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;border-bottom:1px solid ${T.line};padding-bottom:5px;margin-bottom:8px;">
            <h3 style="font-size:12px;font-weight:800;color:${T.text};margin:0;">${esc(c.title)}</h3>
            <span style="font-size:9px;color:${T.muted};text-transform:uppercase;letter-spacing:.6px;">${esc(c.discipline)}</span>
            <span style="margin-left:auto;font-size:9px;color:${T.cyan};font-family:'JetBrains Mono',monospace;">${esc(c.standard)}</span>
            ${confChip(c.confidence)}
        </div>
        <div style="font-size:8.5px;text-transform:uppercase;letter-spacing:1px;color:${T.muted};margin-bottom:2px;">Formula</div>
        <div style="font-size:10.5px;font-family:'JetBrains Mono',monospace;color:${T.text};background:${T.surfaceAlt};border:1px solid ${T.line};border-radius:4px;padding:6px 9px;margin-bottom:9px;">${esc(c.formula)}</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
            <div style="flex:1;min-width:200px;">
                <div style="font-size:8.5px;text-transform:uppercase;letter-spacing:1px;color:${T.muted};margin-bottom:2px;">Inputs</div>
                <table style="width:100%;border-collapse:collapse;"><tbody>${inputRows}</tbody></table>
            </div>
            <div style="flex:2;min-width:260px;">
                <div style="font-size:8.5px;text-transform:uppercase;letter-spacing:1px;color:${T.muted};margin-bottom:2px;">Steps</div>
                <table style="width:100%;border-collapse:collapse;"><tbody>${stepRows}</tbody></table>
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:9px;padding:7px 11px;border-radius:4px;background:${T.surfaceAlt};border:1px solid ${T.line};border-left:3px solid ${T.amber};">
            <span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${T.muted};">${esc(c.result.label)}</span>
            <span style="margin-left:auto;font-size:15px;font-weight:800;color:${T.amber};font-family:'JetBrains Mono',monospace;">${mono(calcVal(c.result.value))} <span style="font-size:10px;color:${T.muted};font-weight:600;">${esc(c.result.unit)}</span></span>
        </div>
    </div>`;
}

/** Section 4 — REAL worked calc-sheet cards (deepened engine). Falls back to the
 *  flat reference table when the engine only exposes DATA.dossier.engineeringCalcs. */
function engCalcsSection(no: number, sheets: EngCalcSheet[], fallback: EngCalcRow[]): string {
    if (sheets.length) {
        const cards = sheets.map(engCalcCard).join('');
        return `<section class="block">
            ${secHead(no, SECTION_TITLES[no - 1], 'worked screening calcs — live from the project inputs')}
            <p style="font-size:9.5px;line-height:1.6;color:${T.muted};margin:0 0 10px;">
                AACE Class-4 screening — each sheet shows the formula, the live input values, the arithmetic,
                and the result, with a standard reference + confidence tag. Numbers track the current project;
                validate against a full engineering design.
            </p>
            ${cards}
        </section>`;
    }
    // Backward-compat fallback: the flat reference table.
    if (!fallback.length) return '';
    const body = fallback.map((r, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};">${esc(r.calc)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(r.standard)}</td>
            <td style="padding:5px 8px;font-size:9px;font-family:'JetBrains Mono',monospace;color:${T.cyan};">${esc(r.engineRef)}</td>
        </tr>`,
    ).join('');
    return `<section class="block">
        ${secHead(no, SECTION_TITLES[no - 1])}
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Calculation</th>
                <th style="text-align:left;">Standard</th>
                <th style="text-align:left;">Engine Reference</th>
            </tr></thead>
            <tbody>${body}</tbody>
        </table>
        <p style="font-size:9.5px;line-height:1.6;color:${T.muted};margin:6px 0 0;">
            Computed live by the referenced engine model — see the linked calculators; screening basis.
        </p>
    </section>`;
}

/** Render a risk-register $-impact band cell — the %-of-CAPEX band × the grand
 *  total, shown as a screening $ order-of-magnitude range. Falls back to '—'. */
function riskDollarBand(band: [number, number] | undefined, grandTotal: number): string {
    if (!band || !Number.isFinite(grandTotal) || grandTotal <= 0) return '—';
    const lo = money(band[0] * grandTotal);
    const hi = money(band[1] * grandTotal);
    return `${lo}–${hi}`;
}

function riskRegisterSection(no: number, rows: RiskRow[], grandTotal: number, countryRisks: CountryRiskRow[]): string {
    if (!rows.length) return '';
    const quantified = rows.some((r) => r.costImpactPctBand || r.scheduleSlipWk != null || r.residual || r.earlyWarning);
    const body = rows.map((r, i) => {
        const slip = Number.isFinite(r.scheduleSlipWk) ? qtyFmt(r.scheduleSlipWk!) : '—';
        return `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;font-family:'JetBrains Mono',monospace;color:${T.cyan};font-weight:700;">${esc(r.id)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};text-transform:uppercase;letter-spacing:.4px;">${esc(r.category)}</td>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};">${esc(r.risk)}</td>
            <td style="padding:5px 8px;text-align:center;">${riskChip(r.probability)}</td>
            <td style="padding:5px 8px;text-align:center;">${riskChip(r.impact)}</td>
            ${quantified ? `<td style="padding:5px 8px;font-size:9.5px;text-align:right;font-family:'JetBrains Mono',monospace;color:${r.costImpactPctBand ? T.amber : T.muted};font-weight:${r.costImpactPctBand ? 700 : 400};">${esc(riskDollarBand(r.costImpactPctBand, grandTotal))}</td>
            <td style="padding:5px 8px;font-size:10px;text-align:right;font-family:'JetBrains Mono',monospace;color:${(r.scheduleSlipWk ?? 0) > 0 ? T.fault : T.muted};">${slip}</td>
            <td style="padding:5px 8px;text-align:center;">${r.residual ? riskChip(r.residual) : '<span style="color:' + T.muted + ';">—</span>'}</td>` : ''}
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(r.mitigation)}</td>
            ${quantified ? `<td style="padding:5px 8px;font-size:9px;color:${T.slate};font-style:italic;">${esc(r.earlyWarning ?? '—')}</td>` : ''}
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};text-align:center;">${esc(r.owner)}</td>
        </tr>`;
    }).join('');
    return `<section class="block">
        ${secHead(no, SECTION_TITLES[no - 1], quantified ? 'quantified — screening $-impact bands (order-of-magnitude, not a quotation)' : undefined)}
        ${quantified ? `<p style="font-size:9.5px;line-height:1.6;color:${T.muted};margin:0 0 10px;">
            <b style="color:${T.amber};">$-impact</b> = a screening %-of-CAPEX band × the parametric total (order-of-magnitude, AACE Class-4);
            <b style="color:${T.fault};">slip</b> = schedule impact if unmitigated; <b style="color:${T.text};">residual</b> = post-mitigation band.
            Validate against a project-specific risk workshop.
        </p>` : ''}
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">ID</th>
                <th style="text-align:left;">Category</th>
                <th style="text-align:left;">Risk</th>
                <th style="text-align:center;">Prob.</th>
                <th style="text-align:center;">Impact</th>
                ${quantified ? `<th style="text-align:right;">$-Impact</th>
                <th style="text-align:right;">Slip (wk)</th>
                <th style="text-align:center;">Residual</th>` : ''}
                <th style="text-align:left;">Mitigation</th>
                ${quantified ? `<th style="text-align:left;">Early-Warning Indicator</th>` : ''}
                <th style="text-align:center;">Owner</th>
            </tr></thead>
            <tbody>${body}</tbody>
        </table>
        ${countryRiskSubTable(countryRisks)}
    </section>`;
}

/** BOQ Ship-D — country-specific location-risk sub-table, keyed to the live
 *  project's selected country (seismic / flood / grid / talent). Rendered inside
 *  the Risk Register section; omitted when no country risks are available. */
function countryRiskSubTable(rows: CountryRiskRow[]): string {
    if (!rows.length) return '';
    const body = rows.map((r, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};font-weight:700;">${esc(r.hazard)}</td>
            <td style="padding:5px 8px;font-size:9.5px;font-family:'JetBrains Mono',monospace;color:${T.muted};">${esc(r.metric)}</td>
            <td style="padding:5px 8px;text-align:center;">${riskChip(r.severity)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};">${esc(r.mitigation)}</td>
            <td style="padding:5px 8px;font-size:9px;font-family:'JetBrains Mono',monospace;color:${T.cyan};">${esc(r.standard)}</td>
        </tr>`,
    ).join('');
    return `<div style="page-break-inside:avoid;margin-top:14px;">
        <h3 style="font-size:11px;font-weight:800;color:${T.cyan};text-transform:uppercase;letter-spacing:.8px;margin:0 0 6px;">
            Location Risk Supplement <span style="font-size:8.5px;color:${T.slate};letter-spacing:.5px;text-transform:none;font-weight:600;">— live from the selected country's hazard / grid / talent profile (screening)</span>
        </h3>
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Hazard</th>
                <th style="text-align:left;">Site Metric</th>
                <th style="text-align:center;">Severity</th>
                <th style="text-align:left;">Mitigation</th>
                <th style="text-align:left;">Standard</th>
            </tr></thead>
            <tbody>${body}</tbody>
        </table>
    </div>`;
}

function opsReadySection(no: number, rows: OpsReadyRow[], spares: BoqSpareRow[], pm: BoqPmRow[]): string {
    // Render the section when there is EITHER a readiness matrix OR the Phase-C
    // spares / PM depth (so the depth still shows on older dossier data).
    if (!rows.length && !spares.length && !pm.length) return '';
    const body = rows.map((r, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};">${esc(r.item)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};text-align:center;">${esc(r.owner)}</td>
            <td style="padding:5px 8px;font-size:9.5px;color:${T.muted};text-align:center;text-transform:uppercase;letter-spacing:.4px;">${esc(r.gate)}</td>
            <td style="padding:5px 8px;font-size:9px;font-family:'JetBrains Mono',monospace;color:${r.engineRef ? T.cyan : T.muted};">${esc(r.engineRef ?? '—')}</td>
        </tr>`,
    ).join('');
    const matrixTable = rows.length
        ? `<table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Item</th>
                <th style="text-align:center;">Owner</th>
                <th style="text-align:center;">Gate</th>
                <th style="text-align:left;">Engine Ref</th>
            </tr></thead>
            <tbody>${body}</tbody>
        </table>`
        : '';
    return `<section class="block">
        ${secHead(no, SECTION_TITLES[no - 1])}
        ${matrixTable}
        ${criticalSparesBlock(spares)}
        ${pmScheduleBlock(pm)}
    </section>`;
}

/** BOQ Ship-D — project-phase chip palette (design→handover), left-to-right. */
const PHASE_CHIP: Record<string, { bg: string; fg: string }> = {
    design: { bg: 'rgba(0,221,255,0.14)', fg: T.cyan },
    procurement: { bg: 'rgba(255,170,0,0.14)', fg: T.amber },
    construction: { bg: 'rgba(148,163,184,0.16)', fg: T.slate },
    commissioning: { bg: 'rgba(0,255,136,0.14)', fg: T.emerald },
    handover: { bg: 'rgba(0,221,255,0.14)', fg: T.cyan },
};

function phaseChip(phase: string): string {
    const s = PHASE_CHIP[(phase || '').toLowerCase()] ?? PHASE_CHIP.construction;
    return `<span style="display:inline-block;padding:1px 7px;border-radius:999px;background:${s.bg};color:${s.fg};font-size:9px;font-weight:700;letter-spacing:.3px;text-transform:capitalize;">${esc(phase)}</span>`;
}

/** BOQ Ship-D — document delivery schedule sub-table + version-control note. */
function docScheduleSubTable(rows: DocScheduleRow[], controlNote?: string): string {
    if (!rows.length) return '';
    const body = rows.map((r, i) =>
        `<tr${i % 2 ? ` style="background:${T.surfaceAlt};"` : ''}>
            <td style="padding:5px 8px;font-size:10px;color:${T.text};">${esc(r.deliverable)}</td>
            <td style="padding:5px 8px;text-align:center;">${phaseChip(r.phase)}</td>
            <td style="padding:5px 8px;font-size:9.5px;text-align:center;font-family:'JetBrains Mono',monospace;color:${T.cyan};">${esc(r.approver)}</td>
        </tr>`,
    ).join('');
    return `<div style="page-break-inside:avoid;margin-top:14px;">
        <h3 style="font-size:11px;font-weight:800;color:${T.cyan};text-transform:uppercase;letter-spacing:.8px;margin:0 0 6px;">
            Delivery Schedule <span style="font-size:8.5px;color:${T.slate};letter-spacing:.5px;text-transform:none;font-weight:600;">— deliverable × project phase × approver role (Owner Eng / CxA / AHJ / EPC)</span>
        </h3>
        <table class="tbl">
            <thead><tr>
                <th style="text-align:left;">Deliverable</th>
                <th style="text-align:center;">Phase</th>
                <th style="text-align:center;">Approver</th>
            </tr></thead>
            <tbody>${body}</tbody>
        </table>
        ${controlNote ? `<div style="border-left:3px solid ${T.cyan};background:rgba(0,221,255,0.06);border-radius:0 8px 8px 0;padding:8px 12px;margin-top:8px;">
            <p style="font-size:9.5px;line-height:1.6;color:${T.text};margin:0;">
                <b style="color:${T.cyan};">Version control:</b> ${esc(controlNote)}
            </p>
        </div>` : ''}
    </div>`;
}

function docRegisterSection(no: number, docs: string[], schedule: DocScheduleRow[], controlNote?: string): string {
    if (!docs.length && !schedule.length) return '';
    const items = docs.map((d) =>
        `<div style="display:flex;align-items:baseline;gap:8px;padding:4px 0;border-bottom:1px solid ${T.line};">
            <span style="color:${T.cyan};font-size:11px;line-height:1;">▪</span>
            <span style="font-size:10.5px;color:${T.text};">${esc(d)}</span>
        </div>`,
    ).join('');
    return `<section class="block">
        ${secHead(no, SECTION_TITLES[no - 1])}
        ${docs.length ? `<div style="columns:2;column-gap:26px;">${items}</div>` : ''}
        ${docScheduleSubTable(schedule, controlNote)}
    </section>`;
}

/* ── document assembly ─────────────────────────────────────────────────── */

/** Render the full BOQ dossier as a complete, standalone HTML5 document. */
export function renderBoqDossierHTML(model: BoqModel, projectMeta?: BoqProjectMeta): string {
    const merged: BoqModel = projectMeta ? { ...model, projectMeta } : model;
    const disciplinesHtml = merged.generated.disciplines.map(disciplineSection).join('');
    const equipmentHtml = equipmentScheduleSection(merged.equipmentDeep ?? [], merged.supplyChain?.customsLeadWk);
    const procurementHtml = procurementPackagesSection(merged.procurement ?? [], merged.executiveSummary?.timelineMonths ?? 0);
    const v = esc(merged.projectMeta.version);

    // Ship-3 dossier surfaces (null-guarded — degrade to the BOQ-only document).
    const execHtml = merged.executiveSummary ? execSummarySection(1, merged.executiveSummary) : '';
    const d = merged.dossier;
    const permittingHtml = d ? permittingSection(2, d.permittingMatrix) : '';
    const designBasisHtml = d ? designBasisSection(3, d.designBasis, {
        coolingType: merged.executiveSummary?.cooling ?? 'air',
        redundancy: merged.executiveSummary?.redundancy ?? 'N+1',
        tierLevel: merged.projectMeta.tierLevel || 3,
        pue: merged.executiveSummary?.pue ?? 0,
    }) : '';
    const engCalcsHtml = (merged.engineeringCalcs?.length || d)
        ? engCalcsSection(4, merged.engineeringCalcs ?? [], d?.engineeringCalcs ?? [])
        : '';
    const supplyChainHtml = supplyChainSection(8, merged.supplyChain);
    const riskHtml = d ? riskRegisterSection(9, d.riskRegister, merged.summary.grandTotal, merged.countryRisks ?? []) : '';
    const opsReadyHtml = (d || merged.spares?.length || merged.pmSchedule?.length)
        ? opsReadySection(10, d?.opsReadiness ?? [], merged.spares ?? [], merged.pmSchedule ?? [])
        : '';
    const docRegisterHtml = d ? docRegisterSection(11, d.documentRegister, d.documentSchedule ?? [], d.documentControlNote) : '';

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Technical Project Dossier — ${esc(merged.projectMeta.projectName || 'DC-OS')}</title>
    <style>
        @media print {
            body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
            @page { size:A4; margin:12mm 12mm; }
            .no-print { display:none !important; }
            .cover, .discipline { page-break-inside:avoid; }
            .discipline { page-break-before:auto; }
            table { page-break-inside:auto; } tr { page-break-inside:avoid; }
        }
        * { box-sizing:border-box; }
        body {
            font-family:'IBM Plex Sans','Segoe UI',system-ui,-apple-system,sans-serif;
            background:${T.bg}; color:${T.text}; margin:0; padding:24px 30px 60px; font-size:12px;
        }
        h2.sec-title {
            font-size:12px; text-transform:uppercase; letter-spacing:1.5px; color:${T.cyan};
            margin:0 0 8px; padding-bottom:4px; border-bottom:1px solid ${T.line};
        }
        section.block, section.discipline { margin:22px 0; }
        table.tbl { width:100%; border-collapse:collapse; }
        table.tbl thead th {
            font-size:9px; text-transform:uppercase; letter-spacing:.5px; color:${T.muted};
            padding:5px 8px; border-bottom:1px solid ${T.line}; font-weight:700;
        }
        .mini-stat { flex:1; min-width:120px; padding:9px 12px; border:1px solid ${T.line}; border-radius:10px; background:${T.surface}; }
        .mini-k { font-size:8.5px; text-transform:uppercase; letter-spacing:1px; color:${T.muted}; }
        .mini-v { font-size:16px; font-weight:800; color:${T.cyan}; font-family:'JetBrains Mono',monospace; margin-top:2px; }
        .print-bar { position:fixed; top:14px; right:18px; z-index:10; }
        .print-btn {
            background:${T.amber}; color:#111; border:none; border-radius:8px;
            padding:8px 16px; font-size:12px; font-weight:800; cursor:pointer; letter-spacing:.3px;
        }
        footer {
            margin-top:26px; padding-top:10px; border-top:1px solid ${T.line};
            font-size:9px; color:${T.muted}; display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px;
        }
    </style></head><body>
    <div class="print-bar no-print"><button class="print-btn" onclick="window.print()">⬇ Save as PDF / Print</button></div>
    ${coverSection(merged)}
    ${dossierBannerSection()}
    ${tocSection()}
    ${execHtml}
    ${permittingHtml}
    ${designBasisHtml}
    ${engCalcsHtml}
    ${equipmentHtml}
    ${secHead(6, SECTION_TITLES[5], 'by discipline')}
    ${disclaimerSection(merged)}
    ${commercialSummarySection(merged)}
    ${disciplinesHtml}
    ${procurementHtml}
    ${supplyChainHtml}
    ${riskHtml}
    ${opsReadyHtml}
    ${docRegisterHtml}
    <footer>
        <span>SCREENING-GRADE · not a quotation · resistancezero.com · v${v}</span>
        <span>DC-OS · Technical Project Dossier · Bill of Quantities &amp; EPC Reference</span>
    </footer>
    </body></html>`;
}

/**
 * Open the BOQ dossier in a print window (browser-viewable HTML, exportable to
 * PDF via the print dialog). Returns false when the popup is blocked so the
 * caller can toast the user.
 */
export function openBoqDossier(model: BoqModel, projectMeta?: BoqProjectMeta): boolean {
    if (typeof window === 'undefined') return false;
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.write(renderBoqDossierHTML(model, projectMeta));
    w.document.close();
    return true;
}
