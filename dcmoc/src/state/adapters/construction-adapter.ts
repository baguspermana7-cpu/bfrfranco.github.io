/* ─── CONSTRUCTION DATA ADAPTER (Phase F) ────────────────────────────────────
 * PLANNED plane engine-real; ACTUAL plane from constructionTracking; EVM
 * derived deterministically. FIXES THE LATENT BUG: the old dashboard passed
 * capex.timeline (no duration keys) into models.construction.schedule → all
 * durations coerced to 0. Here durations are mapped EXPLICITLY from the
 * capex timeline phases (+ procurement = longLeadRisk.maxLeadMonths).
 * ──────────────────────────────────────────────────────────────────────── */

import { rzModels } from '@/lib/rz-engine';
import type { CapexResult } from '@/lib/CapexEngine';

export interface ScheduleRow { key: string; label: string; startMonth: number; endMonth: number; months: number }
export interface PlannedSchedule {
    rows: ScheduleRow[]; totalMonths: number;
    milestones: Record<string, number>;
    source: 'engine' | 'fallback';
}

const PHASE_NAME_TO_KEY: Record<string, string> = {
    'Design & Engineering': 'design', 'Permitting': 'permit',
    'Civil Construction': 'civil', 'MEP Installation': 'mep', 'Commissioning': 'commission',
};

export function plannedSchedule(timeline: CapexResult['timeline'] | null | undefined): PlannedSchedule | null {
    if (!timeline?.phases?.length) return null;
    const durations: Record<string, number> = { design: 4, permit: 3, procurement: 8, civil: 10, mep: 8, commission: 3 };
    for (const p of timeline.phases) {
        const key = PHASE_NAME_TO_KEY[p.name];
        if (key) durations[key] = Math.max(1, p.end - p.start);
    }
    const m = rzModels()?.construction;
    try {
        if (m?.longLeadRisk) {
            const ll = m.longLeadRisk({ powerOnMonth: timeline.totalMonths });
            if (ll?.maxLeadMonths) durations.procurement = Math.max(durations.procurement, Math.ceil(ll.maxLeadMonths));
        }
    } catch { /* keep */ }
    try {
        if (m?.schedule) {
            const s = m.schedule(durations);
            if (s?.rows?.length && s.totalMonths > 0) {
                return { rows: s.rows, totalMonths: +s.totalMonths.toFixed(1), milestones: s.milestones ?? {}, source: 'engine' };
            }
        }
    } catch { /* fallback */ }
    // sequential fallback
    let cur = 0;
    const rows: ScheduleRow[] = Object.entries(durations).map(([key, months]) => {
        const r = { key, label: key[0].toUpperCase() + key.slice(1), startMonth: cur, endMonth: cur + months, months };
        cur += months; return r;
    });
    return { rows, totalMonths: cur, milestones: {}, source: 'fallback' };
}

/** Budget weight per phase — proportional to phase duration (screening; capex
 *  category-to-phase mapping would be finer, labeled as such). */
export function phaseWeights(sched: PlannedSchedule): Record<string, number> {
    const total = Math.max(1, sched.rows.reduce((s, r) => s + r.months, 0));
    return Object.fromEntries(sched.rows.map((r) => [r.key, r.months / total]));
}

export interface EvmResult {
    planMode: boolean;
    overallPct: number; pvPct: number; evPct: number;
    spi: number; cpi: number;
    pvUsd: number; evUsd: number; acUsd: number;
    forecastTotalMonths: number; delayMonths: number;
    behindKeys: string[];
}

export function evm(
    sched: PlannedSchedule, budgetUsd: number,
    statusMonth: number | null, phaseActualPct: Record<string, number | null>, acSpentUsd: number | null,
): EvmResult {
    const w = phaseWeights(sched);
    const anyActual = Object.values(phaseActualPct).some((v) => v != null);
    const planMode = statusMonth == null && !anyActual;
    const sm = statusMonth ?? sched.totalMonths;
    // planned % per phase at status month (linear within phase)
    const plannedPct = (r: ScheduleRow) => Math.min(100, Math.max(0, ((sm - r.startMonth) / Math.max(0.1, r.months)) * 100));
    let pv = 0, ev = 0;
    const behindKeys: string[] = [];
    for (const r of sched.rows) {
        const pp = plannedPct(r);
        const ap = planMode ? pp : (phaseActualPct[r.key] ?? pp);
        pv += (pp / 100) * (w[r.key] ?? 0);
        ev += (ap / 100) * (w[r.key] ?? 0);
        if (!planMode && ap < pp - 5) behindKeys.push(r.key);
    }
    const pvUsd = pv * budgetUsd, evUsd = ev * budgetUsd;
    const acUsd = planMode ? pvUsd : (acSpentUsd ?? evUsd);
    const spi = pvUsd > 0 ? +(evUsd / pvUsd).toFixed(2) : 1;
    const cpi = acUsd > 0 ? +(evUsd / acUsd).toFixed(2) : 1;
    const clampedSpi = Math.min(1.5, Math.max(0.5, spi || 1));
    return {
        planMode,
        overallPct: +(ev * 100).toFixed(1), pvPct: +(pv * 100).toFixed(1), evPct: +(ev * 100).toFixed(1),
        spi: planMode ? 1 : spi, cpi: planMode ? 1 : cpi,
        pvUsd: Math.round(pvUsd), evUsd: Math.round(evUsd), acUsd: Math.round(acUsd),
        forecastTotalMonths: +(sched.totalMonths / clampedSpi).toFixed(1),
        delayMonths: +((sched.totalMonths / clampedSpi) - sched.totalMonths).toFixed(1),
        behindKeys,
    };
}

/** Cumulative planned-value S-curve (monthly grid). */
export function pvCurve(sched: PlannedSchedule, budgetUsd: number): { month: number; pvPct: number; pvUsd: number }[] {
    const w = phaseWeights(sched);
    const out: { month: number; pvPct: number; pvUsd: number }[] = [];
    const steps = Math.ceil(sched.totalMonths);
    for (let mth = 0; mth <= steps; mth++) {
        let pv = 0;
        for (const r of sched.rows) {
            const pp = Math.min(1, Math.max(0, (mth - r.startMonth) / Math.max(0.1, r.months)));
            pv += pp * (w[r.key] ?? 0);
        }
        out.push({ month: mth, pvPct: +(pv * 100).toFixed(1), pvUsd: Math.round(pv * budgetUsd) });
    }
    return out;
}

export interface ProcurementRow { item: string; leadMonths: number; poMonth: number; etaMonth: number; critical: boolean; vendorExample: string }

const EXAMPLE_VENDORS: Record<string, string> = {
    transformer: 'Siemens (example)', switchgear: 'Schneider (example)', generator: 'CAT (example)',
    genset_paralleling: 'ABB (example)', ups: 'Vertiv (example)', chiller: 'Trane (example)', cdu: 'Motivair (example)',
};

export function procurementRows(powerOnMonth: number): { rows: ProcurementRow[]; recommendEarlyOrder: boolean } {
    const m = rzModels()?.construction;
    try {
        if (m?.longLeadRisk) {
            const ll = m.longLeadRisk({ powerOnMonth });
            const rows: ProcurementRow[] = (ll?.items ?? []).map((it: { item: string; leadMonths: number; critical: boolean }) => {
                const po = Math.max(0, +(powerOnMonth - it.leadMonths - 1).toFixed(1));
                return { item: it.item.replace(/_/g, ' '), leadMonths: it.leadMonths, poMonth: po, etaMonth: +(po + it.leadMonths).toFixed(1), critical: it.critical, vendorExample: EXAMPLE_VENDORS[it.item] ?? '—' };
            });
            return { rows, recommendEarlyOrder: !!ll?.recommendEarlyOrder };
        }
    } catch { /* */ }
    return { rows: [], recommendEarlyOrder: false };
}

/** Screening trapezoid manpower model (25% → 100% → 25% across the build). LABELED. */
export function manpowerCurve(totalMonths: number, peak: number): { month: number; planned: number }[] {
    const out: { month: number; planned: number }[] = [];
    for (let mth = 0; mth <= Math.ceil(totalMonths); mth++) {
        const f = mth / Math.max(1, totalMonths);
        const shape = f < 0.2 ? 0.25 + (f / 0.2) * 0.75 : f > 0.85 ? 1 - ((f - 0.85) / 0.15) * 0.75 : 1;
        out.push({ month: mth, planned: Math.round(peak * Math.max(0.1, shape)) });
    }
    return out;
}

/** Documented composite: SPI (40) + CPI (30) + behind-milestones (15) + open issues (15). */
export function healthScore(e: EvmResult, openIssues: number): { score: number; band: string } {
    const spiPart = 40 * Math.min(1, e.spi);
    const cpiPart = 30 * Math.min(1, e.cpi);
    const behindPart = Math.max(0, 15 - 3 * e.behindKeys.length);
    const issuePart = Math.max(0, 15 - 2 * openIssues);
    const score = Math.round(spiPart + cpiPart + behindPart + issuePart);
    return { score, band: score >= 85 ? 'Good' : score >= 65 ? 'Watch' : 'At Risk' };
}
