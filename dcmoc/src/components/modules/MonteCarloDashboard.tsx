'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useEffectiveInputs } from '@/store/useEffectiveInputs';
import { calculateFinancials, defaultOccupancyRamp, FinancialInputs } from '@/modules/analytics/FinancialEngine';
import { calculateCapex } from '@/lib/CapexEngine';
import { calculateStaffing } from '@/modules/staffing/ShiftEngine';
import {
    runMonteCarlo,
    MonteCarloResult,
    DEFAULT_STOCHASTIC_VARIABLES,
    StochasticVariable,
    HistogramBin,
} from '@/modules/analytics/MonteCarloEngine';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    LineChart, Line, ScatterChart, Scatter, Cell, ReferenceLine, CartesianGrid,
} from 'recharts';
import { Dices, Play, AlertTriangle, TrendingDown, Activity, Zap, BarChart3 } from 'lucide-react';
import clsx from 'clsx';

type MCTab = 'distributions' | 'statistics' | 'risk' | 'convergence' | 'scatter';

export default function MonteCarloDashboard() {
    const { selectedCountry, inputs } = useSimulationStore();
    const capexStore = useCapexStore();
    const effectiveInputs = useEffectiveInputs();

    const [iterations, setIterations] = useState(10000);
    const [seed, setSeed] = useState(42);
    const [variables, setVariables] = useState<StochasticVariable[]>(DEFAULT_STOCHASTIC_VARIABLES);
    const [result, setResult] = useState<MonteCarloResult | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [activeTab, setActiveTab] = useState<MCTab>('distributions');

    const baseFinancialInputs = useMemo<FinancialInputs | null>(() => {
        if (!selectedCountry) return null;

        const capexResult = calculateCapex(capexStore.inputs);
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
        const annualEnergy = inputs.itLoad * pue * 8760 / 1000;
        const annualEnergyCost = annualEnergy * (selectedCountry.economy.electricityRate * 1000);
        const annualOpex = annualStaffCost + annualEnergyCost + (selectedCountry.compliance.annualComplianceCost || 50000);

        return {
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
    }, [selectedCountry, inputs, capexStore.inputs, effectiveInputs]);

    const handleRun = useCallback(() => {
        if (!baseFinancialInputs) return;
        setIsRunning(true);
        // Use requestAnimationFrame to let UI update with spinner
        requestAnimationFrame(() => {
            const res = runMonteCarlo(baseFinancialInputs, variables, iterations, seed);
            setResult(res);
            setIsRunning(false);
        });
    }, [baseFinancialInputs, variables, iterations, seed]);

    const toggleVariable = (id: string) => {
        setVariables(prev => prev.map(v => v.id === id ? { ...v, enabled: !v.enabled } : v));
    };

    if (!selectedCountry) {
        return (
            <div className="text-center py-20 text-slate-500 dark:text-slate-400">
                <Dices className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a country to run Monte Carlo simulation.</p>
            </div>
        );
    }

    const fmtM = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n.toFixed(0)}`;
    const tabs: { id: MCTab; label: string }[] = [
        { id: 'distributions', label: 'Distributions' },
        { id: 'statistics', label: 'Statistics' },
        { id: 'risk', label: 'Risk Metrics' },
        { id: 'convergence', label: 'Convergence' },
        { id: 'scatter', label: 'Scatter' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                            <Dices className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                        </div>
                        Monte Carlo Simulation
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Probabilistic risk analysis with {iterations.toLocaleString()} iterations
                    </p>
                </div>
            </div>

            {/* Brief Introduction */}
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30 rounded-xl p-5">
                <h3 className="text-sm font-bold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    What is Monte Carlo Simulation?
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                    Monte Carlo simulation is a quantitative risk analysis technique that runs thousands of scenarios
                    by randomly varying key financial inputs (revenue, OPEX, occupancy, electricity cost, etc.)
                    within their realistic ranges. Instead of a single deterministic forecast, it produces a
                    <span className="font-semibold text-orange-700 dark:text-orange-300"> probability distribution </span>
                    of outcomes — showing you not just the expected return, but the full range of possibilities.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-400"><span className="font-semibold text-slate-800 dark:text-slate-200">NPV Distribution</span> — Probability of achieving positive net present value across all scenarios</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-400"><span className="font-semibold text-slate-800 dark:text-slate-200">IRR Risk</span> — Likelihood that internal rate of return falls below your hurdle rate (e.g., 10%)</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <span className="text-slate-600 dark:text-slate-400"><span className="font-semibold text-slate-800 dark:text-slate-200">VaR (Value at Risk)</span> — Worst-case financial exposure at 5th percentile confidence level</span>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-[300px_1fr] gap-6">
                {/* Left: Controls */}
                <div className="space-y-4">
                    {/* Iteration Count */}
                    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-2">Iterations</label>
                        <select
                            value={iterations}
                            onChange={e => setIterations(Number(e.target.value))}
                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                        >
                            <option value={1000}>1,000 (Fast)</option>
                            <option value={5000}>5,000</option>
                            <option value={10000}>10,000 (Default)</option>
                            <option value={25000}>25,000</option>
                            <option value={50000}>50,000 (Detailed)</option>
                        </select>

                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase block mt-3 mb-2">Seed</label>
                        <input
                            type="number"
                            value={seed}
                            onChange={e => setSeed(Number(e.target.value))}
                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                        />

                        <button
                            onClick={handleRun}
                            disabled={isRunning}
                            className="w-full mt-4 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-400 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                        >
                            {isRunning ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Running...
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" />
                                    Run Simulation
                                </>
                            )}
                        </button>
                        {result && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 text-center">
                                Completed in {result.durationMs.toFixed(0)}ms
                            </p>
                        )}
                    </div>

                    {/* Variable Toggles */}
                    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-3">Stochastic Variables</label>
                        <div className="space-y-2">
                            {variables.map(v => (
                                <button
                                    key={v.id}
                                    onClick={() => toggleVariable(v.id)}
                                    className={clsx(
                                        'w-full text-left px-3 py-2 rounded-lg text-xs transition-colors border',
                                        v.enabled
                                            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-300'
                                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">{v.name}</span>
                                        <span className="text-[10px]">{v.distribution} {v.unit}</span>
                                    </div>
                                    <div className="text-[10px] mt-0.5 opacity-70">{v.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Results */}
                <div className="space-y-4">
                    {!result ? (
                        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-16 text-center text-slate-500 dark:text-slate-400">
                            <Dices className="w-16 h-16 mx-auto mb-4 opacity-30" />
                            <p className="text-lg font-medium">Configure and run the simulation</p>
                            <p className="text-sm mt-1">Adjust variables and click "Run Simulation" to generate results</p>
                        </div>
                    ) : (
                        <>
                            {/* Tab Navigation */}
                            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={clsx(
                                            'flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all',
                                            activeTab === tab.id
                                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {activeTab === 'distributions' && <DistributionsTab result={result} />}
                            {activeTab === 'statistics' && <StatisticsTab result={result} />}
                            {activeTab === 'risk' && <RiskTab result={result} />}
                            {activeTab === 'convergence' && <ConvergenceTab result={result} />}
                            {activeTab === 'scatter' && <ScatterTab result={result} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── DISTRIBUTIONS TAB ──────────────────────────────────────

function DistributionsTab({ result }: { result: MonteCarloResult }) {
    const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

    return (
        <div className="space-y-4">
            <HistogramChart
                title="NPV Distribution"
                data={result.npvHistogram}
                stats={result.npvStats}
                color="#06b6d4"
                formatValue={fmtM}
                varLine={result.varNpv5}
                zeroLine
            />
            <HistogramChart
                title="IRR Distribution (%)"
                data={result.irrHistogram}
                stats={result.irrStats}
                color="#8b5cf6"
                formatValue={(n) => `${n.toFixed(1)}%`}
            />
            <HistogramChart
                title="Payback Period Distribution (years)"
                data={result.paybackHistogram}
                stats={result.paybackStats}
                color="#f59e0b"
                formatValue={(n) => `${n.toFixed(1)} yr`}
            />
        </div>
    );
}

function HistogramChart({ title, data, stats, color, formatValue, varLine, zeroLine }: {
    title: string;
    data: HistogramBin[];
    stats: { mean: number; median: number; p5: number; p95: number };
    color: string;
    formatValue: (n: number) => string;
    varLine?: number;
    zeroLine?: boolean;
}) {
    const chartData = data.map(b => ({
        name: formatValue((b.binStart + b.binEnd) / 2),
        x: (b.binStart + b.binEnd) / 2,
        count: b.count,
        freq: b.frequency,
    }));

    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h4>
                <div className="flex gap-3 text-[10px] text-slate-500 dark:text-slate-400">
                    <span>Mean: <span className="font-mono text-slate-700 dark:text-slate-300">{formatValue(stats.mean)}</span></span>
                    <span>Median: <span className="font-mono text-slate-700 dark:text-slate-300">{formatValue(stats.median)}</span></span>
                    <span>P5-P95: <span className="font-mono text-slate-700 dark:text-slate-300">{formatValue(stats.p5)} — {formatValue(stats.p95)}</span></span>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 11 }}
                        labelStyle={{ color: '#e2e8f0' }}
                        formatter={(value: any) => [value, 'Count']}
                    />
                    <Bar dataKey="count" fill={color} radius={[2, 2, 0, 0]} opacity={0.8} />
                    {zeroLine && <ReferenceLine x={formatValue(0)} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── STATISTICS TAB ─────────────────────────────────────────

function StatisticsTab({ result }: { result: MonteCarloResult }) {
    const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;
    const rows = [
        { label: 'Mean', npv: fmtM(result.npvStats.mean), irr: `${result.irrStats.mean.toFixed(2)}%`, payback: `${result.paybackStats.mean.toFixed(2)} yr` },
        { label: 'Median', npv: fmtM(result.npvStats.median), irr: `${result.irrStats.median.toFixed(2)}%`, payback: `${result.paybackStats.median.toFixed(2)} yr` },
        { label: 'Std Dev', npv: fmtM(result.npvStats.stdDev), irr: `${result.irrStats.stdDev.toFixed(2)}%`, payback: `${result.paybackStats.stdDev.toFixed(2)} yr` },
        { label: 'Min', npv: fmtM(result.npvStats.min), irr: `${result.irrStats.min.toFixed(2)}%`, payback: `${result.paybackStats.min.toFixed(2)} yr` },
        { label: 'P5', npv: fmtM(result.npvStats.p5), irr: `${result.irrStats.p5.toFixed(2)}%`, payback: `${result.paybackStats.p5.toFixed(2)} yr` },
        { label: 'P10', npv: fmtM(result.npvStats.p10), irr: `${result.irrStats.p10.toFixed(2)}%`, payback: `${result.paybackStats.p10.toFixed(2)} yr` },
        { label: 'P25', npv: fmtM(result.npvStats.p25), irr: `${result.irrStats.p25.toFixed(2)}%`, payback: `${result.paybackStats.p25.toFixed(2)} yr` },
        { label: 'P75', npv: fmtM(result.npvStats.p75), irr: `${result.irrStats.p75.toFixed(2)}%`, payback: `${result.paybackStats.p75.toFixed(2)} yr` },
        { label: 'P90', npv: fmtM(result.npvStats.p90), irr: `${result.irrStats.p90.toFixed(2)}%`, payback: `${result.paybackStats.p90.toFixed(2)} yr` },
        { label: 'P95', npv: fmtM(result.npvStats.p95), irr: `${result.irrStats.p95.toFixed(2)}%`, payback: `${result.paybackStats.p95.toFixed(2)} yr` },
        { label: 'Max', npv: fmtM(result.npvStats.max), irr: `${result.irrStats.max.toFixed(2)}%`, payback: `${result.paybackStats.max.toFixed(2)} yr` },
    ];

    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                        <th className="text-left px-4 py-3 font-semibold text-slate-900 dark:text-white">Percentile</th>
                        <th className="text-center px-4 py-3 font-semibold text-cyan-600 dark:text-cyan-400">NPV</th>
                        <th className="text-center px-4 py-3 font-semibold text-purple-600 dark:text-purple-400">IRR</th>
                        <th className="text-center px-4 py-3 font-semibold text-amber-600 dark:text-amber-400">Payback</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={r.label} className={clsx('border-b border-slate-100 dark:border-slate-800', i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-800/20')}>
                            <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-300">{r.label}</td>
                            <td className="text-center px-4 py-2 font-mono text-slate-900 dark:text-white">{r.npv}</td>
                            <td className="text-center px-4 py-2 font-mono text-slate-900 dark:text-white">{r.irr}</td>
                            <td className="text-center px-4 py-2 font-mono text-slate-900 dark:text-white">{r.payback}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── RISK METRICS TAB ───────────────────────────────────────

function RiskTab({ result }: { result: MonteCarloResult }) {
    const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

    return (
        <div className="space-y-4">
            {/* VaR Cards */}
            <div className="grid grid-cols-3 gap-4">
                <RiskCard
                    icon={<TrendingDown className="w-5 h-5 text-red-500" />}
                    label="VaR (5%)"
                    value={fmtM(result.varNpv5)}
                    description="5th percentile NPV — worst case in 95% of scenarios"
                    severity={result.varNpv5 < 0 ? 'high' : 'low'}
                />
                <RiskCard
                    icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
                    label="P(NPV < 0)"
                    value={`${(result.probNpvNegative * 100).toFixed(1)}%`}
                    description="Probability of a negative net present value"
                    severity={result.probNpvNegative > 0.2 ? 'high' : result.probNpvNegative > 0.05 ? 'medium' : 'low'}
                />
                <RiskCard
                    icon={<Activity className="w-5 h-5 text-purple-500" />}
                    label="P(IRR < 10%)"
                    value={`${(result.probIrrBelow10 * 100).toFixed(1)}%`}
                    description="Probability IRR falls below hurdle rate"
                    severity={result.probIrrBelow10 > 0.3 ? 'high' : result.probIrrBelow10 > 0.1 ? 'medium' : 'low'}
                />
            </div>

            {/* Tornado Chart — Variable Sensitivity */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Sensitivity Analysis (Correlation with NPV)
                </h4>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                        data={result.sensitivity.map(s => ({
                            name: s.variable,
                            correlation: Math.round(s.correlation * 1000) / 1000,
                            fill: s.correlation >= 0 ? '#10b981' : '#ef4444',
                        }))}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                    >
                        <XAxis type="number" domain={[-1, 1]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={90} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 11 }}
                            formatter={(value: any) => [value.toFixed(3), 'Correlation']}
                        />
                        <ReferenceLine x={0} stroke="#475569" />
                        <Bar dataKey="correlation" radius={[0, 4, 4, 0]}>
                            {result.sensitivity.map((s, i) => (
                                <Cell key={i} fill={s.correlation >= 0 ? '#10b981' : '#ef4444'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function RiskCard({ icon, label, value, description, severity }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
}) {
    const borderColor = severity === 'high' ? 'border-red-300 dark:border-red-800' : severity === 'medium' ? 'border-amber-300 dark:border-amber-800' : 'border-emerald-300 dark:border-emerald-800';
    return (
        <div className={clsx('bg-white dark:bg-slate-800/50 rounded-xl border-2 p-4', borderColor)}>
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{label}</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{description}</p>
        </div>
    );
}

// ─── CONVERGENCE TAB ────────────────────────────────────────

function ConvergenceTab({ result }: { result: MonteCarloResult }) {
    const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;

    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Mean NPV Convergence Over Iterations
            </h4>
            <ResponsiveContainer width="100%" height={350}>
                <LineChart data={result.convergenceHistory} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis
                        dataKey="iteration"
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickFormatter={(v) => fmtM(v)}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 11 }}
                        formatter={(value: any) => [fmtM(value), 'Mean NPV']}
                        labelFormatter={(label) => `Iteration ${label.toLocaleString()}`}
                    />
                    <Line type="monotone" dataKey="meanNpv" stroke="#06b6d4" strokeWidth={2} dot={false} />
                    <ReferenceLine y={result.npvStats.mean} stroke="#10b981" strokeDasharray="4 4" label={{ value: `Final: ${fmtM(result.npvStats.mean)}`, fill: '#10b981', fontSize: 10 }} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── SCATTER TAB ────────────────────────────────────────────

function ScatterTab({ result }: { result: MonteCarloResult }) {
    // Sample max 2000 points for performance
    const sampleSize = Math.min(2000, result.iterations);
    const step = Math.max(1, Math.floor(result.iterations / sampleSize));

    const scatterData = useMemo(() => {
        const data: { npv: number; irr: number; payback: number }[] = [];
        for (let i = 0; i < result.npvStats.values.length; i += step) {
            data.push({
                npv: result.npvStats.values[i] / 1_000_000,
                irr: result.irrStats.values[i],
                payback: result.paybackStats.values[i],
            });
        }
        return data;
    }, [result, step]);

    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">NPV vs IRR Scatter</h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3">
                Each point is one simulation run. Color indicates payback period.
            </p>
            <ResponsiveContainer width="100%" height={400}>
                <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis
                        type="number" dataKey="npv" name="NPV ($M)"
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickFormatter={(v) => `$${v.toFixed(0)}M`}
                    />
                    <YAxis
                        type="number" dataKey="irr" name="IRR (%)"
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickFormatter={(v) => `${v.toFixed(0)}%`}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 11 }}
                        formatter={(value: any, name: any) => {
                            if (name === 'NPV ($M)') return [`$${Number(value).toFixed(2)}M`, name];
                            if (name === 'IRR (%)') return [`${Number(value).toFixed(2)}%`, name];
                            return [`${Number(value).toFixed(1)} yr`, name];
                        }}
                    />
                    <ReferenceLine x={0} stroke="#ef4444" strokeDasharray="4 4" />
                    <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 4" />
                    <Scatter data={scatterData} fill="#06b6d4" opacity={0.4}>
                        {scatterData.map((d, i) => {
                            const paybackColor = d.payback <= 4 ? '#10b981' : d.payback <= 7 ? '#f59e0b' : '#ef4444';
                            return <Cell key={i} fill={paybackColor} />;
                        })}
                    </Scatter>
                </ScatterChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Payback ≤ 4yr</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> 4-7yr</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> &gt; 7yr</span>
            </div>
        </div>
    );
}
