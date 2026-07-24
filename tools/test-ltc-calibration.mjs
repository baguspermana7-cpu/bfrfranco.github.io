#!/usr/bin/env node
/* LTC model-validation gate — models.ltc.validation() vs sourced benchmark
 * bands (DATA.ltcCalibration.validationBands). Asserts the machinery + the
 * band anchors stay wired to their DATA sources; drift in what the DEFAULT
 * config reports is a REPORTED finding (MODEL_CALIBRATION_STANDARD) — this
 * gate locks structure + sourcing, not "everything green". */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../rz-engine.js', import.meta.url), 'utf8'), ctx);
const E = ctx.window.RZEngine;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } };

const B = E.data.ltcCalibration.validationBands;
ok(B && Object.keys(B).length === 6, 'validationBands has 6 metrics');
for (const k of Object.keys(B || {})) {
  ok(Number.isFinite(B[k].lo) && Number.isFinite(B[k].hi) && B[k].hi > B[k].lo, `band ${k} lo<hi finite`);
  ok(typeof B[k].source === 'string' && B[k].source.length > 20, `band ${k} carries a source citation`);
}
// Band anchors must MIRROR their DATA sources (no divergent copy)
ok(B.pue.lo === E.data.pueMatrix.liquid.tier4 && B.pue.hi === E.data.pueMatrix.liquid.tier2, 'PUE band mirrors pueMatrix.liquid tier4/tier2');
ok(B.wue.lo === E.data.water.wueByType.immersion && B.wue.hi === E.data.water.wueByType.rearDoor, 'WUE band mirrors water.wueByType');
ok(B.deltaT.lo === E.data.cdu.bands.deltaTK.min && B.deltaT.hi === E.data.cdu.bands.deltaTK.max, 'ΔT band mirrors cdu.bands');
ok(B.supplyTemp.lo === E.data.cdu.bands.supplyC.min && B.supplyTemp.hi === E.data.cdu.bands.supplyC.max, 'supply band mirrors cdu.bands');
ok(B.flowIntensity.lo === E.data.cdu.bands.flowLpmPerKw.min && B.flowIntensity.hi === E.data.cdu.bands.flowLpmPerKw.max, 'flow band mirrors cdu.bands');
ok(!!E.data.sources['ltcCalibration.validationBands'], 'DATA.sources provenance entry present');

const input = { itLoadMw:12, rackCount:360, rackType:'ai_hpc_direct_liquid', rackDensityTarget:35,
  highDensityShare:45, modelYear:2026, countryKey:'custom', climate:'tropical',
  architectureMode:'direct_liquid', liquidCapture:85, coolantKey:'water', supplyTemp:30,
  returnTemp:38.5, pumpHead:28, pumpEff:78, hydraulicMargin:12, controlQuality:86,
  predictiveGain:12, coefHeatTransfer:93, coefCduLoss:1.8, coefPipeLoss:1.0, coefFutureTech:0,
  cduUnit:1200, redundancy:'N1', airCop:4.2, economizerHours:28, fanPower:3.2, upsEff:96.5,
  distLoss:2.1, heatReuse:18, elecPrice:0.07, waterTariff:1.6, carbonIntensity:0.42,
  monitoring:92, fireType:'clean_agent', targetPue:1.20, targetCop:8.2, failureMode:'normal', concurrent:true };
const m = E.models.ltc.compute(input);
const v = E.models.ltc.validation(m);
ok(Array.isArray(v) && v.length === 6, 'validation returns 6 rows');
for (const r of v) {
  ok(r.value === null || Number.isFinite(r.value), `row ${r.key} value finite`);
  ok(typeof r.inBand === 'boolean', `row ${r.key} inBand boolean`);
}
// Deterministic default-config expectations (locked 2026-07-24; a change here is
// a REPORTED model shift, not a silent one):
const by = Object.fromEntries(v.map(r => [r.key, r]));
ok(by.wue.inBand === true,        'default: WUE in band');
ok(by.deltaT.inBand === true,     'default: ΔT in band');
ok(by.supplyTemp.inBand === true, 'default: supply temp in band');
ok(by.pumpPct.inBand === true,    'default: pump fraction in band');
ok(by.pue.inBand === false,       'default: PUE reported ABOVE design band (honest finding, drives tuning)');
ok(by.flowIntensity.inBand === false, 'default: flow intensity reported above OCP band (redundancy+margin inflate design flow — honest finding)');

console.log(`LTC CALIBRATION GATE — ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
console.log('ALL GREEN — validation bands sourced, mirrored to DATA anchors, defaults locked.');
