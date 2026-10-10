#!/usr/bin/env node
/*
 * incidents-visual-qa.mjs — the mandatory visual-QA gate for the DC-incidents module
 * (DC_INCIDENTS_QA_STANDARD §4). Renders the hub + a sample of incident pages headless
 * (root-unblurred), screenshots each visualization region to a directory, and prints a
 * checklist for §3B (no truncation / collision / corrupt / slop). Text/CSS review misses
 * rendered bugs; this is how they get caught before ship.
 *
 * Usage: node tools/incidents-visual-qa.mjs [outDir] [slug ...]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = process.argv[2] || path.join(ROOT, '_visual-qa');
const SAMPLE = process.argv.slice(3);
if (!SAMPLE.length) {
  // a fire, a logical/software, an attack, a physical-cable, a facility-power — cover the range
  SAMPLE.push(
    'ovhcloud-sbg2-fire-2021', 'crowdstrike-falcon-global-outage-2024',
    'dyn-mirai-ddos-2016', 'red-sea-subsea-cables-2024', 'delta-atlanta-switchgear-2016',
  );
}
fs.mkdirSync(OUT, { recursive: true });

const UNGATE = () => {
  document.body.classList.remove('locked');
  const s = document.createElement('style');
  s.textContent = '.wrap{filter:none!important;pointer-events:auto!important}.root-gate,[class*=rz-modal],[class*=cookie]{display:none!important}';
  document.head.appendChild(s);
  document.querySelectorAll('.root-gate,.rz-modal-overlay').forEach((e) => e.remove());
};

async function shotRegions(page, prefix, regions) {
  const results = [];
  for (const [name, sel] of regions) {
    const el = await page.$(sel);
    if (!el) { results.push(`${name}: MISSING (${sel})`); continue; }
    try {
      await el.scrollIntoViewIfNeeded?.();
      await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel);
      await new Promise((r) => setTimeout(r, 400));
      await el.screenshot({ path: path.join(OUT, `${prefix}-${name}.png`) });
      results.push(`${name}: ok`);
    } catch (e) { results.push(`${name}: ERR ${e.message}`); }
  }
  return results;
}

// heuristic checks in-page: truncated SVG text (endsWith … or 1-2 char labels), overflow
const CHECKS = () => {
  const out = { truncatedLabels: [], tinyLabels: [], hOverflow: false };
  document.querySelectorAll('svg text').forEach((t) => {
    const s = (t.textContent || '').trim();
    // cascade downstream boxes legitimately wrap + ellipsis and carry a full-text <title>;
    // the corruption class we hunt is clipped radar/scatter/axis labels, not those.
    // SOE timeline time labels are cut to 11 characters on purpose: the full time is in
    // the dot's <title> and in the SOE list printed directly below the strip.
    const inCascade = t.closest && t.closest('.viz-cascade, .viz-timeline');
    if ((s.endsWith('…') || s.endsWith('...')) && !inCascade) out.truncatedLabels.push(s);
    // a lone 1-2 char label that is not a pure axis number is suspicious
    // Exempt BY NAME, with the reason: "X" is the operator's actual name (X Corp, the
    // x-twitter-oregon-fire-2025 dossier), not a label cut down to one character.
    const REAL_SHORT_NAMES = new Set(['X']);
    // A timeline time label wraps at word boundaries (_two_lines), so a short second
    // line ("ET" after "~07:10–07:30") is a whole word of the source, never a cut.
    const wrappedWord = t.closest && t.closest('.viz-timeline');
    if (s.length && s.length <= 2 && !/^\d+$/.test(s) && !REAL_SHORT_NAMES.has(s) && !wrappedWord) out.tinyLabels.push(s);
  });
  out.hOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  // FMEA criticality matrix: a label may not overlap another label or another
  // marker. Co-located modes share one marker, and labels sit above or below it,
  // but 43 incidents produce 43 different scatters and the placement rule is only
  // as good as the worst one it meets.
  out.fmeaCollisions = [];
  const m = document.querySelector('.fm-matrix');
  if (m) {
    const boxes = [...m.querySelectorAll('.fm-pt-l')].map((e) => ({ k: 'label ' + e.textContent, r: e.getBoundingClientRect() }));
    const dots = [...m.querySelectorAll('.fm-pt')].map((e, i) => ({ k: 'marker ' + i, r: e.getBoundingClientRect() }));
    const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) if (hit(boxes[i].r, boxes[j].r)) out.fmeaCollisions.push(`${boxes[i].k} × ${boxes[j].k}`);
      // A label's own marker is the circle drawn immediately before it (matrix_svg
      // emits circle, text, circle, text...). Ownership is identity, NOT position:
      // the first version exempted any marker sharing the label's x, so a label
      // stacked exactly on a NEIGHBOUR's marker passed as its own.
      dots.forEach((d, j) => { if (j !== i && hit(boxes[i].r, d.r)) out.fmeaCollisions.push(`${boxes[i].k} × ${d.k}`); });
    }
  }
  // SOE timeline: no two labels in the strip may overprint. One 16-character time
  // label ran ~96px into a 92px step and printed "…00:47 PD2011-04-21" on every page.
  out.timelineCollisions = [];
  const tl = document.querySelector('.viz-timeline svg');
  if (tl) {
    const ts = [...tl.querySelectorAll('text')].map((e) => ({ k: e.textContent, r: e.getBoundingClientRect() }));
    const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) if (hit(ts[i].r, ts[j].r)) out.timelineCollisions.push(`"${ts[i].k}" × "${ts[j].k}"`);
    // ...and none may run past the SVG's own edge, where it is cut ("ept-Oct 2016").
    const box = tl.getBoundingClientRect();
    ts.forEach((t) => { if (t.r.left < box.left - 1 || t.r.right > box.right + 1) out.timelineCollisions.push(`"${t.k}" cut at the SVG edge`); });
  }
  return out;
};

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
let problems = 0;
async function run(file, prefix, regions, vp) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  await page.goto('file://' + path.join(ROOT, file), { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(UNGATE);
  await new Promise((r) => setTimeout(r, 700));
  const shots = await shotRegions(page, prefix, regions);
  const c = await page.evaluate(CHECKS);
  const bad = c.truncatedLabels.length || c.tinyLabels.length || c.hOverflow || c.fmeaCollisions.length || c.timelineCollisions.length;
  if (bad) problems++;
  console.log(`\n[${prefix}] ${file}`);
  console.log('  shots: ' + shots.join(' · '));
  console.log('  truncated SVG labels: ' + (c.truncatedLabels.join(', ') || 'none'));
  console.log('  suspicious 1-2char labels: ' + (c.tinyLabels.join(', ') || 'none'));
  console.log('  horizontal overflow: ' + (c.hOverflow ? 'YES ⚠' : 'no'));
  console.log('  FMEA matrix label collisions: ' + (c.fmeaCollisions.join(', ') || 'none'));
  console.log('  SOE timeline label collisions: ' + (c.timelineCollisions.slice(0, 3).join(', ') || 'none'));
  await page.close();
}

await run('dc-incidents.html', 'hub', [
  ['kpis', '.iid-kpis'], ['donut', '.iid-donut'], ['geomap', '#incMap'],
  ['graph', '.iid-graph'], ['signatures', '.iid-sigs'], ['faq', 'details.faq'],
], { width: 1400, height: 900, deviceScaleFactor: 1.3 });

for (const slug of SAMPLE) {
  await run(`incident-${slug}.html`, slug, [
    ['cascade', '.viz-cascade'], ['radar', '.viz-radar'], ['timeline', '.viz-timeline'],
    ['fmea-bars', '.fm-pb'], ['fmea-matrix', '.fm-matrix'], ['fmea-sheet', '.fm-sheet'],
    ['share', '.share-buttons'],
  ], { width: 1100, height: 900, deviceScaleFactor: 1.4 });
}

// also a 360px overflow check on the hub + one incident
for (const f of ['dc-incidents.html', `incident-${SAMPLE[0]}.html`]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 800 });
  await page.goto('file://' + path.join(ROOT, f), { waitUntil: 'domcontentloaded' });
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  const ok = o.sw <= o.cw + 1;
  if (!ok) problems++;
  console.log(`\n[360px] ${f}: ${ok ? 'OK' : 'OVERFLOW ' + o.sw}`);
  await page.close();
}

await browser.close();
console.log(`\nVisual-QA screenshots → ${OUT}`);
console.log(problems ? `\n⚠ ${problems} page(s) flagged heuristics — inspect the screenshots.` : '\n✓ Heuristics clean. Inspect screenshots to confirm §3B (slop/legibility).');
process.exit(problems ? 1 : 0);
