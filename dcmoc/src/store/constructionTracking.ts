/* ─── CONSTRUCTION TRACKING STORE (Phase F) ──────────────────────────────────
 * ACTUALS plane — user-entered only (planning tool has no site telemetry).
 * statusDate === null && no actuals ⇒ PLAN MODE (actuals ≡ plan, SPI/CPI 1.00).
 * localStorage pattern mirrors scenario.ts. Seeds are EMPTY except risks/
 * issues examples (isExample chips). CPI/SPI derived here are THE single
 * source consumed by the Financial page.
 * ──────────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';

export interface TrackedRisk { id: string; risk: string; impact: 'low' | 'medium' | 'high'; probability: 'low' | 'medium' | 'high'; status: 'open' | 'mitigating' | 'closed'; isExample?: boolean }
export interface TrackedIssue { id: string; title: string; status: 'open' | 'in_progress' | 'closed'; owner: string; isExample?: boolean }

export interface ConstructionTrackingState {
    statusMonth: number | null;            // months since NTP; null = Plan Mode
    phaseActualPct: Record<string, number | null>; // keyed by engine schedule row key
    acSpentUsd: number | null;
    manpowerOnSite: number | null;
    peakManpowerPlanned: number;           // screening trapezoid model peak
    qaqc: { inspections: number | null; openPunch: number | null; ftrPct: number | null; passRatePct: number | null; manHours: number | null; trir: number | null; daysSinceLti: number | null };
    risks: TrackedRisk[];
    issues: TrackedIssue[];
    /** NON-persisted session flag: true once a localStorage write failed
     *  (quota / private mode). UI may render a "not saved" chip off this. */
    persistFailed: boolean;
    actions: {
        set: (p: Partial<Omit<ConstructionTrackingState, 'actions'>>) => void;
        setPhasePct: (key: string, pct: number | null) => void;
        upsertRisk: (r: TrackedRisk) => void;
        removeRisk: (id: string) => void;
        upsertIssue: (i: TrackedIssue) => void;
        removeIssue: (id: string) => void;
        reset: () => void;
    };
}

const KEY = 'dcmoc_construction_tracking_v1';
/* FIFO cap on risks/issues — upserts append at the tail, so slice(-CAP) trims
 * the OLDEST entries once the cap is hit. */
const CAP = 500;

const SEED_RISKS: TrackedRisk[] = [
    { id: 'r1', risk: 'Chiller delivery delay', impact: 'high', probability: 'medium', status: 'open', isExample: true },
    { id: 'r2', risk: 'MV switchgear lead time', impact: 'high', probability: 'medium', status: 'mitigating', isExample: true },
    { id: 'r3', risk: 'Skilled labor availability', impact: 'medium', probability: 'medium', status: 'open', isExample: true },
];
const SEED_ISSUES: TrackedIssue[] = [
    { id: 'i1', title: 'Conduit installation clash — Zone B', status: 'in_progress', owner: 'MEP Team', isExample: true },
    { id: 'i2', title: 'Fire pump room waterproofing', status: 'open', owner: 'Civil Team', isExample: true },
];

const DEFAULTS: Omit<ConstructionTrackingState, 'actions'> = {
    statusMonth: null, phaseActualPct: {}, acSpentUsd: null, manpowerOnSite: null,
    peakManpowerPlanned: 800,
    qaqc: { inspections: null, openPunch: null, ftrPct: null, passRatePct: null, manHours: null, trir: null, daysSinceLti: null },
    risks: SEED_RISKS, issues: SEED_ISSUES, persistFailed: false,
};

/* Versioned payload (scenario.ts pattern): v1 = { version: 1, ...state }.
 * Legacy v0 blobs were the bare state object (same field shape) — migrated
 * transparently. persistFailed is session-local and never restored. */
function load(): Partial<Omit<ConstructionTrackingState, 'actions' | 'persistFailed'>> | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        const { version, persistFailed: _pf, ...state } = parsed;
        if (version != null && version !== 1) return null; // unknown future schema → fall back to seed
        return state;
    } catch { return null; }
}
/** @returns false when the write failed (quota / private mode) — caller flags it. */
function save(s: ConstructionTrackingState): boolean {
    if (typeof window === 'undefined') return true;
    try {
        const { actions: _a, persistFailed: _pf, ...rest } = s;
        localStorage.setItem(KEY, JSON.stringify({ version: 1, ...rest }));
        return true;
    } catch { return false; }
}

export const useConstructionTracking = create<ConstructionTrackingState>((set, get) => {
    const persisted = load();
    const commit = (p: Partial<Omit<ConstructionTrackingState, 'actions'>>) => {
        set(p);
        if (save(get())) {
            if (get().persistFailed) set({ persistFailed: false }); // storage recovered
        } else if (!get().persistFailed) {
            /* Quota / private-mode failure: non-fatal but NEVER silent — flag once
             * so the UI can surface it; state keeps working in-memory. */
            set({ persistFailed: true });
            if (process.env.NODE_ENV !== 'production') console.warn('[constructionTracking] localStorage persist failed — changes are in-memory only');
        }
    };
    /* SEED hygiene: example risks/issues apply ONLY when no persisted payload
     * exists (first run) — any persisted key wins over DEFAULTS below, so seeds
     * never overwrite user data on rehydrate. */
    return {
        ...DEFAULTS, ...(persisted ?? {}), persistFailed: false,
        actions: {
            set: (p) => commit(p),
            setPhasePct: (key, pct) => commit({ phaseActualPct: { ...get().phaseActualPct, [key]: pct == null ? null : Math.min(100, Math.max(0, pct)) } }),
            upsertRisk: (r) => commit({ risks: [...get().risks.filter((x) => x.id !== r.id), { ...r, isExample: undefined }].slice(-CAP) }),
            removeRisk: (id) => commit({ risks: get().risks.filter((x) => x.id !== id) }),
            upsertIssue: (i) => commit({ issues: [...get().issues.filter((x) => x.id !== i.id), { ...i, isExample: undefined }].slice(-CAP) }),
            removeIssue: (id) => commit({ issues: get().issues.filter((x) => x.id !== id) }),
            reset: () => commit({ ...DEFAULTS }),
        },
    };
});

export function isPlanMode(s: Pick<ConstructionTrackingState, 'statusMonth' | 'phaseActualPct'>): boolean {
    return s.statusMonth == null && !Object.values(s.phaseActualPct).some((v) => v != null);
}
