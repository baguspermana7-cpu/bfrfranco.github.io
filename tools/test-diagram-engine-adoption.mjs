#!/usr/bin/env node
/* ============================================================================
 * test-diagram-engine-adoption.mjs — a ratchet, not an ultimatum
 * ----------------------------------------------------------------------------
 * The owner's instruction when the diagram engine was adopted was plain: when
 * you make a block diagram, use this engine. This gate is how that survives
 * contact with a codebase that already contains thousands of hand-typed
 * coordinates.
 *
 * WHY A RATCHET
 *
 * `datahallAI.html` alone carries ~1,470 calls to its own drawing primitives
 * and ~1,030 raw SVG coordinate literals. A gate that simply failed on any
 * hand-typed coordinate would fail on day one and stay failed, and a gate that
 * is always red teaches people to ignore it. A gate that only forbids the count
 * from RISING is enforceable today, and it makes the migration monotonic: every
 * release either leaves a drawing alone or moves it toward the engine.
 *
 * WHAT IT COUNTS
 *
 * Two kinds of hand-authored geometry, per file:
 *
 *   primitives  — calls to the page's own coordinate-taking draw helpers
 *                 (tx, tx2, lv, bx, bx2, eq, rm, symGen, …), whose first
 *                 arguments are x and y typed by a human.
 *   rawSvg      — SVG elements whose position is a numeric literal in source.
 *
 * Both are proxies, and deliberately crude ones: the gate does not need to
 * understand the drawing, only to notice that there is more hand-placement in
 * it than there was yesterday.
 *
 * WHAT IT DOES NOT COUNT
 *
 * Anything drawn through `RZDiagram`, because those coordinates are derived.
 * A file's count falling is the expected direction; the gate says so and asks
 * for a re-baseline rather than failing.
 *
 * SCOPE
 *
 * Every cockpit page.
 *
 * CORRECTION (v3.10.7): an earlier version of this comment claimed the geometry
 * survey reaches only `datahallAI.html`, because TAB_SETS names only that page.
 * That was wrong. TAB_SETS is the *tab-activation* registry — which drawings sit
 * behind which tab — and `test-conv-geometry.mjs` keeps a separate `DIAGRAMS`
 * list that already covers chiller-plant, fire-system, water-system,
 * fuel-system, ict and EPMS_Telemetry. Those pages are measured, and they
 * measure clean.
 *
 * The wider scope here is still right, for a narrower reason: this gate holds
 * cockpit surfaces the survey's list does NOT name — `all-in-one-dashboard`,
 * `rz-cockpit-mockup`, `js/ltc-system-modelling-lab.js` — and it holds every
 * page against a rise even where a drawing is currently collision-free, since
 * clean today says nothing about the next hand-typed coordinate.
 *
 * Article illustrations and incident diagrams stay out of scope: they are
 * one-off editorial figures, not instrument drawings, and sweeping them in
 * would bury the signal this gate exists to protect.
 *
 *   node tools/test-diagram-engine-adoption.mjs              # gate
 *   node tools/test-diagram-engine-adoption.mjs --baseline   # re-record
 * ==========================================================================*/
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TAB_SETS } from './lib/cockpit-tabs.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const BASELINE = join(here, 'diagram-adoption-baseline.json');
const REBASE = process.argv.includes('--baseline');

/* The page's own coordinate-taking draw helpers. Adding a new one here is the
 * right move when a cockpit grows a primitive — leaving it out would let a
 * whole family of hand-placement in unmeasured. */
const PRIMITIVES = [
  'tx', 'tx2', 'lv', 'bx', 'bx2', 'eq', 'eqLive', 'rm', 'rmLive',
  'symGen', 'symHX', 'symValve', 'symSensor', 'symPump', 'symTank',
  'isoLabel', 'isoBox', 'cblSide'
];
const PRIM_RE = new RegExp(`\\b(?:${PRIMITIVES.join('|')})\\s*\\(`, 'g');
const RAW_RE = /<(?:rect|circle|line|text|path|polyline|polygon|ellipse)\b[^>]*?\b(?:x|cx|x1|d|points)="[-0-9]/g;

/* The cockpit set, named in full.
 *
 * TAB_SETS holds only `datahallAI.html`, but that is a tab-activation registry,
 * not the survey's coverage: `test-conv-geometry.mjs` has its own `DIAGRAMS`
 * list which already includes the Track B P&IDs. Naming the cockpits here keeps
 * the ratchet independent of both lists, and picks up the surfaces neither one
 * mentions. Adding a page to TAB_SETS later changes nothing — the union is
 * taken. */
const COCKPITS = [
  'dc-conventional.html', 'datahall.html', 'chiller-plant.html', 'water-system.html',
  'fire-system.html', 'fuel-system.html', 'ict.html', 'EPMS_Telemetry.html',
  'all-in-one-dashboard.html', 'rz-cockpit-mockup.html'
];

/* Cockpit drawing modules that live outside the HTML. */
const EXTRA = ['js/dcai-render.js', 'js/dcai-fire-points.js', 'js/conv-render.js',
               'js/dcai-engine.js', 'js/conv-engine.js', 'js/ltc-system-modelling-lab.js'];

function countIn(text) {
  return {
    primitives: (text.match(PRIM_RE) || []).length,
    rawSvg: (text.match(RAW_RE) || []).length
  };
}

const files = [...new Set([...Object.keys(TAB_SETS), ...COCKPITS, ...EXTRA])]
  .filter(f => existsSync(join(root, f)))
  .sort();

const now = {};
for (const f of files) {
  const c = countIn(readFileSync(join(root, f), 'utf8'));
  now[f] = { ...c, total: c.primitives + c.rawSvg };
}

if (REBASE) {
  writeFileSync(BASELINE, JSON.stringify({
    note: 'Hand-authored geometry per cockpit file. This number may FALL freely; ' +
          'a rise fails the gate. Re-record with --baseline after a migration.',
    recorded: new Date().toISOString().slice(0, 10),
    files: now
  }, null, 2) + '\n');
  const total = Object.values(now).reduce((a, b) => a + b.total, 0);
  console.log(`BASELINE recorded — ${files.length} cockpit files, ${total} hand-authored coordinates`);
  for (const f of files) console.log(`  ${String(now[f].total).padStart(5)}  ${f}`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.log('FAIL diagram-engine adoption — no baseline. Run with --baseline once, then commit it.');
  process.exit(1);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const risen = [];
const fallen = [];
const added = [];

for (const f of files) {
  const b = base.files[f];
  if (!b) {
    /* A cockpit file the baseline has never seen. A NEW diagram has no excuse
     * for hand-placement — the engine exists — so any at all is a failure. */
    if (now[f].total > 0) added.push(`${f} — new cockpit file with ${now[f].total} hand-authored coordinates; draw it through RZDiagram`);
    continue;
  }
  if (now[f].total > b.total) {
    risen.push(`${f} — ${b.total} → ${now[f].total} (+${now[f].total - b.total}) ` +
               `[primitives ${b.primitives}→${now[f].primitives}, rawSvg ${b.rawSvg}→${now[f].rawSvg}]`);
  } else if (now[f].total < b.total) {
    fallen.push(`${f} — ${b.total} → ${now[f].total} (−${b.total - now[f].total})`);
  }
}

const total = Object.values(now).reduce((a, b) => a + b.total, 0);
const baseTotal = Object.values(base.files).reduce((a, b) => a + b.total, 0);

if (risen.length || added.length) {
  console.log(`FAIL diagram-engine adoption — hand-authored geometry went UP\n`);
  for (const r of [...added, ...risen]) console.log('  ' + r);
  console.log(`\n  Draw new diagrams through RZDiagram (js/rz-diagram.js). It sizes a node from`);
  console.log(`  its own text, places labels by search and routes connectors around what is in`);
  console.log(`  the way — see standarization/DIAGRAM_ENGINE_STANDARD.md.`);
  console.log(`  If the rise is deliberate and unavoidable, say why in the commit and re-record`);
  console.log(`  with --baseline so the next rise is still caught.`);
  process.exit(1);
}

console.log(`PASS diagram-engine adoption — ${total} hand-authored coordinates across ${files.length} cockpit files`);
console.log(`     baseline ${baseTotal}, ratchet holds (a rise fails; a fall is the point)`);
if (fallen.length) {
  console.log(`     ${fallen.length} file(s) migrated since the baseline — re-record with --baseline:`);
  for (const f of fallen) console.log('       ' + f);
}
