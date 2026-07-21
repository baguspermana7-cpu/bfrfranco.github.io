'use client';

/* ─── Site cards row + 6 detail panels (Phase B) ─────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { COUNTRIES } from '@/constants/countries';
import { panelData, type PanelValue, type SiteAnalyses } from '@/lib/site-adapter';
import type { CandidateSite, SiteScoreResult } from '@/types/site-intel';
import { SITE_COLORS } from './SiteMapRadar';
import { TraceValue } from '@/components/ui/TraceValue';
import { Zap, Network, Leaf, ShieldAlert, LandPlot, Coins } from 'lucide-react';

export function SiteCards({ sites, results, selectedId, onSelect }: {
    sites: CandidateSite[]; results: SiteScoreResult[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
    const itLoadMw = useSimulationStore((s) => s.inputs.itLoad) / 1000;
    const tier = useSimulationStore((s) => s.inputs.tierLevel);
    return (
        <div className="grid gap-3 md:grid-cols-3">
            {sites.map((s, i) => {
                const r = results.find((x) => x.siteId === s.id);
                /* "Recommended" is a COMPARATIVE label — never render it when only one
                 * site exists (no comparison basis); fall back to the engine grade. */
                const isTop = results.length > 1 && r?.rank === 1;
                const badge = isTop ? 'Recommended' : (r?.engine.grade === 'A' || r?.engine.grade === 'B') ? 'Good' : r?.engine.label ?? '—';
                return (
                    <button key={s.id} onClick={() => onSelect(s.id)}
                        className={`rounded border p-3 text-left transition-colors ${s.id === selectedId ? 'border-rz-signal bg-rz-signal/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-rz-signal/60'}`}>
                        <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-slate-900" style={{ background: SITE_COLORS[i] }}>{s.label}</span>
                            <span className="truncate text-xs font-semibold text-slate-900 dark:text-white">{s.name}</span>
                            {s.isExample && <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-semibold text-amber-500">EXAMPLE</span>}
                            <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${isTop ? 'bg-rz-data/15 text-rz-data' : 'bg-slate-500/15 text-slate-400'}`}>{badge}</span>
                        </div>
                        <div className="mt-1.5 text-xl font-bold tabular-nums text-slate-900 dark:text-white">{r ? r.engine.score : '—'}<span className="text-xs text-slate-400">/100</span></div>
                        <div className="mt-1 flex flex-wrap gap-1 text-[9px] text-slate-500">
                            <span className="rounded bg-slate-500/10 px-1 py-0.5">{(s.targetItLoadMw ?? itLoadMw).toFixed(0)} MW</span>
                            {s.attributes.totalAcres != null && <span className="rounded bg-slate-500/10 px-1 py-0.5">{s.attributes.totalAcres} acres</span>}
                            <span className="rounded bg-slate-500/10 px-1 py-0.5">Tier {tier}</span>
                            <span className="rounded bg-slate-500/10 px-1 py-0.5">{COUNTRIES[s.countryId]?.name ?? s.countryId}</span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

const PANELS: { key: keyof ReturnType<typeof panelData>; title: string; icon: React.ElementType; linkTab?: string; linkLabel?: string }[] = [
    { key: 'power', title: 'Power & Utilities', icon: Zap, linkTab: 'grid', linkLabel: 'View Power Analysis' },
    { key: 'connectivity', title: 'Connectivity', icon: Network },
    { key: 'environmental', title: 'Environmental Conditions', icon: Leaf },
    { key: 'risks', title: 'Natural Risks', icon: ShieldAlert, linkTab: 'disaster', linkLabel: 'View Risk Analysis' },
    { key: 'land', title: 'Land & Infrastructure', icon: LandPlot },
    { key: 'cost', title: 'Cost & Incentives', icon: Coins, linkTab: 'tax', linkLabel: 'View Incentives & Tax' },
];

/* Value-Trace ids for the country-baseline leaves rendered in the detail panels
 * (label → traceId; nodes registered at the bottom of lib/value-trace.ts). */
const DETAIL_TRACE: Record<string, string> = {
    'SAIDI': 'site.saidi',
    'Power Cost': 'site.powerCostKwh',
    'Air Quality Index': 'site.airQuality',
    'Water Stress (WRI)': 'site.waterStress',
    'PGA (2% in 50yr)': 'site.pga',
    'Effective Tax Rate': 'site.effTaxRate',
};

function Provenance({ source }: { source: PanelValue['source'] }) {
    const color = source === 'site' ? 'bg-rz-mint' : source === 'country' ? 'bg-cyan-500' : 'bg-slate-500';
    const title = source === 'site' ? 'site attribute' : source === 'country' ? 'country baseline' : 'not set';
    return <span title={title} className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />;
}

export function SiteDetailPanels({ site }: { site: CandidateSite | null }) {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    if (!site) return null;
    const data = panelData(site);
    return (
        <div>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Detail Panels — Site {site.label} · {site.name}
                <span className="ml-2 text-[9px] normal-case text-slate-400">● mint = site attribute · ● cyan = country baseline</span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {PANELS.map((p) => {
                    const rows = data[p.key].filter((r) => r.value !== '—').slice(0, 8);
                    const empty = data[p.key].length - rows.length;
                    return (
                        <div key={p.key} className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                            <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                <p.icon className="h-3.5 w-3.5 text-rz-mint" /> {p.title}
                            </h3>
                            <div className="space-y-1">
                                {rows.length === 0 && <p className="text-[10px] text-slate-400">No data — edit via Edit Criteria.</p>}
                                {rows.map((r) => {
                                    const tid = DETAIL_TRACE[r.label];
                                    const valueEl = <span className="font-medium tabular-nums text-slate-800 dark:text-slate-200">{r.value}</span>;
                                    return (
                                        <div key={r.label} className="flex items-center justify-between gap-2 text-[11px]">
                                            <span className="flex items-center gap-1.5 text-slate-500"><Provenance source={r.source} />{r.label}</span>
                                            {tid ? <TraceValue traceId={tid}>{valueEl}</TraceValue> : valueEl}
                                        </div>
                                    );
                                })}
                                {empty > 0 && <p className="text-[9px] text-slate-400">+{empty} unset field(s)</p>}
                            </div>
                            {p.linkTab && (
                                <button onClick={() => setActiveTab(p.linkTab as never)}
                                    className="mt-2 text-[10px] font-medium text-rz-mint hover:text-rz-mint/80">{p.linkLabel} →</button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ─── PHASE V — integrated analyses panels (5 sibling engines PER SITE) ────── */

const fm = (v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${Math.round(v)}`;

export function IntegratedAnalysesPanels({ site, analyses }: { site: CandidateSite; analyses: SiteAnalyses | null }) {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    if (!analyses) return null;
    const { grid, disaster, tax, talent, compliance } = analyses;
    const card = 'rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3';
    const row = (label: string, value: string, title?: string, traceId?: string) => {
        const valueEl = <span className="font-medium tabular-nums text-slate-800 dark:text-slate-200">{value}</span>;
        return (
            <div key={label} className="flex items-center justify-between gap-2 text-[11px]" title={title ?? `${label}: ${value}`}>
                <span className="flex items-center gap-1.5 text-slate-500"><span className="inline-block h-1.5 w-1.5 rounded-full bg-rz-data" title="computed by the sibling engine" />{label}</span>
                {traceId ? <TraceValue traceId={traceId}>{valueEl}</TraceValue> : valueEl}
            </div>
        );
    };
    return (
        <div>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Integrated Analyses — Site {site.label} · computed per site by the tax / disaster / grid / talent / compliance engines
                <span className="ml-2 text-[9px] normal-case text-rz-data">● engine-computed</span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className={card}>
                    <h3 className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Grid Reliability
                        {grid && <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${grid.reliabilityGrade === 'A' ? 'bg-rz-data/15 text-rz-data' : grid.reliabilityGrade === 'B' ? 'bg-lime-500/15 text-lime-500' : 'bg-amber-500/15 text-amber-500'}`}>Grade {grid.reliabilityGrade}</span>}
                    </h3>
                    {grid ? (
                        <div className="space-y-1">
                            {row('Reliability score', `${Math.round(grid.reliabilityScore)}/100`, undefined, 'site.gridScore')}
                            {row('Expected outages', `${grid.annualExpectedOutages.toFixed(1)}/yr`, undefined, 'site.gridOutages')}
                            {row('Outage minutes', `${Math.round(grid.annualOutageMinutes)} min/yr`, undefined, 'site.gridOutageMin')}
                            {row('Required gen capacity', `${(grid.requiredGenCapacity / 1000).toFixed(1)} MW`, undefined, 'site.gridGenCapacity')}
                            {row('Annual fuel cost', fm(grid.annualFuelCost), undefined, 'site.gridFuelCost')}
                        </div>
                    ) : <p className="text-[10px] text-slate-400">Engine loading…</p>}
                    <p className="mt-1 text-[9px] text-slate-400">Outage min/yr = blended engine model (brownout events + SAIDI-derived interruptions) — the SAIDI figure in Detail Panels is the raw country baseline, so the two differ by design.</p>
                    <button onClick={() => setActiveTab('grid' as never)} className="mt-2 text-[10px] font-medium text-rz-mint hover:text-rz-mint/80">Grid deep-dive →</button>
                </div>
                <div className={card}>
                    <h3 className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Disaster Risk
                        {disaster && <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${disaster.riskCategory === 'Low' ? 'bg-rz-data/15 text-rz-data' : disaster.riskCategory === 'Moderate' ? 'bg-amber-500/15 text-amber-500' : 'bg-rose-500/15 text-rose-500'}`}>{disaster.riskCategory}</span>}
                    </h3>
                    {disaster ? (
                        <div className="space-y-1">
                            {row('Composite risk', `${Math.round(disaster.compositeScore)}/100 (lower better)`, undefined, 'site.riskComposite')}
                            {row('Insurance', `${fm(disaster.annualInsuranceCost)}/yr`, undefined, 'site.riskInsurance')}
                            {row('Expected annual loss', fm(disaster.expectedAnnualLoss), undefined, 'site.riskEal')}
                            {row('Bus. interruption', `${disaster.businessInterruptionDays.toFixed(1)} days`, undefined, 'site.riskBiDays')}
                            {row('Revenue at risk', fm(disaster.revenueAtRisk), undefined, 'site.riskRevenueAtRisk')}
                        </div>
                    ) : <p className="text-[10px] text-slate-400">Engine loading…</p>}
                    <button onClick={() => setActiveTab('disaster' as never)} className="mt-2 text-[10px] font-medium text-rz-mint hover:text-rz-mint/80">Risk deep-dive →</button>
                </div>
                <div className={card}>
                    <h3 className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Tax & Incentives
                        {tax && <span className="rounded bg-rz-mint/15 px-1.5 py-0.5 text-[9px] font-bold text-rz-mint">rank #{tax.countryRanking}</span>}
                    </h3>
                    {tax ? (
                        <div className="space-y-1">
                            {row('Total incentive value', fm(tax.totalIncentiveValue), 'Total incentive value over 15 years', 'site.taxIncentiveValue')}
                            {row('FTZ benefits', fm(tax.ftzBenefits), undefined, 'site.taxFtz')}
                            {row('NPV with incentives', fm(tax.npvWithIncentives), undefined, 'site.taxNpvWith')}
                            {row('NPV uplift', fm(Math.max(0, tax.npvWithIncentives - tax.npvWithoutIncentives)), undefined, 'site.taxNpvUplift')}
                            {row('IRR w/ incentives', `${tax.irrWithIncentives.toFixed(1)}%`, undefined, 'site.taxIrrWith')}
                        </div>
                    ) : <p className="text-[10px] text-slate-400">Engine loading…</p>}
                    <button onClick={() => setActiveTab('tax' as never)} className="mt-2 text-[10px] font-medium text-rz-mint hover:text-rz-mint/80">Incentives deep-dive →</button>
                </div>
                <div className={card}>
                    <h3 className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Talent Availability
                        {talent && <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${talent.hiringDifficulty === 'Easy' ? 'bg-rz-data/15 text-rz-data' : talent.hiringDifficulty === 'Moderate' ? 'bg-amber-500/15 text-amber-500' : 'bg-rose-500/15 text-rose-500'}`}>{talent.hiringDifficulty}</span>}
                    </h3>
                    {talent ? (
                        <div className="space-y-1">
                            {row('Talent score', `${Math.round(talent.talentScore)}/100`, undefined, 'site.talentScore')}
                            {row('Time to full staff', `${talent.timeToFullStaff.toFixed(1)} mo`, undefined, 'site.talentTimeToStaff')}
                            {row('Recruitment cost', fm(talent.totalRecruitmentCost), undefined, 'site.talentRecruitCost')}
                            {row('Annual training', fm(talent.annualTrainingCost), undefined, 'site.talentTraining')}
                            {row('Turnover rate', `${(talent.adjustedTurnoverRate * 100).toFixed(1)}%/yr`, undefined, 'site.talentTurnover')}
                        </div>
                    ) : <p className="text-[10px] text-slate-400">Engine loading…</p>}
                    <button onClick={() => setActiveTab('talent' as never)} className="mt-2 text-[10px] font-medium text-rz-mint hover:text-rz-mint/80">Talent deep-dive →</button>
                </div>
                <div className={card}>
                    <h3 className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Compliance
                        {compliance && <TraceValue traceId="site.compScore"><span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan-500">{Math.round(compliance.complianceScore)}/100</span></TraceValue>}
                    </h3>
                    {compliance ? (
                        <div className="space-y-1">
                            {row('Mandatory items', String(compliance.mandatoryCount), undefined, 'site.compMandatory')}
                            {row('Initial cost', fm(compliance.totalInitialCost), undefined, 'site.compInitialCost')}
                            {row('Annual cost', fm(compliance.totalAnnualCost), undefined, 'site.compAnnualCost')}
                        </div>
                    ) : <p className="text-[10px] text-slate-400">Engine loading…</p>}
                    <button onClick={() => setActiveTab('compliance' as never)} className="mt-2 text-[10px] font-medium text-rz-mint hover:text-rz-mint/80">Compliance deep-dive →</button>
                </div>
            </div>
        </div>
    );
}
