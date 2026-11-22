-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
CREATE TYPE "public"."coupon_kind" AS ENUM('percent', 'amount');--> statement-breakpoint
CREATE TYPE "public"."escrow_state" AS ENUM('held', 'released', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."fulfilment" AS ENUM('delivery', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."market_order_status" AS ENUM('pending_payment', 'paid', 'accepted', 'packed', 'shipped', 'delivered', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."market_request_kind" AS ENUM('cancel', 'return', 'refund');--> statement-breakpoint
CREATE TYPE "public"."market_request_status" AS ENUM('open', 'approved', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."product_alert_kind" AS ENUM('stock', 'price');--> statement-breakpoint
CREATE TYPE "public"."product_condition" AS ENUM('new', 'used', 'refurbished');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'draft', 'removed');--> statement-breakpoint
CREATE TYPE "public"."shop_status" AS ENUM('active', 'paused', 'suspended');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'market_order';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'market_sale';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'market_question';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'market_review';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'market_alert';--> statement-breakpoint
ALTER TYPE "public"."payment_purpose" ADD VALUE 'order';--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"saved_for_later" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"code" text NOT NULL,
	"kind" "coupon_kind" NOT NULL,
	"value" integer NOT NULL,
	"min_spend_pesewas" integer DEFAULT 0 NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" uuid,
	"total_pesewas" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"note" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"title" text NOT NULL,
	"variant_name" text DEFAULT '' NOT NULL,
	"image" text,
	"unit_pesewas" integer NOT NULL,
	"qty" integer NOT NULL,
	"total_pesewas" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"checkout_id" uuid,
	"buyer_id" uuid,
	"shop_id" uuid,
	"seller_id" uuid,
	"shop_name" text NOT NULL,
	"status" "market_order_status" DEFAULT 'pending_payment' NOT NULL,
	"fulfilment" "fulfilment" NOT NULL,
	"recipient_name" text,
	"phone" text,
	"town" text,
	"address" text,
	"landmark" text,
	"note" text,
	"pickup_address" text,
	"subtotal_pesewas" integer NOT NULL,
	"delivery_fee_pesewas" integer DEFAULT 0 NOT NULL,
	"discount_pesewas" integer DEFAULT 0 NOT NULL,
	"total_pesewas" integer NOT NULL,
	"fee_bps" integer DEFAULT 0 NOT NULL,
	"fee_pesewas" integer DEFAULT 0 NOT NULL,
	"seller_net_pesewas" integer DEFAULT 0 NOT NULL,
	"coupon_id" uuid,
	"coupon_code" text,
	"escrow" "escrow_state",
	"refunded_pesewas" integer DEFAULT 0 NOT NULL,
	"handover_code" text,
	"paid_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"packed_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"buyer_id" uuid,
	"kind" "market_request_kind" NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" "market_request_status" DEFAULT 'open' NOT NULL,
	"response" text,
	"refund_pesewas" integer,
	"handled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_alerts" (
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"kind" "product_alert_kind" NOT NULL,
	"price_pesewas" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone,
	CONSTRAINT "product_alerts_user_id_product_id_kind_pk" PRIMARY KEY("user_id","product_id","kind")
);
--> statement-breakpoint
CREATE TABLE "product_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"asker_id" uuid NOT NULL,
	"body" text NOT NULL,
	"answer" text,
	"answered_by" uuid,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hidden_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid,
	"rating" integer NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"seller_reply" text,
	"seller_reply_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hidden_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_pesewas" integer NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"sku" text,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"condition" "product_condition" DEFAULT 'new' NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"option_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price_pesewas" integer NOT NULL,
	"compare_at_pesewas" integer,
	"deal_ends_at" timestamp with time zone,
	"rating_sum" integer DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"sold_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recently_viewed" (
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recently_viewed_user_id_product_id_pk" PRIMARY KEY("user_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "shop_follows" (
	"shop_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_follows_shop_id_user_id_pk" PRIMARY KEY("shop_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"logo_url" text,
	"cover_url" text,
	"assembly_id" uuid,
	"town" text,
	"phone" text,
	"offers_pickup" boolean DEFAULT true NOT NULL,
	"pickup_address" text,
	"offers_delivery" boolean DEFAULT true NOT NULL,
	"delivery_fee_pesewas" integer DEFAULT 0 NOT NULL,
	"free_delivery_over_pesewas" integer,
	"delivery_note" text,
	"return_days" integer DEFAULT 7 NOT NULL,
	"status" "shop_status" DEFAULT 'active' NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_items_user_id_product_id_pk" PRIMARY KEY("user_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "market_order_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "shop_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "market_checkout_id" uuid;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_checkouts" ADD CONSTRAINT "market_checkouts_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_order_events" ADD CONSTRAINT "market_order_events_order_id_market_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."market_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_order_events" ADD CONSTRAINT "market_order_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_order_items" ADD CONSTRAINT "market_order_items_order_id_market_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."market_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_order_items" ADD CONSTRAINT "market_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_order_items" ADD CONSTRAINT "market_order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_orders" ADD CONSTRAINT "market_orders_checkout_id_market_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."market_checkouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_orders" ADD CONSTRAINT "market_orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_orders" ADD CONSTRAINT "market_orders_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_orders" ADD CONSTRAINT "market_orders_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_orders" ADD CONSTRAINT "market_orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_requests" ADD CONSTRAINT "market_requests_order_id_market_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."market_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_requests" ADD CONSTRAINT "market_requests_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_requests" ADD CONSTRAINT "market_requests_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_alerts" ADD CONSTRAINT "product_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_alerts" ADD CONSTRAINT "product_alerts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_asker_id_users_id_fk" FOREIGN KEY ("asker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_answered_by_users_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_id_market_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."market_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_follows" ADD CONSTRAINT "shop_follows_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_follows" ADD CONSTRAINT "shop_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_one_idx" ON "cart_items" USING btree ("user_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_idx" ON "coupons" USING btree ("shop_id","code");--> statement-breakpoint
CREATE INDEX "market_order_events_order_idx" ON "market_order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "market_order_items_order_idx" ON "market_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "market_order_items_product_idx" ON "market_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "market_orders_number_idx" ON "market_orders" USING btree ("number");--> statement-breakpoint
CREATE INDEX "market_orders_buyer_idx" ON "market_orders" USING btree ("buyer_id","created_at");--> statement-breakpoint
CREATE INDEX "market_orders_shop_idx" ON "market_orders" USING btree ("shop_id","status");--> statement-breakpoint
CREATE INDEX "market_orders_checkout_idx" ON "market_orders" USING btree ("checkout_id");--> statement-breakpoint
-- Supabase migration 0025: atomic Market cart, checkout and payment mutations.
create or replace function public.papa_market_add_to_cart(p_user_id uuid, p_variant_id uuid, p_qty integer)
returns integer language plpgsql security definer set search_path = public as $$
declare current_qty integer; available_stock integer; line_count integer;
begin
	select stock into available_stock from product_variants where id = p_variant_id and active;
	if available_stock is null or available_stock < 1 then raise exception 'stock'; end if;
	select qty into current_qty from cart_items where user_id = p_user_id and variant_id = p_variant_id;
	if current_qty is null and (select count(*) from cart_items where user_id = p_user_id) >= 100 then raise exception 'too_many'; end if;
	insert into cart_items (user_id, variant_id, qty, saved_for_later) values (p_user_id, p_variant_id, least(coalesce(current_qty, 0) + p_qty, available_stock, 50), false)
	on conflict (user_id, variant_id) do update set qty = excluded.qty, saved_for_later = false, updated_at = now();
	select coalesce(sum(qty), 0)::int into line_count from cart_items where user_id = p_user_id and not saved_for_later; return line_count;
end; $$;
create or replace function public.papa_market_set_cart_qty(p_user_id uuid, p_item_id uuid, p_qty integer)
returns integer language plpgsql security definer set search_path = public as $$
declare variant uuid; available_stock integer; line_count integer;
begin
	select variant_id into variant from cart_items where id = p_item_id and user_id = p_user_id;
	if variant is null then raise exception 'not_found'; end if;
	if p_qty = 0 then delete from cart_items where id = p_item_id and user_id = p_user_id; else select stock into available_stock from product_variants where id = variant; update cart_items set qty = greatest(1, least(p_qty, coalesce(available_stock, 1))), updated_at = now() where id = p_item_id and user_id = p_user_id; end if;
	select coalesce(sum(qty), 0)::int into line_count from cart_items where user_id = p_user_id and not saved_for_later; return line_count;
end; $$;
create or replace function public.papa_market_set_saved(p_user_id uuid, p_item_id uuid, p_saved boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare line_count integer;
begin
	update cart_items set saved_for_later = p_saved, updated_at = now() where id = p_item_id and user_id = p_user_id;
	if not found then raise exception 'not_found'; end if;
	select coalesce(sum(qty), 0)::int into line_count from cart_items where user_id = p_user_id and not saved_for_later; return line_count;
end; $$;
create or replace function public.papa_market_create_checkout(p_buyer_id uuid, p_total_pesewas integer, p_orders jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare checkout_id uuid; order_data jsonb; item_data jsonb; order_id uuid; coupon_id uuid;
begin
	insert into market_checkouts (buyer_id, total_pesewas) values (p_buyer_id, p_total_pesewas) returning id into checkout_id;
	for order_data in select value from jsonb_array_elements(p_orders) loop
		coupon_id := null;
		if order_data->>'coupon' is not null then update coupons set used_count = used_count + 1 where shop_id = (order_data->>'shop_id')::uuid and code = order_data->>'coupon' and active and (max_uses is null or used_count < max_uses) returning id into coupon_id; if coupon_id is null then raise exception 'coupon_used_up'; end if; end if;
		insert into market_orders (number, checkout_id, buyer_id, shop_id, seller_id, shop_name, fulfilment, recipient_name, phone, town, address, landmark, note, pickup_address, subtotal_pesewas, delivery_fee_pesewas, discount_pesewas, total_pesewas, fee_bps, fee_pesewas, seller_net_pesewas, coupon_id, coupon_code) values (order_data->>'number', checkout_id, p_buyer_id, (order_data->>'shop_id')::uuid, (order_data->>'seller_id')::uuid, order_data->>'shop_name', (order_data->>'fulfilment')::fulfilment, order_data->>'recipient_name', order_data->>'phone', order_data->>'town', order_data->>'address', order_data->>'landmark', order_data->>'note', order_data->>'pickup_address', (order_data->>'subtotal')::integer, (order_data->>'delivery_fee')::integer, (order_data->>'discount')::integer, (order_data->>'total')::integer, (order_data->>'fee_bps')::integer, (order_data->>'fee')::integer, (order_data->>'seller_net')::integer, coupon_id, order_data->>'coupon') returning id into order_id;
		for item_data in select value from jsonb_array_elements(order_data->'items') loop
			update product_variants set stock = stock - (item_data->>'qty')::integer where id = (item_data->>'variant_id')::uuid and active and stock >= (item_data->>'qty')::integer;
			if not found then raise exception 'stock'; end if;
			insert into market_order_items (order_id, product_id, variant_id, title, variant_name, image, unit_pesewas, qty, total_pesewas) values (order_id, (item_data->>'product_id')::uuid, (item_data->>'variant_id')::uuid, item_data->>'title', item_data->>'variant_name', item_data->>'image', (item_data->>'unit')::integer, (item_data->>'qty')::integer, (item_data->>'line_total')::integer);
		end loop;
		insert into market_order_events (order_id, kind, actor_id) values (order_id, 'placed', p_buyer_id);
	end loop; return checkout_id;
end; $$;
create or replace function public.papa_market_set_checkout_paid(p_checkout_id uuid, p_ok boolean)
returns table (id uuid, buyer_id uuid, seller_id uuid, number text, subtotal_pesewas integer, total_pesewas integer) language plpgsql security definer set search_path = public as $$
begin
	if p_ok then return query update market_orders set status = 'paid', paid_at = now(), escrow = 'held', handover_code = lpad((floor(random() * 900000) + 100000)::text, 6, '0') where checkout_id = p_checkout_id and status = 'pending_payment' returning market_orders.id, market_orders.buyer_id, market_orders.seller_id, market_orders.number, market_orders.subtotal_pesewas, market_orders.total_pesewas;
	else return query update market_orders set status = 'cancelled', cancelled_at = now(), cancel_reason = 'payment_failed' where checkout_id = p_checkout_id and status = 'pending_payment' returning market_orders.id, market_orders.buyer_id, market_orders.seller_id, market_orders.number, market_orders.subtotal_pesewas, market_orders.total_pesewas;
		update product_variants v set stock = v.stock + i.qty from market_order_items i join market_orders o on o.id = i.order_id where i.variant_id = v.id and o.checkout_id = p_checkout_id and o.cancel_reason = 'payment_failed';
		update coupons c set used_count = greatest(c.used_count - 1, 0) from market_orders o where o.checkout_id = p_checkout_id and o.coupon_id = c.id and o.cancel_reason = 'payment_failed';
		insert into market_order_events (order_id, kind) select id, 'payment_failed' from market_orders where checkout_id = p_checkout_id and cancel_reason = 'payment_failed';
	end if;
end; $$;
revoke all on function public.papa_market_add_to_cart(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.papa_market_set_cart_qty(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.papa_market_set_saved(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.papa_market_create_checkout(uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.papa_market_set_checkout_paid(uuid, boolean) from public, anon, authenticated;
grant execute on function public.papa_market_add_to_cart(uuid, uuid, integer) to service_role;
grant execute on function public.papa_market_set_cart_qty(uuid, uuid, integer) to service_role;
grant execute on function public.papa_market_set_saved(uuid, uuid, boolean) to service_role;
grant execute on function public.papa_market_create_checkout(uuid, integer, jsonb) to service_role;
grant execute on function public.papa_market_set_checkout_paid(uuid, boolean) to service_role;
CREATE INDEX "market_requests_order_idx" ON "market_requests" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "market_requests_status_idx" ON "market_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "product_alerts_product_idx" ON "product_alerts" USING btree ("product_id","kind");--> statement-breakpoint
CREATE INDEX "product_questions_product_idx" ON "product_questions" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_reviews_one_idx" ON "product_reviews" USING btree ("product_id","user_id");--> statement-breakpoint
CREATE INDEX "product_reviews_product_idx" ON "product_reviews" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_shop_idx" ON "products" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "products_list_idx" ON "products" USING btree ("status","category","created_at") WHERE "products"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "recently_viewed_user_idx" ON "recently_viewed" USING btree ("user_id","viewed_at");--> statement-breakpoint
CREATE INDEX "shop_follows_user_idx" ON "shop_follows" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shops_slug_idx" ON "shops" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "shops_owner_idx" ON "shops" USING btree ("owner_id") WHERE "shops"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_market_order_id_market_orders_id_fk" FOREIGN KEY ("market_order_id") REFERENCES "public"."market_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_market_checkout_id_market_checkouts_id_fk" FOREIGN KEY ("market_checkout_id") REFERENCES "public"."market_checkouts"("id") ON DELETE set null ON UPDATE no action;
