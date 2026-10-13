#!/usr/bin/env node
/**
 * test-datahall-ai-hall-interact — the hall plan's micro-interaction contract (v3.21.5).
 *
 * js/datahall-ai/hall-interact.js spotlights a row / the liquid path / the air path, rings the
 * selected unit, reads the cursor in metres and crossfades a hall switch. Three ways it can break
 * silently, each an assertion here:
 *
 *   I1 the page loads the module (deferred, after equipment-inspector.js)
 *   I2 state is ATTRIBUTES only: no classList/className write in the module. rz-svg-legible refits on
 *      any class change under <body> and a refit resets the pan (v3.21.0 "Go to" chips looked dead).
 *   I3 the builder still emits every hook the spotlight joins on: data-pi on the row, its thermal
 *      cells, its containment and its sensors; data-row-l on the row label; hp-wall; and the scale
 *      the cursor readout divides by (window.__hallZones.ppm).
 *   I4 motion rules: no `transition: all`, the press scale sits behind
 *      prefers-reduced-motion:no-preference AND a fine hover pointer, nothing animates from scale(0).
 *
 * Proven RED on v3.21.4 (55ceff59): 9 findings — I1, I3 x7 (six hooks + hp-wall), I4 (no CSS block).
 * Run: node tools/test-datahall-ai-hall-interact.mjs
 */
import { readFileSync, existsSync } from 'node:fs';

const fails = [];
const page = readFileSync('datahallAI.html', 'utf8');
const MOD = 'js/datahall-ai/hall-interact.js';

const tagI = page.indexOf('src="' + MOD);
const inspI = page.indexOf('src="js/datahall-ai/equipment-inspector.js');
if (tagI < 0 || !existsSync(MOD)) fails.push('I1 datahallAI.html does not load ' + MOD);
else {
  if (!/hall-interact\.js\?v=[^"]+" defer>/.test(page)) fails.push('I1 hall-interact.js is not deferred');
  if (inspI < 0 || tagI < inspI) fails.push('I1 hall-interact.js must load after equipment-inspector.js');
}

if (existsSync(MOD)) {
  const mod = readFileSync(MOD, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  if (/classList|className\s*=/.test(mod)) fails.push('I2 ' + MOD + ' writes a class; hold UI state in attributes');
  if (/Math\.random\(/.test(mod)) fails.push('I2 ' + MOD + ' rolls Math.random');
}

const hooks = [
  ['rowg data-pi', /class="rowg" data-row="\$\{id\}" data-rg="RG-\$\{id\}" data-pi=/],
  ['thermal cells data-pi', /id="H\$\{pi\}\$\{si\}z" data-pi=/],
  ['containment data-pi', /class="hp-hac" data-pi=/],
  ['sensor groups data-pi', /class="hp-sens" data-pi=/],
  ['row label data-row-l', /data-row-l=/],
  ['cursor scale in __hallZones', /window\.__hallZones=\{[^}]*ppm:SC/],
];
for (const [name, re] of hooks) if (!re.test(page)) fails.push('I3 hall builder lost the hook: ' + name);
if (!/class="hp-wall"/.test(page)) fails.push('I3 hall walls are not marked hp-wall (the spotlight would dim the room itself)');

const css = (page.match(/v3\.21\.5 — micro-interactions[\s\S]*?\.hp-key \[data-hp-k\]:hover[^}]*\}\}/) || [''])[0];
if (!css) fails.push('I4 the v3.21.5 micro-interaction CSS block is missing');
else {
  if (/transition\s*:\s*all/.test(css)) fails.push('I4 transition: all');
  if (/scale\(0\)/.test(css)) fails.push('I4 a scale(0) entrance');
  const press = css.indexOf('scale(.94)'), gate = css.lastIndexOf('@media (prefers-reduced-motion:no-preference) and (hover:hover) and (pointer:fine)', press);
  if (press < 0 || gate < 0) fails.push('I4 the press scale is not gated on reduced motion and a fine pointer');
}

if (fails.length) {
  for (const f of fails) console.log('  FAIL  ' + f);
  console.log('[hall-interact] ' + fails.length + ' finding(s)');
  process.exit(1);
}
console.log('[hall-interact] PASS — module loaded, attribute-only state, every spotlight hook emitted, motion gated');
