/* ltc-lab-steps.js — the LTC modelling lab as a seven-step thread.
 *
 * Owner 2026-11-07: "sempurnakan workflownya agar mudah dipakai tapi tetap sangat accurate dan comprehensive …
 * yang saat ini masih membingungkan." Plan: ~/.claude/plans/ltc-lab-workflow.md.
 *
 * Progressive enhancement over the workbench js/ltc-lab-ui.js builds: it replaces the static "1 Set design →
 * 2 Review → 3 Tune" hint with a navigable rail whose every step shows ITS OWN result, read from the result ids
 * the engine already writes. Nothing here computes; the engine and every id are untouched, so
 * tools/test-ltc-lab-golden.mjs stays green by construction. Without this script the page is unchanged.
 *
 *   - selecting a step outlines its equipment on the plant diagram (rect[data-rzd-node]) and, for Check/Review,
 *     opens the matching dashboard tab;
 *   - a changed result shows the previous value struck through for 1.6 s (reduced motion: no fade);
 *   - while the model recomputes after an input change, steps show a "stale" ring until the results update;
 *   - #step=n in the URL; Alt+←/→ move between steps (keyboard moves are not animated).
 */
(function () {
  'use strict';
  if (window.__ltcSteps) return;
  window.__ltcSteps = true;

  var STEPS = [
    { key: 'load', name: 'Load', nodes: ['racks', 'grid', 'ups'],
      result: function (t) { return v('inItLoad') + ' MW IT · ' + t('outDesignDensity'); } },
    { key: 'capture', name: 'Capture', nodes: ['racks', 'cdu'],
      result: function (t) { return t('outLiquidLoad') + ' liquid · ' + t('outAirLoad') + ' air'; } },
    { key: 'loop', name: 'Loop', nodes: ['cdu', 'cool'],
      result: function (t) { return t('outFlow') + ' · ' + t('outPump') + ' pumps'; } },
    { key: 'rejection', name: 'Rejection', nodes: ['cool', 'crah', 'chiller', 'tower', 'elec'],
      result: function (t) { return 'PUE ' + t('outPue') + ' · COP ' + t('outCop'); } },
    { key: 'cost', name: 'Cost · carbon', nodes: [],
      result: function (t) { return t('outNetOpex') + ' · ' + t('outCarbon'); } },
    { key: 'check', name: 'Check', nodes: [], tab: /chart/i,
      result: function (t) { return t('quickConstraintState') || 'targets and limits'; } },
    { key: 'review', name: 'Review', nodes: [], tab: /report/i,
      result: function () { var s = document.getElementById('scenarioSelect'); var o = s && s.options[s.selectedIndex];
        return o && o.value ? 'scenario ' + o.textContent.trim() : 'not saved yet'; } }
  ];

  function v(id) { var e = document.getElementById(id); return e ? String(e.value) : '–'; }
  function txt(id) { var e = document.getElementById(id); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var active = 0, items = [], lastText = [];

  function build(guide) {
    var nav = document.createElement('nav');
    nav.className = 'ltc-steps';
    nav.setAttribute('aria-label', 'Model steps');
    var ol = document.createElement('ol');
    STEPS.forEach(function (s, i) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ltc-step';
      b.id = 'ltcStep-' + s.key;
      b.innerHTML = '<span class="ltc-step-n">' + (i + 1) + '</span><span class="ltc-step-name"></span>' +
        '<span class="ltc-step-res" aria-live="polite"></span>';
      b.querySelector('.ltc-step-name').textContent = s.name;
      b.addEventListener('click', function () { select(i, true); });
      li.appendChild(b);
      ol.appendChild(li);
      items.push(b);
    });
    nav.appendChild(ol);
    guide.parentNode.replaceChild(nav, guide);
  }

  function openTab(re) {
    var tabs = document.querySelectorAll('[role="tab"], .ltc-tab, [data-tab]');
    for (var i = 0; i < tabs.length; i++) {
      if (re.test(tabs[i].textContent)) { tabs[i].click(); return tabs[i]; }
    }
    return null;
  }

  function select(i, fromUser) {
    active = Math.max(0, Math.min(STEPS.length - 1, i));
    var s = STEPS[active];
    items.forEach(function (b, k) {
      if (k === active) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.classList.toggle('is-done', k < active);
    });
    document.body.setAttribute('data-ltc-step', s.key);
    paintNodes();
    drawStrip();
    if (fromUser) {
      try { history.replaceState(null, '', '#step=' + (active + 1)); } catch (e) {}
      if (s.tab) { var t = openTab(s.tab); if (t && t.scrollIntoView) t.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }); }
    }
  }

  /* the plant diagram is redrawn on every model run, so the outline is re-applied after each redraw */
  function paintNodes() {
    var keys = STEPS[active].nodes;
    document.querySelectorAll('rect[data-rzd-node]').forEach(function (r) {
      r.classList.toggle('ltc-step-node', keys.indexOf(r.getAttribute('data-rzd-node')) >= 0);
    });
  }


  /* Arithmetic strip: the active step's equations, from the engine's own trace table (plant.trace, formulas written
   * in js/ltc-plant.js). Where an identity can be recomputed from the engine's own numbers, the values are substituted
   * and the line is marked "holds" only if the recomputation lands within 1e-6 (relative) of the engine value — the identities are exact in floating point; otherwise the
   * engine formula and value are shown as they are. Nothing here feeds back into the model. */
  var CP = 4.186, RHO = 997, G = 9.81;
  function n0(x, d) { return Number(x).toLocaleString('en-US', { maximumFractionDigits: d === undefined ? 0 : d }); }
  function within(a, b) { return isFinite(a) && isFinite(b) && Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-6); }
  var LINES = {
    capture: function (r) {
      var it = r.it.kw, cap = r.input.capturePct;
      return [['liquidIt', n0(it) + ' kW × ' + n0(cap, 1) + ' %', it * cap / 100, r.liquid.itKw, 'kW'],
              ['airIt', n0(it) + ' kW × (1 − ' + n0(cap, 1) + ' %)', it * (1 - cap / 100), r.air.itKw, 'kW']];
    },
    loop: function (r) {
      var q = r.liquid, dt = q.tcsDeltaK;
      var lpsCalc = q.itKw / (CP * dt) / RHO * 1000;
      var pumpCalc = RHO * G * r.input.tcsHeadM * (q.tcsLps / 1000) / 1000 / r.input.tcsPumpEff;
      return [['tcsLps', n0(q.itKw) + ' kW ÷ (' + CP + ' × ' + n0(dt, 1) + ' K) ÷ ' + RHO + ' × 1000', lpsCalc, q.tcsLps, 'L/s'],
              ['tcsPumpKw', RHO + ' × ' + G + ' × ' + n0(r.input.tcsHeadM, 1) + ' m × ' + n0(q.tcsLps / 1000, 3) + ' m³/s ÷ ' + n0(r.input.tcsPumpEff, 2), pumpCalc, q.tcsPumpKw, 'kW'],
              ['cduPerHall', null, null, q.cduPerHall, '']];
    },
    rejection: function (r) {
      return [['coolerLeaving', null, null, r.liquid.coolerLeavingC, '°C'], ['chillerCop', null, null, r.air.chillerCop, ''],
              ['pue', n0(r.totals.facilityKw) + ' kW ÷ ' + n0(r.it.kw) + ' kW', r.totals.facilityKw / r.it.kw, r.totals.pue, ''],
              ['pueAnnual', null, null, r.totals.pueAnnual, '']];
    },
    cost: function (r) {
      var A = r.annual;
      return [[null, n0(A.m0MWh) + ' MWh × 1000 × $' + n0(r.input.elecPrice, 3) + '/kWh', A.m0MWh * 1000 * r.input.elecPrice, A.energyCost, 'USD/yr', 'Energy cost'],
              [null, n0(A.waterM3) + ' m³ × $' + n0(r.input.waterTariff, 2) + '/m³', A.waterM3 * r.input.waterTariff, A.waterCost, 'USD/yr', 'Water cost']];
    }
  };
  var strip;
  function drawStrip() {
    if (!strip) return;
    var m = window.__ltcLastModel, r = m && m.plant, f = LINES[STEPS[active].key];
    if (!r || !f) { strip.hidden = true; return; }
    var rows = [];
    try { rows = f(r); } catch (e) { strip.hidden = true; return; }
    var tr = r.trace || {};
    strip.hidden = false;
    strip.innerHTML = '';
    var h = document.createElement('div');
    h.className = 'ltc-arith-head';
    h.textContent = (active + 1) + ' · ' + STEPS[active].name + ' — how the numbers are made';
    strip.appendChild(h);
    rows.forEach(function (row) {
      var t = row[0] ? tr[row[0]] : null, label = t ? t.label : row[5], formula = t ? t.formula : '';
      var engine = row[3], unit = row[4], sub = row[1], calc = row[2];
      var line = document.createElement('div');
      line.className = 'ltc-arith-row';
      var holds = sub && within(calc, engine);
      var val = n0(engine, Math.abs(engine) < 10 ? 3 : Math.abs(engine) < 1000 ? 1 : 0) + (unit ? ' ' + unit : '');
      line.innerHTML = '<span class="ltc-arith-l"></span><span class="ltc-arith-f"></span><span class="ltc-arith-v"></span><span class="ltc-arith-s"></span>';
      line.children[0].textContent = label || '';
      line.children[1].textContent = holds ? (formula ? formula + ' → ' : '') + sub + ' = ' + val : (formula || '') + (sub && !holds ? '' : '');
      line.children[2].textContent = holds ? '' : val;
      line.children[3].textContent = holds ? 'holds' : sub ? 'engine value' : 'engine';
      if (holds) line.classList.add('is-holds');
      strip.appendChild(line);
    });
  }

  function refresh() {
    paintNodes();
    drawStrip();
    STEPS.forEach(function (s, i) {
      var b = items[i]; if (!b) return;
      var res = b.querySelector('.ltc-step-res');
      var now = s.result(txt);
      if (lastText[i] !== undefined && lastText[i] !== now && !reduce) {
        res.setAttribute('data-was', lastText[i]);
        b.classList.add('is-changed');
        clearTimeout(b.__t);
        b.__t = setTimeout(function () { b.classList.remove('is-changed'); res.removeAttribute('data-was'); }, 1600);
      }
      lastText[i] = now;
      res.textContent = now;
      b.classList.remove('is-stale');
    });
  }

  function watch() {
    var ids = ['outDesignDensity', 'outLiquidLoad', 'outAirLoad', 'outFlow', 'outPump', 'outPue', 'outCop', 'outNetOpex', 'outCarbon',
      'quickConstraintState'];
    var mo = new MutationObserver(function () { clearTimeout(watch.t); watch.t = setTimeout(refresh, 60); });
    ids.forEach(function (id) {
      var e = document.getElementById(id);
      if (e) mo.observe(e, { childList: true, characterData: true, subtree: true });
    });
    var ov = document.querySelector('.ltc-overview-card');
    if (ov) new MutationObserver(function () { clearTimeout(watch.p); watch.p = setTimeout(paintNodes, 30); })
      .observe(ov, { childList: true, subtree: true });
    document.addEventListener('input', function (ev) {
      if (!ev.target || !ev.target.closest || !ev.target.closest('.ltc-left-rail, .calc-input-panel')) return;
      items.forEach(function (b) { b.classList.add('is-stale'); });
    }, true);
    document.addEventListener('keydown', function (ev) {
      if (!ev.altKey || (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft')) return;
      ev.preventDefault();
      select(active + (ev.key === 'ArrowRight' ? 1 : -1), true);
      if (items[active]) items[active].focus();
    });
  }

  function start() {
    var guide = document.querySelector('.ltc-flow-guide');
    if (!guide) return false;
    build(guide);
    var kpi = document.getElementById('ltcKpiStrip');
    if (kpi && kpi.parentNode) { strip = document.createElement('div'); strip.className = 'ltc-arith'; strip.setAttribute('aria-live', 'polite'); kpi.parentNode.insertBefore(strip, kpi.nextSibling); }
    var m = /step=(\d)/.exec(location.hash);
    select(m ? +m[1] - 1 : 0, false);
    refresh();
    watch();
    return true;
  }

  function boot() {
    if (start()) return;
    var tries = 0;
    var mo = new MutationObserver(function () {
      if (start() || ++tries > 400) mo.disconnect();
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
