-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
create or replace function public.papa_market_order_list(p_user_id uuid, p_seller boolean default false, p_filter text default null)
returns table (
  id uuid, number text, shop_name text, shop_slug text, status text, fulfilment text, total_pesewas integer,
  created_at timestamptz, item_count integer, first_title text, images text[], buyer_name text, open_request text
)
language sql stable security definer set search_path = '' as $$
  select o.id, o.number, o.shop_name, s.slug, o.status::text, o.fulfilment::text, o.total_pesewas, o.created_at,
    coalesce((select sum(i.qty)::integer from public.market_order_items i where i.order_id = o.id), 0),
    (select i.title from public.market_order_items i where i.order_id = o.id order by i.total_pesewas desc limit 1),
    coalesce((select array_agg(x.image) from (select i.image from public.market_order_items i where i.order_id = o.id and i.image is not null limit 3) x), array[]::text[]),
    (select u.full_name from public.users u where u.id = o.buyer_id),
    (select r.kind::text from public.market_requests r where r.order_id = o.id and r.status = 'open' limit 1)
  from public.market_orders o
  left join public.shops s on s.id = o.shop_id
  where (case when coalesce(p_seller, false) then o.seller_id else o.buyer_id end) = p_user_id
    and (
      (coalesce(p_seller, false) and o.paid_at is not null)
      or (not coalesce(p_seller, false) and (o.paid_at is not null or o.created_at > now() - interval '2 hours'))
    )
    and (
      p_filter is null or p_filter = 'all'
      or (not coalesce(p_seller, false) and p_filter = 'active' and o.status in ('paid', 'accepted', 'packed', 'shipped'))
      or (not coalesce(p_seller, false) and p_filter = 'delivered' and o.status in ('delivered', 'completed'))
      or (not coalesce(p_seller, false) and p_filter = 'cancelled' and o.status = 'cancelled')
      or (coalesce(p_seller, false) and o.status::text = p_filter)
    )
  order by o.created_at desc, o.id desc
  limit 200;
$$;
revoke all on function public.papa_market_order_list(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.papa_market_order_list(uuid, boolean, text) to service_role;
