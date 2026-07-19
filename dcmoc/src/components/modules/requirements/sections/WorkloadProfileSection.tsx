'use client';

/* ─── 1.2 Workload Profile (Phase A) ─────────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useRequirementsStore, normalizeMix } from '@/store/requirements';
import {
    writeSharedItLoad, writeSharedCooling, writeSharedRackDensity, COOLING_UI,
    USE_CASE_LABELS, MIX_PRESETS, applyUseCaseProfile, engineProfileFor, effectiveTotalRacks,
} from '@/lib/requirementsMappings';
import { CreatableCombobox, type ComboValue } from '@/components/ui/CreatableCombobox';
import { SectionCard, Field, Select, Segmented, RadioList, SliderRow, NumInput } from '../ui';
import type { UseCase, RackForm, AiChip } from '@/store/requirements';

const RACK_FORMS: { value: RackForm; label: string }[] = [
    { value: 'std42u', label: 'Standard 42U' }, { value: 'tall48u', label: 'Tall 48U' }, { value: 'ocp', label: 'OCP / Open Rack' },
];
const CHIPS: { value: AiChip; label: string }[] = [
    { value: 'h100', label: 'NVIDIA H100' }, { value: 'h200', label: 'NVIDIA H200' }, { value: 'gb200', label: 'NVIDIA GB200' },
    { value: 'mi300x', label: 'AMD MI300X' }, { value: 'tpu', label: 'Google TPU' }, { value: 'none', label: 'None / Mixed' },
];
/* Rack classes mirror the capex-calculator guided questionnaire (Standard 5-7 /
 * Medium 10-15 / High 20-30 / AI 50-100 kW). */
const DENSITY_PRESETS = [
    { value: 6, label: '6 kW/rack — Standard (5-7 kW)' },
    { value: 12, label: '12 kW/rack — Medium (10-15 kW)' },
    { value: 25, label: '25 kW/rack — High Density (20-30 kW)' },
    { value: 60, label: '60 kW/rack — AI/HPC (50-100 kW)' },
    { value: 75, label: '75 kW/rack — AI/HPC (50-100 kW)' },
    { value: 100, label: '100 kW/rack — AI/HPC (50-100 kW)' },
];
/* Guided sub-labels per use case (engine useCaseProfiles values). */
const USE_CASE_SUBS: Record<UseCase, string> = {
    ai: '~60 kW/rack · liquid', hpc: '~45 kW/rack · RDHx', cloud: '~20 kW/rack · in-row',
    enterprise: '~8 kW/rack · air', network: '~10 kW/rack · air', dr: '~12 kW/rack · in-row',
};

export function WorkloadProfileSection({ totalRacks }: { totalRacks: number }) {
    const inputs = useSimulationStore((s) => s.inputs);
    const req = useRequirementsStore();
    const w = req.workload;
    const set = req.actions.setWorkload;
    const [toast, setToast] = React.useState<string | null>(null);
    const [editRacks, setEditRacks] = React.useState(false);

    /* CB — PREDEFINED (owner: "peak IT load menyamakan IT load, avg predefined,
     * tapi editable"): kosong → auto-isi standar AI-DC; user edit → nilai manual
     * dipertahankan. peak = itLoad; avg = 0.75 × peak (band utilisasi klaster
     * AI 70-80%, screening). */
    React.useEffect(() => {
        if (w.peakItLoadKw == null && inputs.itLoad > 0) set({ peakItLoadKw: inputs.itLoad });
        if (w.avgItLoadKw == null && inputs.itLoad > 0) set({ avgItLoadKw: Math.round(inputs.itLoad * 0.75) });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputs.itLoad]);

    const unit = w.itLoadUnit;
    const disp = (kw: number | null) => kw == null ? null : (unit === 'MW' ? +(kw / 1000).toFixed(1) : kw);
    const toKw = (v: number | null) => v == null ? null : (unit === 'MW' ? Math.round(v * 1000) : Math.round(v));

    const densityValue: ComboValue<number> = { value: w.avgRackDensityKw, isCustom: !DENSITY_PRESETS.some((p) => p.value === w.avgRackDensityKw) };
    const profile = engineProfileFor(req.overview.useCase);
    const preset = MIX_PRESETS[req.overview.useCase];
    const racksEffective = effectiveTotalRacks(inputs.itLoad, w.avgRackDensityKw, w.totalRacksOverride);

    const pickUseCase = (v: UseCase) => {
        req.actions.setOverview({ useCase: v });
        const summary = applyUseCaseProfile(v);
        setToast(`${USE_CASE_LABELS[v]} profile applied: ${summary}`);
        window.setTimeout(() => setToast(null), 6000);
    };

    return (
        <SectionCard num="1.2" title="Workload Profile" caption="Define the type and characteristics of IT workload" id="sec-workload">
            {toast && (
                <div className="mb-3 rounded-lg border border-violet-500/40 bg-violet-600/10 px-3 py-2 text-[11px] text-violet-600 dark:text-violet-300">
                    {toast}
                </div>
            )}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-3">
                    <Field label="IT Workload / Use Case" required hint="Single source — picking a category auto-applies the engine profile (density, cooling, tier floor, mix)">
                        <RadioList<UseCase> value={req.overview.useCase} onChange={pickUseCase}
                            options={(Object.keys(USE_CASE_LABELS) as UseCase[]).map((k) => ({ value: k, label: USE_CASE_LABELS[k], sub: USE_CASE_SUBS[k] }))} />
                    </Field>
                    {profile && (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                            <div className="mb-1 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Reference guidance — engine profile</span>
                            </div>
                            <p className="text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
                                {profile.label}: typical {profile.rackKw} kW/rack, {profile.cooling} cooling, Tier ≥{profile.tierFloor}.
                                Predefined values were applied — every field below stays adjustable.
                            </p>
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="flex items-end gap-2">
                        <div className="flex-1">
                            <Field label={`IT Load (${unit})`} required>
                                <NumInput value={disp(inputs.itLoad)} min={0}
                                    onChange={(v) => { const kw = toKw(v); if (kw != null && kw >= 100) writeSharedItLoad(kw); }} unit={unit} />
                            </Field>
                        </div>
                        <Segmented<'MW' | 'kW'> value={unit} onChange={(v) => set({ itLoadUnit: v })}
                            options={[{ value: 'MW', label: 'MW' }, { value: 'kW', label: 'kW' }]} />
                    </div>
                    <Field label={`Peak IT Load (${unit})`} hint="Validated ≥ IT load">
                        <NumInput value={disp(w.peakItLoadKw)} min={0} unit={unit}
                            onChange={(v) => set({ peakItLoadKw: toKw(v) })} />
                        {w.peakItLoadKw === inputs.itLoad && <span className="mt-0.5 inline-block rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] text-violet-500 dark:text-violet-300">predefined = IT Load</span>}
                    </Field>
                    <Field label={`Average IT Load (${unit})`}>
                        <NumInput value={disp(w.avgItLoadKw)} min={0} unit={unit}
                            onChange={(v) => set({ avgItLoadKw: toKw(v) })} />
                        {w.avgItLoadKw === Math.round(inputs.itLoad * 0.75) && <span className="mt-0.5 inline-block rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] text-violet-500 dark:text-violet-300">predefined 75% peak</span>}
                    </Field>
                    {w.peakItLoadKw != null && w.peakItLoadKw < inputs.itLoad && (
                        <p className="text-[10px] text-amber-500">Peak load is below the base IT load — check the values.</p>
                    )}
                </div>

                <div className="space-y-3">
                    <Field label="Average Rack Density" required>
                        <CreatableCombobox<number>
                            options={DENSITY_PRESETS} value={densityValue} min={1} max={200} unit="kW/rack"
                            onChange={(v) => writeSharedRackDensity(v == null ? 12 : v.value)} />
                    </Field>
                    <Field label="Target Rack Density (Max)">
                        <NumInput value={w.maxRackDensityKw} min={1} max={250} unit="kW/rack"
                            onChange={(v) => set({ maxRackDensityKw: v })} />
                    </Field>
                    <Field label="Total Racks (Estimated)" hint="ceil(IT load ÷ density) — override to match the actual count">
                        {editRacks || w.totalRacksOverride != null ? (
                            <div className="flex items-center gap-1.5">
                                <NumInput value={w.totalRacksOverride ?? totalRacks} min={1} max={100000}
                                    onChange={(v) => set({ totalRacksOverride: v })} />
                                <button onClick={() => { set({ totalRacksOverride: null }); setEditRacks(false); }}
                                    className="whitespace-nowrap rounded-md border border-slate-300 dark:border-slate-700 px-1.5 py-1 text-[9px] text-slate-500 hover:border-violet-400"
                                    title={`Reset to auto (${totalRacks.toLocaleString()})`}>auto</button>
                            </div>
                        ) : (
                            <button onClick={() => setEditRacks(true)} title="Click to override the computed count"
                                className="flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-2 py-1.5 text-sm font-bold tabular-nums text-slate-900 dark:text-white hover:border-violet-400">
                                {racksEffective.toLocaleString()}
                                <span className="rounded bg-slate-200 dark:bg-slate-800 px-1 py-0.5 text-[8px] font-semibold uppercase text-slate-500">auto</span>
                            </button>
                        )}
                        {w.totalRacksOverride != null && (
                            <p className="mt-0.5 text-[9px] text-amber-500">manual override — auto = {totalRacks.toLocaleString()}</p>
                        )}
                    </Field>
                    <Field label="Rack Type"><Select value={w.rackForm} onChange={(v) => set({ rackForm: v })} options={RACK_FORMS} /></Field>
                </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                    <div className="mb-1 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">Workload Mix</span>
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[10px] text-slate-500">
                            <input type="checkbox" checked={w.mixManual}
                                onChange={(e) => {
                                    const manual = e.target.checked;
                                    set(manual ? { mixManual: true } : { mixManual: false, workloadMix: { ...preset } });
                                }}
                                className="h-3.5 w-3.5 accent-violet-600" />
                            Manual override
                        </label>
                    </div>
                    {!w.mixManual && (
                        <p className="mb-1 text-[9px] text-emerald-600 dark:text-emerald-400">
                            predefined from the {USE_CASE_LABELS[req.overview.useCase]} profile — tick to adjust
                        </p>
                    )}
                    <div className={`space-y-1.5 mt-1 ${w.mixManual ? '' : 'pointer-events-none opacity-60'}`}>
                        <SliderRow label="AI / GPU Compute" value={w.workloadMix.aiGpu} onChange={(v) => set({ workloadMix: normalizeMix(w.workloadMix, 'aiGpu', v) })} />
                        <SliderRow label="Storage Intensive" value={w.workloadMix.storage} onChange={(v) => set({ workloadMix: normalizeMix(w.workloadMix, 'storage', v) })} />
                        <SliderRow label="General Compute" value={w.workloadMix.general} onChange={(v) => set({ workloadMix: normalizeMix(w.workloadMix, 'general', v) })} />
                        <SliderRow label="Network & Others" value={w.workloadMix.network} onChange={(v) => set({ workloadMix: normalizeMix(w.workloadMix, 'network', v) })} />
                    </div>
                </div>
                <div className="space-y-3">
                    <Field label="AI Chip Type (Primary)"><Select value={w.aiChipType} onChange={(v) => set({ aiChipType: v })} options={CHIPS} /></Field>
                    <Field label="Cooling Approach (Preferred)" hint="Writes the shared cooling type (CAPEX + all engines)">
                        <Select value={inputs.coolingType} onChange={(v) => writeSharedCooling(v)}
                            options={COOLING_UI.map((c) => ({ value: c.key, label: c.label }))} />
                    </Field>
                </div>
            </div>
        </SectionCard>
    );
}
