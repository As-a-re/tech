-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
-- Supabase migration 0025: Market order state mutations.
create or replace function public.papa_market_cancel_order(p_order_id uuid, p_by text, p_actor_id uuid, p_reason text)
returns table (id uuid, buyer_id uuid, seller_id uuid, coupon_id uuid, total_pesewas integer, refunded_pesewas integer, checkout_id uuid)
language plpgsql security definer set search_path = public as $$
begin
	update market_orders set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason where id = p_order_id and status in ('paid', 'accepted', 'packed', 'shipped');
	if not found then return; end if;
	insert into market_order_events (order_id, kind, actor_id, note) values (p_order_id, 'cancelled_by_' || p_by, p_actor_id, p_reason);
	update deliveries set status = 'cancelled', cancelled_at = now() where order_id = p_order_id and status in ('open', 'accepted', 'picked_up');
	update market_orders set rider_fee_pesewas = 0 where id = p_order_id;
	update product_variants v set stock = v.stock + i.qty from market_order_items i where i.order_id = p_order_id and i.variant_id = v.id;
	update coupons c set used_count = greatest(c.used_count - 1, 0) from market_orders o where o.id = p_order_id and o.coupon_id = c.id;
	update products p set sold_count = greatest(p.sold_count - i.qty, 0) from (select product_id, sum(qty)::int qty from market_order_items where order_id = p_order_id group by 1) i where p.id = i.product_id;
	return query select o.id, o.buyer_id, o.seller_id, o.coupon_id, o.total_pesewas, o.refunded_pesewas, o.checkout_id from market_orders o where o.id = p_order_id;
end; $$;
create or replace function public.papa_market_apply_refund(p_order_id uuid, p_amount integer, p_fee integer, p_seller_net integer)
returns table (id uuid, buyer_id uuid, checkout_id uuid, refunded_pesewas integer, total_pesewas integer)
language sql security definer set search_path = public as $$
	update market_orders set refunded_pesewas = refunded_pesewas + p_amount, fee_pesewas = p_fee, seller_net_pesewas = greatest(0, p_seller_net), escrow = case when refunded_pesewas + p_amount = total_pesewas then 'refunded' else escrow end
	where id = p_order_id and paid_at is not null and escrow <> 'released' and p_amount > 0 and p_amount <= total_pesewas - refunded_pesewas
	returning market_orders.id, market_orders.buyer_id, market_orders.checkout_id, market_orders.refunded_pesewas, market_orders.total_pesewas
$$;
revoke all on function public.papa_market_cancel_order(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.papa_market_apply_refund(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.papa_market_cancel_order(uuid, text, uuid, text) to service_role;
grant execute on function public.papa_market_apply_refund(uuid, integer, integer, integer) to service_role;
