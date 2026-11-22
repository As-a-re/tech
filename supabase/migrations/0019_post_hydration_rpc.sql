-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
create or replace function public.papa_hydrate_posts(
	post_ids uuid[], viewer_id uuid default null, include_deleted boolean default false
)
returns table (
	id uuid, body text, created_at timestamptz, published_at timestamptz, edited_at timestamptz, deleted_at timestamptz,
	reply_to_id uuid, quote_of_id uuid, reply_setting text, link_preview jsonb,
	reply_count integer, like_count integer, repost_count integer, quote_count integer, bookmark_count integer, view_count integer,
	author_id uuid, username text, full_name text, avatar_url text, verified boolean, assembly_name text,
	reply_to_username text, pinned boolean
)
language sql stable security definer set search_path = public
as $$
	select p.id, p.body, p.created_at, p.published_at, p.edited_at, p.deleted_at, p.reply_to_id, p.quote_of_id,
		p.reply_setting::text, p.link_preview, p.reply_count, p.like_count, p.repost_count, p.quote_count, p.bookmark_count, p.view_count,
		u.id, u.username, u.full_name, u.avatar_url, (u.verified_at is not null), a.name, ru.username,
		exists (select 1 from pinned_posts pp where pp.post_id = p.id)
	from posts p join users u on u.id = p.author_id left join user_preferences pr on pr.user_id = p.author_id
		join assemblies a on a.id = u.assembly_id left join posts rp on rp.id = p.reply_to_id left join users ru on ru.id = rp.author_id
	where p.id = any(post_ids) and (
		(p.deleted_at is null and p.is_draft = false and p.published_at <= now() and u.status = 'active' and (
			(viewer_id is null and coalesce(pr.private_profile, false) = false and coalesce(pr.visible_to_guests, true) = true)
			or (viewer_id is not null and not exists (select 1 from blocks b where (b.blocker_id = viewer_id and b.blocked_id = p.author_id) or (b.blocker_id = p.author_id and b.blocked_id = viewer_id))
				and (coalesce(pr.private_profile, false) = false or p.author_id = viewer_id or exists (select 1 from follows f where f.follower_id = viewer_id and f.followee_id = p.author_id)))
		)) or (include_deleted and p.deleted_at is not null and p.is_draft = false)
	)
$$;
revoke all on function public.papa_hydrate_posts(uuid[], uuid, boolean) from public, anon, authenticated;
grant execute on function public.papa_hydrate_posts(uuid[], uuid, boolean) to service_role;
