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
  return { n: tags.length, bad, list: tags.map((x) => x.txt) };
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
  const epmsBus = () => pe.evaluate((H) => ['i1-cb:bus', 'i2-cb:bus', 'bb-r:bb1', 'bb-r:bb2'].map((k) => { const t = document.querySelector(H + ' [data-val="' + k + '"]'); return t ? t.textContent.trim() : null; }), EPMS_HV);
  if (want('E19')) {
    const v = await epmsBus();
    const mv = (t) => { const m = /^BUS [AB] · 20 kV nom · (\d+\.\d+) kV · /.exec(t || ''); return m ? +m[1] : null; };
    ok(v.slice(0, 2).every((t) => { const x = mv(t); return x !== null && x < 20 && x > 18; }) && /^BB1 150 kV$/.test(v[2]) && /^BB2 150 kV$/.test(v[3]),
      `E19 EPMS: 20 kV sections show their voltage under load (18-20 kV), BB1 / BB2 150 kV: ${JSON.stringify(v)}`);
  }
  if (want('E3') || want('E19')) {
    const b = await pe.evaluate(breakersOf, EPMS_HV);
    ok(b && b.cover.length === 0, `E3c EPMS HV/MV@1440 breaker glyphs / lamps cover ${b ? b.cover.length : '?'} words: ${b ? JSON.stringify(b.cover.slice(0, 5)) : ''}`);
    ok(b && b.n > 0 && b.miss.length === 0, `E3 EPMS HV/MV@1440 ${b ? b.miss.length : '?'} of ${b ? b.n : '?'} breakers lack a state glyph, a lamp or a value tag with a number: ${b ? b.miss.slice(0, 4).join(', ') : ''}`);
    /* planted: open CB-IN1 from its inspector */
    await pe.keyboard.press('Escape');
    const pt = await pe.evaluate((H) => { const g = document.querySelector(H + ' .hmi-node[data-node="i1-cb"]'); if (!g) return null; g.scrollIntoView({ block: 'center', inline: 'center' }); const r = (g.querySelector('.hmi-hit') || g).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, EPMS_HV);
    if (pt) { await pe.mouse.click(pt.x, pt.y); await sleep(500); const s = 'aside.rz-inspector.open [data-rz-action="sim-open"], .rz-cvm:not([hidden]) [data-rz-cvm-act="sim-open"]'; if (await pe.$(s)) { await pe.click(s); await sleep(600); } await pe.keyboard.press('Escape'); await sleep(300); }   /* v3.93.0: a breaker opens in the equipment modal */
    const st = await pe.evaluate(brkState, EPMS_HV, 'i1-cb');
    ok(st && st.glyph === 'open', `E3 EPMS planted: CB-IN1 opened, its glyph reads ${st ? st.glyph : 'no node'} (want open; node state ${st && st.state})`);
    if (want('E19')) { const v = await epmsBus(); ok(/^BUS A · 20 kV nom · 0 V DEAD · /.test(v[0] || '') && /^BUS B · 20 kV nom · \d+\.\d+ kV · /.test(v[1] || ''), `E19 EPMS planted: CB-IN1 open with the tie open, BUS A reads DEAD, BUS B stays live: ${JSON.stringify(v.slice(0, 2))}`); }
  }
  if (want('E6')) { const s = await pe.evaluate(switchOf); ok(s && s.length === 2 && JSON.stringify(s) === JSON.stringify([['iso', 'false'], ['line', 'true']]), `E6 EPMS@1440 no 3D | One-line switch with One-line pressed: ${JSON.stringify(s)}`); }
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
  if (want('E19')) { const v = await pd.evaluate(voltsOf, DC_OV); ok(v && v.n === 3 && v.bad.length === 0, `E19 DC AI overview: ${v ? v.n : '?'} bus voltages (want 3: HV, MVB-A, MVB-B) ${v ? JSON.stringify(v.bad.length ? v.bad : v.list) : ''}`); }
  if (want('E3')) { const b = await pd.evaluate(breakersOf, DC_OV); ok(b && b.cover.length === 0, `E3c DC AI overview@1440 breaker glyphs / lamps cover ${b ? b.cover.length : '?'} words: ${b ? JSON.stringify(b.cover.slice(0, 5)) : ''}`); }
  if (want('E6')) { const s = await pd.evaluate(switchOf); ok(s && s.length === 2 && JSON.stringify(s) === JSON.stringify([['iso', 'false'], ['line', 'true']]), `E6 DC AI@1440 no 3D | One-line switch with One-line pressed: ${JSON.stringify(s)}`); }
  if (want('E3') || want('E2') || want('E19')) {
    await dcHall1(pd);
    if (want('E19')) {
      const v = await pd.evaluate(voltsOf, DC_H1);
      ok(v && v.n === 4 && v.bad.length === 0, `E19 DC AI DH-01: ${v ? v.n : '?'} bus voltages (want 4: MSB A/B, UPS OUT A/B) ${v ? JSON.stringify(v.bad.length ? v.bad : v.list) : ''}`);
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
