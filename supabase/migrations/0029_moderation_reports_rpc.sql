-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
create or replace function public.papa_file_report(
  p_reporter_id uuid, p_target jsonb, p_reason text, p_details text default ''
) returns text language plpgsql security definer set search_path = public as $$
declare
  n integer;
  v_post uuid := nullif(p_target->>'postId','')::uuid;
  v_user uuid := nullif(p_target->>'userId','')::uuid;
  v_announcement uuid := nullif(p_target->>'announcementId','')::uuid;
  v_event uuid := nullif(p_target->>'eventId','')::uuid;
  v_prayer uuid := nullif(p_target->>'prayerId','')::uuid;
  v_testimony uuid := nullif(p_target->>'testimonyId','')::uuid;
  v_conversation uuid := nullif(p_target->>'conversationId','')::uuid;
  v_product uuid := nullif(p_target->>'productId','')::uuid;
  v_shop uuid := nullif(p_target->>'shopId','')::uuid;
  v_target_user uuid;
  v_kind text;
begin
  select count(*) into n from jsonb_each_text(p_target) e where nullif(e.value,'') is not null;
  if n <> 1 or p_reason not in ('spam','abuse','false_info','inappropriate','impersonation','other') then return 'invalid'; end if;
  if v_post is not null then select author_id into v_target_user from posts where id=v_post;
  elsif v_user is not null then v_target_user := v_user;
  elsif v_announcement is not null then select author_id into v_target_user from announcements where id=v_announcement;
  elsif v_event is not null then select author_id into v_target_user from events where id=v_event;
  elsif v_prayer is not null then select author_id into v_target_user from prayer_requests where id=v_prayer;
  elsif v_testimony is not null then select author_id into v_target_user from testimonies where id=v_testimony;
  elsif v_product is not null then select s.owner_id into v_target_user from products p join shops s on s.id=p.shop_id where p.id=v_product and p.deleted_at is null;
  elsif v_shop is not null then select owner_id into v_target_user from shops where id=v_shop;
  elsif v_conversation is not null then
    select created_by into v_target_user from conversations c where c.id=v_conversation and c.kind='group' and c.deleted_at is null
      and (c.visibility='public' or exists(select 1 from conversation_members m where m.conversation_id=c.id and m.user_id=p_reporter_id and m.left_at is null));
    if not found then return 'invalid'; end if;
    if v_target_user = p_reporter_id then v_target_user := null; end if;
  end if;
  if v_target_user is null and v_conversation is null then return 'invalid'; end if;
  if v_target_user = p_reporter_id then return 'self'; end if;
  if exists(select 1 from reports r where r.reporter_id=p_reporter_id and r.status='open'
    and ((v_post is not null and r.post_id=v_post) or (v_user is not null and r.post_id is null and r.announcement_id is null and r.event_id is null and r.prayer_id is null and r.testimony_id is null and r.conversation_id is null and r.product_id is null and r.shop_id is null and r.target_user_id=v_user)
    or (v_announcement is not null and r.announcement_id=v_announcement) or (v_event is not null and r.event_id=v_event)
    or (v_prayer is not null and r.prayer_id=v_prayer) or (v_testimony is not null and r.testimony_id=v_testimony)
    or (v_conversation is not null and r.conversation_id=v_conversation) or (v_product is not null and r.product_id=v_product) or (v_shop is not null and r.shop_id=v_shop))) then return 'duplicate'; end if;
  insert into reports(reporter_id,post_id,announcement_id,event_id,prayer_id,testimony_id,conversation_id,product_id,shop_id,target_user_id,reason,details)
  values(p_reporter_id,v_post,v_announcement,v_event,v_prayer,v_testimony,v_conversation,v_product,v_shop,v_target_user,p_reason::report_reason,nullif(left(trim(coalesce(p_details,'')),500),''));
  return 'ok';
end $$;

create or replace function public.papa_list_reports(p_status text default 'open') returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id',r.id,'reason',r.reason,'details',r.details,'status',r.status,'createdAt',r.created_at,'resolution',r.resolution,
    'postId',r.post_id,'postBody',p.body,'postDeleted',(p.deleted_at is not null),
    'announcementId',r.announcement_id,'eventId',r.event_id,'prayerId',r.prayer_id,'testimonyId',r.testimony_id,'conversationId',r.conversation_id,
    'productId',r.product_id,'shopId',r.shop_id,'shopSlug',(select s.slug from shops s where s.id=r.shop_id),
    'itemTitle',coalesce((select a.title from announcements a where a.id=r.announcement_id),(select e.title from events e where e.id=r.event_id),
      (select left(pr.body,200) from prayer_requests pr where pr.id=r.prayer_id),(select t.title from testimonies t where t.id=r.testimony_id),
      (select c.title || ' · ' || (select count(*) from conversation_members m where m.conversation_id=c.id and m.left_at is null) || ' 👥' from conversations c where c.id=r.conversation_id),
      (select pr.title from products pr where pr.id=r.product_id),(select s.name from shops s where s.id=r.shop_id)),
    'itemDeleted',coalesce((select a.deleted_at is not null from announcements a where a.id=r.announcement_id),(select e.deleted_at is not null from events e where e.id=r.event_id),
      (select pr.deleted_at is not null from prayer_requests pr where pr.id=r.prayer_id),(select t.deleted_at is not null from testimonies t where t.id=r.testimony_id),
      (select c.deleted_at is not null from conversations c where c.id=r.conversation_id),(select pr.deleted_at is not null or pr.status='removed' from products pr where pr.id=r.product_id),
      (select s.deleted_at is not null or s.status='suspended' from shops s where s.id=r.shop_id),false),
    'reporterUsername',reporter.username,'targetId',target.id,'targetUsername',target.username,'targetName',target.full_name,'targetStatus',target.status,
    'sameTarget',(select count(*)::int from reports r2 where r2.status='open' and coalesce(r2.post_id::text,r2.announcement_id::text,r2.event_id::text,r2.prayer_id::text,r2.testimony_id::text,r2.conversation_id::text,r2.product_id::text,r2.shop_id::text,r2.target_user_id::text)
      =coalesce(r.post_id::text,r.announcement_id::text,r.event_id::text,r.prayer_id::text,r.testimony_id::text,r.conversation_id::text,r.product_id::text,r.shop_id::text,r.target_user_id::text)))
  from reports r join users reporter on reporter.id=r.reporter_id left join users target on target.id=r.target_user_id left join posts p on p.id=r.post_id
  where r.status=p_status::report_status order by r.created_at desc limit 100
$$;

create or replace function public.papa_resolve_reports(p_report_id uuid,p_admin_id uuid,p_status text,p_resolution text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r reports%rowtype;
begin
  if p_status not in ('actioned','dismissed') then raise exception 'invalid_report_status'; end if;
  select * into r from reports where id=p_report_id;
  if not found then return null; end if;
  update reports x set status=p_status::report_status,handled_by=p_admin_id,handled_at=now(),resolution=left(coalesce(p_resolution,''),1000)
  where x.status='open' and coalesce(x.post_id::text,x.announcement_id::text,x.event_id::text,x.prayer_id::text,x.testimony_id::text,x.conversation_id::text,x.product_id::text,x.shop_id::text,x.target_user_id::text)
    =coalesce(r.post_id::text,r.announcement_id::text,r.event_id::text,r.prayer_id::text,r.testimony_id::text,r.conversation_id::text,r.product_id::text,r.shop_id::text,r.target_user_id::text);
  return to_jsonb(r);
end $$;

create or replace function public.papa_open_report_count() returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from reports where status='open'
$$;

revoke all on function public.papa_file_report(uuid,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.papa_list_reports(text) from public,anon,authenticated;
revoke all on function public.papa_resolve_reports(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.papa_open_report_count() from public,anon,authenticated;
grant execute on function public.papa_file_report(uuid,jsonb,text,text) to service_role;
grant execute on function public.papa_list_reports(text) to service_role;
grant execute on function public.papa_resolve_reports(uuid,uuid,text,text) to service_role;
grant execute on function public.papa_open_report_count() to service_role;
