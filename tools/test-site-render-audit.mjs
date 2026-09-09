import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPage, planCoverage, evaluateMeasurements, summarize, pagePriority } from './site-render-audit-core.mjs';
import { parseOptions } from './audit-site-render.mjs';
import { resultStatus, auditRow, requestPolicy, serverHealth, recoverBrowser, environmentFailure, localTransportFailure, intentionalAnalyticsConsole, auditErrorFinding, scrollProgress } from './site-render-audit-runner.mjs';
import { buildReport, escapeMarkup, mergeReports } from './report-site-render.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runPool, serializeWrites } from './site-render-audit-pool.mjs';
import { fingerprintEvidence, resumeRows, renderRelevantFile } from './site-render-audit-evidence.mjs';

test('protocol deadlines and stalled scrolling are unverified evidence, unlike a proven HTTP failure', () => {
  for (const message of ['ProtocolError: Runtime.callFunctionOn timed out', 'TimeoutError: Navigation timeout', 'Page audit deadline exceeded', 'Scroll did not advance; internal scrolling unverified']) {
    assert.equal(auditErrorFinding(new Error(message)).status, 'UNVERIFIED');
  }
  assert.equal(auditErrorFinding(new Error('Navigation HTTP 404')).status, 'FAIL');
  assert.equal(scrollProgress(300, 300, 0), 1);
  assert.equal(scrollProgress(300, 310, 2), 0);
  assert.throws(() => scrollProgress(300, 300, 2), /Scroll did not advance/);
});

test('inventory fixtures retain editorial, translations, documents, subapps and internal HTML', () => {
  const fixtures = ['index.html', 'article-27.html', 'FF-2.html', 'geopolitics-3.html',
    'id/article-1.html', 'manual/chiller.html', 'prd/model.html', 'Apps/player/index.html',
    'tools/fixture.html', 'unfamiliar/deep/page.html'];
  const inventory = fixtures.map(path => classifyPage(path, '<html></html>'));
  assert.equal(inventory.length, fixtures.length);
  for (const row of inventory.slice(1, 7)) assert.ok(row.labels.includes('editorial'), row.path);
  assert.ok(inventory[7].labels.includes('subapps'));
  assert.ok(inventory[8].labels.includes('internal'));
  assert.ok(inventory[9].labels.includes('nested'));
  assert.ok(classifyPage('x.html', '<meta content="noindex, follow" name="robots">').labels.includes('noindex'));
});

test('filtering never drops inventory rows or matrix combinations', () => {
  const inventory = ['index.html', 'article-1.html'].map(path => classifyPage(path, ''));
  const rows = planCoverage(inventory, { include: '^article-', themes: ['light', 'dark'], widths: [390, 1440] });
  assert.equal(rows.length, 8);
  assert.equal(rows.filter(row => row.status === 'FILTERED').length, 4);
  assert.equal(rows.filter(row => row.status === 'PENDING').length, 4);
  assert.ok(rows.filter(row => row.status === 'FILTERED').every(row => row.reason));
});

const prose = { target: 'article > p', prose: true, fontSize: 15, lineRatio: 1.4,
  text: 'Actual editorial body prose', overflow: ['ancestor-clipping'], protected: false };
test('measurement fixtures detect small prose and clipping despite hidden document overflow', () => {
  const findings = evaluateMeasurements({ elements: [prose], images: [], documentOverflow: false });
  assert.deepEqual(findings.map(item => item.rule), ['prose-font-size', 'prose-line-height', 'text-overflow']);
});

test('instrument labels, SVG and aurora do not receive prose or decorative rules', () => {
  const findings = evaluateMeasurements({ elements: [{ ...prose, protected: true, overflow: [],
    decoration: ['purple-pill', 'gradient-callout'] }], images: [] });
  assert.deepEqual(findings, []);
});

test('normal lineheight is explicitly unverified rather than silently passing', () => {
  const findings = evaluateMeasurements({ elements: [{ ...prose, fontSize: 16, lineRatio: null, overflow: [] }], images: [] });
  assert.equal(findings[0].rule, 'prose-line-height-unmeasured');
  assert.equal(findings[0].status, 'UNVERIFIED');
});

test('computed 1.5 division roundoff passes but genuinely short lineheight fails', () => {
  const sample = { ...prose, fontSize: 16, lineRatio: 1.4999999999999998, overflow: [] };
  assert.deepEqual(evaluateMeasurements({ elements: [sample], images: [] }), []);
  assert.equal(evaluateMeasurements({ elements: [{ ...sample, lineRatio: 1.49 }], images: [] })[0].rule, 'prose-line-height');
});

test('missing images and banned surface fixtures are defects', () => {
  const findings = evaluateMeasurements({ elements: [{ ...prose, prose: false, overflow: [], decoration: ['purple-pill'] }],
    images: [{ target: '#broken', src: 'missing.png', complete: true, naturalWidth: 0 }] });
  assert.deepEqual(findings.map(item => item.rule), ['purple-pill', 'missing-image']);
});

test('pending, auth, failed and filtered coverage cannot become full healthy coverage', () => {
  for (const status of ['PENDING', 'UNVERIFIED', 'FAIL', 'FILTERED']) {
    const result = summarize([{ status: 'PASS' }, { status }]);
    assert.equal(result.fullCoverage, false);
    assert.notEqual(result.status, 'PASS');
  }
  assert.equal(summarize([]).status, 'UNVERIFIED');
  assert.equal(summarize([{ status: 'PASS' }]).status, 'PASS');
});

test('container and whitespace fixtures detect narrow columns, edge padding and large gaps', () => {
  const findings = evaluateMeasurements({ elements: [], images: [], layout: { viewportWidth: 390,
    articleStartY: 2894, blankGaps: [{ top: 700, bottom: 2500, height: 1800 }],
    proseBoxes: [{ target: 'p', width: 120, left: 0 }] } });
  assert.deepEqual(findings.map(finding => finding.rule), ['large-blank-gap', 'narrow-prose-container', 'prose-edge-padding']);
});

test('three-column card metadata is measured but not a narrow reading-column defect', () => {
  const findings = evaluateMeasurements({ elements: [], images: [], layout: { viewportWidth: 1440,
    proseBoxes: [{ target: '.card p', left: 200, width: 174, readingColumn: false }] } });
  assert.ok(!findings.some(finding => finding.rule === 'narrow-prose-container'));
});

test('contained scrollable content stays diagnostic, not document overflow failure', () => {
  const findings = evaluateMeasurements({ elements: [], images: [], documentOverflow: 211,
    layout: { actualScrollX: 211, uncontainedOverflowBoxes: [], proseBoxes: [] } });
  assert.ok(!findings.some(finding => finding.rule === 'document-overflow'));
});

test('CLI limits concurrency, malformed filters and empty/duplicate dimensions', () => {
  assert.equal(parseOptions(['--concurrency=1']).concurrency, 1);
  assert.equal(parseOptions(['--concurrency=2']).concurrency, 2);
  for (const args of [['--concurrency=3'], ['--include', '['], ['--widths', '390,390'], ['--themes', ''], ['--limit', '-1']]) {
    assert.throws(() => parseOptions(args));
  }
});

test('two-context pool is bounded, stops scheduling on failure and serializes manifest writes', async () => {
  let active = 0;
  let peak = 0;
  const inspected = [];
  const result = await runPool([0, 1, 2, 3, 4], 2, async item => {
    active += 1;
    peak = Math.max(peak, active);
    inspected.push(item);
    await new Promise(resolve => setImmediate(resolve));
    active -= 1;
    return 'stop';
  });
  assert.equal(peak, 2);
  assert.equal(result.stopped, true);
  assert.deepEqual(inspected, [0, 1]);
  const order = [];
  const save = serializeWrites(async item => { await new Promise(resolve => setImmediate(resolve)); order.push(item); });
  await Promise.all([save(1), save(2), save(3)]);
  assert.deepEqual(order, [1, 2, 3]);
});

test('auth block is UNVERIFIED even if an overlay has other defects', () => {
  assert.equal(resultStatus({ blocked: [{ target: '#rootGate' }], findings: [{ status: 'FAIL' }] }), 'UNVERIFIED');
});

test('browser/context failure cannot pass or lose the requested matrix identity', async () => {
  const result = await auditRow({ createBrowserContext: async () => { throw new Error('browser disconnected'); } },
    { path: 'article-1.html', theme: 'dark', width: 390 }, { timeout: 50 });
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.path, 'article-1.html');
  assert.match(result.findings[0].detail, /disconnected/);
});

test('server health fails closed and controlled browser recovery runs only once', async () => {
  assert.equal((await serverHealth('http://localhost/', async () => { throw new Error('fetch failed'); })).available, false);
  assert.equal((await serverHealth('http://localhost/', async () => ({ ok: false, status: 503 }))).available, false);
  assert.equal(environmentFailure('net::ERR_CONNECTION_REFUSED'), 'server-unavailable');
  assert.equal(environmentFailure('Connection closed'), 'browser-unavailable');
  let launches = 0;
  const launch = async () => { launches += 1; return {}; };
  assert.equal((await recoverBrowser({ close: async () => {} }, launch, 0)).recovered, true);
  assert.equal((await recoverBrowser({}, launch, 1)).recovered, false);
  assert.equal(launches, 1);
});

test('app fetch failures and unmatched CSP are not erased or treated as dead localhost', () => {
  assert.equal(environmentFailure('fetch failed'), null);
  assert.equal(localTransportFailure({ type: 'pageerror', message: 'fetch failed' }, 'http://localhost/'), false);
  assert.equal(localTransportFailure({ type: 'requestfailed', policy: 'external-read', url: 'https://api.example/', message: 'net::ERR_CONNECTION_REFUSED' }, 'http://localhost/'), false);
  assert.equal(localTransportFailure({ type: 'requestfailed', policy: 'local-read', url: 'http://localhost/a.js', message: 'net::ERR_CONNECTION_REFUSED' }, 'http://localhost/'), true);
  const blocked = [{ policy: 'blocked-analytics', url: 'https://www.google-analytics.com/a.js' }];
  assert.equal(intentionalAnalyticsConsole({ url: 'http://localhost/', message: 'Refused to execute inline script: Content Security Policy' }, blocked), false);
  assert.equal(intentionalAnalyticsConsole({ url: blocked[0].url, message: 'Failed to load resource' }, blocked), true);
});

test('resume invalidates HTML/CSS/JS/runner/base/axe changes and retains newly inventoried pages', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rz-render-evidence-'));
  try {
    const files = ['index.html', 'styles.css', 'app.js', 'runner.mjs'];
    for (const filename of files) await fs.writeFile(path.join(directory, filename), 'original');
    const options = { base: 'http://localhost:8093/', axe: false, widths: [390], themes: ['light'], timeout: 15000, concurrency: 1 };
    const initial = await fingerprintEvidence(directory, options, files);
    for (const filename of files) {
      await fs.writeFile(path.join(directory, filename), 'modified');
      assert.notEqual((await fingerprintEvidence(directory, options, files)).fingerprint, initial.fingerprint, filename);
      await fs.writeFile(path.join(directory, filename), 'original');
    }
    for (const changed of [{ ...options, axe: true }, { ...options, base: 'http://localhost:9000/' }]) {
      assert.notEqual((await fingerprintEvidence(directory, changed, files)).fingerprint, initial.fingerprint);
    }
    await fs.writeFile(path.join(directory, 'new.html'), 'new');
    assert.notEqual((await fingerprintEvidence(directory, options, [...files, 'new.html'])).fingerprint, initial.fingerprint);
    const row = { path: 'index.html', theme: 'light', width: 390, status: 'PENDING' };
    const prior = { ...row, status: 'PASS', result: 'result.json', evidenceFingerprint: initial.fingerprint };
    await fs.writeFile(path.join(directory, 'result.json'), JSON.stringify({ findings: [], status: 'PASS' }));
    const previous = { rows: [prior] };
    assert.equal((await resumeRows([row], previous, directory, initial))[0].status, 'PASS');
    const revised = { ...initial, fingerprint: 'new-evidence' };
    const resumed = await resumeRows([row, { ...row, path: 'new.html' }], previous, directory, revised);
    assert.deepEqual(resumed.map(item => item.status), ['PENDING', 'PENDING']);
    assert.equal(resumed[0].history[0].result, 'result.json');
    assert.equal((await resumeRows([row], { ...previous, sourceChangedDuringRun: true }, directory, initial))[0].status, 'PENDING');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('fingerprints exclude generated output and secrets but include product and owned runtime sources', async () => {
  for (const filename of ['output/report.html', 'output/shot.png', 'docs/report.pdf', '.env', '.env.local', '.codex/config.json', '.config/app/auth.json', 'auth.json', 'credentials.json', 'tests/fixture.html', 'tools/test-site-render-audit.mjs']) assert.equal(renderRelevantFile(filename), false, filename);
  for (const filename of ['article-1.html', 'css/new-untracked.css', 'css/rz-tokens.css', 'js/theme-tokens.js', 'design-tokens.json', 'js/new.js', 'manual/index.html', 'Apps/dca-app/dist/index.html', 'tools/site-render-audit-runner.mjs', 'tools/vendor/axe.min.js']) assert.equal(renderRelevantFile(filename), true, filename);
  assert.equal(renderRelevantFile('.auth-state.json'), false);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rz-render-output-'));
  try {
    await fs.mkdir(path.join(directory, 'output'));
    await fs.writeFile(path.join(directory, 'page.html'), 'product');
    await fs.writeFile(path.join(directory, 'output/report.html'), 'report-one');
    await fs.writeFile(path.join(directory, '.env'), 'private-do-not-read');
    const files = ['page.html', 'output/report.html', '.env'];
    const first = await fingerprintEvidence(directory, {}, files);
    await fs.writeFile(path.join(directory, 'output/report.html'), 'report-two');
    await fs.writeFile(path.join(directory, '.env'), 'changed-private-do-not-read');
    const second = await fingerprintEvidence(directory, {}, files);
    assert.equal(first.fingerprint, second.fingerprint);
    assert.equal(second.sourceCount, 1);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('public scope leaves noindex and internal rows explicitly unreviewed', () => {
  const inventory = [classifyPage('index.html', ''), classifyPage('tools/fixture.html', ''),
    classifyPage('hidden.html', '<meta name="robots" content="noindex">')];
  const rows = planCoverage(inventory, { publicOnly: true, themes: ['light'], widths: [390] });
  assert.deepEqual(rows.map(row => row.status), ['PENDING', 'FILTERED', 'FILTERED']);
  assert.match(rows[2].reason, /not visually reviewed/);
});

test('functional noindex follow-up includes functional gates but not archived mockups', () => {
  const source = '<meta name="robots" content="noindex">';
  const pages = ['index.html', 'calculator.html', 'rz-index-mockup.html', 'rz-ops-owner.html'].map(filename => classifyPage(filename, filename === 'index.html' ? '' : source));
  const rows = planCoverage(pages, { functionalNoindex: true, themes: ['light'], widths: [390] });
  assert.deepEqual(rows.map(row => row.status), ['FILTERED', 'PENDING', 'FILTERED', 'PENDING']);
});

test('QA fixtures are internal and Vite source entries cannot appear as blank deployed products', () => {
  assert.ok(classifyPage('.qa-screens/overflow-check.html', '').labels.includes('internal'));
  const source = classifyPage('Apps/dca-app/index.html', '<script type="module" src="/src/main.jsx"></script>');
  assert.ok(source.labels.includes('build-entry'));
  assert.equal(planCoverage([source])[0].status, 'FILTERED');
  assert.equal(classifyPage('Apps/dca-app/dist/index.html', '<script type="module" src="/assets/index-123.js"></script>').buildEntry, false);
});

test('audit blocks every write method and analytics, separates external read errors', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(requestPolicy('https://production.example/order', method, 'http://localhost:8093/'), 'blocked-write');
  assert.equal(requestPolicy('https://www.google-analytics.com/g/collect', 'GET', 'http://localhost:8093/'), 'blocked-analytics');
  assert.equal(requestPolicy('https://cdn.example/script.js', 'GET', 'http://localhost:8093/'), 'external-read');
  assert.equal(requestPolicy('http://localhost:8093/missing.js', 'GET', 'http://localhost:8093/'), 'local-read');
});

test('articles are evaluated before public roots and slower subapps without losing rows', () => {
  const inventory = ['Apps/dca-app/dist/index.html', 'index.html', 'FF-1.html', 'article-1.html', 'id/index.html', 'manual/index.html']
    .map(filename => classifyPage(filename, ''));
  const ordered = [...inventory].sort((first, second) => pagePriority(first) - pagePriority(second));
  assert.deepEqual(ordered.slice(0, 2).map(row => row.path), ['FF-1.html', 'article-1.html']);
  assert.equal(ordered.at(-1).path, 'Apps/dca-app/dist/index.html');
  assert.equal(planCoverage(ordered).length, inventory.length * 6);
});

test('HTML/JUnit reporting retains filtered and missing-artifact rows with escaped external text', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rz-render-report-'));
  try {
    const rows = [{ path: 'index.html', theme: 'light', width: 390, status: 'FAIL', result: 'missing.json' },
      { path: 'internal.html', theme: 'dark', width: 1440, status: 'FILTERED', reason: '<not reviewed>' }];
    await fs.writeFile(path.join(directory, 'coverage.json'), JSON.stringify({ rows, inventory: [], summary: summarize(rows) }));
    await buildReport(directory);
    const html = await fs.readFile(path.join(directory, 'report.html'), 'utf8');
    const xml = await fs.readFile(path.join(directory, 'junit.xml'), 'utf8');
    assert.match(html, /missing-result-artifact/);
    assert.match(html, /&lt;not reviewed&gt;/);
    assert.match(xml, /tests="2"/);
    assert.match(xml, /skipped="2"/);
    assert.equal(escapeMarkup('<script>"&'), '&lt;script&gt;&quot;&amp;');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('merged noindex coverage preserves public rows and relative screenshot links', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rz-render-merge-'));
  try {
    const publicDirectory = path.join(directory, 'public');
    const noindexDirectory = path.join(directory, 'noindex');
    const output = path.join(directory, 'combined');
    const evidence = await fingerprintEvidence(directory, {}, []);
    const base = { theme: 'light', width: 390, screenshots: [] };
    for (const [source, filename] of [[publicDirectory, 'index.html'], [noindexDirectory, 'private.html']]) {
      await fs.mkdir(source);
      const rows = ['index.html', 'private.html'].map(page => ({ ...base, evidenceFingerprint: evidence.fingerprint, path: page, status: page === filename ? 'PASS' : 'FILTERED',
        result: page === filename ? 'result.json' : undefined, screenshots: page === filename ? ['shot.png'] : [] }));
      await fs.writeFile(path.join(source, 'coverage.json'), JSON.stringify({ rows, evidence, evidenceFingerprint: evidence.fingerprint, inventory: rows.map(row => ({ path: row.path })) }));
      await fs.writeFile(path.join(source, 'result.json'), JSON.stringify({ ...rows.find(row => row.path === filename), findings: [], screenshots: ['shot.png'] }));
      await fs.writeFile(path.join(source, 'shot.png'), 'fixture');
    }
    await mergeReports([publicDirectory, noindexDirectory], output);
    await buildReport(output);
    const manifest = JSON.parse(await fs.readFile(path.join(output, 'coverage.json'), 'utf8'));
    assert.equal(manifest.inventory.length, 2);
    assert.equal(manifest.summary.counts.PASS, 2);
    assert.match(await fs.readFile(path.join(output, 'report.html'), 'utf8'), /\.\.\/public\/shot.png/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
