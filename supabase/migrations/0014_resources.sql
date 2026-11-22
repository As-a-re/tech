-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
CREATE TYPE "public"."resource_kind" AS ENUM('uniform', 'study_guide');--> statement-breakpoint
CREATE TYPE "public"."resource_order_status" AS ENUM('pending_payment', 'paid', 'ready', 'collected', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'resource_order';--> statement-breakpoint
ALTER TYPE "public"."payment_purpose" ADD VALUE 'resource';--> statement-breakpoint
CREATE TABLE "resource_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"buyer_id" uuid,
	"size" text,
	"qty" integer DEFAULT 1 NOT NULL,
	"total_pesewas" integer NOT NULL,
	"status" "resource_order_status" DEFAULT 'pending_payment' NOT NULL,
	"collection_code" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"collected_at" timestamp with time zone,
	"handled_by" uuid
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "resource_kind" NOT NULL,
	"level" "level" NOT NULL,
	"district_id" uuid,
	"assembly_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price_pesewas" integer DEFAULT 0 NOT NULL,
	"sizes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pickup_info" text,
	"file_url" text,
	"page_count" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "resource_order_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "resource_order_id" uuid;--> statement-breakpoint
ALTER TABLE "resource_orders" ADD CONSTRAINT "resource_orders_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_orders" ADD CONSTRAINT "resource_orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_orders" ADD CONSTRAINT "resource_orders_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_orders_buyer_idx" ON "resource_orders" USING btree ("buyer_id","created_at");--> statement-breakpoint
CREATE INDEX "resource_orders_resource_idx" ON "resource_orders" USING btree ("resource_id","status");--> statement-breakpoint
CREATE INDEX "resources_level_idx" ON "resources" USING btree ("level","kind") WHERE "resources"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_resource_order_id_resource_orders_id_fk" FOREIGN KEY ("resource_order_id") REFERENCES "public"."resource_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_resource_order_id_resource_orders_id_fk" FOREIGN KEY ("resource_order_id") REFERENCES "public"."resource_orders"("id") ON DELETE set null ON UPDATE no action;
