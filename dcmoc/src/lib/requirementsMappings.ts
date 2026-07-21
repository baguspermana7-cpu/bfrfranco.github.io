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
import { rzData, rzModels } from '@/lib/rz-engine';
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
 * Ship-B: the immersion + microfluidic keys map to real engine rows
 * (DATA.pueMatrix / requirements.coolingMaxRackKw / capexDetail.coolingMult),
 * so they compute end-to-end. `emerging` flags the pilot/research techs
 * (immersion_2p + microfluidic) so the UI can label them advisory. */
export type CoolingKey = 'air' | 'inrow' | 'rdhx' | 'liquid' | 'immersion_1p' | 'immersion_2p' | 'microfluidic';
export type CoolingTopology = 'in-row' | 'perimeter' | 'dlc' | 'immersion' | 'in-chip';
export interface CoolingUiItem { key: CoolingKey; label: string; topology: CoolingTopology; emerging?: boolean }
export const COOLING_UI: CoolingUiItem[] = [
    { key: 'liquid', label: 'Direct-to-Chip Liquid Cooling', topology: 'dlc' },
    { key: 'rdhx', label: 'Rear-Door Heat Exchanger', topology: 'in-row' },
    { key: 'inrow', label: 'In-Row Cooling', topology: 'in-row' },
    { key: 'air', label: 'Air (CRAC/CRAH)', topology: 'perimeter' },
    { key: 'immersion_1p', label: 'Single-phase Immersion', topology: 'immersion' },
    { key: 'immersion_2p', label: 'Two-phase Immersion', topology: 'immersion', emerging: true },
    { key: 'microfluidic', label: 'Microfluidic (in-chip)', topology: 'in-chip', emerging: true },
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

/* The simulation store + its downstream engines (benchmark, grid-reliability,
 * capacity, diagnostics, PDF …) classify cooling into 4 canonical classes.
 * Immersion + microfluidic are direct-liquid thermally, so they downcast to
 * 'liquid'/'dlc' for those engines. The CAPEX store keeps the TRUE key
 * (coolingType: string) → drives the real capexDetail.coolingMult + PUE row,
 * so the advanced/emerging techs still compute end-to-end. */
type SimCoolingKey = 'air' | 'inrow' | 'rdhx' | 'liquid';
type SimCoolingTopology = 'in-row' | 'perimeter' | 'dlc';
export function simCoolingClass(key: CoolingKey): { type: SimCoolingKey; topology: SimCoolingTopology } {
    switch (key) {
        case 'air': return { type: 'air', topology: 'perimeter' };
        case 'inrow': return { type: 'inrow', topology: 'in-row' };
        case 'rdhx': return { type: 'rdhx', topology: 'in-row' };
        // liquid + immersion_1p/2p + microfluidic → direct-liquid class
        default: return { type: 'liquid', topology: 'dlc' };
    }
}

export function writeSharedCooling(key: CoolingKey): void {
    const sim = simCoolingClass(key);
    useSimulationStore.getState().actions.setInputs({ coolingType: sim.type, coolingTopology: sim.topology });
    // CAPEX keeps the TRUE key (string-typed) → real coolingMult + PUE row.
    useCapexStore.getState().setInputs({ coolingType: key });
}

export function writeSharedCountry(countryId: string): void {
    const profile = COUNTRIES[countryId];
    if (!profile) return;
    useSimulationStore.getState().actions.selectCountry(countryId);
    useCapexStore.getState().setInputs({ location: countryId, country: profile });
    /* DA1 — the pristine scenario site FOLLOWS the project country (owner-caught
     * bug: "Indonesia Site" persisting on a UAE project). Lazy import avoids a
     * store import cycle. */
    import('@/store/sites').then((m) => m.useSitesStore.getState().syncToCountry(countryId)).catch(() => {});
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

/* ── Ship-A: AI reference-architecture (engine DATA.requirements.archProfiles) ──
 * Consume-only. The engine holds the canonical rack-kW / GPU / cooling / tier /
 * confidence per architecture; this layer maps them to the Requirements UI and
 * writes the shared density/cooling/tier fields exactly like applyUseCaseProfile. */

export type ArchKey = 'h100_pod' | 'gb200_nvl72' | 'gb300_nvl72' | 'rubin_vr200' | 'ocp_hpr';

export type ArchConfidence = 'official' | 'analyst';

/** Static UI order + copy (engine values are read live via archProfileLive). */
export interface ArchUiEntry { key: ArchKey; label: string; confidence: ArchConfidence; blurb: string }

export const ARCH_UI: ArchUiEntry[] = [
    { key: 'gb300_nvl72', label: 'NVIDIA GB300 NVL72', confidence: 'official', blurb: 'Blackwell Ultra rack — hybrid liquid+air, dedicated cooling kit.' },
    { key: 'gb200_nvl72', label: 'NVIDIA GB200 NVL72', confidence: 'official', blurb: '72 Blackwell + 36 Grace, direct-to-chip liquid + CDU.' },
    { key: 'rubin_vr200', label: 'NVIDIA Vera Rubin VR200 NVL72', confidence: 'analyst', blurb: 'Next-gen NVLink6, 800VDC, 45°C warm-water DLC — rack-kW analyst estimate.' },
    { key: 'ocp_hpr', label: 'OCP ORV3 High-Power Rack', confidence: 'official', blurb: 'Open Rack v3 HPR 92–140 kW; liquid busbar roadmap to 750 kW+.' },
    { key: 'h100_pod', label: 'NVIDIA H100 SuperPOD', confidence: 'official', blurb: 'DGX H100 SuperPOD — air-cooled, 2–4 systems/rack.' },
];

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ArchProfileLive {
    key: ArchKey;
    label: string;
    rackKwNominal: number;
    rackKwPeak: number;
    provisionedRackKw: number;
    gpuCount: number | null;
    cooling: string;
    tierFloor: number;
    confidence: ArchConfidence;
    coolingKitUsdPerRack: number | null;
    roadmapKw: number | null;
    ref: string;
    /** DATA.sources['requirements.archProfiles'].source provenance string. */
    source: string | null;
}

/** Rich engine-live facts for one architecture, or null when the engine is absent. */
export function archProfileLive(key: ArchKey): ArchProfileLive | null {
    try {
        const req = (rzModels() as any)?.requirements;
        const p = req?.archProfile ? req.archProfile(key) : null;
        if (!p) return null;
        const prov = req?.provisionedRackKw ? req.provisionedRackKw(key) : null;
        const src = (rzData() as any)?.sources?.['requirements.archProfiles']?.source ?? null;
        return {
            key,
            label: p.label,
            rackKwNominal: p.rackKwNominal,
            rackKwPeak: p.rackKwPeak ?? p.rackKwNominal,
            provisionedRackKw: prov ?? p.rackKwPeak ?? p.rackKwNominal,
            gpuCount: p.gpuCount ?? null,
            cooling: p.cooling,
            tierFloor: p.tierFloor ?? 3,
            confidence: (p.confidence === 'analyst' ? 'analyst' : 'official'),
            coolingKitUsdPerRack: p.coolingKitUsdPerRack ?? null,
            roadmapKw: p.roadmapKw ?? null,
            ref: p.ref ?? '',
            source: src,
        };
    } catch { return null; }
}

/** Provisioned (peak/EDPp) rack kW for an arch key — 0-safe (CapexEngine consumer). */
export function provisionedRackKwFor(key: ArchKey): number {
    try {
        const req = (rzModels() as any)?.requirements;
        return (req?.provisionedRackKw ? req.provisionedRackKw(key) : 0) || 0;
    } catch { return 0; }
}

/** Marginal power-chain provisioning uplift for an arch key — 1.0-safe. */
export function powerUpliftFor(key: ArchKey): number {
    try {
        const req = (rzModels() as any)?.requirements;
        const u = req?.powerProvisionUplift ? req.powerProvisionUplift(key) : 1.0;
        return u && u > 0 ? u : 1.0;
    } catch { return 1.0; }
}

/** Interconnect fabric cost for a GPU count (analyst estimate) — 0-safe. */
export function interconnectCostFor(fabric: 'infiniband' | 'ethernet', gpuCount: number): number {
    try {
        const req = (rzModels() as any)?.requirements;
        return (req?.interconnectCost ? req.interconnectCost(fabric, gpuCount) : 0) || 0;
    } catch { return 0; }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/** Auto-apply an AI reference architecture (mirrors applyUseCaseProfile):
 *  shared rack density = rackKwNominal (density UI shows nameplate, NOT peak),
 *  cooling from the profile, tier-floor bump if current tier is lower, and
 *  records archKey on the requirements workload + capex stores. Returns a human
 *  summary for the toast. Passing null clears the arch selection. */
export function applyArchProfile(key: ArchKey | null): string {
    if (key == null) {
        useRequirementsStore.getState().actions.setWorkload({ archKey: null });
        useCapexStore.getState().setInputs({ archKey: undefined });
        return 'Reference architecture cleared';
    }
    const p = archProfileLive(key);
    // Record the arch key on both stores regardless (capex uplift keys off it).
    useRequirementsStore.getState().actions.setWorkload({ archKey: key });
    useCapexStore.getState().setInputs({ archKey: key });
    if (!p) return `${key} selected`;

    const parts: string[] = [];
    writeSharedRackDensity(p.rackKwNominal);
    parts.push(`${p.rackKwNominal} kW/rack nominal`);
    const coolKey = (p.cooling === 'liquid' || p.cooling === 'dlc') ? 'liquid'
        : p.cooling === 'rdhx' ? 'rdhx' : p.cooling === 'inrow' ? 'inrow' : 'air';
    writeSharedCooling(coolKey as 'air' | 'inrow' | 'rdhx' | 'liquid');
    parts.push(coolKey === 'liquid' ? 'D2C liquid' : coolKey);
    const curTier = useSimulationStore.getState().inputs.tierLevel;
    if (p.tierFloor > curTier) {
        useSimulationStore.getState().actions.setTierLevel(p.tierFloor as 2 | 3 | 4);
        parts.push(`Tier ≥${p.tierFloor}`);
    }
    parts.push(`${p.provisionedRackKw} kW/rack peak provisioned`);
    if (p.confidence === 'analyst') parts.push('analyst estimate');
    return `${p.label}: ${parts.join(' · ')}`;
}
