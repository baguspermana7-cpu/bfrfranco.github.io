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
import { readFileSync, readdirSync } from 'node:fs';
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
 * BASIS MARKS — the engine's metrics reach the existing cockpit drawings
 * ======================================================================== */

/* The provenance marks on every cockpit were positioned with
 * `length * size * 0.6`, and rz-svg-basis.js said so in a comment: "text width
 * unknown at build time". It is knowable now. These assertions are the contract
 * for that hand-off, including the fallback that keeps pages which do not load
 * the engine working exactly as before. */
{
  const basisSrc = readFileSync(join(root, 'js/rz-svg-basis.js'), 'utf8');

  /* B1: with the engine present, a CJK label is measured, not counted. Under the
   *     flat 0.6 estimate three ideographs budget 10.8 at size 6 and actually
   *     draw 18 — the mark landed six units inside the text. */
  {
    const sb = { module: { exports: {} }, console };
    sb.globalThis = sb; sb.window = sb;
    vm.createContext(sb);
    vm.runInContext(readFileSync(join(root, 'js/rz-evidence.js'), 'utf8'), sb);
    vm.runInContext(readFileSync(join(root, 'js/rz-diagram-metrics.js'), 'utf8'), sb);
    vm.runInContext(basisSrc, sb);
    const B = sb.RZSvgBasis;
    ok('B1a', !!B && typeof B.tag === 'function', 'rz-svg-basis must expose tag()');
    const wide = B.tag({ x: 0, y: 20, text: '主控室', param: 'x', size: 6 });
    const cx = Number((wide.match(/rz-basis-mark[^>]*cx="([\d.]+)"/) || [])[1]);
    ok('B1b', cx > 10.8 + 4.6,
      `a CJK label's mark must clear the measured end, not the counted one: cx=${cx}`);
  }

  /* B2: without the engine, the module still works and still places a mark. A page
   *     that has not adopted the engine must not regress or throw. */
  {
    const sb = { module: { exports: {} }, console };
    sb.globalThis = sb; sb.window = sb;
    vm.createContext(sb);
    vm.runInContext(readFileSync(join(root, 'js/rz-evidence.js'), 'utf8'), sb);
    vm.runInContext(basisSrc, sb);
    const B = sb.RZSvgBasis;
    const out = B.tag({ x: 0, y: 20, text: 'ABC', param: 'x', size: 6 });
    ok('B2a', out.includes('rz-basis-mark'), 'the fallback must still draw a mark');
    ok('B2b', out.includes('data-basis-param="x"'), 'the fallback must still hook the parameter');
  }

  /* B3: the lookup is at CALL time, not load time. rz-svg-basis is a synchronous
   *     script on 2 pages and the engine is loaded beside it; a load-time capture
   *     would freeze whichever happened to be parsed first. */
  ok('B3', /function approxWidth[\s\S]{0,400}?window\.RZDiagramMetrics/.test(basisSrc),
    'approxWidth must look the engine up inside the function');
}

/* ==========================================================================
 * PLACE-BOX — a floating caption with no connector to hang from
 * ======================================================================== */

/* Q1: if the wanted position is clear, nothing moves. A search that shifts a
 *     label that was already fine is a search that makes drawings worse. */
{
  const occ = L.occupancy();
  const p = L.placeBox({ x: 100, y: 100, w: 60, h: 12 }, { occupancy: occ });
  ok('Q1a', p.placed === true && p.ring === 0, `a clear slot must not move: ring ${p.ring}`);
  ok('Q1b', p.dx === 0 && p.dy === 0, 'no displacement when none is needed');
}

/* Q2: blocked at the wanted position, it steps UP first. On an exploded
 *     isometric the space above a room is the reliably empty direction — below
 *     is the floor slab and beside it is the next room. */
{
  const occ = L.occupancy();
  occ.add({ x: 90, y: 95, w: 80, h: 20 }, { id: 'tag', kind: 'text' });
  const p = L.placeBox({ x: 100, y: 100, w: 60, h: 12 }, { occupancy: occ });
  ok('Q2a', p.placed === true, 'a blocked caption must still place');
  ok('Q2b', p.dy < 0 && p.dx === 0, `first move is straight up: dx=${p.dx} dy=${p.dy}`);
  ok('Q2c', M.overlap(p.box, { x: 90, y: 95, w: 80, h: 20 }) === null,
    'the placed box must actually clear the blocker');
}

/* Q3: whoever registers first wins. An equipment tag identifies one box and
 *     must not move; a zone caption names a region and reads fine a few units
 *     away. The caller encodes that by registering the rigid labels first. */
{
  const occ = L.occupancy();
  occ.add({ x: 0, y: 0, w: 400, h: 200 }, { id: 'rigid', kind: 'text' });
  const p = L.placeBox({ x: 100, y: 100, w: 60, h: 12 }, { occupancy: occ, rings: 3, step: 6 });
  ok('Q3', p.placed === false,
    'out of reach must be reported, not silently overlapped');
}

/* Q4: `axis:"y"` restricts the ladder to vertical. An isometric caption slid
 *     sideways stops sitting over the room it names. */
{
  const occ = L.occupancy();
  occ.add({ x: 100, y: 100, w: 60, h: 12 }, { id: 'x', kind: 'text' });
  const p = L.placeBox({ x: 100, y: 100, w: 60, h: 12 }, { occupancy: occ, axis: 'y' });
  ok('Q4', p.placed === true && p.dx === 0, `axis y must never move sideways: dx=${p.dx}`);
}

/* Q5: `axis:"x"` restricts the ladder to horizontal and tries OUTWARD first. A
 *     label parked beside a drawing has open canvas on the far side and the
 *     drawing itself on the near one. */
{
  const occ = L.occupancy();
  /* a narrow blocker clipping the label's left end — the case a floor caption
     meets when an equipment tag reaches into its column */
  occ.add({ x: 90, y: 100, w: 20, h: 12 }, { id: 'tag', kind: 'text' });
  const p = L.placeBox({ x: 100, y: 100, w: 60, h: 12 }, { occupancy: occ, axis: 'x' });
  ok('Q5a', p.placed === true && p.dy === 0, `axis x must never move vertically: dy=${p.dy}`);
  ok('Q5b', p.dx > 0, `and must try outward first: dx=${p.dx}`);
  ok('Q5c', M.overlap(p.box, { x: 90, y: 100, w: 20, h: 12 }) === null,
    'and must actually clear the blocker');

  /* The ladder has a REACH. Clearing a blocker as wide as the label itself needs
   * dx >= its width, and the default eight rings of six units reach 48 — so a
   * 60-wide obstruction is correctly reported unplaceable rather than quietly
   * left overlapping. The caller widens step/rings when its labels are wide. */
  const occ2 = L.occupancy();
  occ2.add({ x: 100, y: 100, w: 60, h: 12 }, { id: 'wide', kind: 'text' });
  const tight = L.placeBox({ x: 100, y: 100, w: 60, h: 12 }, { occupancy: occ2, axis: 'x' });
  ok('Q5d', tight.placed === false, 'a blocker wider than the ladder reaches must report failure');
  const roomy = L.placeBox({ x: 100, y: 100, w: 60, h: 12 },
    { occupancy: occ2, axis: 'x', step: 12, rings: 8 });
  ok('Q5e', roomy.placed === true && roomy.dx >= 60,
    `and a wider ladder must find it: dx=${roomy.dx}`);
}

/* ==========================================================================
 * ISOMETRIC WIRING — the deferred-caption pass on datahallAI.html
 * ======================================================================== */

/* The building isometric defers its floating zone captions and substitutes them
 * once every rigid equipment tag is registered. Two things can go wrong in a way
 * that renders as damage rather than as an error: a token can survive into the
 * DOM, and the pass can crash a page that has not loaded the engine. Both are
 * exercised here against the real source, extracted from the page. */
{
  const pageSrc = readFileSync(join(root, 'datahallAI.html'), 'utf8');
  const block = pageSrc.slice(
    pageSrc.indexOf('var ISO_OCC=null'),
    pageSrc.indexOf('// 3D equipment box:')
  );
  ok('I0', block.length > 400 && block.includes('isoResolvePlacement'),
    `the isometric placement block must be extractable: ${block.length} chars`);

  /* iX/iY project iso space to screen; tx emits the text element. Stubbed to the
   * shapes the real page uses, so the block under test is the page's own code. */
  const harness = `
    function iX(x,y){ return 300 + (x - y) * 4; }
    function iY(x,y,z){ return 400 + (x + y) * 2 - z * 3; }
    function tx(x,y,label,color,fs,anchor,bold,o){
      return '<text x="'+x+'" y="'+y+'">'+label+'</text>';
    }
  `;

  function run(withEngine) {
    const sb = { module: { exports: {} }, console };
    sb.globalThis = sb; sb.window = sb;
    vm.createContext(sb);
    if (withEngine) {
      for (const rel of ['js/rz-diagram-metrics.js', 'js/rz-diagram-layout.js']) {
        vm.runInContext(readFileSync(join(root, rel), 'utf8'), sb, { filename: rel });
      }
    }
    vm.runInContext(harness + '\n' + block, sb);
    return sb;
  }

  /* I1: with the engine, a caption that lands on an equipment tag is displaced,
   *     and the placeholder is fully substituted. */
  {
    const sb = run(true);
    sb.isoBeginPlacement();
    /* caption first, tag second — the emission order that makes deferral necessary */
    const caption = sb.isoLabel(10, 10, 20, 'GENERATOR ROOM', '#93c5fd', 9, 1);
    const tag = sb.isoLabel(10, 10, 20, 'BD', '#fff', 7, 1, null, true);
    const out = sb.isoResolvePlacement(caption + tag);
    ok('I1a', out.indexOf('<!--ISOFLEX') === -1,
      'every deferred token must be substituted — a survivor renders as a missing label');
    ok('I1b', out.includes('GENERATOR ROOM') && out.includes('BD'),
      'both labels must still be present');
    /* Assert the masks do not OVERLAP, not merely that their y values differ.
     * Two boxes 2 units apart have different y and still sit on top of each
     * other — an earlier version of this assertion passed while the captions
     * were being drawn rigid, which is exactly the bug it exists to catch. */
    const masks = [...out.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
      .map(m => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }));
    ok('I1c0', masks.length === 2, `two masks expected, got ${masks.length}`);
    ok('I1c', M.overlap(masks[0], masks[1]) === null,
      `the caption must clear the tag, not merely differ from it: ` +
      masks.map(b => `(${b.x},${b.y},${b.w}x${b.h})`).join(' vs '));
    ok('I1d', sb.ISO_UNPLACED === 0, `nothing should be left unplaceable: ${sb.ISO_UNPLACED}`);
  }

  /* I2: a clear caption is NOT moved. A search that shifts a label that was
   *     already fine makes drawings worse, not better. */
  {
    const sb = run(true);
    sb.isoBeginPlacement();
    const a = sb.isoLabel(0, 0, 0, 'CHILLER PLANT', '#93c5fd', 9, 1);
    const b = sb.isoLabel(40, 40, 0, 'FAR AWAY', '#fff', 7, 1, null, true);
    const out = sb.isoResolvePlacement(a + b);
    /* the authored box, computed through the same projection the page uses */
    const want = sb.isoLabelBox(sb.iX(0, 0), sb.iY(0, 0, 0), 'CHILLER PLANT', 9);
    ok('I2', out.includes('y="' + want.y + '"'),
      `an unobstructed caption must stay exactly where it was authored: expected y=${want.y}`);
  }

  /* I1e: two EQUIPMENT TAGS must not sit on each other either. A tag names one
   *      box so it cannot wander, but "cannot wander" is not "cannot move": a
   *      nudge of a few units still plainly belongs to its box, while a tag
   *      buried under another tag reads as nothing. MV SWGR-B and SM6 20kV both
   *      landed on the 80,000L tank tag, visible only once the floor caption
   *      stopped covering them. */
  {
    const sb = run(true);
    sb.isoBeginPlacement();
    /* Two tags on NEARBY boxes, partly overlapping — the real shape of the
     * defect (MV SWGR-B x 80,000L overlapped by 5.2px vertically). Two tags at
     * an IDENTICAL anchor would need a nudge larger than a tag should ever
     * make, and that is an authoring problem, not a placement one. */
    const a = sb.isoLabel(10, 10, 22, 'SM6 20kV', '#fff', 7, 1, null, true);
    const b = sb.isoLabel(10, 10, 20, '80,000L', '#fff', 7, 1, null, true);
    const out = sb.isoResolvePlacement(a + b);
    const masks = [...out.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
      .map(m => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }));
    ok('I1e0', masks.length === 2, `two tags expected, got ${masks.length}`);
    ok('I1e', M.overlap(masks[0], masks[1]) === null,
      'two equipment tags must not overlap: ' +
      masks.map(x => `(${x.x},${x.y})`).join(' vs '));
    /* And the nudge must stay SMALL — a tag that travels stops naming its box.
     * Measure DISPLACEMENT from where each was authored, not the gap between
     * them: two correctly separated tags are naturally far apart, so the gap
     * says nothing about how far either one moved. */
    const authored = [
      sb.isoLabelBox(sb.iX(10, 10), sb.iY(10, 10, 22), 'SM6 20kV', 7),
      sb.isoLabelBox(sb.iX(10, 10), sb.iY(10, 10, 20), '80,000L', 7)
    ];
    const moves = masks.map((m, i) =>
      Math.abs(m.x - authored[i].x) + Math.abs(m.y - authored[i].y));
    ok('I1e2', Math.max(...moves) <= 12,
      `a tag may be nudged, never relocated: displacements ${moves.map(n => n.toFixed(1)).join(', ')}`);
  }

  /* I1f: a displaced caption moves its MASK and its TEXT together.
   *
   *      This shipped broken: the flex path applied only `dy`, which was right
   *      while placement was vertical-only. Once escalation could move a label
   *      sideways, the mask moved and the text stayed where it was authored —
   *      so the search reported "placed" while the label went on colliding, and
   *      the mask sat 36px away from the words it was supposed to back. */
  {
    const sb = run(true);
    sb.isoBeginPlacement();
    const caption = sb.isoLabel(10, 10, 20, 'CW PUMP STATION', '#93c5fd', 8, 1);
    const cx = sb.iX(10, 10), cy = sb.iY(10, 10, 20);
    /* wall the vertical column so placement is forced sideways */
    sb.ISO_OCC.add({ x: cx - 22, y: cy - 200, w: 44, h: 400 }, { id: 'wall', kind: 'text' });
    const out = sb.isoResolvePlacement(caption);
    const mask = [...out.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
      .map(m => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }))[0];
    const tx = [...out.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"/g)]
      .map(m => ({ x: +m[1], y: +m[2] }))[0];
    ok('I1f0', !!mask && !!tx, 'the caption must render a mask and a text');
    ok('I1f1', Math.abs(mask.x - cx) > 1,
      `placement must actually have moved it sideways: mask.x=${mask.x} cx=${cx}`);
    /* the text is middle-anchored, so its x is the mask's centre */
    ok('I1f2', Math.abs(tx.x - (mask.x + mask.w / 2)) < 0.01,
      `text must sit at the centre of its own mask: text.x=${tx.x} mask centre=${mask.x + mask.w / 2}`);
  }

  /* I2b: the pass CLOSES. A label emitted after the resolve must draw immediately rather
   *      than defer into a queue nobody drains — an unresolved token renders as a missing
   *      label, not as an error. */
  {
    const sb = run(true);
    sb.isoBeginPlacement();
    const out = sb.isoResolvePlacement(sb.isoLabel(0, 0, 0, 'FIRST', '#fff', 8, 1));
    const late = sb.isoLabel(5, 5, 5, 'LATE', '#fff', 8, 1);
    ok('I2b1', late.indexOf('<!--ISOFLEX') === -1,
      `a label emitted after the pass must not defer: ${late.slice(0, 40)}`);
    ok('I2b2', late.includes('LATE'), 'and must carry its own text');
    void out;
  }

  /* I2c: a caption boxed in on its preferred axis ESCALATES to the full ladder
   *      rather than giving up and overlapping. Preferred keeps it in its own
   *      column; a diagonal nudge still names its room, an overlap names
   *      nothing. */
  {
    const sb = run(true);
    sb.isoBeginPlacement();
    const caption = sb.isoLabel(10, 10, 20, 'PUMP STATION', '#93c5fd', 7, 1);
    /* wall off the whole vertical column the caption would climb */
    const cx = sb.iX(10, 10), cy = sb.iY(10, 10, 20);
    /* Tall and narrow, like a stack of equipment in one band: the vertical
     * ladder is walled off for its whole reach, but a sideways step escapes.
     * A wall wider than the ladder reaches is correctly unplaceable — that is
     * the caller's layout problem, not something the search should paper over. */
    sb.ISO_OCC.add({ x: cx - 20, y: cy - 200, w: 40, h: 400 }, { id: 'wall', kind: 'text' });
    const out = sb.isoResolvePlacement(caption);
    ok('I2c1', out.indexOf('<!--ISOFLEX') === -1, 'the caption must still be substituted');
    ok('I2c2', sb.ISO_UNPLACED === 0,
      `escalation must find a diagonal: unplaced=${sb.ISO_UNPLACED}`);
  }

  /* I3: without the engine the page still renders. This file is loaded by pages
   *     that have not adopted the engine, and a hard dependency would blank them —
   *     the failure mode the version-pin incident already cost us once. */
  {
    const sb = run(false);
    sb.isoBeginPlacement();
    const out = sb.isoResolvePlacement(sb.isoLabel(10, 10, 20, 'GENERATOR ROOM', '#93c5fd', 9, 1));
    ok('I3a', out.includes('GENERATOR ROOM'), 'the engine-less path must still draw the label');
    ok('I3b', out.indexOf('<!--ISOFLEX') === -1, 'and must not leave a token behind');
  }
}

/* ==========================================================================
 * UX LAWS — the checks that make a drawing readable, not just non-overlapping
 * ======================================================================== */

/* A diagram can have zero collisions and still fail its reader. These encode
 * three rules the engine now enforces rather than hopes for. */
{
  /* U1: WCAG 1.4.1, Use of Color. Two classes may not differ by hue alone —
   *     hue is lost in greyscale print, in this site's PDF export, and for a
   *     reader with colour-vision deficiency. The engine caught three real
   *     violations in its own demo the first time this ran. */
  {
    const c = D.create({ slug: 'u1', title: 'T', desc: 'D' });
    c.edge({ x: 0, y: 0 }, { x: 100, y: 0 }, { stroke: 'accent', pattern: 'solid', legend: 'Hot' });
    c.edge({ x: 0, y: 40 }, { x: 100, y: 40 }, { stroke: 'link', pattern: 'solid', legend: 'Cold' });
    c.legend();
    ok('U1a', c.warnings.some(w => w.kind === 'colour-only'),
      'two edges differing only in hue must warn');
  }
  {
    const c = D.create({ slug: 'u1b', title: 'T', desc: 'D' });
    c.edge({ x: 0, y: 0 }, { x: 100, y: 0 }, { stroke: 'accent', pattern: 'solid', legend: 'Hot' });
    c.edge({ x: 0, y: 40 }, { x: 100, y: 40 }, { stroke: 'link', pattern: 'dash-dot', legend: 'Cold' });
    c.legend();
    ok('U1b', !c.warnings.some(w => w.kind === 'colour-only'),
      'a second channel (pattern) clears the warning');
  }

  /* U2: Miller's ~7±2, which the skill fixes at nine nodes. Past that the
   *     reader stops seeing a structure and starts reading a list. */
  {
    const c = D.create({ slug: 'u2', title: 'T', desc: 'D' });
    for (let i = 0; i < 9; i++) c.node(i * 4, 0, { name: 'N' + i });
    ok('U2a', !c.warnings.some(w => w.kind === 'over-budget'), 'nine nodes is within budget');
    c.node(99, 0, { name: 'N9' });
    const over = c.warnings.filter(w => w.kind === 'over-budget');
    ok('U2b', over.length === 1, `the tenth node warns, once: got ${over.length}`);
  }

  /* U3: one label, one meaning. The demo shipped the same legend text on a node
   *     swatch and on a line, which reads as one entry drawn twice. */
  {
    const c = D.create({ slug: 'u3', title: 'T', desc: 'D' });
    c.node(0, 0, { name: 'A', legend: 'Air side' });
    c.edge({ x: 0, y: 80 }, { x: 100, y: 80 }, { stroke: 'soft', pattern: 'dotted', legend: 'Air side' });
    c.legend();
    ok('U3', c.warnings.some(w => w.kind === 'legend-duplicate'),
      'the same label on two channels must warn');
  }

  /* U4: the legend is DERIVED. It cannot list a treatment the drawing does not
   *     use, because the drawing wrote it. */
  {
    const c = D.create({ slug: 'u4', title: 'T', desc: 'D' });
    c.node(0, 0, { name: 'A', legend: 'Equipment' });
    c.node(0, 100, { name: 'B' });                    /* no legend: not classified */
    c.legend();
    const svg = c.render();
    ok('U4a', svg.includes('Equipment'), 'a declared class appears in the legend');
    ok('U4b', (svg.match(/LEGEND/g) || []).length === 1, 'exactly one legend strip');
  }

  /* U5: an empty legend draws nothing rather than an empty strip with a rule
   *     and a heading over blank space. */
  {
    const c = D.create({ slug: 'u5', title: 'T', desc: 'D' });
    c.node(0, 0, { name: 'A' });
    c.legend();
    ok('U5', !c.render().includes('LEGEND'), 'nothing classified, no legend drawn');
  }
}

/* ==========================================================================
 * TOKEN CONTRACT — a missing custom property fails silently, in one theme
 * ======================================================================== */

/* The engine emits no literal hex: every colour resolves to a custom property,
 * which is what lets one edit to a page's :root re-skin every diagram on it.
 * The other half of that bargain is that an adopting page must define the whole
 * set.
 *
 * The demo page called its panel colour --panel while the engine asked for
 * --bg3. The variable did not exist, fill="var(--bg3)" resolved to an invalid
 * value, and the focal node looked correct against dark paper while rendering
 * solid black with unreadable text against light. Nothing logged and nothing
 * threw. A dark-only screenshot showed no defect.
 *
 * So: enumerate what the engine demands, and check every page that adopts it. */
{
  const facade = readFileSync(join(root, 'js/rz-diagram.js'), 'utf8');
  const required = [...facade.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
  const uniq = [...new Set(required)].sort();

  ok('T1', uniq.length >= 8,
    `the engine should resolve a full palette, found ${uniq.length}: ${uniq.join(' ')}`);

  /* T2: no literal hex may leave the engine — the whole re-skin promise rests
   *     on this, and it is the sort of thing a hurried patch quietly breaks. */
  const hex = facade.match(/["'#]#[0-9a-fA-F]{3,8}\b/g) || [];
  ok('T2', hex.length === 0, `engine must emit no literal hex, found: ${hex.join(',')}`);

  /* T3: every page that loads the facade must define every property it asks
   *     for. Today no page has adopted it, so this asserts nothing and says so
   *     rather than reporting a pass it did not earn — it arms for the first
   *     adopter, which is precisely when the bug bites. */
  const pages = readdirSync(root).filter((f) => f.endsWith('.html'));
  const adopters = pages.filter((f) =>
    /<script[^>]+src="[^"]*js\/rz-diagram\.js/.test(readFileSync(join(root, f), 'utf8')));

  for (const page of adopters) {
    const html = readFileSync(join(root, page), 'utf8');
    const missing = uniq.filter((v) => !new RegExp(`${v}\\s*:`).test(html));
    ok(`T3:${page}`, missing.length === 0,
      `${page} loads the diagram engine but never defines ${missing.join(', ')} — ` +
      `an undefined property renders as an invalid value in one theme only`);
  }
  if (adopters.length === 0) {
    console.log('     note: no page loads js/rz-diagram.js yet, so T3 asserted nothing');
  }
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
