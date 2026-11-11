/**
 * rz-handoff.js — the URL hand-off contract between calculators (PRD-P13 Part A).
 *
 * Core (no DOM, also loaded by tools/test-handoff-contract.mjs in Node):
 *   RZHandoff.CONTRACTS.spares          the spares receiver's public parameter contract (a copy of
 *                                       data/calculators.json → spares.handoff; the gate asserts they are equal)
 *   RZHandoff.parse(contract, search)   -> { applied:[{param, value, raw}], ignored:[{param, raw, reason}] }
 *                                          every known param is validated against its type and range; an invalid one
 *                                          is listed with the reason and never applied; unknown params are skipped.
 *   RZHandoff.url(contract, values)     -> 'page.html?p=v&...' for a sender; throws on a value the receiver would ignore
 *   RZHandoff.label(contract, param, value) -> short text for the provenance line ('N+1', 'Tier 3', 'mttr 48 h')
 *
 * Senders never write fields on another page; they only build a URL. The receiver prefills and never locks.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RZHandoff = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SPARES = {
    version: 1,
    page: 'spares-readiness-calculator.html',
    params: [
      { param: 'from', type: 'enum', values: ['tier', 'opex', 'tco', 'roi', 'pue', 'incident'], targets: [],
        labels: { tier: 'Tier Advisor', opex: 'OPEX Calculator', tco: 'TCO Calculator', roi: 'ROI Calculator', pue: 'PUE Calculator', incident: 'incident analysis' } },
      { param: 'tier', type: 'int', min: 1, max: 4, targets: ['c1_redundancy'], transform: 'tier-to-redundancy',
        map: { '1': 'n', '2': 'n1', '3': 'n1', '4': '2n' } },
      { param: 'redundancy', type: 'enum', case: 'lower', values: ['n', 'n1', '2n'], targets: ['c1_redundancy'],
        labels: { n: 'N', n1: 'N+1', '2n': '2N' } },
      { param: 'mtbf', type: 'float', min: 0.1, max: 1000, unit: 'years', targets: ['c1_lambda'], transform: 'reciprocal' },
      { param: 'mttr', type: 'float', min: 1, max: 8760, unit: 'hours', targets: ['mc_mttr'] },
      { param: 'downtimeCostPerHr', type: 'float', min: 1, max: 10000000, unit: 'USD/h', targets: ['mc_downtime_cost', 's_understk_cost'] },
      { param: 'country', type: 'enum', case: 'upper', values: ['US', 'GB', 'DE', 'FR', 'AU', 'IN', 'SG', 'ID', 'JP', 'BR', 'CN', 'MY'],
        targets: ['r_lt_weeks', 's_lt_weeks', 's_carry_rate', 'ltb_carry_rate'] },
      { param: 'itLoad', type: 'float', min: 1, max: 1000000, unit: 'kW', targets: [] },
      { param: 'commodity', type: 'enum', case: 'lower',
        values: ['chiller', 'crac', 'ups', 'switchgear', 'transformer', 'generator', 'pump', 'hx', 'cooling-tower', 'bms', 'fuel', 'fire', 'other'],
        targets: ['c1_commodity'] },
      { param: 'installedBase', type: 'int', min: 1, max: 1000, targets: ['c1_installed', 's_installed_base', 'h_sites'] },
      { param: 'leadTime', type: 'float', min: 1, max: 260, unit: 'weeks', targets: ['r_lt_weeks', 's_lt_weeks', 'h_oem_lt', 'mc_lt_base'] },
      { param: 'unitCost', type: 'float', min: 1, max: 100000000, unit: 'USD', targets: ['s_unit_cost', 'h_unit_cost', 'ltb_unit_cost'] }
    ]
  };

  var INT = /^[+-]?\d+$/, FLOAT = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

  function check(spec, raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (spec.type === 'enum') {
      var v = spec.case === 'upper' ? s.toUpperCase() : spec.case === 'lower' ? s.toLowerCase() : s;
      if (spec.values.indexOf(v) < 0) return { reason: 'not one of ' + spec.values.join(' | ') };
      return { value: v };
    }
    if (!(spec.type === 'int' ? INT : FLOAT).test(s)) return { reason: 'not a ' + (spec.type === 'int' ? 'whole number' : 'number') };
    var n = spec.type === 'int' ? parseInt(s, 10) : parseFloat(s);
    if (!isFinite(n) || n < spec.min || n > spec.max) {
      return { reason: 'out of range ' + spec.min + '–' + spec.max + (spec.unit ? ' ' + spec.unit : '') };
    }
    return { value: n };
  }

  function entries(search) {
    var out = [], q = String(search || '').replace(/^\?/, '');
    if (!q) return out;
    q.split('&').forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf('=');
      var k = i < 0 ? pair : pair.slice(0, i), v = i < 0 ? '' : pair.slice(i + 1);
      try { out.push([decodeURIComponent(k.replace(/\+/g, ' ')), decodeURIComponent(v.replace(/\+/g, ' '))]); }
      catch (e) { out.push([k, v]); }
    });
    return out;
  }

  function parse(contract, search) {
    var bySpec = {}, applied = [], ignored = [], seen = {};
    contract.params.forEach(function (p) { bySpec[p.param] = p; });
    entries(search).forEach(function (kv) {
      var spec = bySpec[kv[0]];
      if (!spec) return;                       // unknown params are ignored (PRD-P13 §11)
      if (seen[kv[0]]) { ignored.push({ param: kv[0], raw: kv[1], reason: 'repeated; the first value is used' }); return; }
      seen[kv[0]] = true;
      var r = check(spec, kv[1]);
      if ('value' in r) applied.push({ param: kv[0], value: r.value, raw: kv[1] });
      else ignored.push({ param: kv[0], raw: kv[1], reason: r.reason });
    });
    return { applied: applied, ignored: ignored };
  }

  function url(contract, values) {
    var parts = [];
    contract.params.forEach(function (p) {
      if (!values || values[p.param] == null) return;
      var r = check(p, values[p.param]);
      if (!('value' in r)) throw new Error('hand-off ' + p.param + '=' + values[p.param] + ' would be ignored: ' + r.reason);
      parts.push(encodeURIComponent(p.param) + '=' + encodeURIComponent(String(r.value)));
    });
    return contract.page + (parts.length ? '?' + parts.join('&') : '');
  }

  var UNIT = { years: 'yr', hours: 'h', weeks: 'wk', 'USD/h': 'USD/h', kW: 'kW', USD: 'USD' };
  function label(contract, param, value) {
    var spec = null;
    contract.params.forEach(function (p) { if (p.param === param) spec = p; });
    if (!spec) return param + ' ' + value;
    if (spec.labels && spec.labels[value] != null) return spec.labels[value];
    if (param === 'tier') return 'Tier ' + value;
    if (spec.type === 'enum') return String(value);
    return param + ' ' + value + (spec.unit ? ' ' + (UNIT[spec.unit] || spec.unit) : '');
  }

  return { CONTRACTS: { spares: SPARES }, parse: parse, url: url, label: label };
});
