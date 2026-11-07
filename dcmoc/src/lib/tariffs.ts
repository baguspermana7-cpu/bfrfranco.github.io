/* ─── Tariffs (v3.25.0) — MRC / NRC defaults by DC business model ────────────
 * ONE bridge between the engine's tariff model (rz-engine.js DATA.tariffs +
 * models.tariffs.resolve) and the stores. The Requirements business section,
 * the Financial AUTO fields, the presentation presets and the Executive /
 * Results screening all read the SAME resolved tariff, so a project opens on
 * the market index × block-size × business-model number and never on a bare
 * literal. GPU-as-a-Service is priced per GPU-hour and converted to an IT-kW
 * equivalent; its GPU fleet is written to sim.itHardwareCapexUsd so every DCF
 * carries the hardware on top of the facility.
 * ──────────────────────────────────────────────────────────────────────────── */

import { rzData, rzModels } from '@/lib/rz-engine';
import { resolveMarketKey } from '@/lib/market-key';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useRequirementsStore, type RevenueModelId, type GaasSkuId, type GaasPricingMode } from '@/store/requirements';

export interface ResolvedTariff {
    model: RevenueModelId;
    label: string;
    pricing: 'perKw' | 'perGpuHour';
    index: { perKwMonth: number; band: [number, number] | null; evidence: string; basis: string; marketKey: string | null };
    blockFactor: number;
    blockBand: string | null;
    indexFactor: number;
    mrcPerKwMonth: number;
    nrcPerKw: number;
    contractYears: number;
    takeOrPayPct: number;
    escalation: number;
    crossConnectNrc: number;
    crossConnectMrc: number;
    gaas: {
        sku: GaasSkuId; label: string; perGpuHour: number; priceBand: [number, number] | null; priceRef: string; mode: string;
        utilization: number; kwPerGpu: number; gpus: number; nodes: number; gpuHoursPerYear: number;
        hardwareCapexUsd: number; hardwareCapexBand: [number, number]; capexPerGpu: number; lifeYears: number;
    } | null;
    basis: string[];
    note: string;
}

export interface TariffArgs {
    model: RevenueModelId;
    itLoadKw: number;
    marketKey?: string | null;
    countryId?: string | null;
    sku?: GaasSkuId;
    pricingMode?: GaasPricingMode;
    utilization?: number;
    pricePerGpuHour?: number;
}

/** Engine-backed resolution; null when the engine is not loaded yet. */
export function resolveTariff(a: TariffArgs): ResolvedTariff | null {
    const m = rzModels();
    if (!m?.tariffs?.resolve) return null;
    return m.tariffs.resolve({
        model: a.model, itLoadKw: a.itLoadKw,
        marketKey: a.marketKey && a.marketKey !== 'none' ? a.marketKey : undefined,
        countryId: a.countryId ?? undefined,
        sku: a.sku, pricingMode: a.pricingMode, utilization: a.utilization, pricePerGpuHour: a.pricePerGpuHour,
    }) as ResolvedTariff;
}

/** The live project's tariff from the stores (requirements business + sim + capex market). */
export function tariffFromStores(): ResolvedTariff | null {
    const sim = useSimulationStore.getState();
    const b = useRequirementsStore.getState().business;
    const cityMarket = useCapexStore.getState().inputs.cityMarket;
    return resolveTariff({
        model: b.revenueModel ?? 'wholesale_colo',
        itLoadKw: sim.inputs.itLoad,
        marketKey: resolveMarketKey(cityMarket),
        countryId: sim.selectedCountry?.id ?? null,
        sku: b.gaasSku, pricingMode: b.gaasPricingMode, utilization: b.gaasUtilization,
    });
}

/** Write the resolved tariff into the sim SSOT (revenue basis + IT-hardware capex).
 *  Returns the tariff so callers can show it. Idempotent: only writes on change. */
export function syncTariffRevenue(): ResolvedTariff | null {
    const t = tariffFromStores();
    if (!t) return null;
    const sim = useSimulationStore.getState();
    const rev = Math.round(t.mrcPerKwMonth);
    const hw = t.gaas ? Math.round(t.gaas.hardwareCapexUsd) : 0;
    const patch: { revenuePerKwMonth?: number; itHardwareCapexUsd?: number } = {};
    if (sim.inputs.revenuePerKwMonth !== rev) patch.revenuePerKwMonth = rev;
    if ((sim.inputs.itHardwareCapexUsd ?? 0) !== hw) patch.itHardwareCapexUsd = hw;
    if (Object.keys(patch).length) sim.actions.setInputs(patch);
    return t;
}

export const REVENUE_MODEL_OPTIONS: { value: RevenueModelId; label: string }[] = (() => {
    const bm = rzData()?.tariffs?.businessModels as Record<string, { label: string }> | undefined;
    const ids: RevenueModelId[] = ['retail_colo', 'wholesale_colo', 'hyperscale_lease', 'gpu_colo', 'gaas', 'enterprise_self'];
    const fallback: Record<RevenueModelId, string> = {
        retail_colo: 'Retail colocation (cabinets / cages, < 1 MW)', wholesale_colo: 'Wholesale colocation (1–10 MW suites)',
        hyperscale_lease: 'Hyperscale / build-to-suit lease (10 MW+)', gpu_colo: 'High-density / GPU colocation (liquid-ready)',
        gaas: 'GPU-as-a-Service (own fleet, $/GPU-hour)', enterprise_self: 'Enterprise owner-occupied (internal chargeback)',
    };
    return ids.map((v) => ({ value: v, label: bm?.[v]?.label ?? fallback[v] }));
})();

export const GAAS_SKU_OPTIONS: { value: GaasSkuId; label: string }[] = [
    { value: 'h100', label: 'H100 SXM (8-GPU node, 10.2 kW)' },
    { value: 'h200', label: 'H200 SXM (8-GPU node, 10.2 kW)' },
    { value: 'b200', label: 'B200 (8-GPU node, 14.3 kW)' },
    { value: 'b300', label: 'B300 (8-GPU node, 14 kW)' },
    { value: 'gb300_nvl72', label: 'GB300 NVL72 (72-GPU rack, 142 kW)' },
];

export const GAAS_MODE_OPTIONS: { value: GaasPricingMode; label: string }[] = [
    { value: 'reserved', label: 'Reserved' }, { value: 'onDemand', label: 'On-demand' }, { value: 'marketplace', label: 'Marketplace' },
];
