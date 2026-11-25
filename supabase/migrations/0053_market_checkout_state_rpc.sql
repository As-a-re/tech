-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
create or replace function public.papa_market_set_checkout_paid(p_checkout_id uuid, p_ok boolean)
returns table (id uuid, buyer_id uuid, seller_id uuid, number text, subtotal_pesewas integer, total_pesewas integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_order_ids uuid[];
begin
  select array_agg(mo.id) into v_order_ids
  from public.market_orders as mo
  where mo.checkout_id = p_checkout_id and mo.status = 'pending_payment';

  if coalesce(cardinality(v_order_ids), 0) = 0 then
    return;
  end if;

  if p_ok then
    return query
      update public.market_orders as mo
      set status = 'paid', paid_at = now(), escrow = 'held',
          handover_code = lpad((floor(random() * 900000) + 100000)::text, 6, '0')
      where mo.id = any(v_order_ids)
      returning mo.id, mo.buyer_id, mo.seller_id, mo.number, mo.subtotal_pesewas, mo.total_pesewas;

    insert into public.market_order_events (order_id, kind)
    select unnest(v_order_ids), 'paid';

    update public.products as p
    set sold_count = p.sold_count + item_totals.qty
    from (
      select i.product_id, sum(i.qty)::integer as qty
      from public.market_order_items as i
      where i.order_id = any(v_order_ids) and i.product_id is not null
      group by i.product_id
    ) as item_totals
    where p.id = item_totals.product_id;

    delete from public.cart_items as ci
    where ci.user_id = (select mo.buyer_id from public.market_orders as mo where mo.id = v_order_ids[1])
      and not ci.saved_for_later
      and ci.variant_id in (
        select i.variant_id from public.market_order_items as i
        where i.order_id = any(v_order_ids) and i.variant_id is not null
      );
  else
    return query
      update public.market_orders as mo
      set status = 'cancelled', cancelled_at = now(), cancel_reason = 'payment_failed'
      where mo.id = any(v_order_ids)
      returning mo.id, mo.buyer_id, mo.seller_id, mo.number, mo.subtotal_pesewas, mo.total_pesewas;

    update public.product_variants as v
    set stock = v.stock + item_totals.qty
    from (
      select i.variant_id, sum(i.qty)::integer as qty
      from public.market_order_items as i
      where i.order_id = any(v_order_ids) and i.variant_id is not null
      group by i.variant_id
    ) as item_totals
    where v.id = item_totals.variant_id;

    update public.coupons as c
    set used_count = greatest(c.used_count - used.coupon_count, 0)
    from (
      select mo.coupon_id, count(*)::integer as coupon_count
      from public.market_orders as mo
      where mo.id = any(v_order_ids) and mo.coupon_id is not null
      group by mo.coupon_id
    ) as used
    where c.id = used.coupon_id;

    insert into public.market_order_events (order_id, kind)
    select unnest(v_order_ids), 'payment_failed';
  end if;
end;
$$;
revoke all on function public.papa_market_set_checkout_paid(uuid,boolean) from public, anon, authenticated;
grant execute on function public.papa_market_set_checkout_paid(uuid,boolean) to service_role;
