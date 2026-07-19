'use client';

/* ─── Reliability Engine — page (Phase L, tab 'reliability') ─────────────────
 * Heavily engine-real: per-system availability chains composed from
 * DATA.reliability.components MTBF/MTTR via models.reliability
 * (availability / series / parallel per the redundancy paths), tier targets,
 * SPOF list (single-path components at the current config), MTBF composite.
 * Headline availability applies a β=5% common-cause screening factor
 * (assumption) so redundant chains never display a fake 100.0000%.
 * Failure events reuse the opsLog store (single log, no duplicate ledger).
 * Old ReliabilityDashboard (RAM detail) survives as the "RAM Detail" tab;
 * TierDashboard is folded in as the "Tier Classification" tab.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useSimulationStore } from '@/store/simulation';
import { useRequirementsStore } from '@/store/requirements';
import { useOpsLog } from '@/store/opsLog';
import { rzModels, rzData } from '@/lib/rz-engine';
import { densityToEngineBucket } from '@/lib/requirementsMappings';
import { REDUNDANCY_KEY } from '@/state/registry';
import { ReliabilityDashboard } from '@/components/modules/ReliabilityDashboard';
import { TierDashboard } from '@/components/modules/DesignToolsDashboards';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';
import { ShieldCheck, ChevronRight, FileDown } from 'lucide-react';
import { Explain } from '@/components/ui/Explain';

interface SystemRow { label: string; availability: number; chain: string; redundant: boolean }
interface ComponentRow { key: string; label: string; mtbf: number; mttr: number; lambdaMyr: number; count: number | null; availability: number; contribPct: number }

/* β-factor common-cause screening share (assumption, IEC 61508-style screening) */
const CC_BETA = 0.05;
const MIN_PER_YEAR = 525960;

/* engine component class → equipScale fleet-count key */
const EQ_KEY: Record<string, string> = {
    ups: 'ups_modules', generator: 'generators', crac: 'cooling_units',
    pdu: 'pdus', switchgear: 'switchgear', chiller: 'chillers',
};

/* nines-aware availability formatter — never rounds up to a fake 100% */
const ninesOf = (a: number): number => a >= 1 - 1e-9 ? 9 : Math.min(9, Math.floor(-Math.log10(1 - a)));
const fmtAvail = (a: number): string => {
    if (a >= 1 - 1e-9) return '>99.9999999%';
    const nines = ninesOf(a);
    const s = (a * 100).toFixed(Math.max(4, nines + 1));
    if (s.startsWith('100')) return '>99.9999999%';
    return `${s}%`;
};
const fmtDowntime = (min: number): string => min < 1 ? `~${Math.round(min * 60)} s/yr` : `${min.toFixed(1)} min/yr`;

export function ReliabilityEnginePage() {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const inputs = useSimulationStore((s) => s.inputs);
    const country = useSimulationStore((s) => s.selectedCountry);
    const req = useRequirementsStore();
    const log = useOpsLog();
    const [tab, setTab] = React.useState<'overview' | 'ram' | 'tier'>('overview');
    const [busy, setBusy] = React.useState(false);

    const model = React.useMemo(() => {
        const eng = rzModels();
        const m = eng?.reliability;
        const d = rzData()?.reliability;
        if (!m?.availability || !d?.components) return null;
        const comps = d.components as Record<string, { mtbf: number; mttr: number; label: string }>;
        const redKey = REDUNDANCY_KEY[inputs.powerRedundancy] ?? 'n1';
        const paths: number = d.redundancyPaths?.[redKey] ?? 2;
        const par = (av: number, n: number) => m.parallelAvailability ? m.parallelAvailability(av, n) : 1 - Math.pow(1 - av, n);
        const ser = (arr: number[]) => m.seriesAvailability ? m.seriesAvailability(arr) : arr.reduce((s, x) => s * x, 1);

        /* documented per-system chains, parameterized for sensitivity re-runs */
        const buildSystems = (mttrFactor: number, p: number): SystemRow[] => {
            const a = (cls: string) => comps[cls] ? m.availability(comps[cls].mtbf, comps[cls].mttr * mttrFactor) : 0.999;
            return [
                { label: 'Power Distribution', availability: par(ser([a('switchgear'), a('pdu')]), p), chain: `(swgr·pdu) × ${p} paths`, redundant: p > 1 },
                { label: 'UPS & Battery', availability: par(a('ups'), p), chain: `UPS × ${p} paths`, redundant: p > 1 },
                { label: 'Generators', availability: par(a('generator'), Math.max(2, p)), chain: `gen × ${Math.max(2, p)} (N+1 floor)`, redundant: true },
                { label: 'Cooling (Chillers)', availability: par(a('chiller'), 2), chain: 'chiller N+1 (2 paths)', redundant: true },
                { label: 'CRAC / AHU', availability: par(a('crac'), 2), chain: 'CRAC N+1', redundant: true },
            ];
        };
        /* β=5% common-cause screening: blend the parallel-composed overall with
         * the single-path series overall (a common-cause event defeats redundancy) */
        const ccOverall = (mttrFactor: number, p: number): number => {
            const a = (cls: string) => comps[cls] ? m.availability(comps[cls].mtbf, comps[cls].mttr * mttrFactor) : 0.999;
            const sys = buildSystems(mttrFactor, p);
            const overallPar = ser(sys.map((s) => s.availability));
            const overallSingle = ser([ser([a('switchgear'), a('pdu')]), a('ups'), a('generator'), a('chiller'), a('crac')]);
            return overallPar * (1 - CC_BETA) + overallSingle * CC_BETA;
        };

        const systems = buildSystems(1, paths);
        const overall = ccOverall(1, paths); // headline: common-cause-adjusted
        const tierTargetFrac: number = (d.tierAvailability ?? {})[inputs.tierLevel] ?? 0.99982;
        const downtimeMin = (1 - overall) * MIN_PER_YEAR;

        /* MTBF series composite: λ_sys = Σ(1/mtbf_c) over the full serial chain
         * of the 6 component classes → 1/λ_sys ≈ 29k h. Sanity: composite < min
         * component MTBF (100k h), as expected for a series of 6. Redundant paths
         * improve availability, NOT this series-composite screening figure. */
        const rates = Object.values(comps).map((c) => 1 / c.mtbf);
        const mtbfAll = Math.round(1 / rates.reduce((s, x) => s + x, 0));
        const mttrAvg = +(Object.values(comps).reduce((s, c) => s + c.mttr, 0) / Object.values(comps).length).toFixed(1);

        /* SPOF: single-path components at this config */
        const spof = paths <= 1 ? ['MV switchgear bus', 'UPS system', 'PDU distribution'] : (redKey === 'n1' ? ['Utility intake (single feed pre-ATS)'] : []);

        /* score composite (documented): availability-margin 40 + redundancy 30 + maintainability 15 + spof 15 */
        const availMargin = Math.min(1, Math.max(0, (overall - tierTargetFrac) / (1 - tierTargetFrac) * 0.5 + 0.5));
        const score = Math.round(40 * availMargin + 30 * Math.min(1, paths / 2) + 15 * (mttrAvg <= 12 ? 1 : 12 / mttrAvg) + 15 * (spof.length === 0 ? 1 : Math.max(0, 1 - spof.length * 0.3)));

        /* per-component RAM rows with equipScale fleet counts */
        let eq: Record<string, number> | null = null;
        try {
            eq = eng?.commissioning?.equipScale
                ? eng.commissioning.equipScale({ itLoad: inputs.itLoad, rackDensity: densityToEngineBucket(req.workload.avgRackDensityKw) })
                : null;
        } catch { /* engine not loaded — hide counts */ }
        const totalUnavail = Object.values(comps).reduce((s, c) => s + (1 - m.availability(c.mtbf, c.mttr)), 0);
        const componentRows: ComponentRow[] = Object.entries(comps).map(([k, c]) => {
            const av = m.availability(c.mtbf, c.mttr);
            return {
                key: k, label: c.label ?? k, mtbf: c.mtbf, mttr: c.mttr,
                lambdaMyr: 1e6 / c.mtbf,
                count: eq && EQ_KEY[k] ? (eq[EQ_KEY[k]] ?? null) : null,
                availability: av,
                contribPct: totalUnavail > 0 ? (1 - av) / totalUnavail * 100 : 0,
            };
        });

        /* sensitivity re-runs vs the common-cause-adjusted base */
        const sensMttr = ccOverall(1.5, paths);
        const sensPaths = ccOverall(1, Math.max(1, paths - 1));
        const sensitivity = [
            { label: 'All MTTR × 1.5', availability: sensMttr, dAvail: sensMttr - overall, dDowntimeMin: (1 - sensMttr) * MIN_PER_YEAR - downtimeMin },
            { label: `Redundancy paths − 1 (→ ${Math.max(1, paths - 1)})`, availability: sensPaths, dAvail: sensPaths - overall, dDowntimeMin: (1 - sensPaths) * MIN_PER_YEAR - downtimeMin },
        ];

        const budgetMin = (1 - tierTargetFrac) * MIN_PER_YEAR;
        return { systems, overall, tierTargetFrac, downtimeMin, budgetMin, mtbfAll, mttrAvg, spof, score, paths, comps, componentRows, sensitivity, hasFleet: !!eq };
    }, [inputs.powerRedundancy, inputs.tierLevel, inputs.itLoad, req.workload.avgRackDensityKw]);

    if (!model) return <div className="p-8 text-center text-sm text-slate-500">Engine loading…</div>;
    const failures = log.alarms.filter((a) => a.status !== 'Cleared');
    const meetsTier = model.overall >= model.tierTargetFrac;

    /* status vs tier unavailability budget (not a flat 0.9999) */
    const statusOf = (a: number): 'meets' | 'within' | 'below' =>
        a >= model.tierTargetFrac ? 'meets' : (1 - a) <= 10 * (1 - model.tierTargetFrac) ? 'within' : 'below';
    const STATUS_CHIP: Record<'meets' | 'within' | 'below', { cls: string; label: string }> = {
        meets: { cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', label: 'Meets target' },
        within: { cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', label: 'Within 10× budget' },
        below: { cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', label: 'Below' },
    };

    const onExport = async () => {
        setBusy(true);
        try {
            const relMetrics = { availPct: model.overall * 100, targetPct: model.tierTargetFrac * 100, spofCount: model.spof.length };
            await generatePillarPDF({
                title: 'Reliability Engine', layer: 'Layer 10 · Reliability', project: country?.name ?? '—',
                kpis: [
                    { label: 'Composed Availability', value: fmtAvail(model.overall), sub: `${ninesOf(model.overall)} nines · β=5% common-cause screening` },
                    { label: 'Downtime (unplanned)', value: fmtDowntime(model.downtimeMin), sub: `budget ${fmtDowntime(model.budgetMin)} (Tier ${inputs.tierLevel})` },
                    { label: 'MTBF (series composite)', value: `≈ ${(model.mtbfAll / 1000).toFixed(0)}k h`, sub: '1/Σλ over serial systems — excludes redundancy' },
                    { label: 'MTTR (avg)', value: `${model.mttrAvg} h`, sub: 'component average' },
                    { label: 'Reliability Score', value: `${model.score}/100`, sub: 'documented composite' },
                    { label: 'Tier Target', value: fmtAvail(model.tierTargetFrac), sub: `Tier ${inputs.tierLevel} (Uptime)` },
                ],
                config: [
                    ['Redundancy', inputs.powerRedundancy],
                    ['Paths', `${model.paths}`],
                    ['Tier', `Tier ${inputs.tierLevel}`],
                    ['IT Load', `${inputs.itLoad.toLocaleString()} kW`],
                    ['β common-cause', '5% (assumption)'],
                ],
                sections: [
                    {
                        title: 'Availability by System', head: ['System', 'Chain', 'Availability', 'Status'],
                        rows: model.systems.map((s) => [s.label, s.chain, fmtAvail(s.availability), STATUS_CHIP[statusOf(s.availability)].label]),
                    },
                    {
                        title: 'Component RAM (IEEE-493 data + equipScale fleet)', head: ['Component', 'MTBF (h)', 'MTTR (h)', 'λ (f/Myr)', 'Fleet', 'Availability', 'Unavail. share'],
                        rows: model.componentRows.map((c) => [c.label, c.mtbf.toLocaleString(), c.mttr, c.lambdaMyr.toFixed(1), c.count ?? '—', fmtAvail(c.availability), `${c.contribPct.toFixed(0)}%`]),
                    },
                    {
                        title: 'Sensitivity (vs base, common-cause-adjusted)', head: ['Scenario', 'Availability', 'Δ availability', 'Δ downtime'],
                        rows: model.sensitivity.map((s) => [s.label, fmtAvail(s.availability), `${(s.dAvail * 100).toFixed(4)} pp`, `+${fmtDowntime(Math.abs(s.dDowntimeMin))}`]),
                    },
                ],
                callouts: (() => {
                    const below = model.systems.filter((s) => statusOf(s.availability) === 'below');
                    return below.length
                        ? below.map((s) => ({ title: `${s.label} below tier budget`, body: `${fmtAvail(s.availability)} vs Tier ${inputs.tierLevel} target ${fmtAvail(model.tierTargetFrac)} — review ${s.chain}.`, tone: 'warn' as const }))
                        : [{ title: 'All systems within tier budget', body: `Every composed system meets or is within 10× of the Tier ${inputs.tierLevel} unavailability budget at ${inputs.powerRedundancy}.`, tone: 'good' as const }];
                })(),
                assessment: buildAssessment('reliability', relMetrics),
                actions: buildActions('reliability', relMetrics),
                summaryBand: [
                    { label: 'Availability', value: fmtAvail(model.overall) },
                    { label: 'Target', value: fmtAvail(model.tierTargetFrac) },
                    { label: 'Downtime /yr', value: fmtDowntime(model.downtimeMin) },
                    { label: 'MTTR (avg)', value: `${model.mttrAvg} h` },
                    { label: 'SPOF', value: String(model.spof.length) },
                    { label: 'Score', value: `${model.score}/100` },
                ],
                note: 'IEEE-493 component-MTBF/MTTR screening composed at the current redundancy, with a β=5% common-cause screening factor (assumption). Planned maintenance windows are excluded from the tier availability basis (Tier III/IV = concurrently maintainable); figures are unplanned-outage screening only — not a certified reliability study.',
            } as StandardReport);
        } finally { setBusy(false); }
    };

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
                        {([['overview', 'Availability & SPOF'], ['ram', 'RAM Detail'], ['tier', 'Tier Classification']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                        ))}
                    </div>
                    <button onClick={onExport} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-violet-400 disabled:opacity-50"><FileDown className="h-3.5 w-3.5" /> {busy ? 'Exporting…' : 'Export PDF'}</button>
                    <button onClick={() => setActiveTab('risk')} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">Risk Analysis <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'ram' ? <ReliabilityDashboard /> : tab === 'tier' ? <TierDashboard /> : (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                            { label: 'Composed Availability', value: fmtAvail(model.overall), sub: meetsTier ? `meets Tier ${inputs.tierLevel} target` : `BELOW Tier ${inputs.tierLevel} target`, chip: `${ninesOf(model.overall)} nines`, title: 'β=5% common-cause screening (assumption)' },
                            { label: 'Tier Target', value: fmtAvail(model.tierTargetFrac), sub: `Tier ${inputs.tierLevel} (Uptime)` },
                            { label: 'Downtime (unplanned)', value: fmtDowntime(model.downtimeMin), sub: `budget ${fmtDowntime(model.budgetMin)}` },
                            { label: 'MTBF (series composite)', value: `≈ ${(model.mtbfAll / 1000).toFixed(0)}k h`, sub: '1/Σλ serial — excl. redundancy', explain: 'mtbf' },
                            { label: 'MTTR (avg)', value: `${model.mttrAvg} h`, sub: 'component average', explain: 'mttr' },
                            { label: 'Reliability Score', value: `${model.score}/100`, sub: 'documented composite' },
                        ].map((k) => (
                            <div key={k.label} title={(k as { title?: string }).title} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label} {(k as { explain?: string }).explain && <Explain k={(k as { explain?: string }).explain!} />}</div>
                                <div className="flex items-baseline gap-1.5">
                                    <div className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                    {(k as { chip?: string }).chip && <span className="rounded bg-violet-500/15 px-1 py-0.5 text-[8.5px] font-semibold text-violet-600 dark:text-violet-400">{(k as { chip?: string }).chip}</span>}
                                </div>
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
                                    {model.systems.map((s) => {
                                        const st = STATUS_CHIP[statusOf(s.availability)];
                                        return (
                                            <tr key={s.label} className="border-b border-slate-100 dark:border-slate-800/60">
                                                <td className="py-1 text-slate-700 dark:text-slate-200">{s.label}</td>
                                                <td className="text-[9px] text-slate-400">{s.chain}</td>
                                                <td className="text-right tabular-nums text-slate-600 dark:text-slate-300">{fmtAvail(s.availability)}</td>
                                                <td className="text-right"><span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${st.cls}`}>{st.label}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {/* downtime-budget waterfall */}
                            <div className="mt-3 border-t border-slate-100 dark:border-slate-800/60 pt-2">
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Downtime vs Tier {inputs.tierLevel} budget <span className="text-[9px] normal-case text-slate-400">min/yr, unplanned</span></h3>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2" title={`Tier ${inputs.tierLevel} budget · ${fmtDowntime(model.budgetMin)}`}>
                                        <span className="w-32 shrink-0 truncate text-[9px] text-slate-500">Tier budget</span>
                                        <div className="h-2 flex-1 rounded bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded bg-violet-500/70" style={{ width: '100%' }} /></div>
                                        <span className="w-16 shrink-0 text-right text-[9px] tabular-nums text-slate-500">{fmtDowntime(model.budgetMin)}</span>
                                    </div>
                                    {model.systems.map((s) => {
                                        const dt = (1 - s.availability) * MIN_PER_YEAR;
                                        const w = Math.min(100, model.budgetMin > 0 ? dt / model.budgetMin * 100 : 0);
                                        return (
                                            <div key={s.label} className="flex items-center gap-2" title={`${s.label} · ${fmtDowntime(dt)}`}>
                                                <span className="w-32 shrink-0 truncate text-[9px] text-slate-500">{s.label}</span>
                                                <div className="h-2 flex-1 rounded bg-slate-100 dark:bg-slate-800"><div className={`h-2 rounded ${dt > model.budgetMin ? 'bg-rose-500' : 'bg-cyan-500'}`} style={{ width: `${w}%` }} /></div>
                                                <span className="w-16 shrink-0 text-right text-[9px] tabular-nums text-slate-500">{fmtDowntime(dt)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
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
                                <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sensitivity <span className="text-[9px] normal-case text-slate-400">vs base (β-adjusted)</span></h2>
                                <table className="w-full text-[11px]">
                                    <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">Scenario</th><th className="text-right">Availability</th><th className="text-right">Δ downtime</th></tr></thead>
                                    <tbody>
                                        {model.sensitivity.map((s) => (
                                            <tr key={s.label} className="border-b border-slate-100 dark:border-slate-800/60">
                                                <td className="py-1 text-slate-700 dark:text-slate-200">{s.label}</td>
                                                <td className="text-right tabular-nums text-slate-600 dark:text-slate-300">{fmtAvail(s.availability)}</td>
                                                <td className="text-right tabular-nums text-amber-600 dark:text-amber-400">+{fmtDowntime(Math.abs(s.dDowntimeMin))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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

                    {/* per-component RAM table (IEEE-493 + equipScale fleet) */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Component RAM <span className="text-[9px] normal-case text-slate-400">IEEE-493 data{model.hasFleet ? ' · fleet counts from engine equipScale' : ''}</span></h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-[11px]">
                                <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">Component</th><th className="text-right">MTBF (h)</th><th className="text-right">MTTR (h)</th><th className="text-right">λ (f/Myr)</th><th className="text-right">Fleet</th><th className="text-right">Availability</th><th className="text-right">Unavail. share</th></tr></thead>
                                <tbody>
                                    {model.componentRows.map((c) => (
                                        <tr key={c.key} className="border-b border-slate-100 dark:border-slate-800/60">
                                            <td className="py-1 text-slate-700 dark:text-slate-200">{c.label}</td>
                                            <td className="text-right tabular-nums text-slate-600 dark:text-slate-300">{c.mtbf.toLocaleString()}</td>
                                            <td className="text-right tabular-nums text-slate-600 dark:text-slate-300">{c.mttr}</td>
                                            <td className="text-right tabular-nums text-slate-600 dark:text-slate-300">{c.lambdaMyr.toFixed(1)}</td>
                                            <td className="text-right tabular-nums text-slate-600 dark:text-slate-300">{c.count ?? '—'}</td>
                                            <td className="text-right tabular-nums text-slate-600 dark:text-slate-300">{fmtAvail(c.availability)}</td>
                                            <td className="text-right">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span className="hidden h-1.5 w-14 rounded bg-slate-100 dark:bg-slate-800 sm:inline-block"><span className="block h-1.5 rounded bg-rose-400" style={{ width: `${Math.min(100, c.contribPct)}%` }} /></span>
                                                    <span className="tabular-nums text-slate-600 dark:text-slate-300">{c.contribPct.toFixed(0)}%</span>
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                                    <Tooltip formatter={(v) => `${v}k h`} contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                    <Bar dataKey="mtbfK" fill="#fb7185" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* honesty note — maintenance basis */}
                    <p className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-[10px] text-slate-500 dark:text-slate-400">
                        Planned maintenance windows are excluded from the tier availability basis (Tier III/IV = concurrently maintainable); figures above are unplanned-outage screening only. β=5% common-cause factor is a screening assumption, not measured plant data.
                    </p>
                </div>
            )}
        </div>
    );
}
