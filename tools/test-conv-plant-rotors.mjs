#!/usr/bin/env node
/* PRD-CONV-OPS-DEPTH 01 P2 — rotors on chiller-plant.html, read from the rendered page (1440, dark).
   OD-CP-20 every tower cell on CH-M-102 carries a fan rotor; running cells spin (data-spin), standby cells do not
   OD-CP-24 a rotor's period is 100 / speed seconds (1.0 s at 100 %), for tower fans, CDW pumps and CHW pumps, and the
            speed is the engine fleet's (fan speed / pump speed), so the turn rate follows the number in the tooltip
   OD-CP-23 the visible rotor is an HTML copy on its own layer (.chw-rotor-layer), one per spinning rotor, turned by a CSS
            animation of transform only (compositor: no main-thread work per frame), at 360 / period degrees per second
            (+-10 %), three blades 120 degrees apart, no step over 60 degrees beyond the elapsed time
   OD-CP-26 reduced motion: computed animation-name is none on every rotor; values stay drawn
   OD-CP-29 no filter / box-shadow on a rotor
   Red before P2: 0 tower fan rotors. */
import puppeteer from 'puppeteer';
import { serve } from './audit-conv-text.mjs';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await serve(); const base = 'http://127.0.0.1:' + srv.address().port + '/';
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
async function open(reduced) {
  const pg = await browser.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.setViewport({ width: 1440, height: 1000 });
  await pg.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  await primeCockpitAuditDocument(pg, 'dark');
  await pg.goto(base + 'chiller-plant.html', { waitUntil: 'load', timeout: 90000 });
  await enterAuthorizedAuditState(pg, 'chiller-plant');
  await pg.waitForFunction(() => document.querySelector('#chw-sheet-host .hmi-node'), { timeout: 30000 });
  await sleep(1500);
  /* collect CH-M-101 (CHW pumps) first, then open CH-M-102 (cells, CDW pumps) */
  return { pg, errs };
}
const toCdw = async (pg) => {
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button,[role=tab]')].find((x) => /CH-M-102/.test(x.textContent) && x.offsetParent); if (b) b.click(); });
  await pg.waitForFunction(() => document.querySelector('.hmi-node[data-node="ct1"]'), { timeout: 20000 }); await sleep(1500);
};
const read = (pg) => pg.evaluate(() => {
  const C = window.CONV_CALC, out = [];
  const fl = (k) => C.getFleet(k);
  document.querySelectorAll('.hmi-node[data-node]').forEach((g) => {
    const id = g.getAttribute('data-node'), r = g.querySelector('.vfx-rotor');
    let unit = null, spd = null, m;
    if ((m = /^ct(\d+)$/.exec(id))) { unit = fl('tower_cell')[m[1] - 1]; spd = unit && unit.state === 'running' ? unit.fanSpeedPct : 0; }
    else if ((m = /^cp(\d+)$/.exec(id))) { unit = fl('cdw_pump')[m[1] - 1]; spd = unit && unit.state === 'running' ? unit.speedPct : 0; }
    else if ((m = /^ps(\d+)$/.exec(id))) { unit = fl('chw_secondary_pump')[m[1] - 1]; spd = unit && unit.state === 'running' ? unit.speedPct : 0; }
    else return;
    const cs = r ? getComputedStyle(r) : null;
    out.push({ id, state: unit && unit.state, spd, has: !!r, spin: r ? r.hasAttribute('data-spin') : false,
      dur: cs ? parseFloat(cs.animationDuration) : null, name: cs ? cs.animationName : null, filter: cs ? cs.filter : null, shadow: cs ? cs.boxShadow : null });
  });
  return out;
});
try {
  const { pg, errs } = await open(false);
  const rows101 = await read(pg);
  await toCdw(pg);
  const rows = rows101.concat(await read(pg));
  const cells = rows.filter((r) => /^ct/.test(r.id));
  ok(cells.length >= 10, `OD-CP-20 ${cells.length} tower cells found`);
  for (const r of cells) {
    ok(r.has, `OD-CP-20 ${r.id}: no fan rotor`);
    ok(r.spin === (r.state === 'running'), `OD-CP-20 ${r.id} (${r.state}): data-spin ${r.spin}`);
  }
  for (const r of rows.filter((x) => x.spin)) {
    ok(Math.abs(r.dur - 100 / r.spd) <= 0.01 + 0.002 * 100 / r.spd, `OD-CP-24 ${r.id}: period ${r.dur} s at ${r.spd} % (want ${(100 / r.spd).toFixed(3)} s)`);
    ok(r.name === 'vfx-turn', `OD-CP-24 ${r.id}: animation ${r.name}`);
    ok((r.filter === 'none' || !r.filter) && (r.shadow === 'none' || !r.shadow), `OD-CP-29 ${r.id}: filter ${r.filter} shadow ${r.shadow}`);
  }
  const spinning = rows.filter((x) => x.spin).map((x) => x.id);
  /* OD-CP-23 on the open sheet (CH-M-102): sample every copy's angle 41 times, 50 ms apart (2 s: a stale last write is then < 3 % of the span) */
  const smp = await pg.evaluate(async () => {
    const lay = document.querySelector('#chw-sheet-host .chw-rotor-layer'), src = document.querySelectorAll('#chw-sheet-host svg.hmi-svg .vfx-rotor[data-spin]');
    if (!lay) return { lay: false };
    /* the copy turns by a compositor CSS animation: its angle is the animation's progress (currentTime / duration) */
    const ang = () => [...lay.children].map((c) => { const a = c.getAnimations()[0]; if (!a || a.currentTime == null) return null;
      const d = a.effect.getTiming().duration; return 360 * ((a.currentTime / d) % 1); });
    const S = []; for (let k = 0; k < 41; k++) { S.push({ t: performance.now(), a: ang() }); await new Promise((r) => setTimeout(r, 50)); }
    const comp = [...lay.children].every((c) => c instanceof HTMLElement && c.getAnimations().length === 1
      && c.getAnimations()[0].effect.getKeyframes().every((k) => Object.keys(k).filter((p) => !['offset', 'computedOffset', 'easing', 'composite'].includes(p)).join() === 'transform'));
    return { lay: true, comp, copies: lay.children.length, src: src.length, secs: [...src].map((e) => parseFloat(getComputedStyle(e).animationDuration)), S,
      hidden: [...src].every((e) => getComputedStyle(e).visibility === 'hidden') };
  });
  ok(smp.lay, 'OD-CP-23 no rotor layer');
  if (smp.lay) {
    ok(smp.copies === smp.src && smp.src > 0, `OD-CP-23 copies ${smp.copies} vs spinning rotors ${smp.src}`);
    ok(smp.hidden, 'OD-CP-23 the sheet rotor still shows under its copy');
    ok(smp.comp, 'OD-CP-23 a rotor copy is not an HTML element turned by one transform-only animation (main thread would repaint it)');
    for (let i = 0; i < smp.src; i++) {
      let tot = 0, maxStep = 0;
      for (let k = 1; k < smp.S.length; k++) {
        /* the angle a sample sees beyond what its own elapsed time explains: a stalled main thread stalls the sampler
           too, so only an excess is a coarse step (the 3 Hz clock gave 120 degrees at 1 s a turn) */
        const d = ((smp.S[k].a[i] - smp.S[k - 1].a[i]) % 360 + 360) % 360, dts = (smp.S[k].t - smp.S[k - 1].t) / 1000;
        tot += d; maxStep = Math.max(maxStep, Math.abs(d - 360 / smp.secs[i] * dts)); }
      const dt = (smp.S[smp.S.length - 1].t - smp.S[0].t) / 1000, rate = tot / dt, want = 360 / smp.secs[i];
      ok(Math.abs(rate - want) <= want * 0.1 + 15, `OD-CP-23 copy ${i}: ${rate.toFixed(0)} deg/s, want ${want.toFixed(0)}`);
      ok(maxStep < 60, `OD-CP-23 copy ${i}: a step ${maxStep.toFixed(0)} deg off its elapsed time`);
    }
  }
  ok(spinning.some((i) => /^ct/.test(i)) && spinning.some((i) => /^cp/.test(i)) && spinning.some((i) => /^ps/.test(i)), `OD-CP-24 classes spinning: ${spinning.join(',')}`);
  ok(errs.length === 0, 'page errors: ' + errs.slice(0, 2).join(' | '));
  await pg.close();
  const R = await open(true);
  const rr = (await read(R.pg)).concat(await toCdw(R.pg).then(() => read(R.pg)));
  for (const r of rr.filter((x) => x.has)) ok(r.name === 'none', `OD-CP-26 ${r.id}: reduced motion animation ${r.name}`);
  ok(await R.pg.evaluate(() => !document.querySelector('.chw-rotor-layer')), 'OD-CP-26 reduced motion still builds a turning rotor layer');
  const vals = await R.pg.evaluate(() => [...document.querySelectorAll('[data-val^="ct1:"]')].map((e) => e.textContent).join('|'));
  ok(/\d/.test(vals), `OD-CP-26 values gone under reduced motion: ${vals}`);
  await R.pg.close();
  console.log(`  ${cells.length} cells, ${spinning.length} spinning rotors`);
} finally { await browser.close(); srv.close(); }
if (fails.length) { fails.slice(0, 12).forEach((f) => console.log('  ✗ ' + f)); console.log(`CONV PLANT ROTORS — FAIL (${fails.length} of ${checks})`); process.exit(1); }
console.log(`CONV PLANT ROTORS — PASS (${checks} checks: tower fan rotor on every cell, spinning only while running; period = 100 / engine speed for fans and pumps; reduced motion still; no filter)`);
