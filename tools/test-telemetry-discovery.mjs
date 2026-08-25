#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const slugs = Object.freeze([
  'epms-telemetry',
  'datahallai',
  'dc-conventional',
  'datahall',
  'cdu-mini-bms',
  'rz-cockpit-mockup',
]);
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const sitemap = read('sitemap.xml');
const llms = read('llms.txt');
const llmsFull = read('llms-full.txt');
assert.equal(llmsFull.split('\n').findIndex((line) => /[ \t]+$/.test(line)), -1,
  'llms-full.txt must not contain trailing whitespace');

const sitemapBuilder = read('tools/build-sitemap.py');
assert.match(sitemapBuilder, /["']prd["']\s*:\s*["']prd["']/,
  'sitemap builder must include the public PRD directory');

const llmsBuilder = read('tools/build-llms-txt.py');
assert.match(llmsBuilder, /prd_dir\s*=\s*os\.path\.join\(SITE_ROOT,\s*["']prd["']\)/,
  'llms builder must collect PRD pages');
assert.match(llmsBuilder, /Product Requirements/,
  'llms builder must publish a Product Requirements category');

const llmsFullBuilder = read('tools/build-llms-full.py');
assert.match(llmsFullBuilder, /DOCUMENTATION_DIRS\s*=\s*\([^)]+manual[^)]+prd/s,
  'full-content LLM builder must collect manual and PRD directories');

const search = JSON.parse(read('search-index.json'));
for (const slug of slugs) {
  for (const kind of ['prd', 'manual']) {
    const url = `${kind}/${slug}.html`;
    assert.equal(search.filter((entry) => entry.url === url).length, 1,
      `search-index.json must contain exactly one ${url} entry`);
    const absoluteUrl = `https://resistancezero.com/${url}`;
    assert.ok(sitemap.includes(absoluteUrl), `sitemap.xml must contain ${absoluteUrl}`);
    assert.ok(llms.includes(absoluteUrl), `llms.txt must contain ${absoluteUrl}`);
    assert.ok(llmsFull.includes(absoluteUrl), `llms-full.txt must contain ${absoluteUrl}`);
  }
}

const manualCount = readdirSync(resolve(ROOT, 'manual'))
  .filter((name) => name.endsWith('.html') && name !== 'index.html').length;
const manualHub = read('manual/index.html');
assert.match(manualHub, new RegExp(`Manuals\\s*<strong>${manualCount}</strong>`),
  'manual hub visible count must match its public HTML inventory');

console.log('telemetry discovery builders and 12 search entries — PASS');
