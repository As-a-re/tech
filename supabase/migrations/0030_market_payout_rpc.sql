-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
-- Supabase migration 0030: atomic Market payout settlement and retry operations.
create or replace function public.papa_release_due_market_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with due as (
    update market_orders o set status='completed',completed_at=now(),
      released_at=case when o.escrow='held' then now() else o.released_at end,
      escrow=case when o.escrow='held' then 'released'::escrow_state else o.escrow end
    from shops s where s.id=o.shop_id and o.status='delivered' and o.escrow in ('held','refunded')
      and o.delivered_at < now()-make_interval(hours=>greatest(s.return_days*24,24))
      and not exists(select 1 from market_requests r where r.order_id=o.id and (r.status in ('open','escalated') or (r.status='declined' and r.resolved_at>now()-interval '7 days')))
    returning o.id
  ), ev as (
    insert into market_order_events(order_id,kind,actor_id,note) select id,'completed',null,null from due returning id
  ) select count(*) into n from due;
  return coalesce(n,0);
end $$;

create or replace function public.papa_create_market_payouts()
returns integer language plpgsql security definer set search_path = public as $$
declare s record; r record; pid uuid; n integer:=0; ref text;
begin
  perform pg_advisory_xact_lock(hashtext('papa_market_payout_creation'));
  for s in select sh.id shop_id,sh.owner_id,sum(o.seller_net_pesewas)::int total,sh.payout_method method,sh.payout_provider provider,sh.payout_number number,sh.payout_name name,array_agg(o.id) ids
    from market_orders o join shops sh on sh.id=o.shop_id where o.escrow='released' and o.seller_payout_id is null and o.seller_net_pesewas>0 and sh.payout_method is not null group by sh.id loop
    ref:='PAPA-PO-S'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
    insert into payouts(reference,kind,user_id,shop_id,amount_pesewas,method,provider,number,name) values(ref,'seller',s.owner_id,s.shop_id,s.total,s.method,s.provider,s.number,s.name) returning id into pid;
    update market_orders set seller_payout_id=pid where id=any(s.ids) and seller_payout_id is null; n:=n+1;
  end loop;
  for r in select ri.id rider_id,ri.user_id,sum(d.fee_pesewas)::int total,ri.payout_provider provider,ri.payout_number number,ri.payout_name name,array_agg(d.id) ids
    from deliveries d join riders ri on ri.id=d.rider_id join market_orders o on o.id=d.order_id where d.status='delivered' and d.payout_id is null and o.status='completed' and ri.payout_number is not null group by ri.id loop
    ref:='PAPA-PO-R'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
    insert into payouts(reference,kind,user_id,rider_id,amount_pesewas,method,provider,number,name) values(ref,'rider',r.user_id,r.rider_id,r.total,'momo',r.provider,r.number,r.name) returning id into pid;
    update deliveries set payout_id=pid where id=any(r.ids) and payout_id is null; n:=n+1;
  end loop;
  return n;
end $$;

create or replace function public.papa_claim_market_payouts(p_ids uuid[] default null)
returns setof payouts language sql security definer set search_path = public as $$
  update payouts p set status='processing',attempts=p.attempts+1
  where p.status in ('pending','failed') and (p_ids is not null and p.id=any(p_ids) or p_ids is null and (p.status='pending' or (p.status='failed' and p.attempts<5 and p.created_at<now()-make_interval(mins=>30*p.attempts))))
  returning p.*
$$;

create or replace function public.papa_finish_market_payout(p_id uuid,p_status text,p_provider_ref text,p_reason text)
returns uuid language sql security definer set search_path = public as $$
  update payouts set status=p_status::payout_status,provider_ref=left(p_provider_ref,200),failure_reason=nullif(left(p_reason,500),''),paid_at=case when p_status='paid' then now() else paid_at end
  where id=p_id and status='processing' and p_status in ('paid','failed') returning id
$$;

create or replace function public.papa_market_payout_result(p_reference text,p_status text,p_reason text)
returns uuid language sql security definer set search_path = public as $$
  update payouts set status=p_status::payout_status,failure_reason=case when p_status='failed' then left(p_reason,500) else null end,paid_at=case when p_status='paid' then now() else paid_at end
  where status='processing' and p_status in ('paid','failed') and reference in (p_reference,regexp_replace(p_reference,'-[0-9]+$','')) returning id
$$;

create or replace function public.papa_retry_market_payout(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$ begin update payouts set status='failed',attempts=0 where id=p_id and status='failed'; return found; end $$;
create or replace function public.papa_mark_market_payout_paid(p_id uuid,p_admin_id uuid,p_note text)
returns uuid language sql security definer set search_path = public as $$
  update payouts set status='paid',paid_at=now(),provider_ref=left(p_note,100),handled_by=p_admin_id,failure_reason=null where id=p_id and status in ('manual','failed') returning id
$$;

create or replace function public.papa_my_market_payouts(p_user_id uuid)
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id',p.id,'reference',p.reference,'kind',p.kind,'amount_pesewas',p.amount_pesewas,'status',p.status,'method',p.method,'provider',p.provider,'number',p.number,'name',p.name,'failure_reason',p.failure_reason,'created_at',p.created_at,'paid_at',p.paid_at,
    'count',(select count(*)::int from market_orders o where o.seller_payout_id=p.id)+(select count(*)::int from deliveries d where d.payout_id=p.id))
  from payouts p where p.user_id=p_user_id order by p.created_at desc limit 200
$$;
create or replace function public.papa_admin_market_payouts(p_status text default null)
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id',p.id,'reference',p.reference,'kind',p.kind,'amount_pesewas',p.amount_pesewas,'status',p.status,'method',p.method,'provider',p.provider,'number',p.number,'name',p.name,'failure_reason',p.failure_reason,'created_at',p.created_at,'paid_at',p.paid_at,
    'count',(select count(*)::int from market_orders o where o.seller_payout_id=p.id)+(select count(*)::int from deliveries d where d.payout_id=p.id),
    'payee',coalesce((select s.name from shops s where s.id=p.shop_id),(select u.full_name from users u where u.id=p.user_id)),'payee_username',(select u.username from users u where u.id=p.user_id))
  from payouts p where p_status is null or p.status::text=p_status order by (p.status in ('failed','manual')) desc,p.created_at desc limit 300
$$;
create or replace function public.papa_waiting_market_payout_details()
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('kind','seller','name',s.name,'username',u.username,'total',sum(o.seller_net_pesewas)::int) from market_orders o join shops s on s.id=o.shop_id join users u on u.id=s.owner_id
  where o.escrow='released' and o.seller_payout_id is null and s.payout_method is null group by s.id,u.username
  union all
  select jsonb_build_object('kind','rider','name',u.full_name,'username',u.username,'total',sum(d.fee_pesewas)::int) from deliveries d join riders r on r.id=d.rider_id join users u on u.id=r.user_id join market_orders o on o.id=d.order_id
  where d.status='delivered' and d.payout_id is null and o.status='completed' and r.payout_number is null group by u.id
$$;
create or replace function public.papa_market_account_blockers(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'buying',(select count(*)::int from market_orders where buyer_id=p_user_id and status in ('paid','accepted','packed','shipped')),
    'selling',(select count(*)::int from market_orders where seller_id=p_user_id and status in ('paid','accepted','packed','shipped')),
    'held',(select count(*)::int from market_orders where seller_id=p_user_id and status='delivered' and escrow='held'),
    'delivering',(select count(*)::int from deliveries d join riders r on r.id=d.rider_id where r.user_id=p_user_id and d.status in ('accepted','picked_up')),
    'owed',(select count(*)::int from payouts where user_id=p_user_id and status in ('pending','processing','failed','manual')))
$$;

revoke all on function public.papa_release_due_market_orders() from public,anon,authenticated;
revoke all on function public.papa_create_market_payouts() from public,anon,authenticated;
revoke all on function public.papa_claim_market_payouts(uuid[]) from public,anon,authenticated;
revoke all on function public.papa_finish_market_payout(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.papa_market_payout_result(text,text,text) from public,anon,authenticated;
revoke all on function public.papa_retry_market_payout(uuid) from public,anon,authenticated;
revoke all on function public.papa_mark_market_payout_paid(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.papa_my_market_payouts(uuid) from public,anon,authenticated;
revoke all on function public.papa_admin_market_payouts(text) from public,anon,authenticated;
revoke all on function public.papa_waiting_market_payout_details() from public,anon,authenticated;
revoke all on function public.papa_market_account_blockers(uuid) from public,anon,authenticated;
grant execute on function public.papa_release_due_market_orders() to service_role;
grant execute on function public.papa_create_market_payouts() to service_role;
grant execute on function public.papa_claim_market_payouts(uuid[]) to service_role;
grant execute on function public.papa_finish_market_payout(uuid,text,text,text) to service_role;
grant execute on function public.papa_market_payout_result(text,text,text) to service_role;
grant execute on function public.papa_retry_market_payout(uuid) to service_role;
grant execute on function public.papa_mark_market_payout_paid(uuid,uuid,text) to service_role;
grant execute on function public.papa_my_market_payouts(uuid) to service_role;
grant execute on function public.papa_admin_market_payouts(text) to service_role;
grant execute on function public.papa_waiting_market_payout_details() to service_role;
grant execute on function public.papa_market_account_blockers(uuid) to service_role;
