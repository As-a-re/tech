-- Server-only post feed entry selector. Authorization is enforced here, not in the client.
create or replace function public.papa_post_feed_entries(
 p_mode text,p_viewer_id uuid default null,p_author_id uuid default null,p_post_id uuid default null,p_tag text default null,
 p_cursor_at timestamptz default null,p_cursor_id uuid default null,p_page integer default 0,p_limit integer default 20
) returns table(post_id uuid,at timestamptz,reposter_username text,reposter_name text)
language plpgsql stable security definer set search_path=public as $$
begin
 if p_mode not in ('for_you','following','favorites','profile_posts','profile_replies','profile_media','profile_likes','hashtag','bookmarks','thread_replies') then raise exception 'invalid_feed_mode'; end if;
 if p_mode in ('following','favorites','profile_likes','bookmarks') and p_viewer_id is null then return; end if;
 if p_mode like 'profile_%' and p_author_id is null then raise exception 'author_required'; end if;
 return query
 with candidates as (
  select p.id as pid,p.published_at as ts,null::text as ru,null::text as rn,p.author_id,p.reply_to_id,p.is_draft,p.deleted_at,p.published_at,p.like_count,p.repost_count,p.reply_count,p.quote_count
  from posts p join users u on u.id=p.author_id left join user_preferences pr on pr.user_id=p.author_id
  where p.published_at is not null and p.published_at<=now() and not p.is_draft and p.deleted_at is null and u.status='active'
   and (p_viewer_id is not null or (coalesce(pr.private_profile,false)=false and coalesce(pr.visible_to_guests,true)))
   and (p_viewer_id is null or (not exists(select 1 from blocks b where (b.blocker_id=p_viewer_id and b.blocked_id=p.author_id) or (b.blocker_id=p.author_id and b.blocked_id=p_viewer_id)) and (not coalesce(pr.private_profile,false) or p.author_id=p_viewer_id or exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=p.author_id))))
   and case p_mode
    when 'for_you' then p.reply_to_id is null and p.published_at>now()-interval '21 days' and (p_viewer_id is null or not exists(select 1 from mutes m where m.muter_id=p_viewer_id and m.muted_id=p.author_id))
    when 'following' then p.reply_to_id is null and (p.author_id=p_viewer_id or exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=p.author_id)) and (p_viewer_id is null or not exists(select 1 from mutes m where m.muter_id=p_viewer_id and m.muted_id=p.author_id))
    when 'favorites' then p.reply_to_id is null and exists(select 1 from favorites fa where fa.user_id=p_viewer_id and fa.favorite_id=p.author_id)
    when 'profile_posts' then p.author_id=p_author_id and p.reply_to_id is null and not exists(select 1 from pinned_posts pp where pp.post_id=p.id)
    when 'profile_replies' then p.author_id=p_author_id and p.reply_to_id is not null
    when 'profile_media' then p.author_id=p_author_id and exists(select 1 from post_media pm where pm.post_id=p.id)
    when 'profile_likes' then p_viewer_id=p_author_id and exists(select 1 from likes l where l.user_id=p_author_id and l.post_id=p.id)
    when 'hashtag' then exists(select 1 from post_hashtags h where h.post_id=p.id and h.tag=lower(p_tag)) and (p_viewer_id is null or not exists(select 1 from mutes m where m.muter_id=p_viewer_id and m.muted_id=p.author_id))
    when 'bookmarks' then exists(select 1 from bookmarks b where b.user_id=p_viewer_id and b.post_id=p.id)
    when 'thread_replies' then p.reply_to_id=p_post_id and (p_viewer_id is null or not exists(select 1 from mutes m where m.muter_id=p_viewer_id and m.muted_id=p.author_id))
    else false end
  union all
  select p.id,r.created_at,ru.username,ru.full_name,p.author_id,p.reply_to_id,p.is_draft,p.deleted_at,p.published_at,p.like_count,p.repost_count,p.reply_count,p.quote_count
  from reposts r join users ru on ru.id=r.user_id join posts p on p.id=r.post_id join users u on u.id=p.author_id left join user_preferences pr on pr.user_id=p.author_id
  where p_mode in ('following','profile_posts') and (
    (p_mode='following' and r.user_id<>p_viewer_id and exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=r.user_id))
    or (p_mode='profile_posts' and r.user_id=p_author_id)
   )
   and p.deleted_at is null and not p.is_draft and p.published_at<=now() and u.status='active'
   and (p_viewer_id is not null or (coalesce(pr.private_profile,false)=false and coalesce(pr.visible_to_guests,true)))
   and (p_viewer_id is null or (not exists(select 1 from blocks b where (b.blocker_id=p_viewer_id and b.blocked_id=p.author_id) or (b.blocker_id=p.author_id and b.blocked_id=p_viewer_id)) and (not coalesce(pr.private_profile,false) or p.author_id=p_viewer_id or exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=p.author_id))))
   and (p_mode<>'following' or not exists(select 1 from mutes m where m.muter_id=p_viewer_id and m.muted_id=p.author_id))
 )
 select c.pid,c.ts,c.ru,c.rn from candidates c
 where (p_cursor_at is null or (c.ts,c.pid)<(p_cursor_at,p_cursor_id))
 order by
  case when p_mode='for_you' then (
    (c.like_count*2+c.repost_count*3+c.reply_count*2+c.quote_count*2+1)::numeric
    * (1
      + case when p_viewer_id is not null and exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=c.author_id) then 1.5 else 0 end
      + case when p_viewer_id is not null and (select assembly_id from users where id=c.author_id)=(select assembly_id from users where id=p_viewer_id) then 0.8 else 0 end
      + case when p_viewer_id is not null and (select district_id from assemblies where id=(select assembly_id from users where id=c.author_id))=(select district_id from assemblies where id=(select assembly_id from users where id=p_viewer_id)) then 0.4 else 0 end
      + case when exists(select 1 from users uu where uu.id=c.author_id and uu.verified_at is not null) then 0.3 else 0 end)
    / power(extract(epoch from (now()-c.published_at))/3600+2,1.5)
  ) else 0 end desc,
  case when p_mode='thread_replies' and c.author_id=(select author_id from posts where id=p_post_id) then 1 else 0 end desc,
  case when p_mode='thread_replies' then c.like_count else 0 end desc,
  case when p_mode='thread_replies' then c.published_at end asc nulls last,
  case when p_mode<>'thread_replies' then c.ts end desc,c.pid desc
 limit least(100,greatest(1,coalesce(p_limit,20))) offset case when p_mode='for_you' then greatest(0,p_page)*least(100,greatest(1,coalesce(p_limit,20))) else 0 end;
end $$;

create or replace function public.papa_post_engagers(p_post_id uuid,p_kind text,p_viewer_id uuid default null)
returns table(id uuid,username text,full_name text,avatar_url text,bio text,assembly_name text,verified boolean)
language plpgsql stable security definer set search_path=public as $$
begin
 if p_kind not in ('likes','reposts') then raise exception 'invalid_engager_kind'; end if;
 return query execute format('select u.id,u.username,u.full_name,u.avatar_url,u.bio,a.name,(u.verified_at is not null) from %I x join users u on u.id=x.user_id join assemblies a on a.id=u.assembly_id where x.post_id=$1 and u.status=''active'' and ($2 is null or not exists(select 1 from blocks b where (b.blocker_id=$2 and b.blocked_id=u.id) or (b.blocker_id=u.id and b.blocked_id=$2))) order by x.created_at desc limit 100',p_kind) using p_post_id,p_viewer_id;
end $$;
revoke all on function public.papa_post_feed_entries(text,uuid,uuid,uuid,text,timestamptz,uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.papa_post_engagers(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.papa_post_feed_entries(text,uuid,uuid,uuid,text,timestamptz,uuid,integer,integer) to service_role;
grant execute on function public.papa_post_engagers(uuid,text,uuid) to service_role;
