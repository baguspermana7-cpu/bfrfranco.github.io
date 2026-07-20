
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CapexInput, CapexResult, calculateCapex, generateCapexNarrative } from '../lib/CapexEngine';
import { COUNTRIES } from '@/constants/countries';
import { useSimulationStore } from './simulation';

export interface CapexStore {
    currentModel: 'simple' | 'advanced';
    inputs: CapexInput;
    results: CapexResult | null;
    narrative: string;
    /** Project hero image (compressed WebP dataURL) shown on the dashboard.
     *  null → the default /dcmoc/hero-default.webp is used. */
    heroImage: string | null;

    // Actions
    setInputs: (inputs: Partial<CapexInput>) => void;
    setModel: (model: 'simple' | 'advanced') => void;
    runCalculation: () => void;
    reset: () => void;
    setHeroImage: (url: string | null) => void;
}

const HERO_KEY = 'dcmoc-hero-image';
const CAPEX_PERSIST_KEY = 'dcmoc-capex';
/* HIGH-1 reconciliation flag — captured BEFORE create() so we know whether
 * THIS session started with a persisted capex state (respect it) or fresh
 * (adopt the live simulation canonicals in onRehydrateStorage below). */
const hadPersistedCapex = (() => {
    try { return typeof window !== 'undefined' && localStorage.getItem(CAPEX_PERSIST_KEY) != null; } catch { return false; }
})();
const loadHero = (): string | null => { try { return typeof window !== 'undefined' ? localStorage.getItem(HERO_KEY) : null; } catch { return null; } };

/* HIGH-1 (visual audit) — capex defaults MUST mirror the simulation-store
 * defaults (itLoad 2500 kW · country ID). The old 1000/'usa' init made every
 * new session compute CAPEX on a 1.0 MW US basis while the whole app showed a
 * 2.5 MW ID project (Dashboard $/kW, Results capexScore, Financial baseline
 * all inherited the wrong total) — writeSharedItLoad/-Country only reconcile
 * when the user EDITS a requirement, never on first load. */
const defaultInputs: CapexInput = {
    itLoad: 2500,
    location: 'ID',
    country: COUNTRIES['ID'],
    cityMarket: 'none',
    buildingType: 'purpose',
    coolingType: 'air',
    redundancy: 'n1',
    rackType: 'standard',
    upsType: 'modular',
    genType: 'diesel',
    fuelHours: 48,
    fireType: 'novec',
    alarmType: 'addressable',
    projYear: '2025',
    designFee: 8,
    pmFee: 5,
    contingency: 10,
    includeFOM: false,
    substationType: 'dedicated_33kv',
    transformerLead: 'standard',
    utilityRate: 9,
    greenCert: 'none',
    renewableOption: 'none'
};

/* DF1 — inputs PERSIST (audit-critical: reload used to wipe every capex
 * assumption incl. the deep-sea tick while requirements persisted → the
 * cross-page contradiction the owner caught). Results recompute on load. */
export const useCapexStore = create<CapexStore>()(persist((set, get) => ({
    currentModel: 'simple',
    inputs: defaultInputs,
    results: null,
    narrative: '',
    heroImage: loadHero(),

    setHeroImage: (url) => {
        try { if (typeof window !== 'undefined') { if (url) localStorage.setItem(HERO_KEY, url); else localStorage.removeItem(HERO_KEY); } } catch { /* quota */ }
        set({ heroImage: url });
    },

    setInputs: (newInputs) => {
        set((state) => ({
            inputs: { ...state.inputs, ...newInputs }
        }));
        get().runCalculation();
    },

    setModel: (model) => set({ currentModel: model }),

    runCalculation: () => {
        const { inputs } = get();
        const results = calculateCapex(inputs);
        const narrative = generateCapexNarrative(results);
        set({ results, narrative });
    },

    reset: () => {
        set({ inputs: defaultInputs, results: null, narrative: '' });
        get().runCalculation();
    }
}), {
    name: CAPEX_PERSIST_KEY,
    version: 1,
    partialize: (s) => ({ currentModel: s.currentModel, inputs: s.inputs }),
    onRehydrateStorage: () => (state) => {
        try {
            if (!state) return;
            if (!hadPersistedCapex) {
                /* New session (no persisted capex): adopt the LIVE simulation
                 * canonicals (itLoad + country/location) so capex never runs on
                 * defaults the rest of the app has moved past. setInputs writes
                 * capex ONLY (no writeShared* → no store loop) and auto-recalcs. */
                const sim = useSimulationStore.getState();
                const cid = sim.selectedCountry?.id;
                state.setInputs({
                    itLoad: sim.inputs.itLoad,
                    ...(cid && COUNTRIES[cid] ? { location: cid, country: COUNTRIES[cid] } : {}),
                });
            } else {
                state.runCalculation(); // persisted inputs respected; results recompute
            }
        } catch { /* engine absent */ }
    },
}));
