'use client';

import React, { useMemo, useState } from 'react';
import { REVENUE_PER_KW_MONTH, MAINT_PER_KW_YR } from '@/lib/screening';
import { topNWithSelected } from '@/lib/chart-utils';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { calculateTaxIncentives, TaxIncentiveResult } from '@/modules/analytics/TaxIncentiveEngine';
import { COUNTRIES } from '@/constants/countries';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import { ScoreValue } from '@/components/ui/ScoreValue';
import { TraceValue } from '@/components/ui/TraceValue';
import { RedValue, type Diagnosis } from '@/components/ui/RedValue';
import { RELATED_ARTICLES } from '@/lib/related-articles';
import { Receipt, DollarSign, TrendingUp, Calendar, Award, Gift, FileText, ChevronDown, ChevronUp, ArrowRight, ExternalLink } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell,
    AreaChart, Area, Line, ComposedChart,
} from 'recharts';
import { fmt, fmtMoney } from '@/lib/format';

/* ─── Sub-tabs (Maintenance tab idiom — Workstream P) ────────────────────────
 * Pure conditional render: no state resets, memos live at component level. */
type TaxTab = 'overview' | 'components' | 'timeline';

/** Model basis passed to calculateTaxIncentives — single constants shared by
 *  the engine call AND the Tier-2 savings decomposition, so the panel's
 *  discounting mirrors the engine's own math (no re-derivation). */
const DISCOUNT_RATE = 0.10;
const PROJECT_LIFE_YEARS = 20;
const EQUIPMENT_CAPEX_SHARE = 0.65;

const TaxIncentiveDashboard = () => {
    const { selectedCountry, inputs } = useSimulationStore();
    const capexStore = useCapexStore();
    const [activeTab, setActiveTab] = useState<TaxTab>('overview');
    const [showSavingsWhy, setShowSavingsWhy] = useState(false);

    const result = useMemo((): TaxIncentiveResult | null => {
        if (!selectedCountry) return null;
        const itLoad = capexStore.inputs.itLoad || inputs.itLoad;
        const totalCapex = capexStore.results?.total || itLoad * 10000;
        const annualRevenue = itLoad * REVENUE_PER_KW_MONTH * 12;
        const annualOpex = itLoad * MAINT_PER_KW_YR * 12;

        return calculateTaxIncentives({
            country: selectedCountry,
            totalCapex,
            annualRevenue,
            annualOpex,
            projectLifeYears: PROJECT_LIFE_YEARS,
            discountRate: DISCOUNT_RATE,
            equipmentCapexShare: EQUIPMENT_CAPEX_SHARE,
        });
    }, [selectedCountry, inputs, capexStore]);

    // Country incentive ranking
    const countryIncentiveData = useMemo(() => {
        return Object.values(COUNTRIES)
            .map(c => {
                const totalCapex = 10000000; // Normalized
                const r = calculateTaxIncentives({
                    country: c,
                    totalCapex,
                    annualRevenue: 3000000,
                    annualOpex: 1200000,
                    projectLifeYears: PROJECT_LIFE_YEARS,
                    discountRate: DISCOUNT_RATE,
                    equipmentCapexShare: EQUIPMENT_CAPEX_SHARE,
                });
                return { country: c.name, code: c.id, value: r.totalIncentiveValue, holiday: c.taxIncentives?.taxHolidayYears ?? 0 };
            })
            .sort((a, b) => b.value - a.value);
    }, []);

    /* ── Tier-2 savings decomposition (Workstream P) — reassembles the engine's
     * own totalIncentiveValue from its RESULT fields:
     *   totalIncentiveValue = Σ yearlyTaxSavings[y]/(1+d)^(y+1)   (holiday delta, PV)
     *                       + ftzBenefits + landSubsidyValue
     *                       + US-specific extras (bonus dep / ITC / state)
     * The US-specific bucket is the exact residual of the engine total minus the
     * three published components — never re-derived. Parity cross-check: the
     * engine's NPV uplift (npvWith − npvWithout) must equal the discounted tax
     * delta (identical cashflow difference, ± per-year $1 rounding). */
    const savingsDecomp = useMemo(() => {
        if (!result) return null;
        const discountedTaxPv = result.yearlyTaxSavings.reduce(
            (s, v, y) => s + v / Math.pow(1 + DISCOUNT_RATE, y + 1), 0);
        const usSpecific = result.totalIncentiveValue - result.ftzBenefits - result.landSubsidyValue - discountedTaxPv;
        const npvUplift = result.npvWithIncentives - result.npvWithoutIncentives;
        return {
            discountedTaxPv,
            usSpecific,
            npvUplift,
            /* rounding tolerance: yearlyTaxSavings are engine-rounded to $1/yr → PV drift < $25 over 20 yr */
            npvParityOk: Math.abs(npvUplift - discountedTaxPv) <= 25,
        };
    }, [result]);

    if (!result || !selectedCountry) {
        return <div className="p-8 text-center text-slate-500">Select a country to view tax incentive analysis.</div>;
    }

    /* ── Bottom-quartile check (Workstream N) vs the SAME normalized ranking the
     * chart renders — rank index ≥ ceil(0.75·n) fires a compact RedValue chip. */
    const rankIdx = countryIncentiveData.findIndex(c => c.code === selectedCountry.id);
    const nCountries = countryIncentiveData.length;
    const bottomQuartile = rankIdx >= 0 && rankIdx >= Math.ceil(0.75 * nCountries);
    const medianIncentive = countryIncentiveData[Math.floor(nCountries / 2)]?.value ?? 0;
    const leaderIncentive = countryIncentiveData[0];
    const selNormIncentive = rankIdx >= 0 ? countryIncentiveData[rankIdx].value : 0;
    const taxDiagnosis: Diagnosis | null = bottomQuartile ? {
        title: `Tax Incentive Value — Bottom Quartile (${selectedCountry.name})`,
        actual: `rank #${rankIdx + 1} of ${nCountries} (normalized NPV ${fmtMoney(selNormIncentive)})`,
        threshold: `above bottom quartile: rank < ${Math.ceil(0.75 * nCountries) + 1}`,
        reason: `${selectedCountry.name}'s incentive programs are weak against the benchmark set: normalized incentive NPV ${fmtMoney(selNormIncentive)} vs median ${fmtMoney(medianIncentive)} and leader ${leaderIncentive.country} ${fmtMoney(leaderIncentive.value)} — same normalized basis ($10M capex) as the ranking chart on this page. Incentives are a jurisdiction attribute, not a tunable project input.`,
        levers: [
            { label: 'Compare countries', detail: 'Evaluate alternative jurisdictions in Site Intelligence — the ranking chart below shows which profiles carry materially stronger programs.', tab: 'site' },
        ],
        tab: 'site',
        references: RELATED_ARTICLES.tax,
        note: 'Ranking basis: calculateTaxIncentives per country at normalized $10M capex / $3M revenue / $1.2M opex, 20 yr @10% discount.',
    } : null;

    const stdRatePct = selectedCountry.economy.taxRate * 100;
    const irrUplift = result.irrWithIncentives - result.irrWithoutIncentives;

    // Tax timeline chart data
    const timelineData = result.effectiveTaxTimeline.map((rate, i) => ({
        year: i + 1,
        effectiveRate: Math.round(rate * 1000) / 10,
        standardRate: Math.round(selectedCountry.economy.taxRate * 1000) / 10,
        savings: result.yearlyTaxSavings[i],
    }));

    /* Regulation-cited programs (Workstream O data — 10 priority markets carry
     * `programs`; other countries fall back to legacy name-only strings). */
    const programs = selectedCountry.taxIncentives?.programs;
    const legacyPrograms = selectedCountry.taxIncentives?.incentivePrograms ?? [];
    const ftzZones = selectedCountry.taxIncentives?.freeTradeZones ?? [];
    const holidayYears = selectedCountry.taxIncentives?.taxHolidayYears ?? 0;
    const holidayRatePct = (selectedCountry.taxIncentives?.taxHolidayRate ?? selectedCountry.economy.taxRate) * 100;
    const effectiveY1Pct = result.effectiveTaxTimeline[0] * 100;

    const TABS: { id: TaxTab; label: string; icon: React.ReactNode }[] = [
        { id: 'overview', label: 'Overview', icon: <Receipt className="w-4 h-4" /> },
        { id: 'components', label: 'Components & Regulations', icon: <FileText className="w-4 h-4" /> },
        { id: 'timeline', label: 'Timeline', icon: <Calendar className="w-4 h-4" /> },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Receipt className="w-6 h-6 text-rz-data" />
                    Tax & Incentive Analysis
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {selectedCountry.name} · Standard Rate: {(selectedCountry.economy.taxRate * 100).toFixed(1)}% · Holiday: {selectedCountry.taxIncentives?.taxHolidayYears ?? 0} years
                </p>
            </div>

            {/* Sub-tab navigation (Maintenance idiom) */}
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-900 border border-transparent'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══ OVERVIEW ═══ */}
            {activeTab === 'overview' && (<>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="w-4 h-4 text-rz-data" />
                            <span className="text-xs text-slate-500 uppercase">Total Savings</span>
                            <Tooltip content="Net present value of all tax incentives over the project lifetime." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white"><TraceValue traceId="site.taxIncentiveValue">{fmtMoney(result.totalIncentiveValue)}</TraceValue></div>
                        <div className="text-xs text-rz-data mt-1">NPV of incentives</div>
                        {/* Tier-2 toggle — SIBLING of the TraceValue button, never nested */}
                        <button
                            type="button"
                            onClick={() => setShowSavingsWhy(v => !v)}
                            aria-expanded={showSavingsWhy}
                            className="mt-1 text-[10px] text-slate-500 underline decoration-dotted underline-offset-2 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-0.5">
                            why this value? {showSavingsWhy ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {taxDiagnosis && (
                            <div className="mt-1">
                                <RedValue diagnosis={taxDiagnosis} className="w-fit">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 inline-flex items-center">
                                        Bottom quartile — why?
                                    </span>
                                </RedValue>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-slate-500 uppercase">Effective Rate Y1</span>
                            <Tooltip content="Actual tax burden after all incentives, credits, and deductions are applied." />
                        </div>
                        <div><ScoreValue value={result.effectiveTaxTimeline[0] * 100} display={`${(result.effectiveTaxTimeline[0] * 100).toFixed(1)}%`} direction="lower" max={stdRatePct > 0 ? stdRatePct : 1} className="text-2xl" tip={`Year-1 effective tax rate after all incentives. Color scale 0–${stdRatePct.toFixed(1)}% (the ${selectedCountry.name} standard rate): 0% (full tax holiday) green → paying the full standard rate red. No ƒx trace — the trace node carries the country baseline rate, not this incentive-adjusted Y1 figure.`} /></div>
                        <div className="text-xs text-slate-500 mt-1">vs {(selectedCountry.economy.taxRate * 100).toFixed(1)}% standard</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-cyan-500" />
                            <span className="text-xs text-slate-500 uppercase">NPV Uplift</span>
                            <Tooltip content="Net Present Value of all tax benefits over the project lifecycle. Key input for site selection." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white"><TraceValue traceId="site.taxNpvUplift">{fmtMoney(result.npvWithIncentives - result.npvWithoutIncentives)}</TraceValue></div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-rz-mint" />
                            <span className="text-xs text-slate-500 uppercase">IRR Uplift</span>
                            <Tooltip content="Increase in Internal Rate of Return attributable to tax incentives. Higher uplift makes the jurisdiction more attractive." />
                        </div>
                        <div><ScoreValue value={irrUplift} display={`+${irrUplift.toFixed(1)}%`} direction="higher" max={10} className="text-2xl" tip="IRR percentage-point uplift attributable to incentives. Color scale 0–10 pp: no uplift red → ≥10 pp green (a strong-incentive jurisdiction on the model's screening basis). No ƒx trace — the trace node carries the with-incentive IRR, not this uplift." /></div>
                        <div className="text-xs text-slate-500 mt-1">{result.irrWithIncentives.toFixed(1)}% vs {result.irrWithoutIncentives.toFixed(1)}%</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Gift className="w-4 h-4 text-amber-500" />
                            <span className="text-xs text-slate-500 uppercase">FTZ Savings</span>
                            <Tooltip content="Exemption or reduction on import duties for data center equipment and construction materials." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white"><TraceValue traceId="site.taxFtz">{fmtMoney(result.ftzBenefits)}</TraceValue></div>
                        <div className="text-xs text-slate-500 mt-1">import duty saved</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Award className="w-4 h-4 text-yellow-500" />
                            <span className="text-xs text-slate-500 uppercase">Ranking</span>
                            <Tooltip content="Country's position in the incentive value ranking, normalized across all available jurisdictions." />
                        </div>
                        <div><ScoreValue value={rankIdx + 1} display={`#${rankIdx + 1}`} direction="lower" max={nCountries} className="text-2xl" /></div>
                        <div className="text-xs text-slate-500 mt-1">of {nCountries} countries</div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Tier-2 "why this value?" panel — decomposes Total Savings from the
              *    engine's OWN result fields (yearlyTaxSavings PV + ftzBenefits +
              *    landSubsidyValue + exact US-specific residual). ── */}
            {showSavingsWhy && savingsDecomp && (
                <Card className="bg-white dark:bg-slate-800/50 border-cyan-300 dark:border-cyan-500/40">
                    <CardContent className="pt-5 space-y-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                    Why {fmtMoney(result.totalIncentiveValue)}? — NPV decomposition ({selectedCountry.name})
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Reassembled from the same calculateTaxIncentives result the KPIs render — basis {PROJECT_LIFE_YEARS} yr @ {(DISCOUNT_RATE * 100).toFixed(0)}% discount, equipment share {(EQUIPMENT_CAPEX_SHARE * 100).toFixed(0)}%.
                                </p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded border h-fit ${savingsDecomp.npvParityOk
                                ? 'text-emerald-500 border-emerald-500/40 bg-emerald-500/10'
                                : 'text-amber-500 border-amber-500/40 bg-amber-500/10'}`}>
                                {savingsDecomp.npvParityOk
                                    ? `≡ engine: NPV uplift ${fmtMoney(savingsDecomp.npvUplift)} = Σ discounted tax deltas`
                                    : `⚠ NPV uplift ${fmtMoney(savingsDecomp.npvUplift)} ≠ Σ discounted tax deltas ${fmtMoney(Math.round(savingsDecomp.discountedTaxPv))} — decomposition drift`}
                            </span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between gap-3 p-2 rounded bg-slate-50 dark:bg-slate-900/30">
                                <span className="text-slate-700 dark:text-slate-300">
                                    Annual tax delta (standard {stdRatePct.toFixed(1)}% vs effective), discounted @ {(DISCOUNT_RATE * 100).toFixed(0)}% over {PROJECT_LIFE_YEARS} yr
                                    {holidayYears > 0 ? ` — ${holidayYears}-yr holiday at ${holidayRatePct.toFixed(1)}%` : ' — no tax holiday in this jurisdiction'}
                                </span>
                                <span className="font-mono tabular-nums text-slate-900 dark:text-white shrink-0">{fmtMoney(Math.round(savingsDecomp.discountedTaxPv))}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 p-2 rounded bg-slate-50 dark:bg-slate-900/30">
                                <span className="text-slate-700 dark:text-slate-300">FTZ import-duty savings (equipment share × duty rate{selectedCountry.taxIncentives?.importDutyExemption ? '' : ' — no exemption'})</span>
                                <span className="font-mono tabular-nums text-slate-900 dark:text-white shrink-0">{fmtMoney(result.ftzBenefits)}</span>
                            </div>
                            {result.landSubsidyValue > 0 && (
                                <div className="flex items-center justify-between gap-3 p-2 rounded bg-slate-50 dark:bg-slate-900/30">
                                    <span className="text-slate-700 dark:text-slate-300">Government land subsidy (engine estimate: 15% of land at ~9% of CAPEX)</span>
                                    <span className="font-mono tabular-nums text-slate-900 dark:text-white shrink-0">{fmtMoney(result.landSubsidyValue)}</span>
                                </div>
                            )}
                            {Math.abs(savingsDecomp.usSpecific) > 1 && (
                                <div className="flex items-center justify-between gap-3 p-2 rounded bg-slate-50 dark:bg-slate-900/30">
                                    <span className="text-slate-700 dark:text-slate-300">US-specific extras (bonus depreciation / IRA ITC / state exemptions) — exact residual of the engine total</span>
                                    <span className="font-mono tabular-nums text-slate-900 dark:text-white shrink-0">{fmtMoney(Math.round(savingsDecomp.usSpecific))}</span>
                                </div>
                            )}
                            <div className="flex items-center justify-between gap-3 p-2 rounded border-t border-slate-200 dark:border-slate-700 font-semibold">
                                <span className="text-slate-900 dark:text-white">Total Savings (engine totalIncentiveValue)</span>
                                <span className="font-mono tabular-nums text-cyan-600 dark:text-cyan-400 shrink-0">{fmtMoney(result.totalIncentiveValue)}</span>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500">
                            All rows are engine result fields (yearlyTaxSavings, ftzBenefits, landSubsidyValue) — the panel only discounts the published
                            yearly savings at the same {(DISCOUNT_RATE * 100).toFixed(0)}% the page passed to the engine; nothing is re-derived.
                            Regulation citations for each program are in the Components &amp; Regulations tab.
                        </p>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Country Comparison */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Incentive Value Ranking (NPV, Normalized)</h3>
                        <ResponsiveContainer width="100%" height={420}>
                            <BarChart data={topNWithSelected(countryIncentiveData, selectedCountry?.id)} layout="vertical" margin={{ left: 70 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => fmtMoney(v)} />
                                <YAxis dataKey="country" type="category" width={80} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <RTooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                    formatter={(v: any, name: any) => [fmtMoney(v), name === 'value' ? 'Incentive NPV' : 'Holiday Years']}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                    {topNWithSelected(countryIncentiveData, selectedCountry?.id).map((entry) => (
                                        <Cell
                                            key={entry.code}
                                            fill={entry.code === selectedCountry.id ? '#00FF88' : '#00DDFF'}
                                            opacity={entry.code === selectedCountry.id ? 1 : 0.5}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Programs summary + FTZ (engine incentiveSummary — moved from the timeline card) */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        {/* Incentive Programs */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Available Incentive Programs</h4>
                            <ul className="space-y-1">
                                {result.incentiveSummary.map((item, i) => (
                                    <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                        <span className="text-rz-data mt-0.5">•</span> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* FTZ List */}
                        {selectedCountry.taxIncentives?.freeTradeZones && selectedCountry.taxIncentives.freeTradeZones.length > 0 && (
                            <div className="mt-3 p-3 bg-cyan-50 dark:bg-cyan-900/10 rounded-lg border border-cyan-200 dark:border-cyan-800/30">
                                <h4 className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 mb-1">Free Trade Zones</h4>
                                <p className="text-xs text-cyan-600 dark:text-cyan-500">{selectedCountry.taxIncentives.freeTradeZones.join(' · ')}</p>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => setActiveTab('components')}
                            className="mt-3 text-xs px-2.5 py-1 rounded border border-cyan-500/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 flex items-center gap-1"
                        >
                            Regulation citations per program <ArrowRight className="w-3 h-3" />
                        </button>
                    </CardContent>
                </Card>
            </div>
            </>)}

            {/* ═══ COMPONENTS & REGULATIONS ═══ */}
            {activeTab === 'components' && (<div className="space-y-6">
                {/* SCREENING banner */}
                <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-900/10 text-xs text-amber-700 dark:text-amber-400">
                    <span className="font-bold uppercase mr-2">Screening reference</span>
                    Regulation citations orient the diligence — tax counsel verifies eligibility &amp; current status of every program before
                    any investment decision. Incentive regimes are amended frequently; a cite is a starting point, not a legal opinion.
                </div>

                {/* Effective-rate decomposition strip — from the SAME engine result as the KPIs */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-5">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            Effective-rate decomposition
                            <Tooltip content="How the statutory rate becomes the Year-1 effective rate: standard corporate income tax → holiday rate during the incentive window → the Year-1 effective rate the engine timeline reports. Same result.effectiveTaxTimeline as the Timeline tab." />
                        </h3>
                        <div className="flex flex-wrap items-stretch gap-2 text-center">
                            <div className="flex-1 min-w-[140px] p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700">
                                <div className="text-[10px] uppercase text-slate-500">Standard rate</div>
                                <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">{stdRatePct.toFixed(1)}%</div>
                                <div className="text-[10px] text-slate-500">statutory CIT</div>
                            </div>
                            <div className="self-center text-slate-400"><ArrowRight className="w-4 h-4" /></div>
                            <div className="flex-1 min-w-[140px] p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700">
                                <div className="text-[10px] uppercase text-slate-500">Holiday rate</div>
                                <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">{holidayYears > 0 ? `${holidayRatePct.toFixed(1)}%` : '—'}</div>
                                <div className="text-[10px] text-slate-500">{holidayYears > 0 ? `years 1–${holidayYears}` : 'no holiday program'}</div>
                            </div>
                            <div className="self-center text-slate-400"><ArrowRight className="w-4 h-4" /></div>
                            <div className="flex-1 min-w-[140px] p-3 rounded-lg bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-200 dark:border-cyan-800/30">
                                <div className="text-[10px] uppercase text-cyan-700 dark:text-cyan-400">Effective Y1</div>
                                <div className="text-xl font-bold font-mono text-cyan-700 dark:text-cyan-400">{effectiveY1Pct.toFixed(1)}%</div>
                                <div className="text-[10px] text-cyan-600 dark:text-cyan-500">engine timeline year 1</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Program table — regulation-cited (10 priority markets) or honest legacy fallback */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-5">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                            Incentive components — {selectedCountry.name}
                        </h3>
                        {programs && programs.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-left text-[10px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                            <th className="py-2 pr-3"><span className="inline-flex items-center gap-1">Program <Tooltip content="Official incentive program name as promoted by the jurisdiction's investment authority." /></span></th>
                                            <th className="py-2 pr-3"><span className="inline-flex items-center gap-1">Regulation <Tooltip content="The legal instrument establishing the program (ministerial decree, statute section, government regulation). Cite the exact instrument in diligence memos — counsel verifies the current amendment status." /></span></th>
                                            <th className="py-2 pr-3"><span className="inline-flex items-center gap-1">Benefit <Tooltip content="What the program actually grants (rate reduction, deduction, exemption) — the economic substance behind the marketing name." /></span></th>
                                            <th className="py-2 pr-3"><span className="inline-flex items-center gap-1">Eligibility <Tooltip content="Who and what qualifies — investment floors, sector lists, location bounds. Blank when the source regulation does not restrict eligibility narrowly." /></span></th>
                                            <th className="py-2"><span className="inline-flex items-center gap-1">Notes <Tooltip content="Application path, predecessor regulations, and location-bound caveats." /></span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {programs.map((p, i) => (
                                            <tr key={i} className="border-b border-slate-100 dark:border-slate-800 align-top">
                                                <td className="py-2 pr-3 font-medium text-slate-900 dark:text-white">{p.name}</td>
                                                <td className="py-2 pr-3">
                                                    {p.url ? (
                                                        <a href={p.url} target="_blank" rel="noopener noreferrer"
                                                            className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-cyan-700 dark:text-cyan-400 inline-flex items-center gap-1 hover:border-cyan-400">
                                                            {p.cite} <ExternalLink className="w-2.5 h-2.5" />
                                                        </a>
                                                    ) : (
                                                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-cyan-700 dark:text-cyan-400 inline-block">
                                                            {p.cite}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2 pr-3 text-slate-600 dark:text-slate-400">{p.benefit}</td>
                                                <td className="py-2 pr-3 text-slate-600 dark:text-slate-400">{p.eligibility ?? '—'}</td>
                                                <td className="py-2 text-slate-500">{p.note ?? '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {legacyPrograms.length > 0 ? (
                                    <ul className="space-y-1">
                                        {legacyPrograms.map((p, i) => (
                                            <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                                <span className="text-rz-data mt-0.5">•</span> {p}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-slate-500">No named incentive programs in this country profile.</p>
                                )}
                                <p className="text-[11px] text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-2">
                                    Regulation-cited breakdown is available for 10 priority markets (ID · SG · MY · US · AE · SA · QA · OM · JP · IN) —
                                    this country profile carries program names only.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* FTZ per-zone chips */}
                {ftzZones.length > 0 && (
                    <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                        <CardContent className="pt-5">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                Free Trade Zones
                                <Tooltip content="Zones where the import-duty exemption modeled in the FTZ Savings KPI applies. Zone selection is a siting decision — the duty saving only materializes for equipment landed through the zone." />
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {ftzZones.map(z => (
                                    <span key={z} className="text-xs px-2.5 py-1 rounded-full border border-cyan-300 dark:border-cyan-700/50 bg-cyan-50 dark:bg-cyan-900/10 text-cyan-700 dark:text-cyan-400">
                                        {z}
                                    </span>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2">
                                Modeled duty saving: {fmtMoney(result.ftzBenefits)} on {(EQUIPMENT_CAPEX_SHARE * 100).toFixed(0)}% equipment CAPEX share
                                {selectedCountry.taxIncentives?.importDutyExemption ? '' : ' (no exemption flagged for this profile)'}.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>)}

            {/* ═══ TIMELINE ═══ */}
            {activeTab === 'timeline' && (
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Tax Rate Timeline (Standard vs Effective)</h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <ComposedChart data={timelineData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} label={{ value: 'Year', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} label={{ value: 'Tax Rate %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
                                <RTooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                    labelStyle={{ color: '#e2e8f0' }}
                                    formatter={(v: any, name: any) => {
                                        if (name === 'savings') return [fmtMoney(v), 'Tax Savings'];
                                        return [`${v}%`, name === 'effectiveRate' ? 'Effective Rate' : 'Standard Rate'];
                                    }}
                                />
                                <Area type="stepAfter" dataKey="standardRate" fill="#ef4444" fillOpacity={0.1} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1} />
                                <Area type="stepAfter" dataKey="effectiveRate" fill="#00FF88" fillOpacity={0.2} stroke="#00FF88" strokeWidth={2} />
                                <Bar dataKey="savings" fill="#06b6d4" opacity={0.3} />
                            </ComposedChart>
                        </ResponsiveContainer>
                        <p className="text-[10px] text-slate-500 mt-2">
                            Bars = annual tax savings (standard − effective, engine yearlyTaxSavings); the discounted sum of these bars is the
                            holiday component of Total Savings — decomposed under &ldquo;why this value?&rdquo; on the Overview tab.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default TaxIncentiveDashboard;
