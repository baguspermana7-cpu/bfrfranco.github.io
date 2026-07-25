/* ─── CAPACITY DATA ADAPTER (Phase D) ────────────────────────────────────────
 * Pure derivations over models.capacity + equipScale for the Capacity
 * Planning Engine. Design capacities default to derived-from-ultimate-
 * buildout values (override wins). Network capacity = LABELED ASSUMPTION
 * (no engine model). Facility overhead donut = documented screening split
 * of the (PUE−1) overhead — not an engine field.
 * ──────────────────────────────────────────────────────────────────────── */

import { rzModels, rzData } from '@/lib/rz-engine';
import { OVERHEAD_SPLIT } from '@/lib/screening';
import { getPUE } from '@/constants/pue';
import { densityToEngineBucket } from '@/lib/requirementsMappings';

export interface CapacityPhase { id: string; label: string; itLoadKw: number; startMonth: number; buildMonths: number; occupancyRamp: number[] }

export interface CapInputs {
    itLoadKw: number; tier: 2 | 3 | 4; coolingType: string;
    rackKw: number; whiteFloorM2: number; baseYear: number;
    marketType: 'hyperscale' | 'wholesale' | 'retail' | 'enterprise';
    phases: CapacityPhase[];
    designMarginPct: number;
    growthMwByYear: { label: string; mw: number }[]; // from requirements derived series
}

const clamp = (v: number, lo: number, hi: number, d: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export function sanitizeCap(raw: Partial<CapInputs>): CapInputs {
    return {
        itLoadKw: clamp(raw.itLoadKw ?? 2500, 100, 500_000, 2500),
        tier: ([2, 3, 4].includes(raw.tier as number) ? raw.tier : 3) as 2 | 3 | 4,
        coolingType: raw.coolingType ?? 'air',
        rackKw: clamp(raw.rackKw ?? 12, 1, 200, 12),
        whiteFloorM2: clamp(raw.whiteFloorM2 ?? 1500, 50, 200_000, 1500),
        baseYear: clamp(raw.baseYear ?? 2025, 2020, 2050, 2025),
        marketType: (['hyperscale', 'wholesale', 'retail', 'enterprise'].includes(raw.marketType as string) ? raw.marketType : 'wholesale') as CapInputs['marketType'],
        phases: raw.phases ?? [],
        designMarginPct: clamp(raw.designMarginPct ?? 10, 0, 30, 10),
        growthMwByYear: raw.growthMwByYear ?? [],
    };
}

export function facilitySnapshot(i: CapInputs): { facilityMw: number; pue: number; source: string } {
    const m = rzModels()?.capacity;
    try {
        if (m?.facilityLoad) {
            const r = m.facilityLoad(i.itLoadKw, i.coolingType, i.tier);
            if (r?.facilityLoadMw) return { facilityMw: r.facilityLoadMw, pue: r.pueUsed, source: 'engine' };
        }
    } catch { /* */ }
    const pue = rzData()?.pueMatrix?.[i.coolingType]?.['tier' + i.tier] ?? getPUE(i.coolingType);
    return { facilityMw: +((i.itLoadKw / 1000) * pue).toFixed(1), pue, source: 'fallback' };
}

/** Screening split of (PUE−1) overhead — SHARED OVERHEAD_SPLIT (lib/screening.ts), one source with arch-adapter. */
export function overheadDonut(i: CapInputs, facilityMw: number): { name: string; mw: number; pct: number }[] {
    const itMw = i.itLoadKw / 1000;
    const ov = Math.max(0, facilityMw - itMw);
    const rows = [
        { name: 'IT Load (Racks)', mw: itMw },
        { name: 'Cooling Systems', mw: ov * OVERHEAD_SPLIT.cooling },
        { name: 'Power Losses', mw: ov * OVERHEAD_SPLIT.power },
        { name: 'Lighting & Small Power', mw: ov * OVERHEAD_SPLIT.lighting },
        { name: 'Other', mw: ov * OVERHEAD_SPLIT.other },
    ];
    return rows.map((r) => ({ ...r, mw: +r.mw.toFixed(2), pct: facilityMw > 0 ? +((r.mw / facilityMw) * 100).toFixed(1) : 0 }));
}

export interface ForecastRow { year: number; label: string; committedMw: number; forecastMw: number; designMw: number }

export function forecastSeries(i: CapInputs, designPowerMw: number, horizon = 10): ForecastRow[] {
    const rows: ForecastRow[] = [];
    const growth = new Map(i.growthMwByYear.map((g) => [g.label, g.mw]));
    for (let n = 0; n <= horizon; n++) {
        const year = i.baseYear + n;
        const month = n * 12;
        const committedKw = i.phases.filter((p) => p.startMonth + p.buildMonths <= month).reduce((s, p) => s + p.itLoadKw, 0);
        const gKey = n === 0 ? 'Y0 (COD)' : `Y${n}`;
        let forecastMw = growth.get(gKey) ?? 0;
        if (!forecastMw) {
            // interpolate between known growth points; fallback = committed × S-curve occupancy
            const known = i.growthMwByYear.filter((g) => g.mw > 0);
            if (known.length >= 2 && n <= 10) {
                const y0 = i.itLoadKw / 1000;
                forecastMw = +(y0 * Math.pow((known[known.length - 1].mw / y0) || 1, n / 10)).toFixed(1);
            } else forecastMw = +(committedKw / 1000).toFixed(1);
        }
        rows.push({ year, label: n === 0 ? `Y0` : `Y${n}`, committedMw: +(committedKw / 1000).toFixed(1), forecastMw, designMw: designPowerMw });
    }
    return rows;
}

export interface UtilRow {
    key: string; label: string; used: number; capacity: number; pct: number; unit: string;
    basis: 'engine' | 'derived' | 'assumption';
    /* Forecast-aware banding (owner decision 2026-07-20): current pct is structurally
     * ≈ 1/(1+margin) by construction, so STATUS derives from growth pressure —
     * peak forecast share of design capacity + first exhaustion year. */
    forecastPct?: number;
    exhaustYear?: number | null;
}

/* ── Workstream R — capacity-model coherence ─────────────────────────────────
 * Best-practice white-space NEED: design racks × footprint ÷ 35% utilization
 * factor (gross-up). The building input should not be guesswork — this is the
 * auto basis; a larger user-entered building simply adds headroom. */
export function autoWhiteSpaceM2(i: CapInputs): number {
    const rackFootprint: number = rzData()?.capacity?.rackFootprintM2 ?? 0.72;
    const phaseKw = i.phases.reduce((s, p) => s + (p.itLoadKw || 0), 0);
    const designKw = Math.max(i.itLoadKw, phaseKw);
    return Math.ceil((designKw / Math.max(1, i.rackKw)) * rackFootprint / 0.35);
}

/* Margin-aware utilization bands. WITHOUT a phase plan, capacity scales WITH
 * the load, so steady-state utilization ≡ 1/(1+margin) — a STRUCTURAL FLOOR
 * the old fixed 70/85 bands ignored (margin 30% ⇒ 76.9% = "Watch" forever,
 * which read as "margin not enough"). OK now starts just above the floor;
 * with a committed phase plan the denominator is the BUILT program, real
 * absolute bands apply, and margin + phasing genuinely move utilization. */
export function utilBands(i: CapInputs): { okMax: number; watchMax: number; floorPct: number; hasPhasePlan: boolean } {
    const floorPct = Math.round(100 / (1 + i.designMarginPct / 100));
    const phaseKw = i.phases.reduce((s, p) => s + (p.itLoadKw || 0), 0);
    const hasPhasePlan = phaseKw > i.itLoadKw;
    return { floorPct, hasPhasePlan, okMax: hasPhasePlan ? 70 : Math.min(84, floorPct + 3), watchMax: 85 };
}

export function utilization(i: CapInputs, facilityMw: number): { rows: UtilRow[]; binding: string | null; stranded: { strandedKw: number; fraction: number; isStranded: boolean } | null } {
    const m = rzModels()?.capacity;
    const margin = 1 + i.designMarginPct / 100;
    /* R: design denominator = the BUILT program (committed phase plan) when one
     * exists — phasing + margin then genuinely move utilization; without a plan
     * capacity tracks the load and utilization sits at the 1/(1+m) floor. */
    const phasePlanKw = i.phases.reduce((s, p) => s + (p.itLoadKw || 0), 0);
    const builtScale = Math.max(1, phasePlanKw / Math.max(1, i.itLoadKw));
    const designPowerMva = +((facilityMw * builtScale * margin) / 0.9).toFixed(0);
    const designCoolingMw = +(((facilityMw - i.itLoadKw / 1000) * builtScale * margin) + (i.itLoadKw / 1000) * builtScale).toFixed(0);
    let binding: string | null = null; let maxRacksBySpace = 0; let racks = Math.ceil(i.itLoadKw / i.rackKw);
    try {
        if (m?.bindingConstraint) {
            const b = m.bindingConstraint(i.itLoadKw, i.rackKw, i.whiteFloorM2);
            binding = b?.binding ?? null; maxRacksBySpace = b?.maxRacksBySpace ?? 0; racks = b?.racks ?? racks;
        }
    } catch { /* */ }
    let stranded: { strandedKw: number; fraction: number; isStranded: boolean } | null = null;
    try {
        if (m?.strandedCapacity && m?.occupancyScurve) {
            const occ = m.occupancyScurve(1, i.marketType);
            const s = m.strandedCapacity(i.itLoadKw, occ);
            stranded = { strandedKw: s?.strandedKw ?? 0, fraction: s?.strandedFraction ?? 0, isStranded: !!s?.isStranded };
        }
    } catch { /* */ }
    const designRacks = Math.max(Math.ceil((i.itLoadKw * builtScale) / Math.max(1, i.rackKw)), maxRacksBySpace || 0, racks);
    const rackFootprint: number = rzData()?.capacity?.rackFootprintM2 ?? 0.72;
    const usedSpace = Math.round(racks * rackFootprint / 0.35); // gross-up: white space ≈ rack footprint / 35% utilization factor (screening)
    /* R: white space is AUTO-derived from the design rack count (best practice);
     * a user-entered building only matters when LARGER than the need. */
    const autoSpace = Math.ceil(autoWhiteSpaceM2(i) * margin);
    const spaceCapacity = Math.max(i.whiteFloorM2, autoSpace);
    const spaceBasis: UtilRow['basis'] = autoSpace >= i.whiteFloorM2 ? 'engine' : 'derived';
    const rows: UtilRow[] = [
        { key: 'power', label: 'Power Capacity', used: +(facilityMw / 0.9).toFixed(0), capacity: designPowerMva, pct: Math.round((facilityMw / 0.9 / Math.max(1, designPowerMva)) * 100), unit: 'MVA', basis: 'derived' },
        { key: 'cooling', label: 'Cooling Capacity', used: +(facilityMw - i.itLoadKw / 1000 + i.itLoadKw / 1000 * 0.95).toFixed(0), capacity: designCoolingMw, pct: Math.round(((facilityMw) / Math.max(1, designCoolingMw)) * 100), unit: 'MW', basis: 'derived' },
        { key: 'rack', label: 'Rack Capacity', used: racks, capacity: designRacks, pct: Math.round((racks / Math.max(1, designRacks)) * 100), unit: 'racks', basis: 'engine' },
        { key: 'space', label: 'Space Capacity', used: usedSpace, capacity: spaceCapacity, pct: Math.round((usedSpace / Math.max(1, spaceCapacity)) * 100), unit: 'm²', basis: spaceBasis },
        { key: 'network', label: 'Network Capacity', used: +(racks * 0.0015).toFixed(1), capacity: +(designRacks * 0.0015 * margin).toFixed(1), pct: Math.round((racks / Math.max(1, designRacks * margin)) * 100), unit: 'Tbps', basis: 'assumption' },
    ];
    /* Forecast overlay: scale each row's utilization by growth (all rows scale ∝ IT MW
     * at constant PUE/density — power/cooling via facility, rack/space/network via racks). */
    try {
        const series = forecastSeries(i, designPowerMva * 0.9);
        const itMwNow = Math.max(0.001, i.itLoadKw / 1000);
        const peakMw = Math.max(...series.map((r) => Math.max(r.forecastMw, r.committedMw)), itMwNow);
        const gf = Math.max(1, peakMw / itMwNow);
        for (const row of rows) {
            row.forecastPct = Math.min(400, Math.round(row.pct * gf));
            if (row.pct > 0) {
                const exhaustMw = itMwNow * (100 / row.pct);
                const hit = series.find((r) => Math.max(r.forecastMw, r.committedMw) >= exhaustMw);
                row.exhaustYear = hit ? hit.year : null;
            } else row.exhaustYear = null;
        }
    } catch { /* forecast unavailable — rows keep current pct only */ }
    return { rows, binding, stranded };
}

export interface ComponentRow { label: string; config: string; utilPct: number; status: 'OK' | 'Watch' | 'At Risk'; remediation?: string; tip?: string }

/** Power components from the engine equipment-scaling model; ratings = scaling divisors (screening). */
export function equipmentTable(i: CapInputs): { rows: ComponentRow[]; source: string } {
    const m = rzModels()?.commissioning;
    let eq: Record<string, number> | null = null;
    try { eq = m?.equipScale ? m.equipScale({ itLoad: i.itLoadKw, rackDensity: densityToEngineBucket(i.rackKw) }) : null; } catch { /* */ }
    if (!eq) return { rows: [], source: 'engine absent' };
    const facilityKw = i.itLoadKw * (rzData()?.pueMatrix?.[i.coolingType]?.['tier' + i.tier] ?? 1.4);
    const mk = (label: string, count: number, ratingKw: number, loadKw: number): ComponentRow => {
        const pct = Math.min(150, Math.round((loadKw / Math.max(1, count * ratingKw)) * 100));
        const status = pct < 70 ? 'OK' as const : pct < 85 ? 'Watch' as const : 'At Risk' as const;
        /* DD (owner: "At Risk itu apa maksudnya — kasih guidance jelas apa yang
         * di-finetune"): hitung DEFISIT persis dari divisor yang sama, sebutkan
         * PARAMETER + JUMLAH + tuas alternatifnya. */
        let remediation: string | undefined;
        if (status !== 'OK') {
            const needed = Math.ceil(loadKw / (0.8 * ratingKw));           // target ≤80% utilization
            const addUnits = Math.max(0, needed - count);
            const maxLoadKw = Math.floor(count * ratingKw * 0.8);
            const shedKw = Math.max(0, loadKw - maxLoadKw);
            remediation = status === 'At Risk'
                ? `Utilization ${pct}% > 85%: add +${addUnits} unit(s) (${count}→${needed}) to target ≤80%, OR shed ${(shedKw / 1000).toFixed(1)} MW of load (phase plan / IT load), OR raise the unit rating above ${(ratingKw / 1000).toFixed(1)} MW.`
                : `Utilization ${pct}% (Watch 70-85%): the next phase will cross 85% — plan +${Math.max(1, addUnits)} unit(s) or hold load growth at ≤${(maxLoadKw / 1000).toFixed(1)} MW.`;
        }
        return { label, config: `${count}× ${(ratingKw / 1000).toFixed(1)} MW`, utilPct: pct, status, remediation };
    };
    /* Generators back the WHOLE FACILITY (IT + cooling + losses = facilityKw),
     * so their count must be sized from facilityKw — not IT load. The engine
     * equipScale.generators counts from IT load (ceil(itLoad/2000)), which under
     * the facility-load divisor produced utilization = facility/IT ≈ PUE > 100%
     * (the reported "115%" bug — a genuinely under-sized genset plant, not just a
     * display glitch). Re-derive the genset count on the facility basis so a
     * self-sized component can never exceed 100%. */
    const genCountFacility = Math.ceil(facilityKw / 2000);
    return {
        source: 'engine equipScale · ratings = scaling divisors · gensets sized on facility load (screening)',
        rows: [
            mk('Utility Intake', 2, facilityKw / 1.6, facilityKw),
            mk('Generators', genCountFacility, 2000, facilityKw),
            mk('UPS Modules', eq.ups_modules, 500, i.itLoadKw),
            mk('PDUs', eq.pdus, 100, i.itLoadKw),
            mk('Busway', eq.busway ?? Math.ceil(i.itLoadKw / 2000) + 1, 2000, i.itLoadKw),
            mk('Chillers', eq.chillers, 500, facilityKw - i.itLoadKw),
        ],
    };
}

/* ─── Workstream L: deep system-detail tables (cooling / rack & space / network) ──
 * Same ComponentRow shape + banding as the Power equipment table so all four
 * system tabs render identically. Counts reuse engine equipScale divisors where
 * available (screening); cooling DUTY basis = IT heat, NOT IT × PUE (the PUE
 * overhead is parasitic fan/pump power, not heat the primary loop must reject —
 * multiplying duty by PUE overcounted CRAH/chilled-water sizing, v1.103.1 rule). */

/** Air-side residual heat share by cooling technology — fraction of IT heat still
 * rejected through room air handlers after the primary loop (screening split). */
const AIR_SIDE_SHARE: Record<string, number> = {
    air: 1, inrow: 1, rdhx: 0.30, liquid: 0.25,
    immersion: 0.05, immersion_1p: 0.05, immersion_2p: 0.03, microfluidic: 0.05,
};

/** Practical per-rack density ceiling (kW/rack) by cooling technology — screening
 * industry ranges (air CRAH ~20, in-row ~30, RDHx ~40, DLC ~120, immersion ~200+). */
export const DENSITY_CEILING_KW: Record<string, number> = {
    air: 20, inrow: 30, rdhx: 40, liquid: 120,
    immersion: 200, immersion_1p: 200, immersion_2p: 250, microfluidic: 250,
};

const COOLING_LABEL: Record<string, string> = {
    air: 'air/CRAH', inrow: 'in-row', rdhx: 'rear-door HX', liquid: 'direct liquid (CDU)',
    immersion: 'immersion 1φ', immersion_1p: 'immersion 1φ', immersion_2p: 'immersion 2φ', microfluidic: 'microfluidic',
};

const bandStatus = (pct: number): ComponentRow['status'] => (pct < 70 ? 'OK' : pct < 85 ? 'Watch' : 'At Risk');

/** Shared unit-scaled row builder (same math + remediation grammar as the Power
 * table's mk()): utilization = duty ÷ (units × rating), levers quantified to ≤80%. */
function mkScaledRow(label: string, count: number, ratingKw: number, loadKw: number, tip: string, escalation?: string): ComponentRow {
    const pct = Math.min(150, Math.round((loadKw / Math.max(1, count * ratingKw)) * 100));
    const status = bandStatus(pct);
    let remediation: string | undefined;
    if (status !== 'OK') {
        const needed = Math.ceil(loadKw / (0.8 * ratingKw));
        const addUnits = Math.max(1, needed - count);
        remediation = status === 'At Risk'
            ? `Utilization ${pct}% > 85%: add +${addUnits} unit(s) (${count}→${Math.max(needed, count + addUnits)}) to target ≤80%, OR raise the unit rating above ${(ratingKw / 1000).toFixed(1)} MW, OR shed load via the phase plan.${escalation ? ' ' + escalation : ''}`
            : `Utilization ${pct}% (Watch 70-85%): the next phase will cross 85% — plan +${addUnits} unit(s) or hold duty at ≤${(Math.floor(count * ratingKw * 0.8) / 1000).toFixed(1)} MW.${escalation ? ' ' + escalation : ''}`;
    }
    return { label, config: `${count}× ${(ratingKw / 1000).toFixed(1)} MW`, utilPct: pct, status, remediation, tip };
}

/** Cooling components: engine equipScale counts (screening divisor ratings); duty
 * basis = IT heat. Free-cooling note: economizer hours cut compressor ENERGY, not
 * installed capacity — plants are sized for the design day. */
export function coolingEquipmentTable(i: CapInputs): { rows: ComponentRow[]; source: string } {
    const m = rzModels()?.commissioning;
    let eq: Record<string, number> | null = null;
    try { eq = m?.equipScale ? m.equipScale({ itLoad: i.itLoadKw, rackDensity: densityToEngineBucket(i.rackKw) }) : null; } catch { /* */ }
    const itHeatKw = i.itLoadKw;                                   // duty basis = IT heat, NOT IT × PUE
    const airShare = AIR_SIDE_SHARE[i.coolingType] ?? 1;
    const isLiquid = airShare <= 0.25;                             // liquid / immersion / microfluidic → CDU loops
    const techLabel = COOLING_LABEL[i.coolingType] ?? i.coolingType;
    const chillerCount = eq?.chillers ?? Math.ceil(itHeatKw / 500);
    const crahCount = eq?.cooling_units ?? Math.ceil(itHeatKw / 200);
    const pumpCount = eq?.pumps ?? Math.ceil(itHeatKw / 300);
    const rejCount = Math.ceil(itHeatKw / 1000) + 1;               // N+1 heat-rejection cells @ ~1 MW (screening)
    const freeNote = 'Free-cooling/economizer hours reduce compressor energy (OPEX), NOT installed capacity — size for the design day.';
    return {
        source: eq ? 'engine equipScale · ratings = scaling divisors (screening)' : 'fallback divisors (engine absent) · screening',
        rows: [
            mkScaledRow(
                isLiquid ? `CDU Loops (${techLabel})` : `Chillers (${techLabel})`,
                chillerCount, 500, itHeatKw,
                isLiquid
                    ? 'Coolant distribution units — the primary liquid loop between the rack cold plates/tanks and the facility water system. Duty basis is the IT heat load itself (kW of electronics heat), not IT × PUE. Count scales from the engine equipScale divisor (1 per ~500 kW).'
                    : 'Central chilled-water plant. Duty basis is the IT heat load (kW), not IT × PUE — the PUE overhead is parasitic fan/pump power, not additional heat the chillers must remove. Count scales from the engine equipScale divisor (1 per ~500 kW).',
                freeNote),
            mkScaledRow('CRAH / AHU Units', crahCount, 200, Math.round(itHeatKw * airShare),
                `Computer-room air handlers and AHUs on the air side. For ${techLabel} cooling the air-side residual is ~${Math.round(airShare * 100)}% of IT heat (the rest leaves via the liquid loop) — a screening split, so the duty here is IT heat × that share. Unit rating from the engine divisor (~200 kW each).`,
                'Adding CRAH units helps only the AIR-SIDE residual — for liquid-cooled halls the CDU loop is usually the real constraint.'),
            mkScaledRow('CHW / CDU Pumps', pumpCount, 300, itHeatKw,
                'Chilled-water (or CDU secondary) pumps circulating the full IT heat duty through the hydronic loop. Count from the engine equipScale divisor (1 per ~300 kW of duty); rating expressed as thermal duty served per pump, a screening convention.',
                'Pump additions are cheap relative to chillers — verify pipe header capacity before adding load.'),
            mkScaledRow('Heat Rejection (towers/dry coolers)', rejCount, 1000, itHeatKw,
                'Cooling towers or dry coolers rejecting the IT heat to ambient, sized N+1 at ~1 MW per cell (screening — compressor work adds ~15-25% on top in a real selection). Duty basis remains IT heat for consistency with the rest of this table.',
                freeNote),
        ],
    };
}

/** Rack & space rows incl. the power-vs-space BINDING CONSTRAINT (engine
 * bindingConstraint) and the density ceiling of the selected cooling technology. */
export function rackSpaceTable(i: CapInputs, utilRows: UtilRow[], binding: string | null): { rows: ComponentRow[]; source: string } {
    const rack = utilRows.find((u) => u.key === 'rack');
    const space = utilRows.find((u) => u.key === 'space');
    const ceiling = DENSITY_CEILING_KW[i.coolingType] ?? 20;
    const techLabel = COOLING_LABEL[i.coolingType] ?? i.coolingType;
    const rackFootprint: number = rzData()?.capacity?.rackFootprintM2 ?? 0.72;
    const densPct = Math.min(150, Math.round((i.rackKw / ceiling) * 100));
    const densStatus = bandStatus(densPct);
    const bindsSpace = binding === 'space';
    const bindPct = Math.max(rack?.pct ?? 0, space?.pct ?? 0);
    const rows: ComponentRow[] = [
        {
            label: 'Rack Positions', config: `${(rack?.used ?? 0).toLocaleString()} used / ${(rack?.capacity ?? 0).toLocaleString()} positions`,
            utilPct: rack?.pct ?? 0, status: bandStatus(rack?.pct ?? 0),
            tip: 'Rack positions consumed by the current IT load (IT kW ÷ kW/rack) vs. the positions the white space can physically hold (engine bindingConstraint). When used approaches available, either reserve more area or raise density.',
            remediation: (rack?.pct ?? 0) >= 70 ? `Rack positions at ${rack?.pct}%: reserve additional white-space area, OR raise avg density above ${i.rackKw} kW/rack (cooling ceiling ~${ceiling} kW for ${techLabel}), OR defer load via the phase plan.` : undefined,
        },
        {
            label: 'Avg Rack Density', config: `${i.rackKw} kW/rack · ceiling ~${ceiling} kW (${techLabel})`,
            utilPct: densPct, status: densStatus,
            tip: `Average design density vs. the practical ceiling of the selected cooling technology (~${ceiling} kW/rack for ${techLabel} — screening industry range). Raising density buys rack positions back but pushes toward a liquid-cooling upgrade once the ceiling is neared.`,
            remediation: densStatus !== 'OK' ? `Density ${i.rackKw} kW/rack is ${densPct}% of the ~${ceiling} kW ${techLabel} ceiling — further density gains require a cooling-technology step-up (RDHx → DLC → immersion), not just more airflow. Change density in Requirements; cooling type in Simulation setup.` : undefined,
        },
        {
            label: 'White Space', config: `${(space?.used ?? 0).toLocaleString()} / ${(space?.capacity ?? 0).toLocaleString()} m² (incl. gross-up)`,
            utilPct: space?.pct ?? 0, status: bandStatus(space?.pct ?? 0),
            tip: `Occupied white space vs. total. Occupied = racks × ${rackFootprint} m² footprint ÷ 35% utilization factor — the gross-up covers aisles, containment, ramps and clearances (screening convention, same basis as the utilization bar above).`,
            remediation: (space?.pct ?? 0) >= 70 ? `White space at ${space?.pct}%: reserve expansion area (building size in Simulation setup) or raise density (ceiling ~${ceiling} kW for ${techLabel}).` : undefined,
        },
        {
            label: 'Binding Constraint', config: bindsSpace ? 'SPACE binds before power' : 'POWER binds before space',
            utilPct: bindPct, status: bandStatus(bindPct),
            tip: 'Which resource runs out first as load grows (engine bindingConstraint): if POWER binds, the electrical capacity is exhausted while rack positions remain — adding m² only strands capacity. If SPACE binds, positions run out first — reserve area or raise density.',
            remediation: bindsSpace
                ? `Space binds: rack positions exhaust before electrical capacity — reserve additional area or raise density toward the ~${ceiling} kW ${techLabel} ceiling; extra power capacity would sit stranded.`
                : `Power binds: electrical capacity exhausts before rack positions — additional white space would strand; escalate power (design margin in Requirements, or a new build phase) instead of adding area.`,
        },
    ];
    return { rows, source: `engine bindingConstraint · footprint ${rackFootprint} m²/rack · gross-up ÷0.35 (screening)` };
}

/** Spine-leaf fabric estimate — SCREENING ASSUMPTION ONLY (no engine network
 * model): ~1 leaf per 16 racks, ~1 spine per 8 leaves (min 2), 4× 100G uplinks
 * per leaf, 3:1 oversubscription target. Validate with the fabric design. */
export function networkTable(i: CapInputs, utilRows: UtilRow[]): { rows: ComponentRow[]; source: string } {
    const net = utilRows.find((u) => u.key === 'network');
    const rackRow = utilRows.find((u) => u.key === 'rack');
    const racks = rackRow?.used ?? Math.ceil(i.itLoadKw / i.rackKw);
    const leaves = Math.max(1, Math.ceil(racks / 16));
    const spines = Math.max(2, Math.ceil(leaves / 8));
    const uplinks = leaves * 4;
    const fabricTbps = +((uplinks * 100) / 1000).toFixed(1);
    const pct = net?.pct ?? 0;
    const status = bandStatus(pct);
    const rem = status !== 'OK' ? `Fabric utilization ${pct}% (screening): plan spine/uplink expansion at the next phase — and replace this estimate with the real fabric design before committing.` : undefined;
    const rows: ComponentRow[] = [
        { label: 'Leaf / ToR Switches', config: `${leaves}× (1 per 16 racks)`, utilPct: pct, status, remediation: rem, tip: 'Top-of-rack/leaf switch count at the screening ratio of one leaf per 16 racks (dual-homed servers halve this in practice). Scales directly with rack positions — no engine network model backs this number.' },
        { label: 'Spine Switches', config: `${spines}× (1 per 8 leaves, min 2)`, utilPct: pct, status, remediation: rem, tip: 'Spine layer at ~1 spine per 8 leaves with a minimum of 2 for redundancy (screening). Real spine counts depend on radix, oversubscription target and failure-domain design.' },
        { label: 'Uplinks', config: `${uplinks}× 100G (4 per leaf · ${fabricTbps} Tbps raw)`, utilPct: pct, status, tip: 'Leaf-to-spine uplinks at 4× 100G per leaf (screening) with the raw aggregate they carry. AI/HPC fabrics typically run 8× 400G or more — treat this as a placeholder until the fabric design exists.' },
        { label: 'Oversubscription', config: '3:1 leaf→spine (target)', utilPct: pct, status, tip: 'Assumed leaf-to-spine oversubscription target. Enterprise fabrics commonly accept 3:1; AI training fabrics require 1:1 (non-blocking) — a fundamentally different switch count than shown here.' },
        { label: 'Fabric Capacity', config: `${net?.used ?? 0} / ${net?.capacity ?? 0} Tbps`, utilPct: pct, status, remediation: rem, tip: 'Aggregate fabric bandwidth from the utilization model (racks × 1.5 Gbps/rack screening factor vs. design capacity incl. margin). The same ASSUMPTION basis as the Network utilization bar above.' },
    ];
    return { rows, source: 'SCREENING ASSUMPTION — no engine network model; validate with the fabric design' };
}

export function capRecommendations(i: CapInputs, util: UtilRow[], forecast: ForecastRow[]): { title: string; body: string; tone: 'power' | 'cooling' | 'space' | 'network' | 'finance' }[] {
    const out: { title: string; body: string; tone: 'power' | 'cooling' | 'space' | 'network' | 'finance' }[] = [];
    const by = (k: string) => util.find((u) => u.key === k);
    const p = by('power');
    if (p && p.pct >= 70) out.push({ title: 'Power', body: `Power utilization ${p.pct}% — plan additional generation/UPS capacity before the next phase.`, tone: 'power' });
    else out.push({ title: 'Power', body: `Power headroom ${p ? 100 - p.pct : '—'}% — sufficient for the committed plan.`, tone: 'power' });
    const c = by('cooling');
    out.push({ title: 'Cooling', body: c && c.pct >= 70 ? `Cooling at ${c.pct}% — consider free-cooling / plant expansion.` : 'Consider free-cooling enhancement to improve efficiency.', tone: 'cooling' });
    const s = by('space');
    out.push({ title: 'Space', body: s && s.pct >= 70 ? `White space at ${s.pct}% — reserve additional area for expansion.` : `Reserve expansion area — current fit ${s?.pct ?? '—'}% of ${i.whiteFloorM2.toLocaleString()} m².`, tone: 'space' });
    const exhaust = forecast.find((f) => f.forecastMw > f.designMw);
    out.push({ title: 'Network', body: 'Validate spine-leaf uplink capacity at the next expansion step (screening assumption basis).', tone: 'network' });
    out.push({ title: 'Financial Impact', body: exhaust ? `Forecast exceeds design capacity at ${exhaust.year} — budget the next phase before then.` : 'Committed phases stay inside design capacity across the horizon.', tone: 'finance' });
    return out;
}

export function capKeyInsights(util: UtilRow[], forecast: ForecastRow[], baseYear: number): string[] {
    const out: string[] = [];
    for (const key of ['power', 'cooling'] as const) {
        const u = util.find((x) => x.key === key);
        if (!u) continue;
        const hit = forecast.find((f) => f.forecastMw >= f.designMw * (u.capacity > 0 ? 1 : 1));
        const years = hit ? hit.year - baseYear : null;
        out.push(years != null && years > 0
            ? `${u.label} sufficient for ~${years} year(s) at the forecast growth.`
            : `${u.label} at ${u.pct}% — monitor against growth.`);
    }
    const net = util.find((x) => x.key === 'network');
    if (net) out.push(`Network capacity basis is a screening assumption (${net.used}/${net.capacity} Tbps) — validate with the network design.`);
    return out;
}
