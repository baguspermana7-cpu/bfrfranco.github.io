/* ─── REGION GROUPING (single source — Phase S) ──────────────────────────────
 * Extracted from CapexDashboard (the calculator-basis UX): countries grouped
 * by region for hierarchical selects. CapexDashboard + CountrySelect both
 * import from here.
 * ──────────────────────────────────────────────────────────────────────── */

import { COUNTRIES } from '@/constants/countries';

export const REGIONS = Object.values(COUNTRIES).reduce((acc, c) => {
    if (!acc[c.region]) acc[c.region] = [];
    acc[c.region].push(c);
    return acc;
}, {} as Record<string, typeof COUNTRIES[keyof typeof COUNTRIES][]>);

export const REGION_LABELS: Record<string, string> = {
    'APAC': '🌏 Asia Pacific',
    'EMEA': '🌍 Europe',
    'AMER': '🌎 Americas',
    'MENA': '🕌 Middle East & North Africa',
    'AFR': '🌍 Africa',
    'LATAM': '🌎 Latin America',
};
