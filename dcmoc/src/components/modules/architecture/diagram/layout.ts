/* ─── DYNAMIC SYSTEM-ARCHITECTURE DIAGRAM — layout engine (Phase C + AF) ─────
 * Pure: sanitized inputs + engine equipment counts → symbol blocks, group
 * containment boxes, A/B bus bars and edges. OWNER MANDATE: NOT a static
 * image — every block count, path, cell and label is computed from ALL the
 * placed requirement parameters and re-renders on any change:
 *   • feeds/trunks + A/B buses follow redundancy • UPS/gen/PDU/rack/
 *     transformer counts from equipScale • cooling chain follows coolingType
 *   • voltage from requirements grid voltage • utility name from 1.1
 *   • IT hall splits into CELLS sized by the workload mix • phase boxes from
 *     capacity phases • design-margin + use-case annotations.
 * Blocks carry a palette `kind` — the renderer draws ONLY from the dynamic
 * symbol palette (palette.tsx).
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
    glyphs?: number;         // repeated unit glyphs (≤6) inside the block
    lane: 'power' | 'gen' | 'cooling' | 'it' | 'bms';
    kind?: SymbolKind;       // dynamic symbol palette key
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

const COL_W = 150;
const COL_X = (i: number) => 16 + i * COL_W;
const BW = 122;

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

    /* ── power lane (row y=24..) — 7 stages: utility → MV → TX → UPS(+batt) → PDU → cells → IT ── */
    const PY = 24;
    // stage 0 — utility (named from Requirements 1.1)
    const utilName = ex.utilityProvider?.trim() ? ex.utilityProvider.trim().slice(0, 16) : 'Utility';
    if (dual) {
        blocks.push({ id: 'utilA', x: COL_X(0), y: PY, w: BW, h: 46, title: `${utilName} A`, sub: a.gridVoltage, lane: 'power', kind: 'utility', hover: `Utility feed A — ${a.gridVoltage} incomer (${ex.utilityProvider || 'grid utility'})` });
        blocks.push({ id: 'utilB', x: COL_X(0), y: PY + 62, w: BW, h: 46, title: `${utilName} B`, sub: a.gridVoltage, lane: 'power', kind: 'utility', hover: `Utility feed B — ${a.gridVoltage} diverse incomer` });
    } else {
        blocks.push({ id: 'utilA', x: COL_X(0), y: PY + 30, w: BW, h: 46, title: `${utilName} Feed`, sub: a.gridVoltage, lane: 'power', kind: 'utility', hover: `Single utility feed — ${a.gridVoltage}` });
    }
    // stage 1 — MV switchgear
    const swPer = Math.ceil(eq.switchgear / (dual ? 2 : 1));
    if (dual) {
        blocks.push({ id: 'mvA', x: COL_X(1), y: PY, w: BW, h: 46, title: 'MV Swgr A', sub: `${swPer}× boards`, badge: a.redundancy, lane: 'power', kind: 'switchgear', hover: `MV switchgear A — ${swPer} boards at ${a.gridVoltage}` });
        blocks.push({ id: 'mvB', x: COL_X(1), y: PY + 62, w: BW, h: 46, title: 'MV Swgr B', sub: `${swPer}× boards`, badge: a.redundancy, lane: 'power', kind: 'switchgear', hover: `MV switchgear B — ${swPer} boards at ${a.gridVoltage}` });
        edges.push({ from: 'utilA', to: 'mvA', kind: 'normal' }, { from: 'utilB', to: 'mvB', kind: 'normal' });
        if (spare) edges.push({ from: 'utilA', to: 'mvB', kind: 'backup', offset: 6 });
    } else {
        blocks.push({ id: 'mvA', x: COL_X(1), y: PY + 30, w: BW, h: 46, title: 'MV Switchgear', sub: `${eq.switchgear}× boards`, badge: a.redundancy, lane: 'power', kind: 'switchgear', hover: `MV switchgear — ${eq.switchgear} boards` });
        edges.push({ from: 'utilA', to: 'mvA', kind: 'normal' });
    }
    // stage 2 — transformers (MV → LV)
    const txCount = Math.max(1, eq.transformers ?? Math.ceil(f.itMw / 2.5));
    const txPer = Math.ceil(txCount / (dual ? 2 : 1));
    if (dual) {
        blocks.push({ id: 'txA', x: COL_X(2), y: PY, w: BW, h: 46, title: 'Transformers A', sub: `${txPer}× MV/LV`, glyphs: glyphCap(txPer), lane: 'power', kind: 'transformer', hover: `Transformer bank A — ${txPer}× ${a.gridVoltage}/LV` });
        blocks.push({ id: 'txB', x: COL_X(2), y: PY + 62, w: BW, h: 46, title: 'Transformers B', sub: `${txPer}× MV/LV`, glyphs: glyphCap(txPer), lane: 'power', kind: 'transformer', hover: `Transformer bank B — ${txPer}× ${a.gridVoltage}/LV` });
        edges.push({ from: 'mvA', to: 'txA', kind: 'normal' }, { from: 'mvB', to: 'txB', kind: 'normal' });
    } else {
        blocks.push({ id: 'txA', x: COL_X(2), y: PY + 30, w: BW, h: 46, title: 'Transformers', sub: `${txCount}× MV/LV`, glyphs: glyphCap(txCount), lane: 'power', kind: 'transformer', hover: `Transformers — ${txCount}× ${a.gridVoltage}/LV` });
        edges.push({ from: 'mvA', to: 'txA', kind: 'normal' });
    }
    // A/B bus bars (reference idiom): between transformers and UPS
    const busX1 = COL_X(2) + BW + 6, busX2 = COL_X(3) - 6;
    if (dual) {
        buses.push({ x1: busX1, x2: busX2, y: PY + 23, label: 'BUS A' });
        buses.push({ x1: busX1, x2: busX2, y: PY + 85, label: 'BUS B' });
        if (spare) buses.push({ x1: busX1, x2: busX2, y: PY + 54, label: 'SPARE', spare: true });
    }
    // stage 3 — UPS (+ battery autonomy per tier)
    const battMin = a.tier >= 4 ? 10 : a.tier === 3 ? 8 : 5;   // typical autonomy minutes per tier class (screening)
    const upsPer = Math.ceil(eq.ups_modules / (dual ? 2 : 1));
    if (dual) {
        blocks.push({ id: 'upsA', x: COL_X(3), y: PY, w: BW, h: 46, title: 'UPS System A', sub: `${upsPer}× ${mwPerUps.toFixed(2)} MW · batt ${battMin} min`, glyphs: glyphCap(upsPer), lane: 'power', kind: 'ups', hover: `UPS A — ${upsPer} modules × ${mwPerUps.toFixed(2)} MW, battery ≈${battMin} min (Tier ${a.tier} screening)` });
        blocks.push({ id: 'upsB', x: COL_X(3), y: PY + 62, w: BW, h: 46, title: 'UPS System B', sub: `${upsPer}× ${mwPerUps.toFixed(2)} MW · batt ${battMin} min`, glyphs: glyphCap(upsPer), lane: 'power', kind: 'ups', hover: `UPS B — ${upsPer} modules × ${mwPerUps.toFixed(2)} MW, battery ≈${battMin} min` });
        edges.push({ from: 'txA', to: 'upsA', kind: 'normal' }, { from: 'txB', to: 'upsB', kind: 'normal' });
    } else {
        blocks.push({ id: 'upsA', x: COL_X(3), y: PY + 30, w: BW, h: 46, title: 'UPS System', sub: `${eq.ups_modules}× ${mwPerUps.toFixed(2)} MW (+1 spare) · batt ${battMin} min`, glyphs: glyphCap(eq.ups_modules), lane: 'power', kind: 'ups', hover: `UPS — ${eq.ups_modules} modules × ${mwPerUps.toFixed(2)} MW (+1 spare)` });
        edges.push({ from: 'txA', to: 'upsA', kind: 'normal' });
    }
    // stage 4 — PDU groups (lettered per path)
    const pduGroups = spare ? 3 : dual ? 2 : 1;
    const pduPer = Math.ceil(eq.pdus / pduGroups);
    const letters = ['A', 'B', 'C'];
    for (let g = 0; g < pduGroups; g++) {
        const id = `pdu${letters[g]}`;
        blocks.push({ id, x: COL_X(4), y: PY + g * 52 - (pduGroups > 2 ? 10 : 0), w: BW, h: 40, title: `PDU Group ${letters[g]}`, sub: `${pduPer}× PDU`, lane: 'power', kind: 'pdu', hover: `PDU group ${letters[g]} — ${pduPer} units` });
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
    const cellAreaH = 128;
    let cy = PY;
    cells.forEach((c) => {
        const h = Math.max(28, Math.round((c.pct / 100) * cellAreaH));
        const racksInCell = Math.round(eq.racks * c.pct / 100);
        blocks.push({ id: c.id, x: COL_X(5), y: cy, w: BW, h, title: c.label, sub: `${c.pct}% · ~${racksInCell.toLocaleString()} racks`, lane: 'it', kind: c.kind, hover: `${c.label} — ${c.pct}% of the workload mix ≈ ${racksInCell.toLocaleString()} racks @ ${a.rackDensityKw} kW/rack` });
        for (let g = 0; g < pduGroups; g++) edges.push({ from: `pdu${letters[g]}`, to: c.id, kind: 'normal', offset: g * 4 });
        cy += h + 8;
    });
    // stage 6 — IT load (+ margin + SLA + use-case annotations)
    const marginTxt = ex.marginPct != null ? ` · +${ex.marginPct}% margin` : '';
    blocks.push({
        id: 'itload', x: COL_X(6), y: PY + 14, w: BW, h: 62, title: `IT LOAD (${f.itMw} MW)`,
        sub: `${a.rackDensityKw} kW/rack${marginTxt}`, badge: ex.useCaseLabel?.slice(0, 10),
        lane: 'it', kind: 'itload',
        hover: `IT load ${f.itMw} MW · facility ${f.facilityMw} MW at PUE ${f.pue}${ex.slaPct ? ` · SLA ${ex.slaPct}%` : ''}${marginTxt}`,
    });
    cells.forEach((c) => edges.push({ from: c.id, to: 'itload', kind: 'normal' }));

    /* ── generation lane ── */
    const GY = PY + 152;
    blocks.push({ id: 'gens', x: COL_X(0), y: GY, w: BW, h: 46, title: 'Generation', sub: `${eq.generators}× gensets ${spare ? '(dual+spare)' : a.redundancy}`, glyphs: glyphCap(eq.generators), lane: 'gen', kind: 'genset', hover: `Standby generation — ${eq.generators} gensets, ${a.redundancy}` });
    blocks.push({ id: 'fuel', x: COL_X(1), y: GY, w: BW, h: 46, title: 'Fuel Farm', sub: `${a.fuelHours} h autonomy`, lane: 'gen', kind: 'fuel', hover: `Fuel storage — ${a.fuelHours} hours full-load autonomy` });
    edges.push({ from: 'fuel', to: 'gens', kind: 'backup' });
    edges.push({ from: 'gens', to: 'mvA', kind: 'backup' });
    if (dual) edges.push({ from: 'gens', to: 'mvB', kind: 'backup', offset: 5 });

    /* ── cooling lane ── */
    const CY = GY;
    if (liquid) {
        const loops = Math.max(1, paths);
        const cduPerLoop = Math.ceil(eq.pumps / Math.max(1, loops));
        blocks.push({ id: 'coolplant', x: COL_X(2), y: CY, w: BW, h: 46, title: 'CDU Plant (Liquid)', sub: `${loops}× loops · ${cduPerLoop} CDU/loop`, glyphs: glyphCap(loops), lane: 'cooling', kind: 'cdu', hover: `Liquid cooling — ${loops} CDU loops × ${cduPerLoop} CDUs` });
        blocks.push({ id: 'heatrej', x: COL_X(3), y: CY, w: BW, h: 46, title: 'Heat Rejection', sub: `${eq.chillers}× units`, lane: 'cooling', kind: 'coolingTower', hover: `Heat rejection — ${eq.chillers} units` });
        edges.push({ from: 'coolplant', to: 'heatrej', kind: 'coolSupply' });
        edges.push({ from: 'heatrej', to: 'coolplant', kind: 'coolReturn', offset: 6 });
        cells.forEach((c, i) => {
            edges.push({ from: 'coolplant', to: c.id, kind: 'coolSupply', offset: -6 - i * 3 });
        });
        edges.push({ from: cells[0]?.id ?? 'itload', to: 'coolplant', kind: 'coolReturn', offset: 10 });
    } else {
        blocks.push({ id: 'coolplant', x: COL_X(2), y: CY, w: BW, h: 46, title: 'Chiller Plant', sub: `${eq.chillers}× chillers ${a.redundancy}`, glyphs: glyphCap(eq.chillers), lane: 'cooling', kind: 'chiller', hover: `Chiller plant — ${eq.chillers} chillers, ${a.redundancy}` });
        blocks.push({ id: 'crah', x: COL_X(3), y: CY, w: BW, h: 46, title: 'CRAH / AHU', sub: `${eq.ahu + eq.cooling_units}× units`, lane: 'cooling', kind: 'crah', hover: `Air distribution — ${eq.ahu + eq.cooling_units} CRAH/AHU units` });
        edges.push({ from: 'coolplant', to: 'crah', kind: 'coolSupply' });
        edges.push({ from: 'crah', to: 'coolplant', kind: 'coolReturn', offset: 6 });
        edges.push({ from: 'crah', to: cells[0]?.id ?? 'itload', kind: 'coolSupply', offset: -6 });
    }

    /* ── network fabric + BMS ── */
    const leaf = Math.ceil(eq.racks / 16);
    blocks.push({ id: 'fabric', x: COL_X(4), y: CY, w: BW, h: 46, title: 'Network Fabric', sub: `spine/leaf · ~${leaf} leaf`, lane: 'it', kind: 'fabric', hover: `Spine/leaf fabric — ≈${leaf} leaf switches (1 per 16 racks)` });
    edges.push({ from: 'fabric', to: cells[0]?.id ?? 'itload', kind: 'control' });
    blocks.push({ id: 'bms', x: COL_X(5), y: CY, w: BW, h: 46, title: 'BMS & DCIM', sub: 'Monitor · Control · Alarm', lane: 'bms', kind: 'bms', hover: 'Building management + DCIM — monitoring/control edges (dashed green)' });
    edges.push({ from: 'bms', to: 'upsA', kind: 'control', offset: 8 });
    edges.push({ from: 'bms', to: 'coolplant', kind: 'control', offset: 12 });
    edges.push({ from: 'bms', to: 'mvA', kind: 'control', offset: 16 });

    /* ── group containment boxes (reference idiom) ── */
    groups.push({ x: COL_X(0) - 8, y: PY - 14, w: COL_W * 5 - 14, h: 158, title: `POWER TRAIN — ${a.redundancy} · ${paths} path${paths > 1 ? 's' : ''}`, lane: 'power' });
    groups.push({ x: COL_X(5) - 8, y: PY - 14, w: COL_W * 2 - 6, h: 158, title: `IT HALL — ${cells.length} cell${cells.length > 1 ? 's' : ''} · ${eq.racks.toLocaleString()} racks`, lane: 'it' });
    groups.push({ x: COL_X(0) - 8, y: GY - 14, w: COL_W * 2 - 14, h: 76, title: `GENERATION — ${eq.generators}× · ${a.fuelHours}h fuel`, lane: 'gen' });
    groups.push({ x: COL_X(2) - 8, y: CY - 14, w: COL_W * 2 - 14, h: 76, title: liquid ? `COOLING PLANT — ${Math.max(1, paths)} CDU loops` : `COOLING PLANT — ${eq.chillers} chillers`, lane: 'cooling' });
    groups.push({ x: COL_X(4) - 8, y: CY - 14, w: COL_W * 2 - 6, h: 76, title: 'NETWORK & CONTROL', lane: 'bms' });

    /* ── phase boxes (capacity growth) — dashed future phases under the diagram ── */
    let extraH = 0;
    if (ex.phases && ex.phases.length > 1) {
        const py2 = GY + 76;
        ex.phases.slice(0, 4).forEach((p, i) => {
            blocks.push({
                id: `phase${i}`, x: COL_X(2 + i), y: py2, w: BW, h: 30,
                title: p.label, sub: `${p.mw.toFixed(1)} MW${p.future ? ' · future' : ''}`,
                lane: 'it', hover: `${p.label} — ${p.mw.toFixed(1)} MW${p.future ? ' (planned growth phase)' : ' (current)'}`,
                badge: p.future ? 'PLAN' : 'NOW',
            });
        });
        groups.push({ x: COL_X(2) - 8, y: py2 - 14, w: COL_W * Math.min(4, ex.phases.length) - 6, h: 56, title: 'GROWTH PHASES (capacity plan)', lane: 'it' });
        extraH = 66;
    }

    return { blocks, edges, groups, buses, viewBox: [0, 0, 16 + 7 * COL_W + 8, GY + 76 + extraH] };
}
