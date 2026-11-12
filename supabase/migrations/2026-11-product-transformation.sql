-- Product transformation — the single owner-applied SQL bundle (Phase 3 amendment C7).
-- STATUS: BLOCKED — nothing in this file is applied or used by the site. The owner reviews and runs it in the
-- Supabase SQL editor; until then every feature below stays local to the browser (stage 1).
-- Each section is idempotent and names the PRD it serves. Sessions add their section; never edit another's.

-- ===== P06 stage 2 — Cx record sets (PRD-P06 §5, §10) ======================================================
-- Stage 1 (live) keeps record sets in localStorage rz_cx_records_v1 and exports JSON. This table would let a
-- signed-in user keep the same JSON body server-side. Own-row RLS, same shape as saved_scenarios; no anon access.

create table if not exists public.cx_record_sets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  project_id uuid null,
  name       text not null,
  body       jsonb not null,
  rev        int  not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cx_record_sets drop constraint if exists cx_record_sets_name_chk;
alter table public.cx_record_sets add  constraint cx_record_sets_name_chk check (char_length(name) between 1 and 120);
alter table public.cx_record_sets drop constraint if exists cx_record_sets_body_chk;
alter table public.cx_record_sets add  constraint cx_record_sets_body_chk check (pg_column_size(body) <= 2097152);  -- 2 MB, same cap as stage 1
alter table public.cx_record_sets drop constraint if exists cx_record_sets_rev_chk;
alter table public.cx_record_sets add  constraint cx_record_sets_rev_chk  check (rev >= 1);

create index if not exists cx_record_sets_user_idx on public.cx_record_sets (user_id, updated_at desc);

alter table public.cx_record_sets enable row level security;
revoke all on public.cx_record_sets from anon;

drop policy if exists "cx sets: read own"   on public.cx_record_sets;
drop policy if exists "cx sets: insert own" on public.cx_record_sets;
drop policy if exists "cx sets: update own" on public.cx_record_sets;
drop policy if exists "cx sets: delete own" on public.cx_record_sets;
create policy "cx sets: read own"   on public.cx_record_sets for select using ((select auth.uid()) = user_id);
create policy "cx sets: insert own" on public.cx_record_sets for insert with check ((select auth.uid()) = user_id);
create policy "cx sets: update own" on public.cx_record_sets for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "cx sets: delete own" on public.cx_record_sets for delete using ((select auth.uid()) = user_id);

-- Check after running (two signed-in users A and B):
--   A inserts a row; B: select count(*) from public.cx_record_sets where id = '<A row>';   -- 0
--   B: update public.cx_record_sets set name = 'x' where id = '<A row>';                    -- 0 rows
--   as anon: select * from public.cx_record_sets;                                             -- permission denied
