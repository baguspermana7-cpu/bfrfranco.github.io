'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useSitesStore } from '@/store/sites';
import { useRequirementsStore } from '@/store/requirements';
import { cagr5 } from '@/lib/requirementsMappings';
import { getPUE } from '@/constants/pue';
import { rzModels } from '@/lib/rz-engine';
import { fmtMoney, fmtUnit } from '@/lib/format';
import { Tooltip } from '@/components/ui/Tooltip';
import {
    MapPin, Zap, Building, TrendingUp, DollarSign,
    BarChart3, Target, ArrowRight, AlertTriangle, CheckCircle,
    Calculator, Scale, Globe2
} from 'lucide-react';
import clsx from 'clsx';

type PlanningMode = 'feasibility' | 'acquisition' | 'expansion';

interface FeasibilityInputs {
    landAreaM2: number;
    gridCapacityMW: number;
    climateZone: 'tropical' | 'arid' | 'temperate' | 'continental' | 'polar';
    targetPUE: number;
}

interface AcquisitionInputs {
    targetSiteDollarPerMW: number;
    comparableA: number;
    comparableB: number;
    comparableC: number;
    riskMultiplier: number;
    targetReturnYears: number;
}

interface ExpansionInputs {
    currentFootprintMW: number;
    yearlyDemandGrowthPct: number;
    planningHorizonYears: number;
    capexPerMW: number;
    gridReservationLeadMonths: number;
}

const CLIMATE_PUE_PENALTY: Record<FeasibilityInputs['climateZone'], number> = {
    polar: 0,
    temperate: 0.03,
    continental: 0.05,
    arid: 0.08,
    tropical: 0.12,
};

const CLIMATE_LABELS: Record<FeasibilityInputs['climateZone'], string> = {
    polar: 'Polar / Sub-arctic (Free-cooling advantage)',
    arid: 'Arid / Desert (High cooling load)',
    temperate: 'Temperate (Moderate cooling)',
    continental: 'Continental (Seasonal swings)',
    tropical: 'Tropical / Humid (Maximum cooling challenge)',
};

export default function StrategicPlanningDashboard() {
    const { selectedCountry, inputs } = useSimulationStore();
    const { results: capexResults } = useCapexStore();
    const [mode, setMode] = useState<PlanningMode>('feasibility');

    const [feasibility, setFeasibility] = useState<FeasibilityInputs>({
        landAreaM2: 10000,
        gridCapacityMW: 20,
        climateZone: selectedCountry?.id === 'ID' ? 'tropical' : 'temperate',
        targetPUE: 1.4,
    });

    const [acquisition, setAcquisition] = useState<AcquisitionInputs>({
        targetSiteDollarPerMW: 8_000_000,
        comparableA: 7_500_000,
        comparableB: 9_000_000,
        comparableC: 8_500_000,
        riskMultiplier: 1.15,
        targetReturnYears: 7,
    });

    const [expansion, setExpansion] = useState<ExpansionInputs>({
        currentFootprintMW: inputs.itLoad / 1000,
        yearlyDemandGrowthPct: 25,
        planningHorizonYears: 5,
        capexPerMW: capexResults ? (capexResults.total / (inputs.itLoad / 1000)) : 6_000_000,
        gridReservationLeadMonths: 18,
    });

    /* ── AC2 (owner): inputs are NOT re-asked here — they derive from Site
     * Intelligence (land/grid), Requirements (growth/contract) and CAPEX.
     * The auto-sync keeps this page an OUTPUT surface; source chips + edit
     * links point at the owning pages. Acquisition comps stay local (market
     * data — genuinely strategic-only). */
    const req = useRequirementsStore();
    const sites = useSitesStore((s) => s.sites);
    const selectedSiteId = useSitesStore((s) => s.selectedSiteId);
    const activeSite = sites.find((s) => s.id === selectedSiteId) ?? sites[0] ?? null;
    const derivedFeas = useMemo(() => {
        const acres = activeSite?.attributes.usableAcres ?? activeSite?.attributes.totalAcres ?? null;
        const landAreaM2 = acres != null ? Math.round(acres * 4046.86) : null;
        const gridCapacityMW = activeSite?.attributes.availableCapacityMw ?? null;
        const ambient = activeSite?.attributes.avgAmbientC ?? null;
        const climateZone: FeasibilityInputs['climateZone'] | null =
            ambient == null ? (selectedCountry?.id === 'ID' || selectedCountry?.id === 'SG' || selectedCountry?.id === 'MY' ? 'tropical' : null)
                : ambient >= 26 ? 'tropical' : ambient >= 22 ? 'arid' : ambient >= 14 ? 'temperate' : ambient >= 5 ? 'continental' : 'polar';
        const targetPUE = getPUE(inputs.coolingType);
        return { landAreaM2, gridCapacityMW, climateZone, targetPUE };
    }, [activeSite, selectedCountry, inputs.coolingType]);
    const derivedExp = useMemo(() => {
        const y0 = inputs.itLoad / 1000;
        const y5 = req.growth.itLoadMwByYear.y5 || 0;
        const growthPct = y5 > 0 ? Math.round(cagr5(y0, y5) * 100) : null;
        const horizon = req.overview.contractDurationYr === 'custom'
            ? (req.overview.contractDurationCustom ?? 5) : Math.min(10, req.overview.contractDurationYr);
        return { growthPct, horizon };
    }, [inputs.itLoad, req.growth.itLoadMwByYear.y5, req.overview.contractDurationYr, req.overview.contractDurationCustom]);
    useEffect(() => {
        setFeasibility((f) => ({
            ...f,
            ...(derivedFeas.landAreaM2 != null ? { landAreaM2: derivedFeas.landAreaM2 } : {}),
            ...(derivedFeas.gridCapacityMW != null ? { gridCapacityMW: derivedFeas.gridCapacityMW } : {}),
            ...(derivedFeas.climateZone != null ? { climateZone: derivedFeas.climateZone } : {}),
            targetPUE: derivedFeas.targetPUE,
        }));
    }, [derivedFeas]);
    useEffect(() => {
        setExpansion((x) => ({
            ...x,
            currentFootprintMW: inputs.itLoad / 1000,
            ...(derivedExp.growthPct != null ? { yearlyDemandGrowthPct: derivedExp.growthPct } : {}),
            planningHorizonYears: derivedExp.horizon,
            capexPerMW: capexResults ? (capexResults.total / (inputs.itLoad / 1000)) : x.capexPerMW,
        }));
    }, [derivedExp, inputs.itLoad, capexResults]);
    const SourceChip = ({ from, tab }: { from: string; tab: string }) => (
        <button onClick={() => useSimulationStore.getState().actions.setActiveTab(tab as never)}
            title={`Derived from ${from} — click to edit at the source`}
            className="ml-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase text-emerald-500 hover:bg-emerald-500/20">
            {from} ↗
        </button>
    );

    // --- Feasibility Calculations ---
    const feasibilityResults = useMemo(() => {
        const basePUE = getPUE(inputs.coolingType);
        const climatePenalty = CLIMATE_PUE_PENALTY[feasibility.climateZone];
        const effectivePUE = Math.max(basePUE, feasibility.targetPUE + climatePenalty);

        // MW per 1000 m2 of data hall floor (standard ~500W/m2 IT density for mixed use)
        const hallFloorM2 = feasibility.landAreaM2 * 0.40; // 40% of land = data hall
        const itDensityWPerM2 = 500; // conservative mixed density
        const buildableITKw = (hallFloorM2 * itDensityWPerM2) / 1000;
        const buildableITMW = buildableITKw / 1000;

        // Grid-constrained capacity
        const gridConstrainedMW = feasibility.gridCapacityMW / effectivePUE;
        const actualITMW = Math.min(buildableITMW, gridConstrainedMW);

        // Utility headroom
        const gridHeadroomMW = feasibility.gridCapacityMW - (actualITMW * effectivePUE);
        const gridHeadroomPct = (gridHeadroomMW / feasibility.gridCapacityMW) * 100;

        // Cost estimate
        const estimatedCapex = actualITMW * (capexResults ? (capexResults.total / (inputs.itLoad / 1000)) : 6_000_000);

        const elecRate = selectedCountry?.economy?.electricityRate ?? 0.10;
        const annualEnergyCost = actualITMW * 1000 * effectivePUE * 8760 * elecRate;

        const bottleneck = buildableITMW < gridConstrainedMW ? 'land' : 'grid';

        return {
            effectivePUE,
            buildableITMW,
            gridConstrainedMW,
            actualITMW,
            gridHeadroomMW,
            gridHeadroomPct,
            estimatedCapex,
            annualEnergyCost,
            bottleneck,
            hallFloorM2,
        };
    }, [feasibility, inputs.coolingType, inputs.itLoad, capexResults, selectedCountry]);

    // --- Acquisition Calculations ---
    const acquisitionResults = useMemo(() => {
        const comps = [acquisition.comparableA, acquisition.comparableB, acquisition.comparableC];
        const avgComp = comps.reduce((a, b) => a + b, 0) / comps.length;
        const bidFloor = avgComp * 0.88;
        const bidCeiling = avgComp * acquisition.riskMultiplier;
        const fairValue = avgComp;
        const premiumPct = ((acquisition.targetSiteDollarPerMW - fairValue) / fairValue) * 100;

        // ROI horizon: DC revenue at $150/kW-month colocation rate (illustrative)
        const itCapacityKW = inputs.itLoad; // real project IT load
        const annualRevenue = itCapacityKW * 150 * 12;
        const totalInvestment = acquisition.targetSiteDollarPerMW * (itCapacityKW / 1000);
        // Engine-real annual OPEX (models.opex) for the 5 MW site; falls back to an
        // 8%-of-CAPEX heuristic if the engine is unavailable (SSR / not loaded).
        const sitePue = getPUE(inputs.coolingType);
        let opexEstimate = totalInvestment * 0.08;
        try {
            const om = rzModels().opex;
            if (om?.totalAnnual) {
                const r = om.totalAnnual(itCapacityKW / 1000, sitePue, selectedCountry?.id || 'US', 15);
                opexEstimate = typeof r === 'number' ? r : (r?.total ?? opexEstimate);
            }
        } catch { /* fallback heuristic */ }
        const annualNOI = annualRevenue - opexEstimate;
        const simpleROIYears = totalInvestment / annualNOI;
        const capRate = (annualNOI / totalInvestment) * 100;

        return {
            avgComp,
            bidFloor,
            bidCeiling,
            fairValue,
            premiumPct,
            simpleROIYears,
            capRate,
            annualRevenue,
            annualNOI,
            totalInvestment,
        };
    }, [acquisition, inputs.coolingType, inputs.itLoad, selectedCountry]);

    // --- Expansion Calculations ---
    const expansionResults = useMemo(() => {
        const years = Array.from({ length: expansion.planningHorizonYears }, (_, i) => i + 1);
        const demandTimeline = years.map(y => ({
            year: y,
            demandMW: expansion.currentFootprintMW * Math.pow(1 + expansion.yearlyDemandGrowthPct / 100, y),
            currentCapacity: expansion.currentFootprintMW,
        }));

        // Find when demand hits 80% utilization trigger
        const triggerYear = demandTimeline.find(d => d.demandMW / d.currentCapacity >= 0.80)?.year ?? 1;
        const expansionNeededMW = demandTimeline[demandTimeline.length - 1].demandMW - expansion.currentFootprintMW;
        const totalCapexRequired = expansionNeededMW * expansion.capexPerMW;

        // Phase schedule
        const phases = [];
        let cumulativeCapacity = expansion.currentFootprintMW;
        let phaseStart = triggerYear;
        while (cumulativeCapacity < demandTimeline[demandTimeline.length - 1].demandMW && phases.length < 4) {
            const phaseSize = Math.min(expansion.currentFootprintMW, demandTimeline[demandTimeline.length - 1].demandMW - cumulativeCapacity);
            phases.push({
                label: `Phase ${phases.length + 2}`,
                startYear: phaseStart,
                capacityMW: phaseSize,
                capex: phaseSize * expansion.capexPerMW,
                gridReservationMonth: phaseStart * 12 - expansion.gridReservationLeadMonths,
            });
            cumulativeCapacity += phaseSize;
            phaseStart += 2;
        }

        return { demandTimeline, triggerYear, expansionNeededMW, totalCapexRequired, phases };
    }, [expansion]);

    const MODES: { id: PlanningMode; label: string; icon: React.ReactNode; desc: string }[] = [
        { id: 'feasibility', label: 'Feasibility Mode', icon: <MapPin className="w-4 h-4" />, desc: 'Land + grid to buildable IT load' },
        { id: 'acquisition', label: 'Acquisition Mode', icon: <Scale className="w-4 h-4" />, desc: 'Site bid range + ROI horizon' },
        { id: 'expansion', label: 'Expansion Mode', icon: <TrendingUp className="w-4 h-4" />, desc: 'Growth timeline + CAPEX schedule' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="p-5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm dark:shadow-none">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-cyan-500" />
                    Strategic Planning
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Land feasibility, site acquisition analysis, and multi-phase expansion scheduling
                </p>
            </div>
            {/* #335 — PURPOSE (owner bingung fungsinya): halaman OUTPUT analisis strategis. */}
            <p className="rounded-lg border border-violet-500/30 bg-violet-600/5 px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300">
                <b>Untuk apa halaman ini:</b> analisis strategis TURUNAN dari data project yang sudah kamu isi — (1) <b>Feasibility</b>: apakah lahan/grid/iklim site sanggup menampung target MW; (2) <b>Expansion</b>: kapan & berapa fase ekspansi berdasar pertumbuhan demand; (3) <b>Acquisition</b>: banding beli-vs-bangun dgn comparables pasar. Input yang sudah ada di menu lain TERKUNCI di sini (satu sumber) — edit di menu asalnya; hanya parameter analisis lokal (growth, horizon, comparables) yang diisi di sini.
            </p>

            {/* Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {MODES.map(m => (
                    <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={clsx(
                            'p-4 rounded-xl border text-left transition-all',
                            mode === m.id
                                ? 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-400 dark:border-cyan-600 shadow-sm'
                                : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        )}
                    >
                        <div className={clsx('flex items-center gap-2 mb-1 font-semibold text-sm',
                            mode === m.id ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-800 dark:text-slate-200'
                        )}>
                            {m.icon}
                            {m.label}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{m.desc}</div>
                    </button>
                ))}
            </div>

            {/* ── FEASIBILITY MODE ── */}
            {mode === 'feasibility' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Inputs */}
                    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm">
                            <Building className="w-4 h-4 text-indigo-500" />
                            Site Parameters
                        </h3>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Total Land Area (m²) <Tooltip content="Total land parcel area. Roughly 40% will be usable as data hall floor, the rest used for cooling yards, access roads, substation setback, and future expansion reserve." />
                                {derivedFeas.landAreaM2 != null && <SourceChip from="Site Intelligence" tab="site" />}
                            </label>
                            <input
                                type="number"
                                className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                                value={feasibility.landAreaM2}
                                disabled={derivedFeas.landAreaM2 != null}
                                title={derivedFeas.landAreaM2 != null ? 'Derived dari Site Intelligence — edit di sana (#335 dedup)' : undefined}
                                onChange={e => setFeasibility(f => ({ ...f, landAreaM2: Number(e.target.value) }))}
                            />
                            <div className="text-[10px] text-slate-400 mt-0.5">Hall floor approx: {Math.round(feasibility.landAreaM2 * 0.40).toLocaleString()} m²</div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Grid Capacity (MW) <Tooltip content="Committed or available grid connection capacity from the local utility. This is the hard ceiling on total facility power draw (IT + cooling + ancillaries)." />
                                {derivedFeas.gridCapacityMW != null && <SourceChip from="Site Intelligence" tab="site" />}
                            </label>
                            <input
                                type="number"
                                className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                                value={feasibility.gridCapacityMW}
                                disabled={derivedFeas.gridCapacityMW != null}
                                title={derivedFeas.gridCapacityMW != null ? 'Derived dari Site Intelligence — edit di sana (#335 dedup)' : undefined}
                                onChange={e => setFeasibility(f => ({ ...f, gridCapacityMW: Number(e.target.value) }))}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Climate Zone <Tooltip content="Climate directly affects PUE. Tropical climates require full mechanical cooling year-round. Polar climates can use free-cooling 80%+ of the year." />
                                {derivedFeas.climateZone != null && <SourceChip from="Site / Country" tab="site" />}
                            </label>
                            <select
                                className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                                value={feasibility.climateZone}
                                disabled={derivedFeas.climateZone != null}
                                title={derivedFeas.climateZone != null ? 'Derived dari negara/site — edit di sana (#335 dedup)' : undefined}
                                onChange={e => setFeasibility(f => ({ ...f, climateZone: e.target.value as FeasibilityInputs['climateZone'] }))}
                            >
                                {(Object.keys(CLIMATE_LABELS) as FeasibilityInputs['climateZone'][]).map(z => (
                                    <option key={z} value={z}>{CLIMATE_LABELS[z]}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Target PUE <Tooltip content="Design PUE target before climate adjustment. The climate zone adds a penalty on top." />
                                <SourceChip from="Engine PUE" tab="requirements" />
                            </label>
                            <input
                                type="range" min={1.10} max={2.0} step={0.05}
                                className="w-full accent-cyan-500"
                                value={feasibility.targetPUE}
                                onChange={e => setFeasibility(f => ({ ...f, targetPUE: Number(e.target.value) }))}
                            />
                            <div className="flex justify-between text-[10px] text-slate-400">
                                <span>1.10 (Excellent)</span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{feasibility.targetPUE.toFixed(2)}</span>
                                <span>2.00 (Poor)</span>
                            </div>
                        </div>
                    </div>

                    {/* Results */}
                    <div className="space-y-4">
                        <div className={clsx(
                            'p-4 rounded-xl border',
                            feasibilityResults.bottleneck === 'land'
                                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                                : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
                        )}>
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className={`w-4 h-4 ${feasibilityResults.bottleneck === 'land' ? 'text-amber-500' : 'text-rose-500'}`} />
                                <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                                    Binding Constraint: {feasibilityResults.bottleneck === 'land' ? 'Land Area' : 'Grid Capacity'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                {feasibilityResults.bottleneck === 'land'
                                    ? `Land limits buildable IT to ${feasibilityResults.buildableITMW.toFixed(1)} MW — grid could support ${feasibilityResults.gridConstrainedMW.toFixed(1)} MW`
                                    : `Grid limits usable IT to ${feasibilityResults.gridConstrainedMW.toFixed(1)} MW — land could physically host ${feasibilityResults.buildableITMW.toFixed(1)} MW`
                                }
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Buildable IT Load', value: `${feasibilityResults.actualITMW.toFixed(1)} MW`, sub: 'min(land, grid)', color: 'text-cyan-600 dark:text-cyan-400' },
                                { label: 'Effective PUE', value: feasibilityResults.effectivePUE.toFixed(2), sub: `+${(CLIMATE_PUE_PENALTY[feasibility.climateZone] * 100).toFixed(0)}% climate`, color: 'text-amber-600 dark:text-amber-400' },
                                { label: 'Grid Headroom', value: `${feasibilityResults.gridHeadroomMW.toFixed(1)} MW`, sub: `${feasibilityResults.gridHeadroomPct.toFixed(0)}% reserve`, color: 'text-emerald-600 dark:text-emerald-400' },
                                { label: 'Annual Energy Cost', value: fmtMoney(feasibilityResults.annualEnergyCost), sub: `@ $${selectedCountry?.economy?.electricityRate?.toFixed(2) ?? '0.10'}/kWh`, color: 'text-rose-600 dark:text-rose-400' },
                            ].map(item => (
                                <div key={item.label} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{item.label}</div>
                                    <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">{item.sub}</div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Estimated CAPEX</div>
                            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{fmtMoney(feasibilityResults.estimatedCapex)}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                                {fmtMoney(feasibilityResults.estimatedCapex / feasibilityResults.actualITMW / 1000)}/kW
                                {' · '}CAPEX-module rate × the land/grid-CONSTRAINED {feasibilityResults.actualITMW.toFixed(1)} MW
                                {' — '}not the project {(inputs.itLoad / 1000).toFixed(1)} MW (see Value Bindings)
                            </div>
                            <div className="mt-3 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, (feasibilityResults.actualITMW / feasibilityResults.gridConstrainedMW) * 100)}%` }}
                                />
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">IT load vs grid limit utilization</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ACQUISITION MODE ── */}
            {mode === 'acquisition' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            Site Valuation Inputs ($/MW IT Load)
                        </h3>

                        {([
                            { key: 'targetSiteDollarPerMW', label: 'Target Site Ask Price ($/MW)', tip: 'The price per MW the seller is asking. Compare against market comparables.' },
                            { key: 'comparableA', label: 'Comparable A ($/MW)', tip: 'Recent comparable transaction 1.' },
                            { key: 'comparableB', label: 'Comparable B ($/MW)', tip: 'Recent comparable transaction 2.' },
                            { key: 'comparableC', label: 'Comparable C ($/MW)', tip: 'Recent comparable transaction 3.' },
                        ] as const).map(f => (
                            <div key={f.key}>
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                    {f.label} <Tooltip content={f.tip} />
                                </label>
                                <input
                                    type="number"
                                    className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                                    value={acquisition[f.key]}
                                    onChange={e => setAcquisition(a => ({ ...a, [f.key]: Number(e.target.value) }))}
                                />
                            </div>
                        ))}

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Risk Multiplier <Tooltip content="Applies a risk premium above comparable average for higher-risk sites (seismic zone, grid reliability, permitting uncertainty)." />
                            </label>
                            <input
                                type="range" min={1.0} max={1.5} step={0.01}
                                className="w-full accent-cyan-500"
                                value={acquisition.riskMultiplier}
                                onChange={e => setAcquisition(a => ({ ...a, riskMultiplier: Number(e.target.value) }))}
                            />
                            <div className="flex justify-between text-[10px] text-slate-400">
                                <span>1.0x (No premium)</span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{acquisition.riskMultiplier.toFixed(2)}x</span>
                                <span>1.5x (High risk)</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                            <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">Bid Range Analysis</h4>
                            <div className="space-y-2">
                                {[
                                    { label: 'Floor (Aggressive Bid)', value: acquisitionResults.bidFloor, color: 'text-emerald-600 dark:text-emerald-400', note: '88% of comparable avg' },
                                    { label: 'Fair Value', value: acquisitionResults.fairValue, color: 'text-slate-800 dark:text-slate-200', note: 'Comp average' },
                                    { label: 'Ceiling (Risk-adj.)', value: acquisitionResults.bidCeiling, color: 'text-amber-600 dark:text-amber-400', note: `${(acquisition.riskMultiplier * 100).toFixed(0)}% of fair value` },
                                    { label: 'Target Ask', value: acquisition.targetSiteDollarPerMW, color: acquisitionResults.premiumPct > 10 ? 'text-rose-600 dark:text-rose-400' : 'text-cyan-600 dark:text-cyan-400', note: `${acquisitionResults.premiumPct > 0 ? '+' : ''}${acquisitionResults.premiumPct.toFixed(1)}% vs fair value` },
                                ].map(row => (
                                    <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                        <span className="text-xs text-slate-600 dark:text-slate-400">{row.label}</span>
                                        <div className="text-right">
                                            <div className={`text-sm font-bold ${row.color}`}>{fmtMoney(row.value)}/MW</div>
                                            <div className="text-[10px] text-slate-400">{row.note}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Cap Rate</div>
                                <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{acquisitionResults.capRate.toFixed(1)}%</div>
                                <div className="text-[10px] text-slate-400">NOI / Total Investment</div>
                            </div>
                            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Simple Payback</div>
                                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{acquisitionResults.simpleROIYears.toFixed(1)} yr</div>
                                <div className="text-[10px] text-slate-400">At $150/kW-mo colo rate</div>
                            </div>
                        </div>

                        <div className={clsx(
                            'p-4 rounded-xl border text-sm',
                            acquisitionResults.premiumPct > 15
                                ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                                : acquisitionResults.premiumPct > 5
                                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                                : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        )}>
                            <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                                {acquisitionResults.premiumPct > 15 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                Acquisition Signal
                            </div>
                            <p className="text-xs leading-relaxed">
                                {acquisitionResults.premiumPct > 15
                                    ? `Ask price is ${acquisitionResults.premiumPct.toFixed(1)}% above market comparables. Negotiate down or walk away unless strategic premium is justified (zoning, power tenure, or location scarcity).`
                                    : acquisitionResults.premiumPct > 5
                                    ? `Ask price is ${acquisitionResults.premiumPct.toFixed(1)}% above market. Manageable with risk-adjusted ceiling — proceed with due diligence on grid tenure and permitting status.`
                                    : `Ask price is at or below market fair value (${Math.abs(acquisitionResults.premiumPct).toFixed(1)}% ${acquisitionResults.premiumPct < 0 ? 'discount' : 'premium'}). Strong acquisition candidate — move to exclusivity quickly.`
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── EXPANSION MODE ── */}
            {mode === 'expansion' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm">
                            <BarChart3 className="w-4 h-4 text-violet-500" />
                            Expansion Parameters
                        </h3>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Current Footprint (MW) <Tooltip content="Current deployed IT load capacity." />
                                <SourceChip from="Requirements" tab="requirements" />
                            </label>
                            <input
                                type="number" min={0.5} step={0.5}
                                className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                                value={expansion.currentFootprintMW}
                                disabled title="≡ IT Load project (Requirements) — satu sumber, edit di sana (#335 dedup)"
                                onChange={e => setExpansion(x => ({ ...x, currentFootprintMW: Number(e.target.value) }))}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Annual Demand Growth <Tooltip content="Expected year-over-year IT load demand growth. AI workloads drive 30-50% compound growth at many hyperscaler facilities." />
                                {derivedExp.growthPct != null && <SourceChip from="Requirements growth" tab="requirements" />}
                            </label>
                            <input
                                type="range" min={5} max={80} step={1}
                                className="w-full accent-cyan-500"
                                value={expansion.yearlyDemandGrowthPct}
                                onChange={e => setExpansion(x => ({ ...x, yearlyDemandGrowthPct: Number(e.target.value) }))}
                            />
                            <div className="flex justify-between text-[10px] text-slate-400">
                                <span>5%</span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{expansion.yearlyDemandGrowthPct}% / year</span>
                                <span>80%</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Planning Horizon (Years) <Tooltip content="How many years to model demand growth and phased expansion." />
                                <SourceChip from="Contract duration" tab="requirements" />
                            </label>
                            <select
                                className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                                value={expansion.planningHorizonYears}
                                onChange={e => setExpansion(x => ({ ...x, planningHorizonYears: Number(e.target.value) }))}
                            >
                                {[3, 5, 7, 10].map(y => <option key={y} value={y}>{y} years</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                CAPEX per MW <Tooltip content="Expected build cost per MW of IT capacity for the expansion phases." />
                                {capexResults && <SourceChip from="CAPEX engine" tab="capex" />}
                            </label>
                            <input
                                type="number" step={100000}
                                className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700"
                                value={expansion.capexPerMW}
                                disabled title="≡ CAPEX engine $/MW hasil — edit asumsi CAPEX (#335 dedup)"
                                onChange={e => setExpansion(x => ({ ...x, capexPerMW: Number(e.target.value) }))}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1 mb-1.5">
                                Grid Reservation Lead Time (months) <Tooltip content="How many months before a phase goes live that grid capacity must be reserved from the utility. Typically 12-24 months." />
                            </label>
                            <input
                                type="range" min={6} max={36} step={3}
                                className="w-full accent-cyan-500"
                                value={expansion.gridReservationLeadMonths}
                                onChange={e => setExpansion(x => ({ ...x, gridReservationLeadMonths: Number(e.target.value) }))}
                            />
                            <div className="flex justify-between text-[10px] text-slate-400">
                                <span>6 mo</span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{expansion.gridReservationLeadMonths} months</span>
                                <span>36 mo</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Demand timeline */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                            <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">Demand Growth Timeline</h4>
                            <div className="space-y-2">
                                {expansionResults.demandTimeline.map(row => {
                                    const utilization = Math.min(1, row.demandMW / expansion.currentFootprintMW);
                                    return (
                                        <div key={row.year}>
                                            <div className="flex justify-between text-xs mb-0.5">
                                                <span className="text-slate-600 dark:text-slate-400">Year {row.year}</span>
                                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                    {row.demandMW.toFixed(1)} MW
                                                    <span className={clsx('ml-2 text-[10px]', utilization >= 1 ? 'text-rose-500' : utilization >= 0.8 ? 'text-amber-500' : 'text-emerald-500')}>
                                                        ({(utilization * 100).toFixed(0)}%)
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={clsx('h-full rounded-full transition-all', utilization >= 1 ? 'bg-rose-400' : utilization >= 0.8 ? 'bg-amber-400' : 'bg-emerald-400')}
                                                    style={{ width: `${Math.min(100, utilization * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Phase schedule */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                            <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">Recommended Expansion Schedule</h4>
                            <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
                                Trigger point: Year {expansionResults.triggerYear} (demand crosses 80% utilization). Break ground now — grid reservation must start in month {Math.max(1, expansionResults.triggerYear * 12 - expansion.gridReservationLeadMonths)}.
                            </div>
                            {expansionResults.phases.length === 0 ? (
                                <p className="text-xs text-slate-500">No expansion needed within the planning horizon.</p>
                            ) : (
                                <div className="space-y-2">
                                    {expansionResults.phases.map(ph => (
                                        <div key={ph.label} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <div className="w-2 h-2 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                                            <div className="flex-1">
                                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{ph.label} — {ph.capacityMW.toFixed(1)} MW</div>
                                                <div className="text-[10px] text-slate-400">Start: Year {ph.startYear} · CAPEX: {fmtMoney(ph.capex)} · Grid reservation: month {Math.max(1, ph.gridReservationMonth)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between text-xs">
                                <span className="text-slate-500">Total Expansion Needed</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {expansionResults.expansionNeededMW.toFixed(1)} MW · {fmtMoney(expansionResults.totalCapexRequired)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Use-case guide */}
            <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                    <Globe2 className="w-4 h-4 text-slate-400" />
                    When to Use Each Mode
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    {[
                        {
                            title: 'Land / Power Feasibility',
                            when: 'Early-stage site selection. You have a land parcel and a utility quote — determine if the combination is viable before committing to option agreements.',
                            output: 'Buildable IT MW, grid headroom, PUE estimate, CAPEX range',
                        },
                        {
                            title: 'Acquisition Assessment',
                            when: 'Due diligence on a target site with a quoted ask price. Benchmark against recent market comps to determine bid range and walk-away threshold.',
                            output: 'Fair value, bid floor/ceiling, cap rate, simple payback',
                        },
                        {
                            title: 'Expansion Scenario',
                            when: 'Existing facility approaching capacity. Model demand growth to determine when and how large to expand, and when to place grid reservation orders.',
                            output: 'Phase trigger year, CAPEX schedule, grid reservation timeline',
                        },
                    ].map(item => (
                        <div key={item.title} className="space-y-1">
                            <div className="font-semibold text-slate-700 dark:text-slate-300">{item.title}</div>
                            <div className="text-slate-500 dark:text-slate-400 leading-relaxed">{item.when}</div>
                            <div className="text-cyan-600 dark:text-cyan-400 mt-1">
                                <span className="font-medium">Output: </span>{item.output}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
