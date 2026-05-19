import { getCached, setCached } from './cache.js';
import { fetchFx } from './sources/fx.js';

const FX_CACHE_KEY = 'fx:USD';
const FX_TTL_MS = 60_000;

/**
 * handleFx(env) — fetch USD FX rates with KV cache + stale-on-error fallback.
 *
 * Returns: { data, cached: boolean, stale?: boolean }
 *   - Fresh cache hit: { data, cached: true }
 *   - Live fetch success: { data, cached: false }
 *   - All sources fail + stale entry: { data, cached: true, stale: true }
 *   - All sources fail + no stale: throws
 */
export async function handleFx(env) {
  // Check fresh cache first
  const fresh = await getCached(env.FT_KV, FX_CACHE_KEY, FX_TTL_MS);
  if (fresh && !fresh.stale) {
    return { data: fresh.data, cached: true };
  }

  // Fetch from live sources
  try {
    const data = await fetchFx();
    await setCached(env.FT_KV, FX_CACHE_KEY, data);
    return { data, cached: false };
  } catch (fetchErr) {
    // All sources failed — try stale cache as last resort
    const stale = await getCached(env.FT_KV, FX_CACHE_KEY, FX_TTL_MS, { allowStale: true });
    if (stale) {
      return { data: stale.data, cached: true, stale: true };
    }
    throw fetchErr;
  }
}
