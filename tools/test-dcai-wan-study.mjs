#!/usr/bin/env node
/**
 * The WAN traffic study, checked instead of asserted.
 *
 * WHY THIS GATE EXISTS
 *
 * The Corporate & DC Internet view (§A7) is the one sheet on `datahallAI.html` that the engine
 * does not feed. It says so, in a declaration on every figure: the dataset-refresh rate, the
 * diurnal peak factor, the replication, distribution and ops terms, the committed transit and the
 * installed port count are DESIGN SELECTIONS, not engine quantities. That declaration is honest
 * and it is what ACCURACY_VALIDATION asks for.
 *
 * What it does not do is make the arithmetic true. A page-authored study is exactly the place a
 * number drifts unnoticed: change the dataset rate in the card and the headline keeps the old
 * peak, and no gate on this site would have noticed, because every one of those figures is
 * `declared` and therefore already accounted for by the coverage walker.
 *
 * So this gate re-derives the study from its own stated inputs and checks that every figure the
 * view prints follows from them. It asserts the ARITHMETIC, never the choice of inputs — those
 * remain the owner's design selections, and changing one is not a failure. Publishing a peak that
 * does not follow from them is.
 *
 * THE IDENTITIES
 *
 *   W1  sustained  = dataset_bytes_per_week × 8 ÷ 604,800 s
 *   W2  peak       = sustained × peak_factor + replication + distribution + ops
 *   W3  the headline tile equals the Demand Model card's peak
 *   W4  committed  = carriers × per-carrier commitment
 *   W5  one carrier lost = committed ÷ carriers
 *   W6  the surviving commitment is BELOW the peak, and is drawn in the adverse token —
 *       an adverse finding that renders in an identity colour is a finding nobody reads
 *   W7  installed ≥ committed (a port count is capacity, never a commitment)
 *
 * Usage: node tools/test-dcai-wan-study.mjs [--json]
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(resolve(ROOT, 'datahallAI.html'), 'utf8');
const SECONDS_PER_WEEK = 604800;

/* The WAN builder is one IIFE; read only inside it, so a figure elsewhere on the page that
   happens to share a label cannot be mistaken for one of these. */
const start = SRC.indexOf("const el=$('wanC')");
const end = SRC.indexOf("§A7 — NETWORK DETAIL MODAL", start);
if (start < 0 || end < 0) {
  console.log('FAIL — the WAN view builder was not found in datahallAI.html.');
  console.log('If the view was renamed or removed, update this gate in the same commit.');
  process.exit(1);
}
const WAN = SRC.slice(start, end);

/** A `['Label','value…']` row in one of this view's cards. */
function row(label) {
  const m = WAN.match(new RegExp(`\\['${label}','([^']*)'\\]`));
  return m ? m[1] : null;
}
/** A `['TILE','value',…]` headline tile. */
function tile(name) {
  const m = WAN.match(new RegExp(`\\['${name}','([^']*)','([^']*)','([^']*)'\\]`));
  return m ? { value: m[1], note: m[2], colour: m[3] } : null;
}
const num = (s) => (s === null ? NaN : parseFloat(String(s).replace(/[^0-9.]/g, '')));

const findings = [];
const check = (id, ok, detail) => { findings.push({ id, ok, detail }); };

/* ---- inputs, read from the card the view publishes them in ---------------------------- */
const datasetPb = num(row('Dataset refresh'));          // PB per week
const sustained = num(row('Sustained'));                 // Gb/s
const peakFactor = num(row('Peak factor'));              // ×N
const replication = num(row('Replication'));             // Gb/s
const distribution = num(row('Distribution'));           // Gb/s
const ops = num(row('Ops'));                             // Gb/s
const cardPeak = num(row('Modelled peak'));              // Gb/s

const peakTile = tile('MODELLED PEAK');
const committedTile = tile('COMMITTED');
const installedTile = tile('INSTALLED');
const lostTile = tile('ONE CARRIER LOST');

if ([datasetPb, sustained, peakFactor, replication, distribution, ops, cardPeak].some(Number.isNaN)
    || !peakTile || !committedTile || !installedTile || !lostTile) {
  console.log('FAIL — the WAN view no longer publishes the inputs this gate re-derives from.');
  console.log('Every figure must stay readable as a labelled row or tile, or the study becomes');
  console.log('unverifiable prose again.');
  process.exit(1);
}

/* PB here is the decimal petabyte the study's own arithmetic uses (10 PB/week -> 132.3 Gb/s
   only closes at 10^15; at 2^50 it would be 148.9). */
const derivedSustained = (datasetPb * 1e15 * 8) / SECONDS_PER_WEEK / 1e9;
check('W1 sustained follows from the dataset rate',
  Math.abs(derivedSustained - sustained) <= 0.05,
  `${datasetPb} PB/week -> ${derivedSustained.toFixed(1)} Gb/s, printed ${sustained}`);

const derivedPeak = sustained * peakFactor + replication + distribution + ops;
check('W2 peak follows from sustained x factor + the three terms',
  Math.abs(derivedPeak - cardPeak) <= 1,
  `${sustained} x ${peakFactor} + ${replication} + ${distribution} + ${ops} = ${derivedPeak.toFixed(1)}, printed ${cardPeak}`);

check('W3 the headline tile equals the card peak',
  Math.abs(num(peakTile.value) - cardPeak) <= 1,
  `tile ${peakTile.value}, card ${cardPeak} Gb/s`);

/* carriers and the per-carrier commitment are stated on the path blocks */
const carriers = (WAN.match(/\['CARRIER [A-Z]'/g) || []).length;
const perCarrier = num((WAN.match(/ISP-1[^']*?(\d+) committed/) || [])[1]);
const committed = num(committedTile.value);
check('W4 committed = carriers x the per-carrier commitment',
  carriers > 0 && !Number.isNaN(perCarrier) && Math.abs(carriers * perCarrier - committed) <= 1,
  `${carriers} x ${perCarrier} = ${carriers * perCarrier}, printed ${committed} Gb/s`);

const lost = num(lostTile.value);
check('W5 one carrier lost leaves committed / carriers',
  Math.abs(committed / carriers - lost) <= 1,
  `${committed} / ${carriers} = ${committed / carriers}, printed ${lost} Gb/s`);

/* The study's whole point is this comparison; if it ever stops being adverse the amber must go,
   and if it stays adverse the amber must stay. Either way the colour states the finding. */
const adverse = lost < cardPeak;
const amber = /--o\b/.test(lostTile.colour);
check('W6 the adverse finding is drawn in the adverse token',
  adverse === amber,
  adverse
    ? `${lost} < ${cardPeak} Gb/s and the tile is ${amber ? 'amber' : 'an identity colour'}`
    : `${lost} >= ${cardPeak} Gb/s and the tile is ${amber ? 'still amber' : 'an identity colour'}`);

/* INSTALLED is printed in Tb/s; normalise before comparing. */
const installedRaw = num(installedTile.value);
const installed = /Tb\/s/.test(installedTile.value) ? installedRaw * 1000 : installedRaw;
check('W7 installed capacity is at least the committed transit',
  installed >= committed,
  `installed ${installedTile.value} = ${installed} Gb/s, committed ${committed} Gb/s`);

const failed = findings.filter((f) => !f.ok);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ findings }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

console.log('── WAN TRAFFIC STUDY ──');
for (const f of findings) console.log(`  ${f.ok ? '✓' : '✗'} ${f.id}\n      ${f.detail}`);
if (failed.length) {
  console.log(`\nFAIL — ${failed.length} identity(ies) in the WAN study do not close.`);
  console.log('The inputs are design selections and may change; a figure that does not follow');
  console.log('from them may not ship. Update the dependent figures in the same commit.');
  process.exit(1);
}
console.log(`\nPASS — ${findings.length} identities close; every printed WAN figure follows from the view's own stated inputs.`);
