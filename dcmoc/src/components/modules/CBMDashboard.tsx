'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { calculateCBM, CBMResult, SensorCategory, DCIMTier } from '@/modules/analytics/CBMEngine';
import { Activity, DollarSign, TrendingUp, Shield, Zap, BarChart3, ToggleLeft, ToggleRight, Clock } from 'lucide-react';
import clsx from 'clsx';

const SENSOR_COLORS: Record<SensorCategory, string> = {
    'temperature': 'bg-red-500',
    'humidity': 'bg-blue-500',
    'power-quality': 'bg-amber-500',
    'vibration': 'bg-orange-500',
    'fluid-leak': 'bg-cyan-500',
    'airflow': 'bg-green-500',
    'door-access': 'bg-purple-500',
};

export default function CBMDashboard() {
    const { selectedCountry, inputs } = useSimulationStore();
    const [enabledCategories, setEnabledCategories] = useState<SensorCategory[]>(
        ['temperature', 'humidity', 'power-quality', 'vibration', 'fluid-leak', 'airflow', 'door-access']
    );
    const [dcimTier, setDcimTier] = useState<DCIMTier>('standard');

    const result = useMemo<CBMResult | null>(() => {
        if (!selectedCountry) return null;
        return calculateCBM({
            country: selectedCountry,
            itLoadKw: inputs.itLoad,
            tierLevel: inputs.tierLevel,
            coolingType: inputs.coolingType,
            enabledCategories,
            dcimTier,
        });
    }, [selectedCountry, inputs.itLoad, inputs.tierLevel, inputs.coolingType, enabledCategories, dcimTier]);

    if (!result) return <div className="text-slate-500 text-center py-20">Select a country to begin.</div>;

    const fmt = (n: number) => n.toLocaleString('en-US');
    const fmtK = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;

    const toggleCategory = (cat: SensorCategory) => {
        setEnabledCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-xl">
                        <Activity className="w-6 h-6 text-purple-500" />
                    </div>
                    Condition-Based Monitoring ROI
                </h2>
                <p className="text-sm text-slate-500 mt-1">Module 43 — BMS/DCIM sensor investment vs failure avoidance savings</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                    { label: 'Sensor Investment', value: fmtK(result.totalSensorInvestment), sub: `${result.totalSensorCount} sensors`, icon: DollarSign, color: 'cyan' },
                    { label: 'ROI', value: `${result.roiPercent}%`, sub: `Payback: ${result.paybackYears} yrs`, icon: TrendingUp, color: result.roiPercent > 100 ? 'emerald' : result.roiPercent > 50 ? 'amber' : 'red' },
                    { label: 'Annual Benefit', value: fmtK(result.totalAnnualBenefit), sub: 'Downtime + Energy savings', icon: Shield, color: 'green' },
                    { label: 'Downtime Averted', value: fmtK(result.annualAvertedDowntimeCost), sub: 'Annual failure avoidance', icon: Zap, color: 'amber' },
                    { label: 'Energy Savings', value: fmtK(result.annualEnergySavings), sub: 'Annual energy optimization', icon: BarChart3, color: 'blue' },
                    { label: '5-Year NPV', value: fmtK(result.npv5Year), sub: `${result.sensorDensityPerRack} sensors/rack`, icon: Clock, color: result.npv5Year > 0 ? 'emerald' : 'red' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <kpi.icon className={`w-4 h-4 text-${kpi.color}-500`} />
                            <span className="text-xs text-slate-500">{kpi.label}</span>
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">{kpi.value}</div>
                        <div className="text-[10px] text-slate-500 mt-1">{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* Sensor Category Toggles */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Sensor Categories</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/80">
                                <th className="text-left px-3 py-2 text-slate-500 font-medium">Category</th>
                                <th className="text-center px-3 py-2 text-slate-500 font-medium">Enable</th>
                                <th className="text-center px-3 py-2 text-slate-500 font-medium">Count</th>
                                <th className="text-right px-3 py-2 text-slate-500 font-medium">Unit $</th>
                                <th className="text-right px-3 py-2 text-slate-500 font-medium">Total $</th>
                                <th className="text-center px-3 py-2 text-slate-500 font-medium">Detection</th>
                                <th className="text-center px-3 py-2 text-slate-500 font-medium">Energy %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.sensors.map(sensor => (
                                <tr key={sensor.category} className={clsx(
                                    "border-t border-slate-100 dark:border-slate-800 transition-opacity",
                                    !sensor.enabled && "opacity-40"
                                )}>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2.5 h-2.5 rounded-full ${SENSOR_COLORS[sensor.category]}`} />
                                            <span className="text-slate-800 dark:text-slate-200 font-medium">{sensor.label}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 ml-4">{sensor.countFormula}</p>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <button onClick={() => toggleCategory(sensor.category)} className="text-slate-500 hover:text-cyan-500">
                                            {sensor.enabled ? <ToggleRight className="w-5 h-5 text-cyan-500" /> : <ToggleLeft className="w-5 h-5" />}
                                        </button>
                                    </td>
                                    <td className="px-3 py-2 text-center font-mono text-slate-700 dark:text-slate-300">{sensor.count}</td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">${sensor.unitCost}</td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">{fmtK(sensor.totalCost)}</td>
                                    <td className="px-3 py-2 text-center">
                                        <span className={clsx(
                                            "text-xs px-1.5 py-0.5 rounded font-medium",
                                            sensor.failureDetectionRate >= 0.4 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                            sensor.failureDetectionRate >= 0.2 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                            "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                                        )}>{(sensor.failureDetectionRate * 100).toFixed(0)}%</span>
                                    </td>
                                    <td className="px-3 py-2 text-center font-mono text-slate-700 dark:text-slate-300">
                                        {sensor.energySavingsPercent > 0 ? `${(sensor.energySavingsPercent * 100).toFixed(0)}%` : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-slate-300 dark:border-slate-600 font-bold">
                                <td className="px-3 py-2 text-slate-900 dark:text-white">Total (Enabled)</td>
                                <td></td>
                                <td className="px-3 py-2 text-center text-slate-900 dark:text-white">{result.totalSensorCount}</td>
                                <td></td>
                                <td className="px-3 py-2 text-right text-slate-900 dark:text-white">{fmtK(result.totalSensorInvestment)}</td>
                                <td></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Cost vs Benefit */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Investment vs Annual Benefit</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <h4 className="text-xs text-slate-500 mb-2">Investment (One-Time)</h4>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400">Sensor Hardware</span>
                                <span className="font-mono font-medium text-slate-900 dark:text-white">{fmtK(result.totalSensorInvestment)}</span>
                            </div>
                            <div className="flex justify-between text-sm border-t border-slate-200 dark:border-slate-700 pt-2">
                                <span className="font-semibold text-slate-900 dark:text-white">Total Investment</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">{fmtK(result.totalSensorInvestment)}</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-xs text-slate-500 mb-2">Annual Benefits</h4>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400">Downtime Averted</span>
                                <span className="font-mono font-medium text-green-600 dark:text-green-400">+{fmtK(result.annualAvertedDowntimeCost)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400">Energy Savings</span>
                                <span className="font-mono font-medium text-green-600 dark:text-green-400">+{fmtK(result.annualEnergySavings)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400">Platform License</span>
                                <span className="font-mono font-medium text-red-600 dark:text-red-400">-{fmtK(result.platformLicenseCostAnnual)}</span>
                            </div>
                            <div className="flex justify-between text-sm border-t border-slate-200 dark:border-slate-700 pt-2">
                                <span className="font-semibold text-slate-900 dark:text-white">Net Annual Benefit</span>
                                <span className="font-mono font-bold text-green-600 dark:text-green-400">+{fmtK(result.totalAnnualBenefit - result.platformLicenseCostAnnual)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* DCIM Platform Tier Comparison */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">DCIM Platform Tier</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {result.dcimPlatforms.map(platform => (
                        <button
                            key={platform.tier}
                            onClick={() => setDcimTier(platform.tier)}
                            className={clsx(
                                "p-4 rounded-xl border text-left transition-all",
                                dcimTier === platform.tier
                                    ? "border-cyan-400 dark:border-cyan-600 ring-2 ring-cyan-400/20 bg-cyan-50/50 dark:bg-cyan-900/10"
                                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                            )}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">{platform.label}</span>
                                {dcimTier === platform.tier && <div className="w-2 h-2 rounded-full bg-cyan-500" />}
                            </div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white mb-2">{fmtK(platform.annualLicenseCost)}<span className="text-xs text-slate-500 font-normal">/yr</span></div>
                            <div className="space-y-1">
                                {platform.features.map((f, i) => (
                                    <div key={i} className="text-[10px] text-slate-500 flex items-center gap-1">
                                        <div className="w-1 h-1 rounded-full bg-slate-400" />
                                        {f}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                <span className="text-[10px] text-slate-500">Sensor Integration: {(platform.sensorIntegration * 100).toFixed(0)}%</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
