import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const ElectricalLive = require('../js/datahall-ai/electrical-live.js');
const Electrical = require('../js/datahall-ai/electrical-topology.js');
const cockpitSource = await readFile(new URL('../datahallAI.html', import.meta.url), 'utf8');

const basis = Object.freeze({
  halls: 4,
  itHall: 3564,
  itHallFmt: '3,564',
  itFacilityMW: 14.26,
  pb_aux: 75,
  pb_cooling: 849,
  pb_facility: 4638,
  pb_facilityFmt: '4,638',
  facTotalMW: 18.55,
  pue: 1.30,
  reqCurrentA: 5359,
  gensetFacN: 7,
  gensetFacNplus1: 8,
});

function fakeDocument(scenarioId = 'normal') {
  const elements = Object.create(null);
  const ids = [
    'electricalScenario', 'eLive', 'eOvNC', 'eOvCool', 'eOvGenPoolTitle',
    ...Array.from({ length: 4 }, (_, index) => index + 1).flatMap((hall) => [
      `eOvIT${hall}`, `eDH${hall}Live`, `eNC${hall}`, `eCool${hall}`,
    ]),
    ...Array.from({ length: 8 }, (_, index) => `eOvGen${index + 1}`),
  ];
  ids.forEach((id) => { elements[id] = { textContent: '' }; });
  elements.electricalScenario.value = scenarioId;
  return {
    elements,
    document: { getElementById(id) { return elements[id] || null; } },
  };
}

test('snapshot is locked to the engine basis and semantic scenario', () => {
  const snapshot = ElectricalLive.snapshot(basis, Electrical, 'utility_a_fail');

  assert.equal(snapshot.itPerHallKW, 3564);
  assert.equal(snapshot.facilityPerHallKW, 4638);
  assert.equal(snapshot.itFacilityMW, 14.26);
  assert.equal(snapshot.facilityMW, 18.55);
  assert.equal(snapshot.pue, 1.30);
  assert.equal(snapshot.generatorState, 'RUNNING');
  assert.deepEqual(snapshot.generatorStates, [
    'RUNNING', 'RUNNING', 'RUNNING', 'RUNNING',
    'RUNNING', 'RUNNING', 'RUNNING', 'STANDBY',
  ]);
  assert.equal(snapshot.generatorRunningCount, 7);
  assert.equal(snapshot.generatorStandbyCount, 1);
  assert.equal(Object.isFrozen(snapshot.generatorStates), true);
  assert.equal(snapshot.scenarioId, 'utility_a_fail');
  assert.equal(Object.isFrozen(snapshot), true);
});

test('four-second updater renders basis values without random overwrite', () => {
  const { document, elements } = fakeDocument('utility_a_fail');
  let intervalMs = null;
  let scheduledTick = null;
  const intervalId = ElectricalLive.start({
    document,
    basis,
    electricalApi: Electrical,
    setIntervalFn(callback, delay) {
      scheduledTick = callback;
      intervalMs = delay;
      return 41;
    },
  });

  assert.equal(intervalId, 41);
  assert.equal(intervalMs, 4000);
  assert.equal(typeof scheduledTick, 'function');
  scheduledTick();

  for (let hall = 1; hall <= 4; hall += 1) {
    assert.equal(elements[`eOvIT${hall}`].textContent, '3,564 kW');
    assert.equal(
      elements[`eDH${hall}Live`].textContent,
      'IT: 3,564 kW | Facility: 4,638 kW | PUE: 1.30'
    );
    assert.equal(elements[`eNC${hall}`].textContent, '75 kW');
    assert.equal(elements[`eCool${hall}`].textContent, '849 kW');
  }
  assert.equal(elements.eOvNC.textContent, '300 kW facility');
  assert.equal(elements.eOvCool.textContent, '3,396 kW facility');
  assert.equal(elements.eLive.textContent, 'IT: 14.26 MW | Facility: 18.55 MW | PUE: 1.30 | 4 DH Online');
  for (let generator = 1; generator <= 7; generator += 1) {
    assert.equal(elements[`eOvGen${generator}`].textContent, 'RUNNING');
  }
  assert.equal(elements.eOvGen8.textContent, 'STANDBY');
  assert.equal(elements.eOvGenPoolTitle.textContent, 'GENERATOR POOL STATUS (7 RUN / 1 STANDBY)');
});

test('normal scenario keeps the generator pool in standby', () => {
  const { document, elements } = fakeDocument('normal');
  ElectricalLive.render(document, ElectricalLive.snapshot(basis, Electrical, 'normal'));
  assert.equal(elements.eOvGen1.textContent, 'STANDBY');
  assert.equal(elements.eOvGen8.textContent, 'STANDBY');
  assert.equal(elements.eOvGenPoolTitle.textContent, 'GENERATOR POOL STATUS (0 RUN / 8 STANDBY)');
});

test('generator start failure reports every failed unit', () => {
  const { document, elements } = fakeDocument('genset_pool_start_failure');
  ElectricalLive.render(
    document,
    ElectricalLive.snapshot(basis, Electrical, 'genset_pool_start_failure')
  );
  for (let generator = 1; generator <= 8; generator += 1) {
    assert.equal(elements[`eOvGen${generator}`].textContent, 'FAILED');
  }
  assert.equal(
    elements.eOvGenPoolTitle.textContent,
    'GENERATOR POOL STATUS (0 RUN / 0 STANDBY / 8 FAILED)'
  );
});

test('runtime failure invalidates every module-owned operational field', () => {
  const { document, elements } = fakeDocument('normal');
  let scheduledTick = null;
  let evaluations = 0;
  const failingElectrical = {
    evaluateScenario(scenarioId) {
      evaluations += 1;
      if (evaluations > 1) { throw new Error('telemetry link lost'); }
      return Electrical.evaluateScenario(scenarioId);
    },
  };
  ElectricalLive.start({
    document,
    basis,
    electricalApi: failingElectrical,
    setIntervalFn(callback) {
      scheduledTick = callback;
      return 42;
    },
  });
  assert.equal(elements.eOvIT1.textContent, '3,564 kW');

  scheduledTick();

  for (let hall = 1; hall <= 4; hall += 1) {
    assert.equal(elements[`eOvIT${hall}`].textContent, 'UNAVAILABLE');
    assert.equal(elements[`eDH${hall}Live`].textContent, 'UNAVAILABLE');
    assert.equal(elements[`eNC${hall}`].textContent, 'UNAVAILABLE');
    assert.equal(elements[`eCool${hall}`].textContent, 'UNAVAILABLE');
  }
  for (let generator = 1; generator <= 8; generator += 1) {
    assert.equal(elements[`eOvGen${generator}`].textContent, 'UNAVAILABLE');
  }
  assert.equal(elements.eOvNC.textContent, 'UNAVAILABLE');
  assert.equal(elements.eOvCool.textContent, 'UNAVAILABLE');
  assert.equal(elements.eOvGenPoolTitle.textContent, 'GENERATOR POOL STATUS (UNAVAILABLE)');
  assert.equal(elements.eLive.textContent, 'Electrical telemetry unavailable — values invalidated');
});

test('invalid external inputs fail closed at the module boundary', () => {
  assert.throws(
    () => ElectricalLive.snapshot({ ...basis, itHall: Number.NaN }, Electrical, 'normal'),
    /Invalid electrical live basis/
  );
  assert.throws(
    () => ElectricalLive.snapshot({ ...basis, gensetFacN: 8 }, Electrical, 'normal'),
    /Invalid electrical live basis/
  );
  assert.throws(
    () => ElectricalLive.snapshot(basis, Electrical, 'not-a-scenario'),
    /Unknown electrical scenario/
  );
});

test('cockpit delegates its four-second basis update to the semantic module', () => {
  assert.match(cockpitSource, /js\/datahall-ai\/electrical-live\.js\?v=1\.130\.0/);
  assert.match(cockpitSource, /RZDatahallAIElectricalLive\.start\(\{/);
  assert.match(cockpitSource, /basis:DHE/);
  assert.match(cockpitSource, /electricalApi:window\.RZDatahallAIElectrical/);
  assert.match(cockpitSource, /intervalMs:4000/);
  assert.doesNotMatch(cockpitSource, /RI\(7050,7200\)/);
  assert.doesNotMatch(cockpitSource, /Math\.random\(\)>\.95\?'RUNNING':'STANDBY'/);
  assert.doesNotMatch(cockpitSource, /R\(28\.0,28\.8\)/);
});
