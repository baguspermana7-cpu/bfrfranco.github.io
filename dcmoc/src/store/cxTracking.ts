/* ─── COMMISSIONING TRACKING STORE (Phase K) ─────────────────────────────────
 * ACTUALS: per-level completion (feeds the ENGINE readinessIndex — real
 * linkage), test log counters, issues & punch list. Plan Mode when untouched.
 * ──────────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';

export interface CxIssue { id: string; title: string; sev: 'High' | 'Medium' | 'Low'; kind: 'issue' | 'punch'; open: boolean; isExample?: boolean }

export interface CxTrackingState {
    /** completion 0-1 per engine readiness key (L1..L5, ist, sat, fat, punchlist). */
    completion: Record<string, number | null>;
    testsPassed: number | null;
    testsFailed: number | null;
    testsTotalOverride: number | null;
    issues: CxIssue[];
    touched: boolean;
    actions: {
        setCompletion: (key: string, v: number | null) => void;
        set: (p: Partial<Omit<CxTrackingState, 'actions'>>) => void;
        upsertIssue: (i: CxIssue) => void;
        toggleIssue: (id: string) => void;
        reset: () => void;
    };
}

const KEY = 'dcmoc_cx_tracking_v1';
const SEED_ISSUES: CxIssue[] = [
    { id: 'c1', title: 'Chiller plant performance test — witness reschedule', sev: 'High', kind: 'issue', open: true, isExample: true },
    { id: 'c2', title: 'BMS graphics integrity check', sev: 'Medium', kind: 'issue', open: true, isExample: true },
    { id: 'c3', title: 'CRAC-12 condensate pan alignment', sev: 'Low', kind: 'punch', open: true, isExample: true },
    { id: 'c4', title: 'UPS-02 battery room label set', sev: 'Low', kind: 'punch', open: true, isExample: true },
];

function load(): Partial<CxTrackingState> | null {
    if (typeof window === 'undefined') return null;
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export const useCxTracking = create<CxTrackingState>((set, get) => {
    const persisted = load();
    const commit = (p: Partial<CxTrackingState>) => {
        set({ ...p, touched: true });
        try { const { actions: _a, ...rest } = get(); localStorage.setItem(KEY, JSON.stringify(rest)); } catch { /* */ }
    };
    return {
        completion: {}, testsPassed: null, testsFailed: null, testsTotalOverride: null,
        issues: SEED_ISSUES, touched: false, ...(persisted ?? {}),
        actions: {
            setCompletion: (key, v) => commit({ completion: { ...get().completion, [key]: v == null ? null : Math.min(1, Math.max(0, v)) } }),
            set: (p) => commit(p),
            upsertIssue: (i) => commit({ issues: [...get().issues.filter((x) => x.id !== i.id), { ...i, isExample: undefined }] }),
            toggleIssue: (id) => commit({ issues: get().issues.map((x) => x.id === id ? { ...x, open: !x.open, isExample: undefined } : x) }),
            reset: () => { set({ completion: {}, testsPassed: null, testsFailed: null, testsTotalOverride: null, issues: SEED_ISSUES, touched: false }); try { localStorage.removeItem(KEY); } catch { /* */ } },
        },
    };
});

export function cxPlanMode(s: Pick<CxTrackingState, 'completion'>): boolean {
    return !Object.values(s.completion).some((v) => v != null);
}
