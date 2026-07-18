'use client';

/* ─── Comparison table (+ absorbed engine factor breakdown) + right rail ──── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useSitesStore } from '@/store/sites';
import { keyTakeaways } from '@/lib/site-adapter';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import type { CandidateSite, SiteScoreResult, AxisKey } from '@/types/site-intel';
import { AXIS_LABELS } from '@/types/site-intel';
import { Play, FileDown, ChevronRight } from 'lucide-react';

export function SiteComparisonTable({ sites, results, selectedId }: {
    sites: CandidateSite[]; results: SiteScoreResult[]; selectedId: string | null;
}) {
    const axes = Object.keys(AXIS_LABELS) as AxisKey[];
    const bySite = (id: string) => results.find((r) => r.siteId === id);
    const sel = results.find((r) => r.siteId === selectedId);
    const best = (vals: number[], v: number) => vals.length > 1 && v === Math.max(...vals);
    return (
        <div id="sec-compare" className="scroll-mt-24 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Site Score & Compare</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-400">
                            <th className="py-1 pr-2 text-left">Criteria</th>
                            {sites.map((s) => <th key={s.id} className="px-2 py-1 text-right">Site {s.label}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-slate-100 dark:border-slate-800/60">
                            <td className="py-1.5 pr-2 font-semibold text-slate-800 dark:text-slate-200">Total Score (engine)</td>
                            {sites.map((s) => {
                                const r = bySite(s.id);
                                const vals = results.map((x) => x.engine.score);
                                return <td key={s.id} className={`px-2 py-1.5 text-right font-bold tabular-nums ${r && best(vals, r.engine.score) ? 'text-violet-500' : 'text-slate-700 dark:text-slate-300'}`}>{r?.engine.score ?? '—'}</td>;
                            })}
                        </tr>
                        {axes.map((k) => (
                            <tr key={k} className="border-b border-slate-100 dark:border-slate-800/60">
                                <td className="py-1.5 pr-2 text-slate-500">{AXIS_LABELS[k]}{k === 'naturalRisks' && <span className="ml-1 text-[9px]">(risk: lower better)</span>}</td>
                                {sites.map((s) => {
                                    const r = bySite(s.id);
                                    const raw = r ? (k === 'naturalRisks' ? r.riskScore : r.axes[k]) : null;
                                    const goodVals = results.map((x) => k === 'naturalRisks' ? 100 - x.riskScore : x.axes[k]);
                                    const good = r ? (k === 'naturalRisks' ? 100 - r.riskScore : r.axes[k]) : 0;
                                    return <td key={s.id} className={`px-2 py-1.5 text-right tabular-nums ${r && best(goodVals, good) ? 'text-violet-500 font-semibold' : 'text-slate-600 dark:text-slate-400'}`}>{raw ?? '—'}</td>;
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {sel && (
                <div className="mt-3">
                    <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Engine Factor Breakdown — selected site (10 factors · weight-renormalized)</h3>
                    <div className="space-y-1">
                        {[...sel.engine.breakdown].sort((a, b) => b.contribution - a.contribution).map((f) => (
                            <div key={f.key} className="flex items-center gap-2 text-[11px]">
                                <span className="w-16 capitalize text-slate-600 dark:text-slate-300">{f.key}</span>
                                <div className="h-1.5 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                                    <div className="h-1.5 rounded bg-violet-500" style={{ width: `${f.value * 100}%` }} />
                                </div>
                                <span className="w-10 text-right tabular-nums text-slate-500">{Math.round(f.value * 100)}%</span>
                                <span className="w-10 text-right tabular-nums text-slate-400">w{Math.round(f.weight * 100)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export function SiteRightRail({ sites, results, selectedId, onSelect, onEdit }: {
    sites: CandidateSite[]; results: SiteScoreResult[]; selectedId: string | null;
    onSelect: (id: string) => void; onEdit: () => void;
}) {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const runAnalysis = useSitesStore((s) => s.runAnalysis);
    const lastRunAt = useSitesStore((s) => s.lastRunAt);
    const [busy, setBusy] = React.useState(false);
    const sel = sites.find((s) => s.id === selectedId) ?? sites[0];
    const selResult = results.find((r) => r.siteId === sel?.id);
    const takeaways = sel && selResult ? keyTakeaways(sel, selResult, sites.length) : [];

    const exportPdf = async () => {
        setBusy(true);
        try {
            await generatePillarPDF({
                title: 'Site Intelligence', layer: 'Layer 2 · Multi-Site Comparison', project: sel?.name ?? '—',
                kpis: results.slice(0, 3).map((r) => {
                    const s = sites.find((x) => x.id === r.siteId);
                    return { label: `Site ${s?.label} · ${s?.name}`, value: `${r.engine.score}/100`, sub: `${r.engine.grade} · risk ${r.riskScore}` };
                }),
                sections: [
                    { title: 'Ranking', head: ['#', 'Site', 'Score', 'Grade', 'Risk (lower better)'], rows: results.map((r) => { const s = sites.find((x) => x.id === r.siteId); return [String(r.rank), `${s?.label} · ${s?.name}`, String(r.engine.score), r.engine.grade, String(r.riskScore)]; }) },
                    { title: 'Key Takeaways (best site)', head: ['Item'], rows: takeaways.map((t) => [t]) },
                ],
                note: 'Engine-real multi-site screening (models.site.score, factor overrides via site attributes). Not a site survey.',
            });
        } finally { setBusy(false); }
    };

    return (
        <aside className="space-y-4 lg:sticky lg:top-4 self-start">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 space-y-2">
                <select className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-violet-500"
                    value={selectedId ?? ''} onChange={(e) => onSelect(e.target.value)}>
                    {sites.map((s) => <option key={s.id} value={s.id}>Site {s.label} — {s.name}</option>)}
                </select>
                <div className="flex gap-1.5">
                    <button onClick={exportPdf} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-violet-400">
                        <FileDown className="h-3 w-3" />{busy ? '…' : 'Export'}
                    </button>
                    <button onClick={onEdit} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-violet-400">Edit Criteria</button>
                </div>
                <button onClick={runAnalysis} title="Scores recompute continuously; Run stamps the review point."
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white hover:bg-violet-500">
                    <Play className="h-3.5 w-3.5" /> Run Analysis
                </button>
                {lastRunAt && <p className="text-center text-[9px] text-slate-400">Last run: {new Date(lastRunAt).toLocaleString()}</p>}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Site Score & Ranking</h3>
                <div className="space-y-1.5">
                    {results.map((r) => {
                        const s = sites.find((x) => x.id === r.siteId);
                        return (
                            <button key={r.siteId} onClick={() => onSelect(r.siteId)} className="flex w-full items-center gap-2 text-left text-[11px]">
                                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${r.rank === 1 ? 'bg-emerald-500 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>{r.rank}</span>
                                <span className="w-24 truncate text-slate-700 dark:text-slate-200">{s?.name}</span>
                                <div className="h-1.5 flex-1 rounded bg-slate-100 dark:bg-slate-800"><div className="h-1.5 rounded bg-violet-500" style={{ width: `${r.engine.score}%` }} /></div>
                                <span className="w-8 text-right font-semibold tabular-nums text-slate-600 dark:text-slate-300">{r.engine.score}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="rounded-2xl border border-violet-500/30 bg-violet-600/5 p-3">
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-500">Key Takeaways — Site {sel?.label}</h3>
                <ul className="space-y-1">
                    {takeaways.map((t, i) => <li key={i} className="flex gap-1.5 text-[11px] text-slate-700 dark:text-slate-300"><span className="text-violet-500">✓</span>{t}</li>)}
                </ul>
                <p className="mt-1.5 text-[9px] text-slate-400">Deterministic engine rules — not an LLM.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Next Steps</h3>
                <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                    <li>✓ Confirm site selection & secure land reservation</li>
                    <li>✓ Initiate geotechnical & environmental survey</li>
                    <li>✓ Engage utility providers for LOA</li>
                </ul>
                <button onClick={() => setActiveTab('architecture')}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-violet-600 py-2 text-xs font-semibold text-white hover:bg-violet-500">
                    Proceed to Architecture Engine <ChevronRight className="h-3.5 w-3.5" />
                </button>
            </div>
        </aside>
    );
}
