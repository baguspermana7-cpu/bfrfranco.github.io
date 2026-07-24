'use client';

/* ─── RedValue + DiagnosticModal (Workstream C) ──────────────────────────────
 * OWNER MANDATE: "semua yang nilainya merah itu ada semacam diagnostic modal
 * klw di klik — tidak hanya ini tapi semua."  Any red (breached) value renders
 * through <RedValue> → click opens a portal diagnostic modal:
 *   • WHY it is red — threshold vs actual + the computed gap
 *   • the DRIVERS/LEVERS — what moves it, each with a jump-to-tab action
 *   • MANUAL path — open the owning tab / trace the number (ƒx chain)
 *   • (Workstream D adds an Auto-optimize action via the onOptimize slot)
 * One shared component — never re-implement per page. Technology–economics
 * stance: levers state cost-vs-benefit, not "upgrade everything".
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, Wrench, Activity, BookOpen, ExternalLink } from 'lucide-react';
import { useSimulationStore } from '@/store/simulation';

export interface DiagnosisLever {
    label: string;                 // e.g. "Raise revenue to $166/kW·mo"
    detail?: string;               // quantified effect: "+1.2pp IRR — clears the 12% hurdle"
    tab?: string;                  // DCMOC tab id to jump to (manual revise path)
}

export interface DiagnosisReference {
    title: string;                 // article title as published on resistancezero.com
    href: string;                  // absolute URL, e.g. https://resistancezero.com/article-25.html
}

export interface Diagnosis {
    title: string;                 // metric name, e.g. "Blended IRR"
    reason: string;                // WHY it is red — verbatim computed reason
    threshold?: string;            // e.g. "hurdle 12%"
    actual?: string;               // e.g. "10.8%"
    gap?: string;                  // e.g. "−1.2 pp below hurdle"
    levers?: DiagnosisLever[];     // quantified levers (manual path)
    tab?: string;                  // owning tab (Open in tab)
    note?: string;                 // basis/assumption footnote
    /** Workstream N — related resistancezero.com articles (external reading list) */
    references?: DiagnosisReference[];
}

export function RedValue({ value, diagnosis, className = '', onOptimize, children }: {
    /** display value (string) — rendered red + clickable */
    value?: string;
    diagnosis: Diagnosis;
    className?: string;
    /** Workstream D hook — when provided, the modal shows an Auto-optimize action */
    onOptimize?: () => void;
    /** custom rendering; falls back to `value` text */
    children?: React.ReactNode;
}) {
    const [open, setOpen] = React.useState(false);
    /* role=button span (NOT <button>) — RedValue often nests inside TraceValue,
     * which already wraps children in a real button; nested buttons are invalid. */
    return (
        <>
            <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setOpen(true); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setOpen(true); } }}
                title={`${diagnosis.title} breached — click for the diagnosis`}
                className={`inline-block text-rz-alert cursor-pointer underline decoration-dotted underline-offset-4 hover:decoration-solid text-left ${className}`}
            >
                {children ?? value}
            </span>
            {open && <DiagnosticModal diagnosis={diagnosis} onClose={() => setOpen(false)} onOptimize={onOptimize} />}
        </>
    );
}

export function DiagnosticModal({ diagnosis: d, onClose, onOptimize }: {
    diagnosis: Diagnosis; onClose: () => void; onOptimize?: () => void;
}) {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    React.useEffect(() => {
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onClose]);
    if (typeof document === 'undefined') return null;

    const jump = (tab?: string) => { if (tab) { setActiveTab(tab as never); onClose(); } };

    return createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${d.title} diagnosis`}>
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="relative w-full max-w-lg rounded-xl border border-rz-alert/40 bg-white dark:bg-rz-elevated shadow-2xl">
                {/* header */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-rz-2 px-4 py-3">
                    <div>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-rz-alert">
                            <Activity className="h-3.5 w-3.5" /> Diagnostic — threshold breached
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{d.title}</div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto px-4 py-3 space-y-3 text-xs">
                    {/* threshold vs actual */}
                    {(d.actual || d.threshold) && (
                        <div className="flex flex-wrap gap-2">
                            {d.actual && <span className="rounded bg-rz-alert/10 px-2 py-1 font-mono font-bold text-rz-alert">actual {d.actual}</span>}
                            {d.threshold && <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-1 font-mono text-slate-600 dark:text-slate-300">target {d.threshold}</span>}
                            {d.gap && <span className="rounded bg-rz-signal/10 px-2 py-1 font-mono text-amber-600 dark:text-rz-signal">gap {d.gap}</span>}
                        </div>
                    )}
                    {/* why */}
                    <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Why it is red</div>
                        <p className="leading-relaxed text-slate-700 dark:text-slate-300">{d.reason}</p>
                    </div>
                    {/* levers */}
                    {d.levers && d.levers.length > 0 && (
                        <div>
                            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Levers — quantified, cost-vs-benefit</div>
                            <ul className="space-y-1.5">
                                {d.levers.map((lv, i) => (
                                    <li key={i} className="flex items-start justify-between gap-2 rounded border border-slate-200 dark:border-rz-2 bg-slate-50 dark:bg-slate-900/40 px-2.5 py-1.5">
                                        <div>
                                            <div className="font-semibold text-slate-800 dark:text-slate-200">{lv.label}</div>
                                            {lv.detail && <div className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{lv.detail}</div>}
                                        </div>
                                        {lv.tab && (
                                            <button onClick={() => jump(lv.tab)} title="Open the tab that owns this lever"
                                                className="shrink-0 inline-flex items-center gap-1 rounded bg-rz-info/10 px-2 py-1 text-[10px] font-semibold text-cyan-700 dark:text-rz-info hover:bg-rz-info/20">
                                                Revise <ArrowRight className="h-3 w-3" />
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {/* related reading — external resistancezero.com articles (Workstream N) */}
                    {d.references && d.references.length > 0 && (
                        <div>
                            <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                <BookOpen className="h-3 w-3" /> Related reading — resistancezero.com
                            </div>
                            <ul className="space-y-1">
                                {d.references.map((ref) => (
                                    <li key={ref.href}>
                                        <a
                                            href={ref.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group inline-flex items-start gap-1.5 text-[11px] font-medium leading-snug text-cyan-700 dark:text-rz-info hover:underline"
                                        >
                                            <span>{ref.title}</span>
                                            <ExternalLink className="mt-0.5 h-2.5 w-2.5 shrink-0 opacity-50 group-hover:opacity-100" />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {d.note && <p className="text-[10px] leading-snug text-slate-400">{d.note}</p>}
                </div>
                {/* actions */}
                <div className="flex items-center justify-between gap-2 border-t border-slate-200 dark:border-rz-2 px-4 py-2.5">
                    <div className="text-[10px] text-slate-400">Manual: revise a lever · Trace the ƒx number for full lineage</div>
                    <div className="flex items-center gap-2">
                        {d.tab && (
                            <button onClick={() => jump(d.tab)} className="rounded border border-slate-300 dark:border-rz-2 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                                Open in tab
                            </button>
                        )}
                        {onOptimize && (
                            <button onClick={() => { onOptimize(); onClose(); }} className="inline-flex items-center gap-1 rounded bg-rz-signal px-2.5 py-1 text-[11px] font-bold text-rz-base hover:brightness-110">
                                <Wrench className="h-3 w-3" /> Auto-optimize
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default RedValue;
