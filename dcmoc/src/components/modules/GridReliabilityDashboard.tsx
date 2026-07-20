'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { calculateGridReliability, GridReliabilityResult } from '@/modules/infrastructure/GridReliabilityEngine';
import { COUNTRIES, CountryProfile } from '@/constants/countries';
import { rzModels, useEngineReady } from '@/lib/rz-engine';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/Tooltip';
import { Zap, Activity, Fuel, Battery, Shield, Sun, AlertTriangle } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { fmt, fmtMoney } from '@/lib/format';

const gradeColors: Record<string, string> = {
    A: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    B: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    C: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    D: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    F: 'text-red-400 bg-red-500/10 border-red-500/30',
};

/* ─── DIAGNOSTICS Tier-2 (DIAGNOSTICS_STANDARD.md) ────────────────────────────
 * Template: BenchmarkDashboard clickable alert-grade → computed reason +
 * quantified levers. Every number in the panel comes from the SAME
 * calculateGridReliability result the KPIs render (genset kW, fuel $, UPS $,
 * availability-with-backup) or from the live country grid data — nothing
 * generic, nothing fabricated. The score/outage decompositions are runtime
 * MIRRORS of the engine formulas and are parity-VERIFIED against the engine
 * output every render (chip "≡ engine" / drift warning — MaintenanceDashboard
 * pattern), so a silent engine change can never make the panel lie.
 * ──────────────────────────────────────────────────────────────────────── */

type Grade = GridReliabilityResult['reliabilityGrade'];

/** Grades rendered in alert colours by `gradeColors` (orange `D` / red `F`) —
 *  the SAME set gates the click-to-explain panel and `collectGridDiagnostics`. */
const ALERT_GRADES: readonly Grade[] = ['D', 'F'];
const isAlertGrade = (g: Grade): boolean => ALERT_GRADES.includes(g);

/** Grade bands — single-constant MIRROR of GridReliabilityEngine's ternary
 *  (`score ≥90 A · ≥75 B · ≥55 C · ≥35 D · else F`). Used for the panel
 *  threshold text, the grade-C deficit, and the collector; parity against the
 *  engine's own grade is verified at runtime in `computeGridDiag`. */
const GRADE_BANDS: readonly { min: number; grade: Grade }[] = [
    { min: 90, grade: 'A' },
    { min: 75, grade: 'B' },
    { min: 55, grade: 'C' },
    { min: 35, grade: 'D' },
    { min: 0, grade: 'F' },
];
const GRADE_C_MIN_SCORE = GRADE_BANDS.find(b => b.grade === 'C')!.min;
const gradeOfScore = (s: number): Grade => GRADE_BANDS.find(b => s >= b.min)!.grade;
const GRADE_BAND_TEXT = GRADE_BANDS.map(b => (b.min > 0 ? `${b.grade} ≥${b.min}` : `${b.grade} <${GRADE_BANDS[GRADE_BANDS.length - 2].min}`)).join(' · ');

interface ScoreComponent {
    label: string;
    /** Live country input the sub-score is computed from. */
    live: string;
    sub: number;
    weightPct: number;
}

interface GridDiag {
    components: ScoreComponent[];
    localScore: number;
    /** RZEngine `grid.score(uptime)×100` half of the blend — null when the engine is absent. */
    engineHalf: number | null;
    recomputedScore: number;
    /** Runtime mirror ≡ engine output (score AND grade). */
    scoreParity: boolean;
    /* Blended outage-minutes decomposition (same blend the KPI renders). */
    hasOutageData: boolean;
    saidiMin: number;
    saidiFromEngine: boolean;
    eventMin: number;
    /** null when the country lacks brownout/duration data (legacy engine path — no blend). */
    blendParity: boolean | null;
    /** Points still needed to reach the grade-C boundary. */
    deficitToC: number;
}

/** Pure decomposition of the live grade — formulas are 1:1 mirrors of
 *  GridReliabilityEngine (weights 40/20/20/20, 50/50 engine blend, SAIDI+event
 *  outage blend) and are parity-checked against `result` by the caller's UI. */
function computeGridDiag(result: GridReliabilityResult, grid: CountryProfile['gridReliability']): GridDiag {
    // Same defaults as the engine's "Defaults if grid data not available" block.
    const gridUptime = grid?.gridUptime ?? 99.9;
    const voltageStability = grid?.voltageStability ?? 'moderate';
    const brownoutFreq = grid?.brownoutFrequency ?? 5;
    const avgOutageDuration = grid?.averageOutageDuration ?? 15;

    const uptimeScore = Math.max(0, Math.min(100, ((gridUptime - 95) / 5) * 100));
    const voltageScore = voltageStability === 'stable' ? 100 : voltageStability === 'moderate' ? 50 : 10;
    const brownoutScore = Math.max(0, 100 - brownoutFreq * 2);
    const durationScore = Math.max(0, Math.min(100, (120 - avgOutageDuration) / 1.2));
    const localScore = Math.round(uptimeScore * 0.4 + voltageScore * 0.2 + brownoutScore * 0.2 + durationScore * 0.2);

    const gridModel = rzModels().grid;
    const engineHalf = gridModel && typeof gridModel.score === 'function' ? gridModel.score(gridUptime) * 100 : null;
    const recomputedScore = engineHalf != null ? Math.round(localScore * 0.5 + engineHalf * 0.5) : localScore;
    const scoreParity = recomputedScore === result.reliabilityScore && gradeOfScore(recomputedScore) === result.reliabilityGrade;

    const saidiFromEngine = !!(gridModel && typeof gridModel.annualOutageHours === 'function');
    const saidiMin = saidiFromEngine ? gridModel.annualOutageHours(gridUptime) * 60 : ((100 - gridUptime) / 100) * 525600;
    const hasOutageData = grid?.brownoutFrequency != null && grid?.averageOutageDuration != null;
    const eventMin = brownoutFreq * avgOutageDuration;
    const blendParity = hasOutageData
        ? Math.abs(Math.round(0.5 * saidiMin + 0.5 * eventMin) - result.annualOutageMinutes) <= 1
        : null;

    return {
        components: [
            { label: 'Grid uptime', live: `${gridUptime}%`, sub: Math.round(uptimeScore), weightPct: 40 },
            { label: 'Stabilitas tegangan', live: voltageStability, sub: voltageScore, weightPct: 20 },
            { label: 'Frekuensi brownout', live: `${brownoutFreq}×/thn`, sub: Math.round(brownoutScore), weightPct: 20 },
            { label: 'Durasi outage rata-rata', live: `${avgOutageDuration} mnt`, sub: Math.round(durationScore), weightPct: 20 },
        ],
        localScore,
        engineHalf,
        recomputedScore,
        scoreParity,
        hasOutageData,
        saidiMin,
        saidiFromEngine,
        eventMin,
        blendParity,
        deficitToC: Math.max(0, GRADE_C_MIN_SCORE - result.reliabilityScore),
    };
}

/** Parity chip — "≡ engine" when the runtime mirror matches the engine number,
 *  honest drift warning when it does not (MaintenanceDashboard pattern). */
const ParityChip = ({ ok }: { ok: boolean }) => (
    ok
        ? <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">≡ engine</span>
        : <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">⚠ drift vs engine — dekomposisi runtime tidak cocok, percayai angka KPI</span>
);

/* ─── EXPORTED COLLECTOR (Diagnostics Center contract) ────────────────────── */

export interface Finding {
    surface: string;
    severity: 'critical' | 'warning';
    metric: string;
    value: string;
    threshold: string;
    linkTab: 'grid';
}

/** Pure Tier-2 diagnostics collector: reliability grade in the ALERT_GRADES
 *  set (the same set `gradeColors` renders orange/red). Deterministic — reads
 *  only the passed live engine result. */
export function collectGridDiagnostics(model: { result: GridReliabilityResult; countryName?: string }): Finding[] {
    const { result, countryName } = model;
    if (!isAlertGrade(result.reliabilityGrade)) return [];
    return [{
        surface: 'Grid Reliability · Grade',
        severity: result.reliabilityGrade === 'F' ? 'critical' : 'warning',
        metric: `Grid reliability score${countryName ? ` (${countryName})` : ''}`,
        value: `${result.reliabilityGrade} (${result.reliabilityScore}/100) · outage ${(result.annualOutageMinutes / 60).toFixed(1)} jam/thn · mitigasi ${result.gridRiskAdjustedOpex.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}/thn`,
        threshold: `grade C butuh skor ≥ ${GRADE_C_MIN_SCORE} (band engine: ${GRADE_BAND_TEXT})`,
        linkTab: 'grid',
    }];
}

const GridReliabilityDashboard = () => {
    const { selectedCountry, inputs } = useSimulationStore();
    const capexStore = useCapexStore();
    /* Diagnostics Tier-2: clickable D/F grade → explain panel (state + scroll
     * target for the "lihat perbandingan negara ↗" navigation). engineReady in
     * the memo deps keeps result + diag recomputed together once the deferred
     * rz-engine.min.js lands, so the parity check compares like with like. */
    const [gradeOpen, setGradeOpen] = useState(false);
    const comparisonRef = useRef<HTMLDivElement>(null);
    const engineReady = useEngineReady();

    const result = useMemo(() => {
        if (!selectedCountry) return null;
        return calculateGridReliability({
            country: selectedCountry,
            itLoadKw: capexStore.inputs.itLoad || inputs.itLoad,
            tierLevel: inputs.tierLevel,
            coolingType: inputs.coolingType,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- engineReady re-runs the engine-blended score when RZEngine loads late
    }, [selectedCountry, inputs, capexStore.inputs, engineReady]);

    const diag = useMemo(() => {
        if (!result || !isAlertGrade(result.reliabilityGrade)) return null;
        return computeGridDiag(result, selectedCountry?.gridReliability);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- engineReady: same re-run trigger as `result`
    }, [result, selectedCountry, engineReady]);

    const countryComparison = useMemo(() => {
        return Object.values(COUNTRIES)
            .map(c => {
                const r = calculateGridReliability({ country: c, itLoadKw: 1000, tierLevel: 3, coolingType: 'air' });
                return { country: c.name, code: c.id, score: r.reliabilityScore, uptime: c.gridReliability?.gridUptime ?? 99 };
            })
            .sort((a, b) => b.score - a.score);
    }, []);

    if (!result || !selectedCountry) {
        return <div className="p-8 text-center text-slate-500">Select a country to view grid reliability analysis.</div>;
    }

    const grid = selectedCountry.gridReliability;

    /* "Negara X vs alternatif" — ONLY from the comparison data ALREADY on this
     * page (the countryComparison memo feeding the bar chart, normalised basis
     * 1 MW · Tier 3 · air). No new data source is introduced. */
    const selComparison = countryComparison.find(c => c.code === selectedCountry.id);
    const alternatives = diag && selComparison
        ? countryComparison.filter(c => c.code !== selectedCountry.id && c.score >= GRADE_C_MIN_SCORE && c.score > selComparison.score).slice(0, 3)
        : [];

    const dualFeedCost = result.costBreakdown.find(i => i.label === 'Dual Feed (Annualized)')?.value ?? 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Zap className="w-6 h-6 text-amber-500" />
                    Grid Reliability Index
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {selectedCountry.name} · Grid Uptime: {grid?.gridUptime ?? 99}% · Tier {inputs.tierLevel}
                </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Activity className="w-4 h-4 text-cyan-500" />
                            <span className="text-xs text-slate-500 uppercase">Grid Score</span>
                            <Tooltip content="Composite reliability score (0-100) based on uptime, voltage stability, brownout frequency, and outage duration." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{result.reliabilityScore}</div>
                        {/* Diagnostics Tier-2: alert grade (ALERT_GRADES = same D/F set
                          * gradeColors renders orange/red) is clickable → explain panel. */}
                        <div
                            className={`text-xs mt-1 px-2 py-0.5 rounded border w-fit ${gradeColors[result.reliabilityGrade]} ${diag ? 'cursor-pointer underline decoration-dotted underline-offset-2' : ''}`}
                            role={diag ? 'button' : undefined}
                            tabIndex={diag ? 0 : undefined}
                            title={diag ? `Grade ${result.reliabilityGrade} — klik untuk lihat kenapa (SAIDI/brownout/uptime live) + mitigasi terukur dari model.` : undefined}
                            onClick={diag ? () => setGradeOpen(o => !o) : undefined}
                            onKeyDown={diag ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setGradeOpen(o => !o); } } : undefined}
                        >
                            Grade {result.reliabilityGrade}{diag ? ' ▸' : ''}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-4 h-4 text-red-500" />
                            <span className="text-xs text-slate-500 uppercase">Outage Hrs/Yr</span>
                            <Tooltip content="Expected hours of grid unavailability per year based on historical data for the selected country." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{(result.annualOutageMinutes / 60).toFixed(1)}</div>
                        <div className="text-xs text-slate-500 mt-1">{result.annualExpectedOutages} events</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Shield className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs text-slate-500 uppercase">Gen Capacity</span>
                            <Tooltip content="Seconds from power failure to generator reaching rated voltage and frequency. Typically 10-15s for diesel." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(result.requiredGenCapacity)}</div>
                        <div className="text-xs text-slate-500 mt-1">kW required</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Fuel className="w-4 h-4 text-amber-500" />
                            <span className="text-xs text-slate-500 uppercase">Fuel Cost/Yr</span>
                            <Tooltip content="Annual diesel fuel expenditure for backup generators based on expected outage hours and required generator capacity." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtMoney(result.annualFuelCost)}</div>
                        <div className="text-xs text-slate-500 mt-1">{result.recommendedFuelHours}h fuel reserve</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Battery className="w-4 h-4 text-purple-500" />
                            <span className="text-xs text-slate-500 uppercase">BESS ROI</span>
                            <Tooltip content="Battery Energy Storage System payback period in years." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{result.batteryStorageROI < 50 ? `${result.batteryStorageROI}yr` : 'N/A'}</div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Sun className="w-4 h-4 text-yellow-500" />
                            <span className="text-xs text-slate-500 uppercase">Solar Ready</span>
                            <Tooltip content="Feasibility score for on-site solar based on irradiance, roof area, and local net metering policy." />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{result.solarViabilityScore}</div>
                        <div className="text-xs text-slate-500 mt-1">/100 viability</div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Diagnostics Tier-2: kenapa grade D/F + mitigasi terukur ── */}
            {diag && gradeOpen && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800/40 dark:bg-red-950/20">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            Kenapa grade {result.reliabilityGrade}? — {selectedCountry.name} skor {result.reliabilityScore}/100
                        </span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                        Grade dari band skor yang sama dengan pewarnaan badge ({GRADE_BAND_TEXT}) — butuh ≥{GRADE_C_MIN_SCORE} untuk
                        grade C, kurang {diag.deficitToC} poin. Kualitas grid adalah data negara (bukan input yang bisa di-tune),
                        jadi lever-nya adalah mitigasi backup terukur di bawah — atau pindah negara (bagian alternatif).
                    </p>

                    {/* (a) ALASAN — dekomposisi skor dari data grid live, parity-verified */}
                    <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Dekomposisi skor (data grid {selectedCountry.name} live)
                    </div>
                    <div className="mt-1.5 space-y-1">
                        {diag.components.map(c => (
                            <div key={c.label} className="flex items-center gap-2 text-xs">
                                <span className="text-slate-700 dark:text-slate-300">{c.label}</span>
                                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">{c.live}</span>
                                <span className="ml-auto font-mono tabular-nums text-slate-600 dark:text-slate-300">{c.sub}/100 · bobot {c.weightPct}%</span>
                            </div>
                        ))}
                        <div className="flex items-center gap-2 border-t border-red-200/60 pt-1.5 text-xs dark:border-red-800/30">
                            <span className="text-slate-700 dark:text-slate-300">
                                Komposit lokal {diag.localScore}
                                {diag.engineHalf != null
                                    ? ` → blend 50/50 dengan model SAIDI RZEngine grid.score (${Math.round(diag.engineHalf)}/100)`
                                    : ' (RZEngine belum termuat — skor lokal saja, sama dengan jalur fallback engine)'}
                            </span>
                            <span className="ml-auto font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                                = {diag.recomputedScore}
                            </span>
                            <ParityChip ok={diag.scoreParity} />
                        </div>
                    </div>

                    {/* (a) ALASAN — blended outage minutes, engine yang sama dengan KPI Outage Hrs/Yr */}
                    <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Menit outage blended (engine yang sama dengan KPI di atas)
                    </div>
                    {diag.hasOutageData ? (
                        <div className="mt-1.5 space-y-1 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-700 dark:text-slate-300">
                                    SAIDI dari uptime {grid?.gridUptime}% {diag.saidiFromEngine ? '(RZEngine grid.annualOutageHours)' : '(fallback lokal, matematika sama)'}
                                </span>
                                <span className="ml-auto font-mono tabular-nums text-slate-600 dark:text-slate-300">{fmt(Math.round(diag.saidiMin))} mnt/thn × 0.5</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-700 dark:text-slate-300">
                                    Event-based: {grid?.brownoutFrequency}×/thn × {grid?.averageOutageDuration} mnt
                                </span>
                                <span className="ml-auto font-mono tabular-nums text-slate-600 dark:text-slate-300">{fmt(Math.round(diag.eventMin))} mnt/thn × 0.5</span>
                            </div>
                            <div className="flex items-center gap-2 border-t border-red-200/60 pt-1.5 dark:border-red-800/30">
                                <span className="text-slate-700 dark:text-slate-300">Blend 50/50 → {result.annualExpectedOutages} event/thn</span>
                                <span className="ml-auto font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                                    = {fmt(result.annualOutageMinutes)} mnt ({(result.annualOutageMinutes / 60).toFixed(1)} jam)/thn
                                </span>
                                <ParityChip ok={diag.blendParity === true} />
                            </div>
                        </div>
                    ) : (
                        <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                            Data brownout/durasi negara ini tidak tersedia — engine memakai jalur SAIDI-uptime saja:
                            {' '}{fmt(result.annualOutageMinutes)} mnt ({(result.annualOutageMinutes / 60).toFixed(1)} jam)/thn, {result.annualExpectedOutages} event.
                        </p>
                    )}

                    {/* (b) LEVER TERUKUR — angka model, bukan saran generik */}
                    <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Mitigasi terukur (angka dari model yang sama dengan KPI, bukan generik)
                    </div>
                    <div className="mt-1.5 space-y-1.5">
                        <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-white/70 p-2 dark:border-slate-700 dark:bg-slate-900/50">
                            <span className="shrink-0 whitespace-nowrap rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Genset {fmt(result.requiredGenCapacity)} kW</span>
                            <span className="flex-1 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                                Kapasitas dibutuhkan = IT load × PUE × redundansi Tier {inputs.tierLevel} → {fmt(result.requiredGenCapacity)} kW.
                                Run-hours outage ≈ {(result.annualOutageMinutes / 60).toFixed(1)} jam/thn → fuel {fmtMoney(result.annualFuelCost)}/thn
                                (termasuk uji berkala + premi fuel negara; reserve on-site {result.recommendedFuelHours} jam).
                            </span>
                        </div>
                        <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-white/70 p-2 dark:border-slate-700 dark:bg-slate-900/50">
                            <span className="shrink-0 whitespace-nowrap rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">UPS ride-through</span>
                            <span className="flex-1 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                                {grid?.voltageStability === 'unstable'
                                    ? 'Grid unstable → baterai Li-Ion direkomendasikan (stres brownout tinggi mempercepat degradasi VRLA)'
                                    : 'VRLA standar memadai untuk stabilitas tegangan saat ini'}
                                {' '}— biaya penggantian baterai {fmtMoney(result.annualUpsReplacementCost)}/thn (stres brownout sudah dihitung model).
                                {result.batteryStorageROI < 50 ? ` BESS 30-mnt payback ${result.batteryStorageROI} thn (KPI BESS ROI).` : ' BESS 30-mnt tidak ekonomis (ROI N/A).'}
                            </span>
                        </div>
                        <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-white/70 p-2 dark:border-slate-700 dark:bg-slate-900/50">
                            <span className="shrink-0 whitespace-nowrap rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Hasil dengan backup</span>
                            <span className="flex-1 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                                {result.dualFeedRecommendation ? `Dual feed A+B direkomendasikan (${fmtMoney(dualFeedCost)}/thn teranualisasi) + ` : ''}
                                arsitektur backup di atas menaikkan availability {grid?.gridUptime ?? 99}% (grid saja)
                                → {result.availabilityWithBackup.toFixed(3)}% — total biaya mitigasi {fmtMoney(result.gridRiskAdjustedOpex)}/thn
                                (breakdown di kartu bawah).
                            </span>
                        </div>
                    </div>

                    {/* (b/c) Negara vs alternatif — HANYA dari data comparison yang sudah ada di halaman */}
                    {alternatives.length > 0 && selComparison && (
                        <>
                            <div className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                {selectedCountry.name} vs alternatif (dari chart perbandingan di halaman ini — basis normalisasi 1 MW · Tier 3 · air)
                            </div>
                            <div className="mt-1.5 space-y-1">
                                {alternatives.map(a => (
                                    <div key={a.code} className="flex items-center gap-2 text-xs">
                                        <span className="text-slate-700 dark:text-slate-300">{a.country}</span>
                                        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">uptime {a.uptime}%</span>
                                        <span className="ml-auto font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                            skor {a.score}/100 (+{a.score - selComparison.score} vs {selectedCountry.name} {selComparison.score})
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                className="mt-2 text-[11px] font-semibold text-cyan-700 hover:underline dark:text-cyan-400"
                                onClick={() => comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            >
                                Lihat perbandingan negara lengkap ↗
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Grid Penalty & Cost Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Annual Grid Risk Cost Breakdown</h3>
                        <div className="space-y-3">
                            {result.costBreakdown.map(item => (
                                <div key={item.label} className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600 dark:text-slate-400">{item.label}</span>
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{fmtMoney(item.value)}</span>
                                </div>
                            ))}
                            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Total Grid-Adjusted OPEX</span>
                                <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{fmtMoney(result.gridRiskAdjustedOpex)}</span>
                            </div>
                        </div>

                        {/* Backup Architecture */}
                        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Backup Architecture</h4>
                            <div className="text-xs font-mono text-slate-600 dark:text-slate-400 space-y-1">
                                <div>Grid Feed {result.dualFeedRecommendation ? '(Dual A+B)' : '(Single)'} → ATS → UPS ({fmt(inputs.itLoad)} kW)</div>
                                <div className="pl-4">├── Generator: {fmt(result.requiredGenCapacity)} kW ({result.recommendedFuelHours}h fuel)</div>
                                <div className="pl-4">├── UPS Battery: {grid?.voltageStability === 'unstable' ? 'Li-Ion recommended' : 'VRLA standard'}</div>
                                <div className="pl-4">└── Availability: {result.availabilityWithBackup.toFixed(3)}% (with backup)</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Country Comparison — scroll target of the diagnostics panel's "↗" nav */}
                <Card ref={comparisonRef} className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Grid Reliability by Country</h3>
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={countryComparison.slice(0, 15)} layout="vertical" margin={{ left: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                <YAxis dataKey="country" type="category" width={80} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <RTooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                    labelStyle={{ color: '#e2e8f0' }}
                                    formatter={(v: any) => [`${v}/100`, 'Score']}
                                />
                                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                                    {countryComparison.slice(0, 15).map((entry) => (
                                        <Cell
                                            key={entry.code}
                                            fill={entry.code === selectedCountry.id ? '#06b6d4' : entry.score >= 80 ? '#10b981' : entry.score >= 50 ? '#f59e0b' : '#ef4444'}
                                            opacity={entry.code === selectedCountry.id ? 1 : 0.6}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default GridReliabilityDashboard;
