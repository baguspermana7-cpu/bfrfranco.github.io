/* ─── PROJECTS STORE (Phase N — the workflow spine) ──────────────────────────
 * A Project = a NAMED BUNDLE snapshot of the FULL store family (shared
 * canonicals + every program store). Open = ordered multi-store restore
 * (sim → capex(auto-recalc) → requirements → sites → arch → trackings/logs),
 * each slice sanitized on load (STEP-3 degrade). Embedded-snapshot approach,
 * versioned payload, size-guarded (max 10 projects).
 * ──────────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useRequirementsStore } from '@/store/requirements';
import { useSitesStore } from '@/store/sites';
import { useArchitectureStore } from '@/store/architecture';
import { useConstructionTracking } from '@/store/constructionTracking';
import { useCxTracking } from '@/store/cxTracking';
import { useFinancialTracking } from '@/store/financialTracking';
import { useOpsLog } from '@/store/opsLog';
import { useSustainability } from '@/store/sustainability';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ProjectBundle {
    id: string;
    name: string;
    version: 1;
    createdAt: number;
    updatedAt: number;
    countryId: string;
    itLoadKw: number;
    snapshot: {
        simInputs: any;
        capexInputs: any;
        requirements: any;
        sites: any;
        architecture: any;
        constructionTracking: any;
        cxTracking: any;
        financialTracking: any;
        opsLog: any;
        sustainability: any;
    };
}

export interface ProjectsState {
    projects: ProjectBundle[];
    activeProjectId: string | null;
    /** Share-view guard (Arc-4) — TRUE while a shared read-only copy is loaded.
     *  NOT persisted (session-only); all mutating actions early-return while set. */
    readOnly: boolean;
    setReadOnly: (v: boolean) => void;
    saveCurrentAs: (name: string) => void;
    updateActive: () => void;
    openProject: (id: string) => void;
    deleteProject: (id: string) => void;
}

const KEY = 'dcmoc_projects_v1';
const MAX = 10;

function load(): Pick<ProjectsState, 'projects' | 'activeProjectId'> | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const p = JSON.parse(raw);
        return Array.isArray(p?.projects) ? { projects: p.projects, activeProjectId: p.activeProjectId ?? null } : null;
    } catch { return null; }
}
function save(s: Pick<ProjectsState, 'projects' | 'activeProjectId'>): void {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota — drop oldest */ }
}

/** Full store-family snapshot — exported (Arc-4) so the cloud/share layer
 *  (lib/cloudProjects.ts, Shell ?share= viewer) reuses the ONE canonical
 *  snapshot path instead of inventing its own. */
export function takeSnapshot(): ProjectBundle['snapshot'] {
    const strip = (o: any) => { const { actions: _a, ...rest } = o ?? {}; return JSON.parse(JSON.stringify(rest)); };
    return {
        simInputs: JSON.parse(JSON.stringify(useSimulationStore.getState().inputs)),
        capexInputs: JSON.parse(JSON.stringify(useCapexStore.getState().inputs)),
        requirements: strip(useRequirementsStore.getState()),
        sites: strip(useSitesStore.getState()),
        architecture: strip(useArchitectureStore.getState()),
        constructionTracking: strip(useConstructionTracking.getState()),
        cxTracking: strip(useCxTracking.getState()),
        financialTracking: strip(useFinancialTracking.getState()),
        opsLog: strip(useOpsLog.getState()),
        sustainability: strip(useSustainability.getState()),
    };
}

/** Ordered restore — each store's own setters/sanitizers do the clamping.
 *  Exported (Arc-4): the canonical restore path for cloud loads + share views. */
export function restoreSnapshot(s: ProjectBundle['snapshot']): void {
    try {
        // 1) sim (canonical shared inputs)
        if (s.simInputs) useSimulationStore.getState().actions.setInputs(s.simInputs);
        // 2) capex (auto-recalcs on setInputs)
        if (s.capexInputs) useCapexStore.getState().setInputs(s.capexInputs);
        // 3) requirements
        if (s.requirements) {
            const a = useRequirementsStore.getState().actions;
            if (s.requirements.overview) a.setOverview(s.requirements.overview);
            if (s.requirements.workload) a.setWorkload(s.requirements.workload);
            if (s.requirements.growth) a.setGrowth(s.requirements.growth);
            if (s.requirements.availability) a.setAvailability(s.requirements.availability);
            if (s.requirements.business) a.setBusiness(s.requirements.business);
        }
        // 4) sites / architecture / trackings — direct set (schemas versioned per store)
        if (s.sites?.sites?.length) useSitesStore.setState({ sites: s.sites.sites, selectedSiteId: s.sites.selectedSiteId ?? s.sites.sites[0]?.id ?? null, comparisonIds: s.sites.sites.map((x: { id: string }) => x.id) });
        if (s.architecture) useArchitectureStore.getState().actions.set(s.architecture);
        if (s.constructionTracking) useConstructionTracking.getState().actions.set(s.constructionTracking);
        if (s.cxTracking) useCxTracking.getState().actions.set(s.cxTracking);
        if (s.financialTracking) useFinancialTracking.setState({ ...s.financialTracking });
        if (s.opsLog) useOpsLog.setState({ ...s.opsLog });
        if (s.sustainability) useSustainability.getState().actions.set(s.sustainability);
    } catch (err) {
        // degrade gracefully — partial restore is still a valid state
        if (process.env.NODE_ENV !== 'production') console.warn('[projects] partial restore:', err);
    }
}

export const useProjectsStore = create<ProjectsState>((set, get) => {
    const persisted = load();
    const commit = (p: Partial<Pick<ProjectsState, 'projects' | 'activeProjectId'>>) => {
        set(p);
        save({ projects: get().projects, activeProjectId: get().activeProjectId });
    };
    return {
        projects: persisted?.projects ?? [],
        activeProjectId: persisted?.activeProjectId ?? null,
        readOnly: false,
        setReadOnly: (v) => set({ readOnly: v }),
        saveCurrentAs: (name) => {
            if (get().readOnly) return; // share-view guard
            const sim = useSimulationStore.getState();
            const now = Date.now();
            const proj: ProjectBundle = {
                id: `proj_${now}`,
                name: name || `Project ${get().projects.length + 1}`,
                version: 1, createdAt: now, updatedAt: now,
                countryId: sim.selectedCountry?.id ?? 'ID',
                itLoadKw: sim.inputs.itLoad,
                snapshot: takeSnapshot(),
            };
            commit({ projects: [proj, ...get().projects].slice(0, MAX), activeProjectId: proj.id });
        },
        updateActive: () => {
            if (get().readOnly) return; // share-view guard
            const id = get().activeProjectId;
            if (!id) return;
            const sim = useSimulationStore.getState();
            commit({
                projects: get().projects.map((p) => p.id === id
                    ? { ...p, updatedAt: Date.now(), countryId: sim.selectedCountry?.id ?? p.countryId, itLoadKw: sim.inputs.itLoad, snapshot: takeSnapshot() }
                    : p),
            });
        },
        openProject: (id) => {
            if (get().readOnly) return; // share-view guard
            const p = get().projects.find((x) => x.id === id);
            if (!p || p.version !== 1) return;
            restoreSnapshot(p.snapshot);
            commit({ activeProjectId: id });
        },
        deleteProject: (id) => {
            if (get().readOnly) return; // share-view guard
            commit({ projects: get().projects.filter((x) => x.id !== id), activeProjectId: get().activeProjectId === id ? null : get().activeProjectId });
        },
    };
});
