#!/usr/bin/env node
/* ============================================================================
 * test-gate-wiring.mjs — every audit CLAUDE.md calls mandatory is actually run
 * ----------------------------------------------------------------------------
 * CLAUDE.md has a block headed "Audit before push" listing thirteen commands.
 * `tools/ship-gate.sh` is the thing that actually runs before a push. Those two
 * lists agreeing is not a property of anything — nobody checks it — and on
 * 2026-09-20 they did not agree: **seven** of the thirteen were absent from the
 * gate, including `audit-dark-coverage.mjs`, which guards a defect CLAUDE.md
 * itself records shipping three separate times in one session, and
 * `audit-page-gates.mjs`, which guards root-gated lab pages staying locked.
 *
 * An audit that exists but is not wired runs exactly as long as somebody
 * remembers to type it. That is not a gate, it is a habit.
 *
 * This is the sibling of `test-audit-coverage.mjs`, which asserts no PAGE
 * escapes the audits. This one asserts no AUDIT escapes the gate.
 *
 * An audit may be left out deliberately — but then it is named here with the
 * reason, so the absence is a decision on the record rather than an oversight.
 *
 *   node tools/test-gate-wiring.mjs
 * ==========================================================================*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/* Audits deliberately outside the pre-push gate, each with its reason. Adding a
 * name here is allowed; adding it without a reason is not, and the test below
 * enforces that. */
const DECLARED_OUT = Object.freeze({
  'audit-seo.py':
    'reports per-page meta health as advice (long descriptions, missing OG). ' +
    'CLAUDE.md marks it non-strict, and it has no pass/fail contract to gate on.',
});

/** Commands named in CLAUDE.md's "Audit before push" block. */
export function auditsNamedInClaudeMd(md) {
  const start = md.indexOf('**Audit before push**');
  if (start === -1) throw new Error('CLAUDE.md no longer has an "Audit before push" block');
  const fenceStart = md.indexOf('```', start);
  const fenceEnd = md.indexOf('```', fenceStart + 3);
  if (fenceStart === -1 || fenceEnd === -1) throw new Error('the "Audit before push" block is not fenced');
  const block = md.slice(fenceStart, fenceEnd);
  return [...new Set(
    [...block.matchAll(/(?:python3|node)\s+tools\/([a-z0-9-]+\.(?:py|mjs))/g)].map((m) => m[1])
  )].sort();
}

/** Tool files the ship gate actually invokes. Comments are stripped first: a
 *  gate named only in a `#` comment is documentation, not a gate. */
export function toolsRunByGate(sh) {
  const code = sh.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  return new Set([...code.matchAll(/tools\/([a-z0-9-]+\.(?:py|mjs|sh))/g)].map((m) => m[1]));
}

/* ---- run ----------------------------------------------------------------
 * Only when invoked directly. The two parsers above are imported by
 * test-gate-wiring-parsers.mjs to be proven on synthetic input, and a module
 * body that runs on import would execute the whole gate — against the real
 * CLAUDE.md and ship-gate.sh — as a side effect of importing a function.
 * ------------------------------------------------------------------------ */
/* The guard is INVERTED on purpose. Comparing `import.meta.url` to `argv[1]`
 * is the usual idiom, but it fails open in the direction that matters: on a
 * symlinked checkout the two paths differ, the module body is skipped, node
 * exits 0, and the gate reports nothing while appearing to pass. Silence that
 * looks like success is the failure this whole suite exists to remove.
 *
 * So the gate RUNS unless a consumer explicitly opts out, which only
 * test-gate-wiring-parsers.mjs does, by setting this before a dynamic import. */
if (process.env.RZ_GATE_WIRING_PARSERS_ONLY !== '1') {

const md = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
const sh = readFileSync(join(root, 'tools', 'ship-gate.sh'), 'utf8');

const named = auditsNamedInClaudeMd(md);
const run = toolsRunByGate(sh);

const missing = named.filter((a) => !run.has(a) && !DECLARED_OUT[a]);
const declared = named.filter((a) => !run.has(a) && DECLARED_OUT[a]);
/* a name declared out that IS wired is stale bookkeeping — say so rather than pass quietly */
const staleDeclarations = Object.keys(DECLARED_OUT).filter((a) => run.has(a));
const unreasoned = Object.entries(DECLARED_OUT)
  .filter(([, why]) => !why || String(why).trim().length < 20)
  .map(([a]) => a);

console.log(`GATE WIRING — ${named.length} audit(s) named mandatory in CLAUDE.md, ` +
            `${named.length - missing.length - declared.length} wired into ship-gate.sh`);
for (const a of named) {
  const state = run.has(a) ? 'wired' : (DECLARED_OUT[a] ? 'declared out' : 'MISSING');
  console.log(`  ${a.padEnd(30)} ${state}`);
}
for (const a of declared) console.log(`\n  ${a} is out by decision — ${DECLARED_OUT[a]}`);

const problems = [];
if (missing.length) {
  problems.push(
    `${missing.length} audit(s) CLAUDE.md calls mandatory are NOT in ship-gate.sh: ${missing.join(', ')}\n` +
    `    Wire each into tools/ship-gate.sh, or name it in DECLARED_OUT here with the reason.\n` +
    `    An audit nobody runs is not a gate, it is a habit.`);
}
if (staleDeclarations.length) {
  problems.push(`declared out but actually wired (stale bookkeeping): ${staleDeclarations.join(', ')}`);
}
if (unreasoned.length) {
  problems.push(`declared out with no real reason given: ${unreasoned.join(', ')}`);
}

if (problems.length) {
  console.log('\nFAIL gate wiring\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('\nPASS — every audit CLAUDE.md calls mandatory is wired into the pre-push gate' +
            (declared.length ? `, ${declared.length} declared out with a reason` : ''));

}
