-- ============================================================================
-- resistancezero.com — Supabase schema (run once in Supabase → SQL Editor → Run)
-- Safe to re-run (idempotent). Creates:
--   • profiles         — one row per user; holds their `tier`. Auto-created on signup.
--   • saved_scenarios  — per-user saved calculator scenarios (the first "save data" feature).
-- Both are protected by Row Level Security (RLS): a user can only touch their OWN rows,
-- which is what makes the public anon/publishable key safe to ship in the browser.
-- ============================================================================

-- ---------- 1. profiles ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  tier         text not null default 'free',   -- 'free' | 'demo' | 'pro' | 'root'
  display_name text,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own"   on public.profiles;
drop policy if exists "profiles: update own"  on public.profiles;   -- removed: see note below
drop policy if exists "profiles: insert own"  on public.profiles;
create policy "profiles: read own"   on public.profiles for select using  (auth.uid() = id);
create policy "profiles: insert own" on public.profiles for insert with check (auth.uid() = id);
-- NOTE: intentionally NO client update policy on profiles. `tier` is a privilege field —
-- a plain "update own" policy would let any signed-in user run `update profiles set tier='root'`
-- via the anon key (privilege escalation). Tier changes must be done server-side (admin SQL or a
-- SECURITY DEFINER RPC). If per-user editing of a SAFE column (e.g. display_name) is needed later,
-- add a column-scoped policy or a definer function that only touches that column — never `tier`.

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

alter table public.saved_scenarios enable row level security;

drop policy if exists "scenarios: read own"   on public.saved_scenarios;
drop policy if exists "scenarios: insert own" on public.saved_scenarios;
drop policy if exists "scenarios: update own" on public.saved_scenarios;
drop policy if exists "scenarios: delete own" on public.saved_scenarios;
create policy "scenarios: read own"   on public.saved_scenarios for select using (auth.uid() = user_id);
create policy "scenarios: insert own" on public.saved_scenarios for insert with check (auth.uid() = user_id);
create policy "scenarios: update own" on public.saved_scenarios for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "scenarios: delete own" on public.saved_scenarios for delete using (auth.uid() = user_id);

-- ---------- 3. auto-create a profile on each new signup ----------
-- Owner emails get tier='root'; everyone else starts 'free'. Adjust the list as needed.
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

-- ---------- 4. backfill profiles for users who signed up BEFORE this ran ----------
insert into public.profiles (id, email, tier)
select u.id, u.email,
       case when lower(u.email) in (
         'bagusdpermana7@gmail.com',
         'bagus@resistancezero.com',
         'admin@resistancezero.com'
       ) then 'root' else 'free' end
from auth.users u
on conflict (id) do nothing;

-- ---------- 5. root admin: read + change ANY tier from the browser (rz-ops console) ----------
-- is_root() is SECURITY DEFINER so it reads `profiles` WITHOUT triggering RLS — this avoids the
-- infinite recursion you'd get if a policy ON profiles queried profiles under RLS. It returns true
-- only when the CURRENT caller (auth.uid()) is a root account. The rz-ops "Supabase Accounts" panel
-- relies on these two policies; a non-root caller matches neither, so they can only see/edit their
-- own row (via the "read own" / no-update rules above). No service_role key is ever shipped to the browser.
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

drop policy if exists "profiles: root reads all"   on public.profiles;
drop policy if exists "profiles: root updates all" on public.profiles;
create policy "profiles: root reads all"   on public.profiles for select using (public.is_root());
create policy "profiles: root updates all" on public.profiles for update using (public.is_root()) with check (public.is_root());

-- Done. Verify: select id, email, tier from public.profiles;
