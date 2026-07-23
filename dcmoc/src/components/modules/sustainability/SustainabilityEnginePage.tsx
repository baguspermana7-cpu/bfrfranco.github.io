'use client';

/* ─── Sustainability Engine — page (Phase M, tab 'carbon') ───────────────────
 * Engine-real core: GHG scopes (models.carbon.scopes), WUE water volumes,
 * PUE from the matrix, energy mix from the capex renewable/cert inputs
 * (labeled derivation). Initiatives + certifications = user-attested store
 * (EXAMPLE seeds, Plan Mode). Old CarbonDashboard kept as "Carbon / ESG
 * Detail" tab.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useSustainability } from '@/store/sustainability';
import { rzModels, rzData } from '@/lib/rz-engine';
import { fmt, fmtMoney } from '@/lib/format';
import { getPUE } from '@/constants/pue';
import CarbonDashboard from '@/components/modules/CarbonDashboard';
import { Leaf, ChevronRight, FileDown } from 'lucide-react';
import { Explain } from '@/components/ui/Explain';
import { Tooltip as InfoTip } from '@/components/ui/Tooltip';
import { TraceValue } from '@/components/ui/TraceValue';
import { RedValue, type Diagnosis } from '@/components/ui/RedValue';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';

const SCOPE_COLORS = ['#f59e0b', '#00DDFF', '#64748b'];
const MIX_COLORS = ['#34d399', '#22d3ee', '#64748b'];
/* Workstream H — DCMOC coolingType → engine facilityFootprint cooling key
 * (labeled screening map; the footprint model's WUE bins are coarser). */
const FOOTPRINT_COOL_MAP: Record<string, string> = { air: 'evaporative', inrow: 'hybrid', rdhx: 'hybrid', liquid: 'dlc' };

export function SustainabilityEnginePage() {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const inputs = useSimulationStore((s) => s.inputs);
    const country = useSimulationStore((s) => s.selectedCountry);
    const capexInputs = useCapexStore((s) => s.inputs);
    const sus = useSustainability();
    const [tab, setTab] = React.useState<'overview' | 'detail'>('overview');

    const model = React.useMemo(() => {
        const m = rzModels();
        const mw = inputs.itLoad / 1000;
        const pue = rzData()?.pueMatrix?.[inputs.coolingType]?.['tier' + inputs.tierLevel] ?? getPUE(inputs.coolingType);
        const monthlyMwh = Math.round(mw * pue * 730);
        let scopes: { scope1: number; scope2: number; scope3Annual: number; totalAnnual: number; scope2Pct: number } | null = null;
        try { if (m?.carbon?.scopes) scopes = m.carbon.scopes({ mw, pue, region: country?.id ?? 'US', capexUsd: 0 }); } catch { /* */ }
        let waterM3Yr: number | null = null;
        try { if (m?.water?.annualM3) waterM3Yr = Math.round(m.water.annualM3(mw, inputs.coolingType)); } catch { /* */ }
        /* energy mix — DERIVED from the capex renewable/cert inputs (labeled):
         * solar+bess → 25% on-site; solar → 15%; green cert gold/platinum adds
         * 20/35% off-site PPA assumption; remainder = grid. */
        const ren = capexInputs.renewableOption ?? 'none';
        const cert = capexInputs.greenCert ?? 'none';
        const onSite = ren === 'solar_bess' ? 25 : ren === 'solar' ? 15 : 0;
        const offSite = cert === 'platinum' ? 35 : cert === 'gold' ? 20 : cert === 'silver' ? 10 : 0;
        const grid = Math.max(0, 100 - onSite - offSite);
        const renewablePct = onSite + offSite;
        /* scorecard composites (documented) */
        const energyScore = Math.round(Math.max(0, Math.min(100, (1.6 - pue) / 0.5 * 100)));
        const gi = country?.environment?.gridCarbonIntensity ?? 0.7;
        const carbonScore = Math.round(Math.max(0, Math.min(100, (0.9 - gi * (grid / 100)) / 0.9 * 100)));
        const wue = m?.water?.wue ? m.water.wue(inputs.coolingType) : 1.8;
        const waterScore = Math.round(Math.max(0, Math.min(100, (2.2 - wue) / 2.2 * 100)));
        const wasteScore = sus.wasteDiversionPct != null ? Math.round(sus.wasteDiversionPct) : null;
        const overall = Math.round((energyScore + carbonScore + waterScore + (wasteScore ?? 60)) / 4);
        const grade = overall >= 85 ? 'A' : overall >= 70 ? 'B' : overall >= 55 ? 'C' : 'D';
        return { mw, pue, monthlyMwh, scopes, waterM3Yr, mix: [{ name: 'Renewable (on-site)', v: onSite }, { name: 'Renewable (off-site PPA)', v: offSite }, { name: 'Grid Electricity', v: grid }].filter((x) => x.v > 0), renewablePct, energyScore, carbonScore, waterScore, wasteScore, overall, grade, wue };
    }, [inputs, country, capexInputs.renewableOption, capexInputs.greenCert, sus.wasteDiversionPct]);

    /* ── Environmental Costs (country-auto) — engine DATA.envCosts + DATA.waterFootprint.
     * Reuses the numbers ALREADY rendered above (scope-2 tCO₂e, WUE m³/yr) so the
     * section can never disagree with the KPI row; only the RATES are new. All
     * per-country rates key off sim selectedCountry.id (ISO-2) — one source. ── */
    const [waterSource, setWaterSource] = React.useState<'municipal' | 'reclaimed' | 'river' | 'groundwell'>('municipal');
    const env = React.useMemo(() => {
        const D = rzData();
        const ec = D?.envCosts;
        const wf = D?.waterFootprint;
        if (!ec?.carbonPriceUsdPerT || !ec?.wasteMgmt || !wf?.waterCostPerKgal) return null; // engine absent → section hides (local KPIs above still render)
        const cid = (country?.id ?? 'US').toUpperCase();
        const cname = country?.name ?? 'United States';
        /* climate band from the country ASHRAE zone (screening map → DATA.waterFootprint.climateMult) */
        const zone: string = country?.environment?.ashraeClimateZone ?? '';
        const zn = parseInt(zone, 10);
        const climate = !zone || Number.isNaN(zn) ? 'temperate'
            : zn <= 2 && zone.includes('A') ? 'hothumid'
            : zn <= 3 && zone.includes('B') ? 'hotdry'
            : zn >= 5 ? 'cold' : 'temperate';
        const climateMult: number = wf.climateMult?.[climate] ?? 1.0;
        /* 1 · WATER — same engine WUE volume as the KPI row, climate-adjusted, priced per kgal */
        const waterM3 = (model.waterM3Yr ?? 0) * climateMult;               // m³/yr = WUE(cooling) × IT kWh × climate
        const kgal = (waterM3 * 1000) / (wf.lPerGal ?? 3.785) / 1000;      // liters → kgal
        const waterRate: number = wf.waterCostPerKgal[waterSource] ?? wf.waterCostPerKgal.municipal;
        const deepSea = !!capexInputs.deepSea;
        const waterCost = deepSea ? 0 : kgal * waterRate;                   // deep-sea = seawater basis, no potable draw
        /* 2 · CARBON — scope-2 tCO₂e rendered above × country compliance price (voluntary fallback) */
        const scope2 = model.scopes?.scope2 ?? 0;
        const compliancePrice: number | undefined = ec.carbonPriceUsdPerT[cid];
        const hasScheme = compliancePrice != null && compliancePrice > 0;
        const carbonRate: number = hasScheme ? compliancePrice : (ec.voluntaryOffsetUsdPerT ?? 10);
        const carbonCost = scope2 * carbonRate;
        /* 3 · WASTE — screening bands: general (developed/emerging) + certified e-waste */
        const developed = (ec.developedMarkets ?? []).includes(cid);
        const genRate: number = ec.wasteMgmt.generalUsdPerTonne?.[developed ? 'developed' : 'emerging'] ?? (developed ? 120 : 60);
        const genTonnes = (ec.wasteMgmt.generalTonnesPerMwItYr ?? 2.0) * model.mw;
        const eKg = (ec.wasteMgmt.eWasteKgPerMwItYr ?? 150) * model.mw;
        const eRate: number = ec.wasteMgmt.eWasteUsdPerKg ?? 1.0;
        const wasteCost = genTonnes * genRate + eKg * eRate;
        const total = waterCost + carbonCost + wasteCost;
        /* mini forecast — water+carbon follow the occupancy ramp (energy-driven);
         * waste stays on the installed IT base (screening) */
        const ramp: number[] = inputs.occupancyRamp?.length ? inputs.occupancyRamp : [1];
        const forecast = ramp.map((occ, i) => ({
            year: `Y${i + 1}`, water: Math.round(waterCost * occ), carbon: Math.round(carbonCost * occ), waste: Math.round(wasteCost),
        }));
        return { cid, cname, climate, climateMult, waterM3, kgal, waterRate, waterCost, deepSea, scope2, hasScheme, carbonRate, carbonCost, developed, genRate, genTonnes, eKg, eRate, wasteCost, total, forecast };
    }, [model, country, capexInputs.deepSea, waterSource, inputs.occupancyRamp]);

    /* ── Workstream H · Facility-level water footprint — SURFACES the existing
     * engine models.water.facilityFootprint (facility kWh = IT × PUE, WUE ×
     * climate, + upstream-power water on the non-renewable share). The Water
     * KPI above is IT-only direct draw; this table is the full-facility view.
     * DCMOC cooling → engine footprint cooling key is a labeled screening map. */
    const facWater = React.useMemo(() => {
        const m = rzModels();
        if (!m?.water?.facilityFootprint) return null;
        try {
            const coolKey = FOOTPRINT_COOL_MAP[inputs.coolingType] ?? 'evaporative';
            const f = m.water.facilityFootprint({
                itLoadMw: model.mw, pue: model.pue, cooling: coolKey,
                climate: env?.climate ?? 'temperate', renewablePct: model.renewablePct,
                sourceType: waterSource,
            });
            return f ? { ...f, coolKey } : null;
        } catch { return null; }
    }, [model, env?.climate, inputs.coolingType, waterSource]);

    /* ── Workstream H · CUE + ERF — CUE from the scopes result already rendered
     * above (t CO₂e ÷ IT MWh ≡ kg/kWh, Green Grid definition); ERF is honestly
     * 0 — no heat-reuse path is modeled in this design. ── */
    const cue = model.scopes ? model.scopes.totalAnnual / (model.mw * 8760) : null;

    /* ── Owner-mandate red-value diagnostics (shared RedValue modal) ─────────
     * Pillar scores < 50 + overall grade C/D become clickable red values. Each
     * diagnosis restates the pillar's OWN documented formula with the live
     * numbers from the memo above — thresholds are solved from the same
     * formulas (score ≥ 50 ⇔ PUE ≤ 1.35 · grid-intensity product ≤ 0.45 ·
     * WUE ≤ 1.1), never invented. */
    const gi = country?.environment?.gridCarbonIntensity ?? 0.7;
    const gridShare = 100 - model.renewablePct;
    const coolingLever = {
        label: 'Cooling technology',
        detail: `PUE ${model.pue} (${inputs.coolingType}, Tier ${inputs.tierLevel}) sets both the energy score and the ${model.monthlyMwh.toLocaleString()} MWh/mo facility draw — liquid/immersion options in the CAPEX cooling picker carry lower engine PUE; score ≥ 50 needs PUE ≤ 1.35 (from the same band formula).`,
        tab: 'capex',
    };
    const renewableLever = {
        label: 'Renewable option / PPA',
        detail: `Renewable share is ${model.renewablePct}% (derived from the CAPEX renewable/cert inputs) leaving ${gridShare}% grid at ${gi} kgCO₂/kWh — carbon score ≥ 50 needs the grid share ≤ ${Math.max(0, Math.floor(45 / gi))}% at this grid factor (solved from the same formula).`,
        tab: 'renewable-economics',
    };
    const pillarDiags: Record<'energy' | 'carbon' | 'water' | 'waste', Diagnosis> = {
        energy: {
            title: 'Energy Efficiency (PUE band)',
            reason: `Score = (1.6 − PUE) ÷ 0.5 × 100 with design PUE ${model.pue} (${inputs.coolingType}, Tier ${inputs.tierLevel}) → ${model.energyScore}/100. Monthly energy ${model.monthlyMwh.toLocaleString()} MWh scales directly with PUE.`,
            actual: `${model.energyScore}/100`, threshold: '≥ 50 (⇔ PUE ≤ 1.35)',
            levers: [coolingLever],
            tab: 'carbon',
        },
        carbon: {
            title: 'Carbon Management (grid × mix)',
            reason: `Score = (0.9 − grid intensity × grid share) ÷ 0.9 × 100 = (0.9 − ${gi} × ${gridShare}%) ÷ 0.9 → ${model.carbonScore}/100. The ${country?.name ?? 'selected country'} grid factor (${gi} kgCO₂/kWh) on a ${gridShare}% grid share dominates — site/grid and PPAs move this more than PUE tuning.`,
            actual: `${model.carbonScore}/100`, threshold: `≥ 50 (⇔ grid share ≤ ${Math.max(0, Math.floor(45 / gi))}% at ${gi})`,
            levers: [renewableLever],
            tab: 'carbon',
        },
        water: {
            title: 'Water Stewardship (WUE band)',
            reason: `Score = (2.2 − WUE) ÷ 2.2 × 100 with WUE ${model.wue} L/kWh (${inputs.coolingType}, engine) → ${model.waterScore}/100${model.waterM3Yr != null ? ` — annual draw ${model.waterM3Yr.toLocaleString()} m³` : ''}.`,
            actual: `${model.waterScore}/100`, threshold: '≥ 50 (⇔ WUE ≤ 1.1 L/kWh)',
            levers: [
                { label: 'Cooling technology', detail: `WUE follows the cooling choice — low-water cooling (liquid/DLC) lowers the engine WUE from ${model.wue} L/kWh; the ${model.waterM3Yr != null ? `${model.waterM3Yr.toLocaleString()} m³/yr` : 'annual'} draw scales with it.`, tab: 'capex' },
                { label: 'Water source', detail: 'Honest note: switching source (reclaimed/river) changes the environmental COST below, not this WUE-based score — only the cooling technology moves the score.' },
            ],
            tab: 'carbon',
        },
        waste: {
            title: 'Waste Management',
            reason: `Score = the attested waste-diversion percentage (${sus.wasteDiversionPct ?? '—'}%) — a user-entered figure, not an engine derivation (a screening default of 60 is used in the overall composite when unset).`,
            actual: `${model.wasteScore ?? '—'}/100`, threshold: '≥ 50% diversion',
            levers: [
                { label: 'Raise waste diversion', detail: 'Use the waste-diversion slider on this page (recycling + certified ITAD program) — ≥ 50% clears the band; the cost side is in the Environmental Costs card below.' },
            ],
            tab: 'carbon',
        },
    };
    const weakest = ([['energy', model.energyScore], ['carbon', model.carbonScore], ['water', model.waterScore], ['waste', model.wasteScore ?? 60]] as const)
        .reduce((a, b) => (b[1] < a[1] ? b : a));
    const gradeDiag: Diagnosis | null = model.grade === 'C' || model.grade === 'D' ? {
        title: 'Sustainability Score',
        reason: `Overall ${model.overall}/100 = mean of energy ${model.energyScore} + carbon ${model.carbonScore} + water ${model.waterScore} + waste ${model.wasteScore ?? 60}${model.wasteScore == null ? ' (screening default — diversion unset)' : ''}. Weakest pillar: ${pillarDiags[weakest[0]].title} at ${weakest[1]}/100. Grade bands: A ≥ 85 · B ≥ 70 · C ≥ 55 · else D.`,
        actual: `${model.grade} (${model.overall}/100)`, threshold: '≥ B (70/100)',
        gap: `${model.overall - 70} pts`,
        levers: [coolingLever, renewableLever, ...(pillarDiags.waste.levers ?? [])],
        tab: 'carbon',
        note: 'Documented composite — identical formulas to the scorecard rows below; each red pillar score is clickable for its own diagnosis.',
    } : null;

    const scopeDonut = model.scopes ? [
        { name: 'Scope 1', v: model.scopes.scope1 }, { name: 'Scope 2 (location-based)', v: model.scopes.scope2 }, { name: 'Scope 3 (annualized)', v: model.scopes.scope3Annual },
    ] : [];
    const [busy, setBusy] = React.useState(false);

    const exportPdf = async () => {
        setBusy(true);
        try {
            const susMetrics = { pue: model.pue, renewablePct: model.renewablePct };
            await generatePillarPDF({
                title: 'Sustainability', layer: 'Sustainability Engine', project: '—',
                kpis: [
                    { label: 'PUE (Design)', value: String(model.pue), sub: `${inputs.coolingType} · Tier ${inputs.tierLevel}` },
                    { label: 'Energy (Month)', value: `${model.monthlyMwh.toLocaleString()} MWh`, sub: `${model.mw.toFixed(1)} MW × PUE × 730h` },
                    { label: 'Carbon (Annual)', value: model.scopes ? `${Math.round(model.scopes.totalAnnual).toLocaleString()} tCO₂e` : '—', sub: 'GHG Protocol scopes (engine)' },
                    { label: 'Water (Annual)', value: model.waterM3Yr != null ? `${model.waterM3Yr.toLocaleString()} m³` : '—', sub: `WUE ${model.wue} L/kWh (engine)` },
                    { label: 'Renewable Energy', value: `${model.renewablePct}%`, sub: 'derived from capex renewable/cert inputs' },
                    { label: 'Sustainability Score', value: model.grade, sub: `${model.overall}/100 · documented composite` },
                ],
                sections: [
                    ...(scopeDonut.length ? [{ title: 'Carbon Footprint (GHG scopes · engine)', head: ['Scope', 'tCO₂e / yr'], rows: scopeDonut.map((r) => [r.name, Math.round(r.v).toLocaleString()]) }] : []),
                    { title: 'Energy Mix (derived from capex renewable + certification inputs)', head: ['Source', 'Share'], rows: model.mix.map((r) => [r.name, `${r.v}%`]) },
                    {
                        title: 'Sustainability Scorecard (documented composites)', head: ['Dimension', 'Score /100'], rows: [
                            ['Energy Efficiency (PUE band)', String(model.energyScore)],
                            ['Carbon Management (grid × mix)', String(model.carbonScore)],
                            ['Water Stewardship (WUE band)', String(model.waterScore)],
                            ['Waste Management', model.wasteScore != null ? String(model.wasteScore) : '—'],
                        ],
                    },
                    ...(env ? [{
                        title: `Environmental Costs — ${env.cname} (${env.cid}) · country-auto rates · screening`, head: ['Cost', 'USD / yr', 'Basis'], rows: [
                            ['Water', fmtMoney(env.waterCost), env.deepSea ? 'deep-sea ON — seawater basis, no potable draw' : `${fmt(env.waterM3)} m³ (WUE × climate ×${env.climateMult}) × $${env.waterRate}/kgal (${waterSource})`],
                            ['Carbon', fmtMoney(env.carbonCost), `${fmt(env.scope2)} tCO₂e scope-2 × $${env.carbonRate}/t (${env.hasScheme ? 'compliance' : 'voluntary offset'})`],
                            ['Waste', fmtMoney(env.wasteCost), `general ${fmt(env.genTonnes, 1)} t × $${env.genRate}/t (${env.developed ? 'developed' : 'emerging'}) + e-waste ${fmt(env.eKg)} kg × $${env.eRate}/kg`],
                            ['Total', fmtMoney(env.total), 'engine DATA.envCosts + waterFootprint · World Bank / OECD / NCCS 2025-26'],
                        ],
                    }] : []),
                    { title: 'Initiatives in Progress', head: ['Category', 'Initiative', 'Progress', 'Status'], rows: sus.initiatives.map((i) => [i.category, i.title, `${i.progressPct}%`, i.status]) },
                ],
                callouts: [
                    {
                        title: `Sustainability Score ${model.grade} — ${model.overall}/100`,
                        body: `Documented composite of energy (${model.energyScore}), carbon (${model.carbonScore}), water (${model.waterScore}) and waste (${model.wasteScore ?? '—'}) scores.`,
                        tone: model.overall >= 70 ? ('good' as const) : model.overall >= 55 ? ('info' as const) : ('warn' as const),
                    },
                    {
                        title: 'Energy mix derivation',
                        body: 'Energy mix is DERIVED from the capex renewable/certification inputs (labeled assumption): solar+BESS → 25% on-site, solar → 15%; green cert silver/gold/platinum adds 10/20/35% off-site PPA; remainder = grid.',
                        tone: 'info' as const,
                    },
                ],
                assessment: buildAssessment('sustainability', susMetrics),
                actions: buildActions('sustainability', susMetrics),
                summaryBand: [
                    { label: 'PUE', value: String(model.pue) },
                    { label: 'Renewable', value: `${model.renewablePct}%` },
                    { label: 'Carbon /yr', value: model.scopes ? `${Math.round(model.scopes.totalAnnual).toLocaleString()} t` : '—' },
                    { label: 'WUE', value: `${model.wue} L/kWh` },
                    { label: 'Overall', value: `${model.overall}/100` },
                ],
                note: 'GHG scopes, WUE water volumes and PUE engine-real; energy mix derived from capex renewable/cert inputs (labeled); initiatives & certifications user-attested.',
            } as StandardReport);
        } finally { setBusy(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rz-data/15 border border-rz-data/40"><Leaf className="h-6 w-6 text-rz-data" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sustainability Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">GHG scopes, energy & water — engine-real; initiatives & certifications user-attested</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                        {([['overview', 'Overview'], ['detail', 'Carbon / ESG Detail']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-rz-signal text-black' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                        ))}
                    </div>
                    <button onClick={exportPdf} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-rz-mint"><FileDown className="h-3.5 w-3.5" />{busy ? '…' : 'Export'}</button>
                    <button onClick={() => setActiveTab('finance')} className="inline-flex items-center gap-1 rounded-lg bg-rz-signal px-3 py-1.5 text-xs font-semibold text-black hover:bg-rz-signal/90">Next: Financial <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'detail' ? <CarbonDashboard /> : (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                            { label: 'PUE (Design)', value: String(model.pue), sub: `${inputs.coolingType} · Tier ${inputs.tierLevel}`, explain: 'pue', trace: 'engine.pueMatrix' },
                            { label: 'Energy (Month)', value: `${model.monthlyMwh.toLocaleString()} MWh`, sub: `${model.mw.toFixed(1)} MW × PUE × 730h`, trace: 'sus.energyMonthlyMwh', tip: 'Monthly facility energy = IT MW × PUE × 730 h (average hours per month), assuming full IT load. This is the single largest sustainability and OPEX driver — it falls with a better PUE (cooling choice) or a lower IT load, and every downstream carbon/water figure scales from it.' },
                            { label: 'Carbon (Annual)', value: model.scopes ? `${Math.round(model.scopes.totalAnnual).toLocaleString()} tCO₂e` : '—', sub: 'GHG Protocol scopes (engine)', trace: 'carbon.annualEmissions', tip: 'Annual greenhouse-gas emissions by GHG Protocol scope: Scope 1 (generator fuel), Scope 2 (grid electricity × the country grid-carbon factor) and a Scope 3 screening slice. The grid carbon intensity of the selected country dominates — renewables, PPAs and site selection are the real levers, not small PUE tweaks.' },
                            { label: 'Water (Annual)', value: model.waterM3Yr != null ? `${model.waterM3Yr.toLocaleString()} m³` : '—', sub: `WUE ${model.wue} L/kWh (engine) · pre-climate basis${env ? ` — env cost ×${env.climateMult} climate` : ''}`, explain: 'wue', trace: 'sus.waterAnnualM3' },
                            { label: 'Renewable Energy', value: `${model.renewablePct}%`, sub: 'derived from capex renewable/cert inputs', trace: 'sus.renewablePct', tip: 'Share of facility energy attributed to renewables, derived from the CAPEX renewable/certification inputs (solar PV, solar+BESS, green certification level) — not a separately entered figure. Raising it cuts Scope 2 carbon and lifts the sustainability score; change it via the CAPEX sustainability options.' },
                            { label: 'Sustainability Score', value: model.grade, sub: `${model.overall}/100 · documented composite`, trace: 'sus.overallScore', red: gradeDiag, tip: 'Documented composite grade (0-100 → letter) across PUE, WUE, carbon intensity, renewable share and certifications. A screening indicator of ESG-reporting readiness for comparing configurations — it is not a certification and carries no compliance weight on its own.' },
                        ].map((k) => (
                            <div key={k.label} title={`${k.label}: ${k.value}${(k as {sub?: string}).sub ? " — " + (k as {sub?: string}).sub : ""}`} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label} {(k as { tip?: string }).tip && <InfoTip content={(k as { tip?: string }).tip!} />}{(k as { explain?: string }).explain && <Explain k={(k as { explain?: string }).explain!} />}</div>
                                {(k as { trace?: string }).trace ? (
                                    <TraceValue traceId={(k as { trace?: string }).trace!}>
                                        {(k as { red?: Diagnosis | null }).red ? (
                                            <RedValue className="text-lg font-bold tabular-nums" diagnosis={(k as { red?: Diagnosis | null }).red!}>{k.value}</RedValue>
                                        ) : (
                                            <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                        )}
                                    </TraceValue>
                                ) : (
                                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                )}
                                <div className="truncate text-[10px] text-slate-500">{k.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Carbon Footprint (GHG scopes · engine)</h2>
                            {model.scopes ? (
                                <div className="flex items-center gap-2">
                                    <div className="h-32 w-32 shrink-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={scopeDonut} dataKey="v" nameKey="name" innerRadius={28} outerRadius={48} paddingAngle={2}>
                                                    {scopeDonut.map((_, idx) => <Cell key={idx} fill={SCOPE_COLORS[idx]} />)}
                                                </Pie>
                                                <Tooltip formatter={(v) => `${Math.round(Number(v)).toLocaleString()} tCO₂e`} contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex-1 space-y-0.5">
                                        {scopeDonut.map((r, idx) => (
                                            <div key={r.name} className="flex items-center gap-1.5 text-[10px]">
                                                <span className="h-2 w-2 rounded-sm" style={{ background: SCOPE_COLORS[idx] }} />
                                                <span className="text-slate-600 dark:text-slate-300">{r.name}</span>
                                                <span className="ml-auto tabular-nums text-slate-500">{Math.round(r.v).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : <p className="text-xs text-slate-500">Engine loading…</p>}
                        </div>
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Energy Mix <span className="text-[9px] normal-case text-slate-400">derived from capex renewable + certification inputs</span></h2>
                            <div className="flex items-center gap-2">
                                <div className="h-32 w-32 shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={model.mix} dataKey="v" nameKey="name" innerRadius={28} outerRadius={48} paddingAngle={2}>
                                                {model.mix.map((_, idx) => <Cell key={idx} fill={MIX_COLORS[idx]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex-1 space-y-0.5">
                                    {model.mix.map((r, idx) => (
                                        <div key={r.name} className="flex items-center gap-1.5 text-[10px]">
                                            <span className="h-2 w-2 rounded-sm" style={{ background: MIX_COLORS[idx] }} />
                                            <span className="text-slate-600 dark:text-slate-300">{r.name}</span>
                                            <span className="ml-auto tabular-nums text-slate-500">{r.v}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sustainability Scorecard <span className="text-[9px] normal-case text-slate-400">documented composites</span></h2>
                            <div className="space-y-1.5">
                                {([
                                    ['Energy Efficiency (PUE band)', model.energyScore, 'energy'],
                                    ['Carbon Management (grid × mix)', model.carbonScore, 'carbon'],
                                    ['Water Stewardship (WUE band)', model.waterScore, 'water'],
                                    ['Waste Management', model.wasteScore, 'waste'],
                                ] as const).map(([label, v, pk]) => (
                                    <div key={label} className="flex items-center gap-2 text-[11px]">
                                        <span className="w-40 truncate text-slate-600 dark:text-slate-300">{label}</span>
                                        <div className="h-1.5 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                                            {v != null && <div className={`h-1.5 rounded ${v >= 70 ? 'bg-rz-data' : v >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${v}%` }} />}
                                        </div>
                                        {v != null && v < 50 ? (
                                            /* owner mandate: a red pillar score opens its formula diagnosis */
                                            <RedValue className="w-9 text-right tabular-nums" diagnosis={pillarDiags[pk]}>{v}</RedValue>
                                        ) : (
                                            <span className="w-9 text-right tabular-nums text-slate-500">{v != null ? `${v}` : '—'}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                                <span className="text-slate-500">Waste diversion</span>
                                <input type="range" min={0} max={100} step={5} value={sus.wasteDiversionPct ?? 0}
                                    onChange={(e) => sus.actions.set({ wasteDiversionPct: Number(e.target.value) })} className="flex-1 accent-rz-mint" />
                                <span className="w-9 text-right tabular-nums text-slate-500">{sus.wasteDiversionPct != null ? `${sus.wasteDiversionPct}%` : '—'}</span>
                            </div>
                            {/* Workstream H — CUE + ERF rows (Green Grid metrics) */}
                            <div className="mt-2 space-y-1 border-t border-slate-100 dark:border-slate-800/60 pt-2">
                                <div className="flex items-center gap-2 text-[11px]">
                                    <span className="w-40 truncate text-slate-600 dark:text-slate-300">CUE (carbon usage eff.) <InfoTip content="Carbon Usage Effectiveness (Green Grid) = total annual CO₂e ÷ IT energy, in kg CO₂e per IT kWh — computed from the SAME GHG-scopes result rendered above (no separate model). Bands (screening): < 0.2 = clean-grid / high-renewable operation; 0.2–0.5 = typical mixed grid; > 0.5 = carbon-intensive grid — site selection and PPAs move this metric far more than PUE tuning. A breach of your ESG target here usually means the grid factor, not the design, is the problem." /></span>
                                    <span className="ml-auto tabular-nums font-semibold text-slate-700 dark:text-slate-200">{cue != null ? `${cue.toFixed(3)} kg/kWh` : '—'}</span>
                                    {cue != null && <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${cue < 0.2 ? 'bg-rz-data/15 text-rz-data' : cue < 0.5 ? 'bg-amber-500/15 text-amber-500' : 'bg-rose-500/15 text-rose-500'}`}>{cue < 0.2 ? 'clean' : cue < 0.5 ? 'mixed grid' : 'carbon-intensive'}</span>}
                                </div>
                                <div className="flex items-center gap-2 text-[11px]">
                                    <span className="w-40 truncate text-slate-600 dark:text-slate-300">ERF (energy reuse) <InfoTip content="Energy Reuse Factor (Green Grid) = reused energy ÷ total facility energy. Honestly 0 here — no heat-reuse path (district heating, adjacent industrial offtake, greenhouse) is modeled in this design. District-heating integration would move it: waste heat is low-grade (~30-45 °C air / ~50-60 °C liquid-cooling return), so economic reuse needs a heat customer within a few km and usually a heat pump — a real cost-benefit case only in cold climates with district networks. No number is shown because none exists in the model." /></span>
                                    <span className="ml-auto tabular-nums font-semibold text-slate-700 dark:text-slate-200">0</span>
                                    <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[9px] text-slate-500">no heat reuse modeled</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Workstream H · Facility water footprint + 24/7 CFE note ── */}
                    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                Facility Water Footprint <InfoTip content="Full-facility water view from the engine footprint model (models.water.facilityFootprint): facility kWh = IT × PUE, WUE base × climate multiplier, PLUS the upstream water embedded in non-renewable grid power (screening factor per non-renewable kWh). The Water KPI above is the IT-only direct draw — this table is the honest total a water-permit or ESG report would ask about, and upstream is usually the larger share on a thermal grid. Cooling type is mapped to the footprint model's coarser bins (labeled below). Screening-grade, not a metered figure." />
                                <span className="ml-1 text-[9px] normal-case text-slate-400">engine facilityFootprint · direct + upstream · screening</span>
                            </h2>
                            {!facWater ? (
                                <p className="text-[11px] text-slate-500">Engine facility-footprint model unavailable — only the IT-only Water KPI above is shown.</p>
                            ) : (
                                <>
                                    <table className="w-full text-[11px]">
                                        <tbody>
                                            {([
                                                ['WUE (climate-adjusted)', `${Number(facWater.wue).toFixed(2)} L/kWh`, `${facWater.coolKey} basis × ${env?.climate ?? 'temperate'} climate`],
                                                ['Direct draw (facility, on-site)', `${Math.round(facWater.annualDirectL / 1000).toLocaleString()} m³/yr`, 'facility kWh × WUE — cooling towers / humidification'],
                                                ['Incl. upstream power water', `${Math.round(facWater.annualL / 1000).toLocaleString()} m³/yr`, `+ water embedded in the ${100 - model.renewablePct}% non-renewable grid share`],
                                                ['Daily total', `${Math.round(facWater.dailyL / 1000).toLocaleString()} m³/day`, `≈ ${Number(facWater.householdsEquiv).toLocaleString()} households' daily use`],
                                                ['Intensity', `${Math.round(facWater.perMwYrL / 1e6).toLocaleString()} ML/MW·yr`, 'vs hyperscaler benchmarks in the engine data'],
                                                ['Water cost (screening)', fmtMoney(facWater.annualCostUsd), `${waterSource} rate — full-facility basis`],
                                            ] as const).map(([lbl, v, sub]) => (
                                                <tr key={lbl} className="border-b border-slate-100 dark:border-slate-800/60">
                                                    <td className="py-1 text-slate-600 dark:text-slate-300">{lbl}</td>
                                                    <td className="text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200">{v}</td>
                                                    <td className="pl-3 text-right text-[9px] text-slate-400">{sub}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <p className="mt-1.5 text-[9px] text-slate-400">
                                        Cooling map (screening): {inputs.coolingType} → {facWater.coolKey}. Cost-benefit: a low-water cooling choice (dlc/immersion) cuts direct draw ~10-30×, but on a fossil grid the UPSTREAM share dominates — renewables move total water more than the cooling tech. If the direct-draw line is already small, spending CAPEX on drier cooling buys little water benefit here.
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                24/7 CFE Note <InfoTip content="Annual renewable matching (the % shown here and in the Energy Mix) counts renewable MWh bought over a YEAR against consumption — it says nothing about the 3 a.m. hours when solar produces nothing and the load runs on grid power. Hourly-matched CFE (24/7 carbon-free energy, the Google/UN definition) is strictly harder and NOT modeled here: it would need an hourly load profile, hourly generation profiles for each PPA resource, and grid-mix time series. Typical result: a 100% annually-matched portfolio is only ~40-70% hourly-matched. No hourly number is invented — this card only states the gap." />
                            </h2>
                            <div className="space-y-1.5 text-[11px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600 dark:text-slate-300">Annual renewable matching</span>
                                    <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200">{model.renewablePct}%</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600 dark:text-slate-300">Hourly-matched CFE (24/7)</span>
                                    <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">not modeled hourly</span>
                                </div>
                            </div>
                            <p className="mt-2 text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
                                The {model.renewablePct}% figure is annual-volume matching (derived from the CAPEX renewable/cert inputs). Hourly 24/7 CFE is always lower and would require an hourly load + generation + grid-mix model — typically firming (storage, geothermal, or clean firm PPAs) at a real cost premium. Decide with economics: if the goal is reported Scope 2, annual PPAs are the cheaper instrument; hourly CFE only pays where a customer or regulator demands it.
                            </p>
                        </div>
                    </div>

                    {env && (
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Environmental Costs <span className="text-[9px] normal-case text-slate-400">country-auto rates</span></h2>
                                <span className="rounded bg-rz-mint/15 px-1.5 py-0.5 text-[9px] font-semibold text-rz-mint">{env.cname} · {env.cid}</span>
                                <span className="rounded bg-rz-data/15 px-1.5 py-0.5 text-[9px] font-semibold text-rz-data">engine DATA.envCosts + waterFootprint</span>
                                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-500">screening</span>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                                    <div className="flex items-center justify-between gap-1 text-[10px] uppercase tracking-wide text-slate-500">
                                        <span>Water Cost /yr <Explain k="wue" /></span>
                                        <select value={waterSource} onChange={(e) => setWaterSource(e.target.value as typeof waterSource)}
                                            className="rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1 py-0.5 text-[9px] normal-case text-slate-500">
                                            {(['municipal', 'reclaimed', 'river', 'groundwell'] as const).map((s) => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <TraceValue traceId="sus.waterCost">
                                        <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{fmtMoney(env.waterCost)}</div>
                                    </TraceValue>
                                    <div className="text-[10px] text-slate-500">engine volume {fmt(model.waterM3Yr ?? 0)} m³ (= Water KPI, WUE {model.wue} L/kWh × IT kWh)</div>
                                    <div className="text-[10px] text-slate-500">× climate ×{env.climateMult} ({env.climate}, ASHRAE zone) = {fmt(env.waterM3)} m³ → {fmt(env.kgal)} kgal × ${env.waterRate}/kgal ({waterSource})</div>
                                    {env.deepSea && <div className="mt-1 inline-block rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-600 dark:text-cyan-400">deep-sea ON — seawater basis, no potable draw</div>}
                                </div>
                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Carbon Cost /yr <Explain k="cue" /></div>
                                    <TraceValue traceId="sus.carbonCost">
                                        <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{fmtMoney(env.carbonCost)}</div>
                                    </TraceValue>
                                    <div className="text-[10px] text-slate-500">{fmt(env.scope2)} tCO₂e scope-2 (rendered above) × ${env.carbonRate}/tCO₂e</div>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {env.hasScheme
                                            ? <span className="rounded bg-rz-data/15 px-1.5 py-0.5 text-[9px] font-semibold text-rz-data">compliance price — {env.cid} ${env.carbonRate}/t</span>
                                            : <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-500">voluntary basis — no compliance scheme in {env.cname} yet (offset ${env.carbonRate}/t)</span>}
                                        <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[9px] text-slate-500">World Bank / OECD / NCCS 2025-26</span>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Waste Mgmt Cost /yr <InfoTip content="Annual waste-management cost: general waste tonnes × the developed/emerging country rate band, plus e-waste kg × certified ITAD rate. A screening figure covering packaging/consumables and certified disposal — IT refresh hardware is excluded. Small next to energy cost but compliance-relevant (WEEE / B3 rules)." /></div>
                                    <TraceValue traceId="sus.wasteCost">
                                        <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{fmtMoney(env.wasteCost)}</div>
                                    </TraceValue>
                                    <div className="text-[10px] text-slate-500">general {fmt(env.genTonnes, 1)} t × ${env.genRate}/t ({env.developed ? 'developed' : 'emerging'} band) + e-waste {fmt(env.eKg)} kg × ${env.eRate}/kg</div>
                                    <div className="mt-1 inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-500">screening — packaging/consumables + certified ITAD, IT refresh excluded</div>
                                </div>
                                <div className="rounded border border-rz-signal/30 bg-rz-signal/5 p-3">
                                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Total Environmental Cost /yr <InfoTip content="Sum of the water, carbon and waste costs per year, with rates auto-switched to the selected country (carbon priced at the compliance scheme rate where one exists, otherwise a voluntary offset basis). Use it for ESG budgeting alongside OPEX — it grows with the occupancy ramp shown in the forecast below." /></div>
                                    <TraceValue traceId="sus.envTotal">
                                        <div className="text-lg font-bold tabular-nums text-rz-signal">{fmtMoney(env.total)}</div>
                                    </TraceValue>
                                    <div className="text-[10px] text-slate-500">water + carbon + waste · rates auto-switch with country ({env.cid})</div>
                                </div>
                            </div>
                            <div className="mt-3">
                                <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Forecast — follows occupancy ramp (water + carbon energy-driven; waste on installed IT base)</div>
                                <div className="h-40">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={env.forecast} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#33415522" vertical={false} />
                                            <XAxis dataKey="year" tick={{ fontSize: 9 }} />
                                            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => fmtMoney(Number(v))} width={52} />
                                            <Tooltip formatter={(v) => fmtMoney(Number(v))} contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                            <Legend wrapperStyle={{ fontSize: 10 }} formatter={(value) => <span className="text-slate-600 dark:text-slate-300">{value}</span>} />
                                            <Bar dataKey="water" name="Water" stackId="env" fill="#22d3ee" />
                                            <Bar dataKey="carbon" name="Carbon" stackId="env" fill="#f59e0b" />
                                            <Bar dataKey="waste" name="Waste" stackId="env" fill="#64748b" radius={[3, 3, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Initiatives in Progress {sus.touched ? '' : <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-semibold text-amber-500">EXAMPLE</span>}</h2>
                        <div className="space-y-1.5">
                            {sus.initiatives.map((i) => (
                                <div key={i.id} className="flex items-center gap-2 text-[11px]">
                                    <span className="w-16 rounded bg-slate-500/10 px-1 py-0.5 text-center text-[9px] text-slate-500">{i.category}</span>
                                    <span className="w-52 truncate text-slate-700 dark:text-slate-200">{i.title}</span>
                                    <input type="range" min={0} max={100} step={5} value={i.progressPct}
                                        onChange={(e) => sus.actions.setInitiativeProgress(i.id, Number(e.target.value))} className="flex-1 accent-rz-mint" />
                                    <span className="w-9 text-right tabular-nums text-slate-500">{i.progressPct}%</span>
                                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${i.status === 'On Track' ? 'bg-rz-data/15 text-rz-data' : i.status === 'At Risk' ? 'bg-amber-500/15 text-amber-500' : 'bg-slate-500/15 text-slate-400'}`}>{i.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Compliance & Standards <span className="text-[9px] normal-case text-slate-400">user-attested status</span></h2>
                        <div className="grid gap-1.5 md:grid-cols-3">
                            {sus.certs.map((c) => (
                                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 text-[11px]">
                                    <span className="flex-1 truncate text-slate-700 dark:text-slate-200">{c.name}</span>
                                    <select className="rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1 py-0.5 text-[9px] text-slate-500"
                                        value={c.status} onChange={(e) => sus.actions.upsertCert({ ...c, status: e.target.value as typeof c.status })}>
                                        {['Planned', 'In Progress', 'Compliant', 'Certified'].map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
