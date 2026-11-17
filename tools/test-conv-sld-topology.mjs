#!/usr/bin/env node
/* test-conv-sld-topology.mjs — js/conv/sld-topology.js (PRD-CONV-LIVING-PLANT §8.1). node --test
   S1 radial feed: everything energised; each branch carries the load below it; source = total load
   S2 an open breaker de-energises what is behind it and that load draws 0
   S3 bus balance: kW in = kW out at every bus (±1e-6) in every switching state of a 2-incomer + tie scheme
   S4 two sources on one bus share by rating; losing one moves all load to the other and flags an overload
   S5 a dead island (no available source) is de-energised even with every breaker closed
   S6 a closed ring: every node energised, the second path is reported as loop, balance still holds on the tree
   S7 a branch to an unknown node throws; the result is the same on a second call (pure) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = createRequire(import.meta.url)(path.join(ROOT, 'js/conv/sld-topology.js'));

/* grid A/B -> transformers -> bus A / bus B with a tie; two loads per bus */
function scheme(st) {
  return {
    nodes: [{ id: 'gridA', kind: 'source', ratingKw: 60000 }, { id: 'gridB', kind: 'source', ratingKw: 60000, available: st.gridB !== false },
      { id: 'busA', kind: 'bus' }, { id: 'busB', kind: 'bus' },
      { id: 'L1', kind: 'load', kw: 12000 }, { id: 'L2', kind: 'load', kw: 9750 }, { id: 'L3', kind: 'load', kw: 12000 }, { id: 'L4', kind: 'load', kw: 9750 }],
    branches: [{ id: 'incA', a: 'gridA', b: 'busA', closed: st.incA }, { id: 'incB', a: 'gridB', b: 'busB', closed: st.incB },
      { id: 'tie', a: 'busA', b: 'busB', closed: st.tie },
      { id: 'f1', a: 'busA', b: 'L1', closed: true }, { id: 'f2', a: 'busA', b: 'L2', closed: true },
      { id: 'f3', a: 'busB', b: 'L3', closed: true }, { id: 'f4', a: 'busB', b: 'L4', closed: st.f4 !== false }]
  };
}

test('S1 radial', () => {
  const m = scheme({ incA: true, incB: true, tie: false }), r = S.solve(m);
  for (const n of m.nodes) assert.equal(r.nodes[n.id].energised, true, n.id);
  assert.equal(r.branches.incA.kw, 21750); assert.equal(r.branches.incA.from, 'gridA'); assert.equal(r.branches.incA.to, 'busA');
  assert.equal(r.branches.f1.kw, 12000); assert.equal(r.sources.gridA.kw, 21750);
  assert.equal(r.branches.tie.energised, false);
});
test('S2 open breaker', () => {
  const r = S.solve(scheme({ incA: true, incB: true, tie: false, f4: false }));
  assert.equal(r.nodes.L4.energised, false); assert.equal(r.branches.f4.kw, 0); assert.equal(r.sources.gridB.kw, 12000);
});
test('S3 bus balance in every switching state', () => {
  for (const incA of [true, false]) for (const incB of [true, false]) for (const tie of [true, false]) {
    const m = scheme({ incA, incB, tie }), r = S.solve(m);
    for (const bus of ['busA', 'busB']) {
      const b = S.busBalance(m, r, bus);
      assert.ok(Math.abs(b) < 1e-6, `${incA}/${incB}/${tie} ${bus} imbalance ${b}`);
    }
    const src = r.sources.gridA.kw + r.sources.gridB.kw, load = m.nodes.filter((n) => n.kind === 'load' && r.nodes[n.id].energised).reduce((a, n) => a + n.kw, 0);
    assert.ok(Math.abs(src - load) < 1e-6, 'sources = energised load');
  }
});
test('S4 sharing and loss of a source', () => {
  const both = S.solve(scheme({ incA: true, incB: true, tie: true }));
  assert.equal(both.sources.gridA.kw, 21750); assert.equal(both.sources.gridB.kw, 21750);
  const one = S.solve(scheme({ incA: true, incB: false, tie: true }));
  assert.equal(one.sources.gridA.kw, 43500); assert.equal(one.sources.gridB.kw, 0);
  assert.equal(one.branches.tie.kw, 21750); assert.equal(one.branches.tie.from, 'busA');
  const m = scheme({ incA: true, incB: false, tie: true }); m.nodes[0].ratingKw = 40000;
  assert.equal(S.solve(m).sources.gridA.overload, true);
  const uneven = scheme({ incA: true, incB: true, tie: true }); uneven.nodes[0].ratingKw = 30000;
  const u = S.solve(uneven); assert.ok(Math.abs(u.sources.gridA.kw - 43500 / 3) < 1e-6 && Math.abs(u.sources.gridB.kw - 43500 * 2 / 3) < 1e-6);
});
test('S5 dead island', () => {
  const r = S.solve(scheme({ incA: false, incB: true, tie: true, gridB: false }));
  for (const id of ['busA', 'busB', 'L1', 'L4']) assert.equal(r.nodes[id].energised, false, id);
  assert.equal(r.branches.f1.kw, 0);
});
test('S6 closed ring', () => {
  const m = { nodes: [{ id: 'g', kind: 'source', ratingKw: 100 }, { id: 'a', kind: 'bus' }, { id: 'b', kind: 'bus' }, { id: 'c', kind: 'bus' }, { id: 'l', kind: 'load', kw: 40 }],
    branches: [{ id: 'ga', a: 'g', b: 'a', closed: true }, { id: 'ab', a: 'a', b: 'b', closed: true }, { id: 'bc', a: 'b', b: 'c', closed: true }, { id: 'ca', a: 'c', b: 'a', closed: true }, { id: 'cl', a: 'c', b: 'l', closed: true }] };
  const r = S.solve(m);
  for (const n of m.nodes) assert.equal(r.nodes[n.id].energised, true);
  assert.equal(Object.values(r.branches).filter((b) => b.loop).length, 1);
  for (const bus of ['a', 'b', 'c']) assert.ok(Math.abs(S.busBalance(m, r, bus)) < 1e-6, bus);
  assert.equal(r.branches.cl.kw, 40);
});
test('S7 guard + purity', () => {
  assert.throws(() => S.solve({ nodes: [{ id: 'x', kind: 'bus' }], branches: [{ id: 'q', a: 'x', b: 'nope', closed: true }] }));
  const m = scheme({ incA: true, incB: true, tie: true });
  assert.deepEqual(S.solve(m), S.solve(m));
});
