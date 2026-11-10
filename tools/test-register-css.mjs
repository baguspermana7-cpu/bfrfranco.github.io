#!/usr/bin/env node
// A page that declares a design register (<html data-rz-register="editorial|tool|instrument">) must load a stylesheet
// that carries that register's rules, or the declaration does nothing (P23). The register -> file map is derived from
// the CSS itself (every css file containing [data-rz-register="X"]), never typed, so a new rule file counts at once.
// Scope: every .html under the site root, skipping vendored / generated / test trees.
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, dirname, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', 'tools', 'dcmoc', 'vendor', 'test-results', 'playwright-report']);
async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out); else out.push(p);
  }
  return out;
}
const files = await walk(ROOT);
const cssCarries = {}; // css path (relative) -> Set(register)
for (const f of files.filter((p) => p.endsWith('.css'))) {
  const regs = new Set([...(await readFile(f, 'utf8')).matchAll(/data-rz-register="([a-z-]+)"/g)].map((m) => m[1]));
  if (regs.size) cssCarries[relative(ROOT, f).split('\\').join('/')] = regs;
}
const fails = [];
let declared = 0;
for (const f of files.filter((p) => p.endsWith('.html'))) {
  const html = await readFile(f, 'utf8');
  const m = html.match(/<html[^>]*\sdata-rz-register="([a-z-]+)"/);
  if (!m) continue;
  declared++;
  const rel = relative(ROOT, f).split('\\').join('/');
  const dir = posix.dirname(rel);
  const loaded = [...html.matchAll(/<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi)]
    .map((t) => (t[0].match(/href=["']([^"'?#]+)/) || [])[1]).filter(Boolean)
    .map((h) => (h.startsWith('/') ? h.slice(1) : posix.normalize(posix.join(dir, h))));
  // also <link href=... rel=stylesheet> ordering and preload-as-style swapped to stylesheet
  const loadedAlt = [...html.matchAll(/<link[^>]+href=["']([^"'?#]+\.css)[^"']*["'][^>]*>/gi)]
    .filter((t) => /stylesheet|as=["']style/.test(t[0])).map((t) => (t[1].startsWith('/') ? t[1].slice(1) : posix.normalize(posix.join(dir, t[1]))));
  const all = new Set([...loaded, ...loadedAlt]);
  if (![...all].some((c) => cssCarries[c] && cssCarries[c].has(m[1]))) {
    fails.push(`${rel}: declares data-rz-register="${m[1]}" but loads none of ${Object.keys(cssCarries).filter((c) => cssCarries[c].has(m[1])).join(', ')}`);
  }
}
if (fails.length) { console.log(`FAIL test-register-css — ${fails.length} of ${declared} declaring pages load no rules for their register`); fails.forEach((x) => console.log('  ' + x)); process.exit(1); }
console.log(`PASS test-register-css — ${declared} pages declare a register and all ${declared} load its rules`);
