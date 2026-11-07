#!/usr/bin/env node
/**
 * test-ltc-lab-golden.mjs — rendered-output parity for ltc-system-modelling-lab.html.
 *
 * The engine itself is gated in node (test-ltc-parity / test-ltc-workbench). This gate pins what the PAGE
 * shows: for a fixed set of input scenarios it sets the inputs by id, lets the page recompute, and records the
 * text of every result id. A UI refit (workflow rail, regrouped inputs) must reproduce every value exactly.
 *
 *   node tools/test-ltc-lab-golden.mjs --record   write tools/fixtures/ltc-lab-golden.json from the current page
 *   node tools/test-ltc-lab-golden.mjs            compare the current page against the fixture (exit 1 on any diff)
 *
 * Env: RZ_BASE (default http://127.0.0.1:8164). Run under the shared browser lock.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = resolve(ROOT, 'tools/fixtures/ltc-lab-golden.json');
const BASE = process.env.RZ_BASE || 'http://127.0.0.1:8164';
const RECORD = process.argv.includes('--record');
const require = createRequire(resolve(ROOT, 'package.json'));
let puppeteer;
try { puppeteer = require('puppeteer'); } catch { puppeteer = createRequire('/home/baguspermana7/wt-journal/package.json')('puppeteer'); }

const OUTPUTS = ['quickConstraintState', 'quickPue', 'quickCop', 'quickOpex', 'quickRisk', 'outCountry', 'outLiquidLoad',
  'outAirLoad', 'outFlow', 'outPump', 'outCdu', 'outPue', 'outCop', 'outWue', 'outEnergy', 'outOpex', 'outHeatCredit',
  'outNetOpex', 'outCarbon', 'outCarbonAvoided', 'outRackType', 'outDesignDensity', 'outControlIndex', 'outFutureFactor',
  'outRackDensity', 'outRisk', 'outConfidence', 'outCalFit'];

/* Seeded generator so the "random" scenarios are the same on every run. */
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

async function readSelectOptions(page) {
  return page.evaluate(() => {
    const o = {};
    for (const id of ['inCoolingArchitecture', 'inClimate', 'inCoolant', 'inRedundancy', 'inRackType']) {
      const el = document.getElementById(id); o[id] = el ? [...el.options].map((x) => x.value) : [];
    }
    return o;
  });
}

function buildScenarios(opts) {
  const sc = [{ name: 'default', set: {} }];
  for (const arch of opts.inCoolingArchitecture) for (const cl of opts.inClimate.slice(0, 2)) {
    sc.push({ name: `arch=${arch}|climate=${cl}`, set: { inCoolingArchitecture: arch, inClimate: cl } });
  }
  const rnd = mulberry32(20261107);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  for (let i = 0; i < 3; i++) {
    sc.push({ name: `seeded-${i}`, set: {
      inItLoad: String(Math.round(20 + rnd() * 180)), inRackCount: String(Math.round(400 + rnd() * 3600)),
      inLiquidCapture: String(Math.round(60 + rnd() * 35)), inPumpEff: String(Math.round(60 + rnd() * 25)),
      inCoolant: pick(opts.inCoolant), inRedundancy: pick(opts.inRedundancy), inRackType: pick(opts.inRackType),
    } });
  }
  return sc;
}

async function run(page, set) {
  await page.goto(`${BASE}/ltc-system-modelling-lab.html`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate((set) => {
    for (const [id, v] of Object.entries(set)) {
      const el = document.getElementById(id); if (!el) throw new Error('missing input ' + id);
      el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, set);
  await new Promise((r) => setTimeout(r, 1200));
  return page.evaluate((ids) => Object.fromEntries(ids.map((id) => {
    const el = document.getElementById(id); return [id, el ? el.textContent.replace(/\s+/g, ' ').trim() : '<missing>'];
  })), OUTPUTS);
}

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'] });
let fail = 0;
try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE}/robots.txt`);
  await page.evaluate(() => {
    localStorage.setItem('rz_premium_session', JSON.stringify({ email: 'educator@resistancezero.com', tier: 'pro', role: 'educator', expires: new Date(Date.now() + 864e5).toISOString() }));
    localStorage.setItem('rz_cookie_consent', 'declined'); localStorage.setItem('theme', 'dark');
  });
  await page.goto(`${BASE}/ltc-system-modelling-lab.html`, { waitUntil: 'networkidle2', timeout: 90000 });
  const scenarios = RECORD ? buildScenarios(await readSelectOptions(page))
    : JSON.parse(readFileSync(FIXTURE, 'utf8')).scenarios.map(({ name, set }) => ({ name, set }));
  const results = [];
  for (const s of scenarios) results.push({ ...s, out: await run(page, s.set) });
  const blank = results.flatMap((r) => Object.entries(r.out).filter(([k, v]) => k !== 'outCalFit' && (v === '' || v === '-' || v === '<missing>')).map(([k]) => `${r.name}:${k}`));
  if (RECORD) {
    if (blank.length) { console.log(`REFUSED — ${blank.length} blank outputs, nothing recorded: ${blank.slice(0, 6).join(', ')}`); fail = 1; }
    else {
      mkdirSync(dirname(FIXTURE), { recursive: true });
      writeFileSync(FIXTURE, JSON.stringify({ page: 'ltc-system-modelling-lab.html', recorded: new Date().toISOString().slice(0, 10), scenarios: results }, null, 1) + '\n');
      console.log(`recorded ${results.length} scenarios × ${OUTPUTS.length} outputs → ${FIXTURE}`);
    }
  } else {
    const want = JSON.parse(readFileSync(FIXTURE, 'utf8')).scenarios;
    const diffs = [];
    results.forEach((r, i) => { for (const id of OUTPUTS) if (r.out[id] !== want[i].out[id]) diffs.push(`${r.name} ${id}: "${want[i].out[id]}" → "${r.out[id]}"`); });
    if (diffs.length) { fail = 1; console.log(`FAIL — ${diffs.length} rendered value(s) differ:`); diffs.slice(0, 20).forEach((d) => console.log('  ' + d)); }
    else console.log(`PASS — ${results.length} scenarios × ${OUTPUTS.length} outputs identical to the golden fixture`);
  }
  if (errs.length) { fail = 1; console.log(`FAIL — ${errs.length} page error(s): ${errs[0]}`); }
} finally { await browser.close(); }
process.exit(fail);
