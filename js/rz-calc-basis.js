/* rz-calc-basis.js — PRD-P10: the basis drawer on calculator headline results.
 *
 * A headline cell carries data-basis-param="calc.<calc>.<key>" (plus tabindex="0" role="button" aria-label);
 * js/rz-basis-drawer.js opens the record from js/calc-parameters.js (window.RZ_CALC_PARAMETERS). This file:
 *   - grants the drawer runtime authority only while the registry was generated from the engine data version
 *     the page loaded (a registry built against other engine data is a snapshot of different numbers);
 *   - draws the evidence mark (a 6 px dot after the value, coloured by the record's evidence class) with one
 *     generated stylesheet, so rows rebuilt by innerHTML keep their mark;
 *   - makes hooks inert and hides the mark when the registry did not load;
 *   - RZCalcBasis.set(el, id) / set(el, null) hooks or unhooks a cell whose meaning changes with the page state
 *     (carbon-footprint.html reuses one set of cells for three tabs).
 * ES5, no dependencies.
 */
(function (w, d) {
  'use strict';
  if (w.RZCalcBasis) return;

  function reg() { return w.RZ_CALC_PARAMETERS || null; }
  function record(id) {
    var r = reg();
    if (!r) return null;
    for (var i = 0; i < r.parameters.length; i++) if (r.parameters[i].id === id) return r.parameters[i];
    return null;
  }
  function authority() {
    var r = reg(), E = w.RZEngine;
    return !!(r && E && E.data && String(E.data.version) === String(r.engineDataVersion));
  }
  if (typeof w.RZBasisDrawerAuthority !== 'function') w.RZBasisDrawerAuthority = authority;

  function colour(cls) {
    if (w.RZBasisDrawer && w.RZBasisDrawer.evidenceInfo) return w.RZBasisDrawer.evidenceInfo(cls).color;
    return '#8fa2b8';
  }

  /* A value the page hides from a visitor who is not signed in (class cost-value-hidden: the cell is
     visibility:hidden and shows "—") must not get a mark or open a drawer that prints it. While the class is on,
     the hook is parked in data-rz-basis-gated; when the page reveals the value, the hook comes back. */
  var GATED = 'cost-value-hidden';
  function sync(el) {
    var gated = el.classList.contains(GATED);
    if (gated && el.hasAttribute('data-basis-param')) {
      var id = el.getAttribute('data-basis-param');
      set(el, null);
      el.setAttribute('data-rz-basis-gated', id);
    } else if (!gated && el.hasAttribute('data-rz-basis-gated')) {
      set(el, el.getAttribute('data-rz-basis-gated'));
      el.removeAttribute('data-rz-basis-gated');
    }
  }
  function syncAll(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches('[data-basis-param],[data-rz-basis-gated]')) sync(root);
    var els = root.querySelectorAll('[data-basis-param],[data-rz-basis-gated]');
    for (var i = 0; i < els.length; i++) sync(els[i]);
  }
  function watch() {
    syncAll(d.body);
    if (!w.MutationObserver) return;
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === 'attributes') { if (m.target.hasAttribute('data-basis-param') || m.target.hasAttribute('data-rz-basis-gated')) sync(m.target); }
        else for (var j = 0; j < m.addedNodes.length; j++) syncAll(m.addedNodes[j]);
      }
    }).observe(d.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  }

  function styles() {
    var r = reg();
    if (!r || d.getElementById('rz-calc-basis-css')) return;
    var css = '[data-basis-param]{cursor:pointer}'
      + '[data-basis-param]::after{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;'
      + 'margin-left:6px;vertical-align:middle;background:var(--rz-basis-dot,#8fa2b8)}'
      + '[data-basis-param]:focus-visible{outline:2px solid #E8B563;outline-offset:2px}';
    for (var i = 0; i < r.parameters.length; i++) {
      var p = r.parameters[i];
      css += '[data-basis-param="' + p.id + '"]{--rz-basis-dot:' + colour(p.evidenceClass) + '}';
    }
    var s = d.createElement('style');
    s.id = 'rz-calc-basis-css';
    s.textContent = css;
    d.head.appendChild(s);
  }

  function set(el, id) {
    if (!el) return;
    if (!id) {
      el.removeAttribute('data-basis-param'); el.removeAttribute('tabindex'); el.removeAttribute('role'); el.removeAttribute('aria-label');
      return;
    }
    var p = record(id);
    el.setAttribute('data-basis-param', id);
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'Basis for ' + (p ? p.label : id));
  }

  /* Registry missing: swallow the activation before the drawer's document listener sees it. */
  function inert(e) {
    if (reg()) return;
    var t = e.target && e.target.closest ? e.target.closest('[data-basis-param]') : null;
    if (!t) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.stopImmediatePropagation();
  }
  d.addEventListener('click', inert, true);
  d.addEventListener('keydown', inert, true);

  /* The accessible name carries the current value: a static "Basis for X" would hide the number itself
     from a screen reader, because aria-label replaces the cell's text as its name. */
  d.addEventListener('focusin', function (e) {
    var t = e.target;
    if (!t || !t.getAttribute || !t.getAttribute('data-basis-param')) return;
    var p = record(t.getAttribute('data-basis-param'));
    var v = (t.textContent || '').replace(/\s+/g, ' ').trim();
    t.setAttribute('aria-label', (p ? p.label : 'Result') + (v ? ', ' + v : '') + '. Show basis');
  });

  function init() { styles(); watch(); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();

  w.RZCalcBasis = { set: set, record: record, authority: authority };
})(window, document);
