#!/usr/bin/env node
/* test-dc-corpus.mjs — CORPUS QUALITY GATE (SHIP GATE for corpus changes).
 * Enforces: every fact carries source_url + verbatim quote + valid unit/value;
 * distributions monotonic p10≤p25≤p50≤p75≤p90; count floors; research-library
 * index consistent with the facts. Run: node tools/test-dc-corpus.mjs */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; fails.push(n + (d ? ' — ' + d : '')); } };

const { facts } = JSON.parse(readFileSync(join(DIR, 'dc-corpus', 'dc-facts.json'), 'utf8'));
ok('facts count floor (≥80)', facts.length >= 80, String(facts.length));
for (const f of facts) {
    const id = `${f.company}/${f.metric}/${f.value}`;
    ok(`fact has source_url: ${id}`, typeof f.source_url === 'string' && f.source_url.startsWith('http'));
    ok(`fact has quote: ${id}`, typeof f.quote === 'string' && f.quote.length >= 20);
    ok(`fact value finite: ${id}`, Number.isFinite(f.value));
    ok(`fact has unit: ${id}`, typeof f.unit === 'string' && f.unit.length > 0);
}
const pueVals = facts.filter((f) => f.metric === 'pue').map((f) => f.value);
ok('pue facts ≥ 20', pueVals.length >= 20, String(pueVals.length));
ok('pue plausible band', pueVals.every((v) => v >= 1.0 && v <= 2.5));

/* engine distributions */
import vm from 'node:vm';
const win = {}; win.window = win; win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
win.CustomEvent = function () {}; win.dispatchEvent = function () {}; win.addEventListener = function () {}; win.removeEventListener = function () {}; win.console = console;
vm.runInContext(readFileSync(join(DIR, '..', 'rz-engine.js'), 'utf8'), vm.createContext(win));
const corpus = win.RZEngine.data.benchmarksCorpus ?? {};
ok('engine benchmarksCorpus present', Object.keys(corpus).length >= 3, String(Object.keys(corpus).length));
for (const [metric, segs] of Object.entries(corpus)) {
    for (const [seg, d] of Object.entries(segs)) {
        const mono = d.p10 <= d.p25 && d.p25 <= d.p50 && d.p50 <= d.p75 && d.p75 <= d.p90;
        ok(`distribution monotonic: ${metric}/${seg}`, mono, JSON.stringify([d.p10, d.p25, d.p50, d.p75, d.p90]));
        ok(`distribution n≥3: ${metric}/${seg}`, d.n >= 3);
        ok(`companies listed: ${metric}/${seg}`, Array.isArray(d.companies) && d.companies.length > 0);
    }
}

/* research library consistency */
const lib = JSON.parse(readFileSync(join(DIR, '..', 'dcmoc', 'src', 'lib', 'research-library.json'), 'utf8'));
ok('research docs ≥ 5', lib.docs.length >= 5, String(lib.docs.length));
const factUrls = new Set(facts.map((f) => f.source_url));
ok('research docs ⊆ fact sources', lib.docs.every((d) => factUrls.has(d.url)));

console.log(`DC-CORPUS GATE — ${pass} passed, ${fail} failed`);
if (fail) { fails.slice(0, 8).forEach((f) => console.log('  FAIL:', f)); process.exit(1); }
console.log('ALL GREEN — provenance mandatory, distributions sane, library consistent.');
