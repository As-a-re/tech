create or replace function public.papa_trending_tags(p_viewer_id uuid default null,p_limit integer default 8)
returns table(tag text,posts integer) language sql stable security definer set search_path=public as $$
 select h.tag,count(*)::integer
 from post_hashtags h join posts p on p.id=h.post_id join users u on u.id=p.author_id left join user_preferences pr on pr.user_id=p.author_id
 where p.published_at>now()-interval '3 days' and p.published_at<=now() and p.deleted_at is null and p.is_draft=false and u.status='active'
 and (p_viewer_id is not null or (coalesce(pr.private_profile,false)=false and coalesce(pr.visible_to_guests,true)))
 and (p_viewer_id is null or (not exists(select 1 from blocks b where (b.blocker_id=p_viewer_id and b.blocked_id=p.author_id) or (b.blocker_id=p.author_id and b.blocked_id=p_viewer_id)) and (not coalesce(pr.private_profile,false) or p.author_id=p_viewer_id or exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=p.author_id))))
 group by h.tag order by sum(1.0/(extract(epoch from now()-p.published_at)/3600+2)) desc,count(*) desc limit least(50,greatest(1,coalesce(p_limit,8)))
$$;
create or replace function public.papa_popular_post_ids(p_viewer_id uuid default null,p_limit integer default 20)
returns table(id uuid) language sql stable security definer set search_path=public as $$
 select p.id from posts p join users u on u.id=p.author_id left join user_preferences pr on pr.user_id=p.author_id
 where p.deleted_at is null and not p.is_draft and p.published_at>now()-interval '7 days' and p.published_at<=now() and p.reply_to_id is null and u.status='active'
 and (p_viewer_id is not null or (coalesce(pr.private_profile,false)=false and coalesce(pr.visible_to_guests,true)))
 and (p_viewer_id is null or (not exists(select 1 from blocks b where (b.blocker_id=p_viewer_id and b.blocked_id=p.author_id) or (b.blocker_id=p.author_id and b.blocked_id=p_viewer_id)) and not exists(select 1 from mutes m where m.muter_id=p_viewer_id and m.muted_id=p.author_id) and (not coalesce(pr.private_profile,false) or p.author_id=p_viewer_id or exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=p.author_id))))
 order by (p.like_count+2*p.repost_count+p.reply_count+p.quote_count) desc,p.published_at desc limit least(100,greatest(1,coalesce(p_limit,20)))
$$;
create or replace function public.papa_who_to_follow(p_viewer_id uuid default null,p_limit integer default 5)
returns table(id uuid,username text,full_name text,avatar_url text,verified boolean,bio text,assembly_name text,reason text)
language sql stable security definer set search_path=public as $$
 select u.id,u.username,u.full_name,u.avatar_url,(u.verified_at is not null),u.bio,a.name,
 case when u.assembly_id=me.assembly_id then 'assembly' when a.district_id=me.district_id then 'district' else 'popular' end
 from users u join assemblies a on a.id=u.assembly_id left join user_preferences pr on pr.user_id=u.id
 left join lateral (select mu.assembly_id,ma.district_id from users mu left join assemblies ma on ma.id=mu.assembly_id where mu.id=p_viewer_id) me on true
 where u.status='active' and u.onboarded_at is not null and (p_viewer_id is null or u.id<>p_viewer_id)
 and (p_viewer_id is not null or coalesce(pr.visible_to_guests,true))
 and (p_viewer_id is null or (not exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=u.id) and not exists(select 1 from follow_requests fr where fr.requester_id=p_viewer_id and fr.target_id=u.id) and not exists(select 1 from blocks b where (b.blocker_id=p_viewer_id and b.blocked_id=u.id) or (b.blocker_id=u.id and b.blocked_id=p_viewer_id))))
 order by (u.assembly_id=me.assembly_id) desc nulls last,(a.district_id=me.district_id) desc nulls last,(select count(*) from follows f2 where f2.followee_id=u.id) desc,u.verified_at desc nulls last,u.created_at desc limit least(50,greatest(1,coalesce(p_limit,5)))
$$;
revoke all on function public.papa_trending_tags(uuid,integer) from public,anon,authenticated;
revoke all on function public.papa_popular_post_ids(uuid,integer) from public,anon,authenticated;
revoke all on function public.papa_who_to_follow(uuid,integer) from public,anon,authenticated;
grant execute on function public.papa_trending_tags(uuid,integer) to service_role;
grant execute on function public.papa_popular_post_ids(uuid,integer) to service_role;
grant execute on function public.papa_who_to_follow(uuid,integer) to service_role;
