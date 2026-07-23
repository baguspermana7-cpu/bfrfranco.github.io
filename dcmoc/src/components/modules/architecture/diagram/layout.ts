/* ─── DYNAMIC SYSTEM-ARCHITECTURE DIAGRAM — layout engine (Phase C + AF + SYM) ─
 * Pure: sanitized inputs + engine equipment counts → symbol NODES, group
 * containment boxes, A/B bus bars and edges. OWNER MANDATE: NOT a static
 * image — every node count, path, cell and label is computed from ALL the
 * placed requirement parameters and re-renders on any change:
 *   • feeds/trunks + A/B buses follow redundancy • UPS/gen/PDU/rack/
 *     transformer counts from equipScale • cooling chain follows coolingType
 *   • voltage from requirements grid voltage • utility name from 1.1
 *   • IT hall splits into CELLS sized by the workload mix • phase boxes from
 *     capacity phases • design-margin + use-case annotations.
 * Each node carries a palette `kind` — the renderer draws a proper IEC
 * engineering symbol (palette.tsx → assets/engineering) as the node itself,
 * with the title/sub as a label BELOW it. Cells are sized for a ~44px symbol
 * plus a two-line label.
 * ──────────────────────────────────────────────────────────────────────── */

import type { ArchInputs, EquipCounts, FacilityCalc } from '@/state/adapters/arch-adapter';
import type { SymbolKind } from './palette';

export type EdgeKind = 'normal' | 'backup' | 'control' | 'coolSupply' | 'coolReturn';

export interface DiagBlock {
    id: string;
    x: number; y: number; w: number; h: number;
    title: string;
    sub?: string;
    badge?: string;
    glyphs?: number;         // repeated unit glyphs (≤6) — cascade hint
    units?: number;          // REAL unit count (cascade ×N badge when > glyph cap)
    lane: 'power' | 'gen' | 'cooling' | 'it' | 'bms';
    kind?: SymbolKind;       // engineering symbol palette key
    hover?: string;          // exact-value hover title
}

export interface DiagGroup { x: number; y: number; w: number; h: number; title: string; lane: DiagBlock['lane'] }
export interface DiagBus { x1: number; x2: number; y: number; label: string; spare?: boolean }
export interface DiagEdge { from: string; to: string; kind: EdgeKind; offset?: number }

export interface DiagramModel {
    blocks: DiagBlock[];
    edges: DiagEdge[];
    groups: DiagGroup[];
    buses: DiagBus[];
    viewBox: [number, number, number, number];
}

/** Additive extras — every requirement param that shapes the drawing. */
export interface LayoutExtras {
    utilityProvider?: string;
    mix?: { aiGpu: number; storage: number; general: number; network: number };
    phases?: { label: string; mw: number; future: boolean }[];
    marginPct?: number;
    slaPct?: number | null;
    useCaseLabel?: string;
}

/* Larger geometry: nodes are now symbols (~44px) + a two-line label below,
 * so cells are wider/taller than the old boxed glyphs. */
const COL_W = 176;
const COL_X = (i: number) => 20 + i * COL_W;
const BW = 148;           // cell width
const BH = 78;            // standard cell height (44 symbol + label lines)
const ROW_GAP = 20;       // vertical gap between paired A/B rows
const PY = 40;            // power-lane top

export function computeLayout(a: ArchInputs, eq: EquipCounts, f: FacilityCalc, ex: LayoutExtras = {}): DiagramModel {
    const blocks: DiagBlock[] = [];
    const edges: DiagEdge[] = [];
    const groups: DiagGroup[] = [];
    const buses: DiagBus[] = [];
    const paths = f.paths;                         // 1|2|3 from redundancyPaths
    const dual = paths >= 2;
    const spare = a.redKey === '2n1';
    const liquid = a.coolingType === 'liquid' || a.coolingType === 'rdhx';

    const glyphCap = (n: number) => Math.min(6, Math.max(1, n));
    const redFactor = a.redKey === 'n1' ? (eq.ups_modules + 1) / Math.max(1, eq.ups_modules)
        : a.redKey === '2n' ? 2 : 2 + 1 / Math.max(1, eq.ups_modules);
    const mwPerUps = eq.ups_modules > 0 ? (f.itMw * redFactor) / eq.ups_modules : 0;

    const ROW2 = BH + ROW_GAP;   // y-offset of the "B" row from the "A" row
    const single = PY + (ROW2) / 2; // single-feed centred between the A/B rows

    /* ── power lane — 7 stages: utility → MV → TX → UPS(+batt) → PDU → cells → IT ── */
    // stage 0 — utility (named from Requirements 1.1)
    const utilName = ex.utilityProvider?.trim() ? ex.utilityProvider.trim().slice(0, 16) : 'Utility';
    if (dual) {
        blocks.push({ id: 'utilA', x: COL_X(0), y: PY, w: BW, h: BH, title: `${utilName} A`, sub: a.gridVoltage, lane: 'power', kind: 'utility', hover: `Utility feed A — ${a.gridVoltage} incomer (${ex.utilityProvider || 'grid utility'})` });
        blocks.push({ id: 'utilB', x: COL_X(0), y: PY + ROW2, w: BW, h: BH, title: `${utilName} B`, sub: a.gridVoltage, lane: 'power', kind: 'utility', hover: `Utility feed B — ${a.gridVoltage} diverse incomer` });
    } else {
        blocks.push({ id: 'utilA', x: COL_X(0), y: single, w: BW, h: BH, title: `${utilName} Feed`, sub: a.gridVoltage, lane: 'power', kind: 'utility', hover: `Single utility feed — ${a.gridVoltage}` });
    }
    // stage 1 — MV switchgear
    const swPer = Math.ceil(eq.switchgear / (dual ? 2 : 1));
    if (dual) {
        blocks.push({ id: 'mvA', x: COL_X(1), y: PY, w: BW, h: BH, title: 'MV Swgr A', sub: `${swPer}× boards`, badge: a.redundancy, lane: 'power', kind: 'switchgear', hover: `MV switchgear A — ${swPer} boards at ${a.gridVoltage}` });
        blocks.push({ id: 'mvB', x: COL_X(1), y: PY + ROW2, w: BW, h: BH, title: 'MV Swgr B', sub: `${swPer}× boards`, badge: a.redundancy, lane: 'power', kind: 'switchgear', hover: `MV switchgear B — ${swPer} boards at ${a.gridVoltage}` });
        edges.push({ from: 'utilA', to: 'mvA', kind: 'normal' }, { from: 'utilB', to: 'mvB', kind: 'normal' });
        if (spare) edges.push({ from: 'utilA', to: 'mvB', kind: 'backup', offset: 6 });
    } else {
        blocks.push({ id: 'mvA', x: COL_X(1), y: single, w: BW, h: BH, title: 'MV Switchgear', sub: `${eq.switchgear}× boards`, badge: a.redundancy, lane: 'power', kind: 'switchgear', hover: `MV switchgear — ${eq.switchgear} boards` });
        edges.push({ from: 'utilA', to: 'mvA', kind: 'normal' });
    }
    // stage 2 — transformers (MV → LV)
    const txCount = Math.max(1, eq.transformers ?? Math.ceil(f.itMw / 2.5));
    const txPer = Math.ceil(txCount / (dual ? 2 : 1));
    if (dual) {
        blocks.push({ id: 'txA', x: COL_X(2), y: PY, w: BW, h: BH, title: 'Transformers A', sub: `${txPer}× MV/LV`, units: txPer, glyphs: glyphCap(txPer), lane: 'power', kind: 'transformer', hover: `Transformer bank A — ${txPer}× ${a.gridVoltage}/LV` });
        blocks.push({ id: 'txB', x: COL_X(2), y: PY + ROW2, w: BW, h: BH, title: 'Transformers B', sub: `${txPer}× MV/LV`, units: txPer, glyphs: glyphCap(txPer), lane: 'power', kind: 'transformer', hover: `Transformer bank B — ${txPer}× ${a.gridVoltage}/LV` });
        edges.push({ from: 'mvA', to: 'txA', kind: 'normal' }, { from: 'mvB', to: 'txB', kind: 'normal' });
    } else {
        blocks.push({ id: 'txA', x: COL_X(2), y: single, w: BW, h: BH, title: 'Transformers', sub: `${txCount}× MV/LV`, units: txCount, glyphs: glyphCap(txCount), lane: 'power', kind: 'transformer', hover: `Transformers — ${txCount}× ${a.gridVoltage}/LV` });
        edges.push({ from: 'mvA', to: 'txA', kind: 'normal' });
    }
    // A/B bus bars (reference idiom): between transformers and UPS, with voltage labels
    const busX1 = COL_X(2) + BW + 8, busX2 = COL_X(3) - 8;
    const lvLabel = 'LV 415V';
    if (dual) {
        buses.push({ x1: busX1, x2: busX2, y: PY + BH / 2, label: `BUS A · ${lvLabel}` });
        buses.push({ x1: busX1, x2: busX2, y: PY + ROW2 + BH / 2, label: `BUS B · ${lvLabel}` });
        if (spare) buses.push({ x1: busX1, x2: busX2, y: PY + ROW2 / 2 + BH / 2, label: 'SPARE', spare: true });
    }
    // stage 3 — UPS (+ battery autonomy per tier)
    const battMin = a.tier >= 4 ? 10 : a.tier === 3 ? 8 : 5;   // typical autonomy minutes per tier class (screening)
    const upsPer = Math.ceil(eq.ups_modules / (dual ? 2 : 1));
    if (dual) {
        blocks.push({ id: 'upsA', x: COL_X(3), y: PY, w: BW, h: BH, title: 'UPS System A', sub: `${upsPer}× ${mwPerUps.toFixed(2)} MW · batt ${battMin} min`, units: upsPer, glyphs: glyphCap(upsPer), lane: 'power', kind: 'ups', hover: `UPS A — ${upsPer} modules × ${mwPerUps.toFixed(2)} MW, battery ≈${battMin} min (Tier ${a.tier} screening)` });
        blocks.push({ id: 'upsB', x: COL_X(3), y: PY + ROW2, w: BW, h: BH, title: 'UPS System B', sub: `${upsPer}× ${mwPerUps.toFixed(2)} MW · batt ${battMin} min`, units: upsPer, glyphs: glyphCap(upsPer), lane: 'power', kind: 'ups', hover: `UPS B — ${upsPer} modules × ${mwPerUps.toFixed(2)} MW, battery ≈${battMin} min` });
        edges.push({ from: 'txA', to: 'upsA', kind: 'normal' }, { from: 'txB', to: 'upsB', kind: 'normal' });
    } else {
        blocks.push({ id: 'upsA', x: COL_X(3), y: single, w: BW, h: BH, title: 'UPS System', sub: `${eq.ups_modules}× ${mwPerUps.toFixed(2)} MW (+1 spare) · batt ${battMin} min`, units: eq.ups_modules, glyphs: glyphCap(eq.ups_modules), lane: 'power', kind: 'ups', hover: `UPS — ${eq.ups_modules} modules × ${mwPerUps.toFixed(2)} MW (+1 spare)` });
        edges.push({ from: 'txA', to: 'upsA', kind: 'normal' });
    }
    // stage 4 — PDU groups (lettered per path)
    const pduGroups = spare ? 3 : dual ? 2 : 1;
    const pduPer = Math.ceil(eq.pdus / pduGroups);
    const letters = ['A', 'B', 'C'];
    for (let g = 0; g < pduGroups; g++) {
        const id = `pdu${letters[g]}`;
        const gy = pduGroups === 1 ? single
            : pduGroups === 2 ? PY + g * ROW2
                : PY - 10 + g * (ROW2 - 12);
        blocks.push({ id, x: COL_X(4), y: gy, w: BW, h: BH, title: `PDU Group ${letters[g]}`, sub: `${pduPer}× PDU`, lane: 'power', kind: 'pdu', hover: `PDU group ${letters[g]} — ${pduPer} units` });
        edges.push({ from: g === 1 ? (dual ? 'upsB' : 'upsA') : 'upsA', to: id, kind: g === 2 ? 'backup' : 'normal' });
    }
    /* stage 5 — IT HALL split into CELLS by workload mix (owner: diagram must
     * plot from ALL requirement parameters). ≤3 cells: AI/GPU, Storage,
     * General+Network — heights ∝ mix share. */
    const mix = ex.mix ?? { aiGpu: 70, storage: 15, general: 10, network: 5 };
    const cells: { id: string; label: string; pct: number; kind: SymbolKind }[] = ([
        { id: 'cellAi', label: 'AI / GPU Cell', pct: mix.aiGpu, kind: 'rack' },
        { id: 'cellStor', label: 'Storage Cell', pct: mix.storage, kind: 'rack' },
        { id: 'cellGen', label: 'General + Network', pct: mix.general + mix.network, kind: 'rack' },
    ] as { id: string; label: string; pct: number; kind: SymbolKind }[]).filter((c) => c.pct >= 5);
    const cellAreaH = cells.length * (BH + 10);   // one BH cell per workload cell, cleanly stacked
    let cy = PY;
    cells.forEach((c) => {
        const h = BH;
        const racksInCell = Math.round(eq.racks * c.pct / 100);
        blocks.push({ id: c.id, x: COL_X(5), y: cy, w: BW, h, title: c.label, sub: `${c.pct}% · ~${racksInCell.toLocaleString()} racks`, lane: 'it', kind: c.kind, hover: `${c.label} — ${c.pct}% of the workload mix ≈ ${racksInCell.toLocaleString()} racks @ ${a.rackDensityKw} kW/rack` });
        for (let g = 0; g < pduGroups; g++) edges.push({ from: `pdu${letters[g]}`, to: c.id, kind: 'normal', offset: g * 4 });
        cy += h + 10;
    });
    // stage 6 — IT load (+ margin + SLA + use-case annotations)
    const marginTxt = ex.marginPct != null ? ` · +${ex.marginPct}% margin` : '';
    blocks.push({
        id: 'itload', x: COL_X(6), y: single, w: BW, h: BH, title: `IT LOAD (${f.itMw} MW)`,
        sub: `${a.rackDensityKw} kW/rack${marginTxt}`, badge: ex.useCaseLabel?.slice(0, 10),
        lane: 'it', kind: 'itload',
        hover: `IT load ${f.itMw} MW · facility ${f.facilityMw} MW at PUE ${f.pue}${ex.slaPct ? ` · SLA ${ex.slaPct}%` : ''}${marginTxt}`,
    });
    cells.forEach((c) => edges.push({ from: c.id, to: 'itload', kind: 'normal' }));

    /* ── generation lane ── */
    const itHallH = cells.length * (BH + 10);
    const GY = PY + Math.max(2 * ROW2, itHallH) + 40;   // lower lanes clear BOTH the power rows and the IT-HALL cells above
    blocks.push({ id: 'gens', x: COL_X(0), y: GY, w: BW, h: BH, title: 'Generation', sub: `${eq.generators}× gensets ${spare ? '(dual+spare)' : a.redundancy}`, units: eq.generators, glyphs: glyphCap(eq.generators), lane: 'gen', kind: 'genset', hover: `Standby generation — ${eq.generators} gensets, ${a.redundancy}` });
    blocks.push({ id: 'fuel', x: COL_X(1), y: GY, w: BW, h: BH, title: 'Fuel Farm', sub: `${a.fuelHours} h autonomy`, lane: 'gen', kind: 'fuel', hover: `Fuel storage — ${a.fuelHours} hours full-load autonomy` });
    edges.push({ from: 'fuel', to: 'gens', kind: 'backup' });
    edges.push({ from: 'gens', to: 'mvA', kind: 'backup' });
    if (dual) edges.push({ from: 'gens', to: 'mvB', kind: 'backup', offset: 5 });

    /* ── cooling lane ── */
    const CY = GY;
    if (liquid) {
        const loops = Math.max(1, paths);
        const cduPerLoop = Math.ceil(eq.pumps / Math.max(1, loops));
        blocks.push({ id: 'coolplant', x: COL_X(2), y: CY, w: BW, h: BH, title: 'CDU Plant (Liquid)', sub: `${loops}× loops · ${cduPerLoop} CDU/loop`, units: loops, glyphs: glyphCap(loops), lane: 'cooling', kind: 'cdu', hover: `Liquid cooling — ${loops} CDU loops × ${cduPerLoop} CDUs` });
        blocks.push({ id: 'heatrej', x: COL_X(3), y: CY, w: BW, h: BH, title: 'Heat Rejection', sub: `${eq.chillers}× units`, lane: 'cooling', kind: 'coolingTower', hover: `Heat rejection — ${eq.chillers} units` });
        edges.push({ from: 'coolplant', to: 'heatrej', kind: 'coolSupply' });
        edges.push({ from: 'heatrej', to: 'coolplant', kind: 'coolReturn', offset: 6 });
        cells.forEach((c, i) => {
            edges.push({ from: 'coolplant', to: c.id, kind: 'coolSupply', offset: -6 - i * 3 });
        });
        edges.push({ from: cells[0]?.id ?? 'itload', to: 'coolplant', kind: 'coolReturn', offset: 10 });
    } else {
        blocks.push({ id: 'coolplant', x: COL_X(2), y: CY, w: BW, h: BH, title: 'Chiller Plant', sub: `${eq.chillers}× chillers ${a.redundancy}`, units: eq.chillers, glyphs: glyphCap(eq.chillers), lane: 'cooling', kind: 'chiller', hover: `Chiller plant — ${eq.chillers} chillers, ${a.redundancy}` });
        blocks.push({ id: 'crah', x: COL_X(3), y: CY, w: BW, h: BH, title: 'CRAH / AHU', sub: `${eq.ahu + eq.cooling_units}× units`, lane: 'cooling', kind: 'crah', hover: `Air distribution — ${eq.ahu + eq.cooling_units} CRAH/AHU units` });
        edges.push({ from: 'coolplant', to: 'crah', kind: 'coolSupply' });
        edges.push({ from: 'crah', to: 'coolplant', kind: 'coolReturn', offset: 6 });
        edges.push({ from: 'crah', to: cells[0]?.id ?? 'itload', kind: 'coolSupply', offset: -6 });
    }

    /* ── network fabric + BMS ── */
    const leaf = Math.ceil(eq.racks / 16);
    blocks.push({ id: 'fabric', x: COL_X(4), y: CY, w: BW, h: BH, title: 'Network Fabric', sub: `spine/leaf · ~${leaf} leaf`, lane: 'it', kind: 'fabric', hover: `Spine/leaf fabric — ≈${leaf} leaf switches (1 per 16 racks)` });
    edges.push({ from: 'fabric', to: cells[0]?.id ?? 'itload', kind: 'control' });
    blocks.push({ id: 'bms', x: COL_X(5), y: CY, w: BW, h: BH, title: 'BMS & DCIM', sub: 'Monitor · Control · Alarm', lane: 'bms', kind: 'bms', hover: 'Building management + DCIM — monitoring/control edges (dashed green)' });
    edges.push({ from: 'bms', to: 'upsA', kind: 'control', offset: 8 });
    edges.push({ from: 'bms', to: 'coolplant', kind: 'control', offset: 12 });
    edges.push({ from: 'bms', to: 'mvA', kind: 'control', offset: 16 });

    /* ── group containment boxes (reference idiom) — labelled group boxes ── */
    const powerH = 2 * ROW2 + 8;
    groups.push({ x: COL_X(0) - 12, y: PY - 22, w: COL_W * 5 - 18, h: powerH, title: `POWER TRAIN — ${a.redundancy} · ${paths} path${paths > 1 ? 's' : ''}`, lane: 'power' });
    groups.push({ x: COL_X(5) - 12, y: PY - 22, w: COL_W * 2 - 10, h: Math.max(powerH, itHallH + 4), title: `IT HALL — ${cells.length} cell${cells.length > 1 ? 's' : ''} · ${eq.racks.toLocaleString()} racks`, lane: 'it' });
    const lowerH = BH + 26;
    groups.push({ x: COL_X(0) - 12, y: GY - 22, w: COL_W * 2 - 18, h: lowerH, title: `GENERATION — ${eq.generators}× · ${a.fuelHours}h fuel`, lane: 'gen' });
    groups.push({ x: COL_X(2) - 12, y: CY - 22, w: COL_W * 2 - 18, h: lowerH, title: liquid ? `COOLING PLANT — ${Math.max(1, paths)} CDU loops` : `COOLING PLANT — ${eq.chillers} chillers`, lane: 'cooling' });
    groups.push({ x: COL_X(4) - 12, y: CY - 22, w: COL_W * 2 - 10, h: lowerH, title: 'NETWORK & CONTROL', lane: 'bms' });

    /* ── phase boxes (capacity growth) — dashed future phases under the diagram ── */
    let extraH = 0;
    if (ex.phases && ex.phases.length > 1) {
        const py2 = GY + BH + 40;
        ex.phases.slice(0, 4).forEach((p, i) => {
            blocks.push({
                id: `phase${i}`, x: COL_X(2 + i), y: py2, w: BW, h: 44,
                title: p.label, sub: `${p.mw.toFixed(1)} MW${p.future ? ' · future' : ''}`,
                lane: 'it', hover: `${p.label} — ${p.mw.toFixed(1)} MW${p.future ? ' (planned growth phase)' : ' (current)'}`,
                badge: p.future ? 'PLAN' : 'NOW',
            });
        });
        groups.push({ x: COL_X(2) - 12, y: py2 - 22, w: COL_W * Math.min(4, ex.phases.length) - 10, h: 72, title: 'GROWTH PHASES (capacity plan)', lane: 'it' });
        extraH = 84;
    }

    return { blocks, edges, groups, buses, viewBox: [0, 0, 20 + 7 * COL_W + 12, GY + BH + 40 + extraH] };
}
