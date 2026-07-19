'use client';

/* ─── 1.1 Project Overview (Phase A) ─────────────────────────────────────── */

import React from 'react';
import { CURRENCY_LIST } from '@/lib/screening';
import { Upload, RotateCcw, Image as ImageIcon } from 'lucide-react';
import { useSimulationStore } from '@/store/simulation';
import { useRequirementsStore } from '@/store/requirements';
import { useCapexStore } from '@/store/capex';
import { compressToWebp, dataUrlBytes } from '@/lib/imageCompress';
import { CountrySelect } from '@/components/ui/CountrySelect';
import { DC_CITIES } from '@/constants/geo';
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
const CURRENCIES = CURRENCY_LIST.map((c) => ({ value: c, label: c }));

/* ─── DC hero image upload (owner: "button masukkan gambar DC buat dashboard") ──
 * Same store field the CAPEX card uses (useCapexStore.heroImage) — one source,
 * shown on the Executive Dashboard hero; without an upload the default DC-OS
 * render applies (ProjectSummary falls back to /dcmoc/hero-default.webp). */
function HeroImageUpload() {
    const heroImage = useCapexStore((s) => s.heroImage);
    const setHeroImage = useCapexStore((s) => s.setHeroImage);
    const [busy, setBusy] = React.useState(false);

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setBusy(true);
        try {
            const url = await compressToWebp(file);
            setHeroImage(url);
        } catch {
            /* unreadable file — keep current image */
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/40 p-3">
            <div className="flex items-center gap-2 mb-2">
                <ImageIcon className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Data Center Image (Dashboard hero)</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide ${heroImage ? 'bg-violet-500/15 text-violet-500 dark:text-violet-300' : 'bg-slate-500/15 text-slate-500 dark:text-slate-400'}`}>
                    {heroImage ? 'custom' : 'default'}
                </span>
            </div>
            <div className="flex items-center gap-3">
                <div className="relative h-20 w-32 flex-shrink-0 rounded-md overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 bg-slate-100 dark:bg-slate-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={heroImage || '/dcmoc/hero-default.webp'} alt="Dashboard hero preview" className="absolute inset-0 w-full h-full object-cover" />
                    {busy && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-[10px]">Compressing…</div>}
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium bg-violet-600 hover:bg-violet-500 text-white cursor-pointer transition-colors">
                            <Upload className="w-3 h-3" /> Upload Image
                            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                        </label>
                        {heroImage && (
                            <button onClick={() => setHeroImage(null)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <RotateCcw className="w-3 h-3" /> Reset to default
                            </button>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        {heroImage
                            ? `Custom · WebP · ~${Math.round(dataUrlBytes(heroImage) / 1024)} KB — shown on the Executive Dashboard`
                            : 'No upload yet — the Dashboard uses the default DC-OS render'}
                    </p>
                </div>
            </div>
        </div>
    );
}

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
                <Field label="City / Region" hint="Pilih kota DC-hub (dropdown) atau ketik custom">
                    <>
                        <input list="dc-city-options" value={o.cityRegion} onChange={(e) => set({ cityRegion: e.target.value })}
                            placeholder="Pilih / ketik kota"
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                        <datalist id="dc-city-options">
                            {(DC_CITIES[country?.id ?? 'ID'] ?? []).map((c) => <option key={c.name} value={c.name} />)}
                        </datalist>
                    </>
                </Field>
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

            <HeroImageUpload />
        </SectionCard>
    );
}
