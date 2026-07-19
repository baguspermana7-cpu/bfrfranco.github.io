'use client';

/* ─── TraceValue (PHASE EB) — Excel-style "formula field" ────────────────────
 * Wraps a displayed number: click → portal popover showing the LIVE formula
 * (numbers substituted), and each source as a row with two actions:
 *   ▸ expand — drill into that source's own trace (recursive, to the leaves)
 *   ↗ open   — jump to the value's home menu (setActiveTab)
 * Leaves show a provenance chip (input / engine / screening).
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { createPortal } from 'react-dom';
import { resolveTrace, type ResolvedTrace } from '@/lib/value-trace';
import { useSimulationStore } from '@/store/simulation';

const PROV_CHIP: Record<string, string> = {
    input: 'bg-violet-500/15 text-violet-500 dark:text-violet-300',
    engine: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    derived: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
    screening: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
};

function TraceRow({ node, depth }: { node: ResolvedTrace; depth: number }) {
    const [open, setOpen] = React.useState(false);
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const leaf = node.children.length === 0;
    return (
        <div style={{ marginLeft: depth * 10 }} className="border-l border-slate-200 dark:border-slate-700/60 pl-2 py-0.5">
            <div className="flex items-center gap-1.5 text-[11px]">
                {!leaf && (
                    <button onClick={() => setOpen(!open)} className="w-4 text-slate-400 hover:text-violet-500" aria-label="expand trace">{open ? '▾' : '▸'}</button>
                )}
                {leaf && <span className="w-4 text-slate-300 dark:text-slate-600">•</span>}
                <span className="font-medium text-slate-700 dark:text-slate-200">{node.label}</span>
                <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                    {node.value == null ? '—' : node.value.toLocaleString()}{node.unit ? ` ${node.unit}` : ''}
                </span>
                <span className={`rounded px-1 py-0.5 text-[8px] font-semibold uppercase ${PROV_CHIP[node.provenance]}`}>{node.provenance}</span>
                {node.sourceKey && <span className="text-[9px] text-slate-400" title={`DATA.sources.${node.sourceKey}`}>ⓘ sourced</span>}
                <button onClick={() => setActiveTab(node.page as never)} className="ml-auto text-[9px] text-violet-500 hover:text-violet-400" title={`Buka di menu ${node.page}`}>↗ {node.page}</button>
            </div>
            {node.formulaLive && (
                <div className="ml-4 font-mono text-[10px] text-slate-500 dark:text-slate-400">{node.formulaLive}</div>
            )}
            {open && node.children.map((c) => <TraceRow key={c.id} node={c} depth={depth + 1} />)}
        </div>
    );
}

export function TraceValue({ traceId, children }: { traceId: string; children: React.ReactNode }) {
    const [anchor, setAnchor] = React.useState<{ x: number; y: number } | null>(null);
    const [tree, setTree] = React.useState<ResolvedTrace | null>(null);

    const openAt = (e: React.MouseEvent) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setTree(resolveTrace(traceId));
        setAnchor({ x: Math.min(r.left, window.innerWidth - 380), y: r.bottom + 6 });
    };

    return (
        <>
            <button onClick={openAt} data-bind={traceId}
                className="cursor-pointer border-b border-dotted border-violet-400/60 hover:border-violet-500 text-left"
                title="Klik untuk trace rumus & sumber (formula field)">
                {children}
            </button>
            {anchor && tree && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9998]" onClick={() => setAnchor(null)}>
                    <div className="fixed z-[9999] w-[370px] max-h-[60vh] overflow-y-auto rounded-xl border border-violet-500/40 bg-white dark:bg-slate-900 p-3 shadow-2xl"
                        style={{ left: anchor.x, top: Math.min(anchor.y, window.innerHeight - 300) }}
                        onClick={(e) => e.stopPropagation()}>
                        <div className="mb-1 flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500">Formula Field</span>
                            <button onClick={() => setAnchor(null)} className="ml-auto text-slate-400 hover:text-slate-600" aria-label="close">✕</button>
                        </div>
                        <TraceRow node={tree} depth={0} />
                        <p className="mt-2 text-[9px] text-slate-400">▸ expand = trace ke sumbernya (rekursif sampai titik ujung) · ↗ = buka di menu asal · chip = jenis sumber</p>
                    </div>
                </div>,
                document.body)}
        </>
    );
}
