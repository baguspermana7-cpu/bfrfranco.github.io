'use client';

import React, { useMemo, useRef, useState } from 'react';
import { rzData } from '@/lib/rz-engine';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useEffectiveInputs } from '@/store/useEffectiveInputs';
import { calculateBenchmark, MetricScore, BenchmarkResult } from '@/modules/analytics/BenchmarkEngine';
import { calculateFinancials, defaultOccupancyRamp } from '@/modules/analytics/FinancialEngine';
import { calculateCapex } from '@/lib/CapexEngine';
import { calculateStaffing } from '@/modules/staffing/ShiftEngine';
import { calculateCarbonFootprint } from '@/modules/analytics/CarbonEngine';
import { BENCHMARK_CATEGORIES, BenchmarkCategory, GRADE_COLORS, Grade, getBenchmarkForTier, getPercentileRank, percentileToGrade } from '@/data/benchmarks';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Target, Trophy, AlertTriangle, TrendingUp, Info, ChevronRight, ChevronDown, ArrowUpRight } from 'lucide-react';
import { Tooltip as InfoTooltip } from '@/components/ui/Tooltip';
import { computeCalibration, pctileLabelOf, type CalibrationResult } from '@/lib/calibration';
import { explainThresholdMetric } from '@/lib/decision-explain';
import { PUE_BY_COOLING } from '@/constants/pue';
import { DEFAULT_REVENUE_PER_KW_MONTH } from '@/constants/finance';
import { TraceValue } from '@/components/ui/TraceValue';
import clsx from 'clsx';

type BenchmarkTab = 'scorecard' | 'detailed' | 'strengths' | 'comparison';

// ─── TOOLTIP CONTENT MAP ────────────────────────────────────
const TOOLTIP_TEXTS = {
    // Main dashboard
    industryBenchmarks: 'Compare your data center configuration against industry-standard benchmarks from Uptime Institute, ASHRAE, and Green Grid surveys for same-tier facilities.',
    configBadge: 'Active configuration parameters used for benchmark scoring. Tier level, country, and IT load directly affect which peer group your facility is compared against.',

    // Overall score & grade
    overallGrade: 'Composite grade (A\u2013F) based on weighted scoring across all benchmark categories. A = top 10%, F = bottom 20%.',
    overallScore: 'Weighted aggregate of all category scores (0\u2013100), reflecting overall operational maturity relative to industry peers.',

    // Category labels
    energyEfficiency: 'Power Usage Effectiveness benchmark. Scores facility energy efficiency against Tier-matched peers using PUE, WUE, and energy cost per kW.',
    staffing: 'Staff-to-MW ratio compared to industry norms. Accounts for shift model, labor cost as % of OPEX, and annual turnover rate.',
    financial: 'OPEX per kW and CAPEX per kW benchmarked against regional and tier-appropriate comparables. Includes IRR and payback period.',
    availability: 'Uptime achievement vs SLA targets. Based on annual uptime percentage and mean time to repair (MTTR) for the selected tier.',
    carbonEsg: 'Carbon intensity, renewable energy percentage, and Scope 2 emissions per MW benchmarked against industry leaders and GHG Protocol standards.',

    // Scorecard summary sections
    topStrengths: 'The top 3 metrics where your facility outperforms industry peers. Based on lowest percentile rank (closest to best-in-class).',
    improvementAreas: 'The 3 metrics with the most room for improvement. Each includes an actionable recommendation based on industry best practices.',

    // Detailed metrics
    categoryScore: 'Performance score (0\u2013100) for a specific operational domain relative to industry averages.',
    percentileRank: "Facility's position relative to industry peers. Lower percentile = better performance. 10th percentile means top 10%.",
    metricGrade: 'Letter grade (A\u2013F) derived from percentile rank. A = top 25%, B = 25\u201350%, C = 50\u201375%, D = 75\u201390%, F = bottom 10%.',
    bulletChart: 'Visual benchmark range. Blue zone = interquartile range (P25\u2013P75). Cyan marker = your value. Vertical line = industry median.',
    improvementGap: 'Difference between current performance and best-in-class benchmark. Represents optimization opportunity.',

    // Individual metric tooltips
    metrics: {
        pue: 'Power Usage Effectiveness \u2014 ratio of total facility power to IT equipment power. Lower is better. Industry median ~1.50 (Uptime Institute 2025); AI/liquid-cooled best-in-class 1.08\u20131.12.',
        wue: 'Water Usage Effectiveness \u2014 liters of water consumed per kWh of IT energy. Estimated from cooling type. Lower is better.',
        energy_cost_per_kw: 'Annual electricity cost per kW of IT load, estimated at ~60% of total OPEX. Varies significantly by region.',
        staff_per_mw: 'Full-time equivalent staff per MW of IT load. Tier 4 facilities typically require 5\u201318 FTE/MW; Tier 2 requires 2.5\u201310.',
        labor_cost_pct_opex: 'Labor costs as a percentage of total operating expenditure. High ratios may indicate overstaffing or under-automation.',
        turnover_rate: 'Annual staff turnover percentage. High turnover increases training costs and operational risk. Industry median ~15%.',
        capex_per_kw: 'Total capital expenditure per kW of IT capacity. Tier level is the strongest driver. Includes M&E, structure, and site costs.',
        opex_per_kw: 'Annual operating expenditure per kW of IT load. Encompasses energy, staffing, maintenance, and compliance costs.',
        irr: 'Internal Rate of Return \u2014 expected annualized return on investment. Higher is better. Industry median ~13% for new builds.',
        payback_years: 'Years to recover initial capital investment through net cash flows. Lower is better. Affected by occupancy ramp and pricing.',
        uptime_pct: 'Annual uptime as a percentage. Derived from tier level SLA targets. Tier 3 targets 99.982%, Tier 4 targets 99.995%.',
        mttr_hours: 'Mean Time to Repair \u2014 average hours to restore service after an incident. Lower is better. Driven by spares, staffing, and procedures.',
        cue: 'Carbon Usage Effectiveness \u2014 kgCO2 emitted per kWh of IT energy. Derived from grid carbon intensity. Lower is better.',
        renewable_pct: 'Percentage of energy sourced from renewables (PPAs, on-site, RECs). Higher is better. Industry leaders target 100%.',
        scope2_per_mw: 'Annual Scope 2 greenhouse gas emissions (tCO2) per MW of IT load. Driven by grid carbon intensity and PUE.',
    } as Record<string, string>,

    // Comparison table headers
    compMetric: 'Benchmark metric name and unit of measurement.',
    compYourValue: 'Your facility\'s calculated value for this metric based on current configuration inputs.',
    compPercentiles: 'Industry distribution from top performers (P10) to bottom performers (P90). Based on Uptime Institute and Green Grid surveys.',
    compRank: "Percentile rank indicating where your facility falls in the industry distribution. Lower percentile = better performance.",
    compGrade: 'Letter grade (A\u2013F) derived from percentile position. A = top quartile, F = bottom decile.',
    compSource: 'Data source for the benchmark values (e.g., Uptime Institute, ASHRAE, Green Grid, IEA).',

    // Strengths & Gaps tab
    strengthsHeading: 'Metrics where your configuration excels relative to industry peers. Sorted by percentile rank (best first).',
    gapsHeading: 'Metrics with the largest gap between your performance and industry best-in-class. Each includes an actionable recommendation.',
} as const;

// Map benchmark category IDs to tooltip keys
const CATEGORY_TOOLTIP_MAP: Record<BenchmarkCategory, string> = {
    energy: TOOLTIP_TEXTS.energyEfficiency,
    staffing: TOOLTIP_TEXTS.staffing,
    financial: TOOLTIP_TEXTS.financial,
    availability: TOOLTIP_TEXTS.availability,
    carbon: TOOLTIP_TEXTS.carbonEsg,
};

/* ─── DIAGNOSTICS TIER-1 (owner mandate: no naked red grade / drift chip) ────
 * Template: PhasedFinancialDashboard clickable red-KPI → computed reason +
 * quantified levers (lib/decision-explain.ts explainThresholdMetric). Every
 * number below comes from the LIVE model (BenchmarkEngine percentiles,
 * DATA.pueMatrix, tier band table) — nothing generic, nothing fabricated.
 * ──────────────────────────────────────────────────────────────────────── */

/** Grades rendered in alert colours (orange `D` / red `F`) by GRADE_COLORS +
 *  the score-ring ternary — the SAME set gates the click-to-explain panel and
 *  `collectBenchmarkDiagnostics`. Derived from `percentileToGrade` boundaries
 *  (A ≤25 · B ≤50 · C ≤75 · D ≤90 · F >90). */
const ALERT_GRADES: readonly Grade[] = ['D', 'F'];
const isAlertGrade = (g: Grade): boolean => ALERT_GRADES.includes(g);
/** Band-C ceiling — identical to the `percentile <= 75 → 'C'` colouring constant. */
const GRADE_C_MAX_PCTILE = 75;
/** Lever search bound — same −60% honesty bound decision-explain uses for CAPEX. */
const LEVER_CUT_MAX = 0.6;

const COOLING_LABELS: Record<string, string> = {
    air: 'air (CRAC/CRAH)',
    inrow: 'in-row',
    rdhx: 'rear-door HX',
    liquid: 'direct liquid',
};

/** Recompute the overall score/grade with ONE metric's percentile replaced —
 *  same formula as BenchmarkEngine (mean of 100 − percentile), immutable. */
function overallAfterReplace(result: BenchmarkResult, metricId: string, newPercentile: number): { score: number; grade: Grade } {
    const score = Math.round(
        result.metrics.reduce((sum, m) => sum + (100 - (m.metric.id === metricId ? newPercentile : m.percentile)), 0) /
        result.metrics.length,
    );
    return { score, grade: percentileToGrade(100 - score) };
}

interface GradeDiag {
    formulaNote: string;
    /** Alert-grade metrics, worst percentile first — the grade's real draggers. */
    dragging: MetricScore[];
    levers: { label: string; detail: string }[];
}

function computeGradeDiagnostics(result: BenchmarkResult, tier: 2 | 3 | 4, coolingType: string): GradeDiag {
    const dragging = result.metrics.filter((m) => isAlertGrade(m.grade)).sort((a, b) => b.percentile - a.percentile);
    const catDrag = (Object.entries(result.categoryScores) as [BenchmarkCategory, { score: number; grade: Grade }][])
        .filter(([, c]) => isAlertGrade(c.grade))
        .map(([id, c]) => `${BENCHMARK_CATEGORIES[id].label} (${c.grade}, ${c.score}/100)`);
    const formulaNote =
        `Overall score = average of (100 − percentile) across ${result.metrics.length} metrics; grade from the same percentile ` +
        `boundaries as the colouring (A ≤25 · B ≤50 · C ≤75 · D ≤90 · F >90). ` +
        `Dragging categories: ${catDrag.join(' · ') || '—'}.`;

    const levers: { label: string; detail: string }[] = [];

    /* ── PUE lever: DISCRETE cooling options from the real DATA.pueMatrix
     *    (tier-matched column), re-ranked through the SAME getPercentileRank
     *    the page scores with → new metric grade + new overall grade. ── */
    const pueScore = result.metrics.find((m) => m.metric.id === 'pue');
    if (pueScore && pueScore.percentile > 50) {
        const pm = (rzData() as { pueMatrix?: Record<string, Record<string, number>> }).pueMatrix;
        const tierKey = `tier${tier}`;
        const opts: { c: string; pue: number }[] = [];
        for (const c of ['liquid', 'rdhx', 'inrow']) {
            if (c === coolingType) continue;
            const p = pm?.[c]?.[tierKey] ?? pm?.[c]?.tier3 ?? PUE_BY_COOLING[c];
            if (typeof p === 'number' && p < pueScore.userValue - 1e-9) opts.push({ c, pue: p });
        }
        opts.sort((a, b) => a.pue - b.pue);
        for (const { c, pue } of opts.slice(0, 2)) {
            const newPct = getPercentileRank(pue, pueScore.metric, tier);
            const after = overallAfterReplace(result, 'pue', newPct);
            levers.push({
                label: `Cooling → ${COOLING_LABELS[c] ?? c}`,
                detail:
                    `PUE ${pueScore.userValue.toFixed(2)} = p${Math.round(pueScore.percentile)} (grade ${pueScore.grade}) — ` +
                    `upgrade cooling to ${COOLING_LABELS[c] ?? c} (PUE ${pue.toFixed(2)}, DATA.pueMatrix ${tierKey}) → ` +
                    `p${Math.round(newPct)} (metric grade ${percentileToGrade(newPct)}); ` +
                    `overall ${result.overallScore} → ${after.score} (grade ${result.overallGrade} → ${after.grade}).`,
            });
        }
    }

    /* ── Continuous levers on the other draggers: magnitude SOLVED by
     *    explainThresholdMetric bisection against a linear scaling of the live
     *    value, threshold = tier-band p75 (the grade-C colouring boundary). ── */
    for (const m of dragging.filter((d) => d.metric.id !== 'pue').slice(0, 3)) {
        const band = m.tierBenchmarks;
        const after = overallAfterReplace(result, m.metric.id, GRADE_C_MAX_PCTILE);
        const overallNote = `overall ${result.overallScore} → ${after.score} (grade ${result.overallGrade} → ${after.grade})`;
        if (m.metric.lowerIsBetter) {
            const ex = explainThresholdMetric({
                metricLabel: m.metric.name,
                value: m.userValue,
                threshold: band.p75,
                direction: 'atMost',
                fmtValue: (v) => formatMetricValue(v, m.metric.unit),
                because: `live position p${Math.round(m.percentile)} > band C boundary p${GRADE_C_MAX_PCTILE} (tier ${tier})`,
                levers: [{
                    lo: 0,
                    hi: LEVER_CUT_MAX,
                    metricAt: (x) => m.userValue * (1 - x),
                    render: (x, achieved) => ({
                        label: `${m.metric.name} −${(x * 100).toFixed(0)}%`,
                        detail:
                            `${m.metric.name} down −${(x * 100).toFixed(1)}% ` +
                            `(${formatMetricValue(m.userValue, m.metric.unit)} → ${formatMetricValue(achieved, m.metric.unit)}) ` +
                            `reaches band C (≤ p75 ${formatMetricValue(band.p75, m.metric.unit)} tier ${tier}); ${overallNote}.`,
                    }),
                    unreachable: (atHi) => ({
                        label: `${m.metric.name}: −${(LEVER_CUT_MAX * 100).toFixed(0)}% not enough`,
                        detail:
                            `Even −${(LEVER_CUT_MAX * 100).toFixed(0)}% (to ${formatMetricValue(atHi, m.metric.unit)}) ` +
                            `does not reach band C p75 ${formatMetricValue(band.p75, m.metric.unit)} — ` +
                            `the input structure needs review, not just tuning.`,
                    }),
                    targetTab: 'benchmark',
                }],
            });
            for (const lv of ex.levers) levers.push({ label: lv.label, detail: lv.detail });
        } else {
            const delta = band.p75 - m.userValue;
            levers.push({
                label: `${m.metric.name} up`,
                detail:
                    `${m.metric.name} ${formatMetricValue(m.userValue, m.metric.unit)} = p${Math.round(m.percentile)} — ` +
                    `needs to rise +${formatMetricValue(Math.abs(delta), m.metric.unit)} to ≥ p75 ` +
                    `${formatMetricValue(band.p75, m.metric.unit)} (tier ${tier}) for band C; ${overallNote}.`,
            });
        }
    }

    return { formulaNote, dragging, levers };
}

/** Best-effort correction direction parsed from a failing gate-mirrored check
 *  label ("v ∈ [lo, hi]" / "v ≤ cap") — live numbers come from the label
 *  itself; when unparseable, an honest generic policy line is returned. */
function driftCorrectionOf(label: string): string {
    const band = label.match(/(-?\d+(?:\.\d+)?)\s*∈\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/);
    if (band) {
        const v = parseFloat(band[1]);
        const lo = parseFloat(band[2]);
        const hi = parseFloat(band[3]);
        if (v < lo) return `Engine value ${v} is BELOW the corpus band [${lo}, ${hi}] → correction direction: raise/verify the engine constant against its source — the corpus band is NOT loosened.`;
        if (v > hi) return `Engine value ${v} is ABOVE the corpus band [${lo}, ${hi}] → correction direction: lower/verify the engine constant against its source — the corpus band is NOT loosened.`;
    }
    const cap = label.match(/(-?\d+(?:\.\d+)?)\s*≤\s.*?(-?\d+(?:\.\d+)?)\s*$/);
    if (cap) {
        const v = parseFloat(cap[1]);
        const c = parseFloat(cap[2]);
        if (Number.isFinite(v) && Number.isFinite(c) && v > c) {
            return `Engine value ${v} exceeds the corpus ceiling ${c} → correction direction: lower/verify the engine constant — the band is NOT loosened.`;
        }
    }
    return 'Check failed — correction is directed at the engine constant / corpus regen; the corpus band is not loosened.';
}

/* ─── EXPORTED COLLECTOR (parent diagnostics surface) ─────────────────────── */

export interface Finding {
    surface: string;
    severity: 'critical' | 'warning';
    metric: string;
    value: string;
    threshold: string;
    linkTab: 'benchmark';
}

/** Pure Tier-1 diagnostics collector: overall/metric grades ≤ D (same
 *  ALERT_GRADES set that colours them orange/red) + active calibration drift
 *  rows. Deterministic — reads only the passed live-model results. */
export function collectBenchmarkDiagnostics(model: {
    result: BenchmarkResult;
    calibration?: CalibrationResult | null;
}): Finding[] {
    const findings: Finding[] = [];
    const { result, calibration } = model;

    if (isAlertGrade(result.overallGrade)) {
        findings.push({
            surface: 'Industry Benchmarks · Overall Grade',
            severity: result.overallGrade === 'F' ? 'critical' : 'warning',
            metric: 'Overall benchmark score',
            value: `${result.overallGrade} (${result.overallScore}/100)`,
            threshold: `grade C needs score ≥ ${100 - GRADE_C_MAX_PCTILE} (composite percentile ≤ ${GRADE_C_MAX_PCTILE})`,
            linkTab: 'benchmark',
        });
    }
    for (const m of result.metrics.filter((x) => isAlertGrade(x.grade))) {
        findings.push({
            surface: 'Industry Benchmarks · Detailed Metrics',
            severity: m.grade === 'F' ? 'critical' : 'warning',
            metric: m.metric.name,
            value: `${formatMetricValue(m.userValue, m.metric.unit)} (p${Math.round(m.percentile)}, grade ${m.grade})`,
            threshold: `band C: ≤ p${GRADE_C_MAX_PCTILE} (${formatMetricValue(m.tierBenchmarks.p75, m.metric.unit)})`,
            linkTab: 'benchmark',
        });
    }
    for (const r of (calibration?.rows ?? []).filter((x) => x.verdict === 'drift')) {
        const failed = r.checks.filter((c) => !c.ok);
        findings.push({
            surface: 'Industry Benchmarks · Model Calibration',
            severity: r.severity === 'fail' ? 'critical' : 'warning',
            metric: r.engineLabel,
            value: r.engineValueText,
            threshold: failed.map((c) => c.label).join(' ; ') || r.corpusLabel,
            linkTab: 'benchmark',
        });
    }
    return findings;
}

export default function BenchmarkDashboard() {
    const { selectedCountry, inputs } = useSimulationStore();
    const capexStore = useCapexStore();
    const effectiveInputs = useEffectiveInputs();
    const [activeTab, setActiveTab] = useState<BenchmarkTab>('scorecard');
    const [calibOpen, setCalibOpen] = useState(false);
    /* Diagnostics Tier-1: per-row drift explain panel (template:
     * PhasedFinancialDashboard expandable decision rows). */
    const [driftRowOpen, setDriftRowOpen] = useState<string | null>(null);
    const calibCardRef = useRef<HTMLDivElement | null>(null);
    const calibTableRef = useRef<HTMLDivElement | null>(null);
    /* Arc-1 — Model Calibration: engine constants vs live corpus, evaluated by
     * lib/calibration.ts (SAME single-source spec + rule semantics as the ship
     * gate tools/test-model-calibration.mjs). Static at runtime → memo once. */
    const calib = useMemo(() => computeCalibration(), []);
    const driftRows = useMemo(() => (calib?.rows ?? []).filter((r) => r.verdict === 'drift'), [calib]);

    const result = useMemo(() => {
        if (!selectedCountry) return null;

        const capexResult = calculateCapex(capexStore.inputs);
        const totalStaff = effectiveInputs.headcount_ShiftLead + effectiveInputs.headcount_Engineer +
            effectiveInputs.headcount_Technician + effectiveInputs.headcount_Admin + effectiveInputs.headcount_Janitor;

        // Calculate staffing costs for OPEX estimate
        const roles: Array<{ role: 'shift-lead' | 'engineer' | 'technician' | 'admin' | 'janitor'; count: number; is24x7: boolean }> = [
            { role: 'shift-lead', count: effectiveInputs.headcount_ShiftLead, is24x7: true },
            { role: 'engineer', count: effectiveInputs.headcount_Engineer, is24x7: true },
            { role: 'technician', count: effectiveInputs.headcount_Technician, is24x7: false },
            { role: 'admin', count: effectiveInputs.headcount_Admin, is24x7: false },
            { role: 'janitor', count: effectiveInputs.headcount_Janitor, is24x7: false },
        ];
        const annualStaffCost = roles.reduce((sum, r) => {
            const res = calculateStaffing(r.role, r.count, inputs.shiftModel, selectedCountry, r.is24x7);
            return sum + res.monthlyCost * 12;
        }, 0);

        const pue = capexResult.pue;
        const annualEnergy = inputs.itLoad * pue * 8760 / 1000; // MWh
        const annualEnergyCost = annualEnergy * (selectedCountry.economy.electricityRate * 1000);
        const annualOpex = annualStaffCost + annualEnergyCost + (selectedCountry.compliance.annualComplianceCost || 50000);

        const financialInputs = {
            totalCapex: capexResult.total,
            annualOpex,
            revenuePerKwMonth: inputs.revenuePerKwMonth ?? DEFAULT_REVENUE_PER_KW_MONTH, // live SSOT (sim-store tunable, constant fallback) — was hardcoded 120
            itLoadKw: inputs.itLoad,
            discountRate: 0.10,
            projectLifeYears: 10,
            escalationRate: 0.03,
            opexEscalation: selectedCountry.economy.inflationRate,
            occupancyRamp: inputs.occupancyRamp.length > 0 ? inputs.occupancyRamp : defaultOccupancyRamp(10),
            taxRate: selectedCountry.economy.taxRate,
            depreciationYears: 7,
        };
        const financialResult = calculateFinancials(financialInputs);

        const carbonResult = calculateCarbonFootprint({
            itLoadKw: inputs.itLoad,
            pue,
            gridCarbonIntensity: selectedCountry.environment.gridCarbonIntensity,
            coolingType: inputs.coolingType,
            renewableOption: 'none',
            fuelHours: 50,
            genType: 'diesel',
            countryName: selectedCountry.name,
        });

        return calculateBenchmark({
            itLoadKw: inputs.itLoad,
            coolingType: inputs.coolingType,
            tierLevel: inputs.tierLevel,
            totalStaff,
            turnoverRate: inputs.turnoverRate || 0.15,
            totalCapex: capexResult.total,
            annualOpex,
            irr: financialResult.irr,
            paybackYears: financialResult.paybackPeriodYears,
            pue,
            annualCO2: carbonResult.annualEmissionsTonCO2,
            gridCarbonIntensity: selectedCountry.environment.gridCarbonIntensity,
            renewablePct: 0,
        });
    }, [selectedCountry, inputs, capexStore.inputs, effectiveInputs]);

    /* #334b — live engine values for the corpus position markers (PUE/CAPEX
     * from the real CapexEngine run, not a static matrix lookup). */
    const capexLive = useMemo(() => calculateCapex(capexStore.inputs), [capexStore.inputs]);

    if (!result || !selectedCountry) {
        return (
            <div className="text-center py-20 text-slate-500 dark:text-slate-400">
                <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a country to generate benchmark analysis.</p>
            </div>
        );
    }

    const tabs: { id: BenchmarkTab; label: string }[] = [
        { id: 'scorecard', label: 'Scorecard' },
        { id: 'detailed', label: 'Detailed Metrics' },
        { id: 'strengths', label: 'Strengths & Gaps' },
        { id: 'comparison', label: 'Industry Comparison' },
    ];

    /* #334 → #334b — CORPUS DISTRIBUTIONS: posisi proyek dalam distribusi publik
     * multi-sumber (DATA.benchmarksCorpus — setiap fakta ber-source_url+kutipan),
     * kini per metrik × SEMUA segmen (finance/hyperscale/pm/research/spec) dengan
     * persentil proyek terinterpolasi dari nilai engine live. */
    type CorpusDist = { n: number; unit: string; p10: number; p25: number; p50: number; p75: number; p90: number; companies: string[]; sources: number };
    const corpusData = (rzData() as { benchmarksCorpus?: Record<string, Record<string, CorpusDist>> }).benchmarksCorpus ?? {};
    const projPue = capexLive.pue;                                   // live CapexEngine PUE (cooling-type driven)
    const projCapexB = capexLive.total / 1e9;                        // live total CAPEX in $B
    const projWue = result.metrics.find((m) => m.metric.id === 'wue')?.userValue ?? null;
    const projRenew = result.metrics.find((m) => m.metric.id === 'renewable_pct')?.userValue ?? null;
    /* lowerIsBetter hanya anotasi arah — persentil tetap posisi distribusi mentah */
    const corpusMetricDefs: { key: string; label: string; project: number | null; projectNote?: string; fmt: (v: number) => string }[] = [
        { key: 'pue', label: 'PUE', project: projPue, fmt: (v) => v.toFixed(2) },
        { key: 'wue', label: 'WUE', project: projWue, fmt: (v) => v.toFixed(2) },
        { key: 'capacity_mw', label: 'Site Capacity', project: inputs.itLoad / 1000, fmt: (v) => v.toLocaleString(undefined, { maximumFractionDigits: 1 }) },
        { key: 'investment_busd', label: 'Investment (total)', project: projCapexB, projectNote: 'total project CAPEX — corpus = announced investment value per document ($B), not $/MW (a percentile ratio cannot be derived honestly)', fmt: (v) => v.toLocaleString(undefined, { maximumFractionDigits: 1 }) },
        { key: 'renewable_share', label: 'Renewable Share', project: projRenew, fmt: (v) => v.toLocaleString(undefined, { maximumFractionDigits: 1 }) },
    ];
    /* interpolasi linear piecewise antar titik p10..p90 → "~pXX" — SHARED
     * module (lib/calibration.ts pctileLabelOf): satu algoritma untuk marker
     * korpus INI, section Model Calibration, dan gate test-model-calibration. */
    const pctileOf = (v: number, d: CorpusDist): { label: string; approx: number } => pctileLabelOf(v, d);
    const corpusGroups = corpusMetricDefs
        .map((def) => ({ def, segs: Object.entries(corpusData[def.key] ?? {}) }))
        .filter((g) => g.segs.length > 0);

    return (
        <div className="space-y-6">
            {/* #334b — corpus distributions (metric × segment) */}
            {corpusGroups.length > 0 && (
                <div className="rounded border border-emerald-500/30 bg-white dark:bg-slate-900/50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Corpus Distributions — Project Position vs Multi-Source Public Corpus</h3>
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-medium uppercase text-emerald-500">live corpus</span>
                    </div>
                    <div className="space-y-4">
                        {corpusGroups.map(({ def, segs }) => (
                            <div key={def.key}>
                                <div className="flex items-baseline gap-2 text-[11px]">
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">{def.label}</span>
                                    <span className="text-[9px] text-slate-400">({segs[0][1].unit})</span>
                                    {def.project != null && (
                                        <span className="rounded bg-rz-mint/15 px-1.5 py-0.5 text-[9px] font-semibold text-rz-mint" title={def.projectNote}>
                                            your project: {def.fmt(def.project)} {segs[0][1].unit}
                                        </span>
                                    )}
                                </div>
                                {def.projectNote && <div className="mt-0.5 text-[9px] italic text-slate-400">{def.projectNote}</div>}
                                <div className="mt-1.5 space-y-2">
                                    {segs.map(([seg, d]) => {
                                        const span = Math.max(1e-9, d.p90 - d.p10);
                                        const pos = def.project != null ? Math.min(100, Math.max(0, ((def.project - d.p10) / span) * 100)) : null;
                                        const rank = def.project != null ? pctileOf(def.project, d) : null;
                                        return (
                                            <div key={seg} className="pl-2">
                                                <div className="flex flex-wrap items-baseline gap-2 text-[11px]">
                                                    <span className="w-24 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-center text-[9px] font-medium uppercase tracking-wide text-slate-500">{seg}</span>
                                                    <span className="tabular-nums text-slate-500">n={d.n} · p10 {d.p10.toLocaleString()} · p50 <b className="text-slate-900 dark:text-white">{d.p50.toLocaleString()}</b> · p90 {d.p90.toLocaleString()}</span>
                                                    {d.n < 5 && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400">small n — indicative</span>}
                                                    {rank != null && (
                                                        <span className="ml-auto rounded bg-rz-mint/15 px-1.5 py-0.5 text-[9px] font-semibold text-rz-mint">
                                                            {def.label} {def.fmt(def.project as number)} = percentile {rank.label} in {seg} (n={d.n})
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="relative mt-1 h-2 rounded bg-slate-100 dark:bg-slate-800">
                                                    <div className="absolute h-2 rounded bg-emerald-500/30" style={{ left: `${((d.p25 - d.p10) / span) * 100}%`, width: `${((d.p75 - d.p25) / span) * 100}%` }} />
                                                    <div className="absolute top-[-2px] h-3 w-0.5 bg-slate-400" style={{ left: `${((d.p50 - d.p10) / span) * 100}%` }} />
                                                    {pos != null && <div className="absolute top-[-3px] h-4 w-1 rounded bg-rz-mint" style={{ left: `${pos}%` }} title={`Your project: ${def.fmt(def.project as number)} ${d.unit} (${rank?.label})`} />}
                                                </div>
                                                <div className="mt-0.5 text-[9px] text-slate-400">{d.sources} documents · {d.companies.slice(0, 4).join(', ')}{d.companies.length > 4 ? ` +${d.companies.length - 4}` : ''}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="mt-2 text-[9px] text-slate-400">p10–p90 distribution from the multi-source public corpus (DATA.benchmarksCorpus, {Object.values(corpusData).reduce((s, m) => s + Object.values(m).reduce((t, d) => t + d.n, 0), 0)} facts with source_url + verbatim quote, gate-enforced). Project percentile = linear interpolation between percentile points — a marker outside the p10–p90 range is shown as &lt;p10 / &gt;p90. Per-fact drill-down: Data Library → DC Corpus.</p>
                </div>
            )}
            {/* Arc-1 — MODEL CALIBRATION: konstanta engine vs korpus dunia nyata.
             * Sumber tunggal DATA.calibrationSpec; semantik rule identik dengan
             * gate tools/test-model-calibration.mjs (lib/calibration.ts). */}
            {calib && calib.rows.length > 0 && (
                <div ref={calibCardRef} className="rounded border border-cyan-500/30 bg-white dark:bg-slate-900/50 p-4">
                    <div className="flex w-full items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setCalibOpen((o) => !o)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                            <ChevronDown className={clsx('h-3.5 w-3.5 text-slate-400 transition-transform', !calibOpen && '-rotate-90')} />
                            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Model Calibration — engine vs real world</h3>
                            <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[9px] font-medium uppercase text-cyan-500">gate-mirrored</span>
                            <span className="ml-auto flex items-center gap-1">
                                {calib.rows.map((r) => (
                                    <span
                                        key={r.id}
                                        className={clsx(
                                            'h-1.5 w-1.5 rounded-full',
                                            r.verdict === 'in-band' ? 'bg-emerald-500' : r.verdict === 'drift' ? 'bg-rose-500' : 'bg-slate-400',
                                        )}
                                        title={`${r.id}: ${r.verdict}`}
                                    />
                                ))}
                            </span>
                        </button>
                        {/* Diagnostics Tier-1: drift is no longer tooltip-only — a
                          * visible chip opens the per-mapping correction panel. */}
                        {driftRows.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    setCalibOpen(true);
                                    setDriftRowOpen(driftRows[0].id);
                                    window.setTimeout(() => calibTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
                                }}
                                title={`${driftRows.length} mappings drift against the live corpus band — click for engine vs band detail + correction direction.`}
                                className="shrink-0 rounded bg-rose-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-rose-600 hover:bg-rose-500/25 dark:text-rose-400"
                            >
                                ⚠ {driftRows.length} drift
                            </button>
                        )}
                    </div>
                    {calibOpen && (
                        <div className="mt-3 space-y-4">
                            <div ref={calibTableRef} className="overflow-x-auto">
                                <table className="w-full text-[10px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-[9px] uppercase tracking-wide text-slate-400">
                                            <th className="py-1.5 pr-3 font-medium">Engine constant</th>
                                            <th className="py-1.5 pr-3 font-medium">Corpus</th>
                                            <th className="py-1.5 pr-3 font-medium">Position / ratio</th>
                                            <th className="py-1.5 pr-3 font-medium">Verdict</th>
                                            <th className="py-1.5 font-medium">Limitation</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {calib.rows.map((r) => {
                                            const traceId = r.id === 'pue.design.vs.fleet' ? 'calib.pueLiquidPctile'
                                                : r.id === 'capex.aggregate.ratio' ? 'calib.capexRatioFinance' : null;
                                            const posEl = (
                                                <span className="tabular-nums text-slate-700 dark:text-slate-300">{r.positionText}</span>
                                            );
                                            return (
                                                <React.Fragment key={r.id}>
                                                    <tr className="border-b border-slate-100 align-top dark:border-slate-800">
                                                        <td className="py-2 pr-3">
                                                            <div className="font-medium text-slate-800 dark:text-slate-100">{r.engineLabel}</div>
                                                            <div className="mt-0.5 tabular-nums text-slate-500">{r.engineValueText}</div>
                                                            <div className="mt-0.5 text-[9px] text-slate-400">{r.engineSource}</div>
                                                        </td>
                                                        <td className="py-2 pr-3 tabular-nums text-slate-500">{r.corpusLabel}</td>
                                                        <td className="py-2 pr-3">
                                                            {traceId ? <TraceValue traceId={traceId}>{posEl}</TraceValue> : posEl}
                                                            <div className="mt-0.5 text-[9px] italic text-slate-400">{r.basisNote}</div>
                                                        </td>
                                                        <td className="py-2 pr-3">
                                                            {r.verdict === 'drift' ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setDriftRowOpen((o) => (o === r.id ? null : r.id))}
                                                                    title="Click for drift detail: engine vs live corpus band + correction direction."
                                                                    className="cursor-pointer rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-rose-600 underline decoration-dotted underline-offset-2 hover:bg-rose-500/25 dark:text-rose-400"
                                                                >{r.verdict}</button>
                                                            ) : (
                                                                <span className={clsx(
                                                                    'rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase',
                                                                    r.verdict === 'in-band' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                                                                    r.verdict === 'indicative' && 'bg-slate-500/15 text-slate-500 dark:text-slate-400',
                                                                )}>{r.verdict}</span>
                                                            )}
                                                            <div className="mt-0.5 text-[9px] text-slate-400">tier {r.severity} · {r.checks.filter((c) => c.ok).length}/{r.checks.length} checks</div>
                                                        </td>
                                                        <td className="py-2 text-[9px] text-slate-400">{r.limitation}</td>
                                                    </tr>
                                                    {r.verdict === 'drift' && driftRowOpen === r.id && (
                                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                                            <td colSpan={5} className="p-0">
                                                                <div className="m-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-left dark:border-rose-800/40 dark:bg-rose-950/20">
                                                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                                                                        Drift — {r.id} ({r.engineLabel})
                                                                    </div>
                                                                    <div className="mt-1.5 grid gap-1 text-[10px] text-slate-600 dark:text-slate-300 md:grid-cols-2">
                                                                        <div><span className="text-slate-400">Engine value: </span><span className="tabular-nums">{r.engineValueText}</span></div>
                                                                        <div><span className="text-slate-400">Live corpus band: </span><span className="tabular-nums">{r.corpusLabel}</span></div>
                                                                    </div>
                                                                    <div className="mt-2 space-y-1">
                                                                        {r.checks.filter((c) => !c.ok).map((c, ci) => (
                                                                            <div key={ci} className="rounded border border-rose-200/70 bg-white/70 p-1.5 text-[10px] dark:border-rose-800/40 dark:bg-slate-900/50">
                                                                                <div className="font-mono text-rose-600 dark:text-rose-400">✗ {c.label}</div>
                                                                                <div className="mt-0.5 text-slate-500 dark:text-slate-400">{driftCorrectionOf(c.label)}</div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    <p className="mt-2 text-[9px] italic text-slate-500 dark:text-slate-400">
                                                                        Drift policy: findings are REPORTED (CHANGELOG + the <span className="font-mono">tools/test-model-calibration.mjs</span> gate goes red
                                                                        for a fail tier) — the corpus band is NEVER quietly loosened.
                                                                    </p>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => calibCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                                                        className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-cyan-600 hover:underline dark:text-cyan-400"
                                                                    >
                                                                        <ArrowUpRight className="h-3 w-3" /> Model Calibration section (methodology &amp; full table)
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {calib.notMappable.length > 0 && (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/40">
                                    <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Not calibratable &amp; why</div>
                                    <ul className="mt-1 space-y-0.5 text-[10px] text-slate-500">
                                        {calib.notMappable.map((nm) => (
                                            <li key={nm.metric}><b className="text-slate-600 dark:text-slate-300">{nm.metric}</b> — {nm.reason}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <p className="text-[9px] text-slate-400">
                                Drift policy: the band references LIVE corpus percentiles — a corpus regen can shift the verdict. Drift findings are REPORTED
                                (CHANGELOG + the <span className="font-mono">tools/test-model-calibration.mjs</span> gate goes red for a fail tier), the band is never
                                quietly loosened. Aggregate validation only — corpus facts are not paired per document, so per-project calibration is not feasible.
                                Methodology: standarization/MODEL_CALIBRATION_STANDARD.md.
                            </p>
                        </div>
                    )}
                </div>
            )}
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-rz-mint/10 rounded-lg">
                            <Target className="w-6 h-6 text-rz-mint" />
                        </div>
                        Industry Benchmarks
                        <InfoTooltip content={TOOLTIP_TEXTS.industryBenchmarks} />
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Compare your configuration against industry standards
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                    <Info className="w-3.5 h-3.5" />
                    Tier {inputs.tierLevel} | {selectedCountry.name} | {inputs.itLoad.toLocaleString()} kW
                    <InfoTooltip content={TOOLTIP_TEXTS.configBadge} />
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all',
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'scorecard' && <ScorecardTab result={result} tier={inputs.tierLevel} coolingType={inputs.coolingType} />}
            {activeTab === 'detailed' && <DetailedTab metrics={result.metrics} tier={inputs.tierLevel} />}
            {activeTab === 'strengths' && <StrengthsTab result={result} />}
            {activeTab === 'comparison' && <ComparisonTab metrics={result.metrics} />}
        </div>
    );
}

// ─── SCORECARD TAB ──────────────────────────────────────────

function ScorecardTab({ result, tier, coolingType }: { result: ReturnType<typeof calculateBenchmark>; tier: 2 | 3 | 4; coolingType: string }) {
    const gradeColor = GRADE_COLORS[result.overallGrade];
    /* Diagnostics Tier-1: red/orange grade (ALERT_GRADES = same set the ring
     * ternary colours orange/red) is clickable → computed contributors + levers
     * from the live model (template: PhasedFinancialDashboard red KPIs). */
    const [gradeOpen, setGradeOpen] = useState(false);
    const diag = useMemo(
        () => (isAlertGrade(result.overallGrade) ? computeGradeDiagnostics(result, tier, coolingType) : null),
        [result, tier, coolingType],
    );

    return (
        <div className="space-y-6">
            {/* Overall Score Ring */}
            <div className="bg-white dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-700 p-8 text-center">
                <div className="inline-flex flex-col items-center">
                    <div className="relative w-40 h-40">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-200 dark:text-slate-700" />
                            <circle
                                cx="60" cy="60" r="52" fill="none" strokeWidth="8"
                                strokeDasharray={`${(result.overallScore / 100) * 327} 327`}
                                strokeLinecap="round"
                                className={result.overallGrade === 'A' ? 'text-emerald-500' : result.overallGrade === 'B' ? 'text-blue-500' : result.overallGrade === 'C' ? 'text-yellow-500' : result.overallGrade === 'D' ? 'text-orange-500' : 'text-red-500'}
                                stroke="currentColor"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span
                                className={clsx(
                                    'text-4xl font-bold',
                                    gradeColor.text,
                                    gradeColor.darkText,
                                    diag && 'cursor-pointer underline decoration-dotted underline-offset-8',
                                )}
                                title={diag ? `Grade ${result.overallGrade} — click to see the worst contributors + improvement levers computed from the live model.` : undefined}
                                onClick={diag ? () => setGradeOpen((o) => !o) : undefined}
                            >{result.overallGrade}</span>
                            <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-0.5">{result.overallScore}/100 <InfoTooltip content={TOOLTIP_TEXTS.overallScore} /></span>
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 flex items-center justify-center gap-1">
                        Overall Benchmark Score
                        <InfoTooltip content={TOOLTIP_TEXTS.overallGrade} />
                    </p>
                </div>
                {diag && gradeOpen && (
                    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-left dark:border-red-800/40 dark:bg-red-950/20">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">Why grade {result.overallGrade}?</span>
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">{diag.formulaNote}</p>
                        <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Worst contributors (live model)</div>
                        <div className="mt-1.5 space-y-1">
                            {diag.dragging.slice(0, 4).map((m) => (
                                <div key={m.metric.id} className="flex items-center gap-2 text-xs">
                                    <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-bold', GRADE_COLORS[m.grade].bg, GRADE_COLORS[m.grade].text, GRADE_COLORS[m.grade].darkBg, GRADE_COLORS[m.grade].darkText)}>{m.grade}</span>
                                    <span className="text-slate-700 dark:text-slate-300">{m.metric.name}</span>
                                    <span className="ml-auto font-mono tabular-nums text-slate-500 dark:text-slate-400">{formatMetricValue(m.userValue, m.metric.unit)} · p{Math.round(m.percentile)}</span>
                                </div>
                            ))}
                        </div>
                        {diag.levers.length > 0 && (
                            <>
                                <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Computed improvement levers (from the live model, not generic)</div>
                                <div className="mt-1.5 space-y-1.5">
                                    {diag.levers.map((lv, i) => (
                                        <div key={i} className="flex items-start gap-2 rounded-md border border-slate-200 bg-white/70 p-2 dark:border-slate-700 dark:bg-slate-900/50">
                                            <span className="shrink-0 whitespace-nowrap rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{lv.label}</span>
                                            <span className="flex-1 text-[11px] leading-snug text-slate-600 dark:text-slate-400">{lv.detail}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Category Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {(Object.entries(BENCHMARK_CATEGORIES) as [BenchmarkCategory, typeof BENCHMARK_CATEGORIES[BenchmarkCategory]][]).map(([catId, cat]) => {
                    const catScore = result.categoryScores[catId];
                    const gc = GRADE_COLORS[catScore.grade];
                    return (
                        <div key={catId} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-center gap-0.5">{cat.label} <InfoTooltip content={CATEGORY_TOOLTIP_MAP[catId]} /></div>
                            <div className={clsx('text-2xl font-bold flex items-center justify-center gap-1', gc.text, gc.darkText)}>{catScore.grade} <InfoTooltip content={TOOLTIP_TEXTS.metricGrade} /></div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center justify-center gap-0.5">{catScore.score}/100 <InfoTooltip content={TOOLTIP_TEXTS.categoryScore} /></div>
                            <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={clsx('h-full rounded-full transition-all', catScore.grade === 'A' ? 'bg-emerald-500' : catScore.grade === 'B' ? 'bg-blue-500' : catScore.grade === 'C' ? 'bg-yellow-500' : catScore.grade === 'D' ? 'bg-orange-500' : 'bg-red-500')}
                                    style={{ width: `${catScore.score}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Quick Summary */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Trophy className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">Top Strengths</span>
                        <InfoTooltip content={TOOLTIP_TEXTS.topStrengths} />
                    </div>
                    <div className="space-y-2">
                        {result.strengths.map((s, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                                <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded', GRADE_COLORS[s.grade].bg, GRADE_COLORS[s.grade].text, GRADE_COLORS[s.grade].darkBg, GRADE_COLORS[s.grade].darkText)}>{s.grade}</span>
                                <span className="text-slate-700 dark:text-slate-300">{s.metric}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">Improvement Areas</span>
                        <InfoTooltip content={TOOLTIP_TEXTS.improvementAreas} />
                    </div>
                    <div className="space-y-2">
                        {result.improvements.map((s, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                                <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded', GRADE_COLORS[s.grade].bg, GRADE_COLORS[s.grade].text, GRADE_COLORS[s.grade].darkBg, GRADE_COLORS[s.grade].darkText)}>{s.grade}</span>
                                <span className="text-slate-700 dark:text-slate-300">{s.metric}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── DETAILED METRICS TAB ───────────────────────────────────

function DetailedTab({ metrics, tier }: { metrics: MetricScore[]; tier: 2 | 3 | 4 }) {
    const grouped = useMemo(() => {
        const groups: Record<BenchmarkCategory, MetricScore[]> = { energy: [], staffing: [], financial: [], availability: [], carbon: [] };
        for (const m of metrics) groups[m.metric.category].push(m);
        return groups;
    }, [metrics]);

    return (
        <div className="space-y-6">
            {(Object.entries(grouped) as [BenchmarkCategory, MetricScore[]][]).map(([catId, catMetrics]) => (
                <div key={catId} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1">{BENCHMARK_CATEGORIES[catId].label} <InfoTooltip content={CATEGORY_TOOLTIP_MAP[catId]} /></h3>
                    </div>
                    <div className="p-5 space-y-5">
                        {catMetrics.map(m => (
                            <BulletChart key={m.metric.id} score={m} tier={tier} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function BulletChart({ score, tier }: { score: MetricScore; tier: 2 | 3 | 4 }) {
    const b = score.tierBenchmarks;
    const { metric, userValue, percentile, grade } = score;
    const gc = GRADE_COLORS[grade];

    // Determine chart range
    const allValues = [b.p10, b.p25, b.median, b.p75, b.p90, userValue];
    const minVal = Math.min(...allValues) * 0.8;
    const maxVal = Math.max(...allValues) * 1.2;
    const range = maxVal - minVal;
    const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - minVal) / range) * 100))}%`;

    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{metric.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">({metric.unit})</span>
                    <InfoTooltip content={TOOLTIP_TEXTS.metrics[metric.id] || metric.description} />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-300">
                        {formatMetricValue(userValue, metric.unit)}
                    </span>
                    <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded', gc.bg, gc.text, gc.darkBg, gc.darkText)}>
                        {grade}
                    </span>
                    <InfoTooltip content={TOOLTIP_TEXTS.percentileRank} />
                </div>
            </div>
            {/* Bullet bar */}
            <div className="relative h-6 bg-slate-100 dark:bg-slate-700/50 rounded overflow-hidden">
                {/* Benchmark zones */}
                <div className="absolute inset-y-0 bg-emerald-200 dark:bg-emerald-900/40 rounded-l" style={{ left: pct(Math.min(b.p10, b.p90)), width: pct(Math.abs(b.p25 - Math.min(b.p10, b.p90)) + minVal) }} />
                <div className="absolute inset-y-0 bg-blue-200 dark:bg-blue-900/30" style={{ left: pct(Math.min(b.p25, b.p75)), width: `calc(${pct(Math.max(b.p25, b.p75))} - ${pct(Math.min(b.p25, b.p75))})` }} />
                {/* Median marker */}
                <div className="absolute inset-y-0 w-0.5 bg-slate-400 dark:bg-slate-500" style={{ left: pct(b.median) }} />
                {/* User value marker */}
                <div
                    className="absolute top-0.5 bottom-0.5 w-2.5 rounded-sm bg-cyan-600 dark:bg-cyan-400 shadow-sm"
                    style={{ left: `calc(${pct(userValue)} - 5px)` }}
                />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                <span className="flex items-center gap-0.5">P10: {formatMetricValue(b.p10, metric.unit)}</span>
                <span className="flex items-center gap-0.5">Median: {formatMetricValue(b.median, metric.unit)} <InfoTooltip content={TOOLTIP_TEXTS.bulletChart} /></span>
                <span className="flex items-center gap-0.5">P90: {formatMetricValue(b.p90, metric.unit)}</span>
            </div>
        </div>
    );
}

// ─── STRENGTHS & GAPS TAB ───────────────────────────────────

function StrengthsTab({ result }: { result: ReturnType<typeof calculateBenchmark> }) {
    return (
        <div className="grid grid-cols-2 gap-6">
            {/* Strengths */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-emerald-500" />
                    Top 3 Strengths
                    <InfoTooltip content={TOOLTIP_TEXTS.strengthsHeading} />
                </h3>
                {result.strengths.map((s, i) => {
                    const gc = GRADE_COLORS[s.grade];
                    return (
                        <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={clsx('text-xs font-bold px-2 py-0.5 rounded', gc.bg, gc.text, gc.darkBg, gc.darkText)}>{s.grade}</span>
                                <span className="text-sm font-semibold text-slate-900 dark:text-white">{s.metric}</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{s.detail}</p>
                        </div>
                    );
                })}
            </div>

            {/* Improvements */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                    Top 3 Improvement Areas
                    <InfoTooltip content={TOOLTIP_TEXTS.gapsHeading} />
                </h3>
                {result.improvements.map((s, i) => {
                    const gc = GRADE_COLORS[s.grade];
                    return (
                        <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={clsx('text-xs font-bold px-2 py-0.5 rounded', gc.bg, gc.text, gc.darkBg, gc.darkText)}>{s.grade}</span>
                                <span className="text-sm font-semibold text-slate-900 dark:text-white">{s.metric}</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{s.detail}</p>
                            <div className="flex items-start gap-1.5 text-xs text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-2">
                                <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                <span>{s.recommendation}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── INDUSTRY COMPARISON TABLE ──────────────────────────────

function ComparisonTab({ metrics }: { metrics: MetricScore[] }) {
    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                            <th className="text-left px-4 py-3 font-semibold text-slate-900 dark:text-white"><span className="flex items-center gap-1">Metric <InfoTooltip content={TOOLTIP_TEXTS.compMetric} /></span></th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-900 dark:text-white"><span className="flex items-center justify-center gap-1">Your Value <InfoTooltip content={TOOLTIP_TEXTS.compYourValue} /></span></th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400"><span className="flex items-center justify-center gap-0.5">P10 <InfoTooltip content={TOOLTIP_TEXTS.compPercentiles} /></span></th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400">P25</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400">Median</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400">P75</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-500 dark:text-slate-400">P90</th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-900 dark:text-white"><span className="flex items-center justify-center gap-1">Rank <InfoTooltip content={TOOLTIP_TEXTS.compRank} /></span></th>
                            <th className="text-center px-3 py-3 font-semibold text-slate-900 dark:text-white"><span className="flex items-center justify-center gap-1">Grade <InfoTooltip content={TOOLTIP_TEXTS.compGrade} /></span></th>
                            <th className="text-left px-3 py-3 font-semibold text-slate-500 dark:text-slate-400"><span className="flex items-center gap-1">Source <InfoTooltip content={TOOLTIP_TEXTS.compSource} /></span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {metrics.map((m, i) => {
                            const gc = GRADE_COLORS[m.grade];
                            const b = m.tierBenchmarks;
                            return (
                                <tr key={m.metric.id} className={clsx('border-b border-slate-100 dark:border-slate-800', i % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-slate-50/50 dark:bg-slate-800/20')}>
                                    <td className="px-4 py-2.5">
                                        <div className="font-medium text-slate-900 dark:text-white text-xs flex items-center gap-0.5">{m.metric.name} <InfoTooltip content={TOOLTIP_TEXTS.metrics[m.metric.id] || m.metric.description} /></div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{m.metric.unit}</div>
                                    </td>
                                    <td className="text-center px-3 py-2.5 font-mono font-semibold text-cyan-700 dark:text-cyan-400 text-xs">{formatMetricValue(m.userValue, m.metric.unit)}</td>
                                    <td className="text-center px-3 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{formatMetricValue(b.p10, m.metric.unit)}</td>
                                    <td className="text-center px-3 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{formatMetricValue(b.p25, m.metric.unit)}</td>
                                    <td className="text-center px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-300 font-medium">{formatMetricValue(b.median, m.metric.unit)}</td>
                                    <td className="text-center px-3 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{formatMetricValue(b.p75, m.metric.unit)}</td>
                                    <td className="text-center px-3 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{formatMetricValue(b.p90, m.metric.unit)}</td>
                                    <td className="text-center px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300">P{Math.round(m.percentile)}</td>
                                    <td className="text-center px-3 py-2.5">
                                        <span className={clsx('text-xs font-bold px-2 py-0.5 rounded', gc.bg, gc.text, gc.darkBg, gc.darkText)}>{m.grade}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-[10px] text-slate-400 dark:text-slate-500 max-w-[140px] truncate">{m.metric.source}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function formatMetricValue(value: number, unit: string): string {
    if (unit === '%') return `${value.toFixed(1)}%`;
    if (unit === 'PUE') return value.toFixed(2);
    if (unit === '$/kW' || unit === '$/kW/yr') return `$${Math.round(value).toLocaleString()}`;
    if (unit === 'years') return `${value.toFixed(1)}`;
    if (unit === 'hours') return `${value.toFixed(1)}`;
    if (unit === 'FTE/MW') return value.toFixed(1);
    if (unit === 'L/kWh' || unit === 'kgCO2/kWh') return value.toFixed(2);
    if (unit === 'tCO2/MW/yr') return Math.round(value).toLocaleString();
    return value.toFixed(2);
}
