#!/usr/bin/env node
/*
 * Shared engineering symbol library gate (R128 PRD §4; agreed with the Conventional-family session 2026-11-14).
 * Library: assets/engineering/*.svg + manifest.json -> tools/build-engineering-symbols.mjs -> js/rz-eng-symbols.js
 *
 *   node tools/test-eng-symbols.mjs [--lib=js/rz-eng-symbols.js]   # exit 1 on any failed law
 *
 * E1 every manifest entry's SVG file exists, and every SVG in the folder has a manifest entry
 * E2 no gradient, filter, shadow or bitmap in any symbol
 * E3 an HMI kind (one that declares ports) also declares a standard and a states list; each port is [x, y, medium]
 *    on the 6-unit grid inside the 0..48 box
 * E4 the built library is current: same kinds, labels, ports and states as the manifest
 * E5 the API: list(), ports() (incl. a 90° rotation) and use() return what a drawing needs; svg() keeps its signature
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'assets', 'engineering');
const libArg = (process.argv.find((a) => a.startsWith('--lib=')) || '').slice(6);
const LIB = path.resolve(ROOT, libArg || 'js/rz-eng-symbols.js');
let fail = 0;
const law = (id, ok, msg) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${msg}`); };

const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const kinds = Object.keys(manifest);
const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.svg'));
const missing = kinds.filter((k) => !files.includes(manifest[k].file));
const orphan = files.filter((f) => !kinds.some((k) => manifest[k].file === f));
law('E1', !missing.length && !orphan.length, `${kinds.length} manifest entries, ${files.length} SVG files; missing ${missing.join(', ') || 0}, without entry ${orphan.join(', ') || 0}`);

const painted = files.filter((f) => /Gradient|<filter|feGaussian|drop-shadow|<image/i.test(fs.readFileSync(path.join(SRC, f), 'utf8')));
law('E2', !painted.length, `symbols with gradient/filter/shadow/bitmap: ${painted.join(', ') || 0}`);

const hmi = kinds.filter((k) => manifest[k].ports);
const bad = [];
for (const k of hmi) {
  const m = manifest[k];
  if (!m.standard) bad.push(`${k}: no standard`);
  if (!Array.isArray(m.states)) bad.push(`${k}: no states list`);
  for (const [n, p] of Object.entries(m.ports)) {
    if (!Array.isArray(p) || p.length !== 3 || typeof p[2] !== 'string') { bad.push(`${k}.${n}: not [x, y, medium]`); continue; }
    if (p[0] % 6 || p[1] % 6 || p[0] < 0 || p[0] > 48 || p[1] < 0 || p[1] > 48) bad.push(`${k}.${n} (${p[0]},${p[1]}) off grid`);
  }
}
law('E3', hmi.length > 0 && !bad.length, `${hmi.length} HMI kinds declare standard, states and gridded ports` + (bad.length ? ' — ' + bad.slice(0, 6).join('; ') : ''));

const require = createRequire(import.meta.url);
let L = null;
try { L = require(LIB); } catch (e) { law('E4', false, `cannot load ${path.relative(ROOT, LIB)}: ${e.message}`); }
if (L) {
  const stale = kinds.filter((k) => !L.META[k] || L.META[k].label !== manifest[k].label ||
    (manifest[k].ports && JSON.stringify((L.PORTS || {})[k]) !== JSON.stringify(manifest[k].ports)) ||
    (manifest[k].states && JSON.stringify((L.STATES || {})[k]) !== JSON.stringify(manifest[k].states)));
  law('E4', !stale.length && Object.keys(L.META).length === kinds.length,
    `${path.relative(ROOT, LIB)}: ${Object.keys(L.META).length} kinds for ${kinds.length} in the manifest; stale ${stale.length ? stale.slice(0, 8).join(', ') + (stale.length > 8 ? ' …' : '') : 0} (rebuild: node tools/build-engineering-symbols.mjs)`);
  const api = [];
  if (typeof L.list !== 'function' || !L.list('valve').includes('valveGate')) api.push('list(category)');
  const pr = typeof L.ports === 'function' && L.ports('pumpCentrifugal', { x: 100, y: 50, size: 24, rot: 90 });
  if (!pr || !pr.suction || pr.suction.x !== 100 || pr.suction.y !== 38 || pr.discharge.y !== 62) api.push('ports() with rotation');
  const u = typeof L.use === 'function' && L.use('valveGate', { x: 10, y: 10, size: 24, state: 'open', id: 'V-1' });
  if (!u || !/data-sym="valveGate"/.test(u) || !/data-state="open"/.test(u) || !/data-id="V-1"/.test(u)) api.push('use()');
  if (typeof L.svg !== 'function' || !/^<svg class="rz-sym" viewBox="0 0 48 48" width="24"/.test(L.svg('breaker', 24))) api.push('svg() signature');
  law('E5', !api.length, api.length ? 'broken: ' + api.join(', ') : 'list(), ports() incl. rotation, use() and svg() behave');
}
console.log(`test-eng-symbols: ${fail ? fail + ' failed' : 'all passed'}`);
process.exit(fail ? 1 : 0);
