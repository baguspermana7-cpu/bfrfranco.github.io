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
import { rzModels, rzData , useEngineReady } from '@/lib/rz-engine';
import { densityToEngineBucket } from '@/lib/requirementsMappings';
import { generatePillarPDF, type PillarReport } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';
import {
    computeSpares, defaultLeadWeeks, SPARES_CLASSES, UNIT_COST_SCREENING,
    UNDERSTOCK_COST_SCREENING, CARRY_RATE_PCT, PART_LIFE_YRS,
    type SparesClassKey, type SparesClassOverride, type SparesOverrides, type Provenance,
    type SparesRow, type SparesResult,
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
            <div className={`w-11 h-11 rounded-lg ${tone} flex items-center justify-center`}><Icon className="w-6 h-6" /></div>
            <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1><p className="text-sm text-slate-500 dark:text-slate-400">{sub}</p></div>
        </div>
    );
}
function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 transition-colors hover:border-rz-info/50"><div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div><div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</div>{sub && <div className="text-[10px] text-slate-500">{sub}</div>}</div>;
}
function Card({ children }: { children: React.ReactNode }) { return <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">{children}</div>; }
function Loading() { return <div className="text-sm text-slate-500 p-8 text-center">Engine loading…</div>; }
const money = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`;

/* ─── Diagnostics Tier-2/3 (DIAGNOSTICS_STANDARD.md) ─────────────────────────
 * SINGLE-SOURCE thresholds: each constant/predicate below drives (a) the red
 * cell coloring, (b) the click-to-explain panel gating and (c) the
 * collectDesignToolsDiagnostics collector — never re-literal at a call site.
 * Levers are MEASURED re-runs of the same engine/adapter (models.spares
 * newsvendor kernels · computeSpares discrete re-run · DATA.refrigerants live
 * rows) — not generic advice. */
const SPARES_TAB = 'spares';
const CDU_TAB = 'cdu';
export const REF_GWP_RED = 700;    // GWP100 > 700 → rose cell (US AIM Act / EU F-Gas line) + panel + finding
export const REF_GWP_AMBER = 150;  // GWP100 > 150 → amber; ≤ 150 qualifies as a low-GWP alternative
const SP_QSTAR_SEARCH_MAX = 50;    // honest-unreachable bound for the "+N units" fill lever

/** Fill-rate fail predicate — same expression as the rose coloring in the
 *  per-class table and the adapter's totals.belowTarget. */
const spFillBelow = (r: Pick<SparesRow, 'fillAchieved' | 'fillTargetPct'>): boolean =>
    r.fillAchieved < r.fillTargetPct / 100;

/** DATA.refrigerants row (engine v2.3.0 — GWP100 IPCC AR4, ASHRAE 34 safety). */
interface RefrigerantRow {
    label: string; gwp: number; safety: string; copIndex: number; capexMult: number; apps: string[]; note: string;
}
/* Ship-B — DATA.coolingTech row (advanced/emerging cooling ladder + microfluidic). */
interface CoolingTechRow {
    vendor?: string; tech?: string; family?: string; trl?: number; rackKwClaim?: number;
    coolant?: string; wueBasis?: string; confidence?: 'commercial' | 'emerging'; ref?: string; source?: string;
}

/** ASHRAE-34 / application-envelope compatibility note for a low-GWP swap —
 *  derived from the live DATA.refrigerants apps + safety fields. */
function refCompatNote(cur: RefrigerantRow, alt: RefrigerantRow): string {
    const shared = alt.apps.filter((a) => cur.apps.includes(a));
    const appTxt = shared.length
        ? `apps match: ${shared.join('/')}`
        : `⚠ different envelope (${alt.apps.join('/')} vs ${cur.apps.join('/')}) — not a drop-in`;
    const safetyTxt = alt.safety === 'A1' ? ''
        : alt.safety === 'A2L' ? ' · A2L mildly-flammable: leak detection + charge limit (ASHRAE 34 / ISO 5149)'
            : alt.safety === 'A3' ? ' · A3 highly-flammable: strict charge limit, outdoor/packaged only'
                : ` · ${alt.safety}: toxicity — machine-room isolation & charge limits (EN 378/IIAR)`;
    return `${appTxt}${safetyTxt}`;
}

/** Re-run models.spares.newsvendor with the EXACT inputs the spares-adapter
 *  used for this row, exposing the engine's muLT/sigLT/mode + a fill(q)
 *  kernel (shared Acklam Φ / exact Poisson — models.spares.normCdf/poissonCdf)
 *  so the "+N units" lever is computed by the engine, not a local formula.
 *  parity === true ⇔ the re-run reproduces the rendered Q* + fill (rule 4). */
interface SpEngineRerun { muLT: number; sigLT: number; usedPoissonMode: boolean; qStar: number; fillAt: (q: number) => number; parity: boolean; }
function spNewsvendorRerun(r: SparesRow): SpEngineRerun | null {
    try {
        const sp = rzModels()?.spares;
        if (typeof sp?.newsvendor !== 'function' || typeof sp?.normCdf !== 'function' || typeof sp?.poissonCdf !== 'function') return null;
        const nv = sp.newsvendor({
            unitCost: r.unitCost,
            understockCostPerEvent: UNDERSTOCK_COST_SCREENING[r.criticality],
            carryRatePct: CARRY_RATE_PCT,
            partLifeYrs: PART_LIFE_YRS,
            muAnnual: (r.fleet * 8760) / r.mtbf,
            ltWeeks: r.leadWeeks,
            fillRatePct: r.fillTargetPct,
        });
        const fillAt = (q: number): number => nv.usedPoissonMode
            ? sp.poissonCdf(q, nv.muLT)
            : sp.normCdf((q - nv.muLT) / Math.max(nv.sigLT, 1e-9));
        return {
            muLT: nv.muLT, sigLT: nv.sigLT, usedPoissonMode: !!nv.usedPoissonMode, qStar: nv.qStar, fillAt,
            parity: nv.qStar === r.qStar && Math.abs(fillAt(r.qStar) - r.fillAchieved) < 0.005,
        };
    } catch { return null; }
}

/* ─── Diagnostics Center collector (pure — no hooks, no DOM) ──────────────── */
export interface Finding {
    surface: string;
    severity: 'high' | 'medium';
    metric: string;
    value: number;
    threshold: number;
    linkTab: string;
}

export interface DesignToolsDiagnosticsModel {
    /** computeSpares output the SparesDashboard renders (same adapter). */
    spares?: Pick<SparesResult, 'engineReady' | 'rows'> | null;
    /** Selected refrigerant (key + live DATA.refrigerants gwp). */
    refrigerant?: { key: string; gwp: number } | null;
}

/** ACTIVE findings for the Design Tools surfaces, from the SAME models the
 *  pages render: spares fill-rate below its class target (high when the class
 *  is Critical), Critical classes carrying zero shelf spares, and a selected
 *  refrigerant above the GWP red line. */
export function collectDesignToolsDiagnostics(model: DesignToolsDiagnosticsModel): Finding[] {
    const findings: Finding[] = [];
    const rows = model.spares?.engineReady ? model.spares.rows : [];
    for (const r of rows) {
        if (spFillBelow(r)) {
            findings.push({
                surface: 'Design Tools · Spares Optimization',
                severity: r.criticality === 'Critical' ? 'high' : 'medium',
                metric: `Fill rate — ${r.label}`,
                value: +(r.fillAchieved * 100).toFixed(1),
                threshold: r.fillTargetPct,
                linkTab: SPARES_TAB,
            });
        }
        if (r.criticality === 'Critical' && r.qStar === 0) {
            findings.push({
                surface: 'Design Tools · Spares Optimization',
                severity: 'medium', // restore waits the full procurement lead on a stockout
                metric: `Critical class without shelf spare — ${r.label}`,
                value: r.qStar,
                threshold: 1,
                linkTab: SPARES_TAB,
            });
        }
    }
    if (model.refrigerant && model.refrigerant.gwp > REF_GWP_RED) {
        findings.push({
            surface: 'Design Tools · CDU / Liquid Cooling',
            severity: 'medium', // regulatory phase-down exposure, not an operational failure
            metric: `Refrigerant GWP — ${model.refrigerant.key}`,
            value: model.refrigerant.gwp,
            threshold: REF_GWP_RED,
            linkTab: CDU_TAB,
        });
    }
    return findings;
}

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
            <Head icon={ShieldCheck} title="Tier Classification" sub="DC-OS · models.tier (Uptime-style)" tone="bg-rz-info/10 border border-rz-info/30 text-rz-info" />
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
            <Head icon={Flame} title="Fire Suppression" sub="DC-OS · models.fire (NFPA 2001 / 72 / 855)" tone="bg-rz-alert/10 border border-rz-alert/30 text-rz-alert" />
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
            {/* AG5 — fire zones + capex + suppression basis */}
            <FireZonesSection volumeM3={volumeM3} agent={agent} />
            <Card><p className="text-[11px] text-slate-500">NFPA-2001 clean-agent quantity + NOAEL occupant-safety margin + agent CO₂e (GWP100) + NFPA-72 detector count. Budgetary sizing, not a fire-protection design.</p></Card>
        </div>
    );
}

/* AG5 — zones from equipScale + real capex fire/detection cost keys. */
function FireZonesSection({ volumeM3, agent }: { volumeM3: number; agent: string }) {
    const { inputs } = useCfg();
    const capex = useCapexStore((s) => s.results);
    const capexInputs = useCapexStore((s) => s.inputs);
    const req = useRequirementsStore();
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    let zones = 0;
    try {
        const eq = rzModels()?.commissioning?.equipScale?.({ itLoad: inputs.itLoad, rackDensity: densityToEngineBucket(req.workload.avgRackDensityKw) });
        zones = eq?.fireZones ?? 0;
    } catch { /* */ }
    const costs = (capex?.costs ?? {}) as Record<string, number>;
    const fireCost = (costs.fire ?? 0) + (costs.fireDetection ?? 0) + (costs.fire_suppression ?? 0);
    const perZoneM3 = zones > 0 ? Math.round(volumeM3 / zones) : volumeM3;
    if (!zones && !fireCost) return null;
    return (
        <Card>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Suppression Zones & Cost Basis <span className="normal-case text-[9px] text-emerald-500">engine equipment scaling + capex engine</span></h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Fire Zones" value={String(zones)} sub="equipScale (1 per ~200 kW)" />
                <Metric label="Volume / Zone" value={`${perZoneM3.toLocaleString()} m³`} sub="protected volume ÷ zones" />
                {fireCost > 0
                    ? <Metric label="Fire System CAPEX" value={money(fireCost)} sub={`${capexInputs.fireType} + ${capexInputs.alarmType} (capex engine)`} />
                    : (
                        /* capex results absent — honest empty state with a route to the source */
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">Fire System CAPEX</div>
                            <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">—</div>
                            <button onClick={() => setActiveTab('capex')} className="text-[10px] font-medium text-rz-mint hover:text-rz-mint/80">run the CAPEX Engine →</button>
                        </div>
                    )}
                <Metric label="Selected Agent" value={agent === 'novec1230' ? 'Novec 1230' : agent === 'fm200' ? 'FM-200' : 'IG-541'} sub={`shared capex: ${capexInputs.fireType}`} />
            </div>
            <p className="mt-1.5 text-[9px] text-slate-400">{fireCost > 0
                ? 'Zone count and system cost read the SAME engine scaling + capex results as Commissioning and CAPEX — one source, no divergence.'
                : 'Zone count reads the engine equipment scaling; system cost appears after the CAPEX Engine has been run — same source as the CAPEX page.'}</p>
        </Card>
    );
}

/* ── CDU / liquid-cooling — Phase W rebuild + DE UIUX section cards ───────────
 * Sections: (a) Sizing & Control (models.cdu.size) · (b) Hydraulics & Thermal
 * table (models.cdu.hydraulics when present) · (c) Cooling Efficiency PUE
 * mini-bars (DATA.pueMatrix liquid vs air delta) · (d) Refrigerant Selection
 * (DATA.refrigerants 9 rows + selected-summary) · (e) DEEP-SEA ADVANCED when
 * the shared capex deep-sea tick is ON (models.cooling.deepSea — flow, intake
 * temp @depth, pumps, chiller-less PUE ≤1.15 basis, marine capex/opex) ·
 * full-standard PDF export. Presentation/consumption only — no engine math. */
function EngChip({ src }: { src: string }) {
    return <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold normal-case text-emerald-500" title={`Engine source: ${src}`}>{src}</span>;
}
export function CduDashboard() {
    const { inputs } = useCfg();
    const capexInputs = useCapexStore((s) => s.inputs);
    const setCapexInputs = useCapexStore((s) => s.setInputs);
    const [dT, setDT] = React.useState(10);
    const [busy, setBusy] = React.useState(false);
    /* GWP diagnostics panel — key of the refrigerant whose rose GWP cell was clicked */
    const [gwpDiag, setGwpDiag] = React.useState<string | null>(null);
    const m = rzModels().cdu;
    const engineReadyCdu = useEngineReady();
    const dsModel = engineReadyCdu ? rzModels().cooling?.deepSea : undefined;
    const data = rzData() as {
        refrigerants?: Record<string, RefrigerantRow>;
        pueMatrix?: Record<string, Record<string, number>>;
        refrigerantAutoByCooling?: Record<string, string | null>;
        coolingTech?: Record<string, CoolingTechRow>;
    };
    /* deep-sea advanced — gated on the SHARED capex tick (Requirements 1.6 /
     * CAPEX drawer). Hook stays ABOVE the early return (hooks-order rule). */
    const ds = React.useMemo(() => {
        if (!capexInputs.deepSea || typeof dsModel !== 'function') return null;
        try {
            return dsModel({
                itLoadMw: inputs.itLoad / 1000, pueTarget: 1.15,
                depthM: capexInputs.dsDepthM ?? 60, pipelineKm: capexInputs.dsPipelineKm ?? 3, deltaTC: capexInputs.dsDeltaTC ?? 8,
            });
        } catch { return null; }
    }, [capexInputs.deepSea, capexInputs.dsDepthM, capexInputs.dsPipelineKm, capexInputs.dsDeltaTC, dsModel, inputs.itLoad]);
    if (!m) return <Loading />;
    const rich = !!m.hydraulics;
    const r = rich ? m.hydraulics({ itKw: inputs.itLoad, deltaTK: dT, supplyC: 20 }) : m.size({ itKw: inputs.itLoad, deltaT: dT });
    /* Sizing plane always from models.cdu.size (CDU unit count + N+1) even when
     * the rich hydraulics model drives the thermal table. */
    const sz = typeof m.size === 'function' ? m.size({ itKw: inputs.itLoad, deltaT: dT }) : null;
    const liquid = inputs.coolingType === 'liquid' || inputs.coolingType === 'rdhx';
    const tierKey = 'tier' + inputs.tierLevel;
    const pueLiquid = data.pueMatrix?.directToChip?.[tierKey] ?? data.pueMatrix?.liquid?.[tierKey] ?? 1.15;
    const pueAir = data.pueMatrix?.air?.[tierKey] ?? 1.5;
    const pueCurrent = data.pueMatrix?.[inputs.coolingType]?.[tierKey] ?? (liquid ? pueLiquid : pueAir);
    const refKey = capexInputs.refrigerantType ?? data.refrigerantAutoByCooling?.[inputs.coolingType] ?? 'R134a';
    const refDb = data.refrigerants ?? {};

    const exportPdf = async () => {
        setBusy(true);
        try {
            const narrativeMetrics = { pue: ds?.pue ?? pueLiquid, liquidSharePct: liquid ? 100 : 0 };
            const report: StandardReport = {
                title: 'CDU / Liquid Cooling', layer: 'Cooling Design', project: 'DC-OS Project',
                kpis: [
                    { label: 'Coolant Flow', value: `${(r.flowLpm as number).toLocaleString()} L/min`, sub: `ΔT ${dT} K` },
                    { label: 'Heat Load', value: `${(inputs.itLoad / 1000).toFixed(1)} MW`, sub: 'IT load' },
                    { label: 'PUE (liquid basis)', value: String(pueLiquid), sub: `vs air ${pueAir}` },
                    ...(ds ? [{ label: 'Deep-Sea PUE', value: String(ds.pue), sub: 'chiller-less basis' }] : []),
                ],
                config: [
                    ['Cooling Type', inputs.coolingType], ['Tier', `Tier ${inputs.tierLevel}`], ['Loop ΔT', `${dT} K`],
                    ['Refrigerant', refDb[refKey]?.label ?? refKey],
                    ['Deep-Sea Cooling', capexInputs.deepSea ? `ON — ${capexInputs.dsDepthM ?? 60} m · ${capexInputs.dsPipelineKm ?? 3} km · ΔT ${capexInputs.dsDeltaTC ?? 8}°C` : 'off'],
                ],
                sections: [
                    ...(rich ? [{
                        title: 'Loop Hydraulics', head: ['Metric', 'Value'],
                        rows: [['Flow', `${(r.flowLpm as number).toLocaleString()} L/min (${r.velocityMs} m/s)`], ['Pressure drop', `${r.dpBar} bar (Re ${(r.reynolds as number).toLocaleString()})`], ['Pump power', `${r.pumpKw} kW (${r.pumpsNplus1} pumps N+1)`], ['Dew-point margin', `${r.dewMarginK} K ${r.dewSafeOk ? '(safe)' : '(condensation risk)'}`], ['HX approach', `${r.hxApproachK} K`]],
                    }] : []),
                    {
                        title: 'Refrigerant Database (engine)', head: ['Refrigerant', 'GWP', 'Safety', 'COP idx', 'CAPEX ×', 'Apps'],
                        rows: Object.entries(refDb).map(([k, v]) => [`${v.label}${k === refKey ? ' ◀ selected' : ''}`, v.gwp, v.safety, v.copIndex, v.capexMult, v.apps.join('/')]),
                    },
                    ...(ds ? [{
                        title: 'Deep-Sea Water Cooling (engine models.cooling.deepSea)', head: ['Metric', 'Value'],
                        rows: [
                            ['Seawater flow', `${ds.flow.m3s} m³/s (${ds.flow.m3h.toLocaleString()} m³/h)`],
                            ['Intake temp @ depth', `${ds.intakeTempC} °C @ ${ds.depthM} m`],
                            ['Pumps', `${ds.pumps.duty}+1 × ${ds.pumps.perPumpKw} kW (head ${ds.pumps.headM} m)`],
                            ['Cooling power', `${ds.coolingMw} MW → pPUE ${ds.pPUE}`],
                            ['PUE (chiller-less)', String(ds.pue)],
                            ['Marine CAPEX', `$${(ds.capex.total / 1e6).toFixed(1)}M ($${(ds.capex.perMw / 1e3).toFixed(0)}K/MW)`],
                            ['vs baseline cooling', `${ds.capex.vsBaselineCooling >= 0 ? '+' : ''}$${(ds.capex.vsBaselineCooling / 1e6).toFixed(1)}M`],
                            ['OPEX', `$${(ds.opex.totalYr / 1e6).toFixed(2)}M/yr (pumps ${ds.opex.pumpMwhYr.toLocaleString()} MWh/yr)`],
                        ],
                    }] : []),
                ],
                callouts: ds && ds.warnings?.length ? ds.warnings.map((w: string) => ({ title: 'Deep-sea screening warning', body: w, tone: 'warn' as const })) : undefined,
                assessment: buildAssessment('cooling', narrativeMetrics),
                actions: buildActions('cooling', narrativeMetrics),
                summaryBand: [
                    { label: 'Coolant Flow', value: `${(r.flowLpm as number).toLocaleString()} L/min` },
                    { label: 'IT Load', value: `${(inputs.itLoad / 1000).toFixed(1)} MW` },
                    { label: 'PUE Liquid', value: String(pueLiquid) },
                    { label: 'PUE Air', value: String(pueAir) },
                    { label: 'Refrigerant', value: refDb[refKey]?.label ?? refKey },
                    ...(ds ? [{ label: 'Deep-Sea PUE', value: String(ds.pue) }] : []),
                ],
                note: 'Thermohydraulic sizing estimate (Darcy-Weisbach + Magnus dew point) and deep-sea screening per the engine deepSeaCooling dataset — not a hydraulic or marine design.',
            };
            await generatePillarPDF(report);
        } finally { setBusy(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
                <Head icon={Waves} title="CDU / Liquid Cooling" sub="DC-OS · models.cdu + models.cooling.deepSea + DATA.refrigerants" tone="bg-rz-info/10 border border-rz-info/30 text-rz-info" />
                <button onClick={exportPdf} disabled={busy}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-rz-mint disabled:opacity-50">
                    <FileDown className="h-3.5 w-3.5" />{busy ? '…' : 'Export'}
                </button>
            </div>
            {!liquid && <p className="text-[11px] text-amber-500">Current cooling is {inputs.coolingType} — CDU sizing shown for a liquid-cooled scenario.</p>}

            {/* (a) Sizing & Control — models.cdu.size live */}
            <Card>
                <h3 className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Sizing &amp; Control <EngChip src="models.cdu.size" />
                </h3>
                <div className="mb-2 flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Loop ΔT (K)</span>
                    <input type="range" min={5} max={20} value={dT} onChange={(e) => setDT(Number(e.target.value))} className="accent-cyan-500"
                        title={`Loop ΔT setpoint: ${dT} K (supply→return)`} />
                    <span className="tabular-nums text-slate-600 dark:text-slate-300">{dT} K</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Metric label="Coolant Flow" value={`${(r.flowLpm as number).toLocaleString()} L/min`} sub={rich ? `${r.velocityMs} m/s` : `${r.flowM3h} m³/h`} />
                    <Metric label="Heat Load" value={`${(inputs.itLoad / 1000).toFixed(1)} MW`} sub="IT load (project config)" />
                    {sz
                        ? <Metric label="CDU Units" value={`${sz.cduUnits}`} sub={`${sz.cduUnitsRedundant} with N+1`} />
                        : !rich && <Metric label="CDU Units" value={`${r.cduUnits}`} sub={`${r.cduUnitsRedundant} with N+1`} />}
                    <Metric label="ΔT Setpoint" value={`${dT} K`} sub="supply→return control" />
                </div>
            </Card>

            {/* (b) Hydraulics & Thermal — table, only when the rich model exists */}
            {rich && (
                <Card>
                    <h3 className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Hydraulics &amp; Thermal <EngChip src="models.cdu.hydraulics" />
                        <span className="text-[9px] normal-case text-slate-400">Darcy-Weisbach / Haaland + Magnus dew point</span>
                    </h3>
                    <table className="w-full text-[10.5px]">
                        <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">Metric</th><th className="text-right">Value</th><th className="pl-3 text-left">Basis</th></tr></thead>
                        <tbody>
                            {([
                                ['Coolant flow', `${(r.flowLpm as number).toLocaleString()} L/min · ${r.velocityMs} m/s`, `ΔT ${dT} K loop`],
                                ['Reynolds / friction', `Re ${(r.reynolds as number).toLocaleString()} · f ${r.frictionFactor}`, (r.reynolds as number) >= 2300 ? 'turbulent (Haaland)' : 'laminar (64/Re)'],
                                ['Pressure drop / head', `${r.dpBar} bar ≈ ${(Number(r.dpBar) * 10.1972).toFixed(1)} m H₂O`, 'Darcy-Weisbach'],
                                ['Pump power', `${r.pumpKw} kW · ${r.pumpsNplus1} pumps (N+1)`, 'hydraulic / pump·motor eff'],
                                ['Dew point / margin', `${r.dewPointC} °C · margin ${r.dewMarginK} K`, r.dewSafeOk ? '✓ no condensation' : '⚠ condensation risk'],
                                ['HX approach', `${r.hxApproachK} K`, 'facility → technical loop'],
                            ] as [string, string, string][]).map(([lbl, val, basis]) => (
                                <tr key={lbl} className="border-b border-slate-100 dark:border-slate-800/60">
                                    <td className="py-1 text-slate-700 dark:text-slate-200">{lbl}</td>
                                    <td className="text-right tabular-nums text-slate-600 dark:text-slate-300">{val}</td>
                                    <td className="pl-3 text-[9px] text-slate-400">{basis}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            {/* (c) Cooling Efficiency — PUE mini-bars, liquid vs air delta */}
            <Card>
                <h3 className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Cooling Efficiency <EngChip src="DATA.pueMatrix" />
                    <span className="text-[9px] normal-case text-slate-400">Tier {inputs.tierLevel} column</span>
                </h3>
                <div className="space-y-1.5">
                    {([
                        { lbl: 'Air (CRAC/CRAH)', pue: pueAir, tone: 'bg-slate-400' },
                        { lbl: `Current (${inputs.coolingType})`, pue: pueCurrent, tone: 'bg-rz-mint' },
                        { lbl: 'D2C Liquid', pue: pueLiquid, tone: 'bg-cyan-500' },
                    ]).map((row) => (
                        <div key={row.lbl} className="flex items-center gap-2 text-[11px]" title={`${row.lbl} PUE at Tier ${inputs.tierLevel}: ${row.pue} (engine pueMatrix)`}>
                            <span className="w-32 truncate text-slate-600 dark:text-slate-300">{row.lbl}</span>
                            <div className="h-2.5 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                                <div className={`h-2.5 rounded ${row.tone}`} style={{ width: `${Math.min(100, Math.max(4, ((row.pue - 1) / (Math.max(pueAir, pueCurrent, pueLiquid) - 1)) * 100))}%` }} />
                            </div>
                            <span className="w-12 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">{row.pue}</span>
                        </div>
                    ))}
                </div>
                <p className="mt-1.5 text-[9px] text-slate-400">
                    Liquid vs air Δ = {(pueAir - pueLiquid).toFixed(2)} PUE ≈ {(inputs.itLoad / 1000 * (pueAir - pueLiquid)).toFixed(2)} MW facility power saved at this IT load. Bars scale (PUE − 1) overhead share.
                </p>
            </Card>

            {/* refrigerant selection */}
            {Object.keys(refDb).length > 0 && (
                <Card>
                    <h3 className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Refrigerant Selection <EngChip src="DATA.refrigerants" />
                        <span className="text-[9px] normal-case text-slate-400">{Object.keys(refDb).length} refrigerants · shared capex field</span>
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[10.5px]">
                            <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">Refrigerant</th><th className="text-right">GWP</th><th className="text-center">Safety</th><th className="text-right">COP idx</th><th className="text-right">CAPEX ×</th><th className="text-left pl-2">Note</th></tr></thead>
                            <tbody>
                                {Object.entries(refDb).map(([k, v]) => (
                                    <tr key={k} onClick={() => setCapexInputs({ refrigerantType: k })}
                                        title={`${v.label}: GWP ${v.gwp}, safety ${v.safety} — click to select`}
                                        className={`cursor-pointer border-b border-slate-100 dark:border-slate-800/60 ${k === refKey ? 'bg-cyan-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
                                        <td className="py-1 font-medium text-slate-700 dark:text-slate-200">{k === refKey ? '● ' : ''}{v.label}</td>
                                        <td
                                            className={`text-right tabular-nums ${v.gwp > REF_GWP_RED ? 'text-rose-400 font-semibold cursor-pointer underline decoration-dotted underline-offset-2' : v.gwp > REF_GWP_AMBER ? 'text-amber-500' : 'text-emerald-500'}`}
                                            title={v.gwp > REF_GWP_RED ? `GWP100 ${v.gwp} > ${REF_GWP_RED} (US AIM Act 2025 / EU F-Gas phase-down) — click for low-GWP alternatives from DATA.refrigerants` : undefined}
                                            onClick={v.gwp > REF_GWP_RED ? (e) => { e.stopPropagation(); setGwpDiag((d) => d === k ? null : k); } : undefined}
                                        >{v.gwp}</td>
                                        <td className="text-center text-slate-500">{v.safety}</td>
                                        <td className="text-right tabular-nums text-slate-500">{v.copIndex}</td>
                                        <td className="text-right tabular-nums text-slate-500">{v.capexMult}</td>
                                        <td className="pl-2 text-[9px] text-slate-400">{v.note.slice(0, 70)}…</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* GWP diagnostics panel — reason + low-GWP alternatives from the SAME
                      * DATA.refrigerants rows the table renders. Self-heals: hidden if the
                      * clicked refrigerant no longer breaches the red line. */}
                    {gwpDiag && refDb[gwpDiag] && refDb[gwpDiag].gwp > REF_GWP_RED && (() => {
                        const cur = refDb[gwpDiag];
                        const alts = Object.entries(refDb)
                            .filter(([ak, av]) => ak !== gwpDiag && av.gwp <= REF_GWP_AMBER)
                            .sort((a, b) => a[1].gwp - b[1].gwp);
                        return (
                            <div className="mt-2 rounded-lg border border-rose-300 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/20 p-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                                        <b>{cur.label}</b> GWP100 <b className="tabular-nums">{cur.gwp}</b> &gt; threshold {REF_GWP_RED} — {cur.note}.
                                        {' '}Alternatives with GWP ≤ {REF_GWP_AMBER} from the engine database (Δ vs {cur.label}):
                                    </p>
                                    <button type="button" onClick={() => setGwpDiag(null)}
                                        className="shrink-0 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Close ✕</button>
                                </div>
                                <div className="mt-2 space-y-1.5">
                                    {alts.length === 0 && (
                                        /* honest-empty: engine DB carries no row at/below the low-GWP line */
                                        <p className="text-[10.5px] text-slate-500">No refrigerant with GWP ≤ {REF_GWP_AMBER} in DATA.refrigerants at present.</p>
                                    )}
                                    {alts.map(([ak, av]) => {
                                        const dCop = av.copIndex - cur.copIndex;
                                        const dCapex = av.capexMult - cur.capexMult;
                                        return (
                                            <button key={ak} type="button"
                                                onClick={() => { setCapexInputs({ refrigerantType: ak }); setGwpDiag(null); }}
                                                title={`Select ${av.label} (shared capex field refrigerantType)`}
                                                className="group flex w-full items-start gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 p-2 text-left transition-colors hover:border-cyan-400 dark:hover:border-cyan-500">
                                                <span className="mt-0.5 shrink-0 rounded bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-emerald-700 dark:text-emerald-300">{av.label}</span>
                                                <span className="flex-1 text-[10.5px] leading-snug text-slate-600 dark:text-slate-400">
                                                    GWP <b className="tabular-nums">{av.gwp}</b> (Δ <b className="tabular-nums text-emerald-600 dark:text-emerald-400">−{(cur.gwp - av.gwp).toLocaleString()}</b>)
                                                    {' '}· COP idx <b className="tabular-nums">{av.copIndex}</b> ({dCop >= 0 ? '+' : ''}{(dCop * 100).toFixed(0)}% vs {cur.label})
                                                    {' '}· CAPEX × <b className="tabular-nums">{av.capexMult}</b> ({dCapex >= 0 ? '+' : ''}{(dCapex * 100).toFixed(0)}%)
                                                    {' '}· safety <b>{av.safety}</b> — {refCompatNote(cur, av)}
                                                </span>
                                                <span className="mt-0.5 shrink-0 text-[9px] font-semibold text-slate-400 group-hover:text-cyan-500">select →</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="mt-1.5 text-[9px] text-slate-400">All figures live from DATA.refrigerants (GWP100 IPCC AR4, ASHRAE 34, COP idx R-134a = 1.00, capexMult = flammability/toxicity mitigation). Clicking an alternative sets the shared capex refrigerantType — screening, not equipment selection.</p>
                            </div>
                        );
                    })()}
                    {/* selected-summary row */}
                    {refDb[refKey] && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-2.5 py-1.5 text-[10px]"
                            title={`Selected refrigerant summary — ${capexInputs.refrigerantType ? 'user-selected (shared capex field)' : `engine auto-select for ${inputs.coolingType} cooling (DATA.refrigerantAutoByCooling)`}`}>
                            <span className="font-semibold text-cyan-600 dark:text-cyan-400">Selected: {refDb[refKey].label}</span>
                            <span className="text-slate-500">GWP <b className="tabular-nums">{refDb[refKey].gwp}</b></span>
                            <span className="text-slate-500">Safety <b>{refDb[refKey].safety}</b></span>
                            <span className="text-slate-500">COP idx <b className="tabular-nums">{refDb[refKey].copIndex}</b></span>
                            <span className="text-slate-500">CAPEX × <b className="tabular-nums">{refDb[refKey].capexMult}</b></span>
                            <span className={`rounded px-1 py-0.5 text-[8.5px] font-semibold ${capexInputs.refrigerantType ? 'bg-rz-mint/15 text-rz-mint' : 'bg-emerald-500/15 text-emerald-500'}`}>
                                {capexInputs.refrigerantType ? 'user' : `auto (${inputs.coolingType})`}
                            </span>
                        </div>
                    )}
                </Card>
            )}

            {/* Ship-B — Advanced & Emerging Cooling ladder (DATA.coolingTech) */}
            {Object.keys(data.coolingTech ?? {}).length > 0 && (
                <Card>
                    <h3 className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Advanced &amp; Emerging Cooling <EngChip src="DATA.coolingTech" />
                        <span className="text-[9px] normal-case text-slate-400">{Object.keys(data.coolingTech ?? {}).length} techs · TRL-classified ladder</span>
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[10.5px]">
                            <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">Vendor</th><th className="text-left pl-2">Technology</th><th className="text-center">TRL</th><th className="text-right">Rack kW</th><th className="text-center">Confidence</th></tr></thead>
                            <tbody>
                                {Object.entries(data.coolingTech ?? {}).map(([k, t]) => {
                                    const emerging = t.confidence === 'emerging';
                                    return (
                                        <tr key={k} className="border-b border-slate-100 dark:border-slate-800/60 align-top" title={t.ref}>
                                            <td className="py-1 font-medium text-slate-700 dark:text-slate-200">{t.vendor ?? '—'}</td>
                                            <td className="pl-2 text-slate-500">{t.tech ?? '—'}</td>
                                            <td className="text-center">
                                                <span className={`rounded px-1 py-0.5 text-[8.5px] font-bold tabular-nums ${emerging ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'}`}>TRL {t.trl ?? '—'}</span>
                                            </td>
                                            <td className="text-right tabular-nums text-slate-500">{t.rackKwClaim ?? '—'}</td>
                                            <td className="text-center">
                                                <span className={`rounded px-1.5 py-0.5 text-[8.5px] font-semibold uppercase ${emerging ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'}`}>{emerging ? 'Emerging' : 'Commercial'}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-1.5 text-[9px] text-slate-400">COMMERCIAL = TRL 8-9 shipping; EMERGING = TRL 5-7 pilot/riset. Microfluidic in-chip belum punya harga per-rak publik &amp; BUKAN fakta arsitektur NVIDIA.</p>
                </Card>
            )}

            {/* deep-sea advanced (gated on the shared capex tick) */}
            {capexInputs.deepSea && ds ? (
                <Card>
                    <h3 className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-cyan-500">
                        Deep-Sea Water Cooling — Advanced <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-500">ENGINE</span>
                        <span className="text-[9px] normal-case text-slate-400">models.cooling.deepSea · {ds.mode} mode</span>
                    </h3>
                    <div className="mb-3 grid grid-cols-3 gap-3">
                        <label className="block text-[10px] text-slate-500">Depth
                            <input type="number" value={capexInputs.dsDepthM ?? 60} min={20} max={1000}
                                onChange={(e) => setCapexInputs({ dsDepthM: Number(e.target.value) })}
                                className="mt-0.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1 text-xs text-slate-900 dark:text-slate-100" /> m
                        </label>
                        <label className="block text-[10px] text-slate-500">Pipeline
                            <input type="number" value={capexInputs.dsPipelineKm ?? 3} min={0.5} max={50} step={0.5}
                                onChange={(e) => setCapexInputs({ dsPipelineKm: Number(e.target.value) })}
                                className="mt-0.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1 text-xs text-slate-900 dark:text-slate-100" /> km
                        </label>
                        <label className="block text-[10px] text-slate-500">ΔT
                            <input type="number" value={capexInputs.dsDeltaTC ?? 8} min={4} max={15}
                                onChange={(e) => setCapexInputs({ dsDeltaTC: Number(e.target.value) })}
                                className="mt-0.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1 text-xs text-slate-900 dark:text-slate-100" /> °C
                        </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Metric label="Seawater Flow" value={`${ds.flow.m3s} m³/s`} sub={`${ds.flow.m3h.toLocaleString()} m³/h`} />
                        <Metric label="Intake Temp" value={`${ds.intakeTempC} °C`} sub={`@ ${ds.depthM} m depth`} />
                        <Metric label="Pumps" value={`${ds.pumps.duty}+1 × ${ds.pumps.perPumpKw} kW`} sub={`head ${ds.pumps.headM} m`} />
                        <Metric label="PUE (chiller-less)" value={String(ds.pue)} sub={`pPUE ${ds.pPUE} · WUE 0 · basis ≤1.15`} />
                        <Metric label="Marine CAPEX" value={`$${(ds.capex.total / 1e6).toFixed(1)}M`} sub={`$${(ds.capex.perMw / 1e3).toFixed(0)}K/MW`} />
                        <Metric label="vs Baseline Cooling" value={`${ds.capex.vsBaselineCooling >= 0 ? '+' : ''}$${(ds.capex.vsBaselineCooling / 1e6).toFixed(1)}M`} sub="capex delta" />
                        <Metric label="OPEX" value={`$${(ds.opex.totalYr / 1e6).toFixed(2)}M/yr`} sub={`pumps ${ds.opex.pumpMwhYr.toLocaleString()} MWh/yr`} />
                        <Metric label="Env. ΔT" value={ds.env.deltaTCompliant ? 'Compliant' : 'Review'} sub={`redundancy ${ds.redundancy}`} />
                    </div>
                    {ds.warnings?.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {ds.warnings.map((w: string, i: number) => (
                                <p key={i} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[10px] text-amber-600 dark:text-amber-400">{w}</p>
                            ))}
                        </div>
                    )}
                    <p className="mt-2 text-[9px] text-slate-400">{ds.env.note} Screening per the engine deepSeaCooling dataset — not a marine engineering design.</p>
                </Card>
            ) : (
                <Card>
                    <p className="text-[11px] text-slate-500">
                        {!engineReadyCdu ? 'Engine is still loading — the marine section appears when ready. ' : ''}Deep Sea Water Cooling is <b>{capexInputs.deepSea ? 'enabled (waiting for engine)' : 'off'}</b> — enable it in
                        <button onClick={() => useSimulationStore.getState().actions.setActiveTab('requirements' as never)} className="mx-1 text-rz-mint hover:text-rz-mint/80">Requirements 1.6</button>
                        or the CAPEX assumptions to unlock the advanced marine section (intake temp @ depth, seawater flow, pump energy, chiller-less PUE, marine capex/opex).
                    </p>
                </Card>
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
    `rounded-md border px-1.5 py-1 text-[11px] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 ${user ? 'border-rz-mint/60' : 'border-slate-200 dark:border-slate-700'}`;

function SpProvChip({ prov }: { prov: Provenance }) {
    if (prov === 'engine') return <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Engine data (IEEE-493 typical)" />;
    if (prov === 'user') return <span className="rounded px-1 py-px text-[9px] font-semibold bg-rz-mint/15 text-rz-mint" title="User override">user</span>;
    return <span className="rounded px-1 py-px text-[9px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-300" title="Screening assumption — overridable">scr</span>;
}

export function SparesDashboard() {
    const { inputs, country } = useCfg();
    const rackKw = useRequirementsStore((s) => s.workload.avgRackDensityKw);
    const [ov, setOv] = React.useState<SparesOverrides>({});
    const [busy, setBusy] = React.useState(false);
    /* diagnostics panel — fill-below-target or Critical-class guidance per class */
    const [spDiag, setSpDiag] = React.useState<{ kind: 'fill' | 'crit'; key: SparesClassKey } | null>(null);
    const bucket = densityToEngineBucket(rackKw);
    const engineReadySp = useEngineReady();
    const res = React.useMemo(
        () => computeSpares({ itLoadKw: inputs.itLoad, densityBucket: bucket, countryId: country?.id, overrides: ov }),
        [inputs.itLoad, bucket, country?.id, ov, engineReadySp],
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

    const belowRows = rows.filter(spFillBelow);
    const report = (): StandardReport => ({
        title: 'Spares Optimization',
        layer: 'Layer 9 · models.spares (newsvendor)',
        project: country?.name || '—',
        kpis: [
            { label: 'Recommended Stock Value', value: money(totals.inventoryValue), sub: totals.inventoryValue === 0 ? 'all Q*=0 — ROP covers the low failure demand at this fleet size' : 'Σ Q* × unit cost' },
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
        assessment: buildAssessment('spares', { fillRatePct: totals.weightedFillPct, classesAtRisk: totals.belowTarget }),
        actions: buildActions('spares', { fillRatePct: totals.weightedFillPct, classesAtRisk: totals.belowTarget }),
        summaryBand: [
            { label: 'Stock Value', value: money(totals.inventoryValue) },
            { label: 'Annual Cost', value: money(totals.annualCost) },
            { label: 'Fill Rate', value: `${totals.weightedFillPct}%` },
            { label: 'Below Target', value: String(totals.belowTarget) },
            { label: 'Classes', value: String(rows.length) },
        ],
        note: 'MTBF/MTTR are IEEE-493 typical figures from the shared engine (DATA.reliability). Unit costs and lead times are screening-grade assumptions, user-overridable per class. Newsvendor critical-fractile output is a planning heuristic — not an inventory policy or a vendor-quoted spares program.',
    });
    const onExport = async () => { setBusy(true); try { await generatePillarPDF(report()); } finally { setBusy(false); } };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-rz-data/10 border border-rz-data/30 flex items-center justify-center"><Package className="w-6 h-6 text-rz-data" /></div>
                    <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Spares Optimization</h1><p className="text-sm text-slate-500 dark:text-slate-400">DC-OS · models.spares (newsvendor, per equipment class)</p></div>
                </div>
                <button onClick={onExport} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-cyan-700 text-white text-xs font-medium transition-colors disabled:opacity-60">
                    <FileDown className="w-3.5 h-3.5" />{busy ? 'Generating…' : 'Generate Report'}
                </button>
            </div>
            {/* audit #9 — assessment on-page (bukan cuma PDF) */}
            {(() => {
                const met = { fillRatePct: totals.weightedFillPct, classesAtRisk: totals.belowTarget };
                const assess = buildAssessment('spares', met);
                const acts = buildActions('spares', met);
                return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900/50 p-3">
                        <div className="flex flex-wrap items-start gap-3">
                            <div className="shrink-0 rounded-lg px-3 py-1.5 text-center text-white" style={{ background: assess.color }}>
                                <div className="text-[9px] uppercase opacity-80">Spares</div>
                                <div className="text-sm font-bold">{assess.label}</div>
                            </div>
                            <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{assess.narrative}</p>
                        </div>
                        <div className="mt-2 space-y-1">
                            {acts.slice(0, 2).map((a, i) => (
                                <div key={i} className="flex items-start gap-2 text-[10.5px] text-slate-600 dark:text-slate-300">
                                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8.5px] font-bold text-white ${a.priority === 'HIGH' ? 'bg-red-600' : a.priority === 'MEDIUM' ? 'bg-amber-600' : 'bg-emerald-600'}`}>{a.priority}</span>
                                    <span>{a.action}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric label="Recommended Stock Value" value={money(totals.inventoryValue)} sub={totals.inventoryValue === 0 ? "all Q*=0 — ROP covers demand at this fleet size" : "Σ Q* × unit cost"} />
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
                                <th className="py-1.5 pr-3 font-medium text-rz-mint">Unit cost</th>
                                <th className="py-1.5 pr-3 font-medium text-rz-mint">Lead wk</th>
                                <th className="py-1.5 font-medium text-rz-mint">Fill target</th>
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
                                const below = spFillBelow(r);
                                return (
                                    <tr key={k} className="border-b border-slate-100 dark:border-slate-800/60 align-top">
                                        <td className="py-2 pr-3">
                                            <div className="font-medium text-slate-800 dark:text-slate-100">{r.label}</div>
                                            {r.criticality === 'Critical'
                                                ? <button type="button"
                                                    onClick={() => setSpDiag((d) => d?.kind === 'crit' && d.key === k ? null : { kind: 'crit', key: k })}
                                                    title={`Critical class — click for measured spare/MTTR levers (models.spares + DATA.reliability)`}
                                                    className="rounded px-1 py-px text-[9px] font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-300 cursor-pointer underline decoration-dotted underline-offset-2">Critical</button>
                                                : <span className="rounded px-1 py-px text-[9px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-300">{r.criticality}</span>}
                                        </td>
                                        <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{r.fleet}×</td>
                                        <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300"><span className="inline-flex items-center gap-1.5">{r.mtbf.toLocaleString()}<SpProvChip prov={r.prov.mtbf} /></span></td>
                                        <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{r.demandYr}</td>
                                        <td className="py-2 pr-3 tabular-nums font-semibold text-slate-800 dark:text-slate-100">{r.qStar}</td>
                                        <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{r.rop}</td>
                                        <td className="py-2 pr-3 tabular-nums text-slate-600 dark:text-slate-300">{r.safetyStock}</td>
                                        <td className="py-2 pr-3 tabular-nums">
                                            <span
                                                className={below ? 'text-rose-500 font-semibold cursor-pointer underline decoration-dotted underline-offset-2' : 'text-slate-600 dark:text-slate-300'}
                                                title={below ? `Fill ${(r.fillAchieved * 100).toFixed(1)}% < target ${r.fillTargetPct}% — click for measured levers (Q* / lead time) from the same spares adapter` : undefined}
                                                onClick={below ? () => setSpDiag((d) => d?.kind === 'fill' && d.key === k ? null : { kind: 'fill', key: k }) : undefined}
                                            >{(r.fillAchieved * 100).toFixed(1)}%</span>
                                            {r.usedPoissonMode && <span className="ml-1 rounded px-1 py-px text-[9px] font-semibold bg-rz-mint/15 text-rz-mint" title="Low-demand mover — Poisson CDF">Poisson</span>}
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
                                                    className="mt-1 w-24 rounded-md border border-rz-mint/60 bg-white dark:bg-slate-800 px-1.5 py-1 text-[11px] tabular-nums text-slate-700 dark:text-slate-200" />
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
                {/* Diagnostics panel — reason + measured levers from the SAME adapter/engine
                  * (spNewsvendorRerun kernels for the +Q* lever · computeSpares discrete
                  * re-runs for the lead lever). Self-heals when the metric recovers. */}
                {spDiag && (() => {
                    const r = rows.find((x) => x.classKey === spDiag.key);
                    if (!r) return null;
                    if (spDiag.kind === 'fill' && !spFillBelow(r)) return null; // recovered → panel disappears with the rose cell
                    const er = spNewsvendorRerun(r);
                    const target = r.fillTargetPct / 100;
                    const fillPct = (f: number) => `${(f * 100).toFixed(1)}%`;
                    /* Lever A — raise Q* by the smallest +N that reaches the target,
                     * fill(q) via the engine kernels at the engine's own muLT/sigLT. */
                    let addN: number | null = null;
                    if (er) { for (let n = 1; n <= SP_QSTAR_SEARCH_MAX; n++) { if (er.fillAt(r.qStar + n) >= target) { addN = n; break; } } }
                    /* Lever B — shorten lead time: discrete computeSpares re-runs over the
                     * page's own lead options, smallest change first (largest weeks < current). */
                    const leadRerun = (w: number) => computeSpares({
                        itLoadKw: inputs.itLoad, densityBucket: bucket, countryId: country?.id,
                        overrides: { ...ov, [r.classKey]: { ...ov[r.classKey], leadWeeks: w } },
                    }).rows.find((x) => x.classKey === r.classKey);
                    const leadOpts = SP_LEAD_OPTIONS.filter((w) => w < r.leadWeeks).sort((a, b) => b - a);
                    let leadHit: { weeks: number; row: SparesRow } | null = null;
                    let leadFloor: { weeks: number; row: SparesRow } | null = null; // shortest tried option (honest-unreachable)
                    for (const w of leadOpts) {
                        const rr = leadRerun(w);
                        if (!rr) continue;
                        if (!spFillBelow(rr)) { leadHit = { weeks: w, row: rr }; break; }
                        leadFloor = { weeks: w, row: rr };
                    }
                    const leverBtn = 'flex w-full items-start gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 p-2 text-left';
                    const leverChip = 'mt-0.5 shrink-0 rounded bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-blue-700 dark:text-blue-300';
                    const leverTxt = 'flex-1 text-[10.5px] leading-snug text-slate-600 dark:text-slate-400';
                    return (
                        <div className="mt-2 rounded-lg border border-rose-300 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/20 p-2.5">
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                                    {spDiag.kind === 'fill' ? (
                                        <>
                                            <b>{r.label}</b> fill <b className="tabular-nums">{fillPct(r.fillAchieved)}</b> &lt; target <b className="tabular-nums">{r.fillTargetPct}%</b> (gap {((target - r.fillAchieved) * 100).toFixed(1)} pp).
                                            {' '}Newsvendor locks Q* = {r.qStar} at CR {(r.cr * 100).toFixed(1)}% (Cu {money(UNDERSTOCK_COST_SCREENING[r.criticality])}/event vs Co carry) — CR is below the fill target, so the cost-optimal stock does not reach the service level.
                                            {er && <> Lead-time demand μLT = {er.muLT} ({er.usedPoissonMode ? 'Poisson' : 'Normal'} mode, lead {r.leadWeeks} wk).</>}
                                        </>
                                    ) : (
                                        <>
                                            <b>{r.label}</b> is a <b>Critical</b> class (fill target {r.fillTargetPct}%, understock {money(UNDERSTOCK_COST_SCREENING[r.criticality])}/event): fleet {r.fleet}× · MTBF {r.mtbf.toLocaleString()} h → expected <b className="tabular-nums">{r.demandYr}</b> failures/yr (DATA.reliability IEEE-493).
                                            {' '}With a spare on the shelf, restore ≈ MTTR <b className="tabular-nums">{r.mttr} h</b>; without stock, demand waits the procurement lead <b className="tabular-nums">{r.leadWeeks} wk ≈ {(r.leadWeeks * 168).toLocaleString()} h</b> (~{Math.round((r.leadWeeks * 168) / Math.max(r.mttr, 1)).toLocaleString()}× longer).
                                            {' '}Current position: Q* {r.qStar} → fill {fillPct(r.fillAchieved)}, uncovered ≈ {(r.demandYr * (1 - r.fillAchieved)).toFixed(2)} event/yr.
                                        </>
                                    )}
                                </p>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    {er && (er.parity
                                        ? <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-500" title="Re-running models.spares.newsvendor reproduces the rendered Q* + fill">≡ engine</span>
                                        : <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-bold text-amber-500" title="Engine re-run does not exactly reproduce the row — check adapter drift">⚠ drift</span>)}
                                    <button type="button" onClick={() => setSpDiag(null)}
                                        className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Close ✕</button>
                                </div>
                            </div>
                            <div className="mt-2">
                                <div className="mb-1.5 text-[10px] font-semibold uppercase text-slate-500">Measured levers (same model)</div>
                                <div className="space-y-1.5">
                                    {/* Lever A — Q* / stock position (engine kernels) */}
                                    {er ? (
                                        spDiag.kind === 'crit' && r.qStar === 0 ? (
                                            <div className={leverBtn}>
                                                <span className={leverChip}>Stock 1 unit</span>
                                                <span className={leverTxt}>Stock 1 spare (+{money(r.unitCost)} unit cost {r.prov.unitCost === 'engine' ? 'DATA.sparesPricing' : r.prov.unitCost}) → fill {fillPct(er.fillAt(1))} from {fillPct(er.fillAt(0))}; a covered-stockout restore drops from the {r.leadWeeks} wk lead to MTTR {r.mttr} h.</span>
                                            </div>
                                        ) : addN != null ? (
                                            <div className={leverBtn}>
                                                <span className={leverChip}>Q* +{addN} unit</span>
                                                <span className={leverTxt}>Raise stock {r.qStar} → {r.qStar + addN} units → fill <b className="tabular-nums">{fillPct(er.fillAt(r.qStar + addN))}</b> ≥ target {r.fillTargetPct}% · stock cost +<b>{money(addN * r.unitCost)}</b> ({addN} × {money(r.unitCost)} unit cost, {r.prov.unitCost === 'engine' ? 'DATA.sparesPricing mid' : r.prov.unitCost}); carrying ≈ +{money(addN * r.unitCost * CARRY_RATE_PCT / 100)}/yr ({CARRY_RATE_PCT}%/yr).</span>
                                            </div>
                                        ) : (
                                            /* honest-unreachable within the search bound */
                                            <div className={leverBtn}>
                                                <span className={leverChip}>Q* alone is not enough</span>
                                                <span className={leverTxt}>Even +{SP_QSTAR_SEARCH_MAX} units only brings fill to {fillPct(er.fillAt(r.qStar + SP_QSTAR_SEARCH_MAX))} — the lead-time demand is too large; combine with a shorter lead time.</span>
                                            </div>
                                        )
                                    ) : (
                                        <div className={leverBtn}><span className={leverTxt}>Engine kernels not available yet — the Q* lever appears once rz-engine is ready.</span></div>
                                    )}
                                    {/* Lever B — shorten lead time (adapter re-run, apply-able) */}
                                    {leadHit ? (
                                        <button type="button" onClick={() => patchOv(r.classKey, { leadWeeks: leadHit.weeks })}
                                            title="Apply as this class's lead-time override (Lead wk column)"
                                            className={`${leverBtn} group transition-colors hover:border-blue-400 dark:hover:border-blue-500`}>
                                            <span className={leverChip}>Lead {r.leadWeeks} → {leadHit.weeks} wk</span>
                                            <span className={leverTxt}>Shorten lead time to {leadHit.weeks} wk (vendor stocking/consignment contract) → adapter re-run: fill <b className="tabular-nums">{fillPct(leadHit.row.fillAchieved)}</b> ≥ target, Q* {leadHit.row.qStar}, annual cost {money(leadHit.row.annualCost)} (vs {money(r.annualCost)}). Click to apply the override.</span>
                                            <span className="mt-0.5 shrink-0 text-[9px] font-semibold text-slate-400 group-hover:text-blue-500">apply →</span>
                                        </button>
                                    ) : leadFloor ? (
                                        /* honest-unreachable: even the shortest lead option misses the target */
                                        <div className={leverBtn}>
                                            <span className={leverChip}>Lead alone is not enough</span>
                                            <span className={leverTxt}>Even a {leadFloor.weeks} wk lead only brings fill to {fillPct(leadFloor.row.fillAchieved)} (Q* {leadFloor.row.qStar}) — combine with the extra stock above.</span>
                                        </div>
                                    ) : (
                                        <div className={leverBtn}>
                                            <span className={leverChip}>Minimum lead</span>
                                            <span className={leverTxt}>The {r.leadWeeks} wk lead is already the shortest option on this page — the remaining gap is driven by stock (the Q* lever above), not procurement.</span>
                                        </div>
                                    )}
                                    {/* Navigation ↗ ke surface maintenance (MTTR/SLA levers hidup di sana) */}
                                    <button type="button" onClick={() => useSimulationStore.getState().actions.setActiveTab('maint')}
                                        className={`${leverBtn} group transition-colors hover:border-blue-400 dark:hover:border-blue-500`}>
                                        <span className={leverChip}>Maintenance ↗</span>
                                        <span className={leverTxt}>MTTR {r.mttr} h is engine data (IEEE-493) — response/SLA levers & maintenance strategy are analyzed with measured detail in Maintenance › Spares/SLA.</span>
                                        <span className="mt-0.5 shrink-0 text-[9px] font-semibold text-slate-400 group-hover:text-blue-500">open →</span>
                                    </button>
                                </div>
                            </div>
                            <p className="mt-1.5 text-[9px] text-slate-400">All figures from the same computeSpares adapter + models.spares kernels as the table (μLT/σLT/fill from the engine; cost from per-row unit cost). Screening heuristic — not an inventory policy.</p>
                        </div>
                    );
                })()}
                <p className="mt-2 text-[10px] text-slate-500"><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />engine data (IEEE-493) · <span className="rounded px-1 py-px text-[9px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-300">scr</span> screening assumption · <span className="rounded px-1 py-px text-[9px] font-semibold bg-rz-mint/15 text-rz-mint">user</span> your override. Fleet from commissioning.equipScale ({bucket} density, {inputs.itLoad.toLocaleString()} kW IT).</p>
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
