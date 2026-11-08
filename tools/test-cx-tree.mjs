#!/usr/bin/env node
/**
 * test-cx-tree.mjs — laws of the five-deep commissioning tree (js/rz-cx-tree.js, owner K28 2026-11-08).
 *   node tools/test-cx-tree.mjs [path/to/rz-cx-tree.js]
 * T1 identity: every level node = programPlan().levels[i] (cost, man-hours, start, finish), 8 scenarios + edits
 * T2 every parent's cost and man-hours = the sum of its children EXACTLY; labour days to the hundredth
 * T3 a parent's window = earliest child start .. latest child finish; activities stay inside their level window
 * T4 depth: level > system > subsystem > equipment > activity, every leaf an activity at depth 4
 * T5 share rules: L2-L4 systems by handbook days, L1 only factory-tested equipment by unit count, L6 by assets
 * T6 site: CDUs and manifolds only for liquid cooling; quantities follow IT load
 * T7 node edits: weight re-shares siblings with the parent fixed; exclude drops a node; junk edits are ignored
 * T8 level-only edit (programPlan overrides) moves every descendant and the identity still holds
 * T9 timing: mechanical start-up waits for electrical start-up (dependency chain)
 * T10 no engine -> null; every equipment row names its source
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const MOD = process.argv[2] ? resolve(process.argv[2]) : resolve(here, '..', 'js', 'rz-cx-tree.js');
const ENGINE = resolve(here, '..', 'rz-engine.js');
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.log('  ✘', n, d === undefined ? '' : `— ${d}`); } };

global.window = {};
const T0 = require(MOD);
ok('T10 no engine → null', T0.programTree({ itLoad: 1000 }) === null);
delete require.cache[MOD];
require(ENGINE);
const C = global.window.RZEngine.models.commissioning;
const T = require(MOD);

const walk = (nodes, fn, depth = 0, parent = null) => { for (const n of nodes) { fn(n, depth, parent); walk(n.children || [], fn, depth + 1, n); } };
const scen = C._rich().scenarios;
const cases = Object.keys(scen).map((k) => ({ name: k, input: scen[k], ov: {} }));
cases.push({ name: 'colo edited', input: scen.colo_10mw, ov: { plan: { L3: { crew: 8, months: 4 }, L5: { shift: '2x12' } } } });

for (const cs of cases) {
  const t = T.programTree(cs.input, cs.ov), p = C.programPlan(cs.input, cs.ov.plan || {});
  ok(`T1 ${cs.name}: 7 levels`, t && t.levels.length === 7);
  t.levels.forEach((L, i) => {
    const P = p.levels[i];
    ok(`T1 ${cs.name} ${L.id} identity`, L.cost === P.cost && L.manHours === P.manHours && L.start === +P.start.toFixed(2) && L.finish === +P.end.toFixed(2),
      `${L.cost}/${P.cost} ${L.manHours}/${P.manHours} ${L.start}-${L.finish} vs ${P.start}-${P.end}`);
  });
  let sums = 0, sumBad = [], winBad = [], depthBad = [], leafBad = [];
  walk(t.levels, (n, d) => {
    const k = n.children || [];
    if (k.length) {
      const c = k.reduce((s, x) => s + x.cost, 0), h = k.reduce((s, x) => s + x.manHours, 0), ld = k.reduce((s, x) => s + Math.round(x.laborDays * 100), 0);
      sums++;
      if (c !== n.cost || h !== n.manHours || ld !== Math.round(n.laborDays * 100)) sumBad.push(`${n.path} ${c}/${n.cost} ${h}/${n.manHours}`);
      const s = Math.min(...k.map((x) => x.start)), f = Math.max(...k.map((x) => x.finish));
      if (Math.abs(s - n.start) > 0.011 || Math.abs(f - n.finish) > 0.011) winBad.push(`${n.path} ${n.start}-${n.finish} vs ${s}-${f}`);
    } else if (!(n.kind === 'activity' && d === 4)) leafBad.push(`${n.path} ${n.kind}@${d}`);
    const want = ['level', 'system', 'subsystem', 'equipment', 'activity'][d];
    if (n.kind !== want) depthBad.push(`${n.path} ${n.kind}@${d}`);
  });
  ok(`T2 ${cs.name}: every parent = Σ children (${sums} parents)`, sumBad.length === 0, sumBad.slice(0, 3).join(' | '));
  ok(`T3 ${cs.name}: parent window = children's span`, winBad.length === 0, winBad.slice(0, 3).join(' | '));
  ok(`T4 ${cs.name}: five deep, leaves are activities`, depthBad.length === 0 && leafBad.length === 0, depthBad.concat(leafBad).slice(0, 3).join(' | '));
  const outside = [];
  t.levels.forEach((L) => walk(L.children, (n) => { if (n.start < L.start - 0.011 || n.finish > L.finish + 0.011) outside.push(n.path); }));
  ok(`T3 ${cs.name}: nothing outside its level window`, outside.length === 0, outside.slice(0, 3).join(' | '));
}

// T5 share rules on the 10 MW colo
const colo = T.programTree(scen.colo_10mw);
const sys = (lid, id) => colo.levels.find((l) => l.id === lid).children.find((s) => s.id === id);
const L2 = colo.levels[2], days = {}; T.SYSTEMS.forEach((s) => { days[s.id] = s.days; });
const r = sys('L2', 'hv_intake').cost / sys('L2', 'ups').cost, want = days.hv_intake.l2 / days.ups.l2;
ok('T5 L2 systems share by handbook days (hv_intake : ups = 10 : 2)', Math.abs(r - want) / want < 0.002, `${r.toFixed(3)} vs ${want}`);
let nonFat = [];
walk(colo.levels[1].children, (n) => { if (n.kind === 'equipment' && !/transformer|bay|switchboard|Generator set|UPS module|Chiller|CDU|Cooling unit|Fire pump/.test(n.label)) nonFat.push(n.label); });
ok('T5 L1 holds only factory-tested equipment', nonFat.length === 0, nonFat.join(','));
const L6 = colo.levels[6], assets = (s) => { let q = 0; walk([s], (n) => { if (n.kind === 'equipment') q += n.qty; }); return q; };
const a1 = L6.children.find((s) => s.id === 'racks'), a2 = L6.children.find((s) => s.id === 'chillers');
ok('T5 L6 systems share by assets handed over', Math.abs(a1.cost / a2.cost - assets(a1) / assets(a2)) / (assets(a1) / assets(a2)) < 0.01, `${(a1.cost / a2.cost).toFixed(2)} vs ${(assets(a1) / assets(a2)).toFixed(2)}`);
ok('T5 L2 shares sum to 1', Math.abs(L2.children.reduce((s, x) => s + x.share, 0) - 1) < 0.001);

// T6 site
const air = T.programTree(scen.enterprise_2mw), dlc = T.programTree(scen.hyperscale_50mw);
const has = (t, path) => !!T.find(t, path);
ok('T6 air site: no CDU system, no manifolds', !has(air, 'L3/cdu') && !has(air, 'L3/racks/manifolds'));
ok('T6 liquid site: CDUs and manifolds present, no CRAH terminals', has(dlc, 'L3/cdu') && has(dlc, 'L3/racks/manifolds') && !has(dlc, 'L3/crah/terminals'));
ok('T6 quantities follow IT load (racks 50 MW > 2 MW)', T.find(dlc, 'L2/racks/racks/rack').qty > T.find(air, 'L2/racks/racks/rack').qty);
ok('T6 BMS points follow bmsComplexity (ai_driven 2000)', T.find(dlc, 'L3/bms/points/bms_point').qty === 2000);

// T7 node edits
const base = T.programTree(scen.colo_10mw);
const ed = T.programTree(scen.colo_10mw, { nodes: { 'L3/chillers': { weight: 2 }, 'L3/fire': { exclude: true }, 'L9/x': { weight: 3 }, 'L3/bms': { weight: -1 }, 'L3/ups': { weight: NaN } } });
const bL3 = base.levels[3], eL3 = ed.levels[3];
ok('T7 parent total holds under node edits', eL3.cost === bL3.cost && eL3.manHours === bL3.manHours);
ok('T7 weight 2 raises the node', T.find(ed, 'L3/chillers').cost > T.find(base, 'L3/chillers').cost);
ok('T7 exclude drops the node and its siblings absorb it', !T.find(ed, 'L3/fire') && T.find(ed, 'L3/bms').cost > T.find(base, 'L3/bms').cost * 0.99);
ok('T7 junk edits ignored (bad path, negative, NaN)', T.find(ed, 'L3/ups').share > 0);
const share2 = T.find(ed, 'L3/chillers').share / T.find(ed, 'L3/hv_intake').share, share1 = T.find(base, 'L3/chillers').share / T.find(base, 'L3/hv_intake').share;
ok('T7 weight 2 doubles the ratio to an unedited sibling', Math.abs(share2 / share1 - 2) < 0.01, (share2 / share1).toFixed(3));

// T8 level-only edit
const lv = T.programTree(scen.colo_10mw, { plan: { L3: { crew: 8 } } });
ok('T8 level edit moves the level (crew 4 → 8 doubles man-hours)', lv.levels[3].manHours === base.levels[3].manHours * 2, `${lv.levels[3].manHours} vs ${base.levels[3].manHours}`);
ok('T8 descendants follow the level', Math.abs(T.find(lv, 'L3/chillers').manHours - 2 * T.find(base, 'L3/chillers').manHours) <= 1);

// T9 timing
const elec = T.find(base, 'L3/ups/modules/ups_module/a0'), mech = T.find(base, 'L3/chillers/chillers/chiller/a1');
ok('T9 mechanical start-up starts when electrical start-up ends', elec && mech && Math.abs(mech.start - elec.finish) < 0.011, `${elec && elec.finish} → ${mech && mech.start}`);
ok('T9 controls point-to-point is not on mechanical systems', !T.find(base, 'L3/chillers/chillers/chiller/a2'));

// T10 sources
let noSrc = []; walk(base.levels, (n) => { if (n.kind === 'equipment' && !n.source) noSrc.push(n.path); });
ok('T10 every equipment row names its source', noSrc.length === 0, noSrc.slice(0, 3).join(','));
ok('T10 sources listed', Object.keys(T.SOURCES).length >= 6 && base.basis.length > 50);

console.log(fail ? `FAIL — ${fail} of ${pass + fail} checks` : `PASS — ${pass} checks: the tree is an exact allocation of programPlan, five deep`);
process.exit(fail ? 1 : 0);
