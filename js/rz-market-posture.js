/* rz-market-posture.js — Market Posture engine (UMD: browser `window.RZMarketPosture`, Node `require`).
 *
 * A faithful JavaScript port of three skills from tradermonty/claude-trading-skills (MIT licence,
 * https://github.com/tradermonty/claude-trading-skills):
 *   - market-breadth-analyzer  scripts/{csv_client,scorer}.py + calculators/*.py   (6 components)
 *   - uptrend-analyzer         scripts/{data_fetcher,scorer}.py + calculators/*.py (5 components)
 *   - exposure-coach           scripts/calculate_exposure.py (composite of the two above)
 * Data: TraderMonty's public CSVs (no key, CORS *). No DOM here: the page fetches, calls, renders.
 *
 * Parity: tools/test-market-posture.mjs replays every call the ORIGINAL Python test-suites make and
 * compares this port's output field by field. Python semantics that change numbers are emulated on
 * purpose: round() is round-half-even on the exact binary value, sum() is CPython's compensated
 * (Neumaier) float sum, int() truncates, f-string formatting is correctly rounded.
 *
 * Policy: the source skills also emit trade prescriptions (zone "actions", "exposure_guidance",
 * "guidance", the coach's rationale). Those are NOT ported. Output is a descriptive posture for human
 * review — never an order, a size or a weight. The page must show FINEngine.DISCLAIMER with it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RZMarketPosture = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SOURCES = {
    breadthDetail: 'https://tradermonty.github.io/market-breadth-analysis/market_breadth_data.csv',
    breadthSummary: 'https://tradermonty.github.io/market-breadth-analysis/market_breadth_summary.csv',
    uptrendTimeseries: 'https://raw.githubusercontent.com/tradermonty/uptrend-dashboard/main/data/uptrend_ratio_timeseries.csv',
    uptrendSectorSummary: 'https://raw.githubusercontent.com/tradermonty/uptrend-dashboard/main/data/sector_summary.csv',
    skills: 'https://github.com/tradermonty/claude-trading-skills'
  };

  /* ───────────── Python semantics ───────────── */
  // Exact decimal expansion of a finite double (toFixed is exact up to 100 digits).
  function roundDigits(x, nd) {
    var neg = x < 0 || Object.is(x, -0);
    var s = Math.abs(x).toFixed(100), dot = s.indexOf('.');
    var ip = s.slice(0, dot), fp = s.slice(dot + 1);
    var keep = ip + fp.slice(0, nd), rest = fp.slice(nd);
    var up = false;
    if (rest[0] > '5') up = true;
    else if (rest[0] === '5') {
      if (/[1-9]/.test(rest.slice(1))) up = true;
      else up = (+keep[keep.length - 1]) % 2 === 1; // exact tie → even
    }
    var digits = keep.split('').map(Number);
    if (up) {
      var i = digits.length - 1;
      while (i >= 0) { if (digits[i] === 9) { digits[i] = 0; i--; } else { digits[i]++; break; } }
      if (i < 0) digits.unshift(1);
    }
    var str = digits.join(''), cut = str.length - nd;
    var txt = (cut > 0 ? str.slice(0, cut) : '0').replace(/^0+(?=\d)/, '') + (nd > 0 ? '.' + str.slice(cut) : '');
    return { neg: neg, txt: txt };
  }
  function pyRound(x, nd) {
    if (typeof x !== 'number' || !isFinite(x)) return x;
    var r = roundDigits(x, nd || 0), v = Number(r.txt);
    return r.neg ? -v : v;
  }
  // f-string "{x:.Nf}" / "{x:+.Nf}"
  function pyFmt(x, nd, plus) {
    if (isNaN(x)) return (plus ? '+' : '') + 'nan';
    if (!isFinite(x)) return (x > 0 ? (plus ? '+' : '') : '-') + 'inf';
    var r = roundDigits(x, nd);
    return (r.neg ? '-' : (plus ? '+' : '')) + r.txt;
  }
  // str(float) / f"{float}"
  function pyStr(x) {
    if (typeof x !== 'number') return String(x);
    if (isNaN(x)) return 'nan';
    if (!isFinite(x)) return x > 0 ? 'inf' : '-inf';
    if (Object.is(x, -0)) return '-0.0';
    if (Number.isInteger(x) && Math.abs(x) < 1e16) return x.toFixed(1);
    return String(x);
  }
  function pySum(values) { // CPython >= 3.12 float sum (Neumaier compensation)
    var f = 0, c = 0;
    for (var i = 0; i < values.length; i++) {
      var x = values[i], t = f + x;
      if (Math.abs(f) >= Math.abs(x)) c += (f - t) + x; else c += (x - t) + f;
      f = t;
    }
    if (c && isFinite(c)) f += c;
    return f;
  }
  function pyInt(v) {
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'string') {
      var s = v.trim().replace(/(\d)_(?=\d)/g, '$1');
      if (!/^[+-]?\d+$/.test(s)) throw new Error('ValueError: invalid literal for int(): ' + v);
      return parseInt(s, 10);
    }
    if (!isFinite(v)) throw new Error('ValueError: cannot convert to int');
    return Math.trunc(v);
  }
  function pyFloat(v) {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string') throw new Error('TypeError: float() argument');
    var s = v.trim();
    var m = /^([+-]?)(nan|inf|infinity)$/i.exec(s);
    if (m) return /nan/i.test(m[2]) ? NaN : (m[1] === '-' ? -Infinity : Infinity);
    s = s.replace(/(\d)_(?=\d)/g, '$1');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) throw new Error('ValueError: could not convert string to float: ' + v);
    return Number(s);
  }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function argExtreme(obj, keys, wantMax) { // max(d, key=d.get): first key wins ties
    var best = null;
    keys.forEach(function (k) {
      if (best === null || (wantMax ? obj[k] > obj[best] : obj[k] < obj[best])) best = k;
    });
    return best;
  }
  function pyMax(a) { var m = a[0]; for (var i = 1; i < a.length; i++) if (a[i] > m) m = a[i]; return m; }
  function pyMin(a) { var m = a[0]; for (var i = 1; i < a.length; i++) if (a[i] < m) m = a[i]; return m; }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s; }
  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }

  /* ───────────── CSV (Python csv.DictReader, excel dialect) ───────────── */
  function csvRows(text) {
    var rows = [], row = [], field = '', i = 0, n = text.length, inQ = false, started = false;
    while (i < n) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
        field += ch; i++; continue;
      }
      if (ch === '"' && field === '') { inQ = true; started = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; started = true; i++; continue; }
      if (ch === '\r' || ch === '\n') {
        if (started || field !== '' || row.length) { row.push(field); rows.push(row); }
        else rows.push([]);
        row = []; field = ''; started = false;
        i += (ch === '\r' && text[i + 1] === '\n') ? 2 : 1; continue;
      }
      field += ch; started = true; i++;
    }
    if (started || field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }
  function readDict(text) {
    var all = csvRows(String(text || '').replace(/^﻿+/, ''));
    var k = 0; while (k < all.length && all[k].length === 0) k++;
    if (k >= all.length) return { fields: [], rows: [] };
    var fields = all[k].map(function (f) { return (f || '').trim(); });
    var rows = [];
    for (var r = k + 1; r < all.length; r++) {
      var vals = all[r]; if (!vals.length) continue;
      var d = {};
      fields.forEach(function (f, j) { d[f] = j < vals.length ? vals[j] : null; });
      rows.push(d);
    }
    return { fields: fields, rows: rows };
  }
  function missingColumns(fields, required) {
    return required.filter(function (c) { return fields.indexOf(c) === -1; }).sort();
  }

  /* ───────────── market-breadth-analyzer: csv_client.py ───────────── */
  var DETAIL_COLUMNS = ['Date', 'S&P500_Price', 'Breadth_Index_Raw', 'Breadth_Index_200MA', 'Breadth_Index_8MA',
    'Breadth_200MA_Trend', 'Bearish_Signal', 'Is_Peak', 'Is_Trough', 'Is_Trough_8MA_Below_04'];
  function parseBool(v) {
    var s = v.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
    throw new Error('invalid boolean value: ' + v);
  }
  function finite(v, col) { var x = pyFloat(v); if (!isFinite(x)) throw new Error(col + ' must be finite'); return x; }
  function validDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }
  function parseDetailRow(raw) {
    var miss = DETAIL_COLUMNS.filter(function (c) { return raw[c] == null; });
    if (miss.length) throw new Error('missing values for: ' + miss.join(', '));
    var date = raw.Date.trim();
    if (!validDate(date)) throw new Error('invalid Date: ' + date);
    return {
      'Date': date,
      'S&P500_Price': finite(raw['S&P500_Price'], 'S&P500_Price'),
      'Breadth_Index_Raw': finite(raw.Breadth_Index_Raw, 'Breadth_Index_Raw'),
      'Breadth_Index_200MA': finite(raw.Breadth_Index_200MA, 'Breadth_Index_200MA'),
      'Breadth_Index_8MA': finite(raw.Breadth_Index_8MA, 'Breadth_Index_8MA'),
      'Breadth_200MA_Trend': pyInt(raw.Breadth_200MA_Trend),
      'Bearish_Signal': parseBool(raw.Bearish_Signal),
      'Is_Peak': parseBool(raw.Is_Peak),
      'Is_Trough': parseBool(raw.Is_Trough),
      'Is_Trough_8MA_Below_04': parseBool(raw.Is_Trough_8MA_Below_04)
    };
  }
  /** → {rows, skipped, error}. rows sorted by Date ascending (stable, as Python). */
  function parseBreadthDetailCsv(text) {
    var d = readDict(text), miss = missingColumns(d.fields, DETAIL_COLUMNS);
    if (miss.length) return { rows: [], skipped: 0, error: 'market_breadth_data.csv schema drift: missing columns [' + miss.join(',') + ']' };
    var rows = [], skipped = 0;
    d.rows.forEach(function (raw) { try { rows.push(parseDetailRow(raw)); } catch (e) { skipped++; } });
    rows.sort(function (a, b) { return a.Date < b.Date ? -1 : a.Date > b.Date ? 1 : 0; });
    return { rows: rows, skipped: skipped, error: null };
  }
  function parseBreadthSummaryCsv(text) {
    var d = readDict(text), miss = missingColumns(d.fields, ['Metric', 'Value']), out = {};
    if (miss.length) return {};
    d.rows.forEach(function (r) {
      if (r.Metric == null || r.Value == null) return;
      var m = r.Metric.trim(); if (m) out[m] = r.Value.trim();
    });
    return out;
  }

  /* ───────────── market-breadth-analyzer: calculators ───────────── */
  function bandScore(x, cuts, scores) { for (var i = 0; i < cuts.length; i++) if (x >= cuts[i]) return scores[i]; return scores[scores.length - 1]; }

  function calcBreadthLevelTrend(rows) {
    if (!rows || !rows.length) return { score: 50, signal: 'NO DATA: No breadth data available', data_available: false };
    var latest = rows[rows.length - 1], ma8 = latest.Breadth_Index_8MA, trend = latest.Breadth_200MA_Trend;
    var level = bandScore(ma8, [0.70, 0.60, 0.50, 0.40, 0.30, 0.20], [95, 80, 65, 50, 35, 20, 5]);
    var trendScore = trend === 1 ? 80 : 20, dir = null, mod = 0;
    if (rows.length >= 6) {
      var past = rows[rows.length - 6].Breadth_Index_8MA;
      if (ma8 > past) dir = 'rising'; else if (ma8 < past) dir = 'falling'; else dir = 'flat';
      if (dir === 'falling' && ma8 > 0.60) mod = -10;
      else if (dir === 'falling' && ma8 < 0.40) mod = 5;
      else if (dir === 'rising' && ma8 < 0.60) mod = 5;
    }
    var score = clamp(pyRound(0.70 * level + 0.30 * trendScore) + mod, 0, 100);
    var ts = trend === 1 ? 'uptrend' : 'downtrend', f = pyFmt(ma8, 3);
    var signal = score >= 80 ? 'STRONG: 8MA=' + f + ' in ' + ts + ' - broad participation'
      : score >= 60 ? 'HEALTHY: 8MA=' + f + ' in ' + ts + ' - above average'
      : score >= 40 ? 'NEUTRAL: 8MA=' + f + ' in ' + ts + ' - mixed signals'
      : score >= 20 ? 'WEAK: 8MA=' + f + ' in ' + ts + ' - deteriorating breadth'
      : 'CRITICAL: 8MA=' + f + ' in ' + ts + ' - severe weakness';
    var out = { score: score, signal: signal, data_available: true, current_8ma: ma8, current_200ma: latest.Breadth_Index_200MA,
      trend: trend, level_score: level, trend_score: trendScore, date: latest.Date };
    if (dir !== null) { out.ma8_direction = dir; out.direction_modifier = mod; }
    return out;
  }

  function calcMaCrossover(rows) {
    if (!rows || rows.length < 6) return { score: 50, signal: 'NO DATA: Insufficient data for crossover analysis', data_available: false };
    var latest = rows[rows.length - 1], ma8 = latest.Breadth_Index_8MA, ma200 = latest.Breadth_Index_200MA, gap = ma8 - ma200;
    var gapScore = bandScore(gap, [0.15, 0.10, 0.05, 0.00, -0.05, -0.10], [95, 80, 65, 50, 35, 20, 5]);
    var past = rows[rows.length - 6].Breadth_Index_8MA, rising = ma8 > past, dir = rising ? 'rising' : 'falling';
    var mod = (gap < 0 && rising) ? 10 : (gap > 0 && !rising) ? -10 : 0;
    var score = clamp(pyRound(gapScore + mod), 0, 100);
    var ms = mod > 0 ? ' (recovery signal)' : mod < 0 ? ' (deterioration signal)' : '';
    var g = '(gap=' + pyFmt(gap, 3, true) + ', 8MA ' + dir + ')' + ms;
    var signal = score >= 80 ? 'BULLISH: 8MA well above 200MA ' + g : score >= 60 ? 'POSITIVE: 8MA above 200MA ' + g
      : score >= 40 ? 'NEUTRAL: Near crossover ' + g : score >= 20 ? 'NEGATIVE: 8MA below 200MA ' + g : 'BEARISH: 8MA far below 200MA ' + g;
    return { score: score, signal: signal, data_available: true, gap: gap, gap_score: gapScore, current_8ma: ma8, current_200ma: ma200,
      ma8_5d_ago: past, ma8_direction: dir, direction_modifier: mod, date: latest.Date };
  }

  function calcCyclePosition(rows) {
    if (!rows || rows.length < 10) return { score: 50, signal: 'NO DATA: Insufficient data for cycle analysis', data_available: false };
    var recent = rows.slice(-Math.min(120, rows.length)), latest = rows[rows.length - 1], cur = latest.Breadth_Index_8MA;
    var type = null, idx = -1, days = null;
    for (var i = recent.length - 1; i >= 0; i--) {
      if (recent[i].Is_Peak) { type = 'PEAK'; idx = i; days = recent.length - 1 - i; break; }
      if (recent[i].Is_Trough || recent[i].Is_Trough_8MA_Below_04) { type = 'TROUGH'; idx = i; days = recent.length - 1 - i; break; }
    }
    var trend = rows.length >= 6 ? (cur > rows[rows.length - 6].Breadth_Index_8MA ? 'rising' : 'falling') : 'unknown';
    var extreme = type === 'TROUGH' ? recent[idx].Is_Trough_8MA_Below_04 : false, rising = trend === 'rising', base = 50;
    if (type === 'TROUGH') { base = days <= 20 ? (rising ? 85 : 30) : days <= 60 ? (rising ? 75 : 35) : (rising ? 65 : 40); if (extreme) base += 10; }
    else if (type === 'PEAK') base = days <= 20 ? (rising ? 60 : 20) : days <= 60 ? (rising ? 45 : 15) : (rising ? 50 : 10);
    var score = clamp(base, 0, 100), signal, phase;
    if (type === null) signal = 'NEUTRAL: No cycle marker in last 120 days';
    else if (type === 'TROUGH') {
      phase = days <= 20 ? (rising ? 'early recovery' : 'failed reversal attempt') : days <= 60 ? (rising ? 'sustained recovery' : 'stalled recovery') : (rising ? 'mature recovery' : 'weakening recovery');
      signal = 'TROUGH (' + days + 'd ago): ' + phase + ', 8MA ' + trend;
    } else {
      phase = days <= 20 ? (rising ? 'consolidation near highs' : 'post-peak decline') : days <= 60 ? (!rising ? 'gradual decline' : 'recovery attempt') : (rising ? 'possible bottom formation' : 'prolonged decline');
      signal = 'PEAK (' + days + 'd ago): ' + phase + ', 8MA ' + trend;
    }
    return { score: score, signal: signal, data_available: type !== null, latest_marker_type: type, days_since_marker: days,
      ma8_trend: trend, current_8ma: cur, extreme_trough: extreme, date: latest.Date };
  }

  function calcBearishSignal(rows) {
    if (!rows || !rows.length) return { score: 50, signal: 'NO DATA: No data available for bearish signal analysis', data_available: false };
    var latest = rows[rows.length - 1], active = latest.Bearish_Signal, trend = latest.Breadth_200MA_Trend;
    var ma8 = latest.Breadth_Index_8MA, ma200 = latest.Breadth_Index_200MA, pink = trend === -1 && ma8 < ma200, pinkDays = 0;
    if (pink) for (var i = rows.length - 1; i >= 0; i--) {
      if (rows[i].Breadth_200MA_Trend === -1 && rows[i].Breadth_Index_8MA < rows[i].Breadth_Index_200MA) pinkDays++; else break;
    }
    var base = (!active && trend === 1) ? 85 : (!active && trend === -1) ? 50 : (active && trend === 1) ? 30 : 10;
    var ctx = active ? (ma8 > 0.50 ? 15 : ma8 < 0.25 ? -5 : 0) : 0, pinkAdj = (pink && !active) ? -10 : 0;
    var score = clamp(pyRound(base + ctx + pinkAdj), 0, 100);
    var ts = trend === 1 ? 'uptrend' : 'downtrend', ps = pink ? ' [PINK ZONE]' : '', signal;
    if (!active) signal = trend === 1 ? 'ALL CLEAR: No bearish signal, ' + ts
      : pink ? 'CAUTION: No bearish signal but in Pink Zone (downtrend + 8MA < 200MA)' + ps : 'CAUTION: No bearish signal but ' + ts;
    else if (ma8 > 0.50) signal = 'WARNING (muted): Bearish signal active in ' + ts + ', but 8MA=' + pyFmt(ma8, 3) + ' still relatively strong' + ps;
    else if (ma8 < 0.25) signal = 'CRITICAL: Bearish signal active in ' + ts + ', 8MA=' + pyFmt(ma8, 3) + ' extremely weak' + ps;
    else signal = 'BEARISH: Signal active in ' + ts + ', 8MA=' + pyFmt(ma8, 3) + ps;
    return { score: score, signal: signal, data_available: true, signal_active: active, trend: trend, current_8ma: ma8, current_200ma: ma200,
      in_pink_zone: pink, pink_zone_days: pinkDays, base_score: base, context_adjustment: ctx, pink_zone_adjustment: pinkAdj, date: latest.Date };
  }

  function safeFloat(v) { try { return v == null ? null : pyFloat(v); } catch (e) { return null; } }
  function calcHistoricalPercentile(rows, summary) {
    if (!rows || !rows.length) return { score: 50, signal: 'NO DATA: No data available for historical analysis', data_available: false };
    summary = summary || {};
    var all = rows.map(function (r) { return r.Breadth_Index_8MA; }), cur = all[all.length - 1];
    var below = all.filter(function (v) { return v < cur; }).length, pct = (below / all.length) * 100;
    var base = bandScore(pct, [80, 60, 40, 20], [90, 70, 50, 30, 10]);
    var peak = safeFloat(has(summary, 'Average Peaks (200MA)') ? summary['Average Peaks (200MA)'] : '');
    var trough = safeFloat(has(summary, 'Average Troughs (8MA < 0.4)') ? summary['Average Troughs (8MA < 0.4)'] : '');
    var adj = (peak !== null && cur >= peak * 0.95) ? -10 : (trough !== null && cur <= trough * 1.05) ? 10 : 0;
    var score = clamp(pyRound(base + adj), 0, 100);
    var as = adj < 0 ? ' (near historical peak - overheated)' : adj > 0 ? ' (near historical trough - oversold)' : '', p = pyFmt(pct, 0);
    var signal = score >= 70 ? 'HIGH: ' + p + 'th percentile - above average breadth' + as
      : score >= 40 ? 'AVERAGE: ' + p + 'th percentile - normal range' + as : 'LOW: ' + p + 'th percentile - below average breadth' + as;
    return { score: score, signal: signal, data_available: true, current_8ma: cur, percentile_rank: pct, base_score: base, adjustment: adj,
      avg_peak: peak, avg_trough: trough, total_observations: all.length, date: rows[rows.length - 1].Date };
  }

  function divergenceWindow(rows, lookback) {
    var n = Math.min(lookback, rows.length), latest = rows[rows.length - 1], past = rows[rows.length - n];
    var spPast = past['S&P500_Price'], ma8Past = past.Breadth_Index_8MA;
    if (spPast <= 0) return { score: 50, sp_pct: 0.0, breadth_chg: 0.0, div_type: 'Invalid data', sp_past: spPast, ma8_past: ma8Past, lookback_days: n };
    var sp = (latest['S&P500_Price'] - spPast) / spPast * 100, br = latest.Breadth_Index_8MA - ma8Past, s, t;
    if (sp > 3.0 && br < -0.05) { s = 10; t = 'Dangerous bearish divergence'; }
    else if (sp > 1.0 && br < -0.03) { s = 25; t = 'Moderate bearish divergence'; }
    else if (sp < -3.0 && br > 0.05) { s = 80; t = 'Strong bullish divergence'; }
    else if (sp < -1.0 && br > 0.03) { s = 65; t = 'Moderate bullish divergence'; }
    else if (Math.abs(sp) < 0.5 && Math.abs(br) < 0.01) { s = 50; t = 'Near-flat (insufficient movement)'; }
    else if (sp > 0 && br > 0) { s = 70; t = 'Healthy alignment (both rising)'; }
    else if (!(sp > 0) && !(br > 0)) { s = 30; t = 'Consistent decline (both falling)'; }
    else { s = 50; t = 'Mixed signals'; }
    return { score: clamp(s, 0, 100), sp_pct: sp, breadth_chg: br, div_type: t, sp_past: spPast, ma8_past: ma8Past, lookback_days: n };
  }
  function calcDivergence(rows) {
    if (!rows || rows.length < 20) return { score: 50, signal: 'NO DATA: Insufficient data for divergence analysis', data_available: false };
    var latest = rows[rows.length - 1], w60 = divergenceWindow(rows, 60), w20 = divergenceWindow(rows, 20);
    var score = clamp(pyRound(w60.score * 0.6 + w20.score * 0.4, 1), 0, 100);
    function win(w) { return { score: w.score, divergence_type: w.div_type, sp500_pct_change: pyRound(w.sp_pct, 2), breadth_change: pyRound(w.breadth_chg, 4), lookback_days: w.lookback_days }; }
    return { score: score,
      signal: w60.div_type + ': S&P ' + pyFmt(w60.sp_pct, 1, true) + '%, Breadth 8MA ' + pyFmt(w60.breadth_chg, 3, true) + ' over 60d',
      data_available: true, sp500_pct_change: pyRound(w60.sp_pct, 2), breadth_change: pyRound(w60.breadth_chg, 4),
      sp500_latest: latest['S&P500_Price'], sp500_past: w60.sp_past, ma8_latest: latest.Breadth_Index_8MA, ma8_past: w60.ma8_past,
      lookback_days: w60.lookback_days, divergence_type: w60.div_type, date: latest.Date,
      window_60d: win(w60), window_20d: win(w20), early_warning: w20.score <= 25 && w60.score >= 50 };
  }

  /* ───────────── market-breadth-analyzer: scorer.py ───────────── */
  var BREADTH_WEIGHTS = { breadth_level_trend: 0.25, ma_crossover: 0.20, cycle_position: 0.20, bearish_signal: 0.15, historical_percentile: 0.10, divergence: 0.10 };
  var BREADTH_LABELS = { breadth_level_trend: 'Current Breadth Level & Trend', ma_crossover: '8MA vs 200MA Crossover', cycle_position: 'Peak/Trough Cycle Position',
    bearish_signal: 'Bearish Signal Status', historical_percentile: 'Historical Percentile', divergence: 'S&P 500 vs Breadth Divergence' };
  function breadthZone(c) {
    return c >= 80 ? { zone: 'Strong', color: 'green' } : c >= 60 ? { zone: 'Healthy', color: 'blue' } : c >= 40 ? { zone: 'Neutral', color: 'yellow' }
      : c >= 20 ? { zone: 'Weakening', color: 'orange' } : { zone: 'Critical', color: 'red' };
  }
  function breadthComposite(scores, availability) {
    availability = availability || {};
    var keys = Object.keys(BREADTH_WEIGHTS), avail = {}, eff = {};
    keys.forEach(function (k) { avail[k] = has(availability, k) ? availability[k] : true; });
    var total = pySum(keys.filter(function (k) { return avail[k]; }).map(function (k) { return BREADTH_WEIGHTS[k]; })); // Python sum(): compensated
    keys.forEach(function (k) { eff[k] = !avail[k] ? 0.0 : total > 0 ? BREADTH_WEIGHTS[k] / total : 0.0; });
    function sc(k) { return has(scores, k) ? scores[k] : 50; }
    var composite, zone;
    if (total === 0) { composite = 50.0; zone = breadthZone(composite); zone = { zone: 'Neutral', color: zone.color }; }
    else { composite = 0.0; keys.forEach(function (k) { composite += sc(k) * eff[k]; }); composite = pyRound(composite, 1); zone = breadthZone(composite); }
    var valid = {}, vkeys = Object.keys(scores).filter(function (k) { return has(BREADTH_WEIGHTS, k) && (has(avail, k) ? avail[k] : true); });
    vkeys.forEach(function (k) { valid[k] = scores[k]; });
    var strong = vkeys.length ? argExtreme(valid, vkeys, true) : 'N/A', weak = vkeys.length ? argExtreme(valid, vkeys, false) : 'N/A';
    var count = keys.filter(function (k) { return avail[k]; }).length, missing = keys.filter(function (k) { return !avail[k]; }).map(function (k) { return BREADTH_LABELS[k]; });
    var label = count === keys.length ? 'Complete (' + count + '/' + keys.length + ' components)'
      : count >= keys.length - 2 ? 'Partial (' + count + '/' + keys.length + ' components) - interpret with caution'
      : 'Limited (' + count + '/' + keys.length + ' components) - low confidence';
    var comps = {};
    keys.forEach(function (k) {
      comps[k] = { score: sc(k), weight: BREADTH_WEIGHTS[k], effective_weight: pyRound(eff[k], 6), weighted_contribution: pyRound(sc(k) * eff[k], 1),
        data_available: avail[k], label: BREADTH_LABELS[k] };
    });
    return { composite_score: composite, zone: zone.zone, zone_color: zone.color,
      strongest_health: { component: strong, label: BREADTH_LABELS[strong] || strong, score: has(valid, strong) ? valid[strong] : 0 },
      weakest_health: { component: weak, label: BREADTH_LABELS[weak] || weak, score: has(valid, weak) ? valid[weak] : 0 },
      excluded_components: missing.slice(), data_quality: { available_count: count, total_components: keys.length, label: label, missing_components: missing },
      component_scores: comps };
  }

  /** Full market-breadth-analyzer run (scoring part of market_breadth_analyzer.py main()). */
  function analyzeBreadth(rows, summary) {
    if (!rows || !rows.length) return null;
    var c = { breadth_level_trend: calcBreadthLevelTrend(rows), ma_crossover: calcMaCrossover(rows), cycle_position: calcCyclePosition(rows),
      bearish_signal: calcBearishSignal(rows), historical_percentile: calcHistoricalPercentile(rows, summary || {}), divergence: calcDivergence(rows) };
    var scores = {}, avail = {};
    Object.keys(c).forEach(function (k) { scores[k] = c[k].score; avail[k] = has(c[k], 'data_available') ? c[k].data_available : true; });
    return { as_of: rows[rows.length - 1].Date, total_rows: rows.length, components: c, composite: breadthComposite(scores, avail) };
  }

  /* ───────────── uptrend-analyzer: data_fetcher.py ───────────── */
  var TIMESERIES_COLUMNS = ['worksheet', 'date', 'count', 'total', 'ratio', 'ma_10', 'slope', 'trend'];
  var SECTOR_SUMMARY_COLUMNS = ['Sector', 'Ratio', '10MA', 'Trend', 'Slope', 'Status'];
  var WORKSHEET_TO_DISPLAY = { sec_basicmaterials: 'Basic Materials', sec_communicationservices: 'Communication Services', sec_consumercyclical: 'Consumer Cyclical',
    sec_consumerdefensive: 'Consumer Defensive', sec_energy: 'Energy', sec_financial: 'Financial', sec_healthcare: 'Healthcare', sec_industrials: 'Industrials',
    sec_realestate: 'Real Estate', sec_technology: 'Technology', sec_utilities: 'Utilities' };
  var OVERBOUGHT = 0.37, OVERSOLD = 0.097;
  function txt(r, k) { return (r[k] || '').trim(); }
  function optFloat(v) { if (v == null || String(v).trim() === '') return null; try { return pyFloat(String(v)); } catch (e) { return null; } }
  function optInt(v) { var f = optFloat(v); return (f === null || !isFinite(f)) ? null : Math.trunc(f); }
  function parseUptrendTimeseriesCsv(text) {
    var d = readDict(text), miss = missingColumns(d.fields, TIMESERIES_COLUMNS);
    if (miss.length) return { rows: [], error: 'uptrend_ratio_timeseries.csv schema drift: missing columns [' + miss.join(',') + ']' };
    var rows = d.rows.map(function (r) {
      return { worksheet: txt(r, 'worksheet'), date: txt(r, 'date'), count: optInt(r.count), total: optInt(r.total), ratio: optFloat(r.ratio),
        ma_10: optFloat(r.ma_10), slope: optFloat(r.slope), trend: txt(r, 'trend') };
    });
    var usable = rows.some(function (r) { return r.worksheet === 'all' && r.ratio !== null && isFinite(r.ratio); });
    if (!usable) return { rows: [], error: "uptrend_ratio_timeseries.csv schema drift: no usable 'all' ratio values" };
    return { rows: rows, error: null };
  }
  function parseUptrendSectorSummaryCsv(text) {
    var d = readDict(text), miss = missingColumns(d.fields, SECTOR_SUMMARY_COLUMNS);
    if (miss.length) return { rows: [], error: 'sector_summary.csv schema drift: missing columns [' + miss.join(',') + ']' };
    return { rows: d.rows.map(function (r) {
      return { Sector: txt(r, 'Sector'), Ratio: optFloat(r.Ratio), '10MA': optFloat(r['10MA']), Trend: txt(r, 'Trend'), Slope: optFloat(r.Slope), Status: txt(r, 'Status') };
    }), error: null };
  }
  function byDate(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }
  function allTimeseries(rows) { return rows.filter(function (r) { return r.worksheet === 'all'; }).sort(byDate); }
  function sectorLatest(rows) {
    var out = {};
    rows.forEach(function (r) { if (r.worksheet !== 'all' && (!has(out, r.worksheet) || r.date > out[r.worksheet].date)) out[r.worksheet] = r; });
    return out;
  }
  function buildSummaryFromTimeseries(sectorTs) {
    return Object.keys(sectorTs || {}).map(function (ws) {
      var r = sectorTs[ws], ratio = has(r, 'ratio') ? r.ratio : null;
      var status = (ratio != null && ratio > OVERBOUGHT) ? 'Overbought' : (ratio != null && ratio < OVERSOLD) ? 'Oversold' : 'Normal';
      return { Sector: WORKSHEET_TO_DISPLAY[ws] || ws, Ratio: ratio, '10MA': has(r, 'ma_10') ? r.ma_10 : null, Trend: cap(r.trend || ''),
        Slope: has(r, 'slope') ? r.slope : null, Status: status, Count: has(r, 'count') ? r.count : null, Total: has(r, 'total') ? r.total : null };
    });
  }
  function g(o, k, dflt) { return has(o, k) ? o[k] : (dflt === undefined ? null : dflt); }

  /* ───────────── uptrend-analyzer: calculators ───────────── */
  function ratioToScore(r) {
    if (r >= 0.50) return Math.min(100, 90 + (r - 0.50) / 0.10 * 10);
    if (r >= OVERBOUGHT) return 70 + (r - OVERBOUGHT) / (0.50 - OVERBOUGHT) * 19;
    if (r >= 0.25) return 40 + (r - 0.25) / (OVERBOUGHT - 0.25) * 29;
    if (r >= OVERSOLD) return 10 + (r - OVERSOLD) / (0.25 - OVERSOLD) * 29;
    return Math.max(0, r / OVERSOLD * 9);
  }
  function calcMarketBreadth(latest) {
    if (!latest || g(latest, 'ratio') == null) return { score: 50, signal: 'NO DATA: Overall uptrend ratio unavailable (neutral default)', data_available: false,
      ratio: null, ma_10: null, trend: null, slope: null, distance_from_upper: null, distance_from_lower: null };
    var ratio = latest.ratio, ma10 = g(latest, 'ma_10'), trend = g(latest, 'trend', ''), slope = g(latest, 'slope');
    var adj = (trend.toLowerCase() === 'up' && slope != null && slope > 0) ? 5 : (trend.toLowerCase() === 'down' && slope != null && slope < 0) ? -5 : 0;
    var score = pyRound(Math.min(100, Math.max(0, ratioToScore(ratio) + adj)));
    var rp = pyStr(pyRound(ratio * 100, 1)), tl = trend ? ', trend ' + trend : '';
    var lbl = score >= 90 ? 'STRONG BULL' : score >= 70 ? 'BULLISH' : score >= 45 ? 'NEUTRAL' : score >= 30 ? 'WEAK' : score >= 10 ? 'VERY WEAK' : 'CRISIS';
    return { score: score, signal: lbl + ': ' + rp + '% uptrend ratio' + tl, data_available: true, ratio: ratio, ratio_pct: pyRound(ratio * 100, 1),
      ma_10: ma10, ma_10_pct: ma10 != null ? pyRound(ma10 * 100, 1) : null, trend: trend, slope: slope, trend_adjustment: adj,
      distance_from_upper: pyRound(ratio - OVERBOUGHT, 4), distance_from_lower: pyRound(ratio - OVERSOLD, 4),
      upper_threshold: OVERBOUGHT, lower_threshold: OVERSOLD, date: g(latest, 'date', 'N/A') };
  }
  function nonEmpty(o) { return o && (Array.isArray(o) ? o.length > 0 : Object.keys(o).length > 0); }

  function calcSectorParticipation(summary, sectorTs) {
    if (!nonEmpty(summary)) {
      if (nonEmpty(sectorTs)) summary = buildSummaryFromTimeseries(sectorTs);
      else return { score: 50, signal: 'NO DATA: Sector summary unavailable (neutral default)', data_available: false, uptrend_count: null, total_sectors: null, spread: null, sector_details: [] };
    }
    var total = summary.length;
    var up = summary.filter(function (s) { return g(s, 'Trend', '').toLowerCase() === 'up'; }).length;
    var ratios = summary.filter(function (s) { return g(s, 'Ratio') != null; }).map(function (s) { return s.Ratio; });
    var mx = ratios.length ? pyMax(ratios) : null, mn = ratios.length ? pyMin(ratios) : null, spread = ratios.length ? mx - mn : null;
    var countScore = total === 0 ? 50 : up >= 10 ? 100 : up >= 8 ? 80 : up >= 6 ? 60 : up >= 4 ? 40 : up >= 2 ? 20 : 0;
    var spreadScore = spread == null ? 50 : spread < 0.15 ? 100 : spread < 0.25 ? 100 - (spread - 0.15) / 0.10 * 20
      : spread < 0.35 ? 80 - (spread - 0.25) / 0.10 * 20 : spread < 0.45 ? 60 - (spread - 0.35) / 0.10 * 30 : Math.max(0, 30 - (spread - 0.45) / 0.10 * 30);
    var score = pyRound(Math.min(100, Math.max(0, countScore * 0.60 + spreadScore * 0.40)));
    var ob = summary.filter(function (s) { return g(s, 'Ratio') != null && s.Ratio >= OVERBOUGHT; });
    var os = summary.filter(function (s) { return g(s, 'Ratio') != null && s.Ratio < OVERSOLD; });
    var sp = spread != null ? ', spread ' + pyStr(pyRound(spread * 100, 1)) + '%' : '', cnt = up + '/' + total + ' sectors uptrending' + sp;
    var signal = score >= 80 ? 'BROAD PARTICIPATION: ' + cnt : score >= 60 ? 'HEALTHY: ' + cnt : score >= 40 ? 'MODERATE: ' + cnt : score >= 20 ? 'NARROW: ' + cnt : 'VERY NARROW: ' + cnt;
    var details = summary.slice().sort(function (a, b) { return (g(b, 'Ratio') || 0) - (g(a, 'Ratio') || 0); }).map(function (s) {
      return { sector: g(s, 'Sector', 'Unknown'), ratio: g(s, 'Ratio'), ratio_pct: g(s, 'Ratio') != null ? pyRound(s.Ratio * 100, 1) : null, ma_10: g(s, '10MA'),
        trend: g(s, 'Trend', ''), slope: g(s, 'Slope'), status: g(s, 'Status', ''), count: g(s, 'Count'), total: g(s, 'Total') };
    });
    return { score: score, signal: signal, data_available: true, uptrend_count: up, total_sectors: total, count_score: pyRound(countScore),
      spread: spread != null ? pyRound(spread, 4) : null, spread_pct: spread != null ? pyRound(spread * 100, 1) : null, spread_score: pyRound(spreadScore),
      max_ratio: mx, min_ratio: mn, overbought_count: ob.length, overbought_sectors: ob.map(function (s) { return g(s, 'Sector', ''); }),
      oversold_count: os.length, oversold_sectors: os.map(function (s) { return g(s, 'Sector', ''); }), sector_details: details };
  }

  var CYCLICAL = ['Technology', 'Consumer Cyclical', 'Communication Services', 'Financial', 'Industrials'];
  var DEFENSIVE = ['Utilities', 'Consumer Defensive', 'Healthcare', 'Real Estate'];
  var COMMODITY = ['Energy', 'Basic Materials'];
  function groupRatios(map, names) { return names.filter(function (n) { return map[n] && g(map[n], 'Ratio') != null; }).map(function (n) { return map[n].Ratio; }); }
  function avg(v) { return pySum(v) / v.length; }
  function analyzeGroup(map, names) {
    var ratios = [], trends = [], named = [];
    names.forEach(function (n) { var s = map[n]; if (s && g(s, 'Ratio') != null) { ratios.push(s.Ratio); trends.push(g(s, 'Trend', '').toLowerCase()); named.push(n); } });
    if (ratios.length < 2) return { flagged: false, std_dev: null, spread: null, outliers: [], trend_dissenters: [] };
    var mean = pySum(ratios) / ratios.length;
    var sd = Math.sqrt(pySum(ratios.map(function (r) { return Math.pow(r - mean, 2); })) / ratios.length), spread = pyMax(ratios) - pyMin(ratios);
    var outliers = [];
    named.forEach(function (n, i) { if (Math.abs(ratios[i] - mean) > 1.5 * sd && sd > 0) outliers.push({ sector: n, ratio: ratios[i], deviation: pyRound(ratios[i] - mean, 4) }); });
    var dissent = [];
    if (trends.length) {
      var u = trends.filter(function (t) { return t === 'up'; }).length, d = trends.filter(function (t) { return t === 'down'; }).length, maj = u >= d ? 'up' : 'down';
      named.forEach(function (n, i) { if (trends[i] && trends[i] !== maj) dissent.push({ sector: n, trend: trends[i], majority: maj }); });
    }
    return { flagged: sd > 0.08 || spread > 0.20 || dissent.length > 0, std_dev: pyRound(sd, 4), spread: pyRound(spread, 4), outliers: outliers, trend_dissenters: dissent };
  }
  function groupDetails(map, names) {
    return names.map(function (n) {
      var s = map[n];
      return s ? { sector: n, ratio: g(s, 'Ratio'), ratio_pct: g(s, 'Ratio') != null ? pyRound(s.Ratio * 100, 1) : null, trend: g(s, 'Trend', ''), slope: g(s, 'Slope') }
        : { sector: n, ratio: null, ratio_pct: null, trend: 'N/A', slope: null };
    });
  }
  function calcSectorRotation(summary, sectorTs) {
    if (!nonEmpty(summary)) {
      if (nonEmpty(sectorTs)) summary = buildSummaryFromTimeseries(sectorTs);
      else return { score: 50, signal: 'NO DATA: Sector summary unavailable (neutral default)', data_available: false, cyclical_avg: null, defensive_avg: null, commodity_avg: null, difference: null };
    }
    var map = {};
    summary.forEach(function (s) { if (g(s, 'Sector')) map[s.Sector] = s; });
    var cr = groupRatios(map, CYCLICAL), dr = groupRatios(map, DEFENSIVE), mr = groupRatios(map, COMMODITY);
    var ca = cr.length ? avg(cr) : null, da = dr.length ? avg(dr) : null, ma = mr.length ? avg(mr) : null;
    if (ca === null || da === null) return { score: 50, signal: 'INCOMPLETE DATA: Cannot calculate rotation (neutral default)', data_available: false,
      cyclical_avg: ca, defensive_avg: da, commodity_avg: ma, difference: null };
    var diff = ca - da;
    var base = diff > 0.15 ? Math.min(100, 90 + (diff - 0.15) / 0.10 * 10) : diff > 0.05 ? 70 + (diff - 0.05) / 0.10 * 19
      : diff > -0.05 ? 45 + (diff + 0.05) / 0.10 * 24 : diff > -0.15 ? 20 + (diff + 0.15) / 0.10 * 24 : Math.max(0, 19 + (diff + 0.15) / 0.10 * 19);
    var late = false, cp = 0;
    if (ma !== null && ma > ca && ma > da) { late = true; cp = (ma - Math.max(ca, da)) > 0.10 ? -10 : -5; }
    var cyc = analyzeGroup(map, CYCLICAL), def = analyzeGroup(map, DEFENSIVE), divFlag = cyc.flagged || def.flagged, dp = divFlag ? -5 : 0;
    var score = pyRound(Math.min(100, Math.max(0, base + cp + dp)));
    var dpct = pyRound(diff * 100, 1), ls = late ? ' [LATE CYCLE WARNING]' : '';
    var signal = score >= 90 ? 'STRONG RISK-ON: Cyclical leads by ' + pyStr(dpct) + 'pp' + ls : score >= 70 ? 'RISK-ON: Cyclical leads by ' + pyStr(dpct) + 'pp' + ls
      : score >= 45 ? 'BALANCED: Cyclical-Defensive gap ' + pyStr(dpct) + 'pp' + ls : score >= 20 ? 'DEFENSIVE TILT: Defensive leads by ' + pyStr(Math.abs(dpct)) + 'pp' + ls
      : 'STRONG RISK-OFF: Defensive leads by ' + pyStr(Math.abs(dpct)) + 'pp' + ls;
    return { score: score, signal: signal, data_available: true, cyclical_avg: pyRound(ca, 4), cyclical_avg_pct: pyRound(ca * 100, 1),
      defensive_avg: pyRound(da, 4), defensive_avg_pct: pyRound(da * 100, 1), commodity_avg: ma !== null ? pyRound(ma, 4) : null,
      commodity_avg_pct: ma !== null ? pyRound(ma * 100, 1) : null, difference: pyRound(diff, 4), difference_pct: dpct, late_cycle_flag: late,
      commodity_penalty: cp, divergence_flag: divFlag, divergence_penalty: dp, cyclical_divergence: cyc, defensive_divergence: def,
      cyclical_details: groupDetails(map, CYCLICAL), defensive_details: groupDetails(map, DEFENSIVE), commodity_details: groupDetails(map, COMMODITY) };
  }

  function ema(values, span) {
    if (!values.length) return [];
    if (values.length === 1) return [values[0]];
    var a = 2.0 / (span + 1), out = [values[0]];
    for (var i = 1; i < values.length; i++) out.push(a * values[i] + (1 - a) * out[out.length - 1]);
    return out;
  }
  function classifyAccel(x) {
    return x > 0.005 ? [90, 'strong_accelerating'] : x > 0.001 ? [75, 'accelerating'] : x > -0.001 ? [50, 'steady'] : x > -0.005 ? [25, 'decelerating'] : [10, 'strong_decelerating'];
  }
  function accelFrom(v, w) {
    if (v.length < w * 2) return [50, null, 'insufficient_data'];
    var x = pySum(v.slice(-w)) / w - pySum(v.slice(-w * 2, -w)) / w, c = classifyAccel(x);
    return [c[0], pyRound(x, 6), c[1]];
  }
  function accelSmoothed(v) {
    if (v.length < 20) return accelFrom(v, 5);
    var x = pySum(v.slice(-10)) / 10 - pySum(v.slice(-20, -10)) / 10, c = classifyAccel(x);
    return [c[0], pyRound(x, 6), c[1]];
  }
  function slopeScore(s) {
    if (s >= 0.02) return Math.min(100, 95 + (s - 0.02) / 0.01 * 5);
    if (s >= 0.01) return 75 + (s - 0.01) / 0.01 * 19;
    if (s >= 0) return 55 + s / 0.01 * 19;
    if (s >= -0.01) return 35 + (s + 0.01) / 0.01 * 19;
    if (s >= -0.02) return 10 + (s + 0.02) / 0.01 * 24;
    return Math.max(0, 9 + (s + 0.02) / 0.01 * 9);
  }
  function calcMomentum(allTs, summary) {
    if (!nonEmpty(allTs)) return { score: 50, signal: 'NO DATA: Timeseries unavailable (neutral default)', data_available: false, slope: null, acceleration: null, sector_slope_breadth: null };
    var latest = allTs[allTs.length - 1], cur = g(latest, 'slope');
    var slopes = allTs.filter(function (r) { return g(r, 'slope') != null; }).map(function (r) { return r.slope; });
    var sm = slopes.length ? ema(slopes, 3) : [], smoothed = slopes.length ? (sm.length ? sm[sm.length - 1] : cur) : null;
    var eff = smoothed != null ? smoothed : cur, ss = eff != null ? slopeScore(eff) : 50, acc = accelSmoothed(sm);
    var bScore = 50, pos = 0, tot = 0;
    if (nonEmpty(summary)) { tot = summary.length; pos = summary.filter(function (s) { return g(s, 'Slope') != null && s.Slope > 0; }).length; bScore = (pos / tot) * 100; }
    var score = pyRound(Math.min(100, Math.max(0, ss * 0.50 + acc[0] * 0.30 + bScore * 0.20)));
    var st = eff != null ? 'slope=' + pyFmt(eff, 4) : 'slope=N/A', as = acc[2].replace(/_/g, ' ');
    var lbl = score >= 80 ? 'STRONG MOMENTUM' : score >= 60 ? 'POSITIVE MOMENTUM' : score >= 40 ? 'NEUTRAL MOMENTUM' : score >= 20 ? 'WEAK MOMENTUM' : 'NEGATIVE MOMENTUM';
    return { score: score, signal: lbl + ': ' + st + ', ' + as, data_available: true, slope: cur, slope_smoothed: smoothed != null ? pyRound(smoothed, 6) : null,
      slope_smoothing: 'EMA(3)', slope_score: pyRound(ss), acceleration: acc[1], acceleration_label: acc[2], acceleration_score: pyRound(acc[0]),
      acceleration_window: '10v10', sector_positive_slope_count: pos, sector_total: tot, sector_slope_breadth_score: pyRound(bScore), date: g(latest, 'date', 'N/A') };
  }

  function assessConfidence(ratios) {
    var n = ratios.length, size = n >= 1000 ? [3, 'full'] : n >= 500 ? [2, 'moderate'] : n >= 200 ? [1, 'limited'] : [0, 'minimal'];
    var mn = n ? pyMin(ratios) : 0, mx = n ? pyMax(ratios) : 0, bear = mn < 0.10, bull = mx > 0.40;
    var regime = bear && bull ? ['Both', 2] : (bear || bull) ? ['Partial', 1] : ['Narrow', 0];
    var full = mx !== mn ? mx - mn : 1.0, recent = n >= 90 ? ratios.slice(-90) : ratios;
    var rr = recent.length >= 2 ? pyMax(recent) - pyMin(recent) : 0, rec = (full > 0 ? rr / full : 0) >= 0.30 ? ['balanced', 1] : ['biased', 0];
    var total = size[0] + regime[1] + rec[1];
    return { confidence_level: total >= 5 ? 'High' : total >= 3 ? 'Moderate' : total >= 1 ? 'Low' : 'Very Low', confidence_score: total, sample_size: n,
      sample_label: size[1], has_bear_data: bear, has_bull_data: bull, regime_coverage: regime[0], recency_label: rec[0] };
  }
  function calcHistoricalContext(allTs) {
    if (!nonEmpty(allTs)) return { score: 50, signal: 'NO DATA: Historical timeseries unavailable (neutral default)', data_available: false, percentile: null,
      current_ratio: null, historical_min: null, historical_max: null, historical_median: null };
    var ratios = allTs.filter(function (r) { return g(r, 'ratio') != null; }).map(function (r) { return r.ratio; });
    if (ratios.length < 2) return { score: 50, signal: 'INSUFFICIENT DATA: Need at least 2 data points', data_available: false, percentile: null, current_ratio: null, data_points: ratios.length };
    var cur = ratios[ratios.length - 1];
    var below = ratios.filter(function (r) { return r < cur; }).length, eq = ratios.filter(function (r) { return r === cur; }).length;
    var pct = pyRound((below + eq * 0.5) / ratios.length * 100, 1), score = pyRound(Math.min(100, Math.max(0, pct)));
    var s = ratios.slice().sort(function (a, b) { return a - b; }), n = s.length;
    var med = n % 2 === 0 ? (s[n / 2 - 1] + s[n / 2]) / 2 : s[(n - 1) / 2];
    var a30 = avg(ratios.slice(-30)), a90 = avg(ratios.slice(-90)), rp = pyStr(pyRound(cur * 100, 1)), ps = pyStr(pct);
    var lbl = score >= 80 ? 'ABOVE AVERAGE' : score >= 60 ? 'SLIGHTLY ABOVE' : score >= 40 ? 'NEAR MEDIAN' : score >= 20 ? 'BELOW AVERAGE' : 'HISTORICALLY LOW';
    var conf = assessConfidence(ratios), signal = lbl + ': ' + rp + '% at ' + ps + 'th percentile historically';
    if (conf.confidence_level === 'Low' || conf.confidence_level === 'Very Low') signal += ' [confidence: ' + conf.confidence_level + ']';
    return { score: score, signal: signal, data_available: true, percentile: pct, current_ratio: cur, current_ratio_pct: pyRound(cur * 100, 1),
      historical_min: pyRound(s[0], 4), historical_min_pct: pyRound(s[0] * 100, 1), historical_max: pyRound(s[n - 1], 4), historical_max_pct: pyRound(s[n - 1] * 100, 1),
      historical_median: pyRound(med, 4), historical_median_pct: pyRound(med * 100, 1), avg_30d: pyRound(a30, 4), avg_30d_pct: pyRound(a30 * 100, 1),
      avg_90d: pyRound(a90, 4), avg_90d_pct: pyRound(a90 * 100, 1), data_points: ratios.length,
      date_range: g(allTs[0], 'date', '?') + ' to ' + g(allTs[allTs.length - 1], 'date', '?'), confidence: conf };
  }

  /* ───────────── uptrend-analyzer: scorer.py ───────────── */
  var UPTREND_WEIGHTS = { market_breadth: 0.30, sector_participation: 0.25, sector_rotation: 0.15, momentum: 0.20, historical_context: 0.10 };
  var UPTREND_LABELS = { market_breadth: 'Market Breadth (Overall)', sector_participation: 'Sector Participation', sector_rotation: 'Sector Rotation',
    momentum: 'Momentum', historical_context: 'Historical Context' };
  var WARNING_PENALTIES = [['late_cycle', -5], ['high_spread', -3], ['divergence', -3]];
  var WARNING_TEXT = {
    late_cycle: ['LATE CYCLE WARNING', 'Commodity sectors leading both cyclical and defensive groups. Historically associated with late-cycle inflation or sector rotation preceding broader market weakness.'],
    high_spread: ['HIGH SELECTIVITY WARNING', 'Wide spread between strongest and weakest sectors indicates highly selective market. Breadth may be masking narrowing leadership.'],
    divergence: ['SECTOR DIVERGENCE WARNING', 'Significant divergence detected within sector groups. Some sectors within the same group are moving in opposite directions, suggesting hidden risk beneath the averages.']
  };
  function uptrendComposite(scores, availability, flags) {
    availability = availability || {}; flags = flags || {};
    var keys = Object.keys(UPTREND_WEIGHTS), raw = 0.0;
    function sc(k) { return has(scores, k) ? scores[k] : 0; }
    keys.forEach(function (k) { raw += sc(k) * UPTREND_WEIGHTS[k]; });
    raw = pyRound(raw, 1);
    var breakdown = [], pen = 0;
    WARNING_PENALTIES.forEach(function (p) { if (flags[p[0]]) { breakdown.push({ flag: p[0], penalty: p[1] }); pen += p[1]; } });
    if (breakdown.length >= 2) { pen += 1; breakdown.push({ flag: 'multi_warning_discount', penalty: 1 }); }
    var c = pyRound(Math.min(100, Math.max(0, raw + pen)), 1);
    var vkeys = Object.keys(scores).filter(function (k) { return has(UPTREND_WEIGHTS, k); }), valid = {};
    vkeys.forEach(function (k) { valid[k] = scores[k]; });
    var strong = vkeys.length ? argExtreme(valid, vkeys, true) : 'N/A', weak = vkeys.length ? argExtreme(valid, vkeys, false) : 'N/A';
    var zone = c >= 80 ? ['Strong Bull', 'green'] : c >= 60 ? ['Bull', 'light_green'] : c >= 40 ? ['Neutral', 'yellow'] : c >= 20 ? ['Cautious', 'orange'] : ['Bear', 'red'];
    var detail = c >= 80 ? 'Strong Bull' : c >= 70 ? 'Bull-Upper' : c >= 60 ? 'Bull-Lower' : c >= 40 ? 'Neutral' : c >= 30 ? 'Cautious-Upper' : c >= 20 ? 'Cautious-Lower' : 'Bear';
    var nearest = [20, 40, 60, 80].reduce(function (b, x) { return Math.abs(c - x) < Math.abs(c - b) ? x : b; }), dist = c - nearest, at = Math.abs(dist) <= 10;
    var dirn = dist > 0 ? 'above' : dist < 0 ? 'below' : 'at';
    var active = ['late_cycle', 'high_spread', 'divergence'].filter(function (f) { return flags[f]; })
      .map(function (f) { return { flag: f, label: WARNING_TEXT[f][0], description: WARNING_TEXT[f][1] }; });
    var count = keys.filter(function (k) { return has(availability, k) ? availability[k] : true; }).length;
    var missing = keys.filter(function (k) { return !(has(availability, k) ? availability[k] : true); }).map(function (k) { return UPTREND_LABELS[k]; });
    var label = count === keys.length ? 'Complete (' + count + '/' + keys.length + ' components)'
      : count >= keys.length - 1 ? 'Partial (' + count + '/' + keys.length + ' components) - interpret with caution' : 'Limited (' + count + '/' + keys.length + ' components) - low confidence';
    var comps = {};
    keys.forEach(function (k) { comps[k] = { score: sc(k), weight: UPTREND_WEIGHTS[k], weighted_contribution: pyRound(sc(k) * UPTREND_WEIGHTS[k], 1), label: UPTREND_LABELS[k] }; });
    return { composite_score: c, composite_score_raw: raw, warning_penalty: pen, warning_penalty_breakdown: breakdown, zone: zone[0], zone_detail: detail, zone_color: zone[1],
      zone_proximity: { nearest_boundary: nearest, distance: pyRound(dist, 1), at_boundary: at, label: at ? 'Near boundary: ' + pyFmt(dist, 1, true) + ' points from ' + nearest + ' (' + dirn + ')' : '' },
      active_warnings: active,
      strongest_component: { component: strong, label: UPTREND_LABELS[strong] || strong, score: has(valid, strong) ? valid[strong] : 0 },
      weakest_component: { component: weak, label: UPTREND_LABELS[weak] || weak, score: has(valid, weak) ? valid[weak] : 0 },
      data_quality: { available_count: count, total_components: keys.length, label: label, missing_components: missing }, component_scores: comps };
  }

  /** Full uptrend-analyzer run (scoring part of uptrend_analyzer.py main()). */
  function analyzeUptrend(timeseries, sectorSummary) {
    if (!nonEmpty(timeseries)) return null;
    var all = allTimeseries(timeseries), latest = all.length ? all[all.length - 1] : null, secLatest = sectorLatest(timeseries), ct = {};
    Object.keys(secLatest).forEach(function (ws) { ct[WORKSHEET_TO_DISPLAY[ws] || ws] = [g(secLatest[ws], 'count'), g(secLatest[ws], 'total')]; });
    var summary = (sectorSummary || []).map(function (s) {
      var c = ct[s.Sector] || [null, null], o = {};
      Object.keys(s).forEach(function (k) { o[k] = s[k]; });
      o.Count = c[0]; o.Total = c[1];
      return o;
    });
    var c = { market_breadth: calcMarketBreadth(latest), sector_participation: calcSectorParticipation(summary, secLatest),
      sector_rotation: calcSectorRotation(summary, secLatest), momentum: calcMomentum(all, summary), historical_context: calcHistoricalContext(all) };
    var scores = {}, avail = {};
    Object.keys(c).forEach(function (k) { scores[k] = c[k].score; avail[k] = has(c[k], 'data_available') ? c[k].data_available : true; });
    var flags = { late_cycle: g(c.sector_rotation, 'late_cycle_flag', false),
      high_spread: g(c.sector_participation, 'spread') != null && c.sector_participation.spread > 0.40, divergence: g(c.sector_rotation, 'divergence_flag', false) };
    return { as_of: latest ? latest.date : null, sector_summary_used: summary.length ? 'sector_summary.csv' : 'timeseries fallback',
      components: c, warning_flags: flags, composite: uptrendComposite(scores, avail, flags) };
  }

  /* ───────────── exposure-coach: calculate_exposure.py ───────────── */
  var EXPOSURE_WEIGHTS = { regime: 0.25, top_risk: 0.20, breadth: 0.15, uptrend: 0.15, institutional: 0.10, sector: 0.05, theme: 0.05, ftd: 0.05 };
  var CRITICAL = ['regime', 'top_risk', 'breadth'];
  function extractBreadthScore(d) {
    if (d == null) return null;
    if (has(d, 'breadth_score')) return pyInt(d.breadth_score);
    if (has(d, 'composite_score')) return pyInt(d.composite_score);
    if (isObj(d.composite) && has(d.composite, 'composite_score')) return pyInt(d.composite.composite_score);
    if (has(d, 'ad_ratio') && has(d, 'nh_nl_ratio')) {
      var ad = d.ad_ratio, nh = d.nh_nl_ratio;
      return (ad > 1.5 && nh > 3.0) ? 90 : (ad >= 1.0 && nh >= 1.0) ? 65 : (ad >= 0.7 && nh >= 0.5) ? 40 : 20;
    }
    return null;
  }
  function uptrendPctToScore(p) { return p > 50 ? Math.min(100, pyInt(50 + p)) : p >= 35 ? pyInt(35 + p) : p >= 20 ? pyInt(20 + p) : pyInt(p); }
  function extractUptrendScore(d) {
    if (d == null) return null;
    if (has(d, 'uptrend_score')) return pyInt(d.uptrend_score);
    if (isObj(d.composite)) {
      if (has(d.composite, 'composite_score')) return pyInt(d.composite.composite_score);
      if (has(d.composite, 'uptrend_pct')) return uptrendPctToScore(d.composite.uptrend_pct);
    }
    if (has(d, 'uptrend_pct')) return uptrendPctToScore(d.uptrend_pct);
    return null;
  }
  function exposureComposite(scores) {
    var provided = [], missing = [], ws = 0.0, tw = 0.0;
    Object.keys(EXPOSURE_WEIGHTS).forEach(function (k) {
      var s = has(scores, k) ? scores[k] : null;
      if (s != null) { ws += s * EXPOSURE_WEIGHTS[k]; tw += EXPOSURE_WEIGHTS[k]; provided.push(k); } else missing.push(k);
    });
    if (tw === 0) return [50.0, provided, missing];
    var haircut = CRITICAL.filter(function (k) { return missing.indexOf(k) !== -1; }).length * 10;
    return [Math.max(0, ws / tw - haircut), provided, missing];
  }
  function exposureCeiling(c) {
    if (c >= 80) return Math.min(100, pyInt(90 + (c - 80)));
    if (c >= 65) return pyInt(70 + (c - 65) * 1.3);
    if (c >= 50) return pyInt(50 + (c - 50) * 1.3);
    if (c >= 35) return pyInt(30 + (c - 35) * 1.3);
    if (c >= 20) return pyInt(10 + (c - 20) * 1.3);
    return Math.max(0, pyInt(c / 2));
  }
  // Model state codes, kept verbatim for parity. The page shows POSTURE_LABELS, never the code as an instruction.
  function modelState(c, topRisk, missingCritical) {
    if (c < 30) return 'CASH_PRIORITY';
    if (topRisk != null && topRisk < 25) return 'CASH_PRIORITY';
    if (c < 50) return 'REDUCE_ONLY';
    if (topRisk != null && topRisk < 40) return 'REDUCE_ONLY';
    if (missingCritical >= 2) return 'REDUCE_ONLY';
    return 'NEW_ENTRY_ALLOWED';
  }
  var POSTURE_LABELS = { CASH_PRIORITY: 'Defensive', REDUCE_ONLY: 'Cautious', NEW_ENTRY_ALLOWED: 'Constructive' };
  function participation(up, br, sectorData) {
    var ub = up != null && up >= 50, bb = br != null && br >= 50, low = true;
    if (sectorData && has(sectorData, 'dispersion')) low = sectorData.dispersion < 0.15;
    return (ub && bb && low) ? 'BROAD' : ((ub || bb) && low) ? 'MODERATE' : 'NARROW';
  }
  function confidence(provided, missing) {
    var mc = CRITICAL.filter(function (k) { return missing.indexOf(k) !== -1; }).length;
    return (provided.length >= 6 && mc === 0) ? 'HIGH' : (provided.length >= 4 || mc <= 1) ? 'MEDIUM' : 'LOW';
  }
  var INPUT_LABELS = { regime: 'Macro regime', top_risk: 'Market-top risk', breadth: 'Market breadth', uptrend: 'Uptrend participation',
    institutional: 'Institutional flow', sector: 'Sector conditions', theme: 'Theme strength', ftd: 'Follow-through day' };

  /** Posture from the two in-browser analyses (either may be null = fetch failed). */
  function computePosture(breadth, uptrend) {
    var scores = { breadth: extractBreadthScore(breadth), uptrend: extractUptrendScore(uptrend), regime: null, top_risk: null, ftd: null, theme: null, sector: null, institutional: null };
    var r = exposureComposite(scores), composite = r[0], provided = r[1], missing = r[2];
    var mc = CRITICAL.filter(function (k) { return missing.indexOf(k) !== -1; }).length, state = modelState(composite, scores.top_risk, mc);
    var comps = {};
    Object.keys(scores).forEach(function (k) { if (scores[k] != null) comps[k + '_score'] = scores[k]; });
    return { exposure_ceiling_pct: exposureCeiling(composite), participation: participation(scores.uptrend, scores.breadth, null), model_state: state,
      posture: POSTURE_LABELS[state], confidence: confidence(provided, missing), composite_score: pyRound(composite, 1), composite_raw: composite,
      haircut: mc * 10, component_scores: comps, inputs_provided: provided, inputs_missing: missing,
      missing_critical: CRITICAL.filter(function (k) { return missing.indexOf(k) !== -1; }) };
  }

  return {
    version: '1.0.0', SOURCES: SOURCES, INPUT_LABELS: INPUT_LABELS, POSTURE_LABELS: POSTURE_LABELS,
    BREADTH_WEIGHTS: BREADTH_WEIGHTS, BREADTH_LABELS: BREADTH_LABELS, UPTREND_WEIGHTS: UPTREND_WEIGHTS, UPTREND_LABELS: UPTREND_LABELS, EXPOSURE_WEIGHTS: EXPOSURE_WEIGHTS,
    py: { round: pyRound, fmt: pyFmt, str: pyStr, sum: pySum, int: pyInt, float: pyFloat },
    csv: { readDict: readDict },
    breadth: { parseDetailCsv: parseBreadthDetailCsv, parseSummaryCsv: parseBreadthSummaryCsv, levelTrend: calcBreadthLevelTrend, maCrossover: calcMaCrossover,
      cyclePosition: calcCyclePosition, bearishSignal: calcBearishSignal, historicalPercentile: calcHistoricalPercentile, divergence: calcDivergence,
      composite: breadthComposite, analyze: analyzeBreadth },
    uptrend: { parseTimeseriesCsv: parseUptrendTimeseriesCsv, parseSectorSummaryCsv: parseUptrendSectorSummaryCsv, allTimeseries: allTimeseries, sectorLatest: sectorLatest,
      buildSummaryFromTimeseries: buildSummaryFromTimeseries, marketBreadth: calcMarketBreadth, sectorParticipation: calcSectorParticipation,
      sectorRotation: calcSectorRotation, momentum: calcMomentum, historicalContext: calcHistoricalContext, composite: uptrendComposite, analyze: analyzeUptrend },
    exposure: { extractBreadthScore: extractBreadthScore, extractUptrendScore: extractUptrendScore, composite: exposureComposite, ceiling: exposureCeiling,
      modelState: modelState, participation: participation, confidence: confidence, compute: computePosture }
  };
}));
