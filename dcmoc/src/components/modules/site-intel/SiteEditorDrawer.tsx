'use client';

/* ─── Edit Criteria drawer — all site attributes via CreatableCombobox ────── */

import React from 'react';
import { useSitesStore } from '@/store/sites';
import { useSimulationStore } from '@/store/simulation';
import { COUNTRIES } from '@/constants/countries';
import { CountrySelect } from '@/components/ui/CountrySelect';
import { CreatableCombobox, type ComboValue } from '@/components/ui/CreatableCombobox';
import { ATTR_BOUNDS, type CandidateSite, type SiteAttributes } from '@/types/site-intel';
import { countryBaselineAttributes, countryBaselineEnums, SCREENING_ATTR_DEFAULTS } from '@/lib/site-adapter';
import { Tooltip } from '@/components/ui/Tooltip';
import { X, Plus, Trash2 } from 'lucide-react';

type NumKey = keyof typeof ATTR_BOUNDS;

/* Workstream B — plain-language "what is this + example" per site criterion, so
 * the parameters aren't a wall of unexplained numbers (owner: "cable landing itu
 * apa, angka 1,2,3 itu apa"). Rendered as a Tooltip beside each field label. */
const SITE_PARAM_HELP: Record<string, string> = {
    availableCapacityMw: 'Utility power the site can actually deliver to the data center (MW) — must exceed the facility load + headroom. e.g. a 100 MW-ready substation.',
    gridVoltageKv: 'Incoming utility voltage (kV). Higher moves large loads more cheaply. e.g. 132 kV transmission vs 20 kV distribution.',
    saidiMinYr: 'Grid outage minutes per year (IEEE 1366 SAIDI). Lower = more reliable → fewer genset runs. e.g. Singapore ~2, a weak grid ~600.',
    powerCostKwh: 'Industrial electricity price ($/kWh) — the single biggest OPEX driver. e.g. US ~$0.07, Europe ~$0.15.',
    submarineCableLandings: 'Number of submarine-cable landing stations serving the region — more = diverse international connectivity + lower latency. e.g. Singapore ~4, an inland/remote site 0.',
    distanceToCableLandingKm: 'Distance from the site to the nearest cable landing (km) — shorter = lower latency + cheaper backhaul. e.g. coastal 5, inland 150.',
    avgAmbientC: 'Average outdoor air temperature (°C). Hotter = more cooling energy (higher PUE). e.g. temperate 12, tropical 28.',
    coolingDegreeDays: 'Cooling-degree-days per year (heat accumulated above ~18 °C). Higher = more cooling load. e.g. cool climate 800, tropical 3500.',
    airQualityIndex: 'Typical air-quality index. Higher (dirtier) = more filter changes + hazard pay. e.g. clean 20, polluted 150.',
    waterStress0to5: 'WRI Aqueduct water-stress score, 0–5. Higher = scarcer water for evaporative cooling. e.g. 1 low, 4 extremely high.',
    pgaPct2in50yr: 'Seismic peak ground acceleration (%g, 2%-in-50-yr, USGS). Higher = more structural reinforcement cost. e.g. stable 5, active fault 40.',
    totalAcres: 'Total land area of the parcel (acres). e.g. 100.',
    usableAcres: 'Buildable land after setbacks/easements (acres) — usually < total. e.g. 80 of 100.',
    distHighwayKm: 'Distance to the nearest highway (km) — equipment logistics. Shorter = easier. e.g. 5.',
    distPortKm: 'Distance to the nearest seaport (km) — for imported gear. e.g. 30.',
    distAirportKm: 'Distance to the nearest airport (km). e.g. 25.',
    permitMonths: 'Months to obtain construction permits — longer delays COD. e.g. fast-track 6, complex 18.',
    landCostPerM2: 'Land price ($/m²). e.g. rural $40, prime metro $400.',
    waterCostPerM3: 'Water tariff ($/m³) — drives cooling OPEX. e.g. $0.5–$2.',
    effectiveTaxRate: 'Corporate income tax after incentives (decimal). e.g. 0.22 = 22%; a free-zone might be 0.10.',
    fuelAvailability: 'Diesel/gas supply for generators. good / moderate / limited.',
    waterQuality: 'Source-water quality for cooling makeup. excellent → poor (poor needs treatment).',
    earthquakeRisk: 'Seismic hazard exposure. low → extreme (higher = more reinforcement + insurance).',
    floodRisk: 'Flood exposure. low → extreme (higher = platform elevation / flood defence cost).',
    cycloneRisk: 'Cyclone/typhoon exposure. low → extreme.',
    landslideRisk: 'Landslide exposure. low → extreme.',
    coastalRisk: 'Coastal / storm-surge / tsunami exposure. low → extreme.',
    topography: 'Terrain. flat (cheap) → steep (costly earthworks).',
    roadAccess: 'Quality of road access to the site. excellent → poor.',
    constructionLabor: 'Availability of skilled construction labor. abundant → scarce (scarce raises cost + schedule).',
    govSupport: 'Government / incentive support for the project. strong → weak.',
    powerSource: 'Utility or scheme name (e.g. "PLN 150 kV", "on-site gas plant").',
    waterSource: 'Where cooling water comes from (municipal / river / seawater / recycled).',
    soil: 'Soil-bearing condition (e.g. rock, clay, reclaimed) — affects foundation cost.',
    taxIncentives: 'Any tax holidays / free-zone status / credits (free text).',
    renewableIncentives: 'Green-power incentives / PPAs available (free text).',
};
const helpTip = (k: string) => SITE_PARAM_HELP[k] ? <Tooltip content={SITE_PARAM_HELP[k]} /> : null;

const NUM_FIELDS: { key: NumKey; label: string; presets: number[] }[] = [
    { key: 'availableCapacityMw', label: 'Available Capacity', presets: [50, 100, 200, 300] },
    { key: 'gridVoltageKv', label: 'Grid Voltage', presets: [11, 20, 33, 66, 132, 220] },
    { key: 'saidiMinYr', label: 'SAIDI (grid)', presets: [30, 100, 300, 600] },
    { key: 'powerCostKwh', label: 'Power Cost', presets: [0.05, 0.09, 0.12, 0.2] },
    { key: 'submarineCableLandings', label: 'Cable Landings', presets: [0, 1, 2, 4] },
    { key: 'distanceToCableLandingKm', label: 'Dist. to Landing', presets: [5, 20, 50, 150] },
    { key: 'avgAmbientC', label: 'Avg Ambient', presets: [18, 24, 28, 32] },
    { key: 'coolingDegreeDays', label: 'Cooling Degree Days', presets: [800, 2200, 3500] },
    { key: 'airQualityIndex', label: 'AQI', presets: [20, 50, 100, 150] },
    { key: 'waterStress0to5', label: 'Water Stress (WRI)', presets: [1, 2, 3, 4] },
    { key: 'pgaPct2in50yr', label: 'PGA %g', presets: [5, 15, 30, 60] },
    { key: 'totalAcres', label: 'Total Acres', presets: [50, 100, 150, 300] },
    { key: 'usableAcres', label: 'Usable Acres', presets: [40, 80, 120, 250] },
    { key: 'distHighwayKm', label: 'Dist. Highway', presets: [2, 5, 15] },
    { key: 'distPortKm', label: 'Dist. Port', presets: [10, 30, 100] },
    { key: 'distAirportKm', label: 'Dist. Airport', presets: [10, 25, 60] },
    { key: 'permitMonths', label: 'Permit Months', presets: [6, 9, 12, 18] },
    { key: 'landCostPerM2', label: 'Land Cost', presets: [40, 85, 150, 400] },
    { key: 'waterCostPerM3', label: 'Water Cost', presets: [0.5, 1, 2] },
    { key: 'effectiveTaxRate', label: 'Effective Tax Rate', presets: [0.1, 0.17, 0.22, 0.3] },
];

const ENUM_FIELDS: { key: keyof SiteAttributes; label: string; options: string[] }[] = [
    { key: 'fuelAvailability', label: 'Fuel Availability', options: ['good', 'moderate', 'limited'] },
    { key: 'waterQuality', label: 'Water Quality', options: ['excellent', 'good', 'fair', 'poor'] },
    { key: 'earthquakeRisk', label: 'Earthquake Risk', options: ['low', 'moderate', 'high', 'extreme'] },
    { key: 'floodRisk', label: 'Flood Risk', options: ['low', 'moderate', 'high', 'extreme'] },
    { key: 'cycloneRisk', label: 'Cyclone Risk', options: ['low', 'moderate', 'high', 'extreme'] },
    { key: 'landslideRisk', label: 'Landslide Risk', options: ['low', 'moderate', 'high', 'extreme'] },
    { key: 'coastalRisk', label: 'Coastal Risk', options: ['low', 'moderate', 'high', 'extreme'] },
    { key: 'topography', label: 'Topography', options: ['flat', 'gentle', 'rolling', 'steep'] },
    { key: 'roadAccess', label: 'Road Access', options: ['excellent', 'good', 'fair', 'poor'] },
    { key: 'constructionLabor', label: 'Construction Labor', options: ['abundant', 'moderate', 'scarce'] },
    { key: 'govSupport', label: 'Gov Support', options: ['strong', 'moderate', 'weak'] },
];

const TEXT_FIELDS: { key: keyof SiteAttributes; label: string }[] = [
    { key: 'powerSource', label: 'Power Source / Utility' },
    { key: 'waterSource', label: 'Water Source' },
    { key: 'soil', label: 'Soil Condition' },
    { key: 'taxIncentives', label: 'Tax Incentives' },
    { key: 'renewableIncentives', label: 'Renewable Incentives' },
];

export function SiteEditorDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { sites, selectedSiteId, updateAttributes, updateSite, addSite, removeSite, resetToDefaults, selectSite } = useSitesStore();
    const baseCountry = useSimulationStore((s) => s.selectedCountry);
    const site: CandidateSite | undefined = sites.find((s) => s.id === selectedSiteId) ?? sites[0];
    if (!open || !site) return null;

    /* PREFILL (owner): unset fields show the EFFECTIVE value — country baseline
     * (cyan) else screening typical (amber) — as placeholder; store stays unset
     * (= baseline semantics) until the user picks/enters a value (mint custom). */
    const baseline = countryBaselineAttributes(site.countryId);
    const enumBase = countryBaselineEnums(site.countryId);
    const enumBaseline = (k: keyof SiteAttributes): string | null => enumBase[k] ?? null;
    const enumSrcChip = (k: keyof SiteAttributes) => {
        if ((site.attributes[k] as string | undefined)) return <span className="ml-1 rounded bg-rz-mint/15 px-1 text-[8px] font-bold text-rz-mint">custom</span>;
        if (enumBase[k]) return <span className="ml-1 rounded bg-cyan-500/15 px-1 text-[8px] font-bold text-cyan-500" title={`Baseline ${COUNTRIES[site.countryId]?.name ?? site.countryId} — from per-country research`}>baseline</span>;
        return null;
    };
    const numVal = (k: NumKey): ComboValue<number> | null => {
        const v = site.attributes[k] as number | undefined;
        return v == null ? null : { value: v, isCustom: true };
    };
    const prefill = (k: NumKey): { text: string; src: 'baseline' | 'screening' } | null => {
        const unit = ATTR_BOUNDS[k]?.unit ? ` ${ATTR_BOUNDS[k]!.unit}` : '';
        if (baseline[k] != null) return { text: `${baseline[k]}${unit}`, src: 'baseline' };
        if (SCREENING_ATTR_DEFAULTS[k] != null) return { text: `${SCREENING_ATTR_DEFAULTS[k]}${unit}`, src: 'screening' };
        return null;
    };
    const srcChip = (k: NumKey) => {
        if ((site.attributes[k] as number | undefined) != null)
            return <span className="ml-1 rounded bg-rz-mint/15 px-1 text-[8px] font-bold text-rz-mint">custom</span>;
        const p = prefill(k);
        if (p?.src === 'baseline') return <span className="ml-1 rounded bg-cyan-500/15 px-1 text-[8px] font-bold text-cyan-500" title={`Baseline negara ${COUNTRIES[site.countryId]?.name ?? site.countryId} — dipakai engine sampai diganti`}>baseline</span>;
        if (p?.src === 'screening') return <span className="ml-1 rounded bg-amber-500/15 px-1 text-[8px] font-bold text-amber-500" title="Screening typical — belum ada data negara/site; isi untuk mempertajam skor">screening</span>;
        return null;
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
            <div className="h-full w-full max-w-md overflow-y-auto bg-white dark:bg-slate-950 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Edit Criteria — Site {site.label}</h2>
                    <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    {sites.map((s) => (
                        <button key={s.id} onClick={() => selectSite(s.id)}
                            className={`rounded-full border px-2 py-1 text-[11px] ${s.id === site.id ? 'border-rz-mint bg-rz-mint/15 text-rz-mint' : 'border-slate-300 dark:border-slate-700 text-slate-500'}`}>
                            {s.label}
                        </button>
                    ))}
                    <button disabled={sites.length >= 5} onClick={() => addSite(baseCountry?.id ?? 'ID')}
                        className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-slate-400 px-2 py-1 text-[11px] text-slate-500 disabled:opacity-40"><Plus className="h-3 w-3" />Add</button>
                    <button disabled={sites.length <= 1} onClick={() => removeSite(site.id)}
                        className="inline-flex items-center gap-0.5 rounded-full border border-rose-400/50 px-2 py-1 text-[11px] text-rose-400 disabled:opacity-40"><Trash2 className="h-3 w-3" />Remove</button>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2">
                    <label className="block">
                        <span className="text-[10px] font-semibold uppercase text-slate-500">Name</span>
                        <input className="mt-0.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs outline-none focus:border-rz-mint text-slate-900 dark:text-slate-100"
                            value={site.name} onChange={(e) => updateSite(site.id, { name: e.target.value })} />
                    </label>
                    <label className="block">
                        <span className="text-[10px] font-semibold uppercase text-slate-500">Country</span>
                        <CountrySelect className="mt-0.5" value={site.countryId} onChange={(v) => updateSite(site.id, { countryId: v })} />
                    </label>
                </div>

                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rz-mint">Numeric attributes (preset or custom — clears to country baseline)</h3>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                    {NUM_FIELDS.map((f) => {
                        const b = ATTR_BOUNDS[f.key]!;
                        return (
                            <label key={f.key} className="block">
                                <span className="text-[9px] font-medium uppercase text-slate-500 inline-flex items-center gap-0.5">{f.label}{helpTip(f.key)}{srcChip(f.key)}</span>
                                <CreatableCombobox<number>
                                    options={f.presets.map((p) => ({ value: p, label: `${p}${b.unit ? ' ' + b.unit : ''}` }))}
                                    value={numVal(f.key)} min={b.min} max={b.max} unit={b.unit}
                                    placeholder={prefill(f.key)?.text ?? 'Select…'}
                                    onChange={(v) => updateAttributes(site.id, { [f.key]: v?.value } as Partial<SiteAttributes>)} />
                            </label>
                        );
                    })}
                </div>

                <h3 className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-rz-mint">Categorical attributes</h3>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                    {ENUM_FIELDS.map((f) => (
                        <label key={String(f.key)} className="block">
                            <span className="text-[9px] font-medium uppercase text-slate-500 inline-flex items-center gap-0.5">{f.label}{helpTip(String(f.key))}{enumSrcChip(f.key)}</span>
                            <select className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs outline-none focus:border-rz-mint text-slate-900 dark:text-slate-100"
                                value={(site.attributes[f.key] as string | undefined) ?? ''}
                                onChange={(e) => updateAttributes(site.id, { [f.key]: e.target.value || undefined } as Partial<SiteAttributes>)}>
                                <option value="">{enumBaseline(f.key) ? `— baseline: ${enumBaseline(f.key)} —` : '— country baseline —'}</option>
                                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </label>
                    ))}
                </div>

                <h3 className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-rz-mint">Text attributes</h3>
                <div className="grid grid-cols-1 gap-1.5">
                    {TEXT_FIELDS.map((f) => (
                        <label key={String(f.key)} className="block">
                            <span className="text-[9px] font-medium uppercase text-slate-500 inline-flex items-center gap-0.5">{f.label}{helpTip(String(f.key))}</span>
                            <input className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs outline-none focus:border-rz-mint text-slate-900 dark:text-slate-100"
                                value={(site.attributes[f.key] as string | undefined) ?? ''}
                                onChange={(e) => updateAttributes(site.id, { [f.key]: e.target.value || undefined } as Partial<SiteAttributes>)} />
                        </label>
                    ))}
                </div>

                <button onClick={() => resetToDefaults(baseCountry?.id ?? 'ID')}
                    className="mt-4 w-full rounded-lg border border-slate-300 dark:border-slate-700 py-1.5 text-[11px] text-slate-500 hover:border-rose-400 hover:text-rose-400">
                    Reset all sites to defaults
                </button>
            </div>
        </div>
    );
}
