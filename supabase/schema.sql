-- ============================================================================
-- resistancezero.com — Supabase schema (run once in Supabase → SQL Editor → Run)
-- Idempotent — safe to re-run any time. Creates:
--   • profiles         — one row per user; holds their `tier`. Auto-created on signup.
--   • saved_scenarios  — per-user saved calculator scenarios (the "save data" feature).
--
-- SECURITY MODEL (why the public anon/publishable key is safe in the browser):
--   Everything is guarded by Row Level Security (RLS) + hardened, so the anon key can
--   only ever do what an authenticated user is allowed to do to THEIR OWN rows.
--   • profiles has NO client INSERT and NO client UPDATE path at all:
--       - rows are created ONLY by the SECURITY DEFINER signup trigger (handle_new_user)
--       - `tier` is changed ONLY via the SECURITY DEFINER RPC admin_set_tier(), which
--         re-checks is_root() server-side and can touch NOTHING but the tier column.
--     → a signed-in user cannot escalate their own tier, even by crafting raw REST calls.
--   • saved_scenarios: a user can only touch rows where user_id = auth.uid(), with
--     DB-level CHECK constraints (name/calc length, payload size) + a per-user row cap.
--   The service_role key + DB password are NEVER shipped to the browser.
-- ============================================================================

-- ---------- 1. profiles ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  tier         text not null default 'free',   -- 'free' | 'demo' | 'pro' | 'root'
  display_name text,
  created_at   timestamptz not null default now()
);

-- DB-level whitelist: an invalid tier can never be stored, even via a bug or admin typo.
alter table public.profiles drop constraint if exists profiles_tier_chk;
alter table public.profiles add  constraint profiles_tier_chk check (tier in ('free','demo','pro','root'));

-- is_root() must exist BEFORE the "root reads all" policy below references it.
-- SECURITY DEFINER so it reads `profiles` WITHOUT triggering RLS — this avoids the infinite
-- recursion you'd get if a policy ON profiles queried profiles under RLS. STABLE + pinned
-- search_path. Used by the "root reads all" policy and by admin_set_tier() further down.
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
create policy "profiles: read own"       on public.profiles for select using (auth.uid() = id);
create policy "profiles: root reads all" on public.profiles for select using (public.is_root());
-- NOTE: intentionally NO insert/update/delete policy on profiles. Creation = trigger only;
-- tier changes = admin_set_tier() RPC only. This closes tier self-escalation completely.

-- ---------- 2. saved_scenarios ----------
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
create policy "scenarios: read own"   on public.saved_scenarios for select using (auth.uid() = user_id);
create policy "scenarios: insert own" on public.saved_scenarios for insert with check (auth.uid() = user_id);
create policy "scenarios: update own" on public.saved_scenarios for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "scenarios: delete own" on public.saved_scenarios for delete using (auth.uid() = user_id);

-- Per-user row cap (storage-abuse defense). Runs as invoker → the count is itself RLS-scoped
-- to the user's own rows, which is exactly what we want to bound.
create or replace function public.enforce_scenario_limit()
returns trigger
language plpgsql
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

-- ---------- 3. auto-create a profile on each new signup ----------
-- Owner emails get tier='root'; everyone else ALWAYS starts 'free'. The trigger constructs the
-- row itself, so a client cannot influence the tier at creation time.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, tier)
  values (
    new.id,
    new.email,
    case when lower(new.email) in (
      'bagusdpermana7@gmail.com',
      'bagus@resistancezero.com',
      'admin@resistancezero.com'
    ) then 'root' else 'free' end
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
insert into public.profiles (id, email, tier)
select u.id, u.email,
       case when lower(u.email) in (
         'bagusdpermana7@gmail.com',
         'bagus@resistancezero.com',
         'admin@resistancezero.com'
       ) then 'root' else 'free' end
from auth.users u
on conflict (id) do nothing;

-- ---------- 4. admin_set_tier(): the ONLY way to change a tier from the app ----------
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

-- Only signed-in users may even attempt it; anon (logged-out) cannot. The is_root() gate inside
-- does the real authorization — this REVOKE just removes the pointless anon-callable surface.
revoke execute on function public.admin_set_tier(uuid, text) from anon;

-- Done. Verify:  select id, email, tier from public.profiles order by created_at;
