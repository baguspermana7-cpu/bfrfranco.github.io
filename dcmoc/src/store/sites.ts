/* ─── CANDIDATE SITES STORE (Phase B) ────────────────────────────────────────
 * Multi-site state for the Site Intelligence engine. localStorage pattern
 * mirrors scenario.ts (SSR-guarded manual persistence, versioned payload).
 * Scores are NEVER stored — always derived at render through site-adapter
 * (keeps the store serializable and scores fresh vs engine updates).
 * ──────────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';
import type { CandidateSite, SiteAttributes } from '@/types/site-intel';
import { seedDefaultSites } from '@/lib/site-adapter';

const STORAGE_KEY = 'dcmoc_candidate_sites';
const MAX_SITES = 5;
const LABELS = ['A', 'B', 'C', 'D', 'E'];

interface SitesPayloadV1 {
    version: 1;
    sites: CandidateSite[];
    selectedSiteId: string | null;
    lastRunAt: number | null;
}

function loadFromStorage(): SitesPayloadV1 | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const p = JSON.parse(raw) as SitesPayloadV1;
        if (p?.version !== 1 || !Array.isArray(p.sites) || p.sites.length === 0) return null;
        return p;
    } catch { return null; }
}

function saveToStorage(s: { sites: CandidateSite[]; selectedSiteId: string | null; lastRunAt: number | null }): void {
    if (typeof window === 'undefined') return;
    try {
        const payload: SitesPayloadV1 = { version: 1, sites: s.sites, selectedSiteId: s.selectedSiteId, lastRunAt: s.lastRunAt };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch { /* quota — non-fatal */ }
}

export interface SitesStore {
    sites: CandidateSite[];
    selectedSiteId: string | null;
    comparisonIds: string[];
    lastRunAt: number | null;
    addSite: (countryId: string, name?: string) => void;
    removeSite: (id: string) => void;
    updateSite: (id: string, patch: Partial<Omit<CandidateSite, 'id' | 'attributes'>>) => void;
    updateAttributes: (id: string, patch: Partial<SiteAttributes>) => void;
    selectSite: (id: string) => void;
    toggleComparison: (id: string) => void;
    runAnalysis: () => void;
    resetToDefaults: (baseCountryId: string) => void;
}

function relabel(sites: CandidateSite[]): CandidateSite[] {
    return sites.map((s, i) => ({ ...s, label: LABELS[i] ?? String(i + 1) }));
}

export const useSitesStore = create<SitesStore>((set, get) => {
    const persisted = loadFromStorage();
    const seed = persisted?.sites ?? seedDefaultSites('ID');
    const initial = {
        sites: seed,
        selectedSiteId: persisted?.selectedSiteId ?? seed[0]?.id ?? null,
        comparisonIds: seed.map((s) => s.id),
        lastRunAt: persisted?.lastRunAt ?? null,
    };
    const commit = (next: Partial<SitesStore>) => {
        set(next);
        const s = get();
        saveToStorage({ sites: s.sites, selectedSiteId: s.selectedSiteId, lastRunAt: s.lastRunAt });
    };
    return {
        ...initial,
        addSite: (countryId, name) => {
            const s = get();
            if (s.sites.length >= MAX_SITES) return;
            const now = Date.now();
            const site: CandidateSite = {
                id: `site_${now}_${s.sites.length}`,
                name: name || `New Site ${s.sites.length + 1}`,
                label: LABELS[s.sites.length] ?? String(s.sites.length + 1),
                countryId, city: '', lat: 0.4 + 0.12 * s.sites.length, lng: 0.35 + 0.15 * s.sites.length,
                attributes: {}, createdAt: now, updatedAt: now,
            };
            commit({ sites: relabel([...s.sites, site]), comparisonIds: [...s.comparisonIds, site.id] });
        },
        removeSite: (id) => {
            const s = get();
            if (s.sites.length <= 1) return;
            const sites = relabel(s.sites.filter((x) => x.id !== id));
            commit({
                sites,
                comparisonIds: s.comparisonIds.filter((x) => x !== id),
                selectedSiteId: s.selectedSiteId === id ? sites[0]?.id ?? null : s.selectedSiteId,
            });
        },
        updateSite: (id, patch) => {
            commit({
                sites: get().sites.map((x) => x.id === id ? { ...x, ...patch, isExample: undefined, updatedAt: Date.now() } : x),
            });
        },
        updateAttributes: (id, patch) => {
            commit({
                sites: get().sites.map((x) => x.id === id
                    ? { ...x, attributes: { ...x.attributes, ...patch }, isExample: undefined, updatedAt: Date.now() }
                    : x),
            });
        },
        selectSite: (id) => commit({ selectedSiteId: id }),
        toggleComparison: (id) => {
            const cur = get().comparisonIds;
            set({ comparisonIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
        },
        runAnalysis: () => commit({ lastRunAt: Date.now() }),
        resetToDefaults: (baseCountryId) => {
            const seedSites = seedDefaultSites(baseCountryId);
            commit({ sites: seedSites, selectedSiteId: seedSites[0].id, comparisonIds: seedSites.map((x) => x.id), lastRunAt: null });
        },
    };
});
