/**
 * rz-locations.js — P11: where a prefilled country value comes from, said beside the value.
 *
 * One dataset: RZEngine.data.countries (GENERATED from dcmoc/src/constants/countries.ts; the site and DCMOC read it).
 * No second copy is made here — a data/locations.json would be the very second source P11 exists to remove.
 * That dataset cites its sources once for the whole table (sources.countries), not per value, so every value
 * reads ASSUMED with the dataset name and date. A row only a page carries reads "legacy page value, no source on file".
 *
 * The engine also holds DATA.electricityTariffs, a cited per-country table that DIFFERS from DATA.countries for every
 * country it covers. Which one is right is an owner decision (O-P11); until then the countries value stays in use
 * and the field's title states the cited alternative. Nothing is merged silently.
 *
 * Core (UMD, tools/test-locations.mjs):
 *   field(code, 'energy'|'grid', data, pageValue) -> { value, unit, evidence, text, title }
 *   conflicts(data) -> [{ code, energy:{countries,tariffs}, grid:{countries,tariffs} }]
 * Browser: window.rzLocations.render(el, code, name, pageValue) writes the source line into el.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.rzLocations = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var FIELDS = {
    energy: { unit: '$/kWh', get: function (c) { return c.economy && c.economy.electricityRate; }, tariff: 'rateUsdPerKwh' },
    grid: { unit: 'kgCO2/kWh', get: function (c) { return c.environment && c.environment.gridCarbonIntensity; }, tariff: 'gridCarbonKgCo2PerKwh' }
  };
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function dateLabel(asOf) {
    var r = /^(\d{4})-Q([1-4])$/.exec(String(asOf || ''));
    return r ? 'Q' + r[2] + ' ' + r[1] : String(asOf || 'date not recorded');
  }
  function field(code, name, data, pageValue) {
    var f = FIELDS[name];
    if (!f) throw new Error('rz-locations: unknown field ' + name);
    var out = { value: null, unit: f.unit, evidence: null, text: '', title: '' };
    if (!data || !data.countries) { out.text = 'Location data unavailable — enter the value manually'; return out; }
    var c = data.countries[code], v = c ? num(f.get(c)) : null;
    if (v != null) {
      var src = (data.sources || {}).countries || {};
      out.value = v; out.evidence = 'ASSUMED';
      out.text = 'ASSUMED · DCMOC country reference, as of ' + dateLabel(src.asOf);
      out.title = 'Dataset-level source, no per-value citation: ' + String(src.source || '').replace(/\s+/g, ' ').slice(0, 160);
      var t = (data.electricityTariffs || {})[code], tv = t ? num(t[f.tariff]) : null;
      if (tv != null && tv !== v) out.title += '. Differs from the cited tariff table: ' + tv + ' ' + f.unit + ' (DATA.electricityTariffs, as of ' + ((data.sources || {}).electricityTariffs || {}).asOf + ') — owner decision O-P11';
      return out;
    }
    var pv = num(pageValue);
    if (pv != null) { out.value = pv; out.evidence = 'ASSUMED'; out.text = 'ASSUMED · legacy page value, no source on file'; return out; }
    out.text = 'not available for this country';
    return out;
  }
  function conflicts(data) {
    var rows = [], C = (data && data.countries) || {}, T = (data && data.electricityTariffs) || {};
    Object.keys(T).forEach(function (code) {
      var c = C[code];
      if (!c) return;
      var row = { code: code }, differs = false;
      Object.keys(FIELDS).forEach(function (k) {
        var a = num(FIELDS[k].get(c)), b = num(T[code][FIELDS[k].tariff]);
        row[k] = { countries: a, tariffs: b };
        if (a != null && b != null && a !== b) differs = true;
      });
      if (differs) rows.push(row);
    });
    return rows;
  }
  return { field: field, conflicts: conflicts, FIELDS: Object.keys(FIELDS) };
});

/* ===================== browser ===================== */
(function (w) {
  'use strict';
  if (!w || !w.document || !w.rzLocations || w.rzLocations.render) return;
  var L = w.rzLocations;
  L.render = function (el, code, name, pageValue) {
    if (!el) return null;
    var r = L.field(code, name, w.RZEngine && w.RZEngine.data, pageValue);
    el.textContent = '';
    if (r.evidence) {
      var b = w.document.createElement('b');
      b.className = 'rz-asof'; b.setAttribute('data-tone', 'warn'); b.style.fontWeight = '600';
      b.textContent = r.evidence;
      el.appendChild(b);
    } else el.textContent = r.text;
    // Only the evidence word is visible; the source sentence lives in the tooltip (owner 2026-11-12: less text).
    el.title = r.evidence ? r.text + (r.title ? '. ' + r.title : '') : r.title;
    el.setAttribute('data-rz-loc-evidence', r.evidence || 'none');
    return r;
  };
})(typeof window !== 'undefined' ? window : null);
