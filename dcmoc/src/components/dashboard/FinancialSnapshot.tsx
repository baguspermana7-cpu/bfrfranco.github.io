'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const CAT_LABELS: Record<string, string> = {
    building: 'Civil & Structure', electrical: 'Power Infrastructure', cooling: 'Cooling Infrastructure',
    ups: 'UPS Systems', generator: 'Generator & Fuel', fireSuppression: 'Fire Suppression',
    fireAlarm: 'Fire Alarm', commissioning: 'Cx & Startup', testing: 'Testing', permits: 'Permits', seismic: 'Seismic',
};
const COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#60a5fa', '#fbbf24', '#fb7185', '#f472b6', '#818cf8', '#2dd4bf', '#facc15', '#94a3b8'];
const fmtUsd = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`;

/** Financial Snapshot — CAPEX breakdown donut from the engine's cost categories. */
export function FinancialSnapshot({ costs, total }: { costs: Record<string, number> | null; total: number | null }) {
    if (!costs || !total) {
        return (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-4">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Financial Snapshot</h2>
                <p className="text-xs text-slate-500">Run the CAPEX engine to see the cost breakdown.</p>
            </div>
        );
    }
    const rows = Object.entries(costs)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v], i) => ({ key: k, label: CAT_LABELS[k] || k, value: v, pct: (v / total) * 100, color: COLORS[i % COLORS.length] }));

    return (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1424]/80 p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Financial Snapshot · CAPEX Breakdown</h2>
            <div className="flex items-center gap-3">
                <div className="relative w-[130px] h-[130px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={rows} cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={1.5} dataKey="value" stroke="none">
                                {rows.map((r) => <Cell key={r.key} fill={r.color} />)}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{fmtUsd(total)}</span>
                        <span className="text-[9px] text-slate-500">Total CAPEX</span>
                    </div>
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                    {rows.slice(0, 7).map((r) => (
                        <div key={r.key} className="flex items-center gap-1.5 text-[11px]">
                            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: r.color }} />
                            <span className="text-slate-600 dark:text-slate-300 truncate flex-1">{r.label}</span>
                            <span className="text-slate-400 tabular-nums">{r.pct.toFixed(1)}%</span>
                            <span className="text-slate-500 dark:text-slate-400 tabular-nums w-12 text-right">{fmtUsd(r.value)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default FinancialSnapshot;
