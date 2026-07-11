// ============================================================================
// admin-users — Supabase Edge Function (Deno) for resistancezero.com
//
// The ONLY place the service_role key is used. Lets a signed-in ROOT user (from
// rz-ops) create accounts, reset passwords, delete users, and migrate the legacy
// hardcoded accounts into real Supabase accounts — operations that require the
// service_role key and therefore MUST NOT run in the browser.
//
// Security model:
//   • service_role + url are AUTO-INJECTED by Supabase (Deno.env) — never in the
//     repo, never in a browser, never handled by the owner.
//   • Every request must carry the caller's JWT (supabase-js attaches it to
//     functions.invoke automatically). We validate it, then confirm the caller's
//     profile tier === 'root' using the service client. Non-root → 403.
//   • CORS is locked to the site's known origins.
//   • Tier CHANGES from the browser still go through the admin_set_tier() RPC
//     (root-checked in SQL); this function only does the service_role-only ops.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Module-scope clients (created once per warm instance, not per request). The anon client is only
// used to VALIDATE a caller's JWT via getUser(token); the service client does the privileged work.
const anon = createClient(SUPABASE_URL, ANON_KEY);
const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const TIERS = ['free', 'demo', 'pro', 'root'];

// Same origin whitelist the finance worker uses (cf-worker/wrangler.toml).
const ALLOWED_ORIGINS = new Set([
  'https://resistancezero.com',
  'https://www.resistancezero.com',
  'http://localhost:8081', 'http://127.0.0.1:8081',
  'http://localhost:8097', 'http://127.0.0.1:8097',
  'http://localhost:8099', 'http://127.0.0.1:8099',
]);

// The legacy hardcoded accounts (auth.js VALID_USERS) → real Supabase accounts.
// Migrated exactly as-is (owner's explicit choice). These passwords are ALREADY public in
// auth.js on the live site, so listing them here adds no new exposure. bagus@/admin@ are root
// via the signup trigger; demo/educator tiers are set here after creation.
// SECURITY: after running migrate_legacy once, reset the bagus@/admin@ passwords (the panel's
// ⚠/Reset button) and consider removing this array + the migrate_legacy case on the next deploy.
const LEGACY = [
  { email: 'demo@resistancezero.com', password: 'demo2026', tier: 'demo' },
  { email: 'educator@resistancezero.com', password: 'educator2026', tier: 'pro' },
  { email: 'bagus@resistancezero.com', password: 'RZ@Premium2026!', tier: 'root' },
  { email: 'admin@resistancezero.com', password: 'RZ@Premium2026!', tier: 'root' },
];

function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Max-Age': '600',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
const ok = (data: unknown, origin: string | null) => json({ ok: true, data }, 200, origin);
const fail = (status: number, error: string, message: string, origin: string | null) =>
  json({ ok: false, error, message }, status, origin);

const isEmail = (s: unknown): s is string => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isPassword = (s: unknown): s is string => typeof s === 'string' && s.length >= 8;
const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.', origin);

  // ── Authn: validate the caller's JWT ──
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return fail(401, 'no_token', 'Missing bearer token.', origin);

  const { data: userData, error: userErr } = await anon.auth.getUser(token);
  const caller = userData?.user;
  if (userErr || !caller) return fail(401, 'invalid_token', 'Invalid or expired session.', origin);

  // ── Authz: caller must be root (checked against the DB with the service client) ──
  const { data: me, error: meErr } = await svc.from('profiles').select('tier').eq('id', caller.id).maybeSingle();
  if (meErr) { console.error('[admin-users] authz lookup failed', meErr); return fail(500, 'db_error', 'Authorization check failed.', origin); }
  if (!me || me.tier !== 'root') return fail(403, 'not_root', 'Root account required.', origin);

  // ── Parse body ──
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail(400, 'bad_json', 'Body must be JSON.', origin); }
  const action = body.action;

  try {
    switch (action) {
      case 'migrate_legacy': {
        const results: Array<{ email: string; status: string; detail?: string }> = [];
        for (const acct of LEGACY) {
          const { data: created, error: cErr } = await svc.auth.admin.createUser({
            email: acct.email, password: acct.password, email_confirm: true,
          });
          let id = created?.user?.id || null;
          let status = 'created';
          if (cErr) {
            // Already registered → find its id via profiles (trigger created the row).
            const { data: prof } = await svc.from('profiles').select('id').eq('email', acct.email).maybeSingle();
            id = prof?.id || null;
            status = id ? 'exists' : 'error';
            if (!id) { results.push({ email: acct.email, status, detail: cErr.message }); continue; }
          }
          // Ensure the correct tier (service update bypasses RLS; not the RPC — no auth.uid() here).
          if (id) {
            const { error: tErr } = await svc.from('profiles').update({ tier: acct.tier }).eq('id', id);
            if (tErr) status = 'tier_error';
          }
          results.push({ email: acct.email, status });
        }
        return ok({ results }, origin);
      }

      case 'create_user': {
        const { email, password, tier } = body as { email?: unknown; password?: unknown; tier?: unknown };
        if (!isEmail(email)) return fail(400, 'bad_email', 'Valid email required.', origin);
        if (!isPassword(password)) return fail(400, 'bad_password', 'Password must be at least 8 characters.', origin);
        const t = typeof tier === 'string' && TIERS.includes(tier) ? tier : 'free';
        // Root accounts get a stronger minimum (they can administer everyone).
        if (t === 'root' && password.length < 12)
          return fail(400, 'weak_password', 'Root accounts need a password of at least 12 characters.', origin);
        const { data: created, error: cErr } = await svc.auth.admin.createUser({
          email, password, email_confirm: true,
        });
        if (cErr || !created?.user) return fail(400, 'create_failed', cErr?.message || 'Could not create user.', origin);
        if (t !== 'free') {
          const { error: tErr } = await svc.from('profiles').update({ tier: t }).eq('id', created.user.id);
          if (tErr) return fail(500, 'tier_error', tErr.message, origin);
        }
        return ok({ id: created.user.id, email, tier: t }, origin);
      }

      case 'reset_password': {
        const { userId, newPassword } = body as { userId?: unknown; newPassword?: unknown };
        if (!isUuid(userId)) return fail(400, 'bad_user', 'Valid userId required.', origin);
        if (!isPassword(newPassword)) return fail(400, 'bad_password', 'Password must be at least 8 characters.', origin);
        const { error: uErr } = await svc.auth.admin.updateUserById(userId, { password: newPassword });
        if (uErr) return fail(400, 'reset_failed', uErr.message, origin);
        return ok({ id: userId }, origin);
      }

      case 'delete_user': {
        const { userId } = body as { userId?: unknown };
        if (!isUuid(userId)) return fail(400, 'bad_user', 'Valid userId required.', origin);
        if (userId === caller.id) return fail(400, 'self_delete', 'You cannot delete your own account.', origin);
        // Last-root guard.
        const { data: target } = await svc.from('profiles').select('tier').eq('id', userId).maybeSingle();
        if (target?.tier === 'root') {
          const { count } = await svc.from('profiles').select('id', { count: 'exact', head: true }).eq('tier', 'root');
          if ((count || 0) <= 1) return fail(400, 'last_root', 'Cannot delete the last root account.', origin);
        }
        const { error: dErr } = await svc.auth.admin.deleteUser(userId);
        if (dErr) return fail(400, 'delete_failed', dErr.message, origin);
        return ok({ id: userId }, origin);
      }

      default:
        return fail(400, 'bad_action', 'Unknown action.', origin);
    }
  } catch (e) {
    // Log the real error to the Edge Function logs; never leak internals to the browser.
    console.error('[admin-users] server error', e);
    return fail(500, 'server_error', 'Internal server error.', origin);
  }
});
