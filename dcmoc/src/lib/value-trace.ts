/* ─── VALUE TRACE INDEX (PHASE EB) ───────────────────────────────────────────
 * Excel-style precedent tracing: every instrumented number resolves to a LIVE
 * tree — value, formula with live numbers substituted, and its source values,
 * recursively down to leaf inputs / DATA constants ("all the way to the
 * furthest endpoint"). ids stay consistent with value-bindings.ts + data-bind anchors.
 * Graph MUST be acyclic (gate-checked in tools/test-value-bindings.mjs).
 * ──────────────────────────────────────────────────────────────────────── */

import { useSimulationStore } from '@/store/simulation';
import { ccOverall } from '@/components/modules/reliability/availabilityChain';
import { useCapexStore } from '@/store/capex';
import { useRequirementsStore } from '@/store/requirements';
import { useSitesStore } from '@/store/sites';
import { COUNTRIES } from '@/constants/countries';
import { buildAnalysisCtx, analyzeSite, scoreAllSites, type SiteAnalyses } from '@/lib/site-adapter';
import type { SiteScoreResult } from '@/types/site-intel';
import { calculateAutoHeadcount, calculateStaffing, type StaffRole } from '@/modules/staffing/ShiftEngine';
import { calculateFuelGen } from '@/modules/infrastructure/FuelGenEngine';
import { rzData, rzModels } from '@/lib/rz-engine';
/* EB wave (Staffing/Construction/Commissioning/Results/Asset) — live readers */
import { useConstructionTracking } from '@/store/constructionTracking';
import { plannedSchedule, evm, type PlannedSchedule, type EvmResult } from '@/state/adapters/construction-adapter';
import { useCxTracking, checklistDerivedCompletion } from '@/store/cxTracking';
import { CX_CHECKLIST, type ReadinessKey } from '@/lib/cx-procedures';
import { densityToEngineBucket } from '@/lib/requirementsMappings';
/* EB-cov wave (trace-coverage ≥60% of core pages) — live readers */
import { useOpsLog } from '@/store/opsLog';
import { getPUE } from '@/constants/pue';
// Single-source the results-dimension scoring: use the SAME helpers ResultsEnginePage
// renders with, so the ƒx trace popover can never drift from the displayed score.
import { capexScoreOf, susScoreOf, finScoreOf, constrScoreOf, opsScoreOf, archScoreOf, finScreening } from '@/components/modules/results/dimension-explain';
import { riskBand } from '@/state/adapters/capex-adapter';
import { sanitizeCap, facilitySnapshot, utilization, forecastSeries, type UtilRow } from '@/state/adapters/capacity-adapter';
import { calculateFinancials, defaultOccupancyRamp, type FinancialResult } from '@/modules/analytics/FinancialEngine';
import { DEFAULT_REVENUE_PER_KW_MONTH } from '@/constants/finance';
/* EB-finsus wave (Financial + Sustainability telemetry ≥60%) — live readers */
import { useFinancialTracking } from '@/store/financialTracking';
import { useSustainability } from '@/store/sustainability';
/* EB-walk4 wave (Maintenance / Investment / Phased-Finance / Assets KPI ƒx) — live readers */
import { generateAssetCounts } from '@/lib/AssetGenerator';
import { generateMaintenanceSchedule } from '@/modules/maintenance/ScheduleEngine';
import { calculateStrategyComparison } from '@/modules/maintenance/MaintenanceStrategyEngine';
import { calculateInvestment, type InvestmentResult } from '@/modules/analytics/InvestmentEngine';
import { calculateCapacityPlan } from '@/modules/capacity/CapacityPlanningEngine';
import { calculateDisasterRisk } from '@/modules/risk/DisasterRiskEngine';
import { calculateGridReliability } from '@/modules/infrastructure/GridReliabilityEngine';
import { calculateTalentAvailability } from '@/modules/staffing/TalentAvailabilityEngine';
import { calculateRiskProfile, calculateRiskScore } from '@/modules/risk/RiskEngine';

export type TraceProvenance = 'input' | 'engine' | 'derived' | 'screening';

export interface TraceNode {
    label: string;
    page: string;                    // activeTab id of the value's home menu
    unit?: string;
    provenance: TraceProvenance;
    /** formula in dep names, e.g. "itLoadKw × pue ÷ 1000" — leaf nodes omit */
    formulaTemplate?: string;
    deps?: string[];
    /** live value reader — null when not computable yet */
    get: () => number | null;
    /** for engine leaves: DATA.sources key documenting the constant */
    sourceKey?: string;
    /** EB6 — cross-surface link OUTSIDE dcmoc (glossary/article/corpus doc/gateway) */
    external?: { href: string; label: string };
}

const sim = () => useSimulationStore.getState();
const cap = () => useCapexStore.getState();
const req = () => useRequirementsStore.getState();

const pueLive = (): number | null => {
    const m = (rzData() as { pueMatrix?: Record<string, Record<string, number>> }).pueMatrix;
    return m?.[sim().inputs.coolingType]?.['tier' + sim().inputs.tierLevel] ?? null;
};

/* ── SITE-INTEL live readers (selected-site scoped) ───────────────────────────
 * Mirrors SiteIntelligencePage EXACTLY: selected site (fallback first site) →
 * buildAnalysisCtx (effective auto-headcounts per useEffectiveInputs) →
 * analyzeSite (5 sibling engines). Memoized per input-key so one popover
 * resolve doesn't re-run the engines per node. */
const siteSel = () => {
    const st = useSitesStore.getState();
    return st.sites.find((s) => s.id === st.selectedSiteId) ?? st.sites[0] ?? null;
};
const siteCountry = () => { const s = siteSel(); return s ? COUNTRIES[s.countryId] : undefined; };

let _siteAnCache: { key: string; an: SiteAnalyses } | null = null;
const fuelGenRes = () => {
    try {
        const st = useSimulationStore.getState();
        if (!st.selectedCountry) return null;
        return calculateFuelGen({
            country: st.selectedCountry, itLoadKw: st.inputs.itLoad, tierLevel: st.inputs.tierLevel,
            coolingType: st.inputs.coolingType, coolingTopology: st.inputs.coolingTopology,
            powerRedundancy: st.inputs.powerRedundancy, testingRegime: 'minimal',
        });
    } catch { return null; }
};

/* Selected-site SITE SCORE result (models.site.score + presentation axes).
 * Mirrors SiteIntelligencePage `kpi` EXACTLY: scoreAllSites(sites) →
 * selectedResult (find by selected/first site id) ?? best (results[0]). */
const siteScoreRes = (): SiteScoreResult | null => {
    try {
        const st = useSitesStore.getState();
        const sel = st.sites.find((s) => s.id === st.selectedSiteId) ?? st.sites[0] ?? null;
        const results = scoreAllSites(st.sites);
        if (results.length === 0) return null;
        return (sel ? results.find((r) => r.siteId === sel.id) : null) ?? results[0] ?? null;
    } catch { return null; }
};

const siteAn = (): SiteAnalyses | null => {
    const site = siteSel();
    if (!site) return null;
    const i = sim().inputs;
    /* effective headcounts — mirror useEffectiveInputs (auto mode resolves via ShiftEngine) */
    let hc = [i.headcount_ShiftLead ?? 0, i.headcount_Engineer ?? 0, i.headcount_Technician ?? 0, i.headcount_Admin ?? 0, i.headcount_Janitor ?? 0];
    if (i.staffingAutoMode) {
        try {
            const auto = calculateAutoHeadcount(
                i.itLoad, i.tierLevel, i.shiftModel,
                i.staffingModel === 'outsourced' ? 'outsourced' : i.staffingModel,
                i.maintenanceModel, i.maintenanceStrategy, i.hybridRatio ?? 0.5,
            );
            hc = [auto.headcounts['shift-lead'], auto.headcounts['engineer'], auto.headcounts['technician'], auto.headcounts['admin'], auto.headcounts['janitor']];
        } catch { /* keep manual headcounts */ }
    }
    const capexTotal = cap().results?.total ?? null;
    const firstCountry = useSitesStore.getState().sites[0]?.countryId ?? 'ID';
    const key = [site.id, site.countryId, site.updatedAt, i.itLoad, i.tierLevel, i.coolingType, capexTotal, firstCountry, hc.join('.')].join('|');
    if (_siteAnCache?.key === key) return _siteAnCache.an;
    try {
        const ctx = buildAnalysisCtx({
            itLoadKw: i.itLoad,
            tierLevel: i.tierLevel === 4 ? 4 : i.tierLevel === 2 ? 2 : 3,
            coolingType: i.coolingType,
            capexTotal,
            headcounts: hc,
            countryId: firstCountry,
        });
        const an = analyzeSite(site, ctx);
        _siteAnCache = { key, an };
        return an;
    } catch { return null; }
};

/* RISK DASHBOARD composite score — mirrors RiskDashboard `analysis` memo EXACTLY
 * (same generateAssetCounts → calculateRiskProfile → calculateRiskScore chain,
 * same sim inputs) so the ƒx trace can never drift from the rendered KPI. The
 * card renders `totalScore` (colored by normalizedScore); get() returns totalScore. */
const riskAgg = (): { totalScore: number; normalizedScore: number } | null => {
    try {
        const st = sim(); const i = st.inputs; const country = st.selectedCountry;
        if (!country) return null;
        const tierLevel = (i.tierLevel === 4 ? 4 : 3) as 3 | 4;
        const coolingMap: 'air' | 'pumped' = i.coolingType === 'liquid' || i.coolingType === 'rdhx' ? 'pumped' : 'air';
        const assets = generateAssetCounts(i.itLoad, tierLevel, coolingMap, Math.ceil(i.itLoad * 0.6), i.coolingTopology, i.powerRedundancy);
        const risks = calculateRiskProfile(country, tierLevel, assets);
        const agg = calculateRiskScore(risks, tierLevel);
        return { totalScore: agg.totalScore, normalizedScore: agg.normalizedScore };
    } catch { return null; }
};

export const TRACE: Record<string, TraceNode> = {
    /* ── LEAF INPUTS (furthest endpoint — user-owned) ── */
    'sim.itLoad': { label: 'IT Load', page: 'requirements', unit: 'kW', provenance: 'input', get: () => sim().inputs.itLoad },
    'sim.tierLevel': { label: 'Tier Level', page: 'requirements', provenance: 'input', get: () => sim().inputs.tierLevel },
    'sim.electricityRate': { label: 'Electricity Tariff (country)', page: 'requirements', unit: '$/kWh', provenance: 'input', external: { href: '/dc-market-tracker.html', label: 'DC market tracker (tariff per country)' }, get: () => sim().selectedCountry?.economy.electricityRate ?? null },
    'req.designMarginPct': { label: 'Design Margin', page: 'requirements', unit: '%', provenance: 'input', get: () => req().business.designMarginPct ?? 10 },
    'capex.contingencyPct': { label: 'Contingency %', page: 'capex', unit: '%', provenance: 'input', get: () => cap().inputs.contingency },

    /* ── ENGINE LEAVES (DATA constants — provenance via DATA.sources) ── */
    'engine.pueMatrix': { label: 'Design PUE (matrix[cooling][tier])', page: 'architecture', unit: 'ratio', provenance: 'engine', sourceKey: 'pueMatrix', external: { href: '/glossary.html#pue', label: 'Glossary: PUE' }, get: pueLive },
    'engine.hoursPerYear': { label: 'Hours per Year', page: 'knowledge', unit: 'h', provenance: 'engine', sourceKey: 'conventions', get: () => 8760 },

    /* ── DERIVED CHAIN ── */
    'arch.facilityMw': {
        label: 'Facility Load', page: 'architecture', unit: 'MW', provenance: 'derived',
        formulaTemplate: 'sim.itLoad × engine.pueMatrix ÷ 1000',
        deps: ['sim.itLoad', 'engine.pueMatrix'],
        get: () => { const p = pueLive(); return p ? +(sim().inputs.itLoad * p / 1000).toFixed(2) : null; },
    },
    'ops.annualEnergyMwh': {
        label: 'Annual Facility Energy', page: 'ops', unit: 'MWh', provenance: 'derived',
        formulaTemplate: 'arch.facilityMw × engine.hoursPerYear',
        deps: ['arch.facilityMw', 'engine.hoursPerYear'],
        get: () => { const f = TRACE['arch.facilityMw'].get(); return f ? +(f * 8760).toFixed(0) : null; },
    },
    'ops.energyCost': {
        label: 'Annual Energy Cost', page: 'ops', unit: '$', provenance: 'derived',
        formulaTemplate: 'ops.annualEnergyMwh × 1000 × sim.electricityRate',
        deps: ['ops.annualEnergyMwh', 'sim.electricityRate'],
        get: () => {
            const e = TRACE['ops.annualEnergyMwh'].get(); const r = sim().selectedCountry?.economy.electricityRate;
            return e && r ? +(e * 1000 * r).toFixed(0) : null;
        },
    },
    /* CAPEX total is NOT "IT load × contingency" — it is the SUM of the real
     * cost stack: hard disciplines + soft costs + contingency + front-of-meter.
     * Trace decomposes into those actual components (owner: "harus dari
     * calculation, bukan contingency assumption"). */
    'capex.hardTotal': {
        label: 'Hard Cost (Σ disciplines)', page: 'capex', unit: '$', provenance: 'derived',
        formulaTemplate: 'Σ CapexEngine.costs — electrical + cooling + ups + building + generator + network + fire + seismic + security + commissioning + testing + permits (all disciplines × their multipliers)',
        deps: ['sim.itLoad'],
        get: () => { const c = cap().results?.costs; return c ? Math.round(Object.values(c).reduce((a, b) => a + b, 0)) : null; },
    },
    'capex.softTotal': {
        label: 'Soft Costs (design + PM)', page: 'capex', unit: '$', provenance: 'derived',
        formulaTemplate: 'design fee + project-management fee (% of direct cost)',
        deps: ['capex.hardTotal'],
        get: () => { const s = cap().results?.softCosts; return s ? Math.round((s.design ?? 0) + (s.pm ?? 0)) : null; },
    },
    'capex.contingencyAmt': {
        label: 'Contingency', page: 'capex', unit: '$', provenance: 'derived',
        formulaTemplate: '(hard + soft) × capex.contingencyPct',
        deps: ['capex.hardTotal', 'capex.softTotal', 'capex.contingencyPct'],
        get: () => cap().results?.contingency ?? null,
    },
    'capex.fomAmt': {
        label: 'Front-of-Meter (grid / substation)', page: 'capex', unit: '$', provenance: 'derived',
        formulaTemplate: 'substation + grid connection + switchgear (utility interconnect)',
        deps: ['sim.itLoad'],
        get: () => cap().results?.fomTotal ?? null,
    },
    'capex.total': {
        label: 'CAPEX Total (P50)', page: 'capex', unit: '$', provenance: 'engine',
        formulaTemplate: 'hard cost (Σ disciplines) + soft costs + contingency + front-of-meter — CapexEngine.calculateCapex',
        deps: ['capex.hardTotal', 'capex.softTotal', 'capex.contingencyAmt', 'capex.fomAmt'],
        get: () => cap().results?.total ?? null,
    },
    'capex.perKw': {
        label: 'CAPEX $/kW', page: 'capex', unit: '$/kW', provenance: 'derived',
        formulaTemplate: 'capex.total ÷ sim.itLoad',
        deps: ['capex.total', 'sim.itLoad'],
        get: () => { const t = cap().results?.total; return t ? +(t / Math.max(1, cap().inputs.itLoad)).toFixed(0) : null; },
    },
    'capex.landedFactor': {
        label: 'Landed-Cost Factor (UPS, import duty × equipment share)', page: 'capex', unit: '×', provenance: 'engine', sourceKey: 'supplyChain',
        formulaTemplate: 'models.supplyChain.landedFactor(country, "ups") = 1 + importDutyBand × equipmentShare — Ship-C per-category duty uplift',
        get: () => { const c = sim().selectedCountry; return c ? ((rzModels() as any)?.supplyChain?.landedFactor?.(c, 'ups') ?? null) : null; },
    },
    /* ── EB batch-3: opex / staffing / availability chains ── */
    'staff.fte': {
        label: 'Total FTE (auto headcount)', page: 'staff', provenance: 'derived',
        formulaTemplate: 'Σ effective headcount per role via ShiftEngine.calculateStaffing (sub-linear sim.itLoad, Uptime calibration) — mirrors the page totalHeadcount (parity-fix 2026-07-20)',
        deps: ['sim.itLoad'],
        get: () => { const p = staffCostParts(); return p ? p.headcount : null; },
    },
    'rel.tierTarget': {
        label: 'Tier Availability Target', page: 'reliability', unit: '%', provenance: 'engine', sourceKey: 'reliability',
        external: { href: '/glossary.html#tier', label: 'Glossary: Tier' },
        get: () => {
            const t = (rzData() as { reliability?: { tierAvailability?: Record<string, number> } }).reliability?.tierAvailability?.[String(sim().inputs.tierLevel)];
            return t ? +(t * 100).toFixed(4) : null;
        },
    },
    'opex.totalAnnual': {
        label: 'Annual OPEX (dcContract)', page: 'finance', unit: '$', provenance: 'engine',
        formulaTemplate: 'models.opex.totalAnnual(sim.itLoad, country, staff.fte — dcContract basis)',
        deps: ['sim.itLoad', 'staff.fte'],
        get: () => {
            try {
                /* parity-fix 2026-07-20: engine signature POSITIONAL (mw, pue, region, headcount, opts) — mirrors the FinancialPage call exactly */
                const m = (rzModels() as { opex?: { totalAnnual?: (mw: number, pue: number | undefined, region: string, headcount: number, opts?: Record<string, unknown>) => { total?: number } } }).opex;
                const st = sim(); const i = st.inputs;
                const hc = (i.headcount_ShiftLead ?? 0) + (i.headcount_Engineer ?? 0) + (i.headcount_Technician ?? 0) + (i.headcount_Admin ?? 0);
                const r = m?.totalAnnual?.(i.itLoad / 1000, undefined, st.selectedCountry?.id ?? 'US', hc,
                    { capex: cap().results?.total, extendedOpex: true, basisPreset: 'dcContract' });
                return r?.total ?? null;
            } catch { return null; }
        },
    },
    'cap.totalMw': {
        label: 'Total Capacity (committed phases)', page: 'capacity', unit: 'MW', provenance: 'derived',
        formulaTemplate: 'Σ phases (capacityPhases) — pristine follows sim.itLoad',
        deps: ['sim.itLoad'],
        get: () => +(sim().inputs.capacityPhases.reduce((a, p) => a + p.itLoadKw, 0) / 1000).toFixed(1),
    },
    'carbon.annualEmissions': {
        label: 'Annual Emissions (Scope 1+2+3)', page: 'carbon', unit: 'tCO₂', provenance: 'derived',
        formulaTemplate: 'ops.annualEnergyMwh × country grid carbon intensity (+Scope 1 genset & Scope 3)',
        deps: ['ops.annualEnergyMwh'],
        get: () => {
            const e = TRACE['ops.annualEnergyMwh'].get();
            const gi = sim().selectedCountry?.environment.gridCarbonIntensity;
            return e && gi ? +(e * gi).toFixed(0) : null;
        },
    },
    'fin.npvScreening': {
        label: 'NPV (10-yr screening)', page: 'finance', unit: '$', provenance: 'derived',
        formulaTemplate: '(revenue − opex.totalAnnual) discounted 10% over 10 yr − capex.total (screening; full pro-forma on Financial)',
        deps: ['capex.total', 'opex.totalAnnual'],
        get: () => {
            const cap = TRACE['capex.total'].get(); const op = TRACE['opex.totalAnnual'].get();
            if (!cap || !op) return null;
            const rev = sim().inputs.itLoad * 150 * 12;   // screening basis, lib/screening.ts
            let npv = -cap;
            for (let y = 1; y <= 10; y++) npv += (rev - op) / Math.pow(1.10, y);
            return +npv.toFixed(0);
        },
    },
    /* ── RISK ASSESSMENT DASHBOARD — composite Risk Score KPI (page 'risk') ──
     * Displays totalScore (Σ likelihood×impact over the country/tier risk
     * profile); color keyed to normalizedScore (% of theoretical max). ── */
    'risk.compositeScore': {
        label: 'Risk Score (aggregate)', page: 'risk', provenance: 'engine',
        formulaTemplate: 'Σ (probability 1–4 × impact 1–4) over the risk profile — calculateRiskProfile(selected country, tier, generateAssetCounts(sim.itLoad,…)) → calculateRiskScore.totalScore; normalizedScore = totalScore ÷ (risks × 16) × 100',
        deps: ['sim.itLoad', 'sim.tierLevel'],
        get: () => riskAgg()?.totalScore ?? null,
    },

    /* ── EB-instrument: page-KPI nodes (append-only) ── */
    'ops.energyCostDaily': {
        label: 'Energy Cost (24h)', page: 'ops', unit: '$', provenance: 'derived',
        formulaTemplate: 'active IT (sim.itLoad × occupancy S-curve) × partial-load PUE × 24h × sim.electricityRate — mirrors the Ops page (parity-fix 2026-07-20; full design basis is in ops.energyCost)',
        deps: ['sim.itLoad', 'engine.pueMatrix', 'sim.electricityRate'],
        get: () => {
            try {
                const m = rzModels() as { capacity?: { occupancyScurve?: (y: number, mk: string) => number }; pue?: { partialLoadPUE?: (p: number, o: number) => number } };
                const st = sim(); const i = st.inputs;
                let occ = 0.85;
                try { if (m?.capacity?.occupancyScurve) occ = Math.max(0.05, Math.min(1, m.capacity.occupancyScurve(1, 'wholesale'))); } catch { /* */ }
                const designPue = (rzData() as { pueMatrix?: Record<string, Record<string, number>> }).pueMatrix?.[i.coolingType]?.['tier' + i.tierLevel] ?? 1.4;
                let livePue = designPue;
                try { if (m?.pue?.partialLoadPUE) livePue = +m.pue.partialLoadPUE(designPue, occ).toFixed(2); } catch { /* */ }
                const activeItMw = +((i.itLoad / 1000) * occ).toFixed(1);
                const rate = (st.selectedCountry as { economy?: { electricityRate?: number } } | null)?.economy?.electricityRate ?? 0.1;
                return Math.round(activeItMw * livePue * 24 * 1000 * rate);
            } catch { return null; }
        },
    },
    /* ── SITE INTELLIGENCE — top KPI score cards (selected site) ──────────────
     * Total Score = models.site.score (weighted composite of 10 factors); the 4
     * sub-scores are the presentation-axis decomposition in site-adapter.scoreSite
     * (documented blends of the SAME engine factors — NOT a rival score). Each
     * get() reads straight off the SiteScoreResult the KPI card renders. */
    'site.totalScore': {
        label: 'Total Site Score', page: 'site', unit: '/100', provenance: 'engine', sourceKey: 'site',
        formulaTemplate: 'models.site.score = 100 × Σ(weight × factor) ÷ Σ(present weights) — weights power 17% + grid 14% + talent 11% + seismic 10% + tax 9% + carbon 9% + water 8% + climate 8% + flood 7% + latency 7%; each factor a 0–1 goodness from the selected-site country baseline (DATA.countries) + any Edit-Criteria overrides, renormalized over present factors',
        get: () => siteScoreRes()?.engine.score ?? null,
    },
    'site.availabilityScore': {
        label: 'Availability Score', page: 'site', unit: '/100', provenance: 'derived',
        formulaTemplate: 'round(100 × (0.6 × power factor + 0.4 × grid factor)) — power-availability axis (site-adapter.scoreSite.axes.powerAvailability); power/grid are the models.site engine factors',
        deps: ['site.totalScore'],
        get: () => siteScoreRes()?.availabilityScore ?? null,
    },
    'site.connectivityScore': {
        label: 'Connectivity Score', page: 'site', unit: '/100', provenance: 'derived',
        formulaTemplate: 'round(100 × latency factor) — connectivity axis (site-adapter.scoreSite.axes.connectivity); latency factor = 0.6 × min-latency score + 0.4 × cable-landing score when the site sets them, else the country hyperscaler-presence baseline',
        deps: ['site.totalScore'],
        get: () => siteScoreRes()?.connectivityScore ?? null,
    },
    'site.waterCoolingScore': {
        label: 'Water & Cooling Score', page: 'site', unit: '/100', provenance: 'derived',
        formulaTemplate: 'round(100 × (0.5 × water factor + 0.5 × climate factor)) — water/cooling axis (site-adapter.scoreSite.axes.waterCooling); water = 1 − WRI stress ÷ 5, climate = ASHRAE free-cooling hours ÷ 5800',
        deps: ['site.totalScore'],
        get: () => siteScoreRes()?.waterCoolingScore ?? null,
    },
    'site.riskScore': {
        label: 'Risk Score', page: 'site', unit: '/100', provenance: 'derived',
        formulaTemplate: '100 − round(100 × (0.5 × seismic + 0.3 × flood + 0.2 × cyclone goodness)) — inverse of the natural-risks axis (site-adapter.scoreSite); LOWER is better',
        deps: ['site.totalScore'],
        get: () => siteScoreRes()?.riskScore ?? null,
    },
    /* ── SITE INTELLIGENCE — integrated analyses (selected site; 5 sibling engines) ── */
    /* Grid Reliability card (GridReliabilityEngine) */
    'site.gridScore': {
        label: 'Grid Reliability Score', page: 'grid', unit: '/100', provenance: 'engine',
        formulaTemplate: '50% local score (grid uptime 40% + voltage stability 20% + brownout frequency 20% + outage duration 20%) + 50% × models.grid.score(gridUptime) — grid baseline of the selected site country',
        get: () => { const g = siteAn()?.grid; return g ? Math.round(g.reliabilityScore) : null; },
    },
    'site.gridOutages': {
        label: 'Expected Outages', page: 'grid', unit: '/yr', provenance: 'engine',
        formulaTemplate: 'brownoutFrequency + (100 − gridUptime%) × 365 ÷ 100 — site country grid baseline',
        get: () => { const g = siteAn()?.grid; return g ? +g.annualExpectedOutages.toFixed(1) : null; },
    },
    'site.gridOutageMin': {
        label: 'Outage Minutes', page: 'grid', unit: 'min/yr', provenance: 'engine',
        formulaTemplate: 'models.grid.annualOutageHours(gridUptime) × 60 (fallback: expected outages × country average outage duration)',
        get: () => { const g = siteAn()?.grid; return g ? Math.round(g.annualOutageMinutes) : null; },
    },
    'site.gridGenCapacity': {
        label: 'Required Gen Capacity', page: 'grid', unit: 'MW', provenance: 'derived',
        formulaTemplate: 'ceil(sim.itLoad × PUE(cooling) × tier redundancy — sim.tierLevel 4→2.0 / 3→1.5 / 2→1.25) ÷ 1000',
        deps: ['sim.itLoad', 'sim.tierLevel'],
        get: () => { const g = siteAn()?.grid; return g ? +(g.requiredGenCapacity / 1000).toFixed(1) : null; },
    },
    'site.gridFuelCost': {
        label: 'Annual Fuel Cost (genset)', page: 'grid', unit: '$/yr', provenance: 'derived',
        formulaTemplate: 'genset capacity (site.gridGenCapacity, in kW) × operating hours (site.gridOutageMin ÷ 60 + 12% periodic test hours) × 0.27 L/kWh × $1.25/L × (1 + country fuel premium)',
        deps: ['site.gridGenCapacity', 'site.gridOutageMin'],
        get: () => siteAn()?.grid?.annualFuelCost ?? null,
    },
    /* Disaster Risk card (DisasterRiskEngine) */
    'site.riskComposite': {
        label: 'Composite Disaster Risk', page: 'disaster', unit: '/100', provenance: 'engine',
        formulaTemplate: 'models.risk.geo(country hazards) — weights: seismic 28% + flood 22% + typhoon 18% + volcanic 12% + tsunami 10% + wildfire 10% (lower = better)',
        get: () => { const d = siteAn()?.disaster; return d ? Math.round(d.compositeScore) : null; },
    },
    'site.riskInsurance': {
        label: 'Annual Insurance Cost', page: 'disaster', unit: '$/yr', provenance: 'derived',
        formulaTemplate: 'capex.total (fallback sim.itLoad × $10,500/kW) × insurance rate per site.riskComposite band (≥60→0.35% · ≥35→0.22% · <35→0.18%) × country insuranceMultiplier',
        deps: ['capex.total', 'sim.itLoad', 'site.riskComposite'],
        get: () => siteAn()?.disaster?.annualInsuranceCost ?? null,
    },
    'site.riskEal': {
        label: 'Expected Annual Loss', page: 'disaster', unit: '$/yr', provenance: 'derived',
        formulaTemplate: '(site.riskComposite ÷ 1250 loss probability) × (15% × capex.total + 25% × annual screening revenue from sim.itLoad)',
        deps: ['site.riskComposite', 'capex.total', 'sim.itLoad'],
        get: () => siteAn()?.disaster?.expectedAnnualLoss ?? null,
    },
    'site.riskBiDays': {
        label: 'Business Interruption', page: 'disaster', unit: 'days', provenance: 'derived',
        formulaTemplate: 'round(site.riskComposite × 0.12)',
        deps: ['site.riskComposite'],
        get: () => { const d = siteAn()?.disaster; return d ? +d.businessInterruptionDays.toFixed(1) : null; },
    },
    'site.riskRevenueAtRisk': {
        label: 'Revenue at Risk', page: 'disaster', unit: '$', provenance: 'derived',
        formulaTemplate: 'site.riskBiDays × daily revenue (revenuePerKwMonth × sim.itLoad × 12 ÷ 365)',
        deps: ['site.riskBiDays', 'sim.itLoad'],
        get: () => siteAn()?.disaster?.revenueAtRisk ?? null,
    },
    /* Tax & Incentives card (TaxIncentiveEngine) */
    'site.taxIncentiveValue': {
        label: 'Total Incentive Value (15 yr)', page: 'tax', unit: '$', provenance: 'derived',
        formulaTemplate: 'site.taxFtz + land subsidy + ITC/bonus-depreciation (US) + Σ annual tax savings (tax holiday vs country standard rate, on screening profit from sim.itLoad & capex.total) discounted 10%',
        deps: ['site.taxFtz', 'capex.total', 'sim.itLoad'],
        get: () => siteAn()?.tax?.totalIncentiveValue ?? null,
    },
    'site.taxFtz': {
        label: 'FTZ Benefits (import duty)', page: 'tax', unit: '$', provenance: 'derived',
        formulaTemplate: 'import duty exemption: capex.total (fallback sim.itLoad × $10,500/kW) × 60% equipment share × country duty rate (ID/IN 7.5% · US 3% · CN 8% · others 5%); 0 if country has no exemption',
        deps: ['capex.total', 'sim.itLoad'],
        get: () => siteAn()?.tax?.ftzBenefits ?? null,
    },
    'site.taxNpvWith': {
        label: 'NPV with Incentives', page: 'tax', unit: '$', provenance: 'derived',
        formulaTemplate: 'NPV 15 yr @10%: −capex.total + Σ (revenue escalated 3% − opex escalated 4% − tax at effective rate with incentives); screening revenue from sim.itLoad',
        deps: ['capex.total', 'sim.itLoad'],
        get: () => siteAn()?.tax?.npvWithIncentives ?? null,
    },
    'site.taxNpvUplift': {
        label: 'NPV Uplift (incentives)', page: 'tax', unit: '$', provenance: 'derived',
        formulaTemplate: 'max(0, site.taxNpvWith − NPV without incentives (full standard tax rate))',
        deps: ['site.taxNpvWith'],
        get: () => { const t = siteAn()?.tax; return t ? Math.max(0, t.npvWithIncentives - t.npvWithoutIncentives) : null; },
    },
    'site.taxIrrWith': {
        label: 'IRR with Incentives', page: 'tax', unit: '%', provenance: 'derived',
        formulaTemplate: 'IRR of 15-yr cashflow with incentives (models.roi.irr; year-0 = −capex.total, annual flow = screening revenue sim.itLoad − opex − effective tax)',
        deps: ['capex.total', 'sim.itLoad'],
        get: () => { const t = siteAn()?.tax; return t ? +t.irrWithIncentives.toFixed(1) : null;  /* engine already returns percent */ },
    },
    /* Talent Availability card (TalentAvailabilityEngine) */
    /* ── Workstream T — Fuel & Generator wiring visibility. get() re-runs the
     * SAME calculateFuelGen the page renders from (no second estimate). ── */
    'fuelgen.gensetCount': {
        label: 'Generator Count', page: 'fuel-gen', unit: 'units', provenance: 'engine',
        formulaTemplate: 'ceil(facility kW ÷ unit rating) + redundancy adder — facility kW = IT load × PUE; N+1 adds 1, 2N doubles (calculateFuelGen)',
        get: () => fuelGenRes()?.generator.count ?? null,
    },
    'fuelgen.capacityKw': {
        label: 'Generator Unit Rating', page: 'fuel-gen', unit: 'kW', provenance: 'engine',
        formulaTemplate: 'standard genset frame size selected so N units cover facility kW (IT × PUE) with headroom (calculateFuelGen)',
        get: () => fuelGenRes()?.generator.capacityKw ?? null,
    },
    'fuelgen.tankLiters': {
        label: 'Fuel Storage', page: 'fuel-gen', unit: 'L', provenance: 'engine',
        formulaTemplate: 'gen kW × consumption L/kWh × autonomy hours (tier/grid-driven: recommendedGenHours) × units (calculateFuelGen)',
        get: () => fuelGenRes()?.storage.totalLiters ?? null,
    },
    'fuelgen.autonomyDays': {
        label: 'Fuel Autonomy', page: 'fuel-gen', unit: 'days', provenance: 'engine',
        formulaTemplate: 'stored liters ÷ full-load burn per day — floor from country gridReliability.recommendedGenHours',
        get: () => fuelGenRes()?.storage.daysOfAutonomy ?? null,
    },
    'fuelgen.annualLiters': {
        label: 'Annual Fuel Consumption', page: 'fuel-gen', unit: 'L/yr', provenance: 'engine',
        formulaTemplate: 'testing regime hours × burn rate + expected outage hours (SAIDI blend) × full-load burn (calculateFuelGen)',
        get: () => fuelGenRes()?.consumption.totalLitersPerYear ?? null,
    },
    'site.talentScore': {
        label: 'Talent Score', page: 'talent', unit: '/100', provenance: 'engine',
        formulaTemplate: 'DC engineer pool 30% + university pipeline 20% + hyperscaler competition 25% + hiring speed 15% + professional certification 10% — site country talentPool baseline',
        get: () => { const t = siteAn()?.talent; return t ? Math.round(t.talentScore) : null; },
    },
    'site.talentTimeToStaff': {
        label: 'Time to Full Staff', page: 'talent', unit: 'mo', provenance: 'derived',
        formulaTemplate: 'staff.fte ÷ hires per month (2 parallel recruitments, country avgHiringDays ÷ 30)',
        deps: ['staff.fte'],
        get: () => { const t = siteAn()?.talent; return t ? +t.timeToFullStaff.toFixed(1) : null; },
    },
    'site.talentRecruitCost': {
        label: 'Total Recruitment Cost', page: 'talent', unit: '$', provenance: 'derived',
        formulaTemplate: '(country avgHiringDays × $150/day recruiter cost × country salary premium) × staff.fte',
        deps: ['staff.fte'],
        get: () => siteAn()?.talent?.totalRecruitmentCost ?? null,
    },
    'site.talentTraining': {
        label: 'Annual Training Cost', page: 'talent', unit: '$/yr', provenance: 'derived',
        formulaTemplate: 'ceil(staff.fte × site.talentTurnover) new hires/yr × $4,200 CDCP/CDCS × 1.5 onboarding overhead',
        deps: ['staff.fte', 'site.talentTurnover'],
        get: () => siteAn()?.talent?.annualTrainingCost ?? null,
    },
    'site.talentTurnover': {
        label: 'Adjusted Turnover Rate', page: 'talent', unit: '%/yr', provenance: 'engine',
        formulaTemplate: 'baseline 15% + pool scarcity adjustment (0–12%) + hyperscaler competition adjustment (0–4%) — site country talentPool',
        get: () => { const t = siteAn()?.talent; return t ? +(t.adjustedTurnoverRate * 100).toFixed(1) : null; },
    },
    /* Compliance card (ComplianceEngine) */
    'site.compScore': {
        label: 'Compliance Score', page: 'compliance', unit: '/100', provenance: 'engine',
        formulaTemplate: 'framework coverage (item count ÷ 14) × 60 + mandatory item ratio × 40 — site country regulatory framework',
        get: () => { const c = siteAn()?.compliance; return c ? Math.round(c.complianceScore) : null; },
    },
    'site.compMandatory': {
        label: 'Mandatory Compliance Items', page: 'compliance', provenance: 'engine',
        formulaTemplate: 'number of mandatory items in the site country compliance framework (fire / electrical / environmental / building / data-protection / telecom)',
        get: () => siteAn()?.compliance?.mandatoryCount ?? null,
    },
    'site.compInitialCost': {
        label: 'Compliance Initial Cost', page: 'compliance', unit: '$', provenance: 'derived',
        formulaTemplate: 'Σ initial cost of all country framework items — facility-scale items (EIA / building permit) multiplied by max(1, sim.itLoad ÷ 2500)',
        deps: ['sim.itLoad'],
        get: () => siteAn()?.compliance?.totalInitialCost ?? null,
    },
    'site.compAnnualCost': {
        label: 'Compliance Annual Cost', page: 'compliance', unit: '$/yr', provenance: 'derived',
        formulaTemplate: 'Σ annual cost of country framework items (blended with models.compliance.annualCost if the gap is <50%) — some items scaled by sim.itLoad',
        deps: ['sim.itLoad'],
        get: () => siteAn()?.compliance?.totalAnnualCost ?? null,
    },
    /* SITE detail-panel country-baseline leaves (site attribute override → else DATA.countries baseline) */
    'site.saidi': {
        label: 'SAIDI (selected site)', page: 'site', unit: 'min/yr', provenance: 'input',
        formulaTemplate: 'site attribute if set (Edit Criteria), else country baseline (DATA.countries environment.saidiMinYr)',
        get: () => { const s = siteSel(); return s?.attributes.saidiMinYr ?? siteCountry()?.environment?.saidiMinYr ?? null; },
    },
    'site.powerCostKwh': {
        label: 'Power Cost (selected site)', page: 'site', unit: '$/kWh', provenance: 'input',
        formulaTemplate: 'site attribute if set (Edit Criteria), else country baseline (DATA.countries economy.electricityRate)',
        get: () => { const s = siteSel(); return s?.attributes.powerCostKwh ?? siteCountry()?.economy?.electricityRate ?? null; },
    },
    'site.airQuality': {
        label: 'Air Quality Index (selected site)', page: 'site', provenance: 'input',
        formulaTemplate: 'site attribute if set (Edit Criteria), else country baseline (DATA.countries environment.baselineAQI)',
        get: () => { const s = siteSel(); return s?.attributes.airQualityIndex ?? siteCountry()?.environment?.baselineAQI ?? null; },
    },
    'site.waterStress': {
        label: 'Water Stress WRI (selected site)', page: 'site', unit: '/5', provenance: 'input',
        formulaTemplate: 'site attribute if set (Edit Criteria), else country baseline (DATA.countries environment.aqueductStressScore — WRI Aqueduct)',
        get: () => { const s = siteSel(); return s?.attributes.waterStress0to5 ?? siteCountry()?.environment?.aqueductStressScore ?? null; },
    },
    'site.pga': {
        label: 'PGA 2% in 50yr (selected site)', page: 'site', unit: '%g', provenance: 'input',
        formulaTemplate: 'site attribute if set (Edit Criteria), else country baseline (DATA.countries environment.pgaPct2in50yr — USGS/GSHAP)',
        get: () => { const s = siteSel(); return s?.attributes.pgaPct2in50yr ?? siteCountry()?.environment?.pgaPct2in50yr ?? null; },
    },
    'site.effTaxRate': {
        label: 'Effective Tax Rate (selected site)', page: 'site', unit: '%', provenance: 'input',
        formulaTemplate: 'site attribute if set (Edit Criteria), else country baseline (DATA.countries economy.taxRate) × 100',
        get: () => {
            const s = siteSel();
            const r = s?.attributes.effectiveTaxRate ?? siteCountry()?.economy?.taxRate;
            return r != null ? +(r * 100).toFixed(0) : null;
        },
    },

    /* ── EB wave: STAFFING page KPIs ── */
    'staff.monthlyCost': {
        label: 'Monthly Payroll (Total)', page: 'staff', unit: '$/mo', provenance: 'derived',
        formulaTemplate: 'Σ per role calculateStaffing(effective headcount — staff.fte, shift model, country): base salary + shift allowance + overtime + benefit (ShiftEngine)',
        deps: ['staff.fte'],
        get: () => staffMonthlyCost(),
    },
    'staff.costPerFte': {
        label: 'Avg Monthly Cost per FTE', page: 'staff', unit: '$/FTE·mo', provenance: 'derived',
        formulaTemplate: 'staff.monthlyCost ÷ staff.fte',
        deps: ['staff.monthlyCost', 'staff.fte'],
        get: () => {
            const c = staffMonthlyCost(); const f = TRACE['staff.fte'].get();
            return c != null && f ? Math.round(c / f) : null;
        },
    },

    /* ── EB wave: CONSTRUCTION page (EVM — planned plane engine CPM, actuals user-tracked) ── */
    'constr.progressPct': {
        label: 'Overall Progress (EV)', page: 'construction', unit: '%', provenance: 'derived',
        formulaTemplate: 'Σ phase weight (CPM duration) × phase actual % — Plan Mode: % planned at status month; CPM schedule from CAPEX timeline (capex.total)',
        deps: ['capex.total'],
        get: () => constrPlan()?.e.overallPct ?? null,
    },
    'constr.evUsd': {
        label: 'Earned Value (EV $)', page: 'construction', unit: '$', provenance: 'derived',
        formulaTemplate: 'constr.progressPct ÷ 100 × capex.total',
        deps: ['constr.progressPct', 'capex.total'],
        get: () => constrPlan()?.e.evUsd ?? null,
    },
    'constr.spi': {
        label: 'SPI (Schedule Performance)', page: 'construction', unit: 'ratio', provenance: 'derived',
        formulaTemplate: 'constr.evUsd ÷ PV (planned value $ at status month) — Plan Mode = 1.00 by definition',
        deps: ['constr.evUsd'],
        get: () => constrPlan()?.e.spi ?? null,
    },
    'constr.cpi': {
        label: 'CPI (Cost Performance)', page: 'construction', unit: 'ratio', provenance: 'derived',
        formulaTemplate: 'constr.evUsd ÷ AC (actual cost entered in tracking) — Plan Mode = 1.00 by definition',
        deps: ['constr.evUsd'],
        get: () => constrPlan()?.e.cpi ?? null,
    },
    'constr.forecastMonths': {
        label: 'Forecast Completion', page: 'construction', unit: 'mo', provenance: 'derived',
        formulaTemplate: 'total schedule duration (CPM) ÷ clamp(constr.spi, 0.5–1.5)',
        deps: ['constr.spi'],
        get: () => constrPlan()?.e.forecastTotalMonths ?? null,
    },

    /* ── EB wave: COMMISSIONING page (readiness = engine readinessIndex, real linkage) ── */
    'cx.testsPassed': {
        label: 'Cx Tests Passed', page: 'commissioning', provenance: 'input',
        formulaTemplate: 'number of PASS ticks on the Cx checklist (NETA/IEEE/ASHRAE templates) — falls back to manual input when there are no ticks yet',
        get: () => {
            const s = cxStats(); if (!s) return null;
            return s.anyTicks ? s.pass : (useCxTracking.getState().testsPassed ?? null);
        },
    },
    'cx.testsFailed': {
        label: 'Cx Tests Failed', page: 'commissioning', provenance: 'input',
        formulaTemplate: 'number of FAIL ticks on the Cx checklist — falls back to manual input when there are no ticks yet',
        get: () => {
            const s = cxStats(); if (!s) return null;
            return s.anyTicks ? s.fail : (useCxTracking.getState().testsFailed ?? null);
        },
    },
    'cx.testsTotal': {
        label: 'Cx Tests in Scope (screening)', page: 'commissioning', provenance: 'derived',
        formulaTemplate: 'Σ equipment units (models.commissioning.equipScale from sim.itLoad) × tests-per-unit per system — switchgear 12 · UPS 4 · genset 8 · chiller 6 · CRAC 2 · PDU 1 · fire 3; manual override wins',
        deps: ['sim.itLoad'],
        get: () => cxTestsTotal(),
    },
    'cx.readiness': {
        label: 'Readiness Index', page: 'commissioning', unit: '%', provenance: 'engine',
        formulaTemplate: 'models.commissioning.readinessIndex: Σ level weight (L1–L5/IST/SAT/FAT/punchlist) × level completion — completion from checklist PASS (cx.testsPassed) wins over the slider',
        deps: ['cx.testsPassed'],
        get: () => {
            try {
                const s = cxStats(); if (!s || Object.keys(s.comp).length === 0) return null;
                const m = (rzModels() as { commissioning?: { readinessIndex?: (c: Record<string, number>) => { index: number } | null } }).commissioning;
                return m?.readinessIndex?.(s.comp)?.index ?? null;
            } catch { return null; }
        },
    },

    /* ── EB wave: RESULTS page (composite scorecard — mirrors ResultsEnginePage dims) ── */
    'results.capexScore': {
        label: 'CAPEX Efficiency Score', page: 'report', unit: '/100', provenance: 'derived',
        formulaTemplate: 'clamp(100 − (capex.perKw − 60% band) ÷ (80% band) × 60, 10–100) — standard $/kW band DATA.commissioning cx.rich.capexPerKw',
        deps: ['capex.perKw'],
        get: () => resultsDims()?.capexScore ?? null,
    },
    'results.susScore': {
        label: 'Sustainability Score', page: 'report', unit: '/100', provenance: 'derived',
        formulaTemplate: 'clamp((1.60 − engine.pueMatrix) ÷ 0.50 × 100, 0–100) — design PUE position on the 1.10–1.60 band',
        deps: ['engine.pueMatrix'],
        get: () => resultsDims()?.susScore ?? null,
    },
    'results.finScore': {
        label: 'Financial Score', page: 'report', unit: '/100', provenance: 'derived',
        formulaTemplate: 'finScoreOf(IRR) — shared with the Results page: IRR = finScreening(sim.itLoad, PUE, country, capex.total) 15-yr screening cashflow vs the 10% hurdle',
        deps: ['capex.total', 'sim.itLoad'],
        get: () => resultsDims()?.finScore ?? null,
    },
    'results.constrScore': {
        label: 'Construction Score', page: 'report', unit: '/100', provenance: 'derived',
        formulaTemplate: 'min(100, 50 × min(1.2, constr.spi) + 50 × min(1.2, constr.cpi)) — Plan Mode = 100 (baseline)',
        deps: ['constr.spi', 'constr.cpi'],
        get: () => resultsDims()?.constrScore ?? null,
    },
    'results.score': {
        label: 'Overall Score (Weighted)', page: 'report', unit: '/100', provenance: 'derived',
        formulaTemplate: 'weighted average of 8 dimensions: results.capexScore 13% + results.susScore 13% + results.finScore 13% + results.constrScore 12% + Requirements 12% + Site 13% + Architecture 12% + Ops Readiness 12%',
        deps: ['results.capexScore', 'results.susScore', 'results.finScore', 'results.constrScore'],
        get: () => resultsDims()?.overall ?? null,
    },

    /* ── EB wave: ASSET INTELLIGENCE page (fleet engine-generated) ── */
    'asset.fleetUnits': {
        label: 'Total Tracked Units (fleet)', page: 'asset-health', provenance: 'derived',
        formulaTemplate: 'Σ units per fleet class — models.commissioning.equipScale(sim.itLoad, Requirements rack density): switchgear/transformer/genset/UPS/PDU/chiller/CRAC/battery/BMS',
        deps: ['sim.itLoad'],
        get: () => {
            const eq = assetEquip(); if (!eq) return null;
            return ASSET_CLASSES.reduce((s, c) => s + (eq[c.eqKey] ?? 0), 0) || null;
        },
    },
    'asset.avgHealth': {
        label: 'Avg Fleet Health', page: 'asset-health', unit: '/100', provenance: 'engine',
        formulaTemplate: 'Σ (class health × units) ÷ asset.fleetUnits — health = models.asset.healthIndex (Weibull remaining-life + condition + duty); trace basis: age 3 yr · condition 85% (change on the page slider)',
        deps: ['asset.fleetUnits'],
        get: () => assetAvgHealth(),
    },
    'asset.replacementValue': {
        label: 'Replacement Value (15 yr, nominal)', page: 'asset-health', unit: '$', provenance: 'derived',
        formulaTemplate: 'Σ models.asset.replacementSchedule(class, sim.itLoad, 15 yr).totalNominalUsd — 6 classes: UPS Li-Ion / genset / CRAC / PDU / BMS / fire',
        deps: ['sim.itLoad'],
        get: () => assetReplacementValue(),
    },

    /* ── EB-cov wave: trace-coverage ≥60% of core pages (append-only) ────────
     * Leaves + derived chains for Dashboard / Capacity / CAPEX / Ops /
     * Architecture KPI wraps. Every get() mirrors the OWNING surface exactly. */

    /* leaves */
    'engine.pueTier3': {
        label: 'Design PUE (tier-3 column of the cooling matrix)', page: 'architecture', unit: 'ratio', provenance: 'engine', sourceKey: 'pueMatrix',
        external: { href: '/glossary.html#pue', label: 'Glossary: PUE' },
        get: () => { try { return getPUE(sim().inputs.coolingType); } catch { return null; } },
    },
    'req.rackDensityKw': {
        label: 'Rack Density (Requirements)', page: 'requirements', unit: 'kW/rack', provenance: 'input',
        get: () => req().workload.avgRackDensityKw ?? null,
    },
    'ops.occupancyPct': {
        label: 'Occupancy (S-curve year-1)', page: 'ops', unit: '%', provenance: 'engine',
        formulaTemplate: 'models.capacity.occupancyScurve(year-1, wholesale) × 100 — clamp 5–100%',
        get: () => { const o = opsOccFrac(); return o == null ? null : Math.round(o * 100); },
    },
    'ops.activeAlarms': {
        label: 'Active Alarms (ops log)', page: 'ops', provenance: 'input',
        formulaTemplate: 'number of Active-status alarms in the ops log (user-entered; EXAMPLE seed in Plan Mode)',
        get: () => useOpsLog.getState().alarms.filter((a) => a.status === 'Active').length,
    },
    'ops.openTickets': {
        label: 'Open Tickets (ops log)', page: 'ops', provenance: 'input',
        formulaTemplate: 'number of tickets with status ≠ Closed in the ops log (user-entered; EXAMPLE seed in Plan Mode)',
        get: () => useOpsLog.getState().tickets.filter((t) => t.status !== 'Closed').length,
    },
    'ops.pmCompliancePct': {
        label: 'PM Compliance', page: 'ops', unit: '%', provenance: 'input',
        formulaTemplate: 'logged PM weeks ÷ 52 × 100 (cap 100%) — null when no weeks are logged yet',
        get: () => { const w = useOpsLog.getState().completedPmWeeks.length; return w > 0 ? Math.min(100, Math.round((w / 52) * 100)) : null; },
    },

    /* ops derived */
    'ops.pueAtLoad': {
        label: 'PUE (at load)', page: 'ops', unit: 'ratio', provenance: 'derived',
        formulaTemplate: 'models.pue.partialLoadPUE(engine.pueMatrix, ops.occupancyPct)',
        deps: ['engine.pueMatrix', 'ops.occupancyPct'],
        get: () => opsPueAtLoad(),
    },
    'ops.activeItMw': {
        label: 'Active IT Load', page: 'ops', unit: 'MW', provenance: 'derived',
        formulaTemplate: 'sim.itLoad ÷ 1000 × ops.occupancyPct ÷ 100',
        deps: ['sim.itLoad', 'ops.occupancyPct'],
        get: () => { const o = opsOccFrac(); return o == null ? null : +((sim().inputs.itLoad / 1000) * o).toFixed(1); },
    },

    /* dashboard chains */
    'rel.systemAvailability': {
        label: 'System Availability (β common-cause)', page: 'reliability', unit: '%', provenance: 'engine',
        formulaTemplate: 'availabilityChain.ccOverall — RBD chain + β=5% common-cause (same as the Reliability page; fake-100% fix 2026-07-20) × 100',
        get: () => {
            try {
                const m = (rzModels() as { reliability?: unknown }).reliability;
                const rd = (rzData() as { reliability?: { components?: Record<string, { mtbf: number; mttr: number; label: string }>; redundancyPaths?: Record<string, number> } }).reliability;
                if (!m || !rd?.components) return null;
                const paths = rd.redundancyPaths?.[redKeyLive()] ?? 2;
                const av = ccOverall(m as never, rd.components, 1, paths);
                return +(av * 100).toFixed(5);
            } catch { return null; }
        },
    },
    'sus.wue': {
        label: 'WUE (Water Usage Effectiveness)', page: 'carbon', unit: 'L/kWh', provenance: 'engine',
        formulaTemplate: 'models.water.wue(selected cooling type) — water intensity per IT kWh',
        external: { href: '/glossary.html#wue', label: 'Glossary: WUE' },
        get: () => {
            try {
                const m = (rzModels() as { water?: { wue?: (c: string) => number } }).water;
                const v = m?.wue?.(sim().inputs.coolingType);
                return v != null ? +v.toFixed(2) : null;
            } catch { return null; }
        },
    },
    'sus.cue': {
        label: 'CUE (Carbon Usage Effectiveness)', page: 'carbon', unit: 'kgCO₂/kWh', provenance: 'derived',
        formulaTemplate: 'annual emissions (models.carbon.annualTonnes from sim.itLoad, design PUE, country grid) ÷ annual facility energy',
        deps: ['sim.itLoad'],
        get: () => {
            try {
                const m = (rzModels() as { carbon?: { annualTonnes?: (mw: number, pue: number, region: string) => number } }).carbon;
                if (!m?.annualTonnes) return null;
                const i = sim().inputs; const itMw = i.itLoad / 1000; const pue = getPUE(i.coolingType);
                const t = m.annualTonnes(itMw, pue, sim().selectedCountry?.id || 'US');
                const facilityMwh = itMw * 1000 * pue * 8760 / 1000;
                return facilityMwh > 0 ? +(t * 1000 / (facilityMwh * 1000)).toFixed(3) : null;
            } catch { return null; }
        },
    },
    'opex.dashboardAnnual': {
        label: 'Total OPEX / yr (dashboard basis)', page: 'finance', unit: '$', provenance: 'engine',
        formulaTemplate: 'models.opex.totalAnnual(sim.itLoad in MW, design PUE, country, manual headcount) — DC-contract basis at 100% util',
        deps: ['sim.itLoad'],
        get: () => dashOpexAnnual(),
    },
    'fin.lcc15': {
        label: 'LCC 15 yr (TCO discounted 10%)', page: 'finance', unit: '$', provenance: 'derived',
        formulaTemplate: 'models.tco.lifecycleNPV(capex.total, opex.dashboardAnnual, 15 yr, 10% discount) — discounted TCO including the refresh cycle (parity-fix: the engine fn is named lifecycleNPV, not totalCost)',
        deps: ['capex.total', 'opex.dashboardAnnual'],
        get: () => {
            try {
                const m = (rzModels() as { tco?: { totalCost?: (c: number, o: number, y: number, r: number) => number; lifecycleNPV?: (c: number, o: number, y: number, opts?: Record<string, unknown>) => number } }).tco;
                const c = cap().results?.total; const o = dashOpexAnnual();
                if (!c || !o) return null;
                if (m?.totalCost) return Math.round(m.totalCost(c, o, 15, 0.10));
                if (m?.lifecycleNPV) return Math.round(m.lifecycleNPV(c, o, 15, { discountRate: 0.10 }));
                return null;
            } catch { return null; }
        },
    },
    'fin.ebitdaY5': {
        label: 'EBITDA (year 5)', page: 'finance', unit: '$', provenance: 'derived',
        formulaTemplate: '15-yr DCF: revenue (sim.itLoad × sim.revenuePerKwMonth live basis (default $150/kW·mo) × occupancy ramp, 3% escalation) − opex.dashboardAnnual — year-5 EBITDA; initial capital capex.total',
        deps: ['capex.total', 'opex.dashboardAnnual', 'sim.itLoad'],
        get: () => { const cf = dashFinancial()?.cashflows?.[4]; return cf ? Math.round(cf.ebitda) : null; },
    },
    'fin.irrProject': {
        label: 'IRR (15-yr project)', page: 'finance', unit: '%', provenance: 'derived',
        formulaTemplate: 'IRR of 15-yr DCF cashflow — year-0 = −capex.total; annual flow = illustrative revenue sim.itLoad − opex.dashboardAnnual − tax',
        deps: ['capex.total', 'opex.dashboardAnnual', 'sim.itLoad'],
        /* null when the DCF never turns cash-positive (npv<0 AND irr≤0) — mirrors
         * the Executive card's honest "n/a": no positive root, no fabricated 0%. */
        get: () => { const f = dashFinancial(); if (!f) return null; return (f.npv < 0 && f.irr <= 0) ? null : +f.irr.toFixed(1); },
    },
    'capex.racks': {
        label: 'Rack Count (CAPEX metrics)', page: 'capex', provenance: 'derived',
        formulaTemplate: 'ceil(sim.itLoad ÷ kW/rack of the CAPEX rack class — standard 6 · medium 12.5 · high 25 · extreme 75)',
        deps: ['sim.itLoad'],
        get: () => cap().results?.metrics?.racks ?? null,
    },
    'capex.rackDensity': {
        label: 'Rack Density (implied)', page: 'capex', unit: 'kW/rack', provenance: 'derived',
        formulaTemplate: 'sim.itLoad ÷ capex.racks',
        deps: ['sim.itLoad', 'capex.racks'],
        get: () => { const r = cap().results?.metrics?.racks; return r ? +(sim().inputs.itLoad / r).toFixed(1) : null; },
    },

    /* capex risk band (AACE Class 4, deterministic asymmetric normal) */
    'capex.p10': {
        label: 'CAPEX P10 (Optimistic)', page: 'capex', unit: '$', provenance: 'derived',
        formulaTemplate: 'lower bound of the AACE Class 4 band (−30%): models.capex.accuracyRange(capex.total).low',
        deps: ['capex.total'],
        get: () => capexBandLive()?.p10 ?? null,
    },
    'capex.p80': {
        label: 'CAPEX P80 (Risk-Adjusted)', page: 'capex', unit: '$', provenance: 'derived',
        formulaTemplate: 'capex.total + 0.8416 × σ_high; σ_high = (AACE Class 4 upper bound (+50%) − capex.total) ÷ 1.2816',
        deps: ['capex.total'],
        get: () => capexBandLive()?.p80 ?? null,
    },
    'capex.p90': {
        label: 'CAPEX P90 (Conservative)', page: 'capex', unit: '$', provenance: 'derived',
        formulaTemplate: 'upper bound of the AACE Class 4 band (+50%): models.capex.accuracyRange(capex.total).high',
        deps: ['capex.total'],
        get: () => capexBandLive()?.p90 ?? null,
    },
    'capex.contingency': {
        label: 'Contingency (CAPEX)', page: 'capex', unit: '$', provenance: 'derived',
        formulaTemplate: 'CAPEX subtotal before contingency × capex.contingencyPct ÷ 100 (CapexEngine)',
        deps: ['capex.contingencyPct'],
        get: () => cap().results?.contingency ?? null,
    },

    /* capacity planning (mirror CapacityPlanningPage adapter wiring exactly) */
    'cap.peakForecastMw': {
        label: 'Peak Forecast (growth plan)', page: 'capacity', unit: 'MW', provenance: 'derived',
        formulaTemplate: 'max forecast MW over a 10-yr horizon — Requirements growth plan (Y1–Y5, Y10) + geometric interpolation; Y0 basis = sim.itLoad',
        deps: ['sim.itLoad'],
        get: () => capPlanModel()?.peak ?? null,
    },
    'cap.powerCapacityMva': {
        label: 'Power Capacity (design)', page: 'capacity', unit: 'MVA', provenance: 'derived',
        formulaTemplate: 'arch.facilityMw × (1 + req.designMarginPct ÷ 100) ÷ 0.9 (power factor)',
        deps: ['arch.facilityMw', 'req.designMarginPct'],
        get: () => capUtilRow('power')?.capacity ?? null,
    },
    'cap.coolingCapacityMw': {
        label: 'Cooling Capacity (design)', page: 'capacity', unit: 'MW', provenance: 'derived',
        formulaTemplate: '(arch.facilityMw − sim.itLoad ÷ 1000) × (1 + req.designMarginPct ÷ 100) + sim.itLoad ÷ 1000',
        deps: ['arch.facilityMw', 'sim.itLoad', 'req.designMarginPct'],
        get: () => capUtilRow('cooling')?.capacity ?? null,
    },
    'cap.rackCapacity': {
        label: 'Rack Capacity (design)', page: 'capacity', unit: 'racks', provenance: 'derived',
        formulaTemplate: 'max(ceil(sim.itLoad ÷ req.rackDensityKw), max racks by space — models.capacity.bindingConstraint(white space))',
        deps: ['sim.itLoad', 'req.rackDensityKw'],
        get: () => capUtilRow('rack')?.capacity ?? null,
    },

    /* architecture BOM (engine equipScale — same call as arch-adapter computeEquipCounts) */
    'arch.racks': {
        label: 'Racks (BOM)', page: 'architecture', provenance: 'derived',
        formulaTemplate: 'ceil(sim.itLoad ÷ req.rackDensityKw)',
        deps: ['sim.itLoad', 'req.rackDensityKw'],
        get: () => Math.ceil(sim().inputs.itLoad / Math.max(1, req().workload.avgRackDensityKw || 12)),
    },
    'arch.eqSwitchgear': {
        label: 'MV Switchgear (BOM)', page: 'architecture', provenance: 'engine',
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, rack density bucket) — number of MV switchgear lineups',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.switchgear ?? null,
    },
    'arch.eqTransformers': {
        label: 'Transformers (BOM)', page: 'architecture', provenance: 'engine',
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, rack density bucket) — number of transformers',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.transformers ?? null,
    },
    'arch.eqGenerators': {
        label: 'Generators (BOM)', page: 'architecture', provenance: 'engine',
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, rack density bucket) — number of gensets',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.generators ?? null,
    },
    'arch.eqUps': {
        label: 'UPS Modules (BOM)', page: 'architecture', provenance: 'engine',
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, rack density bucket) — number of UPS modules',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.ups_modules ?? null,
    },
    'arch.eqPdus': {
        label: 'PDUs (BOM)', page: 'architecture', provenance: 'engine',
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, rack density bucket) — number of PDUs',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.pdus ?? null,
    },
    'arch.eqChillers': {
        label: 'Chillers (BOM)', page: 'architecture', provenance: 'engine',
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, rack density bucket) — number of chillers',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.chillers ?? null,
    },

    /* ── EB-finsus wave: FINANCIAL page KPIs (append-only) ────────────────────
     * Mirrors FinancialPage model memo EXACTLY (helpers at file bottom):
     * budget = REVISED (baseline + approved change orders), EVM run on the
     * revised budget as on the page. All null-safe. */
    'fin.revisedBudget': {
        label: 'Revised Budget', page: 'finance', unit: '$', provenance: 'derived',
        formulaTemplate: 'capex.total + Σ approved revisions (financialTracking change orders — amountFrac × baseline)',
        deps: ['capex.total'],
        get: () => finRevisedBudget(),
    },
    'fin.committed': {
        label: 'Total Committed', page: 'finance', unit: '$', provenance: 'derived',
        formulaTemplate: 'Σ financialTracking ledger transactions with status committed/approved/paid — amountFrac × capex.total',
        deps: ['capex.total'],
        get: () => finLedgerSum(['committed', 'approved', 'paid']),
    },
    'fin.paid': {
        label: 'Total Actual (Paid)', page: 'finance', unit: '$', provenance: 'derived',
        formulaTemplate: 'Σ financialTracking ledger transactions with status paid — amountFrac × capex.total',
        deps: ['capex.total'],
        get: () => finLedgerSum(['paid']),
    },
    'fin.fac': {
        label: 'Forecast at Completion (FAC)', page: 'finance', unit: '$', provenance: 'derived',
        formulaTemplate: 'AC + (fin.revisedBudget − EV) ÷ clamp(constr.cpi, ≥0.5) — Plan Mode: FAC ≡ fin.revisedBudget',
        deps: ['fin.revisedBudget', 'constr.cpi'],
        get: () => finFacLive(),
    },
    'fin.healthScore': {
        label: 'Financial Health Score', page: 'finance', unit: '/100', provenance: 'derived',
        formulaTemplate: '100 × (0.3 × budget variance score (1 − |fin.fac − fin.revisedBudget| ÷ fin.revisedBudget × 5) + 0.35 × min(1, constr.cpi) + 0.35 × min(1, constr.spi)) — documented composite',
        deps: ['fin.fac', 'fin.revisedBudget', 'constr.cpi', 'constr.spi'],
        get: () => finHealthLive(),
    },

    /* ── EB-finsus wave: SUSTAINABILITY page KPIs + Environmental Costs ───────
     * Mirrors SustainabilityEnginePage model + env memos EXACTLY (env memo
     * :68-115 — country-auto rates; water basis municipal = page default). */
    'sus.energyMonthlyMwh': {
        label: 'Energy (Month)', page: 'carbon', unit: 'MWh', provenance: 'derived',
        formulaTemplate: 'sim.itLoad ÷ 1000 × engine.pueMatrix × 730 hours',
        deps: ['sim.itLoad', 'engine.pueMatrix'],
        get: () => { const p = susPueLive(); return p == null ? null : Math.round((sim().inputs.itLoad / 1000) * p * 730); },
    },
    'sus.waterAnnualM3': {
        label: 'Water (Annual)', page: 'carbon', unit: 'm³', provenance: 'engine',
        formulaTemplate: 'models.water.annualM3(sim.itLoad in MW, cooling type) — sus.wue × annual IT kWh',
        deps: ['sim.itLoad', 'sus.wue'],
        get: () => susWaterM3(),
    },
    'sus.renewablePct': {
        label: 'Renewable Energy Share', page: 'carbon', unit: '%', provenance: 'derived',
        formulaTemplate: 'on-site from CAPEX renewable input (solar+BESS 25% · solar 15%) + off-site PPA from green cert (silver 10% · gold 20% · platinum 35%) — labeled derivation',
        get: () => susRenewablePct(),
    },
    'sus.overallScore': {
        label: 'Sustainability Score (composite)', page: 'carbon', unit: '/100', provenance: 'derived',
        formulaTemplate: 'average of 4 documented scores: energy (engine.pueMatrix band 1.10–1.60) + carbon (country grid intensity × grid share from sus.renewablePct) + water (sus.wue band 0–2.2) + waste (diversion slider, default 60)',
        deps: ['engine.pueMatrix', 'sus.renewablePct', 'sus.wue'],
        get: () => susOverallScore(),
    },
    /* ── Workstream M (ScoreValue adoption sweep): sustainability pillar
     * scores — ADDITIVE. Each get() mirrors ONE pillar of the page scorecard
     * EXACTLY (same formulas as susOverallScore / SustainabilityEnginePage
     * model memo — energy/carbon/water bands + attested waste diversion). */
    'sus.energyScore': {
        label: 'Energy Efficiency Score (PUE band)', page: 'carbon', unit: '/100', provenance: 'derived',
        formulaTemplate: 'clamp((1.60 − engine.pueMatrix) ÷ 0.50 × 100, 0–100) — design PUE position on the 1.10–1.60 band',
        deps: ['engine.pueMatrix'],
        get: () => susPillarScores()?.energy ?? null,
    },
    'sus.carbonScore': {
        label: 'Carbon Management Score (grid × mix)', page: 'carbon', unit: '/100', provenance: 'derived',
        formulaTemplate: 'clamp((0.9 − country grid carbon intensity × grid share) ÷ 0.9 × 100, 0–100); grid share = 100 − sus.renewablePct',
        deps: ['sus.renewablePct'],
        get: () => susPillarScores()?.carbon ?? null,
    },
    'sus.waterScore': {
        label: 'Water Stewardship Score (WUE band)', page: 'carbon', unit: '/100', provenance: 'derived',
        formulaTemplate: 'clamp((2.2 − sus.wue) ÷ 2.2 × 100, 0–100) — engine WUE position on the 0–2.2 L/kWh band',
        deps: ['sus.wue'],
        get: () => susPillarScores()?.water ?? null,
    },
    'sus.wasteScore': {
        label: 'Waste Management Score (diversion)', page: 'carbon', unit: '/100', provenance: 'input',
        formulaTemplate: 'attested waste-diversion % (page slider) — user input, not an engine derivation; null until set (the overall composite falls back to a screening default of 60)',
        get: () => susPillarScores()?.waste ?? null,
    },
    'sus.waterCost': {
        label: 'Water Cost /yr', page: 'carbon', unit: '$/yr', provenance: 'derived',
        formulaTemplate: 'sus.waterAnnualM3 × climate multiplier (country ASHRAE zone → DATA.waterFootprint.climateMult) → kgal × $/kgal (municipal basis — the page dropdown can pick another source); deep-sea ON → $0 (seawater basis, no potable draw)',
        deps: ['sus.waterAnnualM3'],
        get: () => susEnvLive()?.waterCost ?? null,
    },
    'sus.carbonCost': {
        label: 'Carbon Cost /yr', page: 'carbon', unit: '$/yr', provenance: 'derived',
        formulaTemplate: 'scope-2 tCO₂e (models.carbon.scopes from sim.itLoad & engine.pueMatrix, country grid) × country carbon price (compliance DATA.envCosts.carbonPriceUsdPerT; fallback voluntary offset)',
        deps: ['sim.itLoad', 'engine.pueMatrix'],
        get: () => susEnvLive()?.carbonCost ?? null,
    },
    'sus.wasteCost': {
        label: 'Waste Mgmt Cost /yr', page: 'carbon', unit: '$/yr', provenance: 'derived',
        formulaTemplate: '(general tonnage per MW-IT × developed/emerging rate band + e-waste kg per MW-IT × $/kg — DATA.envCosts.wasteMgmt) × sim.itLoad ÷ 1000',
        deps: ['sim.itLoad'],
        get: () => susEnvLive()?.wasteCost ?? null,
    },
    'sus.envTotal': {
        label: 'Total Environmental Cost /yr', page: 'carbon', unit: '$/yr', provenance: 'derived',
        formulaTemplate: 'sus.waterCost + sus.carbonCost + sus.wasteCost — rates auto-switch per country',
        deps: ['sus.waterCost', 'sus.carbonCost', 'sus.wasteCost'],
        get: () => { const e = susEnvLive(); return e ? Math.round(e.waterCost + e.carbonCost + e.wasteCost) : null; },
    },

    /* ── EB-cov100 wave (append-only): remaining KPIs Dashboard / Reliability /
     * Architecture BOM / Staffing — each get() MIRRORS the owning surface exactly
     * (ReliabilityEnginePage memo · CapexEngine.computeTimeline · equipScale ·
     * StaffingDashboard results/efficiency memo). All null-safe. ───────────── */

    /* RELIABILITY page KPIs (β=5% common-cause screening chain — page) */
    'rel.composedAvailability': {
        label: 'Composed Availability (β-adjusted)', page: 'reliability', unit: '%', provenance: 'derived',
        formulaTemplate: 'RBD series of 5 systems (power dist (swgr·pdu) · UPS · genset · chiller · CRAC) in parallel per the selected redundancy paths, blended β=5% common-cause with the single-path chain — MTBF/MTTR components IEEE-493 (DATA.reliability.components); β = screening assumption',
        deps: ['rel.mttrAvg'],
        get: () => { const r = relPageModel(); return r ? +(r.overall * 100).toFixed(4) : null; },
    },
    'rel.downtimeMin': {
        label: 'Downtime Unplanned /yr', page: 'reliability', unit: 'min/yr', provenance: 'derived',
        formulaTemplate: '(1 − rel.composedAvailability ÷ 100) × 525,960 minutes/year',
        deps: ['rel.composedAvailability'],
        get: () => { const r = relPageModel(); return r ? +r.downtimeMin.toFixed(1) : null; },
    },
    'rel.mtbfComposite': {
        label: 'MTBF (series composite)', page: 'reliability', unit: 'h', provenance: 'engine', sourceKey: 'reliability',
        formulaTemplate: '1 ÷ Σ(1/component MTBF) — series composite of 6 IEEE-493 component classes (ignores redundancy; screening)',
        get: () => relPageModel()?.mtbfAll ?? null,
    },
    'rel.mttrAvg': {
        label: 'MTTR (component average)', page: 'reliability', unit: 'h', provenance: 'engine', sourceKey: 'reliability',
        formulaTemplate: 'average MTTR of 6 component classes (DATA.reliability.components — IEEE-493)',
        get: () => relPageModel()?.mttrAvg ?? null,
    },
    'rel.score': {
        label: 'Reliability Score', page: 'reliability', unit: '/100', provenance: 'derived',
        formulaTemplate: '40 × availability margin (rel.composedAvailability position vs rel.tierTarget) + 30 × min(1, paths ÷ 2) + 15 × maintainability (rel.mttrAvg ≤ 12 h) + 15 × SPOF factor — documented page composite',
        deps: ['rel.composedAvailability', 'rel.tierTarget', 'rel.mttrAvg'],
        get: () => relPageModel()?.score ?? null,
    },

    /* DASHBOARD Schedule & Milestones — CPM phase durations (CapexEngine.computeTimeline) */
    'constr.phaseDesignMo': {
        label: 'Design & Engineering (duration)', page: 'construction', unit: 'mo', provenance: 'engine',
        formulaTemplate: 'CPM engine: base design duration per redundancy (N 4 · N+1 5 · 2N 6 · 2N+1 7 mo) — CapexEngine.computeTimeline',
        get: () => phaseDurMo('Design & Engineering'),
    },
    'constr.phasePermitMo': {
        label: 'Permitting (duration)', page: 'construction', unit: 'mo', provenance: 'engine',
        formulaTemplate: 'CPM engine: base permit (3–4 mo per redundancy) × regional multiplier 1.4 (SEA/India/China/Japan/Australia) — CapexEngine.computeTimeline',
        get: () => phaseDurMo('Permitting'),
    },
    'constr.phaseCivilMo': {
        label: 'Civil Construction (duration)', page: 'construction', unit: 'mo', provenance: 'engine',
        formulaTemplate: 'CPM engine: base civil (8–14 mo per redundancy) × building-type multiplier (warehouse 0.7 · modular 0.6 · highrise 1.4) — CapexEngine.computeTimeline',
        get: () => phaseDurMo('Civil Construction'),
    },
    'constr.phaseMepMo': {
        label: 'MEP Installation (duration)', page: 'construction', unit: 'mo', provenance: 'engine',
        formulaTemplate: 'CPM engine: base MEP (6–12 mo per redundancy) × cooling multiplier (liquid 1.3) — CapexEngine.computeTimeline',
        get: () => phaseDurMo('MEP Installation'),
    },
    'constr.phaseCxMo': {
        label: 'Commissioning (duration)', page: 'construction', unit: 'mo', provenance: 'engine',
        formulaTemplate: 'CPM engine: base commissioning per redundancy (N 2 · N+1 3 · 2N 4 · 2N+1 5 mo) — CapexEngine.computeTimeline',
        get: () => phaseDurMo('Commissioning'),
    },

    /* ARCHITECTURE BOM — remaining equipment classes (engine equipScale, same as arch.eq*) */
    'arch.eqSts': {
        label: 'STS (BOM)', page: 'architecture', provenance: 'engine',
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, rack density bucket) — number of static transfer switches',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.sts ?? null,
    },
    'arch.eqPumps': {
        label: 'Pumps / CDU (BOM)', page: 'architecture', provenance: 'engine',
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, rack density bucket) — number of pumps / CDUs',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.pumps ?? null,
    },
    'arch.eqCoolingUnits': {
        label: 'Cooling Units (BOM)', page: 'architecture', provenance: 'engine',
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, rack density bucket) — number of CRAC/CRAH units',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.cooling_units ?? null,
    },
    'arch.eqAhu': {
        label: 'AHU (BOM)', page: 'architecture', provenance: 'engine',
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, rack density bucket) — number of air handling units',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.ahu ?? null,
    },
    'arch.eqFireZones': {
        label: 'Fire Zones (BOM)', page: 'architecture', provenance: 'engine',
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, rack density bucket) — number of fire suppression zones',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.fireZones ?? null,
    },

    /* STAFFING page KPIs + Efficiency Metrics (mirror StaffingDashboard memo) */
    'staff.weeklyHours': {
        label: 'Avg Weekly Hours (effective)', page: 'staff', unit: 'h/wk', provenance: 'derived',
        formulaTemplate: 'property of the selected shift pattern: 8h Continental = 42 effective hours (incl. 1.5h OT handover) · 12h 4-on/3-off = 40 hours (zero OT)',
        get: () => (sim().inputs.shiftModel === '8h' ? 42 : 40),
    },
    'staff.tco5yr': {
        label: '5-Year Staffing TCO (cumulative)', page: 'staff', unit: '$', provenance: 'derived',
        formulaTemplate: 'Σ years 0–5: staff.monthlyCost × 12 × (1 + country wage escalation)^year — 6 projection points ShiftEngine generate5YearProjection',
        deps: ['staff.monthlyCost'],
        get: () => staffTco5yr(),
    },
    'staff.utilizationPct': {
        label: 'Utilization Rate', page: 'staff', unit: '%', provenance: 'engine',
        formulaTemplate: '(1 − country shrinkage factor (DATA labor — break/training/leave)) × 100',
        get: () => { const s = staffShrinkage(); return s == null ? null : +((1 - s) * 100).toFixed(0); },
    },
    'staff.costPerMw': {
        label: 'Cost per MW', page: 'staff', unit: '$/MW/mo', provenance: 'derived',
        formulaTemplate: 'staff.monthlyCost ÷ max(0.5, sim.itLoad ÷ 1000) — monthly payroll per MW IT (fixed 2026-07-20; previously the display divided by 1)',
        deps: ['staff.monthlyCost', 'sim.itLoad'],
        get: () => {
            const p = staffCostParts();
            const kw = useSimulationStore.getState().inputs.itLoad || 0;
            return p ? Math.round(p.total / Math.max(0.5, kw / 1000)) : null;
        },
    },
    'staff.otRatioPct': {
        label: 'OT Ratio', page: 'staff', unit: '%', provenance: 'derived',
        formulaTemplate: 'Σ overtime component per role (ShiftEngine breakdown) ÷ staff.monthlyCost × 100',
        deps: ['staff.monthlyCost'],
        get: () => { const p = staffCostParts(); return p && p.total > 0 ? +((p.ot / p.total) * 100).toFixed(1) : p ? 0 : null; },
    },
    'staff.shrinkageLoss': {
        label: 'Shrinkage Loss /mo', page: 'staff', unit: '$/mo', provenance: 'derived',
        formulaTemplate: 'staff.monthlyCost × country shrinkage factor (staff.utilizationPct = 100% − factor)',
        deps: ['staff.monthlyCost', 'staff.utilizationPct'],
        get: () => {
            const p = staffCostParts(); const s = staffShrinkage();
            return p && s != null ? Math.round(p.total * s) : null;
        },
    },

    /* ── EB-walk4 wave (append-only): KPI ƒx Maintenance / Investment /
     * Phased Financial / Asset Intelligence — pages at 0-coverage on the walk
     * probe. Each get() MIRRORS the owning page's model chain exactly; when a KPI
     * depends on page-LOCAL state (pencil-mode / parameter panel / slider),
     * the trace uses the page defaults — documented per node. ─────────────── */

    /* MAINTENANCE page KPI row (fleet auto-generated from the design; pencil-mode
     * manual counts are page-local state — trace basis is the auto-generated fleet) */
    'maint.plannedHours': {
        label: 'Planned Maintenance Hours /yr', page: 'maint', unit: 'h', provenance: 'derived',
        formulaTemplate: 'Σ SFG20 schedule event durations (standard hours per task × units per batch) — schedule from auto-generated fleet (sim.itLoad, sim.tierLevel, cooling, redundancy)',
        deps: ['sim.itLoad', 'sim.tierLevel'],
        get: () => maintModel()?.hours ?? null,
    },
    'maint.events': {
        label: 'Maintenance Events /yr', page: 'maint', provenance: 'derived',
        formulaTemplate: 'number of SFG20 schedule events per year — regime per asset class × fleet unit count (auto-generated from sim.itLoad; manual pencil-mode edits are not reflected in the trace)',
        deps: ['sim.itLoad'],
        get: () => maintModel()?.events ?? null,
    },
    'maint.activeAssets': {
        label: 'Active Assets (fleet)', page: 'maint', provenance: 'derived',
        formulaTemplate: 'Σ units per asset class — AssetGenerator scale-aware (CRAC/CRAH/fan-wall block per MW scale, chiller, genset, UPS, etc.) from sim.itLoad, sim.tierLevel, cooling topology, power redundancy',
        deps: ['sim.itLoad', 'sim.tierLevel'],
        get: () => maintModel()?.units ?? null,
    },
    'maint.annualBudget': {
        label: 'Annual Maintenance Budget (selected strategy)', page: 'maint', unit: '$', provenance: 'derived',
        formulaTemplate: 'selected strategy (reactive/planned/predictive): labor (maint.plannedHours × country labor rate × in-house/hybrid/vendor model multiplier) + parts + downtime risk — MaintenanceStrategyEngine, sourced DATA.maintenance economics',
        deps: ['maint.plannedHours'],
        get: () => maintModel()?.annualBudget ?? null,
    },
    'maint.fiveYearSavings': {
        label: '5-Year Savings (optimal vs worst)', page: 'maint', unit: '$', provenance: 'derived',
        formulaTemplate: '5-yr NPV of the worst strategy − 5-yr NPV of the best strategy (8% discount, 3% cost escalation; CBM adds sensor CAPEX) — labor cost of each strategy from maint.plannedHours; 3-strategy comparison MaintenanceStrategyEngine',
        deps: ['maint.plannedHours'],
        get: () => maintModel()?.fiveYearSavings ?? null,
    },

    /* INVESTMENT page KPI rows (trace basis: page parameter panel at DEFAULT
     * values — debt 65% · cost of debt 5% · term 12 yr · CoE 12% · exit yr-7
     * @18× EBITDA · rev $150/kW·mo · tax 25% · life 10 yr; change the sliders on
     * the page for other scenarios — local state, not reflected in the trace) */
    'inv.totalDebt': {
        label: 'Debt Amount', page: 'invest', unit: '$', provenance: 'derived',
        formulaTemplate: 'capex.total × debt ratio (trace basis: default 65%)',
        deps: ['capex.total'],
        get: () => { const m = invModel(); return m ? Math.round(m.totalDebt) : null; },
    },
    'inv.totalEquity': {
        label: 'Equity Required', page: 'invest', unit: '$', provenance: 'derived',
        formulaTemplate: 'capex.total × (1 − debt ratio) (trace basis: default 35% equity)',
        deps: ['capex.total'],
        get: () => { const m = invModel(); return m ? Math.round(m.totalEquity) : null; },
    },
    'inv.wacc': {
        label: 'WACC', page: 'invest', unit: '%', provenance: 'derived',
        formulaTemplate: 'debt ratio × cost of debt × (1 − tax) + equity ratio × cost of equity — trace basis default: 65% × 5% × 75% + 35% × 12%',
        get: () => { const m = invModel(); return m ? +(m.wacc * 100).toFixed(1) : null; },
    },
    'inv.equityIrr': {
        label: 'Equity IRR (levered)', page: 'invest', unit: '%', provenance: 'derived',
        formulaTemplate: 'IRR of equity cashflow: year-0 −inv.totalEquity; annual = unlevered FCF (revenue sim.itLoad × $150/kW·mo × occupancy ramp − OPEX − tax; depreciation from capex.total) − debt service; + exit yr-7 @18× EBITDA − remaining debt',
        deps: ['inv.totalEquity', 'sim.itLoad', 'capex.total'],
        get: () => { const m = invModel(); return m ? +m.equityIRR.toFixed(1) : null; },
    },
    'inv.moic': {
        label: 'MOIC', page: 'invest', unit: 'x', provenance: 'derived',
        formulaTemplate: '(Σ levered FCF distributions + equity value at exit) ÷ inv.totalEquity',
        deps: ['inv.totalEquity'],
        get: () => { const m = invModel(); return m && Number.isFinite(m.moic) ? +m.moic.toFixed(2) : null; },
    },
    'inv.minDscr': {
        label: 'Min DSCR', page: 'invest', unit: 'x', provenance: 'derived',
        formulaTemplate: 'annual min (EBITDA ÷ debt service) over the debt tenor — annuity debt service from inv.totalDebt @5%, 12 yr; typical lender covenant 1.25x',
        deps: ['inv.totalDebt'],
        get: () => { const m = invModel(); return m && Number.isFinite(m.minDSCR) ? +m.minDSCR.toFixed(2) : null; },
    },
    'inv.year1CoC': {
        label: 'Y1 Cash-on-Cash', page: 'invest', unit: '%', provenance: 'derived',
        formulaTemplate: 'year-1 levered FCF ÷ inv.totalEquity × 100',
        deps: ['inv.totalEquity'],
        get: () => { const m = invModel(); return m ? +m.year1CashOnCash.toFixed(1) : null; },
    },

    /* PHASED FINANCE page KPI row (mirrors the page memo: capacity plan per phase →
     * cross-module adjustment (disaster/grid/talent) → calculateFinancials per
     * phase 20 yr → CAPEX-weighted blended aggregation) */
    'pf.totalCapex': {
        label: 'Total Investment (Σ phases)', page: 'phased-finance', unit: '$', provenance: 'derived',
        formulaTemplate: 'Σ phase CAPEX — CapacityPlanningEngine (base $/kW × tier mult (sim.tierLevel) × cooling mult × country construction index × phase kW) + per-phase allocation of the disaster-risk structural adder',
        deps: ['sim.tierLevel'],
        get: () => pfModel()?.capex ?? null,
    },
    'pf.blendedIrr': {
        label: 'Blended IRR (weighted)', page: 'phased-finance', unit: '%', provenance: 'derived',
        formulaTemplate: 'Σ phase IRR × (phase CAPEX ÷ pf.totalCapex) — per-phase IRR from a 20-yr DCF: rev $150/kW·mo × phase occupancy ramp, OPEX + grid/insurance/talent adders, 10% discount + disaster-risk premium, country effective tax (incentives)',
        deps: ['pf.totalCapex'],
        get: () => pfModel()?.irr ?? null,
    },
    'pf.totalNpv': {
        label: 'Total NPV (Σ phases)', page: 'phased-finance', unit: '$', provenance: 'derived',
        formulaTemplate: 'Σ phase NPV at a risk-adjusted discount rate (10% + 0–2% premium per country disaster-risk composite score) — 20-yr DCF per phase; capital = pf.totalCapex allocation',
        deps: ['pf.totalCapex'],
        get: () => pfModel()?.npv ?? null,
    },
    'pf.payback': {
        label: 'Payback (weighted)', page: 'phased-finance', unit: 'yr', provenance: 'derived',
        formulaTemplate: 'Σ phase payback × (phase CAPEX ÷ pf.totalCapex) — simple payback per phase from cumulative FCF',
        deps: ['pf.totalCapex'],
        get: () => pfModel()?.payback ?? null,
    },
    'pf.pi': {
        label: 'Profitability Index', page: 'phased-finance', unit: 'x', provenance: 'derived',
        formulaTemplate: '(pf.totalNpv + pf.totalCapex) ÷ pf.totalCapex — PV of benefits per $ invested, clamp ≥0',
        deps: ['pf.totalNpv', 'pf.totalCapex'],
        get: () => pfModel()?.pi ?? null,
    },

    /* ASSET INTELLIGENCE page — remaining health-bucket KPIs (trace basis: age 3
     * yr · condition 85% = page slider defaults, same as asset.avgHealth) */
    'asset.healthExcellentGood': {
        label: 'Units Excellent / Good (health ≥70)', page: 'asset-health', provenance: 'derived',
        formulaTemplate: 'Σ class units with health ≥70 (subset of asset.fleetUnits) — per-class health = models.asset.healthIndex (Weibull remaining-life + condition + duty) at trace basis age 3 yr · condition 85%',
        deps: ['asset.fleetUnits'],
        get: () => assetBuckets()?.exGood ?? null,
    },
    'asset.healthFair': {
        label: 'Units Fair (health 50–69)', page: 'asset-health', provenance: 'derived',
        formulaTemplate: 'Σ class units with health 50–69 (monitor; subset of asset.fleetUnits) — models.asset.healthIndex at trace basis age 3 yr · condition 85%',
        deps: ['asset.fleetUnits'],
        get: () => assetBuckets()?.fair ?? null,
    },
    'asset.healthPoorCritical': {
        label: 'Units Poor / Critical (health <50)', page: 'asset-health', provenance: 'derived',
        formulaTemplate: 'Σ class units with health <50 (plan replacement; subset of asset.fleetUnits) — models.asset.healthIndex at trace basis age 3 yr · condition 85%',
        deps: ['asset.fleetUnits'],
        get: () => assetBuckets()?.poorCrit ?? null,
    },
    'asset.atRiskUnits': {
        label: 'Units at Wear-Out Risk (Weibull CDF ≥25%)', page: 'asset-health', provenance: 'derived',
        formulaTemplate: 'Σ class units with cumulative failure probability ≥25% (subset of asset.fleetUnits) — models.asset.failureProbability (Weibull CDF) at trace basis age 3 yr',
        deps: ['asset.fleetUnits'],
        get: () => assetBuckets()?.atRisk ?? null,
    },
};

export interface ResolvedTrace {
    id: string;
    label: string;
    page: string;
    unit?: string;
    provenance: TraceProvenance;
    value: number | null;
    /** formula with LIVE numbers substituted, e.g. "610 = 500000 × 1.22 ÷ 1000" */
    formulaLive?: string;
    sourceKey?: string;
    external?: { href: string; label: string };
    children: ResolvedTrace[];
}

const fmtV = (v: number | null): string =>
    v == null ? '—' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(0) + 'K' : String(+v.toFixed(3));

/** Resolve a trace id to its live tree, depth-limited (default: to the leaves). */
export function resolveTrace(id: string, depth = 8): ResolvedTrace | null {
    const n = TRACE[id];
    if (!n) return null;
    let value: number | null = null;
    try { value = n.get(); } catch { value = null; }
    const children = depth > 0 && n.deps ? n.deps.map((d) => resolveTrace(d, depth - 1)).filter((x): x is ResolvedTrace => !!x) : [];
    let formulaLive: string | undefined;
    if (n.formulaTemplate) {
        formulaLive = n.formulaTemplate;
        for (const c of children) formulaLive = formulaLive.split(c.id).join(`${c.label} [${fmtV(c.value)}]`);
        formulaLive = `${fmtV(value)} = ${formulaLive}`;
    }
    return { id, label: n.label, page: n.page, unit: n.unit, provenance: n.provenance, value, formulaLive, sourceKey: n.sourceKey, external: n.external, children };
}

/** All ids (for gates + Knowledge Base live-trace rendering). */
export const TRACE_IDS = Object.keys(TRACE);
export { rzModels };

/* ═══ EB-wave live-reader helpers (appended — invoked lazily by get()) ═══════
 * Mirror the OWNING page's computation exactly (StaffingDashboard /
 * ConstructionEngine / CommissioningEnginePage / ResultsEnginePage /
 * AssetIntelligencePage) so the popover number matches the rendered KPI.
 * All null-safe: any missing store/engine piece resolves to null. */

/** Effective headcounts [shiftLead, engineer, technician, admin, janitor] —
 *  mirrors useEffectiveInputs (auto mode resolves via ShiftEngine). */
function effHeadcounts(): number[] {
    const i = sim().inputs;
    let hc = [i.headcount_ShiftLead ?? 0, i.headcount_Engineer ?? 0, i.headcount_Technician ?? 0, i.headcount_Admin ?? 0, i.headcount_Janitor ?? 0];
    if (i.staffingAutoMode) {
        try {
            const auto = calculateAutoHeadcount(
                i.itLoad, i.tierLevel, i.shiftModel,
                i.staffingModel === 'outsourced' ? 'outsourced' : i.staffingModel,
                i.maintenanceModel, i.maintenanceStrategy, i.hybridRatio ?? 0.5,
            );
            hc = [auto.headcounts['shift-lead'], auto.headcounts['engineer'], auto.headcounts['technician'], auto.headcounts['admin'], auto.headcounts['janitor']];
        } catch { /* keep manual headcounts */ }
    }
    return hc;
}

/** Total monthly payroll — Σ per-role calculateStaffing, mirrors StaffingDashboard results.totalMonthlyCost. */
function staffMonthlyCost(): number | null {
    try {
        const st = sim();
        const country = st.selectedCountry;
        if (!country) return null;
        const i = st.inputs;
        const hc = effHeadcounts();
        const cfg: { role: StaffRole; qty: number; is24x7: boolean }[] = [
            { role: 'shift-lead', qty: hc[0], is24x7: true },
            { role: 'engineer', qty: hc[1], is24x7: true },
            { role: 'technician', qty: hc[2], is24x7: false },
            { role: 'admin', qty: hc[3], is24x7: false },
            { role: 'janitor', qty: hc[4], is24x7: false },
        ];
        const opModel = i.staffingModel === 'outsourced' ? 'vendor' : i.staffingModel;
        return Math.round(cfg.reduce((a, c) =>
            a + calculateStaffing(c.role, Math.max(1, c.qty), i.shiftModel, country, c.is24x7, undefined, undefined, opModel, i.hybridRatio ?? 0.5).monthlyCost, 0));
    } catch { return null; }
}

/** Construction planned schedule + EVM — mirrors ConstructionEngine page wiring. */
function constrPlan(): { sched: PlannedSchedule; e: EvmResult } | null {
    try {
        const res = cap().results;
        if (!res?.timeline) return null;
        const sched = plannedSchedule(res.timeline);
        if (!sched) return null;
        const t = useConstructionTracking.getState();
        return { sched, e: evm(sched, res.total ?? 0, t.statusMonth, t.phaseActualPct, t.acSpentUsd) };
    } catch { return null; }
}

const CX_KEYS: ReadinessKey[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'ist', 'sat', 'fat', 'punchlist'];

/** Cx completion map (checklist-derived wins over sliders) + pass/fail counts —
 *  mirrors CommissioningEnginePage checklistStats / comp. */
function cxStats(): { comp: Record<string, number>; pass: number; fail: number; anyTicks: boolean } | null {
    try {
        const t = useCxTracking.getState();
        const cool = sim().inputs.coolingType;
        const liquid = cool === 'liquid' || cool === 'rdhx';
        const comp: Record<string, number> = {};
        Object.entries(t.completion).forEach(([k, v]) => { if (v != null) comp[k] = v; });
        let pass = 0, fail = 0;
        for (const k of CX_KEYS) {
            const items = (CX_CHECKLIST[k] ?? []).flatMap((g) => g.items.filter((it) => !it.liquidOnly || liquid));
            const derived = checklistDerivedCompletion(t, k, items.length);
            if (derived != null) comp[k] = derived;
            items.forEach((it) => {
                const v = t.checklist[`${k}:${it.id}`];
                if (v === 'pass') pass++; else if (v === 'fail') fail++;
            });
        }
        return { comp, pass, fail, anyTicks: pass + fail > 0 };
    } catch { return null; }
}

const CX_TESTS_PER: Record<string, number> = { switchgear: 12, ups_modules: 4, generators: 8, chillers: 6, cooling_units: 2, pdus: 1, fireZones: 3 };

/** Tests-in-scope screening (equip × tests-per-unit; manual override wins). */
function cxTestsTotal(): number | null {
    try {
        const t = useCxTracking.getState();
        if (t.testsTotalOverride != null) return t.testsTotalOverride;
        const i = sim().inputs;
        const m = (rzModels() as { commissioning?: { programRich?: (inp: Record<string, unknown>) => { equip: Record<string, number> } | null } }).commissioning;
        const rich = m?.programRich?.({ itLoadKw: i.itLoad, coolingType: i.coolingType, powerRedundancy: i.powerRedundancy, countryId: sim().selectedCountry?.id, rackDensity: densityBucketLive() });
        if (!rich?.equip) return null;
        return Object.entries(CX_TESTS_PER).reduce((s, [k, per]) => s + (rich.equip[k] ?? 0) * per, 0);
    } catch { return null; }
}

/** Results scorecard dims — mirrors ResultsEnginePage model (same formulas & weights). */
function resultsDims(): { capexScore: number; susScore: number; finScore: number; constrScore: number; overall: number } | null {
    try {
        const i = sim().inputs;
        const country = sim().selectedCountry;
        const capexRes = cap().results;
        if (!capexRes) return null;
        const M = rzModels() as {
            requirements?: { validate?: (inp: Record<string, unknown>) => { completeness?: { pct?: number } } | null };
            architecture?: { complexity?: (inp: Record<string, unknown>) => { index: number } | null };
            roi?: { npv?: (flows: number[], r: number) => number; irr?: (flows: number[]) => number | null };
            opex?: { totalAnnual?: (...args: unknown[]) => { total: number } };
        };
        const D = rzData() as {
            commissioning?: { cx?: { rich?: { capexPerKw?: { standard?: number } } } };
            reliability?: { tierAvailability?: Record<string, number> };
            pueMatrix?: Record<string, Record<string, number>>;
            decision?: { revenuePerKwMonth?: number };
        };
        // Requirements: engine intake completeness
        let reqScore = 50;
        try {
            const v = M.requirements?.validate?.({ itLoadKw: i.itLoad, targetTier: i.tierLevel, region: country?.id, useCase: 'ai', coolingType: i.coolingType, rackKw: req().workload.avgRackDensityKw, budgetUsd: req().business.budgetUsd ?? undefined });
            reqScore = Math.round(v?.completeness?.pct ?? 50);
        } catch { /* */ }
        // Site: engine site score (best candidate)
        let siteScore = 50;
        try { siteScore = Math.round(scoreAllSites(useSitesStore.getState().sites)[0]?.engine.score ?? 50); } catch { /* */ }
        // Architecture: 100 − 0.35 × complexity index
        // All dim scores below use the SAME dimension-explain helpers + finScreening
        // the ResultsEnginePage renders with — so the trace can't drift from the card.
        let archScore = 60;
        try {
            const c = M.architecture?.complexity?.({ coolingType: i.coolingType, tier: i.tierLevel, redundancy: i.powerRedundancy === 'N+1' ? 'n1' : i.powerRedundancy === '2N' ? '2n' : '2n1' });
            if (c) archScore = archScoreOf(c.index);
        } catch { /* */ }
        // CAPEX: $/kW vs reference band (shared capexScoreOf)
        const perKw = capexRes.metrics?.perKw ?? Math.round(capexRes.total / Math.max(1, i.itLoad));
        const band = D.commissioning?.cx?.rich?.capexPerKw?.standard ?? 10500;
        const capexScore = capexScoreOf(perKw, band);
        // Construction: SPI/CPI blend (Plan Mode → 100)
        const cp = constrPlan();
        const constrScore = cp ? constrScoreOf(cp.e.spi, cp.e.cpi) : 100;
        // Ops readiness: tier availability (shared opsScoreOf)
        const tierAvail = D.reliability?.tierAvailability ?? {};
        const opsScore = opsScoreOf((tierAvail as Record<string, number>)[String(i.tierLevel)] ?? 0.9998);
        // Sustainability: PUE band 1.10–1.60 (shared susScoreOf; getPUE fallback like the page)
        const pue = D.pueMatrix?.[i.coolingType]?.['tier' + i.tierLevel] ?? getPUE(i.coolingType);
        const susScore = susScoreOf(pue);
        // Financial: IRR screening vs 10% hurdle — SAME finScreening + finScoreOf as the page
        let finScore = 60;
        try {
            const fin = finScreening(i.itLoad, pue, country?.id ?? 'US', capexRes.total);
            if (fin) finScore = finScoreOf(fin.irr);
        } catch { /* */ }
        const dims = [
            { s: reqScore, w: 0.12 }, { s: siteScore, w: 0.13 }, { s: archScore, w: 0.12 }, { s: capexScore, w: 0.13 },
            { s: constrScore, w: 0.12 }, { s: opsScore, w: 0.12 }, { s: susScore, w: 0.13 }, { s: finScore, w: 0.13 },
        ];
        const totalW = dims.reduce((s2, d) => s2 + d.w, 0);
        const overall = Math.round(dims.reduce((s2, d) => s2 + d.s * d.w, 0) / totalW);
        return { capexScore, susScore, finScore, constrScore, overall };
    } catch { return null; }
}

/** Asset fleet class map — mirrors AssetIntelligencePage CLASS_MAP (eqKey duplication intentional). */
const ASSET_CLASSES: { cls: string; eqKey: string }[] = [
    { cls: 'switchgear', eqKey: 'switchgear' }, { cls: 'transformer', eqKey: 'transformers' },
    { cls: 'generator', eqKey: 'generators' }, { cls: 'ups', eqKey: 'ups_modules' },
    { cls: 'pdu', eqKey: 'pdus' }, { cls: 'chiller', eqKey: 'chillers' },
    { cls: 'crac', eqKey: 'cooling_units' }, { cls: 'battery', eqKey: 'ups_modules' }, { cls: 'bms', eqKey: 'ahu' },
];

function assetEquip(): Record<string, number> | null {
    try {
        const m = (rzModels() as { commissioning?: { equipScale?: (inp: Record<string, unknown>) => Record<string, number> | null } }).commissioning;
        return m?.equipScale?.({ itLoad: sim().inputs.itLoad, rackDensity: densityToEngineBucket(req().workload.avgRackDensityKw) }) ?? null;
    } catch { return null; }
}

/** Unit-weighted average health at trace baseline age 3 yr / condition 85% (page defaults). */
function assetAvgHealth(): number | null {
    try {
        const eq = assetEquip();
        if (!eq) return null;
        const m = (rzModels() as { asset?: { healthIndex?: (inp: Record<string, unknown>) => { health?: number } | null } }).asset;
        if (!m?.healthIndex) return null;
        let units = 0, acc = 0;
        for (const c of ASSET_CLASSES) {
            const count = eq[c.eqKey] ?? 0;
            if (!count) continue;
            const h = Math.round(m.healthIndex({ assetClass: c.cls, ageYears: 3, condition: 0.85, duty: 0.5 })?.health ?? 0);
            units += count; acc += h * count;
        }
        return units ? Math.round(acc / units) : null;
    } catch { return null; }
}

/** 15-yr nominal replacement value across the 6 engine lifecycle classes. */
function assetReplacementValue(): number | null {
    try {
        const m = (rzModels() as { asset?: { replacementSchedule?: (c: string, kw: number, y: number) => { totalNominalUsd?: number } | null } }).asset;
        if (!m?.replacementSchedule) return null;
        const kw = sim().inputs.itLoad;
        const total = ['upsLiIon', 'generator', 'crac', 'pdu', 'bms', 'fire']
            .reduce((s, c) => s + (m.replacementSchedule?.(c, kw, 15)?.totalNominalUsd ?? 0), 0);
        return total > 0 ? Math.round(total) : null;
    } catch { return null; }
}

/* ═══ EB-cov wave live-reader helpers (appended — invoked lazily by get()) ═══
 * Mirror the OWNING page computation exactly (useDashboardData /
 * OperationsDashboard / CapacityPlanningPage / CapexEnginePage) so the popover
 * number matches the rendered KPI. All null-safe. */

const redKeyLive = (): string =>
    ({ 'N+1': 'n1', '2N': '2n', '2N+1': '2n1' } as Record<string, string>)[sim().inputs.powerRedundancy] ?? 'n1';

/** Year-1 occupancy fraction — mirrors OperationsDashboard occ (clamp 5–100%). */
function opsOccFrac(): number | null {
    try {
        const m = (rzModels() as { capacity?: { occupancyScurve?: (y: number, mkt: string) => number } }).capacity;
        if (!m?.occupancyScurve) return 0.85; // page default when engine absent
        return Math.max(0.05, Math.min(1, m.occupancyScurve(1, 'wholesale')));
    } catch { return null; }
}

/** Live PUE at partial load — mirrors OperationsDashboard livePue. */
function opsPueAtLoad(): number | null {
    try {
        const design = pueLive() ?? getPUE(sim().inputs.coolingType);
        const occ = opsOccFrac();
        if (design == null || occ == null) return null;
        const m = (rzModels() as { pue?: { partialLoadPUE?: (p: number, o: number) => number } }).pue;
        return m?.partialLoadPUE ? +m.partialLoadPUE(design, occ).toFixed(2) : +design.toFixed(2);
    } catch { return null; }
}

/** Annual OPEX on the DASHBOARD basis — mirrors useDashboardData opexAnnual
 *  (legacy positional signature: MW, design PUE, region, manual headcount). */
function dashOpexAnnual(): number | null {
    try {
        const m = (rzModels() as { opex?: { totalAnnual?: (mw: number, pue: number, region: string, hc: number) => { total?: number } | number } }).opex;
        if (!m?.totalAnnual) return null;
        const i = sim().inputs;
        const hc = (i.headcount_ShiftLead ?? 0) + (i.headcount_Engineer ?? 0) + (i.headcount_Technician ?? 0) + (i.headcount_Admin ?? 0) + (i.headcount_Janitor ?? 0);
        const r = m.totalAnnual(i.itLoad / 1000, getPUE(i.coolingType), sim().selectedCountry?.id || 'US', hc);
        const v = typeof r === 'object' ? r?.total : r;
        return v != null && Number.isFinite(v) ? Math.round(v) : null;
    } catch { return null; }
}

/** Dashboard DCF (illustrative revenue) — mirrors useDashboardData financial. */
let _finCache: { key: string; fin: FinancialResult } | null = null;
function dashFinancial(): FinancialResult | null {
    try {
        const capexTotal = cap().results?.total;
        if (!capexTotal) return null;
        const i = sim().inputs;
        const taxRate = sim().selectedCountry?.economy?.taxRate ?? 0.22;
        const annualOpex = dashOpexAnnual() ?? Math.round(capexTotal * 0.06);
        const rev = i.revenuePerKwMonth ?? DEFAULT_REVENUE_PER_KW_MONTH; // live SSOT (optimizer tunable)
        const key = [capexTotal, i.itLoad, taxRate, annualOpex, rev, (i.occupancyRamp ?? []).join(',')].join('|');
        if (_finCache?.key === key) return _finCache.fin;
        const fin = calculateFinancials({
            totalCapex: capexTotal, annualOpex, revenuePerKwMonth: rev,
            itLoadKw: i.itLoad, discountRate: 0.10, projectLifeYears: 15, escalationRate: 0.03,
            opexEscalation: 0.03, occupancyRamp: i.occupancyRamp?.length ? i.occupancyRamp : defaultOccupancyRamp(15),
            taxRate, depreciationYears: 15,
        });
        _finCache = { key, fin };
        return fin;
    } catch { return null; }
}

/** CAPEX risk band — same deterministic riskBand as CapexEnginePage. */
function capexBandLive(): { p10: number; p80: number; p90: number } | null {
    try {
        const total = cap().results?.total;
        if (!total) return null;
        const b = riskBand(total);
        return { p10: b.p10, p80: b.p80, p90: b.p90 };
    } catch { return null; }
}

/** Capacity Planning model — mirrors CapacityPlanningPage `i`/snap/util/forecast wiring. */
let _capPlanCache: { key: string; m: { peak: number; rows: UtilRow[] } } | null = null;
function capPlanModel(): { peak: number; rows: UtilRow[] } | null {
    try {
        const inp = sim().inputs;
        const r = req();
        const g = r.growth.itLoadMwByYear;
        const key = [inp.itLoad, inp.tierLevel, inp.coolingType, r.workload.avgRackDensityKw, inp.buildingSize, inp.baseYear, r.business.designMarginPct, g.y1, g.y2, g.y3, g.y4, g.y5, g.y10, inp.capacityPhases.map((p) => `${p.itLoadKw}:${p.startMonth}:${p.buildMonths}`).join(',')].join('|');
        if (_capPlanCache?.key === key) return _capPlanCache.m;
        const i = sanitizeCap({
            itLoadKw: inp.itLoad, tier: inp.tierLevel as 2 | 3 | 4, coolingType: inp.coolingType,
            rackKw: r.workload.avgRackDensityKw, whiteFloorM2: inp.buildingSize, baseYear: inp.baseYear,
            marketType: 'wholesale', phases: inp.capacityPhases, designMarginPct: r.business.designMarginPct,
            growthMwByYear: [
                { label: 'Y0 (COD)', mw: inp.itLoad / 1000 },
                { label: 'Y1', mw: g.y1 }, { label: 'Y2', mw: g.y2 }, { label: 'Y3', mw: g.y3 },
                { label: 'Y4', mw: g.y4 }, { label: 'Y5', mw: g.y5 }, { label: 'Y10', mw: g.y10 },
            ],
        });
        const snap = facilitySnapshot(i);
        const util = utilization(i, snap.facilityMw);
        const designPowerMw = (util.rows.find((u) => u.key === 'power')?.capacity ?? 0) * 0.9;
        const forecast = forecastSeries(i, +designPowerMw.toFixed(0));
        const m = { peak: Math.max(...forecast.map((f) => f.forecastMw)), rows: util.rows };
        _capPlanCache = { key, m };
        return m;
    } catch { return null; }
}

function capUtilRow(rowKey: string): UtilRow | null {
    return capPlanModel()?.rows.find((u) => u.key === rowKey) ?? null;
}

/* ═══ EB-finsus live-reader helpers (appended — invoked lazily by get()) ═════
 * Mirror FinancialPage model memo + SustainabilityEnginePage model/env memos
 * EXACTLY so the popover number matches the rendered KPI. All null-safe. */

/** Revised budget — mirrors FinancialPage: baseline + approved change orders. */
function finRevisedBudget(): number | null {
    try {
        const baseline = cap().results?.total;
        if (!baseline) return null;
        const approved = useFinancialTracking.getState().revisions
            .filter((r) => r.approved).reduce((s, r) => s + r.amountFrac * baseline, 0);
        return Math.round(baseline + approved);
    } catch { return null; }
}

/** Ledger sum by status — mirrors FinancialPage committed/paid (amountFrac × baseline). */
function finLedgerSum(statuses: string[]): number | null {
    try {
        const baseline = cap().results?.total;
        if (!baseline) return null;
        return Math.round(useFinancialTracking.getState().transactions
            .filter((t) => statuses.includes(t.status)).reduce((s, t) => s + t.amountFrac * baseline, 0));
    } catch { return null; }
}

/** EVM on the REVISED budget — mirrors FinancialPage (budget = revised, NOT the
 *  raw baseline used by the Construction page's constrPlan()). */
function finEvmLive(): { e: EvmResult; revised: number } | null {
    try {
        const res = cap().results;
        const revised = finRevisedBudget();
        if (!res?.timeline || revised == null) return null;
        const sched = plannedSchedule(res.timeline);
        if (!sched) return null;
        const t = useConstructionTracking.getState();
        return { e: evm(sched, revised, t.statusMonth, t.phaseActualPct, t.acSpentUsd), revised };
    } catch { return null; }
}

/** FAC — mirrors FinancialPage: AC + (revised − EV) ÷ clamp(CPI); Plan Mode ≡ revised. */
function finFacLive(): number | null {
    const r = finEvmLive();
    if (!r) return null;
    return !r.e.planMode ? Math.round(r.e.acUsd + (r.revised - r.e.evUsd) / Math.max(0.5, r.e.cpi)) : r.revised;
}

/** Health composite — mirrors FinancialPage: 0.3 budget-var + 0.35 CPI + 0.35 SPI. */
function finHealthLive(): number | null {
    const r = finEvmLive();
    const fac = finFacLive();
    if (!r || fac == null || r.revised <= 0) return null;
    const bv = Math.max(0, 1 - (Math.abs(fac - r.revised) / r.revised) * 5);
    return Math.round(100 * (0.3 * bv + 0.35 * Math.min(1, r.e.cpi) + 0.35 * Math.min(1, r.e.spi)));
}

/** Design PUE with the page's getPUE fallback — mirrors SustainabilityEnginePage model.pue. */
function susPueLive(): number | null {
    try { return pueLive() ?? getPUE(sim().inputs.coolingType); } catch { return null; }
}

/** Annual water volume — mirrors model.waterM3Yr (models.water.annualM3). */
function susWaterM3(): number | null {
    try {
        const m = (rzModels() as { water?: { annualM3?: (mw: number, cooling: string) => number } }).water;
        const v = m?.annualM3?.(sim().inputs.itLoad / 1000, sim().inputs.coolingType);
        return v != null && Number.isFinite(v) ? Math.round(v) : null;
    } catch { return null; }
}

/** Renewable share — mirrors the labeled derivation from capex renewable/cert inputs. */
function susRenewablePct(): number | null {
    try {
        const ci = cap().inputs;
        const ren = ci.renewableOption ?? 'none';
        const cert = ci.greenCert ?? 'none';
        const onSite = ren === 'solar_bess' ? 25 : ren === 'solar' ? 15 : 0;
        const offSite = cert === 'platinum' ? 35 : cert === 'gold' ? 20 : cert === 'silver' ? 10 : 0;
        return onSite + offSite;
    } catch { return null; }
}

/** Overall sustainability composite — mirrors the page's documented scorecard. */
function susOverallScore(): number | null {
    try {
        const pue = susPueLive();
        if (pue == null) return null;
        const energyScore = Math.round(Math.max(0, Math.min(100, ((1.6 - pue) / 0.5) * 100)));
        const gi = sim().selectedCountry?.environment?.gridCarbonIntensity ?? 0.7;
        const grid = Math.max(0, 100 - (susRenewablePct() ?? 0));
        const carbonScore = Math.round(Math.max(0, Math.min(100, ((0.9 - gi * (grid / 100)) / 0.9) * 100)));
        const m = (rzModels() as { water?: { wue?: (c: string) => number } }).water;
        const wue = m?.wue ? m.wue(sim().inputs.coolingType) : 1.8;
        const waterScore = Math.round(Math.max(0, Math.min(100, ((2.2 - wue) / 2.2) * 100)));
        const wd = useSustainability.getState().wasteDiversionPct;
        const wasteScore = wd != null ? Math.round(wd) : null;
        return Math.round((energyScore + carbonScore + waterScore + (wasteScore ?? 60)) / 4);
    } catch { return null; }
}

/** Workstream M — per-pillar sustainability scores; mirrors the
 *  SustainabilityEnginePage scorecard / susOverallScore formulas EXACTLY,
 *  pillar-by-pillar (waste = attested slider, null until set). */
function susPillarScores(): { energy: number; carbon: number; water: number; waste: number | null } | null {
    try {
        const pue = susPueLive();
        if (pue == null) return null;
        const energy = Math.round(Math.max(0, Math.min(100, ((1.6 - pue) / 0.5) * 100)));
        const gi = sim().selectedCountry?.environment?.gridCarbonIntensity ?? 0.7;
        const grid = Math.max(0, 100 - (susRenewablePct() ?? 0));
        const carbon = Math.round(Math.max(0, Math.min(100, ((0.9 - gi * (grid / 100)) / 0.9) * 100)));
        const m = (rzModels() as { water?: { wue?: (c: string) => number } }).water;
        const wue = m?.wue ? m.wue(sim().inputs.coolingType) : 1.8;
        const water = Math.round(Math.max(0, Math.min(100, ((2.2 - wue) / 2.2) * 100)));
        const wd = useSustainability.getState().wasteDiversionPct;
        return { energy, carbon, water, waste: wd != null ? Math.round(wd) : null };
    } catch { return null; }
}

/** Environmental Costs — mirrors SustainabilityEnginePage env memo (country-auto
 *  DATA.envCosts + DATA.waterFootprint rates; water basis municipal = page default;
 *  deep-sea ON → water $0 seawater basis). Null when the engine DATA is absent —
 *  same hide condition as the page section. */
function susEnvLive(): { waterCost: number; carbonCost: number; wasteCost: number } | null {
    try {
        const D = rzData() as {
            envCosts?: {
                carbonPriceUsdPerT?: Record<string, number>; voluntaryOffsetUsdPerT?: number; developedMarkets?: string[];
                wasteMgmt?: { generalUsdPerTonne?: Record<string, number>; generalTonnesPerMwItYr?: number; eWasteKgPerMwItYr?: number; eWasteUsdPerKg?: number };
            };
            waterFootprint?: { waterCostPerKgal?: Record<string, number>; climateMult?: Record<string, number>; lPerGal?: number };
        };
        const ec = D?.envCosts; const wf = D?.waterFootprint;
        if (!ec?.carbonPriceUsdPerT || !ec?.wasteMgmt || !wf?.waterCostPerKgal) return null;
        const country = sim().selectedCountry;
        const cid = (country?.id ?? 'US').toUpperCase();
        const mw = sim().inputs.itLoad / 1000;
        /* climate band from the country ASHRAE zone (same screening map as the page) */
        const zone: string = country?.environment?.ashraeClimateZone ?? '';
        const zn = parseInt(zone, 10);
        const climate = !zone || Number.isNaN(zn) ? 'temperate'
            : zn <= 2 && zone.includes('A') ? 'hothumid'
            : zn <= 3 && zone.includes('B') ? 'hotdry'
            : zn >= 5 ? 'cold' : 'temperate';
        const climateMult: number = wf.climateMult?.[climate] ?? 1.0;
        /* 1 · water — WUE volume × climate, priced per kgal (municipal basis) */
        const waterM3 = (susWaterM3() ?? 0) * climateMult;
        const kgal = (waterM3 * 1000) / (wf.lPerGal ?? 3.785) / 1000;
        const waterRate: number = wf.waterCostPerKgal.municipal ?? 0;
        const waterCost = cap().inputs.deepSea ? 0 : Math.round(kgal * waterRate);
        /* 2 · carbon — scope-2 tCO₂e × country compliance price (voluntary fallback) */
        let scope2 = 0;
        try {
            const mc = (rzModels() as { carbon?: { scopes?: (inp: Record<string, unknown>) => { scope2: number } | null } }).carbon;
            scope2 = mc?.scopes?.({ mw, pue: susPueLive() ?? 1.3, region: country?.id ?? 'US', capexUsd: 0 })?.scope2 ?? 0;
        } catch { /* keep 0 */ }
        const compliancePrice: number | undefined = ec.carbonPriceUsdPerT[cid];
        const carbonRate: number = compliancePrice != null && compliancePrice > 0 ? compliancePrice : (ec.voluntaryOffsetUsdPerT ?? 10);
        const carbonCost = Math.round(scope2 * carbonRate);
        /* 3 · waste — general band (developed/emerging) + certified e-waste */
        const developed = (ec.developedMarkets ?? []).includes(cid);
        const genRate: number = ec.wasteMgmt.generalUsdPerTonne?.[developed ? 'developed' : 'emerging'] ?? (developed ? 120 : 60);
        const wasteCost = Math.round(
            (ec.wasteMgmt.generalTonnesPerMwItYr ?? 2.0) * mw * genRate
            + (ec.wasteMgmt.eWasteKgPerMwItYr ?? 150) * mw * (ec.wasteMgmt.eWasteUsdPerKg ?? 1.0));
        return { waterCost, carbonCost, wasteCost };
    } catch { return null; }
}

/* ═══ EB-cov100 live-reader helpers (appended — invoked lazily by get()) ═════
 * Mirror ReliabilityEnginePage memo / CapexEngine timeline / StaffingDashboard
 * results+efficiency memos EXACTLY so popover numbers match rendered KPIs.
 * All null-safe. */

/** ReliabilityEnginePage memo mirror — β=5% common-cause screening chain
 *  composed from DATA.reliability.components at the current redundancy paths.
 *  Same code path as the page's buildSystems/ccOverall (CC_BETA = 0.05). */
let _relCache: { key: string; m: { overall: number; downtimeMin: number; mtbfAll: number; mttrAvg: number; score: number; paths: number } } | null = null;
function relPageModel(): { overall: number; downtimeMin: number; mtbfAll: number; mttrAvg: number; score: number; paths: number } | null {
    try {
        const eng = rzModels() as {
            reliability?: {
                availability?: (mtbf: number, mttr: number) => number;
                seriesAvailability?: (arr: number[]) => number;
                parallelAvailability?: (av: number, n: number) => number;
            };
        };
        const m = eng?.reliability;
        const D = rzData() as {
            reliability?: {
                components?: Record<string, { mtbf: number; mttr: number; label?: string }>;
                redundancyPaths?: Record<string, number>;
                tierAvailability?: Record<string, number>;
            };
        };
        const d = D?.reliability;
        if (!m?.availability || !d?.components) return null;
        const comps = d.components;
        const redKey = redKeyLive();
        const tier = sim().inputs.tierLevel;
        const key = [redKey, tier].join('|');
        if (_relCache?.key === key) return _relCache.m;
        const paths: number = d.redundancyPaths?.[redKey] ?? 2;
        const avail = m.availability;
        const par = (av: number, n: number) => m.parallelAvailability ? m.parallelAvailability(av, n) : 1 - Math.pow(1 - av, n);
        const ser = (arr: number[]) => m.seriesAvailability ? m.seriesAvailability(arr) : arr.reduce((s, x) => s * x, 1);
        const a = (cls: string) => comps[cls] ? avail(comps[cls].mtbf, comps[cls].mttr) : 0.999;
        /* documented per-system chains — identical to the page's buildSystems(1, paths) */
        const sys = [
            par(ser([a('switchgear'), a('pdu')]), paths),
            par(a('ups'), paths),
            par(a('generator'), Math.max(2, paths)),
            par(a('chiller'), 2),
            par(a('crac'), 2),
        ];
        const overallPar = ser(sys);
        const overallSingle = ser([ser([a('switchgear'), a('pdu')]), a('ups'), a('generator'), a('chiller'), a('crac')]);
        const overall = overallPar * 0.95 + overallSingle * 0.05;   // β=5% common-cause screening (page CC_BETA)
        const tierTarget: number = (d.tierAvailability ?? {})[String(tier)] ?? 0.99982;
        const downtimeMin = (1 - overall) * 525960;                 // page MIN_PER_YEAR
        const vals = Object.values(comps);
        const mtbfAll = Math.round(1 / vals.map((c) => 1 / c.mtbf).reduce((s, x) => s + x, 0));
        const mttrAvg = +(vals.reduce((s, c) => s + c.mttr, 0) / vals.length).toFixed(1);
        const spofLen = paths <= 1 ? 3 : (redKey === 'n1' ? 1 : 0); // page SPOF list lengths
        const availMargin = Math.min(1, Math.max(0, (overall - tierTarget) / (1 - tierTarget) * 0.5 + 0.5));
        const score = Math.round(40 * availMargin + 30 * Math.min(1, paths / 2) + 15 * (mttrAvg <= 12 ? 1 : 12 / mttrAvg) + 15 * (spofLen === 0 ? 1 : Math.max(0, 1 - spofLen * 0.3)));
        const out = { overall, downtimeMin, mtbfAll, mttrAvg, score, paths };
        _relCache = { key, m: out };
        return out;
    } catch { return null; }
}

/** CPM phase duration (months) from the CAPEX engine timeline — same figure as
 *  the Dashboard Schedule & Milestones chips (p.end − p.start). */
function phaseDurMo(name: string): number | null {
    try {
        const p = cap().results?.timeline?.phases?.find((x) => x.name === name);
        return p ? p.end - p.start : null;
    } catch { return null; }
}

/** Staffing cost parts (unrounded) — Σ per-role calculateStaffing monthlyCost +
 *  overtime component, mirrors StaffingDashboard results/efficiency memos. */

/** Density bucket for engine equipScale/programRich — mirrors capacity-adapter densityToEngineBucket. */
function densityBucketLive(): string {
    try {
        const kw = (useRequirementsStore.getState() as { workload?: { avgRackDensityKw?: number } }).workload?.avgRackDensityKw ?? 60;
        return kw < 9 ? 'standard' : kw < 18 ? 'medium' : kw < 45 ? 'high' : 'ai_hpc';
    } catch { return 'ai_hpc'; }
}

function staffCostParts(): { total: number; ot: number; headcount: number } | null {
    try {
        const st = sim();
        const country = st.selectedCountry;
        if (!country) return null;
        const i = st.inputs;
        const hc = effHeadcounts();
        const cfg: { role: StaffRole; qty: number; is24x7: boolean }[] = [
            { role: 'shift-lead', qty: hc[0], is24x7: true },
            { role: 'engineer', qty: hc[1], is24x7: true },
            { role: 'technician', qty: hc[2], is24x7: false },
            { role: 'admin', qty: hc[3], is24x7: false },
            { role: 'janitor', qty: hc[4], is24x7: false },
        ];
        const opModel = i.staffingModel === 'outsourced' ? 'vendor' : i.staffingModel;
        let total = 0, ot = 0, headcount = 0;
        for (const c of cfg) {
            const r = calculateStaffing(c.role, Math.max(1, c.qty), i.shiftModel, country, c.is24x7, undefined, undefined, opModel, i.hybridRatio ?? 0.5);
            total += r.monthlyCost;
            ot += r.breakdown?.overtime ?? 0;
            headcount += r.headcount ?? c.qty;
        }
        return { total, ot, headcount };
    } catch { return null; }
}

/** Country shrinkage factor — page fallback 0.15 (StaffingDashboard efficiency memo). */
function staffShrinkage(): number | null {
    try {
        const country = sim().selectedCountry as { labor?: { shrinkageFactor?: number } } | null;
        if (!country) return null;
        return country.labor?.shrinkageFactor ?? 0.15;
    } catch { return null; }
}

/** 5-yr cumulative staffing TCO — Σ years 0–5 of monthlyCost×12 escalated by the
 *  country labor escalation (mirrors generate5YearProjection + the page Σ). */
function staffTco5yr(): number | null {
    try {
        const p = staffCostParts();
        if (!p) return null;
        const esc = (sim().selectedCountry as { economy?: { laborEscalation?: number } } | null)?.economy?.laborEscalation ?? 0.04;
        let total = 0;
        for (let y = 0; y <= 5; y++) total += p.total * 12 * Math.pow(1 + esc, y);
        return Math.round(total);
    } catch { return null; }
}

/* ═══ EB-walk4 live-reader helpers (appended — invoked lazily by get()) ══════
 * Mirror MaintenanceDashboard / InvestmentDashboard / PhasedFinancialDashboard
 * / AssetIntelligencePage model chains EXACTLY so the popover number matches
 * the rendered KPI. Page-LOCAL state (pencil-mode counts, investment parameter
 * panel, fleet-age slider) is mirrored at the page DEFAULTS — documented on
 * each node's formulaTemplate. All null-safe. */

/** MAINTENANCE — auto-generated fleet → SFG20 schedule → strategy comparison
 *  (mirrors MaintenanceDashboard: assetCounts effect + schedule/strategyData
 *  memos + KPI-row reductions; pencil-mode manual counts are page-local). */
let _maintCache: { key: string; m: { events: number; hours: number; units: number; annualBudget: number | null; fiveYearSavings: number | null } } | null = null;
function maintModel(): { events: number; hours: number; units: number; annualBudget: number | null; fiveYearSavings: number | null } | null {
    try {
        const st = sim();
        const country = st.selectedCountry;
        if (!country) return null;
        const i = st.inputs;
        const key = [i.itLoad, i.tierLevel, i.coolingType, i.coolingTopology, i.powerRedundancy, i.maintenanceModel, i.maintenanceStrategy, i.hybridRatio ?? 0.5, country.id].join('|');
        if (_maintCache?.key === key) return _maintCache.m;
        const coolingMap: 'air' | 'pumped' = i.coolingType === 'liquid' || i.coolingType === 'rdhx' ? 'pumped' : 'air';
        const counts = generateAssetCounts(i.itLoad, i.tierLevel === 4 ? 4 : 3, coolingMap, i.itLoad * 1.5, i.coolingTopology, i.powerRedundancy);
        const schedule = generateMaintenanceSchedule(counts);
        const hours = Math.round(schedule.reduce((a, e) => a + e.durationHours, 0));
        const units = counts.reduce((a, c) => a + c.count, 0);
        let annualBudget: number | null = null, fiveYearSavings: number | null = null;
        try {
            const strat = calculateStrategyComparison(
                counts, schedule, i.tierLevel === 4 ? 4 : 3, country,
                i.maintenanceModel as 'in-house' | 'hybrid' | 'vendor', i.hybridRatio ?? 0.5);
            const active = i.maintenanceStrategy || 'planned';
            const a = strat.strategies.find((s) => s.id === active)?.totalAnnualCost;
            annualBudget = a != null ? Math.round(a) : null;
            fiveYearSavings = strat.fiveYearSavings != null ? Math.round(strat.fiveYearSavings) : null;
        } catch { /* keep nulls */ }
        const m = { events: schedule.length, hours, units, annualBudget, fiveYearSavings };
        _maintCache = { key, m };
        return m;
    } catch { return null; }
}

/** INVESTMENT page parameter-panel DEFAULTS (page useState seed — local state;
 *  trace baseline documented on the inv.* nodes). */
const INV_DEFAULTS = {
    debtRatio: 0.65, debtCostAnnual: 0.05, debtTermYears: 12, equityCostOfCapital: 0.12,
    exitYear: 7, exitEbitdaMultiple: 18, terminalCapRate: 0.065, controlPremiumPct: 0.25,
    revenuePerKwMonth: 150, opexEscalation: 0.035, escalationRate: 0.03, taxRate: 0.25,
    depreciationYears: 15, projectLifeYears: 10,
};

/** INVESTMENT — mirrors the page chain annualOpex → calculateFinancials →
 *  calculateInvestment at the DEFAULT parameter panel (effective headcounts
 *  per useEffectiveInputs, same as the page). */
let _invCache: { key: string; m: InvestmentResult } | null = null;
function invModel(): InvestmentResult | null {
    try {
        const st = sim();
        const country = st.selectedCountry;
        const capexTotal = cap().results?.total;
        if (!country || !capexTotal) return null;
        const i = st.inputs;
        const hc = effHeadcounts();
        const key = [capexTotal, i.itLoad, i.coolingType, country.id, hc.join('.')].join('|');
        if (_invCache?.key === key) return _invCache.m;
        const labor = country.labor;
        const staffCost = (
            hc[0] * labor.baseSalary_ShiftLead + hc[1] * labor.baseSalary_Engineer +
            hc[2] * labor.baseSalary_Technician + hc[3] * labor.baseSalary_Admin +
            hc[4] * labor.baseSalary_Janitor
        ) * 12;
        const elecRate = country.economy?.electricityRate ?? 0.10;
        const annualOpex = staffCost + i.itLoad * getPUE(i.coolingType ?? 'air') * 8760 * elecRate + i.itLoad * 50;
        const d = INV_DEFAULTS;
        const fin = calculateFinancials({
            totalCapex: capexTotal, annualOpex, revenuePerKwMonth: d.revenuePerKwMonth,
            itLoadKw: i.itLoad, discountRate: d.equityCostOfCapital, projectLifeYears: d.projectLifeYears,
            escalationRate: d.escalationRate, opexEscalation: d.opexEscalation,
            occupancyRamp: defaultOccupancyRamp(d.projectLifeYears), taxRate: d.taxRate,
            depreciationYears: d.depreciationYears,
        });
        const m = calculateInvestment({
            totalCapex: capexTotal, unleveredCashflows: fin.cashflows, itLoadKw: i.itLoad,
            taxRate: d.taxRate, debtRatio: d.debtRatio, debtCostAnnual: d.debtCostAnnual,
            debtTermYears: d.debtTermYears, equityCostOfCapital: d.equityCostOfCapital,
            exitYear: d.exitYear, exitEbitdaMultiple: d.exitEbitdaMultiple,
            terminalCapRate: d.terminalCapRate, controlPremiumPct: d.controlPremiumPct,
        });
        _invCache = { key, m };
        return m;
    } catch { return null; }
}

/** PHASED FINANCE — mirrors the page's big memo steps 1-4 EXACTLY: capacity
 *  plan → cross-module adjustments (disaster/grid/talent; tax-incentive value
 *  is narrative-only) → per-phase calculateFinancials (20 yr, risk-adjusted
 *  discount, country effective tax) → CAPEX-weighted blended aggregation with
 *  the page's rounding. */
let _pfCache: { key: string; m: { irr: number; npv: number; payback: number; capex: number; pi: number } } | null = null;
function pfModel(): { irr: number; npv: number; payback: number; capex: number; pi: number } | null {
    try {
        const st = sim();
        const country = st.selectedCountry;
        if (!country) return null;
        const i = st.inputs;
        const key = [
            country.id, i.coolingType, i.tierLevel, i.shiftModel, i.maintenanceModel, i.hybridRatio ?? 0.5,
            i.capacityPhases.map((p) => `${p.itLoadKw}:${p.startMonth}:${p.buildMonths}:${(p.occupancyRamp ?? []).join(',')}`).join(';'),
        ].join('|');
        if (_pfCache?.key === key) return _pfCache.m;
        const capPlan = calculateCapacityPlan({
            phases: i.capacityPhases, country, coolingType: i.coolingType, tierLevel: i.tierLevel,
            shiftModel: i.shiftModel, maintenanceModel: i.maintenanceModel, hybridRatio: i.hybridRatio,
        });
        if (!capPlan.phases.length || !(capPlan.totalItLoadKw > 0)) return null;
        const disaster = calculateDisasterRisk({
            country, totalCapex: capPlan.totalCapex, itLoadKw: capPlan.totalItLoadKw,
            annualRevenue: capPlan.totalItLoadKw * 150 * 12,
        });
        const grid = calculateGridReliability({
            country, itLoadKw: capPlan.totalItLoadKw, tierLevel: i.tierLevel, coolingType: i.coolingType,
        });
        const lastFte = capPlan.phases[capPlan.phases.length - 1]?.fte ?? 10;
        const talent = calculateTalentAvailability({
            country, totalFTE: lastFte, annualStaffCost: lastFte * 3000 * 12,
        });
        const effectiveTaxRate = country.taxIncentives?.effectiveTaxRate ?? country.economy.taxRate;
        const riskPremium = disaster.compositeScore > 50 ? 0.02 : disaster.compositeScore > 30 ? 0.01 : 0;
        const adjustedDiscount = 0.10 + riskPremium;
        const adders = grid.gridRiskAdjustedOpex + disaster.annualInsuranceCost
            + (talent.adjustedSalaryMultiplier - 1) * lastFte * 3000 * 12;
        const phases = capPlan.phases.map((phase, idx) => {
            const phaseOccRamp = i.capacityPhases[idx]?.occupancyRamp ?? [0.3, 0.6, 0.85, 0.95];
            const phaseCapex = phase.capex + disaster.structuralCostAdder * (phase.itLoadKw / capPlan.totalItLoadKw);
            const f = calculateFinancials({
                totalCapex: phaseCapex,
                annualOpex: phase.itLoadKw * 50 * 12 + adders * (phase.itLoadKw / capPlan.totalItLoadKw),
                revenuePerKwMonth: 150, itLoadKw: phase.itLoadKw, discountRate: adjustedDiscount,
                projectLifeYears: 20, escalationRate: 0.03, opexEscalation: country.economy.inflationRate,
                occupancyRamp: phaseOccRamp.concat(Array(16).fill(0.95)), taxRate: effectiveTaxRate,
                depreciationYears: 20,
            });
            return { capex: phaseCapex, irr: f.irr, npv: f.npv, payback: f.paybackPeriodYears };
        });
        const totalCapex = phases.reduce((s, p) => s + p.capex, 0);
        if (!(totalCapex > 0)) return null;
        const irr = phases.reduce((s, p) => s + p.irr * (p.capex / totalCapex), 0);
        const npv = phases.reduce((s, p) => s + p.npv, 0);
        const payback = phases.reduce((s, p) => s + p.payback * (p.capex / totalCapex), 0);
        const pi = Math.max(0, (npv + totalCapex) / totalCapex);
        const m = {
            irr: Math.round(irr * 10) / 10, npv: Math.round(npv),
            payback: Math.round(payback * 10) / 10, capex: Math.round(totalCapex),
            pi: Math.round(pi * 100) / 100,
        };
        _pfCache = { key, m };
        return m;
    } catch { return null; }
}

/** ASSET INTELLIGENCE health buckets + wear-out risk at the trace baseline
 *  (age 3 yr / condition 85% = page slider defaults) — same class rows +
 *  count>0 filter + thresholds as AssetIntelligencePage model memo. */
function assetBuckets(): { exGood: number; fair: number; poorCrit: number; atRisk: number } | null {
    try {
        const eq = assetEquip();
        if (!eq) return null;
        const m = (rzModels() as {
            asset?: {
                healthIndex?: (inp: Record<string, unknown>) => { health?: number } | null;
                failureProbability?: (cls: string, age: number) => { failureProb?: number } | null;
            };
        }).asset;
        if (!m?.healthIndex) return null;
        let exGood = 0, fair = 0, poorCrit = 0, atRisk = 0, any = 0;
        for (const c of ASSET_CLASSES) {
            const count = eq[c.eqKey] ?? 0;
            if (!count) continue;
            any += count;
            const h = Math.round(m.healthIndex({ assetClass: c.cls, ageYears: 3, condition: 0.85, duty: 0.5 })?.health ?? 0);
            if (h >= 70) exGood += count; else if (h >= 50) fair += count; else poorCrit += count;
            const fp = Math.round((m.failureProbability?.(c.cls, 3)?.failureProb ?? 0) * 100);
            if (fp >= 25) atRisk += count;
        }
        return any ? { exGood, fair, poorCrit, atRisk } : null;
    } catch { return null; }
}

/* ═══ CALIBRATION wave (Arc-1, append-bottom) — Model Calibration nodes ══════
 * Headline verdict/position from the "Model Calibration — engine vs real world"
 * section (BenchmarkDashboard). get() delegates to computeCalibration()
 * (lib/calibration.ts), which evaluates DATA.calibrationSpec — the SAME SINGLE
 * SOURCE as the ship gate tools/test-model-calibration.mjs (one rule semantics;
 * band = LIVE corpus percentile, not a frozen number). These are engine
 * CONSTANT values (liquid tier3 / liquidCooledTier3) — deliberately NOT
 * dependent on the user's selected cooling, hence no deps to pue.design. */
Object.assign(TRACE, {
    'calib.pueLiquidPctile': {
        label: 'PUE Calibration — liquid tier3 position in the hyperscale fleet', page: 'benchmark', unit: 'pctile', provenance: 'engine',
        formulaTemplate: 'pctileOf(DATA.pueMatrix.liquid.tier3, pue.hyperscale corpus p10–p90) — pueBand rule (DATA.calibrationSpec, mapping pue.design.vs.fleet): piecewise-linear percentile interpolation vs the LIVE hyperscale fleet distribution (design-basis vs fleet-trailing, gap 5–15% expected); identical to the output of gate tools/test-model-calibration.mjs',
        sourceKey: 'pueMatrix',
        get: () => computeCalibration()?.pueLiquidT3Pctile ?? null,
    },
    'calib.capexRatioFinance': {
        label: 'CAPEX Calibration — finance corpus ÷ engine ratio', page: 'benchmark', unit: 'x', provenance: 'engine',
        formulaTemplate: '(investment_busd.finance.p50 × 1e9 ÷ capacity_mw.finance.p50) ÷ DATA.capexPerMw.liquidCooledTier3 — capexRatio rule (DATA.calibrationSpec, mapping capex.aggregate.ratio), band [1.0, 4.0] = total-project scope (land+IT+contingency+build) vs raw-build; p50-per-p50 aggregate, corpus facts not paired per document',
        sourceKey: 'capexPerMw',
        get: () => computeCalibration()?.capexRatioFinance ?? null,
    },
} satisfies Record<string, TraceNode>);
TRACE_IDS.push('calib.pueLiquidPctile', 'calib.capexRatioFinance');

import { computeCalibration } from '@/lib/calibration';

/* ═══ SHIP-A wave (append-bottom) — AI reference-architecture provisioning ═════
 * Two nodes trace the arch-driven power-provisioning path. Both read the selected
 * arch key from the requirements workload (single source; the capex store mirrors
 * it). get() delegates to the shared engine models.requirements.* — no local
 * economic constant. Kept acyclic: provisionedRackKw is an engine leaf;
 * provisionedPowerUplift derives from it + capex.total + sim.itLoad. */
Object.assign(TRACE, {
    'req.provisionedRackKw': {
        label: 'Provisioned Rack kW (peak/EDPp) — AI reference architecture', page: 'requirements', unit: 'kW/rack', provenance: 'engine',
        formulaTemplate: 'models.requirements.provisionedRackKw(archKey) — rackKwPeak (EDPp), or rackKwNominal × DATA.requirements.peakProvisionFactor (1.5) when peak is unpublished; the power plant is sized to peak, not nominal',
        sourceKey: 'requirements.archProfiles',
        get: () => {
            const key = req().workload.archKey;
            if (!key) return null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m = (rzModels() as any)?.requirements;
            return m?.provisionedRackKw ? (m.provisionedRackKw(key) ?? null) : null;
        },
    },
    'capex.provisionedPowerUplift': {
        label: 'Power-Plant Provisioning Uplift (electrical+UPS+gen)', page: 'capex', unit: 'x', provenance: 'derived',
        formulaTemplate: 'models.requirements.powerProvisionUplift(archKey) = (req.provisionedRackKw ÷ rackKwNominal) ÷ DATA.requirements.baselinePeakRatio (1.2), floored at 1.0 — MARGINAL multiplier applied ONLY to the electrical/UPS/generator base $/kW (the CPU-era base already prices ~1.2× headroom, so raw peak/nominal would double-count)',
        deps: ['req.provisionedRackKw', 'capex.total', 'sim.itLoad'],
        get: () => {
            const key = req().workload.archKey;
            if (!key) return null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m = (rzModels() as any)?.requirements;
            return m?.powerProvisionUplift ? (m.powerProvisionUplift(key) ?? null) : null;
        },
    },
} satisfies Record<string, TraceNode>);
TRACE_IDS.push('req.provisionedRackKw', 'capex.provisionedPowerUplift');

/* ═══ BOQ wave (append-bottom) — Bill of Quantities dossier surface ═══════════
 * The BOQ dossier decomposes the parametric CAPEX total into a screening-grade
 * bill of quantities via the shared engine (models.boq.generate/.summary). The
 * dossier grand total IS the CAPEX total (the decomposition reconciles to it),
 * so boq.grandTotal derives from capex.total. boq.marginPct is the DISCLOSED
 * EPC margin basis (backed out of the subtotal — the benchmark $/kW already
 * embed it), an engine constant sourced via DATA.boq.commercialBasis. */
Object.assign(TRACE, {
    'boq.grandTotal': {
        label: 'BOQ Grand Total (= CAPEX total)', page: 'capex', unit: '$', provenance: 'derived',
        formulaTemplate: 'models.boq.summary(...).grandTotal — the BOQ decomposition reconciles to capex.total (direct cost + disclosed margin + soft + contingency + FOM + unaccounted residual)',
        deps: ['capex.total'],
        get: () => cap().results?.total ?? null,
    },
    'boq.marginPct': {
        label: 'BOQ Disclosed EPC Margin (% gross)', page: 'capex', unit: '%', provenance: 'engine',
        formulaTemplate: 'DATA.boq.commercialBasis.epcMarginPctGross — DISCLOSED margin backed out of the benchmark $/kW subtotal (m ÷ (1+m)), NOT added on top; the T&T/C&W $/kW already embed contractor margin',
        sourceKey: 'boq.commercialBasis',
        get: () => {
            const b = (rzData() as { boq?: { commercialBasis?: { epcMarginPctGross?: number } } }).boq;
            return b?.commercialBasis?.epcMarginPctGross ?? null;
        },
    },
} satisfies Record<string, TraceNode>);
TRACE_IDS.push('boq.grandTotal', 'boq.marginPct');
