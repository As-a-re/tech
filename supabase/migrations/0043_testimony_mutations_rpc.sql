create or replace function public.papa_create_testimony(p_author_id uuid,p_title text,p_body text,p_prayer_id uuid,p_media jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v jsonb;
begin
 if p_prayer_id is not null and not exists(select 1 from prayer_requests where id=p_prayer_id and author_id=p_author_id and deleted_at is null) then return null; end if;
 insert into testimonies(author_id,title,body,prayer_id) values(p_author_id,p_title,p_body,p_prayer_id) returning id into v_id;
 for v in select value from jsonb_array_elements(coalesce(p_media,'[]'::jsonb)) loop
  insert into testimony_media(testimony_id,url,alt,width,height,position) values(v_id,v->>'url',nullif(v->>'alt',''),nullif(v->>'width','')::integer,nullif(v->>'height','')::integer,coalesce((v->>'position')::smallint,0));
 end loop;return v_id;
end $$;
create or replace function public.papa_edit_testimony(p_author_id uuid,p_id uuid,p_title text,p_body text,p_media jsonb default '[]'::jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
 update testimonies set title=p_title,body=p_body,edited_at=now() where id=p_id and author_id=p_author_id and deleted_at is null;
 if not found then return false;end if;delete from testimony_media where testimony_id=p_id;
 for v in select value from jsonb_array_elements(coalesce(p_media,'[]'::jsonb)) loop
  insert into testimony_media(testimony_id,url,alt,width,height,position) values(p_id,v->>'url',nullif(v->>'alt',''),nullif(v->>'width','')::integer,nullif(v->>'height','')::integer,coalesce((v->>'position')::smallint,0));
 end loop;return true;
end $$;
create or replace function public.papa_delete_testimony(p_user_id uuid,p_id uuid,p_as_admin boolean default false)
returns boolean language plpgsql security definer set search_path=public as $$
begin update testimonies set deleted_at=now() where id=p_id and deleted_at is null and (p_as_admin or author_id=p_user_id);if not found then return false;end if;delete from notifications where testimony_id=p_id;return true;end $$;
create or replace function public.papa_set_testimony_praise(p_user_id uuid,p_testimony_id uuid,p_on boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_author uuid;v_count integer;
begin select author_id into v_author from testimonies where id=p_testimony_id and deleted_at is null;if v_author is null then return null;end if;
 if p_on then insert into testimony_praises(testimony_id,user_id) values(p_testimony_id,p_user_id) on conflict do nothing;else delete from testimony_praises where testimony_id=p_testimony_id and user_id=p_user_id;end if;
 select count(*)::integer into v_count from testimony_praises where testimony_id=p_testimony_id;update testimonies set praise_count=v_count where id=p_testimony_id;return jsonb_build_object('author_id',v_author,'praise_count',v_count);
end $$;
revoke all on function public.papa_create_testimony(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.papa_edit_testimony(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.papa_delete_testimony(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.papa_set_testimony_praise(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.papa_create_testimony(uuid,text,text,uuid,jsonb) to service_role;
grant execute on function public.papa_edit_testimony(uuid,uuid,text,text,jsonb) to service_role;
grant execute on function public.papa_delete_testimony(uuid,uuid,boolean) to service_role;
grant execute on function public.papa_set_testimony_praise(uuid,uuid,boolean) to service_role;
