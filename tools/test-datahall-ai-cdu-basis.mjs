import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../datahallAI.html', import.meta.url), 'utf8');

test('current cooling cockpit uses the locked 9 running / 12 installed CDU basis', () => {
  assert.match(source, /cduRunning:s\.cduRunningCount/);
  assert.match(source, /cduInstalled:12/);
  assert.match(source, /cduInstalled=DHE\?DHE\.cduInstalled:12/);
  assert.match(source, /cduRunning=DHE\?DHE\.cduRunning:9/);
  assert.match(source, /const active=idx<cduRunning/);
  assert.match(source, /DH\.cduRunning\+' running \/ '\+DH\.cduInstalled\+' installed'/);
});

test('legacy 24-CDU and 22-pump current-state labels cannot return', () => {
  const forbidden = [
    /CDU ARRAY[^\n]{0,80}24[×x]/,
    /CDU Count[^\n]{0,40}24 units/,
    /23\/24/,
    /CDU 13-18/,
    /CDU 19-24/,
    /CDU 22[×x]5kW/,
    /24 units \(N\+1\)/,
  ];
  forbidden.forEach((pattern) => assert.doesNotMatch(source, pattern));
});

test('selected-hall heat and flow KPIs remain engine-bound', () => {
  assert.match(source, /const cduQ=DH\?DH\.liquidHeat:3029/);
  assert.match(source, /DH\?DH\.tcsFlowTotalFmt:'4,342'/);
  assert.match(source, /DHE\.cduInstalled\*DHE\.halls/);
});
