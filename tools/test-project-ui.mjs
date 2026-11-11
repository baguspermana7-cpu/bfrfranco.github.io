#!/usr/bin/env node
/**
 * test-project-ui.mjs — P01 stage 1 ship gate: one facility project carried across six calculators, in a real browser.
 *
 *  E1 capex: chip mounted under the tool head; "none" state; the create form starts from this page's values;
 *     Create stores the project, the chip names it, and the page's results are published into it
 *  E2 opex: project inputs are applied (IT load, PUE) and tagged "project"
 *  E3 roi: Total CAPEX is consumed from the CAPEX result (USD -> $M) and tagged "from CAPEX Calculator"
 *  E4 a real (trusted) edit records an override and tags it; Reset brings the project value back;
 *     a scripted change (untrusted) never records an override
 *  E5 editing the project raises the revision: roi's consumed value reads "out of date"
 *  E6 a page opened on a #rzs= scenario link does NOT apply the project and says so
 *  E7 blocked storage: chip disabled and reads "unavailable", nothing throws
 *  E8 390 px: popover open, no horizontal page scroll, chip >= 44 px tall
 *  E9 no page errors anywhere
 *
 * Run: node tools/test-project-ui.mjs
 */
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const { default: puppeteer } = await import('puppeteer');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    // account.html's sign-in module loads Supabase from a CDN this harness does not reach; projects need no account.
    if (path === '/js/rz-supabase.js') { res.writeHead(200, { 'content-type': 'text/javascript' }).end("const api={configured:false,error:null,async getUser(){return null},onChange(){}};window.rzSupa=api;window.rzSupa.ready=Promise.resolve(api);"); return; }
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const allErrs = [];
const open = async (url, opts = {}) => {
  const tab = await browser.newPage();
  await tab.setViewport({ width: opts.width || 1280, height: 900 });
  await tab.setRequestInterception(true);
  tab.on('request', (r) => (r.url().startsWith(base) ? r.continue() : r.abort()));
  // With storage blocked the PAGE's own scripts throw too; only errors raised from rz-project.js count there.
  tab.on('pageerror', (e) => { if (!opts.blockStorage || /rz-project\.js/.test(String(e.stack || ''))) allErrs.push(url + ': ' + String(e.message || e)); });
  // The cookie banner sits over the lower viewport; a reader who answered it once never sees it again.
  if (!opts.blockStorage) await tab.evaluateOnNewDocument(() => { try { localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) {} });
  if (opts.blockStorage) await tab.evaluateOnNewDocument(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
  });
  await tab.goto(base + url, { waitUntil: 'load', timeout: 60000 });
  await tab.waitForFunction(() => document.querySelector('.rz-proj-chip') || document.readyState === 'complete', { timeout: 15000 });
  await tab.waitForFunction(() => !!document.querySelector('.rz-proj-chip'), { timeout: 15000 }).catch(() => {});
  return tab;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const projects = (tab) => tab.evaluate(() => JSON.parse(localStorage.getItem('rz_projects_v1') || 'null'));
const tagOf = (tab, id) => tab.evaluate((id) => { const t = document.querySelector('.rz-proj-tag[data-for="' + id + '"]'); return t ? t.textContent : null; }, id);

try {
  /* E11 — no project: every mapped field keeps the page's own default */
  let tab = await open('tco-calculator.html');
  await tab.evaluate(() => localStorage.removeItem('rz_projects_v1'));
  await tab.reload({ waitUntil: 'load' });
  await tab.waitForSelector('.rz-proj-chip', { timeout: 15000 });
  await sleep(600);
  const tcoDefault = await tab.evaluate(() => { const i = document.getElementById('tcoItLoad'); return { now: i.value, html: i.getAttribute('value') }; });
  ok(tcoDefault.now === tcoDefault.html, `E11 tco IT load ${tcoDefault.now} moved off its default ${tcoDefault.html} with no project`);
  ok(!(await tab.$('.rz-proj-tag')), 'E11 a field is tagged while no project exists');
  await tab.close();

  /* E1 */
  tab = await open('capex-calculator.html');
  await tab.evaluate(() => localStorage.removeItem('rz_projects_v1'));
  await tab.reload({ waitUntil: 'load' });
  await tab.waitForSelector('.rz-proj-chip', { timeout: 15000 });
  const placed = await tab.evaluate(() => { const r = document.querySelector('.rz-proj'); return !!r && !!r.closest('.tool-head'); });
  ok(placed, 'E1 chip is not inside .tool-head');
  ok(/none/.test(await tab.$eval('.rz-proj-chip', (e) => e.textContent)), 'E1 chip should read "none" with no project');
  await tab.click('.rz-proj-chip');
  await tab.waitForSelector('.rz-proj-form', { timeout: 5000 });
  const formIt = await tab.$eval('.rz-proj-form [name=it_load_kw]', (e) => e.value);
  const pageIt = await tab.$eval('#itLoad', (e) => e.value);
  ok(formIt === pageIt && formIt !== '', `E1 form IT load ${formIt} should start from the page's ${pageIt}`);
  await tab.type('.rz-proj-form [name=name]', 'Bekasi DC-2');
  await tab.$eval('.rz-proj-form [name=it_load_kw]', (e) => { e.value = ''; });
  await tab.type('.rz-proj-form [name=it_load_kw]', '4000');
  await tab.$eval('.rz-proj-form [name=pue_design]', (e) => { e.value = ''; });
  await tab.type('.rz-proj-form [name=pue_design]', '1.35');
  await tab.click('.rz-proj-form .rz-proj-primary');
  await sleep(1200);
  let st = await projects(tab);
  const p0 = st && st.projects && Object.values(st.projects)[0];
  ok(!!p0 && p0.name === 'Bekasi DC-2' && p0.inputs.it_load_kw === 4000, 'E1 project not stored with its inputs');
  ok(/Bekasi DC-2/.test(await tab.$eval('.rz-proj-chip', (e) => e.textContent)), 'E1 chip does not name the project');
  ok((await tab.$eval('#itLoad', (e) => e.value)) === '4000', 'E1 page IT load not applied after Create');
  const capexTotal = p0 && p0.results && p0.results.capex && p0.results.capex.capex_total;
  ok(!!capexTotal && capexTotal.value > 1e6, `E1 capex_total not published (${JSON.stringify(capexTotal)})`);

  /* E10 — a click on the project name inside the chip (the <b> render() replaces) must open, not close */
  await tab.click('.rz-proj-chip');
  await sleep(200);
  if (await tab.$eval('.rz-proj-pop', (e) => !e.hidden)) { await tab.click('.rz-proj-chip'); await sleep(200); }
  await tab.click('.rz-proj-chip b');
  await sleep(200);
  ok(await tab.$eval('.rz-proj-pop', (e) => !e.hidden), 'E10 clicking the project name in the chip closed the popover');
  await tab.close();

  /* E2 */
  tab = await open('opex-calculator.html');
  await sleep(800);
  ok((await tab.$eval('#itLoad', (e) => e.value)) === '4000', 'E2 opex IT load not applied');
  ok(Math.abs(parseFloat(await tab.$eval('#pueSlider', (e) => e.value)) - 1.35) < 1e-9, 'E2 opex PUE not applied');
  ok(/project/.test(await tagOf(tab, 'itLoad') || ''), 'E2 opex IT load not tagged "project"');

  /* E4 */
  await tab.$eval('#itLoad', (e) => { e.value = '1234'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  st = await projects(tab);
  let ov = Object.values(st.projects)[0].overrides || {};
  ok(!(ov.opex && ov.opex.itLoad), 'E4 an untrusted (scripted) change recorded an override');
  await tab.$eval('#itLoad', (e) => { e.value = ''; e.focus(); });
  await tab.type('#itLoad', '2500');
  await sleep(300);
  st = await projects(tab);
  ov = Object.values(st.projects)[0].overrides || {};
  ok(ov.opex && ov.opex.itLoad != null, 'E4 a real edit did not record an override');
  ok(/overridden/.test(await tagOf(tab, 'itLoad') || ''), 'E4 override not tagged');
  await tab.click('.rz-proj-tag[data-for="itLoad"] .rz-proj-reset');
  await sleep(300);
  ok((await tab.$eval('#itLoad', (e) => e.value)) === '4000', 'E4 Reset did not restore the project value');
  st = await projects(tab);
  ov = Object.values(st.projects)[0].overrides || {};
  ok(!(ov.opex && ov.opex.itLoad != null), 'E4 Reset left the override stored');
  await tab.close();

  /* E3 */
  tab = await open('roi-calculator.html');
  await sleep(800);
  const roiCapex = parseFloat(await tab.$eval('#totalCapex', (e) => e.value));
  ok(Math.abs(roiCapex - Math.round(capexTotal.value / 1e6)) <= 1, `E3 roi Total CAPEX ${roiCapex} != capex ${capexTotal.value}/1e6`);
  ok(/from CAPEX Calculator/.test(await tagOf(tab, 'totalCapex') || ''), 'E3 roi consumed value not tagged with its source');
  ok(!/out of date/.test(await tagOf(tab, 'totalCapex') || ''), 'E3 fresh result should not read out of date');

  /* E5 */
  await tab.evaluate(() => { const s = window.rzProject.store, p = s.active(); s.update(p.id, { inputs: Object.assign({}, p.inputs, { it_load_kw: 5000 }) }); });
  await tab.reload({ waitUntil: 'load' });
  await tab.waitForSelector('.rz-proj-chip', { timeout: 15000 });
  await sleep(800);
  ok(/out of date/.test(await tagOf(tab, 'totalCapex') || ''), 'E5 stale CAPEX result not flagged after a revision');
  await tab.close();

  /* E13 — kW -> MW on tco (PRD-P01 §21: 20,000 kW reads 20) */
  tab = await open('tco-calculator.html');
  await sleep(800);
  ok((await tab.$eval('#tcoItLoad', (e) => e.value)) === '5', `E13 tco IT load should read 5 (MW) for 5,000 kW, got ${await tab.$eval('#tcoItLoad', (e) => e.value)}`);
  ok(/project/.test(await tagOf(tab, 'tcoItLoad') || ''), 'E13 tco IT load not tagged');
  await tab.close();

  /* E12 — data-rz-project="off" disables the chip for that page */
  tab = await browser.newPage();
  await tab.setRequestInterception(true);
  tab.on('request', (r) => (r.url().startsWith(base) ? r.continue() : r.abort()));
  await tab.evaluateOnNewDocument(() => { document.addEventListener('DOMContentLoaded', () => document.body.setAttribute('data-rz-project', 'off')); });
  await tab.goto(base + 'pue-calculator.html', { waitUntil: 'load' });
  await sleep(1000);
  ok(!(await tab.$('.rz-proj-chip')), 'E12 kill switch data-rz-project="off" did not disable the chip');
  await tab.close();

  /* E14 — Duplicate makes an active copy; account.html lists both, and Delete asks first */
  tab = await open('pue-calculator.html');
  await sleep(500);
  await tab.click('.rz-proj-chip');
  await tab.waitForSelector('.rz-proj-act[data-act="duplicate"]', { timeout: 5000 });
  await tab.click('.rz-proj-act[data-act="duplicate"]');
  await sleep(300);
  st = await projects(tab);
  const names = Object.values(st.projects).map((p) => p.name).sort();
  ok(names.length === 2 && names.includes('Bekasi DC-2 (copy)'), 'E14 Duplicate did not create a copy: ' + names.join(', '));
  await tab.close();
  tab = await open('account.html');
  await tab.waitForSelector('#projList table', { timeout: 10000 }).catch(() => {});
  const rows = await tab.$$eval('#projList tbody tr', (r) => r.map((x) => x.cells[0].textContent));
  ok(rows.length === 2 && rows.some((r) => /\(copy\)/.test(r) && /active/.test(r)), 'E14 account listing: ' + JSON.stringify(rows));
  await tab.evaluate(() => { const r = [...document.querySelectorAll('#projList tbody tr')].find((x) => !/active/.test(x.cells[0].textContent)); r.querySelector('[data-pdel]').click(); });
  await sleep(100);
  ok((await tab.$$eval('#projList tbody tr', (r) => r.length)) === 2, 'E14 Delete removed a project without asking');
  await tab.click('#projList [data-pyes]');
  await sleep(100);
  ok((await tab.$$eval('#projList tbody tr', (r) => r.length)) === 1, 'E14 confirmed Delete did not remove the project');
  await tab.close();

  /* E15 — an embedded copy (?embed=, or inside an iframe) never mounts, applies or publishes */
  tab = await open('roi-calculator.html');
  await sleep(500);
  const before = JSON.stringify(await projects(tab));
  const emb = await tab.evaluate(async (b) => {
    const f = document.createElement('iframe'); f.src = b + 'capex-calculator.html'; f.style.cssText = 'width:800px;height:600px';
    document.body.appendChild(f);
    await new Promise((r) => f.addEventListener('load', r));
    await new Promise((r) => setTimeout(r, 1500));
    const fd = f.contentDocument;
    fd.getElementById('itLoad').value = '777'; fd.getElementById('itLoad').dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 900));
    return { chip: !!fd.querySelector('.rz-proj-chip'), it: fd.getElementById('itLoad').value };
  }, base);
  ok(!emb.chip, 'E15 the chip mounted inside an iframe copy');
  ok(JSON.stringify(await projects(tab)) === before, 'E15 an iframe copy wrote to the project store');
  await tab.close();
  tab = await open('opex-calculator.html?embed=sensitivity');
  await sleep(800);
  ok(!(await tab.$('.rz-proj-chip')), 'E15 the chip mounted on an ?embed= page');
  ok((await tab.$eval('#itLoad', (e) => e.value)) !== '5000', 'E15 project applied on an ?embed= page');
  await tab.close();

  /* E6 */
  tab = await open('opex-calculator.html#rzs=abc');
  await sleep(800);
  ok((await tab.$eval('#itLoad', (e) => e.value)) !== '5000', 'E6 project applied over an opened scenario link');
  await tab.click('.rz-proj-chip');
  await tab.waitForSelector('.rz-proj-act[data-act="apply"]', { timeout: 5000 }).catch(() => {});
  ok(!!(await tab.$('.rz-proj-act[data-act="apply"]')), 'E6 popover does not offer "Apply project values"');
  await tab.close();

  /* E7 */
  tab = await open('pue-calculator.html', { blockStorage: true });
  await sleep(800);
  const blocked = await tab.$eval('.rz-proj-chip', (e) => ({ d: e.disabled, t: e.textContent })).catch(() => null);
  ok(!!blocked && blocked.d && /unavailable/.test(blocked.t), `E7 blocked storage: ${JSON.stringify(blocked)}`);
  await tab.close();

  /* E8 */
  for (const pg of ['capex-calculator.html', 'tco-calculator.html', 'carbon-footprint.html']) {
    tab = await open(pg, { width: 390 });
    await sleep(500);
    await tab.click('.rz-proj-chip');
    await sleep(300);
    const m = await tab.evaluate(() => {
      window.scrollTo(400, window.scrollY);
      const pop = document.querySelector('.rz-proj-pop').getBoundingClientRect(), chip = document.querySelector('.rz-proj-chip').getBoundingClientRect();
      return { sx: window.scrollX, popR: pop.right, vw: innerWidth, chipH: chip.height };
    });
    ok(m.sx === 0, `E8 ${pg}: horizontal page scroll ${m.sx}px with the popover open`);
    ok(m.popR <= m.vw, `E8 ${pg}: popover right edge ${m.popR} past ${m.vw}`);
    ok(m.chipH >= 44, `E8 ${pg}: chip ${m.chipH}px tall`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}
ok(allErrs.length === 0, 'E9 page errors: ' + allErrs.slice(0, 5).join(' | '));
if (fails.length) { console.log(`FAIL test-project-ui — ${fails.length} of ${checks}`); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log(`PASS test-project-ui — ${checks} checks: chip, create from page, apply, consume CAPEX into ROI, trusted override + reset, stale after revision, scenario link precedence, blocked storage, 390 px`);
