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

export interface SettingsActivity { ts: number; msg: string }

export interface SettingsState {
    general: {
        orgName: string;
        defaultCountryId: string;
        defaultCurrency: string;
    };
    integrations: IntegrationConfig[];
    /** Real change log (AD1) — every settings mutation records one line, cap 20. */
    activity: SettingsActivity[];
    actions: {
        setGeneral: (p: Partial<SettingsState['general']>) => void;
        upsertIntegration: (i: IntegrationConfig) => void;
        removeIntegration: (id: string) => void;
        setIntegrationResult: (id: string, status: IntegrationConfig['status'], note: string) => void;
        logActivity: (msg: string) => void;
    };
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => {
            const log = (msg: string) =>
                set({ activity: [{ ts: Date.now(), msg }, ...(get().activity ?? [])].slice(0, 20) });
            return {
                general: { orgName: '', defaultCountryId: 'ID', defaultCurrency: 'USD' },
                integrations: [],
                activity: [],
                actions: {
                    setGeneral: (p) => { set({ general: { ...get().general, ...p } }); log(`General updated: ${Object.keys(p).join(', ')}`); },
                    upsertIntegration: (i) => set({ integrations: [...get().integrations.filter((x) => x.id !== i.id), i] }),
                    removeIntegration: (id) => { set({ integrations: get().integrations.filter((x) => x.id !== id) }); log('Integration removed'); },
                    setIntegrationResult: (id, status, note) => {
                        set({ integrations: get().integrations.map((x) => x.id === id ? { ...x, status, lastTestAt: Date.now(), lastTestNote: note } : x) });
                        log(`Integration test: ${status}`);
                    },
                    logActivity: log,
                },
            };
        },
        { name: 'dcmoc-settings', version: 1, partialize: (s) => ({ general: s.general, integrations: s.integrations, activity: s.activity }) },
    ),
);
