'use client';

import React, { useMemo } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { calculateTalentAvailability, TalentAvailabilityResult } from '@/modules/staffing/TalentAvailabilityEngine';
import { calculateStaffing } from '@/modules/staffing/ShiftEngine';
import { useEffectiveInputs } from '@/store/useEffectiveInputs';
import { COUNTRIES } from '@/constants/countries';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import { GraduationCap, Users, DollarSign, Clock, TrendingUp, Award } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell,
} from 'recharts';

const fmt = (n: number, dec = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: dec }).format(n);
const fmtMoney = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;

const difficultyColors: Record<string, string> = {
    'Easy': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    'Moderate': 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    'Difficult': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    'Very Difficult': 'text-red-400 bg-red-500/10 border-red-500/30',
};

const TalentDashboard = () => {
    const { selectedCountry } = useSimulationStore();
    const inputs = useEffectiveInputs();

    const { result, annualStaffCost, totalFTE } = useMemo(() => {
        if (!selectedCountry) return { result: null, annualStaffCost: 0, totalFTE: 0 };

        // Calculate base staffing to get costs
        const roles = ['shift-lead', 'engineer', 'technician', 'admin', 'janitor'] as const;
        const headcounts = [inputs.headcount_ShiftLead, inputs.headcount_Engineer, inputs.headcount_Technician, inputs.headcount_Admin, inputs.headcount_Janitor];
        const is24x7 = [true, true, false, false, false];

        let staffCost = 0;
        let fte = 0;
        for (let i = 0; i < roles.length; i++) {
            const staffResult = calculateStaffing(roles[i], headcounts[i], inputs.shiftModel, selectedCountry, is24x7[i]);
            staffCost += staffResult.monthlyCost * 12;
            fte += staffResult.headcount;
        }

        const talentResult = calculateTalentAvailability({
            country: selectedCountry,
            totalFTE: fte,
            annualStaffCost: staffCost,
        });

        return { result: talentResult, annualStaffCost: staffCost, totalFTE: fte };
    }, [selectedCountry, inputs]);

    const countryComparison = useMemo(() => {
        return Object.values(COUNTRIES)
            .map(c => ({
                country: c.name,
                code: c.id,
                score: c.talentPool?.talentScore ?? 50,
                premium: ((c.talentPool?.salaryPremium ?? 1) - 1) * 100,
            }))
            .sort((a, b) => b.score - a.score);
    }, []);

    if (!result || !selectedCountry) {
        return <div className="p-8 text-center text-slate-500">Select a country to view talent analysis.</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <GraduationCap className="w-6 h-6 text-purple-500" />
                    Talent Availability Index
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {selectedCountry.name} · {totalFTE} FTE Required · {selectedCountry.talentPool?.dcEngineerPool ?? 'moderate'} talent pool
                </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Award className="w-4 h-4 text-purple-500" />
                            <span className="text-xs text-slate-500 uppercase">Talent Score</span>
                            <Tooltip content="Composite talent availability score (0-100) based on engineer pool, university pipeline, hyperscaler competition, hiring speed, and certifications." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{result.talentScore}</div>
                        <div className={`text-xs mt-1 px-2 py-0.5 rounded border w-fit ${difficultyColors[result.hiringDifficulty]}`}>
                            {result.hiringDifficulty}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-4 h-4 text-amber-500" />
                            <span className="text-xs text-slate-500 uppercase">Salary Premium</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">+{((result.adjustedSalaryMultiplier - 1) * 100).toFixed(0)}%</div>
                        <div className="text-xs text-slate-500 mt-1">{fmtMoney(result.adjustedAnnualStaffCost - annualStaffCost)}/yr extra</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-slate-500 uppercase">Time to Staff</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{result.timeToFullStaff}</div>
                        <div className="text-xs text-slate-500 mt-1">months to full team</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Users className="w-4 h-4 text-red-500" />
                            <span className="text-xs text-slate-500 uppercase">Turnover</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{(result.adjustedTurnoverRate * 100).toFixed(0)}%</div>
                        <div className="text-xs text-slate-500 mt-1">{fmtMoney(result.annualTurnoverCost)}/yr cost</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <GraduationCap className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs text-slate-500 uppercase">Training/Yr</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.annualTrainingCost)}</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-orange-500" />
                            <span className="text-xs text-slate-500 uppercase">Recruit Cost</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.totalRecruitmentCost)}</div>
                        <div className="text-xs text-slate-500 mt-1">{fmtMoney(result.recruitmentCostPerHire)}/hire</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Talent Breakdown */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Talent Factor Analysis</h3>
                        <div className="space-y-3">
                            {result.talentBreakdown.map(item => (
                                <div key={item.metric} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                                    <span className="text-sm text-slate-600 dark:text-slate-400">{item.metric}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.value}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                            item.impact === 'Positive' || item.impact === 'Fast' || item.impact === 'Strong' || item.impact === 'Low'
                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                : item.impact === 'Negative' || item.impact === 'Slow' || item.impact === 'Limited' || item.impact === 'High' || item.impact === 'High Competition'
                                                    ? 'bg-red-500/10 text-red-400'
                                                    : 'bg-slate-500/10 text-slate-400'
                                        }`}>{item.impact}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Cost Summary */}
                        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Annual Staff Cost Impact</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">Base Annual Staff Cost</span>
                                    <span className="font-medium text-slate-900 dark:text-white">{fmtMoney(annualStaffCost)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">+ Salary Premium ({((result.adjustedSalaryMultiplier - 1) * 100).toFixed(0)}%)</span>
                                    <span className="font-medium text-amber-500">+{fmtMoney(result.adjustedAnnualStaffCost - annualStaffCost)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">+ Turnover Cost</span>
                                    <span className="font-medium text-red-500">+{fmtMoney(result.annualTurnoverCost)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">+ Training Cost</span>
                                    <span className="font-medium text-purple-500">+{fmtMoney(result.annualTrainingCost)}</span>
                                </div>
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">Talent-Adjusted Total</span>
                                    <span className="font-bold text-lg text-cyan-600 dark:text-cyan-400">
                                        {fmtMoney(result.adjustedAnnualStaffCost + result.annualTurnoverCost + result.annualTrainingCost)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Country Comparison */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Talent Score by Country</h3>
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={countryComparison.slice(0, 15)} layout="vertical" margin={{ left: 70 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                <YAxis dataKey="country" type="category" width={80} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <RTooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                    labelStyle={{ color: '#e2e8f0' }}
                                    formatter={(v: any, name: any) => [name === 'score' ? `${v}/100` : `+${v?.toFixed?.(0) ?? v}%`, name === 'score' ? 'Talent Score' : 'Salary Premium']}
                                />
                                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                                    {countryComparison.slice(0, 15).map((entry) => (
                                        <Cell
                                            key={entry.code}
                                            fill={entry.code === selectedCountry.id ? '#a855f7' : entry.score >= 70 ? '#10b981' : entry.score >= 45 ? '#f59e0b' : '#ef4444'}
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

export default TalentDashboard;
