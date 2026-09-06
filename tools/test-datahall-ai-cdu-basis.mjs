import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../datahallAI.html', import.meta.url), 'utf8');

test('current cooling cockpit binds CDU counts from the GB300 engine, not a typed literal', () => {
  assert.match(source, /cduRunning:E\.cdu_duty_per_hall/,
    'cduRunning must be read from equipment.cdu_duty_per_hall on the DCAI snapshot');
  assert.match(source, /cduInstalled:E\.cdu_installed_per_hall/,
    'cduInstalled must be read from equipment.cdu_installed_per_hall on the DCAI snapshot');
  assert.match(source, /idx\*cduPer<cduRunning/,
    'the CDU bank-activity test must compare against the engine duty count, not a typed literal');
  assert.match(source, /DH\.cduRunning\+' running \/ '\+DH\.cduInstalled\+' installed'/,
    'the CDU count label must be composed from the engine bind');
});

test('legacy GB200 CDU basis (9 running / 12 installed, 350 kW EoR, 24-unit array) cannot return', () => {
  const forbidden = [
    /CDU ARRAY[^\n]{0,80}24[×x]/,
    /CDU Count[^\n]{0,40}24 units/,
    /23\/24/,
    /CDU 13-18/,
    /CDU 19-24/,
    /CDU 22[×x]5kW/,
    /24 units \(N\+1\)/,
    /cduInstalled:12\b/,
    /350 kW/,
    /\b9 run(?:ning)?\b/,
    /\b12 installed\b/,
  ];
  forbidden.forEach((pattern) => assert.doesNotMatch(source, pattern));
});

test('selected-hall heat and flow KPIs remain engine-bound (GB300 snapshot fields, not GB200 literals)', () => {
  assert.match(source, /liquidHeat:rd\(H\.liquid_hall_kwth/,
    'liquidHeat must be derived from heat.liquid_hall_kwth, not a page literal');
  assert.match(source, /tcsFlowTotalFmt:fmt\(/,
    'tcsFlowTotalFmt must be formatted from the engine flow, not a typed literal like 4,342');
  assert.doesNotMatch(source, /DH\?DH\.liquidHeat:3029/, 'the GB200 liquidHeat fallback (3029) must be gone');
  assert.doesNotMatch(source, /DH\?DH\.tcsFlowTotalFmt:'4,342'/, "the GB200 flow fallback ('4,342') must be gone");
});
