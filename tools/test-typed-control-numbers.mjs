#!/usr/bin/env node
/**
 * test-typed-control-numbers.mjs — PRD-SETPOINT-SIM §C P9 law T1: a Conventional page never types a control number.
 *
 * A control number is a setpoint, a cut-in / cut-out, a fill start / stop or an alarm threshold that a controller or the
 * page's simulation acts on. It comes from the control registry (js/rz-control-points.js), never from a literal.
 * Counted, per file (the conv pages and js/conv/*.js):
 *   N  a numeric literal assigned to a name ending in _ON, _OFF, _START, _STOP, _SP, SETPOINT, _ALM, _LOWLOW or _LOW_PCT
 *      (var P_JOCKEY_ON = 11.5)
 *   X  a typed sentence that states a held value: "SETPOINT — TCV-01 holds TT-01 = 18 °C", "… setpoint 19.4 °C"
 * RATCHET: tools/typed-control-numbers.baseline.json holds the count per file. A file may fall freely; a rise, or a file
 * not in the baseline with any count, fails. Target 0 everywhere (P9). Red on the tree before P9: fire 5, fuel 4,
 * cdu-mini 1.
 *
 * T3 (--browser): each page acts on the registry's number, not a copy. The twin is served with one number changed
 * (jockey start 11.5 → 11.0 bar, fill start 50 → 55 %, In-Row TCS supply 32 → 31 °C) and the page's own text must follow
 * it; the served-as-is run must show the registry value. 0 page errors on every load.
 *
 * S8e (--browser, P9 part 2): the fire pump controllers PC-JP1 / PC-FP1 / PC-FP2 on FS-M-101, one ISA-5.1 panel bubble each
 *   from the registry, own sensing line, signal to its pump, cut-in (/ cut-out) printed = registry, no orphan bubble;
 *   one LIC per day tank on FU-M-101, level line from its tank, signal to its fill valve, fill start / stop = registry;
 *   PIC-301 on WT-M-101 (v3.115.2): one panel bubble, a signal from PT-301, a signal to the duty booster P-301A, the
 *   registry discharge setpoint printed, and PT-301 prints the same number (steady state: the booster holds it).
 *
 * Usage: node tools/test-typed-control-numbers.mjs [--list] [--baseline] [--browser]
 *        (--baseline only after a deliberate cut; RZ_T3_NOPLANT=1 turns the plant run into an unplanted one: red check)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = path.join(ROOT, 'tools/typed-control-numbers.baseline.json');
const PAGES = ['chiller-plant.html', 'water-system.html', 'fire-system.html', 'fuel-system.html', 'EPMS_Telemetry.html', 'ict.html',
  'datahall.html', 'dc-conventional.html', 'cdu-mini-bms.html'];
const CONV_JS = fs.readdirSync(path.join(ROOT, 'js/conv')).filter((f) => f.endsWith('.js')).map((f) => 'js/conv/' + f);
const N = /\b([A-Z][A-Z0-9_]*(?:_ON|_OFF|_START|_STOP|_SP|SETPOINT|_ALM|_LOWLOW|_LOW_PCT))\s*=\s*(-?\d+(?:\.\d+)?)\b/g;
const X = /\b(?:setpoint|holds)\b[^'"`<\n]{0,60}?(?:=\s*)?-?\d+(?:\.\d+)?\s*(?:°C|bar|kPa|%)/gi;

export function scan(rel) {
  const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n'), hits = [];
  lines.forEach((line, i) => {
    const t = line.trim();
    if (/^(\/\/|\*|\/\*|<!--)/.test(t)) return;                         // a comment names a value, it does not set one
    let m; N.lastIndex = 0; while ((m = N.exec(line))) hits.push({ rel, line: i + 1, kind: 'N', text: m[0] });
    X.lastIndex = 0; while ((m = X.exec(line))) hits.push({ rel, line: i + 1, kind: 'X', text: m[0] });
  });
  return hits;
}

const files = PAGES.concat(CONV_JS).filter((f) => fs.existsSync(path.join(ROOT, f)));
const all = files.flatMap(scan), count = {};
for (const h of all) count[h.rel] = (count[h.rel] || 0) + 1;
if (process.argv.includes('--baseline')) { fs.writeFileSync(BASE, JSON.stringify(count, null, 2) + '\n'); console.log('baseline written', JSON.stringify(count)); process.exit(0); }
const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : {};
let fail = 0;
for (const f of files) {
  const n = count[f] || 0, b = base[f] || 0;
  if (n > b) { fail++; console.log(`FAIL T1 ${f}: ${n} typed control numbers, ratchet ${b}`); all.filter((h) => h.rel === f).forEach((h) => console.log(`  ${h.rel}:${h.line} ${h.kind} ${h.text}`)); }
}
if (process.argv.includes('--list')) all.forEach((h) => console.log(`  ${h.rel}:${h.line} ${h.kind} ${h.text}`));
const total = all.length;
console.log(`${fail ? 'FAIL' : 'PASS'} T1 typed control numbers on the conv pages: ${total} (ratchet ${Object.values(base).reduce((a, b) => a + b, 0)}, target 0) — ${Object.entries(count).map(([k, v]) => k + ' ' + v).join(', ') || 'none'}`);
if (!process.argv.includes('--browser') || fail) process.exit(fail ? 1 : 0);

/* T3 browser law */
const http = await import('node:http');
const { default: puppeteer } = await import('puppeteer');
const { primeCockpitAuditDocument, enterAuthorizedAuditState } = await import('./lib/cockpit-audit-state.mjs');
const PLANT = [['"conv.fire-system.jockey_on": 11.5', '"conv.fire-system.jockey_on": 11'], ['"conv.fuel-system.day_tank_fill_start": 50', '"conv.fuel-system.day_tank_fill_start": 55'], ['"inrow": 32', '"inrow": 31'], ['"inrow": 1.6', '"inrow": 1.5'], ['"conv.water-system.booster_discharge_sp": 4.2', '"conv.water-system.booster_discharge_sp": 4']];
let planted = false;
const TYPES = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', woff2: 'font/woff2' };
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html', p = path.join(ROOT, rel);
  if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    if (planted && rel === 'js/rz-control-points.js' && !process.env.RZ_T3_NOPLANT) {
      let t = d.toString('utf8');
      for (const [a, b] of PLANT) { if (!t.includes(a)) { console.log('FAIL T3 plant is stale: ' + a); process.exitCode = 1; } t = t.split(a).join(b); }
      d = Buffer.from(t);
    }
    res.writeHead(200, { 'content-type': TYPES[rel.split('.').pop()] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(d);
  });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const read = {
  'fire-system': () => (document.getElementById('m-sp-jockey') || {}).textContent || '',
  /* S8e (P9 part 2): the jockey controller bubble on FS-M-101 prints the registry's cut-in / cut-out */
  'fire-system#pc': () => { const s = document.querySelector('#fire-sheet-host svg, .hmi-svg'); if (!s) return '';
    const n = [...s.querySelectorAll('.hmi-node')].find((x) => (x.getAttribute('aria-label') || '').startsWith('PC-JP1 — '));
    const t = n && s.querySelector('[data-val="' + n.getAttribute('data-node') + ':sp"]'); return t ? t.textContent.trim() : ''; },
  /* S8e: the first day-tank level controller prints the registry's fill start / stop */
  'fuel-system#lic': () => { const t = document.querySelector('#fuel-sheet-host [data-val="lc1:sp"]'); return t ? t.textContent.trim() : ''; },
  /* PIC-301 prints the booster discharge setpoint; PT-301 prints the pressure it holds (the same number at steady state) */
  'water-system#pic': () => { const t = document.querySelector('#water-svg [data-val="pic301:sp"], [data-val="pic301:sp"]'); return t ? t.textContent.trim() : ''; },
  'water-system': () => { const t = document.querySelector('[data-val="pt301:p"]'); return t ? t.textContent.trim() : ''; },
  'fuel-system': () => { const l = document.querySelector('#fuel-dt-basis [data-basis-line]'), m = l && /fill \d+(?:\.\d+)?→\d+(?:\.\d+)? %/.exec(l.textContent); return m ? m[0] : ''; },
  /* the note must also fit its drawing: a text past the viewBox is cut off (red at 1440 with the first, longer note) */
  'cdu-mini-bms': () => { const n = [...document.querySelectorAll('svg text')].find((x) => /SETPOINT/.test(x.textContent)); if (!n) return '';
    const vb = n.ownerSVGElement.viewBox.baseVal, b = n.getBBox(), over = b.x + b.width - (vb.x + vb.width);
    return n.textContent.replace(/^.*?SETPOINT/, 'SETPOINT') + (over > 0.5 ? ' [past the drawing by ' + over.toFixed(1) + ']' : ''); }
};
const want = {
  false: { 'water-system#pic': /^SP 4\.2 bar$/, 'water-system': /^4\.2 bar$/, 'fuel-system#lic': /^50 \/ 90 %$/, 'fire-system#pc': /^11\.5 \/ 12\.8 bar$/, 'fire-system': /^11\.5 \/ 12\.8 bar$/, 'fuel-system': /^fill 50→90 %$/, 'cdu-mini-bms': /TT-01 = 32 °C \(floor 18 °C\).*PDT-02 = 1\.6 bar(?!.*past the drawing)/ },
  true: { 'water-system#pic': /^SP 4\.0 bar$/, 'water-system': /^4\.0 bar$/, 'fuel-system#lic': /^55 \/ 90 %$/, 'fire-system#pc': /^11\.0 \/ 12\.8 bar$/, 'fire-system': /^11\.0 \/ 12\.8 bar$/, 'fuel-system': /^fill 55→90 %$/, 'cdu-mini-bms': /TT-01 = 31 °C \(floor 18 °C\).*PDT-02 = 1\.5 bar(?!.*past the drawing)/ }
};
let bad = 0;
for (const pl of [false, true]) {
  planted = pl;
  for (const page of Object.keys(read)) {
    const pg = await browser.newPage(), errs = [];
    pg.on('pageerror', (e) => errs.push(e.message));
    await pg.setViewport({ width: 1440, height: 900 });
    await primeCockpitAuditDocument(pg, 'dark');
    await pg.goto(ORIGIN + page.split('#')[0] + '.html', { waitUntil: 'networkidle2', timeout: 90000 });
    try { await enterAuthorizedAuditState(pg, page.split('#')[0]); } catch (e) { /* a public page has no gate */ }
    await pg.waitForFunction((f) => !!new Function('return (' + f + ')()')(), { timeout: 20000 }, read[page].toString()).catch(() => {});
    const got = await pg.evaluate(read[page]);
    const ok = want[pl][page].test(got) && errs.length === 0;
    if (!ok) bad++;
    console.log(`${ok ? 'PASS' : 'FAIL'} T3 ${pl ? 'planted' : 'as served'} ${page}: "${got.slice(0, 90)}"${errs.length ? ' · page errors ' + errs.slice(0, 2).join(' | ') : ''}`);
    await pg.close();
  }
}
/* S8e (PRD-SETPOINT-SIM P9 part 2): every registry loop on FS-M-101 is one ISA-5.1 panel bubble (instPanel) tagged as the
   registry says, fed by its own sensing line (an instrument line ending on the bubble, NFPA 20), joined by a signal to
   the pump it starts (mv.node), printing the registry cut-in (/ cut-out); no other bubble on the sheet (no orphan) */
{
  planted = false;
  const pg = await browser.newPage(), errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: 1440, height: 900 }); await primeCockpitAuditDocument(pg, 'dark');
  await pg.goto(ORIGIN + 'fire-system.html', { waitUntil: 'networkidle2', timeout: 90000 });
  try { await enterAuthorizedAuditState(pg, 'fire-system'); } catch (e) { /* public */ }
  await new Promise((r) => setTimeout(r, 3000));
  const g = await pg.evaluate(() => {
    const C = window.RZControlPoints, L = C ? C.loops('fs-m-101') : [], svg = document.querySelector('.hmi-svg');
    if (!svg) return { loops: L.length, err: 'no sheet' };
    const nodes = [...svg.querySelectorAll('.hmi-node')], near = (pt, n, pad) => { const b = n.getBBox(); return pt[0] >= b.x - pad && pt[0] <= b.x + b.width + pad && pt[1] >= b.y - pad && pt[1] <= b.y + b.height + pad; };
    const ends = (w) => [...svg.querySelectorAll('path.hmi-edge.' + w)].map((p) => { const a = p.getPointAtLength(0), b = p.getPointAtLength(p.getTotalLength()); return [[a.x, a.y], [b.x, b.y]]; });
    const sig = ends('w-signal'), ins = ends('w-inst');
    const bubbles = nodes.filter((n) => n.getAttribute('data-sym') === 'instPanel').map((n) => (n.getAttribute('aria-label') || '').split(' — ')[0]);
    return { loops: L.length, bubbles, rows: L.map((l) => {
      const c = nodes.filter((n) => (n.getAttribute('aria-label') || '').startsWith(l.tag + ' — ')), c0 = c[0], pump = nodes.find((n) => n.getAttribute('data-node') === l.mv.node);
      const t = c0 && svg.querySelector('[data-val="' + c0.getAttribute('data-node') + ':sp"]');
      return { tag: l.tag, n: c.length, sym: c0 && c0.getAttribute('data-sym'), sense: c0 ? ins.filter((e) => near(e[0], c0, 4) || near(e[1], c0, 4)).length : 0,
        sig: c0 && pump ? sig.filter((e) => (near(e[0], c0, 6) && near(e[1], pump, 6)) || (near(e[1], c0, 6) && near(e[0], pump, 6))).length : 0,
        sp: t ? t.textContent.trim() : '', want: C.value(l.sp).toFixed(1) + (l.stop ? ' / ' + C.value(l.stop).toFixed(1) : '') + ' bar' }; }) };
  });
  const f = [];
  if (g.err || g.loops < 3) f.push(`registry loops on FS-M-101 ${g.loops} (want 3: PC-JP1, PC-FP1, PC-FP2)${g.err ? ' · ' + g.err : ''}`);
  for (const r of g.rows || []) {
    if (r.n !== 1 || r.sym !== 'instPanel') f.push(`${r.tag}: ${r.n} bubbles (${r.sym}), want 1 instPanel`);
    if (r.sense < 1) f.push(`${r.tag}: no sensing line on the bubble`);
    if (r.sig < 1) f.push(`${r.tag}: no signal joining the bubble and its pump`);
    if (r.sp !== r.want) f.push(`${r.tag}: prints "${r.sp}", registry "${r.want}"`);
  }
  const orphan = (g.bubbles || []).filter((t) => !(g.rows || []).some((r) => r.tag === t));
  if (orphan.length) f.push('orphan bubbles ' + orphan.join(', '));
  if (errs.length) f.push('page errors ' + errs.slice(0, 2).join(' | '));
  f.forEach((x) => console.log('FAIL S8e ' + x)); bad += f.length;
  console.log(`${f.length ? 'FAIL' : 'PASS'} S8e pump controllers on FS-M-101: ${(g.rows || []).map((r) => r.tag + ' ' + r.sp).join(' · ')}`);
  await pg.close();
}
/* S8e fuel: one level controller per day tank on FU-M-101 (LIC-<set>), fed by its tank at the bubble's process port, a
   signal to that row's fill valve, the registry fill start / stop printed; no other bubble on the sheet */
{
  planted = false;
  const pg = await browser.newPage(), errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: 1440, height: 900 }); await primeCockpitAuditDocument(pg, 'dark');
  await pg.goto(ORIGIN + 'fuel-system.html', { waitUntil: 'networkidle2', timeout: 90000 });
  try { await enterAuthorizedAuditState(pg, 'fuel-system'); } catch (e) { /* public */ }
  await new Promise((r) => setTimeout(r, 3000));
  const g = await pg.evaluate(() => {
    const C = window.RZControlPoints, L = C ? C.loops('fu-m-101')[0] : null, svg = document.querySelector('#fuel-sheet-host svg.hmi-svg');
    if (!svg || !L) return { err: !L ? 'no registry loop on fu-m-101' : 'no sheet' };
    const nodes = [...svg.querySelectorAll('.hmi-node')], by = (id) => nodes.find((n) => n.getAttribute('data-node') === id);
    const near = (pt, n, pad) => { const b = n.getBBox(); return pt[0] >= b.x - pad && pt[0] <= b.x + b.width + pad && pt[1] >= b.y - pad && pt[1] <= b.y + b.height + pad; };
    const ends = (w) => [...svg.querySelectorAll('path.hmi-edge.' + w)].map((p) => { const a = p.getPointAtLength(0), b = p.getPointAtLength(p.getTotalLength()); return [[a.x, a.y], [b.x, b.y]]; });
    const sig = ends('w-signal'), ins = ends('w-inst'), want = C.value(L.sp) + ' / ' + C.value(L.stop) + ' %';
    const tanks = nodes.filter((n) => /^dt\d+$/.test(n.getAttribute('data-node')));
    const bubbles = nodes.filter((n) => n.getAttribute('data-sym') === 'instPanel');
    return { tanks: tanks.length, bubbles: bubbles.length, want, rows: tanks.map((t) => {
      const k = t.getAttribute('data-node').slice(2), c = by('lc' + k), xv = by('xv' + k), tv = c && svg.querySelector('[data-val="lc' + k + ':sp"]');
      return { k, tag: c ? (c.getAttribute('aria-label') || '').split(' — ')[0] : null, dt: (t.getAttribute('aria-label') || '').split(' — ')[0],
        sense: c ? ins.filter((e) => (near(e[0], t, 4) && near(e[1], c, 4)) || (near(e[1], t, 4) && near(e[0], c, 4))).length : 0,
        sig: c && xv ? sig.filter((e) => (near(e[0], c, 6) && near(e[1], xv, 6)) || (near(e[1], c, 6) && near(e[0], xv, 6))).length : 0, sp: tv ? tv.textContent.trim() : '' }; }) };
  });
  const f = [];
  if (g.err) f.push(g.err);
  else {
    if (!g.tanks || g.bubbles !== g.tanks) f.push(`${g.bubbles} level-controller bubbles for ${g.tanks} day tanks`);
    for (const r of g.rows) {
      const set = (r.dt || '').replace(/^DT-GEN-/, '');
      if (r.tag !== 'LIC-' + set) f.push(`row ${r.k}: controller ${r.tag} (want LIC-${set} beside ${r.dt})`);
      if (r.sense < 1) f.push(`row ${r.k}: no level line from ${r.dt} to its controller`);
      if (r.sig < 1) f.push(`row ${r.k}: no signal from the controller to its fill valve`);
      if (r.sp !== g.want) f.push(`row ${r.k}: prints "${r.sp}", registry "${g.want}"`);
    }
  }
  if (errs.length) f.push('page errors ' + errs.slice(0, 2).join(' | '));
  f.forEach((x) => console.log('FAIL S8e fuel ' + x)); bad += f.length;
  console.log(`${f.length ? 'FAIL' : 'PASS'} S8e day-tank level controllers on FU-M-101: ${g.rows ? g.rows.length : 0} tanks, ${g.bubbles || 0} LIC, "${g.want || ''}"`);
  await pg.close();
}
/* S8e water (v3.115.2): PIC-301 on WT-M-101, the booster set's pressure controller: one instPanel bubble, a signal from
   the transmitter PT-301 (pv.node) and a signal to the duty booster pump (mv.node), the registry setpoint printed; no
   other panel bubble on the sheet */
{
  planted = false;
  const pg = await browser.newPage(), errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: 1440, height: 900 }); await primeCockpitAuditDocument(pg, 'dark');
  await pg.goto(ORIGIN + 'water-system.html', { waitUntil: 'networkidle2', timeout: 90000 });
  try { await enterAuthorizedAuditState(pg, 'water-system'); } catch (e) { /* public */ }
  await new Promise((r) => setTimeout(r, 3000));
  const g = await pg.evaluate(() => {
    const C = window.RZControlPoints, L = C ? C.loops('wt-m-101') : [], svg = document.getElementById('water-svg') || document.querySelector('.hmi-svg');
    if (!svg) return { loops: L.length, err: 'no sheet' };
    const nodes = [...svg.querySelectorAll('.hmi-node')], by = (id) => nodes.find((n) => n.getAttribute('data-node') === id);
    const near = (pt, n, pad) => { const b = n.getBBox(); return pt[0] >= b.x - pad && pt[0] <= b.x + b.width + pad && pt[1] >= b.y - pad && pt[1] <= b.y + b.height + pad; };
    const sig = [...svg.querySelectorAll('path.hmi-edge.w-signal')].map((p) => { const a = p.getPointAtLength(0), b = p.getPointAtLength(p.getTotalLength()); return [[a.x, a.y], [b.x, b.y]]; });
    const joins = (x, y) => (x && y ? sig.filter((e) => (near(e[0], x, 6) && near(e[1], y, 6)) || (near(e[1], x, 6) && near(e[0], y, 6))).length : 0);
    const bubbles = nodes.filter((n) => n.getAttribute('data-sym') === 'instPanel').map((n) => (n.getAttribute('aria-label') || '').split(' — ')[0]);
    return { loops: L.length, bubbles, rows: L.map((l) => {
      const c = nodes.filter((n) => (n.getAttribute('aria-label') || '').startsWith(l.tag + ' — ')), c0 = c[0], t = c0 && svg.querySelector('[data-val="' + c0.getAttribute('data-node') + ':sp"]');
      return { tag: l.tag, kind: l.kind, n: c.length, sym: c0 && c0.getAttribute('data-sym'), fromPv: joins(c0, by(l.pv.node)), toMv: joins(c0, by(l.mv.node)),
        sp: t ? t.textContent.trim() : '', want: 'SP ' + C.value(l.sp).toFixed(1) + ' bar' }; }) };
  });
  const f = [];
  if (g.err || g.loops !== 1) f.push(`registry loops on WT-M-101 ${g.loops} (want 1: PIC-301)${g.err ? ' · ' + g.err : ''}`);
  for (const r of g.rows || []) {
    if (r.n !== 1 || r.sym !== 'instPanel') f.push(`${r.tag}: ${r.n} bubbles (${r.sym}), want 1 instPanel`);
    if (r.fromPv < 1) f.push(`${r.tag}: no signal from its transmitter`);
    if (r.toMv < 1) f.push(`${r.tag}: no signal to the pump it drives`);
    if (r.sp !== r.want) f.push(`${r.tag}: prints "${r.sp}", registry "${r.want}"`);
  }
  const orphan = (g.bubbles || []).filter((t) => !(g.rows || []).some((r) => r.tag === t));
  if (orphan.length) f.push('orphan bubbles ' + orphan.join(', '));
  if (errs.length) f.push('page errors ' + errs.slice(0, 2).join(' | '));
  f.forEach((x) => console.log('FAIL S8e water ' + x)); bad += f.length;
  console.log(`${f.length ? 'FAIL' : 'PASS'} S8e booster pressure controller on WT-M-101: ${(g.rows || []).map((r) => r.tag + ' ' + r.kind + ' ' + r.sp).join(' · ')}`);
  await pg.close();
}
/* S8e cdu (P9 part 4, v3.116.2): the CDU P&ID (hand-drawn, sheet 'cdu-pid') carries its two controllers from the registry:
   TIC-01 (TT-01 -> TCV-01, or the air-coil fans on the air-cooled L2A type) and PDIC-02 (PDT-02 -> the duty pump's VFD).
   Each: one bubble [data-loop], a signal line (path.sch-sig) from its transmitter and one to what it drives, the registry
   setpoint of the selected CDU type printed; no other controller bubble on the drawing. Checked on In-Row and on L2A. */
{
  planted = false;
  const pg = await browser.newPage(), errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: 1440, height: 900 }); await primeCockpitAuditDocument(pg, 'dark');
  await pg.goto(ORIGIN + 'cdu-mini-bms.html', { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 2000));
  const f = [], seen = [];
  for (const type of ['inrow', 'l2a']) {
    await pg.evaluate((t) => { const b = document.querySelector('button[data-type="' + t + '"]'); if (b) b.click(); }, type);
    await new Promise((r) => setTimeout(r, 800));
    const g = await pg.evaluate((type) => {
      const C = window.RZControlPoints, L = C && C.loops ? C.loops('cdu-pid') : [], svg = document.querySelector('#pidBox svg');
      if (!svg) return { loops: L.length, err: 'no P&ID' };
      const L2A = type === 'l2a';
      const byTag = (t) => svg.querySelector('[data-tag="' + t + '"]') || [...svg.querySelectorAll('.pid-inst')].find((x) => (x.getAttribute('aria-label') || '').startsWith(t + ' '));
      const near = (pt, n, pad) => { const b = n.getBBox(); return pt[0] >= b.x - pad && pt[0] <= b.x + b.width + pad && pt[1] >= b.y - pad && pt[1] <= b.y + b.height + pad; };
      const sig = [...svg.querySelectorAll('path.sch-sig')].map((p) => { const a = p.getPointAtLength(0), b = p.getPointAtLength(p.getTotalLength()); return [[a.x, a.y], [b.x, b.y]]; });
      const joins = (x, y) => (x && y ? sig.filter((e) => (near(e[0], x, 3) && near(e[1], y, 3)) || (near(e[1], x, 3) && near(e[0], y, 3))).length : 0);
      const ctl = [...svg.querySelectorAll('[data-loop]')].map((n) => n.getAttribute('data-loop'));
      return { loops: L.length, ctl, rows: L.map((l) => {
        const c = [...svg.querySelectorAll('[data-loop="' + l.tag + '"]')], c0 = c[0], v = C.value(l.sp, type);
        const mvTag = L2A && l.mv.node === 'TCV-01' ? 'AIR-COIL' : l.mv.node, t = svg.querySelector('[data-sp="' + l.tag + '"]');
        return { tag: l.tag, n: c.length, fromPv: joins(c0, byTag(l.pv.tag)), toMv: joins(c0, byTag(mvTag)), mvTag,
          sp: t ? [...t.childNodes].filter((x) => x.nodeType === 3).map((x) => x.data).join('').trim() : '', want: 'SP ' + (l.tag.startsWith('TIC') ? v + ' °C' : v.toFixed(1) + ' bar') }; }) };
    }, type);
    if (g.err || g.loops !== 2) { f.push(`${type}: registry loops on cdu-pid ${g.loops} (want 2: TIC-01, PDIC-02)${g.err ? ' · ' + g.err : ''}`); continue; }
    for (const r of g.rows) {
      if (r.n !== 1) f.push(`${type} ${r.tag}: ${r.n} bubbles, want 1`);
      if (r.fromPv < 1) f.push(`${type} ${r.tag}: no signal from its transmitter`);
      if (r.toMv < 1) f.push(`${type} ${r.tag}: no signal to ${r.mvTag}`);
      if (r.sp !== r.want) f.push(`${type} ${r.tag}: prints "${r.sp}", registry "${r.want}"`);
      seen.push(type + ' ' + r.tag + ' ' + r.sp);
    }
    const orphan = g.ctl.filter((t) => !g.rows.some((r) => r.tag === t));
    if (orphan.length) f.push(`${type}: orphan controller bubbles ${orphan.join(', ')}`);
  }
  if (errs.length) f.push('page errors ' + errs.slice(0, 2).join(' | '));
  f.forEach((x) => console.log('FAIL S8e cdu ' + x)); bad += f.length;
  console.log(`${f.length ? 'FAIL' : 'PASS'} S8e CDU controllers on the cdu-mini P&ID: ${seen.join(' · ')}`);
  await pg.close();
}
/* S8f (v3.115.2): a controller bubble's accessible name (and so its inspector title) says its tag once. The sheet engine
   names a node "<tag> — <label>"; a label that starts with the tag again read "PIC-301 — PIC-301 — P-301A …" */
for (const page of ['chiller-plant', 'fire-system', 'fuel-system', 'water-system']) {
  planted = false;
  const pg = await browser.newPage(); await pg.setViewport({ width: 1440, height: 900 }); await primeCockpitAuditDocument(pg, 'dark');
  await pg.goto(ORIGIN + page + '.html', { waitUntil: 'networkidle2', timeout: 90000 });
  try { await enterAuthorizedAuditState(pg, page); } catch (e) { /* public */ }
  await new Promise((r) => setTimeout(r, 2500));
  const g = await pg.evaluate(() => { const all = [...document.querySelectorAll('.hmi-node[aria-label]')].map((n) => n.getAttribute('aria-label'));
    return { n: all.filter((a) => / controller \(/.test(a)).length, twice: all.filter((a) => /^(\S+) — \1 — /.test(a)) }; });
  const ok = g.n > 0 && !g.twice.length; if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'} S8f ${page}: ${g.n} controller bubbles, ${g.twice.length} name their tag twice${g.twice.length ? ' (' + g.twice.slice(0, 2).join(' | ') + ')' : ''}`);
  await pg.close();
}
await browser.close(); srv.close();
console.log(`${bad ? 'FAIL' : 'PASS'} T3 the pages act on the registry's numbers (${bad} failed)`);
process.exit(bad || process.exitCode ? 1 : 0);
