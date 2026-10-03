#!/usr/bin/env node
/**
 * audit-runtime-handlers — every inline onclick must resolve AT RUNTIME,
 * signed out AND signed in.
 *
 * WHY THIS EXISTS
 *
 * `article-26.html` shipped with its entire calculator dead — pfasSetMode,
 * pfasHandleLogin, pfasExportPDF, every later global `undefined`, every button on
 * the page a no-op. The page returned 200, the HTML was intact, and every static
 * gate was green.
 *
 * The cause was a one-line ordering fault: an inline `checkSession()` ran during
 * parse and called `pfasSetMode('pro')`, which is assigned to `window` ~56 lines
 * further down. A function expression assigned to window is not hoisted, so that
 * call threw a TypeError and killed the rest of the inline script.
 *
 * The part that made it invisible: **it only happened when signed in.** Signed
 * out, checkSession found no session, never called the missing function, and the
 * script completed. So the page worked for every visitor and every audit, and
 * broke for the one person who was always logged in — the owner. Measured:
 *
 *     no session   typeof window.pfasSetMode === 'function'
 *     root session typeof window.pfasSetMode === 'undefined'
 *
 * `tools/audit-onclick-handlers.py` exists for a neighbouring bug (a handler
 * defined inside an IIFE, so never on window). It could not catch this one for
 * two reasons: it reads source rather than running the page, and — line 10 of
 * its own usage text — "If no files are given, scans spares-readiness-calculator
 * .html". It audits ONE file out of 179 and prints "[OK] No missing exports",
 * which reads as a site-wide verdict.
 *
 * So this gate runs the page and asks the only question that matters: if a
 * visitor clicks that button, does anything happen?
 *
 * WHAT IT MEASURES
 *   For every page carrying inline `onclick="name(...)"`, in TWO auth states:
 *     - signed out  (localStorage cleared)
 *     - signed in   (a root session planted the way auth.js stores one)
 *   every referenced name must be `typeof window[name] === 'function'`.
 *
 * A name dead in ONE state only is the more dangerous finding, and is reported
 * as such: it means the page works for whoever tests it and fails for whoever
 * uses it.
 *
 * Run:  node tools/audit-runtime-handlers.mjs [--strict] [--page=x.html] [--limit=N]
 */
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, join } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const STRICT = ARGS.includes('--strict');
const ONLY = (ARGS.find((a) => a.startsWith('--page=')) || '').split('=')[1] || null;
const LIMIT = Number((ARGS.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);

const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.pdf': 'application/pdf',
});

// Words that appear in an onclick body but are not handler names. `function` is
// the one that actually bit: `onclick="items.forEach(function(d){…})"` made the
// first version of this gate report a dead handler called "function" — half a
// finding that was purely the tool. Verify a detector against its own output
// before trusting the list it produces.
const NOT_A_HANDLER = new Set([
  'if', 'for', 'while', 'switch', 'return', 'typeof', 'void', 'new', 'delete',
  'function', 'catch', 'do', 'else', '$',
]);

// A root session in the shape auth.js writes: {email, tier, expires, role}.
const ROOT_SESSION = JSON.stringify({
  email: 'audit@resistancezero.local', tier: 'root', role: 'root',
  expires: new Date(Date.now() + 864e5).toISOString(),
});

function handlerNames(html) {
  const names = new Set();
  for (const m of html.matchAll(/on(?:click|change|input|submit)=["']([^"']+)["']/g)) {
    for (const c of m[1].matchAll(/(?:^|[\s;,(!])([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (!NOT_A_HANDLER.has(c[1])) names.add(c[1]);
    }
  }
  return [...names];
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

// Navigation under load is the flake this repo already has on record (dark-coverage
// and test-mobile-nav both hit it). Measured here: rz-ops-p7x3k9m.html timed out in a
// full sweep and then PASSED with 110 handlers when run solo. So a navigation failure
// is retried once with a longer budget before it is allowed to become a finding -- a
// gate that reports contention as a defect teaches people to ignore it.
const NAV_MS = 45000;
const NAV_MS_RETRY = 90000;

async function probe(page, base, file, names, signedIn, timeout = NAV_MS) {
  // Plant or clear the session on the ORIGIN before the page boots, so the
  // inline session check sees the state we mean to test.
  await page.goto(`${base}/${file}`, { waitUntil: 'domcontentloaded', timeout });
  await page.evaluate((sess) => {
    try {
      if (sess) localStorage.setItem('rz_premium_session', sess);
      else localStorage.removeItem('rz_premium_session');
    } catch {}
  }, signedIn ? ROOT_SESSION : null);
  await page.goto(`${base}/${file}`, { waitUntil: 'load', timeout });
  return page.evaluate(
    (ns) => ns.filter((n) => typeof window[n] !== 'function'),
    names,
  );
}

const pages = [];
for (const f of (await readdir(ROOT)).sort()) {
  if (!f.endsWith('.html') || (ONLY && f !== ONLY)) continue;
  const names = handlerNames(await readFile(join(ROOT, f), 'utf8'));
  if (names.length) pages.push({ file: f, names });
}
const targets = LIMIT ? pages.slice(0, LIMIT) : pages;

const { server, port } = await serve();
const base = `http://127.0.0.1:${port}`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('dialog', (d) => d.dismiss().catch(() => {}));

console.log('── RUNTIME HANDLERS ──');
console.log(`  ${targets.length} page(s) with inline handlers · signed out AND signed in\n`);

const findings = [];
let checked = 0;
for (const { file, names } of targets) {
  let out, inn;
  try {
    out = await probe(page, base, file, names, false);
    inn = await probe(page, base, file, names, true);
  } catch (e) {
    try {                                    // one retry, longer budget, before believing it
      out = await probe(page, base, file, names, false, NAV_MS_RETRY);
      inn = await probe(page, base, file, names, true, NAV_MS_RETRY);
    } catch (e2) {
      findings.push({ file, kind: 'page-error', detail: `${String(e2.message).slice(0, 100)} (after retry)`, names: [] });
      continue;
    }
  }
  checked += names.length;
  const both = out.filter((n) => inn.includes(n));
  const onlyIn = inn.filter((n) => !out.includes(n));
  const onlyOut = out.filter((n) => !inn.includes(n));
  if (both.length) findings.push({ file, kind: 'always-dead', names: both });
  if (onlyIn.length) findings.push({ file, kind: 'dead-when-signed-in', names: onlyIn });
  if (onlyOut.length) findings.push({ file, kind: 'dead-when-signed-out', names: onlyOut });
}

await browser.close();
server.close();

if (!findings.length) {
  console.log(`PASS — ${checked} inline handlers across ${targets.length} pages resolve in both auth states.`);
  process.exit(0);
}

const RANK = { 'dead-when-signed-in': 0, 'dead-when-signed-out': 1, 'always-dead': 2, 'page-error': 3 };
findings.sort((a, b) => RANK[a.kind] - RANK[b.kind]);
const EXPLAIN = {
  'dead-when-signed-in': 'works signed out, BREAKS signed in — the state the owner is always in, and the one no audit tests',
  'dead-when-signed-out': 'works signed in, breaks for visitors',
  'always-dead': 'never resolves in either state — the handler is missing or trapped in a scope',
  'page-error': 'the page could not be probed',
};
console.log(`FAIL — ${findings.length} finding(s) across ${new Set(findings.map((f) => f.file)).size} page(s)\n`);
for (const f of findings) {
  console.log(`  [${f.kind}] ${f.file}`);
  console.log(`      ${EXPLAIN[f.kind]}`);
  if (f.names.length) console.log(`      ${f.names.join(', ')}`);
  if (f.detail) console.log(`      ${f.detail}`);
}
console.log('\n  A handler dead in ONE auth state is the worse defect: the page passes');
console.log('  every test run by someone in the other state.');
process.exit(STRICT ? 1 : 0);
