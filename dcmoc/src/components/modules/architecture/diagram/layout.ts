/* ─── DYNAMIC SYSTEM-ARCHITECTURE DIAGRAM — layout engine (Phase C) ──────────
 * Pure: sanitized inputs + engine equipment counts → blocks + edges.
 * OWNER MANDATE: NOT a static image — every block count, path and label is
 * computed from the placed requirements and re-renders on any change:
 *   • feeds/trunks follow redundancy (N+1 single trunk + spare, 2N dual A/B,
 *     2N+1 dual + thin spare)  • UPS/gen/PDU/rack counts from equipScale
 *   • cooling chain follows coolingType (liquid/rdhx → CDU loops + heat
 *     rejection; air/inrow → chillers + CRAH)  • voltage label from
 *     requirements grid voltage  • per-module MW from redundancy factor.
 * ──────────────────────────────────────────────────────────────────────── */

import type { ArchInputs, EquipCounts, FacilityCalc } from '@/state/adapters/arch-adapter';

export type EdgeKind = 'normal' | 'backup' | 'control' | 'coolSupply' | 'coolReturn';

export interface DiagBlock {
    id: string;
    x: number; y: number; w: number; h: number;
    title: string;
    sub?: string;
    badge?: string;
    glyphs?: number;         // repeated unit glyphs (≤6) inside the block
    lane: 'power' | 'gen' | 'cooling' | 'it' | 'bms';
}

export interface DiagEdge { from: string; to: string; kind: EdgeKind; offset?: number }

export interface DiagramModel {
    blocks: DiagBlock[];
    edges: DiagEdge[];
    viewBox: [number, number, number, number];
}

const COL_W = 150;
const COL_X = (i: number) => 16 + i * COL_W;
const BW = 122;

export function computeLayout(a: ArchInputs, eq: EquipCounts, f: FacilityCalc): DiagramModel {
    const blocks: DiagBlock[] = [];
    const edges: DiagEdge[] = [];
    const paths = f.paths;                         // 1|2|3 from redundancyPaths
    const dual = paths >= 2;
    const spare = a.redKey === '2n1';
    const liquid = a.coolingType === 'liquid' || a.coolingType === 'rdhx';

    const glyphCap = (n: number) => Math.min(6, Math.max(1, n));
    const redFactor = a.redKey === 'n1' ? (eq.ups_modules + 1) / Math.max(1, eq.ups_modules)
        : a.redKey === '2n' ? 2 : 2 + 1 / Math.max(1, eq.ups_modules);
    const mwPerUps = eq.ups_modules > 0 ? (f.itMw * redFactor) / eq.ups_modules : 0;

    /* ── power lane (row y=20..) stages 0-5 ── */
    const PY = 24;
    // stage 0 — utility
    if (dual) {
        blocks.push({ id: 'utilA', x: COL_X(0), y: PY, w: BW, h: 46, title: `Utility A`, sub: a.gridVoltage, lane: 'power' });
        blocks.push({ id: 'utilB', x: COL_X(0), y: PY + 62, w: BW, h: 46, title: `Utility B`, sub: a.gridVoltage, lane: 'power' });
    } else {
        blocks.push({ id: 'utilA', x: COL_X(0), y: PY + 30, w: BW, h: 46, title: `Utility Feed`, sub: a.gridVoltage, lane: 'power' });
    }
    // stage 1 — MV switchgear
    const swPer = Math.ceil(eq.switchgear / (dual ? 2 : 1));
    if (dual) {
        blocks.push({ id: 'mvA', x: COL_X(1), y: PY, w: BW, h: 46, title: 'MV Swgr A', sub: `${swPer}× boards`, badge: a.redundancy, lane: 'power' });
        blocks.push({ id: 'mvB', x: COL_X(1), y: PY + 62, w: BW, h: 46, title: 'MV Swgr B', sub: `${swPer}× boards`, badge: a.redundancy, lane: 'power' });
        edges.push({ from: 'utilA', to: 'mvA', kind: 'normal' }, { from: 'utilB', to: 'mvB', kind: 'normal' });
        if (spare) edges.push({ from: 'utilA', to: 'mvB', kind: 'backup', offset: 6 });
    } else {
        blocks.push({ id: 'mvA', x: COL_X(1), y: PY + 30, w: BW, h: 46, title: 'MV Switchgear', sub: `${eq.switchgear}× boards`, badge: a.redundancy, lane: 'power' });
        edges.push({ from: 'utilA', to: 'mvA', kind: 'normal' });
    }
    // stage 2 — UPS
    const upsPer = Math.ceil(eq.ups_modules / (dual ? 2 : 1));
    if (dual) {
        blocks.push({ id: 'upsA', x: COL_X(2), y: PY, w: BW, h: 46, title: 'UPS System A', sub: `${upsPer}× ${mwPerUps.toFixed(2)} MW`, glyphs: glyphCap(upsPer), lane: 'power' });
        blocks.push({ id: 'upsB', x: COL_X(2), y: PY + 62, w: BW, h: 46, title: 'UPS System B', sub: `${upsPer}× ${mwPerUps.toFixed(2)} MW`, glyphs: glyphCap(upsPer), lane: 'power' });
        edges.push({ from: 'mvA', to: 'upsA', kind: 'normal' }, { from: 'mvB', to: 'upsB', kind: 'normal' });
    } else {
        blocks.push({ id: 'upsA', x: COL_X(2), y: PY + 30, w: BW, h: 46, title: 'UPS System', sub: `${eq.ups_modules}× ${mwPerUps.toFixed(2)} MW (+1 spare)`, glyphs: glyphCap(eq.ups_modules), lane: 'power' });
        edges.push({ from: 'mvA', to: 'upsA', kind: 'normal' });
    }
    // stage 3 — PDU groups (lettered per path)
    const groups = spare ? 3 : dual ? 2 : 1;
    const pduPer = Math.ceil(eq.pdus / groups);
    const letters = ['A', 'B', 'C'];
    for (let g = 0; g < groups; g++) {
        const id = `pdu${letters[g]}`;
        blocks.push({ id, x: COL_X(3), y: PY + g * 52 - (groups > 2 ? 10 : 0), w: BW, h: 40, title: `PDU Group ${letters[g]}`, sub: `${pduPer}× PDU`, lane: 'power' });
        edges.push({ from: g === 1 ? (dual ? 'upsB' : 'upsA') : 'upsA', to: id, kind: g === 2 ? 'backup' : 'normal' });
    }
    // stage 4 — rack rows
    const rows = Math.min(8, Math.max(1, Math.ceil(eq.racks / 200)));
    blocks.push({ id: 'racks', x: COL_X(4), y: PY + 14, w: BW, h: 62, title: 'Rack Distribution', sub: `${rows} rows · ${eq.racks.toLocaleString()} racks`, glyphs: glyphCap(rows), lane: 'it' });
    for (let g = 0; g < groups; g++) edges.push({ from: `pdu${letters[g]}`, to: 'racks', kind: 'normal', offset: g * 4 });
    // stage 5 — IT load
    blocks.push({ id: 'itload', x: COL_X(5), y: PY + 14, w: BW, h: 62, title: `IT LOAD (${f.itMw} MW)`, sub: `${a.rackDensityKw} kW/rack · ${a.coolingType === 'liquid' ? 'liquid cooled' : a.coolingType}`, lane: 'it' });
    edges.push({ from: 'racks', to: 'itload', kind: 'normal' });

    /* ── generation lane (below power, stages 0-1) ── */
    const GY = PY + 128;
    blocks.push({ id: 'gens', x: COL_X(0), y: GY, w: BW, h: 46, title: 'Generation', sub: `${eq.generators}× gensets ${spare ? '(dual+spare)' : a.redundancy}`, glyphs: glyphCap(eq.generators), lane: 'gen' });
    blocks.push({ id: 'fuel', x: COL_X(1), y: GY, w: BW, h: 46, title: 'Fuel Farm', sub: `${a.fuelHours} h autonomy`, lane: 'gen' });
    edges.push({ from: 'fuel', to: 'gens', kind: 'backup' });
    edges.push({ from: 'gens', to: 'mvA', kind: 'backup' });
    if (dual) edges.push({ from: 'gens', to: 'mvB', kind: 'backup', offset: 5 });

    /* ── cooling lane (stages 2-5, below) ── */
    const CY = GY;
    if (liquid) {
        const loops = Math.max(1, paths);
        const cduPerLoop = Math.ceil(eq.pumps / Math.max(1, loops));
        blocks.push({ id: 'coolplant', x: COL_X(2), y: CY, w: BW, h: 46, title: 'Cooling Plant (Liquid)', sub: `${loops}× CDU loops · ${cduPerLoop} CDU/loop`, glyphs: glyphCap(loops), lane: 'cooling' });
        blocks.push({ id: 'heatrej', x: COL_X(3), y: CY, w: BW, h: 46, title: 'Heat Rejection', sub: `${eq.chillers}× units`, lane: 'cooling' });
        edges.push({ from: 'coolplant', to: 'heatrej', kind: 'coolSupply' });
        edges.push({ from: 'heatrej', to: 'coolplant', kind: 'coolReturn', offset: 6 });
        edges.push({ from: 'coolplant', to: 'racks', kind: 'coolSupply', offset: -6 });
        edges.push({ from: 'racks', to: 'coolplant', kind: 'coolReturn', offset: 10 });
    } else {
        blocks.push({ id: 'coolplant', x: COL_X(2), y: CY, w: BW, h: 46, title: 'Chiller Plant', sub: `${eq.chillers}× chillers ${a.redundancy}`, glyphs: glyphCap(eq.chillers), lane: 'cooling' });
        blocks.push({ id: 'crah', x: COL_X(3), y: CY, w: BW, h: 46, title: 'CRAH / AHU', sub: `${eq.ahu + eq.cooling_units}× units`, lane: 'cooling' });
        edges.push({ from: 'coolplant', to: 'crah', kind: 'coolSupply' });
        edges.push({ from: 'crah', to: 'coolplant', kind: 'coolReturn', offset: 6 });
        edges.push({ from: 'crah', to: 'racks', kind: 'coolSupply', offset: -6 });
    }

    /* ── network fabric + BMS ── */
    blocks.push({ id: 'fabric', x: COL_X(4), y: CY, w: BW, h: 46, title: 'Network Fabric', sub: `spine/leaf · ~${Math.ceil(eq.racks / 16)} leaf`, lane: 'it' });
    edges.push({ from: 'fabric', to: 'racks', kind: 'control' });
    blocks.push({ id: 'bms', x: COL_X(5), y: CY, w: BW, h: 46, title: 'BMS & DCIM', sub: 'Monitor · Control · Alarm', lane: 'bms' });
    edges.push({ from: 'bms', to: 'upsA', kind: 'control', offset: 8 });
    edges.push({ from: 'bms', to: 'coolplant', kind: 'control', offset: 12 });
    edges.push({ from: 'bms', to: 'mvA', kind: 'control', offset: 16 });

    return { blocks, edges, viewBox: [0, 0, 16 + 6 * COL_W + 8, GY + 74] };
}
