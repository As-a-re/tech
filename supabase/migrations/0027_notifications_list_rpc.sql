-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
-- Supabase migration 0027: notification list, notify-context and push-subscription helpers.
-- Service-role only (security definer, execute revoked from public/anon/authenticated).

create or replace function public.papa_list_notifications(p_user_id uuid, p_filter text default 'all', p_limit integer default 60)
returns table (
  grp text, type text, post_id text, at timestamptz, unread boolean, total integer,
  announcement_id text, event_id text, prayer_id text, testimony_id text, publication_id text, live_id text,
  payment_ref text, order_id text, market_order_id text, product_id text,
  market_order_title text, market_order_status text, product_title text, order_title text, payment_title text,
  live_title text, publication_title text, prayer_body text, testimony_title text, post_body text,
  announcement_title text, event_title text, event_starts timestamptz, actors jsonb
)
language sql stable security definer set search_path = public as $$
  with n as (
    select n.*, case when n.type in ('like', 'repost', 'follow', 'prayed', 'testimony_praise')
        then n.type || ':' || coalesce(n.post_id::text, n.prayer_id::text, n.testimony_id::text, date_trunc('day', n.created_at)::text)
        else n.id::text end as grp
    from notifications n left join users u on u.id = n.actor_id
    where n.user_id = p_user_id and (n.actor_id is null or u.status = 'active')
      and (p_filter <> 'mentions' or n.type in ('reply', 'quote', 'mention'))
  )
  select n.grp, min(n.type::text), min(n.post_id::text), max(n.created_at), bool_or(n.read_at is null), count(*)::int,
    min(n.announcement_id::text), min(n.event_id::text), min(n.prayer_id::text), min(n.testimony_id::text), min(n.publication_id::text), min(n.live_id::text),
    (select p.reference from payments p where p.id = min(n.payment_id::text)::uuid),
    min(n.resource_order_id::text),
    min(n.market_order_id::text), min(n.product_id::text),
    (select o.number || ' · ' || o.shop_name from market_orders o where o.id = min(n.market_order_id::text)::uuid),
    (select o.status::text from market_orders o where o.id = min(n.market_order_id::text)::uuid),
    (select p.title from products p where p.id = min(n.product_id::text)::uuid and p.deleted_at is null),
    (select r.title || coalesce(' · ' || o.size, '') || ' × ' || o.qty from resource_orders o join resources r on r.id = o.resource_id where o.id = min(n.resource_order_id::text)::uuid),
    (select 'GHS ' || trim(to_char(p.amount_pesewas / 100.0, 'FM999,999,990.00')) || ' · ' || initcap(p.purpose::text) from payments p where p.id = min(n.payment_id::text)::uuid),
    (select l.title from lives l where l.id = min(n.live_id::text)::uuid and l.deleted_at is null),
    (select p.title || coalesce(' · ' || p.edition, '') from publications p where p.id = min(n.publication_id::text)::uuid and p.deleted_at is null and p.status = 'published'),
    (select left(p.body, 140) from prayer_requests p where p.id = min(n.prayer_id::text)::uuid and p.deleted_at is null),
    (select t.title from testimonies t where t.id = min(n.testimony_id::text)::uuid and t.deleted_at is null),
    (select left(p.body, 140) from posts p where p.id = min(n.post_id::text)::uuid and p.deleted_at is null),
    (select a.title from announcements a where a.id = min(n.announcement_id::text)::uuid and a.deleted_at is null),
    (select e.title from events e where e.id = min(n.event_id::text)::uuid and e.deleted_at is null),
    (select e.starts_at from events e where e.id = min(n.event_id::text)::uuid),
    (select jsonb_agg(jsonb_build_object('username', x.username, 'fullName', x.full_name, 'avatarUrl', x.avatar_url, 'verified', x.verified))
       from (select u.username, u.full_name, u.avatar_url, (u.verified_at is not null) as verified
             from notifications m join users u on u.id = m.actor_id
             where m.user_id = p_user_id and m.id in (select id from n n2 where n2.grp = n.grp)
             order by m.created_at desc limit 5) x)
  from n group by n.grp order by max(n.created_at) desc limit p_limit
$$;

-- One round-trip for everything notify() needs before deciding to deliver.
create or replace function public.papa_notify_context(p_user_id uuid, p_actor_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'blocked', p_actor_id is not null and exists (select 1 from blocks b
      where (b.blocker_id = p_user_id and b.blocked_id = p_actor_id) or (b.blocker_id = p_actor_id and b.blocked_id = p_user_id)),
    'muted', p_actor_id is not null and exists (select 1 from mutes m where m.muter_id = p_user_id and m.muted_id = p_actor_id),
    'prefs', coalesce((select s.prefs from notification_settings s where s.user_id = p_user_id), '{}'::jsonb),
    'actorName', (select u.full_name from users u where u.id = p_actor_id),
    'subs', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from push_subscriptions s where s.user_id = p_user_id), '[]'::jsonb)
  )
$$;

create or replace function public.papa_set_notification_pref(p_user_id uuid, p_prefs jsonb)
returns void language sql security definer set search_path = public as $$
  insert into notification_settings (user_id, prefs) values (p_user_id, p_prefs)
  on conflict (user_id) do update set prefs = excluded.prefs, updated_at = now()
$$;

create or replace function public.papa_unnotify(p_user_id uuid, p_type notification_type, p_actor_id uuid, p_post_id uuid,
  p_prayer_id uuid, p_testimony_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from notifications n where n.user_id = p_user_id and n.type = p_type and n.actor_id = p_actor_id
    and n.post_id is not distinct from p_post_id
    and (p_prayer_id is null or n.prayer_id = p_prayer_id)
    and (p_testimony_id is null or n.testimony_id = p_testimony_id)
$$;

revoke all on function public.papa_list_notifications(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.papa_notify_context(uuid, uuid) from public, anon, authenticated;
revoke all on function public.papa_set_notification_pref(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.papa_unnotify(uuid, notification_type, uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.papa_list_notifications(uuid, text, integer) to service_role;
grant execute on function public.papa_notify_context(uuid, uuid) to service_role;
grant execute on function public.papa_set_notification_pref(uuid, jsonb) to service_role;
grant execute on function public.papa_unnotify(uuid, notification_type, uuid, uuid, uuid, uuid) to service_role;
