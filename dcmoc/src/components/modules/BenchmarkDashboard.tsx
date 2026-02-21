'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useEffectiveInputs } from '@/store/useEffectiveInputs';
import { calculateBenchmark, MetricScore } from '@/modules/analytics/BenchmarkEngine';
import { calculateFinancials, defaultOccupancyRamp } from '@/modules/analytics/FinancialEngine';
import { calculateCapex } from '@/lib/CapexEngine';
import { calculateStaffing } from '@/modules/staffing/ShiftEngine';
import { calculateCarbonFootprint } from '@/modules/analytics/CarbonEngine';
import { BENCHMARK_CATEGORIES, BenchmarkCategory, GRADE_COLORS, Grade, getBenchmarkForTier } from '@/data/benchmarks';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Target, Trophy, AlertTriangle, TrendingUp, Info, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

type BenchmarkTab = 'scorecard' | 'detailed' | 'strengths' | 'comparison';

export default function BenchmarkDashboard() {
    const { selectedCountry, inputs } = useSimulationStore();
    const capexStore = useCapexStore();
    const effectiveInputs = useEffectiveInputs();
    const [activeTab, setActiveTab] = useState<BenchmarkTab>('scorecard');

    const result = useMemo(() => {
        if (!selectedCountry) return null;

        const capexResult = calculateCapex(capexStore.inputs);
        const totalStaff = effectiveInputs.headcount_ShiftLead + effectiveInputs.headcount_Engineer +
            effectiveInputs.headcount_Technician + effectiveInputs.headcount_Admin + effectiveInputs.headcount_Janitor;

        // Calculate staffing costs for OPEX estimate
        const roles: Array<{ role: 'shift-lead' | 'engineer' | 'technician' | 'admin' | 'janitor'; count: number; is24x7: boolean }> = [
            { role: 'shift-lead', count: effectiveInputs.headcount_ShiftLead, is24x7: true },
            { role: 'engineer', count: effectiveInputs.headcount_Engineer, is24x7: true },
            { role: 'technician', count: effectiveInputs.headcount_Technician, is24x7: false },
            { role: 'admin', count: effectiveInputs.headcount_Admin, is24x7: false },
            { role: 'janitor', count: effectiveInputs.headcount_Janitor, is24x7: false },
        ];
        const annualStaffCost = roles.reduce((sum, r) => {
            const res = calculateStaffing(r.role, r.count, inputs.shiftModel, selectedCountry, r.is24x7);
            return sum + res.monthlyCost * 12;
        }, 0);

        const pue = capexResult.pue;
        const annualEnergy = inputs.itLoad * pue * 8760 / 1000; // MWh
        const annualEnergyCost = annualEnergy * (selectedCountry.economy.electricityRate * 1000);
        const annualOpex = annualStaffCost + annualEnergyCost + (selectedCountry.compliance.annualComplianceCost || 50000);

        const financialInputs = {
            totalCapex: capexResult.total,
            annualOpex,
            revenuePerKwMonth: 120,
            itLoadKw: inputs.itLoad,
            discountRate: 0.10,
            projectLifeYears: 10,
            escalationRate: 0.03,
            opexEscalation: selectedCountry.economy.inflationRate,
            occupancyRamp: inputs.occupancyRamp.length > 0 ? inputs.occupancyRamp : defaultOccupancyRamp(10),
            taxRate: selectedCountry.economy.taxRate,
            depreciationYears: 7,
        };
        const financialResult = calculateFinancials(financialInputs);

        const carbonResult = calculateCarbonFootprint({
            itLoadKw: inputs.itLoad,
            pue,
            gridCarbonIntensity: selectedCountry.environment.gridCarbonIntensity,
            coolingType: inputs.coolingType,
            renewableOption: 'none',
            fuelHours: 50,
            genType: 'diesel',
            countryName: selectedCountry.name,
        });

        return calculateBenchmark({
            itLoadKw: inputs.itLoad,
            coolingType: inputs.coolingType,
            tierLevel: inputs.tierLevel,
            totalStaff,
            turnoverRate: inputs.turnoverRate || 0.15,
            totalCapex: capexResult.total,
            annualOpex,
            irr: financialResult.irr,
            paybackYears: financialResult.paybackPeriodYears,
            pue,
            annualCO2: carbonResult.annualEmissionsTonCO2,
            gridCarbonIntensity: selectedCountry.environment.gridCarbonIntensity,
            renewablePct: 0,
        });
    }, [selectedCountry, inputs, capexStore.inputs, effectiveInputs]);

    if (!result || !selectedCountry) {
        return (
            <div className="text-center py-20 text-slate-500 dark:text-slate-400">
                <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a country to generate benchmark analysis.</p>
            </div>
        );
    }

    const tabs: { id: BenchmarkTab; label: string }[] = [
        { id: 'scorecard', label: 'Scorecard' },
        { id: 'detailed', label: 'Detailed Metrics' },
        { id: 'strengths', label: 'Strengths & Gaps' },
        { id: 'comparison', label: 'Industry Comparison' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                            <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        Industry Benchmarks
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Compare your configuration against industry standards
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                    <Info className="w-3.5 h-3.5" />
                    Tier {inputs.tierLevel} | {selectedCountry.name} | {inputs.itLoad.toLocaleString()} kW
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all',
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'scorecard' && <ScorecardTab result={result} />}
            {activeTab === 'detailed' && <DetailedTab metrics={result.metrics} tier={inputs.tierLevel} />}
            {activeTab === 'strengths' && <StrengthsTab result={result} />}
            {activeTab === 'comparison' && <ComparisonTab metrics={result.metrics} />}
        </div>
    );
}

// ─── SCORECARD TAB ──────────────────────────────────────────

function ScorecardTab({ result }: { result: ReturnType<typeof calculateBenchmark> }) {
    const gradeColor = GRADE_COLORS[result.overallGrade];

    return (
        <div className="space-y-6">
            {/* Overall Score Ring */}
            <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center">
                <div className="inline-flex flex-col items-center">
                    <div className="relative w-40 h-40">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-200 dark:text-slate-700" />
                            <circle
                                cx="60" cy="60" r="52" fill="none" strokeWidth="8"
                                strokeDasharray={`${(result.overallScore / 100) * 327} 327`}
                                strokeLinecap="round"
                                className={result.overallGrade === 'A' ? 'text-emerald-500' : result.overallGrade === 'B' ? 'text-blue-500' : result.overallGrade === 'C' ? 'text-yellow-500' : result.overallGrade === 'D' ? 'text-orange-500' : 'text-red-500'}
                                stroke="currentColor"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={clsx('text-4xl font-bold', gradeColor.text, gradeColor.darkText)}>{result.overallGrade}</span>
                            <span className="text-sm text-slate-500 dark:text-slate-400">{result.overallScore}/100</span>
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Overall Benchmark Score</p>
                </div>
            </div>

            {/* Category Cards */}
            <div className="grid grid-cols-5 gap-4">
                {(Object.entries(BENCHMARK_CATEGORIES) as [BenchmarkCategory, typeof BENCHMARK_CATEGORIES[BenchmarkCategory]][]).map(([catId, cat]) => {
                    const catScore = result.categoryScores[catId];
                    const gc = GRADE_COLORS[catScore.grade];
                    return (
                        <div key={catId} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{cat.label}</div>
                            <div className={clsx('text-2xl font-bold', gc.text, gc.darkText)}>{catScore.grade}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{catScore.score}/100</div>
                            <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={clsx('h-full rounded-full transition-all', catScore.grade === 'A' ? 'bg-emerald-500' : catScore.grade === 'B' ? 'bg-blue-500' : catScore.grade === 'C' ? 'bg-yellow-500' : catScore.grade === 'D' ? 'bg-orange-500' : 'bg-red-500')}
                                    style={{ width: `${catScore.score}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Quick Summary */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Trophy className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">Top Strengths</span>
                    </div>
                    <div className="space-y-2">
                        {result.strengths.map((s, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                                <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded', GRADE_COLORS[s.grade].bg, GRADE_COLORS[s.grade].text, GRADE_COLORS[s.grade].darkBg, GRADE_COLORS[s.grade].darkText)}>{s.grade}</span>
                                <span className="text-slate-700 dark:text-slate-300">{s.metric}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">Improvement Areas</span>
                    </div>
                    <div className="space-y-2">
                        {result.improvements.map((s, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                                <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded', GRADE_COLORS[s.grade].bg, GRADE_COLORS[s.grade].text, GRADE_COLORS[s.grade].darkBg, GRADE_COLORS[s.grade].darkText)}>{s.grade}</span>
                                <span className="text-slate-700 dark:text-slate-300">{s.metric}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── DETAILED METRICS TAB ───────────────────────────────────

function DetailedTab({ metrics, tier }: { metrics: MetricScore[]; tier: 2 | 3 | 4 }) {
    const grouped = useMemo(() => {
        const groups: Record<BenchmarkCategory, MetricScore[]> = { energy: [], staffing: [], financial: [], availability: [], carbon: [] };
        for (const m of metrics) groups[m.metric.category].push(m);
        return groups;
    }, [metrics]);

    return (
        <div className="space-y-6">
            {(Object.entries(grouped) as [BenchmarkCategory, MetricScore[]][]).map(([catId, catMetrics]) => (
                <div key={catId} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{BENCHMARK_CATEGORIES[catId].label}</h3>
                    </div>
                    <div className="p-5 space-y-5">
                        {catMetrics.map(m => (
                            <BulletChart key={m.metric.id} score={m} tier={tier} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function BulletChart({ score, tier }: { score: MetricScore; tier: 2 | 3 | 4 }) {
    const b = score.tierBenchmarks;
    const { metric, userValue, percentile, grade } = score;
    const gc = GRADE_COLORS[grade];

    // Determine chart range
    const allValues = [b.p10, b.p25, b.median, b.p75, b.p90, userValue];
    const minVal = Math.min(...allValues) * 0.8;
    const maxVal = Math.max(...allValues) * 1.2;
    const range = maxVal - minVal;
    const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - minVal) / range) * 100))}%`;

    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <div>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{metric.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">({metric.unit})</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-300">
                        {formatMetricValue(userValue, metric.unit)}
                    </span>
                    <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded', gc.bg, gc.text, gc.darkBg, gc.darkText)}>
                        {grade}
                    </span>
                </div>
            </div>
            {/* Bullet bar */}
            <div className="relative h-6 bg-slate-100 dark:bg-slate-700/50 rounded overflow-hidden">
                {/* Benchmark zones */}
                <div className="absolute inset-y-0 bg-emerald-200 dark:bg-emerald-900/40 rounded-l" style={{ left: pct(Math.min(b.p10, b.p90)), width: pct(Math.abs(b.p25 - Math.min(b.p10, b.p90)) + minVal) }} />
                <div className="absolute inset-y-0 bg-blue-200 dark:bg-blue-900/30" style={{ left: pct(Math.min(b.p25, b.p75)), width: `calc(${pct(Math.max(b.p25, b.p75))} - ${pct(Math.min(b.p25, b.p75))})` }} />
                {/* Median marker */}
                <div className="absolute inset-y-0 w-0.5 bg-slate-400 dark:bg-slate-500" style={{ left: pct(b.median) }} />
                {/* User value marker */}
                <div
                    className="absolute top-0.5 bottom-0.5 w-2.5 rounded-sm bg-cyan-600 dark:bg-cyan-400 shadow-sm"
                    style={{ left: `calc(${pct(userValue)} - 5px)` }}
                />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                <span>P10: {formatMetricValue(b.p10, metric.unit)}</span>
                <span>Median: {formatMetricValue(b.median, metric.unit)}</span>
                <span>P90: {formatMetricValue(b.p90, metric.unit)}</span>
            </div>
        </div>
    );
}

// ─── STRENGTHS & GAPS TAB ───────────────────────────────────

function StrengthsTab({ result }: { result: ReturnType<typeof calculateBenchmark> }) {
    return (
        <div className="grid grid-cols-2 gap-6">
            {/* Strengths */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-emerald-500" />
                    Top 3 Strengths
                </h3>
                {result.strengths.map((s, i) => {
                    const gc = GRADE_COLORS[s.grade];
                    return (
                        <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={clsx('text-xs font-bold px-2 py-0.5 rounded', gc.bg, gc.text, gc.darkBg, gc.darkText)}>{s.grade}</span>
                                <span className="text-sm font-semibold text-slate-900 dark:text-white">{s.metric}</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{s.detail}</p>
                        </div>
                    );
                })}
            </div>

            {/* Improvements */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                    Top 3 Improvement Areas
                </h3>
                {result.improvements.map((s, i) => {
                    const gc = GRADE_COLORS[s.grade];
                    return (
                        <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={clsx('text-xs font-bold px-2 py-0.5 rounded', gc.bg, gc.text, gc.darkBg, gc.darkText)}>{s.grade}</span>
                                <span className="text-sm font-semibold text-slate-900 dark:text-white">{s.metric}</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{s.detail}</p>
                            <div className="flex items-start gap-1.5 text-xs text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-2">
                                <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                <span>{s.recommendation}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── INDUSTRY COMPARISON TABLE ──────────────────────────────

function ComparisonTab({ metrics }: { metrics: MetricScore[] }) {
    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                            <th className="text-left px-4 py-3 font-semibold text-slate-900 dark:text-white">Metric</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-900 dark:text-white">Your Value</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400">P10</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400">P25</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400">Median</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400">P75</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400">P90</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-900 dark:text-white">Rank</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-900 dark:text-white">Grade</th>
                            <th className="text-left px-3 py-3 font-semibold text-slate-500 dark:text-slate-400">Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        {metrics.map((m, i) => {
                            const gc = GRADE_COLORS[m.grade];
                            const b = m.tierBenchmarks;
                            return (
                                <tr key={m.metric.id} className={clsx('border-b border-slate-100 dark:border-slate-800', i % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-slate-50/50 dark:bg-slate-800/20')}>
                                    <td className="px-4 py-2.5">
                                        <div className="font-medium text-slate-900 dark:text-white text-xs">{m.metric.name}</div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{m.metric.unit}</div>
                                    </td>
                                    <td className="text-center px-3 py-2.5 font-mono font-semibold text-cyan-700 dark:text-cyan-400 text-xs">{formatMetricValue(m.userValue, m.metric.unit)}</td>
                                    <td className="text-center px-3 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{formatMetricValue(b.p10, m.metric.unit)}</td>
                                    <td className="text-center px-3 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{formatMetricValue(b.p25, m.metric.unit)}</td>
                                    <td className="text-center px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-300 font-medium">{formatMetricValue(b.median, m.metric.unit)}</td>
                                    <td className="text-center px-3 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{formatMetricValue(b.p75, m.metric.unit)}</td>
                                    <td className="text-center px-3 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{formatMetricValue(b.p90, m.metric.unit)}</td>
                                    <td className="text-center px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300">P{Math.round(m.percentile)}</td>
                                    <td className="text-center px-3 py-2.5">
                                        <span className={clsx('text-xs font-bold px-2 py-0.5 rounded', gc.bg, gc.text, gc.darkBg, gc.darkText)}>{m.grade}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-[10px] text-slate-400 dark:text-slate-500 max-w-[140px] truncate">{m.metric.source}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function formatMetricValue(value: number, unit: string): string {
    if (unit === '%') return `${value.toFixed(1)}%`;
    if (unit === 'PUE') return value.toFixed(2);
    if (unit === '$/kW' || unit === '$/kW/yr') return `$${Math.round(value).toLocaleString()}`;
    if (unit === 'years') return `${value.toFixed(1)}`;
    if (unit === 'hours') return `${value.toFixed(1)}`;
    if (unit === 'FTE/MW') return value.toFixed(1);
    if (unit === 'L/kWh' || unit === 'kgCO2/kWh') return value.toFixed(2);
    if (unit === 'tCO2/MW/yr') return Math.round(value).toLocaleString();
    return value.toFixed(2);
}
