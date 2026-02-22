'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { calculateCompliance, ComplianceResult, ComplianceCategory } from '@/modules/compliance/ComplianceEngine';
import { ClipboardCheck, Shield, DollarSign, AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react';
import clsx from 'clsx';
import { fmtMoney, fmtMoneyFull } from '@/lib/format';

const CATEGORY_COLORS: Record<ComplianceCategory, string> = {
    fire: 'bg-red-500',
    electrical: 'bg-amber-500',
    environmental: 'bg-green-500',
    building: 'bg-blue-500',
    'data-protection': 'bg-purple-500',
    telecom: 'bg-cyan-500',
};

const CATEGORY_BG: Record<ComplianceCategory, string> = {
    fire: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800',
    electrical: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800',
    environmental: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800',
    building: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800',
    'data-protection': 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800',
    telecom: 'bg-cyan-50 dark:bg-cyan-900/10 border-cyan-200 dark:border-cyan-800',
};

export default function ComplianceDashboard() {
    const { selectedCountry, inputs } = useSimulationStore();
    const [activeCategory, setActiveCategory] = useState<ComplianceCategory | 'all'>('all');

    const result = useMemo<ComplianceResult | null>(() => {
        if (!selectedCountry) return null;
        return calculateCompliance(selectedCountry, inputs.itLoad);
    }, [selectedCountry, inputs.itLoad]);

    if (!result) return <div className="text-slate-500 text-center py-20">Select a country to begin.</div>;

    const filteredItems = activeCategory === 'all' ? result.items : result.items.filter(i => i.category === activeCategory);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-xl">
                        <ClipboardCheck className="w-6 h-6 text-emerald-500" />
                    </div>
                    Compliance Checklist — {result.countryName}
                </h2>
                <p className="text-sm text-slate-500 mt-1">Module 41 — Auto-generated regulatory requirements per country</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Requirements', value: result.totalCount, icon: ClipboardCheck, color: 'cyan' },
                    { label: 'Mandatory', value: result.mandatoryCount, icon: AlertTriangle, color: 'amber' },
                    { label: 'Initial Cost', value: fmtMoney(result.totalInitialCost), icon: DollarSign, color: 'blue' },
                    { label: 'Annual Cost', value: fmtMoney(result.totalAnnualCost), icon: BarChart3, color: 'green' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <kpi.icon className={`w-4 h-4 text-${kpi.color}-500`} />
                            <span className="text-xs text-slate-500">{kpi.label}</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{kpi.value}</div>
                    </div>
                ))}
            </div>

            {/* Compliance Score */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Compliance Coverage Score</h3>
                    <span className={clsx("text-2xl font-bold", result.complianceScore >= 80 ? "text-emerald-500" : result.complianceScore >= 60 ? "text-amber-500" : "text-red-500")}>
                        {result.complianceScore}/100
                    </span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={clsx(
                        "h-full rounded-full transition-all",
                        result.complianceScore >= 80 ? "bg-emerald-500" : result.complianceScore >= 60 ? "bg-amber-500" : "bg-red-500"
                    )} style={{ width: `${result.complianceScore}%` }} />
                </div>
            </div>

            {/* Category Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {result.categoryBreakdown.map(cat => (
                    <button
                        key={cat.category}
                        onClick={() => setActiveCategory(activeCategory === cat.category ? 'all' : cat.category)}
                        className={clsx(
                            "p-3 rounded-xl border text-left transition-all",
                            CATEGORY_BG[cat.category],
                            activeCategory === cat.category && "ring-2 ring-offset-1 ring-cyan-500"
                        )}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[cat.category]}`} />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{cat.label}</span>
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white">{cat.count} items</div>
                        <div className="text-[10px] text-slate-500">{cat.mandatoryCount} mandatory • {fmtMoney(cat.annualCost)}/yr</div>
                    </button>
                ))}
            </div>

            {/* Requirements Table */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {activeCategory === 'all' ? 'All Requirements' : result.categoryBreakdown.find(c => c.category === activeCategory)?.label}
                        <span className="ml-2 text-slate-500 font-normal">({filteredItems.length})</span>
                    </h3>
                    {activeCategory !== 'all' && (
                        <button onClick={() => setActiveCategory('all')} className="text-xs text-cyan-600 hover:text-cyan-500">Show All</button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/80">
                                <th className="text-left px-4 py-2 text-slate-500 font-medium">Requirement</th>
                                <th className="text-left px-4 py-2 text-slate-500 font-medium">Authority</th>
                                <th className="text-left px-4 py-2 text-slate-500 font-medium">Standard</th>
                                <th className="text-center px-4 py-2 text-slate-500 font-medium">Freq.</th>
                                <th className="text-center px-4 py-2 text-slate-500 font-medium">Status</th>
                                <th className="text-right px-4 py-2 text-slate-500 font-medium">Initial</th>
                                <th className="text-right px-4 py-2 text-slate-500 font-medium">Annual</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map((item, i) => (
                                <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[item.category]}`} />
                                            <span className="text-slate-800 dark:text-slate-200 font-medium">{item.requirement}</span>
                                        </div>
                                        {item.notes && <p className="text-[10px] text-slate-500 ml-4 mt-0.5">{item.notes}</p>}
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 text-xs">{item.authority}</td>
                                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 text-xs font-mono">{item.standard}</td>
                                    <td className="px-4 py-2.5 text-center">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">{item.frequency}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                        {item.mandatory ? (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold">MANDATORY</span>
                                        ) : (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">Optional</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-slate-800 dark:text-slate-200">{fmtMoney(item.initialCost)}</td>
                                    <td className="px-4 py-2.5 text-right font-mono text-slate-800 dark:text-slate-200">{fmtMoney(item.annualCost)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-slate-300 dark:border-slate-600 font-bold">
                                <td colSpan={5} className="px-4 py-2.5 text-slate-900 dark:text-white">Total</td>
                                <td className="px-4 py-2.5 text-right font-mono text-slate-900 dark:text-white">{fmtMoney(filteredItems.reduce((s, i) => s + i.initialCost, 0))}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-slate-900 dark:text-white">{fmtMoney(filteredItems.reduce((s, i) => s + i.annualCost, 0))}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
