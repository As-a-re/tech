create or replace function public.papa_create_event(p_author_id uuid,p_level text,p_district_id uuid,p_assembly_id uuid,p_event jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if p_level not in ('national','district','local') then raise exception 'invalid_level';end if;
 insert into events(author_id,level,district_id,assembly_id,title,description,starts_at,ends_at,venue,address,lat,lng,online_url,cover_url)
 values(p_author_id,p_level::level,p_district_id,p_assembly_id,p_event->>'title',coalesce(p_event->>'description',''),(p_event->>'starts_at')::timestamptz,nullif(p_event->>'ends_at','')::timestamptz,p_event->>'venue',p_event->>'address',nullif(p_event->>'lat','')::double precision,nullif(p_event->>'lng','')::double precision,p_event->>'online_url',p_event->>'cover_url') returning id into v_id;
 insert into event_rsvps(event_id,user_id,status) values(v_id,p_author_id,'going');
 update events set going_count=1 where id=v_id;return v_id;
end $$;
create or replace function public.papa_update_event(p_author_id uuid,p_event_id uuid,p_event jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_old timestamptz;v_new timestamptz;
begin
 v_new:=(p_event->>'starts_at')::timestamptz;
 update events set title=p_event->>'title',description=coalesce(p_event->>'description',''),starts_at=v_new,ends_at=nullif(p_event->>'ends_at','')::timestamptz,venue=p_event->>'venue',address=p_event->>'address',lat=nullif(p_event->>'lat','')::double precision,lng=nullif(p_event->>'lng','')::double precision,online_url=p_event->>'online_url',cover_url=p_event->>'cover_url',updated_at=now(),reminded_day_at=case when starts_at is distinct from v_new then null else reminded_day_at end,reminded_hour_at=case when starts_at is distinct from v_new then null else reminded_hour_at end
 where id=p_event_id and author_id=p_author_id and deleted_at is null and cancelled_at is null;
 return found;
end $$;
create or replace function public.papa_cancel_event(p_author_id uuid,p_event_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_users uuid[];
begin update events set cancelled_at=now(),updated_at=now() where id=p_event_id and author_id=p_author_id and cancelled_at is null and deleted_at is null;if not found then return null;end if;
 select coalesce(array_agg(user_id),array[]::uuid[]) into v_users from event_rsvps where event_id=p_event_id;return jsonb_build_object('users',to_jsonb(v_users));end $$;
create or replace function public.papa_delete_event(p_user_id uuid,p_event_id uuid,p_as_admin boolean default false)
returns boolean language plpgsql security definer set search_path=public as $$
begin update events set deleted_at=now(),updated_at=now() where id=p_event_id and deleted_at is null and (p_as_admin or author_id=p_user_id);if not found then return false;end if;delete from notifications where event_id=p_event_id;return true;end $$;
create or replace function public.papa_set_event_rsvp(p_user_id uuid,p_event_id uuid,p_status text)
returns text language plpgsql security definer set search_path=public as $$
declare v events%rowtype;
begin select * into v from events where id=p_event_id and deleted_at is null; if not found then return 'not_found';end if;if v.cancelled_at is not null then return 'cancelled';end if;if coalesce(v.ends_at,v.starts_at)<now() then return 'ended';end if;
 if p_status is null then delete from event_rsvps where event_id=p_event_id and user_id=p_user_id;
 elsif p_status in ('going','interested') then insert into event_rsvps(event_id,user_id,status) values(p_event_id,p_user_id,p_status::rsvp_status) on conflict(event_id,user_id) do update set status=excluded.status;
 else raise exception 'invalid_rsvp';end if;
 update events set going_count=(select count(*)::integer from event_rsvps where event_id=p_event_id and status='going'),interested_count=(select count(*)::integer from event_rsvps where event_id=p_event_id and status='interested') where id=p_event_id;return 'ok';end $$;
create or replace function public.papa_list_event_ids(
 p_filter text default 'all',p_viewer_id uuid default null,p_home_district_id uuid default null,p_home_assembly_id uuid default null,p_district_id uuid default null,p_assembly_id uuid default null,p_from timestamptz default null,p_to timestamptz default null,p_query text default null,p_page integer default 1,p_page_size integer default 20
) returns table(id uuid) language sql stable security definer set search_path=public as $$
 select e.id from events e where e.deleted_at is null
 and (p_from is not null or p_to is not null or case when p_filter='past' then coalesce(e.ends_at,e.starts_at+interval '3 hours')<now() else coalesce(e.ends_at,e.starts_at+interval '3 hours')>=now() end)
 and (p_from is null or e.starts_at>=p_from) and (p_to is null or e.starts_at<p_to)
 and (p_filter not in ('national') or e.level='national')
 and (p_filter<>'district' or (p_home_district_id is not null and (e.district_id=p_home_district_id or e.assembly_id in(select a.id from assemblies a where a.district_id=p_home_district_id))))
 and (p_filter<>'local' or (p_home_assembly_id is not null and e.assembly_id=p_home_assembly_id))
 and (p_filter<>'going' or (p_viewer_id is not null and exists(select 1 from event_rsvps r where r.event_id=e.id and r.user_id=p_viewer_id)))
 and (p_filter<>'hosting' or (p_viewer_id is not null and e.author_id=p_viewer_id))
 and (p_district_id is null or e.district_id=p_district_id or e.assembly_id in(select a.id from assemblies a where a.district_id=p_district_id))
 and (p_assembly_id is null or e.assembly_id=p_assembly_id)
 and (p_query is null or position(lower(p_query) in lower(e.title))>0 or position(lower(p_query) in lower(coalesce(e.venue,'')))>0)
 order by case when p_filter='past' and p_from is null then 1 else 0 end desc,case when p_filter='past' and p_from is null then e.starts_at end desc,case when not(p_filter='past' and p_from is null) then e.starts_at end asc
 limit least(101,greatest(1,coalesce(p_page_size,20))+1) offset (greatest(1,coalesce(p_page,1))-1)*least(100,greatest(1,coalesce(p_page_size,20)))
$$;
create or replace function public.papa_claim_event_reminders(p_kind text)
returns table(id uuid,author_id uuid) language plpgsql security definer set search_path=public as $$
begin
 if p_kind='day' then return query update events e set reminded_day_at=now() where reminded_day_at is null and deleted_at is null and cancelled_at is null and starts_at>now()+interval '2 hours' and starts_at<=now()+interval '24 hours' returning e.id,e.author_id;
 elsif p_kind='hour' then return query update events e set reminded_hour_at=now() where reminded_hour_at is null and deleted_at is null and cancelled_at is null and starts_at>now() and starts_at<=now()+interval '1 hour' returning e.id,e.author_id;
 else raise exception 'invalid_reminder_kind';end if;
end $$;
revoke all on function public.papa_create_event(uuid,text,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.papa_update_event(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.papa_cancel_event(uuid,uuid) from public,anon,authenticated;
revoke all on function public.papa_delete_event(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.papa_set_event_rsvp(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.papa_list_event_ids(text,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,integer,integer) from public,anon,authenticated;
revoke all on function public.papa_claim_event_reminders(text) from public,anon,authenticated;
grant execute on function public.papa_create_event(uuid,text,uuid,uuid,jsonb) to service_role;
grant execute on function public.papa_update_event(uuid,uuid,jsonb) to service_role;
grant execute on function public.papa_cancel_event(uuid,uuid) to service_role;
grant execute on function public.papa_delete_event(uuid,uuid,boolean) to service_role;
grant execute on function public.papa_set_event_rsvp(uuid,uuid,text) to service_role;
grant execute on function public.papa_list_event_ids(text,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,integer,integer) to service_role;
grant execute on function public.papa_claim_event_reminders(text) to service_role;
