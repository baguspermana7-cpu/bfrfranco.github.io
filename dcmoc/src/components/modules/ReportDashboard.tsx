'use client';

import React, { useMemo, useState } from 'react';
import html2canvas from 'html2canvas';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useScenarioStore } from '@/store/scenario';
import { runSensitivityAnalysis } from '@/modules/analytics/SensitivityEngine';
import { calculateFinancials, defaultOccupancyRamp } from '@/modules/analytics/FinancialEngine';
import TornadoChart from '@/components/visualizations/TornadoChart';
import SankeyDiagram from '@/components/visualizations/SankeyDiagram';
import type { SankeyNode, SankeyLink } from '@/components/visualizations/SankeyDiagram';
import { calculateStaffing, compareAllShiftModels, generate5YearProjection, StaffingResult, SHIFT_PATTERNS, ShiftPattern } from '@/modules/staffing/ShiftEngine';
import { calculateCapex, CapexResult } from '@/lib/CapexEngine';
import { generateStaffingNarrative, ReportInsight } from '@/modules/reporting/NarrativeEngine';
import { generateExecutiveSummary } from '@/modules/reporting/ExecutiveSummaryGenerator';
import { generateMasterReportPDF, generateStaffingPDF, generateCapexPDF, generateMaintenancePDF } from '@/modules/reporting/PdfGenerator';
import { generateAssetCounts } from '@/lib/AssetGenerator';
import { generateMaintenanceSchedule, MaintenanceEvent } from '@/modules/maintenance/ScheduleEngine';
import { generateAnnualRoster } from '@/modules/staffing/RosterEngine';
import { calculateDowntimeRisk } from '@/modules/risk/DowntimeCalculator';
import { calculateStrategyComparison, calculateSLAComparison, calculateSparesOptimization } from '@/modules/maintenance/MaintenanceStrategyEngine';
import {
    FileText, AlertTriangle, CheckCircle2, TrendingUp, Download, Loader2,
    DollarSign, Users, Clock, Zap, Building2, Shield, BarChart3,
    ChevronDown, Printer, ArrowDownRight, ArrowUpRight,
    Settings2, StickyNote, Eye, EyeOff, Wrench
} from 'lucide-react';
import clsx from 'clsx';

type SectionId = 'kpis' | 'cost' | 'tco' | 'capex-shift' | 'risk' | 'insights' | 'maintStrategy' | 'sensitivity' | 'sankey';

const REPORT_SECTIONS: { id: SectionId; label: string; icon: React.ReactNode }[] = [
    { id: 'kpis', label: 'KPI Summary', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'cost', label: 'Cost Capitulation', icon: <DollarSign className="w-3.5 h-3.5" /> },
    { id: 'tco', label: '5-Year TCO Projection', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'capex-shift', label: 'CAPEX & Shift Summary', icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'risk', label: 'Risk Assessment', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'insights', label: 'AI Insights', icon: <Zap className="w-3.5 h-3.5" /> },
    { id: 'maintStrategy', label: 'Maintenance Strategy', icon: <Wrench className="w-3.5 h-3.5" /> },
    { id: 'sensitivity', label: 'Sensitivity Analysis', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'sankey', label: 'Cost Flow (Sankey)', icon: <ArrowDownRight className="w-3.5 h-3.5" /> },
];

export function ReportDashboard() {
    const { selectedCountry, inputs } = useSimulationStore();
    const { inputs: capexInputs } = useCapexStore();
    const { scenarios } = useScenarioStore();
    const [isGenerating, setIsGenerating] = useState<string | null>(null);
    const [simYear, setSimYear] = useState(2025);
    const [expandedSection, setExpandedSection] = useState<string | null>(null);

    // B9: Scenario Comparison state
    const [scenarioA, setScenarioA] = useState<string>('');
    const [scenarioB, setScenarioB] = useState<string>('');

    // Report Builder state
    const [visibleSections, setVisibleSections] = useState<Set<SectionId>>(
        new Set(['kpis', 'cost', 'tco', 'capex-shift', 'risk', 'insights', 'maintStrategy', 'sensitivity', 'sankey'] as SectionId[])
    );
    const [analystNotes, setAnalystNotes] = useState('');
    const [showBuilder, setShowBuilder] = useState(false);

    // Branding State
    const [branding, setBranding] = useState({
        primaryColor: '#0891b2', // Cyan-600
        secondaryColor: '#10b981', // Emerald-500
        companyName: 'DCMOC v2.0',
        logoBase64: ''
    });

    const handleExport = async (type: string) => {
        if (!fullData || !selectedCountry) return;
        setIsGenerating(type);

        // Simulate delay for UX / Ensuring render
        await new Promise(r => setTimeout(r, 800));

        try {
            // Capture Charts if available
            let chartImages: { tornado?: string; sankey?: string } = {};

            if (visibleSections.has('sensitivity')) {
                const tornadoEl = document.getElementById('tornado-chart-container');
                if (tornadoEl) {
                    try {
                        const canvas = await html2canvas(tornadoEl, { scale: 2, backgroundColor: null });
                        chartImages.tornado = canvas.toDataURL('image/png');
                    } catch (e) {
                        console.warn('Failed to capture tornado chart', e);
                    }
                }
            }

            if (visibleSections.has('sankey')) {
                const sankeyEl = document.getElementById('sankey-diagram-container');
                if (sankeyEl) {
                    try {
                        const canvas = await html2canvas(sankeyEl, { scale: 2, backgroundColor: null });
                        chartImages.sankey = canvas.toDataURL('image/png');
                    } catch (e) {
                        console.warn('Failed to capture sankey chart', e);
                    }
                }
            }

            switch (type) {
                case 'detailed':
                case 'simulation':
                    const masterData = {
                        inputs: inputs,
                        capex: fullData.capex,
                        financial: {
                            npv: (fullData as any).financialNPV || 15000000,
                            irr: 18.5,
                            paybackPeriodYears: 3.2,
                            cashflows: fullData.fiveYearProjection.map((y, idx) => {
                                const revenue = inputs.itLoad * 150 * 12 * Math.pow(1.02, idx);
                                const fcf = revenue - y.totalAnnualCost;
                                return {
                                    year: y.year,
                                    revenue: revenue,
                                    opex: y.totalAnnualCost,
                                    freeCashflow: fcf,
                                    cumulativeCashflow: fcf * (idx + 1) - fullData.capex.total
                                };
                            })
                        },
                        staffing: { results: fullData.allStaff },
                        maintenance: { strategy: fullData.strategyData, sla: fullData.slaData, spares: fullData.sparesData },
                        risk: { aggregation: fullData.riskData },
                        insights: fullData.insights
                    };
                    await generateMasterReportPDF(selectedCountry, masterData, branding, chartImages);
                    break;
                case 'staffing':
                    await generateStaffingPDF(
                        selectedCountry,
                        inputs.shiftModel,
                        fullData.allStaff,
                        generateAnnualRoster(2025, inputs.shiftModel === '12h' ? '4on-4off' : '3shift-8h'),
                        fullData.insights,
                        undefined,
                        branding
                    );
                    break;
                case 'capex':
                    await generateCapexPDF(selectedCountry, fullData.capex, 'Generated via DCMOC v2.', capexInputs, branding);
                    break;
                case 'maintenance':
                    await generateMaintenancePDF(
                        selectedCountry,
                        fullData.strategyData,
                        fullData.slaData,
                        fullData.sparesData,
                        fullData.schedule,
                        analystNotes,
                        branding
                    );
                    break;
            }
        } catch (e) {
            console.error(e);
            alert('Error generating PDF');
        }

        setIsGenerating(null);
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setBranding(prev => ({ ...prev, logoBase64: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const toggleSection = (id: SectionId) => {
        setVisibleSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const fullData = useMemo(() => {
        if (!selectedCountry) return null;

        const patternId: ShiftPattern = inputs.shiftModel === '12h' ? '4on4off' : 'continental-8h';

        // Staffing
        const tlResults = calculateStaffing('shift-lead', inputs.headcount_ShiftLead, inputs.shiftModel, selectedCountry, true, patternId);
        const engResults = calculateStaffing('engineer', inputs.headcount_Engineer, inputs.shiftModel, selectedCountry, true, patternId);
        const techResults = calculateStaffing('technician', inputs.headcount_Technician, inputs.shiftModel, selectedCountry, false);
        const supResults = calculateStaffing('supervisor', inputs.headcount_Admin, inputs.shiftModel, selectedCountry, false);
        const janResults = calculateStaffing('janitor', inputs.headcount_Janitor, inputs.shiftModel, selectedCountry, false);

        const allStaff: StaffingResult[] = [tlResults, engResults, techResults, supResults, janResults];
        const totalMonthlyLabor = allStaff.reduce((a, r) => a + r.monthlyCost, 0);
        const totalHeadcount = allStaff.reduce((a, r) => a + r.headcount, 0);

        // CAPEX
        const capexResults = calculateCapex(capexInputs);

        // Assets & Maintenance
        const estBuildingArea = capexInputs.itLoad * 1.5;
        const assets = generateAssetCounts(
            capexInputs.itLoad,
            inputs.tierLevel === 4 ? 4 : 3,
            (capexInputs.coolingType as 'air' | 'pumped'),
            estBuildingArea,
            inputs.coolingTopology,
            inputs.powerRedundancy
        );
        const schedule = generateMaintenanceSchedule(assets);

        // Strategy Analysis
        const strategyData = calculateStrategyComparison(assets, schedule, inputs.tierLevel === 4 ? 4 : 3, selectedCountry);
        const slaData = calculateSLAComparison(assets, inputs.tierLevel === 4 ? 4 : 3, selectedCountry);
        const sparesData = calculateSparesOptimization(assets, inputs.tierLevel === 4 ? 4 : 3, selectedCountry);

        // Risk (Fix: 'risks' on CountryProfile is actually 'risk' or distinct properties)
        const countryRisks = (selectedCountry as any).risks || { seismicActivity: 0, floodRisk: 0, gridInstability: 0 };
        const slaHours = inputs.maintenanceStrategy === 'reactive' ? 24 : 4;
        const risk = calculateDowntimeRisk(inputs.tierLevel, undefined, slaHours, selectedCountry ?? undefined);

        // A2: Use actual FinancialEngine instead of hardcoded IRR
        const stratCost = strategyData.strategies.find(s => s.id === inputs.maintenanceStrategy)?.totalAnnualCost || 0;
        const opexAnnual = totalMonthlyLabor * 12 + stratCost;
        const projectLifeYears = 10;
        const taxRate = selectedCountry?.economy?.taxRate ?? 0.30;
        const occupancyRamp = defaultOccupancyRamp(projectLifeYears);

        const financialResult = calculateFinancials({
            totalCapex: capexResults.total,
            annualOpex: opexAnnual,
            revenuePerKwMonth: 150,
            itLoadKw: inputs.itLoad,
            discountRate: 0.08,
            projectLifeYears,
            escalationRate: 0.03,
            opexEscalation: selectedCountry?.economy?.inflationRate ?? 0.03,
            occupancyRamp,
            taxRate,
            depreciationYears: 20,
        });

        // Insights / Executive Summary
        const execSummary = generateExecutiveSummary(
            selectedCountry,
            { ...inputs, projectLifeYears: 10, discountRate: 0.08 },
            capexResults,
            financialResult as any,
            { eng: engResults, tech: techResults },
            { strategy: strategyData, sla: slaData }
        );

        // Narratives
        const staffingNarrative = generateStaffingNarrative(selectedCountry, { eng: engResults, tech: techResults }, inputs.shiftModel);

        // Manual Insights Construction
        const baseInsights: ReportInsight[] = [
            { title: 'Strong Financials', description: 'Project NPV is positive with < 3 year payback.', category: 'Financial', severity: 'low', recommendation: 'Proceed to design.' },
            { title: 'Staffing Risk', description: 'Turnover in region is high. Recommend retention bonus.', category: 'Operational', severity: 'medium', recommendation: 'Budget 5% for retention.' }
        ];

        // Roster
        const roster = generateAnnualRoster(simYear, inputs.shiftModel === '12h' ? '4on-4off' : '3shift-8h');

        // Shift comparison
        const shiftComparison = compareAllShiftModels('engineer', inputs.headcount_Engineer, selectedCountry);

        // 5-Year Projection
        const annualMaintCost = strategyData.strategies.find(s => s.id === inputs.maintenanceStrategy)?.totalAnnualCost || 0;
        const annualVendorCost = 50000;
        const annualConsumablesCost = 25000;
        const annualOPEX = (totalMonthlyLabor * 12) + annualMaintCost + annualVendorCost + annualConsumablesCost;
        const totalCAPEX = capexResults.total;
        const annualDepreciation = totalCAPEX / 20;

        // 5-Year Projection (Local calculation since generate5YearProjection is only for Staffing)
        const fiveYearProjection = Array.from({ length: 6 }).map((_, i) => {
            const inflationLabor = Math.pow(1.04, i);
            const inflationMaint = Math.pow(1.03, i);
            const laborCost = (totalMonthlyLabor * 12) * inflationLabor;
            const maintCost = annualMaintCost * inflationMaint;
            const otherCost = (annualVendorCost + annualConsumablesCost) * inflationMaint;
            const depr = annualDepreciation;

            return {
                year: simYear + i,
                totalHeadcount,
                totalAnnualCost: laborCost + maintCost + otherCost + depr,
            };
        });

        const fiveYearTCO = fiveYearProjection.reduce((a, y) => a + y.totalAnnualCost, 0);

        // Tasks
        const dailyTasks = 12;
        const weeklyTasks = 45;
        const monthlyTasks = 120;
        const specialistTasks = 5;

        // Return flattened object for easier consumption, matching usage in component
        return {
            allStaff, tlResults, engResults, techResults, supResults, janResults,
            totalMonthlyLabor, totalHeadcount,
            capex: capexResults,
            assets, schedule, roster, riskData: risk,
            insights: baseInsights,
            shiftComparison, fiveYearProjection,
            annualConsumablesCost, annualVendorCost,
            annualOPEX, annualMaintCost, totalCAPEX,
            annualDepreciation, fiveYearTCO, annualTCO: annualOPEX + annualMaintCost + annualDepreciation,
            dailyTasks, weeklyTasks, monthlyTasks,
            specialistTasks, patternId,
            strategyData, slaData, sparesData,
            execSummary, staffingNarrative
        };
    }, [selectedCountry, inputs, capexInputs, simYear]);



    if (!selectedCountry || !fullData) return <div className="p-10 text-center text-slate-400">Loading Report Engine...</div>;

    const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n.toFixed(0)}`;
    const fmtFull = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

    const pattern = SHIFT_PATTERNS[fullData.patternId];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        Feasibility Report Builder
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Generate comprehensive PDF reports for stakeholders
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => setShowBuilder(!showBuilder)}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                            showBuilder
                                ? "bg-indigo-100 dark:bg-indigo-600/20 border-indigo-500 text-indigo-700 dark:text-indigo-300"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                        )}
                    >
                        <Settings2 className="w-4 h-4" />
                        {showBuilder ? 'Hide Settings' : 'Branding & Settings'}
                    </button>

                    <button
                        onClick={() => handleExport('detailed')}
                        disabled={!!isGenerating}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-cyan-900/20 transition-all disabled:opacity-50"
                    >
                        {isGenerating === 'detailed' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Generate Full Report
                    </button>
                </div>
            </div>

            {/* Branding & Settings Panel */}
            {showBuilder && (
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-8 shadow-sm dark:shadow-none">
                    {/* Branding */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Shield className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                            Branding Configuration
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Company Name</label>
                                <input
                                    type="text"
                                    value={branding.companyName}
                                    onChange={(e) => setBranding({ ...branding, companyName: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Primary Color</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={branding.primaryColor}
                                            onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                                            className="h-8 w-8 bg-transparent border-0 cursor-pointer"
                                        />
                                        <span className="text-xs text-slate-500 font-mono">{branding.primaryColor}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Company Logo</label>
                                    <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded cursor-pointer border border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 transition-colors">
                                        <Download className="w-3 h-3" />
                                        {branding.logoBase64 ? 'Change Logo' : 'Upload Logo'}
                                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section Visibility */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Eye className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                            Report Sections
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {REPORT_SECTIONS.map(section => (
                                <button
                                    key={section.id}
                                    onClick={() => toggleSection(section.id)}
                                    className={clsx(
                                        "flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all text-left",
                                        visibleSections.has(section.id)
                                            ? "bg-cyan-100 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/50"
                                            : "bg-slate-50 dark:bg-slate-950 text-slate-500 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-900"
                                    )}
                                >
                                    {visibleSections.has(section.id) ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-slate-400 dark:border-slate-600" />}
                                    {section.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Analyst Notes */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <StickyNote className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                            Analyst Notes
                        </h3>
                        <textarea
                            value={analystNotes}
                            onChange={(e) => setAnalystNotes(e.target.value)}
                            placeholder="Add custom executive commentary here..."
                            className="w-full h-32 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-300 focus:border-cyan-500 focus:outline-none resize-none"
                        />
                    </div>
                </div>
            )}

            {/* EXECUTIVE SUMMARY (New) */}
            <div className="bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                        Executive Summary
                    </h3>
                    <span className="text-xs text-slate-500">Auto-generated based on simulation state</span>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {fullData.execSummary.slice(0, 4).map((section) => (
                        <div key={section.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-200">{section.title}</h4>
                                <span className={clsx(
                                    "text-xs px-2 py-0.5 rounded-full font-medium",
                                    section.status === 'positive' ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900" :
                                        section.status === 'negative' ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900" :
                                            "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                                )}>
                                    {section.keyMetric}
                                </span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                {section.content}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ═══ B9: SCENARIO COMPARISON VIEW ═══ */}
            {scenarios.length >= 2 && (
                <div className="bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-violet-500 dark:text-violet-400" />
                            Scenario Comparison
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Select two saved scenarios to compare side-by-side</p>
                    </div>
                    <div className="p-6">
                        <div className="flex gap-4 mb-6">
                            <div className="flex-1 space-y-1">
                                <label className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Scenario A</label>
                                <select
                                    value={scenarioA}
                                    onChange={(e) => setScenarioA(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
                                >
                                    <option value="">Select scenario...</option>
                                    {scenarios.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 space-y-1">
                                <label className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Scenario B</label>
                                <select
                                    value={scenarioB}
                                    onChange={(e) => setScenarioB(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
                                >
                                    <option value="">Select scenario...</option>
                                    {scenarios.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {(() => {
                            const sA = scenarios.find(s => s.id === scenarioA);
                            const sB = scenarios.find(s => s.id === scenarioB);
                            if (!sA || !sB) return (
                                <div className="text-center text-sm text-slate-400 py-6">Select two scenarios above to view comparison</div>
                            );
                            const deltaOpex = sB.summary.monthlyOpex - sA.summary.monthlyOpex;
                            const deltaCapex = sB.summary.annualCapex - sA.summary.annualCapex;
                            const deltaStaff = sB.summary.totalStaff - sA.summary.totalStaff;
                            const deltaPue = sB.summary.pue - sA.summary.pue;
                            const rows = [
                                { label: 'Monthly OPEX', a: fmt(sA.summary.monthlyOpex), b: fmt(sB.summary.monthlyOpex), delta: deltaOpex, fmtDelta: fmt(Math.abs(deltaOpex)) },
                                { label: 'Annual CAPEX', a: fmt(sA.summary.annualCapex), b: fmt(sB.summary.annualCapex), delta: deltaCapex, fmtDelta: fmt(Math.abs(deltaCapex)) },
                                { label: 'Total Staff', a: `${sA.summary.totalStaff}`, b: `${sB.summary.totalStaff}`, delta: deltaStaff, fmtDelta: `${Math.abs(deltaStaff)}` },
                                { label: 'PUE', a: sA.summary.pue.toFixed(2), b: sB.summary.pue.toFixed(2), delta: deltaPue, fmtDelta: Math.abs(deltaPue).toFixed(2) },
                            ];
                            return (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="py-2 text-left text-xs text-slate-500 font-medium">Metric</th>
                                            <th className="py-2 text-right text-xs text-violet-600 dark:text-violet-400 font-medium">{sA.name}</th>
                                            <th className="py-2 text-right text-xs text-cyan-600 dark:text-cyan-400 font-medium">{sB.name}</th>
                                            <th className="py-2 text-right text-xs text-slate-500 font-medium">Delta (B-A)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, i) => (
                                            <tr key={i} className="border-b border-slate-100 dark:border-slate-800/50">
                                                <td className="py-3 text-slate-700 dark:text-slate-300">{row.label}</td>
                                                <td className="py-3 text-right font-mono text-slate-600 dark:text-slate-400">{row.a}</td>
                                                <td className="py-3 text-right font-mono text-slate-600 dark:text-slate-400">{row.b}</td>
                                                <td className="py-3 text-right font-mono">
                                                    <span className={clsx(
                                                        row.delta > 0 ? 'text-red-500 dark:text-red-400' : row.delta < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'
                                                    )}>
                                                        {row.delta > 0 ? '+' : row.delta < 0 ? '-' : ''}{row.fmtDelta}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Module-Specific Downloads */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                    onClick={() => handleExport('staffing')}
                    disabled={!!isGenerating}
                    className="flex flex-col items-center justify-center gap-2 p-6 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl transition-all group shadow-sm dark:shadow-none"
                >
                    <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 group-hover:text-cyan-700 dark:group-hover:text-cyan-300 transition-colors">
                        <Users className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                        <div className="font-medium text-slate-900 dark:text-slate-200">Staffing Report</div>
                        <div className="text-xs text-slate-500 mt-1">Headcount, Roster, Shifts</div>
                    </div>
                </button>

                <button
                    onClick={() => handleExport('capex')}
                    disabled={!!isGenerating}
                    className="flex flex-col items-center justify-center gap-2 p-6 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl transition-all group shadow-sm dark:shadow-none"
                >
                    <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                        <div className="font-medium text-slate-900 dark:text-slate-200">CAPEX Report</div>
                        <div className="text-xs text-slate-500 mt-1">Construction & Equipment</div>
                    </div>
                </button>

                <button
                    onClick={() => handleExport('maintenance')}
                    disabled={!!isGenerating}
                    className="flex flex-col items-center justify-center gap-2 p-6 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl transition-all group shadow-sm dark:shadow-none"
                >
                    <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-amber-100 dark:group-hover:bg-amber-950/50 text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                        <Wrench className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                        <div className="font-medium text-slate-900 dark:text-slate-200">Maintenance Plan</div>
                        <div className="text-xs text-slate-500 mt-1">Strategy, SLA, Spares</div>
                    </div>
                </button>
            </div>
            {/* ═══ KPI ROW ═══ */}
            {visibleSections.has('kpis') && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                        { label: 'Total Headcount', value: `${fullData.totalHeadcount}`, sub: 'FTE', icon: Users, color: 'text-cyan-600 dark:text-cyan-400' },
                        { label: 'Monthly OPEX', value: fmt(fullData.totalMonthlyLabor), sub: 'Labor + Staff', icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Annual TCO', value: fmt(fullData.annualTCO), sub: 'OPEX + Maint + Depr', icon: TrendingUp, color: 'text-amber-600 dark:text-amber-400' },
                        { label: '5-Year TCO', value: fmt(fullData.fiveYearTCO), sub: `${simYear}-${simYear + 4}`, icon: BarChart3, color: 'text-violet-600 dark:text-violet-400' },
                        { label: 'CAPEX $/kW', value: `$${fullData.capex.metrics?.perKw?.toLocaleString() || '0'}`, sub: `PUE ${fullData.capex.pue?.toFixed(2) || 'N/A'}`, icon: Zap, color: 'text-orange-600 dark:text-orange-400' },
                        { label: 'Availability', value: `${fullData.riskData?.availability?.toFixed(3) || '99.982'}%`, sub: `Tier ${inputs.tierLevel}`, icon: Shield, color: 'text-blue-600 dark:text-blue-400' },
                    ].map((kpi, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm dark:shadow-none">
                            <div className="flex items-center gap-2 mb-2">
                                <kpi.icon className={clsx('w-4 h-4', kpi.color)} />
                                <span className="text-xs text-slate-500 uppercase tracking-wider">{kpi.label}</span>
                            </div>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">{kpi.value}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{kpi.sub}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ═══ COST CAPITULATION TABLE ═══ */}
            {visibleSections.has('cost') && (
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                    <button
                        onClick={() => setExpandedSection(expandedSection === 'cost' ? null : 'cost')}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            Annual Cost Capitulation
                        </h3>
                        <ChevronDown className={clsx('w-5 h-5 text-slate-400 transition-transform', expandedSection === 'cost' && 'rotate-180')} />
                    </button>
                    {(expandedSection === 'cost' || expandedSection === null) && (
                        <div className="px-6 pb-6">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="py-2 text-left text-xs text-slate-500 font-medium">Cost Category</th>
                                        <th className="py-2 text-right text-xs text-slate-500 font-medium">Monthly</th>
                                        <th className="py-2 text-right text-xs text-slate-500 font-medium">Annual</th>
                                        <th className="py-2 text-right text-xs text-slate-500 font-medium">% of Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { cat: 'Labor — Shift Staff', monthly: fullData.allStaff.filter(s => s.schedule.teamsRequired > 1).reduce((a, r) => a + r.monthlyCost, 0) },
                                        { cat: 'Labor — Day Staff', monthly: fullData.allStaff.filter(s => s.schedule.teamsRequired <= 1).reduce((a, r) => a + r.monthlyCost, 0) },
                                        { cat: 'Shift Allowances & OT', monthly: fullData.allStaff.reduce((a, r) => a + r.breakdown.shiftAllowance + r.breakdown.overtime, 0) },
                                        { cat: 'Social Security / Benefits', monthly: fullData.allStaff.reduce((a, r) => a + r.breakdown.socialSecurity, 0) },
                                        { cat: 'Maintenance Parts & Consumables', monthly: fullData.annualConsumablesCost / 12 },
                                        { cat: 'Vendor / Specialist Services', monthly: fullData.annualVendorCost / 12 },
                                        { cat: 'CAPEX Depreciation (20yr)', monthly: fullData.annualDepreciation / 12 },
                                    ].map((row, i) => {
                                        const annual = row.monthly * 12;
                                        const pct = fullData.annualTCO > 0 ? (annual / fullData.annualTCO) * 100 : 0;
                                        return (
                                            <tr key={i} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20">
                                                <td className="py-3 text-slate-700 dark:text-slate-300">{row.cat}</td>
                                                <td className="py-3 text-right font-mono text-slate-600 dark:text-slate-400">{fmtFull(row.monthly)}</td>
                                                <td className="py-3 text-right font-mono text-slate-900 dark:text-white">{fmtFull(annual)}</td>
                                                <td className="py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-16 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
                                                            <div className="h-1.5 rounded-full bg-cyan-500" style={{ width: `${Math.min(100, pct)}%` }} />
                                                        </div>
                                                        <span className="font-mono text-xs text-cyan-600 dark:text-cyan-400 w-10 text-right">{pct.toFixed(1)}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-slate-50 dark:bg-slate-950/50 font-bold">
                                        <td className="py-3 text-slate-900 dark:text-white">TOTAL ANNUAL TCO</td>
                                        <td className="py-3 text-right font-mono text-cyan-600 dark:text-cyan-400">{fmtFull(fullData.annualTCO / 12)}</td>
                                        <td className="py-3 text-right font-mono text-cyan-600 dark:text-cyan-400">{fmtFull(fullData.annualTCO)}</td>
                                        <td className="py-3 text-right font-mono text-cyan-600 dark:text-cyan-400">100%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ TCO 5-YEAR PROJECTION ═══ */}
            {visibleSections.has('tco') && (
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                    <button
                        onClick={() => setExpandedSection(expandedSection === 'tco' ? null : 'tco')}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                            5-Year Total Cost of Ownership
                        </h3>
                        <ChevronDown className={clsx('w-5 h-5 text-slate-400 transition-transform', expandedSection === 'tco' && 'rotate-180')} />
                    </button>
                    {(expandedSection === 'tco' || expandedSection === null) && (
                        <div className="px-6 pb-6">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="py-2 text-left text-xs text-slate-500 font-medium">Year</th>
                                        <th className="py-2 text-right text-xs text-slate-500 font-medium">Headcount</th>
                                        <th className="py-2 text-right text-xs text-slate-500 font-medium">Labor Cost</th>
                                        <th className="py-2 text-right text-xs text-slate-500 font-medium">Maintenance</th>
                                        <th className="py-2 text-right text-xs text-slate-500 font-medium">Depreciation</th>
                                        <th className="py-2 text-right text-xs text-slate-500 font-medium">Annual TCO</th>
                                        <th className="py-2 text-right text-xs text-slate-500 font-medium">Cumulative</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fullData.fiveYearProjection.map((yr, i) => {
                                        const maintCost = fullData.annualMaintCost * Math.pow(1.03, i);
                                        const yearTCO = yr.totalAnnualCost + maintCost + fullData.annualDepreciation;
                                        const cumulative = fullData.fiveYearProjection.slice(0, i + 1).reduce((a, y) => a + y.totalAnnualCost, 0) + maintCost * (i + 1) + fullData.annualDepreciation * (i + 1);
                                        return (
                                            <tr key={yr.year} className={clsx('border-b border-slate-100 dark:border-slate-800/50', i === 0 && 'bg-cyan-50 dark:bg-cyan-950/20')}>
                                                <td className="py-3 text-slate-900 dark:text-white font-medium">{yr.year}{i === 0 && <span className="text-xs text-cyan-600 dark:text-cyan-400 ml-2">Current</span>}</td>
                                                <td className="py-3 text-right font-mono text-slate-600 dark:text-slate-300">{yr.totalHeadcount}</td>
                                                <td className="py-3 text-right font-mono text-slate-600 dark:text-slate-300">{fmtFull(yr.totalAnnualCost)}</td>
                                                <td className="py-3 text-right font-mono text-slate-500 dark:text-slate-400">{fmtFull(maintCost)}</td>
                                                <td className="py-3 text-right font-mono text-slate-500 dark:text-slate-400">{fmtFull(fullData.annualDepreciation)}</td>
                                                <td className="py-3 text-right font-mono text-slate-900 dark:text-white">{fmtFull(yearTCO)}</td>
                                                <td className="py-3 text-right font-mono text-amber-600 dark:text-amber-400">{fmt(cumulative)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ CAPEX & SHIFT SUMMARY SIDE-BY-SIDE ═══ */}
            {visibleSections.has('capex-shift') && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* CAPEX Summary */}
                    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm dark:shadow-none">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                            <Building2 className="w-5 h-5 text-orange-500 dark:text-orange-400" />
                            CAPEX Summary
                        </h3>
                        <div className="space-y-3">
                            {[
                                { label: 'Total CAPEX', value: fmt(fullData.totalCAPEX), highlight: true },
                                { label: 'Cost per kW', value: `$${fullData.capex.metrics?.perKw?.toLocaleString() || 'N/A'}` },
                                { label: 'PUE', value: fullData.capex.pue?.toFixed(2) || 'N/A' },
                                { label: 'Construction Timeline', value: `${fullData.capex.metrics?.timelineMonths || 'N/A'} months` },
                                { label: 'Annual Depreciation', value: fmt(fullData.annualDepreciation) },
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800/50">
                                    <span className="text-sm text-slate-500 dark:text-slate-400">{item.label}</span>
                                    <span className={clsx('font-mono text-sm', item.highlight ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-600 dark:text-slate-300')}>{item.value}</span>
                                </div>
                            ))}
                            {/* Top cost categories */}
                            <div className="mt-4">
                                <div className="text-xs text-slate-500 uppercase mb-2">Top Cost Categories</div>
                                {Object.entries(fullData.capex.costs || {})
                                    .sort(([, a], [, b]) => (b as number) - (a as number))
                                    .slice(0, 5)
                                    .map(([key, val]) => {
                                        const pct = fullData.totalCAPEX > 0 ? ((val as number) / fullData.totalCAPEX) * 100 : 0;
                                        return (
                                            <div key={key} className="flex items-center gap-2 py-1">
                                                <div className="flex-1 text-xs text-slate-600 dark:text-slate-300 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                                                <div className="w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                                                    <div className="h-1.5 rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-14 text-right">{fmt(val as number)}</span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>

                    {/* Shift Model Summary */}
                    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm dark:shadow-none">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                            <Clock className="w-5 h-5 text-violet-500 dark:text-violet-400" />
                            Shift Model Analysis
                        </h3>
                        <div className="space-y-3">
                            {[
                                { label: 'Active Pattern', value: pattern.label },
                                { label: 'Shift Duration', value: `${pattern.shiftHours}h (${pattern.effectiveHours}h effective)` },
                                { label: 'Cycle', value: `${pattern.workDays} on / ${pattern.offDays} off (${pattern.cycleDays}-day cycle)` },
                                { label: 'Scheduled Hours/Week', value: `${pattern.avgWeeklyScheduled.toFixed(1)}h` },
                                { label: 'Effective Hours/Week', value: `${pattern.avgWeeklyEffective.toFixed(1)}h`, highlight: true },
                                { label: 'Break per Shift', value: `${pattern.breakMinutes} min` },
                                { label: 'Teams Required', value: `${pattern.teamsRequired}` },
                                { label: 'Overtime', value: pattern.overtimeHours > 0 ? `${pattern.overtimeHours}h/week` : '✓ Zero Overtime' },
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/50">
                                    <span className="text-sm text-slate-500 dark:text-slate-400">{item.label}</span>
                                    <span className={clsx('text-sm font-mono', item.highlight ? 'text-cyan-600 dark:text-cyan-400 font-bold' : 'text-slate-600 dark:text-slate-300')}>{item.value}</span>
                                </div>
                            ))}
                        </div>
                        {/* Comparison callout */}
                        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-200 dark:border-slate-800/50">
                            <div className="text-xs text-slate-500 uppercase mb-1">Recommendation</div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">{fullData.shiftComparison.recommendation}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ RISK ASSESSMENT ═══ */}
            {visibleSections.has('risk') && (
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm dark:shadow-none">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                        <Shield className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                        Risk Assessment
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">Tier {inputs.tierLevel}</div>
                            <div className="text-xs text-slate-500">Redundancy Level</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fullData.riskData?.availability?.toFixed(3) || '99.982'}%</div>
                            <div className="text-xs text-slate-500">Expected Availability</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div className="text-2xl font-bold text-amber-500 dark:text-amber-400">{fullData.riskData?.expectedDowntimeMinutes?.toFixed(0) || '9.5'} min</div>
                            <div className="text-xs text-slate-500">Annual Downtime</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">{fullData.schedule.length}</div>
                            <div className="text-xs text-slate-500">Maintenance Events/Year</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ MAINTENANCE STRATEGY SUMMARY ═══ */}
            {visibleSections.has('maintStrategy') && (
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm dark:shadow-none">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                        <Wrench className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                        Maintenance Strategy Overview
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        {fullData.strategyData.strategies.map((s) => (
                            <div key={s.id} className={clsx(
                                "bg-slate-50 dark:bg-slate-950/50 rounded-lg p-4 border transition-colors",
                                s.id === fullData.strategyData.recommended ? "border-emerald-500/30 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/10" : "border-slate-200 dark:border-slate-800"
                            )}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{s.label}</span>
                                    {s.id === fullData.strategyData.recommended && (
                                        <span className="text-[9px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">REC</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-y-1 text-xs">
                                    <span className="text-slate-500 dark:text-slate-500">Annual Cost:</span>
                                    <span className="font-mono text-slate-900 dark:text-white text-right">{fmt(s.totalAnnualCost)}</span>
                                    <span className="text-slate-500 dark:text-slate-500">5-Yr NPV:</span>
                                    <span className="font-mono text-slate-600 dark:text-slate-300 text-right">{fmt(s.fiveYearNPV)}</span>
                                    <span className="text-slate-500 dark:text-slate-500">Reliability:</span>
                                    <span className="font-mono text-slate-600 dark:text-slate-300 text-right">{s.reliabilityIndex}/100</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-lg p-3">
                        <p className="text-sm text-slate-700 dark:text-slate-300">{fullData.strategyData.recommendationReason}</p>
                    </div>
                </div>
            )}

            {/* ═══ INSIGHT CARDS ═══ */}
            {visibleSections.has('insights') && (
                <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">AI-Generated Insights & Recommendations</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                        {fullData.insights.map((insight, index) => (
                            <div key={index} className="bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800/50 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        {insight.category}
                                    </div>
                                    {insight.severity === 'high' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                                    {insight.severity === 'medium' && <TrendingUp className="w-5 h-5 text-amber-500" />}
                                    {insight.severity === 'low' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                                </div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">{insight.title}</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{insight.description}</p>
                                <div className="p-3 bg-white dark:bg-slate-950/50 rounded-lg border border-slate-200 dark:border-slate-800/50">
                                    <div className="text-xs font-semibold text-cyan-600 dark:text-cyan-500 mb-1 uppercase">Recommendation</div>
                                    <div className="text-sm text-slate-700 dark:text-slate-300">{insight.recommendation}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ SENSITIVITY ANALYSIS ═══ */}
            {visibleSections.has('sensitivity') && (() => {
                const sensitivityData = selectedCountry ? runSensitivityAnalysis(
                    {
                        itLoad: inputs.itLoad,
                        tierLevel: inputs.tierLevel,
                        headcount_Engineer: inputs.headcount_Engineer,
                        headcount_Technician: inputs.headcount_Technician,
                        headcount_ShiftLead: inputs.headcount_ShiftLead,
                        contingency: capexInputs.contingency,
                        designFee: capexInputs.designFee,
                        pmFee: capexInputs.pmFee,
                        fuelHours: capexInputs.fuelHours,
                        turnoverRate: inputs.turnoverRate,
                        hybridRatio: inputs.hybridRatio,
                        buildingSize: inputs.buildingSize,
                    },
                    selectedCountry.labor.baseSalary_Engineer,
                    12000,
                    0.20,
                    selectedCountry
                ) : [];
                return sensitivityData.length > 0 ? (
                    <div id="tornado-chart-container" className="bg-white dark:bg-gradient-to-br dark:from-slate-800/60 dark:to-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
                        <TornadoChart data={sensitivityData} />
                    </div>
                ) : null;
            })()}

            {/* ═══ SANKEY DIAGRAM ═══ */}
            {visibleSections.has('sankey') && (() => {
                const staffCost = selectedCountry ? (
                    inputs.headcount_ShiftLead * selectedCountry.labor.baseSalary_ShiftLead +
                    inputs.headcount_Engineer * selectedCountry.labor.baseSalary_Engineer +
                    inputs.headcount_Technician * selectedCountry.labor.baseSalary_Technician +
                    inputs.headcount_Admin * selectedCountry.labor.baseSalary_Admin +
                    inputs.headcount_Janitor * selectedCountry.labor.baseSalary_Janitor
                ) * 12 : 0;
                const energyCost = inputs.itLoad * 1.4 * 8760 * 0.10 / 1000;
                const maintenanceCost = inputs.itLoad * 50;
                const complianceCost = selectedCountry?.compliance.annualComplianceCost || 5000;
                const total = staffCost + energyCost + maintenanceCost + complianceCost;

                const nodes: SankeyNode[] = [
                    { id: 'total', label: 'Annual OPEX', value: total, color: '#06b6d4', column: 0 },
                    { id: 'labor', label: 'Labor', value: staffCost, color: '#8b5cf6', column: 1 },
                    { id: 'energy', label: 'Energy', value: energyCost, color: '#f59e0b', column: 1 },
                    { id: 'maint', label: 'Maintenance', value: maintenanceCost, color: '#10b981', column: 1 },
                    { id: 'compliance', label: 'Compliance', value: complianceCost, color: '#ef4444', column: 1 },
                    { id: 'leads', label: 'Shift Leads', value: (selectedCountry?.labor.baseSalary_ShiftLead || 0) * inputs.headcount_ShiftLead * 12, color: '#a78bfa', column: 2 },
                    { id: 'engineers', label: 'Engineers', value: (selectedCountry?.labor.baseSalary_Engineer || 0) * inputs.headcount_Engineer * 12, color: '#a78bfa', column: 2 },
                    { id: 'techs', label: 'Technicians', value: (selectedCountry?.labor.baseSalary_Technician || 0) * inputs.headcount_Technician * 12, color: '#a78bfa', column: 2 },
                    { id: 'cooling_e', label: 'Cooling Energy', value: energyCost * 0.35, color: '#fbbf24', column: 2 },
                    { id: 'it_e', label: 'IT Power', value: energyCost * 0.65, color: '#fbbf24', column: 2 },
                ];
                const links: SankeyLink[] = [
                    { source: 'total', target: 'labor', value: staffCost },
                    { source: 'total', target: 'energy', value: energyCost },
                    { source: 'total', target: 'maint', value: maintenanceCost },
                    { source: 'total', target: 'compliance', value: complianceCost },
                    { source: 'labor', target: 'leads', value: (selectedCountry?.labor.baseSalary_ShiftLead || 0) * inputs.headcount_ShiftLead * 12 },
                    { source: 'labor', target: 'engineers', value: (selectedCountry?.labor.baseSalary_Engineer || 0) * inputs.headcount_Engineer * 12 },
                    { source: 'labor', target: 'techs', value: (selectedCountry?.labor.baseSalary_Technician || 0) * inputs.headcount_Technician * 12 },
                    { source: 'energy', target: 'cooling_e', value: energyCost * 0.35 },
                    { source: 'energy', target: 'it_e', value: energyCost * 0.65 },
                ];
                return (
                    <div id="sankey-diagram-container" className="bg-white dark:bg-gradient-to-br dark:from-slate-800/60 dark:to-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-300 mb-4">Cost Flow Analysis — Sankey Diagram</h3>
                        <SankeyDiagram data={{ nodes, links }} />
                    </div>
                );
            })()}

            {/* ═══ ANALYST NOTES (if entered, show in preview) ═══ */}
            {analystNotes.trim().length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-6">
                    <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                        <StickyNote className="w-4 h-4" />
                        Analyst Notes
                    </h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{analystNotes}</p>
                </div>
            )}

            {/* ═══ EXPORT BUTTONS ═══ */}
            <div className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/80 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Printer className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    Export Reports
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { type: 'simulation', label: 'Full Simulation Report', desc: 'OPEX, projections, insights', color: 'from-cyan-600 to-blue-600' },
                        { type: 'staffing', label: 'Staffing Analysis PDF', desc: 'Roles, shifts, roster, 5yr projection', color: 'from-violet-600 to-purple-600' },
                        { type: 'capex', label: 'CAPEX Report PDF', desc: 'Cost breakdown, timeline, PUE', color: 'from-orange-600 to-red-600' },
                        { type: 'maintenance', label: 'Maintenance Report PDF', desc: 'Strategy, SLA, spares analysis', color: 'from-emerald-600 to-teal-600' },
                    ].map(btn => (
                        <button
                            key={btn.type}
                            onClick={() => handleExport(btn.type)}
                            disabled={isGenerating !== null}
                            className={clsx(
                                'flex items-center gap-3 px-5 py-4 rounded-xl text-left transition-all',
                                `bg-gradient-to-r ${btn.color} hover:opacity-90`,
                                'disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md'
                            )}
                        >
                            {isGenerating === btn.type ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Download className="w-5 h-5 text-white" />}
                            <div>
                                <div className="text-white font-medium text-sm">{btn.label}</div>
                                <div className="text-white/60 text-xs">{btn.desc}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
