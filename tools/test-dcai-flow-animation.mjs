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
 * MONITOR, not gated, with the number recorded: 2,880 of the 9,630 tagged lines that carry both a
 * `data-direction` and a flow class carry a class whose travel OPPOSES their declared direction
 * (measured 2026-09-09; almost all are the `dh1-semantic-*` family on the building isometric,
 * which `tools/probe-line-model.mjs` already reports separately). Direction is a hand-written
 * `cssClass` literal kept in sync with the model's own `direction` field by hand —
 * `js/rz-line-model.js:138-160` `styleAttrs()` never reads `spec.direction`. FLIP CONDITION: this
 * becomes a gate when `styleAttrs()` derives the class from the direction and the count reaches 0.
 *
 * Usage: node tools/test-dcai-flow-animation.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

console.log('── FLOW ANIMATION INVARIANTS ──');
console.log(`dash cycles checked: ${cyclesChecked}; runtime flow classes: ${[...toggled].join(', ')}`);
console.log('MONITOR — 2,880 of 9,630 tagged lines carry a flow class opposing their declared direction '
  + '(the dh1-semantic-* family); flips to a gate when rz-line-model styleAttrs() derives the class.');
if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`── ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('PASS — every dash cycle closes, every toggled state is styled, reduced motion reaches SMIL');
