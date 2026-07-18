'use client';

/* ─── Site cards row + 6 detail panels (Phase B) ─────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { COUNTRIES } from '@/constants/countries';
import { panelData, type PanelValue } from '@/lib/site-adapter';
import type { CandidateSite, SiteScoreResult } from '@/types/site-intel';
import { SITE_COLORS } from './SiteMapRadar';
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
                const badge = r?.rank === 1 ? 'Recommended' : (r?.engine.grade === 'A' || r?.engine.grade === 'B') ? 'Good' : r?.engine.label ?? '—';
                return (
                    <button key={s.id} onClick={() => onSelect(s.id)}
                        className={`rounded-2xl border p-3 text-left transition-colors ${s.id === selectedId ? 'border-violet-500 bg-violet-600/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-violet-400/60'}`}>
                        <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-slate-900" style={{ background: SITE_COLORS[i] }}>{s.label}</span>
                            <span className="truncate text-xs font-semibold text-slate-900 dark:text-white">{s.name}</span>
                            {s.isExample && <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-semibold text-amber-500">EXAMPLE</span>}
                            <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${r?.rank === 1 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400'}`}>{badge}</span>
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

function Provenance({ source }: { source: PanelValue['source'] }) {
    const color = source === 'site' ? 'bg-violet-500' : source === 'country' ? 'bg-cyan-500' : 'bg-slate-500';
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
                <span className="ml-2 text-[9px] normal-case text-slate-400">● violet = site attribute · ● cyan = country baseline</span>
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {PANELS.map((p) => {
                    const rows = data[p.key].filter((r) => r.value !== '—').slice(0, 8);
                    const empty = data[p.key].length - rows.length;
                    return (
                        <div key={p.key} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                            <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                <p.icon className="h-3.5 w-3.5 text-violet-500" /> {p.title}
                            </h3>
                            <div className="space-y-1">
                                {rows.length === 0 && <p className="text-[10px] text-slate-400">No data — edit via Edit Criteria.</p>}
                                {rows.map((r) => (
                                    <div key={r.label} className="flex items-center justify-between gap-2 text-[11px]">
                                        <span className="flex items-center gap-1.5 text-slate-500"><Provenance source={r.source} />{r.label}</span>
                                        <span className="font-medium tabular-nums text-slate-800 dark:text-slate-200">{r.value}</span>
                                    </div>
                                ))}
                                {empty > 0 && <p className="text-[9px] text-slate-400">+{empty} unset field(s)</p>}
                            </div>
                            {p.linkTab && (
                                <button onClick={() => setActiveTab(p.linkTab as never)}
                                    className="mt-2 text-[10px] font-medium text-violet-500 hover:text-violet-400">{p.linkLabel} →</button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
