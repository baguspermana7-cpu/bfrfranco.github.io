'use client';

/* ─── DC-OS · dedicated pillar dashboards for the new Layer engines ───────────
 * Requirements(L1) · Site Intelligence(L2) · Architecture(L3) · Construction(L6)
 * · Commissioning(L7) · Asset Intelligence(L9). Each consumes its RZEngine model
 * with the current project config — all values engine-real, honest fallbacks.
 * ──────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { rzModels } from '@/lib/rz-engine';
import { generatePillarPDF, type PillarReport } from '@/modules/reporting/pdf/PillarPdf';
import { ClipboardList, MapPin, Boxes, HardHat, CheckCircle2, Activity, FileDown } from 'lucide-react';

const REDUNDANCY_KEY: Record<string, string> = { 'N+1': 'n1', '2N': '2n', '2N+1': '2n1' };
const useCfg = () => {
    const { inputs, selectedCountry } = useSimulationStore();
    return { inputs, country: selectedCountry, redKey: REDUNDANCY_KEY[inputs.powerRedundancy] || 'n1' };
};

function Head({ icon: Icon, title, sub, tone = 'from-cyan-500 to-blue-600', report }: { icon: React.ElementType; title: string; sub: string; tone?: string; report?: () => PillarReport }) {
    const [busy, setBusy] = React.useState(false);
    const onExport = async () => { if (!report) return; setBusy(true); try { await generatePillarPDF(report()); } finally { setBusy(false); } };
    return (
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tone} flex items-center justify-center shadow-lg`}><Icon className="w-6 h-6 text-white" /></div>
                <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1><p className="text-sm text-slate-500 dark:text-slate-400">{sub}</p></div>
            </div>
            {report && (
                <button onClick={onExport} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-cyan-700 text-white text-xs font-medium transition-colors disabled:opacity-60">
                    <FileDown className="w-3.5 h-3.5" />{busy ? 'Generating…' : 'Generate Report'}
                </button>
            )}
        </div>
    );
}
function Card({ children }: { children: React.ReactNode }) { return <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">{children}</div>; }
function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3"><div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div><div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</div>{sub && <div className="text-[10px] text-slate-500">{sub}</div>}</div>;
}
function Loading() { return <div className="text-sm text-slate-500 p-8 text-center">Engine loading…</div>; }

/* ── L1 Requirements ── */
export function RequirementsDashboard() {
    const { inputs, country } = useCfg();
    const m = rzModels().requirements;
    if (!m) return <Loading />;
    const intake = { itLoadKw: inputs.itLoad, targetTier: inputs.tierLevel, region: country?.id, useCase: 'ai', budgetUsd: undefined, deadlineMonths: undefined };
    const v = m.validate(intake);
    const prof = m.profile('ai');
    return (
        <div className="space-y-4">
            <Head icon={ClipboardList} title="Requirements" sub="DC-OS Layer 1 · models.requirements" tone="from-cyan-500 to-blue-600"
                report={() => ({
                    title: 'Requirements', layer: 'Layer 1 · Requirements', project: country?.name || '—',
                    kpis: [{ label: 'Brief Completeness', value: `${v.completeness.pct}%`, sub: v.completeness.ready ? 'ready' : `${v.completeness.missing.length} missing` }, { label: 'Use Case', value: prof?.label || '—', sub: `${prof?.rackKw ?? '—'} kW/rack` }, { label: 'Rec. Tier Floor', value: v.recommendedTierFloor ? `Tier ${v.recommendedTierFloor}` : '—' }, { label: 'Target Tier', value: `Tier ${inputs.tierLevel}` }],
                    sections: [{ title: 'Intake Checklist', head: ['Field', 'Status'], rows: ['itLoadKw', 'targetTier', 'region', 'useCase', 'budgetUsd', 'deadlineMonths'].map((f) => [f, v.completeness.have.includes(f) ? 'provided' : 'missing']) }],
                    note: v.flags.map((f: { message: string }) => f.message).join(' · ') || 'Educational planning intake, not a design basis.',
                })} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Metric label="Brief Completeness" value={`${v.completeness.pct}%`} sub={v.completeness.ready ? 'ready' : `${v.completeness.missing.length} missing`} />
                <Metric label="Use Case" value={prof?.label || '—'} sub={`${prof?.rackKw ?? '—'} kW/rack`} />
                <Metric label="Rec. Tier Floor" value={v.recommendedTierFloor ? `Tier ${v.recommendedTierFloor}` : '—'} sub={prof?.cooling} />
                <Metric label="Target Tier" value={`Tier ${inputs.tierLevel}`} sub={v.flags.length ? 'flagged' : 'ok'} />
            </div>
            <Card>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Intake Checklist</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 text-xs">
                    {['itLoadKw', 'targetTier', 'region', 'useCase', 'budgetUsd', 'deadlineMonths'].map((f) => (
                        <div key={f} className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${v.completeness.have.includes(f) ? 'bg-emerald-500' : 'bg-slate-400'}`} /><span className="text-slate-600 dark:text-slate-300">{f}</span></div>
                    ))}
                </div>
                {v.flags.map((fl: { message: string }, i: number) => <p key={i} className="mt-2 text-[11px] text-amber-500">⚠ {fl.message}</p>)}
            </Card>
        </div>
    );
}

/* ── L2 Site Intelligence ── */
export function SiteIntelDashboard() {
    const m = rzModels().site;
    if (!m) return <Loading />;
    // representative factors (0-1 goodness) — real factor wiring lands with the site-data layer
    const factors = { power: 0.7, grid: 0.82, seismic: 0.72, talent: 0.62, tax: 0.6, carbon: 0.62, flood: 0.75, latency: 0.7, water: 0.68 };
    const r = m.score(factors);
    return (
        <div className="space-y-4">
            <Head icon={MapPin} title="Site Intelligence" sub="DC-OS Layer 2 · models.site.score" tone="from-emerald-500 to-cyan-600"
                report={() => ({
                    title: 'Site Intelligence', layer: 'Layer 2 · Site Score', project: '—',
                    kpis: [{ label: 'Site Score', value: `${r.score}/100`, sub: `Grade ${r.grade} · ${r.label}` }, { label: 'Coverage', value: `${Math.round(r.coverage * 100)}%` }, { label: 'Factors', value: String(r.breakdown.length) }],
                    sections: [{ title: 'Factor Breakdown', head: ['Factor', 'Score', 'Weight', 'Contribution'], rows: r.breakdown.map((f: { key: string; value: number; weight: number; contribution: number }) => [f.key, `${Math.round(f.value * 100)}%`, `${Math.round(f.weight * 100)}%`, f.contribution.toFixed(3)]) }],
                    note: 'Representative factors — per-site GIS/weather/grid/tax data wiring is the next increment.',
                })} />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Metric label="Site Score" value={`${r.score}/100`} sub={`Grade ${r.grade} · ${r.label}`} />
                <Metric label="Coverage" value={`${Math.round(r.coverage * 100)}%`} sub="factors supplied" />
                <Metric label="Factors" value={String(r.breakdown.length)} sub="weighted" />
            </div>
            <Card>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Factor Breakdown</h2>
                <div className="space-y-1.5">
                    {r.breakdown.sort((a: { contribution: number }, b: { contribution: number }) => b.contribution - a.contribution).map((f: { key: string; value: number; weight: number }) => (
                        <div key={f.key} className="flex items-center gap-2 text-xs">
                            <span className="w-24 text-slate-600 dark:text-slate-300 capitalize">{f.key}</span>
                            <div className="flex-1 h-2 rounded bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded bg-cyan-500" style={{ width: `${f.value * 100}%` }} /></div>
                            <span className="w-10 text-right tabular-nums text-slate-500">{Math.round(f.value * 100)}%</span>
                            <span className="w-10 text-right tabular-nums text-slate-400">w{Math.round(f.weight * 100)}</span>
                        </div>
                    ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-400">Representative factors — per-site GIS/weather/grid/tax data wiring is the next increment.</p>
            </Card>
        </div>
    );
}

/* ── L3 Architecture ── */
export function ArchitectureDashboard() {
    const { inputs, redKey } = useCfg();
    const m = rzModels().architecture;
    if (!m) return <Loading />;
    const c = m.complexity({ coolingType: inputs.coolingType, tier: inputs.tierLevel, redundancy: redKey });
    const disc = m.disciplines({ coolingType: inputs.coolingType, tier: inputs.tierLevel, redundancy: redKey });
    return (
        <div className="space-y-4">
            <Head icon={Boxes} title="Architecture" sub="DC-OS Layer 3 · models.architecture" tone="from-violet-500 to-blue-600"
                report={() => ({
                    title: 'Architecture', layer: 'Layer 3 · Architecture', project: '—',
                    kpis: [{ label: 'Design Complexity', value: `${c.index}/100`, sub: c.band }, { label: 'Cooling', value: inputs.coolingType, sub: `×${c.drivers.cooling}` }, { label: 'Tier×Redundancy', value: `T${inputs.tierLevel} ${inputs.powerRedundancy}`, sub: `×${c.drivers.tier}·×${c.drivers.redundancy}` }],
                    sections: [{ title: 'Discipline Spec', head: ['Discipline', 'Driver'], rows: disc.map((d: { label: string; driver: string }) => [d.label, d.driver]) }],
                    note: 'Screening complexity index — not a design deliverable.',
                })} />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Metric label="Design Complexity" value={`${c.index}/100`} sub={c.band} />
                <Metric label="Cooling" value={inputs.coolingType} sub={`×${c.drivers.cooling}`} />
                <Metric label="Tier × Redundancy" value={`T${inputs.tierLevel} · ${inputs.powerRedundancy}`} sub={`×${c.drivers.tier} · ×${c.drivers.redundancy}`} />
            </div>
            <Card>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Discipline Spec</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {disc.map((disp: { key: string; label: string; driver: string }) => (
                        <div key={disp.key} className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/50 py-1">
                            <span className="text-slate-700 dark:text-slate-200">{disp.label}</span><span className="text-slate-500 text-[11px]">{disp.driver}</span>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}

/* ── L6 Construction ── */
export function ConstructionDashboard() {
    const m = rzModels().construction;
    const capex = useCapexStore((s) => s.results);
    if (!m) return <Loading />;
    if (!capex?.timeline) return <div className="space-y-4"><Head icon={HardHat} title="Construction" sub="DC-OS Layer 6 · models.construction" tone="from-amber-500 to-orange-600" /><Card><p className="text-xs text-slate-500">Run the CAPEX engine for the build schedule.</p></Card></div>;
    const s = m.schedule(capex.timeline);
    return (
        <div className="space-y-4">
            <Head icon={HardHat} title="Construction" sub="DC-OS Layer 6 · models.construction" tone="from-amber-500 to-orange-600"
                report={() => ({
                    title: 'Construction', layer: 'Layer 6 · Construction Schedule', project: '—',
                    kpis: [{ label: 'Total Build', value: `${s.totalMonths} mo` }, { label: 'RFS Milestone', value: `M${s.milestones?.rfs ?? '—'}` }, { label: 'Power On', value: `M${s.milestones?.powerOn ?? '—'}` }],
                    sections: [{ title: 'Phase Schedule', head: ['Phase', 'Start', 'End', 'Months'], rows: s.rows.map((r: { label: string; startMonth: number; endMonth: number; months: number }) => [r.label, `M${r.startMonth}`, `M${r.endMonth}`, r.months]) }],
                    note: 'CPM-style screening schedule with fast-track overlap — not a resource-loaded programme.',
                })} />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Metric label="Total Build" value={`${s.totalMonths} mo`} sub="fast-tracked" />
                <Metric label="RFS Milestone" value={`M${s.milestones?.rfs ?? '—'}`} sub="ready for service" />
                <Metric label="Power On" value={`M${s.milestones?.powerOn ?? '—'}`} sub="energization" />
            </div>
            <Card>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Phase Schedule</h2>
                <div className="space-y-1.5">
                    {s.rows.map((r: { key: string; label: string; startMonth: number; endMonth: number; months: number }) => (
                        <div key={r.key} className="flex items-center gap-2 text-xs">
                            <span className="w-28 text-slate-600 dark:text-slate-300">{r.label}</span>
                            <div className="flex-1 relative h-4 rounded bg-slate-100 dark:bg-slate-800">
                                <div className="absolute h-4 rounded bg-amber-500/80" style={{ left: `${(r.startMonth / s.totalMonths) * 100}%`, width: `${((r.endMonth - r.startMonth) / s.totalMonths) * 100}%` }} />
                            </div>
                            <span className="w-10 text-right tabular-nums text-slate-500">{r.months}mo</span>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}

/* ── L7 Commissioning ── */
export function CommissioningDashboard() {
    const m = rzModels().commissioning;
    if (!m) return <Loading />;
    // sample readiness for a mid-construction project (L1-L4 done, L5/IST/SAT in progress)
    const completion = { L1: 1, L2: 1, L3: 1, L4: 0.8, L5: 0.4, ist: 0.3, sat: 0.2, fat: 0.6, punchlist: 0.1 };
    const r = m.readinessIndex(completion);
    return (
        <div className="space-y-4">
            <Head icon={CheckCircle2} title="Commissioning" sub="DC-OS Layer 7 · models.commissioning" tone="from-emerald-500 to-teal-600"
                report={() => ({
                    title: 'Commissioning', layer: 'Layer 7 · Operational Readiness', project: '—',
                    kpis: [{ label: 'Readiness Index', value: `${r.index}%`, sub: r.status }, { label: 'Open Items', value: String(r.open.length) }, { label: 'Coverage', value: `${Math.round(r.coverage * 100)}%` }],
                    sections: [{ title: 'Cx Level Completion', head: ['Level', 'Completion'], rows: r.breakdown.map((b: { label: string; completion: number }) => [b.label, `${Math.round(b.completion * 100)}%`]) }],
                    note: 'Sample readiness profile — link to the live Cx checklist as commissioning progresses.',
                })} />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Metric label="Operational Readiness" value={`${r.index}%`} sub={r.status} />
                <Metric label="Open Items" value={String(r.open.length)} sub="categories" />
                <Metric label="Coverage" value={`${Math.round(r.coverage * 100)}%`} />
            </div>
            <Card>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Cx Level Completion</h2>
                <div className="space-y-1.5">
                    {r.breakdown.map((b: { key: string; label: string; completion: number }) => (
                        <div key={b.key} className="flex items-center gap-2 text-xs">
                            <span className="w-40 text-slate-600 dark:text-slate-300">{b.label}</span>
                            <div className="flex-1 h-2 rounded bg-slate-100 dark:bg-slate-800"><div className={`h-2 rounded ${b.completion >= 1 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${b.completion * 100}%` }} /></div>
                            <span className="w-10 text-right tabular-nums text-slate-500">{Math.round(b.completion * 100)}%</span>
                        </div>
                    ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-400">Sample readiness profile — link to the live Cx checklist as commissioning progresses.</p>
            </Card>
        </div>
    );
}

/* ── L9 Asset Intelligence ── */
export function AssetIntelDashboard() {
    const { inputs } = useCfg();
    const m = rzModels().asset;
    if (!m) return <Loading />;
    const comps = ['upsLiIon', 'generator', 'crac', 'pdu', 'bms', 'fire'];
    const rows = comps.map((k) => m.replacementSchedule(k, inputs.itLoad, 15)).filter(Boolean);
    const health = m.healthIndex({ assetClass: 'ups', ageYears: 3, condition: 0.9, duty: 0.6 });
    return (
        <div className="space-y-4">
            <Head icon={Activity} title="Asset Intelligence" sub="DC-OS Layer 9 · models.asset" tone="from-blue-500 to-violet-600"
                report={() => ({
                    title: 'Asset Intelligence', layer: 'Layer 9 · Asset Health & Lifecycle', project: '—',
                    kpis: [{ label: 'Sample Health (UPS 3yr)', value: `${health.health}/100`, sub: health.status }, { label: 'Remaining Life', value: `${health.remainingYears} yr`, sub: `of ${health.designLifeYears}` }, { label: 'Tracked Assets', value: String(rows.length) }],
                    sections: [{ title: '15-Year Replacement Schedule', head: ['Asset', 'Interval', 'Events', 'Nominal $M'], rows: rows.map((r: { label: string; intervalYears: number; events: number; totalNominalUsd: number }) => [r.label, `${r.intervalYears}yr`, r.events, (r.totalNominalUsd / 1e6).toFixed(2)]) }],
                    note: 'Screening health + lifecycle model — not a condition survey.',
                })} />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Metric label="Sample Health (UPS 3yr)" value={`${health.health}/100`} sub={health.status} />
                <Metric label="Remaining Life" value={`${health.remainingYears} yr`} sub={`of ${health.designLifeYears}`} />
                <Metric label="Tracked Assets" value={String(rows.length)} sub="15-yr horizon" />
            </div>
            <Card>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">15-Year Replacement Schedule</h2>
                <table className="w-full text-xs">
                    <thead><tr className="text-[10px] uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800"><th className="text-left py-1">Asset</th><th className="text-right">Interval</th><th className="text-right">Events</th><th className="text-right">Nominal $</th></tr></thead>
                    <tbody>
                        {rows.map((r: { component: string; label: string; intervalYears: number; events: number; totalNominalUsd: number }) => (
                            <tr key={r.component} className="border-b border-slate-100 dark:border-slate-800/50">
                                <td className="py-1.5 text-slate-700 dark:text-slate-200">{r.label}</td>
                                <td className="text-right tabular-nums text-slate-500">{r.intervalYears}yr</td>
                                <td className="text-right tabular-nums text-slate-500">{r.events}</td>
                                <td className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">${(r.totalNominalUsd / 1e6).toFixed(2)}M</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}
