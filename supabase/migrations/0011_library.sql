-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
CREATE TYPE "public"."age_group" AS ENUM('all', '0_4', '5_8', '9_12');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'scheduled', 'published');--> statement-breakpoint
CREATE TYPE "public"."kids_kind" AS ENUM('story', 'quiz', 'song', 'video', 'colouring', 'memory_verse', 'lesson');--> statement-breakpoint
CREATE TYPE "public"."publication_format" AS ENUM('pdf', 'article');--> statement-breakpoint
CREATE TYPE "public"."publication_kind" AS ENUM('magazine', 'devotional', 'book', 'newsletter', 'bulletin', 'manual');--> statement-breakpoint
ALTER TYPE "public"."level_role" ADD VALUE 'publications_editor';--> statement-breakpoint
ALTER TYPE "public"."level_role" ADD VALUE 'childrens_ministry';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'publication';--> statement-breakpoint
CREATE TABLE "kids_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "kids_kind" NOT NULL,
	"age_group" "age_group" DEFAULT 'all' NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"body" text DEFAULT '' NOT NULL,
	"bible_ref" text,
	"cover_url" text,
	"audio_url" text,
	"video_url" text,
	"file_url" text,
	"week_of" date,
	"level" "level" DEFAULT 'national' NOT NULL,
	"district_id" uuid,
	"assembly_id" uuid,
	"status" "content_status" DEFAULT 'published' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kids_quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	"answer" smallint NOT NULL,
	"explain" text
);
--> statement-breakpoint
CREATE TABLE "kids_quiz_results" (
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"score" smallint NOT NULL,
	"total" smallint NOT NULL,
	"stars" smallint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kids_quiz_results_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "publication_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publication_saves" (
	"user_id" uuid NOT NULL,
	"publication_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publication_saves_user_id_publication_id_pk" PRIMARY KEY("user_id","publication_id")
);
--> statement-breakpoint
CREATE TABLE "publication_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"kind" "publication_kind" NOT NULL,
	"cover_url" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "publication_kind" NOT NULL,
	"format" "publication_format" NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"description" text DEFAULT '' NOT NULL,
	"author" text,
	"series_id" uuid,
	"edition" text,
	"language" text DEFAULT 'en' NOT NULL,
	"level" "level" NOT NULL,
	"district_id" uuid,
	"assembly_id" uuid,
	"cover_url" text,
	"file_url" text,
	"preview_url" text,
	"page_count" integer,
	"preview_pages" smallint DEFAULT 3 NOT NULL,
	"price_pesewas" integer DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"publish_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"read_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reading_progress" (
	"user_id" uuid NOT NULL,
	"publication_id" uuid NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"percent" smallint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_progress_user_id_publication_id_pk" PRIMARY KEY("user_id","publication_id")
);
--> statement-breakpoint
CREATE TABLE "series_follows" (
	"user_id" uuid NOT NULL,
	"series_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_follows_user_id_series_id_pk" PRIMARY KEY("user_id","series_id")
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "kids_pin_hash" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "publication_id" uuid;--> statement-breakpoint
ALTER TABLE "kids_items" ADD CONSTRAINT "kids_items_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_items" ADD CONSTRAINT "kids_items_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_items" ADD CONSTRAINT "kids_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_quiz_questions" ADD CONSTRAINT "kids_quiz_questions_item_id_kids_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."kids_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_quiz_results" ADD CONSTRAINT "kids_quiz_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_quiz_results" ADD CONSTRAINT "kids_quiz_results_item_id_kids_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."kids_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_chapters" ADD CONSTRAINT "publication_chapters_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_saves" ADD CONSTRAINT "publication_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_saves" ADD CONSTRAINT "publication_saves_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_series" ADD CONSTRAINT "publication_series_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_series_id_publication_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."publication_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_follows" ADD CONSTRAINT "series_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_follows" ADD CONSTRAINT "series_follows_series_id_publication_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."publication_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kids_items_list_idx" ON "kids_items" USING btree ("kind","published_at") WHERE "kids_items"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "kids_quiz_questions_idx" ON "kids_quiz_questions" USING btree ("item_id","position");--> statement-breakpoint
CREATE INDEX "publication_chapters_idx" ON "publication_chapters" USING btree ("publication_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_series_slug_idx" ON "publication_series" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "publications_list_idx" ON "publications" USING btree ("status","published_at") WHERE "publications"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "publications_series_idx" ON "publications" USING btree ("series_id","published_at");--> statement-breakpoint
CREATE INDEX "publications_search_idx" ON "publications" USING gin (to_tsvector('simple', "title" || ' ' || coalesce("subtitle", '') || ' ' || "description"));--> statement-breakpoint
CREATE INDEX "reading_progress_user_idx" ON "reading_progress" USING btree ("user_id","updated_at");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;
