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

/* Arc-2 extractor pattern unit tests (positive + negative guards) */
{
    const CASES = [
        ['construction_months', '24 months construction programme for the campus', true],
        ['construction_months', 'construction period of 18 months', true],
        ['construction_months', '3 months after commissioning', false],
        ['capex_usd_per_kw', 'budget at least $350 per kW plus contractor markup', false],
        ['capex_usd_per_kw', 'build cost of $9,000 per kW for Tier III', true],
        ['capex_usd_per_kw', 'tariff of $0.09 per kWh applies', false],
        ['rack_density_kw', 'rack density of 60 kW supported', true],
        ['rack_density_kw', 'supports 132 kW per rack liquid-cooled', true],
        ['rack_density_kw', 'a 500 kW UPS module per rack row', false],
        ['rack_power_kw', 'power consumption per rack exceeds 40 kW in this layout', true],
        ['rack_power_kw', 'racks require 20kW/rack to over 100kW/rack for AI', true],
        ['rack_power_kw', 'the campus needs a 30 MW substation nearby', false],
    ];
    const P = [
        { m: 'construction_months', re: /(\d{1,2})[\s-]*months?[^.\n]{0,40}?(?:construction|programme|build(?:ing)? (?:period|schedule)|schedule)/gi, min: 4, max: 72 },
        { m: 'construction_months', re: /(?:construction|programme|build(?:ing)?)\s+(?:period|duration|schedule)[^.\n]{0,40}?(\d{1,2})[\s-]*months?/gi, min: 4, max: 72 },
        { m: 'capex_usd_per_kw', re: /\$\s?(\d{1,3}(?:,\d{3})*)\s?(?:per|\/)\s?k(?:ilo)?[wW](?:att)?\b(?!h)(?!\s?h)/g, min: 1000, max: 40000 },
        { m: 'rack_density_kw', re: /(\d{1,3}(?:\.\d)?)\s?kW\s?(?:per|\/)\s?rack/gi, min: 2, max: 400 },
        { m: 'rack_density_kw', re: /rack\s+densit(?:y|ies)[^.\n]{0,40}?(\d{1,3}(?:\.\d)?)\s?kW/gi, min: 2, max: 400 },
        { m: 'rack_power_kw', re: /rack[a-z ]{0,20}?(?:densit[a-z]+ )?(?:to |of |exceed[a-z]* |above |over |up to |require[a-z]* |around |about )?(\d{2,3})\s?kW\b/gi, min: 5, max: 400 },
    ];
    for (const [metric, text, want] of CASES) {
        let hit = false;
        for (const p of P.filter((x) => x.m === metric)) {
            p.re.lastIndex = 0; const m = p.re.exec(text);
            if (m) { const v = parseFloat(m[1].replace(/,/g, '')); if (v >= p.min && v <= p.max) hit = true; }
        }
        ok(`pattern ${metric}: ${want ? 'matches' : 'guards'} "${text.slice(0, 45)}…"`, hit === want);
    }
    ok('corpus-facts.json pipeline artifact present', (() => { try { const cf = JSON.parse(readFileSync(join(DIR, '..', 'dcmoc', 'src', 'lib', 'corpus-facts.json'), 'utf8')); return Array.isArray(cf.facts) && cf.facts.length >= 500 && cf.facts.every((f) => f.source_url && f.quote != null); } catch { return false; } })());
}

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
