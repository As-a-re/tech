-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
ALTER TYPE "public"."notification_type" ADD VALUE 'market_new';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "payout_method" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "payout_provider" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "payout_number" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "payout_name" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
UPDATE "products" SET "published_at" = "created_at" WHERE "status" = 'active';--> statement-breakpoint
UPDATE "shops" SET "terms_accepted_at" = "created_at";
