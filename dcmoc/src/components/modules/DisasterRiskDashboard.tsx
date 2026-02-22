'use client';

import React, { useMemo } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { calculateDisasterRisk } from '@/modules/risk/DisasterRiskEngine';
import { COUNTRIES } from '@/constants/countries';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import { CloudLightning, Shield, DollarSign, AlertTriangle, Waves, Mountain, Wind, Flame } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { fmt, fmtMoney } from '@/lib/format';

const riskColors: Record<string, string> = {
    'Low': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    'Moderate': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    'High': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    'Extreme': 'text-red-400 bg-red-500/10 border-red-500/30',
};

const DisasterRiskDashboard = () => {
    const { selectedCountry, inputs } = useSimulationStore();
    const capexStore = useCapexStore();

    const result = useMemo(() => {
        if (!selectedCountry) return null;
        const itLoad = capexStore.inputs.itLoad || inputs.itLoad;
        const totalCapex = capexStore.results?.total || itLoad * 10000;
        const annualRevenue = itLoad * 150 * 12; // $150/kW/month
        return calculateDisasterRisk({
            country: selectedCountry,
            totalCapex,
            itLoadKw: itLoad,
            annualRevenue,
        });
    }, [selectedCountry, inputs, capexStore]);

    const countryRiskData = useMemo(() => {
        return Object.values(COUNTRIES)
            .map(c => ({
                country: c.name,
                code: c.id,
                score: c.naturalDisaster?.compositeScore ?? 20,
            }))
            .sort((a, b) => a.score - b.score); // Lower = better
    }, []);

    if (!result || !selectedCountry) {
        return <div className="p-8 text-center text-slate-500">Select a country to view disaster risk analysis.</div>;
    }

    // Radar data
    const radarData = result.riskBreakdown.map(r => ({
        category: r.type,
        score: r.score,
        fullMark: 100,
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CloudLightning className="w-6 h-6 text-orange-500" />
                    Natural Disaster Risk Scoring
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {selectedCountry.name} · Seismic Zone {selectedCountry.naturalDisaster?.seismicZone ?? 0} · Insurance {selectedCountry.naturalDisaster?.insuranceMultiplier ?? 1.0}x
                </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                            <span className="text-xs text-slate-500 uppercase">Risk Score</span>
                            <Tooltip content="Composite disaster risk score (0-100). Higher = more dangerous. Weighted: seismic 30%, flood 25%, typhoon 20%, volcano 15%, tsunami 10%." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{result.compositeScore}</div>
                        <div className={`text-xs mt-1 px-2 py-0.5 rounded border w-fit ${riskColors[result.riskCategory]}`}>
                            {result.riskCategory}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Shield className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-slate-500 uppercase">Insurance/Yr</span>
                            <Tooltip content="Estimated effect of disaster risk on annual property insurance premiums." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.annualInsuranceCost)}</div>
                        <div className="text-xs text-slate-500 mt-1">{selectedCountry.naturalDisaster?.insuranceMultiplier ?? 1.0}x multiplier</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Flame className="w-4 h-4 text-red-500" />
                            <span className="text-xs text-slate-500 uppercase">Structural Adder</span>
                            <Tooltip content="Capital investment required to reduce disaster risk to acceptable levels (seismic bracing, flood barriers, etc)." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.structuralCostAdder)}</div>
                        <div className="text-xs text-slate-500 mt-1">{((selectedCountry.naturalDisaster?.structuralReinforcement ?? 0) * 100).toFixed(0)}% of CAPEX</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-4 h-4 text-amber-500" />
                            <span className="text-xs text-slate-500 uppercase">Expected Loss/Yr</span>
                            <Tooltip content="Annualized expected monetary loss from natural disaster events, factoring in probability and severity." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.expectedAnnualLoss)}</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Wind className="w-4 h-4 text-cyan-500" />
                            <span className="text-xs text-slate-500 uppercase">Interruption</span>
                            <Tooltip content="Expected business interruption days per year due to natural disaster events affecting facility operations." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{result.businessInterruptionDays}</div>
                        <div className="text-xs text-slate-500 mt-1">expected days/yr</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Waves className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-slate-500 uppercase">Revenue at Risk</span>
                            <Tooltip content="Annual revenue exposed to loss from disaster-related downtime, based on expected interruption days and facility revenue." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.revenueAtRisk)}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risk Radar */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Risk Radar ({selectedCountry.name})</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <RadarChart data={radarData}>
                                <PolarGrid stroke="#334155" />
                                <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748b' }} />
                                <Radar name="Risk" dataKey="score" stroke="#f97316" fill="#f97316" fillOpacity={0.3} />
                            </RadarChart>
                        </ResponsiveContainer>

                        {/* Risk Detail Table */}
                        <div className="mt-4 space-y-2">
                            {result.riskBreakdown.map(r => (
                                <div key={r.type} className="flex items-center justify-between text-sm p-2 rounded bg-slate-50 dark:bg-slate-900/30">
                                    <span className="text-slate-600 dark:text-slate-400">{r.type}</span>
                                    <div className="flex items-center gap-3">
                                        <div className="w-20 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full ${r.score >= 70 ? 'bg-red-500' : r.score >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${r.score}%` }}
                                            />
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                            r.impact === 'Critical' ? 'bg-red-500/10 text-red-400' : r.impact === 'Moderate' ? 'bg-amber-500/10 text-amber-400' : r.impact === 'None' ? 'bg-slate-500/10 text-slate-400' : 'bg-emerald-500/10 text-emerald-400'
                                        }`}>{r.impact}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Country Risk Comparison + Mitigation */}
                <div className="space-y-6">
                    {/* Mitigation Options */}
                    {result.mitigationOptions.length > 0 && (
                        <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                            <CardContent className="pt-6">
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Mitigation Options</h3>
                                <div className="space-y-3">
                                    {result.mitigationOptions.map(opt => (
                                        <div key={opt.name} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-semibold text-slate-900 dark:text-white">{opt.name}</span>
                                                <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400">ROI: {opt.roi}x</span>
                                            </div>
                                            <p className="text-xs text-slate-500 mb-2">{opt.description}</p>
                                            <div className="flex gap-4 text-xs">
                                                <span className="text-slate-600 dark:text-slate-400">Cost: <span className="font-medium text-slate-900 dark:text-white">{fmtMoney(opt.cost)}</span></span>
                                                <span className="text-slate-600 dark:text-slate-400">Risk Reduction: <span className="font-medium text-emerald-500">-{opt.riskReduction}%</span></span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Country Comparison */}
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                        <CardContent className="pt-6">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Risk Score by Country (Lower = Safer)</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={countryRiskData.slice(0, 15)} layout="vertical" margin={{ left: 70 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                    <YAxis dataKey="country" type="category" width={80} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <RTooltip
                                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                        formatter={(v: any) => [`${v}/100`, 'Risk Score']}
                                    />
                                    <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                                        {countryRiskData.slice(0, 15).map((entry) => (
                                            <Cell
                                                key={entry.code}
                                                fill={entry.code === selectedCountry.id ? '#f97316' : entry.score <= 20 ? '#10b981' : entry.score <= 50 ? '#f59e0b' : '#ef4444'}
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
        </div>
    );
};

export default DisasterRiskDashboard;
