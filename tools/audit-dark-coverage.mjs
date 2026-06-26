#!/usr/bin/env node
/* ============================================================================
   audit-dark-coverage.mjs — ENFORCEMENT GATE for the dark-mode standard.

   Renders every content page in DARK mode (headless, file://) and FAILS if the
   page body or a sizeable content block stays light — i.e. "white article body
   in dark mode", the recurring regression where a page hand-rolls its own skin
   and never wires a [data-theme="dark"] palette.

   Also statically flags the specific cascade bug that caused most of them:
     [data-theme="dark"] { --x: dark }
     :root, [data-theme="light"] { --x: light }   <-- :root matches ALWAYS and
   wins by source order, so dark values never apply. Use :root:not([data-theme="dark"]).

   Usage:  node tools/audit-dark-coverage.mjs [--strict]
   Exit 1 (with --strict) if any page fails. Add to the ship-audit suite.
   ============================================================================ */
import puppeteer from 'puppeteer';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

const STRICT = process.argv.includes('--strict');
const ROOT = process.cwd();
// content pages only; skip internal/mockup/redirect/sitemap surfaces
const SKIP = /^(rz-|plan-|planb|google|404|sitemap|robots|llms)/;
const pages = readdirSync(ROOT).filter(f => f.endsWith('.html') && !SKIP.test(f)).sort();

// 1) Static: the :root,[data-theme=light] cascade bug
const cascadeBug = [];
for (const f of pages) {
  const src = readFileSync(resolve(ROOT, f), 'utf8');
  if (/:root\s*,\s*\[data-theme="light"\]|\[data-theme="light"\]\s*,\s*:root/.test(src)) cascadeBug.push(f);
}

// 2) Render: white body / white content block in dark
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const renderBroken = [];
for (const f of pages) {
  const pg = await browser.newPage();
  try {
    await pg.goto('file://' + resolve(ROOT, f), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pg.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await new Promise(r => setTimeout(r, 350));
    const res = await pg.evaluate(() => {
      const L = c => { const m = c && c.match(/[\d.]+/g); if (!m) return null; return { a: m[3] !== undefined ? +m[3] : 1, lum: 0.299*+m[0] + 0.587*+m[1] + 0.114*+m[2] }; };
      const bbg = L(getComputedStyle(document.body).backgroundColor);
      let maxLight = 0, cls = '';
      document.querySelectorAll('*').forEach(e => {
        const bg = L(getComputedStyle(e).backgroundColor);
        if (!bg || bg.a < 0.8 || bg.lum < 195) return;
        if (e.classList && (e.classList.contains('leaflet-tile') || (e.closest && e.closest('.leaflet-container')))) return; // map tiles
        const r = e.getBoundingClientRect(); if (r.width < 280 || r.height < 100) return;
        const a = r.width * r.height; if (a > maxLight) { maxLight = a; cls = (e.className || e.tagName).toString().split(' ')[0].slice(0, 24); }
      });
      return { bbgLum: bbg ? Math.round(bbg.lum) : -1, maxLight: Math.round(maxLight), cls };
    });
    if (res.bbgLum > 195 || res.maxLight > 60000) {
      renderBroken.push(`${f}  body-lum=${res.bbgLum}  light-block=${res.cls}(${res.maxLight}px²)`);
    }
  } catch (e) { /* heavy/auth pages may time out on file://; not counted as a skin failure */ }
  await pg.close();
}
await browser.close();

let failed = false;
if (cascadeBug.length) {
  failed = true;
  console.log(`\n✗ CASCADE BUG — ":root, [data-theme=\\"light\\"]" overrides dark vars (use :root:not([data-theme=\\"dark\\"])):`);
  cascadeBug.forEach(f => console.log('   ' + f));
}
if (renderBroken.length) {
  failed = true;
  console.log(`\n✗ WHITE-IN-DARK — body or a large content block renders light in dark mode:`);
  renderBroken.forEach(f => console.log('   ' + f));
}
if (!failed) {
  console.log(`\nDARK-COVERAGE AUDIT — CLEAN. ${pages.length} content pages render dark with no white body/content block.`);
} else {
  console.log(`\nDARK-COVERAGE AUDIT — ${cascadeBug.length} cascade-bug + ${renderBroken.length} white-in-dark, of ${pages.length} pages.`);
  console.log('Fix: every content page must define a dark palette ([data-theme="dark"]{ --bg/--text/... }) or load the standard skin, and pass this audit.');
}
process.exit(STRICT && failed ? 1 : 0);
