#!/usr/bin/env node
/**
 * report-register-wiring — how far the declared two-register system reaches.
 *
 * NOT A GATE. It reports a measured gap and exits 0. That distinction is the
 * point of the file, so it is worth saying why.
 *
 * WHAT WAS MEASURED (2026-10-03)
 *
 * `documentation/design.md` s16.2 locks a two-register system, "Decision LOCKED
 * 2026-06-01: HYBRID", and `DARK_MODE_STANDARD.md` says the tokens are "Defined
 * in `css/rz-dark.css` under `[data-rz-register]`". A page opts in with one
 * attribute on <html>:
 *
 *     <html lang="en" data-rz-register="editorial">
 *
 * **90 pages declare a register — 74 editorial, 16 instrument. `css/rz-dark.css`
 * is loaded by 3 pages**, two of which are `rz-index-mockup.html` and
 * `plan-dark-mode-standard.html`, and it is `@import`ed by nothing. Asked in a
 * real browser whether the declared register's own tokens resolve, **88 of 90
 * pages answer no.**
 *
 * So the shared token layer that two standards name as the single source of
 * truth reaches almost nothing. Every page paints its register with its own
 * bespoke CSS instead.
 *
 * WHY THIS IS A REPORT AND NOT A GATE
 *
 * Because those pages look right. `audit-dark-coverage` passes 161 content pages
 * in both themes and the cockpits work. A bespoke skin that satisfies the
 * register's character is not a defect, and a gate that failed all 88 would be
 * crying wolf on its first run -- which is precisely how this repo has ended up
 * with gates wired as `; true` before.
 *
 * What the gap actually costs is narrower and real:
 *   - an edit to `css/rz-dark.css` changes almost nothing, while both standards
 *     say it is where the register is defined;
 *   - `--rz-radius` per register resolves on 3 pages, so a rule keyed to the
 *     TOKEN would be measuring nothing. `tools/audit-vibecode.mjs` keys its
 *     register ceilings off the CSS SELECTOR scope instead, which is why that
 *     rule still works;
 *   - on the 32 editorial pages that load neither `css/rz-article-dark.css` nor
 *     `js/rz-article-editorial.js`, `flattenWashes()` never runs, so 73 live
 *     translucent card washes sit on pages declaring the register whose own
 *     standard bans them.
 *
 * Deciding what to do about it is a per-page visual judgement -- six of the 32
 * are calculators, where the editorial ARTICLE surface may be the wrong register
 * rather than a missing link. Recorded as the headline OPEN row in
 * `standarization/UIUX_AUDIT_LEDGER.md`.
 *
 * HOW IT MEASURES
 *
 * It renders each page and asks `getComputedStyle(documentElement)` whether the
 * register's own custom properties resolve. A resolved value proves the
 * register's stylesheet arrived by whatever path -- link, @import, bundle.
 * Grepping for a filename would answer a weaker question.
 *
 * Run:  node tools/report-register-wiring.mjs [--page=x.html]
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, join, relative } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const ONLY = (ARGS.find((a) => a.startsWith('--page=')) || '').split('=')[1] || null;

const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.pdf': 'application/pdf',
});

/* The tokens each register is DEFINED BY, in css/rz-dark.css. Chosen because
   they differ between the two registers, so a resolved value also proves the
   RIGHT register arrived and not merely some stylesheet. */
const REGISTER_TOKENS = Object.freeze({
  editorial:  { '--rz-accent': '#E8B563', '--rz-radius': '10px' },
  instrument: { '--rz-accent': '#22F5A8', '--rz-radius': '3px' },
});

/* Declared exemptions, each with a reason. A page may legitimately opt out of
   the register's skin while keeping the attribute for a tool that reads it. */
const EXEMPT = new Map([
  ['article-9-paper.html',
   'print/paper document — carries its own paper skin and is already exempt in audit-vibecode PAPER_DOCUMENTS'],
]);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dcmoc', 'games', 'Dunia-Emosi',
  'obsidian-knowledge-vault', '.claude', 'Documents', 'review', 'Apps', 'standarization',
  'cf-worker', '.next', 'Article', 'Data']);

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) await walk(p, out);
    else if (entry.name.endsWith('.html')) out.push(p);
  }
  return out;
}

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
      const file = resolve(ROOT, rel);
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, port: server.address().port };
}

const DECLARES = /<html[^>]*\bdata-rz-register=["']([a-z]+)["']/i;
const targets = [];
for (const file of (await walk(ROOT)).sort()) {
  const rel = relative(ROOT, file);
  if (ONLY && rel !== ONLY) continue;
  const m = DECLARES.exec(await readFile(file, 'utf8'));
  if (m && REGISTER_TOKENS[m[1]]) targets.push({ rel, register: m[1] });
}

const { server, port } = await serve();
const base = `http://127.0.0.1:${port}`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('dialog', (d) => d.dismiss().catch(() => {}));
await page.setViewport({ width: 1440, height: 900 });

console.log('── REGISTER WIRING (report, not a gate) ──');
console.log(`  ${targets.length} page(s) declare a register · asking the browser whether its tokens resolve\n`);

const findings = [];
const byRegister = {};
// Navigation under load is this repo's known flake (dark-coverage and
// test-mobile-nav both hit it), so a failure is retried once with a longer
// budget before it is allowed to become a finding.
for (const t of targets) {
  byRegister[t.register] = (byRegister[t.register] || 0) + 1;
  let resolved;
  for (const timeout of [45000, 90000]) {
    try {
      await page.goto(`${base}/${t.rel}`, { waitUntil: 'load', timeout });
      resolved = await page.evaluate((want) => {
        const cs = getComputedStyle(document.documentElement);
        const out = {};
        for (const k of Object.keys(want)) out[k] = cs.getPropertyValue(k).trim();
        return out;
      }, REGISTER_TOKENS[t.register]);
      break;
    } catch (e) {
      if (timeout === 90000) { findings.push({ ...t, kind: 'page-error', detail: String(e.message).slice(0, 90) }); }
    }
  }
  if (!resolved) continue;
  const want = REGISTER_TOKENS[t.register];
  const missing = Object.keys(want).filter((k) => !resolved[k]);
  const wrong = Object.keys(want).filter((k) => resolved[k] &&
    resolved[k].toLowerCase() !== want[k].toLowerCase());
  if (missing.length) {
    findings.push({ ...t, kind: 'declared-not-implemented', detail: `${missing.join(', ')} resolve to nothing` });
  } else if (wrong.length) {
    findings.push({ ...t, kind: 'wrong-register-skin',
      detail: wrong.map((k) => `${k}=${resolved[k]} (expected ${want[k]})`).join('; ') });
  }
}

await browser.close();
server.close();

const exempted = findings.filter((f) => EXEMPT.has(f.rel));
const real = findings.filter((f) => !EXEMPT.has(f.rel));
for (const f of exempted) console.log(`  [exempt] ${f.rel} — ${EXEMPT.get(f.rel)}`);
if (exempted.length) console.log('');

console.log(`  declared: ${Object.entries(byRegister).map(([r, n]) => `${r} ${n}`).join(' · ')}`);

if (!real.length) {
  console.log(`\n  Every declared register resolves its own tokens in the browser.`);
  process.exit(0);
}

const RANK = { 'declared-not-implemented': 0, 'wrong-register-skin': 1, 'page-error': 2 };
real.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.rel.localeCompare(b.rel));
console.log(`\n  ${real.length} of ${targets.length} page(s) declare a register whose own tokens do not resolve.`);
console.log(`  This is a REPORT. A bespoke skin that satisfies the register is not a defect;`);
console.log(`  what the gap costs is written in this file's header.\n`);
let kind = null;
for (const f of real) {
  if (f.kind !== kind) {
    kind = f.kind;
    console.log(`  [${kind}]`);
    if (kind === 'declared-not-implemented') {
      console.log('      the attribute is on <html> and resolves to nothing: no tokens, so no');
      console.log('      surface, no accent, no display face, and the editorial runtime that');
      console.log('      flattens rejected washes never activates.');
    }
  }
  console.log(`      ${f.rel} (${f.register}) — ${f.detail}`);
}
console.log('\n  Wiring is the fix, but it is a per-page visual decision: six of these are');
console.log('  calculators, where the editorial ARTICLE surface may be the wrong register');
console.log('  rather than a missing link. See standarization/UIUX_AUDIT_LEDGER.md row B.');
process.exit(0);   // a report never fails a ship
