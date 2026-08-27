/**
 * Conventional snapshot-binding gate (v1.132.0).
 *
 * WHY THIS EXISTS
 * ---------------
 * `EPMS_Telemetry.html` and `datahall.html` each read snapshot paths that had NEVER existed
 * (`site.facility_kw`, `site.it_kw`, `datahall.racks_total`; the real keys are `site.facility_load_kw`,
 * `site.it_load_kw`, and there is no `datahall` branch). Every read was `!= null`-guarded, so the pages
 * silently rendered hardcoded literals — '2.68', '1.85', '1.45', racks 200 — that happened to equal the
 * live basis. The strips LOOKED engine-bound and were not: no test failed, and a change to the engine
 * basis would never have reached them.
 *
 * This gate kills that entire bug class two ways:
 *   1. STATIC  — every `snapshot.<path>` / `s.site.<key>` a Conventional page reads must exist on the real
 *                frozen `CONV_CALC.snapshot`. An unknown key fails here instead of silently falling back.
 *   2. DYNAMIC — the engine is served with a PERTURBED IT load and the rendered strips must follow it.
 *                A page pinned to a literal cannot pass this, however plausible its constant looks.
 *
 * Run: node tools/test-conv-snapshot-binding.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import vm from 'node:vm';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const PERTURBED_IT_KW = 3700;           // 2x the real basis — any literal-pinned value stands out immediately
const MIME = Object.freeze({
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff2': 'font/woff2',
});

function safeFilePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.endsWith('/') ? `${decoded.slice(1)}index.html` : decoded.slice(1);
  const full = resolve(ROOT, relative);
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  return full;
}

/* ── 1. STATIC: load the real engine and assert every read path resolves ───────────────────────── */
const engineSource = await readFile('js/conv-engine.js', 'utf8');
const sandbox = { window: {}, module: { exports: {} }, console };
vm.createContext(sandbox);
vm.runInContext(engineSource, sandbox);
const CALC = sandbox.window.CONV_CALC || sandbox.module.exports;
assert.ok(CALC && CALC.snapshot, 'conv-engine.js must expose CONV_CALC.snapshot');
const snapshot = CALC.snapshot;

function resolvePath(path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), snapshot);
}

/* Paths the Conventional cockpits bind to. Add a row when a page starts reading a new snapshot path —
   that is the point: the gate should be updated deliberately, not discovered in production. */
const BOUND_PATHS = Object.freeze([
  'site.it_load_kw', 'site.it_design_kw', 'site.facility_load_kw', 'site.pue',
  'site.non_it_load_kw', 'electrical.epms_ups_output_kw',
  'racks.at_6kw', 'racks.at_8kw', 'racks.at_10kw',
]);
for (const path of BOUND_PATHS) {
  assert.notEqual(resolvePath(path), undefined, `snapshot path must exist: ${path}`);
}

/* Paths that must NEVER reappear — these are the exact phantom keys that caused the silent fallbacks. */
const FORBIDDEN_PATHS = Object.freeze(['site.it_kw', 'site.facility_kw', 'datahall.racks_total']);
for (const path of FORBIDDEN_PATHS) {
  assert.equal(resolvePath(path), undefined, `phantom key must not exist on the snapshot: ${path}`);
}

const pageSources = Object.freeze({
  'EPMS_Telemetry.html': await readFile('EPMS_Telemetry.html', 'utf8'),
  'datahall.html': await readFile('datahall.html', 'utf8'),
});
/* Strip comments before scanning: the repair comments deliberately NAME the phantom keys so the next
   reader understands the defect. Documentation must not trip the gate — only executable reads may. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')          // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');     // line comments (":" guard keeps http:// intact)
}
for (const [page, source] of Object.entries(pageSources)) {
  const code = stripComments(source);
  for (const phantom of FORBIDDEN_PATHS) {
    const key = phantom.split('.').pop();
    const pattern = new RegExp(`\\b[A-Za-z_$][\\w$]*\\.(?:site|datahall)\\.${key}\\b`);
    const hit = pattern.exec(code);
    assert.ok(!hit, `${page} must not read the phantom key ${phantom} (found: ${hit && hit[0]})`);
  }
}

/* ── 2. DYNAMIC: perturb the engine, require the rendered strips to follow ─────────────────────── */
const server = createServer(async (req, res) => {
  const full = safeFilePath(new URL(req.url, 'http://localhost').pathname);
  if (!full) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(full);
    res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

try {
  const perturbedEngine = engineSource.replace(/it_load_kw:\s*\d+(?:\.\d+)?/, `it_load_kw: ${PERTURBED_IT_KW}`);
  assert.ok(perturbedEngine !== engineSource, 'perturbation must actually modify the engine source');

  const pue = snapshot.site.pue;
  const expectIt = (PERTURBED_IT_KW / 1000).toFixed(2);
  const expectFacility = ((PERTURBED_IT_KW * pue) / 1000).toFixed(2);

  const checks = [
    { page: 'EPMS_Telemetry.html', expected: { 'epms-it': expectIt, 'epms-fac': expectFacility } },
    { page: 'datahall.html', expected: { 'dh-rack-load': expectIt } },
  ];

  for (const { page, expected } of checks) {
    const tab = await browser.newPage();
    await tab.setRequestInterception(true);
    tab.on('request', (request) => {
      if (request.url().includes('conv-engine.js')) {
        request.respond({ status: 200, contentType: 'text/javascript', body: perturbedEngine });
        return;
      }
      request.continue();
    });
    await tab.goto(`${base}/${page}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((accept) => setTimeout(accept, 1500));
    const rendered = await tab.evaluate((ids) => {
      const out = {};
      for (const id of ids) {
        const el = document.getElementById(id);
        out[id] = el ? el.textContent.trim() : null;
      }
      return out;
    }, Object.keys(expected));
    for (const [id, want] of Object.entries(expected)) {
      assert.equal(
        rendered[id], want,
        `${page} #${id} must follow the engine (got ${rendered[id]}, expected ${want}) — a literal cannot pass`,
      );
    }
    await tab.close();
  }

  /* datahall power density must be derived from the engine kW and the page's own exported rack count,
     never from an invented constant. */
  const tab = await browser.newPage();
  await tab.setRequestInterception(true);
  tab.on('request', (request) => {
    if (request.url().includes('conv-engine.js')) {
      request.respond({ status: 200, contentType: 'text/javascript', body: perturbedEngine });
      return;
    }
    request.continue();
  });
  await tab.goto(`${base}/datahall.html`, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((accept) => setTimeout(accept, 1500));
  const density = await tab.evaluate(() => ({
    shown: document.getElementById('dh-pd')?.textContent.trim() ?? null,
    racks: window.RZ_DATAHALL_RACKS ?? null,
  }));
  assert.ok(typeof density.racks === 'number' && density.racks > 0, 'datahall must export its authored rack count');
  assert.equal(
    density.shown, (PERTURBED_IT_KW / density.racks).toFixed(1),
    'datahall power density must derive from engine kW / exported rack count',
  );
  await tab.close();

  console.log('PASS Conventional snapshot binding: no phantom keys, and rendered strips follow a perturbed engine');
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}
