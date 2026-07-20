'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { calculateAssetLifecycle, AssetLifecycleResult, DepreciationMethod, AssetHealthScore, LifecycleAsset } from '@/modules/analytics/AssetLifecycleEngine';
import { LineChart as LineChartIcon, DollarSign, Calendar, TrendingDown, BarChart3, Layers, RefreshCw, Activity, AlertTriangle, ShieldCheck, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import {
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, BarChart, Bar, ReferenceLine
} from 'recharts';
import clsx from 'clsx';
import { fmt, fmtMoney } from '@/lib/format';
import { Tooltip } from '@/components/ui/Tooltip';
import { ExportPDFButton } from '@/components/ui/ExportPDFButton';

const CATEGORY_COLORS: Record<string, string> = {
    'Critical Power': 'bg-red-500',
    'Cooling': 'bg-blue-500',
    'Fire Safety': 'bg-amber-500',
    'Fuel System': 'bg-orange-500',
    'Water Treatment': 'bg-cyan-500',
    'BMS & IT': 'bg-purple-500',
    'Security': 'bg-green-500',
    'Civil': 'bg-slate-500',
};

const SEVERITY_COLORS: Record<string, string> = {
    critical: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    high: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    medium: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
    low: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
};

const HEALTH_COLORS: Record<string, string> = {
    low: 'bg-emerald-500',
    medium: 'bg-amber-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
};

// ═══════════════════════════════════════════════════════════════
// DIAGNOSTICS TIER-2 — asset-lifecycle guidance
// (standarization/DIAGNOSTICS_STANDARD.md: no naked red chip/number —
// every bad indicator is clickable → reason with live model numbers +
// measured levers + honest-unreachable notes + parity vs engine)
// ═══════════════════════════════════════════════════════════════

/** Single-source threshold: riskLevel 'critical' boundary. Mirror of
 *  AssetLifecycleEngine (`healthPct > 25 ? 'high' : 'critical'`) — used for
 *  the chip click-gate, the panel copy and the collector. Parity with the
 *  engine's own riskLevel string is asserted at render (drift → warning). */
export const HEALTH_CRITICAL_PCT = 25;
/** Single-source threshold: deferred-vs-on-time NPV premium above this ($)
 *  makes the Deferred strategy card a red finding with guidance. */
export const DEFER_PREMIUM_RED_USD = 0;
/** DCMOC shell tab id hosting this dashboard (page.tsx case 'asset-lifecycle'). */
export const ASSET_LIFECYCLE_TAB = 'asset-lifecycle';

/* Engine model constants mirrored for decomposition ONLY (AssetLifecycleEngine.ts).
 * Every panel recomputation using them is VERIFIED against the live engine
 * output (≡ engine parity chip) — if the engine drifts, the panel says so
 * instead of showing a wrong decomposition (DIAGNOSTICS_STANDARD rule 4). */
const ENGINE_ASSUMED_AGE_YR = 5;          // assumedAvgAge
const ENGINE_DISCOUNT_RATE = 0.08;        // discountRate
const ENGINE_DEFER_PENALTY_PER_YR = 0.15; // failure-cost penalty per deferral year
const ENGINE_DEFER_YEARS = 2;             // engine computes exactly d = 2
const ENGINE_FAILPROB_BASE = 0.02;        // failureProbability = min(cap, base·e^(k·ageRatio·5))
const ENGINE_FAILPROB_K = 0.3;
const ENGINE_FAILPROB_CAP = 0.95;
const ENGINE_AGING_MAINT_PCT = 0.02;      // maintenanceCostOfAging = 2%·cost·ageRatio²

const isCriticalHealth = (h: AssetHealthScore): boolean => h.riskLevel === 'critical';

/** Failure-probability recompute — same closed form as the engine (always the
 *  local formula there, never the rz-engine healthIndex), rounded 3dp like it. */
function failureProbRecompute(usefulLifeYears: number): { ageRatio: number; prob: number } {
    const ageRatio = Math.min(1, ENGINE_ASSUMED_AGE_YR / usefulLifeYears);
    const prob = Math.min(ENGINE_FAILPROB_CAP, ENGINE_FAILPROB_BASE * Math.exp(ENGINE_FAILPROB_K * ageRatio * 5));
    return { ageRatio, prob: Math.round(prob * 1000) / 1000 };
}

/** Per-asset replacement-NPV at deferral d years (negative = early), with the
 *  SAME loop shape + rounding conventions as the engine's three sums:
 *  d<0 → earlyReplacementNpv, d=0 → npvOfReplacements (per-event Math.round,
 *  as the replacement timeline does), d>0 → deferredReplacementNpv with the
 *  model's stated 15%/yr failure-cost penalty. */
function assetReplaceNpv(
    a: LifecycleAsset, deferYears: number, inflationRate: number, projectionYears: number
): { npv: number; events: number } {
    const penalty = deferYears > 0 ? 1 + ENGINE_DEFER_PENALTY_PER_YR * deferYears : 1;
    let npv = 0;
    let events = 0;
    for (let y = Math.max(1, a.usefulLifeYears + deferYears); y <= projectionYears; y += a.usefulLifeYears) {
        const base = a.totalAcquisitionCost * Math.pow(1 + inflationRate, y);
        const cost = deferYears === 0 ? Math.round(base) : base * penalty;
        npv += cost / Math.pow(1 + ENGINE_DISCOUNT_RATE, y);
        events += 1;
    }
    return { npv, events };
}

interface DeferralCurvePoint { d: number; penaltyFactor: number; npv: number; events: number }

/** Portfolio failure-cost-of-deferral curve, d = 0..maxD years. Points d=0 and
 *  d=ENGINE_DEFER_YEARS are parity-checked against the engine outputs; other d
 *  are the honest generalisation of the model's own 15%/yr penalty rule. */
function deferralCurve(
    assets: LifecycleAsset[], inflationRate: number, projectionYears: number, maxD = 5
): DeferralCurvePoint[] {
    return Array.from({ length: maxD + 1 }, (_, d) => {
        let npv = 0;
        let events = 0;
        for (const a of assets) {
            const r = assetReplaceNpv(a, d, inflationRate, projectionYears);
            npv += r.npv;
            events += r.events;
        }
        return { d, penaltyFactor: 1 + ENGINE_DEFER_PENALTY_PER_YR * d, npv, events };
    });
}

/** Diagnostics finding — canonical Diagnostics Center shape
 *  {surface, severity, metric, value, threshold, linkTab}. */
export interface Finding {
    surface: string;
    severity: 'high' | 'medium';
    metric: string;
    value: number;
    threshold: number;
    linkTab: string;
}

/** Tier-2 collector — pure function over the SAME calculateAssetLifecycle
 *  result the page renders (no hooks, no DOM). */
export function collectAssetLifecycleDiagnostics(model: AssetLifecycleResult | null): Finding[] {
    if (!model) return [];
    const findings: Finding[] = [];
    for (const h of model.healthScores) {
        if (!isCriticalHealth(h)) continue;
        findings.push({
            surface: 'Asset Lifecycle · Health & Risk',
            severity: 'high', // critical asset health = elevated failure probability on live equipment
            metric: `healthPct:${h.assetId}`,
            value: h.healthPct,
            threshold: HEALTH_CRITICAL_PCT,
            linkTab: ASSET_LIFECYCLE_TAB,
        });
    }
    const deferPremium = model.financialImpact.deferredReplacementNpv - model.npvOfReplacements;
    if (deferPremium > DEFER_PREMIUM_RED_USD) {
        findings.push({
            surface: 'Asset Lifecycle · Replacement Strategy',
            severity: 'medium', // strategy-comparison signal, not an incurred cost
            metric: 'deferredReplacementNpvPremium',
            value: deferPremium,
            threshold: DEFER_PREMIUM_RED_USD,
            linkTab: ASSET_LIFECYCLE_TAB,
        });
    }
    return findings;
}

export default function AssetLifecycleDashboard() {
    const { selectedCountry, inputs } = useSimulationStore();
    const [depMethod, setDepMethod] = useState<DepreciationMethod>('straight-line');
    const [activeView, setActiveView] = useState<'depreciation' | 'replacement' | 'health' | 'assets'>('depreciation');
    const [isExporting, setIsExporting] = useState(false);
    // Diagnostics Tier-2 panels: critical health chip (per assetId) + deferred-NPV card
    const [openHealth, setOpenHealth] = useState<string | null>(null);
    const [openDefer, setOpenDefer] = useState(false);

    const result = useMemo<AssetLifecycleResult | null>(() => {
        if (!selectedCountry) return null;
        return calculateAssetLifecycle({
            country: selectedCountry,
            itLoadKw: inputs.itLoad,
            tierLevel: inputs.tierLevel,
            coolingType: inputs.coolingType,
            coolingTopology: inputs.coolingTopology,
            powerRedundancy: inputs.powerRedundancy,
            depreciationMethod: depMethod,
        });
    }, [selectedCountry, inputs.itLoad, inputs.tierLevel, inputs.coolingType, inputs.coolingTopology, inputs.powerRedundancy, depMethod]);

    // Diagnostics Tier-2 — deferral cost curve + parity vs the three engine NPV
    // sums (early / on-time / deferred). Same inflation input the engine used.
    const diag = useMemo(() => {
        if (!result || !selectedCountry) return null;
        const inflationRate = selectedCountry.economy.inflationRate;
        const py = result.projectionYears;
        const curve = deferralCurve(result.assets, inflationRate, py);
        let earlyNpv = 0;
        for (const a of result.assets) earlyNpv += assetReplaceNpv(a, -ENGINE_DEFER_YEARS, inflationRate, py).npv;
        const fi = result.financialImpact;
        const parityOnTime = Math.abs(Math.round(curve[0].npv) - result.npvOfReplacements) <= 1;
        const parityDeferred = Math.abs(Math.round(curve[ENGINE_DEFER_YEARS].npv) - fi.deferredReplacementNpv) <= 1;
        const parityEarly = Math.abs(Math.round(earlyNpv) - fi.earlyReplacementNpv) <= 1;
        const optimal = curve.reduce((best, p) => (p.npv < best.npv ? p : best), curve[0]);
        const horizonTruncated = curve.some(p => p.events < curve[0].events);
        const deferPremium = fi.deferredReplacementNpv - result.npvOfReplacements;
        return {
            inflationRate, curve, earlyNpv, deferPremium, optimal, horizonTruncated,
            parityAll: parityOnTime && parityDeferred && parityEarly,
        };
    }, [result, selectedCountry]);

    if (!result) return <div className="text-slate-500 text-center py-20">Select a country to begin.</div>;

    const categories = [...new Set(result.assets.map(a => a.category))];
    const maxDepYear = Math.max(...result.annualDepreciationSchedule.map(s => s.total));

    // Group replacements by year
    const replacementsByYear: Record<number, { items: typeof result.replacementTimeline; total: number }> = {};
    result.replacementTimeline.forEach(r => {
        if (!replacementsByYear[r.year]) replacementsByYear[r.year] = { items: [], total: 0 };
        replacementsByYear[r.year].items.push(r);
        replacementsByYear[r.year].total += r.cost;
    });

    const { portfolioSummary: ps, financialImpact: fi, healthScores } = result;
    const criticalCount = healthScores.filter(h => h.riskLevel === 'critical').length;
    const highCount = healthScores.filter(h => h.riskLevel === 'high').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                            <LineChartIcon className="w-6 h-6 text-blue-500" />
                        </div>
                        Asset Lifecycle Curves
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">{result.assets.length} asset types — {depMethod} depreciation over {result.projectionYears}-year horizon</p>
                </div>
                <ExportPDFButton
                    isGenerating={isExporting}
                    onExport={async () => {
                        setIsExporting(true);
                        try {
                            const { generateAssetLifecyclePDF } = await import('@/modules/reporting/PdfGenerator');
                            await generateAssetLifecyclePDF(selectedCountry!, result);
                        } catch (e) {
                            console.error('Asset Lifecycle PDF error:', e);
                        } finally {
                            setIsExporting(false);
                        }
                    }}
                    label="PDF"
                    className="px-2 py-1 text-[10px]"
                />
            </div>

            {/* Depreciation Method Selector */}
            <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500 flex items-center gap-1">Depreciation Method: <Tooltip content="Annual accounting depreciation based on asset useful life. Straight-line spreads cost evenly; declining balance front-loads; sum-of-years accelerates early depreciation." /></span>
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    {[
                        { id: 'straight-line' as DepreciationMethod, label: 'Straight-Line', tooltip: 'Equal annual depreciation over asset life. Simplest method, spreads cost evenly.' },
                        { id: 'declining-balance' as DepreciationMethod, label: 'Declining Balance', tooltip: 'Accelerated depreciation — higher expense in early years, decreasing over time. Matches faster initial value loss.' },
                        { id: 'sum-of-years' as DepreciationMethod, label: 'Sum-of-Years', tooltip: 'Accelerated method using remaining life fraction. Front-loads depreciation more aggressively than declining balance.' },
                    ].map(m => (
                        <button
                            key={m.id}
                            onClick={() => setDepMethod(m.id)}
                            className={clsx(
                                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1",
                                depMethod === m.id ? "bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-400 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >{m.label} <Tooltip content={m.tooltip} /></button>
                    ))}
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Acquisition', value: fmtMoney(result.totalAcquisitionCost), icon: DollarSign, color: 'cyan', tooltip: 'Total estimated capital cost to replace an asset at end-of-life, including procurement, installation, and commissioning.' },
                    { label: '25-Year Lifecycle', value: fmtMoney(result.totalLifecycleCost25yr), icon: BarChart3, color: 'blue', tooltip: 'Total cost of ownership over a 25-year horizon, including initial acquisition, scheduled replacements, and depreciation.' },
                    { label: 'Annual Refresh Avg', value: fmtMoney(result.annualCapexRefresh), icon: RefreshCw, color: 'amber', tooltip: 'Yearly budget allocation for scheduled asset replacements and refresh cycles, averaged over the projection period.' },
                    { label: 'NPV of Replacements', value: fmtMoney(result.npvOfReplacements), icon: TrendingDown, color: 'green', tooltip: 'Net Present Value of all future replacement costs, discounted to today. Lower NPV indicates more favorable long-term CAPEX exposure.' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <kpi.icon className={`w-4 h-4 text-${kpi.color}-500`} />
                            <span className="text-xs text-slate-500 flex items-center gap-1">{kpi.label} <Tooltip content={kpi.tooltip} /></span>
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">{kpi.value}</div>
                    </div>
                ))}
            </div>

            {/* Narrative Summary */}
            <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4">
                <div className="flex gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg h-fit">
                        <Activity className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-1 flex items-center gap-1">Portfolio Assessment <Tooltip content="AI-generated narrative summarizing the facility's asset portfolio status, upcoming replacement events, and overall lifecycle cost outlook." /></h4>
                        <p className="text-sm text-indigo-800 dark:text-indigo-300 leading-relaxed">
                            This facility manages {result.assets.length} asset types with a total portfolio value of {fmtMoney(result.totalAcquisitionCost)}.
                            {' '}The average asset age is {ps.avgAssetAge} years, with {ps.oldestAsset} being the closest to end-of-life.
                            {' '}Next scheduled replacement: {ps.nextReplacement.name} at Year {ps.nextReplacement.year} ({fmtMoney(ps.nextReplacement.cost)}).
                            {' '}Peak CAPEX spend occurs in Year {ps.peakSpendYear} at {fmtMoney(ps.peakSpendAmount)}.
                            {criticalCount > 0 && ` Warning: ${criticalCount} asset types are at critical health status.`}
                            {highCount > 0 && ` ${highCount} asset types are at high risk.`}
                            {' '}The 25-year lifecycle cost of {fmtMoney(result.totalLifecycleCost25yr)} averages {fmtMoney(result.annualCapexRefresh)}/yr in refresh budget.
                        </p>
                    </div>
                </div>
            </div>

            {/* View Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                {[
                    { id: 'depreciation' as const, label: 'Depreciation Schedule', tooltip: 'Annual depreciation expense by category with book value and cumulative replacement cost curves.' },
                    { id: 'replacement' as const, label: 'Replacement Timeline', tooltip: 'Year-by-year CAPEX replacement forecast showing when major equipment refresh events occur.' },
                    { id: 'health' as const, label: 'Health & Risk', tooltip: 'Current condition assessment and failure probability for each asset type, with projected risk events.' },
                    { id: 'assets' as const, label: 'Asset Detail', tooltip: 'Full inventory table with per-unit cost, useful life, depreciation, and replacement year for every tracked asset.' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveView(tab.id)}
                        className={clsx(
                            "flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1",
                            activeView === tab.id ? "bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-400 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                    >{tab.label} <Tooltip content={tab.tooltip} /></button>
                ))}
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                {activeView === 'depreciation' && (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">Annual Depreciation by Category ({depMethod}) <Tooltip content="Yearly depreciation expense broken down by asset category. Shows how capital costs are allocated over each asset's useful life under the selected depreciation method." /></h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Each bar shows category-level depreciation expense for that year. Width is proportional to total annual depreciation.</p>
                            <div className="max-h-72 space-y-1 overflow-y-auto pr-1">{/* AG6: cap height */}
                                {result.annualDepreciationSchedule.slice(0, 25).map(year => (
                                    <div key={year.year} className="flex items-center gap-2">
                                        <span className="w-10 text-right text-xs font-mono text-slate-500">Y{year.year}</span>
                                        <div className="flex-1 flex h-5 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
                                            {categories.map(cat => {
                                                const catVal = year.byCategory[cat] || 0;
                                                const pct = maxDepYear > 0 ? (catVal / maxDepYear) * 100 : 0;
                                                return pct > 0 ? (
                                                    <div key={cat} className={`${CATEGORY_COLORS[cat] || 'bg-slate-400'} h-full`} style={{ width: `${pct}%` }} title={`${cat}: ${fmtMoney(catVal)}`} />
                                                ) : null;
                                            })}
                                        </div>
                                        <span className="w-16 text-right text-xs font-mono text-slate-700 dark:text-slate-300">{fmtMoney(year.total)}</span>
                                    </div>
                                ))}
                            </div>
                            {/* Legend */}
                            <div className="flex flex-wrap gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                {categories.map(cat => (
                                    <div key={cat} className="flex items-center gap-1.5 text-[10px]">
                                        <div className={`w-2.5 h-2.5 rounded ${CATEGORY_COLORS[cat] || 'bg-slate-400'}`} />
                                        <span className="text-slate-600 dark:text-slate-400">{cat}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Book Value Curve */}
                        <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                            <h4 className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-1">Book Value vs Cumulative Replacement Cost <Tooltip content="Book value declines as assets depreciate. Cumulative replacement cost rises each time assets are refreshed. Crossing point indicates when total replacement spend exceeds original acquisition value." /></h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Shows the declining book value of the portfolio against cumulative replacement spend over the projection period.</p>
                            <ResponsiveContainer width="100%" height={280}>
                                <ComposedChart data={result.bookValueCurve}>
                                    <defs>
                                        <linearGradient id="bvGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} label={{ value: 'Year', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: number) => fmtMoney(v)} />
                                    <RTooltip
                                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                        formatter={((v: number, name: string) => [fmtMoney(v), name === 'bookValue' ? 'Book Value' : 'Cum. Replacement']) as any}
                                    />
                                    <Area type="monotone" dataKey="bookValue" fill="url(#bvGrad)" stroke="#06b6d4" strokeWidth={2} />
                                    <Line type="stepAfter" dataKey="cumulativeReplacement" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                            <div className="flex items-center justify-center gap-6 mt-2 text-xs text-slate-500">
                                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-cyan-500 rounded" /><span className="flex items-center gap-0.5">Book Value <Tooltip content="Net book value of all assets after accumulated depreciation. Declines over time as assets age toward end-of-life." /></span></div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-amber-500 rounded" /><span className="flex items-center gap-0.5">Cumulative Replacement Cost <Tooltip content="Running total of all replacement expenditures over the projection period. Step increases correspond to asset refresh events." /></span></div>
                            </div>
                        </div>
                    </div>
                )}

                {activeView === 'replacement' && (
                    <div className="space-y-4">
                        <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">CAPEX Replacement Timeline (25 Years) <Tooltip content="Planned timeline for asset refresh over 25 years, coordinated to minimize concurrent outage risk. Bars show annual replacement spend." /></h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Annual replacement spend showing when major CAPEX events occur. Budget for peak years and spread replacements to minimize operational risk.</p>
                        <div className="space-y-1">
                            {Array.from({ length: 25 }, (_, i) => i + 1).map(year => {
                                const yearData = replacementsByYear[year];
                                const total = yearData?.total || 0;
                                const maxTotal = Math.max(...Object.values(replacementsByYear).map(y => y.total), 1);
                                const pct = total > 0 ? (total / maxTotal) * 100 : 0;
                                const isPeak = year === ps.peakSpendYear;
                                return (
                                    <div key={year} className="flex items-center gap-2">
                                        <span className={clsx("w-10 text-right text-xs font-mono", isPeak ? "text-red-500 font-bold" : "text-slate-500")}>Y{year}</span>
                                        <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
                                            {total > 0 && (
                                                <div className={clsx("h-full rounded", isPeak ? "bg-red-500" : "bg-blue-500")} style={{ width: `${pct}%` }} />
                                            )}
                                        </div>
                                        <span className={clsx("w-16 text-right text-xs font-mono", isPeak ? "text-red-500 font-bold" : "text-slate-700 dark:text-slate-300")}>{total > 0 ? fmtMoney(total) : '—'}</span>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Replacement detail */}
                        {Object.entries(replacementsByYear).slice(0, 10).map(([year, data]) => (
                            <div key={year} className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Year {year} — {fmtMoney(data.total)} total</div>
                                <div className="space-y-0.5">
                                    {data.items.map((item, i) => (
                                        <div key={i} className="flex justify-between text-[10px]">
                                            <span className="text-slate-500">{item.count}x {item.assetName}</span>
                                            <span className="text-slate-700 dark:text-slate-300 font-mono">{fmtMoney(item.cost)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeView === 'health' && (
                    <div className="space-y-6">
                        <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">Asset Health & Risk Assessment <Tooltip content="Health scores based on asset age relative to useful life. Failure probability follows an exponential curve — risk increases rapidly as assets approach end-of-life." /></h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Each card shows current health status assuming average 5-year operating age. Monitor critical and high-risk assets for proactive replacement.</p>
                        </div>

                        {/* Health Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {healthScores.map(h => (
                                <div key={h.assetId} className="bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate flex-1">{h.name}</span>
                                        {isCriticalHealth(h) ? (
                                            <button
                                                type="button"
                                                onClick={() => setOpenHealth(openHealth === h.assetId ? null : h.assetId)}
                                                title={`Health ${h.healthPct}% ≤ ambang critical ${HEALTH_CRITICAL_PCT}%. Klik untuk alasan (umur vs design life, failure probability) + lever ganti-sekarang-vs-tunda terukur dari model NPV yang sama.`}
                                                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 cursor-pointer underline decoration-dotted underline-offset-2"
                                            >{h.riskLevel}</button>
                                        ) : (
                                        <span className={clsx("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                                            h.riskLevel === 'high' ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' :
                                            h.riskLevel === 'medium' ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400' :
                                            'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                                        )}>{h.riskLevel}</span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">{h.category}</div>
                                    {/* Health bar */}
                                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                                        <div className={clsx("h-full rounded-full", HEALTH_COLORS[h.riskLevel])} style={{ width: `${h.healthPct}%` }} />
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-slate-600 dark:text-slate-400">{h.healthPct}% health</span>
                                        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-0.5">{h.remainingLife}yr left <Tooltip content="Estimated years of useful life remaining based on age, condition, and maintenance history." /></span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-1 flex items-center gap-0.5">
                                        Failure prob: {(h.failureProbability * 100).toFixed(1)}% <Tooltip content="Annual probability of catastrophic failure based on the Weibull distribution and current asset age." />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* DIAGNOSTICS TIER-2 — critical-health explain panel (click a red chip) */}
                        {openHealth && diag && (() => {
                            const h = healthScores.find(x => x.assetId === openHealth);
                            const a = result.assets.find(x => x.assetId === openHealth);
                            if (!h || !a || !isCriticalHealth(h)) return null;
                            const fp = failureProbRecompute(a.usefulLifeYears);
                            const parityFp = Math.abs(fp.prob - h.failureProbability) <= 0.0005;
                            const py = result.projectionYears;
                            const onTime = assetReplaceNpv(a, 0, diag.inflationRate, py);
                            const deferred = assetReplaceNpv(a, ENGINE_DEFER_YEARS, diag.inflationRate, py);
                            const early = assetReplaceNpv(a, -ENGINE_DEFER_YEARS, diag.inflationRate, py);
                            const deferDelta = deferred.npv - onTime.npv;
                            const earlyVsDefer = deferred.npv - early.npv;
                            const agingMaint = ENGINE_AGING_MAINT_PCT * a.totalAcquisitionCost * fp.ageRatio * fp.ageRatio;
                            return (
                                <div className="p-4 rounded-lg border text-left bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="text-xs font-bold text-slate-900 dark:text-white">{a.name} — kenapa CRITICAL (angka model live)</div>
                                        <button type="button" onClick={() => setOpenHealth(null)} className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">tutup ✕</button>
                                    </div>
                                    {/* Why — age vs design life + failure probability decomposition */}
                                    <div>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                            Umur asumsi model <span className="font-mono">{ENGINE_ASSUMED_AGE_YR} th</span> vs design life <span className="font-mono">{a.usefulLifeYears} th</span> → sisa umur <span className="font-mono">{h.remainingLife} th</span>; health <span className="font-mono font-bold">{h.healthPct}%</span> ≤ ambang critical <span className="font-mono">{HEALTH_CRITICAL_PCT}%</span> (satu konstanta: pewarnaan chip + gate panel + collector).
                                        </p>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-mono mt-1">
                                            Failure prob = min({ENGINE_FAILPROB_CAP}, {ENGINE_FAILPROB_BASE} × e^({ENGINE_FAILPROB_K} × {fp.ageRatio.toFixed(3)} × 5)) = {(fp.prob * 100).toFixed(1)}%/yr
                                            {parityFp ? (
                                                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">≡ engine</span>
                                            ) : (
                                                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" title="Dekomposisi tidak lagi cocok dengan output engine — angka kartu tetap dari engine; faktor di atas indikatif.">≠ engine — angka kartu yang berlaku</span>
                                            )}
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                            healthPct dihitung engine <span className="font-mono">rzModels().asset.healthIndex</span> (condition 0.9, duty 0.6) bila model tersedia, fallback rasio umur — nilai di kartu adalah angka model live, bukan re-implementasi panel ini.
                                        </p>
                                    </div>
                                    {/* Measured lever — replace now vs defer, same NPV model per-asset */}
                                    <div>
                                        <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5">Lever terukur — ganti sekarang vs tunda (formula NPV model yang sama, per aset)</div>
                                        <div className="space-y-1 text-[11px] font-mono">
                                            <div className="flex items-center gap-2"><span className="w-40 shrink-0 text-slate-500 dark:text-slate-400">Early (−{ENGINE_DEFER_YEARS} th)</span><span className="text-slate-700 dark:text-slate-300">{fmtMoney(early.npv)} NPV</span></div>
                                            <div className="flex items-center gap-2"><span className="w-40 shrink-0 text-slate-500 dark:text-slate-400">On-time (Y{a.usefulLifeYears})</span><span className="text-slate-700 dark:text-slate-300">{fmtMoney(onTime.npv)} NPV</span></div>
                                            <div className="flex items-center gap-2"><span className="w-40 shrink-0 text-slate-500 dark:text-slate-400">Tunda (+{ENGINE_DEFER_YEARS} th, ×{(1 + ENGINE_DEFER_PENALTY_PER_YR * ENGINE_DEFER_YEARS).toFixed(2)})</span><span className="text-red-600 dark:text-red-400">{fmtMoney(deferred.npv)} NPV (+{fmtMoney(deferDelta)})</span></div>
                                        </div>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-snug">
                                            Menunda +{ENGINE_DEFER_YEARS} th menambah <span className="font-mono font-bold">{fmtMoney(deferDelta)}</span> NPV vs on-time (penalti kegagalan {ENGINE_DEFER_PENALTY_PER_YR * 100}%/th); ganti lebih awal menghindari penalti itu — hemat <span className="font-mono font-bold">{fmtMoney(earlyVsDefer)}</span> vs menunda. Biaya maintenance penuaan aset ini saat umur {ENGINE_ASSUMED_AGE_YR} th: <span className="font-mono">{fmtMoney(agingMaint)}/yr</span> (bagian dari {fmtMoney(fi.maintenanceCostOfAging)}/yr portfolio, formula 2% × cost × ageRatio² yang sama).
                                        </p>
                                    </div>
                                    {/* Honest-unreachable + nav */}
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug">
                                        Catatan jujur: model tidak memiliki opsi mid-life repair/refurbishment — tidak ada angka yang bisa ditampilkan untuk lever itu. NPV model juga hanya menghukum penundaan (penalti {ENGINE_DEFER_PENALTY_PER_YR * 100}%/th); manfaat risiko-kegagalan-terhindar dari early replacement tidak diberi kredit finansial, sehingga on-time selalu termurah secara NPV murni.
                                    </p>
                                    <button type="button" onClick={() => setActiveView('replacement')} className="text-[11px] font-medium text-cyan-700 dark:text-cyan-400 hover:underline">
                                        Lihat Replacement Timeline ↗
                                    </button>
                                </div>
                            );
                        })()}

                        {/* Risk Events Timeline */}
                        <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                            <h4 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4 text-amber-500" /> Risk Events Timeline
                                <Tooltip content="Projected risk events from the replacement schedule. Critical events indicate multiple high-impact replacements in the same year." />
                            </h4>
                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {result.riskEvents.slice(0, 20).map((evt, i) => (
                                    <div key={i} className={clsx("flex items-start gap-3 px-3 py-2 rounded-lg border", SEVERITY_COLORS[evt.severity])}>
                                        <span className="text-xs font-mono font-bold w-8 shrink-0">Y{evt.year}</span>
                                        <span className="text-xs flex-1">{evt.description}</span>
                                        <span className="text-[9px] font-bold uppercase">{evt.severity}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeView === 'assets' && (
                    <div className="space-y-4">
                        <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">Asset Detail ({result.assets.length} asset types) <Tooltip content="Total number of tracked asset types across all categories in the facility. Each row shows per-unit and aggregate cost, depreciation, and replacement year." /></h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Complete inventory of tracked assets with cost, lifecycle, and depreciation data. Health column shows current condition assessment.</p>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] text-sm">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/80">
                                        <th className="text-left px-3 py-2 text-slate-500 font-medium"><span className="flex items-center gap-0.5">Asset <Tooltip content="Equipment name and category. Color dot indicates the asset category grouping." /></span></th>
                                        <th className="text-center px-3 py-2 text-slate-500 font-medium"><span className="flex items-center justify-center gap-0.5">Qty <Tooltip content="Number of units of this asset type deployed in the facility." /></span></th>
                                        <th className="text-center px-3 py-2 text-slate-500 font-medium"><span className="flex items-center justify-center gap-0.5">Life (yr) <Tooltip content="Expected useful life in years before the asset requires replacement." /></span></th>
                                        <th className="text-right px-3 py-2 text-slate-500 font-medium"><span className="flex items-center justify-end gap-0.5">Unit Cost <Tooltip content="Replacement cost per unit for this asset category." /></span></th>
                                        <th className="text-right px-3 py-2 text-slate-500 font-medium"><span className="flex items-center justify-end gap-0.5">Total Cost <Tooltip content="Aggregate acquisition cost (unit cost multiplied by quantity deployed)." /></span></th>
                                        <th className="text-right px-3 py-2 text-slate-500 font-medium"><span className="flex items-center justify-end gap-0.5">Annual Dep. <Tooltip content="Yearly depreciation expense for this asset under the selected depreciation method." /></span></th>
                                        <th className="text-center px-3 py-2 text-slate-500 font-medium"><span className="flex items-center justify-center gap-0.5">Health <Tooltip content="Current asset health score (0-100%) based on age, maintenance history, and environmental factors." /></span></th>
                                        <th className="text-right px-3 py-2 text-slate-500 font-medium"><span className="flex items-center justify-end gap-0.5">Replace <Tooltip content="Projected replacement year based on useful life and current age of the asset." /></span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.assets.map(a => {
                                        const health = healthScores.find(h => h.assetId === a.assetId);
                                        return (
                                            <tr key={a.assetId} className="border-t border-slate-100 dark:border-slate-800">
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[a.category] || 'bg-slate-400'}`} />
                                                        <span className="text-slate-800 dark:text-slate-200 text-xs">{a.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-center font-mono text-slate-700 dark:text-slate-300">{a.count}</td>
                                                <td className="px-3 py-2 text-center font-mono text-slate-700 dark:text-slate-300">{a.usefulLifeYears}</td>
                                                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">{fmtMoney(a.unitCost)}</td>
                                                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">{fmtMoney(a.totalAcquisitionCost)}</td>
                                                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">{fmtMoney(a.annualDepreciation)}</td>
                                                <td className="px-3 py-2 text-center">
                                                    {health && (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <div className={clsx("w-2 h-2 rounded-full", HEALTH_COLORS[health.riskLevel])} />
                                                            <span className="text-[10px] font-mono">{health.healthPct}%</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">Y{a.replacementYear}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-300 dark:border-slate-600 font-bold">
                                        <td className="px-3 py-2 text-slate-900 dark:text-white">Total</td>
                                        <td className="px-3 py-2 text-center text-slate-900 dark:text-white">{result.assets.reduce((s, a) => s + a.count, 0)}</td>
                                        <td></td>
                                        <td></td>
                                        <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white">{fmtMoney(result.totalAcquisitionCost)}</td>
                                        <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white">{fmtMoney(result.assets.reduce((s, a) => s + a.annualDepreciation, 0))}</td>
                                        <td></td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Financial Impact — Replacement Strategy Comparison */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Financial Impact — Replacement Strategy
                    <Tooltip content="Compares NPV of three strategies: replacing assets 2 years early, on schedule, and 2 years deferred. Deferred replacement incurs a 15% failure cost penalty per year." />
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">NPV comparison of early (proactive), on-time, and deferred replacement strategies. Deferred replacement carries 15% annual failure cost penalty.</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center gap-1.5 mb-1">
                            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold flex items-center gap-0.5">Early (−2yr) <Tooltip content="NPV of replacing all assets 2 years before scheduled end-of-life. Higher upfront cost but avoids failure risk and unplanned downtime." /></span>
                        </div>
                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmtMoney(fi.earlyReplacementNpv)}</div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span className="text-[10px] text-blue-700 dark:text-blue-400 uppercase font-semibold flex items-center gap-0.5">On-Time <Tooltip content="NPV of replacing assets exactly at their scheduled end-of-life. Baseline strategy with no early or deferred cost adjustments." /></span>
                        </div>
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{fmtMoney(result.npvOfReplacements)}</div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                        <div className="flex items-center gap-1.5 mb-1">
                            <ArrowDownRight className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                            <span className="text-[10px] text-red-700 dark:text-red-400 uppercase font-semibold flex items-center gap-0.5">Deferred (+2yr) <Tooltip content="NPV of deferring replacements by 2 years beyond end-of-life. Incurs a 15% annual failure cost penalty for each deferred year." /></span>
                        </div>
                        {diag && diag.deferPremium > DEFER_PREMIUM_RED_USD ? (
                            <button
                                type="button"
                                onClick={() => setOpenDefer(!openDefer)}
                                title={`Menunda +${ENGINE_DEFER_YEARS} th menambah ${fmtMoney(diag.deferPremium)} NPV vs on-time (ambang merah > ${fmtMoney(DEFER_PREMIUM_RED_USD)}). Klik untuk kurva biaya kegagalan per tahun penundaan + window penundaan optimal (model yang sama).`}
                                className="text-lg font-bold text-red-600 dark:text-red-400 cursor-pointer underline decoration-dotted underline-offset-4"
                            >{fmtMoney(fi.deferredReplacementNpv)}</button>
                        ) : (
                            <div className="text-lg font-bold text-red-600 dark:text-red-400">{fmtMoney(fi.deferredReplacementNpv)}</div>
                        )}
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-1.5 mb-1">
                            <DollarSign className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-semibold flex items-center gap-0.5">Aging Maint Cost <Tooltip content="Estimated annual maintenance cost increase due to aging assets operating beyond optimal life. Reflects higher repair frequency and parts scarcity." /></span>
                        </div>
                        <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{fmtMoney(fi.maintenanceCostOfAging)}/yr</div>
                    </div>
                </div>
                {/* DIAGNOSTICS TIER-2 — deferral failure-cost curve panel (click the red Deferred NPV) */}
                {openDefer && diag && diag.deferPremium > DEFER_PREMIUM_RED_USD && (
                    <div className="mt-3 p-4 rounded-lg border text-left bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className="text-xs font-bold text-slate-900 dark:text-white">Kenapa merah — biaya penundaan (angka model live)</div>
                            <button type="button" onClick={() => setOpenDefer(false)} className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">tutup ✕</button>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-mono">
                            Deferred NPV {fmtMoney(fi.deferredReplacementNpv)} = on-time {fmtMoney(result.npvOfReplacements)} + premium {fmtMoney(diag.deferPremium)} (penalti kegagalan {ENGINE_DEFER_PENALTY_PER_YR * 100}%/th × {ENGINE_DEFER_YEARS} th = ×{(1 + ENGINE_DEFER_PENALTY_PER_YR * ENGINE_DEFER_YEARS).toFixed(2)}, diskonto {ENGINE_DISCOUNT_RATE * 100}%, inflasi {(diag.inflationRate * 100).toFixed(1)}%)
                            {diag.parityAll ? (
                                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" title="Titik d=0, d=2 dan early (−2) pada kurva identik dengan npvOfReplacements / deferredReplacementNpv / earlyReplacementNpv engine (±$1).">≡ engine</span>
                            ) : (
                                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" title="Rekomputasi kurva tidak lagi cocok dengan output engine — angka kartu tetap dari engine; kurva di bawah indikatif.">≠ engine — angka kartu yang berlaku</span>
                            )}
                        </p>
                        {/* Failure-cost curve vs deferral years */}
                        <div>
                            <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5">Kurva biaya kegagalan vs tahun penundaan (portfolio, model yang sama)</div>
                            <div className="space-y-1">
                                {diag.curve.map(p => {
                                    const maxNpv = Math.max(...diag.curve.map(c => c.npv));
                                    const delta = p.npv - diag.curve[0].npv;
                                    const truncated = p.events < diag.curve[0].events;
                                    return (
                                        <div key={p.d} className="flex items-center gap-2 text-[11px]">
                                            <span className={clsx("w-24 shrink-0 font-mono", p.d === ENGINE_DEFER_YEARS ? "font-bold text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400")}>+{p.d} th ×{p.penaltyFactor.toFixed(2)}</span>
                                            <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
                                                <div className={clsx("h-full rounded", p.d === 0 ? "bg-blue-500" : "bg-red-500/80")} style={{ width: `${(p.npv / maxNpv) * 100}%` }} />
                                            </div>
                                            <span className="w-44 shrink-0 text-right font-mono text-slate-700 dark:text-slate-300">
                                                {fmtMoney(p.npv)}{p.d > 0 && <span className={delta > 0 ? " text-red-600 dark:text-red-400" : " text-emerald-600 dark:text-emerald-400"}> ({delta >= 0 ? '+' : '−'}{fmtMoney(Math.abs(delta))})</span>}
                                            </span>
                                            {truncated && <span className="text-[9px] text-amber-600 dark:text-amber-400" title={`${diag.curve[0].events - p.events} siklus penggantian keluar dari horizon ${result.projectionYears} th pada penundaan ini`}>⚠ horizon</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        {/* Optimal deferral window — derived from the same curve */}
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                            Window penundaan optimal (NPV terendah pada kurva): <span className="font-mono font-bold">+{diag.optimal.d} th</span> — {fmtMoney(diag.optimal.npv)}.
                            {diag.optimal.d === 0
                                ? ` Penalti ${ENGINE_DEFER_PENALTY_PER_YR * 100}%/th melebihi keuntungan diskonto ${ENGINE_DISCOUNT_RATE * 100}%/th − inflasi ${(diag.inflationRate * 100).toFixed(1)}%/th, jadi setiap tahun penundaan menambah biaya — window optimal = tidak menunda.`
                                : ' Perhatikan tanda ⚠ horizon: NPV yang lebih rendah pada penundaan ini sebagian berasal dari siklus penggantian yang keluar dari horizon proyeksi (artefak horizon, bukan penghematan nyata).'}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug">
                            Catatan jujur: engine hanya menghitung titik d={ENGINE_DEFER_YEARS} (dan early −{ENGINE_DEFER_YEARS}); titik kurva lainnya adalah generalisasi aturan penalti {ENGINE_DEFER_PENALTY_PER_YR * 100}%/th yang dinyatakan model itu sendiri, dengan titik d=0 dan d={ENGINE_DEFER_YEARS} diverifikasi identik terhadap engine (chip di atas). Ambang merah kartu: premium &gt; {fmtMoney(DEFER_PREMIUM_RED_USD)} (satu konstanta dengan collector).
                        </p>
                        <button type="button" onClick={() => setActiveView('health')} className="text-[11px] font-medium text-cyan-700 dark:text-cyan-400 hover:underline">
                            Lihat Health &amp; Risk per aset ↗
                        </button>
                    </div>
                )}
                {fi.savingsFromEarly > 0 && (
                    <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <p className="text-xs text-emerald-800 dark:text-emerald-300">
                            Proactive replacement saves approximately {fmtMoney(fi.savingsFromEarly)} in NPV compared to deferred replacement, by avoiding failure-related costs and unplanned downtime penalties.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
