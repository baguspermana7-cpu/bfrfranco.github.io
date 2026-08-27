import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../datahall.html', import.meta.url), 'utf8');

function includes(token, message) {
  assert.ok(html.includes(token), message);
}

includes('id="hall-selector"', 'data hall must expose a first-class hall selector');
for (const hall of ['A', 'B', 'C', 'D']) {
  includes(`data-hall="${hall}"`, `hall selector is missing Hall ${hall}`);
}
includes('function selectHall(hall)', 'hall selector must update the operational scope');
includes('var RACK_INLET_DESIGN_C = 25.4', 'rack-inlet design setpoint must be explicitly modelled at 25.4C');
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
includes('var RETURN_PATH_MIXING_ADJUSTMENT_C = 0', 'CRAH return path must use a named, disclosed mixing assumption');
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
