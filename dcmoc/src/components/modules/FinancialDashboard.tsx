'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { calculateFinancials, defaultOccupancyRamp, FinancialResult } from '@/modules/analytics/FinancialEngine';
import { calculateRevenue, defaultRevenueOccupancy, RevenueResult } from '@/modules/analytics/RevenueEngine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Clock, Percent, BarChart3, ArrowUpRight, ArrowDownRight, Calculator, Receipt, Repeat, HandCoins, FileText } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine,
    ComposedChart, Bar, Line, Legend
} from 'recharts';
import { generateFinancialPDF } from '@/modules/reporting/PdfGenerator';
import { ExportPDFButton } from '@/components/ui/ExportPDFButton';
import html2canvas from 'html2canvas';

const fmt = (n: number, dec = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: dec }).format(n);
const fmtMoney = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
};

// ─── Editable Cell Component ─────────────────────────────────
// Shows calculated value but allows user override. Yellow border = edited
const EditableCell = ({ value, onChange, className = '' }: {
    value: number;
    onChange: (v: number) => void;
    className?: string;
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [edited, setEdited] = useState(false);
    const [localValue, setLocalValue] = useState('');

    const startEdit = () => {
        setIsEditing(true);
        setLocalValue(Math.round(value).toString());
    };

    const commitEdit = () => {
        setIsEditing(false);
        const parsed = Number(localValue);
        if (!isNaN(parsed) && parsed !== Math.round(value)) {
            onChange(parsed);
            setEdited(true);
        }
    };

    if (isEditing) {
        return (
            <input
                type="number"
                className="w-20 p-0.5 text-xs text-right text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-cyan-400 dark:border-cyan-500 rounded outline-none"
                value={localValue}
                onChange={e => setLocalValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => e.key === 'Enter' && commitEdit()}
                autoFocus
            />
        );
    }

    return (
        <span
            className={`cursor-pointer hover:underline hover:decoration-dotted ${edited ? 'ring-1 ring-amber-500/50 rounded px-1' : ''} ${className}`}
            onClick={startEdit}
            title="Click to override"
        >
            {fmtMoney(value)}
        </span>
    );
};

const FinancialDashboard = () => {
    const { selectedCountry, inputs } = useSimulationStore();
    const capexStore = useCapexStore();
    const capexResults = capexStore.results;
    const [isExporting, setIsExporting] = useState(false);

    // ─── Combined Financial + Revenue Inputs ────────────
    const [finInputs, setFinInputs] = useState({
        revenuePerKwMonth: 150,
        discountRate: 0.10,
        projectLifeYears: 10,
        escalationRate: 0.03,
        opexEscalation: 0.035,
        taxRate: 0.25,
        depreciationYears: 15,
    });

    const [revInputs, setRevInputs] = useState({
        nrcPerKw: 250,
        nrcCustomFitout: 50000,
        nrcCrossConnect: 15000,
        mrcPerKwMonth: 150,
        mrcEscalation: 3,
        mrcCrossConnectMonthly: 5000,
        contractYears: 10,
        takeOrPayPct: 70,
    });

    // Year-level overrides for the combined table
    const [yearOverrides, setYearOverrides] = useState<Record<number, Record<string, number>>>({});

    const handleChange = (key: string, value: number) => {
        setFinInputs(prev => ({ ...prev, [key]: value }));
    };

    const handleRevChange = (key: string, value: number) => {
        setRevInputs(prev => ({ ...prev, [key]: value }));
    };

    const setYearOverride = useCallback((year: number, field: string, value: number) => {
        setYearOverrides(prev => ({
            ...prev,
            [year]: { ...(prev[year] || {}), [field]: value },
        }));
    }, []);

    // Annual OPEX from sim inputs
    const annualOpex = useMemo(() => {
        if (!selectedCountry) return 0;
        const labor = selectedCountry.labor;
        const staffCost = (
            inputs.headcount_ShiftLead * labor.baseSalary_ShiftLead +
            inputs.headcount_Engineer * labor.baseSalary_Engineer +
            inputs.headcount_Technician * labor.baseSalary_Technician +
            inputs.headcount_Admin * labor.baseSalary_Admin +
            inputs.headcount_Janitor * labor.baseSalary_Janitor
        ) * 12;
        const energyCost = inputs.itLoad * 1.4 * 8760 * 0.10 / 1000;
        const maintenanceCost = inputs.itLoad * 50;
        return staffCost + energyCost + maintenanceCost;
    }, [selectedCountry, inputs]);

    // Financial projection
    const result: FinancialResult | null = useMemo(() => {
        if (!capexResults) return null;
        const occupancyRamp = defaultOccupancyRamp(finInputs.projectLifeYears);
        return calculateFinancials({
            totalCapex: capexResults.total,
            annualOpex,
            revenuePerKwMonth: finInputs.revenuePerKwMonth,
            itLoadKw: inputs.itLoad,
            discountRate: finInputs.discountRate,
            projectLifeYears: finInputs.projectLifeYears,
            escalationRate: finInputs.escalationRate,
            opexEscalation: finInputs.opexEscalation,
            occupancyRamp,
            taxRate: finInputs.taxRate,
            depreciationYears: finInputs.depreciationYears,
        });
    }, [capexResults, annualOpex, inputs.itLoad, finInputs]);

    // Revenue model
    const revResult: RevenueResult | null = useMemo(() => {
        const effectiveItLoad = capexStore.inputs.itLoad || inputs.itLoad || 1000;
        const years = revInputs.contractYears;
        return calculateRevenue({
            itLoadKw: effectiveItLoad,
            nrcPerKw: revInputs.nrcPerKw,
            nrcCustomFitout: revInputs.nrcCustomFitout,
            nrcCrossConnect: revInputs.nrcCrossConnect,
            mrcPerKwMonth: revInputs.mrcPerKwMonth,
            mrcEscalation: revInputs.mrcEscalation / 100,
            mrcCrossConnectMonthly: revInputs.mrcCrossConnectMonthly,
            contractYears: years,
            takeOrPayPct: revInputs.takeOrPayPct / 100,
            occupancyRamp: defaultRevenueOccupancy(years),
        });
    }, [revInputs, inputs.itLoad, capexStore.inputs.itLoad]);

    if (!result || !capexResults || !selectedCountry) {
        return <div className="p-8 text-center text-slate-500">Configure CAPEX Engine first to view financial analysis.</div>;
    }

    // Chart data
    const chartData = result.cashflows.map(cf => ({
        year: `Y${cf.year}`,
        revenue: cf.revenue,
        opex: -cf.opex,
        cumCashflow: cf.cumulativeCashflow,
        cumDiscounted: cf.cumulativeDiscountedCashflow,
    }));

    // Shared input style
    const inpCls = "w-full p-1.5 text-sm text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded outline-none focus:ring-1 focus:ring-cyan-500";

    return (
        <div className="flex gap-6">
            {/* ═════════════════════════════════════════════════
                LEFT SIDEBAR — Combined Financial + Revenue Inputs
               ═════════════════════════════════════════════════ */}
            <div className="w-[340px] flex-shrink-0 space-y-4 overflow-y-auto max-h-[calc(100vh-6rem)] pb-6">
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                            Financial &amp; Revenue Parameters
                        </CardTitle>
                        <ExportPDFButton
                            isGenerating={isExporting}
                            onExport={async () => {
                                if (!selectedCountry || !revResult) return;
                                setIsExporting(true);

                                // Simulate tiny delay to ensure chart rendering
                                await new Promise(r => setTimeout(r, 400));

                                let chartImages: { cashflow?: string; waterfall?: string; mrc?: string } = {};

                                try {
                                    const opts = { scale: 2, backgroundColor: '#ffffff', useCORS: true, allowTaint: true };

                                    const cashflowEl = document.getElementById('financial-cashflow-chart');
                                    if (cashflowEl) {
                                        const canvas = await html2canvas(cashflowEl, opts);
                                        chartImages.cashflow = canvas.toDataURL('image/png');
                                    }
                                    const waterfallEl = document.getElementById('financial-waterfall-chart');
                                    if (waterfallEl) {
                                        const canvas = await html2canvas(waterfallEl, opts);
                                        chartImages.waterfall = canvas.toDataURL('image/png');
                                    }
                                    const mrcEl = document.getElementById('financial-mrc-chart');
                                    if (mrcEl) {
                                        const canvas = await html2canvas(mrcEl, opts);
                                        chartImages.mrc = canvas.toDataURL('image/png');
                                    }
                                } catch (e) {
                                    console.warn('Failed to capture charts', e);
                                }

                                try {
                                    await generateFinancialPDF(
                                        selectedCountry,
                                        result,
                                        revResult,
                                        finInputs,
                                        revInputs,
                                        capexResults.total,
                                        annualOpex,
                                        inputs.itLoad,
                                        chartImages
                                    );
                                } catch (error) {
                                    console.error('Error generating Financial PDF:', error);
                                } finally {
                                    setIsExporting(false);
                                }
                            }}
                            className="px-2 py-1 text-[10px]"
                            label="PDF"
                        />
                    </CardHeader>
                    <CardContent className="space-y-4">

                        {/* ── Financial Section ───────────── */}
                        <div className="text-[10px] uppercase text-indigo-600 dark:text-indigo-400 font-semibold tracking-wider border-b border-indigo-200 dark:border-indigo-800/40 pb-1">
                            Financial Analysis
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Revenue per kW/month ($)</label>
                            <input type="number" className={inpCls}
                                value={finInputs.revenuePerKwMonth}
                                onChange={e => handleChange('revenuePerKwMonth', Number(e.target.value))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Discount Rate (%)</label>
                                <input type="number" className={inpCls}
                                    value={(finInputs.discountRate * 100).toFixed(0)}
                                    onChange={e => handleChange('discountRate', Number(e.target.value) / 100)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Project Life (yrs)</label>
                                <input type="number" className={inpCls}
                                    value={finInputs.projectLifeYears}
                                    onChange={e => handleChange('projectLifeYears', Number(e.target.value))}
                                    min={5} max={25} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Rev. Escalation (%)</label>
                                <input type="number" className={inpCls}
                                    value={(finInputs.escalationRate * 100).toFixed(0)}
                                    onChange={e => handleChange('escalationRate', Number(e.target.value) / 100)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">OPEX Escalation (%)</label>
                                <input type="number" className={inpCls}
                                    value={(finInputs.opexEscalation * 100).toFixed(1)}
                                    onChange={e => handleChange('opexEscalation', Number(e.target.value) / 100)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Tax Rate (%)</label>
                                <input type="number" className={inpCls}
                                    value={(finInputs.taxRate * 100).toFixed(0)}
                                    onChange={e => handleChange('taxRate', Number(e.target.value) / 100)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Depreciation (yrs)</label>
                                <input type="number" className={inpCls}
                                    value={finInputs.depreciationYears}
                                    onChange={e => handleChange('depreciationYears', Number(e.target.value))}
                                    min={5} max={25} />
                            </div>
                        </div>

                        {/* ── Divider ─────────────────────── */}
                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-cyan-200 dark:border-cyan-800/30" /></div>
                        </div>

                        {/* ── Revenue / NRC Section ────────── */}
                        <div className="text-[10px] uppercase text-cyan-600 dark:text-cyan-400 font-semibold tracking-wider border-b border-cyan-200 dark:border-cyan-800/40 pb-1">
                            NRC (Non-Recurring Charges)
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-600 dark:text-slate-500">Setup Fee ($/kW)</label>
                                <input type="number" className={inpCls}
                                    value={revInputs.nrcPerKw} onChange={e => handleRevChange('nrcPerKw', Number(e.target.value))} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-600 dark:text-slate-500">X-Connect Setup ($)</label>
                                <input type="number" className={inpCls}
                                    value={revInputs.nrcCrossConnect} onChange={e => handleRevChange('nrcCrossConnect', Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-600 dark:text-slate-500">Custom Fit-out ($)</label>
                            <input type="number" className={inpCls}
                                value={revInputs.nrcCustomFitout} onChange={e => handleRevChange('nrcCustomFitout', Number(e.target.value))} />
                        </div>

                        {/* ── MRC Section ──────────────────── */}
                        <div className="text-[10px] uppercase text-emerald-600 dark:text-emerald-400 font-semibold tracking-wider border-b border-emerald-200 dark:border-emerald-800/40 pb-1">
                            MRC (Monthly Recurring)
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-600 dark:text-slate-500">MRC $/kW/mo</label>
                                <input type="number" className={inpCls}
                                    value={revInputs.mrcPerKwMonth} onChange={e => handleRevChange('mrcPerKwMonth', Number(e.target.value))} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-600 dark:text-slate-500">Escalation (%/yr)</label>
                                <input type="number" className={inpCls}
                                    value={revInputs.mrcEscalation} onChange={e => handleRevChange('mrcEscalation', Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-600 dark:text-slate-500">X-Connect MRC ($/mo)</label>
                            <input type="number" className={inpCls}
                                value={revInputs.mrcCrossConnectMonthly} onChange={e => handleRevChange('mrcCrossConnectMonthly', Number(e.target.value))} />
                        </div>

                        {/* ── Contract Terms ───────────────── */}
                        <div className="text-[10px] uppercase text-amber-600 dark:text-amber-400 font-semibold tracking-wider border-b border-amber-200 dark:border-amber-800/40 pb-1">
                            Contract Terms
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-600 dark:text-slate-500">Lease Term (yrs)</label>
                                <input type="number" className={inpCls}
                                    value={revInputs.contractYears} onChange={e => handleRevChange('contractYears', Number(e.target.value))} min={3} max={25} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-600 dark:text-slate-500">Take-or-Pay (%)</label>
                                <input type="number" className={inpCls}
                                    value={revInputs.takeOrPayPct} onChange={e => handleRevChange('takeOrPayPct', Number(e.target.value))} min={0} max={100} />
                            </div>
                        </div>
                        <div className="p-2 bg-cyan-50 dark:bg-cyan-950/30 rounded border border-cyan-200 dark:border-cyan-900/40">
                            <div className="text-[9px] text-cyan-700 dark:text-cyan-400 uppercase mb-1">Take-or-Pay Summary</div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-400">
                                Min {revInputs.takeOrPayPct}% of {capexStore.inputs.itLoad || inputs.itLoad || 1000}kW = <span className="text-slate-900 dark:text-white font-medium">{Math.round((revInputs.takeOrPayPct / 100) * (capexStore.inputs.itLoad || inputs.itLoad || 1000))} kW</span> billed regardless of usage
                            </div>
                        </div>

                        {/* ── Quick Summary ────────────────── */}
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-600 dark:text-slate-400">CAPEX Investment</span>
                                <span className="text-slate-900 dark:text-white font-medium">{fmtMoney(capexResults.total)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-600 dark:text-slate-400">Annual OPEX (est.)</span>
                                <span className="text-slate-900 dark:text-white font-medium">{fmtMoney(annualOpex)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-600 dark:text-slate-400">Annual Revenue (100%)</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmtMoney(finInputs.revenuePerKwMonth * 12 * inputs.itLoad)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-600 dark:text-slate-400">Break-even Occupancy</span>
                                <span className="text-amber-600 dark:text-amber-400 font-medium">{result.breakEvenOccupancy}%</span>
                            </div>
                            {revResult && (
                                <>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-600 dark:text-slate-400">Total NRC</span>
                                        <span className="text-cyan-600 dark:text-cyan-400 font-medium">{fmtMoney(revResult.totalNRC)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-600 dark:text-slate-400">TCV ({revInputs.contractYears}yr)</span>
                                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">{fmtMoney(revResult.contractValue)}</span>
                                    </div>
                                </>
                            )}
                        </div>

                    </CardContent>
                </Card>
            </div>

            {/* ═════════════════════════════════════════════════
                RIGHT — Results, Charts, Combined Table
               ═════════════════════════════════════════════════ */}
            <div className="flex-1 space-y-4 overflow-y-auto pb-10">

                {/* ── Financial KPIs ────────────────── */}
                <div className="grid grid-cols-4 gap-3">
                    <Card className={`border shadow-sm dark:shadow-none ${result.npv >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50'}`}>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-1.5 mb-1">
                                <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">NPV</span>
                            </div>
                            <div className={`text-2xl font-bold ${result.npv >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {fmtMoney(result.npv)}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">@ {(finInputs.discountRate * 100).toFixed(0)}% discount rate</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-1.5 mb-1">
                                <TrendingUp className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">IRR</span>
                            </div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                {result.irr.toFixed(1)}%
                                {result.irr > finInputs.discountRate * 100
                                    ? <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    : <ArrowDownRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                                }
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                {result.irr > finInputs.discountRate * 100 ? 'Exceeds hurdle rate' : 'Below hurdle rate'}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Payback</span>
                            </div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">{result.paybackPeriodYears} <span className="text-sm text-slate-500 dark:text-slate-400">yrs</span></div>
                            <div className="text-xs text-slate-500 mt-1">Discounted: {result.discountedPaybackYears} yrs</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Percent className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">ROI</span>
                            </div>
                            <div className={`text-2xl font-bold ${result.roiPercent > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {result.roiPercent.toFixed(0)}%
                            </div>
                            <div className="text-xs text-slate-500 mt-1">PI: {result.profitabilityIndex.toFixed(2)}x</div>
                        </CardContent>
                    </Card>
                </div>

                {/* ── Revenue KPIs ──────────────────── */}
                {revResult && (
                    <div className="grid grid-cols-4 gap-3">
                        <Card className="bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800/40 shadow-sm dark:shadow-none">
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Receipt className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Total NRC</span>
                                </div>
                                <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{fmtMoney(revResult.totalNRC)}</div>
                                <div className="text-xs text-slate-500 mt-1">One-time setup fees</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 shadow-sm dark:shadow-none">
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Repeat className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Lifetime MRC</span>
                                </div>
                                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtMoney(revResult.totalMRC_lifetime)}</div>
                                <div className="text-xs text-slate-500 mt-1">Over {revInputs.contractYears} years</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/40 shadow-sm dark:shadow-none">
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">TCV</span>
                                </div>
                                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{fmtMoney(revResult.contractValue)}</div>
                                <div className="text-xs text-slate-500 mt-1">Total Contract Value</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 shadow-sm dark:shadow-none">
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Effective $/kW/mo</span>
                                </div>
                                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">${revResult.effectiveRate.toFixed(0)}</div>
                                <div className="text-xs text-slate-500 mt-1">Blended rate (NRC+MRC)</div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ── Cumulative Cashflow Chart ─────── */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                            Cumulative Free Cashflow
                        </CardTitle>
                    </CardHeader>
                    <CardContent id="financial-cashflow-chart" className="p-4 bg-white dark:bg-slate-800" style={isExporting ? { width: '800px', height: '320px' } : undefined}>
                        <ResponsiveContainer width="100%" height={isExporting ? 320 : 280}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="cashflowGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="discountedGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
                                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v: number) => fmtMoney(v)} />
                                <RTooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                    labelStyle={{ color: '#e2e8f0' }}
                                    formatter={((value: number, name: string) => [fmtMoney(value), name === 'cumCashflow' ? 'Cumulative CF' : 'Discounted CF']) as any}
                                />
                                <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                                <Area type="monotone" dataKey="cumCashflow" stroke="#10b981" fill="url(#cashflowGrad)" strokeWidth={2} />
                                <Area type="monotone" dataKey="cumDiscounted" stroke="#6366f1" fill="url(#discountedGrad)" strokeWidth={2} strokeDasharray="4 4" />
                            </AreaChart>
                        </ResponsiveContainer>
                        <div className="flex items-center justify-center gap-6 mt-2 text-xs text-slate-500">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-emerald-500 rounded" /><span>Cumulative Cashflow</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-indigo-500 rounded border-dashed" /><span>Discounted Cashflow</span></div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Revenue Waterfall Chart ────────── */}
                {revResult && (
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                                Revenue Waterfall — NRC + MRC Breakdown
                            </CardTitle>
                        </CardHeader>
                        <CardContent id="financial-waterfall-chart" className="p-4 bg-white dark:bg-slate-800" style={isExporting ? { width: '800px', height: '340px' } : undefined}>
                            <ResponsiveContainer width="100%" height={isExporting ? 340 : 300}>
                                <ComposedChart data={revResult.yearDetails.map(yd => ({
                                    year: `Y${yd.year}`,
                                    nrc: yd.nrc,
                                    mrc: yd.mrcAnnual,
                                    crossConnect: yd.crossConnectAnnual,
                                    cumRevenue: yd.cumulativeRevenue,
                                }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
                                    <YAxis yAxisId="left" stroke="#64748b" fontSize={11} tickFormatter={(v: number) => fmtMoney(v)} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={11} tickFormatter={(v: number) => fmtMoney(v)} />
                                    <RTooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                        labelStyle={{ color: '#e2e8f0' }}
                                        formatter={((value: number, name: string) => [
                                            fmtMoney(value),
                                            name === 'nrc' ? 'NRC (One-Time)' :
                                                name === 'mrc' ? 'MRC (Power)' :
                                                    name === 'crossConnect' ? 'Cross-Connect' :
                                                        'Cumulative Revenue'
                                        ]) as any}
                                    />
                                    <Legend formatter={(value: string) =>
                                        value === 'nrc' ? 'NRC (One-Time)' :
                                            value === 'mrc' ? 'MRC (Power)' :
                                                value === 'crossConnect' ? 'Cross-Connect' :
                                                    'Cumulative Revenue'
                                    } />
                                    <Bar yAxisId="left" dataKey="nrc" stackId="rev" fill="#06b6d4" radius={[0, 0, 0, 0]} />
                                    <Bar yAxisId="left" dataKey="mrc" stackId="rev" fill="#10b981" radius={[0, 0, 0, 0]} />
                                    <Bar yAxisId="left" dataKey="crossConnect" stackId="rev" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                    <Line yAxisId="right" type="monotone" dataKey="cumRevenue" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {/* ── MRC Growth Trajectory ──────────── */}
                {revResult && (
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                MRC Growth Trajectory with Take-or-Pay Floor
                            </CardTitle>
                        </CardHeader>
                        <CardContent id="financial-mrc-chart" className="p-4 bg-white dark:bg-slate-800" style={isExporting ? { width: '800px', height: '300px' } : undefined}>
                            <ResponsiveContainer width="100%" height={isExporting ? 300 : 260}>
                                <AreaChart data={revResult.yearDetails.map(yd => ({
                                    year: `Y${yd.year}`,
                                    mrcMonthly: yd.mrcMonthly,
                                }))}>
                                    <defs>
                                        <linearGradient id="mrcGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
                                    <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v: number) => fmtMoney(v)} />
                                    <RTooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                        labelStyle={{ color: '#e2e8f0' }}
                                        formatter={((value: number, name: string) => [
                                            fmtMoney(value) + '/mo',
                                            'Monthly MRC'
                                        ]) as any}
                                    />
                                    <Area type="monotone" dataKey="mrcMonthly" stroke="#10b981" fill="url(#mrcGrowthGrad)" strokeWidth={2} />
                                    <ReferenceLine y={(revInputs.takeOrPayPct / 100) * (capexStore.inputs.itLoad || inputs.itLoad || 1000) * revInputs.mrcPerKwMonth} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: 'Take-or-Pay Floor', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                            <div className="flex items-center justify-center gap-6 mt-2 text-xs text-slate-500">
                                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-emerald-500 rounded" /><span>Monthly MRC</span></div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-amber-500 rounded border-dashed" /><span>Take-or-Pay Floor</span></div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* ═══════════════════════════════════════
                    COMBINED TABLE: Financial + Revenue
                    Calculated values are editable (click to override)
                   ═══════════════════════════════════════ */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                            Year-by-Year Projection &amp; Revenue
                            <span className="ml-auto text-[9px] text-slate-500 font-normal">Click any value to override</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    {/* Group headers */}
                                    <tr className="border-b border-slate-200 dark:border-slate-600">
                                        <th className="text-left py-1 text-slate-600 dark:text-slate-500 font-normal" rowSpan={2}>Year</th>
                                        <th className="text-center py-1 text-indigo-600 dark:text-indigo-400 font-semibold text-[10px] uppercase tracking-wider" colSpan={4} style={{ borderLeft: '2px solid #334155' }}>
                                            Financial Projection
                                        </th>
                                        <th className="text-center py-1 text-cyan-600 dark:text-cyan-400 font-semibold text-[10px] uppercase tracking-wider" colSpan={5} style={{ borderLeft: '2px solid #334155' }}>
                                            Revenue Model (NRC + MRC)
                                        </th>
                                        <th className="text-center py-1 text-amber-600 dark:text-amber-400 font-semibold text-[10px] uppercase tracking-wider" colSpan={2} style={{ borderLeft: '2px solid #334155' }}>
                                            Summary
                                        </th>
                                    </tr>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        {/* Financial columns */}
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1" style={{ borderLeft: '2px solid #334155' }}>Revenue</th>
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1">OPEX</th>
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1">EBITDA</th>
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1">Net Income</th>
                                        {/* Revenue columns */}
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1" style={{ borderLeft: '2px solid #334155' }}>Occ%</th>
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1">Billed kW</th>
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1">NRC</th>
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1">MRC/mo</th>
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1">MRC Yr</th>
                                        {/* Summary */}
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1" style={{ borderLeft: '2px solid #334155' }}>Total Rev</th>
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1">Cum. CF</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Y0 Row — CAPEX Investment */}
                                    <tr className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-100 dark:bg-slate-800/30">
                                        <td className="py-2 text-slate-800 dark:text-slate-300 font-medium">Y0</td>
                                        <td className="text-right text-slate-500 px-1" style={{ borderLeft: '2px solid #1e293b' }}>—</td>
                                        <td className="text-right text-slate-500 px-1">—</td>
                                        <td className="text-right text-slate-500 px-1">—</td>
                                        <td className="text-right text-red-500 dark:text-red-400 font-medium px-1">-{fmtMoney(capexResults.total)}</td>
                                        <td className="text-right text-slate-500 px-1" style={{ borderLeft: '2px solid #1e293b' }} colSpan={5}>—</td>
                                        <td className="text-right text-red-500 dark:text-red-400 font-medium px-1" style={{ borderLeft: '2px solid #1e293b' }}>—</td>
                                        <td className="text-right text-red-500 dark:text-red-400 font-medium px-1">-{fmtMoney(capexResults.total)}</td>
                                    </tr>
                                    {/* Data rows */}
                                    {result.cashflows.map((cf, idx) => {
                                        const yr = cf.year;
                                        const revYr = revResult?.yearDetails[idx];
                                        const overrides = yearOverrides[yr] || {};

                                        // Use override if available, otherwise calculated
                                        const revenue = overrides.revenue ?? cf.revenue;
                                        const opex = overrides.opex ?? cf.opex;
                                        const ebitda = revenue - opex;
                                        const netIncome = overrides.netIncome ?? cf.netIncome;
                                        const mrcMonthly = overrides.mrcMonthly ?? (revYr?.mrcMonthly ?? 0);
                                        const mrcAnnual = overrides.mrcAnnual ?? (revYr?.mrcAnnual ?? 0);

                                        // Apply zebra striping manually for light mode for better legibility
                                        const rowBg = yr % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-slate-50 dark:bg-transparent";

                                        return (
                                            <tr key={yr} className={`border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700/20 transition-colors ${rowBg}`}>
                                                <td className="py-2 text-slate-800 dark:text-slate-300">Y{yr}</td>
                                                {/* Financial */}
                                                <td className="text-right text-emerald-600 dark:text-emerald-400 px-1" style={{ borderLeft: '2px solid #1e293b' }}>
                                                    <EditableCell value={revenue} onChange={v => setYearOverride(yr, 'revenue', v)} />
                                                </td>
                                                <td className="text-right text-red-500 dark:text-red-400 px-1">
                                                    <EditableCell value={opex} onChange={v => setYearOverride(yr, 'opex', v)} />
                                                </td>
                                                <td className="text-right text-slate-900 dark:text-white px-1">{fmtMoney(ebitda)}</td>
                                                <td className={`text-right font-medium px-1 ${netIncome >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                                    <EditableCell value={netIncome} onChange={v => setYearOverride(yr, 'netIncome', v)} />
                                                </td>
                                                {/* Revenue */}
                                                <td className="text-right text-slate-700 dark:text-slate-300 px-1" style={{ borderLeft: '2px solid #1e293b' }}>
                                                    {revYr ? `${(revYr.occupancy * 100).toFixed(0)}%` : '—'}
                                                </td>
                                                <td className="text-right text-slate-900 dark:text-white px-1">
                                                    {revYr ? fmt(revYr.billedKw) : '—'}
                                                </td>
                                                <td className={`text-right px-1 ${revYr && revYr.nrc > 0 ? 'text-cyan-600 dark:text-cyan-400 font-medium' : 'text-slate-400 dark:text-slate-600'}`}>
                                                    {revYr && revYr.nrc > 0 ? fmtMoney(revYr.nrc) : '—'}
                                                </td>
                                                <td className="text-right text-emerald-600 dark:text-emerald-400 px-1">
                                                    {revYr ? <EditableCell value={mrcMonthly} onChange={v => setYearOverride(yr, 'mrcMonthly', v)} /> : '—'}
                                                </td>
                                                <td className="text-right text-emerald-600 dark:text-emerald-400 px-1">
                                                    {revYr ? <EditableCell value={mrcAnnual} onChange={v => setYearOverride(yr, 'mrcAnnual', v)} /> : '—'}
                                                </td>
                                                {/* Summary */}
                                                <td className="text-right text-slate-900 dark:text-white font-medium px-1" style={{ borderLeft: '2px solid #1e293b' }}>
                                                    {revYr ? fmtMoney(revYr.totalRevenue) : fmtMoney(revenue)}
                                                </td>
                                                <td className={`text-right font-medium px-1 ${cf.cumulativeCashflow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                                    {fmtMoney(cf.cumulativeCashflow)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {/* Footer totals */}
                                {revResult && (
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-200 dark:border-slate-600 font-semibold">
                                            <td className="py-2 text-slate-800 dark:text-slate-300">TOTAL</td>
                                            <td className="text-right text-emerald-600 dark:text-emerald-400 px-1" style={{ borderLeft: '2px solid #1e293b' }}>{fmtMoney(result.totalRevenue)}</td>
                                            <td className="text-right text-red-600 dark:text-red-400 px-1">{fmtMoney(result.cashflows.reduce((s, c) => s + c.opex, 0))}</td>
                                            <td className="text-right text-slate-900 dark:text-white px-1">{fmtMoney(result.cashflows.reduce((s, c) => s + c.ebitda, 0))}</td>
                                            <td className="text-right text-emerald-600 dark:text-emerald-400 px-1">{fmtMoney(result.totalProfit)}</td>
                                            <td className="text-right text-slate-600 dark:text-slate-500 px-1" style={{ borderLeft: '2px solid #1e293b' }}>—</td>
                                            <td className="text-right text-slate-600 dark:text-slate-500 px-1">—</td>
                                            <td className="text-right text-cyan-600 dark:text-cyan-400 px-1">{fmtMoney(revResult.totalNRC)}</td>
                                            <td className="text-right text-slate-600 dark:text-slate-500 px-1">—</td>
                                            <td className="text-right text-emerald-600 dark:text-emerald-400 px-1">{fmtMoney(revResult.totalMRC_lifetime)}</td>
                                            <td className="text-right text-slate-900 dark:text-white px-1" style={{ borderLeft: '2px solid #1e293b' }}>{fmtMoney(revResult.totalRevenue_lifetime)}</td>
                                            <td className={`text-right px-1 ${result.cashflows[result.cashflows.length - 1]?.cumulativeCashflow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {fmtMoney(result.cashflows[result.cashflows.length - 1]?.cumulativeCashflow ?? 0)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
};

export default FinancialDashboard;
