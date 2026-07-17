
import { create } from 'zustand';
import { CapexInput, CapexResult, calculateCapex, generateCapexNarrative } from '../lib/CapexEngine';

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
const loadHero = (): string | null => { try { return typeof window !== 'undefined' ? localStorage.getItem(HERO_KEY) : null; } catch { return null; } };

const defaultInputs: CapexInput = {
    itLoad: 1000,
    location: 'usa',
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

export const useCapexStore = create<CapexStore>((set, get) => ({
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
}));
