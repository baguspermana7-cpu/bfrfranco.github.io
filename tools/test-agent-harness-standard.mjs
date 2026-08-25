#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  try {
    return readFileSync(join(ROOT, relativePath), 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`cannot read ${relativePath}: ${reason}`);
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const versionSource = read('js/rz-version.js');
const versionMatch = versionSource.match(/RZ_VERSION = '([^']+)'/);
const dateMatch = versionSource.match(/RZ_VERSION_DATE = '(\d{4}-\d{2}-\d{2})'/);
assert.ok(versionMatch, 'site version must be declared');
assert.ok(dateMatch, 'site version date must be declared');

const version = versionMatch[1];
const date = dateMatch[1];
const standard = read('standarization/AGENT_HARNESS_STANDARD.md');
const changelog = read('CHANGELOG.md');
const changelogHtml = read('changelog.html');
const serviceWorker = read('sw.js');

for (const heading of [
  '## 2. Mandatory invariants',
  '## 3. Lifecycle and checkpoint contract',
  '## 5. Approval and permission policy',
  '## 8. Machine-checkable gates',
  '## 10. Required change and lesson ledger',
]) {
  assert.ok(standard.includes(heading), `standard must contain ${heading}`);
}

assert.ok(
  standard.includes(`Last updated: ${date}`),
  'standard date must match the release date',
);
assert.match(
  standard,
  /python3 -m unittest discover -s tests -q[\s\S]*node tools\/manual_harness_test\.mjs[\s\S]*task verify/,
  'standard must name the real private and public gates',
);

const privatePatterns = [
  /\/home\//,
  /\/Users\//,
  /[A-Za-z]:[\\/]Users[\\/]/i,
  /~\/\.(?:claude|codex)\//,
  /(?:^|[\\/])\.(?:claude|codex|credentials)(?:[\\/]|$)/m,
  /(?:^|[\\/])(?:session|runs?|state)\.db(?:$|\s)/m,
  /provider:(?!<opaque-id>)[A-Za-z0-9][A-Za-z0-9._:-]{5,}/,
  /\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|PASSWORD|SECRET)[A-Z0-9_]*\s*[:=]\s*["']?[^\s"'`]{8,}/i,
  /\b(?:sk|ghp)_[A-Za-z0-9_-]{12,}\b/,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
];
for (const pattern of privatePatterns) {
  assert.doesNotMatch(standard, pattern, `public standard violates ${pattern}`);
}

const escapedVersion = escapeRegex(version);
assert.match(
  changelog,
  new RegExp(`^## v${escapedVersion} — ${date}`, 'm'),
  'changelog must contain the current release',
);
assert.ok(
  changelogHtml.includes(`id="v${version}" data-version-tier=`)
    && changelogHtml.includes(`data-version="v${version}"`),
  'generated changelog must expose a real current-release fragment target',
);
assert.ok(
  changelogHtml.includes(`changelog.html#v${version}`),
  'generated JSON-LD must reference the current-release fragment',
);
const articleIds = [...changelogHtml.matchAll(/<article[^>]+id="([^"]+)"/g)]
  .map((match) => match[1]);
assert.equal(
  new Set(articleIds).size,
  articleIds.length,
  'generated changelog article IDs must be unique',
);
const schemaAnchors = [...changelogHtml.matchAll(/changelog\.html#(v\d+\.\d+\.\d+(?:-\d+)?)/g)]
  .map((match) => match[1]);
for (const anchor of schemaAnchors) {
  assert.ok(articleIds.includes(anchor), `schema anchor ${anchor} must exist`);
}
assert.ok(
  serviceWorker.includes(`rz-cache-v${version}`),
  'service-worker cache must match the site version',
);

const generated = spawnSync(
  'python3',
  ['tools/build-changelog-html.py', '--check'],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
);
assert.equal(generated.status, 0, 'changelog generated artifact must match its source');
assert.ok(
  generated.stdout.includes('[OK] Generated changelog matches CHANGELOG.md'),
  'changelog generator must perform byte-for-byte check mode',
);

console.log(`agent harness standard + v${version} release parity — PASS`);
