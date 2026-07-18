/* ─── SETTINGS STORE (Phase R) ───────────────────────────────────────────────
 * Versioned, scalable settings schema. Every field here is CONSUMED by a real
 * surface (no placeholder): defaults applied via real writers, data-reset
 * actions clear real stores, integrations carry a real test action.
 * Secrets are NEVER stored — only a secretRef label (configure at deploy).
 * ──────────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type IntegrationKind = 'webhook' | 'rest-api' | 'bms-readonly' | 'export-schedule';

export interface IntegrationConfig {
    id: string;
    kind: IntegrationKind;
    name: string;
    enabled: boolean;
    url: string;
    secretRef: string;                  // label only — never a secret value
    status: 'unconfigured' | 'configured' | 'reachable' | 'error';
    lastTestAt: number | null;
    lastTestNote: string;
}

export interface SettingsState {
    general: {
        orgName: string;
        defaultCountryId: string;
        defaultCurrency: string;
    };
    integrations: IntegrationConfig[];
    actions: {
        setGeneral: (p: Partial<SettingsState['general']>) => void;
        upsertIntegration: (i: IntegrationConfig) => void;
        removeIntegration: (id: string) => void;
        setIntegrationResult: (id: string, status: IntegrationConfig['status'], note: string) => void;
    };
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            general: { orgName: '', defaultCountryId: 'ID', defaultCurrency: 'USD' },
            integrations: [],
            actions: {
                setGeneral: (p) => set({ general: { ...get().general, ...p } }),
                upsertIntegration: (i) => set({ integrations: [...get().integrations.filter((x) => x.id !== i.id), i] }),
                removeIntegration: (id) => set({ integrations: get().integrations.filter((x) => x.id !== id) }),
                setIntegrationResult: (id, status, note) => set({
                    integrations: get().integrations.map((x) => x.id === id ? { ...x, status, lastTestAt: Date.now(), lastTestNote: note } : x),
                }),
            },
        }),
        { name: 'dcmoc-settings', version: 1, partialize: (s) => ({ general: s.general, integrations: s.integrations }) },
    ),
);
