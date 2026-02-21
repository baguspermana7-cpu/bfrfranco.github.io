'use client';

import React, { useMemo } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { calculateGridReliability, GridReliabilityResult } from '@/modules/infrastructure/GridReliabilityEngine';
import { COUNTRIES } from '@/constants/countries';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import { Zap, Activity, Fuel, Battery, Shield, Sun } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell,
} from 'recharts';

const fmt = (n: number, dec = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: dec }).format(n);
const fmtMoney = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;

const gradeColors: Record<string, string> = {
    A: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    B: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    C: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    D: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    F: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const GridReliabilityDashboard = () => {
    const { selectedCountry, inputs } = useSimulationStore();
    const capexStore = useCapexStore();

    const result = useMemo(() => {
        if (!selectedCountry) return null;
        return calculateGridReliability({
            country: selectedCountry,
            itLoadKw: capexStore.inputs.itLoad || inputs.itLoad,
            tierLevel: inputs.tierLevel,
            coolingType: inputs.coolingType,
        });
    }, [selectedCountry, inputs, capexStore.inputs]);

    const countryComparison = useMemo(() => {
        return Object.values(COUNTRIES)
            .map(c => {
                const r = calculateGridReliability({ country: c, itLoadKw: 1000, tierLevel: 3, coolingType: 'air' });
                return { country: c.name, code: c.id, score: r.reliabilityScore, uptime: c.gridReliability?.gridUptime ?? 99 };
            })
            .sort((a, b) => b.score - a.score);
    }, []);

    if (!result || !selectedCountry) {
        return <div className="p-8 text-center text-slate-500">Select a country to view grid reliability analysis.</div>;
    }

    const grid = selectedCountry.gridReliability;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Zap className="w-6 h-6 text-amber-500" />
                    Grid Reliability Index
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {selectedCountry.name} · Grid Uptime: {grid?.gridUptime ?? 99}% · Tier {inputs.tierLevel}
                </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Activity className="w-4 h-4 text-cyan-500" />
                            <span className="text-xs text-slate-500 uppercase">Grid Score</span>
                            <Tooltip content="Composite reliability score (0-100) based on uptime, voltage stability, brownout frequency, and outage duration." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{result.reliabilityScore}</div>
                        <div className={`text-xs mt-1 px-2 py-0.5 rounded border w-fit ${gradeColors[result.reliabilityGrade]}`}>
                            Grade {result.reliabilityGrade}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-4 h-4 text-red-500" />
                            <span className="text-xs text-slate-500 uppercase">Outage Hrs/Yr</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{(result.annualOutageMinutes / 60).toFixed(1)}</div>
                        <div className="text-xs text-slate-500 mt-1">{result.annualExpectedOutages} events</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Shield className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs text-slate-500 uppercase">Gen Capacity</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(result.requiredGenCapacity)}</div>
                        <div className="text-xs text-slate-500 mt-1">kW required</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Fuel className="w-4 h-4 text-amber-500" />
                            <span className="text-xs text-slate-500 uppercase">Fuel Cost/Yr</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.annualFuelCost)}</div>
                        <div className="text-xs text-slate-500 mt-1">{result.recommendedFuelHours}h fuel reserve</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Battery className="w-4 h-4 text-purple-500" />
                            <span className="text-xs text-slate-500 uppercase">BESS ROI</span>
                            <Tooltip content="Battery Energy Storage System payback period in years." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{result.batteryStorageROI < 50 ? `${result.batteryStorageROI}yr` : 'N/A'}</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Sun className="w-4 h-4 text-yellow-500" />
                            <span className="text-xs text-slate-500 uppercase">Solar Ready</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{result.solarViabilityScore}</div>
                        <div className="text-xs text-slate-500 mt-1">/100 viability</div>
                    </CardContent>
                </Card>
            </div>

            {/* Grid Penalty & Cost Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Annual Grid Risk Cost Breakdown</h3>
                        <div className="space-y-3">
                            {result.costBreakdown.map(item => (
                                <div key={item.label} className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600 dark:text-slate-400">{item.label}</span>
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{fmtMoney(item.value)}</span>
                                </div>
                            ))}
                            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Total Grid-Adjusted OPEX</span>
                                <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{fmtMoney(result.gridRiskAdjustedOpex)}</span>
                            </div>
                        </div>

                        {/* Backup Architecture */}
                        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Backup Architecture</h4>
                            <div className="text-xs font-mono text-slate-600 dark:text-slate-400 space-y-1">
                                <div>Grid Feed {result.dualFeedRecommendation ? '(Dual A+B)' : '(Single)'} → ATS → UPS ({fmt(inputs.itLoad)} kW)</div>
                                <div className="pl-4">├── Generator: {fmt(result.requiredGenCapacity)} kW ({result.recommendedFuelHours}h fuel)</div>
                                <div className="pl-4">├── UPS Battery: {grid?.voltageStability === 'unstable' ? 'Li-Ion recommended' : 'VRLA standard'}</div>
                                <div className="pl-4">└── Availability: {result.availabilityWithBackup.toFixed(3)}% (with backup)</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Country Comparison */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Grid Reliability by Country</h3>
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={countryComparison.slice(0, 15)} layout="vertical" margin={{ left: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                <YAxis dataKey="country" type="category" width={80} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <RTooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                    labelStyle={{ color: '#e2e8f0' }}
                                    formatter={(v: any) => [`${v}/100`, 'Score']}
                                />
                                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                                    {countryComparison.slice(0, 15).map((entry) => (
                                        <Cell
                                            key={entry.code}
                                            fill={entry.code === selectedCountry.id ? '#06b6d4' : entry.score >= 80 ? '#10b981' : entry.score >= 50 ? '#f59e0b' : '#ef4444'}
                                            opacity={entry.code === selectedCountry.id ? 1 : 0.6}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default GridReliabilityDashboard;
