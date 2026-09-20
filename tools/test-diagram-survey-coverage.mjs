#!/usr/bin/env node
/* ============================================================================
 * test-diagram-survey-coverage.mjs — is every cockpit still being measured?
 * ----------------------------------------------------------------------------
 * `tools/test-conv-geometry.mjs` measures label collisions, clipping and
 * legibility on the cockpit drawings. It measures the pages named in its own
 * `DIAGRAMS` array, and nothing else.
 *
 * A hand-maintained target list fails silently in the one direction that
 * matters: a page it does not name is not reported as unmeasured, it is simply
 * absent — and absence reads exactly like clean. That is not hypothetical.
 * Before v1.135.0 no render gate had ever opened eight of `datahallAI.html`'s
 * tabs, so every gate measured an empty set and called the page clean while it
 * carried roughly 2,050 sub-floor labels and 200 overlapping pairs.
 *
 * It is just as easy to get wrong in the other direction, and one afternoon
 * managed both. `tools/lib/cockpit-tabs.mjs` exports TWO registers: `TAB_SETS`,
 * which names only pages needing a tab clicked (just datahallAI.html), and
 * `NO_TAB_SET`, which names cockpits declared to have no tab system. First
 * TAB_SETS was read as a coverage list and six measured pages were reported
 * unmeasured; then, correcting that, a grep for quoted page keys returned both
 * registers at once and TAB_SETS was reported as holding all seven. Neither
 * claim survived reading the gate's own target list.
 *
 * This gate settles the question from the filesystem instead of from either
 * list: every cockpit page is measured by the survey, or carries a written
 * reason why not.
 *
 * Run:  node tools/test-diagram-survey-coverage.mjs   (from rz-work/)
 * ==========================================================================*/
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/* WHAT COUNTS AS A COCKPIT
 *
 * The first cut of this gate looked for "a page with a process-sized SVG" and
 * flagged forty of them, because a 200-unit viewBox is just as likely to be a
 * hero graphic or a chart. It also had the sign backwards on the pages that
 * matter: every real cockpit drawing is BUILT AT RUNTIME by JavaScript, so its
 * `<svg>` is empty in source and a source scan cannot see the thing it is
 * looking for.
 *
 * So identify the page, not the drawing. A cockpit is a page that loads the
 * instrument shell, `css/rz-cockpit-instrument.css` — the stylesheet that makes
 * a page one of these consoles. That is structural, visible in source, and true
 * whether or not the drawing has rendered yet.
 *
 * It must be a real <link>, not a mention: changelog.html quotes the filename
 * in its release notes and would otherwise match its own prose.
 */
const SHELL = /<link\b[^>]+href="[^"]*css\/rz-cockpit-instrument\.css/i;

/* Cockpit pages the survey should not measure. A reason is mandatory —
 * "we have not got to it" is not a reason, it is a finding. */
const EXCLUSIONS = Object.freeze({
  'dc-conventional.html':
    'a hub, not a console: it loads the cockpit shell for its sidebar but holds no process ' +
    'drawing of its own (its only SVG is a 24x24 icon), and every subsystem it links to — ' +
    'chiller-plant, fire-system, water-system, fuel-system, ict, EPMS_Telemetry — is measured ' +
    'in its own right',
});

/* ---- the survey's own target list, read from its source -------------------
 * Read rather than re-typed. A second copy of the list is exactly the drift
 * this gate exists to catch. */
const geomSrc = readFileSync(join(root, 'tools/test-conv-geometry.mjs'), 'utf8');
const diagramPages = new Set([...geomSrc.matchAll(/page:\s*'([^']+)'/g)].map((m) => m[1]));
/* datahallAI's drawings are spread in from TAB_SETS rather than typed out, so
 * its name appears in that spread expression instead of a `page:` literal. */
if (/TAB_SETS\['datahallAI\.html'\]/.test(geomSrc)) diagramPages.add('datahallAI.html');

/* Two exports, two different jobs, and conflating them is the mistake this gate
 * was written after making:
 *
 *   TAB_SETS   — pages whose drawings need a tab CLICKED before they exist.
 *                Exactly one page qualifies: datahallAI.html.
 *   NO_TAB_SET — cockpits declared to have no tab system, each with a written
 *                reason ('datahall.html': 'rack field is HTML; no SVG process
 *                diagram exists'). This is the declared-empty register.
 *
 * Grepping the file for quoted page keys returns both and reads as one list. */
const { NO_TAB_SET } = await import('./lib/cockpit-tabs.mjs');
const declaredEmpty = new Map(
  Object.entries(NO_TAB_SET).filter(([, v]) => typeof v === 'string')
);

/** Largest SVG side in the source, in user units. Icons are 24; sheets are 900+. */
function largestSvg(html) {
  let biggest = 0;
  for (const m of html.matchAll(/<svg\b[^>]*>/gi)) {
    const tag = m[0];
    const vb = /viewBox="([^"]+)"/i.exec(tag);
    if (vb) {
      const p = vb[1].trim().split(/[\s,]+/).map(Number);
      if (p.length === 4 && p.every(Number.isFinite)) {
        biggest = Math.max(biggest, p[2], p[3]);
        continue;
      }
    }
    const w = /\bwidth="(\d+)/i.exec(tag);
    const h = /\bheight="(\d+)/i.exec(tag);
    biggest = Math.max(biggest, w ? Number(w[1]) : 0, h ? Number(h[1]) : 0);
  }
  return biggest;
}

/* A page whose drawings are all runtime-built has no large SVG in source, which
 * is normal and expected. This threshold is only used to check that a DECLARED
 * exclusion is still honest — it never promotes a page into scope. */
const ICON_MAX = 64;

const pages = readdirSync(root).filter((f) => f.endsWith('.html')).sort();
const findings = [];
const measured = [];
const excused = [];
const declaredOk = [];

for (const page of pages) {
  const html = readFileSync(join(root, page), 'utf8');
  if (!SHELL.test(html)) continue;                       /* not a cockpit */

  if (diagramPages.has(page)) { measured.push(page); continue; }

  if (declaredEmpty.has(page)) {
    const biggest = largestSvg(html);
    if (biggest > ICON_MAX) {
      findings.push(
        `${page} is declared to have no process diagram ("${declaredEmpty.get(page)}") but its ` +
        `source now carries an SVG ${biggest} units across — the declaration has gone stale`
      );
    } else {
      declaredOk.push(`${page} — ${declaredEmpty.get(page)}`);
    }
    continue;
  }

  if (Object.prototype.hasOwnProperty.call(EXCLUSIONS, page)) {
    excused.push(`${page} — ${EXCLUSIONS[page]}`);
    continue;
  }

  findings.push(
    `${page} loads the cockpit shell and NOTHING measures it. Add it to DIAGRAMS in ` +
    `tools/test-conv-geometry.mjs, or give it a written reason in EXCLUSIONS here.`
  );
}

/* A stale exclusion is its own defect: it claims a page needs excusing when the
 * page is gone, or has since been brought into the survey. */
for (const page of Object.keys(EXCLUSIONS)) {
  if (!pages.includes(page)) {
    findings.push(`EXCLUSIONS names ${page}, which does not exist — delete the entry`);
  } else if (diagramPages.has(page)) {
    findings.push(`EXCLUSIONS names ${page}, which DIAGRAMS now measures — delete the entry`);
  } else if (!SHELL.test(readFileSync(join(root, page), 'utf8'))) {
    findings.push(`EXCLUSIONS names ${page}, which is no longer a cockpit — delete the entry`);
  }
}

/* ---- verdict ------------------------------------------------------------ */
const total = measured.length + declaredOk.length + excused.length + findings.length;
console.log(`DIAGRAM SURVEY COVERAGE — ${pages.length} pages scanned, ${total} cockpit(s) found`);
console.log(`  measured by test-conv-geometry : ${measured.length}`);
for (const m of measured) console.log(`    ${m}`);
if (declaredOk.length) {
  console.log(`  declared empty in NO_TAB_SET   : ${declaredOk.length}`);
  for (const d of declaredOk) console.log(`    ${d}`);
}
if (excused.length) {
  console.log(`  excluded with a written reason : ${excused.length}`);
  for (const e of excused) console.log(`    ${e}`);
}

if (findings.length) {
  console.log(`\nFAIL — ${findings.length} cockpit(s) escape the geometry survey:`);
  for (const f of findings) console.log(`  ${f}`);
  process.exit(1);
}
console.log('\nPASS — every cockpit is measured, declared empty, or excluded with a reason');
