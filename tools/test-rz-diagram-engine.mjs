#!/usr/bin/env node
/* ============================================================================
 * test-rz-diagram-engine.mjs — the geometry contract of the RZ diagram engine
 * ----------------------------------------------------------------------------
 * The cockpit diagrams on this site are drawn by concatenating SVG strings with
 * hand-written coordinates. That is where "garis dan kotak-kotaknya jelek dan
 * gak pas" comes from: nothing in the page knows how wide a label is before it
 * is drawn, so labels land on top of each other, panels are drawn over the
 * lines they annotate, and connectors run diagonally through boxes they have no
 * relationship with.
 *
 * The engine under test replaces the guessing with measurement. These tests are
 * the contract:
 *
 *   METRICS  — a label's box is computed from its text, per character, before
 *              anything is drawn (style-guide "width budget").
 *   PLACING  — a label is placed in the first candidate slot that collides with
 *              nothing already on the canvas, never at a fixed offset.
 *   ROUTING  — connectors obey the six mandatory rules in the diagram-design
 *              SKILL.md §6: orthogonal only, rounded elbows, fanned attach
 *              points, no transit behind a non-endpoint box.
 *
 * No test framework — pure Node `vm`, same idiom as test-conv-calc.mjs.
 * Exits 1 on any failure.
 *
 *   Run:  node tools/test-rz-diagram-engine.mjs   (from rz-work/)
 * ==========================================================================*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/* ---- sandbox: load the engine modules with no DOM, no window ------------- */
const sandbox = { module: { exports: {} }, console };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);

const MODULES = [
  'js/rz-diagram-metrics.js',
  'js/rz-diagram-layout.js',
  'js/rz-diagram.js',
];
for (const rel of MODULES) {
  const src = readFileSync(join(root, rel), 'utf8');
  vm.runInContext(src, sandbox, { filename: rel });
}

const M = sandbox.RZDiagramMetrics;
const L = sandbox.RZDiagramLayout;

/* ---- tiny assertion kit -------------------------------------------------- */
let pass = 0;
const fails = [];
function ok(id, cond, detail) {
  if (cond) { pass++; return; }
  fails.push(`${id} — ${detail}`);
}
function near(id, got, want, tol, detail) {
  const d = Math.abs(got - want);
  ok(id, d <= tol, `${detail}: got ${got}, want ${want} ±${tol}`);
}

/* ==========================================================================
 * METRICS — the width budget, per character
 * ======================================================================== */

/* M1: the sans budget is proportional, so it is asserted as a property, not as
 *     a formula: an all-caps label must be budgeted WIDER than the same letters
 *     lowercase. A flat per-character average undersizes exactly the labels
 *     this site draws most — eyebrows and tags are all-caps by convention, and
 *     an undersized eyebrow is what overran the CDU header bar. */
{
  const caps = M.textWidth('ABCDEF', 12, 'sans');
  const lower = M.textWidth('abcdef', 12, 'sans');
  const thin = M.textWidth('iiiiii', 12, 'sans');
  ok('M1a', caps > lower, `caps must budget wider than lowercase: ${caps} vs ${lower}`);
  ok('M1b', lower > thin, `lowercase must budget wider than i-stems: ${lower} vs ${thin}`);
  /* and it must stay in the neighbourhood of the style guide's 0.58em average,
   * or the correction has become a different budget rather than a refinement */
  const avg = 6 * 0.58 * 12;
  ok('M1c', caps < avg * 1.25 && thin > avg * 0.45,
    `the correction must refine 0.58em, not replace it: ${thin}..${caps} around ${avg}`);
}

/* M2: mono is monospaced, so 0.60em is exact AND class-independent — the
 *     proportional correction must not leak into it. */
near('M2a', M.textWidth('440', 12, 'mono'), 3 * 0.60 * 12, 0.001,
  'three mono digits at 12px');
near('M2b', M.textWidth('WWW', 12, 'mono'), M.textWidth('iii', 12, 'mono'), 0.001,
  'monospaced means every glyph advances equally');

/* M3: a wide (East Asian) character costs a full em, not an advance. */
near('M3', M.textWidth('主', 12, 'sans'), 12, 0.001,
  'one CJK ideograph at 12px');

/* M4: the trap the style guide calls out by name. `주문 v2.1` is two
 *     full-width syllables and five narrow characters. A formula that tallies
 *     by script drops `2`, `.` and `1` and sizes the box for four of its seven
 *     characters. Ours must be strictly wider than that mistake, and must
 *     account for the two syllables at a full em each. */
{
  const got = M.textWidth('주문 v2.1', 12, 'sans');
  const byScript = M.textWidth('주문 v', 12, 'sans');   /* the dropped tail */
  ok('M4a', got > byScript, `every character must be counted: ${got} vs ${byScript}`);
  ok('M4b', got >= 2 * 12, `two full-width syllables cost at least 2em: ${got}`);
}

/* M5: a combining mark has no advance of its own. */
near('M5', M.textWidth('é', 12, 'sans'), M.textWidth('e', 12, 'sans'), 0.001,
  'combining acute costs nothing');

/* M6: tracking is per character and real — an eyebrow at 0.18em is much wider
 *     than its untracked twin, which is exactly why tracked labels collide. */
const tracked = M.textWidth('PIPE RACK', 8, 'mono', { tracking: 0.18 });
const plain = M.textWidth('PIPE RACK', 8, 'mono');
ok('M6', tracked > plain + 8 * 0.18 * 8 * 0.5,
  `tracked eyebrow should be wider than plain: ${tracked} vs ${plain}`);

/* M7: textBox honours the anchor. A middle-anchored label straddles x. */
const bm = M.textBox('ABC', { x: 100, y: 50, size: 12, face: 'sans', anchor: 'middle' });
near('M7a', bm.x + bm.w / 2, 100, 0.001, 'middle anchor centres the box on x');
const be = M.textBox('ABC', { x: 100, y: 50, size: 12, face: 'sans', anchor: 'end' });
near('M7b', be.x + be.w, 100, 0.001, 'end anchor puts the right edge on x');

/* M8: the box is on the 4px grid when asked, and only ever rounds UP. */
ok('M8', M.grid4(13) === 16 && M.grid4(16) === 16 && M.grid4(0.5) === 4,
  `grid4 must round up to a multiple of 4: ${M.grid4(13)}/${M.grid4(16)}/${M.grid4(0.5)}`);

/* M9: overlap reports the axis of the overlap, not just a boolean. Today's
 *     wasted work came from nudging labels vertically when the overlap was
 *     27px horizontal — the engine has to say which axis is short. */
const ov = M.overlap({ x: 0, y: 0, w: 100, h: 10 }, { x: 73, y: 2, w: 100, h: 10 });
ok('M9a', ov !== null, 'overlapping rects must report an overlap');
near('M9b', ov.ox, 27, 0.001, 'horizontal overlap');
near('M9c', ov.oy, 8, 0.001, 'vertical overlap');
/* `axis` is the CHEAPER direction to separate in — the one with the smaller
 * overlap, because that is the shorter distance to move. Here 8px of vertical
 * beats 27px of horizontal.
 *
 * Cheaper for the pair is not the same as free for the diagram: the SLD family
 * fixed earlier today had exactly this shape (27px horizontal, 2-16px
 * vertical), and two attempts to take the "cheap" vertical lever traded one
 * collision for another because the band below was already full. That is why
 * placeLabel searches the occupancy index instead of trusting this hint —
 * `axis` says which way is shortest, never which way is clear. */
ok('M9d', ov.axis === 'y', `the SMALLER overlap is the cheaper axis: got ${ov && ov.axis}`);
ok('M9e', M.overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 }) === null,
  'disjoint rects report no overlap');

/* ==========================================================================
 * PLACING — a label goes where there is room, not at a fixed offset
 * ======================================================================== */

/* P1: an empty canvas puts the label in the first preferred slot. */
{
  const occ = L.occupancy();
  const seg = { x1: 100, y1: 200, x2: 300, y2: 200 };
  const p = L.placeLabel(seg, { w: 40, h: 12 }, { occupancy: occ });
  ok('P1a', p.placed === true, 'a clear canvas must place the label');
  ok('P1b', p.slot === 'above', `first preference is above: got ${p.slot}`);
  ok('P1c', p.box.y + p.box.h <= 200 - 6,
    `mask must clear the stroke by >= 6px: bottom ${p.box.y + p.box.h} vs stroke 200`);
}

/* P2: RED-shaped — block the slot above and the label must move, not overlap. */
{
  const occ = L.occupancy();
  occ.add({ x: 150, y: 170, w: 120, h: 24 }, { id: 'panel' });
  const seg = { x1: 100, y1: 200, x2: 300, y2: 200 };
  const p = L.placeLabel(seg, { w: 40, h: 12 }, { occupancy: occ });
  ok('P2a', p.placed === true, 'a blocked first slot must not fail the placement');
  ok('P2b', p.slot !== 'above', `above is occupied, engine must pick another: got ${p.slot}`);
  ok('P2c', M.overlap(p.box, { x: 150, y: 170, w: 120, h: 24 }) === null,
    'the placed box must not overlap the panel');
}

/* P3: every slot blocked — the engine reports failure rather than drawing a
 *     collision. A silent overlap is the bug we are removing. */
{
  const occ = L.occupancy();
  occ.add({ x: 0, y: 0, w: 1000, h: 1000 }, { id: 'everything' });
  const seg = { x1: 100, y1: 200, x2: 300, y2: 200 };
  const p = L.placeLabel(seg, { w: 40, h: 12 }, { occupancy: occ });
  ok('P3', p.placed === false, 'a fully blocked canvas must report placed:false');
}

/* P3b: a zone container is NOT an obstacle. Zones are painted before labels, so
 *      a label over one is readable — and it is the normal case, since most
 *      labels sit inside some container. Counting zones as obstacles made a
 *      wide-open canvas report "no room" for every label in the demo diagram. */
{
  const occ = L.occupancy();
  occ.add({ x: 0, y: 0, w: 1000, h: 1000 }, { id: 'hall', kind: 'zone' });
  const seg = { x1: 100, y1: 200, x2: 300, y2: 200 };
  const p = L.placeLabel(seg, { w: 40, h: 12 }, { occupancy: occ });
  ok('P3b1', p.placed === true, 'a label inside a zone must still place');
  ok('P3b2', p.slot === 'above', `and take its first preference: got ${p.slot}`);
  /* but a caller that needs the zone counted can still ask for it */
  ok('P3b3', occ.hits({ x: 10, y: 10, w: 5, h: 5 }, { includeZones: true }).length === 1,
    'includeZones must bring the container back');
}

/* P4: on a vertical segment the label goes beside the line, never on it, and
 *     never rotated (writing-mode vertical is a listed anti-pattern). */
{
  const occ = L.occupancy();
  const seg = { x1: 200, y1: 100, x2: 200, y2: 300 };
  const p = L.placeLabel(seg, { w: 40, h: 12 }, { occupancy: occ });
  ok('P4a', p.placed === true, 'vertical segment must place');
  ok('P4b', p.slot === 'right' || p.slot === 'left',
    `vertical segments take a side slot: got ${p.slot}`);
  const gap = p.slot === 'right' ? p.box.x - 200 : 200 - (p.box.x + p.box.w);
  ok('P4c', gap >= 6, `side gap must be >= 6px: got ${gap}`);
  ok('P4d', !p.rotate, 'never rotate an arrow label');
}

/* ==========================================================================
 * ROUTING — the six mandatory connector rules
 * ======================================================================== */

function segmentsOf(path) {
  /* the router returns explicit segments alongside the `d` string so a gate can
   * assert on geometry instead of parsing SVG path syntax */
  return path.segments;
}

/* R1: off-axis endpoints get an orthogonal elbow — never a diagonal. */
{
  const r = L.route({ x: 0, y: 0 }, { x: 200, y: 120 }, { obstacles: [] });
  const diag = segmentsOf(r).filter(s => s.x1 !== s.x2 && s.y1 !== s.y2);
  ok('R1a', diag.length === 0, `no segment may be diagonal: found ${diag.length}`);
  ok('R1b', r.d.includes('A') || r.d.includes('Q'),
    'an elbow must be a quarter-arc, not a hard corner');
}

/* R2: same-axis endpoints stay a straight line — an elbow there is noise. */
{
  const r = L.route({ x: 0, y: 50 }, { x: 200, y: 50 }, { obstacles: [] });
  ok('R2', segmentsOf(r).length === 1, `co-linear endpoints take one segment: got ${segmentsOf(r).length}`);
}

/* R3: the corner radius is the documented 8, and drops to 6 only when the
 *     segment is too short to carry 8. */
{
  const r = L.route({ x: 0, y: 0 }, { x: 200, y: 120 }, { obstacles: [] });
  ok('R3a', r.radius === 8, `default elbow radius is 8: got ${r.radius}`);
  const tight = L.route({ x: 0, y: 0 }, { x: 10, y: 9 }, { obstacles: [] });
  ok('R3b', tight.radius <= 8 && tight.radius >= 0,
    `a tight elbow shrinks its radius rather than overshooting: got ${tight.radius}`);
}

/* R4: a connector must not pass behind a box that is not its endpoint. This is
 *     the rule the cooling P&ID broke — the TCS return line ran under a
 *     parameter panel that had nothing to do with it. */
{
  const wall = { x: 80, y: -20, w: 40, h: 200 };
  const r = L.route({ x: 0, y: 50 }, { x: 200, y: 50 }, { obstacles: [wall] });
  const through = segmentsOf(r).some(s => L.segmentHitsRect(s, wall));
  ok('R4a', through === false, 'the route must go around an intervening box');
  ok('R4b', r.rerouted === true, 'the router must report that it rerouted');
}

/* R5: when rerouting is geometrically impossible the stroke is marked transit
 *     (dashed) instead of silently crossing — §6 rule 5's narrow exception. */
{
  const wall = { x: -1000, y: 40, w: 4000, h: 20 };
  const r = L.route({ x: 0, y: 50 }, { x: 200, y: 50 }, { obstacles: [wall] });
  ok('R5', r.transit === true, 'an unavoidable crossing must be declared transit');
}

/* R6: several connectors on one edge get their own attach point, spread by the
 *     documented L*k/(N+1) formula and never closer than 12px. */
{
  const pts = L.fanPoints({ x: 100, y: 0, w: 0, h: 120 }, 3, 'left');
  ok('R6a', pts.length === 3, `three connectors, three points: got ${pts.length}`);
  near('R6b', pts[0].y, 120 * 1 / 4, 0.001, 'first attach point at L*1/(N+1)');
  near('R6c', pts[1].y, 120 * 2 / 4, 0.001, 'second attach point at L*2/(N+1)');
  const spacing = pts[1].y - pts[0].y;
  ok('R6d', spacing >= 12, `attach points must be >= 12px apart: got ${spacing}`);
  ok('R6e', new Set(pts.map(p => `${p.x},${p.y}`)).size === 3,
    'no two connectors may share a point');
}

/* R7: an edge too short to hold N points at 12px reports the overflow rather
 *     than stacking them — the layout is wrong and the author has to know. */
{
  const pts = L.fanPoints({ x: 100, y: 0, w: 0, h: 20 }, 4, 'left');
  ok('R7', pts.crowded === true, 'an over-subscribed edge must flag itself');
}

/* ==========================================================================
 * FACADE — what a cockpit page actually calls
 * ======================================================================== */
const D = sandbox.RZDiagram;

/* F1: a node sizes itself from its own content, on the 4px grid. The CDU
 *     header bug was a 148-unit bar carrying a ~170-unit title; declared this
 *     way the box simply comes out wide enough. */
{
  const ctx = D.create({ width: 400, height: 200, slug: 't1', title: 'T', desc: 'D' });
  const box = ctx.node(20, 20, { name: 'CDU ARRAY — 55 × CoolIT CHx1000', sublabel: '54 duty + 1 stby' });
  const need = M.textWidth('CDU ARRAY — 55 × CoolIT CHx1000', 12, 'sans');
  ok('F1a', box.w >= need, `box must fit its own title: ${box.w} vs text ${need}`);
  ok('F1b', box.w % 4 === 0 && box.h % 4 === 0, `box must sit on the 4px grid: ${box.w}x${box.h}`);
  ok('F1c', ctx.warnings.length === 0, 'a self-sized node must not warn');
}

/* F2: an explicit width too small for the content WARNS rather than overrunning
 *     in silence. Silence is the defect being removed. */
{
  const ctx = D.create({ width: 400, height: 200, slug: 't2', title: 'T', desc: 'D' });
  ctx.node(20, 20, { w: 148, name: 'CDU ARRAY — 55 × CoolIT CHx1000' });
  const w = ctx.warnings.filter(x => x.kind === 'node-overflow');
  ok('F2', w.length === 1, `an undersized box must warn: ${JSON.stringify(ctx.warnings)}`);
}

/* F3: a connector routes around a node it is not connected to, and the emitted
 *     path carries the evidence a gate can assert on. */
{
  const ctx = D.create({ width: 400, height: 200, slug: 't3', title: 'T', desc: 'D' });
  ctx.node(160, 20, { w: 60, h: 120, name: 'WALL', id: 'wall' });
  const r = ctx.edge({ x: 20, y: 80 }, { x: 360, y: 80 }, {});
  ok('F3a', r.transit === false, 'a reroutable crossing must not be declared transit');
  const svg = ctx.render();
  ok('F3b', svg.includes('data-rzd-rerouted="1"'), 'the route must report the reroute in the markup');
}

/* F4: the accessible-figure contract — title first, slug-prefixed ids. Two
 *     inline diagrams on one page must not announce each other's name. */
{
  const ctx = D.create({ width: 100, height: 100, slug: 'cool', title: 'Cooling', desc: 'A loop.' });
  const svg = ctx.render();
  ok('F4a', /role="img"/.test(svg), 'svg must carry role="img"');
  ok('F4b', svg.indexOf('<title id="cool-title">') < svg.indexOf('<defs'),
    'title must be the first child, before defs');
  ok('F4c', svg.includes('aria-labelledby="cool-title cool-desc"'), 'ids must be slug-prefixed');
  ok('F4d', !svg.includes('id="title"'), 'bare title/desc ids are banned');
}

/* F5: paint order. Labels are emitted LAST, so a label can never be clipped by
 *     a node painted after it — the shipped skill's §6 rule 6 failure mode is
 *     removed by construction rather than detected by a verifier. */
{
  const ctx = D.create({ width: 200, height: 100, slug: 't5', title: 'T', desc: 'D' });
  ctx.node(10, 10, { name: 'ALPHA' });
  const svg = ctx.render();
  const lastNodeRect = svg.lastIndexOf('<rect');
  const firstText = svg.indexOf('<text x=');
  ok('F5', firstText > lastNodeRect || svg.indexOf('ALPHA') > lastNodeRect,
    'every label must be emitted after every node');
}

/* F6: colours resolve to the page's own custom properties, never to hexes —
 *     one edit to a cockpit's :root re-skins every diagram on it, both themes. */
{
  const ctx = D.create({ width: 100, height: 100, slug: 't6', title: 'T', desc: 'D' });
  ctx.node(10, 10, { name: 'A' });
  const svg = ctx.render();
  const hexes = svg.match(/#[0-9a-fA-F]{3,8}/g) || [];
  ok('F6', hexes.length === 0, `engine output must carry no literal hex: ${hexes.join(',')}`);
}

/* F7: mono text carries tabular figures. Columns of engineering numbers have
 *     to align without letter-spacing tricks, and `0` must not read as `O`. */
{
  const ctx = D.create({ width: 100, height: 100, slug: 't7', title: 'T', desc: 'D' });
  ctx.text('440', 10, 20, { role: 'datum' });
  ok('F7', ctx.render().includes('tabular-nums'), 'numeric text must be tabular');
}

/* F8: the frame follows the content. A viewBox typed in advance is defended
 *     until it stops being true; fit() recomputes it from what was drawn. */
{
  const ctx = D.create({ width: 2000, height: 2000, slug: 't8', title: 'T', desc: 'D' });
  const box = ctx.node(20, 20, { name: 'ALPHA' });
  ctx.fit(24);
  ok('F8a', ctx.width < 2000 && ctx.height < 2000, `fit must shrink an oversized frame: ${ctx.width}x${ctx.height}`);
  ok('F8b', ctx.width >= box.x + box.w && ctx.height >= box.y + box.h,
    'fit must never crop the content it measured');
  ok('F8c', ctx.width % 4 === 0 && ctx.height % 4 === 0, 'the frame stays on the 4px grid');
  ok('F8d', ctx.render().includes('viewBox="0 0 ' + ctx.width + ' ' + ctx.height + '"'),
    'render must use the fitted frame');
}

/* ==========================================================================
 * verdict
 * ======================================================================== */
const total = pass + fails.length;
if (fails.length) {
  console.log(`FAIL RZ diagram engine — ${fails.length} of ${total} assertions failed\n`);
  for (const f of fails) console.log('  ' + f);
  process.exit(1);
}
console.log(`PASS RZ diagram engine — ${pass}/${total} geometry assertions`);
console.log('     metrics measured per character · labels placed by search · connectors orthogonal, fanned, rerouted');
