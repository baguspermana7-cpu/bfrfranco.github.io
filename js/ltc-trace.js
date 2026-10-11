/* ltc-trace.js — hover trace and live tooltip for workbench diagrams.
 *
 * Hover (or focus) a block: the block and every connector touching it stay; everything else
 * fades, so the path the block sits on reads at a glance (the DCMOC pattern, ported to vanilla
 * on top of RZDiagram's markup). A tooltip shows the block's live numbers and how the headline
 * one is computed. Click still opens the inspector through LTC.draw's onSelect.
 *
 * Contract with the page: connectors carry `id: 'from>to'` (RZDiagram writes it as
 * data-rzd-edge), so connectivity is read from the drawing itself, never from a second list
 * that could drift from it. `getTips()` returns { nodeId: { title, rows:[[k,v]], formula } }.
 */
(function (root) {
  'use strict';
  var tipEl = null;
  function tip() {
    if (tipEl) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'ltc-tip';
    tipEl.setAttribute('role', 'tooltip');
    tipEl.hidden = true;
    document.body.appendChild(tipEl);
    return tipEl;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function show(t, x, y) {
    var el = tip();
    el.innerHTML = '<div class="ltc-tip-h">' + esc(t.title) + '</div>' +
      (t.rows && t.rows.length ? '<dl>' + t.rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' : '') +
      (t.formula ? '<div class="ltc-tip-f">ƒx ' + esc(t.formula) + '</div>' : '') +
      (t.note ? '<div class="ltc-tip-n">' + esc(t.note) + '</div>' : '');
    el.hidden = false;
    var w = el.offsetWidth, h = el.offsetHeight, vw = root.innerWidth, vh = root.innerHeight;
    var left = x + 14 + w > vw - 8 ? x - w - 14 : x + 14;
    var top = y + 14 + h > vh - 8 ? Math.max(8, y - h - 14) : y + 14;
    el.style.left = Math.max(8, left) + 'px';
    el.style.top = top + 'px';
  }
  function hide() { if (tipEl) tipEl.hidden = true; }

  function attach(el, getTips) {
    if (!el) return;
    function svg() { return el.querySelector('svg'); }
    var lastId = null;
    function clear() {
      lastId = null;
      var s = svg(); if (!s) return;
      s.classList.remove('is-tracing');
      [].forEach.call(s.querySelectorAll('[data-trace]'), function (n) { n.removeAttribute('data-trace'); });
      hide();
    }
    function trace(id, x, y) {
      var s = svg(); if (!s) return;
      var tips0 = getTips ? getTips() : {};
      // same block as last move: only follow the pointer, do not restart the fade (it flickered)
      if (id === lastId) { if (tips0[id]) show(tips0[id], x, y); return; }
      clear();
      lastId = id;
      var near = {}; near[id] = 1;
      [].forEach.call(s.querySelectorAll('path[data-rzd-edge]'), function (p) {
        var ends = (p.getAttribute('data-rzd-edge') || '').split('>');
        if (ends[0] === id || ends[1] === id) {
          p.setAttribute('data-trace', '1');
          var bead = s.querySelector('path[data-rzd-pulse="' + p.getAttribute('data-rzd-edge') + '"]');
          if (bead) bead.setAttribute('data-trace', '1');
          near[ends[0]] = 1; near[ends[1]] = 1;
        }
      });
      Object.keys(near).forEach(function (n) {
        var r = s.querySelector('[data-rzd-node="' + n + '"]');
        if (r) r.setAttribute('data-trace', n === id ? 'self' : '1');
      });
      s.classList.add('is-tracing');
      var tips = getTips ? getTips() : {};
      if (tips[id]) show(tips[id], x, y);
    }
    el.addEventListener('pointermove', function (e) {
      var t = e.target.closest && e.target.closest('[data-rzd-hit]');
      if (!t) { clear(); return; }
      trace(t.getAttribute('data-rzd-hit'), e.clientX, e.clientY);
    });
    el.addEventListener('pointerleave', clear);
    el.addEventListener('focusin', function (e) {
      var t = e.target.closest && e.target.closest('[data-rzd-hit]');
      if (!t) return;
      var b = t.getBoundingClientRect();
      trace(t.getAttribute('data-rzd-hit'), b.right, b.top);
    });
    el.addEventListener('focusout', clear);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') clear(); });
  }

  root.LTCTrace = { attach: attach, hide: hide, show: show };
})(window);
