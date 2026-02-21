'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { ExportPDFButton } from '@/components/ui/ExportPDFButton';
import { calculateRiskProfile, calculateRiskScore, RiskScenario } from '@/modules/risk/RiskEngine';
import { calculateDowntimeRisk } from '@/modules/risk/DowntimeCalculator';
import { generateAssetCounts } from '@/lib/AssetGenerator';
import {
    AlertTriangle, ShieldAlert, Waves, Zap, Construction,
    Activity, TrendingUp, Clock, DollarSign, Thermometer,
    Droplets, Truck, FileCheck, Server
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export default function RiskDashboard() {
    const { selectedCountry, inputs } = useSimulationStore();
    const tierLevel = (inputs.tierLevel === 4 ? 4 : 3) as 3 | 4;
    const [isExporting, setIsExporting] = useState(false);

    const analysis = useMemo(() => {
        if (!selectedCountry) return null;
        const assets = generateAssetCounts(1000, tierLevel, 'air', 5000);
        const risks = calculateRiskProfile(selectedCountry, tierLevel, assets);
        const aggregation = calculateRiskScore(risks, tierLevel);
        const downtime = calculateDowntimeRisk(tierLevel);
        return { risks, aggregation, downtime };
    }, [selectedCountry, tierLevel, inputs.headcount_Engineer]);

    if (!selectedCountry || !analysis) {
        return <div className="p-8 text-center text-slate-500">Select a country to view risk analysis.</div>;
    }

    const { risks, aggregation, downtime } = analysis;
    const { totalScore, normalizedScore, slaBreachProbability, fiveYearProjection, topRisks, matrix } = aggregation;

    const getIcon = (category: string) => {
        switch (category) {
            case 'Natural': return <Waves className="w-4 h-4 text-blue-400" />;
            case 'Operational': return <Zap className="w-4 h-4 text-amber-400" />;
            case 'Labor': return <Construction className="w-4 h-4 text-red-400" />;
            case 'Financial': return <DollarSign className="w-4 h-4 text-emerald-400" />;
            default: return <AlertTriangle className="w-4 h-4 text-slate-400" />;
        }
    };

    const getSeverityColor = (prob: string, impact: string) => {
        const score = ({ 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 }[prob] || 2) * ({ 'Low': 1, 'Medium': 2, 'High': 3, 'Catastrophic': 4 }[impact] || 2);
        if (score >= 9) return 'border-red-500/50 bg-red-950/20';
        if (score >= 6) return 'border-amber-500/50 bg-amber-950/20';
        return 'border-emerald-500/50 bg-emerald-950/20';
    };

    const matrixColor = (score: number, hasRisks: boolean) => {
        if (!hasRisks && score < 6) return 'bg-slate-900/50';
        if (score >= 12) return 'bg-red-600/70';
        if (score >= 8) return 'bg-orange-600/60';
        if (score >= 4) return 'bg-amber-600/50';
        return 'bg-emerald-600/40';
    };

    return (
        <div className="p-6 space-y-6 overflow-y-auto h-[calc(100vh-140px)]">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-cyan-500" />
                    Risk Assessment Dashboard
                </h2>
                <ExportPDFButton
                    isGenerating={isExporting}
                    onExport={async () => {
                        setIsExporting(true);
                        try {
                            const { generateRiskPDF } = await import('@/modules/reporting/PdfGenerator');
                            const { generateRiskNarrative } = await import('@/modules/reporting/ExecutiveSummaryGenerator');
                            await generateRiskPDF(selectedCountry, aggregation, generateRiskNarrative(aggregation));
                        } finally {
                            setIsExporting(false);
                        }
                    }}
                />
            </div>
            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <div className="text-slate-500 dark:text-slate-400 text-xs uppercase mb-1 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Risk Score
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{totalScore}</div>
                    <div className={`text-xs mt-1 ${normalizedScore > 60 ? 'text-red-600 dark:text-red-400' : normalizedScore > 35 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {normalizedScore}% of maximum • {risks.length} risks
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <div className="text-slate-500 dark:text-slate-400 text-xs uppercase mb-1 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> Financial Exposure
                    </div>
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                        ${(downtime.financialImpact / 1000).toFixed(0)}k
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        @ $5k/min × {downtime.expectedDowntimeMinutes} min/yr
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <div className="text-slate-500 dark:text-slate-400 text-xs uppercase mb-1 flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Availability
                    </div>
                    <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{downtime.availability}%</div>
                    <div className="text-xs text-slate-500 mt-1">
                        Tier {tierLevel} SLA target
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <div className="text-slate-500 dark:text-slate-400 text-xs uppercase mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> SLA Breach Prob.
                    </div>
                    <div className={`text-3xl font-bold ${slaBreachProbability > 0.1 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {(slaBreachProbability * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Annual breach likelihood</div>
                </div>
            </div>

            {/* Risk Matrix + Top Risks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 5×5 Risk Matrix */}
                <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-cyan-400" /> Risk Matrix (Likelihood × Impact)
                    </h3>
                    <div className="relative">
                        <div className="text-[10px] text-slate-500 -rotate-90 absolute -left-7 top-1/2 -translate-y-1/2 whitespace-nowrap">
                            IMPACT →
                        </div>
                        <div className="ml-6">
                            {/* Y-axis labels */}
                            {['Catastrophic', 'High', 'Medium', 'Low', 'Negligible'].map((label, rowIdx) => (
                                <div key={label} className="flex items-center gap-1 mb-1">
                                    <div className="w-16 text-[10px] text-slate-500 text-right pr-2">{label}</div>
                                    {[0, 1, 2, 3, 4].map(colIdx => {
                                        const actualRow = 4 - rowIdx;
                                        const cell = matrix[actualRow]?.[colIdx];
                                        const hasRisks = cell && cell.risks.length > 0;
                                        return (
                                            <div
                                                key={colIdx}
                                                className={`flex-1 h-10 rounded-sm flex items-center justify-center relative group ${matrixColor((colIdx + 1) * (actualRow + 1), !!hasRisks)} 
                                                    ${hasRisks ? 'ring-1 ring-white/30' : ''}`}
                                            >
                                                {hasRisks && (
                                                    <>
                                                        <span className="text-xs font-bold text-white">{cell.risks.length}</span>
                                                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-600 rounded p-2 hidden group-hover:block z-50 w-40">
                                                            {cell.risks.map(r => (
                                                                <div key={r.id} className="text-[10px] text-slate-300 mb-1">{r.title}</div>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                            {/* X-axis labels */}
                            <div className="flex items-center gap-1 mt-1">
                                <div className="w-16"></div>
                                {['Rare', 'Unlikely', 'Possible', 'Likely', 'Certain'].map(l => (
                                    <div key={l} className="flex-1 text-[10px] text-slate-500 text-center">{l}</div>
                                ))}
                            </div>
                            <div className="text-center text-[10px] text-slate-500 mt-1">LIKELIHOOD →</div>
                        </div>
                    </div>
                </div>

                {/* Top Risks */}
                <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" /> Top Risk Scenarios
                    </h3>
                    <div className="space-y-3 max-h-[280px] overflow-y-auto">
                        {topRisks.map((risk, i) => (
                            <div key={risk.id} className={`p-3 rounded-lg border ${getSeverityColor(risk.probability, risk.impact)}`}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        {getIcon(risk.category)}
                                        <span className="text-sm font-medium text-slate-900 dark:text-white">{risk.title}</span>
                                    </div>
                                    <div className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-transparent">
                                        {risk.score}
                                    </div>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 ml-6">{risk.description}</p>
                                <div className="mt-2 ml-6 flex items-center gap-3 text-[10px]">
                                    <span className={`px-1.5 py-0.5 rounded ${risk.probability === 'High' || risk.probability === 'Critical' ? 'bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-300' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-transparent'}`}>
                                        P: {risk.probability}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded ${risk.impact === 'High' || risk.impact === 'Catastrophic' ? 'bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-300' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-transparent'}`}>
                                        I: {risk.impact}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Downtime Analysis + 5-Year Projection */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Downtime Analysis */}
                <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" /> Downtime Analysis (Tier {tierLevel})
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                            <div className="text-[10px] text-slate-500 uppercase">Expected Downtime</div>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">{downtime.expectedDowntimeMinutes} min</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">per year</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                            <div className="text-[10px] text-slate-500 uppercase">Availability</div>
                            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{downtime.availability}%</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">annual uptime</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                            <div className="text-[10px] text-slate-500 uppercase">Financial Impact</div>
                            <div className="text-xl font-bold text-red-600 dark:text-red-400">
                                ${(downtime.financialImpact / 1000).toFixed(0)}k
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">annual exposure</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                            <div className="text-[10px] text-slate-500 uppercase">SLA Breach Risk</div>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">{downtime.slaBreachProbability}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">breach probability</div>
                        </div>
                    </div>
                    {/* MTTR / MTBF estimates */}
                    <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase">Est. MTTR</div>
                            <div className="text-sm font-bold text-amber-400">
                                {tierLevel === 4 ? '15 min' : '45 min'}
                            </div>
                            <div className="text-[10px] text-slate-500">Mean Time To Repair</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase">Est. MTBF</div>
                            <div className="text-sm font-bold text-emerald-400">
                                {tierLevel === 4 ? '8,760 hrs' : '4,380 hrs'}
                            </div>
                            <div className="text-[10px] text-slate-500">Mean Time Between Failures</div>
                        </div>
                    </div>
                </div>

                {/* 5-Year Risk Trend */}
                <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> 5-Year Risk Projection
                    </h3>
                    <div className="text-[10px] text-slate-500 mb-2">
                        Without mitigation, risk compounds at ~6%/year due to aging infrastructure
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={fiveYearProjection}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <RechartsTooltip
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                                labelStyle={{ color: '#94a3b8' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="score"
                                stroke="#ef4444"
                                fill="url(#riskGradient)"
                                strokeWidth={2}
                            />
                            <defs>
                                <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Environmental + Supply Chain + Compliance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Environmental */}
                <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                        <Thermometer className="w-4 h-4 text-orange-500 dark:text-orange-400" /> Environmental Risk
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600 dark:text-slate-400">AQI Impact</span>
                            <span className={`font-bold ${(selectedCountry.environment?.baselineAQI ?? 50) > 100 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                AQI {selectedCountry.environment?.baselineAQI ?? 50}
                            </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500"
                                style={{ width: `${Math.min(100, ((selectedCountry.environment?.baselineAQI ?? 50) / 300) * 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Grid Carbon</span>
                            <span className="text-slate-900 dark:text-white font-bold">{selectedCountry.environment?.gridCarbonIntensity ?? 0.5} kgCO₂/kWh</span>
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-500 mt-2 p-2 bg-white dark:bg-slate-800/50 rounded border border-slate-200 dark:border-transparent">
                            High AQI reduces filter life, increasing maintenance costs and swap frequency.
                        </div>
                    </div>
                </div>

                {/* Supply Chain */}
                <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                        <Truck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Supply Chain Risk
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Import Difficulty</span>
                            <span className={`font-bold ${selectedCountry.id === 'ID' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {selectedCountry.id === 'ID' || selectedCountry.id === 'IN' ? 'High' : selectedCountry.id === 'JP' || selectedCountry.id === 'AU' ? 'Low' : 'Medium'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Critical Spares Lead</span>
                            <span className="text-slate-900 dark:text-white font-bold">
                                {selectedCountry.id === 'US' || selectedCountry.id === 'JP' ? '2-4 weeks' : '6-12 weeks'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Local MFG Availability</span>
                            <span className={`font-bold ${selectedCountry.id === 'US' || selectedCountry.id === 'JP' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                {selectedCountry.id === 'US' || selectedCountry.id === 'JP' || selectedCountry.id === 'DE' ? 'Good' : 'Limited'}
                            </span>
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-500 mt-2 p-2 bg-white dark:bg-slate-800/50 rounded border border-slate-200 dark:border-transparent">
                            Long lead times increase the risk of extended outages during equipment failure.
                        </div>
                    </div>
                </div>

                {/* Compliance */}
                <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Compliance Risk
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Data Sovereignty</span>
                            <span className={`font-bold ${selectedCountry.id === 'ID' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                                {selectedCountry.id === 'ID' ? 'PP 71/2019' : selectedCountry.id === 'DE' ? 'GDPR' : selectedCountry.id === 'JP' ? 'APPI' : 'Standard'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Labor Regulations</span>
                            <span className="text-slate-900 dark:text-white font-bold">
                                {selectedCountry.id === 'ID' ? 'PP 35/2021' : selectedCountry.id === 'JP' ? 'LSA' : 'Standard'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Certifications Required</span>
                            <span className="text-slate-900 dark:text-white font-bold">
                                {tierLevel === 4 ? 'Uptime IV, ISO 27001' : 'Uptime III, ISO 27001'}
                            </span>
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-500 mt-2 p-2 bg-white dark:bg-slate-800/50 rounded border border-slate-200 dark:border-transparent">
                            Non-compliance can result in operational shutdown or heavy penalties.
                        </div>
                    </div>
                </div>
            </div>

            {/* Mitigation Strategies */}
            <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Mitigation Strategies
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {topRisks.slice(0, 6).map((risk) => (
                        <div key={risk.id} className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
                            {getIcon(risk.category)}
                            <div>
                                <div className="text-xs font-medium text-slate-900 dark:text-white">{risk.title}</div>
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">→ {risk.mitigation}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
