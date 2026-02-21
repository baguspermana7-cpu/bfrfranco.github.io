import { create } from 'zustand';

// ─── TYPES ──────────────────────────────────────────────────
export interface SavedScenario {
    id: string;
    name: string;
    timestamp: number;
    countryId: string;
    simInputs: Record<string, any>;
    capexInputs: Record<string, any>;
    // Computed summary for quick display
    summary: {
        monthlyOpex: number;
        annualCapex: number;
        totalStaff: number;
        pue: number;
    };
}

interface ScenarioStore {
    scenarios: SavedScenario[];
    isPanelOpen: boolean;
    comparisonId: string | null;

    // Actions
    openPanel: () => void;
    closePanel: () => void;
    togglePanel: () => void;
    saveScenario: (scenario: Omit<SavedScenario, 'id' | 'timestamp'>) => void;
    deleteScenario: (id: string) => void;
    renameScenario: (id: string, name: string) => void;
    setComparison: (id: string | null) => void;
    getScenario: (id: string) => SavedScenario | undefined;
}

// ─── PERSISTENCE ────────────────────────────────────────────
const STORAGE_KEY = 'dcmoc_scenarios';

const loadFromStorage = (): SavedScenario[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
};

const saveToStorage = (scenarios: SavedScenario[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
    } catch { /* quota exceeded, silently fail */ }
};

// ─── STORE ──────────────────────────────────────────────────
export const useScenarioStore = create<ScenarioStore>((set, get) => ({
    scenarios: loadFromStorage(),
    isPanelOpen: false,
    comparisonId: null,

    openPanel: () => set({ isPanelOpen: true }),
    closePanel: () => set({ isPanelOpen: false }),
    togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),

    saveScenario: (scenario) => {
        const newScenario: SavedScenario = {
            ...scenario,
            id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
        };
        const updated = [newScenario, ...get().scenarios].slice(0, 20); // Max 20
        set({ scenarios: updated });
        saveToStorage(updated);
    },

    deleteScenario: (id) => {
        const updated = get().scenarios.filter(s => s.id !== id);
        set({ scenarios: updated, comparisonId: get().comparisonId === id ? null : get().comparisonId });
        saveToStorage(updated);
    },

    renameScenario: (id, name) => {
        const updated = get().scenarios.map(s => s.id === id ? { ...s, name } : s);
        set({ scenarios: updated });
        saveToStorage(updated);
    },

    setComparison: (id) => set({ comparisonId: id }),

    getScenario: (id) => get().scenarios.find(s => s.id === id),
}));
