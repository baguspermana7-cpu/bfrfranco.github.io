import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';

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
    meta: Object.freeze({ scenario: 'Simulated', data_quality: 'GOOD', version: '2.0.0' }),
    site: Object.freeze({ it_load_kw: 30000 }),
    campus: Object.freeze({ hall_count: 4, racks_total: 2000 }),
    fire: Object.freeze({ static_pressure_bar: 12.5 })
  })
});`;

const MISSING_META_FIXTURE = `
window.CONV_CALC = Object.freeze({
  snapshot: Object.freeze({
    meta: Object.freeze({ version: '2.0.0' }),
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
      `<script type="application/json" src="js/conv-engine.js?v=2.0.0"></script><script>${LEGACY_ENGINE_FIXTURE}<\/script>`);
}

function withIncompleteFireEngine(source) {
  const scriptPattern = /<script src="js\/conv-engine\.js\?v=[^"]+"><\/script>/;
  assert.match(source, scriptPattern, 'fire page must load the governed Conventional engine');
  return source.replace(scriptPattern,
    `<script type="application/json" src="js/conv-engine.js?v=2.0.0"></script><script>${INCOMPLETE_FIRE_FIXTURE}<\/script>`);
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
    `<script type="application/json" src="js/conv-engine.js?v=2.0.0"></script><script>${MISSING_META_FIXTURE}<\/script>`);
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
      'tank-cap-tag', 'tank-level-txt', 'tank-vol-txt', 'tank-dur-txt',
      'm-it-basis', 'm-tank-pct', 'm-tank-vol', 'm-pump-demand', 'm-duration',
      'm-hall-vol', 'm-zones', 'm-static', 'as-banner', 'as-facp', 'as-vesda', 'as-crit',
      'as-sup', 'as-trbl', 'as-tank', 'as-press', 'as-quality', 'flow-val',
      'as-scenario', 'as-updated',
      'fire-authority', 'pump-cards', 'log-view', 'label-m1-state', 'label-j-state',
      'label-m2-state', 'label-n2-state',
    ];
    return {
      ...Object.fromEntries(ids.map((id) => [id, byId(id)])),
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
      pumpLedFills: ['led-j', 'led-m1', 'led-m2']
        .map((id) => document.getElementById(id)?.getAttribute('fill') || ''),
      gaugePinOpacity: document.getElementById('gauge-pin')?.style.opacity || '',
      semanticLineStates: [
        'path-suction', 'path-discharge', 'path-j-discharge', 'path-m2-discharge',
        'path-to-wet', 'path-to-pre', 'path-n2', 'path-n2-header', 'path-n2-pv1',
        'path-n2-pv2', 'path-n2-pv3', 'path-n2-pv4', 'path-n2-pv5',
      ]
        .map((id) => ({
          id,
          state: document.getElementById(id)?.getAttribute('data-state') || '',
          current: document.getElementById(id)?.getAttribute('data-current') || '',
        })),
    };
  });
}

function assertNoInvalidNumerics(values, context) {
  const rendered = Object.values(values).join(' | ');
  assert.doesNotMatch(rendered, /(?:null|NaN|Infinity|undefined)/i, `${context} rendered an invalid numeric token`);
}

const source = await readFile(FIRE_PATH, 'utf8');
assert.match(source, /js\/conv-engine\.js\?v=2\.0\.0/, 'fire page must load the current conventional engine cache token');
assert.match(source, /id="fire-current-basis-value">UNAVAILABLE</, 'first-paint current basis must fail closed');
assert.match(source, /id="tank-vol-txt"[^>]*>UNAVAILABLE</, 'first-paint reserve volume must fail closed');
assert.match(source, /id="tank-dur-txt"[^>]*>Duration · UNAVAILABLE</, 'first-paint duration must fail closed');
assert.match(source, /id="as-banner"[^>]*>FIRE AUTHORITY UNAVAILABLE</, 'first-paint banner must fail closed');
assert.match(source, /id="as-facp">UNAVAILABLE</, 'first-paint FACP state must fail closed');
assert.match(source, /id="as-scenario">UNAVAILABLE</, 'first-paint scenario provenance must fail closed');
assert.match(source, /id="as-updated">UNAVAILABLE</, 'first-paint update time must fail closed');
assert.equal((source.match(/data-pid-symbol="centrifugal-pump"/g) || []).length, 3,
  'FP-01, JP-01, and FP-02 must use recognizable centrifugal-pump P&ID symbols');
assert.doesNotMatch(source,
  /id="spin-(?:m1|j|m2)"[^>]*>\s*<line[^>]*>\s*<line/i,
  'fire pumps must not use the generic plus-in-circle placeholder');
assert.match(source, /id="log-view"[\s\S]*?Fire authority UNAVAILABLE/i, 'first-paint log must not claim healthy state');
assert.doesNotMatch(source, /Live mimic|live tank/i,
  'simulated Fire current-state copy must not claim live telemetry/equipment');
assert.match(source, /Site rack-footprint proxy \(non-sizing\)/,
  'Fire inspector must label the site-wide rack-footprint number as a non-sizing proxy');
assert.doesNotMatch(source, /Protected hall volume/,
  'site-wide rack-footprint context must not masquerade as protected enclosure volume');
assert.doesNotMatch(source, /pressure maintain @ 7\.5 bar/,
  'jockey-pump semantic line must not publish the retired unsupported pressure');
for (const pathId of [
  'path-suction', 'path-discharge', 'path-j-discharge', 'path-m2-discharge',
  'path-to-wet', 'path-to-pre', 'path-n2', 'path-n2-header', 'path-n2-pv1',
  'path-n2-pv2', 'path-n2-pv3', 'path-n2-pv4', 'path-n2-pv5',
]) {
  const pathTag = source.match(new RegExp(`<path[^>]+id="${pathId}"[^>]*>`))?.[0] || '';
  assert.match(pathTag, /data-state="unavailable"/, `${pathId} first-paint state must fail closed`);
  assert.match(pathTag, /data-current="UNAVAILABLE"/, `${pathId} first-paint current must fail closed`);
}

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
  assert.equal(current['tank-vol-txt'], '105 m³ / 114 m³');
  assert.equal(current['tank-dur-txt'], 'Duration ≈ 42 min');
  assert.equal(current['m-duration'], '42 min');
  assert.equal(current['m-hall-vol'], '7,200 m³ proxy');
  assert.match(current['fire-duration-shortfall'], /36 m³ short.*60 min requirement/i);
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
  assert.ok(current.semanticLineStates.every((line) => line.state !== 'unavailable' && line.current !== 'UNAVAILABLE'),
    'current authority must restore every fire-water and N2 semantic line');
  assert.equal(
    current.semanticLineStates.find((line) => line.id === 'path-j-discharge')?.current,
    'pressure maintained @ 12.5 bar (simulated static)',
    'jockey-pump semantic line must bind to the governed simulated header pressure',
  );
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
  const pumpLabelGeometry = await fresh.evaluate(() => {
    const svg = document.getElementById('fire-svg');
    return ['label-m1-state', 'label-j-state', 'label-m2-state'].map((id) => {
      const label = document.getElementById(id);
      const group = label?.closest('g[role="button"]');
      const point = svg.createSVGPoint();
      point.x = 0;
      point.y = 0;
      const center = point.matrixTransform(group.getScreenCTM());
      const rect = label.getBoundingClientRect();
      return { id, labelBottom: rect.bottom, pipeCenterY: center.y };
    });
  });
  for (const label of pumpLabelGeometry) {
    assert.ok(label.labelBottom <= label.pipeCenterY - 2,
      `${label.id} overlaps its pump pipe centerline: bottom ${label.labelBottom}, center ${label.pipeCenterY}`);
  }

  for (const [width, height] of [[1180, 900], [768, 900], [390, 844]]) {
    await fresh.setViewport({ width, height, deviceScaleFactor: 1 });
    await new Promise((accept) => setTimeout(accept, 80));
    const responsive = await fresh.evaluate(() => ({
      columns: getComputedStyle(document.querySelector('.fire-scope-strip')).gridTemplateColumns,
      layoutColumns: getComputedStyle(document.querySelector('.layout-grid')).gridTemplateColumns,
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      bodyOverflow: Math.max(0, document.body.scrollWidth - document.body.clientWidth),
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
  assert.equal(incomplete.gaugePinOpacity, '0.35');
  assert.match(incomplete['pump-cards'], /UNAVAILABLE/);
  assert.doesNotMatch(incomplete['pump-cards'], /healthy|phase OK|battery|fuel 88%|standby|idle/i);
  assert.equal(incomplete['flow-val'], 'UNAVAILABLE');
  assert.equal(incomplete.activeStageChips, 0);
  assert.ok(incomplete.pumpLedFills.every((fill) => !/(?:34d399|st-normal)/i.test(fill)),
    'incomplete Fire authority must not leave standby pump LEDs green');
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
  assert.equal(unavailable['tank-cap-tag'], 'UNAVAILABLE');
  assert.equal(unavailable['tank-level-txt'], 'UNAVAILABLE');
  assert.equal(unavailable['tank-vol-txt'], 'UNAVAILABLE');
  assert.equal(unavailable['tank-dur-txt'], 'Duration · UNAVAILABLE');
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
  assert.equal(unavailable['flow-val'], 'UNAVAILABLE');
  assert.equal(unavailable.normalCauseEffectActive, false);
  assert.equal(unavailable.activeStageChips, 0);
  assert.equal(unavailable.armDisabled, true);
  assert.ok(unavailable.interlockRows.every((row) => /UNAVAILABLE/.test(row)), 'all rendered interlock states must fail closed');
  assert.ok(unavailable.pumpLedFills.every((fill) => !/(?:34d399|st-normal)/i.test(fill)), 'unknown pump LEDs must not remain green');
  assert.deepEqual(
    unavailable.semanticLineStates.filter((line) => line.state !== 'unavailable' || line.current !== 'UNAVAILABLE'),
    [],
    'unknown fire-water and N2 paths must not advertise energized/standby/charged state',
  );
  for (const id of ['label-m1-state', 'label-j-state', 'label-m2-state', 'label-n2-state']) {
    assert.match(unavailable[id], /UNAVAILABLE/, `${id} must fail closed`);
  }

  await legacy.$eval('#grp-main1', (node) => node.dispatchEvent(new Event('focus')));
  const pumpTooltip = await legacy.$eval('#tooltip-content', (node) => node.textContent);
  assert.match(pumpTooltip, /UNAVAILABLE/);
  assert.doesNotMatch(pumpTooltip, /Healthy|phase OK|AUTO|STANDBY/i);
  await legacy.$eval('#grp-n2', (node) => node.dispatchEvent(new Event('focus')));
  const n2Tooltip = await legacy.$eval('#tooltip-content', (node) => node.textContent);
  assert.match(n2Tooltip, /UNAVAILABLE/);
  assert.doesNotMatch(n2Tooltip, /Healthy|Live|STANDBY/i);
  assert.deepEqual(legacyErrors, [], `legacy authority page errors: ${legacyErrors.join(' | ')}`);
  await legacy.close();

  console.log('PASS fire current-basis cache, first-paint, runtime authority, and fail-closed rendering');
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}
