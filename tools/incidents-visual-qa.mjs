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
    const inCascade = t.closest && t.closest('.viz-cascade');
    if ((s.endsWith('…') || s.endsWith('...')) && !inCascade) out.truncatedLabels.push(s);
    // a lone 1-2 char label that is not a pure axis number is suspicious
    if (s.length && s.length <= 2 && !/^\d+$/.test(s)) out.tinyLabels.push(s);
  });
  out.hOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
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
  const bad = c.truncatedLabels.length || c.tinyLabels.length || c.hOverflow;
  if (bad) problems++;
  console.log(`\n[${prefix}] ${file}`);
  console.log('  shots: ' + shots.join(' · '));
  console.log('  truncated SVG labels: ' + (c.truncatedLabels.join(', ') || 'none'));
  console.log('  suspicious 1-2char labels: ' + (c.tinyLabels.join(', ') || 'none'));
  console.log('  horizontal overflow: ' + (c.hOverflow ? 'YES ⚠' : 'no'));
  await page.close();
}

await run('dc-incidents.html', 'hub', [
  ['kpis', '.iid-kpis'], ['donut', '.iid-donut'], ['geomap', '#incMap'],
  ['graph', '.iid-graph'], ['signatures', '.iid-sigs'], ['faq', 'details.faq'],
], { width: 1400, height: 900, deviceScaleFactor: 1.3 });

for (const slug of SAMPLE) {
  await run(`incident-${slug}.html`, slug, [
    ['cascade', '.viz-cascade'], ['radar', '.viz-radar'], ['timeline', '.viz-timeline'],
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
