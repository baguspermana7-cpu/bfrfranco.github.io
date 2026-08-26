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
import { resolveRenderCandidate } from './lib/dark-coverage-verdict.mjs';

const STRICT = process.argv.includes('--strict');
const ROOT = process.cwd();
// content pages only; skip internal/mockup/redirect/sitemap surfaces
const SKIP = /^(rz-|plan-|planb|google|404|sitemap|robots|llms)/;
const pages = readdirSync(ROOT).filter(f => f.endsWith('.html') && !SKIP.test(f)).sort();

// 1) Static: the :root,[data-theme=light] cascade bug + light-palette presence
const cascadeBug = [];
const hasLightPalette = {};
for (const f of pages) {
  const src = readFileSync(resolve(ROOT, f), 'utf8');
  if (/:root\s*,\s*\[data-theme="light"\]|\[data-theme="light"\]\s*,\s*:root/.test(src)) cascadeBug.push(f);
  // a page that defines any light-mode palette rule is expected to actually switch to light;
  // a page with none is dark-only by design (instrument cockpits, dark trophy pages) -> skip light check.
  hasLightPalette[f] = /\[data-theme="light"\]|:root:not\(\[data-theme="dark"\]\)/.test(src);
}

// 2) Render BOTH modes: dark must be dark (no white body/content), light must be light (not stuck dark)
const LAUNCH_ARGS = { args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] };
let browser = await puppeteer.launch(LAUNCH_ARGS);
// the Chromium process occasionally dies mid-run under resource pressure
// (ConnectionClosedError on newPage) — relaunch instead of aborting the audit
async function newPageSafe() {
  try { return await browser.newPage(); }
  catch (e) {
    try { await browser.close(); } catch (e2) {}
    browser = await puppeteer.launch(LAUNCH_ARGS);
    return browser.newPage();
  }
}
const renderBroken = [];
const lightStuck = [];
const renderErrors = [];
const bodyLum = async (pg) => pg.evaluate(() => { const m = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g); return m ? Math.round(0.299*+m[0] + 0.587*+m[1] + 0.114*+m[2]) : -1; });
const cleanResult = () => ({ darkFailure: null, lightFailure: null, renderError: null });
const errorResult = (f, error) => ({
  ...cleanResult(),
  renderError: `${f}  render-error=${error && error.name ? error.name : 'UnknownError'}`
});
const hasFinding = result => Boolean(result.darkFailure || result.lightFailure || result.renderError);
async function applyThemeAndSettle(pg, theme, transitionMs) {
  await pg.evaluate(async nextTheme => {
    try { localStorage.setItem('theme', nextTheme); } catch (e) {}
    document.documentElement.setAttribute('data-theme', nextTheme);
    void getComputedStyle(document.body).backgroundColor;
    await new Promise(resolveFrame => {
      const fallback = setTimeout(resolveFrame, 1000);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        clearTimeout(fallback);
        resolveFrame();
      }));
    });
  }, theme);
  await new Promise(resolveTransition => setTimeout(resolveTransition, transitionMs));
}

async function auditRenderedThemes(pg, f) {
    await pg.goto('file://' + resolve(ROOT, f), { waitUntil: 'domcontentloaded', timeout: 30000 });
    // --- DARK ---
    // write localStorage too — pages that re-apply theme from storage on window.load
    // (e.g. index.html rainbow-mode init) would otherwise undo a bare attribute flip
    await applyThemeAndSettle(pg, 'dark', 700); // force style recalc, render two frames, then settle past the 300–350 ms transitions
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
    const darkFailure = res.bbgLum > 195 || res.maxLight > 60000
      ? `${f}  body-lum=${res.bbgLum}  light-block=${res.cls}(${res.maxLight}px²)`
      : null;
    // --- LIGHT --- (only for pages that declare a light palette; dark-only pages are skipped)
    let lightFailure = null;
    if (hasLightPalette[f]) {
      await applyThemeAndSettle(pg, 'light', 500);
      const ll = await bodyLum(pg);
      if (ll >= 0 && ll < 90) lightFailure = `${f}  body-lum=${ll} (stuck dark in light mode)`;
    }
    return { darkFailure, lightFailure, renderError: null };
}

const initialFindings = new Map();
for (const f of pages) {
  let pg;
  let result;
  try {
    pg = await newPageSafe();
    result = await auditRenderedThemes(pg, f);
  } catch (e) {
    result = errorResult(f, e);
  } finally {
    if (pg) try { await pg.close(); } catch (e) { /* browser may already be closed */ }
  }
  if (hasFinding(result)) initialFindings.set(f, result);
}
try { await browser.close(); } catch (e) {}

// A long full-site sweep can exhaust Chromium renderer resources and briefly
// return the browser default white canvas (or a stale pre-transition frame).
// An initial candidate clears only after two independent, normal-timing passes;
// each pass gets its own Chromium process. Any reproduced finding or render
// exception remains blocking.
for (const [f, initialResult] of initialFindings) {
  const confirmations = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let confirmationBrowser;
    let pg;
    try {
      confirmationBrowser = await puppeteer.launch(LAUNCH_ARGS);
      pg = await confirmationBrowser.newPage();
      confirmations.push(await auditRenderedThemes(pg, f));
    } catch (e) {
      confirmations.push(errorResult(f, e));
    } finally {
      if (pg) try { await pg.close(); } catch (e) { /* browser may already be closed */ }
      if (confirmationBrowser) try { await confirmationBrowser.close(); } catch (e) { /* already closed */ }
    }
  }
  const verdict = resolveRenderCandidate(f, initialResult, confirmations);
  if (verdict.darkFailure) renderBroken.push(verdict.darkFailure);
  if (verdict.lightFailure) lightStuck.push(verdict.lightFailure);
  if (verdict.renderError) renderErrors.push(verdict.renderError);
}

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
if (lightStuck.length) {
  failed = true;
  console.log(`\n✗ STUCK-DARK-IN-LIGHT — page declares a light palette but body stays dark in light mode (add [data-theme="light"] body):`);
  lightStuck.forEach(f => console.log('   ' + f));
}
if (renderErrors.length) {
  failed = true;
  console.log(`\n✗ RENDER ERROR — a page could not complete the required theme audit:`);
  renderErrors.forEach(f => console.log('   ' + f));
}
if (!failed) {
  const confirmationNote = initialFindings.size ? ` ${initialFindings.size} sweep candidate(s) cleared by two fresh-process confirmations.` : '';
  console.log(`\nDARK-COVERAGE AUDIT — CLEAN (both modes). ${pages.length} content pages: dark renders dark (no white body/content), light renders light.${confirmationNote}`);
} else {
  console.log(`\nDARK-COVERAGE AUDIT — ${cascadeBug.length} cascade-bug + ${renderBroken.length} white-in-dark + ${lightStuck.length} stuck-dark-in-light + ${renderErrors.length} render-error, of ${pages.length} pages.`);
  console.log('Fix: every content page must define a dark palette ([data-theme="dark"]{ --bg/--text/... }) AND switch cleanly in both modes, or be dark-only (no light palette), and pass this audit.');
}
process.exit(STRICT && failed ? 1 : 0);
