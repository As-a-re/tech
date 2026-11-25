create or replace function public.papa_market_save_product(
  p_user_id uuid,
  p_shop_id uuid,
  p_product_id uuid,
  p_values jsonb,
  p_variants jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id uuid := p_product_id;
  v_variant jsonb;
  v_options jsonb;
  v_variant_id uuid;
  v_kept_ids uuid[] := array[]::uuid[];
begin
  if not exists (
    select 1 from public.shops s
    where s.id = p_shop_id and s.owner_id = p_user_id and s.deleted_at is null
  ) then
    raise exception 'shop_not_found';
  end if;

  if v_product_id is null then
    insert into public.products (
      shop_id, title, description, category, condition, images, option_names, price_pesewas,
      compare_at_pesewas, deal_ends_at, status, updated_at, published_at
    ) values (
      p_shop_id, p_values->>'title', coalesce(p_values->>'description', ''), p_values->>'category',
      (p_values->>'condition')::public.product_condition, coalesce(p_values->'images', '[]'::jsonb),
      coalesce(p_values->'option_names', '[]'::jsonb), (p_values->>'price_pesewas')::integer,
      nullif(p_values->>'compare_at_pesewas', '')::integer, nullif(p_values->>'deal_ends_at', '')::timestamptz,
      (p_values->>'status')::public.product_status, now(), nullif(p_values->>'published_at', '')::timestamptz
    ) returning id into v_product_id;
  else
    update public.products p set
      title = p_values->>'title', description = coalesce(p_values->>'description', ''), category = p_values->>'category',
      condition = (p_values->>'condition')::public.product_condition, images = coalesce(p_values->'images', '[]'::jsonb),
      option_names = coalesce(p_values->'option_names', '[]'::jsonb), price_pesewas = (p_values->>'price_pesewas')::integer,
      compare_at_pesewas = nullif(p_values->>'compare_at_pesewas', '')::integer,
      deal_ends_at = nullif(p_values->>'deal_ends_at', '')::timestamptz,
      status = (p_values->>'status')::public.product_status, updated_at = now(),
      published_at = case when p_values ? 'published_at' then nullif(p_values->>'published_at', '')::timestamptz else p.published_at end
    where p.id = v_product_id and p.shop_id = p_shop_id and p.deleted_at is null;
    if not found then raise exception 'product_not_found'; end if;
  end if;

  for v_variant in select value from jsonb_array_elements(coalesce(p_variants, '[]'::jsonb)) loop
    v_options := coalesce(v_variant->'options', '{}'::jsonb);
    v_variant_id := null;
    if nullif(v_variant->>'id', '') is not null then
      select pv.id into v_variant_id from public.product_variants pv
      where pv.id = (v_variant->>'id')::uuid and pv.product_id = v_product_id;
    end if;
    if v_variant_id is null then
      select pv.id into v_variant_id from public.product_variants pv
      where pv.product_id = v_product_id and pv.options = v_options and not (pv.id = any(v_kept_ids))
      order by pv.position limit 1;
    end if;

    if v_variant_id is not null then
      update public.product_variants set
        name = coalesce(v_variant->>'name', ''), options = v_options,
        price_pesewas = (v_variant->>'price_pesewas')::integer, stock = (v_variant->>'stock')::integer,
        sku = nullif(v_variant->>'sku', ''), position = (v_variant->>'position')::integer, active = true
      where id = v_variant_id;
    else
      insert into public.product_variants (product_id, name, options, price_pesewas, stock, sku, position, active)
      values (
        v_product_id, coalesce(v_variant->>'name', ''), v_options,
        (v_variant->>'price_pesewas')::integer, (v_variant->>'stock')::integer,
        nullif(v_variant->>'sku', ''), (v_variant->>'position')::integer, true
      ) returning id into v_variant_id;
    end if;
    v_kept_ids := array_append(v_kept_ids, v_variant_id);
  end loop;

  update public.product_variants pv set active = false
  where pv.product_id = v_product_id and not (pv.id = any(v_kept_ids));

  return v_product_id;
end;
$$;

revoke all on function public.papa_market_save_product(uuid, uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.papa_market_save_product(uuid, uuid, uuid, jsonb, jsonb) to service_role;
