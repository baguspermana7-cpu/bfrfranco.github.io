#!/usr/bin/env node
/* test-conv-payloads.mjs — js/conv/payloads.js, the one inspector payload builder of the Conventional sheets
   (CONV_EXECUTION_PLAN_2026-11-16 §4 GD, AD1–AD3, AD6, AD7). Run: node --test tools/test-conv-payloads.mjs
   P1 every tagged symbol on the four P&ID sheets and the E-S-101 single-line has a class recipe (no symbol falls through to "no class recipe")
   P2 every payload is frozen and has six tabs with content (LIVE >= 4 rows; alarms tab = active events OR configured points)
   P3 every basis row resolves in data/conv-parameters.json and prints the registry value at its precision
   P4 every other row is SIM (sim:true) or declared with >= 40 characters; no NaN, no "undefined"
   P5 same tick -> deepEqual payload; tick + 1 changes only SIM rows
   P6 no Math.random in the module source
   P7 the provenance footer carries the registry engine version, never "—" */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const P = require(path.join(ROOT, 'js/conv/payloads.js'));
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/conv-parameters.json'), 'utf8'));
const IDX = Object.fromEntries(REG.parameters.map((p) => [p.id, p]));

/* the sheets register themselves on window.RZ*Sheets */
const sheets = {};
for (const [page, file, key] of [['chiller', 'chiller-sheet.js', 'RZChillerSheets'], ['fire', 'fire-sheet.js', 'RZFireSheets'],
  ['fuel', 'fuel-sheet.js', 'RZFuelSheets'], ['water', 'water-sheet.js', 'RZWaterSheets'], ['epms', 'epms-sheet.js', 'RZEpmsSheets']]) {
  const win = {};
  /* FU-M-101 is drawn per hall from the engine genset fleet (CONV_CALC.getFleet), so its sheet needs the engine */
  if (page === 'fuel') new Function('window', fs.readFileSync(path.join(ROOT, 'js/conv-engine.js'), 'utf8'))(win);
  new Function('window', fs.readFileSync(path.join(ROOT, 'js/conv', file), 'utf8'))(win);
  sheets[page] = win[key].pid || win[key].sld;
  if (win[key].cdw) sheets.condenser = win[key].cdw;   /* CH-M-102 (E3): the condenser page of the chiller cockpit */
}
const tagged = (sh) => sh.nodes.filter((n) => n.sym !== 'junction');

function payloads(tick) {
  const out = [];
  for (const [page, sh] of Object.entries(sheets)) {
    for (const n of tagged(sh)) out.push(P.build({ page, node: n, read: { values: { st: { text: 'RUN' } } }, edges: sh.edges, nodes: sh.nodes, tick }));
  }
  return out;
}
const rowsOf = (p) => [...p.tabs.live, ...p.tabs.capacity, ...p.tabs.alarmPoints, ...p.tabs.maint, ...(p.tabs.trend ? p.tabs.trend.rows : [])];

test('P1 every tagged symbol has a class recipe', () => {
  const missing = [];
  for (const [page, sh] of Object.entries(sheets)) for (const n of tagged(sh)) if (!P.classOf(page, n.sym)) missing.push(page + ':' + n.sym + ':' + n.id);
  assert.deepEqual(missing, []);
});

test('P2 frozen, six tabs with content, LIVE >= 4', () => {
  for (const p of payloads(100)) {
    assert.ok(Object.isFrozen(p) && Object.isFrozen(p.tabs.live), p.id + ' frozen');
    assert.ok(p.tabs.live.length >= 4, p.id + ' LIVE ' + p.tabs.live.length);
    assert.ok(p.tabs.capacity.length >= 1, p.id + ' capacity');
    assert.ok(p.tabs.alarms.length + p.tabs.alarmPoints.length >= 1, p.id + ' alarms');
    assert.ok(p.tabs.maint.length >= 3, p.id + ' maint');
    assert.ok(p.guidance && p.guidance.length > 20, p.id + ' guidance');
    if (p.sym !== 'offSheet') assert.ok(p.tabs.deps.upstream.length + p.tabs.deps.downstream.length >= 1, p.classId + ':' + p.id + ' deps');
  }
});

test('P3 basis rows resolve and print the registry value', () => {
  let n = 0;
  for (const p of payloads(100)) for (const r of rowsOf(p)) {
    if (!r.basis) continue; n++;
    const rec = IDX[r.basis]; assert.ok(rec, r.basis + ' resolves');
    if (typeof rec.value === 'number') {
      const shown = Number(r.text.replace(/,/g, ''));
      const d = (r.text.split('.')[1] || '').length;
      assert.ok(Math.abs(shown - rec.value) <= 0.5 * Math.pow(10, -d) + 1e-9, `${p.id} ${r.label}: ${r.text} vs ${rec.value}`);
    } else assert.equal(r.text, String(rec.value));
  }
  assert.ok(n > 100, 'basis rows ' + n);
});

test('P4 every non-basis row is SIM or declared >= 40 chars; no NaN', () => {
  for (const p of payloads(7)) for (const r of rowsOf(p)) {
    assert.ok(!/NaN|undefined/.test(r.text + r.unit), p.id + ' ' + r.label + ' ' + r.text);
    assert.ok(!/did not resolve|no class recipe/.test(r.declared || ''), p.id + ' ' + r.label + ': ' + r.declared);
    if (r.basis) continue;
    assert.ok(r.sim === true || (r.declared && r.declared.length >= 40), p.id + ' ' + r.label + ' untraced');
  }
});

test('P5 deterministic per tick; tick+1 changes only SIM rows', () => {
  assert.deepEqual(payloads(42), payloads(42));
  const a = payloads(42), b = payloads(43);
  for (let i = 0; i < a.length; i++) {
    const ra = rowsOf(a[i]), rb = rowsOf(b[i]);
    for (let j = 0; j < ra.length; j++) if (ra[j].text !== rb[j].text) assert.ok(ra[j].sim, a[i].id + ' ' + ra[j].label + ' changed but is not SIM');
  }
});

test('P6 no Math.random in the module', () => {
  assert.ok(!/Math\.random/.test(fs.readFileSync(path.join(ROOT, 'js/conv/payloads.js'), 'utf8')));
});

test('P7 provenance carries the registry engine version', () => {
  for (const p of payloads(1)) assert.equal(p.provenance.engineVersion, REG.engineVersion);
});

test('P8 trend: 60 points, reference line, rows traced', () => {
  for (const p of payloads(9)) {
    if (!p.tabs.trend) continue;
    assert.equal(p.tabs.trend.series.length, 60, p.id);
    assert.ok(typeof p.tabs.trend.ref === 'number', p.id + ' ref');
  }
});

test('P9 a chilled-water return transmitter reads the return temperature, a supply one the supply', () => {
  const sh = sheets.chiller, chws = IDX['cooling.chws_c'].value, chwr = IDX['cooling.chwr_c'].value;
  assert.ok(Math.abs(chwr - chws) > 2, 'registry supply and return must differ for this law to mean anything');
  const tts = sh.nodes.filter((n) => n.sym === 'instField' && n.inst === 'TT');
  const ret = tts.filter((n) => /^(tthr|ttr\d)/.test(n.id)), sup = tts.filter((n) => /^(tths|tts\d)/.test(n.id));
  assert.ok(ret.length >= 2 && sup.length >= 2 && ret.length + sup.length === tts.length, 'every TT is classed supply or return');
  for (const [list, want, word] of [[ret, chwr, 'return'], [sup, chws, 'supply']]) {
    for (const n of list) {
      const p = P.build({ page: 'chiller', node: n, read: { values: {} }, edges: sh.edges, nodes: sh.nodes, tick: 7 });
      const pv = p.tabs.live.find((r) => r.label === 'Process value');
      assert.ok(Math.abs(parseFloat(pv.text) - want) <= 0.5, `${n.tag} (${word}) process value ${pv.text} is not near ${want}`);
      assert.equal(p.tabs.trend.ref, want, `${n.tag} trend reference`);
    }
  }
});

/* P9 (PRD-CONV-OPS-DEPTH 01 §12 Amendment E2, engine 2.10.0): the differential-head trend of every chilled- and
   condenser-water pump is anchored on the operating dp of its own loop (primary, secondary, condenser), never on a
   typed 245 kPa; a pump the page shows standing by (Head 0 m, engine) trends a flat 0 kPa */
test('P9 pump differential-head trend follows the engine operating dp of its loop; standby trends 0', () => {
  const key = { 'chw-train': 'cooling.chw_primary_pump_dp_op_kpa', 'chw-sec': 'cooling.chw_secondary_pump_dp_op_kpa', 'cdw-pump': 'cooling.cdw_pump_dp_op_kpa' };
  const seen = new Set();
  for (const page of ['chiller', 'condenser']) {
    const sh = sheets[page];
    for (const n of sh.nodes.filter((x) => x.sym === 'pumpCentrifugal' && key[x.cls])) {
      const want = IDX[key[n.cls]].value;
      const run = P.build({ page, node: n, read: { values: {}, rows: [['Head', (want / 9.80665).toFixed(2) + ' m', 'engine']] }, edges: sh.edges, nodes: sh.nodes, tick: 7 });
      assert.equal(run.tabs.trend.ref, want, `${n.tag} (${n.cls}) running trend reference ${run.tabs.trend.ref} vs ${key[n.cls]} ${want}`);
      /* Head 0 m with the 'engine' mark (engine plane) and without it (the page's maintenance simulation): both stand by */
      for (const head of [['Head', '0 m', 'engine'], ['Head', '0 m']]) {
        const sb = P.build({ page, node: n, read: { values: {}, rows: [['Mode', 'Standby'], head] }, edges: sh.edges, nodes: sh.nodes, tick: 7 });
        assert.equal(sb.tabs.trend.ref, 0, `${n.tag} standby trend reference (${head.length})`);
        assert.ok(sb.tabs.trend.series.every((v) => v === 0), `${n.tag} standby trend is flat 0: ${sb.tabs.trend.series.slice(0, 3)}`);
        assert.ok(!sb.tabs.trend.rows.some((r) => /Engine plane/.test(r.label)), `${n.tag} standby trend does not print the duty plane as its reference`);
      }
      seen.add(n.cls);
    }
  }
  assert.deepEqual([...seen].sort(), ['cdw-pump', 'chw-sec', 'chw-train'], 'every loop has a pump checked');
});

/* P10 (PRD-SETPOINT-SIM §C P9, v3.115.2): a day tank (FU-M-101 dt<k>) is not the bulk tank. It shares the symbol
   tankStorage with the bulk UST, and until v3.115.1 it borrowed the bulk tank's class: Level / Usable volume / Autonomy
   from fuel.level_pct, the bulk 60 / 30 / 95 % alarms and a trend on the bulk level (85 %) beside a day tank the drawing
   prints at 90 %. Its alarms are the limits registry row its own level points at (limitsOf), its trend reference is that
   row's nominal, and no row reads a bulk-tank parameter. */
test('P10 a day tank prints its own limits and trend, never the bulk tank class', () => {
  const sh = sheets.fuel, LIM = Object.fromEntries((REG.limits || []).map((l) => [l.id, l]));
  const tanks = sh.nodes.filter((n) => n.sym === 'tankStorage' && /^dt\d+$/.test(n.id));
  assert.ok(tanks.length >= 2, `FU-M-101 draws day tanks (${tanks.length})`);
  const bulk = /^fuel\.(level_pct|usable_l|autonomy_hr|tank_capacity_l|usable_fraction|level_low_pct|level_low_low_pct|level_overfill_pct)$/;
  for (const n of tanks) {
    const lid = (n.values || []).map((v) => v.limitsOf).find(Boolean), L = LIM[lid];
    assert.ok(L, `${n.tag} level points at a limits registry row (${lid})`);
    const p = P.build({ page: 'fuel', node: n, read: { values: { pct: { text: '90 %' } } }, edges: sh.edges, nodes: sh.nodes, tick: 3 });
    const rows = [...p.tabs.live, ...p.tabs.capacity, ...p.tabs.alarmPoints, ...(p.tabs.trend ? p.tabs.trend.rows : [])];
    const leak = rows.filter((r) => r.basis && bulk.test(r.basis)).map((r) => r.label + ' <- ' + r.basis);
    assert.deepEqual(leak, [], `${n.tag} reads no bulk-tank parameter`);
    const al = p.tabs.alarmPoints.map((r) => +r.text).sort((a, b) => a - b);
    assert.deepEqual(al, [L.lo_alarm, L.lo_warn].sort((a, b) => a - b), `${n.tag} alarms = ${lid} lo_alarm / lo_warn`);
    assert.ok(p.tabs.alarmPoints.every((r) => r.unit === L.unit && new RegExp(lid.replace(/\./g, '\\.')).test(r.declared)), `${n.tag} alarm rows name the registry row and its unit`);
    assert.ok(p.tabs.trend, `${n.tag} has a trend`);
    assert.equal(p.tabs.trend.ref, L.nominal.value, `${n.tag} trend reference = ${lid} nominal`);
    assert.ok(p.tabs.trend.series.every((v) => v <= 100 && v >= 0), `${n.tag} trend stays a level`);
  }
  /* the bulk tank keeps its class */
  const ust = sh.nodes.find((n) => n.sym === 'tankStorage' && !/^dt\d+$/.test(n.id));
  if (ust) {
    const b = P.build({ page: 'fuel', node: ust, read: { values: {} }, edges: sh.edges, nodes: sh.nodes, tick: 3 });
    assert.ok(b.tabs.live.some((r) => r.basis === 'fuel.level_pct'), 'the bulk tank still reads fuel.level_pct');
  }
});

/* P11 (v3.115.2): a controller bubble (n.loop, no machine class) is a controller, not "instPanel", and the number it
   prints from the control registry (a value spec with `const`) is a declared registry value, never a SIM reading */
test('P11 a controller bubble names itself a controller and its registry number is not SIM', () => {
  const n = { id: 'pic301', tag: 'PIC-301', sym: 'instPanel', loop: 'conv.water-system.booster_discharge_sp', ctrl: 'pump-duty', label: 'P-301A pressure controller (reverse acting PI)',
    values: [{ k: 'sp', const: 'booster discharge setpoint from the control registry (conv.water-system.booster_discharge_sp)' }] };
  const p = P.build({ page: 'water', node: n, read: { values: { sp: { text: 'SP 4.2 bar' } }, rows: [['Setpoint', '4.2 bar (registry, ASSUMED)']] }, edges: [], nodes: [n], tick: 1 });
  assert.equal(p.kind, 'Controller', 'kind');
  const sp = p.tabs.live.find((r) => r.text === 'SP 4.2 bar');
  assert.ok(sp, 'the SP row is shown');
  assert.ok(!sp.sim && sp.quality === 'declared' && /control registry/.test(sp.declared), `SP row is declared from the registry: ${JSON.stringify(sp)}`);
});
