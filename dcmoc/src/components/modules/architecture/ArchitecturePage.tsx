'use client';

/* ─── Architecture Engine — page shell (Phase C) ─────────────────────────────
 * Header (design standard + architecture profile selects, Export/Save/Next) +
 * KPI row + layers checklist + DYNAMIC system diagram (logical|SLD) + rail +
 * absorbed engine sections + bottom cards. Everything recomputes reactively
 * from the shared state (owner mandate: not a static image).
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useRequirementsStore } from '@/store/requirements';
import { useArchitectureStore, DESIGN_STANDARDS, type DesignStandard } from '@/store/architecture';
import { ARCH_PROFILES, applyProfile } from '@/state/presets';
import { rzModels } from '@/lib/rz-engine';
import { readArchInputs, computeFacility, computeEquipCounts, computeValidation, computeDensityCheck } from '@/state/adapters/arch-adapter';
import { computeLayout, computeCoolingLayout } from './diagram/layout';
import { DiagramSvg } from './diagram/DiagramSvg';
import { ArchRail } from './ArchRail';
import { ThermalTopologyRow, BomSection, BottomCards } from './ArchSections';
import { generatePillarPDF } from '@/modules/reporting/pdf/PillarPdf';
import { buildAssessment, buildActions } from '@/modules/reporting/pdf/ReportNarrative';
import type { StandardReport } from '@/modules/reporting/pdf/PrintReport';
import { useScenarioStore } from '@/store/scenario';
import { getPUE } from '@/constants/pue';
import { Boxes, FileDown, Save, ChevronRight } from 'lucide-react';
import { Explain } from '@/components/ui/Explain';
import { TraceValue } from '@/components/ui/TraceValue';

const COOL_LABEL: Record<string, string> = { liquid: 'D2C Liquid', rdhx: 'Rear-Door HX', inrow: 'In-Row', air: 'Air CRAC/CRAH' };

const STRIP = [
    { id: 'sec-arch-overview', label: '1 Overview' },
    { id: 'sec-arch-diagram', label: '2-4 System Diagram' },
    { id: 'sec-arch-detail', label: '5-7 Cooling · Power · BMS' },
    { id: 'sec-bom', label: '9 BOM Summary' },
    { id: 'sec-reference', label: '8 Reference & Compliance' },
];

export function ArchitecturePage() {
    const simInputs = useSimulationStore((s) => s.inputs);
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const country = useSimulationStore((s) => s.selectedCountry);
    const capexInputs = useCapexStore((s) => s.inputs);
    const req = useRequirementsStore();
    const arch = useArchitectureStore();
    const scenarioStore = useScenarioStore();
    const [busy, setBusy] = React.useState(false);
    const [toast, setToast] = React.useState<string | null>(null);

    const i = React.useMemo(() => readArchInputs({
        itLoad: simInputs.itLoad, tierLevel: simInputs.tierLevel, coolingType: simInputs.coolingType,
        powerRedundancy: simInputs.powerRedundancy, gridVoltage: req.overview.gridVoltage,
        rackDensityKw: req.workload.avgRackDensityKw, supplyTempC: arch.supplyTempC, deltaTK: arch.deltaTK,
        useCase: req.overview.useCase, fuelHours: capexInputs.fuelHours,
    }), [simInputs, req.overview.gridVoltage, req.overview.useCase, req.workload.avgRackDensityKw, arch.supplyTempC, arch.deltaTK, capexInputs.fuelHours]);

    const f = React.useMemo(() => computeFacility(i), [i]);
    const { eq } = React.useMemo(() => computeEquipCounts(i), [i]);
    const { layers, overall } = React.useMemo(() => computeValidation(i, eq), [i, eq]);
    /* AF: the diagram plots from ALL requirement params — utility name, workload
     * mix cells, growth phases, design margin, SLA, use-case label. */
    const model = React.useMemo(() => {
        const phases = (simInputs.capacityPhases ?? []).map((p: { label?: string; name?: string; itLoadKw?: number; kw?: number; mw?: number }, idx: number) => ({
            label: p.label ?? p.name ?? `Phase ${idx + 1}`,
            mw: (p.mw ?? ((p.itLoadKw ?? p.kw ?? 0) / 1000)) || 0,
            future: idx > 0,
        })).filter((p) => p.mw > 0);
        const extras = {
            utilityProvider: req.overview.utilityProvider,
            mix: req.workload.workloadMix,
            phases,
            marginPct: req.business.designMarginPct,
            slaPct: req.availability.slaTargetPct,
            useCaseLabel: req.overview.useCase.toUpperCase(),
            /* K1 — renewables from the CAPEX selection (BESS must SHOW when selected) */
            renewables: {
                option: capexInputs.renewableOption ?? 'none',
                solarMwp: capexInputs.renewSolarMwp ?? 0,
                bessMwh: capexInputs.renewBessMwh ?? 0,
            },
            /* K2 — deep-sea study inputs for the mechanical view */
            deepSea: {
                enabled: !!capexInputs.deepSea,
                depthM: capexInputs.dsDepthM ?? 800,
                pipelineKm: capexInputs.dsPipelineKm ?? 4,
                deltaTK: capexInputs.dsDeltaTC ?? 5,
            },
        };
        return arch.diagramView === 'mech' ? computeCoolingLayout(i, eq, f, extras) : computeLayout(i, eq, f, extras);
    }, [i, eq, f, simInputs.capacityPhases, req.overview.utilityProvider, req.overview.useCase, req.workload.workloadMix, req.business.designMarginPct, req.availability.slaTargetPct, capexInputs, arch.diagramView]);

    const m = rzModels()?.architecture;
    let complexity: { index: number; band: string } | null = null;
    try { complexity = m?.complexity ? m.complexity({ coolingType: i.coolingType, tier: i.tier, redundancy: i.redKey }) : null; } catch { /* */ }

    const dens = React.useMemo(() => computeDensityCheck(i), [i]);

    /* Honest profile label: the select is a PICKER — the header must not imply
     * the profile is active when the actual store differs (e.g. profile says
     * liquid while sim.coolingType is still air). Compare the selected
     * profile's writes against the live store values; on drift show an amber
     * "recommended — not applied" chip (click applies the profile). */
    const profileDrift = React.useMemo(() => {
        const p = ARCH_PROFILES.find((x) => x.id === arch.profileId);
        if (!p) return null;
        const actual: Record<string, unknown> = {
            'sim.coolingType': i.coolingType,
            'req.avgRackDensityKw': i.rackDensityKw,
            'sim.powerRedundancy': i.redundancy,
            'sim.tierLevel': i.tier,
        };
        const diffs = Object.entries(p.writes).filter(([k, v]) => k in actual && actual[k] !== v).map(([k]) => k);
        if (diffs.length === 0) return null;
        const wantsCooling = p.writes['sim.coolingType'] as string | undefined;
        const msg = diffs.includes('sim.coolingType') && wantsCooling
            ? `Profile recommends ${COOL_LABEL[wantsCooling] ?? wantsCooling} — not applied (current: ${COOL_LABEL[i.coolingType]})`
            : `Profile not fully applied — ${diffs.length} setting(s) differ`;
        return { msg };
    }, [arch.profileId, i]);

    const targetTier = DESIGN_STANDARDS.find((d) => d.id === arch.designStandard)?.tier ?? 3;
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

    const onStandard = (id: DesignStandard) => {
        arch.actions.set({ designStandard: id });
        const t = DESIGN_STANDARDS.find((d) => d.id === id)?.tier;
        if (t) useSimulationStore.getState().actions.setTierLevel(t);
    };
    const onProfile = (pid: string) => {
        arch.actions.set({ profileId: pid });
        const p = ARCH_PROFILES.find((x) => x.id === pid);
        if (p) { applyProfile(p); showToast(`Profile applied: ${p.label}`); }
    };
    const onSave = () => {
        scenarioStore.saveScenario({
            name: `Arch · ${(i.itLoadKw / 1000).toFixed(0)}MW ${i.coolingType} ${i.redundancy}`,
            countryId: country?.id ?? 'ID',
            simInputs, capexInputs: useCapexStore.getState().inputs,
            summary: { monthlyOpex: 0, annualCapex: useCapexStore.getState().results?.total ?? 0, totalStaff: 0, pue: f.pue },
        });
        showToast('Scenario saved');
    };
    const onExport = async () => {
        setBusy(true);
        try {
            const narrativeMetrics = {
                layersPassed: layers.filter((l) => l.pass).length,
                layersTotal: layers.length,
                redundancy: i.redundancy,
                cooling: i.coolingType,
                tier: String(i.tier),
            };
            await generatePillarPDF({
                title: 'Architecture', layer: 'Layer 3 · Architecture Engine', project: country?.name ?? '—',
                kpis: [
                    { label: 'Total IT / Facility', value: `${f.itMw} / ${f.facilityMw} MW`, sub: `PUE ${f.pue}` },
                    { label: 'Availability Target', value: `${f.availabilityPct}%`, sub: `Tier ${i.tier} · ${f.downtimeMinYr} min/yr` },
                    { label: 'Redundancy', value: i.redundancy, sub: `${f.paths} active path(s)` },
                    { label: 'Complexity', value: complexity ? `${complexity.index}/100` : '—', sub: complexity?.band ?? '' },
                ],
                sections: [
                    { title: 'Design Validation', head: ['Layer', 'Status', 'Note'], rows: layers.map((l) => [l.label, l.pass ? 'Passed' : 'Review', l.note]) },
                    { title: 'Equipment BOM (engine equipScale)', head: ['Item', 'Count'], rows: Object.entries({ Switchgear: eq.switchgear, Transformers: eq.transformers, Generators: eq.generators, 'UPS Modules': eq.ups_modules, PDUs: eq.pdus, Chillers: eq.chillers, Racks: eq.racks }).map(([k, v]) => [k, String(v)]) },
                ],
                config: [
                    ['IT Load', `${f.itMw} MW`],
                    ['Tier', `Tier ${i.tier}`],
                    ['Cooling', COOL_LABEL[i.coolingType]],
                    ['Redundancy', i.redundancy],
                    ['Grid Voltage', i.gridVoltage],
                    ['Rack Density', `${i.rackDensityKw} kW/rack`],
                    ['PUE (Design)', String(f.pue)],
                    ['Design Standard', DESIGN_STANDARDS.find((d) => d.id === arch.designStandard)?.label ?? '—'],
                ],
                callouts: [
                    ...(overall
                        ? [{ title: 'Design Validation — Passed', body: 'All architecture layers pass the engine screening checks (power, cooling, IT, building, security, BMS).', tone: 'good' as const }]
                        : []),
                    ...layers.filter((l) => !l.pass).map((l) => ({
                        title: `${l.label} — Review Required`, body: l.note, tone: 'warn' as const,
                    })),
                ],
                assessment: buildAssessment('architecture', narrativeMetrics),
                actions: [
                    ...buildActions('architecture', narrativeMetrics),
                    ...layers.filter((l) => !l.pass).map((l) => ({ priority: 'HIGH' as const, action: `Resolve ${l.label} review item — ${l.note}` })),
                    { priority: 'MEDIUM' as const, action: 'Review architecture with stakeholders' },
                    { priority: 'MEDIUM' as const, action: 'Proceed to Capacity Planning Engine' },
                    { priority: 'LOW' as const, action: 'Run advanced simulation (Power & Cooling)' },
                    { priority: 'LOW' as const, action: 'Export architecture package' },
                ],
                summaryBand: [
                    { label: 'IT Load', value: `${f.itMw} MW` },
                    { label: 'Facility', value: `${f.facilityMw} MW` },
                    { label: 'PUE', value: String(f.pue) },
                    { label: 'Racks', value: eq.racks.toLocaleString() },
                    { label: 'Availability', value: `${f.availabilityPct}%` },
                    { label: 'Redundancy', value: i.redundancy },
                ],
                note: 'Engine-real architecture screening (models.architecture + equipScale). Pattern reference — not a certified design.',
            } as StandardReport);
        } finally { setBusy(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded border border-rz-2 bg-rz-elevated">
                        <Boxes className="h-6 w-6 text-rz-info" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Architecture Engine</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Define and validate the complete data center architecture based on requirements, site conditions and design standards</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="text-[10px] uppercase text-slate-500">Standard
                        <select value={arch.designStandard} onChange={(e) => onStandard(e.target.value as DesignStandard)}
                            className="ml-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs normal-case text-slate-900 dark:text-slate-100 outline-none focus:border-rz-signal">
                            {DESIGN_STANDARDS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                        </select>
                    </label>
                    <label className="text-[10px] uppercase text-slate-500">Profile
                        <select value={arch.profileId} onChange={(e) => onProfile(e.target.value)}
                            className={`ml-1.5 rounded-lg border ${profileDrift ? 'border-amber-500/70' : 'border-slate-300 dark:border-slate-700'} bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs normal-case text-slate-900 dark:text-slate-100 outline-none focus:border-rz-signal`}>
                            {ARCH_PROFILES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                    </label>
                    {profileDrift && (
                        <button onClick={() => onProfile(arch.profileId)} title="The selected profile has NOT been applied to the design — click to apply it"
                            className="max-w-xs truncate rounded-full bg-amber-500/15 px-2.5 py-1 text-left text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/25">
                            ⚠ {profileDrift.msg} · apply
                        </button>
                    )}
                    <button onClick={onExport} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-rz-mint"><FileDown className="h-3.5 w-3.5" />{busy ? '…' : 'Export'}</button>
                    <button onClick={onSave} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-rz-mint"><Save className="h-3.5 w-3.5" />Save</button>
                    <button onClick={() => setActiveTab('capacity')} className="inline-flex items-center gap-1 rounded-lg bg-rz-signal px-3 py-1.5 text-xs font-semibold text-rz-base hover:bg-rz-signal/90">Next: Capacity Planning <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
            </div>

            <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-1">
                {STRIP.map((t) => (
                    <button key={t.id} onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth' })}
                        className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-rz-signal/10">{t.label}</button>
                ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
                <div className="min-w-0 space-y-4">
                    {/* KPI row */}
                    <div id="sec-arch-overview" className="grid scroll-mt-24 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                            { label: 'Total IT Load', value: `${f.itMw} MW`, sub: `${eq.racks.toLocaleString()} racks`, trace: 'sim.itLoad' },
                            { label: 'Total Facility Load', value: `${f.facilityMw} MW`, sub: 'incl. losses & overhead', trace: 'arch.facilityMw' },
                            { label: 'PUE (Design)', value: String(f.pue), sub: f.pue <= 1.2 ? 'Excellent' : f.pue <= 1.4 ? 'Good' : 'Standard', explain: 'pue', trace: 'engine.pueMatrix' },
                            { label: 'Cooling Approach', value: COOL_LABEL[i.coolingType], sub: dens.ok ? `${i.rackDensityKw} kW/rack` : `${i.rackDensityKw} kW/rack — above ${dens.ceilKw} kW ${i.coolingType} ceiling`, warn: !dens.ok },
                            { label: 'Availability Target', value: `${f.availabilityPct}%`, sub: `Tier ${i.tier} · ${f.downtimeMinYr} min/yr`, trace: 'rel.tierTarget' },
                            { label: 'Redundancy Level', value: i.redundancy, sub: 'Power & Cooling', explain: 'redundancy' },
                        ].map((k) => (
                            <div key={k.label} title={`${k.label}: ${k.value}${(k as {sub?: string}).sub ? " — " + (k as {sub?: string}).sub : ""}`} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-3">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label} {(k as { explain?: string }).explain && <Explain k={(k as { explain?: string }).explain!} />}</div>
                                {(k as { trace?: string }).trace ? (
                                    <TraceValue traceId={(k as { trace?: string }).trace!}>
                                        <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                    </TraceValue>
                                ) : (
                                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</div>
                                )}
                                <div className={`truncate text-[10px] ${(k as { warn?: boolean }).warn ? 'font-medium text-amber-500' : 'text-slate-500'}`} title={k.sub}>{k.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* dynamic diagram */}
                    <div id="sec-arch-diagram" className="scroll-mt-24 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4">
                        <div className="mb-2 flex items-center justify-between">
                            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">System Architecture Diagram <span className="ml-1 text-[9px] normal-case text-rz-mint">live — recomputed from requirements</span></h2>
                            <div className="flex gap-1">
                                {(['logical', 'sld', 'mech'] as const).map((v) => (
                                    <button key={v} onClick={() => arch.actions.set({ diagramView: v })}
                                        className={`rounded px-2 py-0.5 text-[10px] font-medium ${arch.diagramView === v ? 'bg-rz-signal text-rz-base' : 'text-slate-500 hover:bg-rz-signal/10'}`}>
                                        {v === 'logical' ? 'Logical View' : v === 'sld' ? 'Single Line Diagram' : 'Mechanical & Cooling'}
                                    </button>
                                ))}
                                <span className="rounded px-2 py-0.5 text-[10px] text-slate-400" title="Planned">Physical · 3D — coming soon</span>
                            </div>
                        </div>
                        <DiagramSvg model={model} />
                    </div>

                    <div id="sec-arch-detail" className="scroll-mt-24 space-y-3">
                        <ThermalTopologyRow i={i} />
                    </div>
                    <BomSection i={i} eq={eq} />
                    <BottomCards i={i} targetTier={targetTier} />
                </div>
                <ArchRail i={i} eq={eq} f={f} layers={layers} overall={overall} />
            </div>

            {toast && <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-900 dark:bg-slate-700 px-3 py-2 text-xs text-white shadow-xl">{toast}</div>}
        </div>
    );
}
