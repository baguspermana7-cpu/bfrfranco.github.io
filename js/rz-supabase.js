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
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

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

  /* ── Profile (tier lives here; RLS = own row only) ── */
  async getProfile() {
    if (!client) return { data: null, error: initError };
    const user = await this.getUser();
    if (!user) return { data: null, error: 'not signed in' };
    const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
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
    let q = client.from('saved_scenarios').select('*').order('created_at', { ascending: false });
    if (calc) q = q.eq('calc', calc);
    const { data, error } = await q;
    return { data: data || [], error: friendly(error) };
  },
  async deleteScenario(id) {
    if (!client) return { error: initError };
    const { error } = await client.from('saved_scenarios').delete().eq('id', id);
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
