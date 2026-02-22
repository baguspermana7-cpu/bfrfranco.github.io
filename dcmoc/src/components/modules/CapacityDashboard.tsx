'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { calculateCapacityPlan, CAPACITY_PRESETS, CapacityPhase, CapacityPlanResult } from '@/modules/capacity/CapacityPlanningEngine';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import { Layers, DollarSign, Zap, Users, TrendingUp, Plus, Trash2, AlertTriangle, ShieldCheck, FileText, BarChart3 } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
    AreaChart, Area, ComposedChart, Line, Cell, ReferenceLine,
} from 'recharts';
import { fmt, fmtMoney, fmtKw, fmtPct } from '@/lib/format';
import { ExportPDFButton } from '@/components/ui/ExportPDFButton';

const PHASE_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899'];

const CapacityDashboardMod = () => {
    const { selectedCountry, inputs, actions } = useSimulationStore();
    const [localPhases, setLocalPhases] = useState<CapacityPhase[]>(inputs.capacityPhases);
    const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'assumptions'>('overview');
    const [isExporting, setIsExporting] = useState(false);

    const result: CapacityPlanResult | null = useMemo(() => {
        if (!selectedCountry || localPhases.length === 0) return null;
        return calculateCapacityPlan({
            phases: localPhases,
            country: selectedCountry,
            coolingType: inputs.coolingType,
            tierLevel: inputs.tierLevel,
            shiftModel: inputs.shiftModel,
            maintenanceModel: inputs.maintenanceModel,
            hybridRatio: inputs.hybridRatio,
        });
    }, [selectedCountry, localPhases, inputs]);

    const applyPreset = useCallback((preset: 'small' | 'medium' | 'large') => {
        setLocalPhases([...CAPACITY_PRESETS[preset]]);
    }, []);

    const addPhase = useCallback(() => {
        const lastPhase = localPhases[localPhases.length - 1];
        const newStart = lastPhase ? lastPhase.startMonth + lastPhase.buildMonths + 6 : 0;
        setLocalPhases([...localPhases, {
            id: `p${localPhases.length + 1}`,
            label: `Phase ${localPhases.length + 1}`,
            itLoadKw: 5000,
            startMonth: newStart,
            buildMonths: 14,
            occupancyRamp: [0.3, 0.6, 0.85, 0.95],
        }]);
    }, [localPhases]);

    const removePhase = useCallback((idx: number) => {
        setLocalPhases(localPhases.filter((_, i) => i !== idx));
    }, [localPhases]);

    const updatePhase = useCallback((idx: number, field: keyof CapacityPhase, value: number | string) => {
        const updated = [...localPhases];
        (updated[idx] as any)[field] = value;
        setLocalPhases(updated);
    }, [localPhases]);

    if (!selectedCountry) {
        return <div className="p-8 text-center text-slate-500">Select a country to configure capacity plan.</div>;
    }

    // Cumulative chart data (sample every 3 months)
    const cumulativeChartData = result ? Array.from({ length: Math.ceil(result.totalMonths / 3) }, (_, i) => {
        const m = i * 3;
        return {
            month: m,
            itLoadKw: result.cumulativeItLoad[m] ?? 0,
            capex: result.cumulativeCapex[m] ?? 0,
        };
    }) : [];

    const TABS = [
        { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
        { id: 'details' as const, label: 'Phase Details', icon: FileText },
        { id: 'assumptions' as const, label: 'Assumptions', icon: ShieldCheck },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Layers className="w-6 h-6 text-cyan-500" />
                        Capacity Planning
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {selectedCountry.name} · {localPhases.length} Phases · Tier {inputs.tierLevel}
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    {(['small', 'medium', 'large'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => applyPreset(p)}
                            className="px-3 py-1.5 text-xs font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors"
                        >
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                    ))}
                    {result && (
                        <ExportPDFButton
                            isGenerating={isExporting}
                            onExport={async () => {
                                setIsExporting(true);
                                try {
                                    const { generateCapacityPlanPDF } = await import('@/modules/reporting/PdfGenerator');
                                    await generateCapacityPlanPDF(selectedCountry!, {
                                        capPlan: result,
                                        phases: localPhases,
                                        itLoadKw: inputs.itLoad,
                                    });
                                } catch (e) {
                                    console.error('Capacity PDF error:', e);
                                } finally {
                                    setIsExporting(false);
                                }
                            }}
                            label="PDF"
                            className="px-2 py-1 text-[10px]"
                        />
                    )}
                </div>
            </div>

            {/* Narrative Summary */}
            {result && (
                <Card className="bg-gradient-to-r from-cyan-50 to-indigo-50 dark:from-cyan-950/30 dark:to-indigo-950/30 border-cyan-200 dark:border-cyan-800/50">
                    <CardContent className="pt-5 pb-4">
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{result.narrative}</p>
                    </CardContent>
                </Card>
            )}

            {/* Phase Editor + KPIs side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Phase Editor */}
                <Card className="lg:col-span-1 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Phase Configuration</h3>
                            <button onClick={addPhase} className="p-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {localPhases.map((phase, idx) => (
                                <div key={phase.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700" style={{ borderLeftColor: PHASE_COLORS[idx % PHASE_COLORS.length], borderLeftWidth: 3 }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <input
                                            className="text-sm font-semibold bg-transparent text-slate-900 dark:text-white border-none focus:outline-none w-24"
                                            value={phase.label}
                                            onChange={e => updatePhase(idx, 'label', e.target.value)}
                                        />
                                        {localPhases.length > 1 && (
                                            <button onClick={() => removePhase(idx)} className="p-1 text-red-400 hover:text-red-500 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div>
                                            <label className="text-slate-500 block mb-0.5">IT Load (kW)</label>
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-xs"
                                                value={phase.itLoadKw}
                                                onChange={e => updatePhase(idx, 'itLoadKw', Math.max(100, Number(e.target.value)))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-slate-500 block mb-0.5">Start (Mo)</label>
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-xs"
                                                value={phase.startMonth}
                                                onChange={e => updatePhase(idx, 'startMonth', Math.max(0, Number(e.target.value)))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-slate-500 block mb-0.5">Build (Mo)</label>
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-xs"
                                                value={phase.buildMonths}
                                                onChange={e => updatePhase(idx, 'buildMonths', Math.max(3, Number(e.target.value)))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* KPIs + Gantt */}
                <div className="lg:col-span-2 space-y-4">
                    {result && (
                        <>
                            {/* KPI Row */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                                    <CardContent className="pt-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Zap className="w-4 h-4 text-cyan-500" />
                                            <span className="text-xs text-slate-500 uppercase">Total Capacity</span>
                                            <Tooltip content="Total IT power deployed across all build phases." />
                                        </div>
                                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtKw(result.totalItLoadKw)}</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                                    <CardContent className="pt-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <DollarSign className="w-4 h-4 text-emerald-500" />
                                            <span className="text-xs text-slate-500 uppercase">Total CAPEX</span>
                                            <Tooltip content="Cumulative capital expenditure across all capacity build phases including construction, MEP, and equipment." />
                                        </div>
                                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.totalCapex)}</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                                    <CardContent className="pt-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <TrendingUp className="w-4 h-4 text-amber-500" />
                                            <span className="text-xs text-slate-500 uppercase">Avg $/kW</span>
                                            <Tooltip content="Cost per kilowatt trajectory across build phases. Should decrease with economies of scale." />
                                        </div>
                                        <div className="text-2xl font-bold text-slate-900 dark:text-white">${fmt(result.totalCapex / result.totalItLoadKw)}</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                                    <CardContent className="pt-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Users className="w-4 h-4 text-purple-500" />
                                            <span className="text-xs text-slate-500 uppercase">Scalability</span>
                                            <Tooltip content="Composite score (0-100) based on CAPEX efficiency, phase spacing, and number of phases." />
                                        </div>
                                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{result.scalabilityScore}</div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Gantt Chart */}
                            <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                                <CardContent className="pt-6">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Build Timeline (Gantt)</h3>
                                    <div className="space-y-2">
                                        {result.phases.map((phase, idx) => {
                                            const maxMonth = result.totalMonths;
                                            const buildStart = (phase.startMonth / maxMonth) * 100;
                                            const buildWidth = (phase.buildMonths / maxMonth) * 100;
                                            const opWidth = Math.min(((48) / maxMonth) * 100, 100 - buildStart - buildWidth);
                                            return (
                                                <div key={phase.id} className="flex items-center gap-3">
                                                    <span className="text-xs text-slate-500 w-20 shrink-0">{phase.label}</span>
                                                    <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-900/30 rounded relative">
                                                        <div
                                                            className="absolute h-full rounded-l opacity-60"
                                                            style={{
                                                                left: `${buildStart}%`,
                                                                width: `${buildWidth}%`,
                                                                backgroundColor: PHASE_COLORS[idx % PHASE_COLORS.length],
                                                            }}
                                                        />
                                                        <div
                                                            className="absolute h-full rounded-r"
                                                            style={{
                                                                left: `${buildStart + buildWidth}%`,
                                                                width: `${opWidth}%`,
                                                                backgroundColor: PHASE_COLORS[idx % PHASE_COLORS.length],
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-slate-500 w-16 shrink-0 text-right">Mo {phase.startMonth}-{phase.operationalMonth}</span>
                                                </div>
                                            );
                                        })}
                                        {/* Month axis */}
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="w-20 shrink-0" />
                                            <div className="flex-1 flex justify-between text-[9px] text-slate-400">
                                                {[0, Math.round(result.totalMonths * 0.25), Math.round(result.totalMonths * 0.5), Math.round(result.totalMonths * 0.75), result.totalMonths].map(m => (
                                                    <span key={m}>Mo {m}</span>
                                                ))}
                                            </div>
                                            <span className="w-16 shrink-0" />
                                        </div>
                                    </div>
                                    <div className="flex gap-4 mt-3 text-[10px] text-slate-400">
                                        <span className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-cyan-500 opacity-60" /> Build</span>
                                        <span className="flex items-center gap-1"><div className="w-3 h-2 rounded-sm bg-cyan-500" /> Operational</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </div>

            {/* Tab Bar */}
            {result && (
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-1">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <tab.icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Tab Content */}
            {result && activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Cumulative Capacity + CAPEX */}
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                        <CardContent className="pt-6">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Cumulative Capacity & Investment</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <ComposedChart data={cumulativeChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} label={{ value: 'Month', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 11 }} />
                                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => fmtKw(v)} />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => fmtMoney(v)} />
                                    <RTooltip
                                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                        formatter={(v: any, name: any) => [name === 'itLoadKw' ? fmtKw(v) : fmtMoney(v), name === 'itLoadKw' ? 'IT Capacity' : 'CAPEX']}
                                    />
                                    <Area yAxisId="left" type="stepAfter" dataKey="itLoadKw" fill="#06b6d4" fillOpacity={0.2} stroke="#06b6d4" strokeWidth={2} />
                                    <Line yAxisId="right" type="monotone" dataKey="capex" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Utilization Curve */}
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                        <CardContent className="pt-6">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Capacity vs Demand Utilization</h3>
                            <p className="text-[11px] text-slate-400 mb-4">Deployed capacity versus projected demand based on occupancy ramp assumptions</p>
                            <ResponsiveContainer width="100%" height={280}>
                                <ComposedChart data={result.utilizationCurve}>
                                    <defs>
                                        <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} label={{ value: 'Month', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => fmtKw(v)} />
                                    <RTooltip
                                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                        formatter={((v: number, name: string) => [fmtKw(v), name === 'capacityKw' ? 'Capacity' : 'Demand']) as any}
                                    />
                                    <Area type="stepAfter" dataKey="capacityKw" fill="url(#capGrad)" stroke="#06b6d4" strokeWidth={2} />
                                    <Line type="monotone" dataKey="demandKw" stroke="#10b981" strokeWidth={2} strokeDasharray="5 3" dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                            <div className="flex items-center justify-center gap-6 mt-2 text-xs text-slate-500">
                                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-cyan-500 rounded" /><span>Deployed Capacity</span></div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-emerald-500 rounded border-dashed" /><span>Projected Demand</span></div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Enhanced Phase Comparison Table */}
                    <Card className="lg:col-span-2 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                        <CardContent className="pt-6">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Phase Comparison</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="text-left py-2 px-2 text-slate-500">Phase</th>
                                            <th className="text-right py-2 px-2 text-slate-500">IT Load</th>
                                            <th className="text-right py-2 px-2 text-slate-500">CAPEX</th>
                                            <th className="text-right py-2 px-2 text-slate-500">$/kW</th>
                                            <th className="text-right py-2 px-2 text-slate-500">FTE</th>
                                            <th className="text-right py-2 px-2 text-slate-500">PUE</th>
                                            <th className="text-right py-2 px-2 text-slate-500">Revenue/yr</th>
                                            <th className="text-right py-2 px-2 text-slate-500">ROI</th>
                                            <th className="text-right py-2 px-2 text-slate-500">Risk</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.phases.map((phase, idx) => {
                                            const detail = result.phaseDetails[idx];
                                            return (
                                                <tr key={phase.id} className="border-b border-slate-100 dark:border-slate-800">
                                                    <td className="py-2 px-2 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PHASE_COLORS[idx % PHASE_COLORS.length] }} />
                                                        {phase.label}
                                                    </td>
                                                    <td className="text-right py-2 px-2 text-slate-700 dark:text-slate-300">{fmtKw(phase.itLoadKw)}</td>
                                                    <td className="text-right py-2 px-2 text-slate-700 dark:text-slate-300">{fmtMoney(phase.capex)}</td>
                                                    <td className="text-right py-2 px-2 text-slate-700 dark:text-slate-300">${fmt(phase.capexPerKw)}</td>
                                                    <td className="text-right py-2 px-2 text-slate-700 dark:text-slate-300">{phase.fte}</td>
                                                    <td className="text-right py-2 px-2 text-slate-700 dark:text-slate-300">{phase.pue}</td>
                                                    <td className="text-right py-2 px-2 text-emerald-600 dark:text-emerald-400">{detail ? fmtMoney(detail.revenueEstimate) : '-'}</td>
                                                    <td className="text-right py-2 px-2 text-slate-700 dark:text-slate-300">{detail ? `${detail.roiYears}yr` : '-'}</td>
                                                    <td className="text-right py-2 px-2">
                                                        {detail && (
                                                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                                detail.riskScore >= 60 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                                                detail.riskScore >= 35 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                                                                'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                            }`}>
                                                                {detail.riskScore}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="font-bold">
                                            <td className="py-2 px-2 text-slate-900 dark:text-white">Total</td>
                                            <td className="text-right py-2 px-2 text-cyan-600 dark:text-cyan-400">{fmtKw(result.totalItLoadKw)}</td>
                                            <td className="text-right py-2 px-2 text-cyan-600 dark:text-cyan-400">{fmtMoney(result.totalCapex)}</td>
                                            <td className="text-right py-2 px-2 text-cyan-600 dark:text-cyan-400">${fmt(result.totalCapex / result.totalItLoadKw)}</td>
                                            <td className="text-right py-2 px-2 text-cyan-600 dark:text-cyan-400">{result.phases[result.phases.length - 1]?.fte ?? 0}</td>
                                            <td className="text-right py-2 px-2 text-cyan-600 dark:text-cyan-400">{result.pueEvolution[result.pueEvolution.length - 1]?.pue ?? '-'}</td>
                                            <td className="text-right py-2 px-2 text-emerald-600 dark:text-emerald-400">{fmtMoney(result.phaseDetails.reduce((s, d) => s + d.revenueEstimate, 0))}</td>
                                            <td className="text-right py-2 px-2 text-cyan-600 dark:text-cyan-400">-</td>
                                            <td className="text-right py-2 px-2 text-cyan-600 dark:text-cyan-400">-</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Staffing Ramp */}
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-6 mb-3">Staffing Ramp</h3>
                            <ResponsiveContainer width="100%" height={150}>
                                <AreaChart data={result.staffingRamp}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <RTooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                                    <Area type="stepAfter" dataKey="fte" fill="#8b5cf6" fillOpacity={0.2} stroke="#8b5cf6" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Phase Details Tab */}
            {result && activeTab === 'details' && (
                <div className="space-y-4">
                    {result.phaseDetails.map((detail, idx) => (
                        <Card key={detail.id} className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700" style={{ borderLeftColor: PHASE_COLORS[idx % PHASE_COLORS.length], borderLeftWidth: 4 }}>
                            <CardContent className="pt-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{detail.label}</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{detail.description}</p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 ml-4">
                                        <div className="text-center">
                                            <div className="text-[10px] text-slate-400 uppercase">Revenue/yr</div>
                                            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmtMoney(detail.revenueEstimate)}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-[10px] text-slate-400 uppercase">ROI</div>
                                            <div className="text-sm font-bold text-slate-900 dark:text-white">{detail.roiYears}yr</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-[10px] text-slate-400 uppercase">Risk</div>
                                            <div className={`text-sm font-bold ${
                                                detail.riskScore >= 60 ? 'text-red-500' :
                                                detail.riskScore >= 35 ? 'text-amber-500' : 'text-emerald-500'
                                            }`}>{detail.riskScore}/100</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    {/* Infrastructure Scope */}
                                    <div>
                                        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Infrastructure Scope</h4>
                                        <ul className="space-y-1">
                                            {detail.infrastructureScope.map((item, i) => (
                                                <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                                    <div className="w-1 h-1 rounded-full bg-cyan-500 shrink-0" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Risk Factors */}
                                    <div>
                                        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Risk Factors</h4>
                                        <ul className="space-y-1">
                                            {detail.riskFactors.map((risk, i) => (
                                                <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                                    {risk}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Assumptions Tab */}
            {result && activeTab === 'assumptions' && (
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Key Assumptions</h3>
                        <p className="text-[11px] text-slate-400 mb-4">These assumptions drive the capacity plan calculations. Adjust phase configuration or global inputs to see how changes propagate.</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="text-left py-2 px-3 text-slate-500 w-32">Category</th>
                                        <th className="text-left py-2 px-3 text-slate-500">Assumption</th>
                                        <th className="text-left py-2 px-3 text-slate-500 w-60">Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.assumptions.map((a, i) => (
                                        <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                                            <td className="py-2 px-3">
                                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                                                    a.category === 'CAPEX' ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400' :
                                                    a.category === 'Operations' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                                                    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                }`}>{a.category}</span>
                                            </td>
                                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{a.assumption}</td>
                                            <td className="py-2 px-3 text-slate-900 dark:text-white font-medium">{a.value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default CapacityDashboardMod;
