import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.join(here, '..', 'js', 'datahall-ai', 'rack-density.js');
const modelPath = path.join(here, '..', 'js', 'datahall-model.js');
const require = createRequire(import.meta.url);
const MODEL = require(modelPath);

let RackDensity = null;
let loadError = '';
try {
  RackDensity = require(modulePath);
} catch (error) {
  loadError = error instanceof Error ? error.message : String(error);
}

const skipWhenMissing = () => !RackDensity;

test('rack-density module exists and exposes the public API', () => {
  assert.ok(RackDensity, `rack-density.js failed to load: ${loadError}`);
  assert.equal(typeof RackDensity.reconcile, 'function');
  assert.equal(typeof RackDensity.getBaseline, 'function');
  assert.equal(typeof RackDensity.getReference, 'function');
  assert.equal(typeof RackDensity.studyReference, 'function');
  assert.equal(typeof RackDensity.validateInput, 'function');
});

test('browser-global path attaches the same explicit API', { skip: skipWhenMissing() }, () => {
  const sandbox = { window: {}, globalThis: {}, DATAHALL_MODEL: MODEL };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(readFileSync(modulePath, 'utf8'), sandbox, { filename: 'rack-density.js' });
  assert.equal(typeof sandbox.RZDataHallRackDensity.reconcile, 'function');
});

test('baseline is derived from the injected canonical model rather than duplicated constants', { skip: skipWhenMissing() }, () => {
  const injectedModel = {
    specVersion: 'test-model-v1',
    authority: 'test-only canonical fixture',
    facility: {
      halls: 3,
      nvl72PerHall: 10,
      racksPerNVL72: 3,
      racksPerHall: 30
    },
    locked: {
      kwPerNVL72: 150,
      kwPerRack: 50,
      itPerHall_kW: 1500,
      itPerFacility_kW: 4500
    },
    geometry: { lengthM: 30, widthM: 20 }
  };
  const sandbox = { window: {}, globalThis: {}, DATAHALL_MODEL: injectedModel };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(readFileSync(modulePath, 'utf8'), sandbox, { filename: 'rack-density.js' });
  const baseline = sandbox.RZDataHallRackDensity.getBaseline();
  assert.equal(baseline.halls, 3);
  assert.equal(baseline.logicalDomainKW, 150);
  assert.equal(baseline.rackPositionsPerDomain, 3);
  assert.equal(baseline.rackPositionsPerHall, 30);
  assert.equal(baseline.itPerHallKW, 1500);
  assert.equal(baseline.hallAreaM2, 600);
  assert.equal(baseline.hallItDensityKWPerM2, 2.5);
  assert.equal(baseline.itPerFacilityKW, 4500);
  assert.equal(baseline.modelSpecVersion, 'test-model-v1');
});

test('locked baseline reconciles every rack-density identity exactly', { skip: skipWhenMissing() }, () => {
  const baseline = RackDensity.getBaseline();
  assert.equal(baseline.architectureId, 'project-gb200-nvl72-split-domain');
  assert.equal(baseline.architectureName, 'Project GB200 NVL72 split-domain basis');
  assert.equal(baseline.logicalDomainKW, 132);
  assert.equal(baseline.rackPositionsPerDomain, 2);
  assert.equal(baseline.rackPositionKW, 66);
  assert.equal(baseline.logicalDomainsPerHall, 27);
  assert.equal(baseline.rackPositionsPerHall, 54);
  assert.equal(baseline.itPerHallKW, 3564);
  assert.equal(baseline.hallAreaM2, 640);
  assert.equal(baseline.hallItDensityKWPerM2, 5.56875);
  assert.equal(baseline.halls, 4);
  assert.equal(baseline.itPerFacilityKW, 14256);
  assert.equal(baseline.status, 'BOD_LOCKED');
  assert.equal(baseline.modelSpecVersion, MODEL.specVersion);
  assert.equal(baseline.logicalDomainKW, MODEL.locked.kwPerNVL72);
  assert.equal(baseline.rackPositionsPerDomain, MODEL.facility.racksPerNVL72);
  assert.equal(baseline.logicalDomainsPerHall, MODEL.facility.nvl72PerHall);
  assert.equal(baseline.hallAreaM2, MODEL.geometry.lengthM * MODEL.geometry.widthM);
});

test('baseline and nested reference data are deeply immutable', { skip: skipWhenMissing() }, () => {
  const baseline = RackDensity.getBaseline();
  const gb300 = RackDensity.getReference('gb300-nvl72-142kw-study');
  assert.equal(Object.isFrozen(RackDensity.BASELINE), true);
  assert.equal(Object.isFrozen(RackDensity.REFERENCES), true);
  assert.equal(Object.isFrozen(baseline), true);
  assert.equal(Object.isFrozen(gb300), true);
  assert.equal(Object.isFrozen(gb300.provenance), true);
});

test('reconcile reports transparent arithmetic and all checks pass', { skip: skipWhenMissing() }, () => {
  const result = RackDensity.reconcile({
    architectureId: 'gb200-nvl72-72x1', halls: 4,
    logicalDomainKW: 132, rackPositionsPerDomain: 2,
    logicalDomainsPerHall: 27, hallAreaM2: 640
  });
  assert.equal(result.rackPositionKW, 66);
  assert.equal(result.rackPositionsPerHall, 54);
  assert.equal(result.itPerHallKW, 3564);
  assert.equal(result.hallItDensityKWPerM2, 5.56875);
  assert.equal(result.itPerFacilityKW, 14256);
  assert.equal(result.allChecksPass, true);
  assert.ok(result.checks.every((check) => check.pass));
});

test('reconcile validates all numeric boundaries and does not mutate input', { skip: skipWhenMissing() }, () => {
  const input = Object.freeze({
    architectureId: 'custom-study', halls: 4,
    logicalDomainKW: 140, rackPositionsPerDomain: 2,
    logicalDomainsPerHall: 27, hallAreaM2: 640
  });
  const snapshot = JSON.stringify(input);
  const result = RackDensity.reconcile(input);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(result.itPerHallKW, 3780);
  assert.throws(() => RackDensity.reconcile({ ...input, hallAreaM2: 0 }), /hallAreaM2/);
  assert.throws(() => RackDensity.reconcile({ ...input, logicalDomainsPerHall: 27.5 }), /logicalDomainsPerHall/);
  assert.throws(() => RackDensity.reconcile({ ...input, rackPositionsPerDomain: -1 }), /rackPositionsPerDomain/);
});

test('reconcile flags inconsistent claimed values without replacing computed truth', { skip: skipWhenMissing() }, () => {
  const result = RackDensity.reconcile({
    architectureId: 'audit-input', halls: 4,
    logicalDomainKW: 132, rackPositionsPerDomain: 2,
    logicalDomainsPerHall: 27, hallAreaM2: 640,
    claimedRackPositionKW: 70,
    claimedRackPositionsPerHall: 54,
    claimedItPerHallKW: 3600,
    claimedHallItDensityKWPerM2: 6,
    claimedItPerFacilityKW: 14256
  });
  assert.equal(result.rackPositionKW, 66);
  assert.equal(result.itPerHallKW, 3564);
  assert.equal(result.hallItDensityKWPerM2, 5.56875);
  assert.equal(result.allChecksPass, false);
  assert.deepEqual(
    result.checks.filter((check) => !check.pass).map((check) => check.name),
    ['rack-position power', 'IT load per hall', 'hall IT area density']
  );
});

test('unsafe and overflowing density inputs fail before producing Infinity', { skip: skipWhenMissing() }, () => {
  const valid = {
    architectureId: 'limit-study', halls: 4,
    logicalDomainKW: 132, rackPositionsPerDomain: 2,
    logicalDomainsPerHall: 27, hallAreaM2: 640
  };
  assert.throws(
    () => RackDensity.reconcile({ ...valid, logicalDomainsPerHall: 9007199254740992 }),
    /safe integer/
  );
  assert.throws(
    () => RackDensity.reconcile({ ...valid, logicalDomainKW: 1e308 }),
    /non-finite derived value/
  );
});

test('project-specific split baseline is not mislabeled as a vendor 72x1 reference', { skip: skipWhenMissing() }, () => {
  const baseline = RackDensity.getBaseline();
  assert.equal(baseline.architectureName, 'Project GB200 NVL72 split-domain basis');
  assert.equal(baseline.rackPositionsPerDomain, 2);
  assert.throws(() => RackDensity.getReference('gb200-nvl72-72x1'), /Unknown rack architecture reference/);
});

test('GB300 142 kW remains a named reference study and cannot change baseline', { skip: skipWhenMissing() }, () => {
  const before = RackDensity.getBaseline();
  const gb300 = RackDensity.getReference('gb300-nvl72-142kw-study');
  const study = RackDensity.studyReference('gb300-nvl72-142kw-study');
  const after = RackDensity.getBaseline();

  assert.equal(gb300.name, 'NVIDIA GB300 NVL72 reference study');
  assert.equal(gb300.referenceKW, 142);
  assert.equal(gb300.adoptionStatus, 'REFERENCE_STUDY');
  assert.equal(gb300.baselineImpact, 'NONE');
  assert.equal(gb300.rackPositionsPerDomain, 1);
  assert.equal(study.logicalDomainKW, 142);
  assert.equal(study.rackPositionsPerDomain, 1);
  assert.equal(study.rackPositionsPerHall, 27);
  assert.equal(study.rackPositionKW, 142);
  assert.equal(study.itPerHallKW, 3834);
  assert.equal(study.hallItDensityKWPerM2, 5.990625);
  assert.equal(study.itPerFacilityKW, 15336);
  assert.equal(study.deltaVsBaselineKWPerHall, 270);
  assert.equal(study.baselineChanged, false);
  assert.deepEqual(after, before);
  assert.equal(after.logicalDomainKW, 132);
});

test('unknown references and invalid identifiers fail explicitly', { skip: skipWhenMissing() }, () => {
  assert.throws(() => RackDensity.getReference('future-unknown'), /Unknown rack architecture reference/);
  assert.throws(() => RackDensity.studyReference(''), /referenceId/);
});
