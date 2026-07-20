/* ─── COMMISSIONING TRACKING STORE (Phase K) ─────────────────────────────────
 * ACTUALS: per-level completion (feeds the ENGINE readinessIndex — real
 * linkage), test log counters, issues & punch list. Plan Mode when untouched.
 * ──────────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';

export interface CxIssue { id: string; title: string; sev: 'High' | 'Medium' | 'Low'; kind: 'issue' | 'punch'; open: boolean; isExample?: boolean }

export type CxCheckValue = 'pass' | 'fail' | null;

export interface CxTrackingState {
    /** completion 0-1 per engine readiness key (L1..L5, ist, sat, fat, punchlist). */
    completion: Record<string, number | null>;
    /** Cx checklist tri-state ticks, keyed `${readinessKey}:${itemId}` (Phase Y). */
    checklist: Record<string, CxCheckValue>;
    testsPassed: number | null;
    testsFailed: number | null;
    testsTotalOverride: number | null;
    issues: CxIssue[];
    touched: boolean;
    /** NON-persisted session flag: true once a localStorage write failed
     *  (quota / private mode). UI may render a "not saved" chip off this. */
    persistFailed: boolean;
    actions: {
        setCompletion: (key: string, v: number | null) => void;
        setCheck: (key: string, v: CxCheckValue) => void;
        set: (p: Partial<Omit<CxTrackingState, 'actions'>>) => void;
        upsertIssue: (i: CxIssue) => void;
        toggleIssue: (id: string) => void;
        reset: () => void;
    };
}

const KEY = 'dcmoc_cx_tracking_v1';
/* FIFO cap on the issues/punch list — upserts append at the tail, so
 * slice(-CAP) trims the OLDEST entries once the cap is hit. */
const CAP = 500;
const SEED_ISSUES: CxIssue[] = [
    { id: 'c1', title: 'Chiller plant performance test — witness reschedule', sev: 'High', kind: 'issue', open: true, isExample: true },
    { id: 'c2', title: 'BMS graphics integrity check', sev: 'Medium', kind: 'issue', open: true, isExample: true },
    { id: 'c3', title: 'CRAC-12 condensate pan alignment', sev: 'Low', kind: 'punch', open: true, isExample: true },
    { id: 'c4', title: 'UPS-02 battery room label set', sev: 'Low', kind: 'punch', open: true, isExample: true },
];

/* Versioned payload (scenario.ts pattern): v1 = { version: 1, ...state }.
 * Legacy v0 blobs were the bare state object (same field shape) — migrated
 * transparently. persistFailed is session-local and never restored. */
function load(): Partial<Omit<CxTrackingState, 'actions' | 'persistFailed'>> | null {
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

export const useCxTracking = create<CxTrackingState>((set, get) => {
    const persisted = load();
    const commit = (p: Partial<CxTrackingState>) => {
        set({ ...p, touched: true });
        try {
            const { actions: _a, persistFailed: _pf, ...rest } = get();
            localStorage.setItem(KEY, JSON.stringify({ version: 1, ...rest }));
            if (get().persistFailed) set({ persistFailed: false }); // storage recovered
        } catch (e) {
            /* Quota / private-mode failure: non-fatal but NEVER silent — flag once
             * so the UI can surface it; state keeps working in-memory. */
            if (!get().persistFailed) {
                set({ persistFailed: true });
                if (process.env.NODE_ENV !== 'production') console.warn('[cxTracking] localStorage persist failed — changes are in-memory only', e);
            }
        }
    };
    /* SEED hygiene: example issues apply ONLY when no persisted payload exists
     * (first run) — any persisted key wins over the seeds below, so seeds never
     * overwrite user data on rehydrate. */
    return {
        completion: {}, checklist: {}, testsPassed: null, testsFailed: null, testsTotalOverride: null,
        issues: SEED_ISSUES, touched: false, ...(persisted ?? {}), persistFailed: false,
        actions: {
            setCompletion: (key, v) => commit({ completion: { ...get().completion, [key]: v == null ? null : Math.min(1, Math.max(0, v)) } }),
            setCheck: (key, v) => commit({ checklist: { ...get().checklist, [key]: v } }),
            set: (p) => commit(p),
            upsertIssue: (i) => commit({ issues: [...get().issues.filter((x) => x.id !== i.id), { ...i, isExample: undefined }].slice(-CAP) }),
            toggleIssue: (id) => commit({ issues: get().issues.map((x) => x.id === id ? { ...x, open: !x.open, isExample: undefined } : x) }),
            reset: () => { set({ completion: {}, checklist: {}, testsPassed: null, testsFailed: null, testsTotalOverride: null, issues: SEED_ISSUES, touched: false }); try { localStorage.removeItem(KEY); } catch { /* */ } },
        },
    };
});

export function cxPlanMode(s: Pick<CxTrackingState, 'completion'>): boolean {
    return !Object.values(s.completion).some((v) => v != null);
}

/** Checklist-derived completion for one readiness key: null when the key has
 *  zero ticks (slider stays authoritative), else passCount/totalItems 0..1. */
export function checklistDerivedCompletion(s: Pick<CxTrackingState, 'checklist'>, readinessKey: string, totalItems: number): number | null {
    if (totalItems <= 0) return null;
    const prefix = `${readinessKey}:`;
    let ticks = 0, pass = 0;
    Object.entries(s.checklist).forEach(([k, v]) => {
        if (!k.startsWith(prefix) || v == null) return;
        ticks++;
        if (v === 'pass') pass++;
    });
    if (ticks === 0) return null;
    return Math.min(1, Math.max(0, pass / totalItems));
}
