#!/usr/bin/env node
/**
 * test-asof.mjs — P26A: every dated source carries a date and a refresh interval; pages show the date and flag old data.
 *
 *  A1 every RZEngine.data.sources key resolves to a sourceRefresh entry (longest prefix); months is a positive integer or
 *     null with a stated reason (>= 15 chars); no entry is unused
 *  A2 every asOf parses (YYYY, YYYY-MM, YYYY-MM-DD, YYYY-Qn) except declared constants (months null); none is later than today
 *  A3 fixed clock (PRD acceptance): markets 2026-07 refresh 6 -> at 2027-02 "older than 6 months", at 2026-12 fresh;
 *     a year stamp counts from December; a quarter from its last month; an unparseable stamp reads "date not recorded"
 *  A4 the minified engine the pages load carries the same table (stale twin = old code live)
 *  A5 browser, dc-market-tracker: the data line reads the engine's markets date; with the clock pinned past the refresh
 *     interval it reads "older than 6 months" in the warning colour
 *  A6 browser, tco: a metro shows the markets date, "country:XX" the countries date, a metro the engine does not carry
 *     "date not recorded"
 *  A7 no page errors
 *
 * Run: node tools/test-asof.mjs
 */
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const fails = [];
let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const A = require('../js/rz-asof.js');
globalThis.window = globalThis;
require('../rz-engine.js');
const D = globalThis.RZEngine.data;

/* A1 */
const keys = Object.keys(D.sources), table = D.sourceRefresh || {};
const used = new Set();
for (const k of keys) {
  const p = A.policyFor(k, table);
  ok(!!p, `A1 source "${k}" has no sourceRefresh entry`);
  if (!p) continue;
  used.add(p.prefix);
  ok(p.months === null || (Number.isInteger(p.months) && p.months > 0), `A1 "${p.prefix}" months ${p.months}`);
  ok(typeof p.reason === 'string' && p.reason.length >= 15, `A1 "${p.prefix}" reason too short`);
}
for (const p of Object.keys(table)) ok(used.has(p), `A1 sourceRefresh "${p}" matches no source`);
/* A2 */
const today = new Date(), ty = today.getFullYear(), tm = today.getMonth() + 1;
for (const k of keys) {
  const p = A.parse(D.sources[k].asOf), pol = A.policyFor(k, table);
  ok(!!p || (pol && pol.months === null), `A2 "${k}" asOf "${D.sources[k].asOf}" does not parse and is not a declared constant`);
  // the latest month a stamp allows may be in the future for a current-year stamp; the stamp's first month may not
  if (p) { const first = /^\d{4}$/.test(String(D.sources[k].asOf)) ? p.y * 12 + 1 : /-Q/.test(String(D.sources[k].asOf)) ? p.y * 12 + p.m - 2 : p.y * 12 + p.m;
    ok(first <= ty * 12 + tm, `A2 "${k}" asOf ${D.sources[k].asOf} is later than today`); }
}
/* A3 */
const T = { markets: { months: 6, reason: 'x'.repeat(20) } };
const S = { markets: { short: 'CBRE', asOf: '2026-07' }, y: { asOf: '2025' }, q: { asOf: '2026-Q1' }, bad: { asOf: 'soon' } };
const s1 = A.status('markets', S, T, new Date(2027, 1, 1));
ok(s1.stale && s1.text === 'as of Jul 2026 · older than 6 months' && /older than 6 months/.test(s1.title), 'A3 2027-02: ' + JSON.stringify(s1));
const s2 = A.status('markets', S, T, new Date(2026, 11, 1));
ok(!s2.stale && s2.text === 'as of Jul 2026' && s2.title === 'Source: CBRE, as of Jul 2026, refresh every 6 months', 'A3 2026-12: ' + JSON.stringify(s2));
const T2 = { y: { months: 12, reason: 'r'.repeat(20) }, q: { months: 6, reason: 'r'.repeat(20) }, bad: { months: 6, reason: 'r'.repeat(20) } };
ok(A.status('y', S, T2, new Date(2026, 11, 1)).text === 'as of 2025' && A.status('y', S, T2, new Date(2027, 0, 1)).stale, 'A3 year stamp counts from December');
ok(!A.status('q', S, T2, new Date(2026, 8, 1)).stale && A.status('q', S, T2, new Date(2026, 9, 1)).stale, 'A3 quarter counts from its last month');
const sb = A.status('bad', S, T2, new Date(2030, 0, 1));
ok(sb.text === 'date not recorded' && !sb.stale && !sb.dated, 'A3 unparseable: ' + JSON.stringify(sb));
ok(A.status('nowhere', S, T2, new Date()).text === 'date not recorded', 'A3 unknown key');
/* A4 */
delete globalThis.RZEngine;
require('../rz-engine.min.js');
ok(JSON.stringify(globalThis.RZEngine.data.sourceRefresh) === JSON.stringify(table), 'A4 rz-engine.min.js carries a different sourceRefresh (rebuild the twin)');

/* A5-A7 browser */
const { default: puppeteer } = await import('puppeteer');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/js/rz-supabase.js') { res.writeHead(200, { 'content-type': 'text/javascript' }).end("const api={configured:false,error:null,async getUser(){return null},onChange(){}};window.rzSupa=api;window.rzSupa.ready=Promise.resolve(api);"); return; }
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const errs = [];
const open = async (url, clock) => {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 1280, height: 900 });
  await tab.setRequestInterception(true);
  tab.on('request', (r) => (r.url().startsWith(base) ? r.continue() : r.abort()));
  tab.on('pageerror', (e) => errs.push(url + ': ' + String(e.message || e)));
  await tab.evaluateOnNewDocument((clock) => { try { localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) {} if (clock) window.__rzAsOfNow = clock; }, clock || null);
  await tab.goto(base + url, { waitUntil: 'load', timeout: 60000 });
  return tab;
};
const read = (tab, sel) => tab.waitForFunction((sel) => { const e = document.querySelector(sel); return e && e.hasAttribute('data-rz-asof-state'); }, { timeout: 20000 }, sel)
  .then(() => tab.$eval(sel, (e) => ({ text: e.textContent, title: e.title, state: e.getAttribute('data-rz-asof-state'), color: getComputedStyle(e).color })))
  .catch(() => null);
const mk = A.status('markets', D.sources, table, new Date());
try {
  let tab = await open('dc-market-tracker.html');
  const t1 = await read(tab, '#dmtAsOf');
  ok(t1 && t1.text === mk.text && t1.title === mk.title, 'A5 tracker reads ' + JSON.stringify(t1) + ' expected ' + mk.text);
  await tab.close();
  tab = await open('dc-market-tracker.html', '2031-01-15');
  const t2 = await read(tab, '#dmtAsOf');
  ok(t2 && t2.state === 'stale' && /· older than 6 months$/.test(t2.text), 'A5 tracker with a 2031 clock: ' + JSON.stringify(t2));
  ok(t2 && t1 && t2.color !== t1.color, 'A5 stale date is not in a different colour: ' + (t1 && t1.color) + ' vs ' + (t2 && t2.color));
  await tab.close();

  tab = await open('tco-calculator.html');
  const c1 = await read(tab, '#tcoAsOf');
  ok(c1 && c1.text === mk.text, 'A6 tco default metro: ' + JSON.stringify(c1));
  const pick = await tab.evaluate(() => {
    const sel = document.getElementById('tcoCountry'), M = RZEngine.data.markets, opts = [...sel.options].map((o) => o.value);
    return { country: opts.find((v) => v.indexOf('country:') === 0) || null, seedOnly: opts.find((v) => v && v.indexOf('country:') !== 0 && !M[v]) || null };
  });
  const setVal = (v) => tab.evaluate((v) => { const s = document.getElementById('tcoCountry'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  if (pick.country) {
    await setVal(pick.country);
    const c2 = await read(tab, '#tcoAsOf');
    const want = A.status('countries', D.sources, table, new Date()).text;
    ok(c2 && c2.text === want, 'A6 tco ' + pick.country + ': ' + JSON.stringify(c2) + ' expected ' + want);
  } else ok(false, 'A6 no country:XX option in the tco country list');
  if (pick.seedOnly) {
    await setVal(pick.seedOnly);
    const c3 = await read(tab, '#tcoAsOf');
    ok(c3 && c3.text === 'date not recorded', 'A6 tco seed-only metro ' + pick.seedOnly + ': ' + JSON.stringify(c3));
  }
  await tab.close();
} catch (e) {
  fails.push('harness: ' + (e && e.stack || e));
} finally { await browser.close(); server.close(); }
ok(errs.length === 0, 'A7 page errors: ' + errs.join(' | '));
if (fails.length) { console.error('FAIL test-asof — ' + fails.length + ' of ' + checks + ':\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('PASS test-asof — ' + checks + ' checks: ' + keys.length + ' sources each with a refresh policy and a parseable date, fixed-clock staleness, min twin, tracker + tco dates and the stale flag');
