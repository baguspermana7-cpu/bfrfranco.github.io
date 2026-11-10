#!/usr/bin/env node
// P08: every uncertainty band on the calculators draws from one seeded generator, so the same inputs always give
// the same band, and each band prints its spreads, draws and seed.
//   S1 static: no Math.random in the 11 calculators except rfs id generation (toString(36)); none in the engine's
//      sim / commissioning paths
//   S2 the page-local LCGs (tier, tia, spares, cx) use the engine's constants and default seed, and tier's
//      mcScoreBand equals the same band drawn with RZEngine.models.sim.rng
//   R  rendered: each band read twice from two fresh loads is identical, shows a number, and its basis line names a seed
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import puppeteer from 'puppeteer';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CALCS = JSON.parse(await readFile(join(ROOT, 'data/calculators.json'), 'utf8')).calculators.map((c) => c.page);
const fails = [];
let passes = 0;
const check = (n, ok, d) => { if (ok) passes++; else fails.push(`${n}: ${d}`); };

// S1
for (const p of CALCS) {
  const src = await readFile(join(ROOT, p), 'utf8');
  const bad = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /Math\.random\s*\(/.test(l) && !/Math\.random\(\)\.toString\(36\)/.test(l) && !/^\s*\/\//.test(l));
  check(`S1 ${p}`, bad.length === 0, bad.map(([n, l]) => `line ${n}: ${l.trim().slice(0, 90)}`).join(' | '));
}
const eng = await readFile(join(ROOT, 'rz-engine.js'), 'utf8');
const engBad = eng.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /Math\.random\s*\(/.test(l) && !/toString\(36\)/.test(l));
check('S1 rz-engine.js', engBad.length === 0, engBad.map(([n, l]) => `line ${n}: ${l.trim().slice(0, 90)}`).join(' | '));

// S2
const ctx = { console }; ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
vm.runInContext(eng, ctx);
const sim = (ctx.RZEngine || ctx.window.RZEngine).models.sim;
for (const p of ['tier-advisor.html', 'tia-942-checklist.html', 'spares-readiness-calculator.html', 'cx-calculator.html']) {
  const src = await readFile(join(ROOT, p), 'utf8');
  const lcg = /\(1103515245 \* ?[A-Za-z_]+ ?\+ ?12345\) ?>>> ?0/.test(src.replace(/\s+/g, ' ')) || /\(1103515245\*[A-Za-z_]+\+12345\)>>>0/.test(src);
  const seed = new RegExp('SEED\\s*=\\s*' + sim.DEFAULT_SEED).test(src);
  check(`S2 ${p} LCG = engine`, lcg && seed, `lcg=${lcg} seed=${seed}`);
}
check('S2 engine exposes sim.rng', typeof sim.rng === 'function', 'RZEngine.models.sim.rng missing');
if (typeof sim.rng === 'function') {
  const src = await readFile(join(ROOT, 'tier-advisor.html'), 'utf8');
  const m = src.match(/function mcScoreBand\(c, spread, seed, n\) \{[\s\S]*?\n    \}/);
  const band = m ? vm.runInNewContext('(' + m[0] + ')') : null;
  const r = sim.rng(sim.DEFAULT_SEED);
  const ref = []; for (let i = 0; i < 2000; i++) ref.push(Math.max(0, Math.min(100, 71.3 * (1 + (r() - 0.5) * 0.25))));
  ref.sort((a, b) => a - b);
  const got = band ? band(71.3, 0.25, sim.DEFAULT_SEED, 2000) : [];
  check('S2 tier band = engine rng band', band && got.length === 2000 && got.every((v, i) => v === ref[i]), band ? 'sequences differ' : 'mcScoreBand not found');
}

// R
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/`;
const T = (id) => `(document.getElementById('${id}')||{}).textContent`;
const BANDS = [
  ['carbon-footprint.html', `runMonteCarlo(12345); [${T('mcP5')},${T('mcP50')},${T('mcP95')}].join(' / ') + ' | ' + ${T('mcBasis')}`],
  ['tier-advisor.html', `JSON.stringify(mcScoreBand(72, MC_SPREAD, MC_SEED, MC_N).filter(function(_, i){ return i % 999 === 0; }).map(function(v){ return v.toFixed(4); })) + ' | ' + mcBasisText()`],
  ['tia-942-checklist.html', `(function(){ var r = runMonteCarlo(10000); return [r.p5, r.p50, r.p95].map(function(v){ return v.toFixed(4); }).join(' / ') + ' | seed ' + MC_SEED; })()`],
  ['spares-readiness-calculator.html', `runMonteCarlo(); runSCSim(); [${T('mc_p10')},${T('mc_p50')},${T('mc_p90')},${T('scsim_p50_sb')}].join(' / ') + ' | ' + ${T('mc_basis')} + ' ' + ${T('scsim_basis')}`],
  ['cx-calculator.html', `(function(){ var m = cxRunMonteCarlo(cxReadInputs()); return [m.p5, m.p50, m.p95].map(function(v){ return Math.round(v); }).join(' / ') + ' | seed ' + CX_MC_SEED; })()`],
  ['tco-calculator.html', `window.rzTcoMonteCarlo(); [${T('mcP5')},${T('mcP50')},${T('mcP95')}].join(' / ') + ' | ' + ${T('tcoMcBasis')}`],
  ['roi-calculator.html', `runMonteCarlo([-120e6, 18e6, 19e6, 20e6, 21e6, 22e6, 23e6, 24e6, 25e6, 26e6, 27e6]); [${T('mcP5')},${T('mcP50')},${T('mcP95')}].join(' / ') + ' | ' + ${T('roiMcBasis')}`],
];
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const ALLOW = [base, 'https://cdn.jsdelivr.net/', 'https://cdnjs.cloudflare.com/'];
try {
  for (const [page, expr] of BANDS) {
    const reads = [];
    for (let k = 0; k < 2; k++) {
      const c = await browser.createBrowserContext();
      const tab = await c.newPage();
      await tab.setRequestInterception(true);
      tab.on('request', (r) => (ALLOW.some((a) => r.url().startsWith(a)) ? r.continue() : r.abort()));
      await tab.goto(base + page, { waitUntil: 'load', timeout: 60000 });
      await new Promise((ok) => setTimeout(ok, 1500));
      try { reads.push(String(await tab.evaluate(expr))); } catch (e) { reads.push('ERROR ' + String(e.message).slice(0, 100)); }
      await c.close();
    }
    const [a, b] = reads;
    check(`R ${page}`, !/^ERROR/.test(a) && a === b && /\d/.test(a.split('|')[0]) && /seed \d+/.test(a),
      a === b ? `"${a.slice(0, 160)}"` : `two loads differ: "${a.slice(0, 90)}" vs "${b.slice(0, 90)}"`);
  }
} finally { await browser.close(); server.close(); }
if (fails.length) { console.log(`FAIL test-seeded-uncertainty — ${fails.length} of ${fails.length + passes}`); fails.forEach((f) => console.log('  ' + f)); process.exit(1); }
console.log(`PASS test-seeded-uncertainty — ${passes} checks: no unseeded draws, page LCGs = engine, 7 bands identical across fresh loads with their seed printed`);
