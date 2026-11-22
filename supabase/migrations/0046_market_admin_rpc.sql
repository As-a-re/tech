create or replace function public.papa_market_admin_stats() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
 'sales',(select coalesce(sum(total_pesewas),0)::integer from market_orders where paid_at>now()-interval '30 days'),
 'orders',(select count(*)::integer from market_orders where paid_at>now()-interval '30 days'),
 'fees',(select coalesce(sum(fee_pesewas),0)::integer from market_orders where paid_at>now()-interval '30 days' and status<>'cancelled'),
 'held',(select coalesce(sum(total_pesewas-refunded_pesewas),0)::integer from market_orders where escrow='held'),
 'open_requests',(select count(*)::integer from market_requests where status='open'),
 'disputes',(select count(*)::integer from market_requests where status='escalated'),
 'riders_waiting',(select count(*)::integer from riders where status='pending'),
 'payouts_problem',(select count(*)::integer from payouts where status in ('failed','manual')),
 'to_accept',(select count(*)::integer from market_orders where status='paid'),
 'refund_pending',(select count(*)::integer from market_orders where status='cancelled' and paid_at is not null and refunded_pesewas<total_pesewas),
 'products',(select count(*)::integer from products where status='active' and deleted_at is null),
 'shops',(select count(*)::integer from shops where status='active' and deleted_at is null),
 'refunded',(select coalesce(sum(refunded_pesewas),0)::integer from market_orders where paid_at>now()-interval '30 days'))
$$;
create or replace function public.papa_market_admin_orders(p_status text default null,p_query text default null,p_problems boolean default false,p_page integer default 1,p_page_size integer default 30)
returns jsonb language sql stable security definer set search_path=public as $$
 with filtered as (select o.id,o.number,o.shop_name,o.status::text as status,o.total_pesewas,o.refunded_pesewas,o.escrow,o.created_at,u.username as buyer,
 (select r.kind::text from market_requests r where r.order_id=o.id and r.status='open' limit 1) as open_request
 from market_orders o left join users u on u.id=o.buyer_id where o.paid_at is not null and (p_status is null or o.status::text=p_status)
 and (p_query is null or o.number ilike '%'||p_query||'%' or o.shop_name ilike '%'||p_query||'%' or u.username ilike '%'||p_query||'%' or u.full_name ilike '%'||p_query||'%')
 and (not p_problems or (o.status='cancelled' and o.refunded_pesewas<o.total_pesewas))),
 page_rows as (select * from filtered order by created_at desc limit least(101,greatest(1,coalesce(p_page_size,30))+1) offset (greatest(1,coalesce(p_page,1))-1)*least(100,greatest(1,coalesce(p_page_size,30))))
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page_rows) order by created_at desc) from page_rows limit least(100,greatest(1,coalesce(p_page_size,30)))),'[]'::jsonb),'hasMore',(select count(*)>least(100,greatest(1,coalesce(p_page_size,30))) from page_rows))
$$;
create or replace function public.papa_market_admin_requests(p_status text default 'open') returns setof jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('id',r.id,'order_id',r.order_id,'number',o.number,'kind',r.kind::text,'reason',r.reason,'details',r.details,'status',r.status::text,'created_at',r.created_at,'buyer',u.username,'shop_name',o.shop_name,'total_pesewas',o.total_pesewas)
 from market_requests r join market_orders o on o.id=r.order_id left join users u on u.id=r.buyer_id where r.status::text=p_status order by case when p_status='open' then r.created_at end asc,case when p_status<>'open' then r.created_at end desc limit 200
$$;
create or replace function public.papa_market_admin_products(p_query text default null,p_status text default null,p_page integer default 1,p_page_size integer default 30)
returns jsonb language sql stable security definer set search_path=public as $$
 with filtered as(select p.id,p.title,p.images->>0 as image,p.status::text as status,p.price_pesewas,s.name as shop_name,s.slug as shop_slug,p.created_at,
 (select count(*)::integer from reports r where r.status='open' and r.product_id=p.id) as reports,(select coalesce(sum(v.stock),0)::integer from product_variants v where v.product_id=p.id and v.active) as stock
 from products p join shops s on s.id=p.shop_id where p.deleted_at is null and (p_status is null or p.status::text=p_status) and (p_query is null or p.title ilike '%'||p_query||'%' or s.name ilike '%'||p_query||'%')),
 page_rows as(select * from filtered order by created_at desc limit least(101,greatest(1,coalesce(p_page_size,30))+1) offset (greatest(1,coalesce(p_page,1))-1)*least(100,greatest(1,coalesce(p_page_size,30))))
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from (select * from page_rows limit least(100,greatest(1,coalesce(p_page_size,30)))) x),'[]'::jsonb),'hasMore',(select count(*)>least(100,greatest(1,coalesce(p_page_size,30))) from page_rows))
$$;
create or replace function public.papa_market_admin_shops(p_query text default null,p_page integer default 1,p_page_size integer default 30)
returns jsonb language sql stable security definer set search_path=public as $$
 with filtered as(select s.id,s.slug,s.name,s.status::text as status,s.verified_at is not null as verified,u.username as owner,
 (select count(*)::integer from products p where p.shop_id=s.id and p.deleted_at is null) as products,
 (select count(*)::integer from market_orders o where o.shop_id=s.id and o.paid_at is not null) as orders,s.created_at,
 (select count(*)::integer from reports r where r.status='open' and r.shop_id=s.id) as reports
 from shops s join users u on u.id=s.owner_id where s.deleted_at is null and (p_query is null or s.name ilike '%'||p_query||'%' or u.username ilike '%'||p_query||'%')),
 page_rows as(select * from filtered order by created_at desc limit least(101,greatest(1,coalesce(p_page_size,30))+1) offset (greatest(1,coalesce(p_page,1))-1)*least(100,greatest(1,coalesce(p_page_size,30))))
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from (select * from page_rows limit least(100,greatest(1,coalesce(p_page_size,30)))) x),'[]'::jsonb),'hasMore',(select count(*)>least(100,greatest(1,coalesce(p_page_size,30))) from page_rows))
$$;
create or replace function public.papa_market_member_data(p_user_id uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
 'marketOrders',coalesce((select jsonb_agg(jsonb_build_object('number',o.number,'shop',o.shop_name,'status',o.status,'fulfilment',o.fulfilment,'totalPesewas',o.total_pesewas,'refundedPesewas',o.refunded_pesewas,'createdAt',o.created_at,'items',(select jsonb_agg(jsonb_build_object('title',i.title,'variant',i.variant_name,'qty',i.qty,'totalPesewas',i.total_pesewas)) from market_order_items i where i.order_id=o.id)) order by o.created_at desc) from market_orders o where o.buyer_id=p_user_id),'[]'::jsonb),
 'wishlist',coalesce((select jsonb_agg(jsonb_build_object('title',p.title,'addedAt',w.created_at)) from wishlist_items w join products p on p.id=w.product_id where w.user_id=p_user_id),'[]'::jsonb),
 'productReviews',coalesce((select jsonb_agg(jsonb_build_object('product',p.title,'rating',r.rating,'body',r.body,'createdAt',r.created_at)) from product_reviews r join products p on p.id=r.product_id where r.user_id=p_user_id),'[]'::jsonb),
 'productQuestions',coalesce((select jsonb_agg(jsonb_build_object('product',p.title,'body',q.body,'answer',q.answer,'createdAt',q.created_at)) from product_questions q join products p on p.id=q.product_id where q.asker_id=p_user_id),'[]'::jsonb),
 'shop',(select jsonb_build_object('name',s.name,'slug',s.slug,'createdAt',s.created_at,'products',(select count(*)::integer from products p where p.shop_id=s.id)) from shops s where s.owner_id=p_user_id limit 1))
$$;
revoke all on function public.papa_market_admin_stats() from public,anon,authenticated;
revoke all on function public.papa_market_admin_orders(text,text,boolean,integer,integer) from public,anon,authenticated;
revoke all on function public.papa_market_admin_requests(text) from public,anon,authenticated;
revoke all on function public.papa_market_admin_products(text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.papa_market_admin_shops(text,integer,integer) from public,anon,authenticated;
revoke all on function public.papa_market_member_data(uuid) from public,anon,authenticated;
grant execute on function public.papa_market_admin_stats() to service_role;
grant execute on function public.papa_market_admin_orders(text,text,boolean,integer,integer) to service_role;
grant execute on function public.papa_market_admin_requests(text) to service_role;
grant execute on function public.papa_market_admin_products(text,text,integer,integer) to service_role;
grant execute on function public.papa_market_admin_shops(text,integer,integer) to service_role;
grant execute on function public.papa_market_member_data(uuid) to service_role;
