/**
 * rz-supabase.js — shared Supabase client + helpers for resistancezero.com.
 *
 * ES module. Loads supabase-js from CDN, reads window.RZ_CONFIG (see js/rz-config.js),
 * and exposes a small stable API on `window.rzSupa`. Auth + per-user data (profiles,
 * saved scenarios) with Row Level Security. Degrades gracefully: if config is missing
 * or the DB tables don't exist yet, calls resolve to friendly errors instead of throwing.
 *
 * ISOLATION: this module does NOT touch localStorage.rz_premium_session — the site's
 * existing hardcoded login (auth.js) is left completely alone. Bridging Supabase login
 * into the sitewide Pro-gating is a separate, later step (plan B4).
 *
 * Usage (classic pages):
 *   <script src="js/rz-config.js"></script>
 *   <script type="module" src="js/rz-supabase.js"></script>
 *   // then: await window.rzSupa.ready; const u = await rzSupa.getUser();
 */
// Pinned to an exact version (auth-critical library — avoid silently loading a new patch).
// Bump intentionally when upgrading.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.2/+esm';

const cfg = (typeof window !== 'undefined' && window.RZ_CONFIG) || {};
const URL = cfg.SUPABASE_URL || '';
const ANON = cfg.SUPABASE_ANON || '';

// Transient-network resilience (v1.127.x): a flaky resolver / NAT64 path can make a
// single fetch REJECT (TypeError — DNS/connection blip) or return a transient
// 502/503/504 from the edge. Retry just those, a few times with short backoff, so one
// blip does not surface as a hard login failure ("NetworkError when attempting to fetch
// resource"). Real answers — any 2xx and every 4xx incl. 400 invalid_credentials — return
// immediately and are NEVER retried. We only retry when no response reached the origin
// (thrown reject) or the gateway itself failed (502/503/504), so a POST is not double-applied.
let _rzFetchN = 0;
function _rzDelay(i) {
  var base = 200 * (i + 1);            // 200ms, 400ms
  var jitter = (_rzFetchN++ % 5) * 30; // 0..120ms, deterministic (no Math.random)
  return new Promise(function (r) { setTimeout(r, base + jitter); });
}
async function rzFetch(input, init) {
  var attempts = 3, lastErr = null;
  for (var i = 0; i < attempts; i++) {
    try {
      var res = await fetch(input, init);
      if (i < attempts - 1 && (res.status === 502 || res.status === 503 || res.status === 504)) {
        await _rzDelay(i); continue;
      }
      return res;
    } catch (e) {
      lastErr = e;                     // network reject — origin almost certainly never saw it
      if (i < attempts - 1) { await _rzDelay(i); continue; }
      throw e;
    }
  }
  throw lastErr;
}

let client = null;
let initError = null;
try {
  if (URL && ANON) client = createClient(URL, ANON, { global: { fetch: rzFetch } });
  else initError = 'RZ_CONFIG missing SUPABASE_URL / SUPABASE_ANON (load js/rz-config.js first)';
} catch (e) {
  initError = 'Supabase init failed: ' + (e && e.message || e);
}

/** Normalize a Supabase error/table-missing into a friendly, non-throwing shape. */
function friendly(error) {
  if (!error) return null;
  const msg = error.message || String(error);
  if (/relation .* does not exist|Could not find the table|schema cache/i.test(msg))
    return 'Database not set up yet — run supabase/schema.sql in the Supabase SQL Editor.';
  if (/networkerror|failed to fetch|load failed|network request failed|fetch failed/i.test(msg))
    return 'Koneksi ke server auth gagal sesaat (jaringan/DNS). Coba lagi — atau setel DNS perangkat ke 1.1.1.1.';
  return msg;
}

const api = {
  /** Truthy when the client is ready; falsy (+ .error) when config/init failed. */
  client,
  configured: !!client,
  error: initError,

  /** @returns the current user object or null. */
  async getUser() {
    if (!client) return null;
    const { data } = await client.auth.getUser();
    return (data && data.user) || null;
  },

  /** @returns the current session or null. */
  async getSession() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return (data && data.session) || null;
  },

  /** Subscribe to auth state changes. cb(user|null). Returns an unsubscribe function. */
  onChange(cb) {
    if (!client) return () => {};
    const { data } = client.auth.onAuthStateChange((_evt, session) => {
      cb((session && session.user) || null);
    });
    return () => { try { data.subscription.unsubscribe(); } catch (e) {} };
  },

  /* ── Auth ── */
  async signUp(email, password) {
    if (!client) return { error: initError };
    const { data, error } = await client.auth.signUp({ email, password });
    return { data, error: friendly(error) };
  },
  async signIn(email, password) {
    if (!client) return { error: initError };
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    return { data, error: friendly(error) };
  },
  async signInOAuth(provider, redirectTo) {
    if (!client) return { error: initError };
    const { data, error } = await client.auth.signInWithOAuth({
      provider, options: redirectTo ? { redirectTo } : undefined
    });
    return { data, error: friendly(error) };
  },
  async signOut() {
    if (!client) return { error: initError };
    const { error } = await client.auth.signOut();
    return { error: friendly(error) };
  },
  /** Self-service password change for the signed-in user (Supabase Auth). */
  async changePassword(newPassword) {
    if (!client) return { error: initError };
    const user = await this.getUser();
    if (!user) return { error: 'not signed in' };
    const { data, error } = await client.auth.updateUser({ password: newPassword });
    return { data, error: friendly(error) };
  },

  /* ── Profile (tier lives here; RLS = own row only) ── */
  async getProfile() {
    if (!client) return { data: null, error: initError };
    const user = await this.getUser();
    if (!user) return { data: null, error: 'not signed in' };
    // Pin the column list (don't select('*')) so a future column can't be exposed unintentionally.
    const { data, error } = await client.from('profiles').select('id, email, tier, display_name, created_at').eq('id', user.id).maybeSingle();
    return { data, error: friendly(error) };
  },

  /* ── Saved scenarios (per-user data; RLS = own rows only) ── */
  async saveScenario(calc, name, payload) {
    if (!client) return { error: initError };
    const user = await this.getUser();
    if (!user) return { error: 'Silakan login dulu untuk menyimpan.' };
    const { data, error } = await client.from('saved_scenarios')
      .insert({ user_id: user.id, calc, name, payload }).select().single();
    return { data, error: friendly(error) };
  },
  async listScenarios(calc) {
    if (!client) return { data: [], error: initError };
    const user = await this.getUser();
    if (!user) return { data: [], error: 'not signed in' };
    // .eq('user_id') is defense-in-depth — RLS is the primary guard, but never rely on it alone.
    let q = client.from('saved_scenarios').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (calc) q = q.eq('calc', calc);
    const { data, error } = await q;
    return { data: data || [], error: friendly(error) };
  },
  async deleteScenario(id) {
    if (!client) return { error: initError };
    const user = await this.getUser();
    if (!user) return { error: 'not signed in' };
    // scope the delete to the caller's own rows (defense-in-depth alongside RLS)
    const { error } = await client.from('saved_scenarios').delete().eq('id', id).eq('user_id', user.id);
    return { error: friendly(error) };
  },

  /* ── DCMOC cloud projects (Arc-4, 2026-07-20). localStorage stays PRIMARY in
   *    the DCMOC app; cloud = optional logged-in backup. bundle cap 256 KB DB-side
   *    (client pre-guards at 240 KB). Share = client-generated 32-byte base64url
   *    token; anon read ONLY via the get_shared_project() RPC (no table SELECT). ── */
  async saveDcmocProject(id, name, bundle) {
    if (!client) return { error: initError };
    const user = await this.getUser();
    if (!user) return { error: 'Silakan login dulu untuk menyimpan ke cloud.' };
    if (id) {
      const { data, error } = await client.from('dcmoc_projects')
        .update({ name, bundle }).eq('id', id).eq('user_id', user.id)
        .select('id, updated_at').single();
      return { data, error: friendly(error) };
    }
    const { data, error } = await client.from('dcmoc_projects')
      .insert({ user_id: user.id, name, bundle }).select('id, updated_at').single();
    return { data, error: friendly(error) };
  },
  async listDcmocProjects() {
    if (!client) return { data: [], error: initError };
    const user = await this.getUser();
    if (!user) return { data: [], error: 'not signed in' };
    // no `bundle` column here — list stays light (bundle can be ~200 KB/row)
    const { data, error } = await client.from('dcmoc_projects')
      .select('id, name, version, share_token, created_at, updated_at')
      .eq('user_id', user.id).order('updated_at', { ascending: false });
    return { data: data || [], error: friendly(error) };
  },
  async getDcmocProject(id) {
    if (!client) return { error: initError };
    const user = await this.getUser();
    if (!user) return { error: 'not signed in' };
    const { data, error } = await client.from('dcmoc_projects')
      .select('*').eq('id', id).eq('user_id', user.id).single();
    return { data, error: friendly(error) };
  },
  async deleteDcmocProject(id) {
    if (!client) return { error: initError };
    const user = await this.getUser();
    if (!user) return { error: 'not signed in' };
    const { error } = await client.from('dcmoc_projects').delete().eq('id', id).eq('user_id', user.id);
    return { error: friendly(error) };
  },
  async shareDcmocProject(id) {
    if (!client) return { error: initError };
    const user = await this.getUser();
    if (!user) return { error: 'not signed in' };
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = btoa(String.fromCharCode.apply(null, bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const { data, error } = await client.from('dcmoc_projects')
      .update({ share_token: token, shared_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.id).select('id, share_token').single();
    return { data, error: friendly(error) };
  },
  async unshareDcmocProject(id) {
    if (!client) return { error: initError };
    const user = await this.getUser();
    if (!user) return { error: 'not signed in' };
    const { error } = await client.from('dcmoc_projects')
      .update({ share_token: null, shared_at: null }).eq('id', id).eq('user_id', user.id);
    return { error: friendly(error) };
  },
  async getSharedProject(token) {
    if (!client) return { error: initError };
    // anon-callable by design — no auth guard (share links work logged-out)
    const { data, error } = await client.rpc('get_shared_project', { p_token: token });
    return { data, error: friendly(error) };
  },

  /* ── Admin (root-only). Security is enforced ENTIRELY by RLS in the database
   *    (the `is_root()` policies) — these helpers just call the API. A non-root
   *    caller gets an empty result (read) or 0 rows updated (write); no service_role
   *    key is ever used or shipped to the browser. ── */
  async listAllProfiles() {
    if (!client) return { data: [], error: initError };
    if (!(await this.getUser())) return { data: [], error: 'not signed in' };
    // RLS: root sees all rows; a non-root user sees only their own. Pinned column list (no '*')
    // and a bounded limit so the admin panel can't be made to fetch an unbounded result set.
    const { data, error } = await client.from('profiles')
      .select('id, email, tier, display_name, created_at')
      .order('created_at', { ascending: true }).limit(1000);
    return { data: data || [], error: friendly(error) };
  },
  async setTier(userId, tier) {
    if (!client) return { error: initError };
    if (['free', 'demo', 'pro', 'root'].indexOf(tier) === -1) return { error: 'invalid tier' };
    // Route through the SECURITY DEFINER RPC admin_set_tier(): it re-checks is_root(),
    // re-validates the tier, refuses to demote the last root, and can touch ONLY the tier
    // column. `profiles` has NO client update policy at all — a direct table update would
    // change 0 rows. A non-root caller gets a raised exception surfaced as `error` here.
    const { data, error } = await client.rpc('admin_set_tier', { target: userId, new_tier: tier });
    if (error) {
      const msg = error.message || String(error);
      if (/not authorized|root required/i.test(msg))
        return { error: 'Not permitted — you must be signed in as a root user.' };
      return { error: friendly(error) };
    }
    return { data, error: null };
  },

  /* ── Admin user-management (root-only). These call the `admin-users` Edge Function,
   *    which holds the service_role key server-side and re-verifies root before doing
   *    anything. If the function isn't deployed yet, invoke() fails at the transport
   *    layer — we surface a friendly "not deployed" message so the panel degrades
   *    gracefully instead of throwing. ── */
  async adminInvoke(action, payload) {
    if (!client) return { error: initError };
    try {
      const { data, error } = await client.functions.invoke('admin-users', {
        body: Object.assign({ action: action }, payload || {})
      });
      if (error) {
        // FunctionsHttpError carries the JSON body we returned ({ok:false,error,message}).
        let msg = error.message || String(error);
        try {
          const ctx = error.context;
          if (ctx && typeof ctx.json === 'function') { const b = await ctx.json(); if (b && b.message) msg = b.message; }
        } catch (e) {}
        // "not deployed" only when the transport actually couldn't reach the function. `non-2xx`
        // covers supabase-js's generic FunctionsHttpError wording for a 404.
        if (/Failed to send|Failed to fetch|not found|non-2xx|404|NetworkError/i.test(msg))
          return { error: 'Admin function not deployed yet — deploy `admin-users` (see setup-supabase.html Step 2c).' };
        return { error: msg };
      }
      // Function returns { ok, data } | { ok:false, error, message }.
      if (data && data.ok === false) return { error: data.message || data.error || 'Admin action failed.' };
      return { data: data && data.data, error: null };
    } catch (e) {
      // Only treat genuine transport failures as "not deployed"; surface real JS errors so bugs aren't hidden.
      var em = (e && e.message) || String(e);
      if (/Failed to send|Failed to fetch|not found|non-2xx|404|NetworkError/i.test(em))
        return { error: 'Admin function not deployed yet — deploy `admin-users` (see setup-supabase.html Step 2c).' };
      return { error: em || 'Admin action failed.' };
    }
  },
  adminMigrateLegacy() { return this.adminInvoke('migrate_legacy'); },
  adminCreateUser(email, password, tier) { return this.adminInvoke('create_user', { email: email, password: password, tier: tier }); },
  adminResetPassword(userId, newPassword) { return this.adminInvoke('reset_password', { userId: userId, newPassword: newPassword }); },
  adminDeleteUser(userId) { return this.adminInvoke('delete_user', { userId: userId }); },

  /* ══════════════════════════════════════════════════════════════════════════
   * Schema v3 helpers — per-user data + entitlements + audit + newsletter.
   * RLS scopes every row to the caller; `.eq('user_id', user.id)` is defense-in-depth.
   * Column lists are pinned (never select('*')) so a future column can't leak.
   * All return the same { data, error } envelope; never throw.
   * ══════════════════════════════════════════════════════════════════════════ */

  /* internal: generic own-row helpers to keep the per-user tables DRY + consistent. */
  async _ownList(table, cols, order) {
    if (!client) return { data: [], error: initError };
    const user = await this.getUser();
    if (!user) return { data: [], error: 'not signed in' };
    const { data, error } = await client.from(table).select(cols)
      .eq('user_id', user.id).order(order || 'updated_at', { ascending: false });
    return { data: data || [], error: friendly(error) };
  },
  async _ownInsert(table, row, cols) {
    if (!client) return { error: initError };
    const user = await this.getUser();
    if (!user) return { error: 'Silakan login dulu untuk menyimpan.' };
    const q = client.from(table).insert(Object.assign({ user_id: user.id }, row));
    const { data, error } = cols ? await q.select(cols).single() : await q.select().single();
    return { data, error: friendly(error) };
  },
  async _ownUpdate(table, id, patch, cols) {
    if (!client) return { error: initError };
    const user = await this.getUser();
    if (!user) return { error: 'not signed in' };
    const q = client.from(table).update(patch).eq('id', id).eq('user_id', user.id);
    const { data, error } = cols ? await q.select(cols).single() : await q.select().single();
    return { data, error: friendly(error) };
  },
  async _ownDelete(table, id) {
    if (!client) return { error: initError };
    const user = await this.getUser();
    if (!user) return { error: 'not signed in' };
    const { error } = await client.from(table).delete().eq('id', id).eq('user_id', user.id);
    return { error: friendly(error) };
  },

  /* ── Finance Terminal: watchlists / portfolios / price alerts ── */
  listWatchlists() { return this._ownList('watchlists', 'id, name, items, created_at, updated_at'); },
  saveWatchlist(name, items) { return this._ownInsert('watchlists', { name: name, items: items || [] }, 'id, name, items, created_at, updated_at'); },
  updateWatchlist(id, patch) { return this._ownUpdate('watchlists', id, patch, 'id, name, items, updated_at'); },
  deleteWatchlist(id) { return this._ownDelete('watchlists', id); },

  listPortfolios() { return this._ownList('portfolios', 'id, name, positions, cash, created_at, updated_at'); },
  savePortfolio(name, positions, cash) { return this._ownInsert('portfolios', { name: name, positions: positions || [], cash: cash || 0 }, 'id, name, positions, cash, updated_at'); },
  updatePortfolio(id, patch) { return this._ownUpdate('portfolios', id, patch, 'id, name, positions, cash, updated_at'); },
  deletePortfolio(id) { return this._ownDelete('portfolios', id); },

  listAlerts() { return this._ownList('price_alerts', 'id, symbol, target_price, direction, status, created_at, triggered_at', 'created_at'); },
  saveAlert(symbol, targetPrice, direction) { return this._ownInsert('price_alerts', { symbol: symbol, target_price: targetPrice, direction: direction }, 'id, symbol, target_price, direction, status, created_at'); },
  updateAlert(id, patch) { return this._ownUpdate('price_alerts', id, patch, 'id, symbol, status'); },
  deleteAlert(id) { return this._ownDelete('price_alerts', id); },

  /* ── Bookmarks ── */
  listBookmarks() { return this._ownList('bookmarks', 'id, page_key, section_id, label, created_at', 'created_at'); },
  saveBookmark(pageKey, sectionId, label) { return this._ownInsert('bookmarks', { page_key: pageKey, section_id: sectionId, label: label }, 'id, page_key, section_id, label, created_at'); },
  deleteBookmark(id) { return this._ownDelete('bookmarks', id); },

  /* ── Generic per-user key/value state (upsert on (user_id,key)) — calculator drafts,
   *    DCA state, FT prefs. Replaces scattered localStorage keys with cross-device sync. ── */
  async getAppState(key) {
    if (!client) return { data: null, error: initError };
    const user = await this.getUser();
    if (!user) return { data: null, error: 'not signed in' };
    const { data, error } = await client.from('app_state').select('state, updated_at')
      .eq('user_id', user.id).eq('key', key).maybeSingle();
    return { data: (data && data.state) || null, error: friendly(error) };
  },
  async setAppState(key, state) {
    if (!client) return { error: initError };
    const user = await this.getUser();
    if (!user) return { error: 'not signed in' };
    const { data, error } = await client.from('app_state')
      .upsert({ user_id: user.id, key: key, state: state }, { onConflict: 'user_id,key' })
      .select('state, updated_at').single();
    return { data, error: friendly(error) };
  },

  /* ── Observability: audit log (write via SECURITY DEFINER RPC; actor forced to auth.uid()) ── */
  async logEvent(action, targetType, targetId, meta) {
    if (!client) return { error: initError };
    const { data, error } = await client.rpc('log_event', {
      p_action: action, p_target_type: targetType || null, p_target_id: targetId || null, p_meta: meta || {}
    });
    return { data, error: friendly(error) };
  },
  async listAuditLog(limit) {
    if (!client) return { data: [], error: initError };
    if (!(await this.getUser())) return { data: [], error: 'not signed in' };
    // RLS: a user sees own events; root sees all. Pinned columns + bounded limit.
    const { data, error } = await client.from('audit_log')
      .select('id, actor_id, action, target_type, target_id, meta, created_at')
      .order('created_at', { ascending: false }).limit(Math.min(limit || 100, 500));
    return { data: data || [], error: friendly(error) };
  },

  /* ── Newsletter (public, validated server-side by subscribe_newsletter) ── */
  async subscribeNewsletter(email, source) {
    if (!client) return { error: initError };
    const { data, error } = await client.rpc('subscribe_newsletter', { p_email: email, p_source: source || null });
    return { data, error: friendly(error) };
  },
  async listSubscribers(limit) { // root-only (RLS)
    if (!client) return { data: [], error: initError };
    if (!(await this.getUser())) return { data: [], error: 'not signed in' };
    const { data, error } = await client.from('newsletter_subscribers')
      .select('id, email, status, source, created_at')
      .order('created_at', { ascending: false }).limit(Math.min(limit || 500, 2000));
    return { data: data || [], error: friendly(error) };
  },

  /* ── Entitlements: feature overrides (public read; root write) + educator allowlist (root) ── */
  async getFeatureOverrides() {
    if (!client) return { data: [], error: initError };
    const { data, error } = await client.from('feature_overrides')
      .select('page_key, feature_key, tier, enabled, updated_at');
    return { data: data || [], error: friendly(error) };
  },
  async setFeatureOverride(pageKey, featureKey, tier, enabled) {
    if (!client) return { error: initError };
    const user = await this.getUser();
    if (!user) return { error: 'not signed in' };
    // RLS: only root may write; a non-root caller updates 0 rows / gets denied.
    const { data, error } = await client.from('feature_overrides')
      .upsert({ page_key: pageKey, feature_key: featureKey, tier: tier, enabled: !!enabled, updated_by: user.id },
        { onConflict: 'page_key,feature_key,tier' })
      .select('page_key, feature_key, tier, enabled').single();
    return { data, error: friendly(error) };
  },
  async listEducators() { // root-only (RLS)
    if (!client) return { data: [], error: initError };
    if (!(await this.getUser())) return { data: [], error: 'not signed in' };
    const { data, error } = await client.from('educator_allowlist').select('email, added_at').order('added_at', { ascending: false });
    return { data: data || [], error: friendly(error) };
  },
  async addEducator(email) {
    if (!client) return { error: initError };
    const user = await this.getUser();
    if (!user) return { error: 'not signed in' };
    const { data, error } = await client.from('educator_allowlist')
      .upsert({ email: email, added_by: user.id }, { onConflict: 'email' }).select('email').single();
    return { data, error: friendly(error) };
  },
  async removeEducator(email) {
    if (!client) return { error: initError };
    if (!(await this.getUser())) return { error: 'not signed in' };
    const { error } = await client.from('educator_allowlist').delete().eq('email', email);
    return { error: friendly(error) };
  }
};

if (typeof window !== 'undefined') {
  window.rzSupa = api;
  // A resolved promise consumers can await to know the module has attached.
  window.rzSupa.ready = Promise.resolve(api);
  try { window.dispatchEvent(new CustomEvent('rz-supa-ready', { detail: api })); } catch (e) {}
}

export default api;
