-- P15 part B — harden public.log_event() (v3.39.0). Run once in the Supabase SQL editor.
-- Idempotent: CREATE OR REPLACE of the same signature; grants are unchanged (anon stays revoked).
-- Same body as supabase/schema.sql. Before this runs, the activity log still works; it only lacks the
-- server-side guard (the client already sends only allowlisted actions and meta keys).
--
-- Check after running (as a signed-in user in the app, or with set_config('request.jwt.claims', ...)):
--   select public.log_event('Bad Action');            -- ERROR: action must match ^[a-z_]{3,40}$
--   select public.log_event('scenario_saved', null, null, jsonb_build_object('x', repeat('a', 3000)));
--                                                    -- ERROR: meta too large (2 KB max)

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
  -- P15 part B: a signed-in caller, a lowercase snake_case action, a small meta, and at most 60 events
  -- per 10 minutes per user, so a script holding a session cannot flood the table.
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if p_action is null or p_action !~ '^[a-z_]{3,40}$' then
    raise exception 'action must match ^[a-z_]{3,40}$';
  end if;
  if pg_column_size(coalesce(p_meta, '{}'::jsonb)) > 2048 then
    raise exception 'meta too large (2 KB max)';
  end if;
  if (select count(*) from public.audit_log
        where actor_id = auth.uid() and created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'rate limit: 60 events per 10 minutes';
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_meta, '{}'::jsonb))
  returning id into new_id;
  return new_id;
end;
$$;
