import { create } from 'zustand';
import type { SimulationState } from './simulation';
import type { CapexStore } from './capex';

// ─── TYPES ──────────────────────────────────────────────────
export interface SavedScenario {
    id: string;
    name: string;
    timestamp: number;
    countryId: string;
    simInputs: SimulationState['inputs'];
    capexInputs: CapexStore['inputs'];
    // Computed summary for quick display
    summary: {
        monthlyOpex: number;
        annualCapex: number;
        totalStaff: number;
        pue: number;
        // Enriched metrics (populated at save time when financials are available)
        irr?: number;
        npv?: number;
        paybackYears?: number;
        annualCO2?: number;
        riskScore?: number;
    };
}

interface ScenarioStore {
    scenarios: SavedScenario[];
    isPanelOpen: boolean;
    comparisonId: string | null;

    // Comparison mode
    comparisonIds: string[];
    isComparisonMode: boolean;

    // Actions
    openPanel: () => void;
    closePanel: () => void;
    togglePanel: () => void;
    saveScenario: (scenario: Omit<SavedScenario, 'id' | 'timestamp'>) => void;
    deleteScenario: (id: string) => void;
    renameScenario: (id: string, name: string) => void;
    setComparison: (id: string | null) => void;
    getScenario: (id: string) => SavedScenario | undefined;

    // Comparison actions
    toggleComparisonSelection: (id: string) => void;
    addScenarios: (items: SavedScenario[]) => void;
    setComparisonIds: (ids: string[]) => void;
    enterComparisonMode: () => void;
    exitComparisonMode: () => void;
}

// ─── PERSISTENCE ────────────────────────────────────────────
const STORAGE_KEY = 'dcmoc_scenarios';

/* audit #6 — VERSIONED payload: legacy bare-array blobs migrate transparently;
 * future schema changes bump version + add a migrate branch here. */
/* v3.25.0 — payload v2 carries the starred comparison set (v1/v0 migrate with an
 * empty set). Before this the ★ selection died on every reload, so a prepared
 * Scenario Comparison could not survive to the meeting. */
const loadFromStorage = (): { scenarios: SavedScenario[]; comparisonIds: string[] } => {
    if (typeof window === 'undefined') return { scenarios: [], comparisonIds: [] };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { scenarios: [], comparisonIds: [] };
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return { scenarios: parsed, comparisonIds: [] };                   // legacy v0 shape
        if ((parsed?.version === 1 || parsed?.version === 2) && Array.isArray(parsed.scenarios)) {
            const ids = new Set(parsed.scenarios.map((s: SavedScenario) => s.id));
            const comparisonIds = Array.isArray(parsed.comparisonIds) ? parsed.comparisonIds.filter((id: string) => ids.has(id)).slice(0, 4) : [];
            return { scenarios: parsed.scenarios, comparisonIds };
        }
        return { scenarios: [], comparisonIds: [] };
    } catch { return { scenarios: [], comparisonIds: [] }; }
};

const saveToStorage = (scenarios: SavedScenario[], comparisonIds: string[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, scenarios, comparisonIds }));
    } catch { /* quota exceeded, silently fail */ }
};

// ─── STORE ──────────────────────────────────────────────────
const persisted = loadFromStorage();
export const useScenarioStore = create<ScenarioStore>((set, get) => ({
    scenarios: persisted.scenarios,
    isPanelOpen: false,
    comparisonId: null,
    comparisonIds: persisted.comparisonIds,
    isComparisonMode: false,
    /** v3.25.0 — bulk load (presentation presets): adds only ids not present, never drops user scenarios. */
    addScenarios: (items) => {
        const have = new Set(get().scenarios.map((s) => s.id));
        const fresh = items.filter((s) => !have.has(s.id));
        if (!fresh.length) return;
        const updated = [...fresh, ...get().scenarios].slice(0, 20);
        set({ scenarios: updated });
        saveToStorage(updated, get().comparisonIds);
    },
    setComparisonIds: (ids) => {
        const have = new Set(get().scenarios.map((s) => s.id));
        const next = ids.filter((id) => have.has(id)).slice(0, 4);
        set({ comparisonIds: next });
        saveToStorage(get().scenarios, next);
    },

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
        saveToStorage(updated, get().comparisonIds);
    },

    deleteScenario: (id) => {
        const updated = get().scenarios.filter(s => s.id !== id);
        const newComparisonIds = get().comparisonIds.filter(cid => cid !== id);
        set({
            scenarios: updated,
            comparisonId: get().comparisonId === id ? null : get().comparisonId,
            comparisonIds: newComparisonIds,
        });
        saveToStorage(updated, newComparisonIds);
    },

    renameScenario: (id, name) => {
        const updated = get().scenarios.map(s => s.id === id ? { ...s, name } : s);
        set({ scenarios: updated });
        saveToStorage(updated, get().comparisonIds);
    },

    setComparison: (id) => set({ comparisonId: id }),

    getScenario: (id) => get().scenarios.find(s => s.id === id),

    toggleComparisonSelection: (id) => {
        const current = get().comparisonIds;
        let next = current;
        if (current.includes(id)) next = current.filter(cid => cid !== id);
        else if (current.length < 4) next = [...current, id];
        set({ comparisonIds: next });
        saveToStorage(get().scenarios, next);
    },

    enterComparisonMode: () => {
        if (get().comparisonIds.length >= 2) {
            set({ isComparisonMode: true, isPanelOpen: false });
        }
    },

    exitComparisonMode: () => {
        set({ isComparisonMode: false });   // v3.25.0: keep the starred set (it persists)
    },
}));
