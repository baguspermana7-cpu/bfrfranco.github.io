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
    risks: SEED_RISKS, issues: SEED_ISSUES,
};

function load(): Partial<Omit<ConstructionTrackingState, 'actions'>> | null {
    if (typeof window === 'undefined') return null;
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function save(s: ConstructionTrackingState): void {
    if (typeof window === 'undefined') return;
    try {
        const { actions: _a, ...rest } = s;
        localStorage.setItem(KEY, JSON.stringify(rest));
    } catch { /* quota */ }
}

export const useConstructionTracking = create<ConstructionTrackingState>((set, get) => {
    const persisted = load();
    const commit = (p: Partial<Omit<ConstructionTrackingState, 'actions'>>) => { set(p); save(get()); };
    return {
        ...DEFAULTS, ...(persisted ?? {}),
        actions: {
            set: (p) => commit(p),
            setPhasePct: (key, pct) => commit({ phaseActualPct: { ...get().phaseActualPct, [key]: pct == null ? null : Math.min(100, Math.max(0, pct)) } }),
            upsertRisk: (r) => commit({ risks: [...get().risks.filter((x) => x.id !== r.id), { ...r, isExample: undefined }] }),
            removeRisk: (id) => commit({ risks: get().risks.filter((x) => x.id !== id) }),
            upsertIssue: (i) => commit({ issues: [...get().issues.filter((x) => x.id !== i.id), { ...i, isExample: undefined }] }),
            removeIssue: (id) => commit({ issues: get().issues.filter((x) => x.id !== id) }),
            reset: () => commit({ ...DEFAULTS }),
        },
    };
});

export function isPlanMode(s: Pick<ConstructionTrackingState, 'statusMonth' | 'phaseActualPct'>): boolean {
    return s.statusMonth == null && !Object.values(s.phaseActualPct).some((v) => v != null);
}
