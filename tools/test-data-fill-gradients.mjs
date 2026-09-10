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

/* v3.6.0 — the gate now holds all three classes owner comment (21) named. The bar charts were
   v2.17.0; these two are the rest of that sentence.

   A FILLED SEVERITY PILL is a badge that states a level — pro, gated, risk-high, tier-2 — painted
   with a saturated gradient. The instrument language for a chip is a flat low-alpha tint, a 1 px
   hairline and the accent as ink, which is what every cockpit chip on this site already does. A
   gradient-filled pill reads as a button that cannot be pressed.

   A CARD WASH is the same gradient on a surface that holds content rather than states a level.
   Both are decoration on a surface whose job is to be read. */
const PILL_SEL = /(badge|pill|chip|tag|-flag|severity|status|rank|risk|tier|level)/i;
const SURFACE_SEL = /(card|panel|tile|box|callout|bento|insight|feature|note|stat|widget|block|highlight|swing-bar|gauge)/i;
const FUNCTIONAL_SEL = /(nav|navbar|modal|overlay|backdrop|gate|search|palette|ticker|dropdown|tooltip|sticky|header|drawer|sheet|toast|menu|btn|button|input|select|field|form|dialog|popover|inspector|hmi|tab|scroll|cursor|marquee|share)/i;

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
  /* the selector class must admit DESCENDANT selectors: `.sa-level-3 .sa-badge` and
   `.article-title .highlight` are exactly the shape this rule is for, and a class without
   a space silently skipped every one of them. */
  for (const block of text.matchAll(/([.#][A-Za-z0-9_.:\[\]="'>~+ -]{1,90})\s*\{([^}]{0,600}?)\}/g)) {
    const [, selector, body] = block;
    const isDataFill = DATA_FILL_SEL.test(selector);

    if (isDataFill) {
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
      continue;
    }

    /* the other two classes: a level stated in a gradient, and a reading surface washed in one */
    if (FUNCTIONAL_SEL.test(selector) || !/background/.test(body)) { continue; }
    for (const gradient of body.match(/linear-gradient\([^)]*\)/gi) || []) {
      if (stops(gradient) !== 2) { continue; }          /* 3+ stops is a scale axis */
      if (PILL_SEL.test(selector)) {
        findings.push({ file, selector, gradient: 'filled severity pill: ' + gradient.slice(0, 44) });
      } else if (SURFACE_SEL.test(selector)) {
        findings.push({ file, selector, gradient: 'card wash: ' + gradient.slice(0, 44) });
      }
    }
  }
}

if (findings.length) {
  console.error(`── DATA-FILL GRADIENTS ── ${findings.length} finding(s)`);
  for (const f of findings) console.error(`  ✗ ${f.file}  ${f.selector}  ${f.gradient}`);
  console.error('A data fill, a severity pill and a reading surface each take one flat colour.\n'
  + 'Three or more stops is a scale axis and is allowed. A chip is a flat tint, a hairline and accent ink.');
  process.exit(1);
}
console.log('decorative gradients — PASS (0 two-stop gradients on value fills, severity pills or reading surfaces)');
