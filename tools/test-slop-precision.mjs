#!/usr/bin/env node
/**
 * test-slop-precision.mjs — the render scan's two precision rules, proven on a page it serves itself.
 *   1. a circle (equal sides, radius >= half the side) is not a pill; a chip and a 30x30 r12 box are.
 *   2. a 1 px hairline box-shadow (blur 0, spread 0, |x|,|y| <= 1) is not a shadow; a 0 8px 24px card is.
 *   3. --strict exits 1 on the page (a strict gate that cannot fail proves nothing).
 * The fixture lives in this file, not in the tree, so the site-wide source audits never read deliberate slop.
 *   node tools/test-slop-precision.mjs
 */
import http from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = `<!doctype html><html><head><meta charset="utf-8"><title>fixture</title>
<style>body{background:#0b0c0e;color:#ddd;font:16px sans-serif;padding:20px}
.chip{display:inline-block;padding:4px 12px;border-radius:99px;background:#333;border:1px solid #555}
.circ{display:inline-block;width:32px;height:32px;border-radius:50%;border:1.5px solid #7c92ad}
table{border-collapse:collapse;width:600px}
td.stick{position:sticky;left:0;background:#121316;box-shadow:1px 0 0 rgba(255,255,255,.2);width:300px;height:44px}
.card{width:300px;height:80px;background:#121316;box-shadow:0 8px 24px rgba(0,0,0,.4);margin-top:20px}</style></head>
<body><span class="chip" data-rz-owner-shape="R079">Real chip</span> <span class="circ"></span>
<span style="display:inline-block;width:30px;height:30px;border-radius:12px;background:#333"></span>
<table><tr><td class="stick">sticky</td><td>x</td></tr></table><div class="card">card</div></body></html>`;

// the homepage exemption (R079): an owner-shape capsule on /index.html is not counted, a plain chip there still is
const HOME = `<!doctype html><html><head><meta charset="utf-8"><title>home</title><style>body{background:#0b0c0e;color:#ddd;font:16px sans-serif;padding:20px}
.cap{display:flex;gap:4px;padding:4px;width:600px;background:#1b1d22;border-radius:999px;list-style:none}
.cta{display:inline-flex;padding:0 18px;min-height:40px;align-items:center;border-radius:999px;background:#f1f2f4;color:#111}
.chip{display:inline-block;padding:4px 12px;border-radius:99px;background:#333}</style></head>
<body><ul class="cap" data-rz-owner-shape="R079"><li>Home</li></ul><a class="cta" data-rz-owner-shape="R079">Contact</a> <span class="chip">plain</span></body></html>`;

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/index.html')) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HOME); return; }
  if (req.url.startsWith('/fixture.html')) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(FIXTURE); return; }
  if (req.url === '/robots.txt') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('User-agent: *\n'); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const dir = mkdtempSync(join(tmpdir(), 'slop-precision-'));
const run = (extra, page = 'fixture.html') => new Promise((done) => {
  // async spawn so this process keeps serving the fixture while the scanner loads it
  import('node:child_process').then(({ spawn }) => {
    const p = spawn('node', ['tools/audit-slop-render.mjs', '--pages', page, '--themes', 'dark', ...extra],
      { cwd: ROOT, env: { ...process.env, RZ_BASE: base }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => done({ code, out }));
  });
});
let fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++; };
try {
  const json = join(dir, 'r.json');
  const a = await run(['--json', json]);
  let r; try { r = JSON.parse(readFileSync(json, 'utf8'))[0]; } catch { console.log(a.out.slice(-1500)); throw new Error('scanner wrote no report'); }
  check(!r.error, `fixture loads${r.error ? ' — ' + r.error : ''}`);
  check(r.pill && r.pill.n === 2, `pill = 2 (chip + 30x30 r12 box; the circle is exempt) — read ${r.pill && r.pill.n}`);
  check(r.shadow && r.shadow.n === 1, `shadow = 1 (the card; the hairline cell is exempt) — read ${r.shadow && r.shadow.n}`);
  check(a.code === 0, `report mode exits 0 — read ${a.code}`);
  const hj = join(dir, 'h.json');
  await run(['--json', hj], 'index.html');
  const h = JSON.parse(readFileSync(hj, 'utf8'))[0];
  check(h.pill && h.pill.n === 1, `homepage: owner-shape capsule + pill exempt, plain chip counted (pill = 1) — read ${h.pill && h.pill.n}`);
  check(h.round && h.round.n === 0, `homepage: owner-shape capsule not a round panel (round = 0) — read ${h.round && h.round.n}`);
  const s = await run(['--strict']);
  check(s.code === 1, `--strict exits 1 on a page with tells — read ${s.code}`);
} finally { server.close(); rmSync(dir, { recursive: true, force: true }); }
console.log(fail ? `FAIL — ${fail} check(s)` : 'PASS — the scan exempts circles and hairlines, and strict mode fails a dirty page');
process.exit(fail ? 1 : 0);
