/*
 * tcc-modal.js — window.RZConvTccModal: the time–current curve view of a protection chain (PRD-CONV-LIVING-PLANT
 * §8.2, phase P5a). It draws what js/conv/tcc.js computes from the engine settings it is given; it computes no
 * setting itself. Styles: css/conv-tcc.css (tokens of css/conv-vfx.css; every curve also has its own dash pattern).
 *
 *   open(spec, { trigger, theme })   theme pins the modal's palette (a dark-only cockpit passes 'dark')
 *     spec = { title, sub, Vref, I:[min,max], t:[min,max],
 *              curves:  [{ id, label, dev, V, em }]          device curves (em = the device that was opened)
 *              damage:  { kva, V, z, label }                 transformer through-fault damage curve (IEEE C57.109)
 *              inrush:  { I, t, label }                      magnetising inrush point
 *              markers: [{ I, label }]                       vertical fault-level markers, amperes at Vref
 *              rows:    [{ downLabel, upLabel, I, td, tu, margin, ok }], margin }   the coordination table
 *   close()   Esc, the close button or the scrim; focus returns to the trigger.  isOpen()
 */
(function (root) {
  'use strict';
  if (!root || !root.document) return;
  var doc = root.document, el = null, last = null, inerted = [];
  var DASH = ['none', '7 3', '2 3', '10 3 2 3'], NSV = 'http://www.w3.org/2000/svg';
  var W = 640, H = 420, ML = 54, MR = 30, MT = 14, MB = 40;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lg(v) { var x = Math.log(v) / Math.LN10, r = Math.round(x); return Math.abs(x - r) < 1e-9 ? r : x; }
  function fmtA(v) { return v >= 1000 ? (v / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' kA' : Math.round(v).toLocaleString('en-US') + ' A'; }
  function fmtT(v) { return v == null ? 'no trip' : (v >= 10 ? v.toFixed(1) : v.toFixed(3)) + ' s'; }

  function plot(spec) {
    var T = root.RZConvTcc, I0 = spec.I[0], I1 = spec.I[1], t0 = spec.t[0], t1 = spec.t[1];
    var pw = W - ML - MR, ph = H - MT - MB;
    function X(I) { return ML + (lg(I) - lg(I0)) / (lg(I1) - lg(I0)) * pw; }
    function Y(t) { return MT + (lg(t1) - lg(t)) / (lg(t1) - lg(t0)) * ph; }
    function inBox(I, t) { return I >= I0 && I <= I1 && t >= t0 && t <= t1; }
    function poly(pts) {
      var d = '', on = false;
      pts.forEach(function (p) {
        if (!inBox(p[0], p[1])) { on = false; return; }
        d += (on ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1) + ' '; on = true;
      });
      return d;
    }
    var g = '';
    /* grid: decades */
    for (var e = Math.ceil(lg(I0)); e <= Math.floor(lg(I1)); e++) {
      var x = X(Math.pow(10, e));
      g += '<line class="tcc-grid" x1="' + x.toFixed(1) + '" y1="' + MT + '" x2="' + x.toFixed(1) + '" y2="' + (MT + ph) + '"/>' +
        '<text class="tcc-ax" x="' + x.toFixed(1) + '" y="' + (MT + ph + 14) + '" text-anchor="middle">' + fmtA(Math.pow(10, e)) + '</text>';
    }
    for (var f = Math.ceil(lg(t0)); f <= Math.floor(lg(t1)); f++) {
      var y = Y(Math.pow(10, f)), tv = Math.pow(10, f);
      g += '<line class="tcc-grid" x1="' + ML + '" y1="' + y.toFixed(1) + '" x2="' + (ML + pw) + '" y2="' + y.toFixed(1) + '"/>' +
        '<text class="tcc-ax" x="' + (ML - 5) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + (tv < 1 ? tv : tv.toLocaleString('en-US')) + ' s</text>';
    }
    g += '<text class="tcc-ax tcc-ax-t" x="' + (ML + pw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">current referred to ' + esc(spec.vLabel) + '</text>';
    var curves = '';
    spec.curves.forEach(function (c, i) {
      var lo = T.refer(I0, spec.Vref, c.V), hi = T.refer(I1, spec.Vref, c.V);
      var pts = T.points(c.dev, lo, hi, 160).map(function (p) { return [T.refer(p[0], c.V, spec.Vref), p[1]]; });
      curves += '<path class="tcc-curve' + (c.em ? ' is-em' : '') + '" data-tcc-curve="' + esc(c.id) + '" style="stroke-dasharray:' + DASH[i % DASH.length] + '" d="' + poly(pts) + '"/>';
    });
    if (spec.damage) {
      var dpts = [], d = spec.damage;
      for (var k = 0; k < 160; k++) { var I = I0 * Math.pow(I1 / I0, k / 159), t = T.txDamage(d.kva, d.V, d.z, I); if (t !== null) dpts.push([I, t]); }
      curves += '<path class="tcc-damage" data-tcc-curve="damage" d="' + poly(dpts) + '"/>';
    }
    if (spec.inrush && inBox(spec.inrush.I, spec.inrush.t)) {
      curves += '<g class="tcc-inrush" data-tcc-curve="inrush"><circle cx="' + X(spec.inrush.I).toFixed(1) + '" cy="' + Y(spec.inrush.t).toFixed(1) + '" r="4"/></g>';
    }
    (spec.markers || []).forEach(function (m, i) {
      if (m.I < I0 || m.I > I1) return;
      var mx = X(m.I).toFixed(1);
      curves += '<g class="tcc-marker" data-tcc-marker="' + i + '"><line x1="' + mx + '" y1="' + MT + '" x2="' + mx + '" y2="' + (MT + ph) + '" style="stroke-dasharray:' + (i ? '6 2 1 2' : '3 3') + '"/></g>';
    });
    return '<svg class="tcc-plot" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc('Time–current curves, ' + spec.title) + '">' +
      '<rect class="tcc-bg" x="' + ML + '" y="' + MT + '" width="' + pw + '" height="' + ph + '"/>' + g + curves + '</svg>';
  }
  function swatch(dash, cls) {
    return '<svg class="tcc-sw" viewBox="0 0 30 10" width="30" height="10" aria-hidden="true"><line class="' + cls + '" x1="1" y1="5" x2="29" y2="5"' + (dash ? ' style="stroke-dasharray:' + dash + '"' : '') + '/></svg>';
  }
  function legend(spec) {
    var h = '<ul class="tcc-legend">';
    spec.curves.forEach(function (c, i) { h += '<li' + (c.em ? ' class="is-em"' : '') + '>' + swatch(DASH[i % DASH.length], 'tcc-curve' + (c.em ? ' is-em' : '')) + esc(c.label) + (c.em ? ' <b>(this device)</b>' : '') + '</li>'; });
    if (spec.damage) h += '<li>' + swatch('', 'tcc-damage') + esc(spec.damage.label) + '</li>';
    if (spec.inrush) h += '<li><svg class="tcc-sw" viewBox="0 0 30 10" width="30" height="10" aria-hidden="true"><circle class="tcc-inrush-dot" cx="15" cy="5" r="4"/></svg>' + esc(spec.inrush.label) + '</li>';
    (spec.markers || []).forEach(function (m, i) { h += '<li>' + swatch(i ? '6 2 1 2' : '3 3', 'tcc-marker-ln') + esc(m.label) + ' — ' + fmtA(m.I) + '</li>'; });
    return h + '</ul>';
  }
  function table(spec) {
    var h = '<table class="tcc-table"><caption>Coordination check at the grading currents (margin needed ≥ ' + spec.margin + ' s)</caption>' +
      '<thead><tr><th scope="col">Pair (downstream → upstream)</th><th scope="col">Current at ' + esc(spec.vLabel) + '</th><th scope="col">Downstream</th><th scope="col">Upstream</th><th scope="col">Margin</th><th scope="col">Result</th></tr></thead><tbody>';
    spec.rows.forEach(function (r) {
      h += '<tr data-tcc-ok="' + (r.ok ? '1' : '0') + '"><td>' + esc(r.downLabel) + ' → ' + esc(r.upLabel) + '</td><td>' + fmtA(r.I) + '</td><td>' + fmtT(r.td) + '</td><td>' + fmtT(r.tu) +
        '</td><td data-tcc-margin="' + (isFinite(r.margin) ? r.margin.toFixed(3) : 'inf') + '">' + (isFinite(r.margin) ? r.margin.toFixed(2) + ' s' : 'upstream does not trip') + '</td><td>' + (r.ok ? 'OK' : 'MISCOORDINATED') + '</td></tr>';
    });
    return h + '</tbody></table>';
  }

  function onKey(ev) {
    if (!el || el.hidden) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); close(); return; }
    if (ev.key !== 'Tab') return;
    var f = [].slice.call(el.querySelectorAll('button,[href],[tabindex="0"]')).filter(function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    var a = doc.activeElement, i = f.indexOf(a);
    if (ev.shiftKey && (i <= 0)) { ev.preventDefault(); f[f.length - 1].focus(); }
    else if (!ev.shiftKey && (i === f.length - 1 || i < 0)) { ev.preventDefault(); f[0].focus(); }
  }
  function open(spec, opts) {
    if (!root.RZConvTcc || !spec) return false;
    if (!el) {
      el = doc.createElement('div');
      el.className = 'tcc-modal'; el.hidden = true;
      if (opts && opts.theme) el.setAttribute('data-theme', opts.theme); el.setAttribute('data-rz-inspector-keep', '');
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'tcc-title');
      el.addEventListener('click', function (ev) { if (ev.target === el) close(); });
      doc.body.appendChild(el);
      doc.addEventListener('keydown', onKey, true);
    }
    last = (opts && opts.trigger) || doc.activeElement;
    el.innerHTML = '<div class="tcc-panel"><div class="tcc-head"><div><div class="tcc-kind">Time–current curves · TRAINING SETTINGS</div>' +
      '<h2 class="tcc-title" id="tcc-title">' + esc(spec.title) + '</h2><p class="tcc-sub">' + esc(spec.sub || '') + '</p></div>' +
      '<button type="button" class="tcc-close" aria-label="Close time–current curves">×</button></div>' +
      '<div class="tcc-body"><div class="tcc-scroll" tabindex="0" aria-label="Time–current plot (scrolls sideways on a narrow screen)">' + plot(spec) + '</div>' + legend(spec) + table(spec) +
      '<p class="tcc-note">Curves are IEC 60255-151 inverse-time stages and an LSIG trip unit computed by js/conv/tcc.js from the engine settings (js/conv-engine.js electrical.pro_*). ' +
      'They are training values by the engine grading rule, not a relay study, and must never be used to set a real relay.</p></div></div>';
    el.querySelector('.tcc-close').addEventListener('click', close);
    inerted = [];
    [].forEach.call(doc.body.children, function (c) {
      if (c === el || /^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/.test(c.tagName) || c.hasAttribute('inert')) return;
      c.setAttribute('inert', ''); inerted.push(c);
    });
    el.hidden = false;
    el.querySelector('.tcc-close').focus();
    return true;
  }
  function close() {
    if (!el || el.hidden) return;
    el.hidden = true;
    inerted.forEach(function (c) { c.removeAttribute('inert'); }); inerted = [];
    var t = last; last = null;
    if (t && t.isConnected && t.focus) { try { t.focus({ preventScroll: true }); } catch (e) { /* best effort */ } }
  }
  function isOpen() { return !!(el && !el.hidden); }

  root.RZConvTccModal = Object.freeze({ open: open, close: close, isOpen: isOpen, version: '1.0.0' });
})(typeof window !== 'undefined' ? window : null);
