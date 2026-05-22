/**
 * Typed wrapper around Cloudflare Workers KV.
 *
 * All values are JSON-serialised on the wire so callers always get parsed
 * objects (or `null` if the key is missing). Each function asserts that `kv`
 * is the live binding — a clear error here is much friendlier than the
 * cryptic "Cannot read properties of undefined (reading 'get')" the Workers
 * runtime would otherwise emit when the binding is misconfigured.
 */

function assertKv(kv) {
  if (!kv || typeof kv.get !== 'function') {
    throw new Error('kv binding is missing — check wrangler.toml kv_namespaces');
  }
}

export async function kvGet(kv, key) {
  assertKv(kv);
  const raw = await kv.get(key);
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function kvPut(kv, key, value, { expirationTtl } = {}) {
  assertKv(kv);
  const opts = expirationTtl ? { expirationTtl } : undefined;
  await kv.put(key, JSON.stringify(value), opts);
}

export async function kvDelete(kv, key) {
  assertKv(kv);
  await kv.delete(key);
}

export async function kvList(kv, { prefix, limit = 1000, cursor } = {}) {
  assertKv(kv);
  return kv.list({ prefix, limit, cursor });
}
