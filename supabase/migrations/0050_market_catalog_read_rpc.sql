-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
create or replace function public.papa_market_list_products(
  p_query text default null,
  p_category text default null,
  p_min_pesewas integer default null,
  p_max_pesewas integer default null,
  p_condition text default null,
  p_in_stock boolean default false,
  p_deals boolean default false,
  p_delivery boolean default false,
  p_district_id uuid default null,
  p_rating_min numeric default null,
  p_shop_id uuid default null,
  p_sort text default 'best',
  p_page integer default 1,
  p_limit integer default 24,
  p_exclude_id uuid default null,
  p_ids uuid[] default null,
  p_since timestamptz default null
) returns jsonb
language sql stable security definer set search_path = '' as $$
  with words as (
    select word from unnest(regexp_split_to_array(lower(coalesce(p_query, '')), '\s+')) as word
    where length(word) > 0
    limit 6
  ), filtered as (
    select p.id, p.title, p.images ->> 0 as image, p.price_pesewas as price,
      case when p.compare_at_pesewas > p.price_pesewas and (p.deal_ends_at is null or p.deal_ends_at > now()) then p.compare_at_pesewas end as was,
      p.rating_sum, p.rating_count, p.sold_count as sold, p.condition::text as condition, p.category,
      s.name as shop_name, s.slug as shop_slug, s.town,
      exists(select 1 from public.product_variants v where v.product_id = p.id and v.active and v.stock > 0) as in_stock,
      (p.sold_count * 3 + p.rating_count * 2 + p.view_count / 20.0) as popularity,
      case when p.title ilike '%' || coalesce(p_query, '') || '%' then 0 else 1 end as match_rank,
      p.created_at
    from public.products p
    join public.shops s on s.id = p.shop_id
    join public.users u on u.id = s.owner_id
    where p.status = 'active' and p.deleted_at is null and s.status = 'active' and s.deleted_at is null and u.status = 'active'
      and (p_category is null or p.category = p_category)
      and (p_min_pesewas is null or p.price_pesewas >= p_min_pesewas)
      and (p_max_pesewas is null or p.price_pesewas <= p_max_pesewas)
      and (p_condition is null or p.condition::text = p_condition)
      and (not coalesce(p_in_stock, false) or exists(select 1 from public.product_variants v where v.product_id = p.id and v.active and v.stock > 0))
      and (not coalesce(p_deals, false) or (p.compare_at_pesewas > p.price_pesewas and (p.deal_ends_at is null or p.deal_ends_at > now())))
      and (not coalesce(p_delivery, false) or s.offers_delivery)
      and (p_district_id is null or s.assembly_id in (select a.id from public.assemblies a where a.district_id = p_district_id))
      and (p_rating_min is null or (p.rating_count > 0 and p.rating_sum::numeric / p.rating_count >= p_rating_min))
      and (p_shop_id is null or p.shop_id = p_shop_id)
      and (p_exclude_id is null or p.id <> p_exclude_id)
      and (p_ids is null or p.id = any(p_ids))
      and (p_since is null or p.created_at > p_since)
      and not exists(select 1 from words w where not (p.title ilike '%' || w.word || '%' or p.description ilike '%' || w.word || '%' or s.name ilike '%' || w.word || '%' or p.category = w.word))
  ), paged as (
    select * from filtered
    order by
      case when p_sort = 'price_asc' then price end asc,
      case when p_sort = 'price_desc' then price end desc,
      case when p_sort = 'rating' then case when rating_count > 0 then rating_sum::numeric / rating_count else 0 end end desc,
      case when p_sort = 'popular' then popularity end desc,
      case when p_sort not in ('newest','price_asc','price_desc','rating','popular') then match_rank end asc,
      case when p_sort in ('best','popular') then popularity end desc,
      case when p_sort = 'newest' then created_at end desc,
      created_at desc, id
    offset (greatest(1, least(200, coalesce(p_page, 1))) - 1) * least(60, greatest(1, coalesce(p_limit, 24)))
    limit least(61, greatest(2, coalesce(p_limit, 24) + 1))
  )
  select coalesce(jsonb_agg(to_jsonb(paged)), '[]'::jsonb) from paged;
$$;

create or replace function public.papa_market_category_counts()
returns table(category text, n bigint)
language sql stable security definer set search_path = '' as $$
  select p.category::text, count(*) from public.products p
  join public.shops s on s.id = p.shop_id join public.users u on u.id = s.owner_id
  where p.status = 'active' and p.deleted_at is null and s.status = 'active' and s.deleted_at is null and u.status = 'active'
  group by p.category;
$$;

revoke all on function public.papa_market_list_products(text,text,integer,integer,text,boolean,boolean,boolean,uuid,numeric,uuid,text,integer,integer,uuid,uuid[],timestamptz) from public, anon, authenticated;
revoke all on function public.papa_market_category_counts() from public, anon, authenticated;
grant execute on function public.papa_market_list_products(text,text,integer,integer,text,boolean,boolean,boolean,uuid,numeric,uuid,text,integer,integer,uuid,uuid[],timestamptz) to service_role;
grant execute on function public.papa_market_category_counts() to service_role;
