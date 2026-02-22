'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { calculateCapacityPlan, CapacityPlanResult } from '@/modules/capacity/CapacityPlanningEngine';
import { calculateFinancials, FinancialResult, calculateIRR } from '@/modules/analytics/FinancialEngine';
import { calculateTaxIncentives } from '@/modules/analytics/TaxIncentiveEngine';
import { calculateDisasterRisk } from '@/modules/risk/DisasterRiskEngine';
import { calculateGridReliability } from '@/modules/infrastructure/GridReliabilityEngine';
import { calculateTalentAvailability } from '@/modules/staffing/TalentAvailabilityEngine';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import { Calculator, DollarSign, TrendingUp, Target, Percent, CheckCircle2, XCircle, FileText, AlertTriangle } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
    ComposedChart, Line, Area, Cell, ReferenceLine, LineChart,
} from 'recharts';
import { fmt, fmtMoney, fmtPct } from '@/lib/format';
import { ExportPDFButton } from '@/components/ui/ExportPDFButton';

interface PhaseFinancialResult {
    phaseLabel: string;
    capex: number;
    irr: number;
    npv: number;
    payback: number;
    goNoGo: boolean;
}

const PhasedFinancialDashboard = () => {
    const { selectedCountry, inputs } = useSimulationStore();
    const [isExporting, setIsExporting] = useState(false);

    const { capacityResult, phaseFinancials, blendedIrr, blendedNpv, blendedPayback, totalInvestment, profitabilityIndex, cashflowData, adjustments, scenarios, drawSchedule, totalIDC, constructionMonths, narrative } = useMemo(() => {
        if (!selectedCountry) return { capacityResult: null, phaseFinancials: [], blendedIrr: 0, blendedNpv: 0, blendedPayback: 0, totalInvestment: 0, profitabilityIndex: 0, cashflowData: [], adjustments: { tax: 0, disaster: 0, grid: 0, talent: 0 }, scenarios: [], drawSchedule: [], totalIDC: 0, constructionMonths: 0, narrative: '' };

        // 1. Get capacity plan
        const capPlan = calculateCapacityPlan({
            phases: inputs.capacityPhases,
            country: selectedCountry,
            coolingType: inputs.coolingType,
            tierLevel: inputs.tierLevel,
            shiftModel: inputs.shiftModel,
            maintenanceModel: inputs.maintenanceModel,
            hybridRatio: inputs.hybridRatio,
        });

        // 2. Cross-module adjustments
        const taxResult = calculateTaxIncentives({
            country: selectedCountry,
            totalCapex: capPlan.totalCapex,
            annualRevenue: capPlan.totalItLoadKw * 150 * 12,
            annualOpex: capPlan.totalItLoadKw * 50 * 12,
            projectLifeYears: 20,
            discountRate: 0.10,
            equipmentCapexShare: 0.65,
        });

        const disasterResult = calculateDisasterRisk({
            country: selectedCountry,
            totalCapex: capPlan.totalCapex,
            itLoadKw: capPlan.totalItLoadKw,
            annualRevenue: capPlan.totalItLoadKw * 150 * 12,
        });

        const gridResult = calculateGridReliability({
            country: selectedCountry,
            itLoadKw: capPlan.totalItLoadKw,
            tierLevel: inputs.tierLevel,
            coolingType: inputs.coolingType,
        });

        const talentResult = calculateTalentAvailability({
            country: selectedCountry,
            totalFTE: capPlan.phases[capPlan.phases.length - 1]?.fte ?? 10,
            annualStaffCost: (capPlan.phases[capPlan.phases.length - 1]?.fte ?? 10) * 3000 * 12,
        });

        // Get effective tax rate (from tax incentives)
        const effectiveTaxRate = selectedCountry.taxIncentives?.effectiveTaxRate ?? selectedCountry.economy.taxRate;

        // Risk-adjusted discount rate
        const baseDiscount = 0.10;
        const riskPremium = disasterResult.compositeScore > 50 ? 0.02 : disasterResult.compositeScore > 30 ? 0.01 : 0;
        const adjustedDiscount = baseDiscount + riskPremium;

        // Additional OPEX from grid + insurance + talent
        const gridOpexAdder = gridResult.gridRiskAdjustedOpex;
        const insuranceOpex = disasterResult.annualInsuranceCost;
        const talentCostAdder = (talentResult.adjustedSalaryMultiplier - 1) * (capPlan.phases[capPlan.phases.length - 1]?.fte ?? 10) * 3000 * 12;

        // 3. Per-phase financial analysis
        const hurdleRate = 12; // 12% IRR hurdle
        const phaseResults: PhaseFinancialResult[] = [];
        const allPhaseCashflows: number[][] = [];

        for (let pi = 0; pi < capPlan.phases.length; pi++) {
            const phase = capPlan.phases[pi];
            const inputPhase = inputs.capacityPhases[pi];
            const phaseOccRamp = inputPhase?.occupancyRamp ?? [0.3, 0.6, 0.85, 0.95];
            const phaseCapex = phase.capex + (disasterResult.structuralCostAdder * (phase.itLoadKw / capPlan.totalItLoadKw));
            const phaseRevenue = phase.itLoadKw * 150 * 12;
            const phaseOpex = phase.itLoadKw * 50 * 12 + (gridOpexAdder + insuranceOpex + talentCostAdder) * (phase.itLoadKw / capPlan.totalItLoadKw);

            const financials = calculateFinancials({
                totalCapex: phaseCapex,
                annualOpex: phaseOpex,
                revenuePerKwMonth: 150,
                itLoadKw: phase.itLoadKw,
                discountRate: adjustedDiscount,
                projectLifeYears: 20,
                escalationRate: 0.03,
                opexEscalation: selectedCountry.economy.inflationRate,
                occupancyRamp: phaseOccRamp.concat(Array(16).fill(0.95)),
                taxRate: effectiveTaxRate,
                depreciationYears: 20,
            });

            phaseResults.push({
                phaseLabel: phase.label,
                capex: phaseCapex,
                irr: financials.irr,
                npv: financials.npv,
                payback: financials.paybackPeriodYears,
                goNoGo: financials.irr >= hurdleRate,
            });
        }

        // 4. Blended portfolio analysis
        const totalCapex = phaseResults.reduce((s, p) => s + p.capex, 0);
        const weightedIrr = phaseResults.reduce((s, p) => s + p.irr * (p.capex / totalCapex), 0);
        const totalNpv = phaseResults.reduce((s, p) => s + p.npv, 0);
        const avgPayback = phaseResults.reduce((s, p) => s + p.payback * (p.capex / totalCapex), 0);
        const pi = totalNpv > 0 ? (totalNpv + totalCapex) / totalCapex : 0;

        // 5. Blended cashflow chart data
        const blendedFinancials = calculateFinancials({
            totalCapex: totalCapex,
            annualOpex: capPlan.totalItLoadKw * 50 * 12 + gridOpexAdder + insuranceOpex + talentCostAdder,
            revenuePerKwMonth: 150,
            itLoadKw: capPlan.totalItLoadKw,
            discountRate: adjustedDiscount,
            projectLifeYears: 20,
            escalationRate: 0.03,
            opexEscalation: selectedCountry.economy.inflationRate,
            occupancyRamp: inputs.occupancyRamp.concat(Array(10).fill(0.95)),
            taxRate: effectiveTaxRate,
            depreciationYears: 20,
        });

        const cfData = blendedFinancials.cashflows.map(cf => ({
            year: cf.year,
            revenue: Math.round(cf.revenue / 1000),
            opex: Math.round(-cf.opex / 1000),
            cashflow: Math.round(cf.freeCashflow / 1000),
            cumulative: Math.round(cf.cumulativeCashflow / 1000),
        }));

        // 6. Scenario comparison (conservative / base / aggressive)
        const scenarios = (['conservative', 'base', 'aggressive'] as const).map(scenario => {
            const revMult = scenario === 'conservative' ? 0.85 : scenario === 'aggressive' ? 1.15 : 1.0;
            const occDelay = scenario === 'conservative' ? 1 : scenario === 'aggressive' ? -1 : 0;
            const capexMult = scenario === 'conservative' ? 1.10 : scenario === 'aggressive' ? 0.95 : 1.0;

            const scenFinancials = calculateFinancials({
                totalCapex: totalCapex * capexMult,
                annualOpex: capPlan.totalItLoadKw * 50 * 12 + gridOpexAdder + insuranceOpex + talentCostAdder,
                revenuePerKwMonth: 150 * revMult,
                itLoadKw: capPlan.totalItLoadKw,
                discountRate: adjustedDiscount,
                projectLifeYears: 20,
                escalationRate: 0.03,
                opexEscalation: selectedCountry.economy.inflationRate,
                occupancyRamp: inputs.occupancyRamp.map((o, i) => {
                    const shifted = Math.max(0, Math.min(0.95, i + occDelay < 0 ? 0.15 : o));
                    return shifted;
                }).concat(Array(10).fill(0.95)),
                taxRate: effectiveTaxRate,
                depreciationYears: 20,
            });
            return {
                scenario,
                irr: scenFinancials.irr,
                npv: scenFinancials.npv,
                payback: scenFinancials.paybackPeriodYears,
                capex: Math.round(totalCapex * capexMult),
            };
        });

        // 7. Construction financing (IDC = interest during construction)
        const constructionMonths = capPlan.phases.reduce((max, p) => Math.max(max, p.startMonth + p.buildMonths), 0);
        const drawSchedule = capPlan.phases.map(phase => {
            const monthlyDraw = phase.capex / phase.buildMonths;
            const avgOutstanding = phase.capex * 0.5; // Linear draw ~50% avg outstanding
            const idc = avgOutstanding * (0.05 * phase.buildMonths / 12); // 5% construction loan rate
            return {
                label: phase.label,
                capex: phase.capex,
                drawMonths: phase.buildMonths,
                monthlyDraw: Math.round(monthlyDraw),
                idc: Math.round(idc),
            };
        });
        const totalIDC = drawSchedule.reduce((s, d) => s + d.idc, 0);

        // 8. Narrative
        const goPhases = phaseResults.filter(p => p.goNoGo).length;
        const narrative = `This ${phaseResults.length}-phase investment program requires ${fmtMoney(totalCapex)} in total capital across ${selectedCountry.name}. ` +
            `After accounting for tax incentives (${fmtMoney(taxResult.totalIncentiveValue)}), disaster risk premiums, grid reliability costs, and talent market adjustments, ` +
            `the blended IRR is ${weightedIrr.toFixed(1)}% against a 12% hurdle rate. ` +
            `${goPhases === phaseResults.length ? 'All phases pass the GO threshold' : `${goPhases} of ${phaseResults.length} phases meet the hurdle`}. ` +
            `Interest during construction adds ${fmtMoney(totalIDC)} to the effective cost base over ${constructionMonths} months of build activity. ` +
            `The profitability index of ${pi.toFixed(2)}x indicates ${pi > 1.5 ? 'strong value creation' : pi > 1 ? 'positive but modest returns' : 'value destruction'}.`;

        return {
            capacityResult: capPlan,
            phaseFinancials: phaseResults,
            blendedIrr: Math.round(weightedIrr * 10) / 10,
            blendedNpv: Math.round(totalNpv),
            blendedPayback: Math.round(avgPayback * 10) / 10,
            totalInvestment: Math.round(totalCapex),
            profitabilityIndex: Math.round(pi * 100) / 100,
            cashflowData: cfData,
            adjustments: {
                tax: Math.round(taxResult.totalIncentiveValue),
                disaster: Math.round(disasterResult.totalRiskAdjustedCost),
                grid: Math.round(gridOpexAdder),
                talent: Math.round(talentCostAdder),
            },
            scenarios,
            drawSchedule,
            totalIDC,
            constructionMonths,
            narrative,
        };
    }, [selectedCountry, inputs]);

    if (!selectedCountry || !capacityResult) {
        return <div className="p-8 text-center text-slate-500">Select a country and configure capacity phases to view phased financial analysis.</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Calculator className="w-6 h-6 text-blue-500" />
                        Phased Financial IRR/ROI
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {selectedCountry.name} · {capacityResult.phases.length} Phases · Tax-adjusted · Risk-adjusted discount rate
                    </p>
                </div>
                <ExportPDFButton
                    isGenerating={isExporting}
                    onExport={async () => {
                        setIsExporting(true);
                        try {
                            const { generatePhasedFinancialPDF } = await import('@/modules/reporting/PdfGenerator');
                            await generatePhasedFinancialPDF(selectedCountry!, {
                                phaseResults: phaseFinancials.map(pf => ({
                                    label: pf.phaseLabel,
                                    capex: pf.capex,
                                    irr: pf.irr,
                                    npv: pf.npv,
                                    payback: pf.payback,
                                })),
                                blendedIRR: blendedIrr,
                                totalNPV: blendedNpv,
                                weightedPayback: blendedPayback,
                                totalInvestment,
                                profitabilityIndex,
                                scenarios,
                                idcData: drawSchedule,
                                totalIDC,
                                blendedCashflows: cashflowData,
                                narrative,
                            });
                        } catch (e) {
                            console.error('Phased Financial PDF error:', e);
                        } finally {
                            setIsExporting(false);
                        }
                    }}
                    label="PDF"
                    className="px-2 py-1 text-[10px]"
                />
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Percent className="w-4 h-4 text-cyan-500" />
                            <span className="text-xs text-slate-500 uppercase">Blended IRR</span>
                            <Tooltip content="Investment-weighted internal rate of return across all phases, adjusted for tax incentives and risk." />
                        </div>
                        <div className={`text-2xl font-bold ${blendedIrr >= 12 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {blendedIrr.toFixed(1)}%
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs text-slate-500 uppercase">Total NPV</span>
                        </div>
                        <div className={`text-2xl font-bold ${blendedNpv >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {fmtMoney(blendedNpv)}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Target className="w-4 h-4 text-amber-500" />
                            <span className="text-xs text-slate-500 uppercase">Payback</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{blendedPayback} yr</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-slate-500 uppercase">Investment</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(totalInvestment)}</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-purple-500" />
                            <span className="text-xs text-slate-500 uppercase">PI</span>
                            <Tooltip content="Profitability Index: (NPV + Investment) / Investment. Above 1.0 = value-creating." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{profitabilityIndex}x</div>
                    </CardContent>
                </Card>
            </div>

            {/* Narrative Summary */}
            {narrative && (
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800/50">
                    <CardContent className="pt-5 pb-4">
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{narrative}</p>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Phase Decision Matrix */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Investment Decision Matrix (12% Hurdle)</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="text-left py-2 px-2 text-slate-500">Phase</th>
                                        <th className="text-right py-2 px-2 text-slate-500">CAPEX</th>
                                        <th className="text-right py-2 px-2 text-slate-500">IRR</th>
                                        <th className="text-right py-2 px-2 text-slate-500">NPV</th>
                                        <th className="text-right py-2 px-2 text-slate-500">Payback</th>
                                        <th className="text-center py-2 px-2 text-slate-500">Decision</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {phaseFinancials.map((pf, idx) => (
                                        <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                                            <td className="py-2 px-2 font-medium text-slate-900 dark:text-white">{pf.phaseLabel}</td>
                                            <td className="text-right py-2 px-2 text-slate-700 dark:text-slate-300">{fmtMoney(pf.capex)}</td>
                                            <td className={`text-right py-2 px-2 font-semibold ${pf.irr >= 12 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {pf.irr.toFixed(1)}%
                                            </td>
                                            <td className={`text-right py-2 px-2 ${pf.npv >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {fmtMoney(pf.npv)}
                                            </td>
                                            <td className="text-right py-2 px-2 text-slate-700 dark:text-slate-300">{pf.payback} yr</td>
                                            <td className="text-center py-2 px-2">
                                                {pf.goNoGo ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> GO
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-red-500 font-semibold">
                                                        <XCircle className="w-3.5 h-3.5" /> NO-GO
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Cross-Module Adjustments */}
                        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Cross-Module Adjustments Applied</h4>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">Tax Incentive Value</span>
                                    <span className="font-medium text-emerald-500">+{fmtMoney(adjustments.tax)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">Disaster Risk Cost/Yr</span>
                                    <span className="font-medium text-red-500">-{fmtMoney(adjustments.disaster)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">Grid Penalty OPEX/Yr</span>
                                    <span className="font-medium text-amber-500">-{fmtMoney(adjustments.grid)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">Talent Premium/Yr</span>
                                    <span className="font-medium text-purple-500">-{fmtMoney(adjustments.talent)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Cashflow Chart */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Blended Cashflow ($K)</h3>
                        <ResponsiveContainer width="100%" height={350}>
                            <ComposedChart data={cashflowData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `$${v}K`} />
                                <RTooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                    formatter={(v: any, name: any) => [`$${fmt(v)}K`, name === 'cumulative' ? 'Cumulative' : name === 'cashflow' ? 'Free Cashflow' : name]}
                                />
                                <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
                                <Bar dataKey="cashflow" radius={[4, 4, 0, 0]}>
                                    {cashflowData.map((entry, i) => (
                                        <Cell key={i} fill={entry.cashflow >= 0 ? '#10b981' : '#ef4444'} opacity={0.6} />
                                    ))}
                                </Bar>
                                <Line type="monotone" dataKey="cumulative" stroke="#06b6d4" strokeWidth={2} dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Scenario Comparison + Construction Financing */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Scenario Comparison */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Scenario Comparison</h3>
                        <p className="text-[11px] text-slate-400 mb-4">Conservative (-15% rev, +10% CAPEX), Base, Aggressive (+15% rev, -5% CAPEX)</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="text-left py-2 px-2 text-slate-500">Scenario</th>
                                        <th className="text-right py-2 px-2 text-slate-500">CAPEX</th>
                                        <th className="text-right py-2 px-2 text-slate-500">IRR</th>
                                        <th className="text-right py-2 px-2 text-slate-500">NPV</th>
                                        <th className="text-right py-2 px-2 text-slate-500">Payback</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scenarios.map((s, i) => (
                                        <tr key={i} className={`border-b border-slate-100 dark:border-slate-800 ${s.scenario === 'base' ? 'bg-cyan-50 dark:bg-cyan-950/20' : ''}`}>
                                            <td className="py-2 px-2 font-medium text-slate-900 dark:text-white capitalize flex items-center gap-1.5">
                                                {s.scenario === 'conservative' && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                                                {s.scenario === 'base' && <Target className="w-3 h-3 text-cyan-500" />}
                                                {s.scenario === 'aggressive' && <TrendingUp className="w-3 h-3 text-emerald-500" />}
                                                {s.scenario}
                                            </td>
                                            <td className="text-right py-2 px-2 text-slate-700 dark:text-slate-300">{fmtMoney(s.capex)}</td>
                                            <td className={`text-right py-2 px-2 font-semibold ${s.irr >= 12 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {s.irr.toFixed(1)}%
                                            </td>
                                            <td className={`text-right py-2 px-2 ${s.npv >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {fmtMoney(s.npv)}
                                            </td>
                                            <td className="text-right py-2 px-2 text-slate-700 dark:text-slate-300">{s.payback} yr</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Construction Financing / IDC */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Construction Financing &amp; IDC</h3>
                        <p className="text-[11px] text-slate-400 mb-4">Interest during construction at 5% construction loan rate over {constructionMonths} months</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="text-left py-2 px-2 text-slate-500">Phase</th>
                                        <th className="text-right py-2 px-2 text-slate-500">CAPEX</th>
                                        <th className="text-right py-2 px-2 text-slate-500">Draw Period</th>
                                        <th className="text-right py-2 px-2 text-slate-500">Monthly Draw</th>
                                        <th className="text-right py-2 px-2 text-slate-500">IDC</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {drawSchedule.map((d, i) => (
                                        <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                                            <td className="py-2 px-2 font-medium text-slate-900 dark:text-white">{d.label}</td>
                                            <td className="text-right py-2 px-2 text-slate-700 dark:text-slate-300">{fmtMoney(d.capex)}</td>
                                            <td className="text-right py-2 px-2 text-slate-700 dark:text-slate-300">{d.drawMonths} mo</td>
                                            <td className="text-right py-2 px-2 text-slate-700 dark:text-slate-300">{fmtMoney(d.monthlyDraw)}</td>
                                            <td className="text-right py-2 px-2 text-amber-600 dark:text-amber-400 font-medium">{fmtMoney(d.idc)}</td>
                                        </tr>
                                    ))}
                                    <tr className="font-bold border-t-2 border-slate-200 dark:border-slate-600">
                                        <td className="py-2 px-2 text-slate-900 dark:text-white">Total</td>
                                        <td className="text-right py-2 px-2 text-slate-900 dark:text-white">{fmtMoney(drawSchedule.reduce((s, d) => s + d.capex, 0))}</td>
                                        <td className="text-right py-2 px-2 text-slate-500">—</td>
                                        <td className="text-right py-2 px-2 text-slate-500">—</td>
                                        <td className="text-right py-2 px-2 text-amber-600 dark:text-amber-400">{fmtMoney(totalIDC)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800/40">
                            <div className="text-xs text-slate-700 dark:text-slate-300">
                                Effective CAPEX (incl. IDC): <span className="font-bold">{fmtMoney(totalInvestment + totalIDC)}</span>
                                <span className="text-slate-500 ml-2">(+{((totalIDC / totalInvestment) * 100).toFixed(1)}% IDC premium)</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default PhasedFinancialDashboard;
