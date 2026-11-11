/**
 * rz-asof.js — P26A: the date of the data behind a figure, and whether it is older than its refresh interval.
 *
 * Source of truth: RZEngine.data.sources[key].asOf (provenance) and RZEngine.data.sourceRefresh (interval per data class,
 * longest prefix wins). Nothing here invents a date: an asOf that does not parse reads "date not recorded".
 *
 * Age is counted from the LATEST month a stamp allows ("2025" -> Dec 2025, "2026-Q1" -> Mar 2026), so "older than N months"
 * is true whatever month inside the stamp the data was read. The clock is the visitor's (untrusted, harmless: it only
 * colours a label); tests inject one.
 *
 * Core (UMD, tools/test-asof.mjs):
 *   parse(asOf)                       -> { label, y, m } | null
 *   policyFor(key, table)             -> { months, reason, prefix } | null
 *   status(key, sources, table, now)  -> { key, label, text, title, stale, ageMonths, months, dated }
 * Browser: <span data-rz-asof="markets"></span> is filled once the engine has loaded; window.rzAsOf.render(el, key).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.rzAsOf = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function parse(asOf) {
    var s = String(asOf == null ? '' : asOf).trim(), r;
    if ((r = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s)) && +r[2] >= 1 && +r[2] <= 12) return { label: MON[+r[2] - 1] + ' ' + r[1], y: +r[1], m: +r[2] };
    if ((r = /^(\d{4})-Q([1-4])$/.exec(s))) return { label: 'Q' + r[2] + ' ' + r[1], y: +r[1], m: +r[2] * 3 };
    if ((r = /^(\d{4})$/.exec(s))) return { label: r[1], y: +r[1], m: 12 };
    return null;
  }
  function policyFor(key, table) {
    var best = null;
    Object.keys(table || {}).forEach(function (p) {
      if ((key === p || key.indexOf(p + '.') === 0) && (!best || p.length > best.prefix.length)) best = { months: table[p].months, reason: table[p].reason, prefix: p };
    });
    return best;
  }
  function nowParts(now) {
    var d = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  }
  function status(key, sources, table, now) {
    var src = (sources || {})[key] || null, pol = policyFor(key, table), p = src ? parse(src.asOf) : null;
    var n = nowParts(now), months = pol ? pol.months : null;
    var age = p ? (n.y * 12 + n.m) - (p.y * 12 + p.m) : null;
    var stale = !!(p && months != null && age > months);
    var label = p ? 'as of ' + p.label : 'date not recorded';
    var text = stale ? label + ' · older than ' + months + ' months' : label;
    var srcName = src ? String(src.short || src.source || '').replace(/\s+/g, ' ').slice(0, 140) : '';
    var title = (srcName ? 'Source: ' + srcName + ', ' : '') + label
      + (months != null ? ', refresh every ' + months + ' months' : '') + (stale ? ', older than ' + months + ' months' : '');
    return { key: key, label: label, text: text, title: title, stale: stale, ageMonths: age, months: months, dated: !!p };
  }
  return { parse: parse, policyFor: policyFor, status: status };
});

/* ===================== browser ===================== */
(function (w, d) {
  'use strict';
  if (!w || !d || !w.rzAsOf || w.rzAsOf.render) return;
  var A = w.rzAsOf;
  // tests pin the clock with window.__rzAsOfNow = '2027-02-01'
  function now() { return w.__rzAsOfNow ? new Date(w.__rzAsOfNow) : new Date(); }
  function render(el, key) {
    var D = w.RZEngine && w.RZEngine.data;
    if (!el || !D || !D.sources) return null;
    var s = A.status(key, D.sources, D.sourceRefresh, now());
    el.textContent = s.text;
    el.title = s.title;
    el.classList.add('rz-asof');
    if (s.stale) el.setAttribute('data-tone', 'warn'); else el.removeAttribute('data-tone');
    el.setAttribute('data-rz-asof-state', s.stale ? 'stale' : s.dated ? 'current' : 'undated');
    return s;
  }
  A.render = render;
  function all() { [].forEach.call(d.querySelectorAll('[data-rz-asof]'), function (el) { render(el, el.getAttribute('data-rz-asof')); }); }
  A.renderAll = all;
  function whenEngine(tries) {
    if (w.RZEngine && w.RZEngine.data && w.RZEngine.data.sources) { all(); return; }
    if (tries > 0) setTimeout(function () { whenEngine(tries - 1); }, 250);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { whenEngine(40); });
  else whenEngine(40);
})(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null);
