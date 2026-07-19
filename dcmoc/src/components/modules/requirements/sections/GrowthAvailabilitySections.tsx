'use client';

/* ─── 1.3 Growth Plan · 1.4 Availability Target · 1.5 Business & Priority ──── */

import React from 'react';
import { useCapexStore } from '@/store/capex';
import { useSimulationStore } from '@/store/simulation';
import { useRequirementsStore } from '@/store/requirements';
import { writeSharedTier } from '@/lib/requirementsMappings';
import { CreatableCombobox, type ComboValue } from '@/components/ui/CreatableCombobox';
import { setParam } from '@/state/registry';
import { SectionCard, Field, Segmented, NumInput } from '../ui';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { GrowthType, PriorityKey } from '@/store/requirements';
import type { ReqDerived } from '../useRequirementsDerived';

const PRIORITY_LABELS: Record<PriorityKey, string> = {
    reliability: 'Reliability', performance: 'Performance', cost: 'Cost Efficiency',
    sustainability: 'Sustainability', speed: 'Speed to Market',
};
const MARGIN_PRESETS = [5, 10, 15, 20].map((v) => ({ value: v, label: `${v}%` }));
const YEAR_KEYS = ['y1', 'y2', 'y3', 'y4', 'y5', 'y10'] as const;

export function GrowthPlanSection({ derived }: { derived: ReqDerived }) {
    const req = useRequirementsStore();
    const g = req.growth;
    return (
        <SectionCard num="1.3" title="Growth Plan (IT Load)" caption="Committed + forecast IT load by year (Y0 = shared IT load)" id="sec-growth">
            <div className="flex items-center gap-3 mb-3">
                <Field label="Growth Type">
                    <Segmented<GrowthType> value={g.growthType} onChange={(v) => req.actions.setGrowth({ growthType: v })}
                        options={[{ value: 'linear', label: 'Linear' }, { value: 'step', label: 'Step' }, { value: 'custom', label: 'Custom' }]} />
                </Field>
                <div className="ml-auto text-right">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Growth Rate (5-yr CAGR)</div>
                    <div className="text-lg font-bold tabular-nums text-violet-500">{derived.cagrPct}%</div>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
                            <th className="text-left py-1 pr-2">Year</th>
                            {derived.growthYearsMw.map((y) => <th key={y.label} className="text-right px-2 py-1">{y.label}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="py-1.5 pr-2 text-slate-500">IT Load (MW)</td>
                            {derived.growthYearsMw.map((y, i) => (
                                <td key={y.label} className="text-right px-2 py-1.5 tabular-nums">
                                    {y.editable && i > 0 ? (
                                        <input type="number" min={0}
                                            className="w-16 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-1 py-0.5 text-right text-xs outline-none focus:border-violet-500"
                                            value={y.mw}
                                            onChange={(e) => {
                                                const v = parseFloat(e.target.value);
                                                if (!Number.isFinite(v) || v < 0) return;
                                                req.actions.setGrowth({ itLoadMwByYear: { ...g.itLoadMwByYear, [YEAR_KEYS[i - 1]]: v } });
                                            }} />
                                    ) : (
                                        <span className={i === 0 ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}>{y.mw}</span>
                                    )}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
            {g.growthType !== 'custom' && <p className="mt-1.5 text-[10px] text-slate-400">Derived {g.growthType} ramp (screening 10%/yr). Switch to Custom to edit each year.</p>}
        </SectionCard>
    );
}

export function AvailabilitySection({ derived }: { derived: ReqDerived }) {
    const inputs = useSimulationStore((s) => s.inputs);
    const req = useRequirementsStore();
    const sla = req.availability.slaTargetPct;
    /* CB — SLA predefined = tier availability target (standar AI-DC, editable). */
    React.useEffect(() => {
        if (sla == null && derived.tierTargetPct) req.actions.setAvailability({ slaTargetPct: derived.tierTargetPct });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [derived.tierTargetPct]);
    return (
        <SectionCard num="1.4" title="Availability Target" caption="Uptime Institute tier target drives the availability budget (engine-real)" id="sec-availability">
            <div className="grid gap-3 md:grid-cols-4">
                <Field label="Target Tier" explainKey="tier">
                    <Segmented<number> value={inputs.tierLevel} onChange={(v) => writeSharedTier(v as 2 | 3 | 4)}
                        options={[...(inputs.tierLevel === 2 ? [{ value: 2, label: 'Tier II' }] : []), { value: 3, label: 'Tier III' }, { value: 4, label: 'Tier IV' }]} />
                </Field>
                <Field label="Target Availability">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-2 py-1.5 text-sm font-bold tabular-nums text-emerald-500">{derived.tierTargetPct}%</div>
                </Field>
                <Field label="Downtime Budget">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-2 py-1.5 text-sm font-bold tabular-nums text-slate-900 dark:text-white">{derived.downtimeMinYr} min/yr</div>
                </Field>
                <Field label="SLA Target (%)" explainKey="sla" hint={sla != null && sla > derived.tierTargetPct ? 'Exceeds tier design availability!' : sla === derived.tierTargetPct ? 'predefined = tier target (editable)' : 'Defaults to tier target'}>
                    <NumInput value={sla} min={90} max={100} unit="%"
                        onChange={(v) => req.actions.setAvailability({ slaTargetPct: v })} />
                </Field>
            </div>
        </SectionCard>
    );
}

export function BusinessPrioritySection({ derived }: { derived: ReqDerived }) {
    const req = useRequirementsStore();
    const b = req.business;
    const capexTotal = useCapexStore((s) => s.results?.total ?? null);
    /* CB — Budget predefined = CAPEX P80 basis (P50 × 1.2 screening dari band
     * AACE) + 1 thn opex kasar; "budget-commitment basis P80" — editable. */
    React.useEffect(() => {
        if (b.budgetUsd == null && capexTotal && capexTotal > 0) {
            req.actions.setBusiness({ budgetUsd: Math.round(capexTotal * 1.2 / 1e5) * 1e5 });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [capexTotal]);
    const marginValue: ComboValue<number> = { value: b.designMarginPct, isCustom: !MARGIN_PRESETS.some((p) => p.value === b.designMarginPct) };
    return (
        <SectionCard num="1.5" title="Business, Margin & Priority" caption="Budget + design margin (flows into CAPEX contingency & financials) + project priorities" id="sec-business">
            <div className="grid gap-3 md:grid-cols-3">
                <Field label="Budget (USD)" hint={b.budgetUsd != null && capexTotal != null && b.budgetUsd === Math.round(capexTotal * 1.2 / 1e5) * 1e5 ? 'predefined ≈ CAPEX P80 (editable)' : undefined}><NumInput value={b.budgetUsd} min={0} unit="USD" placeholder="Total budget"
                    onChange={(v) => req.actions.setBusiness({ budgetUsd: v })} /></Field>
                <Field label="Design Margin" explainKey="contingency" hint="Wired: writes CAPEX contingency % → investment cost & financial baseline move">
                    <CreatableCombobox<number> options={MARGIN_PRESETS} value={marginValue} min={0} max={30} unit="%"
                        onChange={(v) => setParam('req.designMarginPct', v == null ? 10 : v.value)} />
                </Field>
                <Field label="Time to COD">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-2 py-1.5 text-sm font-bold tabular-nums text-slate-900 dark:text-white">{derived.deadlineMonths} months</div>
                </Field>
            </div>
            <div className="mt-4">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Project Priority (Rank)</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {b.priorities.map((p, i) => (
                        <div key={p} className={`rounded-xl border p-2 text-center ${i === 0 ? 'border-violet-500 bg-violet-600/10' : 'border-slate-200 dark:border-slate-800'}`}>
                            <div className="text-lg font-bold text-violet-500">{i + 1}</div>
                            <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200">{PRIORITY_LABELS[p]}</div>
                            {i === 0 && <div className="text-[9px] text-violet-400">(Highest)</div>}
                            <div className="mt-1 flex justify-center gap-1">
                                <button type="button" disabled={i === 0} onClick={() => req.actions.movePriority(i, -1)}
                                    className="rounded border border-slate-300 dark:border-slate-700 p-0.5 disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                                <button type="button" disabled={i === b.priorities.length - 1} onClick={() => req.actions.movePriority(i, 1)}
                                    className="rounded border border-slate-300 dark:border-slate-700 p-0.5 disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </SectionCard>
    );
}
