create or replace function public.papa_create_announcement(
 p_author_id uuid,p_level text,p_district_id uuid,p_assembly_id uuid,p_title text,p_body text,p_important boolean,p_media jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v jsonb;
begin
 if p_level not in ('national','district','local') then raise exception 'invalid_level'; end if;
 if (p_level='national' and (p_district_id is not null or p_assembly_id is not null)) or (p_level='district' and (p_district_id is null or p_assembly_id is not null)) or (p_level='local' and p_assembly_id is null) then raise exception 'invalid_scope'; end if;
 insert into announcements(author_id,level,district_id,assembly_id,title,body,important)
 values(p_author_id,p_level::level,p_district_id,p_assembly_id,p_title,p_body,p_important) returning id into v_id;
 for v in select value from jsonb_array_elements(coalesce(p_media,'[]'::jsonb)) loop
  insert into announcement_media(announcement_id,url,alt,width,height,position)
  values(v_id,v->>'url',nullif(v->>'alt',''),nullif(v->>'width','')::integer,nullif(v->>'height','')::integer,coalesce((v->>'position')::smallint,0));
 end loop;
 return v_id;
end $$;

create or replace function public.papa_edit_announcement(p_author_id uuid,p_id uuid,p_title text,p_body text,p_important boolean,p_media jsonb default '[]'::jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
 update announcements set title=p_title,body=p_body,important=p_important,edited_at=now()
 where id=p_id and author_id=p_author_id and deleted_at is null;
 if not found then return false; end if;
 delete from announcement_media where announcement_id=p_id;
 for v in select value from jsonb_array_elements(coalesce(p_media,'[]'::jsonb)) loop
  insert into announcement_media(announcement_id,url,alt,width,height,position)
  values(p_id,v->>'url',nullif(v->>'alt',''),nullif(v->>'width','')::integer,nullif(v->>'height','')::integer,coalesce((v->>'position')::smallint,0));
 end loop;
 return true;
end $$;

create or replace function public.papa_delete_announcement(p_user_id uuid,p_id uuid,p_as_admin boolean default false)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update announcements set deleted_at=now() where id=p_id and deleted_at is null and (p_as_admin or author_id=p_user_id);
 if not found then return false; end if;
 delete from notifications where announcement_id=p_id;
 return true;
end $$;
create or replace function public.papa_increment_announcement_view(p_id uuid)
returns integer language sql security definer set search_path=public as $$
 update announcements set view_count=view_count+1 where id=p_id and deleted_at is null returning view_count
$$;
create or replace function public.papa_list_announcement_ids(
 p_level text default null,p_district_id uuid default null,p_assembly_id uuid default null,p_author_id uuid default null,
 p_query text default null,p_keys text[] default null,p_page integer default 1,p_page_size integer default 20
) returns table(id uuid) language sql stable security definer set search_path=public as $$
 select a.id from announcements a
 where a.deleted_at is null
 and (p_level is null or a.level=p_level::level)
 and (p_district_id is null or a.district_id=p_district_id)
 and (p_assembly_id is null or a.assembly_id=p_assembly_id)
 and (p_author_id is null or a.author_id=p_author_id)
 and (p_query is null or (a.title ilike '%'||replace(replace(replace(p_query,'\\','\\\\'),'%','\\%'),'_','\\_')||'%' escape '\\') or to_tsvector('simple',a.title||' '||a.body) @@ plainto_tsquery('simple',p_query))
 and (p_keys is null or (case a.level when 'national' then 'national' when 'district' then 'd:'||a.district_id else 'a:'||a.assembly_id end)=any(p_keys))
 order by case when p_level is not null and a.important and a.created_at>now()-interval '7 days' then 1 else 0 end desc,a.created_at desc
 limit least(101,greatest(1,coalesce(p_page_size,20))+1) offset (greatest(1,coalesce(p_page,1))-1)*least(100,greatest(1,coalesce(p_page_size,20)))
$$;
revoke all on function public.papa_create_announcement(uuid,text,uuid,uuid,text,text,boolean,jsonb) from public,anon,authenticated;
revoke all on function public.papa_edit_announcement(uuid,uuid,text,text,boolean,jsonb) from public,anon,authenticated;
revoke all on function public.papa_delete_announcement(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.papa_increment_announcement_view(uuid) from public,anon,authenticated;
revoke all on function public.papa_list_announcement_ids(text,uuid,uuid,uuid,text,text[],integer,integer) from public,anon,authenticated;
grant execute on function public.papa_create_announcement(uuid,text,uuid,uuid,text,text,boolean,jsonb) to service_role;
grant execute on function public.papa_edit_announcement(uuid,uuid,text,text,boolean,jsonb) to service_role;
grant execute on function public.papa_delete_announcement(uuid,uuid,boolean) to service_role;
grant execute on function public.papa_increment_announcement_view(uuid) to service_role;
grant execute on function public.papa_list_announcement_ids(text,uuid,uuid,uuid,text,text[],integer,integer) to service_role;
