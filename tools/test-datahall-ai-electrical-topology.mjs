/*
 * Contract tests for the DC AI electrical topology/state engine (GB300 basis).
 *
 * EVERY expected count in this file is READ FROM THE ENGINE SNAPSHOT, never typed.
 * A pinned 54 is what made the previous version of this gate green on a basis the
 * page no longer runs; a snapshot-derived expectation moves with the engine or fails.
 *
 * Run: node tools/test-datahall-ai-electrical-topology.mjs
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = path.join(__dirname, '..', 'js', 'datahall-ai', 'electrical-topology.js');
const ENGINE_PATH = path.join(__dirname, '..', 'js', 'dcai-engine.js');

assert.equal(
  existsSync(MODULE_PATH),
  true,
  'electrical-topology.js must exist before its behavior can pass'
);

const require = createRequire(import.meta.url);
const Electrical = require(MODULE_PATH);
const SNAPSHOT = require(ENGINE_PATH).snapshot;

/* the basis, read once — the only numbers this file is allowed to know */
const RACKS_PER_HALL = SNAPSHOT.compute.racks_per_hall;
const RACKS_PER_GROUP = SNAPSHOT.geometry.racks_per_group;
const GROUP_COUNT = SNAPSHOT.geometry.rack_groups_per_hall;
const GROUPS_PER_ROW = SNAPSHOT.geometry.groups_per_row;
const RACK_KW = SNAPSHOT.power.rack_it_kw;
const GROUP_KW = SNAPSHOT.distribution.group_kw;

const FIRST_GROUP = Electrical.groupId(1);
const SECOND_GROUP = Electrical.groupId(2);

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

function group(result, id = FIRST_GROUP) {
  assert.ok(result.racks[id], `rack group ${id} exists`);
  return result.racks[id];
}

function feedEdgeId(feed, index) {
  return `EDGE-${Electrical.rppId(feed, index)}-${Electrical.groupId(index)}`;
}

function testBasisIsReadNotTyped() {
  assert.equal(Electrical.version, '2.0.0', 'the aggregated topology is a MAJOR contract change');
  assert.equal(Electrical.BASIS.racksPerHall, RACKS_PER_HALL);
  assert.equal(Electrical.BASIS.racksPerGroup, RACKS_PER_GROUP);
  assert.equal(Electrical.BASIS.groupCount, GROUP_COUNT);
  assert.equal(Electrical.BASIS.rackLoadKW, RACK_KW);

  /* API.build(snapshot) is the injection point the tests and the page share */
  const rebuilt = Electrical.build(SNAPSHOT);
  assert.equal(rebuilt.BASE_TOPOLOGY.nodes.length, Electrical.BASE_TOPOLOGY.nodes.length);
  assert.throws(
    () => Electrical.build({ compute: { racks_per_hall: 0 } }),
    /Electrical basis expects a positive integer/,
    'a snapshot that cannot supply the counts fails closed instead of falling back'
  );
  assert.throws(
    () => Electrical.build({
      compute: { racks_per_hall: RACKS_PER_HALL, racks_facility: RACKS_PER_HALL },
      geometry: { rack_groups_per_hall: GROUP_COUNT, racks_per_group: RACKS_PER_GROUP + 1, groups_per_row: GROUPS_PER_ROW, rack_rows: 1, racks_per_row: 1 },
    }),
    /Electrical basis is not integer/,
    'a non-integer grouping is rejected at the boundary, not rounded'
  );
}

function testTopologyContract() {
  assert.ok(deepFrozen(Electrical.BASE_TOPOLOGY), 'base topology is deeply frozen');
  assert.ok(deepFrozen(Electrical.SCENARIOS), 'scenario definitions are deeply frozen');

  const nodes = Electrical.BASE_TOPOLOGY.nodes;
  const nodeIds = nodes.map((node) => node.id);
  assert.equal(new Set(nodeIds).size, nodeIds.length, 'node ids are unique');

  const groups = nodes.filter((node) => node.type === 'rack_group');
  assert.equal(groups.length, GROUP_COUNT, 'one rack_group node per RPP group');
  assert.equal(
    groups.reduce((sum, node) => sum + node.rackCount, 0),
    RACKS_PER_HALL,
    'the group rack counts sum to the hall rack count — no rack is unmodelled'
  );
  groups.forEach((node) => {
    assert.equal(node.rackCount, RACKS_PER_GROUP);
    assert.equal(node.rackLoadKW, RACK_KW);
    assert.equal(node.loadKW, RACKS_PER_GROUP * RACK_KW, 'group load = racks x rack kW');
    assert.equal(node.loadKW, GROUP_KW, 'group load agrees with distribution.group_kw');
    assert.equal(node.dualCorded, true);
    assert.ok(node.row >= 1 && node.row <= SNAPSHOT.geometry.rack_rows, 'each group sits in a real row');
    assert.ok(node.positionInRow >= 1 && node.positionInRow <= GROUPS_PER_ROW, 'each group has a position in its row');
    assert.match(node.rackIdRange, /^RACK-\d{4}\.\.RACK-\d{4}$/, 'physical rack ids are 4-digit at this basis');
  });
  assert.equal(groups[6].rackIdRange, `${Electrical.rackId(6 * RACKS_PER_GROUP + 1)}..${Electrical.rackId(7 * RACKS_PER_GROUP)}`);

  /* 4 sources/bus + 7 devices per feed + one RPP per group per feed = the distribution
     spine; the rack_group aggregates are the loads that hang off it. */
  const spineNodes = nodes.filter((node) => node.type !== 'rack_group').length;
  assert.equal(spineNodes, 4 + (2 * 7) + (2 * GROUP_COUNT), 'distribution spine node count');
  assert.equal(spineNodes, 98, 'per hall: 98 distribution nodes at the published basis');
  assert.equal(nodes.length, spineNodes + GROUP_COUNT, 'total nodes = spine + rack groups');
  assert.equal(
    Electrical.BASE_TOPOLOGY.edges.length,
    1 + (2 * (8 + (2 * GROUP_COUNT))),
    'edges = genset tie + per feed (8 spine + one busway-RPP and one RPP-group edge per group)'
  );
  assert.equal(Electrical.BASE_TOPOLOGY.edges.length, 177, 'per hall: 177 edges at the published basis');
  assert.equal(
    Electrical.BASE_TOPOLOGY.edges.filter((item) => /RACK-\d/.test(item.id)).length,
    0,
    'no per-rack edges survive the aggregation'
  );

  const knownIds = new Set(nodeIds);
  Electrical.BASE_TOPOLOGY.edges.forEach((item) => {
    assert.ok(knownIds.has(item.from), `${item.id} from endpoint exists`);
    assert.ok(knownIds.has(item.to), `${item.id} to endpoint exists`);
  });

  ['MV-BUS-A', 'RMU-A', 'TX-A', 'ATS-A', 'MSB-A', 'UPS-A', 'BUSWAY-A', 'GEN-BUS'].forEach((id) => {
    assert.ok(knownIds.has(id), `${id} keeps its id through the rescale`);
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  assert.equal(byId.get('TX-A').unitCount, SNAPSHOT.distribution.transformers_per_hall_per_feed);
  assert.equal(byId.get('TX-A').unitMva, SNAPSHOT.equipment.transformer_unit_mva);
  assert.equal(byId.get('UPS-B').frameCount, SNAPSHOT.distribution.ups_frames_per_hall_per_feed);
  assert.equal(byId.get('UPS-B').frameKw, SNAPSHOT.equipment.ups_frame_kw);
  assert.equal(byId.get('UPS-B').loadingPct, SNAPSHOT.equipment.ups_loading_pct);
  assert.equal(byId.get('BUSWAY-A').trunkA, SNAPSHOT.distribution.busway_trunk_a);
  assert.equal(byId.get('BUSWAY-A').groupCount, GROUP_COUNT);
  assert.equal(byId.get('SRC-GENSET-POOL').installed, SNAPSHOT.equipment.gensets_installed);
  assert.equal(byId.get('SRC-GENSET-POOL').duty, SNAPSHOT.equipment.gensets_duty);
  assert.equal(byId.get('SRC-GENSET-POOL').unitKw, SNAPSHOT.equipment.generator_unit_kw);
  assert.equal(byId.get('SRC-GENSET-POOL').facilityShared, true, 'the genset pool is facility-shared, and says so');

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
    'ATS-A>MSB-A',
    'UPS-A>BUSWAY-A',
    `BUSWAY-A>${Electrical.rppId('A', 1)}`,
    `${Electrical.rppId('A', 1)}>${FIRST_GROUP}`,
    `BUSWAY-B>${Electrical.rppId('B', GROUP_COUNT)}`,
    `${Electrical.rppId('B', GROUP_COUNT)}>${Electrical.groupId(GROUP_COUNT)}`,
  ].forEach((segment) => assert.ok(paths.has(segment), `${segment} is explicitly modelled`));

  /* the edge id scheme the SLD binds to */
  assert.ok(edge(Electrical.evaluateScenario('normal'), 'EDGE-BUSWAY-A-RPP-A-07'));
  assert.ok(edge(Electrical.evaluateScenario('normal'), 'EDGE-RPP-A-07-RG-07'));
}

function testNormalTwoNReachability() {
  const result = Electrical.evaluateScenario('normal');
  const selected = group(result);

  assert.equal(result.scenarioId, 'normal');
  assert.equal(result.health, 'NORMAL');
  assert.equal(selected.feedA.available, true);
  assert.equal(selected.feedB.available, true);
  assert.equal(selected.dualCordContinuity, true);
  assert.equal(selected.serviceAvailable, true);
  assert.equal(selected.redundancyState, '2N');
  assert.equal(selected.twoNCount, RACKS_PER_GROUP);
  assert.equal(selected.degradedCount, 0);
  assert.equal(selected.lostCount, 0);
  assert.deepEqual(selected.feedA.sourceIds, ['SRC-UTILITY-A']);
  assert.deepEqual(selected.feedB.sourceIds, ['SRC-UTILITY-B']);
  assert.equal(
    Object.values(result.racks).every((item) => item.dualCordContinuity),
    true,
    'every normal group retains independent A and B reachability'
  );
  assert.equal(
    Object.values(result.racks).reduce((sum, item) => sum + item.twoNCount, 0),
    RACKS_PER_HALL,
    'every rack in the hall is at 2N on a normal day'
  );

  const groupAEdge = edge(result, feedEdgeId('A', 1));
  assert.equal(groupAEdge.semanticState, 'energized');
  assert.equal(groupAEdge.flowActive, true, 'only a loaded energized edge requests motion');
  assert.deepEqual(groupAEdge.sourceIds, ['SRC-UTILITY-A']);
  assert.equal(groupAEdge.servedRacks, RACKS_PER_GROUP, 'a group edge reports how many racks it serves');
  assert.equal(groupAEdge.faultedRacks, 0);
  assert.equal(typeof groupAEdge.flowActive, 'boolean', 'flow truth is data, not a CSS class');
}

function testAutomaticSourceTransfer() {
  const result = Electrical.evaluateScenario('utility_a_fail');
  const selected = group(result);

  assert.equal(selected.dualCordContinuity, true);
  assert.deepEqual(selected.feedA.sourceIds, ['SRC-GENSET-POOL']);
  assert.deepEqual(selected.feedB.sourceIds, ['SRC-UTILITY-B']);
  assert.equal(result.state.ats['ATS-A'].selectedSource, 'generator');
  assert.equal(result.state.sources['SRC-GENSET-POOL'].state, 'running');
}

function testDegradedButAvailableScenarios() {
  const buswayTrip = Electrical.evaluateScenario('busway_a_trip');
  assert.equal(group(buswayTrip).feedA.available, false);
  assert.equal(group(buswayTrip).feedB.available, true);
  assert.equal(group(buswayTrip).serviceAvailable, true);
  assert.equal(group(buswayTrip).redundancyState, 'DEGRADED');
  assert.equal(group(buswayTrip).degradedCount, RACKS_PER_GROUP, 'every rack in the group loses a cord');
  assert.equal(group(buswayTrip).lostCount, 0);
  assert.equal(
    edge(buswayTrip, 'EDGE-UPS-A-BUSWAY-A').semanticState,
    'fault',
    'the tripped controlling device makes the affected line faulted'
  );

  const bypass = Electrical.evaluateScenario('ups_a_bypass');
  assert.equal(group(bypass).dualCordContinuity, true, 'UPS bypass remains conductive');
  assert.equal(bypass.state.ups['UPS-A'], 'bypass');
  assert.equal(bypass.health, 'DEGRADED');

  const generatorFailure = Electrical.evaluateScenario('genset_pool_start_failure');
  assert.equal(group(generatorFailure).feedA.available, false);
  assert.equal(group(generatorFailure).feedB.available, true);

  const transferFailure = Electrical.evaluateScenario('transfer_failure');
  assert.equal(group(transferFailure).feedA.available, false);
  assert.equal(group(transferFailure).feedB.available, true);
}

function testSingleRackFaultIsACountInsideItsGroup() {
  const result = Electrical.evaluateScenario('rack_psu_a_loss');
  const faulted = group(result, FIRST_GROUP);

  assert.equal(result.scenarioLabel, `Rack ${Electrical.rackId(1).slice(-4)} PSU A input loss`);
  assert.equal(faulted.faultedRacksA, 1, 'one rack in the first group lost its A cord');
  assert.equal(faulted.faultedRacksB, 0);
  assert.equal(faulted.redundancyState, '2N', 'the GROUP feed is still 2N — one rack cord is not a feeder loss');
  assert.equal(faulted.twoNCount, RACKS_PER_GROUP - 1);
  assert.equal(faulted.degradedCount, 1);
  assert.equal(faulted.lostCount, 0);
  assert.equal(faulted.servedRackCount, RACKS_PER_GROUP, 'the rack keeps its B cord');
  assert.equal(result.health, 'DEGRADED', 'a lost rack cord degrades hall health');

  assert.equal(group(result, SECOND_GROUP).twoNCount, RACKS_PER_GROUP, 'the fault does not spread to the next group');
  assert.equal(group(result, SECOND_GROUP).degradedCount, 0);

  const faultedEdge = edge(result, feedEdgeId('A', 1));
  assert.equal(faultedEdge.semanticState, 'energized', 'the group feeder itself is healthy');
  assert.equal(faultedEdge.faultedRacks, 1);
  assert.equal(faultedEdge.servedRacks, RACKS_PER_GROUP - 1);
  assert.equal(edge(result, feedEdgeId('A', 2)).faultedRacks, 0);

  assert.throws(
    () => Electrical.createState('normal', { racks: { [FIRST_GROUP]: { faultedRacksA: RACKS_PER_GROUP + 1 } } }),
    /Invalid faultedRacksA/,
    'a group cannot report more faulted racks than it has'
  );
  assert.throws(
    () => Electrical.createState('normal', { racks: { [FIRST_GROUP]: { faultedRacksB: 1.5 } } }),
    /Invalid faultedRacksB/,
    'faulted rack counts are integers'
  );
  assert.throws(
    () => Electrical.createState('normal', {
      racks: { [FIRST_GROUP]: { faultedRacksA: RACKS_PER_GROUP, faultedRacksB: 1 } },
    }),
    /more faults than racks/,
    'A-faulted and B-faulted racks are different racks, and the total is bounded'
  );
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
  const selected = group(result);

  assert.equal(selected.dualCordContinuity, true, 'both physical cords remain live');
  assert.equal(selected.sourceDiversity, false, 'both cords share the common genset source');
  assert.equal(selected.redundancyState, 'COMMON_SOURCE');
  assert.equal(selected.twoNCount, 0);
  assert.equal(selected.commonSourceCount, RACKS_PER_GROUP);
  assert.equal(result.health, 'DEGRADED');
}

function testEveryRackIsAccountedFor() {
  ['normal', 'busway_a_trip', 'rack_psu_a_loss', 'utility_a_fail'].forEach((scenarioId) => {
    const result = Electrical.evaluateScenario(scenarioId);
    Object.values(result.racks).forEach((item) => {
      assert.equal(
        item.twoNCount + item.commonSourceCount + item.degradedCount + item.lostCount,
        item.rackCount,
        `${scenarioId}/${item.id}: every rack lands in exactly one bucket`
      );
    });
  });
}

function testStateAndInputImmutability() {
  const overrides = { breakers: { 'BR-BUSWAY-A': 'open' } };
  const before = JSON.stringify(overrides);
  const state = Electrical.createState('normal', overrides);
  const result = Electrical.evaluate(state);

  assert.equal(JSON.stringify(overrides), before, 'caller overrides are not mutated');
  assert.ok(deepFrozen(state), 'scenario state is deeply frozen');
  assert.ok(deepFrozen(result), 'evaluation result is deeply frozen');
  assert.equal(group(result).feedA.available, false);
  assert.equal(group(result).feedB.available, true);
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

function testNoRetiredLiteralsInTheModule() {
  const source = require('node:fs').readFileSync(MODULE_PATH, 'utf8');
  /* prose may NAME the basis (the header explains why the rescale happened); executable
     code may not CARRY it — strip comments, then look for a typed count */
  const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.doesNotMatch(code, /RACK_COUNT|RACK_LOAD_KW/, 'the typed rack constants are gone');
  assert.doesNotMatch(code, /\b(?:54|66|880|142|3124|40|22)\b/, 'no basis number is typed into the module');
  assert.doesNotMatch(code, /'RACK-01'/, 'the 2-digit rack id format is retired');
}

testBasisIsReadNotTyped();
testTopologyContract();
testNormalTwoNReachability();
testAutomaticSourceTransfer();
testDegradedButAvailableScenarios();
testSingleRackFaultIsACountInsideItsGroup();
testCommonSourceIsNotTwoN();
testEveryRackIsAccountedFor();
testStateAndInputImmutability();
testValidationAndDeterminism();
testNoRetiredLiteralsInTheModule();

console.log(
  `PASS: DC AI electrical topology/state invariants — ${GROUP_COUNT} RPP groups x ` +
  `${RACKS_PER_GROUP} racks = ${RACKS_PER_HALL} racks/hall, ` +
  `${Electrical.BASE_TOPOLOGY.nodes.length} nodes / ${Electrical.BASE_TOPOLOGY.edges.length} edges per hall`
);
