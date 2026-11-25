-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
create or replace function public.papa_market_catalog_member_cards(
  p_user_id uuid,
  p_kind text,
  p_shop_id uuid default null,
  p_limit integer default 24
)
returns table (
  id uuid, title text, image text, price integer, was integer, rating_sum integer, rating_count integer, sold integer,
  in_stock boolean, condition text, category text, shop_name text, shop_slug text, town text
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.title, p.images ->> 0, p.price_pesewas,
    case when p.compare_at_pesewas > p.price_pesewas and (p.deal_ends_at is null or p.deal_ends_at > now()) then p.compare_at_pesewas end,
    p.rating_sum, p.rating_count, p.sold_count,
    exists (select 1 from public.product_variants v where v.product_id = p.id and v.active and v.stock > 0),
    p.condition::text, p.category::text, s.name, s.slug, s.town
  from public.products p
  join public.shops s on s.id = p.shop_id
  join public.users u on u.id = s.owner_id
  left join public.recently_viewed rv on p_kind = 'recent' and rv.product_id = p.id and rv.user_id = p_user_id
  left join public.wishlist_items w on p_kind = 'wishlist' and w.product_id = p.id and w.user_id = p_user_id
  left join public.shop_follows f on p_kind = 'followed' and f.shop_id = p.shop_id and f.user_id = p_user_id
  where p.status = 'active' and p.deleted_at is null and s.status = 'active' and s.deleted_at is null and u.status = 'active'
    and (
      (p_kind = 'recent' and rv.product_id is not null)
      or (p_kind = 'wishlist' and w.product_id is not null)
      or (p_kind = 'followed' and f.shop_id is not null and p.created_at > now() - interval '60 days')
      or (p_kind = 'shop' and p.shop_id = p_shop_id)
    )
  order by
    case when p_kind = 'recent' then rv.viewed_at end desc,
    case when p_kind = 'wishlist' then w.created_at end desc,
    case when p_kind = 'followed' then p.created_at end desc,
    case when p_kind = 'shop' then p.created_at end desc,
    p.id
  limit least(500, greatest(1, coalesce(p_limit, 24)));
$$;
revoke all on function public.papa_market_catalog_member_cards(uuid, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.papa_market_catalog_member_cards(uuid, text, uuid, integer) to service_role;
