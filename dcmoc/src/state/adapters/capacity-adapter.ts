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

export interface UtilRow { key: string; label: string; used: number; capacity: number; pct: number; unit: string; basis: 'engine' | 'derived' | 'assumption' }

export function utilization(i: CapInputs, facilityMw: number): { rows: UtilRow[]; binding: string | null; stranded: { strandedKw: number; fraction: number; isStranded: boolean } | null } {
    const m = rzModels()?.capacity;
    const margin = 1 + i.designMarginPct / 100;
    const designPowerMva = +((facilityMw * margin) / 0.9).toFixed(0);
    const designCoolingMw = +((facilityMw - i.itLoadKw / 1000) * margin + (i.itLoadKw / 1000)).toFixed(0);
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
    const designRacks = Math.max(racks, maxRacksBySpace || racks);
    const rackFootprint: number = rzData()?.capacity?.rackFootprintM2 ?? 0.72;
    const usedSpace = Math.round(racks * rackFootprint / 0.35); // gross-up: white space ≈ rack footprint / 35% utilization factor (screening)
    const rows: UtilRow[] = [
        { key: 'power', label: 'Power Capacity', used: +(facilityMw / 0.9).toFixed(0), capacity: designPowerMva, pct: Math.round((facilityMw / 0.9 / Math.max(1, designPowerMva)) * 100), unit: 'MVA', basis: 'derived' },
        { key: 'cooling', label: 'Cooling Capacity', used: +(facilityMw - i.itLoadKw / 1000 + i.itLoadKw / 1000 * 0.95).toFixed(0), capacity: designCoolingMw, pct: Math.round(((facilityMw) / Math.max(1, designCoolingMw)) * 100), unit: 'MW', basis: 'derived' },
        { key: 'rack', label: 'Rack Capacity', used: racks, capacity: designRacks, pct: Math.round((racks / Math.max(1, designRacks)) * 100), unit: 'racks', basis: 'engine' },
        { key: 'space', label: 'Space Capacity', used: usedSpace, capacity: i.whiteFloorM2, pct: Math.round((usedSpace / Math.max(1, i.whiteFloorM2)) * 100), unit: 'm²', basis: 'engine' },
        { key: 'network', label: 'Network Capacity', used: +(racks * 0.0015).toFixed(1), capacity: +(designRacks * 0.0015 * margin).toFixed(1), pct: Math.round((racks / Math.max(1, designRacks * margin)) * 100), unit: 'Tbps', basis: 'assumption' },
    ];
    return { rows, binding, stranded };
}

export interface ComponentRow { label: string; config: string; utilPct: number; status: 'OK' | 'Watch' | 'At Risk'; remediation?: string }

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
                ? `Utilisasi ${pct}% > 85%: tambah +${addUnits} unit (${count}→${needed}) untuk target ≤80%, ATAU turunkan beban ${(shedKw / 1000).toFixed(1)} MW (phase plan / IT load), ATAU naikkan rating unit di atas ${(ratingKw / 1000).toFixed(1)} MW.`
                : `Utilisasi ${pct}% (Watch 70-85%): fase berikutnya akan melewati 85% — rencanakan +${Math.max(1, addUnits)} unit atau tahan pertumbuhan beban di ≤${(maxLoadKw / 1000).toFixed(1)} MW.`;
        }
        return { label, config: `${count}× ${(ratingKw / 1000).toFixed(1)} MW`, utilPct: pct, status, remediation };
    };
    return {
        source: 'engine equipScale · ratings = scaling divisors (screening)',
        rows: [
            mk('Utility Intake', 2, facilityKw / 1.6, facilityKw),
            mk('Generators', eq.generators, 2000, facilityKw),
            mk('UPS Modules', eq.ups_modules, 500, i.itLoadKw),
            mk('PDUs', eq.pdus, 100, i.itLoadKw),
            mk('Busway', eq.busway ?? Math.ceil(i.itLoadKw / 2000) + 1, 2000, i.itLoadKw),
            mk('Chillers', eq.chillers, 500, facilityKw - i.itLoadKw),
        ],
    };
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
