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

/* The three discovery builders used to each carry their own copy of the public-directory
   list, and this gate pinned the source string in each one ("prd": "prd" in the sitemap
   builder, a prd_dir join in the llms builder, a DOCUMENTATION_DIRS tuple in the full
   builder). They now share one inventory module, so the fact lives in exactly one place and
   the assertion follows it there. Pinning the retired shape would fail a refactor that
   preserved every published URL, which is the opposite of what this gate is for.
   The behavioural assertions below are the real check and are unchanged: each documentation
   slug must appear in search-index.json, sitemap.xml, llms.txt AND llms-full.txt. */
const inventory = read('tools/crawler_inventory.py');
for (const dir of ['manual', 'prd']) {
  assert.match(inventory, new RegExp(`PUBLIC_DIRS\\s*=\\s*frozenset\\(\\{[^}]*["']${dir}["']`, 's'),
    `crawler inventory must publish the ${dir} directory`);
}
for (const builder of ['tools/build-sitemap.py', 'tools/build-llms-txt.py', 'tools/build-llms-full.py']) {
  assert.match(read(builder), /from crawler_(?:inventory|llms) import/,
    `${builder} must take its publication inventory from the shared module`);
}
assert.match(read('tools/build-llms-txt.py'), /Product Requirements/,
  'llms builder must publish a Product Requirements category');

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
