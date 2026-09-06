/* ============================================================================
 * sim-telemetry.js — deterministic, anchored, DECLARED simulated telemetry
 * ----------------------------------------------------------------------------
 * The HMI modals and the equipment inspector print sensor-class readings the
 * engine does not publish (a bearing temperature, a strainer ΔP, a state of
 * charge). Until v2.2.0 those were die rolls: different on every
 * reload, sometimes rolled over an engine plane, and a coin-flip decided alarm
 * and RUN/STBY state. This module is the ONE source of simulated readings:
 *
 *   value = anchor + band * (0.65 * sin(2π (tick/period + phase)) + 0.35 * noise(bucket))
 *
 *   anchor  — an engine value or a declared rating (the caller states which)
 *   band    — the declared excursion
 *   phase   — fixed per (equipment id, point) from a seeded PRNG
 *   noise   — seeded per (id, point, bucket), so the same tick reproduces the
 *             same value on every reload; ticks advance every TICK_MS
 *
 * Nothing here decides a STATE (RUN/STBY/TRIP/WET) — states come from the
 * scenario engines. `pick()` exists only for cosmetic rotating text.
 * No random call anywhere in this file (gate: tools/test-datahall-ai-hmi-payloads.mjs).
 * ES5, zero-build, window.RZDatahallAISimTelemetry + module.exports.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var TICK_MS = 4000;
  var EPOCH = Date.UTC(2026, 0, 1);

  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    }
    return o;
  }

  /* FNV-1a 32-bit over a string */
  function seed(str) {
    var h = 0x811c9dc5, i, s = String(str);
    for (i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  /* mulberry32 */
  function rng(a) {
    var t = a >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function tickNow(now) {
    if (root && typeof root.__rzSimTick === 'number' && isFinite(root.__rzSimTick)) { return Math.floor(root.__rzSimTick); }
    var t = typeof now === 'number' ? now : Date.now();
    return Math.floor((t - EPOCH) / TICK_MS);
  }

  function finite(x) { return typeof x === 'number' && isFinite(x); }

  /**
   * point({ id, point, anchor, band, tick, period, digits, min, max })
   * anchor and band are numbers; tick an integer; period in ticks (default 15 = 60 s).
   */
  function point(spec) {
    var s = spec || {};
    var id = String(s.id == null ? '' : s.id), name = String(s.point || '');
    var tick = finite(s.tick) ? Math.floor(s.tick) : tickNow();
    var period = finite(s.period) && s.period > 0 ? s.period : 15;
    var bucket = Math.floor(tick / period);
    if (!finite(s.anchor) || !finite(s.band)) {
      return deepFreeze({ value: null, text: '—', anchor: s.anchor, band: s.band, tick: tick, bucket: bucket, quality: 'simulated' });
    }
    var phase = rng(seed(id + '|' + name))();
    var noise = rng((seed(id + '|' + name) ^ (bucket * 2654435761 >>> 0)) >>> 0)() * 2 - 1;
    var v = s.anchor + s.band * (0.65 * Math.sin(2 * Math.PI * (tick / period + phase)) + 0.35 * noise);
    if (finite(s.min)) { v = Math.max(s.min, v); }
    if (finite(s.max)) { v = Math.min(s.max, v); }
    var digits = finite(s.digits) ? s.digits : 1;
    var text = digits === 0 ? String(Math.round(v)) : v.toFixed(digits);
    if (digits === 0 && Math.abs(v) >= 1000) { text = text.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    return deepFreeze({ value: Number(v.toFixed(digits)), text: text, anchor: s.anchor, band: s.band, tick: tick, bucket: bucket, period: period, quality: 'simulated' });
  }

  /** series({...point spec, n}) → values for ticks tick-n+1 .. tick (oldest first) */
  function series(spec) {
    var s = spec || {}, n = finite(s.n) && s.n > 0 ? Math.floor(s.n) : 30;
    var tick = finite(s.tick) ? Math.floor(s.tick) : tickNow();
    var out = [], i, copy;
    for (i = n - 1; i >= 0; i--) {
      copy = {}; Object.keys(s).forEach(function (k) { copy[k] = s[k]; });
      copy.tick = tick - i; delete copy.n;
      out.push(point(copy).value);
    }
    return deepFreeze(out);
  }

  /** Cosmetic rotating text only — never a state. */
  function pick(spec) {
    var s = spec || {}, choices = s.choices || [];
    if (!choices.length) { return null; }
    var tick = finite(s.tick) ? Math.floor(s.tick) : tickNow();
    var period = finite(s.period) && s.period > 0 ? s.period : 45;
    var r = rng((seed(String(s.id) + '|' + String(s.point)) ^ (Math.floor(tick / period) * 2246822519 >>> 0)) >>> 0)();
    return choices[Math.min(choices.length - 1, Math.floor(r * choices.length))];
  }

  /** The declared reason every simulated cell carries (≥ 40 characters by construction). */
  function declare(spec) {
    var s = spec || {};
    var anchor = s.anchorId ? 'the engine plane ' + s.anchorId : ('the page-authored ' + (s.anchorText || 'rating'));
    return 'simulated: ' + (s.point || 'reading') + ' around ' + anchor + ' ±' + (finite(s.band) ? s.band : '?') + (s.unit ? ' ' + s.unit : '')
      + ', seeded per equipment id and 4 s tick, never a field reading (Track A §A5)';
  }

  var API = deepFreeze({ version: '2.2.0', TICK_MS: TICK_MS, EPOCH: EPOCH, tickNow: tickNow, seed: seed, rng: rng, point: point, series: series, pick: pick, declare: declare });
  if (root) { root.RZDatahallAISimTelemetry = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
