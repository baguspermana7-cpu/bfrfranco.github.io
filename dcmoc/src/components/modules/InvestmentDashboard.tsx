'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useEffectiveInputs } from '@/store/useEffectiveInputs';
import { getPUE } from '@/constants/pue';
import { calculateFinancials, defaultOccupancyRamp } from '@/modules/analytics/FinancialEngine';
import { calculateInvestment, InvestmentResult } from '@/modules/analytics/InvestmentEngine';
import { explainThresholdMetric, DecisionLever, ThresholdMetricExplain } from '@/lib/decision-explain';
import { Tooltip } from '@/components/ui/Tooltip';
import { Explain } from '@/components/ui/Explain';
import { explainText } from '@/lib/explain';
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
import { fmt, fmtMoney, fmtPct } from '@/lib/format';
import { DEFAULT_REVENUE_PER_KW_MONTH } from '@/constants/finance';
import { ExportPDFButton } from '@/components/ui/ExportPDFButton';
import { TraceValue } from '@/components/ui/TraceValue';

type InvestTab = 'cap' | 'returns' | 'valuation' | 'ipo' | 'readiness' | 'sensitivity';

/**
 * Navigate to a lever's parameter (owner mandate: klik → parameter).
 * Same-page inputs get scroll + focus + a brief highlight ring; everything
 * else hops to the shell tab where the parameter lives.
 */
const goToLever = (lv: DecisionLever) => {
    if (lv.targetSelector) {
        const el = document.getElementById(lv.targetSelector);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.focus({ preventScroll: true });
            el.classList.add('ring-2', 'ring-cyan-400');
            window.setTimeout(() => el.classList.remove('ring-2', 'ring-cyan-400'), 1600);
            return;
        }
    }
    const { actions } = useSimulationStore.getState();
    actions.setActiveTab(lv.targetTab as Parameters<typeof actions.setActiveTab>[0]);
};

const InvestmentDashboard = () => {
    const { selectedCountry, inputs } = useSimulationStore();
    const effectiveInputs = useEffectiveInputs();
    const capexStore = useCapexStore();
    const capexResults = capexStore.results;

    const [activeTab, setActiveTab] = useState<InvestTab>('cap');
    const [isExporting, setIsExporting] = useState(false);

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
        /* seeded from the sim-store tunable (live SSOT) so this page opens on
         * the same revenue basis as every other surface; user-editable after */
        revenuePerKwMonth: inputs.revenuePerKwMonth ?? DEFAULT_REVENUE_PER_KW_MONTH,
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
        const elecRate = selectedCountry.economy?.electricityRate ?? 0.10;
        const energyCost = effectiveInputs.itLoad * getPUE(effectiveInputs.coolingType ?? 'air') * 8760 * elecRate;
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

    /* ── Owner-mandate decision explains ─────────────────────────────────────
     * Failing DSCR / equity-IRR / payback verdicts carry (1) a computed reason
     * with the live numbers, (2) levers SOLVED by bisection re-running the SAME
     * model chain this page renders from (calculateFinancials →
     * calculateInvestment), (3) click-through to the parameter input. */
    const explains = useMemo(() => {
        if (!capexResults || !selectedCountry || !finResult || !result) return null;
        const inv = investInputs;
        const runModel = (mods: { revMult?: number; debtRatio?: number; exitMultiple?: number } = {}): InvestmentResult => {
            const fin = calculateFinancials({
                totalCapex: capexResults.total,
                annualOpex,
                revenuePerKwMonth: inv.revenuePerKwMonth * (mods.revMult ?? 1),
                itLoadKw: effectiveInputs.itLoad,
                discountRate: inv.equityCostOfCapital,
                projectLifeYears: inv.projectLifeYears,
                escalationRate: inv.escalationRate,
                opexEscalation: inv.opexEscalation,
                occupancyRamp: defaultOccupancyRamp(inv.projectLifeYears),
                taxRate: inv.taxRate,
                depreciationYears: inv.depreciationYears,
            });
            return calculateInvestment({
                totalCapex: capexResults.total,
                unleveredCashflows: fin.cashflows,
                itLoadKw: effectiveInputs.itLoad,
                taxRate: inv.taxRate,
                debtRatio: mods.debtRatio ?? inv.debtRatio,
                debtCostAnnual: inv.debtCostAnnual,
                debtTermYears: inv.debtTermYears,
                equityCostOfCapital: inv.equityCostOfCapital,
                exitYear: inv.exitYear,
                exitEbitdaMultiple: mods.exitMultiple ?? inv.exitEbitdaMultiple,
                terminalCapRate: inv.terminalCapRate,
                controlPremiumPct: inv.controlPremiumPct,
            });
        };
        const drPct = inv.debtRatio * 100;
        const DR_FLOOR = 0.30; // honest search bound — below this it's structure, not tuning
        const drAt = (x: number) => (inv.debtRatio - x) * 100;
        const worstYearEbitda = result.minDSCR * result.annualDebtPayment;

        const dscr = explainThresholdMetric({
            metricLabel: 'Min DSCR',
            value: result.minDSCR,
            threshold: 1.25,
            direction: 'atLeast',
            fmtValue: (v) => `${v.toFixed(2)}x`,
            because: `annual debt service ${fmtMoney(result.annualDebtPayment)} vs weakest-year EBITDA ${fmtMoney(worstYearEbitda)} at debt ratio ${drPct.toFixed(0)}% — typical lender covenant 1.25x`,
            levers: [
                {
                    lo: 0, hi: Math.max(0, inv.debtRatio - DR_FLOOR),
                    metricAt: (x) => runModel({ debtRatio: inv.debtRatio - x }).minDSCR,
                    render: (x, achieved) => ({
                        label: `Debt ratio → ${drAt(x).toFixed(0)}%`,
                        detail: `Lower debt ratio ${drPct.toFixed(0)}% → ${drAt(x).toFixed(1)}% (debt ${fmtMoney(capexResults.total * (inv.debtRatio - x))} from ${fmtMoney(result.totalDebt)}): Min DSCR becomes ${achieved.toFixed(2)}x ≥ 1.25x — bisection on the same investment model.`,
                    }),
                    unreachable: (atHi) => ({
                        label: 'Debt ratio alone is not enough',
                        detail: `Even a ${(DR_FLOOR * 100).toFixed(0)}% debt ratio only gives Min DSCR ${atHi.toFixed(2)}x < 1.25x — the revenue/OPEX side is binding, not leverage.`,
                    }),
                    targetTab: 'invest', targetSelector: 'inv-param-debtRatio',
                },
                {
                    lo: 1, hi: 1.5,
                    metricAt: (m) => runModel({ revMult: m }).minDSCR,
                    render: (m, achieved) => ({
                        label: `Revenue +${((m - 1) * 100).toFixed(0)}%`,
                        detail: `OR revenue rises +${((m - 1) * 100).toFixed(1)}% (to ${fmtMoney(inv.revenuePerKwMonth * m)}/kW/mo from ${fmtMoney(inv.revenuePerKwMonth)}): Min DSCR becomes ${achieved.toFixed(2)}x ≥ 1.25x.`,
                    }),
                    unreachable: (atHi) => ({
                        label: 'Revenue +50% not yet enough',
                        detail: `Even revenue +50% only gives Min DSCR ${atHi.toFixed(2)}x < 1.25x — the debt structure is binding, lower the leverage.`,
                    }),
                    targetTab: 'finance',
                },
            ],
        });

        const irr = explainThresholdMetric({
            metricLabel: 'Equity IRR',
            value: result.equityIRR,
            threshold: 15,
            direction: 'atLeast',
            fmtValue: (v) => fmtPct(v),
            because: `levered FCF on equity ${fmtMoney(result.totalEquity)} (${((1 - inv.debtRatio) * 100).toFixed(0)}% of CAPEX ${fmtMoney(capexResults.total)}) + exit equity value ${fmtMoney(result.exitEquityValue)} at ${inv.exitEbitdaMultiple}x EBITDA in year ${inv.exitYear} — institutional target 15%`,
            levers: [
                {
                    lo: 1, hi: 1.5,
                    metricAt: (m) => runModel({ revMult: m }).equityIRR,
                    render: (m, achieved) => ({
                        label: `Revenue +${((m - 1) * 100).toFixed(0)}%`,
                        detail: `Revenue must rise +${((m - 1) * 100).toFixed(1)}% (to ${fmtMoney(inv.revenuePerKwMonth * m)}/kW/mo from ${fmtMoney(inv.revenuePerKwMonth)}): Equity IRR becomes ${fmtPct(achieved)} ≥ 15% — bisection on the same model.`,
                    }),
                    unreachable: (atHi) => ({
                        label: 'Revenue +50% not yet enough',
                        detail: `Even revenue +50% only gives Equity IRR ${fmtPct(atHi)} < 15% — the cost structure (CAPEX ${fmtMoney(capexResults.total)} + OPEX ${fmtMoney(annualOpex)}/yr) needs review.`,
                    }),
                    targetTab: 'finance',
                },
                {
                    lo: inv.exitEbitdaMultiple, hi: 25,
                    metricAt: (em) => runModel({ exitMultiple: em }).equityIRR,
                    render: (em, achieved) => ({
                        label: `Exit multiple → ${em.toFixed(1)}x`,
                        detail: `OR exit EV/EBITDA ${inv.exitEbitdaMultiple}x → ${em.toFixed(1)}x (still within the DC market range 15-25x): Equity IRR becomes ${fmtPct(achieved)} ≥ 15%.`,
                    }),
                    unreachable: (atHi) => ({
                        label: 'Exit multiple 25x not yet enough',
                        detail: `Even a 25x exit only gives Equity IRR ${fmtPct(atHi)} < 15% — the problem is in operating cashflow, not the exit assumption.`,
                    }),
                    targetTab: 'invest', targetSelector: 'inv-param-exitMultiple',
                },
            ],
        });

        const payback = explainThresholdMetric({
            metricLabel: 'Levered payback',
            value: result.paybackYear,
            threshold: 7,
            direction: 'atMost',
            fmtValue: (v) => `${v.toFixed(0)} yr`,
            because: `cumulative levered FCF only turns positive in year ${result.paybackYear} — Y1 levered FCF ${fmtMoney(result.leveredFCFTable[0]?.leveredFCF ?? 0)} due to the occupancy ramp + debt service ${fmtMoney(result.annualDebtPayment)}/yr`,
            levers: [
                {
                    lo: 1, hi: 1.5,
                    metricAt: (m) => runModel({ revMult: m }).paybackYear,
                    render: (m, achieved) => ({
                        label: `Revenue +${((m - 1) * 100).toFixed(0)}%`,
                        detail: `Revenue up +${((m - 1) * 100).toFixed(1)}% (to ${fmtMoney(inv.revenuePerKwMonth * m)}/kW/mo) cuts levered payback to ${achieved.toFixed(0)} yr ≤ 7 yr — bisection on the same model.`,
                    }),
                    unreachable: (atHi) => ({
                        label: 'Revenue +50% not yet enough',
                        detail: `Even revenue +50% still has payback ${atHi.toFixed(0)} yr > 7 yr — the cost structure needs review.`,
                    }),
                    targetTab: 'finance',
                },
                {
                    lo: 0, hi: Math.max(0, inv.debtRatio - DR_FLOOR),
                    metricAt: (x) => runModel({ debtRatio: inv.debtRatio - x }).paybackYear,
                    render: (x, achieved) => ({
                        label: `Debt ratio → ${drAt(x).toFixed(0)}%`,
                        detail: `OR lower debt ratio ${drPct.toFixed(0)}% → ${drAt(x).toFixed(1)}% (lighter debt service): levered payback becomes ${achieved.toFixed(0)} yr ≤ 7 yr.`,
                    }),
                    unreachable: (atHi) => ({
                        label: 'Debt ratio alone is not enough',
                        detail: `Even a ${(DR_FLOOR * 100).toFixed(0)}% debt ratio still has payback ${atHi.toFixed(0)} yr > 7 yr — revenue is binding.`,
                    }),
                    targetTab: 'invest', targetSelector: 'inv-param-debtRatio',
                },
            ],
        });

        return { dscr, irr, payback };
    }, [capexResults, selectedCountry, finResult, result, investInputs, annualOpex, effectiveInputs.itLoad]);

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
        <div className="space-y-4">
            {/* Header with Export */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Landmark className="w-6 h-6 text-indigo-500" />
                    Investment Analysis
                </h2>
                <ExportPDFButton
                    isGenerating={isExporting}
                    onExport={async () => {
                        setIsExporting(true);
                        try {
                            const { generateInvestmentPDF } = await import('@/modules/reporting/PdfGenerator');
                            await generateInvestmentPDF(
                                selectedCountry,
                                result,
                                investInputs,
                                finResult,
                                capexResults.total,
                                effectiveInputs.itLoad
                            );
                        } catch (e) {
                            console.error('Investment PDF error:', e);
                        } finally {
                            setIsExporting(false);
                        }
                    }}
                    label="PDF"
                    className="px-2 py-1 text-[10px]"
                />
            </div>
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
                                Debt Ratio ({(investInputs.debtRatio * 100).toFixed(0)}%) <Tooltip content="Percentage of total CAPEX financed by debt. Higher leverage amplifies returns but increases risk." /><Explain k="debt-ratio-leverage" />
                            </label>
                            <input id="inv-param-debtRatio" type="range" min={50} max={80} step={1}
                                className="w-full accent-indigo-500 rounded"
                                value={investInputs.debtRatio * 100}
                                onChange={e => handleChange('debtRatio', Number(e.target.value) / 100)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">Interest Rate (%) <Tooltip content="Annual interest rate on debt financing. Typical range 4-8% for data center project finance." /><Explain k="interest-rate" /></label>
                                <input type="number" className={inpCls} step={0.5}
                                    value={(investInputs.debtCostAnnual * 100).toFixed(1)}
                                    onChange={e => handleChange('debtCostAnnual', Number(e.target.value) / 100)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">Debt Term (yrs) <Tooltip content="Loan repayment period in years. Longer terms reduce annual payments but increase total interest cost. Typical: 7-15 years." /></label>
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
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">Exit Year <Tooltip content="Target year for investment exit (sale, IPO, or recapitalization). Typical PE holding period: 5-7 years." /></label>
                            <input type="number" className={inpCls} min={3} max={10}
                                value={investInputs.exitYear}
                                onChange={e => handleChange('exitYear', Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">Exit EV/EBITDA <Tooltip content="Enterprise Value to EBITDA multiple at exit. Data center multiples typically range 15-25x depending on market conditions and contract quality." /></label>
                            <input id="inv-param-exitMultiple" type="number" className={inpCls} min={10} max={30} step={0.5}
                                value={investInputs.exitEbitdaMultiple}
                                onChange={e => handleChange('exitEbitdaMultiple', Number(e.target.value))} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">Terminal Cap Rate (%) <Tooltip content="Estimated value of the business beyond the explicit forecast period. Often the largest component of total valuation." /></label>
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
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <KPICard label="Total CAPEX" value={fmtMoney(capexResults.total)} icon={<Building className="w-4 h-4" />} color="slate" tooltip="Total capital expenditure including land, building, MEP, and IT infrastructure. This is the total investment amount to be financed." trace="capex.total" />
                            <KPICard label="Debt Amount" value={fmtMoney(result.totalDebt)} sub={`${(investInputs.debtRatio * 100).toFixed(0)}% leverage`} icon={<DollarSign className="w-4 h-4" />} color="red" tooltip="Total debt financing amount based on CAPEX and debt ratio. This is the principal amount to be repaid over the debt term." trace="inv.totalDebt" />
                            <KPICard label="Equity Required" value={fmtMoney(result.totalEquity)} sub={`${((1 - investInputs.debtRatio) * 100).toFixed(0)}% equity`} icon={<DollarSign className="w-4 h-4" />} color="emerald" tooltip="Equity capital required from sponsors/investors. This is the portion of CAPEX not covered by debt financing." trace="inv.totalEquity" />
                            <KPICard label="WACC" value={fmtPct(result.wacc * 100)} sub="Weighted avg cost" icon={<TrendingUp className="w-4 h-4" />} color="indigo" tooltipKey="wacc" tooltip="Weighted Average Cost of Capital — blended cost of debt and equity financing. Used as discount rate for DCF analysis." trace="inv.wacc" />
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
                                <table className="w-full min-w-[640px] text-xs">
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
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <KPICard label="Equity IRR" value={fmtPct(result.equityIRR)} sub={result.equityIRR > 15 ? 'Above 15% target' : 'Below 15% target'} icon={<TrendingUp className="w-4 h-4" />} color={result.equityIRR >= 15 ? 'emerald' : 'red'} tooltipKey="equity-irr" tooltip="Levered Internal Rate of Return on equity invested. Target is 15%+ for institutional data center PE investments." trace="inv.equityIrr" />
                            <KPICard label="MOIC" value={Number.isFinite(result.moic) ? `${result.moic.toFixed(2)}x` : 'N/A'} sub="Multiple on invested capital" icon={<ArrowUpRight className="w-4 h-4" />} color={result.moic >= 2 ? 'emerald' : 'amber'} tooltip="Multiple on Invested Capital — total value returned divided by total capital invested. Target is 2-3x for PE." trace="inv.moic" />
                            <KPICard label="Min DSCR" value={Number.isFinite(result.minDSCR) ? `${result.minDSCR.toFixed(2)}x` : 'N/A'} sub={result.minDSCR >= 1.25 ? 'Above 1.25x threshold' : 'Below 1.25x threshold'} icon={<Shield className="w-4 h-4" />} color={result.minDSCR >= 1.25 ? 'emerald' : 'red'} tooltipKey="dscr" tooltip="Minimum Debt Service Coverage Ratio across all years. Lenders typically require 1.25x+ DSCR as a covenant threshold." trace="inv.minDscr" />
                            <KPICard label="Y1 Cash-on-Cash" value={fmtPct(result.year1CashOnCash)} sub="Year 1 levered yield" icon={<DollarSign className="w-4 h-4" />} color={result.year1CashOnCash >= 8 ? 'emerald' : 'amber'} tooltip="Year 1 levered free cashflow divided by total equity invested. Measures the immediate cash yield on equity. Target: 8%+ for stabilized assets." trace="inv.year1CoC" />
                        </div>

                        {/* Owner-mandate explain panels: failing verdicts carry computed
                          * reasons + bisection-solved levers (click → parameter). */}
                        {explains && (
                            <>
                                <ThresholdExplainPanel title="Min DSCR below the 1.25x covenant" ex={explains.dscr} />
                                <ThresholdExplainPanel title="Equity IRR below the 15% target" ex={explains.irr} />
                                <ThresholdExplainPanel title="Levered payback above 7 years" ex={explains.payback} />
                            </>
                        )}

                        {/* DSCR Chart */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300 mb-4 flex items-center gap-1">Debt Service Coverage Ratio (DSCR) <Tooltip content="Ratio of net operating income to total debt service payments. A DSCR below 1.0x means cashflow cannot cover debt payments. Lenders typically require 1.25x minimum." /></h3>
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
                                <table className="w-full min-w-[640px] text-xs">
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

                {/* ═══ GP/LP RETURN WATERFALL ═══ */}
                {activeTab === 'returns' && (() => {
                    // GP/LP waterfall: 8% hurdle, 20% carry above hurdle
                    const hurdleRate = 0.08;
                    const carryRate = 0.20;
                    const equityInvested = result.totalEquity;
                    const totalDistributed = result.exitEquityValue + result.leveredFCFTable.reduce((s, r) => s + Math.max(0, r.leveredFCF), 0);
                    const totalProfit = totalDistributed - equityInvested;
                    const hurdleReturn = equityInvested * hurdleRate * investInputs.exitYear;
                    const profitAboveHurdle = Math.max(0, totalProfit - hurdleReturn);
                    const gpCarry = profitAboveHurdle * carryRate;
                    const lpReturn = totalDistributed - gpCarry;
                    const gpTotal = gpCarry;
                    const lpMoic = lpReturn / equityInvested;

                    const waterfallItems = [
                        { label: 'LP Capital Return', value: equityInvested, color: '#64748b' },
                        { label: `LP Pref (${(hurdleRate * 100).toFixed(0)}% hurdle)`, value: Math.min(hurdleReturn, totalProfit), color: '#06b6d4' },
                        { label: 'GP Carry (20%)', value: gpCarry, color: '#f59e0b' },
                        { label: 'LP Excess Return', value: Math.max(0, totalProfit - hurdleReturn - gpCarry), color: '#10b981' },
                    ];

                    return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300 mb-1 flex items-center gap-1">GP/LP Return Waterfall <Tooltip content="Distribution waterfall showing how profits are split between General Partner (GP) and Limited Partners (LP). LP receives preferred return first, then GP takes carried interest on excess profits." /></h3>
                            <p className="text-[11px] text-slate-400 mb-4">{(hurdleRate * 100).toFixed(0)}% preferred return hurdle, {(carryRate * 100).toFixed(0)}% GP carry on profits above hurdle</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                {waterfallItems.map((item, i) => (
                                    <div key={i} className="text-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ backgroundColor: item.color }} />
                                        <div className="text-[10px] text-slate-500 mb-0.5">{item.label}</div>
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">{fmtMoney(item.value)}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-700">
                                <div className="text-xs text-slate-500">LP Total Return: <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmtMoney(lpReturn)}</span> ({lpMoic.toFixed(2)}x MOIC)</div>
                                <div className="text-xs text-slate-500">GP Total Return: <span className="font-bold text-amber-600 dark:text-amber-400">{fmtMoney(gpTotal)}</span></div>
                                <div className="text-xs text-slate-500">Total Distributed: <span className="font-bold text-slate-900 dark:text-white">{fmtMoney(totalDistributed)}</span></div>
                            </div>
                        </div>
                    );
                })()}

                {/* ═══ TAB 3: VALUATION DASHBOARD ═══ */}
                {activeTab === 'valuation' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        {/* 3 Valuation Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm dark:shadow-none">
                                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-semibold mb-2 flex items-center gap-1">EV/EBITDA Method <Tooltip content="Enterprise Value — total value of the company including debt minus cash. Used for EV/EBITDA and other valuation multiples." /></div>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.valuation.evEbitda)}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {fmtMoney(result.stabilizedEBITDA)} x {investInputs.exitEbitdaMultiple}x
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm dark:shadow-none">
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold mb-2 flex items-center gap-1">Cap Rate Method <Tooltip content="Discounted Cash Flow — valuation method summing present values of projected future free cash flows." /></div>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.valuation.capRateVal)}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    NOI {fmtMoney(result.stabilizedNOI)} / {fmtPct(investInputs.terminalCapRate * 100)}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm dark:shadow-none">
                                <div className="text-[10px] text-cyan-600 dark:text-cyan-400 uppercase font-semibold mb-2 flex items-center gap-1">$/kW Implied <Tooltip content="Implied valuation per kilowatt of IT capacity. Benchmark: $8,000-$15,000/kW for stabilized assets in Tier 1 markets." /></div>
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
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
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

                {/* Terminal Value Sensitivity by Cap Rate */}
                {activeTab === 'valuation' && (() => {
                    const capRates = [0.050, 0.055, 0.060, 0.065, 0.070, 0.075, 0.080];
                    const noi = result.stabilizedNOI;
                    const terminalData = capRates.map(cr => ({
                        capRate: `${(cr * 100).toFixed(1)}%`,
                        terminalValue: noi / cr,
                        impliedDollarPerKw: Math.round((noi / cr) / effectiveInputs.itLoad),
                        isActive: Math.abs(cr - investInputs.terminalCapRate) < 0.001,
                    }));

                    return (
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300 mb-1">Terminal Value Sensitivity</h3>
                            <p className="text-[11px] text-slate-400 mb-4">Stabilized NOI of {fmtMoney(noi)} capitalized across a range of cap rates</p>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[420px] text-xs">
                                    <thead>
                                        <tr className="bg-slate-100 dark:bg-slate-900/50 text-slate-500 uppercase font-semibold">
                                            <th className="px-4 py-2 text-left">Cap Rate</th>
                                            <th className="px-4 py-2 text-right">Terminal Value</th>
                                            <th className="px-4 py-2 text-right">Implied $/kW</th>
                                            <th className="px-4 py-2 text-right">vs Current</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                                        {terminalData.map((row, i) => {
                                            const baseVal = noi / investInputs.terminalCapRate;
                                            const diff = ((row.terminalValue - baseVal) / baseVal) * 100;
                                            return (
                                                <tr key={i} className={clsx("hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors", row.isActive && "bg-cyan-50 dark:bg-cyan-950/20")}>
                                                    <td className="px-4 py-2 text-slate-800 dark:text-slate-300 font-mono">{row.capRate}</td>
                                                    <td className="px-4 py-2 text-right text-slate-900 dark:text-white font-medium">{fmtMoney(row.terminalValue)}</td>
                                                    <td className="px-4 py-2 text-right text-cyan-600 dark:text-cyan-400">${fmt(row.impliedDollarPerKw)}/kW</td>
                                                    <td className={clsx("px-4 py-2 text-right font-mono", diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500')}>
                                                        {row.isActive ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })()}

                {/* ═══ TAB 4: IPO / ACQUISITION PRICING ═══ */}
                {activeTab === 'ipo' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        {/* Pre/Post Money */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300 mb-4">IPO / Acquisition Pricing</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-slate-100 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                    <div className="text-[10px] text-slate-500 uppercase mb-1 flex items-center gap-1">Pre-Money (EV) <Tooltip content="Enterprise Value before any acquisition premium. Based on EV/EBITDA multiple applied to stabilized EBITDA." /></div>
                                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.valuation.evEbitda)}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">Fair value before premium</div>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase mb-1 flex items-center gap-1">Control Premium <Tooltip content="Additional premium paid above market value for acquiring a controlling stake. Typically 20-40% for data center acquisitions." /></div>
                                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">+{(investInputs.controlPremiumPct * 100).toFixed(0)}%</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{fmtMoney(result.valuation.evEbitda * investInputs.controlPremiumPct)}</div>
                                </div>
                                <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
                                    <div className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase mb-1 flex items-center gap-1">IPO / Acquisition Price <Tooltip content="Final transaction price including control premium. This is the total amount a buyer would pay or the implied IPO market cap." /></div>
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
                                <table className="w-full min-w-[480px] text-xs">
                                    <thead>
                                        <tr className="bg-slate-100 dark:bg-slate-900/50 text-slate-500 uppercase font-semibold">
                                            <th className="px-4 py-2 text-left">Multiple</th>
                                            <th className="px-4 py-2 text-right">Enterprise Value</th>
                                            <th className="px-4 py-2 text-right"><span className="flex items-center justify-end gap-1">Equity Value <Tooltip content="Enterprise value minus net debt. Represents the value attributable to equity holders." /></span></th>
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
                            <div className="text-sm text-slate-600 dark:text-slate-400 flex items-center justify-center gap-1">/ 100 <Tooltip content="Composite investment readiness score based on weighted checks across IRR, DSCR, MOIC, leverage, and payback metrics. 80+ = Ready, 50-79 = Conditional, below 50 = Not Ready." /></div>
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

                        {/* Failing readiness checks get the same computed explain +
                          * measured levers as the Returns tab (self-hides when pass). */}
                        {explains && (
                            <>
                                <ThresholdExplainPanel title="Min DSCR below the 1.25x covenant" ex={explains.dscr} />
                                <ThresholdExplainPanel title="Equity IRR below the 15% target" ex={explains.irr} />
                                <ThresholdExplainPanel title="Levered payback above 7 years" ex={explains.payback} />
                            </>
                        )}
                    </div>
                )}

                {/* ═══ TAB 6: SENSITIVITY ANALYSIS ═══ */}
                {activeTab === 'sensitivity' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300 mb-4">Equity IRR Sensitivity Matrix<Explain k="sensitivity-matrix" /></h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Debt Ratio (rows) x Exit EV/EBITDA Multiple (columns)</p>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[560px] text-xs">
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
                                    { label: 'Exit EV/EBITDA Multiple', k: 'exit-ev-ebitda-multiple', impact: 'High', color: 'text-red-600 dark:text-red-400', desc: 'Primary driver — 1x change shifts IRR by ~2-3%' },
                                    { label: 'Debt Ratio (Leverage)', k: 'debt-ratio-leverage', impact: 'High', color: 'text-red-600 dark:text-red-400', desc: 'More leverage amplifies returns but increases risk' },
                                    { label: 'Occupancy Ramp Speed', k: 'occupancy-ramp', impact: 'Medium', color: 'text-amber-600 dark:text-amber-400', desc: 'Faster ramp improves early cashflows and payback' },
                                    { label: 'Interest Rate', k: 'interest-rate', impact: 'Medium', color: 'text-amber-600 dark:text-amber-400', desc: 'Directly affects debt service and DSCR' },
                                    { label: 'Revenue per kW', k: 'revenue-per-kw', impact: 'Medium', color: 'text-amber-600 dark:text-amber-400', desc: 'Sets the revenue ceiling for all years' },
                                    { label: 'OPEX Growth', k: 'opex-growth', impact: 'Low', color: 'text-emerald-600 dark:text-emerald-400', desc: 'Gradual erosion, limited short-term impact' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-slate-900 dark:text-white">{item.label}<Explain k={item.k} /></div>
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
        </div>
    );
};

// ─── Threshold Explain Panel (owner mandate: no naked failing metric) ────────
// Tinted panel: computed reason (live numbers) + HIGH/MED levers solved by
// bisection on the page's own model; click navigates to the parameter.
function ThresholdExplainPanel({ title, ex }: { title: string; ex: ThresholdMetricExplain }) {
    if (ex.pass) return null;
    return (
        <div className="rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/20 p-4">
            <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">{title}</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{ex.reason}</p>
            {ex.levers.length > 0 && (
                <div className="mt-2">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5">What needs to change — computed on the same model</div>
                    <div className="space-y-1.5">
                        {ex.levers.map((lv, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => goToLever(lv)}
                                title={lv.targetSelector ? 'Click to jump to the parameter input' : `Open the "${lv.targetTab}" tab to fine-tune this parameter`}
                                className="w-full flex items-start gap-2 p-2 rounded-md bg-white/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors text-left group"
                            >
                                <span className={clsx('shrink-0 mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded text-white', lv.priority === 'HIGH' ? 'bg-red-600' : 'bg-amber-600')}>{lv.priority ?? 'MED'}</span>
                                <span className="shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 whitespace-nowrap">{lv.label}</span>
                                <span className="flex-1 text-[11px] text-slate-600 dark:text-slate-400 leading-snug">{lv.detail}</span>
                                <ArrowUpRight className="shrink-0 w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 mt-0.5" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── KPI Card Component ─────────────────────────────────────
function KPICard({ label, value, sub, icon, color, tooltip, tooltipKey, trace }: {
    label: string; value: string; sub?: string; icon: React.ReactNode; color: string; tooltip?: string;
    /** RZ_EXPLAIN_DB key — when it resolves, its definition replaces `tooltip` (which stays the fallback). */
    tooltipKey?: string;
    /** value-trace id — wraps the value in the ƒx TraceValue popover */
    trace?: string;
}) {
    const resolvedTooltip = (tooltipKey && explainText(tooltipKey)) || tooltip;
    const valueEl = <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>;
    return (
        <div className={`bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm dark:shadow-none`}>
            <div className="flex items-center gap-1.5 mb-1">
                <div className={`text-${color}-600 dark:text-${color}-400`}>{icon}</div>
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">{label}</span>
                {resolvedTooltip && <Tooltip content={resolvedTooltip} />}
            </div>
            {trace ? <TraceValue traceId={trace}>{valueEl}</TraceValue> : valueEl}
            {sub && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</div>}
        </div>
    );
}

export default InvestmentDashboard;
