/*
 * Contract tests for the DC AI electrical topology/state engine.
 * Run: node tools/test-datahall-ai-electrical-topology.mjs
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = path.join(
  __dirname,
  '..',
  'js',
  'datahall-ai',
  'electrical-topology.js'
);

assert.equal(
  existsSync(MODULE_PATH),
  true,
  'electrical-topology.js must exist before its behavior can pass'
);

const require = createRequire(import.meta.url);
const Electrical = require(MODULE_PATH);

function deepFrozen(value) {
  if (value === null || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.keys(value).every((key) => deepFrozen(value[key]));
}

function edge(result, id) {
  const found = result.edges.find((item) => item.id === id);
  assert.ok(found, `edge ${id} exists`);
  return found;
}

function rack(result, id = 'RACK-01') {
  assert.ok(result.racks[id], `rack ${id} exists`);
  return result.racks[id];
}

function testTopologyContract() {
  assert.ok(deepFrozen(Electrical.BASE_TOPOLOGY), 'base topology is deeply frozen');
  assert.ok(deepFrozen(Electrical.SCENARIOS), 'scenario definitions are deeply frozen');

  const nodeIds = Electrical.BASE_TOPOLOGY.nodes.map((node) => node.id);
  assert.equal(new Set(nodeIds).size, nodeIds.length, 'node ids are unique');
  assert.equal(
    Electrical.BASE_TOPOLOGY.nodes.filter((node) => node.type === 'rack').length,
    54,
    'locked Scenario A exposes 54 physical rack endpoints per hall'
  );

  const knownIds = new Set(nodeIds);
  Electrical.BASE_TOPOLOGY.edges.forEach((item) => {
    assert.ok(knownIds.has(item.from), `${item.id} from endpoint exists`);
    assert.ok(knownIds.has(item.to), `${item.id} to endpoint exists`);
  });

  ['RMU-A', 'RMU-B', 'GEN-BUS'].forEach((id) => {
    assert.ok(knownIds.has(id), `${id} exists in the physical distribution path`);
  });
  const paths = new Set(
    Electrical.BASE_TOPOLOGY.edges.map((item) => `${item.from}>${item.to}`)
  );
  [
    'SRC-UTILITY-A>MV-BUS-A',
    'MV-BUS-A>RMU-A',
    'RMU-A>TX-A',
    'TX-A>ATS-A',
    'SRC-GENSET-POOL>GEN-BUS',
    'GEN-BUS>ATS-A',
    'ATS-A>MSB-A'
  ].forEach((segment) => assert.ok(paths.has(segment), `${segment} is explicitly modelled`));
}

function testNormalTwoNReachability() {
  const result = Electrical.evaluateScenario('normal');
  const selectedRack = rack(result);

  assert.equal(result.scenarioId, 'normal');
  assert.equal(selectedRack.feedA.available, true);
  assert.equal(selectedRack.feedB.available, true);
  assert.equal(selectedRack.dualCordContinuity, true);
  assert.equal(selectedRack.serviceAvailable, true);
  assert.equal(selectedRack.redundancyState, '2N');
  assert.deepEqual(selectedRack.feedA.sourceIds, ['SRC-UTILITY-A']);
  assert.deepEqual(selectedRack.feedB.sourceIds, ['SRC-UTILITY-B']);
  assert.equal(
    Object.values(result.racks).every((item) => item.dualCordContinuity),
    true,
    'every normal rack retains independent A and B reachability'
  );

  const rackAEdge = edge(result, 'EDGE-RPP-A-RACK-01');
  assert.equal(rackAEdge.semanticState, 'energized');
  assert.equal(rackAEdge.flowActive, true, 'only a loaded energized edge requests motion');
  assert.deepEqual(rackAEdge.sourceIds, ['SRC-UTILITY-A']);
  assert.equal(typeof rackAEdge.flowActive, 'boolean', 'flow truth is data, not a CSS class');
}

function testAutomaticSourceTransfer() {
  const result = Electrical.evaluateScenario('utility_a_fail');
  const selectedRack = rack(result);

  assert.equal(selectedRack.dualCordContinuity, true);
  assert.deepEqual(selectedRack.feedA.sourceIds, ['SRC-GENSET-POOL']);
  assert.deepEqual(selectedRack.feedB.sourceIds, ['SRC-UTILITY-B']);
  assert.equal(result.state.ats['ATS-A'].selectedSource, 'generator');
  assert.equal(result.state.sources['SRC-GENSET-POOL'].state, 'running');
}

function testDegradedButAvailableScenarios() {
  const buswayTrip = Electrical.evaluateScenario('busway_a_trip');
  assert.equal(rack(buswayTrip).feedA.available, false);
  assert.equal(rack(buswayTrip).feedB.available, true);
  assert.equal(rack(buswayTrip).serviceAvailable, true);
  assert.equal(rack(buswayTrip).redundancyState, 'DEGRADED');
  assert.equal(
    edge(buswayTrip, 'EDGE-UPS-A-BUSWAY-A').semanticState,
    'fault',
    'the tripped controlling device makes the affected line faulted'
  );

  const bypass = Electrical.evaluateScenario('ups_a_bypass');
  assert.equal(rack(bypass).dualCordContinuity, true, 'UPS bypass remains conductive');
  assert.equal(bypass.state.ups['UPS-A'], 'bypass');
  assert.equal(bypass.health, 'DEGRADED');

  const generatorFailure = Electrical.evaluateScenario('genset_pool_start_failure');
  assert.equal(rack(generatorFailure).feedA.available, false);
  assert.equal(rack(generatorFailure).feedB.available, true);

  const transferFailure = Electrical.evaluateScenario('transfer_failure');
  assert.equal(rack(transferFailure).feedA.available, false);
  assert.equal(rack(transferFailure).feedB.available, true);
}

function testRackLocalFailureDoesNotSpread() {
  const result = Electrical.evaluateScenario('rack_psu_a_loss');
  assert.equal(rack(result, 'RACK-01').feedA.available, false);
  assert.equal(rack(result, 'RACK-01').feedB.available, true);
  assert.equal(rack(result, 'RACK-02').dualCordContinuity, true);
  assert.equal(
    edge(result, 'EDGE-RPP-A-RACK-01').semanticState,
    'fault',
    'the failed rack PSU feed is faulted locally'
  );
  assert.equal(edge(result, 'EDGE-RPP-A-RACK-02').semanticState, 'energized');
}

function testCommonSourceIsNotTwoN() {
  const result = Electrical.evaluateScenario('normal', {
    sources: {
      'SRC-UTILITY-A': { state: 'unavailable' },
      'SRC-UTILITY-B': { state: 'unavailable' },
      'SRC-GENSET-POOL': { state: 'running' }
    },
    ats: {
      'ATS-A': { state: 'normal', selectedSource: 'generator' },
      'ATS-B': { state: 'normal', selectedSource: 'generator' }
    }
  });
  const selectedRack = rack(result);

  assert.equal(selectedRack.dualCordContinuity, true, 'both physical cords remain live');
  assert.equal(selectedRack.sourceDiversity, false, 'both cords share the common genset source');
  assert.equal(selectedRack.redundancyState, 'COMMON_SOURCE');
  assert.equal(result.health, 'DEGRADED');
}

function testStateAndInputImmutability() {
  const overrides = { breakers: { 'BR-BUSWAY-A': 'open' } };
  const before = JSON.stringify(overrides);
  const state = Electrical.createState('normal', overrides);
  const result = Electrical.evaluate(state);

  assert.equal(JSON.stringify(overrides), before, 'caller overrides are not mutated');
  assert.ok(deepFrozen(state), 'scenario state is deeply frozen');
  assert.ok(deepFrozen(result), 'evaluation result is deeply frozen');
  assert.equal(rack(result).feedA.available, false);
  assert.equal(rack(result).feedB.available, true);
  assert.equal(Electrical.createState('normal').breakers['BR-BUSWAY-A'], 'closed');
}

function testValidationAndDeterminism() {
  assert.throws(
    () => Electrical.createState('unknown'),
    /Unknown electrical scenario/,
    'unknown scenarios fail at the boundary'
  );
  assert.throws(
    () => Electrical.createState('normal', { ups: { 'UPS-A': 'invented' } }),
    /Invalid UPS state/,
    'unknown UPS states fail at the boundary'
  );
  assert.throws(
    () => Electrical.createState('normal', { breakers: { 'BR-NOT-REAL': 'closed' } }),
    /Unknown breaker/,
    'unknown devices fail at the boundary'
  );
  assert.throws(
    () => Electrical.createState('normal', { visualClass: 'energized' }),
    /Unknown state section/,
    'presentation data cannot become an unvalidated source of truth'
  );
  assert.throws(
    () => Electrical.createState('normal', { breakers: null }),
    /breakers must be an object/,
    'malformed state maps fail with a bounded validation error'
  );

  const incomplete = JSON.parse(JSON.stringify(Electrical.createState('normal')));
  delete incomplete.breakers['BR-BUSWAY-A'];
  assert.throws(
    () => Electrical.evaluate(incomplete),
    /Missing breaker: BR-BUSWAY-A/,
    'every topology controller must have an explicit state'
  );

  const malformedNested = JSON.parse(JSON.stringify(Electrical.createState('normal')));
  malformedNested.ats['ATS-A'] = null;
  assert.throws(
    () => Electrical.evaluate(malformedNested),
    /ATS-A must be an object/,
    'nested device state shapes are validated before traversal'
  );

  const first = Electrical.evaluateScenario('utility_b_fail');
  const second = Electrical.evaluateScenario('utility_b_fail');
  assert.deepEqual(first, second, 'scenario output and event timeline are deterministic');
  assert.ok(first.timeline.length >= 3, 'transfer scenario includes an operator event timeline');
  assert.deepEqual(
    first.timeline.map((event) => event.offsetSeconds),
    [...first.timeline.map((event) => event.offsetSeconds)].sort((a, b) => a - b),
    'timeline is ordered by deterministic offset'
  );
}

testTopologyContract();
testNormalTwoNReachability();
testAutomaticSourceTransfer();
testDegradedButAvailableScenarios();
testRackLocalFailureDoesNotSpread();
testCommonSourceIsNotTwoN();
testStateAndInputImmutability();
testValidationAndDeterminism();

console.log('PASS: DC AI electrical topology/state invariants');
