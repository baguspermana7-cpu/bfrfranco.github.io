'use client';

/* ─── Operations Engine — overview page (Phase G, tab 'ops') ─────────────────
 * Derived plane engine-real (availability TARGET from tierAvailability, live
 * PUE = partialLoadPUE at occupancy, active IT = itLoad × occupancy, energy
 * cost from the country rate, asset health from the Weibull model, shift
 * on-duty from the ShiftEngine); log plane = user-entered opsLog (alarms /
 * incidents / tickets, EXAMPLE-chipped seeds). 24h series = documented
 * deterministic diurnal cosine shape — NO Math.random. Sub-tabs Shift &
 * People and Maintenance absorb the existing dashboards BY COMPOSITION.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { TraceValue } from '@/components/ui/TraceValue';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useSimulationStore } from '@/store/simulation';
import { useOpsLog } from '@/store/opsLog';
import { rzModels, rzData } from '@/lib/rz-engine';
import { getPUE } from '@/constants/pue';
import { StaffingDashboard } from '@/components/modules/StaffingDashboard';
import { MaintenanceDashboard } from '@/components/modules/MaintenanceDashboard';
import { Wrench, ChevronRight, FileDown } from 'lucide-react';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';

const PRI_COLORS: Record<string, string> = { P1: '#f43f5e', P2: '#f97316', P3: '#f59e0b', P4: '#64748b' };

/** Deterministic diurnal shape (documented): cosine peak at 14:00, amplitude a. */
function diurnal(hour: number, base: number, a: number): number {
    return base * (1 + a * Math.cos(((hour - 14) / 24) * 2 * Math.PI));
}

export function OperationsDashboard() {
    const inputs = useSimulationStore((s) => s.inputs);
    const country = useSimulationStore((s) => s.selectedCountry);
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const log = useOpsLog();
    const [tab, setTab] = React.useState<'overview' | 'staff' | 'maint'>('overview');

    const model = React.useMemo(() => {
        const d = rzData(); const m = rzModels();
        const tierAvail: Record<number, number> = d?.reliability?.tierAvailability ?? { 2: 0.99741, 3: 0.99982, 4: 0.99995 };
        const availTargetPct = +((tierAvail[inputs.tierLevel] ?? 0.99982) * 100).toFixed(4);
        const designPue = d?.pueMatrix?.[inputs.coolingType]?.['tier' + inputs.tierLevel] ?? getPUE(inputs.coolingType);
        let occ = 0.85;
        try { if (m?.capacity?.occupancyScurve) occ = Math.max(0.05, Math.min(1, m.capacity.occupancyScurve(1, 'wholesale'))); } catch { /* */ }
        let livePue = designPue;
        try { if (m?.pue?.partialLoadPUE) livePue = +m.pue.partialLoadPUE(designPue, occ).toFixed(2); } catch { /* */ }
        const activeItMw = +((inputs.itLoad / 1000) * occ).toFixed(1);
        const capMw = inputs.itLoad / 1000;
        const rate = country?.economy?.electricityRate ?? 0.1;
        const facilityMwh24 = activeItMw * livePue * 24;
        const energyCostToday = Math.round(facilityMwh24 * 1000 * rate);
        // asset health across weibull classes at 40% design life (screening age)
        let assetHealth: { avg: number; rows: { cls: string; health: number; fp: number }[] } = { avg: 0, rows: [] };
        try {
            if (m?.asset?.healthIndex) {
                const classes = ['ups', 'battery', 'generator', 'crac', 'chiller', 'pdu', 'switchgear', 'transformer', 'bms'];
                const rows = classes.map((cls) => {
                    const life = m.asset.designLife?.(cls) ?? 15;
                    const age = Math.round(life * 0.4);
                    const h = m.asset.healthIndex({ assetClass: cls, ageYears: age, condition: 0.85, duty: 0.5 });
                    const fp = m.asset.failureProbability ? m.asset.failureProbability(cls, age)?.failureProb ?? 0 : 0;
                    return { cls, health: h?.health ?? 0, fp: +(fp * 100).toFixed(0) };
                });
                assetHealth = { avg: Math.round(rows.reduce((s, r) => s + r.health, 0) / rows.length), rows };
            }
        } catch { /* */ }
        const load24 = Array.from({ length: 25 }, (_, h) => ({
            hour: h,
            itMw: +diurnal(h, activeItMw, 0.05).toFixed(1),
            facilityMw: +(diurnal(h, activeItMw, 0.05) * livePue).toFixed(1),
            capMw,
        }));
        return { availTargetPct, designPue, livePue, occ, activeItMw, capMw, energyCostToday, assetHealth, load24, rate };
    }, [inputs, country]);

    const activeAlarms = log.alarms.filter((a) => a.status === 'Active');
    const openTickets = log.tickets.filter((tk) => tk.status !== 'Closed');
    const openIncidents = log.incidents.filter((i) => i.status !== 'Resolved');
    const byPri = (p: string) => activeAlarms.filter((a) => a.priority === p).length;
    const planMode = !log.touched;

    // shift overview from shiftModel + headcounts (engine-real staffing basis)
    const shifts = React.useMemo(() => {
        const total = (inputs.headcount_ShiftLead ?? 0) + (inputs.headcount_Engineer ?? 0) + (inputs.headcount_Technician ?? 0);
        if (inputs.shiftModel === '12h') {
            const per = Math.ceil(total / 2);
            return [
                { id: 'A', label: 'Shift A (Day)', window: '06:00 – 18:00', onDuty: per, planned: per },
                { id: 'B', label: 'Shift B (Night)', window: '18:00 – 06:00', onDuty: per, planned: per },
            ];
        }
        const per = Math.ceil(total / 3);
        return [
            { id: 'A', label: 'Shift A (Day)', window: '06:00 – 14:00', onDuty: per, planned: per },
            { id: 'B', label: 'Shift B (Swing)', window: '14:00 – 22:00', onDuty: per, planned: per },
            { id: 'C', label: 'Shift C (Night)', window: '22:00 – 06:00', onDuty: per, planned: per },
        ];
    }, [inputs.shiftModel, inputs.headcount_ShiftLead, inputs.headcount_Engineer, inputs.headcount_Technician]);

    const alarmDonut = (['P1', 'P2', 'P3', 'P4'] as const).map((p) => ({ name: p, value: byPri(p) })).filter((x) => x.value > 0);
    const [busy, setBusy] = React.useState(false);

    const exportPdf = async () => {
        setBusy(true);
        try {
            /* PM compliance from logged weeks (same basis as the Maintenance KPI); null → engine's Plan-Mode default */
            const opsMetrics = {
                maintCompliancePct: log.completedPmWeeks.length > 0 ? Math.min(100, Math.round((log.completedPmWeeks.length / 52) * 100)) : null,
                avgHealthPct: model.assetHealth.avg,
                activeAlarms: activeAlarms.length,
            };
            await generatePillarPDF({
                title: 'Operations', layer: 'Operations Engine', project: '—',
                kpis: [
                    { label: 'Availability Target', value: `${model.availTargetPct}%`, sub: `Tier ${inputs.tierLevel} design target` },
                    { label: 'PUE (at load)', value: String(model.livePue), sub: `design ${model.designPue} · ${Math.round(model.occ * 100)}% occ` },
                    { label: 'Active IT Load', value: `${model.activeItMw} MW`, sub: `of ${model.capMw.toFixed(1)} MW (${Math.round(model.occ * 100)}%)` },
                    { label: 'Active Alarms', value: String(activeAlarms.length), sub: `P1:${byPri('P1')} P2:${byPri('P2')} P3:${byPri('P3')}` },
                    { label: 'Open Tickets', value: String(openTickets.length), sub: `${openIncidents.length} incidents open` },
                    { label: 'Energy Cost (24h)', value: `$${model.energyCostToday.toLocaleString()}`, sub: `@ $${model.rate}/kWh (${country?.name ?? '—'})` },
                ],
                config: [
                    ['Tier', `Tier ${inputs.tierLevel}`],
                    ['Cooling', inputs.coolingType],
                    ['Shift Model', inputs.shiftModel],
                    ['Occupancy', `${Math.round(model.occ * 100)}%`],
                    ['Electricity Rate', `$${model.rate}/kWh`],
                    ['Country', country?.name ?? '—'],
                ],
                sections: [
                    { title: 'Recent Alarms (ops log)', head: ['Priority', 'Tag', 'Message', 'Status'], rows: log.alarms.slice(0, 10).map((a) => [a.priority, a.tag, a.message, a.status]) },
                    { title: 'Asset Health (Weibull @ 40% design life)', head: ['Class', 'Health /100', 'Failure CDF %'], rows: model.assetHealth.rows.map((r) => [r.cls, String(Math.round(r.health)), `${r.fp}%`]) },
                ],
                callouts: planMode ? [{
                    title: 'Plan Mode — EXAMPLE-seeded ops log',
                    body: 'Alarm/incident/ticket counts come from the EXAMPLE-seeded ops log; edit or add entries to make them yours. Derived KPIs (availability target, PUE, load, energy) are engine-real from the planning state.',
                    tone: 'info' as const,
                }] : [],
                summaryBand: [
                    { label: 'Availability', value: `${model.availTargetPct}%` },
                    { label: 'Live PUE', value: String(model.livePue) },
                    { label: 'Active IT', value: `${model.activeItMw} MW` },
                    { label: 'Alarms', value: String(activeAlarms.length) },
                    { label: 'Tickets', value: String(openTickets.length) },
                    { label: 'Incidents', value: String(openIncidents.length) },
                ],
                assessment: buildAssessment('operations', opsMetrics),
                actions: buildActions('operations', opsMetrics),
                note: 'Derived plane engine-real (tier availability target, partial-load PUE at occupancy, energy cost from the country rate, Weibull asset health); log plane user-entered. 24h series = deterministic diurnal cosine — no random data.',
            } as StandardReport);
        } finally { setBusy(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 shadow-lg"><Wrench className="h-6 w-6 text-white" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Operations Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Operations overview & performance — simulated from the planning state, ops log user-entered</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                        {([['overview', 'Overview'], ['staff', 'Shift & People'], ['maint', 'Maintenance']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                        ))}
                    </div>
                    <button onClick={exportPdf} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-violet-400"><FileDown className="h-3.5 w-3.5" />{busy ? '…' : 'Export'}</button>
                    <button onClick={() => setActiveTab('finance')} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">Next: Financial <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'staff' ? <StaffingDashboard /> : tab === 'maint' ? <MaintenanceDashboard /> : (
                <div className="space-y-4">
                    {planMode && (
                        <div className="rounded-xl border border-violet-500/40 bg-violet-600/10 px-3 py-2 text-[11px] text-violet-500">
                            <b>Plan Mode</b> — alarm/incident/ticket counts come from the EXAMPLE-seeded ops log; edit or add entries to make them yours. Derived KPIs (availability target, PUE, load, energy) are engine-real from the planning state.
                        </div>
                    )}

                    {/* KPI row */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                        {[
                            { label: 'Availability Target', value: `${model.availTargetPct}%`, sub: `Tier ${inputs.tierLevel} design target`, trace: 'rel.tierTarget' },
                            { label: 'PUE (at load)', value: String(model.livePue), sub: `design ${model.designPue} · ${Math.round(model.occ * 100)}% occ` },
                            { label: 'Active IT Load', value: `${model.activeItMw} MW`, sub: `of ${model.capMw.toFixed(1)} MW (${Math.round(model.occ * 100)}%)` },
                            { label: 'Active Alarms', value: String(activeAlarms.length), sub: `P1:${byPri('P1')} P2:${byPri('P2')} P3:${byPri('P3')}` },
                            { label: 'Open Tickets', value: String(openTickets.length), sub: `${openIncidents.length} incidents open` },
                            { label: 'PM Compliance', value: log.completedPmWeeks.length > 0 ? `${Math.min(100, Math.round((log.completedPmWeeks.length / 52) * 100))}%` : '—', sub: log.completedPmWeeks.length > 0 ? `${log.completedPmWeeks.length}/52 weeks logged` : 'no PM logged yet' },
                            { label: 'Energy Cost (24h)', value: `$${model.energyCostToday.toLocaleString()}`, sub: `@ $${model.rate}/kWh (${country?.name ?? '—'})`, trace: 'ops.energyCostDaily' },
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

                    <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
                        <div className="min-w-0 space-y-4">
                            {/* load curve */}
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">IT & Facility Load — 24h <span className="ml-1 rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-semibold text-amber-500">SIMULATED PROFILE</span> <span className="text-[9px] normal-case text-slate-400">deterministic diurnal cosine ±5% · peak 14:00</span></h2>
                                <div className="h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={model.load24}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                            <XAxis dataKey="hour" tick={{ fontSize: 9 }} unit="h" />
                                            <YAxis tick={{ fontSize: 9 }} unit=" MW" />
                                            <Tooltip contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                            <Legend wrapperStyle={{ fontSize: 10 }} />
                                            <Area dataKey="itMw" name="IT Load" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.15} />
                                            <Line dataKey="facilityMw" name="Facility Load" stroke="#a78bfa" strokeWidth={1.6} dot={false} />
                                            <Line dataKey="capMw" name="IT Capacity" stroke="#f59e0b" strokeDasharray="6 4" dot={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* alarms + asset health */}
                            <div className="grid gap-4 xl:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                    <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recent Alarms (ops log)</h2>
                                    <div className="space-y-1">
                                        {log.alarms.slice(0, 6).map((a) => (
                                            <div key={a.id} className="flex items-center gap-2 text-[11px]">
                                                <span className="rounded px-1 py-0.5 text-[9px] font-bold text-white" style={{ background: PRI_COLORS[a.priority] }}>{a.priority}</span>
                                                <span className="font-mono text-slate-500">{a.tag}</span>
                                                <span className="truncate text-slate-700 dark:text-slate-200">{a.message}</span>
                                                {a.isExample && <span className="rounded bg-amber-500/15 px-1 text-[8px] font-semibold text-amber-500">EXAMPLE</span>}
                                                <select className="ml-auto rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1 py-0.5 text-[9px] text-slate-500"
                                                    value={a.status} onChange={(ev) => log.actions.setAlarmStatus(a.id, ev.target.value as typeof a.status)}>
                                                    {['Active', 'Acked', 'Cleared'].map((s) => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                    {alarmDonut.length > 0 && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <div className="h-20 w-20">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart><Pie data={alarmDonut} dataKey="value" nameKey="name" innerRadius={18} outerRadius={32}>
                                                        {alarmDonut.map((x) => <Cell key={x.name} fill={PRI_COLORS[x.name]} />)}
                                                    </Pie></PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <div className="text-[10px] text-slate-500">{activeAlarms.length} active alarm(s) by priority</div>
                                        </div>
                                    )}
                                </div>
                                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                    <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Asset Health <span className="text-[9px] normal-case text-slate-400">Weibull model @ 40% design life (screening age)</span></h2>
                                    <div className="mb-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{model.assetHealth.avg}<span className="text-sm text-slate-400">/100 avg</span></div>
                                    <div className="space-y-1">
                                        {model.assetHealth.rows.slice(0, 6).map((r) => (
                                            <div key={r.cls} className="flex items-center gap-2 text-[11px]">
                                                <span className="w-20 capitalize text-slate-600 dark:text-slate-300">{r.cls}</span>
                                                <div className="h-1.5 flex-1 rounded bg-slate-100 dark:bg-slate-800"><div className={`h-1.5 rounded ${r.health >= 70 ? 'bg-emerald-500' : r.health >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${r.health}%` }} /></div>
                                                <span className="w-8 text-right tabular-nums text-slate-500">{Math.round(r.health)}</span>
                                                <span className="w-14 text-right text-[9px] tabular-nums text-slate-400">{r.fp}% CDF</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => setActiveTab('asset-health')} className="mt-1.5 text-[10px] font-medium text-violet-500">View Asset Dashboard →</button>
                                </div>
                            </div>

                            {/* incidents + tickets */}
                            <div className="grid gap-4 xl:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                    <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Incidents ({openIncidents.length} open)</h2>
                                    <div className="space-y-1">
                                        {log.incidents.slice(0, 5).map((i2) => (
                                            <div key={i2.id} className="flex items-center gap-2 text-[11px]">
                                                <span className="rounded px-1 py-0.5 text-[9px] font-bold text-white" style={{ background: PRI_COLORS[i2.priority] }}>{i2.priority}</span>
                                                <span className="truncate text-slate-700 dark:text-slate-200">{i2.title}</span>
                                                {i2.isExample && <span className="rounded bg-amber-500/15 px-1 text-[8px] font-semibold text-amber-500">EXAMPLE</span>}
                                                <select className="ml-auto rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1 py-0.5 text-[9px] text-slate-500"
                                                    value={i2.status} onChange={(ev) => log.actions.setIncidentStatus(i2.id, ev.target.value as typeof i2.status)}>
                                                    {['Open', 'In Progress', 'On Hold', 'Resolved'].map((s) => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                                    <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Service Tickets ({openTickets.length} open)</h2>
                                    <div className="space-y-1">
                                        {log.tickets.slice(0, 5).map((tk) => (
                                            <div key={tk.id} className="flex items-center gap-2 text-[11px]">
                                                <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${tk.priority === 'High' ? 'bg-rose-500/15 text-rose-500' : tk.priority === 'Medium' ? 'bg-amber-500/15 text-amber-500' : 'bg-slate-500/15 text-slate-400'}`}>{tk.priority}</span>
                                                <span className="truncate text-slate-700 dark:text-slate-200">{tk.title}</span>
                                                {tk.isExample && <span className="rounded bg-amber-500/15 px-1 text-[8px] font-semibold text-amber-500">EXAMPLE</span>}
                                                <select className="ml-auto rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1 py-0.5 text-[9px] text-slate-500"
                                                    value={tk.status} onChange={(ev) => log.actions.setTicketStatus(tk.id, ev.target.value as typeof tk.status)}>
                                                    {['Open', 'In Progress', 'Closed'].map((s) => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* rail */}
                        <aside className="space-y-4 lg:sticky lg:top-4 self-start">
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Shift Overview <span className="text-[8px] normal-case text-slate-400">({inputs.shiftModel} model · engine staffing basis)</span></h3>
                                <div className="space-y-1.5">
                                    {shifts.map((s) => (
                                        <div key={s.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-[11px]">
                                            <div className="flex justify-between"><span className="font-medium text-slate-800 dark:text-slate-200">{s.label}</span><span className="text-[9px] text-slate-400">{s.window}</span></div>
                                            <div className="text-[10px] text-slate-500">On duty {s.onDuty} / {s.planned}</div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => setTab('staff')} className="mt-1.5 text-[10px] font-medium text-violet-500">View Shift & People →</button>
                            </div>
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Quick Actions</h3>
                                <div className="space-y-1 text-[11px]">
                                    <button onClick={() => log.actions.addTicket({ time: 'now', priority: 'Medium', title: 'New work order', status: 'Open' })} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-left text-slate-600 dark:text-slate-300 hover:border-violet-400">＋ Create Work Order</button>
                                    <button onClick={() => log.actions.addIncident({ time: 'now', priority: 'P3', title: 'New incident', status: 'Open' })} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-left text-slate-600 dark:text-slate-300 hover:border-violet-400">＋ Report Incident</button>
                                    <button onClick={() => setTab('maint')} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-left text-slate-600 dark:text-slate-300 hover:border-violet-400">Add Maintenance Plan</button>
                                    <button onClick={() => setActiveTab('sim')} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-left text-slate-600 dark:text-slate-300 hover:border-violet-400">Configure Staff Model</button>
                                    <button onClick={() => setActiveTab('users')} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-left text-slate-600 dark:text-slate-300 hover:border-violet-400">Request Access</button>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Shortcuts</h3>
                                <div className="grid grid-cols-2 gap-1 text-[11px]">
                                    <button onClick={() => setActiveTab('knowledge')} className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-slate-600 dark:text-slate-300 hover:border-violet-400">SOP Library</button>
                                    <button onClick={() => setActiveTab('report')} className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-slate-600 dark:text-slate-300 hover:border-violet-400">Reports</button>
                                    <button onClick={() => setActiveTab('dashboard')} className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-slate-600 dark:text-slate-300 hover:border-violet-400">Dashboards</button>
                                    <button onClick={() => setActiveTab('knowledge')} className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-slate-600 dark:text-slate-300 hover:border-violet-400">Knowledge Base</button>
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            )}
        </div>
    );
}
