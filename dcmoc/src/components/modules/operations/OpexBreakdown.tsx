'use client';

/* ─── Complete per-country OPEX breakdown (WS1, 2026-07-27) ───────────────────
 * Renders engine models.opex.fullBreakdown — every annual operating-cost line,
 * grouped (energy/people/contracts/security/compliance/connectivity/real-estate/
 * overhead), with $/yr, % share and per-line basis. Per-country location-variant
 * factors (water tariff, land lease, property-tax %, corp-internet, cleaning,
 * guard) come from DATA.countries[code].opex; global-uniform lines scale by IT MW
 * / racks / gross floor / asset value. A maintenance-strategy selector drives the
 * contract/PM/manpower/availability mix. Additive — does not touch totalAnnual.
 * ──────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { rzModels, rzData, useEngineReady } from '@/lib/rz-engine';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { getPUE } from '@/constants/pue';
import { Layers } from 'lucide-react';

const GROUP_TONE: Record<string, string> = {
    Energy: 'text-rz-info',
    People: 'text-rz-mint',
    'Contracts & Maintenance': 'text-rz-signal',
    Security: 'text-rz-alert',
    'Compliance & Licenses': 'text-rz-data',
    Connectivity: 'text-rz-info',
    'Real Estate & Tax': 'text-rz-signal',
    Overhead: 'text-slate-400',
};

export interface OpexLine { id: string; label: string; annual: number; unit: string; basis: string; perCountry: boolean; }
export interface OpexGroup { group: string; lines: OpexLine[]; }
export interface OpexResult {
    total: number; subtotal: number; overhead: number; perKwMonth: number;
    groups: OpexGroup[]; lines: OpexLine[];
    strategy: { id: string; label: string; availabilityDeltaPct: number; inHouseFte: number; guardPosts: number; contractSplitPct: number };
    countryCode: string; grossFloorM2: number; racks: number; warnings: string[];
}

const fmt = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}k` : `$${n}`;

const STRATEGY_ORDER = ['oem_full', 'predictive_cbm', 'hybrid', 'standard_annual_compliance', 'reactive'];

export function OpexBreakdown() {
    const inputs = useSimulationStore((s) => s.inputs);
    const country = useSimulationStore((s) => s.selectedCountry);
    const capexTotal = useCapexStore((s) => s.results?.total ?? 0);

    /* OPEX maintenance strategy is its own selection (the store's `maintenanceStrategy`
     * is the staffing-mix preset with a different enum) — kept local here; WS3 unifies. */
    const [strategy, setStrategy] = React.useState<string>('standard_annual_compliance');
    const engineReady = useEngineReady();   // recompute once the deferred rz-engine.min.js is present
    const strategies = (rzData()?.opexModel?.maintenanceStrategies ?? {}) as Record<string, { label: string; availabilityDeltaPct: number; costIndexVsOemFull: number; contractSplitPct: number; inHouseFtePer10MW: number }>;

    const result = React.useMemo<OpexResult | null>(() => {
        try {
            const m = rzModels();
            if (!m?.opex?.fullBreakdown) return null;
            const d = rzData();
            const pue = d?.pueMatrix?.[inputs.coolingType]?.['tier' + inputs.tierLevel] ?? getPUE(inputs.coolingType);
            return m.opex.fullBreakdown({
                itMw: inputs.itLoad / 1000,
                pue,
                countryCode: country?.id ?? 'US',
                capex: capexTotal,
                cooling: inputs.coolingType,
                maintenanceStrategy: strategy,
            }) as OpexResult;
        } catch { return null; }
    }, [inputs.itLoad, inputs.coolingType, inputs.tierLevel, country?.id, capexTotal, strategy, engineReady]);

    if (!result) return null;

    const total = result.total;

    return (
        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <Layers className="h-3.5 w-3.5 text-rz-info" /> Complete Annual OPEX
                    <span className="text-[9px] normal-case text-slate-400">per-country sourced · {country?.name ?? '—'}</span>
                </h2>
                <div className="flex items-center gap-2">
                    <label className="text-[10px] uppercase tracking-wide text-slate-500">Maintenance strategy</label>
                    <select
                        value={strategy}
                        onChange={(e) => setStrategy(e.target.value)}
                        className="rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200"
                    >
                        {STRATEGY_ORDER.filter((k) => strategies[k]).map((k) => (
                            <option key={k} value={k}>{strategies[k].label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* headline */}
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Total OPEX / yr</div>
                    <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{fmt(total)}</div>
                </div>
                <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">$/kW · month</div>
                    <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">${result.perKwMonth}</div>
                </div>
                <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">In-house FTE</div>
                    <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{result.strategy.inHouseFte}</div>
                </div>
                <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Availability Δ</div>
                    <div className={`text-xl font-bold tabular-nums ${result.strategy.availabilityDeltaPct < 0 ? 'text-rz-alert' : 'text-rz-data'}`}>
                        {result.strategy.availabilityDeltaPct > 0 ? '+' : ''}{result.strategy.availabilityDeltaPct}pp
                    </div>
                </div>
            </div>

            {/* grouped lines */}
            <div className="space-y-2.5">
                {result.groups.map((g) => {
                    const gTotal = g.lines.reduce((a, l) => a + l.annual, 0);
                    const gShare = total > 0 ? (gTotal / total) * 100 : 0;
                    return (
                        <div key={g.group}>
                            <div className="mb-0.5 flex items-baseline justify-between">
                                <span className={`text-[10px] font-semibold uppercase tracking-wide ${GROUP_TONE[g.group] ?? 'text-slate-500'}`}>{g.group}</span>
                                <span className="text-[10px] tabular-nums text-slate-500">{fmt(gTotal)} · {gShare.toFixed(1)}%</span>
                            </div>
                            <div className="space-y-0.5">
                                {g.lines.map((l) => {
                                    const share = total > 0 ? (l.annual / total) * 100 : 0;
                                    return (
                                        <div key={l.id} className="group flex items-center gap-2 text-[11px]" title={l.basis}>
                                            <span className="w-40 shrink-0 truncate text-slate-700 dark:text-slate-200">
                                                {l.label}
                                                {l.perCountry && <span className="ml-1 rounded bg-rz-info/15 px-1 text-[7px] font-semibold uppercase text-rz-info">geo</span>}
                                            </span>
                                            <div className="h-1.5 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                                                <div className={`h-1.5 rounded ${GROUP_TONE[g.group]?.replace('text-', 'bg-') ?? 'bg-slate-400'}`} style={{ width: `${Math.min(100, share * 2.2)}%` }} />
                                            </div>
                                            <span className="w-14 shrink-0 text-right tabular-nums text-slate-600 dark:text-slate-300">{fmt(l.annual)}</span>
                                            <span className="w-10 shrink-0 text-right text-[9px] tabular-nums text-slate-400">{share.toFixed(1)}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {capexTotal === 0 && (
                <div className="mt-2 rounded border border-rz-signal/40 bg-rz-signal/10 px-2 py-1 text-[10px] text-rz-signal">
                    Property tax &amp; insurance show $0 — run the CAPEX engine to set the asset-value basis.
                </div>
            )}
            <div className="mt-2 text-[9px] text-slate-400">
                Gross floor ≈ {result.grossFloorM2.toLocaleString()} m² · {result.racks} racks · {result.strategy.guardPosts} guard posts · <span className="text-rz-info">geo</span> = per-country sourced factor.
                Sources: tools/dc-corpus/opex-research.
            </div>
        </div>
    );
}
