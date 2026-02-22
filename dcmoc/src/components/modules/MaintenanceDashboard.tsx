
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { ASSETS } from '@/constants/assets';
import { calculateEnvironmentalDegradation } from '@/modules/maintenance/EnvironmentalLogic';
import { generateAssetCounts, AssetCount } from '@/lib/AssetGenerator';
import { generateMaintenanceSchedule, MaintenanceEvent } from '@/modules/maintenance/ScheduleEngine';
import {
    calculateStrategyComparison,
    calculateSLAComparison,
    calculateSparesOptimization,
    StrategyProfile,
} from '@/modules/maintenance/MaintenanceStrategyEngine';
import {
    Wrench, Wind, AlertTriangle, CheckCircle2, Edit3, Save, RotateCcw,
    Calendar, List, TrendingUp, Shield, Package, Zap, DollarSign,
    Clock, BarChart3, ArrowRight, Info, ChevronDown, Flame
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend
} from 'recharts';
import { ExportPDFButton } from '@/components/ui/ExportPDFButton';
import clsx from 'clsx';
import { fmtMoney } from '@/lib/format';

type TabId = 'assets' | 'schedule' | 'strategy' | 'sla' | 'spares';

export function MaintenanceDashboard() {
    const { selectedCountry, inputs, actions } = useSimulationStore();
    const { inputs: capexInputs } = useCapexStore();

    // Local state
    const [assetCounts, setAssetCounts] = useState<AssetCount[]>([]);
    const [isPencilMode, setIsPencilMode] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('assets');
    const [isExporting, setIsExporting] = useState(false);

    const schedule = useMemo(() => {
        return generateMaintenanceSchedule(assetCounts);
    }, [assetCounts]);

    const strategyData = useMemo(() => {
        if (!selectedCountry || assetCounts.length === 0) return null;
        return calculateStrategyComparison(
            assetCounts, schedule,
            inputs.tierLevel === 4 ? 4 : 3,
            selectedCountry,
            inputs.maintenanceModel as 'in-house' | 'hybrid' | 'vendor',
            inputs.hybridRatio ?? 0.5
        );
    }, [assetCounts, schedule, inputs.tierLevel, selectedCountry, inputs.maintenanceModel, inputs.hybridRatio]);

    const slaData = useMemo(() => {
        if (!selectedCountry || assetCounts.length === 0) return null;
        return calculateSLAComparison(
            assetCounts,
            inputs.tierLevel === 4 ? 4 : 3,
            selectedCountry
        );
    }, [assetCounts, inputs.tierLevel, selectedCountry]);

    const sparesData = useMemo(() => {
        if (!selectedCountry || assetCounts.length === 0) return null;
        return calculateSparesOptimization(
            assetCounts,
            inputs.tierLevel === 4 ? 4 : 3,
            selectedCountry
        );
    }, [assetCounts, inputs.tierLevel, selectedCountry]);

    // Initial Generation Effect — use simulation store for consistency with FuelGen/CBM
    const coolingMap: 'air' | 'pumped' = inputs.coolingType === 'liquid' || inputs.coolingType === 'rdhx' ? 'pumped' : 'air';
    useEffect(() => {
        if (!isPencilMode) {
            const estBuildingArea = inputs.itLoad * 1.5;
            const counts = generateAssetCounts(
                inputs.itLoad,
                inputs.tierLevel === 4 ? 4 : 3,
                coolingMap,
                estBuildingArea,
                inputs.coolingTopology,
                inputs.powerRedundancy
            );
            setAssetCounts(counts);
        }
    }, [inputs.itLoad, inputs.tierLevel, inputs.coolingType, isPencilMode, inputs.coolingTopology, inputs.powerRedundancy]);

    const handleCountChange = (assetId: string, newCount: number) => {
        setAssetCounts(prev => prev.map(a =>
            a.assetId === assetId ? { ...a, count: newCount, isManual: true } : a
        ));
    };

    const handleReset = () => {
        setIsPencilMode(false);
    };

    if (!selectedCountry) return null;

    const currentAQI = inputs.aqiOverride ?? selectedCountry.environment.baselineAQI;
    const isHighAQI = currentAQI > 100;

    const activeAssets = ASSETS.filter(a => {
        const countObj = assetCounts.find(c => c.assetId === a.id);
        return countObj && countObj.count > 0;
    });

    const weeks = Array.from({ length: 52 }, (_, i) => i + 1);


    // KPI calculations
    const totalMaintHours = schedule.reduce((a, e) => a + e.durationHours, 0);
    const activeStrategyId = inputs.maintenanceStrategy || 'planned';
    const annualBudget = strategyData?.strategies.find(s => s.id === activeStrategyId)?.totalAnnualCost || 0;
    const predictedSavings = strategyData?.fiveYearSavings || 0;

    const strategyLabels: Record<string, string> = { reactive: 'Run-to-Failure', planned: 'Planned Preventive', predictive: 'Predictive (CBM)' };
    const strategyName = strategyLabels[activeStrategyId] || 'Planned Preventive';

    const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
        { id: 'assets', label: 'Assets', icon: <List className="w-4 h-4" /> },
        { id: 'schedule', label: 'Schedule', icon: <Calendar className="w-4 h-4" /> },
        { id: 'strategy', label: 'Strategy', icon: <TrendingUp className="w-4 h-4" /> },
        { id: 'sla', label: 'SLA', icon: <Shield className="w-4 h-4" /> },
        { id: 'spares', label: 'Spares', icon: <Package className="w-4 h-4" /> },
    ];

    return (
        <div className="space-y-6">
            {/* ═══ HEADER ═══ */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl backdrop-blur-sm shadow-sm dark:shadow-none gap-4">
                <div className="flex flex-col gap-2">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Wrench className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
                            Maintenance & Asset Lifecycle
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                            SFG20 regimes & strategy analysis for <span className="text-slate-900 dark:text-white font-medium">{selectedCountry.name}</span>
                        </p>
                    </div>
                    <ExportPDFButton
                        isGenerating={isExporting}
                        onExport={async () => {
                            if (!selectedCountry || !strategyData || !slaData || !sparesData || !schedule) return;
                            setIsExporting(true);
                            try {
                                const { generateMaintenancePDF } = await import('@/modules/reporting/PdfGenerator');
                                const { generateMaintenanceNarrative } = await import('@/modules/reporting/ExecutiveSummaryGenerator');
                                const narrative = generateMaintenanceNarrative(strategyData, slaData, sparesData);
                                await generateMaintenancePDF(
                                    selectedCountry,
                                    strategyData,
                                    slaData,
                                    sparesData,
                                    schedule,
                                    undefined,
                                    narrative
                                );
                            } finally {
                                setIsExporting(false);
                            }
                        }}
                        className="w-fit"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Maintenance STRATEGY Selector (Fix) */}
                    <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                        {(['reactive', 'planned', 'predictive'] as const).map((strat) => (
                            <button
                                key={strat}
                                onClick={() => actions.setInputs({ maintenanceStrategy: strat })}
                                className={clsx(
                                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize",
                                    inputs.maintenanceStrategy === strat
                                        ? "bg-emerald-500 text-white shadow-sm"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800"
                                )}
                            >
                                {strat}
                            </button>
                        ))}
                    </div>

                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2" />

                    {/* Maintenance Model Selector */}
                    <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                        {(['in-house', 'hybrid', 'vendor'] as const).map((model) => (
                            <button
                                key={model}
                                onClick={() => actions.setInputs({ maintenanceModel: model })}
                                className={clsx(
                                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize",
                                    inputs.maintenanceModel === model
                                        ? "bg-indigo-600 text-white shadow-sm"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800"
                                )}
                            >
                                {model}
                            </button>
                        ))}
                    </div>

                    {/* Hybrid Slider */}
                    {inputs.maintenanceModel === 'hybrid' && (
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                            <span className="text-xs text-slate-500 dark:text-slate-400">In-House:</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="10"
                                    className="w-20 accent-indigo-500"
                                    value={(inputs.hybridRatio || 0.3) * 100}
                                    onChange={(e) => actions.setInputs({ hybridRatio: Number(e.target.value) / 100 })}
                                />
                                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                    {((inputs.hybridRatio || 0.3) * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="hidden md:block h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2" />

                    {/* Pencil Mode Toggle (only for assets/schedule tabs) */}
                    {(activeTab === 'assets' || activeTab === 'schedule') && (
                        <>
                            <button
                                onClick={() => setIsPencilMode(!isPencilMode)}
                                className={clsx(
                                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border",
                                    isPencilMode
                                        ? "bg-indigo-50 dark:bg-indigo-600/20 border-indigo-200 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300"
                                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                )}
                            >
                                {isPencilMode ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                                {isPencilMode ? "Save" : "Edit"}
                            </button>
                            <div className="hidden md:block h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
                        </>
                    )}

                    {/* AQI Slider */}
                    <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-950 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <Wind className={clsx("w-4 h-4", isHighAQI ? "text-amber-500" : "text-emerald-500")} />
                            AQI:
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="500"
                            value={currentAQI}
                            className="w-24 accent-cyan-500"
                            onChange={(e) => actions.setAqiOverride(Number(e.target.value))}
                        />
                        <span className="font-mono font-bold text-slate-900 dark:text-white w-8 text-right">{currentAQI}</span>
                    </div>
                </div>
            </div>

            {/* ═══ KPI ROW ═══ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Annual Maint Budget', value: fmtMoney(annualBudget), sub: strategyName, icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', tip: 'Total annual maintenance budget based on selected strategy (labor + parts + downtime risk)' },
                    { label: 'Maintenance Events', value: `${schedule.length}`, sub: `${totalMaintHours.toFixed(0)} total hours`, icon: Wrench, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10', tip: 'Number of scheduled maintenance events per year based on SFG20 regimes' },
                    { label: 'Active Assets', value: `${assetCounts.reduce((a, c) => a + c.count, 0)}`, sub: `${activeAssets.length} asset types`, icon: Zap, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', tip: 'Total physical assets requiring maintenance, auto-generated from CAPEX config' },
                    { label: '5-Year Savings', value: fmtMoney(predictedSavings), sub: 'Optimal vs Worst', icon: TrendingUp, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10', tip: 'Projected savings over 5 years comparing optimal vs worst maintenance strategy' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm dark:shadow-none">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={clsx("p-1.5 rounded-lg", kpi.bg)}>
                                <kpi.icon className={clsx('w-4 h-4', kpi.color)} />
                            </div>
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">{kpi.label} <Tooltip content={(kpi as any).tip} /></span>
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white truncate" title={kpi.value.toString()}>{kpi.value}</div>
                        <div className="text-xs text-slate-500 mt-1">{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* ═══ TAB NAVIGATION ═══ */}
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center whitespace-nowrap",
                            activeTab === tab.id
                                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700"
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-900 border border-transparent"
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══ TAB CONTENT ═══ */}
            {activeTab === 'assets' && <AssetsTab assets={activeAssets} assetCounts={assetCounts} isPencilMode={isPencilMode} handleCountChange={handleCountChange} selectedCountry={selectedCountry} currentAQI={currentAQI} />}
            {activeTab === 'schedule' && <ScheduleTab assetCounts={assetCounts} schedule={schedule} weeks={weeks} />}
            {activeTab === 'strategy' && strategyData && <StrategyTab data={strategyData} fmt={fmtMoney} activeStrat={inputs.maintenanceStrategy || 'planned'} onSelect={(s) => actions.setInputs({ maintenanceStrategy: s as any })} />}
            {activeTab === 'sla' && slaData && <SLATab data={slaData} fmt={fmtMoney} />}
            {activeTab === 'spares' && sparesData && <SparesTab data={sparesData} fmt={fmtMoney} />}

            {/* ═══ B17: MAINTENANCE EVENT TIMELINE (Monthly Heatmap) ═══ */}
            {activeTab === 'schedule' && schedule.length > 0 && (
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Flame className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                            Monthly Maintenance Density Heatmap
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Event intensity by month — darker = more maintenance events</p>
                    </div>
                    <div className="p-6">
                        {(() => {
                            const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            // Count events per month (weekNumber -> month mapping)
                            const monthCounts = new Array(12).fill(0);
                            schedule.forEach(event => {
                                const monthIdx = Math.min(11, Math.floor((event.weekNumber - 1) / 4.33));
                                monthCounts[monthIdx]++;
                            });
                            const maxCount = Math.max(...monthCounts, 1);

                            return (
                                <div>
                                    <div className="grid grid-cols-12 gap-2 mb-4">
                                        {MONTHS.map((month, idx) => {
                                            const count = monthCounts[idx];
                                            const intensity = count / maxCount;
                                            // Color from slate (low) through amber to red (high)
                                            const bg = intensity === 0
                                                ? 'bg-slate-100 dark:bg-slate-800'
                                                : intensity < 0.25
                                                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                                    : intensity < 0.5
                                                        ? 'bg-amber-100 dark:bg-amber-900/30'
                                                        : intensity < 0.75
                                                            ? 'bg-orange-200 dark:bg-orange-900/40'
                                                            : 'bg-red-200 dark:bg-red-900/40';
                                            const textColor = intensity === 0
                                                ? 'text-slate-400 dark:text-slate-600'
                                                : intensity < 0.5
                                                    ? 'text-slate-700 dark:text-slate-300'
                                                    : 'text-slate-900 dark:text-white';

                                            return (
                                                <div
                                                    key={month}
                                                    className={clsx(
                                                        "flex flex-col items-center justify-center rounded-lg p-3 border transition-all hover:scale-105",
                                                        bg,
                                                        intensity > 0.5 ? 'border-orange-300 dark:border-orange-800/50' : 'border-slate-200 dark:border-slate-700/50'
                                                    )}
                                                >
                                                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">{month}</span>
                                                    <span className={clsx("text-lg font-bold font-mono mt-1", textColor)}>{count}</span>
                                                    <span className="text-[9px] text-slate-400 dark:text-slate-500">events</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500">
                                        <span>Low</span>
                                        <div className="flex gap-0.5">
                                            <div className="w-4 h-2 rounded-sm bg-slate-100 dark:bg-slate-800" />
                                            <div className="w-4 h-2 rounded-sm bg-emerald-100 dark:bg-emerald-900/30" />
                                            <div className="w-4 h-2 rounded-sm bg-amber-100 dark:bg-amber-900/30" />
                                            <div className="w-4 h-2 rounded-sm bg-orange-200 dark:bg-orange-900/40" />
                                            <div className="w-4 h-2 rounded-sm bg-red-200 dark:bg-red-900/40" />
                                        </div>
                                        <span>High</span>
                                        <span className="ml-4">Total: {schedule.length} events/year</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* ═══ B18: SPARE PARTS ABC PARETO CHART ═══ */}
            {activeTab === 'spares' && sparesData && sparesData.items.length > 0 && (
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-violet-500 dark:text-violet-400" />
                            Spare Parts ABC Pareto Analysis
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        {(() => {
                            // Sort items by cost descending, take top items representing ~80% of budget
                            const sorted = [...sparesData.items]
                                .sort((a, b) => (b.unitCost * b.quantity) - (a.unitCost * a.quantity));
                            const totalCost = sorted.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);

                            // Build Pareto data
                            let cumulative = 0;
                            const paretoData = sorted.slice(0, 15).map((item, idx) => {
                                const itemCost = item.unitCost * item.quantity;
                                cumulative += itemCost;
                                return {
                                    name: item.partName.length > 18 ? item.partName.slice(0, 16) + '..' : item.partName,
                                    cost: itemCost,
                                    cumulativePct: totalCost > 0 ? (cumulative / totalCost) * 100 : 0,
                                };
                            });

                            return (
                                <div>
                                    <ResponsiveContainer width="100%" height={320}>
                                        <ComposedChart data={paretoData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis
                                                dataKey="name"
                                                stroke="#64748b"
                                                fontSize={10}
                                                angle={-35}
                                                textAnchor="end"
                                                height={70}
                                            />
                                            <YAxis
                                                yAxisId="left"
                                                stroke="#8b5cf6"
                                                fontSize={11}
                                                tickFormatter={(v: number) => fmtMoney(v)}
                                            />
                                            <YAxis
                                                yAxisId="right"
                                                orientation="right"
                                                stroke="#f59e0b"
                                                fontSize={11}
                                                domain={[0, 100]}
                                                tickFormatter={(v: number) => `${v}%`}
                                            />
                                            <RTooltip
                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                                labelStyle={{ color: '#e2e8f0' }}
                                                formatter={((value: number, name: string) => [
                                                    name === 'cost' ? fmtMoney(value) : `${value.toFixed(1)}%`,
                                                    name === 'cost' ? 'Item Cost' : 'Cumulative %'
                                                ]) as any}
                                            />
                                            <Legend formatter={(value: string) => value === 'cost' ? 'Item Cost' : 'Cumulative %'} />
                                            <Bar yAxisId="left" dataKey="cost" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={24} name="cost" />
                                            <Line yAxisId="right" type="monotone" dataKey="cumulativePct" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} name="cumulativePct" />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                    <div className="mt-3 grid grid-cols-3 gap-3">
                                        {(() => {
                                            // ABC classification
                                            let cumPct = 0;
                                            let aCount = 0, bCount = 0, cCount = 0;
                                            sorted.forEach(item => {
                                                const itemCost = item.unitCost * item.quantity;
                                                cumPct += totalCost > 0 ? (itemCost / totalCost) * 100 : 0;
                                                if (cumPct <= 80) aCount++;
                                                else if (cumPct <= 95) bCount++;
                                                else cCount++;
                                            });
                                            return [
                                                { label: 'Class A (0-80%)', count: aCount, color: 'text-red-500 dark:text-red-400', desc: 'High-value, critical' },
                                                { label: 'Class B (80-95%)', count: bCount, color: 'text-amber-500 dark:text-amber-400', desc: 'Medium-value' },
                                                { label: 'Class C (95-100%)', count: cCount, color: 'text-emerald-500 dark:text-emerald-400', desc: 'Low-value, bulk' },
                                            ].map((cls, i) => (
                                                <div key={i} className="text-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                                    <div className="text-xs text-slate-500 mb-1">{cls.label}</div>
                                                    <div className={clsx("text-xl font-bold font-mono", cls.color)}>{cls.count}</div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">{cls.desc}</div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════
// TAB: Assets (existing grid)
// ═══════════════════════════════════════════════════════════════

function AssetsTab({ assets, assetCounts, isPencilMode, handleCountChange, selectedCountry, currentAQI }: {
    assets: typeof ASSETS;
    assetCounts: AssetCount[];
    isPencilMode: boolean;
    handleCountChange: (id: string, n: number) => void;
    selectedCountry: any;
    currentAQI: number;
}) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20 animate-in fade-in zoom-in-95 duration-300">
            {assets.map((asset) => {
                const countObj = assetCounts.find(c => c.assetId === asset.id);
                const count = countObj?.count || 0;

                return (
                    <div key={asset.id} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-300 dark:hover:border-slate-600 transition-all group relative shadow-sm dark:shadow-none">
                        {countObj?.isManual && (
                            <div className="absolute top-0 right-0 p-1 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-bl-lg border-b border-l border-indigo-200 dark:border-indigo-500/30">
                                <Edit3 className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                            </div>
                        )}

                        <div className="p-5 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-start bg-slate-50/50 dark:bg-transparent">
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-xs font-semibold text-cyan-600 dark:text-cyan-500 uppercase tracking-wider mb-1">
                                            {asset.category}
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-cyan-700 dark:group-hover:text-white transition-colors flex items-center gap-3">
                                            {asset.name}
                                            {isPencilMode && (
                                                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-1">
                                                    <button
                                                        onClick={() => handleCountChange(asset.id, Math.max(0, count - 1))}
                                                        className="px-2 py-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                                    >-</button>
                                                    <span className="font-mono text-cyan-600 dark:text-cyan-400 px-2 min-w-[30px] text-center text-sm">{count}</span>
                                                    <button
                                                        onClick={() => handleCountChange(asset.id, count + 1)}
                                                        className="px-2 py-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                                    >+</button>
                                                </div>
                                            )}
                                            {!isPencilMode && (
                                                <span className="ml-2 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-sm font-mono text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-700">
                                                    x{count}
                                                </span>
                                            )}
                                        </h3>
                                    </div>
                                </div>

                                <div className="text-xs text-slate-500 mt-2 flex gap-3">
                                    <span>Redundancy: <span className="text-slate-700 dark:text-slate-300 font-medium">{asset.defaultRedundancy}</span></span>
                                    <span>•</span>
                                    <span>Total Annual Hours: <span className="text-slate-700 dark:text-slate-300 font-medium">
                                        {asset.maintenanceTasks.reduce((acc, t) => acc + (t.standardHours * (t.frequency === 'Monthly' ? 12 : t.frequency === 'Quarterly' ? 4 : t.frequency === 'Bi-Annual' ? 2 : 1)), 0) * count} hrs
                                    </span></span>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Consumables Impact */}
                            {asset.consumables?.map((part) => {
                                const impact = calculateEnvironmentalDegradation(asset.id, part.name, part.baseLifeMonths, selectedCountry, currentAQI);
                                const degradationPercent = ((1 - impact.degradationFactor) * 100).toFixed(0);

                                return (
                                    <div key={part.name} className="bg-slate-50 dark:bg-slate-950/30 rounded-lg p-3 text-sm border border-slate-100 dark:border-slate-800/50">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-slate-600 dark:text-slate-300">{part.name}</span>
                                            <span className={clsx("font-mono font-bold", impact.degradationFactor < 0.8 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                                                {impact.adjustedLifeMonths} Months
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className={clsx("h-full rounded-full", impact.degradationFactor < 0.6 ? "bg-red-500" : impact.degradationFactor < 0.8 ? "bg-amber-500" : "bg-emerald-500")}
                                                style={{ width: `${impact.degradationFactor * 100}%` }}
                                            />
                                        </div>
                                        {impact.degradationFactor < 1 && (
                                            <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 dark:text-amber-500/80">
                                                <AlertTriangle className="w-3 h-3" />
                                                Life reduced by {degradationPercent}% due to AQI
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Task Preview */}
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/50">
                                <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Key Maintenance Activities</div>
                                <div className="space-y-2">
                                    {asset.maintenanceTasks.slice(0, 3).map((task) => (
                                        <div key={task.id} className="flex justify-between text-xs items-center group/task">
                                            <span className="text-slate-600 dark:text-slate-400 group-hover/task:text-slate-900 dark:group-hover/task:text-slate-300">{task.name}</span>
                                            <div className="flex gap-2">
                                                <span className={clsx(
                                                    "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                                                    task.criticality === 'Statutory' ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/30" :
                                                        task.criticality === 'Optimal' ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/30" : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                                                )}>
                                                    {task.criticality}
                                                </span>
                                                <span className="text-slate-500 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">{task.frequency}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════
// TAB: Schedule (existing Gantt)
// ═══════════════════════════════════════════════════════════════

function ScheduleTab({ assetCounts, schedule, weeks }: {
    assetCounts: AssetCount[];
    schedule: MaintenanceEvent[];
    weeks: number[];
}) {
    return (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm shadow-sm dark:shadow-none animate-in fade-in zoom-in-95 duration-300">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800/50 flex justify-between items-center bg-slate-50/50 dark:bg-transparent">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-300">Annual Maintenance Calendar ({new Date().getFullYear()})</div>
                <div className="flex gap-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500 border border-red-400"></div>Statutory</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500 border border-blue-400"></div>Optimal</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-500 border border-slate-400"></div>Discretionary</div>
                </div>
            </div>
            <div className="overflow-x-auto">
                <div className="min-w-[1500px] p-4">
                    {/* Header Row */}
                    <div className="flex mb-2">
                        <div className="w-48 flex-shrink-0 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Asset Name</div>
                        <div className="flex-1 grid grid-cols-[repeat(52,minmax(20px,1fr))] gap-px">
                            {weeks.map(w => (
                                <div key={w} className="text-[10px] text-center text-slate-500 dark:text-slate-600 border-l border-slate-200 dark:border-slate-800/30">
                                    {w % 4 === 0 ? w : ''}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Schedule Rows */}
                    {assetCounts.filter(a => a.count > 0).map((asset) => {
                        const template = ASSETS.find(t => t.id === asset.assetId);
                        if (!template) return null;

                        return Array.from({ length: asset.count }).map((_, idx) => {
                            const unitName = `${template.name} #${idx + 1}`;
                            const assetEvents = schedule.filter(e => e.assetId === asset.assetId && e.assetName === unitName);

                            return (
                                <div key={`${asset.assetId}-${idx}`} className="flex items-center hover:bg-slate-100 dark:hover:bg-slate-800/30 transition-colors py-1 group border-b border-slate-100 dark:border-slate-800/30">
                                    <div className="w-48 flex-shrink-0 pl-2 text-xs text-slate-700 dark:text-slate-300 font-semibold truncate">{unitName}</div>
                                    <div className="flex-1 grid grid-cols-[repeat(52,minmax(20px,1fr))] gap-px h-6 relative">
                                        {weeks.map(week => {
                                            const event = assetEvents.find(e => e.weekNumber === week);
                                            if (!event) return <div key={week} className="border-l border-slate-100 dark:border-slate-800/10"></div>;

                                            // Calculate start/end dates for the week
                                            const yearStart = new Date(new Date().getFullYear(), 0, 1);
                                            const weekStart = new Date(yearStart.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
                                            const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
                                            const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                                            return (
                                                <div
                                                    key={week}
                                                    className="rounded-sm mx-0.5 cursor-help relative group/event shadow-sm"
                                                    style={{
                                                        backgroundColor: event.color,
                                                        minWidth: '4px',
                                                    }}
                                                >
                                                    {/* Enhanced Hover Popover */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-xl z-20 hidden group-hover/event:block">
                                                        <div className="text-xs font-bold text-slate-900 dark:text-white mb-1.5">{event.task.name}</div>
                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between text-[10px]">
                                                                <span className="text-slate-500 dark:text-slate-400">Asset:</span>
                                                                <span className="text-slate-700 dark:text-slate-300 font-medium">{event.assetName}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[10px]">
                                                                <span className="text-slate-500 dark:text-slate-400">Duration:</span>
                                                                <span className="text-slate-700 dark:text-slate-300 font-medium">{event.durationHours} hours</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[10px]">
                                                                <span className="text-slate-500 dark:text-slate-400">Technicians:</span>
                                                                <span className="text-slate-700 dark:text-slate-300 font-medium">{event.techniciansRequired}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[10px]">
                                                                <span className="text-slate-500 dark:text-slate-400">Week {week}:</span>
                                                                <span className="text-slate-700 dark:text-slate-300 font-medium">{fmtDate(weekStart)} – {fmtDate(weekEnd)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[10px]">
                                                                <span className="text-slate-500 dark:text-slate-400">Criticality:</span>
                                                                <span className={clsx(
                                                                    "font-medium px-1 py-0.5 rounded text-[9px]",
                                                                    event.task.criticality === 'Statutory' ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
                                                                        event.task.criticality === 'Optimal' ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                                                                            "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                                )}>{event.task.criticality}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        });
                    })}
                </div>
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════
// TAB: Strategy (NEW — Predictive vs Reactive vs Planned)
// ═══════════════════════════════════════════════════════════════

function StrategyTab({ data, fmt, activeStrat, onSelect }: { data: ReturnType<typeof calculateStrategyComparison>; fmt: (n: number) => string; activeStrat?: string; onSelect?: (strat: string) => void }) {
    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Strategy Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {data.strategies.map((s) => (
                    <div
                        key={s.id}
                        onClick={() => onSelect && onSelect(s.id)}
                        className={clsx(
                            "bg-white dark:bg-slate-900/50 border rounded-xl overflow-hidden transition-all relative shadow-sm dark:shadow-none cursor-pointer",
                            s.id === activeStrat ? `ring-2 ring-offset-2 dark:ring-offset-slate-900 ${s.id === 'reactive' ? 'ring-red-500 border-red-500/50' : s.id === 'planned' ? 'ring-blue-500 border-blue-500/50' : 'ring-emerald-500 border-emerald-500/50'}` : s.id === data.recommended ? "border-emerald-500/50 ring-1 ring-emerald-500/20" : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        )}
                    >
                        {s.id === data.recommended && (
                            <div className="absolute top-3 right-3 bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                                Recommended
                            </div>
                        )}

                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-transparent">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                                <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">{s.label}</h3>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.description}</p>
                        </div>

                        {/* Metrics */}
                        <div className="p-5 space-y-3">
                            {[
                                { label: 'Annual Cost', value: fmt(s.totalAnnualCost), highlight: true },
                                { label: 'Labor', value: fmt(s.annualLaborCost) },
                                { label: 'Parts & Materials', value: fmt(s.annualPartsCost) },
                                { label: 'Downtime Risk', value: fmt(s.annualDowntimeCost) },
                                { label: 'Unplanned Failures', value: `${s.unplannedFailures.toFixed(1)}/yr` },
                                { label: '5-Year NPV', value: fmt(s.fiveYearNPV), highlight: true },
                            ].map((row, i) => (
                                <div key={i} className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/30 last:border-0">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">{row.label}</span>
                                    <span className={clsx('text-sm font-mono', row.highlight ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-700 dark:text-slate-300')}>{row.value}</span>
                                </div>
                            ))}

                            {s.sensorCapex > 0 && (
                                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/30">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">Sensor CAPEX (one-time)</span>
                                    <span className="text-sm font-mono text-orange-600 dark:text-orange-400">{fmt(s.sensorCapex)}</span>
                                </div>
                            )}

                            {/* Reliability Bar */}
                            <div className="mt-3 pt-2">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-500">Reliability Index</span>
                                    <span className="font-mono text-slate-900 dark:text-white">{s.reliabilityIndex}/100</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${s.reliabilityIndex}%`, backgroundColor: s.color }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recommendation Box */}
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-6">
                <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">Strategy Recommendation</h3>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{data.recommendationReason}</p>
                        <div className="mt-3 px-3 py-2 bg-white dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 w-fit">
                            <span className="text-xs text-slate-500">5-Year Savings (Optimal vs Worst):</span>
                            <span className="ml-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">{fmt(data.fiveYearSavings)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════
// TAB: SLA (NEW — Vendor SLA Comparison)
// ═══════════════════════════════════════════════════════════════

function SLATab({ data, fmt }: { data: ReturnType<typeof calculateSLAComparison>; fmt: (n: number) => string }) {
    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* SLA Table */}
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50">
                                <th className="py-3 px-4 text-left text-xs text-slate-500 font-medium uppercase min-w-[120px]">SLA Tier</th>
                                <th className="py-3 px-4 text-left text-xs text-slate-500 font-medium uppercase min-w-[120px]">Response Time</th>
                                <th className="py-3 px-4 text-right text-xs text-slate-500 font-medium uppercase min-w-[100px]">Annual Cost</th>
                                <th className="py-3 px-4 text-right text-xs text-slate-500 font-medium uppercase min-w-[100px]">Risk Exposure</th>
                                <th className="py-3 px-4 text-right text-xs text-slate-500 font-medium uppercase min-w-[120px]">Net Annual Cost</th>
                                <th className="py-3 px-4 text-right text-xs text-slate-500 font-medium uppercase min-w-[120px]">Break-Even</th>
                                <th className="py-3 px-4 text-left text-xs text-slate-500 font-medium uppercase">Coverage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.tiers.map((tier) => (
                                <tr key={tier.id} className={clsx(
                                    "border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors",
                                    tier.recommended && "bg-emerald-50/50 dark:bg-emerald-950/20"
                                )}>
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-900 dark:text-white font-medium">{tier.label}</span>
                                            {tier.recommended && (
                                                <span className="bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full">
                                                    Best Value
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className="font-mono text-cyan-600 dark:text-cyan-400">{tier.responseTime}</span>
                                    </td>
                                    <td className="py-4 px-4 text-right font-mono text-slate-700 dark:text-slate-300">{fmt(tier.annualCost)}</td>
                                    <td className="py-4 px-4 text-right">
                                        <span className={clsx("font-mono", tier.riskExposure > 50000 ? "text-red-500 dark:text-red-400" : tier.riskExposure > 20000 ? "text-amber-500 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                                            {fmt(tier.riskExposure)}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-right font-mono text-slate-900 dark:text-white font-bold">{fmt(tier.netAnnualCost)}</td>
                                    <td className="py-4 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                                        {tier.id === 'nbd' ? '—' : `${fmt(tier.breakEvenDowntimeCost)}/min`}
                                    </td>
                                    <td className="py-4 px-4 text-xs text-slate-500 dark:text-slate-400 max-w-[200px]">{tier.coverageScope}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Break-Even Visual */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cost vs Risk */}
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm dark:shadow-none">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                        Cost vs Risk Exposure
                    </h3>
                    <div className="space-y-4">
                        {data.tiers.map(tier => {
                            const maxCost = Math.max(...data.tiers.map(t => t.netAnnualCost));
                            const costPct = (tier.annualCost / maxCost) * 100;
                            const riskPct = (tier.riskExposure / maxCost) * 100;
                            return (
                                <div key={tier.id}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className={clsx("font-medium", tier.recommended ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400")}>{tier.label}</span>
                                        <span className="font-mono text-slate-500 dark:text-slate-400">{fmt(tier.netAnnualCost)}</span>
                                    </div>
                                    <div className="flex gap-0.5 h-5">
                                        <div className="bg-blue-500/80 dark:bg-blue-500/60 rounded-l" style={{ width: `${costPct}%` }} title="SLA Cost" />
                                        <div className="bg-red-500/80 dark:bg-red-500/60 rounded-r" style={{ width: `${riskPct}%` }} title="Risk Exposure" />
                                    </div>
                                </div>
                            );
                        })}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 bg-blue-500/80 dark:bg-blue-500/60 rounded" />SLA Cost</div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 bg-red-500/80 dark:bg-red-500/60 rounded" />Risk Exposure</div>
                        </div>
                    </div>
                </div>

                {/* Analysis */}
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm dark:shadow-none">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Info className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                        Analysis
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">{data.analysis}</p>
                    <div className="bg-amber-50 dark:bg-slate-950/50 rounded-lg p-4 border border-amber-200 dark:border-slate-800">
                        <div className="text-xs text-slate-500 uppercase mb-2">Key Insight</div>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                            Upgrading from NBD to 4-Hour response saves {fmt(data.tiers[0].riskExposure - data.tiers[1].riskExposure)}/year in risk exposure,
                            costing an additional {fmt(data.tiers[1].annualCost - data.tiers[0].annualCost)}/year in SLA fees.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// TAB: Spares (NEW — Inventory Analysis)
// ═══════════════════════════════════════════════════════════════

function SparesTab({ data, fmt }: { data: ReturnType<typeof calculateSparesOptimization>; fmt: (n: number) => string }) {
    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Critical Spares List */}
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50">
                                <th className="py-3 px-4 text-left text-xs text-slate-500 font-medium uppercase">Critical Spare Part</th>
                                <th className="py-3 px-4 text-center text-xs text-slate-500 font-medium uppercase">Criticality</th>
                                <th className="py-3 px-4 text-right text-xs text-slate-500 font-medium uppercase">Unit Cost</th>
                                <th className="py-3 px-4 text-center text-xs text-slate-500 font-medium uppercase">Lead Time</th>
                                <th className="py-3 px-4 text-center text-xs text-slate-500 font-medium uppercase">Reorder / Max</th>
                                <th className="py-3 px-4 text-right text-xs text-slate-500 font-medium uppercase">Holding Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((item, idx) => (
                                <tr key={`${item.assetId}-${item.partName}-${idx}`} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                                        {item.partName} <span className="text-slate-400 font-normal">({item.assetName})</span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={clsx("px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                                            item.criticality === 'Critical' ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30" :
                                                item.criticality === 'Major' ? "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30" :
                                                    "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30"
                                        )}>
                                            {item.criticality}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">{fmt(item.unitCost)}</td>
                                    <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-400">{item.leadTimeDays} days</td>
                                    <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-400">{item.reorderPoint} / {item.quantity}</td>
                                    <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">{fmt(item.holdingCost)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Inventory KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Total Inventory Value', value: fmt(data.totalInventoryValue), desc: 'Capital tied up in spares', color: 'text-blue-600 dark:text-blue-400' },
                    { label: 'Annual Holding Cost', value: fmt(data.totalHoldingCost), desc: 'Storage & depreciation', color: 'text-purple-600 dark:text-purple-400' },
                    { label: 'Annual Spares Budget', value: fmt(data.totalAnnualSparesBudget), desc: 'Consumption + Holding', color: 'text-emerald-600 dark:text-emerald-400' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm dark:shadow-none">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">{kpi.label}</div>
                        <div className={clsx("text-2xl font-bold mb-1", kpi.color)}>{kpi.value}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{kpi.desc}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
