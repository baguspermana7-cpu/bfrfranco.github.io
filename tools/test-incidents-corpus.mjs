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

  /* PLACEHOLDER DATE. The seed-then-fill pattern creates a skeleton with an estimated
     date before research; three dossiers kept a first-of-the-month seed after the
     research filled in the real day (azure-west-us2: header 2026-05-01, its own
     sequence of events 2026-05-29; cyrusone 11-01 vs 11-27; digital-realty-singapore
     09-01 vs 09-10). The header feeds the hub table, so the library printed the
     wrong date for each. A header on the 1st that sits more than 2 days before the
     first TRIGGER/IMPACT event is a seed that was never corrected. Precursor events
     (a latent bug shipped months earlier) are deliberately not compared: only the
     trigger and impact phases. */
  const day = (s) => { const m = /(\d{4}-\d{2}-\d{2})/.exec(String(s || '')); return m ? m[1] : null; };
  const hd = day(inc.date);
  const onset = (inc.sequenceOfEvents || [])
    .filter((e) => /^(TRIGGER|IMPACT)$/i.test(String(e.phase || '')))
    .map((e) => day(e.t)).filter(Boolean).sort()[0];
  if (hd && onset) {
    const gap = (Date.parse(onset) - Date.parse(hd)) / 864e5;
    if (hd.endsWith('-01') && gap > 2) fail(`header date ${hd} looks like an uncorrected seed: the first trigger/impact event is ${onset}`);
  }
  /* A header AFTER the first IMPACT is never right, whatever its day: x-twitter-oregon
     printed 2025-05-24 for a fire its own sequence of events dates 22 May. Compared with
     IMPACT, not TRIGGER, because a TRIGGER can legitimately be a latent cause shipped
     months earlier (Fastly's bug deployed 12 May, CrowdStrike's in February). */
  const impact = (inc.sequenceOfEvents || [])
    .filter((e) => /^IMPACT$/i.test(String(e.phase || '')))
    .map((e) => day(e.t)).filter(Boolean).sort()[0];
  if (hd && impact && (Date.parse(hd) - Date.parse(impact)) / 864e5 > 1) {
    fail(`header date ${hd} is after the first impact event (${impact})`);
  }

  const refs = Array.isArray(inc.references) ? inc.references : [];
  const hasOfficialRef = refs.some((r) => OFFICIAL.has(r.type));
  const minRefs = hasOfficialRef ? 1 : 2;
  if (refs.length < minRefs) fail(`needs >= ${minRefs} reference(s) (has ${refs.length})`);
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
