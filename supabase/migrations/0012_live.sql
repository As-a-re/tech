-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
CREATE TYPE "public"."live_source" AS ENUM('studio', 'youtube');--> statement-breakpoint
CREATE TYPE "public"."live_status" AS ENUM('scheduled', 'live', 'ended');--> statement-breakpoint
ALTER TYPE "public"."level_role" ADD VALUE 'media_team';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'live';--> statement-breakpoint
CREATE TABLE "live_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"live_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "live_reactions" (
	"live_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "live_reactions_live_id_emoji_pk" PRIMARY KEY("live_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "live_reminders" (
	"live_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "live_reminders_live_id_user_id_pk" PRIMARY KEY("live_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "live_viewers" (
	"live_id" uuid NOT NULL,
	"viewer_key" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_viewers_live_id_viewer_key_pk" PRIMARY KEY("live_id","viewer_key")
);
--> statement-breakpoint
CREATE TABLE "lives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"level" "level" NOT NULL,
	"district_id" uuid,
	"assembly_id" uuid,
	"source" "live_source" NOT NULL,
	"youtube_url" text,
	"status" "live_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"replay_url" text,
	"giving" boolean DEFAULT true NOT NULL,
	"peak_viewers" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "live_id" uuid;--> statement-breakpoint
ALTER TABLE "live_comments" ADD CONSTRAINT "live_comments_live_id_lives_id_fk" FOREIGN KEY ("live_id") REFERENCES "public"."lives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_comments" ADD CONSTRAINT "live_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_reactions" ADD CONSTRAINT "live_reactions_live_id_lives_id_fk" FOREIGN KEY ("live_id") REFERENCES "public"."lives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_reminders" ADD CONSTRAINT "live_reminders_live_id_lives_id_fk" FOREIGN KEY ("live_id") REFERENCES "public"."lives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_reminders" ADD CONSTRAINT "live_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_viewers" ADD CONSTRAINT "live_viewers_live_id_lives_id_fk" FOREIGN KEY ("live_id") REFERENCES "public"."lives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lives" ADD CONSTRAINT "lives_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lives" ADD CONSTRAINT "lives_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lives" ADD CONSTRAINT "lives_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "live_comments_idx" ON "live_comments" USING btree ("live_id","created_at");--> statement-breakpoint
CREATE INDEX "lives_status_idx" ON "lives" USING btree ("status","scheduled_at") WHERE "lives"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_live_id_lives_id_fk" FOREIGN KEY ("live_id") REFERENCES "public"."lives"("id") ON DELETE cascade ON UPDATE no action;
