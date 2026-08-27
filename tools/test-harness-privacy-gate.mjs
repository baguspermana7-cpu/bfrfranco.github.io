import assert from 'node:assert/strict';
import test from 'node:test';

import { auditHarnessPrivacy, parseCliArgs } from './audit-harness-privacy.mjs';

function fixture(files) {
  return auditHarnessPrivacy({
    trackedFiles: Object.keys(files),
    readText: (relativePath) => files[relativePath],
  });
}

test('passes a repository containing only public-safe files', () => {
  const result = fixture({
    'README.md': '# Public project\n',
    'standarization/AGENT_HARNESS_STANDARD.md': '# Portable lifecycle rules\n',
  });

  assert.equal(result.ok, true, JSON.stringify(result.findings));
  assert.deepEqual(result.findings, []);
});

test('rejects tracked private harness state and runtime databases', () => {
  for (const forbidden of [
    '.agent-harness/state/project.json',
    'RZ_CODEX_CONTEXT.md',
    'runtime/orc.sqlite-wal',
  ]) {
    const result = fixture({ [forbidden]: 'private\n' });

    assert.equal(result.ok, false, forbidden);
    assert.match(result.findings.join('\n'), new RegExp(forbidden.replaceAll('.', '\\.')));
  }
});

test('rejects private paths and provider session ids from the public harness standard', () => {
  const result = fixture({
    'standarization/AGENT_HARNESS_STANDARD.md': [
      '# Harness',
      'private root: /home/example/.local/share/rzharness',
      'session: codex:11111111-2222-4333-8444-555555555555',
    ].join('\n'),
  });

  assert.equal(result.ok, false);
  assert.match(result.findings.join('\n'), /private absolute home path/i);
  assert.match(result.findings.join('\n'), /provider session identity/i);
});

test('supports externally supplied tracked paths for restricted runners', () => {
  assert.deepEqual(parseCliArgs(['--stdin', '--root', '/tmp/project']), {
    root: '/tmp/project',
    stdin: true,
  });
  assert.deepEqual(parseCliArgs([]), { root: process.cwd(), stdin: false });
});
