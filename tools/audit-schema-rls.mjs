#!/usr/bin/env node
// ============================================================================
// audit-schema-rls.mjs — static RLS/hardening checker for supabase/schema.sql
//
// FAILS (exit 1) if any of:
//   1. a `create table public.X` is not paired ANYWHERE in the file with
//      `alter table public.X enable row level security`
//   2. any policy uses `using (true)` or `with check (true)`
//   3. any line declares a plaintext `password` column (outside a comment)
//
// On success prints:  SCHEMA RLS AUDIT — N tables, all RLS-enabled
// No dependencies; pure Node ESM.
// ============================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, '..', 'supabase', 'schema.sql');

let raw;
try {
  raw = readFileSync(schemaPath, 'utf8');
} catch (err) {
  console.error(`FAIL: cannot read ${schemaPath}: ${err.message}`);
  process.exit(1);
}

const lines = raw.split(/\r?\n/);
const failures = [];

// Strip a trailing line comment (-- ...) so `create table` inside a comment
// doesn't register, and neither does the word "password" in explanatory prose.
// Keeps everything before the first `--`.
function stripComment(line) {
  const idx = line.indexOf('--');
  return idx === -1 ? line : line.slice(0, idx);
}

const codeLower = lines.map((l) => stripComment(l).toLowerCase()).join('\n');

// --- Check 1: every created public table has RLS enabled somewhere ----------
const createdTables = new Set();
const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/g;
for (let m; (m = createRe.exec(codeLower)); ) createdTables.add(m[1]);

const rlsEnabled = new Set();
const rlsRe = /alter\s+table\s+(?:if\s+exists\s+)?public\.([a-z_][a-z0-9_]*)\s+enable\s+row\s+level\s+security/g;
for (let m; (m = rlsRe.exec(codeLower)); ) rlsEnabled.add(m[1]);

for (const t of createdTables) {
  if (!rlsEnabled.has(t)) {
    failures.push(`table public.${t} is created but never has RLS enabled`);
  }
}

// --- Check 2: no permissive `using (true)` / `with check (true)` ------------
// EXCEPTION: a `for select` policy on a PUBLIC-READ config catalog (feature_flags /
// feature_overrides) may use `using (true)` — those tables hold only non-sensitive gating
// config the client must read to render tier access; every WRITE on them is is_root()-gated.
// `with check (true)` (a permissive WRITE) is NEVER allowed.
const PUBLIC_READ_TABLES = ['feature_flags', 'feature_overrides'];
lines.forEach((line, i) => {
  const code = stripComment(line).toLowerCase();
  if (/using\s*\(\s*true\s*\)/.test(code)) {
    const isPublicReadSelect =
      /\bfor\s+select\b/.test(code) &&
      PUBLIC_READ_TABLES.some((t) => new RegExp(`on\\s+public\\.${t}\\b`).test(code));
    if (!isPublicReadSelect) {
      failures.push(`line ${i + 1}: policy uses \`using (true)\` — must scope to auth.uid()/is_root()`);
    }
  }
  if (/with\s+check\s*\(\s*true\s*\)/.test(code)) {
    failures.push(`line ${i + 1}: policy uses \`with check (true)\` — permissive writes are never allowed`);
  }
});

// --- Check 3: no plaintext password column ---------------------------------
// Flag `password` appearing in code (comment already stripped). A real column
// declaration would be e.g. `password text` / `password_hash` — any code-side
// occurrence of the token is treated as a violation per the mandate.
lines.forEach((line, i) => {
  const code = stripComment(line).toLowerCase();
  if (/\bpassword\b/.test(code)) {
    failures.push(`line ${i + 1}: plaintext \`password\` token in schema code — no password/secret columns allowed`);
  }
});

if (failures.length > 0) {
  console.error('SCHEMA RLS AUDIT — FAILED:');
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log(`SCHEMA RLS AUDIT — ${createdTables.size} tables, all RLS-enabled`);
process.exit(0);
