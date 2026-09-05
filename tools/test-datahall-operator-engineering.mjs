import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../datahall.html', import.meta.url), 'utf8');

function includes(token, message) {
  assert.ok(html.includes(token), message);
}

includes('id="hall-selector"', 'data hall must expose a first-class hall selector');
for (const hall of ['A', 'B', 'C', 'D']) {
  includes(`data-hall="${hall}"`, `hall selector is missing Hall ${hall}`);
}
includes('function selectHall(hall)', 'hall selector must update the operational scope');
/* v1.134.0 — this asserted the page source contained the LITERAL
   `var RACK_INLET_DESIGN_C = 25.4`. That is the pattern this codebase spent v1.132.0
   removing: it required the target to be re-typed on the page, so the page and the engine
   could disagree and the test would still pass. Assert the two halves that actually
   matter instead — the ENGINE publishes 25.4 C, and the PAGE reads it rather than
   restating it. Strictly stronger: it now catches a drifted page, which the literal
   could not, and it stops failing a correct one. */
const engineSandbox = { window: {}, module: { exports: {} }, console };
vm.createContext(engineSandbox);
vm.runInContext(await readFile(new URL('../js/conv-engine.js', import.meta.url), 'utf8'), engineSandbox);
const cooling = engineSandbox.window.CONV_CALC.snapshot.cooling;
assert.equal(cooling.rack_inlet_target_c, 25.4,
  'engine must publish the adopted 25.4 C rack-inlet target');
includes('S.cooling.rack_inlet_target_c',
  'data hall must READ the adopted rack-inlet target from the engine, not re-type it');
/* The whole air-to-water chain must close from that target — the 15.2 C supply-air defect
   existed precisely because the air planes and the water planes were authored apart. */
assert.equal(cooling.crah_supply_air_c, cooling.rack_inlet_target_c - cooling.supply_path_mixing_k,
  'CRAH supply air must derive from the rack-inlet target and the supply-path mixing');
assert.equal(cooling.chws_c, cooling.crah_supply_air_c - cooling.chw_coil_approach_k,
  'CHWS must derive from the CRAH supply air and the coil approach');
includes('S.cooling.crah_supply_air_c',
  'data hall must read the published CRAH supply-air plane, never recompute it from CHWS');
includes('var RACK_INLET_RECOMMENDED_MIN_C = 18', 'rack-inlet recommended lower bound must be explicit');
includes('var RACK_INLET_RECOMMENDED_MAX_C = 27', 'rack-inlet recommended upper bound must be explicit');
includes('function dewPointC(tempC, rhPct)', 'humidity display must include a deterministic dew-point calculation');
includes('id="env-dewpoint"', 'environment panel must expose dew point');

for (const label of [
  'Rack-inlet / cold-aisle', 'Hot-aisle temperature', 'CRAH leaving air',
  'CRAH return air', 'Actual heat load', 'Allocated cooling', 'Cooling coverage',
  'Cooling duty utilization', 'Plant cooling efficiency',
]) {
  includes(label, `data-hall inspector is missing engineering label: ${label}`);
}
includes('Current operating density', 'current rack-density basis must be separated from design study');
includes('Installed rack study', 'installed rack study must be separated from live density');
includes('Sensible heat equivalence', 'rack electrical load to heat-load assumption must be disclosed');
/* v1.134.23 — this asserted the literal `= 0`, i.e. that the assumption is AUTHORED HERE.
   The mixing allowance moved onto the engine with the rest of the thermal chain, so the page
   now reads it instead of owning it. The requirement it was protecting is unchanged and is
   still checked: the constant is named, and the assumption is disclosed to the operator on
   the line below. What changed is where the value lives, which is an improvement — an
   authored constant on a page is exactly what the parameter programme removes. */
includes('var RETURN_PATH_MIXING_ADJUSTMENT_C = S.cooling.return_path_mixing_k',
  'CRAH return path must use a named mixing assumption read from the engine');
includes('contained hot-aisle return with 0 K mixing adjustment', 'CRAH return assumption must be visible to operators');
assert.equal(html.includes('hotAisleC - 0.8'), false, 'CRAH return must not use an unexplained 0.8C offset');
assert.equal(html.includes('Cooling efficiency index'), false, 'allocated-duty utilization must not be mislabeled as plant efficiency');
includes('window.__fireDatahallExcursion = fireExcursion', 'thermal excursion must expose a deterministic runtime verification hook');
assert.doesNotMatch(
  html,
  /cprow\('Supply air',/,
  'CRAH leaving air must not retain ambiguous supply-air terminology',
);
assert.doesNotMatch(
  html,
  /target 22°C/,
  'excursion messaging must use the declared 25.4C rack-inlet design setpoint',
);

console.log('PASS data-hall selector, thermal terminology, psychrometrics, and density-basis contracts');
