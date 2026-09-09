#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { classifyPage, planCoverage, summarize, pagePriority, DEFAULT_THEMES, DEFAULT_WIDTHS } from './site-render-audit-core.mjs';
import { auditRow, writeJson, probeSnapshot, serverHealth, recoverBrowser, environmentFailure } from './site-render-audit-runner.mjs';
import { runPool, serializeWrites } from './site-render-audit-pool.mjs';
import { fingerprintEvidence, resumeRows } from './site-render-audit-evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HELP = `Tracked-HTML site render audit (serial Puppeteer; no auth bypass).
  --inventory          Write inventory/coverage only; NEVER launch a browser
  --resume             Preserve existing artifacts; recheck superseded probe rows
  --baseline           Explicit representative subset, not full-site approval
  --public-only        Explicitly mark internal/noindex rows not visually reviewed
  --functional-noindex Follow-up: functional noindex pages, not internal/source artifacts
  --include REGEX      Filter tracked relative paths; omitted rows stay FILTERED
  --limit N            Cap selected pages (not inventory)
  --themes light,dark  Default both
  --widths 390,768,1440 Default three viewport widths; height 900
  --base URL           Default http://127.0.0.1:8081/ (existing static server)
  --out DIR            New/empty artifact directory
  --timeout MS         Per-operation timeout (default 15000); state deadline max 20000
  --concurrency=1      Default serial; optional 2 isolated contexts in ONE browser
  --axe                Optional vendored axe color-contrast checks
  --capture-all        Save viewport screenshots even when checks pass
  --help               Print this help without browser launch
Exit: 0 selected checks pass; 1 defects/unverified/pending/empty selection; 2 setup error.
Filtered runs always have fullCoverage=false, even when selected checks pass.`;

export function parseOptions(args) {
  const options = { base: 'http://127.0.0.1:8081/', themes: DEFAULT_THEMES, widths: DEFAULT_WIDTHS, timeout: 15000, concurrency: 1 };
  const flags = new Set(['inventory', 'baseline', 'axe', 'help', 'public-only', 'functional-noindex', 'resume', 'capture-all']);
  const values = new Set(['include', 'limit', 'themes', 'widths', 'base', 'out', 'timeout', 'concurrency']);
  for (let index = 0; index < args.length; index += 1) {
    const [key, ...inline] = args[index].replace(/^--/, '').split('=');
    if (!args[index].startsWith('--') || (!flags.has(key) && !values.has(key))) throw new Error(`Unknown option ${args[index]}`);
    if (flags.has(key)) { options[key] = true; continue; }
    const value = inline.length ? inline.join('=') : args[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    options[key] = value;
  }
  options.themes = Array.isArray(options.themes) ? options.themes : options.themes.split(',');
  options.widths = Array.isArray(options.widths) ? options.widths : options.widths.split(',').map(Number);
  for (const key of ['timeout', 'concurrency', 'limit']) {
    if (options[key] === undefined) continue;
    options[key] = Number(options[key]);
    if (!Number.isSafeInteger(options[key]) || options[key] < 1) throw new Error(`Invalid --${key}`);
  }
  if (![1, 2].includes(options.concurrency)) throw new Error('Only one or two contexts in a single browser are supported');
  if (!options.themes.length || options.themes.some(theme => !DEFAULT_THEMES.includes(theme))) throw new Error('Invalid --themes');
  if (!options.widths.length || options.widths.some(width => !Number.isSafeInteger(width) || width < 240 || width > 3840)) throw new Error('Invalid --widths');
  if (new Set(options.themes).size !== options.themes.length || new Set(options.widths).size !== options.widths.length) throw new Error('Duplicate matrix dimensions');
  if (options.include) new RegExp(options.include, 'i');
  const base = new URL(options.base);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Invalid HTTP base URL');
  options.base = base.href.endsWith('/') ? base.href : `${base.href}/`;
  options.publicOnly = Boolean(options['public-only']);
  options.functionalNoindex = Boolean(options['functional-noindex']);
  options.captureAll = Boolean(options['capture-all']);
  if (options.publicOnly && options.functionalNoindex) throw new Error('Choose public-only or functional-noindex, not both');
  return options;
}

export async function trackedInventory(root = ROOT) {
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 32 * 1024 * 1024 }).toString().split('\0')
    .filter(filename => /\.html?$/i.test(filename)).sort();
  return Promise.all(paths.map(async filename => {
    try { return classifyPage(filename, await fs.readFile(path.join(root, filename), 'utf8')); }
    catch (error) { return classifyPage(filename, '', String(error)); }
  }));
}

async function outputDirectory(requested, resume = false) {
  const toolsRoot = await fs.realpath(path.join(ROOT, 'tools'));
  const out = path.resolve(requested || path.join(toolsRoot, '.site-render-audit', new Date().toISOString().replace(/[:.]/g, '-')));
  await fs.mkdir(out, { recursive: true });
  if ((await fs.readdir(out)).length && !resume) throw new Error('Refusing to overwrite nonempty output directory');
  return out;
}

async function executeMatrix(manifest, options, out, save) {
  let browser;
  try {
    const initialHealth = await serverHealth(options.base);
    if (!initialHealth.available) throw new Error(initialHealth.reason);
    const { default: puppeteer } = await import('puppeteer');
    const launch = () => puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'], protocolTimeout: Math.min(options.timeout, 20000) });
    browser = await launch();
    let recoveryAttempts = 0;
    const axeSource = options.axe ? await fs.readFile(path.join(ROOT, 'tools/vendor/axe.min.js'), 'utf8') : null;
    await runPool(manifest.rows, options.concurrency, async (row, index) => {
      if (manifest.environmentStop) return 'stop';
      if (row.status !== 'PENDING') return;
      const health = await serverHealth(options.base);
      if (!health.available) { manifest.environmentStop = health.reason; return 'stop'; }
      const id = `${manifest.runId}-${String(index + 1).padStart(5, '0')}-${recoveryAttempts}`;
      const result = await auditRow(browser, row, { ...options, axeSource, out, id });
      result.evidenceFingerprint = manifest.evidenceFingerprint;
      await writeJson(path.join(out, `${id}.json`), result);
      manifest.rows[index] = { ...row, status: result.status, reason: result.blocked.length ? 'Blocked/auth content not verified' : null,
        result: `${id}.json`, screenshots: result.screenshots, findings: result.findings.length,
        probeVersion: result.probeVersion || null, history: row.history || [],
        environment: result.environment || null,
        evidenceFingerprint: manifest.evidenceFingerprint,
        articleStartY: result.measurements?.layout.articleStartY ?? null };
      await save();
      process.stdout.write(`${row.path} ${row.theme}/${row.width}: ${result.status} (${result.findings.length})\n`);
      if (result.environment === 'server-unavailable') { manifest.environmentStop = 'Server became unavailable'; return 'stop'; }
      if (result.environment === 'browser-unavailable') {
        if (options.concurrency > 1) { manifest.environmentStop = 'Browser unavailable; paused both-context pool for safe resume'; return 'stop'; }
        const recovery = await recoverBrowser(browser, launch, recoveryAttempts++);
        if (!recovery.recovered) { manifest.environmentStop = recovery.reason; return 'stop'; }
        browser = recovery.browser;
        const retryId = `${id}-recovered`;
        const retry = await auditRow(browser, row, { ...options, axeSource, out, id: retryId });
        await writeJson(path.join(out, `${retryId}.json`), retry);
        manifest.rows[index] = { ...manifest.rows[index], status: retry.status, result: `${retryId}.json`,
          screenshots: retry.screenshots, findings: retry.findings.length, probeVersion: retry.probeVersion || null, environment: retry.environment || null,
          history: [...(row.history || []), { result: `${id}.json`, status: 'UNVERIFIED', reason: 'Browser recovery' }] };
        await save();
        if (retry.environment) { manifest.environmentStop = 'Recovery failed; remaining states pending'; return 'stop'; }
      }
    });
  } catch (error) {
    manifest.fatalError = String(error);
  } finally {
    if (browser) {
      try { await browser.close(); } catch (error) { manifest.fatalError = `Browser cleanup: ${error}`; }
    }
    await save();
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) { process.stdout.write(`${HELP}\n`); return; }
  const out = await outputDirectory(options.out, options.resume);
  const previous = options.resume ? JSON.parse(await fs.readFile(path.join(out, 'coverage.json'), 'utf8')) : null;
  const inventory = (await trackedInventory()).sort((first, second) => pagePriority(first) - pagePriority(second)
    || first.path.localeCompare(second.path, 'en', { numeric: true }));
  const probe = await probeSnapshot();
  const rows = planCoverage(inventory, options);
  const evidence = await fingerprintEvidence(ROOT, options);
  const resumedRows = await resumeRows(rows, previous, out, evidence);
  const manifest = { schemaVersion: 1, startedAt: new Date().toISOString(), root: ROOT, options,
    runId: Date.now().toString(), probeVersion: probe.version,
    evidence, evidenceFingerprint: evidence.fingerprint,
    retiredInventory: (previous?.inventory || []).filter(prior => !inventory.some(page => page.path === prior.path)),
    inventory, rows: resumedRows, contrast: options.axe ? 'REQUESTED' : 'NOT_REQUESTED' };
  const write = serializeWrites(snapshot => writeJson(path.join(out, 'coverage.json'), snapshot));
  const save = () => write(structuredClone({ ...manifest, summary: summarize(manifest.rows) }));
  await save();
  process.stdout.write(`Inventory: ${inventory.length} HTML; selected combinations: ${manifest.rows.filter(row => row.status === 'PENDING').length}; explicit unreviewed: ${manifest.rows.filter(row => row.status === 'FILTERED').length}\nLive report: ${out}/coverage.json\n`);
  if (options.inventory) { process.stdout.write(`${inventory.length} tracked HTML files; inventory only: ${out}/coverage.json\n`); return; }
  await executeMatrix(manifest, options, out, save);
  const finalEvidence = await fingerprintEvidence(ROOT, options);
  manifest.sourceChangedDuringRun = evidence.fingerprint !== finalEvidence.fingerprint;
  manifest.finalEvidence = finalEvidence;
  manifest.finishedAt = new Date().toISOString();
  await save();
  const selected = manifest.rows.filter(row => row.status !== 'FILTERED');
  process.stdout.write(`${JSON.stringify(summarize(manifest.rows))}\nArtifacts: ${out}\n`);
  process.exitCode = manifest.fatalError || inventory.some(row => row.readError) || summarize(selected).status !== 'PASS' ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 2; });
}
