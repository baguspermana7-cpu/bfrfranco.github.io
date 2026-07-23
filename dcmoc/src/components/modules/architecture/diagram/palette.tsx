'use client';

/* ─── ENGINEERING SYMBOL PALETTE (IEC single-line-diagram vendored SVGs) ─────
 * The parametric hand-rolled glyphs were replaced by a vendored engineering
 * symbol library (assets/engineering/*.svg → symbols.gen.ts). Each equipment
 * kind renders a proper IEC/standard schematic symbol (stroke-only,
 * currentColor) at a large size, so the symbol IS the node in the diagram.
 *
 * To edit a symbol: change the SVG in assets/engineering/, then
 *   node tools/build-engineering-symbols.mjs
 * which regenerates symbols.gen.ts (never hand-edit that file).
 * ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { SYMBOL_MARKUP, SYMBOL_META, SYMBOL_VIEWBOX, type GenSymbolKind } from './symbols.gen';

/* The palette key space equals the generated symbol set. New kinds
 * (breaker/disconnect/ats/dryCooler) come for free from the manifest. */
export type SymbolKind = GenSymbolKind;

export interface SymbolProps { x: number; y: number; s?: number; color: string; sld?: boolean }

export { SYMBOL_META };

/**
 * Render an equipment symbol as an SVG <g>, translate/scaled from the authored
 * 0..48 box to a box of side `s` anchored at (x,y). Strokes inherit
 * `currentColor` via the group's `color` style, so the whole symbol recolours
 * with the lane (logical) or neutral slate (SLD).
 */
export function SymbolGlyph({ kind, x, y, s = 44, color }: SymbolProps & { kind: SymbolKind }) {
    const markup = SYMBOL_MARKUP[kind];
    if (!markup) return null;
    const scale = s / SYMBOL_VIEWBOX;
    return (
        <g
            transform={`translate(${x},${y}) scale(${scale})`}
            style={{ color }}
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            dangerouslySetInnerHTML={{ __html: markup }}
        />
    );
}
