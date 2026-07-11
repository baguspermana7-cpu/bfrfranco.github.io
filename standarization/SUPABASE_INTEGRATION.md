# Supabase Integration — accounts, saved data, and the "Save to my account" pattern

> **What this is**: how real user accounts + per-user data are wired into the static site via Supabase,
> and the repeatable recipe for adding "☁ Save to my account" (reloadable saved scenarios) to a
> calculator. Established v1.51.13–v1.51.17 (2026-07-11).
>
> **Golden rule**: this layer is **additive and isolated**. It must NOT disturb the existing hardcoded
> `auth.js` login (`rz_premium_session`) — that sitewide switch is a separate, later step (§B4).

---

## Architecture (client-only, serverless)

```
js/rz-config.js     window.RZ_CONFIG = { SUPABASE_URL, SUPABASE_ANON }   ← PUBLIC values
      ↓ (loaded first)
js/rz-supabase.js   window.rzSupa  — ES module; supabase-js client + auth + profile + saved_scenarios
js/rz-scenario.js   window.rzScenario — capture/restore calculator inputs + shared saveToAccount()
account.html        real sign-up / log-in / log-out + profile tier badge + saved-scenario list (Open/Delete)
supabase/schema.sql profiles + saved_scenarios tables, RLS, auto-profile trigger  ← owner runs once
```

- **Auth**: email/password (Google OAuth is available via `rzSupa.signInOAuth` once the provider is
  enabled in the dashboard). `rz-supabase.js` NEVER writes `rz_premium_session` — the legacy Pro-gating is
  untouched.
- **Data**: `saved_scenarios` holds a JSONB `payload = { summary, inputs }`. `inputs` is a generic capture
  of the page's form fields, which is what makes a saved scenario **reloadable**.

## Security model (READ before touching this)

The anon/publishable key ships in the browser **by design** — safety comes from **Row Level Security
(RLS)**, not key secrecy. Non-negotiables (all enforced today; a security review caught + fixed early
violations):
1. **RLS enabled + own-rows-only policies** on every table (`auth.uid() = user_id`). A table with policies
   but RLS *disabled* is wide open — always `alter table … enable row level security`.
2. **No client policy on privilege columns.** `profiles.tier` is a privilege field → there is **no client
   `update` policy** on `profiles` (a plain "update own" would let anyone `set tier='root'`). Tier changes
   are server-side only (admin SQL / a `SECURITY DEFINER` RPC).
3. **`user_id` from `auth.uid()`**, never client-supplied; `with check (auth.uid() = user_id)` enforces it.
   Client queries also add `.eq('user_id', …)` as defense-in-depth.
4. **Escape all DB values before `innerHTML`** (names, error messages) — see `escapeHtml` in `account.html`.
5. **Never capture credentials**: `rz-scenario.js` excludes `password` + `email` inputs by TYPE (not just by
   modal ancestor).
6. **Pin the supabase-js CDN import** to an exact version (`@2.110.2`) — an auth-critical lib must not
   silently load a new patch.
7. **`service_role` key + DB password NEVER enter the repo.** Only `sb_publishable_…` (anon) is committed.

## Add "☁ Save to my account" to a calculator (the recipe)

Per-page changes only — the logic lives in the shared modules:
1. `<body data-rz-calc="XYZ">` — marks the calc for auto-restore of a pending "Open".
2. Before `</body>`, after auth.js/rz-engine:
   ```html
   <script src="js/rz-config.js?v=…"></script>
   <script src="js/rz-scenario.js?v=2026-07-11b"></script>
   <script type="module" src="js/rz-supabase.js?v=2026-07-11b"></script>
   ```
3. A button next to Export CSV + a message div:
   ```html
   <button id="btnSaveAccount" onclick="rzScenario&&rzScenario.saveToAccount('XYZ',{msgEl:'acctSaveMsg'})">
     <i class="fas fa-cloud"></i> Save to my account</button>
   <div id="acctSaveMsg" style="display:none"></div>
   ```
`rzScenario.saveToAccount(calc, {msgEl})` captures inputs, saves `{summary, inputs}` for the signed-in
user, and points signed-out users to `account.html`. Reloading is automatic: `account.html`'s **Open**
button stashes `localStorage.rz_open_scenario` and navigates; `rz-scenario.js` restores on load (idempotent
— it only sets + fires events for fields whose value actually differs). **Live on**: capex, opex, roi, tco,
pue, cx.

## Owner-gated steps (cannot be automated — need the Supabase/Cloudflare dashboards)

- Run `supabase/schema.sql` once (SQL Editor). Until then, Save degrades gracefully ("Database not set up
  yet"), no crash.
- **Authentication → URL Configuration** → Site URL = `https://resistancezero.com`.
- (For instant testing) Authentication → Email → disable "Confirm email"; re-enable for production.

## §B4 — sitewide auth switch (LATER, separate ship)

Flip the nav login on all 54 pages from hardcoded creds to Supabase by loading the existing drop-in
`supabase-auth.js` (repo root — already syncs Supabase login → `rz_premium_session`, so `rz-feature-flags.js`
+ every calculator's `isPremiumUser` check keep working) behind a flag (`localStorage.rz_supabase_auth='1'`)
→ verify → default. Move tier/entitlements + the educator allowlist to the `profiles` table. Do this only
after the account + saved-data flow is proven in production.
