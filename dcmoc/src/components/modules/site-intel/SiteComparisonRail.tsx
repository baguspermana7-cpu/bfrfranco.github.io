'use client';

/* ─── Comparison table (+ absorbed engine factor breakdown) + right rail ──── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useSitesStore } from '@/store/sites';
import { keyTakeaways, type SiteAnalyses } from '@/lib/site-adapter';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';
import type { CandidateSite, SiteScoreResult, AxisKey } from '@/types/site-intel';
import { AXIS_LABELS, AXIS_EXPLAIN, axisBand } from '@/types/site-intel';
import { AxisExplainPanel } from './AxisExplainPanel';
import { ScoreValue } from '@/components/ui/ScoreValue';
import { Play, FileDown, ChevronRight } from 'lucide-react';

/** Poor/Fair axis chip → opens the explain panel (owner mandate: no naked bad chips). */
export interface AxisExplainSel { siteId: string; axis: AxisKey }

export function SiteComparisonTable({ sites, results, selectedId, analysesById, axisExplain, onExplainAxis, onEdit }: {
    sites: CandidateSite[]; results: SiteScoreResult[]; selectedId: string | null;
    analysesById?: Map<string, SiteAnalyses>;
    axisExplain?: AxisExplainSel | null;
    onExplainAxis?: (sel: AxisExplainSel | null) => void;
    onEdit?: () => void;
}) {
    const axes = Object.keys(AXIS_LABELS) as AxisKey[];
    const bySite = (id: string) => results.find((r) => r.siteId === id);
    const sel = results.find((r) => r.siteId === selectedId);
    const best = (vals: number[], v: number) => vals.length > 1 && v === Math.max(...vals);
    return (
        <div id="sec-compare" className="scroll-mt-24 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
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
                                /* Score cells render through ScoreValue (semantic color);
                                 * best-of-row keeps a ★ marker (color is now the score scale).
                                 * INLINE trace (not traceId): the registry site.* nodes read
                                 * the SELECTED site and would lie on the other columns — an
                                 * inline trace embeds THIS column's own score + its top engine
                                 * factor drivers, so every site column stays honest. */
                                return <td key={s.id} className="px-2 py-1.5 text-right tabular-nums">
                                    {r ? <ScoreValue value={r.engine.score} direction="higher" max={100} trace={{
                                        label: `Site ${s.label} — Total Score`, value: r.engine.score, unit: '/100', provenance: 'engine', page: 'site',
                                        formulaTemplate: 'Weight-renormalized sum of the 10 engine site factors (each 0–1 × its weight) → 0–100.',
                                        deps: [...r.engine.breakdown].sort((a, b) => b.contribution - a.contribution).slice(0, 4).map((f) => ({ label: f.key, value: Math.round(f.value * 100), unit: '/100', provenance: 'engine' as const })),
                                    }} /> : '—'}
                                    {r && best(vals, r.engine.score) && <span className="ml-0.5 text-[9px] text-rz-signal" aria-label="best of row">★</span>}
                                </td>;
                            })}
                        </tr>
                        {axes.map((k) => (
                            <tr key={k} className="border-b border-slate-100 dark:border-slate-800/60">
                                <td className="py-1.5 pr-2 text-slate-500 cursor-help" title={AXIS_EXPLAIN[k]}>{AXIS_LABELS[k]} <span className="text-[9px] text-slate-400">ⓘ</span>{k === 'naturalRisks' && <span className="ml-1 text-[9px]">(risk: lower better)</span>}</td>
                                {sites.map((s) => {
                                    const r = bySite(s.id);
                                    const raw = r ? (k === 'naturalRisks' ? r.riskScore : r.axes[k]) : null;
                                    const goodVals = results.map((x) => k === 'naturalRisks' ? 100 - x.riskScore : x.axes[k]);
                                    const good = r ? (k === 'naturalRisks' ? 100 - r.riskScore : r.axes[k]) : 0;
                                    const band = raw != null ? axisBand(raw, k === 'naturalRisks') : null;
                                    const isBad = band != null && (band.label === 'Poor' || band.label === 'Fair');
                                    const isOpen = axisExplain?.siteId === s.id && axisExplain?.axis === k;
                                    return <td key={s.id} className="px-2 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                                        {raw != null ? <ScoreValue value={raw} direction={k === 'naturalRisks' ? 'lower' : 'higher'} max={100} trace={{
                                            label: `Site ${s.label} — ${AXIS_LABELS[k]}`, value: raw, unit: '/100', provenance: 'engine', page: 'site',
                                            formulaTemplate: k === 'naturalRisks' ? `${AXIS_EXPLAIN[k]} (risk axis — lower is better)` : AXIS_EXPLAIN[k],
                                        }} /> : '—'}
                                        {raw != null && r && best(goodVals, good) && <span className="ml-0.5 text-[9px] text-rz-signal" aria-label="best of row">★</span>}
                                        {band && (isBad && onExplainAxis ? (
                                            <button onClick={() => onExplainAxis(isOpen ? null : { siteId: s.id, axis: k })}
                                                title={`Kenapa ${band.label}? Klik untuk alasan + lever terukur`}
                                                className={`ml-1 rounded px-1 text-[9px] font-semibold underline decoration-dotted underline-offset-2 ${band.cls} ${isOpen ? 'bg-amber-500/15' : 'hover:bg-amber-500/10'}`}>
                                                · {band.label} ⓘ
                                            </button>
                                        ) : <span className={`ml-1 text-[9px] ${band.cls}`}>· {band.label}</span>)}
                                    </td>;
                                })}
                            </tr>
                        ))}
                        {/* PHASE V — integrated sibling-engine rows. 0–100 score rows
                          * carry ScoreValue metadata (direction per metric; risk =
                          * lower); money/minutes rows stay plain (no bogus color
                          * scale on unbounded units). */}
                        {analysesById && ([
                            { label: 'Grid reliability (engine)', get: (a: SiteAnalyses) => a.grid ? { v: `${Math.round(a.grid.reliabilityScore)} · ${a.grid.reliabilityGrade}`, good: a.grid.reliabilityScore, score: Math.round(a.grid.reliabilityScore), dir: 'higher' as const } : null },
                            { label: 'Outage minutes /yr', get: (a: SiteAnalyses) => a.grid ? { v: `${Math.round(a.grid.annualOutageMinutes)}`, good: -a.grid.annualOutageMinutes } : null },
                            { label: 'Disaster composite (lower better)', get: (a: SiteAnalyses) => a.disaster ? { v: `${Math.round(a.disaster.compositeScore)} · ${a.disaster.riskCategory}`, good: -a.disaster.compositeScore, score: Math.round(a.disaster.compositeScore), dir: 'lower' as const } : null },
                            { label: 'Insurance $/yr', get: (a: SiteAnalyses) => a.disaster ? { v: `$${(a.disaster.annualInsuranceCost / 1e3).toFixed(0)}K`, good: -a.disaster.annualInsuranceCost } : null },
                            { label: 'Tax incentive value (15y)', get: (a: SiteAnalyses) => a.tax ? { v: `$${(a.tax.totalIncentiveValue / 1e6).toFixed(1)}M`, good: a.tax.totalIncentiveValue } : null },
                            { label: 'Talent score', get: (a: SiteAnalyses) => a.talent ? { v: `${Math.round(a.talent.talentScore)} · ${a.talent.hiringDifficulty}`, good: a.talent.talentScore, score: Math.round(a.talent.talentScore), dir: 'higher' as const } : null },
                            { label: 'Compliance score', get: (a: SiteAnalyses) => a.compliance ? { v: `${Math.round(a.compliance.complianceScore)}`, good: a.compliance.complianceScore, score: Math.round(a.compliance.complianceScore), dir: 'higher' as const } : null },
                        ] as { label: string; get: (a: SiteAnalyses) => { v: string; good: number; score?: number; dir?: 'higher' | 'lower' } | null }[]).map((rowDef) => {
                            const cells = sites.map((s) => { const a = analysesById.get(s.id); return a ? rowDef.get(a) : null; });
                            if (cells.every((c) => c == null)) return null;
                            const goods = cells.filter((c): c is { v: string; good: number } => c != null).map((c) => c.good);
                            return (
                                <tr key={rowDef.label} className="border-b border-slate-100 dark:border-slate-800/60">
                                    <td className="py-1.5 pr-2 text-slate-500">
                                        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-rz-data" title="computed by the sibling engine" />{rowDef.label}
                                    </td>
                                    {sites.map((s, i) => {
                                        const c = cells[i];
                                        const isBest = c != null && goods.length > 1 && c.good === Math.max(...goods);
                                        return <td key={s.id} title={c ? `${rowDef.label}: ${c.v}` : undefined}
                                            className={`px-2 py-1.5 text-right tabular-nums ${!c || c.score == null ? (isBest ? 'text-rz-signal font-semibold' : 'text-slate-600 dark:text-slate-400') : ''}`}>
                                            {c ? (c.score != null
                                                ? <ScoreValue value={c.score} display={c.v} direction={c.dir ?? 'higher'} max={100} trace={{
                                                    label: `Site ${s.label} — ${rowDef.label}`, value: c.score, unit: '/100', provenance: 'engine', page: 'site',
                                                    formulaTemplate: `${rowDef.label} — computed by the sibling site engine for this site.`,
                                                }} />
                                                : c.v) : '—'}
                                            {c && c.score != null && isBest && <span className="ml-0.5 text-[9px] text-rz-signal" aria-label="best of row">★</span>}
                                        </td>;
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {axisExplain && onExplainAxis && (() => {
                const exSite = sites.find((s) => s.id === axisExplain.siteId);
                const exResult = results.find((r) => r.siteId === axisExplain.siteId);
                if (!exSite || !exResult) return null;
                return (
                    <AxisExplainPanel site={exSite} result={exResult} axis={axisExplain.axis}
                        onEdit={onEdit ?? (() => { /* no drawer host */ })}
                        onClose={() => onExplainAxis(null)} />
                );
            })()}
            {sel && (
                <div className="mt-3">
                    <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Engine Factor Breakdown — selected site (10 factors · weight-renormalized)</h3>
                    <div className="space-y-1">
                        {[...sel.engine.breakdown].sort((a, b) => b.contribution - a.contribution).map((f) => (
                            <div key={f.key} className="flex items-center gap-2 text-[11px]">
                                <span className="w-16 capitalize text-slate-600 dark:text-slate-300">{f.key}</span>
                                <div className="h-1.5 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                                    <div className="h-1.5 rounded bg-rz-info" style={{ width: `${f.value * 100}%` }} />
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

export function SiteRightRail({ sites, results, selectedId, onSelect, onEdit, onExplainAxis }: {
    sites: CandidateSite[]; results: SiteScoreResult[]; selectedId: string | null;
    onSelect: (id: string) => void; onEdit: () => void;
    onExplainAxis?: (sel: AxisExplainSel) => void;
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
            const weakestFactor = selResult ? [...selResult.engine.breakdown].sort((a, b) => a.value - b.value)[0] : null;
            const narrativeMetrics = {
                score: selResult?.engine.score,
                keyRisk: weakestFactor ? `${weakestFactor.key} (${Math.round(weakestFactor.value * 100)}% factor score)` : undefined,
            };
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
                config: [
                    ['Candidate Sites', String(sites.length)],
                    ['Selected Site', sel ? `Site ${sel.label} — ${sel.name}` : '—'],
                    ...(selResult
                        ? selResult.engine.breakdown.map((b): [string, string] =>
                            [`Weight · ${b.key}`, `${Math.round(b.weight * 100)}%`])
                        : []),
                ],
                callouts: takeaways.map((t, idx) => ({
                    title: idx === 0 ? `Takeaway — Site ${sel?.label}` : `Takeaway ${idx + 1}`,
                    body: t,
                    tone: idx === 0 ? ('good' as const) : ('info' as const),
                })),
                assessment: buildAssessment('site', narrativeMetrics),
                actions: [
                    ...buildActions('site', narrativeMetrics),
                    { priority: 'HIGH' as const, action: 'Confirm site selection & secure land reservation' },
                    { priority: 'MEDIUM' as const, action: 'Initiate geotechnical & environmental survey' },
                    { priority: 'MEDIUM' as const, action: 'Engage utility providers for LOA' },
                ],
                summaryBand: results.slice(0, 5).map((r) => {
                    const s = sites.find((x) => x.id === r.siteId);
                    return { label: `Site ${s?.label ?? '—'}`, value: `${r.engine.score}/100` };
                }),
                note: 'Engine-real multi-site screening (models.site.score, factor overrides via site attributes). Not a site survey.',
            } as StandardReport);
        } finally { setBusy(false); }
    };

    /* #328 — on-page site guidance (5th adoption of the assessment pattern). */
    const siteAssess = selResult ? (() => {
        const weakest = [...selResult.engine.breakdown].sort((a, b) => a.value - b.value)[0];
        const met = { score: selResult.engine.score, keyRisk: weakest?.key ?? '' };
        return { assess: buildAssessment('site', met), acts: buildActions('site', met) };
    })() : null;

    return (
        <aside className="space-y-4 lg:sticky lg:top-4 self-start">
            {siteAssess && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900/50 p-3">
                    <div className="flex items-start gap-2.5">
                        <div className="shrink-0 rounded-lg px-2.5 py-1.5 text-center text-white" style={{ background: siteAssess.assess.color }}>
                            <div className="text-[8.5px] uppercase opacity-80">Site</div>
                            <div className="text-xs font-bold">{siteAssess.assess.label}</div>
                        </div>
                        <p className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-300">{siteAssess.assess.narrative}</p>
                    </div>
                    <div className="mt-2 space-y-1">
                        {siteAssess.acts.slice(0, 2).map((a, i) => (
                            <div key={i} className="flex items-start gap-2 text-[10px] text-slate-600 dark:text-slate-300">
                                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold text-white ${a.priority === 'HIGH' ? 'bg-red-600' : a.priority === 'MEDIUM' ? 'bg-amber-600' : 'bg-rz-data text-black'}`}>{a.priority}</span>
                                <span>{a.action}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 space-y-2">
                <select className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-rz-mint"
                    value={selectedId ?? ''} onChange={(e) => onSelect(e.target.value)}>
                    {sites.map((s) => <option key={s.id} value={s.id}>Site {s.label} — {s.name}</option>)}
                </select>
                <div className="flex gap-1.5">
                    <button onClick={exportPdf} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-rz-mint">
                        <FileDown className="h-3 w-3" />{busy ? '…' : 'Export'}
                    </button>
                    <button onClick={onEdit} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-rz-mint">Edit Criteria</button>
                </div>
                <button onClick={runAnalysis} title="Scores recompute continuously; Run stamps the review point."
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-rz-signal py-2 text-xs font-semibold text-black hover:bg-rz-signal/90">
                    <Play className="h-3.5 w-3.5" /> Run Analysis
                </button>
                {lastRunAt && <p className="text-center text-[9px] text-slate-400">Last run: {new Date(lastRunAt).toLocaleString()}</p>}
            </div>

            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Site Score & Ranking</h3>
                <div className="space-y-1.5">
                    {results.map((r) => {
                        const s = sites.find((x) => x.id === r.siteId);
                        return (
                            <button key={r.siteId} onClick={() => onSelect(r.siteId)} className="flex w-full items-center gap-2 text-left text-[11px]">
                                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${r.rank === 1 ? 'bg-rz-data text-black' : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>{r.rank}</span>
                                <span className="w-24 truncate text-slate-700 dark:text-slate-200">{s?.name}</span>
                                <div className="h-1.5 flex-1 rounded bg-slate-100 dark:bg-slate-800"><div className="h-1.5 rounded bg-rz-info" style={{ width: `${r.engine.score}%` }} /></div>
                                <span className="w-8 text-right font-semibold tabular-nums text-slate-600 dark:text-slate-300">{r.engine.score}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="rounded border border-rz-signal/30 bg-rz-signal/5 p-3">
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-rz-signal">Key Takeaways — Site {sel?.label}</h3>
                <ul className="space-y-1">
                    {takeaways.map((t, i) => <li key={i} className="flex gap-1.5 text-[11px] text-slate-700 dark:text-slate-300"><span className="text-rz-signal">✓</span>{t}</li>)}
                </ul>
                {/* Poor/Fair axis chips — click = reason + solved levers in the compare panel */}
                {sel && selResult && onExplainAxis && (() => {
                    const weak = (Object.keys(AXIS_LABELS) as AxisKey[])
                        .map((k) => ({ k, g: selResult.axes[k], shown: k === 'naturalRisks' ? selResult.riskScore : selResult.axes[k] }))
                        .filter((x) => x.g < 60);
                    if (weak.length === 0) return null;
                    return (
                        <div className="mt-2">
                            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Axis lemah — klik untuk alasan + lever</p>
                            <div className="flex flex-wrap gap-1">
                                {weak.map(({ k, g, shown }) => {
                                    const band = axisBand(shown, k === 'naturalRisks');
                                    return (
                                        <button key={k}
                                            onClick={() => { onExplainAxis({ siteId: sel.id, axis: k }); document.getElementById('sec-compare')?.scrollIntoView({ behavior: 'smooth' }); }}
                                            title={`${AXIS_LABELS[k]} ${g}/100 — klik untuk kontributor terbesar + lever terukur`}
                                            className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${band.label === 'Poor' ? 'border-rose-500/40 bg-rose-500/10 text-rose-500' : 'border-amber-500/40 bg-amber-500/10 text-amber-500'} hover:bg-amber-500/20`}>
                                            {AXIS_LABELS[k]} {shown} · {band.label} ⓘ
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}
                <p className="mt-1.5 text-[9px] text-slate-400">Deterministic engine rules — not an LLM.</p>
            </div>

            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Next Steps</h3>
                <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                    <li>✓ Confirm site selection & secure land reservation</li>
                    <li>✓ Initiate geotechnical & environmental survey</li>
                    <li>✓ Engage utility providers for LOA</li>
                </ul>
                <button onClick={() => setActiveTab('architecture')}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-rz-signal py-2 text-xs font-semibold text-black hover:bg-rz-signal/90">
                    Proceed to Architecture Engine <ChevronRight className="h-3.5 w-3.5" />
                </button>
            </div>
        </aside>
    );
}
