
'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { calculateStaffing, compareShiftModels, generate5YearProjection, StaffRole, StaffingResult, REFERENCE_STAFFING_10MW, ROLE_LABELS, calculateAutoHeadcount } from '@/modules/staffing/ShiftEngine';
import { useEffectiveInputs } from '@/store/useEffectiveInputs';
import { generateAnnualRoster } from '@/modules/staffing/RosterEngine';
import { calculateTurnoverCost as calculateCostOfTurnover } from '@/modules/staffing/CostOfTurnover';
import { Users, Clock, DollarSign, AlertTriangle, Calendar, Award, Briefcase, TrendingUp, ArrowRight, CheckCircle, XCircle, BarChart3, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import clsx from 'clsx';

import { OrgChart } from '@/components/visualizations/OrgChart';
import { RosterVisualizer } from '@/components/visualizations/RosterVisualizer';
import { CostWaterfall } from '@/components/visualizations/CostWaterfall';
import { WorkOrderView } from '@/components/modules/WorkOrderView';
import { ExportPDFButton } from '@/components/ui/ExportPDFButton';

export function StaffingDashboard() {
    const { selectedCountry, inputs, actions } = useSimulationStore();
    const effectiveInputs = useEffectiveInputs();
    const [activeTab, setActiveTab] = useState<'overview' | 'comparison' | 'org' | 'roster' | 'waterfall' | 'workorders'>('overview');
    const [isExporting, setIsExporting] = useState(false);

    // Auto headcount calculation for rationale display
    const autoResult = useMemo(() => {
        return calculateAutoHeadcount(
            inputs.itLoad,
            inputs.tierLevel,
            inputs.shiftModel,
            inputs.staffingModel === 'outsourced' ? 'outsourced' : inputs.staffingModel,
            inputs.maintenanceModel,
            inputs.maintenanceStrategy,
            inputs.hybridRatio ?? 0.5
        );
    }, [inputs.itLoad, inputs.tierLevel, inputs.shiftModel, inputs.staffingModel, inputs.maintenanceModel, inputs.maintenanceStrategy, inputs.hybridRatio]);

    // Memoized calculations
    const results = useMemo(() => {
        if (!selectedCountry) return null;

        const roleConfigs: { role: StaffRole; qtyKey: string; is24x7: boolean; label: string }[] = [
            { role: 'shift-lead', qtyKey: 'headcount_ShiftLead', is24x7: true, label: 'Team Leaders' },
            { role: 'engineer', qtyKey: 'headcount_Engineer', is24x7: true, label: 'Engineers' },
            { role: 'technician', qtyKey: 'headcount_Technician', is24x7: false, label: 'Technicians' },
            { role: 'admin', qtyKey: 'headcount_Admin', is24x7: false, label: 'Supervisor' },
            { role: 'janitor', qtyKey: 'headcount_Janitor', is24x7: false, label: 'Facility Staff' },
        ];

        const staffingResults: StaffingResult[] = roleConfigs.map(cfg => {
            const qty = (effectiveInputs as any)[cfg.qtyKey] || 1;
            const opModel = inputs.staffingModel === 'outsourced' ? 'vendor' : inputs.staffingModel;
            return calculateStaffing(cfg.role, qty, inputs.shiftModel, selectedCountry, cfg.is24x7, undefined, undefined, opModel, inputs.hybridRatio ?? 0.5);
        });

        const totalHeadcount = staffingResults.reduce((acc, r) => acc + r.headcount, 0);
        const totalMonthlyCost = staffingResults.reduce((acc, r) => acc + r.monthlyCost, 0);
        const totalOnShift = staffingResults.filter(r => r.schedule.teamsRequired > 1).reduce((acc, r) => acc + r.onShiftCount, 0);

        // Shift Comparison (for the comparison tab)
        const shiftComparisons = roleConfigs
            .filter(cfg => cfg.is24x7)
            .map(cfg => {
                const qty = (inputs as any)[cfg.qtyKey] || 1;
                const opModel = inputs.staffingModel === 'outsourced' ? 'vendor' : inputs.staffingModel;
                return {
                    label: cfg.label,
                    comparison: compareShiftModels(cfg.role, qty, selectedCountry, cfg.is24x7, opModel),
                };
            });

        // Total comparison
        const total8hCost = shiftComparisons.reduce((a, c) => a + c.comparison.model8h.monthlyCost, 0);
        const total12hCost = shiftComparisons.reduce((a, c) => a + c.comparison.model12h.monthlyCost, 0);
        const totalSavings = total8hCost - total12hCost;

        // Projections
        const projections = generate5YearProjection(staffingResults, selectedCountry.economy?.laborEscalation ?? 0.04);

        // A10: Unified turnover cost model via CostOfTurnover
        const avgSalary = totalMonthlyCost / totalHeadcount;
        const turnoverImpact = calculateCostOfTurnover(
            'Duty Engineer',
            avgSalary,
            selectedCountry,
            inputs.turnoverRate || 0.15,
            totalHeadcount
        );

        // Roster Generation
        const rosterPattern = inputs.shiftModel === '12h' ? '4on-3off' : '3shift-8h';
        const roster = generateAnnualRoster(2025, rosterPattern);

        return {
            staffingResults, totalHeadcount, totalMonthlyCost, totalOnShift,
            projections, turnoverImpact, roster,
            shiftComparisons, total8hCost, total12hCost, totalSavings,
            roleConfigs,
        };
    }, [selectedCountry, inputs, effectiveInputs]);

    if (!selectedCountry || !results) return <div>Loading...</div>;

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl backdrop-blur-sm shadow-sm dark:shadow-none gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
                        Staffing & Shift Optimization
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                        Reference Model: <span className="text-slate-900 dark:text-white font-medium">10MW DC (80% In-House)</span>
                        &nbsp;·&nbsp;
                        <span className="text-cyan-600 dark:text-cyan-400 font-mono font-bold">{inputs.shiftModel.toUpperCase()} SHIFT</span>
                        &nbsp;·&nbsp;
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{results.totalHeadcount} FTEs</span>
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === 'overview'
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('comparison')}
                        className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === 'comparison'
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                    >
                        8h Vs 12h
                    </button>
                    <button
                        onClick={() => setActiveTab('org')}
                        className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === 'org'
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                    >
                        Org Chart
                    </button>
                    <button
                        onClick={() => setActiveTab('roster')}
                        className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === 'roster'
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                    >
                        Roster
                    </button>
                    <button
                        onClick={() => setActiveTab('waterfall')}
                        className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === 'waterfall'
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                    >
                        Waterfall
                    </button>
                    <button
                        onClick={() => setActiveTab('workorders')}
                        className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === 'workorders'
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                    >
                        Work Orders
                    </button>
                </div>

                <div className="flex gap-2">
                    <ExportPDFButton
                        isGenerating={isExporting}
                        label="Export Full Report (PDF)"
                        onExport={async () => {
                            if (!selectedCountry || !results) return;
                            setIsExporting(true);
                            try {
                                const { generateStaffingPDF } = await import('@/modules/reporting/PdfGenerator');
                                const insights = [
                                    { title: 'Staffing Overview', description: 'Detailed model representation.', category: 'Operational', severity: 'low', recommendation: '' }
                                ];
                                await generateStaffingPDF(
                                    selectedCountry,
                                    inputs.shiftModel as string,
                                    results.staffingResults,
                                    results.roster,
                                    insights as any[],
                                    results.shiftComparisons
                                );
                            } finally {
                                setIsExporting(false);
                            }
                        }}
                    />
                </div>
            </div>

            {/* Input Config Panel */}
            <div className="p-4 bg-slate-100 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
                {/* Auto/Manual Toggle */}
                <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase tracking-wide">
                        Headcount Composition
                    </div>
                    <button
                        onClick={() => {
                            if (inputs.staffingAutoMode) {
                                // Switching to manual: write auto values as baseline
                                actions.setInputs({
                                    headcount_ShiftLead: autoResult.headcounts['shift-lead'],
                                    headcount_Engineer: autoResult.headcounts['engineer'],
                                    headcount_Technician: autoResult.headcounts['technician'],
                                    headcount_Admin: autoResult.headcounts['admin'],
                                    headcount_Janitor: autoResult.headcounts['janitor'],
                                });
                            }
                            actions.toggleStaffingAutoMode();
                        }}
                        className={clsx(
                            "px-3 py-1 text-xs font-medium rounded-md border transition-all",
                            inputs.staffingAutoMode
                                ? "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-400"
                                : "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
                        )}
                    >
                        {inputs.staffingAutoMode ? 'AUTO' : 'MANUAL'}
                    </button>
                </div>

                <div className="grid grid-cols-5 gap-4">
                    {results.roleConfigs.map((cfg) => {
                        const autoKey = cfg.role === 'admin' ? 'admin' : cfg.role as keyof typeof autoResult.headcounts;
                        return (
                            <div key={cfg.role} className="space-y-1">
                                <label className="text-xs text-slate-500 uppercase flex items-center gap-1">{cfg.label} (Direct HC) <Tooltip content={cfg.role === 'shift-lead' ? 'Team leaders managing shift operations and handovers' : cfg.role === 'engineer' ? 'Engineers handling critical infrastructure systems' : cfg.role === 'technician' ? 'Technicians for day-shift maintenance tasks' : cfg.role === 'admin' ? 'Supervisors overseeing daily operations' : 'Facility support staff (cleaning, logistics)'} /></label>
                                {inputs.staffingAutoMode ? (
                                    <div className="w-full text-sm bg-slate-200 dark:bg-slate-800 border border-cyan-300 dark:border-cyan-800 rounded p-1 text-slate-900 dark:text-white font-bold text-center cursor-not-allowed">
                                        {(effectiveInputs as any)[cfg.qtyKey]}
                                    </div>
                                ) : (
                                    <input type="number" min="1" max="50" className="w-full text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white"
                                        value={(inputs as any)[cfg.qtyKey]}
                                        onChange={(e) => actions.setInputs({ [cfg.qtyKey]: Math.max(1, Number(e.target.value)) })} />
                                )}
                                <div className="text-[10px] text-slate-500 dark:text-slate-600">
                                    {cfg.is24x7 ? '24/7 Shift' : 'Day Shift (M-F)'}
                                </div>
                                {inputs.staffingAutoMode && autoResult.rationale[autoKey] && (
                                    <div className="text-[9px] text-cyan-600 dark:text-cyan-500 leading-tight">
                                        {autoResult.rationale[autoKey]}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ═══ OVERVIEW TAB ═══ */}
            {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    <Users className="w-5 h-5" />
                                </div>
                                <span className="text-xs text-slate-400 flex items-center gap-1">Total Headcount <Tooltip content="Total full-time equivalent employees across all roles and shifts" /></span>
                            </div>
                            <div className="mt-auto">
                                <div className="text-3xl font-bold text-slate-900 dark:text-white">{results.totalHeadcount} <span className="text-sm font-normal text-slate-500">FTEs</span></div>
                                <div className="text-xs text-slate-500 mt-1">{results.totalOnShift} on-shift at any time</div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                                <span className="text-xs text-slate-400 flex items-center gap-1">Monthly Payroll <Tooltip content="Total monthly cost including base salary, shift allowances, overtime, and benefits" /></span>
                            </div>
                            <div className="mt-auto">
                                <div className="text-3xl font-bold text-slate-900 dark:text-white truncate" title={formatMoney(results.totalMonthlyCost)}>
                                    {formatMoney(results.totalMonthlyCost)}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">Year 1 Baseline ({inputs.shiftModel === '8h' ? 'Continental' : '4-on/3-off'})</div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <span className="text-xs text-slate-400 flex items-center gap-1">Avg Weekly Hours <Tooltip content="Average scheduled hours per person per week including handover overlap" /></span>
                            </div>
                            <div className="mt-auto">
                                <div className="text-3xl font-bold text-slate-900 dark:text-white">
                                    {inputs.shiftModel === '8h' ? '42' : '40'}h <span className="text-sm font-normal text-slate-500">eff./person</span>
                                </div>
                                <div className="text-xs text-amber-500 mt-1">{inputs.shiftModel === '8h' ? '1.5h OT (handover)' : 'Zero OT (12h compressed)'}</div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <span className="text-xs text-slate-400 flex items-center gap-1">5-Year TCO <Tooltip content="Total Cost of Ownership over 5 years with labor escalation factored in" /></span>
                            </div>
                            <div className="mt-auto">
                                <div className="text-3xl font-bold text-slate-900 dark:text-white truncate" title={formatMoney(results.projections.reduce((a, b) => a + b.totalAnnualCost, 0))}>
                                    {formatMoney(results.projections.reduce((a, b) => a + b.totalAnnualCost, 0))}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">2025-2030 Cumulative</div>
                            </div>
                        </div>
                    </div>

                    {/* Schedule Pattern Info */}
                    <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-5">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-cyan-400" />
                            Active Schedule Pattern
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                            <div>
                                <dt className="text-slate-600 dark:text-slate-500 text-xs uppercase">Pattern</dt>
                                <dd className="text-slate-900 dark:text-white font-mono font-bold">{results.staffingResults[0]?.schedule.pattern}</dd>
                            </div>
                            <div>
                                <dt className="text-slate-600 dark:text-slate-500 text-xs uppercase">Cycle Length</dt>
                                <dd className="text-slate-900 dark:text-white font-mono font-bold">{inputs.shiftModel === '8h' ? '8 days' : '7 days'}</dd>
                            </div>
                            <div>
                                <dt className="text-slate-600 dark:text-slate-500 text-xs uppercase">Work Days / Cycle</dt>
                                <dd className="text-slate-900 dark:text-white font-mono font-bold">
                                    {inputs.shiftModel === '8h' ? '6 days' : '4 days'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-slate-600 dark:text-slate-500 text-xs uppercase">Shift Duration</dt>
                                <dd className="text-slate-900 dark:text-white font-mono font-bold">
                                    {inputs.shiftModel === '8h' ? '8h' : '12h'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-slate-600 dark:text-slate-500 text-xs uppercase">Teams Required</dt>
                                <dd className="text-slate-900 dark:text-white font-mono font-bold">4</dd>
                            </div>
                        </div>

                        {/* Shift Visualization Bar */}
                        <div className="mt-6">
                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Shift Types</div>
                            {inputs.shiftModel === '8h' ? (
                                <div className="grid grid-cols-3 gap-1 h-12 rounded-lg overflow-hidden">
                                    <div className="bg-amber-500/10 border-l-4 border-amber-500 flex items-center justify-center text-xs font-bold text-amber-600 dark:text-amber-500">
                                        ☀️ Morning
                                        <span className="block text-[9px] font-normal ml-2 opacity-70">06:00 — 14:00</span>
                                    </div>
                                    <div className="bg-orange-500/10 border-l-4 border-orange-500 flex items-center justify-center text-xs font-bold text-orange-600 dark:text-orange-500">
                                        ☁️ Afternoon
                                        <span className="block text-[9px] font-normal ml-2 opacity-70">14:00 — 22:00</span>
                                    </div>
                                    <div className="bg-indigo-500/10 border-l-4 border-indigo-500 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-500">
                                        🌙 Night
                                        <span className="block text-[9px] font-normal ml-2 opacity-70">22:00 — 06:00</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-1 h-12 rounded-lg overflow-hidden">
                                    <div className="bg-cyan-500/10 border-l-4 border-cyan-500 flex items-center justify-center text-xs font-bold text-cyan-600 dark:text-cyan-500">
                                        ☀️ Day
                                        <span className="block text-[9px] font-normal ml-2 opacity-70">06:00 — 18:00</span>
                                    </div>
                                    <div className="bg-indigo-500/10 border-l-4 border-indigo-500 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-500">
                                        🌙 Night
                                        <span className="block text-[9px] font-normal ml-2 opacity-70">18:00 — 06:00</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Detailed Role Breakdown Table */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm dark:shadow-none">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Detailed Role Breakdown (Monthly)</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-900/50 text-slate-500 uppercase font-bold">
                                        <th className="px-4 py-3 text-left">Role</th>
                                        <th className="px-4 py-3 text-center">Employed</th>
                                        <th className="px-4 py-3 text-center">On-Shift</th>
                                        <th className="px-4 py-3 text-left">Schedule</th>
                                        <th className="px-4 py-3 text-right">Base</th>
                                        <th className="px-4 py-3 text-right">Shift Allow.</th>
                                        <th className="px-4 py-3 text-right">OT</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                                    {results.staffingResults.map((r, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-200">{ROLE_LABELS[r.role as StaffRole] || r.role}</td>
                                            <td className="px-4 py-3 text-center text-cyan-600 dark:text-cyan-400 font-bold">{r.headcount}</td>
                                            <td className="px-4 py-3 text-center text-slate-500">{r.onShiftCount}</td>
                                            <td className="px-4 py-3 text-slate-500">
                                                {r.is24x7 ? (inputs.shiftModel === '8h' ? 'Continental 3-Shift (8h)' : '4-Team 12h (4on/3off)') : 'Mon-Fri 08:00-17:00'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatMoney(r.breakdown.baseSalaries)}</td>
                                            <td className="px-4 py-3 text-right text-cyan-600 dark:text-cyan-400">{formatMoney(r.breakdown.shiftAllowance)}</td>
                                            <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-500">{r.breakdown.overtime > 0 ? formatMoney(r.breakdown.overtime) : '–'}</td>
                                            <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(r.monthlyCost)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-100 dark:bg-slate-800/80 font-bold text-slate-900 dark:text-white border-t border-slate-300 dark:border-slate-600">
                                        <td className="px-4 py-3">TOTAL</td>
                                        <td className="px-4 py-3 text-center text-cyan-700 dark:text-cyan-400">{results.totalHeadcount}</td>
                                        <td className="px-4 py-3 text-center">{results.totalOnShift}</td>
                                        <td className="px-4 py-3"></td>
                                        <td className="px-4 py-3 text-right">{formatMoney(results.staffingResults.reduce((a, b) => a + b.breakdown.baseSalaries, 0))}</td>
                                        <td className="px-4 py-3 text-right">{formatMoney(results.staffingResults.reduce((a, b) => a + b.breakdown.shiftAllowance, 0))}</td>
                                        <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-500">{formatMoney(results.staffingResults.reduce((a, b) => a + b.breakdown.overtime, 0))}</td>
                                        <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{formatMoney(results.totalMonthlyCost)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 5-Year Cost Projection */}
                    <div className="bg-slate-200 dark:bg-slate-800/50 rounded-xl border border-slate-300 dark:border-slate-700 p-6 shadow-sm dark:shadow-none">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">5-Year Cost Projection (USD)</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-slate-500 font-bold uppercase border-b border-slate-300 dark:border-slate-700">
                                        <th className="py-2 text-left">Year</th>
                                        <th className="py-2 text-left">Headcount</th>
                                        <th className="py-2 text-right">Annual Cost</th>
                                        <th className="py-2 text-right">Escalation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-300 dark:divide-slate-700/50">
                                    {results.projections.map((y: any, i: number) => (
                                        <tr key={y.year}>
                                            <td className="py-2 font-mono text-cyan-600 dark:text-cyan-400">{y.year}</td>
                                            <td className="py-2 text-slate-600 dark:text-slate-400">{y.headcount} FTEs</td>
                                            <td className="py-2 text-right font-bold text-slate-900 dark:text-white">{formatMoney(y.totalAnnualCost)}</td>
                                            <td className="py-2 text-right text-slate-500">
                                                {i === 0 ? '-' : `+${((y.totalAnnualCost / results.projections[i - 1].totalAnnualCost - 1) * 100).toFixed(1)}%`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Efficiency Metrics */}
                    <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-6 mt-6">
                        <h3 className="text-md font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                            Efficiency Metrics
                        </h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {(() => {
                                const totalHC = results.staffingResults.reduce((a, r) => a + r.headcount, 0);
                                const totalCost = results.staffingResults.reduce((a, r) => a + r.monthlyCost, 0);
                                const totalOT = results.staffingResults.reduce((a, r) => a + r.breakdown.overtime, 0);
                                const shrinkage = selectedCountry.labor?.shrinkageFactor ?? 0.15;
                                return (
                                    <>
                                        <div className="bg-white dark:bg-black/30 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                            <div className="text-[10px] text-slate-500 uppercase">Utilization Rate</div>
                                            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{((1 - shrinkage) * 100).toFixed(0)}%</div>
                                            <div className="text-[10px] text-slate-500">Net productive hours</div>
                                        </div>
                                        <div className="bg-white dark:bg-black/30 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                            <div className="text-[10px] text-slate-500 uppercase">Cost per MW</div>
                                            <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">{formatMoney(totalCost / 1)}</div>
                                            <div className="text-[10px] text-slate-500">Staff cost / MW IT load</div>
                                        </div>
                                        <div className="bg-white dark:bg-black/30 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                            <div className="text-[10px] text-slate-500 uppercase">OT Ratio</div>
                                            <div className={`text-xl font-bold ${totalCost > 0 && (totalOT / totalCost) > 0.15 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                {totalCost > 0 ? ((totalOT / totalCost) * 100).toFixed(1) : 0}%
                                            </div>
                                            <div className="text-[10px] text-slate-500">Overtime as % of total</div>
                                        </div>
                                        <div className="bg-white dark:bg-black/30 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                            <div className="text-[10px] text-slate-500 uppercase">Shrinkage Loss</div>
                                            <div className="text-xl font-bold text-rose-600 dark:text-rose-400">{formatMoney(totalCost * shrinkage)}</div>
                                            <div className="text-[10px] text-slate-500">{(shrinkage * 100).toFixed(0)}% factor</div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Sensitivity Analysis */}
                    <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-6 mt-6">
                        <h3 className="text-md font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            Headcount Sensitivity Analysis
                        </h3>
                        <div className="text-[10px] text-slate-500 mb-3">
                            Impact of headcount changes on monthly staffing costs
                        </div>
                        <div className="space-y-2">
                            {(() => {
                                const baseCost = results.staffingResults.reduce((a, r) => a + r.monthlyCost, 0);
                                const baseHC = results.staffingResults.reduce((a, r) => a + r.headcount, 0);
                                const variations = [-20, -10, 0, 10, 20];
                                return variations.map(pct => {
                                    const adjustedCost = baseCost * (1 + pct / 100);
                                    const adjustedHC = Math.round(baseHC * (1 + pct / 100));
                                    const isBase = pct === 0;
                                    return (
                                        <div key={pct}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isBase ? 'bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/50' : 'bg-white dark:bg-slate-800/30'}`}
                                        >
                                            <div className={`w-14 text-xs font-mono ${pct < 0 ? 'text-emerald-600 dark:text-emerald-400' : pct > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-cyan-600 dark:text-cyan-400'}`}>
                                                {pct > 0 ? '+' : ''}{pct}%
                                            </div>
                                            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${pct < 0 ? 'bg-emerald-500' : pct > 0 ? 'bg-rose-500' : 'bg-cyan-500'}`}
                                                    style={{ width: `${(adjustedCost / (baseCost * 1.25)) * 100}%` }}
                                                />
                                            </div>
                                            <div className="w-20 text-xs font-mono text-right text-slate-900 dark:text-white">
                                                {formatMoney(adjustedCost)}
                                            </div>
                                            <div className="w-16 text-[10px] text-slate-500 text-right">
                                                {adjustedHC} FTEs
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>
            )} {/* End Overview Tab */}

            {/* ═══ COMPARISON TAB ═══ */}
            {activeTab === 'comparison' && (
                <div className="space-y-6">
                    {/* Summary Card */}
                    <div className={clsx(
                        "p-6 rounded-xl border",
                        results.totalSavings > 0
                            ? "bg-emerald-950/30 border-emerald-700"
                            : "bg-amber-950/30 border-amber-700"
                    )}>
                        <div className="flex items-center gap-3 mb-3">
                            {results.totalSavings > 0
                                ? <CheckCircle className="w-6 h-6 text-emerald-400" />
                                : <XCircle className="w-6 h-6 text-amber-400" />
                            }
                            <h3 className="text-lg font-bold text-white">
                                {results.totalSavings > 0
                                    ? `12h (4on/4off) saves ${formatMoney(results.totalSavings)}/month vs 8h`
                                    : `8h (Continental) is ${formatMoney(Math.abs(results.totalSavings))}/month cheaper`
                                }
                            </h3>
                        </div>
                        <p className="text-sm text-slate-300">
                            {results.totalSavings > 0
                                ? 'The 4on/4off compressed schedule eliminates overtime entirely, requires fewer teams, and provides better work-life balance with 4 consecutive days off. This is the industry-standard model for 24/7 data center operations.'
                                : 'The Continental 8h pattern distributes work across 4 teams with shorter daily exposure, which may be preferred for certain regulatory environments.'
                            }
                        </p>
                    </div>

                    {/* Side-by-Side Table */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800">
                            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-cyan-400" />
                                Shift Model Comparison (24/7 Staff Only)
                            </h3>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-slate-950/50 text-slate-400 uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-3 text-left">Metric</th>
                                    <th className="px-6 py-3 text-center">8h (Continental)</th>
                                    <th className="px-6 py-3 text-center">12h (4on/4off)</th>
                                    <th className="px-6 py-3 text-center">Difference</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {[
                                    { label: 'Teams Required', v8: results.shiftComparisons[0]?.comparison.model8h.schedule.teamsRequired || 4, v12: results.shiftComparisons[0]?.comparison.model12h.schedule.teamsRequired || 2, fmt: (v: number) => `${v} teams` },
                                    { label: 'Schedule Pattern', v8: '2-2-2-2', v12: '4on/4off', fmt: (v: any) => v },
                                    {
                                        label: 'Weekly Hours/Person',
                                        v8: results.shiftComparisons[0]?.comparison.model8h.metrics.weeklyHoursScheduled || 43.5,
                                        v12: results.shiftComparisons[0]?.comparison.model12h.metrics.weeklyHoursScheduled || 42,
                                        fmt: (v: number) => `${v}h`
                                    },
                                    {
                                        label: 'Overtime Hours/Person',
                                        v8: results.shiftComparisons[0]?.comparison.model8h.metrics.overtimeHoursPerPerson || 1.5,
                                        v12: results.shiftComparisons[0]?.comparison.model12h.metrics.overtimeHoursPerPerson || 0,
                                        fmt: (v: number) => v === 0 ? '✓ ZERO' : `${v}h`
                                    },
                                    { label: 'Total Monthly Cost (Shift Staff)', v8: results.total8hCost, v12: results.total12hCost, fmt: (v: number) => formatMoney(v) },
                                ].map(row => (
                                    <tr key={row.label} className="hover:bg-slate-800/30">
                                        <td className="px-6 py-3 text-slate-300 font-medium">{row.label}</td>
                                        <td className="px-6 py-3 text-center font-mono text-slate-400">{typeof row.fmt === 'function' ? (row.fmt as any)(row.v8) : row.v8}</td>
                                        <td className="px-6 py-3 text-center font-mono text-cyan-400">{typeof row.fmt === 'function' ? (row.fmt as any)(row.v12) : row.v12}</td>
                                        <td className="px-6 py-3 text-center font-mono">
                                            {typeof row.v8 === 'number' && typeof row.v12 === 'number'
                                                ? <span className={row.v12 < row.v8 ? 'text-emerald-400' : row.v12 > row.v8 ? 'text-red-400' : 'text-slate-500'}>
                                                    {row.v12 < row.v8 ? `↓ ${(row.fmt as any)(row.v8 - row.v12)}` : row.v12 > row.v8 ? `↑ ${(row.fmt as any)(row.v12 - row.v8)}` : '—'}
                                                </span>
                                                : <span className="text-slate-500">—</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Per-Role Breakdown */}
                    {results.shiftComparisons.map(comp => (
                        <div key={comp.label} className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-5">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{comp.label}</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="p-3 bg-white dark:bg-slate-950/50 rounded-lg">
                                    <div className="text-xs text-slate-600 dark:text-slate-500 uppercase mb-1">8h Continental</div>
                                    <div className="text-lg font-mono text-slate-900 dark:text-white">{formatMoney(comp.comparison.model8h.monthlyCost)}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{comp.comparison.model8h.headcount} FTEs, {comp.comparison.model8h.metrics.overtimeHoursPerPerson}h OT/wk</div>
                                </div>
                                <div className="p-3 bg-cyan-50 dark:bg-cyan-950/20 rounded-lg border border-cyan-200 dark:border-cyan-900/30">
                                    <div className="text-xs text-slate-600 dark:text-slate-500 uppercase mb-1">12h 4on/4off</div>
                                    <div className="text-lg font-mono text-cyan-600 dark:text-cyan-400">{formatMoney(comp.comparison.model12h.monthlyCost)}</div>
                                    <div className="text-xs text-emerald-600 dark:text-emerald-400">{comp.comparison.model12h.headcount} FTEs, Zero OT</div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{comp.comparison.recommendation}</p>
                        </div>
                    ))}
                </div>
            )} {/* End Comparison Tab */}

            {activeTab === 'org' && (
                <OrgChart staffing={results.staffingResults} countryName={selectedCountry.name} />
            )} {/* End Org Tab */}

            {activeTab === 'roster' && (
                <RosterVisualizer roster={results.roster} year={2025} shiftModel={inputs.shiftModel as '8h' | '12h'} staffingResults={results.staffingResults} />
            )} {/* End Roster Tab */}

            {activeTab === 'waterfall' && (
                <div className="h-[600px]">
                    <CostWaterfall staffing={results.staffingResults} currency={'USD'} />
                </div>
            )} {/* End Waterfall Tab */}

            {activeTab === 'workorders' && (
                <WorkOrderView />
            )} {/* End Work Orders Tab */}
        </div>
    );
}
