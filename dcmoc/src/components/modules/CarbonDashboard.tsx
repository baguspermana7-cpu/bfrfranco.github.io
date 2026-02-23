'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { ExportPDFButton } from '@/components/ui/ExportPDFButton';
import { useCapexStore } from '@/store/capex';
import { calculateCarbonFootprint, CarbonResult } from '@/modules/analytics/CarbonEngine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import { Leaf, Zap, Globe2, TrendingDown, AlertTriangle, Award, Factory, DollarSign, Target } from 'lucide-react';
import { getPUE } from '@/constants/pue';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell,
    AreaChart, Area, ReferenceLine
} from 'recharts';
import { fmt, fmtMoney } from '@/lib/format';

const CarbonDashboard = () => {
    const { selectedCountry, inputs } = useSimulationStore();
    const capexStore = useCapexStore();
    const [isExporting, setIsExporting] = useState(false);

    const result: CarbonResult | null = useMemo(() => {
        if (!selectedCountry) return null;

        // Use CAPEX store's IT load for correlation (fallback to simulation store)
        const effectiveItLoad = capexStore.inputs.itLoad || inputs.itLoad || 1000;
        // Use CAPEX store's cooling type for PUE
        const effectiveCooling = capexStore.inputs.coolingType || inputs.coolingType || 'air';
        const pue = getPUE(effectiveCooling);

        return calculateCarbonFootprint({
            itLoadKw: effectiveItLoad,
            pue,
            gridCarbonIntensity: selectedCountry.environment.gridCarbonIntensity,
            coolingType: effectiveCooling,
            renewableOption: capexStore.inputs.renewableOption || 'none',
            fuelHours: capexStore.inputs.fuelHours || 48,
            genType: capexStore.inputs.genType || 'diesel',
            countryName: selectedCountry.name,
        });
    }, [selectedCountry, inputs, capexStore.inputs]);

    if (!result || !selectedCountry) {
        return <div className="p-8 text-center text-slate-500">Select a country to view carbon analysis.</div>;
    }

    const ratingColors: Record<string, string> = {
        A: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        B: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
        C: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        D: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
        F: 'text-red-400 bg-red-500/10 border-red-500/30',
    };

    // Scope chart data (visual bars)
    const maxScope = Math.max(result.scope1, result.scope2, result.scope3);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Leaf className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        Carbon & ESG Dashboard
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 flex items-center">
                        {selectedCountry.name} · {fmt(capexStore.inputs.itLoad || inputs.itLoad || 1000)} kW IT Load · Grid: {selectedCountry.environment.gridCarbonIntensity} kgCO₂/kWh<Tooltip content="Carbon intensity of the local electricity grid in kgCO2 per kWh. Varies by country based on energy mix (coal, gas, nuclear, renewables)." />
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`px-4 py-2 rounded-xl border text-xl font-bold ${ratingColors[result.efficiencyRating]} flex items-center gap-1`}>
                        Rating: {result.efficiencyRating}<Tooltip content="Efficiency rating from A (best) to F (worst) based on PUE, carbon intensity, and renewable energy adoption. A = hyperscale-class efficiency, F = legacy facility with high emissions." />
                    </div>
                    <ExportPDFButton
                        isGenerating={isExporting}
                        onExport={async () => {
                            if (!selectedCountry || !result) return;
                            setIsExporting(true);
                            try {
                                const { generateCarbonPDF } = await import('@/modules/reporting/PdfGenerator');
                                const { generateCarbonNarrative } = await import('@/modules/reporting/ExecutiveSummaryGenerator');
                                const narrative = generateCarbonNarrative(result);
                                await generateCarbonPDF(selectedCountry, result, narrative);
                            } finally {
                                setIsExporting(false);
                            }
                        }}
                    />
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-4 gap-4">
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Factory className="w-4 h-4 text-red-600 dark:text-red-400" />
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Annual Emissions</span><Tooltip content="Total Scope 1+2+3 greenhouse gas emissions in tonnes CO2 equivalent per year." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(result.annualEmissionsTonCO2)} <span className="text-sm text-slate-500 dark:text-slate-400">tCO₂</span></div>
                        <div className="text-xs text-slate-500 mt-1">Net: {fmt(result.netEmissionsTonCO2)} tCO₂ ({result.renewableReductionPct > 0 ? `-${result.renewableReductionPct}%` : 'no offset'})</div>
                    </CardContent>
                </Card>
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Annual Energy</span><Tooltip content="Total facility energy consumption including IT load, cooling overhead, and distribution losses. PUE ratio shown below." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(result.annualEnergyMWh)} <span className="text-sm text-slate-500 dark:text-slate-400">MWh</span></div>
                        <div className="text-xs text-slate-500 mt-1">PUE: {result.pueEfficiency.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Offset Cost</span><Tooltip content="Cost to offset remaining carbon emissions through voluntary carbon credits at current market rate ($25/tCO2)." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.carbonOffsetCostUSD)}</div>
                        <div className="text-xs text-slate-500 mt-1">@ $25/tCO₂ voluntary market</div>
                    </CardContent>
                </Card>
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Carbon Tax Risk</span><Tooltip content="Potential annual carbon tax liability based on EU ETS-equivalent rate ($50/tCO2). Risk increases with stricter regulations." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.carbonTaxExposureUSD)}</div>
                        <div className="text-xs text-slate-500 mt-1">@ $50/tCO₂ (EU ETS rate)</div>
                    </CardContent>
                </Card>
            </div>

            {/* Scope Breakdown + Energy Mix */}
            <div className="grid grid-cols-2 gap-4">
                {/* Scope Breakdown */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-700 dark:text-slate-300 flex items-center">GHG Protocol Scope Breakdown<Tooltip content="Greenhouse Gas Protocol framework: Scope 1 (direct emissions from owned generators), Scope 2 (indirect emissions from purchased electricity), Scope 3 (value chain emissions from construction, commuting, waste)." /></CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            { label: 'Scope 1 — Direct', value: result.scope1, color: '#ef4444', desc: 'Generators, fuel combustion', tip: 'Scope 1: Direct GHG emissions from sources owned or controlled by the facility, such as diesel/gas generators and on-site fuel combustion.' },
                            { label: 'Scope 2 — Grid', value: result.scope2, color: '#f59e0b', desc: 'Purchased electricity', tip: 'Scope 2: Indirect emissions from purchased electricity consumed by the data center. Driven by grid carbon intensity and total energy demand.' },
                            { label: 'Scope 3 — Supply Chain', value: result.scope3, color: '#8b5cf6', desc: 'Estimated upstream/downstream', tip: 'Scope 3: All other indirect emissions in the value chain — embodied carbon in construction materials, employee commuting, waste disposal, and upstream fuel production.' },
                        ].map(scope => (
                            <div key={scope.label}>
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center">{scope.label}<Tooltip content={scope.tip} /></span>
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{fmt(scope.value, 1)} tCO₂</span>
                                </div>
                                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{
                                            width: `${maxScope > 0 ? (scope.value / maxScope) * 100 : 0}%`,
                                            backgroundColor: scope.color,
                                        }}
                                    />
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">{scope.desc}</div>
                            </div>
                        ))}
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center">Total GHG Emissions<Tooltip content="Sum of all three scopes (Scope 1 + 2 + 3) before any renewable energy offsets are applied. This is your gross annual carbon footprint." /></span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{fmt(result.annualEmissionsTonCO2, 1)} tCO₂/yr</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Energy Breakdown */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-700 dark:text-slate-300 flex items-center">Energy Consumption Breakdown<Tooltip content="Breakdown of total facility energy: IT load, cooling, lighting, UPS losses, and other mechanical systems. PUE determines the ratio of total to IT power." /></CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            { label: 'IT Equipment', value: result.itEnergyMWh, color: '#3b82f6', pct: (result.itEnergyMWh / result.annualEnergyMWh * 100), tip: 'Energy consumed by servers, storage, and networking equipment. This is the useful compute load that PUE efficiency is measured against.' },
                            { label: 'Cooling Systems', value: result.coolingEnergyMWh, color: '#06b6d4', pct: (result.coolingEnergyMWh / result.annualEnergyMWh * 100), tip: 'Energy used by CRAC/CRAH units, chillers, cooling towers, and pumps. Varies significantly by cooling type (air, DX, chilled water, liquid).' },
                            { label: 'Distribution Losses', value: result.lossEnergyMWh, color: '#64748b', pct: (result.lossEnergyMWh / result.annualEnergyMWh * 100), tip: 'Energy lost in power distribution: UPS conversion losses, PDU transformer losses, switchgear, and cable resistance. Typically 5-12% of total load.' },
                        ].map(item => (
                            <div key={item.label}>
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center">{item.label}<Tooltip content={item.tip} /></span>
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{fmt(item.value)} MWh ({item.pct.toFixed(1)}%)</span>
                                </div>
                                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                                    />
                                </div>
                            </div>
                        ))}
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center">vs Industry Average<Tooltip content="Comparison against industry benchmarks: average PUE ~1.58 (Uptime Institute 2024), best-in-class <1.2 for hyperscale facilities." /></span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white">{fmt(result.industryAvgEmissions, 1)} tCO₂/yr</span>
                            </div>
                            <div className="text-xs text-slate-500">
                                Your facility is {result.netEmissionsTonCO2 < result.industryAvgEmissions
                                    ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmt(((1 - result.netEmissionsTonCO2 / result.industryAvgEmissions) * 100), 1)}% below</span>
                                    : <span className="text-red-600 dark:text-red-400 font-medium">{fmt(((result.netEmissionsTonCO2 / result.industryAvgEmissions - 1) * 100), 1)}% above</span>
                                } industry average
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Reduction Scenarios */}
            <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        Carbon Reduction Investment Scenarios<Tooltip content="Modeled investment pathways to reduce carbon emissions. Each scenario shows upfront cost, annual CO2 savings, financial savings, and payback period based on current facility parameters." />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-4 gap-3">
                        {result.reductionScenarios.map((scenario, i) => (
                            <div key={i} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: scenario.color + '20' }}>
                                    <Award className="w-4 h-4" style={{ color: scenario.color }} />
                                </div>
                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{scenario.name}</h4>
                                <p className="text-[10px] text-slate-600 dark:text-slate-500 mb-3 leading-relaxed">{scenario.description}</p>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-600 dark:text-slate-400 flex items-center">Investment<Tooltip content="Estimated upfront capital expenditure required to implement this carbon reduction scenario." /></span>
                                        <span className="text-slate-900 dark:text-white font-medium">{fmtMoney(scenario.investmentUSD)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-600 dark:text-slate-400 flex items-center">CO₂ Saved/yr<Tooltip content="Projected annual reduction in CO2 emissions (tonnes) if this scenario is fully implemented." /></span>
                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmt(scenario.annualSavingsTonCO2, 1)} t</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-600 dark:text-slate-400 flex items-center">Savings/yr<Tooltip content="Annual financial savings from reduced energy costs and avoided carbon tax/offset expenses." /></span>
                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmtMoney(scenario.annualSavingsUSD)}</span>
                                    </div>
                                    {scenario.paybackYears > 0 && (
                                        <div className="flex justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                                            <span className="text-slate-600 dark:text-slate-400 flex items-center">Payback<Tooltip content="Simple payback period: years to recover initial investment from annual savings. Does not account for discount rate or escalation." /></span>
                                            <span className="text-amber-600 dark:text-amber-400 font-medium">{scenario.paybackYears} yrs</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* ═══ B12: PUE BENCHMARK CHART ═══ */}
            {(() => {
                const designPue = result.pueEfficiency;
                const pueData = [
                    { name: 'Design PUE', value: designPue, color: '#10b981', tip: 'Your facility\'s design PUE based on selected cooling type. This is the theoretical efficiency under normal operating conditions.' },
                    { name: 'Industry Avg', value: 1.58, color: '#f59e0b', tip: 'Global industry average PUE of 1.58 per Uptime Institute 2024 Annual Survey. Includes all data center types and sizes.' },
                    { name: 'Best-in-Class', value: 1.10, color: '#06b6d4', tip: 'Best-in-class PUE achieved by leading hyperscale operators (Google, Meta) using advanced liquid cooling and free-air economization.' },
                ];
                return (
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                PUE Benchmark Comparison<Tooltip content="Power Usage Effectiveness (PUE) = Total Facility Power / IT Equipment Power. A PUE of 1.0 means all power goes to IT. Lower is better. Industry average is ~1.58 (Uptime Institute 2024)." />
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={pueData} layout="vertical" margin={{ left: 100, right: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                    <XAxis
                                        type="number"
                                        domain={[1.0, 2.0]}
                                        stroke="#64748b"
                                        fontSize={11}
                                        tickFormatter={(v: number) => v.toFixed(2)}
                                    />
                                    <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={90} />
                                    <RTooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                        labelStyle={{ color: '#e2e8f0' }}
                                        formatter={((value: number) => [value.toFixed(2), 'PUE']) as any}
                                    />
                                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                                        {pueData.map((entry, idx) => (
                                            <Cell key={idx} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                            <div className="flex items-center justify-center gap-6 mt-2 text-xs text-slate-500">
                                {pueData.map((d, i) => (
                                    <div key={i} className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color }} />
                                        <span>{d.name}: {d.value.toFixed(2)}</span><Tooltip content={d.tip} />
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 text-center">
                                <span className={`text-sm font-medium ${designPue <= 1.20 ? 'text-emerald-600 dark:text-emerald-400' : designPue <= 1.50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`}>
                                    Your design PUE of {designPue.toFixed(2)} is {designPue <= 1.20 ? 'Best-in-Class' : designPue <= 1.40 ? 'Above Average' : designPue <= 1.58 ? 'Near Industry Average' : 'Below Industry Average'}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                );
            })()}

            {/* ═══ B13: CARBON NET-ZERO TRAJECTORY ═══ */}
            {(() => {
                const currentYear = new Date().getFullYear();
                const currentEmissions = result.netEmissionsTonCO2;
                const renewableAdoption = result.renewableReductionPct / 100; // e.g. 0.30 for 30%
                const targetYear = 2050;
                const yearsToTarget = targetYear - currentYear;

                // Build trajectory data: emissions decline each year based on accelerating renewable adoption
                const trajectoryData = Array.from({ length: yearsToTarget + 1 }, (_, i) => {
                    const year = currentYear + i;
                    // Logistic-style reduction curve: starts slow, accelerates, then flattens near zero
                    const progress = i / yearsToTarget;
                    const baseReduction = renewableAdoption; // current renewable offset
                    const additionalReduction = (1 - baseReduction) * (1 - Math.pow(1 - progress, 2.5));
                    const totalReduction = Math.min(1, baseReduction + additionalReduction);
                    const emissions = Math.max(0, currentEmissions * (1 - totalReduction));

                    return {
                        year,
                        emissions: Math.round(emissions),
                        milestone: year === 2030 ? '2030 Target' : year === 2040 ? '2040 Target' : year === 2050 ? 'Net-Zero' : undefined,
                    };
                });

                // Only show every 2 years for readability
                const filteredData = trajectoryData.filter((_, i) => i % 2 === 0 || i === trajectoryData.length - 1);

                return (
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Target className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                Carbon Net-Zero Trajectory ({currentYear} - 2050)<Tooltip content="Projected emissions reduction pathway assuming accelerating renewable energy adoption over time. Uses a logistic curve model from current renewable offset to full net-zero by 2050, aligned with Paris Agreement targets." />
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={filteredData}>
                                    <defs>
                                        <linearGradient id="carbonTrajectoryGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                            <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis
                                        dataKey="year"
                                        stroke="#64748b"
                                        fontSize={11}
                                        tickFormatter={(v: number) => `${v}`}
                                    />
                                    <YAxis
                                        stroke="#64748b"
                                        fontSize={11}
                                        tickFormatter={(v: number) => `${fmt(v)}t`}
                                    />
                                    <RTooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                        labelStyle={{ color: '#e2e8f0' }}
                                        formatter={((value: number) => [`${fmt(value)} tCO2`, 'Emissions']) as any}
                                    />
                                    <ReferenceLine x={2030} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '2030', fill: '#f59e0b', fontSize: 10, position: 'top' }} />
                                    <ReferenceLine x={2040} stroke="#06b6d4" strokeDasharray="4 4" label={{ value: '2040', fill: '#06b6d4', fontSize: 10, position: 'top' }} />
                                    <ReferenceLine y={0} stroke="#10b981" strokeWidth={2} label={{ value: 'Net-Zero', fill: '#10b981', fontSize: 10, position: 'insideTopRight' }} />
                                    <Area
                                        type="monotone"
                                        dataKey="emissions"
                                        stroke="#ef4444"
                                        fill="url(#carbonTrajectoryGrad)"
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                            <div className="mt-3 grid grid-cols-3 gap-3">
                                {[
                                    { year: currentYear, label: 'Current', value: currentEmissions, color: 'text-red-500 dark:text-red-400', tip: 'Current annual net emissions after applying any existing renewable energy offsets from your selected configuration.' },
                                    { year: 2030, label: '2030 Target', value: trajectoryData.find(d => d.year === 2030)?.emissions ?? 0, color: 'text-amber-500 dark:text-amber-400', tip: '2030 interim target aligned with EU Green Deal and corporate ESG commitments. Typically aims for 40-55% reduction from baseline.' },
                                    { year: 2050, label: 'Net-Zero Target', value: 0, color: 'text-emerald-500 dark:text-emerald-400', tip: 'Paris Agreement net-zero target year. Requires eliminating or fully offsetting all greenhouse gas emissions by 2050.' },
                                ].map((m, i) => (
                                    <div key={i} className="text-center p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                        <div className="text-xs text-slate-500 flex items-center justify-center">{m.label} ({m.year})<Tooltip content={m.tip} /></div>
                                        <div className={`text-lg font-bold font-mono ${m.color}`}>{fmt(m.value)} <span className="text-xs text-slate-400">tCO2</span></div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                );
            })()}
        </div>
    );
};

export default CarbonDashboard;
