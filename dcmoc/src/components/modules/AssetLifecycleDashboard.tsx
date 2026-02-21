'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { calculateAssetLifecycle, AssetLifecycleResult, DepreciationMethod } from '@/modules/analytics/AssetLifecycleEngine';
import { LineChart, DollarSign, Calendar, TrendingDown, BarChart3, Layers, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

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

export default function AssetLifecycleDashboard() {
    const { selectedCountry, inputs } = useSimulationStore();
    const [depMethod, setDepMethod] = useState<DepreciationMethod>('straight-line');
    const [activeView, setActiveView] = useState<'depreciation' | 'replacement' | 'assets'>('depreciation');

    const result = useMemo<AssetLifecycleResult | null>(() => {
        if (!selectedCountry) return null;
        return calculateAssetLifecycle({
            country: selectedCountry,
            itLoadKw: inputs.itLoad,
            tierLevel: inputs.tierLevel,
            coolingType: inputs.coolingType,
            depreciationMethod: depMethod,
        });
    }, [selectedCountry, inputs.itLoad, inputs.tierLevel, inputs.coolingType, depMethod]);

    if (!result) return <div className="text-slate-500 text-center py-20">Select a country to begin.</div>;

    const fmt = (n: number) => n.toLocaleString('en-US');
    const fmtK = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;

    const categories = [...new Set(result.assets.map(a => a.category))];
    const maxDepYear = Math.max(...result.annualDepreciationSchedule.map(s => s.total));
    const maxReplacementYear = result.replacementTimeline.length > 0
        ? Math.max(...result.replacementTimeline.map(r => r.cost))
        : 1;

    // Group replacements by year
    const replacementsByYear: Record<number, { items: typeof result.replacementTimeline; total: number }> = {};
    result.replacementTimeline.forEach(r => {
        if (!replacementsByYear[r.year]) replacementsByYear[r.year] = { items: [], total: 0 };
        replacementsByYear[r.year].items.push(r);
        replacementsByYear[r.year].total += r.cost;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                            <LineChart className="w-6 h-6 text-blue-500" />
                        </div>
                        Asset Lifecycle Curves
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Module 42 — Depreciation & replacement cost modeling over {result.projectionYears}-year horizon</p>
                </div>
            </div>

            {/* Depreciation Method Selector */}
            <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500">Depreciation Method:</span>
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
                    { label: 'Total Acquisition', value: fmtK(result.totalAcquisitionCost), icon: DollarSign, color: 'cyan' },
                    { label: '25-Year Lifecycle', value: fmtK(result.totalLifecycleCost25yr), icon: BarChart3, color: 'blue' },
                    { label: 'Annual Refresh Avg', value: fmtK(result.annualCapexRefresh), icon: RefreshCw, color: 'amber' },
                    { label: 'NPV of Replacements', value: fmtK(result.npvOfReplacements), icon: TrendingDown, color: 'green' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <kpi.icon className={`w-4 h-4 text-${kpi.color}-500`} />
                            <span className="text-xs text-slate-500">{kpi.label}</span>
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">{kpi.value}</div>
                    </div>
                ))}
            </div>

            {/* View Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                {[
                    { id: 'depreciation' as const, label: 'Depreciation Schedule' },
                    { id: 'replacement' as const, label: 'Replacement Timeline' },
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
                    <div className="space-y-4">
                        <h4 className="font-semibold text-slate-900 dark:text-white">Annual Depreciation by Category ({depMethod})</h4>
                        <div className="space-y-1">
                            {result.annualDepreciationSchedule.slice(0, 25).map(year => (
                                <div key={year.year} className="flex items-center gap-2">
                                    <span className="w-10 text-right text-xs font-mono text-slate-500">Y{year.year}</span>
                                    <div className="flex-1 flex h-5 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
                                        {categories.map(cat => {
                                            const catVal = year.byCategory[cat] || 0;
                                            const pct = maxDepYear > 0 ? (catVal / maxDepYear) * 100 : 0;
                                            return pct > 0 ? (
                                                <div key={cat} className={`${CATEGORY_COLORS[cat] || 'bg-slate-400'} h-full`} style={{ width: `${pct}%` }} title={`${cat}: ${fmtK(catVal)}`} />
                                            ) : null;
                                        })}
                                    </div>
                                    <span className="w-16 text-right text-xs font-mono text-slate-700 dark:text-slate-300">{fmtK(year.total)}</span>
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
                )}

                {activeView === 'replacement' && (
                    <div className="space-y-4">
                        <h4 className="font-semibold text-slate-900 dark:text-white">CAPEX Replacement Timeline (25 Years)</h4>
                        <div className="space-y-1">
                            {Array.from({ length: 25 }, (_, i) => i + 1).map(year => {
                                const yearData = replacementsByYear[year];
                                const total = yearData?.total || 0;
                                const pct = maxReplacementYear > 0 ? (total / Math.max(...Object.values(replacementsByYear).map(y => y.total))) * 100 : 0;
                                return (
                                    <div key={year} className="flex items-center gap-2">
                                        <span className="w-10 text-right text-xs font-mono text-slate-500">Y{year}</span>
                                        <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
                                            {total > 0 && (
                                                <div className="h-full bg-blue-500 rounded" style={{ width: `${pct}%` }} />
                                            )}
                                        </div>
                                        <span className="w-16 text-right text-xs font-mono text-slate-700 dark:text-slate-300">{total > 0 ? fmtK(total) : '—'}</span>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Replacement detail */}
                        {Object.entries(replacementsByYear).slice(0, 10).map(([year, data]) => (
                            <div key={year} className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Year {year} — {fmtK(data.total)} total</div>
                                <div className="space-y-0.5">
                                    {data.items.map((item, i) => (
                                        <div key={i} className="flex justify-between text-[10px]">
                                            <span className="text-slate-500">{item.count}x {item.assetName}</span>
                                            <span className="text-slate-700 dark:text-slate-300 font-mono">{fmtK(item.cost)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeView === 'assets' && (
                    <div className="space-y-4">
                        <h4 className="font-semibold text-slate-900 dark:text-white">Asset Detail ({result.assets.length} asset types)</h4>
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
                                        <th className="text-right px-3 py-2 text-slate-500 font-medium">Replacement</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.assets.map(a => (
                                        <tr key={a.assetId} className="border-t border-slate-100 dark:border-slate-800">
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[a.category] || 'bg-slate-400'}`} />
                                                    <span className="text-slate-800 dark:text-slate-200 text-xs">{a.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center font-mono text-slate-700 dark:text-slate-300">{a.count}</td>
                                            <td className="px-3 py-2 text-center font-mono text-slate-700 dark:text-slate-300">{a.usefulLifeYears}</td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">{fmtK(a.unitCost)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">{fmtK(a.totalAcquisitionCost)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">{fmtK(a.annualDepreciation)}</td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">Y{a.replacementYear}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-300 dark:border-slate-600 font-bold">
                                        <td className="px-3 py-2 text-slate-900 dark:text-white">Total</td>
                                        <td className="px-3 py-2 text-center text-slate-900 dark:text-white">{result.assets.reduce((s, a) => s + a.count, 0)}</td>
                                        <td></td>
                                        <td></td>
                                        <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white">{fmtK(result.totalAcquisitionCost)}</td>
                                        <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-white">{fmtK(result.assets.reduce((s, a) => s + a.annualDepreciation, 0))}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
