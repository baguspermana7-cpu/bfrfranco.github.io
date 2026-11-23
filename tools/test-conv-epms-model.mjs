#!/usr/bin/env node
/* test-conv-epms-model.mjs — node --test. The switching simulation behind E-S-101 (js/conv/epms-sim.js on
   js/conv/sld-topology.js and js/conv/tcc.js, PRD-CONV-LIVING-PLANT §8.1-8.2, phase P5a), without a browser:
   M1 the normal state is the brief's: both lines in, coupler closed, both transformers in, bus tie open, feeders closed,
      generator breakers open, earth switches open, gensets off
   M2 the model builder resolves every drawn conductor to a solver branch, every switching device and transformer to a
      branch between its two terminals; nothing is left over
   M3 normal flow from the engine: each feeder = hall facility load / streams, TX loading = the engine's normal figure,
      kW in = kW out at every bus (+-0.5 %), the bus tie carries 0
   M4 interlock truth table (every row a stated reason): disconnector under a closed / open breaker, earth switch with a
      disconnector closed / on a live line / on a dead isolated circuit, 2-out-of-3 tie and incomer, breaker onto an
      earthed circuit, generator incomer with the gensets off, a device already in position
   M5 operate() never changes the state it was given
   M6 N-1: CB-IN1 open kills section A (0 kW); then the tie closes and TX-2 carries 2 x normal = the engine's N-1 figure
   M7 the protection chain comes from the engine keys and coordinates (every margin >= the engine grading margin); each
      device carries the largest current it can see (LV fault, 20 kV fault, 20 kV fault referred to 150 kV)
   M8 the sheet carries no literal colour and the simulation no clock or random source */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
require(path.join(ROOT, 'js/conv-engine.js'));
require(path.join(ROOT, 'js/conv/sld-topology.js'));
require(path.join(ROOT, 'js/conv/tcc.js'));
require(path.join(ROOT, 'js/conv/epms-sheet.js'));
const SIM = require(path.join(ROOT, 'js/conv/epms-sim.js'));
const SHEET = globalThis.RZEpmsSheets.sld;
const SNAP = globalThis.CONV_CALC.snapshot, E = SNAP.electrical;
const B = SIM.basis(SNAP);
const by = Object.fromEntries(SHEET.nodes.map((n) => [n.id, n]));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

test('M1 normal state', () => {
  const s = SIM.normalState(SHEET);
  assert.equal(s.gen, false);
  const want = { 'l1-cb': true, 'l2-cb': true, 'l1-dsl': true, 'l1-ds1': true, 'l1-ds2': false, 'l2-ds1': false, 'l2-ds2': true,
    'cp-cb': true, 'cp-ds1': true, 'cp-ds2': true, 't1-cb': true, 't2-cb': true, 'i1-cb': true, 'i2-cb': true, tie: false,
    'ga-cb': false, 'gb-cb': false, 'gen-cb': false, 'l1-es': false, 'l2-es': false, 'da-cb': true, 'db-cb': true };
  for (const [id, c] of Object.entries(want)) assert.equal(s.closed[id], c, `${id} normal position`);
  for (const n of SHEET.nodes.filter((x) => x.sw === 'cb' && /^f[ab]\d-cb$/.test(x.id))) assert.equal(s.closed[n.id], true, `${n.id} feeder closed`);
});

test('M2 model builder covers the drawing', () => {
  const m = SIM.model(SHEET, SIM.normalState(SHEET), B);
  const ids = new Set(m.branches.map((b) => b.id));
  const conductors = SHEET.edges.filter((e) => e.flowOf === 'p' && !String(e.to).includes('-es.'));
  for (const e of conductors) assert.ok(ids.has(e.id), `conductor ${e.id} has no branch`);
  for (const n of SHEET.nodes.filter((x) => ['cbIec', 'disconnector', 'currentTransformer', 'transformer2w'].includes(x.sym)))
    assert.ok(ids.has('dev:' + n.id), `device ${n.id} has no branch`);
  assert.equal(m.nodes.filter((n) => n.kind === 'source').length, 3, 'two PLN lines + the genset block');
  assert.equal(m.nodes.filter((n) => n.kind === 'load').length, 10, '3 plain feeder rings x 2 sections + per section the typical LVSB and the rest of its ring');
  assert.ok(B, 'basis from the engine');
});

test('M3 normal flow equals the engine', () => {
  const r = SIM.solve(SHEET, SIM.normalState(SHEET), B);
  const halls = SNAP.campus.halls;
  ['a', 'b'].forEach((s) => [1, 2, 3, 4].forEach((h) =>
    near(r.dev[`f${s}${h}-cb`].kw, halls[h - 1].facility_load_kw / E.dist_tx_streams, 1e-6, `feeder ${s}${h}`)));
  near(r.dev.tx1.pct, E.hv_tx_load_pct_normal, 0.05, 'TX-1 normal load %');
  near(r.dev.tx2.pct, E.hv_tx_load_pct_normal, 0.05, 'TX-2 normal load %');
  near(r.dev['i1-cb'].kw + r.dev['i2-cb'].kw, E.epms_total_kw, 1e-6, 'incomers carry the facility');
  assert.equal(r.dev.tie.kw, 0, 'open tie carries nothing');
  near(r.dev['i1-cb'].a, r.dev['i1-cb'].kw / (Math.sqrt(3) * E.mv_voltage_kv * E.power_factor_design), 1e-9, 'A = kW / (sqrt3 kV pf)');
  const bad = [];
  r.model.nodes.filter((n) => n.kind === 'bus').forEach((n) => {
    let into = 0, out = 0;
    r.model.branches.forEach((b) => { const x = r.raw.branches[b.id]; if (!x || !x.kw) return; if (x.to === n.id) into += x.kw; if (x.from === n.id) out += x.kw; });
    if (Math.abs(into - out) > 0.005 * Math.max(into, 1)) bad.push(`${n.id} ${into} in / ${out} out`);
  });
  assert.deepEqual(bad, [], 'kW in = kW out at every bus');
});

test('M4 interlock truth table', () => {
  const n0 = SIM.normalState(SHEET);
  const op = (s, id, c) => SIM.operate(SHEET, s, id, c, B);
  const refused = (r, re) => { assert.equal(r.ok, false); assert.match(r.reason, re); };
  refused(op(n0, 'l1-ds1', false), /DS1-L1 can move only with its breaker CB-L1 open/);
  let s = op(n0, 'l1-cb', false); assert.ok(s.ok, 'a breaker opens freely');
  const ds = op(s.state, 'l1-ds1', false); assert.ok(ds.ok, 'the disconnector moves once its breaker is open: ' + ds.reason);
  /* since E16 (v3.98.0) the trapped key is the governing interlock: K1 sits in DSL-L1 and DS1-L1 while they are closed */
  refused(op(s.state, 'l1-es', true), /K1 trapped in DSL-L1 and DS1-L1: ES-L1 cannot close without its key/);
  let iso = op(s.state, 'l1-dsl', false).state; iso = op(iso, 'l1-ds1', false).state;
  const esl = op(iso, 'l1-es', true);
  assert.ok(esl.ok, 'ES-L1 closes once CB-L1, DSL-L1 and both busbar disconnectors isolate it: ' + esl.reason);
  refused(op(esl.state, 'l1-dsl', true), /K1 trapped in ES-L1: DSL-L1 cannot close without its key/);
  refused(op(esl.state, 'l1-cb', true), /CB-L1 cannot close onto a circuit earthed by ES-L1/);
  refused(op(n0, 'tie', true), /K3 trapped in CB-IN1 and CB-IN2: CB-TIE cannot close without its key \(2-out-of-3/);
  const a = op(n0, 'i1-cb', false).state, t = op(a, 'tie', true);
  assert.ok(t.ok, 'tie closes with one incomer open');
  refused(op(t.state, 'i1-cb', true), /K3 trapped in CB-IN2 and CB-TIE: CB-IN1 cannot close without its key \(2-out-of-3/);
  refused(op(n0, 'ga-cb', true), /25 sync-check window; the gensets are off/);
  refused(op(n0, 'tie', false), /CB-TIE is already open/);
  refused(op(n0, 'l1-j1', true), /is not a switching device/);
  /* the dead-circuit rule on its own: a minimal radial sheet whose load side is isolated */
  const mini = { nodes: [
    { id: 'src', sym: 'utilitySource', src: 'grid', x: 0, y: 0 }, { id: 'cb', sym: 'cbIec', sw: 'cb', es: ['es'], tag: 'CB', x: 0, y: 40 },
    { id: 'ds', sym: 'disconnector', sw: 'ds', cb: 'cb', tag: 'DS', x: 0, y: 80 }, { id: 'j', sym: 'junction', x: 0, y: 120 },
    { id: 'es', sym: 'earthSwitch', sw: 'es', normal: 'open', ds: ['ds'], tag: 'ES', x: 40, y: 120 },
    { id: 'ld', sym: 'offSheet', load: 'feeder', hall: 0, x: 0, y: 160 }],
    edges: [{ id: 'e1', from: 'src.out', to: 'cb.line', flowOf: 'p' }, { id: 'e2', from: 'cb.load', to: 'ds.line', flowOf: 'p' },
      { id: 'e3', from: 'ds.load', to: 'j', flowOf: 'p' }, { id: 'e4', from: 'j', to: 'es.line', flowOf: 'p' }, { id: 'e5', from: 'j', to: 'ld.port', flowOf: 'p' }] };
  let m = SIM.normalState(mini);
  assert.equal(SIM.solve(mini, m, B).dev.ld.kw > 0, true, 'mini sheet carries its load');
  m = SIM.operate(mini, m, 'cb', false, B).state; m = SIM.operate(mini, m, 'ds', false, B).state;
  const es = SIM.operate(mini, m, 'es', true, B); assert.ok(es.ok, 'ES closes on an isolated dead circuit: ' + es.reason);
  refused(SIM.operate(mini, es.state, 'ds', true, B), /DS cannot close while the earthing switch ES is closed/);
  refused(SIM.operate(mini, es.state, 'cb', true, B), /CB cannot close onto a circuit earthed by ES/);
  /* the live-circuit rule on its own: an earth switch whose disconnectors are all open but whose point is still fed */
  const live = { nodes: mini.nodes.map((n) => (n.id === 'es' ? { ...n, ds: [] } : n)), edges: mini.edges };
  refused(SIM.operate(live, SIM.normalState(live), 'es', true, B), /ES can close only on a dead circuit, and the circuit is live/);
});

test('M5 operate() never mutates its input', () => {
  const n0 = SIM.normalState(SHEET), before = JSON.stringify(n0);
  const r = SIM.operate(SHEET, n0, 'i1-cb', false, B);
  assert.ok(r.ok);
  assert.equal(JSON.stringify(n0), before);
  assert.notEqual(r.state, n0);
  assert.equal(r.state.closed['i1-cb'], false);
});

test('M6 section loss and tie transfer', () => {
  const s1 = SIM.operate(SHEET, SIM.normalState(SHEET), 'i1-cb', false, B).state;
  const r1 = SIM.solve(SHEET, s1, B);
  for (const f of ['fa1-cb', 'fa2-cb', 'fa3-cb', 'fa4-cb', 'da-cb']) { assert.equal(r1.dev[f].kw, 0, `${f} dead`); assert.equal(r1.dev[f].energised, false); }
  for (const e of ['ma-2', 'ma-6', 'fa1-c']) assert.equal(r1.edges[e].energised, false, `${e} dead`);
  assert.ok(r1.edges['mb-2'].energised, 'section B stays live');
  const s2 = SIM.operate(SHEET, s1, 'tie', true, B).state, r2 = SIM.solve(SHEET, s2, B);
  near(r2.dev.tx2.pct, 2 * r1.dev.tx2.pct, 1e-9, 'TX-2 doubles');
  near(Math.round(r2.dev.tx2.pct * 10) / 10, E.hv_tx_load_pct_n1, 1e-9, 'TX-2 = the engine N-1 loading');
  assert.ok(r2.dev.tx2.pct <= E.hv_tx_load_pct_n1 + 0.05, 'within the engine N-1 figure');
  near(r2.dev['fa1-cb'].kw, SNAP.campus.halls[0].facility_load_kw / E.dist_tx_streams, 1e-6, 'hall A feeder restored');
});

test('M7 protection chain from the engine, coordinated', () => {
  const ch = SIM.chain(B);
  assert.deepEqual(ch.map((c) => c.id), ['lsig', 'feeder', 'incomer', 'hv']);
  assert.equal(ch[1].dev.curve, E.pro_feeder_curve); assert.equal(ch[1].dev.TMS, E.pro_feeder_tms); assert.equal(ch[1].dev.Is, E.pro_feeder_is_a);
  assert.equal(ch[2].dev.TMS, E.pro_incomer_tms); assert.equal(ch[3].dev.Is, E.pro_hv_is_a); assert.equal(ch[0].dev.Ir, E.pro_lv_ir_a);
  near(ch[0].Imax, E.lv_fault_level_ka * 1000, 1e-9, 'LV main sees at most the LV fault');
  near(ch[1].Imax, E.mv_fault_level_ka * 1000, 1e-9, 'feeder sees at most the 20 kV fault');
  near(ch[2].Imax, E.mv_fault_level_ka * 1000, 1e-9, 'incomer sees at most the 20 kV fault');
  near(ch[3].Imax * E.hv_voltage_kv, E.mv_fault_level_ka * 1000 * E.mv_voltage_kv, 1e-6, '150 kV relay sees the 20 kV fault referred');
  const co = SIM.coordination(B);
  assert.ok(co.ok, 'chain coordinates');
  assert.ok(co.rows.length >= 6);
  for (const r of co.rows) assert.ok(r.margin >= E.pro_grading_margin_s - 1e-9, `${r.down} -> ${r.up} at ${r.I.toFixed(0)} A: ${r.margin}`);
  near(co.rows[0].I, E.dist_tx_through_fault_mv_a, 0.5, 'first grading point = LV max fault referred to 20 kV');
});

test('M8 no literal colour in the sheet, no clock or random in the simulation', () => {
  const sheet = fs.readFileSync(path.join(ROOT, 'js/conv/epms-sheet.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(sheet, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, 'literal colour in the sheet module');
  for (const f of ['js/conv/epms-sim.js', 'js/conv/epms-sheet.js', 'js/conv/tcc-modal.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(|setInterval|performance\.now/, `${f} uses a clock or random source`);
  }
  assert.ok(by['tx1'] && by['tie'], 'sheet loaded');
});
