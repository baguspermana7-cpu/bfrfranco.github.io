/* ─── VALUE TRACE INDEX (PHASE EB) ───────────────────────────────────────────
 * Excel-style precedent tracing: every instrumented number resolves to a LIVE
 * tree — value, formula with live numbers substituted, and its source values,
 * recursively down to leaf inputs / DATA constants ("sampai titik paling
 * ujung"). ids stay consistent with value-bindings.ts + data-bind anchors.
 * Graph MUST be acyclic (gate-checked in tools/test-value-bindings.mjs).
 * ──────────────────────────────────────────────────────────────────────── */

import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useRequirementsStore } from '@/store/requirements';
import { useSitesStore } from '@/store/sites';
import { COUNTRIES } from '@/constants/countries';
import { buildAnalysisCtx, analyzeSite, scoreAllSites, type SiteAnalyses } from '@/lib/site-adapter';
import { calculateAutoHeadcount, calculateStaffing, type StaffRole } from '@/modules/staffing/ShiftEngine';
import { rzData, rzModels } from '@/lib/rz-engine';
/* EB wave (Staffing/Construction/Commissioning/Results/Asset) — live readers */
import { useConstructionTracking } from '@/store/constructionTracking';
import { plannedSchedule, evm, type PlannedSchedule, type EvmResult } from '@/state/adapters/construction-adapter';
import { useCxTracking, checklistDerivedCompletion } from '@/store/cxTracking';
import { CX_CHECKLIST, type ReadinessKey } from '@/lib/cx-procedures';
import { densityToEngineBucket } from '@/lib/requirementsMappings';
/* EB-cov wave (trace-coverage ≥60% halaman inti) — live readers */
import { useOpsLog } from '@/store/opsLog';
import { getPUE } from '@/constants/pue';
import { riskBand } from '@/state/adapters/capex-adapter';
import { sanitizeCap, facilitySnapshot, utilization, forecastSeries, type UtilRow } from '@/state/adapters/capacity-adapter';
import { calculateFinancials, defaultOccupancyRamp, type FinancialResult } from '@/modules/analytics/FinancialEngine';
import { DEFAULT_REVENUE_PER_KW_MONTH } from '@/constants/finance';
/* EB-finsus wave (Financial + Sustainability telemetry ≥60%) — live readers */
import { useFinancialTracking } from '@/store/financialTracking';
import { useSustainability } from '@/store/sustainability';

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

export const TRACE: Record<string, TraceNode> = {
    /* ── LEAF INPUTS (titik paling ujung — user-owned) ── */
    'sim.itLoad': { label: 'IT Load', page: 'requirements', unit: 'kW', provenance: 'input', get: () => sim().inputs.itLoad },
    'sim.tierLevel': { label: 'Tier Level', page: 'requirements', provenance: 'input', get: () => sim().inputs.tierLevel },
    'sim.electricityRate': { label: 'Electricity Tariff (country)', page: 'requirements', unit: '$/kWh', provenance: 'input', external: { href: '/dc-market-tracker.html', label: 'DC market tracker (tarif per negara)' }, get: () => sim().selectedCountry?.economy.electricityRate ?? null },
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
    'capex.total': {
        label: 'CAPEX Total (P50)', page: 'capex', unit: '$', provenance: 'engine',
        formulaTemplate: 'CapexEngine.calculateCapex(sim.itLoad, capex.contingencyPct, …semua asumsi CAPEX)',
        deps: ['sim.itLoad', 'capex.contingencyPct'],
        get: () => cap().results?.total ?? null,
    },
    'capex.perKw': {
        label: 'CAPEX $/kW', page: 'capex', unit: '$/kW', provenance: 'derived',
        formulaTemplate: 'capex.total ÷ sim.itLoad',
        deps: ['capex.total', 'sim.itLoad'],
        get: () => { const t = cap().results?.total; return t ? +(t / Math.max(1, cap().inputs.itLoad)).toFixed(0) : null; },
    },
    /* ── EB batch-3: opex / staffing / availability chains ── */
    'staff.fte': {
        label: 'Total FTE (auto headcount)', page: 'staff', provenance: 'derived',
        formulaTemplate: 'core shift 24×7 + marginal × (sim.itLoad ÷ 1000 ÷ 10)^0.65 — kalibrasi benchmark Uptime',
        deps: ['sim.itLoad'],
        get: () => {
            const i = sim().inputs;
            return (i.headcount_ShiftLead ?? 0) + (i.headcount_Engineer ?? 0) + (i.headcount_Technician ?? 0) + (i.headcount_Admin ?? 0) + (i.headcount_Janitor ?? 0);
        },
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
        label: 'OPEX Tahunan (dcContract)', page: 'finance', unit: '$', provenance: 'engine',
        formulaTemplate: 'models.opex.totalAnnual(sim.itLoad, negara, staff.fte — basis dcContract)',
        deps: ['sim.itLoad', 'staff.fte'],
        get: () => {
            try {
                const m = (rzModels() as { opex?: { totalAnnual?: (inp: Record<string, unknown>) => { total?: number } } }).opex;
                const r = m?.totalAnnual?.({ itLoadKw: sim().inputs.itLoad, countryId: sim().selectedCountry?.id, basisPreset: 'dcContract' });
                return r?.total ?? null;
            } catch { return null; }
        },
    },
    'cap.totalMw': {
        label: 'Total Capacity (committed phases)', page: 'capacity', unit: 'MW', provenance: 'derived',
        formulaTemplate: 'Σ fase (capacityPhases) — pristine mengikuti sim.itLoad',
        deps: ['sim.itLoad'],
        get: () => +(sim().inputs.capacityPhases.reduce((a, p) => a + p.itLoadKw, 0) / 1000).toFixed(1),
    },
    'carbon.annualEmissions': {
        label: 'Emisi Tahunan (Scope 1+2+3)', page: 'carbon', unit: 'tCO₂', provenance: 'derived',
        formulaTemplate: 'ops.annualEnergyMwh × grid carbon intensity negara (+Scope 1 genset & Scope 3)',
        deps: ['ops.annualEnergyMwh'],
        get: () => {
            const e = TRACE['ops.annualEnergyMwh'].get();
            const gi = sim().selectedCountry?.environment.gridCarbonIntensity;
            return e && gi ? +(e * gi).toFixed(0) : null;
        },
    },
    'fin.npvScreening': {
        label: 'NPV (screening 10 thn)', page: 'finance', unit: '$', provenance: 'derived',
        formulaTemplate: '(pendapatan − opex.totalAnnual) diskonto 10% selama 10 thn − capex.total (screening; pro-forma penuh di Financial)',
        deps: ['capex.total', 'opex.totalAnnual'],
        get: () => {
            const cap = TRACE['capex.total'].get(); const op = TRACE['opex.totalAnnual'].get();
            if (!cap || !op) return null;
            const rev = sim().inputs.itLoad * 150 * 12;   // basis screening lib/screening.ts
            let npv = -cap;
            for (let y = 1; y <= 10; y++) npv += (rev - op) / Math.pow(1.10, y);
            return +npv.toFixed(0);
        },
    },
    /* ── EB-instrument: page-KPI nodes (append-only) ── */
    'ops.energyCostDaily': {
        label: 'Energy Cost (24h)', page: 'ops', unit: '$', provenance: 'derived',
        formulaTemplate: 'ops.energyCost ÷ 365',
        deps: ['ops.energyCost'],
        get: () => { const a = TRACE['ops.energyCost'].get(); return a == null ? null : +(a / 365).toFixed(0); },
    },
    /* ── SITE INTELLIGENCE — integrated analyses (selected site; 5 sibling engines) ── */
    /* Grid Reliability card (GridReliabilityEngine) */
    'site.gridScore': {
        label: 'Grid Reliability Score', page: 'grid', unit: '/100', provenance: 'engine',
        formulaTemplate: '50% skor lokal (uptime grid 40% + stabilitas tegangan 20% + frekuensi brownout 20% + durasi outage 20%) + 50% × models.grid.score(gridUptime) — baseline grid negara situs terpilih',
        get: () => { const g = siteAn()?.grid; return g ? Math.round(g.reliabilityScore) : null; },
    },
    'site.gridOutages': {
        label: 'Expected Outages', page: 'grid', unit: '/yr', provenance: 'engine',
        formulaTemplate: 'brownoutFrequency + (100 − gridUptime%) × 365 ÷ 100 — baseline grid negara situs',
        get: () => { const g = siteAn()?.grid; return g ? +g.annualExpectedOutages.toFixed(1) : null; },
    },
    'site.gridOutageMin': {
        label: 'Outage Minutes', page: 'grid', unit: 'min/yr', provenance: 'engine',
        formulaTemplate: 'models.grid.annualOutageHours(gridUptime) × 60 (fallback: expected outages × durasi rata-rata outage negara)',
        get: () => { const g = siteAn()?.grid; return g ? Math.round(g.annualOutageMinutes) : null; },
    },
    'site.gridGenCapacity': {
        label: 'Required Gen Capacity', page: 'grid', unit: 'MW', provenance: 'derived',
        formulaTemplate: 'ceil(sim.itLoad × PUE(cooling) × redundansi tier — sim.tierLevel 4→2.0 / 3→1.5 / 2→1.25) ÷ 1000',
        deps: ['sim.itLoad', 'sim.tierLevel'],
        get: () => { const g = siteAn()?.grid; return g ? +(g.requiredGenCapacity / 1000).toFixed(1) : null; },
    },
    'site.gridFuelCost': {
        label: 'Annual Fuel Cost (genset)', page: 'grid', unit: '$/yr', provenance: 'derived',
        formulaTemplate: 'kapasitas genset (site.gridGenCapacity, dalam kW) × jam operasi (site.gridOutageMin ÷ 60 + 12% jam uji berkala) × 0.27 L/kWh × $1.25/L × (1 + premium BBM negara)',
        deps: ['site.gridGenCapacity', 'site.gridOutageMin'],
        get: () => siteAn()?.grid?.annualFuelCost ?? null,
    },
    /* Disaster Risk card (DisasterRiskEngine) */
    'site.riskComposite': {
        label: 'Composite Disaster Risk', page: 'disaster', unit: '/100', provenance: 'engine',
        formulaTemplate: 'models.risk.geo(bahaya negara) — bobot: seismik 28% + banjir 22% + topan 18% + vulkanik 12% + tsunami 10% + wildfire 10% (lebih rendah = lebih baik)',
        get: () => { const d = siteAn()?.disaster; return d ? Math.round(d.compositeScore) : null; },
    },
    'site.riskInsurance': {
        label: 'Annual Insurance Cost', page: 'disaster', unit: '$/yr', provenance: 'derived',
        formulaTemplate: 'capex.total (fallback sim.itLoad × $10,500/kW) × tarif asuransi per band site.riskComposite (≥60→0.35% · ≥35→0.22% · <35→0.18%) × insuranceMultiplier negara',
        deps: ['capex.total', 'sim.itLoad', 'site.riskComposite'],
        get: () => siteAn()?.disaster?.annualInsuranceCost ?? null,
    },
    'site.riskEal': {
        label: 'Expected Annual Loss', page: 'disaster', unit: '$/yr', provenance: 'derived',
        formulaTemplate: '(site.riskComposite ÷ 1250 probabilitas loss) × (15% × capex.total + 25% × pendapatan tahunan screening dari sim.itLoad)',
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
        formulaTemplate: 'site.riskBiDays × pendapatan harian (revenuePerKwMonth × sim.itLoad × 12 ÷ 365)',
        deps: ['site.riskBiDays', 'sim.itLoad'],
        get: () => siteAn()?.disaster?.revenueAtRisk ?? null,
    },
    /* Tax & Incentives card (TaxIncentiveEngine) */
    'site.taxIncentiveValue': {
        label: 'Total Incentive Value (15 thn)', page: 'tax', unit: '$', provenance: 'derived',
        formulaTemplate: 'site.taxFtz + subsidi lahan + ITC/bonus-depresiasi (US) + Σ penghematan pajak tahunan (tax holiday vs tarif standar negara, atas laba screening dari sim.itLoad & capex.total) terdiskonto 10%',
        deps: ['site.taxFtz', 'capex.total', 'sim.itLoad'],
        get: () => siteAn()?.tax?.totalIncentiveValue ?? null,
    },
    'site.taxFtz': {
        label: 'FTZ Benefits (bea impor)', page: 'tax', unit: '$', provenance: 'derived',
        formulaTemplate: 'exemption bea impor: capex.total (fallback sim.itLoad × $10,500/kW) × 60% porsi equipment × tarif bea negara (ID/IN 7.5% · US 3% · CN 8% · lainnya 5%); 0 bila negara tanpa exemption',
        deps: ['capex.total', 'sim.itLoad'],
        get: () => siteAn()?.tax?.ftzBenefits ?? null,
    },
    'site.taxNpvWith': {
        label: 'NPV with Incentives', page: 'tax', unit: '$', provenance: 'derived',
        formulaTemplate: 'NPV 15 thn @10%: −capex.total + Σ (pendapatan eskalasi 3% − opex eskalasi 4% − pajak tarif efektif dgn insentif); pendapatan screening dari sim.itLoad',
        deps: ['capex.total', 'sim.itLoad'],
        get: () => siteAn()?.tax?.npvWithIncentives ?? null,
    },
    'site.taxNpvUplift': {
        label: 'NPV Uplift (insentif)', page: 'tax', unit: '$', provenance: 'derived',
        formulaTemplate: 'max(0, site.taxNpvWith − NPV tanpa insentif (tarif pajak standar penuh))',
        deps: ['site.taxNpvWith'],
        get: () => { const t = siteAn()?.tax; return t ? Math.max(0, t.npvWithIncentives - t.npvWithoutIncentives) : null; },
    },
    'site.taxIrrWith': {
        label: 'IRR with Incentives', page: 'tax', unit: '%', provenance: 'derived',
        formulaTemplate: 'IRR arus kas 15 thn dengan insentif (models.roi.irr; tahun-0 = −capex.total, arus tahunan = pendapatan screening sim.itLoad − opex − pajak efektif)',
        deps: ['capex.total', 'sim.itLoad'],
        get: () => { const t = siteAn()?.tax; return t ? +t.irrWithIncentives.toFixed(1) : null;  /* engine already returns percent */ },
    },
    /* Talent Availability card (TalentAvailabilityEngine) */
    'site.talentScore': {
        label: 'Talent Score', page: 'talent', unit: '/100', provenance: 'engine',
        formulaTemplate: 'pool engineer DC 30% + pipeline universitas 20% + kompetisi hyperscaler 25% + kecepatan hiring 15% + sertifikasi profesional 10% — baseline talentPool negara situs',
        get: () => { const t = siteAn()?.talent; return t ? Math.round(t.talentScore) : null; },
    },
    'site.talentTimeToStaff': {
        label: 'Time to Full Staff', page: 'talent', unit: 'mo', provenance: 'derived',
        formulaTemplate: 'staff.fte ÷ hire per bulan (2 rekrutmen paralel, avgHiringDays negara ÷ 30)',
        deps: ['staff.fte'],
        get: () => { const t = siteAn()?.talent; return t ? +t.timeToFullStaff.toFixed(1) : null; },
    },
    'site.talentRecruitCost': {
        label: 'Total Recruitment Cost', page: 'talent', unit: '$', provenance: 'derived',
        formulaTemplate: '(avgHiringDays negara × $150/hari biaya rekruter × premi gaji negara) × staff.fte',
        deps: ['staff.fte'],
        get: () => siteAn()?.talent?.totalRecruitmentCost ?? null,
    },
    'site.talentTraining': {
        label: 'Annual Training Cost', page: 'talent', unit: '$/yr', provenance: 'derived',
        formulaTemplate: 'ceil(staff.fte × site.talentTurnover) hire baru/thn × $4,200 CDCP/CDCS × 1.5 overhead onboarding',
        deps: ['staff.fte', 'site.talentTurnover'],
        get: () => siteAn()?.talent?.annualTrainingCost ?? null,
    },
    'site.talentTurnover': {
        label: 'Adjusted Turnover Rate', page: 'talent', unit: '%/yr', provenance: 'engine',
        formulaTemplate: 'baseline 15% + penyesuaian kelangkaan pool (0–12%) + penyesuaian kompetisi hyperscaler (0–4%) — talentPool negara situs',
        get: () => { const t = siteAn()?.talent; return t ? +(t.adjustedTurnoverRate * 100).toFixed(1) : null; },
    },
    /* Compliance card (ComplianceEngine) */
    'site.compScore': {
        label: 'Compliance Score', page: 'compliance', unit: '/100', provenance: 'engine',
        formulaTemplate: 'cakupan framework (jumlah item ÷ 14) × 60 + rasio item mandatory × 40 — framework regulasi negara situs',
        get: () => { const c = siteAn()?.compliance; return c ? Math.round(c.complianceScore) : null; },
    },
    'site.compMandatory': {
        label: 'Mandatory Compliance Items', page: 'compliance', provenance: 'engine',
        formulaTemplate: 'jumlah item wajib pada framework kepatuhan negara situs (fire / electrical / environmental / building / data-protection / telecom)',
        get: () => siteAn()?.compliance?.mandatoryCount ?? null,
    },
    'site.compInitialCost': {
        label: 'Compliance Initial Cost', page: 'compliance', unit: '$', provenance: 'derived',
        formulaTemplate: 'Σ biaya awal semua item framework negara — item skala-fasilitas (AMDAL / building permit) dikali max(1, sim.itLoad ÷ 2500)',
        deps: ['sim.itLoad'],
        get: () => siteAn()?.compliance?.totalInitialCost ?? null,
    },
    'site.compAnnualCost': {
        label: 'Compliance Annual Cost', page: 'compliance', unit: '$/yr', provenance: 'derived',
        formulaTemplate: 'Σ biaya tahunan item framework negara (blend dgn models.compliance.annualCost bila selisih <50%) — beberapa item diskala sim.itLoad',
        deps: ['sim.itLoad'],
        get: () => siteAn()?.compliance?.totalAnnualCost ?? null,
    },
    /* SITE detail-panel country-baseline leaves (site attribute override → else DATA.countries baseline) */
    'site.saidi': {
        label: 'SAIDI (situs terpilih)', page: 'site', unit: 'min/yr', provenance: 'input',
        formulaTemplate: 'atribut situs bila diisi (Edit Criteria), else country baseline (DATA.countries environment.saidiMinYr)',
        get: () => { const s = siteSel(); return s?.attributes.saidiMinYr ?? siteCountry()?.environment?.saidiMinYr ?? null; },
    },
    'site.powerCostKwh': {
        label: 'Power Cost (situs terpilih)', page: 'site', unit: '$/kWh', provenance: 'input',
        formulaTemplate: 'atribut situs bila diisi (Edit Criteria), else country baseline (DATA.countries economy.electricityRate)',
        get: () => { const s = siteSel(); return s?.attributes.powerCostKwh ?? siteCountry()?.economy?.electricityRate ?? null; },
    },
    'site.airQuality': {
        label: 'Air Quality Index (situs terpilih)', page: 'site', provenance: 'input',
        formulaTemplate: 'atribut situs bila diisi (Edit Criteria), else country baseline (DATA.countries environment.baselineAQI)',
        get: () => { const s = siteSel(); return s?.attributes.airQualityIndex ?? siteCountry()?.environment?.baselineAQI ?? null; },
    },
    'site.waterStress': {
        label: 'Water Stress WRI (situs terpilih)', page: 'site', unit: '/5', provenance: 'input',
        formulaTemplate: 'atribut situs bila diisi (Edit Criteria), else country baseline (DATA.countries environment.aqueductStressScore — WRI Aqueduct)',
        get: () => { const s = siteSel(); return s?.attributes.waterStress0to5 ?? siteCountry()?.environment?.aqueductStressScore ?? null; },
    },
    'site.pga': {
        label: 'PGA 2% in 50yr (situs terpilih)', page: 'site', unit: '%g', provenance: 'input',
        formulaTemplate: 'atribut situs bila diisi (Edit Criteria), else country baseline (DATA.countries environment.pgaPct2in50yr — USGS/GSHAP)',
        get: () => { const s = siteSel(); return s?.attributes.pgaPct2in50yr ?? siteCountry()?.environment?.pgaPct2in50yr ?? null; },
    },
    'site.effTaxRate': {
        label: 'Effective Tax Rate (situs terpilih)', page: 'site', unit: '%', provenance: 'input',
        formulaTemplate: 'atribut situs bila diisi (Edit Criteria), else country baseline (DATA.countries economy.taxRate) × 100',
        get: () => {
            const s = siteSel();
            const r = s?.attributes.effectiveTaxRate ?? siteCountry()?.economy?.taxRate;
            return r != null ? +(r * 100).toFixed(0) : null;
        },
    },

    /* ── EB wave: STAFFING page KPIs ── */
    'staff.monthlyCost': {
        label: 'Monthly Payroll (Total)', page: 'staff', unit: '$/mo', provenance: 'derived',
        formulaTemplate: 'Σ per role calculateStaffing(headcount efektif — staff.fte, shift model, negara): base salary + shift allowance + overtime + benefit (ShiftEngine)',
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
        formulaTemplate: 'Σ bobot fase (durasi CPM) × % aktual fase — Plan Mode: % planned pada status month; jadwal CPM dari timeline CAPEX (capex.total)',
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
        formulaTemplate: 'constr.evUsd ÷ PV (planned value $ pada status month) — Plan Mode = 1.00 by definition',
        deps: ['constr.evUsd'],
        get: () => constrPlan()?.e.spi ?? null,
    },
    'constr.cpi': {
        label: 'CPI (Cost Performance)', page: 'construction', unit: 'ratio', provenance: 'derived',
        formulaTemplate: 'constr.evUsd ÷ AC (actual cost yang di-input di tracking) — Plan Mode = 1.00 by definition',
        deps: ['constr.evUsd'],
        get: () => constrPlan()?.e.cpi ?? null,
    },
    'constr.forecastMonths': {
        label: 'Forecast Completion', page: 'construction', unit: 'mo', provenance: 'derived',
        formulaTemplate: 'durasi jadwal total (CPM) ÷ clamp(constr.spi, 0.5–1.5)',
        deps: ['constr.spi'],
        get: () => constrPlan()?.e.forecastTotalMonths ?? null,
    },

    /* ── EB wave: COMMISSIONING page (readiness = engine readinessIndex, real linkage) ── */
    'cx.testsPassed': {
        label: 'Cx Tests Passed', page: 'commissioning', provenance: 'input',
        formulaTemplate: 'jumlah tick PASS pada Cx checklist (NETA/IEEE/ASHRAE templates) — fallback input manual bila belum ada tick',
        get: () => {
            const s = cxStats(); if (!s) return null;
            return s.anyTicks ? s.pass : (useCxTracking.getState().testsPassed ?? null);
        },
    },
    'cx.testsFailed': {
        label: 'Cx Tests Failed', page: 'commissioning', provenance: 'input',
        formulaTemplate: 'jumlah tick FAIL pada Cx checklist — fallback input manual bila belum ada tick',
        get: () => {
            const s = cxStats(); if (!s) return null;
            return s.anyTicks ? s.fail : (useCxTracking.getState().testsFailed ?? null);
        },
    },
    'cx.testsTotal': {
        label: 'Cx Tests in Scope (screening)', page: 'commissioning', provenance: 'derived',
        formulaTemplate: 'Σ unit equipment (models.commissioning.equipScale dari sim.itLoad) × tests-per-unit per sistem — switchgear 12 · UPS 4 · genset 8 · chiller 6 · CRAC 2 · PDU 1 · fire 3; override manual menang',
        deps: ['sim.itLoad'],
        get: () => cxTestsTotal(),
    },
    'cx.readiness': {
        label: 'Readiness Index', page: 'commissioning', unit: '%', provenance: 'engine',
        formulaTemplate: 'models.commissioning.readinessIndex: Σ weight level (L1–L5/IST/SAT/FAT/punchlist) × completion level — completion dari checklist PASS (cx.testsPassed) menang atas slider',
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
        formulaTemplate: 'clamp(100 − (capex.perKw − 60% band) ÷ (80% band) × 60, 10–100) — band $/kW standar DATA.commissioning cx.rich.capexPerKw',
        deps: ['capex.perKw'],
        get: () => resultsDims()?.capexScore ?? null,
    },
    'results.susScore': {
        label: 'Sustainability Score', page: 'report', unit: '/100', provenance: 'derived',
        formulaTemplate: 'clamp((1.60 − engine.pueMatrix) ÷ 0.50 × 100, 0–100) — posisi PUE desain pada band 1.10–1.60',
        deps: ['engine.pueMatrix'],
        get: () => resultsDims()?.susScore ?? null,
    },
    'results.finScore': {
        label: 'Financial Score', page: 'report', unit: '/100', provenance: 'derived',
        formulaTemplate: 'clamp(50 + (IRR screening 15 thn − 10% hurdle) × 400, 10–100) — IRR = models.roi.irr(tahun-0 −capex.total; arus tahunan = pendapatan sim.itLoad × revenuePerKwMonth − opex dcContract)',
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
        formulaTemplate: 'rata-rata berbobot 8 dimensi: results.capexScore 13% + results.susScore 13% + results.finScore 13% + results.constrScore 12% + Requirements 12% + Site 13% + Architecture 12% + Ops Readiness 12%',
        deps: ['results.capexScore', 'results.susScore', 'results.finScore', 'results.constrScore'],
        get: () => resultsDims()?.overall ?? null,
    },

    /* ── EB wave: ASSET INTELLIGENCE page (fleet engine-generated) ── */
    'asset.fleetUnits': {
        label: 'Total Tracked Units (fleet)', page: 'asset-health', provenance: 'derived',
        formulaTemplate: 'Σ unit per kelas armada — models.commissioning.equipScale(sim.itLoad, rack density Requirements): switchgear/trafo/genset/UPS/PDU/chiller/CRAC/battery/BMS',
        deps: ['sim.itLoad'],
        get: () => {
            const eq = assetEquip(); if (!eq) return null;
            return ASSET_CLASSES.reduce((s, c) => s + (eq[c.eqKey] ?? 0), 0) || null;
        },
    },
    'asset.avgHealth': {
        label: 'Avg Fleet Health', page: 'asset-health', unit: '/100', provenance: 'engine',
        formulaTemplate: 'Σ (health kelas × unit) ÷ asset.fleetUnits — health = models.asset.healthIndex (Weibull remaining-life + condition + duty); basis trace: umur 3 thn · kondisi 85% (ubah di slider halaman)',
        deps: ['asset.fleetUnits'],
        get: () => assetAvgHealth(),
    },
    'asset.replacementValue': {
        label: 'Replacement Value (15 thn, nominal)', page: 'asset-health', unit: '$', provenance: 'derived',
        formulaTemplate: 'Σ models.asset.replacementSchedule(kelas, sim.itLoad, 15 thn).totalNominalUsd — 6 kelas: UPS Li-Ion / genset / CRAC / PDU / BMS / fire',
        deps: ['sim.itLoad'],
        get: () => assetReplacementValue(),
    },

    /* ── EB-cov wave: trace-coverage ≥60% halaman inti (append-only) ─────────
     * Leaves + derived chains for Dashboard / Capacity / CAPEX / Ops /
     * Architecture KPI wraps. Every get() mirrors the OWNING surface exactly. */

    /* leaves */
    'engine.pueTier3': {
        label: 'Design PUE (kolom tier-3 matriks cooling)', page: 'architecture', unit: 'ratio', provenance: 'engine', sourceKey: 'pueMatrix',
        external: { href: '/glossary.html#pue', label: 'Glossary: PUE' },
        get: () => { try { return getPUE(sim().inputs.coolingType); } catch { return null; } },
    },
    'req.rackDensityKw': {
        label: 'Rack Density (Requirements)', page: 'requirements', unit: 'kW/rack', provenance: 'input',
        get: () => req().workload.avgRackDensityKw ?? null,
    },
    'ops.occupancyPct': {
        label: 'Occupancy (S-curve tahun-1)', page: 'ops', unit: '%', provenance: 'engine',
        formulaTemplate: 'models.capacity.occupancyScurve(tahun-1, wholesale) × 100 — clamp 5–100%',
        get: () => { const o = opsOccFrac(); return o == null ? null : Math.round(o * 100); },
    },
    'ops.activeAlarms': {
        label: 'Active Alarms (ops log)', page: 'ops', provenance: 'input',
        formulaTemplate: 'jumlah alarm berstatus Active pada ops log (user-entered; seed EXAMPLE di Plan Mode)',
        get: () => useOpsLog.getState().alarms.filter((a) => a.status === 'Active').length,
    },
    'ops.openTickets': {
        label: 'Open Tickets (ops log)', page: 'ops', provenance: 'input',
        formulaTemplate: 'jumlah tiket berstatus ≠ Closed pada ops log (user-entered; seed EXAMPLE di Plan Mode)',
        get: () => useOpsLog.getState().tickets.filter((t) => t.status !== 'Closed').length,
    },
    'ops.pmCompliancePct': {
        label: 'PM Compliance', page: 'ops', unit: '%', provenance: 'input',
        formulaTemplate: 'minggu PM ter-log ÷ 52 × 100 (cap 100%) — null bila belum ada minggu ter-log',
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
        label: 'System Availability (RBD seri)', page: 'reliability', unit: '%', provenance: 'engine',
        formulaTemplate: 'models.reliability.systemAvailability(UPS · CRAC · genset · switchgear seri, redundansi power terpilih) × 100',
        get: () => {
            try {
                const m = (rzModels() as { reliability?: { systemAvailability?: (c: string[], r: string) => number } }).reliability;
                const av = m?.systemAvailability?.(['ups', 'crac', 'generator', 'switchgear'], redKeyLive());
                return av != null ? +(av * 100).toFixed(3) : null;
            } catch { return null; }
        },
    },
    'sus.wue': {
        label: 'WUE (Water Usage Effectiveness)', page: 'carbon', unit: 'L/kWh', provenance: 'engine',
        formulaTemplate: 'models.water.wue(tipe cooling terpilih) — intensitas air per kWh IT',
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
        formulaTemplate: 'emisi tahunan (models.carbon.annualTonnes dari sim.itLoad, PUE desain, grid negara) ÷ energi fasilitas tahunan',
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
        label: 'Total OPEX / yr (basis dashboard)', page: 'finance', unit: '$', provenance: 'engine',
        formulaTemplate: 'models.opex.totalAnnual(sim.itLoad dalam MW, PUE desain, negara, headcount manual) — basis DC-contract 100% util',
        deps: ['sim.itLoad'],
        get: () => dashOpexAnnual(),
    },
    'fin.lcc15': {
        label: 'LCC 15 thn (TCO diskonto 10%)', page: 'finance', unit: '$', provenance: 'derived',
        formulaTemplate: 'models.tco.totalCost(capex.total, opex.dashboardAnnual, 15 thn, 10% diskonto)',
        deps: ['capex.total', 'opex.dashboardAnnual'],
        get: () => {
            try {
                const m = (rzModels() as { tco?: { totalCost?: (c: number, o: number, y: number, r: number) => number } }).tco;
                const c = cap().results?.total; const o = dashOpexAnnual();
                return m?.totalCost && c && o ? Math.round(m.totalCost(c, o, 15, 0.10)) : null;
            } catch { return null; }
        },
    },
    'fin.ebitdaY5': {
        label: 'EBITDA (tahun ke-5)', page: 'finance', unit: '$', provenance: 'derived',
        formulaTemplate: 'DCF 15 thn: pendapatan (sim.itLoad × $280/kW·bln ilustratif × ramp okupansi, eskalasi 3%) − opex.dashboardAnnual — EBITDA tahun ke-5; modal awal capex.total',
        deps: ['capex.total', 'opex.dashboardAnnual', 'sim.itLoad'],
        get: () => { const cf = dashFinancial()?.cashflows?.[4]; return cf ? Math.round(cf.ebitda) : null; },
    },
    'fin.irrProject': {
        label: 'IRR (proyek 15 thn)', page: 'finance', unit: '%', provenance: 'derived',
        formulaTemplate: 'IRR arus kas DCF 15 thn — tahun-0 = −capex.total; arus tahunan = pendapatan ilustratif sim.itLoad − opex.dashboardAnnual − pajak',
        deps: ['capex.total', 'opex.dashboardAnnual', 'sim.itLoad'],
        get: () => { const f = dashFinancial(); return f ? +f.irr.toFixed(1) : null; },
    },
    'capex.racks': {
        label: 'Rack Count (CAPEX metrics)', page: 'capex', provenance: 'derived',
        formulaTemplate: 'ceil(sim.itLoad ÷ kW/rack kelas rack CAPEX — standard 6 · medium 12.5 · high 25 · extreme 75)',
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
        formulaTemplate: 'batas bawah band AACE Class 4 (−30%): models.capex.accuracyRange(capex.total).low',
        deps: ['capex.total'],
        get: () => capexBandLive()?.p10 ?? null,
    },
    'capex.p80': {
        label: 'CAPEX P80 (Risk-Adjusted)', page: 'capex', unit: '$', provenance: 'derived',
        formulaTemplate: 'capex.total + 0.8416 × σ_high; σ_high = (batas atas AACE Class 4 (+50%) − capex.total) ÷ 1.2816',
        deps: ['capex.total'],
        get: () => capexBandLive()?.p80 ?? null,
    },
    'capex.p90': {
        label: 'CAPEX P90 (Conservative)', page: 'capex', unit: '$', provenance: 'derived',
        formulaTemplate: 'batas atas band AACE Class 4 (+50%): models.capex.accuracyRange(capex.total).high',
        deps: ['capex.total'],
        get: () => capexBandLive()?.p90 ?? null,
    },
    'capex.contingency': {
        label: 'Contingency (CAPEX)', page: 'capex', unit: '$', provenance: 'derived',
        formulaTemplate: 'subtotal CAPEX sebelum kontinjensi × capex.contingencyPct ÷ 100 (CapexEngine)',
        deps: ['capex.contingencyPct'],
        get: () => cap().results?.contingency ?? null,
    },

    /* capacity planning (mirror CapacityPlanningPage adapter wiring exactly) */
    'cap.peakForecastMw': {
        label: 'Peak Forecast (growth plan)', page: 'capacity', unit: 'MW', provenance: 'derived',
        formulaTemplate: 'max forecast MW horizon 10 thn — growth plan Requirements (Y1–Y5, Y10) + interpolasi geometrik; basis Y0 = sim.itLoad',
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
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, bucket rack density) — jumlah lineup switchgear MV',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.switchgear ?? null,
    },
    'arch.eqTransformers': {
        label: 'Transformers (BOM)', page: 'architecture', provenance: 'engine',
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, bucket rack density) — jumlah trafo',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.transformers ?? null,
    },
    'arch.eqGenerators': {
        label: 'Generators (BOM)', page: 'architecture', provenance: 'engine',
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, bucket rack density) — jumlah genset',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.generators ?? null,
    },
    'arch.eqUps': {
        label: 'UPS Modules (BOM)', page: 'architecture', provenance: 'engine',
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, bucket rack density) — jumlah modul UPS',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.ups_modules ?? null,
    },
    'arch.eqPdus': {
        label: 'PDUs (BOM)', page: 'architecture', provenance: 'engine',
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, bucket rack density) — jumlah PDU',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.pdus ?? null,
    },
    'arch.eqChillers': {
        label: 'Chillers (BOM)', page: 'architecture', provenance: 'engine',
        formulaTemplate: 'models.commissioning.equipScale(sim.itLoad, bucket rack density) — jumlah chiller',
        deps: ['sim.itLoad'],
        get: () => assetEquip()?.chillers ?? null,
    },

    /* ── EB-finsus wave: FINANCIAL page KPIs (append-only) ────────────────────
     * Mirrors FinancialPage model memo EXACTLY (helpers at file bottom):
     * budget = REVISED (baseline + approved change orders), EVM run on the
     * revised budget as on the page. All null-safe. */
    'fin.revisedBudget': {
        label: 'Revised Budget', page: 'finance', unit: '$', provenance: 'derived',
        formulaTemplate: 'capex.total + Σ revisi disetujui (change orders financialTracking — amountFrac × baseline)',
        deps: ['capex.total'],
        get: () => finRevisedBudget(),
    },
    'fin.committed': {
        label: 'Total Committed', page: 'finance', unit: '$', provenance: 'derived',
        formulaTemplate: 'Σ transaksi ledger financialTracking berstatus committed/approved/paid — amountFrac × capex.total',
        deps: ['capex.total'],
        get: () => finLedgerSum(['committed', 'approved', 'paid']),
    },
    'fin.paid': {
        label: 'Total Actual (Paid)', page: 'finance', unit: '$', provenance: 'derived',
        formulaTemplate: 'Σ transaksi ledger financialTracking berstatus paid — amountFrac × capex.total',
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
        formulaTemplate: '100 × (0.3 × skor varian budget (1 − |fin.fac − fin.revisedBudget| ÷ fin.revisedBudget × 5) + 0.35 × min(1, constr.cpi) + 0.35 × min(1, constr.spi)) — komposit terdokumentasi',
        deps: ['fin.fac', 'fin.revisedBudget', 'constr.cpi', 'constr.spi'],
        get: () => finHealthLive(),
    },

    /* ── EB-finsus wave: SUSTAINABILITY page KPIs + Environmental Costs ───────
     * Mirrors SustainabilityEnginePage model + env memos EXACTLY (env memo
     * :68-115 — country-auto rates; water basis municipal = page default). */
    'sus.energyMonthlyMwh': {
        label: 'Energy (Month)', page: 'carbon', unit: 'MWh', provenance: 'derived',
        formulaTemplate: 'sim.itLoad ÷ 1000 × engine.pueMatrix × 730 jam',
        deps: ['sim.itLoad', 'engine.pueMatrix'],
        get: () => { const p = susPueLive(); return p == null ? null : Math.round((sim().inputs.itLoad / 1000) * p * 730); },
    },
    'sus.waterAnnualM3': {
        label: 'Water (Annual)', page: 'carbon', unit: 'm³', provenance: 'engine',
        formulaTemplate: 'models.water.annualM3(sim.itLoad dalam MW, tipe cooling) — sus.wue × IT kWh tahunan',
        deps: ['sim.itLoad', 'sus.wue'],
        get: () => susWaterM3(),
    },
    'sus.renewablePct': {
        label: 'Renewable Energy Share', page: 'carbon', unit: '%', provenance: 'derived',
        formulaTemplate: 'on-site dari input CAPEX renewable (solar+BESS 25% · solar 15%) + off-site PPA dari green cert (silver 10% · gold 20% · platinum 35%) — derivasi berlabel',
        get: () => susRenewablePct(),
    },
    'sus.overallScore': {
        label: 'Sustainability Score (composite)', page: 'carbon', unit: '/100', provenance: 'derived',
        formulaTemplate: 'rata-rata 4 skor terdokumentasi: energi (band engine.pueMatrix 1.10–1.60) + karbon (grid intensity negara × porsi grid dari sus.renewablePct) + air (band sus.wue 0–2.2) + waste (slider diversion, default 60)',
        deps: ['engine.pueMatrix', 'sus.renewablePct', 'sus.wue'],
        get: () => susOverallScore(),
    },
    'sus.waterCost': {
        label: 'Water Cost /yr', page: 'carbon', unit: '$/yr', provenance: 'derived',
        formulaTemplate: 'sus.waterAnnualM3 × climate multiplier (zona ASHRAE negara → DATA.waterFootprint.climateMult) → kgal × $/kgal (basis municipal — dropdown halaman dapat memilih sumber lain); deep-sea ON → $0 (seawater basis, no potable draw)',
        deps: ['sus.waterAnnualM3'],
        get: () => susEnvLive()?.waterCost ?? null,
    },
    'sus.carbonCost': {
        label: 'Carbon Cost /yr', page: 'carbon', unit: '$/yr', provenance: 'derived',
        formulaTemplate: 'scope-2 tCO₂e (models.carbon.scopes dari sim.itLoad & engine.pueMatrix, grid negara) × harga karbon negara (compliance DATA.envCosts.carbonPriceUsdPerT; fallback voluntary offset)',
        deps: ['sim.itLoad', 'engine.pueMatrix'],
        get: () => susEnvLive()?.carbonCost ?? null,
    },
    'sus.wasteCost': {
        label: 'Waste Mgmt Cost /yr', page: 'carbon', unit: '$/yr', provenance: 'derived',
        formulaTemplate: '(tonase umum per MW-IT × band tarif developed/emerging + e-waste kg per MW-IT × $/kg — DATA.envCosts.wasteMgmt) × sim.itLoad ÷ 1000',
        deps: ['sim.itLoad'],
        get: () => susEnvLive()?.wasteCost ?? null,
    },
    'sus.envTotal': {
        label: 'Total Environmental Cost /yr', page: 'carbon', unit: '$/yr', provenance: 'derived',
        formulaTemplate: 'sus.waterCost + sus.carbonCost + sus.wasteCost — tarif auto-switch per negara',
        deps: ['sus.waterCost', 'sus.carbonCost', 'sus.wasteCost'],
        get: () => { const e = susEnvLive(); return e ? Math.round(e.waterCost + e.carbonCost + e.wasteCost) : null; },
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
        const rich = m?.programRich?.({ itLoadKw: i.itLoad, coolingType: i.coolingType, powerRedundancy: i.powerRedundancy, countryId: sim().selectedCountry?.id });
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
        let archScore = 60;
        try {
            const c = M.architecture?.complexity?.({ coolingType: i.coolingType, tier: i.tierLevel, redundancy: i.powerRedundancy === 'N+1' ? 'n1' : i.powerRedundancy === '2N' ? '2n' : '2n1' });
            archScore = c ? Math.round(100 - c.index * 0.35) : 60;
        } catch { /* */ }
        // CAPEX: $/kW vs reference band
        const perKw = capexRes.metrics?.perKw ?? Math.round(capexRes.total / Math.max(1, i.itLoad));
        const band = D.commissioning?.cx?.rich?.capexPerKw?.standard ?? 10500;
        const capexScore = Math.round(Math.max(10, Math.min(100, 100 - ((perKw - band * 0.6) / (band * 0.8)) * 60)));
        // Construction: SPI/CPI blend (Plan Mode → 100)
        const cp = constrPlan();
        const constrScore = cp ? Math.min(100, Math.round(50 * Math.min(1.2, cp.e.spi) + 50 * Math.min(1.2, cp.e.cpi))) : 100;
        // Ops readiness: tier availability positioning
        const tierAvail = D.reliability?.tierAvailability ?? {};
        const opsScore = Math.max(0, Math.min(100, Math.round((((tierAvail[String(i.tierLevel)] ?? 0.9998) - 0.997) / (0.99995 - 0.997)) * 100)));
        // Sustainability: PUE band 1.10–1.60
        const pue = D.pueMatrix?.[i.coolingType]?.['tier' + i.tierLevel];
        const susScore = pue != null ? Math.round(Math.max(0, Math.min(100, ((1.6 - pue) / 0.5) * 100))) : 60;
        // Financial: IRR screening vs 10% hurdle
        let finScore = 60;
        try {
            if (M.roi?.npv) {
                const revenue = (D.decision?.revenuePerKwMonth ?? 280) * i.itLoad * 12;
                let opexAnnual = revenue * 0.4;
                try {
                    if (M.opex?.totalAnnual) opexAnnual = M.opex.totalAnnual(i.itLoad / 1000, pue ?? 1.3, country?.id ?? 'US', 12, { capex: capexRes.total, basisPreset: 'dcContract' }).total;
                } catch { /* keep 40% proxy */ }
                const flows = Array.from({ length: 15 }, () => revenue - opexAnnual);
                const irr = M.roi.irr ? M.roi.irr([-capexRes.total, ...flows]) : null;
                finScore = Math.round(Math.max(10, Math.min(100, 50 + (irr != null ? (irr - 0.10) * 400 : 0))));
            }
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
        const key = [capexTotal, i.itLoad, taxRate, annualOpex, (i.occupancyRamp ?? []).join(',')].join('|');
        if (_finCache?.key === key) return _finCache.fin;
        const fin = calculateFinancials({
            totalCapex: capexTotal, annualOpex, revenuePerKwMonth: DEFAULT_REVENUE_PER_KW_MONTH,
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
