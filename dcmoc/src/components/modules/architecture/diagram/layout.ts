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
    standby?: boolean;       // dashed-outline standby unit (off-line until a duty unit trips)
}

export interface DiagGroup { x: number; y: number; w: number; h: number; title: string; lane: DiagBlock['lane'] }
export interface DiagBus { x1: number; x2: number; y: number; label: string; spare?: boolean }
export interface DiagEdge { from: string; to: string; kind: EdgeKind; offset?: number; label?: string }

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
    /** Workstream K1 — CAPEX renewable selection: PV + BESS drawn when set. */
    renewables?: { option: string; solarMwp: number; bessMwh: number };
    /** Workstream K2 — deep-sea water cooling (CAPEX study inputs). */
    deepSea?: { enabled: boolean; depthM: number; pipelineKm: number; deltaTK: number };
}

/* Larger geometry: nodes are now symbols (~44px) + a two-line label below,
 * so cells are wider/taller than the old boxed glyphs. */
const COL_W = 176;
const COL_X = (i: number) => 20 + i * COL_W;
const BW = 148;           // cell width
const BH = 78;            // standard cell height (44 symbol + label lines)
const ROW_GAP = 20;       // vertical gap between paired A/B rows
const PY = 40;            // power-lane top
const SBW = 92;           // narrow dashed standby-unit cell width

/** Split an installed unit count into duty + standby per the redundancy key:
 *  N+1 keeps ONE unit in standby; 2N / 2N+1 hold a full second train (half
 *  the fleet) in standby. Duty is floored at 1 so per-unit maths never /0. */
function dutySplit(total: number, redKey: ArchInputs['redKey']): { duty: number; standby: number } {
    const t = Math.max(1, total);
    const standby = redKey === 'n1' ? (t > 1 ? 1 : 0) : Math.floor(t / 2);
    return { duty: Math.max(1, t - standby), standby };
}

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
        blocks.push({ id: 'txA', x: COL_X(2), y: PY, w: BW, h: BH, title: 'Transformers A', sub: `${txPer}× MV/LV · prim. disconnect`, units: txPer, glyphs: glyphCap(txPer), lane: 'power', kind: 'transformer', hover: `Transformer bank A — ${txPer}× ${a.gridVoltage}/LV — each unit has a primary disconnect switch + LV main breaker` });
        blocks.push({ id: 'txB', x: COL_X(2), y: PY + ROW2, w: BW, h: BH, title: 'Transformers B', sub: `${txPer}× MV/LV · prim. disconnect`, units: txPer, glyphs: glyphCap(txPer), lane: 'power', kind: 'transformer', hover: `Transformer bank B — ${txPer}× ${a.gridVoltage}/LV — each unit has a primary disconnect switch + LV main breaker` });
        edges.push({ from: 'mvA', to: 'txA', kind: 'normal' }, { from: 'mvB', to: 'txB', kind: 'normal' });
    } else {
        blocks.push({ id: 'txA', x: COL_X(2), y: single, w: BW, h: BH, title: 'Transformers', sub: `${txCount}× MV/LV · prim. disconnect`, units: txCount, glyphs: glyphCap(txCount), lane: 'power', kind: 'transformer', hover: `Transformers — ${txCount}× ${a.gridVoltage}/LV — each unit has a primary disconnect switch + LV main breaker` });
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
    /* 2N / 2N+1 — normally-open bus-tie breaker between BUS A and BUS B (visual
     * annotation on the bus span; closed only for maintenance transfer). */
    if (dual && a.redKey !== 'n1') {
        blocks.push({
            id: 'bustie', x: busX2 - 96, y: PY + BH / 2 + 10, w: 84, h: BH,
            title: 'Bus Tie (open)', sub: 'normally open', lane: 'power', kind: 'breaker',
            hover: 'Normally-open bus-tie breaker between BUS A and BUS B — closed only for a maintenance transfer so one train can carry the other\'s load without paralleling sources',
        });
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

    /* ── generation lane — gens → ATS → MV boards (fuel farm feeds back) ── */
    const itHallH = cells.length * (BH + 10);
    const GY = PY + Math.max(2 * ROW2, itHallH) + 40;   // lower lanes clear BOTH the power rows and the IT-HALL cells above
    blocks.push({ id: 'gens', x: COL_X(0), y: GY, w: BW, h: BH, title: 'Generation', sub: `${eq.generators}× gensets ${spare ? '(dual+spare)' : a.redundancy}`, badge: 'STANDBY', units: eq.generators, glyphs: glyphCap(eq.generators), lane: 'gen', kind: 'genset', hover: `Standby generation — ${eq.generators} gensets, ${a.redundancy}. Off-line in normal operation; on utility outage the ATS starts the plant and transfers the load` });
    blocks.push({ id: 'ats', x: COL_X(1), y: GY, w: BW, h: BH, title: 'ATS', sub: 'auto transfer · utility ↔ gen', badge: a.redundancy, lane: 'gen', kind: 'ats', hover: 'Automatic transfer switch — senses utility loss, signals genset start and transfers the MV boards to generation (NFPA 110 / UL 1008); retransfers on stable utility' });
    blocks.push({ id: 'fuel', x: COL_X(2), y: GY, w: BW, h: BH, title: 'Fuel Farm', sub: `${a.fuelHours} h autonomy`, lane: 'gen', kind: 'fuel', hover: `Fuel storage — ${a.fuelHours} hours full-load autonomy` });
    edges.push({ from: 'fuel', to: 'gens', kind: 'backup' });
    edges.push({ from: 'gens', to: 'ats', kind: 'backup' });
    edges.push({ from: 'ats', to: 'mvA', kind: 'backup' });
    if (dual) edges.push({ from: 'ats', to: 'mvB', kind: 'backup', offset: 5 });

    /* ── cooling lane (COL3-4 — COL2 is taken by the fuel farm after the ATS insert) ── */
    const CY = GY;
    if (liquid) {
        const loops = Math.max(1, paths);
        const cduPerLoop = Math.ceil(eq.pumps / Math.max(1, loops));
        blocks.push({ id: 'coolplant', x: COL_X(3), y: CY, w: BW, h: BH, title: 'CDU Plant (Liquid)', sub: `${loops}× loops · ${cduPerLoop} CDU/loop`, units: loops, glyphs: glyphCap(loops), lane: 'cooling', kind: 'cdu', hover: `Liquid cooling — ${loops} CDU loops × ${cduPerLoop} CDUs` });
        blocks.push({ id: 'heatrej', x: COL_X(4), y: CY, w: BW, h: BH, title: 'Heat Rejection', sub: `${eq.chillers}× units`, lane: 'cooling', kind: 'coolingTower', hover: `Heat rejection — ${eq.chillers} units` });
        edges.push({ from: 'coolplant', to: 'heatrej', kind: 'coolSupply' });
        edges.push({ from: 'heatrej', to: 'coolplant', kind: 'coolReturn', offset: 6 });
        cells.forEach((c, i) => {
            edges.push({ from: 'coolplant', to: c.id, kind: 'coolSupply', offset: -6 - i * 3 });
        });
        edges.push({ from: cells[0]?.id ?? 'itload', to: 'coolplant', kind: 'coolReturn', offset: 10 });
    } else {
        blocks.push({ id: 'coolplant', x: COL_X(3), y: CY, w: BW, h: BH, title: 'Chiller Plant', sub: `${eq.chillers}× chillers ${a.redundancy}`, units: eq.chillers, glyphs: glyphCap(eq.chillers), lane: 'cooling', kind: 'chiller', hover: `Chiller plant — ${eq.chillers} chillers, ${a.redundancy}` });
        blocks.push({ id: 'crah', x: COL_X(4), y: CY, w: BW, h: BH, title: 'CRAH / AHU', sub: `${eq.ahu + eq.cooling_units}× units`, lane: 'cooling', kind: 'crah', hover: `Air distribution — ${eq.ahu + eq.cooling_units} CRAH/AHU units` });
        edges.push({ from: 'coolplant', to: 'crah', kind: 'coolSupply' });
        edges.push({ from: 'crah', to: 'coolplant', kind: 'coolReturn', offset: 6 });
        edges.push({ from: 'crah', to: cells[0]?.id ?? 'itload', kind: 'coolSupply', offset: -6 });
    }

    /* ── network fabric + BMS (COL5-6 after the lane reflow) ── */
    const leaf = Math.ceil(eq.racks / 16);
    blocks.push({ id: 'fabric', x: COL_X(5), y: CY, w: BW, h: BH, title: 'Network Fabric', sub: `spine/leaf · ~${leaf} leaf`, lane: 'it', kind: 'fabric', hover: `Spine/leaf fabric — ≈${leaf} leaf switches (1 per 16 racks)` });
    edges.push({ from: 'fabric', to: cells[0]?.id ?? 'itload', kind: 'control' });
    blocks.push({ id: 'bms', x: COL_X(6), y: CY, w: BW, h: BH, title: 'BMS & DCIM', sub: 'Monitor · Control · Alarm', lane: 'bms', kind: 'bms', hover: 'Building management + DCIM — monitoring/control edges (dashed green)' });
    edges.push({ from: 'bms', to: 'upsA', kind: 'control', offset: 8 });
    edges.push({ from: 'bms', to: 'coolplant', kind: 'control', offset: 12 });
    edges.push({ from: 'bms', to: 'mvA', kind: 'control', offset: 16 });

    /* ── group containment boxes (reference idiom) — labelled group boxes ── */
    const powerH = 2 * ROW2 + 8;
    groups.push({ x: COL_X(0) - 12, y: PY - 22, w: COL_W * 5 - 18, h: powerH, title: `POWER TRAIN — ${a.redundancy} · ${paths} path${paths > 1 ? 's' : ''}`, lane: 'power' });
    groups.push({ x: COL_X(5) - 12, y: PY - 22, w: COL_W * 2 - 10, h: Math.max(powerH, itHallH + 4), title: `IT HALL — ${cells.length} cell${cells.length > 1 ? 's' : ''} · ${eq.racks.toLocaleString()} racks`, lane: 'it' });
    const lowerH = BH + 26;
    groups.push({ x: COL_X(0) - 12, y: GY - 22, w: COL_W * 3 - 18, h: lowerH, title: `GENERATION — ${eq.generators}× · ${a.fuelHours}h fuel`, lane: 'gen' });
    groups.push({ x: COL_X(3) - 12, y: CY - 22, w: COL_W * 2 - 18, h: lowerH, title: liquid ? `COOLING PLANT — ${Math.max(1, paths)} CDU loops` : `COOLING PLANT — ${eq.chillers} chillers`, lane: 'cooling' });
    groups.push({ x: COL_X(5) - 12, y: CY - 22, w: COL_W * 2 - 10, h: lowerH, title: 'NETWORK & CONTROL', lane: 'bms' });

    /* ── phase boxes (capacity growth) — dashed future phases under the diagram ── */
    let extraH = 0;
    const hasPhases = !!(ex.phases && ex.phases.length > 1);
    const hasRenew = !!(ex.renewables && ex.renewables.option && ex.renewables.option !== 'none');
    const py2 = GY + BH + 40;
    if (hasPhases) {
        ex.phases!.slice(0, 4).forEach((p, i) => {
            blocks.push({
                id: `phase${i}`, x: COL_X(2 + i), y: py2, w: BW, h: 44,
                title: p.label, sub: `${p.mw.toFixed(1)} MW${p.future ? ' · future' : ''}`,
                lane: 'it', hover: `${p.label} — ${p.mw.toFixed(1)} MW${p.future ? ' (planned growth phase)' : ' (current)'}`,
                badge: p.future ? 'PLAN' : 'NOW',
            });
        });
        groups.push({ x: COL_X(2) - 12, y: py2 - 22, w: COL_W * Math.min(4, ex.phases!.length) - 10, h: 72, title: 'GROWTH PHASES (capacity plan)', lane: 'it' });
        extraH = 84;
    }
    /* ── on-site renewables (Workstream K1) — PV array + BESS/PCS tie into the
     * MV bus. Drawn from the CAPEX renewable selection; owner: BESS must SHOW
     * when selected. Occupies the row under GENERATION (coexists with phases). ── */
    if (hasRenew) {
        const rn = ex.renewables!;
        const hasPv = rn.option.includes('solar');
        if (hasPv) {
            blocks.push({
                id: 'pv', x: COL_X(0), y: py2, w: BW, h: BH, title: 'Solar PV Array', sub: `${rn.solarMwp || '—'} MWp on-site`,
                badge: `${rn.solarMwp || '?'} MWp`, lane: 'gen', kind: 'solarArray',
                hover: `On-site solar PV — ${rn.solarMwp || 'unsized'} MWp (CAPEX renewable option: ${rn.option})`,
            });
        }
        blocks.push({
            id: 'bess', x: COL_X(1), y: py2, w: BW, h: BH, title: 'BESS + PCS', sub: `${rn.bessMwh || '—'} MWh storage`,
            badge: `${rn.bessMwh || '?'} MWh`, lane: 'gen', kind: 'battery',
            hover: `Battery energy storage — ${rn.bessMwh || 'unsized'} MWh with power conversion system (PCS), grid-tied at the MV bus`,
        });
        if (hasPv) edges.push({ from: 'pv', to: 'bess', kind: 'normal', offset: 0 });
        edges.push({ from: 'bess', to: 'mvA', kind: 'backup', offset: 12 });
        groups.push({ x: COL_X(0) - 12, y: py2 - 22, w: COL_W * 2 - 18, h: BH + 28, title: `ON-SITE RENEWABLES — ${hasPv ? `${rn.solarMwp || '?'} MWp PV · ` : ''}${rn.bessMwh || '?'} MWh BESS`, lane: 'gen' });
        extraH = Math.max(extraH, BH + 44);
    }

    return { blocks, edges, groups, buses, viewBox: [0, 0, 20 + 7 * COL_W + 12, GY + BH + 40 + extraH] };
}

/* ═══ Workstream K2 — Mechanical & Cooling schematic ═════════════════════════
 * A dedicated cooling/mechanical diagram (third Architecture view). Left→right
 * heat flow: HEAT REJECTION → PLANT/EXCHANGE → DISTRIBUTION → IT HEAT LOAD,
 * with supply (solid teal) and return (dashed teal) loop edges. Fully dynamic:
 * cooling technology picks the chain (chiller/CRAH vs CDU loops vs deep-sea
 * chiller-less), unit counts from equipScale, duty from the facility calc. ═══ */
export function computeCoolingLayout(a: ArchInputs, eq: EquipCounts, f: FacilityCalc, ex: LayoutExtras = {}): DiagramModel {
    const blocks: DiagBlock[] = [];
    const edges: DiagEdge[] = [];
    const groups: DiagGroup[] = [];
    const liquid = a.coolingType === 'liquid' || a.coolingType === 'rdhx';
    const deep = !!ex.deepSea?.enabled;
    const itMw = f.itMw;
    const paths = f.paths;
    const RY = 60;                    // main loop row
    const RY2 = RY + BH + 34;         // pumps row
    const loops = Math.max(1, paths);
    const dutyPerLoop = (itMw / loops).toFixed(1);

    /* Loop engineering labels — supply/return °C from the design setpoints and
     * a screening volumetric flow from Q = ṁ·cp·ΔT (water): MW·860/ΔT ≈ m³/h. */
    const dT = Math.max(1, deep ? (ex.deepSea!.deltaTK || 1) : (a.deltaTK ?? 12));
    const flowM3h = Math.round(itMw * 860 / dT);
    const supplyLbl = `supply ${a.supplyTempC}°C`;
    const returnLbl = `return ${a.supplyTempC + dT}°C · ~${flowM3h.toLocaleString()} m³/h`;

    if (deep) {
        const ds = ex.deepSea!;
        const swp = dutySplit(Math.max(2, eq.pumps), a.redKey);
        blocks.push({ id: 'intake', x: COL_X(0), y: RY, w: BW, h: BH, title: 'Seawater Intake', sub: `${ds.depthM} m depth · cold source`, badge: `${ds.depthM} m`, lane: 'cooling', kind: 'pump', hover: `Deep-sea intake at ${ds.depthM} m — naturally cold seawater, chiller-less basis (PUE ≤ 1.15). Warmed water returns to sea via the outfall diffuser at +${dT} K above intake` });
        blocks.push({ id: 'hx', x: COL_X(1), y: RY, w: BW, h: BH, title: 'Titanium Plate HX', sub: `ΔT ${ds.deltaTK} K · seawater/coolant`, lane: 'cooling', kind: 'heatExchanger', hover: `Seawater-to-coolant plate heat exchanger — loop ΔT ${ds.deltaTK} K, isolates the marine loop from the IT loop` });
        blocks.push({ id: 'cdu', x: COL_X(2), y: RY, w: BW, h: BH, title: 'CDU Loops', sub: `${loops}× loops · ${dutyPerLoop} MW/loop`, units: loops, lane: 'cooling', kind: 'cdu', hover: `Coolant distribution — ${loops} loops, ${dutyPerLoop} MW heat each` });
        blocks.push({ id: 'pumps', x: COL_X(1), y: RY2, w: BW, h: BH, title: 'Seawater Pumps', sub: `${swp.duty}× duty + ${swp.standby} standby · pipeline ${ds.pipelineKm} km`, units: Math.max(2, eq.pumps), lane: 'cooling', kind: 'pump', hover: `Seawater circulation pumps — ${swp.duty} duty + ${swp.standby} standby (${a.redundancy}), ${ds.pipelineKm} km intake/outfall pipeline` });
        blocks.push({ id: 'sbpump', x: COL_X(0), y: RY2, w: SBW, h: BH, title: 'Standby Pump', sub: 'auto-start on trip', badge: 'STANDBY', standby: true, lane: 'cooling', kind: 'pump', hover: 'Standby seawater pump — off-line until a duty pump trips; automatic changeover keeps marine-loop flow' });
        blocks.push({ id: 'itheat', x: COL_X(4), y: RY, w: BW, h: BH, title: 'IT Heat Load', sub: `${itMw.toFixed(1)} MW heat @ ${a.rackDensityKw} kW/rack`, badge: `${itMw.toFixed(1)} MW`, lane: 'it', kind: 'itload', hover: `IT heat rejected to the loop — ${itMw.toFixed(1)} MW (heat = IT power, not IT × PUE)` });
        edges.push({ from: 'intake', to: 'hx', kind: 'coolSupply' });
        edges.push({ from: 'hx', to: 'cdu', kind: 'coolSupply' });
        edges.push({ from: 'cdu', to: 'itheat', kind: 'coolSupply', label: supplyLbl });
        edges.push({ from: 'itheat', to: 'cdu', kind: 'coolReturn', offset: 10, label: returnLbl });
        edges.push({ from: 'cdu', to: 'hx', kind: 'coolReturn', offset: 10 });
        edges.push({ from: 'hx', to: 'intake', kind: 'coolReturn', offset: 10, label: `outfall +${dT} K` });
        edges.push({ from: 'pumps', to: 'hx', kind: 'control' });
        edges.push({ from: 'sbpump', to: 'pumps', kind: 'backup' });
        groups.push({ x: COL_X(0) - 12, y: RY - 22, w: COL_W * 2 - 18, h: (BH + 34) * 2, title: `MARINE LOOP — ${ds.depthM} m · ${ds.pipelineKm} km pipeline`, lane: 'cooling' });
        groups.push({ x: COL_X(2) - 12, y: RY - 22, w: COL_W * 2 - 18, h: BH + 30, title: `DISTRIBUTION — ${loops} CDU loops`, lane: 'cooling' });
        groups.push({ x: COL_X(4) - 12, y: RY - 22, w: COL_W * 2 - 10, h: BH + 30, title: `IT HEAT LOAD — ${itMw.toFixed(1)} MW`, lane: 'it' });
    } else if (liquid) {
        const dcS = dutySplit(eq.chillers, a.redKey);
        const pp = dutySplit(Math.max(2, Math.ceil(eq.pumps / 2)), a.redKey);
        const sp = dutySplit(Math.max(2, Math.floor(eq.pumps / 2)), a.redKey);
        const crahR = eq.ahu + eq.cooling_units;
        blocks.push({ id: 'heatrej', x: COL_X(0), y: RY, w: BW, h: BH, title: 'Dry Coolers', sub: `${dcS.duty}× duty + ${dcS.standby} standby (${a.redundancy})`, badge: a.redundancy, units: eq.chillers, lane: 'cooling', kind: 'dryCooler', hover: `Heat rejection — ${eq.chillers} dry coolers (${dcS.duty} duty + ${dcS.standby} standby) dissipating ${itMw.toFixed(1)} MW to ambient ≈ ${(itMw / dcS.duty).toFixed(1)} MW/unit duty` });
        blocks.push({ id: 'hx', x: COL_X(1), y: RY, w: BW, h: BH, title: 'Plate HX / TCS', sub: 'facility ↔ technology loop', lane: 'cooling', kind: 'heatExchanger', hover: 'Facility-water to technology-coolant exchange (FWS/TCS separation)' });
        blocks.push({ id: 'ppumps', x: COL_X(0), y: RY2, w: BW, h: BH, title: 'Primary Pumps', sub: `${pp.duty}× duty + ${pp.standby} standby · facility loop`, units: Math.max(2, Math.ceil(eq.pumps / 2)), lane: 'cooling', kind: 'pump', hover: `Facility-water loop circulation — ${pp.duty} duty + ${pp.standby} standby pump sets (${a.redundancy})` });
        blocks.push({ id: 'sbdry', x: COL_X(1), y: RY2, w: SBW, h: BH, title: 'Standby Unit', sub: 'auto-start on trip', badge: 'STANDBY', standby: true, lane: 'cooling', kind: 'dryCooler', hover: 'Standby dry cooler — off-line until a duty unit trips; automatic changeover holds full heat-rejection capacity' });
        blocks.push({ id: 'cdu', x: COL_X(2), y: RY, w: BW, h: BH, title: a.coolingType === 'rdhx' ? 'RDHx Doors' : 'CDU Loops', sub: `${loops}× loops · ${dutyPerLoop} MW/loop`, units: loops, lane: 'cooling', kind: 'cdu', hover: `${a.coolingType === 'rdhx' ? 'Rear-door heat exchangers' : 'Coolant distribution units'} — ${loops} loops × ${dutyPerLoop} MW` });
        blocks.push({ id: 'spumps', x: COL_X(2), y: RY2, w: BW, h: BH, title: 'Secondary Pumps', sub: `${sp.duty}× duty + ${sp.standby} standby · technology loop`, units: Math.max(2, Math.floor(eq.pumps / 2)), lane: 'cooling', kind: 'pump', hover: `Technology-coolant loop circulation to the racks — ${sp.duty} duty + ${sp.standby} standby (${a.redundancy})` });
        blocks.push({ id: 'crahR', x: COL_X(3), y: RY2, w: BW, h: BH, title: 'CRAH (Residual Air)', sub: `${crahR}× units · residual air ~25% heat`, units: crahR, lane: 'cooling', kind: 'crah', hover: `Residual air loop — direct-to-chip captures ~75% of the heat; the remaining ~25% (VRMs, DIMMs, drives, room losses) is removed by ${crahR} CRAH/AHU units` });
        blocks.push({ id: 'itheat', x: COL_X(4), y: RY, w: BW, h: BH, title: 'IT Heat Load', sub: `${itMw.toFixed(1)} MW @ ${a.rackDensityKw} kW/rack · ${a.supplyTempC}°C supply`, badge: `${itMw.toFixed(1)} MW`, lane: 'it', kind: 'itload', hover: `Direct-to-chip heat capture — ${itMw.toFixed(1)} MW at ${a.supplyTempC}°C supply, ΔT ${a.deltaTK ?? 12} K` });
        edges.push({ from: 'heatrej', to: 'hx', kind: 'coolSupply' });
        edges.push({ from: 'hx', to: 'cdu', kind: 'coolSupply' });
        edges.push({ from: 'cdu', to: 'itheat', kind: 'coolSupply', label: supplyLbl });
        edges.push({ from: 'itheat', to: 'cdu', kind: 'coolReturn', offset: 10, label: returnLbl });
        edges.push({ from: 'cdu', to: 'hx', kind: 'coolReturn', offset: 10 });
        edges.push({ from: 'hx', to: 'heatrej', kind: 'coolReturn', offset: 10 });
        edges.push({ from: 'ppumps', to: 'hx', kind: 'control' });
        edges.push({ from: 'spumps', to: 'cdu', kind: 'control' });
        edges.push({ from: 'sbdry', to: 'heatrej', kind: 'backup' });
        edges.push({ from: 'crahR', to: 'itheat', kind: 'coolSupply' });
        edges.push({ from: 'itheat', to: 'crahR', kind: 'coolReturn', offset: 14 });
        groups.push({ x: COL_X(0) - 12, y: RY - 22, w: COL_W * 2 - 18, h: (BH + 34) * 2, title: `FACILITY LOOP — ${eq.chillers}× dry coolers`, lane: 'cooling' });
        groups.push({ x: COL_X(2) - 12, y: RY - 22, w: COL_W - 18, h: (BH + 34) * 2, title: `TECHNOLOGY LOOP — ${loops} loops · ${dutyPerLoop} MW each`, lane: 'cooling' });
        groups.push({ x: COL_X(3) - 12, y: RY2 - 22, w: COL_W - 18, h: BH + 30, title: 'RESIDUAL AIR LOOP', lane: 'cooling' });
        groups.push({ x: COL_X(4) - 12, y: RY - 22, w: COL_W * 2 - 10, h: BH + 30, title: `IT HEAT LOAD — ${itMw.toFixed(1)} MW`, lane: 'it' });
    } else {
        const crahN = eq.ahu + eq.cooling_units;
        const chl = dutySplit(eq.chillers, a.redKey);
        const cwp = dutySplit(Math.max(2, eq.pumps), a.redKey);
        blocks.push({ id: 'tower', x: COL_X(0), y: RY, w: BW, h: BH, title: 'Cooling Towers', sub: `condenser water loop`, units: Math.max(2, Math.ceil(eq.chillers / 2)), lane: 'cooling', kind: 'coolingTower', hover: 'Condenser-water heat rejection to ambient (evaporative)' });
        blocks.push({ id: 'chiller', x: COL_X(1), y: RY, w: BW, h: BH, title: 'Chillers', sub: `${chl.duty}× duty + ${chl.standby} standby (${a.redundancy})`, badge: a.redundancy, units: eq.chillers, lane: 'cooling', kind: 'chiller', hover: `Water-cooled chillers — ${eq.chillers} units at ${a.redundancy} (${chl.duty} duty + ${chl.standby} standby), duty ${itMw.toFixed(1)} MW ≈ ${(itMw / chl.duty).toFixed(1)} MW/unit duty` });
        blocks.push({ id: 'chwpumps', x: COL_X(1), y: RY2, w: BW, h: BH, title: 'CHW Pumps', sub: `${cwp.duty}× duty + ${cwp.standby} standby · chilled water`, units: Math.max(2, eq.pumps), lane: 'cooling', kind: 'pump', hover: `Chilled-water circulation — ${cwp.duty} duty + ${cwp.standby} standby (primary/secondary, ${a.redundancy})` });
        blocks.push({ id: 'sbchiller', x: COL_X(0), y: RY2, w: SBW, h: BH, title: 'Standby Unit', sub: 'auto-start on trip', badge: 'STANDBY', standby: true, lane: 'cooling', kind: 'chiller', hover: 'Standby chiller — off-line until a duty machine trips; automatic changeover holds full chilled-water capacity' });
        blocks.push({ id: 'crah', x: COL_X(2), y: RY, w: BW, h: BH, title: a.coolingType === 'inrow' ? 'In-Row Coolers' : 'CRAH Units', sub: `${crahN}× hall units`, units: crahN, lane: 'cooling', kind: 'crah', hover: `${a.coolingType === 'inrow' ? 'In-row cooling units' : 'Computer-room air handlers'} — ${crahN} units serving the halls` });
        blocks.push({ id: 'itheat', x: COL_X(4), y: RY, w: BW, h: BH, title: 'IT Heat Load', sub: `${itMw.toFixed(1)} MW @ ${a.rackDensityKw} kW/rack · ${a.supplyTempC}°C air`, badge: `${itMw.toFixed(1)} MW`, lane: 'it', kind: 'itload', hover: `Hall air heat — ${itMw.toFixed(1)} MW, ${a.supplyTempC}°C supply air (ASHRAE class)` });
        edges.push({ from: 'tower', to: 'chiller', kind: 'coolSupply' });
        edges.push({ from: 'chiller', to: 'tower', kind: 'coolReturn', offset: 10 });
        edges.push({ from: 'chiller', to: 'crah', kind: 'coolSupply', label: supplyLbl });
        edges.push({ from: 'crah', to: 'chiller', kind: 'coolReturn', offset: 10, label: returnLbl });
        edges.push({ from: 'crah', to: 'itheat', kind: 'coolSupply' });
        edges.push({ from: 'itheat', to: 'crah', kind: 'coolReturn', offset: 10 });
        edges.push({ from: 'chwpumps', to: 'chiller', kind: 'control' });
        edges.push({ from: 'sbchiller', to: 'chiller', kind: 'backup' });
        groups.push({ x: COL_X(0) - 12, y: RY - 22, w: COL_W * 2 - 18, h: (BH + 34) * 2, title: `CHILLER PLANT — ${eq.chillers}× chillers · ${a.redundancy}`, lane: 'cooling' });
        groups.push({ x: COL_X(2) - 12, y: RY - 22, w: COL_W * 2 - 18, h: BH + 30, title: `AIR DISTRIBUTION — ${crahN}× units`, lane: 'cooling' });
        groups.push({ x: COL_X(4) - 12, y: RY - 22, w: COL_W * 2 - 10, h: BH + 30, title: `IT HEAT LOAD — ${itMw.toFixed(1)} MW`, lane: 'it' });
    }

    return { blocks, edges, groups, buses: [], viewBox: [0, 0, 20 + 7 * COL_W + 12, RY2 + BH + 50] };
}
