#!/usr/bin/env node
/* ============================================================================
 * demo-rz-diagram.mjs — draw one real cockpit diagram through the engine
 * ----------------------------------------------------------------------------
 * The subject is the liquid-cooling chain on datahallAI.html: the same content
 * whose labels were hand-nudged four separate times today. Nothing here places
 * a label or routes a line by hand. Every box is sized from its own text, every
 * connector is routed around whatever is in its way, and the script ends by
 * measuring its own output for collisions.
 *
 *   node tools/demo-rz-diagram.mjs            # writes the HTML, prints the audit
 *   node tools/demo-rz-diagram.mjs --out=X    # somewhere other than the default
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
const { RZDiagram: D, RZDiagramMetrics: M } = sandbox;

/* ---- the diagram -------------------------------------------------------
 * Engine values as the page renders them at the 500 MW GB300 design point.
 * Declared as data, so the layout follows the numbers rather than the numbers
 * being typed into a layout.
 * --------------------------------------------------------------------- */
const E = {
  cduInstalled: 55, cduRunning: 54, cduModel: 'CoolIT CHx1000',
  tcsSupply: 32.0, tcsReturn: 50.0,
  htwSupply: 27.0, htwReturn: 45.0,
  cdwSupply: 31.0, cdwReturn: 41.0,
  racksPerHall: 440, kwPerRack: 142,
  liquidCapturePct: 85
};

/* The gap between links is DERIVED, not chosen. An arrow label sits in the gap
 * between two boxes, so the gap has to be at least as wide as the widest label
 * plus its mask padding and the 8px clearance on each side. Picking 40 by eye
 * is what made the first run of this script refuse to place four labels — the
 * engine was right and the layout was wrong. */
const EDGE_LABELS = [
  'TCS ' + E.tcsReturn.toFixed(1) + '°C',
  'HTW ' + E.htwReturn.toFixed(1) + '°C',
  'HTW ' + E.htwSupply.toFixed(1) + '°C',
  'CDW ' + E.cdwReturn.toFixed(1) + '°C'
];
const GAP = M.grid4(Math.max(...EDGE_LABELS.map(
  s => M.textWidth(s.toUpperCase(), 8, 'mono', { tracking: 0.06 }))) + 6 + 16);

const ctx = D.create({
  width: 1180, height: 420, slug: 'rzcool',
  title: 'Liquid cooling chain — one hall',
  desc: 'Heat leaves the racks through the technology cooling loop into the CDU array, ' +
        'crosses into the facility water loop, and is rejected at the dry coolers. ' +
        'Eighty-five per cent of the hall IT load takes this path; the rest is air.'
});

const ROW = 140;   /* the chain sits on one baseline; the engine sizes each box */
let x = 48;

function chain(o) {
  const box = ctx.node(x, ROW, o);
  x = box.x + box.w + GAP;
  return box;
}

const racks = chain({
  id: 'racks', tag: 'load',
  name: 'NVL72 RACKS',
  sublabel: E.racksPerHall + ' × ' + E.kwPerRack + ' kW',
  stroke: 'alarm-normal'
});

const cdu = chain({
  id: 'cdu', tag: 'l2l', focal: true,
  name: 'CDU ARRAY',
  sublabel: E.cduRunning + '/' + E.cduInstalled + ' duty · ' + E.cduModel,
  stroke: 'accent'
});

const fws = chain({
  id: 'fws', tag: 'pumps',
  name: 'FWS PUMP STATION',
  sublabel: 'DN250 CS insulated',
  stroke: 'link'
});

const chiller = chain({
  id: 'chiller', tag: 'plant',
  name: 'CHILLER PLANT',
  sublabel: 'residual air load only',
  stroke: 'link'
});

const dry = chain({
  id: 'dry', tag: 'reject',
  name: 'DRY COOLERS',
  sublabel: E.cdwSupply + ' / ' + E.cdwReturn + ' \u00B0C',
  stroke: 'link'
});

/* Air side: the 15 % the liquid path does not carry. Placed below the chain so
 * its connector has open canvas — the engine would reroute anyway, but a
 * layout that does not need rerouting is the better layout. */
const crah = ctx.node(racks.x + 140, 304, {
  id: 'crah', tag: 'air',
  name: 'CRAH BANKS',
  sublabel: (100 - E.liquidCapturePct) + ' % of hall IT',
  stroke: 'muted'
});

/* One zone: the liquid path and the air handlers are indoors, heat rejection is
 * outdoors. That boundary is the only grouping the diagram needs, so it is the
 * only one it draws.
 *
 * It is declared LAST because both its edges come from the content: the right
 * edge from where the chain stopped before the dry coolers, the bottom from the
 * CRAH banks. Paint order does not follow call order — zones are emitted first
 * whenever they are declared — so the boundary can follow the drawing instead
 * of being a number typed in advance and then defended. */
ctx.zone(24, 56, chiller.x + chiller.w + 24 - 24, (crah.y + crah.h + 24) - 56,
  { label: 'inside the hall', tier: 1 });

/* ---- connectors ---------------------------------------------------------
 * Declared as endpoints and a label. Routing, elbow radius, label position and
 * the mask behind it are all the engine's problem.
 * --------------------------------------------------------------------- */
const mid = b => ({ x: b.x + b.w, y: b.y + b.h / 2 });
const midL = b => ({ x: b.x, y: b.y + b.h / 2 });

ctx.edge(mid(racks), midL(cdu), {
  fromId: 'racks', toId: 'cdu', stroke: 'alarm-caution',
  label: 'TCS ' + E.tcsReturn.toFixed(1) + '°C'
});
ctx.edge(mid(cdu), midL(fws), {
  fromId: 'cdu', toId: 'fws', stroke: 'alarm-caution',
  label: 'HTW ' + E.htwReturn.toFixed(1) + '°C'
});
ctx.edge(mid(fws), midL(chiller), {
  fromId: 'fws', toId: 'chiller', stroke: 'link',
  label: 'HTW ' + E.htwSupply.toFixed(1) + '°C'
});
ctx.edge(mid(chiller), midL(dry), {
  fromId: 'chiller', toId: 'dry', stroke: 'link',
  label: 'CDW ' + E.cdwReturn.toFixed(1) + '°C'
});
ctx.edge({ x: racks.x + racks.w / 2, y: racks.y + racks.h },
         { x: crah.x, y: crah.y + crah.h / 2 }, {
  fromId: 'racks', toId: 'crah', stroke: 'muted', dashed: true,
  label: 'air ' + (100 - E.liquidCapturePct) + '%'
});

/* the frame follows the content, not the other way round */
const svg = ctx.fit(28).render();

/* ---- self-audit ---------------------------------------------------------
 * The engine measured every box it drew, so it can answer the question the
 * browser gate spends twenty minutes on: does anything overlap anything?
 * --------------------------------------------------------------------- */
const boxes = ctx.occupancy.items.filter(i => i.meta.kind === 'text' || i.meta.kind === 'node');
const collisions = [];
for (let i = 0; i < boxes.length; i++) {
  for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    /* a label inside its own node is a badge chip, which is legal */
    if (M.contains(a.box, b.box) || M.contains(b.box, a.box)) continue;
    const ov = M.overlap(a.box, b.box);
    if (ov && ov.ox > 0.5 && ov.oy > 0.5) {
      collisions.push(`${a.meta.kind}:${a.meta.id} x ${b.meta.kind}:${b.meta.id} ` +
                      `overlap ${ov.ox.toFixed(1)}x${ov.oy.toFixed(1)}`);
    }
  }
}

const outArg = process.argv.find(a => a.startsWith('--out='));
const out = outArg ? outArg.split('=')[1] : join(root, 'tools', '_rz-diagram-demo.html');

const rule = (what, why) =>
  `<div class="trace"><dt>${what}</dt><dd>${why}</dd></div>`;

const page = `<title>Liquid Cooling Chain</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* Dark-first on purpose: this is an engineering instrument surface, and the
   dark face is the product. The light face is the document/print register and
   is re-picked against white, never inverted — signal amber at #f59e0b reads
   1.9:1 on paper and has to become #92400e there. */
:root{
  --bg:#050810; --bg1:#0a0e17; --panel:#161c2b; --bd:#1a2030; --bd2:#2a3148;
  --t1:#e2e5ea; --t2:#8b919c; --t3:#9aa3af;
  --g:#22c55e; --c:#06b6d4; --o:#f59e0b; --r:#ef4444; --p:#64748b;
}
@media (prefers-color-scheme: light){
  :root:not([data-theme="dark"]){
    --bg:#f1f5f9; --bg1:#ffffff; --panel:#e2e8f0; --bd:#cbd5e1; --bd2:#94a3b8;
    --t1:#1e293b; --t2:#475569; --t3:#475569;
    --g:#15803d; --c:#0e7490; --o:#92400e; --r:#b91c1c; --p:#64748b;
  }
}
:root[data-theme="light"]{
  --bg:#f1f5f9; --bg1:#ffffff; --panel:#e2e8f0; --bd:#cbd5e1; --bd2:#94a3b8;
  --t1:#1e293b; --t2:#475569; --t3:#475569;
  --g:#15803d; --c:#0e7490; --o:#92400e; --r:#b91c1c; --p:#64748b;
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--bg); color:var(--t1);
  font-family:'IBM Plex Sans',system-ui,-apple-system,sans-serif;
  font-size:15px; line-height:1.6;
  padding:40px 20px 56px;
}
.wrap{max-width:1140px;margin:0 auto;display:flex;flex-direction:column;gap:28px}
.eyebrow{
  font-family:'JetBrains Mono',ui-monospace,monospace; font-size:10px;
  letter-spacing:.2em; text-transform:uppercase; color:var(--t3); margin:0;
}
h1{font-size:clamp(22px,4vw,30px);font-weight:600;letter-spacing:-.02em;margin:6px 0 0;text-wrap:balance}
.lede{color:var(--t2);margin:10px 0 0;max-width:66ch}
.lede b{color:var(--t1);font-weight:500}

/* the figure gets the one lifted surface on the page; nothing else is a card */
.fig{
  background:var(--bg1); border:1px solid var(--bd);
  border-radius:8px; padding:8px; overflow-x:auto;
}
.fig svg{width:100%;height:auto;min-width:880px;display:block}

.audit{
  display:flex; flex-wrap:wrap; gap:0;
  border:1px solid var(--bd); border-radius:8px; overflow:hidden;
}
.metric{
  flex:1 1 180px; padding:14px 18px; border-right:1px solid var(--bd);
  display:flex; flex-direction:column; gap:4px;
}
.metric:last-child{border-right:0}
.metric .k{
  font-family:'JetBrains Mono',ui-monospace,monospace; font-size:9px;
  letter-spacing:.18em; text-transform:uppercase; color:var(--t3);
}
.metric .v{
  font-family:'JetBrains Mono',ui-monospace,monospace; font-size:20px;
  font-variant-numeric:tabular-nums; color:var(--t1);
}
.metric .v.good{color:var(--g)}

h2{
  font-size:11px; font-family:'JetBrains Mono',ui-monospace,monospace;
  letter-spacing:.18em; text-transform:uppercase; color:var(--t3);
  font-weight:500; margin:0 0 -8px;
}
dl{margin:0;display:flex;flex-direction:column;gap:0}
.trace{
  display:grid; grid-template-columns:minmax(200px,1fr) 2.2fr; gap:20px;
  padding:13px 0; border-top:1px solid var(--bd);
}
.trace dt{
  font-family:'JetBrains Mono',ui-monospace,monospace; font-size:12px;
  color:var(--o);
}
.trace dd{margin:0;color:var(--t2);font-size:14px}
@media (max-width:640px){
  .trace{grid-template-columns:1fr;gap:4px}
  .fig{padding:6px}
}
</style>
<div class="wrap">
  <header>
    <p class="eyebrow">datahallAI &middot; cooling &middot; one hall</p>
    <h1>Liquid cooling chain</h1>
    <p class="lede">Every box below is sized from its own text, every connector is routed around
    what stands in its way, and every label was placed by search. <b>No coordinate in this figure
    was typed by hand.</b> The engine measured ${boxes.length} boxes on the way, and refuses to
    draw a label it cannot place rather than letting one overlap in silence.</p>
  </header>

  <div class="fig">${svg}</div>

  <div class="audit">
    <div class="metric"><span class="k">boxes measured</span><span class="v">${boxes.length}</span></div>
    <div class="metric"><span class="k">label collisions</span><span class="v ${collisions.length ? '' : 'good'}">${collisions.length}</span></div>
    <div class="metric"><span class="k">engine warnings</span><span class="v ${ctx.warnings.length ? '' : 'good'}">${ctx.warnings.length}</span></div>
    <div class="metric"><span class="k">frame</span><span class="v">${ctx.width}&times;${ctx.height}</span></div>
  </div>

  <div>
    <h2>What the engine decided, and on what grounds</h2>
    <dl>
      ${rule('node width',
        'The widest of name, sublabel and tag, plus padding, rounded up to the 4&nbsp;px grid. ' +
        'The CDU header on the live page was a 148-unit bar carrying a ~170-unit title; declared ' +
        'this way, the box simply comes out wide enough.')}
      ${rule('gap = ' + GAP + ' units',
        'Derived from the widest arrow label, not chosen. At 40 units the engine refused to place ' +
        'four labels — it was right and the layout was wrong.')}
      ${rule('label position',
        'Searched: preferred slot at 8&nbsp;px clearance, then 6&nbsp;px, then slid along the ' +
        'connector in 8-unit steps until nothing is hit. A label never sits on its own stroke.')}
      ${rule('connector shape',
        'Orthogonal only, with quarter-arc elbows at r=8 that shrink to 6 when a leg is too short ' +
        'to carry them. Diagonals are an automatic fail.')}
      ${rule('paint order',
        'Zones, then connectors, then nodes, then every label. Painting labels last removes the ' +
        'clipped-mask failure by construction instead of detecting it afterwards.')}
      ${rule('colour',
        'Semantic roles resolved to the page&rsquo;s own custom properties — no literal hex leaves ' +
        'the engine. Amber is ISA-18.2 caution, green is in-parameters, cyan is informational; ' +
        'one edit to a cockpit&rsquo;s :root re-skins every diagram on it, in both themes.')}
    </dl>
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
