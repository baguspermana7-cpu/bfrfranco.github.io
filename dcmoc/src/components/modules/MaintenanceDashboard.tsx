
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSimulationStore, normalizeStrategyMix, STRATEGY_MIX_PRESETS, StrategyMix, effectiveInHouseFrac } from '@/store/simulation';
import { rzModels } from '@/lib/rz-engine';
import { StatusChip } from '@/components/ui/StatusChip';
import { useCapexStore } from '@/store/capex';
import { ASSETS } from '@/constants/assets';
import { calculateEnvironmentalDegradation } from '@/modules/maintenance/EnvironmentalLogic';
import { generateAssetCounts, AssetCount } from '@/lib/AssetGenerator';
import { generateMaintenanceSchedule, MaintenanceEvent } from '@/modules/maintenance/ScheduleEngine';
import {
    calculateStrategyComparison,
    calculateSLAComparison,
    calculateSparesOptimization,
    StrategyProfile,
    SLAComparison,
    SLATier,
} from '@/modules/maintenance/MaintenanceStrategyEngine';
import {
    Wrench, Wind, AlertTriangle, CheckCircle2, Edit3, Save, RotateCcw,
    Calendar, List, TrendingUp, Shield, Package, Zap, DollarSign,
    Clock, BarChart3, ArrowRight, Info, ChevronDown, Flame
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend
} from 'recharts';
import { ExportPDFButton } from '@/components/ui/ExportPDFButton';
import clsx from 'clsx';
import { fmtMoney } from '@/lib/format';
import { useEngineReady } from '@/lib/rz-engine';
import { sparesPricingBands, SparesPriceBandRow } from '@/state/adapters/spares-adapter';
import { TraceValue } from '@/components/ui/TraceValue';

type TabId = 'assets' | 'schedule' | 'strategy' | 'sla' | 'spares';

// ═══════════════════════════════════════════════════════════════
// DIAGNOSTICS TIER-1 — SLA risk-exposure threshold + explain
// (owner mandate: no naked red number without computed guidance —
// same pattern as PhasedFinancialDashboard / lib/decision-explain)
// ═══════════════════════════════════════════════════════════════

/** Single source for the risk-exposure colour thresholds ($/yr). */
export const SLA_RISK_RED_USD = 50_000;
export const SLA_RISK_AMBER_USD = 20_000;

type RiskTone = 'red' | 'amber' | 'ok';
const riskTone = (v: number): RiskTone =>
    v > SLA_RISK_RED_USD ? 'red' : v > SLA_RISK_AMBER_USD ? 'amber' : 'ok';
const RISK_TONE_CLASS: Record<RiskTone, string> = {
    red: 'text-red-500 dark:text-red-400',
    amber: 'text-amber-500 dark:text-amber-400',
    ok: 'text-rz-data',
};

/* Engine model (MaintenanceStrategyEngine.calculateSLAComparison):
 *   riskExposure = baseFailures × responseWindowMin × downtimeCost$/min × 1%
 * where baseFailures = 0.8/yr (Tier IV) or 2.0/yr (Tier III) and the response
 * window is 960 / 240 / 120 min for NBD / 4hr / 2hr. The panel re-states these
 * factors and VERIFIES the product against the live engine number (parity
 * chip) — if the engine model ever drifts, the panel says so instead of
 * showing a wrong decomposition. */
const SLA_RESPONSE_MIN: Record<SLATier['id'], number> = { nbd: 960, '4hr': 240, '2hr': 120 };
const SLA_PROB_WEIGHT = 0.01; // engine 1% probability weighting
const slaBaseFailures = (tierLevel: 3 | 4): number => (tierLevel === 4 ? 0.8 : 2.0);

interface SlaLever {
    label: string;
    /** Quantified sentence — every number taken live from the SAME SLAComparison output. */
    detail: string;
    /** netAnnualCost delta of the move (≤0 = net saving). */
    netDelta: number;
}

/** Measured upgrade levers, computed from the same calculateSLAComparison
 *  output the table renders — no re-implemented math, no fabricated numbers. */
const slaUpgradeLevers = (tier: SLATier, tiers: SLATier[]): SlaLever[] =>
    tiers
        .filter(f => SLA_RESPONSE_MIN[f.id] < SLA_RESPONSE_MIN[tier.id])
        .map(f => {
            const dRisk = tier.riskExposure - f.riskExposure;
            const dFee = f.annualCost - tier.annualCost;
            const netDelta = f.netAnnualCost - tier.netAnnualCost;
            const bandNote = f.contractPerKwYr && f.omTierKey
                ? ` (${f.omTierKey} contract $${f.contractPerKwYr.mid}/kW-yr mid from DATA.omContracts)`
                : '';
            return {
                label: `Upgrade SLA ${tier.label} → ${f.label}`,
                detail: `Exposure ${fmtMoney(tier.riskExposure)} → ${fmtMoney(f.riskExposure)}/yr (−${fmtMoney(dRisk)}); ` +
                    `contract cost ${dFee >= 0 ? '+' : '−'}${fmtMoney(Math.abs(dFee))}/yr${bandNote} — ` +
                    `net ${netDelta <= 0 ? 'saving' : 'added cost'} ${fmtMoney(Math.abs(netDelta))}/yr.`,
                netDelta,
            };
        });

/** Diagnostics finding — consumed by the cross-module Diagnostics rollup. */
export interface Finding {
    id: string;
    severity: 'critical' | 'warning';
    title: string;
    detail: string;
    linkTab: 'maint';
    value: number;
    threshold: number;
}

export interface MaintenanceDiagnosticsModel {
    sla: SLAComparison | null;
}

/** Diagnostics Tier-1 collector — pure function over the SAME
 *  calculateSLAComparison output the SLA tab renders (linkTab:'maint'). */
export function collectMaintenanceDiagnostics(model: MaintenanceDiagnosticsModel): Finding[] {
    if (!model.sla) return [];
    const findings: Finding[] = [];
    for (const tier of model.sla.tiers) {
        const tone = riskTone(tier.riskExposure);
        if (tone === 'ok') continue;
        const threshold = tone === 'red' ? SLA_RISK_RED_USD : SLA_RISK_AMBER_USD;
        const levers = slaUpgradeLevers(tier, model.sla.tiers);
        const bestSaving = [...levers].filter(l => l.netDelta <= 0).sort((a, b) => a.netDelta - b.netDelta)[0];
        const leverText = bestSaving
            ? ` Lever: ${bestSaving.detail}`
            : levers.length > 0
                ? ` Upgrading the SLA adds net cost (trade-off, not a saving): ${levers[0].detail}`
                : ' The fastest SLA is already selected — the remaining exposure is driven by incident rate × downtime cost (a design/location decision, not the contract).';
        findings.push({
            id: `sla-risk-${tier.id}`,
            severity: tone === 'red' ? 'critical' : 'warning',
            title: `Risk exposure ${tier.label} ${fmtMoney(tier.riskExposure)}/yr > threshold ${fmtMoney(threshold)}/yr`,
            detail: `The downtime exposure not covered by the ${tier.label} SLA is ${fmtMoney(tier.riskExposure)}/yr ` +
                `(net annual cost ${fmtMoney(tier.netAnnualCost)}/yr).${leverText}`,
            linkTab: 'maint',
            value: tier.riskExposure,
            threshold,
        });
    }
    return findings;
}

/* ═══ Workstream G-mix — strategy as a % MIX editor ═══════════════════════
 * The 3 discrete strategy buttons above act as PRESETS (pure mixes); this
 * compact editor lets the owner blend them (e.g. RTF 20 · PPM 50 · PdM 30).
 * Editing one component keeps the other two proportional so the mix always
 * sums to exactly 100%. The mix drives the engine ops models: labor demand
 * (opsHeadcount), failure rate + availability (availabilityImpact). ═══════ */

const MIX_KEYS = ['reactive', 'planned', 'predictive'] as const;
const MIX_LABELS: Record<(typeof MIX_KEYS)[number], string> = { reactive: 'RTF', planned: 'PPM', predictive: 'PdM' };

function StrategyMixEditor() {
    const { inputs, actions } = useSimulationStore();
    const mix = normalizeStrategyMix(
        inputs.strategyMix ?? STRATEGY_MIX_PRESETS[inputs.maintenanceStrategy || 'planned']
    );
    // Display percentages that always sum to 100 (planned absorbs rounding)
    const rPct = Math.round(mix.reactive * 100);
    const dPct = Math.round(mix.predictive * 100);
    const pPct = 100 - rPct - dPct;
    const pctOf: Record<(typeof MIX_KEYS)[number], number> = { reactive: rPct, planned: pPct, predictive: dPct };

    const setComponent = (key: (typeof MIX_KEYS)[number], rawPct: number) => {
        const v = Math.max(0, Math.min(100, Number.isFinite(rawPct) ? rawPct : 0)) / 100;
        const others = MIX_KEYS.filter(k => k !== key);
        const otherSum = others.reduce((a, k) => a + mix[k], 0);
        const rest = 1 - v;
        const next: StrategyMix = { ...mix, [key]: v };
        others.forEach(k => {
            next[k] = otherSum > 0 ? (mix[k] / otherSum) * rest : rest / others.length;
        });
        actions.setInputs({ strategyMix: next });
    };

    return (
        <div className="flex flex-wrap items-center gap-3 bg-slate-100 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                Mix % <Tooltip content="Maintenance strategy as a % mix instead of a single discrete choice. Run-to-Failure (RTF) share drops PM work but multiplies failures ×3.5; Planned (PPM) carries the SFG20 PM program at baseline; Predictive (PdM) cuts PM task hours and failures ×0.3 but adds CBM analysis hours. The mix drives maintenance labor demand, expected failure rate, staffing (Staffing page ops model) and computed availability (Risk page). The strategy buttons above are pure-mix presets; edits here keep the three shares summing to 100%." />
            </span>
            {MIX_KEYS.map(k => (
                <label key={k} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className={clsx('font-semibold', k === 'reactive' ? 'text-red-500 dark:text-red-400' : k === 'planned' ? 'text-blue-500 dark:text-blue-400' : 'text-rz-data')}>{MIX_LABELS[k]}</span>
                    <input
                        type="number" min={0} max={100} step={5}
                        value={pctOf[k]}
                        aria-label={`${MIX_LABELS[k]} share %`}
                        onChange={(e) => setComponent(k, Number(e.target.value))}
                        className="w-14 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-slate-900 dark:text-white text-right"
                    />
                    <span>%</span>
                </label>
            ))}
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300" title="Active strategy mix (normalized to 100%)">
                RTF {rPct}% · PPM {pPct}% · PdM {dPct}%
            </span>
        </div>
    );
}

export function MaintenanceDashboard() {
    const { selectedCountry, inputs, actions } = useSimulationStore();
    const { inputs: capexInputs } = useCapexStore();

    // Local state
    const [assetCounts, setAssetCounts] = useState<AssetCount[]>([]);
    const [isPencilMode, setIsPencilMode] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('assets');
    const [isExporting, setIsExporting] = useState(false);
    // Engine O&M contract options (DATA.omContracts sourced multipliers)
    const [slaThirdParty, setSlaThirdParty] = useState(false);   // third-party vs OEM contract (×0.65)
    const [slaFacilityAged, setSlaFacilityAged] = useState(false); // facility >10yr (×1.5)
    const engineReady = useEngineReady(); // re-run engine-bound memos once rz-engine.min.js lands

    /* Workstream 10 — planned-maintenance compliance regime: OEM-full vs standard-
     * annual. Compute the ops headcount under BOTH so the UI shows the manpower delta
     * (standard-annual pulls most PM to annual → far fewer labor-hours). */
    const pmRegimeCompare = useMemo(() => {
        const fn = rzModels().maintenance?.opsHeadcount;
        if (typeof fn !== 'function') return null;
        const common = {
            itLoadKw: inputs.itLoad,
            tier: inputs.tierLevel,
            mix: inputs.strategyMix ?? STRATEGY_MIX_PRESETS[inputs.maintenanceStrategy || 'planned'],
            inHouseFrac: effectiveInHouseFrac(inputs),
        };
        try {
            const oem = fn({ ...common, pmRegime: 'oem-full' }) as { totalFte: number; laborHours: { pm: number; total: number } };
            const std = fn({ ...common, pmRegime: 'standard-annual' }) as { totalFte: number; laborHours: { pm: number; total: number } };
            return { oem, std };
        } catch { return null; }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputs.itLoad, inputs.tierLevel, inputs.strategyMix, inputs.maintenanceStrategy, inputs.maintenanceModel, inputs.hybridRatio, engineReady]);

    const schedule = useMemo(() => {
        return generateMaintenanceSchedule(assetCounts);
    }, [assetCounts]);

    const strategyData = useMemo(() => {
        if (!selectedCountry || assetCounts.length === 0) return null;
        return calculateStrategyComparison(
            assetCounts, schedule,
            inputs.tierLevel === 4 ? 4 : 3,
            selectedCountry,
            inputs.maintenanceModel as 'in-house' | 'hybrid' | 'vendor',
            inputs.hybridRatio ?? 0.5
        );
    }, [assetCounts, schedule, inputs.tierLevel, selectedCountry, inputs.maintenanceModel, inputs.hybridRatio]);

    const slaData = useMemo(() => {
        if (!selectedCountry || assetCounts.length === 0) return null;
        return calculateSLAComparison(
            assetCounts,
            inputs.tierLevel === 4 ? 4 : 3,
            selectedCountry,
            // Engine omContracts pricing: sourced $/kW-yr band × IT kW (+ multipliers)
            { itLoadKw: inputs.itLoad, thirdParty: slaThirdParty, facilityAgeYears: slaFacilityAged ? 12 : 0 }
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assetCounts, inputs.tierLevel, selectedCountry, inputs.itLoad, slaThirdParty, slaFacilityAged, engineReady]);

    // Diagnostics Tier-1: Tier IV design counterfactual — the SAME
    // calculateSLAComparison model re-run at tier level 4 (expected incidents
    // 2.0 → 0.8/yr). Feeds the risk-exposure explain panel as a measured
    // design lever; only meaningful when the current design is Tier III.
    const slaTier4Alt = useMemo(() => {
        if (!selectedCountry || assetCounts.length === 0 || inputs.tierLevel === 4) return null;
        return calculateSLAComparison(
            assetCounts, 4, selectedCountry,
            { itLoadKw: inputs.itLoad, thirdParty: slaThirdParty, facilityAgeYears: slaFacilityAged ? 12 : 0 }
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assetCounts, inputs.tierLevel, selectedCountry, inputs.itLoad, slaThirdParty, slaFacilityAged, engineReady]);

    const sparesData = useMemo(() => {
        if (!selectedCountry || assetCounts.length === 0) return null;
        return calculateSparesOptimization(
            assetCounts,
            inputs.tierLevel === 4 ? 4 : 3,
            selectedCountry
        );
    }, [assetCounts, inputs.tierLevel, selectedCountry]);

    // Sourced DATA.sparesPricing bands (same engine read whose mid band feeds
    // the spares-adapter newsvendor unit cost — imported, not re-implemented)
    const sparesBands = useMemo(() => sparesPricingBands(),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [engineReady]);

    // Initial Generation Effect — use simulation store for consistency with FuelGen/CBM
    const coolingMap: 'air' | 'pumped' = inputs.coolingType === 'liquid' || inputs.coolingType === 'rdhx' ? 'pumped' : 'air';
    useEffect(() => {
        if (!isPencilMode) {
            const estBuildingArea = inputs.itLoad * 1.5;
            const counts = generateAssetCounts(
                inputs.itLoad,
                inputs.tierLevel === 4 ? 4 : 3,
                coolingMap,
                estBuildingArea,
                inputs.coolingTopology,
                inputs.powerRedundancy
            );
            setAssetCounts(counts);
        }
    }, [inputs.itLoad, inputs.tierLevel, inputs.coolingType, isPencilMode, inputs.coolingTopology, inputs.powerRedundancy]);

    const handleCountChange = (assetId: string, newCount: number) => {
        setAssetCounts(prev => prev.map(a =>
            a.assetId === assetId ? { ...a, count: newCount, isManual: true } : a
        ));
    };

    const handleReset = () => {
        setIsPencilMode(false);
    };

    if (!selectedCountry) return null;

    const currentAQI = inputs.aqiOverride ?? selectedCountry.environment.baselineAQI;
    const isHighAQI = currentAQI > 100;

    const activeAssets = ASSETS.filter(a => {
        const countObj = assetCounts.find(c => c.assetId === a.id);
        return countObj && countObj.count > 0;
    });

    const weeks = Array.from({ length: 52 }, (_, i) => i + 1);


    // KPI calculations
    const totalMaintHours = schedule.reduce((a, e) => a + e.durationHours, 0);
    const activeStrategyId = inputs.maintenanceStrategy || 'planned';
    const annualBudget = strategyData?.strategies.find(s => s.id === activeStrategyId)?.totalAnnualCost || 0;
    const predictedSavings = strategyData?.fiveYearSavings || 0;

    const strategyLabels: Record<string, string> = { reactive: 'Run-to-Failure', planned: 'Planned Preventive', predictive: 'Predictive (CBM)' };
    const strategyName = strategyLabels[activeStrategyId] || 'Planned Preventive';

    const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
        { id: 'assets', label: 'Assets', icon: <List className="w-4 h-4" /> },
        { id: 'schedule', label: 'Schedule', icon: <Calendar className="w-4 h-4" /> },
        { id: 'strategy', label: 'Strategy', icon: <TrendingUp className="w-4 h-4" /> },
        { id: 'sla', label: 'SLA', icon: <Shield className="w-4 h-4" /> },
        { id: 'spares', label: 'Spares', icon: <Package className="w-4 h-4" /> },
    ];

    return (
        <div className="space-y-6">
            {/* ═══ HEADER ═══ */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl backdrop-blur-sm shadow-sm dark:shadow-none gap-4">
                <div className="flex flex-col gap-2">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Wrench className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
                            Maintenance & Asset Lifecycle
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                            SFG20 regimes & strategy analysis for <span className="text-slate-900 dark:text-white font-medium">{selectedCountry.name}</span>
                        </p>
                    </div>
                    <ExportPDFButton
                        isGenerating={isExporting}
                        onExport={async () => {
                            if (!selectedCountry || !strategyData || !slaData || !sparesData || !schedule) return;
                            setIsExporting(true);
                            try {
                                const { generateMaintenancePDF } = await import('@/modules/reporting/PdfGenerator');
                                const { generateMaintenanceNarrative } = await import('@/modules/reporting/ExecutiveSummaryGenerator');
                                const narrative = generateMaintenanceNarrative(strategyData, slaData, sparesData);
                                await generateMaintenancePDF(
                                    selectedCountry,
                                    strategyData,
                                    slaData,
                                    sparesData,
                                    schedule,
                                    undefined,
                                    narrative
                                );
                            } finally {
                                setIsExporting(false);
                            }
                        }}
                        className="w-fit"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Maintenance STRATEGY Selector (Fix) + G-mix % editor */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 w-fit">
                            {(['reactive', 'planned', 'predictive'] as const).map((strat) => (
                                <button
                                    key={strat}
                                    onClick={() => actions.setInputs({ maintenanceStrategy: strat })}
                                    title={`Preset: sets the strategy mix to 100% ${strat}`}
                                    className={clsx(
                                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize",
                                        inputs.maintenanceStrategy === strat
                                            ? "bg-rz-data text-black shadow-sm"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800"
                                    )}
                                >
                                    {strat}
                                </button>
                            ))}
                        </div>
                        <StrategyMixEditor />
                    </div>

                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2" />

                    {/* Maintenance Model Selector */}
                    <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                        {(['in-house', 'hybrid', 'vendor'] as const).map((model) => (
                            <button
                                key={model}
                                onClick={() => actions.setInputs({ maintenanceModel: model })}
                                className={clsx(
                                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize",
                                    inputs.maintenanceModel === model
                                        ? "bg-indigo-600 text-white shadow-sm"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800"
                                )}
                            >
                                {model}
                            </button>
                        ))}
                    </div>

                    {/* Hybrid Slider */}
                    {inputs.maintenanceModel === 'hybrid' && (
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                            <span className="text-xs text-slate-500 dark:text-slate-400">In-House: <Tooltip content="Percentage of maintenance work performed by in-house staff vs outsourced contractors. Higher in-house ratio reduces response time but increases fixed payroll cost." /></span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="10"
                                    className="w-20 accent-indigo-500"
                                    value={(inputs.hybridRatio || 0.3) * 100}
                                    onChange={(e) => actions.setInputs({ hybridRatio: Number(e.target.value) / 100 })}
                                />
                                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                    {((inputs.hybridRatio || 0.3) * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="hidden md:block h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2" />

                    {/* Pencil Mode Toggle (only for assets/schedule tabs) */}
                    {(activeTab === 'assets' || activeTab === 'schedule') && (
                        <>
                            <button
                                onClick={() => setIsPencilMode(!isPencilMode)}
                                className={clsx(
                                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border",
                                    isPencilMode
                                        ? "bg-indigo-50 dark:bg-indigo-600/20 border-indigo-200 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300"
                                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                )}
                            >
                                {isPencilMode ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                                {isPencilMode ? "Save" : "Edit"}
                            </button>
                            <div className="hidden md:block h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
                        </>
                    )}

                    {/* AQI Slider */}
                    <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-950 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <Wind className={clsx("w-4 h-4", isHighAQI ? "text-amber-500" : "text-rz-data")} />
                            AQI: <Tooltip content="Air Quality Index (0-300) at the facility location. Higher AQI accelerates filter degradation, increases HVAC maintenance frequency, and reduces equipment lifespan." />
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="500"
                            value={currentAQI}
                            className="w-24 accent-cyan-500"
                            onChange={(e) => actions.setAqiOverride(Number(e.target.value))}
                        />
                        <span className="font-mono font-bold text-slate-900 dark:text-white w-8 text-right">{currentAQI}</span>
                    </div>
                </div>
            </div>

            {/* ═══ KPI ROW ═══ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Annual Maint Budget', value: fmtMoney(annualBudget), sub: strategyName, icon: DollarSign, color: 'text-rz-data', bg: 'bg-rz-data/10 dark:bg-rz-data/10', tip: 'Total annual maintenance budget based on selected strategy (labor + parts + downtime risk)', trace: 'maint.annualBudget' },
                    { label: 'Maintenance Events', value: `${schedule.length}`, sub: `${totalMaintHours.toFixed(0)} total hours`, icon: Wrench, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10', tip: 'Number of scheduled maintenance events per year based on SFG20 regimes', trace: 'maint.events' },
                    { label: 'Active Assets', value: `${assetCounts.reduce((a, c) => a + c.count, 0)}`, sub: `${activeAssets.length} asset types`, icon: Zap, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', tip: 'Total physical assets requiring maintenance, auto-generated from CAPEX config', trace: 'maint.activeAssets' },
                    { label: '5-Year Savings', value: fmtMoney(predictedSavings), sub: 'Optimal vs Worst', icon: TrendingUp, color: 'text-rz-mint', bg: 'bg-rz-mint/10', tip: 'Projected savings over 5 years comparing optimal vs worst maintenance strategy', trace: 'maint.fiveYearSavings' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm dark:shadow-none">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={clsx("p-1.5 rounded-lg", kpi.bg)}>
                                <kpi.icon className={clsx('w-4 h-4', kpi.color)} />
                            </div>
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">{kpi.label} <Tooltip content={(kpi as any).tip} /></span>
                        </div>
                        {kpi.trace ? (
                            <TraceValue traceId={kpi.trace}>
                                <div className="text-xl font-bold text-slate-900 dark:text-white truncate" title={kpi.value.toString()}>{kpi.value}</div>
                            </TraceValue>
                        ) : (
                            <div className="text-xl font-bold text-slate-900 dark:text-white truncate" title={kpi.value.toString()}>{kpi.value}</div>
                        )}
                        <div className="text-xs text-slate-500 mt-1">{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* ═══ TAB NAVIGATION ═══ */}
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center whitespace-nowrap",
                            activeTab === tab.id
                                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700"
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-900 border border-transparent"
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══ TAB CONTENT ═══ */}
            {activeTab === 'assets' && <AssetsTab assets={activeAssets} assetCounts={assetCounts} isPencilMode={isPencilMode} handleCountChange={handleCountChange} selectedCountry={selectedCountry} currentAQI={currentAQI} />}
            {activeTab === 'schedule' && <ScheduleTab assetCounts={assetCounts} schedule={schedule} weeks={weeks} />}
            {activeTab === 'strategy' && (
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 mb-6">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                        <Wrench className="w-4 h-4 text-rz-info" />
                        Planned-Maintenance Compliance Regime <Tooltip content="Two ways to run a planned program. OEM-compliant executes every OEM PM task at the manufacturer's interval — maximum reliability and warranty compliance, maximum manpower. Standard consolidates most tasks to annual and keeps only 1-2 critical systems (UPS batteries, gensets) at OEM frequency — far fewer labor-hours, but ~12% higher failure exposure from deferred servicing." />
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">Applies to the planned share of the strategy mix. Standard-annual trades a small reliability margin for a large manpower reduction.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {([
                            { id: 'oem-full', title: 'OEM-Compliant (Full)', desc: 'Every OEM PM task at its OEM interval. Max reliability + warranty compliance.', fte: pmRegimeCompare?.oem.totalFte, pmH: pmRegimeCompare?.oem.laborHours.pm },
                            { id: 'standard-annual', title: 'Standard (Annual)', desc: 'Most tasks consolidated to annual; only 1-2 critical systems keep OEM frequency. Far less manpower, ~12% higher failure exposure.', fte: pmRegimeCompare?.std.totalFte, pmH: pmRegimeCompare?.std.laborHours.pm },
                        ] as const).map((opt) => {
                            const active = (inputs.pmRegime ?? 'oem-full') === opt.id;
                            return (
                                <button key={opt.id} type="button" onClick={() => actions.setInputs({ pmRegime: opt.id })}
                                    className={clsx(
                                        "text-left p-4 rounded-lg border transition-all",
                                        active ? "border-rz-info ring-2 ring-rz-info/30 bg-rz-info/5" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                    )}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">{opt.title}</span>
                                        {active && <StatusChip tone="info">Selected</StatusChip>}
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2">{opt.desc}</p>
                                    {opt.fte != null && (
                                        <div className="flex items-center gap-3 text-[11px]">
                                            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{opt.fte} FTE</span>
                                            <span className="text-slate-400">·</span>
                                            <span className="font-mono text-slate-500">{opt.pmH?.toLocaleString()} PM h/yr</span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {pmRegimeCompare && (() => {
                        const fteSaved = Math.max(0, pmRegimeCompare.oem.totalFte - pmRegimeCompare.std.totalFte);
                        const pmHSaved = pmRegimeCompare.oem.laborHours.pm - pmRegimeCompare.std.laborHours.pm;
                        return (
                            <p className="mt-3 text-[11px] text-cyan-700 dark:text-rz-info">
                                Switching OEM-full → standard-annual cuts <strong>{pmHSaved.toLocaleString()} PM labor-hours/yr</strong>
                                {fteSaved > 0
                                    ? <> ≈ <strong>{fteSaved} fewer FTE</strong></>
                                    : <> — at this size the headcount stays <strong>floor-bound</strong> by 24/7 emergency-response coverage (the saving lands on vendor/overtime labor cost, and the FTE drop appears at larger campuses)</>}
                                . The trade is ~12% higher failure exposure, reflected in Reliability/Risk availability.
                            </p>
                        );
                    })()}
                </div>
            )}
            {activeTab === 'strategy' && strategyData && <StrategyTab data={strategyData} fmt={fmtMoney} activeStrat={inputs.maintenanceStrategy || 'planned'} onSelect={(s) => actions.setInputs({ maintenanceStrategy: s as any })} />}
            {activeTab === 'sla' && slaData && (
                <SLATab
                    data={slaData} fmt={fmtMoney}
                    thirdParty={slaThirdParty} onThirdParty={setSlaThirdParty}
                    facilityAged={slaFacilityAged} onFacilityAged={setSlaFacilityAged}
                    tierLevel={inputs.tierLevel === 4 ? 4 : 3}
                    downtimeCostPerMin={selectedCountry.risk.downtimeCostPerMin}
                    tier4Alt={slaTier4Alt}
                    selectedSla={inputs.slaKey ?? '4hr'}
                    onSelectSla={(k) => actions.setInputs({ slaKey: k })}
                />
            )}
            {activeTab === 'spares' && sparesData && <SparesTab data={sparesData} fmt={fmtMoney} bands={sparesBands} />}

            {/* ═══ B17: MAINTENANCE EVENT TIMELINE (Monthly Heatmap) ═══ */}
            {activeTab === 'schedule' && schedule.length > 0 && (
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Flame className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                            Monthly Maintenance Density Heatmap <Tooltip content="Visual heatmap showing maintenance task concentration across months. Darker cells indicate higher maintenance workload — helps identify peak periods for resource planning." />
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Event intensity by month — darker = more maintenance events</p>
                    </div>
                    <div className="p-6">
                        {(() => {
                            const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            // Count events per month (weekNumber -> month mapping)
                            const monthCounts = new Array(12).fill(0);
                            schedule.forEach(event => {
                                const monthIdx = Math.min(11, Math.floor((event.weekNumber - 1) / 4.33));
                                monthCounts[monthIdx]++;
                            });
                            const maxCount = Math.max(...monthCounts, 1);

                            return (
                                <div>
                                    <div className="grid grid-cols-12 gap-2 mb-4">
                                        {MONTHS.map((month, idx) => {
                                            const count = monthCounts[idx];
                                            const intensity = count / maxCount;
                                            // Color from slate (low) through amber to red (high)
                                            const bg = intensity === 0
                                                ? 'bg-slate-100 dark:bg-slate-800'
                                                : intensity < 0.25
                                                    ? 'bg-rz-data/10 dark:bg-rz-data/30'
                                                    : intensity < 0.5
                                                        ? 'bg-amber-100 dark:bg-amber-900/30'
                                                        : intensity < 0.75
                                                            ? 'bg-orange-200 dark:bg-orange-900/40'
                                                            : 'bg-red-200 dark:bg-red-900/40';
                                            const textColor = intensity === 0
                                                ? 'text-slate-400 dark:text-slate-600'
                                                : intensity < 0.5
                                                    ? 'text-slate-700 dark:text-slate-300'
                                                    : 'text-slate-900 dark:text-white';

                                            return (
                                                <div
                                                    key={month}
                                                    className={clsx(
                                                        "flex flex-col items-center justify-center rounded-lg p-3 border transition-all hover:scale-105",
                                                        bg,
                                                        intensity > 0.5 ? 'border-orange-300 dark:border-orange-800/50' : 'border-slate-200 dark:border-slate-700/50'
                                                    )}
                                                >
                                                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">{month}</span>
                                                    <span className={clsx("text-lg font-bold font-mono mt-1", textColor)}>{count}</span>
                                                    <span className="text-[9px] text-slate-400 dark:text-slate-500">events</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500">
                                        <span>Low</span>
                                        <div className="flex gap-0.5">
                                            <div className="w-4 h-2 rounded-sm bg-slate-100 dark:bg-slate-800" />
                                            <div className="w-4 h-2 rounded-sm bg-rz-data/10 dark:bg-rz-data/30" />
                                            <div className="w-4 h-2 rounded-sm bg-amber-100 dark:bg-amber-900/30" />
                                            <div className="w-4 h-2 rounded-sm bg-orange-200 dark:bg-orange-900/40" />
                                            <div className="w-4 h-2 rounded-sm bg-red-200 dark:bg-red-900/40" />
                                        </div>
                                        <span>High</span>
                                        <span className="ml-4">Total: {schedule.length} events/year</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* ═══ B18: SPARE PARTS ABC PARETO CHART ═══ */}
            {activeTab === 'spares' && sparesData && sparesData.items.length > 0 && (
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-rz-mint" />
                            Spare Parts ABC Pareto Analysis <Tooltip content="ABC classification of spare parts by value: A-items (top 20% by cost, ~80% of value), B-items (next 30%), C-items (remaining 50%). Drives inventory investment strategy." />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        {(() => {
                            // Sort items by cost descending, take top items representing ~80% of budget
                            const sorted = [...sparesData.items]
                                .sort((a, b) => (b.unitCost * b.quantity) - (a.unitCost * a.quantity));
                            const totalCost = sorted.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);

                            // Build Pareto data
                            let cumulative = 0;
                            const paretoData = sorted.slice(0, 15).map((item, idx) => {
                                const itemCost = item.unitCost * item.quantity;
                                cumulative += itemCost;
                                return {
                                    name: item.partName.length > 18 ? item.partName.slice(0, 16) + '..' : item.partName,
                                    cost: itemCost,
                                    cumulativePct: totalCost > 0 ? (cumulative / totalCost) * 100 : 0,
                                };
                            });

                            return (
                                <div>
                                    <ResponsiveContainer width="100%" height={320}>
                                        <ComposedChart data={paretoData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis
                                                dataKey="name"
                                                stroke="#64748b"
                                                fontSize={10}
                                                angle={-35}
                                                textAnchor="end"
                                                height={70}
                                            />
                                            <YAxis
                                                yAxisId="left"
                                                stroke="#FFAA00"
                                                fontSize={11}
                                                tickFormatter={(v: number) => fmtMoney(v)}
                                            />
                                            <YAxis
                                                yAxisId="right"
                                                orientation="right"
                                                stroke="#f59e0b"
                                                fontSize={11}
                                                domain={[0, 100]}
                                                tickFormatter={(v: number) => `${v}%`}
                                            />
                                            <RTooltip
                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                                labelStyle={{ color: '#e2e8f0' }}
                                                formatter={((value: number, name: string) => [
                                                    name === 'cost' ? fmtMoney(value) : `${value.toFixed(1)}%`,
                                                    name === 'cost' ? 'Item Cost' : 'Cumulative %'
                                                ]) as any}
                                            />
                                            <Legend formatter={(value: string) => value === 'cost' ? 'Item Cost' : 'Cumulative %'} />
                                            <Bar yAxisId="left" dataKey="cost" fill="#FFAA00" radius={[4, 4, 0, 0]} barSize={24} name="cost" />
                                            <Line yAxisId="right" type="monotone" dataKey="cumulativePct" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} name="cumulativePct" />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {(() => {
                                            // ABC classification
                                            let cumPct = 0;
                                            let aCount = 0, bCount = 0, cCount = 0;
                                            sorted.forEach(item => {
                                                const itemCost = item.unitCost * item.quantity;
                                                cumPct += totalCost > 0 ? (itemCost / totalCost) * 100 : 0;
                                                if (cumPct <= 80) aCount++;
                                                else if (cumPct <= 95) bCount++;
                                                else cCount++;
                                            });
                                            return [
                                                { label: 'Class A (0-80%)', count: aCount, color: 'text-red-500 dark:text-red-400', desc: 'High-value, critical' },
                                                { label: 'Class B (80-95%)', count: bCount, color: 'text-amber-500 dark:text-amber-400', desc: 'Medium-value' },
                                                { label: 'Class C (95-100%)', count: cCount, color: 'text-rz-data', desc: 'Low-value, bulk' },
                                            ].map((cls, i) => (
                                                <div key={i} className="text-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                                    <div className="text-xs text-slate-500 mb-1">{cls.label}</div>
                                                    <div className={clsx("text-xl font-bold font-mono", cls.color)}>{cls.count}</div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">{cls.desc}</div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════
// TAB: Assets (existing grid)
// ═══════════════════════════════════════════════════════════════

function AssetsTab({ assets, assetCounts, isPencilMode, handleCountChange, selectedCountry, currentAQI }: {
    assets: typeof ASSETS;
    assetCounts: AssetCount[];
    isPencilMode: boolean;
    handleCountChange: (id: string, n: number) => void;
    selectedCountry: any;
    currentAQI: number;
}) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20 animate-in fade-in zoom-in-95 duration-300">
            {assets.map((asset) => {
                const countObj = assetCounts.find(c => c.assetId === asset.id);
                const count = countObj?.count || 0;

                return (
                    <div key={asset.id} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-300 dark:hover:border-slate-600 transition-all group relative shadow-sm dark:shadow-none">
                        {countObj?.isManual && (
                            <div className="absolute top-0 right-0 p-1 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-bl-lg border-b border-l border-indigo-200 dark:border-indigo-500/30">
                                <Edit3 className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                            </div>
                        )}

                        <div className="p-5 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-start bg-slate-50/50 dark:bg-transparent">
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-xs font-semibold text-cyan-600 dark:text-cyan-500 uppercase tracking-wider mb-1">
                                            {asset.category}
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-cyan-700 dark:group-hover:text-white transition-colors flex items-center gap-3">
                                            {asset.name}
                                            {isPencilMode && (
                                                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-1">
                                                    <button
                                                        onClick={() => handleCountChange(asset.id, Math.max(0, count - 1))}
                                                        className="px-2 py-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                                    >-</button>
                                                    <span className="font-mono text-cyan-600 dark:text-cyan-400 px-2 min-w-[30px] text-center text-sm">{count}</span>
                                                    <button
                                                        onClick={() => handleCountChange(asset.id, count + 1)}
                                                        className="px-2 py-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                                    >+</button>
                                                </div>
                                            )}
                                            {!isPencilMode && (
                                                <span className="ml-2 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-sm font-mono text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-700">
                                                    x{count}
                                                </span>
                                            )}
                                        </h3>
                                    </div>
                                </div>

                                <div className="text-xs text-slate-500 mt-2 flex gap-3">
                                    <span>Redundancy: <span className="text-slate-700 dark:text-slate-300 font-medium">{asset.defaultRedundancy}</span></span>
                                    <span>•</span>
                                    <span>Total Annual Hours: <span className="text-slate-700 dark:text-slate-300 font-medium">
                                        {asset.maintenanceTasks.reduce((acc, t) => acc + (t.standardHours * (t.frequency === 'Monthly' ? 12 : t.frequency === 'Quarterly' ? 4 : t.frequency === 'Bi-Annual' ? 2 : 1)), 0) * count} hrs
                                    </span></span>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Consumables Impact */}
                            {asset.consumables?.map((part) => {
                                const impact = calculateEnvironmentalDegradation(asset.id, part.name, part.baseLifeMonths, selectedCountry, currentAQI);
                                const degradationPercent = ((1 - impact.degradationFactor) * 100).toFixed(0);

                                return (
                                    <div key={part.name} className="bg-slate-50 dark:bg-slate-950/30 rounded-lg p-3 text-sm border border-slate-100 dark:border-slate-800/50">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-slate-600 dark:text-slate-300">{part.name}</span>
                                            <span className={clsx("font-mono font-bold", impact.degradationFactor < 0.8 ? "text-amber-600 dark:text-amber-400" : "text-rz-data")}>
                                                {impact.adjustedLifeMonths} Months
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className={clsx("h-full rounded-full", impact.degradationFactor < 0.6 ? "bg-red-500" : impact.degradationFactor < 0.8 ? "bg-amber-500" : "bg-rz-data")}
                                                style={{ width: `${impact.degradationFactor * 100}%` }}
                                            />
                                        </div>
                                        {impact.degradationFactor < 1 && (
                                            <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 dark:text-amber-500/80">
                                                <AlertTriangle className="w-3 h-3" />
                                                Life reduced by {degradationPercent}% due to AQI
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Task Preview */}
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/50">
                                <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Key Maintenance Activities</div>
                                <div className="space-y-2">
                                    {asset.maintenanceTasks.slice(0, 3).map((task) => (
                                        <div key={task.id} className="flex justify-between text-xs items-center group/task">
                                            <span className="text-slate-600 dark:text-slate-400 group-hover/task:text-slate-900 dark:group-hover/task:text-slate-300">{task.name}</span>
                                            <div className="flex gap-2">
                                                <span className={clsx(
                                                    "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                                                    task.criticality === 'Statutory' ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/30" :
                                                        task.criticality === 'Optimal' ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/30" : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                                                )}>
                                                    {task.criticality}
                                                </span>
                                                <span className="text-slate-500 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">{task.frequency}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════
// TAB: Schedule (existing Gantt)
// ═══════════════════════════════════════════════════════════════

const CAL_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type CalendarView = 'week' | 'month';

interface CalendarCell {
    units: number;          // distinct units scheduled in this period (batches deduped)
    totalHours: number;     // sum of event durations (already units-multiplied)
    color: string;          // dominant criticality: Statutory > Optimal > Discretionary
    criticalities: string[];
    events: MaintenanceEvent[];
}

function calWeekStart(year: number, week: number): Date {
    return new Date(new Date(year, 0, 1).getTime() + (week - 1) * 7 * MS_PER_DAY);
}

function calMonthOfWeek(year: number, week: number): number {
    return calWeekStart(year, week).getMonth() + 1;
}

function ScheduleTab({ assetCounts, schedule, weeks }: {
    assetCounts: AssetCount[];
    schedule: MaintenanceEvent[];
    weeks: number[];
}) {
    const [view, setView] = useState<CalendarView>('week');
    const [selected, setSelected] = useState<{ assetId: string; period: number } | null>(null);

    const year = new Date().getFullYear();
    const periods = view === 'week' ? weeks : Array.from({ length: 12 }, (_, i) => i + 1);
    const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const periodLabel = (p: number) => {
        if (view === 'month') return `${CAL_MONTHS[p - 1]} ${year}`;
        const start = calWeekStart(year, p);
        const end = new Date(start.getTime() + 6 * MS_PER_DAY);
        return `Week ${p} · ${fmtDate(start)} – ${fmtDate(end)}`;
    };

    // Per-(class × period) aggregation — events from ScheduleEngine are already
    // per-class batches carrying `units`; here we only group them into cells.
    const cellMap = useMemo(() => {
        const map = new Map<string, CalendarCell>();
        for (const e of schedule) {
            const period = view === 'week' ? e.weekNumber : calMonthOfWeek(year, e.weekNumber);
            const key = `${e.assetId}:${period}`;
            const cell = map.get(key);
            if (cell) {
                cell.events.push(e);
            } else {
                map.set(key, { units: 0, totalHours: 0, color: '#94a3b8', criticalities: [], events: [e] });
            }
        }
        for (const cell of map.values()) {
            // Dedupe units by batch (assetName is unique per batch) so a batch
            // with 2 tasks in the same period is not counted twice.
            const batchUnits = new Map<string, number>();
            for (const e of cell.events) {
                batchUnits.set(e.assetName, Math.max(batchUnits.get(e.assetName) ?? 0, e.units ?? 1));
            }
            cell.units = Array.from(batchUnits.values()).reduce((a, b) => a + b, 0);
            cell.totalHours = cell.events.reduce((a, e) => a + e.durationHours, 0);
            const crits = new Set(cell.events.map(e => e.task.criticality));
            cell.criticalities = ['Statutory', 'Optimal', 'Discretionary'].filter(c => crits.has(c as MaintenanceEvent['task']['criticality']));
            cell.color = crits.has('Statutory') ? '#ef4444' : crits.has('Optimal') ? '#3b82f6' : '#94a3b8';
        }
        return map;
    }, [schedule, view, year]);

    const classRows = assetCounts
        .filter(a => a.count > 0)
        .map(a => ({ asset: a, template: ASSETS.find(t => t.id === a.assetId) }))
        .filter((r): r is { asset: AssetCount; template: (typeof ASSETS)[number] } => !!r.template);

    const selectedCell = selected ? cellMap.get(`${selected.assetId}:${selected.period}`) : undefined;
    const selectedRow = selected ? classRows.find(r => r.asset.assetId === selected.assetId) : undefined;

    const critChipClass = (crit: string) => clsx(
        "font-medium px-1.5 py-0.5 rounded text-[9px]",
        crit === 'Statutory' ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
            crit === 'Optimal' ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
    );

    const gridColsClass = view === 'week'
        ? "grid-cols-[repeat(52,minmax(20px,1fr))]"
        : "grid-cols-[repeat(12,minmax(56px,1fr))]";

    return (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm shadow-sm dark:shadow-none animate-in fade-in zoom-in-95 duration-300">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800/50 flex flex-wrap justify-between items-center gap-3 bg-slate-50/50 dark:bg-transparent">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-300">Annual Maintenance Calendar ({year}) <Tooltip content="Per-system schedule summary: one row per asset class (unit count in the label). Colored blocks mark periods with planned maintenance — color shows the highest criticality present; ×N is the number of units scheduled. Hover a block for details, click it to expand the event list below." /></div>
                <div className="flex items-center gap-4">
                    {/* Week / Month view toggle */}
                    <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-medium">
                        {(['week', 'month'] as CalendarView[]).map(v => (
                            <button
                                key={v}
                                onClick={() => { setView(v); setSelected(null); }}
                                className={clsx(
                                    "px-3 py-1.5 transition-colors",
                                    view === v
                                        ? "bg-cyan-600 text-white"
                                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                            >
                                {v === 'week' ? 'Week' : 'Month'}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500 border border-red-400"></div>Statutory <Tooltip content="Legally required inspections and certifications — non-negotiable." /></div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500 border border-blue-400"></div>Optimal <Tooltip content="Manufacturer-recommended maintenance intervals for optimal performance and warranty compliance." /></div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-500 border border-slate-400"></div>Discretionary <Tooltip content="Condition-based maintenance triggered by sensor data, inspections, or degradation thresholds." /></div>
                    </div>
                </div>
            </div>
            <div className="overflow-x-auto">
                <div className={clsx("p-4", view === 'week' ? "min-w-[1500px]" : "min-w-[900px]")}>
                    {/* Header Row */}
                    <div className="flex mb-2">
                        <div className="w-56 flex-shrink-0 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Asset System</div>
                        <div className={clsx("flex-1 grid gap-px", gridColsClass)}>
                            {periods.map(p => (
                                <div key={p} className="text-[10px] text-center text-slate-500 dark:text-slate-600 border-l border-slate-200 dark:border-slate-800/30">
                                    {view === 'week' ? (p % 4 === 0 ? p : '') : CAL_MONTHS[p - 1]}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* One summary row per asset CLASS */}
                    {classRows.map(({ asset, template }, rowIdx) => (
                        <div key={asset.assetId} className="flex items-center hover:bg-slate-100 dark:hover:bg-slate-800/30 transition-colors py-1 border-b border-slate-100 dark:border-slate-800/30">
                            <div className="w-56 flex-shrink-0 pl-2 text-xs text-slate-700 dark:text-slate-300 font-semibold truncate">
                                {template.name} <span className="text-slate-400 dark:text-slate-500 font-normal">×{asset.count}</span>
                            </div>
                            <div className={clsx("flex-1 grid gap-px h-6 relative", gridColsClass)}>
                                {periods.map(p => {
                                    const cell = cellMap.get(`${asset.assetId}:${p}`);
                                    if (!cell) return <div key={p} className="border-l border-slate-100 dark:border-slate-800/10"></div>;

                                    const isSelected = selected?.assetId === asset.assetId && selected?.period === p;
                                    const openDown = rowIdx < 3; // avoid clipping the popover at the top of the scroll container
                                    const taskNames = Array.from(new Set(cell.events.map(e => e.task.name)));

                                    return (
                                        <div key={p} className="relative group/event mx-0.5" style={{ minWidth: '4px' }}>
                                            <button
                                                onClick={() => setSelected(isSelected ? null : { assetId: asset.assetId, period: p })}
                                                aria-label={`${template.name}, ${periodLabel(p)}: ${cell.units} unit(s), ${cell.totalHours} hours planned`}
                                                className={clsx(
                                                    "w-full h-full rounded-sm shadow-sm cursor-pointer flex items-center justify-center transition-transform hover:scale-y-110",
                                                    isSelected && "ring-2 ring-cyan-400 dark:ring-cyan-300"
                                                )}
                                                style={{ backgroundColor: cell.color }}
                                            >
                                                {cell.units > 1 && (
                                                    <span className="text-[9px] font-bold text-white leading-none drop-shadow-sm">×{cell.units}</span>
                                                )}
                                            </button>

                                            {/* Hover Popover — aggregated summary */}
                                            <div className={clsx(
                                                "absolute left-1/2 -translate-x-1/2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-xl z-20 hidden group-hover/event:block pointer-events-none",
                                                openDown ? "top-full mt-2" : "bottom-full mb-2"
                                            )}>
                                                <div className="text-xs font-bold text-slate-900 dark:text-white mb-0.5">{template.name}</div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1.5">{periodLabel(p)}</div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between text-[10px]">
                                                        <span className="text-slate-500 dark:text-slate-400">Units scheduled:</span>
                                                        <span className="text-slate-700 dark:text-slate-300 font-medium">{cell.units} of {asset.count}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[10px]">
                                                        <span className="text-slate-500 dark:text-slate-400">Total hours:</span>
                                                        <span className="text-slate-700 dark:text-slate-300 font-medium">{cell.totalHours.toLocaleString()} hrs</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[10px]">
                                                        <span className="text-slate-500 dark:text-slate-400">PM type:</span>
                                                        <span className="flex gap-1">
                                                            {cell.criticalities.map(c => <span key={c} className={critChipClass(c)}>{c}</span>)}
                                                        </span>
                                                    </div>
                                                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                                                        {taskNames.slice(0, 3).map(t => (
                                                            <div key={t} className="text-[10px] text-slate-600 dark:text-slate-400 truncate">• {t}</div>
                                                        ))}
                                                        {taskNames.length > 3 && (
                                                            <div className="text-[10px] text-slate-400 dark:text-slate-500">+{taskNames.length - 3} more…</div>
                                                        )}
                                                    </div>
                                                    <div className="text-[9px] text-slate-400 dark:text-slate-500 pt-0.5">Click block for full event list</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Click-to-expand detail panel */}
            {selected && selectedCell && selectedRow && (
                <div className="border-t border-slate-200 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/30 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                                {selectedRow.template.name} <span className="text-slate-400 dark:text-slate-500 font-normal">×{selectedCell.units} unit{selectedCell.units > 1 ? 's' : ''} scheduled</span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{periodLabel(selected.period)} · {selectedCell.totalHours.toLocaleString()} total maintenance hours</div>
                        </div>
                        <button
                            onClick={() => setSelected(null)}
                            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                    <div className="space-y-1.5">
                        {selectedCell.events.map(e => (
                            <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs">
                                <span className={critChipClass(e.task.criticality)}>{e.task.criticality}</span>
                                <span className="text-slate-800 dark:text-slate-200 font-medium flex-1 min-w-[180px]">{e.task.name}</span>
                                <span className="text-slate-500 dark:text-slate-400">×{e.units ?? 1} unit{(e.units ?? 1) > 1 ? 's' : ''}</span>
                                <span className="text-slate-500 dark:text-slate-400">{e.task.standardHours} hrs/unit</span>
                                <span className="text-slate-700 dark:text-slate-300 font-medium">{e.durationHours.toLocaleString()} hrs total</span>
                                {view === 'week' ? null : (
                                    <span className="text-slate-400 dark:text-slate-500">Wk {e.weekNumber}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════
// TAB: Strategy (NEW — Predictive vs Reactive vs Planned)
// ═══════════════════════════════════════════════════════════════

function StrategyTab({ data, fmt, activeStrat, onSelect }: { data: ReturnType<typeof calculateStrategyComparison>; fmt: (n: number) => string; activeStrat?: string; onSelect?: (strat: string) => void }) {
    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Strategy Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {data.strategies.map((s) => (
                    <div
                        key={s.id}
                        onClick={() => onSelect && onSelect(s.id)}
                        className={clsx(
                            "bg-white dark:bg-slate-900/50 border rounded-xl overflow-hidden transition-all relative shadow-sm dark:shadow-none cursor-pointer",
                            s.id === activeStrat ? `ring-2 ring-offset-2 dark:ring-offset-slate-900 ${s.id === 'reactive' ? 'ring-red-500 border-red-500/50' : s.id === 'planned' ? 'ring-blue-500 border-blue-500/50' : 'ring-rz-data border-rz-data/30'}` : s.id === data.recommended ? "border-rz-data/30 ring-1 ring-rz-data/20" : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        )}
                    >
                        {s.id === data.recommended && (
                            <div className="absolute top-3 right-3 bg-rz-data/10 dark:bg-rz-data/20 border border-rz-data/30 text-rz-data text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                                Recommended
                            </div>
                        )}

                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-transparent">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                                <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">{s.label} <Tooltip content={s.id === 'reactive' ? "Run-to-Failure: No scheduled maintenance — repair only when equipment fails. Lowest upfront cost but highest downtime risk." : s.id === 'planned' ? "Planned Preventive: Time-based scheduled maintenance at fixed intervals regardless of condition." : "Predictive (CBM): Condition-based maintenance using sensor data and analytics to predict failures before they occur."} /></h3>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.description}</p>
                        </div>

                        {/* Metrics */}
                        <div className="p-5 space-y-3">
                            {[
                                { label: 'Annual Cost', value: fmt(s.totalAnnualCost), highlight: true, tip: 'Total annual maintenance cost including labor, parts, and estimated downtime losses for this strategy.' },
                                { label: 'Labor', value: fmt(s.annualLaborCost), tip: 'Annual cost of maintenance technicians, engineers, and overtime hours required by this strategy.' },
                                { label: 'Parts & Materials', value: fmt(s.annualPartsCost), tip: 'Annual spend on replacement parts, consumables, lubricants, and materials for scheduled and unscheduled repairs.' },
                                { label: 'Downtime Risk', value: fmt(s.annualDowntimeCost), tip: 'Estimated annual cost of unplanned downtime based on failure probability and revenue-at-risk per hour of outage.' },
                                { label: 'Unplanned Failures', value: `${s.unplannedFailures.toFixed(1)}/yr`, tip: 'Expected number of unplanned equipment failures per year. Lower values indicate better maintenance effectiveness.' },
                                { label: '5-Year NPV', value: fmt(s.fiveYearNPV), highlight: true, tip: 'Net Present Value of all maintenance costs over 5 years, discounted at WACC. Lower NPV = more cost-effective strategy.' },
                            ].map((row, i) => (
                                <div key={i} className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/30 last:border-0">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">{row.label} <Tooltip content={row.tip} /></span>
                                    <span className={clsx('text-sm font-mono', row.highlight ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-700 dark:text-slate-300')}>{row.value}</span>
                                </div>
                            ))}

                            {s.sensorCapex > 0 && (
                                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/30">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">Sensor CAPEX (one-time) <Tooltip content="One-time capital cost for IoT sensors, vibration monitors, thermal cameras, and DCIM integration required for predictive maintenance." /></span>
                                    <span className="text-sm font-mono text-orange-600 dark:text-orange-400">{fmt(s.sensorCapex)}</span>
                                </div>
                            )}

                            {/* Reliability Bar */}
                            <div className="mt-3 pt-2">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-500">Reliability Index <Tooltip content="Overall equipment reliability score (0-100) based on MTBF, failure rates, and maintenance effectiveness. Higher is better." /></span>
                                    <span className="font-mono text-slate-900 dark:text-white">{s.reliabilityIndex}/100</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${s.reliabilityIndex}%`, backgroundColor: s.color }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recommendation Box */}
            <div className="bg-rz-data/10 dark:bg-rz-data/30 border border-rz-data/30 rounded-xl p-6">
                <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-rz-data mt-0.5 flex-shrink-0" />
                    <div>
                        <h3 className="text-sm font-bold text-rz-data uppercase tracking-wider mb-1">Strategy Recommendation <Tooltip content="AI-recommended maintenance strategy based on cost-benefit analysis, considering your facility size, equipment mix, and risk tolerance." /></h3>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{data.recommendationReason}</p>
                        <div className="mt-3 px-3 py-2 bg-white dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 w-fit">
                            <span className="text-xs text-slate-500">5-Year Savings (Optimal vs Worst): <Tooltip content="Projected cost savings over 5 years by adopting the optimal strategy compared to the most expensive alternative." /></span>
                            <span className="ml-2 font-mono font-bold text-rz-data">{fmt(data.fiveYearSavings)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════
// TAB: SLA (NEW — Vendor SLA Comparison)
// ═══════════════════════════════════════════════════════════════

function SLATab({ data, fmt, thirdParty, onThirdParty, facilityAged, onFacilityAged, tierLevel, downtimeCostPerMin, tier4Alt, selectedSla, onSelectSla }: {
    data: ReturnType<typeof calculateSLAComparison>;
    fmt: (n: number) => string;
    thirdParty: boolean;
    onThirdParty: (v: boolean) => void;
    facilityAged: boolean;
    onFacilityAged: (v: boolean) => void;
    tierLevel: 3 | 4;
    downtimeCostPerMin: number;
    tier4Alt: SLAComparison | null;
    /** G-SLA — the SLA class the project has SELECTED (sim store inputs.slaKey). */
    selectedSla: '2hr' | '4hr' | 'nbd';
    onSelectSla: (k: '2hr' | '4hr' | 'nbd') => void;
}) {
    const cb = data.contractBasis;
    // Which tier's risk-exposure explain panel is open (red numbers only)
    const [openRisk, setOpenRisk] = useState<SLATier['id'] | null>(null);
    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Contract pricing basis + engine multiplier toggles */}
            <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 shadow-sm dark:shadow-none">
                <span className={clsx(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                    cb.fromEngine
                        ? "bg-rz-data/10 dark:bg-rz-data/15 text-rz-data border-rz-data/30"
                        : "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30"
                )}>
                    {cb.fromEngine ? 'engine · sourced band' : 'screening fallback'}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                    {cb.fromEngine
                        ? <>Vendor contract fee = sourced $/kW-yr band × {cb.itLoadKw.toLocaleString()} kW IT <Tooltip content="Annual contract fee per tier comes from the engine's sourced O&M contract table (DATA.omContracts): fixed-fee $/kW-yr band (low/mid/high) × IT load. The mid band drives the comparison; the low–high band is shown under each fee." /></>
                        : <>Engine contract table unavailable — per-asset screening rates in use <Tooltip content="DATA.omContracts is not loaded (or IT load is zero), so the tier fees fall back to the local per-critical-asset screening rates." /></>}
                </span>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => onThirdParty(!thirdParty)}
                        className={clsx(
                            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                            thirdParty
                                ? "bg-cyan-600 text-white border-cyan-600"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        )}
                        title={`Third-party (non-OEM) contract — ×${cb.thirdPartyMultiplier} on the sourced band (OEM typically 40–60% higher)`}
                    >
                        Third-party ×{cb.thirdPartyMultiplier}
                    </button>
                    <button
                        onClick={() => onFacilityAged(!facilityAged)}
                        className={clsx(
                            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                            facilityAged
                                ? "bg-amber-600 text-white border-amber-600"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        )}
                        title={`Facility older than 10 years — ×${cb.agingFacilityMultiplier} parts + corrective escalation on the sourced band`}
                    >
                        Facility &gt;10 yr ×{cb.agingFacilityMultiplier}
                    </button>
                </div>
            </div>

            {/* SLA Table */}
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50">
                                <th className="py-3 px-3 text-center text-xs text-slate-500 font-medium uppercase w-[86px]"><span className="flex items-center justify-center gap-1">Selected <Tooltip content="The SLA response class your project commits to. The selection is saved on the simulation (inputs.slaKey) and feeds the engine availability model: a slower response window lengthens the effective MTTR of the vendor-dependent share of repairs, lowering computed availability on the Risk and Simulation dashboards." /></span></th>
                                <th className="py-3 px-4 text-left text-xs text-slate-500 font-medium uppercase min-w-[120px]"><span className="flex items-center gap-1">SLA Tier <Tooltip content="Service Level Agreement tier defining response time guarantees and coverage scope from the maintenance vendor." /></span></th>
                                <th className="py-3 px-4 text-left text-xs text-slate-500 font-medium uppercase min-w-[120px]"><span className="flex items-center gap-1">Response Time <Tooltip content="Maximum guaranteed time from fault report to on-site technician arrival. Shorter response = higher SLA cost." /></span></th>
                                <th className="py-3 px-4 text-right text-xs text-slate-500 font-medium uppercase min-w-[100px]"><span className="flex items-center justify-end gap-1">Annual Cost <Tooltip content="Annual fee paid to the vendor for this SLA tier, based on asset count and criticality." /></span></th>
                                <th className="py-3 px-4 text-right text-xs text-slate-500 font-medium uppercase min-w-[100px]"><span className="flex items-center justify-end gap-1">Risk Exposure <Tooltip content="Estimated annual financial risk from downtime during the response window. Longer response = higher risk." /></span></th>
                                <th className="py-3 px-4 text-right text-xs text-slate-500 font-medium uppercase min-w-[120px]"><span className="flex items-center justify-end gap-1">Net Annual Cost <Tooltip content="Total cost of the SLA tier: annual fee + estimated risk exposure. The true cost of each option." /></span></th>
                                <th className="py-3 px-4 text-right text-xs text-slate-500 font-medium uppercase min-w-[120px]"><span className="flex items-center justify-end gap-1">Break-Even <Tooltip content="Downtime cost per minute at which upgrading to this SLA tier becomes financially justified over the cheaper option." /></span></th>
                                <th className="py-3 px-4 text-left text-xs text-slate-500 font-medium uppercase"><span className="flex items-center gap-1">Coverage <Tooltip content="Scope of equipment and services included in this SLA tier — what is covered and what requires additional contracts." /></span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.tiers.map((tier) => {
                                const tone = riskTone(tier.riskExposure);
                                // Decomposition of the SAME engine formula, verified against the live number
                                const baseFailures = slaBaseFailures(tierLevel);
                                const respMin = SLA_RESPONSE_MIN[tier.id];
                                const recomputed = baseFailures * respMin * downtimeCostPerMin * SLA_PROB_WEIGHT;
                                const parity = Math.abs(recomputed - tier.riskExposure) < 1;
                                const levers = slaUpgradeLevers(tier, data.tiers);
                                const altTier = tier4Alt?.tiers.find(t => t.id === tier.id) ?? null;
                                const isSelected = tier.id === selectedSla;
                                return (
                                    <React.Fragment key={tier.id}>
                                        <tr className={clsx(
                                            "border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors",
                                            isSelected
                                                ? "bg-cyan-50 dark:bg-cyan-950/30 ring-1 ring-inset ring-cyan-400/40"
                                                : tier.recommended && "bg-rz-data/50 dark:bg-rz-data/20"
                                        )}>
                                            <td className="py-4 px-3 text-center">
                                                <button
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={isSelected}
                                                    onClick={() => onSelectSla(tier.id)}
                                                    title={isSelected ? `${tier.label} is the selected SLA — it feeds the availability model` : `Select ${tier.label} as the project SLA (updates computed availability on Risk & Simulation)`}
                                                    className={clsx(
                                                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-bold uppercase transition-colors",
                                                        isSelected
                                                            ? "bg-cyan-600 border-cyan-600 text-white"
                                                            : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-400"
                                                    )}
                                                >
                                                    <span className={clsx("w-2 h-2 rounded-full border", isSelected ? "bg-white border-white" : "border-slate-400 dark:border-slate-500")} />
                                                    {isSelected ? 'Active' : 'Select'}
                                                </button>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-900 dark:text-white font-medium">{tier.label}</span>
                                                    {tier.recommended && (
                                                        <span className="bg-rz-data/10 dark:bg-rz-data/20 border border-rz-data/30 text-rz-data text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full">
                                                            Best Value
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="font-mono text-cyan-600 dark:text-cyan-400">{tier.responseTime}</span>
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <div className="font-mono text-slate-700 dark:text-slate-300">{fmt(tier.annualCost)}</div>
                                                {tier.contractBand && tier.contractPerKwYr && (
                                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5" title={`Sourced band ${tier.contractPerKwYr.low}–${tier.contractPerKwYr.mid}–${tier.contractPerKwYr.high} $/kW-yr (${tier.omTierKey} tier) × IT kW`}>
                                                        {fmt(tier.contractBand.low)}–{fmt(tier.contractBand.high)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                {tone === 'red' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setOpenRisk(openRisk === tier.id ? null : tier.id)}
                                                        title={`Risk exposure ${fmt(tier.riskExposure)}/yr crosses the red threshold ${fmt(SLA_RISK_RED_USD)}/yr. Click for the decomposition + measured levers (computed from the same SLA model).`}
                                                        className={clsx("font-mono cursor-pointer underline decoration-dotted underline-offset-4", RISK_TONE_CLASS.red)}
                                                    >
                                                        {fmt(tier.riskExposure)}
                                                    </button>
                                                ) : (
                                                    <span className={clsx("font-mono", RISK_TONE_CLASS[tone])}>
                                                        {fmt(tier.riskExposure)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-right font-mono text-slate-900 dark:text-white font-bold">{fmt(tier.netAnnualCost)}</td>
                                            <td className="py-4 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                                                {tier.id === 'nbd' ? '—' : `${fmt(tier.breakEvenDowntimeCost)}/min`}
                                            </td>
                                            <td className="py-4 px-4 text-xs text-slate-500 dark:text-slate-400 max-w-[200px]">{tier.coverageScope}</td>
                                        </tr>
                                        {openRisk === tier.id && (
                                            <tr className="border-b border-slate-100 dark:border-slate-800/50">
                                                <td colSpan={8} className="py-0 px-0">
                                                    <div className="m-2 p-4 rounded-lg border text-left bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 space-y-3">
                                                        {/* Why red — decomposition of the same engine formula */}
                                                        <div>
                                                            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                                                                Why red — exposure decomposition (same SLA model)
                                                            </div>
                                                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-mono">
                                                                {baseFailures} critical incidents/yr × {respMin.toLocaleString()} min response window × {fmt(downtimeCostPerMin)}/min downtime cost × {SLA_PROB_WEIGHT * 100}% probability weight = {fmt(recomputed)}/yr
                                                                {parity ? (
                                                                    <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rz-data/10 dark:bg-rz-data/40 text-rz-data">≡ engine</span>
                                                                ) : (
                                                                    <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" title="The factor decomposition no longer matches the engine output — the table total still comes from the engine; the factors above are indicative.">≠ engine — table total applies</span>
                                                                )}
                                                            </p>
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                                                Colouring thresholds: red &gt; {fmt(SLA_RISK_RED_USD)}/yr · amber &gt; {fmt(SLA_RISK_AMBER_USD)}/yr · below that green.
                                                            </p>
                                                        </div>

                                                        {/* Live per-tier contributors */}
                                                        <div>
                                                            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5">
                                                                Exposure per SLA tier (live numbers)
                                                            </div>
                                                            <div className="space-y-1">
                                                                {data.tiers.map(t => (
                                                                    <div key={t.id} className="flex items-center gap-2 text-[11px]">
                                                                        <span className={clsx("w-32 shrink-0", t.id === tier.id ? "font-semibold text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400")}>{t.label}</span>
                                                                        <span className={clsx("font-mono", RISK_TONE_CLASS[riskTone(t.riskExposure)])}>{fmt(t.riskExposure)}/yr</span>
                                                                        <span className="text-slate-400 dark:text-slate-500">· contract {fmt(t.annualCost)}/yr · net {fmt(t.netAnnualCost)}/yr</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Measured levers — same model, no fabricated numbers */}
                                                        <div>
                                                            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5">
                                                                Measured levers (computed from the same model)
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                {levers.map((lv, li) => (
                                                                    <div key={li} className="flex items-start gap-2 p-2 rounded-md bg-white/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                                                        <span className={clsx(
                                                                            "shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap",
                                                                            lv.netDelta <= 0
                                                                                ? "bg-rz-data/10 dark:bg-rz-data/40 text-rz-data"
                                                                                : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                                                                        )}>{lv.label}</span>
                                                                        <span className="flex-1 text-[11px] text-slate-600 dark:text-slate-400 leading-snug">{lv.detail}</span>
                                                                    </div>
                                                                ))}
                                                                {altTier && (
                                                                    <div className="flex items-start gap-2 p-2 rounded-md bg-white/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                                                        <span className="shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 whitespace-nowrap">Tier IV design</span>
                                                                        <span className="flex-1 text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                                                                            Expected incidents {slaBaseFailures(3)} → {slaBaseFailures(4)}/yr → exposure {tier.label} {fmt(tier.riskExposure)} → {fmt(altTier.riskExposure)}/yr (−{fmt(tier.riskExposure - altTier.riskExposure)}) — the result of re-running the same model at tier level 4 (a design decision, not the contract).
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {levers.length === 0 && (
                                                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                                                                        The fastest SLA is already selected — the remaining exposure is driven by incident rate × downtime cost, not the contract response time.
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 leading-snug">
                                                                Honest note: a per-asset-class breakdown and the effect of adding spares on exposure cannot be derived from this SLA model (incident rate is modelled as a per-facility scalar). Spares inventory optimisation uses a separate model in the Spares tab.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800/50 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400 shrink-0" />
                    <span>
                        Selected SLA <b className="text-cyan-600 dark:text-cyan-400">{data.tiers.find(t => t.id === selectedSla)?.label ?? selectedSla}</b> feeds the availability model — computed availability &amp; downtime exposure on the Risk and Simulation dashboards use this response window as the vendor-repair wait time.
                    </span>
                    <Tooltip content="Engine model models.maintenance.availabilityImpact: effective MTTR = strategy repair speed × base repair time + (vendor share × SLA response adder). NBD adds the longest wait, 2-Hour the shortest — the selection changes the computed availability delta against the tier design point." />
                </div>
                <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800/50 text-[10px] text-slate-400 dark:text-slate-500">
                    Basis: {cb.basis}
                    {cb.fromEngine && (cb.thirdPartyApplied || cb.agingApplied) && (
                        <span> · applied: {[cb.thirdPartyApplied ? `third-party ×${cb.thirdPartyMultiplier}` : null, cb.agingApplied ? `>10yr facility ×${cb.agingFacilityMultiplier}` : null].filter(Boolean).join(' · ')}</span>
                    )}
                </div>
            </div>

            {/* Break-Even Visual */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cost vs Risk */}
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm dark:shadow-none">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-rz-data" />
                        Cost vs Risk Exposure
                    </h3>
                    <div className="space-y-4">
                        {data.tiers.map(tier => {
                            const maxCost = Math.max(...data.tiers.map(t => t.netAnnualCost));
                            const costPct = (tier.annualCost / maxCost) * 100;
                            const riskPct = (tier.riskExposure / maxCost) * 100;
                            return (
                                <div key={tier.id}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className={clsx("font-medium", tier.recommended ? "text-rz-data" : "text-slate-500 dark:text-slate-400")}>{tier.label}</span>
                                        <span className="font-mono text-slate-500 dark:text-slate-400">{fmt(tier.netAnnualCost)}</span>
                                    </div>
                                    <div className="flex gap-0.5 h-5">
                                        <div className="bg-blue-500/80 dark:bg-blue-500/60 rounded-l" style={{ width: `${costPct}%` }} title="SLA Cost" />
                                        <div className="bg-red-500/80 dark:bg-red-500/60 rounded-r" style={{ width: `${riskPct}%` }} title="Risk Exposure" />
                                    </div>
                                </div>
                            );
                        })}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 bg-blue-500/80 dark:bg-blue-500/60 rounded" />SLA Cost</div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 bg-red-500/80 dark:bg-red-500/60 rounded" />Risk Exposure</div>
                        </div>
                    </div>
                </div>

                {/* Analysis */}
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm dark:shadow-none">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Info className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                        Analysis
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">{data.analysis}</p>
                    <div className="bg-amber-50 dark:bg-slate-950/50 rounded-lg p-4 border border-amber-200 dark:border-slate-800">
                        <div className="text-xs text-slate-500 uppercase mb-2">Key Insight</div>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                            Upgrading from NBD to 4-Hour response saves {fmt(data.tiers[0].riskExposure - data.tiers[1].riskExposure)}/year in risk exposure,
                            costing an additional {fmt(data.tiers[1].annualCost - data.tiers[0].annualCost)}/year in SLA fees.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// TAB: Spares (NEW — Inventory Analysis)
// ═══════════════════════════════════════════════════════════════

function SparesTab({ data, fmt, bands }: {
    data: ReturnType<typeof calculateSparesOptimization>;
    fmt: (n: number) => string;
    bands: SparesPriceBandRow[];
}) {
    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Sourced spares price bands (engine DATA.sparesPricing — same read as the newsvendor adapter) */}
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Package className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                        Spares Price Bands <Tooltip content="Researched list-price bands per spare class from the shared engine (DATA.sparesPricing, sourced public list/retrofit prices). The mid band is the same unit cost the newsvendor spares model uses — one source, no duplicate." />
                    </h3>
                    <span className={clsx(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                        bands.length > 0
                            ? "bg-rz-data/10 dark:bg-rz-data/15 text-rz-data border-rz-data/30"
                            : "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30"
                    )}>
                        {bands.length > 0 ? 'engine · sourced band' : 'engine not loaded'}
                    </span>
                    <span className="ml-auto text-[10px] text-slate-400">mid band feeds the newsvendor spares adapter</span>
                </div>
                {bands.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50">
                                    <th className="py-2.5 px-4 text-left text-xs text-slate-500 font-medium uppercase"><span className="flex items-center gap-1">Spare Class <Tooltip content="Engine spare-part class key from the sourced cost-band table (DATA). Each class maps to the newsvendor stocking model — the mid band of that class is the default unit cost the spares optimizer uses." /></span></th>
                                    <th className="py-2.5 px-4 text-left text-xs text-slate-500 font-medium uppercase"><span className="flex items-center gap-1">Unit <Tooltip content="Costing unit for the class (per module, per battery string, per compressor, etc.). Band prices below are quoted per this unit." /></span></th>
                                    <th className="py-2.5 px-4 text-right text-xs text-slate-500 font-medium uppercase"><span className="flex items-center justify-end gap-1">Low <Tooltip content="Lower bound of the sourced unit-cost band — budget/refurbished or high-volume pricing. Use for optimistic spares-budget scenarios; stocking at Low risks under-budgeting replenishment." /></span></th>
                                    <th className="py-2.5 px-4 text-right text-xs text-slate-500 font-medium uppercase"><span className="flex items-center justify-end gap-1">Mid <Tooltip content="Mid band of the sourced cost range — the default unit cost that feeds the newsvendor spares adapter and the inventory KPIs below. Treat it as the planning figure unless you hold vendor quotes." /></span></th>
                                    <th className="py-2.5 px-4 text-right text-xs text-slate-500 font-medium uppercase"><span className="flex items-center justify-end gap-1">High <Tooltip content="Upper bound of the sourced band — OEM list pricing, expedited or low-volume purchases. Use for conservative budgeting and for spares with single-source OEM lock-in." /></span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {bands.map((b) => (
                                    <tr key={b.key} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                        <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                                            <span className="font-mono text-xs">{b.key}</span>
                                            {b.adapterClass && (
                                                <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30" title={`Mid band is the default unit cost for the '${b.adapterClass}' newsvendor class`}>
                                                    → {b.adapterClass}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-400">{b.unit}</td>
                                        <td className="py-2.5 px-4 text-right font-mono text-slate-500 dark:text-slate-400">{fmt(b.low)}</td>
                                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">{fmt(b.mid)}</td>
                                        <td className="py-2.5 px-4 text-right font-mono text-slate-500 dark:text-slate-400">{fmt(b.high)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="px-6 py-4 text-xs text-slate-500">Shared engine (rz-engine) not loaded — sourced price bands unavailable; the inventory list below uses per-part template costs.</p>
                )}
            </div>

            {/* Critical Spares List */}
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50">
                                <th className="py-3 px-4 text-left text-xs text-slate-500 font-medium uppercase"><span className="flex items-center gap-1">Critical Spare Part <Tooltip content="Name and associated asset for each spare part held in inventory. Critical spares prevent extended downtime during failures." /></span></th>
                                <th className="py-3 px-4 text-center text-xs text-slate-500 font-medium uppercase"><span className="flex items-center justify-center gap-1">Criticality <Tooltip content="Impact level if this part is unavailable: Critical (immediate outage risk), Major (degraded operation), Standard (convenience)." /></span></th>
                                <th className="py-3 px-4 text-right text-xs text-slate-500 font-medium uppercase"><span className="flex items-center justify-end gap-1">Unit Cost <Tooltip content="Purchase price per unit from the supplier, used to calculate total inventory investment and holding costs." /></span></th>
                                <th className="py-3 px-4 text-center text-xs text-slate-500 font-medium uppercase"><span className="flex items-center justify-center gap-1">Lead Time <Tooltip content="Number of days from order placement to delivery. Longer lead times require higher safety stock levels." /></span></th>
                                <th className="py-3 px-4 text-center text-xs text-slate-500 font-medium uppercase"><span className="flex items-center justify-center gap-1">Reorder / Max <Tooltip content="Reorder point (minimum stock triggering a new order) / Maximum quantity to hold. Based on lead time and consumption rate." /></span></th>
                                <th className="py-3 px-4 text-right text-xs text-slate-500 font-medium uppercase"><span className="flex items-center justify-end gap-1">Holding Cost <Tooltip content="Annual cost to store this spare: includes warehousing, insurance, depreciation, and opportunity cost of tied-up capital (~15-25% of unit cost)." /></span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((item, idx) => (
                                <tr key={`${item.assetId}-${item.partName}-${idx}`} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                                        {item.partName} <span className="text-slate-400 font-normal">({item.assetName})</span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={clsx("px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                                            item.criticality === 'Critical' ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30" :
                                                item.criticality === 'Major' ? "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30" :
                                                    "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30"
                                        )}>
                                            {item.criticality}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">{fmt(item.unitCost)}</td>
                                    <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-400">{item.leadTimeDays} days</td>
                                    <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-400">{item.reorderPoint} / {item.quantity}</td>
                                    <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">{fmt(item.holdingCost)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Inventory KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Total Inventory Value', value: fmt(data.totalInventoryValue), desc: 'Capital tied up in spares', color: 'text-blue-600 dark:text-blue-400', tip: 'Total capital investment tied up in spare parts inventory. Higher values increase working capital requirements but reduce downtime risk.' },
                    { label: 'Annual Holding Cost', value: fmt(data.totalHoldingCost), desc: 'Storage & depreciation', color: 'text-rz-signal', tip: 'Annual cost of maintaining spare parts inventory: warehousing, insurance, depreciation, and opportunity cost of capital.' },
                    { label: 'Annual Spares Budget', value: fmt(data.totalAnnualSparesBudget), desc: 'Consumption + Holding', color: 'text-rz-data', tip: 'Total annual budget for spare parts: consumption (parts used in maintenance) plus holding costs (storage and depreciation).' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm dark:shadow-none">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">{kpi.label} <Tooltip content={kpi.tip} /></div>
                        <div className={clsx("text-2xl font-bold mb-1", kpi.color)}>{kpi.value}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{kpi.desc}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
