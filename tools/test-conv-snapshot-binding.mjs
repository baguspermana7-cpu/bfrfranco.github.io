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

/* v1.134.25 — this was a HAND-MAINTAINED list of nine paths, which Plan B2 flagged as the wrong
   shape: a list someone must remember to extend is a list that falls behind the moment a page
   binds something new, and the paths it checks are exactly the ones already least likely to be
   wrong. The registry knows every published path AND which pages consume each one, so the set is
   derived from it. The list grew from 9 to every consumed parameter without anyone maintaining it.

   The FORBIDDEN list below stays hand-written on purpose: it names keys that must never come
   back, and nothing can derive that from an engine which no longer has them. */
const registry = JSON.parse(await readFile('data/conv-parameters.json', 'utf8'));
const BOUND_PATHS = Object.freeze(registry.parameters
  .filter((p) => Array.isArray(p.consumers) && p.consumers.length > 0)
  .map((p) => p.id));
assert.ok(BOUND_PATHS.length >= 50,
  `only ${BOUND_PATHS.length} consumed parameters found — the registry looks stale or unreadable`);
/* `hall.` is a SCOPE prefix, not a top-level snapshot branch: those quantities are published
   per hall by getHallSnapshot() and on campus.halls[]. Resolving them against the root snapshot
   would report every one as a phantom key, which is a gate bug, not a finding. */
const hallSnapshot = (CALC.getHallSnapshot && CALC.getHallSnapshot('A'))
  || (snapshot.campus && snapshot.campus.halls && snapshot.campus.halls[0]) || null;
assert.ok(hallSnapshot, 'the engine publishes no hall snapshot to resolve hall-scoped parameters against');
for (const path of BOUND_PATHS) {
  const value = path.startsWith('hall.')
    ? hallSnapshot[path.slice('hall.'.length)]
    : resolvePath(path);
  assert.notEqual(value, undefined,
    `snapshot path must exist: ${path} — the registry says a cockpit reads it and the engine does `
    + 'not publish it, which is the phantom-key defect this gate exists to catch');
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
  /* v2.0.0: site.it_load_kw is DERIVED from the campus halls + active scenario, so it is no longer an
     authored literal. Perturb the adopted normal per-hall load instead — the campus roll-up, and therefore
     every bound strip, must follow it. */
  const perturbedEngine = engineSource.replace(
    /NORMAL_IT_KW_PER_HALL\s*=\s*\d+(?:\.\d+)?/, `NORMAL_IT_KW_PER_HALL = ${PERTURBED_IT_KW / 4}`);
  assert.ok(perturbedEngine !== engineSource, 'perturbation must actually modify the engine source');

  const pue = snapshot.site.pue;
  const hallCount = CALC.listHalls().length;
  const expectIt = (PERTURBED_IT_KW / 1000).toFixed(2);
  const expectFacility = ((PERTURBED_IT_KW * pue) / 1000).toFixed(2);
  /* SCOPE — v1.134.0. EPMS is a CAMPUS single-line, so its strips follow the campus roll-up.
     datahall.html draws ONE hall, so its rack load follows the HALL, i.e. campus / hall count.
     Asserting the campus figure there is what let a 30 MW load render on a 500-cabinet floor
     plan while this gate stayed green: the number followed the engine, but the page had taken
     the wrong SCOPE. The criterion is corrected, not relaxed — both values are still required
     to move with a perturbed engine, and neither may be a literal. */
  const expectHallIt = (PERTURBED_IT_KW / hallCount / 1000).toFixed(2);

  const checks = [
    { page: 'EPMS_Telemetry.html', expected: { 'epms-it': expectIt, 'epms-fac': expectFacility } },
    { page: 'datahall.html', expected: { 'dh-rack-load': expectHallIt } },
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
  assert.ok(typeof density.racks === 'number' && density.racks > 0, 'datahall must export its hall rack count');
  assert.equal(
    density.shown, (PERTURBED_IT_KW / hallCount / density.racks).toFixed(1),
    'datahall power density must derive from HALL kW / that hall\'s rack count — mixing a campus '
    + 'numerator with a hall denominator is the defect this line now guards against',
  );
  await tab.close();

  console.log('PASS Conventional snapshot binding: no phantom keys, and rendered strips follow a perturbed engine');
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}
