#!/usr/bin/env node
/**
 * test-rzd-ports.mjs — every connector on the LTC diagrams leaves and enters its blocks properly.
 *
 * Owner, 2026-10-11 (Tier power screenshot): "alur garis dan panahnya sangat nggak tepat, ini sering
 * sekali terjadi" — generator → transformer ran ALONG the transformer's left border and its arrowhead
 * pointed up at that border; TX → MCC ran along TX's bottom edge and down MCC's left edge.
 *
 * Rendered in headless Chrome, every path[data-rzd-edge] whose ends are interactive blocks is checked:
 *   R1  the last segment is perpendicular to the side it lands on and points INTO the block;
 *   R2  the first segment leaves perpendicular to its side, pointing AWAY from the block;
 *   R3  no segment runs along the border of either end block (collinear overlap > 2 units);
 *   R4  no segment passes through any other block;
 *   R5  no two connectors share a stretch of line (collinear overlap > 4 units) — two flows drawn
 *       on one stroke cannot be told apart (hub overview: rack → CDU and rack → CRAH did).
 * Pages: hub (4 plant views), Tier (4 tiers × power/cooling), ISO, ASHRAE, TIA, NFPA, model lab;
 * at 1440 and 390 px.
 *
 * Run: node tools/test-rzd-ports.mjs     (exits 1 on any failure)
 */
import puppeteer from 'puppeteer';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fails = [];
let checked = 0;

function audit() {
  const out = [];
  document.querySelectorAll('svg').forEach((svg, si) => {
    const rects = {};
    svg.querySelectorAll('rect[data-rzd-node]').forEach((r) => {
      rects[r.getAttribute('data-rzd-node')] = { x: +r.getAttribute('x'), y: +r.getAttribute('y'), w: +r.getAttribute('width'), h: +r.getAttribute('height') };
    });
    svg.querySelectorAll('path[data-rzd-edge]').forEach((p) => {
      if (p.getAttribute('data-rzd-transit') === '1') return;
      const [a, b] = (p.getAttribute('data-rzd-edge') || '').split('>');
      const A = rects[a], B = rects[b];
      if (!A || !B) return;
      const nums = (p.getAttribute('d') || '').match(/[MLA][^MLA]*/g).map((s) => {
        const v = s.slice(1).trim().split(/[\s,]+/).map(Number);
        return { x: v[v.length - 2], y: v[v.length - 1] };
      });
      const pts = nums.filter((q, i) => i === 0 || q.x !== nums[i - 1].x || q.y !== nums[i - 1].y);
      out.push({ svg: si, id: p.getAttribute('data-rzd-edge'), pts, A, B, others: Object.keys(rects).filter((k) => k !== a && k !== b).map((k) => rects[k]) });
    });
  });
  return out;
}

const E = 0.75;
function side(pt, r) {
  if (Math.abs(pt.x - r.x) < E && pt.y > r.y - E && pt.y < r.y + r.h + E) return 'l';
  if (Math.abs(pt.x - r.x - r.w) < E && pt.y > r.y - E && pt.y < r.y + r.h + E) return 'r';
  if (Math.abs(pt.y - r.y) < E && pt.x > r.x - E && pt.x < r.x + r.w + E) return 't';
  if (Math.abs(pt.y - r.y - r.h) < E && pt.x > r.x - E && pt.x < r.x + r.w + E) return 'b';
  return null;
}
const OUT = { l: [-1, 0], r: [1, 0], t: [0, -1], b: [0, 1] };
function dir(p, q) { return [Math.sign(q.x - p.x), Math.sign(q.y - p.y)]; }
function alongBorder(p, q, r) {
  const lines = [[r.x, null], [r.x + r.w, null], [null, r.y], [null, r.y + r.h]];
  for (const [lx, ly] of lines) {
    if (lx != null && Math.abs(p.x - lx) < E && Math.abs(q.x - lx) < E) {
      const lo = Math.max(Math.min(p.y, q.y), r.y), hi = Math.min(Math.max(p.y, q.y), r.y + r.h);
      if (hi - lo > 2) return true;
    }
    if (ly != null && Math.abs(p.y - ly) < E && Math.abs(q.y - ly) < E) {
      const lo = Math.max(Math.min(p.x, q.x), r.x), hi = Math.min(Math.max(p.x, q.x), r.x + r.w);
      if (hi - lo > 2) return true;
    }
  }
  return false;
}
function through(p, q, r) {
  const x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x), y0 = Math.min(p.y, q.y), y1 = Math.max(p.y, q.y);
  return x1 > r.x + 1 && x0 < r.x + r.w - 1 && y1 > r.y + 1 && y0 < r.y + r.h - 1;
}
function shared(e, f) {
  for (let i = 1; i < e.pts.length; i++) for (let j = 1; j < f.pts.length; j++) {
    const a = e.pts[i - 1], b = e.pts[i], c = f.pts[j - 1], d = f.pts[j];
    if (Math.abs(a.x - b.x) < E && Math.abs(c.x - d.x) < E && Math.abs(a.x - c.x) < E) {
      if (Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) > 4) return true;
    }
    if (Math.abs(a.y - b.y) < E && Math.abs(c.y - d.y) < E && Math.abs(a.y - c.y) < E) {
      if (Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) > 4) return true;
    }
  }
  return false;
}
function check(where, e) {
  checked++;
  const n = e.pts.length, s0 = side(e.pts[0], e.A), s1 = side(e.pts[n - 1], e.B);
  const tag = `${where} ${e.id}`;
  if (!s1) fails.push(`${tag}: does not end on the border of its target block`);
  else {
    const d = dir(e.pts[n - 2], e.pts[n - 1]), want = OUT[s1].map((v) => -v);
    if (d[0] !== want[0] || d[1] !== want[1]) fails.push(`R1 ${tag}: lands on the ${s1} side but its last segment runs ${d} (should point into the block)`);
  }
  if (!s0) fails.push(`${tag}: does not start on the border of its source block`);
  else {
    const d = dir(e.pts[0], e.pts[1]), want = OUT[s0];
    if (d[0] !== want[0] || d[1] !== want[1]) fails.push(`R2 ${tag}: leaves the ${s0} side but its first segment runs ${d}`);
  }
  for (let i = 1; i < n; i++) {
    const p = e.pts[i - 1], q = e.pts[i];
    if (alongBorder(p, q, e.A) || alongBorder(p, q, e.B)) { fails.push(`R3 ${tag}: segment ${i} runs along an end block's border`); break; }
    if (e.others.some((r) => through(p, q, r))) { fails.push(`R4 ${tag}: segment ${i} passes through another block`); break; }
  }
}

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const pages = [
  ['standards-ltc-lab.html', async (p, run) => { for (const v of ['overview', 'power', 'liquid', 'air']) { await p.evaluate((v) => document.querySelector('[data-view="' + v + '"]')?.click(), v); await run('hub ' + v); } }],
  ['ltc-uptime-tier-alignment.html#simulator', async (p, run) => {
    for (const sys of ['power', 'cooling']) for (const t of [1, 2, 3, 4]) {
      await p.evaluate((sys, t) => { document.querySelector('[data-sys="' + sys + '"]').click(); document.querySelector('[data-tier="' + t + '"]').click(); }, sys, t);
      await run(`tier ${t} ${sys}`);
    }
  }],
  ['ltc-iso-energy-governance.html', async (p, run) => run('iso')],
  ['ltc-ashrae-thermal-control.html', async (p, run) => run('ashrae')],
  ['ltc-ansi-tia-topology-readiness.html', async (p, run) => run('tia')],
  ['ltc-nfpa-fire-risk.html', async (p, run) => run('nfpa')],
  ['ltc-system-modelling-lab.html', async (p, run) => run('lab')]
];
for (const w of [1440, 390]) {
  for (const [url, walk] of pages) {
    const p = await b.newPage();
    await p.setViewport({ width: w, height: 1100 });
    await p.evaluateOnNewDocument(() => { localStorage.setItem('rz_premium_session', JSON.stringify({ role: 'root', tier: 'root', email: 'gate@local', name: 'Gate' })); localStorage.removeItem('ltc_plant_v1'); });
    await p.goto('file://' + ROOT + '/' + url, { waitUntil: 'networkidle2' });
    await walk(p, async (where) => {
      await new Promise((r) => setTimeout(r, 120));
      const es = await p.evaluate(audit);
      es.forEach((e) => check(`${w}px ${where}`, e));
      for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
        if (es[i].svg === es[j].svg && shared(es[i], es[j])) fails.push(`R5 ${w}px ${where}: ${es[i].id} and ${es[j].id} share a stretch of line`);
      }
    });
    await p.close();
  }
}
await b.close();

if (checked < 100) fails.push(`only ${checked} connectors checked — the walk did not reach the diagrams`);
if (fails.length) {
  console.log(`FAIL — ${fails.length} connector(s) of ${checked} enter or leave a block wrongly:`);
  [...new Set(fails)].slice(0, 200).forEach((f) => console.log('  ' + f));
  process.exit(1);
}
console.log(`PASS — ${checked} connectors leave and enter their blocks perpendicular, never along a border, through a block or on another connector's line (hub, Tier, ISO, ASHRAE, TIA, NFPA, lab · 1440/390).`);
