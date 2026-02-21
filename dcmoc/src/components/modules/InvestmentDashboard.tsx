'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useEffectiveInputs } from '@/store/useEffectiveInputs';
import { calculateFinancials, defaultOccupancyRamp } from '@/modules/analytics/FinancialEngine';
import { calculateInvestment, InvestmentResult } from '@/modules/analytics/InvestmentEngine';
import { Tooltip } from '@/components/ui/Tooltip';
import {
    Landmark, PieChart as PieChartIcon, TrendingUp, DollarSign, Shield, BarChart3,
    ArrowUpRight, ArrowDownRight, CheckCircle2, XCircle, AlertTriangle, Building
} from 'lucide-react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip,
    LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
    BarChart, Bar, Legend, ComposedChart, Area
} from 'recharts';
import clsx from 'clsx';

const fmt = (n: number, dec = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: dec }).format(n);
const fmtMoney = (n: number) => {
    if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
};
const fmtPct = (n: number, dec = 1) => `${n.toFixed(dec)}%`;

type InvestTab = 'cap' | 'returns' | 'valuation' | 'ipo' | 'readiness' | 'sensitivity';

const InvestmentDashboard = () => {
    const { selectedCountry, inputs } = useSimulationStore();
    const effectiveInputs = useEffectiveInputs();
    const capexStore = useCapexStore();
    const capexResults = capexStore.results;

    const [activeTab, setActiveTab] = useState<InvestTab>('cap');

    // Local configurable inputs
    const [investInputs, setInvestInputs] = useState({
        debtRatio: 0.65,
        debtCostAnnual: 0.05,
        debtTermYears: 12,
        equityCostOfCapital: 0.12,
        exitYear: 7,
        exitEbitdaMultiple: 18,
        terminalCapRate: 0.065,
        controlPremiumPct: 0.25,
        revenuePerKwMonth: 150,
        opexEscalation: 0.035,
        escalationRate: 0.03,
        taxRate: 0.25,
        depreciationYears: 15,
        projectLifeYears: 10,
    });

    const handleChange = (key: string, value: number) => {
        setInvestInputs(prev => ({ ...prev, [key]: value }));
    };

    // Compute annual OPEX
    const annualOpex = useMemo(() => {
        if (!selectedCountry) return 0;
        const labor = selectedCountry.labor;
        const staffCost = (
            effectiveInputs.headcount_ShiftLead * labor.baseSalary_ShiftLead +
            effectiveInputs.headcount_Engineer * labor.baseSalary_Engineer +
            effectiveInputs.headcount_Technician * labor.baseSalary_Technician +
            effectiveInputs.headcount_Admin * labor.baseSalary_Admin +
            effectiveInputs.headcount_Janitor * labor.baseSalary_Janitor
        ) * 12;
        const energyCost = effectiveInputs.itLoad * 1.4 * 8760 * 0.10 / 1000;
        const maintenanceCost = effectiveInputs.itLoad * 50;
        return staffCost + energyCost + maintenanceCost;
    }, [selectedCountry, effectiveInputs]);

    // Financial result (unlevered cashflows)
    const finResult = useMemo(() => {
        if (!capexResults) return null;
        const occupancyRamp = defaultOccupancyRamp(investInputs.projectLifeYears);
        return calculateFinancials({
            totalCapex: capexResults.total,
            annualOpex,
            revenuePerKwMonth: investInputs.revenuePerKwMonth,
            itLoadKw: effectiveInputs.itLoad,
            discountRate: investInputs.equityCostOfCapital,
            projectLifeYears: investInputs.projectLifeYears,
            escalationRate: investInputs.escalationRate,
            opexEscalation: investInputs.opexEscalation,
            occupancyRamp,
            taxRate: investInputs.taxRate,
            depreciationYears: investInputs.depreciationYears,
        });
    }, [capexResults, annualOpex, effectiveInputs.itLoad, investInputs]);

    // Investment result
    const result: InvestmentResult | null = useMemo(() => {
        if (!finResult || !capexResults) return null;
        return calculateInvestment({
            totalCapex: capexResults.total,
            unleveredCashflows: finResult.cashflows,
            itLoadKw: effectiveInputs.itLoad,
            taxRate: investInputs.taxRate,
            debtRatio: investInputs.debtRatio,
            debtCostAnnual: investInputs.debtCostAnnual,
            debtTermYears: investInputs.debtTermYears,
            equityCostOfCapital: investInputs.equityCostOfCapital,
            exitYear: investInputs.exitYear,
            exitEbitdaMultiple: investInputs.exitEbitdaMultiple,
            terminalCapRate: investInputs.terminalCapRate,
            controlPremiumPct: investInputs.controlPremiumPct,
        });
    }, [finResult, capexResults, effectiveInputs.itLoad, investInputs]);

    if (!result || !capexResults || !selectedCountry || !finResult) {
        return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Configure CAPEX Engine first to view investment analysis.</div>;
    }

    const inpCls = "w-full p-1.5 text-sm text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded outline-none focus:ring-1 focus:ring-cyan-500";

    const tabs: { id: InvestTab; label: string }[] = [
        { id: 'cap', label: 'Capitalization' },
        { id: 'returns', label: 'Returns & DSCR' },
        { id: 'valuation', label: 'Valuation' },
        { id: 'ipo', label: 'IPO / Acquisition' },
        { id: 'readiness', label: 'Readiness' },
        { id: 'sensitivity', label: 'Sensitivity' },
    ];

    return (
        <div className="flex gap-6">
            {/* ═══ LEFT SIDEBAR ═══ */}
            <div className="w-[340px] flex-shrink-0 space-y-4 overflow-y-auto max-h-[calc(100vh-6rem)] pb-6">
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4 shadow-sm dark:shadow-none">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300 flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                        Investment Parameters
                    </h3>

                    {/* Capital Structure */}
                    <div className="text-[10px] uppercase text-indigo-600 dark:text-indigo-400 font-semibold tracking-wider border-b border-indigo-200 dark:border-indigo-800/40 pb-1">
                        Capital Structure
                    </div>
                    <div className="space-y-2">
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                Debt Ratio ({(investInputs.debtRatio * 100).toFixed(0)}%) <Tooltip content="Percentage of total CAPEX financed by debt. Higher leverage amplifies returns but increases risk." />
                            </label>
                            <input type="range" min={50} max={80} step={1}
                                className="w-full accent-indigo-500"
                                value={investInputs.debtRatio * 100}
                                onChange={e => handleChange('debtRatio', Number(e.target.value) / 100)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Interest Rate (%)</label>
                                <input type="number" className={inpCls} step={0.5}
                                    value={(investInputs.debtCostAnnual * 100).toFixed(1)}
                                    onChange={e => handleChange('debtCostAnnual', Number(e.target.value) / 100)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Debt Term (yrs)</label>
                                <input type="number" className={inpCls} min={5} max={25}
                                    value={investInputs.debtTermYears}
                                    onChange={e => handleChange('debtTermYears', Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                Equity Cost of Capital (%) <Tooltip content="Required return on equity. Used as discount rate for equity cashflows and in WACC calculation." />
                            </label>
                            <input type="number" className={inpCls} step={0.5}
                                value={(investInputs.equityCostOfCapital * 100).toFixed(1)}
                                onChange={e => handleChange('equityCostOfCapital', Number(e.target.value) / 100)} />
                        </div>
                    </div>

                    {/* Exit Assumptions */}
                    <div className="text-[10px] uppercase text-amber-600 dark:text-amber-400 font-semibold tracking-wider border-b border-amber-200 dark:border-amber-800/40 pb-1 mt-4">
                        Exit Assumptions
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Exit Year</label>
                            <input type="number" className={inpCls} min={3} max={10}
                                value={investInputs.exitYear}
                                onChange={e => handleChange('exitYear', Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Exit EV/EBITDA</label>
                            <input type="number" className={inpCls} min={10} max={30} step={0.5}
                                value={investInputs.exitEbitdaMultiple}
                                onChange={e => handleChange('exitEbitdaMultiple', Number(e.target.value))} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Terminal Cap Rate (%)</label>
                        <input type="number" className={inpCls} step={0.25}
                            value={(investInputs.terminalCapRate * 100).toFixed(1)}
                            onChange={e => handleChange('terminalCapRate', Number(e.target.value) / 100)} />
                    </div>

                    {/* IPO/Acquisition */}
                    <div className="text-[10px] uppercase text-emerald-600 dark:text-emerald-400 font-semibold tracking-wider border-b border-emerald-200 dark:border-emerald-800/40 pb-1 mt-4">
                        IPO / Acquisition
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                            Control Premium ({(investInputs.controlPremiumPct * 100).toFixed(0)}%) <Tooltip content="Premium paid above fair EV for controlling stake. Typical: 20-35%." />
                        </label>
                        <input type="range" min={20} max={35} step={1}
                            className="w-full accent-emerald-500"
                            value={investInputs.controlPremiumPct * 100}
                            onChange={e => handleChange('controlPremiumPct', Number(e.target.value) / 100)} />
                    </div>

                    {/* Quick Summary */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2 mt-4">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400">Total CAPEX</span>
                            <span className="text-slate-900 dark:text-white font-medium">{fmtMoney(capexResults.total)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400">Debt</span>
                            <span className="text-red-600 dark:text-red-400 font-medium">{fmtMoney(result.totalDebt)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400">Equity</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmtMoney(result.totalEquity)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400">WACC</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-medium">{fmtPct(result.wacc * 100)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ RIGHT CONTENT ═══ */}
            <div className="flex-1 space-y-4 overflow-y-auto pb-10">
                {/* Tab Navigation */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                "px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                                activeTab === tab.id
                                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ═══ TAB 1: CAPITALIZATION OVERVIEW ═══ */}
                {activeTab === 'cap' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-4 gap-3">
                            <KPICard label="Total CAPEX" value={fmtMoney(capexResults.total)} icon={<Building className="w-4 h-4" />} color="slate" />
                            <KPICard label="Debt Amount" value={fmtMoney(result.totalDebt)} sub={`${(investInputs.debtRatio * 100).toFixed(0)}% leverage`} icon={<DollarSign className="w-4 h-4" />} color="red" />
                            <KPICard label="Equity Required" value={fmtMoney(result.totalEquity)} sub={`${((1 - investInputs.debtRatio) * 100).toFixed(0)}% equity`} icon={<DollarSign className="w-4 h-4" />} color="emerald" />
                            <KPICard label="WACC" value={fmtPct(result.wacc * 100)} sub="Weighted avg cost" icon={<TrendingUp className="w-4 h-4" />} color="indigo" />
                        </div>

                        {/* Donut Chart */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300 mb-4">Capital Structure</h3>
                            <div className="flex items-center gap-8">
                                <ResponsiveContainer width={200} height={200}>
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Debt', value: result.totalDebt },
                                                { name: 'Equity', value: result.totalEquity },
                                            ]}
                                            cx="50%" cy="50%"
                                            innerRadius={50} outerRadius={80}
                                            dataKey="value"
                                            strokeWidth={2}
                                        >
                                            <Cell fill="#ef4444" />
                                            <Cell fill="#10b981" />
                                        </Pie>
                                        <RTooltip formatter={((value: number) => fmtMoney(value)) as any} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-red-500" />
                                        <span className="text-sm text-slate-600 dark:text-slate-400">Debt: {fmtMoney(result.totalDebt)} ({(investInputs.debtRatio * 100).toFixed(0)}%)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                        <span className="text-sm text-slate-600 dark:text-slate-400">Equity: {fmtMoney(result.totalEquity)} ({((1 - investInputs.debtRatio) * 100).toFixed(0)}%)</span>
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                                        Annual Debt Service: {fmtMoney(result.annualDebtPayment)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Debt Amortization Table */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                            <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300">Debt Amortization Schedule</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-100 dark:bg-slate-900/50 text-slate-500 uppercase font-semibold">
                                            <th className="px-4 py-2 text-left">Year</th>
                                            <th className="px-4 py-2 text-right">Opening Balance</th>
                                            <th className="px-4 py-2 text-right">Payment</th>
                                            <th className="px-4 py-2 text-right">Interest</th>
                                            <th className="px-4 py-2 text-right">Principal</th>
                                            <th className="px-4 py-2 text-right">Closing Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                                        {result.debtSchedule.map(row => (
                                            <tr key={row.year} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                                <td className="px-4 py-2 text-slate-800 dark:text-slate-300 font-mono">Y{row.year}</td>
                                                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmtMoney(row.openingBalance)}</td>
                                                <td className="px-4 py-2 text-right text-slate-900 dark:text-white font-medium">{fmtMoney(row.payment)}</td>
                                                <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">{fmtMoney(row.interest)}</td>
                                                <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{fmtMoney(row.principal)}</td>
                                                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmtMoney(row.closingBalance)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ TAB 2: EQUITY RETURNS & DSCR ═══ */}
                {activeTab === 'returns' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="grid grid-cols-4 gap-3">
                            <KPICard label="Equity IRR" value={fmtPct(result.equityIRR)} sub={result.equityIRR > 15 ? 'Above 15% target' : 'Below 15% target'} icon={<TrendingUp className="w-4 h-4" />} color={result.equityIRR >= 15 ? 'emerald' : 'red'} />
                            <KPICard label="MOIC" value={`${result.moic.toFixed(2)}x`} sub="Multiple on invested capital" icon={<ArrowUpRight className="w-4 h-4" />} color={result.moic >= 2 ? 'emerald' : 'amber'} />
                            <KPICard label="Min DSCR" value={`${result.minDSCR.toFixed(2)}x`} sub={result.minDSCR >= 1.25 ? 'Above 1.25x threshold' : 'Below 1.25x threshold'} icon={<Shield className="w-4 h-4" />} color={result.minDSCR >= 1.25 ? 'emerald' : 'red'} />
                            <KPICard label="Y1 Cash-on-Cash" value={fmtPct(result.year1CashOnCash)} sub="Year 1 levered yield" icon={<DollarSign className="w-4 h-4" />} color={result.year1CashOnCash >= 8 ? 'emerald' : 'amber'} />
                        </div>

                        {/* DSCR Chart */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300 mb-4">Debt Service Coverage Ratio (DSCR)</h3>
                            <ResponsiveContainer width="100%" height={260}>
                                <LineChart data={result.leveredFCFTable.filter(r => r.dscr < 99).map(r => ({
                                    year: `Y${r.year}`,
                                    dscr: r.dscr,
                                }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
                                    <YAxis stroke="#64748b" fontSize={11} domain={[0, 'auto']} />
                                    <RTooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                        formatter={((value: number) => [`${value.toFixed(2)}x`, 'DSCR']) as any}
                                    />
                                    <ReferenceLine y={1.25} stroke="#ef4444" strokeDasharray="6 3" label={{ value: 'Min 1.25x', fill: '#ef4444', fontSize: 10 }} />
                                    <Line type="monotone" dataKey="dscr" stroke="#06b6d4" strokeWidth={2} dot={{ r: 4 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Levered FCF Table */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                            <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300">Levered Free Cashflow</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-100 dark:bg-slate-900/50 text-slate-500 uppercase font-semibold">
                                            <th className="px-4 py-2 text-left">Year</th>
                                            <th className="px-4 py-2 text-right">Unlevered FCF</th>
                                            <th className="px-4 py-2 text-right">Debt Service</th>
                                            <th className="px-4 py-2 text-right">Levered FCF</th>
                                            <th className="px-4 py-2 text-right">Cumulative</th>
                                            <th className="px-4 py-2 text-right">CoC %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                                        {result.leveredFCFTable.map(row => (
                                            <tr key={row.year} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                                <td className="px-4 py-2 text-slate-800 dark:text-slate-300 font-mono">Y{row.year}</td>
                                                <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{fmtMoney(row.unleveredFCF)}</td>
                                                <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">{row.debtService > 0 ? fmtMoney(row.debtService) : '—'}</td>
                                                <td className={clsx("px-4 py-2 text-right font-medium", row.leveredFCF >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                                                    {fmtMoney(row.leveredFCF)}
                                                </td>
                                                <td className={clsx("px-4 py-2 text-right", row.cumulativeLevered >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-500 dark:text-red-400')}>
                                                    {fmtMoney(row.cumulativeLevered)}
                                                </td>
                                                <td className="px-4 py-2 text-right text-cyan-600 dark:text-cyan-400">{fmtPct(row.cashOnCashPct)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ TAB 3: VALUATION DASHBOARD ═══ */}
                {activeTab === 'valuation' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        {/* 3 Valuation Cards */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm dark:shadow-none">
                                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-semibold mb-2">EV/EBITDA Method</div>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.valuation.evEbitda)}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {fmtMoney(result.stabilizedEBITDA)} x {investInputs.exitEbitdaMultiple}x
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm dark:shadow-none">
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold mb-2">Cap Rate Method</div>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.valuation.capRateVal)}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    NOI {fmtMoney(result.stabilizedNOI)} / {fmtPct(investInputs.terminalCapRate * 100)}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm dark:shadow-none">
                                <div className="text-[10px] text-cyan-600 dark:text-cyan-400 uppercase font-semibold mb-2">$/kW Implied</div>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white">${fmt(result.valuation.dollarPerKw)}/kW</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    EV {fmtMoney(result.valuation.evEbitda)} / {fmt(effectiveInputs.itLoad)} kW
                                </div>
                            </div>
                        </div>

                        {/* Valuation Comparison Chart */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300 mb-4">Valuation Comparison</h3>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={[
                                    { method: 'EV/EBITDA', value: result.valuation.evEbitda },
                                    { method: 'Cap Rate', value: result.valuation.capRateVal },
                                    { method: 'Implied ($/kW)', value: result.valuation.perKwVal },
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="method" stroke="#64748b" fontSize={11} />
                                    <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v: number) => fmtMoney(v)} />
                                    <RTooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                        formatter={((value: number) => [fmtMoney(value), 'Enterprise Value']) as any}
                                    />
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                        <Cell fill="#6366f1" />
                                        <Cell fill="#10b981" />
                                        <Cell fill="#06b6d4" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Exit Waterfall */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300 mb-4">Exit Waterfall (Year {investInputs.exitYear})</h3>
                            <div className="grid grid-cols-5 gap-2 text-center">
                                {[
                                    { label: 'Exit EBITDA', value: result.stabilizedEBITDA, color: 'bg-slate-200 dark:bg-slate-700' },
                                    { label: `x ${investInputs.exitEbitdaMultiple}x`, value: result.exitEV, color: 'bg-indigo-100 dark:bg-indigo-950/40' },
                                    { label: 'Enterprise Value', value: result.exitEV, color: 'bg-emerald-100 dark:bg-emerald-950/40' },
                                    { label: '- Remaining Debt', value: -result.exitRemainingDebt, color: 'bg-red-100 dark:bg-red-950/40' },
                                    { label: 'Equity Value', value: result.exitEquityValue, color: 'bg-cyan-100 dark:bg-cyan-950/40' },
                                ].map((item, i) => (
                                    <div key={i} className={`${item.color} rounded-lg p-3 border border-slate-200 dark:border-slate-700`}>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase mb-1">{item.label}</div>
                                        <div className={clsx("text-lg font-bold", item.value >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-600 dark:text-red-400')}>
                                            {fmtMoney(item.value)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ TAB 4: IPO / ACQUISITION PRICING ═══ */}
                {activeTab === 'ipo' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        {/* Pre/Post Money */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300 mb-4">IPO / Acquisition Pricing</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-slate-100 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                    <div className="text-[10px] text-slate-500 uppercase mb-1">Pre-Money (EV)</div>
                                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.valuation.evEbitda)}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">Fair value before premium</div>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase mb-1">Control Premium</div>
                                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">+{(investInputs.controlPremiumPct * 100).toFixed(0)}%</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{fmtMoney(result.valuation.evEbitda * investInputs.controlPremiumPct)}</div>
                                </div>
                                <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
                                    <div className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase mb-1">IPO / Acquisition Price</div>
                                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{fmtMoney(result.ipoPrice)}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">Implied $/kW: ${fmt(result.ipoPrice / effectiveInputs.itLoad)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Acquisition Price Sensitivity */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                            <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300">Acquisition Price Sensitivity</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-100 dark:bg-slate-900/50 text-slate-500 uppercase font-semibold">
                                            <th className="px-4 py-2 text-left">Multiple</th>
                                            <th className="px-4 py-2 text-right">Enterprise Value</th>
                                            <th className="px-4 py-2 text-right">Equity Value</th>
                                            <th className="px-4 py-2 text-right">Implied $/kW</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                                        {result.acquisitionTable.map(row => (
                                            <tr key={row.multiple} className={clsx(
                                                "hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors",
                                                row.multiple === investInputs.exitEbitdaMultiple && "bg-cyan-50 dark:bg-cyan-950/20"
                                            )}>
                                                <td className="px-4 py-2 text-slate-800 dark:text-slate-300 font-mono">{row.multiple}x</td>
                                                <td className="px-4 py-2 text-right text-slate-900 dark:text-white">{fmtMoney(row.enterpriseValue)}</td>
                                                <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400 font-medium">{fmtMoney(row.equityValue)}</td>
                                                <td className="px-4 py-2 text-right text-cyan-600 dark:text-cyan-400">${fmt(row.impliedDollarPerKw)}/kW</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ TAB 5: INVESTMENT READINESS ═══ */}
                {activeTab === 'readiness' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        {/* Overall Score */}
                        <div className={clsx(
                            "border rounded-xl p-6 text-center shadow-sm dark:shadow-none",
                            result.readinessLabel === 'Ready' ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700" :
                            result.readinessLabel === 'Conditional' ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700" :
                            "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700"
                        )}>
                            <div className="text-5xl font-bold text-slate-900 dark:text-white">{result.readinessScore}</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">/ 100</div>
                            <div className={clsx(
                                "text-lg font-bold mt-2",
                                result.readinessLabel === 'Ready' ? "text-emerald-600 dark:text-emerald-400" :
                                result.readinessLabel === 'Conditional' ? "text-amber-600 dark:text-amber-400" :
                                "text-red-600 dark:text-red-400"
                            )}>
                                {result.readinessLabel}
                            </div>
                        </div>

                        {/* Checklist */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-3 shadow-sm dark:shadow-none">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300 mb-3">Investment Readiness Checklist</h3>
                            {result.readinessChecks.map((check, i) => (
                                <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                                    <div className={clsx("flex-shrink-0",
                                        check.pass ? "text-emerald-500" : "text-red-500"
                                    )}>
                                        {check.pass ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-slate-900 dark:text-white">{check.label}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">Target: {check.target}</div>
                                    </div>
                                    <div className={clsx(
                                        "text-sm font-mono font-bold",
                                        check.pass ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                                    )}>
                                        {check.actual}
                                    </div>
                                    <div className="text-xs text-slate-400 w-12 text-right">{check.weight}pts</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ═══ TAB 6: SENSITIVITY ANALYSIS ═══ */}
                {activeTab === 'sensitivity' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300 mb-4">Equity IRR Sensitivity Matrix</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Debt Ratio (rows) x Exit EV/EBITDA Multiple (columns)</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr>
                                            <th className="px-3 py-2 text-left text-slate-500 font-medium">Debt %</th>
                                            {[14, 16, 18, 20, 22].map(m => (
                                                <th key={m} className="px-3 py-2 text-center text-slate-500 font-medium">{m}x</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80].map(dr => (
                                            <tr key={dr} className={dr === investInputs.debtRatio ? 'bg-cyan-50 dark:bg-cyan-950/20' : ''}>
                                                <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300 font-medium">{(dr * 100).toFixed(0)}%</td>
                                                {[14, 16, 18, 20, 22].map(em => {
                                                    const cell = result.sensitivityMatrix.find(c => c.debtRatio === dr && c.exitMultiple === em);
                                                    const irr = cell?.equityIRR ?? 0;
                                                    const bg = irr >= 20 ? 'bg-emerald-200 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300' :
                                                        irr >= 15 ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' :
                                                        irr >= 10 ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' :
                                                        'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400';
                                                    const isActive = dr === investInputs.debtRatio && em === investInputs.exitEbitdaMultiple;
                                                    return (
                                                        <td key={em} className={clsx(
                                                            "px-3 py-2 text-center font-mono font-bold rounded",
                                                            bg,
                                                            isActive && "ring-2 ring-cyan-500"
                                                        )}>
                                                            {fmtPct(irr)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Key Variable Impact */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300 mb-4">Key Variable Impact on Equity IRR</h3>
                            <div className="space-y-3">
                                {[
                                    { label: 'Exit EV/EBITDA Multiple', impact: 'High', color: 'text-red-600 dark:text-red-400', desc: 'Primary driver — 1x change shifts IRR by ~2-3%' },
                                    { label: 'Debt Ratio (Leverage)', impact: 'High', color: 'text-red-600 dark:text-red-400', desc: 'More leverage amplifies returns but increases risk' },
                                    { label: 'Occupancy Ramp Speed', impact: 'Medium', color: 'text-amber-600 dark:text-amber-400', desc: 'Faster ramp improves early cashflows and payback' },
                                    { label: 'Interest Rate', impact: 'Medium', color: 'text-amber-600 dark:text-amber-400', desc: 'Directly affects debt service and DSCR' },
                                    { label: 'Revenue per kW', impact: 'Medium', color: 'text-amber-600 dark:text-amber-400', desc: 'Sets the revenue ceiling for all years' },
                                    { label: 'OPEX Growth', impact: 'Low', color: 'text-emerald-600 dark:text-emerald-400', desc: 'Gradual erosion, limited short-term impact' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-slate-900 dark:text-white">{item.label}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</div>
                                        </div>
                                        <span className={clsx("text-xs font-bold uppercase px-2 py-1 rounded", item.color)}>
                                            {item.impact}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── KPI Card Component ─────────────────────────────────────
function KPICard({ label, value, sub, icon, color }: {
    label: string; value: string; sub?: string; icon: React.ReactNode; color: string;
}) {
    return (
        <div className={`bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm dark:shadow-none`}>
            <div className="flex items-center gap-1.5 mb-1">
                <div className={`text-${color}-600 dark:text-${color}-400`}>{icon}</div>
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">{label}</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
            {sub && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</div>}
        </div>
    );
}

export default InvestmentDashboard;
