import { create } from 'zustand';
import { useSimulationStore } from './simulation';
import { useCapexStore } from './capex';
import { CapexInput } from '@/lib/CapexEngine';

// ─── TYPES ──────────────────────────────────────────────────

export interface SiteConfig {
    id: string;
    label: string;           // e.g. "Jakarta DC-1"
    countryId: string;
    tierLevel: 2 | 3 | 4;
    itLoad: number;          // kW
    coolingType: 'air' | 'inrow' | 'rdhx' | 'liquid';
    shiftModel: '8h' | '12h';
    staffingModel: 'in-house' | 'outsourced' | 'hybrid';
    maintenanceStrategy: 'reactive' | 'planned' | 'predictive';
    powerRedundancy: 'N+1' | '2N' | '2N+1';
    capexInputs: Partial<CapexInput>;
}

interface PortfolioStore {
    sites: SiteConfig[];
    activeSiteId: string | null;

    // Actions
    addSite: () => void;
    removeSite: (id: string) => void;
    updateSite: (id: string, updates: Partial<SiteConfig>) => void;
    duplicateSite: (id: string) => void;
    importFromCurrentConfig: () => void;
    setActiveSite: (id: string | null) => void;
}

// ─── PERSISTENCE ────────────────────────────────────────────
const STORAGE_KEY = 'dcmoc_portfolio';

const loadFromStorage = (): SiteConfig[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
};

const saveToStorage = (sites: SiteConfig[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sites));
    } catch { /* quota exceeded */ }
};

let siteCounter = 1;

const createDefaultSite = (label?: string): SiteConfig => ({
    id: `site_${Date.now()}_${siteCounter++}`,
    label: label || `Site ${siteCounter}`,
    countryId: 'ID',
    tierLevel: 3,
    itLoad: 2500,
    coolingType: 'air',
    shiftModel: '12h',
    staffingModel: 'in-house',
    maintenanceStrategy: 'planned',
    powerRedundancy: '2N',
    capexInputs: {},
});

// ─── STORE ──────────────────────────────────────────────────
export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
    sites: loadFromStorage(),
    activeSiteId: null,

    addSite: () => {
        const sites = get().sites;
        if (sites.length >= 5) return;
        const newSite = createDefaultSite(`Site ${sites.length + 1}`);
        const updated = [...sites, newSite];
        set({ sites: updated, activeSiteId: newSite.id });
        saveToStorage(updated);
    },

    removeSite: (id) => {
        const updated = get().sites.filter(s => s.id !== id);
        const newActive = get().activeSiteId === id ? (updated[0]?.id || null) : get().activeSiteId;
        set({ sites: updated, activeSiteId: newActive });
        saveToStorage(updated);
    },

    updateSite: (id, updates) => {
        const updated = get().sites.map(s => s.id === id ? { ...s, ...updates } : s);
        set({ sites: updated });
        saveToStorage(updated);
    },

    duplicateSite: (id) => {
        const sites = get().sites;
        if (sites.length >= 5) return;
        const source = sites.find(s => s.id === id);
        if (!source) return;
        const dup: SiteConfig = {
            ...source,
            id: `site_${Date.now()}_${siteCounter++}`,
            label: `${source.label} (Copy)`,
        };
        const updated = [...sites, dup];
        set({ sites: updated, activeSiteId: dup.id });
        saveToStorage(updated);
    },

    importFromCurrentConfig: () => {
        const simStore = useSimulationStore.getState();
        const capexStore = useCapexStore.getState();
        const sites = get().sites;
        if (sites.length >= 5) return;

        const newSite: SiteConfig = {
            id: `site_${Date.now()}_${siteCounter++}`,
            label: `${simStore.selectedCountry?.name || 'Unknown'} DC`,
            countryId: simStore.selectedCountry?.id || 'ID',
            tierLevel: simStore.inputs.tierLevel,
            itLoad: simStore.inputs.itLoad,
            coolingType: simStore.inputs.coolingType,
            shiftModel: simStore.inputs.shiftModel,
            staffingModel: simStore.inputs.staffingModel,
            maintenanceStrategy: simStore.inputs.maintenanceStrategy,
            powerRedundancy: simStore.inputs.powerRedundancy,
            capexInputs: { ...capexStore.inputs },
        };
        const updated = [...sites, newSite];
        set({ sites: updated, activeSiteId: newSite.id });
        saveToStorage(updated);
    },

    setActiveSite: (id) => set({ activeSiteId: id }),
}));
