-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
-- Supabase migration 0026: read-heavy chat/group queries and notification persistence.
-- The server keeps the Drizzle branches for non-Supabase deployments.

create or replace function public.papa_list_chats(p_user_id uuid, p_filter text default 'all', p_query text default null)
returns table (
  id uuid, kind conversation_kind, title text, avatar_url text, last_at timestamptz, pinned_at timestamptz,
  archived boolean, muted boolean, o_id uuid, o_username text, o_name text, o_avatar text, o_verified boolean,
  o_seen timestamptz, o_show_seen boolean, o_read timestamptz, o_delivered timestamptz, o_receipts boolean,
  my_receipts boolean, m_body text, m_kind message_kind, m_sender uuid, m_sender_name text, m_deleted boolean,
  m_at timestamptz, unread integer
)
language sql security definer set search_path = public as $$
  select c.id, c.kind, c.title, c.avatar_url, c.last_message_at, me.pinned_at, me.archived,
    (me.muted_until is not null and me.muted_until > now()),
    o.id, o.username, o.full_name, o.avatar_url, o.verified_at is not null,
    o.last_seen_at, coalesce(op.show_last_seen, true), om.last_read_at, om.last_delivered_at,
    coalesce(op.read_receipts, true), coalesce(mp.read_receipts, true),
    lm.body, lm.kind, lm.sender_id, ls.full_name, lm.deleted_at is not null, lm.created_at,
    (select count(*)::int from messages x where x.conversation_id = c.id and x.sender_id is distinct from p_user_id
      and x.deleted_at is null and x.kind <> 'system'
      and x.created_at > coalesce(me.last_read_at, me.joined_at - interval '1 second')
      and x.created_at > coalesce(me.cleared_at, 'epoch'))
  from conversation_members me
  join conversations c on c.id = me.conversation_id
  left join conversation_members om on c.kind = 'direct' and om.conversation_id = c.id and om.user_id <> p_user_id
  left join users o on o.id = om.user_id
  left join user_preferences op on op.user_id = o.id
  left join user_preferences mp on mp.user_id = p_user_id
  left join lateral (select * from messages m where m.conversation_id = c.id and m.created_at > coalesce(me.cleared_at, 'epoch')
    and not exists (select 1 from message_hidden h where h.message_id = m.id and h.user_id = p_user_id)
    order by m.created_at desc limit 1) lm on true
  left join users ls on ls.id = lm.sender_id
  where me.user_id = p_user_id and me.left_at is null and c.deleted_at is null
    and (c.kind = 'group' or om.user_id is not null)
    and (c.last_message_at is not null or c.kind = 'group' or c.created_by = p_user_id)
    and (p_filter = 'archived' and me.archived or p_filter <> 'archived' and not me.archived)
    and (p_query is null or coalesce(c.title, o.full_name) ilike '%' || replace(replace(p_query, '%', ''), '_', '') || '%'
      or o.username ilike '%' || replace(replace(p_query, '%', ''), '_', '') || '%')
  order by me.pinned_at desc nulls last, coalesce(c.last_message_at, c.created_at) desc
  limit 200
$$;

create or replace function public.papa_unread_chats(p_user_id uuid)
returns integer language sql security definer set search_path = public as $$
  select count(*)::int from conversation_members me
  where me.user_id = p_user_id and me.left_at is null and not me.archived
    and (me.muted_until is null or me.muted_until < now())
    and exists (select 1 from messages x where x.conversation_id = me.conversation_id
      and x.sender_id is distinct from p_user_id and x.deleted_at is null and x.kind <> 'system'
      and x.created_at > coalesce(me.last_read_at, me.joined_at - interval '1 second')
      and x.created_at > coalesce(me.cleared_at, 'epoch'))
$$;

create or replace function public.papa_list_message_rows(p_conversation_id uuid, p_user_id uuid, p_before uuid default null, p_after uuid default null)
returns table (id uuid, conversation_id uuid, sender_id uuid, kind message_kind, body text, reply_to_id uuid, forwarded boolean,
  client_id text, created_at timestamptz, edited_at timestamptz, deleted_at timestamptz)
language sql security definer set search_path = public as $$
  select m.id, m.conversation_id, m.sender_id, m.kind, m.body, m.reply_to_id, m.forwarded, m.client_id, m.created_at, m.edited_at, m.deleted_at
  from messages m join conversation_members me on me.conversation_id = m.conversation_id and me.user_id = p_user_id and me.left_at is null
  where m.conversation_id = p_conversation_id and m.created_at > coalesce(me.cleared_at, 'epoch')
    and m.created_at >= me.joined_at - interval '1 second'
    and not exists (select 1 from message_hidden h where h.message_id = m.id and h.user_id = p_user_id)
    and (p_after is null or (m.created_at, m.id) > (select x.created_at, x.id from messages x where x.id = p_after and x.conversation_id = p_conversation_id))
    and (p_before is null or (m.created_at, m.id) < (select x.created_at, x.id from messages x where x.id = p_before and x.conversation_id = p_conversation_id))
  order by case when p_after is null then m.created_at end desc, case when p_after is null then m.id end desc,
    case when p_after is not null then m.created_at end asc, case when p_after is not null then m.id end asc
  limit 201
$$;

create or replace function public.papa_group_members(p_conversation_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'username', u.username, 'fullName', u.full_name,
    'avatarUrl', u.avatar_url, 'verified', u.verified_at is not null, 'role', cm.role, 'assemblyName', a.name)
    order by (cm.role = 'admin') desc, u.full_name), '[]'::jsonb)
  from conversation_members cm join users u on u.id = cm.user_id join assemblies a on a.id = u.assembly_id
  where cm.conversation_id = p_conversation_id and cm.left_at is null
$$;

create or replace function public.papa_group_requests(p_conversation_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'username', u.username, 'fullName', u.full_name,
    'avatarUrl', u.avatar_url, 'assemblyName', a.name) order by r.created_at), '[]'::jsonb)
  from group_join_requests r join users u on u.id = r.user_id join assemblies a on a.id = u.assembly_id
  where r.conversation_id = p_conversation_id
$$;

create or replace function public.papa_discover_groups(p_viewer_id uuid, p_query text, p_page integer default 1)
returns table (id uuid, title text, description text, avatar_url text, members integer, approve_joins boolean, member boolean, requested boolean)
language sql security definer set search_path = public as $$
  select c.id, c.title, c.description, c.avatar_url, (select count(*)::int from conversation_members m where m.conversation_id = c.id and m.left_at is null), c.approve_joins,
    case when p_viewer_id is null then false else exists (select 1 from conversation_members m where m.conversation_id = c.id and m.user_id = p_viewer_id and m.left_at is null) end,
    case when p_viewer_id is null then false else exists (select 1 from group_join_requests r where r.conversation_id = c.id and r.user_id = p_viewer_id) end
  from conversations c where c.kind = 'group' and c.visibility = 'public' and c.deleted_at is null
    and (p_query is null or c.title ilike '%' || replace(replace(p_query, '%', ''), '_', '') || '%' or c.description ilike '%' || replace(replace(p_query, '%', ''), '_', '') || '%')
  order by coalesce(c.last_message_at, c.created_at) desc limit 21 offset greatest(p_page - 1, 0) * 20
$$;

create or replace function public.papa_my_groups(p_user_id uuid)
returns table (id uuid, title text, avatar_url text, description text, members integer, role conversation_role)
language sql security definer set search_path = public as $$
  select c.id, c.title, c.avatar_url, c.description,
    (select count(*)::int from conversation_members m where m.conversation_id = c.id and m.left_at is null), cm.role
  from conversation_members cm join conversations c on c.id = cm.conversation_id
  where cm.user_id = p_user_id and cm.left_at is null and c.kind = 'group' and c.deleted_at is null
  order by c.last_message_at desc nulls last
$$;

create or replace function public.papa_notification_prefs(p_user_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(prefs, '{}'::jsonb) from notification_settings where user_id = p_user_id
$$;

create or replace function public.papa_persist_notification(p_user_id uuid, p_type notification_type, p_actor_id uuid, p_post_id uuid,
  p_announcement_id uuid, p_event_id uuid, p_prayer_id uuid, p_testimony_id uuid, p_publication_id uuid, p_live_id uuid,
  p_payment_id uuid, p_resource_order_id uuid, p_market_order_id uuid, p_product_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare existing_id uuid;
begin
  select n.id into existing_id from notifications n where n.user_id = p_user_id and n.type = p_type
    and n.actor_id is not distinct from p_actor_id and n.post_id is not distinct from p_post_id
    and n.announcement_id is not distinct from p_announcement_id and n.event_id is not distinct from p_event_id
    and n.prayer_id is not distinct from p_prayer_id and n.testimony_id is not distinct from p_testimony_id
    and n.publication_id is not distinct from p_publication_id and n.live_id is not distinct from p_live_id
    and n.payment_id is not distinct from p_payment_id and n.resource_order_id is not distinct from p_resource_order_id
    and n.market_order_id is not distinct from p_market_order_id and n.product_id is not distinct from p_product_id limit 1;
  if existing_id is not null then update notifications set read_at = null, created_at = now() where id = existing_id;
  else insert into notifications (user_id, type, actor_id, post_id, announcement_id, event_id, prayer_id, testimony_id, publication_id, live_id, payment_id, resource_order_id, market_order_id, product_id)
    values (p_user_id, p_type, p_actor_id, p_post_id, p_announcement_id, p_event_id, p_prayer_id, p_testimony_id, p_publication_id, p_live_id, p_payment_id, p_resource_order_id, p_market_order_id, p_product_id);
  end if;
  return true;
end;
$$;

create or replace function public.papa_unread_notification_count(p_user_id uuid)
returns integer language sql security definer set search_path = public as $$
  select count(*)::int from notifications where user_id = p_user_id and read_at is null
$$;

create or replace function public.papa_mark_notifications_read(p_user_id uuid)
returns void language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = p_user_id and read_at is null
$$;

revoke all on function public.papa_list_chats(uuid, text, text) from public, anon, authenticated;
revoke all on function public.papa_unread_chats(uuid) from public, anon, authenticated;
revoke all on function public.papa_list_message_rows(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.papa_group_members(uuid) from public, anon, authenticated;
revoke all on function public.papa_group_requests(uuid) from public, anon, authenticated;
revoke all on function public.papa_discover_groups(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.papa_my_groups(uuid) from public, anon, authenticated;
revoke all on function public.papa_notification_prefs(uuid) from public, anon, authenticated;
revoke all on function public.papa_persist_notification(uuid, notification_type, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.papa_unread_notification_count(uuid) from public, anon, authenticated;
revoke all on function public.papa_mark_notifications_read(uuid) from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
