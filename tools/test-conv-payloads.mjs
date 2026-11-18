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
  new Function('window', fs.readFileSync(path.join(ROOT, 'js/conv', file), 'utf8'))(win);
  sheets[page] = win[key].pid || win[key].sld;
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
