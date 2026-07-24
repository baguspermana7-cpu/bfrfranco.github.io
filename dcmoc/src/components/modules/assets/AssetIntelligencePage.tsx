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
import { Tooltip as InfoTip } from '@/components/ui/Tooltip';
import { useSimulationStore } from '@/store/simulation';
import { useRequirementsStore } from '@/store/requirements';
import { rzModels, rzData } from '@/lib/rz-engine';
import { densityToEngineBucket } from '@/lib/requirementsMappings';
import { AssetIntelDashboard } from '@/components/modules/NewEngineDashboards';
import { CreatableCombobox, type ComboValue } from '@/components/ui/CreatableCombobox';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';
import { TraceValue } from '@/components/ui/TraceValue';
import { ScoreValue } from '@/components/ui/ScoreValue';
import { fmtMoney } from '@/lib/format';
import { Activity, ChevronRight, FileDown } from 'lucide-react';

const CAT_COLORS = ['#3b82f6', '#06b6d4', '#7DDDB4', '#f59e0b', '#ef4444', '#64748b'];

interface ClassRow { cls: string; label: string; category: string; count: number; health: number; status: string; mtbfHrs: number | null; mttrHrs: number | null; fpPct: number }
/* Workstream H — engine models.asset.replacementSchedule return shape */
interface ReplRow { component: string; label: string; intervalYears: number; costPerKw: number; eventCostUsd: number; replacementYears: number[]; events: number; totalNominalUsd: number; alt?: boolean }
interface CritRow extends ClassRow { crit: number }

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
        /* engine table fields are mtbf/mttr (hours) — DATA.reliability.components;
         * accept legacy mtbfHours/mttrHours aliases defensively. */
        const comps: Record<string, { mtbf?: number; mttr?: number; mtbfHours?: number; mttrHours?: number }> = rzData()?.reliability?.components ?? {};
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
            return { cls: c.cls, label: c.label, category: c.category, count, health: Math.round(health), status, mtbfHrs: comp.mtbf ?? comp.mtbfHours ?? null, mttrHrs: comp.mttr ?? comp.mttrHours ?? null, fpPct: Math.round(fp) };
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

        /* ── Workstream H · Replacement CAPEX Schedule — SURFACES the existing
         * engine models.asset.replacementSchedule (DATA.asset.lifecycle intervals
         * × $/kW × IT kW) over a 15-yr horizon. upsLiIon is an ALTERNATIVE to
         * upsVrla (same duty) — shown for the cost-vs-refresh-cadence trade but
         * EXCLUDED from the aggregate totals so nothing is double-counted. ── */
        const REPL_HORIZON = 15;
        let replacement: { rows: ReplRow[]; byYear: { year: string; cost: number }[]; total: number; horizon: number } | null = null;
        try {
            const lifecycleKeys: string[] = Object.keys(rzData()?.asset?.lifecycle ?? {});
            if (m?.asset?.replacementSchedule && lifecycleKeys.length) {
                const rrows: ReplRow[] = lifecycleKeys
                    .map((k) => { try { const r = m.asset.replacementSchedule(k, inputs.itLoad, REPL_HORIZON); return r ? { ...r, alt: k === 'upsLiIon' } : null; } catch { return null; } })
                    .filter((r): r is ReplRow => r != null);
                if (rrows.length) {
                    const byYearMap = new Map<number, number>();
                    rrows.filter((r) => !r.alt).forEach((r) => r.replacementYears.forEach((y) => byYearMap.set(y, (byYearMap.get(y) ?? 0) + r.eventCostUsd)));
                    replacement = {
                        rows: rrows,
                        byYear: Array.from({ length: REPL_HORIZON }, (_, i) => ({ year: `Y${i + 1}`, cost: byYearMap.get(i + 1) ?? 0 })),
                        total: rrows.filter((r) => !r.alt).reduce((s, r) => s + r.totalNominalUsd, 0),
                        horizon: REPL_HORIZON,
                    };
                }
            }
        } catch { /* engine absent — section renders an honest unavailable line */ }

        /* ── Workstream H · Criticality ranking — screening FMEA-style priority:
         * score = Weibull failure probability × MTTR (h) × unit count. Pure
         * re-use of numbers already computed on this page + engine IEEE-493
         * MTTR — no new model. ── */
        const criticality: CritRow[] = rows
            .filter((r) => r.mttrHrs != null)
            .map((r) => ({ ...r, crit: (r.fpPct / 100) * (r.mttrHrs ?? 0) * r.count }))
            .sort((a, b) => b.crit - a.crit);

        return { rows, total, catDonut, avgHealth, buckets, atRisk, replacement, criticality };
    }, [inputs.itLoad, req.workload.avgRackDensityKw, ageYears, condition]);

    const [busy, setBusy] = React.useState(false);
    const exportPdf = async () => {
        if (!model) return;
        setBusy(true);
        try {
            const narrativeMetrics = { avgHealthPct: model.avgHealth, atRiskCount: model.rows.filter((r) => r.fpPct >= 25).length };
            await generatePillarPDF({
                title: 'Asset Intelligence', layer: 'Asset Engine', project: req.overview.projectName || 'DC-OS Project',
                kpis: [
                    { label: 'Tracked Units', value: model.total.toLocaleString(), sub: 'engine equipment scaling' },
                    { label: 'Avg Health', value: `${model.avgHealth}/100`, sub: `age ${ageYears} yr` },
                    { label: 'Poor / Critical', value: (model.buckets.poor + model.buckets.critical).toLocaleString(), sub: 'plan replacement' },
                    { label: 'At Wear-Out Risk', value: model.atRisk.toLocaleString(), sub: '≥25% Weibull CDF' },
                ],
                config: [
                    ['IT Load', `${(inputs.itLoad / 1000).toFixed(1)} MW`],
                    ['Rack Density', `${req.workload.avgRackDensityKw} kW/rack`],
                    ['Fleet Age', `${ageYears} yr`], ['Condition', `${Math.round(condition * 100)}%`],
                ],
                sections: [
                    {
                        title: 'Class Health & Reliability', head: ['Class', 'Units', 'Health', 'Weibull CDF', 'MTBF', 'MTTR'],
                        rows: model.rows.map((r) => [r.label, r.count, `${r.health}/100`, `${r.fpPct}%`,
                            r.mtbfHrs ? `${(r.mtbfHrs / 1000).toFixed(0)}k h` : '—', r.mttrHrs ? `${r.mttrHrs} h` : '—']),
                    },
                    {
                        title: 'Fleet by Category', head: ['Category', 'Units'],
                        rows: model.catDonut.map((c) => [c.name, c.value]),
                    },
                ],
                callouts: (model.buckets.poor + model.buckets.critical) > 0
                    ? [{ title: 'Replacement planning', body: `${(model.buckets.poor + model.buckets.critical).toLocaleString()} units in Poor/Critical health at the modeled age — schedule replacement budget.`, tone: 'warn' as const }]
                    : [{ title: 'Fleet health', body: 'No units in Poor/Critical health at the modeled age.', tone: 'good' as const }],
                assessment: buildAssessment('assets', narrativeMetrics),
                actions: buildActions('assets', narrativeMetrics),
                summaryBand: [
                    { label: 'Units', value: model.total.toLocaleString() },
                    { label: 'Avg Health', value: `${model.avgHealth}/100` },
                    { label: 'Excellent', value: String(model.buckets.excellent) },
                    { label: 'Good', value: String(model.buckets.good) },
                    { label: 'Poor+Crit', value: String(model.buckets.poor + model.buckets.critical) },
                    { label: 'At Risk', value: model.atRisk.toLocaleString() },
                ],
                note: 'Fleet generated from engine equipment scaling; health = engine Weibull model at the set fleet age/condition. MTBF/MTTR = IEEE-493 component data.',
            } as StandardReport);
        } finally { setBusy(false); }
    };

    if (!model) return <div className="p-8 text-center text-sm text-slate-500">Engine loading…</div>;

    const ageVal: ComboValue<number> = { value: ageYears, isCustom: ![1, 3, 5, 8, 12].includes(ageYears) };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded border border-rz-2 bg-rz-elevated"><Activity className="h-6 w-6 text-rz-info" /></div>
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
                            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-rz-signal text-rz-base' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                        ))}
                    </div>
                    <button onClick={exportPdf} disabled={busy}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-rz-mint disabled:opacity-50">
                        <FileDown className="h-3.5 w-3.5" /> {busy ? 'Generating…' : 'Export PDF'}
                    </button>
                    <button onClick={() => setActiveTab('spares')} className="inline-flex items-center gap-1 rounded-lg bg-rz-signal px-3 py-1.5 text-xs font-semibold text-rz-base hover:bg-rz-signal/90">Spares <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'lifecycle' ? <AssetIntelDashboard /> : (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                            { label: 'Total Tracked Units', value: model.total.toLocaleString(), sub: 'engine equipment scaling', trace: 'asset.fleetUnits', tip: 'Fleet size from the engine equipment-scaling model — UPS modules, generators, cooling units, switchgear, batteries etc. sized from the IT load and redundancy config. Not a manually entered register: it re-scales when Requirements change, so treat it as the design fleet, not an as-built inventory.' },
                            { label: 'Avg Health', value: `${model.avgHealth}/100`, sub: `age ${ageYears} yr · condition ${Math.round(condition * 100)}%`, trace: 'asset.avgHealth', score: model.avgHealth, tip: 'Fleet-average health index (0-100) computed from the fleet-age and condition assumptions set in the header controls, degraded per class by Weibull ageing on IEEE-493 life data. Move the fleet-age slider to explore how health decays; below ~60 average, replacement planning should already be underway.' },
                            { label: 'Excellent / Good', value: (model.buckets.excellent + model.buckets.good).toLocaleString(), sub: `${model.buckets.excellent.toLocaleString()} excellent`, trace: 'asset.healthExcellentGood', tip: 'Units in the top two health bands — operating within normal parameters with no near-term action needed beyond routine PM. The share here shrinks as the fleet-age assumption grows; a healthy mature fleet keeps most units in these bands through mid-life refreshes.' },
                            { label: 'Fair', value: model.buckets.fair.toLocaleString(), sub: 'monitor', trace: 'asset.healthFair', tip: 'Units in the middle health band — serviceable but trending down. These are the condition-monitoring priority: catching them here (oil analysis, thermography, battery impedance) is far cheaper than letting them slide into the poor/critical bands.' },
                            { label: 'Poor / Critical', value: (model.buckets.poor + model.buckets.critical).toLocaleString(), sub: 'plan replacement', trace: 'asset.healthPoorCritical', tip: 'Units in the bottom health bands where failure risk is materially elevated — budget and schedule replacement or major overhaul. Cross-check against the Class Health table: if a critical class (e.g. UPS batteries) dominates this bucket, it is also a reliability/SPOF concern, not just a maintenance line.' },
                            { label: 'At Wear-Out Risk', value: model.atRisk.toLocaleString(), sub: '≥25% Weibull CDF', trace: 'asset.atRiskUnits', tip: 'Units whose Weibull cumulative failure probability is ≥25% at the assumed fleet age — statistically entering the wear-out zone of the bathtub curve. Basis: IEEE-493 class life parameters, not sensor data. Use it to size the replacement CAPEX wave and critical-spares stock before failures cluster.' },
                        ].map((k) => (
                            <div key={k.label} title={`${k.label}: ${k.value}${(k as {sub?: string}).sub ? " — " + (k as {sub?: string}).sub : ""}`} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label} {(k as { tip?: string }).tip && <InfoTip content={(k as { tip?: string }).tip!} />}</div>
                                {(k as { trace?: string }).trace ? (
                                    (k as { score?: number }).score != null ? (
                                        /* Workstream M — ScoreValue: gradient color + ƒx trace (fleet health, higher-better /100) */
                                        <ScoreValue value={(k as { score?: number }).score!} display={k.value}
                                            traceId={(k as { trace?: string }).trace!} className="text-lg" />
                                    ) : (
                                        <TraceValue traceId={(k as { trace?: string }).trace!}>
                                            <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                        </TraceValue>
                                    )
                                ) : (
                                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                )}
                                <div className="truncate text-[10px] text-slate-500">{k.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
                        <div className="space-y-4">
                            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Assets by Category</h2>
                                <div className="flex items-center gap-2">
                                    <div className="h-32 w-32 shrink-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={model.catDonut} dataKey="value" nameKey="name" innerRadius={30} outerRadius={50} paddingAngle={2}>
                                                    {model.catDonut.map((_, idx) => <Cell key={idx} fill={CAT_COLORS[idx]} />)}
                                                </Pie>
                                                <Tooltip contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
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
                            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Fleet Condition Assumption</h2>
                                <div className="flex items-center gap-2 text-[11px]">
                                    <span className="w-24 text-slate-600 dark:text-slate-300">Condition</span>
                                    <input type="range" min={30} max={100} step={5} value={Math.round(condition * 100)}
                                        onChange={(e) => setCondition(Number(e.target.value) / 100)} className="flex-1 accent-rz-mint" />
                                    <span className="w-10 text-right tabular-nums text-slate-500">{Math.round(condition * 100)}%</span>
                                </div>
                                <p className="mt-1 text-[9px] text-slate-400">Health = engine weighted (remaining-life + condition + duty). Adjust to match the real fleet condition survey.</p>
                            </div>
                        </div>

                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Class Health & Reliability <span className="text-[9px] normal-case text-slate-400">MTBF/MTTR = engine IEEE-493 component data · — = class not in the component table</span></h2>
                            <table className="w-full text-[11px]">
                                <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">Class</th><th className="text-right">Units</th><th className="text-right">Health</th><th className="text-right">Weibull CDF</th><th className="text-right">MTBF</th><th className="text-right">MTTR</th></tr></thead>
                                <tbody>
                                    {model.rows.map((r) => (
                                        <tr key={r.cls + r.label} className="border-b border-slate-100 dark:border-slate-800/60">
                                            <td className="py-1 text-slate-700 dark:text-slate-200">{r.label} <span className="text-[9px] text-slate-400">· {r.status}</span></td>
                                            <td className="text-right tabular-nums text-slate-500">{r.count.toLocaleString()}</td>
                                            <td className="text-right"><ScoreValue value={r.health} direction="higher" /></td>
                                            <td className="text-right tabular-nums text-slate-500">{r.fpPct}%</td>
                                            <td className="text-right tabular-nums text-slate-500">{r.mtbfHrs ? `${(r.mtbfHrs / 1000).toFixed(0)}k h` : '—'}</td>
                                            <td className="text-right tabular-nums text-slate-500">{r.mttrHrs ? `${r.mttrHrs} h` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Health Distribution by Class</h2>
                        <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={model.rows}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                    <XAxis dataKey="label" tick={{ fontSize: 8 }} interval={0} angle={-15} height={40} textAnchor="end" />
                                    <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
                                    <Tooltip contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                    <Bar dataKey="health" name="Health /100" radius={[3, 3, 0, 0]}>
                                        {model.rows.map((r) => <Cell key={r.cls + r.label} fill={r.health >= 70 ? '#34d399' : r.health >= 50 ? '#f59e0b' : '#fb7185'} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* ── Workstream H · Criticality ranking (screening FMEA) ── */}
                    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                Criticality Ranking <InfoTip content="Screening FMEA-style prioritization: score = Weibull failure probability (at the set fleet age) × MTTR hours × unit count. It ranks WHERE maintenance money buys the most risk reduction — a class with modest failure probability but long repair time and many units can outrank a rarer, fast-to-fix failure. Bands: top-3 = focus PM/spares budget here; mid = routine CBM; low = run standard PM. It is a screening rank, not a quantified FMECA — severity/detection are not modeled." />
                                <span className="ml-1 text-[9px] normal-case text-slate-400">score = failure prob × MTTR × units · screening</span>
                            </h2>
                            {model.criticality.length === 0 ? (
                                <p className="text-[11px] text-slate-500">No classes with engine MTTR data at this configuration.</p>
                            ) : (
                                <table className="w-full text-[11px]">
                                    <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">#</th><th className="text-left">Class</th><th className="text-right">Weibull CDF</th><th className="text-right">MTTR</th><th className="text-right">Units</th><th className="text-right">Score</th></tr></thead>
                                    <tbody>
                                        {model.criticality.map((r, i) => (
                                            <tr key={r.cls + r.label} className="border-b border-slate-100 dark:border-slate-800/60">
                                                <td className="py-1 tabular-nums text-slate-500">{i + 1}{i < 3 && <span className="ml-1 rounded bg-rose-500/15 px-1 py-0.5 text-[8px] font-bold text-rose-500">FOCUS</span>}</td>
                                                <td className="text-slate-700 dark:text-slate-200">{r.label}</td>
                                                <td className="text-right tabular-nums text-slate-500">{r.fpPct}%</td>
                                                <td className="text-right tabular-nums text-slate-500">{r.mttrHrs} h</td>
                                                <td className="text-right tabular-nums text-slate-500">{r.count.toLocaleString()}</td>
                                                {/* Workstream M — ScoreValue: criticality is lower-better, scaled to the top-ranked score (top rank reads red) */}
                                                <td className="text-right"><ScoreValue value={r.crit} display={r.crit.toFixed(1)} direction="lower" max={model.criticality[0]?.crit || 1} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            {model.criticality.some((r) => r.fpPct >= 25) && (
                                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[10.5px] text-slate-600 dark:text-slate-300">
                                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[8.5px] font-bold text-amber-600 dark:text-amber-400">≥25% CDF</span>
                                    <span className="min-w-0 flex-1">{model.criticality.filter((r) => r.fpPct >= 25).map((r) => r.label).join(', ')} — at wear-out risk; stock per newsvendor — see Spares Optimization.</span>
                                    <button onClick={() => setActiveTab('spares')} className="shrink-0 rounded-lg border border-amber-500/40 px-2 py-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:border-rz-mint">Spares Optimization →</button>
                                </div>
                            )}
                        </div>

                        {/* ── Workstream H · Replacement CAPEX Schedule (engine) ── */}
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                Replacement CAPEX Schedule <InfoTip content={`Depreciation / refresh-planning view from the engine lifecycle model (models.asset.replacementSchedule): each class's replacement interval × $/kW × IT kW over a ${model.replacement?.horizon ?? 15}-yr horizon, nominal dollars (no escalation/discounting). Cost-vs-risk balance: deferring a replacement past its interval saves CAPEX today but pushes the class into the Weibull wear-out zone (see the CDF column above) — cheap only until failures cluster. UPS Li-Ion is shown as an alternative to VRLA (longer interval, higher $/kW); it is excluded from the totals so nothing is double-counted.`} />
                                <span className="ml-1 text-[9px] normal-case text-slate-400">engine lifecycle model · nominal $</span>
                            </h2>
                            {!model.replacement ? (
                                <p className="text-[11px] text-slate-500">Engine lifecycle model unavailable — no replacement schedule to show.</p>
                            ) : (
                                <>
                                    <table className="w-full text-[11px]">
                                        <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">Component</th><th className="text-right">Interval</th><th className="text-right">Per Event</th><th className="text-right">Years</th><th className="text-right">{model.replacement.horizon}-yr Total</th></tr></thead>
                                        <tbody>
                                            {model.replacement.rows.map((r) => (
                                                <tr key={r.component} className={`border-b border-slate-100 dark:border-slate-800/60 ${r.alt ? 'opacity-60' : ''}`}>
                                                    <td className="py-1 text-slate-700 dark:text-slate-200">{r.label}{r.alt && <span className="ml-1 rounded bg-slate-500/10 px-1 py-0.5 text-[8px] text-slate-500">ALT — excl. totals</span>}</td>
                                                    <td className="text-right tabular-nums text-slate-500">{r.intervalYears} yr</td>
                                                    <td className="text-right tabular-nums text-slate-500">{fmtMoney(r.eventCostUsd)}</td>
                                                    <td className="text-right tabular-nums text-slate-500">{r.replacementYears.length ? r.replacementYears.join(', ') : '— beyond horizon'}</td>
                                                    <td className="text-right tabular-nums font-semibold text-slate-600 dark:text-slate-300">{fmtMoney(r.totalNominalUsd)}</td>
                                                </tr>
                                            ))}
                                            <tr><td className="py-1 font-semibold text-slate-700 dark:text-slate-200">Total (excl. ALT)</td><td colSpan={3} /><td className="text-right tabular-nums font-bold text-slate-900 dark:text-white">{fmtMoney(model.replacement.total)}</td></tr>
                                        </tbody>
                                    </table>
                                    <div className="mt-2 h-24">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={model.replacement.byYear} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
                                                <XAxis dataKey="year" tick={{ fontSize: 8 }} interval={1} />
                                                <YAxis tick={{ fontSize: 8 }} tickFormatter={(v) => `$${(Number(v) / 1e6).toFixed(1)}M`} width={40} />
                                                <Tooltip formatter={(v) => fmtMoney(Number(v))} contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                                <Bar dataKey="cost" name="Replacement CAPEX" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <p className="mt-1 text-[9px] text-slate-400">Nominal $, no escalation/discounting — a budgeting cadence, not a financed plan. A class past its interval isn&apos;t an automatic replace: if its Weibull CDF is still low, running it on condition monitoring is the cheaper option.</p>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2 text-[11px]">
                        {([['asset-lifecycle', 'Asset Lifecycle →'], ['cbm', 'CBM / DCIM →'], ['spares', 'Spares Optimization →'], ['maint', 'Maintenance →']] as const).map(([id, l]) => (
                            <button key={id} onClick={() => setActiveTab(id)} className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:border-rz-mint">{l}</button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
