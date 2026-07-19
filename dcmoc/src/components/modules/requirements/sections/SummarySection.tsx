'use client';

/* ─── 1.7 Summary — engine-real validation (absorbed from the old
 *     RequirementsDashboard: checklist, flags, profile chips, PDF export) ─── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useRequirementsStore } from '@/store/requirements';
import { rzModels } from '@/lib/rz-engine';
import { USE_CASE_TO_ENGINE } from '@/lib/requirementsMappings';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';
import { SectionCard } from '../ui';
import { FileDown } from 'lucide-react';
import type { ReqDerived } from '../useRequirementsDerived';

export function SummarySection({ derived }: { derived: ReqDerived }) {
    const inputs = useSimulationStore((s) => s.inputs);
    const country = useSimulationStore((s) => s.selectedCountry);
    const req = useRequirementsStore();
    const [busy, setBusy] = React.useState(false);
    const v = derived.validation;

    const m = rzModels().requirements;
    const prof = m?.profile ? m.profile(USE_CASE_TO_ENGINE[req.overview.useCase]) : null;
    const band = m?.densityBand ? m.densityBand(req.workload.avgRackDensityKw) : null;

    const exportPdf = async () => {
        setBusy(true);
        try {
            const haveCount = v?.have.length ?? 0;
            const missingCount = v?.missing.length ?? 0;
            const narrativeMetrics = {
                completenessPct: haveCount + missingCount > 0 ? Math.round((haveCount / (haveCount + missingCount)) * 100) : derived.score,
                flagsCount: v?.flags.length ?? 0,
            };
            await generatePillarPDF({
                title: 'Requirements & Workload', layer: 'Layer 1 · Requirements Intake', project: req.overview.projectName || country?.name || '—',
                kpis: [
                    { label: 'Requirement Score', value: `${derived.score}/100`, sub: derived.scoreBand.label },
                    { label: 'IT Load', value: `${(inputs.itLoad / 1000).toFixed(1)} MW`, sub: `${derived.totalRacks.toLocaleString()} racks @ ${req.workload.avgRackDensityKw} kW` },
                    { label: 'Availability Target', value: `${derived.tierTargetPct}%`, sub: `${derived.downtimeMinYr} min/yr budget` },
                ],
                sections: [
                    {
                        title: 'Intake Completeness', head: ['Field', 'Status'],
                        rows: [
                            ...(v?.have ?? []).map((f) => [f, 'Provided']),
                            ...(v?.missing ?? []).map((f) => [f, 'MISSING']),
                        ],
                    },
                    {
                        title: 'Input Quality by Section', head: ['Section', 'Complete', 'Missing'],
                        rows: derived.sectionQuality.map((s) => [s.label, `${s.pct}%`, s.missing.join(', ') || '—']),
                    },
                ],
                config: [
                    ['Project Name', req.overview.projectName || '—'],
                    ['Country', country?.name ?? '—'],
                    ['Use Case', req.overview.useCase.toUpperCase()],
                    ['Industry', req.overview.industry.replace(/_/g, ' ')],
                    ['Project Type', req.overview.projectType.replace(/_/g, ' ')],
                    ['Site Status', req.overview.siteStatus.replace(/_/g, ' ')],
                    ['Target COD', `Q${req.overview.targetCod.quarter} ${req.overview.targetCod.year}`],
                    ['Grid Voltage', req.overview.gridVoltage],
                    ['IT Load (Y0)', `${(inputs.itLoad / 1000).toFixed(1)} MW`],
                    ['Avg Rack Density', `${req.workload.avgRackDensityKw} kW`],
                    ['Max Rack Density', req.workload.maxRackDensityKw != null ? `${req.workload.maxRackDensityKw} kW` : '—'],
                    ['Rack Form', req.workload.rackForm],
                    ['Workload Mix', `AI ${req.workload.workloadMix.aiGpu}% · Sto ${req.workload.workloadMix.storage}% · Gen ${req.workload.workloadMix.general}% · Net ${req.workload.workloadMix.network}%`],
                    ['AI Chip', req.workload.aiChipType.toUpperCase()],
                    ['Growth Type', req.growth.growthType],
                    ['Growth (Y0→Y5)', derived.growthYearsMw.slice(0, 6).map((g) => `${g.mw}`).join(' → ') + ' MW'],
                    ['5-yr CAGR', `${derived.cagrPct}%`],
                    ['SLA Target', req.availability.slaTargetPct != null ? `${req.availability.slaTargetPct}%` : `${derived.tierTargetPct}% (tier default)`],
                    ['Downtime Budget', `${derived.downtimeMinYr} min/yr`],
                    ['Months to COD', String(derived.deadlineMonths)],
                ],
                callouts: v && v.flags.length > 0
                    ? v.flags.map((f) => ({
                        title: f.severity === 'critical' ? 'Critical Flag' : 'Warning',
                        body: f.message,
                        tone: f.severity === 'critical' ? ('warn' as const) : ('info' as const),
                    }))
                    : [{ title: 'Validation Clean', body: 'All engine validation checks pass.', tone: 'good' as const }],
                assessment: buildAssessment('requirements', narrativeMetrics),
                actions: [
                    ...buildActions('requirements', narrativeMetrics),
                    ...(v?.flags ?? []).map((f) => ({
                        priority: f.severity === 'critical' ? ('HIGH' as const) : ('MEDIUM' as const),
                        action: `Resolve: ${f.message}`,
                    })),
                    ...(v?.missing ?? []).map((f) => ({ priority: 'LOW' as const, action: `Provide missing intake field: ${f}` })),
                ],
                summaryBand: [
                    { label: 'Score', value: `${derived.score}/100` },
                    { label: 'IT Load', value: `${(inputs.itLoad / 1000).toFixed(1)} MW` },
                    { label: 'Racks', value: derived.totalRacks.toLocaleString() },
                    { label: 'Density', value: `${req.workload.avgRackDensityKw} kW` },
                    { label: 'Availability', value: `${derived.tierTargetPct}%` },
                    { label: 'CAGR (5y)', value: `${derived.cagrPct}%` },
                ],
                note: `Engine-real intake validation (models.requirements). ${derived.scoreBand.sub} Budgetary screening — not a design basis.`,
            } as StandardReport);
        } finally { setBusy(false); }
    };

    return (
        <SectionCard num="1.7" title="Summary & Validation" caption="Engine-real intake validation (models.requirements.validate)" id="sec-summary">
            <div className="flex flex-wrap items-center gap-2 mb-3">
                {prof && <span className="rounded-full bg-violet-600/15 text-violet-500 dark:text-violet-300 px-2 py-0.5 text-[10px] font-semibold">{prof.label} · {prof.rackKw} kW/rack profile</span>}
                {band && <span className="rounded-full bg-cyan-600/15 text-cyan-600 dark:text-cyan-300 px-2 py-0.5 text-[10px] font-semibold">{band.band} density band</span>}
                {v?.recommendedTierFloor && <span className="rounded-full bg-emerald-600/15 text-emerald-600 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-semibold">Tier floor ≥ {v.recommendedTierFloor}</span>}
                <button onClick={exportPdf} disabled={busy}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-violet-700 px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60">
                    <FileDown className="w-3.5 h-3.5" />{busy ? 'Generating…' : 'Generate Report'}
                </button>
            </div>

            {v ? (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                        {[...v.have.map((f) => ({ f, ok: true })), ...v.missing.map((f) => ({ f, ok: false }))].map(({ f, ok }) => (
                            <div key={f} className="flex items-center gap-1.5 text-xs">
                                <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                <span className={ok ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}>{f}</span>
                            </div>
                        ))}
                    </div>
                    {v.flags.length > 0 ? (
                        <div className="mt-3 space-y-1">
                            {v.flags.map((f, i) => (
                                <div key={i} className={`rounded-lg border px-2 py-1.5 text-[11px] ${f.severity === 'critical'
                                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-500'
                                    : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                                    {f.severity === 'critical' ? '⛔' : '⚠'} {f.message}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-3 text-[11px] text-emerald-500">✓ All engine validation checks pass.</p>
                    )}
                </>
            ) : (
                <p className="text-xs text-slate-500">Engine loading…</p>
            )}
        </SectionCard>
    );
}
