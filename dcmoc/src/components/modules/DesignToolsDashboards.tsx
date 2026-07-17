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
import { rzModels } from '@/lib/rz-engine';
import { ShieldCheck, Flame, Waves, Package } from 'lucide-react';

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
    return <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3"><div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div><div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</div>{sub && <div className="text-[10px] text-slate-500">{sub}</div>}</div>;
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
        network: 70,
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

/* ── Spares (models.spares — EOQ) ── */
export function SparesDashboard() {
    const { inputs } = useCfg();
    const m = rzModels().spares;
    if (!m) return <Loading />;
    // representative critical-spare annual failure demand scales with fleet size (IT load)
    const mw = inputs.itLoad / 1000;
    const muAnnual = Math.max(0.5, +(mw * 1.2).toFixed(1));
    const unitCost = 3200, understockCostPerEvent = 85000, carryRatePct = 25, partLifeYrs = 8;
    // rich newsvendor() (service-level Q* via Φ⁻¹/Poisson) when present, else EOQ fallback
    const rich = !!m.newsvendor;
    const nv = rich ? m.newsvendor({ muAnnual, unitCost, understockCostPerEvent, carryRatePct, partLifeYrs }) : null;
    const e = !rich ? m.eoq({ annualDemand: Math.round(muAnnual), orderCost: 450, holdingCostPerUnit: unitCost * carryRatePct / 100 }) : null;
    return (
        <div className="space-y-4">
            <Head icon={Package} title="Spares Optimization" sub={`DC-OS · models.spares (${rich ? 'newsvendor / service-level' : 'EOQ'})`} tone="from-emerald-500 to-teal-600" />
            {rich ? (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Metric label="Optimal Stock Q*" value={`${nv.qStar} units`} sub={`critical ratio ${(nv.cr * 100).toFixed(0)}%`} />
                        <Metric label="Reorder Point" value={`${nv.rop} units`} sub={`safety ${nv.safetyStock}`} />
                        <Metric label="Fill Rate" value={`${(nv.fillAchieved * 100).toFixed(1)}%`} sub={nv.usedPoissonMode ? 'Poisson (low-demand)' : 'normal approx'} />
                        <Metric label="Annual Cost" value={money(nv.annualCost)} sub="hold + shortage risk" />
                    </div>
                    <Card><p className="text-[11px] text-slate-500">Newsvendor: critical ratio CR = Cu/(Cu+Co), Q* via Φ⁻¹(CR) (or Poisson CDF for low demand) over lead time. Failure demand ≈ {muAnnual}/yr scaling with the {mw.toFixed(1)} MW fleet; unit ≈ {money(unitCost)}, stockout ≈ {money(understockCostPerEvent)}/event. Planning heuristic, not an inventory policy.</p></Card>
                </>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Metric label="EOQ" value={`${e!.eoq} units`} sub={`${e!.orders} orders/yr`} />
                        <Metric label="Annual Holding" value={money(e!.annualHolding)} />
                        <Metric label="Annual Ordering" value={money(e!.annualOrdering)} />
                        <Metric label="Fleet" value={`${mw.toFixed(1)} MW`} />
                    </div>
                    <Card><p className="text-[11px] text-slate-500">EOQ fallback. Planning heuristic, not an inventory policy.</p></Card>
                </>
            )}
        </div>
    );
}
