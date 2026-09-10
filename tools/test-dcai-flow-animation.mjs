#!/usr/bin/env node
/**
 * Flow animation invariants for datahallAI.html.
 *
 * The owner: "garis2 dan animasinya nggak tepat". Three separable defects were measured.
 *
 * 1. A DASH CYCLE THAT NEVER CLOSED. `stroke-dashoffset` must travel a WHOLE number of dash
 *    periods or the pattern jumps at the loop point. Before v2.18.0 the page ran offset 24 against
 *    a 10+5 dasharray (1.60 periods) and 16 against 6+4 (also 1.60), so every flow line on every
 *    diagram visibly snapped back 0.6 of a dash every 4 seconds. This is arithmetic, not taste, and
 *    it is checked from the stylesheet source.
 *
 * 2. A STATE CLASS WITH NO RULE. `js/datahall-ai/operator-ui.js` has toggled `rz-flow-partial`
 *    since the electrical state machine landed, and no stylesheet ever defined it — so a path
 *    carrying load with its redundancy LOST rendered identically to a healthy 2N path. That is the
 *    single distinction the drawing exists to show. Any class the runtime toggles must be styled.
 *
 * 3. REDUCED MOTION THAT COULD NOT REACH SMIL. `@media(prefers-reduced-motion:reduce)` stops CSS
 *    animation and has no authority over SVG SMIL. This page carries 71 <animate>, 4
 *    <animateMotion> and 11 <animateTransform> elements, and all of them kept moving for a viewer
 *    who had asked the system to stop. Only `SVGSVGElement.pauseAnimations()` reaches them.
 *
 * A CORRECTION, recorded rather than quietly dropped. v2.18.0 shipped a MONITOR here claiming
 * "2,880 of 9,630 tagged lines carry a flow class opposing their declared direction". That number
 * was WRONG, and the error was mine: it assumed fR/fD mean "forward" and fL/fU mean "reverse", so
 * every leftward-drawn line whose logical direction is forward counted as a defect. Re-measured
 * against the geometry the lines actually carry, the pairing is exact:
 *
 *     fD -> drawn downward   3,744        fR -> drawn rightward   1,512
 *     fL -> drawn leftward   1,494        exceptions                  0
 *
 * The two attributes are orthogonal and both were right all along. The CLASS names which way the
 * dashes travel across the screen; `data-direction` names the logical from -> to of the line in the
 * process. A pipe drawn right-to-left whose flow is logically forward correctly carries fL.
 *
 * So the monitor is replaced by the invariant that does hold, asserted at runtime as a GATE (check
 * 4 below): a line's flow class must match the direction its own endpoints run. That catches the
 * defect the monitor was reaching for — dashes travelling backwards along their own pipe — without
 * inventing a conflict between two attributes that never disagreed.
 *
 * Usage: node tools/test-dcai-flow-animation.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import { primeCockpitAuditDocument, enterAuthorizedAuditState } from './lib/cockpit-audit-state.mjs';
import { TAB_SETS, activateTab } from './lib/cockpit-tabs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const failures = [];

/* ---- 1. every animated dash cycle must close ----------------------------- */
const sources = [
  { path: 'datahallAI.html', text: read('datahallAI.html') },
  { path: 'css/datahall-ai-operator.css', text: read('css/datahall-ai-operator.css') },
];

function keyframeTravel(text, name) {
  const block = text.match(new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\n?\\s*\\}\\s*(?:\\}|@|\\.|#|/\\*|$)`));
  const scope = block ? block[1] : (text.split('@keyframes ' + name)[1] || '').slice(0, 220);
  const offsets = [...scope.matchAll(/stroke-dashoffset:\s*(-?[\d.]+)/g)].map((m) => Math.abs(Number(m[1])));
  return offsets.length ? Math.max(...offsets) : null;
}

let cyclesChecked = 0;
for (const { path, text } of sources) {
  /* a rule that sets BOTH a dasharray and an animation is a flow line */
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*stroke-dasharray[^{}]*animation[^{}]*|[^{}]*animation[^{}]*stroke-dasharray[^{}]*)\}/g)) {
    const selector = m[1].trim().split('\n').pop().trim();
    const body = m[2];
    const dash = body.match(/stroke-dasharray:\s*([\d.]+)\s+([\d.]+)/);
    const anim = body.match(/animation:\s*([A-Za-z][\w-]*)/);
    if (!dash || !anim) continue;
    const period = Number(dash[1]) + Number(dash[2]);
    const travel = keyframeTravel(text, anim[1]);
    if (travel == null || !period) continue;
    cyclesChecked += 1;
    const periods = travel / period;
    if (Math.abs(periods - Math.round(periods)) > 1e-9) {
      failures.push(`${path}  ${selector}: ${anim[1]} travels ${travel} against a ${period}-unit dash period `
        + `= ${periods.toFixed(2)} periods — the pattern snaps back every cycle. Use a whole multiple.`);
    }
  }
}
if (!cyclesChecked) failures.push('no animated dash cycles found — the detector stopped matching, which is itself a defect');

/* ---- 2. every class the runtime toggles must be styled ------------------- */
const runtime = read('js/datahall-ai/operator-ui.js');
const css = sources.map((s) => s.text).join('\n');
const toggled = new Set([...runtime.matchAll(/classList\.toggle\(\s*'(rz-flow-[\w-]+)'/g)].map((m) => m[1]));
for (const cls of toggled) {
  if (!new RegExp(`\\.${cls}\\s*[,{]`).test(css)) {
    failures.push(`operator-ui.js toggles .${cls} and no stylesheet defines it — the state renders as if it were not set`);
  }
}
if (!toggled.size) failures.push('no rz-flow-* class toggles found in operator-ui.js — the detector stopped matching');

/* ---- 3. reduced motion must reach SMIL ---------------------------------- */
const page = sources[0].text;
if (!/matchMedia\(\s*'\(prefers-reduced-motion: reduce\)'\s*\)/.test(page)) {
  failures.push('datahallAI.html has no prefers-reduced-motion matchMedia listener — a CSS media query cannot stop SVG SMIL');
}
if (!/pauseAnimations\(\)/.test(page)) {
  failures.push('datahallAI.html never calls pauseAnimations() — its 86 SMIL animations ignore reduced motion');
}

/* ---- 4. a line's dashes must travel the way the line is drawn --------------
   The class names the screen direction of dash travel, so it has to agree with the direction the
   line's own endpoints run. A line drawn leftward carrying fR animates its dashes back up its own
   pipe — the defect that reads, on a mimic, as flow going the wrong way. Measured across every
   diagram: 6,750 tagged lines, 0 exceptions. */
const EXPECT = { fR: 'right', fL: 'left', fD: 'down', fU: 'up' };
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const tab = await browser.newPage();
await tab.setViewport({ width: 1500, height: 1000 });
await primeCockpitAuditDocument(tab, 'dark');
await tab.goto(pathToFileURL(resolve(ROOT, 'datahallAI.html')).href, { waitUntil: 'networkidle0' });
await enterAuthorizedAuditState(tab, 'dc-ai');
const set = TAB_SETS['datahallAI.html'];
const seen = new Map();
for (const entry of set.diagrams) {
  await activateTab(tab, set, entry);
  await new Promise((r) => setTimeout(r, 90));
  const found = await tab.evaluate((view) => Array.from(document.querySelectorAll('[data-rz-line="1"]')).map((el) => {
    const cls = (el.getAttribute('class') || '').match(/\b(fR|fL|fU|fD)\b/);
    const n = (a) => Number(el.getAttribute(a));
    return { view, id: el.getAttribute('data-id') || '', cls: cls ? cls[1] : '',
      dx: n('x2') - n('x1'), dy: n('y2') - n('y1') };
  }), entry.label);
  for (const row of found) { if (row.cls) { seen.set(row.view + '|' + row.id, row); } }
}
await browser.close();

let checked = 0;
for (const row of seen.values()) {
  if (!isFinite(row.dx) || !isFinite(row.dy)) { continue; }   /* a path, not a straight line */
  const drawn = Math.abs(row.dx) >= Math.abs(row.dy)
    ? (row.dx > 0 ? 'right' : 'left')
    : (row.dy > 0 ? 'down' : 'up');
  checked += 1;
  if (EXPECT[row.cls] !== drawn) {
    failures.push(`${row.view} ${row.id || '(unnamed)'}: class ${row.cls} animates ${EXPECT[row.cls]} `
      + `but the line is drawn ${drawn} — its dashes run back up its own pipe`);
  }
}

console.log('── FLOW ANIMATION INVARIANTS ──');
console.log(`flow-class direction agreement: ${checked} tagged line(s) checked against their own endpoints`);
console.log(`dash cycles checked: ${cyclesChecked}; runtime flow classes: ${[...toggled].join(', ')}`);

if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`── ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('PASS — every dash cycle closes, every toggled state is styled, reduced motion reaches SMIL');
