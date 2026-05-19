/**
 * KV cache helpers for Cloudflare Workers KV.
 *
 * Stored format: JSON string { d: <data>, t: <epoch ms> }
 *
 * getCached(kv, key, ttlMs, opts?)
 *   Returns { data, stale, ts } on hit, null on miss/expired/corrupt.
 *   opts.allowStale – if true, serve expired entry instead of null.
 *
 * setCached(kv, key, data)
 *   Writes { d: data, t: Date.now() } to KV.
 */

export async function getCached(kv, key, ttlMs, opts = {}) {
  let raw;
  try {
    raw = await kv.get(key);
  } catch {
    return null;
  }

  if (raw == null) return null;

  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!record || typeof record.t !== 'number') return null;

  const age = Date.now() - record.t;

  if (age <= ttlMs) {
    return { data: record.d, stale: false, ts: record.t };
  }

  if (opts.allowStale) {
    return { data: record.d, stale: true, ts: record.t };
  }

  return null;
}

export async function setCached(kv, key, data) {
  await kv.put(key, JSON.stringify({ d: data, t: Date.now() }));
}
