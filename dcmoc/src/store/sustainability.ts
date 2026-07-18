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
    actions: {
        upsertInitiative: (i: Initiative) => void;
        setInitiativeProgress: (id: string, pct: number) => void;
        upsertCert: (c: CertEntry) => void;
        set: (p: Partial<Omit<SustainabilityState, 'actions'>>) => void;
        reset: () => void;
    };
}

const KEY = 'dcmoc_sustainability_v1';
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

function load(): Partial<SustainabilityState> | null {
    if (typeof window === 'undefined') return null;
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export const useSustainability = create<SustainabilityState>((set, get) => {
    const persisted = load();
    const commit = (p: Partial<SustainabilityState>) => {
        set({ ...p, touched: true });
        try { const { actions: _a, ...rest } = get(); localStorage.setItem(KEY, JSON.stringify(rest)); } catch { /* */ }
    };
    return {
        initiatives: SEED_INIT, certs: SEED_CERTS, wasteDiversionPct: null, touched: false, ...(persisted ?? {}),
        actions: {
            upsertInitiative: (i) => commit({ initiatives: [...get().initiatives.filter((x) => x.id !== i.id), { ...i, isExample: undefined }] }),
            setInitiativeProgress: (id, pct) => commit({ initiatives: get().initiatives.map((x) => x.id === id ? { ...x, progressPct: Math.min(100, Math.max(0, pct)), isExample: undefined } : x) }),
            upsertCert: (c) => commit({ certs: [...get().certs.filter((x) => x.id !== c.id), { ...c, isExample: undefined }] }),
            set: (p) => commit(p),
            reset: () => { set({ initiatives: SEED_INIT, certs: SEED_CERTS, wasteDiversionPct: null, touched: false }); try { localStorage.removeItem(KEY); } catch { /* */ } },
        },
    };
});
