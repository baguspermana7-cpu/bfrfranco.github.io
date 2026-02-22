'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { calculateAssetLifecycle, AssetLifecycleResult, DepreciationMethod, AssetHealthScore } from '@/modules/analytics/AssetLifecycleEngine';
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

export default function AssetLifecycleDashboard() {
    const { selectedCountry, inputs } = useSimulationStore();
    const [depMethod, setDepMethod] = useState<DepreciationMethod>('straight-line');
    const [activeView, setActiveView] = useState<'depreciation' | 'replacement' | 'health' | 'assets'>('depreciation');
    const [isExporting, setIsExporting] = useState(false);

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
                        { id: 'straight-line' as DepreciationMethod, label: 'Straight-Line' },
                        { id: 'declining-balance' as DepreciationMethod, label: 'Declining Balance' },
                        { id: 'sum-of-years' as DepreciationMethod, label: 'Sum-of-Years' },
                    ].map(m => (
                        <button
                            key={m.id}
                            onClick={() => setDepMethod(m.id)}
                            className={clsx(
                                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                                depMethod === m.id ? "bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-400 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >{m.label}</button>
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
                        <h4 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-1">Portfolio Assessment</h4>
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
                    { id: 'depreciation' as const, label: 'Depreciation Schedule' },
                    { id: 'replacement' as const, label: 'Replacement Timeline' },
                    { id: 'health' as const, label: 'Health & Risk' },
                    { id: 'assets' as const, label: 'Asset Detail' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveView(tab.id)}
                        className={clsx(
                            "flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors",
                            activeView === tab.id ? "bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-400 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                    >{tab.label}</button>
                ))}
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                {activeView === 'depreciation' && (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">Annual Depreciation by Category ({depMethod}) <Tooltip content="Yearly depreciation expense broken down by asset category. Shows how capital costs are allocated over each asset's useful life under the selected depreciation method." /></h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Each bar shows category-level depreciation expense for that year. Width is proportional to total annual depreciation.</p>
                            <div className="space-y-1">
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
                                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-cyan-500 rounded" /><span>Book Value</span></div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-amber-500 rounded" /><span>Cumulative Replacement Cost</span></div>
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
                                        <span className={clsx("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                                            h.riskLevel === 'critical' ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400' :
                                            h.riskLevel === 'high' ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' :
                                            h.riskLevel === 'medium' ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400' :
                                            'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                                        )}>{h.riskLevel}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">{h.category}</div>
                                    {/* Health bar */}
                                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                                        <div className={clsx("h-full rounded-full", HEALTH_COLORS[h.riskLevel])} style={{ width: `${h.healthPct}%` }} />
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-slate-600 dark:text-slate-400">{h.healthPct}% health</span>
                                        <span className="text-slate-600 dark:text-slate-400">{h.remainingLife}yr left</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-1">
                                        Failure prob: {(h.failureProbability * 100).toFixed(1)}%
                                    </div>
                                </div>
                            ))}
                        </div>

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
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/80">
                                        <th className="text-left px-3 py-2 text-slate-500 font-medium">Asset</th>
                                        <th className="text-center px-3 py-2 text-slate-500 font-medium">Qty</th>
                                        <th className="text-center px-3 py-2 text-slate-500 font-medium">Life (yr)</th>
                                        <th className="text-right px-3 py-2 text-slate-500 font-medium">Unit Cost</th>
                                        <th className="text-right px-3 py-2 text-slate-500 font-medium">Total Cost</th>
                                        <th className="text-right px-3 py-2 text-slate-500 font-medium">Annual Dep.</th>
                                        <th className="text-center px-3 py-2 text-slate-500 font-medium">Health</th>
                                        <th className="text-right px-3 py-2 text-slate-500 font-medium">Replace</th>
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
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold">Early (−2yr)</span>
                        </div>
                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmtMoney(fi.earlyReplacementNpv)}</div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span className="text-[10px] text-blue-700 dark:text-blue-400 uppercase font-semibold">On-Time</span>
                        </div>
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{fmtMoney(result.npvOfReplacements)}</div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                        <div className="flex items-center gap-1.5 mb-1">
                            <ArrowDownRight className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                            <span className="text-[10px] text-red-700 dark:text-red-400 uppercase font-semibold">Deferred (+2yr)</span>
                        </div>
                        <div className="text-lg font-bold text-red-600 dark:text-red-400">{fmtMoney(fi.deferredReplacementNpv)}</div>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-1.5 mb-1">
                            <DollarSign className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-semibold">Aging Maint Cost</span>
                        </div>
                        <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{fmtMoney(fi.maintenanceCostOfAging)}/yr</div>
                    </div>
                </div>
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
