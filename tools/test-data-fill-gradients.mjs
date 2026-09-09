#!/usr/bin/env node
/**
 * A bar does not need a gradient.
 *
 * Owner comment (21) named this directly: "saturated red/amber/green bar charts" are
 * AI-design slop. A bar, gauge, meter or score fill ENCODES A VALUE — its length is the
 * datum and its colour is the severity. A two-stop gradient across it adds a second visual
 * axis that means nothing, which is what produces the glossy-pill look. The site's own
 * cockpits already do it correctly: `.bar-fill` in datahall.html declares no background at
 * all and receives one flat colour from the engine.
 *
 * The distinction this gate draws is STRUCTURAL, not a matter of taste:
 *
 *   TWO colour stops  = decoration. Both ends carry the same meaning, so flattening to the
 *                       first stop loses no information and invents no colour.
 *   THREE OR MORE     = a scale axis. The green-amber-red track of a gauge that a needle or
 *                       marker is read against; there the gradient IS the information.
 *
 * Four multi-stop scales exist and are deliberately left alone: `.gauge-bar` on articles 16,
 * 17 and 18, and `.risk-gauge-bar` on article 5.
 *
 * RED baseline, measured on the tree before the v2.17.0 sweep:
 *   44 two-stop gradient fills across 19 pages (39 saturated severity pairs, 5 token- or
 *   blue-based), plus one white-to-transparent gloss overlay on `.ig-bar-fill::after`.
 * GREEN after: 0.
 *
 * This is a separate gate rather than a rule inside tools/audit-vibecode.mjs because that
 * file was being edited concurrently by another agent when this landed. Fold it in when that
 * work settles; the vocabulary and the two-versus-three-stop rule are what matter, not where
 * they live.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* An element whose length encodes a value. */
const DATA_FILL_SEL =
  /(bar-fill|score-bar|gauge-bar|risk-gauge|tornado-bar|sensitivity-fill|progress-fill|meter-fill|rank-(?:high|med|mid|low)|-fill\b)/i;

/* The simulation cockpits paint bars from the engine at runtime and declare no gradient in
   CSS; they are listed so a future inline-styled cockpit cannot be read as a static finding. */
const INSTRUMENT = new Set(['datahallAI.html', 'dc-conventional.html', 'datahall.html',
  'chiller-plant.html', 'fire-system.html', 'fuel-system.html', 'water-system.html', 'ict.html',
  'EPMS_Telemetry.html', 'cdu-mini-bms.html', 'rz-cockpit-mockup.html', 'all-in-one-dashboard.html',
  'rz-ops-p7x3k9m.html']);

function stops(gradient) {
  return (gradient.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|var\(\s*--/g) || []).length;
}

const findings = [];
for (const file of readdirSync(ROOT).filter((n) => n.endsWith('.html') && !INSTRUMENT.has(n))) {
  const text = readFileSync(resolve(ROOT, file), 'utf8');
  for (const block of text.matchAll(/([.#][A-Za-z0-9_.:\[\]="'-]+)\s*\{([^}]*)\}/g)) {
    const [, selector, body] = block;
    if (!DATA_FILL_SEL.test(selector)) continue;
    for (const gradient of body.match(/linear-gradient\([^)]*\)/gi) || []) {
      if (stops(gradient) === 2) {
        findings.push({ file, selector, gradient: gradient.slice(0, 64) });
      }
    }
    /* A white-to-transparent sheen laid over a data fill is the same defect wearing a
       pseudo-element: it is decoration on top of an encoded value. */
    if (/::(?:after|before)/.test(selector)
        && /linear-gradient\([^)]*rgba?\(\s*255\s*,\s*255\s*,\s*255/i.test(body)) {
      findings.push({ file, selector, gradient: 'white gloss overlay' });
    }
  }
}

if (findings.length) {
  console.error(`── DATA-FILL GRADIENTS ── ${findings.length} finding(s)`);
  for (const f of findings) console.error(`  ✗ ${f.file}  ${f.selector}  ${f.gradient}`);
  console.error('A data fill takes one flat colour. Three or more stops is a scale axis and is allowed.');
  process.exit(1);
}
console.log('data-fill gradients — PASS (0 two-stop gradients or gloss overlays on value-encoding fills)');
