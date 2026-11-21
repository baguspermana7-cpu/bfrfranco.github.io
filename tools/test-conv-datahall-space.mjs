#!/usr/bin/env node
/**
 * test-conv-datahall-space.mjs — PRD-CONV-DATAHALL-SPACE: the data hall page gives its space to the data hall.
 * Owner R182 (2026-11-21): "Datahall nya sangat kurang, too much text malah yg penting gak ada cukup space datahall itu
 * sendiri". Measured on the RENDER (authorized audit state, settled), never on source.
 *
 *   SP1  floor (#zone-field) >= 55 % of the viewport at 1440x900, >= 45 % at 1280x800
 *   SP2  all 25 rows inside the stage without sideways scroll at >= 1100 px; one cabinet >= 12 x 9 px at 1440
 *   SP3  floor top <= 150 px at 1440, <= 300 px at 390 (page coordinates)
 *   SP4  visible words in the first screen <= 90 at 1440, <= 50 at 390 (svg, tooltips, dialogs, drawers excluded)
 *   SP5  no sentence at rest: no visible element whose own text has >= 8 words
 *   SP6  each hall number once at rest: hall IT (MW), PUE, and the label "PUE" appear at most once
 *   SP7  1440x900: the document does not scroll; nothing scrolls inside a box except [data-inspector-body]
 *   SP8  no number lost: every id of the fixture exists with the same text, and is visible once the ⓘ, the Events
 *        drawer and the inspector are open (--capture writes the fixture from the tree under test)
 *   SP9  a click on a cabinet fills #sel-detail within 300 ms; Escape returns the inspector to the hall state
 *   SP10 0 page errors; --shots=<dir> writes dh-space-<w>-<theme>.png
 *
 *   node tools/test-conv-datahall-space.mjs [--shots=dir] [--capture] [--only=SP1,SP3]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, join } from 'node:path';
import puppeteer from 'puppeteer';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const arg = (k) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : null; };
const SHOTS = arg('shots'), CAPTURE = process.argv.includes('--capture'), ONLY = arg('only') ? arg('only').split(',') : null;
const FIXTURE = 'tools/fixtures/datahall-space-values.json';
/* PRD §5: the ids the gates read. Clock, alarm list and selection text change by design and are checked for presence only. */
const IDS = ['ch-count', 'th-inlet', 'th-supply', 'th-mixing', 'th-airdt', 'th-hot', 'th-retmix', 'th-return', 'th-approach', 'chws', 'chwr', 'chdt',
  'chflow', 'f-flow', 'bb-itload', 'bb-itsub', 'bb-facsub', 'bb-racks', 'bb-avg', 'bb-util', 'bb-design', 'bb-balance', 'bb-balsub', 'bb-cool', 'bb-coolsub',
  'bb-np1', 'bb-np1sub', 'env-temp', 'env-hot-aisle', 'env-return', 'env-rh', 'env-dewpoint', 'env-rack-range', 'env-row-range', 'env-inlet-range', 'env-hot',
  'density-current', 'density-study', 'density-peak', 'dh-rack-load', 'dh-pue', 'dh-pd'];
const PRESENT_ONLY = ['alarm-list', 'sel-detail', 'crah-list', 'crah-air-note', 'alarmStrip'];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };

const fails = []; let passes = 0;
const want = (law) => !ONLY || ONLY.includes(law);
const ok = (c, law, msg) => { if (!want(law)) return; if (c) passes++; else fails.push(`${law} ${msg}`); };

const server = createServer(async (q, r) => {
  try { const p = resolve('.' + decodeURIComponent(q.url.split('?')[0])); r.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); r.end(await readFile(p)); }
  catch { r.writeHead(404); r.end(); }
});
await new Promise((a) => server.listen(0, '127.0.0.1', a));
const O = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function load(w, h, theme) {
  const pg = await browser.newPage(); pg.__errs = [];
  pg.on('pageerror', (e) => pg.__errs.push(String(e.message || e).slice(0, 160)));
  await primeCockpitAuditDocument(pg, theme);
  await pg.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: w <= 600, isMobile: w <= 600 });
  await pg.goto(`${O}/datahall.html`, { waitUntil: 'load', timeout: 60000 });
  await enterAuthorizedAuditState(pg, 'datahall');
  await pg.waitForFunction(() => document.querySelectorAll('#zone-field .rack').length > 100, { timeout: 30000 }).catch(() => {});
  await sleep(1500);
  return pg;
}

/* everything measured in one pass, in the page */
const MEASURE = () => {
  const vw = innerWidth, vh = innerHeight, sx = scrollX, sy = scrollY;
  const shown = (e) => { if (!e || !e.getClientRects().length) return false; const c = getComputedStyle(e); return c.visibility !== 'hidden' && +c.opacity !== 0; };
  const excluded = (e) => e.closest('svg, [role="tooltip"], [role="dialog"], dialog, [hidden], .rz-trend, #tooltip, [data-drawer], .rz-sheet, script, style, noscript, #rzCookieConsent, .rz-cookie, [class*="cookie"]');
  const zf = document.querySelector('#zone-field'), zr = zf ? zf.getBoundingClientRect() : null;
  const inter = (r) => Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  let words = 0; const sentences = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const p = n.parentElement; if (!p || excluded(p) || !shown(p)) continue;
    const c = (n.textContent.match(/[A-Za-z]{2,}/g) || []).length; if (!c) continue;
    const r = p.getBoundingClientRect(); if (r.bottom > 0 && r.top < vh) words += c;
  }
  document.querySelectorAll('body *').forEach((e) => {
    if (excluded(e) || !shown(e)) return;
    const own = [...e.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join(' ');
    const c = (own.match(/[A-Za-z]{2,}/g) || []).length; if (c >= 8) sentences.push(own.trim().replace(/\s+/g, ' ').slice(0, 70));
  });
  const racks = [...document.querySelectorAll('#zone-field .rack')].filter(shown).map((e) => e.getBoundingClientRect());
  const rack0 = racks.sort((a, b) => b.width * b.height - a.width * a.height)[Math.floor(racks.length / 2)] || null;
  const rowLabels = [...document.querySelectorAll('#zone-field [data-z], #zone-field .zone')].filter(shown);
  const rowsIn = new Set(rowLabels.filter((e) => { const r = e.getBoundingClientRect(); return r.left >= (zr ? zr.left - 1 : 0) && r.right <= (zr ? zr.right + 1 : vw); }).map((e) => e.getAttribute('data-z') || e.getAttribute('data-row') || e.textContent.trim().slice(0, 2)));
  const scrollBoxes = [...document.querySelectorAll('body *')].filter((e) => {
    if (!shown(e) || e.closest('[data-inspector-body], svg, [hidden], .rz-trend')) return false;
    const c = getComputedStyle(e); return /(auto|scroll)/.test(c.overflowY + c.overflowX) && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1);
  }).map((e) => (e.id ? '#' + e.id : '') + '.' + String(e.className || e.tagName).split(' ')[0]);
  const hall = window.CONV_CALC && window.CONV_CALC.getHallSnapshot ? window.CONV_CALC.getHallSnapshot(window.RZ_DATAHALL_SELECTED_HALL || 'A') : null;
  const snap = window.CONV_CALC && window.CONV_CALC.snapshot;
  const visTexts = [...document.querySelectorAll('body *')].filter((e) => !excluded(e) && shown(e) && [...e.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim())).map((e) => [...e.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim());
  const itMw = hall && hall.it_load_kw != null ? hall.it_load_kw / 1000 : null, pue = snap && snap.site ? snap.site.pue : null;
  const count = (re) => visTexts.filter((t) => re.test(t)).length;
  const esc = (s) => s.replace(/\./g, '\\.');
  return {
    vw, vh, zone: zr && { top: Math.round(zr.top + sy), left: Math.round(zr.left + sx), w: Math.round(zr.width), h: Math.round(zr.height), share: inter(zr) / (vw * vh), sw: zf.scrollWidth, cw: zf.clientWidth },
    racks: racks.length, rack: rack0 && { w: +rack0.width.toFixed(1), h: +rack0.height.toFixed(1) }, rowsIn: rowsIn.size,
    words, sentences, docScroll: document.documentElement.scrollHeight - innerHeight, pageSideways: document.documentElement.scrollWidth - innerWidth, scrollBoxes,
    dup: itMw == null ? null : { it: count(new RegExp('^' + esc(itMw.toFixed(2)) + '(0)?$|^' + esc(itMw.toFixed(2)) + '0? ?MW$')), pue: pue == null ? 0 : count(new RegExp('^' + esc(pue.toFixed(2)) + '$')), pueLabel: count(/^PUE$/) },
  };
};
const VALUES = (ids) => Object.fromEntries(ids.map((id) => { const e = document.getElementById(id); return [id, e ? e.textContent.replace(/\s+/g, ' ').trim() : null]; }));

const cases = [[1440, 900, 'dark'], [1440, 900, 'light'], [1280, 800, 'dark'], [390, 844, 'dark'], [390, 844, 'light']];
let fixture = null;
try { fixture = JSON.parse(await readFile(FIXTURE, 'utf8')); } catch { /* --capture writes it */ }
for (const [w, h, theme] of cases) {
  const pg = await load(w, h, theme), tag = `@${w}x${h}/${theme}`, m = await pg.evaluate(MEASURE);
  if (w >= 1280) ok(m.zone && m.zone.share >= (w >= 1440 ? 0.55 : 0.45), 'SP1', `${tag} floor ${m.zone ? (m.zone.share * 100).toFixed(1) : '—'} % of the screen (${m.zone ? m.zone.w + 'x' + m.zone.h : 'no #zone-field'}), want >= ${w >= 1440 ? 55 : 45} %`);
  if (w >= 1100) ok(m.zone && m.zone.sw <= m.zone.cw + 1 && m.rowsIn >= 25, 'SP2', `${tag} rows inside the stage ${m.rowsIn}/25, field scroll ${m.zone ? m.zone.sw + '/' + m.zone.cw : '—'}`);
  if (w === 1440) ok(m.rack && m.rack.w >= 12 && m.rack.h >= 9, 'SP2', `${tag} one cabinet ${m.rack ? m.rack.w + 'x' + m.rack.h : '—'} px (want >= 12x9)`);
  if (w === 1440 || w === 390) ok(m.zone && m.zone.top <= (w === 1440 ? 150 : 300), 'SP3', `${tag} floor top ${m.zone ? m.zone.top : '—'} px (want <= ${w === 1440 ? 150 : 300})`);
  if (w === 1440 || w === 390) ok(m.words <= (w === 1440 ? 90 : 50), 'SP4', `${tag} ${m.words} visible words in the first screen (want <= ${w === 1440 ? 90 : 50})`);
  ok(m.sentences.length === 0, 'SP5', `${tag} ${m.sentences.length} sentences at rest: ${m.sentences.slice(0, 3).join(' | ')}`);
  ok(m.dup && m.dup.it <= 1 && m.dup.pue <= 1 && m.dup.pueLabel <= 1, 'SP6', `${tag} shown more than once at rest: ${JSON.stringify(m.dup)}`);
  if (w === 1440) ok(m.docScroll <= 1 && m.scrollBoxes.length === 0, 'SP7', `${tag} page scrolls ${m.docScroll} px; inner scroll boxes ${m.scrollBoxes.slice(0, 4).join(' ')}`);
  ok(m.pageSideways <= 1, 'SP7', `${tag} page scrolls sideways ${m.pageSideways} px`);
  if (SHOTS) await pg.screenshot({ path: join(SHOTS, `dh-space-${w}-${theme}.png`) });

  if (w === 1440 && theme === 'dark') {
    /* SP8: values first, then reachability with every disclosure open */
    const vals = await pg.evaluate(VALUES, IDS.concat(PRESENT_ONLY));
    if (CAPTURE) { await writeFile(FIXTURE, JSON.stringify(Object.fromEntries(IDS.map((id) => [id, vals[id]])), null, 2) + '\n'); console.log(`wrote ${FIXTURE} (${IDS.length} ids)`); }
    else if (!fixture) ok(false, 'SP8', `no fixture ${FIXTURE}: run with --capture on the tree before the change`);
    else {
      const diff = IDS.filter((id) => vals[id] !== fixture[id]);
      ok(diff.length === 0, 'SP8', `${diff.length} ids changed or missing: ${diff.slice(0, 5).map((id) => `${id} "${vals[id]}" (was "${fixture[id]}")`).join(' | ')}`);
    }
    const missing = PRESENT_ONLY.filter((id) => vals[id] === null);
    ok(missing.length === 0, 'SP8', `ids missing: ${missing.join(', ')}`);
    await pg.evaluate(() => { document.querySelectorAll('[data-dh-disclose]').forEach((b) => b.click()); });
    await sleep(400);
    const hidden = await pg.evaluate((ids) => ids.filter((id) => { const e = document.getElementById(id); return !e || !e.getClientRects().length; }), IDS);
    ok(hidden.length === 0, 'SP8', `${hidden.length} ids not reachable with the ⓘ, Events and inspector open: ${hidden.slice(0, 8).join(', ')}`);
    await pg.keyboard.press('Escape'); await sleep(300);

    /* SP9: selection */
    const before = await pg.evaluate(() => (document.getElementById('sel-detail') || {}).textContent || '');
    const t0 = Date.now();
    await pg.evaluate(() => { const r = [...document.querySelectorAll('#zone-field .rack')].find((x) => x.getClientRects().length); if (r) r.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const filled = await pg.waitForFunction((b) => { const e = document.getElementById('sel-detail'); return e && e.textContent !== b && e.getClientRects().length; }, { timeout: 1000 }, before).then(() => Date.now() - t0).catch(() => null);
    ok(filled !== null && filled <= 300, 'SP9', `rack click -> inspector card ${filled === null ? 'never filled' : filled + ' ms'} (want <= 300)`);
    await pg.keyboard.press('Escape'); await sleep(300);
    const back = await pg.evaluate(() => !!document.querySelector('[data-inspector-state="hall"]'));
    ok(back, 'SP9', 'Escape did not return the inspector to the hall state ([data-inspector-state="hall"])');
  }
  ok(pg.__errs.length === 0, 'SP10', `${tag} page errors: ${pg.__errs.slice(0, 2).join(' | ')}`);
  await pg.close();
}
await browser.close(); server.close();
if (fails.length) { console.log(`CONV DATAHALL SPACE — FAIL (${fails.length} of ${fails.length + passes})`); fails.forEach((f) => console.log('  ' + f)); process.exit(1); }
console.log(`CONV DATAHALL SPACE — PASS (${passes} checks: floor share, 25 rows, floor top, words, sentences, once-only numbers, no inner scroll, every id kept and reachable, selection, 0 errors)`);
