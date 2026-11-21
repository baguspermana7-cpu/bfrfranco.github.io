#!/usr/bin/env node
/**
 * test-conv-point-coverage.mjs — PRD-CONV-POINT-STATUS-TREND §7 (T0 inventory + RATCHET).
 *
 * Every rendered number WITH A UNIT on the nine Conventional cockpits (1440 px, dark, signed-in audit state, 6 s after
 * load) is counted and classified by its nearest marker (P-3):
 *   trend          inside [data-trend] or [data-point] (a click opens its history)
 *   state          inside [data-pt-state] (coloured by RZPointStatus)
 *   const          inside [data-const] (a rating / count / design value: opens its basis, no trend)
 *   unclassified   none of trend or const
 * A number is a text token -1,234.5 followed (in its own text node, or the next visible one) by a unit from UNIT below.
 * The trend modal, sheets and tooltips are excluded. The count is a measurement, not a parser of meaning: a value split
 * across three spans counts once, a label that happens to read "2N" does not count.
 *
 *   --report            print the per-page table (PRD §1.1)
 *   --write-baseline    write tools/conv-point-coverage-baseline.json from this run
 *   (no flag)           RATCHET: per page, unclassified may only fall (plus TOL for the live simulation's jitter, measured
 *                       when the baseline was written) and trend / state / const may only rise. Exit 1 on a rise.
 *   RZ_PST_BASELINE=<file>  read another baseline (the red proof plants one with a lower floor)
 *   --page=a.html,b.html    subset
 *   --list              print every unclassified number with the element it sits in (a page migration's work list)
 *
 * STRICT pages (T2/T3 done: STRICT below) are held to the point laws as well, at 1440 dark AND 390 light:
 *   PC1  unclassified = 0 at both widths
 *   PC2  every visible [data-point]: data-pt-value = the number it shows (P-5) and data-pt-state = RZPointStatus.classify(
 *        value, limits(id)) (with or without the element's previous state: the ISA-18.2 deadband may hold a state)
 *   PC3  ok / warn / alarm text is painted in its token (--rz-pt-ok / -warn / -alarm; normal in a Flat sheet excepted)
 *   PC4  warn carries ▲ (▼ low), alarm ◆ — CSS ::after on HTML, tspan.rz-pt-g in SVG
 *   PC5  (cdu-mini-bms) planted warning: In-Rack + Hot facility water puts TCS supply TT-01 at 39 ± 0.6 °C, inside
 *        warn 37 / alarm 40: the number turns warn with ▲ in the warn token, and the trend it opens says Warning
 *   PC7  (datahall) planted excursion: the page's own simulator drives one row's rack inlet to 27.5–30 °C, inside warn 27 / alarm 30:
 *        the hottest-rack-inlet number turns warn with ▲ in the warn token, and the trend it opens says Warning
 *   PC6  at least one point per STRICT page (a page that drops its points would pass PC2–PC4 vacuously)
 *   PC7  (EPMS_Telemetry) planted warning: opening the TX-1 incomer and closing the 20 kV bus tie (the page's own switching
 *        path) makes TX-2 carry both sections, 2 x its normal loading, inside warn 50 / alarm 100: the load % on E-S-101
 *        turns warn with ▲ in the warn token, and the trend it opens says Warning
 *
 * Run inside a browser lane:  rz-lane -l 1 -t 900 -- node tools/test-conv-point-coverage.mjs --report
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { enterAuthorizedAuditState, primeCockpitAuditDocument } from './lib/cockpit-audit-state.mjs';
import { isSupabaseModule, signedInSupabaseBody, signedInStorage } from './lib/signed-in-supabase.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const has = (f) => process.argv.includes(f);
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || '';
const BASELINE = process.env.RZ_PST_BASELINE || path.join(ROOT, 'tools', 'conv-point-coverage-baseline.json');
const PAGES = ['dc-conventional.html', 'datahall.html', 'chiller-plant.html', 'water-system.html', 'fire-system.html',
  'fuel-system.html', 'ict.html', 'EPMS_Telemetry.html', 'cdu-mini-bms.html'];
const IDENTITY = { 'EPMS_Telemetry.html': 'epms-telemetry' };
const ONLY = arg('page') ? arg('page').split(',') : null;
const pages = PAGES.filter((p) => !ONLY || ONLY.includes(p));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const SETTLE_MS = 6000;
const STRICT = ['chiller-plant.html', 'cdu-mini-bms.html', 'fuel-system.html', 'water-system.html', 'fire-system.html', 'ict.html', 'EPMS_Telemetry.html', 'dc-conventional.html', 'datahall.html'];

const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split(/[?#]/)[0]));
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const O = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

/* runs in the page: returns { numbers, trend, state, const, unclassified, samples } */
function inventory() {
  const UNIT = /^\s*(°C|°F|℃|K\b|%|kWh|MWh|kW|MW|GW|kVAr|kVA|MVA|kV|V\b|kA|A\b|barg|bar|kPa|MPa|Pa\b|psi|L\/s|l\/s|LPM|L\/min|lpm|m³\/h|m3\/h|m³|m3|L\b|Hz|rpm|RPM|ppm|kg\b|t\/h|h\b|hr\b|hrs\b|min\b|ms\b|s\b|°)/;
  const NUM = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g;
  const SKIP = '.rz-trend, .rz-sheet, .rz-sheet-scrim, .rz-pt-tip, script, style, noscript, template';
  const visible = (el) => {
    if (!el || el.closest(SKIP)) return false;
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const nodes = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.trim() && visible(n.parentElement)) nodes.push(n);
  const out = { numbers: 0, trend: 0, state: 0, const: 0, unclassified: 0, samples: [] };
  nodes.forEach((n, i) => {
    const t = n.nodeValue; let m; NUM.lastIndex = 0;
    while ((m = NUM.exec(t))) {
      const before = t[m.index - 1] || '';
      if (/[A-Za-z_\-/:#]/.test(before)) continue;   /* tag numbers: CH-01, R1, 14:05, #3 */
      let rest = t.slice(m.index + m[0].length);
      if (!rest.trim() && nodes[i + 1]) rest = nodes[i + 1].nodeValue.slice(0, 16);
      if (!UNIT.test(rest)) continue;
      const el = n.parentElement;
      out.numbers++;
      const tr = !!el.closest('[data-trend],[data-point]'), st = !!el.closest('[data-pt-state]'), cn = !!el.closest('[data-const]');
      if (tr) out.trend++; if (st) out.state++; if (cn) out.const++;
      if (!tr && !cn) { out.unclassified++; if (out.samples.length < 6) out.samples.push((m[0] + rest.trim().slice(0, 6)).trim()); }
    }
  });
  return out;
}

/* runs in the page: the point laws PC2–PC4 over every visible [data-point] */
function pointLaws() {
  const SKIP = '.rz-trend, .rz-sheet, .rz-sheet-scrim, .rz-pt-tip';
  const PS = window.RZPointStatus, out = { points: 0, bad: [] };
  if (!PS) { out.bad.push('RZPointStatus not loaded'); return out; }
  const probe = document.createElement('i'); document.body.appendChild(probe);
  const rgb = (c) => { probe.style.color = ''; probe.style.color = c; return getComputedStyle(probe).color; };
  const rs = getComputedStyle(document.documentElement);
  const tok = { ok: rgb(rs.getPropertyValue('--rz-pt-ok').trim()), warn: rgb(rs.getPropertyValue('--rz-pt-warn').trim()), alarm: rgb(rs.getPropertyValue('--rz-pt-alarm').trim()) };
  probe.remove();
  const first = (t) => { const m = /-?\d+(?:\.\d+)?/.exec(String(t || '').replace(/,/g, '')); return m ? parseFloat(m[0]) : null; };
  const pageFlat = document.documentElement.hasAttribute('data-pt-flat');
  document.querySelectorAll('[data-point]').forEach((el) => {
    if (el.closest(SKIP) || !el.getClientRects().length) return;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
    out.points++;
    const id = el.getAttribute('data-point'), s = el.getAttribute('data-pt-state'), L = PS.limits(id);
    const tn = el.cloneNode(true); tn.querySelectorAll('.rz-pt-g').forEach((g) => g.remove());
    const shown = first(tn.textContent), v = el.hasAttribute('data-pt-value') ? parseFloat(el.getAttribute('data-pt-value')) : null;
    const where = `${id} "${tn.textContent.trim().slice(0, 24)}"`;
    if (!s) { out.bad.push(`PC2 ${where}: no data-pt-state`); return; }
    if (shown !== v && !(shown == null && v == null)) out.bad.push(`PC2 ${where}: data-pt-value ${v} ≠ shown ${shown}`);
    const c0 = PS.classify(v, L, null), c1 = PS.classify(v, L, { state: s, dir: el.getAttribute('data-pt-dir') });
    if (s !== c0 && s !== c1) out.bad.push(`PC2 ${where}: state ${s} ≠ classify ${c0}`);
    const svg = el instanceof SVGElement, col = svg ? cs.fill : cs.color;
    const flat = pageFlat || !!el.closest('.hmi-frame[data-shade="flat"]');
    if (tok[s] && !(s === 'ok' && flat) && col !== tok[s]) out.bad.push(`PC3 ${where}: ${s} painted ${col}, token ${tok[s]}`);
    if (s === 'warn' || s === 'alarm') {
      const g = svg ? ((el.querySelector('tspan.rz-pt-g') || {}).textContent || '') : getComputedStyle(el, '::after').content;
      const want = s === 'alarm' ? '◆' : (el.getAttribute('data-pt-dir') === 'lo' ? '▼' : '▲');
      if (g.indexOf(want) < 0) out.bad.push(`PC4 ${where}: ${s} without ${want} (${g})`);
    }
  });
  return out;
}

async function measure(file, o = {}) {
  const width = o.width || 1440, theme = o.theme || 'dark';
  const page = await browser.newPage(), errors = [];
  await page.setViewport({ width, height: width < 600 ? 844 : 900, deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
  page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 160)));
  await page.setRequestInterception(true);
  page.on('request', (q) => {
    const u = q.url();
    if (isSupabaseModule(u)) return q.respond({ status: 200, contentType: 'text/javascript', body: signedInSupabaseBody({ email: 'gate.user@resistancezero.com', tier: 'pro' }) });
    if (u.startsWith(O) || u.startsWith('data:')) return q.continue();
    return q.respond({ status: 204, contentType: 'text/plain', body: '' });
  });
  await page.evaluateOnNewDocument((entries) => entries.forEach(([k, v]) => localStorage.setItem(k, v)), signedInStorage({ tier: 'pro' }));
  await primeCockpitAuditDocument(page, theme);
  await page.goto(O + file, { waitUntil: 'load', timeout: 90000 });
  try { await enterAuthorizedAuditState(page, IDENTITY[file] || file.replace(/\.html$/, '')); } catch (e) { /* not a gated identity */ }
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  /* SELECTOR / STATE ONLY (PRD-CONV-DATAHALL-SPACE §5): the hall's numbers rest in closed disclosures ((i), Events, the inspector's blocks);
     a gate that counts them opens them first. The floors in the baseline are unchanged. */
  if (file === 'datahall.html') { await page.evaluate(() => document.querySelectorAll('[data-dh-disclose]').forEach((b) => b.click())); await new Promise((r) => setTimeout(r, 400)); }
  const inv = await page.evaluate(inventory);
  if (has('--list')) inv.list = await page.evaluate(listUnclassified);
  if (o.laws) inv.laws = await page.evaluate(pointLaws);
  if (o.plant) inv.plant = file === 'EPMS_Telemetry.html' ? await plantTx(page) : file === 'datahall.html' ? await plantInlet(page) : await plantTcs(page);
  await page.close();
  return { ...inv, errors: errors.length, errorText: errors.slice(0, 3) };
}

/* runs in the page: each unclassified number with the element it sits in */
function listUnclassified() {
  const UNIT = /^\s*(°C|°F|℃|K\b|%|kWh|MWh|kW|MW|GW|kVAr|kVA|MVA|kV|V\b|kA|A\b|barg|bar|kPa|MPa|Pa\b|psi|L\/s|l\/s|LPM|L\/min|lpm|m³\/h|m3\/h|m³|m3|L\b|Hz|rpm|RPM|ppm|kg\b|t\/h|h\b|hr\b|hrs\b|min\b|ms\b|s\b|°)/;
  const NUM = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g, SKIP = '.rz-trend, .rz-sheet, .rz-sheet-scrim, .rz-pt-tip, script, style, noscript, template';
  const vis = (el) => el && !el.closest(SKIP) && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const path = (el) => { const p = []; for (let e = el; e && e !== document.body && p.length < 4; e = e.parentElement) p.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList && e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '')); return p.join('>'); };
  const nodes = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), out = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.trim() && vis(n.parentElement)) nodes.push(n);
  nodes.forEach((n, i) => {
    const t = n.nodeValue; let m; NUM.lastIndex = 0;
    while ((m = NUM.exec(t))) {
      if (/[A-Za-z_\-/:#]/.test(t[m.index - 1] || '')) continue;
      let rest = t.slice(m.index + m[0].length); if (!rest.trim() && nodes[i + 1]) rest = nodes[i + 1].nodeValue.slice(0, 16);
      if (!UNIT.test(rest)) continue;
      const el = n.parentElement; if (el.closest('[data-trend],[data-point],[data-const]')) continue;
      out.push(`${(m[0] + rest.trim().slice(0, 8)).trim()}  @ ${path(el)}`);
    }
  });
  return out;
}

/* PC5: the owner's example on the real page controls — In-Rack (supply 30 °C) + Hot facility water (+9 K) */
async function plantTcs(page) {
  const ID = 'cdu-mini-bms.TT-01.supply_c', r = { bad: [] };
  await page.evaluate(() => { document.querySelector('#typeSeg [data-type="inrack"]').click(); document.querySelector('#scenSeg [data-scen="hotfws"]').click(); });
  await new Promise((res) => setTimeout(res, 2500));
  const el = await page.evaluate((id) => {
    const e = [...document.querySelectorAll(`[data-point="${id}"]`)].find((x) => x.getClientRects().length && !(x instanceof SVGElement));
    if (!e) return null;
    const probe = document.createElement('i'); probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--rz-pt-warn').trim(); document.body.appendChild(probe);
    const warn = getComputedStyle(probe).color; probe.remove();
    e.scrollIntoView({ block: 'center' });
    return { v: parseFloat(e.getAttribute('data-pt-value')), s: e.getAttribute('data-pt-state'), dir: e.getAttribute('data-pt-dir'), glyph: getComputedStyle(e, '::after').content, col: getComputedStyle(e).color, warn };
  }, ID);
  if (!el) { r.bad.push('PC5 no visible TT-01 supply point'); return r; }
  r.value = el.v; r.state = el.s;
  if (!(el.v > 37 && el.v < 40)) r.bad.push(`PC5 planted TCS ${el.v} °C not inside (37, 40)`);
  if (el.s !== 'warn' || el.dir !== 'hi') r.bad.push(`PC5 TCS ${el.v} state ${el.s}/${el.dir}, want warn/hi`);
  if (el.glyph.indexOf('▲') < 0) r.bad.push(`PC5 TCS warn without ▲ (${el.glyph})`);
  if (el.col !== el.warn) r.bad.push(`PC5 TCS painted ${el.col}, warn token ${el.warn}`);
  await page.evaluate((id) => { [...document.querySelectorAll(`[data-point="${id}"]`)].find((x) => x.getClientRects().length && !(x instanceof SVGElement)).click(); }, ID);
  await new Promise((res) => setTimeout(res, 600));
  const head = await page.evaluate(() => { const t = document.querySelector('.rz-trend:not([hidden]) .rz-trend-stw, .rz-sheet .rz-trend-stw'); return t ? { s: t.getAttribute('data-tr-state'), text: t.textContent } : null; });
  r.trend = head;
  if (!head || head.s !== 'warn' || !/Warning/.test(head.text)) r.bad.push(`PC5 trend header ${head ? head.text : 'not open'}, want Warning`);
  return r;
}

/* PC7: datahall — the page's own excursion simulator drives one row's rack inlet to 27.5–30 °C (inside warn 27 / alarm 30 of
   datahall.rack.inlet_c): the hottest-rack-inlet number turns warn with ▲ in the warn token, and the trend it opens says Warning */
async function plantInlet(page) {
  const ID = 'datahall.rack.inlet_hottest_c', r = { bad: [] };
  await page.evaluate(() => { if (typeof window.__fireDatahallExcursion === 'function') window.__fireDatahallExcursion(); });
  await new Promise((res) => setTimeout(res, 900));
  const el = await page.evaluate((id) => {
    const e = [...document.querySelectorAll(`[data-point="${id}"]`)].find((x) => x.getClientRects().length && !(x instanceof SVGElement));
    if (!e) return null;
    const probe = document.createElement('i'); probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--rz-pt-warn').trim(); document.body.appendChild(probe);
    const warn = getComputedStyle(probe).color; probe.remove();
    e.scrollIntoView({ block: 'center' });
    return { v: parseFloat(e.getAttribute('data-pt-value')), s: e.getAttribute('data-pt-state'), dir: e.getAttribute('data-pt-dir'), glyph: getComputedStyle(e, '::after').content, col: getComputedStyle(e).color, warn };
  }, ID);
  if (!el) { r.bad.push('PC7 no visible hottest-rack-inlet point'); return r; }
  r.value = el.v; r.state = el.s;
  if (!(el.v > 27 && el.v <= 30)) r.bad.push(`PC7 planted rack inlet ${el.v} °C not inside (27, 30]`);
  if (el.s !== 'warn' || el.dir !== 'hi') r.bad.push(`PC7 rack inlet ${el.v} state ${el.s}/${el.dir}, want warn/hi`);
  if (el.glyph.indexOf('▲') < 0) r.bad.push(`PC7 rack inlet warn without ▲ (${el.glyph})`);
  if (el.col !== el.warn) r.bad.push(`PC7 rack inlet painted ${el.col}, warn token ${el.warn}`);
  await page.evaluate((id) => { [...document.querySelectorAll(`[data-point="${id}"]`)].find((x) => x.getClientRects().length && !(x instanceof SVGElement)).click(); }, ID);
  await new Promise((res) => setTimeout(res, 600));
  const head = await page.evaluate(() => { const t = document.querySelector('.rz-trend:not([hidden]) .rz-trend-stw, .rz-sheet .rz-trend-stw'); return t ? { s: t.getAttribute('data-tr-state'), text: t.textContent } : null; });
  r.trend = head;
  if (!head || head.s !== 'warn' || !/Warning/.test(head.text)) r.bad.push(`PC7 trend header ${head ? head.text : 'not open'}, want Warning`);
  return r;
}
/* PC7: TX-2 carrying both 20 kV sections through the page's own simulated switching (the inspector's Open / Close action) */
async function plantTx(page) {
  const ID = 'epms-telemetry.tx2.load_pct', r = { bad: [] };
  await page.evaluate(async () => {
    const A = window.RZDatahallAIInspectorActions, wait = (ms) => new Promise((res) => setTimeout(res, ms));
    A.epmsSimSwitch({ id: 'i1-cb' }); await wait(300); A.epmsSimSwitch({ id: 'tie' }); await wait(300);
  });
  await new Promise((res) => setTimeout(res, 800));
  const el = await page.evaluate((id) => {
    const e = [...document.querySelectorAll(`[data-point="${id}"]`)].find((x) => x instanceof SVGElement && x.getClientRects().length);   /* the label on the sheet (the rail repeats it) */
    if (!e) return null;
    const probe = document.createElement('i'); probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--rz-pt-warn').trim(); document.body.appendChild(probe);
    const warn = getComputedStyle(probe).color; probe.remove();
    const g = e.querySelector('tspan.rz-pt-g');
    return { v: parseFloat(e.getAttribute('data-pt-value')), s: e.getAttribute('data-pt-state'), dir: e.getAttribute('data-pt-dir'), glyph: g ? g.textContent : '', col: getComputedStyle(e).fill, warn };
  }, ID);
  if (!el) { r.bad.push('PC7 no visible TX-2 load point'); return r; }
  r.value = el.v; r.state = el.s;
  if (!(el.v > 50 && el.v < 100)) r.bad.push(`PC7 planted TX-2 load ${el.v} % not inside (50, 100)`);
  if (el.s !== 'warn' || el.dir !== 'hi') r.bad.push(`PC7 TX-2 load ${el.v} % state ${el.s}/${el.dir}, want warn/hi`);
  if (el.glyph.indexOf('▲') < 0) r.bad.push(`PC7 TX-2 warn without ▲ (${el.glyph})`);
  if (el.col !== el.warn) r.bad.push(`PC7 TX-2 painted ${el.col}, warn token ${el.warn}`);
  await page.evaluate((id) => { [...document.querySelectorAll(`[data-point="${id}"]`)].find((x) => x instanceof SVGElement && x.getClientRects().length).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }, ID);
  await new Promise((res) => setTimeout(res, 600));
  const head = await page.evaluate(() => { const t = document.querySelector('.rz-trend:not([hidden]) .rz-trend-stw, .rz-sheet .rz-trend-stw'); return t ? { s: t.getAttribute('data-tr-state'), text: t.textContent } : null; });
  r.trend = head;
  if (!head || head.s !== 'warn' || !/Warning/.test(head.text)) r.bad.push(`PC7 trend header ${head ? head.text : 'not open'}, want Warning`);
  return r;
}

const results = {}, strict = {};
for (const p of pages) {
  const isStrict = STRICT.includes(p);
  results[p] = await measure(p, { laws: isStrict, plant: isStrict && (p === 'cdu-mini-bms.html' || p === 'EPMS_Telemetry.html' || p === 'datahall.html') });
  if (isStrict) strict[p] = { w1440: results[p], w390: await measure(p, { width: 390, theme: 'light', laws: true }) };
}
await browser.close(); srv.close();
if (has('--list')) for (const p of pages) { console.log(`-- ${p} (1440) unclassified ${results[p].unclassified}`); (results[p].list || []).forEach((l) => console.log('   ' + l)); if (strict[p]) { console.log(`-- ${p} (390) unclassified ${strict[p].w390.unclassified}`); (strict[p].w390.list || []).forEach((l) => console.log('   ' + l)); } }

/* point laws PC1–PC6 on the STRICT pages */
const lawFails = [];
for (const p of Object.keys(strict)) {
  for (const [w, r] of Object.entries(strict[p])) {
    if (r.unclassified) lawFails.push(`PC1 ${p} ${w}: ${r.unclassified} unclassified, e.g. ${r.samples.join(' · ')}`);
    if (!r.laws || !r.laws.points) lawFails.push(`PC6 ${p} ${w}: no point on the page`);
    (r.laws ? r.laws.bad : []).slice(0, 8).forEach((b) => lawFails.push(`${p} ${w}: ${b}`));
    if (r.errors) lawFails.push(`${p} ${w}: ${r.errors} page error(s): ${r.errorText.join(' | ')}`);
    console.log(`  ${p} ${w}: numbers ${r.numbers}, points ${r.laws ? r.laws.points : 0}, trend ${r.trend}, state ${r.state}, const ${r.const}, unclassified ${r.unclassified}`);
  }
  const pl = strict[p].w1440.plant; if (pl) { pl.bad.forEach((b) => lawFails.push(`${p}: ${b}`)); if (!pl.bad.length) console.log(p === 'EPMS_Telemetry.html' ? `  PC7 planted TX-2 load ${pl.value} % -> ${pl.state} ▲, trend header "${pl.trend.text}"` : p === 'datahall.html' ? `  PC7 planted rack inlet ${pl.value} °C -> ${pl.state} ▲, trend header "${pl.trend.text}"` : `  PC5 planted TCS ${pl.value} °C -> ${pl.state} ▲, trend header "${pl.trend.text}"`); }
}

const line = (p, r) => `| \`${p}\` | ${r.numbers} | ${r.trend} | ${r.state} | ${r.const} | ${r.unclassified} |`;
if (has('--report') || has('--write-baseline')) {
  console.log('| page | numbers with a unit | open a trend | carry a state | constants | unclassified |');
  console.log('|---|---|---|---|---|---|');
  const tot = { numbers: 0, trend: 0, state: 0, const: 0, unclassified: 0 };
  for (const p of pages) { console.log(line(p, results[p])); for (const k of Object.keys(tot)) tot[k] += results[p][k]; }
  console.log(`| **all ${pages.length}** | ${tot.numbers} | ${tot.trend} | ${tot.state} | ${tot.const} | ${tot.unclassified} |`);
  for (const p of pages) if (results[p].samples.length) console.log(`  ${p} unclassified e.g. ${results[p].samples.join(' · ')}`);
}
if (has('--write-baseline')) {
  const data = { note: 'RATCHET floor of tools/test-conv-point-coverage.mjs (PRD-CONV-POINT-STATUS-TREND §1.1). unclassified may only fall, trend/state/const may only rise. Re-record with --write-baseline after a deliberate change.', tolerance: { unclassifiedPct: 3, unclassifiedMin: 3 }, pages: {} };
  for (const p of pages) { const { samples, errors, ...r } = results[p]; data.pages[p] = r; }
  fs.writeFileSync(path.join(ROOT, 'tools', 'conv-point-coverage-baseline.json'), JSON.stringify(data, null, 2) + '\n');
  console.log('wrote tools/conv-point-coverage-baseline.json');
  process.exit(0);
}
if (has('--report')) process.exit(0);

const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')), fails = [];
for (const p of pages) {
  const b = base.pages[p], r = results[p];
  if (!b) { fails.push(`${p}: no baseline row`); continue; }
  const tol = Math.max(base.tolerance.unclassifiedMin, Math.round(b.unclassified * base.tolerance.unclassifiedPct / 100));
  if (r.unclassified > b.unclassified + tol) fails.push(`${p}: unclassified ${r.unclassified} > floor ${b.unclassified} (+${tol} jitter) — a new number neither opens a trend nor is a constant; e.g. ${r.samples.join(' · ')}`);
  for (const k of ['trend', 'state', 'const']) if (r[k] < b[k] - tol) fails.push(`${p}: ${k} ${r[k]} fell below ${b[k]}`);
}
fails.push(...lawFails);
if (fails.length) { console.log(`CONV POINT COVERAGE — FAIL (${fails.length})`); fails.forEach((f) => console.log('  ' + f)); process.exit(1); }
console.log(`CONV POINT COVERAGE — PASS (ratchet on ${pages.length} pages: ` + pages.map((p) => `${p.replace('.html', '')} ${results[p].unclassified}u/${results[p].trend}t`).join(', ') + ')');
