-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
CREATE TYPE "public"."code_purpose" AS ENUM('register', 'reset_password', 'change_phone');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('member', 'tech_admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "assemblies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text,
	"district_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"town" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assemblies_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "assemblies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "church_members" (
	"church_id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"assembly_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"date_of_birth" date,
	"grant_tech_admin" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "districts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "districts_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "districts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target" text,
	"meta" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip" text,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" text NOT NULL,
	"username" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"assembly_id" uuid NOT NULL,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"avatar_url" text,
	"cover_url" text,
	"bio" text,
	"onboarded_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_church_id_unique" UNIQUE("church_id")
);
--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"purpose" "code_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assemblies" ADD CONSTRAINT "assemblies_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "church_members" ADD CONSTRAINT "church_members_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_church_id_church_members_church_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."church_members"("church_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assemblies_district_idx" ON "assemblies" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "church_members_assembly_idx" ON "church_members" USING btree ("assembly_id");--> statement-breakpoint
CREATE INDEX "church_members_phone_idx" ON "church_members" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_idx" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "users_assembly_idx" ON "users" USING btree ("assembly_id");--> statement-breakpoint
CREATE INDEX "verification_codes_phone_idx" ON "verification_codes" USING btree ("phone","purpose");
