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

let client = null;
let initError = null;
try {
  if (URL && ANON) client = createClient(URL, ANON);
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
  adminDeleteUser(userId) { return this.adminInvoke('delete_user', { userId: userId }); }
};

if (typeof window !== 'undefined') {
  window.rzSupa = api;
  // A resolved promise consumers can await to know the module has attached.
  window.rzSupa.ready = Promise.resolve(api);
  try { window.dispatchEvent(new CustomEvent('rz-supa-ready', { detail: api })); } catch (e) {}
}

export default api;
