'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { calculateFuelGen, FuelGenResult, EditableParam, TestingRegime } from '@/modules/infrastructure/FuelGenEngine';
import {
    Fuel, Pencil, Check, X, Gauge, Droplets, Calendar, DollarSign,
    BarChart3, Globe, AlertTriangle, Flame, Clock, Truck
} from 'lucide-react';
import clsx from 'clsx';

type TabId = 'overview' | 'consumption' | 'testing' | 'comparison' | 'environmental';

export default function FuelGenDashboard() {
    const { selectedCountry, inputs } = useSimulationStore();
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [overrides, setOverrides] = useState<Record<string, number>>({});
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [testingRegime, setTestingRegime] = useState<TestingRegime>('minimal');

    const result = useMemo<FuelGenResult | null>(() => {
        if (!selectedCountry) return null;
        return calculateFuelGen({
            country: selectedCountry,
            itLoadKw: inputs.itLoad,
            tierLevel: inputs.tierLevel,
            coolingType: inputs.coolingType,
            testingRegime,
            overrides: Object.keys(overrides).length > 0 ? overrides as any : undefined,
        });
    }, [selectedCountry, inputs.itLoad, inputs.tierLevel, inputs.coolingType, testingRegime, overrides]);

    if (!result) return <div className="text-slate-500 text-center py-20">Select a country to begin.</div>;

    const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${(n / 1_000).toFixed(0)}K` : n.toLocaleString('en-US');
    const fmtUsd = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `$${(n / 1_000).toFixed(0)}K` : '$' + n.toLocaleString('en-US');
    const fmtK = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;
    const fmtL = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${(n / 1_000).toFixed(0)}K` : n.toLocaleString('en-US');

    const startEdit = (param: EditableParam) => {
        setEditingKey(param.key);
        setEditValue(String(param.value));
    };

    const confirmEdit = (param: EditableParam) => {
        const num = parseFloat(editValue);
        if (!isNaN(num) && num >= param.min && num <= param.max) {
            setOverrides(prev => ({ ...prev, [param.key]: num }));
        }
        setEditingKey(null);
    };

    const resetParam = (key: string) => {
        setOverrides(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const tabs: { id: TabId; label: string }[] = [
        { id: 'overview', label: 'Overview' },
        { id: 'consumption', label: 'Consumption' },
        { id: 'testing', label: 'Testing Schedule' },
        { id: 'comparison', label: 'Country Compare' },
        { id: 'environmental', label: 'Environmental' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-xl">
                            <Fuel className="w-6 h-6 text-amber-500" />
                        </div>
                        Fuel & Generator Modeling
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Module 44 — Diesel generator sizing, fuel consumption & cost modeling</p>
                </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Editable Parameters */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <Pencil className="w-4 h-4 text-amber-500" />
                            Editable Parameters
                        </h3>
                        <div className="space-y-3">
                            {result.editableParams.map(param => {
                                const isEditing = editingKey === param.key;
                                const isOverridden = overrides[param.key] !== undefined;
                                return (
                                    <div key={param.key} className={clsx(
                                        "p-3 rounded-lg border transition-colors",
                                        isOverridden ? "border-amber-400/50 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-600/30" : "border-slate-200 dark:border-slate-700"
                                    )}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{param.label}</span>
                                            <div className="flex items-center gap-1">
                                                {isOverridden && !isEditing && (
                                                    <button onClick={() => resetParam(param.key)} className="p-0.5 text-amber-500 hover:text-amber-600" title="Reset to default">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                                {!isEditing && (
                                                    <button onClick={() => startEdit(param)} className="p-0.5 text-slate-400 hover:text-amber-500">
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={editValue}
                                                    onChange={e => setEditValue(e.target.value)}
                                                    min={param.min}
                                                    max={param.max}
                                                    step={param.step}
                                                    className="flex-1 px-2 py-1 text-sm bg-white dark:bg-slate-900 border border-amber-400 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                    autoFocus
                                                    onKeyDown={e => e.key === 'Enter' && confirmEdit(param)}
                                                />
                                                <span className="text-[10px] text-slate-500">{param.unit}</span>
                                                <button onClick={() => confirmEdit(param)} className="p-1 text-emerald-500 hover:text-emerald-600">
                                                    <Check className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => setEditingKey(null)} className="p-1 text-slate-400 hover:text-slate-500">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-lg font-bold text-slate-900 dark:text-white">{param.value}</span>
                                                <span className="text-xs text-slate-500">{param.unit}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Testing Regime Selector */}
                    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-cyan-500" />
                            Testing Regime
                        </h3>
                        <select
                            value={testingRegime}
                            onChange={e => setTestingRegime(e.target.value as TestingRegime)}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="minimal">Minimal (Monthly No-Load + Annual Full Load)</option>
                            <option value="complete">Complete (Weekly + Monthly + Quarterly + Annual)</option>
                        </select>
                        <p className="text-[10px] text-slate-500 mt-2">
                            {testingRegime === 'minimal'
                                ? 'Monthly no-load run + annual full loadbank test only'
                                : 'Full testing: weekly no-load, monthly loadbank, quarterly full load, annual overhaul'}
                        </p>
                    </div>

                    {/* Generator Spec Card */}
                    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <Gauge className="w-4 h-4 text-cyan-500" />
                            Generator Specification
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500">Units</span><span className="font-semibold text-slate-900 dark:text-white">{result.generator.count}x {(result.generator.capacityKw / 1000).toFixed(1)}MW</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Redundancy</span><span className="font-semibold text-slate-900 dark:text-white">{result.generator.redundancyModel}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Total Capacity</span><span className="font-semibold text-slate-900 dark:text-white">{(result.generator.totalCapacityKw / 1000).toFixed(1)} MW</span></div>
                        </div>
                    </div>

                    {/* Fuel Storage Card */}
                    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <Droplets className="w-4 h-4 text-blue-500" />
                            Fuel Storage
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500">Total Storage</span><span className="font-semibold text-slate-900 dark:text-white">{fmt(result.storage.totalLiters)} L</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Tank Count</span><span className="font-semibold text-slate-900 dark:text-white">{result.storage.tankCount}x 20,000L</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Autonomy</span><span className="font-semibold text-slate-900 dark:text-white">{result.storage.daysOfAutonomy} days</span></div>
                        </div>
                    </div>
                </div>

                {/* Right: Main Content */}
                <div className="lg:col-span-8 space-y-4">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                        {[
                            { label: 'Annual Fuel', value: fmtK(result.cost.annualFuelCostUsd), sub: `$${result.cost.dieselPriceWithTax}/L`, icon: DollarSign, color: 'amber' },
                            { label: 'Total Gen OPEX/yr', value: fmtK(result.cost.totalAnnualGenOpex), sub: `${fmtK(result.cost.annualMaintenanceUsd)} maint`, icon: BarChart3, color: 'cyan' },
                            { label: 'Consumption/yr', value: `${fmtL(result.consumption.totalLitersPerYear)} L`, sub: `${fmtL(result.consumption.totalLitersPerMonth)} L/mo`, icon: Droplets, color: 'blue' },
                            { label: 'CO₂ Emissions', value: `${result.co2EmissionsTonsPerYear} t/yr`, sub: `${fmtL(result.co2EmissionsKgPerYear)} kg`, icon: Flame, color: 'red' },
                            { label: 'Monthly Fuel', value: fmtK(result.cost.monthlyFuelCostUsd), sub: 'Per month', icon: Calendar, color: 'green' },
                            { label: 'Env. Compliance', value: fmtK(result.cost.annualEnvironmentalComplianceUsd), sub: 'Permits/yr', icon: AlertTriangle, color: 'purple' },
                        ].map((kpi, i) => (
                            <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3 sm:p-4">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <kpi.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-${kpi.color}-500 shrink-0`} />
                                    <span className="text-[10px] sm:text-xs text-slate-500 truncate">{kpi.label}</span>
                                </div>
                                <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">{kpi.value}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5 truncate">{kpi.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    "flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors",
                                    activeTab === tab.id ? "bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                )}
                            >{tab.label}</button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                        {activeTab === 'overview' && (
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-900 dark:text-white">Cost Breakdown Summary</h4>
                                <div className="space-y-2">
                                    {[
                                        { label: 'Annual Fuel', value: result.cost.annualFuelCostUsd, pct: result.cost.annualFuelCostUsd / result.cost.totalAnnualGenOpex * 100, color: 'bg-amber-500' },
                                        { label: 'Maintenance', value: result.cost.annualMaintenanceUsd, pct: result.cost.annualMaintenanceUsd / result.cost.totalAnnualGenOpex * 100, color: 'bg-cyan-500' },
                                        { label: 'Environmental', value: result.cost.annualEnvironmentalComplianceUsd, pct: result.cost.annualEnvironmentalComplianceUsd / result.cost.totalAnnualGenOpex * 100, color: 'bg-purple-500' },
                                    ].map((item, i) => (
                                        <div key={i}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-slate-600 dark:text-slate-400">{item.label}</span>
                                                <span className="font-medium text-slate-900 dark:text-white">{fmtUsd(item.value)} ({item.pct.toFixed(1)}%)</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                    <span className="font-semibold text-slate-900 dark:text-white">Total Annual Generator OPEX</span>
                                    <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{fmtK(result.cost.totalAnnualGenOpex)}</span>
                                </div>
                            </div>
                        )}

                        {activeTab === 'consumption' && (
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-900 dark:text-white">Fuel Consumption Breakdown</h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm min-w-[360px]">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                                <th className="text-left py-2 text-slate-500 font-medium">Category</th>
                                                <th className="text-right py-2 text-slate-500 font-medium">L/Year</th>
                                                <th className="text-right py-2 text-slate-500 font-medium">USD/Year</th>
                                                <th className="text-right py-2 text-slate-500 font-medium">%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                { label: 'Testing', liters: result.consumption.annualTestLiters },
                                                { label: 'Grid Outages', liters: result.consumption.annualOutageLiters },
                                                { label: 'Fuel Polishing', liters: result.consumption.annualPolishingLiters },
                                            ].map((row, i) => (
                                                <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                                                    <td className="py-2 text-slate-700 dark:text-slate-300">{row.label}</td>
                                                    <td className="py-2 text-right font-mono text-slate-900 dark:text-white">{fmtL(row.liters)}</td>
                                                    <td className="py-2 text-right font-mono text-slate-900 dark:text-white">{fmtUsd(Math.round(row.liters * result.cost.dieselPriceWithTax))}</td>
                                                    <td className="py-2 text-right font-mono text-slate-500">{result.consumption.totalLitersPerYear > 0 ? (row.liters / result.consumption.totalLitersPerYear * 100).toFixed(1) : '0.0'}%</td>
                                                </tr>
                                            ))}
                                            <tr className="font-bold">
                                                <td className="py-2 text-slate-900 dark:text-white">Total</td>
                                                <td className="py-2 text-right font-mono text-amber-600 dark:text-amber-400">{fmtL(result.consumption.totalLitersPerYear)}</td>
                                                <td className="py-2 text-right font-mono text-amber-600 dark:text-amber-400">{fmtUsd(result.cost.annualFuelCostUsd)}</td>
                                                <td className="py-2 text-right font-mono text-slate-500">100%</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{fmtL(result.consumption.totalLitersPerMonth)} L</div>
                                        <div className="text-[10px] text-slate-500 mt-1">Per Month</div>
                                    </div>
                                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">{fmtK(result.cost.monthlyFuelCostUsd)}</div>
                                        <div className="text-[10px] text-slate-500 mt-1">Per Month</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'testing' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <h4 className="font-semibold text-slate-900 dark:text-white">Generator Testing Schedule</h4>
                                    <span className={clsx(
                                        "text-xs font-medium px-2 py-1 rounded-full",
                                        testingRegime === 'minimal' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400"
                                    )}>
                                        {testingRegime === 'minimal' ? 'Minimal Regime' : 'Complete Regime'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        { ...result.testing.weeklyNoLoad, label: 'Weekly No-Load Run', icon: Clock, desc: `${result.testing.weeklyNoLoad.durationMin} min per unit` },
                                        { ...result.testing.monthlyLoadBank, label: testingRegime === 'minimal' ? 'Monthly No-Load Run' : 'Monthly Load Bank', icon: Gauge, desc: testingRegime === 'minimal' ? '30 min no-load per unit' : `${result.testing.monthlyLoadBank.durationHours}hr at 50% load` },
                                        { ...result.testing.quarterlyFullLoad, label: 'Quarterly Full Load', icon: Fuel, desc: `2hr at 75% load` },
                                        { ...result.testing.annualOverhaul, label: 'Annual Full Loadbank Test', icon: Truck, desc: `${result.testing.annualOverhaul.durationHours}hr full load bank` },
                                    ].filter(test => test.frequency !== 'N/A').map((test, i) => (
                                        <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center gap-2 mb-2">
                                                <test.icon className="w-4 h-4 text-amber-500" />
                                                <span className="text-sm font-medium text-slate-900 dark:text-white">{test.label}</span>
                                            </div>
                                            <div className="text-xs text-slate-500">{test.frequency} — {test.desc}</div>
                                            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">{fmtL(test.fuelLiters)} L / event</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'comparison' && (
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-900 dark:text-white">Country Diesel Price Comparison</h4>
                                <p className="text-xs text-slate-500">Same volume ({fmtL(result.consumption.totalLitersPerYear)} L/yr) at each country&apos;s diesel price incl. tax</p>
                                <div className="space-y-1.5 max-h-96 overflow-y-auto">
                                    {result.countryComparison.map((c, i) => {
                                        const maxCost = result.countryComparison[result.countryComparison.length - 1]?.annualCost || 1;
                                        const pct = (c.annualCost / maxCost) * 100;
                                        const isCurrent = c.countryId === selectedCountry?.id;
                                        return (
                                            <div key={c.countryId} className={clsx(
                                                "flex items-center gap-2 px-2 py-1.5 rounded",
                                                isCurrent && "bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-400/30"
                                            )}>
                                                <span className="w-6 text-[10px] font-mono text-slate-500 text-right">{i + 1}</span>
                                                <span className="w-8 text-xs font-bold text-slate-700 dark:text-slate-300">{c.countryId}</span>
                                                <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div className={clsx("h-full rounded-full", isCurrent ? "bg-amber-500" : "bg-cyan-500/60")} style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="w-16 text-right text-xs font-mono text-slate-600 dark:text-slate-400">${c.dieselPrice}/L</span>
                                                <span className="w-20 text-right text-xs font-mono font-semibold text-slate-900 dark:text-white">{fmtK(c.annualCost)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {activeTab === 'environmental' && (
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-900 dark:text-white">Environmental Compliance</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                                        <div className="text-xs text-red-600 dark:text-red-400 font-medium">CO₂ Emissions</div>
                                        <div className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">{result.co2EmissionsTonsPerYear} t/yr</div>
                                        <div className="text-[10px] text-red-500 mt-1">2.68 kgCO₂ per liter diesel</div>
                                    </div>
                                    <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                                        <div className="text-xs text-green-600 dark:text-green-400 font-medium">Compliance Cost</div>
                                        <div className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">{fmtK(result.cost.annualEnvironmentalComplianceUsd)}</div>
                                        <div className="text-[10px] text-green-500 mt-1">Annual permits & reporting</div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300">Compliance Checklist</h5>
                                    {[
                                        { item: 'Emission testing (annual)', required: true },
                                        { item: 'Fuel storage containment', required: true },
                                        { item: 'Spill prevention plan', required: true },
                                        { item: 'Noise level monitoring', required: selectedCountry?.fuelDiesel?.environmentalPermitRequired ?? true },
                                        { item: 'HVO/renewable fuel option', required: false, available: selectedCountry?.fuelDiesel?.hvoAvailable },
                                        { item: 'Carbon offset reporting', required: false },
                                    ].map((check, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm">
                                            <div className={clsx(
                                                "w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]",
                                                check.required ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"
                                            )}>
                                                {check.required ? '!' : '?'}
                                            </div>
                                            <span className="text-slate-700 dark:text-slate-300">{check.item}</span>
                                            {check.required && <span className="text-[10px] text-amber-600 font-medium">REQUIRED</span>}
                                            {check.available && <span className="text-[10px] text-green-600 font-medium">AVAILABLE</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
