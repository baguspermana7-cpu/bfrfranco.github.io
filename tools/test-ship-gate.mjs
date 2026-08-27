import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = path.join(ROOT, 'tools', 'ship-gate.sh');
const TEMP_PREFIX = path.join(tmpdir(), 'rz-ship-gate-test-');
const tempDirs = [];
const QUICK_COMMANDS = [
  'python3 tools/audit-script-tags.py --strict',
  'python3 tools/audit-js-syntax.py --strict',
  'python3 tools/audit-version-stamp.py --strict',
  'python3 tools/audit-mobile-responsive.py --strict',
  'node tools/audit-article-charts.mjs --strict',
  'node tools/audit-page-gates.mjs --strict',
  'node tools/audit-hero-images.mjs --strict',
  'node tools/test-datahall-calc.mjs',
  'node tools/test-conv-calc.mjs',
  'node tools/test-cdu-calc.mjs',
  'node tools/test-fire-calc.mjs',
];
const FULL_COMMANDS = [
  ...QUICK_COMMANDS,
  'node tools/audit-responsive-layout.mjs --strict',
  'node tools/audit-dark-coverage.mjs --strict',
  'node tools/audit-a11y.mjs --strict',
  'node tools/audit-interactions.mjs --strict',
];

const FAKE_EXECUTABLE = `#!/usr/bin/env bash
set -u
name="\${0##*/}"
printf '%s %s\n' "$name" "$*" >> "$RZ_FAKE_CALL_LOG"
if [[ -n "\${RZ_FAKE_FAIL_MATCH:-}" && "$*" == *"$RZ_FAKE_FAIL_MATCH"* ]]; then
  printf '%s\n' "\${RZ_FAKE_FAIL_MESSAGE:-forced product failure}" >&2
  exit "\${RZ_FAKE_FAIL_CODE:-1}"
fi
exit 0
`;

function makeHarness() {
  const root = mkdtempSync(TEMP_PREFIX);
  const bin = path.join(root, 'bin');
  const calls = path.join(root, 'calls.log');
  tempDirs.push(root);
  mkdirSync(bin);
  writeFileSync(calls, '');
  for (const name of ['python3', 'node', 'git']) {
    const target = path.join(bin, name);
    writeFileSync(target, FAKE_EXECUTABLE);
    chmodSync(target, 0o755);
  }
  return { bin, calls, root };
}

function runGate(args = [], overrides = {}) {
  const harness = makeHarness();
  const result = spawnSync('bash', [RUNNER, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 15_000,
    env: {
      ...process.env,
      PATH: `${harness.bin}:${process.env.PATH}`,
      RZ_FAKE_CALL_LOG: harness.calls,
      TMPDIR: harness.root,
      ...overrides,
    },
  });
  const calls = readFileSync(harness.calls, 'utf8').trim().split('\n').filter(Boolean);
  return { ...result, calls, output: `${result.stdout}${result.stderr}` };
}

function commandCalls(result) {
  return result.calls.filter((line) => /^(node|python3) /.test(line));
}

test.after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

test('quick mode runs every fast gate and excludes Chromium render gates', () => {
  const result = runGate(['--quick']);

  assert.equal(result.status, 0, result.output);
  assert.deepEqual(commandCalls(result), QUICK_COMMANDS, result.output);
  assert.match(result.output, /12 passed, 0 failed, 0 blocked/);
});

test('default mode runs the complete gate set', () => {
  const result = runGate();

  assert.equal(result.status, 0, result.output);
  assert.deepEqual(commandCalls(result), FULL_COMMANDS, result.output);
  assert.match(result.output, /16 passed, 0 failed, 0 blocked/);
});

test('a product failure exits 1, prints its log, and continues the suite', () => {
  const result = runGate(['--quick'], {
    RZ_FAKE_FAIL_MATCH: 'audit-js-syntax.py',
    RZ_FAKE_FAIL_MESSAGE: 'synthetic syntax regression',
  });

  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /\[FAIL\].*audit-js-syntax/);
  assert.match(result.output, /synthetic syntax regression/);
  assert.match(result.output, /11 passed, 1 failed, 0 blocked/);
  assert.match(result.calls.join('\n'), /test-fire-calc\.mjs/);
});

test('a Chromium permission failure exits 2 and is labelled environment-blocked', () => {
  const result = runGate(['--full'], {
    RZ_FAKE_FAIL_MATCH: 'audit-responsive-layout.mjs',
    RZ_FAKE_FAIL_MESSAGE:
      'Failed to launch the browser process: setsockopt: Operation not permitted',
  });

  assert.equal(result.status, 2, result.output);
  assert.match(result.output, /\[BLOCKED\].*audit-responsive-layout/);
  assert.match(result.output, /execution environment/i);
  assert.match(result.output, /15 passed, 0 failed, 1 blocked/);
});

test('invalid options fail with usage exit code 64 before running a gate', () => {
  const result = runGate(['--unknown']);

  assert.equal(result.status, 64, result.output);
  assert.match(result.output, /Usage:/);
  assert.equal(commandCalls(result).length, 0, result.output);
});
