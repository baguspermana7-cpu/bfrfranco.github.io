'use client';

/* ─── Small explain panel for a Poor/Fair axis chip (owner mandate) ──────────
 * Renders explainAxis(): computed reason (live deriveFactors contributor),
 * baseline-provenance note, solved levers (+N points each, from the real
 * scoreSite formula) and click-through actions: Edit Criteria drawer +
 * sibling deep-dive tab. Pure presentation — all numbers from axis-explain.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useSitesStore } from '@/store/sites';
import { explainAxis, AXIS_DEEP_TAB, EDIT_CRITERIA_TAB } from './axis-explain';
import type { CandidateSite, SiteScoreResult, AxisKey } from '@/types/site-intel';
import { AXIS_LABELS } from '@/types/site-intel';
import { X, SlidersHorizontal, ChevronRight } from 'lucide-react';

export function AxisExplainPanel({ site, result, axis, onEdit, onClose }: {
    site: CandidateSite; result: SiteScoreResult; axis: AxisKey;
    onEdit: () => void; onClose: () => void;
}) {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const selectSite = useSitesStore((s) => s.selectSite);
    const ex = React.useMemo(() => explainAxis(site, result, axis), [site, result, axis]);
    const deep = AXIS_DEEP_TAB[axis];
    const bandCls = ex.band === 'Poor' ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/15 text-amber-500';

    const openEditor = () => { selectSite(site.id); onEdit(); };

    return (
        <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-start justify-between gap-2">
                <h4 className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                    Site {site.label} · {AXIS_LABELS[axis]}
                    <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold ${bandCls}`}>{ex.goodness}/100 · {ex.band}</span>
                    {axis === 'naturalRisks' && <span className="ml-1 text-[9px] font-normal text-slate-400">(tabel menampilkan risk = 100 − nilai ini)</span>}
                </h4>
                <button onClick={onClose} className="rounded p-0.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"><X className="h-3.5 w-3.5" /></button>
            </div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-300">{ex.reason}</p>
            {ex.baselineNote && <p className="mt-1 text-[10px] text-cyan-600 dark:text-cyan-400">{ex.baselineNote}</p>}
            {ex.levers.length > 0 && (
                <div className="mt-2 space-y-1">
                    {ex.levers.map((l, i) => (
                        <div key={i} className="flex items-start gap-2 text-[10.5px] text-slate-600 dark:text-slate-300">
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold ${l.priority === 'HIGH' ? 'bg-rz-data/15 text-rz-data' : 'bg-slate-500 text-white'}`}>{l.priority === 'HIGH' ? 'LEVER' : 'NOTE'}</span>
                            <span><b>{l.label}</b> — {l.detail}{l.targetTab === EDIT_CRITERIA_TAB && (
                                <button onClick={openEditor} className="ml-1 font-medium text-rz-mint hover:text-rz-mint/80">Edit Criteria →</button>
                            )}</span>
                        </div>
                    ))}
                </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
                <button onClick={openEditor}
                    className="inline-flex items-center gap-1 rounded-lg bg-rz-signal px-2.5 py-1 text-[10px] font-semibold text-black hover:bg-rz-signal/90">
                    <SlidersHorizontal className="h-3 w-3" /> Edit Criteria — Site {site.label}
                </button>
                {deep && (
                    <button onClick={() => setActiveTab(deep.tab as never)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:border-rz-mint">
                        {deep.label} <ChevronRight className="h-3 w-3" />
                    </button>
                )}
            </div>
            <p className="mt-1.5 text-[9px] text-slate-400">Delta poin dihitung live dari formula axis (scoreSite) — deterministic, bukan LLM.</p>
        </div>
    );
}
