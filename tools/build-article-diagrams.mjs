#!/usr/bin/env node
/* ============================================================================
 * build-article-diagrams.mjs — explanatory figures for the article corpus
 * ----------------------------------------------------------------------------
 * WHY A BUILD STEP AND NOT A RUNTIME
 *
 * These figures are article content, not interface. Rendering them at build
 * time means they survive everything the site does to an article: the PDF
 * export, the Markdown extraction into llms-full.txt, a reader with JavaScript
 * off, and the first paint. A runtime renderer would lose all four and buy
 * nothing, because the content does not change after publication.
 *
 * HOW A FIGURE GETS INTO AN ARTICLE
 *
 * The author places an empty placeholder where the figure belongs:
 *
 *     <figure class="rz-figure" data-rz-figure="pfas-loss-zones"></figure>
 *
 * and this tool fills it. It never inserts a placeholder itself — where a
 * figure belongs in an argument is an editorial decision, and a tool that
 * guesses would put diagrams where the prose did not ask for one.
 *
 * Re-running replaces the contents of every placeholder it owns, so the figure
 * is regenerated from its definition rather than hand-maintained in markup.
 *
 * WHAT MAKES A FIGURE WORTH BUILDING
 *
 * The rule from the diagram-design skill, which decides every entry below:
 * *would the reader learn more from this than from a well-written paragraph?*
 * If the article already answers the question in a table or a sentence, a
 * diagram that restates it is noise. Each definition here carries a `because`
 * naming what the figure adds that the prose does not.
 *
 *   node tools/build-article-diagrams.mjs            # write
 *   node tools/build-article-diagrams.mjs --check    # verify, exit 1 on drift
 * ==========================================================================*/
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { convertedFigures } from './article-diagrams-converted.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const CHECK = process.argv.includes('--check');

/* ---- engine, in a sandbox with no DOM ----------------------------------- */
const sandbox = { module: { exports: {} }, console };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
/* rz-eng-symbols.js first: a node that asks for an IEC 60617 / ISA-5.1 glyph gets it
   from the same library DCMOC and the incident figures draw with. */
for (const rel of ['js/rz-eng-symbols.js', 'js/rz-diagram-metrics.js', 'js/rz-diagram-layout.js', 'js/rz-diagram.js']) {
  vm.runInContext(readFileSync(join(root, rel), 'utf8'), sandbox, { filename: rel });
}
const { RZDiagram: D, RZDiagramMetrics: M, RZDiagramLayout: L } = sandbox;

/* ==========================================================================
 * FIGURES
 * ======================================================================== */
/* ---- one definition, more than one page ---------------------------------
 * Articles 6 and 8 run the same instrument: a dimension model scored from the
 * reader's inputs, resampled ten thousand times for uncertainty AND swept
 * separately to find which input dominates. Both facts were verified against
 * each page's own code before this was placed — "it looks like the same kind of
 * article" is not verification, and article-1 was excluded on exactly that
 * check, since it scores dimensions but runs no Monte Carlo at all.
 * --------------------------------------------------------------------- */
function assessmentMethodFigure(D, M, L) {
  const ctx = D.create({
    slug: 'assess',
    title: 'How this assessment turns your inputs into a ranked set of actions',
    desc: 'Inputs are scored into a dimension model. That model is then used two ways: ' +
          'resampled ten thousand times to give a distribution rather than a single number, ' +
          'and swept one input at a time to find which of them the result is most sensitive ' +
          'to. The ranked actions are thresholds read off both, not advice written in advance.'
  });

  /* Left to right, fork and join. The first cut stacked the branches and sent
   * their results back to a node BELOW the fork, so each branch's outgoing edge
   * left the same side its incoming edge arrived at and the two dashed returns
   * ran back up through the outgoing pair. A fork that rejoins reads as a fork
   * only if nothing flows backwards. */
  const W = 280, BW = 300;
  const C1 = 40, C2 = 390, C3 = 760;

  const inputs = ctx.node(C1, 40, {
    id: 'in', tag: 'you set', name: 'Your inputs', sublabel: 'site, staffing, practice', w: W,
    stroke: 'rule-solid', fill: 'paper', tier: 2, legend: 'Pipeline stage'
  });
  const model = ctx.node(C1, 160, {
    id: 'model', tag: 'deterministic', name: 'Dimension model',
    sublabel: 'scored, not guessed', w: W,
    stroke: 'rule-solid', fill: 'paper', tier: 2
  });

  /* The fork is the point. One branch answers "how uncertain is this?", the
   * other "what is it most sensitive to?" — different questions, and a reader
   * shown one number has no reason to know either was asked. */
  const mc = ctx.node(C2, 108, {
    id: 'mc', tag: '10,000 runs', name: 'Monte Carlo resample',
    sublabel: 'p10 \u00B7 p50 \u00B7 p90, not one number', w: BW,
    stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'The two questions asked of the model'
  });
  const sens = ctx.node(C2, 228, {
    id: 'sens', tag: 'one at a time', name: 'Sensitivity sweep',
    sublabel: 'which input the answer turns on', w: BW,
    stroke: 'accent', fill: 'paper-2', tier: 1
  });

  const actions = ctx.node(C3, 168, {
    id: 'act', tag: 'derived', name: 'Ranked actions',
    sublabel: 'thresholds read off both', w: W,
    stroke: 'rule-solid', fill: 'paper', tier: 2
  });

  const cx = (n) => n.x + n.w / 2;
  const my = (n) => n.y + n.h / 2;

  ctx.edge({ x: cx(inputs), y: inputs.y + inputs.h }, { x: cx(model), y: model.y }, {
    fromId: 'in', toId: 'model', stroke: 'ink', tier: 2, pattern: 'solid'
  });

  const forkPorts = ctx.ports(model, 2, 'right', { id: 'model' });
  const joinPorts = ctx.ports(actions, 2, 'left', { id: 'act' });
  [mc, sens].forEach(function (n, i) {
    ctx.edge({ x: forkPorts[i].x, y: forkPorts[i].y }, { x: n.x, y: my(n) }, {
      fromId: 'model', toId: n.id, stroke: 'ink', tier: 2, pattern: 'solid'
    });
    ctx.edge({ x: n.x + n.w, y: my(n) }, { x: joinPorts[i].x, y: joinPorts[i].y }, {
      fromId: n.id, toId: 'act', stroke: 'muted', tier: 2, pattern: 'dashed',
      legend: i === 0 ? 'Both feed the ranking' : undefined
    });
  });

  ctx.legend();
  return ctx.fit(28);
}

/* ==========================================================================
 * Article 29 — "How a Large Language Model Actually Works" (eleven figures)
 * ----------------------------------------------------------------------------
 * These figures are laid out on a GRID, not by typed coordinates. A node names
 * its column and row; the column width is the widest node in the column,
 * measured with the engine's own metrics; the row pitch is the tallest node
 * plus a gap; zones are the bounding box of the nodes they name; connector
 * endpoints are the sides of the two boxes, fanned when several share a side,
 * and the engine routes between them. Nothing here is a number typed by eye,
 * so a longer sublabel widens its column instead of overflowing it.
 * ======================================================================== */
/* Phone variant. A figure refit to the 736 px column still scrolls inside a
 * 366 px phone column, and the owner reads that as cut off (article-30,
 * 2026-10-25). Shrinking it is no answer: at 0.5x a 9-unit label renders at
 * 4.5 px. So a figure may carry `phone`, a second composition of the SAME
 * nodes, edges and zones: one column in reading order, with side overrides
 * for the edges that would otherwise cross a box. The build loop draws it with
 * PHONE set and the page shows it below 800 px (css/rz-article-dark.css). */
let PHONE = false;
/* The phone drawing may shrink to the column, but only as far as its 9-unit
 * labels stay at the site's 8.5 px legibility floor (scale 0.945). A 375 px
 * phone has a 351 px column, so 368 units is the widest that still fits. */
const PHONE_MIN_SCALE = 0.945;
const PHONE_MAX_PX = 368;
function phoneSpec(spec) {
  const ph = spec.phone;
  const row = {};
  ph.order.forEach((id, i) => { row[id] = i; });
  const nodes = spec.nodes.map((n) => {
    if (row[n.id] == null) throw new Error(spec.slug + ': phone order misses node ' + n.id);
    return Object.assign({}, n, { col: 0, row: row[n.id] });
  });
  if (ph.order.length !== spec.nodes.length) throw new Error(spec.slug + ': phone order has extra ids');
  const edges = spec.edges.map((e, k) => {
    const o = (ph.edges || {})[k];
    const base = Object.assign({}, e);
    delete base.fs; delete base.ts;
    return o ? Object.assign(base, o) : base;
  });
  return Object.assign({}, spec, {
    slug: spec.slug + 'n', nodes, edges, gaps: [], colMin: ph.colMin,
    gapY: ph.gapY == null ? 28 : ph.gapY, top: ph.top, left: ph.left,
    zones: ph.zones || spec.zones, phone: undefined, fitPad: 20
  });
}

function gridFigure(spec) {
  if (PHONE) {
    if (!spec.phone) return null;
    PHONE = false;
    try {
      const c = gridFigure(phoneSpec(spec));
      c.variant = 'phone';
      return c;
    } finally { PHONE = true; }
  }
  const ctx = D.create({ slug: spec.slug, title: spec.title, desc: spec.desc });
  const X0 = spec.left == null ? 40 : spec.left, Y0 = spec.top == null ? 44 : spec.top;
  const GY = spec.gapY == null ? 36 : spec.gapY;
  const need = (n) => {
    const nameW = n.name ? M.textWidth(n.name, 12, 'sans') : 0;
    const subW = n.sub ? M.textWidth(n.sub, 9, 'mono') : 0;
    const tagW = n.tag ? M.textWidth(String(n.tag).toUpperCase(), 9, 'mono', { tracking: 0.18 }) + 10 : 0;
    const w = M.grid4(Math.max(nameW, subW, tagW, n.symbol ? 28 : 0) + 24);
    const h = M.grid4((n.tag ? 18 : 0) + (n.symbol ? 32 : 0) + (n.name ? 16 : 0) + (n.sub ? 14 : 0) + 24);
    return { w, h: Math.max(h, n.h || 0) };
  };
  const nodes = spec.nodes.map((n) => Object.assign({}, n, { need: need(n) }));
  const ncols = Math.max(...nodes.map((n) => n.col)) + 1;
  const colW = [];
  for (let c = 0; c < ncols; c++) {
    colW[c] = Math.max((spec.colMin || [])[c] || 0,
      ...nodes.filter((n) => n.col === c).map((n) => n.need.w), 0);
  }
  const gaps = spec.gaps || [];
  const colX = [];
  let x = X0;
  for (let c = 0; c < ncols; c++) { colX[c] = x; x += colW[c] + (gaps[c] == null ? 56 : gaps[c]); }
  const maxH = Math.max(...nodes.map((n) => n.need.h));
  const pitch = maxH + GY;
  const box = {};
  nodes.forEach((n) => {
    const h = n.need.h;
    box[n.id] = { x: colX[n.col], y: Y0 + n.row * pitch + (maxH - h) / 2, w: colW[n.col], h };
  });

  const bounds = (ids, pad) => {
    const bs = ids.map((i) => box[i]);
    const p = Object.assign({ t: 30, b: 14, l: 16, r: 16 }, pad || {});
    const x1 = Math.min(...bs.map((b) => b.x)) - p.l, y1 = Math.min(...bs.map((b) => b.y)) - p.t;
    const x2 = Math.max(...bs.map((b) => b.x + b.w)) + p.r, y2 = Math.max(...bs.map((b) => b.y + b.h)) + p.b;
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };
  (spec.zones || []).forEach((z) => {
    let b;
    if (z.cols) {                         /* a lane: the whole height, named columns only */
      const all = bounds(nodes.map((n) => n.id), z.pad);
      const xs = z.cols;
      const x1 = colX[Math.min(...xs)] - 14, x2 = colX[Math.max(...xs)] + colW[Math.max(...xs)] + 14;
      b = { x: x1, y: all.y, w: x2 - x1, h: all.h };
    } else b = bounds(z.ids, z.pad);
    const lw = M.textWidth(String(z.label).toUpperCase(), 9, 'mono', { tracking: 0.18 }) + 24;
    if (lw > b.w) ctx.warnings.push({ kind: 'zone-label-overflow',
      message: 'zone "' + z.label + '" needs ' + Math.ceil(lw) + ' units, zone is ' + Math.round(b.w) });
    ctx.zone(b.x, b.y, b.w, b.h, { label: z.label, tier: 3, dashed: z.dashed !== false });
  });

  nodes.forEach((n) => {
    const b = box[n.id];
    ctx.node(b.x, b.y, {
      id: n.id, tag: n.tag, name: n.name, sublabel: n.sub, w: b.w, h: b.h,
      stroke: n.stroke || 'rule-solid', fill: n.fill || 'paper', tier: n.tier || 2,
      dashed: n.dashed, symbol: n.symbol, legend: n.legend, vAlign: n.symbol ? undefined : 'middle'
    });
  });

  const cx = (i) => box[i].x + box[i].w / 2, cy = (i) => box[i].y + box[i].h / 2;
  const SIDE = { l: 'left', r: 'right', t: 'top', b: 'bottom' };
  const edges = spec.edges.map((e, k) => {
    let fs = e.fs, ts = e.ts;
    const dx = cx(e.b) - cx(e.a), dy = cy(e.b) - cy(e.a);
    if (!fs || !ts) {
      if (Math.abs(dy) < 4) { fs = fs || (dx > 0 ? 'r' : 'l'); ts = ts || (dx > 0 ? 'l' : 'r'); }
      else if (Math.abs(dx) < 4) { fs = fs || (dy > 0 ? 'b' : 't'); ts = ts || (dy > 0 ? 't' : 'b'); }
      else { fs = fs || (dx > 0 ? 'r' : 'l'); ts = ts || (dy > 0 ? 't' : 'b'); }
    }
    return Object.assign({}, e, { fs, ts, k });
  });
  /* fan the connectors that share a side, ordered by where the other end is, so they do not cross */
  const groups = {};
  edges.forEach((e) => {
    (groups[e.a + ':' + e.fs] = groups[e.a + ':' + e.fs] || []).push({ e, end: 'from', other: e.b });
    (groups[e.b + ':' + e.ts] = groups[e.b + ':' + e.ts] || []).push({ e, end: 'to', other: e.a });
  });
  Object.keys(groups).forEach((key) => {
    const [id, side] = key.split(':');
    const g = groups[key];
    const vertical = side === 'l' || side === 'r';
    g.sort((p, q) => (vertical ? cy(p.other) - cy(q.other) : cx(p.other) - cx(q.other)) || (p.e.k - q.e.k));
    const pts = ctx.ports(box[id], g.length, SIDE[side], { id });
    g.forEach((m, i) => { m.e[m.end === 'from' ? 'pf' : 'pt'] = pts[i]; });
  });
  let anyLegend = nodes.some((n) => n.legend);
  edges.forEach((e) => {
    if (e.legend) anyLegend = true;
    ctx.edge({ x: e.pf.x, y: e.pf.y }, { x: e.pt.x, y: e.pt.y }, {
      fromId: e.a, toId: e.b, stroke: e.stroke || 'ink', tier: e.tier || 2,
      pattern: e.pattern || 'solid', label: e.label, legend: e.legend
    });
  });
  if (anyLegend) ctx.legend();
  return ctx.fit(spec.fitPad || 28);
}

const LLM_FIGURES = [
  /* ---------------------------------------------------------------- D1 */
  {
    id: 'llm-d1', page: 'article-29.html',
    caption:
      'One decoder block, repeated 80 times in Llama 3 70B [S2]. Each sub-layer reads the residual stream, ' +
      'computes something, and ADDS it back, so the stream is never replaced, only written to. Attention also ' +
      'writes this token’s keys and values to a cache that costs 320 KiB per token (derived from [S2]).',
    because:
      'the prose lists the parts of a block in sequence; the two skip connections and the cache loop are ' +
      'topology. A list cannot show that the stream bypasses each sub-layer, or that attention reads what a ' +
      'previous step wrote.',
    build: () => gridFigure({
      slug: 'llm1', title: 'One decoder block',
      desc: 'Token vectors pass through attention and a feed-forward network; each adds its result back to the residual stream.',
      gaps: [60, 110], colMin: [240],
      nodes: [
        { id: 'in', col: 0, row: 0, tag: 'width 8,192 [S2]', name: 'Residual stream in', sub: 'one vector per token' },
        { id: 'n1', col: 1, row: 1, name: 'RMSNorm' },
        { id: 'att', col: 1, row: 2, tag: '64 Q · 8 KV heads [S2]', name: 'Self-attention', sub: 'grouped-query (GQA)',
          stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Sub-layer that reads and writes the stream' },
        { id: 'add1', col: 0, row: 2, name: '+', sub: 'residual add', legend: 'Normalise and add' },
        { id: 'n2', col: 1, row: 3, name: 'RMSNorm' },
        { id: 'ffn', col: 1, row: 4, tag: '2/3 of block weights', name: 'Feed-forward (SwiGLU)', sub: 'derived',
          stroke: 'accent', fill: 'paper-2', tier: 1 },
        { id: 'add2', col: 0, row: 4, name: '+', sub: 'residual add' },
        { id: 'out', col: 0, row: 5, name: 'Residual stream out' },
        { id: 'kv', col: 2, row: 2, tag: '320 KiB / token', name: 'KV cache', sub: 'derived',
          dashed: true, legend: 'State kept between tokens' }
      ],
      edges: [
        { a: 'in', b: 'n1' }, { a: 'n1', b: 'att' }, { a: 'att', b: 'add1' },
        { a: 'in', b: 'add1', label: 'skip', stroke: 'muted', pattern: 'dashed', legend: 'Skip connection' },
        { a: 'add1', b: 'n2', fs: 'r', ts: 'l' }, { a: 'n2', b: 'ffn' }, { a: 'ffn', b: 'add2' },
        { a: 'add1', b: 'add2', label: 'skip', stroke: 'muted', pattern: 'dashed' },
        { a: 'add2', b: 'out' },
        { a: 'att', b: 'kv', label: 'write K,V' }, { a: 'kv', b: 'att', label: 'read past K,V', fs: 'l', ts: 'r' }
      ],
      zones: [{ ids: ['n1', 'att', 'add1', 'n2', 'ffn', 'add2'], label: '× 80 layers [S2]' }]
    })
  },
  /* ---------------------------------------------------------------- D2 */
  {
    id: 'llm-d2', page: 'article-29.html',
    caption:
      'One attention head. Scores are Q·K^T divided by √128 = 11.3 (derived, head size d_h = 128), masked so ' +
      'a token cannot see the future, softmaxed into weights, and used to average V. The grey zone is the part whose ' +
      'cost grows as n², which FlashAttention keeps in on-chip SRAM [S50].',
    because:
      'the equation is one line in the prose, but the order matters and the mask sits between scores and softmax. ' +
      'Drawn, the n×n block is visibly the only stage that scales quadratically.',
    build: () => gridFigure({
      slug: 'llm2', title: 'Attention head',
      desc: 'Queries score keys; softmax turns scores into weights; weights average values.',
      gaps: [60, 70],
      nodes: [
        { id: 'x', col: 0, row: 1.75, name: 'Token vectors X', sub: 'n × d' },
        { id: 'q', col: 1, row: 0, name: 'Q = X·W_Q' },
        { id: 'k', col: 1, row: 1, name: 'K = X·W_K' },
        { id: 'v', col: 1, row: 3.5, name: 'V = X·W_V' },
        { id: 's', col: 2, row: 0.5, h: 56, tag: '√128 = 11.3', name: 'Scores', sub: 'Q·K^T / √d_h, d_h = 128',
          stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'The n×n stage' },
        { id: 'm', col: 2, row: 1.5, name: 'Causal mask', sub: 'future = −∞' },
        { id: 'sm', col: 2, row: 2.5, name: 'Softmax', sub: 'rows sum to 1' },
        { id: 'o', col: 2, row: 3.5, name: 'Output', sub: 'A·V' }
      ],
      edges: [
        { a: 'x', b: 'q', ts: 'l' }, { a: 'x', b: 'k', ts: 'l' }, { a: 'x', b: 'v', ts: 'l' },
        { a: 'q', b: 's', ts: 'l' }, { a: 'k', b: 's', ts: 'l', label: 'transpose' },
        { a: 's', b: 'm' }, { a: 'm', b: 'sm' }, { a: 'sm', b: 'o', label: 'weights A' }, { a: 'v', b: 'o' }
      ],
      zones: [{ ids: ['s', 'm', 'sm'], label: 'O(n²·d) · SRAM [S50]' }]
    })
  },
  /* ---------------------------------------------------------------- D3 */
  {
    id: 'llm-d3', page: 'article-29.html',
    caption:
      'Why context fills a GPU. KV memory grows linearly: 2.5 GiB at 8K, 10 GiB at 32K, 40 GiB at 128K for one Llama 3 70B ' +
      'conversation, next to 70.6 GB of FP8 weights on a 141 GB H200 [S2][S9]. Below, the same 128K costs 40, 8.6 or 100 GiB ' +
      'depending on the attention design (GQA, MLA, MHA) [S1][S2][S30].',
    because:
      'a table can list 2.5, 10 and 40 GiB; it cannot show that the 40 GiB lands on the same chip as the weights, ' +
      'or that the attention design alone moves the same context from 8.6 to 100 GiB.',
    build: () => gridFigure({
      slug: 'llm3', title: 'Why context fills a GPU',
      desc: 'KV memory grows linearly with tokens; at 128K one Llama 3 70B conversation needs 40 GiB.',
      gaps: [56, 96], gapY: 40,
      nodes: [
        { id: 'k8', col: 0, row: 0, name: 'KV at 8K', sub: '2.5 GiB' },
        { id: 'k32', col: 1, row: 0, name: 'KV at 32K', sub: '10 GiB' },
        { id: 'k128', col: 2, row: 0, tag: 'grows with context', name: 'KV at 128K', sub: '40 GiB',
          stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'The part that grows with context' },
        { id: 'w', col: 1, row: 1, tag: 'FP8', name: 'Weights', sub: '70.6 GB' },
        { id: 'gpu', col: 2, row: 1, tag: '141 GB [S9]', name: 'H200 HBM', sub: 'weights + KV must fit' },
        { id: 'l70', col: 0, row: 2.4, tag: '[S2]', name: 'Llama 3 70B · GQA', sub: '40 GiB at 128K' },
        { id: 'ds', col: 1, row: 2.4, tag: '[S1]', name: 'DeepSeek-V3 · MLA', sub: '8.6 GiB at 128K' },
        { id: 'opt', col: 2, row: 2.4, tag: '[S30]', name: 'OPT-13B · MHA', sub: '100 GiB at 128K' }
      ],
      edges: [
        { a: 'k8', b: 'k32', label: '×4' }, { a: 'k32', b: 'k128', label: '×4' },
        { a: 'w', b: 'gpu', label: 'resident' }, { a: 'k128', b: 'gpu', label: '+40 GiB' }
      ],
      zones: [{ ids: ['l70', 'ds', 'opt'], label: 'Same 128K context, three attention designs' }]
    })
  },
  /* ---------------------------------------------------------------- D4 */
  {
    id: 'llm-d4', page: 'article-29.html',
    caption:
      'Mixture-of-experts routing in DeepSeek-V3 [S1]. A router scores 256 experts per token and sends it to the top 8, plus ' +
      'one shared expert that always runs; the other 248 are skipped. Only 37B of 671B parameters run per token ' +
      '(5.5 %, derived), and routing is limited to 4 nodes per token to bound all-to-all traffic.',
    because:
      'the active-parameter count is one sentence in the prose, but “skipped” is a place, not a quantity: the 248 idle ' +
      'experts are still in memory. The drawing separates what is stored from what is computed.',
    build: () => gridFigure({
      slug: 'llm4', title: 'Mixture of Experts routing',
      desc: 'A router sends each token to 8 of 256 experts plus one shared expert; only 37B of 671B parameters run.',
      gaps: [48, 76, 48],
      nodes: [
        { id: 'tok', col: 0, row: 2, tag: 'width 7,168 [S1]', name: 'Token vector' },
        { id: 'r', col: 1, row: 2, h: 80, tag: '[S1]', name: 'Router', sub: 'sigmoid affinity + bias',
          stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'The decision' },
        { id: 'e1', col: 2, row: 0, name: 'Expert 17', sub: 'one of top-8' },
        { id: 'e2', col: 2, row: 1, name: 'Expert 88', sub: 'one of top-8' },
        { id: 'e3', col: 2, row: 2, name: '… 6 more', sub: 'top-8 in all' },
        { id: 'sh', col: 2, row: 4, tag: 'always on', name: 'Shared expert' },
        { id: 'idle', col: 2, row: 3, name: '248 idle experts', sub: 'stored, not computed',
          stroke: 'soft', dashed: true, legend: 'In memory, skipped' },
        { id: 'sum', col: 3, row: 2, h: 76, tag: '8 + 1', name: 'Weighted sum', sub: 'original-affinity gates' },
        { id: 'out', col: 3, row: 3.6, tag: '37B of 671B run', name: 'To next layer', sub: '5.5 % of parameters' }
      ],
      edges: [
        { a: 'tok', b: 'r' }, { a: 'r', b: 'e1', ts: 'l' }, { a: 'r', b: 'e2', ts: 'l', label: 'top-8' }, { a: 'r', b: 'e3', ts: 'l' },
        { a: 'tok', b: 'sh', fs: 'b', ts: 'l' },
        { a: 'e1', b: 'sum', fs: 'r', ts: 'l' }, { a: 'e2', b: 'sum', fs: 'r', ts: 'l' }, { a: 'e3', b: 'sum', fs: 'r', ts: 'l' },
        { a: 'sh', b: 'sum', fs: 'r', ts: 'l' },
        { a: 'sum', b: 'out' },
        { a: 'r', b: 'idle', ts: 'l', label: 'skipped', stroke: 'soft', pattern: 'dashed' }
      ],
      zones: [{ ids: ['e1', 'e2', 'e3'], label: '≤ 4 nodes [S1]' }]
    })
  },
  /* ---------------------------------------------------------------- D5 */
  {
    id: 'llm-d5', page: 'article-29.html',
    caption:
      'From web text to assistant. Llama 3 pre-trains on 15.6T tokens for 3.8×10²⁵ FLOP [S2], about 25 MW on 16K H100 ' +
      '(derived); the mix is 50 % general, 25 % math, 17 % code, 8 % multilingual [S2]. Post-training adds SFT and RL, and the ' +
      'RL model can be distilled: a 32B student keeps 91 % of the teacher’s AIME score [S4][S54].',
    because:
      'the pipeline is the ORDER of stages, and the numbers belong to different stages. In prose the reader holds ten ' +
      'stages in mind; drawn, the compute-heavy stage is the one boxed and the distil branch visibly leaves from RL.',
    build: () => gridFigure({
      slug: 'llm5', title: 'From web text to assistant',
      desc: 'Data is filtered and mixed, pre-trained at scale, then post-trained with SFT and RL.',
      gaps: [52, 52], gapY: 60, colMin: [160, 216, 256],
      nodes: [
        { id: 'a', col: 0, row: 0, tag: 'raw sources', name: 'Collect + filter', sub: 'dedup · quality · PII' },
        { id: 'b', col: 1, row: 0, tag: '[S2]', name: 'Data mix', sub: 'gen 50 · math 25 · code 17 · multi 8' },
        { id: 'c', col: 2, row: 0, tag: '128K vocab [S2]', name: 'Tokenize' },
        { id: 'd', col: 2, row: 1, tag: '[S2]', name: 'Pre-training', sub: '15.6T tokens · 3.8e25 FLOP',
          stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Where the compute goes' },
        { id: 'e', col: 1, row: 1, tag: '[S1]', name: 'Context extension', sub: '4K → 32K → 128K' },
        { id: 'f', col: 0, row: 1, name: 'SFT', sub: 'supervised fine-tuning' },
        { id: 'g', col: 0, row: 2, tag: '[S4][S54]', name: 'RL: RLHF / DPO / GRPO', sub: 'verifiable rewards' },
        { id: 'h', col: 1, row: 2, name: 'Evals + safety → release', sub: 'weights or API' },
        { id: 'i', col: 0, row: 3, tag: '[S4]', name: 'Distill to students', sub: '32B keeps 91 % of AIME', dashed: true,
          legend: 'Branch, not a stage' }
      ],
      edges: [
        { a: 'a', b: 'b' }, { a: 'b', b: 'c' }, { a: 'c', b: 'd' }, { a: 'd', b: 'e' }, { a: 'e', b: 'f' },
        { a: 'f', b: 'g' }, { a: 'g', b: 'h' },
        { a: 'g', b: 'i', label: 'distil', stroke: 'muted', pattern: 'dashed' }
      ],
      zones: [
        { ids: ['a', 'b', 'c'], label: 'Data' },
        { ids: ['d'], label: '16K H100 · 25 MW' },
        { ids: ['f', 'g', 'i'], label: 'Post-training' }
      ]
    })
  },
  /* ---------------------------------------------------------------- D6 */
  {
    id: 'llm-d6', page: 'article-29.html',
    caption:
      'What a GPU does when you hit Enter. Prefill of a 4,000-token prompt runs in parallel and is compute-bound, about 0.57 s ' +
      'on an H200 (derived). Each decode step then re-reads all 70.6 GB of weights plus the KV cache, about 114 GB per step at batch ' +
      '32: 23.7 ms ideal, 39.4 ms at 60 % bandwidth utilisation (derived). New requests join the running batch [S30].',
    because:
      'two numbers, 0.57 s and 23.7 ms, come from different bottlenecks, and the prose cannot put them on the same clock. ' +
      'The swimlane shows that every decode step touches memory again while prefill touches it once.',
    build: () => gridFigure({
      slug: 'llm6', title: 'What a GPU does when you hit Enter',
      desc: 'Prefill processes the whole prompt in parallel; decode emits one token per step and is bandwidth-bound.',
      gaps: [60, 60], gapY: 28,
      nodes: [
        { id: 'q', col: 0, row: 0, name: 'Request queued' },
        { id: 'join', col: 0, row: 3, tag: '[S30]', name: 'Continuous batching', sub: 'new requests join here',
          stroke: 'soft', dashed: true, legend: 'Scheduler event' },
        { id: 'done', col: 0, row: 5, name: 'EOS', sub: 'sequence ends' },
        { id: 'pf', col: 1, row: 1, tag: 'compute-bound', name: 'Prefill 4,000 tokens', sub: '≈ 0.57 s on H200 (derived)',
          stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Compute-bound step' },
        { id: 'ttft', col: 1, row: 2, name: 'First token', sub: 'TTFT ≈ 0.57 s' },
        { id: 'd1', col: 1, row: 3, tag: 'memory-bound', name: 'Decode step 1', sub: 'reads weights + KV' },
        { id: 'd2', col: 1, row: 4, name: 'Decode step 2', sub: '23.7 ms ideal · 39.4 at 60 %' },
        { id: 'dn', col: 1, row: 5, name: '… step n', sub: 'one token per step' },
        { id: 'hb', col: 2, row: 4, tag: 'derived', name: 'Weights + KV per step', sub: '≈ 114 GB at batch 32' }
      ],
      edges: [
        { a: 'q', b: 'pf' }, { a: 'pf', b: 'ttft' }, { a: 'ttft', b: 'd1' }, { a: 'd1', b: 'd2' }, { a: 'd2', b: 'dn' },
        { a: 'dn', b: 'done' }, { a: 'join', b: 'd1', label: 'joins', stroke: 'muted', pattern: 'dashed' },
        { a: 'd1', b: 'hb', stroke: 'soft', pattern: 'dotted', label: 'memory-bound', legend: 'Reads HBM every step' },
        { a: 'd2', b: 'hb', stroke: 'soft', pattern: 'dotted' },
        { a: 'dn', b: 'hb', stroke: 'soft', pattern: 'dotted' }
      ],
      zones: [
        { cols: [0], label: 'Scheduler' }, { cols: [1], label: 'GPU compute' }, { cols: [2], label: 'HBM traffic' }
      ]
    })
  },
  /* ---------------------------------------------------------------- D7 */
  {
    id: 'llm-d7', page: 'article-29.html',
    caption:
      'The hardware ladder, laptop to campus. Memory, bandwidth and power each jump at every rung: 819 GB/s at 512 GB unified ' +
      '[S71], 8×H200 for 1.13 TB [S9], a 72-GPU rack with 13.4 TB HBM at 132 kW [S10][S68], a 9,216-chip pod near 10 MW [S14], ' +
      'then 150 MW to 1.2 GW campuses [S19][S20]. Liquid cooling becomes mandatory at the rack [S10][S14]. Multipliers derived.',
    because:
      'the prose gives each rung its own paragraph, so the reader meets 819 GB/s and 1.2 GW in different places. One column ' +
      'shows the jump in scale and where the cooling regime changes.',
    build: () => gridFigure({
      slug: 'llm7', title: 'From laptop to gigawatt campus',
      desc: 'Each rung multiplies memory, bandwidth and power; the model you can serve or train follows.',
      gapY: 64, colMin: [320],
      nodes: [
        { id: 'L0', col: 0, row: 0, tag: 'serves 70B Q4', name: 'Laptop / Mac Studio', sub: '≤512 GB unified · 819 GB/s [S71]' },
        { id: 'L1', col: 0, row: 1, tag: 'serves 8–32B', name: 'Workstation GPU', sub: 'RTX 5090 32 GB · 1.79 TB/s · 575 W [S15]' },
        { id: 'L2', col: 0, row: 2, tag: 'serves 405B FP8', name: '8-GPU server', sub: '8×H200 1.13 TB · 10–14 kW [S9][S70][S12]' },
        { id: 'L3', col: 0, row: 3, tag: '1T-param MoE', name: 'NVL72 rack', symbol: 'rack',
          sub: '72 GPUs · 13.4 TB HBM · 132 kW liquid [S10][S68]',
          stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Liquid-cooled rungs' },
        { id: 'L4', col: 0, row: 4, tag: '≈ 10 MW', name: 'Pod', sub: 'Ironwood 9,216 chips · 42.5 EF [S14]' },
        { id: 'L5', col: 0, row: 5, tag: '150 MW – 1.2 GW', name: 'Campus', sub: '100k–200k+ GPUs [S19][S20]' }
      ],
      edges: [
        { a: 'L0', b: 'L1', label: '×2.2 bandwidth' }, { a: 'L1', b: 'L2', label: '×8 GPUs' },
        { a: 'L2', b: 'L3', label: '×9 GPUs, ×10 kW' }, { a: 'L3', b: 'L4', label: '×128 chips' },
        { a: 'L4', b: 'L5', label: '×15–120 power' }
      ],
      zones: [
        { ids: ['L0', 'L1', 'L2'], label: 'Air-cooled [S10]', pad: { b: 8 } },
        { ids: ['L3', 'L4', 'L5'], label: 'Liquid cooling [S10][S14]', pad: { t: 30, b: 8 } }
      ]
    })
  },
  /* ---------------------------------------------------------------- D8 */
  {
    id: 'llm-d8', page: 'article-29.html',
    caption:
      'An agent is a loop the harness controls. The model only proposes a tool call; the harness gates it, runs it in a sandbox, ' +
      'feeds the observation back as untrusted input, and lets the verifier decide whether to stop [S61]. A budget caps steps, tokens ' +
      'and time. Example: a 30-step run costs about $2.64 uncached and about $0.36 with prompt caching (derived, section 8.2).',
    because:
      'the prose says “the agent decides”; the drawing shows it does not. Only the model is vendor code, the verifier ' +
      'and the budget sit outside it, and the observation arrow re-enters the context as untrusted text.',
    build: () => gridFigure({
      slug: 'llm8', title: 'An agent is a loop the harness controls',
      desc: 'The model proposes; the harness executes in a sandbox, verifies, and decides whether to continue.',
      gaps: [52, 52, 64],
      nodes: [
        { id: 'user', col: 0, row: 0, name: 'Goal / task', stroke: 'soft', fill: 'paper-2', dashed: true, legend: 'Task in, result out' },
        { id: 'ver', col: 2, row: 0, name: 'Verifier', sub: 'tests · linters · evaluator',
          legend: 'Harness (your code)' },
        { id: 'done', col: 3, row: 0, tag: 'derived', name: 'Result + log', sub: '$2.64 → $0.36 cached', stroke: 'soft', fill: 'paper-2', dashed: true },
        { id: 'ctx', col: 1, row: 1, name: 'Context manager', sub: 'prompt · memory · cache' },
        { id: 'llm', col: 2, row: 1, tag: 'vendor', name: 'Model', sub: 'plan → tool call (JSON)',
          stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Model (vendor)' },
        { id: 'bud', col: 3, row: 1, name: 'Budget', sub: 'steps · tokens · time' },
        { id: 'obs', col: 0, row: 2, tag: 'untrusted', name: 'Observation', sub: 'tool output is data',
          stroke: 'alarm-caution', dashed: true, legend: 'Untrusted input' },
        { id: 'sbx', col: 1, row: 2, name: 'Sandbox + MCP tools', sub: 'no secrets · egress control' },
        { id: 'gate', col: 2, row: 2, name: 'Policy gate', sub: 'allowlist · approval [S61]' }
      ],
      edges: [
        { a: 'user', b: 'ctx', fs: 'r', ts: 't' }, { a: 'ctx', b: 'llm' },
        { a: 'llm', b: 'gate' }, { a: 'gate', b: 'sbx' }, { a: 'sbx', b: 'obs' },
        { a: 'obs', b: 'ctx', fs: 't', ts: 'l', label: 'loop', stroke: 'accent', tier: 1 },
        { a: 'llm', b: 'ver', label: 'candidate' }, { a: 'ver', b: 'done', label: 'pass' },
        { a: 'ver', b: 'ctx', fs: 'l', ts: 't', label: 'fail: feedback' },
        { a: 'bud', b: 'llm', stroke: 'muted', pattern: 'dashed', legend: 'Stops the loop when exceeded' }
      ]
    })
  },
  /* ---------------------------------------------------------------- D9 */
  {
    id: 'llm-d9', page: 'article-29.html',
    caption:
      'Distillation. DeepSeek-R1 (671B, 37B active) scores 79.8 on AIME24; its reasoning traces fine-tune a Qwen2.5-32B student ' +
      'to 72.6, 91 % of the teacher with 4.8 % of the parameters [S4]. Matching soft logits instead of traces is the other route ' +
      '[S56]; Qwen3 reports about a tenth of the GPU-hours of RL [S3].',
    because:
      'the three nouns, teacher, trace and student, are easy to blur in prose. The drawing fixes who produces what, and ' +
      'shows the logit route as an alternative that ends at the same SFT step.',
    build: () => gridFigure({
      slug: 'llm9', title: 'Distillation',
      desc: 'A large teacher’s outputs train a small student that keeps most of the skill at a fraction of the size.',
      gaps: [52, 52, 52],
      nodes: [
        { id: 't', col: 0, row: 1.5, tag: 'AIME24 79.8 [S4]', name: 'Teacher: DeepSeek-R1', sub: '671B / 37B active',
          stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Teacher and result' },
        { id: 'gen', col: 1, row: 1, name: 'Reasoning traces', sub: 'sequence-level' },
        { id: 'logit', col: 1, row: 2, tag: '[S56]', name: 'Soft targets (logits)', sub: 'logit-level, alternative',
          stroke: 'soft', dashed: true, legend: 'Alternative route' },
        { id: 's', col: 2, row: 0, name: 'Student: Qwen2.5-32B', sub: 'base model' },
        { id: 'sft', col: 2, row: 1, name: 'SFT on traces' },
        { id: 'res', col: 3, row: 1, tag: 'AIME24 72.6 [S4]', name: 'R1-Distill-Qwen-32B', sub: '91 % of teacher · 4.8 % size',
          stroke: 'accent', fill: 'paper-2', tier: 1 },
        { id: 'q3', col: 3, row: 0, tag: '[S3]', name: 'Qwen3 strong-to-weak', sub: '≈ 1/10 the GPU-hours of RL',
          stroke: 'soft', dashed: true }
      ],
      edges: [
        { a: 't', b: 'gen', ts: 'l' }, { a: 't', b: 'logit', ts: 'l' }, { a: 'gen', b: 'sft' },
        { a: 'logit', b: 'sft', fs: 'r', ts: 'b', stroke: 'muted', pattern: 'dashed' },
        { a: 's', b: 'sft' }, { a: 'sft', b: 'res' }
      ]
    })
  },
  /* --------------------------------------------------------------- D10 */
  {
    id: 'llm-d10', page: 'article-29.html',
    caption:
      'Roofline in blocks: why decode waits on memory. Below the ridge point, speed is set by bandwidth; above it, by compute. Ridge: ' +
      'H100 295 FLOP/B [S8], H200 206 [S9], MI355X 625 [S13]. Decode at batch 1 does about 1 FLOP per byte, batch 32 about 32, a ' +
      '4K-token prefill about 4,000. Derived from vendor peak and bandwidth; dense FLOPs.',
    because:
      'the log-log chart carries the exact curves; this block version only says which workload sits on which side. It restates ' +
      'the table of ridge points, so it is kept minimal.',
    build: () => gridFigure({
      slug: 'llm10', title: 'Roofline: why decode waits on memory',
      desc: 'Below the ridge point performance is set by bandwidth; above it, by compute.',
      gaps: [56, 56], colMin: [0, 0, 200],
      nodes: [
        { id: 'bw', col: 0, row: 0, tag: 'slope', name: 'Bandwidth roof', sub: 'H100 3.35 \u00B7 H200 4.8 \u00B7 MI355X 8 TB/s' },
        { id: 'd1', col: 0, row: 1, tag: '\u2248 1 FLOP/B', name: 'Decode, batch 1', sub: 'weights re-read per token' },
        { id: 'd32', col: 0, row: 2, tag: '\u2248 32 FLOP/B', name: 'Decode, batch 32', sub: 'weights shared by 32 users' },
        { id: 'ridge', col: 1, row: 2, tag: '[S8][S9][S13]', name: 'Ridge point', sub: 'H100 295 \u00B7 H200 206 \u00B7 MI355X 625',
          stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Where the limit changes' },
        { id: 'cp', col: 2, row: 0, tag: 'flat roof', name: 'Compute roof', sub: 'H100 989 TF \u00B7 MI355X 5 PF' },
        { id: 'pre', col: 2, row: 2, tag: '\u2248 4,000 FLOP/B', name: 'Prefill, 4K prompt', sub: 'all prompt tokens at once' }
      ],
      edges: [
        { a: 'd1', b: 'd32', label: 'batch \u00D732' }, { a: 'd32', b: 'ridge' }, { a: 'ridge', b: 'pre' },
        { a: 'bw', b: 'ridge', fs: 'r', ts: 't' }, { a: 'cp', b: 'ridge', fs: 'l', ts: 't', stroke: 'muted', pattern: 'dashed' }
      ],
      zones: [
        { ids: ['bw', 'd1', 'd32'], label: 'Bandwidth-bound: below ridge' },
        { ids: ['cp', 'pre'], label: 'Compute-bound: above ridge' }
      ]
    })
  },
  /* --------------------------------------------------------------- D11 */
  {
    id: 'llm-d11', page: 'article-29.html',
    caption:
      'What the model sees. A sentence becomes sub-word tokens, then integer IDs, then one embedding row per ID. The same text costs ' +
      'more tokens in Indonesian: about 1.20 tokens per English word against 1.60 to 2.05 for Indonesian on o200k (measured [S72]).',
    because:
      'the 1.20 versus 1.60–2.05 ratio is a table row; the drawing adds the actual split of one Indonesian phrase, which ' +
      'shows why the ratio is above 1 (long affixed words break into pieces).',
    build: () => gridFigure({
      slug: 'llm11', title: 'What the model sees',
      desc: 'The same sentence costs more tokens in Indonesian.',
      gaps: [72],
      nodes: [
        { id: 'en', col: 0, row: 0, tag: 'Indonesian text', name: '‘pendinginan’ · ‘dikonsumsi’ · ‘Transformer’' },
        { id: 'tokid', col: 0, row: 1, tag: 'o200k · measured [S72]', name: 'pending|inan · dik|onsum|si · Transformer',
          stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Where the cost is counted' },
        { id: 'ids', col: 0, row: 2, name: 'Integer IDs', sub: 'one per token' },
        { id: 'emb', col: 0, row: 3, name: 'Embedding rows', sub: 'one vector per ID' },
        { id: 'cen', col: 1, row: 0.5, tag: 'English', name: '1.20 tok/word', stroke: 'soft', dashed: true, legend: 'Tokens per word' },
        { id: 'cid', col: 1, row: 1.5, tag: 'Indonesian [S72]', name: '1.60–2.05 tok/word', stroke: 'soft', dashed: true }
      ],
      edges: [
        { a: 'en', b: 'tokid' }, { a: 'tokid', b: 'ids' }, { a: 'ids', b: 'emb' },
        { a: 'tokid', b: 'cen', ts: 'l', stroke: 'muted', pattern: 'dotted' }, { a: 'tokid', b: 'cid', ts: 'l', stroke: 'muted', pattern: 'dotted' }
      ]
    })
  }
];

/* ==========================================================================
 * Article 30 — "Is 'Agentic AI' a Fraud?" (eight figures)
 * ----------------------------------------------------------------------------
 * Same method as article 29: gridFigure() above. Convention of this article:
 * probabilistic components are accent + paper-2, deterministic components are
 * ink, human gates are alarm-caution and dashed, safety-rated equipment is
 * alarm-fault. Every distinction also rides on a second channel (dash, tag,
 * legend) so none depends on colour alone.
 * ======================================================================== */
const AGENTIC_FIGURES = [
  /* ---------------------------------------------------------------- D1 */
  {
    id: 'agentic-d1', page: 'article-30.html',
    caption:
      'One tool call, two descriptions. Operator drove a browser from screenshots, not an API script [S58]. ' +
      'The mechanism in the video is right [S1]; “the LLM did nothing” is not: the model plans, the harness checks, ' +
      'and code executes and reports back [S15][S16].',
    because:
      'the prose can say the video is half right; only the drawing shows which arrows the model decides and which ' +
      'code executes, and that the second description has a return path and a confirm gate the first one lacks.',
    build: () => gridFigure({
      phone: { order: ['u1', 'l1', 'py', 'l1b', 'l2', 'h', 'g', 'x', 'o'], gapY: 44,
        zones: [{ ids: ['u1', 'l1', 'py', 'l1b'], label: 'The video [S1]' }, { ids: ['l2', 'h', 'g', 'x', 'o'], label: 'Documented [S15][S16]' }], edges: { 7: { fs: 'r', ts: 'r' } } },
      slug: 'agentic1', title: 'One tool call, two descriptions',
      desc: 'Top: the video’s account. Bottom: the same call with the decisions the model makes marked.',
      gaps: [28, 28, 28], gapY: 58,
      nodes: [
        { id: 'u1', col: 0, row: 0, name: 'User', sub: '“book me a table”' },
        { id: 'l1', col: 1, row: 0, name: 'LLM', sub: 'guesses a command', stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Probabilistic: the model decides' },
        { id: 'py', col: 2, row: 0, name: 'python opentable.py', sub: '→ OpenTable API', stroke: 'ink', legend: 'Deterministic: code executes' },
        { id: 'l1b', col: 3, row: 0, name: 'LLM', sub: '“I booked you a table!”', stroke: 'accent', fill: 'paper-2', tier: 1 },
        { id: 'l2', col: 0, row: 1, tag: 'plan [S15]', name: 'LLM', sub: 'pick tool, fill args', stroke: 'accent', fill: 'paper-2', tier: 1 },
        { id: 'h', col: 1, row: 1, name: 'Harness', sub: 'schema · permissions', stroke: 'ink' },
        { id: 'g', col: 2, row: 1, name: 'Confirm gate', sub: 'before side effects', stroke: 'alarm-caution', dashed: true, legend: 'Human gate' },
        { id: 'x', col: 3, row: 1, name: 'Executor', sub: 'API call or browser', stroke: 'ink' },
        { id: 'o', col: 3, row: 2, name: 'Observation', sub: 'result or error', stroke: 'ink' }
      ],
      edges: [
        { a: 'u1', b: 'l1', stroke: 'accent' }, { a: 'l1', b: 'py', stroke: 'ink', pattern: 'dashed' }, { a: 'py', b: 'l1b', stroke: 'ink', pattern: 'dashed' },
        { a: 'l2', b: 'h', stroke: 'accent', legend: 'Decided by the model' },
        { a: 'h', b: 'g', stroke: 'ink', pattern: 'dashed', legend: 'Executed by code' },
        { a: 'g', b: 'x', stroke: 'ink', pattern: 'dashed' },
        { a: 'x', b: 'o', stroke: 'ink', pattern: 'dashed' },
        { a: 'o', b: 'l2', stroke: 'accent', fs: 'l', ts: 'b', label: 'next step or stop' }
      ],
      zones: [
        { ids: ['u1', 'l1', 'py', 'l1b'], label: 'As described in the video [S1]' },
        { ids: ['l2', 'h', 'g', 'x', 'o'], label: 'As documented [S15][S16][S58]' }
      ]
    })
  },
  /* ---------------------------------------------------------------- D2 */
  {
    id: 'agentic-d2', page: 'article-30.html',
    caption:
      'Observe, act, verify. The model proposes; deterministic checks decide whether the step counts. Anthropic: ' +
      'the agent gets ground truth from the environment at each step [S14].',
    because:
      'a list of “schema check, verifier, budget, human gate” hides that the verifier feeds the context and that the ' +
      'budget guard can halt the model from outside it; the loop shape shows who can stop what.',
    build: () => gridFigure({
      phone: { order: ['bud', 'ctx', 'llm', 'val', 'hum', 'exe', 'ver', 'done'], gapY: 32, left: 52,
        edges: { 2: { fs: 'r', ts: 'r' }, 3: { fs: 'l', ts: 'l' }, 5: { fs: 'l', ts: 'l' }, 6: { fs: 'l', ts: 'l' }, 7: { fs: 'r', ts: 'r' } } },
      slug: 'agentic2', title: 'Observe, act, verify',
      desc: 'The model proposes; deterministic checks decide whether the step counts.',
      gaps: [48, 76], gapY: 40,
      nodes: [
        { id: 'bud', col: 1, row: 0, name: 'Budget guard', sub: 'steps · tokens · time · $', stroke: 'ink' },
        { id: 'hum', col: 1, row: 2, name: 'Human gate', sub: 'irreversible actions', stroke: 'alarm-caution', dashed: true, legend: 'Human gate' },
        { id: 'ctx', col: 0, row: 1, name: 'Context', sub: 'goal · history · results', stroke: 'ink' },
        { id: 'llm', col: 1, row: 1, name: 'LLM', sub: 'propose next action', stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Probabilistic: the model proposes' },
        { id: 'val', col: 2, row: 1, name: 'Schema / policy check', stroke: 'ink', legend: 'Deterministic check' },
        { id: 'exe', col: 2, row: 2, name: 'Execute tool', stroke: 'ink' },
        { id: 'ver', col: 2, row: 3, name: 'Verifier', sub: 'tests · lint · types · rules', stroke: 'ink' },
        { id: 'done', col: 2, row: 4, name: 'Stop', sub: 'success or escalate', stroke: 'ink' }
      ],
      edges: [
        { a: 'ctx', b: 'llm' }, { a: 'llm', b: 'val' },
        { a: 'val', b: 'llm', label: 'reject: reason', fs: 'b', ts: 'b', stroke: 'muted', pattern: 'dashed', legend: 'Rejection / halt' },
        { a: 'val', b: 'exe', label: 'valid' }, { a: 'exe', b: 'ver' },
        { a: 'ver', b: 'ctx', label: 'pass/fail + log', fs: 'l', ts: 'b' },
        { a: 'bud', b: 'llm', label: 'halt', stroke: 'muted', pattern: 'dashed' },
        { a: 'llm', b: 'hum', label: 'side effect', fs: 'b', ts: 't' },
        { a: 'hum', b: 'exe', label: 'approved', fs: 'r', ts: 'l' },
        { a: 'ver', b: 'done', label: 'goal met' }
      ]
    })
  },
  /* ---------------------------------------------------------------- D3 */
  {
    id: 'agentic-d3', page: 'article-30.html',
    caption:
      'Who decides the next step? Six levels from hand-written logic to an autonomous agent [S14][S20]. Only the last ' +
      'level lets the model choose steps and tools; everything left of it is a workflow with predefined code paths, ' +
      'and the first three are decades old (cron, RPA, expert systems).',
    because:
      'the argument turns on where the line between workflow and agent sits; a paragraph asserts it, the spectrum ' +
      'shows five levels on one side and one on the other.',
    build: () => gridFigure({
      phone: { order: ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'], gapY: 44, colMin: [252] },
      slug: 'agentic3', title: 'Who decides the next step?',
      desc: 'Six levels, from hand-written logic to an autonomous agent.',
      gaps: [44, 44], top: 56, gapY: 48,
      nodes: [
        { id: 'c0', col: 0, row: 0, tag: 'all: code', name: 'Code', sub: 'rules decide', stroke: 'ink' },
        { id: 'c1', col: 1, row: 0, tag: 'output: LLM', name: 'One call', sub: 'single prompt', stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'LLM decides this part' },
        { id: 'c2', col: 2, row: 0, tag: 'output: LLM', name: 'Chain', sub: 'fixed sequence', stroke: 'accent', fill: 'paper-2', tier: 1 },
        { id: 'c3', col: 0, row: 1, tag: 'branch: LLM', name: 'Router', sub: 'LLM picks branch', stroke: 'accent', fill: 'paper-2', tier: 1 },
        { id: 'c4', col: 1, row: 1, tag: 'move: LLM', name: 'State machine', sub: 'LLM picks move', stroke: 'accent', fill: 'paper-2', tier: 1 },
        { id: 'c5', col: 2, row: 1, tag: 'steps: LLM', name: 'Agent', sub: 'LLM picks steps', stroke: 'accent', fill: 'paper-2', tier: 1 }
      ],
      edges: [
        { a: 'c0', b: 'c1', stroke: 'muted', pattern: 'dashed', legend: 'More control moves to the model' },
        { a: 'c1', b: 'c2', stroke: 'muted', pattern: 'dashed' }, { a: 'c2', b: 'c3', stroke: 'muted', pattern: 'dashed' },
        { a: 'c3', b: 'c4', stroke: 'muted', pattern: 'dashed' }, { a: 'c4', b: 'c5', stroke: 'muted', pattern: 'dashed' }
      ],
      zones: [
        { ids: ['c1', 'c2', 'c3', 'c4'], label: 'Workflow: predefined code paths [S14]' },
        { ids: ['c5'], label: 'Agent' }
      ]
    })
  },
  /* ---------------------------------------------------------------- D4 */
  {
    id: 'agentic-d4', page: 'article-30.html',
    caption:
      'Factory: LLMs write, exit codes decide. Hard gates are lint, test, build, nonempty and secrets, and no job can ' +
      'override them [S60]. One demo job passed every gate: security and code PASS, UX and UI SKIP [S61].',
    because:
      'a list of roles and gates does not show the three ways back to the builder or that state is written to ' +
      'board.json at every transition; the loop structure is the point.',
    build: () => gridFigure({
      phone: { order: ['spec', 'bld', 'gate', 'rev', 'ver', 'dec', 'board', 'app', 'mg'], gapY: 32,
        edges: { 2: { fs: 'r', ts: 'r' }, 6: { fs: 'l', ts: 'l' }, 7: { fs: 'r', ts: 'r' }, 9: { fs: 'r', ts: 'r' } } },
      slug: 'agentic4', title: 'Factory: LLMs write, exit codes decide',
      desc: 'Spec to merge with every transition recorded by the factory CLI in board.json.',
      gaps: [44, 120], gapY: 48,
      nodes: [
        { id: 'spec', col: 0, row: 0, name: 'spec-writer', sub: 'request → spec.md', stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'LLM role' },
        { id: 'bld', col: 1, row: 0, name: 'builder', sub: 'code + tests, commit', stroke: 'accent', fill: 'paper-2', tier: 1 },
        { id: 'gate', col: 2, row: 0, tag: 'never overridable', name: 'factory gate', sub: 'lint · test · build', stroke: 'ink', tier: 1, legend: 'CLI step (exit code)' },
        { id: 'rev', col: 2, row: 1, name: '4 reviewers', sub: 'security · code · ux · ui', stroke: 'accent', fill: 'paper-2', tier: 1 },
        { id: 'dec', col: 1, row: 2, name: 'DECIDE', sub: 'fix ≤2 · override · abandon', stroke: 'alarm-caution', dashed: true, legend: 'Human decision' },
        { id: 'ver', col: 2, row: 2, name: 'factory verdict', sub: 'VERDICT regex · HEAD same', stroke: 'ink' },
        { id: 'board', col: 1, row: 3, name: 'board.json', sub: 'every transition', stroke: 'ink', dashed: true },
        { id: 'app', col: 2, row: 3, name: 'approver', sub: 'factory deliver', stroke: 'accent', fill: 'paper-2', tier: 1 },
        { id: 'mg', col: 2, row: 4, name: 'Merge to main', sub: 're-gated · push opt-in', stroke: 'ink' }
      ],
      edges: [
        { a: 'spec', b: 'bld' }, { a: 'bld', b: 'gate' },
        { a: 'gate', b: 'bld', label: 'NEEDS_FIX ≤3', fs: 't', ts: 't', stroke: 'muted', pattern: 'dashed', legend: 'Back to the builder' },
        { a: 'gate', b: 'rev', label: 'REVIEW' }, { a: 'rev', b: 'ver' },
        { a: 'ver', b: 'dec', label: 'rounds exhausted', fs: 'l', ts: 'r' },
        { a: 'dec', b: 'bld', label: 'fix' },
        { a: 'ver', b: 'app', label: 'READY' }, { a: 'app', b: 'mg' },
        { a: 'ver', b: 'board', stroke: 'muted', pattern: 'dotted', fs: 'b', ts: 'r', legend: 'Writes state' },
        { a: 'dec', b: 'board', stroke: 'muted', pattern: 'dotted', fs: 'b', ts: 'l' },
        { a: 'app', b: 'board', stroke: 'muted', pattern: 'dotted', fs: 'l', ts: 'b' }
      ]
    })
  },
  /* ---------------------------------------------------------------- D5 */
  {
    id: 'agentic-d5', page: 'article-30.html',
    caption:
      'Drafter and checker. The probabilistic half reads and drafts; the deterministic half validates, executes and ' +
      'tests. Self-explanations from the model can be unfaithful [S3], so nothing downstream trusts them. The seam is ' +
      'where the engineering lives.',
    because:
      'a two-column table says which half does what; it cannot show that every path from the model passes through one ' +
      'typed interface, or that test failures return to the drafter as text.',
    build: () => gridFigure({
      phone: { order: ['p3', 'p1', 'p4', 'iface', 'dv', 'd2', 'd5', 'd3'], gapY: 44,
        zones: [{ ids: ['p3', 'p1', 'p4'], label: 'LLM' }, { ids: ['dv', 'd2', 'd5', 'd3'], label: 'Code' }],
        edges: { 0: { fs: 'l', ts: 'l' }, 1: { fs: 'r', ts: 'r' }, 4: { fs: 'l', ts: 'l' }, 5: { fs: 'r', ts: 'r' }, 6: { fs: 'r', ts: 'r' } } },
      slug: 'agentic5', title: 'Drafter and checker',
      desc: 'What each half is good at, and the interface between them.',
      gaps: [48, 48], gapY: 32,
      nodes: [
        { id: 'p3', col: 0, row: 0, name: 'Draft code, MOP, ticket', stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Probabilistic (LLM)' },
        { id: 'p1', col: 0, row: 1, name: 'Read text, logs, screens', sub: 'and choose among options', stroke: 'accent', fill: 'paper-2', tier: 1 },
        { id: 'p4', col: 0, row: 2, tag: 'may be unfaithful [S3]', name: 'Explain', stroke: 'accent', fill: 'paper-2', tier: 1, dashed: true },
        { id: 'iface', col: 1, row: 1, name: 'Typed tool interface', sub: 'schema · allow-list · ranges', stroke: 'ink', tier: 1, legend: 'Deterministic (code)' },
        { id: 'd3', col: 2, row: 0, name: 'Test, lint, type-check', stroke: 'ink' },
        { id: 'dv', col: 2, row: 1, name: 'Validate + enforce', sub: 'schema · limits · permissions', stroke: 'ink' },
        { id: 'd2', col: 2, row: 2, name: 'Execute and measure', stroke: 'ink' },
        { id: 'd5', col: 2, row: 3, name: 'Log and replay', stroke: 'ink' }
      ],
      edges: [
        { a: 'p3', b: 'iface', fs: 'r', ts: 't' }, { a: 'p1', b: 'iface' }, { a: 'p4', b: 'iface', fs: 'r', ts: 'b' },
        { a: 'iface', b: 'dv' }, { a: 'iface', b: 'd2', fs: 'b', ts: 'l' },
        { a: 'dv', b: 'd3', fs: 't', ts: 'b', stroke: 'muted', pattern: 'dashed' },
        { a: 'd3', b: 'p3', label: 'error text back', fs: 'l', ts: 'r', stroke: 'muted', pattern: 'dashed', legend: 'Feedback to the drafter' },
        { a: 'd2', b: 'd5' }
      ],
      zones: [
        { ids: ['p3', 'p1', 'p4'], label: 'Probabilistic (LLM)' },
        { ids: ['d3', 'dv', 'd2', 'd5'], label: 'Deterministic (code)' }
      ]
    })
  },
  /* ---------------------------------------------------------------- D6 */
  {
    id: 'agentic-d6', page: 'article-30.html',
    caption:
      '0.95 twenty times. At 95 % per step a 20-step run succeeds 35.8 % of the time (0.95^20, derived). With a ' +
      'verifier that detects 90 % of bad steps and two retries, a step succeeds 99.47 % of the time and the run ' +
      '89.9 % (derived, CALCULATORS C-ii). METR’s 50 % versus 80 % horizon gap is the field version [S27].',
    because:
      'the multiplication is one line in the prose; the drawing shows where the verifier sits (inside the step, ' +
      'looping back) and why detection, not model quality, moves the run from 0.358 to 0.899.',
    build: () => gridFigure({
      phone: { order: ['a', 'r1', 'b', 'vf', 'r2'], gapY: 44, edges: { 2: { fs: 'r', ts: 'r' } } },
      slug: 'agentic6', title: '0.95 twenty times',
      desc: 'Per-step success multiplies; a verifier with retries breaks the chain.',
      gaps: [72, 72], gapY: 64,
      nodes: [
        { id: 'a', col: 0, row: 0, tag: '× 20 steps', name: 'Step', sub: 'p = 0.95', stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Probabilistic step' },
        { id: 'r1', col: 2, row: 0, tag: '95 % per step', name: 'Run succeeds', sub: '0.358 over 20 steps', stroke: 'ink', tier: 1 },
        { id: 'b', col: 0, row: 1, tag: '× 20 steps', name: 'Step', sub: 'p = 0.95', stroke: 'accent', fill: 'paper-2', tier: 1 },
        { id: 'vf', col: 1, row: 1, name: 'Verifier', sub: 'd = 0.9 · k = 2', stroke: 'ink', legend: 'Deterministic check' },
        { id: 'r2', col: 2, row: 1, tag: '99.47 % per step', name: 'Run succeeds', sub: '0.899 over 20 steps', stroke: 'ink', tier: 1 }
      ],
      edges: [
        { a: 'a', b: 'r1', label: 'multiply 20 times' },
        { a: 'b', b: 'vf', label: 'attempt' },
        { a: 'vf', b: 'b', label: 'detected: retry', fs: 'b', ts: 'b', stroke: 'muted', pattern: 'dashed', legend: 'Detected failure retries' },
        { a: 'vf', b: 'r2', label: 'passes' }
      ],
      zones: [
        { ids: ['a', 'r1'], label: 'Without a verifier' },
        { ids: ['b', 'vf', 'r2'], label: 'With a verifier', pad: { b: 38 } }
      ]
    })
  },
  /* ---------------------------------------------------------------- D7 */
  {
    id: 'agentic-d7', page: 'article-30.html',
    caption:
      'Money, models and narratives, 2024–2026. Time runs down; each lane is one kind of event. Capital moved first and ' +
      'fastest (OpenAI $122B at $852B [S51]; Anthropic $65B at $965B [S48]), measured capability moved on a ~131-day ' +
      'doubling [S26], and the critiques [S39][S37] arrived while both kept rising.',
    because:
      'sixteen dated events across three kinds do not survive as prose; read side by side on one time axis they show ' +
      'that the critique lane is dense in 2025 and the capital lane in 2026.',
    build: () => gridFigure({
      phone: { order: ['c1', 'k1', 'k2', 'c2', 'm1', 'm2', 'm3', 'k3'], gapY: 20, zones: [] },
      slug: 'agentic7', title: 'Money, models and narratives, 2024–2026',
      desc: 'Events on one time axis: capability, capital, critiques.',
      gaps: [24, 24], gapY: 28,
      nodes: [
        { id: 'k1', col: 2, row: 0, tag: 'Jun–Aug 2025', name: 'Gartner: >40% cancelled', sub: 'by 2027 [S39] · MIT “95%” [S37]', stroke: 'soft', dashed: true, legend: 'Critique' },
        { id: 'c1', col: 0, row: 0, tag: 'Dec 2024–Jun 2025', name: 'Limits found', sub: 'pretraining ends [S53][S3][S5][S6]', stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Capability' },
        { id: 'c2', col: 0, row: 1, tag: 'Jan–Apr 2026', name: 'METR: 50% horizon ≈17 h', sub: '80% horizon ≈3 h [S27]', stroke: 'accent', fill: 'paper-2', tier: 1 },
        { id: 'm1', col: 1, row: 1, tag: 'Feb 2026', name: 'OpenAI $122B at $852B', sub: 'raised from $110B [S51]', stroke: 'ink', legend: 'Capital' },
        { id: 'k2', col: 2, row: 1, tag: 'Nov 2025–Feb 2026', name: 'LeCun leaves Meta [S55]', sub: 'SWE-bench Verified retired [S23]', stroke: 'soft', dashed: true },
        { id: 'm2', col: 1, row: 2, tag: 'May–Jun 2026', name: 'Anthropic $65B at $965B', sub: 'draft S-1 [S48][S49]', stroke: 'ink' },
        { id: 'm3', col: 1, row: 3, tag: 'Jul–Sep 2026', name: 'Big-four capex ≈$0.7T', sub: 'no OpenAI IPO 2026 [S40][S52]', stroke: 'ink' },
        { id: 'k3', col: 2, row: 3, tag: 'Aug–Sep 2026', name: 'Elder video [S1]', sub: 'safety departures [S56]', stroke: 'soft', dashed: true }
      ],
      edges: [],
      zones: [
        { cols: [0], label: 'Capability' }, { cols: [1], label: 'Capital' }, { cols: [2], label: 'Critique' }
      ]
    })
  },
  /* ---------------------------------------------------------------- D8 */
  {
    id: 'agentic-d8', page: 'article-30.html', faultRed: true,
    caption:
      'An agent next to a chiller plant. The agent can read and propose; only the control system, with its interlocks ' +
      'and a human, can act. There is no connector from the agent to the BMS, the PLC or the safety system. ' +
      '“Limit active control of OT infrastructure by AI without a human in the loop” (CISA, ASD ACSC et al. [S33]).',
    because:
      'the rule “no autonomous control of OT” is a sentence; the drawing makes its form checkable, by showing the one ' +
      'path from the agent to the plant runs through an operator and a range-checking gateway, and that data flows back ' +
      'one way only.',
    build: () => gridFigure({
      phone: { order: ['kbt', 'agent', 'op', 'gw', 'hist', 'bms', 'plc', 'chl', 'sis'], gapY: 44,
        edges: { 4: { fs: 'r', ts: 'r' }, 9: { fs: 'l', ts: 'l' } } },
      slug: 'agentic8', title: 'An agent next to a chiller plant',
      desc: 'The agent can read and propose; only the control system, with its interlocks and a human, can act.',
      gaps: [56, 112], gapY: 32, colMin: [0, 0, 160],
      nodes: [
        { id: 'kbt', col: 0, row: 0, name: 'SOP library / CMMS', sub: 'MOPs · work orders', stroke: 'ink' },
        { id: 'agent', col: 0, row: 1, name: 'LLM agent', sub: 'read-only tools', stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Probabilistic' },
        { id: 'op', col: 0, row: 2, name: 'Operator', sub: 'approves', stroke: 'alarm-caution', dashed: true, legend: 'Human gate' },
        { id: 'hist', col: 1, row: 1, name: 'Historian replica', sub: 'one-way out', stroke: 'ink' },
        { id: 'gw', col: 1, row: 2, name: 'Change gateway', sub: 'range · interlock check', stroke: 'ink' },
        { id: 'bms', col: 2, row: 2, symbol: 'bms', name: 'BMS / EPMS', sub: 'supervisory', stroke: 'ink' },
        { id: 'plc', col: 2, row: 3, name: 'PLC', sub: 'local control', stroke: 'ink' },
        { id: 'chl', col: 2, row: 4, symbol: 'chiller', name: 'Chiller', stroke: 'ink' },
        { id: 'sis', col: 1, row: 4, tag: 'IEC 61511', name: 'SIS / EPO / fire', sub: 'hard-wired, out of scope', stroke: 'alarm-fault', fill: 'paper', tier: 1, legend: 'Safety-rated' }
      ],
      edges: [
        { a: 'kbt', b: 'agent', label: 'SOPs' }, { a: 'agent', b: 'kbt', label: 'draft WO', stroke: 'muted', pattern: 'dashed' },
        { a: 'agent', b: 'op', label: 'change + evidence' },
        { a: 'op', b: 'gw', label: 'approved' },
        { a: 'gw', b: 'bms', label: 'setpoint' },
        { a: 'bms', b: 'plc', fs: 'b', ts: 't' }, { a: 'plc', b: 'bms', fs: 't', ts: 'b', stroke: 'muted' },
        { a: 'plc', b: 'chl' },
        { a: 'bms', b: 'hist', label: 'one way', fs: 't', ts: 'r', stroke: 'muted' },
        { a: 'hist', b: 'agent', label: 'trends', fs: 'l', ts: 'r', stroke: 'muted' },
        { a: 'sis', b: 'chl', label: 'trip, independent', stroke: 'alarm-fault' }
      ],
      zones: [
        { ids: ['kbt', 'agent'], label: 'IT / enterprise' },
        { ids: ['hist', 'gw'], label: 'DMZ' },
        { ids: ['bms', 'plc', 'chl'], label: 'OT · IEC 62443 zone' },
        { ids: ['sis'], label: 'Safety' }
      ]
    })
  }
];

const FIGURES = [
  {
    id: 'method-assessment',
    page: 'article-6.html',
    caption:
      'What the assessment on this page actually does. The model is used twice \u2014 once to ' +
      'ask how uncertain the answer is, once to ask which input it turns on \u2014 and the ' +
      'ranked actions are thresholds read off both. A single score reported on its own hides ' +
      'that either question was asked.',
    because:
      'the page reports a score, a distribution and a ranked list without showing the path ' +
      'between them. Two things get lost: that the output is a RANGE, and that the ranking is ' +
      'DERIVED rather than authored. Both are properties of the pipeline, which is a shape.',
    build: () => assessmentMethodFigure(D, M, L)
  },
  {
    id: 'method-assessment',
    page: 'article-8.html',
    caption:
      'What the assessment on this page actually does. The model is used twice \u2014 once to ' +
      'ask how uncertain the answer is, once to ask which input it turns on \u2014 and the ' +
      'ranked actions are thresholds read off both. A single score reported on its own hides ' +
      'that either question was asked.',
    because:
      'the same reason as article-6, and verified separately against this page: it runs 10,000 ' +
      'iterations and its own sensitivity analysis. One definition serves both because the ' +
      'instrument is the same, not because the articles look alike.',
    build: () => assessmentMethodFigure(D, M, L)
  },
  {
    id: 'three-levers',
    page: 'article-27.html',
    caption:
      'Three levers, one pool. Substitute lowers how many people the work needs; Extend raises ' +
      'what the people already there can do. Neither adds a qualified person. Only Create feeds ' +
      'the pool \u2014 and it is the slowest of the three, which is the whole difficulty of ' +
      'building a plan rather than a collection of initiatives.',
    because:
      'the table gives each lever a definition, a strategy list and a time horizon, and the ' +
      'prose then states the finding: Create is the only lever that permanently increases ' +
      'supply. In a table that sentence is a fourth column nobody reads against the others. ' +
      'Drawn, it is the shape of the thing \u2014 two of the three arrows never reach the pool.',
    build() {
      const ctx = D.create({
        slug: 'levers',
        title: 'Three workforce levers, and which one actually adds people',
        desc: 'The shortage of qualified data centre staff can be attacked three ways. Create ' +
              'builds new qualified supply through apprenticeships, community college and ' +
              'university pipelines, taking weeks through unions to six years or more through a ' +
              'degree, and it is the only lever that adds to the pool. Substitute replaces human ' +
              'labour with technology or outsourced services, lowering the number of people ' +
              'needed. Extend raises the output of the people already present through tooling ' +
              'and training. Neither Substitute nor Extend adds a qualified person.'
      });

      const LX = 40, W = 340, RX = 520;

      /* The pool is drawn tall enough to span all three levers, so each one
       * gets its own port opposite itself and every run is level. The first cut
       * gave it a normal-height box and aimed three connectors at points 12 to
       * 18 units apart; the router doglegged all three through one corridor and
       * they wove into a rectangle nobody had declared. */
      const POOL_TOP = 48, POOL_H = 400;
      const pool = ctx.node(RX, POOL_TOP, {
        id: 'pool', tag: 'the constraint', name: 'Qualified people available',
        sublabel: 'the pool the 2026 cliff drains', w: W, h: POOL_H, vAlign: 'middle',
        stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'What the shortage is'
      });
      const ports = ctx.ports(pool, 3, 'left', { id: 'pool' });

      const create = ctx.node(LX, ports[0].y - 36, {
        id: 'create', tag: 'weeks to 6+ yrs', name: 'CREATE',
        sublabel: 'apprenticeship \u00B7 college \u00B7 degree', w: W,
        stroke: 'accent', fill: 'paper', tier: 2, legend: 'Adds to the pool \u2014 and only this one'
      });
      const subst = ctx.node(LX, ports[1].y - 36, {
        id: 'subst', tag: 'immediate to 7 yrs', name: 'SUBSTITUTE',
        sublabel: 'NOCaaS \u00B7 automation \u00B7 outsourcing', w: W,
        stroke: 'rule-solid', fill: 'paper', tier: 2, dashed: true,
        legend: 'Changes the demand, not the supply'
      });
      const extend = ctx.node(LX, ports[2].y - 36, {
        id: 'extend', tag: 'weeks to 18 mo', name: 'EXTEND',
        sublabel: 'tooling \u00B7 training \u00B7 adjacent trades', w: W,
        stroke: 'rule-solid', fill: 'paper', tier: 2, dashed: true
      });

      /* Only one arrow reaches the pool as a supply. The other two are drawn
       * dotted to the same edge because they DO act on the shortage — they just
       * act on the demand side of it, which the container spells out. */
      ctx.edge({ x: create.x + create.w, y: ports[0].y }, { x: ports[0].x, y: ports[0].y }, {
        fromId: 'create', toId: 'pool', stroke: 'accent', tier: 1, pattern: 'solid',
        label: 'adds people', legend: 'Feeds the pool'
      });
      [subst, extend].forEach(function (n, i) {
        ctx.edge({ x: n.x + n.w, y: ports[i + 1].y }, { x: ports[i + 1].x, y: ports[i + 1].y }, {
          fromId: n.id, toId: 'pool', stroke: 'soft', tier: 2, pattern: 'dotted',
          legend: i === 0 ? 'Eases the draw on it' : undefined
        });
      });

      /* 24 units of headroom, not 34: at 34 the container's own eyebrow sat
         across the CREATE box above it, which the geometry audit caught. */
      ctx.zone(LX - 20, subst.y - 24, W + 40, (extend.y + extend.h + 18) - (subst.y - 24), {
        label: 'neither adds a qualified person', tier: 3, dashed: true
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'smr-cost-chain',
    page: 'article-21.html',
    caption:
      'What actually cancelled the flagship SMR project, and the one link hyperscalers replace. ' +
      'NuScale\'s costs did not kill it directly \u2014 they killed the subscription, because ' +
      'utilities buying year to year will not underwrite a 158 % overrun. A twenty-year power ' +
      'purchase agreement removes that link, which is why the buyer changing matters more than ' +
      'the technology changing.',
    because:
      'the section gives the overrun as a table and the hyperscaler difference as a list of ' +
      'contract terms. Between them sits a causal chain the article never draws: cost to LCOE to ' +
      'subscription to cancellation. Seeing it as a chain is what makes the PPA legible as a ' +
      'REPLACEMENT for one link rather than a nice contractual detail.',
    build() {
      const ctx = D.create({
        slug: 'smr',
        title: 'Why the Carbon Free Power Project was cancelled, and what changes with a hyperscaler buyer',
        desc: 'NuScale\'s Carbon Free Power Project escalated from 3.6 to 9.3 billion dollars, a ' +
              '158 per cent overrun, which pushed its levelised cost from 55 dollars per ' +
              'megawatt-hour to between 89 and 102. Member utilities then declined to take up the ' +
              'required 80 per cent subscription and the project was cancelled in November 2023. ' +
              'A hyperscaler signing a twenty-year power purchase agreement replaces the ' +
              'subscription link in that chain with contracted revenue certainty.'
      });

      const X = 40, W = 380, PITCH = 92;
      const chain = [
        { id: 'cost', tag: 'overrun', name: 'Cost: $3.6 B \u2192 $9.3 B', sub: '+158 %' },
        { id: 'lcoe', tag: 'consequence', name: 'LCOE: $55 \u2192 $89\u2013102 / MWh', sub: '+62\u201385 %' },
        { id: 'sub', tag: 'the link that broke', name: 'Utilities decline to subscribe',
          sub: '80 % take-up never reached', focal: true },
        { id: 'dead', tag: 'outcome', name: 'Cancelled, November 2023', sub: 'DOE had committed $232 M' }
      ];
      let y = 48;
      const nodes = chain.map(function (c) {
        const n = ctx.node(X, y, {
          id: c.id, tag: c.tag, name: c.name, sublabel: c.sub, w: W,
          stroke: c.focal ? 'accent' : 'rule-solid',
          fill: c.focal ? 'paper-2' : 'paper', tier: c.focal ? 1 : 2,
          legend: c.focal ? 'The pivot \u2014 the link that broke, and what replaces it'
                          : (c.id === 'cost' ? 'The chain as it ran' : undefined)
        });
        y = n.y + PITCH;
        return n;
      });
      for (let i = 0; i < nodes.length - 1; i++) {
        ctx.edge({ x: nodes[i].x + nodes[i].w / 2, y: nodes[i].y + nodes[i].h },
                 { x: nodes[i + 1].x + nodes[i + 1].w / 2, y: nodes[i + 1].y }, {
          fromId: nodes[i].id, toId: nodes[i + 1].id, stroke: 'ink', tier: 2, pattern: 'solid'
        });
      }

      const ppa = ctx.node(X + W + 190, nodes[2].y - 12, {
        id: 'ppa', tag: 'what changes', name: '20-year PPA',
        sublabel: 'Microsoft, and Amazon through 2042', w: 300,
        stroke: 'accent', fill: 'paper-2', tier: 1
        /* no legend entry: it shares the accent with the link it replaces, which is
           the point, and two names for one swatch is a legend a reader cannot use */
      });
      ctx.edge({ x: ppa.x, y: ppa.y + ppa.h / 2 },
               { x: nodes[2].x + nodes[2].w, y: nodes[2].y + nodes[2].h / 2 }, {
        fromId: 'ppa', toId: 'sub', stroke: 'accent', tier: 1, pattern: 'dashed',
        label: 'revenue certainty', legend: 'Removes the subscription risk'
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'method-montecarlo',
    page: 'article-4.html',
    caption:
      'What the calculator on this page actually does. The five phases are decomposed ' +
      'deterministically from your inputs, then resampled 5,000 times against their uncertainty. ' +
      'The result is a distribution, so the honest answer is a range \u2014 p10, p50, p90 \u2014 ' +
      'and the recommendations are thresholds read off that range, not advice written in advance.',
    because:
      'the page hands the reader a Monte Carlo result and a ranked list of actions without ever ' +
      'showing the path between them. Two things get lost: that the output is a DISTRIBUTION ' +
      'rather than a number, and that the recommendations are DERIVED from it rather than ' +
      'authored. Both are properties of the pipeline, which is a shape, and neither survives as a ' +
      'sentence next to a table of results.',
    build() {
      const ctx = D.create({
        slug: 'method',
        title: 'How this page turns inputs into a ranked set of actions',
        desc: 'Inputs describing the site are decomposed into the five MTTR phases — detection, ' +
              'diagnosis, mobilisation, repair and verification — each scaled by skill level, ' +
              'spares readiness and coverage. That deterministic model is then resampled five ' +
              'thousand times to produce a distribution, reported at the tenth, fiftieth and ' +
              'ninetieth percentiles. Recommendations are thresholds read off those results, ' +
              'not text written in advance.'
      });

      /* Stacked, not strung out: five boxes in a row is 1,670 units and unreadable
         once scaled to a reading column. A pipeline reads top-down just as well. */
      const X = 40, W = 380, PITCH = 96;
      const steps = [
        { id: 'in', tag: 'you set', name: 'Inputs',
          sub: 'skill \u00B7 spares \u00B7 coverage \u00B7 SLA', focal: false },
        { id: 'model', tag: 'deterministic', name: 'Five-phase decomposition',
          sub: 'detect \u00B7 diagnose \u00B7 mobilise \u00B7 repair \u00B7 verify' },
        { id: 'mc', tag: '5,000 runs', name: 'Monte Carlo resample',
          sub: 'each phase against its uncertainty', focal: true },
        { id: 'dist', tag: 'the answer', name: 'A distribution',
          sub: 'p10 \u00B7 p50 \u00B7 p90 \u2014 not one number' },
        { id: 'rec', tag: 'derived', name: 'Ranked actions',
          sub: 'thresholds read off the result' }
      ];

      let y = 48;
      const nodes = steps.map(function (s) {
        const n = ctx.node(X, y, {
          id: s.id, tag: s.tag, name: s.name, sublabel: s.sub, w: W,
          stroke: s.focal ? 'accent' : 'rule-solid',
          fill: s.focal ? 'paper-2' : 'paper',
          tier: s.focal ? 1 : 2,
          legend: s.focal ? 'Where the uncertainty enters' : (s.id === 'in' ? 'Pipeline stage' : undefined)
        });
        y = n.y + PITCH;
        return n;
      });

      for (let i = 0; i < nodes.length - 1; i++) {
        ctx.edge({ x: nodes[i].x + nodes[i].w / 2, y: nodes[i].y + nodes[i].h },
                 { x: nodes[i + 1].x + nodes[i + 1].w / 2, y: nodes[i + 1].y }, {
          fromId: nodes[i].id, toId: nodes[i + 1].id,
          stroke: 'ink', tier: 2, pattern: 'solid'
        });
      }

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'tariff-gap',
    page: 'article-12.html',
    caption:
      'A residential kilowatt-hour in Indonesia sells for less than it costs to generate. The ' +
      'shortfall of IDR 579 does not vanish \u2014 it is carried, by the state budget and by ' +
      'industrial users paying unsubsidised rates. Data centres sit on the industrial side of ' +
      'this ledger, which is the section\'s point: the subsidy runs the other way from the ' +
      'popular telling.',
    because:
      'the article gives the two prices and then lists the two things that cover the difference. ' +
      'Prose puts the numbers in separate sentences and the list in a third place, so the reader ' +
      'has to hold three facts and subtract. The gap is the whole argument, and a gap is a ' +
      'quantity between two levels \u2014 something to be SHOWN, not recited.',
    build() {
      const ctx = D.create({
        slug: 'tariff',
        title: 'The Indonesian residential tariff gap, and who carries it',
        desc: 'Electricity costs about 1,732 rupiah per kilowatt-hour to generate in Indonesia, ' +
              'while residential tariffs average about 1,153 rupiah. The difference of 579 rupiah ' +
              'per kilowatt-hour is covered by a government subsidy budgeted at 83 trillion ' +
              'rupiah and by cross-subsidy from industrial users, who pay full rates without ' +
              'subsidy. Data centres are industrial users.'
      });

      const LX = 48, W = 330, RX = 560;

      const cost = ctx.node(LX, 56, {
        id: 'cost', tag: 'what it costs', name: 'IDR 1,732 per kWh',
        sublabel: 'cost to generate', w: W,
        stroke: 'rule-solid', fill: 'paper', tier: 2, legend: 'The two prices'
      });
      const tariff = ctx.node(LX, 268, {
        id: 'tariff', tag: 'what it sells for', name: 'IDR 1,153 per kWh',
        sublabel: 'average residential tariff', w: W,
        stroke: 'rule-solid', fill: 'paper', tier: 2
      });

      /* The gap is drawn as the space BETWEEN the two prices, because that is
       * what it is. Labelling it in a box beside them would make it a third
       * number to be read rather than a distance to be seen. */
      ctx.zone(LX - 20, cost.y + cost.h + 16, W + 40,
               tariff.y - (cost.y + cost.h) - 32, {
        label: 'the gap \u2014 IDR 579 per kWh, and it does not vanish',
        tier: 3, dashed: true, stroke: 'accent'
      });

      const subsidy = ctx.node(RX, 114, {
        id: 'subsidy', tag: 'carried by', name: 'Government subsidy',
        sublabel: 'IDR 83 trillion budget', w: W,
        stroke: 'accent', fill: 'paper-2', tier: 2, legend: 'Who carries the gap'
      });
      const cross = ctx.node(RX, 190, {
        id: 'cross', tag: 'carried by', name: 'Industrial cross-subsidy',
        sublabel: 'full rates, no subsidy \u2014 data centres are here', w: W,
        stroke: 'accent', fill: 'paper-2', tier: 2
      });

      /* Each carrier gets its OWN point on the gap's edge, and the nodes are
       * placed so both runs are level. Aiming both at one point made the router
       * dogleg around each other, and the two detours drew a rectangle that
       * read as a box nobody had declared — rule 4 exists for this. */
      [subsidy, cross].forEach(function (n) {
        const y = n.y + n.h / 2;
        ctx.edge({ x: n.x, y: y }, { x: LX + W + 20, y: y }, {
          fromId: n.id, toId: 'gap', stroke: 'accent', tier: 2, pattern: 'solid',
          legend: 'Flows into the gap'
        });
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'corridor-model',
    page: 'article-19.html',
    caption:
      'Not a choice between two sites \u2014 one system across both, split by what each side is ' +
      'good at. Singapore keeps the front door because that is where the peering is; Batam takes ' +
      'the engine room because that is where the power and land are. The dedicated interconnect ' +
      'is what makes the split workable rather than a compromise.',
    because:
      'the section argues that the informed answer is neither site but a corridor spanning both. ' +
      'That is a TOPOLOGY, and the article states it only in prose: which workloads stay, which ' +
      'move, and the link that joins them. A reader who has been comparing two columns of costs ' +
      'has to be shown that the comparison was the wrong frame.',
    build() {
      const ctx = D.create({
        slug: 'corridor',
        title: 'The Singapore-Batam corridor: one system, split by function',
        desc: 'Front-end workloads \u2014 peering, low-latency applications and cloud ' +
              'interconnect \u2014 stay in Singapore, whose growth is capped by land, power and ' +
              'a 1.25 PUE sustainability framework. Back-end capacity \u2014 AI training, storage ' +
              'and disaster recovery \u2014 moves to Batam, which absorbs the overflow. A ' +
              'dedicated submarine interconnect of 24 fibre pairs at 20 Tbps each, targeted for ' +
              'the fourth quarter of 2026, joins the two.'
      });

      const W = 360, LX = 56, RX = 620, NY = 96;

      const front = ctx.node(LX, NY, {
        id: 'front', tag: 'front door', name: 'Peering \u00B7 low latency \u00B7 interconnect',
        sublabel: 'stays where the ecosystem is', w: W,
        stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Workload that cannot move'
      });
      const back = ctx.node(RX, NY, {
        id: 'back', tag: 'engine room', name: 'AI training \u00B7 storage \u00B7 DR',
        sublabel: 'moves to where power and land are', w: W,
        stroke: 'rule-solid', fill: 'paper', tier: 2, legend: 'Workload that can'
      });

      /* The link is the point: without it this is two sites, not a corridor. */
      ctx.edge({ x: front.x + front.w, y: front.y + front.h / 2 },
               { x: back.x, y: back.y + back.h / 2 }, {
        fromId: 'front', toId: 'back', stroke: 'ink', tier: 1, pattern: 'solid',
        label: '24 pairs \u00B7 20 Tbps each', legend: 'Dedicated interconnect, Q4 2026'
      });

      ctx.zone(LX - 24, NY - 52, W + 48, 160, {
        label: 'singapore \u2014 capped by land, power, PUE 1.25 and 50 % green',
        tier: 3, dashed: true, stroke: 'accent'
      });
      ctx.zone(RX - 24, NY - 52, W + 48, 160, {
        label: 'batam \u2014 absorbs what Singapore structurally cannot',
        tier: 3, dashed: true
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'jevons-loop',
    page: 'article-17.html',
    caption:
      'The bear case reads the first arrow and stops. Efficiency does cut the cost of a query, ' +
      'by about 90 % once model, hardware and quantisation gains compound \u2014 and that is ' +
      'exactly what raises total volume by roughly a thousand per cent. The last step funds the ' +
      'first, which is what makes it a loop rather than a saving.',
    because:
      'the article tabulates three efficiency factors against their effect on per-query cost and ' +
      'on total demand. A table lists them as three independent rows; it cannot show that the ' +
      'output returns to the input. Jevons is a REINFORCING CYCLE, and a cycle drawn as a list ' +
      'reads as a set of unrelated savings \u2014 which is precisely the misreading the section ' +
      'was written to correct.',
    build() {
      const ctx = D.create({
        slug: 'jevons',
        title: 'Why cheaper inference raises total demand',
        desc: 'A reinforcing cycle in four steps. Efficiency gains in models, hardware and ' +
              'quantisation cut the cost of a query. A cheaper query brings more users and more ' +
              'use cases. More queries raise total compute demand. Rising demand funds the next ' +
              'round of efficiency work, which returns to the first step. The per-unit cost falls ' +
              'about 90 per cent while total volume rises about a thousand per cent.'
      });

      const L = 40, R = 560, TOP = 50, BOT = 236, W = 330;

      const eff = ctx.node(L, TOP, {
        id: 'eff', tag: 'step 1', name: 'Efficiency improves',
        sublabel: 'model \u00B7 hardware \u00B7 quantisation', w: W,
        stroke: 'accent', fill: 'paper-2', tier: 1,
        legend: 'Where the bear case stops reading'
      });
      const cost = ctx.node(R, TOP, {
        id: 'cost', tag: 'step 2', name: 'Cost per query falls',
        sublabel: 'about \u221290 % per unit combined', w: W,
        stroke: 'rule-solid', fill: 'paper', tier: 2, legend: 'Steps in the cycle'
      });
      const use = ctx.node(R, BOT, {
        id: 'use', tag: 'step 3', name: 'More users, more use cases',
        sublabel: 'about +1,000 % total volume', w: W,
        stroke: 'rule-solid', fill: 'paper', tier: 2
      });
      const demand = ctx.node(L, BOT, {
        id: 'demand', tag: 'step 4', name: 'Total compute demand rises',
        sublabel: 'inference to 90 GW by 2030', w: W,
        stroke: 'rule-solid', fill: 'paper', tier: 2
      });

      const midY = (n) => n.y + n.h / 2;
      const midX = (n) => n.x + n.w / 2;

      /* Clockwise, every leg axis-aligned: the cycle needs no elbow, so it gets
       * none. The closing leg is the one the argument turns on, so it is the
       * one that carries an accent and a label. */
      ctx.edge({ x: eff.x + eff.w, y: midY(eff) }, { x: cost.x, y: midY(cost) }, {
        fromId: 'eff', toId: 'cost', stroke: 'ink', tier: 2, pattern: 'solid'
      });
      ctx.edge({ x: midX(cost), y: cost.y + cost.h }, { x: midX(use), y: use.y }, {
        fromId: 'cost', toId: 'use', stroke: 'ink', tier: 2, pattern: 'solid'
      });
      ctx.edge({ x: use.x, y: midY(use) }, { x: demand.x + demand.w, y: midY(demand) }, {
        fromId: 'use', toId: 'demand', stroke: 'ink', tier: 2, pattern: 'solid'
      });
      ctx.edge({ x: midX(demand), y: demand.y }, { x: midX(eff), y: eff.y + eff.h }, {
        fromId: 'demand', toId: 'eff', stroke: 'accent', tier: 1, pattern: 'solid',
        label: 'funds the next round', legend: 'The leg that closes the loop'
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'cooling-water-loop',
    page: 'article-10.html',
    caption:
      'The loop the mitigation list acts on. Evaporation is the loss that does the work \u2014 it ' +
      'is how the heat leaves \u2014 so it cannot be engineered away, only reduced by rejecting ' +
      'less heat. Blowdown is a deliberate discharge that keeps dissolved solids in check, which ' +
      'is what raising the cycles of concentration reduces. Leaks return nothing at all.',
    because:
      'section 8.1 tells the reader to raise the cycles of concentration to cut blowdown, and to ' +
      'raise supply setpoints. Both instructions assume a loop the article never draws, and ' +
      '"blowdown" is meaningless to a reader who does not already know it is deliberate. The ' +
      'figure makes the list legible; it adds no number the article does not carry.',
    build() {
      const ctx = D.create({
        slug: 'cw-loop',
        title: 'Where cooling water leaves the loop, and which lever acts on each path',
        desc: 'Make-up water enters a cooling tower basin. It leaves by three paths. Evaporation ' +
              'carries the heat away and is the reason the tower works, so it is reduced only by ' +
              'rejecting less heat, which is what raising supply setpoints does. Blowdown is a ' +
              'deliberate discharge controlled by the cycles of concentration. Leaks are pure ' +
              'loss and are addressed by detection. Water use effectiveness measures the whole.'
      });

      const X_IN = 40, X_MID = 300, X_OUT = 700;
      const W_IN = 200, W_MID = 250, W_OUT = 290;
      /* The basin is drawn tall enough that its three ports are spaced for the
       * nodes they feed, not merely for the 12-unit rule-4 minimum. Ports sit
       * at L*k/(N+1), so three outputs on a 384-unit edge land 96 apart, which
       * clears a 72-unit node with 24 to spare. The first cut used a 128-unit
       * basin: the ports passed rule 4 at 32 apart and the nodes still
       * overlapped by 40. Spacing that satisfies the connector rule is not the
       * same as spacing that fits the content. */
      const BASIN_TOP = 40, BASIN_H = 384;

      const makeup = ctx.node(X_IN, BASIN_TOP + BASIN_H / 2 - 36, {
        id: 'makeup', tag: 'in', name: 'Make-up water', sublabel: 'drawn from the local supply',
        /* no legend entry: drawn the same as the loss paths, and its own IN tag
           already says what it is */
        w: W_IN, stroke: 'rule-solid', fill: 'paper', tier: 2
      });

      const basin = ctx.node(X_MID, BASIN_TOP, {
        id: 'basin', tag: 'tower', name: 'Cooling tower basin', sublabel: 'circulating loop', symbol: 'coolingTower',
        w: W_MID, h: BASIN_H, vAlign: 'middle',
        stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'The loop itself'
      });

      const outs = [
        { id: 'evap', tag: 'does the work', name: 'Evaporation',
          sub: 'this is how the heat leaves', lever: 'raise setpoints',
          stroke: 'rule-solid', dashed: false, legend: 'Loss that carries the heat' },
        { id: 'blow', tag: 'deliberate', name: 'Blowdown',
          sub: 'discharged to control dissolved solids', lever: 'raise cycles',
          stroke: 'rule-solid', dashed: false },
        { id: 'leak', tag: 'pure loss', name: 'Leaks',
          sub: 'returns nothing, compounds annually', lever: 'leak detection',
          stroke: 'soft', dashed: true, legend: 'Loss that does no work' }
      ];

      const ports = ctx.ports(basin, 3, 'right', { id: 'basin' });
      outs.forEach(function (o, i) {
        const n = ctx.node(X_OUT, ports[i].y - 36, {
          id: o.id, tag: o.tag, name: o.name, sublabel: o.sub, w: W_OUT,
          stroke: o.stroke, fill: 'paper', tier: 2, dashed: o.dashed, legend: o.legend
        });
        ctx.edge({ x: ports[i].x, y: ports[i].y }, { x: n.x, y: ports[i].y }, {
          fromId: 'basin', toId: o.id,
          stroke: o.dashed ? 'soft' : 'ink', tier: 2,
          pattern: o.dashed ? 'dotted' : 'solid',
          label: o.lever, legend: o.dashed ? undefined : 'The lever that acts on it'
        });
      });

      ctx.edge({ x: makeup.x + makeup.w, y: makeup.y + makeup.h / 2 },
               { x: basin.x, y: basin.y + basin.h / 2 }, {
        fromId: 'makeup', toId: 'basin', stroke: 'ink', tier: 2, pattern: 'solid'
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'cpo-trace-collapse',
    page: 'article-22.html',
    caption:
      'Drawn to the trace lengths the article quotes: the electrical run is 24 times shorter in ' +
      'the lower arrangement. Moving the conversion from the front panel to the package is not a ' +
      'packaging preference \u2014 it is what removes the retimers, because at half an inch there ' +
      'is no longer a signal to recover.',
    because:
      'the article already tabulates pluggable against co-packaged across seven characteristics, ' +
      'including the two trace lengths as numbers. What the table cannot show is that this is a ' +
      'question of GEOMETRY: the argument is about distance on a board, and the retimers exist ' +
      'only to pay for that distance. Draw the distance and their removal explains itself.',
    build() {
      const ctx = D.create({
        slug: 'cpo',
        title: 'Where the electrical-to-optical conversion happens, and how far the signal travels to reach it',
        desc: 'In the pluggable arrangement the switch ASIC drives 12 to 18 inches of printed ' +
              'circuit board trace to a front-panel cage, and retimers, clock-and-data recovery ' +
              'and DSP sit in that path to recover the signal. In co-packaged optics the optical ' +
              'engine sits on the same package substrate as the ASIC, the electrical run falls ' +
              'below half an inch, and the recovery circuits are no longer needed. The two rows ' +
              'are drawn to the same scale.'
      });

      /* The drawing is to scale on the one axis that carries the argument.
       * 12 inches against 0.5 is 24:1, so at 16 units for the short run the
       * long one is 384. An illustrative ratio would have been easier to lay
       * out and would have quietly overstated or understated the point; the
       * whole claim IS the ratio, so the ratio is drawn. */
      const SHORT = 16, LONG = 384;
      const X0 = 40, ASIC_W = 170, CONV_W = 210;
      const ROW_A = 66, ROW_B = 250;

      const asicA = ctx.node(X0, ROW_A, {
        id: 'asic-a', tag: 'asic', name: 'Switch ASIC', sublabel: '224G PAM4 SerDes',
        w: ASIC_W, stroke: 'rule-solid', fill: 'paper', tier: 2
      });
      const retimer = ctx.node(X0 + ASIC_W + LONG / 2 - 92, ROW_A, {
        id: 'retimer', tag: 'in path', name: 'Retimers · CDR · DSP',
        sublabel: 'several W per lane, 64 lanes',
        w: 184, stroke: 'accent', fill: 'paper-2', tier: 2,
        legend: 'Exists only to pay for the distance'
      });
      const plug = ctx.node(X0 + ASIC_W + LONG, ROW_A, {
        id: 'plug', tag: 'front panel', name: 'Pluggable optic', sublabel: 'QSFP-DD / OSFP',
        w: CONV_W, stroke: 'rule-solid', fill: 'paper', tier: 2,
        legend: 'Electrical \u2192 optical conversion'
      });

      const asicB = ctx.node(X0, ROW_B, {
        id: 'asic-b', tag: 'asic', name: 'Switch ASIC', sublabel: 'same silicon',
        w: ASIC_W, stroke: 'rule-solid', fill: 'paper', tier: 2
      });
      const engine = ctx.node(X0 + ASIC_W + SHORT, ROW_B, {
        id: 'engine', tag: 'on package', name: 'Optical engine', sublabel: 'silicon photonics',
        w: CONV_W, stroke: 'rule-solid', fill: 'paper', tier: 2
      });

      const mid = (n) => n.y + n.h / 2;
      ctx.edge({ x: asicA.x + asicA.w, y: mid(asicA) }, { x: retimer.x, y: mid(retimer) }, {
        fromId: 'asic-a', toId: 'retimer', stroke: 'ink', tier: 1, pattern: 'solid',
        /* the segment is 100 units and the full phrase needs 117, so the
           description lives in the caption and the number on the line */
        label: '12\u201318 in', legend: 'Electrical, lossy at 224G'
      });
      ctx.edge({ x: retimer.x + retimer.w, y: mid(retimer) }, { x: plug.x, y: mid(plug) }, {
        fromId: 'retimer', toId: 'plug', stroke: 'ink', tier: 1, pattern: 'solid'
      });
      ctx.edge({ x: asicB.x + asicB.w, y: mid(asicB) }, { x: engine.x, y: mid(engine) }, {
        /* No label on this one: the run is 16 units and the shortest honest
           label is 37, so it cannot sit beside the line without covering it.
           The zone below carries the number instead. The engine refused to
           place it rather than drawing it over the stroke. */
        fromId: 'asic-b', toId: 'engine', stroke: 'ink', tier: 1, pattern: 'solid'
      });

      /* The fibre is the same on both rows: what changes is everything before
       * it. Drawn short and identical so the eye compares the copper, not this. */
      [[plug, 'fibre-a'], [engine, 'fibre-b']].forEach(function (pair) {
        const n = pair[0];
        ctx.edge({ x: n.x + n.w, y: mid(n) }, { x: n.x + n.w + 64, y: mid(n) }, {
          fromId: n.id, toId: pair[1], stroke: 'muted', tier: 2, pattern: 'dashed',
          label: 'fibre', legend: 'Optical, out of the switch'
        });
      });

      ctx.zone(X0 - 18, ROW_B - 40, ASIC_W + SHORT + CONV_W + 36,
               (engine.y + engine.h + 20) - (ROW_B - 40), {
        label: 'one package substrate \u2014 under 0.5 in of electrical run, and no retimers', tier: 3, dashed: true,
        stroke: 'accent'
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'heat-path-ceilings',
    page: 'article-18.html',
    caption:
      'The same heat, two paths. Air carries it through the room, so the room becomes the ' +
      'bottleneck and the path tops out near 30 kW per rack. A cold plate carries it in liquid ' +
      'from the die, and the room stops being in the way. GB300 NVL72 at 132-140 kW per rack sits ' +
      'above the air ceiling by a factor of four — which is why the transition is not a preference.',
    because:
      'the article tabulates rack density by platform, and separately tabulates cooling technology ' +
      'by ceiling. Neither table connects them, and the connection is the section\'s argument: the ' +
      'density trajectory crossed the air ceiling, so the heat path had to change SHAPE. A table ' +
      'cannot show a change of shape.',
    build() {
      const ctx = D.create({
        slug: 'heat-path',
        title: 'Two heat paths, and where each one runs out',
        desc: 'In an air-cooled rack, heat leaves the die through a heatsink into room air, is ' +
              'collected by a CRAH and passed to chilled water. That path is limited by what room ' +
              'air can carry, roughly 30 kW per rack. In a liquid-cooled rack, heat leaves the die ' +
              'into a cold plate and passes through a CDU directly to facility water; the room is ' +
              'no longer in the path, and direct-to-chip reaches roughly 200 kW per rack. Both ' +
              'paths end at the same heat rejection plant.'
      });

      const COL_A = 40, COL_B = 470, W = 330;
      const Y0 = 78, PITCH = 104;

      function chain(x, rows, strokeFor) {
        const out = [];
        rows.forEach((r, i) => {
          out.push(ctx.node(x, Y0 + i * PITCH, {
            id: r.id, tag: r.tag, name: r.name, sublabel: r.sub, w: W, symbol: r.symbol,
            stroke: strokeFor(i), fill: 'paper', tier: 2,
            legend: r.legend
          }));
        });
        return out;
      }

      const air = chain(COL_A, [
        { id: 'a-die', tag: 'source', name: 'GPU die', sub: 'heat flux to 1,000 W/cm\u00B2' },
        { id: 'a-room', tag: 'air', name: 'Heatsink \u2192 room air', sub: 'the room is in the path' },
        { id: 'a-crah', tag: 'crah', name: 'CRAH \u2192 chilled water', sub: 'PUE 1.4\u20131.8', symbol: 'crah' }
      ], () => 'rule-solid');

      const liq = chain(COL_B, [
        { id: 'l-die', tag: 'source', name: 'GPU die', sub: 'same heat, same flux' },
        { id: 'l-plate', tag: 'liquid', name: 'Cold plate', sub: 'liquid at the die' },
        { id: 'l-cdu', tag: 'cdu', name: 'CDU \u2192 facility water', sub: 'PUE 1.10\u20131.35', symbol: 'cdu' }
      ], (i) => (i === 1 ? 'accent' : 'rule-solid'));

      [[air, 'Air path'], [liq, 'Liquid path']].forEach(function (pair) {
        const col = pair[0];
        for (let i = 0; i < col.length - 1; i++) {
          ctx.edge({ x: col[i].x + col[i].w / 2, y: col[i].y + col[i].h },
                   { x: col[i + 1].x + col[i + 1].w / 2, y: col[i + 1].y }, {
            fromId: col[i].id, toId: col[i + 1].id, stroke: 'muted', tier: 2, pattern: 'solid'
          });
        }
      });

      /* Both paths end in the same plant. Drawing it once, below and between,
       * is what makes them two routes to one place rather than two systems. */
      const last = air[air.length - 1];
      const reject = ctx.node(COL_A + (COL_B + W - COL_A) / 2 - W / 2,
                              last.y + last.h + 96, {
        id: 'reject', tag: 'shared', name: 'Heat rejection', sublabel: 'the same plant, either way',
        w: W, stroke: 'rule-solid', fill: 'paper-2', tier: 2
      });
      [air[2], liq[2]].forEach(function (n, i) {
        ctx.edge({ x: n.x + n.w / 2, y: n.y + n.h },
                 { x: reject.x + reject.w * (i ? 0.72 : 0.28), y: reject.y }, {
          fromId: n.id, toId: 'reject', stroke: 'muted', tier: 2, pattern: 'solid'
        });
      });

      /* The ceilings. These are the point, so they are containers rather than
       * captions: Common Region ties the number to the whole path it limits. */
      ctx.zone(COL_A - 18, Y0 - 44, W + 36, (air[2].y + air[2].h + 20) - (Y0 - 44), {
        label: 'air path \u2014 ceiling about 30 kW per rack', tier: 3, dashed: true
      });
      ctx.zone(COL_B - 18, Y0 - 44, W + 36, (liq[2].y + liq[2].h + 20) - (Y0 - 44), {
        label: 'direct-to-chip \u2014 about 200 kW per rack', tier: 3, dashed: true,
        stroke: 'accent'
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'pfas-loss-zones',
    page: 'article-26.html',
    caption:
      'Where the charge actually goes. Only the drain path crosses a meter, and even there only ' +
      'the recovery percentage is logged; every other route leaves the system unmeasured. The one ' +
      'field measurement that exists, 17.1 %/yr, is an order of magnitude above the sealed-system ' +
      'vendor figure.',
    because:
      'the article already tabulates the seven loss zones with magnitudes and sources. What the ' +
      'table cannot show is that the escape routes BYPASS the meter — that is a spatial fact, and ' +
      'it is the point of the section.',
    build() {
      const ctx = D.create({
        slug: 'pfas-loss',
        title: 'Immersion fluid loss zones, and which ones cross a meter',
        desc: 'A tank charge of two-phase immersion fluid leaves the system by five routes. Only ' +
              'the drain and transfer path is partially metered, through its recovery percentage. ' +
              'Maintenance vapour, quick-disconnect spillage, operating evaporative loss and three ' +
              'further zones carrying no published number at all are unmetered, and none of the ' +
              'five is reportable as an emission.'
      });

      /* Layout: the charge is a TALL node on the left, sized so its five ports
       * land opposite the five destinations. Every run is then a straight
       * horizontal line — no elbows, no detours, no crossings. The first cut
       * used a short node and let the router find its way, which produced five
       * doglegs bunched 9 units apart. Rule 4's spacing is not a detail; it is
       * what decides whether the drawing has a shape. */
      const ROWS = [
        { id: 'drain',  tag: 'partial',  name: 'Drain / transfer residual',
          sub: '4-6 % retained · recovery logged', metered: true },
        { id: 'vapour', tag: 'no meter', name: 'Maintenance vapour',
          sub: '3-12 L per service' },
        { id: 'qd',     tag: 'no meter', name: 'Quick-disconnect spillage',
          sub: '2-3 mL per connect' },
        { id: 'evap',   tag: 'no meter', name: 'Operating evaporative loss',
          sub: '17.1 %/yr measured · 1-2 %/yr claimed' },
        { id: 'none',   tag: 'no number', name: 'Three further zones',
          sub: 'seal permeation · fill/flush · end-of-life' }
      ];

      const TOP = 56;
      const PITCH = 92;   /* a 72-unit node plus breathing room */
      const COL_R = 380;
      const chargeH = M.grid4(PITCH * ROWS.length);

      const charge = ctx.node(40, TOP, {
        id: 'charge', tag: 'charge', tier: 1, h: chargeH, w: 232,
        name: 'TANK CHARGE',
        sublabel: 'two-phase / immersion fluid',
        stroke: 'accent', fill: 'paper-2', legend: 'The fluid being tracked'
      });

      const ports = ctx.ports(charge, ROWS.length, 'right', { id: 'charge' });
      /* Extra air between the one metered route and the four that are not, so
       * the container below it reads as a separate region rather than as a box
       * that happens to start where the row above ended. */
      const SPLIT = 26;
      const portY = (i) => ports[i].y + (i === 0 ? 0 : SPLIT);

      const boxes = [];
      ROWS.forEach((row, i) => {
        const y = portY(i);
        const node = ctx.node(COL_R, y - 36, {
          id: row.id, tag: row.tag, w: 394,
          name: row.name, sublabel: row.sub,
          stroke: row.metered ? 'rule-solid' : 'soft',
          fill: 'paper', tier: row.metered ? 2 : 3, dashed: !row.metered,
          legend: row.metered ? 'Partially metered' : (i === 1 ? 'Unmetered' : undefined)
        });
        ctx.edge({ x: ports[i].x, y: ports[i].y }, { x: node.x, y: y }, {
          fromId: 'charge', toId: row.id,
          stroke: row.metered ? 'ink' : 'muted',
          /* tier 2 even for the unmetered routes: at tier 3 a dotted soft line
             is legible on a cockpit sheet but disappears in an article, where
             the figure is scaled to a reading column rather than a console. */
          tier: 2,
          pattern: row.metered ? 'solid' : 'dotted',
          label: row.metered ? 'metered' : undefined,
          legend: row.metered ? 'Crosses a meter' : (i === 1 ? 'No meter, no reporting line' : undefined)
        });
        boxes.push({ box: node, metered: !!row.metered });
      });

      /* The unmetered routes share a container. Common Region is what makes
       * "outside any meter" one fact rather than four repeated labels, and four
       * of the five routes sitting inside it IS the finding.
       *
       * Its bounds come from the nodes it contains, not from the port spacing:
       * computing it from ports put its top border and its own eyebrow through
       * the metered node above. Paint order does not follow call order — zones
       * are emitted first whenever they are declared — so it can be measured
       * from the drawing it encloses. */
      const inside = boxes.filter(b => !b.metered).map(b => b.box);
      const zx = Math.min(...inside.map(b => b.x)) - 18;
      const zy = Math.min(...inside.map(b => b.y)) - 34;
      const zr = Math.max(...inside.map(b => b.x + b.w)) + 18;
      const zb = Math.max(...inside.map(b => b.y + b.h)) + 18;
      ctx.zone(zx, zy, zr - zx, zb - zy, {
        label: 'outside any meter \u2014 and none of it reportable',
        tier: 3, dashed: true
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
  /* the diagrams articles used to draw by hand — see article-diagrams-converted.mjs */
  ...convertedFigures(D),
  /* article 29 — see the grid helper above */
  ...LLM_FIGURES,
  /* article 30 */
  ...AGENTIC_FIGURES
];

/* ==========================================================================
 * build
 * ======================================================================== */
/* ---- the token contract, bridged to the article palette ------------------
 * The engine emits no literal hex: every colour resolves to a custom property.
 * An article does not define those properties — it has its own --rz-art-* set —
 * so a figure dropped into one renders as a black rectangle. That is exactly
 * the failure the engine's own T1-T3 gate was written for, and the gate missed
 * it: T3 only inspects pages that load js/rz-diagram.js with a <script>, and a
 * build-time figure loads nothing.
 *
 * The bridge is emitted WITH the figure and scoped to it, so it satisfies the
 * contract without leaking engine names into the article's own palette, and the
 * figure follows the article's theme rather than carrying a second one. Every
 * value is a var() onto the article set — still no hex.
 */
const TOKEN_BRIDGE = [
  '--bg1:var(--rz-art-bg)',
  '--bg3:var(--rz-art-panel)',
  '--t1:var(--rz-art-strong)',
  '--t2:var(--rz-art-text)',
  '--t3:var(--rz-art-muted)',
  '--bd:var(--rz-art-line)',
  '--bd2:var(--rz-art-muted)',
  '--o:var(--rz-art-accent)',
  '--c:var(--rz-art-accent2)',
  '--g:var(--rz-art-accent2)',
  '--r:var(--rz-art-accent)'
].join(';');
/* A figure that draws a safety-rated system (SIS, EPO, fire) opts into a red fault role with
 * `faultRed: true`. The article palette has one accent, so alarm-fault otherwise renders in it and a
 * safety box reads as the same thing as a probabilistic one. --rz-chip-alert is the site's themed alert
 * red (styles.css), so the figure still carries no hex and follows the theme. */
const FAULT_BRIDGE = TOKEN_BRIDGE.replace('--r:var(--rz-art-accent)', '--r:var(--rz-chip-alert)');

function figureMarkup(fig, ctx, narrow) {
  /* Size bounds travel WITH the figure, because they depend on its own viewBox.
   *
   * `width:100%` alone fails in both directions. A 1,672-unit figure shrinks
   * until its 8-unit type renders under 6 px; a 460-unit one is stretched until
   * a 12-unit name renders at 18 and the figure shouts. A drawing should render
   * at its own scale and shrink only when it must.
   *
   * max-width is the viewBox, so it never upscales. min-width is the smaller of
   * the viewBox and 640, so a wide figure scrolls in its own track instead of
   * shrinking into illegibility, and a narrow one never forces a scrollbar it
   * does not need. */
  /* min-width is the FULL viewBox, not min(viewBox, 640).
   *
   * Letting a figure shrink to the column was the whole defect: a 1,032-unit
   * figure in a 744 px column renders at 0.72, and a 9-unit label lands at
   * 6.5 px — well under this site's 8.5 px floor. Measured across the corpus,
   * nine of eleven figures were illegible that way, and the legibility gate
   * reported only two of them, because its page set does not cover the rest.
   *
   * With max-width and min-width both equal to the viewBox the figure always
   * renders exactly 1:1 and scrolls inside its own overflow-x track when the
   * column is narrower — the same treatment this site already gives wide tables
   * and code blocks. Scrolling a figure is a cost; being unable to read it is a
   * defect. */
  const bounds = 'max-width:' + ctx.width + 'px;min-width:' + ctx.width + 'px;';
  const bridge = fig.faultRed ? FAULT_BRIDGE : TOKEN_BRIDGE;
  let svg = ctx.render().replace(
    '<svg ', '<svg ' + (narrow ? 'class="rz-fig-wide" ' : '') + 'style="' + bounds + bridge + '" ');
  if (narrow) {
    const nb = 'max-width:' + narrow.width + 'px;min-width:' + Math.ceil(narrow.width * PHONE_MIN_SCALE) + 'px;';
    svg += '\n' + narrow.render().replace('<svg ', '<svg class="rz-fig-narrow" style="' + nb + bridge + '" ');
  }
  /* A living figure carries its runtime configuration inside the figure, where
   * js/rz-article-diagram.js looks for it. It is emitted from the definition, so
   * the scenarios cannot drift from the drawing they animate. `<` is escaped so
   * no string in it can close the script element. */
  const live = fig.live
    ? '<script type="application/json" class="rz-diagram-cfg">' +
      JSON.stringify(fig.live).replace(/</g, '\\u003c') + '</script>\n'
    : '';
  /* caption: null — the figure sits in a container that already titles it (a
   * scrollytelling canvas), and a second caption would repeat that title. */
  const cap = fig.caption === null ? ''
    : '\n<figcaption class="rz-figcaption">' + captionMarkup(fig.caption) + '</figcaption>';
  return '\n' + svg + cap + '\n' + live;
}

/* A caption carries two different things, and they were being set in one voice.
 *
 * Measured across the whole corpus: all 13 captions run 276-367 characters, set
 * in IBM Plex Mono at .78rem with .02em tracking. Mono with positive tracking is
 * this site's instrument register -- a reading, a unit, a timestamp. Three
 * sentences of argument in it is the typography claiming "machine output" about
 * text that is the author arguing, and that mismatch is a large part of what the
 * owner was pointing at.
 *
 * The split is not an editorial guess. Every caption was already written in the
 * same shape: one short declarative sentence naming what the figure shows, then
 * the argument. So the lead keeps the instrument register and the argument gets
 * prose type. No caption text is altered -- and doing it HERE rather than in the
 * HTML matters, because this tool owns everything between <figure> and </figure>:
 * the same structure applied by hand in the pages was reported out of date by
 * --check and would have been overwritten by the next build. */
function captionMarkup(caption) {
  const m = /\.\s+/.exec(caption);
  if (!m) return caption;
  const lead = caption.slice(0, m.index + 1).trim();
  let rest = caption.slice(m.index + m[0].length).trim();
  if (!rest || lead.length > 140) return caption;
  // provenance stays instrument meta wherever a caption carries one
  let src = '';
  const sm = /Source:\s[\s\S]*$/.exec(rest);
  if (sm) { src = sm[0].trim(); rest = rest.slice(0, sm.index).trim(); }
  // the space between the spans is for the extractors, not the layout: both are
  // display:block, but llms-full.txt, the PDF export and a screen reader all read
  // the caption as continuous text and glued two sentences together without it.
  let out = '<span class="rz-figcaption-lead">' + lead + '</span>' +
            ' <span class="rz-figcaption-note">' + rest + '</span>';
  if (src) out += ' <span class="rz-figcaption-src">' + src + '</span>';
  return out;
}

/* --rz-measure: 46rem in css/rz-article-dark.css. Measured content column ~744 px;
 * 736 is the token, and the token is what the figure has to live inside. */
const ARTICLE_TRACK_PX = 736;
const WIDTH_WARN_RATIO = 1.0;   // report any figure wider than the column
const WIDTH_FAIL_RATIO = 2.0;   // past 2x, more of the figure is hidden than shown
/* Pages refit to the column. The owner reads a figure cut off at the column edge as broken
 * (2026-10-25, article-30: "terpotong dan aneh sekali"), so on these pages any figure wider
 * than the column fails the build. FLIP: add a page here once its figures are refit; the
 * remaining overflow list printed below is the backlog. */
const FIT_TO_COLUMN_PAGES = new Set(['article-30.html']);

const findings = [];
/* Two boxes the composition placed on top of each other. The engine warns about
 * what it was ASKED to do wrong; this catches what the layout did wrong. */
function overlapFindings(page, id, ctx) {
  /* fit() grows the canvas right and down only, so anything placed left of or
   * above the origin is cut off by the viewBox: a label pushed outside a lane. */
  for (const it of ctx.occupancy.items) {
    if (it.box.x < -0.5 || it.box.y < -0.5) findings.push(
      `${page} · ${id}: ${it.meta.kind}:${it.meta.id || ''} starts at ${it.box.x.toFixed(0)},${it.box.y.toFixed(0)} — outside the drawing, clipped`);
  }
  const geom = ctx.occupancy.items.filter((i) => i.meta.kind === 'text' || i.meta.kind === 'node');
  for (let a = 0; a < geom.length; a++) {
    for (let b = a + 1; b < geom.length; b++) {
      const A = geom[a], B = geom[b];
      if (M.contains(A.box, B.box) || M.contains(B.box, A.box)) continue;
      const ov = M.overlap(A.box, B.box);
      if (ov && ov.ox > 0.5 && ov.oy > 0.5) {
        findings.push(
          `${page} · ${id}: ${A.meta.kind}:${A.meta.id} overlaps ` +
          `${B.meta.kind}:${B.meta.id} by ${ov.ox.toFixed(1)}x${ov.oy.toFixed(1)} ` +
          `(shorter axis: ${ov.axis})`);
      }
    }
  }
}
/* Overflow a reader can scroll to is a cost, not a defect. It belongs in the
 * report so the author sees the bill, not in the exit code. */
const notes = [];
const written = [];
const byPage = new Map();
for (const fig of FIGURES) {
  if (!byPage.has(fig.page)) byPage.set(fig.page, []);
  byPage.get(fig.page).push(fig);
}

for (const [page, figs] of byPage) {
  const path = join(root, page);
  let html = readFileSync(path, 'utf8');
  const before = html;

  for (const fig of figs) {
    const ctx = fig.build();
    if (ctx.warnings.length) {
      for (const w of ctx.warnings) {
        findings.push(`${page} · ${fig.id}: ${w.kind} — ${w.message}`);
      }
    }
    /* A built figure may be wider than the reading measure. That trade is
     * deliberate and already recorded in figureMarkup(): "Scrolling a figure is
     * a cost; being unable to read it is a defect." So the question is not
     * whether it overflows, it is BY HOW MUCH, and where the cost stops being
     * worth paying.
     *
     * This check used to compute the type size a wide figure "would" shrink to.
     * That measured something that does not happen: .rz-figure gives the figure
     * its own scroll track, and the SVG keeps its intrinsic size via the
     * min-width pin -- it is clipped and scrolled, never scaled. And it was
     * calibrated to a 1100 px column while the real one is --rz-measure: 46rem
     * = 736 px, so it never fired once: 11 of the 12 built figures are wider
     * than the column and the build reported PASS on all of them.
     *
     * What a reader actually loses is the fraction sitting outside the track on
     * arrival. Report that for every overflowing figure; fail only past 2x,
     * where more of the drawing is hidden than shown. */
    const over = ctx.width / ARTICLE_TRACK_PX;
    const hidden = Math.round((1 - 1 / over) * 100);
    if (over > WIDTH_FAIL_RATIO) {
      findings.push(
        `${page} · ${fig.id}: ${ctx.width} px is ${over.toFixed(2)}x the ${ARTICLE_TRACK_PX} px ` +
        `reading column — ${hidden}% of the figure is off-screen on arrival. Past 2x the scroll ` +
        `stops being a cost and becomes the whole experience. Stack or wrap the composition.`);
    } else if (over > WIDTH_WARN_RATIO && FIT_TO_COLUMN_PAGES.has(page)) {
      findings.push(
        `${page} · ${fig.id}: ${ctx.width} px is wider than the ${ARTICLE_TRACK_PX} px column on a page refit ` +
        `to it — ${hidden}% would be cut off on arrival. Narrow the composition (fewer columns, shorter sublines).`);
    } else if (over > WIDTH_WARN_RATIO) {
      notes.push(
        `${page} · ${fig.id}: ${ctx.width} px, ${over.toFixed(2)}x the ${ARTICLE_TRACK_PX} px column ` +
        `(${hidden}% off-screen on arrival, reachable by scrolling).`);
    }

    /* Audit the figure's own geometry before writing it. The engine warns about
     * what it was ASKED to do wrong; this catches what the composition did
     * wrong — two boxes the author placed on top of each other. Without it this
     * tool would happily write a figure whose zone eyebrow sits across the node
     * above it, which is precisely what the first draft did. */
    overlapFindings(page, fig.id, ctx);

    /* The phone composition, when the figure has one, is held to the same
     * geometry audit and must fit the phone column outright: its whole reason
     * to exist is that nothing scrolls sideways. */
    PHONE = true;
    let narrow;
    try { narrow = fig.build(); } finally { PHONE = false; }
    if (narrow && narrow.variant !== 'phone') narrow = null;
    if (narrow) {
      for (const w of narrow.warnings) findings.push(`${page} · ${fig.id} (phone): ${w.kind} — ${w.message}`);
      if (narrow.width > PHONE_MAX_PX) findings.push(
        `${page} · ${fig.id} (phone): ${narrow.width} px is wider than the ${PHONE_MAX_PX} px phone column`);
      overlapFindings(page, fig.id + ' (phone)', narrow);
    } else if (FIT_TO_COLUMN_PAGES.has(page) && fig.build.toString().includes('gridFigure')) {
      findings.push(`${page} · ${fig.id}: no phone composition — it would scroll sideways on a phone`);
    }
    const open = new RegExp(
      '<figure\\b[^>]*data-rz-figure="' + fig.id + '"[^>]*>', 'i');
    const m = open.exec(html);
    if (!m) {
      findings.push(
        `${page} has no placeholder for "${fig.id}". Add ` +
        `<figure class="rz-figure" data-rz-figure="${fig.id}"></figure> where the figure belongs — ` +
        `this tool never decides that for you.`);
      continue;
    }
    const start = m.index + m[0].length;
    const end = html.indexOf('</figure>', start);
    if (end < 0) { findings.push(`${page} · ${fig.id}: placeholder is not closed`); continue; }
    html = html.slice(0, start) + figureMarkup(fig, ctx, narrow) + html.slice(end);
  }

  if (html !== before) {
    if (CHECK) findings.push(`${page} is out of date — run without --check to rebuild`);
    else { writeFileSync(path, html); written.push(page); }
  }
}

console.log(`ARTICLE DIAGRAMS — ${FIGURES.length} figure(s) across ${byPage.size} page(s)`);
for (const fig of FIGURES) console.log(`  ${fig.page.padEnd(18)} ${fig.id}`);
if (written.length) console.log(`  rebuilt: ${written.join(', ')}`);

if (notes.length) {
  console.log(`\n  ${notes.length} figure(s) wider than the ${ARTICLE_TRACK_PX} px reading column — scrollable, not clipped:`);
  for (const n of notes) console.log('    ' + n);
}
if (findings.length) {
  console.log(`\nFAIL — ${findings.length} finding(s):`);
  for (const f of findings) console.log('  ' + f);
  process.exit(1);
}
console.log(CHECK ? '\nPASS — every figure is current' : '\nPASS — figures written');
