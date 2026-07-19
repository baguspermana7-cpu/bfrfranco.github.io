'use client';

/* ─── DC-OS · shared pillar engines surfaced in DCMOC ─────────────────────────
 * Tier classification · Fire suppression sizing · CDU/liquid-cooling sizing ·
 * Spares (EOQ). Each consumes its rz-engine model with the CURRENT project
 * config — engine-real, input-driven (no hardcoded outputs). Consolidated from
 * the standalone tools into the shared engine (ENGINE_UNIFICATION.md).
 * ──────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useRequirementsStore } from '@/store/requirements';
import { rzModels } from '@/lib/rz-engine';
import { densityToEngineBucket } from '@/lib/requirementsMappings';
import { generatePillarPDF, type PillarReport } from '@/modules/reporting/pdf/PillarPdf';
import {
    computeSpares, defaultLeadWeeks, SPARES_CLASSES, UNIT_COST_SCREENING,
    UNDERSTOCK_COST_SCREENING, CARRY_RATE_PCT, PART_LIFE_YRS,
    type SparesClassKey, type SparesClassOverride, type SparesOverrides, type Provenance,
} from '@/state/adapters/spares-adapter';
import { ShieldCheck, Flame, Waves, Package, FileDown } from 'lucide-react';

const REDUNDANCY_KEY: Record<string, string> = { 'N+1': 'n1', '2N': '2n', '2N+1': '2n1' };
const useCfg = () => {
    const { inputs, selectedCountry } = useSimulationStore();
    return { inputs, country: selectedCountry, redKey: REDUNDANCY_KEY[inputs.powerRedundancy] || 'n1' };
};
function Head({ icon: Icon, title, sub, tone }: { icon: React.ElementType; title: string; sub: string; tone: string }) {
    return (
        <div className="flex items-center gap-3 mb-5">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tone} flex items-center justify-center shadow-lg`}><Icon className="w-6 h-6 text-white" /></div>
            <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1><p className="text-sm text-slate-500 dark:text-slate-400">{sub}</p></div>
        </div>
    );
}
function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 transition-all hover:-translate-y-0.5 hover:border-cyan-400/50 hover:bg-cyan-500/[0.05] hover:shadow-md hover:shadow-cyan-900/10"><div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div><div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</div>{sub && <div className="text-[10px] text-slate-500">{sub}</div>}</div>;
}
function Card({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">{children}</div>; }
function Loading() { return <div className="text-sm text-slate-500 p-8 text-center">Engine loading…</div>; }
const money = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`;

/* ── Tier classification (models.tier) ── */
const COOL_SCORE: Record<string, number> = { air: 60, inrow: 72, rdhx: 82, liquid: 92, immersion: 96 };
const RED_SCORE: Record<string, number> = { n: 50, n1: 75, '2n': 92, '2n1': 98 };
export function TierDashboard() {
    const { inputs, redKey } = useCfg();
    const m = rzModels().tier;
    if (!m) return <Loading />;
    // sub-scores derived from the live project config (0-100)
    const scores = {
        power: RED_SCORE[redKey] ?? 75,
        cooling: COOL_SCORE[inputs.coolingType] ?? 60,
        network: 55 + (inputs.tierLevel - 2) * 15,
        physical: 60 + (inputs.tierLevel - 2) * 12,
        monitoring: 60 + (inputs.tierLevel - 2) * 12,
        redundancy: redKey,
    };
    const r = m.classify(scores);
    return (
        <div className="space-y-4">
            <Head icon={ShieldCheck} title="Tier Classification" sub="DC-OS · models.tier (Uptime-style)" tone="from-indigo-500 to-blue-600" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Metric label="Classified Tier" value={`Tier ${r.tier}`} sub={r.label.split('—')[1]?.trim()} />
                <Metric label="Infra Score" value={`${r.score}/100`} sub={r.capped ? 'capped by redundancy' : 'weighted'} />
                <Metric label="Target Tier" value={`Tier ${inputs.tierLevel}`} sub={r.tier >= inputs.tierLevel ? 'met' : 'gap'} />
            </div>
            <Card>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Sub-scores (from project config)</h2>
                <div className="space-y-1.5">
                    {(['power', 'cooling', 'network', 'physical', 'monitoring'] as const).map((k) => (
                        <div key={k} className="flex items-center gap-2 text-xs">
                            <span className="w-24 text-slate-600 dark:text-slate-300 capitalize">{k}</span>
                            <div className="flex-1 h-2 rounded bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded bg-indigo-500" style={{ width: `${scores[k]}%` }} /></div>
                            <span className="w-10 text-right tabular-nums text-slate-500">{scores[k]}</span>
                        </div>
                    ))}
                </div>
                {r.capped && <p className="mt-2 text-[10px] text-amber-500">Redundancy {inputs.powerRedundancy} caps the achievable tier — raise redundancy to unlock a higher tier.</p>}
            </Card>
        </div>
    );
}

/* ── Fire suppression sizing (models.fire) ── */
export function FireDashboard() {
    const { inputs } = useCfg();
    const m = rzModels().fire;
    const capex = useCapexStore((s) => s.results);
    if (!m) return <Loading />;
    const [agent, setAgent] = React.useState('novec1230');
    // room volume from white-space floor area × 3.5 m clear height (fallback from IT load)
    const floorM2 = capex?.metrics?.floorSpace || Math.max(50, inputs.itLoad / 4);
    const volumeM3 = Math.round(floorM2 * 3.5);
    // rich assess() when present (mass + NOAEL safety margin + CO2e + cylinders), else basic
    const r = m.assess ? m.assess({ volumeM3, agent, tempC: 20 }) : m.agentQuantity({ volumeM3, agent });
    const halo = r.type === 'halocarbon';
    return (
        <div className="space-y-4">
            <Head icon={Flame} title="Fire Suppression" sub="DC-OS · models.fire (NFPA 2001 / 72 / 855)" tone="from-rose-500 to-orange-600" />
            <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Agent</span>
                <select value={agent} onChange={(e) => setAgent(e.target.value)} className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-slate-700 dark:text-slate-200">
                    <option value="novec1230">Novec 1230</option>
                    <option value="fm200">FM-200</option>
                    <option value="ig541">Inert Gas IG-541</option>
                </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric label="Protected Volume" value={`${volumeM3.toLocaleString()} m³`} sub={`${Math.round(floorM2).toLocaleString()} m² × 3.5 m`} />
                {halo
                    ? <Metric label="Agent Mass" value={`${(r.massKg as number).toLocaleString()} kg`} sub={`${r.cylinders ?? '—'} cylinders`} />
                    : <Metric label="Agent Volume" value={`${(r.agentVolumeM3 as number)?.toLocaleString() ?? '—'} m³`} sub={r.agent} />}
                <Metric label="Design Conc." value={`${r.designConcPct ?? r.designConcentration}%`} sub={r.type} />
                {r.safetyMarginPct != null
                    ? <Metric label="NOAEL Margin" value={`${r.safetyMarginPct}%`} sub={r.occupiableOk ? '✓ occupiable' : '⚠ review'} />
                    : <Metric label="CO₂e" value={r.co2eTonnes != null ? `${r.co2eTonnes} t` : '—'} sub="agent GWP" />}
            </div>
            {r.co2eTonnes != null && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Metric label="Agent CO₂e" value={`${r.co2eTonnes} t`} sub="charge × GWP100" />
                    {r.noaelPct != null && <Metric label="NOAEL / LOAEL" value={`${r.noaelPct}% / ${r.loaelPct}%`} sub="occupant safety" />}
                    {r.spotDetectors != null && <Metric label="Spot Detectors" value={String(r.spotDetectors)} sub="NFPA 72 (≤84 m²)" />}
                </div>
            )}
            <Card><p className="text-[11px] text-slate-500">NFPA-2001 clean-agent quantity + NOAEL occupant-safety margin + agent CO₂e (GWP100) + NFPA-72 detector count. Budgetary sizing, not a fire-protection design.</p></Card>
        </div>
    );
}

/* ── CDU / liquid-cooling sizing (models.cdu) ── */
export function CduDashboard() {
    const { inputs } = useCfg();
    const m = rzModels().cdu;
    if (!m) return <Loading />;
    const [dT, setDT] = React.useState(10);
    // rich hydraulics() when present (dP, Reynolds, pump kW, dew-point margin), else basic size()
    const rich = !!m.hydraulics;
    const r = rich ? m.hydraulics({ itKw: inputs.itLoad, deltaTK: dT, supplyC: 20 }) : m.size({ itKw: inputs.itLoad, deltaT: dT });
    const liquid = inputs.coolingType === 'liquid' || inputs.coolingType === 'rdhx';
    return (
        <div className="space-y-4">
            <Head icon={Waves} title="CDU / Liquid Cooling" sub="DC-OS · models.cdu (thermohydraulic)" tone="from-cyan-500 to-blue-600" />
            {!liquid && <p className="text-[11px] text-amber-500">Current cooling is {inputs.coolingType} — CDU sizing shown for a liquid-cooled scenario.</p>}
            <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">ΔT (K)</span>
                <input type="range" min={5} max={20} value={dT} onChange={(e) => setDT(Number(e.target.value))} className="accent-cyan-500" />
                <span className="tabular-nums text-slate-600 dark:text-slate-300">{dT} K</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric label="Coolant Flow" value={`${(r.flowLpm as number).toLocaleString()} L/min`} sub={rich ? `${r.velocityMs} m/s` : `${r.flowM3h} m³/h`} />
                <Metric label="Heat Load" value={`${(inputs.itLoad / 1000).toFixed(1)} MW`} sub="IT load" />
                {rich
                    ? <Metric label="Pressure Drop" value={`${r.dpBar} bar`} sub={`Re ${(r.reynolds as number).toLocaleString()}`} />
                    : <Metric label="CDU Units" value={`${r.cduUnits}`} sub={`${r.cduUnitsRedundant} with N+1`} />}
                {rich
                    ? <Metric label="Pump Power" value={`${r.pumpKw} kW`} sub={`${r.pumpsNplus1} pumps N+1`} />
                    : <Metric label="ΔT" value={`${r.deltaT} K`} sub="supply→return" />}
            </div>
            {rich && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Metric label="Dew-Point Margin" value={`${r.dewMarginK} K`} sub={r.dewSafeOk ? '✓ no condensation' : '⚠ condensation risk'} />
                    <Metric label="Dew Point" value={`${r.dewPointC} °C`} sub="at supply temp" />
                    <Metric label="HX Approach" value={`${r.hxApproachK} K`} sub="facility → technical" />
                </div>
            )}
            <Card><p className="text-[11px] text-slate-500">{rich ? 'Darcy-Weisbach ΔP (Haaland friction) + Reynolds + pump power + Magnus dew-point margin over a water/glycol loop.' : 'Coolant flow = Q/(ρ·cp·ΔT).'} Sizing estimate, not a hydraulic design.</p></Card>
        </div>
    );
}

/* ── Spares (models.spares — newsvendor per equipment class) ──────────────────
 * Fleet from commissioning.equipScale · MTBF/MTTR from DATA.reliability
 * (engine, IEEE-493) · lead times from MaintenanceStrategyEngine LEAD_TIMES ·
 * unit costs = screening assumptions — all user-overridable per class. */
const SP_LEAD_OPTIONS = [2, 4, 8, 12, 16, 24];
const SP_FILL_OPTIONS = [95, 97, 99];
const SP_COST_PRESETS = [
    { key: '-25', label: 'Screening −25%', mult: 0.75 },
    { key: '+25', label: 'Screening +25%', mult: 1.25 },
    { key: '+50', label: 'Screening +50%', mult: 1.5 },
] as const;
const spSelectCls = (user: boolean) =>
    `rounded-md border px-1.5 py-1 text-[11px] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 ${user ? 'border-violet-400 dark:border-violet-500' : 'border-slate-200 dark:border-slate-700'}`;

function SpProvChip({ prov }: { prov: Provenance }) {
    if (prov === 'engine') return <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Engine data (IEEE-493 typical)" />;
    if (prov === 'user') return <span className="rounded px-1 py-px text-[9px] font-semibold bg-violet-500/15 text-violet-600 dark:text-violet-300" title="User override">user</span>;
    return <span className="rounded px-1 py-px text-[9px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-300" title="Screening assumption — overridable">scr</span>;
}

export function SparesDashboard() {
    const { inputs, country } = useCfg();
    const rackKw = useRequirementsStore((s) => s.workload.avgRackDensityKw);
    const [ov, setOv] = React.useState<SparesOverrides>({});
    const [busy, setBusy] = React.useState(false);
    const bucket = densityToEngineBucket(rackKw);
    const res = React.useMemo(
        () => computeSpares({ itLoadKw: inputs.itLoad, densityBucket: bucket, countryId: country?.id, overrides: ov }),
        [inputs.itLoad, bucket, country?.id, ov],
    );
    const defLead = defaultLeadWeeks(country?.id);
    if (!rzModels().spares || !res.engineReady || !res.totals) return <Loading />;
    const { rows, totals } = res;

    const patchOv = (k: SparesClassKey, patch: SparesClassOverride) =>
        setOv((prev) => ({ ...prev, [k]: { ...prev[k], ...patch } }));
    const clearOv = (k: SparesClassKey, field: keyof SparesClassOverride) =>
        setOv((prev) => {
            const cur = { ...(prev[k] ?? {}) };
            delete cur[field];
            return { ...prev, [k]: cur };
        });

    const belowRows = rows.filter((r) => r.fillAchieved < r.fillTargetPct / 100);
    const report = (): PillarReport => ({
        title: 'Spares Optimization',
        layer: 'Layer 9 · models.spares (newsvendor)',
        project: country?.name || '—',
        kpis: [
            { label: 'Recommended Stock Value', value: money(totals.inventoryValue), sub: 'Σ Q* × unit cost' },
            { label: 'Annual Holding + Shortage', value: money(totals.annualCost), sub: 'all classes' },
            { label: 'Weighted Fill Rate', value: `${totals.weightedFillPct}%`, sub: 'demand-weighted' },
            { label: 'Classes Below Target', value: String(totals.belowTarget), sub: `of ${rows.length} classes` },
        ],
        config: [
            ['IT Load', `${inputs.itLoad.toLocaleString()} kW`],
            ['Country', country?.name ?? '—'],
            ['Density Bucket', bucket],
            ['Lead-Time Basis', res.leadBasis],
            ['Carry Rate', `${CARRY_RATE_PCT}%/yr of unit value`],
            ['Part Life', `${PART_LIFE_YRS} yr`],
        ],
        sections: [{
            title: 'Per-class newsvendor recommendation',
            head: ['Class', 'Fleet', 'MTBF h', 'Demand/yr', 'Unit cost', 'Lead wk', 'Q*', 'ROP', 'SS', 'Fill %', 'Annual cost'],
            rows: rows.map((r) => [
                `${r.label} (${r.criticality})`, r.fleet, r.mtbf.toLocaleString(), r.demandYr, money(r.unitCost),
                r.leadWeeks, r.qStar, r.rop, r.safetyStock, `${(r.fillAchieved * 100).toFixed(1)}%`, money(r.annualCost),
            ]),
        }],
        callouts: belowRows.length
            ? belowRows.map((r) => ({ title: `${r.label} below fill target`, body: `Achieved fill ${(r.fillAchieved * 100).toFixed(1)}% vs ${r.fillTargetPct}% target — consider raising Q*/safety stock or shortening the ${r.leadWeeks}-week lead time.`, tone: 'warn' as const }))
            : [{ title: 'All fill targets met', body: 'Every equipment class meets its service-level target at the recommended stock position.', tone: 'good' as const }],
        note: 'MTBF/MTTR are IEEE-493 typical figures from the shared engine (DATA.reliability). Unit costs and lead times are screening-grade assumptions, user-overridable per class. Newsvendor critical-fractile output is a planning heuristic — not an inventory policy or a vendor-quoted spares program.',
    });
    const onExport = async () => { setBusy(true); try { await generatePillarPDF(report()); } finally { setBusy(false); } };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg"><Package className="w-6 h-6 text-white" /></div>
                    <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Spares Optimization</h1><p className="text-sm text-slate-500 dark:text-slate-400">DC-OS · models.spares (newsvendor, per equipment class)</p></div>
                </div>
                <button onClick={onExport} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-cyan-700 text-white text-xs font-medium transition-colors disabled:opacity-60">
                    <FileDown className="w-3.5 h-3.5" />{busy ? 'Generating…' : 'Generate Report'}
                </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric label="Recommended Stock Value" value={money(totals.inventoryValue)} sub="Σ Q* × unit cost" />
                <Metric label="Annual Cost" value={money(totals.annualCost)} sub="holding + shortage risk" />
                <Metric label="Weighted Fill Rate" value={`${totals.weightedFillPct}%`} sub="demand-weighted" />
                <Metric label="Below Fill Target" value={String(totals.belowTarget)} sub={`of ${rows.length} classes`} />
            </div>
            <Card>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Per-class newsvendor recommendation</h2>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-[11px]">
                        <thead>
                            <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800">
                                <th className="py-1.5 pr-3 font-medium">Class</th>
                                <th className="py-1.5 pr-3 font-medium">Fleet</th>
                                <th className="py-1.5 pr-3 font-medium">MTBF h</th>
                                <th className="py-1.5 pr-3 font-medium">Demand/yr</th>
                                <th className="py-1.5 pr-3 font-medium">Q*</th>
                                <th className="py-1.5 pr-3 font-medium">ROP</th>
                                <th className="py-1.5 pr-3 font-medium">Safety</th>
                                <th className="py-1.5 pr-3 font-medium">Fill</th>
                                <th className="py-1.5 pr-3 font-medium">Annual cost</th>
                                <th className="py-1.5 pr-3 font-medium text-violet-600 dark:text-violet-400">Unit cost</th>
                                <th className="py-1.5 pr-3 font-medium text-violet-600 dark:text-violet-400">Lead wk</th>
                                <th className="py-1.5 font-medium text-violet-600 dark:text-violet-400">Fill target</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => {
                                const k = r.classKey;
                                const defCost = UNIT_COST_SCREENING[k];
                                const ovCost = ov[k]?.unitCost;
                                const costPreset = SP_COST_PRESETS.find((p) => ovCost === Math.round(defCost * p.mult));
                                const costSel = ovCost == null ? 'def' : costPreset ? costPreset.key : 'custom';
                                const ovLead = ov[k]?.leadWeeks;
                                const defFill = SPARES_CLASSES[k].fillTargetPct;
                                const below = r.fillAchieved < r.fillTargetPct / 100;
                                return (
                                    <tr key={k} className="border-b border-slate-100 dark:border-slate-800/60 align-top">
                                        <td className="py-2 pr-3">
                                            <div className="font-medium text-slate-800 dark:text-slate-100">{r.label}</div>
                                            <span className={`rounded px-1 py-px text-[9px] font-semibold ${r.criticality === 'Critical' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300' : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'}`}>{r.criticality}</span>
                                        </td>
                                        <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{r.fleet}×</td>
                                        <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300"><span className="inline-flex items-center gap-1.5">{r.mtbf.toLocaleString()}<SpProvChip prov={r.prov.mtbf} /></span></td>
                                        <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{r.demandYr}</td>
                                        <td className="py-2 pr-3 tabular-nums font-semibold text-slate-800 dark:text-slate-100">{r.qStar}</td>
                                        <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{r.rop}</td>
                                        <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{r.safetyStock}</td>
                                        <td className="py-2 pr-3 tabular-nums">
                                            <span className={below ? 'text-rose-500 font-semibold' : 'text-slate-600 dark:text-slate-300'}>{(r.fillAchieved * 100).toFixed(1)}%</span>
                                            {r.usedPoissonMode && <span className="ml-1 rounded px-1 py-px text-[9px] font-semibold bg-violet-500/15 text-violet-600 dark:text-violet-300" title="Low-demand mover — Poisson CDF">Poisson</span>}
                                        </td>
                                        <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{money(r.annualCost)}</td>
                                        <td className="py-2 pr-3">
                                            <div className="flex items-center gap-1.5">
                                                <select value={costSel} className={spSelectCls(r.prov.unitCost === 'user')}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        if (v === 'def') clearOv(k, 'unitCost');
                                                        else if (v === 'custom') patchOv(k, { unitCost: r.unitCost });
                                                        else patchOv(k, { unitCost: Math.round(defCost * SP_COST_PRESETS.find((p) => p.key === v)!.mult) });
                                                    }}>
                                                    <option value="def">{money(defCost)} (screening)</option>
                                                    {SP_COST_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label} = {money(Math.round(defCost * p.mult))}</option>)}
                                                    <option value="custom">Custom…</option>
                                                </select>
                                                <SpProvChip prov={r.prov.unitCost} />
                                            </div>
                                            {costSel === 'custom' && (
                                                <input type="number" min={1} value={ovCost ?? r.unitCost}
                                                    onChange={(e) => patchOv(k, { unitCost: Math.max(1, Number(e.target.value) || 1) })}
                                                    className="mt-1 w-24 rounded-md border border-violet-400 dark:border-violet-500 bg-white dark:bg-slate-800 px-1.5 py-1 text-[11px] tabular-nums text-slate-700 dark:text-slate-200" />
                                            )}
                                        </td>
                                        <td className="py-2 pr-3">
                                            <div className="flex items-center gap-1.5">
                                                <select value={ovLead == null ? 'def' : String(ovLead)} className={spSelectCls(r.prov.leadWeeks === 'user')}
                                                    onChange={(e) => { const v = e.target.value; if (v === 'def') clearOv(k, 'leadWeeks'); else patchOv(k, { leadWeeks: Number(v) }); }}>
                                                    <option value="def">{defLead.weeks} wk ({country?.id && defLead.weeks !== 16 ? country.id : 'engine'})</option>
                                                    {SP_LEAD_OPTIONS.map((w) => <option key={w} value={w}>{w} wk</option>)}
                                                </select>
                                                <SpProvChip prov={r.prov.leadWeeks} />
                                            </div>
                                        </td>
                                        <td className="py-2">
                                            <select value={String(r.fillTargetPct)} className={spSelectCls(ov[k]?.fillRatePct != null)}
                                                onChange={(e) => { const v = Number(e.target.value); if (v === defFill) clearOv(k, 'fillRatePct'); else patchOv(k, { fillRatePct: v }); }}>
                                                {SP_FILL_OPTIONS.map((f) => <option key={f} value={f}>{f}%{f === defFill ? ' (target)' : ''}</option>)}
                                            </select>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="mt-2 text-[10px] text-slate-500"><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />engine data (IEEE-493) · <span className="rounded px-1 py-px text-[9px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-300">scr</span> screening assumption · <span className="rounded px-1 py-px text-[9px] font-semibold bg-violet-500/15 text-violet-600 dark:text-violet-300">user</span> your override. Fleet from commissioning.equipScale ({bucket} density, {inputs.itLoad.toLocaleString()} kW IT).</p>
            </Card>
            <Card>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Critical ratio — CR = Cu / (Cu + Co)</h2>
                <p className="text-[11px] text-slate-500">
                    Cu = understock (stockout) cost — {money(UNDERSTOCK_COST_SCREENING.Critical)}/event Critical, {money(UNDERSTOCK_COST_SCREENING.Major)}/event Major (screening). Co = overstock cost = {CARRY_RATE_PCT}%/yr carry × unit cost × {PART_LIFE_YRS} yr part life.
                    Q* solves Φ⁻¹(CR) over lead-time demand (Poisson CDF for low-demand movers). Lead-time basis: {res.leadBasis}. Planning heuristic, not an inventory policy.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {rows.map((r) => <span key={r.classKey} className="rounded-md border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-600 dark:text-slate-300">{r.label} · CR {(r.cr * 100).toFixed(1)}%</span>)}
                </div>
            </Card>
            <div className="flex flex-wrap gap-2 text-xs">
                <button onClick={() => useSimulationStore.getState().actions.setActiveTab('maint')} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:border-cyan-400/60 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Maintenance › Spares tab →</button>
                <button onClick={() => useSimulationStore.getState().actions.setActiveTab('asset-health')} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:border-cyan-400/60 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Asset fleet →</button>
            </div>
        </div>
    );
}
