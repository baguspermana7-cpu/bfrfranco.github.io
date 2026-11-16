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
 * H6  every sheet opens fit-to-width: no drawing wider than its frame, no sideways page scroll (1440 and 390); at 390 the
 *     sheet number in the bar stays on one line
 * H11 shell: no header control outside the nav bar, <= 6 visible actions in it, no "SIMULATED · ENGINE BASIS" text
 * H12 sidebar has pinned / auto-hide / hidden modes that survive a reload
 * H13 Room Layout and Rack Architecture draw on first open (non-zero box)
 * F1-F9 fire sheet DH-F-101: mounted, 12 zones, devices drawn = inventory, title + focus, no unknown state,
 *     no overlapping symbols, text budget + paint, no page overflow at 390, no console error
 * F10-F14 interlocks sheet DH-F-103 (Cause & effect view): one control module per system the C&E matrix commands,
 *     nothing marked at rest, a running training event marks exactly the systems the C&E engine has due / pending /
 *     blocked for that event and zone, Stop returns every module to normal
 * S1  returning to the DC Dashboard tab raises no page error
 * M1  every BMS block kind (server, ring switch, gateway, LDC, controller) opens with its own L3 schematic
 * M2  a fire zone click opens its detection schematic with every device of the zone; Shift+click keeps the inspector
 * M3  the battery modal draws its L3 sheet
 * M5  an opener that cannot draw falls back to the inspector
 * L1  a closed sheet leaves no window listener and no late tooltip behind
 * L3  an item on a hall SLD opens and reads as that hall
 * L2  an isolation after Clear register gets a new record id and reaches Alarms · L4 the point table follows the
 *     point set · L7 a very long reason is capped and still recorded
 * L5  a compute tray opens as itself · L9 a data-tip is rendered as text
 * M4  two items drawn in turn in one modal slot each show their own reading (memo keyed on the item, not the node id)
 * F15-F18 zone map DH-F-104 (Zones view): every zone of the hall once, means available / total = the isolation
 *     register, a zone isolated below two means shows its alarm (and only it), Clear restores
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
// ── F10-F14 interlocks sheet DH-F-103 (Cause & effect view): one control module per system the C&E matrix commands;
// at rest the panel commands nothing (every module normal, no alarm mark); a running training event marks exactly the
// systems the C&E engine has due / pending / blocked for that event and zone, and nothing else ──────────────────────
await showSheet(pg, 'fire', 'Cause & effect'); await wait(1500);
const ilkProbe = () => {
  const host = document.querySelector('.hmi-host[data-hmi-sheet="dh-f-103"]'); if (!host) return { host: false };
  const svg = host.querySelector('svg'), mods = [...svg.querySelectorAll('.hmi-node')].filter((g) => /^cm\d/.test(g.dataset.node));
  const CE = window.RZDatahallAIFireCauseEffect, sys = []; CE.BASE_ROWS.forEach((r) => r.outputs.forEach((x) => { if (!sys.includes(x.system)) sys.push(x.system); }));
  const named = mods.filter((g) => g.getAttribute('tabindex') === '0' && (g.querySelector('title') || {}).textContent).length;
  const marked = mods.filter((g) => g.getAttribute('data-alarm')).map((g) => g.getAttribute('data-rz-equipment') || g.dataset.node);
  const SKIP = '[data-role="tag"],[data-role="value"],[data-role="line"],[data-role="name"],[data-role="legend"],[data-role="titleblock"],[data-role="titleblock"] *';
  const words = [...svg.querySelectorAll('text')].filter((t) => !t.closest(SKIP)).map((t) => t.textContent.trim()).join(' ').split(/\s+/).filter((x) => /[A-Za-z]{2,}/.test(x)).length;
  return { host: true, w: Math.round(svg.getBoundingClientRect().width), mods: mods.length, sys: sys.length, named, marked, words, states: mods.map((g) => g.getAttribute('data-state')) };
};
const ilk0 = await pg.evaluate(ilkProbe);
law('F10', ilk0.host && ilk0.w > 0 && ilk0.mods === ilk0.sys && ilk0.sys > 0, `interlocks sheet dh-f-103 in the Cause & effect view: ${ilk0.host ? ilk0.w + ' px, ' + ilk0.mods + ' control modules / ' + ilk0.sys + ' C&E systems' : 'not drawn'}`);
if (ilk0.host) {
  law('F11', ilk0.marked.length === 0 && ilk0.states.every((s) => s === 'normal'), `at rest no module commanded: marked ${ilk0.marked.length}, states ${[...new Set(ilk0.states)].join('/')}`);
  law('F12', ilk0.named === ilk0.mods && ilk0.words <= 8, `modules with title + focus ${ilk0.named}/${ilk0.mods}; words ${ilk0.words} (<= 8)`);
  await pg.evaluate(() => window.RZDatahallAIFireWorkstation.startRun('vesda_fire_2', 'DH-01-Z05')); await wait(4800);
  const ilk1 = await pg.evaluate(() => {
    const CE = window.RZDatahallAIFireCauseEffect, W = window.RZDatahallAIFireWorkstation, ci = W.causeEffectInput();
    const r = CE.evaluateEvent({ eventId: ci.eventId, zoneId: ci.zoneId, elapsedSeconds: ci.elapsedSeconds, runtimeRows: ci.runtimeRows, interlocks: ci.interlocks });
    const rowSys = {}; CE.BASE_ROWS.forEach((x) => { rowSys[x.id] = x.outputs.map((o) => o.system); });
    const want = new Set([...r.commands, ...r.pending].map((c) => c.system).concat(...r.blocked.map((b) => rowSys[b.rowId] || [])));
    const svg = document.querySelector('.hmi-host[data-hmi-sheet="dh-f-103"] svg');
    const got = new Set([...svg.querySelectorAll('.hmi-node')].filter((g) => /^cm\d/.test(g.dataset.node) && g.getAttribute('data-alarm')).map((g) => (g.getAttribute('data-rz-equipment') || '').split(':').pop()));
    return { want: [...want].sort(), got: [...got].sort(), blocked: r.blocked.length };
  });
  law('F13', ilk1.want.length > 0 && ilk1.want.join() === ilk1.got.join(), `running vesda_fire_2 in Z05: marked [${ilk1.got.join(', ')}] = C&E due/pending/blocked [${ilk1.want.join(', ')}]${ilk1.blocked ? ' (+' + ilk1.blocked + ' blocked rows)' : ''}`);
  await pg.evaluate(() => window.RZDatahallAIFireWorkstation.stopRun()); await wait(4800);
  const ilk2 = await pg.evaluate(ilkProbe);
  law('F14', ilk2.marked.length === 0, `after Stop every module back to normal: marked ${ilk2.marked.length}`);
}
// ── F15-F17 zone map DH-F-104 (Zones view): every zone of the hall drawn once with its detection means available /
// total from the isolation register; a zone driven below two means by isolations shows its alarm, Clear restores ─────
await showSheet(pg, 'fire', 'Zones'); await wait(1500);
const zoneProbe = () => {
  const host = document.querySelector('.hmi-host[data-hmi-sheet="dh-f-104"]'); if (!host) return { host: false };
  const svg = host.querySelector('svg'), W = window.RZDatahallAIFireWorkstation, snap = W.snapshot(), inv = W.inventory();
  const want = inv.zones.filter((z) => z.hall === 1).map((z) => z.id);
  const boxes = [...svg.querySelectorAll('.hmi-node[data-rz-equipment^="fire-zone:"]')], got = boxes.map((g) => g.getAttribute('data-rz-equipment').slice(10));
  const bad = boxes.map((g) => {
    const id = g.getAttribute('data-rz-equipment').slice(10), z = snap.zones.find((x) => x.id === id), t = svg.querySelector(`[data-val="${g.dataset.node}:means"]`);
    const exp = z ? z.meansAvailable + '/' + z.meansTotal + ' MEANS' : '?';
    return t && t.textContent === exp ? null : `${id} ${t ? t.textContent : 'no value'} != ${exp}`;
  }).filter(Boolean);
  const isoZones = new Set(Object.keys(W.register().entries).flatMap((pid) => (inv.byId[pid] || { zoneIds: [] }).zoneIds));
  const alarmed = boxes.filter((g) => g.getAttribute('data-alarm')), stray = alarmed.filter((g) => !isoZones.has(g.getAttribute('data-rz-equipment').slice(10))).map((g) => g.dataset.node);
  const z12 = boxes.find((g) => g.dataset.node === 'z12');
  return { host: true, w: Math.round(svg.getBoundingClientRect().width), want, got, bad, alarmed: alarmed.map((g) => g.dataset.node), stray, z12: z12 ? z12.getAttribute('data-alarm') : null };
};
const zm0 = await pg.evaluate(zoneProbe);
law('F15', zm0.host && zm0.w > 0 && zm0.got.slice().sort().join() === zm0.want.slice().sort().join(), `zone map dh-f-104 in the Zones view: ${zm0.host ? zm0.got.length + ' zones drawn / ' + zm0.want.length + ' in the inventory' : 'not drawn'}`);
if (zm0.host) {
  law('F16', zm0.bad.length === 0 && zm0.alarmed.length === 0, `means available / total = the isolation register on every zone${zm0.bad.length ? ': ' + zm0.bad.slice(0, 3).join('; ') : ''}; alarmed at rest ${zm0.alarmed.length}`);
  const iso = await pg.evaluate(() => {
    const W = window.RZDatahallAIFireWorkstation, inv = W.inventory(), Z = 'DH-01-Z12', base = { owner: 'shift-a', reason: 'drawing gate: drive Z12 below two means', expiryId: '8h', acknowledged: true };
    W.clearRegister();
    const ids = inv.points.filter((p) => p.zoneIds.includes(Z) && (p.type === 'vesda' || p.means === 'smoke_l1')).map((p) => p.id);
    return ids.map((id) => W.isolate({ ...base, pointId: id }).ok).filter((x) => !x).length;
  });
  await wait(4800);
  const zm1 = await pg.evaluate(zoneProbe);
  law('F17', iso === 0 && zm1.bad.length === 0 && zm1.z12 === '1' && zm1.stray.length === 0, `Z12 below two means: refusals ${iso}, Z12 priority ${zm1.z12}, marked [${zm1.alarmed.join(', ')}] (zones without an isolated point marked: ${zm1.stray.length}), values ${zm1.bad.length ? zm1.bad.slice(0, 2).join('; ') : 'match the register'}`);
  await pg.evaluate(() => window.RZDatahallAIFireWorkstation.clearRegister()); await wait(4800);
  const zm2 = await pg.evaluate(zoneProbe);
  law('F18', zm2.alarmed.length === 0 && zm2.bad.length === 0, `after Clear: alarmed ${zm2.alarmed.length}, values ${zm2.bad.length ? 'differ' : 'match'}`);
}
await showSheet(pg, 'fire', 'Mimic'); await wait(1500);   // H15 below measures the first visible frame: the process sheet it always measured
law('F9', pg.errors.length === 0, `page errors so far:${pg.errors.length}${pg.errors.length ? ' — ' + pg.errors[0].slice(0, 160) : ''}`);

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

// ── S1 back to the dashboard: the tab handler repaints the DC Dashboard on the way in without a page error (it called
// updateDashKPI, defined inside its panel IIFE: ReferenceError on every return since v3.11.8) ─────────────────────
const e0 = pg.errors.length;
await showSheet(pg, 'cool', null); await showSheet(pg, 'dash', null); await wait(600);
const dashErr = pg.errors.slice(e0);
law('S1', dashErr.length === 0, `return to DC Dashboard: page errors ${dashErr.length}${dashErr.length ? ' — ' + dashErr[0].slice(0, 120) : ''}`);

// ── M1 BMS modals: every block kind of DH-B-101 opens with its own L3 schematic above the specification tables
// (owner "modalnya cuma tulisan"; until v3.63.0 only the controller drew one) ─────────────────────────────────────────
await showSheet(pg, 'bms', null); await wait(1500);
const bmsM = await pg.evaluate(async () => {
  const out = [], M = window.BMS_MODEL, O = window.RZDatahallAIHmiOpeners; if (!M || !O || !O.bms) return [{ kind: 'opener', ok: false }];
  const pick = { server: M.server[0].id, network: M.ring[2].id, gateway: M.gateway[2].id, ldc: M.ldc[1].id, controller: M.plc[0].id };
  for (const k of Object.keys(pick)) {
    O.bms(k, pick[k]); await new Promise((r) => setTimeout(r, 400));
    const sv = document.querySelector('#bmsModalBody .hmi-host[data-hmi-sheet="bms-l3"] svg');
    const syms = sv ? [...sv.querySelectorAll('.hmi-node [data-sym]')].length : 0, mine = sv ? !!sv.querySelector(`[data-rz-equipment$=":${pick[k]}"]`) : false;
    out.push({ kind: k, ok: !!sv && syms >= 3 && mine && sv.getBoundingClientRect().width > 0, syms, mine });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await new Promise((r) => setTimeout(r, 200));
  }
  return out;
});
law('M1', bmsM.every((x) => x.ok), 'BMS modal kinds with an L3 schematic holding the opened block: ' + bmsM.map((x) => `${x.kind} ${x.ok ? 'ok' : 'NO'} (${x.syms || 0} symbols${x.mine ? '' : ', opened block not drawn'})`).join(', '));

// ── M2 fire zone: a click on a zone opens its detection schematic with every device of the zone drawn (loops, aspirating
// unit, EPO, release line); Shift+click keeps the inspector (the isolation workflow) ───────────────────────────────────
await showSheet(pg, 'fire', 'Zones'); await wait(1500);
const fz = await pg.evaluate(async () => {
  const inv = window.RZDatahallAIFireWorkstation.inventory(), Z = 'DH-01-Z11';
  const want = inv.points.filter((p) => (p.zoneId === Z && /^(smoke_spot|heat_spot|beam|lhd|mcp|epo|abort|release|preaction_solenoid)$/.test(p.type)) || (p.type === 'vesda' && p.zoneIds.includes(Z))).map((p) => p.id).sort();
  const t = document.querySelector(`.rz-fire-tile[data-rz-equipment="fire-zone:${Z}"]`); if (!t) return { tile: false };
  t.dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise((r) => setTimeout(r, 1000));
  const m = document.querySelector('.hmi-modal-back:not([hidden]) .hmi-modal'), sv = m && m.querySelector('svg.hmi-svg');
  const got = sv ? [...sv.querySelectorAll('.hmi-node[data-rz-equipment^="fire-"]')].map((g) => g.getAttribute('data-rz-equipment').split(':').slice(1).join(':')).filter((id) => want.includes(id)).sort() : [];
  const head = sv ? !!sv.querySelector(`[data-rz-equipment="fire-zone:${Z}"]`) : false;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await new Promise((r) => setTimeout(r, 300));
  t.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })); await new Promise((r) => setTimeout(r, 800));
  const insp = !!document.querySelector('aside.rz-inspector.open'), modal2 = !!document.querySelector('.hmi-modal-back:not([hidden])');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return { tile: true, modal: !!sv, head, want: want.length, got: got.length, missing: want.filter((x) => !got.includes(x)).slice(0, 4), insp, modal2 };
});
law('M2', fz.tile && fz.modal && fz.head && fz.want > 0 && fz.got === fz.want && fz.insp && !fz.modal2, `fire zone Z11 click: schematic ${fz.modal ? 'drawn' : 'NOT drawn'}, devices ${fz.got}/${fz.want}${fz.missing && fz.missing.length ? ' missing ' + fz.missing.join(' ') : ''}; Shift+click inspector ${fz.insp ? 'open' : 'NOT open'}${fz.modal2 ? ' (modal opened too)' : ''}`);

// ── M3 battery: the battery modal draws its L3 sheet (a second wrapOpener('bat') was skipped since v3.61.1) ─────────
const bat = await pg.evaluate(async () => { const O = window.RZDatahallAIHmiOpeners; if (!O || !O.bat) return { opener: false };
  O.bat('A', 1); await new Promise((r) => setTimeout(r, 600));
  const sv = document.querySelector('#batHmi .hmi-host svg.hmi-svg'), n = sv ? sv.querySelectorAll('.hmi-node [data-sym]').length : 0;
  const bh = document.getElementById('batHmi'); if (bh) bh.classList.remove('show'); return { opener: true, sheet: !!sv, n }; });
law('M3', bat.opener && bat.sheet && bat.n >= 8, `battery modal L3 sheet: ${bat.sheet ? bat.n + ' symbols' : 'not drawn'}`);

// ── M4 one modal slot, two items: with the tick pinned, open zone Z11 then the impaired Z12 in the same modal; Z12's
// zone head must carry Z12's alarm, not Z11's memoised reading (code review v3.63.0: memo key was sheet + node id) ─────
const m4 = await pg.evaluate(async () => {
  const W = window.RZDatahallAIFireWorkstation, inv = W.inventory(), O = window.RZDatahallAIHmiOpeners, Z = 'DH-01-Z12', wait = (ms) => new Promise((r) => setTimeout(r, ms));
  W.clearRegister();
  inv.points.filter((p) => p.zoneIds.includes(Z) && (p.type === 'vesda' || p.means === 'smoke_l1')).forEach((p) => W.isolate({ pointId: p.id, owner: 'shift-a', reason: 'drawing gate M4: Z12 below two means', expiryId: '8h', acknowledged: true }));
  window.__rzSimTick = 9300000;
  O.fire('DH-01-Z11'); await wait(400);
  const a = document.querySelector('.hmi-modal-back:not([hidden]) [data-rz-equipment="fire-zone:DH-01-Z11"]');
  const z11 = a ? a.getAttribute('data-alarm') : 'none';
  O.fire(Z); await wait(400);
  const b = document.querySelector('.hmi-modal-back:not([hidden]) [data-rz-equipment="fire-zone:DH-01-Z12"]');
  const z12 = b ? b.getAttribute('data-alarm') : 'none';
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  delete window.__rzSimTick; W.clearRegister();
  return { z11, z12 };
});
law('M4', m4.z12 === '1' && m4.z11 !== '1', `same modal, Z11 then impaired Z12 (tick pinned): Z11 alarm ${m4.z11}, Z12 alarm ${m4.z12} (want 1)`);

// ── M5 an opener that cannot draw falls back to the inspector (a zone click did nothing when openFireZone returned false)
await showSheet(pg, 'fire', 'Zones'); await wait(800);
const m5 = await pg.evaluate(async () => {
  const O = window.RZDatahallAIHmiOpeners, keep = O.fire; O.fire = function () { return false; };
  const t = document.querySelector('.rz-fire-tile[data-rz-equipment="fire-zone:DH-01-Z05"]'); t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 700)); O.fire = keep;
  const insp = !!document.querySelector('aside.rz-inspector.open');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return insp;
});
law('M5', m5, `zone click with a failing opener: inspector ${m5 ? 'opened' : 'NOT opened (nothing happened)'}`);

// ── L1 a closed sheet leaves nothing behind (audit 2026-11-16 C1, C7): every render added pointermove + pointerup on
// window and destroy() removed neither, so each modal open kept a whole drawing alive; a pending tooltip timer fired
// after the modal had closed ────────────────────────────────────────────────────────────────────────────────────────
const cdp = await pg.target().createCDPSession();
const winListeners = async () => { const { result } = await cdp.send('Runtime.evaluate', { expression: 'window' });
  const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
  return listeners.filter((l) => l.type === 'pointermove' || l.type === 'pointerup').length; };
const openClose = (n) => pg.evaluate(async (n) => { const O = window.RZDatahallAIHmiOpeners;
  for (let i = 0; i < n; i++) { O.fire('DH-01-Z11'); await new Promise((r) => setTimeout(r, 120));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await new Promise((r) => setTimeout(r, 60)); } }, n);
await openClose(1); const l0 = await winListeners(); await openClose(20); const l1 = await winListeners();
const lateTip = await pg.evaluate(async () => { const O = window.RZDatahallAIHmiOpeners; O.fire('DH-01-Z11'); await new Promise((r) => setTimeout(r, 400));
  const g = document.querySelector('.hmi-modal-back:not([hidden]) .hmi-node'); if (!g) return 'no node';
  g.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 300, clientY: 300 }));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await new Promise((r) => setTimeout(r, 450));
  const t = document.querySelector('.hmi-tip'); return t && t.classList.contains('is-on') ? 'shown' : 'none'; });
law('L1', l1 === l0 && lateTip === 'none', `20 modal open/close: window pointer listeners ${l0} → ${l1} (want equal); tooltip 450 ms after Escape: ${lateTip}`);
await cdp.detach();

// ── L3 an item on a hall SLD belongs to that hall (audit 2026-11-16 C3): the inspector matched `elecDH<n>Svg` while the
// sheet is `hmiElecDH<n>Svg`, and every sheet read one hall-1 context, so DH-03's MSB opened and read as DH-01 ───────
await showSheet(pg, 'elec', 'DH-03'); await wait(2500);
const l3 = await pg.evaluate(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const sv = document.getElementById('hmiElecDH3Svg'); if (!sv) return { why: 'no DH-03 sheet' };
  const g = sv.querySelector('[data-rz-equipment^="sld-msb:"]'); if (!g) return { why: 'no MSB node' };
  g.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })); await wait(800);
  const a = document.querySelector('aside.rz-inspector.open'), insp = a ? a.textContent.replace(/\s+/g, ' ').slice(0, 400) : '';
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(300);
  g.dispatchEvent(new MouseEvent('click', { bubbles: true })); await wait(800);
  const m = document.querySelector('.hmi-modal-back:not([hidden]), .dh-modal.show, .modal.show'), modal = m ? m.textContent.replace(/\s+/g, ' ').slice(0, 400) : '';
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(300);
  // the L3 mimic of the same hall: its nodes must read hall 3 as well (review of v3.63.3: it was rendered as dh-e-101)
  const O = window.RZDatahallAIHmiOpeners; let mim = 'no mimic opener';
  if (O && O.mimic) { O.mimic('msb', 3); await wait(900);
    const h = document.querySelector('.hmi-host[data-hmi-sheet="sld-l3"] svg.hmi-svg'), n = h && h.querySelector('.hmi-node[data-rz-equipment]');
    if (n) { n.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); await wait(200); const t = document.querySelector('.hmi-tip.is-on'); mim = (h.closest('.hmi-frame').textContent.replace(/\s+/g, ' ').slice(0, 80)) + ' || tip: ' + (t ? t.textContent.replace(/\s+/g, ' ').slice(0, 160) : 'none'); n.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); }
    else mim = 'mimic not drawn';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(200); }
  return { ref: g.getAttribute('data-rz-equipment'), insp, modal, mim }; });
law('L3', /DH-03/.test(l3.insp || '') && !/DH-01/.test(l3.insp || '') && !/DH-01/.test(l3.modal || ''), `MSB on the DH-03 SLD (${l3.ref || l3.why}): inspector "${(l3.insp || '').slice(0, 90)}" modal "${(l3.modal || '').slice(0, 90)}"; mimic "${l3.mim}"`);

// ── L5 a tray opens as itself (audit C5): every compute / NVSwitch tray carried id 1 and opened tray 1 ────────────────
await showSheet(pg, 'rack', null); await wait(2500);
const l5 = await pg.evaluate(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const sv = document.getElementById('hmiRackSvg'); if (!sv) return { why: 'no rack sheet' };
  const all = [...sv.querySelectorAll('[data-rz-equipment^="rack-ct:"]')], g = all[all.length - 1]; if (!g) return { why: 'no tray node' };
  const ref = g.getAttribute('data-rz-equipment'), want = (/CT-?(\d+)/.exec(ref) || [])[1];
  g.dispatchEvent(new MouseEvent('click', { bubbles: true })); await wait(900);
  const svs = [...document.querySelectorAll('svg.hmi-svg')].filter((x) => x !== sv && x.getClientRects().length && /tray/i.test(x.getAttribute('aria-label') || x.closest('.hmi-frame')?.textContent || ''));
  const txt = svs.map((x) => (x.closest('.hmi-frame') || x).textContent.replace(/\s+/g, ' ').slice(0, 160)).join(' | ');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(200);
  return { ref, want, txt }; });
law('L5', !!l5.want && Number(l5.want) > 1 && new RegExp('CT-?0?' + Number(l5.want) + '\\b').test(l5.txt || ''), `tray click (${l5.ref || l5.why}): opened "${(l5.txt || '').slice(0, 110)}" (want CT-${l5.want})`);

// ── L9 a tooltip is text (audit S4): data-tip went through innerHTML ─────────────────────────────────────────────────
await showSheet(pg, 'over', null); await wait(800);
const l9 = await pg.evaluate(async () => { window.__l9 = 0; const out = [];
  for (const id of ['bldgSvg', 'floorSvg', 'rackSvg', 'coolSvg', 'netSvg', 'fireSvg', 'bmsSvg', 'elecOvSvg', 'elecDH1Svg']) { const sv = document.getElementById(id); if (!sv) continue;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('data-tip', 'L9 <img src=x onerror="window.__l9++"> <b id="l9b">bold</b>'); sv.appendChild(g);
    g.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 200, clientY: 200 })); await new Promise((r) => setTimeout(r, 150));
    out.push(id + (document.getElementById('l9b') ? ':markup' : ':text')); g.remove(); }
  await new Promise((r) => setTimeout(r, 300)); return { out, fired: window.__l9 }; });
law('L9', l9.fired === 0 && l9.out.length >= 2 && l9.out.every((x) => /:text$/.test(x)), `data-tip with markup on ${l9.out.length} drawings: ${l9.out.filter((x) => /:markup$/.test(x)).join(' ') || 'all rendered as text'}; onerror fired ${l9.fired}`);

// ── L2 / L4 / L7 fire register and point table (audit C2, C4, C8) ────────────────────────────────────────────────────
// L2: "Clear register" restarted the record sequence, so the next isolation reused an id the Alarms workspace had seen
// and dropped it. L7: a reason past the alarm schema's text limit never reached Alarms and was still marked seen.
// L4: the table key was hall | filters | row count, so another point set of the same size kept the old rows.
await showSheet(pg, 'fire', 'Points'); await wait(900);
const lf = await pg.evaluate(async () => { const W = window.RZDatahallAIFireWorkstation, A = window.RZDatahallAIAlarmWorkspace, inv = W.inventory(), wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const pts = inv.points.filter((p) => p.hall === 1 && (p.type === 'vesda' || p.means === 'smoke_l1')).slice(0, 3);
  const req = (p, reason) => ({ pointId: p.id, owner: 'shift-a', reason, expiryId: '8h', acknowledged: true });
  const isoIds = () => A.events().filter((e) => /^FIRE-ISO-/.test(e.id)).map((e) => e.id);
  W.clearRegister(); const before = new Set(isoIds());
  const r1 = W.isolate(req(pts[0], 'drawing gate L2: first isolation')); W.clearRegister();
  const r2 = W.isolate(req(pts[1], 'drawing gate L2: second isolation after a clear'));
  const fresh = isoIds().filter((id) => !before.has(id));
  const r3 = W.isolate(req(pts[2], 'drawing gate L7 ' + 'x'.repeat(5000)));
  const fresh7 = isoIds().filter((id) => !before.has(id) && !fresh.includes(id));
  const stored = (W.register().entries[pts[2].id] || {}).reason || '';
  W.clearRegister();
  // L4: two training runs on neighbouring zones, state filter on the state the run drives
  const evs = [...(document.getElementById('fireScenario') || { options: [] }).options].map((o) => o.value).filter(Boolean), sel = document.getElementById('firePointsState');
  const rowIds = () => [...document.querySelectorAll('#firePointsBody tr[data-rz-equipment]')].map((t) => t.getAttribute('data-rz-equipment').replace('fire-point:', '')).sort().join(',');
  const want = (st) => W.snapshot().points.filter((p) => p.hall === 1 && p.state === st).map((p) => p.id).sort().join(',');
  const T0 = 9400000, run = (z) => { window.__rzSimTick = T0; W.startRun(ev, z); window.__rzSimTick = T0 + 60; W.render(); };   // 60 ticks on: the event is past its first stage
  const sets = (z) => { run(z); const o = {}; W.snapshot().points.forEach((p) => { if (p.hall === 1 && p.state !== 'normal') (o[p.state] = o[p.state] || []).push(p.id); }); Object.keys(o).forEach((k) => { o[k] = o[k].sort().join(','); }); return o; };
  let ev = null, st = null, s5 = {}, s6 = {};
  for (const e of evs) { ev = e; s5 = sets('DH-01-Z05'); s6 = sets('DH-01-Z06');
  // the state whose points differ between the two runs but count the same: the case the old key could not see
    st = Object.keys(s5).filter((k) => s6[k] && s6[k] !== s5[k] && s6[k].split(',').length === s5[k].split(',').length)[0]; if (st) break; }
  let l4 = { why: 'no state with equal-size, different point sets: Z05 ' + JSON.stringify(Object.keys(s5)) + ' Z06 ' + JSON.stringify(Object.keys(s6)) };
  if (st && sel) { run('DH-01-Z05'); await wait(200); sel.value = st; sel.dispatchEvent(new Event('change', { bubbles: true })); await wait(200);
    const a = rowIds(), wa = want(st); run('DH-01-Z06'); await wait(300); const b = rowIds(), wb = want(st);
    l4 = { st, ev, okA: a === wa, okB: b === wb, differ: wa !== wb, n: wb.split(',').length, got: b.slice(0, 60), wantB: wb.slice(0, 60) }; }
  W.stopRun(); delete window.__rzSimTick; if (sel) { sel.value = ''; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  return { ok: [r1.ok, r2.ok, r3.ok], ids: [r1.records && r1.records[0] && r1.records[0].id, r2.records && r2.records[0] && r2.records[0].id], fresh, fresh7, storedLen: stored.length, l4 }; });
law('L2', lf.ok[0] && lf.ok[1] && lf.ids[0] !== lf.ids[1] && lf.fresh.length === 2, `isolate, clear register, isolate: record ids ${lf.ids.join(' and ')}; new in Alarms ${lf.fresh.length} (want 2 distinct)`);
law('L7', lf.ok[2] && lf.fresh7.length === 1 && lf.storedLen <= 500, `5,000-character reason: stored ${lf.storedLen} characters (cap 500), Alarms records ${lf.fresh7.length} (want 1)`);
law('L4', !!lf.l4.st && lf.l4.okA && lf.l4.okB && lf.l4.differ, `point table, state "${lf.l4.st || '—'}", event ${lf.l4.ev || '—'}, run Z05 then Z06: ${lf.l4.why || (lf.l4.okB ? lf.l4.n + ' rows are the Z06 points' : 'rows ' + lf.l4.got + ' want ' + lf.l4.wantB) + (lf.l4.differ ? '' : ' (the two sets are equal: law measures nothing)')}`);

// ── H3 + H1 modals: every equipment class opens its own modal ───────────────────────────────────────────────────
const classes = new Map();
for (const [tab, sub] of SHEETS) {
  await showSheet(pg, tab, sub);
  const found = await pg.evaluate(() => [...document.querySelectorAll('[data-rz-equipment]')]
    .filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.getAttribute('data-rz-equipment').split(':')[0]));
  for (const c of found) if (!classes.has(c)) classes.set(c, [tab, sub]);
}
const own = [], generic = [], partial = [];
let modalPaint = 0;
for (const [cls, [tab, sub]] of classes) {
  await showSheet(pg, tab, sub);
  const r = await pg.evaluate(async (cls, paintSrc) => {
    const paint = new Function('return ' + paintSrc)();
    const el = [...document.querySelectorAll(`[data-rz-equipment^="${cls}:"]`)].find((e) => e.getBoundingClientRect().width > 0);
    if (!el) return { cls, none: true };
    el.scrollIntoView({ block: 'center' });
    /* v3.63.0: the click contract (plain click → the class's tier-2 opener) and the drawn modal — a visible dialog that
       holds an HMI sheet. It read a data-rz-modal-class attribute no renderer sets and the dblclick no opener listens
       to, so it reported 0 / 45 on every tree, the CDU L3 included. */
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 900));
    const m = [...document.querySelectorAll('[data-rz-modal-class], dialog[open], [role=dialog], .hmi-modal-back:not([hidden]), [aria-modal="true"]')]
      .filter((d) => d.getBoundingClientRect().width > 0 && getComputedStyle(d).visibility !== 'hidden');
    const mine = m.find((d) => d.getAttribute('data-rz-modal-class') === cls || d.querySelector('.hmi-host svg.hmi-svg, .hmi-m-draw svg.hmi-svg'));
    const p = m.reduce((a, d) => a + paint(d), 0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    m.forEach((d) => { const x = d.querySelector('[aria-label*="Close" i], .close, [data-close]'); if (x) x.click(); });
    return { cls, own: !!mine, sym: mine ? mine.querySelectorAll('svg.hmi-svg .hmi-node [data-sym]').length : 0, paint: p };
  }, cls, PROBE.paint.toString());
  await wait(250);
  modalPaint += r.paint || 0;
  (r.own && r.sym >= 8 ? own : generic).push(r.cls);
  if (r.own && r.sym > 0 && r.sym < 8) partial.push(r.cls + ' ' + r.sym);
}
law(STRICT_ALL ? 'H3' : 'H3 (reported)', !STRICT_ALL || (classes.size > 0 && generic.length === 0), `classes with their own L3 schematic: ${own.length} / ${classes.size}` +
  (partial.length ? ` — drawn with < 8 symbols: ${partial.join(', ')}` : '') + (generic.length ? ` — missing: ${generic.filter((c) => !partial.some((x) => x.startsWith(c + ' '))).join(', ')}` : ''));
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
    const no = v.closest('.hmi-frame').querySelector('.hmi-sheet-no'), lines = no ? Math.round(no.getBoundingClientRect().height / parseFloat(getComputedStyle(no).fontSize)) : 0;
    const hw = v.closest('.hmi-host').getBoundingClientRect().width, narrowed = fr.width < hw - 2;   // a legacy float beside the frame squeezed it (Room Layout 227 of 362 px)
    const ok = sw <= cw && fr.right <= cw + 1 && (w <= f + 1 || getComputedStyle(vp).overflowX === 'auto') && lines <= 1 && !narrowed;
    return { id, ok, why: `${Math.round(w)}/${Math.round(f)}${w > f + 1 ? ' scrolls in frame' : ''} page ${sw}/${cw}${lines > 1 ? ' sheet number on ' + lines + ' lines' : ''}${narrowed ? ' frame ' + Math.round(fr.width) + ' of host ' + Math.round(hw) : ''}` };
  }, legacyId, hmiId));
}
law('H6', narrow.every((r) => r.ok), '390 light: ' + narrow.map((r) => `${r.id} ${r.why}`).join(', '));
law('F8', narrow.some((r) => r.id === 'hmiFireSvg' && r.ok), '390 fire sheet fits or scrolls inside its frame, no page overflow');
await ph.close();

await browser.close();
srv.close();
console.log(`test-dh-drawings: ${fail ? fail + ' failed' : 'all passed'}`);
process.exit(fail ? 1 : 0);
