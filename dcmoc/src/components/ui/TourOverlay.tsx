'use client';

/* ─── GUIDED TOUR OVERLAY (Ship-3c) ──────────────────────────────────────────
 * React port of the spares-readiness-calculator tour technique
 * (spares-readiness-calculator.html §7 "Onboarding tour", READ-ONLY ref):
 *   · full-viewport overlay (z-8000) that dismisses on click / Escape
 *   · spotlight = box-shadow `0 0 0 9999px rgba(0,0,0,.55)` mask around the
 *     target rect (pointer-events:none so the overlay still catches clicks)
 *   · amber tooltip clamped into the viewport
 * Hard lessons re-applied from tools/fix-spares-tour.py (READ-ONLY ref):
 *   1. scrollIntoView the target BEFORE measuring its rect
 *   2. clamp the tooltip with its REAL rendered height (measure post-render)
 *   3. overlay click + Escape must dismiss; spotlight is click-transparent
 * Step machine follows the ConfigWizard pattern (READ-ONLY ref) — a linear
 * index over a declarative STEPS list. Targets that are absent / hidden on
 * the active page degrade to a centered tooltip WITHOUT a spotlight.
 * Rendered client-only (Shell mounts it conditionally after an effect), so
 * static export never sees it. createPortal → document.body.
 * ──────────────────────────────────────────────────────────────────────── */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { explain } from '@/lib/explain';

interface TourStep {
    title: string;
    /** 2-3 kalimat Bahasa Indonesia (istilah teknis tetap EN). */
    body: string;
    /** CSS selector candidates, tried in order — first VISIBLE match wins. */
    selectors?: string[];
    /** Custom finder (wins over selectors) for targets without stable hooks. */
    find?: () => HTMLElement | null;
    /** Optional RZExplain DB key — when the DB has it, its definition is
     *  appended under the curated body text. */
    explainKey?: string;
}

/* Chip "rec:" / "≡ rec" (Requirements) punya class utility saja — cari via
 * konten teks. Dipanggil hanya saat step aktif, bukan per-render. */
function findRecChip(): HTMLElement | null {
    const main = document.querySelector('main');
    if (!main) return null;
    const nodes = main.querySelectorAll<HTMLElement>('button, span');
    for (const n of Array.from(nodes)) {
        const t = (n.textContent ?? '').trim();
        if (t.startsWith('rec:') || t.startsWith('≡ rec')) return n;
    }
    return null;
}

const STEPS: TourStep[] = [
    {
        title: 'Project Context',
        body: 'This bar shows the project you are working on: name, country, IT load (MW), Tier, and cooling type. Every engine reads the same context, so the numbers stay consistent across all pages.',
        selectors: ['[data-tour="context-bar"]', 'header .breadcrumbs'],
    },
    {
        title: '13 Lifecycle Engines',
        body: 'The sidebar groups every module into 13 lifecycle engines — from Requirements to Financial. Click a group to open the modules inside it; the number badge shows its lifecycle order.',
        selectors: ['aside[aria-label="Sidebar navigation"]'],
    },
    {
        title: 'ƒx numbers — traceable',
        body: 'Numbers marked ƒx connect directly to the engine. Click one to see the formula, its input parameters, and drill down to the source data — not a hardcoded number.',
        selectors: ['main [data-trace]'],
    },
    {
        title: 'Verdict & "why" panels',
        body: 'Many KPIs come with a verdict chip and a "why this number" explanation panel. Change a design lever/input (Tier, cooling, redundancy) and watch how the verdict and its derived numbers move.',
        selectors: ['main [data-tour="verdict"]', 'main [data-verdict]'],
    },
    {
        title: 'Recommendation chip (rec:)',
        body: 'On the Requirements page, the amber "rec:" chip shows a recommended value computed from your current parameters. Click the chip to apply it — recommendations are never applied automatically.',
        find: findRecChip,
    },
    {
        title: 'Data Library',
        body: 'All reference data — benchmarks, cost assumptions, and their sources — is documented in the Data Library, complete with provenance (source + asOf) per value.',
        selectors: ['button[title="Data Library"]'],
        explainKey: 'tab-data-library',
    },
    {
        title: 'Knowledge Base',
        body: 'The Knowledge Base renders the engine catalog live: models, functions, parameters, and their data sources — always in sync with the running engine version.',
        selectors: ['button[title="Knowledge Base"]'],
        explainKey: 'tab-knowledge',
    },
    {
        title: 'Export PDF',
        body: 'Almost every page offers an Export PDF button to produce an executive-assessment report from the engine results — ready to share with stakeholders without copying numbers by hand.',
        selectors: ['button[aria-label*="PDF"]', 'button[aria-label*="Export"]'],
    },
];

const SPOTLIGHT_PAD = 6;
const VIEWPORT_PAD = 10;
const TOOLTIP_GAP = 12;

/** First candidate that exists AND is actually visible on screen (off-canvas
 *  mobile drawer / display:none targets fall through → centered fallback). */
function resolveTarget(step: TourStep): HTMLElement | null {
    const candidates: (HTMLElement | null)[] = step.find
        ? [step.find()]
        : (step.selectors ?? []).map((sel) => document.querySelector<HTMLElement>(sel));
    for (const el of candidates) {
        if (!el) continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        if (r.right <= 0 || r.left >= window.innerWidth) continue; // slid-out drawer
        return el;
    }
    return null;
}

export function TourOverlay({ onClose }: { onClose: () => void }) {
    const [stepIdx, setStepIdx] = useState(0);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const targetElRef = useRef<HTMLElement | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef(0);

    const step = STEPS[stepIdx];
    const isLast = stepIdx === STEPS.length - 1;

    /* Resolve + scroll + measure — lesson #1: scrollIntoView BEFORE the rect
     * read, then measure on the next frame so layout has settled. */
    const measure = useCallback(() => {
        const el = resolveTarget(STEPS[stepIdx]);
        targetElRef.current = el;
        if (!el) { setRect(null); return; }
        try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch { el.scrollIntoView(); }
        requestAnimationFrame(() => setRect(el.getBoundingClientRect()));
    }, [stepIdx]);

    useEffect(() => { measure(); }, [measure]);

    /* Keep the spotlight glued to the target through user scroll / resize
     * (rAF-throttled; re-reads the rect only, no re-scroll). */
    useEffect(() => {
        const sync = () => {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                const el = targetElRef.current;
                if (el) setRect(el.getBoundingClientRect());
            });
        };
        window.addEventListener('resize', sync);
        window.addEventListener('scroll', sync, { capture: true, passive: true });
        return () => {
            cancelAnimationFrame(rafRef.current);
            window.removeEventListener('resize', sync);
            window.removeEventListener('scroll', sync, { capture: true });
        };
    }, []);

    /* Escape closes (lesson #3). */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    /* Position the tooltip with its REAL rendered size (lesson #2), then clamp
     * into the viewport. Imperative style write avoids a setState loop. */
    useLayoutEffect(() => {
        const tt = tooltipRef.current;
        if (!tt) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const ttr = tt.getBoundingClientRect();
        let top: number;
        let left: number;
        if (rect) {
            top = rect.bottom + TOOLTIP_GAP;
            if (top + ttr.height > vh - VIEWPORT_PAD) top = rect.top - ttr.height - TOOLTIP_GAP;
            /* Wide targets (e.g. the full-width context bar) span the top-left
             * page title / first KPI — right-align the card so it never sits
             * over those primary controls (U2b). */
            left = rect.width > vw * 0.6 ? vw - ttr.width - VIEWPORT_PAD : rect.left;
        } else {
            top = (vh - ttr.height) / 2;
            left = (vw - ttr.width) / 2;
        }
        top = Math.min(Math.max(VIEWPORT_PAD, top), Math.max(VIEWPORT_PAD, vh - ttr.height - VIEWPORT_PAD));
        left = Math.min(Math.max(VIEWPORT_PAD, left), Math.max(VIEWPORT_PAD, vw - ttr.width - VIEWPORT_PAD));
        tt.style.top = `${top}px`;
        tt.style.left = `${left}px`;
    }, [rect, stepIdx]);

    /* A11y: move focus to the tooltip on every step change. */
    useEffect(() => { tooltipRef.current?.focus(); }, [stepIdx]);

    if (typeof document === 'undefined') return null;

    /* RZExplain DB reuse: when the key resolves, append its definition. */
    const dbEntry = step.explainKey ? explain(step.explainKey) : null;

    return createPortal(
        /* Backdrop is click-transparent (pointer-events-none): the dim scrim /
         * spotlight is purely visual, so it never intercepts ƒx-trace clicks or
         * covers-and-blocks primary controls. Only the tour card below opts back
         * into pointer events. Dismiss via Skip / Next / Escape (U2a). */
        <div
            className="pointer-events-none fixed inset-0 z-[8000] overflow-hidden"
            data-tour-overlay=""
        >
            {rect ? (
                /* Spotlight: mask everything EXCEPT the target via the 9999px
                 * box-shadow trick; click-transparent (lesson #3). */
                <div
                    className="pointer-events-none absolute rounded-xl transition-all duration-300 ease-out"
                    style={{
                        top: rect.top - SPOTLIGHT_PAD,
                        left: rect.left - SPOTLIGHT_PAD,
                        width: rect.width + SPOTLIGHT_PAD * 2,
                        height: rect.height + SPOTLIGHT_PAD * 2,
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                    }}
                    aria-hidden="true"
                />
            ) : (
                /* Fallback (target absent on this page): plain dim scrim. */
                <div className="pointer-events-none absolute inset-0 bg-black/55" aria-hidden="true" />
            )}

            <div
                ref={tooltipRef}
                role="dialog"
                aria-modal="true"
                aria-label={`DCMOC tour — step ${stepIdx + 1} of ${STEPS.length}: ${step.title}`}
                tabIndex={-1}
                className="pointer-events-auto fixed z-[8001] w-[min(320px,calc(100vw-20px))] cursor-default rounded-xl border border-amber-500/25 bg-slate-800 p-4 shadow-2xl outline-none"
                style={{ top: 0, left: 0 }}
            >
                <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-400">{step.title}</div>
                <div className="text-xs leading-relaxed text-slate-300">{step.body}</div>
                {dbEntry && (
                    <div className="mt-2 border-t border-slate-700 pt-2 text-[11px] leading-relaxed text-slate-400">{dbEntry.d}</div>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] tabular-nums text-slate-500">{stepIdx + 1}/{STEPS.length}</span>
                    <div className="flex items-center gap-1.5">
                        {!isLast && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-2 py-1 text-[11px] text-slate-500 transition-colors hover:text-slate-300"
                            >
                                Skip
                            </button>
                        )}
                        {stepIdx > 0 && (
                            <button
                                type="button"
                                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                                className="rounded-md border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-slate-700"
                            >
                                Back
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => { if (isLast) onClose(); else setStepIdx((i) => i + 1); }}
                            className="rounded-md bg-amber-500 px-3.5 py-1 text-[11px] font-bold text-slate-900 transition-colors hover:bg-amber-400"
                        >
                            {isLast ? 'Finish' : 'Next'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
