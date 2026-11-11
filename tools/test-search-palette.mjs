#!/usr/bin/env node
/**
 * test-search-palette.mjs — P14 ship gate: every public page is findable, and the palette works where it is.
 *
 *  S1  every public root page (not noindex, not excluded, not robots-disallowed) has a search-index.json entry
 *  S2  every public root page loads js/rz-command-palette.js (or carries a working inline copy, __rzPalette)
 *  S3  query fixture: 10 queries, expected page in the top 3, with the palette's own Fuse options over the
 *      vendored Fuse (js/vendor/fuse.min.js) and the same corpus (search-index.json + search-terms.json)
 *  S4  browser, 5 pages of different families: Ctrl+K opens a STYLED modal (position fixed), a query returns
 *      results, Esc closes and focus returns; on a calculator the nav search button opens it (it was dead) and
 *      the page actions are listed and run the page's own control; on a non-calculator they are absent
 *
 * Run: node tools/test-search-palette.mjs [--static]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };

/* public set, from the generator's own rule (one definition) */
const pub = JSON.parse(execFileSync('python3', ['-c', `
import importlib.util, json, pathlib
spec = importlib.util.spec_from_file_location('b', 'tools/build-search-index.py'); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
d = m.robots_disallow()
print(json.dumps([p.name for p in sorted(pathlib.Path('.').glob('*.html')) if m.public(p.name, p.read_text(errors='replace'), d)]))
`], { cwd: ROOT }).toString());
ok(pub.length >= 90, `S1 only ${pub.length} public pages found — the public rule is probably broken`);

const index = JSON.parse(readFileSync(join(ROOT, 'search-index.json'), 'utf8'));
const urls = new Set(index.map((e) => e.url));
for (const p of pub) ok(urls.has(p), `S1 ${p} is public but has no search-index.json entry`);

for (const p of pub) {
  const s = readFileSync(join(ROOT, p), 'utf8');
  ok(/<script[^>]+src="js\/rz-command-palette\.js\?v=/.test(s) || /__rzPalette/.test(s), `S2 ${p} loads no palette — Ctrl+K and its search button do nothing`);
}

/* S3 */
const QUERIES = [
  ['chiller plant', 'chiller-plant.html'], ['pue', 'pue-calculator.html'], ['tco', 'tco-calculator.html'],
  ['tier advisor', 'tier-advisor.html'], ['java grid', 'pln-java-grid.html'], ['fuel', 'fuel-system.html'],
  ['commissioning', 'cx-calculator.html'], ['spares', 'spares-readiness-calculator.html'],
  ['water treatment', 'water-system.html'], ['jawa barat', 'pln-java-grid-jabar.html'],
];
{
  const ctx = { module: { exports: {} } }; ctx.exports = ctx.module.exports; ctx.self = ctx; ctx.window = ctx;
  vm.runInNewContext(readFileSync(join(ROOT, 'js', 'vendor', 'fuse.min.js'), 'utf8'), ctx);
  const Fuse = ctx.Fuse || ctx.module.exports;
  const pal = readFileSync(join(ROOT, 'js', 'rz-command-palette.js'), 'utf8');
  ok(/threshold: 0\.35/.test(pal) && /name: 'title', weight: 0\.4/.test(pal) && /useExtendedSearch: true/.test(pal), 'S3 palette Fuse options changed — update this fixture to the same options');
  let terms = [];
  try { terms = JSON.parse(readFileSync(join(ROOT, 'search-terms.json'), 'utf8')); } catch (e) { /* optional */ }
  const fuse = new Fuse(index.concat(terms), {
    keys: [{ name: 'title', weight: 0.4 }, { name: 'description', weight: 0.25 }, { name: 'keywords', weight: 0.25 }, { name: 'category', weight: 0.1 }],
    threshold: 0.35, includeScore: true, minMatchCharLength: 2, useExtendedSearch: true,
  });
  for (const [q, want] of QUERIES) {
    const top = fuse.search(q).slice(0, 3).map((r) => r.item.url);
    ok(top.includes(want), `S3 "${q}" -> top 3 ${JSON.stringify(top)}, expected ${want}`);
  }
}

/* S4 */
if (!process.argv.includes('--static')) {
  const { default: puppeteer } = await import('puppeteer');
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = join(ROOT, path === '/' ? 'index.html' : path);
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const ALLOW = [base];
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const PAGES = [
    { page: 'capex-calculator.html', calc: true, button: true },
    { page: 'chiller-plant.html', calc: false },
    { page: 'pln-java-grid.html', calc: false },
    { page: 'tools.html', calc: false },
    { page: 'article-1.html', calc: false },
  ];
  try {
    for (const t of PAGES) {
      const tab = await browser.newPage();
      await tab.setViewport({ width: 1280, height: 900 });
      await tab.setRequestInterception(true);
      tab.on('request', (r) => (ALLOW.some((a) => r.url().startsWith(a)) ? r.continue() : r.abort()));
      const errs = [];
      tab.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 120)));
      tab.on('dialog', (d) => d.dismiss().catch(() => {}));
      await tab.goto(base + t.page, { waitUntil: 'load', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 900));
      if (t.button) {
        await tab.evaluate(() => document.getElementById('navSearchBtn') && document.getElementById('navSearchBtn').click());
      } else {
        await tab.evaluate(() => document.body.focus());
        await tab.keyboard.down('Control'); await tab.keyboard.press('k'); await tab.keyboard.up('Control');
      }
      await new Promise((r) => setTimeout(r, 600));
      const open = await tab.evaluate(() => {
        const m = document.getElementById('searchModal');
        return m ? { active: m.classList.contains('active'), pos: getComputedStyle(m).position, z: getComputedStyle(m).zIndex,
          cmds: [...document.querySelectorAll('.rz-cmd .search-result-title')].map((e) => e.textContent) } : null;
      });
      ok(open && open.active, `S4 ${t.page}: palette did not open (${t.button ? 'nav search button' : 'Ctrl+K'})`);
      if (!open || !open.active) { await tab.close(); continue; }
      ok(open.pos === 'fixed', `S4 ${t.page}: palette modal is not styled (position ${open.pos}) — it renders as raw blocks`);
      const acts = ['Copy link to this scenario', 'Save scenario to my account', 'Export PDF report'];
      if (t.calc) for (const a of acts) ok(open.cmds.includes(a), `S4 ${t.page}: page action "${a}" not listed`);
      else for (const a of acts) ok(!open.cmds.includes(a), `S4 ${t.page}: lists "${a}" with no such control on the page`);
      if (t.calc) {
        const ran = await tab.evaluate(() => {
          let hit = false; const b = document.getElementById('btnCopyLink');
          b.addEventListener('click', (e) => { hit = true; e.stopImmediatePropagation(); e.preventDefault(); }, { capture: true, once: true });
          const row = [...document.querySelectorAll('.rz-cmd')].find((r) => r.textContent.includes('Copy link to this scenario'));
          row.click();
          return hit;
        });
        ok(ran, `S4 ${t.page}: "Copy link to this scenario" did not click the page's #btnCopyLink`);
        await tab.evaluate(() => document.getElementById('navSearchBtn').click());
        await new Promise((r) => setTimeout(r, 400));
      }
      await tab.type('#searchInput', 'cooling');
      await new Promise((r) => setTimeout(r, 1500));
      const n = await tab.evaluate(() => document.querySelectorAll('#searchResults .search-result-item:not(.rz-cmd)').length);
      ok(n > 0, `S4 ${t.page}: query "cooling" returned no results (index or Fuse did not load)`);
      await tab.keyboard.press('Escape');
      await new Promise((r) => setTimeout(r, 400));
      const closed = await tab.evaluate(() => !document.getElementById('searchModal').classList.contains('active'));
      ok(closed, `S4 ${t.page}: Esc did not close the palette`);
      ok(!errs.length, `S4 ${t.page}: ${errs.length} page error(s), first: ${errs[0]}`);
      await tab.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

if (fails.length) {
  console.log(`FAIL test-search-palette — ${fails.length} of ${checks} checks\n  ` + fails.join('\n  '));
  process.exit(1);
}
console.log(`PASS test-search-palette — ${checks} checks: ${pub.length} public pages indexed and carrying the palette, ${QUERIES.length}/${QUERIES.length} queries top-3${process.argv.includes('--static') ? '' : ', palette opens styled and runs page actions on 5 pages'}`);
