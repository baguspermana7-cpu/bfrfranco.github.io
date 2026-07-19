'use client';

/* ─── 1.1 Project Overview (Phase A) ─────────────────────────────────────── */

import React from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useRequirementsStore } from '@/store/requirements';
import { CountrySelect } from '@/components/ui/CountrySelect';
import { writeSharedCountry, USE_CASE_LABELS } from '@/lib/requirementsMappings';
import { SectionCard, Field, TextInput, Select, Segmented, QuarterPicker, NumInput } from '../ui';
import type { SiteStatus, Industry, GridVoltage, ProjectType } from '@/store/requirements';

const SITE_STATUS: { value: SiteStatus; label: string }[] = [
    { value: 'not_started', label: 'Not Started' }, { value: 'identified', label: 'Identified' },
    { value: 'shortlisted', label: 'Shortlisted' }, { value: 'secured', label: 'Secured' },
];
const INDUSTRIES: { value: Industry; label: string }[] = [
    { value: 'csp', label: 'Cloud Service Provider' }, { value: 'colo_provider', label: 'Colocation Provider' },
    { value: 'enterprise', label: 'Enterprise' }, { value: 'government', label: 'Government' },
    { value: 'telecom', label: 'Telecom' }, { value: 'financial', label: 'Financial Services' },
];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'SGD', 'JPY', 'IDR', 'AUD', 'INR', 'CNY'].map((c) => ({ value: c, label: c }));

export function ProjectOverviewSection() {
    const req = useRequirementsStore();
    const o = req.overview;
    const country = useSimulationStore((s) => s.selectedCountry);
    const set = req.actions.setOverview;

    return (
        <SectionCard num="1.1" title="Project Overview" caption="Basic information about the project and customer" id="sec-overview">
            <div className="grid gap-3 md:grid-cols-3">
                <Field label="Project Name" required><TextInput value={o.projectName} onChange={(v) => set({ projectName: v })} placeholder="e.g. Green AI DC Campus" /></Field>
                <Field label="Country" required hint="Grouped by region — construction & tariff basis follows the country">
                    <CountrySelect value={country?.id ?? 'ID'} onChange={(v) => writeSharedCountry(v)} />
                </Field>
                <Field label="Project Owner"><TextInput value={o.projectOwner} onChange={(v) => set({ projectOwner: v })} placeholder="Owning entity" /></Field>

                <Field label="Project Code"><TextInput value={o.projectCode} onChange={(v) => set({ projectCode: v })} placeholder="e.g. GDC-150MW-001" /></Field>
                <Field label="City / Region"><TextInput value={o.cityRegion} onChange={(v) => set({ cityRegion: v })} placeholder="City, region" /></Field>
                <Field label="Development Partner"><TextInput value={o.developmentPartner} onChange={(v) => set({ developmentPartner: v })} placeholder="Optional" /></Field>

                <Field label="Customer / Tenant"><TextInput value={o.customer} onChange={(v) => set({ customer: v })} placeholder="Anchor customer" /></Field>
                <Field label="Site Selection Status"><Select value={o.siteStatus} onChange={(v) => set({ siteStatus: v })} options={SITE_STATUS} /></Field>
                <Field label="Utility Provider"><TextInput value={o.utilityProvider} onChange={(v) => set({ utilityProvider: v })} placeholder="Grid utility" /></Field>

                <Field label="Industry"><Select value={o.industry} onChange={(v) => set({ industry: v })} options={INDUSTRIES} /></Field>
                <Field label="Target COD (Commercial Operation Date)" required>
                    <QuarterPicker value={o.targetCod} onChange={(v) => set({ targetCod: v })} />
                </Field>
                <Field label="Grid Voltage">
                    <Segmented<GridVoltage> value={o.gridVoltage} onChange={(v) => set({ gridVoltage: v })}
                        options={(['11kV', '20kV', '33kV', '132kV', '220kV'] as GridVoltage[]).map((g) => ({ value: g, label: g }))} />
                </Field>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Project Type">
                    <Segmented<ProjectType> value={o.projectType} onChange={(v) => set({ projectType: v })}
                        options={[
                            { value: 'new_build', label: 'New Build' }, { value: 'expansion', label: 'Expansion' },
                            { value: 'retrofit', label: 'Retrofit' }, { value: 'colocation', label: 'Colocation Dev.' },
                        ]} />
                </Field>
                <Field label="Contract Duration">
                    <div className="flex items-center gap-2">
                        <Segmented<number | 'custom'>
                            value={o.contractDurationYr}
                            onChange={(v) => set({ contractDurationYr: v as 5 | 10 | 15 | 20 | 'custom' })}
                            options={[{ value: 5, label: '5 Yr' }, { value: 10, label: '10 Yr' }, { value: 15, label: '15 Yr' }, { value: 20, label: '20 Yr' }, { value: 'custom', label: 'Custom' }]} />
                        {o.contractDurationYr === 'custom' && (
                            <div className="w-24"><NumInput value={o.contractDurationCustom} onChange={(v) => set({ contractDurationCustom: v })} min={1} max={40} unit="yr" /></div>
                        )}
                    </div>
                </Field>
                <Field label="Project Currency"><Select value={o.currency} onChange={(v) => set({ currency: v })} options={CURRENCIES} /></Field>
            </div>

            <div className="mt-3">
                {/* Owner S6: the single use-case picker lives in 1.2 (was duplicated
                  * here as "Primary Use Case" next to Industry + Workload Category). */}
                <Field label="IT Workload / Use Case" hint="Selected in 1.2 Workload Profile — one source">
                    <a href="#sec-workload" className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-600/10 px-2.5 py-1 text-[11px] font-medium text-violet-600 dark:text-violet-300 hover:bg-violet-600/20">
                        {USE_CASE_LABELS[o.useCase]}
                        <span className="text-[9px] uppercase text-violet-400">edit in 1.2 ↓</span>
                    </a>
                </Field>
            </div>
        </SectionCard>
    );
}
