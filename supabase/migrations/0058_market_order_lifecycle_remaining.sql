-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
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
    and (o.paid_at is not null or o.buyer_id = p_viewer_id or p_viewer_role = 'tech_admin');
$$;

create or replace function public.papa_market_adjust_product_rating(p_product_id uuid, p_rating_delta integer, p_count_delta integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_rating_delta is null or p_count_delta is null or abs(p_rating_delta) > 5 or abs(p_count_delta) > 1 then return false; end if;
  update public.products set rating_sum = greatest(0, rating_sum + p_rating_delta), rating_count = greatest(0, rating_count + p_count_delta)
  where id = p_product_id;
  return found;
end;
$$;

create or replace function public.papa_market_reply_review(p_review_id uuid, p_user_id uuid, p_reply text)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.product_reviews r set seller_reply = left(p_reply, 1000), seller_reply_at = now()
  from public.products p join public.shops s on s.id = p.shop_id
  where r.id = p_review_id and p.id = r.product_id and s.owner_id = p_user_id;
  return found;
end;
$$;

create or replace function public.papa_market_hide_review(p_review_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_product_id uuid;
  v_rating integer;
begin
  update public.product_reviews set hidden_at = now()
  where id = p_review_id and hidden_at is null
  returning product_id, rating into v_product_id, v_rating;
  if not found then return false; end if;
  update public.products set rating_sum = greatest(rating_sum - v_rating, 0), rating_count = greatest(rating_count - 1, 0)
  where id = v_product_id;
  return true;
end;
$$;

revoke all on function public.papa_market_order_detail(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.papa_market_adjust_product_rating(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.papa_market_reply_review(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.papa_market_hide_review(uuid) from public, anon, authenticated;
grant execute on function public.papa_market_order_detail(uuid, uuid, text) to service_role;
grant execute on function public.papa_market_adjust_product_rating(uuid, integer, integer) to service_role;
grant execute on function public.papa_market_reply_review(uuid, uuid, text) to service_role;
grant execute on function public.papa_market_hide_review(uuid) to service_role;
