#!/usr/bin/env node
/**
 * test-pack-ui.mjs — P04 project pack in a real browser: the printed numbers are the calculators' own numbers.
 *
 *  U1 the project popover offers "Project pack"; calculators with results (and this page) start ticked, the rest say "not run"
 *  U2 Build computes in this (visible) tab, then offers Print and Open: the opened pack has cover meta (project + revision,
 *     site version), assumptions register, one section per chosen calculator, basis notes; Print prints a hidden frame of the
 *     same document exactly once
 *  U3 every numeral in the CAPEX section equals what the live CAPEX page SHOWS (innerText): same numbers, and a value the
 *     page masks behind sign-in (it shows "—") is not printed either
 *  U4 charts travel as images (a canvas on the page becomes an <img> in the pack)
 *  U5 register: project fields read "project"; ROI's Total CAPEX reads "from CAPEX Calculator" at capex_total / 1e6
 *  U6 a calculator never run for the project is computed and the section says it had not been run
 *  U7 the hidden copies write nothing: the stored projects are byte-identical before and after
 *  U8 a calculator that cannot load gets a "Section not available" section; the others still print; the status line counts it
 *  U9 a blocked new tab says how to allow it and points at Print
 *  U10 Cancel during a build offers nothing to print
 *  U11 390 px: the pack view fits (no horizontal scroll), the note field is >= 16 px (no iOS zoom)
 *  U12 no page errors
 *
 * Run: node tools/test-pack-ui.mjs
 */
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const { default: puppeteer } = await import('puppeteer');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/js/rz-supabase.js') { res.writeHead(200, { 'content-type': 'text/javascript' }).end("const api={configured:false,error:null,async getUser(){return null},onChange(){}};window.rzSupa=api;window.rzSupa.ready=Promise.resolve(api);"); return; }
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const errs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let route = () => 'continue';
const open = async (url, width = 1280) => {
  const tab = await browser.newPage();
  await tab.setViewport({ width, height: 900 });
  // the site's service worker would answer page loads itself, out of reach of request interception (U8, U10)
  await tab.setBypassServiceWorker(true);
  await tab.setRequestInterception(true);
  tab.on('request', async (r) => {
    if (!r.url().startsWith(base)) return r.abort();
    const act = route(r.url());
    if (act === 'abort') return r.abort();
    if (typeof act === 'number') await sleep(act);
    r.continue().catch(() => {});
  });
  tab.on('pageerror', (e) => errs.push(url + ': ' + String(e.message || e)));
  await tab.evaluateOnNewDocument(() => {
    try { localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) {}
    // every frame (the pack's print frame included): count print() calls on the top window instead of opening a dialog
    window.print = function () { try { window.top.__prints = (window.top.__prints || 0) + 1; window.top.__printed = document.documentElement.outerHTML; } catch (e) {} };
  });
  await tab.goto(base + url, { waitUntil: 'load', timeout: 60000 });
  await tab.waitForSelector('.rz-proj-chip', { timeout: 20000 });
  return tab;
};
const stored = (tab) => tab.evaluate(() => localStorage.getItem('rz_projects_v1'));
const openPack = async (tab) => {
  for (let i = 0; i < 3 && !(await tab.$('.rz-proj-act[data-act="pack"]')); i++) {
    await tab.waitForFunction(() => { const c = document.querySelector('.rz-proj-chip'); return c && !c.disabled; }, { timeout: 15000 });
    if (await tab.$eval('.rz-proj-pop', (p) => p.hidden)) await tab.click('.rz-proj-chip');
    await tab.waitForSelector('.rz-proj-act[data-act="pack"]', { timeout: 5000 }).catch(() => {});
  }
  await tab.click('.rz-proj-act[data-act="pack"]');
  await tab.waitForSelector('.rz-pack-form', { timeout: 5000 });
};
const tick = (tab, calc, on) => tab.$eval('.rz-pack-form input[name="calc"][value="' + calc + '"]', (x, on) => { x.checked = on; }, on);
const build = async (tab) => {
  await tab.evaluate(() => { document.querySelector('.rz-pack-progress').textContent = ''; document.querySelector('#rzProjErr').textContent = ''; });
  await tab.click('.rz-pack-form .rz-proj-primary');
  await tab.waitForFunction(() => /Pack ready|could not be built|Cancelled/.test(document.querySelector('.rz-pack-progress').textContent + document.querySelector('#rzProjErr').textContent), { timeout: 120000 });
  if (!(await tab.$('[data-pack="open"]'))) return null;
  // "Open in a new tab" hands a blob: URL to window.open; the harness takes that URL and reads the document it holds.
  await tab.evaluate(() => { window.__opened = null; window.__realOpen = window.__realOpen || window.open; window.open = (u) => { window.__opened = u; return {}; }; });
  await tab.click('[data-pack="open"]');
  const html = await tab.evaluate(async () => { const u = window.__opened; window.open = window.__realOpen; return u ? (await fetch(u)).text() : null; });
  return html;
};
const readPack = (tab, html) => tab.evaluate((html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const t = (s) => { const e = doc.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ') : null; };
  const meta = {}; doc.querySelectorAll('.rzp-meta tr').forEach((r) => { meta[r.cells[0].textContent] = r.cells[1].textContent; });
  const reg = [...doc.querySelectorAll('#assumptions tbody tr')].map((r) => [...r.cells].map((c) => c.textContent));
  const capexBlocks = [...doc.querySelectorAll('#calc-capex .rzp-block')].map((b) => b.textContent.replace(/\s+/g, ' '));
  return { meta, reg, capexBlocks, capexImgs: doc.querySelectorAll('#calc-capex img').length, roi: t('#calc-roi'), opex: t('#calc-opex'), basis: t('#basis'),
    sections: [...doc.querySelectorAll('section.rzp-section')].map((x) => x.id) };
}, html);
const NUM = /\d[\d,]*(?:\.\d+)?/g;
const STRIP = 'button, input, select, textarea, script, style, .rz-sens, .rz-manual-link, [hidden], .tooltip-trigger, .tooltip-content, .tooltip-desc';

try {
  /* setup: one project, CAPEX run on its own page */
  const tab = await open('capex-calculator.html');
  await tab.evaluate(() => { localStorage.removeItem('rz_projects_v1'); RZProject.createStore(localStorage).create('Pack <gate>', { it_load_kw: 4000, pue_design: 1.35, country: 'ID', tier: 3 }); });
  await tab.reload({ waitUntil: 'load' });
  await tab.waitForSelector('.rz-proj-chip', { timeout: 20000 });
  await tab.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('rz_projects_v1') || '{}'); const p = s.projects && s.projects[s.active]; return p && p.results && p.results.capex; }, { timeout: 20000 });
  await sleep(1500);
  // What a reader SEES in the result block (innerText: no hidden or sign-in-masked values), controls set aside.
  const live = await tab.evaluate((STRIP) => {
    const el = document.querySelector('.simulator-results.tool-results');
    const off = [...el.querySelectorAll(STRIP)].filter((x) => x.style.display !== 'none');
    off.forEach((x) => { x.dataset.packPrev = x.style.display; x.style.display = 'none'; });
    const text = el.innerText.replace(/\s+/g, ' ');
    off.forEach((x) => { x.style.display = x.dataset.packPrev; delete x.dataset.packPrev; });
    return { text, canvases: [...el.querySelectorAll('canvas')].filter((c) => c.offsetWidth).length, masked: el.querySelectorAll('.cost-value-hidden').length };
  }, STRIP);
  const proj = await tab.evaluate(() => { const s = JSON.parse(localStorage.getItem('rz_projects_v1')); return s.projects[s.active]; });
  const capexTotal = proj.results.capex.capex_total.value;

  /* U1 */
  await openPack(tab);
  const list = await tab.$$eval('.rz-pack-form input[name="calc"]', (xs) => xs.map((x) => ({ c: x.value, on: x.checked, st: x.closest('label').querySelector('.rz-proj-sub').textContent })));
  ok(list.length === 6, 'U1 pack lists ' + list.length + ' calculators, expected 6');
  const cap = list.find((x) => x.c === 'capex'), roi = list.find((x) => x.c === 'roi');
  ok(cap && cap.on && cap.st === 'current', 'U1 capex not ticked/current: ' + JSON.stringify(cap));
  ok(roi && !roi.on && roi.st === 'not run', 'U1 roi should start unticked/not run: ' + JSON.stringify(roi));

  /* U2-U7 */
  await tick(tab, 'roi', true);
  const before = await stored(tab);
  const html1 = await build(tab);
  const status = await tab.$eval('.rz-pack-progress', (x) => x.textContent);
  ok(/^Pack ready · 2 calculators\. Print or save as PDF Open in a new tab$/.test(status.trim()), 'U2 status "' + status + '"');
  ok(!!html1, 'U2 Open handed no document to the new tab');
  const pack = await readPack(tab, html1 || '');
  if (process.env.PACK_SHOT) (await import('node:fs')).writeFileSync(process.env.PACK_SHOT, html1 || '');
  ok(JSON.stringify(pack.sections) === JSON.stringify(['assumptions', 'calc-capex', 'calc-roi', 'basis']), 'U2 sections ' + JSON.stringify(pack.sections));
  ok(pack.meta.Project === 'Pack <gate> · revision ' + proj.rev, 'U2 project meta "' + pack.meta.Project + '"');
  const ver = await tab.evaluate(() => window.RZ_VERSION);
  ok(pack.meta['Site version'] === ver, 'U2 site version "' + pack.meta['Site version'] + '" vs ' + ver);
  ok(pack.capexBlocks.length === 1, 'U3 capex blocks ' + pack.capexBlocks.length);
  const a = (pack.capexBlocks[0] || '').match(NUM) || [], b = live.text.match(NUM) || [];
  ok(a.length > 10 && JSON.stringify(a) === JSON.stringify(b), 'U3 capex numerals differ: pack ' + a.length + ' ' + JSON.stringify(a.slice(0, 12)) + ' vs page ' + b.length + ' ' + JSON.stringify(b.slice(0, 12)));
  ok(live.canvases === 0 || pack.capexImgs >= live.canvases, 'U4 capex canvases ' + live.canvases + ' -> imgs ' + pack.capexImgs);
  ok(live.masked > 0, 'U3 setup: no sign-in-masked value on the CAPEX page, so the masking check proves nothing');
  const regRow = (calcRow, label) => pack.reg.find((r) => r[1].indexOf(label) >= 0 && r[4] !== undefined);
  const itRow = pack.reg.find((r) => /it load/i.test(r[1]) && r[4] === 'project');
  ok(!!itRow, 'U5 no IT load row sourced "project": ' + JSON.stringify(pack.reg.slice(0, 6)));
  const capRow = pack.reg.find((r) => r[4] && r[4].indexOf('from CAPEX Calculator') === 0);
  // the same conversion the live ROI page applies: USD -> $M, then the field's own step (P01 toPage)
  const want = await tab.evaluate((v) => RZProject.toPage('totalCapex', v, { factor: 1e6 }, { min: '1', max: '5000', step: '1' }).value, capexTotal);
  ok(capRow && capRow[2] === want && /^Total CAPEX \(\$M\)$/.test(capRow[1].trim()), 'U5 ROI Total CAPEX row ' + JSON.stringify(capRow) + ' vs ' + want);
  ok(pack.roi && /had not been run for the project/.test(pack.roi), 'U6 roi not-run note missing');
  ok(pack.basis && /Full method: resistancezero\.com\/manual\/capex\.html/.test(pack.basis), 'U2 basis notes: ' + (pack.basis || '').slice(0, 160));
  ok((await stored(tab)) === before, 'U7 stored projects changed during the pack build');
  await tab.click('[data-pack="print"]');
  await tab.waitForFunction(() => window.__prints >= 1, { timeout: 15000 }).catch(() => {});
  await sleep(500);
  const pr = await tab.evaluate(() => ({ n: window.__prints || 0, reg: /id="assumptions"/.test(window.__printed || ''), capex: /id="calc-capex"/.test(window.__printed || '') }));
  ok(pr.n === 1 && pr.reg && pr.capex, 'U2 print frame: ' + JSON.stringify(pr));

  /* U8 */
  route = (u) => (/opex-calculator\.html\?embed=pack/.test(u) ? 'abort' : 'continue');
  await tick(tab, 'roi', false); await tick(tab, 'opex', true);
  const html2 = await build(tab);
  const s2 = await tab.$eval('.rz-pack-progress', (x) => x.textContent);
  const p2 = await readPack(tab, html2 || '');
  ok(/Section not available/.test(p2.opex || '') && p2.capexBlocks.length === 1, 'U8 failed section: ' + JSON.stringify({ opex: (p2.opex || '').slice(0, 160), capex: p2.capexBlocks.length }));
  ok(/1 could not be computed and says so/.test(s2), 'U8 status "' + s2 + '"');
  route = () => 'continue';

  /* U9 */
  await tab.evaluate(() => { window.__open = window.open; window.open = () => null; });
  await tab.click('[data-pack="open"]');
  await sleep(300);
  const e9 = await tab.$eval('#rzProjErr', (x) => x.textContent);
  ok(/blocked the new tab.*Print or save as PDF/.test(e9), 'U9 blocked message "' + e9 + '"');
  await tab.evaluate(() => { window.open = window.__open; });

  /* U10 */
  route = (u) => (/capex-calculator\.html\?embed=pack/.test(u) ? 4000 : 'continue');
  await tab.click('.rz-pack-form .rz-proj-primary');
  await sleep(500);
  await tab.click('.rz-pack-form .rz-proj-cancel');
  await tab.waitForFunction(() => /Cancelled/.test(document.querySelector('.rz-pack-progress').textContent), { timeout: 60000 });
  ok(!(await tab.$('[data-pack="print"]')), 'U10 a cancelled build still offers Print');
  route = () => 'continue';
  await tab.close();

  /* U11 */
  const ph = await open('roi-calculator.html', 390);
  await openPack(ph);
  const fit = await ph.evaluate(() => ({ sw: document.documentElement.scrollWidth, fs: parseFloat(getComputedStyle(document.querySelector('.rz-pack-form textarea')).fontSize),
    pop: document.querySelector('.rz-proj-pop').getBoundingClientRect().right }));
  ok(fit.sw <= 390 && fit.pop <= 390, 'U11 390 px overflow ' + JSON.stringify(fit));
  ok(fit.fs >= 16, 'U11 note field font ' + fit.fs);
  await ph.close();
} catch (e) {
  fails.push('harness: ' + (e && e.stack || e));
} finally {
  await browser.close();
  server.close();
}
ok(errs.length === 0, 'U12 page errors: ' + errs.join(' | '));
if (fails.length) { console.error('FAIL test-pack-ui — ' + fails.length + ' of ' + checks + ':\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('PASS test-pack-ui — ' + checks + ' checks: offer, print + open, numerals = live CAPEX, charts as images, register sources, not-run note, no writes, failed section, blocked pop-up, cancel, 390 px');
