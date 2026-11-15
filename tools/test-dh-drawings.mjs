#!/usr/bin/env node
/*
 * R128-R134 gate: datahallAI.html drawings, equipment modals and shell
 * (PRD documentation/prd/datahall-ai/PRD_DATAHALL_DRAWINGS.md §11).
 *
 *   node tools/test-dh-drawings.mjs [--page=datahallAI.html] [--only=H1,H5]   # exit 1 on any failed law (run under rz-lane)
 *
 * H1  no paint in any drawing or equipment modal except the renderer's own shading (.hmi-defs ids hmi-g-… and hmi-f-…, both themes)
 * H17 deep shading applies its filters per layer (<= 12 filtered elements per sheet), never per symbol — 599 per-node shadows cost 25-36 s per tab in headless
 * H16 no edge crosses a symbol body it does not end on (edges are routed by the RZ diagram engine, R147) — reported until the sweep lands
 * H15 shading: default deep, Shade button flips to flat and persists across reload; both modes 0 foreign paint
 * H2  every tagged equipment item is drawn from the shared symbol library (data-sym in RZ engineering META)
 * H3  every equipment class opens its OWN L3 modal (data-rz-modal-class = class) holding >= 8 library symbols
 * H4  every tagged item has an accessible name (aria-label or <title>) and is keyboard-focusable
 * H5  <= 8 words per sheet outside tags, values and line numbers (R144: PME/BMS screens carry no descriptive text)
 * H6  every sheet opens fit-to-width: no drawing wider than its frame, no sideways page scroll (1440 and 390)
 * H11 shell: no header control outside the nav bar, <= 6 visible actions in it, no "SIMULATED · ENGINE BASIS" text
 * H12 sidebar has pinned / auto-hide / hidden modes that survive a reload
 * H13 Room Layout and Rack Architecture draw on first open (non-zero box)
 * F1-F9 fire sheet DH-F-101: mounted, 12 zones, devices drawn = inventory, title + focus, no unknown state,
 *     no overlapping symbols, text budget + paint, no page overflow at 390, no console error
 * H7-H10, H14 (geometry, engine binding, trace, colour, a11y) land with the phases that build them.
 * Scope (v3.60.0, R143 — the redraw ships sheet by sheet): H1/H2/H4/H5/H6 measure the HMI sheets (`svg.hmi-svg`,
 * ids hmi*Svg); a tab not yet redrawn is reported as legacy and not judged. H3 (own L3 modal per class) and H11/H12
 * (shell), H13 (Room Layout, phase 7) and H1 on the legacy modals are reported, blocking only with --strict-all until
 * their phases land. The HMI set may only grow (ratchet).
 * Premium test seam: the rz_premium_session fixture of tools/test-datahall-ai-authority.mjs (local server only).
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { isSupabaseModule, signedInStorage, signedInSupabaseBody } from './lib/signed-in-supabase.mjs';
import { enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const PAGE = arg('page') || 'datahallAI.html';
const ONLY = arg('only') ? new Set(arg('only').split(',')) : null;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
let fail = 0;
const law = (id, ok, msg) => {
  if (ONLY && !ONLY.has(id)) return;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${msg}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SHEETS = [['hall', null, 'hSvg'], ['over', null, 'floorSvg', 'hmiFloorPlanSvg'], ['rack', null, 'rackSvg', 'hmiRackSvg'], ['cool', null, 'coolSvg', 'hmiCoolSvg'], ['cool', null, 'coolSvg', 'hmiCoolPlantSvg'], ['cool', null, 'coolSvg', 'hmiCoolRowsSvg'],
  ['elec', 'Overview', 'elecOvSvg', 'hmiElecOvSvg'], ['elec', 'DH-01', 'elecDH1Svg', 'hmiElecDH1Svg'], ['elec', 'DH-02', 'elecDH2Svg', 'hmiElecDH2Svg'], ['elec', 'DH-08', 'elecDH8Svg', 'hmiElecDH8Svg'], ['net', 'Compute fabric', 'netSvg', 'hmiNetSvg'],
  ['net', 'Corporate & DC internet', 'wanSvg', 'hmiWanSvg'], ['net', 'Security network', 'secSvg', 'hmiSecSvg'], ['fire', 'Mimic', 'fireSvg', 'hmiFireSvg'], ['bms', null, 'bmsSvg', 'hmiBmsSvg']];
const STRICT_ALL = process.argv.includes('--strict-all');
const HMI_MIN = 14;   // ratchet: sheets already redrawn (heat rejection, TCS rows, room layout plan, rack, cool, elec overview + DH-01, fabric, WAN, security, fire, BMS, hall SLDs DH-02 and DH-08 sampled) — a lower count fails

const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0]));
  if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

async function open(vp, theme, ctx) {
  const pg = await (ctx || browser).newPage();
  pg.errors = [];
  pg.on('pageerror', (e) => pg.errors.push(e.message));
  await pg.setRequestInterception(true);
  pg.on('request', (r) => {
    /* v3.61: a signed-in visitor via the Supabase module; a forged localStorage session is ignored since v3.57.7
       and the page re-locked mid-run (F1 'svg 0px', then a TypeError at H15). */
    if (isSupabaseModule(r.url())) return r.respond({ status: 200, contentType: 'text/javascript', body: signedInSupabaseBody({ email: 'educator@resistancezero.com', tier: 'pro', educator: true }) });
    return r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort();
  });
  await pg.setViewport(vp);
  await pg.evaluateOnNewDocument((t, entries) => {
    try {
      localStorage.setItem('theme', t);
      localStorage.setItem('rz_cookie_consent', 'declined');
      entries.forEach(([k, v]) => localStorage.setItem(k, v));
    } catch (x) { /* no storage */ }
  }, theme, signedInStorage({ email: 'educator@resistancezero.com', tier: 'pro', role: 'educator' }));
  await pg.goto(ORIGIN + PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
  /* the signed-in stub makes auth.js sync the server role once, and that reloads the page; under ship-gate load the
     reload arrived mid-test ('Promise was collected' after H15) — wait it out here (no reload within 8 s = none) */
  await pg.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
  await wait(800);
  /* since v3.57.7 a session forged in localStorage no longer unlocks the cockpit (the page re-locks); the shared audit
     helper keeps the auth blockers off with an observer, as every other cockpit browser gate does */
  await enterAuthorizedAuditState(pg, 'dc-ai');
  return pg;
}
async function showSheet(pg, tab, sub) {
  await pg.evaluate((t) => { const b = document.querySelector(`#tabs [data-t="${t}"]`); if (b) b.click(); }, tab);
  await wait(900);
  if (sub) {
    await pg.evaluate((t, s) => {
      const b = [...document.querySelectorAll(`.${t}-tabs button, .${t}-tabs [role=tab], [data-sheet-tabs="${t}"] [role=tab]`)].find((x) => x.textContent.trim() === s)
        || document.querySelector(`.${t}-tabs [data-fp="${s.toLowerCase()}"], .${t}-tabs [data-np="${s.toLowerCase()}"]`);
      if (b) b.click();
    }, tab, sub);
    await wait(700);
  }
}
// shared DOM probes (run in the page)
const PROBE = {
  // H1 (v3.60.x, owner R139/R140 "deep shader"): the renderer's own shading is the ONLY paint allowed — gradients and
  // filters it defines once per document in the shared `.hmi-defs` svg under ids hmi-g-* / hmi-f-*. Anything else
  // (a gradient or filter defined inside a sheet or modal, a url() to any other id, a box-shadow, a CSS gradient) counts.
  paint: (root) => {
    const all = [...root.querySelectorAll('*')];
    const defs = root.querySelectorAll('linearGradient,radialGradient,filter').length;
    const own = (v) => /^url\(["']?#hmi-[gf]-[a-z0-9-]+["']?\)$/.test(String(v).trim());
    const urlRefs = all.filter((e) => ['fill', 'stroke', 'filter'].some((k) => { const v = e.getAttribute && e.getAttribute(k); return v && /url\(#/.test(v) && !own(v); })).length;
    const css = all.filter((e) => { const s = getComputedStyle(e); return (s.boxShadow && s.boxShadow !== 'none') || (s.filter && s.filter !== 'none' && !own(s.filter)) || /gradient/.test(s.backgroundImage || '') || (/url\(/.test(s.fill || '') && !own(s.fill)); }).length;
    return defs + urlRefs + css;
  },
};

// ── 1440 dark: sheets ────────────────────────────────────────────────────────────────────────────────────────────
const pg = await open({ width: 1440, height: 1000 }, 'dark');
const sheetRows = [];
for (const [tab, sub, legacyId, hmiId] of SHEETS) {
  await showSheet(pg, tab, sub);
  await wait(hmiId ? 2500 : 0);
  const r = await pg.evaluate((legacyId, hmiId, paintSrc) => {
    const paint = new Function('return ' + paintSrc)();
    const v = (hmiId && document.getElementById(hmiId)) || document.getElementById(legacyId);
    if (!v) return { id: legacyId, missing: true };
    const id = v.id, hmi = v.classList.contains('hmi-svg');
    const box = v.getBoundingClientRect();
    const frame = (v.closest('[data-sheet-frame]') || v.parentElement).getBoundingClientRect();
    const SKIP = '[data-role="tag"],[data-role="value"],[data-role="line"],[data-role="name"],[data-role="legend"],[data-role="titleblock"],[data-role="titleblock"] *';
    const words = [...v.querySelectorAll('text')].filter((t) => !t.closest(SKIP))
      .map((t) => t.textContent.trim()).join(' ').split(/\s+/).filter((w) => /[A-Za-z]{2,}/.test(w)).length;
    const items = [...v.querySelectorAll('[data-rz-equipment]')];
    const META = (window.RZEngSymbols && window.RZEngSymbols.META) || {};
    // H16: an edge segment through a symbol body it does not end on (box nodes are containers and do not count)
    const LAY = window.RZDiagramLayout;
    const bodies = [...v.querySelectorAll('g.hmi-node[data-node]')].filter((g) => !g.hasAttribute('data-box'))
      .map((g) => { const b = g.querySelector('.b') || g; const r = b.getBBox(); return { id: g.getAttribute('data-node'), x: r.x, y: r.y, w: r.width, h: r.height }; }).filter((r) => r.w > 0);
    let cross = 0; const crossIds = [];
    if (LAY && LAY.segmentHitsRect) [...v.querySelectorAll('path.hmi-edge[data-edge]')].forEach((p) => {
      const ends = (p.getAttribute('data-ends') || '|').split('|');
      const pts = (p.getAttribute('d').match(/[ML]\s*[-\d.]+\s+[-\d.]+/g) || []).map((s) => { const m = s.slice(1).trim().split(/\s+/); return { x: +m[0], y: +m[1] }; });
      const obs = bodies.filter((b) => b.id !== ends[0] && b.id !== ends[1]);
      for (let i = 1; i < pts.length; i++) if (obs.some((b) => LAY.segmentHitsRect({ x1: pts[i - 1].x, y1: pts[i - 1].y, x2: pts[i].x, y2: pts[i].y }, b))) { cross++; crossIds.push(p.getAttribute('data-edge')); break; }
    });
    const routed = v.querySelectorAll('path.hmi-edge[data-routed]').length;
    const filtered = [...v.querySelectorAll('*')].filter((e) => { const f = getComputedStyle(e).filter; return f && f !== 'none'; }).length;   // H17
    return { id, hmi, w: Math.round(box.width), h: Math.round(box.height), frameW: Math.round(frame.width), scrollsInFrame: !!(v.parentElement && v.parentElement.classList.contains('hmi-vp') && getComputedStyle(v.parentElement).overflowX === 'auto'), words, paint: paint(v), cross, crossIds: crossIds.slice(0, 6), routed, filtered,
      items: items.length, sym: items.filter((e) => META[e.getAttribute('data-sym')] || e.querySelector('[data-sym]')).length,
      named: items.filter((e) => (e.getAttribute('aria-label') || e.querySelector(':scope > title')) && e.getAttribute('tabindex') !== null).length };
  }, legacyId, hmiId, PROBE.paint.toString());
  sheetRows.push({ tab, sub, ...r });
}
const shown = sheetRows.filter((r) => !r.missing && r.hmi);
const legacy = sheetRows.filter((r) => !r.missing && !r.hmi).map((r) => r.id);
law('H0', shown.length >= HMI_MIN, `HMI sheets drawn ${shown.length} (ratchet >= ${HMI_MIN}): ${shown.map((r) => r.id).join(', ')}; legacy not judged: ${legacy.join(', ') || 'none'}`);
law('H1', shown.every((r) => r.paint === 0), 'no gradient/filter/shadow in drawings: ' + shown.map((r) => `${r.id} ${r.paint}`).join(', '));
const allItems = shown.reduce((a, r) => a + r.items, 0), allSym = shown.reduce((a, r) => a + r.sym, 0), allNamed = shown.reduce((a, r) => a + r.named, 0);
law('H2', allItems > 0 && allSym === allItems, `items drawn from the symbol library: ${allSym} / ${allItems}`);
law('H17', shown.every((r) => r.filtered <= 12), 'elements carrying an SVG filter per sheet in deep mode (<= 12: layers + alarm glows, never per symbol): ' + shown.map((r) => `${r.id} ${r.filtered}`).join(', '));
law(STRICT_ALL ? 'H16' : 'H16 (reported)', !STRICT_ALL || shown.every((r) => r.cross === 0), 'edges through a symbol body they do not end on (R147 routing): ' + shown.map((r) => `${r.id} ${r.cross}${r.crossIds.length ? ' [' + r.crossIds.join(' ') + ']' : ''} routed ${r.routed}`).join(', '));
law('H4', allItems > 0 && allNamed === allItems, `items with a name and keyboard focus: ${allNamed} / ${allItems}`);
law('H5', shown.every((r) => r.words <= 8), 'words per sheet outside tags/values (<= 8, R144): ' + shown.map((r) => `${r.id} ${r.words}`).join(', '));
law('H6', shown.every((r) => r.w <= r.frameW + 1 || r.scrollsInFrame), '1440 sheet fits its frame or scrolls inside it: ' + shown.map((r) => `${r.id} ${r.w}/${r.frameW}`).join(', '));
const flr = sheetRows.find((r) => r.id === 'floorSvg'), rk = sheetRows.find((r) => r.id === 'rackSvg' || r.id === 'hmiRackSvg');
law(STRICT_ALL ? 'H13' : 'H13 (reported)', !STRICT_ALL || (!!flr && !flr.missing && flr.w > 0 && flr.h > 0 && !!rk && !rk.missing && rk.w > 0 && rk.h > 0),
  `first open: Room Layout ${flr && !flr.missing ? flr.w + '×' + flr.h : 'missing'}, Rack ${rk && !rk.missing ? rk.w + '×' + rk.h : 'missing'}`);

// ── F1-F9 fire sheet DH-F-101 ────────────────────────────────────────────────────────────────────────────────────
await showSheet(pg, 'fire', 'Mimic'); await wait(4800);
const fire = await pg.evaluate(() => {
  const host = document.querySelector('.hmi-host[data-hmi-sheet="dh-f-101"]'); if (!host) return { host: false };
  const svg = host.querySelector('svg'); const hb = host.getBoundingClientRect(), sb = svg.getBoundingClientRect();
  const W = window.RZDatahallAIFireWorkstation, inv = (W && W.inventory && W.inventory()) || (typeof fireInv === 'function' && fireInv());
  const expected = inv ? inv.points.filter((p) => p.hall === 1 && /^(smoke_spot|heat_spot|beam|lhd|mcp|epo|vesda|facp_nac|facp_comms|abort|release|preaction_solenoid|agent_pressure)$/.test(p.type)).length : -1;
  const nodes = [...svg.querySelectorAll('.hmi-node')];
  const dev = nodes.filter((g) => /^fire-(point|mcp|epo|vesda)/.test(g.getAttribute('data-rz-equipment') || ''));
  const zones = nodes.filter((g) => /^zh-/.test(g.dataset.node));
  const named = nodes.filter((g) => g.getAttribute('tabindex') === '0' && g.querySelector('title') && g.querySelector('title').textContent.trim()).length;
  const unknown = dev.filter((g) => { const s = g.getAttribute('data-state'); return !s || s === 'unknown'; }).length;
  const rects = dev.filter((g) => g.querySelector('[data-sym]')).map((g) => g.querySelector('[data-sym]').getBoundingClientRect());
  let ov = 0; for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i], c = rects[j]; if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) ov++; }
  const SKIP = '[data-role="tag"],[data-role="value"],[data-role="line"],[data-role="name"],[data-role="legend"],[data-role="titleblock"],[data-role="titleblock"] *';
  const words = [...svg.querySelectorAll('text')].filter((t) => !t.closest(SKIP)).map((t) => t.textContent.trim()).join(' ').split(/\s+/).filter((x) => /[A-Za-z]{2,}/.test(x)).length;
  const paint = svg.querySelectorAll('linearGradient,radialGradient,filter').length;
  return { host: true, hostW: Math.round(hb.width), svgW: Math.round(sb.width), expected, dev: dev.length, zones: zones.length, nodes: nodes.length, named, unknown, ov, words, paint };
});
law('F1', fire.host && fire.svgW > 0, `fire sheet dh-f-101 mounted, svg ${fire.svgW || 0}px`);
if (fire.host) {
  law('F2', fire.zones === 12, `fire zones drawn ${fire.zones}/12`);
  law('F3', fire.dev === fire.expected && fire.expected > 0, `fire devices drawn ${fire.dev} = inventory ${fire.expected} (detection + release + EPO + NAC + comms + cylinder PS of DH-01)`);
  law('F4', fire.named === fire.nodes, `fire nodes with title + focus ${fire.named}/${fire.nodes}`);
  law('F5', fire.unknown === 0, `fire devices without a resolved payload state: ${fire.unknown}`);
  law('F6', fire.ov === 0, `fire overlapping symbols: ${fire.ov}`);
  law('F7', fire.words <= 8 && fire.paint === 0, `fire words ${fire.words} (<= 8), gradients/filters ${fire.paint}`);
}
law('F9', pg.errors.length === 0, `page errors so far: ${pg.errors.length}${pg.errors.length ? ' — ' + pg.errors[0].slice(0, 160) : ''}`);

// ── H15 shading mode ─────────────────────────────────────────────────────────────────────────────────────────────
const sh0 = await pg.evaluate(() => { const f = [...document.querySelectorAll('.hmi-frame')].find((x) => x.getBoundingClientRect().width); if (!f) return null;
  const g = document.getElementById('hmi-g-run'), b = f.querySelector('.hmi-node .b'); return { mode: f.dataset.shade, defs: !!g, fill: b ? getComputedStyle(b).fill : '', btn: !!f.querySelector('[data-shade-btn]') }; });
await pg.evaluate(() => { const f = [...document.querySelectorAll('.hmi-frame')].find((x) => x.getBoundingClientRect().width); f && f.querySelector('[data-shade-btn]').click(); });
await wait(200);
const sh1 = await pg.evaluate(() => { const f = [...document.querySelectorAll('.hmi-frame')].find((x) => x.getBoundingClientRect().width); const b = f.querySelector('.hmi-node .b'); return { mode: f.dataset.shade, fill: getComputedStyle(b).fill, tube: getComputedStyle(f.querySelector('.hmi-edge-shadow') || f).display }; });
/* persistence: in its OWN browser context (a second tab of the same context writes the signed-in Supabase keys, and the
   first tab's auth sync reloaded it mid-run — 'Promise was collected'): turn Shade off there, reload, read it back */
const iso = await browser.createBrowserContext();
const pg2 = await open({ width: 1440, height: 1000 }, 'dark', iso); await showSheet(pg2, 'fire', 'Mimic'); await wait(2500);
await pg2.evaluate(() => { const f = [...document.querySelectorAll('.hmi-frame')].find((x) => x.getBoundingClientRect().width); f && f.querySelector('[data-shade-btn]').click(); });
await wait(200); await pg2.reload({ waitUntil: 'networkidle2' }); await wait(800); await enterAuthorizedAuditState(pg2, 'dc-ai'); await showSheet(pg2, 'fire', 'Mimic'); await wait(2500);
const sh2 = await pg2.evaluate(() => { const f = [...document.querySelectorAll('.hmi-frame')].find((x) => x.getBoundingClientRect().width); return f ? f.dataset.shade : null; });
await iso.close();
await pg.evaluate(() => { try { localStorage.removeItem('rz_hmi_shade'); } catch (e) { /* none */ } });
law('H15', !!sh0 && sh0.mode === 'deep' && sh0.defs && /url\(/.test(sh0.fill) && sh0.btn && sh1.mode === 'flat' && !/url\(/.test(sh1.fill) && sh1.tube === 'none' && sh2 === 'flat',
  `shade default ${sh0 && sh0.mode} (body fill ${sh0 && sh0.fill.slice(0, 18)}), after Shade off: ${sh1.mode} fill ${sh1.fill.slice(0, 18)} tubes ${sh1.tube}, after reload ${sh2}`);

// ── H3 + H1 modals: every equipment class opens its own modal ───────────────────────────────────────────────────
const classes = new Map();
for (const [tab, sub] of SHEETS) {
  await showSheet(pg, tab, sub);
  const found = await pg.evaluate(() => [...document.querySelectorAll('[data-rz-equipment]')]
    .filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.getAttribute('data-rz-equipment').split(':')[0]));
  for (const c of found) if (!classes.has(c)) classes.set(c, [tab, sub]);
}
const own = [], generic = [];
let modalPaint = 0;
for (const [cls, [tab, sub]] of classes) {
  await showSheet(pg, tab, sub);
  const r = await pg.evaluate(async (cls, paintSrc) => {
    const paint = new Function('return ' + paintSrc)();
    const el = [...document.querySelectorAll(`[data-rz-equipment^="${cls}:"]`)].find((e) => e.getBoundingClientRect().width > 0);
    if (!el) return { cls, none: true };
    el.scrollIntoView({ block: 'center' });
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 700));
    const m = [...document.querySelectorAll('[data-rz-modal-class], dialog[open], [role=dialog]')]
      .filter((d) => d.getBoundingClientRect().width > 0 && getComputedStyle(d).visibility !== 'hidden');
    const mine = m.find((d) => d.getAttribute('data-rz-modal-class') === cls);
    const p = m.reduce((a, d) => a + paint(d), 0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    m.forEach((d) => { const x = d.querySelector('[aria-label*="Close" i], .close, [data-close]'); if (x) x.click(); });
    return { cls, own: !!mine, sym: mine ? mine.querySelectorAll('[data-sym]').length : 0, paint: p };
  }, cls, PROBE.paint.toString());
  await wait(250);
  modalPaint += r.paint || 0;
  (r.own && r.sym >= 8 ? own : generic).push(r.cls);
}
law(STRICT_ALL ? 'H3' : 'H3 (reported)', !STRICT_ALL || (classes.size > 0 && generic.length === 0), `classes with their own L3 schematic: ${own.length} / ${classes.size}` +
  (generic.length ? ` — missing: ${generic.slice(0, 12).join(', ')}${generic.length > 12 ? ' …' : ''}` : ''));
law(STRICT_ALL ? 'H1' : 'H1 modals (reported)', !STRICT_ALL || modalPaint === 0, `no gradient/filter/shadow in equipment modals: ${modalPaint} painted element(s) (legacy modals retire with H3)`);

// ── H11 shell ────────────────────────────────────────────────────────────────────────────────────────────────────
const shell = await pg.evaluate(() => {
  const nav = document.querySelector('header nav, .hub-nav, [data-rz-shell-nav]');
  const head = document.querySelector('header') || document.body;
  const ctrls = [...head.querySelectorAll('a,button')].filter((e) => e.getBoundingClientRect().width > 0 && !e.closest('#tabs'));
  const outside = nav ? ctrls.filter((e) => !nav.contains(e)).length : ctrls.length;
  const inNav = nav ? [...nav.querySelectorAll('a,button')].filter((e) => e.getBoundingClientRect().width > 0).length : 0;
  const sim = /SIMULATED\s*·\s*ENGINE BASIS/i.test(document.body.innerText);
  return { nav: !!nav, outside, inNav, sim };
});
law(STRICT_ALL ? 'H11' : 'H11 (reported)', !STRICT_ALL || (shell.nav && shell.outside === 0 && shell.inNav <= 6 && !shell.sim),
  `nav bar ${shell.nav}, controls outside it ${shell.outside}, visible in it ${shell.inNav}, "SIMULATED · ENGINE BASIS" shown ${shell.sim}`);

// ── H12 sidebar modes ────────────────────────────────────────────────────────────────────────────────────────────
const modes = await pg.evaluate(() => [...document.querySelectorAll('[data-side-mode]')].map((b) => b.getAttribute('data-side-mode')));
let persisted = false;
if (['pinned', 'auto', 'hidden'].every((m) => modes.includes(m))) {
  await pg.evaluate(() => document.querySelector('[data-side-mode="auto"]').click());
  await pg.reload({ waitUntil: 'networkidle2' });
  await wait(600); await enterAuthorizedAuditState(pg, 'dc-ai');
  persisted = await pg.evaluate(() => document.body.getAttribute('data-side') === 'auto');
}
law(STRICT_ALL ? 'H12' : 'H12 (reported)', !STRICT_ALL || persisted, `sidebar modes offered [${modes.join(', ') || 'none'}], auto-hide survives reload ${persisted}`);
if (pg.errors.length) console.log(`  note: ${pg.errors.length} page error(s) — ${pg.errors[0]}`);
await pg.close();

// ── H6 at 390 ────────────────────────────────────────────────────────────────────────────────────────────────────
const ph = await open({ width: 390, height: 844, isMobile: true, hasTouch: true }, 'light');
const narrow = [];
for (const [tab, sub, legacyId, hmiId] of SHEETS) {
  if (!hmiId) continue;   // legacy sheets are not judged (see Scope)
  await showSheet(ph, tab, sub); await wait(2500);
  narrow.push(await ph.evaluate((legacyId, hmiId) => {
    const v = document.getElementById(hmiId) || document.getElementById(legacyId), id = v ? v.id : legacyId;
    const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth;
    if (!v || !v.classList.contains('hmi-svg')) return { id, ok: false, why: 'not an HMI sheet' };
    // fits, or (v3.61.1 legibility floor) scrolls inside its own viewport — never widens the page
    const vp = v.parentElement, fr = v.closest('.hmi-frame').getBoundingClientRect(), w = v.getBoundingClientRect().width, f = vp.getBoundingClientRect().width;
    const ok = sw <= cw && fr.right <= cw + 1 && (w <= f + 1 || getComputedStyle(vp).overflowX === 'auto');
    return { id, ok, why: `${Math.round(w)}/${Math.round(f)}${w > f + 1 ? ' scrolls in frame' : ''} page ${sw}/${cw}` };
  }, legacyId, hmiId));
}
law('H6', narrow.every((r) => r.ok), '390 light: ' + narrow.map((r) => `${r.id} ${r.why}`).join(', '));
law('F8', narrow.some((r) => r.id === 'hmiFireSvg' && r.ok), '390 fire sheet fits or scrolls inside its frame, no page overflow');
await ph.close();

await browser.close();
srv.close();
console.log(`test-dh-drawings: ${fail ? fail + ' failed' : 'all passed'}`);
process.exit(fail ? 1 : 0);
