-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
-- Supabase migration 0028: transactional group mutations.
-- These privileged RPCs are only executable by the server-side service_role.

create or replace function public.papa_update_group(p_actor_id uuid, p_conversation_id uuid,
  p_update_title boolean, p_title text, p_update_description boolean, p_description text,
  p_update_avatar boolean, p_avatar_url text)
returns boolean language plpgsql security definer set search_path = public as $$
declare c conversations%rowtype; r conversation_role;
begin
  select * into c from conversations where id = p_conversation_id and kind = 'group' and deleted_at is null for update;
  if not found then return false; end if;
  select role into r from conversation_members where conversation_id = p_conversation_id and user_id = p_actor_id and left_at is null;
  if not found or (c.only_admins_edit and r <> 'admin') then return false; end if;
  if p_update_title then update conversations set title = p_title where id = p_conversation_id; end if;
  if p_update_description then update conversations set description = p_description where id = p_conversation_id; end if;
  if p_update_avatar then update conversations set avatar_url = p_avatar_url where id = p_conversation_id; end if;
  return true;
end $$;

create or replace function public.papa_update_group_settings(p_actor_id uuid, p_conversation_id uuid, p_settings jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare r conversation_role;
begin
  select role into r from conversation_members where conversation_id = p_conversation_id and user_id = p_actor_id and left_at is null;
  if not found or r <> 'admin' then return false; end if;
  update conversations set
    visibility = case when p_settings ? 'visibility' then (p_settings->>'visibility')::group_visibility else visibility end,
    only_admins_send = case when p_settings ? 'onlyAdminsSend' then (p_settings->>'onlyAdminsSend')::boolean else only_admins_send end,
    only_admins_edit = case when p_settings ? 'onlyAdminsEdit' then (p_settings->>'onlyAdminsEdit')::boolean else only_admins_edit end,
    members_can_add = case when p_settings ? 'membersCanAdd' then (p_settings->>'membersCanAdd')::boolean else members_can_add end,
    approve_joins = case when p_settings ? 'approveJoins' then (p_settings->>'approveJoins')::boolean else approve_joins end
  where id = p_conversation_id and kind = 'group' and deleted_at is null;
  return found;
end $$;

create or replace function public.papa_remove_group_member(p_actor_id uuid, p_conversation_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare c conversations%rowtype; r conversation_role;
begin
  select * into c from conversations where id = p_conversation_id and kind = 'group' and deleted_at is null;
  if not found then return false; end if;
  select role into r from conversation_members where conversation_id = p_conversation_id and user_id = p_actor_id and left_at is null;
  if not found or r <> 'admin' or (p_user_id = c.created_by and p_actor_id <> c.created_by) then return false; end if;
  update conversation_members set left_at = now(), role = 'member' where conversation_id = p_conversation_id and user_id = p_user_id and left_at is null;
  return found;
end $$;

create or replace function public.papa_set_group_admin(p_actor_id uuid, p_conversation_id uuid, p_user_id uuid, p_on boolean)
returns text language plpgsql security definer set search_path = public as $$
declare c conversations%rowtype; r conversation_role; n integer;
begin
  select * into c from conversations where id = p_conversation_id and kind = 'group' and deleted_at is null;
  if not found then return 'not_found'; end if;
  select role into r from conversation_members where conversation_id = p_conversation_id and user_id = p_actor_id and left_at is null;
  if not found or r <> 'admin' then return 'not_admin'; end if;
  if not p_on and p_user_id = c.created_by and p_actor_id <> c.created_by then return 'creator'; end if;
  if not p_on and p_user_id = p_actor_id then
    select count(*) into n from conversation_members where conversation_id = p_conversation_id and role = 'admin' and left_at is null;
    if n <= 1 then return 'last_admin'; end if;
  end if;
  update conversation_members set role = case when p_on then 'admin'::conversation_role else 'member'::conversation_role end
    where conversation_id = p_conversation_id and user_id = p_user_id and left_at is null;
  if not found then return 'not_found'; end if;
  return 'ok';
end $$;

create or replace function public.papa_leave_group(p_user_id uuid, p_conversation_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare promoted uuid; remaining integer;
begin
  if not exists(select 1 from conversations where id = p_conversation_id and kind = 'group' and deleted_at is null)
    or not exists(select 1 from conversation_members where conversation_id = p_conversation_id and user_id = p_user_id and left_at is null) then
    return jsonb_build_object('status','not_found');
  end if;
  update conversation_members set left_at = now(), role = 'member' where conversation_id = p_conversation_id and user_id = p_user_id and left_at is null;
  select count(*) into remaining from conversation_members where conversation_id = p_conversation_id and left_at is null;
  if remaining = 0 then
    update conversations set deleted_at = now() where id = p_conversation_id;
    return jsonb_build_object('status','closed');
  end if;
  if not exists(select 1 from conversation_members where conversation_id = p_conversation_id and left_at is null and role = 'admin') then
    select user_id into promoted from conversation_members where conversation_id = p_conversation_id and left_at is null order by joined_at asc limit 1;
    update conversation_members set role = 'admin' where conversation_id = p_conversation_id and user_id = promoted;
  end if;
  return jsonb_build_object('status','left','promoted',promoted);
end $$;

create or replace function public.papa_reset_group_invite(p_actor_id uuid, p_conversation_id uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from conversation_members where conversation_id = p_conversation_id and user_id = p_actor_id and left_at is null and role = 'admin') then return false; end if;
  update conversations set invite_code = p_code where id = p_conversation_id and kind = 'group' and deleted_at is null;
  return found;
end $$;

create or replace function public.papa_cancel_group_request(p_user_id uuid, p_conversation_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from group_join_requests where user_id = p_user_id and conversation_id = p_conversation_id
$$;

create or replace function public.papa_answer_group_request(p_actor_id uuid, p_conversation_id uuid, p_user_id uuid, p_accept boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from conversation_members where conversation_id = p_conversation_id and user_id = p_actor_id and left_at is null and role = 'admin') then return false; end if;
  delete from group_join_requests where conversation_id = p_conversation_id and user_id = p_user_id;
  return found;
end $$;

create or replace function public.papa_close_group(p_conversation_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update conversations set deleted_at = now() where id = p_conversation_id and kind = 'group' and deleted_at is null;
  return found;
end $$;

revoke all on function public.papa_update_group(uuid,uuid,boolean,text,boolean,text,boolean,text) from public, anon, authenticated;
revoke all on function public.papa_update_group_settings(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.papa_remove_group_member(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.papa_set_group_admin(uuid,uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.papa_leave_group(uuid,uuid) from public, anon, authenticated;
revoke all on function public.papa_reset_group_invite(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.papa_cancel_group_request(uuid,uuid) from public, anon, authenticated;
revoke all on function public.papa_answer_group_request(uuid,uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.papa_close_group(uuid) from public, anon, authenticated;
grant execute on function public.papa_update_group(uuid,uuid,boolean,text,boolean,text,boolean,text) to service_role;
grant execute on function public.papa_update_group_settings(uuid,uuid,jsonb) to service_role;
grant execute on function public.papa_remove_group_member(uuid,uuid,uuid) to service_role;
grant execute on function public.papa_set_group_admin(uuid,uuid,uuid,boolean) to service_role;
grant execute on function public.papa_leave_group(uuid,uuid) to service_role;
grant execute on function public.papa_reset_group_invite(uuid,uuid,text) to service_role;
grant execute on function public.papa_cancel_group_request(uuid,uuid) to service_role;
grant execute on function public.papa_answer_group_request(uuid,uuid,uuid,boolean) to service_role;
grant execute on function public.papa_close_group(uuid) to service_role;
