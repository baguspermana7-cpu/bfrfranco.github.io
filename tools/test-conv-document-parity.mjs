#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const DOCUMENT_CONTRACTS = Object.freeze([
  Object.freeze({
    path: 'manual/datahall.html',
    required: Object.freeze([
      /CONV_CALC v2\.0\.0/,
      /30,000 kW/,
      /7,500 kW/,
      /40,000 kW/,
      /19\.4/,
      /27\.0/,
      /943\.0 L\/s/,
      /600 L\/min/,
      /500 installed rack positions/,
      /CONV_CALC\.getHallSnapshot\(selectedHall\)\.it_load_kw \/ \.racks/,
      /PUE is an adopted simulated input \(not live telemetry\)/,
      /adopted simulated design-point ratio; neither live telemetry nor a target/,
      /UNAVAILABLE/,
    ]),
    forbidden: Object.freeze([
      /site\.it_kw \/ datahall\.racks_total/,
      /PUE is measured/, /observed operating PUE/, /measured-basis value/,
    ]),
  }),
  Object.freeze({
    path: 'prd/datahall.html',
    required: Object.freeze([
      /CONV_CALC v2\.0\.0/,
      /30 MW site IT/,
      /7\.5 MW/,
      /500 positions/,
      /19\.4°C \/ 27\.0°C/,
      /943\.0 L\/s site/,
      /Hall EPMS reconciliation is UNAVAILABLE/,
      /Can reproduce 7,670 kW installed and 7,540 kW post-failure capacity\./,
      /Adopted simulated design-point input; not live telemetry and separate from target/,
    ]),
    forbidden: Object.freeze([/Derived\/measured basis/]),
  }),
  Object.freeze({
    path: 'manual/chiller-plant.html',
    required: Object.freeze([
      /CONV_CALC v2\.0\.0/,
      /30,000 kW/,
      /19\.4 \/ 27\.0 °C/,
      /943\.0 L\/s/,
      /7 \/ 10/,
      /31,250 kW/,
      /45,000 kW/,
      /COP[^<]*6\.06/,
      /0\.58 kW\/RT/,
      /not used here to invent a universal CHW setpoint or COP/,
      /"name": "Apply lead-lag logic", "text": "Seven chillers run out of ten installed\./,
      /Engine <strong>conv-engine\.js v2\.0\.0<\/strong>/,
    ]),
  }),
  Object.freeze({
    path: 'manual/water-system.html',
    required: Object.freeze([
      /site-wide municipal treatment train/,
      /30,000 kW/,
      /600 L\/min/,
      /608 L\/min/,
      /315\.36 ML\/yr/,
      /447\.8 L\/min/,
      /149\.3 L\/min/,
      /3\.0 L\/min/,
      /0\.80 bar/,
      /does not claim live metering/,
      /treatment-process states are explicitly labelled/,
      /authority-gated deterministic page-authored process simulation values/,
      /does not provide treatment-train telemetry/,
    ]),
    forbidden: Object.freeze([
      /data-hall=(?:"|')?[A-D]/i,
      /class=(?:"|')[^"']*hall-(?:selector|button)/i,
      /all process values are adopted engine-bound/i,
      /All current values derive from/i,
    ]),
  }),
  Object.freeze({
    path: 'manual/fire-system.html',
    required: Object.freeze([
      /30,000 kW/,
      /four halls/,
      /2,000 racks/,
      /7,200 m³/,
      /SITE_RACK_FOOTPRINT_CONTEXT_M3/,
      /104\.9 m³ available \/ 114 m³ installed/,
      /2,500 L\/min/,
      /60 min \/ 150 m³/,
      /42 min/,
      /36 m³/,
      /non-sizing/,
    ]),
  }),
  Object.freeze({
    path: 'manual/dc-conventional.html',
    required: Object.freeze([
      /IT sensible-load CHW reference/,
      /943\.0 L\/s/,
      /Plant-duty CHW reference/,
      /982\.3 L\/s/,
      /measured header flow is <strong>UNAVAILABLE<\/strong>/,
      /Evaporator duty/,
      /31 250 kW/,
      /Condenser\/tower rejection/,
      /36 403\.4 kW/,
      /Network \/ topology \/ uptime[\s\S]{0,300}<td>UNAVAILABLE\.<\/td>/,
      /Environment DP[\s\S]{0,220}<td>UNAVAILABLE\.<\/td>/,
      /FACP \/ VESDA[\s\S]{0,220}<td>UNAVAILABLE\.<\/td>/,
      /Day tank[\s\S]{0,180}<td>UNAVAILABLE\.<\/td>/,
    ]),
    forbidden: Object.freeze([/Online and 2N OK are overview claims/, /DP \+2\.1 Pa row/, /Day Tank 92% row/]),
  }),
  Object.freeze({
    path: 'prd/dc-conventional.html',
    required: Object.freeze([
      /943\.0 L\/s IT sensible-load reference/,
      /982\.3 L\/s evaporator-duty reference/,
      /31,250 kW evaporator duty/,
      /36,403\.4 kW condenser\/tower rejection/,
      /Measured header flow[^<]*stay unavailable/,
      /Network, UPS topology and uptime remain explicitly UNAVAILABLE/,
      /Overview FACP and VESDA states are UNAVAILABLE/,
      /per-genset day-tank level is UNAVAILABLE/,
      /a site utility with no valid hall context exposes no selector/,
    ]),
    forbidden: Object.freeze([
      /\+2\.1 static presentation/, /92 static presentation/,
      /Online \/ 2N OK \/ &mdash; UNAVAILABLE/,
      /Normal static presentation/,
      /Several subsystem rows remain static/,
    ]),
  }),
  Object.freeze({
    path: 'manual/fuel-system.html',
    required: Object.freeze([
      /CONV_CALC v2\.0\.0/,
      /30,000 kW/,
      /43,500 kW/,
      /40,000/,
      /planning\/design capacity/,
      /972,737/,
      /744,143\.805/,
      /744,144 L/,
      /15,503 L\/hr/,
      /0\.356384 L\/kWh/,
      /48\.0 hr/,
      /N\+1 electrical adequacy/,
      /UNAVAILABLE/,
      /must fail closed/,
    ]),
    forbidden: Object.freeze([
      /60,000 × 0\.90/,
      /45,900 L/,
      /Generator consumption = 956/,
      /1,850(?: kW)? × 1\.45/,
    ]),
  }),
  Object.freeze({
    path: 'manual/epms-telemetry.html',
    required: Object.freeze([
      /CONV_CALC v2\.0\.0/,
      /30,000 kW/,
      /43,500 kW/,
      /13,500/,
      /40,000/,
      /planning\/design capacity/,
      /2,000/,
      /500 per hall/,
      /3,000 kW/,
      /200 installed rack positions/,
      /Total Load binds to the same 43,500 kW/,
      /renders the complete cockpit unavailable/,
    ]),
    forbidden: Object.freeze([
      /1,850 kW × 1\.45/, /2,682\.5 kW/, /1,790 kW not represented/,
      /2\.4–2\.499 MW/, /ten branches × 6 kW/i, /display jitter/i,
    ]),
  }),
  Object.freeze({
    path: 'prd/epms-telemetry.html',
    required: Object.freeze([
      /CONV_CALC v2\.0\.0/,
      /30,000 × 1\.45 = 43,500 kW/,
      /13,500 kW/,
      /2,000 installed rack positions/,
      /40,000 kW is planning\/design capacity only/,
      /same-version-incomplete authority/,
      /15,503 L\/h fuel basis/,
      /3,000 kW and 200 installed positions per group/,
      /PF = UNAVAILABLE/,
      /<tr><td>Facility load<\/td><td><code>epms-fac<\/code><\/td><td>MW<\/td><td>43\.50; engine-bound campus aggregate\.<\/td><td><code>CONV_CALC\.snapshot\.site\.facility_load_kw \/ 1000<\/code>/,
      /<tr><td>IT load<\/td><td><code>epms-it<\/code><\/td><td>MW<\/td><td>30\.00; engine-bound protected IT aggregate\.<\/td><td><code>snapshot\.site\.it_load_kw \/ 1000<\/code>/,
    ]),
    forbidden: Object.freeze([
      /1,850 × 1\.45/, /2\.6825 MW/, /1\.85 MW IT/,
      /snapshot\.site\.(?:facility_kw|it_kw)/,
      /2\.4–2\.499 MW/, /Math\.random\(\).*Total Load/i, /6 kW per representative rack/i,
    ]),
  }),
  Object.freeze({
    path: 'manual/ict.html',
    required: Object.freeze([
      /CONV_CALC v2\.0\.0/,
      /30,000 kW IT/,
      /43,500 kW facility load/,
      /2,000 installed rack positions/,
      /500 per hall/,
      /40 MW IT figure is planning\/design capacity only/,
      /3,750[^<]*8 kW/,
      /fails closed/,
    ]),
    forbidden: Object.freeze([/IT_kW = 1850/, /round\(1850 \/ 8\)/, /231 rack-equivalents/, /IT 1\.85 MW/]),
  }),
  Object.freeze({
    path: 'prd/index.html',
    required: Object.freeze([
      /CONV_CALC v2\.0\.0/,
      /30 MW current IT/,
      /43\.5 MW facility/,
      /4 halls[^<]*30 MW current IT[^<]*40 MW design only/,
      /4 × 7\.5 MW current[^<]*2,000 positions[^<]*simulated/,
    ]),
    forbidden: Object.freeze([/1,850 kW IT/, /200 rack cells/]),
  }),
  Object.freeze({
    path: 'standarization/DATAHALL_AI_STANDARD.md',
    required: Object.freeze([
      /v1\.134\.14 Authority and cross-project boundary/,
      /CONV_CALC v2\.0\.0/,
      /30,000 kW current IT/,
      /43,500 kW facility load/,
      /2,000 installed rack positions/,
      /40,000 kW IT figure is the four-hall planning\/design capacity only/,
      /same-version-incomplete payloads fail closed/,
    ]),
  }),
  Object.freeze({
    path: 'standarization/BMS_SHELL.md',
    required: Object.freeze([
      /v1\.134\.14 — governed authority and fail-closed shell/,
      /CONV_CALC v2\.0\.0/,
      /30,000 kW current simulated IT/,
      /43,500 kW facility load/,
      /2,000 installed/,
      /40,000 kW IT value is planning\/design capacity only/,
      /same-version-incomplete authority/,
      /historical release archive/,
      /retired 1\.850 MW single-hall/,
    ]),
    skipRetiredAuthority: true,
  }),
]);

const GENERATED_DOCUMENT_SOURCE = Object.freeze({
  path: 'dc-conventional.html',
  required: Object.freeze([
    /Worked calculations \(validated simulated engine\)/,
    /\['Evaporator duty',grp\(Math\.round\(evapDuty\)\)\+' kW'/,
    /\['Condenser \/ tower rejection',grp\(Math\.round\(towerRejection\)\)\+' kW'/,
    /WK\('Plant-duty CHW reference'/,
    /measured header flow UNAVAILABLE/,
    /A\.6 Evaporator and tower duties/,
  ]),
  forbidden: Object.freeze([
    /Math\.round\(heatRej\)/,
    /Worked calculations \(live engine(?: numerator)?\)/,
    /live facility power figure/,
    /IT load \(live\)/,
    /Facility load \(live\)/,
    /matches 1,127/,
  ]),
});

const RETIRED_ACTIVE_AUTHORITY = Object.freeze([
  /(?:current|locked|canonical|basis)[^\n<]{0,80}1[,.]?850\s*kW/i,
  /1\.85\s*MW/i,
  /(?:CHWS|CHW supply)[^\n<]{0,40}7\.2\s*°?C/i,
  /(?:CHWR|CHW return)[^\n<]{0,40}14\.8\s*°?C/i,
  /58\.1\s*L\/s/i,
  /37\.0\s*L\/min/i,
  /231[- ]rack/i,
  /831\s*m(?:³|&sup3;)/i,
  /CONV_CALC v1\.0\.0/i,
  /conv-engine(?:\.js)? v1\.0\.0/i,
]);

function assertMatches(path, html, patterns) {
  for (const pattern of patterns) {
    assert.match(html, pattern, `${path}: missing current authority ${pattern}`);
  }
}

function assertRejects(path, html, patterns) {
  for (const pattern of patterns) {
    assert.doesNotMatch(html, pattern, `${path}: retired or forbidden authority survived ${pattern}`);
  }
}

for (const contract of DOCUMENT_CONTRACTS) {
  const html = await readFile(contract.path, 'utf8');
  assertMatches(contract.path, html, contract.required);
  if (!contract.skipRetiredAuthority) assertRejects(contract.path, html, RETIRED_ACTIVE_AUTHORITY);
  assertRejects(contract.path, html, contract.forbidden ?? []);
}

const generatedSource = await readFile(GENERATED_DOCUMENT_SOURCE.path, 'utf8');
assertMatches(GENERATED_DOCUMENT_SOURCE.path, generatedSource, GENERATED_DOCUMENT_SOURCE.required);
assertRejects(GENERATED_DOCUMENT_SOURCE.path, generatedSource, GENERATED_DOCUMENT_SOURCE.forbidden);

console.log(`PASS Conventional linked-document parity (${DOCUMENT_CONTRACTS.length} documents + generated source)`);
