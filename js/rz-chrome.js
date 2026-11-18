/* rz-chrome.js — THE theme switch and bar-slot module (standarization/SITE_CHROME_STANDARD.md).
 *
 * One implementation for every page: a press on [data-rz-theme-toggle] sets <html data-theme>, writes
 * localStorage.theme and dispatches `rz-theme-change` on document; a `storage` event applies the choice made
 * in another tab. The theme before first paint is set by the head snippet that tools/sweep-site-chrome.py
 * stamps — this file never decides the first frame.
 *
 * The click is taken in the capture phase and stopped, so a legacy per-page handler still bound to the old
 * ids (#themeToggle, #navThemeBtn) cannot toggle a second time.
 *
 * Phone (<= 768 px): the bar keeps theme and menu; search and sign-in move into the menu drawer.
 */
(function () {
  'use strict';
  if (window.RZChrome) return;

  var root = document.documentElement;
  var KEY = 'theme';
  var ICONS =
    '<svg class="rz-i-moon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
    '<svg class="rz-i-sun" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  function valid(t) { return t === 'light' || t === 'dark'; }
  function stored() { try { var t = localStorage.getItem(KEY); return valid(t) ? t : null; } catch (e) { return null; } }
  function kindDefault() { return root.getAttribute('data-rz-kind') === 'app' ? 'dark' : 'light'; }
  function get() { var t = root.getAttribute('data-theme'); return valid(t) ? t : (stored() || kindDefault()); }

  function paint() {
    var dark = get() === 'dark';
    var label = dark ? 'Switch to light theme' : 'Switch to dark theme';
    var list = document.querySelectorAll('[data-rz-theme-toggle]');
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (!b.querySelector('svg')) b.innerHTML = ICONS;
      b.setAttribute('aria-label', label);
      b.setAttribute('title', label);
      b.setAttribute('aria-pressed', dark ? 'true' : 'false');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0b0c0e' : '#F5F7FA');
  }

  function apply(t, write) {
    if (!valid(t)) return;
    var changed = root.getAttribute('data-theme') !== t;
    if (changed) root.setAttribute('data-theme', t);
    if (write) { try { localStorage.setItem(KEY, t); } catch (e) { /* storage blocked: the choice lasts for this page */ } }
    paint();
    if (changed) {
      try { document.dispatchEvent(new CustomEvent('rz-theme-change', { detail: { theme: t } })); } catch (e) { /* no CustomEvent */ }
    }
  }

  function set(t) { apply(t, true); }
  function toggle() { set(get() === 'dark' ? 'light' : 'dark'); }

  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-rz-theme-toggle]') : null;
    if (!b) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    toggle();
    /* the stop above also hides this press from "click outside" closers (the account dropdown); give them one
       from the button's container — inside the bar, so the phone drawer stays open */
    try { if (b.parentNode) b.parentNode.dispatchEvent(new MouseEvent('click', { bubbles: true })); } catch (err) { /* old browser: the dropdown closes on the next press */ }
  }, true);

  window.addEventListener('storage', function (e) {
    if (e.key === KEY && valid(e.newValue)) apply(e.newValue, false);
  });

  /* Code that still sets data-theme itself (the command palette) keeps the button's name and state true. */
  try { new MutationObserver(paint).observe(root, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) { /* none */ }

  /* ---- phone: search and sign-in live in the drawer ---- */
  var mq = window.matchMedia ? window.matchMedia('(max-width: 768px)') : null;
  var homes = [];   // { el, mark } — a comment node keeps each slot's place in the bar

  function place() {
    var bar = document.querySelector('[data-rz-bar]');
    if (!bar) return;
    var drawer = bar.querySelector('.nav-links, .nav-menu');
    if (!drawer) return;
    var slots = bar.querySelectorAll('[data-rz-slot="search"], [data-rz-slot="signin"]');
    var i, h;
    for (i = 0; i < slots.length; i++) {
      var known = false;
      for (h = 0; h < homes.length; h++) if (homes[h].el === slots[i]) known = true;
      if (!known && !drawer.contains(slots[i])) {   // a slot the page itself keeps in the drawer has no place in the bar to return to
        var mark = document.createComment('rz-slot');
        slots[i].parentNode.insertBefore(mark, slots[i]);
        homes.push({ el: slots[i], mark: mark });
      }
    }
    var phone = !!(mq && mq.matches);
    for (h = 0; h < homes.length; h++) {
      var el = homes[h].el;
      if (phone && el.parentNode !== drawer) drawer.appendChild(el);
      else if (!phone && el.parentNode === drawer && homes[h].mark.parentNode && homes[h].mark.nextSibling !== el) homes[h].mark.parentNode.insertBefore(el, homes[h].mark.nextSibling);
    }
  }

  /* A press on search inside the open drawer closes the drawer, so the palette is not opened under it. */
  document.addEventListener('click', function (e) {
    if (!document.body || !document.body.classList.contains('rz-nav-open')) return;
    var s = e.target && e.target.closest ? e.target.closest('[data-rz-slot="search"]') : null;
    if (!s) return;
    var burger = document.querySelector('.rz-nav-burger, .rz-nav-burger-bound');
    if (burger) burger.click();
  });

  /* Slot order is theme, then sign-in. auth.js injects its widget next to the menu on the older navs, which
     can land it before the theme button; put the button back in front (DOM order, so Tab order follows). */
  function order() {
    var bar = document.querySelector('[data-rz-bar]');
    if (!bar) return;
    var t = bar.querySelector('[data-rz-theme-toggle]');
    var a = bar.querySelector('.rz-auth-wrap, #rzAuthWrap');
    if (a && !a.hasAttribute('data-rz-slot')) a.setAttribute('data-rz-slot', 'signin');
    /* rz-mobile-nav.js sets the burger's left margin to auto inline, which splits the free space with the brand */
    var g = bar.querySelector('.rz-nav-burger, .rz-nav-burger-bound');
    if (g && g.style.getPropertyValue('margin-left') !== '8px') g.style.setProperty('margin-left', '8px', 'important');
    if (!t || !a) return;
    /* sign-in goes directly after the theme button (so search · theme · sign-in holds whatever auth.js chose);
       on a phone a widget that already sits in the drawer stays there */
    var inDrawer = a.parentNode !== t.parentNode;
    if (t.nextElementSibling !== a && !(inDrawer && mq && mq.matches)) t.parentNode.insertBefore(a, t.nextSibling);
  }

  function init() {
    paint(); order(); place();
    var bar = document.querySelector('[data-rz-bar]');
    if (bar) { try { new MutationObserver(function () { order(); place(); }).observe(bar, { childList: true, subtree: true }); } catch (e) { /* none */ } }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  function relayout() { order(); place(); }
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', relayout); else if (mq.addListener) mq.addListener(relayout); }

  window.RZChrome = { get: get, set: set, toggle: toggle };
})();
