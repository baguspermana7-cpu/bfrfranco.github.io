'use client';

import React, { useMemo } from 'react';
import { useScenarioStore, SavedScenario } from '@/store/scenario';
import { COUNTRIES } from '@/constants/countries';
import { calculateCapex } from '@/lib/CapexEngine';
import { calculateFinancials, defaultOccupancyRamp } from '@/modules/analytics/FinancialEngine';
import { calculateStaffing } from '@/modules/staffing/ShiftEngine';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { GitCompare, X, ArrowLeftRight } from 'lucide-react';
import clsx from 'clsx';

const SCENARIO_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444'];

interface ScenarioMetrics {
    scenario: SavedScenario;
    capex: number;
    capexPerKw: number;
    annualOpex: number;
    opexPerKw: number;
    totalStaff: number;
    pue: number;
    irr: number;
    npv: number;
    paybackYears: number;
}

export function ScenarioComparisonPanel() {
    const { scenarios, comparisonIds, exitComparisonMode } = useScenarioStore();

    const compared = useMemo(() => {
        return comparisonIds
            .map(id => scenarios.find(s => s.id === id))
            .filter(Boolean) as SavedScenario[];
    }, [comparisonIds, scenarios]);

    const metricsData = useMemo<ScenarioMetrics[]>(() => {
        return compared.map(sc => {
            const country = COUNTRIES[sc.countryId];
            if (!country) {
                return {
                    scenario: sc,
                    capex: sc.summary.annualCapex,
                    capexPerKw: 0,
                    annualOpex: 0,
                    opexPerKw: 0,
                    totalStaff: sc.summary.totalStaff,
                    pue: sc.summary.pue,
                    irr: sc.summary.irr || 0,
                    npv: sc.summary.npv || 0,
                    paybackYears: sc.summary.paybackYears || 0,
                };
            }

            const capexResult = calculateCapex(sc.capexInputs as any);
            const simInputs = sc.simInputs;
            const itLoad = simInputs.itLoad || 2500;
            const shiftModel = simInputs.shiftModel || '8h';

            const roles: Array<{ role: 'shift-lead' | 'engineer' | 'technician' | 'admin' | 'janitor'; count: number; is24x7: boolean }> = [
                { role: 'shift-lead', count: simInputs.headcount_ShiftLead || 4, is24x7: true },
                { role: 'engineer', count: simInputs.headcount_Engineer || 5, is24x7: true },
                { role: 'technician', count: simInputs.headcount_Technician || 2, is24x7: false },
                { role: 'admin', count: simInputs.headcount_Admin || 1, is24x7: false },
                { role: 'janitor', count: simInputs.headcount_Janitor || 2, is24x7: false },
            ];
            const annualStaffCost = roles.reduce((sum, r) => {
                const res = calculateStaffing(r.role, r.count, shiftModel, country, r.is24x7);
                return sum + res.monthlyCost * 12;
            }, 0);
            const totalStaff = roles.reduce((sum, r) => sum + r.count, 0);

            const annualEnergy = itLoad * capexResult.pue * 8760 / 1000;
            const annualEnergyCost = annualEnergy * (country.economy.electricityRate * 1000);
            const annualOpex = annualStaffCost + annualEnergyCost + (country.compliance.annualComplianceCost || 50000);

            const occupancyRamp = simInputs.occupancyRamp?.length > 0 ? simInputs.occupancyRamp : defaultOccupancyRamp(10);
            const financialResult = calculateFinancials({
                totalCapex: capexResult.total,
                annualOpex,
                revenuePerKwMonth: 120,
                itLoadKw: itLoad,
                discountRate: 0.10,
                projectLifeYears: 10,
                escalationRate: 0.03,
                opexEscalation: country.economy.inflationRate,
                occupancyRamp,
                taxRate: country.economy.taxRate,
                depreciationYears: 7,
            });

            return {
                scenario: sc,
                capex: capexResult.total,
                capexPerKw: capexResult.metrics.perKw,
                annualOpex,
                opexPerKw: itLoad > 0 ? annualOpex / itLoad : 0,
                totalStaff,
                pue: capexResult.pue,
                irr: financialResult.irr,
                npv: financialResult.npv,
                paybackYears: financialResult.paybackPeriodYears,
            };
        });
    }, [compared]);

    if (compared.length < 2) {
        return (
            <div className="text-center py-20 text-slate-500">
                <p>Select at least 2 scenarios to compare.</p>
                <button onClick={exitComparisonMode} className="mt-4 text-cyan-600 hover:text-cyan-400 text-sm">
                    Go back
                </button>
            </div>
        );
    }

    const baseline = metricsData[0];
    const fmtM = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n.toFixed(0)}`;
    const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
    const delta = (val: number, base: number) => base !== 0 ? ((val - base) / Math.abs(base)) * 100 : 0;

    // Build chart data
    const chartMetrics = [
        { key: 'capex', label: 'CAPEX ($M)', extract: (m: ScenarioMetrics) => m.capex / 1_000_000 },
        { key: 'annualOpex', label: 'Annual OPEX ($M)', extract: (m: ScenarioMetrics) => m.annualOpex / 1_000_000 },
        { key: 'totalStaff', label: 'Staff', extract: (m: ScenarioMetrics) => m.totalStaff },
        { key: 'pue', label: 'PUE', extract: (m: ScenarioMetrics) => m.pue },
    ];

    const barData = chartMetrics.map(cm => {
        const row: Record<string, any> = { metric: cm.label };
        metricsData.forEach((m, i) => {
            row[`s${i}`] = cm.extract(m);
        });
        return row;
    });

    // Input diff: find parameters that differ
    const inputKeys = ['tierLevel', 'shiftModel', 'staffingModel', 'coolingType', 'powerRedundancy', 'itLoad', 'maintenanceStrategy', 'maintenanceModel'];
    const diffs = inputKeys.filter(key => {
        const vals = compared.map(sc => String(sc.simInputs[key] ?? ''));
        return new Set(vals).size > 1;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                            <GitCompare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        Scenario Comparison
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Comparing {compared.length} scenarios — baseline: <span className="font-medium text-cyan-600 dark:text-cyan-400">{baseline.scenario.name}</span>
                    </p>
                </div>
                <button
                    onClick={exitComparisonMode}
                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors flex items-center gap-2"
                >
                    <X className="w-4 h-4" />
                    Exit Comparison
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${compared.length}, 1fr)` }}>
                {metricsData.map((m, i) => (
                    <div
                        key={m.scenario.id}
                        className="bg-white dark:bg-slate-800/50 rounded-xl border-2 p-4 space-y-3"
                        style={{ borderColor: SCENARIO_COLORS[i] }}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SCENARIO_COLORS[i] }} />
                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{m.scenario.name}</span>
                            {i === 0 && <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">BASELINE</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <KpiCell label="CAPEX" value={fmtM(m.capex)} delta={i > 0 ? fmtPct(delta(m.capex, baseline.capex)) : undefined} />
                            <KpiCell label="OPEX/yr" value={fmtM(m.annualOpex)} delta={i > 0 ? fmtPct(delta(m.annualOpex, baseline.annualOpex)) : undefined} />
                            <KpiCell label="PUE" value={m.pue.toFixed(2)} delta={i > 0 ? fmtPct(delta(m.pue, baseline.pue)) : undefined} />
                            <KpiCell label="Staff" value={String(m.totalStaff)} delta={i > 0 ? fmtPct(delta(m.totalStaff, baseline.totalStaff)) : undefined} />
                            <KpiCell label="IRR" value={`${m.irr.toFixed(1)}%`} delta={i > 0 ? fmtPct(delta(m.irr, baseline.irr)) : undefined} />
                            <KpiCell label="Payback" value={`${m.paybackYears.toFixed(1)} yr`} delta={i > 0 ? fmtPct(delta(m.paybackYears, baseline.paybackYears)) : undefined} invertDelta />
                        </div>
                    </div>
                ))}
            </div>

            {/* Grouped Bar Chart */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Side-by-Side Comparison</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                        <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                            labelStyle={{ color: '#e2e8f0' }}
                        />
                        <Legend formatter={(value: string) => {
                            const idx = parseInt(value.replace('s', ''));
                            return metricsData[idx]?.scenario.name || value;
                        }} />
                        {metricsData.map((_, i) => (
                            <Bar key={i} dataKey={`s${i}`} fill={SCENARIO_COLORS[i]} radius={[4, 4, 0, 0]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Delta Table */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                        Delta Analysis (vs Baseline)
                    </h3>
                </div>
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                            <th className="text-left px-4 py-2 text-slate-500 font-medium">Metric</th>
                            {metricsData.map((m, i) => (
                                <th key={i} className="text-center px-3 py-2 font-medium" style={{ color: SCENARIO_COLORS[i] }}>
                                    {m.scenario.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { label: 'Total CAPEX', get: (m: ScenarioMetrics) => m.capex, fmt: fmtM },
                            { label: 'CAPEX/kW', get: (m: ScenarioMetrics) => m.capexPerKw, fmt: (n: number) => `$${Math.round(n).toLocaleString()}` },
                            { label: 'Annual OPEX', get: (m: ScenarioMetrics) => m.annualOpex, fmt: fmtM },
                            { label: 'OPEX/kW', get: (m: ScenarioMetrics) => m.opexPerKw, fmt: (n: number) => `$${Math.round(n).toLocaleString()}` },
                            { label: 'Total Staff', get: (m: ScenarioMetrics) => m.totalStaff, fmt: (n: number) => String(n) },
                            { label: 'PUE', get: (m: ScenarioMetrics) => m.pue, fmt: (n: number) => n.toFixed(2) },
                            { label: 'IRR', get: (m: ScenarioMetrics) => m.irr, fmt: (n: number) => `${n.toFixed(1)}%` },
                            { label: 'NPV', get: (m: ScenarioMetrics) => m.npv, fmt: fmtM },
                            { label: 'Payback', get: (m: ScenarioMetrics) => m.paybackYears, fmt: (n: number) => `${n.toFixed(1)} yr` },
                        ].map(row => (
                            <tr key={row.label} className="border-b border-slate-100 dark:border-slate-800">
                                <td className="px-4 py-2 text-slate-700 dark:text-slate-300 font-medium">{row.label}</td>
                                {metricsData.map((m, i) => {
                                    const val = row.get(m);
                                    const baseVal = row.get(baseline);
                                    const d = i > 0 && baseVal !== 0 ? ((val - baseVal) / Math.abs(baseVal)) * 100 : 0;
                                    return (
                                        <td key={i} className="text-center px-3 py-2">
                                            <span className="text-slate-900 dark:text-white font-mono">{row.fmt(val)}</span>
                                            {i > 0 && (
                                                <span className={clsx('ml-1', d > 0 ? 'text-red-500' : d < 0 ? 'text-emerald-500' : 'text-slate-400')}>
                                                    ({fmtPct(d)})
                                                </span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Input Diff */}
            {diffs.length > 0 && (
                <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Input Differences</h3>
                    </div>
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                <th className="text-left px-4 py-2 text-slate-500 font-medium">Parameter</th>
                                {compared.map((sc, i) => (
                                    <th key={i} className="text-center px-3 py-2 font-medium" style={{ color: SCENARIO_COLORS[i] }}>
                                        {sc.name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {diffs.map(key => (
                                <tr key={key} className="border-b border-slate-100 dark:border-slate-800">
                                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300 font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                                    {compared.map((sc, i) => {
                                        const val = sc.simInputs[key];
                                        const baseVal = compared[0].simInputs[key];
                                        const isDiff = i > 0 && String(val) !== String(baseVal);
                                        return (
                                            <td key={i} className={clsx('text-center px-3 py-2 font-mono', isDiff ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-600 dark:text-slate-400')}>
                                                {typeof val === 'number' ? val.toLocaleString() : String(val)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function KpiCell({ label, value, delta, invertDelta }: { label: string; value: string; delta?: string; invertDelta?: boolean }) {
    const isPositive = delta?.startsWith('+');
    const isNegative = delta?.startsWith('-');
    let colorClass = 'text-slate-400';
    if (delta && delta !== '+0.0%') {
        if (invertDelta) {
            colorClass = isPositive ? 'text-red-500' : isNegative ? 'text-emerald-500' : 'text-slate-400';
        } else {
            colorClass = isPositive ? 'text-emerald-500' : isNegative ? 'text-red-500' : 'text-slate-400';
        }
    }

    return (
        <div>
            <span className="text-slate-500 dark:text-slate-400 block">{label}</span>
            <span className="text-slate-900 dark:text-white font-semibold">{value}</span>
            {delta && <span className={clsx('ml-1', colorClass)}>{delta}</span>}
        </div>
    );
}
