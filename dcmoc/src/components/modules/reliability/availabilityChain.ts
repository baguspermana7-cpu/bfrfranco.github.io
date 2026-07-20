/* ─── Shared composed-availability chain (single source of truth) ─────────────
 * One β-adjusted availability chain for the WHOLE Reliability page family:
 * the "Availability & SPOF" tab (ReliabilityEnginePage) and the "RAM Detail"
 * tab (ReliabilityDashboard) MUST show the same headline number. The RAM
 * Detail tab previously composed pure parallel-series (engine
 * systemAvailability) and displayed a fake "100.000% / 0 min" — parallel
 * saturation + toFixed display rounding. LAW: never round mid-chain; display
 * rounding only at the final render, via the nines-aware formatters below.
 * ──────────────────────────────────────────────────────────────────────────── */

/* β-factor common-cause screening share (assumption, IEC 61508-style screening) */
export const CC_BETA = 0.05;
export const MIN_PER_YEAR = 525960;

export interface RelComponent { mtbf: number; mttr: number; label: string }
export interface RelModel {
    availability: (mtbf: number, mttr: number) => number;
    parallelAvailability?: (a: number, paths: number) => number;
    seriesAvailability?: (avails: number[]) => number;
}
export interface SystemRow { label: string; availability: number; chain: string; redundant: boolean }

/* nines-aware availability formatter — never rounds up to a fake 100% */
export const ninesOf = (a: number): number => a >= 1 - 1e-9 ? 9 : Math.min(9, Math.floor(-Math.log10(1 - a)));
export const fmtAvail = (a: number): string => {
    if (a >= 1 - 1e-9) return '>99.9999999%';
    const nines = ninesOf(a);
    const s = (a * 100).toFixed(Math.max(4, nines + 1));
    if (s.startsWith('100')) return '>99.9999999%';
    return `${s}%`;
};
export const fmtDowntime = (min: number): string => min < 1 ? `~${Math.round(min * 60)} s/yr` : `${min.toFixed(1)} min/yr`;

const par = (m: RelModel, av: number, n: number): number =>
    m.parallelAvailability ? m.parallelAvailability(av, n) : 1 - Math.pow(1 - av, n);
const ser = (m: RelModel, arr: number[]): number =>
    m.seriesAvailability ? m.seriesAvailability(arr) : arr.reduce((s, x) => s * x, 1);
const compAvail = (m: RelModel, comps: Record<string, RelComponent>, cls: string, mttrFactor: number): number =>
    comps[cls] ? m.availability(comps[cls].mtbf, comps[cls].mttr * mttrFactor) : 0.999;

/* documented per-system chains, parameterized for sensitivity re-runs */
export function buildSystems(m: RelModel, comps: Record<string, RelComponent>, mttrFactor: number, p: number): SystemRow[] {
    const a = (cls: string) => compAvail(m, comps, cls, mttrFactor);
    return [
        { label: 'Power Distribution', availability: par(m, ser(m, [a('switchgear'), a('pdu')]), p), chain: `(swgr·pdu) × ${p} paths`, redundant: p > 1 },
        { label: 'UPS & Battery', availability: par(m, a('ups'), p), chain: `UPS × ${p} paths`, redundant: p > 1 },
        { label: 'Generators', availability: par(m, a('generator'), Math.max(2, p)), chain: `gen × ${Math.max(2, p)} (N+1 floor)`, redundant: true },
        { label: 'Cooling (Chillers)', availability: par(m, a('chiller'), 2), chain: 'chiller N+1 (2 paths)', redundant: true },
        { label: 'CRAC / AHU', availability: par(m, a('crac'), 2), chain: 'CRAC N+1', redundant: true },
    ];
}

/* β=5% common-cause screening: blend the parallel-composed overall with
 * the single-path series overall (a common-cause event defeats redundancy) —
 * this is why redundant chains never display a fake 100.0000%. */
export function ccOverall(m: RelModel, comps: Record<string, RelComponent>, mttrFactor: number, p: number): number {
    const a = (cls: string) => compAvail(m, comps, cls, mttrFactor);
    const sys = buildSystems(m, comps, mttrFactor, p);
    const overallPar = ser(m, sys.map((s) => s.availability));
    const overallSingle = ser(m, [ser(m, [a('switchgear'), a('pdu')]), a('ups'), a('generator'), a('chiller'), a('crac')]);
    return overallPar * (1 - CC_BETA) + overallSingle * CC_BETA;
}
