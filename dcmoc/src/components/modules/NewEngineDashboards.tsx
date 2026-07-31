'use client';

/* ─── DC-OS · dedicated pillar dashboards for the new Layer engines ───────────
 * Requirements(L1) · Site Intelligence(L2) · Architecture(L3) · Construction(L6)
 * · Commissioning(L7) · Asset Intelligence(L9). Each consumes its RZEngine model
 * with the current project config — all values engine-real, honest fallbacks.
 * ──────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useRequirementsStore } from '@/store/requirements';
import { useCapexStore } from '@/store/capex';
import { densityToEngineBucket } from '@/lib/requirementsMappings';
import { rzModels, rzData } from '@/lib/rz-engine';
import { generatePillarPDF, type PillarReport } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import { MapPin, Boxes, HardHat, CheckCircle2, Activity, FileDown } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';

const REDUNDANCY_KEY: Record<string, string> = { 'N+1': 'n1', '2N': '2n', '2N+1': '2n1' };
const useCfg = () => {
    const { inputs, selectedCountry } = useSimulationStore();
    return { inputs, country: selectedCountry, redKey: REDUNDANCY_KEY[inputs.powerRedundancy] || 'n1' };
};

function Head({ icon: Icon, title, sub, tone = 'from-cyan-500 to-blue-600', report }: { icon: React.ElementType; title: string; sub: string; tone?: string; report?: () => PillarReport }) {
    const [busy, setBusy] = React.useState(false);
    const onExport = async () => { if (!report) return; setBusy(true); try { await generatePillarPDF(report()); } finally { setBusy(false); } };
    return (
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded bg-rz-info/10 border border-rz-info/30 flex items-center justify-center"><Icon className="w-6 h-6 text-rz-info" /></div>
                <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1><p className="text-sm text-slate-500 dark:text-slate-400">{sub}</p></div>
            </div>
            {report && (
                <button onClick={onExport} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-cyan-700 text-white text-xs font-medium transition-colors disabled:opacity-60">
                    <FileDown className="w-3.5 h-3.5" />{busy ? 'Generating…' : 'Generate Report'}
                </button>
            )}
        </div>
    );
}
function Card({ children }: { children: React.ReactNode }) { return <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">{children}</div>; }
function Metric({ label, value, sub, tip }: { label: string; value: string; sub?: string; tip?: string }) {
    return <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 transition-colors hover:border-rz-info/50"><div className="text-[10px] uppercase tracking-wide text-slate-500 flex items-center gap-1">{label}{tip && <Tooltip content={tip} />}</div><div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</div>{sub && <div className="text-[10px] text-slate-500">{sub}</div>}</div>;
}

const SITE_FACTOR_TIPS: Record<string, string> = {
    power: 'Grid power reliability of the country (uptime / outage exposure). Higher is better.',
    grid: 'Grid strength & interconnection quality — capacity headroom and stability of the local network.',
    seismic: 'Seismic safety — a lower earthquake-zone hazard scores higher (less structural risk/cost).',
    talent: 'Availability of skilled data-centre operations and engineering talent in the market.',
    tax: 'Tax & incentive attractiveness (corporate tax, DC incentives) for the location.',
    carbon: 'Grid carbon intensity — cleaner electricity (lower gCO₂/kWh) scores higher.',
    flood: 'Flood / climate hazard exposure of the site; lower risk scores higher.',
    latency: 'Network latency & connectivity to major population and peering hubs.',
    water: 'Water availability & stress for evaporative cooling; less water stress scores higher.',
};

const ASSET_CLASS_TIPS: Record<string, string> = {
    battery: 'UPS battery strings — the highest wear-out rate; Li-ion/VRLA degrade with cycles and heat.',
    ups: 'UPS power modules (rectifier/inverter/capacitors) — mid-life power-electronics wear.',
    generator: 'Standby diesel/gas generators — mechanical wear driven by runtime and start cycles.',
    crac: 'CRAC/CRAH cooling units — compressors, fans and coils wearing over duty hours.',
    chiller: 'Chillers — compressor and refrigerant-circuit wear over operating hours.',
    transformer: 'Power transformers — long-lived; insulation ages slowly with thermal load.',
};

const EQUIP_TIPS: Record<string, string> = {
    switchgear: 'Number of medium/low-voltage switchgear line-ups to commission, scaled from IT load.',
    transformers: 'Number of power transformers in scope, scaled from IT load and redundancy.',
    generators: 'Number of standby generators, scaled from IT load and redundancy level.',
    ups_modules: 'Number of UPS modules to commission, scaled from IT load and redundancy.',
    cooling_units: 'Number of cooling units (CRAC/CRAH or CDU), scaled from the cooling type and heat load.',
    chillers: 'Number of chillers in the cooling plant, scaled from heat load.',
    pumps: 'Number of chilled-water / condenser-water pumps in scope.',
    pdus: 'Number of Power Distribution Units feeding the racks.',
    sts: 'Number of Static Transfer Switches for dual-corded loads.',
    racks: 'Number of IT racks, scaled from IT load and rack density.',
    fireZones: 'Number of fire-suppression zones to commission (~1 per 200 kW).',
    ats: 'Number of Automatic Transfer Switches between utility and generator sources.',
};
function Loading() { return <div className="text-sm text-slate-500 p-8 text-center">Engine loading…</div>; }

/* ── L2 Site Intelligence ── */
export function SiteIntelDashboard() {
    const { country } = useCfg();
    const m = rzModels().site;
    if (!m) return <Loading />;
    // Real 0-1 factors derived from the selected country's reference profile
    // (DATA.countries: grid uptime, seismic zone, talent, tax, grid carbon, flood…).
    // Score now moves with the country — no hardcoded factor vector.
    const factors = m.deriveFactors
        ? m.deriveFactors(country?.id)
        : { power: 0.6, grid: 0.6, seismic: 0.6, talent: 0.6, tax: 0.6, carbon: 0.6, flood: 0.6, latency: 0.6, water: 0.6 };
    const r = m.score(factors);
    return (
        <div className="space-y-4">
            <Head icon={MapPin} title="Site Intelligence" sub="DC-OS Layer 2 · models.site.score" tone=""
                report={() => ({
                    title: 'Site Intelligence', layer: 'Layer 2 · Site Score', project: '—',
                    kpis: [{ label: 'Site Score', value: `${r.score}/100`, sub: `Grade ${r.grade} · ${r.label}` }, { label: 'Coverage', value: `${Math.round(r.coverage * 100)}%` }, { label: 'Factors', value: String(r.breakdown.length) }],
                    sections: [{ title: 'Factor Breakdown', head: ['Factor', 'Score', 'Weight', 'Contribution'], rows: r.breakdown.map((f: { key: string; value: number; weight: number; contribution: number }) => [f.key, `${Math.round(f.value * 100)}%`, `${Math.round(f.weight * 100)}%`, f.contribution.toFixed(3)]) }],
                    assessment: buildAssessment('site', { score: r.score, keyRisk: [...r.breakdown].sort((a: { value: number }, b: { value: number }) => a.value - b.value)[0]?.key ?? '' }),
                    actions: buildActions('site', { score: r.score, keyRisk: [...r.breakdown].sort((a: { value: number }, b: { value: number }) => a.value - b.value)[0]?.key ?? '' }),
                    summaryBand: [
                        { label: 'Score', value: `${r.score}/100` },
                        { label: 'Grade', value: r.grade },
                        { label: 'Coverage', value: `${Math.round(r.coverage * 100)}%` },
                        { label: 'Factors', value: String(r.breakdown.length) },
                    ],
                    note: `Factors derived from the ${country?.name || 'selected country'} reference profile (DATA.countries) — engine-real, country-varying.`,
                })} />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Metric label="Site Score" value={`${r.score}/100`} sub={`Grade ${r.grade} · ${r.label}`} tip="Overall 0–100 site-suitability score, weighting all location factors from the selected country's reference profile. Higher = better data-centre location." />
                <Metric label="Coverage" value={`${Math.round(r.coverage * 100)}%`} sub="factors supplied" tip="Share of the scoring factors that have real data supplied for this country. Lower coverage means the score rests on fewer inputs." />
                <Metric label="Factors" value={String(r.breakdown.length)} sub="weighted" tip="Number of weighted location factors (power, grid, seismic, talent, tax, carbon, flood, latency, water) combined into the site score." />
            </div>
            <Card>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">Factor Breakdown<Tooltip content="Each location factor's 0–100 score and its weight (w). Bars are sorted by contribution to the overall site score." /></h2>
                <div className="space-y-1.5">
                    {r.breakdown.sort((a: { contribution: number }, b: { contribution: number }) => b.contribution - a.contribution).map((f: { key: string; value: number; weight: number }) => (
                        <div key={f.key} className="flex items-center gap-2 text-xs">
                            <span className="w-24 text-slate-600 dark:text-slate-300 capitalize flex items-center gap-1">{f.key}{SITE_FACTOR_TIPS[f.key] && <Tooltip content={SITE_FACTOR_TIPS[f.key]} />}</span>
                            <div className="flex-1 h-2 rounded bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded bg-cyan-500" style={{ width: `${f.value * 100}%` }} /></div>
                            <span className="w-10 text-right tabular-nums text-slate-500">{Math.round(f.value * 100)}%</span>
                            <span className="w-10 text-right tabular-nums text-slate-400">w{Math.round(f.weight * 100)}</span>
                        </div>
                    ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-400">Factors derived from the {country?.name || 'selected country'} reference profile (single-source DATA.countries).</p>
            </Card>
        </div>
    );
}

/* ── L7 Commissioning ── */
const cxMoney = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`;

interface CxLevel { id: string; label: string; cost: number; pct: number; days: number }
interface CxDisc { name: string; cost: number; pct: number }
interface CxRich {
    grand: number; subtotal: number; contingency: number; perKw: number; pctCapex: number; capexPerKw: number;
    durationDays: number; durationWeeks: number; durationMonths: number;
    levels: CxLevel[]; disciplines: CxDisc[]; equip: Record<string, number>;
    region: { key: string; name: string; mult: number }; tierInfo: { tier: string; avail: string; scenarios: number; istHrs: number };
}
interface CxMC { p5: number; p25: number; p50: number; p75: number; p95: number; mean: number; stdDev: number; cvar95: number; min: number; max: number }
interface CxSens { name: string; low: number; high: number; range: number; lowD: number; highD: number }

const EQUIP_SHOWN: [string, string][] = [
    ['switchgear', 'Switchgear'], ['transformers', 'Transformers'], ['generators', 'Generators'], ['ups_modules', 'UPS Modules'],
    ['cooling_units', 'Cooling Units'], ['chillers', 'Chillers'], ['pumps', 'Pumps'], ['pdus', 'PDUs'],
    ['sts', 'STS'], ['racks', 'Racks'], ['fireZones', 'Fire Zones'], ['ats', 'ATS'],
];

export function CommissioningDashboard() {
    const { inputs, country } = useCfg();
    const m = rzModels().commissioning;
    // RICH Cx PROGRAM from the shared engine (faithful cx-calculator.html port) —
    // equipment-count-driven cost, 30 regional day-rates, per-level L0-L6 staffed
    // durations, gm-normalized base blend, Monte-Carlo band + sensitivity tornado.
    // All values move with itLoad / cooling / redundancy / country. No hardcoded
    // completion vector: readiness reflects the true design-phase state until a
    // live Cx checklist feeds it.
    /* HIGH-2 (visual audit) — rackDensity from the project requirement (60 kW →
     * ai_hpc bucket). Omitting it made equipScale default to 'standard' (6 kW):
     * RACKS showed 417 on a project the whole app counts as 42 racks. */
    const rackKw = useRequirementsStore((s) => s.workload.avgRackDensityKw);
    const store = { itLoadKw: inputs.itLoad, coolingType: inputs.coolingType, powerRedundancy: inputs.powerRedundancy, countryId: country?.id, rackDensity: densityToEngineBucket(rackKw) };
    const key = JSON.stringify(store);
    /* #7 audit — the project tier is sim.tierLevel; rich.tierInfo.tier is the
     * tier IMPLIED by the redundancy config (2N → "Tier IV") and contradicted
     * the Tier 3 project on the Scope card. Label anchors to engine DATA.tiers. */
    const tierLabel: string = rzData()?.tiers?.[inputs.tierLevel]?.label ?? `Tier ${inputs.tierLevel}`;
    const rich = React.useMemo<CxRich | null>(() => (m && m.programRich ? m.programRich(store) : null), [m, key]);
    const mc = React.useMemo<CxMC | null>(() => (m && m.monteCarlo && rich ? m.monteCarlo(store, { n: 4000 }) : null), [m, key, rich]);
    const sens = React.useMemo<CxSens[] | null>(() => (m && m.sensitivity && rich ? m.sensitivity(store, rich.grand) : null), [m, key, rich]);
    if (!m) return <Loading />;

    // graceful fallback to the compact model if a stale engine build lacks programRich
    if (!rich) {
        const pc = m.programCost ? m.programCost({ itLoadKw: inputs.itLoad, cooling: inputs.coolingType, redundancy: (REDUNDANCY_KEY[inputs.powerRedundancy] || 'n1'), countryId: country?.id }) : null;
        return (
            <div className="space-y-4">
                <Head icon={CheckCircle2} title="Commissioning" sub="DC-OS Layer 7 · models.commissioning" tone="" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3"><Metric label="Cx Program Cost" value={pc ? cxMoney(pc.total) : '—'} sub={pc ? `${cxMoney(pc.perKw)}/kW` : ''} tip="Total commissioning program cost (compact estimate), with the cost per kW of IT load." /></div>
                <p className="text-[10px] text-slate-400">Rich Cx engine not present in this build — showing compact estimate.</p>
            </div>
        );
    }

    const discMax = Math.max(1, ...rich.disciplines.map((d) => d.cost));
    const sensMax = Math.max(1, ...(sens || []).map((s) => s.range));
    const band = mc ? Math.max(1, mc.p95 - mc.p5) : 1;
    const p50pos = mc ? Math.max(0, Math.min(100, ((mc.p50 - mc.p5) / band) * 100)) : 50;

    return (
        <div className="space-y-4">
            <Head icon={CheckCircle2} title="Commissioning" sub="DC-OS Layer 7 · models.commissioning.programRich (equipment-scaled Cx program · cx-calculator.html parity)" tone=""
                report={() => ({
                    title: 'Commissioning', layer: 'Layer 7 · Cx Program (rich)', project: country?.name || '—',
                    kpis: [
                        { label: 'Cx Program Cost', value: cxMoney(rich.grand), sub: `${cxMoney(rich.perKw)}/kW · ${rich.pctCapex.toFixed(1)}% of capex` },
                        { label: 'Program Duration', value: `${rich.durationDays} d`, sub: `~${rich.durationMonths} mo` },
                        { label: 'IT Load', value: `${(inputs.itLoad / 1000).toFixed(1)} MW`, sub: `${tierLabel} · ${inputs.powerRedundancy}` },
                        ...(mc ? [{ label: 'Cost Range P5–P95', value: `${cxMoney(mc.p5)}–${cxMoney(mc.p95)}`, sub: `P50 ${cxMoney(mc.p50)} · CVaR95 ${cxMoney(mc.cvar95)}` }] : []),
                    ],
                    sections: [
                        { title: 'Cx Program by Level', head: ['Level', 'Duration (d)', 'Cost'], rows: rich.levels.map((l) => [l.label, String(l.days), cxMoney(l.cost)]) },
                        { title: 'Cost by Discipline', head: ['Discipline', 'Share', 'Cost'], rows: rich.disciplines.map((d) => [d.name, `${d.pct}%`, cxMoney(d.cost)]) },
                        { title: 'Equipment Scaled', head: ['Equipment', 'Qty'], rows: EQUIP_SHOWN.map(([k, l]) => [l, String(rich.equip[k])]) },
                        ...(sens ? [{ title: 'Sensitivity (tornado, ± swing)', head: ['Parameter', 'Low', 'High', 'Range'], rows: sens.map((s) => [s.name, cxMoney(s.low), cxMoney(s.high), cxMoney(s.range)]) }] : []),
                    ],
                    note: `Rich engine-real Cx program (models.commissioning.programRich) for a ${(inputs.itLoad / 1000).toFixed(1)} MW ${inputs.coolingType} ${inputs.powerRedundancy} build in ${rich.region.name} (${rich.region.key}, ×${rich.region.mult} regional cost). Equipment-scaled, 30-region day-rates, ${mc ? 'Monte-Carlo N=4000, ' : ''}budgetary Cx estimate — not a detailed Cx plan.`,
                })} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Metric label="Cx Program Cost" value={cxMoney(rich.grand)} sub={`${cxMoney(rich.perKw)}/kW · ${rich.pctCapex.toFixed(1)}% of capex`} tip="Total equipment-scaled commissioning program cost, shown per kW of IT load and as a percentage of total CAPEX." />
                <Metric label="Program Duration" value={`${rich.durationDays} d`} sub={`~${rich.durationMonths} mo · L0→L6`} tip="Total commissioning duration in working days (≈ months), covering the staffed L0→L6 levels from factory tests through integrated systems tests." />
                <Metric label="Contingency (15%)" value={cxMoney(rich.contingency)} sub={`subtotal ${cxMoney(rich.subtotal)}`} tip="Cost contingency (15% of the subtotal) added for scope uncertainty in the commissioning program." />
                <Metric label="Scope" value={`${(inputs.itLoad / 1000).toFixed(1)} MW`} sub={`${inputs.coolingType} · ${inputs.powerRedundancy} · ${tierLabel}`} tip="The build being commissioned: IT load (MW), cooling type, power redundancy and tier — the drivers of Cx cost and duration." />
            </div>

            {mc && (
                <Card>
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">Cost Uncertainty<Tooltip content="Monte-Carlo spread of the Cx program cost from randomising the key inputs (IT load ±7.5%, pricing ±5%) over 4000 trials — the P5–P95 range around the P50 median." /> <span className="text-[9px] text-slate-400">(Monte-Carlo · IT load ±7.5%, pricing ±5% · N=4000)</span></h2>
                    <div className="relative h-3 rounded-full bg-gradient-to-r from-[#00FF88] via-[#FFAA00] to-[#FF3030] mb-1">
                        <div className="absolute -top-1 w-0.5 h-5 bg-slate-900 dark:bg-white" style={{ left: `${p50pos}%` }} title={`P50 ${cxMoney(mc.p50)}`} />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 tabular-nums"><span>P5 {cxMoney(mc.p5)}</span><span>P50 {cxMoney(mc.p50)}</span><span>P95 {cxMoney(mc.p95)}</span></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                        <Metric label="P50 (median)" value={cxMoney(mc.p50)} tip="Median (50th-percentile) commissioning cost — half the Monte-Carlo trials land below this value." />
                        <Metric label="P95" value={cxMoney(mc.p95)} sub="95th percentile" tip="95th-percentile cost: only 5% of trials exceed it. A conservative budgeting figure." />
                        <Metric label="CVaR 95%" value={cxMoney(mc.cvar95)} sub="expected tail" tip="Conditional Value-at-Risk at 95%: the average cost of the worst 5% of outcomes (expected tail loss)." />
                        <Metric label="Std Dev" value={cxMoney(mc.stdDev)} sub={`±${((mc.stdDev / mc.mean) * 100).toFixed(1)}% CoV`} tip="Standard deviation of the cost distribution, with the coefficient of variation (spread relative to the mean)." />
                    </div>
                </Card>
            )}

            <div className="grid md:grid-cols-2 gap-4">
                <Card>
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">Cx Program by Level (L0–L6)<Tooltip content="Commissioning cost and duration split across the standard levels L0–L6 (factory acceptance → integrated systems tests). Each bar shows the level's share of the program." /></h2>
                    <div className="space-y-1.5">
                        {rich.levels.map((l) => (
                            <div key={l.id} className="flex items-center gap-2 text-xs">
                                <span className="w-36 text-slate-600 dark:text-slate-300 truncate">{l.label}</span>
                                <div className="flex-1 h-2 rounded bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded bg-rz-data" style={{ width: `${l.pct}%` }} /></div>
                                <span className="w-12 text-right tabular-nums text-slate-500">{l.days}d</span>
                                <span className="w-14 text-right tabular-nums text-slate-400">{cxMoney(l.cost)}</span>
                            </div>
                        ))}
                    </div>
                </Card>
                <Card>
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">Cost by Discipline<Tooltip content="Commissioning cost broken down by engineering discipline (electrical, mechanical, controls, etc.). The longest bar is the biggest cost driver." /></h2>
                    <div className="space-y-1.5">
                        {rich.disciplines.map((d) => (
                            <div key={d.name} className="flex items-center gap-2 text-xs">
                                <span className="w-24 text-slate-600 dark:text-slate-300 capitalize">{d.name}</span>
                                <div className="flex-1 h-2 rounded bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded bg-cyan-500" style={{ width: `${(d.cost / discMax) * 100}%` }} /></div>
                                <span className="w-16 text-right tabular-nums text-slate-400">{cxMoney(d.cost)}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            <Card>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">Equipment Scaled<Tooltip content="Counts of major equipment the commissioning program must verify, auto-scaled from IT load, cooling type and redundancy — the physical scope behind the Cx cost." /> <span className="text-[9px] text-slate-400">(from IT load {(inputs.itLoad / 1000).toFixed(1)} MW · verification scope)</span></h2>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {EQUIP_SHOWN.map(([k, l]) => (
                        <div key={k} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-center">
                            <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{rich.equip[k]}</div>
                            <div className="text-[9px] uppercase tracking-wide text-slate-500 flex items-center justify-center gap-1">{l}{EQUIP_TIPS[k] && <Tooltip content={EQUIP_TIPS[k]} />}</div>
                        </div>
                    ))}
                </div>
            </Card>

            {sens && (
                <Card>
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">Sensitivity Tornado<Tooltip content="How much the total Cx cost swings when each parameter moves from its low to high case (all else fixed). The longest bar is the most influential cost driver." /> <span className="text-[9px] text-slate-400">(cost swing per parameter · low → high)</span></h2>
                    <div className="space-y-1.5">
                        {sens.map((s) => (
                            <div key={s.name} className="flex items-center gap-2 text-xs">
                                <span className="w-28 text-slate-600 dark:text-slate-300">{s.name}</span>
                                <div className="flex-1 h-2.5 rounded bg-slate-100 dark:bg-slate-800"><div className="h-2.5 rounded bg-amber-500" style={{ width: `${(s.range / sensMax) * 100}%` }} /></div>
                                <span className="w-16 text-right tabular-nums text-slate-500">{cxMoney(s.low)}</span>
                                <span className="w-4 text-center text-slate-400">→</span>
                                <span className="w-16 text-right tabular-nums text-slate-400">{cxMoney(s.high)}</span>
                            </div>
                        ))}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400">Each bar = grand-total swing when the parameter moves low→high (all else fixed at the current config). Longest bar = biggest cost driver. Operational Readiness Index activates when a live Cx checklist feeds per-level completion.</p>
                </Card>
            )}
        </div>
    );
}

/* ── L9 Asset Intelligence ── */
export function AssetIntelDashboard() {
    const { inputs } = useCfg();
    const m = rzModels().asset;
    if (!m) return <Loading />;
    const comps = ['upsLiIon', 'generator', 'crac', 'pdu', 'bms', 'fire'];
    const rows = comps.map((k) => m.replacementSchedule(k, inputs.itLoad, 15)).filter(Boolean);
    const health = m.healthIndex({ assetClass: 'ups', ageYears: 3, condition: 0.9, duty: 0.6 });
    return (
        <div className="space-y-4">
            <Head icon={Activity} title="Asset Intelligence" sub="DC-OS Layer 9 · models.asset" tone=""
                report={() => ({
                    title: 'Asset Intelligence', layer: 'Layer 9 · Asset Health & Lifecycle', project: '—',
                    kpis: [{ label: 'Sample Health (UPS 3yr)', value: `${health.health}/100`, sub: health.status }, { label: 'Remaining Life', value: `${health.remainingYears} yr`, sub: `of ${health.designLifeYears}` }, { label: 'Tracked Assets', value: String(rows.length) }],
                    sections: [{ title: '15-Year Replacement Schedule', head: ['Asset', 'Interval', 'Events', 'Nominal $M'], rows: rows.map((r: { label: string; intervalYears: number; events: number; totalNominalUsd: number }) => [r.label, `${r.intervalYears}yr`, r.events, (r.totalNominalUsd / 1e6).toFixed(2)]) }],
                    assessment: buildAssessment('assets', {
                        avgHealthPct: health.health,
                        atRiskCount: m.failureProbability ? ['battery', 'ups', 'generator', 'crac', 'chiller', 'transformer'].filter((cls) => {
                            const life = m.designLife(cls) || 15;
                            return m.failureProbability(cls, Math.round(life * 0.6)).failureProb >= 0.25;
                        }).length : 0,
                    }),
                    actions: buildActions('assets', {
                        avgHealthPct: health.health,
                        atRiskCount: m.failureProbability ? ['battery', 'ups', 'generator', 'crac', 'chiller', 'transformer'].filter((cls) => {
                            const life = m.designLife(cls) || 15;
                            return m.failureProbability(cls, Math.round(life * 0.6)).failureProb >= 0.25;
                        }).length : 0,
                    }),
                    summaryBand: [
                        { label: 'Health', value: `${health.health}/100` },
                        { label: 'Remaining', value: `${health.remainingYears} yr` },
                        { label: 'Assets', value: String(rows.length) },
                        { label: 'Horizon', value: '15 yr' },
                    ],
                    note: 'Screening health + lifecycle model — not a condition survey.',
                })} />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Metric label="Sample Health (UPS 3yr)" value={`${health.health}/100`} sub={health.status} tip="Example asset-health index (0–100) for a 3-year-old UPS at typical condition and duty. Falls as assets age toward end of life." />
                <Metric label="Remaining Life" value={`${health.remainingYears} yr`} sub={`of ${health.designLifeYears}`} tip="Estimated remaining useful life for that sample asset, out of its design life, based on age, condition and duty." />
                <Metric label="Tracked Assets" value={String(rows.length)} sub="15-yr horizon" tip="Number of asset classes modelled in the 15-year replacement schedule below." />
            </div>
            {m.failureProbability && (
                <Card>
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">Wear-Out Failure Risk<Tooltip content="Cumulative probability that each asset class has failed by 60% of its design life, from a Weibull wear-out model (β>1). Drives condition-based replacement timing." /> <span className="text-[9px] text-slate-400">(Weibull, at 60% of design life)</span></h2>
                    <div className="space-y-1.5">
                        {['battery', 'ups', 'generator', 'crac', 'chiller', 'transformer'].map((cls) => {
                            const life = m.designLife(cls) || 15;
                            const age = Math.round(life * 0.6);
                            const fp = m.failureProbability(cls, age);
                            const pctv = Math.round(fp.failureProb * 100);
                            const col = pctv >= 40 ? 'bg-rose-500' : pctv >= 20 ? 'bg-amber-500' : 'bg-rz-data';
                            return (
                                <div key={cls} className="flex items-center gap-2 text-xs">
                                    <span className="w-24 capitalize text-slate-600 dark:text-slate-300 flex items-center gap-1">{cls}{ASSET_CLASS_TIPS[cls] && <Tooltip content={ASSET_CLASS_TIPS[cls]} />}</span>
                                    <span className="w-14 text-[10px] text-slate-400 tabular-nums">age {age}yr</span>
                                    <div className="flex-1 h-2 rounded bg-slate-100 dark:bg-slate-800"><div className={`h-2 rounded ${col}`} style={{ width: `${Math.min(100, pctv)}%` }} /></div>
                                    <span className="w-16 text-right tabular-nums text-slate-500">{pctv}% CDF</span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400">Cumulative failure probability F(t)=1−e^(−(t/η)^β) per asset class (β&gt;1 wear-out). Drives condition-based replacement timing. Reliability-engineering / IEEE-493 basis.</p>
                </Card>
            )}
            <Card>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">15-Year Replacement Schedule<Tooltip content="Planned asset refresh over a 15-year horizon: how often each asset is replaced, how many replacement events fall in the window, and the nominal (inflated) spend." /></h2>
                <table className="w-full text-xs">
                    <thead><tr className="text-[10px] uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800"><th className="text-left py-1">Asset</th><th className="text-right"><span className="inline-flex items-center gap-1">Interval<Tooltip content="Replacement interval — the useful life in years after which the asset is refreshed." /></span></th><th className="text-right"><span className="inline-flex items-center gap-1">Events<Tooltip content="Number of replacement events for this asset within the 15-year horizon." /></span></th><th className="text-right"><span className="inline-flex items-center gap-1">Nominal $<Tooltip content="Total nominal (inflation-adjusted) replacement spend for this asset over the 15-year horizon, in USD millions." /></span></th></tr></thead>
                    <tbody>
                        {rows.map((r: { component: string; label: string; intervalYears: number; events: number; totalNominalUsd: number }) => (
                            <tr key={r.component} className="border-b border-slate-100 dark:border-slate-800/50">
                                <td className="py-1.5 text-slate-700 dark:text-slate-200">{r.label}</td>
                                <td className="text-right tabular-nums text-slate-500">{r.intervalYears}yr</td>
                                <td className="text-right tabular-nums text-slate-500">{r.events}</td>
                                <td className="text-right tabular-nums text-rz-data">${(r.totalNominalUsd / 1e6).toFixed(2)}M</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}
