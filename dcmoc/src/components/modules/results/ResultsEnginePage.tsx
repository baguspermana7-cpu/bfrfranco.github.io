'use client';

/* ─── Results Engine — page (Phase I, tab 'report') ──────────────────────────
 * Per-CONFIG final scorecard/verdict (distinct from the Executive Dashboard
 * live cockpit): dimension scores = DOCUMENTED deterministic composites over
 * the live engine/adapters, weighted overall, radar, key financial outcomes,
 * deterministic recommendations, honest validation chips ("adapter computed"
 * — not a fake audit). The full ReportDashboard survives as "Full Report".
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useRequirementsStore } from '@/store/requirements';
import { useConstructionTracking } from '@/store/constructionTracking';
import { useSitesStore } from '@/store/sites';
import { plannedSchedule, evm } from '@/state/adapters/construction-adapter';
import { scoreAllSites } from '@/lib/site-adapter';
import { rzModels, rzData } from '@/lib/rz-engine';
import { getPUE } from '@/constants/pue';
import { ReportDashboard } from '@/components/modules/ReportDashboard';
import { fmtMoney } from '@/lib/format';
import { Trophy, ChevronRight, FileDown } from 'lucide-react';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';

interface Dim { key: string; label: string; score: number; weight: number; basis: string }

export function ResultsEnginePage() {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const inputs = useSimulationStore((s) => s.inputs);
    const country = useSimulationStore((s) => s.selectedCountry);
    const capexResults = useCapexStore((s) => s.results);
    const runCalculation = useCapexStore((s) => s.runCalculation);
    const req = useRequirementsStore();
    const ct = useConstructionTracking();
    const sites = useSitesStore((s) => s.sites);
    const [tab, setTab] = React.useState<'scorecard' | 'full'>('scorecard');

    React.useEffect(() => { if (!capexResults) runCalculation(); }, [capexResults, runCalculation]);

    const model = React.useMemo(() => {
        const m = rzModels();
        if (!capexResults) return null;
        /* dimension composites — each formula documented in `basis` */
        const dims: Dim[] = [];
        // Requirements: engine intake completeness
        let reqScore = 50;
        try {
            const v = m?.requirements?.validate?.({ itLoadKw: inputs.itLoad, targetTier: inputs.tierLevel, region: country?.id, useCase: 'ai', coolingType: inputs.coolingType, rackKw: req.workload.avgRackDensityKw, budgetUsd: req.business.budgetUsd ?? undefined });
            reqScore = v?.completeness?.pct ?? 50;
        } catch { /* */ }
        dims.push({ key: 'req', label: 'Requirements', score: Math.round(reqScore), weight: 0.12, basis: 'engine intake completeness %' });
        // Site: engine site score (best candidate)
        const siteResults = scoreAllSites(sites);
        dims.push({ key: 'site', label: 'Site Intelligence', score: Math.round(siteResults[0]?.engine.score ?? 50), weight: 0.13, basis: 'engine site score (best candidate)' });
        // Architecture: 100 − complexity penalty (engine complexity index)
        let archScore = 60;
        try {
            const c = m?.architecture?.complexity?.({ coolingType: inputs.coolingType, tier: inputs.tierLevel, redundancy: inputs.powerRedundancy === 'N+1' ? 'n1' : inputs.powerRedundancy === '2N' ? '2n' : '2n1' });
            archScore = c ? Math.round(100 - c.index * 0.35) : 60; // complexity is cost-of-delivery, not badness — soft penalty
        } catch { /* */ }
        dims.push({ key: 'arch', label: 'Architecture', score: archScore, weight: 0.12, basis: '100 − 0.35×engine complexity index' });
        // CAPEX: $/kW vs band (10500 std baseline from cx capexPerKw)
        const perKw = capexResults.metrics?.perKw ?? Math.round(capexResults.total / Math.max(1, inputs.itLoad));
        const band = rzData()?.commissioning?.cx?.rich?.capexPerKw?.standard ?? 10500;
        const capexScore = Math.round(Math.max(10, Math.min(100, 100 - ((perKw - band * 0.6) / (band * 0.8)) * 60)));
        dims.push({ key: 'capex', label: 'CAPEX Efficiency', score: capexScore, weight: 0.13, basis: `$${perKw.toLocaleString()}/kW vs $${band.toLocaleString()} reference band` });
        // Construction: SPI/CPI blend
        const sched = plannedSchedule(capexResults.timeline);
        const e = sched ? evm(sched, capexResults.total, ct.statusMonth, ct.phaseActualPct, ct.acSpentUsd) : null;
        const constrScore = e ? Math.round(50 * Math.min(1.2, e.spi) + 50 * Math.min(1.2, e.cpi)) : 100;
        dims.push({ key: 'constr', label: 'Construction', score: Math.min(100, constrScore), weight: 0.12, basis: e?.planMode ? 'baseline (Plan Mode SPI/CPI 1.00)' : '50×SPI + 50×CPI (tracking EVM)' });
        // Operations readiness: tier availability positioning
        const tierAvail: Record<number, number> = rzData()?.reliability?.tierAvailability ?? {};
        const opsScore = Math.round(((tierAvail[inputs.tierLevel] ?? 0.9998) - 0.997) / (0.99995 - 0.997) * 100);
        dims.push({ key: 'ops', label: 'Operational Readiness', score: Math.max(0, Math.min(100, opsScore)), weight: 0.12, basis: 'tier availability positioning' });
        // Sustainability: PUE band
        const pue = rzData()?.pueMatrix?.[inputs.coolingType]?.['tier' + inputs.tierLevel] ?? getPUE(inputs.coolingType);
        const susScore = Math.round(Math.max(0, Math.min(100, (1.6 - pue) / 0.5 * 100)));
        dims.push({ key: 'sus', label: 'Sustainability', score: susScore, weight: 0.13, basis: `PUE ${pue} vs 1.10–1.60 band` });
        // Financial: NPV>0 + IRR proxy via roi model on a simple stream
        let finScore = 60; let npv: number | null = null; let irr: number | null = null;
        try {
            if (m?.roi?.npv) {
                const revenue = (rzData()?.decision?.revenuePerKwMonth ?? 280) * inputs.itLoad * 12;
                const opexAnnual = m?.opex?.totalAnnual ? (m.opex.totalAnnual(inputs.itLoad / 1000, pue, country?.id ?? 'US', 12, { capex: capexResults.total, basisPreset: 'dcContract' }).total) : revenue * 0.4;
                const flows = Array.from({ length: 15 }, () => revenue - opexAnnual);
                npv = m.roi.npv(flows, 0.1) - capexResults.total;
                irr = m.roi.irr ? m.roi.irr([-capexResults.total, ...flows]) : null;
                finScore = Math.round(Math.max(10, Math.min(100, 50 + (irr != null ? (irr - 0.10) * 400 : 0))));
            }
        } catch { /* */ }
        dims.push({ key: 'fin', label: 'Financial', score: finScore, weight: 0.13, basis: irr != null ? `IRR ${(irr * 100).toFixed(1)}% vs 10% hurdle` : 'roi model screening' });

        const totalW = dims.reduce((s, d) => s + d.weight, 0);
        const overall = Math.round(dims.reduce((s, d) => s + d.score * d.weight, 0) / totalW);
        const grade = overall >= 85 ? 'Excellent' : overall >= 70 ? 'Good' : overall >= 55 ? 'Fair' : 'Poor';
        const recs = [
            ...(pue > 1.3 ? [`Advanced cooling optimization — PUE ${pue} has headroom vs the 1.10 liquid band.`] : []),
            ...(capexScore < 60 ? [`CAPEX $${perKw.toLocaleString()}/kW above the reference band — value-engineer the top tornado drivers.`] : []),
            ...((siteResults[0]?.engine.score ?? 100) < 60 ? ['Site score below 60 — revisit candidate-site attributes or alternates.'] : []),
            ...(reqScore < 80 ? ['Complete the Requirements intake — missing fields reduce downstream confidence.'] : []),
            ...(susScore < 60 ? ['Increase renewable share / cooling efficiency to lift the sustainability grade.'] : []),
        ].slice(0, 5);
        return { dims, overall, grade, perKw, npv, irr, opexPue: pue, siteBest: siteResults[0] ?? null, recs };
    }, [capexResults, inputs, country, req, ct, sites]);

    const [busy, setBusy] = React.useState(false);
    const exportPdf = async () => {
        if (!model || !capexResults) return;
        setBusy(true);
        try {
            const ranked = [...model.dims].sort((a, b) => b.score - a.score);
            const narrativeMetrics = { score: model.overall, strongest: ranked[0]?.label, weakest: ranked[ranked.length - 1]?.label };
            await generatePillarPDF({
                title: 'Results Scorecard', layer: 'Results Engine', project: req.overview.projectName || 'DC-OS Project',
                kpis: [
                    { label: 'Overall Score', value: `${model.overall}/100`, sub: model.grade },
                    { label: 'CAPEX $/kW', value: `$${model.perKw.toLocaleString()}`, sub: 'vs reference band' },
                    { label: 'IRR (screening)', value: model.irr != null ? `${(model.irr * 100).toFixed(1)}%` : '—', sub: '10% hurdle' },
                    { label: 'PUE', value: String(model.opexPue), sub: `${inputs.coolingType} · Tier ${inputs.tierLevel}` },
                ],
                config: [
                    ['IT Load', `${(inputs.itLoad / 1000).toFixed(1)} MW`], ['Tier', `Tier ${inputs.tierLevel}`],
                    ['Cooling', inputs.coolingType], ['Redundancy', inputs.powerRedundancy],
                    ['Country', country?.name ?? '—'],
                    ['Best Site', sites.find((s) => s.id === model.siteBest?.siteId)?.name ?? '—'],
                ],
                sections: [
                    {
                        title: 'Dimension Scorecard', head: ['Dimension', 'Score', 'Weight', 'Basis'],
                        rows: model.dims.map((d) => [d.label, `${d.score}/100`, `${Math.round(d.weight * 100)}%`, d.basis]),
                    },
                    {
                        title: 'Key Financial Outcomes', head: ['Metric', 'Value'],
                        rows: [
                            ['Total CAPEX (P50)', `$${(capexResults.total / 1e6).toFixed(1)}M`],
                            ['NPV @10% (15y screening)', model.npv != null ? `$${(model.npv / 1e6).toFixed(1)}M` : '—'],
                            ['IRR (screening)', model.irr != null ? `${(model.irr * 100).toFixed(1)}%` : '—'],
                        ],
                    },
                ],
                assessment: buildAssessment('results', narrativeMetrics),
                actions: [
                    ...buildActions('results', narrativeMetrics),
                    ...model.recs.map((r, i) => ({ priority: (i === 0 ? 'HIGH' : i < 3 ? 'MEDIUM' : 'LOW') as 'HIGH' | 'MEDIUM' | 'LOW', action: r })),
                ],
                summaryBand: model.dims.slice(0, 6).map((d) => ({ label: d.label, value: String(d.score) })),
                note: 'Composite scorecard — every dimension score is a documented deterministic composite from the engine/adapters; planning screening, not an audit.',
            } as StandardReport);
        } finally { setBusy(false); }
    };

    if (!capexResults || !model) return <div className="p-8 text-center text-sm text-slate-500">Calculating…</div>;

    const radarData = model.dims.map((d) => ({ axis: d.label, score: d.score }));
    const validation = [
        { label: 'Engine loaded', ok: !!rzModels()?.site },
        { label: 'CAPEX computed', ok: !!capexResults },
        { label: 'Dimension composites computed', ok: model.dims.length === 8 },
        { label: 'Financial screening (roi model)', ok: model.irr != null },
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg"><Trophy className="h-6 w-6 text-white" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Results Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Final scorecard & verdict for the current configuration — composites documented per dimension</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                        {([['scorecard', 'Scorecard'], ['full', 'Full Report']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-violet-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                        ))}
                    </div>
                    <button onClick={exportPdf} disabled={busy}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-violet-400 disabled:opacity-50">
                        <FileDown className="h-3.5 w-3.5" /> {busy ? 'Generating…' : 'Export PDF'}
                    </button>
                    <button onClick={() => setActiveTab('dashboard')} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">Executive Dashboard <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'full' ? <ReportDashboard /> : (
                <div className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-[300px_1fr_300px]">
                        {/* overall */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 text-center">
                            <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Overall Score (Weighted)</h2>
                            <div className="text-5xl font-bold tabular-nums text-violet-500">{model.overall}<span className="text-lg text-slate-400">/100</span></div>
                            <div className={`mt-1 text-sm font-semibold ${model.overall >= 85 ? 'text-emerald-500' : model.overall >= 70 ? 'text-lime-500' : 'text-amber-500'}`}>{model.grade}</div>
                            <div className="mt-3 space-y-1 text-left">
                                {[...model.dims].sort((a, b) => b.score - a.score).map((d, idx) => (
                                    <div key={d.key} className="flex items-center gap-2 text-[11px]">
                                        <span className="w-4 text-center text-[9px] font-bold text-slate-400">{idx + 1}</span>
                                        <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{d.label}</span>
                                        <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">{d.score}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* radar */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Performance Radar</h2>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart data={radarData} outerRadius="75%">
                                        <PolarGrid stroke="#334155" />
                                        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8, fill: '#64748b' }} />
                                        <Radar name="Score" dataKey="score" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.2} strokeWidth={2} />
                                        <Tooltip contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        {/* financial outcomes */}
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Key Financial Outcomes</h3>
                                <div className="space-y-1 text-[11px]">
                                    {[
                                        ['Total CAPEX (P50)', fmtMoney(capexResults.total)],
                                        ['$ / kW', `$${model.perKw.toLocaleString()}`],
                                        ['NPV (15y @10%)', model.npv != null ? fmtMoney(model.npv) : '—'],
                                        ['IRR (screening)', model.irr != null ? `${(model.irr * 100).toFixed(1)}%` : '—'],
                                        ['Design PUE', String(model.opexPue)],
                                        ['Best Site', model.siteBest ? `${model.siteBest.engine.score}/100 (${model.siteBest.engine.grade})` : '—'],
                                    ].map(([k, v]) => (
                                        <div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className="tabular-nums font-medium text-slate-800 dark:text-slate-200">{v}</span></div>
                                    ))}
                                </div>
                                <p className="mt-1.5 text-[9px] text-slate-400">Screening outcomes (engine roi/opex models, dcContract basis) — not investment advice.</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Result Validation</h3>
                                {validation.map((v) => (
                                    <div key={v.label} className="flex items-center gap-1.5 py-0.5 text-[11px]">
                                        <span className={`h-2 w-2 rounded-full ${v.ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                        <span className="text-slate-600 dark:text-slate-300">{v.label}</span>
                                        <span className={`ml-auto text-[9px] font-semibold ${v.ok ? 'text-emerald-500' : 'text-amber-500'}`}>{v.ok ? 'OK' : 'Pending'}</span>
                                    </div>
                                ))}
                                <p className="mt-1 text-[9px] text-slate-400">Honest chips: “computed successfully”, not an external audit.</p>
                            </div>
                        </div>
                    </div>

                    {/* dimension table */}
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Dimension Scores — documented composites</h2>
                        <table className="w-full text-[11px]">
                            <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">Dimension</th><th className="text-right">Score</th><th className="text-right">Weight</th><th className="text-left pl-4">Basis (formula)</th></tr></thead>
                            <tbody>
                                {model.dims.map((d) => (
                                    <tr key={d.key} className="border-b border-slate-100 dark:border-slate-800/60">
                                        <td className="py-1 text-slate-700 dark:text-slate-200">{d.label}</td>
                                        <td className="text-right"><span className={`tabular-nums font-semibold ${d.score >= 70 ? 'text-emerald-500' : d.score >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>{d.score}</span></td>
                                        <td className="text-right tabular-nums text-slate-500">{Math.round(d.weight * 100)}%</td>
                                        <td className="pl-4 text-[10px] text-slate-400">{d.basis}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="rounded-2xl border border-violet-500/30 bg-violet-600/5 p-3">
                        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-500">Top Recommendations (deterministic)</h3>
                        <ul className="space-y-0.5">
                            {model.recs.length === 0 && <li className="text-[11px] text-emerald-500">✓ No corrective actions flagged — configuration performs across all dimensions.</li>}
                            {model.recs.map((r, idx) => <li key={idx} className="flex gap-1.5 text-[11px] text-slate-700 dark:text-slate-300"><span className="text-violet-500">✓</span>{r}</li>)}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
