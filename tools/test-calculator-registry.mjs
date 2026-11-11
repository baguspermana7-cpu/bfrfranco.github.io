#!/usr/bin/env node
// data/calculators.json is the one map of the 11 calculators (ARCHITECTURE-P C1). Every feature that needs a
// calculator's page, project fields or headline results reads it, so a stale entry breaks all of them at once.
// This gate checks the registry against the pages as they render:
//   R1 every <body data-rz-calc> page is in the registry exactly once, and every entry's page declares its calc
//   R2 every field id is an input/select; numeric fields hold a number; select formats match their options
//   R3 every result selector resolves to exactly one element that shows a number after load
//   R4 rz-scenario.js openInCalc opens the registry page for every calc (same map, two places, until P02 reads this file)
//   R5 a `sensitivity` entry (P07): result and anchor resolve once; every factor id is an input/select of a kind that
//      fits (continuous = numeric input, step = select with >= 2 options); an `unmet` selector matches checkboxes
// Usage: node tools/test-calculator-registry.mjs [--registry <path>]   (a planted bad entry must fail it)
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import puppeteer from 'puppeteer';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argi = process.argv.indexOf('--registry');
const REG_PATH = argi > 0 ? resolve(process.argv[argi + 1]) : join(ROOT, 'data/calculators.json');
const reg = JSON.parse(await readFile(REG_PATH, 'utf8'));
const fails = [];
// iso2+region: opex keeps sub-national rows (US-VA, CN2) beside ISO-2 codes, so a reader must not assume pure ISO-2.
const FORMATS = { iso2: /^[A-Z]{2}$/, 'iso2+region': /^[A-Z]{2}(-[A-Z]{2}|\d)?$/, digit: /^\d$/, 'tier-n': /^tier-\d$/ };

// R1 — static: registry <-> pages
const declared = {};
for (const f of (await readdir(ROOT)).filter((n) => n.endsWith('.html'))) {
  const m = (await readFile(join(ROOT, f), 'utf8')).match(/<body[^>]*\bdata-rz-calc="([^"]+)"/);
  if (m) declared[f] = m[1];
}
const seen = {};
for (const c of reg.calculators) {
  if (seen[c.calc]) fails.push(`R1 ${c.calc}: listed twice`);
  seen[c.calc] = 1;
  if (declared[c.page] !== c.calc) fails.push(`R1 ${c.calc}: ${c.page} declares data-rz-calc="${declared[c.page] ?? '(none)'}"`);
}
for (const [page, calc] of Object.entries(declared)) {
  if (!reg.calculators.some((c) => c.page === page)) fails.push(`R1 ${page} (data-rz-calc="${calc}") is not in the registry`);
}

// R4 — rz-scenario openInCalc agrees with the registry
{
  const src = await readFile(join(ROOT, 'js/rz-scenario.js'), 'utf8');
  for (const c of reg.calculators) {
    let href = null;
    const store = {};
    const win = { localStorage: { setItem: (k, v) => { store[k] = v; }, getItem: () => null, removeItem() {} },
      location: { set href(v) { href = v; }, get href() { return href; } }, addEventListener() {} };
    const doc = { readyState: 'complete', body: { getAttribute: () => null }, getElementById: () => null };
    vm.runInNewContext(src, { window: win, document: doc, Event: function () {} });
    win.rzScenario.openInCalc(c.calc, {});
    if (href !== c.page) fails.push(`R4 ${c.calc}: openInCalc goes to ${href} but the registry says ${c.page}`);
  }
}

// R2 + R3 — rendered
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
let fieldsChecked = 0, resultsChecked = 0, factorsChecked = 0;
try {
  for (const c of reg.calculators) {
    if (!declared[c.page]) continue; // already failed R1
    const tab = await browser.newPage();
    await tab.setRequestInterception(true);
    const ALLOW = [base, 'https://cdn.jsdelivr.net/', 'https://cdnjs.cloudflare.com/'];
    tab.on('request', (r) => (ALLOW.some((a) => r.url().startsWith(a)) ? r.continue() : r.abort()));
    await tab.goto(base + c.page, { waitUntil: 'load', timeout: 60000 });
    await new Promise((ok) => setTimeout(ok, 1200));
    const out = await tab.evaluate((entry) => {
      const r = { fields: [], results: [] };
      for (const [key, f] of Object.entries(entry.fields || {})) {
        const el = document.getElementById(f.id);
        const opts = el && el.tagName === 'SELECT' ? [...el.options].map((o) => o.value).filter(Boolean) : null;
        r.fields.push({ key, id: f.id, tag: el ? el.tagName : null, type: el ? el.type : null, value: el ? el.value : null, opts });
      }
      for (const res of entry.results || []) {
        const els = document.querySelectorAll(res.selector);
        r.results.push({ key: res.key, selector: res.selector, n: els.length, text: els[0] ? els[0].textContent.trim().slice(0, 40) : '' });
      }
      if (entry.sensitivity) {
        const sv = entry.sensitivity;
        r.sens = {
          result: document.querySelectorAll(sv.result).length,
          anchor: sv.anchor ? document.querySelectorAll(sv.anchor).length : 0,
          unmet: sv.unmet ? [...document.querySelectorAll(sv.unmet.selector)].map((e) => e.type) : null,
          factors: (sv.factors || []).map((f) => {
            const el = document.getElementById(f.id);
            return { id: f.id, kind: f.kind, tag: el ? el.tagName : null, type: el ? el.type : null,
              value: el ? el.value : null, nopts: el && el.tagName === 'SELECT' ? [...el.options].filter((o) => !o.disabled).length : 0 };
          }),
        };
      }
      return r;
    }, c);
    if (out.sens) {
      if (out.sens.result !== 1) fails.push(`R5 ${c.calc}: sensitivity result ${c.sensitivity.result} matches ${out.sens.result}`);
      if (out.sens.anchor !== 1) fails.push(`R5 ${c.calc}: sensitivity anchor ${c.sensitivity.anchor} matches ${out.sens.anchor}`);
      if (out.sens.unmet && (!out.sens.unmet.length || out.sens.unmet.some((t) => t !== 'checkbox'))) fails.push(`R5 ${c.calc}: unmet selector matches ${out.sens.unmet.length} elements, not all checkboxes`);
      for (const f of out.sens.factors) {
        factorsChecked++;
        if (!f.tag) { fails.push(`R5 ${c.calc}: factor #${f.id} not on the page`); continue; }
        if (f.kind === 'step' && (f.tag !== 'SELECT' || f.nopts < 2)) fails.push(`R5 ${c.calc}: step factor #${f.id} is ${f.tag} with ${f.nopts} options`);
        else if (f.kind === 'continuous' && !(f.tag === 'INPUT' && (f.type === 'number' || f.type === 'range') && Number.isFinite(parseFloat(f.value)))) fails.push(`R5 ${c.calc}: continuous factor #${f.id} is ${f.tag}[${f.type}] value "${f.value}"`);
        else if (f.kind !== 'step' && f.kind !== 'continuous') fails.push(`R5 ${c.calc}: factor #${f.id} has unknown kind "${f.kind}"`);
      }
    }
    for (const f of out.fields) {
      fieldsChecked++;
      const spec = c.fields[f.key];
      if (!f.tag) { fails.push(`R2 ${c.calc}.${f.key}: #${f.id} not on the page`); continue; }
      if (f.tag !== 'INPUT' && f.tag !== 'SELECT') fails.push(`R2 ${c.calc}.${f.key}: #${f.id} is a ${f.tag}, not an input`);
      if (spec.format) {
        const re = FORMATS[spec.format];
        if (!re) fails.push(`R2 ${c.calc}.${f.key}: unknown format "${spec.format}"`);
        else if (!f.opts || !f.opts.length) fails.push(`R2 ${c.calc}.${f.key}: #${f.id} has no options`);
        else if (!f.opts.every((v) => re.test(v))) fails.push(`R2 ${c.calc}.${f.key}: options ${JSON.stringify(f.opts.slice(0, 4))} are not ${spec.format}`);
      } else {
        // "default": null declares a numeric input that starts empty (the user must type it); it must still be type=number.
        if (spec.default === null) { if (f.type !== 'number' || f.value !== '') fails.push(`R2 ${c.calc}.${f.key}: declared empty-by-default but is type=${f.type} value="${f.value}"`); }
        else if (!Number.isFinite(parseFloat(f.value))) fails.push(`R2 ${c.calc}.${f.key}: #${f.id} value "${f.value}" is not a number`);
        if (!Number.isFinite(spec.factor) || !spec.unit) fails.push(`R2 ${c.calc}.${f.key}: unit/factor missing`);
      }
    }
    for (const r of out.results) {
      resultsChecked++;
      if (r.n !== 1) fails.push(`R3 ${c.calc}.${r.key}: ${r.selector} matches ${r.n} elements`);
      else if (!/\d/.test(r.text)) fails.push(`R3 ${c.calc}.${r.key}: ${r.selector} shows "${r.text}" — no number after load`);
    }
    await tab.close();
  }
} finally { await browser.close(); server.close(); }

if (fails.length) {
  console.log(`FAIL test-calculator-registry — ${fails.length} problem(s)`);
  for (const f of fails) console.log('  ' + f);
  process.exit(1);
}
console.log(`PASS test-calculator-registry — ${reg.calculators.length} calculators, ${fieldsChecked} fields, ${resultsChecked} results, ${factorsChecked} sensitivity factors match the rendered pages`);
