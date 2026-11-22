-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
create or replace function public.papa_save_publication(
	p_publication_id uuid, p_created_by uuid, p_data jsonb, p_chapters jsonb default '[]'::jsonb
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare saved_id uuid;
begin
	if p_publication_id is null then
		insert into publications (kind, format, title, subtitle, description, author, series_id, edition, language, level, district_id, assembly_id, cover_url, file_url, preview_url, page_count, preview_pages, price_pesewas, status, publish_at, updated_at, created_by)
		values ((p_data->>'kind')::publication_kind, (p_data->>'format')::publication_format, p_data->>'title', nullif(p_data->>'subtitle', ''), coalesce(p_data->>'description', ''), nullif(p_data->>'author', ''), nullif(p_data->>'seriesId', '')::uuid, nullif(p_data->>'edition', ''), coalesce(p_data->>'language', 'en'), (p_data->>'level')::level, nullif(p_data->>'districtId', '')::uuid, nullif(p_data->>'assemblyId', '')::uuid, nullif(p_data->>'coverUrl', ''), nullif(p_data->>'fileUrl', ''), nullif(p_data->>'previewUrl', ''), (p_data->>'pageCount')::integer, (p_data->>'previewPages')::smallint, (p_data->>'pricePesewas')::integer, (p_data->>'status')::content_status, nullif(p_data->>'publish_at', '')::timestamptz, (p_data->>'updated_at')::timestamptz, p_created_by)
		returning id into saved_id;
	else
		update publications set kind = (p_data->>'kind')::publication_kind, format = (p_data->>'format')::publication_format, title = p_data->>'title', subtitle = nullif(p_data->>'subtitle', ''), description = coalesce(p_data->>'description', ''), author = nullif(p_data->>'author', ''), series_id = nullif(p_data->>'seriesId', '')::uuid, edition = nullif(p_data->>'edition', ''), language = coalesce(p_data->>'language', 'en'), level = (p_data->>'level')::level, district_id = nullif(p_data->>'districtId', '')::uuid, assembly_id = nullif(p_data->>'assemblyId', '')::uuid, cover_url = nullif(p_data->>'coverUrl', ''), file_url = nullif(p_data->>'fileUrl', ''), preview_url = nullif(p_data->>'previewUrl', ''), page_count = (p_data->>'pageCount')::integer, preview_pages = (p_data->>'previewPages')::smallint, price_pesewas = (p_data->>'pricePesewas')::integer, status = (p_data->>'status')::content_status, publish_at = nullif(p_data->>'publish_at', '')::timestamptz, updated_at = (p_data->>'updated_at')::timestamptz where id = p_publication_id and deleted_at is null returning id into saved_id;
		if saved_id is null then raise exception 'publication_not_found'; end if;
	end if;
	if (p_data->>'format') = 'article' then
		delete from publication_chapters where publication_id = saved_id;
		insert into publication_chapters (publication_id, position, title, body) select saved_id, x.position, x.title, x.body from jsonb_to_recordset(p_chapters) as x(position smallint, title text, body text);
	end if;
	return saved_id;
end;
$$;
create or replace function public.papa_save_kids_item(p_item_id uuid, p_created_by uuid, p_data jsonb, p_questions jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare saved_id uuid;
begin
	if p_item_id is null then
		insert into kids_items (kind, age_group, title, summary, body, bible_ref, cover_url, audio_url, video_url, file_url, week_of, level, district_id, assembly_id, status, published_at, updated_at, created_by)
		values ((p_data->>'kind')::kids_kind, (p_data->>'ageGroup')::age_group, p_data->>'title', nullif(p_data->>'summary', ''), coalesce(p_data->>'body', ''), nullif(p_data->>'bibleRef', ''), nullif(p_data->>'coverUrl', ''), nullif(p_data->>'audioUrl', ''), nullif(p_data->>'videoUrl', ''), nullif(p_data->>'fileUrl', ''), nullif(p_data->>'weekOf', '')::date, (p_data->>'level')::level, nullif(p_data->>'districtId', '')::uuid, nullif(p_data->>'assemblyId', '')::uuid, (p_data->>'status')::content_status, nullif(p_data->>'published_at', '')::timestamptz, (p_data->>'updated_at')::timestamptz, p_created_by)
		returning id into saved_id;
	else
		update kids_items set kind = (p_data->>'kind')::kids_kind, age_group = (p_data->>'ageGroup')::age_group, title = p_data->>'title', summary = nullif(p_data->>'summary', ''), body = coalesce(p_data->>'body', ''), bible_ref = nullif(p_data->>'bibleRef', ''), cover_url = nullif(p_data->>'coverUrl', ''), audio_url = nullif(p_data->>'audioUrl', ''), video_url = nullif(p_data->>'videoUrl', ''), file_url = nullif(p_data->>'fileUrl', ''), week_of = nullif(p_data->>'weekOf', '')::date, level = (p_data->>'level')::level, district_id = nullif(p_data->>'districtId', '')::uuid, assembly_id = nullif(p_data->>'assemblyId', '')::uuid, status = (p_data->>'status')::content_status, published_at = nullif(p_data->>'published_at', '')::timestamptz, updated_at = (p_data->>'updated_at')::timestamptz where id = p_item_id and deleted_at is null returning id into saved_id;
		if saved_id is null then raise exception 'kids_item_not_found'; end if;
	end if;
	delete from kids_quiz_questions where item_id = saved_id;
	insert into kids_quiz_questions (item_id, position, question, options, answer, explain) select saved_id, x.position, x.question, x.options, x.answer, nullif(x.explain, '') from jsonb_to_recordset(case when (p_data->>'kind') = 'quiz' then p_questions else '[]'::jsonb end) as x(position smallint, question text, options jsonb, answer smallint, explain text);
	return saved_id;
end;
$$;
revoke all on function public.papa_save_publication(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.papa_save_kids_item(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.papa_save_publication(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.papa_save_kids_item(uuid, uuid, jsonb, jsonb) to service_role;
