// ResistanceZero Service Worker — bumped 2026-05-09 for v1.10.x site state
// Cache-first for static assets, network-first for HTML pages
// CACHE_NAME is auto-synced from js/rz-version.js by tools/sync-sw-version.py

const CACHE_NAME = 'rz-cache-v3.41.0'; // version-aware: invalidates on every site bump

// v1.29.0 — Critical auth/config files that MUST be fetched fresh when online.
// Cached only as offline fallback. Rescues users stranded on a stale SW
// that's serving pre-educator auth.js after a deploy.
// (v1.29.2 — restored after accidental removal in v1.29.1's BMS-cockpit ship.)
const NETWORK_FIRST_PATHS = [
  '/auth.js',
  '/auth.min.js',
  '/js/rz-version.js',
  '/js/rz-feature-flags.js',
  '/js/rz-mobile-nav.js',
  '/js/rz-cookie-consent.js',
  '/js/rz-documentation-ui.js',
  '/js/rz-telemetry-quality.js',
  '/css/rz-cockpit-instrument.css',
  '/css/rz-documentation-ui.css'
];

// Key pages and assets to pre-cache on install
const PRE_CACHE_URLS = [
  '/index.html',
  '/datacenter-solutions.html',
  '/articles.html',
  '/tools.html',
  '/changelog.html',
  '/styles.min.css',
  '/styles-index.min.css',
  '/script.min.js',
  '/auth.js',
  '/rz-engine.js',
  '/js/rz-version.js',
  '/llms.txt',
  '/humans.txt',
  '/sitemap.xml',
  '/robots.txt',
  '/assets/Favicon.png',
  '/assets/favicon-32.png',
  '/assets/profile-photo.jpg',
  '/assets/og/index.webp',
  '/assets/og/articles.webp',
  '/assets/og/datacenter-solutions.webp'
];

// Network-timeout for slow connections — fall back to cache after 2s
const NETWORK_TIMEOUT_MS = 2000;

// Install: pre-cache key resources.
// P25 (v3.36.x): one cache.add per URL under allSettled. cache.addAll is ATOMIC, so one missing
// file used to precache NOTHING while install still reported success. Failures are posted to
// every client as {type:'rz-sw-precache', failed:[...]}; tools/test-sw-precache.mjs keeps the
// list honest before a ship.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(PRE_CACHE_URLS.map((url) =>
        cache.add(url).then(() => null, () => url))))
      .then((results) => {
        const failed = results.map((r) => r.value).filter(Boolean);
        if (failed.length) {
          self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
            clients.forEach((c) => c.postMessage({ type: 'rz-sw-precache', failed: failed }));
          });
        }
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches, then honour the kill switch.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
      .then(() => checkKillSwitch(true))
  );
});

// P25 kill switch: a plain revert cannot evict an installed worker, so /sw-kill.json is the
// rollback. {kill:true} -> delete every cache and unregister. Checked on activate and at most
// hourly on navigation; a fetch error is ignored (offline must not kill the worker).
const KILL_CHECK_MS = 3600 * 1000;
let lastKillCheck = 0;
function checkKillSwitch(force) {
  const now = Date.now();
  if (!force && now - lastKillCheck < KILL_CHECK_MS) return Promise.resolve(false);
  lastKillCheck = now;
  return fetch('/sw-kill.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => {
      if (!body || body.kill !== true) return false;
      return caches.keys()
        .then((names) => Promise.all(names.map((n) => caches.delete(n))))
        .then(() => self.registration.unregister())
        .then(() => true);
    })
    .catch(() => false);
}

// Fetch: route requests to appropriate strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (CDNs, analytics, fonts, etc.)
  if (!request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);

  // Skip Remotion video files (large, network-only)
  if (url.pathname.endsWith('.mp4')) return;

  // v1.29.0 — Critical auth/config files: network-first with cache fallback.
  // Ensures stranded users on a stale SW still get fresh auth.js on next load.
  if (isNetworkFirst(url.pathname)) {
    event.respondWith(networkFirstCriticalAsset(request));
    return;
  }

  // HTML pages: network-first with timeout (content stays fresh)
  if (request.headers.get('accept')?.includes('text/html') ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/' ||
      url.pathname === '') {
    if (request.mode === 'navigate') event.waitUntil(checkKillSwitch(false));
    event.respondWith(networkFirstWithTimeout(request));
    return;
  }

  // Static assets (CSS, JS, images, fonts): cache-first
  event.respondWith(cacheFirst(request));
});

// v1.29.0 — match exact pathnames in NETWORK_FIRST_PATHS
function isNetworkFirst(pathname) {
  for (var i = 0; i < NETWORK_FIRST_PATHS.length; i++) {
    if (pathname === NETWORK_FIRST_PATHS[i]) return true;
  }
  return false;
}

// v1.29.0 — Network-first for critical auth/config files. Updates cache
// on success; falls back to cache only on network failure.
function networkFirstCriticalAsset(request) {
  return fetch(request).then(function (resp) {
    if (resp && resp.ok) {
      var copy = resp.clone();
      caches.open(CACHE_NAME).then(function (c) {
        c.put(request, copy);
      }).catch(function () {});
    }
    return resp;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      if (cached) return cached;
      return new Response('', { status: 408, statusText: 'Request Timeout' });
    });
  });
}

// Network-first with timeout: try network for NETWORK_TIMEOUT_MS, fall back to cache
async function networkFirstWithTimeout(request) {
  const cachePromise = caches.match(request);

  // Race network against timeout
  const networkRace = Promise.race([
    fetch(request).then((response) => {
      // Cache successful responses
      if (response.ok) {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
      }
      return response;
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)
    )
  ]);

  try {
    return await networkRace;
  } catch (error) {
    // Network slow or failed — try cache
    const cached = await cachePromise;
    if (cached) return cached;

    // Try network one more time without timeout (might still arrive)
    try {
      return await fetch(request);
    } catch (e) {
      // Nothing in cache + network dead — return offline page
      const saved = await savedPages();
      return new Response(offlineHTML(saved), {
        status: 503,
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }
}

// Cache-first strategy: try cache, fall back to network
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('', { status: 408, statusText: 'Request Timeout' });
  }
}

// P25: the pages this browser already holds, for the offline page. Titles are read from the
// cached HTML, escaped, and never trusted as markup.
async function savedPages() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const out = [];
    for (const req of keys) {
      const u = new URL(req.url);
      if (u.origin !== self.location.origin || !/\.html$/.test(u.pathname)) continue;
      const res = await cache.match(req);
      const html = res ? await res.text() : '';
      const m = html.match(/<title>([^<]{1,140})<\/title>/i);
      out.push({ href: u.pathname, title: (m ? m[1] : u.pathname).trim() });
    }
    return out.sort((a, b) => a.title.localeCompare(b.title));
  } catch (e) {
    return [];
  }
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Inline offline page — graphite surface, one amber accent (site register, W1 2026-10-31)
function offlineHTML(saved) {
  const list = (saved && saved.length)
    ? '<ul class="saved">' + saved.map((p) => '<li><a href="' + escapeHTML(p.href) + '">' + escapeHTML(p.title) + '</a></li>').join('') + '</ul>'
    : '<p class="none">No pages saved yet. Open a calculator online once.</p>';
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Offline · Resistance Zero</title>' +
    '<style>' +
      'body{font-family:IBM Plex Sans,-apple-system,sans-serif;margin:0;' +
      'background:#0b0c0e;color:#f1f5f9;padding:2rem 1rem}' +
      'main{max-width:560px;margin:0 auto}' +
      'h1{color:#F6F7F9;font-weight:600;font-size:2rem;margin:0 0 1rem;letter-spacing:-0.02em}' +
      'p{color:#cbd5e1;line-height:1.6}' +
      '.saved{list-style:none;padding:0;margin:1rem 0;border-top:1px solid rgba(255,255,255,.12)}' +
      '.saved li{border-bottom:1px solid rgba(255,255,255,.12)}' +
      '.saved a{display:flex;align-items:center;min-height:44px;color:#E8B563;text-decoration:none}' +
      '.saved a:focus-visible{outline:2px solid #E8B563;outline-offset:2px}' +
      '.note{color:#9aa3ad;font-size:.875rem}' +
      '.btn{display:inline-flex;align-items:center;min-height:44px;margin-top:1rem;padding:0 1.5rem;' +
      'background:#E8B563;color:#0b0c0e;border-radius:4px;text-decoration:none;font-weight:600;font-size:0.9rem}' +
    '</style></head><body><main>' +
      '<h1>You are offline</h1>' +
      '<p>This page has not been saved on this device yet.</p>' + list +
      '<p class="note">Pages you open while online are kept for offline use.</p>' +
      '<a class="btn" href="/" onclick="window.location.reload();return false;">Try again</a>' +
    '</main></body></html>';
}
