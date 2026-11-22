-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
create or replace function public.papa_direct_chat(p_me uuid, p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare conversation_id uuid;
declare direct_key_value text := array_to_string(array(select x::text from unnest(array[p_me, p_other]::uuid[]) x order by x), ':');
begin
	select id into conversation_id from conversations where conversations.direct_key = direct_key_value;
	if conversation_id is not null then
		update conversation_members set left_at = null where conversation_members.conversation_id = papa_direct_chat.conversation_id and user_id = p_me;
		return conversation_id;
	end if;
	insert into conversations (kind, direct_key, created_by) values ('direct', direct_key_value, p_me)
		on conflict (direct_key) do update set direct_key = excluded.direct_key returning id into conversation_id;
	insert into conversation_members (conversation_id, user_id) values (conversation_id, p_me), (conversation_id, p_other)
		on conflict (conversation_id, user_id) do nothing;
	return conversation_id;
end;
$$;

create or replace function public.papa_send_message(
	p_conversation_id uuid, p_sender_id uuid, p_kind text, p_body text,
	p_reply_to_id uuid default null, p_forwarded boolean default false,
	p_client_id text default null, p_attachments jsonb default '[]'::jsonb
)
returns table (id uuid, conversation_id uuid, sender_id uuid, kind message_kind, body text,
	reply_to_id uuid, forwarded boolean, client_id text, created_at timestamptz,
	edited_at timestamptz, deleted_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare message_id uuid;
begin
	if p_client_id is not null then
		select m.id into message_id from messages m where m.sender_id = p_sender_id and m.client_id = left(p_client_id, 64);
		if message_id is not null then
			return query select m.id, m.conversation_id, m.sender_id, m.kind, m.body, m.reply_to_id, m.forwarded, m.client_id, m.created_at, m.edited_at, m.deleted_at from messages m where m.id = message_id;
			return;
		end if;
	end if;
	insert into messages (conversation_id, sender_id, kind, body, reply_to_id, forwarded, client_id)
		values (p_conversation_id, p_sender_id, p_kind::message_kind, p_body, p_reply_to_id, p_forwarded, left(p_client_id, 64)) returning messages.id into message_id;
	insert into message_attachments (message_id, kind, url, name, size, mime, width, height, duration)
		select message_id, x.kind::message_kind, x.url, nullif(x.name, ''), x.size, nullif(x.mime, ''), x.width, x.height, x.duration
		from jsonb_to_recordset(coalesce(p_attachments, '[]'::jsonb)) as x(kind text, url text, name text, size integer, mime text, width integer, height integer, duration integer);
	update conversations set last_message_at = now() where conversations.id = p_conversation_id;
	update conversation_members set last_read_at = now(), last_delivered_at = now() where conversation_id = p_conversation_id and user_id = p_sender_id;
	update conversation_members set archived = false where conversation_id = p_conversation_id and left_at is null;
	return query select m.id, m.conversation_id, m.sender_id, m.kind, m.body, m.reply_to_id, m.forwarded, m.client_id, m.created_at, m.edited_at, m.deleted_at from messages m where m.id = message_id;
end;
$$;

create or replace function public.papa_create_group(
	p_creator_id uuid, p_title text, p_description text, p_avatar_url text,
	p_visibility text, p_invite_code text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare conversation_id uuid;
begin
	insert into conversations (kind, title, description, avatar_url, visibility, created_by, invite_code)
		values ('group', p_title, p_description, p_avatar_url, p_visibility::group_visibility, p_creator_id, p_invite_code) returning id into conversation_id;
	insert into conversation_members (conversation_id, user_id, role) values (conversation_id, p_creator_id, 'admin');
	return conversation_id;
end;
$$;

create or replace function public.papa_group_upsert_member(p_conversation_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
	insert into conversation_members (conversation_id, user_id, cleared_at, role, joined_at, last_read_at)
		values (p_conversation_id, p_user_id, now(), 'member', now(), null)
		on conflict (conversation_id, user_id) do update set left_at = null, joined_at = now(), role = 'member', cleared_at = now(), last_read_at = null;
	delete from group_join_requests where conversation_id = p_conversation_id and user_id = p_user_id;
	return true;
end;
$$;

revoke all on function public.papa_direct_chat(uuid, uuid) from public, anon, authenticated;
revoke all on function public.papa_send_message(uuid, uuid, text, text, uuid, boolean, text, jsonb) from public, anon, authenticated;
revoke all on function public.papa_create_group(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.papa_group_upsert_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.papa_direct_chat(uuid, uuid) to service_role;
grant execute on function public.papa_send_message(uuid, uuid, text, text, uuid, boolean, text, jsonb) to service_role;
grant execute on function public.papa_create_group(uuid, text, text, text, text, text) to service_role;
grant execute on function public.papa_group_upsert_member(uuid, uuid) to service_role;
