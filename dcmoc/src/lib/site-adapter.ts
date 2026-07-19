/* ─── SITE-INTELLIGENCE DATA ADAPTER (Phase B) ───────────────────────────────
 * Pure transformation layer between the candidate-site UI state and the
 * READ-ONLY engine (models.site). All normalization formulas MIRROR the
 * engine's own deriveFactors math (rz-engine.js:6523-6566), reading the
 * DATA.site mapping tables via rzData() with verbatim local fallbacks.
 * The authoritative Total Score is ALWAYS models.site.score — the 8 radar
 * axes are a documented presentation decomposition, never a rival score.
 * KEY INVARIANT: a site with NO attribute overrides must reproduce the
 * engine's country score EXACTLY.
 * ──────────────────────────────────────────────────────────────────────── */

import { rzModels, rzData } from '@/lib/rz-engine';
import { COUNTRIES } from '@/constants/countries';
import type { CandidateSite, SiteAttributes, SiteScoreResult, FactorKey, AxisKey, RiskLevel } from '@/types/site-intel';
import { ATTR_BOUNDS } from '@/types/site-intel';

/* engine-mirror fallback constants (same values as DATA.site) */
const FALLBACK_SAIDI_REF = 500;
const FALLBACK_PGA_TO_SCORE: { maxPga: number; s: number }[] = [
    { maxPga: 5, s: 1.0 }, { maxPga: 15, s: 0.8 }, { maxPga: 30, s: 0.6 }, { maxPga: 60, s: 0.35 }, { maxPga: 9999, s: 0.1 },
];
const RISK_MAP: Record<RiskLevel, number> = { low: 1, moderate: 0.66, high: 0.33, extreme: 0.1 };
const FLOOD_MAP: Record<RiskLevel, number> = { low: 1, moderate: 0.66, high: 0.33, extreme: 0 };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function sanitizeAttr(key: keyof SiteAttributes, v: unknown): number | null {
    const b = ATTR_BOUNDS[key];
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    if (!Number.isFinite(n)) return null;
    if (!b) return n;
    return Math.min(b.max, Math.max(b.min, n));
}

/** SiteAttributes → 0-1 factor overrides. ONLY customized factors appear —
 *  absent keys keep the engine's country-derived values (parity invariant). */
export function attributesToOverrides(site: CandidateSite): Partial<Record<FactorKey, number>> {
    const a = site.attributes;
    const S = rzData()?.site ?? {};
    const saidiRef: number = S.saidiRefMin ?? FALLBACK_SAIDI_REF;
    const pgaTable: { maxPga: number; s: number }[] = S.pgaToScore ?? FALLBACK_PGA_TO_SCORE;
    const out: Partial<Record<FactorKey, number>> = {};

    /* power — engine mirror: 1 − (rate − .05)/.30 (rz-engine.js:6552) */
    const rate = sanitizeAttr('powerCostKwh', a.powerCostKwh);
    if (rate != null) out.power = clamp01(1 - (rate - 0.05) / 0.30);

    /* grid — SAIDI preferred (1 − saidi/ref), else reliability % ((pct−95)/5) */
    const saidi = sanitizeAttr('saidiMinYr', a.saidiMinYr);
    const relPct = sanitizeAttr('powerReliabilityPct', a.powerReliabilityPct);
    if (saidi != null) out.grid = clamp01(1 - saidi / saidiRef);
    else if (relPct != null) out.grid = clamp01((relPct - 95) / 5);

    /* seismic — PGA band preferred (engine pgaToScore), else risk level map */
    const pga = sanitizeAttr('pgaPct2in50yr', a.pgaPct2in50yr);
    if (pga != null) {
        const band = pgaTable.find((b) => pga < b.maxPga);
        out.seismic = band ? band.s : 0.1;
    } else if (a.earthquakeRisk) out.seismic = RISK_MAP[a.earthquakeRisk];

    /* tax — engine mirror: 1 − rate/.35 */
    const tax = sanitizeAttr('effectiveTaxRate', a.effectiveTaxRate);
    if (tax != null) out.tax = clamp01(1 - tax / 0.35);

    /* flood — engine flood map */
    if (a.floodRisk) out.flood = FLOOD_MAP[a.floodRisk];

    /* water — engine mirror: 1 − stress/5 */
    const stress = sanitizeAttr('waterStress0to5', a.waterStress0to5);
    if (stress != null) out.water = clamp01(1 - stress / 5);

    /* latency — ADAPTER-DEFINED (documented): .6·latency + .4·cable count.
     * latScore = 1 − (minMs − 5)/95 ; cableScore = cables/6 */
    const cables = sanitizeAttr('submarineCableLandings', a.submarineCableLandings);
    const minMs = a.latencies?.length ? Math.min(...a.latencies.map((l) => l.ms)) : null;
    if (cables != null || minMs != null) {
        const latScore = minMs != null ? clamp01(1 - (minMs - 5) / 95) : 0.65;
        const cableScore = cables != null ? clamp01(cables / 6) : 0.5;
        out.latency = clamp01(0.6 * latScore + 0.4 * cableScore);
    }

    /* climate — ADAPTER-DEFINED CDD proxy: 1 − cdd/6500; else ambient proxy */
    const cdd = sanitizeAttr('coolingDegreeDays', a.coolingDegreeDays);
    const amb = sanitizeAttr('avgAmbientC', a.avgAmbientC);
    if (cdd != null) out.climate = clamp01(1 - cdd / 6500);
    else if (amb != null) out.climate = clamp01(1 - (amb - 5) / 35);

    /* NaN firewall (STEP 3): never let a non-finite through */
    (Object.keys(out) as FactorKey[]).forEach((k) => { if (!Number.isFinite(out[k]!)) delete out[k]; });
    return out;
}

/** Score one site through the ENGINE (authoritative). Null when engine absent. */
export function scoreSite(site: CandidateSite): SiteScoreResult | null {
    const m = rzModels()?.site;
    if (!m?.deriveFactors || !m?.score) return null;
    const overrides = attributesToOverrides(site);
    const factors = m.deriveFactors(site.countryId, overrides);
    const engine = m.score(factors);
    const b: Partial<Record<FactorKey, number>> = {};
    (engine.breakdown as { key: FactorKey; value: number }[]).forEach((r) => { b[r.key] = r.value; });
    const g = (k: FactorKey) => b[k] ?? 0.6;

    /* 8-axis presentation decomposition (documented formulas; NOT a rival score) */
    const a = site.attributes;
    const roadMap = { excellent: 1, good: 0.75, fair: 0.5, poor: 0.25 } as const;
    const landParts: number[] = [];
    if (a.roadAccess) landParts.push(roadMap[a.roadAccess]);
    const permit = sanitizeAttr('permitMonths', a.permitMonths);
    if (permit != null) landParts.push(clamp01(1 - (permit - 3) / 21));
    const port = sanitizeAttr('distPortKm', a.distPortKm);
    if (port != null) landParts.push(clamp01(1 - port / 300));
    const landInfra = landParts.length ? landParts.reduce((s, x) => s + x, 0) / landParts.length : 0.6;

    const aqi = sanitizeAttr('airQualityIndex', a.airQualityIndex);
    const country = COUNTRIES[site.countryId];
    const aqiScore = aqi != null ? clamp01(1 - aqi / 300)
        : (country?.environment?.baselineAQI != null ? clamp01(1 - country.environment.baselineAQI / 300) : 0.65);

    const cyc = a.cycloneRisk ? RISK_MAP[a.cycloneRisk] : 0.66;
    const landCost = sanitizeAttr('landCostPerM2', a.landCostPerM2);
    const landCostScore = landCost != null ? clamp01(1 - landCost / 500) : 0.6;
    const hyper = country?.talentPool?.hyperscalerPresence != null ? clamp01(country.talentPool.hyperscalerPresence / 10) : 0.65;

    const risksGoodness = 0.5 * g('seismic') + 0.3 * g('flood') + 0.2 * cyc;
    const axes: Record<AxisKey, number> = {
        powerAvailability: Math.round(100 * (0.6 * g('power') + 0.4 * g('grid'))),
        connectivity: Math.round(100 * g('latency')),
        waterCooling: Math.round(100 * (0.5 * g('water') + 0.5 * g('climate'))),
        landInfra: Math.round(100 * landInfra),
        environmental: Math.round(100 * (0.5 * g('carbon') + 0.3 * g('climate') + 0.2 * aqiScore)),
        naturalRisks: Math.round(100 * risksGoodness),
        costIncentives: Math.round(100 * (0.4 * g('tax') + 0.35 * g('power') + 0.25 * landCostScore)),
        marketProximity: Math.round(100 * (0.6 * g('latency') + 0.4 * hyper)),
    };

    return {
        siteId: site.id,
        engine,
        axes,
        availabilityScore: axes.powerAvailability,
        connectivityScore: axes.connectivity,
        waterCoolingScore: axes.waterCooling,
        riskScore: 100 - axes.naturalRisks,   // lower = better
    };
}

export function scoreAllSites(sites: CandidateSite[]): SiteScoreResult[] {
    const results = sites.map(scoreSite).filter((r): r is SiteScoreResult => r != null);
    results.sort((x, y) => y.engine.score - x.engine.score);
    results.forEach((r, i) => { r.rank = i + 1; });
    return results;
}

/** Deterministic key-takeaway bullets for a site (top ~5). */
export function keyTakeaways(site: CandidateSite, r: SiteScoreResult, totalSites: number): string[] {
    const out: string[] = [];
    out.push(`Grade ${r.engine.grade} (${r.engine.label}) — ${r.engine.score}/100 overall${r.rank === 1 && totalSites > 1 ? `, strongest of ${totalSites} candidates` : ''}.`);
    const val = (k: FactorKey) => r.engine.breakdown.find((b) => b.key === k)?.value ?? 0;
    if (val('grid') >= 0.8) out.push('Grid reliability in the top band (low SAIDI-equivalent).');
    if (val('water') >= 0.7 && val('climate') >= 0.5) out.push('Good water & cooling position for the site.');
    if (site.attributes.submarineCableLandings != null && site.attributes.submarineCableLandings >= 2) out.push(`Direct landing zone — ${site.attributes.submarineCableLandings} submarine cable stations nearby.`);
    if (r.riskScore <= 30) out.push('Low composite natural-hazard exposure vs the region.');
    if (val('tax') >= 0.6 && site.attributes.landCostPerM2 != null) out.push(`Competitive land cost ($${site.attributes.landCostPerM2}/m²) with usable incentives.`);
    if (r.engine.missing.length > 0) out.push(`Coverage ${Math.round(r.engine.coverage * 100)}% — ${r.engine.missing.length} factor(s) on neutral defaults.`);
    return out.slice(0, 5);
}

export interface PanelValue { label: string; value: string; source: 'site' | 'country' | 'default' }

/** Per-panel display transforms with provenance tags. */
export function panelData(site: CandidateSite): Record<'power' | 'connectivity' | 'environmental' | 'risks' | 'land' | 'cost', PanelValue[]> {
    const a = site.attributes;
    const c = COUNTRIES[site.countryId];
    const v = (label: string, siteVal: string | number | null | undefined, countryVal?: string | number | null, unit = ''): PanelValue => {
        if (siteVal != null && siteVal !== '') return { label, value: `${siteVal}${unit}`, source: 'site' };
        if (countryVal != null && countryVal !== '') return { label, value: `${countryVal}${unit}`, source: 'country' };
        return { label, value: '—', source: 'default' };
    };
    return {
        power: [
            v('Power Source', a.powerSource),
            v('Available Capacity', a.availableCapacityMw, null, ' MW'),
            v('Grid Voltage', a.gridVoltageKv, null, ' kV'),
            v('SAIDI', a.saidiMinYr, c?.environment?.saidiMinYr, ' min/yr'),
            v('Power Cost', a.powerCostKwh, c?.economy?.electricityRate, ' $/kWh'),
            v('Solar Potential', a.renewableSolarKwhPerKwpYr, null, ' kWh/kWp/yr'),
            v('Fuel Availability', a.fuelAvailability),
        ],
        connectivity: [
            v('Cable Landings', a.submarineCableLandings),
            v('Distance to Landing', a.distanceToCableLandingKm, null, ' km'),
            ...(a.latencies ?? []).map((l) => ({ label: `Latency · ${l.market}`, value: `${l.ms} ms`, source: 'site' as const })),
        ],
        environmental: [
            v('Avg Ambient Temp', a.avgAmbientC, null, ' °C'),
            v('Humidity', a.humidityPct, null, ' %RH'),
            v('Cooling Degree Days', a.coolingDegreeDays),
            v('Air Quality Index', a.airQualityIndex, c?.environment?.baselineAQI),
            v('Water Source', a.waterSource),
            v('Water Quality', a.waterQuality),
            v('Water Stress (WRI)', a.waterStress0to5, c?.environment?.aqueductStressScore, ' /5'),
        ],
        risks: [
            v('Earthquake Risk', a.earthquakeRisk, c?.naturalDisaster?.seismicZone != null ? `zone ${c.naturalDisaster.seismicZone}` : null),
            v('Flood Risk', a.floodRisk, c?.naturalDisaster?.floodRisk),
            v('Cyclone Risk', a.cycloneRisk),
            v('Landslide Risk', a.landslideRisk),
            v('Coastal Risk', a.coastalRisk),
            v('PGA (2% in 50yr)', a.pgaPct2in50yr, c?.environment?.pgaPct2in50yr, ' %g'),
        ],
        land: [
            v('Total Land Area', a.totalAcres, null, ' acres'),
            v('Usable Land', a.usableAcres, null, ' acres'),
            v('Topography', a.topography),
            v('Soil Condition', a.soil),
            v('Road Access', a.roadAccess),
            v('Distance to Highway', a.distHighwayKm, null, ' km'),
            v('Distance to Port', a.distPortKm, null, ' km'),
            v('Distance to Airport', a.distAirportKm, null, ' km'),
            v('Construction Labor', a.constructionLabor),
            v('Permit Process', a.permitMonths, null, ' months'),
        ],
        cost: [
            v('Land Cost', a.landCostPerM2, null, ' $/m²'),
            v('Power Cost', a.powerCostKwh, c?.economy?.electricityRate, ' $/kWh'),
            v('Water Cost', a.waterCostPerM3, null, ' $/m³'),
            v('Construction Cost Index', a.constructionCostIndex, c?.constructionIndex),
            v('Effective Tax Rate', a.effectiveTaxRate != null ? `${(a.effectiveTaxRate * 100).toFixed(0)}%` : null, c?.economy?.taxRate != null ? `${(c.economy.taxRate * 100).toFixed(0)}%` : null),
            v('Tax Incentives', a.taxIncentives),
            v('Customs Exemption', a.customsExemption === true ? 'Yes' : a.customsExemption === false ? 'No' : null),
            v('Government Support', a.govSupport),
        ],
    };
}

/** OWNER CORRECTION: seed exactly ONE site bound to the ACTIVE scenario
 *  (country + config). Multi-site compare appears only after "Add Site". */
export function seedDefaultSites(baseCountryId: string): CandidateSite[] {
    const now = Date.now();
    const c = COUNTRIES[baseCountryId];
    return [{
        id: 'site_a_scenario',
        name: c ? `${c.name} Site` : 'Primary Site',
        label: 'A',
        countryId: baseCountryId,
        city: '',
        lat: 0.42, lng: 0.45,
        attributes: {},               // all values from the country baseline until edited
        createdAt: now, updatedAt: now,
    }];
}

/* ─── PHASE V — FULL INTEGRATION of the 5 sibling analyses per site ──────────
 * The unified Site Intelligence page COMPUTES tax / disaster / grid / talent /
 * compliance PER CANDIDATE SITE (its country), sharing one project context.
 * The child tabs stay as deep-dives over the SAME engines.
 * ──────────────────────────────────────────────────────────────────────── */

import { calculateTaxIncentives, type TaxIncentiveResult } from '@/modules/analytics/TaxIncentiveEngine';
import { calculateDisasterRisk, type DisasterRiskResult } from '@/modules/risk/DisasterRiskEngine';
import { calculateGridReliability, type GridReliabilityResult } from '@/modules/infrastructure/GridReliabilityEngine';
import { calculateTalentAvailability, type TalentAvailabilityResult } from '@/modules/staffing/TalentAvailabilityEngine';
import { calculateCompliance, type ComplianceResult } from '@/modules/compliance/ComplianceEngine';

export interface SiteAnalysisCtx {
    itLoadKw: number;
    tierLevel: 2 | 3 | 4;
    coolingType: 'air' | 'inrow' | 'rdhx' | 'liquid';
    totalCapex: number;
    annualRevenue: number;      // screening: revenuePerKwMonth × itLoad × 12
    annualOpex: number;
    totalFTE: number;
    annualStaffCost: number;    // screening: FTE × base salary × 1.3 burden
}

export interface SiteAnalyses {
    tax: TaxIncentiveResult | null;
    disaster: DisasterRiskResult | null;
    grid: GridReliabilityResult | null;
    talent: TalentAvailabilityResult | null;
    compliance: ComplianceResult | null;
}

/** Shared project context for the per-site analyses (computed once per render).
 *  Screening bases documented: revenue = engine decision.revenuePerKwMonth
 *  (fallback 280 $/kW·mo), staff cost = headcount × country base salary × 1.3. */
export function buildAnalysisCtx(args: {
    itLoadKw: number; tierLevel: 2 | 3 | 4; coolingType: SiteAnalysisCtx['coolingType'];
    capexTotal: number | null; headcounts: number[]; countryId: string; opexAnnual?: number | null;
}): SiteAnalysisCtx {
    const revenuePerKwMonth: number = rzData()?.decision?.revenuePerKwMonth ?? 280;
    const annualRevenue = revenuePerKwMonth * args.itLoadKw * 12;
    const totalFTE = Math.max(1, Math.round(args.headcounts.reduce((s, x) => s + (x || 0), 0)));
    const c = COUNTRIES[args.countryId];
    const baseSalary = c?.labor?.baseSalary_Engineer ?? 60000;
    return {
        itLoadKw: args.itLoadKw, tierLevel: args.tierLevel, coolingType: args.coolingType,
        totalCapex: args.capexTotal ?? args.itLoadKw * 10500, // engine reference $/kW when capex not yet run
        annualRevenue,
        annualOpex: args.opexAnnual ?? annualRevenue * 0.4,   // screening fallback
        totalFTE,
        annualStaffCost: totalFTE * baseSalary * 1.3,
    };
}

/** Run all 5 sibling engines for one candidate site (its country). Null-guarded. */
export function analyzeSite(site: CandidateSite, ctx: SiteAnalysisCtx): SiteAnalyses {
    const country = COUNTRIES[site.countryId];
    const out: SiteAnalyses = { tax: null, disaster: null, grid: null, talent: null, compliance: null };
    if (!country) return out;
    try {
        out.tax = calculateTaxIncentives({
            country, totalCapex: ctx.totalCapex, annualRevenue: ctx.annualRevenue, annualOpex: ctx.annualOpex,
            projectLifeYears: 15, discountRate: 0.10, equipmentCapexShare: 0.6,
        });
    } catch { /* engine guard */ }
    try {
        out.disaster = calculateDisasterRisk({ country, totalCapex: ctx.totalCapex, itLoadKw: ctx.itLoadKw, annualRevenue: ctx.annualRevenue });
    } catch { /* */ }
    try {
        out.grid = calculateGridReliability({ country, itLoadKw: ctx.itLoadKw, tierLevel: ctx.tierLevel, coolingType: ctx.coolingType });
    } catch { /* */ }
    try {
        out.talent = calculateTalentAvailability({ country, totalFTE: ctx.totalFTE, annualStaffCost: ctx.annualStaffCost });
    } catch { /* */ }
    try {
        out.compliance = calculateCompliance(country, ctx.itLoadKw);
    } catch { /* */ }
    return out;
}

/** Radar axes remapped to the INTEGRATED analyses (Phase V, documented):
 *  Site Score (engine site model) · Grid (reliabilityScore) · Disaster Safety
 *  (100−compositeScore) · Tax & Incentives (incentive value vs capex, scaled)
 *  · Talent · Compliance · Water & Cooling + Land & Infra (site factors). */
export function integratedAxes(r: SiteScoreResult, an: SiteAnalyses): { axis: string; score: number }[] {
    const taxScore = an.tax
        ? Math.round(Math.max(5, Math.min(100, (an.tax.totalIncentiveValue / Math.max(1, an.tax.npvWithoutIncentives === 0 ? 1 : Math.abs(an.tax.npvWithoutIncentives))) * 400 + 40)))
        : r.axes.costIncentives;
    return [
        { axis: 'Site Score', score: r.engine.score },
        { axis: 'Grid Reliability', score: an.grid ? Math.round(an.grid.reliabilityScore) : r.axes.powerAvailability },
        { axis: 'Disaster Safety', score: an.disaster ? Math.round(100 - an.disaster.compositeScore) : r.axes.naturalRisks },
        { axis: 'Tax & Incentives', score: taxScore },
        { axis: 'Talent', score: an.talent ? Math.round(an.talent.talentScore) : 60 },
        { axis: 'Compliance', score: an.compliance ? Math.round(an.compliance.complianceScore) : 60 },
        { axis: 'Water & Cooling', score: r.axes.waterCooling },
        { axis: 'Land & Infra', score: r.axes.landInfra },
    ];
}

/* ─── Edit-Criteria PREFILL (owner: "edit criteria harusnya prefill") ────────
 * Effective value shown in the drawer when a site attribute is UNSET:
 * country baseline (COUNTRIES tables, sourced) first, else a labeled
 * SCREENING typical. Display-only — the store stays unset (= baseline
 * semantics in deriveFactors) until the user actually picks/enters a value. */
export function countryBaselineAttributes(countryId: string): Partial<Record<keyof SiteAttributes, number>> {
    const c = COUNTRIES[countryId];
    if (!c) return {};
    const out: Partial<Record<keyof SiteAttributes, number>> = {};
    if (c.environment?.saidiMinYr != null) out.saidiMinYr = c.environment.saidiMinYr;
    if (c.economy?.electricityRate != null) out.powerCostKwh = c.economy.electricityRate;
    if (c.environment?.baselineAQI != null) out.airQualityIndex = c.environment.baselineAQI;
    if (c.environment?.aqueductStressScore != null) out.waterStress0to5 = c.environment.aqueductStressScore;
    if (c.environment?.pgaPct2in50yr != null) out.pgaPct2in50yr = c.environment.pgaPct2in50yr;
    if (c.economy?.taxRate != null) out.effectiveTaxRate = c.economy.taxRate;
    if (c.constructionIndex != null) out.constructionCostIndex = c.constructionIndex;
    return out;
}

/** SCREENING typicals for attributes with no country table (labeled amber in
 *  the drawer; mid-band values for a 5-20 MW AI-DC greenfield screening). */
export const SCREENING_ATTR_DEFAULTS: Partial<Record<keyof SiteAttributes, number>> = {
    availableCapacityMw: 100,        // typical committed utility intake band
    gridVoltageKv: 132,              // dedicated HV intake, hyperscale screening
    submarineCableLandings: 1,
    distanceToCableLandingKm: 50,
    avgAmbientC: 27,                 // tropical/subtropical DC market typical
    coolingDegreeDays: 2500,
    totalAcres: 100,
    usableAcres: 80,
    distHighwayKm: 5,
    distPortKm: 30,
    distAirportKm: 25,
    permitMonths: 12,
    landCostPerM2: 150,
    waterCostPerM3: 1,
};
