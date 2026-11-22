-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
create or replace function public.papa_create_post(
	p_author_id uuid, p_body text, p_reply_to_id uuid default null, p_root_id uuid default null, p_quote_of_id uuid default null,
	p_reply_setting text default 'everyone', p_link_preview jsonb default null, p_is_draft boolean default false,
	p_published_at timestamptz default null, p_notified_at timestamptz default null, p_media jsonb default '[]'::jsonb,
	p_poll_options text[] default null, p_poll_ends_at timestamptz default null, p_tags text[] default '{}', p_mention_ids uuid[] default '{}'
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_id uuid;
begin
	insert into posts (author_id, body, reply_to_id, root_id, quote_of_id, reply_setting, link_preview, is_draft, published_at, notified_at)
	values (p_author_id, p_body, p_reply_to_id, p_root_id, p_quote_of_id, p_reply_setting::reply_setting, p_link_preview, p_is_draft, p_published_at, p_notified_at)
	returning id into new_id;
	insert into post_media (post_id, kind, url, alt, width, height, position)
	select new_id, x.kind::media_kind, x.url, nullif(x.alt, ''), x.width, x.height, x.position
	from jsonb_to_recordset(p_media) as x(kind text, url text, alt text, width integer, height integer, position smallint);
	if p_poll_options is not null and cardinality(p_poll_options) > 0 then
		insert into polls (post_id, ends_at) values (new_id, p_poll_ends_at);
		insert into poll_options (post_id, label, position) select new_id, value, ordinality::smallint from unnest(p_poll_options) with ordinality;
	end if;
	insert into post_hashtags (post_id, tag) select new_id, value from unnest(p_tags) as value on conflict do nothing;
	insert into post_mentions (post_id, user_id) select new_id, value from unnest(p_mention_ids) as value on conflict do nothing;
	if not p_is_draft and p_published_at is not null and p_published_at <= now() and p_reply_to_id is not null then update posts set reply_count = reply_count + 1 where id = p_reply_to_id; end if;
	if not p_is_draft and p_published_at is not null and p_published_at <= now() and p_quote_of_id is not null then update posts set quote_count = quote_count + 1 where id = p_quote_of_id; end if;
	return new_id;
end;
$$;
revoke all on function public.papa_create_post(uuid, text, uuid, uuid, uuid, text, jsonb, boolean, timestamptz, timestamptz, jsonb, text[], timestamptz, text[], uuid[]) from public, anon, authenticated;
grant execute on function public.papa_create_post(uuid, text, uuid, uuid, uuid, text, jsonb, boolean, timestamptz, timestamptz, jsonb, text[], timestamptz, text[], uuid[]) to service_role;
