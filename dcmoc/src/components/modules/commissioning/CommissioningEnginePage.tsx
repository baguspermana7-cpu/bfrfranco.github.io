'use client';

/* ─── Commissioning Engine — page (Phase K) ──────────────────────────────────
 * PLANNED plane = the RICH engine (models.commissioning.programRich: L0-L6
 * staffed durations, equipment scaling, IST scenarios). ACTUAL plane = the
 * cxTracking store; per-level completion feeds the ENGINE readinessIndex —
 * a real engine linkage, not a UI approximation. Tests-per-system counts =
 * labeled screening (equipment × tests-per-unit). The rich cost/Monte-Carlo/
 * tornado cards (v1.68.0) survive as the "Program Cost & Risk" tab.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useSimulationStore } from '@/store/simulation';
import { useCxTracking, cxPlanMode } from '@/store/cxTracking';
import { rzModels } from '@/lib/rz-engine';
import { CommissioningDashboard } from '@/components/modules/NewEngineDashboards';
import { CheckCircle2, ChevronRight } from 'lucide-react';

const LEVEL_COLORS = ['#64748b', '#22d3ee', '#3b82f6', '#a78bfa', '#f59e0b', '#f43f5e', '#10b981'];

/** tests-per-unit screening table (labeled on the card). */
const TESTS_PER: Record<string, { label: string; key: string; per: number }> = {
    switchgear: { label: 'Power Distribution', key: 'switchgear', per: 12 },
    ups_modules: { label: 'UPS & Battery', key: 'ups_modules', per: 4 },
    generators: { label: 'Generators', key: 'generators', per: 8 },
    chillers: { label: 'Cooling (Chillers/CDU)', key: 'chillers', per: 6 },
    cooling_units: { label: 'CRAC / AHU / FCU', key: 'cooling_units', per: 2 },
    pdus: { label: 'PDU / Busway', key: 'pdus', per: 1 },
    fireZones: { label: 'Fire Protection', key: 'fireZones', per: 3 },
};

export function CommissioningEnginePage() {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const inputs = useSimulationStore((s) => s.inputs);
    const country = useSimulationStore((s) => s.selectedCountry);
    const t = useCxTracking();
    const [tab, setTab] = React.useState<'overview' | 'cost'>('overview');

    const model = React.useMemo(() => {
        const m = rzModels()?.commissioning;
        if (!m?.programRich) return null;
        const rich = m.programRich({ itLoadKw: inputs.itLoad, coolingType: inputs.coolingType, powerRedundancy: inputs.powerRedundancy, countryId: country?.id });
        // readiness from tracking (ENGINE readinessIndex — real linkage)
        let readiness: { index: number; status: string; label: string } | null = null;
        try {
            const comp: Record<string, number> = {};
            Object.entries(t.completion).forEach(([k, v]) => { if (v != null) comp[k] = v; });
            if (m.readinessIndex && Object.keys(comp).length > 0) readiness = m.readinessIndex(comp);
        } catch { /* */ }
        const eq = rich.equip as Record<string, number>;
        const systems = Object.values(TESTS_PER).map((s) => {
            const count = eq[s.key] ?? 0;
            const tests = count * s.per;
            return { label: s.label, count, tests };
        }).filter((s) => s.count > 0);
        const testsTotal = t.testsTotalOverride ?? systems.reduce((s, x) => s + x.tests, 0);
        return { rich, readiness, systems, testsTotal };
    }, [inputs, country, t.completion, t.testsTotalOverride]);

    if (!model) return <div className="p-8 text-center text-sm text-slate-500">Engine loading…</div>;
    const { rich, readiness, systems, testsTotal } = model;
    const planMode = cxPlanMode(t);
    const overall = readiness ? readiness.index : 0;
    const openIssues = t.issues.filter((x) => x.open && x.kind === 'issue');
    const punch = t.issues.filter((x) => x.kind === 'punch' && x.open);
    const READY_KEYS: { key: string; label: string }[] = [
        { key: 'L1', label: 'L1 Factory' }, { key: 'L2', label: 'L2 Component' }, { key: 'L3', label: 'L3 System' },
        { key: 'L4', label: 'L4 Subsystem' }, { key: 'L5', label: 'L5 Integrated (IST)' },
        { key: 'ist', label: 'IST scenarios' }, { key: 'sat', label: 'Site Acceptance' }, { key: 'fat', label: 'Factory Acceptance' },
        { key: 'punchlist', label: 'Punchlist burndown' },
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg"><CheckCircle2 className="h-6 w-6 text-white" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Commissioning Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Program plan engine-real (rich cx model) · progress user-tracked · readiness = engine readinessIndex</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                        {([['overview', 'Progress & Systems'], ['cost', 'Program Cost & Risk']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                        ))}
                    </div>
                    <button onClick={() => setActiveTab('ops')} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">Next: Operations <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'cost' ? <CommissioningDashboard /> : (
                <div className="space-y-4">
                    {planMode && (
                        <div className="rounded-xl border border-violet-500/40 bg-violet-600/10 px-3 py-2 text-[11px] text-violet-500">
                            <b>Plan Mode</b> — no commissioning progress entered yet. The program plan below is engine-real; set per-level completion to activate the readiness index.
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                            { label: 'Readiness Index', value: readiness ? `${overall}%` : '—', sub: readiness ? `${readiness.status} (engine)` : 'enter completion below' },
                            { label: 'Program Duration', value: `${rich.durationDays} d`, sub: `~${rich.durationMonths} mo · L0→L6` },
                            { label: 'Systems in Scope', value: String(systems.length), sub: 'from equipment scaling' },
                            { label: 'Tests (screening)', value: testsTotal.toLocaleString(), sub: t.testsPassed != null ? `${t.testsPassed} passed · ${t.testsFailed ?? 0} failed` : 'counts × tests-per-unit' },
                            { label: 'Open Issues', value: String(openIssues.length), sub: `${punch.length} punch items` },
                            { label: 'IST Scenarios', value: String(rich.tierInfo.scenarios), sub: `${rich.tierInfo.tier} · ${rich.tierInfo.istHrs}h IST` },
                        ].map((k) => (
                            <div key={k.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</div>
                                <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                <div className="truncate text-[10px] text-slate-500">{k.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        {/* level timeline */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Commissioning Timeline (L0–L6 · engine staffed durations)</h2>
                            <div className="space-y-1.5">
                                {(() => {
                                    let cursor = 0;
                                    const total = rich.durationDays || 1;
                                    return rich.levels.map((l: { id: string; label: string; days: number; cost: number }, idx: number) => {
                                        const left = (cursor / total) * 100; cursor += l.days;
                                        return (
                                            <div key={l.id} className="flex items-center gap-2 text-[11px]">
                                                <span className="w-40 truncate text-slate-600 dark:text-slate-300">{l.label}</span>
                                                <div className="relative h-3 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                                                    <div className="absolute h-3 rounded" style={{ left: `${left}%`, width: `${(l.days / total) * 100}%`, background: LEVEL_COLORS[idx] }} />
                                                </div>
                                                <span className="w-12 text-right tabular-nums text-slate-500">{l.days}d</span>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        {/* readiness completion input */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Readiness Completion <span className="text-[9px] normal-case text-violet-400">feeds engine readinessIndex (weights engine-real)</span></h2>
                            <div className="space-y-1.5">
                                {READY_KEYS.map((rk) => {
                                    const v = t.completion[rk.key];
                                    return (
                                        <div key={rk.key} className="flex items-center gap-2 text-[11px]">
                                            <span className="w-36 text-slate-600 dark:text-slate-300">{rk.label}</span>
                                            <input type="range" min={0} max={100} step={5}
                                                value={v == null ? 0 : Math.round(v * 100)}
                                                onChange={(ev) => t.actions.setCompletion(rk.key, Number(ev.target.value) / 100)}
                                                className="flex-1 accent-violet-500" />
                                            <span className="w-10 text-right tabular-nums text-slate-500">{v == null ? '—' : `${Math.round(v * 100)}%`}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            {readiness && (
                                <div className={`mt-2 rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold ${readiness.status === 'Ready' ? 'bg-emerald-500/15 text-emerald-500' : readiness.status === 'Conditional' ? 'bg-amber-500/15 text-amber-500' : 'bg-slate-500/15 text-slate-400'}`}>
                                    {readiness.label} — {overall}%
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
                        {/* systems table */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Commissioning by System <span className="ml-1 rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-semibold text-amber-500">TESTS = SCREENING (counts × per-unit)</span></h2>
                            <table className="w-full text-[11px]">
                                <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">System</th><th className="text-right">Units</th><th className="text-right">Tests</th></tr></thead>
                                <tbody>
                                    {systems.map((s) => (
                                        <tr key={s.label} className="border-b border-slate-100 dark:border-slate-800/60">
                                            <td className="py-1 text-slate-700 dark:text-slate-200">{s.label}</td>
                                            <td className="text-right tabular-nums text-slate-500">{s.count.toLocaleString()}</td>
                                            <td className="text-right tabular-nums text-slate-500">{s.tests.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* issues & punch */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Issues & Punch List</h2>
                            <div className="space-y-1">
                                {t.issues.map((x) => (
                                    <label key={x.id} className="flex items-center gap-2 text-[11px]">
                                        <input type="checkbox" checked={!x.open} onChange={() => t.actions.toggleIssue(x.id)} className="accent-violet-500" />
                                        <span className={`rounded px-1 py-0.5 text-[8.5px] font-bold ${x.sev === 'High' ? 'bg-rose-500/15 text-rose-500' : x.sev === 'Medium' ? 'bg-amber-500/15 text-amber-500' : 'bg-slate-500/15 text-slate-400'}`}>{x.sev}</span>
                                        <span className={`flex-1 truncate ${x.open ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 line-through'}`}>{x.title}</span>
                                        <span className="text-[9px] uppercase text-slate-400">{x.kind}</span>
                                        {x.isExample && <span className="rounded bg-amber-500/15 px-1 text-[8px] font-semibold text-amber-500">EXAMPLE</span>}
                                    </label>
                                ))}
                            </div>
                            <button onClick={() => t.actions.upsertIssue({ id: `c_${Date.now()}`, title: 'New item', sev: 'Medium', kind: 'punch', open: true })}
                                className="mt-2 rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:border-violet-400">＋ Add item</button>
                        </div>
                    </div>

                    {/* phase donut */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Program Cost Share by Level (engine fixed proportions)</h2>
                        <div className="flex items-center gap-3">
                            <div className="h-36 w-36 shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={rich.levels} dataKey="cost" nameKey="label" innerRadius={34} outerRadius={54} paddingAngle={2}>
                                            {rich.levels.map((_: unknown, idx: number) => <Cell key={idx} fill={LEVEL_COLORS[idx]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v) => `$${(Number(v) / 1e3).toFixed(0)}K`} contentStyle={{ fontSize: 10 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="min-w-0 flex-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                                {rich.levels.map((l: { id: string; label: string; pct: number }, idx: number) => (
                                    <div key={l.id} className="flex items-center gap-1.5 text-[10px]">
                                        <span className="h-2 w-2 rounded-sm" style={{ background: LEVEL_COLORS[idx] }} />
                                        <span className="truncate text-slate-600 dark:text-slate-300">{l.label}</span>
                                        <span className="ml-auto tabular-nums text-slate-500">{l.pct}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
