-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
create or replace function public.papa_create_publication_series(
	p_name text, p_slug text, p_kind publication_kind, p_created_by uuid
)
returns uuid language plpgsql security definer set search_path = public as $$
declare saved_id uuid;
begin
	insert into publication_series (name, slug, kind, created_by)
	values (p_name, p_slug, p_kind, p_created_by)
	returning id into saved_id;
	return saved_id;
end;
$$;

create or replace function public.papa_release_publication(p_publication_id uuid)
returns table (id uuid, series_id uuid, created_by uuid)
language sql security definer set search_path = public as $$
	update publications
	set status = 'published', published_at = coalesce(published_at, now()), publish_at = null
	where publications.id = p_publication_id
	returning publications.id, publications.series_id, publications.created_by
$$;

create or replace function public.papa_delete_publication(p_publication_id uuid)
returns boolean language sql security definer set search_path = public as $$
	with deleted as (
		update publications set deleted_at = now()
		where id = p_publication_id and deleted_at is null
		returning 1
	)
	select exists (select 1 from deleted)
$$;

create or replace function public.papa_save_publication_progress(
	p_user_id uuid, p_publication_id uuid, p_position integer, p_percent smallint
)
returns void language plpgsql security definer set search_path = public as $$
declare inserted_count integer;
begin
	insert into reading_progress (user_id, publication_id, position, percent)
	values (p_user_id, p_publication_id, p_position, p_percent)
	on conflict (user_id, publication_id) do nothing;
	get diagnostics inserted_count = row_count;
	if inserted_count = 1 then
		update publications set read_count = read_count + 1 where id = p_publication_id;
	else
		update reading_progress
		set position = p_position, percent = p_percent, updated_at = now()
		where user_id = p_user_id and publication_id = p_publication_id;
	end if;
end;
$$;

create or replace function public.papa_set_publication_saved(
	p_user_id uuid, p_publication_id uuid, p_on boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
	if p_on then
		insert into publication_saves (user_id, publication_id)
		values (p_user_id, p_publication_id) on conflict do nothing;
	else
		delete from publication_saves where user_id = p_user_id and publication_id = p_publication_id;
	end if;
end;
$$;

create or replace function public.papa_set_series_follow(
	p_user_id uuid, p_series_id uuid, p_on boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
	if p_on then
		insert into series_follows (user_id, series_id)
		values (p_user_id, p_series_id) on conflict do nothing;
	else
		delete from series_follows where user_id = p_user_id and series_id = p_series_id;
	end if;
end;
$$;

revoke all on function public.papa_create_publication_series(text, text, publication_kind, uuid) from public, anon, authenticated;
revoke all on function public.papa_release_publication(uuid) from public, anon, authenticated;
revoke all on function public.papa_delete_publication(uuid) from public, anon, authenticated;
revoke all on function public.papa_save_publication_progress(uuid, uuid, integer, smallint) from public, anon, authenticated;
revoke all on function public.papa_set_publication_saved(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.papa_set_series_follow(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.papa_create_publication_series(text, text, publication_kind, uuid) to service_role;
grant execute on function public.papa_release_publication(uuid) to service_role;
grant execute on function public.papa_delete_publication(uuid) to service_role;
grant execute on function public.papa_save_publication_progress(uuid, uuid, integer, smallint) to service_role;
grant execute on function public.papa_set_publication_saved(uuid, uuid, boolean) to service_role;
grant execute on function public.papa_set_series_follow(uuid, uuid, boolean) to service_role;
