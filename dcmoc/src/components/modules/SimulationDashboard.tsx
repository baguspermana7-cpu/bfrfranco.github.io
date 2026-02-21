'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { calculateStaffing } from '@/modules/staffing/ShiftEngine';
import { calculateTurnoverCost } from '@/modules/staffing/CostOfTurnover';
import { calculateEnvironmentalDegradation } from '@/modules/maintenance/EnvironmentalLogic';
import { calculateDowntimeRisk } from '@/modules/risk/DowntimeCalculator';
import { ASSETS } from '@/constants/assets';
import { COUNTRIES } from '@/constants/countries';
import {
    Users, Wrench, Activity, AlertTriangle, ShieldAlert,
    ArrowRight, TrendingUp, DollarSign, CloudFog, Globe2, Zap
} from 'lucide-react';
import clsx from 'clsx';
import { ConfigWizard } from '@/components/ui/ConfigWizard';
import { Tooltip } from '@/components/ui/Tooltip';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { PageTransition, CardMotion } from '@/components/ui/MotionWrapper';
import { motion, AnimatePresence } from 'framer-motion';

// Region-grouped countries (same pattern as CapexDashboard)
const REGIONS = Object.values(COUNTRIES).reduce((acc, c) => {
    if (!acc[c.region]) acc[c.region] = [];
    acc[c.region].push(c);
    return acc;
}, {} as Record<string, typeof COUNTRIES[keyof typeof COUNTRIES][]>);

const REGION_LABELS: Record<string, string> = {
    'APAC': '🌏 Asia Pacific',
    'EMEA': '🌍 Europe',
    'AMER': '🌎 Americas',
    'MENA': '🏜️ Middle East',
    'AFR': '🌍 Africa',
    'LATAM': '🌎 Latin America',
};

export function SimulationDashboard() {
    const { selectedCountry, inputs, actions, isLoading } = useSimulationStore();
    const [activeScenario, setActiveScenario] = useState<'standard' | 'stress'>('standard');

    // Scenario State (Local override for "What-If")
    const [scenarioAQI, setScenarioAQI] = useState(inputs.aqiOverride ?? 50);
    const [scenarioTurnover, setScenarioTurnover] = useState(inputs.turnoverRate ?? 0.09);
    const [showWizard, setShowWizard] = useState(false);
    const [simYear, setSimYear] = useState(2025);
    const [selectedRegion, setSelectedRegion] = useState(selectedCountry?.region || 'APAC');

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

    // Sync region when country changes externally (e.g. scenario load)
    useEffect(() => {
        if (selectedCountry && selectedCountry.region !== selectedRegion) {
            setSelectedRegion(selectedCountry.region);
        }
    }, [selectedCountry?.id]);

    const results = useMemo(() => {
        if (!selectedCountry) return null;

        // --- TIME LOGIC (Inflation) ---
        const yearsElapsed = Math.max(0, simYear - 2025);
        const inflationRate = selectedCountry.economy?.inflationRate ?? 0.03;
        const laborEscalation = selectedCountry.economy?.laborEscalation ?? 0.04;

        const laborMultiplier = Math.pow(1 + laborEscalation, yearsElapsed);
        const partsMultiplier = Math.pow(1 + inflationRate, yearsElapsed);

        // 1. Staffing Calculation — pass maintenance model + hybridRatio for proper correlation
        const opModel = inputs.maintenanceModel === 'vendor' ? 'vendor' : inputs.maintenanceModel === 'hybrid' ? 'hybrid' : 'in-house';
        const eng = calculateStaffing('engineer', 4, inputs.shiftModel, selectedCountry, true, undefined, undefined, opModel, inputs.hybridRatio ?? 0.5);

        // Turnover Calculation
        const coT = calculateTurnoverCost(
            'Duty Engineer',
            selectedCountry.labor.baseSalary_Engineer,
            selectedCountry,
            scenarioTurnover,
            eng.headcount
        );
        const turnoverAmortizedMonthly = (coT.totalAnnualCost / 12) * laborMultiplier;

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
            partsCost, aqiConsumablePenalty,
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
    }, [selectedCountry, inputs.shiftModel, scenarioAQI, scenarioTurnover, inputs.tierLevel, inputs.maintenanceModel, inputs.hybridRatio, simYear]);

    if (!selectedCountry || !results) return null;

    const {
        eng, coT, filterLife, risk, finalMonthlyStaffCost,
        aqiLaborPunishment, turnoverAmortizedMonthly, strategyMultiplier,
        partsCost, aqiConsumablePenalty, laborMultiplier
    } = results;

    return (
        <>
            {showWizard && <ConfigWizard onComplete={() => setShowWizard(false)} />}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">

                {/* LEFT PANEL: CONTROLS */}
                <div className="lg:col-span-4 bg-slate-100 dark:bg-slate-900/50 border-r border-slate-300 dark:border-slate-800 p-6 overflow-y-auto">
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

                    {/* Region & Country Selector */}
                    <div className="mb-8 space-y-3">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Globe2 className="w-3 h-3" /> Region & Country
                            <Tooltip content="Select datacenter location. Costs, regulations, and labor markets vary by country." />
                        </label>
                        <select
                            className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:ring-2 focus:ring-cyan-500 outline-none"
                            value={selectedRegion}
                            onChange={(e) => {
                                const newRegion = e.target.value as 'APAC' | 'EMEA' | 'AMER' | 'MENA' | 'AFR' | 'LATAM';
                                setSelectedRegion(newRegion);
                                const countriesInRegion = REGIONS[newRegion];
                                if (countriesInRegion && countriesInRegion.length > 0) {
                                    actions.selectCountry(countriesInRegion[0].id);
                                }
                            }}
                        >
                            {Object.keys(REGIONS).sort().map(region => (
                                <option key={region} value={region}>
                                    {REGION_LABELS[region] || region}
                                </option>
                            ))}
                        </select>
                        <select
                            className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:ring-2 focus:ring-cyan-500 outline-none"
                            value={selectedCountry?.id || ''}
                            onChange={(e) => actions.selectCountry(e.target.value)}
                        >
                            {(REGIONS[selectedRegion] || []).map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({c.id})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="mb-8">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            Simulation Year <Tooltip content={`Projects costs into the future using inflation and yearly benefit escalation constants. Multiplier: x${laborMultiplier.toFixed(2)}`} />
                        </label>
                        <select
                            className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-md text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:ring-2 focus:ring-cyan-500 outline-none"
                            value={simYear}
                            onChange={(e) => setSimYear(Number(e.target.value))}
                        >
                            {Array.from({ length: 11 }, (_, i) => 2025 + i).map(year => (
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
                                8-Hour (3 Shift)
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
                                12-Hour (2 Shift)
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
                            onChange={(e) => setScenarioAQI(Number(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                        <div className="flex justify-between mt-2 text-sm">
                            <span className="text-slate-500 dark:text-slate-400">Low (10)</span>
                            <span className="text-slate-900 dark:text-white font-bold">{scenarioAQI} AQI</span>
                            <span className="text-slate-500 dark:text-slate-400">Hazardous (300)</span>
                        </div>
                        {aqiLaborPunishment > 0 && (
                            <div className="mt-2 text-xs text-red-400 bg-red-950/20 p-2 rounded flex items-center gap-2">
                                <TrendingUp className="w-3 h-3" />
                                +{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(aqiLaborPunishment)} (Hazard Pay & Freq. Maint.)
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
                            onChange={(e) => setScenarioTurnover(Number(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                        <div className="flex justify-end mt-2 text-sm">
                            <span className="text-slate-900 dark:text-white font-bold">{(scenarioTurnover * 100).toFixed(0)}%</span>
                        </div>
                        <div className="mt-2 text-xs text-amber-400 bg-amber-950/20 p-2 rounded flex items-center gap-2">
                            <DollarSign className="w-3 h-3" />
                            +{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(turnoverAmortizedMonthly)} Monthly Hidden Loss
                        </div>
                    </div>

                </div>

                {/* RIGHT PANEL: VISUALIZATION */}
                <div className="lg:col-span-8 p-8 overflow-y-auto">

                    {/* --- KPI CARDS ROW --- */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {/* Internal Staff Cost */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-2">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                    Internal Staff Cost
                                    <Tooltip content="Monthly base salary + allowances for FTEs" />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white truncate" title={results.monthlyInternalCost.toLocaleString()}>
                                ${results.monthlyInternalCost.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
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
                            <div className="text-2xl font-bold text-amber-500 dark:text-amber-400 truncate" title={results.monthlyVendorCost.toLocaleString()}>
                                ${results.monthlyVendorCost.toLocaleString()}
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
                            <div className="text-2xl font-bold text-cyan-500 dark:text-cyan-400 truncate" title={results.totalMonthlyConsumables.toLocaleString()}>
                                ${results.totalMonthlyConsumables.toLocaleString()}
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
                            <div className="text-2xl font-bold text-rose-500 dark:text-rose-400 truncate" title={Math.round(results.turnoverCost).toLocaleString()}>
                                ${Math.round(results.turnoverCost).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                                Rate: {(scenarioTurnover * 100).toFixed(0)}% / Year
                            </div>
                        </div>
                    </div>

                    {/* --- OVERTIME REGULATORY ANALYSIS --- */}
                    <div className="bg-slate-200 dark:bg-slate-700/50 rounded-xl p-6 border border-slate-300 dark:border-slate-600 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Overtime & Regulatory Analysis (PP 35/2021)</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-600 dark:text-slate-400">Weekly OT Hours/Person</span>
                                    <span className="text-slate-900 dark:text-white font-mono font-bold">{results.overtimeHours.toFixed(1)} hrs</span>
                                </div>
                                <div className="h-2 bg-slate-300 dark:bg-slate-600 rounded-full overflow-hidden">
                                    <div
                                        className={clsx("h-full transition-all duration-500", results.overtimeHours > 12 ? "bg-red-500" : "bg-emerald-500")}
                                        style={{ width: `${Math.min(100, (results.overtimeHours / 18) * 100)}%` }}
                                    />
                                </div>
                                <div className="text-[10px] text-slate-500 mt-2 leading-tight">
                                    Legal limit for 12h shifts without permit is strict. {'>'}18h/week incurs 4.0x multiplier penalty.
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs border-b border-slate-300 dark:border-slate-600/50 pb-1">
                                    <span className="text-slate-600 dark:text-slate-400">Base Salary</span>
                                    <span className="text-slate-900 dark:text-white font-mono">${(20000).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                                    <span>Overtime Penalty</span>
                                    <span className="font-mono">${(1126.30).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- ENVIRONMENTAL PHYSICS --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="bg-slate-200 dark:bg-slate-700/50 rounded-xl p-6 border border-slate-300 dark:border-slate-600">
                            <div className="flex items-center gap-2 mb-4">
                                <CloudFog className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Environmental Physics (Power Law)</h3>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="flex-1 bg-slate-300 dark:bg-slate-800/50 p-3 rounded-lg font-mono text-[10px] text-emerald-700 dark:text-emerald-400 border border-slate-400 dark:border-slate-700/50">
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
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Expected Availability</div>
                                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{results.availability.toFixed(3)}%</div>
                                    <div className="text-[10px] text-slate-500">~{results.downtimeMinutes} mins downtime / year</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Financial Exposure</div>
                                    <div className="text-2xl font-bold text-rose-500 dark:text-rose-400 truncate" title={Math.round(results.financialRisk).toLocaleString()}>
                                        ${Math.round(results.financialRisk).toLocaleString()}
                                    </div>
                                    <div className="text-[10px] text-slate-500">@ $5k/min business impact</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- POWER & COOLING ANALYTICS --- */}
                    <div className="bg-slate-200 dark:bg-slate-700/50 rounded-xl p-6 border border-slate-300 dark:border-slate-600 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Zap className="w-4 h-4 text-orange-500 dark:text-amber-400" />
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Power & Cooling Analytics</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <div className="bg-slate-300 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-400 dark:border-slate-700">
                                <div className="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase mb-1">PUE</div>
                                <div className="text-lg font-bold text-orange-600 dark:text-amber-400">1.45</div>
                                <div className="text-[9px] text-slate-500">Good</div>
                            </div>
                            <div className="bg-slate-300 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-400 dark:border-slate-700">
                                <div className="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase mb-1">Cooling Load</div>
                                <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">450 kW</div>
                                <div className="text-[9px] text-slate-500">31% overhead</div>
                            </div>
                            <div className="bg-slate-300 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-400 dark:border-slate-700">
                                <div className="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase mb-1">Total Facility</div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white">1450 KW</div>
                                <div className="text-[9px] text-slate-500">IT + Cooling + Losses</div>
                            </div>
                            <div className="bg-slate-300 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-400 dark:border-slate-700">
                                <div className="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase mb-1">Annual Energy</div>
                                <div className="text-lg font-bold text-violet-600 dark:text-purple-400 truncate">12702 MWh</div>
                                <div className="text-[9px] text-slate-500">$1,270,200 @ $0.10</div>
                            </div>
                        </div>

                        <div className="mt-4">
                            <div className="text-[9px] text-slate-500 font-bold uppercase mb-2">Power Chain Efficiency</div>
                            <div className="flex items-center text-[10px] font-mono gap-1">
                                <div className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded w-24 text-center">Grid → 98%</div>
                                <div className="text-slate-400">→</div>
                                <div className="bg-blue-500/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded w-24 text-center">UPS → 94%</div>
                                <div className="text-slate-400">→</div>
                                <div className="bg-purple-500/20 text-purple-700 dark:text-purple-400 px-2 py-1 rounded w-24 text-center">PDU → 97%</div>
                                <div className="text-slate-400">→</div>
                                <div className="bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 px-2 py-1 rounded w-24 text-center">IT Load ✓</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Environmental Impact */}
            <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-6 mt-6">
                <h3 className="text-md font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <CloudFog className="w-4 h-4 text-emerald-500" />
                    Environmental Impact
                </h3>
                <div className="grid grid-cols-3 gap-4">
                    {(() => {
                        const gridCarbonIntensity = selectedCountry!.environment?.gridCarbonIntensity ?? 0.50;
                        const annualMWh = ((inputs.tierLevel === 4 ? 1250 : 1450) * 8760) / 1000;
                        const annualCO2Tonnes = annualMWh * gridCarbonIntensity;
                        return (
                            <>
                                <div className="bg-white dark:bg-black/30 p-3 rounded-lg text-center border border-slate-200 dark:border-slate-800/50">
                                    <div className="text-[10px] text-slate-500 uppercase">Grid Carbon</div>
                                    <div className="text-xl font-bold text-amber-500 dark:text-amber-400">{gridCarbonIntensity.toFixed(2)}</div>
                                    <div className="text-[10px] text-slate-500">kgCO₂/kWh</div>
                                </div>
                                <div className="bg-white dark:bg-black/30 p-3 rounded-lg text-center border border-slate-200 dark:border-slate-800/50">
                                    <div className="text-[10px] text-slate-500 uppercase">Annual CO₂</div>
                                    <div className="text-xl font-bold text-orange-500 dark:text-orange-400">{(annualCO2Tonnes / 1000).toFixed(1)}k</div>
                                    <div className="text-[10px] text-slate-500">tonnes/year</div>
                                </div>
                                <div className="bg-white dark:bg-black/30 p-3 rounded-lg text-center border border-slate-200 dark:border-slate-800/50">
                                    <div className="text-[10px] text-slate-500 uppercase">WUE (est.)</div>
                                    <div className="text-xl font-bold text-blue-500 dark:text-blue-400">{(selectedCountry!.environment?.baselineAQI ?? 50) > 80 ? '1.8' : '1.2'}</div>
                                    <div className="text-[10px] text-slate-500">L/kWh</div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>
        </>
    );
}
