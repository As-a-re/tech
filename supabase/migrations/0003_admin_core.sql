-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
CREATE TYPE "public"."level" AS ENUM('national', 'district', 'local');--> statement-breakpoint
CREATE TYPE "public"."level_role" AS ENUM('resource_manager');--> statement-breakpoint
CREATE TABLE "level_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "level_role" NOT NULL,
	"level" "level" NOT NULL,
	"district_id" uuid,
	"assembly_id" uuid,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verified_label" text;--> statement-breakpoint
ALTER TABLE "level_roles" ADD CONSTRAINT "level_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_roles" ADD CONSTRAINT "level_roles_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_roles" ADD CONSTRAINT "level_roles_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_roles" ADD CONSTRAINT "level_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "level_roles_unique_idx" ON "level_roles" USING btree ("user_id","role","level",coalesce("district_id", '00000000-0000-0000-0000-000000000000'),coalesce("assembly_id", '00000000-0000-0000-0000-000000000000'));--> statement-breakpoint
CREATE INDEX "level_roles_user_idx" ON "level_roles" USING btree ("user_id");
