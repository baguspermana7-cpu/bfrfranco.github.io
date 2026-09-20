#!/usr/bin/env node
/* ============================================================================
 * demo-rz-diagram.mjs — one real cockpit diagram, drawn through the engine
 * ----------------------------------------------------------------------------
 * Subject: the liquid-cooling loop on datahallAI.html.
 *
 * The first version of this file drew five identical boxes in a straight line
 * and was fairly called vibe-coded. Two things were wrong with it, and only one
 * of them was visual:
 *
 *   1. Identical boxes for every node is the FIRST item on the diagram-design
 *      anti-pattern list. It erases hierarchy: nothing tells the reader which
 *      box is the point of the drawing. The reference examples give every node
 *      a treatment that means something — focal, store, external, backend — and
 *      close with a legend that says what each one is.
 *
 *   2. A cooling chain is a LOOP, not a conveyor belt. Heat leaves the racks,
 *      crosses two heat exchangers and is rejected to air; the water comes back
 *      cold. Drawing one arrow per link says the water leaves and never
 *      returns, which is not what the plant does. Two pipes per link, hot above
 *      and cold below, is how this is drawn on paper and it is also the truth.
 *
 * Geometry is still the engine's: every box is sized from its own text, every
 * connector is routed, every label is placed by search, and the script measures
 * its own output for collisions before it writes anything.
 * ==========================================================================*/
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const sandbox = { module: { exports: {} }, console };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const rel of ['js/rz-diagram-metrics.js', 'js/rz-diagram-layout.js', 'js/rz-diagram.js']) {
  vm.runInContext(readFileSync(join(root, rel), 'utf8'), sandbox, { filename: rel });
}
const { RZDiagram: D, RZDiagramMetrics: M, RZDiagramLayout: L } = sandbox;

/* Engine values as the page renders them at the 500 MW GB300 design point. */
const E = {
  cduInstalled: 55, cduRunning: 54, cduModel: 'CoolIT CHx1000',
  tcsSupply: 32.0, tcsReturn: 50.0,
  htwSupply: 27.0, htwReturn: 45.0,
  cdwSupply: 31.0, cdwReturn: 41.0,
  racksPerHall: 440, kwPerRack: 142,
  liquidCapturePct: 85
};

/* ---- node treatments ----------------------------------------------------
 * From the style guide's "node type -> treatment" table, in this brand's
 * tokens. The point of the table is that the treatment carries meaning, so the
 * legend at the foot of the drawing names every one that is used and nothing
 * that is not.
 * --------------------------------------------------------------------- */
const TYPE = {
  load:     { stroke: 'alarm-normal', fill: 'paper',   tier: 2, legend: 'IT load' },
  focal:    { stroke: 'accent',       fill: 'paper-2', tier: 1, legend: 'Heat exchanger — the transfer this drawing is about' },
  plant:    { stroke: 'link',         fill: 'paper',   tier: 2, legend: 'Plant' },
  reject:   { stroke: 'muted',        fill: 'paper',   tier: 2, legend: 'Heat rejection — outside the hall' },
  air:      { stroke: 'soft',         fill: 'paper',   tier: 3, dashed: true, legend: 'Air side — the fraction the liquid path does not carry' }
};

const ctx = D.create({
  width: 1200, height: 560, slug: 'rzcool',
  title: 'Liquid cooling loop — one hall',
  desc: 'Heat leaves the NVL72 racks in the technology cooling loop, crosses the CDU array into ' +
        'the facility water loop, and is rejected at the dry coolers. Each link is drawn as two ' +
        'pipes: the hot stream running out along the top and the cold stream returning along the ' +
        'bottom. Eighty-five per cent of the hall IT load takes this path; the rest is air.'
});

/* ---- the chain ----------------------------------------------------------
 * Four nodes, because the FWS pump station and the chiller plant always travel
 * together and the style guide says two nodes that always travel together are
 * one node. The pumps become a sublabel.
 * --------------------------------------------------------------------- */
const ROW = 84;   /* fit() crops the bottom-right only, so the content starts near the top itself */
const NODE_H = 76;

/* The gap has to hold an arrow label on BOTH pipes plus clearance, so it is
 * derived from the widest of them rather than chosen. */
const PIPE_LABELS = [
  'TCS ' + E.tcsReturn.toFixed(1) + '°C', 'TCS ' + E.tcsSupply.toFixed(1) + '°C',
  'HTW ' + E.htwReturn.toFixed(1) + '°C', 'HTW ' + E.htwSupply.toFixed(1) + '°C',
  'CDW ' + E.cdwReturn.toFixed(1) + '°C', 'CDW ' + E.cdwSupply.toFixed(1) + '°C'
];
const GAP = M.grid4(Math.max(...PIPE_LABELS.map(
  s => M.textWidth(s.toUpperCase(), 8, 'mono', { tracking: 0.06 }))) + 24);

let x = 56;
const used = new Set();
function link(type, o) {
  used.add(type);
  const t = TYPE[type];
  const box = ctx.node(x, ROW, Object.assign({ h: NODE_H, tier: t.tier, dashed: t.dashed,
                                               stroke: t.stroke, fill: t.fill }, o));
  x = box.x + box.w + GAP;
  return box;
}

const racks = link('load', {
  id: 'racks', tag: 'load', name: 'NVL72 RACKS',
  sublabel: E.racksPerHall + ' × ' + E.kwPerRack + ' kW'
});

const cdu = link('focal', {
  id: 'cdu', tag: 'l2l', name: 'CDU ARRAY',
  sublabel: E.cduRunning + '/' + E.cduInstalled + ' duty · ' + E.cduModel
});

const plant = link('plant', {
  id: 'plant', tag: 'plant', name: 'CHILLER PLANT',
  sublabel: 'FWS pumps · residual air load'
});

const dry = link('reject', {
  id: 'dry', tag: 'reject', name: 'DRY COOLERS',
  sublabel: 'ambient rejection'
});

/* Air side: the 15 % the liquid path does not carry. */
const crah = ctx.node(racks.x, ROW + 168, {
  id: 'crah', tag: 'air', name: 'CRAH BANKS',
  sublabel: (100 - E.liquidCapturePct) + ' % of hall IT',
  w: racks.w, stroke: TYPE.air.stroke, fill: TYPE.air.fill, tier: TYPE.air.tier, dashed: true
});
used.add('air');

/* The boundary follows the content: the racks, the CDU and the air handlers are
 * indoors; rejection is not. Declared last because both its edges come from
 * where the drawing ended up. */
ctx.zone(32, ROW - 56, (plant.x + plant.w + 24) - 32, (crah.y + crah.h + 28) - (ROW - 56),
  { label: 'inside the hall', tier: 3 });

/* ---- the two pipes per link ---------------------------------------------
 * Hot stream along the top edge band, cold stream along the bottom, each on its
 * own attach point per rule 4. fanPoints places them: point 1 at h/3, point 2
 * at 2h/3, which is 25 units apart on a 76-tall node — comfortably past the
 * 12-unit minimum.
 * --------------------------------------------------------------------- */
function pipes(a, b, hotLabel, coldLabel) {
  const ar = L.fanPoints(a, 2, 'right');
  const bl = L.fanPoints(b, 2, 'left');
  /* hot: out of the load, toward rejection */
  ctx.edge({ x: ar[0].x, y: ar[0].y }, { x: bl[0].x, y: bl[0].y }, {
    fromId: a.id, toId: b.id, stroke: 'alarm-caution', tier: 2, label: hotLabel
  });
  /* cold: returning. Drawn right-to-left so the arrowhead points the way the
   * water actually goes; a return pipe with a forward arrow is just wrong. */
  ctx.edge({ x: bl[1].x, y: bl[1].y }, { x: ar[1].x, y: ar[1].y }, {
    fromId: b.id, toId: a.id, stroke: 'link', tier: 2, label: coldLabel
  });
}

pipes(racks, cdu, 'TCS ' + E.tcsReturn.toFixed(1) + '°C', 'TCS ' + E.tcsSupply.toFixed(1) + '°C');
pipes(cdu, plant, 'HTW ' + E.htwReturn.toFixed(1) + '°C', 'HTW ' + E.htwSupply.toFixed(1) + '°C');
pipes(plant, dry, 'CDW ' + E.cdwReturn.toFixed(1) + '°C', 'CDW ' + E.cdwSupply.toFixed(1) + '°C');

/* Air side hangs off the bottom of the racks. Dashed, because it is the path
 * this drawing is NOT about. */
ctx.edge({ x: racks.x + racks.w / 2, y: racks.y + racks.h },
         { x: crah.x + crah.w / 2, y: crah.y }, {
  fromId: 'racks', toId: 'crah', stroke: 'soft', tier: 3, dashed: true,
  label: 'air ' + (100 - E.liquidCapturePct) + '%'
});

/* ---- legend -------------------------------------------------------------
 * A horizontal strip at the foot, after every node, never floating inside the
 * drawing. It names each treatment actually used and each stroke, and nothing
 * else — a legend with an entry the drawing does not contain is noise.
 * --------------------------------------------------------------------- */
const LEG_Y = crah.y + crah.h + 76;
ctx.legend = true;
const legendItems = [
  { kind: 'swatch', stroke: 'accent', text: 'CDU — the transfer' },
  { kind: 'swatch', stroke: 'alarm-normal', text: 'IT load' },
  { kind: 'swatch', stroke: 'link', text: 'Plant' },
  { kind: 'swatch', stroke: 'muted', text: 'Rejection (outdoors)' },
  { kind: 'line', stroke: 'alarm-caution', text: 'Hot stream, out' },
  { kind: 'line', stroke: 'link', text: 'Cold stream, returning' },
  { kind: 'dash', stroke: 'soft', text: 'Air side, 15 %' }
];

const svgParts = [];
svgParts.push(`<line x1="32" y1="${LEG_Y - 22}" x2="${1200 - 32}" y2="${LEG_Y - 22}" stroke="${D.token('rule')}" stroke-width="0.8"/>`);
ctx.text('LEGEND', 32, LEG_Y - 6, { role: 'eyebrow', fill: 'soft' });

let lx = 32;
for (const item of legendItems) {
  const label = item.text;
  const w = M.textWidth(label, 9, 'sans') + 34;
  if (item.kind === 'swatch') {
    svgParts.push(`<rect x="${lx}" y="${LEG_Y + 8}" width="14" height="10" rx="2" fill="none" stroke="${D.token(item.stroke)}" stroke-width="1.4"/>`);
  } else {
    svgParts.push(`<line x1="${lx}" y1="${LEG_Y + 13}" x2="${lx + 16}" y2="${LEG_Y + 13}" stroke="${D.token(item.stroke)}" stroke-width="1.4"${item.kind === 'dash' ? ' stroke-dasharray="4,3"' : ''}/>`);
  }
  ctx.text(label, lx + 22, LEG_Y + 17, { role: 'sublabel', size: 9, fill: 'muted' });
  lx += w + 22;
}

ctx.fit(32);
let svg = ctx.render();
/* the legend rules and swatches are chrome, not measured content: inject them
 * just before the closing tag so they sit above the zone fill and below nothing */
svg = svg.replace('</svg>', svgParts.join('') + '</svg>');

/* ---- self-audit ---------------------------------------------------------
 * The engine measured every box it drew, so it can answer without a browser
 * the question the render gate spends nine minutes on.
 * --------------------------------------------------------------------- */
const boxes = ctx.occupancy.items.filter(i => i.meta.kind === 'text' || i.meta.kind === 'node');
const collisions = [];
for (let i = 0; i < boxes.length; i++) {
  for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (M.contains(a.box, b.box) || M.contains(b.box, a.box)) continue;  /* badge chip */
    const ov = M.overlap(a.box, b.box);
    if (ov && ov.ox > 0.5 && ov.oy > 0.5) {
      collisions.push(`${a.meta.kind}:${a.meta.id} x ${b.meta.kind}:${b.meta.id} ` +
                      `overlap ${ov.ox.toFixed(1)}x${ov.oy.toFixed(1)}`);
    }
  }
}

const outArg = process.argv.find(a => a.startsWith('--out='));
const out = outArg ? outArg.split('=')[1] : join(root, 'tools', '_rz-diagram-demo.html');

const page = `<title>Liquid Cooling Loop</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* TOKEN CONTRACT. The engine resolves every colour to one of these custom
   properties and emits no literal hex, so a page that adopts it must define the
   whole set: --bg1 (paper), --bg3 (paper-2), --t1/--t2/--t3 (ink/muted/soft),
   --bd/--bd2 (rules), --o (accent + caution), --c (link + info), --g (normal),
   --r (fault). The first cut of this page called the panel colour --panel; the
   engine asked for --bg3, the variable did not exist, and the focal node's fill
   resolved to an invalid value — invisible against dark paper and solid black
   against light. A missing custom property fails silently in exactly one theme.

   Dark-first on purpose: this is an engineering instrument surface and the dark
   face is the product. The light face is the document register and is re-picked
   against white, never inverted — signal amber reads 1.8:1 on paper. */
:root{
  --bg:#070b14; --bg1:#0b1018; --bg3:#141b29; --bd:#1c2434; --bd2:#2c3549;
  --t1:#e6eaf0; --t2:#8b93a2; --t3:#69727f;
  --g:#22c55e; --c:#3ba3c9; --o:#e0952a; --r:#ef4444; --p:#64748b;
}
@media (prefers-color-scheme: light){
  :root:not([data-theme="dark"]){
    --bg:#eef1f5; --bg1:#ffffff; --bg3:#e6eaf0; --bd:#d2d8e0; --bd2:#a6b0bd;
    --t1:#111823; --t2:#4a5462; --t3:#6b7480;
    --g:#15803d; --c:#0e6f8e; --o:#8a5a00; --r:#b91c1c; --p:#64748b;
  }
}
:root[data-theme="light"]{
  --bg:#eef1f5; --bg1:#ffffff; --bg3:#e6eaf0; --bd:#d2d8e0; --bd2:#a6b0bd;
  --t1:#111823; --t2:#4a5462; --t3:#6b7480;
  --g:#15803d; --c:#0e6f8e; --o:#8a5a00; --r:#b91c1c; --p:#64748b;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--t1);
  font-family:'IBM Plex Sans',system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;
  padding:56px 24px 64px}
.wrap{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:34px}
.eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;
  letter-spacing:.22em;text-transform:uppercase;color:var(--t3);margin:0}
h1{font-size:clamp(24px,4vw,34px);font-weight:600;letter-spacing:-.025em;margin:10px 0 0;text-wrap:balance}
.lede{color:var(--t2);margin:12px 0 0;max-width:68ch}
.fig{overflow-x:auto}
.fig svg{width:100%;height:auto;min-width:900px;display:block}
.foot{display:flex;flex-wrap:wrap;gap:28px;border-top:1px solid var(--bd);padding-top:16px;
  font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:var(--t3)}
.foot b{color:var(--t2);font-weight:500}
.foot .ok{color:var(--g)}
</style>
<div class="wrap">
  <header>
    <p class="eyebrow">datahallAI &middot; cooling &middot; one hall</p>
    <h1>Liquid cooling loop</h1>
    <p class="lede">Each link is two pipes, not one arrow: the hot stream runs out along the top
    and the cold stream returns along the bottom, because the water comes back. The CDU array is
    the only accented node — it is the heat exchanger the whole drawing is about.</p>
  </header>

  <div class="fig">${svg}</div>

  <div class="foot">
    <span><b>${boxes.length}</b> boxes measured</span>
    <span><b class="${collisions.length ? '' : 'ok'}">${collisions.length}</b> label collisions</span>
    <span><b class="${ctx.warnings.length ? '' : 'ok'}">${ctx.warnings.length}</b> engine warnings</span>
    <span><b>${ctx.width}&times;${ctx.height}</b> frame, fitted to content</span>
    <span>gap <b>${GAP}</b> derived from the widest pipe label</span>
  </div>
</div>`;

writeFileSync(out, page);

console.log('RZ DIAGRAM DEMO');
console.log('  wrote      ' + out);
console.log('  boxes      ' + boxes.length + ' measured');
console.log('  warnings   ' + (ctx.warnings.length || 'none'));
ctx.warnings.forEach(w => console.log('               ' + w.kind + ' — ' + w.message));
console.log('  collisions ' + (collisions.length || 0));
collisions.forEach(c => console.log('               ' + c));
process.exit(collisions.length ? 1 : 0);
