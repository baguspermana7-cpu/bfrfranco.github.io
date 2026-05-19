// Unit tests for the pure, numeric-aware table-sort comparator.
// Run from the worktree root:
//   node --test Apps/finance-terminal/_table-sort.test.mjs
//
// The same logic is duplicated inline in index.html (the static page can't
// import a module without a build) — see _table-sort.mjs header for the
// linkage note. Keep both copies identical.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCell, cmpCells } from './_table-sort.mjs';

test('parseCell strips $ , % and whitespace then parses float', () => {
  assert.equal(parseCell('$1,234.5'), 1234.5);
  assert.equal(parseCell('-3.2%'), -3.2);
  assert.equal(parseCell('  $ 1,000 '), 1000);
  assert.equal(parseCell('+2.50%'), 2.5);
});

test('parseCell returns NaN for non-numeric text', () => {
  assert.ok(Number.isNaN(parseCell('Apple')));
  assert.ok(Number.isNaN(parseCell('')));
  assert.ok(Number.isNaN(parseCell('--')));
  assert.ok(Number.isNaN(parseCell(null)));
});

test('cmpCells is numeric-aware (not lexical) when both parse', () => {
  // Lexical would put '$10' before '$2'; numeric must not.
  assert.ok(cmpCells('$2', '$10', 'asc') < 0);
  assert.ok(cmpCells('$10', '$2', 'asc') > 0);
  assert.ok(cmpCells('-3.2%', '1.1%', 'asc') < 0);
  assert.equal(cmpCells('$5.00', '5', 'asc'), 0);
});

test('cmpCells falls back to case-insensitive locale compare for text', () => {
  assert.ok(cmpCells('Apple', 'banana', 'asc') < 0);
  assert.ok(cmpCells('banana', 'Apple', 'asc') > 0);
  assert.equal(cmpCells('apple', 'APPLE', 'asc'), 0);
});

test("cmpCells dir='desc' reverses the asc ordering", () => {
  assert.ok(cmpCells('$2', '$10', 'desc') > 0);
  assert.ok(cmpCells('Apple', 'banana', 'desc') > 0);
  assert.equal(cmpCells('$5', '5', 'desc'), 0);
});
