/*
 * history.js — window.RZConvHistory: deterministic point history for the trend system
 * (PRD-CONV-LIVING-PLANT §7, phase P2). The Conventional cockpits are a training simulation: there is no historian.
 * A point's past is therefore a pure function of (point id, minute), so the same minute always returns the same
 * value, on every device and in every gate, and a trend can be shared by URL.
 *
 *   value(def, minute)            def = { id, base, amp, unit, digits, shape }   minute = whole minutes since the epoch
 *                                 shape: 'load' (daily IT-load shape, peak 14:00 UTC+7), 'flat', 'saw' (fill/drain)
 *                                 = base + amp * shape(minute) + amp * 0.12 * noise(id, minute)   (noise in -1..1)
 *   series(def, fromMin, toMin, stepMin)  -> [{ t: ms, v }]  (inclusive of fromMin, exclusive of toMin)
 *   stats(points)                 -> { n, min, max, mean, last }   (null fields on an empty window)
 *   aboveLimit(points, limit)     -> minutes with v > limit, as a share 0..1 of the window
 *   csv(columns)                  columns = [{ label, unit, cls: 'SIM'|'ENGINE', points }] -> text; one row per time
 *   Every series is SIMULATED and must be labelled so by whatever draws it (rz-trend.js does).
 */
(function (root) {
  'use strict';
  var TZ_MIN = 7 * 60, DAY = 1440;
  function isNum(n) { return typeof n === 'number' && isFinite(n); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }
  /* integer hash -> -1..1, stable for (id, minute) */
  function noise(id, minute) {
    var x = (hash(id) ^ Math.imul(minute | 0, 2654435761)) >>> 0;
    x ^= x >>> 16; x = Math.imul(x, 2246822507) >>> 0; x ^= x >>> 13; x = Math.imul(x, 3266489909) >>> 0; x ^= x >>> 16;
    return (x >>> 0) / 2147483647.5 - 1;
  }
  var SHAPES = {
    flat: function () { return 0; },
    /* daily IT-load shape: lowest ~02:00, highest ~14:00 local; -1..1 */
    load: function (m) { var h = ((m + TZ_MIN) % DAY) / 60; return Math.sin((h - 8) / 24 * 2 * Math.PI); },
    /* fill/drain between setpoints, 4 h cycle; -1..1 */
    saw: function (m) { var p = (m % 240) / 240; return p < 0.8 ? 1 - 2.5 * p : -1 + 10 * (p - 0.8); }
  };
  function value(def, minute) {
    if (!def || !isNum(def.base) || !isNum(minute)) return null;
    var amp = isNum(def.amp) ? def.amp : 0, sh = SHAPES[def.shape] || SHAPES.load;
    var v = def.base + amp * sh(minute) + amp * 0.12 * noise(String(def.id || ''), minute);
    var d = isNum(def.digits) ? def.digits : 2, f = Math.pow(10, d + 1);
    return Math.round(v * f) / f;
  }
  function series(def, fromMin, toMin, stepMin) {
    var out = [], step = Math.max(1, stepMin | 0 || 1);
    for (var m = Math.ceil(fromMin / step) * step; m < toMin; m += step) { var v = value(def, m); if (v !== null) out.push({ t: m * 60000, v: v }); }
    return out;
  }
  function stats(points) {
    var n = points ? points.length : 0;
    if (!n) return { n: 0, min: null, max: null, mean: null, last: null };
    var mn = Infinity, mx = -Infinity, sum = 0;
    for (var i = 0; i < n; i++) { var v = points[i].v; if (v < mn) mn = v; if (v > mx) mx = v; sum += v; }
    return { n: n, min: mn, max: mx, mean: sum / n, last: points[n - 1].v };
  }
  function aboveLimit(points, limit) {
    if (!points || !points.length || !isNum(limit)) return null;
    var k = 0; for (var i = 0; i < points.length; i++) if (points[i].v > limit) k++;
    return k / points.length;
  }
  function q(s) { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function csv(columns) {
    var cols = columns || [], times = {}, i, j;
    for (i = 0; i < cols.length; i++) for (j = 0; j < cols[i].points.length; j++) times[cols[i].points[j].t] = 1;
    var ts = Object.keys(times).map(Number).sort(function (a, b) { return a - b; });
    var maps = cols.map(function (c) { var m = {}; c.points.forEach(function (p) { m[p.t] = p.v; }); return m; });
    var lines = [['time (UTC)'].concat(cols.map(function (c) { return q(c.label + (c.unit ? ' [' + c.unit + ']' : '') + ' (' + (c.cls || 'SIM') + ')'); })).join(',')];
    ts.forEach(function (t) { lines.push([new Date(t).toISOString()].concat(maps.map(function (m) { return m[t] == null ? '' : m[t]; })).join(',')); });
    return lines.join('\n') + '\n';
  }
  var API = { value: value, series: series, stats: stats, aboveLimit: aboveLimit, csv: csv, SHAPES: Object.keys(SHAPES), version: '1.0.0' };
  if (root) root.RZConvHistory = Object.freeze(API);
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : null);
