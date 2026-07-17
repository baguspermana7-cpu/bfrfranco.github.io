/**
 * rz-ft-sync.js — sync Finance Terminal per-user data to Supabase (schema v3).
 *
 * Watchlist / portfolio / alerts are kept in localStorage (device) AND, when the user is
 * signed in, mirrored to the shared `app_state` table (keys ft_wl / ft_port / ft_alerts) so
 * they follow the account across devices. Logged out → pure localStorage, unchanged behavior.
 *
 * Contract with the Finance Terminal:
 *   - FT calls `window.rzFtSync.push(lsKey, value)` from its saveLS() after writing localStorage.
 *   - On sign-in (or page load while signed in) this pulls the cloud copy into localStorage and
 *     dispatches `rz-ft-synced` on window; FT reloads S.wl/S.port/S.alerts + re-renders on it.
 * Non-blocking, best-effort, never throws.
 */
(function () {
  'use strict';
  // localStorage key → app_state key
  var KEYS = { 'rz_ft_wl': 'ft_wl', 'rz_ft_port': 'ft_port', 'rz_ft_alerts': 'ft_alerts' };
  var timers = {};

  function supa() { return (window.rzSupa && window.rzSupa.configured) ? window.rzSupa : null; }

  // Lazy-load the shared Supabase client if the page didn't already (absolute /js paths work at
  // the site origin root). No-op if window.rzSupa is present.
  function ensure() {
    if (window.rzSupa) return (window.rzSupa.ready || Promise.resolve());
    if (window.__rzFtSupaLoading) return window.__rzFtSupaLoading;
    window.__rzFtSupaLoading = new Promise(function (resolve) {
      function mod() {
        var m = document.createElement('script'); m.type = 'module'; m.src = '/js/rz-supabase.js?v=2026-07-16';
        m.onload = function () { (window.rzSupa && window.rzSupa.ready ? window.rzSupa.ready : Promise.resolve()).then(function () { resolve(); }); };
        m.onerror = function () { resolve(); };
        document.head.appendChild(m);
      }
      if (window.RZ_CONFIG) { mod(); return; }
      var c = document.createElement('script'); c.src = '/js/rz-config.js?v=2026-07-16';
      c.onload = mod; c.onerror = function () { resolve(); }; document.head.appendChild(c);
    });
    return window.__rzFtSupaLoading;
  }

  // Debounced push of one key's value to the cloud (only when signed in).
  function push(lsKey, value) {
    var appKey = KEYS[lsKey]; if (!appKey) return;
    var s = supa(); if (!s) return;
    clearTimeout(timers[appKey]);
    timers[appKey] = setTimeout(function () {
      s.getUser().then(function (u) { if (u) s.setAppState(appKey, value); }).catch(function () {});
    }, 800);
  }

  // Pull all three from the cloud into localStorage, then tell FT to re-read + re-render.
  function pull() {
    var s = supa(); if (!s) return Promise.resolve(false);
    return s.getUser().then(function (u) {
      if (!u) return false;
      var lsKeys = Object.keys(KEYS);
      return Promise.all(lsKeys.map(function (lsKey) {
        return s.getAppState(KEYS[lsKey]).then(function (r) {
          if (r && r.data != null) { try { localStorage.setItem(lsKey, JSON.stringify(r.data)); } catch (e) {} }
        }).catch(function () {});
      })).then(function () {
        try { window.dispatchEvent(new CustomEvent('rz-ft-synced')); } catch (e) {}
        return true;
      });
    }).catch(function () { return false; });
  }

  window.rzFtSync = { push: push, pull: pull, ensure: ensure };

  // Boot: ensure the client, then pull on load (if signed in) + on every sign-in.
  ensure().then(function () {
    var s = window.rzSupa; if (!s) return;
    (s.ready || Promise.resolve()).then(function () {
      pull();
      if (typeof s.onChange === 'function') s.onChange(function (user) { if (user) pull(); });
    });
  });
})();
