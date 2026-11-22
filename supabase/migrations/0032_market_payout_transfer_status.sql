-- Preserve all provider outcomes; bank transfers remain manual and pending provider transfers remain processing.
create or replace function public.papa_finish_market_payout(
  p_id uuid, p_status text, p_provider_ref text, p_reason text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_status text; v_id uuid;
begin
  if p_status not in ('paid','failed','manual','processing') then
    raise exception 'invalid_payout_result';
  end if;
  v_status := p_status;
  update payouts set
    status = v_status::payout_status,
    provider_ref = nullif(left(coalesce(p_provider_ref,''),200),''),
    failure_reason = case when v_status='failed' then nullif(left(coalesce(p_reason,''),500),'') else null end,
    paid_at = case when v_status='paid' then now() else paid_at end
  where id=p_id and status='processing'
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.papa_finish_market_payout(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.papa_finish_market_payout(uuid,text,text,text) to service_role;
