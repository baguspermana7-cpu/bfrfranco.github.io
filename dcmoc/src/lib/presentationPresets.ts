/* ─── Presentation presets — five client-ready projects, seeded once ─────────
 * v3.25.0. Owner: "prefill 4–6 scenarios, optimally filled and SAVED, so a
 * client demo can open and show immediately." Each preset is an internally
 * consistent brief (use case → density → cooling → tier → redundancy per the
 * engine use-case profiles and the Results deterministic rules), applied
 * through the stores' OWN setters (so every sanitiser runs), snapshotted with
 * the canonical takeSnapshot() into a ProjectBundle, and summarised with the
 * same engine calls the Dashboard makes (buildScenarioSummary). The user's
 * live configuration is backed up first and restored after — seeding never
 * changes what is on screen and never overwrites a user project (ids demo_*).
 * ──────────────────────────────────────────────────────────────────────── */

import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useRequirementsStore, type ReqOverview, type ReqWorkload, type ReqGrowth, type ReqAvailability, type ReqBusiness } from '@/store/requirements';
import { useSitesStore } from '@/store/sites';
import { useArchitectureStore } from '@/store/architecture';
import { useProjectsStore, takeSnapshot, restoreSnapshot, type ProjectBundle } from '@/store/projects';
import { useScenarioStore, type SavedScenario } from '@/store/scenario';
import { COUNTRIES } from '@/constants/countries';
import { DC_CITIES } from '@/constants/geo';
import { MIX_PRESETS } from '@/lib/requirementsMappings';
import { buildScenarioSummary } from '@/lib/scenarioSummary';
import { syncTariffRevenue } from '@/lib/tariffs';
import type { CandidateSite, SiteAttributes } from '@/types/site-intel';

export const PRESET_SEED_KEY = 'dcmoc_demo_seed';
export const PRESET_SEED_VERSION = '1';
export const PRESET_ID_PREFIX = 'demo_';

type Sim = ReturnType<typeof useSimulationStore.getState>['inputs'];
type Capex = ReturnType<typeof useCapexStore.getState>['inputs'];

export interface PresetSite { name: string; countryId: string; city: string; attributes: SiteAttributes }
export interface PresentationPreset {
    slug: string;
    name: string;
    tagline: string;
    countryId: string;
    sim: Partial<Sim>;
    capex: Partial<Capex>;
    overview: Partial<ReqOverview>;
    workload: Partial<ReqWorkload>;
    growth: Partial<ReqGrowth>;
    availability: Partial<ReqAvailability>;
    business: Omit<Partial<ReqBusiness>, 'budgetUsd'> & { budgetFactor: number };   // budget = factor × engine CAPEX
    archProfileId: 'ai-liquid' | 'ai-rdhx' | 'colo-inrow' | 'enterprise-air';
    criteriaProfileId: 'balanced' | 'ai_training' | 'colocation' | 'enterprise_dr' | 'hyperscale';
    sites: PresetSite[];
    starForComparison: boolean;
}

const city = (cc: string, name: string) => DC_CITIES[cc]?.find((c) => c.name === name) ?? DC_CITIES[cc]?.[0];
const growth = (mw: number, ramp: [number, number, number, number, number]): ReqGrowth['itLoadMwByYear'] =>
    ({ y1: +(mw * ramp[0]).toFixed(1), y2: +(mw * ramp[1]).toFixed(1), y3: +(mw * ramp[2]).toFixed(1), y4: +(mw * ramp[3]).toFixed(1), y5: +(mw * ramp[4]).toFixed(1), y10: mw });

/* Site attributes: only the fields that make the candidates DIFFER (the rest
 * falls back to the country research baseline). Values are screening-grade
 * typicals for each hub, stated in the site card as site attributes. */
export const PRESENTATION_PRESETS: PresentationPreset[] = [
    {
        slug: 'jkt-ai-40', name: 'JKT-AI-40 · AI training campus, Greater Jakarta', tagline: '40 MW · liquid-cooled GPU campus · Tier III · 2N',
        countryId: 'ID',
        sim: { itLoad: 40000, tierLevel: 3, coolingType: 'liquid', coolingTopology: 'dlc', powerRedundancy: '2N', powerSource: 'utility-backup', fuelType: 'diesel', staffingAutoMode: true, maintenanceStrategy: 'predictive', maintenanceModel: 'hybrid', shiftModel: '12h' },
        capex: { itLoad: 40000, location: 'ID', cityMarket: 'jakarta', coolingType: 'liquid', redundancy: '2n', rackType: 'ai', rackForm: 'ocp', seismicZone: 'zone3', greenCert: 'gold', upsType: 'modular', genType: 'diesel', fuelHours: 48, substationType: 'dedicated_132kv', projYear: '2026' },
        overview: { projectName: 'JKT-AI-40 GPU Campus', projectCode: 'RZ-JKT-AI-040', projectOwner: 'Client AI platform team', developmentPartner: 'resistancezero engineering', customer: 'Hyperscale AI tenant (anchor)', utilityProvider: 'PLN (150 kV GI Cikarang)', cityRegion: 'Bekasi-Cikarang', siteStatus: 'shortlisted', industry: 'csp', targetCod: { quarter: 4, year: 2027 }, gridVoltage: '132kV', projectType: 'new_build', contractDurationYr: 15, currency: 'USD', useCase: 'ai' },
        workload: { avgRackDensityKw: 60, maxRackDensityKw: 132, rackForm: 'ocp', workloadMix: MIX_PRESETS.ai, peakItLoadKw: 40000, avgItLoadKw: 34000, mixManual: false },
        growth: { growthType: 'step', itLoadMwByYear: growth(40, [0.5, 1, 1, 1, 1]) },
        availability: { slaTargetPct: 99.982 },
        business: { budgetFactor: 1.08, priorities: ['performance', 'reliability', 'speed', 'sustainability', 'cost'], designMarginPct: 10, revenueModel: 'gaas', gaasSku: 'h200', gaasPricingMode: 'reserved', gaasUtilization: 0.70 },
        archProfileId: 'ai-liquid', criteriaProfileId: 'ai_training', starForComparison: true,
        sites: [
            { name: 'Cikarang industrial estate', countryId: 'ID', city: 'Bekasi-Cikarang', attributes: { availableCapacityMw: 150, gridVoltageKv: 150, pgaPct2in50yr: 45, floodRisk: 'moderate', permitMonths: 14, landCostPerM2: 180, totalAcres: 60, latencies: [{ market: 'Jakarta CBD', ms: 2 }, { market: 'Singapore', ms: 14 }] } },
            { name: 'Batam Nongsa digital park', countryId: 'ID', city: 'Batam', attributes: { availableCapacityMw: 90, gridVoltageKv: 150, pgaPct2in50yr: 8, floodRisk: 'low', permitMonths: 10, landCostPerM2: 120, totalAcres: 45, submarineCableLandings: 3, latencies: [{ market: 'Singapore', ms: 2 }, { market: 'Jakarta CBD', ms: 16 }] } },
            { name: 'Sedenak Tech Park (Johor)', countryId: 'MY', city: 'Johor Bahru', attributes: { availableCapacityMw: 200, gridVoltageKv: 275, pgaPct2in50yr: 5, floodRisk: 'moderate', permitMonths: 9, landCostPerM2: 95, totalAcres: 80, submarineCableLandings: 2, latencies: [{ market: 'Singapore', ms: 1.5 }, { market: 'Jakarta CBD', ms: 18 }] } },
        ],
    },
    {
        slug: 'sg-colo-20', name: 'SG-COLO-20 · Colocation, Singapore / Johor corridor', tagline: '20 MW · in-row · Tier III · N+1 · SLA 99.98 %',
        countryId: 'SG',
        sim: { itLoad: 20000, tierLevel: 3, coolingType: 'inrow', coolingTopology: 'in-row', powerRedundancy: 'N+1', powerSource: 'utility-backup', fuelType: 'diesel', staffingAutoMode: true, maintenanceStrategy: 'planned', maintenanceModel: 'vendor', shiftModel: '12h' },
        capex: { itLoad: 20000, location: 'SG', cityMarket: 'singapore', coolingType: 'inrow', redundancy: 'n1', rackType: 'medium', rackForm: 'std42u', seismicZone: 'zone0', greenCert: 'platinum', upsType: 'modular', genType: 'diesel', fuelHours: 48, substationType: 'dedicated_66kv', projYear: '2026' },
        overview: { projectName: 'SG-COLO-20 Corridor Colocation', projectCode: 'RZ-SG-COLO-020', projectOwner: 'Colocation operator', developmentPartner: 'resistancezero engineering', customer: 'Multi-tenant (enterprise + cloud on-ramp)', utilityProvider: 'SP Group / TNB (Johor option)', cityRegion: 'Singapore', siteStatus: 'identified', industry: 'colo_provider', targetCod: { quarter: 2, year: 2028 }, gridVoltage: '220kV', projectType: 'new_build', contractDurationYr: 10, currency: 'USD', useCase: 'cloud' },
        workload: { avgRackDensityKw: 12, maxRackDensityKw: 30, rackForm: 'std42u', workloadMix: MIX_PRESETS.cloud, peakItLoadKw: 20000, avgItLoadKw: 15000, mixManual: false },
        growth: { growthType: 'linear', itLoadMwByYear: growth(20, [0.3, 0.55, 0.75, 0.9, 1]) },
        availability: { slaTargetPct: 99.98 },
        business: { budgetFactor: 1.05, priorities: ['reliability', 'cost', 'speed', 'performance', 'sustainability'], designMarginPct: 10, revenueModel: 'retail_colo' },
        archProfileId: 'colo-inrow', criteriaProfileId: 'colocation', starForComparison: true,
        sites: [
            { name: 'Singapore (Tuas / Jurong West)', countryId: 'SG', city: 'Singapore', attributes: { availableCapacityMw: 20, gridVoltageKv: 66, pgaPct2in50yr: 2, floodRisk: 'low', permitMonths: 22, landCostPerM2: 1800, totalAcres: 6, submarineCableLandings: 26, latencies: [{ market: 'Singapore CBD', ms: 0.5 }, { market: 'Jakarta', ms: 14 }] } },
            { name: 'Nusajaya Tech Park (Johor)', countryId: 'MY', city: 'Johor Bahru', attributes: { availableCapacityMw: 120, gridVoltageKv: 132, pgaPct2in50yr: 5, floodRisk: 'moderate', permitMonths: 8, landCostPerM2: 110, totalAcres: 30, submarineCableLandings: 2, latencies: [{ market: 'Singapore CBD', ms: 1.5 }, { market: 'Kuala Lumpur', ms: 5 }] } },
            { name: 'Batam Kabil (Indonesia)', countryId: 'ID', city: 'Batam', attributes: { availableCapacityMw: 60, gridVoltageKv: 150, pgaPct2in50yr: 8, floodRisk: 'low', permitMonths: 12, landCostPerM2: 100, totalAcres: 35, submarineCableLandings: 3, latencies: [{ market: 'Singapore CBD', ms: 2 }, { market: 'Jakarta', ms: 16 }] } },
        ],
    },
    {
        slug: 'sby-dr-5', name: 'SBY-DR-5 · Enterprise DR site, East Java', tagline: '5 MW · air-cooled · Tier III · N+1 · financial-services DR',
        countryId: 'ID',
        sim: { itLoad: 5000, tierLevel: 3, coolingType: 'air', coolingTopology: 'perimeter', powerRedundancy: 'N+1', powerSource: 'utility-backup', fuelType: 'diesel', staffingAutoMode: true, maintenanceStrategy: 'planned', maintenanceModel: 'in-house', shiftModel: '8h' },
        capex: { itLoad: 5000, location: 'ID', cityMarket: 'surabaya', coolingType: 'air', redundancy: 'n1', rackType: 'standard', rackForm: 'std42u', seismicZone: 'zone2', greenCert: 'none', upsType: 'modular', genType: 'diesel', fuelHours: 72, substationType: 'dedicated_33kv', projYear: '2026' },
        overview: { projectName: 'SBY-DR-5 Disaster Recovery Centre', projectCode: 'RZ-SBY-DR-005', projectOwner: 'Bank group IT infrastructure', developmentPartner: 'resistancezero engineering', customer: 'In-house (bank DR)', utilityProvider: 'PLN UID Jawa Timur (20 kV)', cityRegion: 'Surabaya', siteStatus: 'shortlisted', industry: 'financial', targetCod: { quarter: 3, year: 2027 }, gridVoltage: '20kV', projectType: 'new_build', contractDurationYr: 20, currency: 'USD', useCase: 'dr' },
        workload: { avgRackDensityKw: 8, maxRackDensityKw: 15, rackForm: 'std42u', workloadMix: MIX_PRESETS.dr, peakItLoadKw: 5000, avgItLoadKw: 3000, mixManual: false },
        growth: { growthType: 'linear', itLoadMwByYear: growth(5, [0.6, 0.8, 1, 1, 1]) },
        availability: { slaTargetPct: 99.982 },
        business: { budgetFactor: 1.10, priorities: ['reliability', 'cost', 'speed', 'sustainability', 'performance'], designMarginPct: 15, revenueModel: 'enterprise_self' },
        archProfileId: 'enterprise-air', criteriaProfileId: 'enterprise_dr', starForComparison: true,
        sites: [
            { name: 'Surabaya Industrial Estate Rungkut', countryId: 'ID', city: 'Surabaya', attributes: { availableCapacityMw: 30, gridVoltageKv: 20, pgaPct2in50yr: 25, floodRisk: 'moderate', permitMonths: 9, landCostPerM2: 140, totalAcres: 8, latencies: [{ market: 'Jakarta (primary DC)', ms: 12 }, { market: 'Surabaya CBD', ms: 1 }] } },
            { name: 'Jakarta (co-located with primary)', countryId: 'ID', city: 'Jakarta', attributes: { availableCapacityMw: 40, gridVoltageKv: 20, pgaPct2in50yr: 45, floodRisk: 'extreme', permitMonths: 12, landCostPerM2: 650, totalAcres: 4, latencies: [{ market: 'Jakarta (primary DC)', ms: 1 }] } },
        ],
    },
    {
        slug: 'cyb-hpc-15', name: 'CYB-HPC-15 · HPC research facility, Malaysia', tagline: '15 MW · rear-door HX · Tier III · 2N · government research',
        countryId: 'MY',
        sim: { itLoad: 15000, tierLevel: 3, coolingType: 'rdhx', coolingTopology: 'in-row', powerRedundancy: '2N', powerSource: 'utility-backup', fuelType: 'diesel', staffingAutoMode: true, maintenanceStrategy: 'predictive', maintenanceModel: 'hybrid', shiftModel: '12h' },
        capex: { itLoad: 15000, location: 'MY', cityMarket: 'malaysia', coolingType: 'rdhx', redundancy: '2n', rackType: 'high', rackForm: 'tall48u', seismicZone: 'zone1', greenCert: 'gold', upsType: 'modular', genType: 'diesel', fuelHours: 48, substationType: 'dedicated_132kv', projYear: '2026' },
        overview: { projectName: 'CYB-HPC-15 National Research Compute', projectCode: 'RZ-CYB-HPC-015', projectOwner: 'National research agency', developmentPartner: 'resistancezero engineering', customer: 'University + public research consortium', utilityProvider: 'TNB (132 kV)', cityRegion: 'Cyberjaya', siteStatus: 'shortlisted', industry: 'government', targetCod: { quarter: 1, year: 2028 }, gridVoltage: '132kV', projectType: 'new_build', contractDurationYr: 15, currency: 'USD', useCase: 'hpc' },
        workload: { avgRackDensityKw: 45, maxRackDensityKw: 80, rackForm: 'tall48u', workloadMix: MIX_PRESETS.hpc, peakItLoadKw: 15000, avgItLoadKw: 12000, mixManual: false },
        growth: { growthType: 'step', itLoadMwByYear: growth(15, [0.5, 1, 1, 1, 1]) },
        availability: { slaTargetPct: 99.982 },
        business: { budgetFactor: 1.08, priorities: ['performance', 'sustainability', 'reliability', 'cost', 'speed'], designMarginPct: 10, revenueModel: 'gpu_colo' },
        archProfileId: 'ai-rdhx', criteriaProfileId: 'balanced', starForComparison: true,
        sites: [
            { name: 'Cyberjaya core zone', countryId: 'MY', city: 'Cyberjaya', attributes: { availableCapacityMw: 60, gridVoltageKv: 132, pgaPct2in50yr: 5, floodRisk: 'low', permitMonths: 8, landCostPerM2: 160, totalAcres: 20, latencies: [{ market: 'Kuala Lumpur', ms: 1 }, { market: 'Singapore', ms: 6 }] } },
            { name: 'Bayan Lepas (Penang)', countryId: 'MY', city: 'Kuala Lumpur', attributes: { availableCapacityMw: 40, gridVoltageKv: 132, pgaPct2in50yr: 6, floodRisk: 'moderate', permitMonths: 10, landCostPerM2: 130, totalAcres: 25, latencies: [{ market: 'Kuala Lumpur', ms: 5 }, { market: 'Singapore', ms: 10 }] } },
        ],
    },
    {
        slug: 'btm-hyper-100', name: 'BTM-HYPER-100 · Hyperscale campus, Batam / Johor', tagline: '100 MW phased 25 / 25 / 50 · liquid · Tier IV · 2N+1',
        countryId: 'ID',
        sim: { itLoad: 100000, tierLevel: 4, coolingType: 'liquid', coolingTopology: 'dlc', powerRedundancy: '2N+1', powerSource: 'utility-backup', fuelType: 'hvo', staffingAutoMode: true, maintenanceStrategy: 'predictive', maintenanceModel: 'hybrid', shiftModel: '12h',
            capacityPhasesCustomized: true,
            capacityPhases: [
                { id: 'p1', label: 'Phase 1 — 25 MW', itLoadKw: 25000, startMonth: 0, buildMonths: 20, occupancyRamp: [0.4, 0.7, 0.9, 0.95] },
                { id: 'p2', label: 'Phase 2 — 25 MW', itLoadKw: 25000, startMonth: 20, buildMonths: 14, occupancyRamp: [0.4, 0.7, 0.9, 0.95] },
                { id: 'p3', label: 'Phase 3 — 50 MW', itLoadKw: 50000, startMonth: 34, buildMonths: 18, occupancyRamp: [0.3, 0.6, 0.85, 0.95] },
            ] },
        capex: { itLoad: 100000, location: 'ID', cityMarket: 'batam', coolingType: 'liquid', redundancy: '2n1', rackType: 'ai', rackForm: 'ocp', seismicZone: 'zone1', greenCert: 'platinum', upsType: 'distributed', genType: 'hvo', fuelHours: 48, substationType: 'dedicated_132kv', projYear: '2026' },
        overview: { projectName: 'BTM-HYPER-100 Cross-Strait Campus', projectCode: 'RZ-BTM-HYP-100', projectOwner: 'Hyperscale cloud provider', developmentPartner: 'resistancezero engineering', customer: 'Self-build (cloud region)', utilityProvider: 'PLN Batam (150 kV) / TNB option', cityRegion: 'Batam', siteStatus: 'identified', industry: 'csp', targetCod: { quarter: 4, year: 2028 }, gridVoltage: '132kV', projectType: 'new_build', contractDurationYr: 20, currency: 'USD', useCase: 'cloud' },
        workload: { avgRackDensityKw: 60, maxRackDensityKw: 132, rackForm: 'ocp', workloadMix: { aiGpu: 50, storage: 20, general: 20, network: 10 }, peakItLoadKw: 100000, avgItLoadKw: 70000, mixManual: true },
        growth: { growthType: 'step', itLoadMwByYear: growth(100, [0.25, 0.5, 0.5, 1, 1]) },
        availability: { slaTargetPct: 99.995 },
        business: { budgetFactor: 1.06, priorities: ['reliability', 'sustainability', 'performance', 'cost', 'speed'], designMarginPct: 10, revenueModel: 'hyperscale_lease' },
        archProfileId: 'ai-liquid', criteriaProfileId: 'hyperscale', starForComparison: false,
        sites: [
            { name: 'Batam Tanjung Uncang campus', countryId: 'ID', city: 'Batam', attributes: { availableCapacityMw: 150, gridVoltageKv: 150, pgaPct2in50yr: 8, floodRisk: 'low', permitMonths: 12, landCostPerM2: 90, totalAcres: 120, submarineCableLandings: 3, latencies: [{ market: 'Singapore', ms: 2 }, { market: 'Jakarta', ms: 16 }] } },
            { name: 'Sedenak Tech Park (Johor)', countryId: 'MY', city: 'Johor Bahru', attributes: { availableCapacityMw: 300, gridVoltageKv: 275, pgaPct2in50yr: 5, floodRisk: 'moderate', permitMonths: 9, landCostPerM2: 95, totalAcres: 150, submarineCableLandings: 2, latencies: [{ market: 'Singapore', ms: 1.5 }, { market: 'Kuala Lumpur', ms: 5 }] } },
            { name: 'Chonburi EEC (Thailand)', countryId: 'TH', city: 'Chonburi (EEC)', attributes: { availableCapacityMw: 200, gridVoltageKv: 230, pgaPct2in50yr: 6, permitMonths: 11, landCostPerM2: 85, totalAcres: 140, latencies: [{ market: 'Bangkok', ms: 2 }, { market: 'Singapore', ms: 25 }] } },
        ],
    },
];

const siteOf = (ps: PresetSite, i: number, slug: string, now: number): CandidateSite => {
    const c = city(ps.countryId, ps.city);
    return {
        id: `${PRESET_ID_PREFIX}${slug}_site_${i}`, name: ps.name, label: 'ABCDE'[i] ?? String(i + 1), countryId: ps.countryId, city: ps.city,
        lat: c?.lat ?? 0, lng: c?.lng ?? 0, attributes: ps.attributes, createdAt: now, updatedAt: now,
    };
};

/** Apply one preset to the live stores (through their setters) and return the bundle + scenario. */
function materialise(p: PresentationPreset, now: number): { bundle: ProjectBundle; scenario: SavedScenario } {
    const sim = useSimulationStore.getState();
    sim.actions.selectCountry(p.countryId);
    sim.actions.setInputs(p.sim);
    useCapexStore.getState().setInputs({ ...p.capex, country: COUNTRIES[p.countryId] });
    const req = useRequirementsStore.getState().actions;
    req.setOverview(p.overview);
    req.setWorkload(p.workload);
    req.setGrowth(p.growth);
    req.setAvailability(p.availability);
    const capexTotal = useCapexStore.getState().results?.total ?? 0;
    const { budgetFactor, ...business } = p.business;
    req.setBusiness({ ...business, budgetUsd: capexTotal > 0 ? Math.round(capexTotal * budgetFactor / 1e5) * 1e5 : null });
    syncTariffRevenue();   // revenue basis + GaaS hardware capex follow the preset's business model
    try { useArchitectureStore.getState().actions.set({ profileId: p.archProfileId }); } catch { /* architecture store optional */ }
    const sites = p.sites.map((s, i) => siteOf(s, i, p.slug, now));
    useSitesStore.setState({
        sites, selectedSiteId: sites[0].id, comparisonIds: sites.map((s) => s.id), lastRunAt: now,
        criteria: { profileId: p.criteriaProfileId, gatesEnabled: {}, adoptedSiteId: null },
    });
    const simNow = useSimulationStore.getState();
    const bundle: ProjectBundle = {
        id: `${PRESET_ID_PREFIX}${p.slug}`, name: p.name, version: 1, createdAt: now, updatedAt: now,
        countryId: p.countryId, itLoadKw: simNow.inputs.itLoad, snapshot: takeSnapshot(),
    };
    const scenario: SavedScenario = {
        id: `${PRESET_ID_PREFIX}sc_${p.slug}`, name: p.name.split(' · ')[0], timestamp: now, countryId: p.countryId,
        simInputs: JSON.parse(JSON.stringify(simNow.inputs)), capexInputs: JSON.parse(JSON.stringify(useCapexStore.getState().inputs)),
        summary: buildScenarioSummary(),
    };
    return { bundle, scenario };
}

export interface SeedReport { seeded: number; skipped: 'done' | 'full' | 'readonly' | null }

/** Seed the presets (idempotent, additive). `force` re-materialises and replaces demo_* entries only. */
export function seedPresentationPresets(opts: { force?: boolean } = {}): SeedReport {
    if (typeof window === 'undefined') return { seeded: 0, skipped: null };
    const projects = useProjectsStore.getState();
    if (projects.readOnly) return { seeded: 0, skipped: 'readonly' };
    let marker: string | null = null;
    try { marker = localStorage.getItem(PRESET_SEED_KEY); } catch { /* storage unavailable */ }
    const haveAll = PRESENTATION_PRESETS.every((p) => projects.projects.some((x) => x.id === PRESET_ID_PREFIX + p.slug));
    if (!opts.force && (marker === PRESET_SEED_VERSION || haveAll)) return { seeded: 0, skipped: 'done' };
    const userProjects = projects.projects.filter((x) => !x.id.startsWith(PRESET_ID_PREFIX));
    if (userProjects.length + PRESENTATION_PRESETS.length > 10) return { seeded: 0, skipped: 'full' };

    /* backup the live configuration — seeding must not change what is on screen */
    const backup = takeSnapshot();
    const backupCountry = useSimulationStore.getState().selectedCountry?.id ?? null;
    const backupActive = projects.activeProjectId;
    const backupSites = { selectedSiteId: useSitesStore.getState().selectedSiteId, comparisonIds: useSitesStore.getState().comparisonIds, lastRunAt: useSitesStore.getState().lastRunAt };
    const now = Date.now();
    const made: { bundle: ProjectBundle; scenario: SavedScenario }[] = [];
    try {
        PRESENTATION_PRESETS.forEach((p, i) => made.push(materialise(p, now - i)));   // distinct timestamps keep list order stable
    } finally {
        restoreSnapshot(backup);
        if (backupCountry) useSimulationStore.getState().actions.selectCountry(backupCountry);
        useSitesStore.setState({ ...backupSites });
    }
    const kept = useProjectsStore.getState().projects.filter((x) => !x.id.startsWith(PRESET_ID_PREFIX));
    useProjectsStore.setState({ projects: [...made.map((m) => m.bundle), ...kept].slice(0, 10), activeProjectId: backupActive });
    try { localStorage.setItem('dcmoc_projects_v1', JSON.stringify({ projects: useProjectsStore.getState().projects, activeProjectId: backupActive })); } catch { /* quota */ }
    const sc = useScenarioStore.getState();
    if (opts.force) {
        made.forEach((m) => { if (sc.scenarios.some((s) => s.id === m.scenario.id)) sc.deleteScenario(m.scenario.id); });
    }
    useScenarioStore.getState().addScenarios(made.map((m) => m.scenario));
    const stars = PRESENTATION_PRESETS.filter((p) => p.starForComparison).map((p) => `${PRESET_ID_PREFIX}sc_${p.slug}`);
    if (useScenarioStore.getState().comparisonIds.length === 0 || opts.force) useScenarioStore.getState().setComparisonIds(stars);
    try { localStorage.setItem(PRESET_SEED_KEY, PRESET_SEED_VERSION); } catch { /* storage unavailable */ }
    return { seeded: made.length, skipped: null };
}

export function presetsMissing(): number {
    const have = new Set(useProjectsStore.getState().projects.map((p) => p.id));
    return PRESENTATION_PRESETS.filter((p) => !have.has(PRESET_ID_PREFIX + p.slug)).length;
}
