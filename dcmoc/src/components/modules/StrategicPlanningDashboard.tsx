'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useSitesStore } from '@/store/sites';
import { useRequirementsStore } from '@/store/requirements';
import { cagr5 } from '@/lib/requirementsMappings';
import { getPUE } from '@/constants/pue';
import { rzModels, rzData } from '@/lib/rz-engine';
import { resolveMarketKey } from '@/lib/market-key';
import { fmtMoney, fmtUnit } from '@/lib/format';
import { Tooltip } from '@/components/ui/Tooltip';
import { ScoreValue } from '@/components/ui/ScoreValue';
import {
    MapPin, Zap, Building, TrendingUp, DollarSign,
    BarChart3, Target, ArrowRight, AlertTriangle, CheckCircle,
    Calculator, Scale, Globe2
} from 'lucide-react';
import clsx from 'clsx';

type PlanningMode = 'feasibility' | 'acquisition' | 'expansion';

interface FeasibilityInputs {
    landAreaM2: number;
    gridCapacityMW: number;
    climateZone: 'tropical' | 'arid' | 'temperate' | 'continental' | 'polar';
    targetPUE: number;
}

interface AcquisitionInputs {
    targetSiteDollarPerMW: number;
    comparableA: number;
    comparableB: number;
    comparableC: number;
    riskMultiplier: number;
    targetReturnYears: number;
    /** null → market-derived default (engine coloPrice) or the 150 screening default. */
    revenueOverride: number | null;
    /** PPA mode: $/MWh converted to a $/kW·mo equivalent at 90% load factor (screening). */
    usePpa: boolean;
    ppaUsdPerMwh: number;
}

interface ExpansionInputs {
    currentFootprintMW: number;
    yearlyDemandGrowthPct: number;
    planningHorizonYears: number;
    capexPerMW: number;
    gridReservationLeadMonths: number;
}

const CLIMATE_PUE_PENALTY: Record<FeasibilityInputs['climateZone'], number> = {
    polar: 0,
    temperate: 0.03,
    continental: 0.05,
    arid: 0.08,
    tropical: 0.12,
};

/* ── Feasibility model constants (single source: pewarnaan + panel + collector) ── */
const HALL_FLOOR_FRACTION = 0.40;      // 40% of land = data hall floor
const IT_DENSITY_W_PER_M2 = 500;       // conservative mixed IT density
const ACRE_M2 = 4046.86;               // m² per acre (same factor as the Site Intelligence derivation)
const PUE_SLIDER_MIN = 1.10;           // best design PUE reachable on this page's slider
const FALLBACK_CAPEX_PER_MW = 6_000_000;
const FALLBACK_ELEC_RATE = 0.10;       // $/kWh

/* ── Pure feasibility model (DIAGNOSTICS_STANDARD: shared by render + panel +
 * collector — one formula, no duplicate literals). Mirrors exactly what the
 * page renders; the useMemo below delegates here. ── */
export interface FeasibilityModelInput {
    landAreaM2: number;
    gridCapacityMW: number;
    climateZone: FeasibilityInputs['climateZone'];
    targetPUE: number;
    /** getPUE(coolingType) — engine floor for the chosen cooling. */
    basePUE: number;
    /** $/MW build rate (CAPEX engine result / project MW, or fallback). */
    capexPerMwRate: number;
    /** $/kWh (country economy, or fallback). */
    electricityRate: number;
}

export interface FeasibilityModelResult {
    effectivePUE: number;
    buildableITMW: number;
    gridConstrainedMW: number;
    actualITMW: number;
    gridHeadroomMW: number;
    gridHeadroomPct: number;
    estimatedCapex: number;
    annualEnergyCost: number;
    bottleneck: 'land' | 'grid';
    hallFloorM2: number;
    /** MW IT locked out by the binding constraint (gap to the looser one). */
    lockedOutITMW: number;
}

export function computeFeasibility(m: FeasibilityModelInput): FeasibilityModelResult {
    const climatePenalty = CLIMATE_PUE_PENALTY[m.climateZone];
    const effectivePUE = Math.max(m.basePUE, m.targetPUE + climatePenalty);

    const hallFloorM2 = m.landAreaM2 * HALL_FLOOR_FRACTION;
    const buildableITMW = (hallFloorM2 * IT_DENSITY_W_PER_M2) / 1_000_000;

    const gridConstrainedMW = m.gridCapacityMW / effectivePUE;
    const actualITMW = Math.min(buildableITMW, gridConstrainedMW);

    const gridHeadroomMW = m.gridCapacityMW - actualITMW * effectivePUE;
    const gridHeadroomPct = (gridHeadroomMW / m.gridCapacityMW) * 100;

    const estimatedCapex = actualITMW * m.capexPerMwRate;
    const annualEnergyCost = actualITMW * 1000 * effectivePUE * 8760 * m.electricityRate;

    const bottleneck: 'land' | 'grid' = buildableITMW < gridConstrainedMW ? 'land' : 'grid';
    const lockedOutITMW = Math.abs(gridConstrainedMW - buildableITMW);

    return {
        effectivePUE, buildableITMW, gridConstrainedMW, actualITMW,
        gridHeadroomMW, gridHeadroomPct, estimatedCapex, annualEnergyCost,
        bottleneck, hallFloorM2, lockedOutITMW,
    };
}

/* ── Diagnostics collector (DIAGNOSTICS_STANDARD §5) — pure, no hooks ── */
export interface Finding {
    surface: string;
    severity: 'critical' | 'warning' | 'info';
    metric: string;
    value: number;
    threshold: number;
    linkTab: 'strategic';
}

export interface StrategicDiagnosticsModel {
    feasibility: FeasibilityModelInput;
}

/** Emits the feasibility bottleneck as a Finding — SAME model + banding as the
 *  banner colouring (grid-bound = rose → critical, land-bound = amber → warning).
 *  value = MW IT locked out by the binding constraint; threshold 0 (any gap binds). */
export function collectStrategicDiagnostics(model: StrategicDiagnosticsModel): Finding[] {
    const r = computeFeasibility(model.feasibility);
    if (r.lockedOutITMW <= 0) return [];
    return [{
        surface: `Feasibility binding constraint — ${r.bottleneck === 'grid' ? 'Grid Capacity' : 'Land Area'}`,
        severity: r.bottleneck === 'grid' ? 'critical' : 'warning',
        metric: 'lockedOutITMW',
        value: r.lockedOutITMW,
        threshold: 0,
        linkTab: 'strategic',
    }];
}

/* ── Workstream U · Acquisition fund-grade model (screening) ─────────────────
 * 10-yr cash flow per bid scenario: revenue at the chosen basis with a
 * 60/80/95% lease-up ramp (yrs 1-3, then steady 95%), OPEX from the SAME
 * engine call this page already makes → NPV @ regional WACC (engine
 * discountDefaults), IRR, MoIC (undiscounted total return ÷ equity), payback.
 * NPV/IRR delegate to RZEngine models.roi (parity with the Financial engine);
 * local closed-form fallbacks keep the page working when the engine is
 * absent. This is a SCREENING model — no debt, no exit value, no capex
 * maintenance — labeled as such everywhere it renders. ── */
const ACQ_HORIZON_YEARS = 10;
const ACQ_LEASE_UP = [0.60, 0.80, 0.95];   // lease-up ramp, then steady 0.95
const ACQ_STEADY_OCC = 0.95;
const PPA_LOAD_FACTOR = 0.90;              // screening PPA→colo-equivalent conversion

/** $/MWh PPA → $/kW·mo equivalent at the screening load factor. */
export function ppaToKwMonth(usdPerMwh: number, loadFactor = PPA_LOAD_FACTOR): number {
    return (usdPerMwh * loadFactor * 8760) / 1000 / 12;
}

/** NPV with cash[0] at t=0 (undiscounted) — engine models.roi.npv semantics. */
function npvOf(cash: number[], rate: number): number {
    try {
        const roi = rzModels()?.roi;
        if (roi?.npv) { const v = roi.npv(cash, rate); if (Number.isFinite(v)) return v; }
    } catch { /* fallback */ }
    return cash.reduce((s, c, t) => s + c / Math.pow(1 + rate, t), 0);
}

/** IRR as a FRACTION (engine models.roi.irr; bisection fallback), or null. */
function irrOf(cash: number[]): number | null {
    if (!cash.some((c) => c > 0) || !cash.some((c) => c < 0)) return null;
    try {
        const roi = rzModels()?.roi;
        if (roi?.irr) { const v = roi.irr(cash); if (v != null && Number.isFinite(v)) return v; }
    } catch { /* fallback */ }
    const f = (r: number) => cash.reduce((s, c, t) => s + c / Math.pow(1 + r, t), 0);
    let lo = -0.95, hi = 5;
    if (f(lo) * f(hi) > 0) return null;
    for (let i = 0; i < 100; i++) {
        const mid = (lo + hi) / 2;
        if (Math.sign(f(mid)) === Math.sign(f(lo))) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
}

export type BidVerdict = 'BANKABLE' | 'MARGINAL' | 'PASS';

export interface BidEconomics {
    bidPerMw: number;
    investment: number;
    npv: number;
    irrPct: number | null;
    moic: number;
    paybackYears: number | null;
    verdict: BidVerdict;
}

/** One bid scenario through the 10-yr screening cash flow (pure — reused by
 *  the sensitivity strip with shifted rate/revenue: 4 deterministic re-runs). */
export function computeBidEconomics(o: {
    bidPerMw: number; itLoadKw: number; revPerKwMo: number; annualOpex: number; waccPct: number;
}): BidEconomics {
    const investment = o.bidPerMw * (o.itLoadKw / 1000);
    const cash: number[] = [-investment];
    let cum = -investment, totalNet = 0;
    let paybackYears: number | null = null;
    for (let y = 1; y <= ACQ_HORIZON_YEARS; y++) {
        const occ = ACQ_LEASE_UP[y - 1] ?? ACQ_STEADY_OCC;
        const net = o.itLoadKw * o.revPerKwMo * 12 * occ - o.annualOpex;
        cash.push(net);
        totalNet += net;
        const prev = cum;
        cum += net;
        if (paybackYears == null && cum >= 0 && net > 0) paybackYears = (y - 1) + (prev < 0 ? -prev / net : 0);
    }
    const wacc = o.waccPct / 100;
    const npv = npvOf(cash, wacc);
    const irrFrac = irrOf(cash);
    const irrPct = irrFrac != null ? irrFrac * 100 : null;
    const moic = investment > 0 ? totalNet / investment : 0;
    /* Committee discipline: BANKABLE only when NPV > 0 AND IRR clears the cost
     * of capital; MARGINAL inside 150 bp of WACC; PASS = walk away (the honest
     * verdict must be render-able, not hidden). */
    const verdict: BidVerdict =
        irrPct != null && npv > 0 && irrPct > o.waccPct ? 'BANKABLE'
            : irrPct != null && irrPct >= o.waccPct - 1.5 ? 'MARGINAL'
                : 'PASS';
    return { bidPerMw: o.bidPerMw, investment, npv, irrPct, moic, paybackYears, verdict };
}

const VERDICT_CHIP: Record<BidVerdict, { cls: string; note: string }> = {
    BANKABLE: { cls: 'bg-rz-data/10 text-rz-data border-rz-data/40', note: 'NPV > 0 and IRR > WACC' },
    MARGINAL: { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/40', note: 'IRR within 150 bp of WACC — negotiate or de-risk' },
    PASS: { cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/40', note: 'Below cost of capital — walk away' },
};

/** Derived-input chip → jump to the owning page (module-scope: stable identity,
 *  not re-created per render — react-hooks/static-components). */
const SourceChip = ({ from, tab }: { from: string; tab: string }) => (
    <button onClick={() => useSimulationStore.getState().actions.setActiveTab(tab as never)}
        title={`Derived from ${from} — click to edit at the source`}
        className="ml-1 rounded bg-rz-data/10 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase text-rz-data hover:bg-rz-data/20">
        {from} ↗
    </button>
);

const CLIMATE_LABELS: Record<FeasibilityInputs['climateZone'], string> = {
    polar: 'Polar / Sub-arctic (Free-cooling advantage)',
    arid: 'Arid / Desert (High cooling load)',
    temperate: 'Temperate (Moderate cooling)',
    continental: 'Continental (Seasonal swings)',
    tropical: 'Tropical / Humid (Maximum cooling challenge)',
};

export default function StrategicPlanningDashboard() {
    const { selectedCountry, inputs } = useSimulationStore();
    const { results: capexResults } = useCapexStore();
    const [mode, setMode] = useState<PlanningMode>('feasibility');

    const [feasibility, setFeasibility] = useState<FeasibilityInputs>({
        landAreaM2: 10000,
        gridCapacityMW: 20,
        climateZone: selectedCountry?.id === 'ID' ? 'tropical' : 'temperate',
        targetPUE: 1.4,
    });

    const [acquisition, setAcquisition] = useState<AcquisitionInputs>({
        targetSiteDollarPerMW: 8_000_000,
        comparableA: 7_500_000,
        comparableB: 9_000_000,
        comparableC: 8_500_000,
        riskMultiplier: 1.15,
        targetReturnYears: 7,
        revenueOverride: null,
        usePpa: false,
        ppaUsdPerMwh: 80,
    });

    const [expansion, setExpansion] = useState<ExpansionInputs>({
        currentFootprintMW: inputs.itLoad / 1000,
        yearlyDemandGrowthPct: 25,
        planningHorizonYears: 5,
        capexPerMW: capexResults ? (capexResults.total / (inputs.itLoad / 1000)) : 6_000_000,
        gridReservationLeadMonths: 18,
    });

    /* ── AC2 (owner): inputs are NOT re-asked here — they derive from Site
     * Intelligence (land/grid), Requirements (growth/contract) and CAPEX.
     * The auto-sync keeps this page an OUTPUT surface; source chips + edit
     * links point at the owning pages. Acquisition comps stay local (market
     * data — genuinely strategic-only). */
    const req = useRequirementsStore();
    const sites = useSitesStore((s) => s.sites);
    const selectedSiteId = useSitesStore((s) => s.selectedSiteId);
    const activeSite = sites.find((s) => s.id === selectedSiteId) ?? sites[0] ?? null;
    const derivedFeas = useMemo(() => {
        const acres = activeSite?.attributes.usableAcres ?? activeSite?.attributes.totalAcres ?? null;
        const landAreaM2 = acres != null ? Math.round(acres * ACRE_M2) : null;
        const gridCapacityMW = activeSite?.attributes.availableCapacityMw ?? null;
        const ambient = activeSite?.attributes.avgAmbientC ?? null;
        const climateZone: FeasibilityInputs['climateZone'] | null =
            ambient == null ? (selectedCountry?.id === 'ID' || selectedCountry?.id === 'SG' || selectedCountry?.id === 'MY' ? 'tropical' : null)
                : ambient >= 26 ? 'tropical' : ambient >= 22 ? 'arid' : ambient >= 14 ? 'temperate' : ambient >= 5 ? 'continental' : 'polar';
        const targetPUE = getPUE(inputs.coolingType);
        return { landAreaM2, gridCapacityMW, climateZone, targetPUE };
    }, [activeSite, selectedCountry, inputs.coolingType]);
    // Feasibility land+grid are SOURCED from Site Intelligence (single-source, never
    // re-entered here). Without a site there is no phantom editable seed — show an
    // empty state instead. (#335 dedup — owner: "kenapa ada isian ini")
    const hasSiteData = derivedFeas.landAreaM2 != null && derivedFeas.gridCapacityMW != null;
    const derivedExp = useMemo(() => {
        const y0 = inputs.itLoad / 1000;
        const y5 = req.growth.itLoadMwByYear.y5 || 0;
        const growthPct = y5 > 0 ? Math.round(cagr5(y0, y5) * 100) : null;
        const horizon = req.overview.contractDurationYr === 'custom'
            ? (req.overview.contractDurationCustom ?? 5) : Math.min(10, req.overview.contractDurationYr);
        return { growthPct, horizon };
    }, [inputs.itLoad, req.growth.itLoadMwByYear.y5, req.overview.contractDurationYr, req.overview.contractDurationCustom]);
    useEffect(() => {
        setFeasibility((f) => ({
            ...f,
            ...(derivedFeas.landAreaM2 != null ? { landAreaM2: derivedFeas.landAreaM2 } : {}),
            ...(derivedFeas.gridCapacityMW != null ? { gridCapacityMW: derivedFeas.gridCapacityMW } : {}),
            ...(derivedFeas.climateZone != null ? { climateZone: derivedFeas.climateZone } : {}),
            targetPUE: derivedFeas.targetPUE,
        }));
    }, [derivedFeas]);
    useEffect(() => {
        setExpansion((x) => ({
            ...x,
            currentFootprintMW: inputs.itLoad / 1000,
            ...(derivedExp.growthPct != null ? { yearlyDemandGrowthPct: derivedExp.growthPct } : {}),
            planningHorizonYears: derivedExp.horizon,
            capexPerMW: capexResults ? (capexResults.total / (inputs.itLoad / 1000)) : x.capexPerMW,
        }));
    }, [derivedExp, inputs.itLoad, capexResults]);

    // --- Feasibility Calculations (delegates to the pure model shared with the
    //     bottleneck guidance panel + collectStrategicDiagnostics — one formula) ---
    const feasibilityModelInput = useMemo<FeasibilityModelInput>(() => ({
        landAreaM2: feasibility.landAreaM2,
        gridCapacityMW: feasibility.gridCapacityMW,
        climateZone: feasibility.climateZone,
        targetPUE: feasibility.targetPUE,
        basePUE: getPUE(inputs.coolingType),
        capexPerMwRate: capexResults ? (capexResults.total / (inputs.itLoad / 1000)) : FALLBACK_CAPEX_PER_MW,
        electricityRate: selectedCountry?.economy?.electricityRate ?? FALLBACK_ELEC_RATE,
    }), [feasibility, inputs.coolingType, inputs.itLoad, capexResults, selectedCountry]);
    const feasibilityResults = useMemo(() => computeFeasibility(feasibilityModelInput), [feasibilityModelInput]);

    /* ── Bottleneck guidance panel (DIAGNOSTICS_STANDARD: klik → alasan + lever
     * terukur dari formula feasibility yang SAMA + ↗ Site Intelligence) ── */
    const [showBottleneckPanel, setShowBottleneckPanel] = useState(false);
    const bottleneckExplain = useMemo(() => {
        const r = feasibilityResults;
        const m = feasibilityModelInput;
        if (r.bottleneck === 'grid') {
            // Grid binds: how much extra intake unlocks the land-capable IT load.
            const gridNeededMW = r.buildableITMW * r.effectivePUE;   // intake to match land
            const deltaGridMW = gridNeededMW - m.gridCapacityMW;
            const itPerGridMW = 1 / r.effectivePUE;                   // marginal MW IT per +1 MW intake
            // Secondary lever from the SAME formula: best effective PUE reachable on
            // this page (slider floor + climate penalty, still ≥ cooling-type floor).
            const bestEffPUE = Math.max(m.basePUE, PUE_SLIDER_MIN + CLIMATE_PUE_PENALTY[m.climateZone]);
            const pueUnlockMW = Math.min(r.buildableITMW, m.gridCapacityMW / bestEffPUE) - r.gridConstrainedMW;
            return { kind: 'grid' as const, deltaGridMW, itPerGridMW, bestEffPUE, pueUnlockMW };
        }
        // Land binds: how many extra acres unlock the grid-capable IT load.
        const landNeededM2 = (r.gridConstrainedMW * 1_000_000 / IT_DENSITY_W_PER_M2) / HALL_FLOOR_FRACTION;
        const deltaLandM2 = landNeededM2 - m.landAreaM2;
        const deltaAcres = deltaLandM2 / ACRE_M2;
        const itPerAcre = (ACRE_M2 * HALL_FLOOR_FRACTION * IT_DENSITY_W_PER_M2) / 1_000_000; // MW IT per +1 acre
        return { kind: 'land' as const, deltaLandM2, deltaAcres, itPerAcre };
    }, [feasibilityResults, feasibilityModelInput]);

    /* ── Acquisition revenue basis (Workstream U) — market-derived default:
     * the engine coloPrice for the CAPEX city market when one is mapped,
     * else the honest 150 screening default. PPA toggle converts $/MWh to a
     * $/kW·mo equivalent at 90% load factor (screening). ── */
    const cityMarket = useCapexStore((s) => s.inputs.cityMarket);
    const marketBasis = useMemo(() => {
        const key = resolveMarketKey(cityMarket);
        const colo: number | undefined = key !== 'none' ? rzData()?.markets?.[key]?.coloPrice : undefined;
        return colo != null
            ? { value: colo, label: `engine coloPrice · ${key}`, mapped: true }
            : { value: 150, label: 'screening default (no market mapped)', mapped: false };
    }, [cityMarket]);
    const ppaEquiv = ppaToKwMonth(acquisition.ppaUsdPerMwh);
    const revBasis = acquisition.usePpa ? ppaEquiv : (acquisition.revenueOverride ?? marketBasis.value);
    const revBasisLabel = acquisition.usePpa
        ? `PPA $${acquisition.ppaUsdPerMwh}/MWh @ ${(PPA_LOAD_FACTOR * 100).toFixed(0)}% LF (screening)`
        : acquisition.revenueOverride != null ? 'manual override' : marketBasis.label;
    /* Regional WACC — engine discountDefaults (Damodaran regional + country risk). */
    const waccPct = useMemo(() => {
        const D = rzData();
        const cid = (selectedCountry?.id ?? '').toUpperCase();
        return ((D?.discountDefaults?.[cid] ?? D?.discountDefaults?.global ?? 0.09) as number) * 100;
    }, [selectedCountry]);

    // --- Acquisition Calculations (fund-grade, Workstream U) ---
    const acquisitionResults = useMemo(() => {
        const comps = [acquisition.comparableA, acquisition.comparableB, acquisition.comparableC];
        const avgComp = comps.reduce((a, b) => a + b, 0) / comps.length;
        const bidFloor = avgComp * 0.88;
        const bidCeiling = avgComp * acquisition.riskMultiplier;
        const fairValue = avgComp;
        const premiumPct = ((acquisition.targetSiteDollarPerMW - fairValue) / fairValue) * 100;

        // Revenue at the chosen basis (market colo / manual / PPA-equivalent)
        const itCapacityKW = inputs.itLoad; // real project IT load
        const annualRevenue = itCapacityKW * revBasis * 12;
        const totalInvestment = acquisition.targetSiteDollarPerMW * (itCapacityKW / 1000);
        // Engine-real annual OPEX (models.opex); falls back to an
        // 8%-of-CAPEX heuristic if the engine is unavailable (SSR / not loaded).
        const sitePue = getPUE(inputs.coolingType);
        let opexEstimate = totalInvestment * 0.08;
        try {
            const om = rzModels().opex;
            if (om?.totalAnnual) {
                const r = om.totalAnnual(itCapacityKW / 1000, sitePue, selectedCountry?.id || 'US', 15);
                opexEstimate = typeof r === 'number' ? r : (r?.total ?? opexEstimate);
            }
        } catch { /* fallback heuristic */ }
        const annualNOI = annualRevenue - opexEstimate;
        const simpleROIYears = totalInvestment / annualNOI;
        const capRate = (annualNOI / totalInvestment) * 100;

        /* Per-scenario 10-yr economics for the ask / fair-value / ceiling bids
         * (committee decision table — same closure, three capital bases). */
        const econFor = (bidPerMw: number, revMo = revBasis, wacc = waccPct) =>
            computeBidEconomics({ bidPerMw, itLoadKw: itCapacityKW, revPerKwMo: revMo, annualOpex: opexEstimate, waccPct: wacc });
        const bidScenarios = [
            { label: 'Ask Price', bid: acquisition.targetSiteDollarPerMW, econ: econFor(acquisition.targetSiteDollarPerMW) },
            { label: 'Fair Value', bid: fairValue, econ: econFor(fairValue) },
            { label: 'Ceiling', bid: bidCeiling, econ: econFor(bidCeiling) },
        ];

        /* Sensitivity strip — 4 deterministic re-runs of the SAME closure for
         * the fair-value bid: base, rate +200 bp, revenue −15%, combined. */
        const sensitivity = [
            { label: 'Base', npv: bidScenarios[1].econ.npv },
            { label: 'Rate +200 bp', npv: econFor(fairValue, revBasis, waccPct + 2).npv },
            { label: 'Revenue −15%', npv: econFor(fairValue, revBasis * 0.85).npv },
            { label: 'Both stresses', npv: econFor(fairValue, revBasis * 0.85, waccPct + 2).npv },
        ];

        /* Portfolio note — this acquisition (fair-value equity) vs the current
         * project (CAPEX engine total at the sim revenue tunable). Blended IRR
         * is capital-weighted; concentration flag at >40% of combined capital. */
        const projCapex = capexResults?.total ?? null;
        let portfolio: null | {
            projCapex: number; projIrrPct: number | null; acqInvestment: number; acqIrrPct: number | null;
            combined: number; blendedIrrPct: number | null; acqSharePct: number; concentrated: boolean;
        } = null;
        if (projCapex != null && projCapex > 0 && itCapacityKW > 0) {
            const simRev = inputs.revenuePerKwMonth ?? 150;
            const projEcon = computeBidEconomics({
                bidPerMw: projCapex / (itCapacityKW / 1000), itLoadKw: itCapacityKW,
                revPerKwMo: simRev, annualOpex: opexEstimate, waccPct,
            });
            const acqInvestment = bidScenarios[1].econ.investment;
            const combined = projCapex + acqInvestment;
            const acqIrr = bidScenarios[1].econ.irrPct;
            const blendedIrrPct = projEcon.irrPct != null && acqIrr != null
                ? (projEcon.irrPct * projCapex + acqIrr * acqInvestment) / combined
                : null;
            const acqSharePct = (acqInvestment / combined) * 100;
            portfolio = {
                projCapex, projIrrPct: projEcon.irrPct, acqInvestment, acqIrrPct: acqIrr,
                combined, blendedIrrPct, acqSharePct, concentrated: acqSharePct > 40,
            };
        }

        return {
            avgComp,
            bidFloor,
            bidCeiling,
            fairValue,
            premiumPct,
            simpleROIYears,
            capRate,
            annualRevenue,
            annualNOI,
            totalInvestment,
            opexEstimate,
            bidScenarios,
            sensitivity,
            portfolio,
        };
    }, [acquisition, inputs.coolingType, inputs.itLoad, inputs.revenuePerKwMonth, selectedCountry, revBasis, waccPct, capexResults]);

    // --- Expansion Calculations ---
    const expansionResults = useMemo(() => {
        const years = Array.from({ length: expansion.planningHorizonYears }, (_, i) => i + 1);
        const demandTimeline = years.map(y => ({
            year: y,
            demandMW: expansion.currentFootprintMW * Math.pow(1 + expansion.yearlyDemandGrowthPct / 100, y),
            currentCapacity: expansion.currentFootprintMW,
        }));

        // Find when demand hits 80% utilization trigger
        const triggerYear = demandTimeline.find(d => d.demandMW / d.currentCapacity >= 0.80)?.year ?? 1;
        const expansionNeededMW = demandTimeline[demandTimeline.length - 1].demandMW - expansion.currentFootprintMW;
        const totalCapexRequired = expansionNeededMW * expansion.capexPerMW;

        // Phase schedule
        const phases = [];
        let cumulativeCapacity = expansion.currentFootprintMW;
        let phaseStart = triggerYear;
        while (cumulativeCapacity < demandTimeline[demandTimeline.length - 1].demandMW && phases.length < 4) {
            const phaseSize = Math.min(expansion.currentFootprintMW, demandTimeline[demandTimeline.length - 1].demandMW - cumulativeCapacity);
            phases.push({
                label: `Phase ${phases.length + 2}`,
                startYear: phaseStart,
                capacityMW: phaseSize,
                capex: phaseSize * expansion.capexPerMW,
                gridReservationMonth: phaseStart * 12 - expansion.gridReservationLeadMonths,
            });
            cumulativeCapacity += phaseSize;
            phaseStart += 2;
        }

        return { demandTimeline, triggerYear, expansionNeededMW, totalCapexRequired, phases };
    }, [expansion]);

    /* ── Expansion J-curve (Workstream U, screening) — per year: phase CAPEX
     * outflow (schedule above), EBITDA proxy = revenue basis × built MW ×
     * 12 × utilization − OPEX (engine models.opex per built MW, 8%-of-CAPEX
     * fallback), cumulative net cash, breakeven year. Phase capacity treated
     * as online from its start year (screening — no partial-year proration). ── */
    const jCurve = useMemo(() => {
        const pue = getPUE(inputs.coolingType);
        const opexFor = (builtMW: number): number => {
            let est = 0.08 * builtMW * expansion.capexPerMW;
            try {
                const om = rzModels().opex;
                if (om?.totalAnnual) {
                    const r = om.totalAnnual(builtMW, pue, selectedCountry?.id || 'US', 15);
                    est = typeof r === 'number' ? r : (r?.total ?? est);
                }
            } catch { /* fallback heuristic */ }
            return est;
        };
        let cumulative = 0;
        let breakevenYear: number | null = null;
        const rows: { year: number; builtMW: number; utilPct: number; capexOut: number; ebitda: number; cumulative: number }[] = [];
        for (const d of expansionResults.demandTimeline) {
            const builtMW = expansion.currentFootprintMW +
                expansionResults.phases.filter((p) => p.startYear <= d.year).reduce((s, p) => s + p.capacityMW, 0);
            const capexOut = expansionResults.phases.filter((p) => p.startYear === d.year).reduce((s, p) => s + p.capex, 0);
            const util = builtMW > 0 ? Math.min(0.95, d.demandMW / builtMW) : 0;
            const revenue = revBasis * builtMW * 1000 * 12 * util;
            const opex = opexFor(builtMW);
            const ebitda = revenue - opex;
            cumulative += ebitda - capexOut;
            if (breakevenYear == null && cumulative >= 0 && ebitda > 0) breakevenYear = d.year;
            rows.push({ year: d.year, builtMW, utilPct: util * 100, capexOut, ebitda, cumulative });
        }
        return { rows, breakevenYear };
    }, [expansionResults, expansion.currentFootprintMW, expansion.capexPerMW, inputs.coolingType, selectedCountry, revBasis]);

    const MODES: { id: PlanningMode; label: string; icon: React.ReactNode; desc: string }[] = [
        { id: 'feasibility', label: 'Feasibility Mode', icon: <MapPin className="w-4 h-4" />, desc: 'Land + grid to buildable IT load' },
        { id: 'acquisition', label: 'Acquisition Mode', icon: <Scale className="w-4 h-4" />, desc: 'Site bid range + ROI horizon' },
        { id: 'expansion', label: 'Expansion Mode', icon: <TrendingUp className="w-4 h-4" />, desc: 'Growth timeline + CAPEX schedule' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="p-5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm dark:shadow-none">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-cyan-500" />
                    Strategic Planning
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Land feasibility, site acquisition analysis, and multi-phase expansion scheduling
                </p>
            </div>
            {/* #335 — PURPOSE (owner bingung fungsinya): halaman OUTPUT analisis strategis. */}
            <p className="rounded-lg border border-rz-mint/30 bg-rz-mint/5 px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300">
                <b>What this page is for:</b> strategic analysis DERIVED from the project data you've already entered — (1) <b>Feasibility</b>: whether the site's land/grid/climate can host the target MW; (2) <b>Expansion</b>: when & how many expansion phases based on demand growth; (3) <b>Acquisition</b>: buy-vs-build comparison against market comparables. Inputs that already exist in other menus are LOCKED here (single source) — edit them in their origin menu; only local analysis parameters (growth, horizon, comparables) are entered here.
            </p>

            {/* Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {MODES.map(m => (
                    <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={clsx(
                            'p-4 rounded-xl border text-left transition-all',
                            mode === m.id
                                ? 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-400 dark:border-cyan-600 shadow-sm'
                                : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        )}
                    >
                        <div className={clsx('flex items-center gap-2 mb-1 font-semibold text-sm',
                            mode === m.id ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-800 dark:text-slate-200'
                        )}>
                            {m.icon}
                            {m.label}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{m.desc}</div>
                    </button>
                ))}
            </div>

            {/* ── FEASIBILITY MODE ── */}
            {mode === 'feasibility' && !hasSiteData && (
                <div className="bg-white dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center">
                    <Building className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                    <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm mb-1">Select a site to run feasibility</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                        Land area and grid capacity are <b>sourced from Site Intelligence</b> — they are not entered
                        here (single-source). Pick or add a site with usable acreage and available grid capacity, and
                        this feasibility analysis fills in automatically.
                    </p>
                    <button
                        onClick={() => useSimulationStore.getState().actions.setActiveTab('site' as never)}
                        className="mt-4 rounded-lg bg-rz-data/10 px-3 py-1.5 text-xs font-semibold text-rz-data hover:bg-rz-data/20">
                        Go to Site Intelligence ↗
                    </button>
                </div>
            )}
            {mode === 'feasibility' && hasSiteData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Inputs */}
                    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm">
                            <Building className="w-4 h-4 text-indigo-500" />
                            Site Parameters
                        </h3>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Total Land Area (m²) <Tooltip content="Total land parcel area. Roughly 40% will be usable as data hall floor, the rest used for cooling yards, access roads, substation setback, and future expansion reserve." />
                                {derivedFeas.landAreaM2 != null && <SourceChip from="Site Intelligence" tab="site" />}
                            </label>
                            <input
                                type="number"
                                className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                                value={feasibility.landAreaM2}
                                disabled
                                title="Derived from Site Intelligence — edit it there (#335 dedup, single-source)"
                                onChange={e => setFeasibility(f => ({ ...f, landAreaM2: Number(e.target.value) }))}
                            />
                            <div className="text-[10px] text-slate-400 mt-0.5">Hall floor approx: {Math.round(feasibility.landAreaM2 * 0.40).toLocaleString()} m²</div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Grid Capacity (MW) <Tooltip content="Committed or available grid connection capacity from the local utility. This is the hard ceiling on total facility power draw (IT + cooling + ancillaries)." />
                                {derivedFeas.gridCapacityMW != null && <SourceChip from="Site Intelligence" tab="site" />}
                            </label>
                            <input
                                type="number"
                                className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                                value={feasibility.gridCapacityMW}
                                disabled
                                title="Derived from Site Intelligence — edit it there (#335 dedup, single-source)"
                                onChange={e => setFeasibility(f => ({ ...f, gridCapacityMW: Number(e.target.value) }))}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Climate Zone <Tooltip content="Climate directly affects PUE. Tropical climates require full mechanical cooling year-round. Polar climates can use free-cooling 80%+ of the year." />
                                {derivedFeas.climateZone != null && <SourceChip from="Site / Country" tab="site" />}
                            </label>
                            <select
                                className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                                value={feasibility.climateZone}
                                disabled
                                title="Derived from the site / country — edit it there (#335 dedup, single-source)"
                                onChange={e => setFeasibility(f => ({ ...f, climateZone: e.target.value as FeasibilityInputs['climateZone'] }))}
                            >
                                {(Object.keys(CLIMATE_LABELS) as FeasibilityInputs['climateZone'][]).map(z => (
                                    <option key={z} value={z}>{CLIMATE_LABELS[z]}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Target PUE <Tooltip content="Design PUE target before climate adjustment. The climate zone adds a penalty on top." />
                                <SourceChip from="Engine PUE" tab="requirements" />
                            </label>
                            <input
                                type="range" min={1.10} max={2.0} step={0.05}
                                className="w-full accent-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                value={feasibility.targetPUE}
                                disabled
                                title="Derived from the engine PUE (cooling type) — change it in Requirements (#335 dedup, single-source)"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400">
                                <span>1.10 (Excellent)</span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{feasibility.targetPUE.toFixed(2)}</span>
                                <span>2.00 (Poor)</span>
                            </div>
                        </div>
                    </div>

                    {/* Results */}
                    <div className="space-y-4">
                        <button
                            onClick={() => setShowBottleneckPanel(v => !v)}
                            title="Click for the binding constraint detail + measured levers (this page's feasibility formula)"
                            className={clsx(
                                'p-4 rounded-xl border w-full text-left cursor-pointer transition-colors',
                                feasibilityResults.bottleneck === 'land'
                                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/40'
                                    : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-950/40'
                            )}>
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className={`w-4 h-4 ${feasibilityResults.bottleneck === 'land' ? 'text-amber-500' : 'text-rose-500'}`} />
                                <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                                    Binding Constraint: {feasibilityResults.bottleneck === 'land' ? 'Land Area' : 'Grid Capacity'}
                                </span>
                                <span className="ml-auto text-[9px] font-semibold uppercase text-slate-400">{showBottleneckPanel ? '▲ close' : '▼ why + lever'}</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                {feasibilityResults.bottleneck === 'land'
                                    ? `Land limits buildable IT to ${feasibilityResults.buildableITMW.toFixed(1)} MW — grid could support ${feasibilityResults.gridConstrainedMW.toFixed(1)} MW`
                                    : `Grid limits usable IT to ${feasibilityResults.gridConstrainedMW.toFixed(1)} MW — land could physically host ${feasibilityResults.buildableITMW.toFixed(1)} MW`
                                }
                            </p>
                        </button>

                        {showBottleneckPanel && (
                            <div className={clsx(
                                'rounded-lg border p-3 text-left',
                                feasibilityResults.bottleneck === 'grid'
                                    ? 'border-rose-500/30 bg-rose-500/5'
                                    : 'border-amber-500/30 bg-amber-500/5'
                            )}>
                                {/* Alasan — angka live dari model yang SAMA dengan render */}
                                <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                                    {bottleneckExplain.kind === 'grid'
                                        ? <>The site grid <b>{feasibility.gridCapacityMW.toFixed(1)} MW</b> at effective PUE <b>{feasibilityResults.effectivePUE.toFixed(2)}</b> only supports <b>{feasibilityResults.gridConstrainedMW.toFixed(1)} MW IT</b>, whereas the land ({Math.round(feasibilityResults.hallFloorM2).toLocaleString()} m² hall @ {IT_DENSITY_W_PER_M2} W/m²) can host <b>{feasibilityResults.buildableITMW.toFixed(1)} MW</b> — <b>{feasibilityResults.lockedOutITMW.toFixed(1)} MW IT locked out by the grid</b>.</>
                                        : <>The land <b>{feasibility.landAreaM2.toLocaleString()} m²</b> ({(feasibility.landAreaM2 / ACRE_M2).toFixed(1)} acres; hall {Math.round(feasibilityResults.hallFloorM2).toLocaleString()} m² @ {(HALL_FLOOR_FRACTION * 100).toFixed(0)}%, {IT_DENSITY_W_PER_M2} W/m²) only supports <b>{feasibilityResults.buildableITMW.toFixed(1)} MW IT</b>, whereas the grid {feasibility.gridCapacityMW.toFixed(1)} MW @ PUE {feasibilityResults.effectivePUE.toFixed(2)} could do <b>{feasibilityResults.gridConstrainedMW.toFixed(1)} MW</b> — <b>{feasibilityResults.lockedOutITMW.toFixed(1)} MW IT locked out by the land</b>.</>
                                    }
                                </p>
                                {/* Lever terukur — dihitung dari formula feasibility yang sama */}
                                <div className="mt-1.5 space-y-1">
                                    {bottleneckExplain.kind === 'grid' ? (
                                        <>
                                            <div className="flex items-start gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                                                <span className="shrink-0 rounded bg-rz-data px-1 py-0.5 text-[8px] font-bold text-black">LEVER</span>
                                                <span><b>Add grid intake +{bottleneckExplain.deltaGridMW.toFixed(1)} MW</b> (≈ {bottleneckExplain.deltaGridMW.toFixed(1)} MVA at PF≈1.0) → unlocks +{feasibilityResults.lockedOutITMW.toFixed(1)} MW IT until the land becomes binding. Marginal: every +1 MW intake ≈ +{bottleneckExplain.itPerGridMW.toFixed(2)} MW IT at PUE {feasibilityResults.effectivePUE.toFixed(2)}.</span>
                                            </div>
                                            {bottleneckExplain.pueUnlockMW > 0.05 ? (
                                                <div className="flex items-start gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                                                    <span className="shrink-0 rounded bg-rz-data px-1 py-0.5 text-[8px] font-bold text-black">LEVER</span>
                                                    <span><b>Improve effective PUE {feasibilityResults.effectivePUE.toFixed(2)} → {bottleneckExplain.bestEffPUE.toFixed(2)}</b> (target PUE {PUE_SLIDER_MIN.toFixed(2)} + climate penalty, cooling-type floor respected) → +{bottleneckExplain.pueUnlockMW.toFixed(1)} MW IT on the same grid, without new intake.</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-start gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                                                    <span className="shrink-0 rounded bg-slate-500 px-1 py-0.5 text-[8px] font-bold text-white">NOTE</span>
                                                    <span>PUE lever unavailable: effective PUE is already at the cooling-type floor ({feasibilityModelInput.basePUE.toFixed(2)}) — lowering the target PUE on the slider adds no MW.</span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex items-start gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                                            <span className="shrink-0 rounded bg-rz-data px-1 py-0.5 text-[8px] font-bold text-black">LEVER</span>
                                            <span><b>Add land +{bottleneckExplain.deltaAcres.toFixed(1)} acres</b> (+{Math.round(bottleneckExplain.deltaLandM2).toLocaleString()} m²) → unlocks +{feasibilityResults.lockedOutITMW.toFixed(1)} MW IT until the grid becomes binding. Marginal: every +1 acre ≈ +{bottleneckExplain.itPerAcre.toFixed(2)} MW IT ({(HALL_FLOOR_FRACTION * 100).toFixed(0)}% hall @ {IT_DENSITY_W_PER_M2} W/m²).</span>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                    <p className="text-[9px] text-slate-400">Figures from this page's feasibility formula (computeFeasibility) — not a separate estimate.</p>
                                    <button
                                        onClick={() => useSimulationStore.getState().actions.setActiveTab('site' as never)}
                                        className="shrink-0 rounded bg-cyan-500/10 px-2 py-1 text-[9px] font-semibold uppercase text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20"
                                        title="Edit land/grid site di Site Intelligence">
                                        Site Intelligence ↗
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Buildable IT Load', value: `${feasibilityResults.actualITMW.toFixed(1)} MW`, sub: 'min(land, grid)', color: 'text-cyan-600 dark:text-cyan-400' },
                                { label: 'Effective PUE', value: feasibilityResults.effectivePUE.toFixed(2), sub: `+${(CLIMATE_PUE_PENALTY[feasibility.climateZone] * 100).toFixed(0)}% climate`, color: 'text-amber-600 dark:text-amber-400' },
                                { label: 'Grid Headroom', value: `${feasibilityResults.gridHeadroomMW.toFixed(1)} MW`, sub: `${feasibilityResults.gridHeadroomPct.toFixed(0)}% reserve`, color: 'text-rz-data' },
                                { label: 'Annual Energy Cost', value: fmtMoney(feasibilityResults.annualEnergyCost), sub: `@ $${selectedCountry?.economy?.electricityRate?.toFixed(2) ?? '0.10'}/kWh`, color: 'text-rose-600 dark:text-rose-400' },
                            ].map(item => (
                                <div key={item.label} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{item.label}</div>
                                    <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">{item.sub}</div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Estimated CAPEX</div>
                            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{fmtMoney(feasibilityResults.estimatedCapex)}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                                {fmtMoney(feasibilityResults.estimatedCapex / feasibilityResults.actualITMW / 1000)}/kW
                                {' · '}CAPEX-module rate × the land/grid-CONSTRAINED {feasibilityResults.actualITMW.toFixed(1)} MW
                                {' — '}not the project {(inputs.itLoad / 1000).toFixed(1)} MW (see Value Bindings)
                            </div>
                            <div className="mt-3 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, (feasibilityResults.actualITMW / feasibilityResults.gridConstrainedMW) * 100)}%` }}
                                />
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">IT load vs grid limit utilization</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ACQUISITION MODE ── */}
            {mode === 'acquisition' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm">
                            <DollarSign className="w-4 h-4 text-rz-data" />
                            Site Valuation Inputs ($/MW IT Load)
                        </h3>

                        {([
                            { key: 'targetSiteDollarPerMW', label: 'Target Site Ask Price ($/MW)', tip: 'The price per MW the seller is asking. Compare against market comparables.' },
                            { key: 'comparableA', label: 'Comparable A ($/MW)', tip: 'Recent comparable transaction 1.' },
                            { key: 'comparableB', label: 'Comparable B ($/MW)', tip: 'Recent comparable transaction 2.' },
                            { key: 'comparableC', label: 'Comparable C ($/MW)', tip: 'Recent comparable transaction 3.' },
                        ] as const).map(f => (
                            <div key={f.key}>
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                    {f.label} <Tooltip content={f.tip} />
                                </label>
                                <input
                                    type="number"
                                    className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                                    value={acquisition[f.key]}
                                    onChange={e => setAcquisition(a => ({ ...a, [f.key]: Number(e.target.value) }))}
                                />
                            </div>
                        ))}

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Risk Multiplier <Tooltip content="Applies a risk premium above comparable average for higher-risk sites (seismic zone, grid reliability, permitting uncertainty)." />
                            </label>
                            <input
                                type="range" min={1.0} max={1.5} step={0.01}
                                className="w-full accent-cyan-500"
                                value={acquisition.riskMultiplier}
                                onChange={e => setAcquisition(a => ({ ...a, riskMultiplier: Number(e.target.value) }))}
                            />
                            <div className="flex justify-between text-[10px] text-slate-400">
                                <span>1.0x (No premium)</span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{acquisition.riskMultiplier.toFixed(2)}x</span>
                                <span>1.5x (High risk)</span>
                            </div>
                        </div>

                        {/* ── Revenue basis (Workstream U) — replaces the old hardcoded $150 ── */}
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Revenue Basis ($/kW·mo)
                                <Tooltip content="Colocation revenue per kW of IT load per month used in every cash-flow line on this page. Default derives from the engine's market coloPrice for the CAPEX city market when one is mapped; otherwise a $150 screening default is honestly labeled. Type a value to override; the PPA toggle switches the basis to a $/MWh power-purchase equivalent." />
                                <span
                                    className={clsx('ml-1 rounded px-1.5 py-0.5 text-[8.5px] font-semibold uppercase',
                                        acquisition.usePpa ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                            : marketBasis.mapped && acquisition.revenueOverride == null ? 'bg-rz-data/10 text-rz-data'
                                                : 'bg-slate-500/10 text-slate-500')}
                                    title={revBasisLabel}>
                                    {revBasisLabel}
                                </span>
                            </label>
                            <input
                                type="number" min={0} step={5}
                                className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 disabled:opacity-50"
                                value={acquisition.usePpa ? +ppaEquiv.toFixed(1) : (acquisition.revenueOverride ?? marketBasis.value)}
                                disabled={acquisition.usePpa}
                                title={acquisition.usePpa ? 'PPA mode active — basis comes from the $/MWh input below' : undefined}
                                onChange={e => setAcquisition(a => ({ ...a, revenueOverride: e.target.value === '' ? null : Number(e.target.value) }))}
                            />
                            {!acquisition.usePpa && acquisition.revenueOverride != null && (
                                <button
                                    onClick={() => setAcquisition(a => ({ ...a, revenueOverride: null }))}
                                    className="mt-1 text-[9px] font-semibold uppercase text-cyan-600 dark:text-cyan-400 hover:underline">
                                    Reset to {marketBasis.mapped ? 'market default' : 'screening default'} (${marketBasis.value}/kW·mo)
                                </button>
                            )}
                            <div className="mt-3 flex items-center gap-2">
                                <button
                                    onClick={() => setAcquisition(a => ({ ...a, usePpa: !a.usePpa }))}
                                    className={clsx('rounded px-2 py-1 text-[10px] font-bold uppercase border transition-colors',
                                        acquisition.usePpa
                                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400'
                                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 hover:border-amber-400')}>
                                    PPA mode {acquisition.usePpa ? 'ON' : 'OFF'}
                                </button>
                                <Tooltip content={`Screening conversion: $/MWh × ${(PPA_LOAD_FACTOR * 100).toFixed(0)}% load factor × 8,760 h ÷ 1,000 ÷ 12 → $/kW·mo equivalent. A real PPA has shape, escalators and curtailment terms this screen ignores — labeled screening, not a contract model.`} />
                            </div>
                            {acquisition.usePpa && (
                                <div className="mt-2">
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase">PPA price ($/MWh)</label>
                                    <input
                                        type="number" min={0} step={1}
                                        className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                                        value={acquisition.ppaUsdPerMwh}
                                        onChange={e => setAcquisition(a => ({ ...a, ppaUsdPerMwh: Number(e.target.value) }))}
                                    />
                                    <div className="text-[10px] text-slate-400 mt-0.5">≈ ${ppaEquiv.toFixed(1)}/kW·mo at {(PPA_LOAD_FACTOR * 100).toFixed(0)}% load factor (screening)</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                            <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">Bid Range Analysis</h4>
                            <div className="space-y-2">
                                {[
                                    { label: 'Floor (Aggressive Bid)', value: acquisitionResults.bidFloor, color: 'text-rz-data', note: '88% of comparable avg' },
                                    { label: 'Fair Value', value: acquisitionResults.fairValue, color: 'text-slate-800 dark:text-slate-200', note: 'Comp average' },
                                    { label: 'Ceiling (Risk-adj.)', value: acquisitionResults.bidCeiling, color: 'text-amber-600 dark:text-amber-400', note: `${(acquisition.riskMultiplier * 100).toFixed(0)}% of fair value` },
                                    { label: 'Target Ask', value: acquisition.targetSiteDollarPerMW, color: acquisitionResults.premiumPct > 10 ? 'text-rose-600 dark:text-rose-400' : 'text-cyan-600 dark:text-cyan-400', note: `${acquisitionResults.premiumPct > 0 ? '+' : ''}${acquisitionResults.premiumPct.toFixed(1)}% vs fair value` },
                                ].map(row => (
                                    <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                        <span className="text-xs text-slate-600 dark:text-slate-400">{row.label}</span>
                                        <div className="text-right">
                                            <div className={`text-sm font-bold ${row.color}`}>{fmtMoney(row.value)}/MW</div>
                                            <div className="text-[10px] text-slate-400">{row.note}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1">Cap Rate <Tooltip content="Stabilized net operating income ÷ total investment at the ask price — the real-estate screening yield. NOI = revenue at the chosen basis (full occupancy) minus the engine annual OPEX. Compare against the regional WACC: a cap rate below the cost of capital needs growth or repricing to justify the bid." /></div>
                                <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{acquisitionResults.capRate.toFixed(1)}%</div>
                                <div className="text-[10px] text-slate-400">NOI / Total Investment</div>
                            </div>
                            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1">Simple Payback <Tooltip content="Total investment ÷ stabilized annual NOI — a screening metric that ignores lease-up, the time value of money and post-payback cash flows. Use the NPV/IRR decision table below for the committee call." /></div>
                                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{acquisitionResults.simpleROIYears.toFixed(1)} yr</div>
                                <div className="text-[10px] text-slate-400">At ${revBasis.toFixed(0)}/kW·mo basis</div>
                            </div>
                        </div>

                        {/* ── Committee decision table (Workstream U) ── */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                            <h4 className="text-xs font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                                Investment Committee — 10-yr Economics
                                <Tooltip content={`Each bid scenario runs the SAME 10-year screening cash flow: revenue at the chosen basis with a 60/80/95% lease-up ramp (then 95% steady), engine annual OPEX, NPV discounted at the regional WACC ${waccPct.toFixed(1)}% (engine discountDefaults), IRR, MoIC (undiscounted total return ÷ equity) and payback. Verdicts: BANKABLE = NPV > 0 and IRR > WACC · MARGINAL = IRR within 150 bp of WACC · PASS = below cost of capital, walk away. Screening only — no debt, exit value or capex maintenance.`} />
                            </h4>
                            <p className="text-[10px] text-slate-400 mb-3">WACC {waccPct.toFixed(1)}% (regional) · lease-up 60/80/95% yrs 1-3 · OPEX {fmtMoney(acquisitionResults.opexEstimate)}/yr · screening</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                                            <th className="text-left py-2 pr-2">Bid</th>
                                            <th className="text-right py-2 px-2">NPV</th>
                                            <th className="text-right py-2 px-2">IRR</th>
                                            <th className="text-right py-2 px-2">MoIC</th>
                                            <th className="text-right py-2 px-2">Payback</th>
                                            <th className="text-center py-2 pl-2">Verdict</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {acquisitionResults.bidScenarios.map(s => (
                                            <tr key={s.label} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                                <td className="py-2 pr-2">
                                                    <div className="font-semibold text-slate-800 dark:text-slate-200">{s.label}</div>
                                                    <div className="text-[10px] text-slate-400">{fmtMoney(s.bid)}/MW · {fmtMoney(s.econ.investment)} equity</div>
                                                </td>
                                                <td className={`text-right py-2 px-2 font-semibold tabular-nums ${s.econ.npv >= 0 ? 'text-rz-data' : 'text-rose-500'}`}>{fmtMoney(s.econ.npv)}</td>
                                                <td className="text-right py-2 px-2">
                                                    <ScoreValue
                                                        value={s.econ.irrPct ?? 0}
                                                        display={s.econ.irrPct != null ? `${s.econ.irrPct.toFixed(1)}%` : '—'}
                                                        direction="higher" max={30}
                                                        tip={`Internal rate of return of the 10-yr screening cash flow at the ${s.label} bid — the discount rate at which NPV = 0. Committee test: must exceed the regional WACC ${waccPct.toFixed(1)}% to create value. Color scale 0–30%.`}
                                                    />
                                                </td>
                                                <td className="text-right py-2 px-2">
                                                    <ScoreValue
                                                        value={s.econ.moic}
                                                        display={`${s.econ.moic.toFixed(2)}x`}
                                                        direction="higher" max={4}
                                                        tip={`Multiple on invested capital — UNDISCOUNTED total 10-yr net cash flow ÷ equity at the ${s.label} bid. A time-blind sanity check alongside IRR (a 2.0x over 10 years is far weaker than 2.0x over 4). Color scale 0–4x.`}
                                                    />
                                                </td>
                                                <td className="text-right py-2 px-2 tabular-nums text-slate-700 dark:text-slate-300">{s.econ.paybackYears != null ? `${s.econ.paybackYears.toFixed(1)} yr` : '>10 yr'}</td>
                                                <td className="text-center py-2 pl-2">
                                                    <span
                                                        className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold ${VERDICT_CHIP[s.econ.verdict].cls}`}
                                                        title={VERDICT_CHIP[s.econ.verdict].note}>
                                                        {s.econ.verdict}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* ── Sensitivity strip — fair-value bid, 4 deterministic re-runs ── */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                            <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-1">
                                NPV Sensitivity — Fair-Value Bid
                                <Tooltip content="Four deterministic re-runs of the same 10-yr cash-flow closure at the fair-value bid: base case, discount rate +200 bp, revenue −15%, and both stresses combined. A deal that only clears in the base row is not robust — if mild stress flips NPV negative, negotiate the price down or walk." />
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {acquisitionResults.sensitivity.map(s => (
                                    <div key={s.label} className={clsx('rounded-lg border p-2', s.npv >= 0 ? 'border-rz-data/30 bg-rz-data/5' : 'border-rose-500/30 bg-rose-500/5')}>
                                        <div className="text-[9px] font-semibold uppercase text-slate-500">{s.label}</div>
                                        <div className={`text-sm font-bold tabular-nums ${s.npv >= 0 ? 'text-rz-data' : 'text-rose-500'}`}>{fmtMoney(s.npv)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Portfolio note — acquisition vs current project ── */}
                        {acquisitionResults.portfolio && (
                            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-1">
                                    Portfolio Note — vs Current Project
                                    <Tooltip content={`This acquisition (fair-value equity) alongside the current project (CAPEX engine total, screened through the same 10-yr closure at the sim revenue tunable $${(inputs.revenuePerKwMonth ?? 150).toFixed(0)}/kW·mo). Blended IRR is capital-weighted. Single-asset concentration above 40% of combined capital is flagged — diversification discipline, not a hard veto.`} />
                                </h4>
                                <div className="grid grid-cols-3 gap-2 text-center mb-2">
                                    <div>
                                        <div className="text-[9px] font-semibold uppercase text-slate-500">Combined Capital</div>
                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">{fmtMoney(acquisitionResults.portfolio.combined)}</div>
                                        <div className="text-[9px] text-slate-400">{fmtMoney(acquisitionResults.portfolio.projCapex)} + {fmtMoney(acquisitionResults.portfolio.acqInvestment)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-semibold uppercase text-slate-500">Blended IRR</div>
                                        <div className="text-sm font-bold tabular-nums">
                                            <ScoreValue
                                                value={acquisitionResults.portfolio.blendedIrrPct ?? 0}
                                                display={acquisitionResults.portfolio.blendedIrrPct != null ? `${acquisitionResults.portfolio.blendedIrrPct.toFixed(1)}%` : '—'}
                                                direction="higher" max={30}
                                                tip="Capital-weighted IRR across the current project and the fair-value acquisition — both through the identical 10-yr screening closure. Weighting by committed capital, not by asset count."
                                            />
                                        </div>
                                        <div className="text-[9px] text-slate-400">proj {acquisitionResults.portfolio.projIrrPct?.toFixed(1) ?? '—'}% · acq {acquisitionResults.portfolio.acqIrrPct?.toFixed(1) ?? '—'}%</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-semibold uppercase text-slate-500">Acq. Share</div>
                                        <div className={`text-sm font-bold tabular-nums ${acquisitionResults.portfolio.concentrated ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                            {acquisitionResults.portfolio.acqSharePct.toFixed(0)}%
                                        </div>
                                        <div className="text-[9px] text-slate-400">of combined capital</div>
                                    </div>
                                </div>
                                {acquisitionResults.portfolio.concentrated && (
                                    <p className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-300">
                                        <b>Concentration warning:</b> this single acquisition is {acquisitionResults.portfolio.acqSharePct.toFixed(0)}% of combined capital (&gt;40%) — one asset&apos;s grid tenure, permitting or tenant risk dominates the book. Consider phasing the acquisition or partnering the equity.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className={clsx(
                            'p-4 rounded-xl border text-sm',
                            acquisitionResults.premiumPct > 15
                                ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                                : acquisitionResults.premiumPct > 5
                                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                                : 'bg-rz-data/10 dark:bg-rz-data/10 border-rz-data/40 text-rz-data'
                        )}>
                            <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                                {acquisitionResults.premiumPct > 15 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                Acquisition Signal
                            </div>
                            <p className="text-xs leading-relaxed">
                                {acquisitionResults.premiumPct > 15
                                    ? `Ask price is ${acquisitionResults.premiumPct.toFixed(1)}% above market comparables. Negotiate down or walk away unless strategic premium is justified (zoning, power tenure, or location scarcity).`
                                    : acquisitionResults.premiumPct > 5
                                    ? `Ask price is ${acquisitionResults.premiumPct.toFixed(1)}% above market. Manageable with risk-adjusted ceiling — proceed with due diligence on grid tenure and permitting status.`
                                    : `Ask price is at or below market fair value (${Math.abs(acquisitionResults.premiumPct).toFixed(1)}% ${acquisitionResults.premiumPct < 0 ? 'discount' : 'premium'}). Strong acquisition candidate — move to exclusivity quickly.`
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── EXPANSION MODE ── */}
            {mode === 'expansion' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm">
                            <BarChart3 className="w-4 h-4 text-rz-mint" />
                            Expansion Parameters
                        </h3>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Current Footprint (MW) <Tooltip content="Current deployed IT load capacity." />
                                <SourceChip from="Requirements" tab="requirements" />
                            </label>
                            <input
                                type="number" min={0.5} step={0.5}
                                className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                                value={expansion.currentFootprintMW}
                                disabled title="≡ Project IT Load (Requirements) — single source, edit it there (#335 dedup)"
                                onChange={e => setExpansion(x => ({ ...x, currentFootprintMW: Number(e.target.value) }))}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Annual Demand Growth <Tooltip content="Expected year-over-year IT load demand growth. AI workloads drive 30-50% compound growth at many hyperscaler facilities." />
                                {derivedExp.growthPct != null && <SourceChip from="Requirements growth" tab="requirements" />}
                            </label>
                            <input
                                type="range" min={5} max={80} step={1}
                                className="w-full accent-cyan-500"
                                value={expansion.yearlyDemandGrowthPct}
                                onChange={e => setExpansion(x => ({ ...x, yearlyDemandGrowthPct: Number(e.target.value) }))}
                            />
                            <div className="flex justify-between text-[10px] text-slate-400">
                                <span>5%</span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{expansion.yearlyDemandGrowthPct}% / year</span>
                                <span>80%</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Planning Horizon (Years) <Tooltip content="How many years to model demand growth and phased expansion." />
                                <SourceChip from="Contract duration" tab="requirements" />
                            </label>
                            <select
                                className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                                value={expansion.planningHorizonYears}
                                onChange={e => setExpansion(x => ({ ...x, planningHorizonYears: Number(e.target.value) }))}
                            >
                                {[3, 5, 7, 10].map(y => <option key={y} value={y}>{y} years</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                CAPEX per MW <Tooltip content="Expected build cost per MW of IT capacity for the expansion phases." />
                                {capexResults && <SourceChip from="CAPEX engine" tab="capex" />}
                            </label>
                            <input
                                type="number" step={100000}
                                className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                                value={expansion.capexPerMW}
                                disabled title="≡ CAPEX engine $/MW result — edit CAPEX assumptions (#335 dedup)"
                                onChange={e => setExpansion(x => ({ ...x, capexPerMW: Number(e.target.value) }))}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Grid Reservation Lead Time (months) <Tooltip content="How many months before a phase goes live that grid capacity must be reserved from the utility. Typically 12-24 months." />
                            </label>
                            <input
                                type="range" min={6} max={36} step={3}
                                className="w-full accent-cyan-500"
                                value={expansion.gridReservationLeadMonths}
                                onChange={e => setExpansion(x => ({ ...x, gridReservationLeadMonths: Number(e.target.value) }))}
                            />
                            <div className="flex justify-between text-[10px] text-slate-400">
                                <span>6 mo</span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{expansion.gridReservationLeadMonths} months</span>
                                <span>36 mo</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Demand timeline */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                            <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">Demand Growth Timeline</h4>
                            <div className="space-y-2">
                                {expansionResults.demandTimeline.map(row => {
                                    const utilization = Math.min(1, row.demandMW / expansion.currentFootprintMW);
                                    return (
                                        <div key={row.year}>
                                            <div className="flex justify-between text-xs mb-0.5">
                                                <span className="text-slate-600 dark:text-slate-400">Year {row.year}</span>
                                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                    {row.demandMW.toFixed(1)} MW
                                                    <span className={clsx('ml-2 text-[10px]', utilization >= 1 ? 'text-rose-500' : utilization >= 0.8 ? 'text-amber-500' : 'text-rz-data')}>
                                                        ({(utilization * 100).toFixed(0)}%)
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={clsx('h-full rounded-full transition-all', utilization >= 1 ? 'bg-rose-400' : utilization >= 0.8 ? 'bg-amber-400' : 'bg-rz-data')}
                                                    style={{ width: `${Math.min(100, utilization * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Phase schedule */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                            <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">Recommended Expansion Schedule</h4>
                            <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
                                Trigger point: Year {expansionResults.triggerYear} (demand crosses 80% utilization). Break ground now — grid reservation must start in month {Math.max(1, expansionResults.triggerYear * 12 - expansion.gridReservationLeadMonths)}.
                            </div>
                            {expansionResults.phases.length === 0 ? (
                                <p className="text-xs text-slate-500">No expansion needed within the planning horizon.</p>
                            ) : (
                                <div className="space-y-2">
                                    {expansionResults.phases.map(ph => (
                                        <div key={ph.label} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <div className="w-2 h-2 rounded-full bg-rz-mint mt-1.5 shrink-0" />
                                            <div className="flex-1">
                                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{ph.label} — {ph.capacityMW.toFixed(1)} MW</div>
                                                <div className="text-[10px] text-slate-400">Start: Year {ph.startYear} · CAPEX: {fmtMoney(ph.capex)} · Grid reservation: month {Math.max(1, ph.gridReservationMonth)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between text-xs">
                                <span className="text-slate-500">Total Expansion Needed</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {expansionResults.expansionNeededMW.toFixed(1)} MW · {fmtMoney(expansionResults.totalCapexRequired)}
                                </span>
                            </div>
                        </div>

                        {/* ── J-curve (Workstream U) — program cash profile per year ── */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                            <h4 className="text-xs font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                                Expansion J-Curve — Cumulative Net Cash
                                <Tooltip content={`Per-year cash profile of the expansion program: phase CAPEX outflows from the schedule above, against an EBITDA proxy = revenue basis $${revBasis.toFixed(0)}/kW·mo × built MW × 12 × utilization − annual OPEX (engine models.opex per built MW, 8%-of-CAPEX fallback). Utilization = demand ÷ built capacity, capped at 95%. Phase capacity counts from its start year (screening — no partial-year proration, no financing costs). The highlighted row is the program breakeven year — cumulative net cash first turns positive.`} />
                            </h4>
                            <p className="text-[10px] text-slate-400 mb-3">Revenue basis ${revBasis.toFixed(0)}/kW·mo ({revBasisLabel}) · screening</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                                            <th className="text-left py-1.5 pr-2">Year</th>
                                            <th className="text-right py-1.5 px-2">Built MW</th>
                                            <th className="text-right py-1.5 px-2">Util.</th>
                                            <th className="text-right py-1.5 px-2">CAPEX Out</th>
                                            <th className="text-right py-1.5 px-2">EBITDA Proxy</th>
                                            <th className="text-right py-1.5 pl-2">Cumulative Net</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {jCurve.rows.map(r => (
                                            <tr key={r.year}
                                                className={clsx('border-b border-slate-100 dark:border-slate-800 last:border-0',
                                                    r.year === jCurve.breakevenYear && 'bg-rz-data/10 dark:bg-rz-data/10')}
                                                title={r.year === jCurve.breakevenYear ? 'Breakeven year — cumulative net cash first turns positive' : undefined}>
                                                <td className="py-1.5 pr-2 font-medium text-slate-800 dark:text-slate-200">
                                                    Y{r.year}{r.year === jCurve.breakevenYear && <span className="ml-1 rounded bg-rz-data/20 px-1 py-0.5 text-[8px] font-bold uppercase text-rz-data">breakeven</span>}
                                                </td>
                                                <td className="text-right py-1.5 px-2 tabular-nums text-slate-700 dark:text-slate-300">{r.builtMW.toFixed(1)}</td>
                                                <td className="text-right py-1.5 px-2 tabular-nums text-slate-500">{r.utilPct.toFixed(0)}%</td>
                                                <td className={`text-right py-1.5 px-2 tabular-nums ${r.capexOut > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-slate-400'}`}>{r.capexOut > 0 ? `−${fmtMoney(r.capexOut)}` : '—'}</td>
                                                <td className={`text-right py-1.5 px-2 tabular-nums ${r.ebitda >= 0 ? 'text-slate-700 dark:text-slate-300' : 'text-rose-500'}`}>{fmtMoney(r.ebitda)}</td>
                                                <td className={`text-right py-1.5 pl-2 font-semibold tabular-nums ${r.cumulative >= 0 ? 'text-rz-data' : 'text-rose-500'}`}>{fmtMoney(r.cumulative)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {jCurve.breakevenYear == null && (
                                <p className="mt-2 text-[10px] text-rose-500">Program does not reach cumulative breakeven inside the {expansion.planningHorizonYears}-yr horizon at this revenue basis — honest verdict; test a longer horizon or a stronger basis.</p>
                            )}
                            <p className="mt-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-2 py-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                <b>Option value:</b> deferring a later phase preserves its CAPEX as optionality (spend only if demand materializes) at the cost of grid-queue position — the {expansion.gridReservationLeadMonths}-month reservation lead means a deferred phase re-enters the interconnection queue behind competing loads (screening note, not a priced real-option model).
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Use-case guide */}
            <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                    <Globe2 className="w-4 h-4 text-slate-400" />
                    When to Use Each Mode
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    {[
                        {
                            title: 'Land / Power Feasibility',
                            when: 'Early-stage site selection. You have a land parcel and a utility quote — determine if the combination is viable before committing to option agreements.',
                            output: 'Buildable IT MW, grid headroom, PUE estimate, CAPEX range',
                        },
                        {
                            title: 'Acquisition Assessment',
                            when: 'Due diligence on a target site with a quoted ask price. Benchmark against recent market comps to determine bid range and walk-away threshold.',
                            output: 'Fair value, bid floor/ceiling, 10-yr NPV/IRR/MoIC per bid, committee verdict, sensitivity, portfolio note',
                        },
                        {
                            title: 'Expansion Scenario',
                            when: 'Existing facility approaching capacity. Model demand growth to determine when and how large to expand, and when to place grid reservation orders.',
                            output: 'Phase trigger year, CAPEX schedule, grid reservation timeline, J-curve breakeven',
                        },
                    ].map(item => (
                        <div key={item.title} className="space-y-1">
                            <div className="font-semibold text-slate-700 dark:text-slate-300">{item.title}</div>
                            <div className="text-slate-500 dark:text-slate-400 leading-relaxed">{item.when}</div>
                            <div className="text-cyan-600 dark:text-cyan-400 mt-1">
                                <span className="font-medium">Output: </span>{item.output}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
