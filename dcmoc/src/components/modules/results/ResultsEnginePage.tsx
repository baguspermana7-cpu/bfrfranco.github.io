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
import { TraceValue } from '@/components/ui/TraceValue';
import { ScoreValue } from '@/components/ui/ScoreValue';
import { Tooltip as InfoTip } from '@/components/ui/Tooltip';
import { Trophy, ChevronRight, FileDown } from 'lucide-react';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';
import {
    capexScoreOf, susScoreOf, finScoreOf, constrScoreOf, opsScoreOf, archScoreOf,
    finScreening, explainDimension, explainOverall, DIM_CHIP_FLOOR, GRADE_B_FLOOR,
    type DimContext, type DimKey,
} from './dimension-explain';

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
        // Requirements: engine intake completeness (intake object captured for the explain panel)
        const intake = { itLoadKw: inputs.itLoad, targetTier: inputs.tierLevel, region: country?.id, useCase: 'ai', coolingType: inputs.coolingType, rackKw: req.workload.avgRackDensityKw, budgetUsd: req.business.budgetUsd ?? undefined };
        let reqScore = 50; let reqMissing: string[] = [];
        try {
            const v = m?.requirements?.validate?.(intake);
            reqScore = v?.completeness?.pct ?? 50;
            reqMissing = v?.completeness?.missing ?? [];
        } catch { /* */ }
        dims.push({ key: 'req', label: 'Requirements', score: Math.round(reqScore), weight: 0.12, basis: 'engine intake completeness %' });
        // Site: engine site score (best candidate)
        const siteResults = scoreAllSites(sites);
        dims.push({ key: 'site', label: 'Site Intelligence', score: Math.round(siteResults[0]?.engine.score ?? 50), weight: 0.13, basis: 'engine site score (best candidate)' });
        // Architecture: 100 − complexity penalty (engine complexity index)
        // complexity is cost-of-delivery, not badness — soft penalty (archScoreOf, shared with explain)
        const redundancy = inputs.powerRedundancy === 'N+1' ? 'n1' : inputs.powerRedundancy === '2N' ? '2n' : '2n1';
        let archScore = 60; let complexityIndex: number | null = null;
        try {
            const c = m?.architecture?.complexity?.({ coolingType: inputs.coolingType, tier: inputs.tierLevel, redundancy });
            if (c) { complexityIndex = c.index; archScore = archScoreOf(c.index); }
        } catch { /* */ }
        dims.push({ key: 'arch', label: 'Architecture', score: archScore, weight: 0.12, basis: '100 − 0.35×engine complexity index' });
        // CAPEX: $/kW vs band (10500 std baseline from cx capexPerKw)
        const perKw = capexResults.metrics?.perKw ?? Math.round(capexResults.total / Math.max(1, inputs.itLoad));
        const band = rzData()?.commissioning?.cx?.rich?.capexPerKw?.standard ?? 10500;
        const capexScore = capexScoreOf(perKw, band);
        dims.push({ key: 'capex', label: 'CAPEX Efficiency', score: capexScore, weight: 0.13, basis: `$${perKw.toLocaleString()}/kW vs $${band.toLocaleString()} reference band` });
        // Construction: SPI/CPI blend
        const sched = plannedSchedule(capexResults.timeline);
        const e = sched ? evm(sched, capexResults.total, ct.statusMonth, ct.phaseActualPct, ct.acSpentUsd) : null;
        const constrScore = e ? constrScoreOf(e.spi, e.cpi) : 100;
        dims.push({ key: 'constr', label: 'Construction', score: constrScore, weight: 0.12, basis: e?.planMode ? 'baseline (Plan Mode SPI/CPI 1.00)' : '50×SPI + 50×CPI (tracking EVM)' });
        // Operations readiness: tier availability positioning
        const tierAvail: Record<number, number> = rzData()?.reliability?.tierAvailability ?? {};
        const opsScore = opsScoreOf(tierAvail[inputs.tierLevel] ?? 0.9998);
        dims.push({ key: 'ops', label: 'Operational Readiness', score: opsScore, weight: 0.12, basis: 'tier availability positioning' });
        // Sustainability: PUE band
        const pue = rzData()?.pueMatrix?.[inputs.coolingType]?.['tier' + inputs.tierLevel] ?? getPUE(inputs.coolingType);
        const susScore = susScoreOf(pue);
        dims.push({ key: 'sus', label: 'Sustainability', score: susScore, weight: 0.13, basis: `PUE ${pue} vs 1.10–1.60 band` });
        // Financial: NPV>0 + IRR proxy via roi model on a simple stream — the SAME
        // cashflow chain (finScreening) also powers the explain-panel lever solves.
        let finScore = 60; let npv: number | null = null; let irr: number | null = null;
        let fin: ReturnType<typeof finScreening> = null;
        try {
            fin = finScreening(inputs.itLoad, pue, country?.id ?? 'US', capexResults.total);
            if (fin) {
                npv = fin.npv;
                irr = fin.irr;
                finScore = finScoreOf(fin.irr);
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
        /* live context for the dimension-explain panels — everything above, nothing re-derived */
        const dimCtx: DimContext = {
            itLoadKw: inputs.itLoad, tier: inputs.tierLevel, coolingType: inputs.coolingType, redundancy,
            intake: intake as unknown as Record<string, unknown>, reqMissing,
            perKw, band, capexTotal: capexResults.total, pue,
            evm: e ? { spi: e.spi, cpi: e.cpi, planMode: e.planMode } : null,
            tierAvail, siteBest: siteResults[0] ?? null,
            siteName: sites.find((s) => s.id === siteResults[0]?.siteId)?.name,
            complexityIndex, fin,
        };
        return { dims, overall, grade, perKw, npv, irr, opexPue: pue, siteBest: siteResults[0] ?? null, recs, dimCtx };
    }, [capexResults, inputs, country, req, ct, sites]);

    const [busy, setBusy] = React.useState(false);

    /* ── Fair/Poor dimension chip → reason + solved-lever panel (dimension-explain) ── */
    const [dimOpen, setDimOpen] = React.useState<string | null>(null);
    const dimEx = React.useMemo(() => {
        if (!dimOpen || !model) return null;
        const d = model.dims.find((x) => x.key === dimOpen);
        return d ? explainDimension(d.key as DimKey, d.score, model.dimCtx) : null;
    }, [dimOpen, model]);
    /* ── overall grade < B ("Good") → two weakest dims + their top levers ── */
    const overallEx = React.useMemo(() => {
        if (!model || model.overall >= GRADE_B_FLOOR) return null;
        return explainOverall(model.dims, model.overall, model.grade, model.dimCtx);
    }, [model]);
    const goTab = (t: string) => { if (t) setActiveTab(t as never); };
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
                    { label: 'IRR (screening)', value: model.irr != null ? `${(model.irr * 100).toFixed(1)}%` : '—', sub: 'unlevered 15y flat · 10% hurdle' },
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
    /* audit #8: no actuals tracking (plan mode) ⇒ Construction (SPI/CPI≡1.00) and
     * Financial (screening pro-forma) dimension scores are BASELINE-definitional —
     * chip + composite footnote keep the perfect rows honest. Math unchanged. */
    const planBase = model.dimCtx.evm?.planMode ?? true;
    const baselineDimKeys = planBase ? ['constr', 'fin'] : [];
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
                    <div className="flex h-11 w-11 items-center justify-center rounded bg-rz-mint/15 border border-rz-mint/30"><Trophy className="h-6 w-6 text-rz-mint" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Results Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Final scorecard & verdict for the current configuration — composites documented per dimension</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
                        {([['scorecard', 'Scorecard'], ['full', 'Full Report']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs font-medium ${tab === k ? 'bg-rz-mint text-rz-base' : 'text-slate-600 dark:text-slate-300'}`}>{l}</button>
                        ))}
                    </div>
                    <button onClick={exportPdf} disabled={busy}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-rz-mint disabled:opacity-50">
                        <FileDown className="h-3.5 w-3.5" /> {busy ? 'Generating…' : 'Export PDF'}
                    </button>
                    <button onClick={() => setActiveTab('dashboard')} className="inline-flex items-center gap-1 rounded-lg bg-rz-mint px-3 py-1.5 text-xs font-semibold text-rz-base hover:bg-rz-mint/80">Executive Dashboard <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            {tab === 'full' ? <ReportDashboard /> : (
                <div className="space-y-4">
                    {/* #328 — on-page guidance beside the grade (same rubric as PDF). */}
                    {(() => {
                        const rankedD = [...model.dims].sort((a, b) => b.score - a.score);
                        const met = { score: model.overall, strongest: rankedD[0]?.label, weakest: rankedD[rankedD.length - 1]?.label };
                        const assess = buildAssessment('results', met);
                        const acts = buildActions('results', met);
                        return (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900/50 p-3">
                                <div className="flex flex-wrap items-start gap-3">
                                    <div className="shrink-0 rounded-lg px-3 py-1.5 text-center text-white" style={{ background: assess.color }}>
                                        <div className="text-[9px] uppercase opacity-80">Grade</div>
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
                                {/* grade < B ("Good") → 2 weakest dimensions + their top solved levers (dimension-explain) */}
                                {overallEx && (
                                    <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700/60">
                                        <p className="text-[10.5px] font-medium text-slate-700 dark:text-slate-200">{overallEx.reason}</p>
                                        <div className="mt-1 space-y-1">
                                            {overallEx.spots.map((s) => (
                                                <div key={s.key} className="flex items-start gap-2 text-[10.5px] text-slate-600 dark:text-slate-300">
                                                    <span className="shrink-0 rounded bg-rose-600/80 px-1.5 py-0.5 text-[8.5px] font-bold text-white">{s.label} {s.score}</span>
                                                    <span>
                                                        {s.topLever ? <><b>{s.topLever.label}</b> — {s.topLever.detail}</> : 'Tidak ada lever parameter pada state sekarang.'}
                                                        {s.liftPts > 0 && <span className="text-slate-500"> Mencapai {s.liftTarget} menambah +{s.liftPts} poin overall (bobot {Math.round(s.weight * 100)}%).</span>}
                                                        <button onClick={() => goTab(s.topLever?.targetTab || s.targetTab)} className="ml-1 font-medium text-rz-mint hover:text-rz-mint/80">↗ {s.targetLabel}</button>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="mt-1 text-[9px] text-slate-400">{overallEx.note}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                    <div className="grid gap-4 xl:grid-cols-[300px_1fr_300px]">
                        {/* overall */}
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 text-center">
                            <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Overall Score (Weighted)</h2>
                            <ScoreValue value={model.overall} display={model.overall} unit="/100" direction="higher"
                                traceId="results.score" explainKey="results-overall-score" className="text-5xl" />
                            <div className={`mt-1 text-sm font-semibold ${model.overall >= 85 ? 'text-rz-data' : model.overall >= 70 ? 'text-rz-info' : 'text-rz-signal'}`}>{model.grade}</div>
                            {baselineDimKeys.length > 0 && (
                                <p className="mt-1 text-[9px] leading-snug text-slate-400">
                                    {baselineDimKeys.length} dimensi masih baseline plan-mode (Construction SPI/CPI 1.00 definisional · Financial screening pro-forma) — belum ada actuals tracking; komposit ikut terangkat oleh baseline ini.
                                </p>
                            )}
                            <div className="mt-3 space-y-1 text-left">
                                {[...model.dims].sort((a, b) => b.score - a.score).map((d, idx) => (
                                    <div key={d.key} className="flex items-center gap-2 text-[11px]">
                                        <span className="w-4 text-center text-[9px] font-bold text-slate-400">{idx + 1}</span>
                                        <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{d.label}</span>
                                        <ScoreValue value={d.score} direction="higher" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* radar */}
                        <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Performance Radar <InfoTip content="The eight dimension scores (0–100, higher is better) plotted on one axis each — a shape view of where the configuration is strong vs weak. A balanced octagon is a well-rounded design; a dented axis flags the dimension to improve first." /></h2>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart data={radarData} outerRadius="75%">
                                        <PolarGrid stroke="#334155" />
                                        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8, fill: '#64748b' }} />
                                        <Radar name="Score" dataKey="score" stroke="#7DDDB4" fill="#7DDDB4" fillOpacity={0.2} strokeWidth={2} />
                                        <Tooltip contentStyle={{ fontSize: 10, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        {/* financial outcomes */}
                        <div className="space-y-4">
                            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Key Financial Outcomes <InfoTip content="Headline economics for this configuration: total CAPEX (P50) and its $/kW intensity, plus a screening NPV and IRR from the engine roi model (unlevered, flat 15-year flow at a 10% hurdle). Planning screening only — other surfaces use fuller cash-flow bases and legitimately differ; hover each row for its basis." /></h3>
                                <div className="space-y-1 text-[11px]">
                                    {/* audit #5: screening IRR basis made explicit — this page's IRR is
                                      * unlevered 15y FLAT-flow screening; other surfaces legitimately
                                      * differ (tooltip reconciles the bases, numbers are NOT equalized). */}
                                    {([
                                        ['Total CAPEX (P50)', fmtMoney(capexResults.total), 'capex.total'],
                                        ['$ / kW', `$${model.perKw.toLocaleString()}`, 'capex.perKw'],
                                        ['NPV (15y @10%)', model.npv != null ? fmtMoney(model.npv) : '—', undefined,
                                            'Basis screening: arus kas flat 15 thn (revenue referensi × IT load, okupansi penuh, tanpa ramp/pajak/utang), didiskonto 10%.'],
                                        ['IRR (screening — unlevered 15y flat)', model.irr != null ? `${(model.irr * 100).toFixed(1)}%` : '—', undefined,
                                            'Basis IRR screening: unlevered, arus kas FLAT 15 thn (revenue referensi × IT load, okupansi penuh, tanpa ramp/pajak/utang).\nHalaman lain memakai basis BERBEDA dan sah (angka tidak harus sama):\n· Dashboard — project IRR unlevered after-tax, ramp okupansi, 15 thn\n· Financial Pro-Forma — aproksimasi model pro-forma sendiri\n· Site w/ incentives — screening + insentif pajak lokasi'],
                                        ['Design PUE', String(model.opexPue), 'engine.pueMatrix'],
                                        ['Best Site', model.siteBest ? `${model.siteBest.engine.score}/100 (${model.siteBest.engine.grade})` : '—', undefined,
                                            'Highest-scoring candidate site from the Site Intelligence engine (score /100 + grade), across all sites entered. Improve it in the Site Intelligence tab by adjusting site attributes or adding alternates.'],
                                    ] as [string, string, string?, string?][]).map(([k, v, tr, tip]) => (
                                        <div key={k} className="flex justify-between" title={tip}>
                                            <span className="text-slate-500">{k}{tip ? ' ⓘ' : ''}</span>
                                            {tr ? (
                                                <TraceValue traceId={tr}>
                                                    <span className="tabular-nums font-medium text-slate-800 dark:text-slate-200">{v}</span>
                                                </TraceValue>
                                            ) : (
                                                <span className="tabular-nums font-medium text-slate-800 dark:text-slate-200">{v}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-1.5 text-[9px] text-slate-400">Screening outcomes (engine roi/opex models, dcContract basis) — not investment advice.</p>
                            </div>
                            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Result Validation <InfoTip content="Honesty checks that the scorecard was actually computed — engine loaded, CAPEX solved, all dimension composites produced, and financial screening returned a number. These are 'computed successfully' status chips, NOT an external or third-party audit of the results." /></h3>
                                {validation.map((v) => (
                                    <div key={v.label} className="flex items-center gap-1.5 py-0.5 text-[11px]">
                                        <span className={`h-2 w-2 rounded-full ${v.ok ? 'bg-rz-data' : 'bg-amber-500'}`} />
                                        <span className="text-slate-600 dark:text-slate-300">{v.label}</span>
                                        <span className={`ml-auto text-[9px] font-semibold ${v.ok ? 'text-rz-data' : 'text-amber-500'}`}>{v.ok ? 'OK' : 'Pending'}</span>
                                    </div>
                                ))}
                                <p className="mt-1 text-[9px] text-slate-400">Honest chips: “computed successfully”, not an external audit.</p>
                            </div>
                        </div>
                    </div>

                    {/* dimension table */}
                    <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Dimension Scores — documented composites <InfoTip content="The eight scored dimensions with their weights and the exact formula (basis) behind each — every score is a deterministic composite over the live engine/adapters, weighted into the overall grade. A low score carries a Fair/Poor chip that opens the reason plus solved levers." /></h2>
                        <table className="w-full text-[11px]">
                            <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] uppercase text-slate-400"><th className="py-1 text-left">Dimension <InfoTip content="The evaluation axis (Requirements, Site, Architecture, CAPEX, Construction, Operations, Sustainability, Financial)." /></th><th className="text-right">Score <InfoTip content="Dimension score 0–100, higher is better — a documented deterministic composite from the engine/adapters (see Basis)." /></th><th className="text-right">Weight <InfoTip content="This dimension's share of the weighted overall score. Weights sum to 100% across all dimensions." /></th><th className="text-left pl-4">Basis (formula) <InfoTip content="The exact formula and reference band the score is computed from — the auditable derivation, not a black box." /></th></tr></thead>
                            <tbody>
                                {model.dims.map((d) => {
                                    const dimTrace: Record<string, string> = { capex: 'results.capexScore', sus: 'results.susScore', fin: 'results.finScore', constr: 'results.constrScore' };
                                    const dimExplain: Record<string, string> = { capex: 'capex-efficiency-score', sus: 'sustainability-score' };
                                    const tr = dimTrace[d.key];
                                    /* Workstream M — shared ScoreValue: gradient value color + ƒx trace + explain/tip */
                                    const scoreEl = <ScoreValue value={d.score} direction="higher" traceId={tr}
                                        explainKey={dimExplain[d.key]}
                                        tip={dimExplain[d.key] ? undefined : `${d.label} dimension score (0–100, higher is better) — documented deterministic composite: ${d.basis}. Weighted ${Math.round(d.weight * 100)}% in the overall score.`} />;
                                    const low = d.score < DIM_CHIP_FLOOR;
                                    return (
                                    <React.Fragment key={d.key}>
                                    <tr className="border-b border-slate-100 dark:border-slate-800/60">
                                        <td className="py-1 text-slate-700 dark:text-slate-200">
                                            {d.label}
                                            {baselineDimKeys.includes(d.key) && (
                                                <span title="Plan Mode — skor definisional dari baseline (belum ada actuals tracking)" className="ml-1.5 rounded bg-slate-400/15 px-1 py-0.5 text-[8px] font-semibold text-slate-500">baseline</span>
                                            )}
                                        </td>
                                        <td className="text-right whitespace-nowrap">
                                            {scoreEl}
                                            {low && (
                                                <button onClick={() => setDimOpen(dimOpen === d.key ? null : d.key)}
                                                    title="Klik untuk alasan + lever terukur (di-solve dari formula dimensi yang sama)"
                                                    className={`ml-1.5 rounded px-1 py-0.5 text-[9px] font-semibold ${d.score < 50 ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/15 text-amber-500'} ${dimOpen === d.key ? 'ring-1 ring-amber-400' : ''}`}>
                                                    {d.score < 50 ? 'Poor' : 'Fair'} ⓘ
                                                </button>
                                            )}
                                        </td>
                                        <td className="text-right tabular-nums text-slate-500">{Math.round(d.weight * 100)}%</td>
                                        <td className="pl-4 text-[10px] text-slate-400">{d.basis}</td>
                                    </tr>
                                    {low && dimEx && dimOpen === d.key && (
                                        <tr className="border-b border-slate-100 dark:border-slate-800/60">
                                            <td colSpan={4} className="py-1.5">
                                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
                                                    <p className="text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">{dimEx.reason}</p>
                                                    <div className="mt-1 space-y-1">
                                                        {dimEx.levers.map((l, idx) => (
                                                            <div key={idx} className="flex items-start gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                                                                <span className={`shrink-0 rounded px-1 py-0.5 text-[8px] font-bold ${l.priority === 'HIGH' ? 'bg-rz-signal text-rz-base' : 'bg-slate-500 text-white'}`}>{l.priority === 'HIGH' ? 'LEVER' : 'NOTE'}</span>
                                                                <span><b>{l.label}</b> — {l.detail}
                                                                    {l.targetTab && (
                                                                        <button onClick={() => goTab(l.targetTab)} className="ml-1 font-medium text-rz-mint hover:text-rz-mint/80">
                                                                            ↗ {l.targetTab === dimEx.targetTab ? dimEx.targetLabel : 'Buka'}
                                                                        </button>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        ))}
                                                        {dimEx.levers.length === 0 && <p className="text-[10px] text-slate-500">Tidak ada lever parameter untuk dimensi ini pada state sekarang.</p>}
                                                    </div>
                                                    <div className="mt-1 flex items-center justify-between gap-2">
                                                        <p className="text-[8.5px] text-slate-400">Angka lever di-solve dari formula dimensi yang SAMA dengan skor di tabel (bisection / tabel engine) — bukan estimasi statis.</p>
                                                        <button onClick={() => goTab(dimEx.targetTab)} className="shrink-0 text-[9px] font-semibold text-rz-mint hover:text-rz-mint/80">↗ {dimEx.targetLabel}</button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="rounded border border-rz-mint/30 bg-rz-mint/5 p-3">
                        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rz-mint">Top Recommendations (deterministic) <InfoTip content="Corrective actions auto-generated from the same thresholds that scored the dimensions (e.g. PUE headroom, CAPEX above band, site or requirements gaps) — deterministic rules, not an LLM. An empty list means no dimension breached its flag." /></h3>
                        <ul className="space-y-0.5">
                            {model.recs.length === 0 && <li className="text-[11px] text-rz-data">✓ No corrective actions flagged — configuration performs across all dimensions.</li>}
                            {model.recs.map((r, idx) => <li key={idx} className="flex gap-1.5 text-[11px] text-slate-700 dark:text-slate-300"><span className="text-rz-mint">✓</span>{r}</li>)}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
