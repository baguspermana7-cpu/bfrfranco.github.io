/* ─── DC-OS PROFILE PRESETS (Phase 0) ────────────────────────────────────────
 * Multi-parameter writes through the registry (single sanitizing chokepoint).
 * Used by the Architecture "Architecture Profile" select and the Template
 * Library (Phase N). Values reference engine-real density/redundancy tiers.
 * ──────────────────────────────────────────────────────────────────────── */

import { setParam, type ParamId } from '@/state/registry';

export interface ArchProfile {
    id: string;
    label: string;
    writes: Partial<Record<ParamId, unknown>>;
}

export const ARCH_PROFILES: ArchProfile[] = [
    {
        id: 'ai-liquid',
        label: 'AI / High Density — Liquid Cooling',
        writes: { 'sim.coolingType': 'liquid', 'req.avgRackDensityKw': 75, 'sim.powerRedundancy': '2N', 'sim.tierLevel': 4, 'capex.rackType': 'ai' },
    },
    {
        id: 'ai-rdhx',
        label: 'AI / HPC — Rear-Door HX',
        writes: { 'sim.coolingType': 'rdhx', 'req.avgRackDensityKw': 25, 'sim.powerRedundancy': '2N', 'sim.tierLevel': 3, 'capex.rackType': 'high' },
    },
    {
        id: 'colo-inrow',
        label: 'Colocation — In-Row',
        writes: { 'sim.coolingType': 'inrow', 'req.avgRackDensityKw': 12, 'sim.powerRedundancy': 'N+1', 'sim.tierLevel': 3, 'capex.rackType': 'medium' },
    },
    {
        id: 'enterprise-air',
        label: 'Enterprise — Air Cooled',
        writes: { 'sim.coolingType': 'air', 'req.avgRackDensityKw': 8, 'sim.powerRedundancy': 'N+1', 'sim.tierLevel': 3, 'capex.rackType': 'standard' },
    },
];

export function applyProfile(p: ArchProfile): void {
    Object.entries(p.writes).forEach(([id, v]) => setParam(id as ParamId, v));
}
