import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchStooqQuotes } from '../src/sources/stooq.js';

/**
 * Single-row quote CSV WITH the Prev (prior-close) field — the PRIMARY path.
 * Endpoint: https://stooq.com/q/l/?s=<sym>.us&f=sd2t2ohlcvp&h&e=csv
 * Columns:  Symbol,Date,Time,Open,High,Low,Close,Volume,Prev
 */
function stooqQuoteWithPrev(sym, close, prev) {
  return 'Symbol,Date,Time,Open,High,Low,Close,Volume,Prev\n' +
    `${sym.toUpperCase()}.US,2026-05-18,22:00:24,${close - 1},${close + 2},${close - 2},${close},47843865,${prev}\n`;
}

/** Single-row quote WITHOUT Prev — last-resort price-only path. */
function stooqQuoteNoPrev(sym, close) {
  return 'Symbol,Date,Time,Open,High,Low,Close,Volume\n' +
    `${sym.toUpperCase()}.US,2026-05-18,22:00:24,${close - 1},${close + 2},${close - 2},${close},47843865\n`;
}

/** Daily-history CSV (oldest → newest). Columns: Date,Open,High,Low,Close,Volume */
function stooqDailyCsv(closes) {
  const head = 'Date,Open,High,Low,Close,Volume';
  const rows = closes.map((c, i) => {
    const day = String(10 + i).padStart(2, '0');
    return `2026-05-${day},${c - 1},${c + 2},${c - 2},${c},1234567${i}`;
  });
  return [head, ...rows].join('\n') + '\n';
}

/** Stooq's apikey-gate body returned (HTTP 200) for the history endpoint. */
const STOOQ_APIKEY_GATE =
  'Get your apikey:\n\n1. Open https://stooq.com/q/d/?s=spy.us&get_apikey\n' +
  '2. Enter the captcha code.\n3. Copy the CSV download link.\n';

const QUOTE_WITH_PREV = 'f=sd2t2ohlcvp';
const QUOTE_NO_PREV = 'f=sd2t2ohlcv&h'; // note: no trailing 'p'
const HIST = '/q/d/l/';

// Test S1: PRIMARY Prev-field quote → real non-zero chgPct
test('Stooq S1: Prev-field quote yields real non-zero chgPct (primary path)', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('spy.us') && u.includes(QUOTE_WITH_PREV)) {
      // close 520.00, prev 515.00 → chg +5, chgPct +0.97087...
      return { ok: true, text: async () => stooqQuoteWithPrev('spy', 520.0, 515.0) };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  try {
    const out = await fetchStooqQuotes(['SPY']);
    assert.equal(out.length, 1, 'one symbol resolved');
    const spy = out[0];
    assert.equal(spy.sym, 'SPY');
    assert.equal(spy.price, 520.0, 'price = Close');
    assert.equal(spy.prevClose, 515.0, 'prevClose = Prev column');
    assert.equal(spy.chg, 5.0, 'chg = price - prevClose');
    assert.ok(Math.abs(spy.chgPct - 0.9708737864077669) < 1e-9, 'chgPct from Prev, not 0');
    assert.notEqual(spy.chgPct, 0, 'chgPct must NOT be zero');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test S2: negative move via Prev field
test('Stooq S2: negative day-over-day move yields negative chgPct', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('qqq.us') && u.includes(QUOTE_WITH_PREV)) {
      return { ok: true, text: async () => stooqQuoteWithPrev('qqq', 438.0, 441.75) };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  try {
    const out = await fetchStooqQuotes(['QQQ']);
    const qqq = out[0];
    assert.equal(qqq.price, 438.0);
    assert.equal(qqq.prevClose, 441.75);
    assert.ok(qqq.chg < 0, 'chg negative');
    assert.ok(qqq.chgPct < 0, 'chgPct negative');
    assert.ok(Math.abs(qqq.chgPct - ((438.0 - 441.75) / 441.75 * 100)) < 1e-9);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test S3: Prev field absent (N/D) → fall through to daily history for real chg%
test('Stooq S3: Prev N/D → daily-history fallback supplies real chgPct', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes(QUOTE_WITH_PREV)) {
      // Quote row present but Prev is N/D
      return {
        ok: true,
        text: async () =>
          'Symbol,Date,Time,Open,High,Low,Close,Volume,Prev\n' +
          'XYZ.US,2026-05-18,22:00:24,99,104,98,103.50,500,N/D\n',
      };
    }
    if (u.includes(HIST)) {
      // ... 101.00 (prev), 103.50 (last)
      return { ok: true, text: async () => stooqDailyCsv([100.0, 101.0, 103.5]) };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  try {
    const out = await fetchStooqQuotes(['XYZ']);
    const q = out[0];
    assert.equal(q.price, 103.5);
    assert.equal(q.prevClose, 101.0, 'prevClose from history second-to-last close');
    assert.ok(q.chgPct > 0);
    assert.notEqual(q.chgPct, 0, 'history fallback gives real chgPct');
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test S4: Prev quote fails AND history apikey-gated → price-only last resort (chg 0)
test('Stooq S4: Prev fails + history apikey-gated → price-only last resort (chg 0)', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes(QUOTE_WITH_PREV)) return { ok: false, status: 403 };
    if (u.includes(HIST)) {
      // Stooq returns HTTP 200 with a non-CSV apikey-instructions body
      return { ok: true, text: async () => STOOQ_APIKEY_GATE };
    }
    if (u.includes(QUOTE_NO_PREV)) {
      return { ok: true, text: async () => stooqQuoteNoPrev('spy', 519.42) };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  try {
    const out = await fetchStooqQuotes(['SPY']);
    assert.equal(out.length, 1);
    assert.equal(out[0].price, 519.42, 'price from last-resort single row');
    assert.equal(out[0].chg, 0, 'chg 0 on price-only path');
    assert.equal(out[0].chgPct, 0);
    assert.equal(out[0].prevClose, 0);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test S5: daily-history path resilient to N/D rows / blank lines (when it is reached)
test('Stooq S5: daily-history resilient to N/D rows, blank lines, header noise', async () => {
  const origFetch = globalThis.fetch;
  const csv =
    'Date,Open,High,Low,Close,Volume\n' +
    '2026-05-15,N/D,N/D,N/D,N/D,N/D\n' +
    '2026-05-16,100,102,99,101.00,500\n' +
    '\n' +
    '2026-05-17,101,104,100,103.50,600\n';
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes(QUOTE_WITH_PREV)) return { ok: false, status: 500 }; // force history path
    if (u.includes(HIST)) return { ok: true, text: async () => csv };
    if (u.includes(QUOTE_NO_PREV)) throw new Error('should not reach price-only');
    throw new Error('unexpected fetch: ' + u);
  };

  try {
    const out = await fetchStooqQuotes(['XYZ']);
    assert.equal(out.length, 1);
    assert.equal(out[0].price, 103.5, 'last valid close');
    assert.equal(out[0].prevClose, 101.0, 'prev valid close (N/D row skipped)');
    assert.ok(out[0].chgPct > 0);
    assert.notEqual(out[0].chgPct, 0);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// Test S6: genuine new-listing single history row → chg/chgPct 0 (true edge case)
test('Stooq S6: single history row (new listing) → chg/chgPct 0', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes(QUOTE_WITH_PREV)) return { ok: false, status: 500 };
    if (u.includes(HIST)) return { ok: true, text: async () => stooqDailyCsv([123.45]) };
    if (u.includes(QUOTE_NO_PREV)) throw new Error('should not reach price-only');
    throw new Error('unexpected fetch: ' + u);
  };

  try {
    const out = await fetchStooqQuotes(['NEW']);
    const q = out[0];
    assert.equal(q.price, 123.45);
    assert.equal(q.chg, 0);
    assert.equal(q.chgPct, 0);
    assert.equal(q.prevClose, 0);
  } finally {
    globalThis.fetch = origFetch;
  }
});
