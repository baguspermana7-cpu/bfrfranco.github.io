'use client';

/* ─── Reliability Engine — page (Phase L, tab 'reliability') ─────────────────
 * Heavily engine-real: per-system availability chains composed from
 * DATA.reliability.components MTBF/MTTR via models.reliability
 * (availability / series / parallel per the redundancy paths), tier targets,
 * SPOF list (single-path components at the current config), MTBF composite.
 * Failure events reuse the opsLog store (single log, no duplicate ledger).
 * Old ReliabilityDashboard (RAM detail) survives as the "RAM Detail" tab.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useSimulationStore } from '@/store/simulation';
import { useOpsLog } from '@/store/opsLog';
import { rzModels, rzData } from '@/lib/rz-engine';
import { REDUNDANCY_KEY } from '@/state/registry';
import { ReliabilityDashboard } from '@/components/modules/ReliabilityDashboard';
import { ShieldCheck, ChevronRight } from 'lucide-react';

interface SystemRow { label: string; availability: number; chain: string; redundant: boolean }

export function ReliabilityEnginePage() {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const inputs = useSimulationStore((s) => s.inputs);
    const log = useOpsLog();
    const [tab, setTab] = React.useState<'overview' | 'ram'>('overview');

    const model = React.useMemo(() => {
        const m = rzModels()?.reliability;
        const d = rzData()?.reliability;
        if (!m?.availability || !d?.components) return null;
        const comps = d.components as Record<string, { mtbf: number; mttr: number; label: string }>;
        const redKey = REDUNDANCY_KEY[inputs.powerRedundancy] ?? 'n1';
        const paths: number = d.redundancyPaths?.[redKey] ?? 2;
        const a = (cls: string) => comps[cls] ? m.availability(comps[cls].mtbf, comps[cls].mttr) : 0.999;
        const par = (av: number, n: number) => m.parallelAvailability ? m.parallelAvailability(av, n) : 1 - Math.pow(1 - av, n);
        const ser = (arr: number[]) => m.seriesAvailability ? m.seriesAvailability(arr) : arr.reduce((s, x) => s * x, 1);
        /* documented per-system chains */
        const systems: SystemRow[] = [
            { label: 'Power Distribution', availability: par(ser([a('switchgear'), a('pdu')]), paths), chain: `(swgr·pdu) × ${paths} paths`, redundant: paths > 1 },
            { label: 'UPS & Battery', availability: par(a('ups'), paths), chain: `UPS × ${paths} paths`, redundant: paths > 1 },
            { label: 'Generators', availability: par(a('generator'), Math.max(2, paths)), chain: `gen × ${Math.max(2, paths)} (N+1 floor)`, redundant: true },
            { label: 'Cooling (Chillers)', availability: par(a('chiller'), 2), chain: 'chiller N+1 (2 paths)', redundant: true },
            { label: 'CRAC / AHU', availability: par(a('crac'), 2), chain: 'CRAC N+1', redundant: true },
        ];
        const overall = ser(systems.map((s) => s.availability));
        const tierTargetFrac: number = (d.tierAvailability ?? {})[inputs.tierLevel] ?? 0.99982;
        const downtimeMin = m.annualDowntimeMinutes ? m.annualDowntimeMinutes(overall) : (1 - overall) * 525960;
        /* MTBF composite (documented): harmonic sum of component failure rates */
        const rates = Object.values(comps).map((c) => 1 / c.mtbf);
        const mtbfAll = Math.round(1 / rates.reduce((s, x) => s + x, 0));
        const mttrAvg = +(Object.values(comps).reduce((s, c) => s + c.mttr, 0) / Object.values(comps).length).toFixed(1);
        /* SPOF: single-path components at this config */
        const spof = paths <= 1 ? ['MV switchgear bus', 'UPS system', 'PDU distribution'] : (redKey === 'n1' ? ['Utility intake (single feed pre-ATS)'] : []);
        /* score composite (documented): availability-margin 40 + redundancy 30 + maintainability 15 + spof 15 */
        const availMargin = Math.min(1, Math.max(0, (overall - tierTargetFrac) / (1 - tierTargetFrac) * 0.5 + 0.5));
        const score = Math.round(40 * availMargin + 30 * Math.min(1, paths / 2) + 15 * (mttrAvg <= 12 ? 1 : 12 / mttrAvg) + 15 * (spof.length === 0 ? 1 : Math.max(0, 1 - spof.length * 0.3)));
        return { systems, overall, tierTargetFrac, downtimeMin, mtbfAll, mttrAvg, spof, score, paths, comps };
    }, [inputs.powerRedundancy, inputs.tierLevel]);

    if (!model) return <div className="p-8 text-center text-sm text-slate-500">Engine loading…</div>;
    const pct = (x: number) => `${(x * 100).toFixed(4)}%`;
    const failures = log.alarms.filter((a) => a.status !== 'Cleared');
    const meetsTier = model.overall >= model.tierTargetFrac;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 shadow-lg"><ShieldCheck className="h-6 w-6 text-white" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reliability Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Availability chains composed engine-real from IEEE-493 component MTBF/MTTR at the current redundancy</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                        {([['overview', 'Availability & SPOF'], ['ram', 'RAM Detail']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                        ))}
                    </div>
                    <button onClick={() => setActiveTab('tier')} className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-violet-400">Tier Classification</button>
                    <button onClick={() => setActiveTab('risk')} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">Risk Analysis <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'ram' ? <ReliabilityDashboard /> : (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                            { label: 'Composed Availability', value: pct(model.overall), sub: meetsTier ? `meets Tier ${inputs.tierLevel} target` : `BELOW Tier ${inputs.tierLevel} target` },
                            { label: 'Tier Target', value: pct(model.tierTargetFrac), sub: `Tier ${inputs.tierLevel} (Uptime)` },
                            { label: 'Downtime Budget', value: `${model.downtimeMin.toFixed(1)} min/yr`, sub: 'at composed availability' },
                            { label: 'MTBF (composite)', value: `${(model.mtbfAll / 1000).toFixed(0)}k h`, sub: 'harmonic over components' },
                            { label: 'MTTR (avg)', value: `${model.mttrAvg} h`, sub: 'component average' },
                            { label: 'Reliability Score', value: `${model.score}/100`, sub: 'documented composite' },
                        ].map((k) => (
                            <div key={k.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</div>
                                <div className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                <div className={`truncate text-[10px] ${k.sub.startsWith('BELOW') ? 'text-rose-500 font-semibold' : 'text-slate-500'}`}>{k.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Availability by System <span className="text-[9px] normal-case text-slate-400">documented chains · {inputs.powerRedundancy} = {model.paths} path(s)</span></h2>
                            <table className="w-full text-[11px]">
                                <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">System</th><th className="text-left">Chain</th><th className="text-right">Availability</th><th className="text-right">Status</th></tr></thead>
                                <tbody>
                                    {model.systems.map((s) => (
                                        <tr key={s.label} className="border-b border-slate-100 dark:border-slate-800/60">
                                            <td className="py-1 text-slate-700 dark:text-slate-200">{s.label}</td>
                                            <td className="text-[9px] text-slate-400">{s.chain}</td>
                                            <td className="text-right tabular-nums text-slate-600 dark:text-slate-300">{pct(s.availability)}</td>
                                            <td className="text-right"><span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${s.availability >= 0.9999 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>{s.availability >= 0.9999 ? 'Good' : 'Review'}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">SPOF — Single Points of Failure ({model.spof.length})</h2>
                                {model.spof.length === 0 ? (
                                    <p className="text-[11px] text-emerald-500">✓ No single-path components at {inputs.powerRedundancy} — fully redundant paths.</p>
                                ) : (
                                    <ul className="space-y-1">
                                        {model.spof.map((s) => <li key={s} className="flex gap-1.5 text-[11px] text-rose-500">⛔ {s}</li>)}
                                    </ul>
                                )}
                            </div>
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Failure Events <span className="text-[9px] normal-case text-slate-400">from the shared ops log</span></h2>
                                {failures.length === 0 ? <p className="text-[11px] text-slate-500">No active events.</p> : (
                                    <div className="space-y-1">
                                        {failures.slice(0, 5).map((a) => (
                                            <div key={a.id} className="flex items-center gap-2 text-[11px]">
                                                <span className={`rounded px-1 py-0.5 text-[8.5px] font-bold ${a.priority === 'P1' ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/15 text-amber-500'}`}>{a.priority}</span>
                                                <span className="font-mono text-slate-500">{a.tag}</span>
                                                <span className="truncate text-slate-700 dark:text-slate-200">{a.message}</span>
                                                {a.isExample && <span className="rounded bg-amber-500/15 px-1 text-[8px] font-semibold text-amber-500">EXAMPLE</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button onClick={() => setActiveTab('ops')} className="mt-1.5 text-[10px] font-medium text-violet-500">Open Operations log →</button>
                            </div>
                        </div>
                    </div>

                    {/* component MTBF chart */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Component MTBF (engine IEEE-493 data)</h2>
                        <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={Object.entries(model.comps).map(([k, c]) => ({ name: c.label ?? k, mtbfK: +(c.mtbf / 1000).toFixed(0) }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                    <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} angle={-12} height={34} textAnchor="end" />
                                    <YAxis tick={{ fontSize: 9 }} unit="k h" />
                                    <Tooltip formatter={(v) => `${v}k h`} contentStyle={{ fontSize: 10 }} />
                                    <Bar dataKey="mtbfK" fill="#fb7185" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
