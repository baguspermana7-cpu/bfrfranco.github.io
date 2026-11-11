#!/usr/bin/env node
/**
 * test-compare-core.mjs — P03 compare core (js/rz-compare.js), Node only.
 *  K1 num(): currency, sign before/after symbol, parentheses, thousands, K/M/B/T only as a multiplier (never kW/MWh), text -> NaN
 *  K2 delta(): abs, pct, pct null on a 0 baseline, A vs A exactly 0, non-numbers -> nulls
 *  K3 tone(): only with a declared direction
 *  K4 diffIds(): differing, missing-in-one, checkbox booleans, identical cases -> []
 *  K5 hashInputs(): key order independent, value sensitive
 *  K6 csv(): BOM, CRLF, quotes doubled, commas/newlines quoted, formula-looking text neutralised, negative numbers kept
 *  K7 tray: max 4, dedupe by hash, invalid case refused, broken storage JSON -> empty, remove, quota failure reported
 * Run: node tools/test-compare-core.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../js/rz-compare.js');
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const eq = (a, b, m) => ok(Object.is(a, b) || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b))), `${m}: got ${a}, want ${b}`);

/* K1 */
[['$1.2M', 1.2e6], ['-$41.4M', -41.4e6], ['$-41.4M', -41.4e6], ['($3.5M)', -3.5e6], ['12,345 kW', 12345], ['99.741%', 99.741], ['1.80', 1.8],
 ['−5.2%', -5.2], ['$16.5k', 16500], ['2.5 MWh', 2.5], ['3 B', 3e9], ['1.1T', 1.1e12], ['>20', 20], ['.5', 0.5]].forEach(([t, v]) => eq(C.num(t), v, 'K1 num ' + t));
['Tier II', '—', '', null, 'n/a'].forEach((t) => ok(Number.isNaN(C.num(t)), 'K1 num should be NaN for ' + t));
/* K2 */
let d = C.delta(100, 110); eq(d.abs, 10, 'K2 abs'); eq(d.pct, 10, 'K2 pct');
d = C.delta(-50, -40); eq(d.abs, 10, 'K2 abs negative base'); eq(d.pct, 20, 'K2 pct over |base|');
d = C.delta(0, 5); eq(d.abs, 5, 'K2 abs on 0 base'); ok(d.pct === null, 'K2 pct must be null on a 0 baseline');
d = C.delta(23610000, 23610000); ok(d.abs === 0 && d.pct === 0, 'K2 A vs A must be exactly 0');
d = C.delta(0.1 + 0.2, 0.3); ok(d.abs === 0, 'K2 float noise reads 0');
d = C.delta(NaN, 3); ok(d.abs === null && d.pct === null, 'K2 NaN base -> nulls');
/* K3 */
ok(C.tone(-5, 'lower') === 'good' && C.tone(5, 'lower') === 'bad' && C.tone(5, 'higher') === 'good', 'K3 tone direction');
ok(C.tone(5, 'none') === '' && C.tone(5, undefined) === '' && C.tone(0, 'lower') === '', 'K3 no tone without a direction or a change');
/* K4 */
const A = { a: { t: 'number', v: '1' }, b: { t: 'select', v: 'x' }, c: { t: 'checkbox', v: true } };
ok(C.diffIds([{ inputs: A }, { inputs: JSON.parse(JSON.stringify(A)) }]).length === 0, 'K4 identical cases -> no diff');
ok(JSON.stringify(C.diffIds([{ inputs: A }, { inputs: Object.assign({}, A, { a: { t: 'number', v: '2' } }) }])) === '["a"]', 'K4 one differing input');
ok(JSON.stringify(C.diffIds([{ inputs: A }, { inputs: { a: A.a, b: A.b } }])) === '["c"]', 'K4 missing in one case differs');
ok(JSON.stringify(C.diffIds([{ inputs: A }, { inputs: A }, { inputs: Object.assign({}, A, { c: { t: 'checkbox', v: false } }) }])) === '["c"]', 'K4 third case differs');
/* K5 */
ok(C.hashInputs({ a: A.a, b: A.b }) === C.hashInputs({ b: A.b, a: A.a }), 'K5 key order must not matter');
ok(C.hashInputs(A) !== C.hashInputs(Object.assign({}, A, { a: { t: 'number', v: '1.0' } })), 'K5 value change must change the hash');
/* K6 */
const out = C.csv([['Result', 'Case 1'], ['a,b', 'say "hi"'], ['line\nbreak', -5], ['=HYPERLINK("x")', '+cmd'], ['-12.5', null]]);
ok(out.charCodeAt(0) === 0xFEFF, 'K6 BOM');
ok(out.split('\r\n').length === 6 && out.endsWith('\r\n'), 'K6 CRLF rows');
ok(out.includes('"a,b","say ""hi"""'), 'K6 comma + quote escaping');
ok(out.includes('"line\nbreak",-5'), 'K6 newline quoted, negative number kept');
ok(out.includes(`"'=HYPERLINK(""x"")",'+cmd`), 'K6 formula text neutralised');
ok(out.includes('\r\n-12.5,\r\n'), 'K6 a negative number string is not neutralised');
/* K7 */
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, m }; };
let s = mem(), t = C.createTray(s, 'tco');
for (let i = 0; i < 4; i++) ok(t.add('Case ' + i, 'current', { x: { t: 'number', v: String(i) } }).ok, 'K7 add ' + i);
let r = t.add('Case 5', 'current', { x: { t: 'number', v: '9' } }); ok(!r.ok && r.reason === 'full' && r.count === 4, 'K7 a fifth case is refused as full');
t.remove(3);
r = t.add('Dup', 'current', { x: { t: 'number', v: '0' } }); ok(!r.ok && r.reason === 'duplicate', 'K7 duplicate inputs refused');
ok(!t.add('', 'current', { x: { t: 'number', v: '7' } }).ok, 'K7 empty name refused');
ok(!t.add('bad', 'evil', { x: { t: 'number', v: '7' } }).ok, 'K7 unknown source refused');
ok(!t.add('bad', 'link', { 'x"><img': { t: 'number', v: '7' } }).ok, 'K7 bad input id refused');
ok(t.list().length === 3 && s.m.rz_compare_tco, 'K7 stored under rz_compare_<calc>');
s.m.rz_compare_tco = '{broken'; ok(C.createTray(s, 'tco').list().length === 0, 'K7 broken JSON -> empty tray');
s.m.rz_compare_tco = JSON.stringify([{ name: 'ok', source: 'current', inputs: {} }, { name: 'x', source: 'evil', inputs: {} }]);
ok(C.createTray(s, 'tco').list().length === 1, 'K7 an invalid stored case is dropped on read');
const full = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem() {} };
r = C.createTray(full, 'tco').add('a', 'current', { x: { t: 'number', v: '1' } }); ok(!r.ok && r.reason === 'storage', 'K7 a storage failure is reported, not swallowed');

if (fails.length) { console.log(`FAIL test-compare-core — ${fails.length} of ${checks}`); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log(`PASS test-compare-core — ${checks} checks: number parse, delta, tone, input diff, hash, CSV (RFC 4180, BOM, formula-safe), tray (max 4, dedupe, validation, storage failure)`);
