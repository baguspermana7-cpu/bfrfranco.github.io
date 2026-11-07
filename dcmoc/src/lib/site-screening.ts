/* ─── Site screening — hard gates (must-have criteria) + criteria profiles ────
 * v3.25.0. A candidate that FAILS an enabled gate is screened out of the ranking
 * regardless of its weighted score. Gate definitions and thresholds live in the
 * engine (DATA.site.gates) with a verbatim local fallback; the weight profiles
 * live in DATA.site.weightProfiles. Attribute resolution order mirrors the
 * detail panels: site attribute → country research baseline → unknown. An
 * UNKNOWN gate never fails a site — it is reported so the reviewer can fill it.
 * ──────────────────────────────────────────────────────────────────────── */

import type { CandidateSite, SiteAttributes, FactorKey } from '@/types/site-intel';
import { rzData } from '@/lib/rz-engine';
import { countryBaselineAttributes, countryBaselineEnums } from '@/lib/site-adapter';

export type GateOp = '>=' | '<=' | '!=';
export type GateCondition = 'waterCooling';
export interface GateDef {
    id: string;
    label: string;
    attr: keyof SiteAttributes;
    op: GateOp;
    value?: number | string;
    ref?: 'itLoadMw';
    onlyIf?: GateCondition;
}
export type GateStatus = 'pass' | 'fail' | 'unknown' | 'skipped';
export interface GateResult {
    id: string;
    label: string;
    status: GateStatus;
    observed: string;           // what the site shows ("120 MW", "extreme", "—")
    threshold: string;          // what the gate requires ("≥ 40 MW")
    source: 'site' | 'country' | 'none';
    enabled: boolean;
}
export interface SiteScreening {
    siteId: string;
    passed: boolean;            // no ENABLED gate failed
    failed: GateResult[];
    unknown: GateResult[];
    gates: GateResult[];
}
export interface ScreeningCtx {
    itLoadMw: number;
    waterCooling: boolean;      // cooling design consumes water (evaporative / adiabatic)
    enabled: Record<string, boolean>;
}

export interface WeightProfile { id: string; label: string; weights: Record<FactorKey, number> }

/* Verbatim fallbacks (engine DATA.site.gates / weightProfiles) — used only when
 * the engine bundle is not loaded yet. */
const FALLBACK_GATES: GateDef[] = [
    { id: 'capacity', label: 'Utility capacity ≥ IT load', attr: 'availableCapacityMw', op: '>=', ref: 'itLoadMw' },
    { id: 'flood', label: 'Flood risk not extreme', attr: 'floodRisk', op: '!=', value: 'extreme' },
    { id: 'seismic', label: 'PGA (2 %/50 yr) ≤ 60 %g (below SDC E / near-fault)', attr: 'pgaPct2in50yr', op: '<=', value: 60 },
    { id: 'permit', label: 'Permitting ≤ 24 months', attr: 'permitMonths', op: '<=', value: 24 },
    { id: 'water', label: 'Water stress ≤ 3 when cooling uses water', attr: 'waterStress0to5', op: '<=', value: 3, onlyIf: 'waterCooling' },
];
const FALLBACK_WEIGHTS: Record<FactorKey, number> = { power: 0.17, grid: 0.14, seismic: 0.10, talent: 0.11, tax: 0.09, carbon: 0.09, flood: 0.07, latency: 0.07, water: 0.08, climate: 0.08 };

export function gateDefs(): GateDef[] {
    const g = (rzData() as { site?: { gates?: GateDef[] } } | null)?.site?.gates;
    return Array.isArray(g) && g.length ? g : FALLBACK_GATES;
}

export function weightProfiles(): WeightProfile[] {
    const wp = (rzData() as { site?: { weightProfiles?: Record<string, { label: string; weights: Record<FactorKey, number> }> } } | null)?.site?.weightProfiles;
    if (wp && Object.keys(wp).length) return Object.entries(wp).map(([id, p]) => ({ id, label: p.label, weights: p.weights }));
    return [{ id: 'balanced', label: 'Balanced (default)', weights: FALLBACK_WEIGHTS }];
}

/** Weights for a profile id; `balanced` / unknown id → undefined (engine default path, byte-equal scores). */
export function profileWeights(profileId: string): Record<FactorKey, number> | undefined {
    if (!profileId || profileId === 'balanced') return undefined;
    return weightProfiles().find((p) => p.id === profileId)?.weights;
}

/** Resolve one attribute: site value → country baseline → none. */
function resolveAttr(site: CandidateSite, attr: keyof SiteAttributes): { value: number | string | null; source: 'site' | 'country' | 'none' } {
    const own = site.attributes?.[attr];
    if (own != null && own !== '' && (typeof own === 'number' ? Number.isFinite(own) : true)) {
        return { value: own as number | string, source: 'site' };
    }
    const num = countryBaselineAttributes(site.countryId)[attr];
    if (num != null) return { value: num, source: 'country' };
    const en = countryBaselineEnums(site.countryId)[attr];
    if (en != null) return { value: en, source: 'country' };
    return { value: null, source: 'none' };
}

const fmtVal = (v: number | string | null, unit?: string): string =>
    v == null ? '—' : typeof v === 'number' ? `${Number.isInteger(v) ? v : v.toFixed(1)}${unit ? ' ' + unit : ''}` : String(v);

const UNITS: Partial<Record<keyof SiteAttributes, string>> = {
    availableCapacityMw: 'MW', pgaPct2in50yr: '%g', permitMonths: 'mo', waterStress0to5: '/5',
};

export function screenSite(site: CandidateSite, ctx: ScreeningCtx): SiteScreening {
    const gates: GateResult[] = gateDefs().map((g) => {
        const enabled = ctx.enabled[g.id] !== false;
        const unit = UNITS[g.attr];
        const threshold = g.ref === 'itLoadMw'
            ? `${g.op} ${fmtVal(+ctx.itLoadMw.toFixed(1), 'MW')}`
            : `${g.op === '!=' ? 'not' : g.op} ${fmtVal(g.value ?? null, unit)}`;
        if (g.onlyIf === 'waterCooling' && !ctx.waterCooling) {
            return { id: g.id, label: g.label, status: 'skipped', observed: 'cooling uses no water', threshold, source: 'none', enabled };
        }
        const r = resolveAttr(site, g.attr);
        if (r.value == null) return { id: g.id, label: g.label, status: 'unknown', observed: '—', threshold, source: 'none', enabled };
        const want = g.ref === 'itLoadMw' ? ctx.itLoadMw : g.value;
        let ok: boolean;
        if (g.op === '!=') ok = String(r.value) !== String(want);
        else {
            const v = Number(r.value), w = Number(want);
            if (!Number.isFinite(v) || !Number.isFinite(w)) return { id: g.id, label: g.label, status: 'unknown', observed: fmtVal(r.value, unit), threshold, source: r.source, enabled };
            ok = g.op === '>=' ? v >= w : v <= w;
        }
        return { id: g.id, label: g.label, status: ok ? 'pass' : 'fail', observed: fmtVal(r.value, unit), threshold, source: r.source, enabled };
    });
    const failed = gates.filter((g) => g.enabled && g.status === 'fail');
    const unknown = gates.filter((g) => g.enabled && g.status === 'unknown');
    return { siteId: site.id, passed: failed.length === 0, failed, unknown, gates };
}

export function screenAllSites(sites: CandidateSite[], ctx: ScreeningCtx): Map<string, SiteScreening> {
    const m = new Map<string, SiteScreening>();
    sites.forEach((s) => m.set(s.id, screenSite(s, ctx)));
    return m;
}
