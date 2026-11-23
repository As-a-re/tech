-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
create or replace function public.papa_market_cancel_order(p_order_id uuid, p_by text, p_actor_id uuid, p_reason text)
returns table (id uuid, buyer_id uuid, seller_id uuid, coupon_id uuid, total_pesewas integer, refunded_pesewas integer, checkout_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_cancelled_deliveries integer;
begin
  if p_by not in ('buyer', 'seller', 'admin', 'system') then return; end if;
  update public.market_orders
  set status = 'cancelled', cancelled_at = now(), cancel_reason = left(coalesce(p_reason, ''), 300)
  where market_orders.id = p_order_id and market_orders.status in ('paid', 'accepted', 'packed', 'shipped');
  if not found then return; end if;

  insert into public.market_order_events (order_id, kind, actor_id, note)
  values (p_order_id, 'cancelled_by_' || p_by, p_actor_id, left(coalesce(p_reason, ''), 300));

  update public.deliveries set status = 'cancelled', cancelled_at = now()
  where order_id = p_order_id and status in ('open', 'accepted', 'picked_up');
  get diagnostics v_cancelled_deliveries = row_count;
  if v_cancelled_deliveries > 0 then
    update public.market_orders set rider_fee_pesewas = 0 where market_orders.id = p_order_id;
  end if;

  update public.product_variants v set stock = v.stock + i.qty
  from public.market_order_items i where i.order_id = p_order_id and i.variant_id = v.id;
  update public.coupons c set used_count = greatest(c.used_count - 1, 0)
  from public.market_orders o where o.id = p_order_id and o.coupon_id = c.id;
  update public.products p set sold_count = greatest(p.sold_count - i.qty, 0)
  from (select product_id, sum(qty)::integer as qty from public.market_order_items where order_id = p_order_id group by product_id) i
  where p.id = i.product_id;

  return query select o.id, o.buyer_id, o.seller_id, o.coupon_id, o.total_pesewas, o.refunded_pesewas, o.checkout_id
  from public.market_orders o where o.id = p_order_id;
end;
$$;

create or replace function public.papa_market_record_refund(p_order_id uuid, p_amount integer)
returns table (id uuid, buyer_id uuid, checkout_id uuid, refunded_pesewas integer, total_pesewas integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.market_orders%rowtype;
  v_refunded integer;
  v_remaining integer;
  v_fee integer;
begin
  select * into v_order from public.market_orders where id = p_order_id for update;
  if not found or v_order.paid_at is null or v_order.escrow = 'released'
    or p_amount is null or p_amount < 1 or p_amount > v_order.total_pesewas - v_order.refunded_pesewas then
    return;
  end if;
  v_refunded := v_order.refunded_pesewas + p_amount;
  v_remaining := v_order.total_pesewas - v_refunded;
  v_fee := round((least(v_order.subtotal_pesewas - v_order.discount_pesewas, v_remaining)::numeric * v_order.fee_bps) / 10000)::integer;
  update public.market_orders set refunded_pesewas = v_refunded, fee_pesewas = v_fee,
    seller_net_pesewas = greatest(0, v_remaining - v_fee - v_order.rider_fee_pesewas),
    escrow = case when v_remaining = 0 then 'refunded' else escrow end
  where market_orders.id = p_order_id;
  return query select o.id, o.buyer_id, o.checkout_id, o.refunded_pesewas, o.total_pesewas
  from public.market_orders o where o.id = p_order_id;
end;
$$;

revoke all on function public.papa_market_cancel_order(uuid,text,uuid,text) from public, anon, authenticated;
revoke all on function public.papa_market_record_refund(uuid,integer) from public, anon, authenticated;
grant execute on function public.papa_market_cancel_order(uuid,text,uuid,text) to service_role;
grant execute on function public.papa_market_record_refund(uuid,integer) to service_role;
