/* ─── Cx PLAN BRIDGE (Tier 2, WI-CX-SUPERAPP-001) ────────────────────────────
 * The editable commissioning schedule layer (RZEngine.models.commissioning.programPlan)
 * and its per-system month status come from the SAME module the public site uses,
 * `js/rz-cx-plan.js` (RZCxPlan) — loaded in the browser by a defer <script> in
 * layout.tsx, in Node (prerender / gates) through a guarded eval('require'), the
 * rz-engine.ts idiom. Nothing is ported: one algorithm, two consumers, so the
 * DCMOC plan can never drift from cx-calculator.html's.
 * ──────────────────────────────────────────────────────────────────────── */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { getRZ } from './rz-engine';

export type LevelId = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
export type Shift = '1x8' | '2x12';
export interface LevelOverride { start?: number; months?: number; crew?: number; shift?: Shift }
export type Overrides = Partial<Record<LevelId, LevelOverride>>;
export interface PlanInput { itLoadKw: number; coolingType?: string; powerRedundancy?: string; countryId?: string; rackDensity?: string; [k: string]: unknown }
export interface PlanLevel { id: LevelId; start: number; end: number; months: number; crew?: number; cost?: number; mh?: number; [k: string]: unknown }
export interface Plan { levels: PlanLevel[]; finishMonth: number; totalCost?: number; totalMh?: number; [k: string]: unknown }
export interface StatusRow { id: string; label: string; block: string; level: LevelId | null; tag: string | null; next: LevelId | null; inTest: boolean; changed: boolean; gates: Record<string, number | null> }
export interface Status { month: number; systems: StatusRow[]; counts: Record<string, number>; finishMonth: number }

let cached: any = null;
let nodeResolved = false;

function loadNodePlan(): any {
    try {
        // eslint-disable-next-line no-eval
        const req = eval('require');
        const path = req('path');
        const fs = req('fs');
        const candidates = [path.resolve(process.cwd(), '..', 'js', 'rz-cx-plan.js'), path.resolve(process.cwd(), 'js', 'rz-cx-plan.js')];
        for (const p of candidates) {
            if (!fs.existsSync(p)) continue;
            // the module reads root.RZEngine for compute(); give it the same engine the bridge resolved
            const g = globalThis as any;
            if (!g.RZEngine) g.RZEngine = getRZ();
            const m = req(p);
            // in CommonJS the module's `root` is module.exports itself, so hand it the engine there too
            if (m && !m.RZEngine) m.RZEngine = getRZ();
            return m;
        }
        return null;
    } catch {
        return null;
    }
}

/** The shared RZCxPlan object, or null when unavailable (callers keep a null path). */
export function getCxPlan(): any {
    if (typeof window !== 'undefined') {
        if (!cached) cached = (window as any).RZCxPlan ?? null;
        return cached;
    }
    if (!nodeResolved) { cached = loadNodePlan(); nodeResolved = true; }
    return cached;
}

/** Clamp owner overrides exactly as the site does (LIMITS: start 0–120, months 0.1–60, crew 0.5–200, shift 1x8|2x12). */
export function sanitizeOverrides(o: unknown): Overrides {
    const P = getCxPlan();
    return P && typeof P.sanitize === 'function' ? (P.sanitize(o) as Overrides) : {};
}

/** programPlan through the shared module; null when the engine or module is absent. */
export function computePlan(input: PlanInput, overrides?: Overrides): Plan | null {
    const P = getCxPlan();
    if (P && typeof P.compute === 'function') { const r = P.compute(input, overrides ?? {}); if (r) return r as Plan; }
    const C = getRZ()?.models?.commissioning;
    if (C && typeof C.programPlan === 'function') { try { return C.programPlan(input, sanitizeOverrides(overrides)) as Plan; } catch { return null; } }
    return null;
}

/** Per-system level / tag / next / inTest at month m (handbook 02.6 rule: the tag follows the signed gate). */
export function statusAt(plan: Plan | null, month: number): Status | null {
    const P = getCxPlan();
    if (!plan || !P || typeof P.statusAt !== 'function') return null;
    return P.statusAt(plan, month) as Status | null;
}

export function planSystems(): Array<{ id: string; label: string; block: string }> {
    const P = getCxPlan();
    return P && Array.isArray(P.SYSTEMS) ? P.SYSTEMS.map((s: any) => ({ id: s.id, label: s.label, block: s.block })) : [];
}

export function planLevels(): Array<{ id: LevelId; label: string; primary: boolean; tag?: string }> {
    const P = getCxPlan();
    return P && Array.isArray(P.LEVELS) ? P.LEVELS.map((l: any) => ({ id: l.id, label: l.label, primary: !!l.primary, tag: l.tag })) : [];
}
