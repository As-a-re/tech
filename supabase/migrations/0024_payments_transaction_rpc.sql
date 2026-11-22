-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
create or replace function public.papa_create_payment(
	p_user_id uuid, p_reference text, p_purpose payment_purpose, p_amount_pesewas integer,
	p_currency text, p_provider text, p_level level, p_district_id uuid default null,
	p_assembly_id uuid default null, p_fund_id uuid default null, p_live_id uuid default null,
	p_publication_id uuid default null, p_resource_order_id uuid default null,
	p_market_checkout_id uuid default null, p_note text default null, p_anonymous boolean default false
)
returns uuid language sql security definer set search_path = public as $$
	insert into payments (user_id, reference, purpose, amount_pesewas, currency, provider, level, district_id, assembly_id,
		fund_id, live_id, publication_id, resource_order_id, market_checkout_id, note, anonymous)
	values (p_user_id, p_reference, p_purpose, p_amount_pesewas, p_currency, p_provider, p_level, p_district_id, p_assembly_id,
		p_fund_id, p_live_id, p_publication_id, p_resource_order_id, p_market_checkout_id, p_note, p_anonymous)
	returning id
$$;

create or replace function public.papa_set_payment_status(
	p_payment_id uuid, p_expected_status payment_status, p_status payment_status,
	p_channel text default null, p_paid_at timestamptz default null, p_provider_data jsonb default null
)
returns table (id uuid, resource_order_id uuid, market_checkout_id uuid)
language sql security definer set search_path = public as $$
	update payments
	set status = p_status, channel = p_channel, paid_at = p_paid_at, provider_data = p_provider_data
	where payments.id = p_payment_id and payments.status = p_expected_status
	returning payments.id, payments.resource_order_id, payments.market_checkout_id
$$;

revoke all on function public.papa_create_payment(uuid, text, payment_purpose, integer, text, text, level, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.papa_set_payment_status(uuid, payment_status, payment_status, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.papa_create_payment(uuid, text, payment_purpose, integer, text, text, level, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, boolean) to service_role;
grant execute on function public.papa_set_payment_status(uuid, payment_status, payment_status, text, timestamptz, jsonb) to service_role;
