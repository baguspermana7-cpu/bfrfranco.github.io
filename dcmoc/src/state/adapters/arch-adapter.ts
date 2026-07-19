/* ─── ARCHITECTURE DATA ADAPTER (Phase C) ────────────────────────────────────
 * Pure: sanitized inputs → engine calls → derived architecture model.
 * ENGINE TRAP handled here: models.pue.defaultFor maps via DATA.coolingTypes
 * (air|rearDoor|directToChip|immersion) so store key 'liquid' silently falls
 * to the AIR row — ALWAYS read DATA.pueMatrix[cooling]['tier'+tier] directly
 * (its keys match the store), then mapped defaultFor, then local constant.
 * Every fn returns usable values even when rzModels() === {} (prerender).
 * ──────────────────────────────────────────────────────────────────────── */

import { rzModels, rzData } from '@/lib/rz-engine';
import { OVERHEAD_SPLIT } from '@/lib/screening';
import { getPUE } from '@/constants/pue';
import { densityToEngineBucket } from '@/lib/requirementsMappings';
import { REDUNDANCY_KEY } from '@/state/registry';

export interface ArchInputs {
    itLoadKw: number;
    tier: 2 | 3 | 4;
    coolingType: 'air' | 'inrow' | 'rdhx' | 'liquid';
    redundancy: 'N+1' | '2N' | '2N+1';
    redKey: 'n1' | '2n' | '2n1';
    gridVoltage: string;
    rackDensityKw: number;
    supplyTempC: number;
    deltaTK: number | null;
    useCase: string;
    fuelHours: number;
}

export interface EquipCounts {
    switchgear: number; transformers: number; generators: number; ups_modules: number;
    cooling_units: number; pdus: number; sts: number; chillers: number; pumps: number;
    racks: number; fireZones: number; ahu: number; ats: number;
    [k: string]: number;
}

export function readArchInputs(raw: {
    itLoad: number; tierLevel: number; coolingType: string; powerRedundancy: string;
    gridVoltage: string; rackDensityKw: number; supplyTempC: number; deltaTK: number | null;
    useCase: string; fuelHours: number;
}): ArchInputs {
    const cool = (['air', 'inrow', 'rdhx', 'liquid'].includes(raw.coolingType) ? raw.coolingType : 'air') as ArchInputs['coolingType'];
    const red = (['N+1', '2N', '2N+1'].includes(raw.powerRedundancy) ? raw.powerRedundancy : 'N+1') as ArchInputs['redundancy'];
    return {
        itLoadKw: Math.min(500_000, Math.max(100, raw.itLoad || 2500)),
        tier: ([2, 3, 4].includes(raw.tierLevel) ? raw.tierLevel : 3) as 2 | 3 | 4,
        coolingType: cool,
        redundancy: red,
        redKey: REDUNDANCY_KEY[red] ?? 'n1',
        gridVoltage: raw.gridVoltage || '33kV',
        rackDensityKw: Math.min(200, Math.max(1, raw.rackDensityKw || 12)),
        supplyTempC: Math.min(45, Math.max(10, raw.supplyTempC || 22)),
        deltaTK: raw.deltaTK,
        useCase: raw.useCase || 'ai',
        fuelHours: Math.min(168, Math.max(8, raw.fuelHours || 48)),
    };
}

const LOCAL_PUE: Record<string, number> = { air: 1.5, inrow: 1.35, rdhx: 1.25, liquid: 1.15 };
const COOLING_TO_ENGINE_KEY: Record<string, string> = { air: 'air', inrow: 'air', rdhx: 'rearDoor', liquid: 'directToChip' };

export function computePue(i: ArchInputs): { pue: number; source: 'engine-matrix' | 'engine-default' | 'fallback' } {
    const matrix = rzData()?.pueMatrix;
    const fromMatrix = matrix?.[i.coolingType]?.['tier' + i.tier];
    if (typeof fromMatrix === 'number') return { pue: fromMatrix, source: 'engine-matrix' };
    const m = rzModels()?.pue;
    if (m?.defaultFor) {
        try {
            const v = m.defaultFor(COOLING_TO_ENGINE_KEY[i.coolingType] ?? 'air', i.tier);
            if (typeof v === 'number') return { pue: v, source: 'engine-default' };
        } catch { /* fall through */ }
    }
    try { return { pue: getPUE(i.coolingType), source: 'fallback' }; }
    catch { return { pue: LOCAL_PUE[i.coolingType] ?? 1.5, source: 'fallback' }; }
}

export interface FacilityCalc {
    itMw: number; facilityMw: number; pue: number; pueSource: string;
    availabilityPct: number; downtimeMinYr: number; paths: number;
}

export function computeFacility(i: ArchInputs): FacilityCalc {
    const { pue, source } = computePue(i);
    const d = rzData();
    const tierAvail: Record<number, number> = d?.reliability?.tierAvailability ?? { 2: 0.99741, 3: 0.99982, 4: 0.99995 };
    const paths: number = d?.reliability?.redundancyPaths?.[i.redKey] ?? (i.redKey === 'n1' ? 2 : i.redKey === '2n' ? 2 : 3);
    const frac = tierAvail[i.tier] ?? 0.99982;
    const itMw = i.itLoadKw / 1000;
    return {
        itMw: +itMw.toFixed(1),
        facilityMw: +(itMw * pue).toFixed(1),
        pue, pueSource: source,
        availabilityPct: +(frac * 100).toFixed(4),
        downtimeMinYr: +((1 - frac) * 365.25 * 24 * 60).toFixed(1),
        paths,
    };
}

/* local mirror of models.commissioning.equipScale (rz-engine.js:6678) — fallback only */
function equipScaleLocal(kw: number, densityKw: number): EquipCounts {
    const c = (d: number) => Math.ceil(kw / d);
    return {
        switchgear: c(5000) + 1, transformers: c(2500), generators: c(2000), ups_modules: c(500),
        cooling_units: c(200), pdus: c(100), sts: c(1000), chillers: c(500), pumps: c(300),
        racks: Math.ceil(kw / Math.max(1, densityKw)), fireZones: c(200),
        ahu: c(5000) + 1, ats: c(2000),
    };
}

export function computeEquipCounts(i: ArchInputs): { eq: EquipCounts; source: 'engine' | 'fallback' } {
    const m = rzModels()?.commissioning;
    if (m?.equipScale) {
        try {
            const eq = m.equipScale({ itLoad: i.itLoadKw, rackDensity: densityToEngineBucket(i.rackDensityKw) }) as EquipCounts;
            // engine racks use the density-bucket kW; recompute with the exact density for display honesty
            return { eq: { ...eq, racks: Math.ceil(i.itLoadKw / i.rackDensityKw) }, source: 'engine' };
        } catch { /* fall through */ }
    }
    return { eq: equipScaleLocal(i.itLoadKw, i.rackDensityKw), source: 'fallback' };
}

export interface LayerCheck { key: string; label: string; pass: boolean; note: string }

export function computeValidation(i: ArchInputs, eq: EquipCounts): { layers: LayerCheck[]; overall: boolean } {
    const m = rzModels()?.architecture;
    const d = rzData();
    let thermalOk = true, thermalNote = 'screening';
    try {
        if (m?.thermalCheck) {
            const t = m.thermalCheck({ coolingType: i.coolingType, supplyTempC: i.supplyTempC, deltaTK: i.deltaTK ?? undefined });
            thermalOk = !!t?.compliant;
            thermalNote = t ? `${t.class} · ΔT ${t.deltaTK}K` : 'screening';
        }
    } catch { /* keep defaults */ }
    let topoOk = true, topoNote = 'screening';
    try {
        if (m?.topology) {
            const t = m.topology(i.tier);
            topoOk = !!t?.tiaRating;
            topoNote = t?.tiaRating ?? 'screening';
        }
    } catch { /* keep */ }
    const layers: LayerCheck[] = [
        { key: 'power', label: 'Power Architecture', pass: topoOk && eq.ups_modules > 0 && eq.generators > 0, note: topoNote },
        { key: 'cooling', label: 'Cooling Architecture', pass: thermalOk, note: thermalNote },
        { key: 'it', label: 'IT & Network Architecture', pass: eq.pdus > 0 && eq.racks > 0, note: `${eq.pdus} PDU · ${eq.racks} racks` },
        { key: 'building', label: 'Building Architecture', pass: (m?.floorLoading ? m.floorLoading(i.coolingType) : 8) > 0, note: `${m?.floorLoading ? m.floorLoading(i.coolingType) : '—'} kN/m²` },
        { key: 'security', label: 'Security & Safety', pass: !!d?.fire, note: d?.fire ? 'NFPA agent data present' : 'no data' },
        { key: 'bms', label: 'BMS & Controls', pass: true, note: 'controls discipline in scope' },
    ];
    return { layers, overall: layers.every((l) => l.pass) };
}

export interface ComplianceRow { standard: string; pct: number | null; note: string }

export function computeCompliance(i: ArchInputs, targetTier: 3 | 4): ComplianceRow[] {
    const m = rzModels()?.architecture;
    let tia = 'Rated-3';
    try { tia = m?.topology ? (m.topology(i.tier)?.tiaRating ?? 'Rated-3') : 'Rated-3'; } catch { /* keep */ }
    const achieved = Number(String(tia).replace(/\D/g, '')) || i.tier;
    let thermalCompliant = true, flags = 0;
    try {
        if (m?.thermalCheck) {
            const t = m.thermalCheck({ coolingType: i.coolingType, supplyTempC: i.supplyTempC, deltaTK: i.deltaTK ?? undefined });
            thermalCompliant = !!t?.compliant; flags = t?.flags?.length ?? 0;
        }
    } catch { /* keep */ }
    return [
        { standard: `Uptime Institute Tier ${targetTier === 4 ? 'IV' : 'III'}`, pct: achieved >= targetTier ? 100 : 50, note: achieved >= targetTier ? 'meets target' : 'below target — review' },
        { standard: 'ANSI/TIA-942-C', pct: achieved >= targetTier ? 100 : 50, note: tia },
        { standard: 'ASHRAE TC 9.9', pct: thermalCompliant ? 100 : Math.max(40, 100 - 15 * flags), note: thermalCompliant ? 'thermal envelope compliant' : `${flags} flag(s)` },
        { standard: 'NFPA 75/76/110', pct: null, note: 'screening — agent data present, no page-level pass/fail model' },
        { standard: 'ISO/IEC 22237', pct: null, note: 'screening — no engine evaluation model' },
    ];
}

export function referenceDesignId(i: ArchInputs): string {
    const cool = { air: 'AC', inrow: 'IR', rdhx: 'RD', liquid: 'LC' }[i.coolingType];
    return `RD-${i.useCase.toUpperCase()}-${cool}-${Math.round(i.itLoadKw / 1000)}MW-001`;
}

/** Load-breakdown donut — derived from LIVE PUE (not the mock's fixed split):
 *  IT share = 1/pue of facility; overhead (pue−1)/pue split cooling 60 /
 *  power 30 / lighting 5 / other 5 (labeled screening decomposition). */
export function computeLoadBreakdown(f: FacilityCalc): { name: string; mw: number; pct: number }[] {
    const total = f.facilityMw;
    const it = f.itMw;
    const overhead = Math.max(0, total - it);
    const rows = [
        { name: 'IT Load (Racks)', mw: it },
        { name: 'Cooling Systems', mw: overhead * OVERHEAD_SPLIT.cooling },
        { name: 'Power Systems', mw: overhead * OVERHEAD_SPLIT.power },
        { name: 'Lighting', mw: overhead * OVERHEAD_SPLIT.lighting },
        { name: 'Others', mw: overhead * OVERHEAD_SPLIT.other },
    ];
    return rows.map((r) => ({ ...r, mw: +r.mw.toFixed(1), pct: total > 0 ? +((r.mw / total) * 100).toFixed(1) : 0 }));
}
