#!/usr/bin/env node
/**
 * test-sensitivity.mjs — P07 ship gate: "What drives this result" is computed by the page itself and says so honestly.
 *
 *  U1  fixture (out = 2x + mode + r/100 + 5·a + 1·b): exact low/high per kind, clamp to max, range snapped to step,
 *      a one-option select and a poisoned result are reported "failed" with a reason while the rest still rank,
 *      ties keep declaration order, cancel after 2 returns "partial" with 2 rows
 *  U2  pue: the panel is collapsed <details>; Compute fills one row per declared factor with no failure; for EVERY
 *      factor the low and high equal the page's own #pueValue after setting that input on the page (UI path);
 *      the page's inputs are unchanged afterwards; a row click focuses its input; 390 px has no horizontal scroll
 *  U4  roi + carbon: their old charts are gone; every factor equals the page's own NPV after moving that input
 *  U3  tia: one row per unmet applicable item (collapsed categories included); the top row's gain equals the score
 *      change when that item is ticked on the page
 *
 * Run: node tools/test-sensitivity.mjs
 */
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const near = (a, b) => Math.abs(a - b) < 1e-9;

const { default: puppeteer } = await import('puppeteer');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const open = async (url, width = 1280) => {
  const tab = await browser.newPage();
  await tab.setViewport({ width, height: 900 });
  await tab.setRequestInterception(true);
  tab.on('request', (r) => (r.url().startsWith(base) || /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)\//.test(r.url()) ? r.continue() : r.abort()));
  const errs = []; tab.on('pageerror', (e) => errs.push(String(e.message || e)));
  await tab.goto(base + url, { waitUntil: 'load', timeout: 60000 });
  return { tab, errs };
};

try {
  /* U1 */
  {
    const { tab, errs } = await open('tools/fixtures/sensitivity-fixture.html');
    const r = await tab.evaluate(async () => {
      const spec = { calc: 'fx', page: 'sensitivity-fixture.html', result: '#out', settleMs: 100, stepMs: 30,
        factors: [{ id: 'x', kind: 'continuous' }, { id: 'r', kind: 'continuous' }, { id: 'mode', kind: 'step' },
          { id: 'solo', kind: 'step' }, { id: 'z', kind: 'continuous' }, { id: 'nope', kind: 'continuous' }],
        unmet: { selector: 'input[type=checkbox][id^="chk-"]' } };
      const inputs = { x: { t: 'number', v: '10' }, r: { t: 'range', v: '50' }, mode: { t: 'select', v: '1' }, z: { t: 'number', v: '1' } };
      const full = await rzSensitivity.run(spec, { inputs });
      let n = 0;
      const part = await rzSensitivity.run(spec, { inputs, onProgress: (i) => { n = i; }, isCancelled: () => n >= 2 });
      const parse = ['-$41.4M', '($2.5K)', '−3.1', '$1,234.5', '72%', '1.46', 'Tier 3 - 82 %'].map((x) => rzSensitivity.num(x));
      return { full, part, parse };
    });
    const by = Object.fromEntries(r.full.rows.map((x) => [x.id, x]));
    ok(near(r.full.base, 21.5), `U1 base ${r.full.base}, expected 21.5`);
    ok(by.x && near(by.x.low, 19.5) && near(by.x.high, 22.5) && by.x.clamped, `U1 x ${JSON.stringify(by.x)}`);
    ok(by.r && near(by.r.low, 21.45) && near(by.r.high, 21.55) && by.r.lowValue === '45' && by.r.highValue === '55', `U1 r ${JSON.stringify(by.r)}`);
    ok(by.mode && near(by.mode.low, 20.5) && near(by.mode.high, 23.5), `U1 mode ${JSON.stringify(by.mode)}`);
    ok(by.solo && by.solo.failed && by.solo.reason === 'only one option', `U1 solo ${JSON.stringify(by.solo)}`);
    ok(by.z && by.z.failed && by.z.reason === 'result is not a number', `U1 z ${JSON.stringify(by.z)}`);
    ok(by.nope && by.nope.failed && by.nope.reason === 'input not on the page', `U1 missing input ${JSON.stringify(by.nope)}`);
    ok(by['chk-a'] && near(by['chk-a'].high - r.full.base, 5) && by['chk-b'] && near(by['chk-b'].high - r.full.base, 1), 'U1 unmet gains wrong');
    const order = r.full.rows.map((x) => x.id).join(',');
    ok(order.startsWith('chk-a,x,mode,chk-b,r,'), `U1 order ${order} (swing desc, ties in declaration order, failures last)`);
    ok(r.part.cancelled && r.part.rows.length === 2 && r.part.total === 8, `U1 cancel: ${r.part.rows.length} rows of ${r.part.total}, cancelled=${r.part.cancelled}`);
    ok(JSON.stringify(r.parse) === JSON.stringify([-41400000, -2500, -3.1, 1234.5, 72, 1.46, 3]), `U1 number parsing ${JSON.stringify(r.parse)}`);
    ok(errs.length === 0, `U1 page errors: ${errs.join(' | ')}`);
    await tab.close();
  }
  /* U2 */
  {
    const { tab, errs } = await open('pue-calculator.html');
    await tab.waitForSelector('details.rz-sens', { timeout: 15000 });
    ok(await tab.evaluate(() => !document.querySelector('details.rz-sens').open && /What drives this result/.test(document.querySelector('details.rz-sens summary').textContent)), 'U2 panel missing or not collapsed');
    const before = await tab.evaluate(() => JSON.stringify(rzScenario.capture()));
    await tab.click('details.rz-sens summary');
    await tab.click('.rz-sens-run');
    await tab.waitForFunction(() => /^(Done\.|Could not|Stopped)/.test(document.querySelector('.rz-sens-status').textContent), { timeout: 120000 });
    const ui = await tab.evaluate(() => ({ status: document.querySelector('.rz-sens-status').textContent,
      lockedOnPage: [...document.querySelectorAll('.locked input[id], .locked select[id]')].map((e) => e.id),
      lockedRows: [...document.querySelectorAll('.rz-sens-row')].filter((b) => /^Pro input/.test(b.querySelector('.rz-sens-vals').textContent)).map((b) => b.getAttribute('data-rz-sens-focus')),
      rows: document.querySelectorAll('.rz-sens-rows li').length, failed: document.querySelectorAll('.rz-sens-row.is-failed').length,
      warn: (document.querySelector('.rz-sens-warn') || {}).textContent || '' }));
    const reg = JSON.parse(await readFile(join(ROOT, 'data/calculators.json'), 'utf8')).calculators.find((c) => c.calc === 'pue');
    const declaredLocked = reg.sensitivity.factors.map((f) => f.id).filter((id) => ui.lockedOnPage.includes(id));
    ok(ui.status === 'Done.' && ui.rows === reg.sensitivity.factors.length && ui.failed === ui.lockedRows.length && !ui.warn, `U2 panel ${JSON.stringify(ui)}`);
    ok(declaredLocked.length > 0 && declaredLocked.sort().join() === ui.lockedRows.sort().join(), `U2 Pro-locked rows ${ui.lockedRows} != locked inputs ${declaredLocked}`);
    ok(await tab.evaluate(() => JSON.stringify(rzScenario.capture())) === before, 'U2 the page inputs changed during the run');
    const v = await tab.evaluate(async () => {
      const reg = await (await fetch('data/calculators.json')).json();
      const c = reg.calculators.find((x) => x.calc === 'pue');
      const res = await rzSensitivity.run(Object.assign({ calc: c.calc, page: c.page }, c.sensitivity));
      const pick = (id, val) => { const el = document.getElementById(id); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
      const read = () => rzSensitivity.num(document.querySelector('#pueValue').textContent);
      const bad = [];
      for (const row of res.rows) {
        if (row.locked) continue;
        const el = document.getElementById(row.id), keep = el.value;
        pick(row.id, row.lowValue); const lo = read();
        pick(row.id, row.highValue); const hi = read();
        pick(row.id, keep);
        if (lo !== row.low || hi !== row.high) bad.push(`${row.id}: panel ${row.low}/${row.high}, page ${lo}/${hi}`);
      }
      return { n: res.rows.filter((r) => !r.locked).length + res.rows.filter((r) => r.locked).length, bad, base: res.base, page: read(), err: res.error };
    });
    ok(v.n === reg.sensitivity.factors.length && v.bad.length === 0, `U2 UI-path mismatch on ${v.bad.length} of ${v.n}: ${v.bad.slice(0, 3).join('; ')}`);
    ok(v.base === v.page && !v.err, `U2 base ${v.base} vs page ${v.page} (${v.err})`);
    const first = await tab.$eval('.rz-sens-row', (b) => b.getAttribute('data-rz-sens-focus'));
    await tab.click('.rz-sens-row');
    await new Promise((r) => setTimeout(r, 400));
    ok(await tab.evaluate((id) => document.activeElement && document.activeElement.id === id, first), `U2 row click did not focus #${first}`);
    ok(errs.length === 0, `U2 page errors: ${errs.join(' | ')}`);
    await tab.setViewport({ width: 390, height: 844 });
    await new Promise((r) => setTimeout(r, 300));
    ok(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'U2 390 px: horizontal scroll with the panel open');
    await tab.close();
  }
  /* U4 roi + carbon: their own charts are gone (roi: fixed weights x |NPV|; carbon: a copied formula that moved a read-only
     field and left out terms); every factor equals the page's own result after moving that input on the page */
  for (const [calc, page] of [['roi', 'roi-calculator.html'], ['carbon', 'carbon-footprint.html']]) {
    const src = await readFile(join(ROOT, page), 'utf8');
    ok(!/tornadoChart|runSensitivity\(/.test(src), `U4 ${calc} still carries its old tornado`);
    const { tab, errs } = await open(page);
    await tab.waitForSelector('details.rz-sens', { timeout: 15000 });
    const v = await tab.evaluate(async (calc) => {
      const reg = await (await fetch('data/calculators.json')).json();
      const c = reg.calculators.find((x) => x.calc === calc);
      const before = JSON.stringify(rzScenario.capture());
      const res = await rzSensitivity.run(Object.assign({ calc: c.calc, page: c.page }, c.sensitivity));
      const pick = (id, val) => { const el = document.getElementById(id); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
      const read = () => rzSensitivity.num(document.querySelector(c.sensitivity.result).textContent);
      const same = JSON.stringify(rzScenario.capture()) === before;
      const bad = [];
      for (const row of res.rows) {
        if (row.locked || row.failed) { bad.push(row.id + ': ' + (row.reason || 'locked')); continue; }
        const el = document.getElementById(row.id), keep = el.value;
        pick(row.id, row.lowValue); await new Promise((r) => setTimeout(r, 30)); const lo = read();
        pick(row.id, row.highValue); await new Promise((r) => setTimeout(r, 30)); const hi = read();
        pick(row.id, keep);
        if (lo !== row.low || hi !== row.high) bad.push(`${row.id}: panel ${row.low}/${row.high}, page ${lo}/${hi}`);
      }
      return { n: res.rows.length, want: c.sensitivity.factors.length, bad, base: res.base, page: read(), same, err: res.error };
    }, calc);
    ok(v.n === v.want && v.bad.length === 0, `U4 ${calc} mismatch on ${v.bad.length} of ${v.n}: ${v.bad.slice(0, 3).join('; ')}`);
    ok(v.base === v.page, `U4 ${calc} base ${v.base} vs page ${v.page}`);
    ok(v.same && !v.err, `U4 ${calc} inputs changed during the run or base not reproduced (${v.err})`);
    ok(errs.length === 0, `U4 ${calc} page errors: ${errs.join(' | ')}`);
    await tab.close();
  }
  /* U3 */
  {
    const { tab, errs } = await open('tia-942-checklist.html');
    await tab.waitForSelector('details.rz-sens', { timeout: 15000 });
    const t = await tab.evaluate(async () => {
      const reg = await (await fetch('data/calculators.json')).json();
      const c = reg.calculators.find((x) => x.calc === 'tia');
      const unmet = document.querySelectorAll('input[type=checkbox][id^="chk-"]:not(:checked)').length;
      const res = await rzSensitivity.run(Object.assign({ calc: c.calc, page: c.page }, c.sensitivity));
      const top = res.rows[0];
      const score = () => rzSensitivity.num(document.querySelector('#scoreValue').textContent);
      const b = score(); const el = document.getElementById(top.id); el.click(); const after = score(); el.click();
      return { unmet, n: res.rows.length, gain: top.high - res.base, pageGain: after - b, failed: res.rows.filter((r) => r.failed).length, back: score() === b };
    });
    ok(t.unmet > 30 && t.n === t.unmet && t.failed === 0, `U3 rows ${t.n} for ${t.unmet} unmet items, ${t.failed} failed`);
    ok(t.gain > 0 && t.gain === t.pageGain && t.back, `U3 top gain ${t.gain} vs page ${t.pageGain}`);
    ok(errs.length === 0, `U3 page errors: ${errs.join(' | ')}`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (fails.length) { console.log(`FAIL test-sensitivity — ${fails.length} of ${checks}`); fails.forEach((f) => console.log('  ' + f)); process.exit(1); }
console.log(`PASS test-sensitivity — ${checks} checks: fixture exact per kind (clamp, snap, step, unmet, failures, ties, cancel); pue every factor equals the page's own recompute; tia top gain equals ticking it`);
