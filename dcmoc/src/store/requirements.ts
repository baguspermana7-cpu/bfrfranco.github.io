/* ─── REQUIREMENTS STORE (Phase A — Requirements & Workload Engine) ──────────
 * Requirement-ONLY fields live here (zustand + persist). Shared canonical
 * fields (itLoad, tier, cooling, redundancy, country) stay in the simulation
 * + capex stores and are read/written through src/lib/requirementsMappings.ts
 * helpers — no parallel copies, no drift.
 * Registers itself as the registry's lazy `req.*` provider on module load.
 * ──────────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { registerReqProvider, sanitizeNum } from '@/state/registry';
import { useSettingsStore } from '@/store/settings';
import type { ArchKey } from '@/lib/requirementsMappings';

export type SiteStatus = 'not_started' | 'identified' | 'shortlisted' | 'secured';
export type Industry = 'csp' | 'colo_provider' | 'enterprise' | 'government' | 'telecom' | 'financial';
export type GridVoltage = '11kV' | '20kV' | '33kV' | '132kV' | '220kV';
export type ProjectType = 'new_build' | 'expansion' | 'retrofit' | 'colocation';
export type UseCase = 'ai' | 'cloud' | 'hpc' | 'enterprise' | 'network' | 'dr';
export type RackForm = 'std42u' | 'tall48u' | 'ocp';
export type AiChip = 'h100' | 'h200' | 'gb200' | 'mi300x' | 'tpu' | 'none';
export type GrowthType = 'linear' | 'step' | 'custom';
export type PriorityKey = 'reliability' | 'performance' | 'cost' | 'sustainability' | 'speed';

export interface ReqOverview {
    projectName: string;
    projectCode: string;
    projectOwner: string;
    developmentPartner: string;
    customer: string;
    utilityProvider: string;
    cityRegion: string;
    siteStatus: SiteStatus;
    industry: Industry;
    targetCod: { quarter: 1 | 2 | 3 | 4; year: number };
    gridVoltage: GridVoltage;
    projectType: ProjectType;
    contractDurationYr: 5 | 10 | 15 | 20 | 'custom';
    contractDurationCustom: number | null;
    currency: string;
    useCase: UseCase;
}

export interface ReqWorkload {
    itLoadUnit: 'MW' | 'kW';           // display toggle only — canonical kW lives in simulation store
    peakItLoadKw: number | null;
    avgItLoadKw: number | null;
    avgRackDensityKw: number;
    maxRackDensityKw: number | null;
    rackForm: RackForm;
    workloadMix: { aiGpu: number; storage: number; general: number; network: number }; // sums to 100
    aiChipType: AiChip;
    /** Owner: computed rack count must be adjustable (e.g. 500 → actual 480). null = auto. */
    totalRacksOverride: number | null;
    /** Owner: mix is predefined from the use-case profile; sliders unlock via this tick. */
    mixManual: boolean;
    /** Ship-A: selected AI reference architecture (engine archProfiles key). null = none. */
    archKey: ArchKey | null;
}

export interface ReqGrowth {
    growthType: GrowthType;
    /** Y0 is ALWAYS derived from simulation.itLoad — only future years stored (MW). */
    itLoadMwByYear: { y1: number; y2: number; y3: number; y4: number; y5: number; y10: number };
}

export interface ReqAvailability {
    /** null → falls back to the engine tier target. Percent (e.g. 99.995). */
    slaTargetPct: number | null;
}

export interface ReqBusiness {
    budgetUsd: number | null;
    priorities: PriorityKey[];
    /** Owner mandate (2026-07-19): margin flows into cost/financial — the
     *  registry param req.designMarginPct writes BOTH here and capex.contingency. */
    designMarginPct: number;
}

export interface RequirementsState {
    overview: ReqOverview;
    workload: ReqWorkload;
    growth: ReqGrowth;
    availability: ReqAvailability;
    business: ReqBusiness;
    lastSavedAt: number | null;
    actions: {
        setOverview: (p: Partial<ReqOverview>) => void;
        setWorkload: (p: Partial<ReqWorkload>) => void;
        setGrowth: (p: Partial<ReqGrowth>) => void;
        setAvailability: (p: Partial<ReqAvailability>) => void;
        setBusiness: (p: Partial<ReqBusiness>) => void;
        movePriority: (index: number, dir: -1 | 1) => void;
        markSaved: () => void;
        reset: () => void;
    };
}

const DEFAULTS: Omit<RequirementsState, 'actions'> = {
    overview: {
        projectName: '', projectCode: '', projectOwner: '', developmentPartner: '',
        customer: '', utilityProvider: '', cityRegion: '',
        siteStatus: 'shortlisted', industry: 'csp',
        targetCod: { quarter: 2, year: 2027 },
        gridVoltage: '33kV', projectType: 'new_build',
        contractDurationYr: 15, contractDurationCustom: null,
        currency: (typeof window !== 'undefined' ? useSettingsStore.getState().general.defaultCurrency : 'USD') || 'USD', useCase: 'ai',
    },
    workload: {
        itLoadUnit: 'MW', peakItLoadKw: null, avgItLoadKw: null,
        avgRackDensityKw: 60, maxRackDensityKw: 80, rackForm: 'std42u',
        workloadMix: { aiGpu: 70, storage: 15, general: 10, network: 5 },
        aiChipType: 'h100',
        totalRacksOverride: null, mixManual: false,
        archKey: null,
    },
    growth: {
        growthType: 'linear',
        itLoadMwByYear: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0, y10: 0 }, // 0 = "derive from Y0" until user edits
    },
    availability: { slaTargetPct: null },
    business: { budgetUsd: null, priorities: ['reliability', 'performance', 'cost', 'sustainability', 'speed'], designMarginPct: 10 },
    lastSavedAt: null,
};

/** Normalize workload mix to sum 100 after a single-field edit. */
export function normalizeMix(
    mix: ReqWorkload['workloadMix'], changedKey: keyof ReqWorkload['workloadMix'], newValue: number,
): ReqWorkload['workloadMix'] {
    const v = Math.round(sanitizeNum(newValue, 0, 100, mix[changedKey]));
    const others = (Object.keys(mix) as Array<keyof typeof mix>).filter((k) => k !== changedKey);
    const rest = 100 - v;
    const otherSum = others.reduce((s, k) => s + mix[k], 0);
    const out = { ...mix, [changedKey]: v };
    if (otherSum <= 0) {
        // distribute evenly
        others.forEach((k, i) => { out[k] = Math.floor(rest / others.length) + (i === 0 ? rest % others.length : 0); });
    } else {
        let acc = 0;
        others.forEach((k, i) => {
            const share = i === others.length - 1 ? rest - acc : Math.round((mix[k] / otherSum) * rest);
            out[k] = Math.max(0, share); acc += share;
        });
    }
    return out;
}

export const useRequirementsStore = create<RequirementsState>()(
    persist(
        (set, get) => ({
            ...DEFAULTS,
            actions: {
                setOverview: (p) => set({ overview: { ...get().overview, ...p } }),
                setWorkload: (p) => set({ workload: { ...get().workload, ...p } }),
                setGrowth: (p) => set({ growth: { ...get().growth, ...p, itLoadMwByYear: { ...get().growth.itLoadMwByYear, ...(p.itLoadMwByYear || {}) } } }),
                setAvailability: (p) => set({ availability: { ...get().availability, ...p } }),
                setBusiness: (p) => set({ business: { ...get().business, ...p } }),
                movePriority: (index, dir) => {
                    const arr = [...get().business.priorities];
                    const j = index + dir;
                    if (j < 0 || j >= arr.length) return;
                    [arr[index], arr[j]] = [arr[j], arr[index]];
                    set({ business: { ...get().business, priorities: arr } });
                },
                markSaved: () => set({ lastSavedAt: Date.now() }),
                reset: () => set({ ...DEFAULTS }),
            },
        }),
        {
            name: 'dcmoc-requirements',
            version: 1,
            partialize: (s) => ({
                overview: s.overview, workload: s.workload, growth: s.growth,
                availability: s.availability, business: s.business, lastSavedAt: s.lastSavedAt,
            }),
        },
    ),
);

/* ── register as the registry's lazy req.* provider ──
 * Keys the registry uses: gridVoltage, useCase, avgRackDensityKw, designMarginPct. */
registerReqProvider({
    get: (key) => {
        const s = useRequirementsStore.getState();
        switch (key) {
            case 'gridVoltage': return s.overview.gridVoltage;
            case 'useCase': return s.overview.useCase;
            case 'avgRackDensityKw': return s.workload.avgRackDensityKw;
            case 'designMarginPct': return s.business.designMarginPct;
            default: return undefined;
        }
    },
    set: (key, v) => {
        const a = useRequirementsStore.getState().actions;
        switch (key) {
            case 'gridVoltage': a.setOverview({ gridVoltage: v as GridVoltage }); break;
            case 'useCase': a.setOverview({ useCase: v as UseCase }); break;
            case 'avgRackDensityKw': a.setWorkload({ avgRackDensityKw: v as number }); break;
            case 'designMarginPct': a.setBusiness({ designMarginPct: v as number }); break;
            default: break;
        }
    },
    useValue: (key, dflt) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useRequirementsStore((s) => {
            switch (key) {
                case 'gridVoltage': return s.overview.gridVoltage;
                case 'useCase': return s.overview.useCase;
                case 'avgRackDensityKw': return s.workload.avgRackDensityKw;
                case 'designMarginPct': return s.business.designMarginPct;
                default: return dflt;
            }
        }) as unknown;
    },
});
