#!/usr/bin/env node
/* test-electrical-bms.mjs — PRD-ELECTRICAL-BMS (owner R186, 2026-11-22: "Sempurnakan juga yg substation/electricalnya")
 *
 * The electrical one-lines of both cockpits read like the BMS hall: one state language, equipment with a state glyph,
 * a lamp and a value tag, a sheet that fills its stage, a summary that reads, and a phone that can read the labels.
 * Both pages draw their one-line with the shared renderer js/rz-hmi-sheet.js; this gate reads the RENDER.
 *
 *   E1 fit       at 1440 the drawing spans 90-102 % of its stage width on open (EPMS HV/MV, DC AI overview); the EPMS
 *                stage stops above the status bar and no equipment tag sits under it
 *   E2 state     every power conductor carries a state (data-vstate); running conductors are one ink, the same on both
 *                pages; no conductor is painted in a feed-identity hue (--hmi-feed-a / --hmi-feed-b)
 *   E3 breaker   every breaker (cb*) on EPMS HV/MV and DC AI DH-01 has a state glyph, a lamp and a value tag with a number;
 *                planted: DC AI busway A trip -> Q-BWA glyph tripped + lamp alarm; EPMS CB-IN1 opened -> glyph open
 *   E4 wiring    DC AI overview: 0 unconnected symbols; 8 hall blocks, each on a conductor
 *   E5 summary   the energized-path summary is >= 240 px wide at 1440 x 900 and its text is not clipped
 *   E6 switch    a 3D | One-line switch on both electrical views, One-line pressed by default (full 3D laws: phase E3)
 *   E7 phone     at 390 every visible label renders >= 11 px, the page never scrolls sideways, 0 page errors
 *
 * Red on 2b6721123 before E1 (quoted in the PRD). Usage: node tools/test-electrical-bms.mjs [--only=E1,E3]
 */
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSupabaseModule, signedInStorage, signedInSupabaseBody } from './lib/signed-in-supabase.mjs';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ONLY = ((process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '').split(',').filter(Boolean);
const want = (law) => !ONLY.length || ONLY.includes(law);
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.html': 'text/html' };
const srv = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
});
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };

const EPMS_HV = '#epms-sheet-host', EPMS_LV = '#epms-lv-host';
const DC_OV = '.hmi-host[data-hmi-sheet="dh-e-001"]', DC_H1 = '.hmi-host[data-hmi-sheet="dh-e-101"]';

async function openEpms(W, theme) {
  const pg = await browser.newPage(); pg.errors = []; pg.on('pageerror', (e) => pg.errors.push(e.message));
  await pg.setViewport({ width: W, height: W > 800 ? 900 : 844, deviceScaleFactor: 1, isMobile: W < 800, hasTouch: W < 800 });
  await primeCockpitAuditDocument(pg, theme);
  await pg.goto(ORIGIN + 'EPMS_Telemetry.html', { waitUntil: 'networkidle0', timeout: 90000 });
  await enterAuthorizedAuditState(pg, 'epms');
  await sleep(2500);
  return pg;
}
async function openDcai(W, theme) {
  const pg = await browser.newPage(); pg.errors = []; pg.on('pageerror', (e) => pg.errors.push(e.message));
  await pg.setRequestInterception(true);
  pg.on('request', (r) => (isSupabaseModule(r.url())
    ? r.respond({ status: 200, contentType: 'text/javascript', body: signedInSupabaseBody({ email: 'educator@resistancezero.com', tier: 'pro', educator: true }) })
    : (r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort())));
  await pg.setViewport({ width: W, height: W > 800 ? 900 : 844, deviceScaleFactor: 1, isMobile: W < 800, hasTouch: W < 800 });
  await pg.evaluateOnNewDocument((t, entries) => {
    try { localStorage.setItem('theme', t); localStorage.setItem('rz_cookie_consent', 'declined'); entries.forEach(([k, v]) => localStorage.setItem(k, v)); } catch (x) { /* no storage */ }
  }, theme, signedInStorage({ email: 'educator@resistancezero.com', tier: 'pro', role: 'educator' }));
  await pg.goto(ORIGIN + 'datahallAI.html', { waitUntil: 'networkidle2', timeout: 90000 });
  await pg.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});   // the signed-in stub reloads once
  await enterAuthorizedAuditState(pg, 'dc-ai');
  await pg.evaluate(() => document.querySelector('#tabs [data-t="elec"]').click());
  await pg.waitForFunction((s) => { const h = document.querySelector(s); return h && h.getBoundingClientRect().width > 0; }, { timeout: 30000 }, DC_OV).catch(() => {});
  await sleep(1500);
  return pg;
}
async function dcHall1(pg) {
  await pg.evaluate(() => { const b = document.querySelector('#elecTabs .et[data-ep="dh01"]') || [...document.querySelectorAll('.elec-tabs button')].find((x) => x.textContent.trim() === 'DH-01'); if (b) b.click(); });
  await pg.waitForFunction((s) => { const h = document.querySelector(s); return h && h.getBoundingClientRect().width > 0; }, { timeout: 30000 }, DC_H1).catch(() => {});
  await sleep(800);
}

/* ---- in-page measurements ---- */
const fitOf = (sel) => {
  const host = document.querySelector(sel); if (!host) return null;
  const vp = (host.querySelector('.hmi-vp') || host).getBoundingClientRect();
  const rs = [...host.querySelectorAll('.hmi-node, path.hmi-edge')].map((x) => x.getBoundingClientRect()).filter((r) => r.width || r.height);
  if (!rs.length || !vp.width) return null;
  const l = Math.min(...rs.map((r) => r.left)), r = Math.max(...rs.map((x) => x.right));
  return { cover: (r - l) / vp.width };
};
/* R190 E1b: after "Whole", the drawn content sits inside the visible stage on both axes (above a status bar if any) */
const wholeOf = async (pg, sel) => {
  const has = await pg.evaluate((sel) => { const b = document.querySelector(sel + ' [data-z="all"]'); if (!b) return false; b.click(); return true; }, sel);
  if (!has) return { missing: true };
  await sleep(400);
  return pg.evaluate((sel) => {
    const host = document.querySelector(sel), vp = host.querySelector('.hmi-vp');
    let st = null; for (let p = host.parentElement; p && p !== document.body; p = p.parentElement) { const oy = getComputedStyle(p).overflowY; if ((oy === 'auto' || oy === 'scroll') && p.clientHeight) { st = p; break; } }
    const sr = st ? st.getBoundingClientRect() : { top: 0, bottom: innerHeight, left: 0, right: innerWidth };
    const sb = document.querySelector('.status-bar'), barTop = sb && getComputedStyle(sb).display !== 'none' ? sb.getBoundingClientRect().top : innerHeight;
    const bottom = Math.min(innerHeight, sr.bottom, barTop), top = Math.max(0, sr.top);
    const rs = [...host.querySelectorAll('.hmi-node, path.hmi-edge')].map((x) => x.getBoundingClientRect()).filter((r) => r.width || r.height);
    const l = Math.min(...rs.map((r) => r.left)), r = Math.max(...rs.map((x) => x.right)), t = Math.min(...rs.map((x) => x.top)), b = Math.max(...rs.map((x) => x.bottom));
    const v = vp.getBoundingClientRect();
    return { inside: l >= v.left - 1 && r <= v.right + 1 && t >= top - 1 && b <= bottom + 1, box: [Math.round(l), Math.round(t), Math.round(r), Math.round(b)], stage: [Math.round(v.left), Math.round(top), Math.round(v.right), Math.round(bottom)] };
  }, sel);
};
const barOf = (sel) => {
  const sb = document.querySelector('.status-bar'); if (!sb || getComputedStyle(sb).display === 'none') return { bar: false };
  const s = sb.getBoundingClientRect(), stage = document.getElementById('epms-sld-view').getBoundingClientRect();
  const under = [...document.querySelectorAll(sel + ' text[data-role="tag"]')].filter((t) => {
    /* only a tag the operator can see: inside the stage's scroll box (one scrolled past its bottom edge is clipped) */
    const r = t.getBoundingClientRect(); if (r.bottom <= stage.top || r.top >= stage.bottom) return false;
    return r.width && r.bottom > s.top && r.top < s.bottom && r.right > s.left && r.left < s.right;
  }).map((t) => t.textContent.trim());
  return { bar: true, stageBottom: Math.round(Math.min(stage.bottom, innerHeight)), barTop: Math.round(s.top), under };
};
/* E15: every drawn item (junctions excepted) is equipment the page can open */
const unclickableOf = (sel) => {
  const host = document.querySelector(sel); if (!host) return null;
  const all = [...host.querySelectorAll('.hmi-node[data-node]')].filter((g) => g.getAttribute('data-sym') !== 'junction');
  return { n: all.length, bare: all.filter((g) => !g.hasAttribute('data-rz-equipment')).map((g) => g.getAttribute('data-node') + ':' + g.getAttribute('data-sym')) };
};
/* one node per symbol kind: click it, then the inspector or the equipment modal names its tag */
async function clickKinds(pg, sel, tagAlways = true) {
  const pick = await pg.evaluate((H) => {
    const seen = {}, out = [];
    document.querySelectorAll(H + ' .hmi-node[data-node]').forEach((g) => { const k = g.getAttribute('data-sym'); if (k === 'junction' || seen[k]) return; seen[k] = 1; out.push([g.getAttribute('data-node'), k, (g.getAttribute('aria-label') || '').split(' — ')[0], /^sld-item:/.test(g.getAttribute('data-rz-equipment') || '')]); });
    return out;
  }, sel);
  const bad = [];
  for (const [id, sym, tag, generic] of pick) {
    await pg.keyboard.press('Escape'); await sleep(120); await pg.keyboard.press('Escape'); await sleep(120);
    const pt = await pg.evaluate((H, i) => { const g = document.querySelector(H + ' .hmi-node[data-node="' + i + '"]'); g.scrollIntoView({ block: 'center', inline: 'center' }); const r = (g.querySelector('.hmi-hit') || g).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel, id);
    await pg.mouse.click(pt.x, pt.y); await sleep(600);
    const t = await pg.evaluate(() => [...document.querySelectorAll('aside.rz-inspector.open, .rz-cvm:not([hidden]), .hmi-modal-back:not([hidden]), .dh-modal-host:not([hidden]), .eq-hmi:not([hidden])')].filter((x) => x.getClientRects().length).map((x) => x.textContent).join(' ').replace(/\s+/g, ' ').slice(0, 600));
    /* a class with its own mimic may title it by the plant it shows (Q-INA opens the 20 kV board); a generic item and
       every EPMS item name the drawing tag */
    if (!t.trim()) bad.push(id + ':' + sym + ' opened nothing');
    else if ((tagAlways || generic) && (!tag || !t.includes(tag))) bad.push(id + ':' + sym + ' opened without its tag ' + tag);
  }
  await pg.keyboard.press('Escape'); await sleep(120); await pg.keyboard.press('Escape');
  return { n: pick.length, bad };
}
/* E17: each stream's UPS shows its parallel module count, rating and redundancy, equal to the engine */
/* E18: the critical bus is drawn down to the PDU and its racks, with the engine's counts (conv-engine >= 2.9.0) */
const pduOf = (sel) => {
  const e = window.CONV_CALC && window.CONV_CALC.snapshot && window.CONV_CALC.snapshot.electrical; const host = document.querySelector(sel);
  if (!e || !host) return null;
  const g = (x) => Math.round(x).toLocaleString('en-US');
  return ['a', 'b'].map((s) => {
    const txt = (id) => { const n = host.querySelector('.hmi-node[data-node="' + id + '"]'); return n ? [n, ...host.querySelectorAll('[data-name-of="' + id + '"], [data-val^="' + id + ':"]')].map((x) => x.textContent).join(' | ').replace(/\s+/g, ' ') : null; };
    const pdu = txt('q' + s + '-pdu'), rk = txt('p' + s + '-ld');
    const lacks = [];
    if (!pdu) lacks.push('no PDU node'); else {
      ['× ' + e.pdu_per_hall_per_stream, e.pdu_per_hall_per_stream + ' × ' + g(e.pdu_kva_rated) + ' kVA'].forEach((w) => { if (pdu.indexOf(w) < 0) lacks.push('PDU lacks "' + w + '"'); });
      if (!/\d+\.\d % · /.test(pdu)) lacks.push('PDU shows no loading %');
    }
    if (!rk || rk.indexOf('× ' + e.racks_per_pdu + ' racks per PDU') < 0) lacks.push('racks node lacks "× ' + e.racks_per_pdu + ' racks per PDU"');
    const path = ['u' + s + '-m', 'u' + s + '-n', 'u' + s + '-o'].every((id) => host.querySelector('[data-edge="' + id + '"]'));
    if (!path) lacks.push('UPS -> CB-PDU -> PDU -> racks not connected');
    return { s, lacks };
  });
};
const upsOf = (sel) => {
  const e = window.CONV_CALC && window.CONV_CALC.snapshot && window.CONV_CALC.snapshot.electrical; const host = document.querySelector(sel);
  if (!e || !host) return null;
  const halls = (window.CONV_CALC.snapshot.campus || {}).halls || [], n = e.ups_modules_per_system / (halls.length || 1);
  const g = (x) => Math.round(x).toLocaleString('en-US');
  return ['a', 'b'].map((s) => {
    const inv = host.querySelector('.hmi-node[data-node="u' + s + '-inv"]'); if (!inv) return { s, miss: 'no inverter' };
    const id = 'u' + s + '-inv', txt = [inv, ...host.querySelectorAll('[data-name-of="' + id + '"], [data-val^="' + id + ':"]')].map((x) => x.textContent).join(' | ').replace(/\s+/g, ' ');
    const want = ['× ' + n, n + ' × ' + g(e.ups_module_kw_rated) + ' kW', e.ups_redundancy];
    return { s, n, txt: txt.slice(0, 160), lacks: want.filter((w) => !txt.includes(w)), stack: inv.querySelectorAll('[data-stack]').length };
  });
};
/* E16: every trapped-key group of the sheet draws its key on each member and one dashed link line */
const keysOf = (sel, sheetVar) => {
  const host = document.querySelector(sel), S = sheetVar.split('.').reduce((o, k) => o && o[k], window);
  if (!host || !S) return null;
  const groups = S.keys || [], bad = [];
  groups.forEach((g) => {
    g.members.forEach((m) => { const k = host.querySelector('.hmi-node[data-node="' + m + '"] .hmi-key[data-key="' + g.id + '"]'); if (!k || !/K\d/.test(k.textContent)) bad.push(g.id + ' no glyph on ' + m); });
    /* a group within 520 units draws its dashed link (a real path, not the placeholder); a wider one is matched by number */
    const P = g.members.map((m) => S.nodes.find((n) => n.id === m)).filter(Boolean), sp = Math.max(Math.max(...P.map((q) => q.x)) - Math.min(...P.map((q) => q.x)), Math.max(...P.map((q) => q.y)) - Math.min(...P.map((q) => q.y)));
    const L = host.querySelector('[data-key-link="' + g.id + '"]');
    if (sp <= 520 && !(L && L.getAttribute('d') && L.getAttribute('d').length > 12)) bad.push(g.id + ' no link line');
  });
  return { n: groups.length, bad };
};
/* E11: the dash of a running power edge moves at a speed set by its load ratio (RZConvVfx.dashSeconds), not one constant */
const incDash = (sel) => { const p = document.querySelector(sel + ' path[data-edge-flow="i2-a"]'); return p ? parseFloat(getComputedStyle(p).animationDuration) || 0 : null; };
const dashOf = (sel) => {
  const host = document.querySelector(sel); if (!host) return null;
  const run = [...host.querySelectorAll('.hmi-flow[data-flow="running"]')];
  const dur = run.map((p) => parseFloat(getComputedStyle(p).animationDuration) || 0).filter((d) => d > 0);
  const stop = [...host.querySelectorAll('.hmi-flow[data-flow="stopped"]')].filter((p) => getComputedStyle(p).animationName !== 'none').length;
  return { n: run.length, distinct: [...new Set(dur.map((d) => d.toFixed(3)))].length, min: Math.min(...dur), max: Math.max(...dur), stopMoving: stop };
};
/* E14: a long power conductor says what it is — a run over 400 sheet units carries its own line label (a bus is
   exempt: it is named by its bus tag, E19) */
const longRunsOf = (sel) => {
  const host = document.querySelector(sel); if (!host) return null;
  const svg = host.querySelector('svg.hmi-svg'), bare = [];
  svg.querySelectorAll(['m-power', 'm-feed_a', 'm-feed_b', 'm-dc'].map((m) => 'path.hmi-edge.' + m + '[data-edge]:not(.hmi-flow):not(.w-inst):not(.w-signal):not(.w-bus)').join(', ')).forEach((p) => {
    let r; try { r = p.getBBox(); } catch (x) { return; }
    const len = Math.max(r.width, r.height), id = p.getAttribute('data-edge');
    const t = svg.querySelector('text[data-line-of="' + CSS.escape(id) + '"]'), shown = t && getComputedStyle(t).display !== 'none' && t.getClientRects().length > 0;
    if (len > 400 && !shown) bare.push(id + ' ' + Math.round(len) + (t ? ' (label hidden at this zoom)' : ''));
  });
  return bare;
};
/* E10: a relay shows its IEEE C37.2 function inside its box and a lamp that follows its state */
const relaysOf = (sel) => {
  const host = document.querySelector(sel); if (!host) return null;
  const LAMP = { normal: 'healthy', energized: 'healthy', running: 'healthy', 'picked-up': 'warn', warning: 'warn', tripped: 'alarm', fault: 'alarm', alarm: 'alarm' };
  const miss = [];
  const rs = [...host.querySelectorAll('.hmi-node[data-sym="protectionRelay"]')];
  rs.forEach((g) => {
    const id = g.getAttribute('data-node'), inst = g.querySelector('text[data-role="inst"]'), lamp = g.querySelector('.hmi-relay [data-lamp]');
    if (!inst || !/^\d{2}/.test(inst.textContent.trim())) miss.push(id + ': no ANSI number in the box');
    if (!lamp) { miss.push(id + ': no lamp'); return; }
    const want = LAMP[g.getAttribute('data-state')] || 'off', got = lamp.getAttribute('data-lamp-state');
    if (got !== want) miss.push(id + ': lamp ' + got + ' for state ' + g.getAttribute('data-state') + ' (want ' + want + ')');
  });
  return { n: rs.length, miss, healthy: rs.filter((g) => { const l = g.querySelector('.hmi-relay [data-lamp]'); return l && l.getAttribute('data-lamp-state') === 'healthy'; }).length };
};
const POWER = 'path.hmi-edge[data-edge]:not(.hmi-flow):not(.w-inst):not(.w-signal)';
const strokesOf = (sel, POWER) => {
  const host = document.querySelector(sel); if (!host) return null;
  const cs = getComputedStyle(host), probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const svg = host.querySelector('svg.hmi-svg') || host.querySelector('svg');
  const resolve = (v) => { probe.style.stroke = v; svg.appendChild(probe); const c = getComputedStyle(probe).stroke; probe.remove(); return c; };
  const feedA = resolve('var(--hmi-feed-a)'), feedB = resolve('var(--hmi-feed-b)');
  const edges = [...host.querySelectorAll(POWER)].filter((e) => /\bm-(power|feed_a|feed_b)\b/.test(e.getAttribute('class')));
  const run = new Set(); let noState = 0, identity = 0;
  edges.forEach((e) => {
    const st = e.getAttribute('data-vstate'), c = getComputedStyle(e).stroke;
    if (!st) noState++;
    if (st === 'running') run.add(c);
    if (c === feedA || c === feedB) identity++;
  });
  /* the moving flow overlay counts too: a feed hue there reads as identity on a live bus (seen on DH-01 MSB, v3.94 dev) */
  /* direction arrows too: a feed-A blue arrowhead on DC AI's incomer read as a standby conductor (v3.94 dev) */
  host.querySelectorAll('path.hmi-arrow').forEach((f) => { if (!/\bm-(power|feed_a|feed_b)\b/.test(f.getAttribute('class'))) return; const c = getComputedStyle(f).fill; if (c === feedA || c === feedB) identity++; });
  host.querySelectorAll('path.hmi-flow').forEach((f) => { if (!/\bm-(power|feed_a|feed_b)\b/.test(f.getAttribute('class'))) return; const d = getComputedStyle(f); if (d.display === 'none' || d.visibility === 'hidden' || +d.opacity === 0) return; const c = d.stroke; if (c === feedA || c === feedB) identity++; });
  return { n: edges.length, noState, identity, run: [...run], cs: !!cs };
};
const breakersOf = (sel) => {
  const host = document.querySelector(sel); if (!host) return null;
  const miss = [];
  host.querySelectorAll('.hmi-node[data-sym^="cb"]').forEach((g) => {
    const id = g.getAttribute('data-node');
    const glyph = g.querySelector('[data-brk-glyph]'), lamp = g.querySelector('[data-lamp]') || host.querySelector('[data-lamp-of="' + id + '"]');
    const tag = host.querySelector('[data-brk-tag-of="' + id + '"]');
    const why = [];
    if (!glyph) why.push('glyph'); if (!lamp) why.push('lamp'); if (!tag || !/\d/.test(tag.textContent)) why.push('tag');
    if (why.length) miss.push(id + ':' + why.join('+'));
  });
  /* a glyph or lamp drawn over a word hides it (seen on DC AI overview: DH-01 zone title, Q-INA tag, v3.94 dev) */
  const words = [...host.querySelectorAll('text')].map((t) => ({ t: t.textContent.trim(), r: t.getBoundingClientRect() })).filter((w) => w.r.width > 0 && w.t);
  const cover = [];
  host.querySelectorAll('[data-brk-glyph], [data-lamp]').forEach((m) => { const c = m.getBoundingClientRect(); if (!c.width) return; words.forEach((w) => { if (c.left < w.r.right && w.r.left < c.right && c.top < w.r.bottom && w.r.top < c.bottom) cover.push(w.t); }); });
  return { n: host.querySelectorAll('.hmi-node[data-sym^="cb"]').length, miss, cover };
};
/* E19 (§A6): every bus tag shows a voltage with a unit; the number equals the regulation formula written out here
   independently of js/rz-elec-voltage.js (± 0.1 %), its inputs are the engine's, and a dead bus reads 0 V DEAD */
const voltsOf = (sel) => {
  const host = document.querySelector(sel), snap = window.DCAI_CALC && window.DCAI_CALC.snapshot; if (!host || !snap) return null;
  const D = (k) => snap.distribution[k], bad = [];
  const tags = [...host.querySelectorAll('text[data-volt]')].map((t) => ({ txt: t.textContent, pre: t.getAttribute('data-volt-pre'), o: JSON.parse(t.getAttribute('data-volt')), st: t.getAttribute('data-volt-state') }));
  tags.forEach((x) => {
    const m = /(\d+(?:\.\d+)?) (k?V)( DEAD)?$/.exec(x.txt); if (!m) { bad.push(x.txt + ': no voltage with a unit'); return; }
    const shown = +m[1] * (m[2] === 'kV' ? 1000 : 1), o = x.o, k = Math.sqrt(1 + o.xr * o.xr), sin = Math.sqrt(1 - o.pf * o.pf);
    const want = x.st === 'dead' ? 0 : o.nominal * (1 - o.loading * o.zPct * (o.pf / k + sin * o.xr / k) / 100);
    if (x.st === 'dead' ? !/0 V DEAD$/.test(x.txt) : Math.abs(shown - want) > Math.max(want * 0.001, m[2] === 'V' ? 0.5 : 5)) bad.push(x.txt + ': want ' + want.toFixed(1) + ' V');
    if (/^MVB/.test(x.pre) && (o.zPct !== D('main_tx_impedance_pct') || o.nominal !== D('mv_kv') * 1000 || o.loading !== D('main_tx_loading_contingency_pct') / 200)) bad.push(x.pre + ' inputs not the engine main TX');
    if (/^(MSB|UPS OUT)/.test(x.pre) && o.nominal !== D('voltage_ll_v')) bad.push(x.pre + ' nominal not distribution.voltage_ll_v');
    if (/^HV/.test(x.pre) && o.nominal !== D('hv_intake_kv') * 1000) bad.push(x.pre + ' nominal not distribution.hv_intake_kv');
  });
  return { n: tags.length, bad, list: tags.map((x) => x.txt), dead: tags.filter((x) => x.st === 'dead').map((x) => x.txt) };
};
const brkState = (sel, id) => {
  const host = document.querySelector(sel), g = host && host.querySelector('.hmi-node[data-node="' + id + '"]'); if (!g) return null;
  const glyph = g.querySelector('[data-brk-glyph]'), lamp = g.querySelector('[data-lamp]') || host.querySelector('[data-lamp-of="' + id + '"]');
  return { state: g.getAttribute('data-state'), glyph: glyph && glyph.getAttribute('data-brk'), lamp: lamp && lamp.getAttribute('data-lamp-state') };
};
const textPx = (sels) => {
  const out = {};
  sels.forEach((sel) => {
    const host = document.querySelector(sel); if (!host) { out[sel] = null; return; }
    const px = [...host.querySelectorAll('text')].filter((t) => { const cs = getComputedStyle(t); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = t.getBoundingClientRect(); return r.width > 0 && t.textContent.trim(); })
      .map((t) => { const m = t.getScreenCTM(); return { px: parseFloat(getComputedStyle(t).fontSize) * (m ? Math.hypot(m.a, m.b) : 1), t: t.textContent.trim().slice(0, 16) }; })
      .sort((a, b) => a.px - b.px);
    out[sel] = { n: px.length, min: px[0] ? +px[0].px.toFixed(1) : null, small: px.filter((p) => p.px < 11 - 0.05).length, ex: px.slice(0, 3).map((p) => p.t + '@' + p.px.toFixed(1)) };
  });
  return out;
};
/* E6 (full): the 3D equipment view, read from the drawn svg. Counts per class, neutral bodies, lamps, one front height per
   class, 30° axes, no caption over a unit. `want` maps a class to its expected count. */
const isoOf = (sel, want, sheetSel) => {
  const host = document.querySelector(sel); if (!host) return null;
  const units = [...host.querySelectorAll('.el-iso-unit')], out = { counts: {}, lacks: [] };
  units.forEach((u) => { const k = u.getAttribute('data-el-cls'); out.counts[k] = (out.counts[k] || 0) + 1; });
  Object.keys(want).forEach((k) => { if (out.counts[k] !== want[k]) out.lacks.push(k + ' ' + out.counts[k] + ' drawn, ' + want[k] + ' expected'); });
  const rgb = (c) => (c.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
  let faces = 0, tinted = 0;
  host.querySelectorAll('.el-iso-unit polygon').forEach((p) => { const [r, g, b] = rgb(getComputedStyle(p).fill); faces++; if (Math.max(r, g, b) - Math.min(r, g, b) > 16) tinted++;   /* chroma over 16 / 255 reads as a colour, the graphite greys sit at 6-10 */ });
  if (!faces || (faces - tinted) / faces < 0.95) out.lacks.push(`bodies ${faces - tinted} of ${faces} neutral`);
  let run = 0;
  host.querySelectorAll('.el-iso-lamp').forEach((l) => {
    const st = l.getAttribute('data-lamp-state'), f = getComputedStyle(l).fill, [r, g, b] = rgb(f);
    if (st === 'running') { run++; if (!(g > r + 40 && g > b + 20)) out.lacks.push('running lamp not green: ' + f); }
    else if (st !== 'alarm' && st !== 'warn' && f !== 'none') out.lacks.push(st + ' lamp filled: ' + f);
  });
  if (!run) out.lacks.push('no running lamp');
  const P = (q) => (q.getAttribute('points') || '').trim().split(/\s+/).map((v) => v.split(',').map(Number));
  const heights = {};
  units.forEach((u) => {
    const fr = P(u.querySelector('[data-face="front"]')), tp = P(u.querySelector('[data-face="top"]')), k = u.getAttribute('data-el-cls');
    (heights[k] = heights[k] || new Set()).add((fr[3][1] - fr[0][1]).toFixed(2));
    const slope = (tp[1][1] - tp[0][1]) / (tp[1][0] - tp[0][0]);
    if (Math.abs(slope - Math.tan(Math.PI / 6)) > 0.01) out.lacks.push('axis not 30°: ' + u.getAttribute('data-tag') + ' slope ' + slope.toFixed(3));
  });
  Object.keys(heights).forEach((k) => { if (heights[k].size !== 1) out.lacks.push(k + ' front heights ' + [...heights[k]].join('/')); });
  host.querySelectorAll('.el-iso-caption').forEach((t) => {
    const r = t.getBoundingClientRect();   /* a caption runs down at 30°: sample its line and ask what is painted under each point */
    for (let i = 1; i < 12; i++) { const x = r.left + (r.width * i) / 12, y = r.top + (r.height * i) / 12;
      const hit = document.elementsFromPoint(x, y).find((n) => n.closest && n.closest('.el-iso-unit'));
      if (hit) { out.lacks.push('caption "' + t.textContent + '" over ' + hit.closest('.el-iso-unit').getAttribute('data-tag')); break; } }
  });
  /* accuracy: each unit names a symbol the one-line really draws, its lamp is that symbol's state (independent map
     of the sheet's data-state), a shared symbol says so and the number of units sharing it is what it claims */
  if (sheetSel) {
    const sheet = document.querySelector(sheetSel), MAP = { running: 'running', closed: 'running', energized: 'running', standby: 'standby',
      open: 'stopped', stopped: 'stopped', deenergized: 'stopped', alarm: 'alarm', trip: 'alarm', tripped: 'alarm', warn: 'warn', warning: 'warn' };
    const share = {};
    units.forEach((u) => { const n = u.getAttribute('data-node'); if (n) share[n] = (share[n] || 0) + 1; });
    let checked = 0;
    units.forEach((u) => {
      const n = u.getAttribute('data-node'), lamp = u.querySelector('.el-iso-lamp').getAttribute('data-lamp-state'), rep = +u.getAttribute('data-rep'), lab = u.getAttribute('aria-label') || '';
      if (!n) { if (lamp !== 'nodata' || u.hasAttribute('tabindex')) out.lacks.push(u.getAttribute('data-tag') + ': no symbol but lamp ' + lamp); return; }
      const g = sheet && sheet.querySelector('.hmi-node[data-node="' + n + '"]');
      if (!g) { out.lacks.push(u.getAttribute('data-tag') + ' points at ' + n + ', not drawn on the one-line'); return; }
      const want = MAP[g.getAttribute('data-state')] || 'nodata';
      if (lamp !== want) out.lacks.push(`${u.getAttribute('data-tag')} lamp ${lamp}, one-line ${n} is ${g.getAttribute('data-state')}`);
      if (rep > 1 && !new RegExp('one symbol for ' + rep + ' units').test(lab)) out.lacks.push(u.getAttribute('data-tag') + ' shares ' + n + ' but does not say so');
      if (rep > share[n]) out.lacks.push(`${n}: claims ${rep} units, ${share[n]} drawn`);
      checked++;
    });
    out.lampChecked = checked;
  }
  out.lacks = out.lacks.slice(0, 8);
  return out;
};
const switchOf = () => {
  const g = document.querySelector('.el-proj'); if (!g) return null;
  return [...g.querySelectorAll('button')].map((b) => [b.getAttribute('data-proj'), b.getAttribute('aria-pressed')]);
};

const run = { epms: {}, dcai: {} };

/* ---- 1440, dark: E1 E2 E3 E4 E5 E6 ---- */
{
  const pe = await openEpms(1440, 'dark');
  if (want('E1')) {
    const f = await pe.evaluate(fitOf, EPMS_HV), bar = await pe.evaluate(barOf, EPMS_HV);
    ok(f && f.cover >= 0.9 && f.cover <= 1.02, `E1 EPMS HV/MV@1440 the drawing spans ${f ? Math.round(f.cover * 100) : '?'} % of its stage width on open (want 90-102 %)`);
    ok(!bar.bar || bar.stageBottom <= bar.barTop + 1, `E1 EPMS@1440 the sheet stage runs under the status bar (stage bottom ${bar.stageBottom}, bar top ${bar.barTop})`);
    ok(!bar.bar || bar.under.length === 0, `E1 EPMS HV/MV@1440 equipment tags under the status bar: ${JSON.stringify(bar.under)}`);
  }
  if (want('E1')) {
    const w = await wholeOf(pe, EPMS_HV);
    ok(w && w.inside, `E1b EPMS HV/MV@1440 after Whole the drawing ${w && w.missing ? 'has no Whole control' : 'leaves the visible stage: box ' + JSON.stringify(w && w.box) + ' stage ' + JSON.stringify(w && w.stage)}`);
    await pe.evaluate((sel) => { const b = document.querySelector(sel + ' [data-z="fit"]'); if (b) b.click(); }, EPMS_HV); await sleep(300);
  }
  if (want('E2')) run.epms.dark = await pe.evaluate(strokesOf, EPMS_HV, POWER);
  if (want('E15')) {
    const u = await pe.evaluate(unclickableOf, EPMS_HV); ok(u && u.bare.length === 0, `E15 EPMS HV/MV: ${u ? u.bare.length : '?'} of ${u ? u.n : '?'} drawn items are not equipment: ${JSON.stringify((u || { bare: [] }).bare.slice(0, 8))}`);
    const k = await clickKinds(pe, EPMS_HV); ok(k.bad.length === 0, `E15 EPMS HV/MV: ${k.bad.length} of ${k.n} kinds do not open with their tag: ${JSON.stringify(k.bad.slice(0, 8))}`);
  }
  if (want('E14')) { const b = await pe.evaluate(longRunsOf, EPMS_HV); ok(b && b.length === 0, `E14 EPMS HV/MV: ${b ? b.length : '?'} power runs over 400 units carry no label: ${JSON.stringify((b || []).slice(0, 6))}`); }
  if (want('E10')) { const r = await pe.evaluate(relaysOf, EPMS_HV); ok(r && r.n >= 10 && r.miss.length === 0 && r.healthy >= 10, `E10 EPMS HV/MV@1440 ${r ? r.miss.length : '?'} of ${r ? r.n : '?'} relays lack an ANSI number, a lamp or a lamp that follows the state: ${r ? JSON.stringify(r.miss.slice(0, 4)) : ''}`); }
  const epmsBus = () => pe.evaluate((H) => ['i1-cb:bus', 'i2-cb:bus', 'bb-r:bb1', 'bb-r:bb2'].map((k) => { const t = document.querySelector(H + ' [data-val="' + k + '"]'); return t ? t.textContent.trim() : null; }), EPMS_HV);
  if (want('E19')) {
    const v = await epmsBus();
    const mv = (t) => { const m = /^BUS [AB] · 20 kV nom · (\d+\.\d+) kV · /.exec(t || ''); return m ? +m[1] : null; };
    ok(v.slice(0, 2).every((t) => { const x = mv(t); return x !== null && x < 20 && x > 18; }) && /^BB1 150 kV$/.test(v[2]) && /^BB2 150 kV$/.test(v[3]),
      `E19 EPMS: 20 kV sections show their voltage under load (18-20 kV), BB1 / BB2 150 kV: ${JSON.stringify(v)}`);
  }
  if (want('E11')) { const d = await pe.evaluate(dashOf, EPMS_HV); ok(d && d.n >= 10 && d.stopMoving === 0 && d.max > d.min, `E11 EPMS HV/MV: running power dashes take their period from load / capacity (not one constant), stopped ones do not move: ${JSON.stringify(d)}`); }
  if (want('E16')) {
    const k = await pe.evaluate(keysOf, EPMS_HV, 'RZEpmsSheets.sld');
    ok(k && k.n >= 3 && k.bad.length === 0, `E16 EPMS HV/MV: ${k ? k.n : '?'} key groups (want ≥ 3: two line earthing, the 20 kV 2-of-3), ${k ? k.bad.length : '?'} gaps: ${JSON.stringify((k || { bad: [] }).bad.slice(0, 6))}`);
    /* planted: close ES-L1 while DSL-L1 holds the key -> refused naming the key, ES-L1 stays open */
    await pe.keyboard.press('Escape');
    const p2 = await pe.evaluate((H) => { const g = document.querySelector(H + ' .hmi-node[data-node="l1-es"]'); if (!g) return null; g.scrollIntoView({ block: 'center', inline: 'center' }); const r = (g.querySelector('.hmi-hit') || g).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, EPMS_HV);
    let msg = '', kmod = '';
    if (p2) { await pe.mouse.click(p2.x, p2.y); await sleep(500); const s2 = 'aside.rz-inspector.open [data-rz-action="sim-close"], .rz-cvm:not([hidden]) [data-rz-cvm-act="sim-close"]'; if (await pe.$(s2)) { await pe.click(s2); await sleep(600); } msg = await pe.evaluate(() => (document.getElementById('epms-sld-msg') || {}).textContent || ''); kmod = await pe.evaluate(() => [...document.querySelectorAll('aside.rz-inspector.open, .rz-cvm:not([hidden])')].map((x) => x.textContent).join(' ').replace(/\s+/g, ' ')); await pe.keyboard.press('Escape'); await sleep(150); await pe.keyboard.press('Escape'); }
    const es = await pe.evaluate(brkState, EPMS_HV, 'l1-es');
    ok(/Key K\d+\s*trapped in DSL-L1/.test(kmod), `E16 EPMS: the ES-L1 modal states where its key is: ${(kmod.match(/Key K\d+[^—]{0,60}/) || ['none'])[0]}`);
    ok(/\bK\d+ trapped in DSL-L1\b/.test(msg) && es && es.state !== 'closed', `E16 EPMS planted: closing ES-L1 with DSL-L1 closed is refused by its key and ES-L1 stays open: msg "${msg.replace(/\s+/g, ' ').slice(0, 160)}", ES state ${es && es.state}`);
  }
  if (want('E3') || want('E19') || want('E11')) {
    const b = await pe.evaluate(breakersOf, EPMS_HV);
    ok(b && b.cover.length === 0, `E3c EPMS HV/MV@1440 breaker glyphs / lamps cover ${b ? b.cover.length : '?'} words: ${b ? JSON.stringify(b.cover.slice(0, 5)) : ''}`);
    ok(b && b.n > 0 && b.miss.length === 0, `E3 EPMS HV/MV@1440 ${b ? b.miss.length : '?'} of ${b ? b.n : '?'} breakers lack a state glyph, a lamp or a value tag with a number: ${b ? b.miss.slice(0, 4).join(', ') : ''}`);
    const inc0 = await pe.evaluate(incDash, EPMS_HV);
    /* planted: open CB-IN1 from its inspector */
    await pe.keyboard.press('Escape');
    const pt = await pe.evaluate((H) => { const g = document.querySelector(H + ' .hmi-node[data-node="i1-cb"]'); if (!g) return null; g.scrollIntoView({ block: 'center', inline: 'center' }); const r = (g.querySelector('.hmi-hit') || g).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, EPMS_HV);
    if (pt) { await pe.mouse.click(pt.x, pt.y); await sleep(500); const s = 'aside.rz-inspector.open [data-rz-action="sim-open"], .rz-cvm:not([hidden]) [data-rz-cvm-act="sim-open"]'; if (await pe.$(s)) { await pe.click(s); await sleep(600); } await pe.keyboard.press('Escape'); await sleep(300); }   /* v3.93.0: a breaker opens in the equipment modal */
    const st = await pe.evaluate(brkState, EPMS_HV, 'i1-cb');
    ok(st && st.glyph === 'open', `E3 EPMS planted: CB-IN1 opened, its glyph reads ${st ? st.glyph : 'no node'} (want open; node state ${st && st.state})`);
    if (want('E19')) { const v = await epmsBus(); ok(/^BUS A · 20 kV nom · 0 V DEAD · /.test(v[0] || '') && /^BUS B · 20 kV nom · \d+\.\d+ kV · /.test(v[1] || ''), `E19 EPMS planted: CB-IN1 open with the tie open, BUS A reads DEAD, BUS B stays live: ${JSON.stringify(v.slice(0, 2))}`); }
    if (want('E11')) {
      /* then close the tie: CB-IN2 carries both sections, its dash must run ≥ 30 % faster */
      await pe.keyboard.press('Escape'); await sleep(150); await pe.keyboard.press('Escape');
      const pt3 = await pe.evaluate((H) => { const g = document.querySelector(H + ' .hmi-node[data-node="tie"]'); if (!g) return null; g.scrollIntoView({ block: 'center', inline: 'center' }); const r = (g.querySelector('.hmi-hit') || g).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, EPMS_HV);
      if (pt3) { await pe.mouse.click(pt3.x, pt3.y); await sleep(500); const s3 = 'aside.rz-inspector.open [data-rz-action="sim-close"], .rz-cvm:not([hidden]) [data-rz-cvm-act="sim-close"]'; if (await pe.$(s3)) { await pe.click(s3); await sleep(800); } }
      const inc1 = await pe.evaluate(incDash, EPMS_HV);
      ok(inc0 > 0 && inc1 > 0 && inc1 <= 0.7 * inc0, `E11 EPMS planted: CB-IN1 open, tie closed — CB-IN2 carries both sections and its dash runs ≥ 30 % faster: period ${inc0} s -> ${inc1} s`);
    }
  }
  if (want('E14') || want('E15') || want('E17') || want('E18')) {
    await pe.evaluate(() => { const x = document.querySelector('.epms-view-btn[data-epms-view="lv"]'); if (x) x.click(); }); await sleep(1500);
    if (want('E18')) { const u = await pe.evaluate(pduOf, EPMS_LV); ok(Array.isArray(u) && u.every((x) => x.lacks.length === 0), `E18 EPMS LV: both streams drawn UPS -> PDU feeder -> PDU -> racks with the engine counts: ${JSON.stringify(u)}`); }
    if (want('E17')) { const u = await pe.evaluate(upsOf, EPMS_LV); ok(Array.isArray(u) && u.every((x) => x.lacks && x.lacks.length === 0 && x.stack >= 2), `E17 EPMS LV: each stream's UPS names × N modules, N × rating and the redundancy, drawn as a stack: ${JSON.stringify(u)}`); }
    if (want('E15')) { const u = await pe.evaluate(unclickableOf, EPMS_LV); ok(u && u.bare.length === 0, `E15 EPMS LV: ${u ? u.bare.length : '?'} of ${u ? u.n : '?'} drawn items are not equipment: ${JSON.stringify((u || { bare: [] }).bare.slice(0, 8))}`); }
    const b = await pe.evaluate(longRunsOf, EPMS_LV); ok(b && b.length === 0, `E14 EPMS LV: ${b ? b.length : '?'} power runs over 400 units carry no label: ${JSON.stringify((b || []).slice(0, 6))}`);
    await pe.evaluate(() => { const x = document.querySelector('.epms-view-btn[data-epms-view="hv"], .epms-view-btn[data-epms-view="sld"]'); if (x) x.click(); }); await sleep(800);
  }
  if (want('E6')) { const s = await pe.evaluate(switchOf); ok(s && s.length === 2 && JSON.stringify(s) === JSON.stringify([['iso', 'false'], ['line', 'true']]), `E6 EPMS@1440 no 3D | One-line switch with One-line pressed: ${JSON.stringify(s)}`); }
  if (want('E6')) {
    const e = await pe.evaluate(() => window.CONV_CALC.snapshot.electrical);
    const mv = await pe.evaluate(() => window.RZEpmsSheets.sld.nodes.filter((n) => n.sw === 'cb' && n.kv === 'mv').length);
    const wantC = { gis: e.hv_line_bays + e.hv_tx_bays + (e.hv_bus_count - 1), tx: e.hv_tx_count, mv, gen: e.genset_count };
    await pe.evaluate(() => { const b = document.querySelector('#epms-proj [data-proj="iso"]'); if (b) b.click(); }); await sleep(800);
    const iso = await pe.evaluate(isoOf, '#epms-iso-host', wantC, '#epms-sheet-host');
    ok(iso && iso.lacks.length === 0 && iso.lampChecked > 0, `E6 EPMS 3D: ${iso ? iso.lampChecked + ' lamps checked ' + JSON.stringify(iso.counts) + ' ' + iso.lacks.join('; ') : 'no 3D view'}`);
    /* a unit opens the same equipment view as its symbol */
    const opened = await pe.evaluate(async () => {
      const u = document.querySelector('#epms-iso-host .el-iso-unit[data-el-cls="gis"]'); if (!u) return null;
      const tag = u.getAttribute('data-tag'); u.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 1200));
      const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => { const r = x.getBoundingClientRect(); return r.width > 200 && r.height > 200 && x.textContent.includes(tag); });
      const res = { tag, open: !!d };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await new Promise((r) => setTimeout(r, 400));
      return res;
    });
    ok(opened && opened.open, `E6 EPMS 3D: selecting ${opened ? opened.tag : 'a GIS bay'} does not open its equipment view`);
    /* keyboard: arrow keys move between the two buttons and the choice is stored */
    await pe.evaluate(() => document.querySelector('#epms-proj [data-proj="iso"]').focus()); await pe.keyboard.press('ArrowRight'); await sleep(300);
    const kb = await pe.evaluate(() => [document.activeElement && document.activeElement.getAttribute('data-proj'), document.querySelector('#epms-proj [data-proj="line"]').getAttribute('aria-pressed'), localStorage.getItem('rz.epms.proj'), document.getElementById('epms-iso-view').hidden]);
    ok(kb[0] === 'line' && kb[1] === 'true' && kb[2] === 'line' && kb[3] === true, `E6 EPMS keyboard: ArrowRight should move to One-line, press it, store it and hide 3D: ${JSON.stringify(kb)}`);
    await pe.keyboard.press('ArrowLeft'); await sleep(300);
    await pe.reload({ waitUntil: 'networkidle0' }); await enterAuthorizedAuditState(pe, 'epms'); await sleep(2500);
    const st = await pe.evaluate(() => [document.querySelector('#epms-proj [data-proj="iso"]') && document.querySelector('#epms-proj [data-proj="iso"]').getAttribute('aria-pressed'), !document.getElementById('epms-iso-view').hidden]);
    ok(st[0] === 'true' && st[1] === true, `E6 EPMS stored choice: after a reload 3D should still be shown: ${JSON.stringify(st)}`);
    await pe.evaluate(() => { localStorage.removeItem('rz.epms.proj'); });
  }
  ok(pe.errors.length === 0, `EPMS@1440 page errors: ${pe.errors.slice(0, 2).join(' | ')}`);
  await pe.close();

  const pd = await openDcai(1440, 'dark');
  if (want('E1')) { const f = await pd.evaluate(fitOf, DC_OV); ok(f && f.cover >= 0.9 && f.cover <= 1.02, `E1 DC AI overview@1440 the drawing spans ${f ? Math.round(f.cover * 100) : '?'} % of its stage width on open (want 90-102 %)`); }
  if (want('E1')) { const w = await wholeOf(pd, DC_OV); ok(w && w.inside, `E1b DC AI overview@1440 after Whole the drawing ${w && w.missing ? 'has no Whole control' : 'leaves the visible stage: box ' + JSON.stringify(w && w.box) + ' stage ' + JSON.stringify(w && w.stage)}`); await pd.evaluate((sel) => { const b = document.querySelector(sel + ' [data-z="fit"]'); if (b) b.click(); }, DC_OV); }
  if (want('E4')) {
    const w = await pd.evaluate((sel) => {
      const host = document.querySelector(sel); if (!host) return null;
      const ends = new Set(); host.querySelectorAll('path.hmi-edge[data-ends]').forEach((p) => p.getAttribute('data-ends').split('|').forEach((x) => ends.add(x)));
      const orphans = [...host.querySelectorAll('.hmi-node')].map((g) => g.getAttribute('data-node')).filter((n) => !ends.has(n));
      const halls = [1, 2, 3, 4, 5, 6, 7, 8].map((h) => { const b = host.querySelector('[data-hall-block="DH-0' + h + '"]'); return b ? ends.has(b.getAttribute('data-node')) : false; });
      return { orphans, halls };
    }, DC_OV);
    ok(w && w.orphans.length === 0, `E4 DC AI overview: unconnected symbols ${JSON.stringify(w && w.orphans)}`);
    ok(w && w.halls.every(Boolean), `E4 DC AI overview: hall blocks on a conductor ${w ? w.halls.filter(Boolean).length : 0} of 8`);
  }
  if (want('E5')) {
    const s = await pd.evaluate(() => { const e = document.getElementById('electricalPathSummary'); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), txt: e.textContent.trim().length, clip: e.scrollWidth > e.clientWidth + 1 }; });
    ok(s && s.w >= 240 && s.txt > 20 && !s.clip, `E5 DC AI@1440x900 energized-path summary ${s ? s.w : '?'} px wide, ${s ? s.txt : '?'} chars, clipped ${s && s.clip} (want >= 240 px, text, not clipped)`);
  }
  if (want('E2')) run.dcai.dark = await pd.evaluate(strokesOf, DC_OV, POWER);
  if (want('E19')) { const v = await pd.evaluate(voltsOf, DC_OV); ok(v && v.n === 3 && v.bad.length === 0, `E19 DC AI overview: ${v ? v.n : '?'} bus voltages (want 3: HV, MVB-A, MVB-B) ${v ? JSON.stringify(v.bad.length ? v.bad : v.list) : ''}`);  ok(v && v.dead.length === 0, `E19 DC AI overview, normal 2N operation: a fed bus reads dead: ${v ? JSON.stringify(v.dead) : '?'}`); }
  if (want('E15')) {
    const u = await pd.evaluate(unclickableOf, DC_OV); ok(u && u.bare.length === 0, `E15 DC AI overview: ${u ? u.bare.length : '?'} of ${u ? u.n : '?'} drawn items are not equipment: ${JSON.stringify((u || { bare: [] }).bare.slice(0, 8))}`);
    const k = await clickKinds(pd, DC_OV, false); ok(k.bad.length === 0, `E15 DC AI overview: ${k.bad.length} of ${k.n} kinds do not open with their tag: ${JSON.stringify(k.bad.slice(0, 8))}`);
  }
  if (want('E14')) { const b = await pd.evaluate(longRunsOf, DC_OV); ok(b && b.length === 0, `E14 DC AI overview: ${b ? b.length : '?'} power runs over 400 units carry no label: ${JSON.stringify((b || []).slice(0, 6))}`); }
  if (want('E10')) { const r = await pd.evaluate(relaysOf, DC_OV); ok(r && r.n >= 2 && r.miss.length === 0 && r.healthy === r.n, `E10 DC AI overview@1440 normal operation: ${r ? r.healthy : '?'} of ${r ? r.n : '?'} relay lamps healthy ${r ? JSON.stringify(r.miss.slice(0, 4)) : ''}`); }
  if (want('E3')) { const b = await pd.evaluate(breakersOf, DC_OV); ok(b && b.cover.length === 0, `E3c DC AI overview@1440 breaker glyphs / lamps cover ${b ? b.cover.length : '?'} words: ${b ? JSON.stringify(b.cover.slice(0, 5)) : ''}`); }
  if (want('E6')) { const s = await pd.evaluate(switchOf); ok(s && s.length === 2 && JSON.stringify(s) === JSON.stringify([['iso', 'false'], ['line', 'true']]), `E6 DC AI@1440 no 3D | One-line switch with One-line pressed: ${JSON.stringify(s)}`); }
  if (want('E6')) {
    const e = await pd.evaluate(() => { const s = window.DCAI_CALC.snapshot; return { d: s.distribution, q: s.equipment }; });
    const mv = await pd.evaluate(() => [...document.querySelectorAll('.hmi-host[data-hmi-sheet="dh-e-001"] .hmi-node[data-node]')].filter((g) => /^cb-(mv|f)[A-Z]\d*$|^mv-tie$/.test(g.getAttribute('data-node'))).length);
    const wantC = { gis: e.d.hv_switchyard_bays, tx: e.d.hv_transformer_bays, mv, gen: e.q.gensets_installed };
    await pd.evaluate(() => { const b = document.querySelector('#elecProj [data-proj="iso"]'); if (b) b.click(); }); await sleep(800);
    const iso = await pd.evaluate(isoOf, '#elecIsoHost', wantC, '.hmi-host[data-hmi-sheet="dh-e-001"]');
    ok(iso && iso.lacks.length === 0 && iso.lampChecked > 0, `E6 DC AI 3D: ${iso ? iso.lampChecked : 0} lamps checked, want ${JSON.stringify(wantC)} got ${iso ? JSON.stringify(iso.counts) + ' ' + iso.lacks.join('; ') : 'no 3D view'}`);
    const opened = await pd.evaluate(async () => {
      const u = document.querySelector('#elecIsoHost .el-iso-unit[data-el-cls="tx"]'); if (!u) return null;
      const node = u.getAttribute('data-node'); u.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 1200));
      const d = [...document.querySelectorAll('[role="dialog"], .dh-insp, .rz-insp')].find((x) => { const r = x.getBoundingClientRect(); return r.width > 200 && r.height > 150; });
      const res = { node, open: !!d, text: d ? d.textContent.replace(/\s+/g, ' ').slice(0, 80) : '' };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await new Promise((r) => setTimeout(r, 400));
      return res;
    });
    ok(opened && opened.open, `E6 DC AI 3D: selecting a transformer (${opened ? opened.node : '?'}) does not open its equipment view`);
    await pd.evaluate(() => document.querySelector('#elecProj [data-proj="iso"]').focus()); await pd.keyboard.press('ArrowRight'); await sleep(300);
    const kb = await pd.evaluate(() => [document.activeElement && document.activeElement.getAttribute('data-proj'), localStorage.getItem('rz.dcai.elec.proj'), document.getElementById('elecIsoView').hidden]);
    ok(kb[0] === 'line' && kb[1] === 'line' && kb[2] === true, `E6 DC AI keyboard: ArrowRight should move to One-line, store it and hide 3D: ${JSON.stringify(kb)}`);
    await pd.evaluate(() => localStorage.removeItem('rz.dcai.elec.proj'));
  }
  if (want('E3') || want('E2') || want('E19') || want('E15')) {
    await dcHall1(pd);
    if (want('E15')) { const u = await pd.evaluate(unclickableOf, DC_H1); ok(u && u.bare.length === 0, `E15 DC AI DH-01: ${u ? u.bare.length : '?'} of ${u ? u.n : '?'} drawn items are not equipment: ${JSON.stringify((u || { bare: [] }).bare.slice(0, 8))}`); }
    if (want('E19')) {
      const v = await pd.evaluate(voltsOf, DC_H1);
      ok(v && v.n === 4 && v.bad.length === 0, `E19 DC AI DH-01: ${v ? v.n : '?'} bus voltages (want 4: MSB A/B, UPS OUT A/B) ${v ? JSON.stringify(v.bad.length ? v.bad : v.list) : ''}`);
      ok(v && v.dead.length === 0, `E19 DC AI DH-01, normal 2N operation: a fed bus reads dead: ${v ? JSON.stringify(v.dead) : '?'}`);
      await pd.evaluate(() => { const s = document.getElementById('electricalScenario'); s.disabled = false; s.value = 'utility_a_fail'; s.dispatchEvent(new Event('change', { bubbles: true })); const V = window.RZDhHmiV2; if (V) Object.keys(V.sheets).forEach((k) => V.sheets[k] && V.sheets[k].update()); });
      await sleep(900);
      const d = await pd.evaluate(voltsOf, DC_H1);
      ok(d && d.list.some((t) => /^MSB-A01 · 0 V DEAD$/.test(t)) && d.list.some((t) => /^UPS OUT A · \d+ V$/.test(t)) && d.bad.length === 0, `E19 DC AI planted utility A fail: MSB-A01 reads DEAD, UPS OUT A stays live: ${d ? JSON.stringify(d.list) : '?'}`);
      await pd.evaluate(() => { const s = document.getElementById('electricalScenario'); s.value = 'normal'; s.dispatchEvent(new Event('change', { bubbles: true })); });
      await sleep(600);
    }
    if (want('E2')) run.dcai.darkH1 = await pd.evaluate(strokesOf, DC_H1, POWER);
    if (want('E3')) {
      const b = await pd.evaluate(breakersOf, DC_H1);
      ok(b && b.cover.length === 0, `E3c DC AI DH-01@1440 breaker glyphs / lamps cover ${b ? b.cover.length : '?'} words: ${b ? JSON.stringify(b.cover.slice(0, 5)) : ''}`);
      ok(b && b.n > 0 && b.miss.length === 0, `E3 DC AI DH-01@1440 ${b ? b.miss.length : '?'} of ${b ? b.n : '?'} breakers lack a state glyph, a lamp or a value tag with a number: ${b ? b.miss.slice(0, 4).join(', ') : ''}`);
      await pd.evaluate(() => { const s = document.getElementById('electricalScenario'); s.disabled = false; s.value = 'busway_a_trip'; s.dispatchEvent(new Event('change', { bubbles: true })); const V = window.RZDhHmiV2; if (V) Object.keys(V.sheets).forEach((k) => V.sheets[k] && V.sheets[k].update()); });
      await sleep(900);
      const st = await pd.evaluate(brkState, DC_H1, 'qbwA');
      ok(st && st.glyph === 'tripped' && st.lamp === 'alarm', `E3 DC AI planted: busway A trip, Q-BWA glyph ${st && st.glyph} lamp ${st && st.lamp} (want tripped / alarm; node state ${st && st.state})`);
      await pd.evaluate(() => { const s = document.getElementById('electricalScenario'); s.value = 'normal'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    }
  }
  ok(pd.errors.length === 0, `DC AI@1440 page errors: ${pd.errors.slice(0, 2).join(' | ')}`);
  await pd.close();
}

/* ---- E2 in light too: the state ink is a token, not a dark-theme accident ---- */
if (want('E2')) {
  const pe = await openEpms(1440, 'light'); run.epms.light = await pe.evaluate(strokesOf, EPMS_HV, POWER); await pe.close();
  const pd = await openDcai(1440, 'light'); run.dcai.light = await pd.evaluate(strokesOf, DC_OV, POWER);
  /* EPMS is a dark-only cockpit (its sheet hosts carry data-theme="dark"), so in light the DC AI running ink is held to
     the shared state token itself, resolved on the page */
  run.tokenLight = await pd.evaluate(() => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.style.stroke = 'var(--vfx-run)'; const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.appendChild(p); document.body.appendChild(s); const c = getComputedStyle(p).stroke; s.remove(); return c; });
  await pd.close();
  for (const th of ['dark', 'light']) {
    const sheets = [['EPMS HV/MV', run.epms[th]], ['DC AI overview', run.dcai[th]]].concat(th === 'dark' ? [['DC AI DH-01', run.dcai.darkH1]] : []);
    for (const [name, s] of sheets) {
      ok(s && s.n > 0 && s.noState === 0, `E2 ${name} ${th}: ${s ? s.noState : '?'} of ${s ? s.n : '?'} power conductors carry no state (data-vstate)`);
      ok(s && s.identity === 0, `E2 ${name} ${th}: ${s ? s.identity : '?'} conductors painted in a feed-identity hue`);
      ok(s && s.run.length === 1, `E2 ${name} ${th}: running conductors in ${s ? s.run.length : '?'} inks ${JSON.stringify(s && s.run)} (want one)`);
    }
    const a = th === 'light' ? run.tokenLight : run.epms[th] && run.epms[th].run[0], b = run.dcai[th] && run.dcai[th].run[0];
    ok(a && a === b, `E2 ${th}: running ink differs from ${th === 'light' ? 'the --vfx-run token (EPMS is dark-only)' : 'the EPMS'} (${a} vs DC AI ${b})`);
  }
}

/* ---- E12: switching sweeps downstream (PRD-ELECTRICAL-BMS A2) ---- */
if (want('E12')) {
  const watch = (H) => {
    window.__sw = []; const t0 = performance.now();
    const mo = new MutationObserver((ms) => ms.forEach((m) => { const p = m.target; if (p.matches && p.matches('path[data-edge-flow]')) window.__sw.push({ e: p.getAttribute('data-edge-flow'), f: p.getAttribute('data-flow') || p.getAttribute('data-vmove'), hop: +(p.getAttribute('data-sweep-hop') || 0), t: performance.now() - t0 }); }));
    mo.observe(document.querySelector(H), { subtree: true, attributes: true, attributeFilter: ['data-flow', 'data-vmove'] });
    window.__swStop = () => mo.disconnect();
  };
  const openT1 = async (pg) => {
    const pt = await pg.evaluate((H) => { const g = document.querySelector(H + ' .hmi-node[data-node="t1-cb"]'); if (!g) return null; g.scrollIntoView({ block: 'center', inline: 'center' }); const r = (g.querySelector('.hmi-hit') || g).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, EPMS_HV);
    if (!pt) return false;
    await pg.mouse.click(pt.x, pt.y); await sleep(500);
    const s = 'aside.rz-inspector.open [data-rz-action="sim-open"], .rz-cvm:not([hidden]) [data-rz-cvm-act="sim-open"]';
    if (!(await pg.$(s))) return false;
    await pg.evaluate(watch, EPMS_HV); await pg.click(s); await sleep(2600);
    return pg.evaluate(() => { window.__swStop(); const first = {}; window.__sw.forEach((x) => { if (first[x.e] == null) first[x.e] = x; }); return Object.values(first); });
  };
  const summary = (ch) => {
    const byHop = {}; ch.forEach((x) => { (byHop[x.hop] = byHop[x.hop] || []).push(x.t); });
    const hops = Object.keys(byHop).map(Number).sort((a, b) => a - b), mean = hops.map((h) => byHop[h].reduce((a, b) => a + b, 0) / byHop[h].length);
    const span = ch.length ? Math.max(...ch.map((x) => x.t)) - Math.min(...ch.map((x) => x.t)) : 0;
    return { edges: ch.length, hops: hops.length, ordered: mean.every((m, i) => !i || m > mean[i - 1]), spanMs: Math.round(span) };
  };
  const pe = await openEpms(1440, 'dark');
  const a = summary((await openT1(pe)) || []);
  ok(a.edges >= 3 && a.hops >= 2 && a.ordered && a.spanMs >= 150 && a.spanMs <= 2000, `E12 EPMS: opening CB-T1 de-energises downstream hop by hop (≥ 2 hops in topological order, spread 150–2000 ms): ${JSON.stringify(a)}`);
  ok(pe.errors.length === 0, `E12 EPMS page errors: ${pe.errors.join(' | ')}`);
  await pe.close();
  const pr = await openEpms(1440, 'dark'); await pr.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const b = summary((await openT1(pr)) || []);
  ok(b.edges >= 3 && b.spanMs <= 60, `E12 EPMS reduced motion: the whole change lands at once: ${JSON.stringify(b)}`);
  await pr.close();
}

/* ---- 390: E7 ---- */
if (want('E7')) {
  const pe = await openEpms(390, 'dark');
  let t = await pe.evaluate(textPx, [EPMS_HV]);
  await pe.evaluate(() => { const x = document.querySelector('.epms-view-btn[data-epms-view="lv"]'); if (x) x.click(); }); await sleep(1500);
  Object.assign(t, await pe.evaluate(textPx, [EPMS_LV]));
  const sw = await pe.evaluate(() => document.documentElement.scrollWidth);
  for (const [k, v] of Object.entries(t)) ok(v && v.n > 0 && v.small === 0, `E7 EPMS ${k}@390 ${v ? v.small : '?'} of ${v ? v.n : '?'} labels render under 11 px (smallest ${v && v.min} px: ${v && v.ex.join(', ')})`);
  ok(sw <= 390, `E7 EPMS@390 page scrolls sideways (scrollWidth ${sw})`);
  ok(pe.errors.length === 0, `E7 EPMS@390 page errors: ${pe.errors.slice(0, 2).join(' | ')}`);
  await pe.close();
  const pd = await openDcai(390, 'dark');
  t = await pd.evaluate(textPx, [DC_OV]); await dcHall1(pd); Object.assign(t, await pd.evaluate(textPx, [DC_H1]));
  const sw2 = await pd.evaluate(() => document.documentElement.scrollWidth);
  for (const [k, v] of Object.entries(t)) ok(v && v.n > 0 && v.small === 0, `E7 DC AI ${k}@390 ${v ? v.small : '?'} of ${v ? v.n : '?'} labels render under 11 px (smallest ${v && v.min} px: ${v && v.ex.join(', ')})`);
  ok(sw2 <= 390, `E7 DC AI@390 page scrolls sideways (scrollWidth ${sw2})`);
  ok(pd.errors.length === 0, `E7 DC AI@390 page errors: ${pd.errors.slice(0, 2).join(' | ')}`);
  await pd.close();
}

await browser.close(); srv.close();
if (fails.length) { console.log(`FAIL — ${fails.length} of ${checks} checks`); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log(`PASS electrical BMS — ${checks} checks (E1-E7)`);
