/* ─── REQUIREMENTS ↔ SHARED-STORE MAPPINGS (Phase A) ─────────────────────────
 * TOTAL enum maps + shared-field write helpers. The Requirements page NEVER
 * touches two stores ad hoc — every shared write goes through these helpers
 * so simulation + capex stay consistent even when CapexDashboard's own sync
 * effect is not mounted.
 * ──────────────────────────────────────────────────────────────────────── */

import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { COUNTRIES } from '@/constants/countries';
import { sanitizeNum } from '@/state/registry';
import { rzModels } from '@/lib/rz-engine';
import { useRequirementsStore, type UseCase } from '@/store/requirements';

/* UI use case → engine useCaseProfiles key (engine has no network/dr profile). */
export const USE_CASE_TO_ENGINE: Record<UseCase, string> = {
    ai: 'ai', cloud: 'cloud', hpc: 'hpc', enterprise: 'enterprise', network: 'edge', dr: 'colo',
};

export const USE_CASE_LABELS: Record<UseCase, string> = {
    ai: 'AI / Machine Learning', cloud: 'Hyperscale Cloud', hpc: 'HPC / Super Computing',
    enterprise: 'Enterprise IT', network: 'Network Hub', dr: 'Disaster Recovery',
};

/* Cooling select — sim/capex share the SAME keys (verified capex-data.ts).
 * 'immersion' exists only in engine data → deliberately NOT offered. */
export const COOLING_UI: { key: 'air' | 'inrow' | 'rdhx' | 'liquid'; label: string; topology: 'in-row' | 'perimeter' | 'dlc' }[] = [
    { key: 'liquid', label: 'Direct-to-Chip Liquid Cooling', topology: 'dlc' },
    { key: 'rdhx', label: 'Rear-Door Heat Exchanger', topology: 'in-row' },
    { key: 'inrow', label: 'In-Row Cooling', topology: 'in-row' },
    { key: 'air', label: 'Air (CRAC/CRAH)', topology: 'perimeter' },
];

/* Density (kW/rack) → capex rack class. Thresholds bracket CapexEngine's
 * 6 / 12.5 / 25 / 75 kW density classes. */
export function densityToCapexRackType(kw: number): 'standard' | 'medium' | 'high' | 'ai' {
    if (kw <= 8) return 'standard';
    if (kw <= 15) return 'medium';
    if (kw <= 35) return 'high';
    return 'ai';
}

/* Engine equipScale density bucket (standard|medium|high|ai_hpc). */
export function densityToEngineBucket(kw: number): 'standard' | 'medium' | 'high' | 'ai_hpc' {
    if (kw < 9) return 'standard';
    if (kw < 18) return 'medium';
    if (kw < 45) return 'high';
    return 'ai_hpc';
}

/* ── shared-field writers (single source of truth stays sim/capex) ── */

export function writeSharedItLoad(kw: number): void {
    const v = Math.round(sanitizeNum(kw, 100, 500_000, 2500));
    useSimulationStore.getState().actions.setInputs({ itLoad: v });
    useCapexStore.getState().setInputs({ itLoad: v }); // auto-recalcs capex
}

export function writeSharedCooling(key: 'air' | 'inrow' | 'rdhx' | 'liquid'): void {
    const meta = COOLING_UI.find((c) => c.key === key) ?? COOLING_UI[3];
    useSimulationStore.getState().actions.setInputs({ coolingType: key, coolingTopology: meta.topology });
    useCapexStore.getState().setInputs({ coolingType: key });
}

export function writeSharedCountry(countryId: string): void {
    const profile = COUNTRIES[countryId];
    if (!profile) return;
    useSimulationStore.getState().actions.selectCountry(countryId);
    useCapexStore.getState().setInputs({ location: countryId, country: profile });
}

export function writeSharedTier(tier: 2 | 3 | 4): void {
    useSimulationStore.getState().actions.setTierLevel(tier);
}

export function writeSharedRackDensity(kw: number): void {
    const v = sanitizeNum(kw, 1, 200, 12);
    // No import cycle: store/requirements imports state/registry only.
    useRequirementsStore.getState().actions.setWorkload({ avgRackDensityKw: v });
    useCapexStore.getState().setInputs({ rackType: densityToCapexRackType(v) });
}

/* Months from today until a target COD quarter (deadline for engine validate). */
export function monthsToCod(cod: { quarter: 1 | 2 | 3 | 4; year: number }, now = new Date()): number {
    const codMonth = (cod.quarter - 1) * 3 + 1; // Q start month (1-based)
    const months = (cod.year - now.getFullYear()) * 12 + (codMonth - (now.getMonth() + 1));
    return Math.max(0, months);
}

/* 5-yr CAGR from Y0 (MW) to Y5 (MW). */
export function cagr5(y0Mw: number, y5Mw: number): number {
    if (y0Mw <= 0 || y5Mw <= 0) return 0;
    return Math.pow(y5Mw / y0Mw, 1 / 5) - 1;
}

/* ── Phase S: use-case → auto-apply engine profile (predefined for ease) ──
 * Engine useCaseProfiles: ai 60kW/liquid/T3 · hpc 45/rdhx/T3 · cloud 20/inrow/T3
 * · colo 12/inrow/T3 · enterprise 8/air/T2 · edge 10/air/T2. Mix presets are
 * DCMOC-side predefined splits per profile (labeled, adjustable). */
export const MIX_PRESETS: Record<UseCase, { aiGpu: number; storage: number; general: number; network: number }> = {
    ai: { aiGpu: 70, storage: 15, general: 10, network: 5 },
    hpc: { aiGpu: 60, storage: 20, general: 15, network: 5 },
    cloud: { aiGpu: 30, storage: 25, general: 35, network: 10 },
    enterprise: { aiGpu: 20, storage: 25, general: 45, network: 10 },
    network: { aiGpu: 10, storage: 15, general: 25, network: 50 },
    dr: { aiGpu: 15, storage: 45, general: 30, network: 10 },
};

export interface UseCaseProfileInfo { rackKw: number; cooling: string; tierFloor: number; label: string }

export function engineProfileFor(useCase: UseCase): UseCaseProfileInfo | null {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const req = (rzModels() as any)?.requirements;
        const p = req?.profile ? req.profile(USE_CASE_TO_ENGINE[useCase]) : null;
        if (p) return { rackKw: p.rackKw, cooling: p.cooling, tierFloor: p.tierFloor ?? 3, label: p.label };
    } catch { /* */ }
    return null;
}

/** Auto-apply the engine profile when the user picks a use case:
 *  density + cooling (shared writers) + tier floor bump + mix preset.
 *  Mix preset is skipped while the manual-override tick is on (owner S8).
 *  Returns a human summary for the toast. */
export function applyUseCaseProfile(useCase: UseCase): string {
    const p = engineProfileFor(useCase);
    const mix = MIX_PRESETS[useCase];
    const parts: string[] = [];
    if (p) {
        writeSharedRackDensity(p.rackKw);
        parts.push(`${p.rackKw} kW/rack`);
        const coolKey = (p.cooling === 'liquid' || p.cooling === 'dlc') ? 'liquid'
            : p.cooling === 'rdhx' ? 'rdhx' : p.cooling === 'inrow' ? 'inrow' : 'air';
        writeSharedCooling(coolKey as 'air' | 'inrow' | 'rdhx' | 'liquid');
        parts.push(coolKey === 'liquid' ? 'D2C liquid' : coolKey);
        const curTier = useSimulationStore.getState().inputs.tierLevel;
        if (p.tierFloor > curTier) {
            useSimulationStore.getState().actions.setTierLevel(p.tierFloor as 2 | 3 | 4);
            parts.push(`Tier ≥${p.tierFloor}`);
        }
    }
    if (!useRequirementsStore.getState().workload.mixManual) {
        useRequirementsStore.getState().actions.setWorkload({ workloadMix: { ...mix } });
        parts.push(`mix ${mix.aiGpu}/${mix.storage}/${mix.general}/${mix.network}`);
    } else {
        parts.push('mix kept (manual override)');
    }
    return parts.join(' · ');
}

/** Owner S7: computed rack count is the basis, the user override wins when set. */
export function effectiveTotalRacks(itLoadKw: number, densityKw: number, override: number | null): number {
    const auto = densityKw > 0 ? Math.ceil(itLoadKw / densityKw) : 0;
    if (override == null) return auto;
    return Math.round(sanitizeNum(override, 1, 100_000, auto));
}
