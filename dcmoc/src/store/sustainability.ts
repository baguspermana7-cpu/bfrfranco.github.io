/* ─── SUSTAINABILITY STORE (Phase M) ─────────────────────────────────────────
 * Initiatives + certifications + waste diversion — user-attested entries
 * (planning tool). isExample seeds; Plan Mode when untouched.
 * ──────────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';

export interface Initiative { id: string; title: string; category: 'Energy' | 'Water' | 'Waste' | 'Climate'; progressPct: number; target: string; owner: string; status: 'On Track' | 'At Risk' | 'Done'; isExample?: boolean }
export interface CertEntry { id: string; name: string; status: 'Certified' | 'Compliant' | 'In Progress' | 'Planned'; isExample?: boolean }

export interface SustainabilityState {
    initiatives: Initiative[];
    certs: CertEntry[];
    wasteDiversionPct: number | null;
    touched: boolean;
    /** NON-persisted session flag: true once a localStorage write failed
     *  (quota / private mode). UI may render a "not saved" chip off this. */
    persistFailed: boolean;
    actions: {
        upsertInitiative: (i: Initiative) => void;
        setInitiativeProgress: (id: string, pct: number) => void;
        upsertCert: (c: CertEntry) => void;
        set: (p: Partial<Omit<SustainabilityState, 'actions'>>) => void;
        reset: () => void;
    };
}

const KEY = 'dcmoc_sustainability_v1';
/* FIFO cap on initiatives/certs — upserts append at the tail, so slice(-CAP)
 * trims the OLDEST entries once the cap is hit. */
const CAP = 500;
const SEED_INIT: Initiative[] = [
    { id: 's1', title: 'Solar PV expansion — phase 2', category: 'Energy', progressPct: 60, target: 'next FY', owner: 'Energy Team', status: 'On Track', isExample: true },
    { id: 's2', title: 'Chiller plant optimization program', category: 'Energy', progressPct: 80, target: 'Q4', owner: 'Ops', status: 'On Track', isExample: true },
    { id: 's3', title: 'Water recycling system', category: 'Water', progressPct: 45, target: 'next FY', owner: 'Facilities', status: 'At Risk', isExample: true },
    { id: 's4', title: 'Zero waste to landfill', category: 'Waste', progressPct: 70, target: 'FY+2', owner: 'Sustainability', status: 'On Track', isExample: true },
];
const SEED_CERTS: CertEntry[] = [
    { id: 'c1', name: 'ISO 14001 Environmental Management', status: 'Planned', isExample: true },
    { id: 'c2', name: 'ISO 50001 Energy Management', status: 'Planned', isExample: true },
    { id: 'c3', name: 'LEED (target per greenCert input)', status: 'In Progress', isExample: true },
];

/* Versioned payload (scenario.ts pattern): v1 = { version: 1, ...state }.
 * Legacy v0 blobs were the bare state object (same field shape) — migrated
 * transparently. persistFailed is session-local and never restored. */
function load(): Partial<Omit<SustainabilityState, 'actions' | 'persistFailed'>> | null {
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

export const useSustainability = create<SustainabilityState>((set, get) => {
    const persisted = load();
    const commit = (p: Partial<SustainabilityState>) => {
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
                if (process.env.NODE_ENV !== 'production') console.warn('[sustainability] localStorage persist failed — changes are in-memory only', e);
            }
        }
    };
    /* SEED hygiene: example initiatives/certs apply ONLY when no persisted
     * payload exists (first run) — any persisted key wins over the seeds below,
     * so seeds never overwrite user data on rehydrate. */
    return {
        initiatives: SEED_INIT, certs: SEED_CERTS, wasteDiversionPct: null, touched: false, ...(persisted ?? {}), persistFailed: false,
        actions: {
            upsertInitiative: (i) => commit({ initiatives: [...get().initiatives.filter((x) => x.id !== i.id), { ...i, isExample: undefined }].slice(-CAP) }),
            setInitiativeProgress: (id, pct) => commit({ initiatives: get().initiatives.map((x) => x.id === id ? { ...x, progressPct: Math.min(100, Math.max(0, pct)), isExample: undefined } : x) }),
            upsertCert: (c) => commit({ certs: [...get().certs.filter((x) => x.id !== c.id), { ...c, isExample: undefined }].slice(-CAP) }),
            set: (p) => commit(p),
            reset: () => { set({ initiatives: SEED_INIT, certs: SEED_CERTS, wasteDiversionPct: null, touched: false }); try { localStorage.removeItem(KEY); } catch { /* */ } },
        },
    };
});
