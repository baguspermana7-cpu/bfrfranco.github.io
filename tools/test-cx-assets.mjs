#!/usr/bin/env node
// test-cx-assets.mjs — laws for js/rz-cx-assets.js (DOM-free; RZ3 vendor bundle loaded in a vm).
// Run: node tools/test-cx-assets.mjs
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url)), R = (p) => resolve(here, '..', p);
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.log('  ✘', n, d === undefined ? '' : `— ${typeof d === 'string' ? d : JSON.stringify(d)}`); } };

// a bare window for the vendor bundle (geometry classes are pure math)
const win = { document: { createElementNS: () => ({ style: {}, getContext: () => null }) }, navigator: { userAgent: 'node' } };
win.window = win; win.self = win; vm.createContext(win);
vm.runInContext(readFileSync(R('js/vendor/three-r170.min.js'), 'utf8'), win);
vm.runInContext(readFileSync(R('js/rz-cx-assets.js'), 'utf8'), win);
const T = win.RZ3, A = win.RZCxAssets;
ok('bundle + module load', !!T && !!A && typeof A.build === 'function');

// the families the campus draws, with the footprints it declares (w, h, d in metres) and instance counts at the default form
const campusSrc = readFileSync(R('js/rz-cx-campus.js'), 'utf8');
const FAM = {};
for (const m of campusSrc.matchAll(/family\('([a-z_]+)',\s*(.+?),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*function/g)) FAM[m[1]] = { w: +m[3], h: +m[4], d: +m[5], countExpr: m[2].trim() };
const COUNT = { racks: 220, cdu: 20, crah: 16, ups: 8, unit_subs: 4, lv_busway: 4, bms: 3, fire: 2, chillers: 12, fws: 8, dry_coolers: 14, generators: 8, hv_intake: 4, main_tx: 2, mv_board: 1 };
ok('campus declares 15 families', Object.keys(FAM).length === 15, Object.keys(FAM));
ok('assets cover every campus family, no extras', A.TYPES.length === 15 && Object.keys(FAM).every((k) => A.TYPES.includes(k)), A.TYPES);
ok('unknown type → null, no throw', A.build(T, 'nope', 1, 1, 1) === null);

const BUDGET = { racks: 120, cdu: 400, bms: 120, ups: 200 }; // the crowded families stay cheap
let sceneTris = 0;
for (const k of Object.keys(FAM)) {
  const { w, h, d } = FAM[k];
  const g = A.build(T, k, w, h, d), g2 = A.build(T, k, w, h, d);
  if (!g) { ok(`${k}: builds`, false); continue; }
  const pos = g.attributes.position, nor = g.attributes.normal, col = g.attributes.color, tri = g.index.count / 3;
  sceneTris += tri * (COUNT[k] || 1);
  ok(`${k}: a shape, not a box (>= 40 triangles)`, tri >= 40, tri);
  ok(`${k}: within its per-type budget`, tri <= (BUDGET[k] || 3000), tri);
  ok(`${k}: vertex colours present, grey factors in (0, 1]`, !!col && col.count === pos.count && Array.from(col.array).every((v) => v > 0 && v <= 1 && Number.isFinite(v)));
  const bb = g.boundingBox;
  ok(`${k}: stands on the floor inside its footprint`, bb.min.y >= -0.01 && bb.max.y <= h * 1.12 + 0.02 && bb.min.x >= -w / 2 * 1.15 - 0.02 && bb.max.x <= w / 2 * 1.15 + 0.02 && bb.min.z >= -d / 2 * 1.15 - 0.02 && bb.max.z <= d / 2 * 1.15 + 0.02,
    { bb: [bb.min.toArray().map((v) => +v.toFixed(2)), bb.max.toArray().map((v) => +v.toFixed(2))], dims: [w, h, d] });
  ok(`${k}: uses most of its height (>= 70 %)`, bb.max.y >= h * 0.7, { top: +bb.max.y.toFixed(2), h });
  let badN = 0; for (let i = 0; i < nor.count; i++) { const l = Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i)); if (!(Math.abs(l - 1) < 1e-3)) badN++; }
  ok(`${k}: unit normals, finite positions`, badN === 0 && Array.from(pos.array).every(Number.isFinite), { badN });
  let maxI = 0; for (let i = 0; i < g.index.count; i++) maxI = Math.max(maxI, g.index.getX(i));
  ok(`${k}: index inside the vertex range`, maxI < pos.count);
  ok(`${k}: deterministic`, g2.index.count === g.index.count && g2.attributes.position.array.every((v, i) => v === pos.array[i]));
  const shades = new Set(Array.from(col.array).filter((_, i) => i % 3 === 0));
  ok(`${k}: at least three shades (body, frame, detail)`, shades.size >= 3, Array.from(shades));
}
ok('whole campus at the default form stays under 120k triangles', sceneTris <= 120000, sceneTris);
// the campus must use the module for every family and fall back to a box without it
ok('campus wires RZCxAssets.build into family()', /RZCxAssets[\s\S]{0,1200}build\(T, systemId, w, h, d\)/.test(campusSrc));
ok('campus falls back to a box when the module is absent', /BoxGeometry\(w, h, d\)/.test(campusSrc) && /vertexColors/.test(campusSrc));
console.log(`CX ASSETS — ${pass} passed, ${fail} failed · scene ≈ ${sceneTris.toLocaleString('en-US')} triangles`);
process.exit(fail ? 1 : 0);
