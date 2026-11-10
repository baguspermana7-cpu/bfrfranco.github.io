/* rz-sw-register.js — P25: register the site service worker so a calculator opened once online
   keeps working offline. One shared module; never inline a registration on a page again.
   Registration waits for load + idle so it never competes with the page's own first paint.
   Guarded: no worker API, or not https/localhost -> nothing happens. Errors -> one console.warn. */
(function () {
  'use strict';
  if (window.__rzSwRegister) return;
  window.__rzSwRegister = true;
  if (!('serviceWorker' in navigator)) return;
  var h = location.hostname;
  var secure = location.protocol === 'https:' || h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  if (!secure) return;
  function register() {
    navigator.serviceWorker.register('/sw.js').catch(function (err) {
      console.warn('[rz-sw] service worker not registered: ' + (err && err.message ? err.message : err));
    });
  }
  function idle() {
    if ('requestIdleCallback' in window) window.requestIdleCallback(register, { timeout: 4000 });
    else setTimeout(register, 1);
  }
  navigator.serviceWorker.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'rz-sw-precache' && e.data.failed && e.data.failed.length) {
      console.warn('[rz-sw] precache failed for: ' + e.data.failed.join(', '));
    }
  });
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle);
})();
