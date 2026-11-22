-- Transactional edit/publish/delete/scheduled-release operations for posts.
create or replace function public.papa_edit_post(
  p_author_id uuid,p_post_id uuid,p_body text,p_link_preview jsonb,p_tags text[],p_mention_ids uuid[]
) returns boolean language plpgsql security definer set search_path=public as $$
declare p posts%rowtype; v_pending boolean;
begin
  select * into p from posts where id=p_post_id and author_id=p_author_id and deleted_at is null for update;
  if not found then return false; end if;
  v_pending:=p.is_draft or (p.published_at is not null and p.published_at>now());
  if not v_pending and p.published_at < now()-interval '30 minutes' then return false; end if;
  if p.body=p_body then return true; end if;
  if not v_pending then insert into post_edits(post_id,body) values(p_post_id,p.body); end if;
  update posts set body=p_body,link_preview=p_link_preview,edited_at=case when v_pending then null else now() end where id=p_post_id;
  delete from post_hashtags where post_id=p_post_id;
  delete from post_mentions where post_id=p_post_id;
  insert into post_hashtags(post_id,tag) select p_post_id,x from unnest(coalesce(p_tags,'{}'::text[])) x on conflict do nothing;
  insert into post_mentions(post_id,user_id) select p_post_id,x from unnest(coalesce(p_mention_ids,'{}'::uuid[])) x on conflict do nothing;
  return true;
end $$;

create or replace function public.papa_publish_draft(p_author_id uuid,p_post_id uuid,p_publish_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p posts%rowtype; v_live boolean; v_at timestamptz;
begin
  select * into p from posts where id=p_post_id and author_id=p_author_id and deleted_at is null for update;
  if not found or (not p.is_draft and not (p.published_at is not null and p.published_at>now())) then return null; end if;
  if p_publish_at is not null and p_publish_at<now()-interval '1 minute' then raise exception 'schedule_past'; end if;
  v_at:=coalesce(p_publish_at,now()); v_live:=v_at<=now();
  update posts set is_draft=false,published_at=v_at,notified_at=case when v_live then now() else null end where id=p_post_id;
  if v_live and p.reply_to_id is not null then update posts set reply_count=reply_count+1 where id=p.reply_to_id; end if;
  if v_live and p.quote_of_id is not null then update posts set quote_count=quote_count+1 where id=p.quote_of_id; end if;
  return jsonb_build_object('id',p.id,'author_id',p.author_id,'reply_to_id',p.reply_to_id,'quote_of_id',p.quote_of_id,'live',v_live);
end $$;

create or replace function public.papa_delete_post(p_user_id uuid,p_post_id uuid,p_as_admin boolean default false)
returns boolean language plpgsql security definer set search_path=public as $$
declare p posts%rowtype; v_live boolean;
begin
  select * into p from posts where id=p_post_id and deleted_at is null for update;
  if not found or (p.author_id<>p_user_id and not p_as_admin) then return false; end if;
  v_live:=not p.is_draft and p.published_at is not null and p.published_at<=now();
  if not v_live then delete from posts where id=p_post_id; return true; end if;
  update posts set deleted_at=now(),body='',link_preview=null where id=p_post_id;
  delete from post_media where post_id=p_post_id;
  delete from post_hashtags where post_id=p_post_id;
  delete from pinned_posts where post_id=p_post_id;
  if p.reply_to_id is not null then update posts set reply_count=greatest(reply_count-1,0) where id=p.reply_to_id; end if;
  if p.quote_of_id is not null then update posts set quote_count=greatest(quote_count-1,0) where id=p.quote_of_id; end if;
  return true;
end $$;

create or replace function public.papa_release_scheduled_posts()
returns table(id uuid,author_id uuid,reply_to_id uuid,quote_of_id uuid)
language plpgsql security definer set search_path=public as $$
declare p posts%rowtype;
begin
  for p in select * from posts where notified_at is null and is_draft=false and deleted_at is null and published_at is not null and published_at<=now() for update skip locked loop
    update posts set notified_at=now() where posts.id=p.id;
    if p.reply_to_id is not null then update posts set reply_count=reply_count+1 where posts.id=p.reply_to_id; end if;
    if p.quote_of_id is not null then update posts set quote_count=quote_count+1 where posts.id=p.quote_of_id; end if;
    id:=p.id; author_id:=p.author_id; reply_to_id:=p.reply_to_id; quote_of_id:=p.quote_of_id; return next;
  end loop;
end $$;

revoke all on function public.papa_edit_post(uuid,uuid,text,jsonb,text[],uuid[]) from public,anon,authenticated;
revoke all on function public.papa_publish_draft(uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.papa_delete_post(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.papa_release_scheduled_posts() from public,anon,authenticated;
grant execute on function public.papa_edit_post(uuid,uuid,text,jsonb,text[],uuid[]) to service_role;
grant execute on function public.papa_publish_draft(uuid,uuid,timestamptz) to service_role;
grant execute on function public.papa_delete_post(uuid,uuid,boolean) to service_role;
grant execute on function public.papa_release_scheduled_posts() to service_role;
