#!/usr/bin/env node
/**
 * audit-slop-render.mjs — every sitemap page, rendered, scanned for the structural slop tells.
 *
 * Owner 2026-11-07: "kamu kan sudah audit semua page saya via robot agar nggak ada yang terlewat, ini kenapa masih
 * ada yang ai design slop sekali" (glossary.html: rails, pills, hover slide, blur, aurora). The earlier sweeps
 * recoloured pages and the structural gates covered only the journal and calculator families, so a page could be
 * on-palette and still carry every structural tell. This scan reads COMPUTED style on every page in sitemap.xml:
 *
 *   rail    coloured left/right stripe: one side border >= 2 px, the others <= 1 px, saturated colour, box >= 40 px tall
 *   pill    rounded chip: radius >= 12 px on a box < 44 px tall that has a fill or border (badge/tag/pill)
 *   round   rounded panel: radius > 8 px on a filled box >= 200 px wide
 *   blur    backdrop-filter other than none
 *   lift    a :hover rule that sets a transform (from the page's own stylesheets)
 *   grad    a gradient background on a box >= 120 x 40 (charts/canvas/img excluded)
 *
 *   node tools/audit-slop-render.mjs [--pages a.html,b.html] [--json out.json]
 * Env RZ_BASE (default http://127.0.0.1:8164). Report only (exit 0) until a baseline is recorded; run under the
 * shared browser lock.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.RZ_BASE || 'http://127.0.0.1:8164';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
let puppeteer;
try { puppeteer = createRequire(resolve(ROOT, 'package.json'))('puppeteer'); }
catch { puppeteer = createRequire('/home/baguspermana7/wt-journal/package.json')('puppeteer'); }

const pages = arg('--pages') ? arg('--pages').split(',')
  : [...readFileSync(resolve(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>https:\/\/resistancezero\.com\/([^<]*)<\/loc>/g)]
    .map((m) => m[1] || 'index.html').map((p) => (p.endsWith('/') ? p + 'index.html' : p));

function scan() {
  const sat = (c) => { const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); if (!m) return 0;
    if (m[4] !== undefined && +m[4] < 0.25) return 0;
    const [r, g, b] = [m[1], m[2], m[3]].map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx === 0 ? 0 : (mx - mn) / mx; };
  const out = { rail: [], pill: [], round: [], blur: [], lift: [], grad: [] };
  const name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '');
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect(); if (r.width < 8 || r.height < 8) continue;
    const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden') continue;
    const bl = parseFloat(c.borderLeftWidth), br = parseFloat(c.borderRightWidth), bt = parseFloat(c.borderTopWidth), bb = parseFloat(c.borderBottomWidth);
    const side = bl >= 2 && bt <= 1 && bb <= 1 && br <= 1 ? c.borderLeftColor : br >= 2 && bt <= 1 && bb <= 1 && bl <= 1 ? c.borderRightColor : null;
    if (side && sat(side) > 0.25 && r.height >= 40 && c.borderLeftStyle !== 'none') out.rail.push(name(e));
    const rad = parseFloat(c.borderTopLeftRadius) || 0;
    const filled = !/rgba\(0, 0, 0, 0\)|transparent/.test(c.backgroundColor) || bt >= 1;
    if (rad >= 12 && r.height < 44 && filled && e.tagName !== 'INPUT' && !/toggle|switch|avatar|dot|knob|thumb/i.test(e.className)) out.pill.push(name(e));
    if (rad > 8 && r.width >= 200 && !/rgba\(0, 0, 0, 0\)|transparent/.test(c.backgroundColor)) out.round.push(name(e));
    if (c.backdropFilter && c.backdropFilter !== 'none') out.blur.push(name(e));
    if (/gradient/.test(c.backgroundImage) && r.width >= 120 && r.height >= 40 && !e.closest('canvas,svg,figure,[data-rz-chart],.chart,.legend')) out.grad.push(name(e));
  }
  for (const sh of document.styleSheets) {
    let rules; try { rules = sh.cssRules; } catch { continue; }
    const walk = (rs) => { for (const ru of rs) { if (ru.cssRules && !ru.selectorText) { walk(ru.cssRules); continue; }
      if (ru.selectorText && /:hover/.test(ru.selectorText) && ru.style && ru.style.transform && ru.style.transform !== 'none'
        && !/scale\(1\)|translate(?:X|Y)?\(0(?:px)?\)/.test(ru.style.transform)) {
        const sel = ru.selectorText.replace(/:hover/g, ''); try { if (document.querySelector(sel)) out.lift.push(ru.selectorText.slice(0, 50)); } catch {} } } };
    walk(rules);
  }
  const uniq = (a) => { const m = {}; for (const x of a) m[x] = (m[x] || 0) + 1; return Object.entries(m).sort((p, q) => q[1] - p[1]); };
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { n: v.length, top: uniq(v).slice(0, 4) }]));
}

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'] });
const report = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE}/robots.txt`);
  await page.evaluate(() => { localStorage.setItem('rz_cookie_consent', 'declined'); localStorage.setItem('theme', 'dark'); });
  for (const p of pages) {
    try {
      await page.goto(`${BASE}/${p}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await new Promise((r) => setTimeout(r, 900));
      const r = await page.evaluate(scan);
      const score = Object.values(r).reduce((s, v) => s + v.n, 0);
      report.push({ page: p, score, ...r });
    } catch (err) { report.push({ page: p, error: String(err.message).slice(0, 80) }); }
  }
} finally { await browser.close(); }
report.sort((a, b) => (b.score || 0) - (a.score || 0));
const keys = ['rail', 'pill', 'round', 'blur', 'lift', 'grad'];
console.log('page'.padEnd(52) + keys.map((k) => k.padStart(6)).join(''));
for (const r of report) {
  if (r.error) { console.log(r.page.padEnd(52) + '  ERROR ' + r.error); continue; }
  if (!r.score) continue;
  console.log(r.page.slice(0, 51).padEnd(52) + keys.map((k) => String(r[k].n).padStart(6)).join(''));
}
const clean = report.filter((r) => r.score === 0).length;
console.log(`\n${report.length} pages scanned · ${clean} clean · ${report.length - clean} with at least one tell`);
if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify(report, null, 1));
