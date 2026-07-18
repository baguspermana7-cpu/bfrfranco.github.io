'use client';

/* ─── Asset Intelligence — page (Phase J, tab 'asset-health') ────────────────
 * Fleet GENERATED engine-real: class counts from equipScale, health from the
 * Weibull healthIndex at a user-set fleet age, MTBF/MTTR from
 * DATA.reliability.components. No fabricated per-unit registry — per-class
 * aggregates (honest for a planning tool). Old AssetIntelDashboard (health +
 * failure risk + replacement schedule) survives as the "Lifecycle Detail"
 * tab. Children asset-lifecycle / cbm / spares untouched.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useSimulationStore } from '@/store/simulation';
import { useRequirementsStore } from '@/store/requirements';
import { rzModels, rzData } from '@/lib/rz-engine';
import { densityToEngineBucket } from '@/lib/requirementsMappings';
import { AssetIntelDashboard } from '@/components/modules/NewEngineDashboards';
import { CreatableCombobox, type ComboValue } from '@/components/ui/CreatableCombobox';
import { Activity, ChevronRight } from 'lucide-react';

const CAT_COLORS = ['#3b82f6', '#06b6d4', '#a855f7', '#f59e0b', '#ef4444', '#64748b'];

interface ClassRow { cls: string; label: string; category: string; count: number; health: number; status: string; mtbfHrs: number | null; mttrHrs: number | null; fpPct: number }

const CLASS_MAP: { cls: string; eqKey: string; label: string; category: string }[] = [
    { cls: 'switchgear', eqKey: 'switchgear', label: 'MV Switchgear', category: 'Power Infrastructure' },
    { cls: 'transformer', eqKey: 'transformers', label: 'Transformers', category: 'Power Infrastructure' },
    { cls: 'generator', eqKey: 'generators', label: 'Generators', category: 'Power Infrastructure' },
    { cls: 'ups', eqKey: 'ups_modules', label: 'UPS Modules', category: 'Power Infrastructure' },
    { cls: 'pdu', eqKey: 'pdus', label: 'PDUs', category: 'Power Infrastructure' },
    { cls: 'chiller', eqKey: 'chillers', label: 'Chillers / CDU', category: 'Cooling Infrastructure' },
    { cls: 'crac', eqKey: 'cooling_units', label: 'CRAC / AHU', category: 'Cooling Infrastructure' },
    { cls: 'battery', eqKey: 'ups_modules', label: 'Battery Strings', category: 'Power Infrastructure' },
    { cls: 'bms', eqKey: 'ahu', label: 'BMS Controllers', category: 'Controls' },
];

export function AssetIntelligencePage() {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const inputs = useSimulationStore((s) => s.inputs);
    const req = useRequirementsStore();
    const [tab, setTab] = React.useState<'overview' | 'lifecycle'>('overview');
    const [ageYears, setAgeYears] = React.useState<number>(3);
    const [condition, setCondition] = React.useState<number>(0.85);

    const model = React.useMemo(() => {
        const m = rzModels();
        let eq: Record<string, number> | null = null;
        try { eq = m?.commissioning?.equipScale ? m.commissioning.equipScale({ itLoad: inputs.itLoad, rackDensity: densityToEngineBucket(req.workload.avgRackDensityKw) }) : null; } catch { /* */ }
        if (!eq) return null;
        const comps: Record<string, { mtbfHours?: number; mttrHours?: number }> = rzData()?.reliability?.components ?? {};
        const rows: ClassRow[] = CLASS_MAP.map((c) => {
            const count = eq![c.eqKey] ?? 0;
            let health = 0, status = '—', fp = 0;
            try {
                if (m?.asset?.healthIndex) {
                    const h = m.asset.healthIndex({ assetClass: c.cls, ageYears, condition, duty: 0.5 });
                    health = h?.health ?? 0; status = h?.status ?? '—';
                }
                if (m?.asset?.failureProbability) fp = (m.asset.failureProbability(c.cls, ageYears)?.failureProb ?? 0) * 100;
            } catch { /* */ }
            const comp = comps[c.cls] ?? {};
            return { cls: c.cls, label: c.label, category: c.category, count, health: Math.round(health), status, mtbfHrs: comp.mtbfHours ?? null, mttrHrs: comp.mttrHours ?? null, fpPct: Math.round(fp) };
        }).filter((r) => r.count > 0);
        const total = rows.reduce((s, r) => s + r.count, 0);
        const byCat = new Map<string, number>();
        rows.forEach((r) => byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.count));
        const catDonut = [...byCat.entries()].map(([name, value]) => ({ name, value }));
        const avgHealth = rows.length ? Math.round(rows.reduce((s, r) => s + r.health * r.count, 0) / Math.max(1, total)) : 0;
        const buckets = {
            excellent: rows.filter((r) => r.health >= 85).reduce((s, r) => s + r.count, 0),
            good: rows.filter((r) => r.health >= 70 && r.health < 85).reduce((s, r) => s + r.count, 0),
            fair: rows.filter((r) => r.health >= 50 && r.health < 70).reduce((s, r) => s + r.count, 0),
            poor: rows.filter((r) => r.health >= 30 && r.health < 50).reduce((s, r) => s + r.count, 0),
            critical: rows.filter((r) => r.health < 30).reduce((s, r) => s + r.count, 0),
        };
        const atRisk = rows.filter((r) => r.fpPct >= 25).reduce((s, r) => s + r.count, 0);
        return { rows, total, catDonut, avgHealth, buckets, atRisk };
    }, [inputs.itLoad, req.workload.avgRackDensityKw, ageYears, condition]);

    if (!model) return <div className="p-8 text-center text-sm text-slate-500">Engine loading…</div>;

    const ageVal: ComboValue<number> = { value: ageYears, isCustom: ![1, 3, 5, 8, 12].includes(ageYears) };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg"><Activity className="h-6 w-6 text-white" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Asset Intelligence</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Fleet generated from the design (equipment scaling) · health = engine Weibull model at the set fleet age</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[10px] uppercase text-slate-500">Fleet age
                        <div className="w-24 normal-case">
                            <CreatableCombobox<number> options={[1, 3, 5, 8, 12].map((v) => ({ value: v, label: `${v} yr` }))}
                                value={ageVal} min={0} max={30} unit="yr"
                                onChange={(v) => setAgeYears(v?.value ?? 3)} />
                        </div>
                    </label>
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                        {([['overview', 'Fleet Overview'], ['lifecycle', 'Lifecycle Detail']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                        ))}
                    </div>
                    <button onClick={() => setActiveTab('spares')} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">Spares <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'lifecycle' ? <AssetIntelDashboard /> : (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                            { label: 'Total Tracked Units', value: model.total.toLocaleString(), sub: 'engine equipment scaling' },
                            { label: 'Avg Health', value: `${model.avgHealth}/100`, sub: `age ${ageYears} yr · condition ${Math.round(condition * 100)}%` },
                            { label: 'Excellent / Good', value: (model.buckets.excellent + model.buckets.good).toLocaleString(), sub: `${model.buckets.excellent.toLocaleString()} excellent` },
                            { label: 'Fair', value: model.buckets.fair.toLocaleString(), sub: 'monitor' },
                            { label: 'Poor / Critical', value: (model.buckets.poor + model.buckets.critical).toLocaleString(), sub: 'plan replacement' },
                            { label: 'At Wear-Out Risk', value: model.atRisk.toLocaleString(), sub: '≥25% Weibull CDF' },
                        ].map((k) => (
                            <div key={k.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</div>
                                <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                <div className="truncate text-[10px] text-slate-500">{k.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Assets by Category</h2>
                                <div className="flex items-center gap-2">
                                    <div className="h-32 w-32 shrink-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={model.catDonut} dataKey="value" nameKey="name" innerRadius={30} outerRadius={50} paddingAngle={2}>
                                                    {model.catDonut.map((_, idx) => <Cell key={idx} fill={CAT_COLORS[idx]} />)}
                                                </Pie>
                                                <Tooltip contentStyle={{ fontSize: 10 }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex-1 space-y-0.5">
                                        {model.catDonut.map((r, idx) => (
                                            <div key={r.name} className="flex items-center gap-1.5 text-[10px]">
                                                <span className="h-2 w-2 rounded-sm" style={{ background: CAT_COLORS[idx] }} />
                                                <span className="text-slate-600 dark:text-slate-300">{r.name}</span>
                                                <span className="ml-auto tabular-nums text-slate-500">{r.value.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Fleet Condition Assumption</h2>
                                <div className="flex items-center gap-2 text-[11px]">
                                    <span className="w-24 text-slate-600 dark:text-slate-300">Condition</span>
                                    <input type="range" min={30} max={100} step={5} value={Math.round(condition * 100)}
                                        onChange={(e) => setCondition(Number(e.target.value) / 100)} className="flex-1 accent-violet-500" />
                                    <span className="w-10 text-right tabular-nums text-slate-500">{Math.round(condition * 100)}%</span>
                                </div>
                                <p className="mt-1 text-[9px] text-slate-400">Health = engine weighted (remaining-life + condition + duty). Adjust to match the real fleet condition survey.</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Class Health & Reliability <span className="text-[9px] normal-case text-slate-400">MTBF/MTTR = engine IEEE-493 component data</span></h2>
                            <table className="w-full text-[11px]">
                                <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">Class</th><th className="text-right">Units</th><th className="text-right">Health</th><th className="text-right">Weibull CDF</th><th className="text-right">MTBF</th><th className="text-right">MTTR</th></tr></thead>
                                <tbody>
                                    {model.rows.map((r) => (
                                        <tr key={r.cls + r.label} className="border-b border-slate-100 dark:border-slate-800/60">
                                            <td className="py-1 text-slate-700 dark:text-slate-200">{r.label} <span className="text-[9px] text-slate-400">· {r.status}</span></td>
                                            <td className="text-right tabular-nums text-slate-500">{r.count.toLocaleString()}</td>
                                            <td className="text-right"><span className={`tabular-nums font-semibold ${r.health >= 70 ? 'text-emerald-500' : r.health >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>{r.health}</span></td>
                                            <td className="text-right tabular-nums text-slate-500">{r.fpPct}%</td>
                                            <td className="text-right tabular-nums text-slate-500">{r.mtbfHrs ? `${(r.mtbfHrs / 1000).toFixed(0)}k h` : '—'}</td>
                                            <td className="text-right tabular-nums text-slate-500">{r.mttrHrs ? `${r.mttrHrs} h` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Health Distribution by Class</h2>
                        <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={model.rows}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                    <XAxis dataKey="label" tick={{ fontSize: 8 }} interval={0} angle={-15} height={40} textAnchor="end" />
                                    <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
                                    <Tooltip contentStyle={{ fontSize: 10 }} />
                                    <Bar dataKey="health" name="Health /100" radius={[3, 3, 0, 0]}>
                                        {model.rows.map((r) => <Cell key={r.cls + r.label} fill={r.health >= 70 ? '#34d399' : r.health >= 50 ? '#f59e0b' : '#fb7185'} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="flex gap-2 text-[11px]">
                        {([['asset-lifecycle', 'Asset Lifecycle →'], ['cbm', 'CBM / DCIM →'], ['spares', 'Spares Optimization →'], ['maint', 'Maintenance →']] as const).map(([id, l]) => (
                            <button key={id} onClick={() => setActiveTab(id)} className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:border-violet-400">{l}</button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
