/* ─── RESULTS DIMENSION EXPLAIN (owner mandate rollout — final DL surface) ───
 * Every Fair/Poor dimension row (<60) on the Results scorecard + every
 * overall grade below "Good" gets the decision-explain treatment: (a) a
 * computed REASON built from the SAME dimension formula the page renders
 * (the score functions live HERE and the page imports them — one source,
 * mirrored read-only by value-trace results.*), and (b) 1-2 QUANTIFIED
 * levers whose magnitudes are SOLVED by explainThresholdMetric bisection
 * (lib/decision-explain) or by evaluating the real engine tables/models at
 * discrete candidate configs (pueMatrix, tierAvailability, architecture
 * .complexity, requirements.completeness, roi cashflow chain). Dimensions
 * with no sensible lever get an honest note, never generic advice.
 * Follows site-intel/axis-explain.ts + CapacityPlanningPage adoption.
 * ──────────────────────────────────────────────────────────────────────── */

import { explainThresholdMetric, type DecisionLever, type ThresholdLeverSpec } from '@/lib/decision-explain';
import { rzModels, rzData } from '@/lib/rz-engine';
import { fmtMoney } from '@/lib/format';
import { AXIS_LABELS, type AxisKey, type SiteScoreResult } from '@/types/site-intel';

/** Fair/Poor floor — dimension rows below this get the explain chip. */
export const DIM_CHIP_FLOOR = 60;
/** Overall "Good" (grade B) floor — below this the grade summary renders. */
export const GRADE_B_FLOOR = 70;

/* ─── Dimension score formulas — SINGLE SOURCE (page renders with these; the
 * explain solvers bisect over the SAME functions, so lever numbers can never
 * drift from the rendered score). Semantics identical to the pre-extraction
 * inline expressions (value-trace results.* mirrors them read-only). ────── */

/** CAPEX Efficiency: $/kW vs the engine cx reference band. */
export const capexScoreOf = (perKw: number, band: number): number =>
    Math.round(Math.max(10, Math.min(100, 100 - ((perKw - band * 0.6) / (band * 0.8)) * 60)));

/** Sustainability: design PUE positioned on the 1.10–1.60 band. */
export const susScoreOf = (pue: number): number =>
    Math.round(Math.max(0, Math.min(100, (1.6 - pue) / 0.5 * 100)));

/** Financial: screening IRR vs the fixed 10% scorecard hurdle. */
export const finScoreOf = (irr: number | null): number =>
    Math.round(Math.max(10, Math.min(100, 50 + (irr != null ? (irr - 0.10) * 400 : 0))));

/** Construction: SPI/CPI blend from tracking EVM (capped at 100). */
export const constrScoreOf = (spi: number, cpi: number): number =>
    Math.min(100, Math.round(50 * Math.min(1.2, spi) + 50 * Math.min(1.2, cpi)));

/** Operational Readiness: tier design availability positioned on 99.700–99.995%. */
export const opsScoreOf = (avail: number): number =>
    Math.max(0, Math.min(100, Math.round((avail - 0.997) / (0.99995 - 0.997) * 100)));

/** Architecture: 100 − soft complexity penalty (complexity = cost-of-delivery). */
export const archScoreOf = (complexityIndex: number): number =>
    Math.round(100 - complexityIndex * 0.35);

/* ─── Financial screening chain (page + explain share ONE closure set) ────── */

export interface FinScreen {
    revenue: number;
    opexAnnual: number;
    npv: number;
    irr: number | null;
    revenuePerKwMonth: number;
    /** Re-runs the SAME 15y screening cashflow (engine roi/opex models) with scaled revenue / capex → IRR fraction. */
    irrAt: (mods: { revMult?: number; capexMult?: number }) => number | null;
}

/**
 * The page's financial screening: revenue = engine decision rate × IT load,
 * opex = engine opex.totalAnnual (dcContract basis), 15y flat flows, NPV@10%
 * + IRR. Returns null when the engine roi model is absent (page falls back
 * to its neutral 60 default, as before).
 */
export function finScreening(itLoadKw: number, pue: number, countryId: string, capexTotal: number): FinScreen | null {
    const m = rzModels();
    if (!m?.roi?.npv) return null;
    const rate = rzData()?.decision?.revenuePerKwMonth ?? 280;
    const build = (revMult: number, capexMult: number): { capex: number; revenue: number; opexAnnual: number; flows: number[] } => {
        const capex = capexTotal * capexMult;
        const revenue = rate * itLoadKw * 12 * revMult;
        const opexAnnual: number = m?.opex?.totalAnnual
            ? m.opex.totalAnnual(itLoadKw / 1000, pue, countryId, 12, { capex, basisPreset: 'dcContract' }).total
            : revenue * 0.4;
        return { capex, revenue, opexAnnual, flows: Array.from({ length: 15 }, () => revenue - opexAnnual) };
    };
    const base = build(1, 1);
    const npv: number = m.roi.npv(base.flows, 0.1) - capexTotal;
    const irr: number | null = m.roi.irr ? m.roi.irr([-capexTotal, ...base.flows]) : null;
    return {
        revenue: base.revenue,
        opexAnnual: base.opexAnnual,
        npv,
        irr,
        revenuePerKwMonth: rate,
        irrAt: (mods) => {
            if (!m.roi.irr) return null;
            const b = build(mods.revMult ?? 1, mods.capexMult ?? 1);
            return m.roi.irr([-b.capex, ...b.flows]);
        },
    };
}

/* ─── Explain plumbing ────────────────────────────────────────────────────── */

export type DimKey = 'req' | 'site' | 'arch' | 'capex' | 'constr' | 'ops' | 'sus' | 'fin';

/** Dimension → owning engine shell tab (the ↗ navigation target). */
export const DIM_TABS: Record<DimKey, { tab: string; label: string }> = {
    req: { tab: 'requirements', label: 'Requirements' },
    site: { tab: 'site', label: 'Site Intelligence' },
    arch: { tab: 'architecture', label: 'Architecture Engine' },
    capex: { tab: 'capex', label: 'CAPEX Engine' },
    constr: { tab: 'construction', label: 'Construction Engine' },
    ops: { tab: 'reliability', label: 'Reliability Engine' },
    sus: { tab: 'carbon', label: 'Sustainability Engine' },
    fin: { tab: 'finance', label: 'Financial' },
};

/** Live context the page's model memo already computed — nothing re-derived. */
export interface DimContext {
    itLoadKw: number;
    tier: 2 | 3 | 4;
    coolingType: 'air' | 'inrow' | 'rdhx' | 'liquid';
    /** Engine redundancy token ('n1' | '2n' | '2n1') as the page maps it. */
    redundancy: string;
    /** The exact intake object the page passed to requirements.validate. */
    intake: Record<string, unknown>;
    reqMissing: string[];
    perKw: number;
    band: number;
    capexTotal: number;
    pue: number;
    evm: { spi: number; cpi: number; planMode?: boolean } | null;
    tierAvail: Record<number, number>;
    siteBest: SiteScoreResult | null;
    siteName?: string;
    complexityIndex: number | null;
    fin: FinScreen | null;
}

export interface DimExplain {
    reason: string;
    levers: DecisionLever[];
    targetTab: string;
    targetLabel: string;
}

const REQ_FIELD_LABELS: Record<string, string> = {
    itLoadKw: 'IT Load', targetTier: 'Target Tier', region: 'Region',
    useCase: 'Use Case', budgetUsd: 'Budget (USD)', deadlineMonths: 'Deadline (bulan)',
};

const RED_LABELS: Record<string, string> = { n: 'N', n1: 'N+1', '2n': '2N', '2n1': '2N+1' };

const pct1 = (v: number): string => `${(v * 100).toFixed(1)}%`;

/* ── per-dimension explainers (each returns reason + levers) ── */

function explainReq(score: number, target: number, ctx: DimContext): DimExplain {
    const m = rzModels();
    const requiredCount: number = rzData()?.requirements?.required?.length ?? 6;
    const missing = ctx.reqMissing;
    const have = requiredCount - missing.length;
    const missLabels = missing.map((k) => REQ_FIELD_LABELS[k] ?? k);
    const reason = `Requirements ${score}/100 = intake completeness engine (${have}/${requiredCount} required field terisi)` +
        (missing.length ? ` — kosong: ${missLabels.join(', ')}.` : '.');
    const levers: DecisionLever[] = [];
    const compAt = (extra: Record<string, unknown>): number => {
        try { return m?.requirements?.completeness?.({ ...ctx.intake, ...extra })?.pct ?? score; } catch { return score; }
    };
    /* fillable = missing fields DCMOC actually maps to an input (deadlineMonths is not one) */
    const fillable = missing.filter((k) => k !== 'deadlineMonths');
    if (fillable.length) {
        const achieved = compAt(Object.fromEntries(fillable.map((k) => [k, 1])));
        levers.push({
            label: `Isi ${fillable.map((k) => REQ_FIELD_LABELS[k] ?? k).join(' + ')}`,
            detail: `Mengisi ${fillable.map((k) => REQ_FIELD_LABELS[k] ?? k).join(', ')} (Requirements → intake) membawa completeness ${score} → ${Math.round(achieved)}${achieved >= target ? ` (≥${target})` : ''} — dihitung ulang lewat engine requirements.completeness, tiap field bernilai ${(100 / requiredCount).toFixed(1)} poin.`,
            targetTab: 'requirements',
            priority: achieved >= target ? 'HIGH' : 'MED',
        });
    }
    if (missing.includes('deadlineMonths')) {
        const ceiling = compAt(Object.fromEntries(fillable.map((k) => [k, 1]).concat([['deadlineMonths', 1]])));
        levers.push({
            label: 'Deadline: bukan input DCMOC',
            detail: `Field engine deadlineMonths tidak dipetakan ke input DCMOC — completeness maksimum yang bisa dicapai dari UI adalah ${Math.round(compAt(Object.fromEntries(fillable.map((k) => [k, 1]))))} (teoretis ${Math.round(ceiling)} bila field itu ada). Catatan jujur, bukan lever.`,
            targetTab: 'requirements',
            priority: 'MED',
        });
    }
    return { reason, levers, targetTab: DIM_TABS.req.tab, targetLabel: DIM_TABS.req.label };
}

function explainSite(score: number, ctx: DimContext): DimExplain {
    const r = ctx.siteBest;
    if (!r) {
        return {
            reason: `Site Intelligence ${score}/100 — belum ada kandidat site yang bisa diskor (fallback netral 50).`,
            levers: [{
                label: 'Tambah kandidat site',
                detail: 'Tambahkan minimal satu kandidat di Site Intelligence agar skor dihitung dari engine scoreSite (bukan fallback netral).',
                targetTab: 'site', priority: 'MED',
            }],
            targetTab: DIM_TABS.site.tab, targetLabel: DIM_TABS.site.label,
        };
    }
    const axesAsc = (Object.entries(r.axes) as [AxisKey, number][]).sort((a, b) => a[1] - b[1]);
    const weak = axesAsc.slice(0, 2);
    const reason = `Site Intelligence ${score}/100 = engine site score kandidat terbaik${ctx.siteName ? ` (${ctx.siteName})` : ''} — axis terlemah: ${weak.map(([k, v]) => `${AXIS_LABELS[k]} ${Math.round(v)}/100`).join(', ')}; cakupan faktor ${Math.round(r.engine.coverage * 100)}%${r.engine.missing.length ? ` (${r.engine.missing.length} faktor masih neutral default)` : ''}.`;
    const levers: DecisionLever[] = [{
        label: `Perbaiki axis ${AXIS_LABELS[weak[0][0]]}`,
        detail: `Solver lever per-axis hidup di Site Intelligence: chip ${AXIS_LABELS[weak[0][0]]} ${Math.round(weak[0][1])}/100 (Poor/Fair) membuka panel dengan lever tersolve dari formula scoreSite live (Edit Criteria) — angka dimensi ini mengikuti skor engine kandidat terbaik apa adanya.`,
        targetTab: 'site', priority: 'MED',
    }];
    if (r.engine.missing.length) {
        levers.push({
            label: `Isi atribut (${r.engine.missing.length} faktor neutral)`,
            detail: `Faktor ${r.engine.missing.join(', ')} memakai default netral — mengisi data aktual bisa menggeser skor ke DUA arah (menajamkan, bukan menjanjikan naik). Catatan jujur.`,
            targetTab: 'site', priority: 'MED',
        });
    }
    return { reason, levers, targetTab: DIM_TABS.site.tab, targetLabel: DIM_TABS.site.label };
}

function explainArch(score: number, target: number, ctx: DimContext): DimExplain {
    const m = rzModels();
    const idx = ctx.complexityIndex;
    const reason = idx != null
        ? `Architecture ${score}/100 = 100 − 0.35 × complexity index ${idx}/100 (engine: cooling ${ctx.coolingType} × Tier ${ctx.tier} × ${RED_LABELS[ctx.redundancy] ?? ctx.redundancy}). Kompleksitas = cost-of-delivery, bukan cacat desain.`
        : `Architecture ${score}/100 — engine complexity model tidak tersedia (fallback netral 60).`;
    const levers: DecisionLever[] = [];
    if (idx != null && m?.architecture?.complexity) {
        /* discrete candidates: one-step-lower redundancy / cooling, evaluated via the REAL engine model */
        const redOrder = ['n', 'n1', '2n', '2n1'];
        const coolOrder = ['air', 'inrow', 'rdhx', 'liquid'];
        const cand: { label: string; inp: { coolingType: string; tier: number; redundancy: string } }[] = [];
        const ri = redOrder.indexOf(ctx.redundancy);
        if (ri > 1) cand.push({ label: `Redundansi ${RED_LABELS[ctx.redundancy]} → ${RED_LABELS[redOrder[ri - 1]]}`, inp: { coolingType: ctx.coolingType, tier: ctx.tier, redundancy: redOrder[ri - 1] } });
        const ci = coolOrder.indexOf(ctx.coolingType);
        if (ci > 0) cand.push({ label: `Cooling ${ctx.coolingType} → ${coolOrder[ci - 1]}`, inp: { coolingType: coolOrder[ci - 1], tier: ctx.tier, redundancy: ctx.redundancy } });
        for (const c of cand) {
            try {
                const r2 = m.architecture.complexity(c.inp);
                if (!r2) continue;
                const s2 = archScoreOf(r2.index);
                if (s2 >= target && s2 > score) {
                    levers.push({
                        label: c.label,
                        detail: `${c.label} menurunkan complexity index ${idx} → ${r2.index} sehingga skor ${score} → ${s2} (≥${target}) — dihitung dari engine architecture.complexity. TRADE-OFF: langkah ini menukar redundansi/kapabilitas cooling (availability & density), bukan optimasi gratis.`,
                        targetTab: 'architecture', priority: 'HIGH',
                    });
                    break;
                }
            } catch { /* engine guard */ }
        }
    }
    levers.push({
        label: 'Kompleksitas ≠ keburukan',
        detail: 'Skor ini mengukur beban delivery desain (multiplier cooling × tier × redundansi). Menurunkannya berarti menurunkan spesifikasi — keputusan arsitektur sadar-trade-off, bukan target optimasi. Catatan jujur.',
        targetTab: 'architecture', priority: 'MED',
    });
    return { reason, levers: levers.slice(0, 2), targetTab: DIM_TABS.arch.tab, targetLabel: DIM_TABS.arch.label };
}

function explainCapex(score: number, target: number, ctx: DimContext): DimExplain {
    const { perKw, band, capexTotal } = ctx;
    const specs: ThresholdLeverSpec[] = [{
        lo: perKw,
        hi: band * 0.6, // band floor → formula = 100
        metricAt: (x) => capexScoreOf(x, band),
        render: (x, achieved) => {
            const cutPct = (1 - x / perKw) * 100;
            const totalTarget = capexTotal * (x / perKw);
            return {
                label: `CAPEX $/kW −${cutPct.toFixed(0)}%`,
                detail: `Turunkan $/kW $${Math.round(perKw).toLocaleString()} → $${Math.round(x).toLocaleString()} (−${cutPct.toFixed(1)}%; total ${fmtMoney(capexTotal)} → ${fmtMoney(totalTarget)}) agar skor mencapai ${achieved} (≥${target}) — di-solve bisection atas formula skor yang sama; drivers teratas ada di tornado CAPEX Engine.`,
            };
        },
        unreachable: (atHi) => ({
            label: 'Band floor pun belum cukup',
            detail: `Bahkan pada $${Math.round(band * 0.6).toLocaleString()}/kW skor hanya ${Math.round(atHi)} — periksa band referensi engine.`,
        }),
        targetTab: 'capex',
    }];
    const solved = explainThresholdMetric({
        metricLabel: 'CAPEX Efficiency',
        value: score,
        threshold: target,
        direction: 'atLeast',
        fmtValue: (v) => `${Math.round(v)}/100`,
        because: `$${Math.round(perKw).toLocaleString()}/kW vs band referensi $${band.toLocaleString()}/kW (engine cx capexPerKw standard) — skor = 100 − ((perKw − 0.6×band)/(0.8×band))×60`,
        levers: specs,
    });
    const levers = solved.levers;
    levers.push({
        label: 'Band = benchmark, bukan vonis',
        detail: `Band $${band.toLocaleString()}/kW adalah benchmark cx standard build — konfigurasi premium (tier/cooling/redundansi tinggi) wajar di atasnya; nilai-engineer drivers spesifik, jangan pangkas lintas papan.`,
        targetTab: 'capex', priority: 'MED',
    });
    return { reason: solved.reason, levers: levers.slice(0, 2), targetTab: DIM_TABS.capex.tab, targetLabel: DIM_TABS.capex.label };
}

function explainConstr(score: number, target: number, ctx: DimContext): DimExplain {
    const e = ctx.evm;
    if (!e || e.planMode) {
        return {
            reason: `Construction ${score}/100 — Plan Mode (SPI/CPI baseline 1.00); skor rendah hanya muncul saat tracking EVM aktual berjalan.`,
            levers: [],
            targetTab: DIM_TABS.constr.tab, targetLabel: DIM_TABS.constr.label,
        };
    }
    const specs: ThresholdLeverSpec[] = [
        {
            lo: e.spi, hi: 1.2,
            metricAt: (s) => constrScoreOf(s, e.cpi),
            render: (x, achieved) => ({
                label: `SPI ${e.spi.toFixed(2)} → ${x.toFixed(2)}`,
                detail: `Pulihkan schedule performance ke SPI ${x.toFixed(2)} (CPI tetap ${e.cpi.toFixed(2)}) → skor ${achieved} (≥${target}) — di-solve dari formula 50×min(1.2,SPI)+50×min(1.2,CPI).`,
            }),
            unreachable: (atHi) => ({
                label: 'Recovery schedule saja tidak cukup',
                detail: `Bahkan SPI 1.20 hanya membawa skor ke ${Math.round(atHi)} — CPI ${e.cpi.toFixed(2)} yang mengikat; kendali biaya harus ikut dipulihkan.`,
            }),
            targetTab: 'construction',
        },
        {
            lo: e.cpi, hi: 1.2,
            metricAt: (c) => constrScoreOf(e.spi, c),
            render: (x, achieved) => ({
                label: `CPI ${e.cpi.toFixed(2)} → ${x.toFixed(2)}`,
                detail: `ATAU pulihkan cost performance ke CPI ${x.toFixed(2)} (SPI tetap ${e.spi.toFixed(2)}) → skor ${achieved} (≥${target}) — formula skor yang sama.`,
            }),
            unreachable: (atHi) => ({
                label: 'Kendali biaya saja tidak cukup',
                detail: `Bahkan CPI 1.20 hanya membawa skor ke ${Math.round(atHi)} — SPI ${e.spi.toFixed(2)} yang mengikat; schedule recovery harus ikut.`,
            }),
            targetTab: 'construction',
        },
    ];
    const solved = explainThresholdMetric({
        metricLabel: 'Construction',
        value: score,
        threshold: target,
        direction: 'atLeast',
        fmtValue: (v) => `${Math.round(v)}/100`,
        because: `tracking EVM live: SPI ${e.spi.toFixed(2)} · CPI ${e.cpi.toFixed(2)} — skor = 50×min(1.2,SPI) + 50×min(1.2,CPI)`,
        levers: specs,
    });
    solved.levers.push({
        label: 'SPI/CPI = aktual lapangan',
        detail: 'Angka ini berasal dari progress & spend aktual (Construction tracking), bukan parameter desain — lever nyatanya recovery plan (crash schedule / kendali biaya), target SPI/CPI di atas adalah besaran pemulihan yang harus dicapai.',
        targetTab: 'construction', priority: 'MED',
    });
    return { reason: solved.reason, levers: solved.levers.slice(0, 3), targetTab: DIM_TABS.constr.tab, targetLabel: DIM_TABS.constr.label };
}

function explainOps(score: number, target: number, ctx: DimContext): DimExplain {
    const avail = ctx.tierAvail[ctx.tier] ?? 0.9998;
    const reason = `Operational Readiness ${score}/100 = posisi availability desain Tier ${ctx.tier} (${(avail * 100).toFixed(3)}%) pada band 99.700–99.995% (engine tierAvailability).`;
    const levers: DecisionLever[] = [];
    for (let t = ctx.tier + 1; t <= 4; t++) {
        const a2 = ctx.tierAvail[t];
        if (a2 == null) continue;
        const s2 = opsScoreOf(a2);
        if (s2 >= target && s2 > score) {
            levers.push({
                label: `Tier ${ctx.tier} → Tier ${t}`,
                detail: `Upgrade ke Tier ${t} menaikkan availability desain ${(avail * 100).toFixed(3)}% → ${(a2 * 100).toFixed(3)}% (tabel engine) sehingga skor ${score} → ${s2} (≥${target}). TRADE-OFF: tier lebih tinggi menaikkan CAPEX & kompleksitas (cek CAPEX/Architecture).`,
                targetTab: 'reliability', priority: 'HIGH',
            });
            break;
        }
    }
    levers.push({
        label: 'Skor = posisi tier desain',
        detail: 'Dimensi ini murni memposisikan availability tier yang DIPILIH pada band 99.700–99.995% — bukan metrik operasional aktual. Bila Tier saat ini memang sesuai kebutuhan SLA, skor rendah adalah konsekuensi sadar, bukan defect. Catatan jujur.',
        targetTab: 'reliability', priority: 'MED',
    });
    return { reason, levers: levers.slice(0, 2), targetTab: DIM_TABS.ops.tab, targetLabel: DIM_TABS.ops.label };
}

function explainSus(score: number, target: number, ctx: DimContext): DimExplain {
    const matrix = rzData()?.pueMatrix ?? {};
    const tierKey = 'tier' + ctx.tier;
    const reason = `Sustainability ${score}/100 = (1.60 − PUE ${ctx.pue}) / 0.50 × 100 — PUE dari engine pueMatrix (${ctx.coolingType} × Tier ${ctx.tier}) pada band 1.10–1.60.`;
    const levers: DecisionLever[] = [];
    const order: DimContext['coolingType'][] = ['air', 'inrow', 'rdhx', 'liquid'];
    const ci = order.indexOf(ctx.coolingType);
    const options: { cool: string; pue: number; score: number }[] = [];
    for (const cand of order.slice(ci + 1)) {
        const p2 = matrix?.[cand]?.[tierKey];
        if (typeof p2 !== 'number' || p2 >= ctx.pue) continue;
        options.push({ cool: cand, pue: p2, score: susScoreOf(p2) });
    }
    const first = options.find((o) => o.score >= target);
    if (first) {
        const strongest = options[options.length - 1];
        levers.push({
            label: `Cooling ${ctx.coolingType} → ${first.cool}`,
            detail: `Upgrade cooling ke ${first.cool} menurunkan PUE ${ctx.pue} → ${first.pue} (engine pueMatrix, Tier ${ctx.tier}) sehingga skor ${score} → ${first.score} (≥${target})` +
                (strongest && strongest.cool !== first.cool ? `; opsi terkuat: ${strongest.cool} (PUE ${strongest.pue} → skor ${strongest.score})` : '') +
                `. Delta dihitung dari matriks PUE engine — perubahan cooling menggeser CAPEX & kompleksitas (Architecture).`,
            targetTab: 'carbon', priority: 'HIGH',
        });
    } else if (options.length) {
        const best = options[options.length - 1];
        levers.push({
            label: 'Cooling upgrade: tidak cukup sendirian',
            detail: `Bahkan ${best.cool} (PUE ${best.pue}) hanya membawa skor ke ${best.score} (<${target}) pada Tier ${ctx.tier} — cek juga tier (pueMatrix membaik di tier atas).`,
            targetTab: 'carbon', priority: 'MED',
        });
    }
    levers.push({
        label: 'Renewable TIDAK masuk skor ini',
        detail: 'Formula dimensi hanya membaca PUE — porsi renewable/carbon TIDAK mengubah skor ini (itu hidup di Sustainability Engine). Satu-satunya lever formula adalah PUE via cooling/tier. Catatan jujur.',
        targetTab: 'carbon', priority: 'MED',
    });
    return { reason, levers: levers.slice(0, 2), targetTab: DIM_TABS.sus.tab, targetLabel: DIM_TABS.sus.label };
}

function explainFin(score: number, target: number, ctx: DimContext): DimExplain {
    const fin = ctx.fin;
    if (!fin) {
        return {
            reason: `Financial ${score}/100 — engine roi model tidak tersedia; screening tidak dihitung (default netral).`,
            levers: [],
            targetTab: DIM_TABS.fin.tab, targetLabel: DIM_TABS.fin.label,
        };
    }
    const because = `screening 15 th: revenue ${fmtMoney(fin.revenue)}/th (${fmtMoney(fin.revenuePerKwMonth)}/kW/bln × ${ctx.itLoadKw.toLocaleString()} kW) − opex ${fmtMoney(fin.opexAnnual)}/th vs CAPEX ${fmtMoney(ctx.capexTotal)}; IRR ${fin.irr != null ? pct1(fin.irr) : 'tidak konvergen'} vs hurdle 10% — skor = 50 + (IRR − 10%)×400`;
    const specs: ThresholdLeverSpec[] = [
        {
            lo: 1, hi: 2.5,
            metricAt: (mult) => finScoreOf(fin.irrAt({ revMult: mult })),
            render: (x, achieved) => {
                const irr2 = fin.irrAt({ revMult: x });
                return {
                    label: `Revenue +${((x - 1) * 100).toFixed(0)}%`,
                    detail: `Revenue naik +${((x - 1) * 100).toFixed(1)}% (tarif ${fmtMoney(fin.revenuePerKwMonth)} → ${fmtMoney(fin.revenuePerKwMonth * x)}/kW/bln) membawa IRR ke ${irr2 != null ? pct1(irr2) : '—'} → skor ${achieved} (≥${target}) — di-solve bisection atas rantai cashflow screening yang sama (engine roi).`,
                };
            },
            unreachable: (atHi) => ({
                label: 'Revenue +150% pun tidak cukup',
                detail: `Bahkan revenue ×2.5 hanya membawa skor ke ${Math.round(atHi)} — struktur biaya (CAPEX + opex) yang mengikat, bukan tarif.`,
            }),
            targetTab: 'finance',
        },
        {
            lo: 0, hi: 0.6,
            metricAt: (cut) => finScoreOf(fin.irrAt({ capexMult: 1 - cut })),
            render: (x, achieved) => {
                const irr2 = fin.irrAt({ capexMult: 1 - x });
                return {
                    label: `CAPEX −${(x * 100).toFixed(0)}%`,
                    detail: `ATAU CAPEX turun −${(x * 100).toFixed(1)}% (ke ${fmtMoney(ctx.capexTotal * (1 - x))}) membawa IRR ke ${irr2 != null ? pct1(irr2) : '—'} → skor ${achieved} (≥${target}) — opex ikut dihitung ulang (basis dcContract memuat komponen capex).`,
                };
            },
            unreachable: (atHi) => ({
                label: 'CAPEX −60% pun tidak cukup',
                detail: `Bahkan CAPEX −60% hanya membawa skor ke ${Math.round(atHi)} — sisi pendapatan/opex yang mengikat.`,
            }),
            targetTab: 'capex',
        },
    ];
    const solved = explainThresholdMetric({
        metricLabel: 'Financial',
        value: score,
        threshold: target,
        direction: 'atLeast',
        fmtValue: (v) => `${Math.round(v)}/100`,
        because,
        levers: specs,
    });
    solved.levers.push({
        label: 'Hurdle & discount = konstanta scorecard',
        detail: 'Skor memakai hurdle 10% + discount 10% flat (screening scorecard) — bukan WACC/hurdle proyek Anda; IRR sendiri tak terpengaruh discount. Keputusan finansial penuh (hurdle/discount dapat diatur) ada di Financial engine.',
        targetTab: 'finance', priority: 'MED',
    });
    return { reason: solved.reason, levers: solved.levers.slice(0, 3), targetTab: DIM_TABS.fin.tab, targetLabel: DIM_TABS.fin.label };
}

/**
 * Explain one scorecard dimension. Deterministic; every lever magnitude is
 * either solved by bisection over the SAME score formula the page renders,
 * or evaluated from the real engine tables at discrete candidate configs.
 * `score` may also be ≥60 (called from the overall-grade summary) — then the
 * solve target lifts to the Good floor (70).
 */
export function explainDimension(key: DimKey, score: number, ctx: DimContext): DimExplain {
    const target = score < DIM_CHIP_FLOOR ? DIM_CHIP_FLOOR : GRADE_B_FLOOR;
    switch (key) {
        case 'req': return explainReq(score, target, ctx);
        case 'site': return explainSite(score, ctx);
        case 'arch': return explainArch(score, target, ctx);
        case 'capex': return explainCapex(score, target, ctx);
        case 'constr': return explainConstr(score, target, ctx);
        case 'ops': return explainOps(score, target, ctx);
        case 'sus': return explainSus(score, target, ctx);
        case 'fin': return explainFin(score, target, ctx);
    }
}

/* ─── Overall grade summary (grade < B → two weakest dims + top levers) ───── */

export interface OverallWeakSpot {
    key: DimKey;
    label: string;
    score: number;
    weight: number;
    topLever: DecisionLever | null;
    targetTab: string;
    targetLabel: string;
    /** Overall points gained if this dimension reaches its solve target — same weighted formula. */
    liftPts: number;
    liftTarget: number;
}

export interface OverallExplain {
    reason: string;
    spots: OverallWeakSpot[];
    note: string;
}

/**
 * Overall < 70 ("Good"/B floor): name the two weakest dimensions, attach each
 * one's top solved lever, and recompute the SAME weighted overall with both
 * lifted to their targets — honest about whether that alone reaches Good.
 */
export function explainOverall(
    dims: { key: string; label: string; score: number; weight: number }[],
    overall: number,
    grade: string,
    ctx: DimContext,
): OverallExplain {
    const totalW = dims.reduce((s, d) => s + d.weight, 0);
    const asc = [...dims].sort((a, b) => a.score - b.score);
    const spots: OverallWeakSpot[] = asc.slice(0, 2).map((d) => {
        const ex = explainDimension(d.key as DimKey, d.score, ctx);
        const topLever = ex.levers.find((l) => l.priority === 'HIGH') ?? ex.levers[0] ?? null;
        const liftTarget = Math.max(d.score, d.score < DIM_CHIP_FLOOR ? DIM_CHIP_FLOOR : GRADE_B_FLOOR);
        return {
            key: d.key as DimKey, label: d.label, score: d.score, weight: d.weight,
            topLever, targetTab: ex.targetTab, targetLabel: ex.targetLabel,
            liftPts: Math.round(((liftTarget - d.score) * d.weight / totalW) * 10) / 10,
            liftTarget,
        };
    });
    const reason = `Grade ${grade} (${overall}/100 < ${GRADE_B_FLOOR} "Good") — tertahan terutama oleh ${spots.map((s) => `${s.label} ${s.score}/100 (bobot ${Math.round(s.weight * 100)}%)`).join(' dan ')}.`;
    /* recompute the SAME weighted overall with both spots lifted to target */
    const lifted = Math.round(dims.reduce((s, d) => {
        const spot = spots.find((x) => x.key === d.key);
        return s + (spot ? spot.liftTarget : d.score) * d.weight;
    }, 0) / totalW);
    const note = lifted >= GRADE_B_FLOOR
        ? `Menaikkan keduanya ke targetnya membawa overall ${overall} → ~${lifted} (mencapai Good) — formula berbobot yang sama.`
        : `Jujur: bahkan menaikkan keduanya ke targetnya baru membawa overall ${overall} → ~${lifted} (<${GRADE_B_FLOOR}) — dimensi lain ikut menahan; lihat tabel untuk chip berikutnya.`;
    return { reason, spots, note };
}
