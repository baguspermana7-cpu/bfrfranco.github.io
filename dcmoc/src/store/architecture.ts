/* ─── ARCHITECTURE PAGE STORE (Phase C) ──────────────────────────────────────
 * Page-local design choices that other engines may read (design standard,
 * profile, thermal setpoints, diagram view). Persisted (zustand persist).
 * Shared canonicals (itLoad/cooling/tier/redundancy) stay in sim/capex.
 * ──────────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DesignStandard = 'uptime-t3' | 'uptime-t4' | 'tia-r3' | 'tia-r4';
export type DiagramView = 'logical' | 'sld';

export const DESIGN_STANDARDS: { id: DesignStandard; label: string; tier: 3 | 4 }[] = [
    { id: 'uptime-t3', label: 'Uptime Institute TIER III+', tier: 3 },
    { id: 'uptime-t4', label: 'Uptime Institute TIER IV', tier: 4 },
    { id: 'tia-r3', label: 'ANSI/TIA-942 Rated-3', tier: 3 },
    { id: 'tia-r4', label: 'ANSI/TIA-942 Rated-4', tier: 4 },
];

export interface ArchitectureState {
    designStandard: DesignStandard;
    profileId: string;                 // ARCH_PROFILES id (presets.ts)
    supplyTempC: number;               // ASHRAE supply setpoint (old page hardcoded 22)
    deltaTK: number | null;            // null → engine band default
    diagramView: DiagramView;
    futureExpansionMw: number | null;  // null → none
    zoom: number;
    panX: number;
    panY: number;
    actions: {
        set: (p: Partial<Omit<ArchitectureState, 'actions'>>) => void;
        resetView: () => void;
    };
}

export const useArchitectureStore = create<ArchitectureState>()(
    persist(
        (set) => ({
            designStandard: 'uptime-t3',
            profileId: 'ai-liquid',
            supplyTempC: 22,
            deltaTK: null,
            diagramView: 'logical',
            futureExpansionMw: null,
            zoom: 1, panX: 0, panY: 0,
            actions: {
                set: (p) => set(p),
                resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),
            },
        }),
        {
            name: 'dcmoc-architecture',
            version: 1,
            partialize: (s) => ({
                designStandard: s.designStandard, profileId: s.profileId,
                supplyTempC: s.supplyTempC, deltaTK: s.deltaTK,
                diagramView: s.diagramView, futureExpansionMw: s.futureExpansionMw,
            }),
        },
    ),
);
