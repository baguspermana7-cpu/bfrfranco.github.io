/*
 * Four-second electrical telemetry gate.
 *
 * The basis fixture is BUILT FROM THE ENGINE SNAPSHOT, not typed: the previous version
 * pinned 3,564 / 4,638 / 8 gensets, which stayed green after the basis moved. Every
 * rendered string below is composed from the same snapshot the cockpit binds to.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const ElectricalLive = require('../js/datahall-ai/electrical-live.js');
const Electrical = require('../js/datahall-ai/electrical-topology.js');
const snapshot = require('../js/dcai-engine.js').snapshot;
const cockpitSource = await readFile(new URL('../datahallAI.html', import.meta.url), 'utf8');

const round0 = (value) => Math.round(value);
const HALLS = snapshot.compute.racks_facility / snapshot.compute.racks_per_hall;
const El = snapshot.design.electrical;

/* how many generator glyphs the SLD overview draws — a DRAWING property, deliberately
   independent of the 171-machine pool so MAX_RENDERED_EQUIPMENT can never truncate it */
const GLYPHS = 8;

const basis = Object.freeze({
  halls: HALLS,
  itHall: round0(snapshot.power.total_it_hall_kwe),
  itFacilityMW: Number(snapshot.power.total_it_mw.toFixed(2)),
  pb_aux: round0(El.aux_kwe / HALLS),
  pb_cooling: round0(El.cooling_kwe / HALLS),
  pb_facility: round0(El.facility_kwe / HALLS),
  facTotalMW: Number((El.facility_kwe / 1000).toFixed(2)),
  pue: Number(snapshot.pue.design_day.toFixed(2)),
  reqCurrentA: round0(
    (snapshot.power.total_it_hall_kwe * 1000) /
    (Math.sqrt(3) * snapshot.distribution.voltage_ll_v * snapshot.distribution.power_factor)
  ),
  gensetFacN: snapshot.equipment.gensets_duty,
  gensetFacNplus1: snapshot.equipment.gensets_installed,
  gensetGlyphCount: GLYPHS,
});

const INSTALLED = basis.gensetFacNplus1;
const DUTY = basis.gensetFacN;
const withCommas = (value) => String(round0(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function fakeDocument(scenarioId = 'normal') {
  const elements = Object.create(null);
  const ids = [
    'electricalScenario', 'eLive', 'eOvNC', 'eOvCool', 'eOvGenPoolTitle',
    ...Array.from({ length: HALLS }, (_, index) => index + 1).flatMap((hall) => [
      `eOvIT${hall}`, `eDH${hall}Live`, `eNC${hall}`, `eCool${hall}`,
    ]),
    ...Array.from({ length: GLYPHS }, (_, index) => `eOvGen${index + 1}`),
  ];
  ids.forEach((id) => { elements[id] = { textContent: '' }; });
  elements.electricalScenario.value = scenarioId;
  return {
    elements,
    document: { getElementById(id) { return elements[id] || null; } },
  };
}

test('snapshot is locked to the engine basis and semantic scenario', () => {
  const value = ElectricalLive.snapshot(basis, Electrical, 'utility_a_fail');

  assert.equal(value.itPerHallKW, basis.itHall);
  assert.equal(value.facilityPerHallKW, basis.pb_facility);
  assert.equal(value.itFacilityMW, basis.itFacilityMW);
  assert.equal(value.facilityMW, basis.facTotalMW);
  assert.equal(value.pue, basis.pue);
  assert.equal(value.generatorState, 'RUNNING');

  /* the MACHINE list is whole — one entry per installed genset, duty running, spares standby */
  assert.equal(value.generatorCount, INSTALLED);
  assert.equal(value.generatorStates.length, INSTALLED);
  assert.equal(value.generatorRunningCount, DUTY);
  assert.equal(value.generatorStandbyCount, INSTALLED - DUTY);
  assert.equal(value.generatorFailedCount, 0);
  assert.equal(value.generatorStates[0], 'RUNNING');
  assert.equal(value.generatorStates[INSTALLED - 1], 'STANDBY');

  /* the GLYPH list is what the drawing owns — banks, never truncation */
  assert.equal(value.generatorGlyphCount, GLYPHS);
  assert.equal(value.generatorGlyphStates.length, GLYPHS);
  assert.ok(value.generatorGlyphStates.every((state) => state === 'RUNNING'),
    'every drawn bank contains at least one running machine at N duty');
  assert.equal(
    value.generatorHeading,
    `GENERATOR POOL STATUS (${DUTY} RUN / ${INSTALLED - DUTY} STANDBY)`
  );

  assert.equal(value.scenarioId, 'utility_a_fail');
  assert.equal(Object.isFrozen(value.generatorStates), true);
  assert.equal(Object.isFrozen(value), true);
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

  for (let hall = 1; hall <= HALLS; hall += 1) {
    assert.equal(elements[`eOvIT${hall}`].textContent, `${withCommas(basis.itHall)} kW`);
    assert.equal(
      elements[`eDH${hall}Live`].textContent,
      `IT: ${withCommas(basis.itHall)} kW | Facility: ${withCommas(basis.pb_facility)} kW | PUE: ${basis.pue.toFixed(2)}`
    );
    assert.equal(elements[`eNC${hall}`].textContent, `${withCommas(basis.pb_aux)} kW`);
    assert.equal(elements[`eCool${hall}`].textContent, `${withCommas(basis.pb_cooling)} kW`);
  }
  assert.equal(elements.eOvNC.textContent, `${withCommas(basis.pb_aux * HALLS)} kW facility`);
  assert.equal(elements.eOvCool.textContent, `${withCommas(basis.pb_cooling * HALLS)} kW facility`);
  assert.equal(
    elements.eLive.textContent,
    `IT: ${basis.itFacilityMW.toFixed(2)} MW | Facility: ${basis.facTotalMW.toFixed(2)} MW | ` +
    `PUE: ${basis.pue.toFixed(2)} | ${HALLS} DH Online`
  );
  for (let glyph = 1; glyph <= GLYPHS; glyph += 1) {
    assert.equal(elements[`eOvGen${glyph}`].textContent, 'RUNNING');
  }
  assert.equal(
    elements.eOvGenPoolTitle.textContent,
    `GENERATOR POOL STATUS (${DUTY} RUN / ${INSTALLED - DUTY} STANDBY)`
  );
});

test('normal scenario keeps the generator pool in standby', () => {
  const { document, elements } = fakeDocument('normal');
  ElectricalLive.render(document, ElectricalLive.snapshot(basis, Electrical, 'normal'));
  assert.equal(elements.eOvGen1.textContent, 'STANDBY');
  assert.equal(elements[`eOvGen${GLYPHS}`].textContent, 'STANDBY');
  assert.equal(
    elements.eOvGenPoolTitle.textContent,
    `GENERATOR POOL STATUS (0 RUN / ${INSTALLED} STANDBY)`
  );
});

test('generator start failure reports every failed unit', () => {
  const { document, elements } = fakeDocument('genset_pool_start_failure');
  ElectricalLive.render(
    document,
    ElectricalLive.snapshot(basis, Electrical, 'genset_pool_start_failure')
  );
  for (let glyph = 1; glyph <= GLYPHS; glyph += 1) {
    assert.equal(elements[`eOvGen${glyph}`].textContent, 'FAILED');
  }
  assert.equal(
    elements.eOvGenPoolTitle.textContent,
    `GENERATOR POOL STATUS (0 RUN / 0 STANDBY / ${INSTALLED} FAILED)`
  );
});

test('a 171-machine pool never truncates the 8 drawn glyphs', () => {
  const value = ElectricalLive.snapshot(basis, Electrical, 'utility_a_fail');
  assert.ok(value.generatorCount > value.generatorGlyphCount * 8,
    'the machine count is far larger than the glyph count — the split is the point');
  const { document, elements } = fakeDocument('utility_a_fail');
  ElectricalLive.render(document, value);
  assert.equal(elements[`eOvGen${GLYPHS}`].textContent, 'RUNNING', 'the last drawn bank is written');
  /* without a glyph count the module used to loop to generatorCount and write ids that
     do not exist; the drawing owns its own count, and a default is still bounded */
  const withoutGlyphs = { ...basis };
  delete withoutGlyphs.gensetGlyphCount;
  assert.equal(ElectricalLive.snapshot(withoutGlyphs, Electrical, 'normal').generatorGlyphCount, GLYPHS);
  assert.throws(
    () => ElectricalLive.snapshot({ ...basis, gensetGlyphCount: 0 }, Electrical, 'normal'),
    /Invalid electrical live basis: gensetGlyphCount/
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
  assert.equal(elements.eOvIT1.textContent, `${withCommas(basis.itHall)} kW`);

  scheduledTick();

  for (let hall = 1; hall <= HALLS; hall += 1) {
    assert.equal(elements[`eOvIT${hall}`].textContent, 'UNAVAILABLE');
    assert.equal(elements[`eDH${hall}Live`].textContent, 'UNAVAILABLE');
    assert.equal(elements[`eNC${hall}`].textContent, 'UNAVAILABLE');
    assert.equal(elements[`eCool${hall}`].textContent, 'UNAVAILABLE');
  }
  for (let glyph = 1; glyph <= GLYPHS; glyph += 1) {
    assert.equal(elements[`eOvGen${glyph}`].textContent, 'UNAVAILABLE');
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
    () => ElectricalLive.snapshot({ ...basis, gensetFacN: INSTALLED }, Electrical, 'normal'),
    /Invalid electrical live basis/
  );
  assert.throws(
    () => ElectricalLive.snapshot(basis, Electrical, 'not-a-scenario'),
    /Unknown electrical scenario/
  );
});

test('cockpit delegates its four-second basis update to the semantic module', () => {
  assert.match(cockpitSource, /js\/datahall-ai\/electrical-live\.js\?v=[\d.]+/);
  assert.match(cockpitSource, /RZDatahallAIElectricalLive\.start\(\{/);
  assert.match(cockpitSource, /basis:DHE/);
  assert.match(cockpitSource, /electricalApi:window\.RZDatahallAIElectrical/);
  assert.match(cockpitSource, /intervalMs:4000/);
  assert.doesNotMatch(cockpitSource, /RI\(7050,7200\)/);
  assert.doesNotMatch(cockpitSource, /Math\.random\(\)>\.95\?'RUNNING':'STANDBY'/);
  assert.doesNotMatch(cockpitSource, /R\(28\.0,28\.8\)/);
  /* the keys the page's DHE object must keep supplying — renaming one silently blanks
     the live strip, so the contract is asserted from this side too */
  ['halls', 'itHall', 'itFacilityMW', 'pb_aux', 'pb_cooling', 'pb_facility',
    'facTotalMW', 'pue', 'reqCurrentA', 'gensetFacN', 'gensetFacNplus1'].forEach((key) => {
    assert.ok(Object.prototype.hasOwnProperty.call(basis, key), `basis key ${key} is part of the contract`);
    assert.match(cockpitSource, new RegExp(`${key}\\s*:`), `datahallAI.html still publishes ${key} on DHE`);
  });
});
