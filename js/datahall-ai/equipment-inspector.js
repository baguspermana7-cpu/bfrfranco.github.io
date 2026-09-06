/* ============================================================================
 * equipment-inspector.js — tier-1 click resolver for datahallAI.html (Track A §A5)
 * ----------------------------------------------------------------------------
 * Single click on any [data-rz-equipment="<classId>:<id>"] block → the right-side
 * inspector with the payload from hmi-payloads.js (review doc-27 §3.2, doc-24 #6/#10).
 * Double-click, Shift+Enter or the inspector's "Open equipment HMI" action → tier 2,
 * the deep mimic, through a NAMED opener in window.RZDatahallAIHmiOpeners.
 * A click on a basis mark keeps its A3 behaviour (basis mode); a pan is not a click.
 *
 * Fails closed: without the engine authority the resolver does nothing and stamps
 * body[data-rz-equipment-inspector="unavailable"]. DOM controller — the numbers live
 * in js/datahall-ai/hmi-payloads.js and are asserted in Node.
 * ==========================================================================*/
(function (win, doc) {
  'use strict';
  if (!win || !doc) { return; }
  var REFRESH_MS = 4000;
  var timer = null, current = null;

  function payloads() { return win.RZDatahallAIHmiPayloads; }
  function inspector() { return win.RZInspector; }
  function openers() { return win.RZDatahallAIHmiOpeners || {}; }

  function parseRef(ref) {
    var i = ref.indexOf(':');
    return i > 0 ? { classId: ref.slice(0, i), id: ref.slice(i + 1) } : { classId: ref, id: '1' };
  }
  function hallOf(el) {
    var t = el;
    while (t && t !== doc.body) {
      if (t.getAttribute) {
        var h = t.getAttribute('data-rz-hall') || t.getAttribute('data-dh') || t.getAttribute('data-hall');
        if (h && /^\d$/.test(String(h).replace(/^dh0?/i, ''))) { return Number(String(h).replace(/^dh0?/i, '')); }
        if (t.id && /^elecDH(\d)Svg$/.test(t.id)) { return Number(RegExp.$1); }
      }
      t = t.parentNode;
    }
    var btn = doc.querySelector('.dh-nav .dh-btn.active[data-dh], .dh-btn.active[data-dh]');
    if (btn) { var v = String(btn.getAttribute('data-dh')).replace(/^dh0?/i, ''); if (/^\d$/.test(v)) { return Number(v); } }
    return 1;
  }
  function context(opts) {
    var P = payloads(); if (!P || !P.buildContext) { return null; }
    return P.buildContext(win, opts || {});
  }
  function build(ref, hall) {
    var P = payloads(), r = parseRef(ref);
    var ctx = context({ hall: hall });
    if (!P || !ctx) { return null; }
    var p = P.safePayload(r.classId, r.id, ctx);
    if (p.unavailable && win.console) { win.console.warn('[equipment-inspector] ' + p.reason); }
    return p;
  }

  function stopRefresh() { if (timer) { win.clearInterval(timer); timer = null; } }
  function startRefresh() {
    stopRefresh();
    timer = win.setInterval(function () {
      var I = inspector();
      if (!current || !I || !I.isOpen() || I.currentPayloadId() !== current.ref) { stopRefresh(); return; }
      var p = build(current.ref, current.hall);
      if (p && !p.unavailable) { I.refreshPayload(p); }
    }, REFRESH_MS);
  }

  function openTier1(el, opts) {
    var I = inspector(); if (!I || !I.openPayload) { return false; }
    var ref = el.getAttribute('data-rz-equipment'), hall = hallOf(el);
    var p = build(ref, hall);
    if (!p || p.unavailable) { return false; }
    current = { ref: ref, hall: hall, el: el };
    doc.querySelectorAll('.rz-equipment-selected').forEach(function (n) { n.classList.remove('rz-equipment-selected'); });
    el.classList.add('rz-equipment-selected');
    I.openPayload(p, { trigger: el, tab: opts && opts.tab, keepFocus: opts && opts.keepFocus,
      onOpenHmi: function (payload, button) { openTier2(payload, button || el); },
      onNavigate: navigate });
    /* a dependency card names a class:id; if a block carries it, select the block, else render the payload alone */
    function navigate(id) {
      var target = doc.querySelector('[data-rz-equipment="' + id + '"]');
      if (target) { openTier1(target, { keepFocus: true }); return; }
      var q = build(id, hall); if (q && !q.unavailable) { current = { ref: id, hall: hall, el: el }; I.openPayload(q, { trigger: el, keepFocus: true, onOpenHmi: function (pp, b) { openTier2(pp, b || el); }, onNavigate: navigate }); }
    }
    startRefresh();
    return true;
  }
  function openTier2(payload, trigger) {
    var a = payload && payload.actions && payload.actions.openHmi;
    if (!a) { return false; }
    var fn = openers()[a.opener];
    if (typeof fn !== 'function') { if (win.console) { win.console.warn('[equipment-inspector] no opener ' + a.opener); } return false; }
    win.__rzLastEquipmentTrigger = trigger || null;
    fn.apply(null, a.args || []);
    return true;
  }
  function equipmentTarget(e) {
    var t = e.target;
    if (!t || !t.closest) { return null; }
    if (t.closest('[data-basis-param]')) { return null; }          /* A3 marks keep basis mode */
    if (t.closest('.rz-inspector, .dh-modal-host, .sld-mimic-overlay, .eq-hmi, .cdu-hmi, .ch-hmi, .ct-hmi, .ircdu-hmi, .crah-hmi, .corr-hmi, .bat-hmi, .rack-modal')) { return null; }
    return t.closest('[data-rz-equipment]');
  }

  function init() {
    if (!payloads() || !inspector()) { return; }
    if (!context()) { doc.body.setAttribute('data-rz-equipment-inspector', 'unavailable'); return; }
    doc.body.setAttribute('data-rz-equipment-inspector', 'ready');
    doc.addEventListener('click', function (e) {
      var el = equipmentTarget(e); if (!el) { return; }
      if (win.__rzSvgPanMoved) { return; }
      if (e.detail >= 2) { return; }                               /* the dblclick listener owns tier 2 */
      e.stopPropagation(); e.preventDefault();
      openTier1(el);
    }, true);
    doc.addEventListener('dblclick', function (e) {
      var el = equipmentTarget(e); if (!el) { return; }
      e.stopPropagation(); e.preventDefault();
      var p = build(el.getAttribute('data-rz-equipment'), hallOf(el));
      if (p && !p.unavailable && !openTier2(p, el)) { openTier1(el); }
    }, true);
    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') { return; }
      var el = e.target && e.target.closest ? e.target.closest('[data-rz-equipment]') : null;
      if (!el || e.target.closest('[data-basis-param]')) { return; }
      e.stopPropagation(); e.preventDefault();
      if (e.shiftKey) { var p = build(el.getAttribute('data-rz-equipment'), hallOf(el)); if (p && !p.unavailable) { openTier2(p, el); } return; }
      openTier1(el);
    }, true);
    doc.addEventListener('contextmenu', function (e) {
      var el = equipmentTarget(e); if (!el || e.target.closest('#sldMimicSvg')) { return; }
      e.preventDefault(); e.stopPropagation();
      openTier1(el, { tab: 'deps' });
    }, true);
    var cool = doc.getElementById('coolingScenario');
    if (cool) { cool.addEventListener('change', function () { if (current) { var p = build(current.ref, current.hall); if (p && !p.unavailable && inspector().isOpen()) { inspector().refreshPayload(p); } } }); }
    var elec = doc.getElementById('electricalScenario');
    if (elec) { elec.addEventListener('change', function () { if (current) { var p = build(current.ref, current.hall); if (p && !p.unavailable && inspector().isOpen()) { inspector().refreshPayload(p); } } }); }
  }

  var API = { version: '2.2.0', init: init, open: function (ref, hall) { var el = doc.querySelector('[data-rz-equipment="' + ref + '"]'); return el ? openTier1(el) : false; }, context: context, build: build, openTier2: openTier2, stopRefresh: stopRefresh };
  win.RZDatahallAIEquipmentInspector = API;
  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', init); } else { init(); }
})(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null);
