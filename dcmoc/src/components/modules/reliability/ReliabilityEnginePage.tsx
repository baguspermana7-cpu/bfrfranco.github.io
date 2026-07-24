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
import { Tooltip as InfoTip } from '@/components/ui/Tooltip';
import { useSimulationStore } from '@/store/simulation';
import { useRequirementsStore } from '@/store/requirements';
import { useOpsLog } from '@/store/opsLog';
import { useCapexStore } from '@/store/capex';
import { rzModels, rzData } from '@/lib/rz-engine';
import { fmtMoney } from '@/lib/format';
import { densityToEngineBucket } from '@/lib/requirementsMappings';
import { REDUNDANCY_KEY } from '@/state/registry';
import { ReliabilityDashboard } from '@/components/modules/ReliabilityDashboard';
import { TierDashboard } from '@/components/modules/DesignToolsDashboards';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';
import { ShieldCheck, ChevronRight, FileDown, ArrowUpRight } from 'lucide-react';
import { Explain } from '@/components/ui/Explain';
import { TraceValue } from '@/components/ui/TraceValue';
import { ScoreValue } from '@/components/ui/ScoreValue';
import { RedValue, type Diagnosis } from '@/components/ui/RedValue';
import { explainThresholdMetric, DecisionLever } from '@/lib/decision-explain';
/* single source of truth for the β-adjusted chain + nines formatters —
 * shared with the RAM Detail tab so both tabs show the SAME headline */
import {
    MIN_PER_YEAR, ninesOf, fmtAvail, fmtDowntime,
    buildSystems as buildSystemsShared, ccOverall as ccOverallShared,
    type SystemRow, type RelComponent,
} from '@/components/modules/reliability/availabilityChain';

interface ComponentRow { key: string; label: string; mtbf: number; mttr: number; lambdaMyr: number; count: number | null; availability: number; contribPct: number }
/* Workstream H — redundancy what-if row (engine kOutOfN at N / N+1 / 2N) */
interface WhatIfRow { cls: string; label: string; a: number; k: number; kAssumed: boolean; aN: number; aN1: number; aN2: number; unitCostUsd: number | null }

/* engine component class → equipScale fleet-count key */
const EQ_KEY: Record<string, string> = {
    ups: 'ups_modules', generator: 'generators', crac: 'cooling_units',
    pdu: 'pdus', switchgear: 'switchgear', chiller: 'chillers',
};

export function ReliabilityEnginePage() {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const inputs = useSimulationStore((s) => s.inputs);
    const country = useSimulationStore((s) => s.selectedCountry);
    const req = useRequirementsStore();
    const log = useOpsLog();
    const capexResults = useCapexStore((s) => s.results);
    const [tab, setTab] = React.useState<'overview' | 'ram' | 'tier'>('overview');
    const [busy, setBusy] = React.useState(false);

    const model = React.useMemo(() => {
        const eng = rzModels();
        const m = eng?.reliability;
        const d = rzData()?.reliability;
        if (!m?.availability || !d?.components) return null;
        const comps = d.components as Record<string, RelComponent>;
        const redKey = REDUNDANCY_KEY[inputs.powerRedundancy] ?? 'n1';
        const paths: number = d.redundancyPaths?.[redKey] ?? 2;

        /* shared β-adjusted chain (availabilityChain.ts) — same composition the
         * RAM Detail tab uses, parameterized for sensitivity re-runs */
        const buildSystems = (mttrFactor: number, p: number): SystemRow[] => buildSystemsShared(m, comps, mttrFactor, p);
        const ccOverall = (mttrFactor: number, p: number): number => ccOverallShared(m, comps, mttrFactor, p);

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
        /* recompute closure for the owner-mandate explain: re-runs the SAME
         * β-adjusted chain at a modified MTTR factor / path count — the lever
         * bisection below never re-implements or fabricates the model. */
        const recompute = (mods: { mttrFactor?: number; paths?: number }): number =>
            ccOverall(mods.mttrFactor ?? 1, mods.paths ?? paths);

        /* ── Workstream H · Redundancy What-If — SURFACES the existing engine
         * kOutOfN (exact Σ C(n,i)aⁱ(1−a)ⁿ⁻ⁱ): UPS + genset availability at
         * N / N+1 / 2N, where k = units required to carry the load. k is taken
         * from the engine equipScale fleet (screening — the installed count is
         * used as the required-unit count; fallback k=2, flagged). Per-unit
         * CAPEX share from the capex result gives the $ cost of each step. ── */
        let whatIf: WhatIfRow[] | null = null;
        if (typeof m.kOutOfN === 'function') {
            const mk = (cls: string, eqKey: string, costKey: string): WhatIfRow | null => {
                const c = comps[cls];
                if (!c) return null;
                const a = m.availability(c.mtbf, c.mttr);
                const fleet = eq?.[eqKey];
                const k = Math.max(1, fleet ?? 2);
                const catCost = capexResults?.costs?.[costKey];
                return {
                    cls, label: c.label ?? cls, a, k, kAssumed: fleet == null,
                    aN: m.kOutOfN(a, k, k), aN1: m.kOutOfN(a, k, k + 1), aN2: m.kOutOfN(a, k, 2 * k),
                    unitCostUsd: catCost != null && fleet ? catCost / fleet : null,
                };
            };
            const rows = [mk('ups', 'ups_modules', 'ups'), mk('generator', 'generators', 'generator')].filter((r): r is WhatIfRow => r != null);
            whatIf = rows.length ? rows : null;
        }

        /* ── Workstream H · Chain-derived SPOF — any series element of the
         * composed chain with a single path at this config, with its downtime
         * contribution (derived from the SAME chain rows rendered above). ── */
        const chainSpof = systems
            .filter((sy) => !sy.redundant)
            .map((sy) => ({ label: sy.label, chain: sy.chain, dtMin: (1 - sy.availability) * MIN_PER_YEAR }));

        /* ── Workstream H · Monte-Carlo availability band — 200 deterministic
         * re-runs of the SAME β-adjusted chain with each component's MTBF/MTTR
         * jittered ±20% via a seeded LCG (no Math.random — reproducible).
         * Screening: uniform jitter is a data-uncertainty band, not a fitted
         * distribution. ── */
        let mc: { p10: number; p50: number; p90: number } | null = null;
        try {
            let s = 42;
            const rnd = () => ((s = (s * 1664525 + 1013904223) | 0) >>> 0) / 4294967296;
            const runs: number[] = [];
            for (let i = 0; i < 200; i++) {
                const jit: Record<string, RelComponent> = {};
                for (const [k, c] of Object.entries(comps)) jit[k] = { ...c, mtbf: c.mtbf * (0.8 + 0.4 * rnd()), mttr: c.mttr * (0.8 + 0.4 * rnd()) };
                runs.push(ccOverallShared(m, jit, 1, paths));
            }
            runs.sort((a, b) => a - b);
            mc = { p10: runs[19], p50: runs[99], p90: runs[179] };
        } catch { /* chain jitter failed — band hidden, base model unaffected */ }

        return { systems, overall, tierTargetFrac, downtimeMin, budgetMin, mtbfAll, mttrAvg, spof, score, paths, comps, componentRows, sensitivity, hasFleet: !!eq, recompute, whatIf, chainSpof, mc };
    }, [inputs.powerRedundancy, inputs.tierLevel, inputs.itLoad, req.workload.avgRackDensityKw, capexResults]);

    /* ── Owner-mandate explain: availability below tier target ───────────────
     * (1) computed reason: nines gap + biggest downtime contributors from the
     * live composed chains; (2) measured levers: redundancy +1 path (computed
     * directly) and MTTR cut (solved by bisection) on the SAME β-adjusted
     * model via the memo's recompute closure; (3) click → parameter tab. */
    const availExplain = React.useMemo(() => {
        if (!model || model.overall >= model.tierTargetFrac) return null;
        const exactNines = (a: number): number => -Math.log10(1 - Math.min(a, 1 - 1e-12));
        const gapNines = exactNines(model.tierTargetFrac) - exactNines(model.overall);
        const contributors = [...model.systems]
            .map((s) => ({ label: s.label, dtMin: (1 - s.availability) * MIN_PER_YEAR }))
            .sort((a, b) => b.dtMin - a.dtMin);
        const topTxt = contributors.slice(0, 2).map((c) => `${c.label} ${fmtDowntime(c.dtMin)}`).join(', ');

        const base = explainThresholdMetric({
            metricLabel: 'Composed availability',
            value: model.overall,
            threshold: model.tierTargetFrac,
            direction: 'atLeast',
            fmtValue: fmtAvail,
            because: `gap ${gapNines.toFixed(2)} nines — downtime ${fmtDowntime(model.downtimeMin)} vs Tier ${inputs.tierLevel} budget ${fmtDowntime(model.budgetMin)}; largest downtime contributors: ${topTxt}`,
            levers: [
                {
                    lo: 0, hi: 0.9,
                    metricAt: (x) => model.recompute({ mttrFactor: 1 - x }),
                    render: (x, achieved) => ({
                        label: `MTTR −${(x * 100).toFixed(0)}%`,
                        detail: `Cut average MTTR ${model.mttrAvg} h → ${(model.mttrAvg * (1 - x)).toFixed(1)} h (comprehensive contract + on-site spares + 24/7 response): availability rises to ${fmtAvail(achieved)} ≥ target — computed by bisection on this page's β-adjusted chain.`,
                    }),
                    unreachable: (atHi) => ({
                        label: 'MTTR −90% not enough',
                        detail: `Even MTTR −90% only gives ${fmtAvail(atHi)} < target ${fmtAvail(model.tierTargetFrac)} — combine with redundancy: +1 path & MTTR −50% gives ${fmtAvail(model.recompute({ paths: model.paths + 1, mttrFactor: 0.5 }))} (computed).`,
                    }),
                    targetTab: 'maint',
                },
            ],
        });

        /* discrete redundancy lever — computed directly on the same chain */
        const aPlus = model.recompute({ paths: model.paths + 1 });
        const dtPlus = (1 - aPlus) * MIN_PER_YEAR;
        const nGain = exactNines(aPlus) - exactNines(model.overall);
        const reaches = aPlus >= model.tierTargetFrac;
        const pathsLever: DecisionLever = {
            label: `Paths ${model.paths} → ${model.paths + 1}`,
            detail: `Raise power redundancy from ${inputs.powerRedundancy} (+1 path on the power chain): availability ${fmtAvail(model.overall)} → ${fmtAvail(aPlus)} (+${nGain.toFixed(2)} nines, downtime −${fmtDowntime(Math.max(0, model.downtimeMin - dtPlus))}) ${reaches ? '— MEETS the tier target' : `— still below target ${fmtAvail(model.tierTargetFrac)}`} — computed from the same chain.`,
            targetTab: 'sim',
            priority: reaches ? 'HIGH' : 'MED',
        };

        return { reason: base.reason, levers: [pathsLever, ...base.levers], gapNines };
    }, [model, inputs.tierLevel, inputs.powerRedundancy]);

    /* SPOF remediation — short measured fix per row, from the live model. */
    const spofRemedy = React.useCallback((s: string): { fix: string; targetTab: 'sim' } | null => {
        if (!model) return null;
        if (s.startsWith('Utility intake')) {
            const swMttr = model.comps['switchgear']?.mttr;
            return {
                fix: `Dual utility feed + ATS (2N intake) removes the pre-ATS SPOF — single-feed exposure: switchgear MTTR ${swMttr ?? '—'} h per event (IEEE-493 data in this model).`,
                targetTab: 'sim',
            };
        }
        const a2 = model.recompute({ paths: 2 });
        return {
            fix: `Raise redundancy to ≥ N+1 (2 paths): composed availability ${fmtAvail(model.overall)} → ${fmtAvail(a2)} — computed from the same model chain.`,
            targetTab: 'sim',
        };
    }, [model]);

    if (!model) return <div className="p-8 text-center text-sm text-slate-500">Engine loading…</div>;
    const failures = log.alarms.filter((a) => a.status !== 'Cleared');
    const meetsTier = model.overall >= model.tierTargetFrac;

    /* ── Owner-mandate red-value diagnostic (shared RedValue modal) ──────────
     * The composed-availability VALUE itself becomes clickable when below the
     * tier target — same computed reason + measured levers as the remediation
     * panel (availExplain), so the modal can never disagree with the page. */
    const availDiag: Diagnosis | null = !meetsTier && availExplain ? {
        title: 'Composed Availability',
        reason: availExplain.reason,
        actual: fmtAvail(model.overall),
        threshold: `${fmtAvail(model.tierTargetFrac)} (Tier ${inputs.tierLevel})`,
        gap: `+${fmtDowntime(Math.max(0, model.downtimeMin - model.budgetMin))}/yr over the ${fmtDowntime(model.budgetMin)} budget (−${availExplain.gapNines.toFixed(2)} nines)`,
        levers: availExplain.levers.map((lv) => ({ label: lv.label, detail: lv.detail, tab: lv.targetTab })),
        tab: 'reliability',
        note: 'Levers computed on this page\'s own β=5% common-cause-adjusted chain (direct re-run / bisection) — identical numbers to the remediation panel below, no separate estimate.',
    } : null;

    /* status vs tier unavailability budget (not a flat 0.9999) */
    const statusOf = (a: number): 'meets' | 'within' | 'below' =>
        a >= model.tierTargetFrac ? 'meets' : (1 - a) <= 10 * (1 - model.tierTargetFrac) ? 'within' : 'below';
    const STATUS_CHIP: Record<'meets' | 'within' | 'below', { cls: string; label: string }> = {
        meets: { cls: 'bg-rz-data/15 text-rz-data', label: 'Meets target' },
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
                    <div className="flex h-11 w-11 items-center justify-center rounded bg-rz-elevated border border-rz-2"><ShieldCheck className="h-6 w-6 text-rz-data" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reliability Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Availability chains composed engine-real from IEEE-493 component MTBF/MTTR at the current redundancy</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                        {([['overview', 'Availability & SPOF'], ['ram', 'RAM Detail'], ['tier', 'Tier Classification']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-rz-mint text-rz-base' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                        ))}
                    </div>
                    <button onClick={onExport} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-rz-mint disabled:opacity-50"><FileDown className="h-3.5 w-3.5" /> {busy ? 'Exporting…' : 'Export PDF'}</button>
                    <button onClick={() => setActiveTab('risk')} className="inline-flex items-center gap-1 rounded-lg bg-rz-mint px-3 py-1.5 text-xs font-semibold text-rz-base hover:bg-rz-mint/80">Risk Analysis <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'ram' ? <ReliabilityDashboard /> : tab === 'tier' ? <TierDashboard /> : (
                <div className="space-y-4">
                    {/* #328 — on-page guidance beside the availability status (same
                      * deterministic rubric as the PDF; renders live). */}
                    {(() => {
                        const met = { availPct: model.overall * 100, targetPct: model.tierTargetFrac * 100, spofCount: model.spof.length };
                        const assess = buildAssessment('reliability', met);
                        const acts = buildActions('reliability', met);
                        return (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900/50 p-3">
                                <div className="flex flex-wrap items-start gap-3">
                                    <div className="shrink-0 rounded-lg px-3 py-1.5 text-center text-white" style={{ background: assess.color }}>
                                        <div className="text-[9px] uppercase opacity-80">Status</div>
                                        <div className="text-sm font-bold">{assess.label}</div>
                                    </div>
                                    <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{assess.narrative}</p>
                                </div>
                                <div className="mt-2 space-y-1">
                                    {acts.slice(0, 3).map((a, i) => (
                                        <div key={i} className="flex items-start gap-2 text-[10.5px] text-slate-600 dark:text-slate-300">
                                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8.5px] font-bold ${a.priority === 'HIGH' ? 'bg-red-600 text-white' : a.priority === 'MEDIUM' ? 'bg-amber-600 text-white' : 'bg-rz-data text-rz-base'}`}>{a.priority}</span>
                                            <span>{a.action}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                    {/* Owner-mandate explain: availability below tier target →
                      * computed reason + measured levers (click → parameter tab). */}
                    {!meetsTier && availExplain && (
                        <div className="rounded-xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/20 p-4">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Below Tier {inputs.tierLevel} target</span>
                                <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-rose-600 dark:text-rose-400">gap {availExplain.gapNines.toFixed(2)} nines</span>
                            </div>
                            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{availExplain.reason}</p>
                            <div className="mt-2">
                                <div className="mb-1.5 text-[10px] font-semibold uppercase text-slate-500">Measured levers — computed on this page's model chain</div>
                                <div className="space-y-1.5">
                                    {availExplain.levers.map((lv, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setActiveTab(lv.targetTab as Parameters<typeof setActiveTab>[0])}
                                            title={`Open the "${lv.targetTab}" tab to change this parameter`}
                                            className="group flex w-full items-start gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 p-2 text-left transition-colors hover:border-rz-mint dark:hover:border-rz-mint"
                                        >
                                            <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold text-white ${lv.priority === 'HIGH' ? 'bg-red-600' : 'bg-amber-600'}`}>{lv.priority ?? 'MED'}</span>
                                            <span className="mt-0.5 shrink-0 whitespace-nowrap rounded bg-rz-mint/15 px-1.5 py-0.5 text-[10px] font-bold text-rz-mint">{lv.label}</span>
                                            <span className="flex-1 text-[11px] leading-snug text-slate-600 dark:text-slate-400">{lv.detail}</span>
                                            <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-rz-mint" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                            { label: 'Composed Availability', value: fmtAvail(model.overall), sub: meetsTier ? `meets Tier ${inputs.tierLevel} target` : `BELOW Tier ${inputs.tierLevel} target`, chip: `${ninesOf(model.overall)} nines`, title: 'β=5% common-cause screening (assumption)', trace: 'rel.composedAvailability', explain: 'availability', red: availDiag, score: model.overall * 100, tip: 'System availability composed across the documented power and cooling chains, including a β=5% common-cause screening factor (redundant paths are never perfectly independent). Compared against the Uptime tier target — the chip shows the result in "nines". Redundancy depth (N+1 → 2N) and MTTR are the strongest levers; see the remediation panel when below target.' },
                            { label: 'Tier Target', value: fmtAvail(model.tierTargetFrac), sub: `Tier ${inputs.tierLevel} (Uptime)`, trace: 'rel.tierTarget', explain: 'tier-class', tip: 'The Uptime Institute availability expectation for the selected tier (e.g. Tier III ≈ 99.982%, Tier IV ≈ 99.995%). It is a design expectation, not a certified guarantee — the engine flags the gap whenever the composed model falls below it. Change the tier in Requirements to move this target.' },
                            { label: 'Downtime (unplanned)', value: fmtDowntime(model.downtimeMin), sub: `budget ${fmtDowntime(model.budgetMin)}`, trace: 'rel.downtimeMin', tip: 'Expected unplanned downtime per year = (1 − composed availability) × 525,600 min, shown against the tier downtime budget. Exceeding the budget usually traces to a SPOF or a long-MTTR component — the SPOF list and sensitivity table below identify which. Planned maintenance windows are excluded.' },
                            { label: 'MTBF (series composite)', value: `≈ ${(model.mtbfAll / 1000).toFixed(0)}k h`, sub: '1/Σλ serial — excl. redundancy', explain: 'mtbf', trace: 'rel.mtbfComposite' },
                            { label: 'MTTR (avg)', value: `${model.mttrAvg} h`, sub: 'component average', explain: 'mttr', trace: 'rel.mttrAvg' },
                            { label: 'Reliability Score', value: `${model.score}/100`, sub: 'documented composite', trace: 'rel.score', score: model.score, tip: 'Documented composite score (0-100) combining availability vs. the tier target, SPOF count and redundancy depth. A screening indicator for comparing design configurations against each other — not a certified rating. Removing SPOFs and adding path redundancy move it the most.' },
                        ].map((k) => (
                            <div key={k.label} title={(k as { title?: string }).title} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label} {(k as { tip?: string }).tip && <InfoTip content={(k as { tip?: string }).tip!} />}{(k as { explain?: string }).explain && <Explain k={(k as { explain?: string }).explain!} />}</div>
                                <div className="flex items-baseline gap-1.5">
                                    {(k as { trace?: string }).trace ? (
                                        (k as { red?: Diagnosis | null }).red ? (
                                            <TraceValue traceId={(k as { trace?: string }).trace!}>
                                                <RedValue className="text-base font-bold tabular-nums" diagnosis={(k as { red?: Diagnosis | null }).red!}>{k.value}</RedValue>
                                            </TraceValue>
                                        ) : (k as { score?: number }).score != null ? (
                                            /* Workstream M — ScoreValue: gradient color + ƒx trace on the non-red (green) path */
                                            <ScoreValue value={(k as { score?: number }).score!} display={k.value} direction="higher"
                                                traceId={(k as { trace?: string }).trace!} className="text-base" />
                                        ) : (
                                            <TraceValue traceId={(k as { trace?: string }).trace!}>
                                                <div className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                            </TraceValue>
                                        )
                                    ) : (
                                        <div className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                    )}
                                    {(k as { chip?: string }).chip && <span className="rounded bg-rz-mint/15 px-1 py-0.5 text-[8.5px] font-semibold text-rz-mint">{(k as { chip?: string }).chip}</span>}
                                </div>
                                <div className={`truncate text-[10px] ${k.sub.startsWith('BELOW') ? 'text-rose-500 font-semibold' : 'text-slate-500'}`}>{k.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
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
                                        <div className="h-2 flex-1 rounded bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded bg-rz-mint/70" style={{ width: '100%' }} /></div>
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
                            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">SPOF — Single Points of Failure ({model.spof.length})</h2>
                                {model.spof.length === 0 ? (
                                    <p className="text-[11px] text-rz-data">✓ No single-path components at {inputs.powerRedundancy} — fully redundant paths.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {model.spof.map((s) => {
                                            const r = spofRemedy(s);
                                            return (
                                                <li key={s} className="text-[11px]">
                                                    <div className="flex gap-1.5 text-rose-500">⛔ {s}</div>
                                                    {r && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveTab(r.targetTab)}
                                                            title={`Open the "${r.targetTab}" tab to change redundancy`}
                                                            className="group mt-0.5 flex w-full items-start gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 text-left text-[10px] text-slate-600 dark:text-slate-300 transition-colors hover:border-rz-mint dark:hover:border-rz-mint"
                                                        >
                                                            <span className="mt-0.5 shrink-0 rounded bg-amber-600 px-1 py-0.5 text-[8px] font-bold text-white">FIX</span>
                                                            <span className="flex-1 leading-snug">{r.fix}</span>
                                                            <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-400 group-hover:text-rz-mint" />
                                                        </button>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                {/* Workstream H — chain-derived single-path elements */}
                                <div className="mt-2 border-t border-slate-100 dark:border-slate-800/60 pt-2">
                                    <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                        Chain-derived single-path elements <InfoTip content="Series elements of the composed availability chain above that run on a SINGLE path at the current redundancy config — derived directly from the same chain rows, so this list can never disagree with the table. Each entry shows its unplanned-downtime contribution (1 − availability) × minutes/yr. Remediation is always the same lever: add a parallel path (raise redundancy) or cut that element's MTTR." />
                                    </h3>
                                    {model.chainSpof.length === 0 ? (
                                        <p className="text-[10.5px] text-slate-500">None — every series element of the chain has ≥2 paths at {inputs.powerRedundancy}.</p>
                                    ) : (
                                        <ul className="space-y-1">
                                            {model.chainSpof.map((cs) => (
                                                <li key={cs.label} className="flex items-center gap-2 text-[10.5px]">
                                                    <span className="rounded bg-rose-500/15 px-1 py-0.5 text-[8px] font-bold text-rose-500">1 PATH</span>
                                                    <span className="text-slate-700 dark:text-slate-200">{cs.label}</span>
                                                    <span className="text-[9px] text-slate-400">{cs.chain}</span>
                                                    <span className="ml-auto tabular-nums text-slate-500">{fmtDowntime(cs.dtMin)}</span>
                                                    <button onClick={() => setActiveTab('sim')} className="shrink-0 rounded border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-500 hover:border-rz-mint">+1 path →</button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
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
                            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
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
                                <button onClick={() => setActiveTab('ops')} className="mt-1.5 text-[10px] font-medium text-rz-mint">Open Operations log →</button>
                            </div>
                        </div>
                    </div>

                    {/* ── Workstream H · Redundancy What-If (engine kOutOfN) + MC band ── */}
                    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                Redundancy What-If <InfoTip content="Exact k-of-n redundancy math from the engine (kOutOfN: system up if ≥k of n identical units are up, at each unit's IEEE-493 availability) — compared at N (no spare unit), N+1 (one spare) and 2N (full duplication) for the UPS and generator systems. k = units required to carry the load, taken from the engine equipment-scaling fleet (screening assumption). Cost side: each added unit ≈ the per-unit CAPEX share of that category from the CAPEX result. Read it as technology-vs-economics: if the availability gain from N+1 → 2N is a rounding error, the simpler (cheaper) N+1 wins — spend the difference on MTTR instead." />
                                <span className="ml-1 text-[9px] normal-case text-slate-400">engine kOutOfN · k = required units (equipScale) · screening</span>
                            </h2>
                            {!model.whatIf ? (
                                <p className="text-[11px] text-slate-500">Engine kOutOfN model unavailable — no redundancy comparison to show.</p>
                            ) : (
                                <>
                                    <table className="w-full text-[11px]">
                                        <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">System</th><th className="text-right">k req.</th><th className="text-right">N (k of k)</th><th className="text-right">N+1</th><th className="text-right">2N</th><th className="text-right">+1 unit ≈</th></tr></thead>
                                        <tbody>
                                            {model.whatIf.map((w) => (
                                                <tr key={w.cls} className="border-b border-slate-100 dark:border-slate-800/60">
                                                    <td className="py-1 text-slate-700 dark:text-slate-200">{w.label}</td>
                                                    <td className="text-right tabular-nums text-slate-500">{w.k}{w.kAssumed && <span className="ml-0.5 text-[8px] text-amber-500">assumed</span>}</td>
                                                    <td className="text-right tabular-nums text-slate-600 dark:text-slate-300">{fmtAvail(w.aN)}</td>
                                                    <td className="text-right tabular-nums text-slate-600 dark:text-slate-300">{fmtAvail(w.aN1)}</td>
                                                    <td className="text-right tabular-nums text-slate-600 dark:text-slate-300">{fmtAvail(w.aN2)}</td>
                                                    <td className="text-right tabular-nums text-slate-500">{w.unitCostUsd != null ? fmtMoney(w.unitCostUsd) : 'n/a — qualitative'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="mt-2 space-y-1">
                                        {model.whatIf.map((w) => {
                                            const dN1 = (ninesOf(w.aN1) - ninesOf(w.aN));
                                            const dt1 = ((1 - w.aN) - (1 - w.aN1)) * MIN_PER_YEAR;
                                            const dt2 = ((1 - w.aN1) - (1 - w.aN2)) * MIN_PER_YEAR;
                                            const extra2N = Math.max(0, w.k - 1);
                                            const cost2N = w.unitCostUsd != null ? w.unitCostUsd * extra2N : null;
                                            const negligible = dt2 < 0.5; // <30 s/yr gained
                                            return (
                                                <p key={w.cls} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-2 py-1.5 text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
                                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{w.label}:</span>{' '}
                                                    N → N+1 buys ~{dN1 >= 1 ? `+${dN1} nine${dN1 > 1 ? 's' : ''}` : `−${fmtDowntime(dt1)}`} for {w.unitCostUsd != null ? `~${fmtMoney(w.unitCostUsd)}` : 'one extra unit'} — usually the best $/nine on the board.{' '}
                                                    N+1 → 2N ({extra2N} more unit{extra2N === 1 ? '' : 's'}{cost2N != null ? `, ~${fmtMoney(cost2N)}` : ''}) gains only −{fmtDowntime(dt2)}{negligible
                                                        ? ' — negligible at this unit availability: the simpler N+1 option wins unless a common-cause / maintenance-isolation requirement (not modeled here) mandates 2N.'
                                                        : ` — worth it only if a downtime-minute costs you more than ${cost2N != null ? `~${fmtMoney(cost2N / 10 / Math.max(dt2, 0.01))}/min (unit cost amortized 10 yr ÷ minutes saved)` : 'the amortized extra-unit cost per minute saved'}.`}
                                                </p>
                                            );
                                        })}
                                        <p className="text-[9px] text-slate-400">Screening: independent identical units, no common-cause inside the k-of-n block (the headline availability above DOES carry the β=5% factor), per-unit cost = CAPEX category ÷ installed fleet. Not a substitute for a maintenance-isolation (concurrent maintainability) study.</p>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                Availability Uncertainty Band <InfoTip content="200 deterministic re-runs of the SAME β-adjusted availability chain with every component's MTBF and MTTR jittered ±20% (seeded LCG — reproducible, no randomness between renders). P10/P50/P90 show how sensitive the headline availability is to the IEEE-493 data uncertainty: a narrow band means the design verdict is robust to the input data; a P10 that falls below the tier target means the 'meets target' conclusion depends on optimistic component data — harden MTTR (contracts, spares) before trusting it. Screening band, not a fitted distribution." />
                                <span className="ml-1 text-[9px] normal-case text-slate-400">±20% MTBF/MTTR jitter · seeded · screening</span>
                            </h2>
                            {!model.mc ? (
                                <p className="text-[11px] text-slate-500">Band unavailable.</p>
                            ) : (
                                <>
                                    <div className="grid grid-cols-3 gap-2">
                                        {([['P10 (pessimistic)', model.mc.p10], ['P50 (median)', model.mc.p50], ['P90 (optimistic)', model.mc.p90]] as const).map(([lbl, v]) => (
                                            <div key={lbl} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-center">
                                                <div className="text-[9px] uppercase text-slate-500">{lbl}</div>
                                                <div className={`text-[13px] font-bold tabular-nums ${v >= model.tierTargetFrac ? 'text-rz-data' : 'text-rose-500'}`}>{fmtAvail(v)}</div>
                                                <div className="text-[9px] tabular-nums text-slate-500">{fmtDowntime((1 - v) * MIN_PER_YEAR)}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="mt-2 text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
                                        {model.mc.p10 >= model.tierTargetFrac
                                            ? `Robust: even the pessimistic P10 stays above the Tier ${inputs.tierLevel} target — the verdict does not hinge on optimistic component data.`
                                            : model.mc.p50 >= model.tierTargetFrac
                                                ? `Fragile: the median meets the Tier ${inputs.tierLevel} target but the pessimistic P10 breaches it — the conclusion depends on the component data being right. Cheapest hardening is MTTR (response contracts + on-site spares), not more redundancy.`
                                                : `Below target across the band — this is a design gap, not data noise. See the remediation levers above.`}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* per-component RAM table (IEEE-493 + equipScale fleet) */}
                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
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
                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
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
