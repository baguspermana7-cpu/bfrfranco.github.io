#!/usr/bin/env node
/* test-conv-floor-plan.mjs — STRICT. The data hall floor plan has depth and its colours mean one thing each
   (PRD-CONV-DATAHALL-FLOOR §6). Computed values in a real browser, in both themes; every law names its measurement.
   FL1  0 stage elements paint a gradient (CSS background / border-image / SVG paint server)
   FL2  every cabinet top-face fill is one of the discrete state steps of the theme (none for spare), <= 9 distinct in any
        mode; the steps are OKLCH lightness steps of the state token (L per PRD 3.2, hue of the token)
   FL3  default NORMAL scenario: in Power, Temp and Cooling-margin every occupied cabinet is in the ok (green) family
   FL4  a planted 0.97 cabinet is alarm in Power mode and a 28 C inlet is warn in Temp mode (fixture seam only)
   FL5  cabinet height in px is monotonic in kW (Spearman = 1); spare cabinets have height 0
   FL6  0 painted colours in the stage in the cyan family (OKLCH hue 180-245, chroma > 0.06)
   FL7  no text is in a state token colour or a chromatic series colour, except a state word with a glyph
   FL8  no animation, glow (box-shadow blur, text-shadow, filter) on any stage element
   FL9  25 hot-aisle caps, the installed CRAH count, a floor slab and a wall of 2 edges
   FL10 <= 30 visible numbers in the plan area at 1440, in every mode
   FL11 390 px: no page-level sideways scroll; cabinet unit u >= 7 px in a scroller; row panel opens, 44 px targets
   FX1-FX5 (fixture seam): paint never changes the node tree; hover tooltip; click callbacks; keyboard arrows + Enter;
        selection is amber
   Usage: node tools/test-conv-floor-plan.mjs [--target=<url|file>] [--shots=<dir>] [--only=FL1,FL2] [--all]
   Default target = tools/fixtures/floor-plan.html. A datahall.html target is entered through the cockpit audit helper. */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (n) => (process.argv.find((a) => a.startsWith('--' + n + '=')) || '').split('=').slice(1).join('=');
const TARGET = arg('target') || 'tools/fixtures/floor-plan.html';
const SHOTS = arg('shots');
const ONLY = arg('only') ? arg('only').split(',') : null;
const MODES = ['power', 'temp', 'cooling-margin', 'alarms', 'space'];
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
});
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const URL_ = /^https?:/.test(TARGET) ? TARGET : ORIGIN + path.relative(ROOT, path.resolve(ROOT, TARGET)).split(path.sep).join('/');
const IS_PAGE = /datahall\.html/.test(TARGET);
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SETTLE = IS_PAGE ? 800 : 120; // datahall.html transitions background colours: read the settled value, not a frame of it

const results = {}; // law -> { pass, notes: [] }
const law = (id) => (results[id] = results[id] || { pass: true, notes: [], na: false });
const check = (id, cond, msg) => { if (ONLY && !ONLY.includes(id.replace(/[a-z]$/, ''))) return; const l = law(id); if (!cond) { l.pass = false; l.notes.push(msg); } };
const info = (id, msg) => { law(id).notes.push('(info) ' + msg); };
const na = (id, why) => { const l = law(id); l.na = true; l.notes.push(why); };

/* ---------- in-page helpers (installed once per page) ---------- */
function installHelpers() {
  const g = (window.__g = {});
  g.rgba = (s) => {
    s = String(s || '');
    let m = /^rgba?\(([^)]+)\)/.exec(s);
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    m = /^color\(srgb ([^)]+)\)/.exec(s);
    if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; }
    return null;
  };
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  g.oklch = (c) => {
    const r = lin(c.r), gg = lin(c.g), b = lin(c.b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * gg + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * gg + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * gg + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    const h = Math.atan2(bb, a) * 180 / Math.PI;
    return { L, C: Math.hypot(a, bb), h: h < 0 ? h + 360 : h };
  };
  g.hex = (hx) => { const n = parseInt(hx.slice(1), 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }; };
  g.rgbStr = (c) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
  g.family = (c) => {
    const o = g.oklch(c);
    if (o.C < 0.025) return 'neutral';
    if (o.h >= 105 && o.h < 190) return 'ok';
    if (o.h >= 55 && o.h < 105) return 'warn';
    if (o.h < 55 || o.h >= 330) return 'alarm';
    return 'other';
  };
  g.isCyan = (c) => { const o = g.oklch(c); return c.a >= 0.05 && o.C > 0.06 && o.h >= 180 && o.h <= 245; };
  g.scope = () => {
    const roots = [...document.querySelectorAll('.mode-bar, .floor, .fp-panel, .fp-tip, #tooltip')];
    const set = new Set();
    roots.forEach((r) => { set.add(r); r.querySelectorAll('*').forEach((e) => set.add(e)); });
    return [...set];
  };
  g.plan = () => {
    const roots = [...document.querySelectorAll('.mode-bar, .floor')];
    const set = new Set();
    roots.forEach((r) => { set.add(r); r.querySelectorAll('*').forEach((e) => set.add(e)); });
    return [...set];
  };
  g.rendered = (e) => {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  };
  g.ownText = (e) => [...e.childNodes].filter((n) => n.nodeType === 3 && n.nodeValue.trim()).map((n) => n.nodeValue.trim()).join(' ');
  g.tag = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : (e.className && e.className.baseVal ? '.' + e.className.baseVal.trim().split(/\s+/).join('.') : ''));
  g.paints = (e) => {
    const cs = getComputedStyle(e), out = [], isSvg = e instanceof SVGElement;
    if (isSvg) {
      if (cs.fill !== 'none' && +cs.fillOpacity > 0.05) out.push(['fill', cs.fill]);
      if (cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0 && +cs.strokeOpacity > 0.05) out.push(['stroke', cs.stroke]);
    } else {
      out.push(['background', cs.backgroundColor]);
      ['Top', 'Right', 'Bottom', 'Left'].forEach((s) => { if (cs['border' + s + 'Style'] !== 'none' && parseFloat(cs['border' + s + 'Width']) > 0) out.push(['border-' + s, cs['border' + s + 'Color']]); });
      if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) out.push(['outline', cs.outlineColor]);
    }
    return out;
  };
  g.textColor = (e) => { const cs = getComputedStyle(e); return e instanceof SVGElement ? cs.fill : cs.color; };
  g.setMode = (m) => { if (typeof window.setMode === 'function') window.setMode(m); else document.querySelector(`.mode-btn[data-mode="${m}"]`).click(); };
  g.rkVal = (rk) => { const v = rk.querySelector('.rk-val'); return v ? v.textContent.trim() : ''; };
  g.occupied = (rk) => { const v = g.rkVal(rk); return /\d/.test(v) || v === 'IT'; };
  g.topFill = (rk) => { const t = rk.querySelector('.rk-top'); return t ? getComputedStyle(t).fill : getComputedStyle(rk).backgroundColor; };
}

async function openPage(W, theme) {
  const pg = await browser.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await pg.setViewport({ width: W, height: W > 800 ? 1000 : 844 });
  await primeCockpitAuditDocument(pg, theme);
  await pg.goto(URL_, { waitUntil: 'load', timeout: 120000 });
  if (IS_PAGE) { await enterAuthorizedAuditState(pg, 'datahall'); await sleep(2500); }
  await pg.waitForFunction(() => document.querySelectorAll('.rack').length >= 400, { timeout: 60000 });
  await pg.evaluate(installHelpers);
  return { pg, errs };
}
const setMode = (pg, m) => pg.evaluate((mm) => { window.__g.setMode(mm); }, m);

function spearman(xs, ys) {
  const rank = (a) => { const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = new Array(a.length); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const rk = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = rk; i = j + 1; } return r; };
  const rx = rank(xs), ry = rank(ys), n = xs.length, mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

const timing = {};
for (const theme of ['dark', 'light']) {
  const { pg, errs } = await openPage(1440, theme);
  const T = `1440 ${theme}`;
  const fixture = await pg.evaluate(() => !!(window.__fp && window.RZFloorPlan));
  info('FL0', `target ${URL_} fixture-seam=${fixture}`);

  /* select a cabinet + a row and hover another, so the selection and tooltip colours are in the measured stage */
  const pick = await pg.evaluate(() => { const r = document.querySelector('.rack[data-idx="45"]'); const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await pg.mouse.click(pick.x, pick.y);
  await sleep(300);
  const pick2 = await pg.evaluate(() => { const r = document.querySelector('.rack[data-idx="187"]'); const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await pg.mouse.move(pick2.x, pick2.y);
  await sleep(150);

  /* FL1 / FL2 / FL3 / FL10 across modes */
  const perMode = {};
  for (const m of MODES) {
    await setMode(pg, m);
    await sleep(SETTLE);
    perMode[m] = await pg.evaluate(() => {
      const g = window.__g, sc = g.scope(), out = { grad: [], tops: [], numbers: 0, numberSamples: [] };
      sc.forEach((e) => {
        const cs = getComputedStyle(e);
        if (/gradient/.test(cs.backgroundImage) || /gradient/.test(cs.borderImageSource) || /gradient/.test(cs.maskImage || '') || /url\(/.test(cs.fill) || /url\(/.test(cs.stroke)) out.grad.push(g.tag(e));
        ['::before', '::after'].forEach((p) => { const ps = getComputedStyle(e, p); if (ps.content !== 'none' && /gradient/.test(ps.backgroundImage)) out.grad.push(g.tag(e) + p); });
        if (/^(lineargradient|radialgradient|conicgradient|pattern)$/i.test(e.tagName)) out.grad.push(g.tag(e));
      });
      document.querySelectorAll('.floor .rack, .mode-bar .rack').forEach((rk) => {
        out.tops.push({ occ: g.occupied(rk), fill: g.topFill(rk), val: g.rkVal(rk) });
      });
      const walk = (root) => {
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = w.nextNode())) {
          const t = n.nodeValue; if (!/\d/.test(t)) continue;
          if (n.parentElement.closest('.fp-tip, #tooltip')) continue; // a hover tooltip is on demand, not part of the plan
          const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect(); const pe = n.parentElement; const cs = getComputedStyle(pe), pr = pe.getBoundingClientRect();
          if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || r.width <= 1.5 || r.height <= 1.5 || pr.width <= 1.5 || pr.height <= 1.5) continue;
          const c = (t.match(/\d+(?:\.\d+)?/g) || []).length; out.numbers += c; if (out.numberSamples.length < 3) out.numberSamples.push(t.trim().slice(0, 24));
        }
      };
      document.querySelectorAll('.mode-bar, .floor').forEach(walk);
      return out;
    });
  }
  let maxNums = 0, maxMode = '';
  for (const m of MODES) {
    const d = perMode[m];
    check('FL1', d.grad.length === 0, `${T} ${m}: ${d.grad.length} gradient paint(s), e.g. ${d.grad.slice(0, 3).join(' | ')}`);
    if (d.numbers > maxNums) { maxNums = d.numbers; maxMode = m; }
  }
  check('FL10', maxNums <= 30, `${T}: up to ${maxNums} visible numbers in the plan area (mode ${maxMode}, e.g. ${perMode[maxMode].numberSamples.join(', ')})`);
  info('FL10', `${T} max visible numbers ${maxNums} (${maxMode})`);

  /* FL2: allowed set from the module's own palette, and the OKLCH design of that palette */
  const pal = await pg.evaluate(() => {
    if (!window.RZFloorPlan) return null;
    const g = window.__g, p = RZFloorPlan.palette(), rs = getComputedStyle(document.documentElement);
    const tok = {}; ['ok', 'warn', 'alarm'].forEach((s) => { tok[s] = g.oklch(g.rgba(g.rgbStr(g.hex((rs.getPropertyValue('--rz-pt-' + s)).trim())))); });
    const tops = []; Object.keys(p).forEach((s) => p[s].top.forEach((hx) => tops.push(g.rgbStr(g.hex(hx)))));
    const L = {}; Object.keys(p).forEach((s) => { L[s] = { top: p[s].top.map((h) => g.oklch(g.hex(h))), front: g.oklch(g.hex(p[s].front)), side: g.oklch(g.hex(p[s].side)) }; });
    return { tops, L, tok, face: RZFloorPlan.FACE_L, mag: RZFloorPlan.MAG_DL,
      drawn: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark' };
  });
  const allowed = new Set(pal ? pal.tops : []);
  for (const m of MODES) {
    const fills = new Set();
    let off = 0, spareBad = 0, offSample = '';
    perMode[m].tops.forEach((t) => {
      if (!t.occ) { if (!(t.fill === 'none' || /^rgba\(0, 0, 0, 0\)$/.test(t.fill))) spareBad++; return; }
      fills.add(t.fill);
      if (!allowed.has(t.fill)) { off++; if (!offSample) offSample = t.fill; }
    });
    check('FL2', off === 0 && spareBad === 0, `${T} ${m}: ${off} cabinet(s) off the discrete steps (e.g. ${offSample}), ${spareBad} spare cabinet(s) filled`);
    check('FL2', fills.size <= 9, `${T} ${m}: ${fills.size} distinct cabinet fills (> 9)`);
    info('FL2', `${T} ${m}: ${fills.size} distinct fills`);
  }
  /* The palette is judged against the theme the page actually drew in. A dark-only page (datahall.html never sets
     data-theme) draws the dark palette in the light run too; that is correct, not drift. The fixture sets data-theme,
     so the light palette is still proven there. */
  if (pal && pal.drawn !== theme) info('FL2', `${T}: page draws in ${pal.drawn} (no ${theme} theme on this page)`);
  if (pal) {
    for (const s of ['ok', 'warn', 'alarm']) {
      const L = pal.L[s], th = pal.drawn, fl = pal.face[th], tok = pal.tok[s];
      L.top.forEach((o, i) => check('FL2', Math.abs(o.L - (fl.top + pal.mag[i])) < 0.012, `${T} ${s} top step ${i + 1}: OKLCH L ${o.L.toFixed(3)} expected ${(fl.top + pal.mag[i]).toFixed(2)}`));
      check('FL2', Math.abs(L.front.L - fl.front) < 0.012 && Math.abs(L.side.L - fl.side) < 0.012, `${T} ${s} front/side L ${L.front.L.toFixed(3)}/${L.side.L.toFixed(3)} expected ${fl.front}/${fl.side}`);
      [L.front, L.side, ...L.top].forEach((o) => { const dh = Math.abs(((o.h - tok.h + 540) % 360) - 180); check('FL2', dh < 8, `${T} ${s} hue ${o.h.toFixed(0)} vs token ${tok.h.toFixed(0)}`); });
      check('FL2', L.top[1].L > L.front.L && L.front.L > L.side.L, `${T} ${s} faces not top > front > side`);
    }
  } else check('FL2', false, `${T}: no RZFloorPlan palette on this target (cabinet fills cannot be one of discrete steps)`);

  /* FL3 */
  for (const m of ['power', 'temp', 'cooling-margin']) {
    await setMode(pg, m); await sleep(SETTLE);
    const fam = await pg.evaluate((mm) => { const g = window.__g, c = { ok: 0, warn: 0, alarm: 0, neutral: 0, other: 0, n: 0 }; document.querySelectorAll('.floor .rack').forEach((rk) => { if (!g.occupied(rk)) return; c.n++; c[g.family(g.rgba(g.topFill(rk)))]++; }); return c; }, m);
    check('FL3', fam.n > 400 && fam.ok === fam.n, `${T} ${m}: ${fam.n} occupied, ok ${fam.ok}, warn ${fam.warn}, alarm ${fam.alarm}, neutral ${fam.neutral}, other ${fam.other}`);
  }
  if (fixture) {
    const w = await pg.evaluate(() => window.__fp.warnings());
    check('FL3', w === 0, `${T}: status strip reports ${w} warnings`);
  }

  /* FL4: planted cabinets, fixture seam only */
  if (fixture) {
    const r4 = await pg.evaluate(() => {
      const fp = window.__fp, g = window.__g, mdl = fp.model;
      const idx = mdl.racks.findIndex((r, i) => r.occupied && i >= 60 && (i % 20) % 10 > 2 && (i % 20) % 10 < 7);
      const old = { kw: mdl.racks[idx].kw, util: mdl.racks[idx].util }, z = Math.floor(idx / 20), oldIn = mdl.zones[z].rackInletC;
      mdl.racks[idx].kw = 19.4; mdl.racks[idx].util = 0.97; g.setMode('power');
      const fPower = g.family(g.rgba(g.topFill(document.querySelector(`.rack[data-idx="${idx}"]`))));
      mdl.zones[z].rackInletC = 28; g.setMode('temp');
      const fTemp = g.family(g.rgba(g.topFill(document.querySelector(`.rack[data-idx="${idx}"]`))));
      const neighbour = g.family(g.rgba(g.topFill(document.querySelector(`.rack[data-idx="${idx === 0 ? 1 : 0}"]`))));
      mdl.racks[idx].kw = old.kw; mdl.racks[idx].util = old.util; mdl.zones[z].rackInletC = oldIn; g.setMode('temp');
      return { fPower, fTemp, neighbour };
    });
    check('FL4', r4.fPower === 'alarm', `${T}: util 0.97 in Power mode is ${r4.fPower}`);
    check('FL4', r4.fTemp === 'warn', `${T}: inlet 28 C in Temp mode is ${r4.fTemp}`);
  } else na('FL4', 'no model seam on this target (passes today per PRD, not measured here)');

  /* FL5 */
  await setMode(pg, 'power');
  const hs = await pg.evaluate(() => {
    const g = window.__g, out = [];
    document.querySelectorAll('.floor .rack').forEach((rk) => {
      const kw = rk.getAttribute('data-kw') != null ? parseFloat(rk.getAttribute('data-kw')) : (parseFloat(g.rkVal(rk)) || 0);
      const f = rk.querySelector('.rk-front');
      const h = f ? (getComputedStyle(f).display === 'none' ? 0 : f.getBoundingClientRect().height) : rk.getBoundingClientRect().height;
      out.push({ kw, h });
    });
    return out;
  });
  const occ = hs.filter((x) => x.kw > 0), spare = hs.filter((x) => x.kw === 0);
  const rho = spearman(occ.map((x) => x.kw), occ.map((x) => x.h));
  check('FL5', rho >= 0.9999, `${T}: Spearman ${Number.isNaN(rho) ? 'undefined (all cabinet heights equal: flat cells)' : rho.toFixed(4)} over ${occ.length} occupied`);
  check('FL5', spare.length > 0 && spare.every((x) => x.h === 0), `${T}: ${spare.filter((x) => x.h !== 0).length} of ${spare.length} spare cabinets have height > 0`);
  info('FL5', `${T} rho ${Number.isNaN(rho) ? 'NaN' : rho.toFixed(4)}`);

  /* FL6 / FL7 / FL8 on the stage with selection + hover present */
  const fl = await pg.evaluate(() => {
    window.__g.setMode('temp');
    const g = window.__g, rs = getComputedStyle(document.documentElement), tokens = ['ok', 'warn', 'alarm'].map((s) => g.rgba(g.rgbStr(g.hex(rs.getPropertyValue('--rz-pt-' + s).trim() || '#000000'))));
    const o = { cyan: [], text: [], anim: [], glow: [], n: 0 };
    g.scope().forEach((e) => {
      if (!g.rendered(e)) return;
      o.n++;
      g.paints(e).forEach(([k, v]) => { const c = g.rgba(v); if (c && g.isCyan(c)) o.cyan.push(`${g.tag(e)} ${k} ${v}`); });
      const own = g.ownText(e);
      const cs = getComputedStyle(e);
      if (own) {
        const c = g.rgba(g.textColor(e)); const t = own.length > 20 ? own.slice(0, 20) : own;
        if (c) {
          if (g.isCyan(c)) o.cyan.push(`${g.tag(e)} text ${g.textColor(e)}`);
          const chromatic = g.oklch(c).C > 0.06, isTok = tokens.some((k) => Math.abs(k.r - c.r) < 2 && Math.abs(k.g - c.g) < 2 && Math.abs(k.b - c.b) < 2);
          if ((chromatic || isTok) && !/[▲▼◆]/.test(own)) o.text.push(`${g.tag(e)} "${t}" ${g.textColor(e)}`);
        }
      }
      ['', '::before', '::after'].forEach((ps) => {
        const s = ps ? getComputedStyle(e, ps) : cs;
        if (ps && s.content === 'none') return;
        if (s.animationName !== 'none' && parseFloat(s.animationDuration) > 0) o.anim.push(`${g.tag(e)}${ps} ${s.animationName}`);
        if (s.boxShadow !== 'none') { const body = s.boxShadow.replace(/rgba?\([^)]*\)|color\([^)]*\)/g, ' '); const nums = (body.match(/-?[\d.]+px/g) || []).map(parseFloat); if (nums[2] > 0) o.glow.push(`${g.tag(e)}${ps} box-shadow ${s.boxShadow.slice(0, 50)}`); }
        if (s.textShadow !== 'none') o.glow.push(`${g.tag(e)}${ps} text-shadow`);
        if (s.filter !== 'none') o.glow.push(`${g.tag(e)}${ps} filter ${s.filter}`);
      });
    });
    return o;
  });
  check('FL6', fl.cyan.length === 0, `${T}: ${fl.cyan.length} cyan paint(s): ${fl.cyan.slice(0, 4).join(' | ')}`);
  check('FL7', fl.text.length === 0, `${T}: ${fl.text.length} coloured text node(s): ${fl.text.slice(0, 4).join(' | ')}`);
  check('FL8', fl.anim.length === 0 && fl.glow.length === 0, `${T}: ${fl.anim.length} animated, ${fl.glow.length} glow element(s): ${fl.anim.concat(fl.glow).slice(0, 4).join(' | ')}`);
  info('FL6', `${T} scanned ${fl.n} rendered stage elements`);

  /* FL9 */
  const f9 = await pg.evaluate(() => {
    const g = window.__g;
    const crahExpected = window.__fp ? window.__fp.model.crahUnits.length : (window.CONV_CALC && window.CONV_CALC.snapshot ? window.CONV_CALC.snapshot.cooling.crah_installed : -1);
    const rows = document.querySelectorAll('.zone[data-z]').length;
    const vis = (sel) => [...document.querySelectorAll(sel)].filter((e) => g.rendered(e));
    return { caps: vis('.hot-cap').length, rows, crah: document.querySelectorAll('.crah-cell').length, crahExpected, slab: vis('.fp-slab').length, wall: vis('.fp-wall .wall-edge').length };
  });
  check('FL9', f9.caps === 25 && f9.caps === f9.rows, `${T}: ${f9.caps} hot-aisle caps (rows ${f9.rows})`);
  check('FL9', f9.crah > 0 && f9.crah === f9.crahExpected, `${T}: ${f9.crah} CRAH units, engine installed ${f9.crahExpected}`);
  check('FL9', f9.slab >= 1, `${T}: ${f9.slab} floor slab`);
  check('FL9', f9.wall >= 2, `${T}: ${f9.wall} wall edges (need 2)`);

  /* fixture seam: FX1-FX5 */
  if (fixture) {
    await setMode(pg, 'temp');
    const fx1 = await pg.evaluate(async () => {
      const svg = document.querySelector('.fp-svg'), count = () => svg.querySelectorAll('*').length, first = svg.querySelector('.rack'), n0 = count();
      const before = { n: n0, ids: [...svg.querySelectorAll('.rack')].map((x) => x.id).join() };
      ['power', 'temp', 'cooling-margin', 'alarms', 'space', 'temp'].forEach((m) => window.setMode(m));
      return { n0, n1: count(), same: svg.querySelector('.rack') === first && [...svg.querySelectorAll('.rack')].map((x) => x.id).join() === before.ids };
    });
    check('FX1', fx1.n0 === fx1.n1 && fx1.same, `${T}: node count ${fx1.n0} -> ${fx1.n1}, same nodes ${fx1.same}`);
    /* FX2 tooltip */
    const c2 = await pg.evaluate(() => { const r = document.querySelector('.rack[data-idx="203"] .rk-top').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await pg.mouse.move(5, 5); await pg.mouse.move(c2.x, c2.y); await sleep(120);
    const tip = await pg.evaluate(() => { const t = document.querySelector('.fp-tip'); return { vis: !t.hidden && t.offsetWidth > 0, text: t.textContent }; });
    check('FX2', tip.vis && /A-K/.test(tip.text) && /kW/.test(tip.text) && /inlet/.test(tip.text) && /Click for detail/.test(tip.text), `${T}: tooltip ${JSON.stringify(tip)}`);
    /* FX3 click callbacks */
    const clickEl = async (sel) => { const c = await pg.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel); await pg.mouse.click(c.x, c.y); return pg.evaluate(() => window.__fp.last); };
    const l1 = await clickEl('.rack[data-idx="203"] .rk-top');
    check('FX3', l1 && l1.kind === 'rack' && l1.id === 203, `${T}: rack click -> ${JSON.stringify(l1)}`);
    const l2 = await clickEl('.crah-cell[data-crah="7"] .cr-top');
    check('FX3', l2 && l2.kind === 'crah' && l2.id === 7, `${T}: CRAH click -> ${JSON.stringify(l2)}`);
    const l3 = await clickEl('.zone[data-z="3"] .zone-head');
    check('FX3', l3 && l3.kind === 'row' && l3.id === 3, `${T}: row click -> ${JSON.stringify(l3)}`);
    /* FX4 keyboard: focus starts at cabinet 0; Down -> j1 (idx 1); Right -> line R (idx 11); Enter */
    /* a rebuild while the plan has keyboard focus (a late ResizeObserver under load, or relayout) replaced the svg and
       dropped focus and cursor: v3.83.0 and v3.84.0 release gates read {last:null, ad:null}. relayout() here forces that
       rebuild on every run, so focus must survive it (red before the floor-plan.js fix, same reading). */
    await pg.evaluate(() => { window.__fp.last = null; window.__fp.plan.select(null); window.__fp.plan.focus(0); window.__fp.plan.relayout(); });
    await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('Enter');
    const kl = await pg.evaluate(() => ({ last: window.__fp.last, ad: document.querySelector('.fp-svg').getAttribute('aria-activedescendant') }));
    check('FX4', kl.last && kl.last.kind === 'rack' && kl.last.id === 11 && kl.ad === 'fp-rk-11', `${T}: keyboard -> ${JSON.stringify(kl)}`);
    await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('Enter');
    const kc = await pg.evaluate(() => window.__fp.last);
    check('FX4', kc && kc.kind === 'crah', `${T}: ArrowUp into the north gallery then Enter -> ${JSON.stringify(kc)}`);
    /* FX5 selection is amber */
    await pg.evaluate(() => window.__fp.plan.select({ rack: 45 }));
    const amb = await pg.evaluate(() => { const g = window.__g; const s = getComputedStyle(document.querySelector('.fp-ring-sel')); return { stroke: s.stroke, w: s.strokeWidth, acc: getComputedStyle(document.querySelector('.fp-root')).getPropertyValue('--fp-accent').trim(), disp: document.querySelector('.fp-ring-sel').getAttribute('display') }; });
    const want = theme === 'dark' ? 'rgb(232, 181, 99)' : 'rgb(122, 72, 0)';
    check('FX5', amb.stroke === want && parseFloat(amb.w) === 1.5 && amb.disp === null, `${T}: selection ring ${JSON.stringify(amb)} expected ${want} 1.5px`);
    if (theme === 'dark') {
      /* performance: render (script) and a paint over 5 modes, with and without a forced layout flush */
      const perf = await pg.evaluate(() => {
        const fp = window.__fp, M = ['power', 'temp', 'cooling-margin', 'alarms', 'space'], pl = fp.plan;
        const run = (flush) => { const t = performance.now(); M.forEach((m) => { pl.paint(m); if (flush) document.body.getBoundingClientRect(); }); return performance.now() - t; };
        run(false); const a = [], b = [];
        for (let i = 0; i < 5; i++) { a.push(run(false)); b.push(run(true)); }
        const med = (x) => x.sort((p, q) => p - q)[Math.floor(x.length / 2)];
        const tmp = document.createElement('div'); tmp.style.cssText = 'width:1408px;position:absolute;left:0;top:0;visibility:hidden'; document.body.appendChild(tmp);
        const t1 = performance.now(); const inst = RZFloorPlan.render(tmp, fp.model, { mode: 'temp', ids: { top: 'x-top', bottom: 'x-bot' } }); const rmsScript = performance.now() - t1; document.body.getBoundingClientRect(); const rmsFlush = performance.now() - t1;
        const nodes = tmp.querySelectorAll('svg *').length, uu = inst.u; inst.destroy(); tmp.remove(); const rmsFirst = rmsScript;
        return { renderMs: +rmsFirst.toFixed(1), renderMsWithLayout: +rmsFlush.toFixed(1), firstRenderOnPageMs: +fp.renderMs.toFixed(1), paint5ModesMs: +med(a).toFixed(1), paint5ModesWithLayoutMs: +med(b).toFixed(1), svgNodes: nodes, u: +uu.toFixed(2) };
      });
      timing.perf = perf;
    }
  } else for (const id of ['FX1', 'FX2', 'FX3', 'FX4', 'FX5']) na(id, 'fixture seam only');

  if (SHOTS) {
    for (const m of MODES) { await pg.evaluate((mm) => { window.__fp && window.__fp.plan.select(null); const p = document.querySelector('#row-panel'); if (p) p.hidden = true; window.__g.setMode(mm); }, m); await pg.mouse.move(2, 2); await sleep(200); const el = await pg.$('#fp-stage') || await pg.$('.floor'); await el.screenshot({ path: path.join(SHOTS, `${IS_PAGE ? 'dh' : 'fx'}-1440-${theme}-${m}.png`) }); }
  }
  if (SHOTS && fixture && theme === 'dark') {
    /* a planted hall: warn and alarm cabinets, one CRAH in warn, to look at the other two state families (not a law) */
    for (const m of ['power', 'temp']) {
      await pg.evaluate((mm) => {
        const mdl = window.__fp.model; window.__plantOld = window.__plantOld || { r: {}, z: {}, c: {} };
        [[64, 17.5], [65, 17.2], [66, 19.6], [121, 19.2], [150, 18.0], [151, 19.9], [152, 17.4]].forEach(([i, kw]) => { window.__plantOld.r[i] = window.__plantOld.r[i] || [mdl.racks[i].kw, mdl.racks[i].util, mdl.racks[i].occupied]; mdl.racks[i].kw = kw; mdl.racks[i].util = kw / 20; mdl.racks[i].occupied = true; });
        [[7, 28.0], [8, 31.0]].forEach(([z, t]) => { window.__plantOld.z[z] = window.__plantOld.z[z] == null ? mdl.zones[z].rackInletC : window.__plantOld.z[z]; mdl.zones[z].rackInletC = t; });
        mdl.crahUnits[4].status = 'warn'; mdl.crahUnits[40].status = 'alarm';
        window.__fp.plan.select(null); const p = document.querySelector('#row-panel'); if (p) p.hidden = true; window.__g.setMode(mm);
      }, m);
      await pg.mouse.move(2, 2); await sleep(250);
      await (await pg.$('#fp-stage')).screenshot({ path: path.join(SHOTS, `fx-1440-dark-planted-${m}.png`) });
    }
  }
  check('FL0', errs.length === 0, `${T} page errors: ${errs.slice(0, 3).join(' | ')}`);
  await pg.close();
}

/* ---------- FL11: 390 ---------- */
{
  const { pg, errs } = await openPage(390, 'dark');
  const T = '390 dark';
  const f = await pg.evaluate(async () => {
    const g = window.__g, de = document.documentElement;
    window.scrollTo(120, 0); await new Promise((r) => setTimeout(r, 100));
    const o = { docW: de.scrollWidth, vw: innerWidth, scrollX: window.scrollX };
    const root = document.querySelector('.fp-root');
    o.u = root ? parseFloat(root.getAttribute('data-u')) : (() => { const r = document.querySelector('.floor .rack'); return r ? r.getBoundingClientRect().width : 0; })();
    const sc = document.querySelector('.fp-scroll');
    o.scroller = sc ? { sw: sc.scrollWidth, cw: sc.clientWidth, ox: getComputedStyle(sc).overflowX } : null;
    const chip = document.querySelector('.row-chip[data-z="1"]');
    o.chip = chip ? (() => { const r = chip.getBoundingClientRect(); return { w: r.width, h: r.height }; })() : null;
    if (chip) {
      chip.click(); await new Promise((r) => setTimeout(r, 200));
      const p = document.querySelector('#row-panel');
      o.panel = p && !p.hidden && p.getBoundingClientRect().height > 0 ? { items: [...p.querySelectorAll('.rp-item')].map((i) => i.getBoundingClientRect().height) } : null;
    }
    return o;
  });
  check('FL11', f.docW <= f.vw + 1 && f.scrollX === 0, `${T}: page scrollWidth ${f.docW} vs ${f.vw}, scrollX after scrollTo(120) = ${f.scrollX}`);
  check('FL11', f.u >= 7, `${T}: cabinet unit u = ${f.u.toFixed(1)} px (need >= 7)`);
  check('FL11', !f.scroller || (f.scroller.sw > f.scroller.cw && /auto|scroll/.test(f.scroller.ox)), `${T}: plan scroller ${JSON.stringify(f.scroller)}`);
  check('FL11', !!f.chip && f.chip.w >= 44 && f.chip.h >= 44, `${T}: row chip ${JSON.stringify(f.chip)} (a 44 x 44 target is required)`);
  /* 0.01 px float tolerance: a row read while the panel's swap (PRD-CONV-BMS-MOTION M4) translates by a fraction measures 43.9999 */
  check('FL11', !!(f.panel && f.panel.items.length === 20 && f.panel.items.every((h) => h >= 44 - 0.01)), `${T}: row panel ${JSON.stringify(f.panel)} (20 rows of >= 44 px required)`);
  check('FL0', errs.length === 0, `${T} page errors: ${errs.slice(0, 3).join(' | ')}`);
  if (SHOTS) for (const m of MODES) { await pg.evaluate((mm) => { window.__fp && window.__fp.plan.select(null); const p = document.querySelector('#row-panel'); if (p) p.hidden = true; window.__g.setMode(mm); }, m); await sleep(150); const el = await pg.$('#fp-stage') || await pg.$('.floor'); await el.screenshot({ path: path.join(SHOTS, `${IS_PAGE ? 'dh' : 'fx'}-390-dark-${m}.png`) }); }
  await pg.close();
}

await browser.close();
srv.close();

const order = ['FL1', 'FL2', 'FL3', 'FL4', 'FL5', 'FL6', 'FL7', 'FL8', 'FL9', 'FL10', 'FL11', 'FX1', 'FX2', 'FX3', 'FX4', 'FX5', 'FL0'];
let failed = 0;
console.log(`target: ${URL_}`);
for (const id of order) {
  const l = results[id];
  if (!l || (ONLY && !ONLY.includes(id))) continue;
  if (l.na) { console.log(`${id} N/A   ${l.notes[0]}`); continue; }
  const fails = l.notes.filter((n) => !n.startsWith('(info)')), infos = l.notes.filter((n) => n.startsWith('(info)'));
  if (id === 'FL0') { if (!l.pass) { failed++; console.log(`${id} FAIL  ${fails[0]}`); } continue; }
  if (l.pass) console.log(`${id} PASS  ${infos.slice(0, 2).map((s) => s.replace('(info) ', '')).join('; ')}`);
  else { failed++; console.log(`${id} FAIL  ${fails.length} finding(s); first: ${fails[0]}`); if (process.argv.includes('--all')) fails.forEach((n) => console.log('       ' + n)); }
}
if (timing.perf) console.log('perf@1440 ' + JSON.stringify(timing.perf));
console.log(failed ? `RESULT: ${failed} law(s) failed` : 'RESULT: all laws pass');
process.exit(failed ? 1 : 0);
