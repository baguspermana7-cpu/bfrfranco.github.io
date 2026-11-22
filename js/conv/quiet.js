/* js/conv/quiet.js — explanation moves into a tooltip (PRD-CONV-BMS-DECLUTTER, owner R185: "masih ada tulisan2 yg tidak
   perlu atau duplicate"). An element marked [data-quiet] is not shown (css/conv-live.css); its text becomes part of the
   title of its host: the closest ancestor matching the attribute's value, else the first element in the page matching it
   (a strip beside it), or its parent when the value is empty. [data-dup] marks a second copy of a reading already shown
   on the same screen: it is not shown and carries no tooltip.
   The element stays in the DOM, so aria-describedby, provenance gates and the scripts that write it keep working;
   when a script rewrites it, the tooltip follows. Gate: tools/test-conv-declutter.mjs (DC3). */
(function () {
  'use strict';
  var seen = typeof WeakMap === 'function' ? new WeakMap() : null;
  function textOf(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function hostOf(el) {
    var sel = el.getAttribute('data-quiet');
    if (!sel) return el.parentElement;
    return (el.parentElement && el.parentElement.closest(sel)) || document.querySelector(sel) || el.parentElement;
  }
  function apply(el) {
    var host = hostOf(el); if (!host) return;
    var prev = seen && seen.get(el), now = textOf(el);
    var parts = (host.getAttribute('title') || '').split('\n').filter(function (s) { return s && s !== prev; });
    if (now && parts.indexOf(now) < 0) parts.push(now);
    if (parts.length) host.setAttribute('title', parts.join('\n')); else host.removeAttribute('title');
    if (seen) seen.set(el, now);
  }
  function init() {
    var els = document.querySelectorAll('[data-quiet]');
    for (var i = 0; i < els.length; i++) {
      apply(els[i]);
      if (typeof MutationObserver === 'function') {
        (function (el) { new MutationObserver(function () { apply(el); }).observe(el, { childList: true, characterData: true, subtree: true }); })(els[i]);
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.RZConvQuiet = { apply: apply, init: init };
})();
