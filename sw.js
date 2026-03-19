// ResistanceZero Service Worker v1
// Cache-first for static assets, network-first for HTML pages

const CACHE_NAME = 'rz-cache-v1';

// Key pages and assets to pre-cache on install
const PRE_CACHE_URLS = [
  '/index.html',
  '/datacenter-solutions.html',
  '/articles.html',
  '/styles.min.css',
  '/script.min.js',
  '/auth.js',
  '/assets/Favicon.png',
  '/assets/profile-photo.jpg'
];

// Install: pre-cache key resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRE_CACHE_URLS))
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

  // HTML pages: network-first (content stays fresh)
  if (request.headers.get('accept')?.includes('text/html') ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/' ||
      url.pathname === '') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (CSS, JS, images, fonts): cache-first
  event.respondWith(cacheFirst(request));
});

// Network-first strategy: try network, fall back to cache
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    // Cache successful responses for offline use
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Nothing in cache either — return a basic offline message
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline - ResistanceZero</title><style>body{font-family:Inter,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#e2e8f0;text-align:center;padding:2rem}h1{color:#06b6d4;margin-bottom:1rem}p{color:#94a3b8;max-width:400px}</style></head><body><div><h1>You are offline</h1><p>This page has not been cached yet. Please check your connection and try again.</p></div></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
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
