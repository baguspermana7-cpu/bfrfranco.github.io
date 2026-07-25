'use client';
import { useState, useMemo, useCallback } from 'react';

/* ─── useCollapsibleTree — reusable per-node expand/collapse state ───────────
 * Owner mandate: collapse/expand features must NOT be hardcoded per-use. This
 * hook tracks which nodes are expanded (a Set of ids) and provides working
 * toggle / expandAll / collapseAll — so "Expand all" / "Collapse all" actually
 * act on every node, and each node can also be toggled individually. Used by the
 * Trace popover (CollapsibleTree) and reusable by any tree UI (BOM, decision map). */
export interface TreeNodeLike { id: string; children?: readonly TreeNodeLike[] }

export interface CollapsibleTreeApi {
    isExpanded: (id: string) => boolean;
    toggle: (id: string) => void;
    expandAll: () => void;
    collapseAll: () => void;
    allExpanded: boolean;
}

export function useCollapsibleTree(roots: readonly TreeNodeLike[], defaultExpanded = false): CollapsibleTreeApi {
    const allIds = useMemo(() => {
        const out: string[] = [];
        const walk = (ns: readonly TreeNodeLike[]) => ns.forEach((n) => { out.push(n.id); if (n.children) walk(n.children); });
        walk(roots);
        return out;
    }, [roots]);

    const [expanded, setExpanded] = useState<Set<string>>(() => (defaultExpanded ? new Set(allIds) : new Set()));

    const isExpanded = useCallback((id: string) => expanded.has(id), [expanded]);
    const toggle = useCallback((id: string) => setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    }), []);
    const expandAll = useCallback(() => setExpanded(new Set(allIds)), [allIds]);
    const collapseAll = useCallback(() => setExpanded(new Set()), []);
    const allExpanded = allIds.length > 0 && allIds.every((id) => expanded.has(id));

    return { isExpanded, toggle, expandAll, collapseAll, allExpanded };
}
