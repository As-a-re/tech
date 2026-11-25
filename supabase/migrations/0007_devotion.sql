-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
CREATE TYPE "public"."prayer_audience" AS ENUM('everyone', 'assembly');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'prayed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'prayer_comment';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'prayer_answered';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'testimony_praise';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'testimony_comment';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'birthday';--> statement-breakpoint
CREATE TABLE "daily_verses" (
	"day" date PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"text" text NOT NULL,
	"translation" text DEFAULT 'KJV' NOT NULL,
	"set_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devotion_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prayer_id" uuid,
	"testimony_id" uuid,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"job" text NOT NULL,
	"day" date NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_runs_job_day_pk" PRIMARY KEY("job","day")
);
--> statement-breakpoint
CREATE TABLE "prayer_prayed" (
	"prayer_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prayer_prayed_prayer_id_user_id_pk" PRIMARY KEY("prayer_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "prayer_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"anonymous" boolean DEFAULT false NOT NULL,
	"audience" "prayer_audience" DEFAULT 'everyone' NOT NULL,
	"assembly_id" uuid NOT NULL,
	"prayed_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"answered_at" timestamp with time zone,
	"answer_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "testimonies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"prayer_id" uuid,
	"praise_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "testimony_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"testimony_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"width" integer,
	"height" integer,
	"position" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimony_praises" (
	"testimony_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "testimony_praises_testimony_id_user_id_pk" PRIMARY KEY("testimony_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "show_birthday" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "anniversary" date;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "prayer_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "testimony_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "prayer_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "testimony_id" uuid;--> statement-breakpoint
ALTER TABLE "daily_verses" ADD CONSTRAINT "daily_verses_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devotion_comments" ADD CONSTRAINT "devotion_comments_prayer_id_prayer_requests_id_fk" FOREIGN KEY ("prayer_id") REFERENCES "public"."prayer_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devotion_comments" ADD CONSTRAINT "devotion_comments_testimony_id_testimonies_id_fk" FOREIGN KEY ("testimony_id") REFERENCES "public"."testimonies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devotion_comments" ADD CONSTRAINT "devotion_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_prayed" ADD CONSTRAINT "prayer_prayed_prayer_id_prayer_requests_id_fk" FOREIGN KEY ("prayer_id") REFERENCES "public"."prayer_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_prayed" ADD CONSTRAINT "prayer_prayed_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_requests" ADD CONSTRAINT "prayer_requests_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_requests" ADD CONSTRAINT "prayer_requests_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonies" ADD CONSTRAINT "testimonies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonies" ADD CONSTRAINT "testimonies_prayer_id_prayer_requests_id_fk" FOREIGN KEY ("prayer_id") REFERENCES "public"."prayer_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimony_media" ADD CONSTRAINT "testimony_media_testimony_id_testimonies_id_fk" FOREIGN KEY ("testimony_id") REFERENCES "public"."testimonies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimony_praises" ADD CONSTRAINT "testimony_praises_testimony_id_testimonies_id_fk" FOREIGN KEY ("testimony_id") REFERENCES "public"."testimonies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimony_praises" ADD CONSTRAINT "testimony_praises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devotion_comments_prayer_idx" ON "devotion_comments" USING btree ("prayer_id","created_at");--> statement-breakpoint
CREATE INDEX "devotion_comments_testimony_idx" ON "devotion_comments" USING btree ("testimony_id","created_at");--> statement-breakpoint
CREATE INDEX "prayer_prayed_user_idx" ON "prayer_prayed" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "prayer_requests_created_idx" ON "prayer_requests" USING btree ("created_at") WHERE "prayer_requests"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "prayer_requests_author_idx" ON "prayer_requests" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "prayer_requests_assembly_idx" ON "prayer_requests" USING btree ("assembly_id","created_at");--> statement-breakpoint
CREATE INDEX "testimonies_created_idx" ON "testimonies" USING btree ("created_at") WHERE "testimonies"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "testimonies_author_idx" ON "testimonies" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "testimony_media_idx" ON "testimony_media" USING btree ("testimony_id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_prayer_id_prayer_requests_id_fk" FOREIGN KEY ("prayer_id") REFERENCES "public"."prayer_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_testimony_id_testimonies_id_fk" FOREIGN KEY ("testimony_id") REFERENCES "public"."testimonies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_prayer_id_prayer_requests_id_fk" FOREIGN KEY ("prayer_id") REFERENCES "public"."prayer_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_testimony_id_testimonies_id_fk" FOREIGN KEY ("testimony_id") REFERENCES "public"."testimonies"("id") ON DELETE cascade ON UPDATE no action;
