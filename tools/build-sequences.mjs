#!/usr/bin/env node
/**
 * build-sequences.mjs — resolves data/sequences/<class>.json against the engine and the conv limits registry and
 * writes the browser twin js/rz-sequences.js (window.RZSequences). PRD-SETPOINT-SIM P3. Gate: tools/test-sequences.mjs.
 *
 * A condition never carries its own number: `limit` + `band` reads data/conv-parameters.json limits, `param` reads the
 * engine snapshot, `derived` is one of the plant quantities below (computed from the snapshot, formulas shown in the
 * twin). A scenario is walked step by step on those quantities: running chillers, capacity, part load, capacity short.
 *
 *   node tools/build-sequences.mjs           print the summary
 *   node tools/build-sequences.mjs --apply   write js/rz-sequences.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const DIR = path.join(ROOT, 'data/sequences');
const OUT = path.join(ROOT, 'js/rz-sequences.js');
const UNIT = { degC: '°C', C: '°C' };
const r1 = (x) => Math.round(x * 10) / 10;

const num = (snap, key) => { const v = key.split('.').reduce((o, k) => (o == null ? o : o[k]), snap); if (typeof v !== 'number') throw new Error(key + ' is not a number in the engine snapshot'); return v; };
/* a fleet quantity: one snapshot key, a difference (minus: [a, b]), a product (product: [a, b]) or a count of the engine's
   unit-state table (count: { kind, hall, state }, CONV_CALC.getFleet) */
let CALC = null;
export function qty(snap, q) {
  if (typeof q === 'string') return num(snap, q);
  if (q.key) return num(snap, q.key);
  if (q.minus) return num(snap, q.minus[0]) - num(snap, q.minus[1]);
  if (q.product) return num(snap, q.product[0]) * num(snap, q.product[1]);
  if (q.ratio) return num(snap, q.ratio[0]) / num(snap, q.ratio[1]);
  if (q.count) { const f = CALC.getFleet(q.count.kind, q.count.hall); if (!Array.isArray(f) || !f.length) throw new Error('no engine fleet ' + q.count.kind); return f.filter((u) => u.state === q.count.state).length; }
  throw new Error('unknown fleet quantity ' + JSON.stringify(q));
}
const qtyText = (q) => typeof q === 'string' ? q : q.key || (q.minus ? q.minus.join(' − ') : q.product ? q.product.join(' × ') : q.ratio ? q.ratio.join(' / ') : 'count of ' + q.count.kind + (q.count.hall ? ' hall ' + q.count.hall : '') + ' units ' + q.count.state);

/* the fleet a sequence stages, read from the engine snapshot by the keys its JSON names:
   load = one key, a difference (minus: [a, b]) or a product (product: [a, b]) */
export function plantOf(seq, snap) {
  const f = seq.fleet, L = f.load;
  const load = r1(qty(snap, L));
  return { noun: f.noun, unitLabel: f.unitLabel, pv: f.pv, load: load, unit: qty(snap, f.unit), total: qty(snap, f.total), running: qty(snap, f.running),
    source: f.source || null, spare: f.spare ? num(snap, f.spare) : 0,
    unitBasis: f.unit.product ? f.unit.product.map((k) => num(snap, k)).join(' × ') : null,
    unitPer: f.unit.ratio ? f.unit.ratio.map((k) => num(snap, k)).join(' / ') : null,
    keys: { running: f.running, total: f.total, unit: f.unit, load: L },
    formula: { load: qtyText(L), unit: qtyText(f.unit), running: qtyText(f.running), demand_pct: 'load / (running × unit) × 100 (above 100 = capacity short)',
      part_load_pct: 'min(100, demand_pct): a unit cannot run above its rating',
      part_load_n_minus_1_pct: 'load / ((running − 1) × unit) × 100', available_capacity_margin: 'available × unit − load' } };
}

export function derived(P, running, available) {
  return {
    demand_pct: running > 0 ? r1(P.load / (running * P.unit) * 100) : null,
    part_load_n_minus_1_pct: running > 1 ? r1(P.load / ((running - 1) * P.unit) * 100) : null,
    available_capacity_margin: r1(available * P.unit - P.load),
  };
}

/* source (a fleet that is a standby supply, e.g. generating sets): 'utility' = the load is on the utility and the fleet
   carries none of it (short 0), 'gen' = the fleet carries it, 'none' = nothing does (the whole load is short) */
function state(P, t, mode, running, available, note, source) {
  const cap = r1(running * P.unit), short = source === 'utility' ? 0 : source === 'none' ? P.load : Math.max(0, r1(P.load - cap));
  const s = { t_s: t, mode, note: note || null, running, available, capacity: cap,
    part_load_pct: running > 0 && (!source || source === 'gen') ? Math.min(100, derived(P, running, available).demand_pct) : null, short: short, pv: short > 0 ? P.pv.short : P.pv.ok };
  if (P.source) s.source = source;
  return s;
}

/* walk a scenario on the plant quantities; each step applies its `do` to the state before it */
export function walk(seq, sc, P) {
  const modes = Object.fromEntries(seq.modes.map((m) => [m.id, m]));
  const need = Math.ceil(P.load / P.unit);
  let running = P.running, available = P.total, t = 0, source = P.source; const out = [];
  sc.steps.forEach((s) => {
    const d = s.do || {};
    if (d.source) source = d.source;
    if (d.running === 'zero') running = 0;
    else if (d.running === 'all') running = available;
    else if (d.running === 'duty') running = available - P.spare;
    else if (typeof d.running === 'number') running += d.running;
    if (typeof d.available === 'number') available += d.available;
    if (d.restart === 'all') {
      const st = modes[s.mode].stagger_s;
      for (let k = 1; k <= need; k++) { running = k; out.push(state(P, (k - 1) * st, s.mode, running, available, `Restart ${k} of ${need}`, source)); }
      return;
    }
    out.push(state(P, t, s.mode, running, available, s.note, source));
  });
  return out;
}

function resolveCond(c, LIM, snap, P, SPS) {
  const r = { text: c.text || null, op: c.op || null, to: c.to || null, delay_s: typeof c.delay_s === 'number' ? c.delay_s : null };
  if (c.event) { r.kind = 'event'; r.text = c.event; return r; }
  if (c.limit) {
    const L = LIM[c.limit]; if (!L) throw new Error('limit ' + c.limit + ' is not in the conv limits registry');
    if (typeof L[c.band] !== 'number') throw new Error('limit ' + c.limit + ' has no ' + c.band);
    return Object.assign(r, { kind: 'limit', point: c.limit, band: c.band, value: L[c.band], unit: UNIT[L.unit] || L.unit || '', label: r.text || L.label,
      evidenceClass: String(L.evidenceClass || '').toUpperCase(), source: 'limits registry ' + c.limit + '.' + c.band });
  }
  if (c.param) {
    const v = c.param.split('.').reduce((o, k) => (o == null ? o : o[k]), snap);
    if (typeof v !== 'number') throw new Error('param ' + c.param + ' is not a number in the engine snapshot');
    const p = PARAMS[c.param] || {};
    return Object.assign(r, { kind: 'param', point: c.param, value: v, unit: UNIT[p.unit] || p.unit || '', evidenceClass: String(p.evidenceClass || '').toUpperCase(), source: 'engine parameter ' + c.param });
  }
  if (c.setpoint) {
    const sp = SPS[c.setpoint]; if (!sp) throw new Error('setpoint ' + c.setpoint + ' is not in data/control-points.json');
    return Object.assign(r, { kind: 'setpoint', point: c.setpoint, value: sp.value, unit: sp.unit, label: r.text || sp.label, evidenceClass: sp.evidenceClass, source: 'control registry ' + c.setpoint });
  }
  if (c.derived) return Object.assign(r, { kind: 'derived', point: c.derived, value: c.value, unit: /margin/.test(c.derived) ? P.unitLabel : '%', evidenceClass: 'DERIVED', source: 'plant quantity ' + c.derived });
  r.kind = 'state'; return r;
}

let PARAMS = {};
export function build() {
  const conv = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/conv-parameters.json'), 'utf8'));
  PARAMS = Object.fromEntries(conv.parameters.map((p) => [p.id, p]));
  const LIM = Object.fromEntries(conv.limits.map((l) => [l.id, l]));
  const E = require(path.join(ROOT, 'js/conv-engine.js')), snap = (E.CONV_CALC || E).snapshot; CALC = E.CONV_CALC || E;
  const SPS = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/control-points.json'), 'utf8')).rows.filter((x) => x.sp)
    .map((x) => [x.id, { value: x.sp.value, unit: UNIT[x.unit] || x.unit || '', label: x.label, evidenceClass: x.sp.evidenceClass }]));
  const out = {};
  fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort().forEach((f) => {
    const seq = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')), P = plantOf(seq, snap);
    out[seq.classKey] = { title: seq.title, basis: seq.basis, plant: seq.plant, quantities: P,
      modes: seq.modes.map((m) => ({ id: m.id, label: m.label, kind: m.kind, actions: m.actions,
        entry: m.entry.map((c) => resolveCond(c, LIM, snap, P, SPS)), exit: m.exit.map((c) => resolveCond(c, LIM, snap, P, SPS)),
        stagger_s: m.stagger_s || null, notModelled: m.notModelled || null, assumed: m.assumed || null })),
      scenarios: seq.scenarios.map((sc) => ({ id: sc.id, label: sc.label, steps: walk(seq, sc, P) })) };
  });
  return out;
}

export function twin(all) {
  return '/* GENERATED by tools/build-sequences.mjs from data/sequences/*.json — do not edit (PRD-SETPOINT-SIM P3).\n' +
    ' *   RZSequences.get(classKey) -> { title, basis, plant, quantities, modes[{ id, label, kind, entry, actions, exit }], scenarios[{ id, label, steps }] } | null */\n' +
    '(function (root) {\n  \'use strict\';\n  var ALL = ' + JSON.stringify(all) + ';\n' +
    '  function get(k) { return Object.prototype.hasOwnProperty.call(ALL, k) ? ALL[k] : null; }\n' +
    '  root.RZSequences = { get: get, classes: function () { return Object.keys(ALL); }, version: \'1.0.0\' };\n' +
    '})(typeof window !== \'undefined\' ? window : this);\n';
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const all = build();
  Object.entries(all).forEach(([k, s]) => console.log(`${k}: ${s.modes.length} modes, ${s.scenarios.length} scenarios; load ${s.quantities.load} ${s.quantities.unitLabel}, ${s.quantities.running}/${s.quantities.total} ${s.quantities.noun} running`));
  if (process.argv.includes('--apply')) { fs.writeFileSync(OUT, twin(all)); console.log('wrote ' + path.relative(ROOT, OUT)); }
}
