/* ─── LAYER 0 · MASTER ORCHESTRATOR — DIGITAL THREAD DAG ──────────────────────
 * The declarative dependency graph that makes DC-OS "change one → recompute all
 * dependents". A change to a master input (e.g. IT load 10MW → 15MW) auto-
 * triggers the Power/Cooling/CAPEX/OPEX/Financial/Schedule/Risk/Capacity engines
 * in dependency order. Engine→engine edges (capex → financial) are included so
 * the recompute cascades transitively. Deterministic: fixed topological order.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { EngineId } from '../decision/types';

/** Master input fields that trigger recomputes (subset of simulation inputs). */
export type ThreadInput =
    | 'itLoad' | 'tierLevel' | 'coolingType' | 'region' | 'powerRedundancy'
    | 'occupancyRamp' | 'staffingModel';

/** Nodes = inputs + engines; edges = "when this changes, recompute these". */
export const DIGITAL_THREAD: Record<ThreadInput | EngineId, EngineId[]> = {
    // ── input → engines ──
    itLoad: ['capacity', 'architecture', 'capex', 'operations', 'sustainability', 'financial', 'reliability'],
    tierLevel: ['capex', 'operations', 'reliability', 'financial', 'architecture'],
    coolingType: ['architecture', 'capex', 'operations', 'sustainability'],
    region: ['site', 'capex', 'operations', 'sustainability', 'financial'],
    powerRedundancy: ['architecture', 'capex', 'reliability'],
    occupancyRamp: ['financial'],
    staffingModel: ['operations', 'financial'],
    // ── engine → engine ──
    requirements: ['site', 'capacity'],
    site: ['architecture', 'capex', 'financial'],
    architecture: ['capex', 'operations', 'reliability'],
    capacity: ['capex', 'operations', 'construction'],
    capex: ['financial', 'construction'],
    construction: ['commissioning', 'financial'],
    commissioning: ['operations'],
    operations: ['financial', 'sustainability'],
    asset: ['operations', 'financial'],
    reliability: ['financial'],
    sustainability: ['financial'],
    financial: ['decision'],
    decision: [],
};

/**
 * Transitive closure of engines to recompute when `changed` nodes change, in a
 * deterministic topological order (Kahn). Pure — no side effects.
 */
export function affectedEngines(changed: (ThreadInput | EngineId)[]): EngineId[] {
    // 1. gather all reachable engine nodes (BFS over the DAG)
    const reached = new Set<EngineId>();
    const queue: (ThreadInput | EngineId)[] = [...changed];
    while (queue.length) {
        const node = queue.shift()!;
        const outs = DIGITAL_THREAD[node] || [];
        for (const e of outs) {
            if (!reached.has(e)) { reached.add(e); queue.push(e); }
        }
    }
    // 2. topological sort of the reached subgraph (deterministic order)
    const indeg = new Map<EngineId, number>();
    reached.forEach((e) => indeg.set(e, 0));
    reached.forEach((e) => {
        (DIGITAL_THREAD[e] || []).forEach((t) => {
            if (reached.has(t)) indeg.set(t, (indeg.get(t) || 0) + 1);
        });
    });
    const order: EngineId[] = [];
    // stable seed: engines with no in-edges, in DIGITAL_THREAD declaration order
    const ready = [...reached].filter((e) => (indeg.get(e) || 0) === 0);
    while (ready.length) {
        const e = ready.shift()!;
        order.push(e);
        (DIGITAL_THREAD[e] || []).forEach((t) => {
            if (!reached.has(t)) return;
            const d = (indeg.get(t) || 0) - 1;
            indeg.set(t, d);
            if (d === 0) ready.push(t);
        });
    }
    // any remaining (would indicate a cycle) appended deterministically
    reached.forEach((e) => { if (!order.includes(e)) order.push(e); });
    return order;
}

/** True if the DAG is acyclic (asserted by the orchestrator unit test). */
export function isAcyclic(): boolean {
    const all = Object.keys(DIGITAL_THREAD) as (ThreadInput | EngineId)[];
    const color = new Map<string, 0 | 1 | 2>();
    const dfs = (n: string): boolean => {
        color.set(n, 1);
        for (const t of DIGITAL_THREAD[n as ThreadInput | EngineId] || []) {
            const c = color.get(t) || 0;
            if (c === 1) return false;
            if (c === 0 && !dfs(t)) return false;
        }
        color.set(n, 2);
        return true;
    };
    for (const n of all) {
        if ((color.get(n) || 0) === 0 && !dfs(n)) return false;
    }
    return true;
}
