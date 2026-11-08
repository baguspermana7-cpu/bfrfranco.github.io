/* ─── Cx SCHEDULE STORE (Tier 2, WI-CX-SUPERAPP-001) ─────────────────────────
 * The editable plan layer over the engine's programRich: per-level overrides
 * (start / months / crew / shift), a site crew cap, the viewed month, and up to
 * five NAMED scenarios (owner default (c), PRD v1.1 §38). Overrides are clamped
 * by the SAME sanitize as cx-calculator.html (lib/cx-plan.ts bridge), persisted
 * as a versioned payload (cxTracking.ts idiom), never silently on failure.
 * ──────────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';
import { sanitizeOverrides, type Overrides } from '../lib/cx-plan';

export interface CxScenario { id: string; name: string; overrides: Overrides; siteCrewCap: number | null; savedAt: string }

export interface CxScheduleState {
    overrides: Overrides;
    siteCrewCap: number | null;
    /** viewed month on the status table / schematic / 3D (M0 = programme start). */
    month: number;
    scenarios: CxScenario[];
    activeScenarioId: string | null;
    touched: boolean;
    persistFailed: boolean;
    actions: {
        setOverride: (level: string, patch: Record<string, unknown>) => void;
        clearOverride: (level: string) => void;
        setSiteCrewCap: (v: number | null) => void;
        setMonth: (m: number) => void;
        saveScenario: (name: string) => CxScenario | null;
        loadScenario: (id: string) => void;
        deleteScenario: (id: string) => void;
        reset: () => void;
    };
}

export const KEY = 'dcmoc_cx_schedule_v1';
export const SCENARIO_CAP = 5;
const CREW_CAP = [1, 1000] as const;

function cap(v: unknown): number | null {
    return typeof v === 'number' && Number.isFinite(v) && v >= CREW_CAP[0] && v <= CREW_CAP[1] ? Math.round(v) : null;
}
function month(v: unknown): number {
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 240 ? Math.round(v * 10) / 10 : 0;
}
function sanitizeScenarios(v: unknown): CxScenario[] {
    if (!Array.isArray(v)) return [];
    return v.filter((s) => s && typeof s === 'object' && typeof s.id === 'string' && typeof s.name === 'string')
        .slice(0, SCENARIO_CAP)
        .map((s) => ({ id: s.id, name: String(s.name).slice(0, 60), overrides: sanitizeOverrides(s.overrides), siteCrewCap: cap(s.siteCrewCap), savedAt: typeof s.savedAt === 'string' ? s.savedAt : '' }));
}

type Persisted = Pick<CxScheduleState, 'overrides' | 'siteCrewCap' | 'month' | 'scenarios' | 'activeScenarioId'>;

export function parsePersisted(raw: string | null): Persisted | null {
    if (!raw) return null;
    try {
        const p = JSON.parse(raw);
        if (p == null || typeof p !== 'object' || Array.isArray(p) || p.version !== 1) return null;
        return { overrides: sanitizeOverrides(p.overrides), siteCrewCap: cap(p.siteCrewCap), month: month(p.month), scenarios: sanitizeScenarios(p.scenarios), activeScenarioId: typeof p.activeScenarioId === 'string' ? p.activeScenarioId : null };
    } catch { return null; }
}

function load(): Persisted | null {
    if (typeof window === 'undefined') return null;
    try { return parsePersisted(localStorage.getItem(KEY)); } catch { return null; }
}

let seq = 0;                                   /* two saves in one millisecond must not share an id */
const EMPTY: Persisted = { overrides: {}, siteCrewCap: null, month: 0, scenarios: [], activeScenarioId: null };

export const useCxSchedule = create<CxScheduleState>((set, get) => {
    const persisted = load();
    const commit = (p: Partial<CxScheduleState>) => {
        set({ ...p, touched: true });
        try {
            const { actions: _a, persistFailed: _pf, touched: _t, ...rest } = get();
            localStorage.setItem(KEY, JSON.stringify({ version: 1, ...rest }));
            if (get().persistFailed) set({ persistFailed: false });
        } catch (e) {
            if (!get().persistFailed) {
                set({ persistFailed: true });
                if (process.env.NODE_ENV !== 'production') console.warn('[cxSchedule] localStorage persist failed — changes are in-memory only', e);
            }
        }
    };
    return {
        ...EMPTY, ...(persisted ?? {}), touched: false, persistFailed: false,
        actions: {
            setOverride: (level, patch) => {
                /* an out-of-range field in the patch is REFUSED and the previous value kept (the site's plan editor rule),
                 * so a typo never silently resets a level to its baseline */
                const cur = get().overrides as Record<string, Record<string, unknown>>;
                const clean = (sanitizeOverrides({ [level]: patch }) as Record<string, Record<string, unknown>>)[level] ?? {};
                const next = sanitizeOverrides({ ...cur, [level]: { ...(cur[level] ?? {}), ...clean } });
                commit({ overrides: next });
            },
            clearOverride: (level) => { const cur = { ...(get().overrides as Record<string, unknown>) }; delete cur[level]; commit({ overrides: sanitizeOverrides(cur) }); },
            setSiteCrewCap: (v) => commit({ siteCrewCap: cap(v) }),
            setMonth: (m) => commit({ month: month(m) }),
            saveScenario: (name) => {
                const s = get(); const trimmed = String(name ?? '').trim().slice(0, 60);
                if (!trimmed || s.scenarios.length >= SCENARIO_CAP) return null;
                const sc: CxScenario = { id: 'sc-' + Date.now().toString(36) + '-' + (++seq).toString(36), name: trimmed, overrides: sanitizeOverrides(s.overrides), siteCrewCap: s.siteCrewCap, savedAt: new Date().toISOString() };
                commit({ scenarios: [...s.scenarios, sc], activeScenarioId: sc.id });
                return sc;
            },
            loadScenario: (id) => { const sc = get().scenarios.find((x) => x.id === id); if (sc) commit({ overrides: sanitizeOverrides(sc.overrides), siteCrewCap: sc.siteCrewCap, activeScenarioId: sc.id }); },
            deleteScenario: (id) => { const s = get(); commit({ scenarios: s.scenarios.filter((x) => x.id !== id), activeScenarioId: s.activeScenarioId === id ? null : s.activeScenarioId }); },
            reset: () => { set({ ...EMPTY, touched: false }); try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ } },
        },
    };
});
