-- Atomic post interactions and view counters, exposed only to the trusted server client.
create or replace function public.papa_react_post(p_user_id uuid,p_post_id uuid,p_kind text,p_on boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_author uuid; v_changed integer:=0;
begin
  if p_kind not in ('like','repost','bookmark') then raise exception 'invalid_reaction_kind'; end if;
  select author_id into v_author from posts where id=p_post_id and deleted_at is null and is_draft=false and published_at<=now();
  if not found then return jsonb_build_object('ok',false,'changed',false,'author_id',null); end if;
  if p_kind='repost' and v_author=p_user_id then return jsonb_build_object('ok',false,'changed',false,'author_id',v_author); end if;
  if p_kind='like' then
    if p_on then insert into likes(user_id,post_id) values(p_user_id,p_post_id) on conflict do nothing; get diagnostics v_changed=row_count;
    else delete from likes where user_id=p_user_id and post_id=p_post_id; get diagnostics v_changed=row_count; end if;
    if v_changed>0 then update posts set like_count=greatest(0,like_count+case when p_on then 1 else -1 end) where id=p_post_id; end if;
  elsif p_kind='repost' then
    if p_on then insert into reposts(user_id,post_id) values(p_user_id,p_post_id) on conflict do nothing; get diagnostics v_changed=row_count;
    else delete from reposts where user_id=p_user_id and post_id=p_post_id; get diagnostics v_changed=row_count; end if;
    if v_changed>0 then update posts set repost_count=greatest(0,repost_count+case when p_on then 1 else -1 end) where id=p_post_id; end if;
  else
    if p_on then insert into bookmarks(user_id,post_id) values(p_user_id,p_post_id) on conflict do nothing; get diagnostics v_changed=row_count;
    else delete from bookmarks where user_id=p_user_id and post_id=p_post_id; get diagnostics v_changed=row_count; end if;
    if v_changed>0 then update posts set bookmark_count=greatest(0,bookmark_count+case when p_on then 1 else -1 end) where id=p_post_id; end if;
  end if;
  return jsonb_build_object('ok',true,'changed',v_changed>0,'author_id',v_author);
end $$;

create or replace function public.papa_vote_post(p_user_id uuid,p_post_id uuid,p_option_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_end timestamptz; v_changed integer;
begin
  select po.ends_at into v_end from polls po where po.post_id=p_post_id;
  if v_end is null then return 'invalid'; end if;
  if not exists(select 1 from poll_options where id=p_option_id and post_id=p_post_id) then return 'invalid'; end if;
  if v_end<=now() then return 'ended'; end if;
  if not exists(select 1 from posts where id=p_post_id and deleted_at is null and is_draft=false and published_at<=now()) then return 'invalid'; end if;
  insert into poll_votes(post_id,user_id,option_id) values(p_post_id,p_user_id,p_option_id) on conflict do nothing;
  get diagnostics v_changed=row_count;
  if v_changed=0 then return 'already'; end if;
  update poll_options set votes=votes+1 where id=p_option_id and post_id=p_post_id;
  return 'ok';
end $$;

create or replace function public.papa_pin_post(p_user_id uuid,p_post_id uuid,p_on boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_author uuid; v_reply uuid; v_deleted timestamptz; v_draft boolean;
begin
  if not p_on then delete from pinned_posts where user_id=p_user_id and post_id=p_post_id; return true; end if;
  select author_id,reply_to_id,deleted_at,is_draft into v_author,v_reply,v_deleted,v_draft from posts where id=p_post_id;
  if not found or v_author<>p_user_id or v_reply is not null or v_deleted is not null or v_draft then return false; end if;
  insert into pinned_posts(user_id,post_id) values(p_user_id,p_post_id) on conflict(user_id) do update set post_id=excluded.post_id;
  return true;
end $$;

create or replace function public.papa_set_favorite(p_user_id uuid,p_favorite_id uuid,p_on boolean)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if p_user_id=p_favorite_id then return false; end if;
  if p_on then insert into favorites(user_id,favorite_id) values(p_user_id,p_favorite_id) on conflict do nothing;
  else delete from favorites where user_id=p_user_id and favorite_id=p_favorite_id; end if;
  return true;
end $$;

create or replace function public.papa_increment_post_views(p_post_ids uuid[])
returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin update posts set view_count=view_count+1 where id=any(coalesce(p_post_ids,'{}'::uuid[])); get diagnostics n=row_count; return coalesce(n,0); end $$;

revoke all on function public.papa_react_post(uuid,uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.papa_vote_post(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.papa_pin_post(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.papa_set_favorite(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.papa_increment_post_views(uuid[]) from public,anon,authenticated;
grant execute on function public.papa_react_post(uuid,uuid,text,boolean) to service_role;
grant execute on function public.papa_vote_post(uuid,uuid,uuid) to service_role;
grant execute on function public.papa_pin_post(uuid,uuid,boolean) to service_role;
grant execute on function public.papa_set_favorite(uuid,uuid,boolean) to service_role;
grant execute on function public.papa_increment_post_views(uuid[]) to service_role;
