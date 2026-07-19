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
}

const sim = () => useSimulationStore.getState();
const cap = () => useCapexStore.getState();
const req = () => useRequirementsStore.getState();

const pueLive = (): number | null => {
    const m = (rzData() as { pueMatrix?: Record<string, Record<string, number>> }).pueMatrix;
    return m?.[sim().inputs.coolingType]?.['tier' + sim().inputs.tierLevel] ?? null;
};

export const TRACE: Record<string, TraceNode> = {
    /* ── LEAF INPUTS (titik paling ujung — user-owned) ── */
    'sim.itLoad': { label: 'IT Load', page: 'requirements', unit: 'kW', provenance: 'input', get: () => sim().inputs.itLoad },
    'sim.tierLevel': { label: 'Tier Level', page: 'requirements', provenance: 'input', get: () => sim().inputs.tierLevel },
    'sim.electricityRate': { label: 'Electricity Tariff (country)', page: 'requirements', unit: '$/kWh', provenance: 'input', get: () => sim().selectedCountry?.economy.electricityRate ?? null },
    'req.designMarginPct': { label: 'Design Margin', page: 'requirements', unit: '%', provenance: 'input', get: () => req().business.designMarginPct ?? 10 },
    'capex.contingencyPct': { label: 'Contingency %', page: 'capex', unit: '%', provenance: 'input', get: () => cap().inputs.contingency },

    /* ── ENGINE LEAVES (DATA constants — provenance via DATA.sources) ── */
    'engine.pueMatrix': { label: 'Design PUE (matrix[cooling][tier])', page: 'architecture', unit: 'ratio', provenance: 'engine', sourceKey: 'pueMatrix', get: pueLive },
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
    return { id, label: n.label, page: n.page, unit: n.unit, provenance: n.provenance, value, formulaLive, sourceKey: n.sourceKey, children };
}

/** All ids (for gates + Knowledge Base live-trace rendering). */
export const TRACE_IDS = Object.keys(TRACE);
export { rzModels };
