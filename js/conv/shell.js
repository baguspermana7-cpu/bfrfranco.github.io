/* shell.js — the one cockpit top bar of the nine Conventional BMS pages (PRD-CONV-EQUIPMENT-TRUTH E7a).
 *
 * Owner, 2026-11-18: "make sure on ALL pages of this BMS the buttons are in the same position."
 * Standard: standarization/SITE_CHROME_STANDARD.md §9. Styles: css/conv-shell.css. Gate: tools/test-conv-shell.mjs.
 *
 * The page marks what it already has; this module builds the bar once and MOVES those elements into fixed slots, so
 * every id, class and listener the page code and the gates rely on keeps working:
 *   data-cv="back|portfolio|title|scope|prd|manual|cta|theme|clock"
 *   data-cv-rest / data-cv-win on the cta  (rest label = accessible name; win label shows on hover / focus)
 * Slot order, left to right: back · portfolio · title (+ scope) · prd · manual · alarm history · CTA · login · theme ·
 * clock. A slot the page cannot fill stays EMPTY at its width, so nothing shifts between pages. Alarm history is
 * injected by js/conv-alarm-workspace.js into the [data-rz-alarm-launch-slot] this module creates; Login by auth.js
 * (#rzAuthWrap, moved here when it appears); the Ask CTA by js/rz-ask.js (decorated when it appears).
 * Below 1101 px Portfolio, PRD, Manual and Alarm history move into one "More" menu (and back when wider).
 * Load it synchronously right after the page's old header block; it needs no other script.
 */
(function () {
  'use strict';
  if (window.__rzConvShell) return;
  window.__rzConvShell = true;

  var SLOTS = ['back', 'portfolio', 'title', 'prd', 'manual', 'alarm', 'cta', 'login', 'theme', 'clock', 'more'];
  var MENU_SLOTS = ['portfolio', 'prd', 'manual', 'alarm'];
  /* on a phone the theme button joins them, so the page title keeps room to be read */
  var PHONE_SLOTS = ['theme'];
  var LABELS = { back: 'Back', portfolio: 'Portfolio', prd: 'PRD', manual: 'Manual' };
  var ICONS = {
    back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    portfolio: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'
  };
  /* visual classes of the nine old bars; functional classes (rz-*-contract, epms-*-link) are kept */
  var STRIP = ['back-btn', 'nav-btn', 'btn', 'top-link', 'tb-link', 'ctrl-btn', 'nav-link', 'portfolio', 'zoom-btn', 'top-btn'];
  var PLANE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>';

  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    return n;
  }
  function svg(path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + path + '</svg>';
  }
  function strip(node) {
    for (var i = 0; i < STRIP.length; i++) node.classList.remove(STRIP[i]);
    node.removeAttribute('style');
  }

  /* ---- build ---------------------------------------------------------------------------------------- */
  var bar = el('header', 'cv-bar', { 'data-cv-shell': '', 'aria-label': 'Cockpit' });
  var inner = el('div', 'cv-bar__in');
  var slot = {};
  for (var i = 0; i < SLOTS.length; i++) {
    slot[SLOTS[i]] = el('div', 'cv-slot cv-slot--' + SLOTS[i], { 'data-cv-slot': SLOTS[i] });
    inner.appendChild(slot[SLOTS[i]]);
  }
  bar.appendChild(inner);

  /* after the skip links, so they stay the first Tab stop */
  var body = document.body, ref = body.firstElementChild;
  while (ref && ref.tagName === 'A' && (ref.classList.contains('skip-link') || ref.id === 'main-content')) ref = ref.nextElementSibling;
  body.insertBefore(bar, ref);

  function adopt(name) { return [].slice.call(document.querySelectorAll('[data-cv="' + name + '"]')).filter(function (n) { return !bar.contains(n); }); }

  /* back / portfolio / prd / manual: one secondary class, one standard content */
  ['back', 'portfolio', 'prd', 'manual'].forEach(function (name) {
    var n = adopt(name)[0];
    if (!n) return;
    strip(n);
    n.classList.add('cv-btn');
    if (ICONS[name]) n.innerHTML = svg(ICONS[name]) + '<span class="cv-btn__txt">' + LABELS[name] + '</span>';
    else if (!n.textContent.trim()) n.textContent = LABELS[name];
    slot[name].appendChild(n);
  });

  adopt('title').forEach(function (n) { n.classList.add('cv-title'); n.removeAttribute('style'); slot.title.appendChild(n); });
  adopt('scope').forEach(function (n) { n.classList.add('cv-scope'); slot.title.appendChild(n); });

  /* alarm history: one launch slot, in the bar */
  [].slice.call(document.querySelectorAll('[data-rz-alarm-launch-slot]')).forEach(function (n) { n.removeAttribute('data-rz-alarm-launch-slot'); });
  slot.alarm.appendChild(el('span', 'rz-conv-alarm-slot', { 'data-rz-alarm-launch-slot': '' }));

  adopt('theme').forEach(function (n) { n.classList.add('cv-icon-btn'); n.removeAttribute('style'); slot.theme.appendChild(n); });
  adopt('clock').forEach(function (n) { slot.clock.appendChild(n); });

  /* ---- the primary CTA -------------------------------------------------------------------------------- */
  function decorate(btn, rest, win) {
    if (!btn || btn.classList.contains('cv-cta')) return;
    strip(btn);
    btn.classList.add('cv-cta');
    btn.setAttribute('aria-label', rest);
    btn.setAttribute('data-cv-primary', '');
    btn.innerHTML = '<span class="cv-cta__face"><span class="cv-cta__labels"><span class="cv-cta__rest"></span>' +
      '<span class="cv-cta__win" aria-hidden="true"></span></span><span class="cv-cta__icon" aria-hidden="true">' + PLANE + '</span></span>';
    btn.querySelector('.cv-cta__rest').textContent = rest;
    btn.querySelector('.cv-cta__win').textContent = win || rest;
  }
  var ctaHost = adopt('cta')[0];
  if (ctaHost) {
    var rest = ctaHost.getAttribute('data-cv-rest') || ctaHost.textContent.trim();
    var win = ctaHost.getAttribute('data-cv-win') || rest;
    slot.cta.appendChild(ctaHost);
    if (ctaHost.tagName === 'BUTTON') decorate(ctaHost, rest, win);
    else {
      /* a slot another module fills (js/rz-ask.js puts its .rz-ask-trigger here) */
      var found = function () { var b = ctaHost.querySelector('button'); if (b) { decorate(b, rest, win); return true; } return false; };
      if (!found() && window.MutationObserver) {
        var mo = new MutationObserver(function () { if (found()) mo.disconnect(); });
        mo.observe(ctaHost, { childList: true, subtree: true });
      }
    }
  }

  /* ---- login: auth.js injects #rzAuthWrap somewhere; it lives in the login slot ------------------------ */
  function takeLogin() {
    var w = document.getElementById('rzAuthWrap');
    if (w && w.parentNode !== slot.login) slot.login.appendChild(w);
    return !!w;
  }
  if (!takeLogin() && window.MutationObserver) {
    var lo = new MutationObserver(function () { if (takeLogin()) lo.disconnect(); });
    lo.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('load', function () { setTimeout(function () { takeLogin(); lo.disconnect(); }, 4000); });
  }

  /* ---- More menu (compact widths) ---------------------------------------------------------------------- */
  var moreBtn = el('button', 'cv-btn cv-more__btn', { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'cvMorePanel', 'aria-haspopup': 'true' });
  moreBtn.innerHTML = '<span class="cv-btn__txt">More</span>';
  slot.more.appendChild(moreBtn);
  var panel = el('div', 'cv-more__panel', { id: 'cvMorePanel', 'aria-label': 'More cockpit actions', role: 'group' });
  panel.hidden = true;
  body.appendChild(panel);

  function openMenu() {
    setTimeout(function () { window.dispatchEvent(new Event('rz-layout-change')); }, 0);
    panel.hidden = false; moreBtn.setAttribute('aria-expanded', 'true');
    var first = panel.querySelector('a, button');
    if (first) first.focus();
  }
  function closeMenu(restore) {
    setTimeout(function () { window.dispatchEvent(new Event('rz-layout-change')); }, 0);
    if (panel.hidden) return;
    panel.hidden = true; moreBtn.setAttribute('aria-expanded', 'false');
    if (restore) moreBtn.focus();
  }
  moreBtn.addEventListener('click', function () { if (panel.hidden) openMenu(); else closeMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) closeMenu(true); });
  document.addEventListener('mousedown', function (e) { if (!panel.hidden && !panel.contains(e.target) && !moreBtn.contains(e.target)) closeMenu(false); });
  panel.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a, button')) closeMenu(false); });

  var mq = window.matchMedia ? window.matchMedia('(max-width: 1100px)') : null;
  var mqPhone = window.matchMedia ? window.matchMedia('(max-width: 600px)') : null;
  function place() {
    var compact = !!(mq && mq.matches), phone = !!(mqPhone && mqPhone.matches);
    MENU_SLOTS.concat(PHONE_SLOTS).forEach(function (name) {
      var folded = PHONE_SLOTS.indexOf(name) >= 0 ? phone : compact;
      var from = folded ? slot[name] : panel, to = folded ? panel : slot[name];
      /* a child a page script added or re-rendered later has no home yet: its own data-cv names it, else the slot it is in */
      [].slice.call(slot[name].children).forEach(function (c) { if (!c.hasAttribute('data-cv-home')) c.setAttribute('data-cv-home', name); });
      [].slice.call(panel.children).forEach(function (c) {
        if (c.hasAttribute('data-cv-home')) return;
        /* auth.js leaves a placeholder span where it lifted a public PRD / Manual link (dc-conventional) */
        var home = c.getAttribute('data-cv') || (/\brz-prd-contract\b/.test(c.className) ? 'prd' : /\brz-manual-contract\b/.test(c.className) ? 'manual' : '');
        if (home) c.setAttribute('data-cv-home', home);
      });
      [].slice.call(from.children).forEach(function (c) {
        if (c.getAttribute('data-cv-home') === name) to.appendChild(c);
      });
    });
    if (!compact) closeMenu(false);
    window.dispatchEvent(new Event('rz-layout-change'));
  }
  /* each moved child remembers its slot */
  MENU_SLOTS.concat(PHONE_SLOTS).forEach(function (name) { [].slice.call(slot[name].children).forEach(function (c) { c.setAttribute('data-cv-home', name); }); });
  place();
  [mq, mqPhone].forEach(function (q) { if (q) { if (q.addEventListener) q.addEventListener('change', place); else if (q.addListener) q.addListener(place); } });

  /* ---- the bar spans the viewport whatever padding or margin the page gives <body> --------------------- */
  function fit() {
    var atTop = !(window.pageYOffset > 0);
    bar.style.marginLeft = bar.style.marginRight = '';
    if (atTop) bar.style.marginTop = '';
    var r = bar.getBoundingClientRect(), w = document.documentElement.clientWidth;
    if (r.left) bar.style.marginLeft = (-r.left) + 'px';
    if (Math.round(w - r.right)) bar.style.marginRight = (-(w - r.right)) + 'px';
    if (atTop && Math.round(r.top)) bar.style.marginTop = (-r.top) + 'px';   /* scrolled, a sticky bar's top says nothing */
  }
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('load', fit);
  /* the alarm launcher (conv-alarm-workspace.js) and auth.js fill their slots after load: place them once more */
  window.addEventListener('load', function () { place(); setTimeout(place, 600); });

  window.RZConvShell = { bar: bar, slot: slot, openMenu: openMenu, closeMenu: closeMenu };
})();
