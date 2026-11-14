/*
 * rz-pue-measured.js — the "Measured" mode of pue-calculator.html (R120 step 3a, owner R125 2026-11-14).
 *
 * PUE from 12 months of metered energy (or peak kW for category 0), every energy type that crosses the data center
 * boundary weighted by its source-energy factor, IT energy at the category's meter point. All arithmetic is
 * RZEngine.models.pue.measured (Data Center Metrics Task Force v2, Tables 1-2); this file only reads inputs and
 * writes results. A refused input shows the engine's reason and no number.
 * Gate: tools/test-pue-measured.mjs (browser) + tools/test-pue-reference.mjs (engine).
 */
(function () {
  'use strict';
  if (window.__rzPueMeasured) return;
  window.__rzPueMeasured = true;

  var KEYS = ['electricity', 'naturalGas', 'fuelOil', 'otherFuels', 'districtChilledWater', 'districtHotWater',
    'districtSteam', 'condenserWater'];
  var $ = function (id) { return document.getElementById(id); };
  var nf = function (v) { return Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }); };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function engine() {
    var E = window.RZEngine;
    return E && E.models && E.models.pue && typeof E.models.pue.measured === 'function' ? E : null;
  }

  function setMode(on) {
    var bench = $('pmBench'), est = $('pmEstimateBench');
    if (!bench || !est) return;
    bench.hidden = !on;
    est.hidden = on;
    // the charts and the "What drives this result" panel explain the estimate, not the measurement
    var extra = document.querySelectorAll('.charts-section, details.rz-sens');
    for (var i = 0; i < extra.length; i++) extra[i].hidden = on;
    [['btnMeasured', on], ['btnEstimate', !on]].forEach(function (p) {
      var b = $(p[0]);
      if (b) b.setAttribute('aria-selected', String(p[1]));
    });
    if (on) { rows(); run(); }
  }

  function rows() {
    var E = engine(), sel = $('pmAdd');
    if (!E || !sel) return;
    var W = E.data.pueSourceWeights, html = '<option value="">Choose…</option>';
    KEYS.forEach(function (k) {
      var el = $('pm-' + k), g = el && el.closest('.input-group');
      if (!g) return;
      var f = g.querySelector('[data-pm-f]');
      if (f) f.textContent = '× ' + W[k].factor.toFixed(2);
      var show = k === 'electricity' || Number(el.value) > 0 || g.getAttribute('data-added') === '1';
      g.hidden = !show;
      if (!show) html += '<option value="' + k + '">' + esc(W[k].label) + ' (× ' + W[k].factor.toFixed(2) + ')</option>';
    });
    sel.innerHTML = html;
    $('pmAddWrap').hidden = sel.options.length < 2;
  }

  function run() {
    var E = engine();
    if (!E || $('pmBench').hidden) return;
    var W = E.data.pueSourceWeights, C = E.data.pueCategories;
    var cat = Number($('pmCat').value), c = C[cat], peak = cat === 0;
    var unit = peak ? 'kW, peak' : 'kWh, 12 months', u = peak ? ' kW' : ' kWh';
    $('pmItLabel').textContent = 'IT ' + (peak ? 'demand' : 'energy') + ' at ' + c.itMeter + ' (' + unit + ')';
    var units = document.querySelectorAll('[data-pm-unit]');
    for (var i = 0; i < units.length; i++) units[i].textContent = '(' + unit + ')';

    var energy = {};
    KEYS.forEach(function (k) { var el = $('pm-' + k); energy[k] = el.value === '' ? 0 : Number(el.value); });
    var it = Number($('pmIt').value);
    var r = E.models.pue.measured(peak ? { category: 0, itKw: it, energy: energy } : { category: cat, itKwh: it, energy: energy });

    var err = $('pmErr');
    err.hidden = r.ok;
    err.textContent = r.ok ? '' : r.reason;
    $('pmLabel').innerHTML = 'PUE<sub>' + cat + '</sub>';
    $('pmPue').textContent = r.ok ? r.pue.toFixed(3) : '—';
    $('pmMeter').textContent = 'IT metered at ' + c.itMeter + ' · ' + c.basis;

    var h = '';
    if (r.ok) {
      KEYS.forEach(function (k) {
        if (!(energy[k] > 0)) return;
        h += '<div class="metric-box"><div class="metric-label">' + esc(W[k].label) + '</div><div class="metric-value">' +
          nf(r.weighted[k]) + u + '</div><div class="metric-note">' + nf(energy[k]) + u + ' × ' + W[k].factor.toFixed(2) + '</div></div>';
      });
      h += '<div class="metric-box"><div class="metric-label">Total, weighted</div><div class="metric-value">' + nf(r.total) + u +
        '</div><div class="metric-note">over IT ' + nf(it) + u + '</div></div>';
    }
    $('pmRows').innerHTML = h;

    var est = parseFloat(($('pueValue') || {}).textContent);
    $('pmEst').textContent = est > 0 ? est.toFixed(2) : '—';
    $('pmDiff').textContent = r.ok && est > 0
      ? 'measured is ' + (r.pue >= est ? 'above' : 'below') + ' the estimate by ' + Math.abs(r.pue - est).toFixed(2) : '';
  }

  function init() {
    if (!$('pmBench')) return;
    $('btnMeasured').addEventListener('click', function () { setMode(true); });
    $('btnEstimate').addEventListener('click', function () { setMode(false); });
    var bench = $('pmBench');
    bench.addEventListener('input', run);
    bench.addEventListener('change', function (e) {
      if (e.target.id === 'pmAdd' && e.target.value) {
        var el = $('pm-' + e.target.value);
        el.closest('.input-group').setAttribute('data-added', '1');
        rows();
        el.focus();
      }
      run();
    });
    window.rzPueMeasured = { setMode: setMode, run: run };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
