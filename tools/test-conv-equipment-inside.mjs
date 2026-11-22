#!/usr/bin/env node
/* test-conv-equipment-inside.mjs — PRD-CONV-EQUIPMENT-INSIDE (owner R186: "Saat block di klik itu harus ada diagram dari
   equipment itu ... klik chiller 1 ya keluarnya proses di dalamnya"). On the render, 1440 and 390:
   IN1 ONE pointer click on a machine whose inside is drawn (RZConvInternals.has(class)) opens the equipment modal on its
       internal drawing (>= 8 blocks, not the clicked symbol) and does NOT open the side inspector
   IN1k Enter on the focused symbol does the same (keyboard)
   IN1r Escape closes the modal and focus returns to the clicked symbol
   IN1x a machine without a drawn inside still opens the inspector on one click (nothing half-built is shown)
   Cases: chiller-plant CH-01 (class chiller), fuel-system G-01 (class genset), chiller-plant CDW pump (no inside yet).
   node tools/test-conv-equipment-inside.mjs [--width=1440] */
import puppeteer from 'puppeteer';
import { serve } from './audit-conv-text.mjs';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const CASES = [
  { page: 'chiller-plant', host: '#chw-sheet-host', node: 'ch1', inside: true },
  { page: 'fuel-system', host: '#fuel-sheet-host', node: 'gen1', inside: true },
  { page: 'chiller-plant', host: '#chw-sheet-host', node: 'pa1', inside: false },
];
const argW = process.argv.slice(2).filter((a) => a.startsWith('--width=')).map((a) => +a.slice(8));
const WIDTHS = argW.length ? argW : [1440, 390];
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = await serve(); const base = 'http://127.0.0.1:' + srv.address().port + '/';
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });

async function load(page, W) {
  const pg = await browser.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: W, height: W > 800 ? 1000 : 844 });
  await primeCockpitAuditDocument(pg, 'dark');
  await pg.goto(base + page + '.html', { waitUntil: 'load', timeout: 90000 });
  await enterAuthorizedAuditState(pg, page);
  return { pg, errs };
}
/* the node to click: by id, or the first node whose symbol kind matches */
async function target(pg, c) {
  await pg.waitForFunction((h) => document.querySelector(h + ' .hmi-node[data-node]'), { timeout: 30000 }, c.host).catch(() => {});
  await sleep(1500);
  return pg.evaluate((h, id, sym) => {
    const re = sym ? new RegExp(sym.slice(1, sym.lastIndexOf('/')), sym.slice(sym.lastIndexOf('/') + 1)) : null;
    const all = [...document.querySelectorAll(h + ' .hmi-node[data-node]')];
    const g = id ? all.find((n) => n.getAttribute('data-node') === id) : all.find((n) => re.test(n.getAttribute('data-sym') || '') || re.test(n.getAttribute('data-node') || ''));
    if (!g) return null;
    g.scrollIntoView({ block: 'center', inline: 'center' });
    const b = g.querySelector('.b') || g, r = b.getBoundingClientRect();
    return { id: g.getAttribute('data-node'), x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, c.host, c.node, c.sym ? String(c.sym) : null);
}
const state = (pg) => pg.evaluate(() => {
  const m = document.querySelector('.rz-cvm:not([hidden])');
  const svg = m && m.querySelector('[data-rz-cvm-int] svg.hmi-svg');
  return { modal: !!m, blocks: svg ? svg.querySelectorAll('.hmi-node').length : 0,
    inspector: !!document.querySelector('aside.rz-inspector.open'),
    active: document.activeElement && document.activeElement.closest('.hmi-node') ? document.activeElement.closest('.hmi-node').getAttribute('data-node') : null };
});

try {
  for (const W of WIDTHS) for (const c of CASES) {
    const T = `${c.page}@${W} ${c.node || c.sym}`;
    const { pg, errs } = await load(c.page, W);
    const t = await target(pg, c);
    ok(!!t, `${T}: symbol not found`); if (!t) { await pg.close(); continue; }
    const has = await pg.evaluate(() => !!window.RZConvInternals);
    await pg.mouse.click(t.x, t.y); await sleep(700);
    const s = await state(pg);
    if (c.inside) {
      ok(has && s.modal, `IN1 ${T}: one click did not open the equipment modal ${JSON.stringify(s)}`);
      ok(s.blocks >= 8, `IN1 ${T}: internal drawing has ${s.blocks} blocks (< 8)`);
      ok(!s.inspector, `IN1 ${T}: the side inspector opened as well`);
      await pg.keyboard.press('Escape'); await sleep(500);
      const e = await state(pg);
      ok(!e.modal, `IN1r ${T}: Escape left the modal open`);
      ok(e.active === t.id, `IN1r ${T}: focus went to ${e.active}, not ${t.id}`);
      /* keyboard: Enter on the focused symbol */
      await pg.evaluate((h, id) => { const g = document.querySelector(h + ' .hmi-node[data-node="' + id + '"]'); g.focus(); }, c.host, t.id);
      await pg.keyboard.press('Enter'); await sleep(700);
      const k = await state(pg);
      ok(k.modal && k.blocks >= 8 && !k.inspector, `IN1k ${T}: Enter did not open the inside ${JSON.stringify(k)}`);
    } else {
      ok(!s.modal && s.inspector, `IN1x ${T}: a machine without a drawn inside should open the inspector ${JSON.stringify(s)}`);
    }
    ok(errs.length === 0, `${T}: page errors ${errs.slice(0, 2).join(' | ')}`);
    console.log(`  ${T.padEnd(34)} modal ${s.modal} blocks ${s.blocks} inspector ${s.inspector}`);
    await pg.close();
  }
} finally { await browser.close(); srv.close(); }
if (fails.length) { fails.forEach((f) => console.log('  ✗ ' + f)); console.log(`CONV EQUIPMENT INSIDE — FAIL (${fails.length} of ${checks})`); process.exit(1); }
console.log(`CONV EQUIPMENT INSIDE — PASS (${checks} checks: one click opens the inside, keyboard, focus return, no half-built inside)`);
