// ResistanceZero Service Worker — bumped 2026-05-09 for v1.10.x site state
// Cache-first for static assets, network-first for HTML pages
// CACHE_NAME is auto-synced from js/rz-version.js by tools/sync-sw-version.py

const CACHE_NAME = 'rz-cache-v1.50.9'; // version-aware: invalidates on every site bump

// v1.29.0 — Critical auth/config files that MUST be fetched fresh when online.
// Cached only as offline fallback. Rescues users stranded on a stale SW
// that's serving pre-educator auth.js after a deploy.
// (v1.29.2 — restored after accidental removal in v1.29.1's BMS-cockpit ship.)
const NETWORK_FIRST_PATHS = [
  '/auth.js',
  '/auth.min.js',
  '/js/rz-version.js',
  '/js/rz-feature-flags.js'
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

// Install: pre-cache key resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRE_CACHE_URLS).catch(() => {})) // tolerant
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
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
  );
});

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
      return new Response(offlineHTML(), {
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

// Inline offline page — branded, dark, mint accent (matches site v1.4.0)
function offlineHTML() {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Offline · Resistance Zero</title>' +
    '<style>' +
      'body{font-family:Inter,-apple-system,sans-serif;display:flex;align-items:center;' +
      'justify-content:center;min-height:100vh;margin:0;' +
      'background:linear-gradient(180deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%);' +
      'color:#f1f5f9;text-align:center;padding:2rem}' +
      'h1{background:linear-gradient(120deg,#7DDDB4 0%,#fbbf24 100%);' +
      '-webkit-background-clip:text;background-clip:text;color:transparent;' +
      'font-size:2rem;margin-bottom:1rem;letter-spacing:-0.02em}' +
      'p{color:#cbd5e1;max-width:420px;line-height:1.6}' +
      '.btn{display:inline-block;margin-top:1.5rem;padding:0.75rem 1.5rem;' +
      'background:#7DDDB4;color:#0f172a;border-radius:999px;text-decoration:none;' +
      'font-weight:600;font-size:0.9rem}' +
    '</style></head><body><div>' +
      '<h1>You\'re offline</h1>' +
      '<p>This page hasn\'t been cached yet. Reconnect and we\'ll grab it next time.</p>' +
      '<a class="btn" href="/" onclick="window.location.reload();return false;">Try again →</a>' +
    '</div></body></html>';
}
