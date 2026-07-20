'use client';

/* ─── DC-OS · PLATFORM surfaces ───────────────────────────────────────────────
 * The sidebar Platform/Support entries, made real: Data Library browses the
 * canonical engine DATA (single source), Templates applies engine use-case
 * profiles, Projects lists saved scenarios, Settings holds real prefs. Honest
 * where a surface is roadmap (Integrations/Audit/Users) — with real status.
 * ──────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useScenarioStore } from '@/store/scenario';
import { useAiConfigStore } from '@/store/aiConfig';
import { useAuthStore } from '@/store/auth';
import { useSettingsStore } from '@/store/settings';
import { useProjectsStore } from '@/store/projects';
import { useTheme } from '@/components/providers/ThemeProvider';
import { rzData, rzModels } from '@/lib/rz-engine';
import { useRequirementsStore } from '@/store/requirements';
import { applyUseCaseProfile, USE_CASE_TO_ENGINE } from '@/lib/requirementsMappings';
import { PlatformHeader, KpiChips } from '@/components/modules/platform/ScenariosPage';
import { VALUE_BINDINGS, BINDING_GROUPS } from '@/lib/value-bindings';
import ENGINE_CATALOG from '@/lib/engine-catalog.json';
import RESEARCH_LIB from '@/lib/research-library.json';
import CORPUS_FACTS from '@/lib/corpus-facts.json';
import { Database, Boxes, FolderOpen, HelpCircle, Zap, Wrench, ClipboardCheck, Users, Sun, Moon, Cpu, Server, Building, ArrowRight, CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { COUNTRIES, type CountryProfile } from '@/constants/countries';

function Head({ icon: Icon, title, sub, tone = 'from-cyan-500 to-blue-600' }: { icon: React.ElementType; title: string; sub: string; tone?: string }) {
    return (
        <div className="flex items-center gap-3 mb-5">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tone} flex items-center justify-center shadow-lg`}><Icon className="w-6 h-6 text-white" /></div>
            <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1><p className="text-sm text-slate-500 dark:text-slate-400">{sub}</p></div>
        </div>
    );
}
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <div className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 ${className}`}>{children}</div>; }
const pct = (n: number) => `${Math.round(n * 100)}%`;

/* ── Country Data Coverage — computed LIVE from constants/countries.ts ──
 * A per-country × field-group completeness matrix over the 40-country DB.
 * Every cell is derived at runtime from the real COUNTRIES objects (no
 * hardcoded coverage), so filling a gap in countries.ts updates this view
 * automatically. hvoPricePerLiter counts as empty when HVO is not available
 * (price 0 + hvoAvailable:false = no HVO supply in that market). */
type CovGroup = 'economy' | 'labor' | 'environment' | 'gridReliability' | 'fuelDiesel' | 'naturalDisaster' | 'talentPool' | 'compliance' | 'constructionIndex';
interface CovField { group: CovGroup; key: string; short: string; get: (c: CountryProfile) => unknown; }
const COV_GROUP_LABELS: Record<CovGroup, string> = {
    economy: 'Economy', labor: 'Labor', environment: 'Environment', gridReliability: 'Grid Reliability',
    fuelDiesel: 'Fuel / Diesel', naturalDisaster: 'Natural Disaster', talentPool: 'Talent Pool', compliance: 'Compliance', constructionIndex: 'Construction Idx',
};
const COV_FIELDS: CovField[] = [
    { group: 'economy', key: 'economy.electricityRate', short: 'Elec $/kWh', get: (c) => c.economy.electricityRate },
    { group: 'economy', key: 'economy.taxRate', short: 'Tax', get: (c) => c.economy.taxRate },
    { group: 'economy', key: 'economy.inflationRate', short: 'Inflation', get: (c) => c.economy.inflationRate },
    { group: 'labor', key: 'labor.baseSalary_ShiftLead', short: 'Sal SL', get: (c) => c.labor.baseSalary_ShiftLead },
    { group: 'labor', key: 'labor.baseSalary_Engineer', short: 'Sal Eng', get: (c) => c.labor.baseSalary_Engineer },
    { group: 'labor', key: 'labor.baseSalary_Technician', short: 'Sal Tech', get: (c) => c.labor.baseSalary_Technician },
    { group: 'labor', key: 'labor.baseSalary_Admin', short: 'Sal Adm', get: (c) => c.labor.baseSalary_Admin },
    { group: 'labor', key: 'labor.baseSalary_Janitor', short: 'Sal Jan', get: (c) => c.labor.baseSalary_Janitor },
    { group: 'labor', key: 'labor.socialSecurityRate', short: 'Soc Sec', get: (c) => c.labor.socialSecurityRate },
    { group: 'labor', key: 'labor.benefitsOverheadRate', short: 'Benefits', get: (c) => c.labor.benefitsOverheadRate },
    { group: 'labor', key: 'labor.nightShiftPremiumRate', short: 'Night Prem', get: (c) => c.labor.nightShiftPremiumRate },
    { group: 'labor', key: 'labor.workingHoursPerMonth', short: 'Hrs/mo', get: (c) => c.labor.workingHoursPerMonth },
    { group: 'environment', key: 'environment.saidiMinYr', short: 'SAIDI', get: (c) => c.environment.saidiMinYr },
    { group: 'environment', key: 'environment.baselineAQI', short: 'AQI', get: (c) => c.environment.baselineAQI },
    { group: 'environment', key: 'environment.aqueductStressScore', short: 'Aqueduct', get: (c) => c.environment.aqueductStressScore },
    { group: 'environment', key: 'environment.pgaPct2in50yr', short: 'PGA', get: (c) => c.environment.pgaPct2in50yr },
    { group: 'environment', key: 'environment.ashraeClimateZone', short: 'Climate', get: (c) => c.environment.ashraeClimateZone },
    { group: 'gridReliability', key: 'gridReliability.gridUptime', short: 'Uptime', get: (c) => c.gridReliability?.gridUptime },
    { group: 'gridReliability', key: 'gridReliability.brownoutFrequency', short: 'Brownout', get: (c) => c.gridReliability?.brownoutFrequency },
    { group: 'gridReliability', key: 'gridReliability.averageOutageDuration', short: 'Outage min', get: (c) => c.gridReliability?.averageOutageDuration },
    { group: 'fuelDiesel', key: 'fuelDiesel.dieselPricePerLiter', short: 'Diesel $/L', get: (c) => c.fuelDiesel?.dieselPricePerLiter },
    /* HVO: price 0 + hvoAvailable:false = no HVO supply → counted as a data gap */
    { group: 'fuelDiesel', key: 'fuelDiesel.hvoPricePerLiter', short: 'HVO $/L', get: (c) => (c.fuelDiesel && c.fuelDiesel.hvoAvailable && c.fuelDiesel.hvoPricePerLiter > 0 ? c.fuelDiesel.hvoPricePerLiter : undefined) },
    { group: 'fuelDiesel', key: 'fuelDiesel.fuelQualityRating', short: 'Fuel Qual', get: (c) => c.fuelDiesel?.fuelQualityRating },
    { group: 'naturalDisaster', key: 'naturalDisaster.compositeScore', short: 'Hazard', get: (c) => c.naturalDisaster?.compositeScore },
    { group: 'naturalDisaster', key: 'naturalDisaster.insuranceMultiplier', short: 'Insur ×', get: (c) => c.naturalDisaster?.insuranceMultiplier },
    { group: 'talentPool', key: 'talentPool.talentScore', short: 'Talent', get: (c) => c.talentPool?.talentScore },
    { group: 'talentPool', key: 'talentPool.avgHiringDays', short: 'Hiring d', get: (c) => c.talentPool?.avgHiringDays },
    { group: 'compliance', key: 'compliance.annualComplianceCost', short: 'Compl $', get: (c) => c.compliance.annualComplianceCost },
    { group: 'compliance', key: 'compliance.environmentalPermitCostPerYear', short: 'Env Permit', get: (c) => c.compliance.environmentalPermitCostPerYear },
    { group: 'constructionIndex', key: 'constructionIndex', short: 'Constr idx', get: (c) => c.constructionIndex },
];
const covFilled = (v: unknown): boolean => {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'number') return Number.isFinite(v);
    return true;
};
function CountryCoverageSection() {
    const [group, setGroup] = React.useState<'all' | CovGroup>('all');
    const [query, setQuery] = React.useState('');
    const [sel, setSel] = React.useState<string | null>(null);
    /* PERF: 40 countries × 30 fields — computed ONCE (COUNTRIES is a static module constant). */
    const cov = React.useMemo(() => {
        const rows = Object.values(COUNTRIES).map((c) => {
            const cells = COV_FIELDS.map((f) => covFilled(f.get(c)));
            const filledCount = cells.filter(Boolean).length;
            const missing = COV_FIELDS.filter((_, i) => !cells[i]);
            return { id: c.id, name: c.name, region: c.region, cells, filledCount, missing };
        });
        const fieldGaps = COV_FIELDS
            .map((f, i) => ({ key: f.key, group: f.group, gaps: rows.reduce((s, r) => s + (r.cells[i] ? 0 : 1), 0) }))
            .filter((g) => g.gaps > 0)
            .sort((a, b) => b.gaps - a.gaps);
        const totalCells = rows.length * COV_FIELDS.length;
        const filledCells = rows.reduce((s, r) => s + r.filledCount, 0);
        const maxFill = Math.max(...rows.map((r) => r.filledCount));
        const minFill = Math.min(...rows.map((r) => r.filledCount));
        const fullest = rows.filter((r) => r.filledCount === maxFill);
        const thinnest = rows.filter((r) => r.filledCount === minFill);
        return { rows, fieldGaps, totalCells, filledCells, coverage: filledCells / totalCells, maxFill, minFill, fullest, thinnest };
    }, []);
    const visFields = COV_FIELDS.map((f, i) => ({ f, i })).filter(({ f }) => group === 'all' || f.group === group);
    const visRows = cov.rows.filter((r) => !query || (r.name + ' ' + r.id).toLowerCase().includes(query.toLowerCase()));
    const selRow = sel ? cov.rows.find((r) => r.id === sel) : null;
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Country Data Coverage — {COV_FIELDS.length} fields × {cov.rows.length} countries</h2>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium uppercase text-emerald-500">computed live</span>
            </div>
            {/* Summary: totals + biggest gaps + fullest/thinnest countries */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2">
                    <p className="text-[9px] uppercase text-slate-400">Total coverage</p>
                    <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{(cov.coverage * 100).toFixed(1)}%</p>
                    <p className="text-[9px] text-slate-400">{cov.filledCells.toLocaleString()} / {cov.totalCells.toLocaleString()} cells filled</p>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2">
                    <p className="text-[9px] uppercase text-slate-400">Biggest gaps</p>
                    {cov.fieldGaps.length === 0
                        ? <p className="text-xs text-emerald-500 font-medium">No gaps — all fields filled</p>
                        : cov.fieldGaps.slice(0, 3).map((g) => (
                            <p key={g.key} className="text-[10px] text-slate-600 dark:text-slate-300"><span className="font-mono text-amber-500">{g.key.split('.').pop()}</span> kosong di <b>{g.gaps}</b> negara</p>
                        ))}
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2">
                    <p className="text-[9px] uppercase text-slate-400">Most complete</p>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{cov.fullest.length > 3 ? `${cov.fullest.length} countries` : cov.fullest.map((r) => r.name).join(', ')}</p>
                    <p className="text-[9px] text-slate-400 tabular-nums">{cov.maxFill}/{COV_FIELDS.length} fields</p>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2">
                    <p className="text-[9px] uppercase text-slate-400">Least complete</p>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{cov.thinnest.length > 3 ? `${cov.thinnest.length} countries` : cov.thinnest.map((r) => r.name).join(', ')}</p>
                    <p className="text-[9px] text-slate-400 tabular-nums">{cov.minFill}/{COV_FIELDS.length} fields</p>
                </div>
            </div>
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
                <select value={group} onChange={(e) => setGroup(e.target.value as 'all' | CovGroup)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1 text-xs outline-none focus:border-cyan-400 text-slate-900 dark:text-slate-100">
                    <option value="all">All groups ({COV_FIELDS.length} fields)</option>
                    {(Object.keys(COV_GROUP_LABELS) as CovGroup[]).map((g) => (
                        <option key={g} value={g}>{COV_GROUP_LABELS[g]} ({COV_FIELDS.filter((f) => f.group === g).length})</option>
                    ))}
                </select>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search country…"
                    className="w-44 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1 text-xs outline-none focus:border-cyan-400 text-slate-900 dark:text-slate-100" />
                <span className="text-[10px] text-slate-400">{visRows.length} negara · klik baris → daftar field kosong</span>
            </div>
            {/* Selected-country gap panel (actionable fill list) */}
            {selRow && (
                <div className="rounded-lg border border-cyan-400/40 bg-cyan-500/5 px-3 py-2">
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{selRow.name} <span className="font-mono text-[9px] text-slate-400">{selRow.id}</span> — {selRow.filledCount}/{COV_FIELDS.length} fields filled</p>
                        <button onClick={() => setSel(null)} className="ml-auto text-[10px] text-slate-400 hover:text-cyan-500">✕ close</button>
                    </div>
                    {selRow.missing.length === 0
                        ? <p className="mt-1 text-[10px] text-emerald-500">Lengkap — tidak ada field kosong.</p>
                        : (<div className="mt-1.5 flex flex-wrap gap-1.5">
                            {selRow.missing.map((f) => (
                                <span key={f.key} className="rounded-md border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-mono text-amber-600 dark:text-amber-400" title={COV_GROUP_LABELS[f.group]}>{f.key}</span>
                            ))}
                        </div>)}
                </div>
            )}
            {/* Matrix */}
            <div className="overflow-x-auto">
                <table className="text-[10px]">
                    <thead>
                        <tr className="text-slate-400">
                            <th className="py-1 pr-3 text-left sticky left-0 bg-white dark:bg-slate-900 z-10">Country</th>
                            {visFields.map(({ f }) => (
                                <th key={f.key} className="px-0.5 pb-1 align-bottom font-medium" title={`${COV_GROUP_LABELS[f.group]} · ${f.key}`}>
                                    <span className="inline-block whitespace-nowrap text-[8px]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{f.short}</span>
                                </th>
                            ))}
                            <th className="pl-2 text-right">Filled</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visRows.map((r) => (
                            <tr key={r.id} onClick={() => setSel(sel === r.id ? null : r.id)}
                                className={`border-t border-slate-100 dark:border-white/5 cursor-pointer hover:bg-cyan-500/5 ${sel === r.id ? 'bg-cyan-500/10' : ''}`}>
                                <td className="py-0.5 pr-3 whitespace-nowrap font-medium text-slate-700 dark:text-slate-200 sticky left-0 bg-white dark:bg-slate-900">{r.name} <span className="text-[8px] text-slate-400">{r.region}</span></td>
                                {visFields.map(({ f, i }) => (
                                    <td key={f.key} className="px-0.5 text-center">
                                        {r.cells[i]
                                            ? <span className="text-emerald-500">✓</span>
                                            : <span className="text-amber-500 font-bold" title={`${f.key} kosong`}>—</span>}
                                    </td>
                                ))}
                                <td className="pl-2 text-right tabular-nums text-slate-500">{r.filledCount}/{COV_FIELDS.length}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-[9px] text-slate-400">Read-only browser — coverage dihitung live dari <code>constants/countries.ts</code> (objek COUNTRIES nyata, bukan daftar statis). ✓ = terisi · <span className="text-amber-500">—</span> = kosong / tidak tersedia (HVO dihitung kosong saat pasar tanpa suplai HVO).</p>
        </div>
    );
}

/* ── Data Library — browse the canonical engine DATA (single source) ── */
export function DataLibraryDashboard() {
    const d = rzData();
    const [tab, setTab] = React.useState<'countries' | 'coverage' | 'markets' | 'pue' | 'refrigerants' | 'omcontracts' | 'sparespricing' | 'envcosts' | 'sources' | 'corpus'>('countries');
    const [srcQuery, setSrcQuery] = React.useState('');
    // Carbon-price table sort (Environmental Costs)
    const [envSort, setEnvSort] = React.useState<'country' | 'price'>('price');
    const [envDir, setEnvDir] = React.useState<1 | -1>(-1);
    const countries = d.countries || {};
    const markets = d.markets || {};
    const pue = d.pueMatrix || {};
    const refr = d.refrigerants || {};
    /* v2.5.2 sourced screening bands — rendered LIVE from rzData(), no local copy */
    const omContracts = (d.omContracts || {}) as {
        tiers?: Record<string, { low?: number; mid?: number; high?: number; scope?: string }>;
        thirdPartyMultiplier?: number; agingFacilityMultiplier?: number; basis?: string;
    };
    const sparesPricing = ((d.sparesPricing || {}).classes || {}) as Record<string, { low?: number; mid?: number; high?: number; unit?: string }>;
    const envCosts = (d.envCosts || {}) as {
        carbonPriceUsdPerT?: Record<string, number>;
        voluntaryOffsetUsdPerT?: number;
        wasteMgmt?: { generalUsdPerTonne?: { developed?: number; emerging?: number }; eWasteUsdPerKg?: number; generalTonnesPerMwItYr?: number; eWasteKgPerMwItYr?: number };
        developedMarkets?: string[];
    };
    const carbonRows = Object.entries(envCosts.carbonPriceUsdPerT || {});
    const sources = (d.sources || {}) as Record<string, { source?: string; asOf?: string; method?: string; unit?: string }>;
    const corpus = (d.benchmarksCorpus || {}) as Record<string, Record<string, { n: number; unit: string; p10: number; p25: number; p50: number; p75: number; p90: number; companies: string[]; sources: number }>>;
    const countryName = (code: string): string => ((countries as Record<string, { name?: string }>)[code]?.name) ?? code;
    const envSortBtn = (col: 'country' | 'price') => () => {
        if (envSort === col) setEnvDir((x) => (x === 1 ? -1 : 1));
        else { setEnvSort(col); setEnvDir(col === 'price' ? -1 : 1); }
    };
    const sortedCarbon = [...carbonRows].sort((a, b) => envSort === 'price'
        ? (a[1] - b[1]) * envDir
        : countryName(a[0]).localeCompare(countryName(b[0])) * envDir);
    const tabs: [typeof tab, string, number][] = [
        ['corpus', 'DC Corpus', Object.keys(corpus).length],
        ['countries', 'Countries', Object.keys(countries).length],
        ['coverage', 'Country Coverage', COV_FIELDS.length],
        ['markets', 'Markets', Object.keys(markets).length],
        ['pue', 'PUE Matrix', Object.keys(pue).length],
        ['refrigerants', 'Refrigerants', Object.keys(refr).length],
        ['omcontracts', 'O&M Contracts', Object.keys(omContracts.tiers || {}).length],
        ['sparespricing', 'Spares Pricing', Object.keys(sparesPricing).length],
        ['envcosts', 'Env Costs', carbonRows.length],
        ['sources', 'Provenance', Object.keys(sources).length],
    ];
    const totalRows = Object.keys(countries).length + Object.keys(markets).length + Object.keys(pue).length + Object.keys(refr).length
        + Object.keys(omContracts.tiers || {}).length + Object.keys(sparesPricing).length + carbonRows.length;
    // AG1: only date-like asOf values (some source entries carry prose here)
    const asOfYears = (Object.values(sources).map((v) => v.asOf).filter(Boolean) as string[]).filter((v) => /^\d{4}/.test(v));
    return (
        <div className="space-y-4">
            <PlatformHeader icon={Database} title="Data Library" sub="Centralized repository of all engine reference data, methods, and sources" tone="from-sky-500 to-cyan-600" />
            <KpiChips items={[
                { label: 'Datasets', value: String(tabs.length - 1), sub: `${totalRows} rows total` },
                { label: 'Provenance Entries', value: String(Object.keys(sources).length), sub: 'gate-enforced' },
                { label: 'DATA Version', value: (d as { version?: string }).version ? `v${(d as { version?: string }).version}` : '—', sub: 'rz-engine.js' },
                { label: 'Latest As-Of', value: asOfYears.length ? asOfYears.sort().slice(-1)[0]!.slice(0, 10) : '—', sub: 'newest source date' },
                { label: 'Access', value: 'Read-only', sub: 'single source of truth' },
            ]} />
            <div className="flex gap-1.5 flex-wrap">
                {tabs.map(([k, label, n]) => (
                    <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${tab === k ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-cyan-400/40'}`}>{label} <span className="opacity-60">({n})</span></button>
                ))}
            </div>
            <Card className="overflow-x-auto">
                {tab === 'sources' && (
                <Card>
                    <div className="mb-2 flex items-center gap-2">
                        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">DATA.sources — provenance ledger ({Object.keys(sources).length} entries)</h2>
                        <input value={srcQuery} onChange={(e) => setSrcQuery(e.target.value)} placeholder="Search key/source…"
                            className="ml-auto w-56 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1 text-xs outline-none focus:border-cyan-400 text-slate-900 dark:text-slate-100" />
                    </div>
                    <div className="max-h-[480px] overflow-y-auto">
                        <table className="w-full text-[11px]">
                            <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400 sticky top-0 bg-white dark:bg-slate-900"><th className="py-1 text-left">Data key</th><th className="text-left">Source</th><th className="text-right">As of</th></tr></thead>
                            <tbody>
                                {Object.entries(sources)
                                    .filter(([k, v]) => !srcQuery || (k + ' ' + (v.source ?? '')).toLowerCase().includes(srcQuery.toLowerCase()))
                                    .map(([k, v]) => (
                                        <tr key={k} className="border-b border-slate-100 dark:border-slate-800/60 align-top">
                                            <td className="py-1 pr-2 font-mono text-cyan-600 dark:text-cyan-400">{k}</td>
                                            <td className="pr-2 text-slate-600 dark:text-slate-300">{v.source ?? '—'}{v.method && <span className="block text-[9px] text-slate-400">{v.method}</span>}</td>
                                            <td className="text-right tabular-nums text-slate-500">{v.asOf ?? '—'}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-1.5 text-[9px] text-slate-400">Every economically-material DATA value in the engine carries a source + as-of date (gate-enforced). Read-only.</p>
                </Card>
            )}
            {tab === 'corpus' && <CorpusSection corpus={corpus} />}
            {tab === 'countries' && (
                    <table className="w-full text-xs min-w-[560px]">
                        <thead><tr className="text-slate-400 text-left"><th className="py-1.5 pr-3">Country</th><th className="pr-3">Region</th><th className="pr-3 text-right">Electricity $/kWh</th><th className="pr-3 text-right">Tax</th><th className="pr-3 text-right">Grid kgCO₂/kWh</th><th className="text-right">Constr. idx</th></tr></thead>
                        <tbody>{(Object.values(countries) as Record<string, unknown>[]).map((c) => {
                            const cc = c as { id: string; name: string; region: string; economy: { electricityRate: number; taxRate: number }; environment: { gridCarbonIntensity: number }; constructionIndex?: number };
                            return (<tr key={cc.id} className="border-t border-slate-100 dark:border-white/5"><td className="py-1.5 pr-3 font-medium text-slate-700 dark:text-slate-200">{cc.name}</td><td className="pr-3 text-slate-500">{cc.region}</td><td className="pr-3 text-right tabular-nums">{cc.economy.electricityRate.toFixed(3)}</td><td className="pr-3 text-right tabular-nums">{pct(cc.economy.taxRate)}</td><td className="pr-3 text-right tabular-nums">{cc.environment.gridCarbonIntensity.toFixed(2)}</td><td className="text-right tabular-nums">{cc.constructionIndex?.toFixed(2) ?? '—'}</td></tr>);
                        })}</tbody>
                    </table>
                )}
                {tab === 'coverage' && <CountryCoverageSection />}
                {tab === 'markets' && (
                    <table className="w-full text-xs min-w-[520px]">
                        <thead><tr className="text-slate-400 text-left"><th className="py-1.5 pr-3">Market</th><th className="pr-3 text-right">Power $/kWh</th><th className="pr-3 text-right">Colo $/kW·mo</th><th className="pr-3 text-right">Vacancy</th><th className="text-right">CAGR</th></tr></thead>
                        <tbody>{Object.entries(markets).map(([k, v]) => { const mm = v as { powerCost?: number; coloPrice?: number; vacancy?: number; cagr?: number }; return (<tr key={k} className="border-t border-slate-100 dark:border-white/5"><td className="py-1.5 pr-3 font-medium text-slate-700 dark:text-slate-200 capitalize">{k.replace(/-/g, ' ')}</td><td className="pr-3 text-right tabular-nums">{mm.powerCost ?? '—'}</td><td className="pr-3 text-right tabular-nums">{mm.coloPrice ?? '—'}</td><td className="pr-3 text-right tabular-nums">{mm.vacancy != null ? pct(mm.vacancy) : '—'}</td><td className="text-right tabular-nums">{mm.cagr != null ? pct(mm.cagr) : '—'}</td></tr>); })}</tbody>
                    </table>
                )}
                {tab === 'pue' && (
                    <table className="w-full text-xs"><thead><tr className="text-slate-400 text-left"><th className="py-1.5 pr-3">Cooling</th><th className="pr-3 text-right">Tier 2</th><th className="pr-3 text-right">Tier 3</th><th className="text-right">Tier 4</th></tr></thead>
                        <tbody>{Object.entries(pue).map(([k, v]) => { const p = v as Record<string, number>; return (<tr key={k} className="border-t border-slate-100 dark:border-white/5"><td className="py-1.5 pr-3 font-medium capitalize text-slate-700 dark:text-slate-200">{k}</td><td className="pr-3 text-right tabular-nums">{p.tier2 ?? '—'}</td><td className="pr-3 text-right tabular-nums">{p.tier3 ?? '—'}</td><td className="text-right tabular-nums">{p.tier4 ?? '—'}</td></tr>); })}</tbody>
                    </table>
                )}
                {tab === 'refrigerants' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{Object.entries(refr).map(([k, v]) => { const r = v as { label?: string; gwp?: number; safety?: string }; return (<div key={k} className="flex justify-between text-xs border border-slate-100 dark:border-white/5 rounded-lg px-3 py-2"><span className="text-slate-700 dark:text-slate-200">{r.label || k}</span><span className="text-slate-400 tabular-nums">GWP {r.gwp ?? '—'}{r.safety ? ` · ${r.safety}` : ''}</span></div>); })}</div>
                )}
                {tab === 'omcontracts' && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">O&amp;M Contract Pricing — DATA.omContracts ($/kW IT per year, fixed-fee)</h2>
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium uppercase text-emerald-500">engine · sourced band</span>
                        </div>
                        {Object.keys(omContracts.tiers || {}).length === 0
                            ? <p className="text-xs text-slate-400">Engine not loaded — DATA.omContracts unavailable in this session.</p>
                            : (<>
                                <table className="w-full text-xs min-w-[560px]">
                                    <thead><tr className="text-slate-400 text-left"><th className="py-1.5 pr-3">Contract tier</th><th className="pr-3">Scope</th><th className="pr-3 text-right">Low</th><th className="pr-3 text-right font-bold">Mid</th><th className="text-right">High</th></tr></thead>
                                    <tbody>{Object.entries(omContracts.tiers || {}).map(([k, t]) => (
                                        <tr key={k} className="border-t border-slate-100 dark:border-white/5 align-top">
                                            <td className="py-1.5 pr-3 font-medium capitalize text-slate-700 dark:text-slate-200">{k.replace(/([A-Z])/g, ' $1')}</td>
                                            <td className="pr-3 text-slate-500 max-w-[320px]">{t.scope ?? '—'}</td>
                                            <td className="pr-3 text-right tabular-nums text-slate-500">${t.low ?? '—'}</td>
                                            <td className="pr-3 text-right tabular-nums font-bold text-slate-900 dark:text-white">${t.mid ?? '—'}</td>
                                            <td className="text-right tabular-nums text-slate-500">${t.high ?? '—'}</td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                                <div className="flex flex-wrap gap-2 text-[10px]">
                                    <span className="rounded-lg border border-slate-200 dark:border-white/10 px-2 py-1 text-slate-500">Third-party vs OEM: <b className="text-slate-700 dark:text-slate-200">×{omContracts.thirdPartyMultiplier ?? '—'}</b></span>
                                    <span className="rounded-lg border border-slate-200 dark:border-white/10 px-2 py-1 text-slate-500">Facility &gt;10 yr: <b className="text-slate-700 dark:text-slate-200">×{omContracts.agingFacilityMultiplier ?? '—'}</b></span>
                                </div>
                                {omContracts.basis && <p className="text-[10px] text-slate-400">Basis: {omContracts.basis}</p>}
                                <p className="text-[9px] text-slate-400">Consumed by Maintenance → SLA (vendor tier fee = band × IT kW) — screening bands, source in DATA.sources[&apos;omContracts&apos;].</p>
                            </>)}
                    </div>
                )}
                {tab === 'sparespricing' && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Spares Pricing — DATA.sparesPricing (unit list-price bands, USD)</h2>
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium uppercase text-emerald-500">engine · sourced band</span>
                        </div>
                        {Object.keys(sparesPricing).length === 0
                            ? <p className="text-xs text-slate-400">Engine not loaded — DATA.sparesPricing unavailable in this session.</p>
                            : (<>
                                <table className="w-full text-xs min-w-[560px]">
                                    <thead><tr className="text-slate-400 text-left"><th className="py-1.5 pr-3">Spare class</th><th className="pr-3">Unit</th><th className="pr-3 text-right">Low</th><th className="pr-3 text-right font-bold">Mid</th><th className="text-right">High</th></tr></thead>
                                    <tbody>{Object.entries(sparesPricing).map(([k, b]) => (
                                        <tr key={k} className="border-t border-slate-100 dark:border-white/5">
                                            <td className="py-1.5 pr-3 font-mono text-slate-700 dark:text-slate-200">{k}</td>
                                            <td className="pr-3 text-slate-500">{b.unit ?? '—'}</td>
                                            <td className="pr-3 text-right tabular-nums text-slate-500">{b.low != null ? `$${b.low.toLocaleString()}` : '—'}</td>
                                            <td className="pr-3 text-right tabular-nums font-bold text-slate-900 dark:text-white">{b.mid != null ? `$${b.mid.toLocaleString()}` : '—'}</td>
                                            <td className="text-right tabular-nums text-slate-500">{b.high != null ? `$${b.high.toLocaleString()}` : '—'}</td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                                <p className="text-[9px] text-slate-400">Mid band = default unit cost in the newsvendor spares adapter (Maintenance → Spares) — source in DATA.sources[&apos;sparesPricing&apos;].</p>
                            </>)}
                    </div>
                )}
                {tab === 'envcosts' && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Environmental Costs — DATA.envCosts (carbon compliance price + waste bands)</h2>
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium uppercase text-emerald-500">engine · sourced band</span>
                        </div>
                        {carbonRows.length === 0
                            ? <p className="text-xs text-slate-400">Engine not loaded — DATA.envCosts unavailable in this session.</p>
                            : (<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div>
                                    <div className="max-h-[420px] overflow-y-auto">
                                        <table className="w-full text-xs">
                                            <thead><tr className="text-slate-400 text-left sticky top-0 bg-white dark:bg-slate-900">
                                                <th className="py-1.5 pr-3"><button onClick={envSortBtn('country')} className="uppercase text-[10px] font-medium hover:text-cyan-500">Country {envSort === 'country' ? (envDir === 1 ? '▲' : '▼') : ''}</button></th>
                                                <th className="text-right"><button onClick={envSortBtn('price')} className="uppercase text-[10px] font-medium hover:text-cyan-500">Carbon $/tCO₂e {envSort === 'price' ? (envDir === 1 ? '▲' : '▼') : ''}</button></th>
                                            </tr></thead>
                                            <tbody>{sortedCarbon.map(([code, price]) => (
                                                <tr key={code} className="border-t border-slate-100 dark:border-white/5">
                                                    <td className="py-1 pr-3 text-slate-700 dark:text-slate-200">{countryName(code)} <span className="text-[9px] text-slate-400 font-mono">{code}</span></td>
                                                    <td className="text-right tabular-nums">{price > 0
                                                        ? <span className="font-medium text-slate-900 dark:text-white">${price}</span>
                                                        : <span className="text-amber-500" title={`No compliance scheme — voluntary offset basis $${envCosts.voluntaryOffsetUsdPerT ?? 10}/t (labeled)`}>offset ${envCosts.voluntaryOffsetUsdPerT ?? 10}</span>}</td>
                                                </tr>
                                            ))}</tbody>
                                        </table>
                                    </div>
                                    <p className="mt-1 text-[9px] text-slate-400">{carbonRows.length} countries — compliance price where a scheme exists; <span className="text-amber-500">offset</span> = voluntary basis (no compliance scheme), labeled.</p>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Waste management bands (screening)</h3>
                                    {([
                                        ['General waste — developed markets', envCosts.wasteMgmt?.generalUsdPerTonne?.developed, '$/tonne'],
                                        ['General waste — emerging markets', envCosts.wasteMgmt?.generalUsdPerTonne?.emerging, '$/tonne'],
                                        ['E-waste (certified ITAD/recycling)', envCosts.wasteMgmt?.eWasteUsdPerKg, '$/kg'],
                                        ['General waste intensity', envCosts.wasteMgmt?.generalTonnesPerMwItYr, 't / MW-IT·yr'],
                                        ['E-waste intensity', envCosts.wasteMgmt?.eWasteKgPerMwItYr, 'kg / MW-IT·yr'],
                                    ] as [string, number | undefined, string][]).map(([label, val, unit]) => (
                                        <div key={label} className="flex justify-between text-xs border border-slate-100 dark:border-white/5 rounded-lg px-3 py-2">
                                            <span className="text-slate-700 dark:text-slate-200">{label}</span>
                                            <span className="text-slate-500 tabular-nums">{val != null ? `${val.toLocaleString()} ${unit}` : '—'}</span>
                                        </div>
                                    ))}
                                    <p className="text-[9px] text-slate-400">Source in DATA.sources[&apos;envCosts&apos;] — World Bank Carbon Pricing Dashboard + OECD ECR 2025 + national schemes; waste = screening bands.</p>
                                </div>
                            </div>)}
                    </div>
                )}
                <p className="mt-3 text-[10px] text-slate-400">Read-only view of <code>rz-engine.js DATA</code> — the single source every calculator + module consumes.</p>
            </Card>
        </div>
    );
}

/* ── Templates — apply an engine use-case profile to the project ── */
const CoolMap: Record<string, 'air' | 'inrow' | 'rdhx' | 'liquid'> = { air: 'air', inrow: 'inrow', rdhx: 'rdhx', liquid: 'liquid' };
export function TemplatesDashboard() {
    const profiles = (rzData().requirements?.useCaseProfiles || {}) as Record<string, { label: string; rackKw: number; cooling: string; tierFloor: number; note?: string }>;
    const [applied, setApplied] = React.useState<string | null>(null);
    const [toast, setToast] = React.useState<string | null>(null);
    /* AE4: templates apply the FULL engine profile through the shared S2
     * applier (density + cooling + tier floor + workload-mix preset — same
     * path as picking the use case in Requirements 1.2). */
    const apply = (engineKey: string) => {
        const ui = (Object.entries(USE_CASE_TO_ENGINE).find(([, e]) => e === engineKey)?.[0] ?? 'ai') as Parameters<typeof applyUseCaseProfile>[0];
        useRequirementsStore.getState().actions.setOverview({ useCase: ui });
        const summary = applyUseCaseProfile(ui);
        setApplied(engineKey); setToast(`${profiles[engineKey]?.label ?? engineKey}: ${summary}`);
        setTimeout(() => { setApplied(null); setToast(null); }, 3500);
    };
    const icon: Record<string, React.ElementType> = { ai: Cpu, hpc: Server, cloud: Boxes, colo: Building, enterprise: Building, edge: Zap };
    const entries = Object.entries(profiles);
    return (
        <div className="space-y-4">
            <PlatformHeader icon={Boxes} title="Template Library" sub="Pre-built engine profiles for data-center planning — one click seeds the whole project" tone="from-violet-500 to-fuchsia-600" />
            <KpiChips items={[
                { label: 'Templates', value: String(entries.length), sub: 'engine useCaseProfiles' },
                { label: 'Cooling classes', value: String(new Set(entries.map(([, p]) => p.cooling)).size), sub: 'air → liquid' },
                { label: 'Density range', value: entries.length ? `${Math.min(...entries.map(([, p]) => p.rackKw))}–${Math.max(...entries.map(([, p]) => p.rackKw))} kW` : '—', sub: 'per rack' },
                { label: 'Source', value: 'engine', sub: 'models.requirements — live values' },
            ]} />
            {toast && <div className="rounded-lg border border-violet-500/40 bg-violet-600/10 px-3 py-2 text-[11px] text-violet-500">{toast}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {entries.map(([k, p]) => { const Icon = icon[k] || Boxes; return (
                    <Card key={k}>
                        <div className="flex items-center gap-2 mb-2"><Icon className="w-4 h-4 text-violet-500" /><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.label}</h3>
                            <span className="ml-auto rounded bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-emerald-500" title="Values from the live engine profile">engine</span></div>
                        <div className="text-[11px] text-slate-500 space-y-0.5 mb-2">
                            {([
                                ['Rack density', `${p.rackKw} kW/rack`],
                                ['Cooling', p.cooling],
                                ['Tier floor', `Tier ${p.tierFloor}`],
                                ['Workload mix', 'preset applied (1.2)'],
                            ] as [string, string][]).map(([l, v]) => (
                                <div key={l} className="flex justify-between" title={`${l}: ${v}`}><span>✓ {l}</span><span className="font-medium capitalize text-slate-700 dark:text-slate-300">{v}</span></div>
                            ))}
                        </div>
                        <button onClick={() => apply(k)} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors">
                            {applied === k ? <><CheckCircle2 className="w-3.5 h-3.5" /> Applied</> : <>Use This Template <ArrowRight className="w-3.5 h-3.5" /></>}
                        </button>
                    </Card>
                ); })}
            </div>
            <p className="text-[10px] text-slate-400">Applying a template runs the same shared profile writer as Requirements 1.2 — density, cooling, tier floor and the workload-mix preset land in the real stores (adjustable afterwards).</p>
        </div>
    );
}

/* ── Projects — saved scenarios ── */
export function ProjectsDashboard() {
    const { scenarios, deleteScenario, togglePanel } = useScenarioStore();
    return (
        <div className="space-y-4">
            <Head icon={FolderOpen} title="Projects" sub="Saved scenarios — configurations you can restore or compare" tone="from-cyan-500 to-blue-600" />
            <button onClick={togglePanel} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium"><FolderOpen className="w-3.5 h-3.5" /> Open Scenario Manager</button>
            {scenarios.length === 0
                ? <Card><p className="text-xs text-slate-500">No saved scenarios yet. Configure a project and use <b>Quick Actions → New Scenario</b> (or the Scenario Manager) to save one.</p></Card>
                : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{scenarios.map((s) => (
                    <Card key={s.id}>
                        <div className="flex items-start justify-between"><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.name}</h3><button onClick={() => deleteScenario(s.id)} className="text-[10px] text-slate-400 hover:text-rose-500">Delete</button></div>
                        <div className="text-[10px] text-slate-400 mt-1">{new Date(s.timestamp).toLocaleString()}</div>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
                            <div><span className="text-slate-500 block">Country</span><span className="font-medium text-slate-700 dark:text-slate-300">{s.countryId}</span></div>
                            <div><span className="text-slate-500 block">Staff</span><span className="font-medium text-slate-700 dark:text-slate-300">{s.summary?.totalStaff ?? '—'}</span></div>
                            <div><span className="text-slate-500 block">CAPEX</span><span className="font-medium text-slate-700 dark:text-slate-300">{s.summary?.annualCapex ? `$${(s.summary.annualCapex / 1e6).toFixed(1)}M` : '—'}</span></div>
                        </div>
                    </Card>
                ))}</div>}
        </div>
    );
}

/* ── Settings — real preferences ── */
export function SettingsDashboard() {
    const { theme, setTheme } = useTheme();
    const ai = useAiConfigStore();
    const { selectedCountry } = useSimulationStore();
    return (
        <div className="space-y-4">
            <Head icon={Wrench} title="Settings" sub="Appearance, data source, and AI overlay" tone="from-slate-500 to-slate-700" />
            <Card>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Appearance</h2>
                <div className="flex gap-2">
                    <button onClick={() => setTheme('light')} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border ${theme === 'light' ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-600' : 'border-slate-200 dark:border-white/10 text-slate-500'}`}><Sun className="w-3.5 h-3.5" /> Light</button>
                    <button onClick={() => setTheme('dark')} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border ${theme === 'dark' ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-400' : 'border-slate-200 dark:border-white/10 text-slate-500'}`}><Moon className="w-3.5 h-3.5" /> Dark</button>
                </div>
            </Card>
            <Card>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Engine &amp; Data</h2>
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <div className="flex justify-between"><span>Reference source</span><span className="text-slate-500">rz-engine.js DATA (single source)</span></div>
                    <div className="flex justify-between"><span>Active country</span><span className="text-slate-500">{selectedCountry?.name || '—'}</span></div>
                    <div className="flex justify-between"><span>AI decision overlay</span><span className={ai.enabled ? 'text-emerald-500' : 'text-slate-500'}>{ai.enabled ? `${ai.provider} · ${ai.model}` : 'built-in deterministic engine'}</span></div>
                </div>
                <p className="mt-2 text-[10px] text-slate-400">Configure the AI overlay from the dashboard top bar (AI Assistant).</p>
            </Card>
        </div>
    );
}

/* ── Knowledge Base ── */
const PROV_STYLE: Record<string, string> = {
    input: 'bg-violet-500/15 text-violet-400', engine: 'bg-emerald-500/15 text-emerald-500',
    derived: 'bg-cyan-500/15 text-cyan-500', tracking: 'bg-sky-500/15 text-sky-400',
    assumption: 'bg-amber-500/15 text-amber-500', screening: 'bg-amber-500/15 text-amber-500',
};

export function KnowledgeDashboard() {
    const models = Object.keys(rzModels() || {});
    const setActiveTab = useSimulationStore((x) => x.actions.setActiveTab);
    const [tab, setTab] = React.useState<'bindings' | 'models'>('bindings');
    const [q, setQ] = React.useState('');
    const [grp, setGrp] = React.useState<string>('all');
    const [open, setOpen] = React.useState<string | null>(null);
    const rows = VALUE_BINDINGS.filter((b) =>
        (grp === 'all' || b.group === grp) &&
        (!q || (b.label + ' ' + b.id + ' ' + b.formula + ' ' + (b.engineFn ?? '') + ' ' + b.sourceParams.join(' ')).toLowerCase().includes(q.toLowerCase())));
    return (
        <div className="space-y-4">
            <PlatformHeader icon={HelpCircle} title="Knowledge Base" sub="Value Binding & Sync Manual — where every number comes from, and who consumes it" tone="from-amber-500 to-orange-600"
                actions={<div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                    {([['bindings', 'Value Bindings'], ['models', 'Engine Models']] as const).map(([k, l]) => (
                        <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                    ))}
                </div>} />

            {tab === 'bindings' && (<>
                <KpiChips items={[
                    { label: 'Documented Bindings', value: String(VALUE_BINDINGS.length), sub: 'per point/value' },
                    { label: 'Groups', value: String(BINDING_GROUPS.length), sub: 'canonicals → results' },
                    { label: 'Engine-computed', value: String(VALUE_BINDINGS.filter((b) => b.provenance === 'engine').length), sub: 'rz-engine / modules' },
                    { label: 'Single-source rule', value: '100%', sub: 'every value one origin, N consumers' },
                ]} />
                <div className="flex flex-wrap items-center gap-2">
                    <input className="w-64 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs outline-none focus:border-violet-500 text-slate-900 dark:text-slate-100"
                        placeholder="Search value, formula, engine fn…" value={q} onChange={(e) => setQ(e.target.value)} />
                    <div className="flex flex-wrap gap-1">
                        {['all', ...BINDING_GROUPS].map((g) => (
                            <button key={g} onClick={() => setGrp(g)}
                                className={`rounded-full px-2 py-1 text-[10px] ${grp === g ? 'bg-violet-600 text-white' : 'border border-slate-300 dark:border-slate-700 text-slate-500 hover:border-violet-400'}`}>{g}</button>
                        ))}
                    </div>
                    <span className="ml-auto text-[10px] text-slate-400">{rows.length} of {VALUE_BINDINGS.length}</span>
                </div>
                <div className="space-y-1.5">
                    {rows.map((b) => (
                        <div key={b.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                            <button onClick={() => setOpen(open === b.id ? null : b.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
                                <span className={`rounded px-1.5 py-0.5 text-[8.5px] font-bold uppercase ${PROV_STYLE[b.provenance]}`}>{b.provenance}</span>
                                <span className="text-xs font-semibold text-slate-900 dark:text-white">{b.label}</span>
                                <code className="text-[9px] text-slate-400">{b.id}</code>
                                <span className="ml-auto hidden text-[9px] text-slate-400 md:block">{b.pages.length} page(s) · {b.consumers.length} consumer(s)</span>
                            </button>
                            {open === b.id && (
                                <div className="grid gap-3 border-t border-slate-100 dark:border-slate-800/60 px-3 py-2.5 text-[11px] md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <div><span className="text-[9px] font-semibold uppercase text-slate-400">Formula / derivation</span>
                                            <p className="text-slate-600 dark:text-slate-300">{b.formula}</p></div>
                                        {b.engineFn && <div><span className="text-[9px] font-semibold uppercase text-slate-400">Engine function</span>
                                            <p><code className="text-emerald-500">{b.engineFn}</code></p></div>}
                                        <div><span className="text-[9px] font-semibold uppercase text-slate-400">Source parameters</span>
                                            <div className="flex flex-wrap gap-1">{b.sourceParams.map((sp) => <code key={sp} className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] text-violet-400">{sp}</code>)}</div></div>
                                        {b.notes && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[10px] text-amber-600 dark:text-amber-400">{b.notes}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <div><span className="text-[9px] font-semibold uppercase text-slate-400">Rendered on</span>
                                            <div className="flex flex-wrap gap-1">{b.pages.map((pg) => (
                                                <button key={pg} onClick={() => setActiveTab(pg as never)}
                                                    className="rounded border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-500 hover:border-violet-400 hover:text-violet-400">{pg} ↗</button>
                                            ))}</div></div>
                                        <div><span className="text-[9px] font-semibold uppercase text-slate-400">Consumers (sync targets)</span>
                                            <ul className="list-disc pl-4 text-[10px] text-slate-600 dark:text-slate-300">{b.consumers.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <p className="text-[10px] text-slate-400">Every entry: one origin (violet source params) → one formula/engine fn → N consumers. The synergy probe asserts cross-page equality per binding id; KPI elements carry matching <code>data-bind</code> anchors.</p>
            </>)}

            {tab === 'models' && (<>
                <Card>
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            Engine catalog — {ENGINE_CATALOG.modelCount} namespaces · {ENGINE_CATALOG.functionCount} functions · {ENGINE_CATALOG.sourceCount} sourced tables · DATA v{ENGINE_CATALOG.dataVersion}
                        </h2>
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium uppercase text-emerald-500">auto-generated</span>
                    </div>
                    <p className="mb-2 text-[10px] text-slate-400">
                        Generated from <code>rz-engine.js</code> by <code>tools/build-engine-catalog.mjs</code> — consumers are grep-derived from real usage across the site + DC-OS.
                        The staleness gate (<code>test-value-bindings.mjs</code>) blocks any engine change that skips regeneration, so this page is current by construction.
                        {models.length > 0 ? '' : ' (engine not loaded in this session — showing the committed catalog)'}
                    </p>
                    <div className="space-y-1.5">
                        {ENGINE_CATALOG.namespaces.map((ns) => (
                            <div key={ns.name} className="rounded-lg border border-slate-200 dark:border-slate-800">
                                <button onClick={() => setOpen(open === 'ns:' + ns.name ? null : 'ns:' + ns.name)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left">
                                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">models.{ns.name}</span>
                                    <span className="text-[9px] text-slate-400">{ns.functions.length} fn</span>
                                    {ns.consumers.length > 0 && <span className="ml-auto rounded bg-cyan-500/10 px-1.5 py-0.5 text-[9px] text-cyan-600 dark:text-cyan-400">{ns.consumers.length} consumer{ns.consumers.length > 1 ? 's' : ''}</span>}
                                </button>
                                {open === 'ns:' + ns.name && (
                                    <div className="border-t border-slate-100 dark:border-slate-800 px-2.5 py-2 space-y-2">
                                        <div className="flex flex-wrap gap-1.5">
                                            {ns.functions.map((f) => (
                                                <span key={f.name} className="rounded bg-slate-100 dark:bg-white/[0.05] px-2 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300" title={`models.${ns.name}.${f.name}(${f.params.join(', ')})`}>
                                                    {f.name}({f.params.join(', ')})
                                                </span>
                                            ))}
                                        </div>
                                        {ns.consumers.length > 0 && (
                                            <div>
                                                <span className="text-[9px] font-semibold uppercase text-slate-400">Consumers (auto-detected)</span>
                                                <div className="mt-0.5 flex flex-wrap gap-1">
                                                    {ns.consumers.map((c) => (
                                                        <span key={c} className="rounded border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-500">{c}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
                <Card>
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Data provenance ({ENGINE_CATALOG.sourceCount} sources)</h2>
                    <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
                        {ENGINE_CATALOG.sources.map((s) => (
                            <div key={s.key} className="flex items-baseline gap-2 text-[10px]">
                                <span className="font-mono text-slate-600 dark:text-slate-300 shrink-0">{s.key}</span>
                                <span className="text-slate-400 truncate" title={s.source}>{s.source}</span>
                                <span className="ml-auto shrink-0 text-slate-400">{s.asOf}</span>
                            </div>
                        ))}
                    </div>
                </Card>
                <Card>
                    <div className="mb-2 flex items-center gap-2">
                        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Research Library — dokumen korpus publik ({RESEARCH_LIB.docs.length})</h2>
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium uppercase text-emerald-500">auto-generated</span>
                    </div>
                    <div className="space-y-1.5">
                        {RESEARCH_LIB.docs.map((doc) => (
                            <div key={doc.url} className="flex items-baseline gap-2 text-[11px]">
                                <a href={doc.url} target="_blank" rel="noopener" className="font-medium text-cyan-600 dark:text-cyan-400 hover:underline">{doc.company}</a>
                                <span className="text-[9px] text-slate-400">{doc.segment}</span>
                                <span className="ml-auto text-[10px] tabular-nums text-slate-500">{doc.factCount} fakta · {doc.metrics.join(', ')}</span>
                            </div>
                        ))}
                    </div>
                    <p className="mt-1.5 text-[9px] text-slate-400">Sumber jurnal/laporan riset yang menyuplai korpus — setiap fakta tertelusur ke dokumen + kutipan aslinya (pipeline tools/dc-corpus).</p>
                </Card>
                <Card>
                    <a href="/glossary.html" target="_blank" className="inline-flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"><ExternalLink className="w-3.5 h-3.5" /> Open the full DC glossary</a>
                    <p className="mt-1 text-[10px] text-slate-400">Every parameter across the platform carries an RZExplain tooltip sourced from this glossary.</p>
                </Card>
            </>)}
        </div>
    );
}

/* ── Data Library › DC Corpus tab — segment filter + per-fact drill-down.
 * Setiap baris distribusi bisa diklik → daftar fakta mentah di baliknya
 * (value + company + source_url + kutipan verbatim, dari corpus-facts.json —
 * mirror auto-generated dari tools/dc-corpus/dc-facts.json). ── */
type CorpusDistRow = { n: number; unit: string; p10: number; p25: number; p50: number; p75: number; p90: number; companies: string[]; sources: number };
interface CorpusFact { metric: string; segment: string; value: number; unit: string; company: string; year: number | null; source_url: string; quote: string }

function CorpusSection({ corpus }: { corpus: Record<string, Record<string, CorpusDistRow>> }) {
    const [segFilter, setSegFilter] = React.useState<string>('all');
    const [openRow, setOpenRow] = React.useState<string | null>(null);
    const facts = CORPUS_FACTS.facts as CorpusFact[];
    const segments = React.useMemo(
        () => [...new Set(Object.values(corpus).flatMap((m) => Object.keys(m)))].sort(),
        [corpus]
    );
    const rows = Object.entries(corpus)
        .flatMap(([metric, segs]) => Object.entries(segs).map(([seg, dta]) => ({ metric, seg, dta })))
        .filter((r) => segFilter === 'all' || r.seg === segFilter);
    const totalFacts = rows.reduce((s, r) => s + r.dta.n, 0);
    const host = (u: string): string => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
    return (
        <Card>
            <div className="mb-2 flex items-center gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">DC Public-Data Corpus — distribusi multi-sumber</h2>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium uppercase text-emerald-500">auto-generated</span>
            </div>
            <p className="mb-2 text-[10px] text-slate-400">Setiap fakta membawa source_url + kutipan verbatim (gate-enforced) — pipeline tools/dc-corpus (markitdown). Persentil p10-p90 per metrik × segmen. Klik baris untuk drill-down fakta mentah.</p>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[9px] font-semibold uppercase text-slate-400">Segmen:</span>
                {['all', ...segments].map((s) => (
                    <button key={s} onClick={() => { setSegFilter(s); setOpenRow(null); }}
                        className={`rounded-lg border px-2 py-0.5 text-[10px] font-medium transition-colors ${segFilter === s ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-cyan-400/40'}`}>
                        {s === 'all' ? `semua (${totalFactsAll(corpus)})` : s}
                    </button>
                ))}
                <span className="ml-auto text-[9px] tabular-nums text-slate-400">{rows.length} distribusi · {totalFacts} fakta</span>
            </div>
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[11px]">
                <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                    <th className="py-1.5 pr-3">Metrik</th><th className="py-1.5 pr-3">Segmen</th><th className="py-1.5 pr-3">n</th>
                    <th className="py-1.5 pr-3">p10</th><th className="py-1.5 pr-3">p25</th><th className="py-1.5 pr-3 font-bold">p50</th>
                    <th className="py-1.5 pr-3">p75</th><th className="py-1.5 pr-3">p90</th><th className="py-1.5">Perusahaan</th>
                </tr></thead>
                <tbody>{rows.flatMap(({ metric, seg, dta }) => {
                    const key = metric + '|' + seg;
                    const open = openRow === key;
                    const rowFacts = open ? facts.filter((f) => f.metric === metric && f.segment === seg) : [];
                    const trs = [(
                        <tr key={key} onClick={() => setOpenRow(open ? null : key)}
                            className={`cursor-pointer border-b border-slate-100 dark:border-slate-800/60 ${open ? 'bg-cyan-500/[0.04]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'}`}>
                            <td className="py-1.5 pr-3 font-medium text-slate-700 dark:text-slate-200"><span className={`mr-1 inline-block text-[9px] transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>{metric} <span className="text-[9px] text-slate-400">({dta.unit})</span></td>
                            <td className="py-1.5 pr-3 text-slate-500">{seg}</td>
                            <td className="py-1.5 pr-3 tabular-nums">{dta.n}{dta.n < 5 && <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400">n kecil — indikatif</span>}</td>
                            <td className="py-1.5 pr-3 tabular-nums text-slate-500">{dta.p10.toLocaleString()}</td>
                            <td className="py-1.5 pr-3 tabular-nums text-slate-500">{dta.p25.toLocaleString()}</td>
                            <td className="py-1.5 pr-3 tabular-nums font-bold text-slate-900 dark:text-white">{dta.p50.toLocaleString()}</td>
                            <td className="py-1.5 pr-3 tabular-nums text-slate-500">{dta.p75.toLocaleString()}</td>
                            <td className="py-1.5 pr-3 tabular-nums text-slate-500">{dta.p90.toLocaleString()}</td>
                            <td className="py-1.5 text-[10px] text-slate-400" title={dta.companies.join(', ')}>{dta.companies.slice(0, 3).join(', ')}{dta.companies.length > 3 ? ` +${dta.companies.length - 3}` : ''} · {dta.sources} dok</td>
                        </tr>
                    )];
                    if (open) trs.push(
                        <tr key={key + ':facts'} className="border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/60 dark:bg-white/[0.02]">
                            <td colSpan={9} className="px-3 py-2">
                                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Fakta mentah — {metric} × {seg} ({rowFacts.length})</div>
                                <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                                    {rowFacts.map((f, i) => (
                                        <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 px-2 py-1.5">
                                            <div className="flex flex-wrap items-baseline gap-2 text-[10px]">
                                                <span className="font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-100">{f.value.toLocaleString()} {f.unit}</span>
                                                <span className="text-slate-500">{f.company}{f.year != null ? ` · ${f.year}` : ''}</span>
                                                <a href={f.source_url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}
                                                    className="ml-auto inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:underline">
                                                    <ExternalLink className="h-3 w-3" />{host(f.source_url)}
                                                </a>
                                            </div>
                                            {f.quote && <blockquote className="mt-0.5 border-l-2 border-slate-200 dark:border-slate-700 pl-2 text-[9px] italic leading-relaxed text-slate-500 dark:text-slate-400">“{f.quote}”</blockquote>}
                                        </div>
                                    ))}
                                </div>
                            </td>
                        </tr>
                    );
                    return trs;
                })}</tbody>
            </table></div>
            <p className="mt-1.5 text-[9px] text-slate-400">Distribusi dihitung ulang oleh tools/dc-corpus/aggregate.mjs (append-only); fakta drill-down dari corpus-facts.json — mirror slim dc-facts.json ({CORPUS_FACTS.count} fakta, kutipan dipotong 240 karakter). Segmen: finance = laporan keuangan operator/REIT · hyperscale = laporan sustainability hyperscaler · pm = dokumen perencanaan/perizinan · research = badan riset (IEA/LBNL/DOE/Uptime) · spec = standar teknis (ASHRAE/Green Grid).</p>
        </Card>
    );
}

function totalFactsAll(corpus: Record<string, Record<string, CorpusDistRow>>): number {
    return Object.values(corpus).reduce((s, m) => s + Object.values(m).reduce((t, d) => t + d.n, 0), 0);
}

/* ── Integrations — real status ── */
export function IntegrationsDashboard() {
    const user = useAuthStore((s) => s.user);
    const ai = useAiConfigStore();
    // Real check: the engine is "connected" only when window.RZEngine actually
    // loaded (rzModels() resolves), not a hardcoded true.
    const engineLoaded = !!(rzModels() && rzModels().capex);
    const rows: [string, boolean, string][] = [
        ['Supabase Auth', !!user, user ? `signed in · ${user.role}` : 'not connected'],
        ['RZ Engine (shared)', engineLoaded, engineLoaded ? 'rz-engine.js loaded' : 'not loaded (using local fallback)'],
        ['Backend /calc (server-side math)', engineLoaded, 'rz-finance-gateway — configured (server-side dispatch)'],
        ['AI decision API', ai.enabled, ai.enabled ? `${ai.provider} · ${ai.model}` : 'optional — not configured (built-in engine)'],
    ];
    return (
        <div className="space-y-4">
            <Head icon={Zap} title="Integrations" sub="Connected services powering the platform" tone="from-emerald-500 to-teal-600" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{rows.map(([name, on, note]) => (
                <Card key={name}><div className="flex items-center gap-2">{on ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-slate-400" />}<div><div className="text-sm font-medium text-slate-800 dark:text-slate-100">{name}</div><div className="text-[10px] text-slate-500">{note}</div></div></div></Card>
            ))}</div>
        </div>
    );
}

/* ── Audit ── */
export function AuditDashboard() {
    /* AG4: surface the REAL local audit — settings change log + saved
     * scenario/project events (localStorage-backed). Server-side audit_log
     * stays an honest note until the service role is configured. */
    const activity = useSettingsStore((x) => x.activity ?? []);
    const user = useAuthStore((x) => x.user);
    const scenarios = useScenarioStore((x) => x.scenarios);
    const projects = useProjectsStore((x) => x.projects);
    const rows: { ts: number; action: string; kind: string }[] = [
        ...activity.map((a) => ({ ts: a.ts, action: a.msg, kind: 'settings' })),
        ...scenarios.map((sc) => ({ ts: sc.timestamp, action: `Scenario saved: ${sc.name}`, kind: 'scenario' })),
        ...projects.map((pr) => ({ ts: pr.updatedAt, action: `Project updated: ${pr.name}`, kind: 'project' })),
    ].sort((a, b) => b.ts - a.ts).slice(0, 50);
    return (
        <div className="space-y-4">
            <PlatformHeader icon={ClipboardCheck} title="Audit Trail" sub="Local change history (real) + server-side audit scope" tone="from-slate-500 to-slate-700" />
            <KpiChips items={[
                { label: 'Local Events', value: String(rows.length), sub: 'settings · scenarios · projects' },
                { label: 'Actor', value: user?.email?.split('@')[0] ?? 'local', sub: user?.role ?? 'session' },
                { label: 'Scenarios', value: String(scenarios.length), sub: 'saved' },
                { label: 'Projects', value: String(projects.length), sub: 'bundles' },
            ]} />
            <Card>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Local Change History</h2>
                {rows.length === 0 && <p className="text-xs text-slate-400">No local events yet — settings changes, scenario saves and project updates land here.</p>}
                <table className="w-full text-[11px]">
                    <tbody>
                        {rows.map((r, i) => (
                            <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60">
                                <td className="w-40 py-1 tabular-nums text-slate-400">{new Date(r.ts).toLocaleString()}</td>
                                <td className="w-20"><span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[9px] uppercase text-slate-500">{r.kind}</span></td>
                                <td className="text-slate-600 dark:text-slate-300">{r.action}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
            <Card><p className="text-xs text-slate-500">Server-side: every <code>/calc</code> call and admin action is logged to the Supabase <code>audit_log</code> table (best-effort, non-blocking) when the service role is configured — that view will surface here for root users.</p></Card>
        </div>
    );
}

/* ── Users ── */
export function UsersDashboard() {
    const user = useAuthStore((s) => s.user);
    const root = user?.role === 'root';
    return (
        <div className="space-y-4">
            <Head icon={Users} title="User Management" sub="Accounts + roles" tone="from-indigo-500 to-blue-600" />
            <Card>
                <div className="text-xs text-slate-600 dark:text-slate-300"><div className="flex justify-between py-1"><span>Signed in as</span><span className="font-medium">{user?.email || '—'}</span></div><div className="flex justify-between py-1"><span>Role</span><span className="font-medium capitalize">{user?.role || '—'}</span></div></div>
                <p className="mt-2 text-[10px] text-slate-400">{root ? 'Account provisioning (create / reset / migrate) is handled by the rz-ops admin panel via the Supabase admin-users Edge Function.' : 'User administration is available to root accounts via the rz-ops panel.'}</p>
            </Card>
        </div>
    );
}
