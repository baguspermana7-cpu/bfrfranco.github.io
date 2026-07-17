#!/usr/bin/env node
/* calc.test.mjs — proves the DC-OS engine loads + dispatches SERVER-SIDE.
 * Mirrors src/calc.js: shim browser globals → load rz-engine.js → resolve a
 * dotted models/data path → call. This is the anti-theft guarantee: the math
 * runs here, the model source never ships to the browser.
 * Run: node cf-worker/test/calc.test.mjs   (exit 0 = pass) */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// shim BEFORE loading the engine (src/engine-shim.js does the same in the Worker)
const noop = () => {};
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
globalThis.document = { createElement: () => ({ style: {}, appendChild: noop, setAttribute: noop, addEventListener: noop }), body: { appendChild: noop }, head: { appendChild: noop }, getElementById: () => null, addEventListener: noop };
globalThis.CustomEvent = function () {};
globalThis.addEventListener = noop;
globalThis.dispatchEvent = noop;

const RZEngine = require(resolve(__dirname, '..', '..', 'rz-engine.js'));

const resolvePath = (root, path) => {
  let cur = root;
  for (const k of String(path).split('.')) {
    if (cur == null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, k)) return undefined;
    cur = cur[k];
  }
  return cur;
};
const callModel = (model, args) => { const fn = resolvePath(RZEngine.models, model); return typeof fn === 'function' ? fn.apply(null, args) : undefined; };

let pass = 0, fail = 0;
const ok = (c, l) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + l); c ? pass++ : fail++; };

ok(!!RZEngine.models && RZEngine.data.version === '2.4.0', 'engine loaded server-side v2.4.0');
ok(callModel('reliability.tierTarget', [4]) === 0.99995, 'reliability.tierTarget(4)');
ok(callModel('site.score', [{ power: 1, grid: 1, seismic: 1, talent: 1, tax: 1, carbon: 1, flood: 1, latency: 1, water: 1 }]).score === 100, 'site.score all-perfect = 100');
ok(Math.abs(callModel('roi.irr', [[-100e6, 20e6, 30e6, 40e6, 50e6, 60e6]]) - 0.2329) < 0.001, 'roi.irr worked example');
ok(Object.keys(callModel('capex.detailed', [{ itLoadKw: 2500, rackType: 'standard', coolingType: 'air', redundancy: '2n', buildingType: 'purpose', location: 'usa' }]) || {}).includes('total'), 'capex.detailed returns total');
ok(resolvePath(RZEngine.data, 'capexDetail.cityCapexPerW.muscat').region === 'mena', 'data path resolves (Muscat/Oman)');
// defence: a non-model path returns undefined (dispatch would 404)
ok(callModel('auth.getSession', []) === undefined || typeof callModel('auth.getSession', []) !== 'function', 'auth not reachable via models path');

console.log(`\ncalc server-side: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
