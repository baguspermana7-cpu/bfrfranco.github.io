/*
 * motion.js — window.RZConvMotion: the shared motion of the eight Conventional BMS pages (PRD-CONV-BMS-MOTION, R183).
 * Rules: standarization/MOTION_STANDARD.md. Every animation here is finite, <= 300 ms per element, on the --rz-ease-*
 * curves, transform + opacity only, and opacity-only under prefers-reduced-motion. Animations carry the id "cvm-…"
 * (Web Animations API) so tools/test-conv-motion.mjs can find them. Process motion (flow, rotors) is js/conv/vfx.js.
 *
 *   swap(el, { stagger })   M4: a panel whose content was just replaced fades in (+ 4 px rise); with stagger, its first
 *                           6 visible children follow 30 ms apart. Returns the animations (or []).
 *   fade(el)                M4: a panel that appears in the same place (view switch, tab): opacity only, 160 ms.
 *   arrive()                M5: once per load, the top-level blocks of the cockpit root enter (240 ms, 40 ms stagger,
 *                           <= 8 blocks, done <= 600 ms). Runs by itself once the cockpit is visible (after the sign-in
 *                           gate clears, <= 20 s after DOMContentLoaded); not on bfcache restore.
 *   byPointer()             true when the last input was a pointer (a keyboard-opened dialog stays instant)
 *   dialogIn(scrim, panel)  M4: a dialog opened by the pointer: scrim fades, panel fades from scale .97, 200 ms
 *   dialogOut(scrim, panel, done)  the way it came, 160 ms, then done(); returns { cancel } for a reopen mid-exit
 *   press                   M3: on the first pointerdown of a control whose own transition list lacks `scale`, the
 *                           list gets `scale 120ms` appended inline, so css/conv-motion.css's press eases.
 */
(function (root) {
  'use strict';
  var doc = root.document;
  if (!doc || root.RZConvMotion) return;

  var EASE = 'cubic-bezier(.23,1,.32,1)';   /* --rz-ease-out; WAAPI cannot read a custom property */
  function reduced() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function canAnimate(el) { return !!(el && el.animate && el.getClientRects && el.getClientRects().length); }

  function run(el, id, delay, dur, rise) {
    if (!canAnimate(el)) return null;
    var red = reduced(), kf = red || !rise
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'translateY(' + rise + 'px)' }, { opacity: 1, transform: 'none' }];
    try {
      var a = el.animate(kf, { duration: red ? Math.min(dur, 160) : dur, delay: red ? 0 : delay, easing: EASE, fill: 'backwards' });
      a.id = id;
      return a;
    } catch (e) { return null; }
  }

  function swap(el, o) {
    if (!canAnimate(el)) return [];
    var out = [], a = run(el, 'cvm-swap', 0, 200, 4);
    if (a) out.push(a);
    if (o && o.stagger && !reduced()) {
      var kids = [].slice.call(el.children).filter(function (k) { return k.getClientRects().length; }).slice(0, 6);
      kids.forEach(function (k, i) { var b = run(k, 'cvm-swap-item', 30 * (i + 1), 200, 4); if (b) out.push(b); });
    }
    return out;
  }
  function fade(el) { var a = run(el, 'cvm-fade', 0, 160, 0); return a ? [a] : []; }

  /* M5 — the blocks of the cockpit root, never the shell bar, never fixed/sticky chrome, never a 1-block wrapper */
  function blocks(rootEl) {
    function list(p) {
      return [].slice.call(p.children).filter(function (k) {
        if (/^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(k.tagName) || k.hasAttribute('hidden')) return false;
        var c = root.getComputedStyle(k); if (c.display === 'none' || c.position === 'fixed' || c.position === 'sticky') return false;
        var r = k.getBoundingClientRect(); return r.width > 40 && r.height > 24 && r.top < root.innerHeight;
      });
    }
    var l = list(rootEl), depth = 0;
    while (l.length < 2 && l.length && depth++ < 4) { var d = list(l[0]); if (!d.length) break; l = d; }   /* a one-block page (fire: one HMI frame) arrives as one block */
    return l.slice(0, 8);
  }
  var arrived = false;
  function arrive() {
    if (arrived) return []; arrived = true;
    var r = doc.querySelector('[data-rz-cockpit-root]'); if (!r) return [];
    var out = [];
    blocks(r).forEach(function (b, i) { var a = run(b, 'cvm-arrive', 40 * i, 240, 6); if (a) out.push(a); });
    return out;
  }

  /* M3 — keep the press easing when a page's own rule replaced the transition list */
  function patchPress(e) {
    var t = e.target && e.target.closest && e.target.closest('button, [role="button"]');
    if (!t || t.__rzCvmPress || t.closest('svg') || !t.closest('[data-rz-cockpit-root]')) return;
    t.__rzCvmPress = true;
    if (reduced()) return;
    var c = root.getComputedStyle(t), props = c.transitionProperty.split(',').map(function (s) { return s.trim(); });
    if (props.indexOf('scale') >= 0 || props.indexOf('all') >= 0 && parseFloat(c.transitionDuration) > 0) return;
    if (props.length === 1 && props[0] === 'all') { t.style.transition = 'scale 120ms ' + EASE; return; }
    var d = c.transitionDuration.split(','), f = c.transitionTimingFunction.match(/cubic-bezier\([^)]*\)|steps\([^)]*\)|[a-z-]+/g) || [], dl = c.transitionDelay.split(',');
    var parts = props.map(function (p, i) { return p + ' ' + d[i % d.length].trim() + ' ' + (f[i % f.length] || 'ease') + ' ' + dl[i % dl.length].trim(); });
    parts.push('scale 120ms ' + EASE);
    t.style.transition = parts.join(', ');
  }
  doc.addEventListener('pointerdown', patchPress, true);

  /* M4 — a dialog (equipment modal) opened or closed by the POINTER: scrim fades, panel fades from scale .97; 200 ms in,
     160 ms out. A keyboard open/close stays instant (MOTION_STANDARD §1), so callers ask byPointer() first. */
  var lastInput = 'key';
  doc.addEventListener('pointerdown', function () { lastInput = 'pointer'; }, true);
  doc.addEventListener('keydown', function () { lastInput = 'key'; }, true);
  function byPointer() { return lastInput === 'pointer'; }
  function dialogKf(red) { return red ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }]; }
  function dialogIn(scrim, panel) {
    var red = reduced(), d = red ? 120 : 200, out = [];
    try {
      if (scrim && scrim.animate) { var a = scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: d, easing: EASE }); a.id = 'cvm-dialog-in'; out.push(a); }
      if (panel && panel.animate) { var b = panel.animate(dialogKf(red), { duration: d, easing: EASE }); b.id = 'cvm-dialog-in'; out.push(b); }
    } catch (e) { /* no WAAPI: instant */ }
    return out;
  }
  function dialogOut(scrim, panel, done) {
    var red = reduced(), d = red ? 120 : 160, anims = [], left = 0, cancelled = false;
    function fin() { if (!cancelled && --left <= 0) done(); }
    try {
      if (scrim && scrim.animate) { var a = scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: d, easing: EASE, fill: 'forwards' }); a.id = 'cvm-dialog-out'; anims.push(a); }
      if (panel && panel.animate) { var b = panel.animate(dialogKf(red).reverse(), { duration: d, easing: EASE, fill: 'forwards' }); b.id = 'cvm-dialog-out'; anims.push(b); }
    } catch (e) { anims = []; }
    if (!anims.length) { done(); return { cancel: function () {} }; }
    if (scrim) scrim.style.pointerEvents = 'none';   /* a closing dialog never eats the next click (the rz-sheet scrim bug, v3.83.0) */
    left = anims.length;
    anims.forEach(function (x) { x.onfinish = function () { fin(); if (left <= 0) anims.forEach(function (y) { y.cancel(); }); }; });   /* hidden first, then the fill goes */
    return { cancel: function () { cancelled = true; anims.forEach(function (x) { x.cancel(); }); if (scrim) scrim.style.pointerEvents = ''; } };
  }

  root.RZConvMotion = { swap: swap, fade: fade, arrive: arrive, byPointer: byPointer, dialogIn: dialogIn, dialogOut: dialogOut, version: '1.0.0' };

  /* the arrival waits until the reader can SEE the cockpit: a Pro page starts behind the sign-in gate (body.locked,
     #rootGate …) and is revealed after the auth check, so "arrived" is that moment, not DOMContentLoaded (<= 20 s) */
  function visible() {
    var r = doc.querySelector('[data-rz-cockpit-root]'); if (!r) return false;
    if (doc.body.classList.contains('locked') || r.closest('[inert]')) return false;
    var g = doc.querySelector('#rootGate, #rzRestrictedOverlay, #rzModalOverlay');
    if (g && g.getClientRects().length && root.getComputedStyle(g).visibility !== 'hidden') return false;
    var b = r.getBoundingClientRect(); return b.height > 0 && b.top < root.innerHeight;
  }
  function boot() {
    if (!root.requestAnimationFrame) { arrive(); return; }
    var t0 = Date.now();
    (function wait() { if (arrived) return; if (visible()) arrive(); else if (Date.now() - t0 < 20000) root.requestAnimationFrame(wait); else arrived = true; })();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
  root.addEventListener('pageshow', function (e) { if (e.persisted) arrived = true; });
})(typeof window !== 'undefined' ? window : this);
