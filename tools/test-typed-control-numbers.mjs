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
const PLANT = [['"conv.fire-system.jockey_on": 11.5', '"conv.fire-system.jockey_on": 11'], ['"conv.fuel-system.day_tank_fill_start": 50', '"conv.fuel-system.day_tank_fill_start": 55'], ['"inrow": 32', '"inrow": 31']];
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
  'fuel-system': () => { const l = document.querySelector('#fuel-dt-basis [data-basis-line]'), m = l && /fill \d+(?:\.\d+)?→\d+(?:\.\d+)? %/.exec(l.textContent); return m ? m[0] : ''; },
  /* the note must also fit its drawing: a text past the viewBox is cut off (red at 1440 with the first, longer note) */
  'cdu-mini-bms': () => { const n = [...document.querySelectorAll('svg text')].find((x) => /SETPOINT/.test(x.textContent)); if (!n) return '';
    const vb = n.ownerSVGElement.viewBox.baseVal, b = n.getBBox(), over = b.x + b.width - (vb.x + vb.width);
    return n.textContent.replace(/^.*?SETPOINT/, 'SETPOINT') + (over > 0.5 ? ' [past the drawing by ' + over.toFixed(1) + ']' : ''); }
};
const want = {
  false: { 'fire-system': /^11\.5 \/ 12\.8 bar$/, 'fuel-system': /^fill 50→90 %$/, 'cdu-mini-bms': /TT-01 = 32 °C \(floor 18 °C\)(?!.*past the drawing)/ },
  true: { 'fire-system': /^11\.0 \/ 12\.8 bar$/, 'fuel-system': /^fill 55→90 %$/, 'cdu-mini-bms': /TT-01 = 31 °C \(floor 18 °C\)(?!.*past the drawing)/ }
};
let bad = 0;
for (const pl of [false, true]) {
  planted = pl;
  for (const page of Object.keys(read)) {
    const pg = await browser.newPage(), errs = [];
    pg.on('pageerror', (e) => errs.push(e.message));
    await pg.setViewport({ width: 1440, height: 900 });
    await primeCockpitAuditDocument(pg, 'dark');
    await pg.goto(ORIGIN + page + '.html', { waitUntil: 'networkidle2', timeout: 90000 });
    try { await enterAuthorizedAuditState(pg, page); } catch (e) { /* a public page has no gate */ }
    await pg.waitForFunction((f) => !!new Function('return (' + f + ')()')(), { timeout: 20000 }, read[page].toString()).catch(() => {});
    const got = await pg.evaluate(read[page]);
    const ok = want[pl][page].test(got) && errs.length === 0;
    if (!ok) bad++;
    console.log(`${ok ? 'PASS' : 'FAIL'} T3 ${pl ? 'planted' : 'as served'} ${page}: "${got.slice(0, 90)}"${errs.length ? ' · page errors ' + errs.slice(0, 2).join(' | ') : ''}`);
    await pg.close();
  }
}
await browser.close(); srv.close();
console.log(`${bad ? 'FAIL' : 'PASS'} T3 the pages act on the registry's numbers (${bad} failed)`);
process.exit(bad || process.exitCode ? 1 : 0);
