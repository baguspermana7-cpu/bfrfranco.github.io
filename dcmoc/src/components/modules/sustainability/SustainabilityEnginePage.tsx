'use client';

/* ─── Sustainability Engine — page (Phase M, tab 'carbon') ───────────────────
 * Engine-real core: GHG scopes (models.carbon.scopes), WUE water volumes,
 * PUE from the matrix, energy mix from the capex renewable/cert inputs
 * (labeled derivation). Initiatives + certifications = user-attested store
 * (EXAMPLE seeds, Plan Mode). Old CarbonDashboard kept as "Carbon / ESG
 * Detail" tab.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useSustainability } from '@/store/sustainability';
import { rzModels, rzData } from '@/lib/rz-engine';
import { getPUE } from '@/constants/pue';
import CarbonDashboard from '@/components/modules/CarbonDashboard';
import { Leaf, ChevronRight, FileDown } from 'lucide-react';
import { Explain } from '@/components/ui/Explain';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';

const SCOPE_COLORS = ['#f59e0b', '#a78bfa', '#64748b'];
const MIX_COLORS = ['#34d399', '#22d3ee', '#64748b'];

export function SustainabilityEnginePage() {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const inputs = useSimulationStore((s) => s.inputs);
    const country = useSimulationStore((s) => s.selectedCountry);
    const capexInputs = useCapexStore((s) => s.inputs);
    const sus = useSustainability();
    const [tab, setTab] = React.useState<'overview' | 'detail'>('overview');

    const model = React.useMemo(() => {
        const m = rzModels();
        const mw = inputs.itLoad / 1000;
        const pue = rzData()?.pueMatrix?.[inputs.coolingType]?.['tier' + inputs.tierLevel] ?? getPUE(inputs.coolingType);
        const monthlyMwh = Math.round(mw * pue * 730);
        let scopes: { scope1: number; scope2: number; scope3Annual: number; totalAnnual: number; scope2Pct: number } | null = null;
        try { if (m?.carbon?.scopes) scopes = m.carbon.scopes({ mw, pue, region: country?.id ?? 'US', capexUsd: 0 }); } catch { /* */ }
        let waterM3Yr: number | null = null;
        try { if (m?.water?.annualM3) waterM3Yr = Math.round(m.water.annualM3(mw, inputs.coolingType)); } catch { /* */ }
        /* energy mix — DERIVED from the capex renewable/cert inputs (labeled):
         * solar+bess → 25% on-site; solar → 15%; green cert gold/platinum adds
         * 20/35% off-site PPA assumption; remainder = grid. */
        const ren = capexInputs.renewableOption ?? 'none';
        const cert = capexInputs.greenCert ?? 'none';
        const onSite = ren === 'solar_bess' ? 25 : ren === 'solar' ? 15 : 0;
        const offSite = cert === 'platinum' ? 35 : cert === 'gold' ? 20 : cert === 'silver' ? 10 : 0;
        const grid = Math.max(0, 100 - onSite - offSite);
        const renewablePct = onSite + offSite;
        /* scorecard composites (documented) */
        const energyScore = Math.round(Math.max(0, Math.min(100, (1.6 - pue) / 0.5 * 100)));
        const gi = country?.environment?.gridCarbonIntensity ?? 0.7;
        const carbonScore = Math.round(Math.max(0, Math.min(100, (0.9 - gi * (grid / 100)) / 0.9 * 100)));
        const wue = m?.water?.wue ? m.water.wue(inputs.coolingType) : 1.8;
        const waterScore = Math.round(Math.max(0, Math.min(100, (2.2 - wue) / 2.2 * 100)));
        const wasteScore = sus.wasteDiversionPct != null ? Math.round(sus.wasteDiversionPct) : null;
        const overall = Math.round((energyScore + carbonScore + waterScore + (wasteScore ?? 60)) / 4);
        const grade = overall >= 85 ? 'A' : overall >= 70 ? 'B' : overall >= 55 ? 'C' : 'D';
        return { mw, pue, monthlyMwh, scopes, waterM3Yr, mix: [{ name: 'Renewable (on-site)', v: onSite }, { name: 'Renewable (off-site PPA)', v: offSite }, { name: 'Grid Electricity', v: grid }].filter((x) => x.v > 0), renewablePct, energyScore, carbonScore, waterScore, wasteScore, overall, grade, wue };
    }, [inputs, country, capexInputs.renewableOption, capexInputs.greenCert, sus.wasteDiversionPct]);

    const scopeDonut = model.scopes ? [
        { name: 'Scope 1', v: model.scopes.scope1 }, { name: 'Scope 2 (location-based)', v: model.scopes.scope2 }, { name: 'Scope 3 (annualized)', v: model.scopes.scope3Annual },
    ] : [];
    const [busy, setBusy] = React.useState(false);

    const exportPdf = async () => {
        setBusy(true);
        try {
            const susMetrics = { pue: model.pue, renewablePct: model.renewablePct };
            await generatePillarPDF({
                title: 'Sustainability', layer: 'Sustainability Engine', project: '—',
                kpis: [
                    { label: 'PUE (Design)', value: String(model.pue), sub: `${inputs.coolingType} · Tier ${inputs.tierLevel}` },
                    { label: 'Energy (Month)', value: `${model.monthlyMwh.toLocaleString()} MWh`, sub: `${model.mw.toFixed(1)} MW × PUE × 730h` },
                    { label: 'Carbon (Annual)', value: model.scopes ? `${Math.round(model.scopes.totalAnnual).toLocaleString()} tCO₂e` : '—', sub: 'GHG Protocol scopes (engine)' },
                    { label: 'Water (Annual)', value: model.waterM3Yr != null ? `${model.waterM3Yr.toLocaleString()} m³` : '—', sub: `WUE ${model.wue} L/kWh (engine)` },
                    { label: 'Renewable Energy', value: `${model.renewablePct}%`, sub: 'derived from capex renewable/cert inputs' },
                    { label: 'Sustainability Score', value: model.grade, sub: `${model.overall}/100 · documented composite` },
                ],
                sections: [
                    ...(scopeDonut.length ? [{ title: 'Carbon Footprint (GHG scopes · engine)', head: ['Scope', 'tCO₂e / yr'], rows: scopeDonut.map((r) => [r.name, Math.round(r.v).toLocaleString()]) }] : []),
                    { title: 'Energy Mix (derived from capex renewable + certification inputs)', head: ['Source', 'Share'], rows: model.mix.map((r) => [r.name, `${r.v}%`]) },
                    {
                        title: 'Sustainability Scorecard (documented composites)', head: ['Dimension', 'Score /100'], rows: [
                            ['Energy Efficiency (PUE band)', String(model.energyScore)],
                            ['Carbon Management (grid × mix)', String(model.carbonScore)],
                            ['Water Stewardship (WUE band)', String(model.waterScore)],
                            ['Waste Management', model.wasteScore != null ? String(model.wasteScore) : '—'],
                        ],
                    },
                    { title: 'Initiatives in Progress', head: ['Category', 'Initiative', 'Progress', 'Status'], rows: sus.initiatives.map((i) => [i.category, i.title, `${i.progressPct}%`, i.status]) },
                ],
                callouts: [
                    {
                        title: `Sustainability Score ${model.grade} — ${model.overall}/100`,
                        body: `Documented composite of energy (${model.energyScore}), carbon (${model.carbonScore}), water (${model.waterScore}) and waste (${model.wasteScore ?? '—'}) scores.`,
                        tone: model.overall >= 70 ? ('good' as const) : model.overall >= 55 ? ('info' as const) : ('warn' as const),
                    },
                    {
                        title: 'Energy mix derivation',
                        body: 'Energy mix is DERIVED from the capex renewable/certification inputs (labeled assumption): solar+BESS → 25% on-site, solar → 15%; green cert silver/gold/platinum adds 10/20/35% off-site PPA; remainder = grid.',
                        tone: 'info' as const,
                    },
                ],
                assessment: buildAssessment('sustainability', susMetrics),
                actions: buildActions('sustainability', susMetrics),
                summaryBand: [
                    { label: 'PUE', value: String(model.pue) },
                    { label: 'Renewable', value: `${model.renewablePct}%` },
                    { label: 'Carbon /yr', value: model.scopes ? `${Math.round(model.scopes.totalAnnual).toLocaleString()} t` : '—' },
                    { label: 'WUE', value: `${model.wue} L/kWh` },
                    { label: 'Overall', value: `${model.overall}/100` },
                ],
                note: 'GHG scopes, WUE water volumes and PUE engine-real; energy mix derived from capex renewable/cert inputs (labeled); initiatives & certifications user-attested.',
            } as StandardReport);
        } finally { setBusy(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg"><Leaf className="h-6 w-6 text-white" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sustainability Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">GHG scopes, energy & water — engine-real; initiatives & certifications user-attested</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                        {([['overview', 'Overview'], ['detail', 'Carbon / ESG Detail']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                        ))}
                    </div>
                    <button onClick={exportPdf} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-violet-400"><FileDown className="h-3.5 w-3.5" />{busy ? '…' : 'Export'}</button>
                    <button onClick={() => setActiveTab('finance')} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">Next: Financial <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'detail' ? <CarbonDashboard /> : (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                            { label: 'PUE (Design)', value: String(model.pue), sub: `${inputs.coolingType} · Tier ${inputs.tierLevel}`, explain: 'pue' },
                            { label: 'Energy (Month)', value: `${model.monthlyMwh.toLocaleString()} MWh`, sub: `${model.mw.toFixed(1)} MW × PUE × 730h` },
                            { label: 'Carbon (Annual)', value: model.scopes ? `${Math.round(model.scopes.totalAnnual).toLocaleString()} tCO₂e` : '—', sub: 'GHG Protocol scopes (engine)' },
                            { label: 'Water (Annual)', value: model.waterM3Yr != null ? `${model.waterM3Yr.toLocaleString()} m³` : '—', sub: `WUE ${model.wue} L/kWh (engine)`, explain: 'wue' },
                            { label: 'Renewable Energy', value: `${model.renewablePct}%`, sub: 'derived from capex renewable/cert inputs' },
                            { label: 'Sustainability Score', value: model.grade, sub: `${model.overall}/100 · documented composite` },
                        ].map((k) => (
                            <div key={k.label} title={`${k.label}: ${k.value}${(k as {sub?: string}).sub ? " — " + (k as {sub?: string}).sub : ""}`} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label} {(k as { explain?: string }).explain && <Explain k={(k as { explain?: string }).explain!} />}</div>
                                <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                <div className="truncate text-[10px] text-slate-500">{k.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Carbon Footprint (GHG scopes · engine)</h2>
                            {model.scopes ? (
                                <div className="flex items-center gap-2">
                                    <div className="h-32 w-32 shrink-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={scopeDonut} dataKey="v" nameKey="name" innerRadius={28} outerRadius={48} paddingAngle={2}>
                                                    {scopeDonut.map((_, idx) => <Cell key={idx} fill={SCOPE_COLORS[idx]} />)}
                                                </Pie>
                                                <Tooltip formatter={(v) => `${Math.round(Number(v)).toLocaleString()} tCO₂e`} contentStyle={{ fontSize: 10 }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex-1 space-y-0.5">
                                        {scopeDonut.map((r, idx) => (
                                            <div key={r.name} className="flex items-center gap-1.5 text-[10px]">
                                                <span className="h-2 w-2 rounded-sm" style={{ background: SCOPE_COLORS[idx] }} />
                                                <span className="text-slate-600 dark:text-slate-300">{r.name}</span>
                                                <span className="ml-auto tabular-nums text-slate-500">{Math.round(r.v).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : <p className="text-xs text-slate-500">Engine loading…</p>}
                        </div>
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Energy Mix <span className="text-[9px] normal-case text-slate-400">derived from capex renewable + certification inputs</span></h2>
                            <div className="flex items-center gap-2">
                                <div className="h-32 w-32 shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={model.mix} dataKey="v" nameKey="name" innerRadius={28} outerRadius={48} paddingAngle={2}>
                                                {model.mix.map((_, idx) => <Cell key={idx} fill={MIX_COLORS[idx]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => `${v}%`} contentStyle={{ fontSize: 10 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex-1 space-y-0.5">
                                    {model.mix.map((r, idx) => (
                                        <div key={r.name} className="flex items-center gap-1.5 text-[10px]">
                                            <span className="h-2 w-2 rounded-sm" style={{ background: MIX_COLORS[idx] }} />
                                            <span className="text-slate-600 dark:text-slate-300">{r.name}</span>
                                            <span className="ml-auto tabular-nums text-slate-500">{r.v}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sustainability Scorecard <span className="text-[9px] normal-case text-slate-400">documented composites</span></h2>
                            <div className="space-y-1.5">
                                {[
                                    ['Energy Efficiency (PUE band)', model.energyScore],
                                    ['Carbon Management (grid × mix)', model.carbonScore],
                                    ['Water Stewardship (WUE band)', model.waterScore],
                                    ['Waste Management', model.wasteScore],
                                ].map(([label, v]) => (
                                    <div key={label as string} className="flex items-center gap-2 text-[11px]">
                                        <span className="w-40 truncate text-slate-600 dark:text-slate-300">{label}</span>
                                        <div className="h-1.5 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                                            {v != null && <div className={`h-1.5 rounded ${(v as number) >= 70 ? 'bg-emerald-500' : (v as number) >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${v}%` }} />}
                                        </div>
                                        <span className="w-9 text-right tabular-nums text-slate-500">{v != null ? `${v}` : '—'}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                                <span className="text-slate-500">Waste diversion</span>
                                <input type="range" min={0} max={100} step={5} value={sus.wasteDiversionPct ?? 0}
                                    onChange={(e) => sus.actions.set({ wasteDiversionPct: Number(e.target.value) })} className="flex-1 accent-violet-500" />
                                <span className="w-9 text-right tabular-nums text-slate-500">{sus.wasteDiversionPct != null ? `${sus.wasteDiversionPct}%` : '—'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Initiatives in Progress {sus.touched ? '' : <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-semibold text-amber-500">EXAMPLE</span>}</h2>
                        <div className="space-y-1.5">
                            {sus.initiatives.map((i) => (
                                <div key={i.id} className="flex items-center gap-2 text-[11px]">
                                    <span className="w-16 rounded bg-slate-500/10 px-1 py-0.5 text-center text-[9px] text-slate-500">{i.category}</span>
                                    <span className="w-52 truncate text-slate-700 dark:text-slate-200">{i.title}</span>
                                    <input type="range" min={0} max={100} step={5} value={i.progressPct}
                                        onChange={(e) => sus.actions.setInitiativeProgress(i.id, Number(e.target.value))} className="flex-1 accent-violet-500" />
                                    <span className="w-9 text-right tabular-nums text-slate-500">{i.progressPct}%</span>
                                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${i.status === 'On Track' ? 'bg-emerald-500/15 text-emerald-500' : i.status === 'At Risk' ? 'bg-amber-500/15 text-amber-500' : 'bg-slate-500/15 text-slate-400'}`}>{i.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Compliance & Standards <span className="text-[9px] normal-case text-slate-400">user-attested status</span></h2>
                        <div className="grid gap-1.5 md:grid-cols-3">
                            {sus.certs.map((c) => (
                                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 text-[11px]">
                                    <span className="flex-1 truncate text-slate-700 dark:text-slate-200">{c.name}</span>
                                    <select className="rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1 py-0.5 text-[9px] text-slate-500"
                                        value={c.status} onChange={(e) => sus.actions.upsertCert({ ...c, status: e.target.value as typeof c.status })}>
                                        {['Planned', 'In Progress', 'Compliant', 'Certified'].map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
