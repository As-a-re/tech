-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
-- Supabase migration 0018: link application members to auth.users.
-- Apply after 0000_foundation.sql through 0017_riders_payouts.sql.
-- This migration does not delete or rewrite existing users.

alter table public.users
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create index if not exists users_auth_user_id_idx on public.users (auth_user_id);

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id
  from public.users u
  where u.auth_user_id = (select auth.uid())
    and u.status = 'active'
  limit 1
$$;

create or replace function public.is_tech_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.users u
    where u.id = public.current_member_id()
      and u.role = 'tech_admin'
      and u.status = 'active'
  )
$$;

revoke all on function public.current_member_id() from public;
revoke all on function public.is_tech_admin() from public;
grant execute on function public.current_member_id() to anon, authenticated;
grant execute on function public.is_tech_admin() to authenticated;

alter table public.users enable row level security;
alter table public.church_members enable row level security;
alter table public.user_preferences enable row level security;
alter table public.sessions enable row level security;
alter table public.verification_codes enable row level security;
alter table public.backup_codes enable row level security;
alter table public.rate_limits enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists users_select_self_or_admin on public.users;
create policy users_select_self_or_admin on public.users
  for select to authenticated
  using (id = public.current_member_id() or public.is_tech_admin());

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using (id = public.current_member_id())
  with check (id = public.current_member_id());

drop policy if exists church_members_select_authorized on public.church_members;
create policy church_members_select_authorized on public.church_members
  for select to authenticated
  using (
    church_id = (select u.church_id from public.users u where u.id = public.current_member_id())
    or public.is_tech_admin()
  );

drop policy if exists church_members_admin_write on public.church_members;
create policy church_members_admin_write on public.church_members
  for all to authenticated
  using (public.is_tech_admin())
  with check (public.is_tech_admin());

drop policy if exists user_preferences_owner on public.user_preferences;
create policy user_preferences_owner on public.user_preferences
  for all to authenticated
  using (user_id = public.current_member_id())
  with check (user_id = public.current_member_id());

drop policy if exists sessions_owner on public.sessions;
create policy sessions_owner on public.sessions
  for select to authenticated
  using (user_id = public.current_member_id());

drop policy if exists sessions_owner_delete on public.sessions;
create policy sessions_owner_delete on public.sessions
  for delete to authenticated
  using (user_id = public.current_member_id());

drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read on public.audit_log
  for select to authenticated
  using (public.is_tech_admin());

-- Verification codes, backup codes, and rate limits are server-only tables.
-- RLS is enabled deliberately without client policies; service-role operations bypass RLS.

insert into storage.buckets (id, name, public)
values ('papa-media', 'papa-media', false)
on conflict (id) do update set public = false;

drop policy if exists papa_media_read_own on storage.objects;
create policy papa_media_read_own on storage.objects
	for select to authenticated
	using (bucket_id = 'papa-media' and owner_id = (select auth.uid()::text));

drop policy if exists papa_media_upload_own on storage.objects;
create policy papa_media_upload_own on storage.objects
	for insert to authenticated
	with check (bucket_id = 'papa-media' and owner_id = (select auth.uid()::text));

drop policy if exists papa_media_update_own on storage.objects;
create policy papa_media_update_own on storage.objects
	for update to authenticated
	using (bucket_id = 'papa-media' and owner_id = (select auth.uid()::text))
	with check (bucket_id = 'papa-media' and owner_id = (select auth.uid()::text));

drop policy if exists papa_media_delete_own on storage.objects;
create policy papa_media_delete_own on storage.objects
	for delete to authenticated
	using (bucket_id = 'papa-media' and owner_id = (select auth.uid()::text));
