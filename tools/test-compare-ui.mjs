#!/usr/bin/env node
/**
 * test-compare-ui.mjs — P03 compare, in a real browser (Pro test session so every result is visible).
 *  U1 capex: "Add to compare" stores the case (sessionStorage), a duplicate is refused, a changed input adds case 2
 *  U2 compare.html?calc=capex from the tray: both cases computed, iframes gone afterwards, case 1's CAPEX equals what the
 *     capex page itself shows for those inputs, the IT load row is the only differing input
 *  U3 A vs A (links=): every result delta reads 0
 *  U4 attribution: one input changed -> only the results that depend on it move
 *       capex fuelHours +24 h      -> total CAPEX moves, annual energy cost does not
 *       roi   discountRate +2 pt -> NPV moves, IRR does not
 *       tco   tcoColoEsc blank -> 6 %  -> colocation TCO moves, build and cloud do not
 *  U5 a case whose page cannot compute shows "Could not compute this case"; the other columns render
 *  U6 Set as baseline reorders and deltas are measured from the new first column; CSV export has a BOM and one row per result
 *  U7 rfs is refused with its reason; an unknown calc is refused; a link for another calculator is refused with a note
 *  U8 account.html: ticking scenarios of two calculators disables Compare with the reason; 2 of one calc -> compare URL
 *  U9 390 px: no page-level horizontal scroll (the table scrolls in its own box); no page errors
 * Run: node tools/test-compare-ui.mjs
 */
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const { default: puppeteer } = await import('puppeteer');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary' };
const SUPA = `const ROWS=[{id:'s-1',name:'Plant A',calc:'capex',created_at:'2026-11-10T08:00:00Z',payload:{inputs:{itLoad:{t:'number',v:'1500'}}}},
 {id:'s-2',name:'Plant B',calc:'capex',created_at:'2026-11-10T09:00:00Z',payload:{inputs:{itLoad:{t:'number',v:'3000'}}}},
 {id:'s-3',name:'Ops',calc:'opex',created_at:'2026-11-10T10:00:00Z',payload:{inputs:{itLoad:{t:'number',v:'900'}}}}];
const api={configured:true,error:null,async getUser(){return {id:'u-1',email:'gate@example.test',created_at:'2026-11-01T00:00:00Z'}},onChange(){},
 async getProfile(){return {data:{tier:'pro'}}},async listScenarios(c){return {data:ROWS.filter(r=>!c||r.calc===c),error:null}},
 async listAuditLog(){return {data:[],error:null}},async logEvent(){return {error:null}}};
window.rzSupa=api;window.rzSupa.ready=Promise.resolve(api);`;
let failEmbedAt = 0, embedSeen = 0;
const server = createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x'), path = decodeURIComponent(u.pathname);
    if (path === '/js/rz-supabase.js') { res.writeHead(200, { 'content-type': 'text/javascript' }).end(SUPA); return; }
    if (/[?&]embed=compare/.test(u.search) && ++embedSeen === failEmbedAt) { res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>x</title><p>engine failed to load</p>'); return; }
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const errs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(url, width = 1280) {
  const tab = await browser.newPage();
  await tab.setViewport({ width, height: 900 });
  await tab.setRequestInterception(true);
  tab.on('request', (r) => (r.url().startsWith(base) ? r.continue() : r.abort()));
  tab.on('pageerror', (e) => errs.push(url + ': ' + String(e.message || e)));
  // Test-browser state only: a Pro session so Pro-gated results are visible, and the cookie notice answered.
  await tab.evaluateOnNewDocument(() => {
    try { localStorage.setItem('rz_premium_session', JSON.stringify({ email: 'gate@example.test', tier: 'pro', expires: '2099-01-01' })); localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) {}
  });
  await tab.goto(base + url, { waitUntil: 'load', timeout: 60000 });
  return tab;
}
const done = (tab) => tab.waitForFunction(() => /computed|could not be computed|cannot be compared|Unknown calculator|Add at least/.test(document.getElementById('cmpStatus').textContent + (document.getElementById('cmpEmpty').hidden ? '' : 'Add at least')), { timeout: 90000 });
const cell = (tab, key, i) => tab.evaluate((key, i) => { const tds = [...document.querySelectorAll('#cmpTable td[data-key="' + key + '"]')]; const td = tds[i]; return td ? { v: td.querySelector('.rz-cmp-v').textContent, d: (td.querySelector('.rz-cmp-d') || {}).textContent || '' } : null; }, key, i);
async function inputsOf(page, changes) {
  const tab = await open(page);
  await sleep(1500);
  const a = await tab.evaluate(() => window.rzScenario.capture());
  const b = JSON.parse(JSON.stringify(a));
  for (const id of Object.keys(changes)) if (!a[id]) throw new Error(page + ': ' + id + ' not captured; have ' + Object.keys(a).join(','));
  for (const [id, f] of Object.entries(changes)) b[id] = { t: b[id].t, v: String(f(parseFloat(a[id].v))) };
  const r = await tab.evaluate((a, b) => {
    const pre = window.rzScenario.LINK.prefix, calc = document.body.getAttribute('data-rz-calc');
    return { a: window.rzScenario.encodeLink(calc, a).slice(pre.length), b: window.rzScenario.encodeLink(calc, b).slice(pre.length) };
  }, a, b);
  await tab.close();
  return r;
}

try {
  /* U1 */
  let tab = await open('capex-calculator.html');
  await sleep(1200);
  ok(!!(await tab.$('#btnAddCompare')), 'U1 no Add to compare button on capex');
  await tab.click('#btnAddCompare'); await sleep(150);
  await tab.click('#btnAddCompare'); await sleep(150);
  ok(/already in compare/.test(await tab.$eval('.rz-cmp-msg', (e) => e.textContent)), 'U1 a duplicate case was not refused');
  await tab.$eval('#itLoad', (e) => { e.value = ''; e.focus(); });
  await tab.type('#itLoad', '2500');
  await sleep(900);
  const pageCapex = await tab.$eval('#totalCost', (e) => e.textContent.trim());
  await tab.click('#btnAddCompare'); await sleep(150);
  const tray = await tab.evaluate(() => JSON.parse(sessionStorage.getItem('rz_compare_capex') || '[]'));
  ok(tray.length === 2 && tray[1].inputs.itLoad.v === '2500', 'U1 tray should hold 2 cases, the second at 2500 kW');
  ok(/2 of 4 cases in compare/.test(await tab.$eval('.rz-cmp-msg', (e) => e.textContent)), 'U1 message should count 2 of 4');

  /* U2 — same tab, so the sessionStorage tray carries */
  const t0 = Date.now();
  await tab.goto(base + 'compare.html?calc=capex', { waitUntil: 'load' });
  await done(tab);
  const secs = (Date.now() - t0) / 1000;
  ok(/All 2 cases computed/.test(await tab.$eval('#cmpStatus', (e) => e.textContent)), 'U2 status: ' + await tab.$eval('#cmpStatus', (e) => e.textContent));
  ok((await tab.$$eval('iframe', (f) => f.length)) === 0, 'U2 iframes left behind after compute');
  const c2 = await cell(tab, 'capex_total', 1);
  ok(c2 && c2.v === pageCapex, `U2 compare CAPEX for case 2 ${c2 && c2.v} != the capex page's own ${pageCapex}`);
  const diffRows = await tab.$$eval('#cmpTable tbody tr:not(.rz-cmp-group) th[scope=row]', (t) => t.map((x) => x.textContent));
  ok(diffRows.some((r) => /IT Load \(kW\)/.test(r)) && !diffRows.some((r) => /Fuel/i.test(r)), 'U2 differing inputs should be IT load only: ' + diffRows.slice(0, 4).join(' | '));
  ok(/\+/.test((await cell(tab, 'capex_total', 1)).d), 'U2 a bigger IT load should show a positive CAPEX delta');
  console.log(`  (2 capex cases computed in ${secs.toFixed(1)} s)`);

  /* U6 */
  await tab.click('#cmpTable button[data-act="base"][data-i="1"]');
  await sleep(100);
  const after = await cell(tab, 'capex_total', 1);
  ok(/−/.test(after.d), 'U6 after Set as baseline the old baseline should read a negative delta: ' + after.d);
  // Bytes, not Blob.text(): a UTF-8 decode strips the BOM this check is about.
  const csv = await tab.evaluate(() => new Promise((res) => {
    const orig = URL.createObjectURL; URL.createObjectURL = (b) => { b.arrayBuffer().then((buf) => res(String.fromCharCode(...new Uint8Array(buf).slice(0, 3)) + new TextDecoder('utf-8', { ignoreBOM: true }).decode(buf).slice(1))); return orig.call(URL, b); };
    document.getElementById('cmpCsv').click();
  }));
  ok(csv.startsWith('\u00ef\u00bb\u00bf') && (csv.match(/\r\nResult,/g) || []).length === 2, 'U6 CSV needs a BOM and one row per capex result');
  await tab.close();

  /* U3 + U4 */
  for (const [calc, page, ch, moves, still] of [
    ['capex', 'capex-calculator.html', { fuelHours: (v) => v + 24 }, ['capex_total'], ['energy_cost_annual']],
    ['roi', 'roi-calculator.html', { discountRate: (v) => v + 2 }, ['npv'], ['irr']],
    ['tco', 'tco-calculator.html', { tcoColoEsc: () => 6 }, ['tco_colo'], ['tco_build', 'tco_cloud']],
  ]) {
    const L = await inputsOf(page, ch);
    tab = await open(`compare.html?calc=${calc}&links=${L.a},${L.a},${L.b}`);
    await done(tab);
    const keys = await tab.$$eval('#cmpTable td[data-key]', (t) => [...new Set(t.map((x) => x.getAttribute('data-key')))]);
    for (const k of keys) { const c = await cell(tab, k, 1); ok(c && c.d === '0', `U3 ${calc} A vs A: ${k} delta "${c && c.d}" should be 0`); }
    for (const k of moves) { const c = await cell(tab, k, 2); ok(c && c.d && c.d !== '0', `U4 ${calc}: ${k} should move when ${Object.keys(ch)[0]} changes (delta "${c && c.d}", value ${c && c.v})`); }
    for (const k of still) { const c = await cell(tab, k, 2); ok(c && c.d === '0', `U4 ${calc}: ${k} should not move when ${Object.keys(ch)[0]} changes (delta "${c && c.d}")`); }
    await tab.close();
  }

  /* U5 — the second case's frame gets a page without the engine */
  const L = await inputsOf('pue-calculator.html', { itLoad: (v) => v + 100 });
  embedSeen = 0; failEmbedAt = 2;
  tab = await open(`compare.html?calc=pue&links=${L.a},${L.b}`);
  await done(tab);
  failEmbedAt = 0;
  const fail = await tab.$$eval('#cmpTable td.rz-cmp-fail', (t) => t.length);
  const okCells = await tab.$$eval('#cmpTable td[data-key] .rz-cmp-v', (t) => t.filter((x) => x.textContent && x.textContent !== '—').length);
  ok(fail >= 1 && okCells >= 1, `U5 one failed column and the other rendered: fail=${fail} ok=${okCells}`);
  ok(/1 of 2 cases could not be computed/.test(await tab.$eval('#cmpStatus', (e) => e.textContent)), 'U5 status should count the failed case');
  await tab.close();

  /* U7 */
  tab = await open('compare.html?calc=rfs'); await done(tab);
  ok(/cannot be compared: the page saves its own state/.test(await tab.$eval('#cmpStatus', (e) => e.textContent)), 'U7 rfs not refused with its reason');
  await tab.close();
  tab = await open('compare.html?calc=nope'); await done(tab);
  ok(/Unknown calculator/.test(await tab.$eval('#cmpStatus', (e) => e.textContent)), 'U7 unknown calc not refused');
  await tab.close();
  const other = await inputsOf('opex-calculator.html', {});
  tab = await open(`compare.html?calc=capex&links=${other.a},${other.a}`); await done(tab);
  ok(/another calculator/.test(await tab.$eval('#cmpNotes', (e) => e.textContent)), 'U7 a link for another calculator should be noted');
  ok(!(await tab.$eval('#cmpEmpty', (e) => e.hidden)), 'U7 with no usable case the empty state shows');
  await tab.close();

  /* U8 */
  tab = await open('account.html');
  await tab.waitForSelector('input[data-cmp]', { timeout: 15000 });
  await tab.click('input[data-cmp="s-1"]'); await tab.click('input[data-cmp="s-3"]');
  ok(await tab.$eval('#scnCompare', (b) => b.disabled) && /one calculator/.test(await tab.$eval('#scnCmpMsg', (e) => e.textContent)), 'U8 mixed calculators must disable Compare with the reason');
  await tab.click('input[data-cmp="s-3"]'); await tab.click('input[data-cmp="s-2"]');
  ok(!(await tab.$eval('#scnCompare', (b) => b.disabled)), 'U8 two capex scenarios should enable Compare');
  await Promise.all([tab.waitForNavigation({ waitUntil: 'load' }), tab.click('#scnCompare')]);
  ok(/compare\.html\?calc=capex&ids=s-2,s-1|compare\.html\?calc=capex&ids=s-1,s-2/.test(tab.url()), 'U8 compare URL: ' + tab.url());
  await done(tab);
  ok((await tab.$$eval('#cmpTable thead th.rz-cmp-case', (t) => t.length)) === 2, 'U8 the two saved scenarios should load as cases');
  await tab.close();

  /* U9 */
  const L9 = await inputsOf('tco-calculator.html', { tcoColoEsc: () => 6 });
  tab = await open(`compare.html?calc=tco&links=${L9.a},${L9.b},${L9.a}`, 390);
  await done(tab);
  const m = await tab.evaluate(() => { window.scrollTo(500, 0); return { sx: window.scrollX, inner: document.querySelector('.rz-cmp-scroll').scrollWidth > document.querySelector('.rz-cmp-scroll').clientWidth }; });
  ok(m.sx === 0, `U9 page scrolls sideways ${m.sx}px at 390`);
  ok(m.inner, 'U9 the table should scroll inside its own box at 390');
  await tab.close();
} finally {
  await browser.close();
  server.close();
}
ok(errs.length === 0, 'U9 page errors: ' + errs.slice(0, 4).join(' | '));
if (fails.length) { console.log(`FAIL test-compare-ui — ${fails.length} of ${checks}`); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log(`PASS test-compare-ui — ${checks} checks: add/dedupe, tray -> recomputed table equal to the page, A vs A zero, attribution on capex/roi/tco, failed column, baseline swap + CSV, refusals, account multi-select, 390 px`);
