// P11 — rendered location values agree across calculators, and each prefilled value says where it comes from.
// L1 same ISO code → same energy price on carbon, opex, tco (country:XX) and same grid factor on carbon;
//    the value equals RZEngine.data.countries (the one dataset).
// L2 carbon (grid + energy) and opex (energy) show the evidence word ASSUMED; the source sentence is its tooltip; both themes, 390 px fits.
// L3 an opex row the engine does not carry (HK) reads "legacy page value, no source on file".
// Run: node tools/test-locations-ui.mjs [--base=http://127.0.0.1:PORT]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';
const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const puppeteer = require('puppeteer');
global.window = {}; require(resolve(ROOT, 'rz-engine.js'));
const C = global.window.RZEngine.data.countries;
const CODES = ['ID', 'SG', 'GB', 'DE', 'JP', 'BR', 'AU']; // opex has no plain US (US-VA/TX/CA rows)
let base = (process.argv.find((a) => a.startsWith('--base=')) || '').slice(7), server = null;
if (!base) {
  const port = await new Promise((r) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  base = 'http://127.0.0.1:' + port; await new Promise((r) => setTimeout(r, 900));
}
{ // identity: the server answering must serve THIS tree
  const served = await fetch(base + '/js/rz-version.js').then((r) => r.text()).catch(() => '');
  if (served !== readFileSync(join(ROOT, 'js/rz-version.js'), 'utf8')) { console.error('FAIL — ' + base + ' does not serve this tree'); if (server) server.kill(); process.exit(1); }
}
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.error('  ✗ ' + n + (d !== undefined ? ' ' + JSON.stringify(d) : '')); } };
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'], protocolTimeout: 90000 });
const errors = [];
async function open(path, theme, width) {
  const p = await browser.newPage();
  await p.setViewport({ width, height: 900 });
  p.on('pageerror', (e) => errors.push(path + ': ' + e.message));
  await p.evaluateOnNewDocument((t) => { try { localStorage.setItem('theme', t); } catch (e) {} }, theme);
  await p.goto(base + '/' + path, { waitUntil: 'networkidle2', timeout: 60000 });
  await p.waitForFunction(() => window.RZEngine && window.RZEngine.data && window.RZEngine.data.countries, { timeout: 20000 });
  return p;
}
const settle = () => new Promise((r) => setTimeout(r, 120));
const seen = { carbon: {}, opex: {}, tco: {} };
for (const theme of ['dark', 'light']) {
  const cp = await open('carbon-footprint.html', theme, 1440);
  for (const code of CODES) {
    await cp.select('#countrySelect', code); await settle();
    const r = await cp.evaluate(() => ({ rate: +document.getElementById('electricityRate').value, grid: +document.getElementById('gridIntensity').value,
      rs: (document.getElementById('electricityRateSrc') || {}).title || '', gs: (document.getElementById('gridIntensitySrc') || {}).title || '',
      rv: (document.getElementById('electricityRateSrc') || {}).textContent || '', gv: (document.getElementById('gridIntensitySrc') || {}).textContent || '',
      word: getComputedStyle(document.querySelector('#electricityRateSrc b') || document.body).color }));
    seen.carbon[code] = r;
    ok(`carbon ${theme} ${code} rate = engine`, r.rate === C[code].economy.electricityRate, r.rate);
    ok(`carbon ${theme} ${code} grid = engine`, r.grid === C[code].environment.gridCarbonIntensity, r.grid);
    ok(`carbon ${theme} ${code} source tooltips say ASSUMED · DCMOC country reference`, /^ASSUMED · DCMOC country reference/.test(r.rs) && /^ASSUMED · /.test(r.gs), [r.rs, r.gs]);
    ok(`carbon ${theme} ${code} visible line is the evidence word only`, r.rv === 'ASSUMED' && r.gv === 'ASSUMED', [r.rv, r.gv]);
  }
  await cp.close();
  const op = await open('opex-calculator.html', theme, 1440);
  for (const code of [...CODES, 'HK']) {
    if (!(await op.$(`#countrySelect option[value="${code}"]`))) { ok(`opex has ${code}`, false); continue; }
    await op.select('#countrySelect', code); await settle();
    const r = await op.evaluate(() => ({ rate: parseFloat(document.getElementById('energyRate').textContent.replace('$', '')), src: (document.getElementById('energyRateSrc') || {}).title || '', vis: (document.getElementById('energyRateSrc') || {}).textContent || '' }));
    seen.opex[code] = r;
    ok(`opex ${theme} ${code} visible line is the evidence word only`, r.vis === 'ASSUMED', r.vis);
    if (code === 'HK') ok(`opex ${theme} HK legacy page value`, /^ASSUMED · legacy page value, no source on file/.test(r.src), r.src);
    else {
      ok(`opex ${theme} ${code} rate = engine`, Math.abs(r.rate - C[code].economy.electricityRate) < 5e-4, r.rate);
      ok(`opex ${theme} ${code} source says ASSUMED`, /^ASSUMED · DCMOC country reference/.test(r.src), r.src);
    }
  }
  await op.close();
}
const tp = await open('tco-calculator.html', 'dark', 1440);
for (const code of CODES) {
  const region = C[code].region === 'APAC' ? 'APAC' : (C[code].region === 'EMEA' || C[code].region === 'EU' ? 'EMEA' : C[code].region);
  const regions = await tp.$$eval('#tcoRegion option', (o) => o.map((x) => x.value));
  let found = false;
  for (const rg of [region, ...regions]) {
    await tp.select('#tcoRegion', rg); await settle();
    if (await tp.$(`#tcoCountry option[value="country:${code}"]`)) { await tp.select('#tcoCountry', 'country:' + code); found = true; break; }
  }
  await settle();
  const rate = found ? await tp.evaluate(() => parseFloat(document.getElementById('mktPowerRate').textContent.replace('$', ''))) : NaN;
  seen.tco[code] = rate;
  ok(`tco ${code} power = engine`, found && Math.abs(rate - C[code].economy.electricityRate) < 5e-4, { found, rate });
}
await tp.close();
// L1 across pages, from what each page rendered
for (const code of CODES) ok(`${code} same energy price on carbon/opex/tco`, seen.carbon[code] && seen.opex[code] && Math.abs(seen.carbon[code].rate - seen.opex[code].rate) < 5e-4 && Math.abs(seen.carbon[code].rate - seen.tco[code]) < 5e-4, [seen.carbon[code] && seen.carbon[code].rate, seen.opex[code] && seen.opex[code].rate, seen.tco[code]]);
// 390 px: the source line stays inside the viewport
for (const path of ['carbon-footprint.html', 'opex-calculator.html']) {
  const p = await open(path, 'light', 390); await p.select('#countrySelect', 'ID'); await settle();
  const r = await p.evaluate(() => { const els = [...document.querySelectorAll('#electricityRateSrc,#gridIntensitySrc,#energyRateSrc')]; return { n: els.length, over: els.filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length, sw: document.documentElement.scrollWidth }; });
  ok(`${path} 390 px source line inside the viewport`, r.n > 0 && r.over === 0 && r.sw <= 391, r);
  await p.close();
}
ok('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close(); if (server) server.kill();
console.log((fail ? 'FAIL' : 'PASS') + ' test-locations-ui — ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
