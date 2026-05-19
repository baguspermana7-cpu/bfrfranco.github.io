// Pure, numeric-aware table-sort comparator — the testable core of the
// makeSortable() helper used by Apps/finance-terminal/index.html.
//
// LINKAGE NOTE: the static HTML page cannot import an ES module without a
// build step, so the SAME two functions are duplicated inline in
// index.html inside an IIFE marked `/* B-004: keep identical to
// _table-sort.mjs */`. If you change the logic here, change it there too
// (and vice versa) — the unit tests in _table-sort.test.mjs guard this copy.

// Strip currency/grouping/percent/space decoration and parse as a float.
// Returns NaN for anything that isn't a clean number (e.g. "Apple", "--").
export function parseCell(str) {
  if (str == null) return NaN;
  const s = String(str).replace(/[$,%\s]/g, '');
  if (s === '' || s === '-' || s === '+') return NaN;
  // Reject strings with leftover non-numeric chars so "1abc" -> NaN,
  // while still accepting leading +/- and a single decimal point.
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

// Compare two raw cell strings. Numeric when BOTH parse as finite numbers,
// otherwise a case-insensitive locale compare. `dir` is 'asc' | 'desc'.
export function cmpCells(a, b, dir) {
  const na = parseCell(a), nb = parseCell(b);
  let r;
  if (Number.isFinite(na) && Number.isFinite(nb)) {
    r = na - nb;
  } else {
    r = String(a == null ? '' : a).localeCompare(
      String(b == null ? '' : b), undefined, { sensitivity: 'accent' });
  }
  const out = dir === 'desc' ? -r : r;
  return out === 0 ? 0 : out; // normalize -0 → 0
}
