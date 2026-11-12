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
    kOutOfN?: (a: number, k: number, n: number) => number;
    redundantGroup?: (a: number, k: number, redundancy: string) => number;
}

/* Redundancy configs in order of strength; a sensitivity step moves one place. */
export type RedKey = 'n' | 'n1' | '2n' | '2n1';
export const RED_STEPS: RedKey[] = ['n', 'n1', '2n', '2n1'];
export const RED_LABEL: Record<RedKey, string> = { n: 'N', n1: 'N+1', '2n': '2N', '2n1': '2N+1' };
/* Units the load needs per component class (k), from engine equipScale; missing = 1 (flagged by callers). */
export type Units = Partial<Record<string, number>>;
export const EQ_UNITS: Record<string, string> = {
    ups: 'ups_modules', generator: 'generators', chiller: 'chillers', crac: 'cooling_units', switchgear: 'switchgear', pdu: 'pdus',
};
/* k from the load alone: the classes used here scale with IT kW only (density moves racks, not these). Screening:
 * the engine's fleet count is read as the units the load needs. */
export const unitsForLoad = (eng: { commissioning?: { equipScale?: (i: { itLoad: number; rackDensity: string }) => Record<string, number> } } | null | undefined, itLoad: number): Units => {
    try { return unitsFromEquip(eng?.commissioning?.equipScale?.({ itLoad, rackDensity: 'standard' })); } catch { return {}; }
};
export const toRedKey = (k: string | undefined): RedKey => (RED_STEPS.includes(k as RedKey) ? (k as RedKey) : 'n1');
export const unitsFromEquip = (eq: Record<string, number> | null | undefined): Units => {
    const u: Units = {};
    if (eq) for (const [cls, key] of Object.entries(EQ_UNITS)) if (eq[key] != null) u[cls] = Math.max(1, Math.round(eq[key]));
    return u;
};
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

const ser = (m: RelModel, arr: number[]): number =>
    m.seriesAvailability ? m.seriesAvailability(arr) : arr.reduce((s, x) => s * x, 1);
const kofn = (a: number, k: number, n: number): number => {
    let p = 0, c = 1;
    for (let i = 0; i <= n; i++) { if (i >= k) p += c * Math.pow(a, i) * Math.pow(1 - a, n - i); c = c * (n - i) / (i + 1); }
    return Math.min(1, p);
};
/* NIST e-Handbook 8.1.8.4 r-out-of-n per group: N = k of k, N+1 = k of k+1, 2N = two independent systems of k,
 * 2N+1 = two systems of k of k+1 (R120 gap D1-D3). Engine redundantGroup when loaded, same formula otherwise. */
export const groupAvail = (m: RelModel, a: number, k: number, red: RedKey): number => {
    if (m.redundantGroup) return m.redundantGroup(a, k, red);
    const K = Math.max(1, Math.round(k || 1));
    const nSys = kofn(a, K, K), n1Sys = kofn(a, K, K + 1);
    return red === 'n1' ? n1Sys : red === '2n' ? 1 - Math.pow(1 - nSys, 2) : red === '2n1' ? 1 - Math.pow(1 - n1Sys, 2) : nSys;
};
const compAvail = (m: RelModel, comps: Record<string, RelComponent>, cls: string, mttrFactor: number): number =>
    comps[cls] ? m.availability(comps[cls].mtbf, comps[cls].mttr * mttrFactor) : 0.999;
const atLeastN1 = (red: RedKey): RedKey => (red === 'n' ? 'n1' : red);

/* documented per-system chains, parameterized for sensitivity re-runs. Power follows the selected
 * redundancy; generators never below N+1; cooling is N+1 (not an input). k per class from `units`. */
export function buildSystems(m: RelModel, comps: Record<string, RelComponent>, mttrFactor: number, red: RedKey, units: Units = {}): SystemRow[] {
    const a = (cls: string) => compAvail(m, comps, cls, mttrFactor);
    const k = (cls: string) => units[cls] ?? 1;
    /* β-factor (IEC 61508): a redundant group loses a share β of each unit's unavailability q to a common cause that
     * defeats the redundancy, so A = groupAvail(1 − (1−β)q) × (1 − βq). A group at N has no redundancy to defeat. */
    const g = (cls: string, r: RedKey) => {
        const q = 1 - a(cls);
        return r === 'n' ? groupAvail(m, a(cls), k(cls), r) : groupAvail(m, 1 - (1 - CC_BETA) * q, k(cls), r) * (1 - CC_BETA * q);
    };
    const lab = (cls: string, r: RedKey) => `${cls} ${RED_LABEL[r]}, k=${k(cls)}`;
    const gen = atLeastN1(red);
    return [
        { label: 'Power Distribution', availability: ser(m, [g('switchgear', red), g('pdu', red)]), chain: `${lab('switchgear', red)} · ${lab('pdu', red)}`, redundant: red !== 'n' },
        { label: 'UPS & Battery', availability: g('ups', red), chain: lab('ups', red), redundant: red !== 'n' },
        { label: 'Generators', availability: g('generator', gen), chain: `${lab('generator', gen)} (N+1 floor)`, redundant: true },
        { label: 'Cooling (Chillers)', availability: g('chiller', 'n1'), chain: lab('chiller', 'n1'), redundant: true },
        { label: 'CRAC / AHU', availability: g('crac', 'n1'), chain: lab('crac', 'n1'), redundant: true },
    ];
}

/* Headline: the series of the per-system rows above (β-factor inside each redundant group). The old whole-system
 * blend (overall × 0.95 + single path × 0.05) grew with the fleet once k came from the load: at 20 MW the single
 * path is 200 PDUs in series. */
export function ccOverall(m: RelModel, comps: Record<string, RelComponent>, mttrFactor: number, red: RedKey, units: Units = {}): number {
    return ser(m, buildSystems(m, comps, mttrFactor, red, units).map((s) => s.availability));
}
