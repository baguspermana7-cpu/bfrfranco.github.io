-- 2026-11-14 — signup never grants root (audit finding S1, site-wide).
--
-- WHY: auth settings had disable_signup=false and mailer_autoconfirm=true, and handle_new_user()
-- gave tier/role 'root' to any NEW auth user whose email string matched an owner address. If one
-- of those addresses had no account yet, anyone could sign up with it, be auto-confirmed, and be
-- root — which also satisfies the rz-ops admin gate (v3.57.1) and RLS "root reads all".
--
-- AFTER: every new account starts free/user. Root is granted only by an existing root through
-- admin_set_tier()/admin_set_role(), or by the owner in the SQL editor against a known auth.users.id.
-- Existing root rows are NOT touched.
--
-- Apply: Supabase dashboard -> SQL editor -> run this file. Also: Authentication -> Providers ->
-- Email -> turn ON "Confirm email" (closes the same hole for educator_allowlist, finding S7).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, tier, role)
  values (new.id, new.email, 'free', 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Verify (expect exactly your own accounts, each with a confirmed email):
-- select p.email, p.tier, p.role, u.email_confirmed_at, u.created_at
--   from public.profiles p join auth.users u on u.id = p.id
--  where p.tier = 'root' or p.role = 'root' order by u.created_at;
