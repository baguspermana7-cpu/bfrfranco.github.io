'use client';

/* ─── Right rail: AI Insights (deterministic) + Score ring + Scenarios +
 *     Input Quality + Next CTA (Phase A) ─────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useScenarioStore } from '@/store/scenario';
import { fmtMoney } from '@/lib/format';
import { Sparkles, ChevronRight } from 'lucide-react';
import type { ReqDerived } from './useRequirementsDerived';

function ScoreRing({ score, band }: { score: number; band: { label: string; sub: string } }) {
    const r = 34; const c = 2 * Math.PI * r;
    const color = score >= 85 ? '#34d399' : score >= 60 ? '#a78bfa' : '#f59e0b';
    return (
        <div className="flex items-center gap-3">
            <svg viewBox="0 0 84 84" className="h-20 w-20 -rotate-90">
                <circle cx="42" cy="42" r={r} fill="none" strokeWidth="7" className="stroke-slate-200 dark:stroke-slate-800" />
                <circle cx="42" cy="42" r={r} fill="none" strokeWidth="7" stroke={color} strokeLinecap="round"
                    strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
            </svg>
            <div>
                <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{score}<span className="text-sm text-slate-400">/100</span></div>
                <div className="text-xs font-semibold" style={{ color }}>{band.label}</div>
                <div className="text-[10px] text-slate-500">{band.sub}</div>
            </div>
        </div>
    );
}

export function InsightsRail({ derived }: { derived: ReqDerived }) {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const inputs = useSimulationStore((s) => s.inputs);
    const country = useSimulationStore((s) => s.selectedCountry);
    const scenarios = useScenarioStore((s) => s.scenarios);
    const openPanel = useScenarioStore((s) => s.openPanel);

    return (
        <aside className="space-y-4 lg:sticky lg:top-4 self-start">
            <div className="rounded-2xl border border-violet-500/30 bg-violet-600/5 p-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-500">
                    <Sparkles className="h-3.5 w-3.5" /> AI Insights (Requirements)
                </h3>
                <ul className="space-y-1.5">
                    {derived.insights.map((s, i) => (
                        <li key={i} className="flex gap-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                            <span className="text-violet-500">✓</span>{s}
                        </li>
                    ))}
                </ul>
                <p className="mt-2 text-[9px] text-slate-400">Deterministic engine rules — not an LLM.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Requirement Score</h3>
                <ScoreRing score={derived.score} band={derived.scoreBand} />
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Scenarios</h3>
                <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between rounded-lg border border-violet-500/40 bg-violet-600/10 px-2 py-1.5">
                        <div>
                            <div className="font-medium text-slate-900 dark:text-white">Base Case</div>
                            <div className="text-[10px] text-slate-500">{(inputs.itLoad / 1000).toFixed(1)} MW · Tier {inputs.tierLevel} · {inputs.coolingType} · {country?.name ?? '—'}</div>
                        </div>
                        <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">Active</span>
                    </div>
                    {scenarios.slice(0, 3).map((sc) => (
                        <div key={sc.id} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5">
                            <div>
                                <div className="font-medium text-slate-800 dark:text-slate-200">{sc.name}</div>
                                <div className="text-[10px] text-slate-500">{fmtMoney(sc.summary?.annualCapex ?? 0)} capex</div>
                            </div>
                        </div>
                    ))}
                </div>
                <button onClick={() => openPanel?.()} className="mt-2 w-full rounded-lg border border-slate-300 dark:border-slate-700 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-violet-400">
                    View All Scenarios
                </button>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Input Quality</h3>
                <div className="space-y-1.5">
                    {derived.sectionQuality.map((s) => (
                        <div key={s.key} className="flex items-center gap-2 text-[11px]">
                            <span className="w-28 truncate text-slate-600 dark:text-slate-300">{s.label}</span>
                            <div className="h-1.5 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                                <div className={`h-1.5 rounded ${s.pct === 100 ? 'bg-emerald-500' : s.pct >= 60 ? 'bg-violet-500' : 'bg-amber-500'}`} style={{ width: `${s.pct}%` }} />
                            </div>
                            <span className="w-8 text-right tabular-nums text-slate-500">{s.pct}%</span>
                        </div>
                    ))}
                </div>
                {(() => { const n = derived.sectionQuality.reduce((s, x) => s + x.missing.length, 0); return n > 0 ? <p className="mt-1.5 text-[10px] text-amber-500">Complete Required Fields ({n})</p> : null; })()}
            </div>

            <button onClick={() => setActiveTab('site')}
                className="flex w-full items-center justify-center gap-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors">
                Next: Site Intelligence <ChevronRight className="h-4 w-4" />
            </button>
        </aside>
    );
}
