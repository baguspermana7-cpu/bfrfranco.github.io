# Supabase schema — resistancezero.com

`supabase/schema.sql` is the single, idempotent source of truth for the
resistancezero.com Postgres 16 (Supabase) database. Re-running it any time is a
no-op — every statement is `create ... if not exists` / `create or replace` /
`drop ... if exists` / guarded `alter`.

---

## ER overview

### Identity & privilege (root/system-managed)

| Table | Scope | Notes |
|---|---|---|
| `profiles` | 1 row / user (`id` = `auth.users.id`) | Holds `tier` (`free\|demo\|pro\|root`), `role` (`user\|educator\|root`), `status`, profile fields, `metadata` jsonb. **No client insert/update** — created by signup trigger, mutated only via `admin_set_tier()` / `admin_set_role()` RPCs. |
| `feature_flags` | Global catalog | `key` (citext) → `min_tier`. **All-read**, root-write. |
| `feature_overrides` | Global | Per-`(page_key, feature_key, tier)` enable/disable that wins over `min_tier`. **All-read**, root-write. `updated_by → profiles`. |
| `educator_allowlist` | Global | Emails granted educator access. **Root-only read + write**. `added_by → profiles`. |

### Per-user application data (owner-scoped)

| Table | FK | Row cap / user | Mutable |
|---|---|---|---|
| `saved_scenarios` | `user_id → auth.users` | 200 | insert/delete |
| `watchlists` | `user_id → auth.users` | 50 | yes (`updated_at`) |
| `portfolios` | `user_id → auth.users` | 50 | yes (`updated_at`) |
| `price_alerts` | `user_id → auth.users` | 200 | yes (status/triggered_at) |
| `bookmarks` | `user_id → auth.users` | 500 | insert/delete |
| `app_state` | `user_id → auth.users`, `unique(user_id,key)` | 200 | yes (`updated_at`) |

Every per-user table: `enable row level security` + full own-row CRUD policies
scoped to `(select auth.uid()) = user_id`, an index on `(user_id, …_at desc)`,
a per-user row-count cap trigger (SECURITY DEFINER), and jsonb size CHECKs.

### Observability, newsletter, billing (system / webhook-managed)

| Table | Scope | Write path |
|---|---|---|
| `audit_log` | read own OR root-all | **No client insert** — only `log_event()` (actor = `auth.uid()`) + the profile privilege-change trigger. `actor_id → profiles`. |
| `newsletter_subscribers` | root-read only | **No public select, no raw public insert** — signup via `subscribe_newsletter()` (validates email, upserts). |
| `subscriptions` | read own | **No client write** — Mayar webhook via `service_role`. `user_id → auth.users`. |
| `payments` | read own | **No client write** — webhook via `service_role`. `subscription_id → subscriptions (on delete set null)`. |

### Functions

| Function | Type | Guard |
|---|---|---|
| `is_root()` | SECURITY DEFINER, STABLE | reads `profiles` without RLS |
| `is_educator()` | SECURITY DEFINER, STABLE | role=`educator` OR email in allowlist |
| `has_feature(page,feature)` | SECURITY DEFINER, STABLE | resolves caller tier vs override / `min_tier` → bool |
| `handle_new_user()` | SECURITY DEFINER trigger | signup → root-email bootstrap → tier/role |
| `admin_set_tier(uuid,text)` | SECURITY DEFINER RPC | root-only, tier whitelist, last-root demotion guard, anon revoked |
| `admin_set_role(uuid,text)` | SECURITY DEFINER RPC | root-only, role whitelist, last-root-role guard, anon revoked |
| `log_event(action,…)` | SECURITY DEFINER | inserts as `auth.uid()`; anon revoked |
| `subscribe_newsletter(email,source)` | SECURITY DEFINER | email-shape validation; **callable by anon** |
| `set_updated_at()` | trigger fn | stamps `updated_at` on mutable tables |
| `enforce_*_limit()` | SECURITY DEFINER triggers | per-user row caps |

### Relationship diagram (textual)

```
auth.users ──1:1── profiles ──┬── (admin_set_tier / admin_set_role RPCs)
     │                        ├── feature_overrides.updated_by
     │                        ├── educator_allowlist.added_by
     │                        └── audit_log.actor_id
     ├──1:N── saved_scenarios
     ├──1:N── watchlists / portfolios / price_alerts / bookmarks / app_state
     ├──1:N── subscriptions ──1:N── payments (payments.subscription_id → subscriptions, set null)
     └──1:N── payments
```

---

## Migration steps (paste-and-run)

1. Open the Supabase Dashboard for the resistancezero.com project.
2. Go to **SQL Editor → New query**.
3. Open `supabase/schema.sql`, **copy the whole file**, paste it into the editor.
4. Click **Run**. It is idempotent — safe to run on a fresh or existing DB.
5. Confirm "Success. No rows returned" (or the backfill row counts) with no errors.

No CLI required. The `admin-users` Edge Function (real user provisioning) is
deployed separately from the Dashboard; the `service_role` key and DB password
are never placed in the browser or the repo.

---

## Verification query block

Run these in the SQL Editor after the migration.

### (a) Every table has RLS enabled — every row MUST show `rowsecurity = true`

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Expected tables (all `true`): `app_state`, `audit_log`, `bookmarks`,
`educator_allowlist`, `feature_flags`, `feature_overrides`,
`newsletter_subscribers`, `payments`, `portfolios`, `price_alerts`,
`profiles`, `saved_scenarios`, `subscriptions`, `watchlists`.

Assert none are `false`:

```sql
select count(*) as tables_without_rls
from pg_tables
where schemaname = 'public' and rowsecurity = false;
-- expected: 0
```

### (b) Cross-user isolation (manual, two accounts)

1. Sign in to the app as **User A**, create a watchlist, then in the browser
   console run a client `supabase.from('watchlists').select('*')` — note the row
   count (only A's rows).
2. Sign out, sign in as **User B**, create a different watchlist, run the same
   `select * from watchlists`.
3. Confirm **B sees only B's rows and never A's** (and vice-versa). RLS scopes
   every read to `auth.uid() = user_id`, so a cross-user select is impossible
   with the anon/publishable key. Repeat spot-checks for `portfolios`,
   `saved_scenarios`, `price_alerts`, `bookmarks`, `app_state`.

### (c) Privilege escalation is blocked (optional spot-check)

```sql
-- As a non-root signed-in user, both must ERROR ("not authorized: root required"):
select public.admin_set_tier('<some-uuid>', 'root');
select public.admin_set_role('<some-uuid>', 'root');
```
