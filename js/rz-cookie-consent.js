/* ============================================================================
   rz-cookie-consent.js — shared cookie-consent engine (v1.53.4)
   Single source of truth for the consent banner. Replaces ~97 per-page inline
   copies (3 divergent variants, one with a broken initial state — the same
   divergence class as the pre-v1.50.23 inline-search incident).

   - Self-injects markup + CSS if absent; ADOPTS legacy #cookieBanner markup
     when a page still carries it (binds by id, normalises the hidden state).
   - One localStorage key: rz_cookie_consent ('accepted' | 'declined').
     Migrates the legacy /id/ key `cookieConsent` on first read.
   - Decline sets window['ga-disable-G-GED7FX8RTV'] = true (the per-page head
     GA-gating snippet reads the same key before GA loads; this covers the
     current session).
   - Dispatches `rz-cookie-consent` CustomEvent so other first-visit features
     (e.g. guided tours) can sequence AFTER the consent decision.
   - Localisable via optional window.RZ_COOKIE_TEXT set before this script:
     { msg, more, accept, decline, policyHref }
   Zero deps, ES5-safe, idempotent (window.__rzCookieConsent guard).
   ============================================================================ */
(function () {
  'use strict';
  if (window.__rzCookieConsent) return;
  window.__rzCookieConsent = true;

  var KEY = 'rz_cookie_consent';
  var LEGACY_KEY = 'cookieConsent';
  var GA_DISABLE = 'ga-disable-G-GED7FX8RTV';

  var T = window.RZ_COOKIE_TEXT || {};
  var TEXT = {
    msg: T.msg || 'We use cookies for analytics to improve your experience.',
    more: T.more || 'Learn more',
    accept: T.accept || 'Accept',
    decline: T.decline || 'Decline',
    policyHref: T.policyHref || 'privacy.html'
  };

  function getConsent() {
    try {
      var v = localStorage.getItem(KEY);
      if (v) return v;
      /* migrate the legacy /id/ key */
      var legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        var norm = legacy === 'accepted' || legacy === 'true' ? 'accepted' : 'declined';
        localStorage.setItem(KEY, norm);
        return norm;
      }
    } catch (e) {}
    return null;
  }

  function setConsent(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
    if (v === 'declined') window[GA_DISABLE] = true;
    try {
      document.dispatchEvent(new CustomEvent('rz-cookie-consent', { detail: v }));
    } catch (e) {
      /* IE-era fallback */
      var ev = document.createEvent('Event');
      ev.initEvent('rz-cookie-consent', true, true);
      ev.rzDetail = v;
      document.dispatchEvent(ev);
    }
  }

  function injectCss() {
    if (document.getElementById('rz-cookie-css')) return;
    var css = [
      '.rz-cookie-banner{position:fixed;bottom:0;left:0;right:0;z-index:100001;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:1rem;padding:.85rem 1.5rem;',
      'background:rgba(255,255,255,.95);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-top:1px solid rgba(0,0,0,.08);box-shadow:0 -2px 16px rgba(0,0,0,.06);',
      'font-size:.85rem;color:#374151;transform:translateY(0);transition:transform .4s cubic-bezier(.4,0,.2,1);}',
      '.rz-cookie-banner.hidden{transform:translateY(100%);pointer-events:none;}',
      '.rz-cookie-banner p{margin:0;}',
      '.rz-cookie-banner a{color:#1d4ed8;text-decoration:underline;text-underline-offset:2px;}',
      '.rz-cookie-actions{display:flex;gap:.5rem;flex-shrink:0;}',
      '.rz-cookie-accept{background:#1d4ed8;color:#fff;border:1px solid #1d4ed8;border-radius:8px;padding:6px 16px;font-size:.8rem;font-weight:600;cursor:pointer;}',
      '.rz-cookie-decline{background:transparent;color:#475569;border:1px solid #cbd5e1;border-radius:8px;padding:6px 16px;font-size:.8rem;font-weight:500;cursor:pointer;}',
      '[data-theme="dark"] .rz-cookie-banner{background:rgba(15,23,42,.95);border-top-color:rgba(255,255,255,.08);color:#cbd5e1;}',
      '[data-theme="dark"] .rz-cookie-banner a{color:#93c5fd;}',
      '[data-theme="dark"] .rz-cookie-decline{color:#94a3b8;border-color:#334155;}',
      '@media (max-width:600px){.rz-cookie-banner{flex-direction:column;gap:.6rem;text-align:center;}}'
    ].join('');
    var s = document.createElement('style');
    s.id = 'rz-cookie-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function buildBanner() {
    var b = document.createElement('div');
    b.id = 'cookieBanner';
    b.className = 'rz-cookie-banner hidden';
    b.setAttribute('role', 'region');
    b.setAttribute('aria-label', 'Cookie notice');
    var p = document.createElement('p');
    p.textContent = TEXT.msg + ' ';
    var a = document.createElement('a');
    a.href = TEXT.policyHref;
    a.textContent = TEXT.more;
    p.appendChild(a);
    var actions = document.createElement('div');
    actions.className = 'rz-cookie-actions';
    var acc = document.createElement('button');
    acc.id = 'cookieAccept';
    acc.className = 'rz-cookie-accept';
    acc.type = 'button';
    acc.textContent = TEXT.accept;
    var dec = document.createElement('button');
    dec.id = 'cookieDecline';
    dec.className = 'rz-cookie-decline';
    dec.type = 'button';
    dec.textContent = TEXT.decline;
    actions.appendChild(acc);
    actions.appendChild(dec);
    b.appendChild(p);
    b.appendChild(actions);
    document.body.appendChild(b);
    return b;
  }

  function init() {
    var consent = getConsent();
    var banner = document.getElementById('cookieBanner');

    if (banner) {
      /* legacy page markup — adopt it: normalise state, keep its look */
      if (!banner.classList.contains('hidden')) banner.classList.add('hidden');
    }

    if (consent) {
      /* decision already made — never show; re-assert GA disable for this session */
      if (consent === 'declined') window[GA_DISABLE] = true;
      return;
    }

    injectCss();
    if (!banner) banner = buildBanner();

    function hide() { banner.classList.add('hidden'); }
    function show() { banner.classList.remove('hidden'); }

    /* bind whichever button variants the page has (legacy or injected) */
    var acc = document.getElementById('cookieAccept') || banner.querySelector('.cookie-accept, .cookie-btn.accept, .rz-cookie-accept');
    var dec = document.getElementById('cookieDecline') || banner.querySelector('.cookie-decline, .cookie-btn.decline, .rz-cookie-decline');
    if (acc) acc.addEventListener('click', function () { setConsent('accepted'); hide(); });
    if (dec) dec.addEventListener('click', function () { setConsent('declined'); hide(); });

    show();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
