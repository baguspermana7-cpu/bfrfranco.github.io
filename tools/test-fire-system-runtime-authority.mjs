import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';
import { createRequire as __rzRequire } from 'node:module';
const ENGINE_PUBLISHED_VERSION = (() => {
  const m = __rzRequire(import.meta.url)(process.cwd() + '/js/conv-engine.js');
  return (m.CONV_CALC || m).snapshot.meta.version;
})();

const ROOT = process.cwd();
const FIRE_PATH = resolve(ROOT, 'fire-system.html');
const MIME = Object.freeze({
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
});

const LEGACY_ENGINE_FIXTURE = `
window.CONV_CALC = Object.freeze({
  snapshot: Object.freeze({
    meta: Object.freeze({ scenario: 'Simulated', data_quality: 'GOOD', version: '1.9.9' }),
    site: Object.freeze({ it_load_kw: 30000 }),
    campus: Object.freeze({ hall_count: 4, racks_total: 2000 }),
    fire: Object.freeze({
      reserve_capacity_m3: 114, level_pct: 92, stored_m3: 104.9,
      pump_demand_lpm: 2500, required_duration_min: 60,
      duration_min: 42.0, duration_at_full_min: 45.6,
      required_capacity_m3: 150, capacity_shortfall_m3: 36,
      zone_count: 5, static_pressure_bar: 12.5
    })
  })
});`;

const INCOMPLETE_FIRE_FIXTURE = `
window.CONV_CALC = Object.freeze({
  snapshot: Object.freeze({
    meta: Object.freeze({ scenario: 'Simulated', data_quality: 'GOOD', version: '${ENGINE_PUBLISHED_VERSION}' }),
    site: Object.freeze({ it_load_kw: 30000 }),
    campus: Object.freeze({ hall_count: 4, racks_total: 2000 }),
    fire: Object.freeze({ static_pressure_bar: 12.5 })
  })
});`;

const MISSING_META_FIXTURE = `
window.CONV_CALC = Object.freeze({
  snapshot: Object.freeze({
    meta: Object.freeze({ version: '${ENGINE_PUBLISHED_VERSION}' }),
    site: Object.freeze({ it_load_kw: 30000 }),
    campus: Object.freeze({ hall_count: 4, racks_total: 2000 }),
    fire: Object.freeze({
      reserve_capacity_m3: 114, level_pct: 92, stored_m3: 104.9,
      pump_demand_lpm: 2500, required_duration_min: 60,
      duration_min: 42.0, duration_at_full_min: 45.6,
      required_capacity_m3: 150, capacity_shortfall_m3: 36,
      zone_count: 5, static_pressure_bar: 12.5
    })
  })
});`;

function safeFilePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.endsWith('/') ? `${decoded.slice(1)}index.html` : decoded.slice(1);
  const target = resolve(ROOT, relative || 'index.html');
  return target.startsWith(`${resolve(ROOT)}${sep}`) ? target : null;
}

function withLegacyEngine(source) {
    const scriptPattern = /<script src="js\/conv-engine\.js\?v=[^"]+"><\/script>/;
    assert.match(source, scriptPattern, 'fire page must load the governed Conventional engine');
    return source.replace(scriptPattern,
      `<script type="application/json" src="js/conv-engine.js?v=${ENGINE_PUBLISHED_VERSION}"></script><script>${LEGACY_ENGINE_FIXTURE}<\/script>`);
}

function withIncompleteFireEngine(source) {
  const scriptPattern = /<script src="js\/conv-engine\.js\?v=[^"]+"><\/script>/;
  assert.match(source, scriptPattern, 'fire page must load the governed Conventional engine');
  return source.replace(scriptPattern,
    `<script type="application/json" src="js/conv-engine.js?v=${ENGINE_PUBLISHED_VERSION}"></script><script>${INCOMPLETE_FIRE_FIXTURE}<\/script>`);
}

function withoutEngine(source) {
  const scriptPattern = /<script src="js\/conv-engine\.js\?v=[^"]+"><\/script>/;
  assert.match(source, scriptPattern, 'fire page must load the governed Conventional engine');
  return source.replace(scriptPattern,
    '<script type="application/json" data-fixture="missing-engine"><\/script>');
}

function withMissingMetaEngine(source) {
  const scriptPattern = /<script src="js\/conv-engine\.js\?v=[^"]+"><\/script>/;
  assert.match(source, scriptPattern, 'fire page must load the governed Conventional engine');
  return source.replace(scriptPattern,
    `<script type="application/json" src="js/conv-engine.js?v=${ENGINE_PUBLISHED_VERSION}"></script><script>${MISSING_META_FIXTURE}<\/script>`);
}

async function serve(request, response) {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/fire-system.html' && url.searchParams.get('fixture') === 'legacy') {
    const source = await readFile(FIRE_PATH, 'utf8');
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    response.end(withLegacyEngine(source));
    return;
  }
  if (url.pathname === '/fire-system.html' && url.searchParams.get('fixture') === 'incomplete-fire') {
    const source = await readFile(FIRE_PATH, 'utf8');
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    response.end(withIncompleteFireEngine(source));
    return;
  }
  if (url.pathname === '/fire-system.html' && url.searchParams.get('fixture') === 'missing-engine') {
    const source = await readFile(FIRE_PATH, 'utf8');
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    response.end(withoutEngine(source));
    return;
  }
  if (url.pathname === '/fire-system.html' && url.searchParams.get('fixture') === 'missing-meta') {
    const source = await readFile(FIRE_PATH, 'utf8');
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    response.end(withMissingMetaEngine(source));
    return;
  }

  const target = safeFilePath(url.pathname);
  if (!target) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await readFile(target);
    response.writeHead(200, {
      'Content-Type': MIME[extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
  }
}

async function startServer() {
  const server = createServer((request, response) => { void serve(request, response); });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function readFireState(page) {
  return page.evaluate(() => {
    const byId = (id) => document.getElementById(id)?.textContent.trim() || '';
    const ids = [
      'basis-tag', 'fire-current-basis-value', 'fire-duration-shortfall',
      'm-it-basis', 'm-tank-pct', 'm-tank-vol', 'm-pump-demand', 'm-duration',
      'm-hall-vol', 'm-zones', 'm-static', 'as-banner', 'as-facp', 'as-vesda', 'as-crit',
      'as-sup', 'as-trbl', 'as-tank', 'as-press', 'as-quality',
      'as-scenario', 'as-updated',
      'fire-authority', 'pump-cards', 'log-view',
    ];
    /* FS-M-101 (js/conv/fire-sheet.js) — values, node states and pipe flow states read from the drawing */
    const svg = document.getElementById('fire-svg');
    /* a point's state glyph (tspan.rz-pt-g, aria-hidden, PRD-CONV-POINT-STATUS-TREND) is decoration, not the value */
    const vtext = (t) => { let x = ''; t.childNodes.forEach((n) => { if (!(n.classList && n.classList.contains('rz-pt-g'))) x += n.textContent; }); return x.trim(); };
    const val = (node, k) => { const t = svg?.querySelector(`[data-val="${node}:${k}"]`); return t ? vtext(t) : ''; };
    const nodeState = (node) => svg?.querySelector(`.hmi-node[data-node="${node}"]`)?.getAttribute('data-state') || '';
    const flow = (edge) => svg?.querySelector(`path.hmi-edge[data-edge="${edge}"]`)?.getAttribute('data-flow') || '';
    const sheet = {
      tankLvl: val('tank', 'lvl'), tankVol: val('tank', 'vol'), tankDur: val('tank', 'dur'),
      pt: val('pt', 'p'), fe: val('fe', 'q'), fp1: val('fp1', 'st'), jp1: val('jp1', 'st'), fp2: val('fp2', 'st'), cmd: [val('fp1', 'cmd'), val('jp1', 'cmd'), val('fp2', 'cmd')], n2: val('n2', 'p'),
      facp: val('facp', 'st'), zone1: val('zd1', 'st'), zone2: val('zd2', 'st'),
      states: Object.fromEntries(['fp1', 'jp1', 'fp2', 'n2', 'pav1', 'pav2', 'sp1', 'tank'].map((n) => [n, nodeState(n)])),
      pumpSymbols: svg ? svg.querySelectorAll('.hmi-node[data-sym="pumpCentrifugal"]').length : 0,
      flows: Object.fromEntries(['e-suc', 'e-d1', 'e-h0', 'e-h1', 'e-h2', 'e-hdr', 'e-w1', 'e-z1', 'e-zs1', 'e-z2', 'e-n2', 'e-n2h', 'e-n2z1', 'e-n2z2']
        .map((e) => [e, flow(e)])),
    };
    return {
      ...Object.fromEntries(ids.map((id) => [id, byId(id)])),
      sheet,
      stripClass: document.getElementById('alarm-strip')?.className || '',
      bannerColor: getComputedStyle(document.getElementById('as-banner')).color,
      reserveFindingClass: document.getElementById('fire-reserve-finding')?.className || '',
      facpDotClass: document.getElementById('as-dot-facp')?.getAttribute('class') || '',
      vesdaDotClass: document.getElementById('as-dot-vesda')?.getAttribute('class') || '',
      normalCauseEffectActive: document.querySelector('#ce-matrix .ce-row.is-normal') !== null,
      activeStageChips: document.querySelectorAll('#fire-stages-legend .fs-chip.is-active').length,
      armDisabled: document.getElementById('btn-arm')?.disabled === true,
      interlockRows: Array.from(document.querySelectorAll('#fire-interlock-list [data-interlock]'))
        .map((row) => row.textContent.trim()),
    };
  });
}

function assertNoInvalidNumerics(values, context) {
  const rendered = JSON.stringify(values);
  assert.doesNotMatch(rendered, /(?:null|NaN|Infinity|undefined)/i, `${context} rendered an invalid numeric token`);
}

const source = await readFile(FIRE_PATH, 'utf8');
/* v1.134.23 — this asserted the cache token as the LITERAL 2.0.0. Bumping the engine to
   2.1.0 broke it here and in three sibling gates, while the pages themselves were correct:
   the gate was pinning a version, not checking agreement. Read the published version instead,
   so the assertion keeps its meaning when the engine legitimately moves. Whether the pages
   AGREE with it is tools/test-conv-engine-version-pins.mjs's job. */
assert.match(source, new RegExp('js/conv-engine\\.js\\?v='
  + ENGINE_PUBLISHED_VERSION.replace(/\./g, '\\.')),
  'fire page must load the current conventional engine cache token');
assert.match(source, /id="fire-current-basis-value">UNAVAILABLE</, 'first-paint current basis must fail closed');
assert.match(source, /id="fire-sheet-host"/, 'the fire P&ID is the FS-M-101 sheet');
assert.match(source, /js\/conv\/fire-sheet\.js\?v=/, 'the sheet geometry loads from js/conv/fire-sheet.js');
assert.match(source, /js\/rz-hmi-sheet\.js\?v=/, 'the sheet is drawn by the shared HMI sheet renderer');
assert.doesNotMatch(source, /<svg id="fire-svg"/, 'the hand-drawn fire SVG is retired');
assert.match(source, /id="as-banner"[^>]*>FIRE AUTHORITY UNAVAILABLE</, 'first-paint banner must fail closed');
assert.match(source, /id="as-facp">UNAVAILABLE</, 'first-paint FACP state must fail closed');
assert.match(source, /id="as-scenario">UNAVAILABLE</, 'first-paint scenario provenance must fail closed');
assert.match(source, /id="as-updated">UNAVAILABLE</, 'first-paint update time must fail closed');
assert.match(source, /id="log-view"[\s\S]*?Fire authority UNAVAILABLE/i, 'first-paint log must not claim healthy state');
assert.doesNotMatch(source, /Live mimic|live tank/i,
  'simulated Fire current-state copy must not claim live telemetry/equipment');
assert.match(source, /Site rack-footprint proxy \(non-sizing\)/,
  'Fire inspector must label the site-wide rack-footprint number as a non-sizing proxy');
assert.doesNotMatch(source, /Protected hall volume/,
  'site-wide rack-footprint context must not masquerade as protected enclosure volume');
assert.doesNotMatch(source, /pressure maintain @ 7\.5 bar/,
  'jockey-pump semantic line must not publish the retired unsupported pressure');

const { server, origin } = await startServer();
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

try {
  const fresh = await browser.newPage();
  const freshErrors = [];
  fresh.on('pageerror', (error) => freshErrors.push(error.message));
  await fresh.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await fresh.goto(`${origin}/fire-system.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const current = await readFireState(fresh);
  assertNoInvalidNumerics(current, 'current engine');
  assert.match(current['basis-tag'], /30\.00 MW.*2,000 racks/i);
  assert.match(current['fire-current-basis-value'], /30\.00 MW IT.*114 m³ fire reserve.*5 pre-action zones/i);
  assert.equal(current.sheet.tankLvl, '92 %');
  assert.equal(current.sheet.tankVol, '105 / 114 m³');
  assert.equal(current.sheet.tankDur, '≈ 42 min');
  assert.equal(current.sheet.pumpSymbols, 3, 'FP-01, JP-01 and FP-02 are ISO 10628 centrifugal-pump symbols');
  /* W4 B2: the sheet prints the pump's feedback (RUN|STOP) and its command (CMD ON|OFF) as two values; the
     AUTO / STBY mode stays on the pump card */
  assert.deepEqual([current.sheet.fp1, current.sheet.jp1, current.sheet.fp2], ['STOP', 'STOP', 'STOP']);
  assert.deepEqual(current.sheet.cmd, ['CMD OFF', 'CMD OFF', 'CMD OFF']);
  assert.deepEqual([current.sheet.states.fp1, current.sheet.states.jp1, current.sheet.states.fp2], ['stopped', 'stopped', 'standby']);
  assert.equal(current['m-duration'], '42 min');
  assert.equal(current['m-hall-vol'], '7,200 m³ proxy');
  assert.match(current['fire-duration-shortfall'], /^36 m³ short of 60 min · 45\.6 min full · 42 min at 92 %$/);
  assert.equal(current['as-quality'], 'GOOD');
  assert.equal(current['as-scenario'], 'Simulated');
  assert.match(current['as-updated'], /^\d{2}:\d{2}:\d{2}$/);
  assert.equal(current['as-banner'], 'FACP NORMAL · FIRE-WATER RESERVE DESIGN DEFICIT');
  assert.match(current.stripClass, /state-warn/,
    'the governed reserve deficit must elevate the stage-0 strip to warning');
  assert.equal(current.bannerColor, 'rgb(245, 158, 11)',
    'the reserve design deficit must use supervisory amber, not healthy green or active-alarm red');
  assert.match(current.reserveFindingClass, /is-warning/,
    'the reserve finding and top banner must share the same warning breach state');
  assert.doesNotMatch(current.reserveFindingClass, /is-alarm/,
    'a design deficit is not an active fire alarm');
  assert.equal(current['as-facp'], 'Online');
  assert.match(current.facpDotClass, /ok/,
    'FACP availability remains normal even while the separate reserve design finding is active');
  assert.equal(current['as-sup'], '0',
    'the design deficit must not fabricate an FACP supervisory point');
  assert.match(current['pump-cards'], /AUTO · STANDBY/);
  assert.equal(current.normalCauseEffectActive, true);
  assert.equal(current.activeStageChips, 1);
  assert.equal(current.armDisabled, false);
  assert.deepEqual(Object.entries(current.sheet.flows).filter(([, f]) => f !== 'stopped'), [],
    'at stage 0 every fire-water and N2 pipe is charged and still (dashed), none unavailable, none flowing');
  assert.equal(current.sheet.pt, '12.5 bar', 'PT-01 binds to the governed simulated static header pressure');
  assert.equal(current.sheet.fe, '0.0 m³/h');

  /* stage 5 in zone 1: pumps on the pressure rule, PAV-01 open, its heads operate; zone 2 stays dry */
  assert.equal(await fresh.evaluate(() => window.RZFireOperator.stageForTest(5)), true);
  const released = await readFireState(fresh);
  assert.equal(released.sheet.states.fp1, 'running');
  assert.equal(released.sheet.states.pav1, 'open');
  assert.equal(released.sheet.states.pav2, 'closed');
  assert.equal(released.sheet.states.sp1, 'operated');
  assert.equal(released.sheet.zone1, 'RELEASE');
  assert.equal(released.sheet.zone2, 'NORMAL');
  assert.deepEqual(['e-suc', 'e-h0', 'e-hdr', 'e-z1', 'e-zs1'].map((e) => released.sheet.flows[e]),
    ['running', 'running', 'running', 'running', 'running'], 'the zone-1 discharge path flows end to end');
  assert.equal(released.sheet.flows['e-z2'], 'stopped', 'zone 2 does not flow');
  assert.equal(released.sheet.fe, '227.0 m³/h');
  await fresh.evaluate(() => window.RZFireOperator.stageForTest(0));
  /* v3.61 (PRD-CONV-REDRAW): the inspector rail sits beside the P&ID from 1800 px; below that it moves
     under the drawing so the drawing is shown whole at rest (test-conv-text-budget T3). */
  await fresh.setViewport({ width: 1920, height: 900, deviceScaleFactor: 1 });
  await new Promise((accept) => setTimeout(accept, 120));
  const desktopColumns = await fresh.$eval('.fire-scope-strip', (node) => getComputedStyle(node).gridTemplateColumns);
  assert.equal(desktopColumns.trim().split(/\s+/).length, 3, 'scope strip must use three balanced desktop columns');
  const desktopLayout = await fresh.evaluate(() => {
    const layout = document.querySelector('.layout-grid');
    const mimicColumn = layout?.firstElementChild;
    const inspector = document.querySelector('.fire-inspector-grid');
    const mimicRect = mimicColumn?.getBoundingClientRect();
    const inspectorRect = inspector?.getBoundingClientRect();
    return {
      columns: layout ? getComputedStyle(layout).gridTemplateColumns : '',
      mimic: mimicRect ? { left: mimicRect.left, right: mimicRect.right, top: mimicRect.top } : null,
      inspector: inspectorRect ? {
        left: inspectorRect.left,
        right: inspectorRect.right,
        top: inspectorRect.top,
        width: inspectorRect.width,
        height: inspectorRect.height,
        position: getComputedStyle(inspector).position,
        overflowY: getComputedStyle(inspector).overflowY,
        clientHeight: inspector.clientHeight,
        scrollHeight: inspector.scrollHeight,
      } : null,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  assert.equal(desktopLayout.columns.trim().split(/\s+/).length, 2,
    'desktop fire workspace must retain a P&ID column plus inspector rail');
  assert.ok(desktopLayout.mimic && desktopLayout.inspector, 'desktop fire workspace columns must render');
  assert.ok(desktopLayout.inspector.left >= desktopLayout.mimic.right,
    'desktop inspector rail must sit to the right of the P&ID');
  assert.ok(Math.abs(desktopLayout.inspector.top - desktopLayout.mimic.top) <= 2,
    'desktop inspector rail must start alongside the P&ID instead of below it');
  assert.ok(desktopLayout.inspector.width >= 320 && desktopLayout.inspector.width <= 380,
    `desktop inspector rail width is ${desktopLayout.inspector.width}px`);
  assert.ok(desktopLayout.inspector.right <= desktopLayout.viewportWidth + 1,
    'desktop inspector rail must remain inside the viewport');
  assert.ok(desktopLayout.inspector.top < desktopLayout.viewportHeight,
    'desktop inspector rail must be visible in the initial viewport');
  assert.equal(desktopLayout.inspector.position, 'sticky',
    'desktop Fire inspector must remain available while the operator follows the P&ID');
  assert.equal(desktopLayout.inspector.overflowY, 'auto',
    'bounded desktop Fire inspector must provide its own vertical scrollport');
  assert.ok(desktopLayout.inspector.height <= 722,
    `desktop Fire inspector escaped its 720px viewport bound: ${desktopLayout.inspector.height}px`);
  assert.ok(desktopLayout.inspector.scrollHeight > desktopLayout.inspector.clientHeight,
    'long Fire inspector content must remain reachable inside the bounded rail');
  await fresh.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await new Promise((accept) => setTimeout(accept, 120));
  const laptopLayout = await fresh.evaluate(() => {
    const layout = document.querySelector('.layout-grid');
    const mimic = layout?.firstElementChild?.getBoundingClientRect();
    const grid = document.querySelector('.fire-inspector-grid');
    const rail = grid?.getBoundingClientRect();
    return {
      columns: layout ? getComputedStyle(layout).gridTemplateColumns : '',
      railColumns: grid ? getComputedStyle(grid).gridTemplateColumns : '',
      mimicBottom: mimic?.bottom, mimicWidth: mimic?.width, railTop: rail?.top, railWidth: rail?.width,
    };
  });
  assert.equal(laptopLayout.columns.trim().split(/\s+/).length, 1, 'at 1440 px the P&ID takes the full width');
  assert.ok(laptopLayout.railTop >= laptopLayout.mimicBottom - 2, 'at 1440 px the inspector sits under the P&ID');
  assert.equal(laptopLayout.railColumns.trim().split(/\s+/).length, 3, 'at 1440 px the inspector spreads over three columns');
  assert.ok(laptopLayout.railWidth >= laptopLayout.mimicWidth - 2, 'at 1440 px the inspector spans the drawing width');
  const pumpLabelGeometry = await fresh.evaluate(() => ['fp1', 'jp1', 'fp2'].map((id) => {
    const svg = document.getElementById('fire-svg');
    const tag = svg.querySelector(`[data-tag-of="${id}"]`)?.getBoundingClientRect();
    const body = svg.querySelector(`.hmi-node[data-node="${id}"] [data-sym]`)?.getBoundingClientRect();
    return { id, tagBottom: tag?.bottom, symbolTop: body?.top };
  }));
  for (const label of pumpLabelGeometry) {
    assert.ok(label.tagBottom <= label.symbolTop + 1,
      `${label.id} tag overlaps its pump symbol: tag bottom ${label.tagBottom}, symbol top ${label.symbolTop}`);
  }

  for (const [width, height] of [[1180, 900], [768, 900], [390, 844]]) {
    await fresh.setViewport({ width, height, deviceScaleFactor: 1 });
    await new Promise((accept) => setTimeout(accept, 80));
    const responsive = await fresh.evaluate(() => ({
      columns: getComputedStyle(document.querySelector('.fire-scope-strip')).gridTemplateColumns,
      layoutColumns: getComputedStyle(document.querySelector('.layout-grid')).gridTemplateColumns,
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      /* the cockpit bar (js/conv/shell.js, v3.77.0) bleeds across the body margin to span the viewport on purpose;
         content the body clips is measured without it */
      bodyOverflow: (() => {
        const bar = document.querySelector('.cv-bar');
        const was = bar ? bar.style.display : '';
        if (bar) bar.style.display = 'none';
        const value = Math.max(0, document.body.scrollWidth - document.body.clientWidth);
        if (bar) bar.style.display = was;
        return value;
      })(),
      mimic: (() => {
        const scroller = document.querySelector('.main-svg');
        if (!scroller) return null;
        scroller.scrollLeft = scroller.scrollWidth;
        return {
          clientWidth: scroller.clientWidth,
          scrollWidth: scroller.scrollWidth,
          scrollLeft: scroller.scrollLeft,
          maxScrollLeft: scroller.scrollWidth - scroller.clientWidth,
        };
      })(),
    }));
    assert.equal(responsive.columns.trim().split(/\s+/).length, 1, `scope strip must stack at ${width}px`);
    assert.equal(responsive.layoutColumns.trim().split(/\s+/).length, 1,
      `fire workspace must stack below desktop at ${width}px`);
    assert.ok(responsive.overflow <= 2, `fire page overflowed ${width}px viewport by ${responsive.overflow}px`);
    assert.ok(responsive.bodyOverflow <= 2, `fire body hid ${responsive.bodyOverflow}px overflow at ${width}px`);
    if (width <= 900) {
      assert.ok(responsive.mimic.scrollWidth > responsive.mimic.clientWidth,
        `fire mimic needs a dedicated horizontal pan region at ${width}px`);
      assert.ok(responsive.mimic.scrollLeft > 0 && responsive.mimic.scrollLeft === responsive.mimic.maxScrollLeft,
        `fire mimic end nodes are not reachable at ${width}px`);
    }
  }
  assert.deepEqual(freshErrors, [], `fresh authority page errors: ${freshErrors.join(' | ')}`);
  await fresh.close();

  const incompleteFire = await browser.newPage();
  const incompleteFireErrors = [];
  incompleteFire.on('pageerror', (error) => incompleteFireErrors.push(error.message));
  await incompleteFire.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await incompleteFire.goto(`${origin}/fire-system.html?fixture=incomplete-fire`,
    { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const incomplete = await readFireState(incompleteFire);
  assertNoInvalidNumerics(incomplete, 'same-version incomplete Fire authority');
  assert.match(incomplete['basis-tag'], /30\.00 MW.*2,000 racks/i,
    'valid site/campus context should remain visible');
  assert.equal(incomplete['m-static'], 'UNAVAILABLE',
    'partial static pressure must not become an authoritative gauge reading');
  assert.equal(incomplete['as-press'], 'UNAVAILABLE');
  assert.equal(incomplete['as-scenario'], 'UNAVAILABLE');
  assert.equal(incomplete['as-updated'], 'UNAVAILABLE');
  assert.equal(incomplete.sheet.pt, 'UNAVAILABLE', 'partial authority must not draw a header pressure');
  assert.match(incomplete['pump-cards'], /UNAVAILABLE/);
  assert.doesNotMatch(incomplete['pump-cards'], /healthy|phase OK|battery|fuel 88%|standby|idle/i);
  assert.equal(incomplete.sheet.fe, 'UNAVAILABLE');
  assert.equal(incomplete.activeStageChips, 0);
  assert.ok(['fp1', 'jp1', 'fp2'].every((n) => !['running', 'standby', 'stopped'].includes(incomplete.sheet.states[n])),
    'incomplete Fire authority must not draw a pump state it cannot know');
  assert.deepEqual(incompleteFireErrors, [],
    `incomplete Fire authority page errors: ${incompleteFireErrors.join(' | ')}`);
  await incompleteFire.close();

  for (const fixture of ['missing-engine', 'missing-meta']) {
    const missingAuthority = await browser.newPage();
    const missingAuthorityErrors = [];
    missingAuthority.on('pageerror', (error) => missingAuthorityErrors.push(error.message));
    await missingAuthority.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await missingAuthority.goto(`${origin}/fire-system.html?fixture=${fixture}`,
      { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const missing = await readFireState(missingAuthority);
    assertNoInvalidNumerics(missing, fixture);
    assert.equal(missing['as-scenario'], 'UNAVAILABLE', `${fixture} must withhold scenario provenance`);
    assert.equal(missing['as-updated'], 'UNAVAILABLE', `${fixture} must withhold update time`);
    assert.equal(missing['as-quality'], 'UNAVAILABLE', `${fixture} must withhold data quality`);
    assert.equal(missing['as-banner'], 'FIRE AUTHORITY UNAVAILABLE');
    assert.equal(missing.armDisabled, true);
    assert.deepEqual(missingAuthorityErrors, [],
      `${fixture} page errors: ${missingAuthorityErrors.join(' | ')}`);
    await missingAuthority.close();
  }

  const legacy = await browser.newPage();
  const legacyErrors = [];
  legacy.on('pageerror', (error) => legacyErrors.push(error.message));
  await legacy.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await legacy.goto(`${origin}/fire-system.html?fixture=legacy`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const unavailable = await readFireState(legacy);
  assertNoInvalidNumerics(unavailable, 'legacy/missing authority');
  assert.equal(unavailable['basis-tag'], 'Basis: UNAVAILABLE');
  assert.match(unavailable['fire-current-basis-value'], /^UNAVAILABLE/);
  assert.match(unavailable['fire-duration-shortfall'], /^UNAVAILABLE/);
  assert.equal(unavailable.sheet.tankLvl, 'UNAVAILABLE');
  assert.equal(unavailable.sheet.tankVol, '—');
  assert.equal(unavailable.sheet.tankDur, '—');
  assert.equal(unavailable['m-tank-vol'], 'UNAVAILABLE');
  assert.equal(unavailable['m-duration'], 'UNAVAILABLE');
  assert.equal(unavailable['as-tank'], 'UNAVAILABLE');
  assert.equal(unavailable['as-press'], 'UNAVAILABLE');
  assert.equal(unavailable['as-quality'], 'UNAVAILABLE');
  assert.equal(unavailable['as-scenario'], 'UNAVAILABLE');
  assert.equal(unavailable['as-updated'], 'UNAVAILABLE');
  assert.equal(unavailable['as-banner'], 'FIRE AUTHORITY UNAVAILABLE');
  assert.equal(unavailable['as-facp'], 'UNAVAILABLE');
  assert.equal(unavailable['as-vesda'], 'UNAVAILABLE');
  assert.equal(unavailable['as-crit'], 'UNAVAILABLE');
  assert.equal(unavailable['as-sup'], 'UNAVAILABLE');
  assert.equal(unavailable['as-trbl'], 'UNAVAILABLE');
  assert.match(unavailable.stripClass, /state-warn/);
  assert.match(unavailable.facpDotClass, /warn/);
  assert.match(unavailable.vesdaDotClass, /warn/);
  assert.match(unavailable['fire-authority'], /UNAVAILABLE/);
  assert.doesNotMatch(unavailable['log-view'], /healthy|stable|comms OK/i);
  assert.match(unavailable['log-view'], /UNAVAILABLE/);
  assert.match(unavailable['pump-cards'], /UNAVAILABLE/);
  assert.doesNotMatch(unavailable['pump-cards'], /healthy|phase OK|battery|fuel 88%|standby|idle/i);
  assert.equal(unavailable.sheet.fe, 'UNAVAILABLE');
  assert.equal(unavailable.normalCauseEffectActive, false);
  assert.equal(unavailable.activeStageChips, 0);
  assert.equal(unavailable.armDisabled, true);
  assert.ok(unavailable.interlockRows.every((row) => /UNAVAILABLE/.test(row)), 'all rendered interlock states must fail closed');
  assert.ok(['fp1', 'jp1', 'fp2'].every((n) => !['running', 'standby', 'stopped'].includes(unavailable.sheet.states[n])),
    'unknown pumps must not be drawn running, stopped or standby');
  assert.deepEqual(Object.entries(unavailable.sheet.flows).filter(([, f]) => f !== 'unavailable'), [],
    'unknown fire-water and N2 pipes must be drawn unavailable (hairline), never charged or flowing');
  for (const k of ['fp1', 'jp1', 'fp2', 'pt']) assert.equal(unavailable.sheet[k], 'UNAVAILABLE', `${k} must fail closed`);

  await legacy.$eval('#fire-svg .hmi-node[data-node="fp1"]', (node) => node.focus());
  const pumpTooltip = await legacy.$eval('#hmiTip', (node) => node.textContent);
  assert.match(pumpTooltip, /UNAVAILABLE/);
  assert.doesNotMatch(pumpTooltip, /Healthy|phase OK|AUTO|STANDBY/i);
  await legacy.$eval('#fire-svg .hmi-node[data-node="n2"]', (node) => node.focus());
  const n2Tooltip = await legacy.$eval('#hmiTip', (node) => node.textContent);
  assert.match(n2Tooltip, /UNAVAILABLE/);
  assert.doesNotMatch(n2Tooltip, /Healthy|Live|STANDBY/i);
  assert.deepEqual(legacyErrors, [], `legacy authority page errors: ${legacyErrors.join(' | ')}`);
  await legacy.close();

  console.log('PASS fire current-basis cache, first-paint, runtime authority, and fail-closed rendering');
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}
