-- Server-only full-text post search with the same visibility rules used by the feed.
create or replace function public.papa_search_post_ids(
  p_query text,
  p_viewer_id uuid default null,
  p_media_only boolean default false,
  p_top boolean default false,
  p_limit integer default 30
) returns table(id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from posts p
  join users u on u.id = p.author_id
  left join user_preferences pr on pr.user_id = p.author_id
  where p.deleted_at is null and p.is_draft = false and p.published_at <= now()
    and u.status = 'active'
    and to_tsvector('simple', coalesce(p.body,'')) @@ to_tsquery('simple', p_query)
    and (not p_media_only or exists(select 1 from post_media pm where pm.post_id = p.id))
    and (p_viewer_id is not null or (coalesce(pr.private_profile,false)=false and coalesce(pr.visible_to_guests,true)=true))
    and (p_viewer_id is null or (
      not exists(select 1 from blocks b where (b.blocker_id=p_viewer_id and b.blocked_id=p.author_id) or (b.blocker_id=p.author_id and b.blocked_id=p_viewer_id))
      and (coalesce(pr.private_profile,false)=false or p.author_id=p_viewer_id or exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=p.author_id))
      and not exists(select 1 from mutes m where m.muter_id=p_viewer_id and m.muted_id=p.author_id)
    ))
  order by
    case when p_top then (p.like_count + 2*p.repost_count + p.reply_count)::bigint else 0::bigint end desc,
    p.published_at desc
  limit least(100,greatest(1,coalesce(p_limit,30)))
$$;
revoke all on function public.papa_search_post_ids(text,uuid,boolean,boolean,integer) from public, anon, authenticated;
grant execute on function public.papa_search_post_ids(text,uuid,boolean,boolean,integer) to service_role;
