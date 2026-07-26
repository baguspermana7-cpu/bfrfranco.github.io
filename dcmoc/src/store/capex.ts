
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
 * onRehydrateStorage ALWAYS reconciles the shared canonicals (itLoad/country)
 * from the live simulation store, regardless of persisted state. */
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
    seismicZone: 'zone2',   // explicit default so CapexEngine cost + BOQ take-off agree on first load

    projYear: '2025',
    designFee: 8,
    pmFee: 5,
    contingency: 10,
    includeFOM: false,
    substationType: 'dedicated_33kv',
    transformerLead: 'standard',
    utilityRate: 9,
    greenCert: 'none',
    renewableOption: 'none',
    powerSource: 'utility-backup'   // Workstream A — shared canonical, reconciled from sim (FuelGen page owns the selector)
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
            /* ALWAYS reconcile the SHARED canonicals (itLoad + country/location) to
             * the LIVE simulation store — these are simulation-owned project geometry
             * (the top bar reads them from sim), NOT capex-owned. Persisted capex-
             * specific fields (fireType/redundancy/upsType/…) are respected as-is.
             * Previously only new sessions synced, so a returning user whose capex
             * was persisted at a stale itLoad/country (e.g. usa/1000) diverged from
             * the app's live project (ID/2500) — the BOQ dossier header AND its $
             * total were then computed on stale inputs. setInputs writes capex ONLY
             * (no writeShared* → no loop) and auto-recalcs on the live geometry. */
            const sim = useSimulationStore.getState();
            const cid = sim.selectedCountry?.id;
            state.setInputs({
                itLoad: sim.inputs.itLoad,
                powerSource: sim.inputs.powerSource ?? 'utility-backup',
                ...(cid && COUNTRIES[cid] ? { location: cid, country: COUNTRIES[cid] } : {}),
            });
        } catch { /* engine absent */ }
    },
}));

/* Workstream A — the FuelGen page owns the power-source selector (writes the sim
 * store). CAPEX reads its OWN store for grid/genset cost, so mirror the sim value
 * live. Guarded (no recompute unless it actually changed) → no feedback loop. */
if (typeof window !== 'undefined') {
    useSimulationStore.subscribe((s) => {
        const ps = s.inputs.powerSource;
        if (ps && useCapexStore.getState().inputs.powerSource !== ps) {
            useCapexStore.getState().setInputs({ powerSource: ps });
        }
    });
}
