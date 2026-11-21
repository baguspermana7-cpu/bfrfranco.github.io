-- 2026-11-20 — Conventional point limits and history live in the database
-- (PRD-CONV-POINT-STATUS-TREND §5b, owner decisions OD-6 and OD-7).
--
-- WHAT: three tables and four functions.
--   conv_points          one row per point: limits (lo_alarm ≤ lo_warn < hi_warn ≤ hi_alarm, deadband), basis, evidence
--                        class, source, and the history definition (hist_base, hist_amp, hist_shape, hist_digits).
--                        Read: everyone. Write: public.is_root() only; every change writes audit_log (old + new row).
--   conv_point_samples   one value per point every 5 min, kept 48 h. Read: everyone. Write: only the functions below.
--   conv_point_rollup    min / max / mean / n per point per 30 min, kept 35 d. Same access.
--   conv_sample_tick(at) writes the 5-min sample at `at`, rolls up the last closed 30-min window, prunes past retention.
--                        pg_cron runs it every 5 min (job 'conv-sample-tick'). No secret lives outside the database.
--   conv_backfill(days)  fills the last `days` (1–35) once: samples for the last 48 h, rollups for the whole span.
--   conv_point_series(id, from, to)  the reader: samples when the window is ≤ 24 h, the rollup otherwise.
--
-- The values are the SQL port of js/conv/history.js RZConvHistory.value(def, minute): FNV-1a hash with the exact
-- double-rounding of the JS `(h * 16777619) >>> 0`, Math.imul as 32-bit masks, Math.round as V8 computes it, at
-- digits + 1. The model is deterministic, so the database equals the browser's fallback (gate:
-- tools/test-conv-points-sql.mjs, 50 points × 2,000 minutes to the digit).
--
-- Idempotent: re-running changes nothing except the seed rows whose values differ from git (each such change is
-- audited). Apply: Supabase dashboard → SQL editor → paste this file → Run. Runbook:
-- documentation/product-transformation/02-prds/PRD-CONV-POINT-STATUS-TREND/RUNBOOK-DB.md
-- Requires supabase/schema.sql (public.is_root, public.audit_log, public.set_updated_at).

create extension if not exists pg_cron with schema pg_catalog;

-- ===== tables =====================================================================================================

create table if not exists public.conv_points (
  id             text primary key,
  label          text not null default '',
  unit           text not null default '',
  page           text,
  lo_alarm       double precision,
  lo_warn        double precision,
  hi_warn        double precision,
  hi_alarm       double precision,
  deadband       double precision,
  basis          text,
  evidence_class text,
  source_ref     text,
  source_as_of   text,
  hist_base      double precision,
  hist_amp       double precision,
  hist_shape     text not null default 'load',
  hist_digits    integer not null default 1,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
alter table public.conv_points drop constraint if exists conv_points_id_chk;
alter table public.conv_points add  constraint conv_points_id_chk check (id ~ '^[A-Za-z0-9_.:-]{1,120}$');   -- ASCII: the hash reads code units
alter table public.conv_points drop constraint if exists conv_points_order_chk;
alter table public.conv_points add  constraint conv_points_order_chk check (
      (lo_alarm is null or lo_warn  is null or lo_alarm <= lo_warn)
  and (lo_warn  is null or hi_warn  is null or lo_warn  <  hi_warn)
  and (hi_warn  is null or hi_alarm is null or hi_warn  <= hi_alarm)
  and (lo_alarm is null or hi_alarm is null or lo_alarm <  hi_alarm)
  and (lo_alarm is null or hi_warn  is null or lo_alarm <  hi_warn)
  and (lo_warn  is null or hi_alarm is null or lo_warn  <  hi_alarm));
alter table public.conv_points drop constraint if exists conv_points_deadband_chk;
alter table public.conv_points add  constraint conv_points_deadband_chk check (deadband is null or deadband >= 0);
alter table public.conv_points drop constraint if exists conv_points_hist_chk;
alter table public.conv_points add  constraint conv_points_hist_chk check (hist_shape in ('flat','load','saw') and hist_digits between 0 and 6);
alter table public.conv_points drop constraint if exists conv_points_evidence_chk;
alter table public.conv_points add  constraint conv_points_evidence_chk check (evidence_class is null or evidence_class in
  ('MEASURED','DERIVED','SIMULATED','ADOPTED','ASSUMED','VENDOR','STANDARD','UNAVAILABLE'));
alter table public.conv_points drop constraint if exists conv_points_text_chk;
alter table public.conv_points add  constraint conv_points_text_chk check (
  length(label) <= 200 and length(unit) <= 24 and coalesce(length(basis), 0) <= 2000 and coalesce(length(source_ref), 0) <= 400);

create table if not exists public.conv_point_samples (
  point_id text not null references public.conv_points (id) on delete cascade,
  ts       timestamptz not null,
  value    double precision not null,
  primary key (point_id, ts)
);
create index if not exists conv_point_samples_ts_idx on public.conv_point_samples (ts);

create table if not exists public.conv_point_rollup (
  point_id text not null references public.conv_points (id) on delete cascade,
  ts       timestamptz not null,
  v_min    double precision not null,
  v_max    double precision not null,
  v_mean   double precision not null,
  n        integer not null,
  primary key (point_id, ts)
);
create index if not exists conv_point_rollup_ts_idx on public.conv_point_rollup (ts);

-- ===== RLS =========================================================================================================

alter table public.conv_points        enable row level security;
alter table public.conv_point_samples enable row level security;
alter table public.conv_point_rollup  enable row level security;

drop policy if exists "conv points: all read"    on public.conv_points;
drop policy if exists "conv points: root insert" on public.conv_points;
drop policy if exists "conv points: root update" on public.conv_points;
drop policy if exists "conv points: root delete" on public.conv_points;
create policy "conv points: all read"    on public.conv_points for select using (true);
create policy "conv points: root insert" on public.conv_points for insert with check ((select public.is_root()));
create policy "conv points: root update" on public.conv_points for update using ((select public.is_root())) with check ((select public.is_root()));
create policy "conv points: root delete" on public.conv_points for delete using ((select public.is_root()));

-- Samples and rollups: read only. NO insert/update/delete policy: the only writers are the SECURITY DEFINER functions.
drop policy if exists "conv samples: all read" on public.conv_point_samples;
drop policy if exists "conv rollup: all read"  on public.conv_point_rollup;
create policy "conv samples: all read" on public.conv_point_samples for select using (true);
create policy "conv rollup: all read"  on public.conv_point_rollup  for select using (true);

-- ===== audit: every change of a point row goes to audit_log with the old and the new row ============================

create or replace function public.conv_points_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists trg_conv_points_stamp on public.conv_points;
create trigger trg_conv_points_stamp before insert or update on public.conv_points
  for each row execute function public.conv_points_stamp();

create or replace function public.conv_points_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values ((select auth.uid()), 'conv_point_' || lower(tg_op), 'conv_point', coalesce(new.id, old.id),
          jsonb_build_object('old', case when tg_op = 'INSERT' then null else to_jsonb(old) end,
                             'new', case when tg_op = 'DELETE' then null else to_jsonb(new) end));
  return null;
end;
$$;
drop trigger if exists trg_conv_points_audit on public.conv_points;
create trigger trg_conv_points_audit after insert or update or delete on public.conv_points
  for each row execute function public.conv_points_audit();

-- ===== the history model (port of js/conv/history.js) =============================================================

-- FNV-1a as the JS computes it, which is NOT textbook FNV: `h ^= c` makes h a SIGNED int32, and `(h * 16777619) >>> 0`
-- multiplies in DOUBLE precision (the product can pass 2^53 and is rounded to 53 bits) before taking the low 32 bits.
-- Signed fold + float8 multiply + exact float8→bigint cast + mask reproduce it (checked on 5,019 ids in Node).
create or replace function public.conv_hist_hash(s text)
returns bigint
language plpgsql
immutable strict
set search_path = public
as $$
declare
  h bigint := 2166136261;
  i integer;
begin
  for i in 1 .. length(s) loop
    h := h # ascii(substr(s, i, 1));
    if h >= 2147483648 then h := h - 4294967296; end if;
    h := ((h::double precision * 16777619::double precision)::bigint) & 4294967295;
  end loop;
  return h;
end;
$$;

-- Math.imul(a, c) >>> 0 for a, c in 0 .. 2^32-1: the low 32 bits of a * c, split so no product passes 2^63.
create or replace function public.conv_hist_imul(a bigint, c bigint)
returns bigint
language sql
immutable strict
set search_path = public
as $$
  select ((a * (c & 65535)) + (((a * (c >> 16)) & 65535) << 16)) & 4294967295;
$$;

-- noise(id, minute) in -1 .. 1, from the hash of the id.
create or replace function public.conv_hist_noise(h bigint, minute bigint)
returns double precision
language plpgsql
immutable strict
set search_path = public
as $$
declare
  x bigint;
begin
  x := h # ((minute * 2654435761) & 4294967295);
  x := x # (x >> 16);
  x := public.conv_hist_imul(x, 2246822507);
  x := x # (x >> 13);
  x := public.conv_hist_imul(x, 3266489909);
  x := x # (x >> 16);
  return x::double precision / 2147483647.5::double precision - 1::double precision;
end;
$$;

-- value(def, minute) with the hash already computed. Unknown shape = 'load' (as SHAPES[shape] || SHAPES.load).
create or replace function public.conv_hist_value_h(h bigint, base double precision, amp double precision,
                                                    shape text, digits integer, minute bigint)
returns double precision
language plpgsql
immutable
set search_path = public
as $$
declare
  a  double precision := coalesce(amp, 0);
  sh double precision;
  hh double precision;
  p  double precision;
  v  double precision;
  f  double precision;
  x  double precision;
  r  double precision;
begin
  if base is null or minute is null or h is null then return null; end if;
  if shape = 'flat' then
    sh := 0;
  elsif shape = 'saw' then
    p := (minute % 240)::double precision / 240::double precision;
    if p < 0.8::double precision then sh := 1::double precision - 2.5::double precision * p;
    else sh := -1::double precision + 10::double precision * (p - 0.8::double precision); end if;
  else
    hh := ((minute + 420) % 1440)::double precision / 60::double precision;
    sh := sin((hh - 8::double precision) / 24::double precision * 2::double precision * pi());
  end if;
  v := (base + a * sh) + (a * 0.12::double precision) * public.conv_hist_noise(h, minute);
  f := power(10::double precision, (coalesce(digits, 2) + 1)::double precision);
  x := v * f;
  r := ceil(x);                                  -- V8 Math.round: ceil, then one down if that overshot by > 0.5
  if r - 0.5::double precision > x then r := r - 1::double precision; end if;
  return r / f;
end;
$$;

create or replace function public.conv_hist_value(p_id text, base double precision, amp double precision,
                                                  shape text, digits integer, minute bigint)
returns double precision
language sql
immutable
set search_path = public
as $$
  select public.conv_hist_value_h(public.conv_hist_hash(p_id), base, amp, shape, digits, minute);
$$;

-- ===== writer ======================================================================================================

-- Roll up the 30-min windows starting at minutes w0, w0+30, … < w1 for every point, from the model at the 5-min
-- sample minutes (the same values the samples hold). Mean = ordered sum / n, as the JS recomputation adds them.
create or replace function public.conv_rollup_span(w0 bigint, w1 bigint)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  k integer;
begin
  insert into public.conv_point_rollup as r (point_id, ts, v_min, v_max, v_mean, n)
  select s.id, to_timestamp(s.w * 60), min(s.v), max(s.v), sum(s.v order by s.m) / count(*), count(*)
    from (select p.id, w.w, w.w + o.o as m,
                 public.conv_hist_value_h(p.h, p.hist_base, p.hist_amp, p.hist_shape, p.hist_digits, w.w + o.o) as v
            from (select id, hist_base, hist_amp, hist_shape, hist_digits, public.conv_hist_hash(id) as h
                    from public.conv_points where hist_base is not null) p
           cross join generate_series(w0, w1 - 30, 30) as w(w)
           cross join generate_series(0, 25, 5) as o(o)) s
   group by s.id, s.w
  on conflict (point_id, ts) do update
     set v_min = excluded.v_min, v_max = excluded.v_max, v_mean = excluded.v_mean, n = excluded.n;
  get diagnostics k = row_count;
  return k;
end;
$$;

-- Samples at every 5-min minute in [m0, m1).
create or replace function public.conv_samples_span(m0 bigint, m1 bigint)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  k integer;
begin
  insert into public.conv_point_samples (point_id, ts, value)
  select p.id, to_timestamp(m.m * 60), public.conv_hist_value_h(p.h, p.hist_base, p.hist_amp, p.hist_shape, p.hist_digits, m.m)
    from (select id, hist_base, hist_amp, hist_shape, hist_digits, public.conv_hist_hash(id) as h
            from public.conv_points where hist_base is not null) p
   cross join generate_series(m0 + ((5 - m0 % 5) % 5), m1 - 1, 5) as m(m)
  on conflict (point_id, ts) do update set value = excluded.value;
  get diagnostics k = row_count;
  return k;
end;
$$;

create or replace function public.conv_prune(at timestamptz)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.conv_point_samples where ts < at - interval '48 hours';
  delete from public.conv_point_rollup  where ts < at - interval '35 days';
$$;

-- One tick: the sample at the 5-min mark of `at`, the last closed 30-min window, the prune.
create or replace function public.conv_sample_tick(at timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  m  bigint := floor(extract(epoch from at) / 60)::bigint;
  m5 bigint;
  w  bigint;
  k  integer;
begin
  m5 := m - m % 5;
  k := public.conv_samples_span(m5, m5 + 1);
  w := m5 - m5 % 30 - 30;
  perform public.conv_rollup_span(w, w + 30);
  perform public.conv_prune(at);
  return k;
end;
$$;

-- Fill the last `days` once (install): samples for the last 48 h, rollups for every closed window of the span.
create or replace function public.conv_backfill(days integer default 30, at timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  m  bigint := floor(extract(epoch from at) / 60)::bigint;
  w1 bigint;
  k  integer;
begin
  if days is null or days < 1 or days > 35 then raise exception 'days must be 1 .. 35'; end if;
  k := public.conv_samples_span(greatest(m - days * 1440, m - 48 * 60) + 1, m + 1);
  w1 := m - m % 30;
  k := k + public.conv_rollup_span(w1 - days * 1440, w1);
  perform public.conv_prune(at);
  return k;
end;
$$;

-- ===== reader ======================================================================================================

-- Samples (t, v) when the window is ≤ 24 h, the rollup (t, v_min, v_max, v_mean, n) otherwise. Window ≤ 35 d.
-- An unknown id returns no rows (the client then draws the local model, not a "database unreachable" line).
create or replace function public.conv_point_series(p_id text, p_from timestamptz, p_to timestamptz)
returns table (t timestamptz, v double precision, v_min double precision, v_max double precision,
               v_mean double precision, n integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_id is null or p_from is null or p_to is null or p_to <= p_from then
    raise exception 'conv_point_series: need id and from < to';
  end if;
  if p_to - p_from > interval '35 days' then
    raise exception 'conv_point_series: window longer than 35 days';
  end if;
  if p_to - p_from <= interval '24 hours' then
    return query select s.ts, s.value, null::double precision, null::double precision, null::double precision, null::integer
                   from public.conv_point_samples s
                  where s.point_id = p_id and s.ts >= p_from and s.ts < p_to order by s.ts;
  else
    return query select r.ts, null::double precision, r.v_min, r.v_max, r.v_mean, r.n
                   from public.conv_point_rollup r
                  where r.point_id = p_id and r.ts >= p_from and r.ts < p_to order by r.ts;
  end if;
end;
$$;

-- ===== who may call what ===========================================================================================

revoke execute on function public.conv_sample_tick(timestamptz)          from public;
revoke execute on function public.conv_backfill(integer, timestamptz)    from public;
revoke execute on function public.conv_samples_span(bigint, bigint)      from public;
revoke execute on function public.conv_rollup_span(bigint, bigint)       from public;
revoke execute on function public.conv_prune(timestamptz)                from public;
revoke execute on function public.conv_points_audit()                    from public;
do $$
begin
  -- Supabase grants EXECUTE to anon/authenticated by default privileges: take it back from the writers.
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.conv_sample_tick(timestamptz)       from anon, authenticated;
    revoke execute on function public.conv_backfill(integer, timestamptz) from anon, authenticated;
    revoke execute on function public.conv_samples_span(bigint, bigint)   from anon, authenticated;
    revoke execute on function public.conv_rollup_span(bigint, bigint)    from anon, authenticated;
    revoke execute on function public.conv_prune(timestamptz)             from anon, authenticated;
    revoke execute on function public.conv_points_audit()                 from anon, authenticated;
    grant  execute on function public.conv_point_series(text, timestamptz, timestamptz) to anon, authenticated;
    grant  select on public.conv_points, public.conv_point_samples, public.conv_point_rollup to anon, authenticated;
    revoke insert, update, delete, truncate on public.conv_point_samples, public.conv_point_rollup from anon, authenticated;
    revoke truncate on public.conv_points from anon, authenticated;
  end if;
end;
$$;

-- ===== seed (GENERATED by tools/build-conv-points-seed.mjs from data/conv-limits.curated.json + data/conv-points.json;
--       never hand-edit between the markers; tools/test-generator-freshness.py runs it with --check) =================

-- BEGIN SEED
-- 33 points. Re-running resets a row to git only where a value differs (the change is audited).
insert into public.conv_points as c (id, label, unit, page, lo_alarm, lo_warn, hi_warn, hi_alarm, deadband, basis, evidence_class, source_ref, source_as_of, hist_base, hist_amp, hist_shape, hist_digits) values
  ('cdu-mini-bms.TT-01.supply_c', 'TCS supply temperature (CDU TT-01)', '°C', 'cdu-mini-bms.html', 15, 18, 37, 40, 0.3, 'Owner decision OD-3 (PRD-CONV-POINT-STATUS-TREND §12): warn 37 / alarm 40 °C high, warn 18 / alarm 15 °C low until a site design is given. Supersedes the page band 17–45 °C.', 'ASSUMED', 'documentation/product-transformation/02-prds/PRD-CONV-POINT-STATUS-TREND/PRD.md §4.2 owner example, §12 OD-3', '2026-11-20', 30, 0.8999999999999999, 'load', 1),
  ('cdu-mini-bms.FT-01.flow_lpm_per_kw', 'TCS specific flow (CDU FT-01)', 'LPM/kW', 'cdu-mini-bms.html', 0.9, 1, 1.5, 1.65, 0.01, 'Page band migrated as typed: warn outside [lo, hi], alarm outside [0.9·lo, 1.1·hi] (the page''s bandState rule).', 'ASSUMED', 'cdu-mini-bms.html TILES + bandState()', '2026-11-20', 1.3, 0.039, 'load', 2),
  ('cdu-mini-bms.DT-01.delta_t_c', 'TCS ΔT (CDU ΔT-01)', '°C', 'cdu-mini-bms.html', 7.2, 8, 12, 13.2, 0.1, 'Page band migrated as typed: warn outside [lo, hi], alarm outside [0.9·lo, 1.1·hi].', 'ASSUMED', 'cdu-mini-bms.html TILES + bandState()', '2026-11-20', 10, 0.3, 'load', 1),
  ('cdu-mini-bms.PDT-02.loop_dp_bar', 'TCS loop differential pressure (CDU PDT-02)', 'bar', 'cdu-mini-bms.html', 0.45, 0.5, 3, 3.3, 0.03, 'Page band migrated as typed: warn outside [lo, hi], alarm outside [0.9·lo, 1.1·hi].', 'ASSUMED', 'cdu-mini-bms.html TILES + bandState()', '2026-11-20', 1.2, 0.036, 'load', 2),
  ('cdu-mini-bms.PT-01.system_bar', 'TCS system pressure (CDU PT-01)', 'bar', 'cdu-mini-bms.html', 1.8, 2, 6, 6.6, 0.05, 'Page band migrated as typed: warn outside [lo, hi], alarm outside [0.9·lo, 1.1·hi].', 'ASSUMED', 'cdu-mini-bms.html TILES + bandState()', '2026-11-20', 3.5, 0.105, 'load', 2),
  ('cdu-mini-bms.LT-01.level_pct', 'TCS reservoir level (CDU LT-01)', '%', 'cdu-mini-bms.html', 40.5, 45, 70, 77, 0.5, 'Page band migrated as typed: warn outside [lo, hi], alarm outside [0.9·lo, 1.1·hi].', 'ASSUMED', 'cdu-mini-bms.html TILES + bandState()', '2026-11-20', 58, 1.74, 'load', 1),
  ('cdu-mini-bms.TT-D.approach_c', 'CDU heat-exchanger approach (TT-Δ)', '°C', 'cdu-mini-bms.html', 2.7, 3, 7, 7.7, 0.1, 'Page band migrated as typed: warn outside [lo, hi], alarm outside [0.9·lo, 1.1·hi].', 'ASSUMED', 'cdu-mini-bms.html TILES + bandState()', '2026-11-20', 5, 0.15, 'load', 1),
  ('environment.avg_temp_c', 'White-space average air temperature', '°C', 'dc-conventional.html', 15, 18, 27, 32, 0.2, 'ASHRAE 2015 Thermal Guidelines: recommended 18–27 °C (all classes) = normal band; Class A1 allowable 15–32 °C = alarm bounds. Same values the page typed.', 'STANDARD', 'ASHRAE TC 9.9, Data Center Power Equipment Thermal Guidelines and Best Practices (2016), Table 2 ''ASHRAE 2015 Thermal Guidelines'' (read 2026-11-20) Table 2: Recommended A1–A4 18 to 27 °C; Allowable A1 15 to 32 °C', '2026-11-20', 22.4, 0.6719999999999999, 'load', 1),
  ('environment.avg_rh_pct', 'White-space average relative humidity', '%', 'dc-conventional.html', null, 20, 80, null, 0.6, 'Page band migrated as typed (warn outside 20–80 % RH). The 2015 ASHRAE envelope is dew-point based (A1 allowable 8–80 % RH, recommended to 60 % RH); the page''s RH-only band is kept until a dew-point point exists.', 'ASSUMED', 'dc-conventional.html environment band', '2026-11-20', 48, 1.44, 'load', 1),
  ('datahall.rack.inlet_c', 'Rack inlet air temperature', '°C', 'datahall.html', 15, 18, 27, 30, 0.2, 'High side as typed on the data hall (doc-03 alarm rules: warn > 27 °C, crit > 30 °C; 27 °C = ASHRAE recommended maximum). Low side = ASHRAE recommended 18 °C / A1 allowable 15 °C.', 'STANDARD', 'ASHRAE TC 9.9 (2016) Table 2 ''ASHRAE 2015 Thermal Guidelines'' (read 2026-11-20); datahall.html doc-03 alarm rules Recommended 18 to 27 °C; A1 allowable 15 to 32 °C; doc-03 crit 30 °C', '2026-11-20', 25.4, 0.7619999999999999, 'load', 1),
  ('datahall.rack.load_pct', 'Rack load (share of rack rating)', '%', 'datahall.html', null, null, 85, 95, 0.5, 'Page rule migrated as typed (doc-03 alarm rules: warn rack > 85 % rating, crit > 95 %).', 'ASSUMED', 'datahall.html evaluateAlarms() doc-03 §Alarm Rules', '2026-11-20', 75, 2.25, 'load', 1),
  ('cooling.crah_supply_air_c', 'CRAH supply air temperature', '°C', 'datahall.html', 15, 18, 27, 32, 0.2, 'Supply air is the rack inlet plane in this model: ASHRAE 2015 recommended 18–27 °C = normal band, Class A1 allowable 15–32 °C = alarm bounds.', 'STANDARD', 'ASHRAE TC 9.9, Data Center Power Equipment Thermal Guidelines and Best Practices (2016), Table 2 ''ASHRAE 2015 Thermal Guidelines'' (read 2026-11-20) Table 2: Recommended 18 to 27 °C; Allowable A1 15 to 32 °C', '2026-11-20', 25.4, 0.7619999999999999, 'load', 1),
  ('cooling.chws_c', 'Chilled-water supply temperature', '°C', 'chiller-plant.html', 16.4, 17.9, 20.9, 22.4, 0.1, 'Engine design value 19.4 °C ± a declared margin: warn ±1.5 K, alarm ±3.0 K.', 'ASSUMED', 'js/conv-engine.js cooling.chws_c; margin declared in PRD-CONV-POINT-STATUS-TREND §5 basis order 2', '2026-11-20', 19.4, 0.582, 'load', 1),
  ('cooling.chwr_c', 'Chilled-water return temperature', '°C', 'chiller-plant.html', null, null, 27.8, 28.5, 0.1, 'Engine design value 27 °C + a declared margin: warn +0.8 K, alarm +1.5 K (the margins chiller-plant.html typed as LOOP_T2_WARNING_MAX / LOOP_T2_ALARM_MAX). High side only: a cold return is not an operating limit of the plant.', 'ASSUMED', 'js/conv-engine.js cooling.chwr_c; margins migrated from chiller-plant.html (PRD-CONV-POINT-STATUS-TREND §5 basis order 2)', '2026-11-21', 27, 0.6071428571428577, 'load', 1),
  ('cooling.cdw_supply_c', 'Condenser-water supply temperature', '°C', 'chiller-plant.html', 29, 30.5, 33.5, 35, 0.1, 'Engine design value 32 °C ± a declared margin: warn ±1.5 K, alarm ±3.0 K.', 'ASSUMED', 'js/conv-engine.js cooling.cdw_supply_c; margin declared in PRD-CONV-POINT-STATUS-TREND §5 basis order 2', '2026-11-20', 32, 0.96, 'load', 1),
  ('electrical.ups_load_pct_normal', 'UPS system load (2N, one side)', '%', 'EPMS_Telemetry.html', null, null, 45, 50, 0.5, '2N: above 50 % one side could not carry the other''s load on a transfer (alarm = redundancy lost); warn 5 points before it.', 'ASSUMED', 'js/conv-engine.js electrical.ups_redundancy = 2N, electrical.ups_load_pct_on_failover', '2026-11-20', 37.5, 1.125, 'load', 1),
  ('fuel-system.GEN.load_pct', 'Genset load (share of unit rating)', '%', 'fuel-system.html', null, null, 80, 100, 0.5, 'Warn at the engine''s declared maximum genset loading (electrical.genset_max_loading = 0.8); alarm at the unit rating (100 %).', 'ASSUMED', 'js/conv-engine.js electrical.genset_max_loading', '2026-11-20', 60, 1.7999999999999998, 'load', 1),
  ('fuel.level_pct', 'Bulk fuel tank level (UST-01)', '%', 'fuel-system.html', 30, 60, 95, null, 0.5, 'The engine''s own level setpoints: fuel.level_low_pct 60 (LO), fuel.level_low_low_pct 30 (LO-LO), fuel.level_overfill_pct 95 (overfill).', 'ASSUMED', 'js/conv-engine.js fuel.level_low_pct / level_low_low_pct / level_overfill_pct', '2026-11-20', 85, 2.55, 'flat', 1),
  ('fuel-system.DT.level_pct', 'Day-tank level (running genset)', '%', 'fuel-system.html', 25, 30, null, null, 0.5, 'The fuel mimic''s day-tank basis (FU-M-101): lead pump refills at DT_LOW 30 % (warn below it), low-low interlock at DT_LOWLOW 25 % (alarm). DT_HIGH 90 % is the pump stop setpoint, not a limit.', 'ASSUMED', 'fuel-system.html day-tank refill logic (DT_LOW / DT_LOWLOW / DT_HIGH)', '2026-11-20', 60, 1.7999999999999998, 'saw', 1),
  ('fire.static_pressure_bar', 'Fire main pressure', 'bar', 'fire-system.html', 8.5, 10.5, 14, 16, 0.1, 'Low side from the fire mimic: duty fire pump FP-1 starts at 10.5 bar (warn below it: the main is no longer held by the jockey 11.5/12.8 bar), low-pressure alarm at 8.5 bar. High side ASSUMED (PN16 pipework: warn 14, alarm 16 bar). NFPA 20 clauses not read: ASSUMED.', 'ASSUMED', 'fire-system.html P_JOCKEY_ON/OFF, P_FP1_ON, P_LOW_ALM', '2026-11-20', 12.5, 0.375, 'flat', 2),
  ('fuel.autonomy_hr', 'Fuel autonomy (usable fuel / consumption)', 'h', 'fuel-system.html', 24, null, null, null, 0.5, 'Alarm below the 24 h backup-power SLA that fuel-system.html declares (SLA_HR); dc-conventional.html typed warn < 24 h / crit < 12 h in its alarm strip, the SLA reading is kept because it is the contract (merge 2026-11-21): N+1 autonomy must exceed it. No separate warning band is declared: ASSUMED.', 'ASSUMED', 'fuel-system.html SLA_HR; js/conv-engine.js fuel.autonomy_hr', '2026-11-21', 48, 1.44, 'flat', 1),
  ('fuel-system.sla_margin_hr', 'Autonomy margin over the 24 h SLA', 'h', 'fuel-system.html', 0, null, null, null, 0.5, 'Autonomy minus the 24 h SLA; the page reported FAIL when it was below zero (slaMarginHr) and PASS at or above. Same rule, now from the registry.', 'ASSUMED', 'fuel-system.html slaMarginHr()', '2026-11-21', 24, 0.72, 'flat', 1),
  ('water.raw_tank_pct', 'Raw water tank level (TK-101)', '%', 'water-system.html', 30, 40, null, null, 0.5, 'Alarm below 30 %, warning below 40 %: the page''s own raw-tank thresholds, migrated as typed. A local alarm-philosophy choice, no standard clause read: ASSUMED.', 'ASSUMED', 'water-system.html evalThresholds() (doc-07 alarm rules)', '2026-11-21', 82, 2.46, 'flat', 1),
  ('water.dom_tank_pct', 'Domestic / treated tank level (TK-402)', '%', 'water-system.html', 40, 50, null, null, 0.5, 'Alarm below 40 %, warning below 50 %: the page''s own domestic-tank thresholds, migrated as typed. ASSUMED.', 'ASSUMED', 'water-system.html evalThresholds() (doc-07 alarm rules)', '2026-11-21', 88, 2.6399999999999997, 'flat', 1),
  ('water.filter_dp_bar', 'Media filter differential pressure (FLT-201)', 'bar', 'water-system.html', null, null, 0.65, 0.8, 0.01, 'Warning above 0.65 bar, alarm (backwash) above 0.80 bar: the page''s filter thresholds, migrated as typed. A local backwash philosophy: ASSUMED.', 'ASSUMED', 'water-system.html evalThresholds() (doc-07 alarm rules)', '2026-11-21', 0.4, 0.012, 'flat', 2),
  ('water.tds_ppm', 'Treated water TDS', 'ppm', 'water-system.html', null, null, 350, 500, 5, 'Warning above 350 ppm, alarm above 500 ppm (the page''s treated-water reject limit), migrated as typed. ASSUMED: no standard clause read.', 'ASSUMED', 'water-system.html evalThresholds() (doc-07 alarm rules)', '2026-11-21', 140, 4.2, 'flat', 0),
  ('water.uv_intensity_pct', 'UV lamp intensity (UV-401)', '%', 'water-system.html', 70, 85, null, null, 0.5, 'Alarm below 70 %, warning below 85 % of nominal lamp intensity: the page''s UV thresholds, migrated as typed. ASSUMED.', 'ASSUMED', 'water-system.html evalThresholds() (doc-07 alarm rules)', '2026-11-21', 99.8, 2.9939999999999998, 'flat', 1),
  ('water.wue_l_per_kwh', 'Instant WUE (site)', 'L/kWh', 'water-system.html', null, null, 1.3, null, 0.01, 'Warning above the engine''s WUE design target (water.wue_target_l_per_kwh = 1.3 L/kWh), the page''s own rule wueComputed > WUE_TARGET. No alarm band is declared: ASSUMED.', 'ASSUMED', 'water-system.html evalThresholds() (doc-07 alarm rules)', '2026-11-21', 1.2, 0.036, 'flat', 2),
  ('fire.level_pct', 'Fire-water reserve tank level', '%', 'fire-system.html', 60, 80, null, null, 0.5, 'Warning at or below 80 % (the page''s TANK_LOW_PCT, where make-up supply engages), alarm at or below 60 % (TANK_LL_PCT low-low): migrated as typed. A local alarm philosophy, no NFPA 22 clause read: ASSUMED.', 'ASSUMED', 'fire-system.html TANK_LOW_PCT / TANK_LL_PCT', '2026-11-21', 92, 2.76, 'flat', 0),
  ('ict.util_pct', 'Network link / core utilisation', '%', 'ict.html', null, null, 60, 80, 0.5, 'The utilisation bands ict.html already applied (utilClass and the status-bar Core Util: warn above 60 %, bad above 80 %), moved here. A page-authored operating policy, not a published standard.', 'ASSUMED', 'ict.html utilClass() / renderBottomBar() (PRD-CONV-POINT-STATUS-TREND §5 basis order 3)', '2026-11-21', 35.5, 1.065, 'load', 1),
  ('ict.poll_freshness_s', 'BMS poll freshness (age of the last telemetry)', 's', 'ict.html', null, null, 60, null, 1, 'The stale-telemetry rule the page states (warn if stale telemetry > 60 s), moved here. No alarm bound: the page declares none.', 'ASSUMED', 'ict.html Poll Freshness note and the Stale rule line (PRD-CONV-POINT-STATUS-TREND §5 basis order 3)', '2026-11-21', 0.9, 0.027, 'load', 1),
  ('electrical.tx_load_pct', 'Transformer loading (share of nameplate MVA / kVA)', '%', 'EPMS_Telemetry.html', null, null, 50, 100, 0.5, 'Duplicated transformers (TX-1 / TX-2, the distribution pair of a stream): each must stay at or below 50 % for the other to carry the whole load, so above 50 % redundancy is already used (warn); alarm at the nameplate rating (100 %). The engine''s N-1 loading (hv_tx_load_pct_n1 72.7 %, dist_tx_load_pct_contingency 96.9 % at design load) is what an operator switching in the simulation reaches. No clause read: ASSUMED.', 'ASSUMED', 'js/conv-engine.js electrical.hv_tx_load_pct_*, electrical.dist_tx_load_pct_* (PRD-CONV-POINT-STATUS-TREND §5 basis order 3)', '2026-11-21', 36.3, 1.089, 'load', 1),
  ('datahall.cooling.margin_pct', 'Hall cooling margin (headroom over demand)', '%', 'datahall.html', 0, 5, null, null, 0.2, 'The page rule migrated as typed: datahall.html coloured the Cooling Margin warning below 5 %. Low side only. The alarm bound 0 % (demand equal to the available capacity) and the nominal 10 % are ASSUMED. The engine''s present margin is 0.53 % (headroom 40 kW on 7,500 kW), so the point reads Warning today, as the page already coloured it.', 'ASSUMED', 'datahall.html paintOpsRollup cooling margin', '2026-11-21', 0.53, 0.0159, 'flat', 2)
on conflict (id) do update set
  label = excluded.label,
  unit = excluded.unit,
  page = excluded.page,
  lo_alarm = excluded.lo_alarm,
  lo_warn = excluded.lo_warn,
  hi_warn = excluded.hi_warn,
  hi_alarm = excluded.hi_alarm,
  deadband = excluded.deadband,
  basis = excluded.basis,
  evidence_class = excluded.evidence_class,
  source_ref = excluded.source_ref,
  source_as_of = excluded.source_as_of,
  hist_base = excluded.hist_base,
  hist_amp = excluded.hist_amp,
  hist_shape = excluded.hist_shape,
  hist_digits = excluded.hist_digits
where (c.label, c.unit, c.page, c.lo_alarm, c.lo_warn, c.hi_warn, c.hi_alarm, c.deadband, c.basis, c.evidence_class, c.source_ref, c.source_as_of, c.hist_base, c.hist_amp, c.hist_shape, c.hist_digits)
  is distinct from (excluded.label, excluded.unit, excluded.page, excluded.lo_alarm, excluded.lo_warn, excluded.hi_warn, excluded.hi_alarm, excluded.deadband, excluded.basis, excluded.evidence_class, excluded.source_ref, excluded.source_as_of, excluded.hist_base, excluded.hist_amp, excluded.hist_shape, excluded.hist_digits);
-- END SEED

-- ===== schedule + backfill =========================================================================================

-- One job named 'conv-sample-tick', however often this file runs: drop any earlier one first.
select cron.unschedule(jobid) from cron.job where jobname = 'conv-sample-tick';
select cron.schedule('conv-sample-tick', '*/5 * * * *', 'select public.conv_sample_tick(now())');

select public.conv_backfill(30);

-- Verify (expect one row per point, the newest sample at most 5 min old once the job has run):
-- select point_id, max(ts) as newest, count(*) as samples from public.conv_point_samples group by point_id order by point_id;
