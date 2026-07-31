'use client';

/* ─── Site Intelligence Engine — page shell (Phase B) ────────────────────────
 * Multi-site comparison per the DC-OS reference (2.site inteligence.png).
 * KPI row + criteria bar + map/radar + site cards + detail panels +
 * comparison (absorbs the legacy engine factor breakdown) + sticky rail.
 * Sibling tabs tax/disaster/grid/talent/compliance stay untouched.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useSitesStore } from '@/store/sites';
import { useCapexStore } from '@/store/capex';
import { useEffectiveInputs } from '@/store/useEffectiveInputs';
import { scoreAllSites, buildAnalysisCtx, analyzeSite, type SiteAnalyses } from '@/lib/site-adapter';
import { COUNTRIES } from '@/constants/countries';
import { SiteMapPanel, SiteRadarPanel } from './SiteMapRadar';
import { SiteCards, SiteDetailPanels, IntegratedAnalysesPanels } from './SiteCardsPanels';
import { SiteComparisonTable, SiteRightRail, type AxisExplainSel } from './SiteComparisonRail';
import { SiteEditorDrawer } from './SiteEditorDrawer';
import { ScoreValue } from '@/components/ui/ScoreValue';
import { Tooltip } from '@/components/ui/Tooltip';
import { MapPin, Loader2 } from 'lucide-react';

const STRIP = [
    { id: 'sec-overview', label: '1 Overview' },
    { id: 'sec-map', label: '2 Location Analysis' },
    { id: 'sec-panels', label: '3-8 Detail Panels' },
    { id: 'sec-compare', label: '9 Site Score & Compare' },
];

export function SiteIntelligencePage() {
    const inputs = useSimulationStore((s) => s.inputs);
    const itLoadMw = inputs.itLoad / 1000;
    const capexTotal = useCapexStore((s) => s.results?.total ?? null);
    const eff = useEffectiveInputs();
    const { sites, selectedSiteId, selectSite } = useSitesStore();
    const [drawer, setDrawer] = React.useState(false);
    const [activeSec, setActiveSec] = React.useState(STRIP[0].id);
    /* Poor/Fair axis chip → explain panel (reason + solved levers) in the compare card */
    const [axisExplain, setAxisExplain] = React.useState<AxisExplainSel | null>(null);

    const results = React.useMemo(() => scoreAllSites(sites), [sites]);

    /* PHASE V — the 5 sibling analyses computed PER SITE (shared project ctx) */
    const analysesById = React.useMemo(() => {
        const map = new Map<string, SiteAnalyses>();
        try {
            const ctx = buildAnalysisCtx({
                itLoadKw: inputs.itLoad,
                tierLevel: (inputs.tierLevel === 4 ? 4 : inputs.tierLevel === 2 ? 2 : 3),
                coolingType: inputs.coolingType,
                capexTotal,
                headcounts: [eff.headcount_ShiftLead, eff.headcount_Engineer, eff.headcount_Technician, eff.headcount_Admin, eff.headcount_Janitor],
                countryId: sites[0]?.countryId ?? 'ID',
            });
            sites.forEach((s) => map.set(s.id, analyzeSite(s, ctx)));
        } catch { /* engines guarded individually too */ }
        return map;
    }, [sites, inputs.itLoad, inputs.tierLevel, inputs.coolingType, capexTotal, eff]);
    const best = results[0] ?? null;
    const bestSite = best ? sites.find((s) => s.id === best.siteId) : null;
    const selected = sites.find((s) => s.id === selectedSiteId) ?? sites[0] ?? null;
    const selectedResult = selected ? results.find((r) => r.siteId === selected.id) ?? null : null;

    React.useEffect(() => {
        const obs = new IntersectionObserver((es) => {
            const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            if (vis[0]) setActiveSec(vis[0].target.id);
        }, { rootMargin: '-15% 0px -70% 0px' });
        STRIP.forEach((t) => { const el = document.getElementById(t.id); if (el) obs.observe(el); });
        return () => obs.disconnect();
    }, []);

    if (results.length === 0) {
        return <div className="flex items-center justify-center p-12 text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Engine loading…</div>;
    }

    const kpi = selectedResult ?? best!;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rz-info/15 border border-rz-info/40">
                        <MapPin className="h-6 w-6 text-rz-info" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Site Intelligence Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Evaluate and compare candidate sites across power, connectivity, environment, risk, land and cost</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5">{sites.length} site{sites.length > 1 ? 's' : ''} selected <Tooltip content="Number of candidate sites currently being compared (1–5). Add or remove sites via Edit Criteria; with a single site the 'Overall Best' comparison degrades to a neutral candidate label." /></span>
                    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5">IT Load Target: <b className="text-slate-900 dark:text-white">{itLoadMw.toFixed(0)} MW</b> <Tooltip content="Target critical IT load the facility is sized for (MW), from the simulation inputs. Each site is screened on whether its available power, cooling and land can support this load." /></span>
                    <button onClick={() => setDrawer(true)} className="rounded-lg bg-rz-signal px-3 py-1.5 font-semibold text-black hover:bg-rz-signal/90">Edit Criteria</button>
                </div>
            </div>

            <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-1">
                {STRIP.map((t) => (
                    <button key={t.id} onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth' })}
                        className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${activeSec === t.id ? 'bg-rz-signal text-black' : 'text-slate-600 dark:text-slate-300 hover:bg-rz-signal/10'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
                <div className="min-w-0 space-y-4">
                    {/* KPI row — best-site card + 5 score cards through the shared
                      * ScoreValue primitive (Workstream M: semantic score color +
                      * Explain tooltip replaces the native title attr). */}
                    <div id="sec-overview" className="grid scroll-mt-24 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {(() => {
                            /* "Overall Best" is comparative — with a single site there is no
                             * comparison basis, so the card degrades to a neutral label. */
                            const bestCard = sites.length > 1
                                ? { label: 'Overall Best Site', value: bestSite ? `Site ${bestSite.label}` : '—', sub: bestSite?.name ?? '' }
                                : { label: 'Candidate Site', value: bestSite ? `Site ${bestSite.label}` : '—', sub: `${bestSite?.name ?? ''} · single site — add another to compare` };
                            return (
                                <div title={`${bestCard.label}: ${bestCard.value}${bestCard.sub ? ' — ' + bestCard.sub : ''}`} className="rounded-xl border border-rz-signal/50 bg-rz-signal/10 p-3">
                                    <div className="text-[10px] uppercase tracking-wide text-slate-500">{bestCard.label}</div>
                                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{bestCard.value}</div>
                                    <div className="truncate text-[10px] text-slate-500">{bestCard.sub}</div>
                                </div>
                            );
                        })()}
                        {([
                            { label: 'Total Score', value: kpi.engine.score, direction: 'higher', explainKey: 'site-overall-score', grade: kpi.engine.grade, sub: `${kpi.engine.grade} · ${kpi.engine.label}`, tip: 'Weighted composite of all 10 site factors (models.site.score) on a 0–100 scale — higher is better. The grade chip applies the shared score bands (good ≥70 · watch ≥40 · bad below).' },
                            { label: 'Availability Score', value: kpi.availabilityScore, direction: 'higher', explainKey: 'availability-score', sub: 'power + grid', tip: 'Power-availability sub-score (0–100, higher is better) combining grid reliability and power-infrastructure factors for this site. Weak grids drag the score down and usually demand more on-site generation or storage.' },
                            { label: 'Connectivity Score', value: kpi.connectivityScore, direction: 'higher', explainKey: 'connectivity-score', sub: 'latency + cables', tip: 'Network sub-score (0–100, higher is better) from latency to major hubs and subsea/terrestrial cable diversity. Poor connectivity limits the workloads the site can serve.' },
                            { label: 'Water & Cooling', value: kpi.waterCoolingScore, direction: 'higher', explainKey: 'water-cooling-score', sub: 'water + climate', tip: 'Cooling-feasibility sub-score (0–100, higher is better) from water availability/stress and the local climate’s suitability for free cooling. Low scores push designs toward dry coolers or immersion at higher cost.' },
                            { label: 'Risk Score', value: kpi.riskScore, direction: 'lower', explainKey: 'site-risk-score', sub: 'lower is better', tip: 'Composite natural-hazard risk (0–100) — LOWER is better, and the color scale is inverted accordingly. Driven by seismic, flood, typhoon and related country hazard attributes.' },
                        ] as { label: string; value: number; direction: 'higher' | 'lower'; explainKey: string; grade?: string; sub: string; tip: string }[]).map((k) => (
                            <div key={k.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</div>
                                <div>
                                    <ScoreValue value={k.value} unit="/100" direction={k.direction} max={100} explainKey={k.explainKey} tip={k.tip} grade={k.grade} className="text-lg" />
                                </div>
                                <div className="truncate text-[10px] text-slate-500">{k.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div id="sec-map" className="grid scroll-mt-24 gap-4 xl:grid-cols-2">
                        <SiteMapPanel sites={sites} results={results} selectedId={selected?.id ?? null} onSelect={selectSite} />
                        <SiteRadarPanel sites={sites} results={results} analysesById={analysesById} />
                    </div>

                    <SiteCards sites={sites} results={results} selectedId={selected?.id ?? null} onSelect={selectSite} />

                    {/* PHASE V — integrated per-site analyses (tax/disaster/grid/talent/compliance) */}
                    {selected && (
                        <IntegratedAnalysesPanels site={selected} analyses={analysesById.get(selected.id) ?? null} />
                    )}

                    <div id="sec-panels" className="scroll-mt-24">
                        <SiteDetailPanels site={selected} />
                    </div>

                    <SiteComparisonTable sites={sites} results={results} selectedId={selected?.id ?? null} analysesById={analysesById}
                        axisExplain={axisExplain} onExplainAxis={setAxisExplain} onEdit={() => setDrawer(true)} />

                    <p className="text-[10px] text-slate-400">
                        Country marked “EXAMPLE” sites carry illustrative attributes — edit via Edit Criteria. Country: {selected ? COUNTRIES[selected.countryId]?.name : '—'}.
                        Engine-real screening (models.site) — not a site survey.
                    </p>
                </div>

                <SiteRightRail sites={sites} results={results} selectedId={selected?.id ?? null} onSelect={selectSite} onEdit={() => setDrawer(true)}
                    onExplainAxis={setAxisExplain} />
            </div>

            <SiteEditorDrawer open={drawer} onClose={() => setDrawer(false)} />
        </div>
    );
}
