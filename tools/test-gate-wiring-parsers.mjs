#!/usr/bin/env node
/* ============================================================================
 * test-gate-wiring-parsers.mjs — prove test-gate-wiring's two parsers on
 * synthetic input, so the gate cannot pass by failing to read its own sources.
 * ----------------------------------------------------------------------------
 * The whole value of `test-gate-wiring.mjs` rests on two string parsers. If
 * `toolsRunByGate()` silently matched nothing, the gate would report every
 * audit MISSING (loud, harmless). If it matched too much — a tool named in a
 * COMMENT, say — the gate would report an unwired audit as wired, which is
 * silent and exactly the failure it exists to prevent.
 *
 * Both directions are asserted here against hand-written input, never against
 * the real CLAUDE.md or ship-gate.sh, which a parallel session may have dirty.
 *
 *   node tools/test-gate-wiring-parsers.mjs
 * ==========================================================================*/
/* Opt the gate out of running, then import it for its parsers only. Set before
 * the dynamic import, because a static import would hoist above this line. */
process.env.RZ_GATE_WIRING_PARSERS_ONLY = '1';
const { auditsNamedInClaudeMd, toolsRunByGate } = await import('./test-gate-wiring.mjs');

let pass = 0;
const fails = [];
const ok = (id, cond, detail) => { if (cond) pass++; else fails.push(`${id} — ${detail}`); };

/* ---- auditsNamedInClaudeMd ---------------------------------------------- */

const MD = `
# CLAUDE.md

Some prose mentioning tools/audit-decoy.py which is NOT in the block.

**Audit before push**:
\`\`\`bash
python3 tools/audit-script-tags.py --strict        # comment
node   tools/audit-dark-coverage.mjs --strict
python3 tools/audit-seo.py
node   tools/audit-dark-coverage.mjs --strict      # a duplicate
\`\`\`

Later prose naming tools/audit-other.mjs outside the block.
`;

{
  const got = auditsNamedInClaudeMd(MD);
  ok('A1', got.length === 3, `three distinct audits expected, got ${got.length}: ${got}`);
  ok('A2', got.includes('audit-script-tags.py') && got.includes('audit-dark-coverage.mjs'),
    `both named audits must be found: ${got}`);
  ok('A3', !got.includes('audit-decoy.py') && !got.includes('audit-other.mjs'),
    `tools named OUTSIDE the block must not count: ${got}`);
  ok('A4', new Set(got).size === got.length, 'duplicates must collapse');
  ok('A5', got.join() === [...got].sort().join(), 'output is sorted, so diffs are stable');
}

/* A6: the block moving or losing its fence must THROW, not return an empty
 *     list. An empty list would make every audit look wired and the gate would
 *     pass while checking nothing. */
{
  let threw = false;
  try { auditsNamedInClaudeMd('# no such block here'); } catch { threw = true; }
  ok('A6', threw, 'a missing "Audit before push" block must throw, not return []');

  let threw2 = false;
  try { auditsNamedInClaudeMd('**Audit before push**: no fence follows'); } catch { threw2 = true; }
  ok('A7', threw2, 'an unfenced block must throw');
}

/* ---- toolsRunByGate ------------------------------------------------------ */

const SH = `#!/usr/bin/env bash
# This comment mentions tools/audit-commented-out.mjs and must NOT count.
gate "real one" node tools/audit-dark-coverage.mjs --strict
   # an indented comment naming tools/audit-also-commented.py
gate "another" python3 tools/audit-script-tags.py --strict
gate "sub-script" bash tools/some-helper.sh
`;

{
  const got = toolsRunByGate(SH);
  ok('B1', got.has('audit-dark-coverage.mjs'), 'a tool on a gate line counts');
  ok('B2', got.has('audit-script-tags.py'), 'both invocation styles count');
  ok('B3', got.has('some-helper.sh'), 'a .sh helper counts too');
  /* the load-bearing one: a tool named only in a comment is documentation. If
   * this leaked, an unwired audit would be reported as wired — silently. */
  ok('B4', !got.has('audit-commented-out.mjs'), 'a tool named in a # comment must NOT count');
  ok('B5', !got.has('audit-also-commented.py'), 'an INDENTED # comment must not count either');
  ok('B6', got.size === 3, `exactly three tools expected, got ${got.size}: ${[...got]}`);
}

/* ---- verdict ------------------------------------------------------------- */
const total = pass + fails.length;
if (fails.length) {
  console.log(`FAIL gate-wiring parsers — ${fails.length} of ${total}\n`);
  for (const f of fails) console.log('  ' + f);
  process.exit(1);
}
console.log(`PASS gate-wiring parsers — ${pass}/${total}`);
console.log('     a tool named in a comment is documentation, not a gate');
