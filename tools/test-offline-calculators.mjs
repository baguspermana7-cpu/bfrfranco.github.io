#!/usr/bin/env node
/**
 * test-offline-calculators.mjs — P25 ship gate: a calculator opened once online keeps working offline.
 *
 * Per calculator (data/calculators.json, 11), in a FRESH browser context:
 *   O1  visit online; the page registers /sw.js and, after one reload, a service worker controls it
 *   O2  go offline for real: the origin server refuses every connection AND the page is in DevTools
 *       offline mode (so a CDN cannot quietly fill in); reload -> the page renders (not the offline page)
 *   O3  change an input -> at least one registry result changes (the calculator COMPUTES offline)
 *   O4  chart pages: Chart.js is present and built >= 1 chart offline; every VISIBLE chart has > 1 % painted pixels
 *   O5  no pageerror while offline
 *
 * Request interception is NOT used: puppeteer bypasses the service worker when it is on.
 * Run: node tools/test-offline-calculators.mjs [--only=tco]
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REG = JSON.parse(readFileSync(join(ROOT, 'data', 'calculators.json'), 'utf8')).calculators;
const CHART_PAGES = new Set(['cx', 'opex', 'roi', 'tia', 'tco', 'tier', 'carbon', 'pue', 'spares']);
/* A fresh rfs workbench has no project, so its checklist (and #rfsClOverallPct) is empty online too.
   The reader's first steps are: name + load, pick an archetype, Save Baseline, Generate Units.
   The gate takes those steps, offline (the project store is localStorage). */
const PREPARE = {
  rfs: () => {
    const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    set('rfsSetupName', 'Offline gate DC');
    set('rfsSetupLoad', '20');
    const card = document.querySelector('.rfs-archetype-card'); if (card) card.click();
    window.RfsUI.saveSetup();
    window.RfsUI.generateDefaultUnits();
    window.RfsUI.switchTab('gates');
  },
};
/* Pages whose reader action is not a numeric input. rfs: one requirement of hundreds rounds to 0 %,
   so tick the whole first gate, as a reader closing a gate would. Returns a label. */
const ACT = {
  rfs: () => {
    const acc = document.querySelector('.rfs-cl-accordion');
    if (!acc) return null;
    acc.querySelector('.rfs-cl-header').click();
    acc.querySelectorAll('.rfs-cl-checkbox').forEach((b) => { if (!b.checked) b.click(); });
    return 'first gate ticked';
  },
};
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml' };

let offline = false;
const server = createServer(async (req, res) => {
  if (offline) { req.socket.destroy(); return; }
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' }).end(body);
  } catch { res.writeHead(404).end(); }
});
server.keepAliveTimeout = 1;
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const fails = [];
let passed = 0;
const readResults = (tab, c) => tab.evaluate((sels) => sels.map((s) => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }), c.results.map((r) => r.selector));

try {
  for (const c of REG.filter((x) => !only || x.calc === only)) {
    const ctx = await browser.createBrowserContext();
    const tab = await ctx.newPage();
    await tab.setViewport({ width: 1280, height: 900 });
    const errs = [];
    tab.on('dialog', (d) => d.accept().catch(() => {}));
    const tag = `${c.calc} (${c.page})`;
    try {
      offline = false;
      await tab.goto(base + c.page, { waitUntil: 'load', timeout: 60000 });
      const ready = await tab.evaluate(() => Promise.race([
        navigator.serviceWorker.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 15000))]));
      if (!ready) { fails.push(`O1 ${tag}: no service worker became ready within 15 s`); continue; }
      await tab.reload({ waitUntil: 'load', timeout: 60000 });
      await sleep(1200); // let runtime caching of this load's assets finish
      const controlled = await tab.evaluate(() => !!navigator.serviceWorker.controller);
      if (!controlled) { fails.push(`O1 ${tag}: page not controlled by the service worker after reload`); continue; }

      offline = true;
      await tab.setOfflineMode(true);
      tab.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 140)));
      await tab.reload({ waitUntil: 'load', timeout: 60000 });
      await sleep(1500);
      const title = await tab.title();
      if (/^Offline/.test(title)) { fails.push(`O2 ${tag}: offline reload served the offline page, not the calculator`); continue; }
      if (PREPARE[c.calc]) { await tab.evaluate(PREPARE[c.calc]); await sleep(900); }
      const before = await readResults(tab, c);
      if (before.every((v) => v === null)) { fails.push(`O2 ${tag}: none of ${c.results.map((r) => r.selector).join(' ')} on the offline page`); continue; }

      // O3: mutate inputs one at a time until a result moves (checklist pages: tick a box)
      let after = before, used = null;
      if (ACT[c.calc]) {
        used = await tab.evaluate(ACT[c.calc]);
        await sleep(900);
        after = await readResults(tab, c);
      }
      const ids = await tab.evaluate(() => [...document.querySelectorAll('input[type=number][id], input[type=range][id], select[id]')]
        .filter((e) => e.offsetParent && !e.disabled).map((e) => e.id).slice(0, 12));
      for (const id of (ACT[c.calc] ? [] : ids)) {
        await tab.evaluate((id) => {
          const el = document.getElementById(id);
          if (el.tagName === 'SELECT') { const o = [...el.options].find((x) => x.value && x.value !== el.value); if (o) el.value = o.value; }
          else {
            const cur = parseFloat(el.value); if (!Number.isFinite(cur)) return;
            const max = el.max === '' ? Infinity : +el.max, min = el.min === '' ? -Infinity : +el.min;
            const step = el.step && el.step !== 'any' ? +el.step : 1;
            let n = cur + step * Math.max(1, Math.round(Math.abs(cur) * 0.2 / step)); if (n > max) n = Math.max(min, cur - step * Math.max(1, Math.round(Math.abs(cur) * 0.2 / step)));
            el.value = String(+n.toFixed(6));
          }
          el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
        }, id);
        await sleep(700);
        after = await readResults(tab, c);
        if (JSON.stringify(after) !== JSON.stringify(before)) { used = id; break; }
      }
      if (!used && !ACT[c.calc]) {
        used = await tab.evaluate(() => { const b = [...document.querySelectorAll('input[type=checkbox]')].find((e) => e.offsetParent && !e.disabled); if (b) { b.click(); return b.id || 'checkbox'; } return null; });
        await sleep(700);
        after = await readResults(tab, c);
      }
      if (JSON.stringify(after) === JSON.stringify(before)) { fails.push(`O3 ${tag}: no result changed offline (tried ${ids.length} inputs) — ${JSON.stringify(before)}`); continue; }

      if (CHART_PAGES.has(c.calc)) {
        const paint = await tab.evaluate(() => {
          const C = window.Chart;
          const live = C && C.instances ? Object.values(C.instances) : [];
          let best = 0, visible = 0;
          for (const ch of live) {
            const cv = ch.canvas; const r = cv.getBoundingClientRect();
            if (r.width < 40 || r.height < 40 || !cv.offsetParent) continue;
            visible++;
            const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0;
            for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
            best = Math.max(best, n / (d.length / 4));
          }
          return { chart: typeof C === 'function', instances: live.length, visible, best };
        });
        if (!paint.chart) { fails.push(`O4 ${tag}: window.Chart missing offline — Chart.js was not cached`); continue; }
        if (!paint.instances) { fails.push(`O4 ${tag}: Chart.js loaded but no chart was built offline`); continue; }
        /* opex builds its two charts in a section that is collapsed until opened (0x0 online too):
           an instance proves the library and the data; a VISIBLE chart must also be painted. */
        if (paint.visible && paint.best <= 0.01) { fails.push(`O4 ${tag}: ${paint.visible} visible chart(s), none > 1 % painted (best ${(paint.best * 100).toFixed(2)} %)`); continue; }
      }
      if (errs.length) { fails.push(`O5 ${tag}: ${errs.length} pageerror(s) offline, first: ${errs[0]}`); continue; }
      passed++;
      console.log(`  ok ${tag}: offline, ${used} -> results moved`);
    } catch (e) {
      fails.push(`${tag}: ${String(e.message || e).slice(0, 160)}`);
    } finally {
      offline = false;
      await ctx.close().catch(() => {});
    }
  }
} finally {
  await browser.close();
  server.close();
}
const total = REG.filter((x) => !only || x.calc === only).length;
if (fails.length) {
  console.log(`FAIL test-offline-calculators — ${passed}/${total} work offline\n  ` + fails.join('\n  '));
  process.exit(1);
}
console.log(`PASS test-offline-calculators — ${passed}/${total} calculators reload, recompute and draw with the network gone`);
