#!/usr/bin/env node
/*
 * PRD-Q03 browser gate: an incident's "Reproduce" link opens the calculator in the state the dossier claims.
 *
 *   node tools/test-incidents-reproduce.mjs        # exit 1 on any failed law (run under rz-lane)
 *
 * L3  opening each rendered link restores every input it carries: rzScenario.capture() equals the payload inputs
 * L4  the restored calculator shows the incident's gap: TIA score below the all-ticked baseline (100 %) and every
 *     "Top gaps" card is one of the entry's violated items; tier advisor Physical score below its defaults
 * L6  the #reproduce section at 390 and 1440, dark and light: no horizontal overflow, no shadow / dashed border /
 *     radius > 4 px / transform inside it, and axe finds no serious or critical violation in it
 *
 * Links are read from the built dossier pages (not rebuilt here), so the gate checks what ships.
 * The static half (payload shape, validation rules, placement) is tools/test-incidents-reproduce.py.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const AXE = fs.readFileSync(path.join(ROOT, 'tools/vendor/axe.min.js'), 'utf8');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

let fail = 0;
const law = (id, ok, msg) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${msg}`); };

// ── links from the built pages ────────────────────────────────────────────────────────────────────────────────────
const entries = [];
for (const f of fs.readdirSync(ROOT).filter((n) => /^incident-.+\.html$/.test(n)).sort()) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of s.matchAll(/<div class="rp-entry" id="([^"]+)"[\s\S]*?class="rp-open" href="([^"]+)"/g)) {
    const href = m[2].replace(/&amp;/g, '&');
    const b64 = href.split('#rzs=')[1];
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    entries.push({ page: f, id: m[1], href, payload });
  }
}
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/reproduce-baselines.json'), 'utf8')).baselines;
const violated = (e) => Object.entries(e.payload.inputs)
  .filter(([k, v]) => v.t === 'checkbox' && v.v === false).map(([k]) => base['tia-t3-ent-all'].labels[k]);

// ── server ────────────────────────────────────────────────────────────────────────────────────────────────────────
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(url, vp = { width: 1440, height: 900 }) {
  const pg = await browser.newPage();
  await pg.setViewport(vp);
  // no third-party calls in the gate
  await pg.setRequestInterception(true);
  pg.on('request', (r) => (r.url().startsWith(ORIGIN) || r.url().startsWith('data:') ? r.continue() : r.abort()));
  await pg.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  await wait(1300); // handleLink re-applies at 350 and 900 ms
  return pg;
}

const readTia = (pg) => pg.evaluate(() => ({
  score: parseFloat(document.getElementById('scoreValue').textContent),
  recs: [...document.querySelectorAll('#recCards .rec-card h4')].map((h) => h.textContent.trim()),
}));
const readTier = (pg) => pg.evaluate(() => parseFloat(document.getElementById('physicalVal').textContent));
const capture = (pg) => pg.evaluate(() => window.rzScenario.capture());

// baselines with nothing changed: the reference L4 compares against
async function baselineScore(calc) {
  const b = calc === 'tia' ? base['tia-t3-ent-all'] : base['tier-defaults'];
  const link = b.page + '#rzs=' + Buffer.from(JSON.stringify({ v: 1, calc, inputs: b.inputs })).toString('base64url');
  const pg = await open(ORIGIN + link);
  const v = calc === 'tia' ? (await readTia(pg)).score : await readTier(pg);
  await pg.close();
  return v;
}
const ref = { tia: await baselineScore('tia'), tier: await baselineScore('tier') };
law('L4-base', ref.tia === 100, `all-ticked TIA baseline scores ${ref.tia} % (expected 100); tier defaults Physical ${ref.tier}`);

// ── L3 + L4 per entry ─────────────────────────────────────────────────────────────────────────────────────────────
law('L3-n', entries.length > 0, `${entries.length} reproduce link(s) found on the built dossier pages`);
for (const e of entries) {
  const pg = await open(ORIGIN + e.href.replace(/^\.?\//, ''));
  const got = await capture(pg);
  const miss = Object.entries(e.payload.inputs).filter(([k, v]) => !got[k] || got[k].v !== v.v).map(([k]) => k);
  law('L3', !miss.length, `${e.page}:${e.id} restores ${Object.keys(e.payload.inputs).length} inputs`
    + (miss.length ? ` — not restored: ${miss.slice(0, 4).join(', ')}` : ''));
  if (e.payload.calc === 'tia') {
    const r = await readTia(pg);
    const want = violated(e);
    const stray = r.recs.filter((t) => !want.includes(t));
    law('L4', r.score < ref.tia && r.recs.length === Math.min(3, want.length) && !stray.length,
      `${e.page}:${e.id} TIA ${r.score} % < ${ref.tia} %; top gaps ${r.recs.length} = violated items`
      + (stray.length ? ` — stray: ${stray[0]}` : ''));
  } else {
    const v = await readTier(pg);
    law('L4', v < ref.tier, `${e.page}:${e.id} tier Physical ${v} < defaults ${ref.tier}`);
  }
  await pg.close();
}

// ── L6 the section itself ─────────────────────────────────────────────────────────────────────────────────────────
const UNGATE = () => {
  document.body.classList.remove('locked');
  document.querySelectorAll('.root-gate,.rz-modal-overlay').forEach((n) => n.remove());
};
const STYLE = () => {
  const sec = document.getElementById('reproduce');
  const bad = [];
  for (const n of [sec, ...sec.querySelectorAll('*')]) {
    const cs = getComputedStyle(n);
    const tag = n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.split(' ')[0] : '');
    if (cs.boxShadow !== 'none') bad.push(tag + ' shadow');
    // the one sanctioned dotted line: rz-explain's glossary-term underline (js/rz-explain.js), site-wide
    if (/dashed|dotted/.test(cs.borderStyle) && !n.classList.contains('rzx-trigger')) bad.push(tag + ' dashed');
    if (parseFloat(cs.borderTopLeftRadius) > 4) bad.push(tag + ' radius ' + cs.borderTopLeftRadius);
    if (cs.transform !== 'none') bad.push(tag + ' transform');
  }
  const over = [...sec.querySelectorAll('*')].filter((n) => n.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
    .map((n) => n.tagName.toLowerCase());
  return { bad: [...new Set(bad)], over, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
};
for (const f of [...new Set(entries.map((e) => e.page))]) {
  for (const w of [390, 1440]) {
    for (const theme of ['dark', 'light']) {
      const pg = await browser.newPage();
      await pg.setViewport({ width: w, height: 900, isMobile: w < 800, hasTouch: w < 800 });
      await pg.evaluateOnNewDocument((t) => { try { localStorage.setItem('theme', t); } catch (x) { /* no storage */ } }, theme);
      await pg.goto(ORIGIN + f, { waitUntil: 'networkidle2', timeout: 45000 });
      await pg.evaluate(UNGATE);
      await pg.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await pg.evaluate(() => document.getElementById('reproduce').scrollIntoView());
      await wait(500);
      const s = await pg.evaluate(STYLE);
      await pg.evaluate(AXE);
      const ax = await pg.evaluate(async () => (await axe.run({ include: [['#reproduce']] }, { resultTypes: ['violations'] }))
        .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id));
      law('L6', !s.bad.length && !s.over.length && s.sw <= s.cw && !ax.length,
        `${f} ${w}px ${theme}: overflow ${s.over.length}, page ${s.sw}/${s.cw}, banned styles ${s.bad.length}, axe ${ax.length}`
        + (s.bad.length ? ` — ${s.bad.slice(0, 3).join('; ')}` : '') + (ax.length ? ` — ${ax.join(', ')}` : ''));
      await pg.close();
    }
  }
}

await browser.close();
srv.close();
console.log(`test-incidents-reproduce (browser): ${fail ? fail + ' failed' : 'all passed'}`);
process.exit(fail ? 1 : 0);
