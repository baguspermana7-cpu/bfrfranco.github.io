'use client';
import React from 'react';
import { useCollapsibleTree, type TreeNodeLike, type CollapsibleTreeApi } from '@/hooks/useCollapsibleTree';

/* ─── CollapsibleTree — reusable nested tree renderer ────────────────────────
 * Renders a tree of nodes; each node with children shows a chevron that
 * expands/collapses ITS children, and the shared api's Expand-all/Collapse-all
 * act on every node. Caller supplies renderNode; the primitive owns the state.
 * (Owner: collapse/expand must be a reusable feature, not hardcoded per page.) */
export interface CollapsibleTreeNodeCtx {
    depth: number;
    isExpanded: boolean;
    hasChildren: boolean;
    toggle: () => void;
}

export function CollapsibleTree<T extends TreeNodeLike>({ roots, renderNode, api }: {
    roots: readonly T[];
    renderNode: (node: T, ctx: CollapsibleTreeNodeCtx) => React.ReactNode;
    /** pass a shared api (from useCollapsibleTree) so external Expand/Collapse-all buttons stay in sync; else the tree manages its own */
    api?: CollapsibleTreeApi;
}) {
    const own = useCollapsibleTree(roots);
    const t = api ?? own;
    const render = (nodes: readonly T[], depth: number): React.ReactNode => nodes.map((n) => {
        const hasChildren = !!(n.children && n.children.length);
        const open = t.isExpanded(n.id);
        return (
            <div key={n.id}>
                {renderNode(n, { depth, isExpanded: open, hasChildren, toggle: () => t.toggle(n.id) })}
                {hasChildren && open ? render(n.children as readonly T[], depth + 1) : null}
            </div>
        );
    });
    return <>{render(roots, 0)}</>;
}
