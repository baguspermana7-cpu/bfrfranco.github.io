'use client';

import React, { useMemo } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { calculateTaxIncentives, TaxIncentiveResult } from '@/modules/analytics/TaxIncentiveEngine';
import { COUNTRIES } from '@/constants/countries';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import { Receipt, DollarSign, TrendingUp, Calendar, Award, Gift } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell,
    AreaChart, Area, Line, ComposedChart,
} from 'recharts';
import { fmt, fmtMoney } from '@/lib/format';

const TaxIncentiveDashboard = () => {
    const { selectedCountry, inputs } = useSimulationStore();
    const capexStore = useCapexStore();

    const result = useMemo((): TaxIncentiveResult | null => {
        if (!selectedCountry) return null;
        const itLoad = capexStore.inputs.itLoad || inputs.itLoad;
        const totalCapex = capexStore.results?.total || itLoad * 10000;
        const annualRevenue = itLoad * 150 * 12;
        const annualOpex = itLoad * 50 * 12;

        return calculateTaxIncentives({
            country: selectedCountry,
            totalCapex,
            annualRevenue,
            annualOpex,
            projectLifeYears: 20,
            discountRate: 0.10,
            equipmentCapexShare: 0.65,
        });
    }, [selectedCountry, inputs, capexStore]);

    // Country incentive ranking
    const countryIncentiveData = useMemo(() => {
        return Object.values(COUNTRIES)
            .map(c => {
                const totalCapex = 10000000; // Normalized
                const r = calculateTaxIncentives({
                    country: c,
                    totalCapex,
                    annualRevenue: 3000000,
                    annualOpex: 1200000,
                    projectLifeYears: 20,
                    discountRate: 0.10,
                    equipmentCapexShare: 0.65,
                });
                return { country: c.name, code: c.id, value: r.totalIncentiveValue, holiday: c.taxIncentives?.taxHolidayYears ?? 0 };
            })
            .sort((a, b) => b.value - a.value);
    }, []);

    if (!result || !selectedCountry) {
        return <div className="p-8 text-center text-slate-500">Select a country to view tax incentive analysis.</div>;
    }

    // Tax timeline chart data
    const timelineData = result.effectiveTaxTimeline.map((rate, i) => ({
        year: i + 1,
        effectiveRate: Math.round(rate * 1000) / 10,
        standardRate: Math.round(selectedCountry.economy.taxRate * 1000) / 10,
        savings: result.yearlyTaxSavings[i],
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Receipt className="w-6 h-6 text-emerald-500" />
                    Tax & Incentive Analysis
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {selectedCountry.name} · Standard Rate: {(selectedCountry.economy.taxRate * 100).toFixed(1)}% · Holiday: {selectedCountry.taxIncentives?.taxHolidayYears ?? 0} years
                </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs text-slate-500 uppercase">Total Savings</span>
                            <Tooltip content="Net present value of all tax incentives over the project lifetime." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.totalIncentiveValue)}</div>
                        <div className="text-xs text-emerald-500 mt-1">NPV of incentives</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-slate-500 uppercase">Effective Rate Y1</span>
                            <Tooltip content="Actual tax burden after all incentives, credits, and deductions are applied." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{(result.effectiveTaxTimeline[0] * 100).toFixed(1)}%</div>
                        <div className="text-xs text-slate-500 mt-1">vs {(selectedCountry.economy.taxRate * 100).toFixed(1)}% standard</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-cyan-500" />
                            <span className="text-xs text-slate-500 uppercase">NPV Uplift</span>
                            <Tooltip content="Net Present Value of all tax benefits over the project lifecycle. Key input for site selection." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.npvWithIncentives - result.npvWithoutIncentives)}</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-purple-500" />
                            <span className="text-xs text-slate-500 uppercase">IRR Uplift</span>
                            <Tooltip content="Increase in Internal Rate of Return attributable to tax incentives. Higher uplift makes the jurisdiction more attractive." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">+{(result.irrWithIncentives - result.irrWithoutIncentives).toFixed(1)}%</div>
                        <div className="text-xs text-slate-500 mt-1">{result.irrWithIncentives.toFixed(1)}% vs {result.irrWithoutIncentives.toFixed(1)}%</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Gift className="w-4 h-4 text-amber-500" />
                            <span className="text-xs text-slate-500 uppercase">FTZ Savings</span>
                            <Tooltip content="Exemption or reduction on import duties for data center equipment and construction materials." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.ftzBenefits)}</div>
                        <div className="text-xs text-slate-500 mt-1">import duty saved</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Award className="w-4 h-4 text-yellow-500" />
                            <span className="text-xs text-slate-500 uppercase">Ranking</span>
                            <Tooltip content="Country's position in the incentive value ranking, normalized across all available jurisdictions." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            #{countryIncentiveData.findIndex(c => c.code === selectedCountry.id) + 1}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">of {countryIncentiveData.length} countries</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tax Timeline Chart */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Tax Rate Timeline (Standard vs Effective)</h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <ComposedChart data={timelineData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} label={{ value: 'Year', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} label={{ value: 'Tax Rate %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
                                <RTooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                    labelStyle={{ color: '#e2e8f0' }}
                                    formatter={(v: any, name: any) => {
                                        if (name === 'savings') return [fmtMoney(v), 'Tax Savings'];
                                        return [`${v}%`, name === 'effectiveRate' ? 'Effective Rate' : 'Standard Rate'];
                                    }}
                                />
                                <Area type="stepAfter" dataKey="standardRate" fill="#ef4444" fillOpacity={0.1} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1} />
                                <Area type="stepAfter" dataKey="effectiveRate" fill="#10b981" fillOpacity={0.2} stroke="#10b981" strokeWidth={2} />
                                <Bar dataKey="savings" fill="#06b6d4" opacity={0.3} />
                            </ComposedChart>
                        </ResponsiveContainer>

                        {/* Incentive Programs */}
                        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Available Incentive Programs</h4>
                            <ul className="space-y-1">
                                {result.incentiveSummary.map((item, i) => (
                                    <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                        <span className="text-emerald-500 mt-0.5">•</span> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* FTZ List */}
                        {selectedCountry.taxIncentives?.freeTradeZones && selectedCountry.taxIncentives.freeTradeZones.length > 0 && (
                            <div className="mt-3 p-3 bg-cyan-50 dark:bg-cyan-900/10 rounded-lg border border-cyan-200 dark:border-cyan-800/30">
                                <h4 className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 mb-1">Free Trade Zones</h4>
                                <p className="text-xs text-cyan-600 dark:text-cyan-500">{selectedCountry.taxIncentives.freeTradeZones.join(' · ')}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Country Comparison */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Incentive Value Ranking (NPV, Normalized)</h3>
                        <ResponsiveContainer width="100%" height={420}>
                            <BarChart data={countryIncentiveData.slice(0, 15)} layout="vertical" margin={{ left: 70 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => fmtMoney(v)} />
                                <YAxis dataKey="country" type="category" width={80} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <RTooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                    formatter={(v: any, name: any) => [fmtMoney(v), name === 'value' ? 'Incentive NPV' : 'Holiday Years']}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                    {countryIncentiveData.slice(0, 15).map((entry) => (
                                        <Cell
                                            key={entry.code}
                                            fill={entry.code === selectedCountry.id ? '#10b981' : '#06b6d4'}
                                            opacity={entry.code === selectedCountry.id ? 1 : 0.5}
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

export default TaxIncentiveDashboard;
