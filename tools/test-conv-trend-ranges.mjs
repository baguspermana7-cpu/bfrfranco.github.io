#!/usr/bin/env node
/**
 * test-conv-trend-ranges.mjs — PRD-CONV-POINT-STATUS-TREND §7, the browser half of T1, on a FIXTURE
 * (tools/fixtures/conv-point-trend/index.html: the shared files, three points ok / warn / alarm), because the nine
 * cockpits are wired in T2/T3.
 *
 *   L1  open       click, Enter and a touch tap open the trend with that point as pen 1
 *   L2  ranges     1H · 8H · 1D · 7D · 30D switch the window (svg span = range), the sample count (window / step) and the
 *                  stats; default 1D on a fresh session; the last range is remembered for the session
 *   L3  P-5 value  the series ends on the page's value (CSV last row) and the header shows it at the page's rounding
 *   L4  P-5 state  header state word + colour state = the point's data-pt-state on the page
 *   L5  P-5 bands  shaded bands and labelled limit lines = the registry row (RZPointStatus.limits)
 *   L6  keys       1–5 pick the ranges
 *   L7  Esc        closes, focus returns to the number, nothing left inert
 *   L8  phone 390  bottom sheet (js/rz-sheet.js) at 88 % height, range bar sticky, every range button >= 44 x 44 px,
 *                  no sideways scroll
 *   L9  old URL    #trend=<id>&r=24h restores the trend on 1D, r=5m on 1H
 *   L10 contrast   the three state colours >= 4.5:1 on their surface, page and trend header, both themes; glyph ▲/▼/◆ and
 *                  the alarm outline present (P-4); tooltip text = name · value · state · limits
 *   L11 errors     0 page errors
 *   T1b, the database (PRD §5b) and series providers — Supabase stubbed in-browser (window.rzSupa, as test-feature-overrides):
 *   D1 db series   Supabase up: the trend draws the conv_point_series rows (not the local model), header source
 *                  "Database (simulated, pg_cron)", no "unreachable" line; 7D draws buckets as a min–max band + avg line,
 *                  stats = min of mins, max of maxes, n-weighted mean of avgs
 *   D2 db limits   conv_points rows restyle the page after first paint (a stricter TCS-style row turns the ok point
 *                  warn); a row with bad bound order is ignored (shipped registry)
 *   D3 provider    RZTrend.register(points, { provider }) draws the provider's rows under its label
 *   D4 fallback    a rejecting provider, and one that answers after 4 s, turn that open to the local model for EVERY
 *                  pen (never two sources) with the line "Database unreachable — local SIM history" and the source
 *                  "Local model (database unreachable)"
 *   D5 down        Supabase configured but unreachable: local model + the line + the label, shipped limits, 0 errors
 *
 *   --plant=<name> serves a defect (nopin, noband, range, legacy, contrast, sheet, nokeys, nodb, mix, nobucket, nodblimits) — each must turn the gate red.
 *   --shots=<dir>  pst-trend-<range>-<width>-<theme>.png and pst-tooltip-<width>-<theme>.png
 *
 * Run inside a browser lane:  rz-lane -l 1 -t 600 -- node tools/test-conv-trend-ranges.mjs
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || '';
const SHOTS = arg('shots'), PLANT = arg('plant');
const FIX = 'tools/fixtures/conv-point-trend/index.html';
const CLOCK = 1795000000000;
const PTS = { ok: { el: '#p-ok', id: 'environment.avg_temp_c' }, warn: { el: '#p-warn', id: 'cdu-mini-bms.TT-01.supply_c' }, alarm: { el: '#p-alarm', id: 'fire.static_pressure_bar' } };
const RANGES = { '1H': [60, 1], '8H': [480, 2], '1D': [1440, 5], '7D': [10080, 30], '30D': [43200, 30] };
const PLANTS = {
  nopin: ['js/rz-trend.js', 'if (isNum(o.value)) pinned[id] = o.value;', ''],
  noband: ['js/rz-trend.js', 'var s = L0 ? bands(', 'var s = false ? bands('],
  range: ['js/conv/history.js', "'7D': [10080, 30]", "'7D': [1440, 5]"],
  legacy: ['js/rz-trend.js', "'5m': '1H', ", ''],
  contrast: ['css/conv-point.css', '--rz-pt-ok: #1a7f37;', '--rz-pt-ok: #3fb950;'],
  sheet: ['js/rz-trend.js', "if (phone()) {", 'if (false) {'],
  nokeys: ['js/rz-trend.js', '/^[1-5]$/.test(e.key)', 'false'],
  nodb: ['js/rz-trend.js', 'if (!dbConfigured()) return null;', 'return null;'],
  mix: ['js/rz-trend.js', 'var prov = openDown ? null : providerFor(p.id);', 'var prov = providerFor(p.id);'],
  nobucket: ['js/rz-trend.js', 'if (d.bucket && d.pts.length) s +=', 'if (false) s +='],
  nodblimits: ['js/conv/point-status.js', "setDbRows(res.data, 'database');", ''],
  refstack: ['js/rz-trend.js', 'while (busy(ly) && n < 12)', 'while (false && n < 12)'],
};
if (PLANT && !PLANTS[PLANT]) { console.error(`unknown plant ${PLANT}: ${Object.keys(PLANTS).join(', ')}`); process.exit(2); }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const fails = []; let passes = 0;
const ok = (cond, law, msg) => { if (cond) passes++; else fails.push(`${law} ${msg}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = http.createServer((q, r) => {
  const rel = decodeURIComponent(q.url.split(/[?#]/)[0]).replace(/^\/+/, ''), p = path.join(ROOT, rel);
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, 'utf8', (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    if (PLANT && PLANTS[PLANT][0] === rel) {
      if (!d.includes(PLANTS[PLANT][1])) { console.error(`plant ${PLANT}: anchor not found in ${rel}`); process.exit(2); }
      d = d.split(PLANTS[PLANT][1]).join(PLANTS[PLANT][2]);
    }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d);
  });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const O = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

async function load(width, theme, hash = '', pre = null) {
  const pg = await browser.newPage();
  pg.__errs = [];
  pg.on('pageerror', (e) => pg.__errs.push(String(e.message || e).slice(0, 160)));
  pg.on('console', (m) => { if (m.type() === 'error') pg.__errs.push('console: ' + m.text().slice(0, 160)); });
  if (pre) await pg.evaluateOnNewDocument(pre);
  await pg.evaluateOnNewDocument((t) => { try { localStorage.setItem('theme', t); sessionStorage.clear(); } catch (e) { /* none */ } }, theme);
  await pg.setViewport({ width, height: width > 800 ? 900 : 844, deviceScaleFactor: 1, hasTouch: width <= 600, isMobile: width <= 600 });
  await pg.goto(O + FIX + hash, { waitUntil: 'load' });
  await pg.evaluate((c) => { window.RZTrend.now = () => c; }, CLOCK);
  return pg;
}
const st = (pg) => pg.evaluate(() => ({ open: window.RZTrend.isOpen(), ...window.RZTrend.state() }));

/* contrast in the page: the element's colour against the first opaque background up its ancestors */
const CONTRAST = `(el) => {
  const rgb = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  let n = el, bg = null;
  while (n && n.nodeType === 1) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.95)) { bg = c; break; } n = n.parentElement; }
  bg = bg || [255, 255, 255];
  const fg = rgb(getComputedStyle(el).color), a = lum(fg), b = lum(bg);
  return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), fg: getComputedStyle(el).color };
}`;

for (const [width, theme] of [[1440, 'dark'], [1440, 'light'], [390, 'dark'], [390, 'light']]) {
  const tag = `@${width}/${theme}`, phone = width <= 600;
  const pg = await load(width, theme);

  /* L10 page side: state, glyph, outline, contrast, tooltip */
  for (const [state, p] of Object.entries(PTS)) {
    const r = await pg.evaluate((sel, fn) => {
      const el = document.querySelector(sel), cs = getComputedStyle(el), as = getComputedStyle(el, '::after'), after = as.content, afterVis = as.visibility;
      return { state: el.getAttribute('data-pt-state'), after, afterVis, outline: cs.outlineStyle + ' ' + cs.outlineWidth, c: (0, eval)(fn)(el), role: el.getAttribute('role'), tab: el.tabIndex, tip: el.getAttribute('data-pt-tip'), aria: el.getAttribute('aria-label') };
    }, p.el, CONTRAST);
    ok(r.state === state, 'L10', `${tag} ${p.id} data-pt-state ${r.state} (want ${state})`);
    ok(r.c.ratio >= 4.5, 'L10', `${tag} ${state} colour ${r.c.fg} contrast ${r.c.ratio.toFixed(2)} < 4.5`);
    /* normal: no glyph, or only the INVISIBLE reserved one (T2/T3: the number does not move when it turns) */
    ok(state === 'ok' ? (r.after === 'none' || r.afterVis === 'hidden') : state === 'warn' ? /▲|▼/.test(r.after) : /◆/.test(r.after), 'L10', `${tag} ${state} glyph ${r.after} (${r.afterVis})`);
    ok(state === 'alarm' ? /solid 1px/.test(r.outline) : !/solid 1px/.test(r.outline), 'L10', `${tag} ${state} outline ${r.outline}`);
    ok(r.role === 'button' && r.tab === 0 && /Click for trend$/.test(r.tip || '') && new RegExp(state === 'ok' ? 'Normal' : state === 'warn' ? 'Warning' : 'Alarm').test(r.aria || ''), 'L10', `${tag} ${state} role/tabindex/tooltip/aria ${JSON.stringify(r)}`);
  }
  if (!phone) {
    await pg.hover(PTS.warn.el); await sleep(80);
    const tip = await pg.evaluate(() => { const t = document.querySelector('.rz-pt-tip'); return t && !t.hidden ? t.textContent : null; });
    ok(tip === 'TCS supply · TT-01 · 37.4 °C · Warning · warn 18 / 37 · alarm 15 / 40 °C · limits ASSUMED · Click for trend', 'L10', `${tag} tooltip on hover: ${tip}`);
    if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `pst-tooltip-${width}-${theme}.png`), clip: { x: 0, y: 0, width: Math.min(width, 1000), height: 220 } });
    await pg.mouse.move(5, 5);
  }

  /* L1 open: click (desktop) or tap (phone) on the warn point, Enter on the ok point */
  const fresh = await st(pg);
  ok(fresh.range === '1D', 'L2', `${tag} default range ${fresh.range} (want 1D)`);
  if (phone) { const b = await (await pg.$(PTS.warn.el)).boundingBox(); await pg.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
  else await pg.click(PTS.warn.el);
  await sleep(450);
  let s = await st(pg);
  ok(s.open && s.pens[0] === PTS.warn.id, 'L1', `${tag} ${phone ? 'tap' : 'click'} opens the warn point: ${JSON.stringify(s)}`);
  ok(s.range === '1D', 'L2', `${tag} opens on 1D: ${s.range}`);

  /* L3 + L4 header = page */
  const head = await pg.evaluate((sel) => {
    const v = document.querySelector('.rz-trend-val'), w = document.querySelector('.rz-trend-stw'), el = document.querySelector(sel);
    return { val: v.textContent, vs: v.getAttribute('data-tr-state'), word: w.textContent, ws: w.getAttribute('data-tr-state'), page: el.textContent.trim(), pstate: el.getAttribute('data-pt-state'), ev: document.querySelector('[data-tag="ev"]').textContent, src: document.querySelector('[data-tag="src"]').textContent };
  }, PTS.warn.el);
  ok(head.val === head.page, 'L3', `${tag} header value ${head.val} vs page ${head.page}`);
  ok(head.vs === head.pstate && head.ws === head.pstate && head.word === '▲ Warning high', 'L4', `${tag} header state ${head.vs}/${head.word} vs page ${head.pstate}`);
  ok(head.ev === 'Limits ASSUMED' && /^SIMULATED/.test(head.src), 'L4', `${tag} header tags ${head.src} | ${head.ev}`);
  const contrastHead = await pg.evaluate((fn) => (0, eval)(fn)(document.querySelector('.rz-trend-val')), CONTRAST);
  ok(contrastHead.ratio >= 4.5, 'L10', `${tag} trend header colour contrast ${contrastHead.ratio.toFixed(2)}`);

  /* L5 bands + limit lines = registry */
  const bands = await pg.evaluate((id) => {
    const L = window.RZPointStatus.limits(id);
    return { L, lines: [...document.querySelectorAll('.rz-trend-plot [data-limit]')].map((l) => [l.getAttribute('data-limit'), +l.getAttribute('data-v')]),
      labels: [...document.querySelectorAll('.rz-trend-plot .llab')].map((t) => t.lastChild.textContent.replace(/ [↑↓]$/, '')),
      bands: [...document.querySelectorAll('.rz-trend-plot rect[data-band]')].map((r) => [r.getAttribute('data-band'), +r.getAttribute('data-from'), +r.getAttribute('data-to')]) };
  }, PTS.warn.id);
  const want = ['hi_alarm', 'hi_warn', 'lo_warn', 'lo_alarm'].filter((k) => typeof bands.L[k] === 'number').map((k) => [k, bands.L[k]]);
  ok(JSON.stringify(bands.lines) === JSON.stringify(want), 'L5', `${tag} limit lines ${JSON.stringify(bands.lines)} vs registry ${JSON.stringify(want)}`);
  ok(bands.labels.length === want.length && bands.labels.every((t, i) => t.endsWith(String(want[i][1].toFixed(1)))), 'L5', `${tag} limit labels ${JSON.stringify(bands.labels)}`);
  const okBand = bands.bands.find((b) => b[0] === 'ok'), states = bands.bands.map((b) => b[0]).join(',');
  ok(okBand && okBand[1] === bands.L.lo_warn && okBand[2] === bands.L.hi_warn && states === 'ok', 'L5', `${tag} bands ${JSON.stringify(bands.bands)}`);

  /* L2 ranges: window, samples, stats; L3 last point */
  const stats = {};
  for (const [k, [win, step]] of Object.entries(RANGES)) {
    await pg.click(`.rz-trend [data-range="${k}"]`); await sleep(60);
    await pg.click('.rz-trend [data-csv]'); await sleep(40);
    const r = await pg.evaluate(() => {
      const svg = document.querySelector('.rz-trend-plot'), pen = svg.querySelector('polyline.pen'), csv = (window.RZTrend.lastCsv || '').trim().split('\n');
      const sd = {}; document.querySelectorAll('.rz-trend-stats [data-s]').forEach((d) => { sd[d.getAttribute('data-s')] = d.textContent; });
      const pressed = [...document.querySelectorAll('.rz-trend [data-range][aria-pressed="true"]')].map((b) => b.getAttribute('data-range'));
      return { range: window.RZTrend.state().range, span: svg.__t1 - svg.__t0, n: pen.getAttribute('points').trim().split(/\s+/).length, last: +csv[csv.length - 1].split(',')[1], rows: csv.length - 1, sd, pressed, read: document.querySelector('.rz-trend-read').textContent };
    });
    ok(r.range === k && r.pressed.join() === k, 'L2', `${tag} range ${k}: state ${r.range}, pressed ${r.pressed}`);
    ok(r.span === win * 60000, 'L2', `${tag} ${k} window ${r.span / 60000} min (want ${win})`);
    ok(Math.abs(r.n - win / step) <= 1 && r.rows === r.n, 'L2', `${tag} ${k} samples ${r.n} / csv ${r.rows} (want ${win / step})`);
    ok(r.last === 37.4, 'L3', `${tag} ${k} last point ${r.last} (want the page value 37.4)`);
    ok(['min', 'max', 'mean', 'warn', 'alarm', 'excursions'].every((x) => r.sd[x] && r.sd[x] !== '—'), 'L2', `${tag} ${k} stats ${JSON.stringify(r.sd)}`);
    stats[k] = JSON.stringify(r.sd);
    if (SHOTS && (k === '1D' || k === '7D')) await pg.screenshot({ path: path.join(SHOTS, `pst-trend-${k}-${width}-${theme}.png`) });
  }
  ok(new Set(Object.values(stats)).size >= 4, 'L2', `${tag} stats change with the range: ${new Set(Object.values(stats)).size} distinct of 5`);

  /* L6 keys 1–5 */
  await pg.evaluate(() => document.querySelector('.rz-trend [data-close]').focus());
  const seen = [];
  for (let i = 1; i <= 5; i++) { await pg.keyboard.press(String(i)); await sleep(30); seen.push((await st(pg)).range); }
  ok(seen.join() === '1H,8H,1D,7D,30D', 'L6', `${tag} keys 1–5 -> ${seen.join()}`);
  await pg.keyboard.press('4'); await sleep(30);   /* 7D, remembered below */

  /* L8 phone: sheet, 88 %, sticky bar, 44 px, no sideways scroll */
  if (phone) {
    const ph = await pg.evaluate(() => {
      const sh = document.querySelector('.rz-sheet'), segs = [...document.querySelectorAll('.rz-trend [data-range]')].map((b) => b.getBoundingClientRect());
      return { mode: window.RZTrend.state().mode, inSheet: !!(sh && sh.contains(document.querySelector('.rz-trend-panel'))), h: sh ? sh.getBoundingClientRect().height / innerHeight : 0,
        sticky: getComputedStyle(document.querySelector('.rz-trend-tools')).position, minH: Math.min(...segs.map((r) => r.height)), minW: Math.min(...segs.map((r) => r.width)),
        btn: Math.min(...[...document.querySelectorAll('.rz-trend [data-close], .rz-trend [data-csv]')].map((b) => b.getBoundingClientRect().height)),
        over: document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('.rz-sheet, .rz-trend-panel, .rz-trend-plot, .rz-trend-ranges')].some((n) => n.getBoundingClientRect().right > innerWidth + 1) };
    });
    ok(ph.mode === 'sheet' && ph.inSheet, 'L8', `${tag} trend in the house sheet: ${JSON.stringify(ph)}`);
    ok(Math.abs(ph.h - 0.88) < 0.02, 'L8', `${tag} sheet height ${(ph.h * 100).toFixed(1)} % (want 88)`);
    ok(ph.sticky === 'sticky', 'L8', `${tag} range bar position ${ph.sticky}`);
    ok(ph.minH >= 44 && ph.minW >= 44 && ph.btn >= 44, 'L8', `${tag} range buttons ${ph.minW.toFixed(0)}x${ph.minH.toFixed(0)}, Close/CSV ${ph.btn.toFixed(0)} px`);
    ok(!ph.over, 'L8', `${tag} sideways scroll at 390`);
  } else ok((await st(pg)).mode === 'modal', 'L8', `${tag} desktop opens the modal`);

  /* L7 Esc + focus return, nothing inert */
  await pg.keyboard.press('Escape'); await sleep(650);
  const esc = await pg.evaluate((sel) => ({ open: window.RZTrend.isOpen(), back: document.activeElement === document.querySelector(sel), inert: document.querySelectorAll('[inert]').length, sheet: !!document.querySelector('.rz-sheet') }), PTS.warn.el);
  ok(!esc.open && esc.back && esc.inert === 0 && !esc.sheet, 'L7', `${tag} Esc: ${JSON.stringify(esc)}`);

  /* L1 Enter on the ok point; L2 the session remembers 7D */
  await pg.focus(PTS.ok.el); await pg.keyboard.press('Enter'); await sleep(450);
  s = await st(pg);
  ok(s.open && s.pens[0] === PTS.ok.id && s.range === '7D', 'L1', `${tag} Enter opens the ok point on the remembered 7D: ${JSON.stringify(s)}`);
  const okHead = await pg.evaluate(() => document.querySelector('.rz-trend-val').getAttribute('data-tr-state'));
  ok(okHead === 'ok', 'L4', `${tag} ok point header state ${okHead}`);
  await pg.keyboard.press('Escape'); await sleep(400);
  /* the alarm point: header ◆, low */
  await pg.focus(PTS.alarm.el); await pg.keyboard.press('Enter'); await sleep(450);
  const al = await pg.evaluate(() => ({ v: document.querySelector('.rz-trend-val').textContent, s: document.querySelector('.rz-trend-val').getAttribute('data-tr-state'), w: document.querySelector('.rz-trend-stw').textContent, ref: !!document.querySelector('.rz-trend-plot line.ref') }));
  ok(al.s === 'alarm' && al.v === '8.20' && al.w === '◆ Alarm low' && al.ref, 'L4', `${tag} alarm header ${JSON.stringify(al)}`);
  await pg.keyboard.press('Escape'); await sleep(400);
  ok(pg.__errs.length === 0, 'L11', `${tag} page errors: ${pg.__errs[0]}`);
  await pg.close();
}

/* L9 old URLs: r=24h restores 1D, r=5m restores 1H */
{
  const pg = await load(1440, 'dark', '#trend=' + encodeURIComponent(PTS.ok.id) + '&r=5m');
  const s = await st(pg);
  ok(s.open && s.pens[0] === PTS.ok.id && s.range === '1H', 'L9', `#trend=…&r=5m -> ${JSON.stringify(s)}`);
  await pg.close();
}
{
  const pg = await load(1440, 'dark', '#trend=' + encodeURIComponent(PTS.warn.id) + '&r=24h');
  const s = await st(pg);
  ok(s.open && s.pens[0] === PTS.warn.id && s.range === '1D', 'L9', `#trend=…&r=24h -> ${JSON.stringify(s)}`);
  const h = await pg.evaluate(() => location.hash);
  ok(/&r=1D$/.test(h), 'L9', `hash rewritten to the new key: ${h}`);
  ok(pg.__errs.length === 0, 'L11', `hash load page errors: ${pg.__errs[0]}`);
  await pg.close();
}

/* ── T1b: database + providers ─────────────────────────────────────────────────────────────────────────────── */
const SUPA_UP = () => {
  const rows = (from, to) => {
    const a = Date.parse(from), b = Date.parse(to), out = [];
    if (b - a <= 86400000) { for (let t = Math.ceil(a / 600000) * 600000; t < b; t += 600000) out.push({ t: new Date(t).toISOString(), v: 30 + ((t / 600000) % 10) * 0.2, v_min: null, v_max: null, v_mean: null, n: null }); }
    else { for (let t = Math.ceil(a / 1800000) * 1800000; t < b; t += 1800000) { const m = 31 + ((t / 1800000) % 8) * 0.1; out.push({ t: new Date(t).toISOString(), v: null, v_min: m - 0.5, v_max: m + 0.6 + ((t / 1800000) % 3) * 0.1, v_mean: m, n: 4 + ((t / 1800000) % 3) }); } }
    return out;
  };
  window.__rpc = [];
  const api = { configured: true, error: null,
    getConvPoints: async () => ({ data: [
      { id: 'cdu-mini-bms.TT-01.supply_c', lo_alarm: 15, lo_warn: 18, hi_warn: 37, hi_alarm: 40, deadband: 0.3, evidence_class: 'ASSUMED', basis: 'db row' },
      { id: 'environment.avg_temp_c', lo_alarm: 15, lo_warn: 18, hi_warn: 22, hi_alarm: 32, deadband: 0.2, evidence_class: 'STANDARD', basis: 'db row' },
      { id: 'fire.static_pressure_bar', lo_alarm: 8.5, lo_warn: 15, hi_warn: 14, hi_alarm: 16, deadband: 0.1, evidence_class: 'ASSUMED' }], error: null }),
    convPointSeries: async (id, from, to) => { window.__rpc.push([id, from, to]); const r = rows(from, to); window.__lastRows = r; return { data: r, error: null }; } };
  api.ready = Promise.resolve(api); window.rzSupa = api;
};
const SUPA_DOWN = () => {
  const api = { configured: true, error: null,
    getConvPoints: async () => ({ data: [], error: 'Koneksi ke server auth gagal sesaat (jaringan/DNS).' }),
    convPointSeries: async () => { throw new TypeError('Failed to fetch'); } };
  api.ready = Promise.resolve(api); window.rzSupa = api;
};
const head = (pg) => pg.evaluate(() => ({ src: document.querySelector('[data-tag="src"]').textContent, down: !document.querySelector('.rz-trend-down').hidden,
  line: document.querySelector('.rz-trend-down').textContent, n: (document.querySelector('.rz-trend-plot polyline.pen') || { getAttribute: () => '' }).getAttribute('points').trim().split(/\s+/).filter(Boolean).length,
  band: !!document.querySelector('.rz-trend-plot polygon.pen-band'), state: window.RZTrend.state() }));
const DOWN = 'Local model (database unreachable)', LINE = 'Database unreachable — local SIM history', DBL = 'Database · simulated samples every 5 min';
for (const width of [1440, 390]) {
  const pg = await load(width, 'dark', '', SUPA_UP), tag = `@${width}/db`;
  await sleep(400);
  const lim = await pg.evaluate(() => ({ src: window.RZPointStatus.limitsSource(), ok: document.querySelector('#p-ok').getAttribute('data-pt-state'), alarm: document.querySelector('#p-alarm').getAttribute('data-pt-state'), fireLo: window.RZPointStatus.limits('fire.static_pressure_bar').lo_warn }));
  ok(lim.src === 'database' && lim.ok === 'warn', 'D2', `${tag} conv_points row restyles the page: source ${lim.src}, 22.4 °C vs hi_warn 22 -> ${lim.ok} (want warn)`);
  ok(lim.alarm === 'alarm' && lim.fireLo === 10.5, 'D2', `${tag} bad-order row ignored: fire lo_warn ${lim.fireLo} (want registry 10.5), state ${lim.alarm}`);
  await pg.evaluate(() => sessionStorage.setItem('rz_trend_range', '1D'));
  if (width > 600) await pg.click(PTS.warn.el); else { const b = await (await pg.$(PTS.warn.el)).boundingBox(); await pg.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
  await sleep(500);
  let h = await head(pg);
  const rpc = await pg.evaluate(() => window.__rpc.slice(-1)[0] || []);
  ok(h.src === DBL && !h.down && rpc[0] === PTS.warn.id && h.n === 144, 'D1', `${tag} 1D from the database: src "${h.src}", line ${h.down}, rpc ${rpc[0]}, ${h.n} points (want 144 at 10 min, not the 288 of the local model)`);
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `pst-db-1D-${width}.png`) });
  await pg.click('.rz-trend [data-range="7D"]'); await sleep(400);
  h = await head(pg);
  const exp = await pg.evaluate(() => {
    const r = (window.__lastRows || []).map((q) => ({ min: q.v_min, max: q.v_max, avg: q.v_mean, n: q.n })), L = r[r.length - 1];
    if (!L) return { want: ['no rows'], got: [], n: -1 };
    L.min = Math.min(L.min, 37.4); L.max = Math.max(L.max, 37.4); L.avg = 37.4;
    let w = 0, s = 0; r.forEach((q) => { w += q.n; s += q.avg * q.n; });
    const f = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' °C';
    const sd = {}; document.querySelectorAll('.rz-trend-stats [data-s]').forEach((d) => { sd[d.getAttribute('data-s')] = d.textContent; });
    return { want: [f(Math.min(...r.map((q) => q.min))), f(Math.max(...r.map((q) => q.max))), f(s / w)], got: [sd.min, sd.max, sd.mean], n: r.length };
  });
  ok(h.src === DBL && h.band && h.n === exp.n, 'D1', `${tag} 7D buckets: src "${h.src}", min–max band ${h.band}, avg line ${h.n} points (want ${exp.n})`);
  ok(JSON.stringify(exp.got) === JSON.stringify(exp.want), 'D1', `${tag} 7D bucket stats ${JSON.stringify(exp.got)} (want ${JSON.stringify(exp.want)})`);
  const tk = await pg.evaluate(() => [...document.querySelectorAll('.rz-trend-plot text.ax[data-y]')].map((t) => [+t.getAttribute('data-y'), t.textContent]));
  const badTk = tk.filter(([v, t]) => Math.abs(parseFloat(t.replace(/,/g, '')) - v) > 1e-9);
  ok(tk.length > 1 && badTk.length === 0, 'D6', `${tag} 7D tick labels say their value: ${JSON.stringify(badTk.length ? badTk : tk)}`);
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `pst-db-7D-${width}.png`) });
  await pg.keyboard.press('Escape'); await sleep(500);
  if (width > 600) {
    /* D3 custom provider; D4 rejecting + slow providers, and the never-mix rule */
    await pg.evaluate(() => {
      const T = window.RZTrend, def = (id) => ({ id, label: id, unit: '°C', base: 25, amp: 1, digits: 1, shape: 'load', group: 'T1b' });
      T.register([def('x.custom')], { provider: { label: 'Custom feed', series: (id, a, b) => Promise.resolve(Array.from({ length: 7 }, (_, i) => ({ t: a + (i + 1) * (b - a) / 8, v: 20 + i }))) } });
      T.register([def('x.reject')], { provider: { label: 'Never', series: () => Promise.reject(new Error('down')) } });
      T.register([def('x.slow')], { provider: { label: 'Slow', series: () => new Promise((r) => setTimeout(() => r([{ t: Date.now(), v: 1 }]), 6000)) } });
    });
    await pg.evaluate(() => { window.RZTrend.open('x.custom', { range: '1D' }); }); await sleep(300);
    h = await head(pg);
    ok(h.src === 'Custom feed' && h.n === 7 && !h.down, 'D3', `custom provider: src "${h.src}", ${h.n} points (want 7), line ${h.down}`);
    await pg.keyboard.press('Escape'); await sleep(400);
    await pg.evaluate(() => { window.RZTrend.open('x.reject', { range: '1D' }); }); await sleep(300);
    h = await head(pg);
    ok(h.src === DOWN && h.down && h.line === LINE && h.n === 288, 'D4', `rejecting provider: src "${h.src}", line "${h.down ? h.line : ''}", ${h.n} local points (want 288)`);
    await pg.keyboard.press('Escape'); await sleep(400);
    await pg.evaluate((id) => { window.RZTrend.open(id, { range: '1D', pens: ['x.reject'] }); }, PTS.warn.id); await sleep(400);
    h = await head(pg);
    ok(h.src === DOWN && h.down && h.n === 288, 'D4', `database pen + rejecting pen: every pen local (src "${h.src}", pen 1 ${h.n} points, want 288 — never 144 from the database beside a local pen)`);
    await pg.keyboard.press('Escape'); await sleep(400);
    const t0 = Date.now();
    await pg.evaluate(() => { window.RZTrend.open('x.slow', { range: '1D' }); }); await sleep(1000);
    const wait = await pg.evaluate(() => document.querySelector('.rz-trend-plot').textContent);
    await sleep(3600);
    h = await head(pg);
    ok(/Reading the database/.test(wait) && h.src === DOWN && h.down && h.n === 288 && Date.now() - t0 < 6000, 'D4', `provider slower than 4 s: "${wait}" then src "${h.src}", ${h.n} points`);
    await pg.keyboard.press('Escape'); await sleep(400);
  }
  ok(pg.__errs.length === 0, 'L11', `${tag} page errors: ${pg.__errs[0]}`);
  await pg.close();
}
{
  const pg = await load(1440, 'dark', '', SUPA_DOWN);
  await sleep(400);
  const lim = await pg.evaluate(() => ({ src: window.RZPointStatus.limitsSource(), ok: document.querySelector('#p-ok').getAttribute('data-pt-state') }));
  ok(lim.src === 'shipped' && lim.ok === 'ok', 'D5', `Supabase down: limits ${lim.src}, ok point ${lim.ok}`);
  await pg.click(PTS.warn.el); await sleep(500);
  const h = await head(pg);
  ok(h.src === DOWN && h.down && h.line === LINE && h.n === 288, 'D5', `Supabase down: src "${h.src}", line "${h.down ? h.line : ''}", ${h.n} local points`);
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, 'pst-down-1D-1440.png') });
  await pg.keyboard.press('Escape'); await sleep(400);
  ok(pg.__errs.length === 0, 'D5', `Supabase down: page errors ${pg.__errs.length}: ${pg.__errs[0]}`);
  await pg.close();
}
/* ── TD: PRD-CONV-TREND-DESIGN — the modal reads like an instrument (laws D1–D12, computed in the browser) ─── */
const OKLAB = (rgb) => {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = rgb.map(f);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const dE = (a, b) => { const p = OKLAB(a), q = OKLAB(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 100; };
const chroma = (rgb) => { const p = OKLAB(rgb); return Math.hypot(p[1], p[2]); };
for (const [width, theme] of [[1440, 'dark'], [1440, 'light'], [390, 'dark']]) {
  const pg = await load(width, theme), tag = `@${width}/${theme}/design`;
  await pg.evaluate((id) => { sessionStorage.setItem('rz_trend_range', '1D'); window.RZTrend.open(id, { range: '1D' }); }, PTS.warn.id);
  await sleep(500);
  const m = await pg.evaluate(() => {
    const rgb = (s) => { const x = (s || '').match(/[\d.]+/g); return x && x.length >= 3 ? x.slice(0, 3).map(Number) : null; };
    const alpha = (s) => { const x = (s || '').match(/[\d.]+/g); return x && x.length === 4 ? +x[3] : 1; };
    const panel = document.querySelector('.rz-trend-panel'), svg = panel.querySelector('.rz-trend-plot'), cs = getComputedStyle(panel);
    const tok = (n) => { const p = document.createElement('i'); p.style.color = `var(${n})`; panel.appendChild(p); const c = rgb(getComputedStyle(p).color); p.remove(); return c; };
    const T = { ok: tok('--rz-pt-ok'), warn: tok('--rz-pt-warn'), alarm: tok('--rz-pt-alarm'), acc: tok('--tr-acc'), ink: tok('--tr-text'), mute: tok('--tr-mute') };
    const painted = [];
    svg.querySelectorAll('*').forEach((e) => {
      const c = getComputedStyle(e);
      ['fill', 'stroke'].forEach((k) => { if (c[k] && c[k] !== 'none' && !/url\(/.test(c[k])) painted.push({ cls: e.getAttribute('class') || e.tagName, k, c: rgb(c[k]), op: (+c[k + 'Opacity'] || 1) * (+c.opacity || 1) * alpha(c[k]), tag: e.tagName, dash: c.strokeDasharray }); });
    });
    const texts = [];
    panel.querySelectorAll('*').forEach((e) => {
      if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
      const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden' || e.closest('[hidden]')) return;
      texts.push({ cls: e.getAttribute('class') || e.tagName, c: rgb(e.namespaceURI === 'http://www.w3.org/2000/svg' ? c.fill : c.color), up: c.textTransform === 'uppercase', txt: e.textContent.trim().slice(0, 30) });
    });
    const segs = [...svg.querySelectorAll('polyline.pen-seg')].map((p) => ({ st: p.getAttribute('data-st'), c: rgb(getComputedStyle(p).stroke), ys: p.getAttribute('points').trim().split(/\s+/).map((q) => +q.split(',')[1]) }));
    const hLine = svg.querySelector('line[data-limit="hi_warn"]'), yH = hLine ? +hLine.getAttribute('y1') : null;
    const ticks = [...svg.querySelectorAll('text.ax[data-y]')].map((t) => +t.getAttribute('data-y'));
    const sd = {}; panel.querySelectorAll('.rz-trend-stats [data-s]').forEach((d) => { sd[d.getAttribute('data-s')] = d.textContent; });
    const statBoxes = [...panel.querySelectorAll('.rz-trend-stats *')].filter((e) => parseFloat(getComputedStyle(e).borderLeftWidth) > 0 || parseFloat(getComputedStyle(e).borderTopWidth) > 0).length;
    const vis = (e) => e.offsetParent !== null && !e.closest('svg') && !e.closest('[hidden]') && !e.closest('.rz-trend-scroll') && getComputedStyle(e).visibility !== 'hidden';
    let words = 0; const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) { const p = n.parentElement; if (p && vis(p) && !p.closest('.rz-trend-tip') && !p.closest('select') && !p.closest('.rz-trend-ranges')) words += (n.textContent.match(/[A-Za-z]{2,}/g) || []).length; }
    const info = panel.querySelector('.rz-trend-info'), tip = panel.querySelector('.rz-trend-tip');
    const now = svg.querySelector('circle.now'), head = panel.querySelector('.rz-trend-head');
    const tt = [...head.querySelectorAll('.rz-trend-val,.rz-trend-stw,#rz-trend-title')].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return (r.top + r.bottom) / 2; }).sort((a, b) => a - b);
    const tops = { size: tt.reduce((n, y, i) => n + (i === 0 || y - tt[i - 1] > 10 ? 1 : 0), 0) };   /* text lines by centre, 10 px tolerance */
    return { T, painted, texts, segs, yH, ticks, sd, statBoxes, words, info: !!info, tip: tip ? tip.textContent : '', tipOpen: !!(tip && tip.getClientRects().length), edges: [...svg.querySelectorAll('.llab.edge')].map((t) => [t.getAttribute('data-limit'), +t.getAttribute('y')]), now: now ? rgb(getComputedStyle(now).fill) : null,
      headState: panel.querySelector('.rz-trend-stw').getAttribute('data-tr-state'), headLines: tops.size, sideways: panel.scrollWidth > panel.clientWidth + 1, wide: [...panel.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > panel.getBoundingClientRect().right + 1 && e.getClientRects().length).slice(0, 4).map((e) => (e.getAttribute('class') || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().right)),
      bands: [...svg.querySelectorAll('rect[data-band]')].map((r) => r.getAttribute('data-band')), slots: window.RZTrend.slots ? window.RZTrend.slots() : null };
  });
  const near = (c, set) => set.some((s) => s && c && dE(c, s) < 3);
  const chromaticOK = [m.T.ok, m.T.warn, m.T.alarm, m.T.acc];
  const offHue = m.painted.filter((p) => p.c && chroma(p.c) > 0.03 && !near(p.c, chromaticOK));
  ok(offHue.length === 0, 'D1', `${tag} ${offHue.length} painted marks off the palette (ink, mute, grid, accent, state tokens): ${offHue.slice(0, 3).map((p) => p.cls + ' ' + p.k + ' rgb(' + p.c + ')').join(' | ')}`);
  const stText = m.texts.filter((t) => near(t.c, [m.T.ok, m.T.warn, m.T.alarm]) && !/rz-trend-val|rz-trend-stw/.test(t.cls));
  ok(stText.length === 0, 'D2', `${tag} ${stText.length} text nodes wear a state colour: ${stText.slice(0, 4).map((t) => t.txt).join(' | ')}`);
  const washes = m.painted.filter((p) => p.k === 'fill' && /rect|path|polygon/i.test(p.tag) && !/pen-band|rib/.test(p.cls) && (p.op > 0.061 || chroma(p.c) > 0.03));
  ok(washes.length === 0 && !m.bands.some((b) => b !== 'ok'), 'D3', `${tag} washes ${washes.length} (${washes.slice(0, 2).map((p) => p.cls + ' op ' + p.op.toFixed(2)).join(' | ')}), bands ${m.bands.join(',')}`);
  const dashed = m.painted.filter((p) => p.k === 'stroke' && p.dash && p.dash !== 'none' && !/pen-now/.test(p.cls));
  ok(dashed.length === 0, 'D4', `${tag} ${dashed.length} dashed strokes: ${[...new Set(dashed.map((p) => p.cls))].join(', ')}`);
  const tokOf = { ok: m.T.ink, warn: m.T.warn, alarm: m.T.alarm };
  const badSeg = m.segs.filter((s) => !s.c || dE(s.c, tokOf[s.st]) > 3 || (m.yH !== null && s.st === 'warn' && s.ys.slice(1, -1).some((y) => y > m.yH + 0.6)) || (m.yH !== null && s.st === 'ok' && s.ys.slice(1, -1).some((y) => y < m.yH - 0.6)));
  ok(m.segs.some((s) => s.st === 'warn') && m.segs.some((s) => s.st === 'ok') && badSeg.length === 0, 'D5', `${tag} pen segments ${m.segs.map((s) => s.st).join(',') || 'none'}; ${badSeg.length} wrong (colour or side of H)`);
  const span = m.ticks.length ? Math.max(...m.ticks) - Math.min(...m.ticks) : Infinity, dmin = parseFloat(m.sd.min), dmax = parseFloat(m.sd.max), step = m.ticks.length > 1 ? m.ticks[1] - m.ticks[0] : 0;
  const niceStep = step > 0 && [1, 2, 2.5, 5].some((k) => Math.abs(step / 10 ** Math.floor(Math.log10(step)) - k) < 1e-6) && m.ticks.every((t) => Math.abs(t / step - Math.round(t / step)) < 1e-6);
  ok(span <= 1.6 * (dmax - dmin) + step && niceStep, 'D6', `${tag} y ticks ${m.ticks.join(',') || 'none (no data-y)'} for data ${dmin}–${dmax}: span ${span}, nice ${niceStep}`);
  ok(!m.texts.some((t) => t.up) && m.statBoxes === 0 && ['min', 'max', 'mean', 'warn', 'alarm', 'excursions'].every((k) => m.sd[k]), 'D7', `${tag} uppercase ${m.texts.filter((t) => t.up).length}, boxed stat cells ${m.statBoxes}, stats ${Object.keys(m.sd).join(',')}`);
  ok(m.words <= 30 && m.info && /SIMULATED|Simulated/.test(m.tip) && /Limits ASSUMED/.test(m.tip), 'D8', `${tag} visible words ${m.words} (≤ 30), ⓘ ${m.info}, tooltip "${m.tip.slice(0, 80)}"`);
  ok(!m.tipOpen, 'D8', `${tag} the ⓘ tooltip is open at rest (it covers the header and the tools)`);
  const eo = Object.fromEntries(m.edges), okOrder = !(('lo_warn' in eo) && ('lo_alarm' in eo)) || eo.lo_warn < eo.lo_alarm;
  ok(okOrder, 'D9', `${tag} edge markers below the range read L above LL: ${JSON.stringify(m.edges)}`);
  ok(m.now && dE(m.now, /warn|alarm/.test(m.headState) ? m.T[m.headState] : m.T.ink) < 3, 'D11', `${tag} now marker ${m.now ? 'rgb(' + m.now + ')' : 'missing'} vs head state ${m.headState}`);
  if (width < 600) ok(m.headLines <= 2 && !m.sideways, 'D12', `${tag} header lines ${m.headLines} (≤ 2), sideways ${m.sideways} ${m.wide.join(' | ')}`);
  if (width > 600 && theme === 'dark') {
    const sl = m.slots || [];
    const bad = [];
    sl.forEach((c, i) => { const r = c.match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16)); [m.T.ok, m.T.warn, m.T.alarm].forEach((s) => { if (dE(r, s) < 15) bad.push(`slot ${i + 2} ${c} ΔE ${dE(r, s).toFixed(1)} to a state`); }); if (i) { const q = sl[i - 1].match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16)); if (dE(r, q) < 15) bad.push(`slots ${i + 1}/${i + 2} ΔE ${dE(r, q).toFixed(1)}`); } });
    ok(sl.length >= 2 && bad.length === 0, 'D10', `compare slots ${sl.join(' ') || 'not exposed'}: ${bad.join(' | ') || 'ok'}`);
  }
  if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `td-1D-${width}-${theme}.png`) });
  await pg.keyboard.press('Escape'); await sleep(300);
  ok(pg.__errs.length === 0, 'D13', `${tag} page errors: ${pg.__errs[0]}`);
  await pg.close();
}

/* L12 (OD-8): the time axis, the read line and the cursor are the VIEWER's local time and name the zone.
   Emulated Asia/Jakarta (UTC+7, no DST): hour ticks = local HH:MM of their instant, day ticks sit on local
   midnight, the read line names "GMT+7" and never "UTC". */
{
  const pg = await browser.newPage();
  await pg.emulateTimezone('Asia/Jakarta');
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('theme', 'dark'); sessionStorage.clear(); } catch (e) { /* none */ } });
  await pg.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await pg.goto(O + FIX, { waitUntil: 'load' });
  await pg.evaluate((c) => { window.RZTrend.now = () => c; }, CLOCK);
  const OFF = 7 * 3600000, pad = (n) => String(n).padStart(2, '0');
  for (const rg of ['8H', '7D']) {
    await pg.evaluate((id, r) => { window.RZTrend.open(id, { range: r }); }, PTS.warn.id, rg); await sleep(400);
    const a = await pg.evaluate(() => ({
      ticks: [...document.querySelectorAll('.rz-trend-plot text.ax[data-t]')].map((t) => [+t.getAttribute('data-t'), t.textContent]),
      read: document.querySelector('.rz-trend-read').textContent }));
    ok(a.ticks.length >= 2, 'L12', `${rg} time ticks carry data-t: ${a.ticks.length}`);
    for (const [t, lab] of a.ticks) {
      const L = new Date(t + OFF);
      const want = rg === '8H' ? `${pad(L.getUTCHours())}:${pad(L.getUTCMinutes())}` : `${L.getUTCMonth() + 1}/${L.getUTCDate()}`;
      ok(lab === want, 'L12', `${rg} tick ${new Date(t).toISOString()} label "${lab}" (want local "${want}")`);
      if (rg === '7D') ok((t + OFF) % 86400000 === 0, 'L12', `7D tick ${new Date(t).toISOString()} not on a Jakarta midnight`);
    }
    ok(/GMT\+7/.test(a.read) && !/UTC/.test(a.read), 'L12', `${rg} read line names the viewer's zone: "${a.read}"`);
    await pg.keyboard.press('Escape'); await sleep(300);
  }
  await pg.close();
}

/* L13 (PRD-SETPOINT-SIM P1): a reference line's label ("SP 26.0") is muted ink in the right gutter and its box meets no
   limit label's box — planted at the H limit value, the worst case, where the naive spot is the H label's own row */
{
  const pg = await browser.newPage();
  await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('theme', 'dark'); sessionStorage.clear(); } catch (e) { /* none */ } });
  await pg.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await pg.goto(O + FIX, { waitUntil: 'load' });
  await pg.evaluate((c) => { window.RZTrend.now = () => c; }, CLOCK);
  const r = await pg.evaluate((src) => {
    const L = window.RZPointStatus.limits(src), sp = L.hi_warn;
    window.RZPointStatus.define('test.sp_at_h', { lo_alarm: L.lo_alarm, lo_warn: L.lo_warn, hi_warn: L.hi_warn, hi_alarm: L.hi_alarm, deadband: L.deadband, basis: 'gate fixture', evidenceClass: 'ASSUMED', source: { ref: 'tools/test-conv-trend-ranges.mjs' } });
    window.RZTrend.register([{ id: 'test.sp_at_h', label: 'SP at H', unit: L.unit || '°C', base: sp - 0.4, amp: 0.3, digits: 1, shape: 'load', cls: 'SIM', group: 'Points', ref: sp, refLabel: 'SP ' + sp.toFixed(1) }]);
    window.RZTrend.open('test.sp_at_h', { range: '1H' });
    const lab = document.querySelector('.rz-trend-plot [data-ref-label="test.sp_at_h"]');
    if (!lab) return { lab: null };
    const box = (e) => { const b = e.getBBox(); return [b.x, b.y, b.x + b.width, b.y + b.height]; };
    const B = box(lab), hit = [...document.querySelectorAll('.rz-trend-plot text.llab')].filter((t) => { const o = box(t); return o[0] < B[2] && B[0] < o[2] && o[1] < B[3] && B[1] < o[3]; }).map((t) => t.textContent);
    const ll = document.querySelector('.rz-trend-plot text.llab');
    return { lab: lab.textContent, hit, fill: getComputedStyle(lab).fill, mute: ll ? getComputedStyle(ll).fill : null, want: 'SP ' + sp.toFixed(1) };
  }, PTS.warn.id);
  ok(r.lab === r.want, 'L13', `reference label "${r.lab}" (want "${r.want}")`);
  ok(r.lab && r.hit.length === 0, 'L13', `reference label box meets limit label(s) ${JSON.stringify(r.hit)}`);
  ok(r.lab && r.fill === r.mute, 'L13', `reference label fill ${r.fill} is not the muted label ink ${r.mute}`);
  await pg.close();
}

await browser.close(); srv.close();
if (fails.length) {
  console.log(`CONV TREND RANGES — FAIL (${fails.length} of ${fails.length + passes})${PLANT ? ' [plant ' + PLANT + ']' : ''}`);
  fails.slice(0, 40).forEach((f) => console.log('  ' + f));
  process.exit(1);
}
console.log(`CONV TREND RANGES — PASS (${passes} checks: open click/Enter/tap, 5 ranges window+samples+stats, last point = page value, header state = page state, bands = registry, keys 1–5, Esc + focus, 390 sheet 88 % 44 px no sideways scroll, #r=24h -> 1D, contrast both themes, 0 errors)`);
