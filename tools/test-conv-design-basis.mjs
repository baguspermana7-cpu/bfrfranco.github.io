#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const MODULE_PATH = join(ROOT, 'js', 'conv-design-basis.js');
const source = readFileSync(MODULE_PATH, 'utf8');
const pageSource = readFileSync(join(ROOT, 'dc-conventional.html'), 'utf8');
const api = await import(`file://${MODULE_PATH}?test=${Date.now()}`)
  .then(() => globalThis.RZConvDesignBasis);

function mutableStudy() {
  return JSON.parse(JSON.stringify(api.STUDY_INPUT));
}

test('module exposes the same explicit API in browser and CommonJS paths', () => {
  assert.ok(api);
  assert.equal(typeof api.reconcileStudy, 'function');
  assert.equal(typeof api.evaluateLoad, 'function');
  assert.equal(typeof api.airHeatRemovalKw, 'function');

  const context = { globalThis: {} };
  vm.runInNewContext(source, context, { filename: MODULE_PATH });
  assert.equal(typeof context.globalThis.RZConvDesignBasis.reconcileStudy, 'function');
});

test('baseline study and every nested contract are deeply immutable', () => {
  assert.equal(Object.isFrozen(api.STUDY_INPUT), true);
  assert.equal(Object.isFrozen(api.STUDY_INPUT.rack), true);
  assert.equal(Object.isFrozen(api.STUDY_INPUT.resilience.subsystems), true);
  assert.equal(Object.isFrozen(api.STUDY), true);
  assert.equal(Object.isFrozen(api.STUDY.checks), true);
});

test('four-hall air-cooled study reconciles 40 MW IT at 500 racks per hall', () => {
  assert.equal(api.STUDY.hallCount, 4);
  assert.equal(api.STUDY.itKwPerHall, 10_000);
  assert.equal(api.STUDY.totalItKw, 40_000);
  assert.equal(api.STUDY.racksPerHall, 500);
  assert.equal(api.STUDY.totalRacks, 2_000);
  assert.equal(api.STUDY.averageRackKw, 20);
  assert.equal(api.STUDY.coolingTechnology, 'air-chw-crah');
  assert.equal(api.STUDY.thermalInspectorMode, 'air');
  assert.equal(api.STUDY.readyForDisciplineSizing, true);
});

test('200 racks at 10 MW is blocked under the selected air-cooling contract', () => {
  const input = mutableStudy();
  input.rack.countPerHall = 200;
  const result = api.reconcileStudy(input);
  assert.equal(result.averageRackKw, 50);
  assert.equal(result.checks.densityCoolingCoupled.pass, false);
  assert.match(result.checks.densityCoolingCoupled.detail, /50\.00 kW\/rack/);
  assert.equal(result.readyForDisciplineSizing, false);

  const load = api.evaluateLoad(input, 1);
  assert.equal(load.status, 'unavailable');
  assert.match(load.reason, /discipline sizing/i);
  assert.equal('facilityKw' in load, false);
});

test('hall, thermal, air, and resilience boundaries reject malformed contracts', () => {
  const duplicateHall = mutableStudy();
  duplicateHall.halls = ['A', 'A'];
  assert.throws(() => api.reconcileStudy(duplicateHall), /unique/i);

  const fractionalRacks = mutableStudy();
  fractionalRacks.rack.countPerHall = 500.5;
  assert.throws(() => api.reconcileStudy(fractionalRacks), /integer/i);

  const invertedEnvelope = mutableStudy();
  invertedEnvelope.cooling.rackInletRecommendedMinC = 28;
  invertedEnvelope.cooling.rackInletRecommendedMaxC = 27;
  assert.throws(() => api.reconcileStudy(invertedEnvelope), /ordered/i);

  const targetOutsideEnvelope = mutableStudy();
  targetOutsideEnvelope.cooling.rackInletTargetC = 29;
  assert.throws(() => api.reconcileStudy(targetOutsideEnvelope), /inside/i);

  const invalidCp = mutableStudy();
  invalidCp.airReference.cpKjKgK = 'unknown';
  assert.throws(() => api.reconcileStudy(invalidCp), /specific heat/i);

  const missingResilience = mutableStudy();
  delete missingResilience.resilience.subsystems.water;
  assert.throws(() => api.reconcileStudy(missingResilience), /exactly/i);
});

test('rack peak and selected average must support the derived per-rack load', () => {
  const input = mutableStudy();
  input.rack.selectedPeakKw = 19;
  const result = api.reconcileStudy(input);
  assert.equal(result.checks.rackContractReconciled.pass, false);
  assert.equal(result.readyForDisciplineSizing, false);
  assert.equal(api.evaluateLoad(input, 1).status, 'unavailable');
});

test('design-point dPUE is usable while off-design load fails closed without a curve', () => {
  const design = api.evaluateLoad(api.STUDY_INPUT, 1);
  assert.equal(design.status, 'available');
  assert.equal(design.metric, 'dPUE');
  assert.equal(design.itKw, 40_000);
  assert.equal(design.pue, 1.45);
  assert.equal(design.facilityKw, 58_000);

  const part = api.evaluateLoad(api.STUDY_INPUT, 0.75);
  assert.equal(part.status, 'unavailable');
  assert.match(part.reason, /approved part-load curve/i);
  assert.equal('facilityKw' in part, false);
});

test('an approved monotonic load curve is interpolated without mutating it', () => {
  const curve = [
    { loadFraction: 0.5, pue: 1.55 },
    { loadFraction: 1, pue: 1.45 },
  ];
  const before = JSON.stringify(curve);
  const result = api.evaluateLoad(api.STUDY_INPUT, 0.75, curve);
  assert.equal(result.status, 'available');
  assert.equal(result.evidenceClass, 'ASSUMED');
  assert.equal(result.itKw, 30_000);
  assert.equal(result.pue, 1.5);
  assert.equal(result.facilityKw, 45_000);
  assert.equal(JSON.stringify(curve), before);
});

test('invalid or incomplete part-load curves are rejected', () => {
  assert.throws(
    () => api.evaluateLoad(api.STUDY_INPUT, 0.75, [{ loadFraction: 1, pue: 1.45 }]),
    /at least two points/,
  );
  assert.throws(
    () => api.evaluateLoad(api.STUDY_INPUT, 0.75, [
      { loadFraction: 1, pue: 1.45 },
      { loadFraction: 0.5, pue: 1.55 },
    ]),
    /strictly increasing/,
  );
});

test('air-side heat removal uses explicit pressure, temperature, RH, density, and cp', () => {
  const air = api.STUDY_INPUT.airReference;
  assert.equal(air.dryBulbC, 25.4);
  assert.equal(air.pressureKpa, 101.325);
  assert.equal(air.relativeHumidityPct, 50);
  assert.equal(air.cpKjKgK, 1.006);
  assert.ok(api.STUDY.airDensityKgM3 > 1.16 && api.STUDY.airDensityKgM3 < 1.19);
  const heatKw = api.airHeatRemovalKw(100, 10, air);
  assert.ok(heatKw > 1_160 && heatKw < 1_200);
});

test('heat-rejection type controls whether an evaporative water balance applies', () => {
  assert.equal(api.STUDY.heatRejectionType, 'evaporative-cooling-tower');
  assert.equal(api.STUDY.evaporativeWaterBalanceRequired, true);

  const dry = mutableStudy();
  dry.water.heatRejectionType = 'dry-cooler';
  const result = api.reconcileStudy(dry);
  assert.equal(result.evaporativeWaterBalanceRequired, false);
});

test('campus resilience is declared once and propagated by subsystem', () => {
  const resilience = api.STUDY_INPUT.resilience;
  assert.equal(resilience.intent, 'concurrently-maintainable');
  assert.equal(resilience.certificationClaimed, false);
  assert.equal(resilience.subsystems.electrical, '2N');
  assert.equal(resilience.subsystems.cooling, 'N+1');
  assert.equal(resilience.subsystems.generator, 'N+1');
  assert.equal(api.STUDY.resilienceIntent, resilience.intent);
});

test('reconciliation never mutates caller input and rejects unsafe numeric bounds', () => {
  const input = mutableStudy();
  const before = JSON.stringify(input);
  api.reconcileStudy(input);
  assert.equal(JSON.stringify(input), before);

  input.capacity.itKwPerHall = Number.MAX_VALUE;
  assert.throws(() => api.reconcileStudy(input), /safe engineering bound/);
});

test('Conventional Design Studio loads and renders the governed study basis', () => {
  const basisAt = pageSource.indexOf('js/conv-design-basis.js');
  const studioAt = pageSource.indexOf('js/rz-design-studio.js');
  assert.ok(basisAt > 0, 'page must load the governed study basis');
  assert.ok(basisAt < studioAt, 'study basis must load before Design Studio registration');
  assert.match(pageSource, /RZConvDesignBasis\.STUDY/);
  assert.match(pageSource, /study\.racksPerHall\+' racks per hall/);
  assert.match(pageSource, /Off-design facility load unavailable without an approved curve/);
  assert.doesNotMatch(
    pageSource,
    /<td>Planned IT per hall<\/td><td class="v">10\.000 MW<\/td>/,
    'study table must not duplicate the governed module values',
  );
});
