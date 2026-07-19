'use client';

/* ─── Scenarios + Scenario Comparison — full pages (Phase AE) ────────────────
 * Reference parity (menu platform-scenarios.png / -scenario comparison.png):
 * platform header · KPI chip row · filter bar · rich table w/ per-scenario
 * KPI deltas vs baseline · selected-scenario detail rail · comparison page
 * w/ settings bar, scenario cards, best-cell KPI table, radar + weighted
 * score summary + deterministic insights. All values from the saved scenario
 * snapshots (engine-computed at save time) — no fabricated data.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useScenarioStore, type SavedScenario } from '@/store/scenario';
import { useCapexStore } from '@/store/capex';
import { useSimulationStore } from '@/store/simulation';
import { COUNTRIES } from '@/constants/countries';
import { Layers, GitCompare, Search, Star, Trash2, FolderOpen, ChevronRight } from 'lucide-react';

const SC_COLORS = ['#a78bfa', '#22d3ee', '#34d399', '#f59e0b'];
const fm = (v: number | undefined | null, pfx = '$') =>
    v == null ? '—' : v >= 1e6 ? `${pfx}${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${pfx}${(v / 1e3).toFixed(0)}K` : `${pfx}${Math.round(v)}`;

/* shared platform primitives (AE) */
export function PlatformHeader({ icon: Icon, title, sub, tone, actions }: {
    icon: React.ElementType; title: string; sub: string; tone: string; actions?: React.ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${tone} shadow-lg`}><Icon className="h-6 w-6 text-white" /></div>
                <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Platform</div>
                    <h1 className="text-2xl font-bold leading-tight text-slate-900 dark:text-white">{title}</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{sub}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">{actions}</div>
        </div>
    );
}

export function KpiChips({ items }: { items: { label: string; value: string; sub?: string }[] }) {
    return (
        <div className={`grid grid-cols-2 gap-3 md:grid-cols-${Math.min(5, items.length)}`}>
            {items.map((k) => (
                <div key={k.label} title={`${k.label}: ${k.value}${k.sub ? ` — ${k.sub}` : ''}`}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</div>
                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                    {k.sub && <div className="truncate text-[10px] text-slate-500">{k.sub}</div>}
                </div>
            ))}
        </div>
    );
}

/* ── SCENARIOS PAGE ── */
export function ScenariosPage() {
    const st = useScenarioStore();
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const simActions = useSimulationStore((s) => s.actions);
    const capexSetInputs = useCapexStore((s) => s.setInputs);
    const [q, setQ] = React.useState('');
    const [selId, setSelId] = React.useState<string | null>(null);
    const scenarios = st.scenarios;
    const baseline = scenarios[0] ?? null;                       // oldest save = baseline (documented)
    const filtered = scenarios.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.countryId.toLowerCase().includes(q.toLowerCase()));
    const sel = scenarios.find((s) => s.id === selId) ?? filtered[0] ?? null;

    const delta = (v?: number, b?: number) => {
        if (v == null || b == null || b === 0) return null;
        return ((v - b) / Math.abs(b)) * 100;
    };
    const DeltaCell = ({ v, b, invert = false }: { v?: number; b?: number; invert?: boolean }) => {
        const d = delta(v, b);
        if (d == null || Math.abs(d) < 0.05) return <span className="text-slate-400">—</span>;
        const good = invert ? d < 0 : d > 0;
        return <span className={good ? 'text-emerald-500' : 'text-rose-400'} title={`${d >= 0 ? '+' : ''}${d.toFixed(1)}% vs baseline (${baseline?.name})`}>{d >= 0 ? '+' : ''}{d.toFixed(1)}%</span>;
    };

    return (
        <div className="space-y-4">
            <PlatformHeader icon={Layers} title="Scenarios" sub="Create, compare, and analyze different configurations and outcomes" tone="from-violet-500 to-purple-600"
                actions={<>
                    <button onClick={() => setActiveTab('scenario-compare')} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-violet-400"><GitCompare className="h-3.5 w-3.5" /> Compare</button>
                    <button onClick={() => st.openPanel()} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">＋ New Scenario</button>
                </>} />

            <KpiChips items={[
                { label: 'Total Scenarios', value: String(scenarios.length), sub: 'saved locally' },
                { label: 'In Comparison', value: String(st.comparisonIds.length), sub: 'selected for compare' },
                { label: 'Countries', value: String(new Set(scenarios.map((s) => s.countryId)).size), sub: 'covered' },
                { label: 'Baseline', value: baseline?.name.slice(0, 14) ?? '—', sub: 'oldest save = baseline' },
            ]} />

            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
                    <input className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-violet-500 text-slate-900 dark:text-slate-100"
                        placeholder="Search scenarios…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <span className="text-[10px] text-slate-400">Deltas vs baseline · ✓ = in comparison set</span>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
                <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                    <table className="w-full text-xs">
                        <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400">
                            <th className="w-8 px-2 py-2"></th><th className="text-left">Scenario</th><th className="text-left">Country</th>
                            <th className="text-right">CAPEX</th><th className="text-right">Δ</th>
                            <th className="text-right">OPEX/mo</th><th className="text-right">Δ</th>
                            <th className="text-right">PUE</th><th className="text-right">Staff</th>
                            <th className="text-left pl-3">Saved</th><th className="w-8"></th>
                        </tr></thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr><td colSpan={11} className="px-3 py-8 text-center text-[11px] text-slate-400">
                                    No scenarios yet — configure the project, then save one via ＋ New Scenario.
                                </td></tr>
                            )}
                            {filtered.map((s) => (
                                <tr key={s.id} onClick={() => setSelId(s.id)}
                                    className={`cursor-pointer border-b border-slate-100 dark:border-slate-800/60 ${sel?.id === s.id ? 'bg-violet-600/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
                                    <td className="px-2 py-2">
                                        <button onClick={(e) => { e.stopPropagation(); st.toggleComparisonSelection(s.id); }}
                                            title={st.comparisonIds.includes(s.id) ? 'Remove from comparison' : 'Add to comparison (max 4)'}
                                            className={st.comparisonIds.includes(s.id) ? 'text-violet-500' : 'text-slate-300 dark:text-slate-600 hover:text-violet-400'}>
                                            <Star className="h-3.5 w-3.5" fill={st.comparisonIds.includes(s.id) ? 'currentColor' : 'none'} />
                                        </button>
                                    </td>
                                    <td className="font-medium text-slate-800 dark:text-slate-200">{s.name}{s.id === baseline?.id && <span className="ml-1.5 rounded bg-slate-500/15 px-1 py-0.5 text-[8px] font-semibold uppercase text-slate-400">baseline</span>}</td>
                                    <td className="text-slate-500">{COUNTRIES[s.countryId]?.name ?? s.countryId}</td>
                                    <td className="text-right tabular-nums text-slate-600 dark:text-slate-300">{fm(s.summary?.annualCapex)}</td>
                                    <td className="text-right tabular-nums"><DeltaCell v={s.summary?.annualCapex} b={baseline?.summary?.annualCapex} invert /></td>
                                    <td className="text-right tabular-nums text-slate-600 dark:text-slate-300">{fm(s.summary?.monthlyOpex)}</td>
                                    <td className="text-right tabular-nums"><DeltaCell v={s.summary?.monthlyOpex} b={baseline?.summary?.monthlyOpex} invert /></td>
                                    <td className="text-right tabular-nums text-slate-500">{s.summary?.pue?.toFixed(2) ?? '—'}</td>
                                    <td className="text-right tabular-nums text-slate-500">{s.summary?.totalStaff ?? '—'}</td>
                                    <td className="pl-3 text-[10px] text-slate-400">{new Date(s.timestamp).toLocaleDateString()}</td>
                                    <td><button onClick={(e) => { e.stopPropagation(); st.deleteScenario(s.id); }} className="text-slate-300 hover:text-rose-400"><Trash2 className="h-3 w-3" /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="border-t border-slate-100 dark:border-slate-800/60 px-3 py-1.5 text-[10px] text-slate-400">
                        Showing {filtered.length} of {scenarios.length} scenarios
                    </div>
                </div>

                {/* detail rail */}
                <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Scenario Details</h3>
                        {!sel ? <p className="text-[10px] text-slate-400">Select a scenario.</p> : (
                            <div className="space-y-1 text-[11px]">
                                <div className="text-xs font-bold text-slate-900 dark:text-white">{sel.name}</div>
                                {([
                                    ['Country', COUNTRIES[sel.countryId]?.name ?? sel.countryId],
                                    ['IT Load', `${((sel.simInputs?.itLoad ?? 0) / 1000).toFixed(1)} MW`],
                                    ['Tier', `Tier ${sel.simInputs?.tierLevel ?? '—'}`],
                                    ['Cooling', String(sel.simInputs?.coolingType ?? '—')],
                                    ['CAPEX', fm(sel.summary?.annualCapex)],
                                    ['OPEX / mo', fm(sel.summary?.monthlyOpex)],
                                    ['PUE', sel.summary?.pue?.toFixed(2) ?? '—'],
                                    ['IRR', sel.summary?.irr != null ? `${(sel.summary.irr * 100).toFixed(1)}%` : '—'],
                                    ['NPV', fm(sel.summary?.npv)],
                                    ['CO₂ / yr', sel.summary?.annualCO2 != null ? `${Math.round(sel.summary.annualCO2).toLocaleString()} t` : '—'],
                                ] as [string, string][]).map(([l, v]) => (
                                    <div key={l} className="flex justify-between"><span className="text-slate-500">{l}</span><span className="font-medium tabular-nums text-slate-800 dark:text-slate-200">{v}</span></div>
                                ))}
                            </div>
                        )}
                    </div>
                    {sel && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3 space-y-1.5">
                            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Quick Actions</h3>
                            <button onClick={() => { simActions.setInputs(sel.simInputs); capexSetInputs(sel.capexInputs); simActions.selectCountry(sel.countryId); }}
                                className="w-full rounded-lg bg-violet-600 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500"><FolderOpen className="mr-1 inline h-3 w-3" /> Open (restore inputs)</button>
                            <button onClick={() => { st.toggleComparisonSelection(sel.id); }} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 py-1.5 text-[11px] text-slate-600 dark:text-slate-300 hover:border-violet-400">{st.comparisonIds.includes(sel.id) ? 'Remove from' : 'Add to'} comparison</button>
                            <button onClick={() => setActiveTab('scenario-compare')} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 py-1.5 text-[11px] text-slate-600 dark:text-slate-300 hover:border-violet-400">Open Comparison <ChevronRight className="inline h-3 w-3" /></button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── SCENARIO COMPARISON PAGE ── */
export function ScenarioComparePage() {
    const st = useScenarioStore();
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const chosen: SavedScenario[] = (st.comparisonIds.length
        ? st.scenarios.filter((s) => st.comparisonIds.includes(s.id))
        : st.scenarios.slice(0, 3)).slice(0, 4);

    /* weighted score per scenario — documented composite over the saved
     * summary metrics (cost 35 / efficiency 25 / financial 25 / carbon 15).
     * Normalized against the best value across the chosen set. */
    const scores = React.useMemo(() => {
        if (!chosen.length) return [];
        const min = (f: (s: SavedScenario) => number | undefined) => Math.min(...chosen.map((s) => f(s) ?? Infinity));
        const max = (f: (s: SavedScenario) => number | undefined) => Math.max(...chosen.map((s) => f(s) ?? -Infinity));
        return chosen.map((s) => {
            const capex = s.summary?.annualCapex, opex = s.summary?.monthlyOpex, pue = s.summary?.pue;
            const irr = s.summary?.irr, co2 = s.summary?.annualCO2;
            const norm = (v: number | undefined, lo: number, hi: number, invert: boolean) => {
                if (v == null || !Number.isFinite(lo) || !Number.isFinite(hi) || hi === lo) return 60;
                const t = (v - lo) / (hi - lo);
                return Math.round(100 * (invert ? 1 - t : t)) * 0.7 + 30;
            };
            const cost = (norm(capex, min((x) => x.summary?.annualCapex), max((x) => x.summary?.annualCapex), true)
                + norm(opex, min((x) => x.summary?.monthlyOpex), max((x) => x.summary?.monthlyOpex), true)) / 2;
            const eff = norm(pue, min((x) => x.summary?.pue), max((x) => x.summary?.pue), true);
            const fin = norm(irr, min((x) => x.summary?.irr), max((x) => x.summary?.irr), false);
            const carbon = norm(co2, min((x) => x.summary?.annualCO2), max((x) => x.summary?.annualCO2), true);
            const total = Math.round(0.35 * cost + 0.25 * eff + 0.25 * fin + 0.15 * carbon);
            const grade = total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 50 ? 'C' : 'D';
            return { s, cost: Math.round(cost), eff: Math.round(eff), fin: Math.round(fin), carbon: Math.round(carbon), total, grade };
        });
    }, [chosen]);

    const radarData = ['Cost', 'Efficiency', 'Financial', 'Carbon'].map((axis, i) => {
        const row: Record<string, string | number> = { axis };
        scores.forEach((sc) => { row[sc.s.name] = [sc.cost, sc.eff, sc.fin, sc.carbon][i]; });
        return row;
    });

    const insights = React.useMemo(() => {
        const out: string[] = [];
        if (scores.length >= 2) {
            const best = [...scores].sort((a, b) => b.total - a.total)[0];
            out.push(`${best.s.name} leads the weighted score (${best.total}/100, grade ${best.grade}).`);
            const cheapest = [...chosen].sort((a, b) => (a.summary?.annualCapex ?? Infinity) - (b.summary?.annualCapex ?? Infinity))[0];
            if (cheapest.summary?.annualCapex != null) out.push(`${cheapest.name} has the lowest CAPEX (${fm(cheapest.summary.annualCapex)}).`);
            const bestPue = [...chosen].sort((a, b) => (a.summary?.pue ?? 9) - (b.summary?.pue ?? 9))[0];
            if (bestPue.summary?.pue != null) out.push(`${bestPue.name} is the most efficient (PUE ${bestPue.summary.pue.toFixed(2)}).`);
            const spread = delta0(chosen.map((c) => c.summary?.annualCapex));
            if (spread != null && spread > 15) out.push(`CAPEX spread across scenarios is ${spread.toFixed(0)}% — configuration choices are cost-material.`);
        }
        return out;
    }, [scores, chosen]);

    function delta0(vals: (number | undefined)[]): number | null {
        const v = vals.filter((x): x is number => x != null);
        if (v.length < 2) return null;
        return ((Math.max(...v) - Math.min(...v)) / Math.min(...v)) * 100;
    }

    const rows: { label: string; get: (s: SavedScenario) => number | undefined; fmt: (v: number) => string; invert?: boolean }[] = [
        { label: 'CAPEX', get: (s) => s.summary?.annualCapex, fmt: (v) => fm(v), invert: true },
        { label: 'OPEX (monthly)', get: (s) => s.summary?.monthlyOpex, fmt: (v) => fm(v), invert: true },
        { label: 'PUE', get: (s) => s.summary?.pue, fmt: (v) => v.toFixed(2), invert: true },
        { label: 'Total Staff', get: (s) => s.summary?.totalStaff, fmt: (v) => String(Math.round(v)), invert: true },
        { label: 'IRR', get: (s) => s.summary?.irr, fmt: (v) => `${(v * 100).toFixed(1)}%` },
        { label: 'NPV', get: (s) => s.summary?.npv, fmt: (v) => fm(v) },
        { label: 'CO₂ (t/yr)', get: (s) => s.summary?.annualCO2, fmt: (v) => Math.round(v).toLocaleString(), invert: true },
    ];

    return (
        <div className="space-y-4">
            <PlatformHeader icon={GitCompare} title="Scenario Comparison" sub="Compare multiple scenarios across key performance, cost, risk, and sustainability" tone="from-cyan-500 to-blue-600"
                actions={<button onClick={() => setActiveTab('scenarios')} className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-violet-400">Manage scenarios</button>} />

            {chosen.length < 2 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-8 text-center text-sm text-slate-500">
                    Select at least 2 scenarios (★ in the Scenarios page) to compare. {st.scenarios.length === 0 && 'No scenarios saved yet.'}
                </div>
            ) : (<>
                {/* scenario header cards */}
                <div className={`grid gap-3 md:grid-cols-${Math.min(4, chosen.length)}`}>
                    {chosen.map((s, i) => (
                        <div key={s.id} className="rounded-2xl border p-3" style={{ borderColor: SC_COLORS[i] + '66', background: SC_COLORS[i] + '0d' }}>
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SC_COLORS[i] }} />
                                <span className="truncate text-xs font-bold text-slate-900 dark:text-white">{s.name}</span>
                                {scores[i] && <span className="ml-auto rounded bg-white/60 dark:bg-slate-900/60 px-1.5 py-0.5 text-[10px] font-bold" style={{ color: SC_COLORS[i] }}>{scores[i].grade} · {scores[i].total}</span>}
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500">{COUNTRIES[s.countryId]?.name} · {((s.simInputs?.itLoad ?? 0) / 1000).toFixed(1)} MW · Tier {s.simInputs?.tierLevel} · {String(s.simInputs?.coolingType)}</div>
                        </div>
                    ))}
                </div>

                {/* KPI comparison table w/ best-cell highlight */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                    <table className="w-full text-xs">
                        <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400">
                            <th className="px-3 py-2 text-left">Metric</th>
                            {chosen.map((s, i) => <th key={s.id} className="px-2 text-right" style={{ color: SC_COLORS[i] }}>{s.name.slice(0, 16)}</th>)}
                        </tr></thead>
                        <tbody>
                            {rows.map((r) => {
                                const vals = chosen.map((s) => r.get(s));
                                const defined = vals.filter((v): v is number => v != null);
                                const bestVal = defined.length > 1 ? (r.invert ? Math.min(...defined) : Math.max(...defined)) : null;
                                return (
                                    <tr key={r.label} className="border-b border-slate-100 dark:border-slate-800/60">
                                        <td className="px-3 py-1.5 text-slate-500">{r.label}{r.invert && <span className="ml-1 text-[8px]">(lower better)</span>}</td>
                                        {chosen.map((s, i) => {
                                            const v = vals[i];
                                            const best = v != null && v === bestVal;
                                            return <td key={s.id} title={v != null ? `${r.label}: ${r.fmt(v)}${best ? ' — best of the set' : ''}` : undefined}
                                                className={`px-2 py-1.5 text-right tabular-nums ${best ? 'bg-emerald-500/10 font-bold text-emerald-500' : 'text-slate-600 dark:text-slate-300'}`}>{v != null ? r.fmt(v) : '—'}</td>;
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                    {/* radar */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Dimension Radar <span className="text-[9px] normal-case text-slate-400">normalized within the chosen set</span></h2>
                        <div className="h-60">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={radarData} outerRadius="72%">
                                    <PolarGrid stroke="#334155" />
                                    <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8, fill: '#64748b' }} />
                                    {scores.map((sc, i) => (
                                        <Radar key={sc.s.id} name={sc.s.name} dataKey={sc.s.name} stroke={SC_COLORS[i]} fill={SC_COLORS[i]} fillOpacity={0.12} strokeWidth={1.5} />
                                    ))}
                                    <Tooltip formatter={(v) => `${v}/100`} contentStyle={{ fontSize: 10 }} />
                                    <Legend wrapperStyle={{ fontSize: 10 }} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    {/* score summary + insights */}
                    <div className="space-y-3">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Score Summary <span className="text-[9px] normal-case text-slate-400">weights: cost 35 · efficiency 25 · financial 25 · carbon 15</span></h2>
                            <div className="space-y-1.5">
                                {[...scores].sort((a, b) => b.total - a.total).map((sc) => {
                                    const i = chosen.findIndex((c) => c.id === sc.s.id);
                                    return (
                                        <div key={sc.s.id} className="flex items-center gap-2 text-[11px]" title={`${sc.s.name}: cost ${sc.cost} · efficiency ${sc.eff} · financial ${sc.fin} · carbon ${sc.carbon}`}>
                                            <span className="h-2 w-2 rounded-full" style={{ background: SC_COLORS[i] }} />
                                            <span className="w-32 truncate text-slate-700 dark:text-slate-200">{sc.s.name}</span>
                                            <div className="h-2 flex-1 rounded bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded" style={{ width: `${sc.total}%`, background: SC_COLORS[i] }} /></div>
                                            <span className="w-14 text-right font-bold tabular-nums text-slate-800 dark:text-slate-200">{sc.total} <span className="text-[9px] text-slate-400">{sc.grade}</span></span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Scenario Insights <span className="text-[9px] normal-case text-slate-400">deterministic rules</span></h2>
                            <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                                {insights.map((t, i) => <li key={i} className="flex gap-1.5"><span className="text-violet-500">▸</span>{t}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>
            </>)}
        </div>
    );
}
