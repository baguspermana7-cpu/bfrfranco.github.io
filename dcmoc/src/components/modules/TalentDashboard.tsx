'use client';

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { calculateTalentAvailability, TalentAvailabilityResult } from '@/modules/staffing/TalentAvailabilityEngine';
import { calculateStaffing } from '@/modules/staffing/ShiftEngine';
import { useEffectiveInputs } from '@/store/useEffectiveInputs';
import { COUNTRIES, CountryProfile } from '@/constants/countries';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import { ScoreValue } from '@/components/ui/ScoreValue';
import { TraceValue } from '@/components/ui/TraceValue';
import { RedValue, type Diagnosis } from '@/components/ui/RedValue';
import { RELATED_ARTICLES } from '@/lib/related-articles';
import { GraduationCap, Users, DollarSign, Clock, TrendingUp, Award } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { fmt, fmtMoney } from '@/lib/format';
import { topNWithSelected } from '@/lib/chart-utils';

/* ── Difficulty banding constants (single source: pewarnaan + gate panel + collector).
 * Band OWNER is TalentAvailabilityEngine (talentScore ≥75 Easy · ≥55 Moderate ·
 * ≥35 Difficult · else Very Difficult) — the UI gates on the engine's own
 * difficulty STRING so it can never mis-colour; the numeric mirrors below exist
 * only for Finding.threshold and are parity-checked at runtime (chip "≡ engine"
 * / drift warning, DIAGNOSTICS_STANDARD rule 4). ── */
const HIRING_RED_DIFFICULTY = 'Very Difficult' as const;
const HIRING_AMBER_DIFFICULTY = 'Difficult' as const;
const TALENT_VERY_DIFFICULT_THRESHOLD = 35; // mirror: engine band 'Very Difficult' = talentScore < 35
const TALENT_DIFFICULT_THRESHOLD = 55;      // mirror: engine band 'Difficult' = talentScore < 55
/** Salary-premium sensitivity scenarios re-run against the live engine. */
const PREMIUM_UPLIFTS = [0, 0.10, 0.20] as const;

const difficultyColors: Record<string, string> = {
    'Easy': 'text-rz-data bg-rz-data/10 border-rz-data/30',
    'Moderate': 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    [HIRING_AMBER_DIFFICULTY]: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    [HIRING_RED_DIFFICULTY]: 'text-red-400 bg-red-500/10 border-red-500/30',
};

/* Impact labels the breakdown renders red — shared by the factor list AND the
 * guidance panel's "penyebab" line (no duplicate literal sets). */
const POSITIVE_IMPACTS = ['Positive', 'Fast', 'Strong', 'Low'] as const;
const NEGATIVE_IMPACTS = ['Negative', 'Slow', 'Limited', 'High', 'High Competition'] as const;
const isNegativeImpact = (impact: string) => (NEGATIVE_IMPACTS as readonly string[]).includes(impact);
const isPositiveImpact = (impact: string) => (POSITIVE_IMPACTS as readonly string[]).includes(impact);

/* ── Diagnostics collector (DIAGNOSTICS_STANDARD §5) — pure, engine-backed, no hooks ── */
export interface Finding {
    surface: string;
    severity: 'critical' | 'warning' | 'info';
    metric: string;
    value: number;
    threshold: number;
    linkTab: 'talent';
}

export interface TalentDiagnosticsModel {
    country: CountryProfile | null;
    totalFTE: number;
    annualStaffCost: number;
}

/** Emits a Finding when hiring difficulty lands in the red/amber band — SAME
 *  engine banding as the KPI chip colouring (gate on the engine's own string). */
export function collectTalentDiagnostics(model: TalentDiagnosticsModel): Finding[] {
    if (!model.country || model.totalFTE <= 0) return [];
    const r = calculateTalentAvailability({
        country: model.country,
        totalFTE: model.totalFTE,
        annualStaffCost: model.annualStaffCost,
    });
    if (r.hiringDifficulty === HIRING_RED_DIFFICULTY) {
        return [{
            surface: `Hiring Difficulty ${HIRING_RED_DIFFICULTY} — ${model.country.name}`,
            severity: 'critical',
            metric: 'talentScore',
            value: r.talentScore,
            threshold: TALENT_VERY_DIFFICULT_THRESHOLD,
            linkTab: 'talent',
        }];
    }
    if (r.hiringDifficulty === HIRING_AMBER_DIFFICULTY) {
        return [{
            surface: `Hiring Difficulty ${HIRING_AMBER_DIFFICULTY} — ${model.country.name}`,
            severity: 'warning',
            metric: 'talentScore',
            value: r.talentScore,
            threshold: TALENT_DIFFICULT_THRESHOLD,
            linkTab: 'talent',
        }];
    }
    return [];
}

const TalentDashboard = () => {
    const { selectedCountry } = useSimulationStore();
    const inputs = useEffectiveInputs();

    const { result, annualStaffCost, totalFTE } = useMemo(() => {
        if (!selectedCountry) return { result: null, annualStaffCost: 0, totalFTE: 0 };

        // Calculate base staffing to get costs
        const roles = ['shift-lead', 'engineer', 'technician', 'admin', 'janitor'] as const;
        const headcounts = [inputs.headcount_ShiftLead, inputs.headcount_Engineer, inputs.headcount_Technician, inputs.headcount_Admin, inputs.headcount_Janitor];
        const is24x7 = [true, true, false, false, false];

        let staffCost = 0;
        let fte = 0;
        for (let i = 0; i < roles.length; i++) {
            const staffResult = calculateStaffing(roles[i], headcounts[i], inputs.shiftModel, selectedCountry, is24x7[i]);
            staffCost += staffResult.monthlyCost * 12;
            fte += staffResult.headcount;
        }

        const talentResult = calculateTalentAvailability({
            country: selectedCountry,
            totalFTE: fte,
            annualStaffCost: staffCost,
        });

        return { result: talentResult, annualStaffCost: staffCost, totalFTE: fte };
    }, [selectedCountry, inputs]);

    /* ── Hiring-difficulty guidance panel (DIAGNOSTICS_STANDARD): klik chip merah/amber
     * → matriks trade-off live (engine di-re-run per skenario premium) + lever. ── */
    const [showDifficultyPanel, setShowDifficultyPanel] = useState(false);
    const difficultyIsBad = result != null &&
        (result.hiringDifficulty === HIRING_RED_DIFFICULTY || result.hiringDifficulty === HIRING_AMBER_DIFFICULTY);
    const premiumScenarios = useMemo(() => {
        if (!selectedCountry || !result || totalFTE <= 0) return null;
        return PREMIUM_UPLIFTS.map((uplift) => ({
            uplift,
            r: calculateTalentAvailability({
                country: selectedCountry,
                totalFTE,
                annualStaffCost: annualStaffCost * (1 + uplift),
            }),
        }));
    }, [selectedCountry, result, totalFTE, annualStaffCost]);
    // Honest sensitivity verdict: measured from the ACTUAL re-runs, not assumed.
    const timeToStaffResponds = premiumScenarios != null &&
        premiumScenarios.some((s) => s.r.timeToFullStaff !== premiumScenarios[0].r.timeToFullStaff);
    // Parity (rule 4): numeric mirror vs engine's own band string — warn on drift.
    const bandParityOk = result == null ||
        ((result.talentScore < TALENT_VERY_DIFFICULT_THRESHOLD) === (result.hiringDifficulty === HIRING_RED_DIFFICULTY) &&
         (result.talentScore < TALENT_DIFFICULT_THRESHOLD && result.talentScore >= TALENT_VERY_DIFFICULT_THRESHOLD) === (result.hiringDifficulty === HIRING_AMBER_DIFFICULTY));

    const countryComparison = useMemo(() => {
        return Object.values(COUNTRIES)
            .map(c => ({
                country: c.name,
                code: c.id,
                score: c.talentPool?.talentScore ?? 50,
                premium: ((c.talentPool?.salaryPremium ?? 1) - 1) * 100,
            }))
            .sort((a, b) => b.score - a.score);
    }, []);

    if (!result || !selectedCountry) {
        return <div className="p-8 text-center text-slate-500">Select a country to view talent analysis.</div>;
    }

    /* ── RedValue diagnosis (Workstream C/N) — every figure comes from the SAME
     * engine run as the KPIs; banding thresholds are the parity-checked mirrors. */
    const premiumPct = (result.adjustedSalaryMultiplier - 1) * 100;
    const depressingFactors = result.talentBreakdown.filter(b => isNegativeImpact(b.impact)).map(b => `${b.metric} (${b.value})`).join(' · ')
        || 'mixed factor profile — no single factor is red';
    const talentDiagnosis: Diagnosis | null = difficultyIsBad ? {
        title: `Hiring Difficulty — ${result.hiringDifficulty} (${selectedCountry.name})`,
        actual: `talent score ${result.talentScore}/100`,
        threshold: `Moderate band requires ≥ ${TALENT_DIFFICULT_THRESHOLD}`,
        gap: `${Math.max(0, TALENT_DIFFICULT_THRESHOLD - result.talentScore)} pts below the Moderate band`,
        reason: `TalentAvailabilityEngine bands the ${selectedCountry.name} talent score ${result.talentScore} as ${result.hiringDifficulty} (band ${result.hiringDifficulty === HIRING_RED_DIFFICULTY ? `< ${TALENT_VERY_DIFFICULT_THRESHOLD}` : `${TALENT_VERY_DIFFICULT_THRESHOLD}–${TALENT_DIFFICULT_THRESHOLD - 1}`}). Live effects on this project: salary premium +${premiumPct.toFixed(0)}%, average hiring ${selectedCountry.talentPool?.avgHiringDays ?? 40} days/hire, ${result.timeToFullStaff} months to staff the ${totalFTE} FTE team. Depressing factors: ${depressingFactors}.`,
        levers: [
            { label: 'Re-select country / site', detail: 'Talent score is a country attribute — compare candidate locations in Site Intelligence before committing.', tab: 'site' },
            { label: 'Vendor / outsourced O&M sourcing', detail: 'Shift scarce roles to a maintenance vendor contract instead of direct hires — reduces the FTE pipeline the local market must supply.', tab: 'maint' },
            { label: 'Adjust the shift model', detail: 'A leaner shift pattern lowers total FTE, shortening the hiring pipeline the time-to-staff figure depends on.', tab: 'sim' },
            { label: 'Train-to-hire pipeline + remote NOC', detail: 'Grow junior talent through a training pipeline and centralize L1 monitoring in a remote NOC — offsets a shallow senior pool (no single tab owns this lever).' },
        ],
        tab: 'talent',
        references: RELATED_ARTICLES.talent,
        note: 'Banding mirrors TalentAvailabilityEngine (≥75 Easy · ≥55 Moderate · ≥35 Difficult · else Very Difficult); the inline trade-off panel parity-checks this mirror against the engine every render ("≡ engine" chip).',
    } : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <GraduationCap className="w-6 h-6 text-rz-mint" />
                    Talent Availability Index
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {selectedCountry.name} · {totalFTE} FTE Required · {selectedCountry.talentPool?.dcEngineerPool ?? 'moderate'} talent pool
                </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Award className="w-4 h-4 text-rz-mint" />
                            <span className="text-xs text-slate-500 uppercase">Talent Score</span>
                            <Tooltip content="Composite talent availability score (0-100) based on engineer pool, university pipeline, hyperscaler competition, hiring speed, and certifications." />
                        </div>
                        <div><ScoreValue value={result.talentScore} direction="higher" max={100} traceId="site.talentScore" explainKey="talent-index" className="text-2xl" /></div>
                        {difficultyIsBad && talentDiagnosis ? (
                            /* RedValue chip (diagnostic modal) + SIBLING panel toggle —
                             * TraceValue/toggles are real buttons, never nested. */
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <RedValue diagnosis={talentDiagnosis} className="w-fit">
                                    <span className={`text-xs px-2 py-0.5 rounded border inline-flex items-center gap-1 ${difficultyColors[result.hiringDifficulty]}`}>
                                        {result.hiringDifficulty} — why?
                                    </span>
                                </RedValue>
                                <button
                                    onClick={() => setShowDifficultyPanel(v => !v)}
                                    aria-expanded={showDifficultyPanel}
                                    className="text-[10px] text-slate-500 underline decoration-dotted underline-offset-2 hover:text-slate-700 dark:hover:text-slate-300">
                                    trade-off matrix {showDifficultyPanel ? '▴' : '▾'}
                                </button>
                            </div>
                        ) : (
                            <div className={`text-xs mt-1 px-2 py-0.5 rounded border w-fit ${difficultyColors[result.hiringDifficulty]}`}>
                                {result.hiringDifficulty}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-4 h-4 text-amber-500" />
                            <span className="text-xs text-slate-500 uppercase">Salary Premium</span>
                            <Tooltip content="How facility pay compares to local market rates. Below 90% increases attrition risk." />
                        </div>
                        <div><ScoreValue value={premiumPct} display={`+${premiumPct.toFixed(0)}%`} direction="lower" max={30} className="text-2xl" tip="Premium over local market pay the model prices in to attract scarce DC talent. Color scale 0–30% (the engine's premium range): near 0% green (buyer's market), 30%+ red (severe competition). The premium compounds every year of the staff cost line — it is not a one-time signing cost." /></div>
                        <div className="text-xs text-slate-500 mt-1">{fmtMoney(result.adjustedAnnualStaffCost - annualStaffCost)}/yr extra</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-slate-500 uppercase">Time to Staff</span>
                            <Tooltip content="Estimated months to recruit and onboard the full operations team based on local talent pool depth and competition." />
                        </div>
                        <div><ScoreValue value={result.timeToFullStaff} direction="lower" max={24} traceId="site.talentTimeToStaff" className="text-2xl" /></div>
                        <div className="text-xs text-slate-500 mt-1">months to full team</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Users className="w-4 h-4 text-red-500" />
                            <span className="text-xs text-slate-500 uppercase">Turnover</span>
                            <Tooltip content="Annual percentage of staff departing. Data center industry average is 10-15%. Higher rates increase recruitment costs." />
                        </div>
                        <div><ScoreValue value={result.adjustedTurnoverRate * 100} display={`${(result.adjustedTurnoverRate * 100).toFixed(0)}%`} direction="lower" max={30} traceId="site.talentTurnover" className="text-2xl" /></div>
                        <div className="text-xs text-slate-500 mt-1">{fmtMoney(result.annualTurnoverCost)}/yr cost</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <GraduationCap className="w-4 h-4 text-rz-data" />
                            <span className="text-xs text-slate-500 uppercase">Training/Yr</span>
                            <Tooltip content="Annual training hours per employee. Critical for maintaining certifications and operational competency." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white"><TraceValue traceId="site.talentTraining">{fmtMoney(result.annualTrainingCost)}</TraceValue></div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-orange-500" />
                            <span className="text-xs text-slate-500 uppercase">Recruit Cost</span>
                            <Tooltip content="Total one-time recruitment expenditure for staffing the facility. Includes agency fees, relocation, and onboarding costs." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white"><TraceValue traceId="site.talentRecruitCost">{fmtMoney(result.totalRecruitmentCost)}</TraceValue></div>
                        <div className="text-xs text-slate-500 mt-1">{fmtMoney(result.recruitmentCostPerHire)}/hire</div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Guidance panel: alasan + matriks trade-off live + lever (DIAGNOSTICS_STANDARD) ── */}
            {showDifficultyPanel && difficultyIsBad && premiumScenarios && (
                <div className={`rounded-lg border p-4 text-left ${
                    result.hiringDifficulty === HIRING_RED_DIFFICULTY
                        ? 'border-red-500/30 bg-red-500/5'
                        : 'border-amber-500/30 bg-amber-500/5'
                }`}>
                    {/* Alasan — angka live dari engine yang sama dengan pewarnaan */}
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                            Hiring <b>{result.hiringDifficulty}</b> because talent score <b>{result.talentScore}</b> falls in the band{' '}
                            {result.hiringDifficulty === HIRING_RED_DIFFICULTY
                                ? <>&lt; {TALENT_VERY_DIFFICULT_THRESHOLD}</>
                                : <>{TALENT_VERY_DIFFICULT_THRESHOLD}–{TALENT_DIFFICULT_THRESHOLD - 1}</>} (TalentAvailabilityEngine banding).
                            {' '}Depressing factors: {result.talentBreakdown.filter(b => isNegativeImpact(b.impact)).map(b => `${b.metric} (${b.value})`).join(' · ') || 'mixed factor profile — no single factor is red'}.
                        </p>
                        {bandParityOk ? (
                            <span className="shrink-0 rounded bg-rz-data/10 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase text-rz-data" title="Panel numeric banding matches the engine's band string">≡ engine</span>
                        ) : (
                            <span className="shrink-0 rounded bg-red-500/10 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase text-red-500" title="DRIFT: the panel mirror threshold no longer matches the engine banding — update the mirror constant">band drift!</span>
                        )}
                    </div>

                    {/* Matriks trade-off: salary premium ↑ → engine di-RE-RUN live */}
                    <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-[11px]">
                            <thead>
                                <tr className="text-[9px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                    <th className="text-left py-1 pr-2 font-semibold">Salary spend scenario</th>
                                    <th className="text-right py-1 px-2 font-semibold">Adjusted staff cost/yr</th>
                                    <th className="text-right py-1 px-2 font-semibold">Turnover cost/yr</th>
                                    <th className="text-right py-1 pl-2 font-semibold">Time to staff</th>
                                </tr>
                            </thead>
                            <tbody>
                                {premiumScenarios.map(({ uplift, r }) => (
                                    <tr key={uplift} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                        <td className="py-1 pr-2 text-slate-600 dark:text-slate-400">{uplift === 0 ? 'Base (current country premium)' : `+${(uplift * 100).toFixed(0)}% salary spend`}</td>
                                        <td className="py-1 px-2 text-right font-mono text-slate-800 dark:text-slate-200">{fmtMoney(r.adjustedAnnualStaffCost)}</td>
                                        <td className="py-1 px-2 text-right font-mono text-slate-800 dark:text-slate-200">{fmtMoney(r.annualTurnoverCost)}</td>
                                        <td className="py-1 pl-2 text-right font-mono text-slate-800 dark:text-slate-200">{r.timeToFullStaff} mo</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Lever + honesty — dari re-run engine, bukan asumsi */}
                    <div className="mt-2 space-y-1">
                        {timeToStaffResponds ? (
                            <div className="flex items-start gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                                <span className="shrink-0 rounded bg-rz-data px-1 py-0.5 text-[8px] font-bold text-black">LEVER</span>
                                <span><b>Raise salary spend</b> — the engine re-run shows time-to-staff dropping from {premiumScenarios[0].r.timeToFullStaff} mo to {premiumScenarios[premiumScenarios.length - 1].r.timeToFullStaff} mo at +{(PREMIUM_UPLIFTS[PREMIUM_UPLIFTS.length - 1] * 100).toFixed(0)}% (figures in the table).</span>
                            </div>
                        ) : (
                            <div className="flex items-start gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                                <span className="shrink-0 rounded bg-slate-500 px-1 py-0.5 text-[8px] font-bold text-white">NOTE</span>
                                <span><b>The model is not sensitive to premium for speed</b> — in TalentAvailabilityEngine, time-to-staff is derived only from FTE count ({totalFTE}) and the country's hiring speed ({selectedCountry.talentPool?.avgHiringDays ?? 40} days/hire, 2 in parallel); raising salary spend +{(PREMIUM_UPLIFTS[PREMIUM_UPLIFTS.length - 1] * 100).toFixed(0)}% does not change it ({premiumScenarios[0].r.timeToFullStaff} mo across all scenarios — see table). Premium affects the cost columns, not speed.</span>
                            </div>
                        )}
                        <div className="flex items-start gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                            <span className="shrink-0 rounded bg-rz-data px-1 py-0.5 text-[8px] font-bold text-black">LEVER</span>
                            <span><b>Start recruiting {Math.ceil(result.timeToFullStaff)} months earlier</b> than the operations target — a {totalFTE} FTE pipeline needs {result.timeToFullStaff} mo on the {selectedCountry.name} hiring profile; every month of delayed start ≈ {(totalFTE / Math.max(1, result.timeToFullStaff)).toFixed(1)} positions unfilled on day one.</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                            <span className="shrink-0 rounded bg-slate-500 px-1 py-0.5 text-[8px] font-bold text-white">LIVE</span>
                            <span>Turnover {(result.adjustedTurnoverRate * 100).toFixed(0)}%/yr → {fmtMoney(result.annualTurnoverCost)}/yr · Recruitment {fmtMoney(result.totalRecruitmentCost)} one-time ({fmtMoney(result.recruitmentCostPerHire)}/hire) — all from the same engine run as the KPIs above.</span>
                        </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                        <p className="text-[9px] text-slate-400">Matrix = calculateTalentAvailability re-run per scenario (deterministic) — not a static table.</p>
                        <button
                            onClick={() => useSimulationStore.getState().actions.setActiveTab('staff' as never)}
                            className="shrink-0 rounded bg-cyan-500/10 px-2 py-1 text-[9px] font-semibold uppercase text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20"
                            title="Edit headcount & shift model in Staffing">
                            Staffing ↗
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Talent Breakdown */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Talent Factor Analysis</h3>
                        <div className="space-y-3">
                            {result.talentBreakdown.map(item => (
                                <div key={item.metric} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                                    <span className="text-sm text-slate-600 dark:text-slate-400">{item.metric}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.value}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                            isPositiveImpact(item.impact)
                                                ? 'bg-rz-data/10 text-rz-data'
                                                : isNegativeImpact(item.impact)
                                                    ? 'bg-red-500/10 text-red-400'
                                                    : 'bg-slate-500/10 text-slate-400'
                                        }`}>{item.impact}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Cost Summary */}
                        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Annual Staff Cost Impact</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">Base Annual Staff Cost</span>
                                    <span className="font-medium text-slate-900 dark:text-white">{fmtMoney(annualStaffCost)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">+ Salary Premium ({((result.adjustedSalaryMultiplier - 1) * 100).toFixed(0)}%)</span>
                                    <span className="font-medium text-amber-500">+{fmtMoney(result.adjustedAnnualStaffCost - annualStaffCost)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">+ Turnover Cost</span>
                                    <span className="font-medium text-red-500">+{fmtMoney(result.annualTurnoverCost)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600 dark:text-slate-400">+ Training Cost</span>
                                    <span className="font-medium text-rz-signal">+{fmtMoney(result.annualTrainingCost)}</span>
                                </div>
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">Talent-Adjusted Total</span>
                                    <span className="font-bold text-lg text-cyan-600 dark:text-cyan-400">
                                        {fmtMoney(result.adjustedAnnualStaffCost + result.annualTurnoverCost + result.annualTrainingCost)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Country Comparison */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Talent Score by Country</h3>
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={topNWithSelected(countryComparison, selectedCountry?.id)} layout="vertical" margin={{ left: 70 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                <YAxis dataKey="country" type="category" width={80} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <RTooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                    labelStyle={{ color: '#e2e8f0' }}
                                    formatter={(v: any, name: any) => [name === 'score' ? `${v}/100` : `+${v?.toFixed?.(0) ?? v}%`, name === 'score' ? 'Talent Score' : 'Salary Premium']}
                                />
                                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                                    {topNWithSelected(countryComparison, selectedCountry?.id).map((entry) => (
                                        <Cell
                                            key={entry.code}
                                            fill={entry.code === selectedCountry.id ? '#FFAA00' : entry.score >= 70 ? '#00FF88' : entry.score >= 45 ? '#f59e0b' : '#ef4444'}
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
    );
};

export default TalentDashboard;
