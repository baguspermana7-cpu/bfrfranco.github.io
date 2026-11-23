#!/usr/bin/env node
/* test-conv-epms-lv.mjs — STRICT. E-S-102 "LV distribution — typical hall" of EPMS_Telemetry.html
   (PRD-CONV-EQUIPMENT-TRUTH §5.2 / §6.1 / §7.1, phase E5). Laws:
     E1  no legacy LV drawing is reachable (#viewport / #scene / legacy controls gone); the LV view shows E-S-102; for
         each hall A–D the genset tags drawn equal CONV_CALC.getFleet('genset', hall) and the counts carry the engine
         ("× 5", "× 500 racks", "8 sets (7 + 1)"); the site total (genset_count) and the supply chain
         (hv_voltage_kv kV GIS → mv_voltage_kv kV, as on E-S-101) are stated.
     E2  switching is select-before-operate: Select changes nothing, Execute operates, Execute without a selection is
         refused; after a ring incomer is opened the status, the alarm count and the load in kW follow the solve; a dead
         20 kV feeder on E-S-101 kills its hall ring on E-S-102 — never NORMAL with 0 alarms while a feed is dead.
     E3  every device of E-S-102 (all four halls' tags) opens the inspector and RZConvModal with its ISA/IEC tag title;
         a transformer or UPS symbol opens RZConvModal on its internal drawing with one click (P4a), titled by its unit.
     E4  after Fit every tag stays visible, rendered text >= 11 px, no two labels overlap, no horizontal page scroll,
         0 page errors — at 1440 and 390.
     E5  F21 the strip shows the UPS system RATING (modules × module rating) labelled rating and the LOAD labelled load;
         F23 the TCC of a 150 kV transformer bay plots TX-1 (hv_tx_mva), a 20 kV feeder the distribution unit;
         F24 each view shows one legend.
   Self-proof: the same laws run against three planted defects served from this checkout — a genset stubbed off the
   drawing, the status forced NORMAL after a trip, the device click handler removed — and each must turn its law red.
   Run: TMPDIR=$HOME/.cache/qa-tmp rz-lane -l 2 -t 900 -- node tools/test-conv-epms-lv.mjs [--shots=<dir>] [--no-plants] */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHOTS = (process.argv.find((a) => a.startsWith('--shots=')) || '').split('=')[1];
const PLANTS = !process.argv.includes('--no-plants');
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.html': 'text/html' };

/* planted defects: a source rewrite applied to one served file; each must make its law fail */
const PLANT = {
  gencount: { file: 'js/conv/epms-lv.js', from: 'var GY = 1280, n = fleet.length,', to: 'fleet = fleet.slice(1); var GY = 1280, n = fleet.length,', law: 'E1' },
  normal: { file: 'EPMS_Telemetry.html', from: "var state = n ? 'ALARM' : (m.offNormal ? 'ABNORMAL' : 'NORMAL');", to: "n = 0; var state = 'NORMAL';", law: 'E2' },
  handler: { file: 'js/conv/epms-lv-view.js', from: '{ read: read, flow: flow, open: opener }', to: '{ read: read, flow: flow, open: null }', law: 'E3' }
};
let active = null;
const srv = http.createServer((q, r) => {
  const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '');
  const p = path.join(ROOT, rel);
  if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    if (active && PLANT[active].file === rel) {
      const s = d.toString('utf8');
      if (!s.includes(PLANT[active].from)) { r.writeHead(500); r.end('plant anchor missing'); plantMissing.push(active); return; }
      d = Buffer.from(s.replace(PLANT[active].from, PLANT[active].to));
    }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(d);
  });
});
const plantMissing = [];
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}/`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HOST = '#epms-lv-host';
const num = (t) => (t == null ? NaN : Number(String(t).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0]));

async function load(W) {
  const pg = await browser.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: W, height: W > 800 ? 1000 : 844, deviceScaleFactor: 1 });
  await primeCockpitAuditDocument(pg, 'dark');
  await pg.goto(ORIGIN + 'EPMS_Telemetry.html', { waitUntil: 'networkidle0', timeout: 90000 });
  await enterAuthorizedAuditState(pg, 'epms');
  await sleep(1500);
  return { pg, errs };
}
async function showLv(pg) {
  await press(pg, '.epms-view-btn[data-epms-view="lv"]'); await sleep(700);
}
/* a real click, and if the element was rebuilt between lookup and press (the inspector refreshes its action row), a
   DOM click on the fresh element */
async function press(pg, sel) {
  try { await pg.click(sel); } catch (e) { const ok = await pg.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); return !!el; }, sel); if (!ok) throw e; }
}
async function hall(pg, h) { await pg.keyboard.press('Escape'); await press(pg, '.epms-hall-btn[data-epms-hall="' + h + '"]'); await sleep(400); }
async function clickNode(pg, id) {
  await pg.keyboard.press('Escape'); await sleep(100);
  const pt = await pg.evaluate((H, i) => {
    const g = document.querySelector(H + ' .hmi-node[data-node="' + i + '"]'); if (!g) return null;
    g.scrollIntoView({ block: 'center', inline: 'center' });
    const b = g.querySelector('.hmi-hit') || g; const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, HOST, id);
  if (!pt) return false;
  await pg.mouse.click(pt.x, pt.y); await sleep(250);
  return pt;
}
const inspTitle = (pg) => pg.evaluate(() => { const a = document.querySelector('aside.rz-inspector.open [data-slot="id"]'); return a ? a.textContent.trim() : null; });
async function action(pg, prefix) {
  /* P4b: a breaker opens the equipment modal, whose action footer carries the page's own operate buttons */
  const sel = 'aside.rz-inspector.open [data-rz-action^="' + prefix + '"], .rz-cvm:not([hidden]) [data-rz-cvm-act^="' + prefix + '"]';
  if (!(await pg.$(sel))) { await sleep(500); if (!(await pg.$(sel))) return false; }
  await press(pg, sel); await sleep(350); return true;
}
const strip = (pg) => pg.evaluate(() => {
  const t = (id) => (document.getElementById(id) || {}).textContent || '';
  return { state: t('epms-state').trim(), alarms: t('val-alarms').trim(), load: t('val-total-load').trim(), system: t('val-system').trim(),
    model: window.RZEpmsLvPage && window.RZEpmsLvPage.model(), msg: t('epms-lv-msg').trim() };
});
async function shot(pg, name, nodeId) {
  if (!SHOTS) return;
  await pg.mouse.move(2, 2);
  await pg.evaluate((H, id) => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const g = id && document.querySelector(H + ' .hmi-node[data-node="' + id + '"]');
    if (g) g.scrollIntoView({ block: 'center', inline: 'center' }); else { const v = document.getElementById('epms-lv-view'); if (v) v.scrollTop = 0; scrollTo(0, 0); }
  }, HOST, nodeId || null);
  await sleep(350);
  await pg.screenshot({ path: path.join(SHOTS, name) });
}

/* ── E1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */
async function lawE1(pg, at, fail) {
  const legacy = await pg.evaluate(() => ['viewport', 'scene', 'btn-u-a', 'btn-u-b', 'btn-tie', 'zoomIndicator', 'epms-legend', 'logs']
    .filter((id) => document.getElementById(id)).concat(typeof window.fitScreen === 'function' ? ['fitScreen()'] : [])
    .concat(typeof window.toggleSource === 'function' ? ['toggleSource()'] : []));
  if (legacy.length) fail('E1' + at + ' legacy LV drawing still reachable: ' + legacy.join(', '));
  await showLv(pg);
  const v = await pg.evaluate(() => {
    const view = document.getElementById('epms-lv-view'), svg = document.querySelector('#epms-lv-host svg#epms-lv-svg');
    return { shown: !!view && !view.hidden && view.getBoundingClientRect().height > 200, svg: !!svg,
      no: (document.querySelector('#epms-lv-host')?.textContent || '').includes('E-S-102'), live: !!(window.RZEpmsLvPage && window.RZEpmsLvPage.live) };
  });
  if (!v.shown || !v.svg || !v.no || !v.live) { fail('E1' + at + ' LV view does not show a live E-S-102 ' + JSON.stringify(v)); return; }
  for (let h = 0; h < 4; h++) {
    await hall(pg, h);
    const r = await pg.evaluate((H, hh) => {
      const code = 'ABCD'[hh], C = window.CONV_CALC, e = C.snapshot.electrical;
      const fleet = C.getFleet('genset', code).map((g) => g.tag);
      const drawn = [...document.querySelectorAll(H + ' text[data-tag-of^="gs"]:not([data-tag-of$="-cb"])')].map((t) => t.textContent.trim());
      const txt = document.querySelector(H).textContent;
      return { code, fleet, drawn, per: e.genset_per_hall, spare: e.genset_spare_per_hall, units: e.dist_tx_per_stream_per_hall,
        racks: C.snapshot.campus.halls[hh].racks, perPdu: e.racks_per_pdu || 0, pdus: e.pdu_per_hall_per_stream || 0, txt, title: (document.querySelector(H + ' .hmi-title, ' + H + ' [data-role="title"]') || {}).textContent || '',
        hallTags: ['TX-' + code + 'A', 'TX-' + code + 'B', 'CB-R' + code + 'A', 'LVMSB-' + code + 'A', 'UPS-' + code + 'A'].filter((t) => !txt.includes(t)) };
    }, HOST, h);
    if (JSON.stringify(r.drawn) !== JSON.stringify(r.fleet) || r.fleet.length !== r.per)
      fail(`E1${at} hall ${r.code}: drawn gensets ${r.drawn.join(',')} ≠ getFleet ${r.fleet.join(',')} (genset_per_hall ${r.per})`);
    if (!r.txt.includes(r.per + ' SETS (' + (r.per - r.spare) + ' + ' + r.spare + ')')) fail(`E1${at} hall ${r.code}: no "${r.per} SETS (${r.per - r.spare} + ${r.spare})" label`);
    if (!r.txt.includes('× ' + r.units)) fail(`E1${at} hall ${r.code}: no "× ${r.units}" transformer count`);
    /* E18 (conv-engine >= 2.9.0): the stream is drawn down to one typical PDU and its racks, so the count on the sheet is
       racks per PDU, and the PDUs of a stream must carry every rack of the hall; an older engine keeps the hall total. */
    if (r.perPdu && r.pdus) {
      if (!r.txt.toUpperCase().includes('× ' + r.perPdu + ' RACKS PER PDU')) fail(`E1${at} hall ${r.code}: no "× ${r.perPdu} racks per PDU"`);
      if (r.pdus * r.perPdu < r.racks) fail(`E1${at} hall ${r.code}: ${r.pdus} PDUs × ${r.perPdu} racks < ${r.racks} hall racks`);
    } else if (!r.txt.toUpperCase().includes('× ' + r.racks + ' RACKS')) fail(`E1${at} hall ${r.code}: no "× ${r.racks} racks"`);
    if (r.hallTags.length) fail(`E1${at} hall ${r.code}: tags not rebound: ${r.hallTags.join(', ')}`);
    if (!r.txt.includes('HALL ' + r.code)) fail(`E1${at} hall ${r.code}: sheet title does not name the hall`);
  }
  await hall(pg, 0);
  const s = await pg.evaluate(() => {
    const e = window.CONV_CALC.snapshot.electrical, el = document.getElementById('epms-lv-site');
    const sld = document.querySelector('#epms-sheet-host')?.textContent || '';
    return { text: el ? el.textContent : '', title: el ? el.title : '', count: e.genset_count, hv: e.hv_voltage_kv, mv: e.mv_voltage_kv,
      sldHv: sld.includes(e.hv_voltage_kv + ' kV'), visible: !!el && el.getBoundingClientRect().width > 0 };
  });
  if (!s.visible || !s.text.includes(s.count + ' sets') || !s.title.includes(s.count + ' gensets')) fail(`E1${at} site total not stated: "${s.text}" / "${s.title}"`);
  if (!s.title.includes(s.hv + ' kV GIS → ' + s.mv + ' kV') || !s.sldHv) fail(`E1${at} supply ${s.hv} kV GIS → ${s.mv} kV not stated or not the E-S-101 supply`);
}

/* ── E2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */
async function lawE2(pg, at, fail, shots) {
  await showLv(pg); await hall(pg, 0);
  const s0 = await strip(pg);
  if (!/NORMAL/.test(s0.state) || s0.alarms !== '0' || num(s0.load) !== s0.model.demandKw) fail(`E2${at} normal state not NORMAL / 0 alarms / full load: ${JSON.stringify([s0.state, s0.alarms, s0.load])}`);
  /* Execute without Select is refused */
  await pg.evaluate(() => window.RZDatahallAIInspectorActions.epmsLvExecute({ id: 'ra-cb' }));
  const r0 = await strip(pg);
  if (!/REFUSED/.test(r0.msg) || r0.model.offNormal !== 0) fail(`E2${at} Execute without Select was not refused: "${r0.msg}"`);
  /* Select changes nothing */
  if (!(await clickNode(pg, 'ra-cb'))) { fail(`E2${at} CB-RAA not on the sheet`); return; }
  if (!(await action(pg, 'sbo-select'))) { fail(`E2${at} no Select action on CB-RAA`); return; }
  const r1 = await pg.evaluate(() => ({ armed: window.RZEpmsLvPage.armed(), s: window.RZEpmsLvPage.summary(0) }));
  if (!r1.armed || r1.armed.id !== 'ra-cb' || r1.s.offNormal !== 0) fail(`E2${at} Select operated or did not arm: ${JSON.stringify(r1)}`);
  if (shots) await pg.screenshot({ path: path.join(SHOTS, 'epms-lv-sbo-selected' + at.replace('@', '-') + '.png') });
  if (!(await action(pg, 'sbo-exec'))) { fail(`E2${at} no Execute action after Select`); return; }
  const s1 = await strip(pg);
  const m = s1.model;
  if (m.offNormal < 1) fail(`E2${at} Execute did not operate CB-RAA`);
  if (!(m.alarms.length > 0) || num(s1.alarms) !== m.alarms.length) fail(`E2${at} alarm count ${s1.alarms} ≠ solve ${m.alarms.length} after CB-RAA opened`);
  if (!/ALARM/.test(s1.state) || s1.system !== 'ALARM') fail(`E2${at} status after a dead section: "${s1.state}" / "${s1.system}"`);
  if (num(s1.load) !== Math.round(m.servedKw) || !(m.servedKw < m.demandKw)) fail(`E2${at} load ${s1.load} ≠ served ${m.servedKw} (< demand ${m.demandKw})`);
  if (shots) await shot(pg, 'epms-lv-sbo-executed' + at.replace('@', '-') + '.png', 'ra-cb');
  /* close the tie through select-then-execute: the hall is restored, battery stops discharging */
  await clickNode(pg, 'tie'); await action(pg, 'sbo-select'); await action(pg, 'sbo-exec');
  const s2 = await strip(pg);
  if (s2.model.servedKw !== s2.model.demandKw || /ALARM/.test(s2.state)) fail(`E2${at} tie closed: hall not restored ${JSON.stringify([s2.state, s2.load])}`);
  if (shots) await shot(pg, 'epms-lv-sbo-tie' + at.replace('@', '-') + '.png', 'tie');
  /* E-S-101: open CB-FB1 → ring B of hall A is dead on E-S-102 */
  await pg.evaluate(() => { window.RZDatahallAIInspectorActions.epmsSimSwitch({ id: 'fb1-cb' }); });
  await sleep(300);
  const s3 = await strip(pg);
  const dead = s3.model.alarms.filter((a) => /RING B/.test(a.tag) && a.hall === 'A');
  if (!dead.length || s3.state.includes('NORMAL') || s3.alarms === '0') fail(`E2${at} CB-FB1 opened on E-S-101 but hall A ring B not dead / alarmed: ${JSON.stringify([s3.state, s3.alarms])}`);
}

/* ── E3 ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */
async function lawE3(pg, at, fail, all) {
  await showLv(pg);
  for (let h = 0; h < (all ? 4 : 1); h++) {
    await hall(pg, h);
    const devs = await pg.evaluate(() => window.RZEpmsLvPage.sheet().devices);
    const list = all || h === 0 ? devs : devs.slice(0, 6);
    for (const id of list) {
      const ok = await clickNode(pg, id);
      if (!ok) { fail(`E3${at} hall ${'ABCD'[h]} device ${id} not drawn`); continue; }
      /* P4a (PRD-CONV-EQUIPMENT-INSIDE): a transformer or a UPS symbol opens RZConvModal on its drawn inside with ONE
         click, titled by its unit (a rectifier, inverter, battery or static switch opens its UPS: REC-AA -> UPS-AA) */
      const deep = await pg.evaluate((i) => { const S = window.RZEpmsLvPage, I = window.RZEpmsInternals, g = document.querySelector('#epms-lv-host .hmi-node[data-node="' + i + '"]');
        const sym = g && g.getAttribute('data-sym'), tag = S ? S.tagOf(i) : null;
        if (!I || !tag) return null;
        if (sym === 'transformer2w' || /^TX-/.test(tag)) return tag;
        if (/^(REC|INV|BAT|SS)-/.test(tag) && /^u[a-z]-(rec|inv|bat|ss)$/.test(i)) return 'UPS-' + tag.replace(/^(REC|INV|BAT|SS)-/, '');
        if (sym === 'cbIec' || sym === 'cbDrawout' || sym === 'protectionRelay') return tag;   /* P4b: breakers and relays open their inside too */
        return null; }, id);
      if (deep) {
        let dm = null;
        for (let k = 0; k < 8; k++) { await sleep(200); dm = await pg.evaluate(() => ({ open: !!(window.RZConvModal && window.RZConvModal.isOpen()), t: (document.getElementById('rz-cvm-title') || {}).textContent || '',
          svg: !!document.querySelector('.rz-cvm:not([hidden]) [data-rz-cvm-int] svg.hmi-svg') })); if (dm.open) break; }
        if (!dm.open || !dm.svg || !dm.t.includes(deep)) fail(`E3${at} hall ${'ABCD'[h]} ${id}: one click ${dm.open ? 'opened "' + dm.t + '"' + (dm.svg ? '' : ' without the drawing') : 'did not open the modal'} (want ${deep})`);
        if (SHOTS && id === 'ua-inv' && h === 0) await pg.screenshot({ path: path.join(SHOTS, 'epms-lv-modal' + at.replace('@', '-') + '.png') });
        await pg.keyboard.press('Escape'); await sleep(150); await pg.keyboard.press('Escape'); await sleep(100);
        continue;
      }
      let t = await inspTitle(pg);
      if (!t) { await pg.keyboard.press('Escape'); await sleep(300); await clickNode(pg, id); await sleep(300); t = await inspTitle(pg); }
      const want = await pg.evaluate((i) => { const S = window.RZEpmsLvPage; return S ? S.tagOf(i) : null; }, id);
      if (!t || !want || !t.startsWith(want)) { fail(`E3${at} hall ${'ABCD'[h]} ${id}: inspector "${t}" ≠ tag ${want}`); continue; }
      const btn = await pg.$('aside.rz-inspector.open [data-rz-open-hmi]');
      if (!btn) { fail(`E3${at} ${id}: no Open equipment HMI`); continue; }
      const openModal = async (b) => {
        await b.click().catch(() => b.evaluate((x) => x.click()));
        let m = null;
        for (let k = 0; k < 8; k++) {
          await sleep(200);
          m = await pg.evaluate(() => ({ open: !!(window.RZConvModal && window.RZConvModal.isOpen()), t: (document.getElementById('rz-cvm-title') || {}).textContent || '' }));
          if (m.open) break;
        }
        return m;
      };
      let mt = await openModal(btn);
      /* under a loaded lane the inspector can still be sliding in when its button is pressed: one fresh attempt, counted */
      if (!mt.open) {
        retried.push(at + ' ' + id);
        await clickNode(pg, id); await sleep(400);
        const b2 = await pg.$('aside.rz-inspector.open [data-rz-open-hmi]');
        if (b2) mt = await openModal(b2);
      }
      if (!mt.open || !mt.t.includes(want)) fail(`E3${at} ${id}: RZConvModal ${mt.open ? 'title "' + mt.t + '"' : 'did not open'} (want ${want})`);
      if (SHOTS && id === 'ua-inv' && h === 0) await pg.screenshot({ path: path.join(SHOTS, 'epms-lv-modal' + at.replace('@', '-') + '.png') });
      await pg.keyboard.press('Escape'); await sleep(150); await pg.keyboard.press('Escape'); await sleep(100);
    }
  }
}

/* ── E4 ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */
async function lawE4(pg, at, fail, errs) {
  await showLv(pg);
  await pg.click(HOST + ' .hmi-btn[data-z="fit"]').catch(() => {}); await sleep(500);
  const r = await pg.evaluate((H) => {
    const svg = document.querySelector(H + ' svg.hmi-svg'), k = svg.getScreenCTM().a;
    const texts = [...svg.querySelectorAll('text')].filter((t) => t.closest('defs') === null && t.textContent.trim() && getComputedStyle(t).display !== 'none' &&
      getComputedStyle(t).visibility !== 'hidden' && !t.closest('[display="none"]') && t.getClientRects().length);
    const small = texts.map((t) => ({ t: t.textContent.trim(), px: parseFloat(getComputedStyle(t).fontSize) * k })).filter((x) => x.px < 10.95);
    const boxes = texts.map((t) => ({ t: t.textContent.trim(), r: t.getBoundingClientRect() }));
    const over = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, b = boxes[j].r, w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      /* a text box carries its line's leading: stacked lines 12 units apart touch by a pixel or two; ink overlap is more */
      if (w > 1.5 && h > 0.4 * Math.min(a.height, b.height)) over.push(boxes[i].t + ' × ' + boxes[j].t);
    }
    const all = [...svg.querySelectorAll('text[data-tag-of]')];
    const missing = all.filter((t) => !texts.includes(t)).map((t) => t.textContent.trim());
    return { n: texts.length, small: small.slice(0, 5), nSmall: small.length, over: over.slice(0, 6), nOver: over.length, missing: missing.slice(0, 6), nTags: all.length,
      scroll: document.documentElement.scrollWidth - innerWidth };
  }, HOST);
  if (r.nSmall) fail(`E4${at} ${r.nSmall} labels under 11 px after Fit: ${JSON.stringify(r.small)}`);
  if (r.nOver) fail(`E4${at} ${r.nOver} label overlaps: ${r.over.join(' | ')}`);
  if (r.missing.length || r.nTags < 40) fail(`E4${at} tags not visible after Fit (${r.nTags} tags): ${r.missing.join(', ')}`);
  if (r.scroll > 1) fail(`E4${at} horizontal page scroll ${r.scroll}px`);
  const legend = await pg.evaluate(() => {
    const host = document.querySelector('#epms-lv-view'), lg = host && host.querySelector('.vfx-legend');
    if (!lg) return null; const a = lg.getBoundingClientRect(), b = host.getBoundingClientRect();
    return { clipped: a.right > Math.min(innerWidth, b.right) + 1 && getComputedStyle(lg.parentElement).overflowX !== 'auto' };
  });
  if (legend && legend.clipped) fail(`E4${at} legend clipped`);
  if (errs.length) fail(`E4${at} page errors: ${errs.slice(0, 3).join(' | ')}`);
}

/* ── E5 ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */
async function lawE5(pg, at, fail) {
  const r = await pg.evaluate(() => {
    const e = window.CONV_CALC.snapshot.electrical, g = (n) => Math.round(n).toLocaleString('en-US');
    const lbl = (id) => { const el = document.getElementById(id); return el ? { text: el.textContent.trim(), label: (el.parentElement.textContent || '').trim() } : null; };
    const S = window.RZEpmsSheets.sld, by = (id) => S.nodes.filter((n) => n.id === id)[0];
    const t1 = window.RZEpmsTccSpec(by('t1-r')), fa = window.RZEpmsTccSpec(by('fa1-r'));
    return { sys: lbl('epms-ups-sys'), load: lbl('epms-ups-load'), rated: g(e.ups_module_kw_rated * e.ups_modules_per_system), ratedKey: g(e.ups_system_rated_kw), sysKw: g(e.ups_system_kw),
      t1: t1 && { kva: t1.txKva, dmg: t1.damage.label }, fa: fa && { kva: fa.txKva }, mva: e.hv_tx_mva, dist: e.dist_tx_kva };
  });
  if (!r.sys || !r.sys.text.includes(r.rated) || r.rated !== r.ratedKey || !/rating/i.test(r.sys.label)) fail(`E5${at} F21 system rating ${JSON.stringify(r.sys)} ≠ ${r.rated} kW labelled rating`);
  if (!r.load || !r.load.text.includes(r.sysKw) || !/load/i.test(r.load.label)) fail(`E5${at} F21 system load ${JSON.stringify(r.load)} ≠ ${r.sysKw} kW labelled load`);
  if (!r.t1 || r.t1.kva !== r.mva * 1000 || !r.t1.dmg.includes('TX-1 ' + r.mva + ' MVA')) fail(`E5${at} F23 TX-1 bay TCC plots ${JSON.stringify(r.t1)}, want ${r.mva * 1000} kVA TX-1`);
  if (!r.fa || r.fa.kva !== r.dist) fail(`E5${at} F23 feeder TCC plots ${JSON.stringify(r.fa)}, want ${r.dist} kVA`);
  for (const view of ['sld', 'lv']) {
    await press(pg, '.epms-view-btn[data-epms-view="' + view + '"]'); await sleep(500);
    const n = await pg.evaluate(() => [...document.querySelectorAll('.vfx-legend, .hmi-legend, #epms-legend, .epms-legend, .legend')]
      .filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }).length);
    if (n !== 1) fail(`E5${at} F24 the ${view} view shows ${n} legends`);
  }
}

const findings = [];
const retried = [];
async function run(label, W, laws, opts = {}) {
  const fails = [];
  const fail = (m) => fails.push(m);
  const { pg, errs } = await load(W);
  const at = '@' + W;
  try {
    if (opts.shots && SHOTS) {
      await shot(pg, 'epms-gate-sld' + at.replace('@', '-') + '.png');
      await showLv(pg); await shot(pg, 'epms-gate-lv' + at.replace('@', '-') + '.png');
      await pg.click(HOST + ' .hmi-btn[data-z="fit"]').catch(() => {}); await sleep(400); await shot(pg, 'epms-gate-lv-fit' + at.replace('@', '-') + '.png');
      await hall(pg, 2); await shot(pg, 'epms-gate-lv-hallC' + at.replace('@', '-') + '.png'); await hall(pg, 0);
    }
    if (laws.includes('E1')) await lawE1(pg, at, fail);
    if (laws.includes('E4')) await lawE4(pg, at, fail, errs);
    if (laws.includes('E5')) await lawE5(pg, at, fail);
    if (laws.includes('E3')) await lawE3(pg, at, fail, !!opts.all);
    if (laws.includes('E2')) await lawE2(pg, at, fail, !!opts.shots && !!SHOTS);
  } catch (e) { fail(`${label}${at} threw: ${e.message.split('\n')[0]} at ${(e.stack || '').split('\n').find((l) => l.includes('test-conv-epms-lv')) || ''}`); }
  if (errs.length && !laws.includes('E4')) fail(`${label}${at} page errors: ${errs.slice(0, 2).join(' | ')}`);
  await pg.close();
  return fails;
}

for (const W of [1440, 390]) {
  const f = await run('clean', W, ['E1', 'E4', 'E5', 'E3', 'E2'], { shots: true, all: W === 1440 });
  f.forEach((m) => findings.push(m));
  console.log(`  ${f.length ? 'FAIL' : 'ok  '} E1–E5 @${W}${f.length ? ' — ' + f.length + ' finding(s)' : ''}`);
}
const plantRes = [];
if (PLANTS) for (const [name, p] of Object.entries(PLANT)) {
  active = name;
  const f = await run('plant:' + name, 1440, [p.law]);
  active = null;
  const red = f.some((m) => m.startsWith(p.law));
  plantRes.push(`${name}→${p.law} ${red ? 'RED' : 'GREEN'}`);
  if (!red) findings.push(`self-proof: planted defect "${name}" left ${p.law} green`);
}
if (plantMissing.length) findings.push('plant anchors missing: ' + [...new Set(plantMissing)].join(', '));
await browser.close(); srv.close();
if (PLANTS) console.log('  planted defects: ' + plantRes.join(' · '));
if (retried.length) console.log('  modal opened on the second press: ' + retried.join(', '));
if (findings.length) { console.log('FAIL test-conv-epms-lv: ' + findings.length + ' finding(s)'); findings.forEach((m) => console.log('  - ' + m)); process.exit(1); }
console.log('PASS test-conv-epms-lv: E1–E5 at 1440 + 390, planted defects red');
