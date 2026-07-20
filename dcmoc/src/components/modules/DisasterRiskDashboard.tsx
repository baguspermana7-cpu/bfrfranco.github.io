'use client';

import React, { useMemo, useState } from 'react';
import { REVENUE_PER_KW_MONTH } from '@/lib/screening';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { calculateDisasterRisk, DisasterRiskResult } from '@/modules/risk/DisasterRiskEngine';
import { COUNTRIES, CountryProfile } from '@/constants/countries';
import { rzModels, useEngineReady } from '@/lib/rz-engine';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import { CloudLightning, Shield, DollarSign, AlertTriangle, Waves, Mountain, Wind, Flame, ChevronDown, ChevronUp, ArrowUpRight } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { fmt, fmtMoney } from '@/lib/format';

const riskColors: Record<string, string> = {
    'Low': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    'Moderate': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    'High': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    'Extreme': 'text-red-400 bg-red-500/10 border-red-500/30',
};

/* ─── DIAGNOSTICS Tier-2 (standarization/DIAGNOSTICS_STANDARD.md) ───────────
 * Category thresholds — the SINGLE constant behind chip colouring (category →
 * riskColors), the guidance-panel gate AND the collector. Values mirror
 * DisasterRiskEngine's categorisation (score ≥70 Extreme, ≥45 High,
 * ≥20 Moderate); runtime PARITY is verified against result.riskCategory —
 * drift renders a warning chip instead of a silently wrong panel (rule 4). */
export const RISK_CAT_THRESHOLDS = { extreme: 70, high: 45, moderate: 20 } as const;

export const categoryFromScore = (score: number): DisasterRiskResult['riskCategory'] =>
    score >= RISK_CAT_THRESHOLDS.extreme ? 'Extreme'
        : score >= RISK_CAT_THRESHOLDS.high ? 'High'
            : score >= RISK_CAT_THRESHOLDS.moderate ? 'Moderate' : 'Low';

/** Amortization horizon for the structural adder — the engine's own
 *  totalRiskAdjustedCost amortizes `structuralCostAdder / 20`; PhasedFinancial
 *  folds the FULL adder into phase capex pro-rata IT load. Same constant here
 *  so the panel's $/yr hardening figure matches the engine convention. */
const STRUCTURAL_AMORT_YEARS = 20;

const HAZARD_LABELS: Record<string, string> = {
    seismic: 'Seismic', flood: 'Flood', typhoon: 'Typhoon/Cyclone',
    volcano: 'Volcano', tsunami: 'Tsunami', wildfire: 'Wildfire',
};

/** Country hazard classes → 0-1 hazard levels — the SAME mapping
 *  DisasterRiskEngine feeds `models.risk.geo`. Restated for the panel and
 *  PARITY-VERIFIED against the live composite (rounded engine risk must equal
 *  the rendered compositeScore) so any drift is reported, never hidden. */
const hazardLevelsFromCountry = (nd: CountryProfile['naturalDisaster']) => ({
    seismic: (nd?.seismicZone ?? 1) / 4,
    flood: nd?.floodRisk === 'extreme' ? 1 : nd?.floodRisk === 'high' ? 0.7 : nd?.floodRisk === 'moderate' ? 0.4 : 0.1,
    typhoon: nd?.typhoonRisk === 'high' ? 1 : nd?.typhoonRisk === 'moderate' ? 0.6 : nd?.typhoonRisk === 'low' ? 0.25 : 0,
    volcano: nd?.volcanoRisk === 'moderate' ? 0.8 : nd?.volcanoRisk === 'low' ? 0.3 : 0,
    tsunami: nd?.tsunamiRisk === 'high' ? 1 : nd?.tsunamiRisk === 'moderate' ? 0.6 : nd?.tsunamiRisk === 'low' ? 0.25 : 0,
});

export interface HazardContribution {
    key: string;
    label: string;
    /** Raw model weight, % (engine DATA.geoRisk.weights or local fallback). */
    weightPct: number;
    /** Country hazard level 0-1 (1 = worst). */
    level: number;
    /** Points contributed to the 0-100 composite (weight renormalized over coverage × level). */
    contribution: number;
    /** Share of the composite, %. */
    sharePct: number;
}

export interface HazardDecomposition {
    /** 'engine' = live `models.risk.geo` breakdown; 'fallback' = local weighted scores. */
    mode: 'engine' | 'fallback';
    rows: HazardContribution[];
    /** Un-rounded composite the rows sum to. */
    total: number;
    /** Rounded total equals the rendered compositeScore (rule-4 parity chip). */
    parityOk: boolean;
    /** Engine weight coverage (engine mode; <1 = weights renormalized, wildfire excluded). */
    coverage?: number;
    insuranceBand?: string;
}

/** Per-hazard decomposition of the composite score — engine-live when
 *  `models.risk.geo` is available (same call path calculateDisasterRisk uses),
 *  local riskBreakdown weights otherwise. Pure; safe for the collector. */
export function buildHazardDecomposition(country: CountryProfile, result: DisasterRiskResult): HazardDecomposition {
    const geoFn = rzModels().risk?.geo;
    if (typeof geoFn === 'function') {
        const geo = geoFn(hazardLevelsFromCountry(country.naturalDisaster));
        const total: number = geo.risk || 0;
        const rows: HazardContribution[] = (geo.breakdown as { key: string; weight: number; level: number }[])
            .map(b => {
                const contribution = geo.coverage > 0 ? (100 * b.weight * b.level) / geo.coverage : 0;
                return {
                    key: b.key,
                    label: HAZARD_LABELS[b.key] ?? b.key,
                    weightPct: b.weight * 100,
                    level: b.level,
                    contribution,
                    sharePct: total > 0 ? (contribution / total) * 100 : 0,
                };
            })
            .sort((a, b) => b.contribution - a.contribution);
        return {
            mode: 'engine',
            rows,
            total,
            parityOk: Math.min(100, Math.round(total)) === result.compositeScore,
            coverage: geo.coverage,
            insuranceBand: geo.band,
        };
    }
    // Engine absent → decompose with the local fallback the engine itself used
    // (riskBreakdown weights incl. wildfire): contribution = score × weight%.
    const rows: HazardContribution[] = result.riskBreakdown
        .map(r => ({
            key: r.type, label: r.type, weightPct: r.weight, level: r.score / 100,
            contribution: (r.score * r.weight) / 100, sharePct: 0,
        }))
        .sort((a, b) => b.contribution - a.contribution);
    const total = rows.reduce((s, r) => s + r.contribution, 0);
    const withShare = rows.map(r => ({ ...r, sharePct: total > 0 ? (r.contribution / total) * 100 : 0 }));
    return { mode: 'fallback', rows: withShare, total, parityOk: Math.min(100, Math.round(total)) === result.compositeScore };
}

export interface MitigationLever {
    name: string;
    cost: number;
    /** $/yr avoided, on the SAME basis the engine's ROI formula used. */
    savedPerYr: number;
    basis: 'EAL' | 'revenue-at-risk';
    roi: number;
    /** true when the engine's published ROI reproduces from (basis, cost) — parity check. */
    roiVerified: boolean;
    description: string;
}

/** Measured mitigation levers from the SAME calculateDisasterRisk output the
 *  page renders. The engine prices each option's benefit as either
 *  EAL×reduction (physical hardening, 20-yr ROI) or revenueAtRisk×reduction
 *  (DR site, annual ROI) — we detect the basis by REPRODUCING the engine's own
 *  ROI number instead of guessing, and flag the lever honestly if neither
 *  reproduces (roiVerified:false). No re-implemented math, no invented $. */
export function mitigationLevers(result: DisasterRiskResult): MitigationLever[] {
    return result.mitigationOptions
        .map(o => {
            const ealSaved = (result.expectedAnnualLoss * o.riskReduction) / 100;
            const revSaved = (result.revenueAtRisk * o.riskReduction) / 100;
            const roiEal = Math.round(((ealSaved * STRUCTURAL_AMORT_YEARS) / Math.max(1, o.cost)) * 100) / 100;
            const roiRev = Math.round((revSaved / Math.max(1, o.cost)) * 100) / 100;
            const isEal = Math.abs(o.roi - roiEal) <= 0.02;
            const isRev = !isEal && Math.abs(o.roi - roiRev) <= 0.02;
            return {
                name: o.name,
                cost: o.cost,
                savedPerYr: Math.round(isRev ? revSaved : ealSaved),
                basis: (isRev ? 'revenue-at-risk' : 'EAL') as MitigationLever['basis'],
                roi: o.roi,
                roiVerified: isEal || isRev,
                description: o.description,
            };
        })
        .sort((a, b) => b.roi - a.roi);
}

/** Diagnostics finding — canonical shape for the cross-module Diagnostics Center. */
export interface Finding {
    surface: 'disaster';
    severity: 'critical' | 'warning';
    metric: string;
    value: number;
    threshold: number;
    linkTab: 'disaster';
    title: string;
    detail: string;
}

export interface DisasterDiagnosticsModel {
    result: DisasterRiskResult | null;
    country: CountryProfile | null;
}

/** Diagnostics Tier-2 collector — pure function over the SAME
 *  calculateDisasterRisk output the dashboard renders (linkTab:'disaster').
 *  Fires on riskCategory High (warning) / Extreme (critical), gated by the
 *  same RISK_CAT_THRESHOLDS constants that colour the chip. */
export function collectDisasterDiagnostics(model: DisasterDiagnosticsModel): Finding[] {
    const { result, country } = model;
    if (!result || !country) return [];
    const category = categoryFromScore(result.compositeScore);
    if (category !== 'High' && category !== 'Extreme') return [];
    const threshold = category === 'Extreme' ? RISK_CAT_THRESHOLDS.extreme : RISK_CAT_THRESHOLDS.high;
    const decomp = buildHazardDecomposition(country, result);
    const top = decomp.rows[0];
    const levers = mitigationLevers(result);
    const best = levers[0];
    const structuralPerYr = Math.round(result.structuralCostAdder / STRUCTURAL_AMORT_YEARS);
    const hardeningText = result.structuralCostAdder > 0
        ? `hardening ${fmtMoney(result.structuralCostAdder)} capex ≈ ${fmtMoney(structuralPerYr)}/yr @${STRUCTURAL_AMORT_YEARS}yr`
        : 'hardening: the model has no structural adder for this country (structuralReinforcement 0% CAPEX) — lever not derivable';
    const leverText = best
        ? `Best measured lever: ${best.name} ${fmtMoney(best.cost)} → −${fmtMoney(best.savedPerYr)}/yr (basis ${best.basis}, ROI ${best.roi}x${best.roiVerified ? '' : ', basis not verified vs engine ROI'}).`
        : 'The model produces no mitigation options for this profile — in the model, the score only drops through location selection.';
    return [{
        surface: 'disaster',
        severity: category === 'Extreme' ? 'critical' : 'warning',
        metric: 'compositeScore',
        value: result.compositeScore,
        threshold,
        linkTab: 'disaster',
        title: `Disaster risk ${category}: composite ${result.compositeScore}/100 ≥ threshold ${threshold}`,
        detail: `Largest contributor: ${top ? `${top.label} ${top.contribution.toFixed(1)} pts (${top.sharePct.toFixed(0)}% of composite, ${decomp.mode === 'engine' ? 'engine models.risk.geo' : 'local fallback'})` : 'n/a'}. ` +
            `Annual burden: insurance ${fmtMoney(result.annualInsuranceCost)}/yr + EAL ${fmtMoney(result.expectedAnnualLoss)}/yr + ${hardeningText}. ${leverText}`,
    }];
}

const DisasterRiskDashboard = () => {
    const { selectedCountry, inputs, actions } = useSimulationStore();
    const capexStore = useCapexStore();
    const engineReady = useEngineReady(); // DF2 — recompute once models.risk.geo arrives
    const [showGuidance, setShowGuidance] = useState(false);

    const result = useMemo(() => {
        if (!selectedCountry) return null;
        const itLoad = capexStore.inputs.itLoad || inputs.itLoad;
        const totalCapex = capexStore.results?.total || itLoad * 10000;
        const annualRevenue = itLoad * REVENUE_PER_KW_MONTH * 12; // screening basis — lib/screening.ts
        return calculateDisasterRisk({
            country: selectedCountry,
            totalCapex,
            itLoadKw: itLoad,
            annualRevenue,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCountry, inputs, capexStore, engineReady]);

    // Guidance model — SAME thresholds as the chip colouring + collector.
    const decomp = useMemo(
        () => (result && selectedCountry ? buildHazardDecomposition(selectedCountry, result) : null),
        [result, selectedCountry],
    );
    const levers = useMemo(() => (result ? mitigationLevers(result) : []), [result]);
    const derivedCategory = result ? categoryFromScore(result.compositeScore) : null;
    const categoryParityOk = !result || derivedCategory === result.riskCategory;
    const guidanceEligible = derivedCategory === 'High' || derivedCategory === 'Extreme';
    const categoryThreshold = derivedCategory === 'Extreme' ? RISK_CAT_THRESHOLDS.extreme : RISK_CAT_THRESHOLDS.high;

    const countryRiskData = useMemo(() => {
        return Object.values(COUNTRIES)
            .map(c => ({
                country: c.name,
                code: c.id,
                score: c.naturalDisaster?.compositeScore ?? 20,
            }))
            .sort((a, b) => a.score - b.score); // Lower = better
    }, []);

    if (!result || !selectedCountry) {
        return <div className="p-8 text-center text-slate-500">Select a country to view disaster risk analysis.</div>;
    }

    // Radar data
    const radarData = result.riskBreakdown.map(r => ({
        category: r.type,
        score: r.score,
        fullMark: 100,
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CloudLightning className="w-6 h-6 text-orange-500" />
                    Natural Disaster Risk Scoring
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {selectedCountry.name} · Seismic Zone {selectedCountry.naturalDisaster?.seismicZone ?? 0} · Insurance {selectedCountry.naturalDisaster?.insuranceMultiplier ?? 1.0}x
                </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                            <span className="text-xs text-slate-500 uppercase">Risk Score</span>
                            <Tooltip content={`Composite disaster risk score (0-100). Higher = more dangerous. Live weighting (${decomp?.mode === 'engine' ? 'engine models.risk.geo' : 'local fallback'}): ${decomp ? decomp.rows.map(r => `${r.label} ${fmt(r.weightPct)}%`).join(', ') : '—'}.`} />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{result.compositeScore}</div>
                        {guidanceEligible && derivedCategory ? (
                            <button
                                type="button"
                                onClick={() => setShowGuidance(v => !v)}
                                aria-expanded={showGuidance}
                                className={`text-xs mt-1 px-2 py-0.5 rounded border w-fit flex items-center gap-1 cursor-pointer hover:brightness-125 transition ${riskColors[derivedCategory]}`}
                                title={`Composite ${result.compositeScore}/100 ≥ threshold ${categoryThreshold} — click for per-hazard decomposition + mitigation trade-offs`}
                            >
                                {derivedCategory} — why?
                                {showGuidance ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                        ) : (
                            <div className={`text-xs mt-1 px-2 py-0.5 rounded border w-fit ${riskColors[derivedCategory ?? result.riskCategory]}`}>
                                {derivedCategory ?? result.riskCategory}
                            </div>
                        )}
                        {!categoryParityOk && (
                            <div className="text-[10px] mt-1 text-amber-500">
                                ⚠ engine category ({result.riskCategory}) ≠ panel threshold ({derivedCategory}) — threshold drift
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Shield className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-slate-500 uppercase">Insurance/Yr</span>
                            <Tooltip content="Estimated effect of disaster risk on annual property insurance premiums." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.annualInsuranceCost)}</div>
                        <div className="text-xs text-slate-500 mt-1">{selectedCountry.naturalDisaster?.insuranceMultiplier ?? 1.0}x multiplier</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Flame className="w-4 h-4 text-red-500" />
                            <span className="text-xs text-slate-500 uppercase">Structural Adder</span>
                            <Tooltip content="Capital investment required to reduce disaster risk to acceptable levels (seismic bracing, flood barriers, etc)." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.structuralCostAdder)}</div>
                        <div className="text-xs text-slate-500 mt-1">{((selectedCountry.naturalDisaster?.structuralReinforcement ?? 0) * 100).toFixed(0)}% of CAPEX</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-4 h-4 text-amber-500" />
                            <span className="text-xs text-slate-500 uppercase">Expected Loss/Yr</span>
                            <Tooltip content="Annualized expected monetary loss from natural disaster events, factoring in probability and severity." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.expectedAnnualLoss)}</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Wind className="w-4 h-4 text-cyan-500" />
                            <span className="text-xs text-slate-500 uppercase">Interruption</span>
                            <Tooltip content="Expected business interruption days per year due to natural disaster events affecting facility operations." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{result.businessInterruptionDays}</div>
                        <div className="text-xs text-slate-500 mt-1">expected days/yr</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Waves className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-slate-500 uppercase">Revenue at Risk</span>
                            <Tooltip content="Annual revenue exposed to loss from disaster-related downtime, based on expected interruption days and facility revenue." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.revenueAtRisk)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Tier-2 guidance panel: dekomposisi + trade-off mitigasi (DIAGNOSTICS_STANDARD) ── */}
            {showGuidance && guidanceEligible && decomp && derivedCategory && (
                <Card className="bg-white dark:bg-slate-800/50 border-orange-300 dark:border-orange-500/40">
                    <CardContent className="pt-5 space-y-4">
                        {/* (a) REASON — live numbers from the same model as the render */}
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <AlertTriangle className={`w-4 h-4 ${derivedCategory === 'Extreme' ? 'text-red-500' : 'text-orange-500'}`} />
                                    Why {derivedCategory}? Composite {result.compositeScore}/100 ≥ threshold {categoryThreshold}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Per-hazard decomposition — model weight × country hazard level ({selectedCountry.name}),{' '}
                                    {decomp.mode === 'engine' ? 'live from engine models.risk.geo (DATA.geoRisk.weights)' : 'local fallback (engine unavailable)'}.
                                </p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded border h-fit ${decomp.parityOk
                                ? 'text-emerald-500 border-emerald-500/40 bg-emerald-500/10'
                                : 'text-amber-500 border-amber-500/40 bg-amber-500/10'}`}>
                                {decomp.parityOk
                                    ? `≡ engine: Σ contributions ${decomp.total.toFixed(1)} → ${result.compositeScore}`
                                    : `⚠ decomposition drift: Σ ${decomp.total.toFixed(1)} ≠ composite ${result.compositeScore} — numbers below are indicative`}
                            </span>
                        </div>

                        <div className="space-y-1.5">
                            {decomp.rows.map((r, i) => (
                                <div key={r.key} className={`flex items-center gap-3 text-xs p-1.5 rounded ${i === 0 ? 'bg-orange-500/10' : 'bg-slate-50 dark:bg-slate-900/30'}`}>
                                    <span className="w-32 shrink-0 text-slate-700 dark:text-slate-300">
                                        {r.label}{i === 0 && <span className="ml-1 text-[10px] text-orange-500 font-semibold">← largest</span>}
                                    </span>
                                    <span className="w-28 shrink-0 font-mono text-slate-500">
                                        {fmt(r.weightPct)}% × {(r.level * 100).toFixed(0)}/100
                                    </span>
                                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                        <div
                                            className={`h-1.5 rounded-full ${i === 0 ? 'bg-orange-500' : 'bg-slate-400 dark:bg-slate-500'}`}
                                            style={{ width: `${Math.min(100, decomp.total > 0 ? (r.contribution / decomp.total) * 100 : 0)}%` }}
                                        />
                                    </div>
                                    <span className="w-24 shrink-0 text-right font-mono text-slate-900 dark:text-white">
                                        {r.contribution.toFixed(1)} pts ({r.sharePct.toFixed(0)}%)
                                    </span>
                                </div>
                            ))}
                            {decomp.mode === 'engine' && decomp.coverage != null && decomp.coverage < 1 && (
                                <p className="text-[10px] text-slate-500">
                                    Engine weights renormalized over coverage {decomp.coverage.toFixed(2)} — wildfire is excluded from the engine composite
                                    (shown in the radar with the 10% local fallback weight).
                                </p>
                            )}
                        </div>

                        {/* (b) MEASURED LEVERS — annual trade-offs, all numbers live from result */}
                        <div>
                            <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">Mitigation trade-offs (live numbers, annual basis)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700">
                                    <div className="text-slate-500 mb-1">Insurance premium</div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white">{fmtMoney(result.annualInsuranceCost)}/yr</div>
                                    <div className="text-slate-500 mt-1">
                                        {(selectedCountry.naturalDisaster?.insuranceMultiplier ?? 1.0)}x multiplier
                                        {decomp.insuranceBand ? ` · engine band: ${decomp.insuranceBand}` : ''} · {result.insuranceTrend}
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700">
                                    <div className="text-slate-500 mb-1">Structural hardening</div>
                                    {result.structuralCostAdder > 0 ? (
                                        <>
                                            <div className="text-base font-bold text-slate-900 dark:text-white">
                                                ≈ {fmtMoney(Math.round(result.structuralCostAdder / STRUCTURAL_AMORT_YEARS))}/yr
                                            </div>
                                            <div className="text-slate-500 mt-1">
                                                {fmtMoney(result.structuralCostAdder)} capex ({((selectedCountry.naturalDisaster?.structuralReinforcement ?? 0) * 100).toFixed(0)}% CAPEX),
                                                amortized over {STRUCTURAL_AMORT_YEARS} yr — the same adder enters phase capex in Phased Financial (pro-rata IT load).
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-slate-500">
                                            The model has no structural adder for this country (structuralReinforcement 0% CAPEX) —
                                            the hardening lever is not derivable from the model.
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700">
                                    <div className="text-slate-500 mb-1">Expected annual loss (EAL)</div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white">{fmtMoney(result.expectedAnnualLoss)}/yr</div>
                                    <div className="text-slate-500 mt-1">
                                        + interruption {result.businessInterruptionDays} days/yr → revenue-at-risk {fmtMoney(result.revenueAtRisk)}/yr.
                                    </div>
                                </div>
                            </div>
                        </div>

                        {levers.length > 0 ? (
                            <div>
                                <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">Measured levers (from engine mitigationOptions, sorted by ROI)</h4>
                                <div className="space-y-1.5">
                                    {levers.map((l, i) => (
                                        <div key={l.name} className={`flex items-center justify-between gap-3 text-xs p-2 rounded ${i === 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-50 dark:bg-slate-900/30'}`}>
                                            <span className="text-slate-700 dark:text-slate-300">{l.name}</span>
                                            <span className="font-mono text-right text-slate-900 dark:text-white shrink-0">
                                                {fmtMoney(l.cost)} → −{fmtMoney(l.savedPerYr)}/yr <span className="text-slate-500">({l.basis})</span> · ROI {l.roi}x
                                                {!l.roiVerified && <span className="text-amber-500"> · basis not verified vs engine</span>}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500">
                                The model produces no mitigation options for this profile — no derivable capex lever.
                            </p>
                        )}

                        {/* Honest scope + (c) navigasi ke parameter */}
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                            <p className="text-[11px] text-slate-500">
                                Honest about lever reach: in the model, mitigation options lower EAL / revenue-at-risk —
                                <span className="font-semibold"> they do not lower the composite score</span> (score = country hazard attributes:
                                seismic zone, flood class, etc.). The only score lever in the model is location selection
                                {(() => {
                                    const safer = countryRiskData.filter(c => c.score < RISK_CAT_THRESHOLDS.high && c.code !== selectedCountry.id).slice(0, 3);
                                    return safer.length > 0
                                        ? ` — ${safer.length}+ country profiles below the High threshold (<${RISK_CAT_THRESHOLDS.high}), e.g. ${safer.map(c => `${c.country} (${c.score})`).join(', ')}.`
                                        : '.';
                                })()}
                            </p>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => actions.setActiveTab('site')}
                                    className="text-xs px-2.5 py-1 rounded border border-cyan-500/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 flex items-center gap-1"
                                >
                                    Site Intelligence — compare locations <ArrowUpRight className="w-3 h-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('disaster-hazard-detail')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                    className="text-xs px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-500/10 flex items-center gap-1"
                                >
                                    Per-hazard detail in the radar <ArrowUpRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risk Radar */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Risk Radar ({selectedCountry.name})</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <RadarChart data={radarData}>
                                <PolarGrid stroke="#334155" />
                                <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748b' }} />
                                <Radar name="Risk" dataKey="score" stroke="#f97316" fill="#f97316" fillOpacity={0.3} />
                            </RadarChart>
                        </ResponsiveContainer>

                        {/* Risk Detail Table */}
                        <div id="disaster-hazard-detail" className="mt-4 space-y-2">
                            {result.riskBreakdown.map(r => (
                                <div key={r.type} className="flex items-center justify-between text-sm p-2 rounded bg-slate-50 dark:bg-slate-900/30">
                                    <span className="text-slate-600 dark:text-slate-400">{r.type}</span>
                                    <div className="flex items-center gap-3">
                                        <div className="w-20 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full ${r.score >= 70 ? 'bg-red-500' : r.score >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${r.score}%` }}
                                            />
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                            r.impact === 'Critical' ? 'bg-red-500/10 text-red-400' : r.impact === 'Moderate' ? 'bg-amber-500/10 text-amber-400' : r.impact === 'None' ? 'bg-slate-500/10 text-slate-400' : 'bg-emerald-500/10 text-emerald-400'
                                        }`}>{r.impact}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Country Risk Comparison + Mitigation */}
                <div className="space-y-6">
                    {/* Mitigation Options */}
                    {result.mitigationOptions.length > 0 && (
                        <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                            <CardContent className="pt-6">
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Mitigation Options</h3>
                                <div className="space-y-3">
                                    {result.mitigationOptions.map(opt => (
                                        <div key={opt.name} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-semibold text-slate-900 dark:text-white">{opt.name}</span>
                                                <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400">ROI: {opt.roi}x</span>
                                            </div>
                                            <p className="text-xs text-slate-500 mb-2">{opt.description}</p>
                                            <div className="flex gap-4 text-xs">
                                                <span className="text-slate-600 dark:text-slate-400">Cost: <span className="font-medium text-slate-900 dark:text-white">{fmtMoney(opt.cost)}</span></span>
                                                <span className="text-slate-600 dark:text-slate-400">Risk Reduction: <span className="font-medium text-emerald-500">-{opt.riskReduction}%</span></span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Country Comparison */}
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                        <CardContent className="pt-6">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Risk Score by Country (Lower = Safer)</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={countryRiskData.slice(0, 15)} layout="vertical" margin={{ left: 70 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                    <YAxis dataKey="country" type="category" width={80} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <RTooltip
                                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                        formatter={(v: any) => [`${v}/100`, 'Risk Score']}
                                    />
                                    <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                                        {countryRiskData.slice(0, 15).map((entry) => (
                                            <Cell
                                                key={entry.code}
                                                fill={entry.code === selectedCountry.id ? '#f97316' : entry.score <= 20 ? '#10b981' : entry.score <= 50 ? '#f59e0b' : '#ef4444'}
                                                opacity={entry.code === selectedCountry.id ? 1 : 0.6}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default DisasterRiskDashboard;
