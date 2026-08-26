#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const REQUIRED_SCRIPTS = [
  '../js/rz-version.js',
  '../js/rz-mobile-nav.js',
  '../js/rz-cookie-consent.js',
  '../js/rz-explain.js',
  '../js/rz-documentation-ui.js',
];
const REQUIRED_STYLES = ['../css/rz-documentation-ui.css'];
const BASELINE_REV = '2348d9ab6ebf121332c48d7b02f1c6398c232039';
const INTENTIONAL_MANUAL_REPLACEMENTS = Object.freeze({
  datahallai: Object.freeze({
    '<li><b>NVIDIA GB200 NVL72</b> — Blackwell GPU rack-scale specification: 72 GPU + 36 Grace CPU per NVL72, direct liquid cooling, ~120–140 kW per NVL72 domain (adopted design value 132 kW).</li>':
      'governing hardware context for the locked 72-GPU / 36-Grace-CPU, direct-liquid-cooled GB200 baseline.',
  }),
});
const COCKPITS = Object.freeze([
  { file: 'EPMS_Telemetry.html', slug: 'epms-telemetry', buttonClass: 'btn' },
  { file: 'datahallAI.html', slug: 'datahallai', buttonClass: 'bbtn', existingManual: true },
  { file: 'dc-conventional.html', slug: 'dc-conventional', buttonClass: 'back-btn', existingManual: true },
  { file: 'datahall.html', slug: 'datahall', buttonClass: 'nav-btn', existingManual: true },
  { file: 'cdu-mini-bms.html', slug: 'cdu-mini-bms', buttonClass: 'nav-link' },
  { file: 'rz-cockpit-mockup.html', slug: 'rz-cockpit-mockup', buttonClass: 'sub' },
]);

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function baseline(relativePath) {
  return execFileSync('git', ['show', `${BASELINE_REV}:${relativePath}`], { cwd: ROOT, encoding: 'utf8' });
}

function protectedManualFragments(html) {
  const fragments = [];
  const patterns = [
    /<span[^>]+class=["'][^"']*mn-(?:eq|result|src)[^"']*["'][^>]*>[\s\S]*?<\/span>/gi,
    /<li><b>[\s\S]*?<\/li>/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) fragments.push(match[0].replace(/\s+/g, ' ').trim());
  }
  return fragments;
}

function assertPublicDoc(html, relativePath) {
  assert.doesNotMatch(html, /enforceTierFeatureAccess|id=["']rootGate["']/, `${relativePath} must remain public`);
  assert.match(html, /<nav class=["']navbar["']/, `${relativePath} must use the site navbar`);
  assert.match(html, /:root:not\(\[data-theme=["']dark["']\]\)/, `${relativePath} needs safe light fallback`);
  assert.match(html, /@media\s*\(max-width:\s*768px\)/, `${relativePath} needs the mobile checkpoint`);
  assert.match(html, /data-explain(?:-scan)?/, `${relativePath} needs RZExplain hooks`);
  for (const source of REQUIRED_SCRIPTS) {
    assert.ok(html.includes(source), `${relativePath} must load ${source}`);
  }
  for (const source of REQUIRED_STYLES) {
    assert.ok(html.includes(source), `${relativePath} must load ${source}`);
  }
  assert.match(
    html,
    /fonts\.googleapis\.com\/css2\?family=IBM\+Plex\+Sans/i,
    `${relativePath} must load the canonical IBM Plex Sans font`,
  );
  assert.doesNotMatch(
    html,
    /['"]Inter['"]|family=Inter(?:&|%|\b)/i,
    `${relativePath} must use the canonical IBM Plex typography without the Inter AI-slop fallback`,
  );
  assert.doesNotMatch(
    html,
    /backdrop-filter\s*:|--glass-blur\s*:/i,
    `${relativePath} must not introduce decorative glassmorphism`,
  );
  assert.doesNotMatch(
    html,
    /border-radius\s*:\s*999(?:px)?/i,
    `${relativePath} must not use full-round pill styling`,
  );
  assert.doesNotMatch(
    html,
    /border-left\s*:\s*(?:[2-9]|[1-9]\d+)px\s+solid/i,
    `${relativePath} must use hairline borders instead of thick accent stripes`,
  );
}

function assertMetaDescription(html, relativePath) {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  assert.ok(match, `${relativePath} needs a meta description`);
  assert.ok(match[1].length >= 120 && match[1].length <= 160,
    `${relativePath} description must be 120-160 characters, got ${match[1].length}`);
}

function countDocumentSections(html) {
  return [...html.matchAll(/<section\b[^>]*class=["']([^"']*)["'][^>]*>/gi)]
    .filter((match) => {
      const classes = match[1].split(/\s+/);
      return classes.includes('mn-section') && !classes.includes('mn-toc');
    }).length;
}

function assertPrd(slug) {
  const relativePath = `prd/${slug}.html`;
  assert.ok(existsSync(resolve(ROOT, relativePath)), `${relativePath} must exist`);
  const html = read(relativePath);
  assertPublicDoc(html, relativePath);
  assertMetaDescription(html, relativePath);
  assert.equal(countDocumentSections(html), 11,
    `${relativePath} must contain exactly 11 PRD sections`);
  assert.match(html, /FR-\d{2}/, `${relativePath} needs deterministic functional requirements`);
  assert.match(html, /AC-\d{2}/, `${relativePath} needs deterministic acceptance criteria`);
  assert.match(html, /<table[^>]*>[\s\S]*Unit[\s\S]*Source binding/i,
    `${relativePath} needs the telemetry-point table`);
  assert.match(html, /TechArticle/, `${relativePath} needs TechArticle JSON-LD`);
  assert.match(html, /BreadcrumbList/, `${relativePath} needs BreadcrumbList JSON-LD`);
}

function assertManual(slug) {
  const relativePath = `manual/${slug}.html`;
  assert.ok(existsSync(resolve(ROOT, relativePath)), `${relativePath} must exist`);
  const html = read(relativePath);
  assertPublicDoc(html, relativePath);
  assertMetaDescription(html, relativePath);
  assert.ok(countDocumentSections(html) >= 8,
    `${relativePath} needs at least eight structured manual sections`);
  for (const heading of ['engineering basis', 'calculation', 'worked example', 'standards', 'glossary']) {
    assert.match(html, new RegExp(heading, 'i'), `${relativePath} must cover ${heading}`);
  }
}

function assertCockpitButtons(cockpit) {
  const html = read(cockpit.file);
  for (const kind of ['prd', 'manual']) {
    const label = kind === 'prd' ? 'PRD' : 'Manual';
    const pattern = new RegExp(`<a[^>]+class=["'][^"']*${cockpit.buttonClass}[^"']*["'][^>]+href=["']${kind}/${cockpit.slug}\\.html["'][^>]*>${label}</a>`, 'gi');
    const matches = html.match(pattern) || [];
    assert.equal(
      matches.length,
      1,
      `${cockpit.file} must expose exactly one ${label} contract link`,
    );
  }
}

function assertExistingManualPreserved(cockpit) {
  if (!cockpit.existingManual) return;
  const relativePath = `manual/${cockpit.slug}.html`;
  const current = read(relativePath).replace(/\s+/g, ' ');
  const protectedFragments = protectedManualFragments(baseline(relativePath));
  const replacements = INTENTIONAL_MANUAL_REPLACEMENTS[cockpit.slug] || Object.freeze({});
  assert.ok(protectedFragments.length > 0, `${relativePath} baseline needs protected sourced fragments`);
  for (const fragment of protectedFragments) {
    const acceptedReplacement = replacements[fragment];
    assert.ok(
      current.includes(fragment) || (acceptedReplacement && current.includes(acceptedReplacement)),
      `${relativePath} removed or rewrote a sourced formula/result/reference without an explicit replacement contract`,
    );
  }
}

function assertHubs() {
  const prdHub = read('prd/index.html');
  const manualHub = read('manual/index.html');
  for (const cockpit of COCKPITS) {
    assert.ok(prdHub.includes(`${cockpit.slug}.html`), `PRD hub must link ${cockpit.slug}`);
    assert.ok(manualHub.includes(`${cockpit.slug}.html`), `manual hub must link ${cockpit.slug}`);
  }
  assert.doesNotMatch(
    `${prdHub}\n${manualHub}`,
    /background\s*:\s*(?:linear|radial)-gradient/i,
    'documentation hubs must use flat instrument surfaces, not generic decorative gradients',
  );
  assert.doesNotMatch(
    `${prdHub}\n${manualHub}`,
    /border-left\s*:\s*(?:[2-9]|[1-9]\d+)px\s+solid/i,
    'documentation hubs must use hairline borders instead of thick accent stripes',
  );
}

function assertReleaseCriticalAssets() {
  const worker = read('sw.js');
  const auth = read('auth.js');
  assert.ok(worker.includes("'/auth.js'"), 'legacy workers must keep auth.js network-first');
  assert.match(auth, /function exposePublicContractLinks\(\)/,
    'network-first auth must bootstrap public contract links when navigation is stale');
  for (const asset of [
    '/js/rz-mobile-nav.js',
    '/js/rz-cookie-consent.js',
    '/js/rz-documentation-ui.js',
    '/js/rz-telemetry-quality.js',
    '/css/rz-cockpit-instrument.css',
    '/css/rz-documentation-ui.css',
  ]) {
    assert.ok(worker.includes(`'${asset}'`), `${asset} must bypass stale cache after this release`);
  }
}

function assertManualFabLockIsolation() {
  const manualFab = read('js/rz-manual-fab.js');
  assert.doesNotMatch(
    manualFab,
    /createElement\(['"]nav['"]\)/,
    'manual FAB landmark must not match body.locked > nav selectors',
  );
  assert.match(
    manualFab,
    /setAttribute\(['"]role['"],\s*['"]navigation['"]\)/,
    'manual FAB must retain navigation landmark semantics without a nav element',
  );
}

for (const cockpit of COCKPITS) {
  assertPrd(cockpit.slug);
  assertManual(cockpit.slug);
  assertCockpitButtons(cockpit);
  assertExistingManualPreserved(cockpit);
}
assertHubs();
assertReleaseCriticalAssets();
assertManualFabLockIsolation();
console.log(`telemetry docs contract: ${COCKPITS.length} cockpits, 12 docs, 12 unique contract links — PASS`);
