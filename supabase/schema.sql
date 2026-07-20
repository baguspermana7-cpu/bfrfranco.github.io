-- ============================================================================
-- resistancezero.com — Supabase schema (run once in Supabase → SQL Editor → Run)
-- Idempotent — safe to re-run any time. Every statement uses IF NOT EXISTS /
-- CREATE OR REPLACE / DROP ... IF EXISTS / guarded ALTER so re-running is a no-op.
--
-- SECURITY MODEL (why the public anon/publishable key is safe in the browser):
--   Everything is guarded by Row Level Security (RLS) + hardened, so the anon key can
--   only ever do what an authenticated user is allowed to do to THEIR OWN rows.
--   • profiles has NO client INSERT and NO client UPDATE path at all:
--       - rows are created ONLY by the SECURITY DEFINER signup trigger (handle_new_user)
--       - `tier`/`role` are changed ONLY via SECURITY DEFINER RPCs (admin_set_tier /
--         admin_set_role), which re-check is_root() server-side and touch NOTHING but
--         that one column.
--     → a signed-in user cannot escalate their own tier/role, even via raw REST calls.
--   • All per-user tables scope EVERY policy to `user_id = (select auth.uid())` — never
--     `using (true)` — with DB-level CHECK constraints (length, jsonb size) + per-user
--     row caps enforced by SECURITY DEFINER triggers.
--   • Privileged writes (tier/role/flags/audit/newsletter/billing) go ONLY through
--     SECURITY DEFINER functions or the service_role key (never shipped to the browser).
--   • NO password / secret column exists anywhere. Admin-created users are real
--     auth.users provisioned by the `admin-users` Edge Function, not modeled here.
--   The service_role key + DB password are NEVER shipped to the browser.
--
-- MODULE MAP:
--   0  foundation      — extensions + shared set_updated_at() trigger fn
--   1  profiles        — one row per user (tier + role + profile fields) + admin RPCs
--   2  saved_scenarios — per-user saved calculator scenarios
--   3  entitlements    — feature_flags / feature_overrides / educator_allowlist + helpers
--   4  app data        — watchlists / portfolios / price_alerts / bookmarks / app_state
--   5  observability   — audit_log + log_event() + profile change audit trigger
--   6  newsletter      — newsletter_subscribers + subscribe_newsletter()
--   7  billing scaffold— subscriptions / payments (Mayar; webhook/service_role only)
--   8  grants          — schema-level grants (RLS does the row-level authorization)
--   9  dcmoc_projects  — DCMOC cloud project bundles + share-by-token RPC
-- ============================================================================


-- ===== Module 0 — foundation (extensions + shared triggers) =================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;      -- case-insensitive email keys

-- Least-privilege: no authenticated user should be able to create objects in public.
-- No-op on newer Supabase projects (already revoked); safe on older ones.
revoke create on schema public from public;

-- Shared BEFORE UPDATE trigger fn: stamps updated_at = now() on every mutable table.
-- Not SECURITY DEFINER — it only rewrites the row already being written by the caller.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ===== Module 1 — profiles (identity, tier, role, profile fields) ===========

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  tier         text not null default 'free',   -- 'free' | 'demo' | 'pro' | 'root'
  display_name text,
  created_at   timestamptz not null default now()
);

-- Extended profile columns (Module 1). All add-if-not-exists so re-runnable.
alter table public.profiles add column if not exists full_name    text;
alter table public.profiles add column if not exists company      text;
alter table public.profiles add column if not exists country      text;
alter table public.profiles add column if not exists avatar_url   text;
alter table public.profiles add column if not exists role         text not null default 'user';
alter table public.profiles add column if not exists status       text not null default 'active';
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists updated_at   timestamptz default now();
alter table public.profiles add column if not exists metadata     jsonb not null default '{}'::jsonb;

-- DB-level whitelists: an invalid tier/role/status can never be stored, even via a bug.
alter table public.profiles drop constraint if exists profiles_tier_chk;
alter table public.profiles add  constraint profiles_tier_chk   check (tier   in ('free','demo','pro','root'));
alter table public.profiles drop constraint if exists profiles_role_chk;
alter table public.profiles add  constraint profiles_role_chk   check (role   in ('user','educator','root'));
alter table public.profiles drop constraint if exists profiles_status_chk;
alter table public.profiles add  constraint profiles_status_chk check (status in ('active','suspended'));
alter table public.profiles drop constraint if exists profiles_metadata_chk;
alter table public.profiles add  constraint profiles_metadata_chk check (pg_column_size(metadata) <= 16384);  -- 16 KB cap

-- email must always be present (the admin panel + email-based logic depend on it). Idempotent:
-- backfill any nulls, set a default, then enforce NOT NULL. Safe to re-run.
update public.profiles set email = '' where email is null;
alter table public.profiles alter column email set default '';
alter table public.profiles alter column email set not null;

-- is_root() must exist BEFORE the "root reads all" policy below references it.
-- SECURITY DEFINER so it reads `profiles` WITHOUT triggering RLS — this avoids the infinite
-- recursion you'd get if a policy ON profiles queried profiles under RLS. STABLE + pinned
-- search_path. Used by "root reads all" policies + admin_set_tier/admin_set_role below.
create or replace function public.is_root()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and tier = 'root'
  );
$$;

-- RLS fully protects the browser: PostgREST connects as anon/authenticated (never the table
-- owner), so those roles get NO write path to profiles. We do NOT `force` RLS, because the
-- SECURITY DEFINER signup trigger + backfill must still be able to create profile rows.
alter table public.profiles enable row level security;

-- Drop EVERY prior policy name we've ever used, then recreate only the safe ones.
drop policy if exists "profiles: read own"        on public.profiles;
drop policy if exists "profiles: insert own"      on public.profiles;   -- REMOVED (trigger-only creation)
drop policy if exists "profiles: update own"      on public.profiles;   -- REMOVED (privilege field)
drop policy if exists "profiles: root reads all"  on public.profiles;
drop policy if exists "profiles: root updates all" on public.profiles;  -- REMOVED (replaced by admin_set_tier RPC)

-- Reads: a user sees their own row; a root sees every row (for the rz-ops accounts panel).
-- `(select auth.uid())` / `(select is_root())` are wrapped so PostgreSQL evaluates them ONCE per
-- statement (initPlan-cached) instead of per row — the Supabase RLS performance best-practice.
create policy "profiles: read own"       on public.profiles for select using ((select auth.uid()) = id);
create policy "profiles: root reads all" on public.profiles for select using ((select public.is_root()));
-- NOTE: intentionally NO insert/update/delete policy on profiles. Creation = trigger only;
-- tier changes = admin_set_tier() RPC only; role changes = admin_set_role() RPC only.
-- This closes tier/role self-escalation completely.

-- updated_at auto-stamp on any profile mutation.
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- auto-create a profile on each new signup ----------
-- Owner emails get tier='root'; everyone else ALWAYS starts 'free'. The trigger constructs the
-- row itself, so a client cannot influence the tier at creation time.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, tier, role)
  values (
    new.id,
    new.email,
    case when lower(new.email) in (
      'bagusdpermana7@gmail.com',
      'bagus@resistancezero.com',
      'admin@resistancezero.com'
    ) then 'root' else 'free' end,
    case when lower(new.email) in (
      'bagusdpermana7@gmail.com',
      'bagus@resistancezero.com',
      'admin@resistancezero.com'
    ) then 'root' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users who signed up BEFORE this ran.
insert into public.profiles (id, email, tier, role)
select u.id, u.email,
       case when lower(u.email) in (
         'bagusdpermana7@gmail.com',
         'bagus@resistancezero.com',
         'admin@resistancezero.com'
       ) then 'root' else 'free' end,
       case when lower(u.email) in (
         'bagusdpermana7@gmail.com',
         'bagus@resistancezero.com',
         'admin@resistancezero.com'
       ) then 'root' else 'user' end
from auth.users u
on conflict (id) do nothing;

-- ---------- admin_set_tier(): the ONLY way to change a tier from the app ----------
-- SECURITY DEFINER RPC. It (a) requires the caller to be root, (b) validates the new tier
-- against the whitelist, (c) refuses to demote the LAST remaining root (lockout guard), and
-- (d) touches ONLY the `tier` column — so a compromised or buggy client can never rewrite an
-- email/id or grant itself root. The rz-ops "Supabase Accounts" panel calls this via rpc().
create or replace function public.admin_set_tier(target uuid, new_tier text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.profiles;
  target_tier text;
  root_count int;
begin
  if not public.is_root() then
    raise exception 'not authorized: root required';
  end if;
  if new_tier not in ('free','demo','pro','root') then
    raise exception 'invalid tier: %', new_tier;
  end if;

  select tier into target_tier from public.profiles where id = target;
  if target_tier is null then
    raise exception 'no such profile';
  end if;

  -- Lockout guard: never let the last root be demoted.
  if target_tier = 'root' and new_tier <> 'root' then
    select count(*) into root_count from public.profiles where tier = 'root';
    if root_count <= 1 then
      raise exception 'cannot demote the last root account';
    end if;
  end if;

  update public.profiles set tier = new_tier where id = target returning * into r;
  return r;
end;
$$;

-- ---------- admin_set_role(): the ONLY way to change a role from the app ----------
-- Mirrors admin_set_tier: root-only, validates the role whitelist, refuses to demote the
-- LAST remaining 'root' role (lockout guard), and touches ONLY the `role` column.
create or replace function public.admin_set_role(target uuid, new_role text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.profiles;
  target_role text;
  root_count int;
begin
  if not public.is_root() then
    raise exception 'not authorized: root required';
  end if;
  if new_role not in ('user','educator','root') then
    raise exception 'invalid role: %', new_role;
  end if;

  select role into target_role from public.profiles where id = target;
  if target_role is null then
    raise exception 'no such profile';
  end if;

  -- Lockout guard: never let the last root role be demoted.
  if target_role = 'root' and new_role <> 'root' then
    select count(*) into root_count from public.profiles where role = 'root';
    if root_count <= 1 then
      raise exception 'cannot demote the last root role';
    end if;
  end if;

  update public.profiles set role = new_role where id = target returning * into r;
  return r;
end;
$$;

-- Only signed-in users may even attempt these; anon (logged-out) cannot. The is_root() gate
-- inside does the real authorization — these REVOKEs just remove the pointless anon surface.
revoke execute on function public.admin_set_tier(uuid, text) from anon;
revoke execute on function public.admin_set_role(uuid, text) from anon;


-- ===== Module 2 — saved_scenarios (per-user calculator scenarios) ===========

create table if not exists public.saved_scenarios (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  calc       text not null,                    -- e.g. 'capex'
  name       text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists saved_scenarios_user_idx on public.saved_scenarios (user_id, created_at desc);

-- Bound the free-form fields so a user can't abuse storage or inject oversized blobs.
alter table public.saved_scenarios drop constraint if exists saved_scenarios_name_chk;
alter table public.saved_scenarios add  constraint saved_scenarios_name_chk    check (char_length(name) between 1 and 120);
alter table public.saved_scenarios drop constraint if exists saved_scenarios_calc_chk;
alter table public.saved_scenarios add  constraint saved_scenarios_calc_chk    check (char_length(calc) between 1 and 40);
alter table public.saved_scenarios drop constraint if exists saved_scenarios_payload_chk;
alter table public.saved_scenarios add  constraint saved_scenarios_payload_chk check (pg_column_size(payload) <= 65536);  -- 64 KB cap

alter table public.saved_scenarios enable row level security;

drop policy if exists "scenarios: read own"   on public.saved_scenarios;
drop policy if exists "scenarios: insert own" on public.saved_scenarios;
drop policy if exists "scenarios: update own" on public.saved_scenarios;
drop policy if exists "scenarios: delete own" on public.saved_scenarios;
-- `(select auth.uid())` wrapped → evaluated once per statement (cached), not per row.
create policy "scenarios: read own"   on public.saved_scenarios for select using ((select auth.uid()) = user_id);
create policy "scenarios: insert own" on public.saved_scenarios for insert with check ((select auth.uid()) = user_id);
create policy "scenarios: update own" on public.saved_scenarios for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "scenarios: delete own" on public.saved_scenarios for delete using ((select auth.uid()) = user_id);

-- Per-user row cap (storage-abuse defense). SECURITY DEFINER + pinned search_path so the count is
-- UNCONDITIONAL (all of the user's rows), independent of the RLS policy state — the cap holds even if
-- an RLS policy is ever changed. Scoped explicitly by `where user_id = new.user_id`.
create or replace function public.enforce_scenario_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.saved_scenarios where user_id = new.user_id) >= 200 then
    raise exception 'saved scenario limit reached (200). Delete some to save more.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_scenario_limit on public.saved_scenarios;
create trigger trg_scenario_limit
  before insert on public.saved_scenarios
  for each row execute function public.enforce_scenario_limit();


-- ===== Module 3 — entitlements / feature flags ==============================

-- feature_flags: named capability gated at/above a minimum tier. All-read (public catalog),
-- root-write only (via RLS below). key is citext so lookups are case-insensitive.
create table if not exists public.feature_flags (
  key         citext primary key,
  description text,
  min_tier    text not null default 'free',
  created_at  timestamptz not null default now()
);
alter table public.feature_flags drop constraint if exists feature_flags_min_tier_chk;
alter table public.feature_flags add  constraint feature_flags_min_tier_chk check (min_tier in ('free','demo','pro','root'));

alter table public.feature_flags enable row level security;
drop policy if exists "flags: all read"    on public.feature_flags;
drop policy if exists "flags: root insert"  on public.feature_flags;
drop policy if exists "flags: root update"  on public.feature_flags;
drop policy if exists "flags: root delete"  on public.feature_flags;
-- Anyone (incl. anon) may read the flag catalog; only root may mutate it.
create policy "flags: all read"   on public.feature_flags for select using (true);
create policy "flags: root insert" on public.feature_flags for insert with check ((select public.is_root()));
create policy "flags: root update" on public.feature_flags for update using ((select public.is_root())) with check ((select public.is_root()));
create policy "flags: root delete" on public.feature_flags for delete using ((select public.is_root()));

-- feature_overrides: per-(page,feature,tier) enablement override that wins over min_tier.
create table if not exists public.feature_overrides (
  id          uuid primary key default gen_random_uuid(),
  page_key    text not null,
  feature_key text not null,
  tier        text not null,
  enabled     boolean not null,
  updated_by  uuid references public.profiles (id),
  updated_at  timestamptz default now(),
  unique (page_key, feature_key, tier)
);
alter table public.feature_overrides drop constraint if exists feature_overrides_tier_chk;
alter table public.feature_overrides add  constraint feature_overrides_tier_chk check (tier in ('free','demo','pro','root'));
create index if not exists feature_overrides_updated_by_idx on public.feature_overrides (updated_by);
create index if not exists feature_overrides_lookup_idx     on public.feature_overrides (page_key, feature_key, tier);

alter table public.feature_overrides enable row level security;
drop policy if exists "overrides: all read"    on public.feature_overrides;
drop policy if exists "overrides: root insert" on public.feature_overrides;
drop policy if exists "overrides: root update" on public.feature_overrides;
drop policy if exists "overrides: root delete" on public.feature_overrides;
create policy "overrides: all read"    on public.feature_overrides for select using (true);
create policy "overrides: root insert" on public.feature_overrides for insert with check ((select public.is_root()));
create policy "overrides: root update" on public.feature_overrides for update using ((select public.is_root())) with check ((select public.is_root()));
create policy "overrides: root delete" on public.feature_overrides for delete using ((select public.is_root()));

drop trigger if exists trg_feature_overrides_updated_at on public.feature_overrides;
create trigger trg_feature_overrides_updated_at
  before update on public.feature_overrides
  for each row execute function public.set_updated_at();

-- educator_allowlist: emails granted educator role by allowlist. ROOT-ONLY read + write
-- (it can reveal who has elevated access, so it is NOT publicly readable).
create table if not exists public.educator_allowlist (
  email    citext primary key,
  added_by uuid references public.profiles (id),
  added_at timestamptz not null default now()
);
create index if not exists educator_allowlist_added_by_idx on public.educator_allowlist (added_by);

alter table public.educator_allowlist enable row level security;
drop policy if exists "educators: root read"   on public.educator_allowlist;
drop policy if exists "educators: root insert" on public.educator_allowlist;
drop policy if exists "educators: root update" on public.educator_allowlist;
drop policy if exists "educators: root delete" on public.educator_allowlist;
create policy "educators: root read"   on public.educator_allowlist for select using ((select public.is_root()));
create policy "educators: root insert" on public.educator_allowlist for insert with check ((select public.is_root()));
create policy "educators: root update" on public.educator_allowlist for update using ((select public.is_root())) with check ((select public.is_root()));
create policy "educators: root delete" on public.educator_allowlist for delete using ((select public.is_root()));

-- is_educator(): true if the caller's profile.role = 'educator' OR their email is allowlisted.
-- SECURITY DEFINER so it can read the root-only educator_allowlist + profiles without RLS.
create or replace function public.is_educator()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'educator'
  ) or exists (
    select 1 from public.educator_allowlist a
    join public.profiles p on p.email = a.email::text
    where p.id = auth.uid()
  );
$$;

-- has_feature(): resolve the CALLER's effective tier against a (page,feature) → boolean.
-- Precedence: an explicit feature_overrides row for the caller's tier wins; otherwise fall
-- back to feature_flags.min_tier vs the tier ladder. Educators are treated as 'pro'. Root
-- always passes. SECURITY DEFINER so it can read profiles/flags/overrides without RLS games.
create or replace function public.has_feature(p_page text, p_feature text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  caller_tier    text;
  effective_tier text;
  ov             boolean;
  need_tier      text;
  ladder         constant text[] := array['free','demo','pro','root'];
begin
  select tier into caller_tier from public.profiles where id = auth.uid();
  if caller_tier is null then
    caller_tier := 'free';                    -- anon / unknown → lowest tier
  end if;

  -- Educators consume the 'pro' column (educator is a role, not a tier).
  effective_tier := caller_tier;
  if effective_tier <> 'root' and public.is_educator() then
    effective_tier := 'pro';
  end if;

  if effective_tier = 'root' then
    return true;                              -- root passes everything
  end if;

  -- Explicit override for this exact (page, feature, effective tier) wins.
  select enabled into ov
  from public.feature_overrides
  where page_key = p_page and feature_key = p_feature and tier = effective_tier;
  if ov is not null then
    return ov;
  end if;

  -- Fallback: feature_flags.min_tier vs the caller's effective tier on the ladder.
  select min_tier into need_tier from public.feature_flags where key = p_feature;
  if need_tier is null then
    return false;                             -- unknown feature → deny by default
  end if;

  return array_position(ladder, effective_tier) >= array_position(ladder, need_tier);
end;
$$;


-- ===== Module 4 — per-user app data =========================================

-- Shared helper macro (documented, not code): every table below has
--   * user_id -> auth.users on delete cascade
--   * an index on (user_id, created_at desc) or (user_id, updated_at desc)
--   * full own-row CRUD RLS scoped to (select auth.uid()) = user_id
--   * a per-user row-count cap trigger (SECURITY DEFINER, mirrors enforce_scenario_limit)
--   * an updated_at trigger where the table is mutable

-- ---------- watchlists ----------
create table if not exists public.watchlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  items      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);
create index if not exists watchlists_user_idx on public.watchlists (user_id, updated_at desc);
alter table public.watchlists drop constraint if exists watchlists_name_chk;
alter table public.watchlists add  constraint watchlists_name_chk  check (char_length(name) between 1 and 120);
alter table public.watchlists drop constraint if exists watchlists_items_chk;
alter table public.watchlists add  constraint watchlists_items_chk check (pg_column_size(items) <= 65536);  -- 64 KB

alter table public.watchlists enable row level security;
drop policy if exists "watchlists: read own"   on public.watchlists;
drop policy if exists "watchlists: insert own" on public.watchlists;
drop policy if exists "watchlists: update own" on public.watchlists;
drop policy if exists "watchlists: delete own" on public.watchlists;
create policy "watchlists: read own"   on public.watchlists for select using ((select auth.uid()) = user_id);
create policy "watchlists: insert own" on public.watchlists for insert with check ((select auth.uid()) = user_id);
create policy "watchlists: update own" on public.watchlists for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "watchlists: delete own" on public.watchlists for delete using ((select auth.uid()) = user_id);

drop trigger if exists trg_watchlists_updated_at on public.watchlists;
create trigger trg_watchlists_updated_at
  before update on public.watchlists
  for each row execute function public.set_updated_at();

create or replace function public.enforce_watchlist_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.watchlists where user_id = new.user_id) >= 50 then
    raise exception 'watchlist limit reached (50). Delete some to add more.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_watchlist_limit on public.watchlists;
create trigger trg_watchlist_limit before insert on public.watchlists
  for each row execute function public.enforce_watchlist_limit();

-- ---------- portfolios ----------
create table if not exists public.portfolios (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  positions  jsonb not null default '[]'::jsonb,
  cash       numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);
create index if not exists portfolios_user_idx on public.portfolios (user_id, updated_at desc);
alter table public.portfolios drop constraint if exists portfolios_name_chk;
alter table public.portfolios add  constraint portfolios_name_chk      check (char_length(name) between 1 and 120);
alter table public.portfolios drop constraint if exists portfolios_positions_chk;
alter table public.portfolios add  constraint portfolios_positions_chk check (pg_column_size(positions) <= 131072);  -- 128 KB

alter table public.portfolios enable row level security;
drop policy if exists "portfolios: read own"   on public.portfolios;
drop policy if exists "portfolios: insert own" on public.portfolios;
drop policy if exists "portfolios: update own" on public.portfolios;
drop policy if exists "portfolios: delete own" on public.portfolios;
create policy "portfolios: read own"   on public.portfolios for select using ((select auth.uid()) = user_id);
create policy "portfolios: insert own" on public.portfolios for insert with check ((select auth.uid()) = user_id);
create policy "portfolios: update own" on public.portfolios for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "portfolios: delete own" on public.portfolios for delete using ((select auth.uid()) = user_id);

drop trigger if exists trg_portfolios_updated_at on public.portfolios;
create trigger trg_portfolios_updated_at
  before update on public.portfolios
  for each row execute function public.set_updated_at();

create or replace function public.enforce_portfolio_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.portfolios where user_id = new.user_id) >= 50 then
    raise exception 'portfolio limit reached (50). Delete some to add more.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_portfolio_limit on public.portfolios;
create trigger trg_portfolio_limit before insert on public.portfolios
  for each row execute function public.enforce_portfolio_limit();

-- ---------- price_alerts ----------
create table if not exists public.price_alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  symbol       text not null,
  target_price numeric not null,
  direction    text not null,
  status       text not null default 'active',
  created_at   timestamptz not null default now(),
  triggered_at timestamptz
);
create index if not exists price_alerts_user_idx   on public.price_alerts (user_id, created_at desc);
create index if not exists price_alerts_active_idx on public.price_alerts (user_id, status);
alter table public.price_alerts drop constraint if exists price_alerts_symbol_chk;
alter table public.price_alerts add  constraint price_alerts_symbol_chk    check (char_length(symbol) between 1 and 40);
alter table public.price_alerts drop constraint if exists price_alerts_direction_chk;
alter table public.price_alerts add  constraint price_alerts_direction_chk check (direction in ('above','below'));
alter table public.price_alerts drop constraint if exists price_alerts_status_chk;
alter table public.price_alerts add  constraint price_alerts_status_chk    check (status in ('active','triggered','snoozed'));

alter table public.price_alerts enable row level security;
drop policy if exists "alerts: read own"   on public.price_alerts;
drop policy if exists "alerts: insert own" on public.price_alerts;
drop policy if exists "alerts: update own" on public.price_alerts;
drop policy if exists "alerts: delete own" on public.price_alerts;
create policy "alerts: read own"   on public.price_alerts for select using ((select auth.uid()) = user_id);
create policy "alerts: insert own" on public.price_alerts for insert with check ((select auth.uid()) = user_id);
create policy "alerts: update own" on public.price_alerts for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "alerts: delete own" on public.price_alerts for delete using ((select auth.uid()) = user_id);

create or replace function public.enforce_price_alert_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.price_alerts where user_id = new.user_id) >= 200 then
    raise exception 'price alert limit reached (200). Delete some to add more.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_price_alert_limit on public.price_alerts;
create trigger trg_price_alert_limit before insert on public.price_alerts
  for each row execute function public.enforce_price_alert_limit();

-- ---------- bookmarks ----------
create table if not exists public.bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  page_key   text not null,
  section_id text,
  label      text,
  created_at timestamptz not null default now()
);
create index if not exists bookmarks_user_idx on public.bookmarks (user_id, created_at desc);
alter table public.bookmarks drop constraint if exists bookmarks_page_key_chk;
alter table public.bookmarks add  constraint bookmarks_page_key_chk check (char_length(page_key) between 1 and 200);
alter table public.bookmarks drop constraint if exists bookmarks_label_chk;
alter table public.bookmarks add  constraint bookmarks_label_chk    check (label is null or char_length(label) <= 200);

alter table public.bookmarks enable row level security;
drop policy if exists "bookmarks: read own"   on public.bookmarks;
drop policy if exists "bookmarks: insert own" on public.bookmarks;
drop policy if exists "bookmarks: update own" on public.bookmarks;
drop policy if exists "bookmarks: delete own" on public.bookmarks;
create policy "bookmarks: read own"   on public.bookmarks for select using ((select auth.uid()) = user_id);
create policy "bookmarks: insert own" on public.bookmarks for insert with check ((select auth.uid()) = user_id);
create policy "bookmarks: update own" on public.bookmarks for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "bookmarks: delete own" on public.bookmarks for delete using ((select auth.uid()) = user_id);

create or replace function public.enforce_bookmark_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.bookmarks where user_id = new.user_id) >= 500 then
    raise exception 'bookmark limit reached (500). Delete some to add more.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_bookmark_limit on public.bookmarks;
create trigger trg_bookmark_limit before insert on public.bookmarks
  for each row execute function public.enforce_bookmark_limit();

-- ---------- app_state (per-user key/value blob, one row per key) ----------
create table if not exists public.app_state (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  key        text not null,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  unique (user_id, key)
);
create index if not exists app_state_user_idx on public.app_state (user_id, updated_at desc);
alter table public.app_state drop constraint if exists app_state_key_chk;
alter table public.app_state add  constraint app_state_key_chk   check (char_length(key) between 1 and 120);
alter table public.app_state drop constraint if exists app_state_state_chk;
alter table public.app_state add  constraint app_state_state_chk check (pg_column_size(state) <= 131072);  -- 128 KB

alter table public.app_state enable row level security;
drop policy if exists "app_state: read own"   on public.app_state;
drop policy if exists "app_state: insert own" on public.app_state;
drop policy if exists "app_state: update own" on public.app_state;
drop policy if exists "app_state: delete own" on public.app_state;
create policy "app_state: read own"   on public.app_state for select using ((select auth.uid()) = user_id);
create policy "app_state: insert own" on public.app_state for insert with check ((select auth.uid()) = user_id);
create policy "app_state: update own" on public.app_state for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "app_state: delete own" on public.app_state for delete using ((select auth.uid()) = user_id);

drop trigger if exists trg_app_state_updated_at on public.app_state;
create trigger trg_app_state_updated_at
  before update on public.app_state
  for each row execute function public.set_updated_at();

create or replace function public.enforce_app_state_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.app_state where user_id = new.user_id) >= 200 then
    raise exception 'app_state key limit reached (200).';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_app_state_limit on public.app_state;
create trigger trg_app_state_limit before insert on public.app_state
  for each row execute function public.enforce_app_state_limit();


-- ===== Module 5 — observability (audit log) =================================

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id),
  action      text not null,
  target_type text,
  target_id   text,
  meta        jsonb not null default '{}'::jsonb,
  ip          inet,
  ua          text,
  created_at  timestamptz not null default now()
);
alter table public.audit_log drop constraint if exists audit_log_meta_chk;
alter table public.audit_log add  constraint audit_log_meta_chk check (pg_column_size(meta) <= 32768);  -- 32 KB
create index if not exists audit_log_created_idx    on public.audit_log (created_at desc);
create index if not exists audit_log_actor_idx      on public.audit_log (actor_id, created_at desc);

alter table public.audit_log enable row level security;
drop policy if exists "audit: read own"      on public.audit_log;
drop policy if exists "audit: root reads all" on public.audit_log;
-- Read: a user sees their own events; root sees everything. NO client insert/update/delete
-- policy → the ONLY write path is the SECURITY DEFINER log_event() fn + the profile trigger.
create policy "audit: read own"       on public.audit_log for select using ((select auth.uid()) = actor_id);
create policy "audit: root reads all" on public.audit_log for select using ((select public.is_root()));

-- log_event(): controlled insert as the CALLER (actor_id forced to auth.uid()). SECURITY
-- DEFINER so callers need no direct insert grant; they still cannot forge a different actor.
create or replace function public.log_event(
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if p_action is null or char_length(p_action) = 0 then
    raise exception 'action is required';
  end if;
  if pg_column_size(coalesce(p_meta, '{}'::jsonb)) > 32768 then
    raise exception 'meta too large (32 KB max)';
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_meta, '{}'::jsonb))
  returning id into new_id;
  return new_id;
end;
$$;

-- Auto-audit privilege changes on profiles: whenever tier or role actually changes, record
-- an audit_log row attributing it to the acting session (auth.uid()) with old/new in meta.
create or replace function public.audit_profile_privilege_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tier is distinct from old.tier then
    insert into public.audit_log (actor_id, action, target_type, target_id, meta)
    values ((select auth.uid()), 'tier_change', 'profile', new.id::text,
            jsonb_build_object('old', old.tier, 'new', new.tier));
  end if;
  if new.role is distinct from old.role then
    insert into public.audit_log (actor_id, action, target_type, target_id, meta)
    values ((select auth.uid()), 'role_change', 'profile', new.id::text,
            jsonb_build_object('old', old.role, 'new', new.role));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profile_privilege_audit on public.profiles;
create trigger trg_profile_privilege_audit
  after update of tier, role on public.profiles
  for each row execute function public.audit_profile_privilege_change();


-- ===== Module 6 — newsletter ================================================

create table if not exists public.newsletter_subscribers (
  id           uuid primary key default gen_random_uuid(),
  email        citext not null unique,
  status       text not null default 'subscribed',
  source       text,
  tags         jsonb not null default '[]'::jsonb,
  confirmed_at timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.newsletter_subscribers drop constraint if exists newsletter_status_chk;
alter table public.newsletter_subscribers add  constraint newsletter_status_chk check (status in ('subscribed','unsubscribed'));
alter table public.newsletter_subscribers drop constraint if exists newsletter_tags_chk;
alter table public.newsletter_subscribers add  constraint newsletter_tags_chk   check (pg_column_size(tags) <= 8192);

alter table public.newsletter_subscribers enable row level security;
drop policy if exists "newsletter: root reads all" on public.newsletter_subscribers;
-- Root reads all; NO public select (the subscriber list is not public); NO raw public insert
-- (signup goes through the SECURITY DEFINER subscribe_newsletter() fn, which validates shape).
create policy "newsletter: root reads all" on public.newsletter_subscribers for select using ((select public.is_root()));

-- subscribe_newsletter(): validated public signup. SECURITY DEFINER so anon can call it
-- without any table insert grant. Validates the email shape, then upserts (re-subscribing a
-- previously-unsubscribed email flips status back to 'subscribed'). Returns nothing sensitive.
create or replace function public.subscribe_newsletter(p_email citext, p_source text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_email is null or p_email::text !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email';
  end if;
  if char_length(p_email::text) > 254 then
    raise exception 'email too long';
  end if;
  insert into public.newsletter_subscribers (email, source, status)
  values (p_email, left(coalesce(p_source, ''), 120), 'subscribed')
  on conflict (email) do update
    set status = 'subscribed',
        source = coalesce(excluded.source, public.newsletter_subscribers.source);
end;
$$;


-- ===== Module 7 — billing scaffold (future Mayar) ===========================
-- Populated ONLY by the payment provider webhook via the service_role key (which bypasses
-- RLS). Users can READ their own rows; there is NO client insert/update/delete policy.

create table if not exists public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  plan               text not null,
  status             text not null,
  provider           text not null default 'mayar',
  external_id        text,
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz default now()
);
create index if not exists subscriptions_user_idx     on public.subscriptions (user_id, created_at desc);
create index if not exists subscriptions_external_idx on public.subscriptions (provider, external_id);
alter table public.subscriptions drop constraint if exists subscriptions_status_chk;
alter table public.subscriptions add  constraint subscriptions_status_chk check (status in ('active','past_due','canceled','trialing'));

alter table public.subscriptions enable row level security;
drop policy if exists "subs: read own" on public.subscriptions;
-- Read own only. NO insert/update/delete policy → writes come solely from the webhook
-- (service_role bypasses RLS). Root also inherits read via the profiles/service tooling.
create policy "subs: read own" on public.subscriptions for select using ((select auth.uid()) = user_id);

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  amount          numeric,
  currency        text not null default 'IDR',
  status          text,
  provider_ref    text,
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
create index if not exists payments_sub_idx  on public.payments (subscription_id);

alter table public.payments enable row level security;
drop policy if exists "payments: read own" on public.payments;
-- Read own only. NO insert/update/delete policy → writes come solely from the webhook.
create policy "payments: read own" on public.payments for select using ((select auth.uid()) = user_id);


-- ===== Module 9 — dcmoc_projects (cloud project bundles + share-by-token) ===
-- DCMOC ProjectBundle v1 saved per user. localStorage stays PRIMARY in the app;
-- cloud is an optional logged-in backup. bundle excludes heroImage (stored
-- separately client-side). share_token null = private; a 32-byte random
-- base64url token (client-generated) makes the row readable via the anon RPC
-- get_shared_project() ONLY — the table itself never allows anon SELECT.

create table if not exists public.dcmoc_projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  bundle      jsonb not null,
  version     int  not null default 1,
  share_token text unique,
  shared_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz default now()
);
create index if not exists dcmoc_projects_user_idx  on public.dcmoc_projects (user_id, updated_at desc);
create index if not exists dcmoc_projects_token_idx on public.dcmoc_projects (share_token) where share_token is not null;

alter table public.dcmoc_projects drop constraint if exists dcmoc_projects_name_chk;
alter table public.dcmoc_projects add  constraint dcmoc_projects_name_chk   check (char_length(name) between 1 and 120);
alter table public.dcmoc_projects drop constraint if exists dcmoc_projects_bundle_chk;
alter table public.dcmoc_projects add  constraint dcmoc_projects_bundle_chk check (pg_column_size(bundle) <= 262144);  -- 256 KB
alter table public.dcmoc_projects drop constraint if exists dcmoc_projects_token_chk;
alter table public.dcmoc_projects add  constraint dcmoc_projects_token_chk  check (share_token is null or share_token ~ '^[A-Za-z0-9_-]{22,64}$');

alter table public.dcmoc_projects enable row level security;
drop policy if exists "dcmoc: read own"   on public.dcmoc_projects;
drop policy if exists "dcmoc: insert own" on public.dcmoc_projects;
drop policy if exists "dcmoc: update own" on public.dcmoc_projects;
drop policy if exists "dcmoc: delete own" on public.dcmoc_projects;
create policy "dcmoc: read own"   on public.dcmoc_projects for select using ((select auth.uid()) = user_id);
create policy "dcmoc: insert own" on public.dcmoc_projects for insert with check ((select auth.uid()) = user_id);
create policy "dcmoc: update own" on public.dcmoc_projects for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dcmoc: delete own" on public.dcmoc_projects for delete using ((select auth.uid()) = user_id);

create or replace function public.enforce_dcmoc_project_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.dcmoc_projects where user_id = new.user_id) >= 20 then
    raise exception 'project limit reached (20).';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_dcmoc_project_limit on public.dcmoc_projects;
create trigger trg_dcmoc_project_limit before insert on public.dcmoc_projects
  for each row execute function public.enforce_dcmoc_project_limit();

drop trigger if exists trg_dcmoc_projects_updated_at on public.dcmoc_projects;
create trigger trg_dcmoc_projects_updated_at before update on public.dcmoc_projects
  for each row execute function public.set_updated_at();

-- Anon share read: token-gated RPC only (mirrors subscribe_newsletter template).
-- Returns NO PII (no user_id/email); uniform 'not found' on any miss.
create or replace function public.get_shared_project(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{22,64}$' then
    raise exception 'not found';
  end if;
  select jsonb_build_object('name', name, 'bundle', bundle, 'version', version, 'shared_at', shared_at)
    into r
    from public.dcmoc_projects
   where share_token = p_token;
  if r is null then raise exception 'not found'; end if;
  return r;
end;
$$;

-- ===== Module 8 — grants (RLS does the row-level authorization) =============
-- The anon + authenticated roles get USAGE on the schema only; every table's access is then
-- gated by the RLS policies above. SECURITY DEFINER functions that MUST be authenticated have
-- their anon EXECUTE revoked (admin_set_tier/admin_set_role already revoked in Module 1);
-- has_feature/log_event stay callable by authenticated; subscribe_newsletter stays callable
-- by anon (public newsletter signup).

grant usage on schema public to anon, authenticated;

-- log_event must be an authenticated action (actor = auth.uid()); strip the anon surface.
revoke execute on function public.log_event(text, text, text, jsonb) from anon;

-- Done. Verify:
--   select tablename, rowsecurity from pg_tables where schemaname = 'public';   -- every row true
--   select id, email, tier, role from public.profiles order by created_at;
