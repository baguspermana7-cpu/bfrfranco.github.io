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
import { buildAnalysisCtx, analyzeSite, type SiteAnalyses } from '@/lib/site-adapter';
import { calculateAutoHeadcount } from '@/modules/staffing/ShiftEngine';
import { rzData, rzModels } from '@/lib/rz-engine';

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
