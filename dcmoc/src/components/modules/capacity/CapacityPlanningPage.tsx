'use client';

/* ─── Capacity Planning Engine — page shell (Phase D) ────────────────────────
 * Reference sections: KPI row · IT-load forecast & growth chart · capacity
 * breakdown donut · utilization bars · system detail tabs (engine equipment
 * table) · recommendations row · rail (growth strategy + insights).
 * The FULL legacy phase planner (editor + Gantt + economics, engine-real) is
 * absorbed BY COMPOSITION as the "Phase Plan & Economics" tab — nothing lost.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { TraceValue } from '@/components/ui/TraceValue';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { useSimulationStore } from '@/store/simulation';
import { useRequirementsStore } from '@/store/requirements';
import CapacityDashboardMod from '@/components/modules/CapacityDashboard';
import {
    sanitizeCap, facilitySnapshot, overheadDonut, forecastSeries, utilization,
    equipmentTable, capRecommendations, capKeyInsights, type CapInputs, type UtilRow,
} from '@/state/adapters/capacity-adapter';
import { explainThresholdMetric, type ThresholdLeverSpec, type ThresholdMetricExplain } from '@/lib/decision-explain';
import { Layers, ChevronRight, Zap, Snowflake, Boxes, Network, FileDown } from 'lucide-react';
import { rzData } from '@/lib/rz-engine';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';

const DONUT_COLORS = ['#a78bfa', '#14b8a6', '#3b82f6', '#f59e0b', '#64748b'];

/* util-row key → value-trace id (KPI wrap; network row = assumption, no trace) */
const UTIL_TRACE: Record<string, string | undefined> = {
    power: 'cap.powerCapacityMva', cooling: 'cap.coolingCapacityMw', rack: 'cap.rackCapacity',
};

/* ─── Watch/At-Risk remediation (owner mandate: no naked bad status chips) ───
 * Each non-OK utilization row gets a computed reason + levers whose magnitudes
 * are SOLVED by explainThresholdMetric bisection over the page's OWN adapter
 * chain (sanitizeCap → facilitySnapshot → utilization) — never re-implemented.
 * Target = back to OK (<70% utilization). Lever targetTab tokens:
 * 'phases-local' = in-page Phase Plan tab · 'requirements' / 'sim' = shell tabs. */
const OK_UTIL_PCT = 70;
const UTIL_LEVERS: Record<string, ('margin' | 'itload' | 'space')[]> = {
    power: ['margin', 'itload'], cooling: ['margin', 'itload'],
    rack: ['space', 'itload'], space: ['space', 'itload'], network: ['margin', 'itload'],
};

function explainUtilRow(i: CapInputs, u: UtilRow): ThresholdMetricExplain {
    const pctAt = (mods: Partial<CapInputs>): number => {
        const ii = sanitizeCap({ ...i, ...mods });
        const s2 = facilitySnapshot(ii);
        return utilization(ii, s2.facilityMw).rows.find((r) => r.key === u.key)?.pct ?? 0;
    };
    /* Band-aware target: At Risk (≥85) solves for exiting the band (<85);
     * Watch solves back to OK (<70). NOTE: current power/cooling utilization is
     * structurally ≈ 1/(1+margin) in the adapter, so <70% is often unreachable
     * in-bounds — the honest quantified note renders instead. */
    const atRisk = u.pct >= 85;
    const target = atRisk ? 84 : OK_UTIL_PCT - 1;
    const targetLabel = atRisk ? '<85% keluar At Risk' : `<${OK_UTIL_PCT}% OK`;
    const specs: ThresholdLeverSpec[] = (UTIL_LEVERS[u.key] ?? []).map((kind): ThresholdLeverSpec => {
        if (kind === 'margin') return {
            lo: i.designMarginPct, hi: 30,
            metricAt: (m) => pctAt({ designMarginPct: m }),
            render: (x, achieved) => ({
                label: `Design margin ${i.designMarginPct}% → ${x.toFixed(0)}%`,
                detail: `Naikkan design margin ${i.designMarginPct}% → ${x.toFixed(1)}% agar utilisasi ${u.label} turun ke ${Math.round(achieved)}% (${targetLabel}) — parameter di Requirements → Business (design margin).`,
            }),
            unreachable: (atHi) => ({
                label: 'Design margin maks 30% tidak cukup',
                detail: `Bahkan margin 30% hanya menurunkan utilisasi ${u.label} ke ${Math.round(atHi)}% — kombinasikan dengan defer beban di phase plan.`,
            }),
            targetTab: 'requirements',
        };
        if (kind === 'space') return {
            lo: i.whiteFloorM2, hi: Math.min(200_000, i.whiteFloorM2 * 3),
            metricAt: (x) => pctAt({ whiteFloorM2: x }),
            render: (x, achieved) => ({
                label: `White space ${i.whiteFloorM2.toLocaleString()} → ${Math.ceil(x).toLocaleString()} m²`,
                detail: `Tambah white space ke ${Math.ceil(x).toLocaleString()} m² (+${Math.ceil(x - i.whiteFloorM2).toLocaleString()} m²) → utilisasi ${u.label} ${Math.round(achieved)}% (${targetLabel}) — parameter building size di Simulation setup.`,
            }),
            unreachable: (atHi) => ({
                label: 'White space ×3 tidak cukup',
                detail: `Bahkan ${(i.whiteFloorM2 * 3).toLocaleString()} m² hanya mencapai ${Math.round(atHi)}% — konstrain lain yang mengikat (cek binding constraint / rack density).`,
            }),
            targetTab: 'sim',
        };
        return {  // 'itload' — defer/shift phases
            lo: i.itLoadKw, hi: i.itLoadKw * 0.4,
            metricAt: (x) => pctAt({ itLoadKw: x }),
            render: (x, achieved) => ({
                label: `IT load ${(i.itLoadKw / 1000).toFixed(1)} → ${(x / 1000).toFixed(1)} MW`,
                detail: `ATAU tahan IT load saat ini di ≤${(x / 1000).toFixed(1)} MW (defer −${((i.itLoadKw - x) / 1000).toFixed(1)} MW ke fase berikut) → utilisasi ${u.label} ${Math.round(achieved)}% (${targetLabel}) — atur di Phase Plan & Economics.`,
            }),
            unreachable: (atHi) => ({
                label: 'Defer −60% beban tidak cukup',
                detail: `Bahkan IT load −60% hanya mencapai ${Math.round(atHi)}% — kapasitas desain perlu dinaikkan, bukan sekadar defer.`,
            }),
            targetTab: 'phases-local',
        };
    });
    return explainThresholdMetric({
        metricLabel: `Utilisasi ${u.label}`,
        value: u.pct,
        threshold: target,  // band-aware: At Risk solves to <85, Watch to <70 (matching the adapter bands)
        direction: 'atMost',
        fmtValue: (v) => `${Math.round(v)}%`,
        because: `${u.used.toLocaleString()}/${u.capacity.toLocaleString()} ${u.unit} terpakai (basis ${u.basis})`,
        levers: specs,
    });
}

export function CapacityPlanningPage() {
    const simInputs = useSimulationStore((s) => s.inputs);
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const req = useRequirementsStore();
    const [tab, setTab] = React.useState<'overview' | 'phases'>('overview');
    const [sysTab, setSysTab] = React.useState<'power' | 'cooling' | 'rack' | 'network'>('power');

    const i: CapInputs = React.useMemo(() => sanitizeCap({
        itLoadKw: simInputs.itLoad, tier: simInputs.tierLevel, coolingType: simInputs.coolingType,
        rackKw: req.workload.avgRackDensityKw, whiteFloorM2: simInputs.buildingSize, baseYear: simInputs.baseYear,
        marketType: 'wholesale', phases: simInputs.capacityPhases,
        designMarginPct: req.business.designMarginPct,
        growthMwByYear: [
            { label: 'Y0 (COD)', mw: simInputs.itLoad / 1000 },
            { label: 'Y1', mw: req.growth.itLoadMwByYear.y1 }, { label: 'Y2', mw: req.growth.itLoadMwByYear.y2 },
            { label: 'Y3', mw: req.growth.itLoadMwByYear.y3 }, { label: 'Y4', mw: req.growth.itLoadMwByYear.y4 },
            { label: 'Y5', mw: req.growth.itLoadMwByYear.y5 }, { label: 'Y10', mw: req.growth.itLoadMwByYear.y10 },
        ],
    }), [simInputs, req.workload.avgRackDensityKw, req.business.designMarginPct, req.growth.itLoadMwByYear]);

    const snap = React.useMemo(() => facilitySnapshot(i), [i]);
    const util = React.useMemo(() => utilization(i, snap.facilityMw), [i, snap.facilityMw]);
    const designPowerMw = (util.rows.find((r) => r.key === 'power')?.capacity ?? 0) * 0.9;
    const forecast = React.useMemo(() => forecastSeries(i, +designPowerMw.toFixed(0)), [i, designPowerMw]);
    const donut = React.useMemo(() => overheadDonut(i, snap.facilityMw), [i, snap.facilityMw]);
    const equip = React.useMemo(() => equipmentTable(i), [i]);
    const recs = React.useMemo(() => capRecommendations(i, util.rows, forecast), [i, util.rows, forecast]);
    const insights = React.useMemo(() => capKeyInsights(util.rows, forecast, i.baseYear), [util.rows, forecast, i.baseYear]);

    const peak = Math.max(...forecast.map((f) => f.forecastMw));
    const rackRow = util.rows.find((r) => r.key === 'rack');
    const [busy, setBusy] = React.useState(false);

    /* Watch/At-Risk chip → solved remediation panel (explainThresholdMetric over the adapter) */
    const [utilExplain, setUtilExplain] = React.useState<string | null>(null);
    const utilEx = React.useMemo(() => {
        if (!utilExplain) return null;
        const u = util.rows.find((r) => r.key === utilExplain);
        return u ? { row: u, ex: explainUtilRow(i, u) } : null;
    }, [utilExplain, util.rows, i]);
    const leverNav = (targetTab: string) => {
        if (targetTab === 'phases-local') setTab('phases');
        else setActiveTab(targetTab as never);
    };

    const exportPdf = async () => {
        setBusy(true);
        try {
            const firstUtil = util.rows[0];
            const narrativeMetrics = {
                strandedPct: (util.stranded?.fraction ?? 0) * 100,
                utilizationPct: Math.max(0, ...util.rows.map((u) => u.pct)),
            };
            await generatePillarPDF({
                title: 'Capacity Planning', layer: 'Capacity Planning Engine', project: '—',
                kpis: [
                    { label: 'IT Load (Total)', value: `${(i.itLoadKw / 1000).toFixed(1)} MW`, sub: 'current' },
                    { label: 'Peak Forecast', value: `${peak.toFixed(0)} MW`, sub: 'growth plan' },
                    { label: 'Total Facility Load', value: `${snap.facilityMw} MW`, sub: `PUE ${snap.pue} (${snap.source})` },
                    ...(firstUtil ? [{ label: firstUtil.label, value: `${firstUtil.capacity.toLocaleString()} ${firstUtil.unit}`, sub: `${firstUtil.pct}% utilized` }] : []),
                ],
                config: [
                    ['Tier', `Tier ${i.tier}`],
                    ['Cooling', i.coolingType],
                    ['Rack Density', `${i.rackKw} kW/rack`],
                    ['White Space', `${i.whiteFloorM2.toLocaleString()} m²`],
                    ['Design Margin', `${i.designMarginPct}%`],
                    ['Market Type', i.marketType],
                    ['Base Year', String(i.baseYear)],
                ],
                sections: [
                    { title: 'IT Load Forecast & Growth', head: ['Year', 'Committed (MW)', 'Forecast (MW)', 'Design (MW)'], rows: forecast.map((f) => [String(f.year), String(f.committedMw), String(f.forecastMw), String(f.designMw)]) },
                    { title: 'Capacity Utilization (Current)', head: ['System', 'Used', 'Capacity', 'Util %', 'Basis'], rows: util.rows.map((u) => [u.label, `${u.used.toLocaleString()} ${u.unit}`, `${u.capacity.toLocaleString()} ${u.unit}`, `${u.pct}%`, u.basis]) },
                ],
                callouts: [
                    ...insights.map((s, idx) => ({ title: `Key Insight ${idx + 1}`, body: s, tone: 'info' as const })),
                    ...(util.stranded?.isStranded ? [{
                        title: 'Stranded-Capacity Risk',
                        body: `${(util.stranded.fraction * 100).toFixed(0)}% idle at Y1 occupancy (Uptime 40% threshold).`,
                        tone: 'warn' as const,
                    }] : []),
                ],
                assessment: buildAssessment('capacity', narrativeMetrics),
                actions: [
                    ...buildActions('capacity', narrativeMetrics),
                    ...recs.map((r) => ({ priority: 'MEDIUM' as const, action: `${r.title}: ${r.body}` })),
                ],
                summaryBand: [
                    { label: 'IT Load', value: `${(i.itLoadKw / 1000).toFixed(1)} MW` },
                    { label: 'Peak', value: `${peak.toFixed(0)} MW` },
                    { label: 'Facility', value: `${snap.facilityMw} MW` },
                    { label: 'PUE', value: String(snap.pue) },
                    { label: 'Racks', value: String(rackRow?.used ?? '—') },
                    { label: 'Binding', value: util.binding ?? '—' },
                ],
                note: 'Engine-derived capacity analysis — committed = cumulative build phases, forecast = Requirements growth plan, design capacity incl. design margin. Network row is a screening assumption (no engine network model).',
            } as StandardReport);
        } finally { setBusy(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg"><Layers className="h-6 w-6 text-white" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Capacity Planning Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Calculate and optimize total capacity requirements across Power, Cooling, Space and Network from the IT load profile and growth strategy</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                        {(['overview', 'phases'] as const).map((t) => (
                            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 text-xs font-medium ${tab === t ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                {t === 'overview' ? 'Capacity Overview' : 'Phase Plan & Economics'}
                            </button>
                        ))}
                    </div>
                    <button onClick={exportPdf} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-violet-400"><FileDown className="h-3.5 w-3.5" />{busy ? '…' : 'Export'}</button>
                    <button onClick={() => setActiveTab('capex')} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">Next: CAPEX Engine <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'phases' ? (
                <CapacityDashboardMod />
            ) : (
                <div className="space-y-4">
                    {/* KPI row */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                            { label: 'IT Load (Total)', value: `${(i.itLoadKw / 1000).toFixed(1)} MW`, sub: 'current', trace: 'sim.itLoad' },
                            { label: 'Peak Forecast', value: `${peak.toFixed(0)} MW`, sub: 'growth plan', trace: 'cap.peakForecastMw' },
                            { label: 'Total Facility Load', value: `${snap.facilityMw} MW`, sub: `PUE ${snap.pue} (${snap.source})`, trace: 'arch.facilityMw' },
                            ...util.rows.slice(0, 3).map((u) => ({ label: u.label, value: `${u.capacity.toLocaleString()} ${u.unit}`, sub: `${u.pct}% utilized${u.basis === 'assumption' ? ' · assumption' : ''}`, trace: UTIL_TRACE[u.key] })),
                        ].map((k) => (
                            <div key={k.label} title={`${k.label}: ${k.value}${(k as {sub?: string}).sub ? " — " + (k as {sub?: string}).sub : ""}`} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</div>
                                {(k as { trace?: string }).trace ? (
                                    <TraceValue traceId={(k as { trace?: string }).trace!}>
                                        <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                    </TraceValue>
                                ) : (
                                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                )}
                                <div className="truncate text-[10px] text-slate-500">{k.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                        {/* forecast chart */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">IT Load Forecast & Growth</h2>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={forecast}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                        <XAxis dataKey="year" tick={{ fontSize: 9 }} />
                                        <YAxis tick={{ fontSize: 9 }} unit=" MW" />
                                        <Tooltip contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                        <Legend wrapperStyle={{ fontSize: 10 }} />
                                        <Area dataKey="committedMw" name="Committed (phases)" fill="#22d3ee" stroke="#22d3ee" fillOpacity={0.15} />
                                        <Line dataKey="forecastMw" name="Forecast (growth plan)" stroke="#a78bfa" strokeWidth={2} dot={{ r: 2 }} />
                                        <Line dataKey="designMw" name="Design Capacity" stroke="#f59e0b" strokeDasharray="6 4" dot={false} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="mt-1 text-[9px] text-slate-400">Committed = cumulative build phases · Forecast = Requirements growth plan · Design = power capacity incl. {i.designMarginPct}% margin.</p>
                        </div>

                        {/* breakdown + utilization */}
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Capacity Breakdown (Current)</h2>
                                <div className="flex items-center gap-2">
                                    <div className="h-32 w-32">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={donut} dataKey="mw" nameKey="name" innerRadius={30} outerRadius={50} paddingAngle={2}>
                                                    {donut.map((_, idx) => <Cell key={idx} fill={DONUT_COLORS[idx]} />)}
                                                </Pie>
                                                <Tooltip formatter={(v) => `${v} MW`} contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex-1 space-y-0.5">
                                        {donut.map((r, idx) => (
                                            <div key={r.name} className="flex items-center gap-1.5 text-[10px]">
                                                <span className="h-2 w-2 rounded-sm" style={{ background: DONUT_COLORS[idx] }} />
                                                <span className="text-slate-600 dark:text-slate-300">{r.name}</span>
                                                <span className="ml-auto tabular-nums text-slate-500">{r.pct}%</span>
                                            </div>
                                        ))}
                                        <p className="pt-0.5 text-[9px] text-slate-400">PUE {snap.pue} · overhead split = screening decomposition</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Capacity Utilization (Current)</h2>
                                <div className="space-y-1.5">
                                    {util.rows.map((u) => (
                                        <React.Fragment key={u.key}>
                                            <div className="flex items-center gap-2 text-[11px]">
                                                <span className="w-28 text-slate-600 dark:text-slate-300">{u.label}{u.basis === 'assumption' && <span className="ml-1 rounded bg-amber-500/15 px-1 text-[8px] text-amber-500">ASSUMPTION</span>}</span>
                                                <div className="h-2 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                                                    <div className={`h-2 rounded ${u.pct >= 85 ? 'bg-rose-500' : u.pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, u.pct)}%` }} />
                                                </div>
                                                <span className="w-24 text-right tabular-nums text-slate-500">{u.used.toLocaleString()}/{u.capacity.toLocaleString()} {u.unit}</span>
                                                <span className="w-9 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-300">{u.pct}%</span>
                                                {u.pct >= 70 ? (
                                                    <button onClick={() => setUtilExplain(utilExplain === u.key ? null : u.key)}
                                                        title="Klik untuk alasan + lever terukur (dihitung dari model kapasitas live)"
                                                        className={`w-14 shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${u.pct >= 85 ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/15 text-amber-500'} ${utilExplain === u.key ? 'ring-1 ring-amber-400' : ''}`}>
                                                        {u.pct >= 85 ? 'At Risk' : 'Watch'} ⓘ
                                                    </button>
                                                ) : <span className="w-14 shrink-0 rounded px-1 py-0.5 text-center text-[9px] font-semibold bg-emerald-500/15 text-emerald-500">OK</span>}
                                            </div>
                                            {utilEx && utilEx.row.key === u.key && (
                                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
                                                    <p className="text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">{utilEx.ex.reason}</p>
                                                    <div className="mt-1 space-y-1">
                                                        {utilEx.ex.levers.map((l, idx) => (
                                                            <div key={idx} className="flex items-start gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                                                                <span className={`shrink-0 rounded px-1 py-0.5 text-[8px] font-bold text-white ${l.priority === 'HIGH' ? 'bg-emerald-600' : 'bg-slate-500'}`}>{l.priority === 'HIGH' ? 'LEVER' : 'NOTE'}</span>
                                                                <span><b>{l.label}</b> — {l.detail}
                                                                    <button onClick={() => leverNav(l.targetTab)} className="ml-1 font-medium text-violet-500 hover:text-violet-400">
                                                                        {l.targetTab === 'phases-local' ? 'Buka Phase Plan →' : l.targetTab === 'sim' ? 'Buka Simulation →' : 'Buka Requirements →'}
                                                                    </button>
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <p className="mt-1 text-[8.5px] text-slate-400">Angka lever di-solve dari rantai adapter kapasitas live (bukan estimasi statis).</p>
                                                </div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                                {util.stranded?.isStranded && <p className="mt-1.5 text-[10px] text-amber-500">⚠ Stranded-capacity risk: {(util.stranded.fraction * 100).toFixed(0)}% idle at Y1 occupancy (Uptime 40% threshold).</p>}
                            </div>
                        </div>
                    </div>

                    {/* system detail tabs */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <div className="mb-2 flex gap-1">
                            {([['power', 'Power Capacity', Zap], ['cooling', 'Cooling Capacity', Snowflake], ['rack', 'Rack & Space', Boxes], ['network', 'Network', Network]] as const).map(([k, label, Icon]) => (
                                <button key={k} onClick={() => setSysTab(k)}
                                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${sysTab === k ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-violet-600/10'}`}>
                                    <Icon className="h-3 w-3" />{label}
                                </button>
                            ))}
                        </div>
                        {sysTab === 'power' && (
                            <div>
                                <table className="w-full text-xs">
                                    <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-400"><th className="py-1 text-left">Component</th><th className="text-right">Capacity</th><th className="text-right">Utilization</th><th className="text-right">Status</th></tr></thead>
                                    <tbody>
                                        {equip.rows.map((r) => (
                                            <tr key={r.label} className="border-b border-slate-100 dark:border-slate-800/60">
                                                <td className="py-1.5 text-slate-700 dark:text-slate-200">{r.label}</td>
                                                <td className="text-right tabular-nums text-slate-500">{r.config}</td>
                                                <td className="text-right tabular-nums text-slate-500">{r.utilPct}%</td>
                                                <td className="text-right"><span title={r.remediation ?? 'Utilisasi sehat (<70%)'} className={`cursor-help rounded px-1.5 py-0.5 text-[9px] font-semibold ${r.status === 'OK' ? 'bg-emerald-500/15 text-emerald-500' : r.status === 'Watch' ? 'bg-amber-500/15 text-amber-500' : 'bg-rose-500/15 text-rose-500'}`}>{r.status}{r.remediation ? ' ⓘ' : ''}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                        {equip.rows.some((r) => r.remediation) && (
                                            <div className="mt-2 space-y-1">
                                                {equip.rows.filter((r) => r.remediation).map((r) => (
                                                    <div key={r.label} className="flex items-start gap-2 text-[10.5px] text-slate-600 dark:text-slate-300">
                                                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8.5px] font-bold text-white ${r.status === 'At Risk' ? 'bg-rose-600' : 'bg-amber-600'}`}>{r.label}</span>
                                                        <span>{r.remediation}
                                                            {/* klik-navigasi ke parameter: beban/fase di Phase Plan, rating/unit basis di Requirements */}
                                                            <button onClick={() => setTab('phases')} className="ml-1.5 font-medium text-violet-500 hover:text-violet-400">Phase Plan →</button>
                                                            <button onClick={() => setActiveTab('requirements')} className="ml-1.5 font-medium text-violet-500 hover:text-violet-400">Requirements →</button>
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                <p className="mt-1 text-[9px] text-slate-400">{equip.source}</p>
                            </div>
                        )}
                        {sysTab === 'cooling' && (
                            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                                <p>Cooling load: <b>{(snap.facilityMw - i.itLoadKw / 1000).toFixed(1)} MW overhead + {(i.itLoadKw / 1000).toFixed(1)} MW heat rejection</b> at PUE {snap.pue} ({i.coolingType}).</p>
                                <p>Design capacity {util.rows[1].capacity} MW incl. {i.designMarginPct}% margin — utilization {util.rows[1].pct}%.</p>
                            </div>
                        )}
                        {sysTab === 'rack' && (
                            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                                <p>{rackRow?.used.toLocaleString()} racks @ {i.rackKw} kW — binding constraint: <b>{util.binding ?? '—'}</b> (engine bindingConstraint · footprint {rzFootprint()} m²/rack).</p>
                                <p>White space {i.whiteFloorM2.toLocaleString()} m² — space utilization {util.rows[3].pct}% (gross-up screening).</p>
                            </div>
                        )}
                        {sysTab === 'network' && (
                            <p className="text-xs text-slate-600 dark:text-slate-300">Spine-leaf estimate ~{Math.ceil((rackRow?.used ?? 0) / 16)} leaf switches · {util.rows[4].used}/{util.rows[4].capacity} Tbps. <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] text-amber-500">SCREENING ASSUMPTION — no engine network model; validate with network design.</span></p>
                        )}
                    </div>

                    {/* recommendations */}
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        {recs.map((r) => (
                            <div key={r.title} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">{r.title}</div>
                                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">{r.body}</p>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-2xl border border-violet-500/30 bg-violet-600/5 p-3">
                        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-500">Key Insights</h3>
                        <ul className="space-y-0.5">
                            {insights.map((s, idx) => <li key={idx} className="flex gap-1.5 text-[11px] text-slate-700 dark:text-slate-300"><span className="text-violet-500">✓</span>{s}</li>)}
                        </ul>
                        <button onClick={() => setActiveTab('requirements')} className="mt-1.5 text-[10px] font-medium text-violet-500 hover:text-violet-400">Edit Growth Plan (Requirements) →</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function rzFootprint(): number {
    return rzData()?.capacity?.rackFootprintM2 ?? 0.72;
}
