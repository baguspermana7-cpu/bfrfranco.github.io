import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const selectors = [
  '.mn-wrap .mn-worked li',
  '.mn-wrap .mn-group p.mn-sub',
  '.mn-wrap .mn-card > p',
  '.mn-wrap .mn-card > ul > li',
  '.mn-wrap .mn-card > ol > li',
];

test('manual explanatory text uses shared readable size and leading tokens', () => {
  assert.match(source, /\.mn-wrap\s*\{\s*--mn-reading-size:\s*1rem;\s*--mn-reading-leading:\s*1\.6;\s*\}/);
  const selector = selectors.join(',\n');
  const start = source.indexOf(selector + ' {');
  assert.notEqual(start, -1);
  const rule = source.slice(start, source.indexOf('}', start) + 1);
  assert.match(rule, /font-size:\s*var\(--mn-reading-size\);/);
  assert.match(rule, /line-height:\s*var\(--mn-reading-leading\);/);
  assert.doesNotMatch(rule, /!important|mn-hero|mn-formula|mn-table|mn-eyebrow|\bcode\b/);
});

test('diagnostic manual and PRD pages consume the shared stylesheet', () => {
  for (const file of ['manual/capex.html', 'manual/index.html', 'prd/dc-conventional.html', 'prd/index.html']) {
    const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.match(html, /href="\.\.\/styles\.min\.css\?[^"\s]+"/);
    assert.match(html, /class="mn-wrap"/);
  }
});
