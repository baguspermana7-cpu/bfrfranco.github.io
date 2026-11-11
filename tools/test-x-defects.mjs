#!/usr/bin/env node
/* Law runner for PRD-X-DEFECTS (documentation/product-transformation/02-prds/PRD-X-DEFECTS/PRD.md §11.4, §20.2).
 *
 *   node tools/test-x-defects.mjs --strict [--blocking X19.1,X7.1] [--json]
 *   node tools/test-x-defects.mjs --law X19.1          (one law, always blocking)
 *
 * Under --strict every law runs; a law outside --blocking prints "REPORT <id> PASS|FAIL <reason>" and never changes
 * the exit code (report mode, coordinator decision D9). The --blocking list lives on the ship-gate line, so
 * tools/ship-gate.sh is the one place that says which laws block. Exit: 0 no blocking law failed, 1 one did, 2 usage.
 * Laws are added here as their tasks land (T-1 of the PRD); an id that is not implemented yet is a usage error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* X7.1 — the crawler suite passes and the ship gate runs it (FR-X7A.1). */
function lawX7_1() {
  const r = spawnSync('python3', ['tools/test-crawler-seo.py'], { cwd: ROOT, encoding: 'utf8', timeout: 600000 });
  const tail = (r.stderr || '') + (r.stdout || '');
  const ran = (tail.match(/Ran (\d+) tests?/) || [])[1] || '?';
  if (r.status !== 0) {
    const why = (tail.match(/AssertionError: .{0,80}/) || [''])[0];
    return { ok: false, reason: `crawler suite FAILED (ran ${ran}) ${why}`.trim() };
  }
  const wired = read('tools/ship-gate.sh').includes('python3 tools/test-crawler-seo.py');
  if (!wired) return { ok: false, reason: `crawler suite OK (ran ${ran}) but tools/ship-gate.sh does not run it` };
  return { ok: true, reason: `crawler suite OK (ran ${ran}), wired in ship-gate.sh` };
}

/* X19.1 — ALARM_STATE.md's adoption table equals the root pages that load js/rz-alarm-state.js, and the revoked
   "untouched per owner mandate" sentence is gone (FR-X19.2). A <script src> is a loader; prose mentions are not. */
function lawX19_1() {
  const doc = read('standarization/ALARM_STATE.md');
  const sec = doc.split('## Adoption status')[1];
  if (!sec) return { ok: false, reason: 'no "## Adoption status" section' };
  const table = new Set();
  for (const line of sec.split('\n## ')[0].split('\n')) {
    const m = line.match(/^\|[^|]*\|\s*`([^`]+\.html)`\s*\|/);
    if (m) table.add(m[1]);
  }
  const loaders = new Set(fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') &&
    /<script[^>]+src="js\/rz-alarm-state\.js/.test(read(f))));
  const missing = [...loaders].filter((p) => !table.has(p)).sort();
  const extra = [...table].filter((p) => !loaders.has(p)).sort();
  const stale = /untouched per owner mandate/i.test(doc);
  const bad = [];
  if (missing.length) bad.push('table misses ' + missing.join(','));
  if (extra.length) bad.push('table lists non-loaders ' + extra.join(','));
  if (stale) bad.push('retired phrase "untouched per owner mandate" present');
  return bad.length ? { ok: false, reason: bad.join('; ') }
    : { ok: true, reason: `table ${table.size} pages = loaders ${loaders.size}` };
}

/* X18.1 — achievements.html says what it records (FR-X18.1): the promise sentence is gone, the interim one is there.
   If the page is retired (D-Q17-2) the law passes as "page retired". */
function lawX18_1() {
  if (!fs.existsSync(path.join(ROOT, 'achievements.html'))) return { ok: true, reason: 'page retired' };
  const s = read('achievements.html');
  const promise = /Start earning badges/i.test(s);
  const interim = s.includes('only what you do on this page is recorded. Reading articles and using calculators does not add progress.');
  return (promise || !interim)
    ? { ok: false, reason: `promise sentence ${promise ? 'present' : 'absent'}, interim sentence ${interim ? 'present' : 'absent'}` }
    : { ok: true, reason: 'interim sentence present, promise gone' };
}

/* X12.1a — no placeholder or dead control on dashboard.html and dc-market-tracker.html (FR-X12.5). */
function lawX12_1a() {
  const bad = [];
  for (const f of ['dashboard.html', 'dc-market-tracker.html']) {
    read(f).split('\n').forEach((line, i) => {
      if (/coming soon/i.test(line)) bad.push(`${f}:${i + 1} "coming soon"`);
      if (line.includes('handleManageSub')) bad.push(`${f}:${i + 1} handleManageSub`);
      if (/onclick=[^>]*>[^<]*(<i[^>]*><\/i>)?\s*Account Settings/.test(line)) bad.push(`${f}:${i + 1} onclick on Account Settings`);
    });
  }
  return bad.length ? { ok: false, reason: bad.length + ': ' + bad.join('; ') } : { ok: true, reason: '0 placeholders' };
}

/* X7.2 — every FAQPage question on every sitemap page is visible on that page (FR-X7B.1). Report mode until the
   owner decides D-XDEF-1 (remove the hidden questions); then it joins --blocking. */
function lawX7_2() {
  const r = spawnSync('node', ['tools/test-faq-visible.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  const sum = ((r.stdout || '').match(/test-faq-visible: .*/) || ['no summary line'])[0];
  return { ok: r.status === 0, reason: sum };
}

const LAWS = { 'X7.1': lawX7_1, 'X7.2': lawX7_2, 'X12.1a': lawX12_1a, 'X18.1': lawX18_1, 'X19.1': lawX19_1 };

function parse(argv) {
  const a = { strict: false, blocking: new Set(), law: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--strict') a.strict = true;
    else if (k === '--json') a.json = true;
    else if (k === '--blocking') (argv[++i] || '').split(',').filter(Boolean).forEach((x) => a.blocking.add(x));
    else if (k === '--law') a.law = argv[++i];
    else return { error: 'unknown argument ' + k };
  }
  for (const id of [...a.blocking, ...(a.law ? [a.law] : [])]) {
    if (!LAWS[id]) return { error: `law ${id} is not implemented (known: ${Object.keys(LAWS).join(', ')})` };
  }
  if (!a.strict && !a.law) return { error: 'pass --strict or --law <id>' };
  return a;
}

const a = parse(process.argv.slice(2));
if (a.error) { console.error('usage: ' + a.error); process.exit(2); }
const ids = a.law ? [a.law] : Object.keys(LAWS);
const results = ids.map((id) => {
  const blocking = Boolean(a.law) || a.blocking.has(id);
  let r;
  try { r = LAWS[id](); } catch (e) { r = { ok: false, reason: 'threw: ' + e.message }; }
  return { id, blocking, ...r };
});
if (a.json) console.log(JSON.stringify(results, null, 2));
else for (const r of results) console.log(`${r.blocking ? '' : 'REPORT '}${r.id} ${r.ok ? 'PASS' : 'FAIL'} ${r.reason}`);
const pass = results.filter((r) => r.ok).length;
const blockFail = results.filter((r) => r.blocking && !r.ok).length;
console.log(`test-x-defects: ${pass} pass, ${results.length - pass} fail, ${blockFail} blocking fail`);
process.exit(blockFail ? 1 : 0);
