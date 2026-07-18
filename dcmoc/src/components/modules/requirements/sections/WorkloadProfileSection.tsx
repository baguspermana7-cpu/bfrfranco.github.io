'use client';

/* ─── 1.2 Workload Profile (Phase A) ─────────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useRequirementsStore, normalizeMix } from '@/store/requirements';
import { writeSharedItLoad, writeSharedCooling, writeSharedRackDensity, COOLING_UI, USE_CASE_LABELS } from '@/lib/requirementsMappings';
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
const DENSITY_PRESETS = [6, 12, 25, 60, 75, 100].map((v) => ({ value: v, label: `${v} kW/rack` }));

export function WorkloadProfileSection({ totalRacks }: { totalRacks: number }) {
    const inputs = useSimulationStore((s) => s.inputs);
    const req = useRequirementsStore();
    const w = req.workload;
    const set = req.actions.setWorkload;

    const unit = w.itLoadUnit;
    const disp = (kw: number | null) => kw == null ? null : (unit === 'MW' ? +(kw / 1000).toFixed(1) : kw);
    const toKw = (v: number | null) => v == null ? null : (unit === 'MW' ? Math.round(v * 1000) : Math.round(v));

    const densityValue: ComboValue<number> = { value: w.avgRackDensityKw, isCustom: !DENSITY_PRESETS.some((p) => p.value === w.avgRackDensityKw) };

    return (
        <SectionCard num="1.2" title="Workload Profile" caption="Define the type and characteristics of IT workload" id="sec-workload">
            <div className="grid gap-4 md:grid-cols-3">
                <div>
                    <Field label="IT Workload Category">
                        <RadioList<UseCase> value={req.overview.useCase} onChange={(v) => req.actions.setOverview({ useCase: v })}
                            options={(Object.keys(USE_CASE_LABELS) as UseCase[]).map((k) => ({ value: k, label: USE_CASE_LABELS[k] }))} />
                    </Field>
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
                    </Field>
                    <Field label={`Average IT Load (${unit})`}>
                        <NumInput value={disp(w.avgItLoadKw)} min={0} unit={unit}
                            onChange={(v) => set({ avgItLoadKw: toKw(v) })} />
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
                    <Field label="Total Racks (Estimated)" hint={`ceil(IT load ÷ density) — engine basis`}>
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-2 py-1.5 text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                            {totalRacks.toLocaleString()}
                        </div>
                    </Field>
                    <Field label="Rack Type"><Select value={w.rackForm} onChange={(v) => set({ rackForm: v })} options={RACK_FORMS} /></Field>
                </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                    <Field label="Workload Mix" hint="Auto-normalized to 100%">
                        <div className="space-y-1.5 mt-1">
                            <SliderRow label="AI / GPU Compute" value={w.workloadMix.aiGpu} onChange={(v) => set({ workloadMix: normalizeMix(w.workloadMix, 'aiGpu', v) })} />
                            <SliderRow label="Storage Intensive" value={w.workloadMix.storage} onChange={(v) => set({ workloadMix: normalizeMix(w.workloadMix, 'storage', v) })} />
                            <SliderRow label="General Compute" value={w.workloadMix.general} onChange={(v) => set({ workloadMix: normalizeMix(w.workloadMix, 'general', v) })} />
                            <SliderRow label="Network & Others" value={w.workloadMix.network} onChange={(v) => set({ workloadMix: normalizeMix(w.workloadMix, 'network', v) })} />
                        </div>
                    </Field>
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
