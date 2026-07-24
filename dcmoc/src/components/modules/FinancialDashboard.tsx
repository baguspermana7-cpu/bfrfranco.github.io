'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useRequirementsStore } from '@/store/requirements';
import { MAINT_PER_KW_YR } from '@/lib/screening';
import { rzData } from '@/lib/rz-engine';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useEffectiveInputs } from '@/store/useEffectiveInputs';
import { DEFAULT_REVENUE_PER_KW_MONTH } from '@/constants/finance';
import { calculateFinancials, defaultOccupancyRamp, FinancialResult } from '@/modules/analytics/FinancialEngine';
import { calculateRevenue, defaultRevenueOccupancy, RevenueResult } from '@/modules/analytics/RevenueEngine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import { Explain } from '@/components/ui/Explain';
import { TrendingUp, DollarSign, Clock, Percent, BarChart3, ArrowUpRight, ArrowDownRight, Calculator, Receipt, Repeat, HandCoins, FileText } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine,
    ComposedChart, Bar, Line, Legend, LineChart, BarChart, Cell
} from 'recharts';
import { generateFinancialPDF } from '@/modules/reporting/PdfGenerator';
import { ExportPDFButton } from '@/components/ui/ExportPDFButton';
import html2canvas from 'html2canvas';
import { fmt, fmtMoney, fmtPct } from '@/lib/format';
import { explainThresholdMetric, ThresholdLeverSpec, ThresholdMetricExplain } from '@/lib/decision-explain';

/* ─── Diagnostics Tier-1: NPV / ROI thresholds ───────────────────────────────
 * SINGLE SOURCE for (a) KPI red/green coloring, (b) the click-to-explain
 * panel gating, and (c) collectFinancialDiagnostics — never duplicate the
 * literal 0 at a call site. Fail predicates mirror the original coloring
 * exactly: NPV green when `npv >= 0`, ROI green when `roiPercent > 0`. */
const NPV_THRESHOLD = 0;      // NPV ≥ 0 → value-creating at the chosen discount rate
const ROI_THRESHOLD_PCT = 0;  // ROI > 0% → lifetime net income exceeds CAPEX
const FINANCE_TAB = 'finance'; // shell tab hosting this page (revenue lever lives in the sidebar here)
const CAPEX_TAB = 'capex';     // shell tab where the CAPEX lever is fine-tuned

const npvFails = (npv: number): boolean => !(npv >= NPV_THRESHOLD);
const roiFails = (roiPercent: number): boolean => !(roiPercent > ROI_THRESHOLD_PCT);

/* Lever search bounds (mirrors decision-explain conventions): beyond these the
 * honest answer is "structure, not tuning". */
const DIAG_REV_MULT_MAX = 2.5;   // up to +150% revenue
const DIAG_CAPEX_MULT_MIN = 0.4; // up to −60% CAPEX

/* ─── Diagnostics Center collector (pure — no hooks, no DOM) ──────────────── */
export interface Finding {
    surface: string;
    severity: 'high' | 'medium';
    metric: string;
    value: number;
    threshold: number;
    linkTab: string;
}

/**
 * Return the ACTIVE Tier-1 findings for this page (NPV < 0, ROI ≤ 0) from an
 * already-computed FinancialResult. Pure + deterministic so a future
 * Diagnostics Center can call it headlessly with the same model the page uses.
 */
export function collectFinancialDiagnostics(model: Pick<FinancialResult, 'npv' | 'roiPercent'>): Finding[] {
    const findings: Finding[] = [];
    if (npvFails(model.npv)) {
        findings.push({
            surface: 'Finance · Pro-Forma & Revenue',
            severity: 'high', // value destruction at the chosen discount rate
            metric: 'NPV',
            value: model.npv,
            threshold: NPV_THRESHOLD,
            linkTab: FINANCE_TAB,
        });
    }
    if (roiFails(model.roiPercent)) {
        findings.push({
            surface: 'Finance · Pro-Forma & Revenue',
            severity: 'medium', // undiscounted corroborating signal — NPV is the primary lens
            metric: 'ROI',
            value: model.roiPercent,
            threshold: ROI_THRESHOLD_PCT,
            linkTab: FINANCE_TAB,
        });
    }
    return findings;
}

// ─── Editable Cell Component ─────────────────────────────────
// Shows calculated value but allows user override. Yellow border = edited
const EditableCell = ({ value, onChange, className = '' }: {
    value: number;
    onChange: (v: number) => void;
    className?: string;
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [edited, setEdited] = useState(false);
    const [localValue, setLocalValue] = useState('');

    const startEdit = () => {
        setIsEditing(true);
        setLocalValue(Math.round(value).toString());
    };

    const commitEdit = () => {
        setIsEditing(false);
        const parsed = Number(localValue);
        if (!isNaN(parsed) && parsed !== Math.round(value)) {
            onChange(parsed);
            setEdited(true);
        }
    };

    if (isEditing) {
        return (
            <input
                type="number"
                className="w-20 p-0.5 text-xs text-right text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-cyan-400 dark:border-cyan-500 rounded outline-none"
                value={localValue}
                onChange={e => setLocalValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => e.key === 'Enter' && commitEdit()}
                autoFocus
            />
        );
    }

    return (
        <span
            className={`cursor-pointer hover:underline hover:decoration-dotted ${edited ? 'ring-1 ring-amber-500/50 rounded px-1' : ''} ${className}`}
            onClick={startEdit}
            title="Click to override"
        >
            {fmtMoney(value)}
        </span>
    );
};

const FinancialDashboard = () => {
    const { selectedCountry, inputs, actions: simActions } = useSimulationStore();
    const effectiveInputs = useEffectiveInputs();
    const capexStore = useCapexStore();
    const capexResults = capexStore.results;
    const [isExporting, setIsExporting] = useState(false);

    /* #333 dedup — Lease Term DERIVED reaktif dari Contract Duration
     * (Requirements 1.1, satu sumber). Bukan input lagi di halaman ini. */
    const reqOverview = useRequirementsStore((s) => s.overview);
    const contractYearsDerived = typeof reqOverview.contractDurationYr === 'number'
        ? reqOverview.contractDurationYr
        : (reqOverview.contractDurationCustom ?? 10);

    // ─── Combined Financial + Revenue Inputs ────────────
    const [finInputs, setFinInputs] = useState({
        /* seeded from the sim-store tunable (live SSOT) — same opening basis
         * as Executive/Phased/MC/Report; user-editable after */
        revenuePerKwMonth: inputs.revenuePerKwMonth ?? DEFAULT_REVENUE_PER_KW_MONTH,
        discountRate: 0.10,
        projectLifeYears: 10,
        escalationRate: 0.03,
        opexEscalation: 0.035,
        taxRate: 0.25,
        depreciationYears: 15,
    });

    const [revInputs, setRevInputs] = useState({
        nrcPerKw: 250,
        nrcCustomFitout: 50000,
        nrcCrossConnect: 15000,
        mrcPerKwMonth: 150,
        mrcEscalation: 3,
        mrcCrossConnectMonthly: 5000,
        contractYears: 10,
        takeOrPayPct: 70,
    });

    // Track whether user has manually edited (don't overwrite manual edits)
    const userEditedFin = useRef(false);
    const userEditedRev = useRef(false);

    // Reset manual edit flags when country changes (re-enable auto-calc)
    useEffect(() => {
        userEditedFin.current = false;
        userEditedRev.current = false;
    }, [selectedCountry?.id]);

    // Auto-derive financial parameters from country/tier/capex when they change
    useEffect(() => {
        if (!selectedCountry || userEditedFin.current) return;
        const eco = selectedCountry.economy;
        const tier = inputs.tierLevel ?? 3;

        // Revenue per kW: tier 4 premium, tier 2 economy, adjusted by electricity cost
        const tierRevMult = tier === 4 ? 1.4 : tier === 3 ? 1.0 : 0.75;
        const baseRevPerKw = 120 + (eco.electricityRate * 500); // Higher electricity → higher colocation price
        const autoRevPerKw = Math.round(baseRevPerKw * tierRevMult);

        // Discount rate: risk-free proxy + country risk premium
        const riskPremium = eco.inflationRate > 0.05 ? 0.04 : eco.inflationRate > 0.03 ? 0.02 : 0.01;
        const autoDiscount = Math.round((0.06 + riskPremium + eco.inflationRate) * 100) / 100; // 6% base + risk + inflation

        setFinInputs({
            revenuePerKwMonth: autoRevPerKw,
            discountRate: Math.min(0.18, autoDiscount),
            projectLifeYears: 10,
            escalationRate: Math.round(eco.inflationRate * 1000) / 1000,
            opexEscalation: Math.round(eco.laborEscalation * 1000) / 1000,
            taxRate: Math.round(eco.taxRate * 1000) / 1000,
            depreciationYears: 15,
        });
    }, [selectedCountry?.id, inputs.tierLevel]);

    useEffect(() => {
        if (!selectedCountry || userEditedRev.current) return;
        const eco = selectedCountry.economy;
        const tier = inputs.tierLevel ?? 3;
        const itLoad = inputs.itLoad ?? 1000;

        // NRC per kW: derive from capex if available, otherwise estimate from tier
        const capexPerKw = capexResults ? Math.round(capexResults.total / Math.max(1, itLoad)) : 0;
        const autoNrcPerKw = capexPerKw > 0 ? Math.round(capexPerKw * 0.02) : (tier === 4 ? 350 : tier === 3 ? 250 : 150);

        // MRC per kW: mirrors revenue logic
        const tierMrcMult = tier === 4 ? 1.4 : tier === 3 ? 1.0 : 0.75;
        const baseMrc = 120 + (eco.electricityRate * 500);
        const autoMrcPerKw = Math.round(baseMrc * tierMrcMult);

        setRevInputs({
            nrcPerKw: Math.max(100, autoNrcPerKw),
            nrcCustomFitout: Math.round(50000 * (tier === 4 ? 1.5 : tier === 3 ? 1.0 : 0.7)),
            nrcCrossConnect: 15000,
            mrcPerKwMonth: autoMrcPerKw,
            mrcEscalation: Math.round(eco.inflationRate * 100),
            mrcCrossConnectMonthly: 5000,
            /* #333 dedup — lease term ikut Contract Duration di Requirements 1.1 (satu sumber) */
            contractYears: contractYearsDerived,
            takeOrPayPct: 70,
        });
    }, [selectedCountry?.id, inputs.tierLevel, inputs.itLoad, capexResults?.total, contractYearsDerived]);

    /* #333 dedup — Contract Duration berubah di Requirements → lease term ikut
     * LANGSUNG (bukan input; sinkron reaktif, override manual tidak berlaku). */
    useEffect(() => {
        setRevInputs(prev => prev.contractYears === contractYearsDerived ? prev : { ...prev, contractYears: contractYearsDerived });
    }, [contractYearsDerived]);

    /* #333 dedup — Tax Rate SELALU ikut negara project (chip "country" harus
     * jujur, termasuk setelah user override parameter lain → country berganti). */
    useEffect(() => {
        if (!selectedCountry) return;
        const t = Math.round(selectedCountry.economy.taxRate * 1000) / 1000;
        setFinInputs(prev => prev.taxRate === t ? prev : { ...prev, taxRate: t });
    }, [selectedCountry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Year-level overrides for the combined table
    const [yearOverrides, setYearOverrides] = useState<Record<number, Record<string, number>>>({});

    const handleChange = (key: string, value: number) => {
        userEditedFin.current = true;
        setFinInputs(prev => ({ ...prev, [key]: value }));
    };

    const handleRevChange = (key: string, value: number) => {
        userEditedRev.current = true;
        setRevInputs(prev => ({ ...prev, [key]: value }));
    };

    const setYearOverride = useCallback((year: number, field: string, value: number) => {
        setYearOverrides(prev => ({
            ...prev,
            [year]: { ...(prev[year] || {}), [field]: value },
        }));
    }, []);

    // Annual OPEX from sim inputs (uses effective inputs for auto-calculated headcounts)
    const annualOpex = useMemo(() => {
        if (!selectedCountry) return 0;
        const labor = selectedCountry.labor;
        const staffCost = (
            effectiveInputs.headcount_ShiftLead * labor.baseSalary_ShiftLead +
            effectiveInputs.headcount_Engineer * labor.baseSalary_Engineer +
            effectiveInputs.headcount_Technician * labor.baseSalary_Technician +
            effectiveInputs.headcount_Admin * labor.baseSalary_Admin +
            effectiveInputs.headcount_Janitor * labor.baseSalary_Janitor
        ) * 12;
        /* unit fix: itLoad [kW] × PUE × 8760 [h] × electricityRate [$/kWh] = $ —
         * the old “/ 1000” treated the $/kWh rate as $/MWh and understated
         * energy 1000× (2.5 MW showed “$3K/yr” energy). */
        const energyCost = effectiveInputs.itLoad * ((rzData().pueMatrix as Record<string, Record<string, number>> | undefined)?.[inputs.coolingType]?.['tier' + inputs.tierLevel] ?? 1.4) * 8760 * (selectedCountry?.economy.electricityRate ?? 0.10);
        const maintenanceCost = effectiveInputs.itLoad * MAINT_PER_KW_YR;
        return staffCost + energyCost + maintenanceCost;
    }, [selectedCountry, effectiveInputs]);

    // Financial projection
    const result: FinancialResult | null = useMemo(() => {
        if (!capexResults) return null;
        const occupancyRamp = defaultOccupancyRamp(finInputs.projectLifeYears);
        return calculateFinancials({
            totalCapex: capexResults.total,
            annualOpex,
            revenuePerKwMonth: finInputs.revenuePerKwMonth,
            itLoadKw: inputs.itLoad,
            discountRate: finInputs.discountRate,
            projectLifeYears: finInputs.projectLifeYears,
            escalationRate: finInputs.escalationRate,
            opexEscalation: finInputs.opexEscalation,
            occupancyRamp,
            taxRate: finInputs.taxRate,
            depreciationYears: finInputs.depreciationYears,
        });
    }, [capexResults, annualOpex, inputs.itLoad, finInputs]);

    /* ─── Diagnostics Tier-1: NPV / ROI explain (owner mandate: no naked red numbers)
     * Recompute closure re-runs the SAME chain the KPIs use (capexResults.total →
     * annualOpex → calculateFinancials with identical finInputs + occupancy ramp),
     * only scaling revenue / CAPEX. explainThresholdMetric bisects on it — this
     * component never re-implements or fabricates cashflow math. */
    const [openDiag, setOpenDiag] = useState<'npv' | 'roi' | null>(null);
    const diag = useMemo((): { npv: ThresholdMetricExplain | null; roi: ThresholdMetricExplain | null } | null => {
        if (!capexResults) return null;
        const occupancyRamp = defaultOccupancyRamp(finInputs.projectLifeYears);
        const recompute = (mods: { revMult?: number; capexMult?: number }): FinancialResult =>
            calculateFinancials({
                totalCapex: capexResults.total * (mods.capexMult ?? 1),
                annualOpex,
                revenuePerKwMonth: finInputs.revenuePerKwMonth * (mods.revMult ?? 1),
                itLoadKw: inputs.itLoad,
                discountRate: finInputs.discountRate,
                projectLifeYears: finInputs.projectLifeYears,
                escalationRate: finInputs.escalationRate,
                opexEscalation: finInputs.opexEscalation,
                occupancyRamp,
                taxRate: finInputs.taxRate,
                depreciationYears: finInputs.depreciationYears,
            });
        const base = recompute({});
        const revBase = finInputs.revenuePerKwMonth;
        const capexBase = capexResults.total;

        /* Same two levers for both metrics — only the metric read + formatter differ. */
        const leversFor = (
            metricName: string,
            metricOf: (r: FinancialResult) => number,
            fmtA: (v: number) => string,
            passLabel: string,
        ): ThresholdLeverSpec[] => [
            {
                lo: 1,
                hi: DIAG_REV_MULT_MAX,
                metricAt: (m) => metricOf(recompute({ revMult: m })),
                render: (m, achieved) => ({
                    label: `Revenue +${((m - 1) * 100).toFixed(0)}%`,
                    detail: `Revenue must rise +${((m - 1) * 100).toFixed(1)}% — from ${fmtMoney(revBase)} to ${fmtMoney(revBase * m)}/kW/mo — for ${metricName} to reach ${fmtA(achieved)} ${passLabel}. Edit "Revenue per kW/month" in this page's sidebar.`,
                }),
                unreachable: (atHi) => ({
                    label: 'Revenue alone is not enough',
                    detail: `Even revenue +${((DIAG_REV_MULT_MAX - 1) * 100).toFixed(0)}% (to ${fmtMoney(revBase * DIAG_REV_MULT_MAX)}/kW/mo) only brings ${metricName} to ${fmtA(atHi)} — the cost structure (CAPEX + OPEX) is binding, not just the rate.`,
                }),
                targetTab: FINANCE_TAB, // parameter lives in this page's sidebar — no tab hop
            },
            {
                lo: 0,
                hi: 1 - DIAG_CAPEX_MULT_MIN,
                metricAt: (cut) => metricOf(recompute({ capexMult: 1 - cut })),
                render: (cut, achieved) => ({
                    label: `CAPEX −${(cut * 100).toFixed(0)}%`,
                    detail: `OR CAPEX falls −${(cut * 100).toFixed(1)}% — from ${fmtMoney(capexBase)} to ${fmtMoney(capexBase * (1 - cut))} — for ${metricName} to reach ${fmtA(achieved)} ${passLabel}.`,
                }),
                unreachable: (atHi) => ({
                    label: 'CAPEX alone is not enough',
                    detail: `Even CAPEX −${((1 - DIAG_CAPEX_MULT_MIN) * 100).toFixed(0)}% (to ${fmtMoney(capexBase * DIAG_CAPEX_MULT_MIN)}) only brings ${metricName} to ${fmtA(atHi)} — the revenue/OPEX side is binding.`,
                }),
                targetTab: CAPEX_TAB,
            },
        ];

        const npvExplain = npvFails(base.npv)
            ? explainThresholdMetric({
                metricLabel: 'NPV',
                value: base.npv,
                threshold: NPV_THRESHOLD,
                direction: 'atLeast',
                fmtValue: fmtMoney,
                because: `PV of cashflow ${fmtMoney(base.npv + capexBase)} < CAPEX ${fmtMoney(capexBase)} at discount rate ${(finInputs.discountRate * 100).toFixed(0)}%`,
                levers: leversFor('NPV', (r) => r.npv, fmtMoney, `≥ ${fmtMoney(NPV_THRESHOLD)}`),
            })
            : null;

        const roiExplain = roiFails(base.roiPercent)
            ? explainThresholdMetric({
                metricLabel: 'ROI',
                value: base.roiPercent,
                threshold: ROI_THRESHOLD_PCT,
                direction: 'atLeast',
                fmtValue: fmtPct,
                because: `total net income ${fmtMoney(base.totalProfit)} < CAPEX ${fmtMoney(capexBase)} over ${finInputs.projectLifeYears} yr`,
                levers: leversFor('ROI', (r) => r.roiPercent, fmtPct, `> ${fmtPct(ROI_THRESHOLD_PCT, 0)}`),
            })
            : null;

        return { npv: npvExplain, roi: roiExplain };
    }, [capexResults, annualOpex, inputs.itLoad, finInputs]);

    // Revenue model
    const revResult: RevenueResult | null = useMemo(() => {
        const effectiveItLoad = capexStore.inputs.itLoad || inputs.itLoad || 1000;
        const years = revInputs.contractYears;
        return calculateRevenue({
            itLoadKw: effectiveItLoad,
            nrcPerKw: revInputs.nrcPerKw,
            nrcCustomFitout: revInputs.nrcCustomFitout,
            nrcCrossConnect: revInputs.nrcCrossConnect,
            mrcPerKwMonth: revInputs.mrcPerKwMonth,
            mrcEscalation: revInputs.mrcEscalation / 100,
            mrcCrossConnectMonthly: revInputs.mrcCrossConnectMonthly,
            contractYears: years,
            takeOrPayPct: revInputs.takeOrPayPct / 100,
            occupancyRamp: defaultRevenueOccupancy(years),
        });
    }, [revInputs, inputs.itLoad, capexStore.inputs.itLoad]);

    // B11: Occupancy impact data
    const occupancyImpactData = useMemo(() => {
        if (!capexResults) return [];
        return Array.from({ length: 8 }, (_, i) => {
            const occ = 0.30 + i * 0.10;
            const annualRevenue = finInputs.revenuePerKwMonth * 12 * inputs.itLoad * occ;
            const annualNetCashflow = annualRevenue - annualOpex;
            const totalCapex = capexResults.total;
            let npvCalc = -totalCapex;
            for (let y = 1; y <= finInputs.projectLifeYears; y++) {
                const escalatedRev = annualRevenue * Math.pow(1 + finInputs.escalationRate, y - 1);
                const escalatedOpex = annualOpex * Math.pow(1 + finInputs.opexEscalation, y - 1);
                const netCf = escalatedRev - escalatedOpex;
                npvCalc += netCf / Math.pow(1 + finInputs.discountRate, y);
            }
            const irrApprox = totalCapex > 0 ? ((annualNetCashflow / totalCapex) * 100) : 0;
            return {
                occupancy: `${(occ * 100).toFixed(0)}%`,
                occupancyPct: occ * 100,
                npv: npvCalc,
                irr: irrApprox,
            };
        });
    }, [capexResults, finInputs, annualOpex, inputs.itLoad]);

    // B16: Budget vs Forecast data
    const budgetVsForecastData = useMemo(() => {
        if (!selectedCountry) return [];
        const labor = selectedCountry.labor;
        const laborBudget = (
            inputs.headcount_ShiftLead * labor.baseSalary_ShiftLead +
            inputs.headcount_Engineer * labor.baseSalary_Engineer +
            inputs.headcount_Technician * labor.baseSalary_Technician +
            inputs.headcount_Admin * labor.baseSalary_Admin +
            inputs.headcount_Janitor * labor.baseSalary_Janitor
        ) * 12;
        const maintenanceBudget = inputs.itLoad * MAINT_PER_KW_YR;
        /* unit fix: kW × PUE × h × $/kWh = $ (no /1000 — see annualOpex) */
        const energyBudget = inputs.itLoad * ((rzData().pueMatrix as Record<string, Record<string, number>> | undefined)?.[inputs.coolingType]?.['tier' + inputs.tierLevel] ?? 1.4) * 8760 * (selectedCountry?.economy.electricityRate ?? 0.10);
        const vendorBudget = 50000;
        const esc = 1 + (finInputs.opexEscalation || 0.035);
        return [
            { category: 'Labor', budget: laborBudget, forecast: laborBudget * esc },
            { category: 'Maintenance', budget: maintenanceBudget, forecast: maintenanceBudget * (esc * 1.05) },
            { category: 'Energy', budget: energyBudget, forecast: energyBudget * (esc * 0.98) },
            { category: 'Vendor', budget: vendorBudget, forecast: vendorBudget * esc },
        ];
    }, [selectedCountry, inputs, finInputs.opexEscalation]);

    if (!result || !capexResults || !selectedCountry) {
        return <div className="p-8 text-center text-slate-500">Configure CAPEX Engine first to view financial analysis.</div>;
    }

    // Chart data
    const chartData = result.cashflows.map(cf => ({
        year: `Y${cf.year}`,
        revenue: cf.revenue,
        opex: -cf.opex,
        cumCashflow: cf.cumulativeCashflow,
        cumDiscounted: cf.cumulativeDiscountedCashflow,
    }));

    // Shared input style
    const inpCls = "w-full p-1.5 text-sm text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded outline-none focus:ring-1 focus:ring-cyan-500";

    return (
        <div className="flex gap-6">
            {/* ═════════════════════════════════════════════════
                LEFT SIDEBAR — Combined Financial + Revenue Inputs
               ═════════════════════════════════════════════════ */}
            <div className="w-[340px] flex-shrink-0 space-y-4 overflow-y-auto max-h-[calc(100vh-6rem)] pb-6">
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                            Financial &amp; Revenue Parameters
                        </CardTitle>
                        <ExportPDFButton
                            isGenerating={isExporting}
                            onExport={async () => {
                                if (!selectedCountry || !revResult) return;
                                setIsExporting(true);

                                // Simulate tiny delay to ensure chart rendering
                                await new Promise(r => setTimeout(r, 400));

                                let chartImages: { cashflow?: string; waterfall?: string; mrc?: string } = {};

                                try {
                                    const opts = { scale: 2, backgroundColor: '#ffffff', useCORS: true, allowTaint: true };

                                    const cashflowEl = document.getElementById('financial-cashflow-chart');
                                    if (cashflowEl) {
                                        const canvas = await html2canvas(cashflowEl, opts);
                                        chartImages.cashflow = canvas.toDataURL('image/png');
                                    }
                                    const waterfallEl = document.getElementById('financial-waterfall-chart');
                                    if (waterfallEl) {
                                        const canvas = await html2canvas(waterfallEl, opts);
                                        chartImages.waterfall = canvas.toDataURL('image/png');
                                    }
                                    const mrcEl = document.getElementById('financial-mrc-chart');
                                    if (mrcEl) {
                                        const canvas = await html2canvas(mrcEl, opts);
                                        chartImages.mrc = canvas.toDataURL('image/png');
                                    }
                                } catch (e) {
                                    console.warn('Failed to capture charts', e);
                                }

                                try {
                                    await generateFinancialPDF(
                                        selectedCountry,
                                        result,
                                        revResult,
                                        finInputs,
                                        revInputs,
                                        capexResults.total,
                                        annualOpex,
                                        inputs.itLoad,
                                        chartImages
                                    );
                                } catch (error) {
                                    console.error('Error generating Financial PDF:', error);
                                } finally {
                                    setIsExporting(false);
                                }
                            }}
                            className="px-2 py-1 text-[10px]"
                            label="PDF"
                        />
                    </CardHeader>
                    <CardContent className="space-y-4">

                        {/* ── Financial Section ───────────── */}
                        <div className="text-[10px] uppercase text-indigo-600 dark:text-indigo-400 font-semibold tracking-wider border-b border-indigo-200 dark:border-indigo-800/40 pb-1">
                            Financial Analysis
                        <p className="mt-1 rounded bg-rz-info/10 px-2 py-1 text-[9px] text-rz-info">All parameters in this panel are PREDEFINED from data (country · tier · CAPEX · requirements) — you may override them; manual edits are preserved. The remaining inputs are this page's analysis controls (not duplicates of requirements); canonical values (Tax Rate, Lease Term) are shown derived + with an Edit link in Requirements.</p></div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">Revenue per kW/month ($) <Tooltip content="Monthly colocation rate charged per kW of IT power. Industry range: $100-250/kW/month depending on market and tier. This page's analysis control — the real revenue figure is set HERE (single edit surface); the illustrative default is derived from country + tier." /></label>
                            <input type="number" className={inpCls}
                                value={finInputs.revenuePerKwMonth}
                                onChange={e => handleChange('revenuePerKwMonth', Number(e.target.value))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">Discount Rate (%) <Tooltip content="Weighted Average Cost of Capital (WACC). Used to discount future cashflows to present value. Typical DC range: 8-12%. This page's analysis control (not a duplicate of requirements)." /></label>
                                <input type="number" className={inpCls}
                                    value={(finInputs.discountRate * 100).toFixed(0)}
                                    onChange={e => handleChange('discountRate', Number(e.target.value) / 100)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">Project Life (yrs) <Tooltip content="Economic useful life of the facility for financial modeling. Typically 10-25 years for data centers. This page's analysis control." /></label>
                                <input type="number" className={inpCls}
                                    value={finInputs.projectLifeYears}
                                    onChange={e => handleChange('projectLifeYears', Number(e.target.value))}
                                    min={5} max={25} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">Rev. Escalation (%) <Tooltip content="Annual revenue price escalation applied year-over-year. Default derived from country inflation — this page's analysis control, may be overridden." /></label>
                                <input type="number" className={inpCls}
                                    value={(finInputs.escalationRate * 100).toFixed(0)}
                                    onChange={e => handleChange('escalationRate', Number(e.target.value) / 100)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">OPEX Escalation (%) <Tooltip content="Annual OPEX cost escalation applied year-over-year. Default derived from country labor escalation — this page's analysis control, may be overridden." /></label>
                                <input type="number" className={inpCls}
                                    value={(finInputs.opexEscalation * 100).toFixed(1)}
                                    onChange={e => handleChange('opexEscalation', Number(e.target.value) / 100)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">Tax Rate (%) <Tooltip content="DERIVED from the project's country profile (economy.taxRate) — single source, edit via Country selection in Requirements. (#333 dedup: duplicate input removed)" /></label>
                                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5">
                                    <div className="text-sm font-bold tabular-nums text-emerald-500">
                                        {(finInputs.taxRate * 100).toFixed(1)}%
                                        <span className="ml-1.5 rounded bg-emerald-500/15 px-1 py-0.5 text-[8px] font-semibold uppercase text-emerald-500">country</span>
                                    </div>
                                    <button onClick={() => simActions.setActiveTab('requirements')}
                                        className="text-[9px] text-rz-mint hover:underline">Edit in Requirements ↗</button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">Depreciation (yrs) <Tooltip content="Straight-line depreciation period for CAPEX assets. Affects taxable income. Building: 20-25 yrs, MEP: 15-20 yrs. This page's analysis control." /></label>
                                <input type="number" className={inpCls}
                                    value={finInputs.depreciationYears}
                                    onChange={e => handleChange('depreciationYears', Number(e.target.value))}
                                    min={5} max={25} />
                            </div>
                        </div>

                        {/* ── Divider ─────────────────────── */}
                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-cyan-200 dark:border-cyan-800/30" /></div>
                        </div>

                        {/* ── Revenue / NRC Section ────────── */}
                        <div className="text-[10px] uppercase text-cyan-600 dark:text-cyan-400 font-semibold tracking-wider border-b border-cyan-200 dark:border-cyan-800/40 pb-1">
                            NRC (Non-Recurring Charges)
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-600 dark:text-slate-500 flex items-center gap-1">Setup Fee ($/kW) <Tooltip content="Non-Recurring Charge per kW of contracted IT power. Covers initial provisioning, rack setup, and commissioning. Typically 2-5% of CAPEX per kW." /></label>
                                <input type="number" className={inpCls}
                                    value={revInputs.nrcPerKw} onChange={e => handleRevChange('nrcPerKw', Number(e.target.value))} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-600 dark:text-slate-500 flex items-center gap-1">X-Connect Setup ($) <Tooltip content="One-time cross-connect installation fee. Covers physical cabling between customer cage and meet-me room or carrier demarcation point." /></label>
                                <input type="number" className={inpCls}
                                    value={revInputs.nrcCrossConnect} onChange={e => handleRevChange('nrcCrossConnect', Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-600 dark:text-slate-500 flex items-center gap-1">Custom Fit-out ($) <Tooltip content="Non-recurring charge for bespoke cage or suite buildout. Includes custom power distribution, containment, security cages, and tenant-specific infrastructure." /></label>
                            <input type="number" className={inpCls}
                                value={revInputs.nrcCustomFitout} onChange={e => handleRevChange('nrcCustomFitout', Number(e.target.value))} />
                        </div>

                        {/* ── MRC Section ──────────────────── */}
                        <div className="text-[10px] uppercase text-emerald-600 dark:text-emerald-400 font-semibold tracking-wider border-b border-emerald-200 dark:border-emerald-800/40 pb-1">
                            MRC (Monthly Recurring)
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-600 dark:text-slate-500 flex items-center gap-1">MRC $/kW/mo <Tooltip content="Monthly Recurring Charge per kW of IT power. The core colocation fee covering power delivery, cooling, and facility access. Typically the largest revenue component." /></label>
                                <input type="number" className={inpCls}
                                    value={revInputs.mrcPerKwMonth} onChange={e => handleRevChange('mrcPerKwMonth', Number(e.target.value))} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-600 dark:text-slate-500 flex items-center gap-1">Escalation (%/yr) <Tooltip content="Annual MRC price escalation rate written into the contract. Typically tied to CPI or a fixed percentage (2-5%/yr) to offset rising energy and labor costs." /></label>
                                <input type="number" className={inpCls}
                                    value={revInputs.mrcEscalation} onChange={e => handleRevChange('mrcEscalation', Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-600 dark:text-slate-500 flex items-center gap-1">X-Connect MRC ($/mo) <Tooltip content="Monthly recurring fee for cross-connect port maintenance. Covers fiber/copper patching, monitoring, and meet-me room access. Charged per active cross-connect." /></label>
                            <input type="number" className={inpCls}
                                value={revInputs.mrcCrossConnectMonthly} onChange={e => handleRevChange('mrcCrossConnectMonthly', Number(e.target.value))} />
                        </div>

                        {/* ── Contract Terms ───────────────── */}
                        <div className="text-[10px] uppercase text-amber-600 dark:text-amber-400 font-semibold tracking-wider border-b border-amber-200 dark:border-amber-800/40 pb-1">
                            Contract Terms
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-600 dark:text-slate-500 flex items-center gap-1">Lease Term (yrs) <Tooltip content="DERIVED from Contract Duration in Requirements 1.1 — single source. (#333 dedup: duplicate input removed; edit in Requirements)" /></label>
                                <div className="rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5">
                                    <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                                        {contractYearsDerived}
                                        <span className="ml-1.5 rounded bg-emerald-500/15 px-1 py-0.5 text-[8px] font-semibold uppercase text-emerald-500">requirements</span>
                                    </div>
                                    <button onClick={() => simActions.setActiveTab('requirements')}
                                        className="text-[9px] text-rz-mint hover:underline">Edit in Requirements ↗</button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-600 dark:text-slate-500 flex items-center gap-1">Take-or-Pay (%) <Tooltip content="Minimum committed power/space usage regardless of actual consumption. Protects the provider's revenue baseline. Typically 70-100% of contracted capacity." /></label>
                                <input type="number" className={inpCls}
                                    value={revInputs.takeOrPayPct} onChange={e => handleRevChange('takeOrPayPct', Number(e.target.value))} min={0} max={100} />
                            </div>
                        </div>
                        <div className="p-2 bg-cyan-50 dark:bg-cyan-950/30 rounded border border-cyan-200 dark:border-cyan-900/40">
                            <div className="text-[9px] text-cyan-700 dark:text-cyan-400 uppercase mb-1 flex items-center gap-1">Take-or-Pay Summary <Tooltip content="Computed minimum billing floor: take-or-pay % × contracted IT load = the kW billed every month regardless of the customer's actual draw. This is the revenue baseline that de-risks the P&L — lenders and underwriters price against it, so a low take-or-pay % directly weakens bankability." /></div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-400">
                                Min {revInputs.takeOrPayPct}% of {capexStore.inputs.itLoad || inputs.itLoad || 1000}kW = <span className="text-slate-900 dark:text-white font-medium">{Math.round((revInputs.takeOrPayPct / 100) * (capexStore.inputs.itLoad || inputs.itLoad || 1000))} kW</span> billed regardless of usage
                            </div>
                        </div>

                        {/* ── Quick Summary ────────────────── */}
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">CAPEX Investment <Tooltip content="Total capital investment from the CAPEX engine (P50 base estimate) — the initial outlay all return metrics (NPV, IRR, payback) are measured against. Re-run CAPEX with different inputs to move it; it is not editable here." /></span>
                                <span className="text-slate-900 dark:text-white font-medium">{fmtMoney(capexResults.total)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">Annual OPEX (est.) <Tooltip content="Estimated annual operating cost (energy, maintenance, staffing, insurance) from the OPEX model, escalated yearly by the OPEX escalation rate. Energy is typically 50-70% of it, so utility rate and PUE dominate the cashflow projection." /></span>
                                <span className="text-slate-900 dark:text-white font-medium">{fmtMoney(annualOpex)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">Annual Revenue (100%) <Tooltip content="Gross annual revenue at full occupancy = revenue per kW/month × 12 × contracted IT load. Actual revenue follows the occupancy ramp in the projection table — this figure is the ceiling, not the expectation for early years." /></span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmtMoney(finInputs.revenuePerKwMonth * 12 * inputs.itLoad)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">Break-even Occupancy <Tooltip content="Occupancy level at which revenue exactly covers annual OPEX (operating break-even, excluding capital recovery). Below this, every month burns cash operationally. Healthy projects break even at 40-60% occupancy — a high figure means thin margin per kW or heavy fixed costs." /></span>
                                <span className="text-amber-600 dark:text-amber-400 font-medium">{result.breakEvenOccupancy}%</span>
                            </div>
                            {revResult && (
                                <>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">Total NRC <Tooltip content="Sum of all one-time Non-Recurring Charges (setup fee × contracted kW, cross-connect installs, custom fit-out). Collected at signing/deployment — improves early cashflow but does not recur." /></span>
                                        <span className="text-cyan-600 dark:text-cyan-400 font-medium">{fmtMoney(revResult.totalNRC)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">TCV ({revInputs.contractYears}yr) <Tooltip content="Total Contract Value = all NRC plus escalated MRC over the full lease term. The headline deal-sizing figure — sensitive to the lease term (set in Requirements) and the MRC escalation rate." /></span>
                                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">{fmtMoney(revResult.contractValue)}</span>
                                    </div>
                                </>
                            )}
                        </div>

                    </CardContent>
                </Card>
            </div>

            {/* ═════════════════════════════════════════════════
                RIGHT — Results, Charts, Combined Table
               ═════════════════════════════════════════════════ */}
            <div className="flex-1 space-y-4 overflow-y-auto pb-10">

                {/* ── Financial KPIs ────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className={`border shadow-sm dark:shadow-none ${!npvFails(result.npv) ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50'}`}>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-1.5 mb-1">
                                <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">NPV</span><Tooltip content="Net Present Value — sum of all discounted future cashflows minus initial investment. Positive = value-creating project." /><Explain k="npv" />
                            </div>
                            <div
                                className={`text-2xl font-bold ${!npvFails(result.npv) ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400 cursor-pointer underline decoration-dotted underline-offset-4'}`}
                                title={npvFails(result.npv) ? `${diag?.npv?.reason ?? `NPV ${fmtMoney(result.npv)} negative at the discount rate used.`} Click to see the reason & quantified levers.` : undefined}
                                onClick={npvFails(result.npv) ? (e) => { e.stopPropagation(); setOpenDiag(d => d === 'npv' ? null : 'npv'); } : undefined}
                            >
                                {fmtMoney(result.npv)}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">@ {(finInputs.discountRate * 100).toFixed(0)}% discount rate</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-1.5 mb-1">
                                <TrendingUp className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">IRR</span><Tooltip content="Internal Rate of Return — the discount rate at which NPV equals zero. Must exceed WACC (hurdle rate) for project approval." />
                            </div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                {Number.isFinite(result.irr) ? `${result.irr.toFixed(1)}%` : 'N/A'}
                                {Number.isFinite(result.irr) && (result.irr > finInputs.discountRate * 100
                                    ? <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    : <ArrowDownRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                                )}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                {Number.isFinite(result.irr) ? (result.irr > finInputs.discountRate * 100 ? 'Exceeds hurdle rate' : 'Below hurdle rate') : 'Insufficient cashflow data'}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Payback</span><Tooltip content="Simple payback period — years until cumulative net cashflow turns positive. Discounted payback accounts for time value of money." /><Explain k="payback-period" />
                            </div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">{result.paybackPeriodYears} <span className="text-sm text-slate-500 dark:text-slate-400">yrs</span></div>
                            <div className="text-xs text-slate-500 mt-1">Discounted: {result.discountedPaybackYears} yrs</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Percent className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">ROI</span><Tooltip content="Return on Investment — total profit as percentage of initial CAPEX. PI (Profitability Index) = PV of cashflows / investment." />
                            </div>
                            <div
                                className={`text-2xl font-bold ${!roiFails(result.roiPercent) ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400 cursor-pointer underline decoration-dotted underline-offset-4'}`}
                                title={roiFails(result.roiPercent) ? `${diag?.roi?.reason ?? `ROI ${fmtPct(result.roiPercent, 0)} not positive.`} Click to see the reason & quantified levers.` : undefined}
                                onClick={roiFails(result.roiPercent) ? (e) => { e.stopPropagation(); setOpenDiag(d => d === 'roi' ? null : 'roi'); } : undefined}
                            >
                                {Number.isFinite(result.roiPercent) ? `${result.roiPercent.toFixed(0)}%` : 'N/A'}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">PI: {Number.isFinite(result.profitabilityIndex) ? `${result.profitabilityIndex.toFixed(2)}x` : 'N/A'}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* ── Diagnostics panel — reason + quantified levers (bisection on the SAME model) ── */}
                {openDiag && (() => {
                    const ex = openDiag === 'npv' ? diag?.npv : diag?.roi;
                    if (!ex) return null; // metric recovered → panel disappears with it
                    return (
                        <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40">
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{ex.reason}</p>
                                <button
                                    type="button"
                                    onClick={() => setOpenDiag(null)}
                                    className="shrink-0 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                >
                                    Close ✕
                                </button>
                            </div>
                            {ex.levers.length > 0 && (
                                <div className="mt-2">
                                    <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5">What needs to change</div>
                                    <div className="space-y-1.5">
                                        {ex.levers.map((lv, li) => {
                                            const external = lv.targetTab !== FINANCE_TAB;
                                            return (
                                                <button
                                                    key={li}
                                                    type="button"
                                                    onClick={external ? (e) => { e.stopPropagation(); simActions.setActiveTab(lv.targetTab as 'capex'); } : undefined}
                                                    title={external ? `Open the "${lv.targetTab}" tab to fine-tune this parameter` : "This parameter is edited in this page's sidebar"}
                                                    className={`w-full flex items-start gap-2 p-2 rounded-md bg-white/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-left group ${external ? 'hover:border-blue-400 dark:hover:border-blue-500 transition-colors' : 'cursor-default'}`}
                                                >
                                                    <span className="shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 whitespace-nowrap">{lv.label}</span>
                                                    <span className="flex-1 text-[11px] text-slate-600 dark:text-slate-400 leading-snug">{lv.detail}</span>
                                                    {external && <ArrowUpRight className="shrink-0 w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 mt-0.5" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* ── Revenue KPIs ──────────────────── */}
                {revResult && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Card className="bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800/40 shadow-sm dark:shadow-none">
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Receipt className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Total NRC</span><Tooltip content="Total Non-Recurring Charges — all one-time fees including setup, cross-connect installation, and custom fit-out. Collected at contract signing or deployment." />
                                </div>
                                <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{fmtMoney(revResult.totalNRC)}</div>
                                <div className="text-xs text-slate-500 mt-1">One-time setup fees</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 shadow-sm dark:shadow-none">
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Repeat className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Lifetime MRC</span><Tooltip content="Total Monthly Recurring Charges summed over the full contract period. Includes power, cooling, and cross-connect fees with annual escalation applied." />
                                </div>
                                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtMoney(revResult.totalMRC_lifetime)}</div>
                                <div className="text-xs text-slate-500 mt-1">Over {revInputs.contractYears} years</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/40 shadow-sm dark:shadow-none">
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">TCV</span><Tooltip content="Total Contract Value — the sum of all NRC and lifetime MRC over the full lease term. Key metric for deal sizing and sales pipeline valuation." />
                                </div>
                                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{fmtMoney(revResult.contractValue)}</div>
                                <div className="text-xs text-slate-500 mt-1">Total Contract Value</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 shadow-sm dark:shadow-none">
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Effective $/kW/mo</span><Tooltip content="Blended effective rate per kW per month. Amortizes NRC over the contract term and adds to average MRC, giving the true all-in cost per kW." />
                                </div>
                                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">${revResult.effectiveRate.toFixed(0)}</div>
                                <div className="text-xs text-slate-500 mt-1">Blended rate (NRC+MRC)</div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ── Cumulative Cashflow Chart ─────── */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                            Cumulative Free Cashflow <Tooltip content="Running total of net cashflows (revenue minus OPEX) over the project life. The point where the curve crosses zero marks payback. Dashed line shows time-value-adjusted (discounted) cashflow." />
                        </CardTitle>
                    </CardHeader>
                    <CardContent id="financial-cashflow-chart" className="p-4 bg-white dark:bg-slate-800" style={isExporting ? { width: '800px', height: '320px' } : undefined}>
                        <ResponsiveContainer width="100%" height={isExporting ? 320 : 280}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="cashflowGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="discountedGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
                                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v: number) => fmtMoney(v)} />
                                <RTooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                    labelStyle={{ color: '#e2e8f0' }}
                                    formatter={((value: number, name: string) => [fmtMoney(value), name === 'cumCashflow' ? 'Cumulative CF' : 'Discounted CF']) as any}
                                />
                                <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                                <Area type="monotone" dataKey="cumCashflow" stroke="#10b981" fill="url(#cashflowGrad)" strokeWidth={2} />
                                <Area type="monotone" dataKey="cumDiscounted" stroke="#6366f1" fill="url(#discountedGrad)" strokeWidth={2} strokeDasharray="4 4" />
                            </AreaChart>
                        </ResponsiveContainer>
                        <div className="flex items-center justify-center gap-6 mt-2 text-xs text-slate-500">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-emerald-500 rounded" /><span>Cumulative Cashflow</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-indigo-500 rounded border-dashed" /><span>Discounted Cashflow</span></div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Revenue Waterfall Chart ────────── */}
                {revResult && (
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                                Revenue Waterfall — NRC + MRC Breakdown <Tooltip content="Stacked bar chart showing annual revenue composition: one-time NRC (Year 1 only), recurring MRC from power, and cross-connect fees. The line tracks cumulative revenue over the contract." />
                            </CardTitle>
                        </CardHeader>
                        <CardContent id="financial-waterfall-chart" className="p-4 bg-white dark:bg-slate-800" style={isExporting ? { width: '800px', height: '340px' } : undefined}>
                            <ResponsiveContainer width="100%" height={isExporting ? 340 : 300}>
                                <ComposedChart data={revResult.yearDetails.map(yd => ({
                                    year: `Y${yd.year}`,
                                    nrc: yd.nrc,
                                    mrc: yd.mrcAnnual,
                                    crossConnect: yd.crossConnectAnnual,
                                    cumRevenue: yd.cumulativeRevenue,
                                }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
                                    <YAxis yAxisId="left" stroke="#64748b" fontSize={11} tickFormatter={(v: number) => fmtMoney(v)} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={11} tickFormatter={(v: number) => fmtMoney(v)} />
                                    <RTooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                        labelStyle={{ color: '#e2e8f0' }}
                                        formatter={((value: number, name: string) => [
                                            fmtMoney(value),
                                            name === 'nrc' ? 'NRC (One-Time)' :
                                                name === 'mrc' ? 'MRC (Power)' :
                                                    name === 'crossConnect' ? 'Cross-Connect' :
                                                        'Cumulative Revenue'
                                        ]) as any}
                                    />
                                    <Legend formatter={(value: string) =>
                                        value === 'nrc' ? 'NRC (One-Time)' :
                                            value === 'mrc' ? 'MRC (Power)' :
                                                value === 'crossConnect' ? 'Cross-Connect' :
                                                    'Cumulative Revenue'
                                    } />
                                    <Bar yAxisId="left" dataKey="nrc" stackId="rev" fill="#06b6d4" radius={[0, 0, 0, 0]} />
                                    <Bar yAxisId="left" dataKey="mrc" stackId="rev" fill="#10b981" radius={[0, 0, 0, 0]} />
                                    <Bar yAxisId="left" dataKey="crossConnect" stackId="rev" fill="#7DDDB4" radius={[4, 4, 0, 0]} />
                                    <Line yAxisId="right" type="monotone" dataKey="cumRevenue" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {/* ── MRC Growth Trajectory ──────────── */}
                {revResult && (
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                MRC Growth Trajectory with Take-or-Pay Floor <Tooltip content="Monthly MRC progression over contract term showing the effect of annual escalation and occupancy ramp. The dashed line marks the minimum billable amount guaranteed by the take-or-pay clause." />
                            </CardTitle>
                        </CardHeader>
                        <CardContent id="financial-mrc-chart" className="p-4 bg-white dark:bg-slate-800" style={isExporting ? { width: '800px', height: '300px' } : undefined}>
                            <ResponsiveContainer width="100%" height={isExporting ? 300 : 260}>
                                <AreaChart data={revResult.yearDetails.map(yd => ({
                                    year: `Y${yd.year}`,
                                    mrcMonthly: yd.mrcMonthly,
                                }))}>
                                    <defs>
                                        <linearGradient id="mrcGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
                                    <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v: number) => fmtMoney(v)} />
                                    <RTooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                        labelStyle={{ color: '#e2e8f0' }}
                                        formatter={((value: number, name: string) => [
                                            fmtMoney(value) + '/mo',
                                            'Monthly MRC'
                                        ]) as any}
                                    />
                                    <Area type="monotone" dataKey="mrcMonthly" stroke="#10b981" fill="url(#mrcGrowthGrad)" strokeWidth={2} />
                                    <ReferenceLine y={(revInputs.takeOrPayPct / 100) * (capexStore.inputs.itLoad || inputs.itLoad || 1000) * revInputs.mrcPerKwMonth} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: 'Take-or-Pay Floor', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                            <div className="flex items-center justify-center gap-6 mt-2 text-xs text-slate-500">
                                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-emerald-500 rounded" /><span>Monthly MRC</span></div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-amber-500 rounded border-dashed" /><span>Take-or-Pay Floor</span></div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* ═══════════════════════════════════════
                    COMBINED TABLE: Financial + Revenue
                    Calculated values are editable (click to override)
                   ═══════════════════════════════════════ */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                            Year-by-Year Projection &amp; Revenue <Tooltip content="Combined financial projection and revenue model table. Shows escalated revenue, OPEX, EBITDA, net income alongside NRC/MRC revenue streams. Click any numeric cell to manually override calculated values." />
                            <span className="ml-auto text-[9px] text-slate-500 font-normal">Click any value to override</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    {/* Group headers */}
                                    <tr className="border-b border-slate-200 dark:border-slate-600">
                                        <th className="text-left py-1 text-slate-600 dark:text-slate-500 font-normal" rowSpan={2}>Year</th>
                                        <th className="text-center py-1 text-indigo-600 dark:text-indigo-400 font-semibold text-[10px] uppercase tracking-wider" colSpan={4} style={{ borderLeft: '2px solid #334155' }}>
                                            Financial Projection
                                        </th>
                                        <th className="text-center py-1 text-cyan-600 dark:text-cyan-400 font-semibold text-[10px] uppercase tracking-wider" colSpan={5} style={{ borderLeft: '2px solid #334155' }}>
                                            Revenue Model (NRC + MRC)
                                        </th>
                                        <th className="text-center py-1 text-amber-600 dark:text-amber-400 font-semibold text-[10px] uppercase tracking-wider" colSpan={2} style={{ borderLeft: '2px solid #334155' }}>
                                            Summary
                                        </th>
                                    </tr>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        {/* Financial columns */}
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1" style={{ borderLeft: '2px solid #334155' }}>Revenue</th>
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1">OPEX</th>
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1">EBITDA</th>
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1">Net Income</th>
                                        {/* Revenue columns */}
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1" style={{ borderLeft: '2px solid #334155' }}>Occ%</th>
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1">Billed kW</th>
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1">NRC</th>
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1">MRC/mo</th>
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1">MRC Yr</th>
                                        {/* Summary */}
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1" style={{ borderLeft: '2px solid #334155' }}>Total Rev</th>
                                        <th className="text-right py-2 text-slate-600 dark:text-slate-400 font-medium px-1">Cum. CF</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Y0 Row — CAPEX Investment */}
                                    <tr className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-100 dark:bg-slate-800/30">
                                        <td className="py-2 text-slate-800 dark:text-slate-300 font-medium">Y0</td>
                                        <td className="text-right text-slate-500 px-1" style={{ borderLeft: '2px solid #1e293b' }}>—</td>
                                        <td className="text-right text-slate-500 px-1">—</td>
                                        <td className="text-right text-slate-500 px-1">—</td>
                                        <td className="text-right text-red-500 dark:text-red-400 font-medium px-1">-{fmtMoney(capexResults.total)}</td>
                                        <td className="text-right text-slate-500 px-1" style={{ borderLeft: '2px solid #1e293b' }} colSpan={5}>—</td>
                                        <td className="text-right text-red-500 dark:text-red-400 font-medium px-1" style={{ borderLeft: '2px solid #1e293b' }}>—</td>
                                        <td className="text-right text-red-500 dark:text-red-400 font-medium px-1">-{fmtMoney(capexResults.total)}</td>
                                    </tr>
                                    {/* Data rows */}
                                    {result.cashflows.map((cf, idx) => {
                                        const yr = cf.year;
                                        const revYr = revResult?.yearDetails[idx];
                                        const overrides = yearOverrides[yr] || {};

                                        // Use override if available, otherwise calculated
                                        const revenue = overrides.revenue ?? cf.revenue;
                                        const opex = overrides.opex ?? cf.opex;
                                        const ebitda = revenue - opex;
                                        const netIncome = overrides.netIncome ?? cf.netIncome;
                                        const mrcMonthly = overrides.mrcMonthly ?? (revYr?.mrcMonthly ?? 0);
                                        const mrcAnnual = overrides.mrcAnnual ?? (revYr?.mrcAnnual ?? 0);

                                        // Apply zebra striping manually for light mode for better legibility
                                        const rowBg = yr % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-slate-50 dark:bg-transparent";

                                        return (
                                            <tr key={yr} className={`border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700/20 transition-colors ${rowBg}`}>
                                                <td className="py-2 text-slate-800 dark:text-slate-300">Y{yr}</td>
                                                {/* Financial */}
                                                <td className="text-right text-emerald-600 dark:text-emerald-400 px-1" style={{ borderLeft: '2px solid #1e293b' }}>
                                                    <EditableCell value={revenue} onChange={v => setYearOverride(yr, 'revenue', v)} />
                                                </td>
                                                <td className="text-right text-red-500 dark:text-red-400 px-1">
                                                    <EditableCell value={opex} onChange={v => setYearOverride(yr, 'opex', v)} />
                                                </td>
                                                <td className="text-right text-slate-900 dark:text-white px-1">{fmtMoney(ebitda)}</td>
                                                <td className={`text-right font-medium px-1 ${netIncome >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                                    <EditableCell value={netIncome} onChange={v => setYearOverride(yr, 'netIncome', v)} />
                                                </td>
                                                {/* Revenue */}
                                                <td className="text-right text-slate-700 dark:text-slate-300 px-1" style={{ borderLeft: '2px solid #1e293b' }}>
                                                    {revYr ? `${(revYr.occupancy * 100).toFixed(0)}%` : '—'}
                                                </td>
                                                <td className="text-right text-slate-900 dark:text-white px-1">
                                                    {revYr ? fmt(revYr.billedKw) : '—'}
                                                </td>
                                                <td className={`text-right px-1 ${revYr && revYr.nrc > 0 ? 'text-cyan-600 dark:text-cyan-400 font-medium' : 'text-slate-400 dark:text-slate-600'}`}>
                                                    {revYr && revYr.nrc > 0 ? fmtMoney(revYr.nrc) : '—'}
                                                </td>
                                                <td className="text-right text-emerald-600 dark:text-emerald-400 px-1">
                                                    {revYr ? <EditableCell value={mrcMonthly} onChange={v => setYearOverride(yr, 'mrcMonthly', v)} /> : '—'}
                                                </td>
                                                <td className="text-right text-emerald-600 dark:text-emerald-400 px-1">
                                                    {revYr ? <EditableCell value={mrcAnnual} onChange={v => setYearOverride(yr, 'mrcAnnual', v)} /> : '—'}
                                                </td>
                                                {/* Summary */}
                                                <td className="text-right text-slate-900 dark:text-white font-medium px-1" style={{ borderLeft: '2px solid #1e293b' }}>
                                                    {revYr ? fmtMoney(revYr.totalRevenue) : fmtMoney(revenue)}
                                                </td>
                                                <td className={`text-right font-medium px-1 ${cf.cumulativeCashflow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                                    {fmtMoney(cf.cumulativeCashflow)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {/* Footer totals */}
                                {revResult && (
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-200 dark:border-slate-600 font-semibold">
                                            <td className="py-2 text-slate-800 dark:text-slate-300">TOTAL</td>
                                            <td className="text-right text-emerald-600 dark:text-emerald-400 px-1" style={{ borderLeft: '2px solid #1e293b' }}>{fmtMoney(result.totalRevenue)}</td>
                                            <td className="text-right text-red-600 dark:text-red-400 px-1">{fmtMoney(result.cashflows.reduce((s, c) => s + c.opex, 0))}</td>
                                            <td className="text-right text-slate-900 dark:text-white px-1">{fmtMoney(result.cashflows.reduce((s, c) => s + c.ebitda, 0))}</td>
                                            <td className="text-right text-emerald-600 dark:text-emerald-400 px-1">{fmtMoney(result.totalProfit)}</td>
                                            <td className="text-right text-slate-600 dark:text-slate-500 px-1" style={{ borderLeft: '2px solid #1e293b' }}>—</td>
                                            <td className="text-right text-slate-600 dark:text-slate-500 px-1">—</td>
                                            <td className="text-right text-cyan-600 dark:text-cyan-400 px-1">{fmtMoney(revResult.totalNRC)}</td>
                                            <td className="text-right text-slate-600 dark:text-slate-500 px-1">—</td>
                                            <td className="text-right text-emerald-600 dark:text-emerald-400 px-1">{fmtMoney(revResult.totalMRC_lifetime)}</td>
                                            <td className="text-right text-slate-900 dark:text-white px-1" style={{ borderLeft: '2px solid #1e293b' }}>{fmtMoney(revResult.totalRevenue_lifetime)}</td>
                                            <td className={`text-right px-1 ${result.cashflows[result.cashflows.length - 1]?.cumulativeCashflow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {fmtMoney(result.cashflows[result.cashflows.length - 1]?.cumulativeCashflow ?? 0)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* ═══ B11: OCCUPANCY IMPACT CHART ═══ */}
                {(() => {
                    const breakEvenPct = occupancyImpactData.find(d => d.npv >= 0)?.occupancyPct ?? 100;

                    return occupancyImpactData.length > 0 ? (
                        <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                                    Occupancy Impact — NPV &amp; IRR Sensitivity <Tooltip content="Shows how facility occupancy rate affects project viability. The break-even point marks the minimum occupancy needed for NPV to turn positive. Critical for go/no-go decisions." />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={occupancyImpactData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis dataKey="occupancy" stroke="#64748b" fontSize={11} />
                                        <YAxis
                                            yAxisId="left"
                                            stroke="#10b981"
                                            fontSize={11}
                                            tickFormatter={(v: number) => fmtMoney(v)}
                                            label={{ value: 'NPV ($)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
                                        />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            stroke="#6366f1"
                                            fontSize={11}
                                            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                                            label={{ value: 'IRR (%)', angle: 90, position: 'insideRight', fill: '#64748b', fontSize: 10 }}
                                        />
                                        <RTooltip
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                            labelStyle={{ color: '#e2e8f0' }}
                                            formatter={((value: number, name: string) => [
                                                name === 'npv' ? fmtMoney(value) : `${value.toFixed(1)}%`,
                                                name === 'npv' ? 'NPV' : 'IRR'
                                            ]) as any}
                                        />
                                        <ReferenceLine yAxisId="left" y={0} stroke="#ef4444" strokeDasharray="6 3" label={{ value: 'Break-even', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
                                        <ReferenceLine x={`${breakEvenPct.toFixed(0)}%`} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `BE: ${breakEvenPct.toFixed(0)}%`, fill: '#f59e0b', fontSize: 10, position: 'top' }} />
                                        <Line yAxisId="left" type="monotone" dataKey="npv" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} name="npv" />
                                        <Line yAxisId="right" type="monotone" dataKey="irr" stroke="#6366f1" strokeWidth={2} dot={{ r: 4, fill: '#6366f1' }} strokeDasharray="5 5" name="irr" />
                                        <Legend formatter={(value: string) => value === 'npv' ? 'NPV ($)' : 'IRR (%)'} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    ) : null;
                })()}

                {/* ═══ OPEX BREAKDOWN ═══ */}
                {(() => {
                    const labor = selectedCountry.labor;
                    const staffCost = (
                        effectiveInputs.headcount_ShiftLead * labor.baseSalary_ShiftLead +
                        effectiveInputs.headcount_Engineer * labor.baseSalary_Engineer +
                        effectiveInputs.headcount_Technician * labor.baseSalary_Technician +
                        effectiveInputs.headcount_Admin * labor.baseSalary_Admin +
                        effectiveInputs.headcount_Janitor * labor.baseSalary_Janitor
                    ) * 12;
                    /* unit fix: kW × PUE × h × $/kWh = $ (no /1000 — see annualOpex) */
                    const energyCost = effectiveInputs.itLoad * ((rzData().pueMatrix as Record<string, Record<string, number>> | undefined)?.[inputs.coolingType]?.['tier' + inputs.tierLevel] ?? 1.4) * 8760 * (selectedCountry?.economy.electricityRate ?? 0.10);
                    const maintenanceCost = effectiveInputs.itLoad * MAINT_PER_KW_YR;
                    const insuranceCost = capexResults.total * 0.003; // 0.3% of CAPEX — screening ratio (illustrative OPEX split, not engine-sourced)
                    const overheadCost = annualOpex * 0.05; // 5% overhead — screening ratio (illustrative OPEX split, not engine-sourced)

                    const opexBreakdown = [
                        { category: 'Energy', value: energyCost, color: '#f59e0b' },
                        { category: 'Staffing', value: staffCost, color: '#7DDDB4' },
                        { category: 'Maintenance', value: maintenanceCost, color: '#06b6d4' },
                        { category: 'Insurance', value: insuranceCost, color: '#ec4899' },
                        { category: 'Overhead', value: overheadCost, color: '#64748b' },
                    ];
                    const totalOpex = opexBreakdown.reduce((s, d) => s + d.value, 0);

                    return (
                        <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                                    <Receipt className="w-4 h-4 text-rz-mint" />
                                    OPEX Breakdown (Annual) <Tooltip content="Annual operating expenditure breakdown by category. Energy is typically the largest cost (40-60%), followed by staffing. Understanding the mix helps identify cost optimization opportunities." />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={opexBreakdown} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                        <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(v: number) => fmtMoney(v)} />
                                        <YAxis type="category" dataKey="category" stroke="#64748b" fontSize={11} width={90} />
                                        <RTooltip
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                            formatter={((value: number, name: string) => [fmtMoney(value), 'Annual Cost']) as any}
                                        />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                            {opexBreakdown.map((entry, idx) => (
                                                <Cell key={idx} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
                                    {opexBreakdown.map((item, i) => (
                                        <div key={i} className="text-center p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                            <div className="text-[10px] text-slate-500 mb-0.5">{item.category}</div>
                                            <div className="text-xs font-bold text-slate-900 dark:text-white">{fmtMoney(item.value)}</div>
                                            <div className="text-[10px] text-slate-400">{((item.value / totalOpex) * 100).toFixed(0)}%</div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })()}

                {/* ═══ SENSITIVITY ANALYSIS TABLE ═══ */}
                {(() => {
                    const baseCapex = capexResults.total;
                    const baseOpex = annualOpex;
                    const baseRevPerKw = finInputs.revenuePerKwMonth;
                    const variations = [-20, -10, 0, 10, 20];

                    const sensitivityRows = variations.map(capexVar => {
                        return variations.map(revVar => {
                            const adjCapex = baseCapex * (1 + capexVar / 100);
                            const adjRev = baseRevPerKw * (1 + revVar / 100);
                            const occupancyRamp = defaultOccupancyRamp(finInputs.projectLifeYears);
                            const r = calculateFinancials({
                                totalCapex: adjCapex,
                                annualOpex: baseOpex,
                                revenuePerKwMonth: adjRev,
                                itLoadKw: inputs.itLoad,
                                discountRate: finInputs.discountRate,
                                projectLifeYears: finInputs.projectLifeYears,
                                escalationRate: finInputs.escalationRate,
                                opexEscalation: finInputs.opexEscalation,
                                occupancyRamp,
                                taxRate: finInputs.taxRate,
                                depreciationYears: finInputs.depreciationYears,
                            });
                            return { capexVar, revVar, npv: r.npv, irr: r.irr };
                        });
                    });

                    return (
                        <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                                    Sensitivity Analysis — NPV &amp; IRR <Tooltip content="Two-way sensitivity matrix showing NPV and IRR under varying CAPEX and revenue assumptions. Green = viable (NPV>0, IRR>WACC), amber = marginal, red = unviable. The cyan-ringed cell is the base case." />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">CAPEX variation (rows) vs Revenue/kW variation (columns). Cell shows NPV / IRR.</p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr>
                                                <th className="px-2 py-2 text-left text-slate-500 font-medium">CAPEX \\ Rev</th>
                                                {variations.map(v => (
                                                    <th key={v} className="px-2 py-2 text-center text-slate-500 font-medium">{v >= 0 ? '+' : ''}{v}%</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sensitivityRows.map((row, ri) => (
                                                <tr key={ri} className={variations[ri] === 0 ? 'bg-cyan-50 dark:bg-cyan-950/20' : ''}>
                                                    <td className="px-2 py-2 font-mono text-slate-700 dark:text-slate-300 font-medium">{variations[ri] >= 0 ? '+' : ''}{variations[ri]}%</td>
                                                    {row.map((cell, ci) => {
                                                        const bg = cell.npv > 0 && cell.irr > finInputs.discountRate * 100
                                                            ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                                                            : cell.npv > 0
                                                            ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'
                                                            : 'bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-300';
                                                        const isBase = variations[ri] === 0 && variations[ci] === 0;
                                                        return (
                                                            <td key={ci} className={`px-2 py-1.5 text-center font-mono text-[10px] rounded ${bg} ${isBase ? 'ring-2 ring-cyan-500' : ''}`}>
                                                                <div className="font-bold">{fmtMoney(cell.npv)}</div>
                                                                <div className="text-[9px] opacity-70">{cell.irr.toFixed(1)}%</div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })()}

                {/* ═══ B16: BUDGET VS FORECAST VARIANCE ═══ */}
                {(() => {
                    return budgetVsForecastData.length > 0 ? (
                        <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                                    Budget vs Forecast Variance <Tooltip content="Compares budgeted OPEX against forecasted actuals by category. Positive variance (red) = over budget. Helps identify cost overruns early and adjust operational planning." />
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={budgetVsForecastData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis dataKey="category" stroke="#64748b" fontSize={11} />
                                        <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v: number) => fmtMoney(v)} />
                                        <RTooltip
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                            labelStyle={{ color: '#e2e8f0' }}
                                            formatter={((value: number, name: string) => [
                                                fmtMoney(value),
                                                name === 'budget' ? 'Budget' : 'Forecast'
                                            ]) as any}
                                        />
                                        <Legend formatter={(value: string) => value === 'budget' ? 'Budget' : 'Forecast'} />
                                        <Bar dataKey="budget" fill="#06b6d4" radius={[4, 4, 0, 0]} name="budget" />
                                        <Bar dataKey="forecast" fill="#f59e0b" radius={[4, 4, 0, 0]} name="forecast" />
                                    </BarChart>
                                </ResponsiveContainer>
                                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {budgetVsForecastData.map((d, i) => {
                                        const variance = d.forecast - d.budget;
                                        const variancePct = d.budget > 0 ? ((variance / d.budget) * 100) : 0;
                                        return (
                                            <div key={i} className="text-center p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                                <div className="text-xs text-slate-500 mb-1">{d.category}</div>
                                                <div className={`text-sm font-mono font-bold ${variance > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    {variance > 0 ? '+' : ''}{variancePct.toFixed(1)}%
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    ) : null;
                })()}

            </div>
        </div>
    );
};

export default FinancialDashboard;
