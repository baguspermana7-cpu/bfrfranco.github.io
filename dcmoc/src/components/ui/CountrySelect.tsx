'use client';

/* ─── CountrySelect — CASCADING region → country dropdown ────────────────────
 * Owner (2026-07-19): 40 negara bikin dropdown panjang — pilih REGION dulu
 * (EMEA/APAC/AMER/MENA/…), lalu field country hanya menampilkan negara region
 * itu. Region auto-sinkron saat value berubah dari luar (mis. restore project).
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { REGIONS, REGION_LABELS } from '@/lib/regions';

function regionOf(countryId: string): string {
    for (const [region, countries] of Object.entries(REGIONS)) {
        if (countries.some((c) => c.id === countryId)) return region;
    }
    return Object.keys(REGIONS)[0];
}

export function CountrySelect({ value, onChange, className = '' }: {
    value: string; onChange: (countryId: string) => void; className?: string;
}) {
    const [region, setRegion] = React.useState<string>(() => regionOf(value));
    /* keep region in sync when the selected country changes externally */
    React.useEffect(() => { setRegion(regionOf(value)); }, [value]);

    const countries = REGIONS[region] ?? [];
    const base = 'rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-rz-mint';

    return (
        <div className={`flex gap-1.5 ${className}`}>
            <select aria-label="Region" className={`${base} w-[38%]`} value={region}
                onChange={(e) => {
                    const r = e.target.value;
                    setRegion(r);
                    const first = REGIONS[r]?.[0];
                    if (first && !REGIONS[r].some((c) => c.id === value)) onChange(first.id);
                }}>
                {Object.keys(REGIONS).sort().map((r) => (
                    <option key={r} value={r}>{REGION_LABELS[r] || r}</option>
                ))}
            </select>
            <select aria-label="Country" className={`${base} flex-1`} value={value}
                onChange={(e) => onChange(e.target.value)}>
                {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
        </div>
    );
}

export default CountrySelect;
