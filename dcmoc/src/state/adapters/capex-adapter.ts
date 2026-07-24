/* ─── CAPEX DATA ADAPTER (Phase E) ───────────────────────────────────────────
 * Pure analysis derivations over CapexEngine results. Honesty rules:
 * • AACE class = ENGINE TRUTH (Class 4, −30/+50) — not the mock's Class 3.
 * • Risk band = deterministic normal approximation anchored on the engine
 *   accuracyRange percentiles — NO Math.random.
 * • Escalation = the REAL projYear factors the engine uses — no fabricated
 *   commodity indices.  • Payment terms = labeled client-side ASSUMPTION.
 * • IT-fitout (racks/servers) has NO engine cost key → explicit exclusion row.
 * ──────────────────────────────────────────────────────────────────────── */

import { calculateCapex, type CapexInput, type CapexResult } from '@/lib/CapexEngine';
import { costFactors, yearEscalation } from '@/lib/capex-data';
import { rzModels, rzData } from '@/lib/rz-engine';

export interface CategoryRow { name: string; usd: number; pct: number; perKw: number; color: string }

const CATEGORY_MAP: { name: string; keys: (keyof typeof costFactors)[]; color: string }[] = [
    { name: 'Power Infrastructure', keys: ['electrical', 'ups', 'generator'], color: '#3b82f6' },
    { name: 'Cooling Infrastructure', keys: ['cooling'], color: '#06b6d4' },
    { name: 'Building & Civil Works', keys: ['building', 'seismic'], color: '#64748b' },
    { name: 'Network Infrastructure', keys: ['network'], color: '#a855f7' },
    { name: 'Security & Safety', keys: ['security', 'fireSuppression', 'fireAlarm'], color: '#ef4444' },
    { name: 'BMS, DCIM & Controls', keys: ['bms'], color: '#10b981' },
    { name: 'Other (Cx, Testing, Permits)', keys: ['commissioning', 'testing', 'permits'], color: '#f59e0b' },
];

export function categorize(results: CapexResult, itLoadKw: number): { rows: CategoryRow[]; totalHard: number } {
    const rows: CategoryRow[] = CATEGORY_MAP.map((c) => {
        const usd = c.keys.reduce((s, k) => s + (results.costs[k] ?? 0), 0);
        return { name: c.name, usd, pct: 0, perKw: itLoadKw > 0 ? +(usd / itLoadKw).toFixed(0) : 0, color: c.color };
    }).filter((r) => r.usd > 0);
    if (results.fomTotal > 0) rows.push({ name: 'Front-of-Meter / Utility', usd: results.fomTotal, pct: 0, perKw: itLoadKw > 0 ? +(results.fomTotal / itLoadKw).toFixed(0) : 0, color: '#eab308' });
    const totalHard = rows.reduce((s, r) => s + r.usd, 0);
    rows.forEach((r) => { r.pct = totalHard > 0 ? +((r.usd / totalHard) * 100).toFixed(1) : 0; });
    return { rows, totalHard };
}

export interface RiskBand { p10: number; p50: number; p80: number; p90: number; sigmaLow: number; sigmaHigh: number; classLabel: string; method: string; curve: { x: number; y: number }[] }

/** Deterministic band: engine accuracyRange low/point/high anchored at
 *  P10/P50/P90; asymmetric normal (z=1.2816); P80 via z=0.8416. */
export function riskBand(total: number): RiskBand {
    const m = rzModels()?.capex;
    let low = total * 0.7, high = total * 1.5, classLabel = 'Class 4 — Study / feasibility', method = 'parametric / assembly';
    try {
        if (m?.accuracyRange) {
            const r = m.accuracyRange(total);
            low = r?.low ?? low; high = r?.high ?? high;
            classLabel = r?.class ?? classLabel; method = r?.method ?? method;
        }
    } catch { /* keep fallback */ }
    const Z10 = 1.2816, Z80 = 0.8416;
    const sigmaLow = (total - low) / Z10;
    const sigmaHigh = (high - total) / Z10;
    const p80 = total + Z80 * sigmaHigh;
    // two-sided normal density curve (deterministic sample grid)
    const curve: { x: number; y: number }[] = [];
    const xMin = total - 3.2 * sigmaLow, xMax = total + 3.2 * sigmaHigh;
    for (let k = 0; k <= 60; k++) {
        const x = xMin + (k / 60) * (xMax - xMin);
        const s = x < total ? sigmaLow : sigmaHigh;
        const y = Math.exp(-0.5 * Math.pow((x - total) / Math.max(1, s), 2));
        curve.push({ x: Math.round(x), y: +y.toFixed(4) });
    }
    return { p10: Math.round(low), p50: Math.round(total), p80: Math.round(p80), p90: Math.round(high), sigmaLow, sigmaHigh, classLabel, method, curve };
}

export interface SweepRow { itMw: number; p10: number; p50: number; p90: number }

export function sweepItLoad(base: CapexInput, points = 9): SweepRow[] {
    const out: SweepRow[] = [];
    for (let k = 0; k < points; k++) {
        const frac = 0.25 + (k / (points - 1)) * 1.75;   // audit-ok: sweep range 0.25x .. 2x
        const itLoad = Math.round(base.itLoad * frac);
        try {
            const r = calculateCapex({ ...base, itLoad });
            const b = riskBand(r.total);
            out.push({ itMw: +(itLoad / 1000).toFixed(1), p10: b.p10, p50: b.p50, p90: b.p90 });
        } catch { /* skip point */ }
    }
    return out;
}

export interface DriverRow { name: string; low: number; high: number; swing: number }

/** One-at-a-time tornado over calculateCapex().total (top-5 by |swing|). */
export function tornadoDrivers(base: CapexInput): DriverRow[] {
    const baseTotal = safeTotal(base);
    const tests: { name: string; lo: Partial<CapexInput>; hi: Partial<CapexInput> }[] = [
        { name: 'Redundancy (N+1 → 2N+1)', lo: { redundancy: 'n1' }, hi: { redundancy: '2n1' } },
        { name: 'Cooling (air → liquid)', lo: { coolingType: 'air' }, hi: { coolingType: 'liquid' } },
        { name: 'Rack Density (std → AI)', lo: { rackType: 'standard' }, hi: { rackType: 'ai' } },
        { name: 'Building (modular → purpose)', lo: { buildingType: 'modular' }, hi: { buildingType: 'purpose' } },
        { name: 'Project Year (escalation)', lo: { projYear: '2024' }, hi: { projYear: '2027' } },
        { name: 'Contingency (0% → 30%)', lo: { contingency: 0 }, hi: { contingency: 30 } },
    ];
    const rows = tests.map((t) => {
        const low = safeTotal({ ...base, ...t.lo });
        const high = safeTotal({ ...base, ...t.hi });
        return { name: t.name, low, high, swing: Math.abs(high - low) };
    }).filter((r) => Number.isFinite(r.swing));
    rows.sort((a, b) => b.swing - a.swing);
    return rows.slice(0, 5).map((r) => ({ ...r, low: Math.round(r.low), high: Math.round(r.high), swing: Math.round(r.swing) }));
    function safeTotal(inp: CapexInput): number {
        try { return calculateCapex(inp).total; } catch { return baseTotalFallback(); }
    }
    function baseTotalFallback(): number { try { return calculateCapex(base).total; } catch { return 0; } }
}

export function contingencyBreakdown(results: CapexResult, inputs: CapexInput): { type: string; basis: string; usd: number }[] {
    return [
        { type: 'Design & Engineering', basis: `${inputs.designFee}% of direct cost`, usd: Math.round(results.softCosts?.design ?? 0) },
        { type: 'Project Management', basis: `${inputs.pmFee}% of direct cost`, usd: Math.round(results.softCosts?.pm ?? 0) },
        { type: 'Contingency (= design margin)', basis: `${inputs.contingency}% of direct cost`, usd: Math.round(results.contingency ?? 0) },
    ];
}

export function escalationTable(): { year: string; mult: number; note: string }[] {
    const engineTable = rzData()?.capexDetail?.yearEscalation as Record<string, number> | undefined;
    if (engineTable) return Object.entries(engineTable).map(([year, mult]) => ({ year, mult: +mult, note: 'engine projYear index' }));
    return Object.entries(yearEscalation).map(([year, v]) => ({ year, mult: (v as { mult: number }).mult, note: (v as { note?: string }).note ?? 'local index' }));
}

/** Payment milestone split — CLIENT-SIDE ASSUMPTION (labeled on the card). */
export const PAYMENT_TERMS: { milestone: string; pct: number }[] = [
    { milestone: 'Mobilization', pct: 10 },
    { milestone: 'Design & Permitting', pct: 5 },
    { milestone: 'Civil Construction', pct: 35 },
    { milestone: 'MEP Installation', pct: 35 },
    { milestone: 'Commissioning & Closeout', pct: 10 },
    { milestone: 'Retention', pct: 5 },
];

export interface BoqRow { category: string; line: string; usd: number; pctOfTotal: number; color: string }

export function boqRows(results: CapexResult): BoqRow[] {
    const total = Math.max(1, results.total);
    const rows: BoqRow[] = [];
    for (const c of CATEGORY_MAP) {
        for (const k of c.keys) {
            const usd = results.costs[k] ?? 0;
            if (usd <= 0) continue;
            rows.push({ category: c.name, line: costFactors[k].label, usd: Math.round(usd), pctOfTotal: +((usd / total) * 100).toFixed(1), color: c.color });
        }
    }
    return rows;
}

export function liquidVsAirDelta(base: CapexInput): { deltaUsd: number; deltaPct: number } | null {
    try {
        const air = calculateCapex({ ...base, coolingType: 'air' }).total;
        const liq = calculateCapex({ ...base, coolingType: 'liquid' }).total;
        return { deltaUsd: Math.round(liq - air), deltaPct: +(((liq - air) / Math.max(1, air)) * 100).toFixed(1) };
    } catch { return null; }
}

export function capexInsights(results: CapexResult, inputs: CapexInput, cats: CategoryRow[]): string[] {
    const out: string[] = [];
    const top = [...cats].sort((a, b) => b.usd - a.usd)[0];
    if (top) out.push(`${top.name} is the highest CAPEX driver (${top.pct}% of hard cost).`);
    const lva = liquidVsAirDelta(inputs);
    if (lva) out.push(lva.deltaUsd > 0
        ? `Liquid cooling adds $${(lva.deltaUsd / 1e6).toFixed(1)}M (+${lva.deltaPct}%) vs air cooling.`
        : `Liquid cooling saves $${(-lva.deltaUsd / 1e6).toFixed(1)}M vs air at this density.`);
    const premium: number = rzData()?.capacity?.phaseBuildPremiumPct ?? 0.12;
    out.push(`Phased build carries a ~${Math.round(premium * 100)}% multi-phase premium vs monolithic — trade against cash-flow benefit.`);
    out.push(`Contingency ${inputs.contingency}% (= Requirements design margin) → $${((results.contingency ?? 0) / 1e6).toFixed(1)}M.`);
    return out;
}
