'use client';

/* ─── Architecture right rail: summary + load donut + validation (Phase C) ── */

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { rzModels } from '@/lib/rz-engine';
import { useArchitectureStore } from '@/store/architecture';
import { CreatableCombobox, type ComboValue } from '@/components/ui/CreatableCombobox';
import { densityToEngineBucket } from '@/lib/requirementsMappings';
import { computeLoadBreakdown, type ArchInputs, type EquipCounts, type FacilityCalc, type LayerCheck } from '@/state/adapters/arch-adapter';

const DONUT_COLORS = ['#7DDDB4', '#14b8a6', '#3b82f6', '#f59e0b', '#64748b'];

export function ArchRail({ i, eq, f, layers, overall }: {
    i: ArchInputs; eq: EquipCounts; f: FacilityCalc; layers: LayerCheck[]; overall: boolean;
}) {
    const futureMw = useArchitectureStore((s) => s.futureExpansionMw);
    const setArch = useArchitectureStore((s) => s.actions.set);
    const m = rzModels()?.architecture;
    let topo: { powerPath?: string; coolingPath?: string; maintainability?: string; tiaRating?: string } = {};
    try { topo = m?.topology ? m.topology(i.tier) ?? {} : {}; } catch { /* ignore */ }
    const donut = computeLoadBreakdown(f);
    const groups = i.redKey === '2n1' ? 3 : f.paths >= 2 ? 2 : 1;
    const bucket = densityToEngineBucket(i.rackDensityKw);
    const futureVal: ComboValue<number> | null = futureMw == null ? null : { value: futureMw, isCustom: true };

    const rows: [string, string][] = [
        ['Tier Classification', `${topo.tiaRating ?? `Tier ${i.tier}`}`],
        ['Concurrent Maintainability', topo.maintainability ?? '—'],
        ['Power Redundancy', i.redundancy],
        /* single source sim.powerRedundancy — KPI declares it covers Power & Cooling;
         * tier-baseline engine text lives in the Power topology card, not here */
        ['Cooling Redundancy', i.redundancy],
        ['IT Distribution', `${groups}× PDU group${groups > 1 ? 's' : ''} (${['A', 'A/B', 'A/B/C'][groups - 1]})`],
        ['Rack Type', `${bucket.replace('_', '/')} · ${i.rackDensityKw} kW`],
    ];

    return (
        <aside className="space-y-4 lg:sticky lg:top-4 self-start">
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Architecture Summary</h3>
                <div className="space-y-1 text-[11px]">
                    {rows.map(([k, v]) => (
                        <div key={k} className="flex items-start justify-between gap-2">
                            <span className="text-slate-500">{k}</span>
                            <span className="max-w-[55%] text-right font-medium text-slate-800 dark:text-slate-200">{v}</span>
                        </div>
                    ))}
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Future Expansion</span>
                        <div className="w-28">
                            <CreatableCombobox<number>
                                options={[50, 100, 200].map((v) => ({ value: v, label: `+${v} MW` }))}
                                value={futureVal} min={0} max={1000} unit="MW"
                                onChange={(v) => setArch({ futureExpansionMw: v?.value ?? null })} placeholder="none" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Load Breakdown</h3>
                <p className="mb-1 text-[9px] text-slate-400">Derived from design PUE {f.pue} ({f.pueSource}) — screening split of overhead</p>
                <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={donut} dataKey="mw" nameKey="name" innerRadius={38} outerRadius={56} paddingAngle={2}>
                                {donut.map((_, idx) => <Cell key={idx} fill={DONUT_COLORS[idx]} />)}
                            </Pie>
                            <Tooltip formatter={(v) => `${v} MW`} contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-1 space-y-0.5">
                    {donut.map((r, idx) => (
                        <div key={r.name} className="flex items-center gap-1.5 text-[10px]">
                            <span className="h-2 w-2 rounded-sm" style={{ background: DONUT_COLORS[idx] }} />
                            <span className="text-slate-600 dark:text-slate-300">{r.name}</span>
                            <span className="ml-auto tabular-nums text-slate-500">{r.pct}% · {r.mw} MW</span>
                        </div>
                    ))}
                </div>
                <div className="mt-1 border-t border-slate-200 dark:border-slate-800 pt-1 text-center text-[11px] font-bold text-slate-900 dark:text-white">
                    {f.facilityMw} MW <span className="font-normal text-slate-400">total facility</span>
                </div>
            </div>

            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Design Validation</h3>
                <div className="space-y-1">
                    {layers.map((l) => (
                        <div key={l.key} className="flex items-center gap-1.5 text-[11px]">
                            <span className={`h-2 w-2 rounded-full ${l.pass ? 'bg-rz-data' : 'bg-amber-500'}`} />
                            <span className="text-slate-600 dark:text-slate-300">{l.label}</span>
                            <span className={`ml-auto text-[9px] font-semibold ${l.pass ? 'text-rz-data' : 'text-amber-500'}`}>{l.pass ? 'Passed' : 'Review'}</span>
                        </div>
                    ))}
                </div>
                <div className={`mt-2 rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold ${overall ? 'bg-rz-data/15 text-rz-data' : 'bg-amber-500/15 text-amber-500'}`}>
                    Overall Status: {overall ? 'Passed' : 'Review Required'}
                </div>
            </div>
        </aside>
    );
}
