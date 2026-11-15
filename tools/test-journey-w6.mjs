#!/usr/bin/env node
/**
 * test-journey-w6.mjs — W6-1: one reader's journey through the P-series features, in ONE browser context, in order.
 * Each step is gated on its own elsewhere; this gate proves the hand-overs between them hold in a single session.
 *  J1 capex: create a project from the chip (Journey DC, 4000 kW, PUE 1.35); it is stored and capex_total is published
 *  J2 roi: Total CAPEX is consumed from that result (USD -> $M) and tagged "from CAPEX Calculator"
 *  J3 capex: two cases into compare (project case, then 2500 kW); compare.html computes both; case 1 CAPEX equals the
 *     capex page's own figure for the project inputs
 *  J4 pack from the roi page: capex + roi sections, cover names the project; the store is unchanged by building it
 *  J5 the roi share link opened in a FRESH context gives the same inputs and results (and does not need the project)
 *  J6 offline reopen in the first context: server refuses connections + DevTools offline; roi reloads from the service
 *     worker, still names the project and still computes when an input changes
 *  J7 no page errors in any step
 * Run: node tools/test-journey-w6.mjs
 */
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const { default: puppeteer } = await import('puppeteer');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml', '.glb': 'model/gltf-binary' };
let offline = false;
const server = createServer(async (req, res) => {
  if (offline) { req.socket.destroy(); return; }
  try {
    const u = new URL(req.url, 'http://x'), path = decodeURIComponent(u.pathname);
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' }).end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
server.keepAliveTimeout = 1;
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-audio-output'] });
const errs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function page(ctx, url) {
  const tab = await ctx.newPage();
  await tab.setViewport({ width: 1280, height: 900 });
  tab.on('pageerror', (e) => errs.push(url.split('#')[0] + ': ' + String(e.message || e)));
  tab.on('dialog', (d) => d.dismiss().catch(() => {}));
  await tab.evaluateOnNewDocument(() => {
    try { localStorage.setItem('rz_cookie_consent', 'declined'); localStorage.setItem('rz_premium_session', JSON.stringify({ email: 'gate@example.test', tier: 'pro', expires: '2099-01-01' })); } catch (e) {}
    window.print = function () { try { window.top.__prints = (window.top.__prints || 0) + 1; } catch (e) {} };
  });
  await tab.goto(base + url, { waitUntil: 'load', timeout: 60000 });
  return tab;
}
const store = (tab) => tab.evaluate(() => localStorage.getItem('rz_projects_v1'));
const active = (tab) => tab.evaluate(() => { const s = JSON.parse(localStorage.getItem('rz_projects_v1') || 'null'); return s && s.projects[s.active]; });
const tagOf = (tab, id) => tab.evaluate((id) => { const t = document.querySelector('.rz-proj-tag[data-for="' + id + '"]'); return t ? t.textContent : null; }, id);

const ctx = await browser.createBrowserContext();
try {
  /* J1 */
  let tab = await page(ctx, 'capex-calculator.html');
  await tab.waitForSelector('.rz-proj-chip', { timeout: 20000 });
  await tab.click('.rz-proj-chip');
  await tab.waitForSelector('.rz-proj-form', { timeout: 5000 });
  await tab.type('.rz-proj-form [name=name]', 'Journey DC');
  await tab.$eval('.rz-proj-form [name=it_load_kw]', (e) => { e.value = ''; }); await tab.type('.rz-proj-form [name=it_load_kw]', '4000');
  await tab.$eval('.rz-proj-form [name=pue_design]', (e) => { e.value = ''; }); await tab.type('.rz-proj-form [name=pue_design]', '1.35');
  await tab.click('.rz-proj-form .rz-proj-primary');
  await tab.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('rz_projects_v1') || 'null'); const p = s && s.projects[s.active]; return p && p.results && p.results.capex; }, { timeout: 20000 }).catch(() => {});
  const p1 = await active(tab);
  const capexTotal = p1 && p1.results && p1.results.capex && p1.results.capex.capex_total && p1.results.capex.capex_total.value;
  ok(!!p1 && p1.name === 'Journey DC' && p1.inputs.it_load_kw === 4000, 'J1 project not stored with its inputs: ' + JSON.stringify(p1 && p1.inputs));
  ok(capexTotal > 1e6, 'J1 capex_total not published: ' + capexTotal);
  await sleep(800);
  const pageCapex = await tab.$eval('#totalCost', (e) => e.textContent.trim());

  /* J2 */
  const capexTab = tab;
  tab = await page(ctx, 'roi-calculator.html');
  await tab.waitForSelector('.rz-proj-chip', { timeout: 20000 }); await sleep(1200);
  const roiCapex = parseFloat(await tab.$eval('#totalCapex', (e) => e.value));
  ok(Math.abs(roiCapex - Math.round(capexTotal / 1e6)) <= 1, `J2 roi Total CAPEX ${roiCapex} != ${capexTotal}/1e6`);
  ok(/from CAPEX Calculator/.test((await tagOf(tab, 'totalCapex')) || ''), 'J2 consumed value not tagged from CAPEX');

  /* J3 (on the capex tab: the compare tray is per tab, sessionStorage) */
  { const roiTab = tab; tab = capexTab; await tab.bringToFront();
  await tab.keyboard.press('Escape').catch(() => {});
  await tab.$eval('#btnAddCompare', (b) => b.click()); await sleep(200);
  await tab.$eval('#itLoad', (e) => { e.value = ''; e.focus(); }); await tab.type('#itLoad', '2500'); await sleep(900);
  await tab.$eval('#btnAddCompare', (b) => b.click()); await sleep(200);
  const tray = await tab.evaluate(() => JSON.parse(sessionStorage.getItem('rz_compare_capex') || '[]'));
  ok(tray.length === 2 && tray[0].inputs.itLoad.v === '4000' && tray[1].inputs.itLoad.v === '2500', 'J3 tray: ' + JSON.stringify(tray.map((c) => c.inputs.itLoad)));
  await tab.goto(base + 'compare.html?calc=capex', { waitUntil: 'load' });
  await tab.waitForFunction(() => /computed|could not be computed/.test(document.getElementById('cmpStatus').textContent), { timeout: 120000 }).catch(() => {});
  ok(/All 2 cases computed/.test(await tab.$eval('#cmpStatus', (e) => e.textContent)), 'J3 compare status: ' + await tab.$eval('#cmpStatus', (e) => e.textContent));
  const case1 = await tab.evaluate(() => { const td = document.querySelectorAll('#cmpTable td[data-key="capex_total"]')[0]; const v = td && td.querySelector('.rz-cmp-v'); return v ? v.textContent.trim() : null; });
  ok(case1 === pageCapex, `J3 compare case 1 CAPEX ${case1} != capex page ${pageCapex}`);
  await tab.close(); tab = roiTab; await tab.bringToFront(); }

  /* J4 */
  const before = await store(tab);
  if (await tab.$eval('.rz-proj-pop', (p) => p.hidden)) await tab.click('.rz-proj-chip');
  await tab.waitForSelector('.rz-proj-act[data-act="pack"]', { timeout: 8000 });
  await tab.click('.rz-proj-act[data-act="pack"]');
  await tab.waitForSelector('.rz-pack-form', { timeout: 5000 });
  await tab.$$eval('.rz-pack-form input[name="calc"]', (xs) => xs.forEach((x) => { x.checked = x.value === 'capex' || x.value === 'roi'; }));
  await tab.click('.rz-pack-form .rz-proj-primary');
  await tab.waitForFunction(() => /Pack ready|could not be built/.test(document.querySelector('.rz-pack-progress').textContent + document.querySelector('#rzProjErr').textContent), { timeout: 120000 }).catch(() => {});
  let pack = null;
  if (await tab.$('[data-pack="open"]')) {
    await tab.evaluate(() => { window.__opened = null; window.__realOpen = window.open; window.open = (u) => { window.__opened = u; return {}; }; });
    await tab.click('[data-pack="open"]');
    pack = await tab.evaluate(async () => { const u = window.__opened; window.open = window.__realOpen; if (!u) return null;
      const doc = new DOMParser().parseFromString(await (await fetch(u)).text(), 'text/html');
      return { sections: [...doc.querySelectorAll('section.rzp-section')].map((x) => x.id), cover: (doc.querySelector('.rzp-meta') || {}).textContent || '' }; });
  }
  ok(!!pack && pack.sections.includes('calc-capex') && pack.sections.includes('calc-roi'), 'J4 pack sections: ' + JSON.stringify(pack && pack.sections));
  ok(!!pack && /Journey DC/.test(pack.cover), 'J4 pack cover does not name the project');
  ok((await store(tab)) === before, 'J4 building the pack changed the project store');
  await tab.keyboard.press('Escape').catch(() => {});

  /* J5 */
  const shared = await tab.evaluate(() => { const l = window.rzScenario.shareLink(); return { l, cap: window.rzScenario.capture() }; });
  const wantRes = await tab.evaluate(() => ['#primaryValue', '#metIRR'].map((q) => { const e = document.querySelector(q); return e ? e.textContent.trim() : null; }));
  ok(shared.l && shared.l.ok, 'J5 share link not built: ' + JSON.stringify(shared.l));
  if (shared.l && shared.l.ok) {
    const ctx2 = await browser.createBrowserContext();
    const t2 = await page(ctx2, shared.l.url.replace(/^https?:\/\/[^/]+\//, ''));
    await sleep(1200);
    const got = await t2.evaluate(() => window.rzScenario.capture());
    const gotRes = await t2.evaluate(() => ['#primaryValue', '#metIRR'].map((q) => { const e = document.querySelector(q); return e ? e.textContent.trim() : null; }));
    const diff = Object.keys(shared.cap).filter((k) => JSON.stringify(shared.cap[k]) !== JSON.stringify(got[k]));
    ok(diff.length === 0, 'J5 inputs differ in the fresh context: ' + diff.slice(0, 5).join(','));
    ok(wantRes.length > 0 && JSON.stringify(wantRes) === JSON.stringify(gotRes), `J5 results ${JSON.stringify(wantRes)} vs ${JSON.stringify(gotRes)}`);
    await ctx2.close();
  }

  /* J6 */
  const swReady = await tab.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 15000))]));
  ok(swReady, 'J6 no service worker became ready');
  await tab.reload({ waitUntil: 'load' }); await sleep(1500);
  ok(await tab.evaluate(() => !!navigator.serviceWorker.controller), 'J6 roi not controlled by the service worker');
  offline = true; await tab.setOfflineMode(true);
  await tab.reload({ waitUntil: 'load', timeout: 60000 }); await sleep(1500);
  ok(!/^Offline/.test(await tab.title()), 'J6 offline reload served the offline page');
  ok(/Journey DC/.test(await tab.$eval('.rz-proj-chip', (e) => e.textContent).catch(() => '')), 'J6 offline page does not name the project');
  const r0 = await tab.evaluate(() => (document.querySelector('#primaryValue') || {}).textContent);
  await tab.evaluate(() => { const e = document.getElementById('electricityRate') || document.querySelector('input[type=number]'); e.value = String(parseFloat(e.value) * 1.5); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(1200);
  const r1 = await tab.evaluate(() => (document.querySelector('#primaryValue') || {}).textContent);
  ok(!!r0 && r0 !== r1, `J6 offline roi did not recompute (${r0} -> ${r1})`);
  offline = false;
} finally {
  await ctx.close().catch(() => {});
  await browser.close(); server.close();
}
ok(errs.length === 0, 'J7 page errors: ' + errs.slice(0, 5).join(' | '));
if (fails.length) { console.error(`FAIL test-journey-w6 — ${fails.length} of ${checks} checks failed:\n  ✗ ` + fails.join('\n  ✗ ')); process.exit(1); }
console.log(`PASS test-journey-w6 — ${checks} checks: project → capex → roi → compare → pack → share link → offline reopen in one session`);
