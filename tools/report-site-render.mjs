import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJson } from './site-render-audit-runner.mjs';
import { setTimeout as pause } from 'node:timers/promises';
import { summarize } from './site-render-audit-core.mjs';
import { createHash } from 'node:crypto';

export function escapeMarkup(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function validatedRow(directory, row) {
  if (!row.result && row.status !== 'PASS') return { ...row, findings: Array.isArray(row.findings) ? row.findings : [] };
  try {
    if (!row.result) throw new Error('PASS row has no result artifact reference');
    const result = JSON.parse(await fs.readFile(path.join(directory, row.result), 'utf8'));
    if (!result || typeof result !== 'object' || Array.isArray(result)
      || !Array.isArray(result.findings)) throw new Error('Invalid result artifact: findings array required');
    if (['path', 'theme', 'width'].some(field => result[field] !== row[field])) throw new Error('Result artifact identity mismatch');
    if (!['PASS', 'FAIL', 'UNVERIFIED'].includes(result.status)) throw new Error('Invalid result artifact status');
    if (result.findings.some(finding => !finding || !['FAIL', 'UNVERIFIED'].includes(finding.status))) throw new Error('Invalid result finding status');
    const artifactDirectory = path.dirname(path.resolve(directory, row.result));
    const artifactScreenshots = (result.screenshots || []).map(filename => path.relative(directory, path.resolve(artifactDirectory, filename)));
    const screenshots = [...new Set([...(row.screenshots || []), ...artifactScreenshots])];
    for (const filename of screenshots) {
      if (!(await fs.stat(path.join(directory, filename))).isFile()) throw new Error(`Screenshot is not a file: ${filename}`);
    }
    const failed = result.status === 'FAIL' || row.status === 'FAIL' || result.findings.some(finding => finding.status === 'FAIL');
    const unverified = result.status !== row.status || result.status === 'UNVERIFIED'
      || result.findings.some(finding => finding.status === 'UNVERIFIED') || result.blocked?.length || result.environment;
    const status = failed ? 'FAIL' : unverified ? 'UNVERIFIED' : 'PASS';
    const inconsistent = result.status !== row.status || status !== result.status;
    return { ...result, ...row, status, screenshots, findings: [...result.findings,
      ...(inconsistent ? [{ rule: 'inconsistent-result-status', status: 'UNVERIFIED', detail: { manifest: row.status, artifact: result.status, resolved: status } }] : [])] };
  } catch (error) {
    return { ...row, status: 'UNVERIFIED', reason: 'Result evidence unavailable',
      findings: [{ rule: 'missing-result-artifact', status: 'UNVERIFIED', detail: String(error) }] };
  }
}

export async function buildReport(directory) {
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'coverage.json'), 'utf8'));
  const superseded = await fs.readFile(path.join(directory, 'SUPERSEDED.md'), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  const details = await Promise.all(manifest.rows.map(row => validatedRow(directory, row)));
  const coverage = summarize(details);
  const selectedSummary = summarize(details.filter(row => row.status !== 'FILTERED'));
  const rules = {};
  for (const row of details) for (const finding of row.findings) {
    rules[finding.rule] = (rules[finding.rule] || 0) + 1;
  }
  const failures = details.filter(row => ['FAIL', 'UNVERIFIED'].includes(row.status));
  const summary = { generatedAt: new Date().toISOString(), finishedAt: manifest.finishedAt || null,
    coverage, selectedSummary, superseded, rules, failures, inventory: manifest.inventory };
  await writeJson(path.join(directory, 'failures.json'), summary);
  const rows = details.map(row => `<tr><td>${escapeMarkup(row.path)}</td><td>${escapeMarkup(row.labels?.join(', '))}</td>
    <td>${escapeMarkup(row.theme)}/${row.width}</td><td>${escapeMarkup(row.status)}</td>
    <td>${escapeMarkup(row.reason)} ${row.findings.map(finding => `<details><summary>${escapeMarkup(finding.rule)} ${escapeMarkup(finding.target)}</summary><pre>${escapeMarkup(JSON.stringify(finding.detail, null, 2))}</pre></details>`).join('')}</td>
    <td>${row.result ? `<a href="${escapeMarkup(row.result)}">JSON</a>` : ''} ${(row.screenshots || []).map(file => `<a href="${escapeMarkup(file)}">${escapeMarkup(file)}</a>`).join(' ')}</td></tr>`).join('\n');
  await fs.writeFile(path.join(directory, 'report.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>RZ site render audit</title>
    <style>body{font:16px/1.5 system-ui;margin:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:8px;text-align:left;vertical-align:top}pre{white-space:pre-wrap;overflow-wrap:anywhere}td{overflow-wrap:anywhere}a{display:block}</style>
    <h1>Tracked HTML render coverage</h1>${superseded ? `<h2>SUPERSEDED — do not use for product fixes</h2><pre>${escapeMarkup(superseded)}</pre>` : ''}<p>Generated ${escapeMarkup(summary.generatedAt)}. ${manifest.finishedAt && !coverage.counts.PENDING ? 'Run finished.' : 'INCOMPLETE; pending is not passing.'}</p>
    <pre>${escapeMarkup(JSON.stringify(coverage, null, 2))}</pre><p>Contrast: ${escapeMarkup(manifest.contrast)}. Every inventory/matrix row is included. This is a render sweep, not an authenticated journey audit.</p>
    <table><thead><tr><th>Page</th><th>Classification</th><th>Theme/width</th><th>Status</th><th>Findings/reason</th><th>Artifacts</th></tr></thead><tbody>${rows}</tbody></table></html>`);
  const cases = details.map(row => {
    const content = row.status === 'FAIL' ? `<failure message="Render defects">${escapeMarkup(JSON.stringify(row.findings))}</failure>`
      : row.status === 'PASS' ? '' : `<skipped message="${escapeMarkup(`${row.status}: ${row.reason || 'Not verified'}`)}"/>`;
    return `<testcase classname="${escapeMarkup(row.path)}" name="${escapeMarkup(row.theme)}-${row.width}">${content}</testcase>`;
  }).join('\n');
  await fs.writeFile(path.join(directory, 'junit.xml'), `<?xml version="1.0" encoding="UTF-8"?><testsuite name="site-render" tests="${details.length}" failures="${details.filter(row => row.status === 'FAIL').length}" skipped="${details.filter(row => !['PASS', 'FAIL'].includes(row.status)).length}">${cases}</testsuite>\n`);
  return { finishedAt: manifest.finishedAt || null, coverage, selectedSummary, rules, report: path.join(directory, 'report.html') };
}

async function reportCli() {
  const directory = path.resolve(process.argv[2] || '/tmp/rz-site-audit');
  const mergeIndex = process.argv.indexOf('--merge');
  if (mergeIndex >= 0) {
    const sources = process.argv.slice(mergeIndex + 1).map(source => path.resolve(source));
    if (sources.length < 2) throw new Error('--merge requires at least two report directories');
    await mergeReports(sources, directory);
  }
  const watch = process.argv.includes('--watch');
  do {
    const result = await buildReport(directory);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!watch || result.finishedAt) return;
    await pause(30000);
  } while (watch);
}

async function mergeProvenance(manifest, directory, expected) {
  const evidence = manifest.evidence;
  const reject = detail => { throw new Error(`Incompatible merge provenance (${directory}): ${detail}`); };
  if (evidence?.schemaVersion !== 2) reject('schema-2 evidence required; rerun legacy sources');
  for (const field of ['fingerprint', 'sourcesDigest', 'optionsDigest', 'inventoryDigest']) {
    if (typeof evidence[field] !== 'string' || !/^[a-f0-9]{64}$/.test(evidence[field])) reject(`invalid ${field}`);
    if (expected && evidence[field] !== expected[field]) reject(`${field} differs between sources`);
  }
  const fingerprint = createHash('sha256').update(evidence.sourcesDigest).update(evidence.optionsDigest)
    .update(evidence.inventoryDigest).digest('hex');
  if (fingerprint !== evidence.fingerprint || manifest.evidenceFingerprint !== fingerprint) reject('manifest fingerprint mismatch');
  if (manifest.sourceChangedDuringRun || !Array.isArray(evidence.readErrors) || evidence.readErrors.length) reject('source changed or unreadable');
  if (manifest.finalEvidence && manifest.finalEvidence.fingerprint !== fingerprint) reject('final evidence differs');
  for (const row of manifest.rows) {
    if (!row.result && ['PENDING', 'FILTERED'].includes(row.status)) continue;
    if (row.evidenceFingerprint !== fingerprint) reject(`row fingerprint mismatch: ${row.path}`);
    if (!row.result) continue;
    let artifact;
    try { artifact = JSON.parse(await fs.readFile(path.join(directory, row.result), 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) continue;
      reject(`cannot read artifact: ${String(error)}`);
    }
    if (artifact?.evidenceFingerprint !== fingerprint) reject(`artifact fingerprint mismatch: ${row.result}`);
  }
  return evidence;
}

export async function mergeReports(directories, output) {
  if (!directories.length) throw new Error('Merge provenance requires at least one source');
  const inventory = new Map();
  const rows = new Map();
  const sources = [];
  let evidence;
  for (const directory of directories) {
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'coverage.json'), 'utf8'));
    evidence = await mergeProvenance(manifest, directory, evidence);
    sources.push({ directory, startedAt: manifest.startedAt, finishedAt: manifest.finishedAt, evidenceFingerprint: evidence.fingerprint });
    for (const page of manifest.inventory) inventory.set(page.path, page);
    for (const row of manifest.rows) {
      const key = JSON.stringify([row.path, row.theme, row.width]);
      if (rows.has(key) && row.status === 'FILTERED') continue;
      const relative = filename => path.relative(output, path.join(directory, filename));
      rows.set(key, { ...row, sourceDirectory: directory, result: row.result ? relative(row.result) : undefined,
        screenshots: (row.screenshots || []).map(relative) });
    }
  }
  const combined = await Promise.all([...rows.values()].map(async row => {
    const validated = await validatedRow(output, row);
    return { ...row, status: validated.status, reason: validated.reason, findings: validated.findings };
  }));
  await fs.mkdir(output, { recursive: true });
  await writeJson(path.join(output, 'coverage.json'), { schemaVersion: 1, sources, evidence, evidenceFingerprint: evidence.fingerprint,
    inventory: [...inventory.values()], rows: combined,
    summary: summarize(combined), selectedSummary: summarize(combined.filter(row => row.status !== 'FILTERED')),
    finishedAt: sources.every(source => source.finishedAt) ? new Date().toISOString() : null,
    contrast: evidence.options?.axe ? 'REQUESTED' : 'NOT_REQUESTED' });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  reportCli().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
}
