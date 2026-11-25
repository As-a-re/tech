-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
create or replace function public.papa_market_record_refund(p_order_id uuid, p_amount integer)
returns table (id uuid, buyer_id uuid, checkout_id uuid, refunded_pesewas integer, total_pesewas integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.market_orders%rowtype;
  v_refunded integer;
  v_remaining integer;
  v_fee integer;
begin
  select mo.* into v_order from public.market_orders as mo where mo.id = p_order_id for update;
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
  where public.market_orders.id = p_order_id;
  return query select o.id, o.buyer_id, o.checkout_id, o.refunded_pesewas, o.total_pesewas
  from public.market_orders o where o.id = p_order_id;
end;
$$;
revoke all on function public.papa_market_record_refund(uuid,integer) from public, anon, authenticated;
grant execute on function public.papa_market_record_refund(uuid,integer) to service_role;
