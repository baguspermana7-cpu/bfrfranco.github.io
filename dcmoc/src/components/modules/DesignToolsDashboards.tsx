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
    const r = m.agentQuantity({ volumeM3, agent });
    return (
        <div className="space-y-4">
            <Head icon={Flame} title="Fire Suppression" sub="DC-OS · models.fire (NFPA 2001)" tone="from-rose-500 to-orange-600" />
            <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Agent</span>
                <select value={agent} onChange={(e) => setAgent(e.target.value)} className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-slate-700 dark:text-slate-200">
                    <option value="novec1230">Novec 1230</option>
                    <option value="fm200">FM-200</option>
                    <option value="ig541">Inert Gas IG-541</option>
                </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Metric label="Protected Volume" value={`${volumeM3.toLocaleString()} m³`} sub={`${Math.round(floorM2).toLocaleString()} m² × 3.5 m`} />
                {r.type === 'halocarbon'
                    ? <Metric label="Agent Mass" value={`${r.massKg.toLocaleString()} kg`} sub={`${r.agent} @ ${r.designConcentration}%`} />
                    : <Metric label="Agent Volume" value={`${r.agentVolumeM3.toLocaleString()} m³`} sub={`${r.agent} @ ${r.designConcentration}%`} />}
                <Metric label="Design Conc." value={`${r.designConcentration}%`} sub={r.type} />
            </div>
            <Card><p className="text-[11px] text-slate-500">NFPA-2001 clean-agent quantity for the white-space volume. Halocarbon mass = V/s·C/(100−C); inert volume = V·ln(100/(100−C)). Budgetary sizing, not a fire-protection design.</p></Card>
        </div>
    );
}

/* ── CDU / liquid-cooling sizing (models.cdu) ── */
export function CduDashboard() {
    const { inputs } = useCfg();
    const m = rzModels().cdu;
    if (!m) return <Loading />;
    const [dT, setDT] = React.useState(10);
    const r = m.size({ itKw: inputs.itLoad, deltaT: dT });
    const liquid = inputs.coolingType === 'liquid' || inputs.coolingType === 'rdhx';
    return (
        <div className="space-y-4">
            <Head icon={Waves} title="CDU / Liquid Cooling" sub="DC-OS · models.cdu" tone="from-cyan-500 to-blue-600" />
            {!liquid && <p className="text-[11px] text-amber-500">Current cooling is {inputs.coolingType} — CDU sizing shown for a liquid-cooled scenario.</p>}
            <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">ΔT (K)</span>
                <input type="range" min={5} max={20} value={dT} onChange={(e) => setDT(Number(e.target.value))} className="accent-cyan-500" />
                <span className="tabular-nums text-slate-600 dark:text-slate-300">{dT} K</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric label="Coolant Flow" value={`${r.flowLpm.toLocaleString()} L/min`} sub={`${r.flowM3h} m³/h`} />
                <Metric label="Heat Load" value={`${(inputs.itLoad / 1000).toFixed(1)} MW`} sub="IT load" />
                <Metric label="CDU Units" value={`${r.cduUnits}`} sub={`${r.cduUnitsRedundant} with N+1`} />
                <Metric label="ΔT" value={`${r.deltaT} K`} sub="supply→return" />
            </div>
            <Card><p className="text-[11px] text-slate-500">Coolant flow = Q/(ρ·cp·ΔT) with water (ρ 997, cp 4.18). CDU count sized on nominal rejected-heat per unit + N+1. Sizing estimate, not a hydraulic design.</p></Card>
        </div>
    );
}

/* ── Spares (models.spares — EOQ) ── */
export function SparesDashboard() {
    const { inputs } = useCfg();
    const m = rzModels().spares;
    if (!m) return <Loading />;
    // representative critical-spare demand scales with fleet size (IT load)
    const mw = inputs.itLoad / 1000;
    const annualDemand = Math.max(4, Math.round(mw * 3));
    const orderCost = 450, holdingCostPerUnit = 90, unitCost = 3200;
    const e = m.eoq({ annualDemand, orderCost, holdingCostPerUnit });
    const rop = m.reorderPoint({ demandPerDay: annualDemand / 365, leadDays: 45, safetyStock: Math.ceil(annualDemand * 0.1) });
    return (
        <div className="space-y-4">
            <Head icon={Package} title="Spares Optimization" sub="DC-OS · models.spares (EOQ)" tone="from-emerald-500 to-teal-600" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric label="EOQ" value={`${e.eoq} units`} sub={`${e.orders} orders/yr`} />
                <Metric label="Reorder Point" value={`${rop} units`} sub="45-day lead + safety" />
                <Metric label="Annual Holding" value={money(e.annualHolding)} sub={`$${holdingCostPerUnit}/unit·yr`} />
                <Metric label="Annual Ordering" value={money(e.annualOrdering)} sub={`$${orderCost}/order`} />
            </div>
            <Card><p className="text-[11px] text-slate-500">EOQ = √(2·D·S/H) for a representative critical spare (annual demand ≈ {annualDemand} scaling with the {mw.toFixed(1)} MW fleet, unit ≈ {money(unitCost)}). Reorder point = demand/day·lead + safety. Planning heuristic, not an inventory policy.</p></Card>
        </div>
    );
}
