// Tiny KV cache wrapper. Stores JSON with a per-entry `cachedAt` field so
// clients can show data-freshness; KV's own TTL handles expiration.

export async function cacheGet(kv, key) {
  if (!kv) return null;
  try {
    const raw = await kv.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export async function cachePut(kv, key, value, ttlSec) {
  if (!kv) return;
  try {
    const wrapped = { cachedAt: Date.now(), data: value };
    await kv.put(key, JSON.stringify(wrapped), {
      expirationTtl: Math.max(60, ttlSec | 0), // KV minimum is 60s
    });
  } catch (_) {
    // KV write failures are non-fatal — endpoint still returns fresh data.
  }
}

// Convenience: returns the cached `data` payload (or null) and a freshness
// flag the endpoint can echo to the client.
export async function getOrFetch(kv, key, ttlSec, fetcher) {
  const hit = await cacheGet(kv, key);
  if (hit && hit.data) {
    const ageMs = Date.now() - (hit.cachedAt || 0);
    if (ageMs < ttlSec * 1000) {
      return { data: hit.data, source: "cache", ageMs };
    }
  }
  const fresh = await fetcher();
  await cachePut(kv, key, fresh, ttlSec);
  return { data: fresh, source: "origin", ageMs: 0 };
}
