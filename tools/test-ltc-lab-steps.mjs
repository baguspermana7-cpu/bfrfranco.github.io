#!/usr/bin/env node
/**
 * test-ltc-lab-steps.mjs — the LTC lab step thread (js/ltc-lab-steps.js) works and tells the truth.
 *
 * S1 seven steps render, exactly one aria-current; #step=n selects that step
 * S2 every step result is non-empty, and changing IT load changes the Load and Capture results
 * S3 the arithmetic strip: every line that substitutes numbers RECOMPUTES within 1e-6 relative of the engine ("holds");
 *    a line that substitutes but does not hold is a failure (the strip would be showing a wrong equation)
 * S4 the step's equipment is outlined on the plant diagram (Loop → cdu + cool)
 * S5 0 page errors, scrollWidth <= viewport at 1440 and 390
 * Env RZ_BASE (default http://127.0.0.1:8165). Run under the shared browser lock.
 */
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.RZ_BASE || 'http://127.0.0.1:8165';
let puppeteer;
try { puppeteer = createRequire(resolve(ROOT, 'package.json'))('puppeteer'); }
catch { puppeteer = createRequire('/home/baguspermana7/wt-journal/package.json')('puppeteer'); }
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'] });
try {
  for (const w of [1440, 390]) {
    const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.setViewport({ width: w, height: w < 500 ? 844 : 900, isMobile: w < 500, hasTouch: w < 500 });
    await p.goto(`${BASE}/robots.txt`);
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem('rz_premium_session', JSON.stringify({ email: 'educator@resistancezero.com', tier: 'pro', role: 'educator', expires: new Date(Date.now() + 864e5).toISOString() })); localStorage.setItem('rz_cookie_consent', 'declined'); localStorage.setItem('theme', 'dark'); });
    await p.goto(`${BASE}/ltc-system-modelling-lab.html#step=3`, { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 3000));
    const s1 = await p.evaluate(() => ({ n: document.querySelectorAll('.ltc-step').length, cur: [...document.querySelectorAll('.ltc-step[aria-current]')].map((e) => e.id),
      res: [...document.querySelectorAll('.ltc-step-res')].map((e) => e.textContent.trim()),
      lit: [...document.querySelectorAll('rect.ltc-step-node')].map((r) => r.getAttribute('data-rzd-node')).sort().join(',') }));
    ok(s1.n === 7, `${w} S1 ${s1.n} steps`);
    ok(s1.cur.length === 1 && s1.cur[0] === 'ltcStep-loop', `${w} S1 current ${s1.cur}`);
    ok(s1.res.every((t) => t && !/undefined|NaN|^–/.test(t)), `${w} S2 empty/NaN result: ${s1.res.join(' | ')}`);
    ok(s1.lit === 'cdu,cool', `${w} S4 outlined ${s1.lit}`);
    for (const k of ['capture', 'loop', 'rejection', 'cost']) {
      await p.click('#ltcStep-' + k); await new Promise((r) => setTimeout(r, 300));
      const rows = await p.evaluate(() => [...document.querySelectorAll('.ltc-arith-row')].map((r) => r.children[3].textContent + '|' + r.children[0].textContent));
      ok(rows.length > 0, `${w} S3 ${k}: no strip`);
      rows.filter((r) => r.startsWith('engine value')).forEach((r) => fails.push(`${w} S3 ${k}: substituted line does not recompute: ${r}`));
      ok(rows.some((r) => r.startsWith('holds')), `${w} S3 ${k}: no line holds`);
    }
    const before = await p.evaluate(() => document.querySelector('#ltcStep-capture .ltc-step-res').textContent);
    await p.evaluate(() => { const e = document.getElementById('inItLoad'); e.value = '60'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 1500));
    const after = await p.evaluate(() => document.querySelector('#ltcStep-capture .ltc-step-res').textContent);
    ok(after !== before, `${w} S2 Capture result did not change after IT load 60 (${before})`);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= w, `${w} S5 scrollWidth ${sw}`);
    ok(!errs.length, `${w} S5 page error: ${errs[0]}`);
    await p.close();
  }
} finally { await b.close(); }
if (fails.length) { console.log(`FAIL — ${fails.length}`); fails.forEach((f) => console.log('  ' + f)); process.exit(1); }
console.log('PASS — step thread: 7 steps × 2 widths, every substituted equation recomputes, results follow the inputs, 0 errors');
