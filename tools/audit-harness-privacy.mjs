#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PUBLIC_STANDARD = 'standarization/AGENT_HARNESS_STANDARD.md';
const PRIVATE_PATH_RULES = Object.freeze([
  { pattern: /(^|\/)\.agent-harness(\/|$)/, label: 'private harness state' },
  { pattern: /(^|\/)RZ_CODEX_CONTEXT\.md$/, label: 'private context bridge' },
  { pattern: /(^|\/)orc\.sqlite(?:-(?:wal|shm))?$/, label: 'runtime database' },
]);
const PRIVATE_CONTENT_RULES = Object.freeze([
  { pattern: /\/home\/[^/\s]+(?:\/[^\s`"']*)?/, label: 'private absolute home path' },
  { pattern: /\b(?:claude|codex|ollama):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, label: 'provider session identity' },
  { pattern: /\.(?:claude\/projects|codex\/sessions)\//, label: 'private transcript location' },
]);

export function auditHarnessPrivacy({ trackedFiles, readText }) {
  const files = [...trackedFiles].map(normalizePath).sort();
  const findings = [];
  for (const path of files) {
    for (const rule of PRIVATE_PATH_RULES) {
      if (rule.pattern.test(path)) findings.push(`${path}: ${rule.label} must not be tracked`);
    }
    if (path === PUBLIC_STANDARD) auditPublicStandard(path, readText, findings);
  }
  return Object.freeze({ ok: findings.length === 0, findings: Object.freeze(findings) });
}

function auditPublicStandard(path, readText, findings) {
  const content = String(readText(path) ?? '');
  for (const rule of PRIVATE_CONTENT_RULES) {
    if (rule.pattern.test(content)) findings.push(`${path}: ${rule.label} is not public-safe`);
  }
}

function normalizePath(path) {
  return String(path).replaceAll('\\', '/').replace(/^\.\//, '');
}

export function parseCliArgs(argv) {
  let root = process.cwd();
  let stdin = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--stdin' && !stdin) {
      stdin = true;
      continue;
    }
    if (argument === '--root' && argv[index + 1]) {
      root = resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    throw new Error('Usage: node tools/audit-harness-privacy.mjs [--root PATH] [--stdin]');
  }
  return { root, stdin };
}

function runCli(argv) {
  let root;
  try {
    const options = parseCliArgs(argv);
    root = options.root;
    const raw = options.stdin
      ? readFileSync(0, 'utf8')
      : execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' });
    const trackedFiles = raw.split('\0').filter(Boolean);
    const result = auditHarnessPrivacy({
      trackedFiles,
      readText: (relativePath) => readTrackedText(root, relativePath),
    });
    if (!result.ok) {
      process.stderr.write(`Harness privacy audit FAIL (${result.findings.length})\n`);
      process.stderr.write(`${result.findings.join('\n')}\n`);
      return 1;
    }
    process.stdout.write(`PASS harness privacy (${trackedFiles.length} tracked files checked)\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`Harness privacy audit ERROR: ${error.message}\n`);
    return 2;
  }
}

function readTrackedText(root, relativePath) {
  const path = resolve(root, relativePath);
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink()) throw new Error(`${relativePath} must not be a symlink`);
  return readFileSync(path, 'utf8');
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) process.exitCode = runCli(process.argv.slice(2));
