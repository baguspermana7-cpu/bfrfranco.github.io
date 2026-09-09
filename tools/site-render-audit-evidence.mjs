import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export function renderRelevantFile(filename) {
  const normalized = filename.replaceAll('\\', '/');
  const basename = path.posix.basename(normalized);
  if (/(?:^|\/)\.[^/]+(?:\/|$)/.test(normalized)) return false;
  if (/^(?:auth|oauth|service-role|keyfile)\.json$/i.test(basename)) return false;
  if (/^(?:tokens?|access[-_]token|refresh[-_]token|token[-_]secrets?)\.(?:json|txt|yaml|yml)$/i.test(basename)) return false;
  if (/^\.env(?:\.|$)|(?:^|[._-])(?:credentials?|secrets?|private-key|service-account|auth-state|storage-state)(?:[._-]|$)/i.test(basename)) return false;
  if (/(?:^|\/)(?:output|outputs|tmp|temp|cache|caches|\.cache|\.git|\.claude|\.codex|\.next|node_modules|tests?|__tests__|test-results|playwright-report|coverage|reports?|logs?|docs|review|backups?|\.qa-screens|standarization|Article)(?:\/|$)/i.test(normalized)) return false;
  if (normalized.startsWith('tools/')) return /^tools\/(?:audit-site-render|site-render-audit-(?:runner|probe|core|pool|evidence)|report-site-render)\.mjs$/.test(normalized)
    || normalized === 'tools/vendor/axe.min.js';
  return /\.(?:html?|css|[cm]?js|jsx|tsx?|json|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|pdf)$/i.test(normalized);
}

export async function fingerprintEvidence(root, options, files) {
  const candidates = files || execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: root, maxBuffer: 32 * 1024 * 1024 }).toString().split('\0').filter(Boolean)
    .filter(filename => !filename.startsWith('tools/.site-render-audit/') && !path.resolve(root, filename).startsWith(`${path.resolve(options.out || '/tmp/rz-site-audit')}${path.sep}`));
  const owned = ['audit-site-render', 'site-render-audit-runner', 'site-render-audit-probe', 'site-render-audit-core', 'site-render-audit-pool', 'site-render-audit-evidence', 'report-site-render']
    .map(name => `tools/${name}.mjs`);
  const filenames = [...new Set([...candidates, ...(files ? [] : [...owned, 'tools/vendor/axe.min.js'])])].filter(renderRelevantFile).sort();
  const inventory = files ? files.filter(filename => /\.html?$/i.test(filename) && renderRelevantFile(filename))
    : execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 32 * 1024 * 1024 }).toString().split('\0').filter(filename => /\.html?$/i.test(filename));
  const inventoryDigest = createHash('sha256').update(JSON.stringify([...inventory].sort())).digest('hex');
  const sources = createHash('sha256');
  const readErrors = [];
  for (const filename of filenames) {
    sources.update(`${filename}\0`);
    try {
      const contents = createHash('sha256');
      for await (const chunk of createReadStream(path.join(root, filename))) contents.update(chunk);
      sources.update(contents.digest('hex'));
    } catch (error) {
      readErrors.push({ path: filename, error: String(error) });
      sources.update(`UNREADABLE:${error.code || error.name}`);
    }
  }
  const sourcesDigest = sources.digest('hex');
  const evidenceOptions = { base: options.base, axe: Boolean(options.axe), timeout: options.timeout,
    themes: options.themes, widths: options.widths, concurrency: options.concurrency, captureAll: Boolean(options.captureAll),
    consent: 'declined', writes: 'blocked', node: process.version };
  const optionsDigest = createHash('sha256').update(JSON.stringify(evidenceOptions)).digest('hex');
  return { schemaVersion: 2, fingerprint: createHash('sha256').update(sourcesDigest).update(optionsDigest).update(inventoryDigest).digest('hex'),
    sourcesDigest, optionsDigest, inventoryDigest, options: evidenceOptions, sourceCount: filenames.length, readErrors };
}

export async function resumeRows(rows, previous, directory, evidence) {
  const priorRows = new Map((previous?.rows || []).map(row => [JSON.stringify([row.path, row.theme, row.width]), row]));
  return Promise.all(rows.map(async row => {
    const prior = priorRows.get(JSON.stringify([row.path, row.theme, row.width]));
    if (!prior?.result) return { ...row, history: prior?.history || [] };
    let result;
    try { result = JSON.parse(await fs.readFile(path.join(directory, prior.result), 'utf8')); }
    catch (error) { result = { environment: 'missing-artifact', error: String(error) }; }
    const environment = result.environment || (/ERR_CONNECTION_REFUSED|Connection closed|Target closed/.test(JSON.stringify(result.findings)) ? 'environment-unavailable' : null);
    const reusable = !environment && !previous?.sourceChangedDuringRun && !evidence.readErrors.length
      && prior.evidenceFingerprint === evidence.fingerprint && ['PASS', 'FAIL', 'UNVERIFIED'].includes(prior.status);
    if (reusable && row.status !== 'FILTERED') return prior;
    return { ...row, history: [...(prior.history || []), { result: prior.result, screenshots: prior.screenshots,
      status: environment ? 'UNVERIFIED' : prior.status, environment, evidenceFingerprint: prior.evidenceFingerprint,
      reason: environment ? 'Environment/artifact unavailable, not a product defect' : 'Evidence changed; retained but not reusable' }] };
  }));
}
