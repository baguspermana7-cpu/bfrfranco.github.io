#!/usr/bin/env node
/* test-conv-point-truth.mjs — PRD-CONV-EQUIPMENT-INSIDE TR1 "one point, one value". Owner R186 found CHWP-01A at
   59 % / 71 A in the hover tooltip, 75 % / 91 A in the inspector and 81 % / 95 A in the modal at the same moment: each
   view seeded its own simulation. On chiller-plant.html at 1440, for every duty CHW pump:
   TR1a the inspector's Speed and Motor current equal the symbol tooltip rows (chwRead) read at the same moment
   TR1b the equipment modal (double-click) shows the same Speed and Motor current
   TR1c the inspector's Differential head equals the tooltip head in m × 9.80665 kPa/m (one reading, two units)
   node tools/test-conv-point-truth.mjs */
import puppeteer from 'puppeteer';
import { serve } from './audit-conv-text.mjs';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';

const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await serve(); const base = 'http://127.0.0.1:' + srv.address().port + '/';
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const num = (re, t) => { const m = re.exec(t || ''); return m ? Number(m[1].replace(/,/g, '')) : null; };
const SPD = /\bSpeed\s*(-?[\d,]+(?:\.\d+)?)\s*%/i, AMP = /Motor current\s*(-?[\d,]+(?:\.\d+)?)\s*A/i, HEAD = /Differential head\s*(-?[\d,]+(?:\.\d+)?)\s*kPa/i;

try {
  const pg = await browser.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: 1440, height: 1000 });
  await primeCockpitAuditDocument(pg, 'dark');
  /* "the same moment": the page's process step (stepProcess, every 1200 ms) is not scheduled, so the plant stands
     still while the three views are read; every other timer runs */
  await pg.evaluateOnNewDocument(() => { const si = window.setInterval; window.setInterval = function (f, ms) { return ms === 1200 ? 0 : si.apply(window, arguments); }; });
  await pg.goto(base + 'chiller-plant.html', { waitUntil: 'load', timeout: 90000 });
  await enterAuthorizedAuditState(pg, 'chiller-plant');
  await pg.waitForFunction(() => document.querySelector('#chw-sheet-host .hmi-node[data-node="pa1"]'), { timeout: 30000 });
  await sleep(2000);
  /* freeze the page's random walk so "the same moment" is one state for the three reads */
  const ids = await pg.evaluate(() => [...document.querySelectorAll('#chw-sheet-host .hmi-node[data-node]')].map((g) => g.getAttribute('data-node'))
    .filter((id) => /^p[ab]\d+$/.test(id)).filter((id) => { const n = { id }; const r = chwRead(n); return r && r.rows && r.rows[0] && r.rows[0][1] === 'Duty'; }));
  ok(ids.length >= 3, `fewer than 3 duty CHW pumps found (${ids.join(',')})`);
  for (const id of ids.slice(0, 4)) {
    const pt = await pg.evaluate((id) => { const g = document.querySelector('#chw-sheet-host .hmi-node[data-node="' + id + '"]'); g.scrollIntoView({ block: 'center', inline: 'center' });
      const r = (g.querySelector('.b') || g).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
    await pg.mouse.click(pt.x, pt.y); await sleep(500);
    const r = await pg.evaluate((id) => {
      const rows = chwRead({ id }).rows, g = (k) => { const x = rows.find((q) => q[0] === k); return x ? parseFloat(String(x[1])) : null; };
      const a = document.querySelector('aside.rz-inspector.open');
      return { tip: { spd: g('Speed'), amp: g('Current'), head: g('Head') }, insp: a ? a.innerText.replace(/\s+/g, ' ') : '' };
    }, id);
    const ins = { spd: num(SPD, r.insp), amp: num(AMP, r.insp), head: num(HEAD, r.insp) };
    ok(ins.spd !== null && Math.round(r.tip.spd) === ins.spd, `TR1a ${id}: speed tooltip ${r.tip.spd} % vs inspector ${ins.spd} %`);
    ok(ins.amp !== null && Math.round(r.tip.amp) === ins.amp, `TR1a ${id}: current tooltip ${r.tip.amp} A vs inspector ${ins.amp} A`);
    ok(ins.head !== null && Math.abs(r.tip.head * 9.80665 - ins.head) <= 1, `TR1c ${id}: head tooltip ${r.tip.head} m (${(r.tip.head * 9.80665).toFixed(0)} kPa) vs inspector ${ins.head} kPa`);
    await pg.keyboard.press('Escape'); await sleep(250);
    await pg.mouse.click(pt.x, pt.y, { clickCount: 2 }); await sleep(700);
    const m = await pg.evaluate(() => { const x = document.querySelector('.rz-cvm:not([hidden])'); return x ? x.innerText.replace(/\s+/g, ' ') : ''; });
    const mo = { spd: num(SPD, m), amp: num(AMP, m) };
    ok(mo.spd !== null && mo.spd === ins.spd && mo.amp === ins.amp, `TR1b ${id}: modal ${mo.spd} % / ${mo.amp} A vs inspector ${ins.spd} % / ${ins.amp} A`);
    console.log(`  ${id.padEnd(5)} tooltip ${Math.round(r.tip.spd)} % / ${Math.round(r.tip.amp)} A · inspector ${ins.spd} % / ${ins.amp} A / ${ins.head} kPa · modal ${mo.spd} % / ${mo.amp} A`);
    await pg.keyboard.press('Escape'); await sleep(300);
  }
  ok(errs.length === 0, 'page errors: ' + errs.slice(0, 2).join(' | '));
} finally { await browser.close(); srv.close(); }
if (fails.length) { fails.forEach((f) => console.log('  ✗ ' + f)); console.log(`CONV POINT TRUTH — FAIL (${fails.length} of ${checks})`); process.exit(1); }
console.log(`CONV POINT TRUTH — PASS (${checks} checks: CHW pump speed, current and head equal in tooltip, inspector and modal)`);
