/* ─── AXIS EXPLAIN (owner mandate rollout: no naked Poor/Fair chips) ─────────
 * Every Poor/Fair axis band on the Site Score table + takeaways card opens a
 * small panel with (a) a computed REASON — the weakest live deriveFactors
 * contributor (axis weight × factor value) + which attributes still sit on
 * the country baseline — and (b) QUANTIFIED levers whose magnitudes are
 * SOLVED against the page's own scoring model: every metricAt closure calls
 * scoreSite() on a modified copy of the site, so the numbers come from the
 * REAL axis formulas in site-adapter (never re-implemented here). Follows
 * the decision-explain explainThresholdMetric pattern (lib/decision-explain).
 * ──────────────────────────────────────────────────────────────────────── */

import { explainThresholdMetric, type DecisionLever, type ThresholdLeverSpec } from '@/lib/decision-explain';
import { scoreSite, countryBaselineAttributes, SCREENING_ATTR_DEFAULTS } from '@/lib/site-adapter';
import type { CandidateSite, SiteAttributes, SiteScoreResult, AxisKey, FactorKey } from '@/types/site-intel';
import { AXIS_LABELS, axisBand } from '@/types/site-intel';

/** Band "Good" floor — the solve target for every failing axis (axisBand ≥60). */
const GOOD_TARGET = 60;

/** Special targetTab token the panel maps to "open SiteEditorDrawer". */
export const EDIT_CRITERIA_TAB = 'edit-criteria';

/** Axis → sibling deep-dive shell tab (only where one exists). */
export const AXIS_DEEP_TAB: Partial<Record<AxisKey, { tab: string; label: string }>> = {
    powerAvailability: { tab: 'grid', label: 'Grid deep-dive' },
    naturalRisks: { tab: 'disaster', label: 'Risk deep-dive' },
    costIncentives: { tab: 'tax', label: 'Incentives deep-dive' },
};

/* Axis presentation decomposition — SAME weights as site-adapter scoreSite()
 * axes map (documented there). Engine-factor components only; adapter-local
 * components (aqi/cyclone/land parts/hyper) are covered via attribute
 * provenance + levers, whose deltas come from the real formula anyway. */
const AXIS_FACTORS: Record<AxisKey, { key: FactorKey; w: number }[]> = {
    powerAvailability: [{ key: 'power', w: 0.6 }, { key: 'grid', w: 0.4 }],
    connectivity: [{ key: 'latency', w: 1 }],
    waterCooling: [{ key: 'water', w: 0.5 }, { key: 'climate', w: 0.5 }],
    landInfra: [],
    environmental: [{ key: 'carbon', w: 0.5 }, { key: 'climate', w: 0.3 }],
    naturalRisks: [{ key: 'seismic', w: 0.5 }, { key: 'flood', w: 0.3 }],
    costIncentives: [{ key: 'tax', w: 0.4 }, { key: 'power', w: 0.35 }],
    marketProximity: [{ key: 'latency', w: 0.6 }],
};

/** Attributes that feed each axis (for the baseline-provenance note + fill lever). */
const AXIS_ATTRS: Record<AxisKey, { key: keyof SiteAttributes; label: string }[]> = {
    powerAvailability: [
        { key: 'saidiMinYr', label: 'SAIDI' }, { key: 'powerCostKwh', label: 'Power Cost' },
    ],
    connectivity: [
        { key: 'submarineCableLandings', label: 'Cable Landings' }, { key: 'latencies', label: 'Latency entries' },
    ],
    waterCooling: [
        { key: 'waterStress0to5', label: 'Water Stress' }, { key: 'coolingDegreeDays', label: 'Cooling Degree Days' },
    ],
    landInfra: [
        { key: 'roadAccess', label: 'Road Access' }, { key: 'permitMonths', label: 'Permit Months' }, { key: 'distPortKm', label: 'Dist. Port' },
    ],
    environmental: [
        { key: 'airQualityIndex', label: 'AQI' },
    ],
    naturalRisks: [
        { key: 'pgaPct2in50yr', label: 'PGA' }, { key: 'floodRisk', label: 'Flood Risk' }, { key: 'cycloneRisk', label: 'Cyclone Risk' },
    ],
    costIncentives: [
        { key: 'effectiveTaxRate', label: 'Effective Tax Rate' }, { key: 'landCostPerM2', label: 'Land Cost' }, { key: 'powerCostKwh', label: 'Power Cost' },
    ],
    marketProximity: [
        { key: 'submarineCableLandings', label: 'Cable Landings' }, { key: 'latencies', label: 'Latency entries' },
    ],
};

/* Continuous numeric levers per axis: lo = current effective value (fails),
 * hi = strongest realistic move. All monotone toward passing (site-adapter
 * formulas are monotone in each attribute over these ranges). */
interface NumLeverDef { attr: keyof SiteAttributes; label: string; hi: number; fmt: (v: number) => string; hint: string }
const NUM_LEVERS: Partial<Record<AxisKey, NumLeverDef[]>> = {
    powerAvailability: [
        { attr: 'saidiMinYr', label: 'SAIDI', hi: 30, fmt: (v) => `${Math.round(v)} min/yr`, hint: 'dedicated feeder / dedicated substation / dual-source substation' },
        { attr: 'powerCostKwh', label: 'Power tariff', hi: 0.05, fmt: (v) => `$${v.toFixed(3)}/kWh`, hint: 'industrial tariff negotiation / PPA' },
    ],
    waterCooling: [
        { attr: 'waterStress0to5', label: 'Water stress (WRI)', hi: 0.2, fmt: (v) => `${v.toFixed(1)}/5`, hint: 'alternative water source / recycled water' },
        { attr: 'coolingDegreeDays', label: 'Cooling degree days', hi: 800, fmt: (v) => `${Math.round(v)} CDD`, hint: 'local climate factor — highland micro-location' },
    ],
    landInfra: [
        { attr: 'permitMonths', label: 'Permit', hi: 3, fmt: (v) => `${Math.round(v)} mo`, hint: 'fast-tracked permitting / SEZ' },
        { attr: 'distPortKm', label: 'Port distance', hi: 5, fmt: (v) => `${Math.round(v)} km`, hint: 'land option closer to the port' },
    ],
    environmental: [
        { attr: 'airQualityIndex', label: 'AQI', hi: 10, fmt: (v) => `AQI ${Math.round(v)}`, hint: 'micro-location away from heavy-industrial zones' },
    ],
    costIncentives: [
        { attr: 'effectiveTaxRate', label: 'Effective tax rate', hi: 0, fmt: (v) => `${(v * 100).toFixed(0)}%`, hint: 'tax holiday / SEZ incentive' },
        { attr: 'landCostPerM2', label: 'Land cost', hi: 30, fmt: (v) => `$${Math.round(v)}/m²`, hint: 'industrial land outside the prime zone' },
    ],
};

/* Discrete moves (enum attrs + stepped tables): delta computed by evaluating
 * the real formula at the candidate value — no interpolation. */
interface DiscreteMoveDef { label: string; from: string; to: string; mods: Partial<SiteAttributes>; hint: string }

export interface AxisExplain {
    axis: AxisKey;
    /** Goodness 0-100 (naturalRisks already on the goodness scale here). */
    goodness: number;
    band: string;
    /** Computed sentence: weakest live contributor (axis weight × factor value). */
    reason: string;
    /** Attributes still on country-baseline / screening defaults, or null. */
    baselineNote: string | null;
    levers: DecisionLever[];
}

const effectiveAttr = (site: CandidateSite, k: keyof SiteAttributes): number | null => {
    const own = site.attributes[k];
    if (typeof own === 'number' && Number.isFinite(own)) return own;
    const base = countryBaselineAttributes(site.countryId)[k as keyof ReturnType<typeof countryBaselineAttributes>];
    if (typeof base === 'number') return base;
    const scr = SCREENING_ATTR_DEFAULTS[k];
    return typeof scr === 'number' ? scr : null;
};

/** Recompute one axis through the page's own model with attribute overrides. */
const axisAt = (site: CandidateSite, axis: AxisKey, mods: Partial<SiteAttributes>): number | null => {
    const r = scoreSite({ ...site, attributes: { ...site.attributes, ...mods } });
    return r ? r.axes[axis] : null;
};

/** First candidate (least → most aggressive order) whose real recomputed axis ≥ target. */
function solveDiscrete(site: CandidateSite, axis: AxisKey, cur: number, moves: DiscreteMoveDef[]): DecisionLever | null {
    let bestFallback: { def: DiscreteMoveDef; g: number } | null = null;
    for (const def of moves) {
        const g = axisAt(site, axis, def.mods);
        if (g == null) continue;
        if (g >= GOOD_TARGET) {
            return {
                label: `${def.label} ${def.from} → ${def.to}`,
                detail: `${def.label} ${def.from} → ${def.to} (${def.hint}) raises the axis ${cur} → ${g} (+${g - cur} pts, reaching Good ≥${GOOD_TARGET}) — computed from the live axis formula.`,
                targetTab: EDIT_CRITERIA_TAB,
                priority: 'HIGH',
            };
        }
        if (g > cur && (!bestFallback || g > bestFallback.g)) bestFallback = { def, g };
    }
    if (bestFallback && bestFallback.g - cur >= 1) {
        const { def, g } = bestFallback;
        return {
            label: `${def.label} ${def.from} → ${def.to} (+${g - cur})`,
            detail: `${def.label} ${def.from} → ${def.to} (${def.hint}) raises the axis ${cur} → ${g} (+${g - cur} pts) — not yet reaching Good ${GOOD_TARGET}; combine with other levers.`,
            targetTab: EDIT_CRITERIA_TAB,
            priority: 'MED',
        };
    }
    return null;
}

/** Poor/Fair axis → reason + solved levers. Deterministic; every number from scoreSite(). */
export function explainAxis(site: CandidateSite, result: SiteScoreResult, axis: AxisKey): AxisExplain {
    const goodness = result.axes[axis];
    const band = axisBand(goodness).label;
    const axisLabel = AXIS_LABELS[axis];

    /* ── reason: weakest engine-factor contributor, axis weight × LIVE factor value ── */
    const bd = new Map(result.engine.breakdown.map((b) => [b.key, b.value]));
    const parts = AXIS_FACTORS[axis]
        .map((f) => ({ ...f, value: bd.get(f.key) ?? null }))
        .filter((f): f is { key: FactorKey; w: number; value: number } => f.value != null)
        .sort((a, b) => a.value - b.value);
    const weakest = parts[0];
    let reason = `${axisLabel} ${goodness}/100 (${band}).`;
    if (weakest) {
        const pts = Math.round(weakest.w * weakest.value * 100);
        const cap = Math.round(weakest.w * 100);
        reason += ` Weakest contributor: factor ${weakest.key} — live value ${Math.round(weakest.value * 100)}% (deriveFactors) × axis weight ${cap}% = ${pts} of ${cap} pts.`;
    } else {
        reason += ' This axis is computed from site/country attributes (not a direct engine factor) — see levers below.';
    }

    /* ── baseline provenance note + "isi atribut" lever ── */
    const baseline = countryBaselineAttributes(site.countryId);
    const unset = AXIS_ATTRS[axis].filter((a) => {
        const v = site.attributes[a.key];
        return v == null || (Array.isArray(v) && v.length === 0);
    });
    const baselineNote = unset.length
        ? `Attributes still on country / screening baseline: ${unset.map((a) => a.label).join(', ')} — enter site-specific values via Edit Criteria to sharpen the score.`
        : null;

    const levers: DecisionLever[] = [];
    if (unset.length) {
        levers.push({
            label: `Fill in site attributes (${unset.length} empty)`,
            detail: `${unset.map((a) => a.label).join(', ')} still use the ${site.countryId} baseline${baseline && Object.keys(baseline).length ? '' : ' / screening typical'} — open Edit Criteria and enter actual site data; the score recomputes live.`,
            targetTab: EDIT_CRITERIA_TAB,
            priority: 'MED',
        });
    }

    /* ── continuous levers: solved by explainThresholdMetric bisection over scoreSite ── */
    const specs: ThresholdLeverSpec[] = [];
    for (const def of NUM_LEVERS[axis] ?? []) {
        const cur = effectiveAttr(site, def.attr);
        if (cur == null) continue;
        // Only meaningful when the move direction exists (hi strictly better than current).
        if (Math.abs(cur - def.hi) < 1e-9) continue;
        specs.push({
            lo: cur,
            hi: def.hi,
            metricAt: (x) => axisAt(site, axis, { [def.attr]: x } as Partial<SiteAttributes>) ?? goodness,
            render: (x, achieved) => (Math.abs(x - cur) < Math.abs(cur - def.hi) * 1e-6
                ? { // solver landed on the current effective value: attribute was unset — materializing it already passes
                    label: `Fill in ${def.label} = ${def.fmt(cur)} (site attribute)`,
                    detail: `Filling in ${def.label} ${def.fmt(cur)} as a site attribute (currently baseline/screening) already brings the axis to ${achieved} (≥${GOOD_TARGET} Good) — confirm the actual value via Edit Criteria.`,
                }
                : {
                    label: `${def.label} ${def.fmt(cur)} → ${def.fmt(x)}`,
                    detail: `${def.label} ${def.fmt(cur)} → target ${def.fmt(x)} (${def.hint}) raises the axis ${goodness} → ${achieved} (+${achieved - goodness} pts, ≥${GOOD_TARGET} Good) — delta computed from the live axis formula (scoreSite).`,
                }),
            unreachable: (atHi) => ({
                label: `${def.label}: not enough on its own`,
                detail: `Even ${def.label} → ${def.fmt(def.hi)} only brings the axis to ${Math.round(atHi)} (<${GOOD_TARGET}) — combine several attributes or the binding country factors.`,
            }),
            targetTab: EDIT_CRITERIA_TAB,
        });
    }
    if (specs.length) {
        const solved = explainThresholdMetric({
            metricLabel: axisLabel,
            value: goodness,
            threshold: GOOD_TARGET,
            direction: 'atLeast',
            fmtValue: (v) => `${Math.round(v)}/100`,
            levers: specs,
        });
        levers.push(...solved.levers);
    }

    /* ── discrete levers (enum attrs / stepped engine tables) ── */
    const discrete: DiscreteMoveDef[] = [];
    if (axis === 'connectivity' || axis === 'marketProximity') {
        const cur = effectiveAttr(site, 'submarineCableLandings') ?? 0;
        for (let c = Math.floor(cur) + 1; c <= 6; c++) {
            discrete.push({ label: 'Cable landings', from: String(cur), to: String(c), mods: { submarineCableLandings: c }, hint: 'additional cable route/IXP' });
        }
    }
    if (axis === 'naturalRisks') {
        const pga = effectiveAttr(site, 'pgaPct2in50yr');
        if (pga != null) {
            // engine pgaToScore band edges (site-adapter FALLBACK_PGA_TO_SCORE): <5 / <15 / <30 / <60
            // [59,29,14,4] is already least→most aggressive (engine band edges 60/30/15/5)
            for (const cand of [59, 29, 14, 4].filter((c) => c < pga)) {
                discrete.push({ label: 'PGA', from: `${pga}%g`, to: `<${cand + 1}%g`, mods: { pgaPct2in50yr: cand }, hint: 'micro-location in a lower seismic zone' });
            }
        }
        if ((site.attributes.floodRisk ?? 'moderate') !== 'low') {
            discrete.push({ label: 'Flood risk', from: site.attributes.floodRisk ?? 'baseline', to: 'low', mods: { floodRisk: 'low' }, hint: 'platform elevation / flood defence' });
        }
        if ((site.attributes.cycloneRisk ?? 'moderate') !== 'low') {
            discrete.push({ label: 'Cyclone risk', from: site.attributes.cycloneRisk ?? 'baseline', to: 'low', mods: { cycloneRisk: 'low' }, hint: 'location outside the cyclone track' });
        }
    }
    if (axis === 'landInfra' && site.attributes.roadAccess !== 'excellent') {
        discrete.push({ label: 'Road access', from: site.attributes.roadAccess ?? 'baseline', to: 'excellent', mods: { roadAccess: 'excellent' }, hint: 'heavy-haul / oversize cargo road access' });
    }
    if (discrete.length) {
        const lever = solveDiscrete(site, axis, goodness, discrete);
        if (lever) levers.push(lever);
    }

    /* ── honesty notes: country-level factors no site attribute can move ── */
    if (axis === 'environmental' && weakest?.key === 'carbon') {
        levers.push({
            label: 'Carbon: country grid factor',
            detail: `The weakest contributor is grid carbon intensity (country-level, 50% axis weight) — not a site attribute. Real levers: renewable PPA / choose a country with a low-carbon grid.`,
            targetTab: '',
            priority: 'MED',
        });
    }
    if (axis === 'marketProximity') {
        levers.push({
            label: 'Hyperscaler ecosystem = country-level',
            detail: 'The hyperscaler-presence component (40% axis weight) comes from the country table — it cannot be changed per site; focus on latency & cable landings.',
            targetTab: '',
            priority: 'MED',
        });
    }

    return { axis, goodness, band, reason, baselineNote, levers: levers.slice(0, 4) };
}
