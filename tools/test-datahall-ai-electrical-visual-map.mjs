#!/usr/bin/env node
/*
 * Explicit-projection gate for the AI SLD conductors.
 *
 * Every count here is READ FROM THE ENGINE SNAPSHOT. The previous version pinned 54 and
 * 216 by hand, which is exactly how a gate stays green on a retired basis.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const topology = require('../js/datahall-ai/electrical-topology.js');
const visual = require('../js/datahall-ai/electrical-visual-map.js');
const snapshot = require('../js/dcai-engine.js').snapshot;

const RACKS_PER_HALL = snapshot.compute.racks_per_hall;
const RACKS_FACILITY = snapshot.compute.racks_facility;
const HALLS = RACKS_FACILITY / RACKS_PER_HALL;

/* the ?v= the cockpit must load these modules at once it adopts the aggregated ids */
const ASSET_VERSION = '2.0.0';

function descriptor(lineId, extra = {}) {
  return { lineId, ...extra };
}

const normal = topology.evaluateScenario('normal');
const utilityAFail = topology.evaluateScenario('utility_a_fail');
const buswayATrip = topology.evaluateScenario('busway_a_trip');
const rackPsuALoss = topology.evaluateScenario('rack_psu_a_loss');

assert.equal(visual.version, '2.0.0');
assert.equal(visual.HALL_COUNT, HALLS, 'the hall count is read from the engine, not typed');

assert.equal(visual.projectLine(descriptor('elec-pln-a-to-meter'), normal, 'overview').active, true);
assert.equal(visual.projectLine(descriptor('elec-pln-a-to-meter'), utilityAFail, 'overview').active, false);
assert.equal(visual.projectLine(descriptor('elec-pln-b-to-meter'), utilityAFail, 'overview').active, true);
assert.deepEqual(
  visual.projectLine(descriptor('dh1-genset-a-to-ats', {
    hall: 'dh01', edgeId: 'EDGE-GEN-BUS-ATS-A'
  }), utilityAFail, 'dh01').sourceIds,
  ['SRC-GENSET-POOL']
);

assert.equal(visual.projectLine(descriptor('dh1-bus-tie'), normal, 'dh01').semanticState, 'open');
assert.equal(visual.projectLine(descriptor('unknown-conductor'), normal, 'overview').active, false);
assert.equal(visual.projectLine(descriptor('dh2-rmu-bus-b-drop'), normal, 'dh01').semanticState, 'out-of-scope');
assert.equal(visual.projectLine(descriptor('dh1-rmu-bus-b-drop'), normal, 'dh01').active, true);
assert.equal(visual.projectLine(descriptor('dh1-bus-to-fa'), normal, 'dh01').active, true);
assert.equal(visual.projectLine(descriptor('dh1-fa-to-rmu-drop'), normal, 'dh01').active, true);
assert.equal(visual.projectLine(descriptor('dh1-rmu-input-b'), normal, 'dh01').active, true);

/* one group feeder, bound by its explicit edge id */
assert.equal(visual.projectLine(descriptor('dh1-busway-a-rpp-07', {
  hall: 'dh01', edgeId: 'EDGE-BUSWAY-A-RPP-A-07'
}), buswayATrip, 'dh01').active, false);
assert.equal(visual.projectLine(descriptor('dh1-rpp-a-07', {
  hall: 'dh01', edgeId: 'EDGE-RPP-A-07-RG-07'
}), normal, 'dh01').active, true);

/* the whole feed-A bank, bound by prefix: 40 group feeders, not 880 rack cords */
const bankA = visual.projectLine(descriptor('dh1-rack-bank-a', {
  hall: 'dh01', edgePrefix: 'EDGE-RPP-A-'
}), normal, 'dh01');
assert.equal(bankA.edgeIds.length, snapshot.geometry.rack_groups_per_hall);
assert.equal(bankA.partial, false);
assert.equal(bankA.servedRacks, RACKS_PER_HALL, 'the bank serves every rack in the hall on feed A');

const bankAFaulted = visual.projectLine(descriptor('dh1-rack-bank-a', {
  hall: 'dh01', edgePrefix: 'EDGE-RPP-A-'
}), rackPsuALoss, 'dh01');
assert.equal(bankAFaulted.partial, true, 'a faulted rack cord inside a fed group still makes the bank partial');
assert.equal(bankAFaulted.semanticState, 'partially-energized');
assert.equal(bankAFaulted.faultedRacks, 1);
assert.equal(bankAFaulted.servedRacks, RACKS_PER_HALL - 1);

const bankATripped = visual.projectLine(descriptor('dh1-rack-bank-a', {
  hall: 'dh01', edgePrefix: 'EDGE-RPP-A-'
}), buswayATrip, 'dh01');
assert.equal(bankATripped.active, false, 'a tripped busway takes the whole feed-A bank down');

assert.deepEqual(visual.hallCounts(normal.racks, 'dh01'), {
  total: RACKS_PER_HALL, available: RACKS_PER_HALL, twoN: RACKS_PER_HALL, degraded: 0, lost: 0
});
assert.deepEqual(visual.hallCounts(normal.racks, 'overview'), {
  total: RACKS_FACILITY, available: RACKS_FACILITY, twoN: RACKS_FACILITY, degraded: 0, lost: 0
});
assert.deepEqual(visual.hallCounts(rackPsuALoss.racks, 'dh01'), {
  total: RACKS_PER_HALL, available: RACKS_PER_HALL, twoN: RACKS_PER_HALL - 1, degraded: 1, lost: 0
});
assert.deepEqual(visual.hallCounts(buswayATrip.racks, 'dh01'), {
  total: RACKS_PER_HALL, available: RACKS_PER_HALL, twoN: 0, degraded: RACKS_PER_HALL, lost: 0
});
assert.throws(
  () => visual.hallCounts({ 'RG-01': { id: 'RG-01', serviceAvailable: true, redundancyState: '2N' } }, 'dh01'),
  /aggregated topology is required/,
  'a pre-2.0.0 result shape fails closed instead of reporting a plausible small number'
);

/* ── the cockpit's own script tags ──────────────────────────────────────────
   All three electrical modules must load at ONE cache token (a split token is how a
   fix reaches some pages and not others). Once datahallAI.html adopts the aggregated
   edge ids — the `EDGE-RPP-<feed>-` prefix without the retired `-RACK-` tail — that
   token must be the module version itself. */
const html = readFileSync(new URL('../datahallAI.html', import.meta.url), 'utf8');
const tokens = ['electrical-topology.js', 'electrical-live.js', 'electrical-visual-map.js']
  .map((file) => {
    const match = html.match(new RegExp(`js/datahall-ai/${file.replace('.', '\\.')}\\?v=([\\d.]+)`));
    assert.ok(match, `${file} is loaded with an explicit ?v= cache token`);
    return match[1];
  });
assert.equal(new Set(tokens).size, 1, `the three electrical modules share one ?v= token (got ${tokens.join(', ')})`);

const pageUsesRetiredRackPrefix = /EDGE-RPP-'\+feed\+'-RACK-/.test(html);
if (!pageUsesRetiredRackPrefix) {
  assert.equal(tokens[0], ASSET_VERSION,
    `the page has adopted the aggregated edge ids, so it must load them at ?v=${ASSET_VERSION}`);
  assert.match(html, /data-topology-prefix=/);
} else {
  assert.ok(true, `page still draws per-rack bindings — WP3 rebinds it to EDGE-RPP-<feed>- and bumps ?v= to ${ASSET_VERSION}`);
}
assert.match(html, /data-topology-edge=/);
assert.doesNotMatch(html, /GB200 NVL72 72×1 reference/);

console.log(
  'PASS datahall AI electrical visual projection: explicit map, hall scope, fail-closed state, ' +
  `and facility counts (${RACKS_PER_HALL}/hall x ${HALLS} halls = ${RACKS_FACILITY} racks)` +
  (pageUsesRetiredRackPrefix ? ` — page still at ?v=${tokens[0]}, strict at ?v=${ASSET_VERSION} once WP3 rebinds it` : '')
);
