-- Correct the audit JSON aggregation order to reference its quoted camelCase alias.
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
