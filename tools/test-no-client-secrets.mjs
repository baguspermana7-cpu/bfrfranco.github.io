#!/usr/bin/env node
/* Site-wide secret gate (PRD-X-DEFECTS FR-X1.3, §10.3; laws L-X1.2a, L-X1.2b).
 *
 *   node tools/test-no-client-secrets.mjs --law X1.2a|X1.2b
 *   node tools/test-no-client-secrets.mjs --strict [--blocking X1.2a[,X1.2b]]
 *   node tools/test-no-client-secrets.mjs --report [--json]
 *   node tools/test-no-client-secrets.mjs --self-test
 *
 * Scans every git-tracked text file (node_modules skipped, > 5 MB streamed line by line (binary extension / NUL byte / non-UTF-8 skipped), non-UTF-8 skipped; dcmoc/_next IS
 * scanned: Next.js inlines env values into published chunks). The matched text is NEVER printed, logged or
 * written: output is file, line, pattern name and match length only.
 *   X1.2a  a hit not covered by tools/secret-scan-baseline.json (file + pattern, count = most allowed) fails.
 *   X1.2b  every hit outside the allowlist fails (the baseline must be empty).
 * Allowlist entries match file + pattern + sha256 of the whole line, so an edited line re-opens.
 * Exit: 0 pass, 1 a blocking law failed, 2 usage or git missing.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BYTES = 5 * 1024 * 1024;

export const PATTERNS = [
  ['storage-fallback-literal', /getItem\([^)]*\)\s*\|\|\s*['"][A-Za-z0-9_\-]{16,}['"]/g],
  ['google-api-key', /AIza[0-9A-Za-z_\-]{35}/g],
  ['stripe-secret', /sk_(?:live|test)_[0-9A-Za-z]{16,}/g],
  ['github-token', /ghp_[0-9A-Za-z]{36}|github_pat_[0-9A-Za-z_]{40,}/g],
  ['aws-access-key', /AKIA[0-9A-Z]{16}/g],
  ['slack-token', /xox[baprs]-[0-9A-Za-z\-]{10,}/g],
  ['supabase-secret-key', /sb_secret_[0-9A-Za-z_\-]{10,}/g],
  ['service-role-jwt', /eyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]*cm9sZSI6InNlcnZpY2Vfcm9sZ/g],
  ['db-url-with-password', /postgres(?:ql)?:\/\/[^:\s/]+:[^@\s]{6,}@/g],
  ['private-key-block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['generic-secret-assignment', /(?:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{24,}['"]/gi],
];

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/* Hits in one text: [{line, pattern, len, lineSha}] — never the matched text. */
export function scanText(text) {
  const hits = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const [name, re] of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(lines[i]))) hits.push({ line: i + 1, pattern: name, len: m[0].length, lineSha: sha(lines[i]) });
    }
  }
  return hits;
}

function trackedFiles(root) {
  const r = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.error) return null;
  return r.stdout.split('\0').filter(Boolean);
}

function readJson(rel, empty) {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : empty;
}

const BINARY_EXT = /\.(png|jpe?g|gif|webp|avif|ico|bmp|pdf|zip|gz|tgz|7z|rar|woff2?|ttf|otf|eot|mp[34]|webm|mov|ogg|wav|apk|wasm|bin|glb|gltf|psd|sqlite|db|onnx|npy|pt)$/i;

/* Stream a large text file in 1 MB chunks; same hits as scanText on the whole text. Returns null for binary / non-UTF-8. */
export function scanTextStream(p) {
  const hits = [];
  const dec = new TextDecoder('utf-8', { fatal: true });
  const fd = fs.openSync(p, 'r');
  const buf = Buffer.alloc(1024 * 1024);
  let carry = '';
  let lineNo = 0;
  const feed = (line) => {
    lineNo++;
    for (const [name, re] of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) hits.push({ line: lineNo, pattern: name, len: m[0].length, lineSha: sha(line) });
    }
  };
  try {
    let n;
    let first = true;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      if (first && buf.subarray(0, Math.min(n, 8192)).includes(0)) return null;
      first = false;
      const parts = (carry + dec.decode(buf.subarray(0, n), { stream: true })).split('\n');
      carry = parts.pop();
      parts.forEach(feed);
    }
    feed(carry + dec.decode());
  } catch (e) { return null; } finally { fs.closeSync(fd); }
  return hits;
}

export function scanTree(root, files) {
  const hits = [];
  const skips = [];
  const dec = new TextDecoder('utf-8', { fatal: true });
  for (const f of files) {
    if (f.split('/').includes('node_modules')) continue;
    const p = path.join(root, f);
    let st;
    try { st = fs.lstatSync(p); } catch (e) { skips.push([f, 'missing']); continue; }
    if (!st.isFile()) continue;
    if (st.size > MAX_BYTES) {
      if (BINARY_EXT.test(f)) { skips.push([f, 'over 5 MB, binary']); continue; }
      const big = scanTextStream(p);
      if (big === null) { skips.push([f, 'over 5 MB, not UTF-8 text']); continue; }
      for (const h of big) hits.push({ file: f, ...h });
      continue;
    }
    let text;
    try { text = dec.decode(fs.readFileSync(p)); } catch (e) { continue; } /* binary / not UTF-8 */
    for (const h of scanText(text)) hits.push({ file: f, ...h });
  }
  return { hits, skips };
}

/* Classify: allowlisted, baselined (within the per file+pattern count), or new. */
export function classify(hits, baseline, allowlist) {
  const allowed = new Set((allowlist.entries || []).map((a) => `${a.file}\0${a.pattern}\0${a.line_text_sha256}`));
  const budget = new Map();
  for (const b of baseline.entries || []) budget.set(`${b.file}\0${b.pattern}`, b.count);
  return hits.map((h) => {
    if (allowed.has(`${h.file}\0${h.pattern}\0${h.lineSha}`)) return { ...h, state: 'allowlisted' };
    const k = `${h.file}\0${h.pattern}`;
    const left = budget.get(k) || 0;
    if (left > 0) { budget.set(k, left - 1); return { ...h, state: 'baseline' }; }
    return { ...h, state: 'new' };
  });
}

function selfTest() {
  let fail = 0;
  const check = (ok, msg) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); };
  /* A synthetic key-shaped string built at run time (not a real key). */
  const fake = 'AI' + 'za' + 'Q'.repeat(20) + '0123456789abcde';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rz-secret-selftest-'));
  try {
    fs.writeFileSync(path.join(dir, 'a.js'), 'var x = 1;\nvar k = "' + fake + '";\n');
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--report', '--root', dir, '--files', 'a.js'],
      { encoding: 'utf8' });
    const out = (r.stdout || '') + (r.stderr || '');
    check(/SECRET a\.js:2 google-api-key len=39 new/.test(out), 'planted key reported by position and length');
    check(!out.includes(fake) && !out.includes(fake.slice(4, 20)), 'planted key text never printed');
    /* dcmoc/_next chunk copy: the published-output directory must be scanned. */
    const chunks = path.join(ROOT, 'dcmoc/_next/static/chunks');
    const src = fs.existsSync(chunks) ? fs.readdirSync(chunks).find((f) => f.endsWith('.js')) : null;
    if (src) {
      const rel = 'dcmoc/_next/static/chunks/' + src;
      fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), fs.readFileSync(path.join(chunks, src), 'utf8') + '\n"' + fake + '"\n');
      const n = scanTree(dir, [rel]).hits.filter((h) => h.pattern === 'google-api-key').length;
      check(n >= 1, `planted key in a copied dcmoc/_next chunk is found (${n} hit)`);
    } else check(false, 'no dcmoc/_next/static/chunks/*.js to copy');
    const b = classify([{ file: 'f', pattern: 'p', line: 1, len: 1, lineSha: 'x' }, { file: 'f', pattern: 'p', line: 2, len: 1, lineSha: 'y' }],
      { entries: [{ file: 'f', pattern: 'p', count: 1 }] }, { entries: [] });
    check(b[0].state === 'baseline' && b[1].state === 'new', 'baseline count is a ceiling: a second hit is new');
    const a = classify([{ file: 'f', pattern: 'p', line: 1, len: 1, lineSha: 'x' }], { entries: [] },
      { entries: [{ file: 'f', pattern: 'p', line_text_sha256: 'x' }] });
    check(a[0].state === 'allowlisted', 'allowlist matches file + pattern + line hash');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  console.log(`self-test: ${fail ? 'FAIL ' + fail : 'PASS'}`);
  return fail ? 1 : 0;
}

function parse(argv) {
  const a = { law: null, strict: false, blocking: new Set(), report: false, json: false, root: ROOT, files: null, self: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--law') a.law = argv[++i];
    else if (k === '--strict') a.strict = true;
    else if (k === '--blocking') (argv[++i] || '').split(',').filter(Boolean).forEach((x) => a.blocking.add(x));
    else if (k === '--report') a.report = true;
    else if (k === '--json') a.json = true;
    else if (k === '--self-test') a.self = true;
    else if (k === '--root') a.root = path.resolve(argv[++i]);
    else if (k === '--files') { a.files = argv.slice(i + 1); break; }
    else return { error: 'unknown argument ' + k };
  }
  for (const id of [...a.blocking, ...(a.law ? [a.law] : [])]) if (!['X1.2a', 'X1.2b'].includes(id)) return { error: 'unknown law ' + id };
  if (!a.self && !a.law && !a.strict && !a.report) return { error: 'pass --law, --strict, --report or --self-test' };
  return a;
}

function main(argv) {
  const a = parse(argv);
  if (a.error) { console.error('usage: ' + a.error); return 2; }
  if (a.self) return selfTest();
  const files = a.files || trackedFiles(a.root);
  if (!files) { console.error('git not found'); return 2; }
  const { hits, skips } = scanTree(a.root, files);
  const baseline = a.root === ROOT ? readJson('tools/secret-scan-baseline.json', null) : { entries: [] };
  const allowlist = a.root === ROOT ? readJson('tools/secret-scan-allowlist.json', { entries: [] }) : { entries: [] };
  const rows = classify(hits, baseline || { entries: [] }, allowlist);
  const n = (s) => rows.filter((r) => r.state === s).length;
  const filesHit = new Set(rows.filter((r) => r.state !== 'allowlisted').map((r) => r.file)).size;
  if (a.json) console.log(JSON.stringify(rows.map(({ lineSha, ...r }) => r), null, 2));
  else {
    for (const r of rows) if (r.state !== 'allowlisted') console.log(`SECRET ${r.file}:${r.line} ${r.pattern} len=${r.len} ${r.state}`);
    for (const [f, why] of skips) console.log(`SKIP ${f} ${why}`);
  }
  const say = a.json ? console.error : console.log;
  say(`test-no-client-secrets: ${n('new')} new, ${n('baseline')} baselined, ${n('allowlisted')} allowlisted (${filesHit} files)`);
  if (a.report) return 0;
  const laws = {
    'X1.2a': baseline === null ? { ok: false, why: 'tools/secret-scan-baseline.json missing' }
      : { ok: n('new') === 0, why: `${n('new')} hits outside the baseline` },
    'X1.2b': { ok: n('new') + n('baseline') === 0, why: `${n('new') + n('baseline')} hits outside the allowlist` },
  };
  const ids = a.law ? [a.law] : Object.keys(laws);
  let blockFail = 0;
  for (const id of ids) {
    const blocking = Boolean(a.law) || a.blocking.has(id);
    if (blocking && !laws[id].ok) blockFail++;
    say(`${blocking ? '' : 'REPORT '}${id} ${laws[id].ok ? 'PASS' : 'FAIL'} ${laws[id].why}`);
  }
  return blockFail ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
