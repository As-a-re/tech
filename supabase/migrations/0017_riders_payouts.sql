-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
CREATE TYPE "public"."delivery_status" AS ENUM('open', 'accepted', 'picked_up', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payout_kind" AS ENUM('seller', 'rider');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'paid', 'failed', 'manual');--> statement-breakpoint
CREATE TYPE "public"."rider_status" AS ENUM('pending', 'active', 'paused', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."vehicle_kind" AS ENUM('motorbike', 'car', 'bicycle', 'foot');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'market_delivery';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'market_payout';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'market_rider';--> statement-breakpoint
ALTER TYPE "public"."market_request_status" ADD VALUE 'escalated';--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"shop_id" uuid,
	"rider_id" uuid,
	"status" "delivery_status" DEFAULT 'open' NOT NULL,
	"fee_pesewas" integer NOT NULL,
	"pickup_town" text,
	"pickup_address" text NOT NULL,
	"dropoff_town" text,
	"dropoff_address" text NOT NULL,
	"note" text,
	"payout_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"kind" "payout_kind" NOT NULL,
	"user_id" uuid,
	"shop_id" uuid,
	"rider_id" uuid,
	"amount_pesewas" integer NOT NULL,
	"method" text NOT NULL,
	"provider" text,
	"number" text,
	"name" text,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"provider_ref" text,
	"failure_reason" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"handled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "riders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"vehicle" "vehicle_kind" NOT NULL,
	"plate" text,
	"areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"about" text,
	"payout_provider" text,
	"payout_number" text,
	"payout_name" text,
	"status" "rider_status" DEFAULT 'pending' NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_orders" ADD COLUMN "released_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "market_orders" ADD COLUMN "rider_fee_pesewas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "market_orders" ADD COLUMN "seller_payout_id" uuid;--> statement-breakpoint
ALTER TABLE "market_requests" ADD COLUMN "escalated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "market_requests" ADD COLUMN "escalation_note" text;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_market_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."market_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riders" ADD CONSTRAINT "riders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riders" ADD CONSTRAINT "riders_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deliveries_status_idx" ON "deliveries" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "deliveries_rider_idx" ON "deliveries" USING btree ("rider_id","status");--> statement-breakpoint
CREATE INDEX "deliveries_order_idx" ON "deliveries" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_reference_idx" ON "payouts" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "payouts_user_idx" ON "payouts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "riders_user_idx" ON "riders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "riders_status_idx" ON "riders" USING btree ("status");
