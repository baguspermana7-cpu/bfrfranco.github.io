'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { calculateStaffing } from '@/modules/staffing/ShiftEngine';
import { calculateTurnoverCost } from '@/modules/staffing/CostOfTurnover';
import { calculateEnvironmentalDegradation } from '@/modules/maintenance/EnvironmentalLogic';
import { calculateDowntimeRisk } from '@/modules/risk/DowntimeCalculator';
import { ASSETS } from '@/constants/assets';
import { COUNTRIES } from '@/constants/countries';
import { getPUE } from '@/constants/pue';
import { useEffectiveInputs } from '@/store/useEffectiveInputs';
import { rzData } from '@/lib/rz-engine';
import {
    Users, Wrench, Activity, AlertTriangle, ShieldAlert,
    ArrowRight, TrendingUp, DollarSign, CloudFog, Globe2, Zap
} from 'lucide-react';
import clsx from 'clsx';
import { fmtMoney, fmtMoneyFull, fmtCompact, fmtUnit } from '@/lib/format';
import { ConfigWizard } from '@/components/ui/ConfigWizard';
import { Tooltip } from '@/components/ui/Tooltip';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { PageTransition, CardMotion } from '@/components/ui/MotionWrapper';
import { motion, AnimatePresence } from 'framer-motion';

export function SimulationDashboard() {
    const { selectedCountry, inputs, actions, isLoading } = useSimulationStore();
    const effectiveInputs = useEffectiveInputs();
    const [activeScenario, setActiveScenario] = useState<'standard' | 'stress'>('standard');

    // Scenario State (Local override for "What-If")
    const [scenarioAQI, setScenarioAQI] = useState(inputs.aqiOverride ?? 50);
    const [scenarioTurnover, setScenarioTurnover] = useState(inputs.turnoverRate ?? 0.09);
    const [showWizard, setShowWizard] = useState(false);
    const [simYear, setSimYear] = useState(new Date().getFullYear());
    /* PREDEFINED sliders (owner): AQI baseline = country environment table;
     * turnover baseline = engine attrition avg. Manual slide = override (touched);
     * country change re-seeds only untouched sliders. */
    const baselineAqi = selectedCountry?.environment?.baselineAQI ?? 50;
    const baselineTurnover = (rzData()?.attritionFactors?.voluntaryAttritionAvg as number | undefined) ?? 0.15;
    const [aqiTouched, setAqiTouched] = useState(inputs.aqiOverride != null && inputs.aqiOverride !== baselineAqi);
    const [turnoverTouched, setTurnoverTouched] = useState(false);
    const [showLossDetail, setShowLossDetail] = useState(false);
    const [vizTab, setVizTab] = useState<'overview' | 'environment' | 'power' | 'cause'>('overview');
    useEffect(() => {
        if (!aqiTouched) setScenarioAQI(baselineAqi);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCountry?.id]);

    // Simulation Trigger Logic
    useEffect(() => {
        actions.setLoading(true);
        const timer = setTimeout(() => {
            actions.setLoading(false);
        }, 800); // Fake "crunching" time for effect
        return () => clearTimeout(timer);
    }, [inputs.shiftModel, simYear]); // Reduced dependencies to avoid infinite loops with the below effect

    // Update store when local state changes (debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            actions.setInputs({
                aqiOverride: scenarioAQI,
                turnoverRate: scenarioTurnover
            });
        }, 500);
        return () => clearTimeout(timer);
    }, [scenarioAQI, scenarioTurnover]);

    const results = useMemo(() => {
        if (!selectedCountry) return null;

        // --- TIME LOGIC (Inflation) ---
        const BASE_YEAR = 2026;
        const yearsElapsed = Math.max(0, simYear - BASE_YEAR);
        const inflationRate = selectedCountry.economy?.inflationRate ?? 0.03;
        const laborEscalation = selectedCountry.economy?.laborEscalation ?? 0.04;

        const laborMultiplier = Math.pow(1 + laborEscalation, yearsElapsed);
        const partsMultiplier = Math.pow(1 + inflationRate, yearsElapsed);

        // 1. Staffing Calculation — pass maintenance model + hybridRatio for proper correlation
        const opModel = inputs.maintenanceModel === 'vendor' ? 'vendor' : inputs.maintenanceModel === 'hybrid' ? 'hybrid' : 'in-house';
        const engHeadcount = effectiveInputs.headcount_Engineer ?? 4;
        const eng = calculateStaffing('engineer', engHeadcount, inputs.shiftModel, selectedCountry, true, undefined, undefined, opModel, inputs.hybridRatio ?? 0.5);

        // Turnover Calculation
        const coT = calculateTurnoverCost(
            'Duty Engineer',
            selectedCountry.labor.baseSalary_Engineer,
            selectedCountry,
            scenarioTurnover,
            eng.headcount
        );
        const turnoverAmortizedMonthly = (coT.totalAnnualCost / 12) * laborMultiplier;
        /* Delta vs engine-baseline turnover — the quantified lever for the Hidden-Loss explain panel */
        const coTBaseline = calculateTurnoverCost('Duty Engineer', selectedCountry.labor.baseSalary_Engineer, selectedCountry, baselineTurnover, eng.headcount);
        const lossSavedAtBaseline = Math.max(0, ((coT.totalAnnualCost - coTBaseline.totalAnnualCost) / 12) * laborMultiplier);

        // 2. Maintenance Calculation (Filter Life)
        // Filter Asset (PAC Unit G4)
        const pacUnit = ASSETS.find(a => a.id === 'pac-unit');
        const filterAsset = pacUnit?.consumables?.find(c => c.name.includes('Filter'));
        const baseLife = filterAsset?.baseLifeMonths ?? 3;

        const filterLife = calculateEnvironmentalDegradation(
            'pac-unit',
            'G4 Pre-Filters',
            baseLife,
            selectedCountry,
            scenarioAQI
        );

        // Safely extract life
        const actualLife = (filterLife && typeof filterLife.adjustedLifeMonths === 'number' && !isNaN(filterLife.adjustedLifeMonths))
            ? Math.max(0.5, filterLife.adjustedLifeMonths)
            : 3;

        // AQI Logic (Consumables)
        const basePartsBudget = 2500;
        const freshAirPortion = basePartsBudget * 0.20;
        const degradationRatio = 3 / actualLife;
        const aqiConsumablePenalty = freshAirPortion * (degradationRatio - 1);

        // Parts Cost with Inflation
        const partsCost = (basePartsBudget + (Number.isFinite(aqiConsumablePenalty) ? aqiConsumablePenalty : 0)) * partsMultiplier;

        // Staff Impact (Labor Penalty also escalates)
        const extraSwapsPerYear = Math.max(0, (12 / actualLife) - 4);
        const maintenanceLaborPunishment = ((extraSwapsPerYear * 240) / 12) * laborMultiplier;

        // NEW: Hazard Pay / Efficiency Loss Multiplier
        // Logic: AQI > 100 starts adding 5% per 50 points roughly. 
        // AQI 150 = +5%
        // AQI 300 = +20%
        const hazardThreshold = 100;
        let hazardMultiplier = 0;
        if (scenarioAQI > hazardThreshold) {
            hazardMultiplier = Math.pow((scenarioAQI - hazardThreshold) / 200, 1.2);
            // 200/200 = 1.0 (100% Increase at 300 AQI? No, too high.)
            // Let's cap it or scale it.
            // (300-100)/500 = 0.4 -> 40%.
            hazardMultiplier = (scenarioAQI - hazardThreshold) * 0.0015; // 0.0015 * 200 = 0.30 (30%)
            if (scenarioAQI > 250) hazardMultiplier += 0.10; // Extra penalty for hazardous zone
        }

        // 3. Risk Calculation
        const risk = calculateDowntimeRisk(inputs.tierLevel as 2 | 3 | 4, undefined, 4, selectedCountry ?? undefined);

        // 4. Total Monthly Staff Cost (Full Logic)
        const baseStaffCost = eng.monthlyCost;

        // Strategy Multiplier
        let strategyMultiplier = 1.0;
        if (inputs.maintenanceModel === 'vendor') strategyMultiplier = 1.35;
        if (inputs.maintenanceModel === 'hybrid') {
            const ratio = inputs.hybridRatio || 0.3;
            strategyMultiplier = (ratio * 1.0) + ((1 - ratio) * 1.30);
        }

        // Apply Labor Multiplier to Base Staff Cost
        const aqiLaborPunishment = maintenanceLaborPunishment + (baseStaffCost * hazardMultiplier * laborMultiplier);

        const finalMonthlyStaffCost = (baseStaffCost * strategyMultiplier * laborMultiplier) + turnoverAmortizedMonthly + aqiLaborPunishment;

        const monthlyInternalCost = baseStaffCost * laborMultiplier;
        const monthlyVendorCost = finalMonthlyStaffCost - monthlyInternalCost - aqiLaborPunishment - turnoverAmortizedMonthly;

        return {
            eng, coT, filterLife, risk, finalMonthlyStaffCost,
            aqiLaborPunishment, turnoverAmortizedMonthly, strategyMultiplier,
            partsCost, aqiConsumablePenalty, lossSavedAtBaseline,
            laborMultiplier, partsMultiplier,
            monthlyInternalCost,
            headcount: eng.headcount,
            monthlyVendorCost,
            totalMonthlyConsumables: partsCost,
            turnoverCost: turnoverAmortizedMonthly,
            aqiImpact: scenarioAQI / 50,
            overtimeHours: eng.metrics.overtimeHoursPerPerson,
            availability: risk.availability,
            downtimeMinutes: risk.expectedDowntimeMinutes,
            financialRisk: risk.financialImpact
        };
    }, [selectedCountry, inputs.shiftModel, scenarioAQI, scenarioTurnover, inputs.tierLevel, inputs.maintenanceModel, inputs.hybridRatio, simYear, baselineTurnover]);

    if (!selectedCountry || !results) return null;

    const {
        eng, coT, filterLife, risk, finalMonthlyStaffCost,
        aqiLaborPunishment, turnoverAmortizedMonthly, strategyMultiplier,
        partsCost, aqiConsumablePenalty, laborMultiplier, lossSavedAtBaseline
    } = results;

    return (
        <>
            {showWizard && <ConfigWizard onComplete={() => setShowWizard(false)} />}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:min-h-[calc(100vh-140px)]">

                {/* LEFT PANEL: CONTROLS */}
                <div className="lg:col-span-4 bg-slate-100 dark:bg-slate-900/50 border-b lg:border-b-0 lg:border-r border-slate-300 dark:border-slate-800 p-4 lg:p-6 overflow-y-auto">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-cyan-400" />
                            Scenario Controls
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={async () => {
                                    if (!results) return;
                                    const { generateSimulationPDF } = await import('@/modules/reporting/PdfGenerator');
                                    const { generateSimulationNarrative } = await import('@/modules/reporting/NarrativeEngine');

                                    const insights = generateSimulationNarrative(
                                        selectedCountry,
                                        scenarioAQI,
                                        results.risk,
                                        scenarioTurnover
                                    );

                                    await generateSimulationPDF(selectedCountry, simYear, {
                                        inputs: { ...inputs, shiftModel: inputs.shiftModel, turnoverRate: scenarioTurnover },
                                        results,
                                        insights
                                    });
                                }}
                                className="text-xs bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-700 px-2 py-1 rounded hover:bg-cyan-200 dark:hover:bg-cyan-800 transition-colors flex items-center gap-1"
                            >
                                <Users className="w-3 h-3" /> Export PDF
                            </button>
                            <button
                                onClick={() => setShowWizard(true)}
                                className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
                            >
                                Wizard
                            </button>
                        </div>
                    </h2>

                    {/* Location — DERIVED from the shared project country (owner: no duplicate
                        re-input; the single input lives in Requirements 1.1) */}
                    <div className="mb-8 space-y-2">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Globe2 className="w-3 h-3" /> Location
                            <Tooltip content="Project location (single source, entered in Requirements 1.1). Costs, regulations, and the labor market follow this country." />
                        </label>
                        <div className="flex items-center justify-between rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 px-3 py-2">
                            <span className="text-sm text-slate-900 dark:text-white">
                                {selectedCountry ? `${selectedCountry.name} (${selectedCountry.id})` : '—'}
                                <span className="ml-2 rounded bg-rz-data/15 px-1 text-[9px] font-bold text-rz-data">project</span>
                            </span>
                            <button onClick={() => actions.setActiveTab('requirements')}
                                className="text-[11px] text-rz-mint hover:underline">Edit in Requirements ↗</button>
                        </div>
                    </div>
                    <div className="mb-8">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            Simulation Year <Tooltip content={`This page's analysis control (NOT a duplicate requirement): projects staff cost to the operating year using inflation/benefit escalation. Multiplier: x${laborMultiplier.toFixed(2)}. The project COD basis lives in Requirements 1.1.`} />
                        </label>
                        <select
                            className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:ring-2 focus:ring-cyan-500 outline-none"
                            value={simYear}
                            onChange={(e) => setSimYear(Number(e.target.value))}
                        >
                            {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() + i).map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

                    {/* Shift Model */}
                    <div className="mb-8">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            Shift Model
                            <Tooltip content="Determines the shift pattern. 8-Hour (3 Shift) uses 3 teams rotating every 8 hours. 12-Hour (2 Shift) uses 2 teams rotating every 12 hours (Day/Night)." />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => actions.setInputs({ shiftModel: '8h' })}
                                className={clsx(
                                    "p-3 rounded-lg border text-sm font-medium transition-all",
                                    inputs.shiftModel === '8h'
                                        ? "bg-cyan-50 dark:bg-cyan-950/50 border-cyan-500 text-cyan-700 dark:text-cyan-200"
                                        : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600"
                                )}
                            >
                                8-Hour (3 Shift) <Tooltip content="8-Hour Continental: 3 shifts × 8 hours, 4 teams. Provides 24/7 coverage with standard shift lengths." />
                            </button>
                            <button
                                onClick={() => actions.setInputs({ shiftModel: '12h' })}
                                className={clsx(
                                    "p-3 rounded-lg border text-sm font-medium transition-all",
                                    inputs.shiftModel === '12h'
                                        ? "bg-cyan-50 dark:bg-cyan-950/50 border-cyan-500 text-cyan-700 dark:text-cyan-200"
                                        : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600"
                                )}
                            >
                                12-Hour (2 Shift) <Tooltip content="12-Hour 4on/3off: 2 shifts × 12 hours, 2 teams. Fewer handovers but longer shifts — may require regulatory permits." />
                            </button>
                        </div>
                        {inputs.shiftModel === '12h' && selectedCountry.id === 'ID' && (
                            <div className="mt-2 text-xs text-amber-400 flex items-start gap-1 p-2 bg-amber-950/30 rounded">
                                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <span>PP 35/2021 Warning: Requires "Long Shift Permit" or pays 14h OT/week.</span>
                            </div>
                        )}
                    </div>

                    {/* Environmental Stress */}
                    <div className="mb-8">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            Environmental Stress (AQI)
                            <Tooltip content="Air Quality Index (AQI). Higher values indicate worse air quality. IMPACT: Increases Filter Replacement Frequency AND Labor Cost (more maintenance visits required)." />
                        </label>
                        <input
                            type="range"
                            min="10"
                            max="300"
                            value={scenarioAQI}
                            onChange={(e) => { setScenarioAQI(Number(e.target.value)); setAqiTouched(true); }}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                        <div className="mt-1 flex items-center gap-2 text-[10px]">
                            {scenarioAQI === baselineAqi
                                ? <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-bold text-cyan-500" title={`Predefined from the ${selectedCountry.name} environment table (baselineAQI) — drag to override manually`}>≡ baseline {selectedCountry.id}: {baselineAqi} AQI</span>
                                : <>
                                    <span className="rounded bg-rz-mint/15 px-1.5 py-0.5 font-bold text-rz-mint">manual override</span>
                                    <button className="text-cyan-500 hover:underline" onClick={() => { setScenarioAQI(baselineAqi); setAqiTouched(false); }}>reset to baseline {selectedCountry.id} ({baselineAqi})</button>
                                </>}
                        </div>
                        <div className="flex justify-between mt-2 text-sm">
                            <span className="text-slate-500 dark:text-slate-400 flex items-center">Low (10) <Tooltip content="AQI 0-50: Good air quality, minimal equipment impact. AQI 150-300: Hazardous — accelerated filter degradation, increased cooling load, potential facility shutdown." /></span>
                            <span className="text-slate-900 dark:text-white font-bold">{scenarioAQI} AQI</span>
                            <span className="text-slate-500 dark:text-slate-400 flex items-center">Hazardous (300) <Tooltip content="AQI 0-50: Good air quality, minimal equipment impact. AQI 150-300: Hazardous — accelerated filter degradation, increased cooling load, potential facility shutdown." /></span>
                        </div>
                        {aqiLaborPunishment > 0 && (
                            <div className="mt-2 text-xs text-red-400 bg-red-950/20 p-2 rounded flex items-center gap-2">
                                <TrendingUp className="w-3 h-3" />
                                +{fmtMoneyFull(aqiLaborPunishment)} (Hazard Pay & Freq. Maint.)
                            </div>
                        )}
                    </div>

                    {/* Staff Turnover */}
                    <div className="mb-8">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            Annual Turnover Rate
                            <Tooltip content="Percentage of staff leaving per year. IMPACT: Adds hidden recruitment and training costs directly to the Monthly Staff Cost." />
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="0.5"
                            step="0.01"
                            value={scenarioTurnover}
                            onChange={(e) => { setScenarioTurnover(Number(e.target.value)); setTurnoverTouched(true); }}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                        <div className="mt-1 flex items-center gap-2 text-[10px]">
                            {Math.abs(scenarioTurnover - baselineTurnover) < 0.005
                                ? <span className="rounded bg-rz-data/15 px-1.5 py-0.5 font-bold text-rz-data" title="Predefined from engine DATA.attritionFactors.voluntaryAttritionAvg (sourced) — drag to override manually">≡ engine baseline: {(baselineTurnover * 100).toFixed(0)}%</span>
                                : <>
                                    <span className="rounded bg-rz-mint/15 px-1.5 py-0.5 font-bold text-rz-mint">manual override</span>
                                    <button className="text-cyan-500 hover:underline" onClick={() => { setScenarioTurnover(baselineTurnover); setTurnoverTouched(false); }}>reset to engine baseline ({(baselineTurnover * 100).toFixed(0)}%)</button>
                                </>}
                        </div>
                        <div className="flex justify-between mt-2 text-sm items-center">
                            <span className="text-slate-500 dark:text-slate-400 flex items-center text-xs">0% <Tooltip content="Annual employee turnover rate. Industry average 10-15%. Higher turnover increases recruitment costs and reduces operational continuity." /></span>
                            <span className="text-slate-900 dark:text-white font-bold">{(scenarioTurnover * 100).toFixed(0)}%</span>
                            <span className="text-slate-500 dark:text-slate-400 text-xs">50%</span>
                        </div>
                        <button onClick={() => setShowLossDetail((v) => !v)}
                            title="Click: why this number appears, the parameters causing it, and what needs changing"
                            className="mt-2 w-full text-left text-xs text-amber-400 bg-amber-950/20 p-2 rounded flex items-center gap-2 hover:bg-amber-950/40 transition-colors">
                            <DollarSign className="w-3 h-3" />
                            +{fmtMoneyFull(turnoverAmortizedMonthly)} Monthly Hidden Loss
                            <span className="ml-auto text-[9px] text-amber-500/80">{showLossDetail ? '▾ close' : '▸ why?'}</span>
                        </button>
                        {showLossDetail && (
                            <div className="mt-1 rounded border border-amber-500/30 bg-slate-900/60 p-2 text-[11px] text-slate-300 space-y-1.5">
                                <div>
                                    <span className="font-bold text-amber-400">Why:</span>{' '}
                                    ceil({eng.headcount} FTE × {(scenarioTurnover * 100).toFixed(0)}% turnover) = {Math.ceil(eng.headcount * scenarioTurnover)} replacements/yr
                                    × {fmtMoneyFull(coT.totalCostPerHire)}/hire ÷ 12 × escalation {laborMultiplier.toFixed(2)}.
                                </div>
                                <div className="text-slate-400">
                                    Per hire: severance {fmtMoneyFull(coT.separationCost)} + recruitment {fmtMoneyFull(coT.replacementCost)} + training {fmtMoneyFull(coT.trainingCost)} + productivity ramp-up {fmtMoneyFull(coT.productivityLoss)}
                                    {' '}({selectedCountry.name} engineer salary basis: {fmtMoneyFull(selectedCountry.labor.baseSalary_Engineer)}/mo — per-country labor table).
                                </div>
                                <div className="font-bold text-slate-200">What needs changing:</div>
                                <ul className="space-y-1">
                                    {scenarioTurnover > baselineTurnover + 0.004 && (
                                        <li>
                                            <button className="text-cyan-400 hover:underline" onClick={() => { setScenarioTurnover(baselineTurnover); setTurnoverTouched(false); }}>
                                                ▸ Lower turnover to baseline {(baselineTurnover * 100).toFixed(0)}% → save {fmtMoneyFull(lossSavedAtBaseline)}/mo
                                            </button>{' '}
                                            <span className="text-slate-500">(retention/benefit program — see the country benefit table)</span>
                                        </li>
                                    )}
                                    {inputs.shiftModel === '8h' && (
                                        <li>
                                            <button className="text-cyan-400 hover:underline" onClick={() => actions.setInputs({ shiftModel: '12h' })}>
                                                ▸ 12h shift (2 teams) → headcount drops → turnover exposure shrinks
                                            </button>
                                        </li>
                                    )}
                                    <li>
                                        <button className="text-cyan-400 hover:underline" onClick={() => actions.setActiveTab('requirements')}>
                                            ▸ Salary basis follows the project country — change the location in Requirements ↗
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>

                </div>

                {/* RIGHT PANEL: VISUALIZATION */}
                <div className="lg:col-span-8 p-4 lg:p-8 overflow-y-auto">

                    {/* section tabs — avoid a long dead-scroll; every panel reachable here */}
                    <div className="flex flex-wrap gap-1.5 mb-6 border-b border-slate-200 dark:border-slate-800 pb-2">
                        {([
                            ['overview', 'Overview'],
                            ['environment', 'Environment & Risk'],
                            ['power', 'Power & Cooling'],
                            ['cause', 'Cause-Effect Map'],
                        ] as const).map(([id, label]) => (
                            <button key={id} onClick={() => setVizTab(id)}
                                className={clsx('rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                                    vizTab === id
                                        ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'
                                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200')}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {vizTab === 'overview' && (<>
                    {/* --- KPI CARDS ROW --- */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {/* Internal Staff Cost */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-2">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                    Internal Staff Cost
                                    <Tooltip content="Monthly base salary + allowances for FTEs" />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white truncate" title={fmtMoneyFull(results.monthlyInternalCost)}>
                                {fmtMoney(results.monthlyInternalCost)}
                            </div>
                            <div className="text-[10px] text-rz-data mt-1 flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {results.headcount} Internal FTEs
                            </div>
                        </div>

                        {/* Vendor Labor Cost */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-2">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                    Vendor Labor Cost
                                    <Tooltip content="Outsourced specialist services (Security, Cleaning, MEP)" />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-amber-500 dark:text-amber-400 truncate" title={fmtMoneyFull(results.monthlyVendorCost)}>
                                {fmtMoney(results.monthlyVendorCost)}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                                Includes 35% Vendor Premium
                            </div>
                        </div>

                        {/* Parts & Consumables */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-2">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                    Parts & Consumables
                                    <Tooltip content="Monthly maintenance consumables based on AQI impact" />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-cyan-500 dark:text-cyan-400 truncate" title={fmtMoneyFull(results.totalMonthlyConsumables)}>
                                {fmtMoney(results.totalMonthlyConsumables)}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                                AQI Impact: {results.aqiImpact > 1 ? 'High' : 'None'}
                            </div>
                        </div>

                        {/* Hidden Turnover Loss */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-2">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                    Hidden Turnover Loss
                                    <Tooltip content="Recruitment + Training + Lost Productivity" />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-rose-500 dark:text-rose-400 truncate" title={fmtMoneyFull(results.turnoverCost)}>
                                {fmtMoney(results.turnoverCost)}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                                Rate: {(scenarioTurnover * 100).toFixed(0)}% / Year
                            </div>
                        </div>
                    </div>

                    {/* --- OVERTIME REGULATORY ANALYSIS --- */}
                    <div className="bg-slate-200 dark:bg-slate-700/50 rounded-xl p-6 border border-slate-300 dark:border-slate-600 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-4 h-4 text-rz-data" />
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">Overtime & Regulatory Analysis (PP 35/2021) <Tooltip content="Overtime cost calculation based on local labor law multipliers. First 1-2 hours typically at 1.5x, subsequent hours at 2x base rate." /></h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-600 dark:text-slate-400 flex items-center">Weekly OT Hours/Person <Tooltip content="Maximum overtime hours per person per week. Subject to local labor law limits (e.g., Indonesia max 14hrs/week, EU max 8hrs/week)." /></span>
                                    <span className="text-slate-900 dark:text-white font-mono font-bold">{results.overtimeHours.toFixed(1)} hrs</span>
                                </div>
                                <div className="h-2 bg-slate-300 dark:bg-slate-600 rounded-full overflow-hidden">
                                    <div
                                        className={clsx("h-full transition-all duration-500", results.overtimeHours > 12 ? "bg-red-500" : "bg-rz-data")}
                                        style={{ width: `${Math.min(100, (results.overtimeHours / 18) * 100)}%` }}
                                    />
                                </div>
                                <div className="text-[10px] text-slate-500 mt-2 leading-tight">
                                    Legal limit for 12h shifts without permit is strict. {'>'}18h/week incurs 4.0x multiplier penalty.
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs border-b border-slate-300 dark:border-slate-600/50 pb-1">
                                    <span className="text-slate-600 dark:text-slate-400 flex items-center">Engineer Base Salary <Tooltip content="Country engineer base salary from the selected market's labor profile." /></span>
                                    <span className="text-slate-900 dark:text-white font-mono">${selectedCountry.labor.baseSalary_Engineer.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                                    <span className="flex items-center">Overtime Rate (1st hr) <Tooltip content="Overtime premium per hour = hourly base × (workday first-hour multiplier − 1), from the country's overtime rules." /></span>
                                    <span className="font-mono">${((selectedCountry.labor.baseSalary_Engineer / 2080) * (selectedCountry.labor.overtimeRules.workday.firstHour - 1)).toFixed(2)}/hr</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    </>)}

                    {vizTab === 'environment' && (<>
                    {/* --- ENVIRONMENTAL PHYSICS --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="bg-slate-200 dark:bg-slate-700/50 rounded-xl p-6 border border-slate-300 dark:border-slate-600">
                            <div className="flex items-center gap-2 mb-4">
                                <CloudFog className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">Environmental Physics (Power Law) <Tooltip content="Mathematical model of environmental impact on equipment: temperature derating, humidity corrosion factor, and particulate accumulation rates." /></h3>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="flex-1 bg-slate-300 dark:bg-slate-800/50 p-3 rounded-lg font-mono text-[10px] text-rz-data border border-slate-400 dark:border-slate-700/50">
                                    <div className="text-slate-500 dark:text-slate-500 mb-1">Mathematical Formula</div>
                                    Life_Actual = Life_Base × (AQI_Base / AQI_Actual)^1.5
                                </div>
                                <div className="w-24 text-right">
                                    <div className="text-[10px] text-slate-500 font-bold mb-1">Impact</div>
                                    <div className="text-xs text-slate-700 dark:text-slate-300">
                                        {scenarioAQI > 150 ? 'Severe Degradation' : scenarioAQI > 100 ? 'Accelerated Wear' : 'Standard operation'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-200 dark:bg-slate-700/50 rounded-xl p-6 border border-slate-300 dark:border-slate-600">
                            <div className="flex items-center gap-2 mb-4">
                                <ShieldAlert className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Risk & Downtime Exposure (Tier {inputs.tierLevel})</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1">Expected Availability <Tooltip content="Percentage of time the facility is operational. Determined by tier level and redundancy design." /></div>
                                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{results.availability.toFixed(3)}%</div>
                                    <div className="text-[10px] text-slate-500">~{results.downtimeMinutes} mins downtime / year</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1">Financial Exposure <Tooltip content="Maximum estimated financial loss from downtime events over a year, calculated at $5K per minute." /></div>
                                    <div className="text-2xl font-bold text-rose-500 dark:text-rose-400 truncate" title={fmtMoneyFull(results.financialRisk)}>
                                        {fmtMoney(results.financialRisk)}
                                    </div>
                                    <div className="text-[10px] text-slate-500">@ $5k/min business impact</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Environmental Impact (relocated into Environment tab) */}
                    <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-6 mb-6">
                        <h3 className="text-md font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <CloudFog className="w-4 h-4 text-rz-data" />
                            Environmental Impact
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {(() => {
                                const gridCarbonIntensity = selectedCountry!.environment?.gridCarbonIntensity ?? 0.50;
                                const envPue = getPUE(inputs.coolingType);
                                const annualMWh = (inputs.itLoad * envPue * 8760) / 1000;
                                const annualCO2Tonnes = annualMWh * gridCarbonIntensity;
                                return (
                                    <>
                                        <div className="bg-white dark:bg-black/30 p-3 rounded-lg text-center border border-slate-200 dark:border-slate-800/50">
                                            <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">Grid Carbon <Tooltip content="Carbon intensity of the local electricity grid in kgCO2 per kWh consumed." /></div>
                                            <div className="text-xl font-bold text-amber-500 dark:text-amber-400">{gridCarbonIntensity.toFixed(2)}</div>
                                            <div className="text-[10px] text-slate-500">kgCO₂/kWh</div>
                                        </div>
                                        <div className="bg-white dark:bg-black/30 p-3 rounded-lg text-center border border-slate-200 dark:border-slate-800/50">
                                            <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">Annual CO₂ <Tooltip content="Total Scope 2 carbon emissions from grid electricity consumption." /></div>
                                            <div className="text-xl font-bold text-orange-500 dark:text-orange-400">{(annualCO2Tonnes / 1000).toFixed(1)}k</div>
                                            <div className="text-[10px] text-slate-500">tonnes/year</div>
                                        </div>
                                        <div className="bg-white dark:bg-black/30 p-3 rounded-lg text-center border border-slate-200 dark:border-slate-800/50">
                                            <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">WUE (est.) <Tooltip content="Water Usage Effectiveness — liters of water consumed per kWh of IT energy. Lower is better." /></div>
                                            <div className="text-xl font-bold text-blue-500 dark:text-blue-400">{(selectedCountry!.environment?.baselineAQI ?? 50) > 80 ? '1.8' : '1.2'}</div>
                                            <div className="text-[10px] text-slate-500">L/kWh</div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                    </>)}

                    {vizTab === 'power' && (<>
                    {/* --- POWER & COOLING ANALYTICS --- */}
                    <div className="bg-slate-200 dark:bg-slate-700/50 rounded-xl p-6 border border-slate-300 dark:border-slate-600 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Zap className="w-4 h-4 text-orange-500 dark:text-amber-400" />
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Power & Cooling Analytics</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            {(() => {
                                const pue = getPUE(inputs.coolingType);
                                const coolingLoadKw = Math.round(inputs.itLoad * (pue - 1));
                                const coolingPct = Math.round((pue - 1) * 100);
                                const totalFacilityKw = Math.round(inputs.itLoad * pue);
                                const annualEnergyMWh = Math.round(totalFacilityKw * 8760 / 1000);
                                const elecRate = selectedCountry?.economy?.electricityRate ?? 0.10;
                                const annualCost = Math.round(totalFacilityKw * 8760 * elecRate);
                                const pueLabel = pue <= 1.15 ? 'Excellent' : pue <= 1.25 ? 'Very Good' : pue <= 1.35 ? 'Good' : 'Average';
                                return (
                                    <>
                                        <div className="bg-slate-300 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-400 dark:border-slate-700">
                                            <div className="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase mb-1 flex items-center gap-1">PUE <Tooltip content="Power Usage Effectiveness — ratio of total facility power to IT equipment power. Lower is better (1.0 = perfect)." /></div>
                                            <div className="text-lg font-bold text-orange-600 dark:text-amber-400">{pue.toFixed(2)}</div>
                                            <div className="text-[9px] text-slate-500">{pueLabel}</div>
                                        </div>
                                        <div className="bg-slate-300 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-400 dark:border-slate-700">
                                            <div className="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase mb-1 flex items-center gap-1">Cooling Load <Tooltip content="Power consumed by cooling systems in kW. Derived from IT load multiplied by (PUE - 1)." /></div>
                                            <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{fmtUnit(coolingLoadKw, 'kW')}</div>
                                            <div className="text-[9px] text-slate-500">{coolingPct}% overhead</div>
                                        </div>
                                        <div className="bg-slate-300 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-400 dark:border-slate-700">
                                            <div className="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase mb-1 flex items-center gap-1">Total Facility <Tooltip content="Total facility power consumption including IT load, cooling, lighting, UPS losses, and mechanical systems. Total = IT Load × PUE." /></div>
                                            <div className="text-lg font-bold text-slate-900 dark:text-white">{fmtUnit(totalFacilityKw, 'kW')}</div>
                                            <div className="text-[9px] text-slate-500">IT + Cooling + Losses</div>
                                        </div>
                                        <div className="bg-slate-300 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-400 dark:border-slate-700">
                                            <div className="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase mb-1 flex items-center gap-1">Annual Energy <Tooltip content="Total facility energy consumption over a year in megawatt-hours." /></div>
                                            <div className="text-lg font-bold text-rz-mint truncate">{fmtUnit(annualEnergyMWh, 'MWh')}</div>
                                            <div className="text-[9px] text-slate-500">{fmtMoney(annualCost)} @ ${elecRate.toFixed(2)}</div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        <div className="mt-4">
                            <div className="text-[9px] text-slate-500 font-bold uppercase mb-2">Power Chain Efficiency</div>
                            <div className="flex flex-wrap items-center text-[10px] font-mono gap-1">
                                <div className="bg-rz-data/15 text-rz-data px-2 py-1 rounded w-24 text-center">Grid 98%</div>
                                <div className="text-slate-400">→</div>
                                <div className="bg-blue-500/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded w-24 text-center">UPS 94%</div>
                                <div className="text-slate-400">→</div>
                                <div className="bg-rz-data/20 text-rz-data px-2 py-1 rounded w-24 text-center">PDU 97%</div>
                                <div className="text-slate-400">→</div>
                                <div className="bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 px-2 py-1 rounded w-24 text-center">IT Load OK</div>
                            </div>
                        </div>
                    </div>
                    </>)}

                    {vizTab === 'cause' && (<>
                    {/* Cause-Effect Lever Map */}
                    <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-6">
                <h3 className="text-md font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-cyan-500" />
                    Cause-Effect Lever Map
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">How each input parameter ripples through to cost and risk outputs</p>
                <div className="space-y-3">
                    {[
                        {
                            lever: 'Rack Density 10kW to 20kW',
                            effect: 'Floor space requirement halved, but cooling delta-T compression adds ~18% to PUE',
                            impact: 'high',
                            direction: 'mixed',
                        },
                        {
                            lever: 'Tier III to Tier IV redundancy',
                            effect: 'CAPEX increases ~$2.5M/MW (full 2N active systems), uptime moves from 99.982% to 99.99943% — only worthwhile if downtime cost exceeds ~$500K/yr',
                            impact: 'high',
                            direction: 'cost-up',
                        },
                        {
                            lever: 'AQI 50 to 150 (Moderate to Unhealthy)',
                            effect: 'Filter replacement frequency doubles (3mo to 1.5mo), hazard pay activates (+15% labor), cooling coil fouling adds maintenance cycles',
                            impact: 'medium',
                            direction: 'cost-up',
                        },
                        {
                            lever: 'Turnover rate 10% to 25%',
                            effect: 'Hidden monthly loss triples (recruitment, onboarding, ramp-up productivity gap). A single FTE replacement costs 1.5x annual salary',
                            impact: 'high',
                            direction: 'cost-up',
                        },
                        {
                            lever: '8-Hour (3 Shift) to 12-Hour (2 Shift)',
                            effect: 'Headcount reduces by ~25% but per-person overtime exposure increases. In Indonesia, requires long-shift permit or triggers 14hr/week OT at 2x rate',
                            impact: 'medium',
                            direction: 'mixed',
                        },
                        {
                            lever: 'In-house to Vendor maintenance model',
                            effect: 'Specialist expertise on-demand but 35% cost premium on all labor. For complex M&E systems, vendor SLAs can reduce MTTR by 40%',
                            impact: 'medium',
                            direction: 'cost-up',
                        },
                        {
                            lever: 'Air cooling to Direct Liquid Cooling',
                            effect: 'PUE drops from ~1.50 to ~1.15, saving ~$X/yr in energy. CAPEX premium of $200-500K per MW for liquid distribution. Break-even typically 3-5 years at $0.10/kWh',
                            impact: 'high',
                            direction: 'mixed',
                        },
                    ].map((row, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                            <div className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                                row.direction === 'cost-up' ? 'bg-rose-400' :
                                row.direction === 'mixed' ? 'bg-amber-400' : 'bg-rz-data'
                            }`} />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-0.5">{row.lever}</div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{row.effect}</div>
                            </div>
                            <div className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                row.impact === 'high' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' :
                                'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            }`}>
                                {row.impact}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Increases cost</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Mixed (cost + benefit)</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rz-data inline-block" /> Reduces cost</span>
                </div>
            </div>
                    </>)}

                </div>
            </div>
        </>
    );
}
