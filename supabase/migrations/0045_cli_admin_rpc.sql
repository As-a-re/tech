create or replace function public.papa_cli_grant_admin(p_username text,p_remove boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_name text;
begin
 update users set role=case when p_remove then 'member'::user_role else 'tech_admin'::user_role end,updated_at=now()
 where lower(username)=lower(ltrim(p_username,'@')) returning id,full_name into v_id,v_name;
 if not found then return null;end if;
 insert into audit_log(actor_id,action,target,meta) values(null,case when p_remove then 'admin.revoked_cli' else 'admin.granted_cli' end,lower(ltrim(p_username,'@')),jsonb_build_object('source','cli'));
 return jsonb_build_object('name',v_name,'user_id',v_id);
end $$;
revoke all on function public.papa_cli_grant_admin(text,boolean) from public,anon,authenticated;
grant execute on function public.papa_cli_grant_admin(text,boolean) to service_role;
