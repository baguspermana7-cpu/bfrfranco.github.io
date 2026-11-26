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
 *   C13-DC the CDU TCS supply and fan-wall supply-air setpoints are adjustable; what-if = DCAI_CALC.compute of a copy
 *   C12-DC the twin's forClass('dcai:<cls>') = the DC AI rows with a value for that class (PV = point id)
 *   C14 only js/rz-sp-block.js writes the Setpoints & limits markup (one implementation, §C4)
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
    /* P9 a page control number is the registry's own value (the page reads it back; law T2): a number, or one per variant */
    if (r.page) { const v = r.sp.byVariant ? Object.values(r.sp.byVariant) : [r.sp.value]; ok(v.length > 0 && v.every((x) => typeof x === 'number' && isFinite(x)), `C4 ${r.id} page control number ${JSON.stringify(r.sp.value)}`); }
    else if (r.cockpit === 'conv') { const p = PARAM[r.sp.param]; ok(!!p, `C4 ${r.id} sp.param ${r.sp.param} is not an engine parameter`); live = p ? p.value : null; }
    else live = PTS.setpoint(r.source.point, snap);
    if (!r.page) ok(typeof r.sp.value === 'number' && typeof live === 'number' && Math.abs(r.sp.value - live) < 1e-9, `C4 ${r.id} sp ${r.sp.value} but the engine says ${live}`);
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
/* P9 a page control number names its point by the limits-registry id (the page draws it from its own state), or says
   why it has none (pvNote) */
const LIMIT_IDS = new Set(rows.filter((x) => x.cockpit === 'conv' && x.limits && !x.page).map((x) => x.id.slice(5)));
for (const r of rows.filter((x) => x.page && x.sp)) {
  if (r.sp.pv) r.sp.pv.forEach((p) => ok(LIMIT_IDS.has(p), `C10 ${r.id} pv ${p} is not a point of the limits registry`));
  else ok(!!r.pvNote && r.pvNote.length >= 20, `C10 ${r.id} names no point and says not why (pvNote)`);
}
for (const r of rows.filter((x) => x.cockpit === 'conv' && x.sp && !x.page)) {
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

/* C13-DC (PRD-SETPOINT-SIM §C P6): the DC AI setpoints an operator can move (TCS supply at the CDU, supply air at the fan
   wall) are adjustable with a written basis, and every listed what-if output moves across the range in a direct
   DCAI_CALC.compute of a copy of the model (the live model is never touched) */
{
  const D = require(path.join(ROOT, 'js/dcai-engine.js'));
  const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  const before = JSON.stringify(D.model);
  const at = (param, v) => { const m = JSON.parse(JSON.stringify(D.model)), k = param.split('.'); k.slice(0, -1).reduce((x, y) => x[y], m)[k[k.length - 1]] = v; return D.compute(m); };
  for (const id of ['dcai.cdu/tcs_supply_c', 'dcai.crah/air_supply_c']) {
    const r = rows.find((x) => x.id === id), sp = r && r.sp, a = sp && sp.adjustable;
    ok(!!a && !!sp.param && Array.isArray(sp.whatIf) && sp.whatIf.length >= 3, `C13-DC ${id} is not adjustable with a param and >= 3 what-if outputs`);
    if (!a || !sp.param || !sp.whatIf) continue;
    ok(get(D.model, sp.param) === sp.value, `C13-DC ${id} param ${sp.param} = ${get(D.model, sp.param)} in the model, registry SP ${sp.value}`);
    ok(/dynamics[^.]*not modelled/i.test(sp.whatIfNote || ''), `C13-DC ${id} what-if note does not say the dynamics are not modelled`);
    const lo = at(sp.param, a.min), hi = at(sp.param, a.max), s0 = D.snapshot;
    for (const w of sp.whatIf) {
      /* a path the engine leaves null at the design point (the liquid-path COP while free cooling) is listed only with
         the words the block prints for it (nullText) */
      ok(!!w.label && typeof w.unit === 'string' && (typeof get(s0, w.path) === 'number' || (get(s0, w.path) === null && !!w.nullText)), `C13-DC ${id} what-if ${w.path}: label, unit and a number in the snapshot (or null with nullText)`);
      if (w.ceiling) ok(w.ceilingValue === get(D.model, w.ceiling) && /ceiling/.test(w.ceilingNote || ''), `C13-DC ${id} what-if ${w.path}: ceiling ${w.ceilingValue} ≠ model ${w.ceiling} ${get(D.model, w.ceiling)}`);
      ok(get(lo, w.path) !== get(hi, w.path), `C13-DC ${id} what-if ${w.path} does not move between ${a.min} and ${a.max}`);
    }
  }
  ok(JSON.stringify(D.model) === before, 'C13-DC a what-if recompute changed the live DC AI model');
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
      for (const r of rows.filter((x) => x.cockpit === 'conv' && x.sp && x.sp.pv && !x.page)) for (const p of r.sp.pv) {
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
      for (const r of rows.filter((x) => x.cockpit === 'conv' && x.sp && !x.page)) {
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
/* C12-DC the twin gives the DC AI inspector (P5) every DC AI row with a value for a class under 'dcai:<cls>', setpoints
   and references alike, with the point id as its PV and heldBy on a reference */
try {
  const sb = { window: {} }; sb.window.window = sb.window;
  new Function('window', fs.readFileSync(path.join(ROOT, 'js/rz-control-points.js'), 'utf8'))(sb.window);
  const C = sb.window.RZControlPoints, want = {};
  rows.filter((x) => x.cockpit === 'dcai' && x.sp).forEach((x) => (want[x.equipment] = want[x.equipment] || []).push(x));
  for (const cls of Object.keys(want)) {
    const got = C.forClass('dcai:' + cls);
    ok(got.map((g) => g.id).sort().join(',') === want[cls].map((x) => x.id).sort().join(','), `C12-DC forClass(dcai:${cls}) = [${got.map((g) => g.id)}]`);
    for (const g of got) { const x = want[cls].find((y) => y.id === g.id);
      ok(!!x && g.value === x.sp.value && g.role === x.sp.role && g.pv[0] === x.id.slice(5) && (x.sp.role !== 'reference' || g.heldBy === x.sp.heldBy) && g.adjustable === (x.sp.adjustable ? g.adjustable : null), `C12-DC ${g.id} twin ${JSON.stringify({ v: g.value, role: g.role, pv: g.pv, heldBy: g.heldBy })}`); }
  }
} catch (e) { ok(false, 'C12-DC twin does not load: ' + e.message); }
/* C15 (P9) the twin's value(id[, variant]) answers every page control number with the registry's number (each variant
   of a per-variant setpoint) and throws on an id or variant the registry does not hold: a page never runs on a default */
{
  const sb = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'js/rz-control-points.js'), 'utf8'))(sb);
  const C = sb.RZControlPoints, page = rows.filter((x) => x.page && x.threshold);
  ok(page.length >= 10 && C && typeof C.value === 'function', `C15 ${page.length} page control numbers, twin value() ${C && typeof C.value}`);
  const throws = (f) => { try { f(); return false; } catch (e) { return true; } };
  for (const r of page) {
    const t = r.threshold;
    if (t.byVariant) { for (const [k, v] of Object.entries(t.byVariant)) ok(C.value(r.id, k) === v, `C15 value(${r.id}, ${k}) = ${C.value(r.id, k)}, registry ${v}`); ok(throws(() => C.value(r.id)) && throws(() => C.value(r.id, 'nope')), `C15 ${r.id}: a missing variant does not throw`); }
    else ok(C.value(r.id) === t.value && (r.sp ? r.sp.value : r.limits[Object.keys(r.limits).find((k) => ['lo_alarm', 'lo_warn', 'hi_warn', 'hi_alarm'].includes(k))]) === t.value, `C15 value(${r.id}) = ${C.value(r.id)}, registry ${t.value}`);
  }
  ok(throws(() => C.value('conv.fire-system.no_such_number')), 'C15 an unknown id does not throw');
}

/* C16 (P9) the fire pressure switches keep NFPA 20 (2022) A.14.2.6 spacing: jockey stop >= 0.69 bar (10 psi) above its
   start; main pump 1 starts >= 0.34 bar (5 psi) below the jockey start; pump 2 >= 0.69 bar below pump 1; the low-pressure
   alarm sits below the last pump start. The fuel day tank: low-low < level kept < fill start < fill stop <= 100 %. */
{
  const v = (id) => { const r = rows.find((x) => x.id === id); return r ? r.threshold.value : NaN; };
  const jOn = v('conv.fire-system.jockey_on'), jOff = v('conv.fire-system.jockey_off'), p1 = v('conv.fire-system.fp1_on'), p2 = v('conv.fire-system.fp2_on'), lo = v('conv.fire-system.header_low_alarm');
  const PSI = 0.0689476;
  ok(jOff - jOn >= 10 * PSI - 1e-9, `C16 jockey stop ${jOff} − start ${jOn} = ${(jOff - jOn).toFixed(2)} bar < 0.69 bar (10 psi)`);
  ok(jOn - p1 >= 5 * PSI - 1e-9, `C16 jockey start ${jOn} − pump 1 start ${p1} = ${(jOn - p1).toFixed(2)} bar < 0.34 bar (5 psi)`);
  ok(p1 - p2 >= 10 * PSI - 1e-9, `C16 pump 1 start ${p1} − pump 2 start ${p2} = ${(p1 - p2).toFixed(2)} bar < 0.69 bar (10 psi)`);
  ok(lo < p2, `C16 low-pressure alarm ${lo} is not below the last pump start ${p2}`);
  const ll = v('conv.fuel-system.day_tank_lowlow'), mn = v('conv.fuel-system.day_tank_min_pct'), fs0 = v('conv.fuel-system.day_tank_fill_start'), fs1 = v('conv.fuel-system.day_tank_fill_stop');
  ok(ll < mn && mn < fs0 && fs0 < fs1 && fs1 <= 100, `C16 day tank order low-low ${ll} < kept ${mn} < fill start ${fs0} < fill stop ${fs1} <= 100`);
  /* the day-tank point band agrees with the page's own numbers: low-low = the band's alarm, the level kept = its warning */
  const L = rows.find((x) => x.id === 'conv.fuel-system.DT.level_pct');
  const F = rows.find((x) => x.id === 'conv.fire.static_pressure_bar');
  ok(!!F && F.limits.lo_alarm === lo && F.limits.lo_warn === p1, `C16 fire.static_pressure_bar band lo_warn ${F && F.limits.lo_warn} / lo_alarm ${F && F.limits.lo_alarm} ≠ pump 1 start ${p1} / low alarm ${lo}`);
  ok(!!L && L.limits.lo_alarm === ll && L.limits.lo_warn === mn, `C16 fuel-system.DT.level_pct band lo_warn ${L && L.limits.lo_warn} / lo_alarm ${L && L.limits.lo_alarm} ≠ page level kept ${mn} / low-low ${ll}`);
}

/* C14 one implementation (PRD-SETPOINT-SIM §C1/§C4): only js/rz-sp-block.js writes the Setpoints & limits markup; a
   host (conv modal, DC AI inspector) frames and binds it, never re-renders it */
{
  const writers = [];
  const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).forEach((d) => {
    const rel = dir + '/' + d.name;
    if (d.isDirectory()) { if (d.name !== 'vendor') walk(rel); return; }
    if (/\.js$/.test(d.name) && !/\.min\.js$/.test(d.name) && /data-sp-row="|data-rz-cvm-whatif="/.test(fs.readFileSync(path.join(ROOT, rel), 'utf8'))) writers.push(rel);
  });
  walk('js');
  ok(writers.length === 1 && writers[0] === 'js/rz-sp-block.js', `C14 Setpoints & limits markup written by [${writers.join(', ')}], want only js/rz-sp-block.js`);
}
done();
