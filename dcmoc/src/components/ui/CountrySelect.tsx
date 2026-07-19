'use client';

/* ─── CountrySelect — region-grouped country dropdown (Phase S) ──────────────
 * The calculator-basis UX (CapexDashboard optgroup pattern) as a shared
 * component: countries grouped by region with emoji region labels.
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { REGIONS, REGION_LABELS } from '@/lib/regions';

export function CountrySelect({ value, onChange, className = '' }: {
    value: string; onChange: (countryId: string) => void; className?: string;
}) {
    return (
        <select
            className={`w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-violet-500 ${className}`}
            value={value} onChange={(e) => onChange(e.target.value)}
        >
            {Object.entries(REGIONS).sort().map(([region, countries]) => (
                <optgroup key={region} label={REGION_LABELS[region] || region}>
                    {countries.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </optgroup>
            ))}
        </select>
    );
}

export default CountrySelect;
