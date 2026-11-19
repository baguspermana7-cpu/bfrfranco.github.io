#!/usr/bin/env node
/* test-conv-internals-core.mjs — node --test. The pure part of the equipment internal drawings
   (js/conv/internals.js + js/conv/internals/chiller.js, PRD-CONV-EQUIPMENT-TRUTH §3 P-2…P-4, §5.1, §9) against engine 2.4.0.
   K1 the chiller model of every fleet unit = the engine values re-computed here (fleet row + snapshot.cooling); COP = duty / input
   K2 energy balance per running unit: evaporator duty + compressor input = condenser duty within 0.1 %, on the raw numbers and
      on the DISPLAYED texts; the sum over the running units = the plant values (unit duty x running, chiller_input_kw_e)
   K3 a standby unit: no line runs, no running-only number (temperatures, saturation, lift, PR, COP read "—"), no duty / flow / input
   K4 every catalogue block of PRD §5.1 (chiller row) is a node of the sheet with a tag and a two-line role; the required media
      paths exist with their own medium class and direction
   K5 no digit typed in js/conv/internals/chiller.js outside its GEOMETRY block, comments and standards text; drawn value texts
      come from read() only (no node carries a text of its own)
   K6 "not modelled" readings are the text "not modelled", never a number
   K7 no random, no clock in either file; read() is deterministic
   RZ_INTERNALS_PLANT=condnopower | digit | standbyflow | nmnumber plants one defect (its law must fail). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const R = require(path.join(ROOT, 'js/conv/internals.js'));
require(path.join(ROOT, 'js/conv/internals/chiller.js'));
const C = require(path.join(ROOT, 'js/conv-engine.js')).CONV_CALC;
const SRC = fs.readFileSync(path.join(ROOT, 'js/conv/internals/chiller.js'), 'utf8');
const SRC_REG = fs.readFileSync(path.join(ROOT, 'js/conv/internals.js'), 'utf8');
const PLANT = process.env.RZ_INTERNALS_PLANT || '';

const def = R.get('chiller');
if (PLANT === 'condnopower') { const m0 = def.model; def.model = (u, s) => { const m = m0(u, s); m.condDuty = m.evapDuty; return m; }; }
if (PLANT === 'standbyflow') { const f0 = def.flow; def.flow = (u, k) => (k === 'chws' ? 'running' : f0(u, k)); }
if (PLANT === 'nmnumber') { const m0 = def.model; def.model = (u, s) => { const m = m0(u, s); m.superheat = 1.5; return m; }; }
const src = PLANT === 'digit' ? SRC.replace('  function nodeState(id, m) {', '  var DESIGN_SUPERHEAT = 5;\n  function nodeState(id, m) {') : SRC;

const snap = C.snapshot, c = snap.cooling, fleet = C.getFleet('chiller');
const num = (t) => { const m = /-?\d+(?:\.\d+)?/.exec(t || ''); return m ? Number(m[0]) : NaN; };

test('K1 model = engine (fleet row + snapshot.cooling), every unit', () => {
  assert.equal(fleet.length, c.chillers_total);
  for (const u of fleet) {
    const m = R.model('chiller', u, snap), run = u.state === 'running';
    assert.equal(m.evapDuty, u.dutyKwTh); assert.equal(m.compKw, u.inputKwE); assert.equal(m.condDuty, u.condenserDutyKwTh);
    assert.equal(m.chwFlow, u.chwFlowLps); assert.equal(m.cdwFlow, u.cdwFlowLps); assert.equal(m.loadPct, u.loadPct);
    if (run) {
      assert.equal(m.chwIn, c.chwr_c); assert.equal(m.chwOut, c.chws_c); assert.equal(m.cdwIn, c.cdw_supply_c); assert.equal(m.cdwOut, c.cdw_return_c);
      assert.equal(m.evapSatC, c.chiller_evap_sat_c); assert.equal(m.evapSatKpa, c.chiller_evap_sat_kpa_abs);
      assert.equal(m.condSatC, c.chiller_cond_sat_c); assert.equal(m.condSatKpa, c.chiller_cond_sat_kpa_abs);
      assert.equal(m.lift, c.chiller_lift_k); assert.equal(m.pr, c.chiller_pressure_ratio);
      assert.equal(m.carnotFraction, c.chiller_carnot_fraction); assert.equal(m.carnotCop, c.chiller_carnot_cop);
      assert.ok(Math.abs(m.cop - u.dutyKwTh / u.inputKwE) < 1e-12);
      assert.ok(Math.abs(m.cop - c.plant_cop) < 0.01, `unit COP ${m.cop} vs plant_cop ${c.plant_cop}`);
      /* the engine's own cycle identities, re-derived: lift = cond sat - evap sat; sat = leaving water -/+ approach */
      assert.ok(Math.abs(m.lift - (c.chiller_cond_sat_c - c.chiller_evap_sat_c)) < 0.051);
      assert.ok(Math.abs(c.chiller_evap_sat_c - (c.chws_c - c.chiller_evap_approach_k)) < 0.051);
      assert.ok(Math.abs(c.chiller_cond_sat_c - (c.cdw_return_c + c.chiller_cond_approach_k)) < 0.051);
    }
  }
  const t = fleet.filter((u) => u.state === 'running').length;
  assert.equal(t, c.chillers_running);
});

test('K2 energy balance per running unit (raw + displayed) and the fleet sums to the plant', () => {
  let sd = 0, sw = 0;
  for (const u of fleet.filter((x) => x.state === 'running')) {
    const m = R.model('chiller', u, snap);
    assert.ok(Math.abs(m.evapDuty + m.compKw - m.condDuty) / m.condDuty <= 0.001, `${u.tag} raw balance`);
    const rd = R.read('chiller', u, snap), e = num(rd.evap.values.duty.text), w = num(rd.cp.values.kw.text), q = num(rd.cond.values.duty.text);
    assert.ok(Math.abs(e + w - q) / q <= 0.001, `${u.tag} displayed ${e} + ${w} vs ${q}`);
    sd += m.evapDuty; sw += m.compKw;
  }
  assert.ok(Math.abs(sd - c.chiller_unit_duty_kw_th * c.chillers_running) / sd < 0.001, `sum duty ${sd}`);
  assert.ok(Math.abs(sw - c.chiller_input_kw_e) / sw < 0.001, `sum input ${sw} vs ${c.chiller_input_kw_e}`);
});

test('K3 a standby unit: no line runs, no running-only number', () => {
  const sb = fleet.filter((u) => u.state !== 'running');
  assert.ok(sb.length >= 1);
  const flows = [...new Set(def.sheet(sb[0]).edges.map((e) => e.flowOf).filter(Boolean))];
  for (const u of sb) {
    for (const k of flows) assert.notEqual(R.flow('chiller', u, { flowOf: k }), 'running', `${u.tag} ${k}`);
    const rd = R.read('chiller', u, snap);
    for (const [id, k] of [['chws', 't'], ['chwr', 't'], ['cdws', 't'], ['cdwr', 't'], ['ucp', 'cop'], ['ucp', 'lift'], ['ucp', 'pr'], ['ucp', 'carnot'], ['evap', 'sat'], ['cond', 'sat'], ['evap', 'p'], ['cond', 'p']])
      assert.ok(!/\d/.test(rd[id].values[k].text), `${u.tag} ${id}:${k} = "${rd[id].values[k].text}"`);
    const m = R.model('chiller', u, snap);
    assert.equal(m.evapDuty, 0); assert.equal(m.compKw, 0); assert.equal(m.chwFlow, 0); assert.equal(m.cdwFlow, 0);
    assert.equal(R.tempRange('chiller', u, snap), null);
  }
  const run = fleet.find((u) => u.state === 'running');
  assert.equal(R.flow('chiller', run, { flowOf: 'lpv' }), 'running');
});

test('K4 PRD §5.1 chiller catalogue: every block drawn, tagged, with a two-line role; media paths exist', () => {
  const need = ['evaporator', 'compressor', 'igv', 'motor', 'vfd', 'condenser', 'economiser', 'exv', 'oil-sump', 'oil-pump', 'oil-cooler', 'purge', 'hgbv', 'ucp', 'relief', 'chw-nozzles', 'cdw-nozzles'];
  const sh = def.sheet(fleet[0]), nodes = Object.fromEntries(sh.nodes.map((n) => [n.id, n]));
  for (const id of need) {
    const b = def.blocks.find((x) => x.id === id); assert.ok(b, `block ${id} missing`);
    assert.ok(nodes[b.node], `block ${id}: node ${b.node} not on the sheet`);
    assert.ok(nodes[b.node].tag && nodes[b.node].tagAt !== 'none', `block ${id}: no tag`);
    assert.ok(Array.isArray(b.role) && b.role.length === 2 && b.role.every((l) => l.length > 12), `block ${id}: role is not two lines`);
    assert.ok(b.standard, `block ${id}: no standard`);
  }
  const has = (from, to, medium) => sh.edges.some((e) => String(e.from).split('.')[0] === from && String(e.to).split('.')[0] === to && e.medium === medium);
  assert.ok(has('evap', 'igv', 'ref_lpv') && has('igv', 'cp', 'ref_lpv'), 'LP vapour evaporator -> compressor');
  assert.ok(has('cp', 'jh', 'ref_hpv') && has('jh', 'cond', 'ref_hpv'), 'HP vapour compressor -> condenser');
  assert.ok(has('cond', 'eco', 'ref_liq') && has('eco', 'exv', 'ref_liq') && has('jl', 'evap', 'ref_liq'), 'liquid condenser -> economiser -> EXV -> evaporator');
  assert.ok(has('eco', 'cp', 'ref_flash'), 'flash gas economiser -> interstage');
  assert.ok(has('jh', 'hgbv', 'ref_hpv') && has('hgbv', 'jl', 'ref_hpv'), 'hot-gas bypass line');
  assert.ok(has('cp', 'os', 'oil') && has('os', 'op', 'oil') && has('op', 'oc', 'oil') && has('oc', 'cp', 'oil'), 'oil loop');
  assert.ok(has('chwr', 'evap', 'chw') && has('evap', 'chws', 'chw'), 'chilled water through the evaporator');
  assert.ok(has('cdws', 'cond', 'cw') && has('cond', 'cdwr', 'cw'), 'condenser water through the condenser');
});

test('K5 no digit in chiller.js outside geometry, comments and standards; value texts come from read()', () => {
  const g0 = src.indexOf('/* GEOMETRY BEGIN'), g1 = src.indexOf('/* GEOMETRY END */');
  assert.ok(g0 > 0 && g1 > g0, 'GEOMETRY block markers');
  let rest = src.slice(0, g0) + src.slice(g1);
  rest = rest.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/standard: '[^']*'/g, "standard: ''");
  const hits = rest.split('\n').map((l, i) => [i, l]).filter(([, l]) => /\d/.test(l));
  assert.deepEqual(hits.map(([, l]) => l.trim()), [], 'digits outside geometry');
  for (const n of def.sheet(fleet[0]).nodes) {
    assert.ok(!('text' in n) && !('rating' in n), `${n.id} carries a text of its own`);
    for (const v of n.values || []) assert.deepEqual(Object.keys(v).filter((k) => !['k', 'dx', 'dy', 'anchor', 'lod'].includes(k)), [], `${n.id}:${v.k}`);
  }
  const rd = R.read('chiller', fleet[0], snap);
  for (const n of def.sheet(fleet[0]).nodes) for (const v of n.values || []) assert.ok(rd[n.id] && rd[n.id].values[v.k], `${n.id}:${v.k} has no read() value`);
});

test('K6 not-modelled readings are the text "not modelled"', () => {
  for (const u of fleet) {
    const m = R.model('chiller', u, snap);
    for (const k of ['superheat', 'subcooling', 'igvPos', 'oilPress', 'dischargeT']) assert.equal(m[k], R.NOT_MODELLED, `${u.tag} ${k}`);
    const d = R.detail('chiller', 'evaporator', u, snap), sh = d.rows.find((r) => r.key === 'superheat');
    assert.equal(sh.text, 'not modelled'); assert.equal(sh.basis, null);
  }
});

test('K7 no random, no clock; read() deterministic', () => {
  for (const s of [SRC, SRC_REG]) assert.ok(!/Math\.random|Date\.now|new Date|performance\.now/.test(s.replace(/\/\*[\s\S]*?\*\//g, '')));
  assert.deepEqual(R.read('chiller', fleet[2], snap), R.read('chiller', fleet[2], snap));
});
