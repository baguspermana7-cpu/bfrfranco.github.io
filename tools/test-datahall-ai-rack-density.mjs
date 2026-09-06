/**
 * Ship gate — js/datahall-ai/rack-density.js reconciles the GB300 basis and keeps the retired
 * GB200 basis as a named reference that cannot change the baseline.
 *
 * v2.0.0: the canonical model is js/dcai-model.js (880 racks/hall x 142 kW, one rack = one
 * NVL72 domain). The GB200 split-domain basis (27 domains x 132 kW over 2 racks, 32 x 20 m hall)
 * is REFERENCE 'gb200-nvl72-split-domain-retired' and reconciles on its OWN geometry — applying
 * 880 domains to a 640 m2 hall would describe a plant nobody designed.
 *
 * No expected value here is a memorised engine output: each is arithmetic over the model's
 * own leaves, read from the model file at test time.
 *
 * Run: node --test tools/test-datahall-ai-rack-density.mjs   (or plain node)
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const MODEL = require(resolve(ROOT, 'js/dcai-model.js'));
const density = require(resolve(ROOT, 'js/datahall-ai/rack-density.js'));

const racks = MODEL.facility.racksPerHall, kw = MODEL.facility.rackItKw, halls = MODEL.facility.halls;
const area = MODEL.geometry.lengthM * MODEL.geometry.widthM;

test('baseline is the adopted GB300 basis, derived from the model leaves', () => {
  const b = density.getBaseline();
  assert.equal(b.architectureId, 'gb300-nvl72-one-rack-one-domain');
  assert.match(b.architectureName, /GB300 NVL72/);
  assert.equal(b.rackPositionsPerDomain, MODEL.gb300.racksPerDomain);
  assert.equal(b.rackPositionsPerDomain, 1, 'one rack is the domain (RA: 72 GPUs in a single NVLink domain per rack)');
  assert.equal(b.logicalDomainKW, kw);
  assert.equal(b.rackPositionKW, kw);
  assert.equal(b.logicalDomainsPerHall, racks);
  assert.equal(b.rackPositionsPerHall, racks);
  assert.equal(b.itPerHallKW, racks * kw);
  assert.equal(b.itPerFacilityKW, racks * kw * halls);
  assert.equal(b.hallAreaM2, area);
  assert.ok(Math.abs(b.hallItDensityKWPerM2 - (racks * kw) / area) < 1e-9);
  assert.equal(b.status, 'ADOPTED');
  assert.equal(b.modelSpecVersion, MODEL.specVersion);
  assert.ok(Object.isFrozen(b));
});

test('baseline agrees with the engine snapshot', () => {
  const calc = require(resolve(ROOT, 'js/dcai-engine.js'));
  const s = calc.snapshot;
  const b = density.getBaseline();
  assert.equal(b.itPerFacilityKW, s.power.rack_it_facility_kwe);
  assert.equal(b.rackPositionsPerHall, s.compute.racks_per_hall);
  assert.ok(Math.abs(b.hallItDensityKWPerM2 - s.geometry.it_density_kw_per_m2) < 1e-9);
});

test('reconcile() derives and checks claims independently', () => {
  const r = density.reconcile({
    architectureId: 'synthetic', halls: 3, logicalDomainKW: 150, rackPositionsPerDomain: 3,
    logicalDomainsPerHall: 10, hallAreaM2: 600,
  });
  assert.equal(r.rackPositionKW, 50);
  assert.equal(r.rackPositionsPerHall, 30);
  assert.equal(r.itPerHallKW, 1500);
  assert.equal(r.hallItDensityKWPerM2, 2.5);
  assert.equal(r.itPerFacilityKW, 4500);
  assert.equal(r.allChecksPass, true);
  const bad = density.reconcile({
    architectureId: 'synthetic', halls: 3, logicalDomainKW: 150, rackPositionsPerDomain: 3,
    logicalDomainsPerHall: 10, hallAreaM2: 600, claimedItPerHallKW: 1600,
  });
  assert.equal(bad.allChecksPass, false, 'a wrong claim is flagged, the computed value wins');
  assert.equal(bad.itPerHallKW, 1500);
});

test('the GB200 basis is a RETIRED reference on its own geometry and cannot change the baseline', () => {
  const ref = density.getReference('gb200-nvl72-split-domain-retired');
  assert.equal(ref.adoptionStatus, 'RETIRED_REFERENCE');
  assert.equal(ref.baselineImpact, 'NONE');
  const st = density.studyReference('gb200-nvl72-split-domain-retired');
  assert.equal(st.rackPositionsPerDomain, 2);
  assert.equal(st.rackPositionKW, 66);
  assert.equal(st.logicalDomainsPerHall, 27);
  assert.equal(st.rackPositionsPerHall, 54);
  assert.equal(st.itPerHallKW, 27 * 132);
  assert.equal(st.itPerFacilityKW, 27 * 132 * halls);
  assert.equal(st.hallAreaM2, 640);
  assert.equal(st.baselineChanged, false);
  assert.ok(st.deltaVsBaselineKWPerHall < 0, 'the retired basis is far below the adopted one');
  assert.equal(density.getBaseline().itPerHallKW, racks * kw, 'baseline untouched after a study');
});

test('the old GB300 "study" id no longer exists — GB300 is the basis, not a study', () => {
  assert.throws(() => density.getReference('gb300-nvl72-142kw-study'), RangeError);
});

test('module refuses to load without a GB300-shaped model', async () => {
  const src = await readFile(resolve(ROOT, 'js/datahall-ai/rack-density.js'), 'utf8');
  const box = { window: { DCAI_MODEL: { facility: {}, locked: {}, geometry: {} } }, console };
  box.globalThis = box; box.window = box;
  vm.createContext(box);
  assert.throws(() => vm.runInContext(src, box), /DCAI_MODEL with facility, gb300, and geometry/);
});

test('module accepts an injected GB300 model through the browser global', async () => {
  const src = await readFile(resolve(ROOT, 'js/datahall-ai/rack-density.js'), 'utf8');
  const box = { console };
  box.globalThis = box; box.window = box; box.DCAI_MODEL = MODEL;
  vm.createContext(box);
  vm.runInContext(src, box);
  assert.equal(box.RZDataHallRackDensity.getBaseline().rackPositionsPerHall, racks);
  assert.equal(box.RZDataHallRackDensity.version, '2.0.0');
});
