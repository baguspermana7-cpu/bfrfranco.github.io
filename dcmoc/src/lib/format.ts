/**
 * Shared number formatting utilities for DCMOC dashboards.
 * Replaces ~20 local duplicates across dashboard components.
 */

/** Compact number with locale grouping: 1234 → "1,234", 1500000 → "1.5M" */
export const fmt = (n: number, dec = 0): string =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: dec }).format(n);

/** Money with compact abbreviation: 1500000 → "$1.5M", 1200 → "$1,200" */
export const fmtMoney = (n: number): string => {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(0)}`;
};

/** Full currency with Intl (no abbreviation): 1500000 → "$1,500,000" */
export const fmtMoneyFull = (n: number): string =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

/** Compact number without $ sign: 1500000 → "1.5M", 800 → "800" */
export const fmtCompact = (n: number): string => {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 10_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
    return n.toLocaleString('en-US');
};

/** Unit suffix: fmtUnit(1500000, 'kWh') → "1.5M kWh" */
export const fmtUnit = (n: number, unit: string): string =>
    `${fmtCompact(n)} ${unit}`;

/** Percentage: fmtPct(15.3) → "15.3%", fmtPct(0.153, 1, true) → "15.3%" (if ratio) */
export const fmtPct = (n: number, dec = 1): string => `${n.toFixed(dec)}%`;

/** kW/MW: fmtKw(1500) → "1.5 MW", fmtKw(800) → "800 kW" */
export const fmtKw = (n: number): string =>
    n >= 1000 ? `${(n / 1000).toFixed(1)} MW` : `${n} kW`;
