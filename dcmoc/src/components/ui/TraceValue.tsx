'use client';

/* ─── TraceValue v2 (PHASE EB — owner: "sangat bagus, intuitive, mudah
 * dimengerti saat klik") — Excel-style formula field, redesigned:
 *   • header: big live value + label + provenance chip
 *   • formula rendered as VISUAL PILLS — every operand is a clickable
 *     provenance-colored pill (value + label), operators shown large between
 *   • click a pill → drill into ITS formula (breadcrumb path on top)
 *   • leaves show a source card: who sets it + "Edit di <menu>" button
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { createPortal } from 'react-dom';
import { resolveTrace, type ResolvedTrace } from '@/lib/value-trace';
import { useSimulationStore } from '@/store/simulation';

const PROV_STYLE: Record<string, { pill: string; chip: string; label: string }> = {
    input: { pill: 'border-violet-400/60 bg-violet-500/10 hover:bg-violet-500/20', chip: 'bg-violet-500/15 text-violet-500 dark:text-violet-300', label: 'Input kamu' },
    engine: { pill: 'border-emerald-400/60 bg-emerald-500/10 hover:bg-emerald-500/20', chip: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', label: 'Engine (bersumber)' },
    derived: { pill: 'border-cyan-400/60 bg-cyan-500/10 hover:bg-cyan-500/20', chip: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400', label: 'Dihitung' },
    screening: { pill: 'border-amber-400/60 bg-amber-500/10 hover:bg-amber-500/20', chip: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', label: 'Estimasi screening' },
};

const fmtNum = (v: number | null): string =>
    v == null ? '—' : Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' jt' : v.toLocaleString(undefined, { maximumFractionDigits: 2 });

/** Split the formulaTemplate into tokens: dep ids ↔ operators/literals. */
function tokens(node: ResolvedTrace, raw: string | undefined): Array<{ kind: 'dep'; dep: ResolvedTrace } | { kind: 'op'; text: string }> {
    if (!raw) return [];
    // template uses dep IDs; children carry those ids
    let parts: Array<{ kind: 'dep'; dep: ResolvedTrace } | { kind: 'op'; text: string }> = [{ kind: 'op', text: raw }];
    for (const c of node.children) {
        const next: typeof parts = [];
        for (const p of parts) {
            if (p.kind === 'dep') { next.push(p); continue; }
            const segs = p.text.split(c.id);
            segs.forEach((seg, i) => {
                if (seg.trim()) next.push({ kind: 'op', text: seg.trim() });
                if (i < segs.length - 1) next.push({ kind: 'dep', dep: c });
            });
        }
        parts = next;
    }
    return parts;
}

function Panel({ root }: { root: ResolvedTrace }) {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const [path, setPath] = React.useState<ResolvedTrace[]>([root]);
    const node = path[path.length - 1];
    const st = PROV_STYLE[node.provenance];

    return (
        <div>
            {/* breadcrumb */}
            {path.length > 1 && (
                <div className="mb-2 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                    {path.map((p, i) => (
                        <React.Fragment key={p.id}>
                            {i > 0 && <span>▸</span>}
                            <button onClick={() => setPath(path.slice(0, i + 1))}
                                className={i === path.length - 1 ? 'font-semibold text-violet-500' : 'hover:text-violet-400'}>
                                {p.label}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* header: big value */}
            <div className="mb-3 flex items-start gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">{node.label}</div>
                    <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                        {fmtNum(node.value)}{node.unit ? <span className="ml-1 text-sm font-medium text-slate-400">{node.unit}</span> : null}
                    </div>
                </div>
                <span className={`ml-auto mt-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${st.chip}`}>{st.label}</span>
            </div>

            {node.children.length > 0 ? (
                <>
                    <div className="mb-1.5 text-[10px] font-medium text-slate-500">Angka ini dihitung dari:</div>
                    {/* visual formula: provenance-colored clickable pills + big operators */}
                    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5">
                        {tokens(node, templateOf(node)).map((t, i) =>
                            t.kind === 'dep' ? (
                                <button key={i} onClick={() => setPath([...path, t.dep])}
                                    className={`rounded-lg border px-2 py-1 text-left transition-colors ${PROV_STYLE[t.dep.provenance].pill}`}
                                    title={`Klik untuk trace ${t.dep.label}`}>
                                    <div className="text-[9px] leading-tight text-slate-500 dark:text-slate-400">{t.dep.label}</div>
                                    <div className="text-xs font-bold tabular-nums text-slate-800 dark:text-white">{fmtNum(t.dep.value)}{t.dep.unit ? ` ${t.dep.unit}` : ''}</div>
                                </button>
                            ) : (
                                <span key={i} className="text-base font-semibold text-slate-400">{t.text}</span>
                            )
                        )}
                        <span className="text-base font-semibold text-slate-400">=</span>
                        <span className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-bold text-white dark:bg-white dark:text-slate-900">{fmtNum(node.value)}</span>
                    </div>
                    <p className="mt-1.5 text-[9px] text-slate-400">Klik kotak berwarna untuk melihat asal angka itu — bisa terus sampai titik paling ujung.</p>
                </>
            ) : (
                /* LEAF — source card */
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        {node.provenance === 'input' && 'Ini titik ujung: angka yang KAMU isi (atau predefined yang bisa diubah).'}
                        {node.provenance === 'engine' && <>Ini konstanta engine bersumber{node.sourceKey ? <> — dokumentasi di <code className="text-emerald-500">DATA.sources.{node.sourceKey}</code></> : ''}.</>}
                        {node.provenance === 'screening' && 'Estimasi screening berlabel — bisa di-override.'}
                        {node.provenance === 'derived' && 'Nilai turunan.'}
                    </div>
                </div>
            )}

            <button onClick={() => setActiveTab(node.page as never)}
                className="mt-2 w-full rounded-lg bg-violet-600 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">
                ↗ Buka / edit di menu: {node.page}
            </button>
        </div>
    );
}

/* template lookup — resolveTrace strips it, so rebuild from the registry */
import { TRACE } from '@/lib/value-trace';
function templateOf(node: ResolvedTrace): string {
    return TRACE[node.id]?.formulaTemplate ?? node.children.map((c) => c.id).join(' · ');
}

export function TraceValue({ traceId, children }: { traceId: string; children: React.ReactNode }) {
    const [anchor, setAnchor] = React.useState<{ x: number; y: number } | null>(null);
    const [tree, setTree] = React.useState<ResolvedTrace | null>(null);

    const openAt = (e: React.MouseEvent) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setTree(resolveTrace(traceId));
        setAnchor({ x: Math.min(r.left, window.innerWidth - 420), y: r.bottom + 6 });
    };

    return (
        <>
            <button onClick={openAt} data-bind={traceId}
                className="cursor-pointer border-b border-dotted border-violet-400/60 hover:border-violet-500 text-left"
                title="Klik: lihat rumus & sumber angka ini (formula field)">
                {children}
            </button>
            {anchor && tree && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9998]" onClick={() => setAnchor(null)}>
                    <div className="fixed z-[9999] w-[400px] max-w-[95vw] max-h-[70vh] overflow-y-auto rounded-2xl border border-violet-500/40 bg-white dark:bg-slate-900 p-4 shadow-2xl"
                        style={{ left: anchor.x, top: Math.min(anchor.y, window.innerHeight - 340) }}
                        onClick={(e) => e.stopPropagation()}>
                        <div className="mb-2 flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500">🔍 Trace Angka</span>
                            <button onClick={() => setAnchor(null)} className="ml-auto rounded p-0.5 text-slate-400 hover:text-slate-600" aria-label="close">✕</button>
                        </div>
                        <Panel root={tree} />
                    </div>
                </div>,
                document.body)}
        </>
    );
}
