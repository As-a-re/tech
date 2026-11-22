-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
-- Atomic stock reservation and resource-order settlement for the Supabase JS backend.
create or replace function public.papa_place_resource_order(p_resource_id uuid,p_buyer_id uuid,p_size text,p_qty integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r resources%rowtype; o resource_orders%rowtype; found_size boolean:=false;
begin
 if p_qty is null or p_qty<1 or p_qty>20 then return null; end if;
 select * into r from resources where id=p_resource_id and active and deleted_at is null for update;
 if not found then return null; end if;
 if r.kind='uniform' then
   if p_size is null then return null; end if;
   select exists(select 1 from jsonb_array_elements(r.sizes) s where s->>'size'=p_size and coalesce((s->>'stock')::integer,0)>=p_qty) into found_size;
   if not found_size then return null; end if;
   update resources set sizes=(select coalesce(jsonb_agg(case when s->>'size'=p_size then jsonb_set(s,'{stock}',to_jsonb((s->>'stock')::integer-p_qty)) else s end),'[]'::jsonb) from jsonb_array_elements(r.sizes) s) where id=p_resource_id;
 else
   p_size:=null; p_qty:=1;
 end if;
 insert into resource_orders(resource_id,buyer_id,size,qty,total_pesewas,status)
 values(r.id,p_buyer_id,p_size,p_qty,r.price_pesewas*p_qty,'pending_payment') returning * into o;
 return jsonb_build_object('id',o.id,'total_pesewas',o.total_pesewas,'resource_id',o.resource_id,'size',o.size,'qty',o.qty,'status',o.status);
end $$;

create or replace function public.papa_set_resource_order_payment(p_order_id uuid,p_success boolean,p_collection_code text)
returns boolean language plpgsql security definer set search_path=public as $$
declare o resource_orders%rowtype; k resource_kind;
begin
 select * into o from resource_orders where id=p_order_id for update;
 if not found or o.status<>'pending_payment' then return false; end if;
 if p_success then
   select kind into k from resources where id=o.resource_id;
   update resource_orders set status=case when k='study_guide' then 'collected'::resource_order_status else 'paid'::resource_order_status end,
     paid_at=now(),collection_code=p_collection_code,collected_at=case when k='study_guide' then now() else null end where id=o.id;
 else
   update resource_orders set status='cancelled' where id=o.id;
   if o.size is not null then
     update resources set sizes=(select coalesce(jsonb_agg(case when s->>'size'=o.size then jsonb_set(s,'{stock}',to_jsonb(coalesce((s->>'stock')::integer,0)+o.qty)) else s end),'[]'::jsonb) from jsonb_array_elements(sizes) s) where id=o.resource_id;
   end if;
 end if;
 return true;
end $$;

create or replace function public.papa_manage_resource_order(p_order_id uuid,p_action text,p_actor_id uuid,p_code text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare o resource_orders%rowtype;
begin
 select * into o from resource_orders where id=p_order_id for update;
 if not found then return false; end if;
 if p_action='ready' and o.status='paid' then
   update resource_orders set status='ready',ready_at=now(),handled_by=p_actor_id where id=o.id; return true;
 elsif p_action='collected' and o.status in ('paid','ready') and p_code is not null and p_code=o.collection_code then
   update resource_orders set status='collected',collected_at=now(),handled_by=p_actor_id where id=o.id; return true;
 elsif p_action='cancel' and o.status in ('paid','ready') then
   update resource_orders set status='cancelled',handled_by=p_actor_id where id=o.id;
   update payments set status='refunded' where resource_order_id=o.id and status='success';
   if o.size is not null then
     update resources set sizes=(select coalesce(jsonb_agg(case when s->>'size'=o.size then jsonb_set(s,'{stock}',to_jsonb(coalesce((s->>'stock')::integer,0)+o.qty)) else s end),'[]'::jsonb) from jsonb_array_elements(sizes) s) where id=o.resource_id;
   end if;
   return true;
 end if;
 return false;
end $$;
revoke all on function public.papa_place_resource_order(uuid,uuid,text,integer) from public,anon,authenticated;
revoke all on function public.papa_set_resource_order_payment(uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.papa_manage_resource_order(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.papa_place_resource_order(uuid,uuid,text,integer) to service_role;
grant execute on function public.papa_set_resource_order_payment(uuid,boolean,text) to service_role;
grant execute on function public.papa_manage_resource_order(uuid,text,uuid,text) to service_role;
