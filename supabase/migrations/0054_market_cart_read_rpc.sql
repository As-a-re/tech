-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
create or replace function public.papa_market_cart_snapshot(p_user_id uuid)
returns table (
  id uuid, variant_id uuid, product_id uuid, title text, variant_name text, image text,
  unit integer, qty integer, stock integer, available boolean, saved boolean,
  shop_id uuid, shop_name text, shop_slug text, offers_pickup boolean, offers_delivery boolean,
  delivery_fee integer, free_over integer, pickup_address text, delivery_note text
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.variant_id, p.id, p.title, v.name, p.images ->> 0, v.price_pesewas,
    c.qty, v.stock,
    (p.status = 'active' and p.deleted_at is null and s.status = 'active' and s.deleted_at is null and u.status = 'active' and v.active and v.stock > 0),
    c.saved_for_later, s.id, s.name, s.slug, s.offers_pickup, s.offers_delivery,
    s.delivery_fee_pesewas, s.free_delivery_over_pesewas, s.pickup_address, s.delivery_note
  from public.cart_items as c
  join public.product_variants as v on v.id = c.variant_id
  join public.products as p on p.id = v.product_id
  join public.shops as s on s.id = p.shop_id
  join public.users as u on u.id = s.owner_id
  where c.user_id = p_user_id
  order by c.created_at desc;
$$;

create or replace function public.papa_market_variant_info(p_variant_id uuid)
returns table (stock integer, owner_id uuid, product_id uuid)
language sql stable security definer set search_path = '' as $$
  select v.stock, s.owner_id, p.id
  from public.product_variants as v
  join public.products as p on p.id = v.product_id
  join public.shops as s on s.id = p.shop_id
  join public.users as u on u.id = s.owner_id
  where v.id = p_variant_id and v.active and p.status = 'active' and p.deleted_at is null
    and s.status = 'active' and s.deleted_at is null and u.status = 'active';
$$;

revoke all on function public.papa_market_cart_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.papa_market_variant_info(uuid) from public, anon, authenticated;
grant execute on function public.papa_market_cart_snapshot(uuid) to service_role;
grant execute on function public.papa_market_variant_info(uuid) to service_role;
