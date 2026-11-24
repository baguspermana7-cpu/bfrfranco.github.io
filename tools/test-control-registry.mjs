#!/usr/bin/env node
/**
 * test-control-registry.mjs — PRD-SETPOINT-SIM B3 (node core of S1/S2, phase P0).
 *
 * data/control-points.json is the ONE control registry of both cockpits (setpoints + limits), built by
 * tools/build-control-registry.mjs from the conv limits registry, the DC AI point records and the curated setpoints.
 *   C1 schema: every row has id, cockpit, equipment, label, unit and exactly one of sp / limits / monitoredOnly(reason)
 *      or both sp and limits
 *   C2 coverage: every conv limits row and every DC AI point record is a row (counts printed)
 *   C3 every sp names its source (ref) and evidence class; an assumed value says ASSUMED
 *   C4 every sp equals the engine now (conv: data/conv-parameters.json value of sp.param; DC AI: RZDatahallAIPoints
 *      .setpoint on the engine snapshot) within 1e-9
 *   C5 adjustable: min < max, step > 0, min <= value <= max, and a written basis; none without one
 *   C6 a conv sp never comes from a limits row's `nominal` (a nominal is the middle of a band, not a setpoint)
 *   C7 freshness: the file equals what the builder writes now
 *   C9 one controller per DC AI plane: setpoint on exactly the holding class, every other reader a reference naming it
 *   C8 sp.role is 'setpoint' (a controller holds it: conv rows name it) or 'reference' (nameplate, nominal, design value)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const done = () => { if (fails.length) { console.log(`FAIL — ${fails.length} of ${checks} checks`); fails.slice(0, 30).forEach((f) => console.log('  ✗ ' + f)); process.exit(1); } console.log(`PASS control registry — ${checks} checks`); process.exit(0); };

const FILE = path.join(ROOT, 'data/control-points.json');
if (!fs.existsSync(FILE)) { ok(false, 'C0 data/control-points.json does not exist'); done(); }
const REG = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const rows = REG.rows || [];
const conv = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/conv-parameters.json'), 'utf8'));
const PARAM = Object.fromEntries(conv.parameters.map((p) => [p.id, p]));
const PTS = require(path.join(ROOT, 'js/datahall-ai/points.js'));
const E = require(path.join(ROOT, 'js/dcai-engine.js'));
const snap = typeof E.snapshot === 'function' ? E.snapshot() : E.snapshot;
const EVID = new Set(['MEASURED', 'STANDARD', 'ADOPTED', 'DESIGN', 'ASSUMED', 'DERIVED']);
const byId = new Map(rows.map((r) => [r.id, r]));
ok(byId.size === rows.length, `C1 ${rows.length - byId.size} duplicate ids`);

for (const r of rows) {
  const lack = ['id', 'cockpit', 'equipment', 'label'].filter((k) => !r[k]);
  ok(!lack.length, `C1 ${r.id || '?'} lacks ${lack.join(', ')}`);
  ok(r.cockpit === 'conv' || r.cockpit === 'dcai', `C1 ${r.id} cockpit ${r.cockpit}`);
  ok(!!(r.sp || r.limits || (r.monitoredOnly && r.monitoredOnly.reason)), `C1 ${r.id} has no setpoint, no limits and no monitored-only reason`);
  if (r.sp) {
    ok(!!(r.sp.source && r.sp.source.ref) && EVID.has(r.sp.evidenceClass), `C3 ${r.id} setpoint without source or evidence class (${r.sp.evidenceClass})`);
    let live = null;
    if (r.cockpit === 'conv') { const p = PARAM[r.sp.param]; ok(!!p, `C4 ${r.id} sp.param ${r.sp.param} is not an engine parameter`); live = p ? p.value : null; }
    else live = PTS.setpoint(r.source.point, snap);
    ok(typeof r.sp.value === 'number' && typeof live === 'number' && Math.abs(r.sp.value - live) < 1e-9, `C4 ${r.id} sp ${r.sp.value} but the engine says ${live}`);
    ok(r.sp.role === 'setpoint' || r.sp.role === 'reference', `C8 ${r.id} sp.role ${r.sp.role}`);
    if (r.sp.role === 'setpoint') ok(!!r.sp.control, `C8 ${r.id} is called a setpoint but names no controller that holds it`);
    if (r.cockpit === 'dcai' && r.sp.from.startsWith('plane ')) {   /* one controller per plane: a plane is a setpoint on one class only */
      const holders = rows.filter((x) => x.sp && x.sp.from === r.sp.from && x.sp.role === 'setpoint').map((x) => x.equipment);
      ok(new Set(holders).size <= 1, `C9 ${r.sp.from} is a setpoint on ${[...new Set(holders)].join(' and ')}`);
      if (r.sp.role === 'reference' && holders.length) ok(r.sp.heldBy === holders[0], `C9 ${r.id} reads ${r.sp.from} held by ${holders[0]} but says heldBy ${r.sp.heldBy}`);
    }
    if (r.sp.evidenceClass === 'ASSUMED') ok(!!(r.sp.source.why || r.sp.source.method), `C3 ${r.id} ASSUMED setpoint says nothing about why`);
    const a = r.sp.adjustable;
    if (a) ok(a.min < a.max && a.step > 0 && a.min <= r.sp.value && r.sp.value <= a.max && !!a.basis, `C5 ${r.id} adjustable ${JSON.stringify(a)} around ${r.sp.value}`);
    if (a) { const n = (r.sp.value - a.min) / a.step, m = (a.max - a.min) / a.step;   /* a range slider snaps to min + k·step: the SP and max must be on that grid */
      ok(Math.abs(n - Math.round(n)) < 1e-6 && Math.abs(m - Math.round(m)) < 1e-6, `C5 ${r.id} SP ${r.sp.value} or max ${a.max} is not on the step grid ${a.min} + k·${a.step} (a slider would snap it)`); }
    if (r.cockpit === 'conv') ok(!/nominal/i.test(String(r.sp.from || '')), `C6 ${r.id} setpoint taken from a band nominal`);
  }
}
const convLimits = conv.limits.map((l) => l.id), dcaiRecs = PTS.records().map((x) => 'dcai.' + x.cls + '/' + x.point);
const missC = convLimits.filter((id) => !byId.has('conv.' + id)), missD = dcaiRecs.filter((id) => !byId.has(id));
ok(!missC.length, `C2 ${missC.length} of ${convLimits.length} conv limits rows missing: ${missC.slice(0, 5).join(', ')}`);
ok(!missD.length, `C2 ${missD.length} of ${dcaiRecs.length} DC AI point records missing: ${missD.slice(0, 5).join(', ')}`);
const nSp = rows.filter((r) => r.sp).length, nMon = rows.filter((r) => r.monitoredOnly).length;
console.log(`control registry: ${rows.length} rows — ${rows.filter((r) => r.sp && r.sp.role === 'setpoint').length} setpoints, ${nSp - rows.filter((r) => r.sp && r.sp.role === 'setpoint').length} reference values, ${rows.filter((r) => r.limits).length} with limits, ${nMon} monitored only (conv limits ${convLimits.length}, DC AI records ${dcaiRecs.length})`);

/* C10 every conv setpoint names the live point(s) it governs (pv), and each pv is a point a page really binds */
const bound = new Set();
const scan = (dir, re) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => re.test(f)).forEach((f) => {
  const t = fs.readFileSync(path.join(ROOT, dir, f), 'utf8');
  for (const m of t.matchAll(/data-point="([^"]+)"|\bpoint:\s*'([^']+)'/g)) bound.add(m[1] || m[2]);
});
scan('.', /\.html$/); scan('js/conv', /\.js$/);
for (const r of rows.filter((x) => x.cockpit === 'conv' && x.sp)) {
  ok(Array.isArray(r.sp.pv) && r.sp.pv.length > 0, `C10 ${r.id} names no live point (sp.pv)`);
  (r.sp.pv || []).forEach((p) => ok(bound.has(p), `C10 ${r.id} pv ${p} is bound on no page`));
}

/* C13 what-if (P2): only an adjustable setpoint lists what-if outputs; each output is a number in the engine snapshot;
   one step of the setpoint (direct recompute) moves at least one of them; the note says dynamics are not modelled */
{
  const { CONV_MODEL: M, CONV_CALC: CC } = require(path.join(ROOT, 'js/conv-engine.js'));
  const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  const s0 = CC.recompute(JSON.parse(JSON.stringify(M)));
  for (const r of rows.filter((x) => x.cockpit === 'conv' && x.sp && x.sp.whatIf)) {
    const a = r.sp.adjustable;
    ok(!!a, `C13 ${r.id} lists what-if outputs but is not adjustable`);
    ok(/dynamics[^.]*not modelled/i.test(r.sp.whatIfNote || ''), `C13 ${r.id} what-if note does not say the dynamics are not modelled`);
    const m1 = JSON.parse(JSON.stringify(M)), k = r.sp.param.split('.');
    k.slice(0, -1).reduce((x, y) => x[y], m1)[k[k.length - 1]] = Math.min(a ? a.max : r.sp.value, r.sp.value + (a ? a.step : 0));
    const s1 = CC.recompute(m1);
    let moved = 0;
    for (const w of r.sp.whatIf) {
      ok(!!w.label && typeof w.unit === 'string', `C13 ${r.id} what-if ${w.path} lacks label or unit`);
      ok(typeof get(s0, w.path) === 'number', `C13 ${r.id} what-if ${w.path} is not a number in the engine snapshot`);
      if (get(s1, w.path) !== get(s0, w.path)) moved++;
    }
    ok(moved > 0, `C13 ${r.id} one step of ${r.sp.param} moves none of its what-if outputs`);
    /* every listed output follows the setpoint across its adjustable range (min vs max): an output the engine does
       not move is said in the note, never listed (RZ_CR_PLANT=still lists PUE, a model input) */
    if (a) {
      const at = (v) => { const m = JSON.parse(JSON.stringify(M)); k.slice(0, -1).reduce((x, y) => x[y], m)[k[k.length - 1]] = v; return CC.recompute(m); };
      const lo = at(a.min), hi = at(a.max);
      const outs = r.sp.whatIf.concat(process.env.RZ_CR_PLANT === 'still' ? [{ path: 'site.pue' }] : []);
      for (const w of outs) ok(get(lo, w.path) !== get(hi, w.path), `C13 ${r.id} what-if ${w.path} does not move between ${a.min} and ${a.max} (${get(lo, w.path)})`);
    }
  }
}

/* C11 the browser twin js/rz-control-points.js is generated, fresh, and answers spOf / tipFor from the registry */
const TWIN = path.join(ROOT, 'js/rz-control-points.js');
try {
  const { build, twin } = await import(path.join(ROOT, 'tools/build-control-registry.mjs'));
  ok(JSON.stringify(build(), null, 2) + '\n' === fs.readFileSync(FILE, 'utf8'), 'C7 data/control-points.json is stale: run node tools/build-control-registry.mjs --apply');
  ok(typeof twin === 'function', 'C11 builder exports no twin()');
  ok(fs.existsSync(TWIN), 'C11 js/rz-control-points.js does not exist');
  if (typeof twin === 'function' && fs.existsSync(TWIN)) {
    ok(twin(REG) === fs.readFileSync(TWIN, 'utf8'), 'C11 js/rz-control-points.js is stale: run node tools/build-control-registry.mjs --apply');
    const sb = {}; new Function('window', fs.readFileSync(TWIN, 'utf8'))(sb);
    const C = sb.RZControlPoints;
    ok(!!(C && C.spOf && C.tipFor), 'C11 window.RZControlPoints lacks spOf / tipFor');
    if (C && C.spOf) {
      for (const r of rows.filter((x) => x.cockpit === 'conv' && x.sp && x.sp.pv)) for (const p of r.sp.pv) {
        const s = C.spOf(p);
        ok(!!s && s.value === r.sp.value, `C11 spOf(${p}) = ${JSON.stringify(s)}, registry ${r.sp.value}`);
        ok(!!s && /^SP -?\d/.test(s.label), `C11 spOf(${p}).label "${s && s.label}"`);
        const t = C.tipFor(p, r.unit);
        ok(typeof t === 'string' && t.indexOf(s && s.label) === 0 && t.indexOf(r.sp.evidenceClass) > 0, `C11 tipFor(${p}) "${t}" lacks the SP or its evidence class`);
      }
      ok(C.spOf('no.such.point') === null && C.tipFor('no.such.point') === null, 'C11 an unknown point must give null');
      /* C12 each conv setpoint names the equipment-modal class that shows it, a class js/conv/internals/ registers, and
         forClass() lists exactly the registry rows of that class */
      const CLASSES = new Set();
      fs.readdirSync(path.join(ROOT, 'js/conv/internals')).forEach((f) => {
        const t = fs.readFileSync(path.join(ROOT, 'js/conv/internals', f), 'utf8');
        for (const m of t.matchAll(/register\('([a-z_]+)'/g)) CLASSES.add(m[1]);
        const k = /var KINDS = \{([\s\S]*?)\n {2}\};/.exec(t); if (k) for (const m of k[1].matchAll(/^\s{4}([a-z_]+):/gm)) CLASSES.add(m[1]);
      });
      const want = {};
      for (const r of rows.filter((x) => x.cockpit === 'conv' && x.sp)) {
        ok(!!r.sp.classKey && CLASSES.has(r.sp.classKey), `C12 ${r.id} classKey ${r.sp.classKey} is not an equipment-modal class (${[...CLASSES].join(', ')})`);
        (want[r.sp.classKey] = want[r.sp.classKey] || []).push(r.id);
      }
      for (const k of Object.keys(want)) {
        const got = C.forClass ? C.forClass(k).map((x) => x.id).sort().join(',') : '';
        ok(got === want[k].sort().join(','), `C12 forClass(${k}) = [${got}], registry [${want[k].join(',')}]`);
      }
    }
  }
} catch (e) { ok(false, 'C7/C11 builder does not load: ' + e.message); }
done();
