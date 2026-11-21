# Runbook — put the point limits and history in the database (owner action, once)

PRD-CONV-POINT-STATUS-TREND §5b. Until you do this, the cockpits use the limits shipped in git and the local
simulated history, and say so in the trend ("Local model (database unreachable)" only when the database is
configured but does not answer).

## Do it (about 2 minutes)

1. Open the Supabase dashboard of the site's project.
2. Go to **SQL Editor** and click **New query**.
3. Open `supabase/migrations/2026-11-20-conv-points.sql` from the repository, copy all of it, and paste it.
4. Click **Run**. It enables `pg_cron`, creates the three tables and the functions, seeds the points from git,
   schedules the 5-minute job, and fills the last 30 days. It is safe to run again.

## Check it worked (one query)

Paste this in a new query and run it:

```sql
select count(*) as points,
       (select count(*) from public.conv_point_samples) as samples,
       (select max(ts) from public.conv_point_samples) as newest,
       (select count(*) from cron.job where jobname = 'conv-sample-tick') as job
  from public.conv_points;
```

Expect `points` = 19, `samples` above 10 000, `newest` within the last 5 minutes (after the job has run once), and
`job` = 1. Run it again 6 minutes later: `newest` has moved forward by 5 minutes.

## Edit a limit

rz-ops → **Point limits**. Only a root account can save. The database refuses any other save and writes every change
to `audit_log` (rz-ops → Audit Log). The cockpits pick a change up within 5 minutes.

Note: running the migration again resets every limit to the value in git (each reset is audited). Change git
(`data/conv-limits.curated.json`, then `node tools/build-conv-points-seed.mjs`) when a limit should stay changed.

## Undo

Paste and run:

```sql
select cron.unschedule(jobid) from cron.job where jobname = 'conv-sample-tick';
drop function if exists public.conv_point_series(text, timestamptz, timestamptz);
drop function if exists public.conv_backfill(integer, timestamptz);
drop function if exists public.conv_sample_tick(timestamptz);
drop function if exists public.conv_prune(timestamptz);
drop function if exists public.conv_samples_span(bigint, bigint);
drop function if exists public.conv_rollup_span(bigint, bigint);
drop function if exists public.conv_hist_value(text, double precision, double precision, text, integer, bigint);
drop function if exists public.conv_hist_value_h(bigint, double precision, double precision, text, integer, bigint);
drop function if exists public.conv_hist_noise(bigint, bigint);
drop function if exists public.conv_hist_imul(bigint, bigint);
drop function if exists public.conv_hist_hash(text);
drop table if exists public.conv_point_rollup;
drop table if exists public.conv_point_samples;
drop table if exists public.conv_points;
drop function if exists public.conv_points_audit();
drop function if exists public.conv_points_stamp();
```

The audit rows already written stay in `audit_log`. `pg_cron` stays enabled (other jobs may use it); disable it under
Database → Extensions if nothing else does. The cockpits go back to the shipped limits and the local history at once.
