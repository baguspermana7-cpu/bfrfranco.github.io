/* ─── MODEL CALIBRATION (Arc-1) ──────────────────────────────────────────────
 * UI-side evaluator of `DATA.calibrationSpec` — the SAME single-source spec
 * the ship gate `tools/test-model-calibration.mjs` reads. ONE semantics: every
 * rule here mirrors the gate line-for-line, and every band resolves against
 * the LIVE corpus percentiles (`DATA.benchmarksCorpus`) — never frozen
 * numbers. POLICY: corpus regen can flip a verdict — that is a REPORTED
 * finding (CHANGELOG), bands are never silently loosened.
 * Honest scope: AGGREGATE validation only (corpus facts are not stored as
 * per-document pairs → per-project calibration is NOT possible).
 * Methodology + justification: standarization/MODEL_CALIBRATION_STANDARD.md
 * ──────────────────────────────────────────────────────────────────────── */

import { rzData } from '@/lib/rz-engine';

/* ═══ shared percentile interpolation (extracted from BenchmarkDashboard #334b;
 * numeric core is the SAME algorithm the gate ports — single source) ═══ */

export interface PercentileDist { p10: number; p25: number; p50: number; p75: number; p90: number }

/** Piecewise-linear percentile interpolation over p10..p90 anchor points,
 *  clamped to [10, 90] — identical to the gate's `pctileOf`. */
export function pctileOf(v: number, d: PercentileDist): number {
    const pts: [number, number][] = [[10, d.p10], [25, d.p25], [50, d.p50], [75, d.p75], [90, d.p90]];
    if (v < pts[0][1]) return 10;
    if (v > pts[4][1]) return 90;
    for (let i = 0; i < 4; i++) {
        const [pa, va] = pts[i], [pb, vb] = pts[i + 1];
        if (v <= vb) return vb === va ? pb : pa + (pb - pa) * ((v - va) / (vb - va));
    }
    return 90;
}

/** Dashboard-style label: marks out-of-range values as `<p10` / `>p90`,
 *  in-range as `~pXX` (same numeric core as `pctileOf`). */
export function pctileLabelOf(v: number, d: PercentileDist): { label: string; approx: number } {
    if (v < d.p10) return { label: '<p10', approx: 10 };
    if (v > d.p90) return { label: '>p90', approx: 90 };
    const p = pctileOf(v, d);
    return { label: `~p${Math.round(p)}`, approx: p };
}

/* ═══ spec + corpus shapes (read-only views over rzData()) ═══ */

type CorpusDist = PercentileDist & { n: number; unit: string; companies?: string[]; sources?: number };
type Corpus = Record<string, Record<string, CorpusDist>>;

interface CalibMapping {
    id: string;
    severity: 'fail' | 'warn';
    engineRef: string;
    corpusMetric: string;
    rule: {
        kind: 'pueBand' | 'capexRatio' | 'wueBins' | 'capacityFactor';
        pooledLow?: string[]; pooledHigh?: string[];
        bestDesign?: { cooling: string; tier: string; mustBeAtOrBelow: { segment: string; pctile: keyof PercentileDist } };
        segments?: string[]; nFloor?: number; ratioLow?: number; ratioHigh?: number; engineKey?: string;
        highType?: string; highBand?: [keyof PercentileDist, keyof PercentileDist];
        lowTypes?: string[]; lowCeilPctile?: keyof PercentileDist; segment?: string;
        cfLow?: number; cfHigh?: number;
    };
    basisNote: string;
    limitation: string;
}

interface CalibSpec {
    mappings: CalibMapping[];
    notMappable: { metric: string; reason: string }[];
}

/* ═══ result types ═══ */

export type CalibVerdict = 'in-band' | 'drift' | 'indicative';

export interface CalibrationCheck { label: string; ok: boolean }

export interface CalibrationRow {
    id: string;
    severity: 'fail' | 'warn';
    engineLabel: string;        // spec engineRef (which engine constant)
    engineValueText: string;    // live engine constant(s), rendered
    engineSource: string;       // DATA.sources provenance for the constant
    corpusLabel: string;        // corpus segment(s) + p50 + n
    positionText: string;       // posisi/rasio headline — SAME numbers as the gate output
    positionPctile?: number;    // headline percentile where the rule has one
    verdict: CalibVerdict;
    basisNote: string;
    limitation: string;
    checks: CalibrationCheck[];
}

export interface CalibrationResult {
    rows: CalibrationRow[];
    notMappable: { metric: string; reason: string }[];
    /* headline probes for TraceValue nodes (value-trace.ts calib.*) */
    pueLiquidT3Pctile: number | null;   // liquid tier3 position in hyperscale fleet (rounded, gate-identical)
    pueAirT3Pctile: number | null;      // air tier3 position in hyperscale fleet
    capexRatioFinance: number | null;   // corpus finance $/MW ÷ engine $/MW (2dp, gate-identical)
    capexRatioPm: number | null;
    impliedCfResearch: number | null;   // implied capacity factor, research segment (fraction)
}

/* pooled min/max of a percentile key across segments (conservative envelope —
 * identical to the gate's segLow/segHigh) */
const segLow = (corpus: Corpus, metric: string, segs: string[], key: keyof PercentileDist): number =>
    Math.min(...segs.map((s) => corpus[metric]?.[s]?.[key]).filter((x): x is number => Number.isFinite(x)));
const segHigh = (corpus: Corpus, metric: string, segs: string[], key: keyof PercentileDist): number =>
    Math.max(...segs.map((s) => corpus[metric]?.[s]?.[key]).filter((x): x is number => Number.isFinite(x)));

const verdictOf = (severity: 'fail' | 'warn', checks: CalibrationCheck[]): CalibVerdict => {
    if (checks.length === 0) return 'indicative';
    if (checks.some((c) => !c.ok)) return 'drift';
    return severity === 'fail' ? 'in-band' : 'indicative';
};

/* engine-source lookup keyed per mapping (DATA.sources sidecar) */
const SOURCE_KEY: Record<string, string> = {
    'pue.design.vs.fleet': 'pueMatrix',
    'capex.aggregate.ratio': 'capexPerMw',
    'wue.binned': 'waterFootprint',
    'energy.capacity.coherence': 'benchmarksCorpus',
};

let _cache: CalibrationResult | null = null;

/** Evaluate all `DATA.calibrationSpec` mappings against the LIVE corpus +
 *  engine constants. Null when the engine is unavailable. Memoized (spec,
 *  corpus, and engine constants are static at runtime). */
export function computeCalibration(): CalibrationResult | null {
    if (_cache) return _cache;
    try {
        const data = rzData() as {
            calibrationSpec?: CalibSpec;
            benchmarksCorpus?: Corpus;
            pueMatrix?: Record<string, Record<string, number>>;
            capexPerMw?: Record<string, number>;
            waterFootprint?: { wueBase?: Record<string, number> };
            sources?: Record<string, { source?: string; asOf?: string }>;
        };
        const spec = data.calibrationSpec;
        const corpus = data.benchmarksCorpus;
        if (!spec || !Array.isArray(spec.mappings) || !corpus) return null;

        const srcOf = (id: string): string => {
            const s = data.sources?.[SOURCE_KEY[id] ?? ''];
            return s?.source ? `${s.source}${s.asOf ? ` (as of ${s.asOf})` : ''}` : '—';
        };

        const rows: CalibrationRow[] = [];
        let pueLiquidT3Pctile: number | null = null;
        let pueAirT3Pctile: number | null = null;
        let capexRatioFinance: number | null = null;
        let capexRatioPm: number | null = null;
        let impliedCfResearch: number | null = null;

        for (const m of spec.mappings) {
            const checks: CalibrationCheck[] = [];
            let engineValueText = '—';
            let corpusLabel = '—';
            let positionText = '—';
            let positionPctile: number | undefined;

            if (m.rule.kind === 'pueBand') {
                /* Guard band: each cooling-class tier-3 design PUE ∈
                 * [p10 pooled hyperscale∪research, p90 pooled ∪spec] + sharp rule
                 * best design (liquid tier4) ≤ hyperscale fleet MEDIAN — gate-identical. */
                const pm = data.pueMatrix;
                const lo = segLow(corpus, m.corpusMetric, m.rule.pooledLow ?? [], 'p10');
                const hi = segHigh(corpus, m.corpusMetric, m.rule.pooledHigh ?? [], 'p90');
                if (pm && Number.isFinite(lo) && Number.isFinite(hi)) {
                    /* same fixed cooling list as the gate */
                    const coolings = ['liquid', 'rdhx', 'inrow', 'air'];
                    for (const cooling of coolings) {
                        const v = pm[cooling]?.tier3;
                        checks.push({ label: `${cooling} tier3 ${v} ∈ [${lo}, ${hi}]`, ok: v != null && v >= lo && v <= hi });
                    }
                    const bd = m.rule.bestDesign;
                    if (bd) {
                        const capV = corpus[m.corpusMetric]?.[bd.mustBeAtOrBelow.segment]?.[bd.mustBeAtOrBelow.pctile];
                        const best = pm[bd.cooling]?.[bd.tier];
                        checks.push({
                            label: `sharp: best design ${bd.cooling}.${bd.tier} ${best} ≤ fleet ${bd.mustBeAtOrBelow.segment} ${bd.mustBeAtOrBelow.pctile} ${capV}`,
                            ok: best != null && capV != null && best <= capV,
                        });
                    }
                    engineValueText = coolings.map((c) => `${c} ${pm[c]?.tier3?.toFixed(2) ?? '—'}`).join(' · ') + ' (tier3)'
                        + (m.rule.bestDesign ? ` · best ${m.rule.bestDesign.cooling} ${m.rule.bestDesign.tier} ${pm[m.rule.bestDesign.cooling]?.[m.rule.bestDesign.tier] ?? '—'}` : '');
                    const hyper = corpus[m.corpusMetric]?.hyperscale;
                    if (hyper) {
                        const pLiquid = Math.round(pctileOf(pm.liquid?.tier3 ?? NaN, hyper));
                        const pAir = Math.round(pctileOf(pm.air?.tier3 ?? NaN, hyper));
                        pueLiquidT3Pctile = Number.isFinite(pLiquid) ? pLiquid : null;
                        pueAirT3Pctile = Number.isFinite(pAir) ? pAir : null;
                        positionText = `liquid t3 ${pm.liquid?.tier3} ≈ p${pLiquid} · air t3 ${pm.air?.tier3} ≈ p${pAir} of hyperscale fleet (n=${hyper.n})`;
                        positionPctile = pueLiquidT3Pctile ?? undefined;
                        corpusLabel = `band pooled [${lo}, ${hi}] · hyperscale p50 ${hyper.p50} (n=${hyper.n})`;
                    } else {
                        corpusLabel = `band pooled [${lo}, ${hi}]`;
                    }
                } else {
                    checks.push({ label: 'pue corpus envelope resolves', ok: false });
                }
            } else if (m.rule.kind === 'capexRatio') {
                /* corpus p50($/MW total-project) ÷ engine raw-build $/MW ∈
                 * [ratioLow, ratioHigh] per segment with n ≥ nFloor — gate-identical. */
                const enginePerMw = data.capexPerMw?.[m.rule.engineKey ?? ''];
                if (Number.isFinite(enginePerMw)) {
                    engineValueText = `$${((enginePerMw as number) / 1e6).toFixed(1)}M/MW (${m.rule.engineKey}, raw build)`;
                    const posParts: string[] = [];
                    const corpParts: string[] = [];
                    for (const seg of m.rule.segments ?? []) {
                        const inv = corpus.investment_busd?.[seg];
                        const capD = corpus.capacity_mw?.[seg];
                        if (!inv || !capD) { checks.push({ label: `segment ${seg} present`, ok: false }); continue; }
                        if (inv.n < (m.rule.nFloor ?? 5)) { posParts.push(`${seg}: n=${inv.n} < floor ${m.rule.nFloor} — skipped`); continue; }
                        const corpusPerMw = (inv.p50 * 1e9) / capD.p50;   // USD/MW, total-project scope
                        const r = corpusPerMw / (enginePerMw as number);
                        const ok = r >= (m.rule.ratioLow ?? 1) && r <= (m.rule.ratioHigh ?? 4);
                        checks.push({ label: `${seg}: rasio ${r.toFixed(2)} ∈ [${m.rule.ratioLow}, ${m.rule.ratioHigh}]`, ok });
                        posParts.push(`${seg} $${(corpusPerMw / 1e6).toFixed(1)}M/MW ÷ $${((enginePerMw as number) / 1e6).toFixed(1)}M/MW = ${r.toFixed(2)}`);
                        corpParts.push(`${seg} inv p50 $${inv.p50}B / cap p50 ${capD.p50} MW (n=${inv.n})`);
                        if (seg === 'finance') capexRatioFinance = +r.toFixed(2);
                        if (seg === 'pm') capexRatioPm = +r.toFixed(2);
                    }
                    positionText = posParts.join(' · ') || '—';
                    corpusLabel = corpParts.join(' · ') || '—';
                } else {
                    checks.push({ label: `capexPerMw key ${m.rule.engineKey} resolves`, ok: false });
                }
            } else if (m.rule.kind === 'wueBins') {
                /* small-n indicative: evaporative ∈ [p50, p90]; low-water types
                 * ≤ p25 — gate-identical. */
                const dist = corpus[m.corpusMetric]?.[m.rule.segment ?? ''];
                const base = data.waterFootprint?.wueBase;
                if (dist && base) {
                    const hv = base[m.rule.highType ?? ''];
                    const [loK, hiK] = m.rule.highBand ?? ['p50', 'p90'];
                    checks.push({ label: `high-bin ${m.rule.highType} ${hv} ∈ [${dist[loK]}, ${dist[hiK]}]`, ok: hv != null && hv >= dist[loK] && hv <= dist[hiK] });
                    const ceil = dist[m.rule.lowCeilPctile ?? 'p25'];
                    for (const t of m.rule.lowTypes ?? []) {
                        const lv = base[t];
                        checks.push({ label: `low-bin ${t} ${lv} ≤ ${m.rule.lowCeilPctile} ${ceil}`, ok: lv != null && lv <= ceil });
                    }
                    engineValueText = `${m.rule.highType} ${hv} · ` + (m.rule.lowTypes ?? []).map((t) => `${t} ${base[t]}`).join(' · ') + ' L/kWh';
                    corpusLabel = `${m.rule.segment} p25 ${dist.p25} · p50 ${dist.p50} · p90 ${dist.p90} (n=${dist.n})`;
                    positionText = `${m.rule.highType} ${hv} ∈ [${dist[loK]}, ${dist[hiK]}] (n=${dist.n} — indicative)`;
                } else {
                    checks.push({ label: 'wue distribution present', ok: false });
                }
            } else if (m.rule.kind === 'capacityFactor') {
                /* implied CF = energy_gwh p50 ÷ (capacity_mw p50 × 8760h) ∈
                 * (cfLow, cfHigh] per segment — gate-identical. */
                const posParts: string[] = [];
                const corpParts: string[] = [];
                for (const seg of m.rule.segments ?? []) {
                    const e = corpus.energy_gwh?.[seg];
                    const c = corpus.capacity_mw?.[seg];
                    if (!e || !c) { checks.push({ label: `coherence segment ${seg} present`, ok: false }); continue; }
                    const cf = (e.p50 * 1000) / (c.p50 * 8760);   // MWh ÷ (MW×h)
                    const ok = cf > (m.rule.cfLow ?? 0.02) && cf <= (m.rule.cfHigh ?? 1);
                    checks.push({ label: `${seg}: CF ${(cf * 100).toFixed(1)}% ∈ (${(m.rule.cfLow ?? 0.02) * 100}%, ${(m.rule.cfHigh ?? 1) * 100}%)`, ok });
                    posParts.push(`${seg} implied CF ${(cf * 100).toFixed(1)}%`);
                    corpParts.push(`${seg} energy p50 ${e.p50} GWh / cap p50 ${c.p50} MW (n=${e.n}/${c.n})`);
                    if (seg === 'research') impliedCfResearch = cf;
                }
                engineValueText = 'implied CF = energy_gwh ÷ (capacity_mw × 8.76) — koherensi, bukan konstanta';
                positionText = posParts.join(' · ') || '—';
                corpusLabel = corpParts.join(' · ') || '—';
            }

            rows.push({
                id: m.id,
                severity: m.severity,
                engineLabel: m.engineRef,
                engineValueText,
                engineSource: srcOf(m.id),
                corpusLabel,
                positionText,
                positionPctile,
                verdict: verdictOf(m.severity, checks),
                basisNote: m.basisNote,
                limitation: m.limitation,
                checks,
            });
        }

        const result: CalibrationResult = {
            rows,
            notMappable: Array.isArray(spec.notMappable) ? spec.notMappable : [],
            pueLiquidT3Pctile,
            pueAirT3Pctile,
            capexRatioFinance,
            capexRatioPm,
            impliedCfResearch,
        };
        if (rows.length > 0) _cache = result;   // never memoize an engine-absent miss
        return result;
    } catch {
        return null;
    }
}
