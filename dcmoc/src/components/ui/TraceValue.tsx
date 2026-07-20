'use client';

/* ─── TraceValue v2 (PHASE EB — owner: "very good, intuitive, easy to
 * understand on click") — Excel-style formula field, redesigned:
 *   • header: big live value + label + provenance chip
 *   • formula rendered as VISUAL PILLS — every operand is a clickable
 *     provenance-colored pill (value + label), operators shown large between
 *   • click a pill → drill into ITS formula (breadcrumb path on top)
 *   • leaves show a source card: who sets it + "Open in tab" button
 *   • enhance (2026-07-20): Copy trace chain, Expand all, leaf-provenance
 *     summary + optional dep filter — additive, structure unchanged
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { createPortal } from 'react-dom';
import { resolveTrace, type ResolvedTrace } from '@/lib/value-trace';
import { useSimulationStore } from '@/store/simulation';

const PROV_STYLE: Record<string, { pill: string; chip: string; label: string }> = {
    input: { pill: 'border-violet-400/60 bg-violet-500/10 hover:bg-violet-500/20', chip: 'bg-violet-500/15 text-violet-500 dark:text-violet-300', label: 'Your input' },
    engine: { pill: 'border-emerald-400/60 bg-emerald-500/10 hover:bg-emerald-500/20', chip: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', label: 'Engine (sourced)' },
    derived: { pill: 'border-cyan-400/60 bg-cyan-500/10 hover:bg-cyan-500/20', chip: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400', label: 'Computed' },
    screening: { pill: 'border-amber-400/60 bg-amber-500/10 hover:bg-amber-500/20', chip: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', label: 'Screening estimate' },
};

/** Short human word per provenance — used in the leaf composition summary. */
const PROV_SUMMARY_WORD: Record<string, { one: string; many: string }> = {
    input: { one: 'input', many: 'inputs' },
    engine: { one: 'engine constant', many: 'engine constants' },
    derived: { one: 'derived value', many: 'derived values' },
    screening: { one: 'screening estimate', many: 'screening estimates' },
};

const fmtNum = (v: number | null): string =>
    v == null ? '—' : Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'M' : v.toLocaleString(undefined, { maximumFractionDigits: 2 });

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

/** Walk the whole resolved tree to its leaves (nodes with no children). */
function collectLeaves(root: ResolvedTrace): ResolvedTrace[] {
    const out: ResolvedTrace[] = [];
    const seen = new Set<string>();
    const walk = (n: ResolvedTrace) => {
        if (n.children.length === 0) { if (!seen.has(n.id)) { seen.add(n.id); out.push(n); } return; }
        n.children.forEach(walk);
    };
    walk(root);
    return out;
}

/** Composition summary of the tree's leaves grouped by provenance,
 *  e.g. "3 inputs · 2 engine constants · 1 screening estimate". */
function leafSummary(root: ResolvedTrace): string {
    const leaves = collectLeaves(root);
    if (leaves.length === 0) return '';
    const counts: Record<string, number> = {};
    for (const l of leaves) counts[l.provenance] = (counts[l.provenance] ?? 0) + 1;
    const order = ['input', 'engine', 'derived', 'screening'];
    return order
        .filter((p) => counts[p])
        .map((p) => { const n = counts[p]; const w = PROV_SUMMARY_WORD[p]; return `${n} ${n === 1 ? w.one : w.many}`; })
        .join(' · ');
}

/** Render the full trace tree as indented plain text (formula + value + source)
 *  for clipboard — an audit artifact that can be pasted into a report. */
function traceToText(root: ResolvedTrace, depth = 0): string {
    const pad = '  '.repeat(depth);
    const prov = PROV_STYLE[root.provenance]?.label ?? root.provenance;
    const unit = root.unit ? ` ${root.unit}` : '';
    const lines: string[] = [];
    lines.push(`${pad}${root.label} = ${fmtNum(root.value)}${unit}  [${prov}]`);
    if (root.formulaLive) lines.push(`${pad}  formula: ${root.formulaLive}`);
    if (root.sourceKey) lines.push(`${pad}  source: DATA.sources.${root.sourceKey}`);
    if (root.external) lines.push(`${pad}  ref: ${root.external.label} (${root.external.href})`);
    for (const c of root.children) lines.push(traceToText(c, depth + 1));
    return lines.join('\n');
}

function Panel({ root }: { root: ResolvedTrace }) {
    const setActiveTab = useSimulationStore((s) => s.actions.setActiveTab);
    const [path, setPath] = React.useState<ResolvedTrace[]>([root]);
    const [expanded, setExpanded] = React.useState(false);
    const [filter, setFilter] = React.useState('');
    const [copied, setCopied] = React.useState(false);
    const node = path[path.length - 1];
    const st = PROV_STYLE[node.provenance];
    const summary = React.useMemo(() => leafSummary(root), [root]);

    const copyChain = async () => {
        const text = `Trace: ${root.label}\n${traceToText(root)}`;
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else if (typeof document !== 'undefined') {
                const ta = document.createElement('textarea');
                ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch { /* clipboard blocked — ignore */ }
    };

    /* Full-chain expand: flat list of every node in DFS order (down to leaves). */
    const flatTree = React.useMemo(() => {
        const out: { node: ResolvedTrace; depth: number }[] = [];
        const walk = (n: ResolvedTrace, d: number) => { out.push({ node: n, depth: d }); n.children.forEach((c) => walk(c, d + 1)); };
        root.children.forEach((c) => walk(c, 0));
        return out;
    }, [root]);

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
                    <div className="mb-1.5 flex items-center gap-2">
                        <div className="text-[10px] font-medium text-slate-500">This number is computed from:</div>
                        <button onClick={() => setExpanded((e) => !e)}
                            aria-label={expanded ? 'Collapse the full dependency tree' : 'Expand the full dependency tree down to the leaves'}
                            aria-expanded={expanded}
                            className="ml-auto rounded-md border border-slate-300 dark:border-slate-600 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                            {expanded ? '▾ Collapse all' : '▸ Expand all'}
                        </button>
                        <button onClick={copyChain}
                            aria-label="Copy the whole trace chain (formula, values, sources) to the clipboard"
                            className="rounded-md border border-slate-300 dark:border-slate-600 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                            {copied ? '✓ Copied' : '⧉ Copy'}
                        </button>
                    </div>
                    {/* visual formula: provenance-colored clickable pills + big operators */}
                    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5">
                        {tokens(node, templateOf(node)).map((t, i) =>
                            t.kind === 'dep' ? (
                                <button key={i} onClick={() => setPath([...path, t.dep])}
                                    className={`rounded-lg border px-2 py-1 text-left transition-colors ${PROV_STYLE[t.dep.provenance].pill}`}
                                    aria-label={`Trace ${t.dep.label}`}
                                    title={`Click to trace ${t.dep.label}`}>
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
                    <p className="mt-1.5 text-[9px] text-slate-400">Click a colored box to see where that number comes from — you can keep going all the way to the furthest endpoint.</p>

                    {/* full-chain expand — flat indented tree down to the leaves */}
                    {expanded && (
                        <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-2">
                            {flatTree.length > 6 && (
                                <input value={filter} onChange={(e) => setFilter(e.target.value)}
                                    aria-label="Filter dependencies by name"
                                    placeholder="Filter dependencies…"
                                    className="mb-1.5 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-[10px] text-slate-700 dark:text-slate-200" />
                            )}
                            <div className="max-h-52 overflow-y-auto">
                                {flatTree
                                    .filter(({ node: n }) => !filter.trim() || n.label.toLowerCase().includes(filter.trim().toLowerCase()) || n.id.toLowerCase().includes(filter.trim().toLowerCase()))
                                    .map(({ node: n, depth }, i) => (
                                        <button key={`${n.id}-${i}`} onClick={() => setPath([root, n])}
                                            className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700/60"
                                            style={{ paddingLeft: `${depth * 12 + 4}px` }}
                                            aria-label={`Trace ${n.label}`}>
                                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PROV_STYLE[n.provenance].chip}`} aria-hidden />
                                            <span className="min-w-0 flex-1 truncate text-[10px] text-slate-600 dark:text-slate-300">{n.label}</span>
                                            <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-800 dark:text-white">{fmtNum(n.value)}{n.unit ? ` ${n.unit}` : ''}</span>
                                        </button>
                                    ))}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                /* LEAF — source card */
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        {node.provenance === 'input' && 'Leaf value: a number you entered (or an editable predefined).'}
                        {node.provenance === 'engine' && <>Sourced engine constant{node.sourceKey ? <> — documented at <code className="text-emerald-500">DATA.sources.{node.sourceKey}</code></> : ''}.</>}
                        {node.provenance === 'screening' && 'Labeled screening estimate — can be overridden.'}
                        {node.provenance === 'derived' && 'Derived value.'}
                    </div>
                </div>
            )}

            {/* leaf-provenance composition summary (only meaningful when there are deps) */}
            {node.children.length > 0 && summary && (
                <div className="mt-2 rounded-lg bg-slate-100/70 dark:bg-slate-800/50 px-2.5 py-1.5 text-[9px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Made up of:</span> {summary}
                </div>
            )}

            <div className="mt-2 flex gap-2">
                <button onClick={() => setActiveTab(node.page as never)}
                    aria-label={`Open or edit in the ${node.page} tab`}
                    className="flex-1 rounded-lg bg-violet-600 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">
                    ↗ Open / edit in tab: {node.page}
                </button>
                {node.external && (
                    <a href={node.external.href} target="_blank" rel="noopener"
                        className="flex-1 rounded-lg border border-emerald-500/50 py-1.5 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                        aria-label={`Open external source: ${node.external.label}`}
                        title={node.external.label}>
                        🌐 External source
                    </a>
                )}
            </div>
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
            <button onClick={openAt} data-bind={traceId} data-trace={traceId}
                className="group relative cursor-pointer border-b border-dotted border-violet-400/60 hover:border-violet-500 text-left"
                title="Click: trace the formula & sources of this number (formula field)">
                {children}
                {/* DJ2 — clear affordance: permanent ƒx badge (owner couldn't find the trace feature) */}
                <span aria-hidden className="absolute -right-4 top-0 rounded bg-violet-500/15 px-0.5 text-[9px] font-bold text-violet-500 group-hover:bg-violet-500/30">ƒx</span>
            </button>
            {anchor && tree && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9998]" onClick={() => setAnchor(null)}>
                    <div className="fixed z-[9999] w-[400px] max-w-[95vw] max-h-[70vh] overflow-y-auto rounded-2xl border border-violet-500/40 bg-white dark:bg-slate-900 p-4 shadow-2xl"
                        style={{ left: anchor.x, top: Math.min(anchor.y, window.innerHeight - 340) }}
                        onClick={(e) => e.stopPropagation()}>
                        <div className="mb-2 flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500">🔍 Trace Number</span>
                            <button onClick={() => setAnchor(null)} className="ml-auto rounded p-0.5 text-slate-400 hover:text-slate-600" aria-label="Close">✕</button>
                        </div>
                        <Panel root={tree} />
                    </div>
                </div>,
                document.body)}
        </>
    );
}
