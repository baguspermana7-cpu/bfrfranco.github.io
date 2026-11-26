#!/usr/bin/env node
/*
 * test-sequences.mjs — PRD-SETPOINT-SIM P3 node laws on data/sequences/*.json and its twin js/rz-sequences.js.
 *
 *   Q1 every mode has an entry, ordered actions and an exit; the sequence names its basis and evidence class
 *   Q2 every exit leads to a mode that exists; every mode is reachable from `normal` and has a way back to it
 *   Q3 no typed threshold: a limit/param condition carries no `value` of its own; the twin's number equals the limits
 *      registry / engine snapshot read here independently; a delay, hysteresis or stagger that no source states is
 *      listed under `assumed` with its reason
 *   Q4 scenario walk: consecutive steps follow an exit (or stay in one mode); capacity = running × unit, short =
 *      max(0, load − capacity), part load = min(100, load / capacity), CHWS rises exactly while capacity is short;
 *      every scenario ends with no capacity short
 *   Q5 js/rz-sequences.js equals what tools/build-sequences.mjs writes (freshness)
 *
 * Red first: before js/rz-sequences.js exists Q5 fails; RZ_SEQ_PLANT=typed adds a typed threshold (Q3 fails),
 * RZ_SEQ_PLANT=orphan points an exit at a missing mode (Q2 fails).
 *   node tools/test-sequences.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build, twin } from './build-sequences.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const fails = []; let passes = 0;
const ok = (c, law, msg) => { if (c) passes++; else fails.push(`${law} ${msg}`); };
const close = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 0.051;

const conv = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/conv-parameters.json'), 'utf8'));
const LIM = Object.fromEntries(conv.limits.map((l) => [l.id, l]));
const DC = require(path.join(ROOT, 'js/dcai-engine.js'));
const E = require(path.join(ROOT, 'js/conv-engine.js')), snap = (E.CONV_CALC || E).snapshot, CALC = E.CONV_CALC || E;
const SPS = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/control-points.json'), 'utf8')).rows.filter((x) => x.sp).map((x) => [x.id, x.sp.value]));
const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const DIR = path.join(ROOT, 'data/sequences');
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
ok(files.length >= 1, 'Q1', 'no sequence file in data/sequences');

let built = null;
try { built = build(); } catch (e) { fails.push('Q3 build threw: ' + e.message); }

for (const f of files) {
  const seq = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  if (process.env.RZ_SEQ_PLANT === 'typed') seq.modes[0].exit[1].value = 21;
  if (process.env.RZ_SEQ_PLANT === 'orphan') seq.modes[0].exit[0].to = 'nowhere';
  const ids = new Set(seq.modes.map((m) => m.id)), K = seq.classKey;
  const assumedKeys = new Set(seq.modes.flatMap((m) => Object.keys(m.assumed || {})));

  /* Q1 */
  ok(!!(seq.basis && seq.basis.ref && seq.basis.evidenceClass), 'Q1', `${K}: sequence basis or its evidence class missing`);
  seq.modes.forEach((m) => {
    ok(m.entry && m.entry.length >= 1, 'Q1', `${K}.${m.id}: no entry condition`);
    ok(m.actions && m.actions.length >= 1, 'Q1', `${K}.${m.id}: no actions`);
    ok(m.exit && m.exit.length >= 1, 'Q1', `${K}.${m.id}: no exit`);
  });

  /* Q2 */
  const edges = {};
  seq.modes.forEach((m) => { edges[m.id] = m.exit.map((c) => c.to); m.exit.forEach((c) => ok(ids.has(c.to), 'Q2', `${K}.${m.id}: exit to "${c.to}", no such mode`)); });
  const reach = (from) => { const seen = new Set([from]), q = [from]; while (q.length) (edges[q.shift()] || []).forEach((n) => { if (ids.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } }); return seen; };
  const fromNormal = reach('normal');
  seq.modes.forEach((m) => {
    ok(fromNormal.has(m.id), 'Q2', `${K}.${m.id}: not reachable from normal`);
    ok(reach(m.id).has('normal'), 'Q2', `${K}.${m.id}: no way back to normal`);
  });

  /* Q3 */
  const conds = seq.modes.flatMap((m) => m.entry.concat(m.exit).map((c) => [m, c]));
  conds.forEach(([m, c]) => {
    if (c.limit || c.param || c.setpoint) ok(!('value' in c), 'Q3', `${K}.${m.id}: typed threshold ${c.value} on ${c.limit || c.param || c.setpoint}`);
    if (c.limit) ok(!!LIM[c.limit] && typeof LIM[c.limit][c.band] === 'number', 'Q3', `${K}.${m.id}: ${c.limit}.${c.band} not in the limits registry`);
    if (c.param) ok(typeof getPath(snap, c.param) === 'number', 'Q3', `${K}.${m.id}: ${c.param} not a number in the engine snapshot`);
    if (typeof c.delay_s === 'number') ok(assumedKeys.has('delay_s ' + c.delay_s), 'Q3', `${K}.${m.id}: delay ${c.delay_s} s has no source and is not listed as assumed`);
    if (c.derived && c.value !== 100 && c.value !== 0) ok(assumedKeys.has('value ' + c.value), 'Q3', `${K}.${m.id}: derived threshold ${c.value} has no source and is not listed as assumed`);
  });
  seq.modes.filter((m) => m.stagger_s).forEach((m) => ok(assumedKeys.has('stagger_s ' + m.stagger_s), 'Q3', `${K}.${m.id}: stagger ${m.stagger_s} s not listed as assumed`));
  const B = built && built[K];
  ok(!!B, 'Q3', `${K}: not in the build`);
  if (B) B.modes.forEach((m) => m.entry.concat(m.exit).forEach((c) => {
    if (c.kind === 'limit') ok(close(c.value, LIM[c.point][c.band]), 'Q3', `${K}.${m.id}: ${c.point}.${c.band} twin ${c.value} ≠ registry ${LIM[c.point][c.band]}`);
    if (c.kind === 'param') ok(close(c.value, getPath(snap, c.point)), 'Q3', `${K}.${m.id}: ${c.point} twin ${c.value} ≠ engine ${getPath(snap, c.point)}`);
    if (c.kind === 'setpoint') ok(!!SPS[c.point] && close(c.value, SPS[c.point]), 'Q3', `${K}.${m.id}: setpoint ${c.point} twin ${c.value} ≠ control registry ${SPS[c.point]}`);
    if (c.kind === 'limit' || c.kind === 'param' || c.kind === 'setpoint') ok(!!c.evidenceClass, 'Q3', `${K}.${m.id}: ${c.point} shown without an evidence class`);
  }));

  /* Q4 */
  if (B) {
    const f = seq.fleet || {};
    /* a fleet quantity read here independently: a snapshot key, minus, product, or a count of the engine's unit-state table */
    /* P7: a DC AI sequence reads the DC AI engine; a step that sets a model input reads its own re-compute (done here
       on a fresh copy of DCAI_CALC.model, not through the builder) */
    const S0 = seq.engine === 'dcai' ? DC.snapshot : snap;
    const needIn = (S, q) => typeof q === 'string' ? getPath(S, q) : !q ? undefined : q.key ? getPath(S, q.key) : q.minus ? getPath(S, q.minus[0]) - getPath(S, q.minus[1])
      : q.product ? getPath(S, q.product[0]) * getPath(S, q.product[1]) : q.ratio ? getPath(S, q.ratio[0]) / getPath(S, q.ratio[1]) : undefined;
    const need = (q) => q && q.count === undefined ? needIn(S0, q) : typeof q === 'string' ? needIn(S0, q) : !q ? undefined : q.count ? CALC.getFleet(q.count.kind, q.count.hall).filter((u) => u.state === q.count.state).length : undefined;
    ok(['running', 'total', 'unit'].every((k) => typeof need(f[k]) === 'number' && isFinite(need(f[k]))), 'Q4', `${K}: fleet running/total/unit not numbers from the engine`);
    const load = need(f.load), unit = need(f.unit), load0 = load, unit0 = unit;
    ok(close(B.quantities.load, Math.round(load * 10) / 10) && B.quantities.running === need(f.running) && B.quantities.total === need(f.total), 'Q4', `${K}: twin plant ${JSON.stringify(B.quantities)} ≠ engine (load ${load})`);
    /* a standby supply (source 'utility') runs none of its units while the utility carries the load; any other fleet
       carries its own load with the units the engine runs */
    if (f.source === 'utility') ok(B.quantities.running === 0 && CALC.getFleet(f.running.count.kind, f.running.count.hall).every((u) => u.state !== 'running'), 'Q4', `${K}: a standby fleet runs ${B.quantities.running} units on the utility`);
    else ok(B.quantities.running * unit >= load - 0.05, 'Q4', `${K}: the engine's running ${f.noun} do not carry its own load`);
    let src = f.source || null;
    B.scenarios.forEach((sc) => {
      src = f.source || null;
      const srcOf = [], js = seq.scenarios.find((x) => x.id === sc.id).steps;
      js.forEach((st) => { if (st.do && st.do.source) src = st.do.source; const reps = st.do && st.do.restart === 'all' ? Math.ceil(load / unit) : 1; for (let k = 0; k < reps; k++) srcOf.push(src); });
      ok(srcOf.length === sc.steps.length, 'Q4', `${K}/${sc.id}: ${sc.steps.length} walked steps for ${srcOf.length} JSON steps`);
      sc.steps.forEach((s, i) => {
        let load = load0, unit = unit0;
        const set = js[i] && js[i].do && js[i].do.set;
        if (set) {
          const m = JSON.parse(JSON.stringify(DC.model)), k = set.path.split('.'); let o = m; for (let j = 0; j < k.length - 1; j++) o = o[k[j]]; o[k[k.length - 1]] = set.value;
          const R = DC.compute(m); load = needIn(R, f.load); unit = needIn(R, f.unit);
          const mv = getPath(R, seq.modeBy.key), band = seq.modeBy.bands.find((b) => typeof b.below !== 'number' || mv < b.below);
          ok(s.mode === band.mode, 'Q4', `${K}/${sc.id} step ${i}: ${set.path} ${set.value} is ${band.mode} (margin ${mv}), the step says ${s.mode}`);
          ok(s.running === Math.min(needIn(R, f.running), needIn(R, f.total)) && s.available === needIn(R, f.total), 'Q4', `${K}/${sc.id} step ${i}: running ${s.running}/${s.available} ≠ engine ${needIn(R, f.running)}/${needIn(R, f.total)}`);
          seq.engineFields.forEach((ef, n) => ok(close(s.engine[n].value, Math.round(getPath(R, ef.key) * 10) / 10), 'Q4', `${K}/${sc.id} step ${i}: ${ef.label} ${s.engine[n].value} ≠ engine ${getPath(R, ef.key)}`));
        }
        const cap = Math.round(s.running * unit * 10) / 10, so = srcOf[i], short = so === 'utility' ? 0 : so === 'none' ? load : Math.max(0, load - cap);
        if (f.source) ok(s.source === so, 'Q4', `${K}/${sc.id} step ${i}: source ${s.source}, want ${so}`);
        ok(close(s.capacity, cap), 'Q4', `${K}/${sc.id} step ${i}: capacity ${s.capacity} ≠ ${cap}`);
        ok(Math.abs(s.short - short) <= 0.11, 'Q4', `${K}/${sc.id} step ${i}: short ${s.short} ≠ ${short}`);
        ok(s.running === 0 || (f.source && so !== 'gen') ? s.part_load_pct === null : close(s.part_load_pct, Math.min(100, Math.round(load / (s.running * unit) * 1000) / 10)), 'Q4', `${K}/${sc.id} step ${i}: part load ${s.part_load_pct}`);
        ok((s.pv === f.pv.short) === (short > 0.05) && (s.pv === f.pv.ok) === !(short > 0.05), 'Q4', `${K}/${sc.id} step ${i}: ${f.pv.label} "${s.pv}" with short ${short}`);
        ok(s.running <= s.available, 'Q4', `${K}/${sc.id} step ${i}: ${s.running} running of ${s.available} available`);
        if (i) { const a = sc.steps[i - 1].mode, b = s.mode; ok(a === b || (edges[a] || []).includes(b), 'Q4', `${K}/${sc.id}: step ${a} → ${b} is not an exit of ${a}`); }
      });
      /* a trip scenario ends restored; an engine sweep (do.set) may end short, and then shows it */
      if (!js.some((st) => st.do && st.do.set)) ok(sc.steps.length && sc.steps[sc.steps.length - 1].short === 0, 'Q4', `${K}/${sc.id}: ends with capacity short`);
      /* the UPS unit is the one the EPMS LV sheet draws for a hall and stream (E-S-102 battery rating) */
      if (K === 'ups' && sc === B.scenarios[0]) {
        global.window = global; require(path.join(ROOT, 'js/conv/epms-lv.js'));
        const sh = window.RZEpmsLv.build(0, snap, CALC.getFleet('genset', 'A')), bats = sh.nodes.filter((n) => n.sym === 'batteryIec' && n.dcBus);
        ok(bats.length === snap.electrical.ups_system_count && bats.every((b) => close(b.ratingKw, unit)), 'Q4', `${K}: unit ${unit} kW ≠ the EPMS LV sheet's UPS ratings ${bats.map((b) => b.ratingKw)}`);
      }
      /* where the engine states the load of a mode, the walk must equal it: UPS normal and 2N failover */
      if (K === 'ups') sc.steps.forEach((s, i) => {
        const want = s.running === snap.electrical.ups_system_count ? snap.electrical.ups_load_pct_normal : s.running === snap.electrical.ups_system_count - 1 ? snap.electrical.ups_load_pct_on_failover : null;
        if (want !== null) ok(close(s.part_load_pct, want), 'Q4', `${K}/${sc.id} step ${i}: part load ${s.part_load_pct} % ≠ engine ${want} % with ${s.running} systems`);
      });
    });
  }
}

/* Q5 */
const TW = path.join(ROOT, 'js/rz-sequences.js');
ok(fs.existsSync(TW) && built && fs.readFileSync(TW, 'utf8') === twin(built), 'Q5', 'js/rz-sequences.js is missing or stale: node tools/build-sequences.mjs --apply');

if (fails.length) { console.log(`FAIL sequences — ${fails.length} of ${fails.length + passes}`); fails.slice(0, 30).forEach((f) => console.log('  ' + f)); process.exit(1); }
console.log(`PASS sequences — ${passes} checks (Q1 entry/actions/exit, Q2 graph, Q3 no typed threshold + assumed listed, Q4 scenario walk, Q5 twin fresh)`);
