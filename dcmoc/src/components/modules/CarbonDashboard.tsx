'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { ExportPDFButton } from '@/components/ui/ExportPDFButton';
import { useCapexStore } from '@/store/capex';
import { calculateCarbonFootprint, CarbonResult } from '@/modules/analytics/CarbonEngine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Leaf, Zap, Globe2, TrendingDown, AlertTriangle, Award, Factory, DollarSign } from 'lucide-react';

const fmt = (n: number, dec = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: dec }).format(n);
const fmtMoney = (n: number) => `$${fmt(n)}`;

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
        const pue = effectiveCooling === 'liquid' ? 1.2 : effectiveCooling === 'rdhx' ? 1.3 : effectiveCooling === 'inrow' ? 1.4 : 1.5;

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
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {selectedCountry.name} · {fmt(capexStore.inputs.itLoad || inputs.itLoad || 1000)} kW IT Load · Grid: {selectedCountry.environment.gridCarbonIntensity} kgCO₂/kWh
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`px-4 py-2 rounded-xl border text-xl font-bold ${ratingColors[result.efficiencyRating]}`}>
                        Rating: {result.efficiencyRating}
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
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Annual Emissions</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(result.annualEmissionsTonCO2)} <span className="text-sm text-slate-500 dark:text-slate-400">tCO₂</span></div>
                        <div className="text-xs text-slate-500 mt-1">Net: {fmt(result.netEmissionsTonCO2)} tCO₂ ({result.renewableReductionPct > 0 ? `-${result.renewableReductionPct}%` : 'no offset'})</div>
                    </CardContent>
                </Card>
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Annual Energy</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(result.annualEnergyMWh)} <span className="text-sm text-slate-500 dark:text-slate-400">MWh</span></div>
                        <div className="text-xs text-slate-500 mt-1">PUE: {result.pueEfficiency.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Offset Cost</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.carbonOffsetCostUSD)}</div>
                        <div className="text-xs text-slate-500 mt-1">@ $25/tCO₂ voluntary market</div>
                    </CardContent>
                </Card>
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Carbon Tax Risk</span>
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
                        <CardTitle className="text-sm text-slate-700 dark:text-slate-300">GHG Protocol Scope Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            { label: 'Scope 1 — Direct', value: result.scope1, color: '#ef4444', desc: 'Generators, fuel combustion' },
                            { label: 'Scope 2 — Grid', value: result.scope2, color: '#f59e0b', desc: 'Purchased electricity' },
                            { label: 'Scope 3 — Supply Chain', value: result.scope3, color: '#8b5cf6', desc: 'Estimated upstream/downstream' },
                        ].map(scope => (
                            <div key={scope.label}>
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-xs text-slate-600 dark:text-slate-400">{scope.label}</span>
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
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Total GHG Emissions</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{fmt(result.annualEmissionsTonCO2, 1)} tCO₂/yr</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Energy Breakdown */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-700 dark:text-slate-300">Energy Consumption Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            { label: 'IT Equipment', value: result.itEnergyMWh, color: '#3b82f6', pct: (result.itEnergyMWh / result.annualEnergyMWh * 100) },
                            { label: 'Cooling Systems', value: result.coolingEnergyMWh, color: '#06b6d4', pct: (result.coolingEnergyMWh / result.annualEnergyMWh * 100) },
                            { label: 'Distribution Losses', value: result.lossEnergyMWh, color: '#64748b', pct: (result.lossEnergyMWh / result.annualEnergyMWh * 100) },
                        ].map(item => (
                            <div key={item.label}>
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-xs text-slate-600 dark:text-slate-400">{item.label}</span>
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
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">vs Industry Average</span>
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
                        Carbon Reduction Investment Scenarios
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
                                        <span className="text-slate-600 dark:text-slate-400">Investment</span>
                                        <span className="text-slate-900 dark:text-white font-medium">{fmtMoney(scenario.investmentUSD)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-600 dark:text-slate-400">CO₂ Saved/yr</span>
                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmt(scenario.annualSavingsTonCO2, 1)} t</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-600 dark:text-slate-400">Savings/yr</span>
                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmtMoney(scenario.annualSavingsUSD)}</span>
                                    </div>
                                    {scenario.paybackYears > 0 && (
                                        <div className="flex justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                                            <span className="text-slate-600 dark:text-slate-400">Payback</span>
                                            <span className="text-amber-600 dark:text-amber-400 font-medium">{scenario.paybackYears} yrs</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default CarbonDashboard;
