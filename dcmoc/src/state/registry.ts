/* ─── DC-OS PARAMETER REGISTRY (Phase 0 — Global State Blueprint) ────────────
 * Thin, named, validated parameter layer OVER the existing zustand slices.
 * The slices (simulation / capex / scenario / …) REMAIN the canonical sources
 * of truth — 40+ dashboards subscribe to them directly and keep working.
 * The registry adds:
 *   • a unique namespaced id per cross-engine parameter (`engine.param`),
 *   • ONE sanitizing write chokepoint (clamp + enum-whitelist + default),
 *   • non-React access for adapters/presets (get/set) and
 *   • React subscription per param (useValue) so components re-render
 *     exactly when their inputs change (the render graph IS the tracker —
 *     see dependencies.ts for the explicit DEP_MAP contract).
 * Engine (rz-engine.js) is NEVER touched from here.
 * ──────────────────────────────────────────────────────────────────────── */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';

/* ── sanitizers (STEP 2/3: parseFloat || default, clamp, whitelist) ── */

export function sanitizeNum(v: unknown, min: number, max: number, dflt: number): number {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    if (!Number.isFinite(n)) return dflt;
    return Math.min(max, Math.max(min, n));
}

export function coerceEnum<T extends string>(v: unknown, allowed: readonly T[], dflt: T): T {
    return allowed.includes(v as T) ? (v as T) : dflt;
}

/* ── param ids (namespaced `engine.param`) ── */

export type ParamId =
    // simulation slice (canonical shared inputs)
    | 'sim.itLoad'            // kW
    | 'sim.tierLevel'         // 2|3|4
    | 'sim.coolingType'       // air|inrow|rdhx|liquid
    | 'sim.powerRedundancy'   // N+1|2N|2N+1
    | 'sim.buildingSize'      // m²
    | 'sim.baseYear'
    | 'sim.shiftModel'        // 8h|12h
    // capex slice
    | 'capex.redundancy'      // n|n1|2n|2n1
    | 'capex.fuelHours'
    | 'capex.contingency'     // % — WIRED to req.designMarginPct
    | 'capex.designFee'
    | 'capex.pmFee'
    | 'capex.projYear'
    | 'capex.rackType'        // standard|medium|high|ai
    // requirements slice (lazy provider until store lands — Phase A)
    | 'req.gridVoltage'
    | 'req.useCase'
    | 'req.avgRackDensityKw'
    | 'req.designMarginPct';  // owner: margin flows to cost/financial

type Provider = {
    get: (key: string) => unknown | undefined;
    set: (key: string, v: unknown) => void;
    /** React hook subscription; must be a stable hook per key. */
    useValue: (key: string, dflt: unknown) => unknown;
};

/* Requirements store lands in Phase A; until then the registry degrades to
 * defaults (STEP 3: gentle degradation, never crash). Phase A calls
 * registerReqProvider() once at store-module import time. */
let reqProvider: Provider | null = null;
export function registerReqProvider(p: Provider): void { reqProvider = p; }
export function hasReqProvider(): boolean { return !!reqProvider; }

export interface ParamDescriptor<T = any> {
    id: ParamId;
    label: string;
    unit?: string;
    kind: 'number' | 'enum';
    enumValues?: readonly string[];
    min?: number;
    max?: number;
    defaultValue: T;
    get: () => T;
    set: (v: T) => void;
    useValue: () => T;
}

const COOLING = ['air', 'inrow', 'rdhx', 'liquid'] as const;
const REDUNDANCY_UI = ['N+1', '2N', '2N+1'] as const;
const REDUNDANCY_CAPEX = ['n', 'n1', '2n', '2n1'] as const;
const RACK_TYPES = ['standard', 'medium', 'high', 'ai'] as const;
const GRID_VOLTAGES = ['11kV', '33kV', '132kV', '220kV'] as const;
const USE_CASES = ['ai', 'cloud', 'hpc', 'enterprise', 'network', 'dr'] as const;

/* Shared UI↔capex redundancy map — single home (moved from NewEngineDashboards). */
export const REDUNDANCY_KEY: Record<string, 'n1' | '2n' | '2n1'> = { 'N+1': 'n1', '2N': '2n', '2N+1': '2n1' };

function simGet() { return useSimulationStore.getState(); }
function capexGet() { return useCapexStore.getState(); }

/* Helper builders keep descriptors terse + consistent. */
function numParam(
    id: ParamId, label: string, unit: string, min: number, max: number, dflt: number,
    get: () => number, set: (v: number) => void, useValue: () => number,
): ParamDescriptor<number> {
    return {
        id, label, unit, kind: 'number', min, max, defaultValue: dflt,
        get: () => sanitizeNum(get(), min, max, dflt),
        set: (v) => set(sanitizeNum(v, min, max, dflt)),
        useValue,
    };
}
function enumParam<T extends string>(
    id: ParamId, label: string, values: readonly T[], dflt: T,
    get: () => T, set: (v: T) => void, useValue: () => T,
): ParamDescriptor<T> {
    return {
        id, label, kind: 'enum', enumValues: values, defaultValue: dflt,
        get: () => coerceEnum(get(), values, dflt),
        set: (v) => set(coerceEnum(v, values, dflt)),
        useValue,
    };
}

/* req.* params resolve through the lazy provider (defaults until Phase A). */
function reqNum(id: ParamId, key: string, label: string, unit: string, min: number, max: number, dflt: number): ParamDescriptor<number> {
    return numParam(id, label, unit, min, max, dflt,
        () => (reqProvider ? sanitizeNum(reqProvider.get(key), min, max, dflt) : dflt),
        (v) => { reqProvider?.set(key, v); },
        // eslint-disable-next-line react-hooks/rules-of-hooks
        () => (reqProvider ? (reqProvider.useValue(key, dflt) as number) : dflt));
}
function reqEnum<T extends string>(id: ParamId, key: string, label: string, values: readonly T[], dflt: T): ParamDescriptor<T> {
    return enumParam(id, label, values, dflt,
        () => (reqProvider ? coerceEnum(reqProvider.get(key), values, dflt) : dflt),
        (v) => { reqProvider?.set(key, v); },
        // eslint-disable-next-line react-hooks/rules-of-hooks
        () => (reqProvider ? (reqProvider.useValue(key, dflt) as T) : dflt));
}

export const REGISTRY: Record<ParamId, ParamDescriptor> = {
    'sim.itLoad': numParam('sim.itLoad', 'IT Load', 'kW', 100, 500_000, 2500,
        () => simGet().inputs.itLoad,
        (v) => simGet().actions.setInputs({ itLoad: v }),
        () => useSimulationStore((s) => s.inputs.itLoad)),

    'sim.tierLevel': {
        id: 'sim.tierLevel', label: 'Tier Level', kind: 'number', min: 2, max: 4, defaultValue: 3,
        get: () => simGet().inputs.tierLevel,
        set: (v) => simGet().actions.setTierLevel(sanitizeNum(v, 2, 4, 3) as 2 | 3 | 4),
        useValue: () => useSimulationStore((s) => s.inputs.tierLevel),
    } as ParamDescriptor<number>,

    'sim.coolingType': enumParam('sim.coolingType', 'Cooling Type', COOLING, 'air',
        () => simGet().inputs.coolingType,
        (v) => simGet().actions.setInputs({ coolingType: v }),
        () => useSimulationStore((s) => s.inputs.coolingType)),

    'sim.powerRedundancy': enumParam('sim.powerRedundancy', 'Power Redundancy', REDUNDANCY_UI, '2N',
        () => simGet().inputs.powerRedundancy,
        (v) => simGet().actions.setInputs({ powerRedundancy: v }),
        () => useSimulationStore((s) => s.inputs.powerRedundancy)),

    'sim.buildingSize': numParam('sim.buildingSize', 'Building Size', 'm²', 50, 200_000, 1500,
        () => simGet().inputs.buildingSize,
        (v) => simGet().actions.setInputs({ buildingSize: v }),
        () => useSimulationStore((s) => s.inputs.buildingSize)),

    'sim.baseYear': numParam('sim.baseYear', 'Base Year', '', 2020, 2050, 2025,
        () => simGet().inputs.baseYear,
        (v) => simGet().actions.setInputs({ baseYear: v }),
        () => useSimulationStore((s) => s.inputs.baseYear)),

    'sim.shiftModel': enumParam('sim.shiftModel', 'Shift Model', ['8h', '12h'] as const, '8h',
        () => simGet().inputs.shiftModel,
        (v) => simGet().actions.setInputs({ shiftModel: v }),
        () => useSimulationStore((s) => s.inputs.shiftModel)),

    'capex.redundancy': enumParam('capex.redundancy', 'CAPEX Redundancy', REDUNDANCY_CAPEX, 'n1',
        () => capexGet().inputs.redundancy as any,
        (v) => capexGet().setInputs({ redundancy: v }),
        () => useCapexStore((s) => s.inputs.redundancy as any)),

    'capex.fuelHours': numParam('capex.fuelHours', 'Fuel Autonomy', 'h', 8, 168, 48,
        () => capexGet().inputs.fuelHours,
        (v) => capexGet().setInputs({ fuelHours: v }),
        () => useCapexStore((s) => s.inputs.fuelHours)),

    'capex.contingency': numParam('capex.contingency', 'Contingency', '%', 0, 30, 10,
        () => capexGet().inputs.contingency,
        (v) => capexGet().setInputs({ contingency: v }),
        () => useCapexStore((s) => s.inputs.contingency)),

    'capex.designFee': numParam('capex.designFee', 'Design Fee', '%', 0, 20, 8,
        () => capexGet().inputs.designFee,
        (v) => capexGet().setInputs({ designFee: v }),
        () => useCapexStore((s) => s.inputs.designFee)),

    'capex.pmFee': numParam('capex.pmFee', 'PM Fee', '%', 0, 15, 5,
        () => capexGet().inputs.pmFee,
        (v) => capexGet().setInputs({ pmFee: v }),
        () => useCapexStore((s) => s.inputs.pmFee)),

    'capex.projYear': {
        id: 'capex.projYear', label: 'Project Year', kind: 'enum',
        enumValues: ['2024', '2025', '2026', '2027'] as const, defaultValue: '2025',
        get: () => capexGet().inputs.projYear,
        set: (v) => capexGet().setInputs({ projYear: coerceEnum(v, ['2024', '2025', '2026', '2027'] as const, '2025') }),
        useValue: () => useCapexStore((s) => s.inputs.projYear),
    } as ParamDescriptor<string>,

    'capex.rackType': enumParam('capex.rackType', 'Rack Density Class', RACK_TYPES, 'standard',
        () => capexGet().inputs.rackType as any,
        (v) => capexGet().setInputs({ rackType: v }),
        () => useCapexStore((s) => s.inputs.rackType as any)),

    'req.gridVoltage': reqEnum('req.gridVoltage', 'gridVoltage', 'Grid Voltage', GRID_VOLTAGES, '33kV'),
    'req.useCase': reqEnum('req.useCase', 'useCase', 'Primary Use Case', USE_CASES, 'ai'),
    'req.avgRackDensityKw': reqNum('req.avgRackDensityKw', 'avgRackDensityKw', 'Avg Rack Density', 'kW/rack', 1, 200, 12),
    /* Owner mandate: margin is WIRED — its setter ALSO writes capex.contingency
     * so the investment cost moves (capex auto-recalcs on setInputs). */
    'req.designMarginPct': (() => {
        const base = reqNum('req.designMarginPct', 'designMarginPct', 'Design Margin', '%', 0, 30, 10);
        const origSet = base.set;
        base.set = (v: number) => {
            origSet(v);
            capexGet().setInputs({ contingency: sanitizeNum(v, 0, 30, 10) });
        };
        return base;
    })(),
};

/* ── typed access helpers ── */

export function getParam<T = any>(id: ParamId): T {
    return REGISTRY[id].get() as T;
}
export function setParam<T = any>(id: ParamId, v: T): void {
    REGISTRY[id].set(v);
}
export function useParam<T = any>(id: ParamId): [T, (v: T) => void] {
    const d = REGISTRY[id];
    const value = d.useValue() as T;
    return [value, d.set as (v: T) => void];
}
