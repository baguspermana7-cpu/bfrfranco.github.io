#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const topology = require('../js/datahall-ai/electrical-topology.js');
const visual = require('../js/datahall-ai/electrical-visual-map.js');

function descriptor(lineId, extra = {}) {
  return { lineId, ...extra };
}

const normal = topology.evaluateScenario('normal');
const utilityAFail = topology.evaluateScenario('utility_a_fail');
const buswayATrip = topology.evaluateScenario('busway_a_trip');
const rackPsuALoss = topology.evaluateScenario('rack_psu_a_loss');

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

assert.equal(visual.projectLine(descriptor('dh1-busway-a', {
  hall: 'dh01', edgeId: 'EDGE-BUSWAY-A-RPP-A'
}), buswayATrip, 'dh01').active, false);
assert.equal(visual.projectLine(descriptor('dh1-rack-bank-a', {
  hall: 'dh01', edgePrefix: 'EDGE-RPP-A-RACK-'
}), rackPsuALoss, 'dh01').partial, true);

assert.deepEqual(visual.hallCounts(normal.racks, 'dh01'), {
  total: 54, available: 54, twoN: 54, degraded: 0, lost: 0
});
assert.deepEqual(visual.hallCounts(normal.racks, 'overview'), {
  total: 216, available: 216, twoN: 216, degraded: 0, lost: 0
});

const html = readFileSync(new URL('../datahallAI.html', import.meta.url), 'utf8');
assert.match(html, /electrical-visual-map\.js\?v=1\.130\.0/);
assert.match(html, /data-topology-edge=/);
assert.match(html, /data-topology-prefix=/);
assert.doesNotMatch(html, /GB200 NVL72 72×1 reference/);

console.log('PASS datahall AI electrical visual projection: explicit map, hall scope, fail-closed state, and facility counts');
