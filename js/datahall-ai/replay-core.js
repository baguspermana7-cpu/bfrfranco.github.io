/* ============================================================================
 * replay-core.js — PRD-P05 stage 1: replay a recorded trend file (CSV / JSON)
 * ----------------------------------------------------------------------------
 * DOM-free core used by the parse Worker, the replay UI and the Node gate
 * (tools/test-datahall-ai-replay.mjs). The file is untrusted: cells become
 * numbers or are dropped, nothing is rendered or evaluated, nothing leaves
 * the browser.
 *
 *   check(file)              size (≤ 20 MB) and extension (.csv / .json)
 *   parse(text, opts)        → { ok, format, columns, timeColumn, zoned, start, end,
 *                                series: { column: { times, values } } }
 *                            | { ok:false, line, message } | { ok:false, code:'NO_TIME', candidates }
 *   fileTime(tick, clock)    start + (tick − startTick) × speed × 4 s
 *   valueAt(serie, t)        last sample ≤ t (sample-and-hold), null before the first
 *   autoMatch(columns, pts)  normalised-name match → { mapping, unmatched }
 *   makeProvider(opts)       the function handed to RZDatahallAISimTelemetry.setProvider
 *
 * ES5, zero-build, window.RZDatahallAIReplay + module.exports.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var MAX_BYTES = 20 * 1024 * 1024;
  var TICK_MS = 4000;
  var TIME_NAMES = ['t', 'time', 'timestamp', 'datetime', 'date time', 'date', 'ts'];

  function finite(x) { return typeof x === 'number' && isFinite(x); }

  function check(file) {
    var f = file || {}, name = String(f.name || '');
    if (!/\.(csv|json)$/i.test(name)) { return { ok: false, message: 'Only .csv or .json files can be replayed.' }; }
    if (!(f.size >= 0) || f.size > MAX_BYTES) { return { ok: false, message: 'File is larger than the 20 MB replay limit.' }; }
    return { ok: true };
  }

  function normalise(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/^ +| +$/g, '');
  }

  /* number cell: '.' decimals always; ',' decimals only when the delimiter is ';' */
  function toNumber(cell, decimalComma) {
    var s = String(cell).replace(/^\s+|\s+$/g, '');
    if (s === '') { return null; }
    if (decimalComma && /^[+-]?\d+,\d+$/.test(s)) { s = s.replace(',', '.'); }
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) { return NaN; }
    return Number(s);
  }

  /* timestamp: epoch seconds (< 1e11) or ms, or ISO 8601. zoned = carries Z or ±hh:mm */
  function toTime(cell) {
    if (typeof cell === 'number') { return finite(cell) ? { ms: cell < 1e11 ? cell * 1000 : cell, zoned: true } : null; }
    var s = String(cell == null ? '' : cell).replace(/^\s+|\s+$/g, '');
    if (/^\d+(\.\d+)?$/.test(s)) { var n = Number(s); return { ms: n < 1e11 ? n * 1000 : n, zoned: true }; }
    if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/.test(s)) { return null; }
    var zoned = /(Z|[+-]\d{2}:?\d{2})$/.test(s);
    var iso = s.replace(' ', 'T');
    if (!zoned && iso.length === 10) { iso += 'T00:00:00'; }   /* a bare date is local midnight, not UTC */
    var ms = Date.parse(iso);
    return finite(ms) ? { ms: ms, zoned: zoned } : null;
  }

  /* RFC 4180 rows; returns { rows, lines } or { error, line } */
  function splitCsv(text, delim) {
    var rows = [], lines = [], row = [], cell = '', i = 0, q = false, line = 1, rowLine = 1, c, n = text.length;
    while (i < n) {
      c = text.charAt(i);
      if (q) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { cell += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        if (c === '\n') { line++; }
        cell += c; i++; continue;
      }
      if (c === '"' && cell === '') { q = true; i++; continue; }
      if (c === delim) { row.push(cell); cell = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') {
        row.push(cell); cell = '';
        if (row.length > 1 || row[0] !== '') { rows.push(row); lines.push(rowLine); }
        row = []; line++; rowLine = line; i++; continue;
      }
      cell += c; i++;
    }
    if (q) { return { error: 'unterminated quoted field', line: rowLine }; }
    row.push(cell);
    if (row.length > 1 || row[0] !== '') { rows.push(row); lines.push(rowLine); }
    return { rows: rows, lines: lines };
  }

  function detectDelimiter(text) {
    var head = text.slice(0, text.indexOf('\n') < 0 ? text.length : text.indexOf('\n')).replace(/"[^"]*"/g, '');
    return (head.split(';').length > head.split(',').length) ? ';' : ',';
  }

  function pickTimeColumn(header, opts) {
    if (opts && opts.timeColumn != null) { return header.indexOf(String(opts.timeColumn)); }
    for (var i = 0; i < header.length; i++) { if (TIME_NAMES.indexOf(normalise(header[i])) >= 0) { return i; } }
    return -1;
  }

  /* collect (time, column, value) triples into sorted per-column series; duplicate time keeps the last */
  function build(triples, columns) {
    var by = {}, out = {}, start = Infinity, end = -Infinity;
    triples.forEach(function (tr, k) {
      (by[tr[1]] = by[tr[1]] || []).push([tr[0], tr[2], k]);
    });
    Object.keys(by).forEach(function (col) {
      var arr = by[col].sort(function (a, b) { return a[0] - b[0] || a[2] - b[2]; });
      var times = [], values = [];
      arr.forEach(function (r) {
        if (times.length && times[times.length - 1] === r[0]) { values[values.length - 1] = r[1]; return; }
        times.push(r[0]); values.push(r[1]);
      });
      out[col] = { times: Float64Array.from(times), values: Float64Array.from(values) };
      start = Math.min(start, times[0]); end = Math.max(end, times[times.length - 1]);
    });
    return { series: out, columns: columns, start: finite(start) ? start : null, end: finite(end) ? end : null };
  }

  function parseCsv(text, opts) {
    var delim = detectDelimiter(text), dc = delim === ';';
    var sp = splitCsv(text, delim);
    if (sp.error) { return { ok: false, line: sp.line, message: 'Cannot read line ' + sp.line + ': ' + sp.error + '.' }; }
    if (sp.rows.length < 2) { return { ok: false, line: 1, message: 'Cannot read line 1: the file needs a header and at least one row.' }; }
    var header = sp.rows[0].map(function (h) { return String(h).replace(/^\s+|\s+$/g, ''); });
    var ti = pickTimeColumn(header, opts);
    if (ti < 0) { return { ok: false, code: 'NO_TIME', candidates: header.slice(), message: 'No timestamp column found — pick one.' }; }
    var columns = header.filter(function (h, i) { return i !== ti; });
    var triples = [], zoned = null, r, j, t, v;
    for (r = 1; r < sp.rows.length; r++) {
      var row = sp.rows[r], ln = sp.lines[r];
      t = toTime(row[ti]);
      if (!t) { return { ok: false, line: ln, message: 'Cannot read line ' + ln + ': "' + String(row[ti]).slice(0, 40) + '" is not a timestamp.' }; }
      zoned = zoned === null ? t.zoned : (zoned && t.zoned);
      for (j = 0; j < header.length; j++) {
        if (j === ti || row[j] == null) { continue; }
        v = toNumber(row[j], dc);
        if (v === null) { continue; }
        if (!finite(v)) { return { ok: false, line: ln, message: 'Cannot read line ' + ln + ': "' + String(row[j]).slice(0, 40) + '" in ' + header[j] + ' is not a number.' }; }
        triples.push([t.ms, header[j], v]);
      }
    }
    var b = build(triples, columns);
    return { ok: true, format: 'wide', delimiter: delim, timeColumn: header[ti], columns: columns, zoned: !!zoned, series: b.series, start: b.start, end: b.end, header: header.join(delim) };
  }

  function jsonErrorLine(text, err) {
    var m = /position (\d+)/.exec(String(err && err.message)), pos = m ? Number(m[1]) : text.length;
    return text.slice(0, pos).split('\n').length;
  }

  function parseJson(text, opts) {
    var data;
    try { data = JSON.parse(text); } catch (e) {
      var ln = jsonErrorLine(text, e);
      return { ok: false, line: ln, message: 'Cannot read line ' + ln + ': invalid JSON.' };
    }
    if (!Array.isArray(data) || !data.length || typeof data[0] !== 'object' || data[0] === null) {
      return { ok: false, line: 1, message: 'Cannot read line 1: expected an array of records.' };
    }
    var keys = Object.keys(data[0]);
    var tk = opts && opts.timeColumn != null ? String(opts.timeColumn) : null;
    if (!tk) { for (var i = 0; i < keys.length; i++) { if (TIME_NAMES.indexOf(normalise(keys[i])) >= 0) { tk = keys[i]; break; } } }
    if (!tk) { return { ok: false, code: 'NO_TIME', candidates: keys, message: 'No timestamp field found — pick one.' }; }
    var long = keys.indexOf('point') >= 0 && keys.indexOf('value') >= 0;
    var triples = [], cols = [], seen = {}, zoned = null, k, rec, t;
    for (k = 0; k < data.length; k++) {
      rec = data[k];
      if (!rec || typeof rec !== 'object') { continue; }
      t = toTime(rec[tk]);
      if (!t) { return { ok: false, line: k + 1, message: 'Cannot read record ' + (k + 1) + ': "' + String(rec[tk]).slice(0, 40) + '" is not a timestamp.', record: k + 1 }; }
      zoned = zoned === null ? t.zoned : (zoned && t.zoned);
      if (long) {
        var name = String(rec.point);
        if (typeof rec.value !== 'number' || !finite(rec.value)) { continue; }
        if (!seen[name]) { seen[name] = 1; cols.push(name); }
        triples.push([t.ms, name, rec.value]);
      } else {
        Object.keys(rec).forEach(function (c) {
          if (c === tk || typeof rec[c] !== 'number' || !finite(rec[c])) { return; }
          if (!seen[c]) { seen[c] = 1; cols.push(c); }
          triples.push([t.ms, c, rec[c]]);
        });
      }
    }
    var b = build(triples, cols);
    return { ok: true, format: long ? 'long' : 'wide', timeColumn: tk, columns: cols, zoned: !!zoned, series: b.series, start: b.start, end: b.end, header: keys.join(',') };
  }

  function parse(text, opts) {
    var o = opts || {}, s = String(text == null ? '' : text).replace(/^﻿/, '');
    var json = /\.json$/i.test(String(o.name || '')) || /^\s*[\[{]/.test(s);
    return json ? parseJson(s, o) : parseCsv(s, o);
  }

  function fileTime(tick, clock) {
    var c = clock || {};
    return c.startMs + (tick - (c.startTick || 0)) * (c.speed || 1) * TICK_MS;
  }

  function valueAt(serie, t) {
    var ts = serie && serie.times;
    if (!ts || !ts.length || !(t >= ts[0])) { return null; }
    var lo = 0, hi = ts.length - 1, mid;
    while (lo < hi) { mid = (lo + hi + 1) >> 1; if (ts[mid] <= t) { lo = mid; } else { hi = mid - 1; } }
    return serie.values[lo];
  }

  function tokens(s) { return normalise(s).split(' ').filter(Boolean).sort().join(' '); }

  function autoMatch(columns, points) {
    var mapping = {}, unmatched = [], used = {};
    (columns || []).forEach(function (col) {
      var nc = normalise(col), tc = tokens(col), hit = null;
      (points || []).some(function (p) {
        if (used[p.key]) { return false; }
        var cands = [p.key, p.label];
        if (cands.some(function (c) { return c != null && (normalise(c) === nc || tokens(c) === tc); })) { hit = p.key; return true; }
        return false;
      });
      if (hit) { used[hit] = 1; mapping[col] = { point: hit, factor: 1 }; } else { unmatched.push(col); }
    });
    return { mapping: mapping, unmatched: unmatched };
  }

  /**
   * makeProvider({ series, mapping:{column:{point:'id|point', factor}}, known:[keys], cursor:fn→ms })
   * Mapped point → file value × factor at the cursor; known but unmapped (or before the first sample)
   * → { value:null, missing:true }; unknown → null (stays simulated), or the dash too when strict:true —
   * the page replays strict, so nothing is simulated silently while a file is shown (FR-P05-6).
   */
  function makeProvider(opts) {
    var o = opts || {}, byKey = {}, known = {};
    (o.known || []).forEach(function (k) { known[k] = 1; });
    Object.keys(o.mapping || {}).forEach(function (col) {
      var m = o.mapping[col];
      if (!m || !m.point || !o.series || !o.series[col]) { return; }
      byKey[m.point] = { serie: o.series[col], factor: finite(m.factor) ? m.factor : 1 };
      known[m.point] = 1;
    });
    return function (req) {
      var key = req.id + '|' + req.point, hit = byKey[key];
      if (!hit) { return (o.strict || known[key]) ? { value: null, quality: 'replay', missing: true } : null; }
      var v = valueAt(hit.serie, o.cursor());
      return v === null ? { value: null, quality: 'replay', missing: true } : { value: v * hit.factor, quality: 'replay' };
    };
  }

  var API = Object.freeze({ version: '1.0.0', MAX_BYTES: MAX_BYTES, TICK_MS: TICK_MS, check: check, parse: parse, normalise: normalise,
    fileTime: fileTime, valueAt: valueAt, autoMatch: autoMatch, makeProvider: makeProvider });
  if (root) { root.RZDatahallAIReplay = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
