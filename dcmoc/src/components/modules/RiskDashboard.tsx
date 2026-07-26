'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useSimulationStore, effectiveInHouseFrac } from '@/store/simulation';
import { ExportPDFButton } from '@/components/ui/ExportPDFButton';
import { calculateRiskProfile, calculateRiskScore, RiskScenario } from '@/modules/risk/RiskEngine';
import { computedDowntime } from '@/modules/risk/DowntimeCalculator';
import { useEngineReady } from '@/lib/rz-engine';
import { generateAssetCounts } from '@/lib/AssetGenerator';
import {
    AlertTriangle, ShieldAlert, Waves, Zap, Construction,
    Activity, TrendingUp, Clock, DollarSign, Thermometer,
    Droplets, Truck, FileCheck, Server
} from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { ScoreValue } from '@/components/ui/ScoreValue';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export default function RiskDashboard() {
    const { selectedCountry, inputs } = useSimulationStore();
    const tierLevel = (inputs.tierLevel === 4 ? 4 : 3) as 3 | 4;
    const [isExporting, setIsExporting] = useState(false);
    const [selectedRiskCell, setSelectedRiskCell] = useState<{ row: number; col: number } | null>(null);
    const engineReady = useEngineReady(); // re-run when rz-engine.min.js lands (deferred script)

    const analysis = useMemo(() => {
        if (!selectedCountry) return null;
        const coolingMap: 'air' | 'pumped' = inputs.coolingType === 'liquid' || inputs.coolingType === 'rdhx' ? 'pumped' : 'air';
        const assets = generateAssetCounts(inputs.itLoad, tierLevel, coolingMap, Math.ceil(inputs.itLoad * 0.6), inputs.coolingTopology, inputs.powerRedundancy);
        const risks = calculateRiskProfile(selectedCountry, tierLevel, assets);
        const aggregation = calculateRiskScore(risks, tierLevel);
        /* G-avail — COMPUTED availability: tier design anchor adjusted by the
         * maintenance strategy mix, sourcing split and selected SLA (engine
         * models.maintenance.availabilityImpact; falls back to the Uptime
         * design lookup when the engine is absent). */
        const downtime = computedDowntime(
            tierLevel,
            inputs.strategyMix,
            effectiveInHouseFrac(inputs),
            inputs.slaKey ?? '4hr',
            undefined,
            selectedCountry ?? undefined,
            inputs.pmRegime ?? 'oem-full'
        );
        return { risks, aggregation, downtime };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCountry, tierLevel, inputs.itLoad, inputs.coolingType, inputs.coolingTopology, inputs.powerRedundancy, inputs.headcount_Engineer,
        inputs.strategyMix, inputs.maintenanceModel, inputs.hybridRatio, inputs.slaKey, inputs.pmRegime, engineReady]);

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
            case 'Financial': return <DollarSign className="w-4 h-4 text-rz-data" />;
            default: return <AlertTriangle className="w-4 h-4 text-slate-400" />;
        }
    };

    const getSeverityColor = (prob: string, impact: string) => {
        const score = ({ 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 }[prob] || 2) * ({ 'Low': 1, 'Medium': 2, 'High': 3, 'Catastrophic': 4 }[impact] || 2);
        if (score >= 9) return 'border-red-500/50 bg-red-100 dark:bg-red-950/20';
        if (score >= 6) return 'border-amber-500/50 bg-amber-100 dark:bg-amber-950/20';
        return 'border-rz-data/50 bg-rz-data/10';
    };

    const matrixColor = (score: number, hasRisks: boolean) => {
        if (!hasRisks && score < 6) return 'bg-slate-200 dark:bg-slate-900/70';
        if (score >= 12) return 'bg-red-500/80 dark:bg-red-600/80';
        if (score >= 8) return 'bg-orange-500/75 dark:bg-orange-600/75';
        if (score >= 4) return 'bg-amber-500/70 dark:bg-amber-600/70';
        return 'bg-rz-data/70 dark:bg-rz-data/70';
    };

    const handleCellClick = useCallback((row: number, col: number, hasRisks: boolean) => {
        if (!hasRisks) return;
        setSelectedRiskCell(prev =>
            prev?.row === row && prev?.col === col ? null : { row, col }
        );
    }, []);

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
                        <ShieldAlert className="w-3 h-3" /> Risk Score <Tooltip content="Aggregated risk score across all categories. Higher = more risk. Normalized to % of maximum possible score." />
                    </div>
                    {/* Workstream M — ScoreValue: composite risk is LOWER-better; color keyed to the normalized (0-100) score */}
                    <div><ScoreValue value={normalizedScore} direction="lower" max={100} display={totalScore} className="text-3xl" /></div>
                    <div className={`text-xs mt-1 ${normalizedScore > 60 ? 'text-red-600 dark:text-red-400' : normalizedScore > 35 ? 'text-amber-600 dark:text-amber-400' : 'text-rz-data'}`}>
                        {normalizedScore}% of maximum • {risks.length} risks
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <div className="text-slate-500 dark:text-slate-400 text-xs uppercase mb-1 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> Financial Exposure <Tooltip content={downtime.engineLive
                            ? `Annual downtime exposure = COMPUTED downtime minutes (maintenance/SLA-adjusted availability) × tier-adjusted cost per minute (Uptime Institute 2025 benchmarks). Changing the strategy mix, sourcing split or SLA moves this number. Method: ${downtime.method}`
                            : 'Estimated annual cost of downtime events based on expected outage minutes × tier-adjusted cost per minute (Uptime Institute 2025 benchmarks).'} />
                    </div>
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                        ${Number.isFinite(downtime.financialImpact) ? (downtime.financialImpact / 1000).toFixed(0) : '—'}k
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        @ ${(downtime.costPerMinute / 1000).toFixed(1)}k/min × {downtime.expectedDowntimeMinutes} min/yr
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <div className="text-slate-500 dark:text-slate-400 text-xs uppercase mb-1 flex items-center gap-1">
                        <Activity className="w-3 h-3" /> {downtime.engineLive ? 'Computed Availability' : 'Availability'} <Tooltip content={downtime.engineLive
                            ? `Computed expected availability: the Uptime tier design point adjusted for your maintenance strategy mix, in-house/vendor split and selected SLA response class. Method: ${downtime.method}`
                            : `Expected annual uptime per Uptime Institute Tier Standard 2025. Tier III ≥ 99.982% (95 min/yr), Tier IV ≥ 99.99943% (26 min/yr). ${downtime.method}`} />
                    </div>
                    <div className="text-3xl font-bold text-rz-data">{downtime.availability}%</div>
                    <div className="text-xs text-slate-500 mt-1" title={downtime.method}>
                        {downtime.engineLive
                            ? <>design {downtime.designPct}% · now {downtime.availability}% (maintenance/SLA-adjusted{downtime.slaLabel ? ` · ${downtime.slaLabel}` : ''})</>
                            : <>Tier {tierLevel} SLA target</>}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <div className="text-slate-500 dark:text-slate-400 text-xs uppercase mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> SLA Breach Prob. <Tooltip content="Annual probability of exceeding the SLA downtime allowance. Factors in equipment age, maintenance strategy, and environmental conditions." />
                    </div>
                    <div className={`text-3xl font-bold ${slaBreachProbability > 0.1 ? 'text-red-600 dark:text-red-400' : 'text-rz-data'}`}>
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
                        <ShieldAlert className="w-4 h-4 text-cyan-400" /> Risk Matrix (Likelihood × Impact) <Tooltip content="5×5 risk assessment matrix mapping likelihood (Rare to Certain) against impact (Negligible to Catastrophic). Red zones require immediate mitigation." />
                    </h3>
                    <div className="relative">
                        <div className="text-[10px] text-slate-500 -rotate-90 absolute -left-7 top-1/2 -translate-y-1/2 whitespace-nowrap">
                            IMPACT →
                        </div>
                        <div className="ml-6">
                            {/* Y-axis labels */}
                            {(['Catastrophic', 'High', 'Medium', 'Low', 'Negligible'] as const).map((label, rowIdx) => {
                                const yTooltips: Record<string, string> = {
                                    'Catastrophic': 'Business-critical, >$10M loss',
                                    'High': 'Major disruption, $1M-$10M',
                                    'Medium': 'Significant impact, $100k-$1M',
                                    'Low': 'Minor disruption, $10k-$100k',
                                    'Negligible': 'Minimal impact, <$10k loss',
                                };
                                return (
                                <div key={label} className="flex items-center gap-1 mb-1">
                                    <div className="w-16 text-[10px] text-slate-500 text-right pr-2 flex items-center justify-end gap-0.5">
                                        <span>{label}</span>
                                        <Tooltip content={yTooltips[label]} />
                                    </div>
                                    {[0, 1, 2, 3, 4].map(colIdx => {
                                        const actualRow = 4 - rowIdx;
                                        const cell = matrix[actualRow]?.[colIdx];
                                        const hasRisks = cell && cell.risks.length > 0;
                                        const isSelected = selectedRiskCell?.row === actualRow && selectedRiskCell?.col === colIdx;
                                        return (
                                            <div
                                                key={colIdx}
                                                onClick={() => handleCellClick(actualRow, colIdx, !!hasRisks)}
                                                className={`flex-1 min-h-[2.5rem] rounded-sm flex flex-col items-center justify-center relative group ${matrixColor((colIdx + 1) * (actualRow + 1), !!hasRisks)}
                                                    ${hasRisks ? 'ring-1 ring-white/30 cursor-pointer hover:ring-2 hover:ring-white/60 transition-all' : ''}
                                                    ${isSelected ? 'ring-2 ring-cyan-400 z-10' : ''}`}
                                            >
                                                {hasRisks && (
                                                    <>
                                                        <div className="flex flex-col items-center px-0.5 overflow-hidden w-full">
                                                            {cell.risks.length === 1 ? (
                                                                <span className="text-[8px] leading-tight font-semibold text-white text-center truncate w-full px-0.5">{cell.risks[0].title}</span>
                                                            ) : (
                                                                <>
                                                                    <span className="text-[8px] leading-tight font-semibold text-white text-center truncate w-full px-0.5">{cell.risks[0].title}</span>
                                                                    <span className="text-[7px] text-white/80">+{cell.risks.length - 1} more</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        {/* Hover tooltip */}
                                                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-600 rounded p-2 hidden group-hover:block z-50 w-48">
                                                            {cell.risks.map(r => (
                                                                <div key={r.id} className="text-[10px] text-slate-300 mb-1 font-medium">{r.title}</div>
                                                            ))}
                                                            <div className="text-[9px] text-cyan-400 mt-1">Click for details</div>
                                                        </div>
                                                        {/* Click detail popup */}
                                                        {isSelected && (
                                                            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-slate-900 border border-cyan-500/50 rounded-lg p-3 z-[60] w-64 shadow-xl shadow-black/30"
                                                                onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-[10px] text-cyan-400 font-bold uppercase">Risk Details</span>
                                                                    <button onClick={() => setSelectedRiskCell(null)} className="text-slate-500 hover:text-white text-xs">✕</button>
                                                                </div>
                                                                {cell.risks.map(r => (
                                                                    <div key={r.id} className="mb-2 pb-2 border-b border-slate-700/50 last:border-0 last:mb-0 last:pb-0">
                                                                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                                                            {getIcon(r.category)}
                                                                            {r.title}
                                                                        </div>
                                                                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{r.description}</p>
                                                                        <div className="flex gap-2 mt-1">
                                                                            <span className="text-[9px] px-1 py-0.5 rounded bg-slate-800 text-slate-300">P: {r.probability}</span>
                                                                            <span className="text-[9px] px-1 py-0.5 rounded bg-slate-800 text-slate-300">I: {r.impact}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                            })}
                            {/* X-axis labels */}
                            <div className="flex items-center gap-1 mt-1">
                                <div className="w-16"></div>
                                {(['Rare', 'Unlikely', 'Possible', 'Likely', 'Certain'] as const).map(l => {
                                    const xTooltips: Record<string, string> = {
                                        'Rare': 'Less than 1% probability per year',
                                        'Unlikely': '1-10% probability',
                                        'Possible': '10-50% probability',
                                        'Likely': '50-90% probability',
                                        'Certain': 'Over 90% probability',
                                    };
                                    return (
                                        <div key={l} className="flex-1 text-[10px] text-slate-500 text-center flex flex-col items-center">
                                            <span className="flex items-center gap-0.5">{l}<Tooltip content={xTooltips[l]} /></span>
                                        </div>
                                    );
                                })}
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
                                    <div className="text-xs font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-transparent">
                                        {/* Workstream M — ScoreValue: scenario score P×I on a /20 scale, lower-better */}
                                        <ScoreValue value={risk.score} direction="lower" max={20} />
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
                        <Clock className="w-4 h-4 text-rz-mint" /> Downtime Analysis (Tier {tierLevel})
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                            <div className="text-[10px] text-slate-500 uppercase flex items-center">Expected Downtime <Tooltip content="Expected unplanned downtime minutes per year for the selected tier, adjusted for equipment age, maintenance strategy and environmental factors from the risk model. The Uptime tier budget is the reference (Tier III ≈ 95 min/yr, Tier IV ≈ 26 min/yr) — exceeding it drives the financial impact and SLA breach figures beside it." /></div>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">{downtime.expectedDowntimeMinutes} min</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">per year</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                            <div className="text-[10px] text-slate-500 uppercase flex items-center">Availability <Tooltip content="Annual uptime percentage implied by the expected downtime: availability = 1 − (downtime minutes ÷ 525,600). Compare against the Uptime tier expectation (Tier III ≥ 99.982%, Tier IV ≥ 99.995%). Redundancy level and MTTR move it most — see the Reliability engine for the full composed model." /></div>
                            <div className="text-xl font-bold text-rz-data">{downtime.availability}%</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400" title={downtime.method}>{downtime.engineLive ? `design ${downtime.designPct}% · adjusted` : 'annual uptime'}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                            <div className="text-[10px] text-slate-500 uppercase flex items-center">Financial Impact <Tooltip content="Annual downtime cost exposure = expected outage minutes × tier-adjusted cost per minute (Uptime Institute 2025 outage-cost benchmarks). A screening expectation for insurance and mitigation-budget sizing, not a worst-case single-event figure — one large outage can exceed the annual number on its own." /></div>
                            <div className="text-xl font-bold text-red-600 dark:text-red-400">
                                ${Number.isFinite(downtime.financialImpact) ? (downtime.financialImpact / 1000).toFixed(0) : '—'}k
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">annual exposure</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                            <div className="text-[10px] text-slate-500 uppercase flex items-center">SLA Breach Risk <Tooltip content="Probability of exceeding the SLA downtime allowance within a year, given the expected downtime for this tier and the equipment-age/maintenance adjustments. High values mean customer credits and reputational exposure — tighten the maintenance strategy or add redundancy before committing to aggressive SLAs." /></div>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">{downtime.slaBreachProbability}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">breach probability</div>
                        </div>
                    </div>
                    {/* MTTR / MTBF estimates */}
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase flex items-center">Est. MTTR <Tooltip content="Mean Time To Repair: average duration to restore equipment after failure." /></div>
                            <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
                                {tierLevel === 4 ? '15 min' : '45 min'}
                            </div>
                            <div className="text-[10px] text-slate-500">Mean Time To Repair</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase flex items-center">Est. MTBF <Tooltip content="Mean Time Between Failures: average operating time between equipment failures." /></div>
                            <div className="text-sm font-bold text-rz-data">
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
                            <span className="text-slate-600 dark:text-slate-400 flex items-center">AQI Impact <Tooltip content="Air Quality Index effect on equipment: high AQI accelerates filter clogging, increases cooling load, and may require facility shutdown above AQI 300." /></span>
                            <span className={`font-bold ${(selectedCountry.environment?.baselineAQI ?? 50) > 100 ? 'text-red-600 dark:text-red-400' : 'text-rz-data'}`}>
                                AQI {selectedCountry.environment?.baselineAQI ?? 50}
                            </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-[#00FF88] via-[#FFAA00] to-[#FF3030]"
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
                            <span className={`font-bold ${selectedCountry.id === 'ID' ? 'text-amber-600 dark:text-amber-400' : 'text-rz-data'}`}>
                                {selectedCountry.id === 'ID' || selectedCountry.id === 'IN' ? 'High' : selectedCountry.id === 'JP' || selectedCountry.id === 'AU' ? 'Low' : 'Medium'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600 dark:text-slate-400 flex items-center">Critical Spares Lead <Tooltip content="Lead time for procuring critical replacement parts. Longer lead times increase downtime risk during equipment failures." /></span>
                            <span className="text-slate-900 dark:text-white font-bold">
                                {selectedCountry.id === 'US' || selectedCountry.id === 'JP' ? '2-4 weeks' : '6-12 weeks'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Local MFG Availability</span>
                            <span className={`font-bold ${selectedCountry.id === 'US' || selectedCountry.id === 'JP' ? 'text-rz-data' : 'text-amber-600 dark:text-amber-400'}`}>
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
                        <FileCheck className="w-4 h-4 text-rz-data" /> Compliance Risk
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600 dark:text-slate-400 flex items-center">Data Sovereignty <Tooltip content="Legal requirements for data residency within national borders. References local regulations (e.g., Indonesia PP 71/2019, EU GDPR, Japan APPI)." /></span>
                            <span className={`font-bold ${selectedCountry.id === 'ID' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                                {selectedCountry.id === 'ID' ? 'PP 71/2019' : selectedCountry.id === 'DE' ? 'GDPR' : selectedCountry.id === 'JP' ? 'APPI' : 'Standard'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600 dark:text-slate-400 flex items-center">Labor Regulations <Tooltip content="Local employment laws affecting shift patterns, overtime limits, and worker protections (e.g., Indonesia PP 35/2021)." /></span>
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
                    <Server className="w-4 h-4 text-rz-data" /> Mitigation Strategies
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {topRisks.slice(0, 6).map((risk) => (
                        <div key={risk.id} className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
                            {getIcon(risk.category)}
                            <div>
                                <div className="text-xs font-medium text-slate-900 dark:text-white">{risk.title}</div>
                                <div className="text-[11px] text-rz-data mt-1">→ {risk.mitigation}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
