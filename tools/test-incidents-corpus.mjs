#!/usr/bin/env node
/*
 * test-incidents-corpus.mjs — provenance + completeness gate for the DC-Incidents dossier.
 *
 * Fails (exit 1) if any data/incidents/*.json is missing required structure or provenance:
 *   - core fields present (title, operator, dcName, location, date, category[], brief)
 *   - sequenceOfEvents[] non-empty, each entry has t + event
 *   - rootCause, coe[], lessonsLearnt[], improvements[] non-empty
 *   - references[] >= 2; every ref has url + type + title; non-official refs carry a quote
 *   - at least one official-postmortem / regulatory ref when sourcing.officialPostmortem is true
 *   - magnitude sub-scores present + within 0..10
 * Mirrors test-dc-corpus.mjs discipline: no unsourced economically/technically material claim.
 */
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'data', 'incidents');
const OFFICIAL = new Set(['official-postmortem', 'regulatory', 'vendor-status']);
const MAG_KEYS = ['usersScore', 'financialScore', 'durationScore', 'blastRadiusScore'];

let failures = [];
let checked = 0;

const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
for (const f of files) {
  checked++;
  const id = f.replace(/\.json$/, '');
  let inc;
  try {
    inc = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  } catch (e) {
    failures.push(`${id}: invalid JSON — ${e.message}`);
    continue;
  }
  const fail = (m) => failures.push(`${id}: ${m}`);

  for (const k of ['title', 'operator', 'dcName', 'date', 'brief', 'rootCause', 'technicalDeepDive']) {
    if (!inc[k] || String(inc[k]).trim() === '') fail(`missing/empty "${k}"`);
  }
  if (!inc.location || !inc.location.country) fail('missing location.country');
  if (!Array.isArray(inc.category) || inc.category.length === 0) fail('empty category[]');

  if (!Array.isArray(inc.sequenceOfEvents) || inc.sequenceOfEvents.length === 0) {
    fail('empty sequenceOfEvents[]');
  } else {
    inc.sequenceOfEvents.forEach((e, i) => {
      if (!e.t || !e.event) fail(`sequenceOfEvents[${i}] missing t/event`);
    });
  }

  for (const k of ['coe', 'lessonsLearnt', 'improvements']) {
    if (!Array.isArray(inc[k]) || inc[k].length === 0) fail(`empty "${k}[]"`);
  }

  const refs = Array.isArray(inc.references) ? inc.references : [];
  if (refs.length < 2) fail(`needs >= 2 references (has ${refs.length})`);
  refs.forEach((r, i) => {
    if (!r.url || !/^https?:\/\//.test(r.url)) fail(`references[${i}] missing/invalid url`);
    if (!r.type) fail(`references[${i}] missing type`);
    if (!r.title) fail(`references[${i}] missing title`);
    if (!OFFICIAL.has(r.type) && (!r.quote || r.quote.trim() === '')) {
      fail(`references[${i}] (${r.type}) needs a quote for provenance`);
    }
  });
  const hasOfficial = refs.some((r) => OFFICIAL.has(r.type));
  if (inc.sourcing && inc.sourcing.officialPostmortem === true && !hasOfficial) {
    fail('sourcing.officialPostmortem=true but no official-postmortem/regulatory/vendor-status reference');
  }

  const m = inc.magnitude || {};
  for (const k of MAG_KEYS) {
    const v = m[k];
    if (typeof v !== 'number' || v < 0 || v > 10) fail(`magnitude.${k} must be a number 0..10`);
  }
}

if (failures.length) {
  console.error(`INCIDENTS-CORPUS GATE — ${failures.length} failure(s) across ${checked} incident(s):`);
  failures.forEach((m) => console.error('  ✗ ' + m));
  process.exit(1);
}
console.log(`INCIDENTS-CORPUS GATE — ${checked} incident(s) checked, all provenance + structure OK.`);
