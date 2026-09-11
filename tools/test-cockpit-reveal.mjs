#!/usr/bin/env node
/**
 * A view reached by a click inside a drawing is still a view.
 *
 * WHAT WENT WRONG
 *
 * `tools/lib/cockpit-tabs.mjs` exists because datahallAI.html's default tab holds no SVG, so the
 * legibility and geometry gates were measuring an empty panel and reporting clean. That file fixed
 * the tabs. It did not fix the views that are not on a tab at all.
 *
 * `#floorSvg` lives inside `#floorDetail`, which is `display:none` until the reader clicks a floor
 * in the building isometric. It has been listed in TAB_SETS for months and measured every run as a
 * 0x0 box holding 0 labels — a clean row that meant "never opened". Opened, it carries **191 of 222
 * labels under the 8.5 px floor, the smallest at 4.0 px**: the worst single view on the page, hidden
 * behind the one thing the harness could not do.
 *
 * Two failures produced that, and this test pins both:
 *
 *   1. A DRILL-DOWN NEEDS A DECLARED WAY IN. `reveal: { click, expect }` says how the view is
 *      reached, and activateTab performs it. Rule 1 of cockpit-tabs.mjs applies unchanged — ASSERT,
 *      NEVER ATTEMPT. A trigger selector that matches nothing, or a container that stays
 *      `display:none` after the click, throws. If it merely returned, the gate would go back to
 *      measuring the closed state and reporting the same clean zero.
 *
 *   2. THE DEDUPE KEY HAS TO KNOW. audit-legibility keyed visited views on `tab/sub`, so #floorSvg
 *      collapsed into the same `over/` key as #bldgSvg and was skipped before the reveal could even
 *      run. A revealed view earns its own key.
 *
 * Usage: node tools/test-cockpit-reveal.mjs
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import puppeteer from 'puppeteer';
import { readFileSync, existsSync } from 'node:fs';
import { extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TAB_SETS, activateTab } from './lib/cockpit-tabs.mjs';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FLOOR_PX = 8.5;                       /* tools/audit-legibility.mjs MIN_PX */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  const path = resolve(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  if (!path.startsWith(ROOT) || !existsSync(path)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});
await new Promise((accept) => server.listen(0, accept));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
try {
  const set = TAB_SETS['datahallAI.html'];
  const floors = set.diagrams.filter((d) => d.selector === '#floorSvg');
  assert.equal(floors.length, 4, 'the building has four floor views and each is its own drill-down');
  const floor = floors[0];
  assert.ok(floor.reveal && floor.reveal.click && floor.reveal.expect,
    '#floorSvg is hidden behind a click in the isometric — it must declare reveal:{click,expect}');

  /* The dedupe that skipped it. Keyed on tab/sub alone, #bldgSvg and #floorSvg are one view. */
  const plain = (e) => `${e.tab}/${e.sub || ''}`;
  const keyed = (e) => `${e.tab}/${e.sub || ''}/${e.reveal ? e.reveal.click : ''}`;
  const bldg = set.diagrams.find((d) => d.selector === '#bldgSvg');
  assert.equal(plain(bldg), plain(floor), 'the two share a tab — that is why the old key collided');
  assert.notEqual(keyed(bldg), keyed(floor), 'a revealed view must not collide with its parent tab');
  const gate = readFileSync(resolve(ROOT, 'tools/audit-legibility.mjs'), 'utf8');
  assert.equal(new Set(floors.map(keyed)).size, 4,
    'the four floors share #floorSvg, so the key has to separate them by how each is reached');
  assert.match(gate, /entry\.reveal \? entry\.reveal\.click : ''/,
    'audit-legibility must key visited views so a revealed one is not skipped');

  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 1050 });
  await primeCockpitAuditDocument(page, 'dark');
  await page.goto(`${base}/datahallAI.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await enterAuthorizedAuditState(page, set.cockpit);

  /* GREEN — the declared reveal opens the drill-down, and what it opens is legible. */
  await activateTab(page, set, floor);
  const shown = await page.evaluate(() => {
    const svg = document.getElementById('floorSvg');
    let min = Infinity, under = 0, total = 0;
    for (const node of svg.querySelectorAll('text')) {
      if (!(node.textContent || '').trim()) continue;
      const h = node.getBoundingClientRect().height;
      if (h <= 0) continue;
      total += 1;
      if (h < min) min = h;
      if (h < 8.5) under += 1;
    }
    return { display: getComputedStyle(document.getElementById('floorDetail')).display,
             total, under, min: Number(min.toFixed(2)),
             scale: svg.getAttribute('data-rz-legible-scale') };
  });
  assert.equal(shown.display, 'block', 'the reveal must actually open #floorDetail');
  assert.ok(shown.total > 100, `the opened floor plan should carry its labels, saw ${shown.total}`);
  assert.equal(shown.under, 0, `${shown.under} of ${shown.total} floor-plan labels are under ${FLOOR_PX}px`);
  assert.ok(shown.min >= FLOOR_PX, `smallest floor-plan label is ${shown.min}px`);
  assert.ok(Number(shown.scale) > 1, 'the drill-down must be registered with RZSvgLegible');

  /* RED — a reveal that cannot be performed must throw. Both halves, because both were possible
     ways to go on silently measuring a closed panel. */
  await assert.rejects(
    () => activateTab(page, set, { ...floor, reveal: { click: '#bldgSvg [data-floor-nope]', expect: '#floorDetail' } }),
    /no reveal trigger/, 'a reveal whose trigger matches nothing must throw');
  await assert.rejects(
    () => activateTab(page, set, { ...floor, reveal: { click: '#bldgSvg [data-floor]', expect: '#rzNoSuchPanel' } }),
    /no reveal target/, 'a reveal whose target does not exist must throw');

  /* THE MOBILE CLAMP. datahallAI.html's responsive patch carries
     `svg { max-width: 100% !important }` so a wide drawing cannot push the PAGE sideways on a
     phone. That rule also beat the inline width RZSvgLegible sets, so under 768 px every
     registered diagram quietly rendered at 1:1 — the floor plan asked for 4.2x, drew at 1.0x, and
     printed a note claiming the scale it had asked for. The page has an exception now, and the
     exception has to keep holding BOTH halves: the drawing widens, and the page still does not
     scroll, because the overflow belongs to the pane. */
  for (const width of [390, 768]) {
    const small = await browser.newPage();
    await small.setViewport({ width, height: 850 });
    await primeCockpitAuditDocument(small, 'dark');
    await small.goto(`${base}/datahallAI.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await enterAuthorizedAuditState(small, set.cockpit);
    await activateTab(small, set, set.diagrams.find((d) => d.selector === '#hSvg'));
    const m = await small.evaluate(() => {
      const svg = document.querySelector('#hSvg');
      const pane = svg.parentElement;
      return { svgW: Math.round(svg.getBoundingClientRect().width),
               paneW: pane.clientWidth,
               paneOverflowX: getComputedStyle(pane).overflowX,
               asked: Number(svg.getAttribute('data-rz-legible-scale')),
               pageScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    await small.close();
    assert.ok(m.asked > 1, `at ${width}px the hall diagram should still ask for a scale`);
    assert.ok(m.svgW > m.paneW * 1.2,
      `at ${width}px the hall diagram asked for ${m.asked}x but rendered ${m.svgW}px in a ${m.paneW}px pane `
      + '— the mobile max-width clamp is beating the scaler again');
    assert.equal(m.paneOverflowX, 'auto', 'the widened drawing must sit in a scrolling pane');
    assert.ok(m.pageScroll <= 2,
      `at ${width}px the PAGE scrolls ${m.pageScroll}px — the pane must own the overflow, not the document`);
  }

  console.log('── COCKPIT REVEAL ──');
  console.log(`floor plan opens via ${floor.reveal.click} -> ${floor.reveal.expect}; `
    + `${shown.total} labels, smallest ${shown.min}px at ${shown.scale}x, none under ${FLOOR_PX}px`);
  console.log('PASS — the drill-down is reached, is measured, and a reveal that cannot be performed throws.');
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}
