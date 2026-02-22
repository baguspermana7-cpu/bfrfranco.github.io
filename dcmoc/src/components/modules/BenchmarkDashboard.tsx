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
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Target, Trophy, AlertTriangle, TrendingUp, Info, ChevronRight } from 'lucide-react';
import { Tooltip as InfoTooltip } from '@/components/ui/Tooltip';
import clsx from 'clsx';

type BenchmarkTab = 'scorecard' | 'detailed' | 'strengths' | 'comparison';

// ─── TOOLTIP CONTENT MAP ────────────────────────────────────
const TOOLTIP_TEXTS = {
    // Main dashboard
    industryBenchmarks: 'Compare your data center configuration against industry-standard benchmarks from Uptime Institute, ASHRAE, and Green Grid surveys for same-tier facilities.',
    configBadge: 'Active configuration parameters used for benchmark scoring. Tier level, country, and IT load directly affect which peer group your facility is compared against.',

    // Overall score & grade
    overallGrade: 'Composite grade (A\u2013F) based on weighted scoring across all benchmark categories. A = top 10%, F = bottom 20%.',
    overallScore: 'Weighted aggregate of all category scores (0\u2013100), reflecting overall operational maturity relative to industry peers.',

    // Category labels
    energyEfficiency: 'Power Usage Effectiveness benchmark. Scores facility energy efficiency against Tier-matched peers using PUE, WUE, and energy cost per kW.',
    staffing: 'Staff-to-MW ratio compared to industry norms. Accounts for shift model, labor cost as % of OPEX, and annual turnover rate.',
    financial: 'OPEX per kW and CAPEX per kW benchmarked against regional and tier-appropriate comparables. Includes IRR and payback period.',
    availability: 'Uptime achievement vs SLA targets. Based on annual uptime percentage and mean time to repair (MTTR) for the selected tier.',
    carbonEsg: 'Carbon intensity, renewable energy percentage, and Scope 2 emissions per MW benchmarked against industry leaders and GHG Protocol standards.',

    // Scorecard summary sections
    topStrengths: 'The top 3 metrics where your facility outperforms industry peers. Based on lowest percentile rank (closest to best-in-class).',
    improvementAreas: 'The 3 metrics with the most room for improvement. Each includes an actionable recommendation based on industry best practices.',

    // Detailed metrics
    categoryScore: 'Performance score (0\u2013100) for a specific operational domain relative to industry averages.',
    percentileRank: "Facility's position relative to industry peers. Lower percentile = better performance. 10th percentile means top 10%.",
    metricGrade: 'Letter grade (A\u2013F) derived from percentile rank. A = top 25%, B = 25\u201350%, C = 50\u201375%, D = 75\u201390%, F = bottom 10%.',
    bulletChart: 'Visual benchmark range. Blue zone = interquartile range (P25\u2013P75). Cyan marker = your value. Vertical line = industry median.',
    improvementGap: 'Difference between current performance and best-in-class benchmark. Represents optimization opportunity.',

    // Individual metric tooltips
    metrics: {
        pue: 'Power Usage Effectiveness \u2014 ratio of total facility power to IT equipment power. Lower is better. Industry median ~1.35 (Uptime Institute 2024).',
        wue: 'Water Usage Effectiveness \u2014 liters of water consumed per kWh of IT energy. Estimated from cooling type. Lower is better.',
        energy_cost_per_kw: 'Annual electricity cost per kW of IT load, estimated at ~60% of total OPEX. Varies significantly by region.',
        staff_per_mw: 'Full-time equivalent staff per MW of IT load. Tier 4 facilities typically require 5\u201318 FTE/MW; Tier 2 requires 2.5\u201310.',
        labor_cost_pct_opex: 'Labor costs as a percentage of total operating expenditure. High ratios may indicate overstaffing or under-automation.',
        turnover_rate: 'Annual staff turnover percentage. High turnover increases training costs and operational risk. Industry median ~15%.',
        capex_per_kw: 'Total capital expenditure per kW of IT capacity. Tier level is the strongest driver. Includes M&E, structure, and site costs.',
        opex_per_kw: 'Annual operating expenditure per kW of IT load. Encompasses energy, staffing, maintenance, and compliance costs.',
        irr: 'Internal Rate of Return \u2014 expected annualized return on investment. Higher is better. Industry median ~13% for new builds.',
        payback_years: 'Years to recover initial capital investment through net cash flows. Lower is better. Affected by occupancy ramp and pricing.',
        uptime_pct: 'Annual uptime as a percentage. Derived from tier level SLA targets. Tier 3 targets 99.982%, Tier 4 targets 99.995%.',
        mttr_hours: 'Mean Time to Repair \u2014 average hours to restore service after an incident. Lower is better. Driven by spares, staffing, and procedures.',
        cue: 'Carbon Usage Effectiveness \u2014 kgCO2 emitted per kWh of IT energy. Derived from grid carbon intensity. Lower is better.',
        renewable_pct: 'Percentage of energy sourced from renewables (PPAs, on-site, RECs). Higher is better. Industry leaders target 100%.',
        scope2_per_mw: 'Annual Scope 2 greenhouse gas emissions (tCO2) per MW of IT load. Driven by grid carbon intensity and PUE.',
    } as Record<string, string>,

    // Comparison table headers
    compMetric: 'Benchmark metric name and unit of measurement.',
    compYourValue: 'Your facility\'s calculated value for this metric based on current configuration inputs.',
    compPercentiles: 'Industry distribution from top performers (P10) to bottom performers (P90). Based on Uptime Institute and Green Grid surveys.',
    compRank: "Percentile rank indicating where your facility falls in the industry distribution. Lower percentile = better performance.",
    compGrade: 'Letter grade (A\u2013F) derived from percentile position. A = top quartile, F = bottom decile.',
    compSource: 'Data source for the benchmark values (e.g., Uptime Institute, ASHRAE, Green Grid, IEA).',

    // Strengths & Gaps tab
    strengthsHeading: 'Metrics where your configuration excels relative to industry peers. Sorted by percentile rank (best first).',
    gapsHeading: 'Metrics with the largest gap between your performance and industry best-in-class. Each includes an actionable recommendation.',
} as const;

// Map benchmark category IDs to tooltip keys
const CATEGORY_TOOLTIP_MAP: Record<BenchmarkCategory, string> = {
    energy: TOOLTIP_TEXTS.energyEfficiency,
    staffing: TOOLTIP_TEXTS.staffing,
    financial: TOOLTIP_TEXTS.financial,
    availability: TOOLTIP_TEXTS.availability,
    carbon: TOOLTIP_TEXTS.carbonEsg,
};

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
                        <InfoTooltip content={TOOLTIP_TEXTS.industryBenchmarks} />
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Compare your configuration against industry standards
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                    <Info className="w-3.5 h-3.5" />
                    Tier {inputs.tierLevel} | {selectedCountry.name} | {inputs.itLoad.toLocaleString()} kW
                    <InfoTooltip content={TOOLTIP_TEXTS.configBadge} />
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
                            <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-0.5">{result.overallScore}/100 <InfoTooltip content={TOOLTIP_TEXTS.overallScore} /></span>
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 flex items-center justify-center gap-1">
                        Overall Benchmark Score
                        <InfoTooltip content={TOOLTIP_TEXTS.overallGrade} />
                    </p>
                </div>
            </div>

            {/* Category Cards */}
            <div className="grid grid-cols-5 gap-4">
                {(Object.entries(BENCHMARK_CATEGORIES) as [BenchmarkCategory, typeof BENCHMARK_CATEGORIES[BenchmarkCategory]][]).map(([catId, cat]) => {
                    const catScore = result.categoryScores[catId];
                    const gc = GRADE_COLORS[catScore.grade];
                    return (
                        <div key={catId} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-center gap-0.5">{cat.label} <InfoTooltip content={CATEGORY_TOOLTIP_MAP[catId]} /></div>
                            <div className={clsx('text-2xl font-bold flex items-center justify-center gap-1', gc.text, gc.darkText)}>{catScore.grade} <InfoTooltip content={TOOLTIP_TEXTS.metricGrade} /></div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center justify-center gap-0.5">{catScore.score}/100 <InfoTooltip content={TOOLTIP_TEXTS.categoryScore} /></div>
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
                        <InfoTooltip content={TOOLTIP_TEXTS.topStrengths} />
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
                        <InfoTooltip content={TOOLTIP_TEXTS.improvementAreas} />
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
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1">{BENCHMARK_CATEGORIES[catId].label} <InfoTooltip content={CATEGORY_TOOLTIP_MAP[catId]} /></h3>
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
                <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{metric.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">({metric.unit})</span>
                    <InfoTooltip content={TOOLTIP_TEXTS.metrics[metric.id] || metric.description} />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-300">
                        {formatMetricValue(userValue, metric.unit)}
                    </span>
                    <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded', gc.bg, gc.text, gc.darkBg, gc.darkText)}>
                        {grade}
                    </span>
                    <InfoTooltip content={TOOLTIP_TEXTS.percentileRank} />
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
                <span className="flex items-center gap-0.5">P10: {formatMetricValue(b.p10, metric.unit)}</span>
                <span className="flex items-center gap-0.5">Median: {formatMetricValue(b.median, metric.unit)} <InfoTooltip content={TOOLTIP_TEXTS.bulletChart} /></span>
                <span className="flex items-center gap-0.5">P90: {formatMetricValue(b.p90, metric.unit)}</span>
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
                    <InfoTooltip content={TOOLTIP_TEXTS.strengthsHeading} />
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
                    <InfoTooltip content={TOOLTIP_TEXTS.gapsHeading} />
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
                            <th className="text-left px-4 py-3 font-semibold text-slate-900 dark:text-white"><span className="flex items-center gap-1">Metric <InfoTooltip content={TOOLTIP_TEXTS.compMetric} /></span></th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-900 dark:text-white"><span className="flex items-center justify-center gap-1">Your Value <InfoTooltip content={TOOLTIP_TEXTS.compYourValue} /></span></th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400"><span className="flex items-center justify-center gap-0.5">P10 <InfoTooltip content={TOOLTIP_TEXTS.compPercentiles} /></span></th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400">P25</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400">Median</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400">P75</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400">P90</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-900 dark:text-white"><span className="flex items-center justify-center gap-1">Rank <InfoTooltip content={TOOLTIP_TEXTS.compRank} /></span></th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-900 dark:text-white"><span className="flex items-center justify-center gap-1">Grade <InfoTooltip content={TOOLTIP_TEXTS.compGrade} /></span></th>
                            <th className="text-left px-3 py-3 font-semibold text-slate-500 dark:text-slate-400"><span className="flex items-center gap-1">Source <InfoTooltip content={TOOLTIP_TEXTS.compSource} /></span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {metrics.map((m, i) => {
                            const gc = GRADE_COLORS[m.grade];
                            const b = m.tierBenchmarks;
                            return (
                                <tr key={m.metric.id} className={clsx('border-b border-slate-100 dark:border-slate-800', i % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-slate-50/50 dark:bg-slate-800/20')}>
                                    <td className="px-4 py-2.5">
                                        <div className="font-medium text-slate-900 dark:text-white text-xs flex items-center gap-0.5">{m.metric.name} <InfoTooltip content={TOOLTIP_TEXTS.metrics[m.metric.id] || m.metric.description} /></div>
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
