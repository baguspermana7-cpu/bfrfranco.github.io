'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { calculateCompliance, ComplianceResult, ComplianceCategory, ComplianceItem } from '@/modules/compliance/ComplianceEngine';
import { COUNTRIES, CountryProfile } from '@/constants/countries';
import { ClipboardCheck, Shield, DollarSign, AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react';
import clsx from 'clsx';
import { fmtMoney, fmtMoneyFull } from '@/lib/format';
import { Tooltip } from '@/components/ui/Tooltip';
import { ScoreValue } from '@/components/ui/ScoreValue';
import { TraceValue } from '@/components/ui/TraceValue';

/* ─── Score thresholds — SINGLE source for colouring, click-gating, and the
 * diagnostics collector. Mirrors the colour bands that were previously
 * hardcoded inline (≥80 emerald · 60–79 amber · <60 red). ─────────────────── */
const SCORE_GOOD = 80;
const SCORE_CRITICAL = 60;
/** Mirrors ComplianceEngine's internal `maxItems` coverage benchmark.
 *  Runtime-verified: `formulaVerified` re-derives the engine score from these
 *  constants and flags drift instead of showing wrong lever numbers. */
const SCORE_MAX_ITEMS = 14;
/** Richest documented framework in the engine (13 items) — used as the
 *  coverage benchmark to name WHICH mandatory items are not yet covered. */
const BENCHMARK_COUNTRY_ID = 'ID';

/** The engine's own score formula (ComplianceEngine.calculateCompliance):
 *  round(min(100, count/14 × 100) × 0.6 + mandatory/count × 40), capped at 100. */
const scoreFromCounts = (count: number, mandatoryCount: number): number => {
    const coverage = Math.min(100, (count / SCORE_MAX_ITEMS) * 100);
    const ratio = mandatoryCount / Math.max(1, count);
    return Math.min(100, Math.round(coverage * 0.6 + ratio * 40));
};

interface CategoryGap {
    category: ComplianceCategory;
    label: string;
    activeCount: number;
    benchmarkCount: number;
}

interface ComplianceScoreDiagnostics {
    score: number;
    count: number;
    mandatoryCount: number;
    optionalCount: number;
    /** Coverage contribution: min(100, count/14×100) × 0.6 — of 60 pts. */
    coveragePts: number;
    /** Mandatory-ratio contribution: mandatory/count × 40 — of 40 pts. */
    mandatoryPts: number;
    /** True when re-deriving the score from the mirrored formula matches the engine. */
    formulaVerified: boolean;
    /** Categories where the active framework has fewer items than the benchmark. */
    categoryGaps: CategoryGap[];
    /** Benchmark mandatory items beyond the active framework's per-category depth. */
    missingMandatory: ComplianceItem[];
    /** Engine costs of completing `missingMandatory`. */
    addInitialCost: number;
    addAnnualCost: number;
    /** Score after adding the missing mandatory items — SAME formula. */
    projectedScore: number;
}

function buildScoreDiagnostics(country: CountryProfile, itLoadKw: number): ComplianceScoreDiagnostics {
    const result = calculateCompliance(country, itLoadKw);
    const count = result.totalCount;
    const mandatoryCount = result.mandatoryCount;
    const coveragePts = Math.min(100, (count / SCORE_MAX_ITEMS) * 100) * 0.6;
    const mandatoryPts = (mandatoryCount / Math.max(1, count)) * 40;
    const formulaVerified = scoreFromCounts(count, mandatoryCount) === result.complianceScore;

    const benchCountry = COUNTRIES[BENCHMARK_COUNTRY_ID];
    const bench = benchCountry && country.id !== BENCHMARK_COUNTRY_ID
        ? calculateCompliance(benchCountry, itLoadKw)
        : null;

    const categoryGaps: CategoryGap[] = [];
    const missingMandatory: ComplianceItem[] = [];
    if (bench) {
        const benchCategories = [...new Set(bench.items.map(i => i.category))];
        for (const cat of benchCategories) {
            const benchItems = bench.items.filter(i => i.category === cat);
            const activeCount = result.items.filter(i => i.category === cat).length;
            if (benchItems.length > activeCount) {
                categoryGaps.push({
                    category: cat,
                    label: bench.categoryBreakdown.find(c => c.category === cat)?.label ?? cat,
                    activeCount,
                    benchmarkCount: benchItems.length,
                });
                missingMandatory.push(...benchItems.slice(activeCount).filter(i => i.mandatory));
            }
        }
    }

    const addInitialCost = missingMandatory.reduce((s, i) => s + i.initialCost, 0);
    const addAnnualCost = missingMandatory.reduce((s, i) => s + i.annualCost, 0);
    const projectedScore = scoreFromCounts(count + missingMandatory.length, mandatoryCount + missingMandatory.length);

    return {
        score: result.complianceScore,
        count,
        mandatoryCount,
        optionalCount: count - mandatoryCount,
        coveragePts,
        mandatoryPts,
        formulaVerified,
        categoryGaps,
        missingMandatory,
        addInitialCost,
        addAnnualCost,
        projectedScore,
    };
}

/* ─── Diagnostics collector (Tier-1) — pure, engine-backed, no React ──────── */
export interface Finding {
    surface: string;
    severity: 'critical' | 'warning' | 'info';
    metric: string;
    value: number;
    threshold: number;
    linkTab: 'compliance';
}

export interface ComplianceDiagnosticsModel {
    selectedCountry: CountryProfile | null;
    itLoadKw: number;
}

/** Emits a Finding when the Compliance Coverage Score falls below the SAME
 *  thresholds used for colouring: <60 critical (red), 60–79 warning (amber). */
export function collectComplianceDiagnostics(model: ComplianceDiagnosticsModel): Finding[] {
    if (!model.selectedCountry) return [];
    const result = calculateCompliance(model.selectedCountry, model.itLoadKw);
    const score = result.complianceScore;
    if (score < SCORE_CRITICAL) {
        return [{
            surface: `Compliance Coverage Score — ${result.countryName}`,
            severity: 'critical',
            metric: 'complianceScore',
            value: score,
            threshold: SCORE_CRITICAL,
            linkTab: 'compliance',
        }];
    }
    if (score < SCORE_GOOD) {
        return [{
            surface: `Compliance Coverage Score — ${result.countryName}`,
            severity: 'warning',
            metric: 'complianceScore',
            value: score,
            threshold: SCORE_GOOD,
            linkTab: 'compliance',
        }];
    }
    return [];
}

const CATEGORY_COLORS: Record<ComplianceCategory, string> = {
    fire: 'bg-red-500',
    electrical: 'bg-amber-500',
    environmental: 'bg-green-500',
    building: 'bg-blue-500',
    'data-protection': 'bg-rz-mint',
    telecom: 'bg-cyan-500',
};

const CATEGORY_BG: Record<ComplianceCategory, string> = {
    fire: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800',
    electrical: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800',
    environmental: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800',
    building: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800',
    'data-protection': 'bg-rz-mint/10 dark:bg-rz-mint/5 border-rz-mint/30 dark:border-rz-mint/20',
    telecom: 'bg-cyan-50 dark:bg-cyan-900/10 border-cyan-200 dark:border-cyan-800',
};

export default function ComplianceDashboard() {
    const { selectedCountry, inputs } = useSimulationStore();
    const [activeCategory, setActiveCategory] = useState<ComplianceCategory | 'all'>('all');
    const [showScorePanel, setShowScorePanel] = useState(false);

    const result = useMemo<ComplianceResult | null>(() => {
        if (!selectedCountry) return null;
        return calculateCompliance(selectedCountry, inputs.itLoad);
    }, [selectedCountry, inputs.itLoad]);

    const diag = useMemo<ComplianceScoreDiagnostics | null>(() => {
        if (!selectedCountry) return null;
        return buildScoreDiagnostics(selectedCountry, inputs.itLoad);
    }, [selectedCountry, inputs.itLoad]);

    if (!result) return <div className="text-slate-500 text-center py-20">Select a country to begin.</div>;

    const filteredItems = activeCategory === 'all' ? result.items : result.items.filter(i => i.category === activeCategory);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-xl">
                        <ClipboardCheck className="w-6 h-6 text-emerald-500" />
                    </div>
                    Compliance Checklist — {result.countryName}
                </h2>
                <p className="text-sm text-slate-500 mt-1">Module 41 — Auto-generated regulatory requirements per country</p>
            </div>

            {/* KPIs — per-card node: score cells through ScoreValue (semantic
              * color), money cells through TraceValue (ƒx lineage, no bogus
              * color scale on money). */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Requirements', node: <ScoreValue value={result.totalCount} direction="higher" max={SCORE_MAX_ITEMS} className="text-2xl" trace={{
                        label: 'Total Requirements', value: result.totalCount, unit: ' items', provenance: 'engine', page: 'compliance',
                        formulaTemplate: 'Count of all regulatory + certification requirements applicable to this country = mandatory + optional, across fire, electrical, environmental, building, data-protection and telecom categories.',
                        deps: [
                            { label: 'Mandatory', value: result.mandatoryCount, unit: ' items', provenance: 'engine' },
                            { label: 'Optional', value: result.totalCount - result.mandatoryCount, unit: ' items', provenance: 'derived' },
                        ],
                    }} />, icon: ClipboardCheck, color: 'cyan', tip: 'Total number of regulatory and certification requirements applicable to this country, including fire, electrical, environmental, building, data-protection, and telecom categories.' },
                    { label: 'Mandatory', node: <ScoreValue value={result.mandatoryCount} direction="higher" max={result.totalCount} traceId="site.compMandatory" className="text-2xl" />, icon: AlertTriangle, color: 'amber', tip: 'Requirements that are legally mandatory — non-compliance may result in fines, operational shutdowns, or license revocations.' },
                    { label: 'Initial Cost', node: <span className="text-2xl font-bold text-slate-900 dark:text-white"><TraceValue traceId="site.compInitialCost">{fmtMoney(result.totalInitialCost)}</TraceValue></span>, icon: DollarSign, color: 'blue', tip: 'One-time compliance cost for certifications, inspections, equipment upgrades, and initial filing fees.' },
                    { label: 'Annual Cost', node: <span className="text-2xl font-bold text-slate-900 dark:text-white"><TraceValue traceId="site.compAnnualCost">{fmtMoney(result.totalAnnualCost)}</TraceValue></span>, icon: BarChart3, color: 'green', tip: 'Recurring annual cost for license renewals, periodic inspections, audits, and ongoing compliance monitoring.' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <kpi.icon className={`w-4 h-4 text-${kpi.color}-500`} />
                            <span className="text-xs text-slate-500">{kpi.label}</span>
                            <Tooltip content={kpi.tip} />
                        </div>
                        <div>{kpi.node}</div>
                    </div>
                ))}
            </div>

            {/* Compliance Score */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">Compliance Coverage Score <Tooltip content={`Weighted score (0-100): framework coverage (items/${SCORE_MAX_ITEMS}, weight 60) + mandatory ratio (weight 40). Score ≥${SCORE_GOOD} is good, ${SCORE_CRITICAL}-${SCORE_GOOD - 1} needs attention, <${SCORE_CRITICAL} is critical risk.`} /></h3>
                    {/* Score renders through ScoreValue (ƒx trace + Explain +
                      * semantic color). TraceValue is a REAL button, so the
                      * breakdown-panel toggle is a SIBLING "why? ▾" button
                      * (never nested) shown only when the score is below good. */}
                    <div className="flex items-center gap-2">
                        <ScoreValue value={result.complianceScore} unit="/100" direction="higher" max={100} traceId="site.compScore" explainKey="compliance-score" className="text-2xl" />
                        {result.complianceScore < SCORE_GOOD && (
                            <button
                                onClick={() => setShowScorePanel(v => !v)}
                                aria-expanded={showScorePanel}
                                className="text-[10px] text-slate-500 underline decoration-dotted underline-offset-2 hover:text-slate-700 dark:hover:text-slate-300">
                                why? {showScorePanel ? '▴' : '▾'}
                            </button>
                        )}
                    </div>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={clsx(
                        "h-full rounded-full transition-all",
                        result.complianceScore >= SCORE_GOOD ? "bg-emerald-500" : result.complianceScore >= SCORE_CRITICAL ? "bg-amber-500" : "bg-red-500"
                    )} style={{ width: `${result.complianceScore}%` }} />
                </div>

                {/* Score diagnostics panel — engine-formula breakdown + quantified lever */}
                {diag && showScorePanel && result.complianceScore < SCORE_GOOD && (
                    <div className={clsx(
                        "mt-4 rounded-lg border p-4 space-y-3",
                        result.complianceScore < SCORE_CRITICAL
                            ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                            : "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                    )}>
                        {/* Reason — live numbers from the engine's own formula */}
                        <div className="flex items-start gap-2">
                            <AlertTriangle className={clsx("w-4 h-4 mt-0.5 shrink-0", result.complianceScore < SCORE_CRITICAL ? "text-red-500" : "text-amber-500")} />
                            <p className="text-xs text-slate-700 dark:text-slate-300">
                                Score <b>{diag.score}</b> &lt; {result.complianceScore < SCORE_CRITICAL ? SCORE_CRITICAL : SCORE_GOOD} because
                                framework coverage is <b>{diag.count}/{SCORE_MAX_ITEMS}</b> documented items
                                (<b>{diag.coveragePts.toFixed(1)}</b> of 60 pts) + mandatory-ratio <b>{diag.mandatoryCount}/{diag.count}</b>
                                {' '}(<b>{diag.mandatoryPts.toFixed(1)}</b> of 40 pts) — ComplianceEngine formula: coverage ×0.6 + mandatory-ratio ×40.
                            </p>
                        </div>

                        {!diag.formulaVerified && (
                            <p className="text-[10px] text-red-600 dark:text-red-400">
                                ⚠ The formula mirror does not match the engine score — the lever figures below are indicative (the engine may have changed).
                            </p>
                        )}

                        {/* Which frameworks are not yet covered vs benchmark */}
                        {diag.categoryGaps.length > 0 && (
                            <div>
                                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Framework categories not yet on par with the engine benchmark ({COUNTRIES[BENCHMARK_COUNTRY_ID]?.name ?? BENCHMARK_COUNTRY_ID}, the most complete framework):
                                </p>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {diag.categoryGaps.map(g => (
                                        <span key={g.category} className="text-[10px] px-1.5 py-0.5 rounded bg-white/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                            <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_COLORS[g.category]}`} />
                                            {g.label} {g.activeCount}/{g.benchmarkCount}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Missing mandatory items with engine costs */}
                        {diag.missingMandatory.length > 0 ? (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[11px]">
                                        <thead>
                                            <tr className="text-slate-500">
                                                <th className="text-left py-1 font-medium">Uncovered mandatory item</th>
                                                <th className="text-left py-1 font-medium">Standard</th>
                                                <th className="text-right py-1 font-medium">Initial</th>
                                                <th className="text-right py-1 font-medium">Annual</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {diag.missingMandatory.map(item => (
                                                <tr key={item.id} className="border-t border-slate-200/60 dark:border-slate-700/60">
                                                    <td className="py-1 pr-2">
                                                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CATEGORY_COLORS[item.category]}`} />
                                                            {item.requirement}
                                                        </span>
                                                    </td>
                                                    <td className="py-1 pr-2 font-mono text-slate-500">{item.standard}</td>
                                                    <td className="py-1 text-right font-mono text-slate-700 dark:text-slate-300">{fmtMoneyFull(item.initialCost)}</td>
                                                    <td className="py-1 text-right font-mono text-slate-700 dark:text-slate-300">{fmtMoneyFull(item.annualCost)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Quantified lever — SAME formula, engine costs */}
                                <div className="flex items-start gap-2 rounded-md bg-white/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-2.5">
                                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
                                    <p className="text-xs text-slate-700 dark:text-slate-300">
                                        <b>Lever:</b> completing the <b>{diag.missingMandatory.length} mandatory items</b> above raises the score
                                        {' '}<b>{diag.score} → {diag.projectedScore}</b> (computed from the same formula:
                                        coverage {diag.count + diag.missingMandatory.length}/{SCORE_MAX_ITEMS} ×0.6 + mandatory-ratio
                                        {' '}{diag.mandatoryCount + diag.missingMandatory.length}/{diag.count + diag.missingMandatory.length} ×40).
                                        Total cost from the engine: <b>{fmtMoneyFull(diag.addInitialCost)}</b> initial + <b>{fmtMoneyFull(diag.addAnnualCost)}/yr</b>.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                The active framework is already on par with the benchmark per category — the remaining score gap comes from the engine's coverage constant
                                ({diag.count}/{SCORE_MAX_ITEMS} items) and the {diag.optionalCount} Optional items that hold down the mandatory-ratio.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Category Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {result.categoryBreakdown.map(cat => (
                    <button
                        key={cat.category}
                        onClick={() => setActiveCategory(activeCategory === cat.category ? 'all' : cat.category)}
                        className={clsx(
                            "p-3 rounded-xl border text-left transition-all",
                            CATEGORY_BG[cat.category],
                            activeCategory === cat.category && "ring-2 ring-offset-1 ring-cyan-500"
                        )}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[cat.category]}`} />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{cat.label}</span>
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white">{cat.count} items</div>
                        <div className="text-[10px] text-slate-500">{cat.mandatoryCount} mandatory • {fmtMoney(cat.annualCost)}/yr</div>
                    </button>
                ))}
            </div>

            {/* Requirements Table */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {activeCategory === 'all' ? 'All Requirements' : result.categoryBreakdown.find(c => c.category === activeCategory)?.label}
                        <span className="ml-2 text-slate-500 font-normal">({filteredItems.length})</span>
                    </h3>
                    {activeCategory !== 'all' && (
                        <button onClick={() => setActiveCategory('all')} className="text-xs text-cyan-600 hover:text-cyan-500">Show All</button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/80">
                                <th className="text-left px-4 py-2 text-slate-500 font-medium"><span className="flex items-center gap-1">Requirement <Tooltip content="Specific regulatory or certification requirement that applies to data center operations in this jurisdiction." /></span></th>
                                <th className="text-left px-4 py-2 text-slate-500 font-medium"><span className="flex items-center gap-1">Authority <Tooltip content="Government body, regulatory agency, or standards organization that enforces this requirement." /></span></th>
                                <th className="text-left px-4 py-2 text-slate-500 font-medium"><span className="flex items-center gap-1">Standard <Tooltip content="Reference standard code (e.g., IEC, NFPA, ISO) that defines the technical specification." /></span></th>
                                <th className="text-center px-4 py-2 text-slate-500 font-medium"><span className="flex items-center justify-center gap-1">Freq. <Tooltip content="Inspection or renewal frequency — how often compliance must be verified (annual, biennial, one-time)." /></span></th>
                                <th className="text-center px-4 py-2 text-slate-500 font-medium"><span className="flex items-center justify-center gap-1">Status <Tooltip content="Mandatory requirements are legally required. Optional requirements are best-practice recommendations." /></span></th>
                                <th className="text-right px-4 py-2 text-slate-500 font-medium"><span className="flex items-center justify-end gap-1">Initial <Tooltip content="One-time cost for initial certification, inspection, or equipment purchase." /></span></th>
                                <th className="text-right px-4 py-2 text-slate-500 font-medium"><span className="flex items-center justify-end gap-1">Annual <Tooltip content="Recurring annual cost for renewals, periodic inspections, and ongoing compliance." /></span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map((item, i) => (
                                <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[item.category]}`} />
                                            <span className="text-slate-800 dark:text-slate-200 font-medium">{item.requirement}</span>
                                        </div>
                                        {item.notes && <p className="text-[10px] text-slate-500 ml-4 mt-0.5">{item.notes}</p>}
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 text-xs">{item.authority}</td>
                                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 text-xs font-mono">{item.standard}</td>
                                    <td className="px-4 py-2.5 text-center">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">{item.frequency}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                        {item.mandatory ? (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold">MANDATORY</span>
                                        ) : (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">Optional</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-slate-800 dark:text-slate-200">{fmtMoney(item.initialCost)}</td>
                                    <td className="px-4 py-2.5 text-right font-mono text-slate-800 dark:text-slate-200">{fmtMoney(item.annualCost)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-slate-300 dark:border-slate-600 font-bold">
                                <td colSpan={5} className="px-4 py-2.5 text-slate-900 dark:text-white">Total</td>
                                <td className="px-4 py-2.5 text-right font-mono text-slate-900 dark:text-white">{fmtMoney(filteredItems.reduce((s, i) => s + i.initialCost, 0))}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-slate-900 dark:text-white">{fmtMoney(filteredItems.reduce((s, i) => s + i.annualCost, 0))}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
