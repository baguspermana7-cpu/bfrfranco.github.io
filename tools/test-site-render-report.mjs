import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildReport, mergeReports, escapeMarkup } from './report-site-render.mjs';
import { summarize } from './site-render-audit-core.mjs';
import { fingerprintEvidence } from './site-render-audit-evidence.mjs';

for (const fixture of ['path', 'theme', 'width', 'artifact-fail', 'finding-fail', 'finding-unverified', 'missing-shot', 'valid-shot', 'no-shot']) {
  test(`artifact identity and status: ${fixture}`, async context => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rz-report-identity-'));
    context.after(() => fs.rm(directory, { recursive: true, force: true }));
    const row = { path: 'index.html', theme: 'light', width: 390, status: 'PASS', result: 'result.json' };
    const artifact = { ...row, findings: [] };
    if (['path', 'theme', 'width'].includes(fixture)) artifact[fixture] = 'wrong';
    if (fixture === 'artifact-fail') artifact.status = 'FAIL';
    if (fixture.startsWith('finding-')) artifact.findings = [{ rule: 'fixture', status: fixture === 'finding-fail' ? 'FAIL' : 'UNVERIFIED' }];
    if (fixture.endsWith('-shot') && fixture !== 'no-shot') artifact.screenshots = ['shot.png'];
    if (fixture === 'valid-shot') await fs.writeFile(path.join(directory, 'shot.png'), 'fixture');
    await fs.writeFile(path.join(directory, 'result.json'), JSON.stringify(artifact));
    await fs.writeFile(path.join(directory, 'coverage.json'), JSON.stringify({ rows: [row], inventory: [], summary: summarize([row]) }));
    const result = await buildReport(directory);
    const expected = ['artifact-fail', 'finding-fail'].includes(fixture) ? 'FAIL'
      : ['valid-shot', 'no-shot'].includes(fixture) ? 'PASS' : 'UNVERIFIED';
    assert.equal(result.coverage.status, expected);
    const report = JSON.parse(await fs.readFile(path.join(directory, 'failures.json'), 'utf8'));
    assert.equal(report.coverage.status, expected);
  });
}

for (const fixture of ['missing-reference', 'missing-file', 'invalid-json', 'invalid-shape', 'valid']) {
  test(`report aggregates validated evidence: ${fixture}`, async context => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rz-report-regression-'));
    context.after(() => fs.rm(directory, { recursive: true, force: true }));
    const row = { path: 'index.html', theme: 'light', width: 390, status: 'PASS',
      ...(fixture === 'missing-reference' ? {} : { result: 'result.json' }) };
    const rows = [row, { path: 'hidden.html', status: 'FILTERED', theme: 'light', width: 390 }];
    const manifest = { rows, inventory: [], summary: summarize([row]), finishedAt: '2026-09-08' };
    const original = JSON.stringify(manifest);
    await fs.writeFile(path.join(directory, 'coverage.json'), original);
    if (fixture === 'valid') await fs.writeFile(path.join(directory, 'result.json'), JSON.stringify({ ...row, findings: [] }));
    if (fixture === 'invalid-json') await fs.writeFile(path.join(directory, 'result.json'), '{');
    if (fixture === 'invalid-shape') await fs.writeFile(path.join(directory, 'result.json'), '{}');
    const expected = summarize([{ ...row, status: fixture === 'valid' ? 'PASS' : 'UNVERIFIED' }, rows[1]]);
    const result = await buildReport(directory);
    const json = JSON.parse(await fs.readFile(path.join(directory, 'failures.json'), 'utf8'));
    const html = await fs.readFile(path.join(directory, 'report.html'), 'utf8');
    const junit = await fs.readFile(path.join(directory, 'junit.xml'), 'utf8');
    assert.deepEqual(result.coverage, expected);
    assert.deepEqual(json.coverage, expected);
    assert.deepEqual(result.selectedSummary, summarize([{ ...row, status: fixture === 'valid' ? 'PASS' : 'UNVERIFIED' }]));
    assert.deepEqual(json.selectedSummary, result.selectedSummary);
    assert.ok(html.includes(escapeMarkup(JSON.stringify(expected, null, 2))));
    assert.match(junit, new RegExp(`skipped="${fixture === 'valid' ? 1 : 2}"`));
    if (fixture !== 'valid') assert.equal(json.failures[0].findings[0].rule, 'missing-result-artifact');
    assert.equal(await fs.readFile(path.join(directory, 'coverage.json'), 'utf8'), original);
  });
}

test('merge aggregates also reject missing PASS evidence', async context => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rz-report-merge-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'source');
  const output = path.join(directory, 'merged');
  await fs.mkdir(source);
  const evidence = await fingerprintEvidence(directory, {}, []);
  const rows = [{ path: 'index.html', theme: 'light', width: 390, status: 'PASS', result: 'absent.json', evidenceFingerprint: evidence.fingerprint }];
  await fs.writeFile(path.join(source, 'coverage.json'), JSON.stringify({ rows, inventory: [], evidence, evidenceFingerprint: evidence.fingerprint }));
  await mergeReports([source], output);
  const merged = JSON.parse(await fs.readFile(path.join(output, 'coverage.json'), 'utf8'));
  assert.equal(merged.rows[0].status, 'UNVERIFIED');
  assert.equal(merged.summary.fullCoverage, false);
  assert.equal(merged.selectedSummary.status, 'UNVERIFIED');
});

for (const variant of ['compatible', 'legacy', 'missing', 'sources', 'options', 'inventory', 'fingerprint', 'row', 'artifact', 'changed', 'read-errors']) {
  test(`merge provenance: ${variant}`, async context => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rz-merge-provenance-'));
    context.after(() => fs.rm(directory, { recursive: true, force: true }));
    const evidence = await fingerprintEvidence(directory, {}, []);
    const sources = [path.join(directory, 'first'), path.join(directory, 'second')];
    for (const [index, source] of sources.entries()) {
      await fs.mkdir(source);
      const row = { path: 'index.html', theme: 'light', width: 390, status: 'PASS', result: 'result.json', evidenceFingerprint: evidence.fingerprint };
      const manifest = { rows: [row], inventory: [], evidence: structuredClone(evidence), evidenceFingerprint: evidence.fingerprint };
      const artifact = { ...row, findings: [], evidenceFingerprint: evidence.fingerprint };
      if (index === 1) {
        if (variant === 'legacy') manifest.evidence.schemaVersion = 1;
        if (variant === 'missing') delete manifest.evidence;
        if (['sources', 'options', 'inventory'].includes(variant)) manifest.evidence[`${variant}Digest`] = '0'.repeat(64);
        if (variant === 'fingerprint') manifest.evidenceFingerprint = '0'.repeat(64);
        if (variant === 'row') row.evidenceFingerprint = '0'.repeat(64);
        if (variant === 'artifact') artifact.evidenceFingerprint = '0'.repeat(64);
        if (variant === 'changed') manifest.sourceChangedDuringRun = true;
        if (variant === 'read-errors') manifest.evidence.readErrors = [{ path: 'missing.css' }];
      }
      await fs.writeFile(path.join(source, 'coverage.json'), JSON.stringify(manifest));
      await fs.writeFile(path.join(source, 'result.json'), JSON.stringify(artifact));
    }
    const output = path.join(directory, 'merged');
    if (variant === 'compatible') {
      await mergeReports(sources, output);
      const merged = JSON.parse(await fs.readFile(path.join(output, 'coverage.json'), 'utf8'));
      assert.deepEqual(merged.evidence, JSON.parse(JSON.stringify(evidence)));
      assert.equal(merged.evidenceFingerprint, evidence.fingerprint);
      assert.equal(merged.summary.status, 'PASS');
    } else {
      await fs.mkdir(output);
      await fs.writeFile(path.join(output, 'coverage.json'), 'unchanged');
      await assert.rejects(mergeReports(sources, output), /provenance/i);
      assert.equal(await fs.readFile(path.join(output, 'coverage.json'), 'utf8'), 'unchanged');
    }
  });
}
