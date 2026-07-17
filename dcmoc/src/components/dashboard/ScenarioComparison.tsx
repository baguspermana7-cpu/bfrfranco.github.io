'use client';

import React from 'react';
import { useScenarioStore } from '@/store/scenario';
import type { DashboardData } from './useDashboardData';

const fmtUsd = (n?: number | null) => n == null ? '—' : Math.abs(n) >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${(n / 1e3).toFixed(0)}K`;

/** Scenario Comparison — the live base case vs saved scenarios (IRR/NPV). */
export function ScenarioComparison({ d }: { d: DashboardData }) {
    const scenarios = useScenarioStore((s) => s.scenarios);
    const base = {
        name: 'Base Case', active: true,
        detail: `${d.itLoadMw.toFixed(0)}MW · Tier ${d.tier}`,
        irr: d.financial?.irr ?? null, npv: d.financial?.npv ?? null,
    };
    const rows = [base, ...scenarios.slice(0, 4).map((s) => ({
        name: s.name, active: false,
        detail: `${(s.simInputs?.itLoad ? s.simInputs.itLoad / 1000 : 0).toFixed(0)}MW · Tier ${s.simInputs?.tierLevel ?? '?'}`,
        irr: s.summary?.irr ?? null, npv: s.summary?.npv ?? null,
    }))];

    return (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Scenario Comparison</h2>
            <div className="space-y-2">
                {rows.map((r, i) => (
                    <div key={i} className={`rounded-lg border p-2.5 ${r.active ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-slate-200 dark:border-white/10'}`}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{r.name}</span>
                            {r.active && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">Active</span>}
                        </div>
                        <div className="text-[10px] text-slate-500 mb-1.5">{r.detail}</div>
                        <div className="flex items-center gap-4 text-[11px]">
                            <span className="text-slate-500">IRR <span className="font-semibold text-emerald-500 tabular-nums">{r.irr != null ? `${r.irr.toFixed(1)}%` : '—'}</span></span>
                            <span className="text-slate-500">NPV <span className="font-semibold text-cyan-400 tabular-nums">{fmtUsd(r.npv)}</span></span>
                        </div>
                    </div>
                ))}
                {scenarios.length === 0 && <p className="text-[10px] text-slate-500">Save scenarios to compare side-by-side.</p>}
            </div>
        </div>
    );
}

export default ScenarioComparison;
