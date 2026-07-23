
'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore, effectiveInHouseFrac, STRATEGY_MIX_PRESETS, normalizeStrategyMix } from '@/store/simulation';
import { rzModels, useEngineReady } from '@/lib/rz-engine';
import { calculateStaffing, compareShiftModels, generate5YearProjection, StaffRole, StaffingResult, REFERENCE_STAFFING_10MW, ROLE_LABELS, calculateAutoHeadcount } from '@/modules/staffing/ShiftEngine';
import { useEffectiveInputs } from '@/store/useEffectiveInputs';
import { generateAnnualRoster } from '@/modules/staffing/RosterEngine';
import { calculateTurnoverCost as calculateCostOfTurnover } from '@/modules/staffing/CostOfTurnover';
import { Users, Clock, DollarSign, AlertTriangle, Calendar, Award, Briefcase, TrendingUp, ArrowRight, CheckCircle, XCircle, BarChart3, Activity, Building2, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import { TraceValue } from '@/components/ui/TraceValue';
import { fmtMoney, fmtMoneyFull } from '@/lib/format';
import clsx from 'clsx';

import { OrgChart } from '@/components/visualizations/OrgChart';
import { RosterVisualizer } from '@/components/visualizations/RosterVisualizer';
import { CostWaterfall } from '@/components/visualizations/CostWaterfall';
import { WorkOrderView } from '@/components/modules/WorkOrderView';
import { ExportPDFButton } from '@/components/ui/ExportPDFButton';
import type { ReportInsight } from '@/modules/reporting/NarrativeEngine';

/** Shape of models.maintenance.opsHeadcount (engine G3 — labor-hours-driven). */
interface EngineOpsModel {
    nDc: number;
    mwPerDc: number;
    laborHours: { pm: number; cbmAnalysis: number; emergency: number; total: number };
    failuresPerYr: number;
    roles: {
        onsiteTechFte: number; techBasis: string;
        shiftOpsFte: number; shiftOpsBasis: string;
        campusSharedFte: number; campusSharedBasis: string;
    };
    totalFte: number;
    vendorLaborHours: number;
    phenotype: string;
    method: string;
}

export function StaffingDashboard() {
    const { selectedCountry, inputs, actions } = useSimulationStore();
    const effectiveInputs = useEffectiveInputs();
    const [activeTab, setActiveTab] = useState<'overview' | 'comparison' | 'org' | 'roster' | 'waterfall' | 'workorders'>('overview');
    const [isExporting, setIsExporting] = useState(false);
    const engineReady = useEngineReady(); // re-run engine memo once rz-engine.min.js lands

    /* ═══ Workstream G-staffing — Campus Operations Model (engine, ACCURACY).
     * Labor-hours-driven headcount from models.maintenance.opsHeadcount:
     * PM + CBM + emergency hours × in-house share ÷ productive hours, with
     * campus topology (N DC × 35 MW), per-DC shift floors and per-campus
     * shared roles. The legacy per-MW composition below remains as the
     * SCREENING model. ═══ */
    const opsModel: EngineOpsModel | null = useMemo(() => {
        const fn = rzModels().maintenance?.opsHeadcount;
        if (typeof fn !== 'function') return null;
        try {
            return fn({
                itLoadKw: inputs.itLoad,
                tier: inputs.tierLevel,
                mix: inputs.strategyMix ?? STRATEGY_MIX_PRESETS[inputs.maintenanceStrategy || 'planned'],
                inHouseFrac: effectiveInHouseFrac(inputs),
            }) as EngineOpsModel;
        } catch {
            return null;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputs.itLoad, inputs.tierLevel, inputs.strategyMix, inputs.maintenanceStrategy, inputs.maintenanceModel, inputs.hybridRatio, engineReady]);

    // Auto headcount calculation for rationale display
    const autoResult = useMemo(() => {
        return calculateAutoHeadcount(
            inputs.itLoad,
            inputs.tierLevel,
            inputs.shiftModel,
            inputs.staffingModel === 'outsourced' ? 'outsourced' : inputs.staffingModel,
            inputs.maintenanceModel,
            inputs.maintenanceStrategy,
            inputs.hybridRatio ?? 0.5
        );
    }, [inputs.itLoad, inputs.tierLevel, inputs.shiftModel, inputs.staffingModel, inputs.maintenanceModel, inputs.maintenanceStrategy, inputs.hybridRatio]);

    // Memoized calculations
    const results = useMemo(() => {
        if (!selectedCountry) return null;

        type HeadcountKey = 'headcount_ShiftLead' | 'headcount_Engineer' | 'headcount_Technician' | 'headcount_Admin' | 'headcount_Janitor';
        const roleConfigs: { role: StaffRole; qtyKey: HeadcountKey; is24x7: boolean; label: string }[] = [
            { role: 'shift-lead', qtyKey: 'headcount_ShiftLead', is24x7: true, label: 'Team Leaders' },
            { role: 'engineer', qtyKey: 'headcount_Engineer', is24x7: true, label: 'Engineers' },
            { role: 'technician', qtyKey: 'headcount_Technician', is24x7: false, label: 'Technicians' },
            { role: 'admin', qtyKey: 'headcount_Admin', is24x7: false, label: 'Supervisor' },
            { role: 'janitor', qtyKey: 'headcount_Janitor', is24x7: false, label: 'Facility Staff' },
        ];

        const staffingResults: StaffingResult[] = roleConfigs.map(cfg => {
            const qty = effectiveInputs[cfg.qtyKey] || 1;
            const opModel = inputs.staffingModel === 'outsourced' ? 'vendor' : inputs.staffingModel;
            return calculateStaffing(cfg.role, qty, inputs.shiftModel, selectedCountry, cfg.is24x7, undefined, undefined, opModel, inputs.hybridRatio ?? 0.5);
        });

        const totalHeadcount = staffingResults.reduce((acc, r) => acc + r.headcount, 0);
        const totalMonthlyCost = staffingResults.reduce((acc, r) => acc + r.monthlyCost, 0);
        const totalOnShift = staffingResults.filter(r => r.schedule.teamsRequired > 1).reduce((acc, r) => acc + r.onShiftCount, 0);

        // Shift Comparison (for the comparison tab)
        const shiftComparisons = roleConfigs
            .filter(cfg => cfg.is24x7)
            .map(cfg => {
                const qty = inputs[cfg.qtyKey] || 1;
                const opModel = inputs.staffingModel === 'outsourced' ? 'vendor' : inputs.staffingModel;
                return {
                    label: cfg.label,
                    comparison: compareShiftModels(cfg.role, qty, selectedCountry, cfg.is24x7, opModel),
                };
            });

        // Total comparison
        const total8hCost = shiftComparisons.reduce((a, c) => a + c.comparison.model8h.monthlyCost, 0);
        const total12hCost = shiftComparisons.reduce((a, c) => a + c.comparison.model12h.monthlyCost, 0);
        const totalSavings = total8hCost - total12hCost;

        // Projections
        const projections = generate5YearProjection(staffingResults, selectedCountry.economy?.laborEscalation ?? 0.04);

        // A10: Unified turnover cost model via CostOfTurnover
        const avgSalary = totalMonthlyCost / totalHeadcount;
        const turnoverImpact = calculateCostOfTurnover(
            'Duty Engineer',
            avgSalary,
            selectedCountry,
            inputs.turnoverRate || 0.15,
            totalHeadcount
        );

        // Roster Generation — pass selectedCountry for accurate public holiday awareness
        const rosterPattern = inputs.shiftModel === '12h' ? '4on-3off' : '3shift-8h';
        const rosterYear = new Date().getFullYear();
        const roster = generateAnnualRoster(rosterYear, rosterPattern, new Date(rosterYear, 0, 1), selectedCountry);

        return {
            staffingResults, totalHeadcount, totalMonthlyCost, totalOnShift,
            projections, turnoverImpact, roster,
            shiftComparisons, total8hCost, total12hCost, totalSavings,
            roleConfigs,
        };
    }, [selectedCountry, inputs, effectiveInputs]);

    if (!selectedCountry || !results) return (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500 dark:text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            <p className="text-sm">Loading staffing data…</p>
        </div>
    );

    // Uptime Institute critical-facilities staffing benchmark (engine) vs configured.
    const staffMw = Math.max(0.5, (inputs.itLoad || 0) / 1000);
    const staffBench = rzModels().maintenance?.staffingBenchmark
        ? rzModels().maintenance.staffingBenchmark(staffMw, inputs.tierLevel)
        : null;

    return (
        <div className="space-y-6">
            {/* ═══ G-staffing — Campus Operations Model (engine, ACCURACY basis) ═══ */}
            {opsModel && (() => {
                const mixN = normalizeStrategyMix(inputs.strategyMix ?? STRATEGY_MIX_PRESETS[inputs.maintenanceStrategy || 'planned']);
                const inHousePct = Math.round(effectiveInHouseFrac(inputs) * 100);
                return (
                    <div className="bg-white dark:bg-slate-900/50 border border-cyan-200 dark:border-cyan-800/60 rounded-xl p-5 shadow-sm dark:shadow-none">
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                                Campus Operations Model (engine)
                                <Tooltip content={`Labor-hours-driven operations headcount from the shared engine (models.maintenance.opsHeadcount). Maintenance labor demand = SFG20-informed PM hours + CBM analysis + failure-driven emergency hours, shaped by the strategy % mix; the in-house share of that demand ÷ productive hours per FTE gives technicians, with a per-DC emergency-response shift floor; shift operations follow Uptime 4.2 FTE/position; campus-shared roles are counted once per campus. This is the ACCURACY basis — the per-MW composition below is the screening model. Method: ${opsModel.method}`} />
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30">accuracy model</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700" title="Operating phenotype the engine detected from the strategy mix + sourcing split. Vendor-heavy + reactive-heavy collapses the technician floor to a skeleton crew (1/shift/DC); predictive-heavy in-house runs a CBM analysis program.">
                                {opsModel.phenotype}
                            </span>
                            <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800" title="Live inputs driving the model: maintenance strategy % mix (Maintenance page) and in-house share (sourcing model / hybrid slider).">
                                RTF {Math.round(mixN.reactive * 100)}% · PPM {Math.round(mixN.planned * 100)}% · PdM {Math.round(mixN.predictive * 100)}% · in-house {inHousePct}%
                            </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                            <div className="bg-slate-50 dark:bg-slate-950/40 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
                                <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">Campus Topology <Tooltip content={`The engine splits the campus into data halls of ~${opsModel.mwPerDc} MW each (hyperscale build practice). Per-DC roles (technician shift floors) scale with the DC count; campus-shared roles do not.`} /></div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{staffMw.toFixed(staffMw >= 10 ? 0 : 1)} MW → {opsModel.nDc} DC × {opsModel.mwPerDc} MW</div>
                                <div className="text-[10px] text-slate-500">{opsModel.failuresPerYr} expected failures/yr</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950/40 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
                                <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">Onsite Technicians <Tooltip content={`FTE technicians on the campus. Basis: ${opsModel.roles.techBasis}. Labor-hours-bound = demand-driven (in-house share of maintenance hours ÷ productive hours/FTE); shift-floor-bound = the per-DC emergency-response minimum dominates.`} /></div>
                                <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400 mt-1 tabular-nums">{opsModel.roles.onsiteTechFte} FTE</div>
                                <div className="text-[10px] text-slate-500 leading-tight" title={opsModel.roles.techBasis}>{opsModel.roles.techBasis}</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950/40 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
                                <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">Shift Operations <Tooltip content={`Control-room / DCO shift positions — this presence does not vendor out. Basis: ${opsModel.roles.shiftOpsBasis}. The 4.2 FTE/position factor covers rotation, leave and shrinkage (Uptime Institute).`} /></div>
                                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">{opsModel.roles.shiftOpsFte} FTE</div>
                                <div className="text-[10px] text-slate-500 leading-tight" title={opsModel.roles.shiftOpsBasis}>{opsModel.roles.shiftOpsBasis}</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950/40 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
                                <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">Campus-Shared Roles <Tooltip content={`Network/IT, DCO ops, security lead and facility management — counted ONCE PER CAMPUS, not per DC. Basis: ${opsModel.roles.campusSharedBasis}`} /></div>
                                <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">{opsModel.roles.campusSharedFte} FTE</div>
                                <div className="text-[10px] text-slate-500 leading-tight">per campus, not per DC</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950/40 rounded-lg p-3 border border-cyan-200 dark:border-cyan-800/50">
                                <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">Total FTE <Tooltip content="Sum of onsite technicians + shift operations + campus-shared roles from the engine ops model. Compare against the Uptime benchmark strip and the screening composition below — a large gap flags over-spend or coverage risk." /></div>
                                <div className="text-lg font-bold text-rz-data mt-1 tabular-nums">{opsModel.totalFte} FTE</div>
                                <div className="text-[10px] text-slate-500">engine ops total</div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-3">
                            <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1"><Wrench className="w-3 h-3" /> Labor Demand <Tooltip content="Annual maintenance labor-hours demand shaped by the strategy mix: PM hours carry the planned program (predictive share reduces task hours), CBM analysis hours come with the predictive share, emergency hours are failure-driven (crew of 2 per event). The in-house share of this demand drives the technician count; the rest is vendor-executed." /></span>
                            <span title="Planned-preventive program hours (SFG20-informed screening rate/MW·yr, reduced by the predictive share's task cut)">PM <b className="tabular-nums">{opsModel.laborHours.pm.toLocaleString()}</b> h/yr</span>
                            <span title="Condition-based-monitoring analysis hours carried by the predictive share of the mix">CBM <b className="tabular-nums">{opsModel.laborHours.cbmAnalysis.toLocaleString()}</b> h/yr</span>
                            <span title="Failure-driven emergency repair hours (expected failures × fix hours × crew of 2) — grows with the reactive share">Emergency <b className="tabular-nums">{opsModel.laborHours.emergency.toLocaleString()}</b> h/yr</span>
                            <span className="text-slate-400">·</span>
                            <span title="Total annual maintenance labor demand">Total <b className="tabular-nums">{opsModel.laborHours.total.toLocaleString()}</b> h/yr</span>
                            <span title="Hours executed by the vendor under the O&M contract (1 − in-house share of the demand)">vendor-executed <b className="tabular-nums">{opsModel.vendorLaborHours.toLocaleString()}</b> h/yr</span>
                        </div>
                    </div>
                );
            })()}
            {staffBench && (
                <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/70 text-xs">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">Uptime Staffing Benchmark <Tooltip content="Engine benchmark headcount from the Uptime Institute staffing model: 4.2 FTE per 24×7 position (covers rotation, leave and shrinkage) scaled by tier, plus per-MW technicians for the facility size. Your configured headcount is compared against it — within ±2 FTE is considered aligned; a large gap means over-spend or coverage risk." /></span>
                    <span className="text-slate-600 dark:text-slate-300">Benchmark <b className="tabular-nums text-cyan-500">{staffBench.totalFte} FTE</b> <span className="text-slate-400">({staffBench.ftePerMw ?? '—'}/MW, Tier {inputs.tierLevel}, {staffMw.toFixed(1)} MW)</span></span>
                    <span className="text-slate-600 dark:text-slate-300">Configured <b className="tabular-nums text-rz-data">{results.totalHeadcount} FTE</b></span>
                    {(() => { const d = results.totalHeadcount - staffBench.totalFte; const over = d > 0; return <span className={`tabular-nums font-semibold ${Math.abs(d) <= 2 ? 'text-rz-data' : over ? 'text-amber-500' : 'text-rose-400'}`}>{over ? '+' : ''}{d} vs benchmark {Math.abs(d) <= 2 ? '· aligned' : over ? '· above' : '· below'}</span>; })()}
                    <span className="text-[9px] text-slate-400 ml-auto">Uptime Institute · 4.2 FTE/24×7 position × tier + per-MW techs</span>
                </div>
            )}
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl backdrop-blur-sm shadow-sm dark:shadow-none gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
                        Staffing & Shift Optimization
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                        Reference Model: <span className="text-slate-900 dark:text-white font-medium">10MW DC (80% In-House)</span>
                        &nbsp;·&nbsp;
                        <span className="text-cyan-600 dark:text-cyan-400 font-mono font-bold">{inputs.shiftModel.toUpperCase()} SHIFT</span>
                        &nbsp;·&nbsp;
                        <span className="text-rz-data font-mono font-bold">{results.totalHeadcount} FTEs</span>
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === 'overview'
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('comparison')}
                        className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === 'comparison'
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                    >
                        8h Vs 12h
                    </button>
                    <button
                        onClick={() => setActiveTab('org')}
                        className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === 'org'
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                    >
                        Org Chart
                    </button>
                    <button
                        onClick={() => setActiveTab('roster')}
                        className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === 'roster'
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                    >
                        Roster
                    </button>
                    <button
                        onClick={() => setActiveTab('waterfall')}
                        className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === 'waterfall'
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                    >
                        Waterfall
                    </button>
                    <button
                        onClick={() => setActiveTab('workorders')}
                        className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            activeTab === 'workorders'
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                        )}
                    >
                        Work Orders
                    </button>
                </div>

                <div className="flex gap-2">
                    <ExportPDFButton
                        isGenerating={isExporting}
                        label="Export Full Report (PDF)"
                        onExport={async () => {
                            if (!selectedCountry || !results) return;
                            setIsExporting(true);
                            try {
                                const { generateStaffingPDF } = await import('@/modules/reporting/PdfGenerator');
                                const insights: ReportInsight[] = [
                                    { title: 'Staffing Overview', description: 'Detailed model representation.', category: 'Operational', severity: 'low', recommendation: '' }
                                ];
                                await generateStaffingPDF(
                                    selectedCountry,
                                    inputs.shiftModel as string,
                                    results.staffingResults,
                                    results.roster,
                                    insights,
                                    results.shiftComparisons
                                );
                            } catch (e: unknown) {
                                console.error('Staffing PDF export failed:', e);
                                alert(`PDF export failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
                            } finally {
                                setIsExporting(false);
                            }
                        }}
                    />
                </div>
            </div>

            {/* Input Config Panel */}
            <div className="p-4 bg-slate-100 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
                {/* Auto/Manual Toggle */}
                <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase tracking-wide flex items-center gap-1">
                        Headcount Composition <span className="normal-case font-normal text-slate-500">(screening composition · modeled base FTE — before shift relief)</span>
                        <Tooltip content="These role counts are the MODELED BASE: direct headcount per role BEFORE shift relief and shrinkage are applied. The shift engine then adds relief/shrinkage cover for 24×7 roles, so the Employed totals in the tables and the Org Chart are higher — that difference is by design, not a bug. This per-MW composition is the screening model; the Campus Operations Model card above is the accuracy basis." />
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => {
                                if (inputs.staffingAutoMode) {
                                    // Switching to manual: write auto values as baseline
                                    actions.setInputs({
                                        headcount_ShiftLead: autoResult.headcounts['shift-lead'],
                                        headcount_Engineer: autoResult.headcounts['engineer'],
                                        headcount_Technician: autoResult.headcounts['technician'],
                                        headcount_Admin: autoResult.headcounts['admin'],
                                        headcount_Janitor: autoResult.headcounts['janitor'],
                                    });
                                }
                                actions.toggleStaffingAutoMode();
                            }}
                            className={clsx(
                                "px-3 py-1 text-xs font-medium rounded-md border transition-all",
                                inputs.staffingAutoMode
                                    ? "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-400"
                                    : "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
                            )}
                        >
                            {inputs.staffingAutoMode ? 'AUTO' : 'MANUAL'}
                        </button>
                        <Tooltip content="Auto mode calculates optimal headcount based on IT load and shift model. Manual mode lets you override individual role counts." />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {results.roleConfigs.map((cfg) => {
                        const autoKey = cfg.role === 'admin' ? 'admin' : cfg.role as keyof typeof autoResult.headcounts;
                        return (
                            <div key={cfg.role} className="space-y-1">
                                <label className="text-xs text-slate-500 uppercase flex items-center gap-1">{cfg.label} (Direct HC) <Tooltip content={cfg.role === 'shift-lead' ? 'Team leaders managing shift operations and handovers' : cfg.role === 'engineer' ? 'Engineers handling critical infrastructure systems' : cfg.role === 'technician' ? 'Technicians for day-shift maintenance tasks' : cfg.role === 'admin' ? 'Supervisors overseeing daily operations' : 'Facility support staff (cleaning, logistics)'} /></label>
                                {inputs.staffingAutoMode ? (
                                    <div className="w-full text-sm bg-slate-200 dark:bg-slate-800 border border-cyan-300 dark:border-cyan-800 rounded p-1 text-slate-900 dark:text-white font-bold text-center cursor-not-allowed">
                                        {effectiveInputs[cfg.qtyKey]}
                                    </div>
                                ) : (
                                    <input type="number" min="1" max="50" className="w-full text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-1 text-slate-900 dark:text-white"
                                        value={inputs[cfg.qtyKey]}
                                        aria-label={cfg.label}
                                        onChange={(e) => actions.setInputs({ [cfg.qtyKey]: Math.max(1, Number(e.target.value)) })} />
                                )}
                                <div className="text-[10px] text-slate-500 dark:text-slate-600">
                                    {cfg.is24x7 ? '24/7 Shift' : 'Day Shift (M-F)'}
                                </div>
                                {inputs.staffingAutoMode && autoResult.rationale[autoKey] && (
                                    <div className="text-[9px] text-cyan-600 dark:text-cyan-500 leading-tight">
                                        {autoResult.rationale[autoKey]}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ═══ OVERVIEW TAB ═══ */}
            {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 rounded-lg bg-rz-data/10 text-rz-data">
                                    <Users className="w-5 h-5" />
                                </div>
                                <span className="text-xs text-slate-400 flex items-center gap-1">Total Headcount <Tooltip content="Total full-time equivalent employees across all roles and shifts" /></span>
                            </div>
                            <div className="mt-auto">
                                <TraceValue traceId="staff.fte">
                                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{results.totalHeadcount} <span className="text-sm font-normal text-slate-500">FTEs</span></div>
                                </TraceValue>
                                <div className="text-xs text-slate-500 mt-1">{results.totalOnShift} on-shift at any time</div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                                <span className="text-xs text-slate-400 flex items-center gap-1">Monthly Payroll <Tooltip content="Total monthly cost including base salary, shift allowances, overtime, and benefits" /></span>
                            </div>
                            <div className="mt-auto">
                                <TraceValue traceId="staff.monthlyCost">
                                    <div className="text-3xl font-bold text-slate-900 dark:text-white truncate" title={fmtMoney(results.totalMonthlyCost)}>
                                        {fmtMoney(results.totalMonthlyCost)}
                                    </div>
                                </TraceValue>
                                <div className="text-xs text-slate-500 mt-1">Year 1 Baseline ({inputs.shiftModel === '8h' ? 'Continental' : '4-on/3-off'})</div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <span className="text-xs text-slate-400 flex items-center gap-1">Avg Weekly Hours <Tooltip content="Average scheduled hours per person per week including handover overlap" /></span>
                            </div>
                            <div className="mt-auto">
                                <TraceValue traceId="staff.weeklyHours">
                                    <div className="text-3xl font-bold text-slate-900 dark:text-white">
                                        {inputs.shiftModel === '8h' ? '42' : '40'}h <span className="text-sm font-normal text-slate-500">eff./person</span>
                                    </div>
                                </TraceValue>
                                <div className="text-xs text-amber-500 mt-1">{inputs.shiftModel === '8h' ? '1.5h OT (handover)' : 'Zero OT (12h compressed)'}</div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <span className="text-xs text-slate-400 flex items-center gap-1">5-Year TCO <Tooltip content="Total Cost of Ownership over 5 years with labor escalation factored in" /></span>
                            </div>
                            <div className="mt-auto">
                                <TraceValue traceId="staff.tco5yr">
                                    <div className="text-3xl font-bold text-slate-900 dark:text-white truncate" title={fmtMoney(results.projections.reduce((a, b) => a + b.totalAnnualCost, 0))}>
                                        {fmtMoney(results.projections.reduce((a, b) => a + b.totalAnnualCost, 0))}
                                    </div>
                                </TraceValue>
                                <div className="text-xs text-slate-500 mt-1">{new Date().getFullYear()}–{new Date().getFullYear() + 5} Cumulative</div>
                            </div>
                        </div>
                    </div>

                    {/* Schedule Pattern Info */}
                    <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-5">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-cyan-400" />
                            Active Schedule Pattern
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                            <div>
                                <dt className="text-slate-600 dark:text-slate-500 text-xs uppercase flex items-center gap-1">Pattern <Tooltip content="The shift rotation pattern defining work/rest sequences. Determines coverage, fatigue risk, and overtime exposure." /></dt>
                                <dd className="text-slate-900 dark:text-white font-mono font-bold">{results.staffingResults[0]?.schedule.pattern}</dd>
                            </div>
                            <div>
                                <dt className="text-slate-600 dark:text-slate-500 text-xs uppercase flex items-center gap-1">Cycle Length <Tooltip content="Total days in one complete shift rotation cycle. 4-on/3-off = 7 days, Continental 3-shift = 8 days." /></dt>
                                <dd className="text-slate-900 dark:text-white font-mono font-bold">{inputs.shiftModel === '8h' ? '8 days' : '7 days'}</dd>
                            </div>
                            <div>
                                <dt className="text-slate-600 dark:text-slate-500 text-xs uppercase flex items-center gap-1">Work Days / Cycle <Tooltip content="Number of working days within one rotation cycle. Fewer work days per cycle generally improves work-life balance." /></dt>
                                <dd className="text-slate-900 dark:text-white font-mono font-bold">
                                    {inputs.shiftModel === '8h' ? '6 days' : '4 days'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-slate-600 dark:text-slate-500 text-xs uppercase flex items-center gap-1">Shift Duration <Tooltip content="Length of each individual shift. 8h shifts require 3 rotations per day; 12h shifts require 2 rotations per day." /></dt>
                                <dd className="text-slate-900 dark:text-white font-mono font-bold">
                                    {inputs.shiftModel === '8h' ? '8h' : '12h'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-slate-600 dark:text-slate-500 text-xs uppercase flex items-center gap-1">Teams Required <Tooltip content="Minimum number of independent teams needed to provide continuous 24/7 coverage under this shift pattern." /></dt>
                                <dd className="text-slate-900 dark:text-white font-mono font-bold">4</dd>
                            </div>
                        </div>

                        {/* Shift Visualization Bar */}
                        <div className="mt-6">
                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Shift Types</div>
                            {inputs.shiftModel === '8h' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 h-12 rounded-lg overflow-hidden">
                                    <div className="bg-amber-500/10 border-l-4 border-amber-500 flex items-center justify-center text-xs font-bold text-amber-600 dark:text-amber-500" title="Morning shift: 06:00-14:00. Highest staffing density for planned maintenance windows.">
                                        ☀️ Morning
                                        <span className="block text-[9px] font-normal ml-2 opacity-70">06:00 — 14:00</span>
                                    </div>
                                    <div className="bg-orange-500/10 border-l-4 border-orange-500 flex items-center justify-center text-xs font-bold text-orange-600 dark:text-orange-500" title="Afternoon shift: 14:00-22:00. Overlap with morning shift enables handover briefings.">
                                        ☁️ Afternoon
                                        <span className="block text-[9px] font-normal ml-2 opacity-70">14:00 — 22:00</span>
                                    </div>
                                    <div className="bg-indigo-500/10 border-l-4 border-indigo-500 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-500" title="Night shift: 22:00-06:00. Skeleton crew for monitoring; attracts night-shift allowance.">
                                        🌙 Night
                                        <span className="block text-[9px] font-normal ml-2 opacity-70">22:00 — 06:00</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-1 h-12 rounded-lg overflow-hidden">
                                    <div className="bg-cyan-500/10 border-l-4 border-cyan-500 flex items-center justify-center text-xs font-bold text-cyan-600 dark:text-cyan-500" title="Day shift: 06:00-18:00. 12-hour compressed shift covering all daytime operations and maintenance.">
                                        ☀️ Day
                                        <span className="block text-[9px] font-normal ml-2 opacity-70">06:00 — 18:00</span>
                                    </div>
                                    <div className="bg-indigo-500/10 border-l-4 border-indigo-500 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-500" title="Night shift: 18:00-06:00. 12-hour overnight monitoring; attracts night-shift allowance.">
                                        🌙 Night
                                        <span className="block text-[9px] font-normal ml-2 opacity-70">18:00 — 06:00</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Detailed Role Breakdown Table */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm dark:shadow-none">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Detailed Role Breakdown (Monthly)</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-900/50 text-slate-500 uppercase font-bold">
                                        <th className="px-4 py-3 text-left"><span className="flex items-center gap-1">Role <Tooltip content="Job function category (Engineers, Technicians, Security, Facilities, Management)." /></span></th>
                                        <th className="px-4 py-3 text-center"><span className="flex items-center justify-center gap-1">Employed <Tooltip content="Total headcount employed for this role across all shifts." /></span></th>
                                        <th className="px-4 py-3 text-center"><span className="flex items-center justify-center gap-1">On-Shift <Tooltip content="Number of staff on duty per shift after accounting for rotation and shrinkage." /></span></th>
                                        <th className="px-4 py-3 text-left"><span className="flex items-center gap-1">Schedule <Tooltip content="Shift rotation pattern assigned to this role." /></span></th>
                                        <th className="px-4 py-3 text-right"><span className="flex items-center justify-end gap-1">Base <Tooltip content="Base monthly salary before shift allowances and overtime." /></span></th>
                                        <th className="px-4 py-3 text-right"><span className="flex items-center justify-end gap-1">Shift Allow. <Tooltip content="Additional pay for night shifts, weekends, and holiday coverage. Varies by country labor law." /></span></th>
                                        <th className="px-4 py-3 text-right"><span className="flex items-center justify-end gap-1">OT <Tooltip content="Estimated monthly overtime cost based on average overtime hours and local overtime multiplier." /></span></th>
                                        <th className="px-4 py-3 text-right"><span className="flex items-center justify-end gap-1">Total <Tooltip content="Total monthly cost per employee: base salary + shift allowance + overtime." /></span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                                    {results.staffingResults.map((r, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-200">{ROLE_LABELS[r.role as StaffRole] || r.role}</td>
                                            <td className="px-4 py-3 text-center text-cyan-600 dark:text-cyan-400 font-bold">{r.headcount}</td>
                                            <td className="px-4 py-3 text-center text-slate-500">{r.onShiftCount}</td>
                                            <td className="px-4 py-3 text-slate-500">
                                                {r.is24x7 ? (inputs.shiftModel === '8h' ? 'Continental 3-Shift (8h)' : '4-Team 12h (4on/3off)') : 'Mon-Fri 08:00-17:00'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{fmtMoney(r.breakdown.baseSalaries)}</td>
                                            <td className="px-4 py-3 text-right text-cyan-600 dark:text-cyan-400">{fmtMoney(r.breakdown.shiftAllowance)}</td>
                                            <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-500">{r.breakdown.overtime > 0 ? fmtMoney(r.breakdown.overtime) : '–'}</td>
                                            <td className="px-4 py-3 text-right font-bold text-rz-data">{fmtMoney(r.monthlyCost)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-100 dark:bg-slate-800/80 font-bold text-slate-900 dark:text-white border-t border-slate-300 dark:border-slate-600">
                                        <td className="px-4 py-3">TOTAL</td>
                                        <td className="px-4 py-3 text-center text-cyan-700 dark:text-cyan-400">{results.totalHeadcount}</td>
                                        <td className="px-4 py-3 text-center">{results.totalOnShift}</td>
                                        <td className="px-4 py-3"></td>
                                        <td className="px-4 py-3 text-right">{fmtMoney(results.staffingResults.reduce((a, b) => a + b.breakdown.baseSalaries, 0))}</td>
                                        <td className="px-4 py-3 text-right">{fmtMoney(results.staffingResults.reduce((a, b) => a + b.breakdown.shiftAllowance, 0))}</td>
                                        <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-500">{fmtMoney(results.staffingResults.reduce((a, b) => a + b.breakdown.overtime, 0))}</td>
                                        <td className="px-4 py-3 text-right text-rz-data">{fmtMoney(results.totalMonthlyCost)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 5-Year Cost Projection */}
                    <div className="bg-slate-200 dark:bg-slate-800/50 rounded-xl border border-slate-300 dark:border-slate-700 p-6 shadow-sm dark:shadow-none">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">5-Year Cost Projection (USD)</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-slate-500 font-bold uppercase border-b border-slate-300 dark:border-slate-700">
                                        <th className="py-2 text-left"><span className="flex items-center gap-1">Year <Tooltip content="Calendar year of the projection period." /></span></th>
                                        <th className="py-2 text-left"><span className="flex items-center gap-1">Headcount <Tooltip content="Projected total full-time equivalents for each year." /></span></th>
                                        <th className="py-2 text-right"><span className="flex items-center justify-end gap-1">Annual Cost <Tooltip content="Total projected annual staffing cost including all allowances and overtime." /></span></th>
                                        <th className="py-2 text-right"><span className="flex items-center justify-end gap-1">Escalation <Tooltip content="Year-over-year percentage increase driven by labor cost escalation rates for the selected country." /></span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-300 dark:divide-slate-700/50">
                                    {results.projections.map((y: any, i: number) => (
                                        <tr key={y.year}>
                                            <td className="py-2 font-mono text-cyan-600 dark:text-cyan-400">{y.year}</td>
                                            <td className="py-2 text-slate-600 dark:text-slate-400">{y.totalHeadcount ?? y.headcount} FTEs</td>
                                            <td className="py-2 text-right font-bold text-slate-900 dark:text-white">{fmtMoney(y.totalAnnualCost)}</td>
                                            <td className="py-2 text-right text-slate-500">
                                                {i === 0 ? '-' : `+${((y.totalAnnualCost / results.projections[i - 1].totalAnnualCost - 1) * 100).toFixed(1)}%`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Efficiency Metrics */}
                    <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-6 mt-6">
                        <h3 className="text-md font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                            Efficiency Metrics
                        </h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {(() => {
                                const totalHC = results.staffingResults.reduce((a, r) => a + r.headcount, 0);
                                const totalCost = results.staffingResults.reduce((a, r) => a + r.monthlyCost, 0);
                                const totalOT = results.staffingResults.reduce((a, r) => a + r.breakdown.overtime, 0);
                                const shrinkage = selectedCountry.labor?.shrinkageFactor ?? 0.15;
                                return (
                                    <>
                                        <div className="bg-white dark:bg-black/30 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                            <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">Utilization Rate <Tooltip content="Net productive hours as a percentage of total scheduled hours, after accounting for shrinkage (breaks, training, admin)." /></div>
                                            <TraceValue traceId="staff.utilizationPct">
                                                <div className="text-xl font-bold text-rz-data">{((1 - shrinkage) * 100).toFixed(0)}%</div>
                                            </TraceValue>
                                            <div className="text-[10px] text-slate-500">Net productive hours</div>
                                        </div>
                                        <div className="bg-white dark:bg-black/30 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                            <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">Cost per MW <Tooltip content="Total monthly staffing cost divided by IT load in MW. Benchmark for comparing staffing efficiency across facilities." /></div>
                                            <TraceValue traceId="staff.costPerMw">
                                                <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">{fmtMoney(totalCost / staffMw)}</div>
                                            </TraceValue>
                                            <div className="text-[10px] text-slate-500">Staff cost / MW IT load</div>
                                        </div>
                                        <div className="bg-white dark:bg-black/30 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                            <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">OT Ratio <Tooltip content="Overtime cost as a percentage of total payroll. Values above 15% indicate potential scheduling issues." /></div>
                                            <TraceValue traceId="staff.otRatioPct">
                                                <div className={`text-xl font-bold ${totalCost > 0 && (totalOT / totalCost) > 0.15 ? 'text-amber-600 dark:text-amber-400' : 'text-rz-data'}`}>
                                                    {totalCost > 0 ? ((totalOT / totalCost) * 100).toFixed(1) : 0}%
                                                </div>
                                            </TraceValue>
                                            <div className="text-[10px] text-slate-500">Overtime as % of total</div>
                                        </div>
                                        <div className="bg-white dark:bg-black/30 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                            <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">Shrinkage Loss <Tooltip content="Monthly cost impact of non-productive time including breaks, training, sick leave, and admin duties." /></div>
                                            <TraceValue traceId="staff.shrinkageLoss">
                                                <div className="text-xl font-bold text-rose-600 dark:text-rose-400">{fmtMoney(totalCost * shrinkage)}</div>
                                            </TraceValue>
                                            <div className="text-[10px] text-slate-500">{(shrinkage * 100).toFixed(0)}% factor</div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Sensitivity Analysis */}
                    <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-6 mt-6">
                        <h3 className="text-md font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-rz-mint" />
                            Headcount Sensitivity Analysis
                            <Tooltip content="Impact analysis showing how percentage changes in headcount affect monthly staffing costs." />
                        </h3>
                        <div className="text-[10px] text-slate-500 mb-3">
                            Impact of headcount changes on monthly staffing costs
                        </div>
                        <div className="space-y-2">
                            {(() => {
                                const baseCost = results.staffingResults.reduce((a, r) => a + r.monthlyCost, 0);
                                const baseHC = results.staffingResults.reduce((a, r) => a + r.headcount, 0);
                                const variations = [-20, -10, 0, 10, 20];
                                return variations.map(pct => {
                                    const adjustedCost = baseCost * (1 + pct / 100);
                                    const adjustedHC = Math.round(baseHC * (1 + pct / 100));
                                    const isBase = pct === 0;
                                    return (
                                        <div key={pct}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isBase ? 'bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/50' : 'bg-white dark:bg-slate-800/30'}`}
                                        >
                                            <div className={`w-14 text-xs font-mono ${pct < 0 ? 'text-rz-data' : pct > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-cyan-600 dark:text-cyan-400'}`}>
                                                {pct > 0 ? '+' : ''}{pct}%
                                            </div>
                                            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${pct < 0 ? 'bg-rz-data' : pct > 0 ? 'bg-rose-500' : 'bg-cyan-500'}`}
                                                    style={{ width: `${(adjustedCost / (baseCost * 1.25)) * 100}%` }}
                                                />
                                            </div>
                                            <div className="w-20 text-xs font-mono text-right text-slate-900 dark:text-white">
                                                {fmtMoney(adjustedCost)}
                                            </div>
                                            <div className="w-16 text-[10px] text-slate-500 text-right">
                                                {adjustedHC} FTEs
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>
            )} {/* End Overview Tab */}

            {/* ═══ COMPARISON TAB ═══ */}
            {activeTab === 'comparison' && (
                <div className="space-y-6">
                    {/* Summary Card */}
                    <div className={clsx(
                        "p-6 rounded-xl border",
                        results.totalSavings > 0
                            ? "bg-rz-data/10 border-rz-data/40"
                            : "bg-amber-950/30 border-amber-700"
                    )}>
                        <div className="flex items-center gap-3 mb-3">
                            {results.totalSavings > 0
                                ? <CheckCircle className="w-6 h-6 text-rz-data" />
                                : <XCircle className="w-6 h-6 text-amber-400" />
                            }
                            <h3 className="text-lg font-bold text-white">
                                {results.totalSavings > 0
                                    ? `12h (4on/4off) saves ${fmtMoney(results.totalSavings)}/month vs 8h`
                                    : `8h (Continental) is ${fmtMoney(Math.abs(results.totalSavings))}/month cheaper`
                                }
                            </h3>
                        </div>
                        <p className="text-sm text-slate-300">
                            {results.totalSavings > 0
                                ? 'The 4on/4off compressed schedule eliminates overtime entirely, requires fewer teams, and provides better work-life balance with 4 consecutive days off. This is the industry-standard model for 24/7 data center operations.'
                                : 'The Continental 8h pattern distributes work across 4 teams with shorter daily exposure, which may be preferred for certain regulatory environments.'
                            }
                        </p>
                    </div>

                    {/* Side-by-Side Table */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800">
                            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-cyan-400" />
                                Shift Model Comparison (24/7 Staff Only)
                            </h3>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-slate-950/50 text-slate-400 uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-3 text-left"><span className="flex items-center gap-1">Metric <Tooltip content="Key performance indicator being compared across shift models." /></span></th>
                                    <th className="px-6 py-3 text-center"><span className="flex items-center justify-center gap-1">8h (Continental) <Tooltip content="Traditional 3-shift Continental pattern: Morning/Afternoon/Night with 4 teams rotating across 8-day cycles." /></span></th>
                                    <th className="px-6 py-3 text-center"><span className="flex items-center justify-center gap-1">12h (4on/4off) <Tooltip content="Compressed 12-hour schedule: 4 days on, 4 days off. Two shifts (Day/Night) with 2 teams each." /></span></th>
                                    <th className="px-6 py-3 text-center"><span className="flex items-center justify-center gap-1">Difference <Tooltip content="Delta between 8h and 12h models. Green indicates the 12h model is more favorable." /></span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {[
                                    { label: 'Teams Required', v8: results.shiftComparisons[0]?.comparison.model8h.schedule.teamsRequired || 4, v12: results.shiftComparisons[0]?.comparison.model12h.schedule.teamsRequired || 2, fmt: (v: number) => `${v} teams` },
                                    { label: 'Schedule Pattern', v8: '2-2-2-2', v12: '4on/4off', fmt: (v: any) => v },
                                    {
                                        label: 'Weekly Hours/Person',
                                        v8: results.shiftComparisons[0]?.comparison.model8h.metrics.weeklyHoursScheduled || 43.5,
                                        v12: results.shiftComparisons[0]?.comparison.model12h.metrics.weeklyHoursScheduled || 42,
                                        fmt: (v: number) => `${v}h`
                                    },
                                    {
                                        label: 'Overtime Hours/Person',
                                        v8: results.shiftComparisons[0]?.comparison.model8h.metrics.overtimeHoursPerPerson || 1.5,
                                        v12: results.shiftComparisons[0]?.comparison.model12h.metrics.overtimeHoursPerPerson || 0,
                                        fmt: (v: number) => v === 0 ? '✓ ZERO' : `${v}h`
                                    },
                                    { label: 'Total Monthly Cost (Shift Staff)', v8: results.total8hCost, v12: results.total12hCost, fmt: (v: number) => fmtMoney(v) },
                                ].map(row => (
                                    <tr key={row.label} className="hover:bg-slate-800/30">
                                        <td className="px-6 py-3 text-slate-300 font-medium">{row.label}</td>
                                        <td className="px-6 py-3 text-center font-mono text-slate-400">{typeof row.fmt === 'function' ? (row.fmt as any)(row.v8) : row.v8}</td>
                                        <td className="px-6 py-3 text-center font-mono text-cyan-400">{typeof row.fmt === 'function' ? (row.fmt as any)(row.v12) : row.v12}</td>
                                        <td className="px-6 py-3 text-center font-mono">
                                            {typeof row.v8 === 'number' && typeof row.v12 === 'number'
                                                ? <span className={row.v12 < row.v8 ? 'text-rz-data' : row.v12 > row.v8 ? 'text-red-400' : 'text-slate-500'}>
                                                    {row.v12 < row.v8 ? `↓ ${(row.fmt as any)(row.v8 - row.v12)}` : row.v12 > row.v8 ? `↑ ${(row.fmt as any)(row.v12 - row.v8)}` : '—'}
                                                </span>
                                                : <span className="text-slate-500">—</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Per-Role Breakdown */}
                    {results.shiftComparisons.map(comp => (
                        <div key={comp.label} className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl p-5">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{comp.label}</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="p-3 bg-white dark:bg-slate-950/50 rounded-lg">
                                    <div className="text-xs text-slate-600 dark:text-slate-500 uppercase mb-1 flex items-center gap-1">8h Continental <Tooltip content="Monthly staffing cost under the 8-hour continental rotation (3 shifts/day). Needs more people per position but each works standard weeks; overtime hours per person shown below. Compare against the 12h model — the cheaper option depends on local overtime multipliers and shift allowances." /></div>
                                    <div className="text-lg font-mono text-slate-900 dark:text-white">{fmtMoney(comp.comparison.model8h.monthlyCost)}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{comp.comparison.model8h.headcount} FTEs, {comp.comparison.model8h.metrics.overtimeHoursPerPerson}h OT/wk</div>
                                </div>
                                <div className="p-3 bg-cyan-50 dark:bg-cyan-950/20 rounded-lg border border-cyan-200 dark:border-cyan-900/30">
                                    <div className="text-xs text-slate-600 dark:text-slate-500 uppercase mb-1 flex items-center gap-1">12h 4on/4off <Tooltip content="Monthly staffing cost under the 12-hour 4-on/4-off rotation (2 shifts/day, 4 teams). Fewer heads and typically zero structural overtime, but longer shifts raise fatigue risk and some labor codes cap 12h scheduling. The recommendation line below states which model wins for this country's labor rules." /></div>
                                    <div className="text-lg font-mono text-cyan-600 dark:text-cyan-400">{fmtMoney(comp.comparison.model12h.monthlyCost)}</div>
                                    <div className="text-xs text-rz-data">{comp.comparison.model12h.headcount} FTEs, Zero OT</div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{comp.comparison.recommendation}</p>
                        </div>
                    ))}
                </div>
            )} {/* End Comparison Tab */}

            {activeTab === 'org' && (() => {
                /* G-staffing 18↔20 fix — explicit reconciliation: the composition
                 * inputs are pre-shrinkage base FTE; the org chart shows employed
                 * FTE after shift relief & shrinkage. Same staffingResults sums. */
                const modeledBase = results.roleConfigs.reduce((a, cfg) => a + (effectiveInputs[cfg.qtyKey] || 1), 0);
                const employedTotal = results.totalHeadcount;
                const reliefDelta = employedTotal - modeledBase;
                return (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-xs shadow-sm dark:shadow-none">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                Base → Employed Reconciliation
                                <Tooltip content="Why the org chart shows more people than the composition inputs: the composition is the modeled base (direct headcount per role, before shift relief), while employment must also cover rotation gaps, leave and shrinkage for 24×7 roles. The shift engine adds that relief cover, so Employed total = modeled base + relief/shrinkage heads. Both numbers come from the same staffing results — this is a reconciliation, not a discrepancy." />
                            </span>
                            <span className="text-slate-600 dark:text-slate-300">Modeled base <b className="tabular-nums text-slate-900 dark:text-white">{modeledBase} FTE</b></span>
                            <span className="text-slate-400">→</span>
                            <span className="text-slate-600 dark:text-slate-300">+ relief/shrinkage <b className={clsx('tabular-nums', reliefDelta >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-500')}>{reliefDelta >= 0 ? '+' : ''}{reliefDelta} FTE</b></span>
                            <span className="text-slate-400">→</span>
                            <span className="text-slate-600 dark:text-slate-300">Employed total <b className="tabular-nums text-rz-data">{employedTotal} FTE</b></span>
                            <span className="ml-auto text-[10px] text-slate-400">Org chart below shows <b>Employed FTE (incl. shift relief &amp; shrinkage)</b></span>
                        </div>
                        <OrgChart staffing={results.staffingResults} countryName={selectedCountry.name} />
                    </div>
                );
            })()} {/* End Org Tab */}

            {activeTab === 'roster' && (
                <RosterVisualizer roster={results.roster} year={new Date().getFullYear()} shiftModel={inputs.shiftModel as '8h' | '12h'} staffingResults={results.staffingResults} />
            )} {/* End Roster Tab */}

            {activeTab === 'waterfall' && (
                <div className="h-[600px]">
                    <CostWaterfall staffing={results.staffingResults} currency={'USD'} />
                </div>
            )} {/* End Waterfall Tab */}

            {activeTab === 'workorders' && (
                <WorkOrderView />
            )} {/* End Work Orders Tab */}
        </div>
    );
}
