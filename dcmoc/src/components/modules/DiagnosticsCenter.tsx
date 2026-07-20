'use client';

/* ─── Diagnostics Center — one surface for every ACTIVE red/amber indicator ───
 * Aggregates the 12 wired collectors (see lib/diagnostics.ts) into a single,
 * severity-sorted board. Each finding is a card that deep-links to the owning
 * tab via setActiveTab(linkTab). Honest empty-state when nothing is red.
 * Subscribes to the stores the collectors read so the memo re-runs on any
 * material input change.
 * ──────────────────────────────────────────────────────────────────────── */

import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '@/store/simulation';
import { useCapexStore } from '@/store/capex';
import { useRequirementsStore } from '@/store/requirements';
import { useSitesStore } from '@/store/sites';
import {
    collectAllDiagnostics,
    DIAG_COVERAGE,
    type DiagFinding,
} from '@/lib/diagnostics';
import {
    Stethoscope, AlertTriangle, AlertOctagon, Info, ArrowRight, CheckCircle2, ShieldCheck,
} from 'lucide-react';
import clsx from 'clsx';

/* Severity → chip styling (rose / amber / slate — consistent with dashboards). */
const SEV_STYLE: Record<DiagFinding['severity'], { chip: string; card: string; icon: React.ReactNode; label: string }> = {
    critical: {
        chip: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
        card: 'border-rose-500/30 bg-rose-500/[0.04]',
        icon: <AlertOctagon className="w-4 h-4 text-rose-500" />,
        label: 'Critical',
    },
    warning: {
        chip: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
        card: 'border-amber-500/30 bg-amber-500/[0.04]',
        icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
        label: 'Warning',
    },
    info: {
        chip: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
        card: 'border-slate-300 dark:border-slate-700 bg-slate-500/[0.03]',
        icon: <Info className="w-4 h-4 text-slate-400" />,
        label: 'Info',
    },
};

const SEV_ORDER: DiagFinding['severity'][] = ['critical', 'warning', 'info'];

function fmtNum(n: number): string {
    if (!Number.isFinite(n)) return String(n);
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    if (abs !== Math.round(abs)) return n.toFixed(2);
    return String(n);
}

export function DiagnosticsCenter() {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);

    // Subscribe to the material inputs the collectors read → memo re-runs on change.
    const inputs = useSimulationStore((s) => s.inputs);
    const country = useSimulationStore((s) => s.selectedCountry);
    const capexResults = useCapexStore((s) => s.results);
    const workload = useRequirementsStore((s) => s.workload);
    const sites = useSitesStore((s) => s.sites);
    const selectedSiteId = useSitesStore((s) => s.selectedSiteId);

    const findings = useMemo(
        () => collectAllDiagnostics(),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [inputs, country, capexResults, workload, sites, selectedSiteId],
    );

    // Surface filter (optional chip row).
    const [surfaceFilter, setSurfaceFilter] = useState<string | null>(null);
    const surfaces = useMemo(
        () => Array.from(new Set(findings.map((f) => f.surface))).sort(),
        [findings],
    );

    const visible = surfaceFilter ? findings.filter((f) => f.surface === surfaceFilter) : findings;

    const counts = useMemo(() => {
        const c = { critical: 0, warning: 0, info: 0 };
        for (const f of findings) c[f.severity]++;
        return c;
    }, [findings]);

    const grouped = useMemo(() => {
        const g: Record<DiagFinding['severity'], DiagFinding[]> = { critical: [], warning: [], info: [] };
        for (const f of visible) g[f.severity].push(f);
        return g;
    }, [visible]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Stethoscope className="w-6 h-6 text-cyan-500" />
                        Diagnostics Center
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Every active red/amber indicator across all engines, in one place. Numbers are identical
                        to the source page — click <b>Open</b> to fix it in place.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={clsx('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold', SEV_STYLE.critical.chip)}>
                        <AlertOctagon className="w-3.5 h-3.5" /> {counts.critical} critical
                    </span>
                    <span className={clsx('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold', SEV_STYLE.warning.chip)}>
                        <AlertTriangle className="w-3.5 h-3.5" /> {counts.warning} warning
                    </span>
                    {counts.info > 0 && (
                        <span className={clsx('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold', SEV_STYLE.info.chip)}>
                            <Info className="w-3.5 h-3.5" /> {counts.info} info
                        </span>
                    )}
                </div>
            </div>

            {/* Coverage note (honest partial) */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-100/60 dark:bg-slate-800/40 px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>
                    Coverage: <b className="text-slate-700 dark:text-slate-200">{DIAG_COVERAGE.wired}/{DIAG_COVERAGE.total}</b> engines wired.
                </span>
                {DIAG_COVERAGE.skipped.map((s) => (
                    <span key={s.surface} className="rounded bg-slate-200 dark:bg-slate-700/60 px-1.5 py-0.5" title={s.skipReason}>
                        {s.surface} · skipped (honest)
                    </span>
                ))}
            </div>

            {/* Surface filter chips */}
            {surfaces.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                    <button
                        onClick={() => setSurfaceFilter(null)}
                        className={clsx(
                            'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
                            surfaceFilter === null
                                ? 'border-cyan-500 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                                : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:border-cyan-400',
                        )}
                    >
                        All ({findings.length})
                    </button>
                    {surfaces.map((s) => (
                        <button
                            key={s}
                            onClick={() => setSurfaceFilter((prev) => (prev === s ? null : s))}
                            className={clsx(
                                'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
                                surfaceFilter === s
                                    ? 'border-cyan-500 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                                    : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:border-cyan-400',
                            )}
                        >
                            {s} ({findings.filter((f) => f.surface === s).length})
                        </button>
                    ))}
                </div>
            )}

            {/* Empty state — honest */}
            {findings.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] py-16 text-center">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                    <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                        No active red indicators — everything within limits ✓
                    </p>
                    <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
                        All wired collectors ({DIAG_COVERAGE.wired}/{DIAG_COVERAGE.total}) report values within their thresholds.
                        Change the country / IT load / tier / cooling parameters to surface diagnostics.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {SEV_ORDER.map((sev) => {
                        const group = grouped[sev];
                        if (group.length === 0) return null;
                        const st = SEV_STYLE[sev];
                        return (
                            <section key={sev} className="space-y-2">
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    {st.icon}
                                    {st.label}
                                    <span className={clsx('rounded-full border px-2 py-0.5 text-[10px]', st.chip)}>{group.length}</span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {group.map((f, i) => (
                                        <div
                                            key={`${f.linkTab}-${f.metric ?? f.title}-${i}`}
                                            className={clsx('rounded-xl border p-4 flex flex-col gap-2', st.card)}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <span className={clsx('rounded-md border px-2 py-0.5 text-[10px] font-semibold shrink-0', st.chip)}>
                                                    {f.surface}
                                                </span>
                                                {f.metric && (
                                                    <span className="text-[10px] font-mono uppercase tracking-wide text-slate-400 shrink-0">
                                                        {f.metric}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                                                {f.title}
                                            </p>
                                            {f.detail && (
                                                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                                                    {f.detail}
                                                </p>
                                            )}
                                            <div className="flex items-center justify-between gap-2 mt-1">
                                                {(f.value !== undefined || f.threshold !== undefined) ? (
                                                    <div className="flex items-center gap-3 text-[11px]">
                                                        {f.value !== undefined && (
                                                            <span className="text-slate-600 dark:text-slate-300">
                                                                <span className="text-slate-400">value </span>
                                                                <b className="tabular-nums">{fmtNum(f.value)}</b>
                                                            </span>
                                                        )}
                                                        {f.threshold !== undefined && (
                                                            <span className="text-slate-500">
                                                                <span className="text-slate-400">threshold </span>
                                                                <b className="tabular-nums">{fmtNum(f.threshold)}</b>
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : <span />}
                                                <button
                                                    onClick={() => setActiveTab(f.linkTab as never)}
                                                    className="flex items-center gap-1 rounded-lg bg-slate-800 dark:bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-cyan-700 dark:hover:bg-cyan-700 transition-colors shrink-0"
                                                >
                                                    Open
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default DiagnosticsCenter;
