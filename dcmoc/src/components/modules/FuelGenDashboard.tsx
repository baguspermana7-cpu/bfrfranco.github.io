'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { calculateFuelGen, FuelGenResult, FuelGenInput, EditableParam, TestingRegime } from '@/modules/infrastructure/FuelGenEngine';
import { calculateGridReliability } from '@/modules/infrastructure/GridReliabilityEngine';
import { rzData, useEngineReady } from '@/lib/rz-engine';
import {
    Fuel, Pencil, Check, X, Gauge, Droplets, Calendar, DollarSign,
    BarChart3, AlertTriangle, Flame, Clock, Truck, ArrowUpRight, Zap, ChevronDown
} from 'lucide-react';
import { StatusChip } from '@/components/ui/StatusChip';
import clsx from 'clsx';
import { fmtCompact, fmtMoney } from '@/lib/format';
import { Tooltip } from '@/components/ui/Tooltip';
import { TraceValue } from '@/components/ui/TraceValue';

const paramTooltips: Record<string, string> = {
    dieselPricePerLiter: "Local diesel fuel price before tax. Varies significantly by country and is a primary driver of annual generator operating cost.",
    genEfficiency: "Fuel consumption rate in liters per kWh. Lower values indicate more efficient engines. Modern Tier 2 diesel gensets typically achieve 0.24-0.30 L/kWh.",
    fuelStorageHours: "Hours of on-site fuel reserve at full facility load. Tier III requires minimum 24h; Tier IV typically 72-96h. Best practice is 48-72h minimum.",
    monthlyTestHours: "Duration of monthly generator load bank test in hours. Ensures engines can carry rated load and prevents wet-stacking from extended idle periods.",
    annualFullLoadTestHours: "Duration of annual full-load bank test in hours. Validates generator performance at 100% rated capacity and identifies maintenance issues.",
};

type TabId = 'overview' | 'consumption' | 'testing' | 'comparison' | 'environmental';

/* v1.115.80 — engine DATA.fuelGen.altPowerTech row (alternative on-site power tech). */
interface AltPowerTechRow {
    key: string; name: string; role: string; elecEffPct: number | null; co2KgPerKwh: number;
    trl: number; maturity: string; deploy: string; powerDensityMwAcre: number; dispatchable: boolean; h2Ready: string; note: string;
}

/* ─── Diagnostics Tier-2: genset CO₂ (DIAGNOSTICS_STANDARD.md) ───────────────
 * SINGLE SOURCE for (a) the environmental CO₂ card red coloring, (b) the
 * click-to-explain panel gating, and (c) collectFuelGenDiagnostics — never
 * duplicate the literal at a call site. The existing card rendered red
 * unconditionally; the constant makes that gate explicit: any positive diesel
 * Scope-1 tonnage is a red (reportable) exposure. */
const CO2_RED_THRESHOLD_T = 0;        // t/yr — CO₂ > 0 → red card + panel + finding
const CO2_KG_PER_LITER = 2.68;        // DEFRA diesel factor — same 2.68 the engine + card text use
const FUELGEN_TAB = 'fuel-gen';       // shell tab hosting this page
const GRID_TAB = 'grid';              // shell tab hosting the blended outage engine (run-hours driver)

const co2Fails = (tons: number): boolean => tons > CO2_RED_THRESHOLD_T;

/** Diagnostics finding — canonical Diagnostics Center shape (per standard §5). */
export interface Finding {
    surface: string;
    severity: 'high' | 'medium';
    metric: string;
    value: number;
    threshold: number;
    linkTab: string;
}

/**
 * Tier-2 collector — pure function over the SAME calculateFuelGen result the
 * page renders (no hooks, no DOM), so a future Diagnostics Center can call it
 * headlessly with identical numbers.
 */
export function collectFuelGenDiagnostics(model: FuelGenResult): Finding[] {
    if (!co2Fails(model.co2EmissionsTonsPerYear)) return [];
    return [{
        surface: 'Infrastructure · Fuel & Generator',
        severity: 'medium', // Scope-1 screening exposure — cost/compliance, not availability risk
        metric: 'Genset CO₂ (Scope 1)',
        value: model.co2EmissionsTonsPerYear,
        threshold: CO2_RED_THRESHOLD_T,
        linkTab: FUELGEN_TAB,
    }];
}

export default function FuelGenDashboard() {
    const { selectedCountry, inputs, actions } = useSimulationStore();
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [overrides, setOverrides] = useState<Record<string, number>>({});
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [testingRegime, setTestingRegime] = useState<TestingRegime>('minimal');
    const [co2Open, setCo2Open] = useState(false);
    const engineReady = useEngineReady(); // re-run envCosts memo once rz-engine.min.js lands
    /* v1.115.72 — power source + fuel type (Ireland/off-grid case: prime power).
     * Held in the sim store (not local) so CAPEX grid/genset cost, Carbon CO₂ and
     * the Architecture SLD all read the SAME selection. */
    type PowerSource = NonNullable<FuelGenInput['powerSource']>;
    type FuelType = NonNullable<FuelGenInput['fuelType']>;
    const powerSource: PowerSource = inputs.powerSource ?? 'utility-backup';
    const fuelType: FuelType = inputs.fuelType ?? 'diesel';
    const setPowerSource = (v: PowerSource) => actions.setInputs({ powerSource: v });
    const setFuelType = (v: FuelType) => actions.setInputs({ fuelType: v });
    const [showAltTech, setShowAltTech] = useState(false);

    const result = useMemo<FuelGenResult | null>(() => {
        if (!selectedCountry) return null;
        return calculateFuelGen({
            country: selectedCountry,
            itLoadKw: inputs.itLoad,
            tierLevel: inputs.tierLevel,
            coolingType: inputs.coolingType,
            coolingTopology: inputs.coolingTopology,
            powerRedundancy: inputs.powerRedundancy,
            testingRegime,
            powerSource,
            fuelType,
            overrides: Object.keys(overrides).length > 0 ? overrides as FuelGenInput['overrides'] : undefined,
        });
    }, [selectedCountry, inputs.itLoad, inputs.tierLevel, inputs.coolingType, inputs.coolingTopology, inputs.powerRedundancy, testingRegime, powerSource, fuelType, overrides]);

    /* ── Diagnostics Tier-2 models (all levers = measured re-runs / engine data,
     * never fabricated numbers) ────────────────────────────────────────────── */

    // Carbon price — engine DATA.envCosts, same read pattern as the
    // Sustainability Engine page: country compliance price when a scheme
    // exists, labeled voluntary-offset fallback otherwise.
    const carbon = useMemo(() => {
        const ec = rzData()?.envCosts;
        if (!ec?.carbonPriceUsdPerT) return null; // engine absent → panel says so honestly
        const cid = (selectedCountry?.id ?? 'US').toUpperCase();
        const compliancePrice: number | undefined = ec.carbonPriceUsdPerT[cid];
        const hasScheme = compliancePrice != null && compliancePrice > 0;
        const rate: number = hasScheme ? compliancePrice : (ec.voluntaryOffsetUsdPerT ?? 10);
        return { hasScheme, rate };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCountry, engineReady]);

    // Blended outage estimate — the SAME GridReliabilityEngine the Grid tab
    // renders (0.5·SAIDI + 0.5·event blend), for the run-hours lever context.
    const gridBlended = useMemo(() => {
        if (!selectedCountry) return null;
        const g = calculateGridReliability({
            country: selectedCountry,
            itLoadKw: inputs.itLoad,
            tierLevel: inputs.tierLevel,
            coolingType: inputs.coolingType,
        });
        return {
            outageHoursPerYear: Math.round((g.annualOutageMinutes / 60) * 10) / 10,
            annualExpectedOutages: g.annualExpectedOutages,
        };
    }, [selectedCountry, inputs.itLoad, inputs.tierLevel, inputs.coolingType]);

    // Discrete re-run of the SAME fuel model at the other testing regime —
    // measured run-hours lever (complete → minimal), not a generic tip.
    const altRegimeResult = useMemo<FuelGenResult | null>(() => {
        if (!selectedCountry) return null;
        return calculateFuelGen({
            country: selectedCountry,
            itLoadKw: inputs.itLoad,
            tierLevel: inputs.tierLevel,
            coolingType: inputs.coolingType,
            coolingTopology: inputs.coolingTopology,
            powerRedundancy: inputs.powerRedundancy,
            testingRegime: testingRegime === 'minimal' ? 'complete' : 'minimal',
            overrides: Object.keys(overrides).length > 0 ? overrides as FuelGenInput['overrides'] : undefined,
        });
    }, [selectedCountry, inputs.itLoad, inputs.tierLevel, inputs.coolingType, inputs.coolingTopology, inputs.powerRedundancy, testingRegime, overrides]);

    if (!result) return <div className="text-slate-500 text-center py-20">Select a country to begin.</div>;


    const startEdit = (param: EditableParam) => {
        setEditingKey(param.key);
        setEditValue(String(param.value));
    };

    const confirmEdit = (param: EditableParam) => {
        const num = parseFloat(editValue);
        if (!isNaN(num) && num >= param.min && num <= param.max) {
            setOverrides(prev => ({ ...prev, [param.key]: num }));
        }
        setEditingKey(null);
    };

    const resetParam = (key: string) => {
        setOverrides(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const tabs: { id: TabId; label: string }[] = [
        { id: 'overview', label: 'Overview' },
        { id: 'consumption', label: 'Consumption' },
        { id: 'testing', label: 'Testing Schedule' },
        { id: 'comparison', label: 'Country Compare' },
        { id: 'environmental', label: 'Environmental' },
    ];

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-xl">
                            <Fuel className="w-6 h-6 text-amber-500" />
                        </div>
                        Fuel & Generator Modeling
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Module 44 — Diesel generator sizing, fuel consumption & cost modeling</p>
                </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
                {/* Left: Editable Parameters */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <Pencil className="w-4 h-4 text-amber-500" />
                            Editable Parameters
                            <Tooltip content="Click the pencil icon to override any parameter with a custom value. Changes instantly recalculate all KPIs, costs, and consumption figures. Use the X button to reset to defaults." />
                        </h3>
                        <div className="space-y-3">
                            {result.editableParams.map(param => {
                                const isEditing = editingKey === param.key;
                                const isOverridden = overrides[param.key] !== undefined;
                                return (
                                    <div key={param.key} className={clsx(
                                        "p-3 rounded-lg border transition-colors",
                                        isOverridden ? "border-amber-400/50 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-600/30" : "border-slate-200 dark:border-slate-700"
                                    )}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                                {param.label}
                                                {paramTooltips[param.key] && <Tooltip content={paramTooltips[param.key]} />}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                {isOverridden && !isEditing && (
                                                    <button onClick={() => resetParam(param.key)} className="p-0.5 text-amber-500 hover:text-amber-600" title="Reset to default">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                                {!isEditing && (
                                                    <button onClick={() => startEdit(param)} className="p-0.5 text-slate-400 hover:text-amber-500" aria-label={`Edit ${param.label}`}>
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={editValue}
                                                    onChange={e => setEditValue(e.target.value)}
                                                    min={param.min}
                                                    max={param.max}
                                                    step={param.step}
                                                    className="flex-1 px-2 py-1 text-sm bg-white dark:bg-slate-900 border border-amber-400 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                    autoFocus
                                                    onKeyDown={e => e.key === 'Enter' && confirmEdit(param)}
                                                />
                                                <span className="text-[10px] text-slate-500">{param.unit}</span>
                                                <button onClick={() => confirmEdit(param)} className="p-1 text-emerald-500 hover:text-emerald-600" aria-label="Confirm edit">
                                                    <Check className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => setEditingKey(null)} className="p-1 text-slate-400 hover:text-slate-500" aria-label="Cancel edit">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-lg font-bold text-slate-900 dark:text-white">{param.value}</span>
                                                <span className="text-xs text-slate-500">{param.unit}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Power Source + Fuel Type — Ireland/off-grid case: prime power, gensets run continuously */}
                    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" />
                            Power Source &amp; Fuel
                            <Tooltip content="Power topology drives generator run-hours. Utility+backup: gensets are standby (~grid-outage hours only). Prime power (off-grid, e.g. Ireland where the DNO has no grid capacity): gensets are the primary supply and run continuously (~8760h × utilisation). Hybrid: grid + on-site generation share the year. Fuel type sets efficiency, CO₂ factor and cost premium." />
                        </h3>
                        <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Power Source</label>
                        <select
                            value={powerSource}
                            onChange={e => setPowerSource(e.target.value as PowerSource)}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 mb-3"
                        >
                            <option value="utility-backup">Utility grid + standby gensets</option>
                            <option value="prime">Prime power (off-grid, gensets run continuously)</option>
                            <option value="hybrid">Hybrid (grid + on-site generation)</option>
                        </select>
                        <label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Fuel / Generation Type</label>
                        <select
                            value={fuelType}
                            onChange={e => setFuelType(e.target.value as FuelType)}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="diesel">Diesel (EN590 / ULSD, EPA Tier 4)</option>
                            <option value="hvo">HVO-100 (renewable diesel, −90% lifecycle CO₂)</option>
                            <option value="natural-gas">Natural gas (reciprocating gas engine)</option>
                            <option value="solar-hybrid">Solar + BESS hybrid (−30% genset run-hours)</option>
                            <option value="fuel-cell">Fuel cell (SOFC on gas, low local emissions)</option>
                            <option value="biogas">Biogas / RNG (near carbon-neutral)</option>
                        </select>
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                            <div className="flex justify-between"><span className="text-slate-500">Mode</span><span className="font-medium text-slate-900 dark:text-white text-right">{result.powerSourceLabel}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 flex items-center gap-1">Genset run-hours<Tooltip content="Annual generator running hours implied by the power source. Standby ≈ grid-outage hours; prime ≈ 8760h × utilisation (continuous); hybrid ≈ year fraction. Fuel/CO₂ scale directly with this." /></span><span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{fmtCompact(result.runHoursPerYear)} h/yr</span></div>
                            {powerSource === 'prime' && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-snug">Off-grid: no utility substation — gensets are the primary supply. Fuel &amp; CO₂ rise ~50× vs standby.</p>
                            )}
                        </div>
                    </div>

                    {/* Testing Regime Selector */}
                    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-cyan-500" />
                            Testing Regime
                            <Tooltip content="Generator testing frequency and scope. Minimal covers basic monthly no-load runs plus annual loadbank test. Complete includes weekly, monthly, quarterly, and annual testing per NFPA 110 best practices." />
                        </h3>
                        <select
                            value={testingRegime}
                            onChange={e => setTestingRegime(e.target.value as TestingRegime)}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="minimal">Minimal (Monthly No-Load + Annual Full Load)</option>
                            <option value="complete">Complete (Weekly + Monthly + Quarterly + Annual)</option>
                        </select>
                        <p className="text-[10px] text-slate-500 mt-2">
                            {testingRegime === 'minimal'
                                ? 'Monthly no-load run + annual full loadbank test only'
                                : 'Full testing: weekly no-load, monthly loadbank, quarterly full load, annual overhaul'}
                        </p>
                    </div>

                    {/* Generator Spec Card */}
                    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <Gauge className="w-4 h-4 text-cyan-500" />
                            Generator Specification
                            <Tooltip content="Backup diesel generator configuration sized for total facility load including IT and cooling. Count and redundancy determined by tier level and power redundancy model." />
                        </h3>
                        {/* Workstream T — the wiring made visible: spec derives from requirements */}
                        <div className="mb-2 flex flex-wrap gap-1 text-[9px]">
                            <span className="rounded bg-rz-mint/10 px-1.5 py-0.5 text-rz-mint" title="From Requirements — IT load drives facility kW via PUE">IT {(result ? (result.generator.totalCapacityKw / Math.max(1, result.generator.count)) : 0) >= 0 ? `${(inputs.itLoad / 1000).toFixed(1)} MW` : ''}</span>
                            <span className="rounded bg-rz-info/10 px-1.5 py-0.5 text-cyan-600 dark:text-rz-info" title="Cooling type sets PUE — facility kW = IT × PUE">× PUE ({inputs.coolingType})</span>
                            <span className="rounded bg-rz-signal/10 px-1.5 py-0.5 text-amber-600 dark:text-rz-signal" title="Redundancy model adds standby units">{inputs.powerRedundancy} redundancy</span>
                            <span className="rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 text-slate-500" title="Tier + country grid reliability set the autonomy floor">Tier {inputs.tierLevel} · {selectedCountry?.id} grid</span>
                        </div>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500 flex items-center gap-1">Units<Tooltip content="Number and rating of individual generator sets. Each unit is a standalone diesel genset with its own fuel system and controls." /></span><TraceValue traceId="fuelgen.gensetCount"><span className="font-semibold text-slate-900 dark:text-white">{result.generator.count}x {(result.generator.capacityKw / 1000).toFixed(1)}MW</span></TraceValue></div>
                            <div className="flex justify-between"><span className="text-slate-500 flex items-center gap-1">Redundancy<Tooltip content="Power redundancy model. N+1 adds one spare unit. 2N doubles the entire generator plant. 2N+1 doubles plus one spare for maximum resilience." /></span><span className="font-semibold text-slate-900 dark:text-white">{result.generator.redundancyModel}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 flex items-center gap-1">Total Capacity<Tooltip content="Combined nameplate capacity of all generators including redundant units. This is the maximum power available during a complete utility outage." /></span><span className="font-semibold text-slate-900 dark:text-white">{(result.generator.totalCapacityKw / 1000).toFixed(1)} MW</span></div>
                        </div>
                    </div>

                    {/* Fuel Storage Card */}
                    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <Droplets className="w-4 h-4 text-blue-500" />
                            Fuel Storage
                            <Tooltip content="On-site diesel fuel storage infrastructure. Sized based on fuel storage hours parameter and total facility load. Subject to local environmental regulations and containment requirements." />
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500 flex items-center gap-1">Total Storage<Tooltip content="Total diesel fuel volume stored on-site in liters. Calculated from fuel consumption rate multiplied by required storage hours, capped by local storage limits." /></span><TraceValue traceId="fuelgen.tankLiters"><span className="font-semibold text-slate-900 dark:text-white">{fmtCompact(result.storage.totalLiters)} L</span></TraceValue></div>
                            <div className="flex justify-between"><span className="text-slate-500 flex items-center gap-1">Tank Count<Tooltip content="Number of 20,000-liter bulk storage tanks required. Tanks are typically double-walled steel with leak detection, bunded containment, and automatic fuel transfer systems." /></span><span className="font-semibold text-slate-900 dark:text-white">{result.storage.tankCount}x 20,000L</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 flex items-center gap-1">Autonomy<Tooltip content="Days of continuous generator operation supported by on-site fuel reserves at full facility load. Critical metric for disaster preparedness and SLA compliance." /></span><TraceValue traceId="fuelgen.autonomyDays"><span className="font-semibold text-slate-900 dark:text-white">{result.storage.daysOfAutonomy} days</span></TraceValue></div>
                        </div>
                    </div>
                </div>

                {/* Right: Main Content */}
                <div className="lg:col-span-8 space-y-4">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                        {[
                            { label: 'Annual Fuel', value: fmtMoney(result.cost.annualFuelCostUsd), sub: `$${result.cost.dieselPriceWithTax}/L`, icon: DollarSign, color: 'amber', tip: 'Annualized fuel expenditure based on testing schedule, grid outage runtime, and local diesel price including tax.' },
                            { label: 'Total Gen OPEX/yr', value: fmtMoney(result.cost.totalAnnualGenOpex), sub: `${fmtMoney(result.cost.annualMaintenanceUsd)} maint`, icon: BarChart3, color: 'cyan', tip: 'Total annual generator operating expenditure combining fuel costs, scheduled maintenance, and environmental compliance fees.' },
                            { label: 'Consumption/yr', value: `${fmtCompact(result.consumption.totalLitersPerYear)} L`, sub: `${fmtCompact(result.consumption.totalLitersPerMonth)} L/mo`, icon: Droplets, color: 'blue', tip: 'Total annual diesel consumption across all sources: scheduled testing, grid outage runtime, and fuel polishing operations.' },
                            { label: 'CO₂ Emissions', value: `${result.co2EmissionsTonsPerYear} t/yr`, sub: `${fmtCompact(result.co2EmissionsKgPerYear)} kg`, icon: Flame, color: 'red', tip: 'Annual carbon dioxide emissions from diesel combustion at 2.68 kgCO₂ per liter. Used for Scope 1 emissions reporting and carbon offset calculations.' },
                            { label: 'Monthly Fuel', value: fmtMoney(result.cost.monthlyFuelCostUsd), sub: 'Per month', icon: Calendar, color: 'green', tip: 'Projected monthly fuel spend including scheduled testing and estimated emergency runtime. Used for operational budgeting and cash flow planning.' },
                            { label: 'Env. Compliance', value: fmtMoney(result.cost.annualEnvironmentalComplianceUsd), sub: 'Permits/yr', icon: AlertTriangle, color: 'teal', tip: 'Annual cost for environmental permits, emission testing, spill prevention plans, and regulatory reporting required for on-site diesel generator operation.' },
                        ].map((kpi, i) => (
                            <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3 sm:p-4">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <kpi.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-${kpi.color}-500 shrink-0`} />
                                    <span className="text-[10px] sm:text-xs text-slate-500 truncate">{kpi.label}</span>
                                    <Tooltip content={kpi.tip} />
                                </div>
                                <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">{kpi.value}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5 truncate">{kpi.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    "flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors",
                                    activeTab === tab.id ? "bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                )}
                            >{tab.label}</button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                        {activeTab === 'overview' && (
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                                    Cost Breakdown Summary
                                    <Tooltip content="Breakdown of total annual generator operating expenditure into fuel, maintenance, and environmental compliance categories." />
                                </h4>
                                <div className="space-y-2">
                                    {(() => { const opexDen = result.cost.totalAnnualGenOpex || 1; return [
                                        { label: 'Annual Fuel', value: result.cost.annualFuelCostUsd, pct: result.cost.annualFuelCostUsd / opexDen * 100, color: 'bg-amber-500', tip: 'Total diesel fuel cost per year from testing, outage runtime, and fuel polishing operations.' },
                                        { label: 'Maintenance', value: result.cost.annualMaintenanceUsd, pct: result.cost.annualMaintenanceUsd / opexDen * 100, color: 'bg-cyan-500', tip: 'Annual preventive and corrective maintenance cost per generator unit, including oil changes, filter replacements, and coolant service.' },
                                        { label: 'Environmental', value: result.cost.annualEnvironmentalComplianceUsd, pct: result.cost.annualEnvironmentalComplianceUsd / opexDen * 100, color: 'bg-rz-mint', tip: 'Annual environmental permit fees, emission testing, and regulatory compliance costs. Zero if no environmental permits required in selected country.' },
                                    ]; })().map((item, i) => (
                                        <div key={i}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">{item.label}<Tooltip content={item.tip} /></span>
                                                <span className="font-medium text-slate-900 dark:text-white">{fmtMoney(item.value)} ({item.pct.toFixed(1)}%)</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                    <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">Total Annual Generator OPEX<Tooltip content="Sum of all annual generator-related operating costs: fuel, maintenance, and environmental compliance. Does not include capital expenditure or generator replacement reserves." /></span>
                                    <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{fmtMoney(result.cost.totalAnnualGenOpex)}</span>
                                </div>
                            </div>
                        )}

                        {activeTab === 'consumption' && (
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                                    Fuel Consumption Breakdown
                                    <Tooltip content="Detailed breakdown of annual diesel consumption by source: scheduled testing, grid outage runtime, and fuel polishing. Helps identify the primary driver of fuel costs." />
                                </h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm min-w-[360px]">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                                <th className="text-left py-2 text-slate-500 font-medium">Category</th>
                                                <th className="text-right py-2 text-slate-500 font-medium">L/Year</th>
                                                <th className="text-right py-2 text-slate-500 font-medium">USD/Year</th>
                                                <th className="text-right py-2 text-slate-500 font-medium">%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                { label: 'Testing', liters: result.consumption.annualTestLiters, tip: 'Diesel consumed during scheduled generator testing — no-load runs, load bank tests, and annual full-load exercises.' },
                                                { label: 'Grid Outages', liters: result.consumption.annualOutageLiters, tip: 'Diesel consumed during actual grid power outages. Based on country grid reliability data (outage frequency and average duration).' },
                                                { label: 'Fuel Polishing', liters: result.consumption.annualPolishingLiters, tip: 'Small fuel volume consumed during monthly fuel polishing operations. Polishing removes water and particulates to maintain fuel quality for long-term storage.' },
                                            ].map((row, i) => (
                                                <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                                                    <td className="py-2 text-slate-700 dark:text-slate-300 flex items-center gap-1">{row.label}<Tooltip content={row.tip} /></td>
                                                    <td className="py-2 text-right font-mono text-slate-900 dark:text-white">{fmtCompact(row.liters)}</td>
                                                    <td className="py-2 text-right font-mono text-slate-900 dark:text-white">{fmtMoney(Math.round(row.liters * result.cost.dieselPriceWithTax))}</td>
                                                    <td className="py-2 text-right font-mono text-slate-500">{result.consumption.totalLitersPerYear > 0 ? (row.liters / result.consumption.totalLitersPerYear * 100).toFixed(1) : '0.0'}%</td>
                                                </tr>
                                            ))}
                                            <tr className="font-bold">
                                                <td className="py-2 text-slate-900 dark:text-white">Total</td>
                                                <td className="py-2 text-right font-mono text-amber-600 dark:text-amber-400">{fmtCompact(result.consumption.totalLitersPerYear)}</td>
                                                <td className="py-2 text-right font-mono text-amber-600 dark:text-amber-400">{fmtMoney(result.cost.annualFuelCostUsd)}</td>
                                                <td className="py-2 text-right font-mono text-slate-500">100%</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{fmtCompact(result.consumption.totalLitersPerMonth)} L</div>
                                        <div className="text-[10px] text-slate-500 mt-1">Per Month</div>
                                    </div>
                                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">{fmtMoney(result.cost.monthlyFuelCostUsd)}</div>
                                        <div className="text-[10px] text-slate-500 mt-1">Per Month</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'testing' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                                        Generator Testing Schedule
                                        <Tooltip content="Scheduled generator testing events per NFPA 110 and Uptime Institute best practices. Each test type specifies frequency, duration, load level, and fuel consumption per event." />
                                    </h4>
                                    <span className={clsx(
                                        "text-xs font-medium px-2 py-1 rounded-full",
                                        testingRegime === 'minimal' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400"
                                    )}>
                                        {testingRegime === 'minimal' ? 'Minimal Regime' : 'Complete Regime'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        { ...result.testing.weeklyNoLoad, label: 'Weekly No-Load Run', icon: Clock, desc: `${result.testing.weeklyNoLoad.durationMin} min per unit` },
                                        { ...result.testing.monthlyLoadBank, label: testingRegime === 'minimal' ? 'Monthly No-Load Run' : 'Monthly Load Bank', icon: Gauge, desc: testingRegime === 'minimal' ? '30 min no-load per unit' : `${result.testing.monthlyLoadBank.durationHours}hr at 50% load` },
                                        { ...result.testing.quarterlyFullLoad, label: 'Quarterly Full Load', icon: Fuel, desc: `2hr at 75% load` },
                                        { ...result.testing.annualOverhaul, label: 'Annual Full Loadbank Test', icon: Truck, desc: `${result.testing.annualOverhaul.durationHours}hr full load bank` },
                                    ].filter(test => test.frequency !== 'N/A').map((test, i) => (
                                        <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center gap-2 mb-2">
                                                <test.icon className="w-4 h-4 text-amber-500" />
                                                <span className="text-sm font-medium text-slate-900 dark:text-white">{test.label}</span>
                                            </div>
                                            <div className="text-xs text-slate-500">{test.frequency} — {test.desc}</div>
                                            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">{fmtCompact(test.fuelLiters)} L / event</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'comparison' && (
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                                    Country Diesel Price Comparison
                                    <Tooltip content="Comparison of annual fuel costs if the same consumption volume were purchased at each country's local diesel price including tax. Highlights cost advantage or disadvantage of the selected location." />
                                </h4>
                                <p className="text-xs text-slate-500">Same volume ({fmtCompact(result.consumption.totalLitersPerYear)} L/yr) at each country&apos;s diesel price incl. tax</p>
                                <div className="space-y-1.5 max-h-96 overflow-y-auto">
                                    {result.countryComparison.map((c, i) => {
                                        const maxCost = result.countryComparison[result.countryComparison.length - 1]?.annualCost || 1;
                                        const pct = (c.annualCost / maxCost) * 100;
                                        const isCurrent = c.countryId === selectedCountry?.id;
                                        return (
                                            <div key={c.countryId} className={clsx(
                                                "flex items-center gap-2 px-2 py-1.5 rounded",
                                                isCurrent && "bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-400/30"
                                            )}>
                                                <span className="w-6 text-[10px] font-mono text-slate-500 text-right">{i + 1}</span>
                                                <span className="w-8 text-xs font-bold text-slate-700 dark:text-slate-300">{c.countryId}</span>
                                                <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div className={clsx("h-full rounded-full", isCurrent ? "bg-amber-500" : "bg-cyan-500/60")} style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="w-16 text-right text-xs font-mono text-slate-600 dark:text-slate-400">${c.dieselPrice}/L</span>
                                                <span className="w-20 text-right text-xs font-mono font-semibold text-slate-900 dark:text-white">{fmtMoney(c.annualCost)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {activeTab === 'environmental' && (
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                                    Environmental Compliance
                                    <Tooltip content="Environmental impact assessment and regulatory compliance requirements for on-site diesel generator operation. Includes emissions, permits, containment, and reporting obligations." />
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className={clsx(
                                        "p-4 rounded-lg border",
                                        co2Fails(result.co2EmissionsTonsPerYear)
                                            ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                                            : "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800"
                                    )}>
                                        <div className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">CO₂ Emissions<Tooltip content="Total Scope 1 carbon dioxide emissions from diesel combustion. Calculated at 2.68 kgCO₂ per liter, the standard DEFRA emission factor for diesel fuel." /></div>
                                        {co2Fails(result.co2EmissionsTonsPerYear) ? (
                                            <button
                                                type="button"
                                                onClick={() => setCo2Open(o => !o)}
                                                aria-expanded={co2Open}
                                                title={`Genset CO₂ ${result.co2EmissionsTonsPerYear} t/yr > threshold ${CO2_RED_THRESHOLD_T} t/yr. Click for the calculation basis + measured levers (HVO, offset, run-hours) from the same model.`}
                                                className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1 cursor-pointer underline decoration-dotted underline-offset-4"
                                            >
                                                {result.co2EmissionsTonsPerYear} t/yr
                                            </button>
                                        ) : (
                                            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{result.co2EmissionsTonsPerYear} t/yr</div>
                                        )}
                                        <div className="text-[10px] text-red-500 mt-1">2.68 kgCO₂ per liter diesel</div>
                                    </div>
                                    <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                                        <div className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">Compliance Cost<Tooltip content="Annual expenditure for environmental permits, emission testing reports, spill prevention plans, and regulatory compliance. Scales with number of generator units on-site." /></div>
                                        <div className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">{fmtMoney(result.cost.annualEnvironmentalComplianceUsd)}</div>
                                        <div className="text-[10px] text-green-500 mt-1">Annual permits & reporting</div>
                                    </div>
                                </div>

                                {/* ── Diagnostics Tier-2 panel: why the CO₂ number is red + measured levers ── */}
                                {co2Open && co2Fails(result.co2EmissionsTonsPerYear) && (() => {
                                    const co2T = result.co2EmissionsTonsPerYear;
                                    const liters = result.consumption.totalLitersPerYear;
                                    // Parity check (standard §4): re-state the engine formula from the SAME
                                    // rendered consumption and verify against the live engine number.
                                    const recomputedKg = liters * CO2_KG_PER_LITER;
                                    const parity = Math.abs(recomputedKg - result.co2EmissionsKgPerYear) < 3; // rounding tolerance (litres + kg both rounded)
                                    const toT = (l: number) => Math.round((l * CO2_KG_PER_LITER) / 1000 * 10) / 10;
                                    const srcRows = [
                                        { label: 'Testing', liters: result.consumption.annualTestLiters },
                                        { label: 'Grid outages', liters: result.consumption.annualOutageLiters },
                                        { label: 'Fuel polishing', liters: result.consumption.annualPolishingLiters },
                                    ];
                                    const outageT = toT(result.consumption.annualOutageLiters);
                                    const outagePct = liters > 0 ? Math.round(result.consumption.annualOutageLiters / liters * 100) : 0;
                                    const hvo = result.hvo;
                                    const hvoResidualT = hvo ? Math.max(0, Math.round((co2T - hvo.co2SavingsTonsPerYear) * 10) / 10) : null;
                                    const hvoAbatement = hvo && hvo.co2SavingsTonsPerYear > 0
                                        ? Math.round(hvo.annualDeltaVsDieselUsd / hvo.co2SavingsTonsPerYear)
                                        : null;
                                    const altT = altRegimeResult?.co2EmissionsTonsPerYear ?? null;
                                    return (
                                        <div className="p-4 rounded-lg border text-left bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 space-y-3">
                                            {/* (a) Why red — basis from the same model the card renders */}
                                            <div>
                                                <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                                                    Why red — emissions basis (same FuelGen model)
                                                </div>
                                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-mono">
                                                    {fmtCompact(liters)} L diesel/yr × {CO2_KG_PER_LITER} kgCO₂/L = {fmtCompact(recomputedKg)} kg ≈ {co2T} t/yr
                                                    {parity ? (
                                                        <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">≡ engine</span>
                                                    ) : (
                                                        <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" title="Decomposition no longer matches the engine output — the card figure still comes from the engine; the factors above are indicative.">≠ engine — card figure prevails</span>
                                                    )}
                                                </p>
                                                <div className="mt-1.5 space-y-0.5">
                                                    {srcRows.map(r => (
                                                        <div key={r.label} className="flex items-center gap-2 text-[11px]">
                                                            <span className="w-28 shrink-0 text-slate-500 dark:text-slate-400">{r.label}</span>
                                                            <span className="font-mono text-slate-700 dark:text-slate-300">{fmtCompact(r.liters)} L → {toT(r.liters)} t/yr</span>
                                                            <span className="text-slate-400 dark:text-slate-500">({liters > 0 ? Math.round(r.liters / liters * 100) : 0}%)</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                                    Colour threshold: red when CO₂ &gt; {CO2_RED_THRESHOLD_T} t/yr — any positive Scope-1 tonnage is a reporting exposure (the same constant colours the card, opens this panel, and fills the collector).
                                                </p>
                                            </div>

                                            {/* (b) Measured levers */}
                                            <div>
                                                <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5">
                                                    Measured levers (computed from the same model / engine)
                                                </div>
                                                <div className="space-y-1.5">
                                                    {/* Lever 1 — HVO swap (engine hvo comparison; honest when unavailable) */}
                                                    {hvo ? (
                                                        <div className="flex items-start gap-2 p-2 rounded-md bg-white/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                                            <span className="shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">Switch to HVO100</span>
                                                            <span className="flex-1 text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                                                                {fmtCompact(hvo.annualLiters)} L/yr (×1.03 energy density) × ${hvo.hvoPriceWithTax}/L = {fmtMoney(hvo.annualFuelCostUsd)}/yr — {hvo.annualDeltaVsDieselUsd >= 0 ? `premium +${fmtMoney(hvo.annualDeltaVsDieselUsd)}` : `saves ${fmtMoney(Math.abs(hvo.annualDeltaVsDieselUsd))}`}/yr vs diesel. CO₂ −{hvo.co2SavingsTonsPerYear} t/yr (−90% lifecycle, EN 15940) → {hvoResidualT} t/yr remaining.
                                                                {hvoAbatement != null && (
                                                                    <> Abatement ≈ ${hvoAbatement.toLocaleString()}/tCO₂{carbon ? ` (country carbon price $${carbon.rate}/t — HVO is ${hvoAbatement <= carbon.rate ? 'cheaper' : 'more expensive'} per ton avoided)` : ''}.</>
                                                                )}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-start gap-2 p-2 rounded-md bg-white/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                                            <span className="shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">HVO100</span>
                                                            <span className="flex-1 text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                                                                HVO is not yet available in {selectedCountry?.name ?? 'this country'} — the country data carries no HVO supply/price, so the cost delta cannot be computed (reported, not hidden). The −90% lifecycle reduction only applies once local supply exists.
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Lever 2 — carbon offset cost (engine DATA.envCosts country price) */}
                                                    <div className="flex items-start gap-2 p-2 rounded-md bg-white/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                                        <span className="shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">Carbon offset</span>
                                                        <span className="flex-1 text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                                                            {carbon ? (
                                                                <>{co2T} t/yr × ${carbon.rate}/t ({carbon.hasScheme ? 'country compliance price' : 'voluntary offset — country without a compliance scheme'}) = {fmtMoney(Math.round(co2T * carbon.rate))}/yr — engine DATA.envCosts (World Bank / OECD / NCCS 2025-26).</>
                                                            ) : (
                                                                <>Engine DATA.envCosts not yet loaded — offset cost cannot be computed on this render (not $0).</>
                                                            )}
                                                        </span>
                                                    </div>

                                                    {/* Lever 3 — reduce run-hours (decomposed outage share + blended grid engine) */}
                                                    <div className="flex items-start gap-2 p-2 rounded-md bg-white/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                                        <span className="shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">Reduce run-hours</span>
                                                        <span className="flex-1 text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                                                            Grid outage runtime contributes {fmtCompact(result.consumption.annualOutageLiters)} L → {outageT} t/yr ({outagePct}% of CO₂). Eliminating it (more reliable grid / dual feed): CO₂ {co2T} → {Math.round((co2T - outageT) * 10) / 10} t/yr.
                                                            {gridBlended && (
                                                                <> The blended outage engine estimates {gridBlended.outageHoursPerYear} outage hours/yr ({gridBlended.annualExpectedOutages} events) for this country.</>
                                                            )}
                                                            {' '}
                                                            <button
                                                                type="button"
                                                                onClick={() => actions.setActiveTab(GRID_TAB)}
                                                                className="inline-flex items-center gap-0.5 text-cyan-600 dark:text-cyan-400 underline decoration-dotted underline-offset-2"
                                                                title="Open Grid Reliability — the outage drivers (SAIDI + brownout) and their mitigations are modeled there."
                                                            >
                                                                Grid Reliability<ArrowUpRight className="w-3 h-3" />
                                                            </button>
                                                            {testingRegime === 'complete' && altT != null ? (
                                                                <> · Lower the testing regime Complete → Minimal (re-run the same model): CO₂ {co2T} → {altT} t/yr (−{Math.round((co2T - altT) * 10) / 10} t), fuel {fmtMoney(result.cost.annualFuelCostUsd)} → {fmtMoney(altRegimeResult!.cost.annualFuelCostUsd)}/yr — a trade-off vs NFPA 110 best practice, not an automatic recommendation.</>
                                                            ) : (
                                                                <> · The testing regime is already Minimal — remaining run-hours are driven by grid reliability (and mandatory test schedules), not excess testing{altT != null ? ` (Complete would raise CO₂ to ${altT} t/yr)` : ''}.</>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 leading-snug">
                                                    Honest note: as long as the genset stays diesel and must be tested, CO₂ cannot reach 0 t/yr — the levers above shrink or offset the tonnage, they do not eliminate it. The 2.68 kg/L factor is the same DEFRA basis as the card.
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="space-y-2">
                                    <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">Compliance Checklist<Tooltip content="Key environmental and safety requirements for on-site diesel generator installations. Items marked REQUIRED are mandated by local regulations; others are recommended best practices." /></h5>
                                    {[
                                        { item: 'Emission testing (annual)', required: true },
                                        { item: 'Fuel storage containment', required: true },
                                        { item: 'Spill prevention plan', required: true },
                                        { item: 'Noise level monitoring', required: selectedCountry?.fuelDiesel?.environmentalPermitRequired ?? true },
                                        { item: 'HVO/renewable fuel option', required: false, available: selectedCountry?.fuelDiesel?.hvoAvailable },
                                        { item: 'Carbon offset reporting', required: false },
                                    ].map((check, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm">
                                            <div className={clsx(
                                                "w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]",
                                                check.required ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"
                                            )}>
                                                {check.required ? '!' : '?'}
                                            </div>
                                            <span className="text-slate-700 dark:text-slate-300">{check.item}</span>
                                            {check.required && <span className="text-[10px] text-amber-600 font-medium">REQUIRED</span>}
                                            {check.available && <span className="text-[10px] text-green-600 font-medium">AVAILABLE</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* v1.115.80 — Alternative on-site power technologies reference (owner: "deep
              * research cari alternative tech lain"). Sourced screening comparison, engine
              * DATA.fuelGen.altPowerTech — reference/education, not wired into the cost model. */}
            {(() => {
                const alt = (rzData()?.fuelGen as { altPowerTech?: AltPowerTechRow[] } | undefined)?.altPowerTech ?? [];
                if (!alt.length) return null;
                return (
                    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <button onClick={() => setShowAltTech(o => !o)} className="w-full flex items-center justify-between gap-2 text-left">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-500" />
                                Alternative On-Site Power Technologies
                                <span className="text-[10px] font-normal text-slate-400">research reference · not in the cost model</span>
                            </h3>
                            <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${showAltTech ? 'rotate-180' : ''}`} />
                        </button>
                        {showAltTech && (
                            <div className="mt-3">
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                                    The credible behind-the-meter options beyond the reciprocating genset, for an off-grid / prime-power site. Screening figures from 2025-26 industry reporting (Goldman Sachs, DataCenterDynamics, Bloom Energy, GE). <strong>Fuel cells</strong> lead on efficiency + power density and deploy fast; <strong>SMR/nuclear</strong> is near-zero-carbon baseload but ~2028-2030 for first DC units; <strong>solar+BESS</strong> is clean but intermittent + land-heavy.
                                </p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[11px] min-w-[720px]">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-700 text-[9px] uppercase text-slate-400">
                                                <th className="text-left py-1.5 pr-2">Technology</th>
                                                <th className="text-left py-1.5 px-2">Role</th>
                                                <th className="text-right py-1.5 px-2">Elec. eff</th>
                                                <th className="text-right py-1.5 px-2">CO₂ kg/kWh</th>
                                                <th className="text-center py-1.5 px-2">TRL</th>
                                                <th className="text-right py-1.5 px-2">MW/acre</th>
                                                <th className="text-left py-1.5 px-2">Deploy</th>
                                                <th className="text-left py-1.5 pl-2">Maturity</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {alt.map((r) => (
                                                <tr key={r.key} className="border-b border-slate-100 dark:border-slate-800/60 align-top">
                                                    <td className="py-1.5 pr-2">
                                                        <div className="font-semibold text-slate-800 dark:text-slate-200">{r.name}</div>
                                                        <div className="text-[10px] text-slate-400 leading-snug max-w-[280px]">{r.note}</div>
                                                    </td>
                                                    <td className="py-1.5 px-2 text-slate-500 whitespace-nowrap">{r.role}</td>
                                                    <td className="py-1.5 px-2 text-right font-mono text-slate-600 dark:text-slate-300">{r.elecEffPct == null ? '—' : `${r.elecEffPct}%`}</td>
                                                    <td className="py-1.5 px-2 text-right font-mono text-slate-600 dark:text-slate-300">{r.co2KgPerKwh}</td>
                                                    <td className="py-1.5 px-2 text-center font-mono text-slate-500">{r.trl}</td>
                                                    <td className="py-1.5 px-2 text-right font-mono text-slate-500">{r.powerDensityMwAcre}</td>
                                                    <td className="py-1.5 px-2 text-slate-500 whitespace-nowrap">{r.deploy}</td>
                                                    <td className="py-1.5 pl-2">
                                                        <StatusChip tone={r.maturity === 'commercial' ? 'data' : r.maturity === 'emerging' ? 'signal' : 'neutral'}>{r.maturity}</StatusChip>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-[9px] text-slate-400 mt-2">CO₂ = operating emissions (kg/kWh); TRL = technology readiness level; H₂-ready per each vendor. Screening comparison, engine DATA.fuelGen.altPowerTech — not a procurement basis.</p>
                            </div>
                        )}
                    </div>
            )})()}
        </div>
    );
}
