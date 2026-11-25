-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
-- Supabase server-only RPCs for fixed-window rate limiting and admin audit queries.
create or replace function public.papa_hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_key is null or length(p_key) < 1 or length(p_key) > 250 or p_max < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then raise exception 'invalid_rate_limit_arguments'; end if;
  insert into rate_limits(key,count,reset_at) values(p_key,1,now()+make_interval(secs=>p_window_seconds))
  on conflict(key) do update set count=case when rate_limits.reset_at<now() then 1 else rate_limits.count+1 end,
  reset_at=case when rate_limits.reset_at<now() then now()+make_interval(secs=>p_window_seconds) else rate_limits.reset_at end returning count into n;
  return n<=p_max;
end $$;
create or replace function public.papa_clear_rate_limit(p_key text) returns void language sql security definer set search_path=public as $$ delete from rate_limits where key=p_key $$;
create or replace function public.papa_list_audit_log(p_action text default null,p_actor text default null,p_from timestamptz default null,p_to timestamptz default null,p_page integer default 1,p_page_size integer default 50)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_page integer:=greatest(1,coalesce(p_page,1)); v_size integer:=least(100,greatest(1,coalesce(p_page_size,50))); v_total bigint; v_rows jsonb;
begin
 select count(*) into v_total from audit_log a left join users u on u.id=a.actor_id
 where (nullif(p_action,'') is null or a.action ilike replace(replace(replace(p_action,'\','\\'),'%','\%'),'_','\_')||'%' escape '\')
 and (nullif(p_actor,'') is null or lower(coalesce(u.username,''))=lower(ltrim(p_actor,'@')))
 and (p_from is null or a.created_at>=p_from) and (p_to is null or a.created_at<=p_to);
 select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt" desc),'[]'::jsonb) into v_rows from (
 select a.id,a.action,a.target,a.meta,a.ip,a.created_at as "createdAt",u.username,u.full_name as "fullName" from audit_log a left join users u on u.id=a.actor_id
 where (nullif(p_action,'') is null or a.action ilike replace(replace(replace(p_action,'\','\\'),'%','\%'),'_','\_')||'%' escape '\')
 and (nullif(p_actor,'') is null or lower(coalesce(u.username,''))=lower(ltrim(p_actor,'@')))
 and (p_from is null or a.created_at>=p_from) and (p_to is null or a.created_at<=p_to)
 order by a.created_at desc limit v_size offset (v_page-1)*v_size) x;
 return jsonb_build_object('rows',v_rows,'total',v_total,'page',v_page,'pages',greatest(1,ceil(v_total::numeric/v_size)::integer));
end $$;
create or replace function public.papa_audit_action_names() returns text[] language sql stable security definer set search_path=public as $$ select coalesce(array_agg(distinct action order by action),array[]::text[]) from audit_log $$;
revoke all on function public.papa_hit_rate_limit(text,integer,integer) from public,anon,authenticated;
revoke all on function public.papa_clear_rate_limit(text) from public,anon,authenticated;
revoke all on function public.papa_list_audit_log(text,text,timestamptz,timestamptz,integer,integer) from public,anon,authenticated;
revoke all on function public.papa_audit_action_names() from public,anon,authenticated;
grant execute on function public.papa_hit_rate_limit(text,integer,integer) to service_role;
grant execute on function public.papa_clear_rate_limit(text) to service_role;
grant execute on function public.papa_list_audit_log(text,text,timestamptz,timestamptz,integer,integer) to service_role;
grant execute on function public.papa_audit_action_names() to service_role;
