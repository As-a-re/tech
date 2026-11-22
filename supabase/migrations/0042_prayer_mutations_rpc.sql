create or replace function public.papa_set_prayed(p_user_id uuid,p_prayer_id uuid,p_on boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_author uuid; v_count integer;
begin
 select author_id into v_author from prayer_requests where id=p_prayer_id and deleted_at is null;
 if v_author is null then return null; end if;
 if p_on then insert into prayer_prayed(prayer_id,user_id) values(p_prayer_id,p_user_id) on conflict do nothing;
 else delete from prayer_prayed where prayer_id=p_prayer_id and user_id=p_user_id; end if;
 select count(*)::integer into v_count from prayer_prayed where prayer_id=p_prayer_id;
 update prayer_requests set prayed_count=v_count where id=p_prayer_id;
 return jsonb_build_object('author_id',v_author,'prayed_count',v_count);
end $$;
create or replace function public.papa_mark_prayer_answered(p_author_id uuid,p_prayer_id uuid,p_note text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_anonymous boolean; v_people uuid[];
begin
 update prayer_requests set answered_at=now(),answer_note=p_note where id=p_prayer_id and author_id=p_author_id and deleted_at is null and answered_at is null returning anonymous into v_anonymous;
 if not found then return null; end if;
 select coalesce(array_agg(user_id),array[]::uuid[]) into v_people from prayer_prayed where prayer_id=p_prayer_id;
 return jsonb_build_object('anonymous',v_anonymous,'prayed_by',to_jsonb(v_people));
end $$;
create or replace function public.papa_delete_prayer(p_user_id uuid,p_prayer_id uuid,p_as_admin boolean default false)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update prayer_requests set deleted_at=now() where id=p_prayer_id and deleted_at is null and (p_as_admin or author_id=p_user_id);
 if not found then return false; end if;
 delete from notifications where prayer_id=p_prayer_id;return true;
end $$;
revoke all on function public.papa_set_prayed(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.papa_mark_prayer_answered(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.papa_delete_prayer(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.papa_set_prayed(uuid,uuid,boolean) to service_role;
grant execute on function public.papa_mark_prayer_answered(uuid,uuid,text) to service_role;
grant execute on function public.papa_delete_prayer(uuid,uuid,boolean) to service_role;
