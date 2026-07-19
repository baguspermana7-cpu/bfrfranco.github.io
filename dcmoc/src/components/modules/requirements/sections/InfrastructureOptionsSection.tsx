'use client';

/* ─── 1.6 Infrastructure & Site Options (Phase S9) ───────────────────────────
 * The capex-calculator questionnaire parameters surfaced INSIDE Requirements
 * (owner: "cooling deepsea, front meter, dan banyak lagi — cek capex
 * calculator"). Every field writes STRAIGHT to the SHARED capex store —
 * single source; the CAPEX Assumptions drawer shows the same values.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { useCapexStore } from '@/store/capex';
import { rzData, rzModels } from '@/lib/rz-engine';
import { SectionCard, Field, Select, Segmented, NumInput } from '../ui';
import { ChevronDown } from 'lucide-react';

const SUBSTATIONS = [
    { value: 'pad_mounted_11kv', label: 'Pad Mount 11kV (<5MW)' },
    { value: 'dedicated_33kv', label: 'Dedicated 33kV (5-20MW)' },
    { value: 'dedicated_66kv', label: 'Dedicated 66kV' },
    { value: 'dedicated_132kv', label: 'Dedicated 132kV (hyperscale)' },
];
const SEISMIC = ['zone0', 'zone1', 'zone2', 'zone3', 'zone4'].map((z, i) => ({ value: z, label: `Zone ${i}${i >= 3 ? ' (high)' : i === 0 ? ' (none)' : ''}` }));
const FALLBACK_REFRIGERANTS = [
    ['R410A', 'R-410A'], ['R134a', 'R-134a'], ['R513A', 'R-513A'], ['R32', 'R-32'], ['R454B', 'R-454B'],
    ['R1234ze', 'R-1234ze(E)'], ['R1233zd', 'R-1233zd(E)'], ['R717', 'R-717 (ammonia)'], ['R290', 'R-290 (propane)'],
].map(([value, label]) => ({ value, label }));

function Group({ title, chip, children, defaultOpen = false }: { title: string; chip?: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = React.useState(defaultOpen);
    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800">
            <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`} />
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{title}</span>
                {chip && <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase text-cyan-500">{chip}</span>}
            </button>
            {open && <div className="grid gap-3 border-t border-slate-100 dark:border-slate-800/60 p-3 md:grid-cols-3">{children}</div>}
        </div>
    );
}

export function InfrastructureOptionsSection() {
    const inputs = useCapexStore((s) => s.inputs);
    const setInputs = useCapexStore((s) => s.setInputs);
    const deepSeaAvailable = typeof rzModels()?.cooling?.deepSea === 'function';
    const refOpts = React.useMemo(() => {
        const db = rzData()?.refrigerants as Record<string, { label: string }> | undefined;
        return db ? Object.entries(db).map(([value, r]) => ({ value, label: r.label })) : FALLBACK_REFRIGERANTS;
    }, []);

    return (
        <SectionCard num="1.6" title="Infrastructure & Site Options" caption="Capex-calculator questionnaire — shared with the CAPEX engine (single source, auto-recalcs)" id="sec-infra">
            <div className="space-y-2">
                <Group title="Deep Sea Water Cooling" chip={inputs.deepSea ? 'enabled' : undefined} defaultOpen={!!inputs.deepSea}>
                    <div className="md:col-span-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                            <input type="checkbox" checked={!!inputs.deepSea} disabled={!deepSeaAvailable}
                                onChange={(e) => setInputs({ deepSea: e.target.checked })} className="h-3.5 w-3.5 accent-cyan-600" />
                            Enable deep-sea water cooling (engine models.cooling.deepSea — chiller-less basis, PUE ≤ 1.15)
                        </label>
                        {!deepSeaAvailable && <p className="mt-0.5 text-[9px] text-slate-400">engine loading…</p>}
                    </div>
                    {inputs.deepSea && (<>
                        <Field label="Intake Depth"><NumInput value={inputs.dsDepthM ?? 60} min={20} max={1000} unit="m" onChange={(v) => setInputs({ dsDepthM: v ?? 60 })} /></Field>
                        <Field label="Pipeline Length"><NumInput value={inputs.dsPipelineKm ?? 3} min={0.5} max={50} unit="km" onChange={(v) => setInputs({ dsPipelineKm: v ?? 3 })} /></Field>
                        <Field label="Loop ΔT"><NumInput value={inputs.dsDeltaTC ?? 8} min={4} max={15} unit="°C" onChange={(v) => setInputs({ dsDeltaTC: v ?? 8 })} /></Field>
                    </>)}
                </Group>

                <Group title="Front-of-Meter / Utility" chip={inputs.includeFOM ? 'included' : undefined} defaultOpen={inputs.includeFOM}>
                    <div className="md:col-span-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                            <input type="checkbox" checked={inputs.includeFOM}
                                onChange={(e) => setInputs({ includeFOM: e.target.checked })} className="h-3.5 w-3.5 accent-indigo-500" />
                            Include front-of-meter costs (substation, HV switchgear, transformers, grid connection)
                        </label>
                    </div>
                    {inputs.includeFOM && (<>
                        <Field label="Substation"><Select value={inputs.substationType} onChange={(v) => setInputs({ substationType: v })} options={SUBSTATIONS} /></Field>
                        <Field label="Transformer Lead">
                            <Segmented<string> value={inputs.transformerLead} onChange={(v) => setInputs({ transformerLead: v })}
                                options={[{ value: 'standard', label: 'Standard' }, { value: 'expedited', label: 'Expedited' }, { value: 'long_lead', label: 'Long-lead' }]} />
                        </Field>
                        <Field label="Utility Connection Rate"><NumInput value={inputs.utilityRate} min={0} max={30} unit="%" onChange={(v) => setInputs({ utilityRate: v ?? 9 })} /></Field>
                    </>)}
                </Group>

                <Group title="Building & Site">
                    <Field label="Building Type">
                        <Select value={inputs.buildingType} onChange={(v) => setInputs({ buildingType: v })}
                            options={[{ value: 'purpose', label: 'Purpose Built (Standard)' }, { value: 'warehouse', label: 'Warehouse Conversion' }, { value: 'modular', label: 'Modular / Prefab' }, { value: 'highrise', label: 'Vertical High-Rise' }]} />
                    </Field>
                    <Field label="Seismic Zone"><Select value={inputs.seismicZone ?? 'zone2'} onChange={(v) => setInputs({ seismicZone: v })} options={SEISMIC} /></Field>
                    <Field label="Site Condition">
                        <Segmented<string> value={inputs.siteCondition ?? 'greenfield'} onChange={(v) => setInputs({ siteCondition: v })}
                            options={[{ value: 'greenfield', label: 'Greenfield' }, { value: 'brownfield', label: 'Brownfield' }]} />
                    </Field>
                    <Field label="Floor System">
                        <Segmented<string> value={inputs.floorType ?? 'slab'} onChange={(v) => setInputs({ floorType: v })}
                            options={[{ value: 'slab', label: 'Slab (overhead)' }, { value: 'raised', label: 'Raised Floor' }]} />
                    </Field>
                </Group>

                <Group title="Systems (UPS · Gen · Fire · Refrigerant)">
                    <Field label="UPS Type">
                        <Select value={inputs.upsType} onChange={(v) => setInputs({ upsType: v })}
                            options={[{ value: 'standalone', label: 'Standalone UPS' }, { value: 'modular', label: 'Modular UPS' }, { value: 'distributed', label: 'Distributed' }, { value: 'rotary', label: 'Rotary / DRUPS' }]} />
                    </Field>
                    <Field label="Generator">
                        <Select value={inputs.genType} onChange={(v) => setInputs({ genType: v })}
                            options={[{ value: 'diesel', label: 'Diesel Gen' }, { value: 'gas', label: 'Gas Engine' }, { value: 'hvo', label: 'HVO / Renewable' }]} />
                    </Field>
                    <Field label="Fire Suppression">
                        <Select value={inputs.fireType} onChange={(v) => setInputs({ fireType: v })}
                            options={[{ value: 'novec', label: 'Novec 1230' }, { value: 'fm200', label: 'FM-200' }, { value: 'inert', label: 'Inert Gas (IG-541)' }, { value: 'sprinkler', label: 'Wet Pipe Sprinkler' }]} />
                    </Field>
                    <Field label="Detection / Alarm">
                        <Select value={inputs.alarmType} onChange={(v) => setInputs({ alarmType: v })}
                            options={[{ value: 'addressable', label: 'Addressable' }, { value: 'vesda', label: 'VESDA (Aspirating)' }, { value: 'beam', label: 'Beam Detection' }]} />
                    </Field>
                    <Field label="Refrigerant" hint="engine GWP/COP database"><Select value={inputs.refrigerantType ?? 'R134a'} onChange={(v) => setInputs({ refrigerantType: v })} options={refOpts} /></Field>
                </Group>

                <Group title="Distribution & Security">
                    <Field label="Power Distribution">
                        <Segmented<string> value={inputs.powerDistribution ?? 'busway'} onChange={(v) => setInputs({ powerDistribution: v })}
                            options={[{ value: 'busway', label: 'Busway' }, { value: 'cable', label: 'Cable Tray' }]} />
                    </Field>
                    <Field label="Transformer Type">
                        <Segmented<string> value={inputs.transformerType ?? 'dry'} onChange={(v) => setInputs({ transformerType: v })}
                            options={[{ value: 'dry', label: 'Dry-type' }, { value: 'oil', label: 'Oil-filled' }]} />
                    </Field>
                    <Field label="Fiber Entry">
                        <Segmented<string> value={inputs.fiberEntry ?? 'dual'} onChange={(v) => setInputs({ fiberEntry: v })}
                            options={[{ value: 'single', label: 'Single' }, { value: 'dual', label: 'Dual (diverse)' }]} />
                    </Field>
                    <Field label="Security Level">
                        <Select value={inputs.securityLevel ?? 'enhanced'} onChange={(v) => setInputs({ securityLevel: v })}
                            options={[{ value: 'standard', label: 'Standard' }, { value: 'enhanced', label: 'Enhanced (mantrap + ANPR)' }, { value: 'high', label: 'High (gov/financial)' }]} />
                    </Field>
                </Group>

                <Group title="Sustainability & Renewables">
                    <Field label="Green Certification">
                        <Select value={inputs.greenCert} onChange={(v) => setInputs({ greenCert: v })}
                            options={[{ value: 'none', label: 'None' }, { value: 'silver', label: 'LEED Silver (+2%)' }, { value: 'gold', label: 'LEED Gold (+4%)' }, { value: 'platinum', label: 'LEED Platinum (+8%)' }]} />
                    </Field>
                    <Field label="On-site Renewables">
                        <Select value={inputs.renewableOption} onChange={(v) => setInputs({ renewableOption: v })}
                            options={[{ value: 'none', label: 'None' }, { value: 'solar', label: 'Solar PV' }, { value: 'solar_bess', label: 'Solar + BESS' }]} />
                    </Field>
                    {inputs.renewableOption !== 'none' && (<>
                        <Field label="Solar Sizing"><NumInput value={inputs.renewSolarMwp ?? 5} min={0.5} max={500} unit="MWp" onChange={(v) => setInputs({ renewSolarMwp: v ?? 5 })} /></Field>
                        {inputs.renewableOption === 'solar_bess' && (
                            <Field label="BESS Sizing"><NumInput value={inputs.renewBessMwh ?? 10} min={1} max={2000} unit="MWh" onChange={(v) => setInputs({ renewBessMwh: v ?? 10 })} /></Field>
                        )}
                    </>)}
                </Group>

                <Group title="Delivery Basis (year · market · fees)">
                    <Field label="Project Year">
                        <Segmented<string> value={inputs.projYear} onChange={(v) => setInputs({ projYear: v })}
                            options={['2025', '2026', '2027', '2028'].map((y) => ({ value: y, label: y }))} />
                    </Field>
                    <Field label="Market Condition">
                        <Segmented<string> value={inputs.marketCondition ?? 'normal'} onChange={(v) => setInputs({ marketCondition: v })}
                            options={[{ value: 'soft', label: 'Soft' }, { value: 'normal', label: 'Normal' }, { value: 'hot', label: 'Hot' }]} />
                    </Field>
                    <Field label="Delivery Method">
                        <Select value={inputs.deliveryMethod ?? 'design_build'} onChange={(v) => setInputs({ deliveryMethod: v })}
                            options={[{ value: 'design_build', label: 'Design-Build' }, { value: 'design_bid_build', label: 'Design-Bid-Build' }, { value: 'epc', label: 'EPC / Turnkey' }]} />
                    </Field>
                    <Field label="Design Fee"><NumInput value={inputs.designFee} min={0} max={20} unit="%" onChange={(v) => setInputs({ designFee: v ?? 8 })} /></Field>
                    <Field label="PM Fee"><NumInput value={inputs.pmFee} min={0} max={15} unit="%" onChange={(v) => setInputs({ pmFee: v ?? 5 })} /></Field>
                    <Field label="Contingency" hint="bound to Design Margin (1.5) — edit there">
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-2 py-1.5 text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                            {inputs.contingency}%
                        </div>
                    </Field>
                </Group>
            </div>
            <p className="mt-2 text-[9px] text-slate-400">
                All values are the SHARED capex-engine inputs — the CAPEX Engine assumptions drawer shows the same fields. Options not yet priced by the engine are recorded in the design basis.
            </p>
        </SectionCard>
    );
}
