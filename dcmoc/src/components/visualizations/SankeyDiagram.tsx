'use client';

import React, { useMemo } from 'react';

// ─── TYPES ──────────────────────────────────────────────────
interface SankeyNode {
    id: string;
    label: string;
    value: number;
    color: string;
    column: number;
}

interface SankeyLink {
    source: string;
    target: string;
    value: number;
    color?: string;
}

interface SankeyDiagramProps {
    data: {
        nodes: SankeyNode[];
        links: SankeyLink[];
    };
    width?: number;
    height?: number;
}

// ─── LAYOUT ENGINE ──────────────────────────────────────────
const computeLayout = (
    nodes: SankeyNode[],
    links: SankeyLink[],
    width: number,
    height: number,
    nodePadding: number = 20,
    nodeWidth: number = 24,
) => {
    // Group by column
    const columns: Map<number, SankeyNode[]> = new Map();
    nodes.forEach(n => {
        if (!columns.has(n.column)) columns.set(n.column, []);
        columns.get(n.column)!.push(n);
    });

    const maxCol = Math.max(...Array.from(columns.keys()));
    const colWidth = maxCol > 0 ? (width - nodeWidth) / maxCol : width;

    // Position nodes
    const nodePositions: Map<string, { x: number; y: number; height: number; color: string; label: string; value: number }> = new Map();

    columns.forEach((colNodes, col) => {
        const totalValue = colNodes.reduce((s, n) => s + n.value, 0);
        const availableHeight = height - (colNodes.length - 1) * nodePadding;
        const x = col * colWidth;

        let currentY = 0;
        colNodes.forEach(node => {
            // B6: Proportional heights with min 20px to prevent overlap
            const nodeHeight = Math.max(20, (node.value / totalValue) * availableHeight);
            nodePositions.set(node.id, {
                x,
                y: currentY,
                height: nodeHeight,
                color: node.color,
                label: node.label,
                value: node.value,
            });
            currentY += nodeHeight + nodePadding;
        });
    });

    // Track port offsets for stacking links
    const sourceOffsets: Map<string, number> = new Map();
    const targetOffsets: Map<string, number> = new Map();

    const linkPaths = links.map(link => {
        const source = nodePositions.get(link.source);
        const target = nodePositions.get(link.target);
        if (!source || !target) return null;

        const sourceTotal = links.filter(l => l.source === link.source).reduce((s, l) => s + l.value, 0);
        const targetTotal = links.filter(l => l.target === link.target).reduce((s, l) => s + l.value, 0);

        const linkHeight_source = (link.value / sourceTotal) * source.height;
        const linkHeight_target = (link.value / targetTotal) * target.height;

        const sOff = sourceOffsets.get(link.source) || 0;
        const tOff = targetOffsets.get(link.target) || 0;

        sourceOffsets.set(link.source, sOff + linkHeight_source);
        targetOffsets.set(link.target, tOff + linkHeight_target);

        const x0 = source.x + nodeWidth;
        const y0 = source.y + sOff;
        const x1 = target.x;
        const y1 = target.y + tOff;
        const midX = (x0 + x1) / 2;

        return {
            path: `M ${x0},${y0} 
                   C ${midX},${y0} ${midX},${y1} ${x1},${y1}
                   L ${x1},${y1 + linkHeight_target}
                   C ${midX},${y1 + linkHeight_target} ${midX},${y0 + linkHeight_source} ${x0},${y0 + linkHeight_source}
                   Z`,
            color: link.color || source.color,
            value: link.value,
            sourceLabel: source.label,
            targetLabel: target.label,
        };
    }).filter(Boolean);

    return { nodePositions, linkPaths, nodeWidth };
};

// ─── FORMAT ─────────────────────────────────────────────────
const fmtVal = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
};

// ─── COMPONENT ──────────────────────────────────────────────
const SankeyDiagram: React.FC<SankeyDiagramProps> = ({ data, width = 700, height = 400 }) => {
    const { nodePositions, linkPaths, nodeWidth } = useMemo(
        () => computeLayout(data.nodes, data.links, width, height),
        [data, width, height]
    );

    const [hoveredLink, setHoveredLink] = React.useState<number | null>(null);

    return (
        <div className="w-full overflow-x-auto">
            <svg
                viewBox={`-10 -10 ${width + 20} ${height + 20}`}
                className="w-full"
                style={{ maxHeight: height + 20 }}
            >
                {/* Links */}
                {linkPaths.map((link, i) => link && (
                    <g key={i}>
                        <path
                            d={link.path}
                            fill={link.color}
                            // B6: Increased base opacity to 50%
                            opacity={hoveredLink === null ? 0.50 : hoveredLink === i ? 0.8 : 0.15}
                            className="transition-opacity duration-200 cursor-pointer"
                            onMouseEnter={() => setHoveredLink(i)}
                            onMouseLeave={() => setHoveredLink(null)}
                        />
                        {hoveredLink === i && (
                            <text
                                x={width / 2}
                                y={height + 10}
                                textAnchor="middle"
                                className="fill-slate-600 dark:fill-slate-400"
                                fontSize={11}
                            >
                                {link.sourceLabel} → {link.targetLabel}: {fmtVal(link.value)}
                            </text>
                        )}
                    </g>
                ))}

                {/* Nodes */}
                {Array.from(nodePositions.entries()).map(([id, node]) => (
                    <g key={id}>
                        <rect
                            x={node.x}
                            y={node.y}
                            width={nodeWidth}
                            height={node.height}
                            rx={4}
                            fill={node.color}
                            opacity={0.9}
                        />
                        {/* Label */}
                        {node.height > 12 && (
                            <text
                                x={node.x < width / 2 ? node.x + nodeWidth + 6 : node.x - 6}
                                y={node.y + node.height / 2}
                                textAnchor={node.x < width / 2 ? 'start' : 'end'}
                                dominantBaseline="middle"
                                className="fill-slate-900 dark:fill-slate-200"
                                fontSize={11}
                                fontWeight={500}
                            >
                                {node.label}
                            </text>
                        )}
                        {/* Value */}
                        {node.height > 20 && (
                            <text
                                x={node.x < width / 2 ? node.x + nodeWidth + 6 : node.x - 6}
                                y={node.y + node.height / 2 + 14}
                                textAnchor={node.x < width / 2 ? 'start' : 'end'}
                                dominantBaseline="middle"
                                className="fill-slate-600 dark:fill-slate-400"
                                fontSize={10}
                            >
                                {fmtVal(node.value)}
                            </text>
                        )}
                    </g>
                ))}
            </svg>
        </div>
    );
};

export default SankeyDiagram;
export type { SankeyNode, SankeyLink, SankeyDiagramProps };
