-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
create or replace function public.papa_market_product_detail(p_product_id uuid, p_viewer_id uuid default null)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'product', jsonb_build_object(
      'id', p.id, 'title', p.title, 'description', p.description, 'category', p.category::text,
      'condition', p.condition::text, 'images', p.images, 'option_names', p.option_names,
      'price', p.price_pesewas, 'compare_at', p.compare_at_pesewas, 'deal_ends_at', p.deal_ends_at,
      'rating_sum', p.rating_sum, 'rating_count', p.rating_count, 'sold', p.sold_count,
      'status', p.status::text, 'created_at', p.created_at, 'deleted', p.deleted_at is not null,
      'shop_id', s.id, 'shop_name', s.name, 'shop_slug', s.slug, 'shop_logo', s.logo_url,
      'shop_town', s.town, 'shop_status', s.status::text, 'owner_id', s.owner_id,
      'owner_status', u.status::text, 'owner_username', u.username, 'owner_name', u.full_name,
      'offers_pickup', s.offers_pickup, 'offers_delivery', s.offers_delivery,
      'delivery_fee', s.delivery_fee_pesewas, 'free_over', s.free_delivery_over_pesewas,
      'delivery_note', s.delivery_note, 'pickup_address', s.pickup_address, 'return_days', s.return_days,
      'shop_verified', s.verified_at is not null,
      'assembly_name', (select a.name from public.assemblies a where a.id = s.assembly_id)
    ),
    'variants', coalesce((select jsonb_agg(jsonb_build_object(
      'id', v.id, 'name', v.name, 'options', v.options, 'pricePesewas', v.price_pesewas, 'stock', v.stock
    ) order by v.position, v.price_pesewas) from public.product_variants v where v.product_id = p.id and v.active), '[]'::jsonb),
    'stars', coalesce((select jsonb_agg(jsonb_build_object('rating', r.rating, 'n', r.n)) from (
      select rating, count(*)::integer as n from public.product_reviews where product_id = p.id and hidden_at is null group by rating
    ) r), '[]'::jsonb),
    'viewer', case when p_viewer_id is null then null else jsonb_build_object(
      'wished', exists(select 1 from public.wishlist_items w where w.user_id = p_viewer_id and w.product_id = p.id),
      'stock_alert', exists(select 1 from public.product_alerts a where a.user_id = p_viewer_id and a.product_id = p.id and a.kind = 'stock' and a.notified_at is null),
      'price_alert', exists(select 1 from public.product_alerts a where a.user_id = p_viewer_id and a.product_id = p.id and a.kind = 'price' and a.notified_at is null),
      'following', exists(select 1 from public.shop_follows f where f.user_id = p_viewer_id and f.shop_id = s.id),
      'in_cart', (select coalesce(sum(c.qty), 0)::integer from public.cart_items c join public.product_variants v on v.id = c.variant_id where c.user_id = p_viewer_id and v.product_id = p.id and not c.saved_for_later)
    ) end
  )
  from public.products p
  join public.shops s on s.id = p.shop_id
  join public.users u on u.id = s.owner_id
  where p.id = p_product_id and s.deleted_at is null;
$$;

create or replace function public.papa_market_product_questions(p_product_id uuid, p_viewer_id uuid default null, p_limit integer default 30)
returns table(id uuid, body text, answer text, answered_at timestamptz, created_at timestamptz, asker text, asker_username text, mine boolean)
language sql stable security definer set search_path = '' as $$
  select q.id, q.body, q.answer, q.answered_at, q.created_at, u.full_name, u.username, q.asker_id = p_viewer_id
  from public.product_questions q join public.users u on u.id = q.asker_id
  where q.product_id = p_product_id and q.hidden_at is null and u.status = 'active'
  order by (q.answer is not null) desc, q.created_at desc limit least(100, greatest(1, coalesce(p_limit, 30)));
$$;

create or replace function public.papa_market_product_reviews(p_product_id uuid, p_viewer_id uuid default null, p_limit integer default 20)
returns table(id uuid, rating integer, body text, created_at timestamptz, seller_reply text, name text, username text, avatar_url text, mine boolean)
language sql stable security definer set search_path = '' as $$
  select r.id, r.rating, r.body, r.created_at, r.seller_reply, u.full_name, u.username, u.avatar_url, r.user_id = p_viewer_id
  from public.product_reviews r join public.users u on u.id = r.user_id
  where r.product_id = p_product_id and r.hidden_at is null and u.status = 'active'
  order by (r.user_id = p_viewer_id) desc, length(r.body) > 0 desc, r.created_at desc limit least(100, greatest(1, coalesce(p_limit, 20)));
$$;

create or replace function public.papa_market_order_detail(p_order_id uuid, p_viewer_id uuid, p_viewer_role text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order', to_jsonb(o),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', i.id, 'product_id', i.product_id, 'title', i.title, 'variant_name', i.variant_name,
      'image', i.image, 'unit_pesewas', i.unit_pesewas, 'qty', i.qty, 'total_pesewas', i.total_pesewas,
      'my_rating', (select r.rating from public.product_reviews r where r.product_id = i.product_id and r.user_id = o.buyer_id)
    ) order by i.total_pesewas desc) from public.market_order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'note', e.note, 'created_at', e.created_at,
      'actor', (select u.full_name from public.users u where u.id = e.actor_id)) order by e.created_at, e.id)
      from public.market_order_events e where e.order_id = o.id), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.market_requests r where r.order_id = o.id), '[]'::jsonb),
    'shop', (select jsonb_build_object('slug', s.slug, 'logo_url', s.logo_url, 'phone', s.phone, 'return_days', s.return_days) from public.shops s where s.id = o.shop_id),
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'full_name', u.full_name, 'username', u.username, 'avatar_url', u.avatar_url))
      from public.users u where u.id in (o.buyer_id, o.seller_id)), '[]'::jsonb),
    'payment', (select jsonb_build_object('reference', p.reference, 'status', p.status::text, 'channel', p.channel::text)
      from public.payments p where p.market_checkout_id = o.checkout_id order by p.created_at desc limit 1),
    'delivery', (select jsonb_build_object('id', d.id, 'status', d.status::text, 'fee_pesewas', d.fee_pesewas,
      'created_at', d.created_at, 'accepted_at', d.accepted_at, 'picked_up_at', d.picked_up_at, 'delivered_at', d.delivered_at,
      'rider_name', u.full_name, 'rider_username', u.username, 'rider_phone', r.phone, 'rider_vehicle', r.vehicle, 'rider_user_id', r.user_id)
      from public.deliveries d left join public.riders r on r.id = d.rider_id left join public.users u on u.id = r.user_id
      where d.order_id = o.id and d.status <> 'cancelled' order by d.created_at desc limit 1),
    'role', case when o.buyer_id = p_viewer_id then 'buyer' when o.seller_id = p_viewer_id then 'seller'
      when p_viewer_role = 'tech_admin' then 'admin' else null end
  )
  from public.market_orders o
  where o.id = p_order_id
    and (o.buyer_id = p_viewer_id or o.seller_id = p_viewer_id or p_viewer_role = 'tech_admin')
    and (o.paid_at is not null or o.buyer_id = p_viewer_id)
    and (o.paid_at is not null or o.seller_id is distinct from p_viewer_id);
$$;

revoke all on function public.papa_market_product_detail(uuid, uuid) from public, anon, authenticated;
revoke all on function public.papa_market_product_questions(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.papa_market_product_reviews(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.papa_market_order_detail(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.papa_market_product_detail(uuid, uuid) to service_role;
grant execute on function public.papa_market_product_questions(uuid, uuid, integer) to service_role;
grant execute on function public.papa_market_product_reviews(uuid, uuid, integer) to service_role;
grant execute on function public.papa_market_order_detail(uuid, uuid, text) to service_role;
