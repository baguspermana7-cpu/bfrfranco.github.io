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
import { useRequirementsStore } from '@/store/requirements';
import { densityToEngineBucket } from '@/lib/requirementsMappings';
import { useCxTracking, cxPlanMode, checklistDerivedCompletion, type CxCheckValue } from '@/store/cxTracking';
import { rzModels, rzData } from '@/lib/rz-engine';
import { CX_CHECKLIST, resolveProc, type ReadinessKey, type ChecklistItem } from '@/lib/cx-procedures';
import { CommissioningDashboard } from '@/components/modules/NewEngineDashboards';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';
import { TraceValue } from '@/components/ui/TraceValue';
import { CheckCircle2, ChevronRight, ChevronDown, FileDown, ListChecks } from 'lucide-react';

const WITNESS_STYLE: Record<string, { label: string; cls: string }> = {
    H: { label: 'HOLD', cls: 'bg-amber-500/15 text-amber-500' },
    W: { label: 'WITNESS', cls: 'bg-rz-mint/15 text-rz-mint' },
    R: { label: 'REVIEW', cls: 'bg-slate-500/15 text-slate-400' },
};

/** Items applicable at the current cooling type (DLC items are liquid/rdhx-only).
 *  When the live equipScale record is passed, system groups with ZERO installed
 *  units are dropped entirely — the checklist only shows systems that exist in
 *  the current config (derived from equipment, not a static list). */
function itemsFor(key: ReadinessKey, coolingType: string, equip?: Record<string, number>): { systemKey: string; items: ChecklistItem[] }[] {
    const liquid = coolingType === 'liquid' || coolingType === 'rdhx';
    return CX_CHECKLIST[key]
        .filter((g) => g.systemKey === 'general' || !equip || (equip[g.systemKey] ?? 0) > 0)
        .map((g) => ({ systemKey: g.systemKey, items: g.items.filter((i) => !i.liquidOnly || liquid) }))
        .filter((g) => g.items.length > 0);
}

const LEVEL_COLORS = ['#64748b', '#22d3ee', '#3b82f6', '#7DDDB4', '#f59e0b', '#f43f5e', '#00FF88'];

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
    /* HIGH-2 (visual audit) — rack density MUST reach the engine. Without it,
     * equipScale defaulted to the 'standard' 6 kW bucket → RACKS = ceil(2500/6)
     * = 417 while the whole app (Requirements 60 kW/rack) shows 42. */
    const rackKw = useRequirementsStore((s) => s.workload.avgRackDensityKw);
    const t = useCxTracking();
    const [tab, setTab] = React.useState<'overview' | 'checklist' | 'cost'>('overview');
    const [openLevel, setOpenLevel] = React.useState<ReadinessKey | null>('L3');
    const [openItem, setOpenItem] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);

    const model = React.useMemo(() => {
        const m = rzModels()?.commissioning;
        if (!m?.programRich) return null;
        const rich = m.programRich({ itLoadKw: inputs.itLoad, coolingType: inputs.coolingType, powerRedundancy: inputs.powerRedundancy, countryId: country?.id, rackDensity: densityToEngineBucket(rackKw) });
        const eq = rich.equip as Record<string, number>;
        /* Per-readiness-key checklist stats — items filtered to systems that
         * actually EXIST at the current config (live equipScale counts). */
        const KEYS: ReadinessKey[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'ist', 'sat', 'fat', 'punchlist'];
        const checklistStats: Record<string, { total: number; pass: number; fail: number; ticked: number; derived: number | null }> = {};
        KEYS.forEach((k) => {
            const items = itemsFor(k, inputs.coolingType, eq).flatMap((g) => g.items);
            const derived = checklistDerivedCompletion(t, k, items.length);
            let pass = 0, fail = 0;
            items.forEach((i) => {
                const v = t.checklist[`${k}:${i.id}`];
                if (v === 'pass') pass++; else if (v === 'fail') fail++;
            });
            checklistStats[k] = { total: items.length, pass, fail, ticked: pass + fail, derived };
        });
        // readiness from tracking (ENGINE readinessIndex — real linkage).
        // Checklist-derived completion WINS over the coarse slider per key.
        let readiness: { index: number; status: string; label: string } | null = null;
        const comp: Record<string, number> = {};
        Object.entries(t.completion).forEach(([k, v]) => { if (v != null) comp[k] = v; });
        KEYS.forEach((k) => { const d = checklistStats[k].derived; if (d != null) comp[k] = d; });
        try {
            if (m.readinessIndex && Object.keys(comp).length > 0) readiness = m.readinessIndex(comp);
        } catch { /* */ }
        const systems = Object.values(TESTS_PER).map((s) => {
            const count = eq[s.key] ?? 0;
            const tests = count * s.per;
            return { label: s.label, count, tests };
        }).filter((s) => s.count > 0);
        const testsTotal = t.testsTotalOverride ?? systems.reduce((s, x) => s + x.tests, 0);
        /* Tests KPI derives from checklist ticks once any exist. */
        const anyTicks = KEYS.some((k) => checklistStats[k].ticked > 0);
        const passTotal = anyTicks ? KEYS.reduce((s, k) => s + checklistStats[k].pass, 0) : t.testsPassed;
        const failTotal = anyTicks ? KEYS.reduce((s, k) => s + checklistStats[k].fail, 0) : t.testsFailed;
        return { rich, readiness, systems, testsTotal, checklistStats, anyTicks, passTotal, failTotal };
    }, [inputs, country, rackKw, t]);

    if (!model) return <div className="p-8 text-center text-sm text-slate-500">Engine loading…</div>;
    const { rich, readiness, systems, testsTotal, checklistStats, anyTicks, passTotal, failTotal } = model;
    const planMode = cxPlanMode(t);
    const overall = readiness ? readiness.index : 0;
    const openIssues = t.issues.filter((x) => x.open && x.kind === 'issue');
    const punch = t.issues.filter((x) => x.kind === 'punch' && x.open);
    /* DE1 (owner: "L1 itu apa kepanjangannya") — nama lengkap + penjelasan per
     * level; label render "L1 — Factory Witness & Verification" dan tooltip
     * menjelaskan isi level. Nama level di-ANCHOR ke engine
     * DATA.commissioning.labels (live); teks definisi = LOCAL MAP berlabel
     * (basis industri ASHRAE Guideline 0 / BCxA / NEBB — engine hanya
     * menyimpan label pendek, bukan teks definisi). */
    const engineLevelLabels: Record<string, string> = rzData()?.commissioning?.labels ?? {};
    const levelTip = (rk: { key: string; full: string; desc: string }) => {
        const el = engineLevelLabels[rk.key];
        return `${rk.full}${el ? ` · engine label: "${el}"` : ''}\n${rk.desc}\n[Definisi: local map (ASHRAE Gl.0 / BCxA basis) — nama level: engine DATA.commissioning.labels]`;
    };
    const READY_KEYS: { key: string; label: string; full: string; desc: string }[] = [
        { key: 'L1', label: 'L1 — Factory Witness', full: 'Level 1: Factory Witness & Verification', desc: 'Verifikasi & witness test di PABRIK sebelum kirim: inspeksi rakitan, relay/CT test, transformer test. Termasuk dokumentasi FAT per unit.' },
        { key: 'L2', label: 'L2 — Site Inspection', full: 'Level 2: Site Acceptance / Component Verification', desc: 'Inspeksi kedatangan di SITE: visual, kelengkapan, kabel & tekanan, penyimpanan benar — komponen siap dipasang.' },
        { key: 'L3', label: 'L3 — Startup / Pre-Functional', full: 'Level 3: System Startup & Pre-Functional', desc: 'Energize & startup per sistem: breaker, genset load bank, chiller startup, kontrol hidup — sistem menyala sesuai spesifikasi.' },
        { key: 'L4', label: 'L4 — Functional Performance', full: 'Level 4: Functional Performance Test', desc: 'Uji performa fungsi per subsistem: flow/air balance, VFD, kapasitas & respon kontrol pada beban riil.' },
        { key: 'L5', label: 'L5 — IST (Integrated)', full: 'Level 5: Integrated Systems Test', desc: 'Uji TERINTEGRASI seluruh fasilitas: skenario kegagalan (pull-the-plug, transfer genset/UPS, redundansi N+1/2N) sesuai target tier.' },
        { key: 'ist', label: 'IST scenarios', full: 'Integrated Systems Test scenarios', desc: 'Jumlah skenario IST yang lulus — skenario dari tier requirement (mis. utility fail, single-path loss).' },
        { key: 'sat', label: 'SAT — Site Acceptance', full: 'Site Acceptance Test', desc: 'Penerimaan akhir di site: review dokumen, training operator, closeout — serah terima operasional.' },
        { key: 'fat', label: 'FAT — Factory Acceptance', full: 'Factory Acceptance Test', desc: 'Uji penerimaan di pabrik (sebelum L1 witness): unit memenuhi spec kontrak sebelum pengiriman.' },
        { key: 'punchlist', label: 'Punchlist burndown', full: 'Punchlist burndown', desc: 'Penyelesaian daftar temuan (defect/incomplete) — harus turun ke nol atau ber-waiver sebelum handover.' },
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded border border-rz-2 bg-rz-elevated"><CheckCircle2 className="h-6 w-6 text-rz-info" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Commissioning Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Program plan engine-real (rich cx model) · progress user-tracked · readiness = engine readinessIndex</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                        {([['overview', 'Progress & Systems'], ['checklist', 'Cx Checklist'], ['cost', 'Program Cost & Risk']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-rz-signal text-rz-base' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                        ))}
                    </div>
                    <button onClick={async () => {
                        setBusy(true);
                        try {
                            const KEYS: { key: ReadinessKey; label: string }[] = [
                                { key: 'fat', label: 'Factory Acceptance' }, { key: 'L1', label: 'L1 Factory' }, { key: 'L2', label: 'L2 Component' },
                                { key: 'L3', label: 'L3 System' }, { key: 'L4', label: 'L4 Subsystem' }, { key: 'L5', label: 'L5 Integrated' },
                                { key: 'ist', label: 'IST scenarios' }, { key: 'sat', label: 'Site Acceptance' }, { key: 'punchlist', label: 'Punchlist' },
                            ];
                            const weights: Record<string, number> = rzData()?.commissioning?.weights ?? {};
                            const tickedRows: (string | number)[][] = [];
                            KEYS.forEach(({ key, label }) => {
                                itemsFor(key, inputs.coolingType, rich.equip as Record<string, number>).forEach((g) => g.items.forEach((i) => {
                                    const v = t.checklist[`${key}:${i.id}`];
                                    if (v) tickedRows.push([label, i.label, resolveProc(i.templateKey, i.params)?.witness ?? 'R', v.toUpperCase()]);
                                }));
                            });
                            const cxMetrics = { readinessPct: overall, testsFailed: failTotal, openIssues: openIssues.length };
                            await generatePillarPDF({
                                title: 'Commissioning Program', layer: 'Commissioning Engine', project: country?.name ?? 'DC-OS Project',
                                kpis: [
                                    { label: 'Readiness Index', value: readiness ? `${overall}%` : '—', sub: readiness?.status ?? 'no progress yet' },
                                    { label: 'Tests Passed', value: String(passTotal ?? '—'), sub: anyTicks ? 'from checklist' : 'manual' },
                                    { label: 'Tests Failed', value: String(failTotal ?? '—'), sub: anyTicks ? 'from checklist' : 'manual' },
                                    { label: 'Open Issues', value: String(openIssues.length), sub: `${punch.length} punch items` },
                                ],
                                config: [
                                    ['IT Load', `${(inputs.itLoad / 1000).toFixed(1)} MW`], ['Cooling', inputs.coolingType],
                                    ['Redundancy', inputs.powerRedundancy], ['Country', country?.name ?? '—'],
                                    ['Program Duration', `${rich.durationDays} d (~${rich.durationMonths} mo)`],
                                    ['IST Scenarios', `${rich.tierInfo.scenarios} · ${rich.tierInfo.istHrs}h`],
                                ],
                                sections: [
                                    {
                                        title: 'Readiness Levels', head: ['Level', 'Weight', 'Completion', 'Source'],
                                        rows: KEYS.map(({ key, label }) => {
                                            const st = checklistStats[key];
                                            const comp = st.derived != null ? st.derived : (t.completion[key] ?? null);
                                            return [label, weights[key] != null ? `${Math.round(weights[key] * 100)}%` : '—',
                                                comp == null ? '—' : `${Math.round(comp * 100)}%`,
                                                st.derived != null ? `checklist ${st.pass}/${st.total}` : (t.completion[key] != null ? 'slider' : '—')];
                                        }),
                                    },
                                    { title: 'Systems in Scope', head: ['System', 'Units', 'Tests (screening)'], rows: systems.map((s) => [s.label, s.count, s.tests]) },
                                    ...(tickedRows.length ? [{ title: 'Checklist Status', head: ['Level', 'Activity', 'Witness', 'Status'], rows: tickedRows }] : []),
                                    { title: 'Issues & Punch', head: ['Severity', 'Item', 'Kind', 'Status'], rows: t.issues.map((x) => [x.sev, x.title, x.kind, x.open ? 'OPEN' : 'closed']) },
                                ],
                                assessment: buildAssessment('commissioning', cxMetrics),
                                actions: buildActions('commissioning', cxMetrics),
                                summaryBand: [
                                    { label: 'Readiness', value: readiness ? `${overall}%` : '—' },
                                    { label: 'Passed', value: String(passTotal ?? '—') },
                                    { label: 'Failed', value: String(failTotal ?? '—') },
                                    { label: 'Open Issues', value: String(openIssues.length) },
                                    { label: 'Punch', value: String(punch.length) },
                                    { label: 'Duration', value: `~${rich.durationMonths} mo` },
                                ],
                                note: 'Program plan engine-real (rich cx model); readiness = engine readinessIndex over user-tracked completion; checklist activities trace to NETA/IEEE/ASHRAE test procedure templates.',
                            } as StandardReport);
                        } finally { setBusy(false); }
                    }} disabled={busy}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-rz-mint disabled:opacity-50">
                        <FileDown className="h-3.5 w-3.5" /> {busy ? 'Generating…' : 'Export PDF'}
                    </button>
                    <button onClick={() => setActiveTab('ops')} className="inline-flex items-center gap-1 rounded-lg bg-rz-signal px-3 py-1.5 text-xs font-semibold text-rz-base hover:bg-rz-signal/90">Next: Operations <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'cost' ? <CommissioningDashboard /> : tab === 'checklist' ? (
                <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 px-3 py-2 text-[11px] text-slate-500">
                        <ListChecks className="mr-1 inline h-3.5 w-3.5 text-rz-mint" />
                        Cx test-procedure checklist — activities trace to the DC Hub commissioning templates (NETA ATS / IEEE / ASHRAE basis).
                        PASS/FAIL ticks drive each level&apos;s completion and the engine readiness index; sliders become coarse fallback.
                        System groups & ×N unit counts derive LIVE from engine equipment scaling (models.commissioning.equipScale) — systems absent
                        from this config are not rendered. Level names anchor to engine DATA.commissioning.labels; hover definitions are a labeled
                        local map (ASHRAE Guideline 0 / BCxA basis).
                    </div>
                    {READY_KEYS.map((rk) => {
                        const key = rk.key as ReadinessKey;
                        const groups = itemsFor(key, inputs.coolingType, rich.equip as Record<string, number>);
                        const st = checklistStats[key];
                        if (!groups.length) return null;
                        const open = openLevel === key;
                        const eq = rich.equip as Record<string, number>;
                        return (
                            <div key={key} className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                                <button onClick={() => setOpenLevel(open ? null : key)}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left">
                                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`} />
                                    <span title={levelTip(rk)} className="text-xs font-semibold text-slate-800 dark:text-slate-100">{rk.label}</span>
                                    <span className="rounded bg-rz-mint/10 px-1.5 py-0.5 text-[8.5px] font-semibold text-rz-mint"
                                        title="Engine readiness weight">w {Math.round(((rzData()?.commissioning?.weights ?? {})[key] ?? 0) * 100)}%</span>
                                    <div className="ml-2 h-1.5 w-32 overflow-hidden rounded bg-slate-100 dark:bg-slate-800"
                                        title={`${st.pass} pass / ${st.fail} fail of ${st.total} items`}>
                                        <div className="h-1.5 rounded bg-rz-data" style={{ width: `${st.total ? (st.pass / st.total) * 100 : 0}%` }} />
                                    </div>
                                    <span className="ml-auto text-[10px] tabular-nums text-slate-500">{st.pass}/{st.total} passed{st.fail ? ` · ${st.fail} failed` : ''}</span>
                                </button>
                                {open && (
                                    <div className="space-y-3 border-t border-slate-100 dark:border-slate-800/60 px-4 py-3">
                                        {groups.map((g) => (
                                            <div key={g.systemKey}>
                                                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                                                    {TESTS_PER[g.systemKey]?.label ?? 'General / Program'}
                                                    {g.systemKey !== 'general' && eq[g.systemKey] ? ` — ×${eq[g.systemKey]} units` : ''}
                                                </div>
                                                <div className="space-y-1">
                                                    {g.items.map((item) => {
                                                        const ck = `${key}:${item.id}`;
                                                        const v: CxCheckValue = t.checklist[ck] ?? null;
                                                        const proc = resolveProc(item.templateKey, item.params);
                                                        const wit = proc ? WITNESS_STYLE[proc.witness] : null;
                                                        const expanded = openItem === ck;
                                                        return (
                                                            <div key={item.id} className="rounded-lg border border-slate-100 dark:border-slate-800/60">
                                                                <div className="flex items-center gap-2 px-2 py-1.5 text-[11px]">
                                                                    <div className="flex overflow-hidden rounded border border-slate-200 dark:border-slate-700">
                                                                        {(['pass', 'fail', null] as CxCheckValue[]).map((opt) => (
                                                                            <button key={String(opt)}
                                                                                onClick={() => t.actions.setCheck(ck, opt)}
                                                                                title={opt === 'pass' ? 'Mark PASS' : opt === 'fail' ? 'Mark FAIL' : 'Clear'}
                                                                                className={`px-1.5 py-0.5 text-[9px] font-bold ${v === opt
                                                                                    ? opt === 'pass' ? 'bg-rz-data text-rz-base' : opt === 'fail' ? 'bg-rose-500 text-white' : 'bg-slate-400 text-white'
                                                                                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                                                                {opt === 'pass' ? 'PASS' : opt === 'fail' ? 'FAIL' : '—'}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                    {wit && <span className={`rounded px-1 py-0.5 text-[8px] font-bold ${wit.cls}`} title={proc?.witness === 'H' ? 'Hold point — witness mandatory before proceeding' : proc?.witness === 'W' ? 'Witness point' : 'Review point'}>{wit.label}</span>}
                                                                    <span className={`flex-1 ${v === 'pass' ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{item.label}</span>
                                                                    {v === 'fail' && (
                                                                        <button onClick={() => t.actions.upsertIssue({ id: `ck_${item.id}`, title: `Checklist FAIL: ${item.label}`, sev: 'Medium', kind: 'issue', open: true })}
                                                                            className="whitespace-nowrap rounded border border-rose-400/50 px-1.5 py-0.5 text-[9px] text-rose-400 hover:bg-rose-500/10">log issue</button>
                                                                    )}
                                                                    <button onClick={() => setOpenItem(expanded ? null : ck)}
                                                                        className="rounded p-0.5 text-slate-400 hover:text-rz-mint" title="Procedure detail">
                                                                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                                                    </button>
                                                                </div>
                                                                {expanded && proc && (
                                                                    <div className="grid gap-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/40 px-3 py-2.5 md:grid-cols-2">
                                                                        <div>
                                                                            <div className="mb-1 text-[9px] font-semibold uppercase text-slate-400">{proc.title} — procedure</div>
                                                                            <ol className="list-decimal space-y-0.5 pl-4 text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
                                                                                {proc.procedure.map((s, i) => <li key={i}>{s}</li>)}
                                                                            </ol>
                                                                            <div className="mt-2 rounded-lg border border-rz-data/30 bg-rz-data/5 p-2">
                                                                                <div className="text-[9px] font-semibold uppercase text-rz-data">Acceptance</div>
                                                                                <p className="text-[10px] text-slate-600 dark:text-slate-300">{proc.acceptance.criteria}</p>
                                                                                <p className="mt-0.5 text-[9px] text-slate-400">{proc.acceptance.standard}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <div>
                                                                                <div className="mb-0.5 text-[9px] font-semibold uppercase text-slate-400">Tools & instruments</div>
                                                                                <ul className="list-disc pl-4 text-[10px] text-slate-600 dark:text-slate-300">{proc.tools.map((s, i) => <li key={i}>{s}</li>)}</ul>
                                                                            </div>
                                                                            <div>
                                                                                <div className="mb-0.5 text-[9px] font-semibold uppercase text-rose-400">Safety</div>
                                                                                <ul className="list-disc pl-4 text-[10px] text-slate-600 dark:text-slate-300">{proc.safety.map((s, i) => <li key={i}>{s}</li>)}</ul>
                                                                            </div>
                                                                            {proc.logsheet.length > 0 && (
                                                                                <div>
                                                                                    <div className="mb-0.5 text-[9px] font-semibold uppercase text-slate-400">Logsheet fields</div>
                                                                                    <div className="flex flex-wrap gap-1">{proc.logsheet.map((f, i) => <span key={i} className="rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 text-[8.5px] text-slate-500 dark:text-slate-400">{f}</span>)}</div>
                                                                                </div>
                                                                            )}
                                                                            {proc.duration_note && <p className="text-[9px] italic text-slate-400">{proc.duration_note}</p>}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-4">
                    {/* #328 — on-page readiness guidance (same rubric as the PDF). */}
                    {(() => {
                        const met = { readinessPct: overall, testsFailed: failTotal ?? 0, openIssues: openIssues.length };
                        const assess = buildAssessment('commissioning', met);
                        const acts = buildActions('commissioning', met);
                        return (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900/50 p-3">
                                <div className="flex flex-wrap items-start gap-3">
                                    <div className="shrink-0 rounded-lg px-3 py-1.5 text-center text-white" style={{ background: assess.color }}>
                                        <div className="text-[9px] uppercase opacity-80">Readiness</div>
                                        <div className="text-sm font-bold">{assess.label}</div>
                                    </div>
                                    <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{assess.narrative}</p>
                                </div>
                                <div className="mt-2 space-y-1">
                                    {acts.slice(0, 3).map((a, i) => (
                                        <div key={i} className="flex items-start gap-2 text-[10.5px] text-slate-600 dark:text-slate-300">
                                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8.5px] font-bold text-white ${a.priority === 'HIGH' ? 'bg-red-600' : a.priority === 'MEDIUM' ? 'bg-amber-600' : 'bg-rz-data'}`}>{a.priority}</span>
                                            <span>{a.action}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                    {planMode && (
                        <div className="rounded-xl border border-rz-mint/40 bg-rz-signal/10 px-3 py-2 text-[11px] text-rz-mint">
                            <b>Plan Mode</b> — no commissioning progress entered yet. The program plan below is engine-real; set per-level completion to activate the readiness index.
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                            { label: 'Readiness Index', value: readiness ? `${overall}%` : '—', sub: readiness ? `${readiness.status} (engine)` : 'enter completion below', trace: 'cx.readiness' },
                            { label: 'Program Duration', value: `${rich.durationDays} d`, sub: `~${rich.durationMonths} mo · L0→L6` },
                            { label: 'Systems in Scope', value: String(systems.length), sub: 'from equipment scaling' },
                            { label: 'Tests (screening)', value: testsTotal.toLocaleString(), sub: t.testsPassed != null ? `${t.testsPassed} passed · ${t.testsFailed ?? 0} failed` : 'counts × tests-per-unit', trace: 'cx.testsTotal' },
                            { label: 'Open Issues', value: String(openIssues.length), sub: `${punch.length} punch items` },
                            /* #7 audit — scenarios derive from the REDUNDANCY config, not the project
                             * tier; labeling them with tierInfo.tier ("Tier IV" at 2N) contradicted the
                             * project's Tier 3 target. Attribute to redundancy; project tier = sim.tierLevel. */
                            { label: 'IST Scenarios', value: String(rich.tierInfo.scenarios), sub: `${inputs.powerRedundancy} config · ${rich.tierInfo.istHrs}h IST` },
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

                    <div className="grid gap-4 xl:grid-cols-2">
                        {/* level timeline */}
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
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
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Readiness Completion <span className="text-[9px] normal-case text-rz-mint">feeds engine readinessIndex (weights engine-real)</span></h2>
                            <div className="space-y-1.5">
                                {READY_KEYS.map((rk) => {
                                    const st = checklistStats[rk.key];
                                    const derived = st?.derived ?? null;
                                    const v = derived != null ? derived : t.completion[rk.key];
                                    return (
                                        <div key={rk.key} className="flex items-center gap-2 text-[11px]">
                                            <span className="w-36 cursor-help text-slate-600 dark:text-slate-300" title={levelTip(rk)}>{rk.label} <span className="text-[8px] text-slate-400">ⓘ</span></span>
                                            <input type="range" min={0} max={100} step={5}
                                                value={v == null ? 0 : Math.round(v * 100)}
                                                disabled={derived != null}
                                                title={derived != null ? `Derived from checklist: ${st.pass}/${st.total} passed` : `${rk.label} completion`}
                                                onChange={(ev) => t.actions.setCompletion(rk.key, Number(ev.target.value) / 100)}
                                                className={`flex-1 accent-rz-mint ${derived != null ? 'opacity-60' : ''}`} />
                                            <span className="w-10 text-right tabular-nums text-slate-500">{v == null ? '—' : `${Math.round(v * 100)}%`}</span>
                                            {derived != null ? (
                                                <span className="rounded bg-cyan-500/15 px-1 py-0.5 text-[8px] font-semibold uppercase text-cyan-500" title={`${st.pass} pass / ${st.fail} fail of ${st.total} items`}>from checklist</span>
                                            ) : (
                                                st && st.total > 0 && (
                                                    <button onClick={() => { setTab('checklist'); setOpenLevel(rk.key as ReadinessKey); }}
                                                        className="whitespace-nowrap rounded border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-500 hover:border-rz-mint hover:text-rz-mint"
                                                        title={`Open the ${st.total}-item Cx checklist for ${rk.label}`}>
                                                        Checklist ▸
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {readiness && (
                                <div className={`mt-2 rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold ${readiness.status === 'Ready' ? 'bg-rz-data/15 text-rz-data' : readiness.status === 'Conditional' ? 'bg-amber-500/15 text-amber-500' : 'bg-slate-500/15 text-slate-400'}`}>
                                    {readiness.label} — {overall}%
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
                        {/* systems table */}
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
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
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Issues & Punch List</h2>
                            <div className="space-y-1">
                                {t.issues.map((x) => (
                                    <label key={x.id} className="flex items-center gap-2 text-[11px]">
                                        <input type="checkbox" checked={!x.open} onChange={() => t.actions.toggleIssue(x.id)} className="accent-rz-mint" />
                                        <span className={`rounded px-1 py-0.5 text-[8.5px] font-bold ${x.sev === 'High' ? 'bg-rose-500/15 text-rose-500' : x.sev === 'Medium' ? 'bg-amber-500/15 text-amber-500' : 'bg-slate-500/15 text-slate-400'}`}>{x.sev}</span>
                                        <span className={`flex-1 truncate ${x.open ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 line-through'}`}>{x.title}</span>
                                        <span className="text-[9px] uppercase text-slate-400">{x.kind}</span>
                                        {x.isExample && <span className="rounded bg-amber-500/15 px-1 text-[8px] font-semibold text-amber-500">EXAMPLE</span>}
                                    </label>
                                ))}
                            </div>
                            <button onClick={() => t.actions.upsertIssue({ id: `c_${Date.now()}`, title: 'New item', sev: 'Medium', kind: 'punch', open: true })}
                                className="mt-2 rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:border-rz-mint">＋ Add item</button>
                        </div>
                    </div>

                    {/* phase donut */}
                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Program Cost Share by Level (engine fixed proportions)</h2>
                        <div className="flex items-center gap-3">
                            <div className="h-36 w-36 shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={rich.levels} dataKey="cost" nameKey="label" innerRadius={34} outerRadius={54} paddingAngle={2}>
                                            {rich.levels.map((_: unknown, idx: number) => <Cell key={idx} fill={LEVEL_COLORS[idx]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v) => `$${(Number(v) / 1e3).toFixed(0)}K`} contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
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
