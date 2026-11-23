-- ===== 0000_foundation.sql =====
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== 0001_identity.sql =====
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

-- ===== 0002_profiles_settings.sql =====
CREATE TYPE "public"."text_size" AS ENUM('small', 'default', 'large', 'xlarge');--> statement-breakpoint
CREATE TABLE "backup_codes" (
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "backup_codes_user_id_code_hash_pk" PRIMARY KEY("user_id","code_hash")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"private_profile" boolean DEFAULT false NOT NULL,
	"visible_to_guests" boolean DEFAULT true NOT NULL,
	"text_size" text_size DEFAULT 'default' NOT NULL,
	"data_saver" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "follow_requests" (
	"requester_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_requests_requester_id_target_id_pk" PRIMARY KEY("requester_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_id" uuid NOT NULL,
	"followee_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_followee_id_pk" PRIMARY KEY("follower_id","followee_id")
);
--> statement-breakpoint
CREATE TABLE "mutes" (
	"muter_id" uuid NOT NULL,
	"muted_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mutes_muter_id_muted_id_pk" PRIMARY KEY("muter_id","muted_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "backup_codes" ADD CONSTRAINT "backup_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_requests" ADD CONSTRAINT "follow_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_requests" ADD CONSTRAINT "follow_requests_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followee_id_users_id_fk" FOREIGN KEY ("followee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mutes" ADD CONSTRAINT "mutes_muter_id_users_id_fk" FOREIGN KEY ("muter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mutes" ADD CONSTRAINT "mutes_muted_id_users_id_fk" FOREIGN KEY ("muted_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocks_blocked_idx" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "follow_requests_target_idx" ON "follow_requests" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "follows_followee_idx" ON "follows" USING btree ("followee_id");

-- ===== 0003_admin_core.sql =====
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

-- ===== 0004_home_feed.sql =====
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."reply_setting" AS ENUM('everyone', 'following', 'mentioned');--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_user_id_post_id_pk" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"favorite_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_favorite_id_pk" PRIMARY KEY("user_id","favorite_id")
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "likes_user_id_post_id_pk" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "pinned_posts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"post_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" smallint NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_votes_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"post_id" uuid PRIMARY KEY NOT NULL,
	"ends_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"body" text NOT NULL,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_hashtags" (
	"post_id" uuid NOT NULL,
	"tag" text NOT NULL,
	CONSTRAINT "post_hashtags_post_id_tag_pk" PRIMARY KEY("post_id","tag")
);
--> statement-breakpoint
CREATE TABLE "post_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"width" integer,
	"height" integer,
	"position" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_mentions" (
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "post_mentions_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"reply_to_id" uuid,
	"root_id" uuid,
	"quote_of_id" uuid,
	"reply_setting" "reply_setting" DEFAULT 'everyone' NOT NULL,
	"link_preview" jsonb,
	"is_draft" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"repost_count" integer DEFAULT 0 NOT NULL,
	"quote_count" integer DEFAULT 0 NOT NULL,
	"bookmark_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reposts" (
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reposts_user_id_post_id_pk" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_favorite_id_users_id_fk" FOREIGN KEY ("favorite_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinned_posts" ADD CONSTRAINT "pinned_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinned_posts" ADD CONSTRAINT "pinned_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_post_id_polls_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."polls"("post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_post_id_polls_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."polls"("post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_edits" ADD CONSTRAINT "post_edits_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_hashtags" ADD CONSTRAINT "post_hashtags_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_mentions" ADD CONSTRAINT "post_mentions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_mentions" ADD CONSTRAINT "post_mentions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_reply_to_id_posts_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_root_id_posts_id_fk" FOREIGN KEY ("root_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_quote_of_id_posts_id_fk" FOREIGN KEY ("quote_of_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reposts" ADD CONSTRAINT "reposts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reposts" ADD CONSTRAINT "reposts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookmarks_post_idx" ON "bookmarks" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "likes_post_idx" ON "likes" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "poll_options_post_idx" ON "poll_options" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_hashtags_tag_idx" ON "post_hashtags" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "post_media_post_idx" ON "post_media" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_mentions_user_idx" ON "post_mentions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_author_pub_idx" ON "posts" USING btree ("author_id","published_at");--> statement-breakpoint
CREATE INDEX "posts_pub_idx" ON "posts" USING btree ("published_at") WHERE "posts"."deleted_at" is null and "posts"."reply_to_id" is null;--> statement-breakpoint
CREATE INDEX "posts_reply_to_idx" ON "posts" USING btree ("reply_to_id");--> statement-breakpoint
CREATE INDEX "posts_quote_idx" ON "posts" USING btree ("quote_of_id");--> statement-breakpoint
CREATE INDEX "posts_body_search_idx" ON "posts" USING gin (to_tsvector('simple', "body"));--> statement-breakpoint
CREATE INDEX "reposts_post_idx" ON "reposts" USING btree ("post_id");

-- ===== 0005_discovery.sql =====
CREATE TYPE "public"."notification_type" AS ENUM('like', 'repost', 'reply', 'quote', 'mention', 'follow', 'follow_request', 'follow_accept', 'poll_ended');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'abuse', 'false_info', 'inappropriate', 'impersonation', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TABLE "bookmark_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "list_members" (
	"list_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_members_list_id_user_id_pk" PRIMARY KEY("list_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"actor_id" uuid,
	"post_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"post_id" uuid,
	"target_user_id" uuid,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"handled_by" uuid,
	"handled_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "bookmark_folders" ADD CONSTRAINT "bookmark_folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_members" ADD CONSTRAINT "list_members_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_members" ADD CONSTRAINT "list_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookmark_folders_user_idx" ON "bookmark_folders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lists_owner_idx" ON "lists" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id") WHERE read_at is null;--> statement-breakpoint
CREATE INDEX "push_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");

-- ===== 0006_community.sql =====
CREATE TYPE "public"."rsvp_status" AS ENUM('going', 'interested');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'announcement';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'event';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'event_reminder';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'event_cancelled';--> statement-breakpoint
CREATE TABLE "announcement_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"width" integer,
	"height" integer,
	"position" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"level" "level" NOT NULL,
	"district_id" uuid,
	"assembly_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"important" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assembly_profiles" (
	"assembly_id" uuid PRIMARY KEY NOT NULL,
	"about" text,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"phone" text,
	"email" text,
	"photo_url" text,
	"service_times" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"leaders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_rsvps" (
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "rsvp_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_rsvps_event_id_user_id_pk" PRIMARY KEY("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"level" "level" NOT NULL,
	"district_id" uuid,
	"assembly_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"venue" text,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"online_url" text,
	"cover_url" text,
	"going_count" integer DEFAULT 0 NOT NULL,
	"interested_count" integer DEFAULT 0 NOT NULL,
	"reminded_day_at" timestamp with time zone,
	"reminded_hour_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "level_subscriptions" (
	"user_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"on" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "level_subscriptions_user_id_scope_pk" PRIMARY KEY("user_id","scope")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "announcement_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "event_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "announcement_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "event_id" uuid;--> statement-breakpoint
ALTER TABLE "announcement_media" ADD CONSTRAINT "announcement_media_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_profiles" ADD CONSTRAINT "assembly_profiles_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_profiles" ADD CONSTRAINT "assembly_profiles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_subscriptions" ADD CONSTRAINT "level_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcement_media_idx" ON "announcement_media" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "announcements_level_idx" ON "announcements" USING btree ("level","created_at") WHERE "announcements"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "announcements_district_idx" ON "announcements" USING btree ("district_id","created_at");--> statement-breakpoint
CREATE INDEX "announcements_assembly_idx" ON "announcements" USING btree ("assembly_id","created_at");--> statement-breakpoint
CREATE INDEX "announcements_author_idx" ON "announcements" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE INDEX "announcements_search_idx" ON "announcements" USING gin (to_tsvector('simple', "title" || ' ' || "body"));--> statement-breakpoint
CREATE INDEX "event_rsvps_user_idx" ON "event_rsvps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "events_starts_idx" ON "events" USING btree ("starts_at") WHERE "events"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "events_district_idx" ON "events" USING btree ("district_id","starts_at");--> statement-breakpoint
CREATE INDEX "events_assembly_idx" ON "events" USING btree ("assembly_id","starts_at");--> statement-breakpoint
CREATE INDEX "events_author_idx" ON "events" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "level_subscriptions_scope_idx" ON "level_subscriptions" USING btree ("scope");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "posts" SET "notified_at" = "published_at" WHERE "published_at" IS NOT NULL AND "published_at" <= now() AND "is_draft" = false;

-- ===== 0007_devotion.sql =====
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

-- ===== 0008_messages.sql =====
CREATE TYPE "public"."conversation_kind" AS ENUM('direct', 'group');--> statement-breakpoint
CREATE TYPE "public"."conversation_role" AS ENUM('member', 'admin');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('text', 'image', 'video', 'audio', 'file', 'system');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'message';--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "conversation_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_read_at" timestamp with time zone,
	"last_delivered_at" timestamp with time zone,
	"muted_until" timestamp with time zone,
	"archived" boolean DEFAULT false NOT NULL,
	"pinned_at" timestamp with time zone,
	"cleared_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	CONSTRAINT "conversation_members_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "conversation_kind" NOT NULL,
	"direct_key" text,
	"title" text,
	"avatar_url" text,
	"created_by" uuid,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"kind" "message_kind" NOT NULL,
	"url" text NOT NULL,
	"name" text,
	"size" integer,
	"mime" text,
	"width" integer,
	"height" integer,
	"duration" integer
);
--> statement-breakpoint
CREATE TABLE "message_hidden" (
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "message_hidden_message_id_user_id_pk" PRIMARY KEY("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "message_reactions" (
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_reactions_message_id_user_id_pk" PRIMARY KEY("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid,
	"kind" "message_kind" DEFAULT 'text' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"reply_to_id" uuid,
	"forwarded" boolean DEFAULT false NOT NULL,
	"client_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "messages_from" text DEFAULT 'everyone' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "read_receipts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "show_last_seen" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_hidden" ADD CONSTRAINT "message_hidden_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_hidden" ADD CONSTRAINT "message_hidden_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_messages_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_members_user_idx" ON "conversation_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_direct_key_idx" ON "conversations" USING btree ("direct_key");--> statement-breakpoint
CREATE INDEX "conversations_last_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "message_attachments_msg_idx" ON "message_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_client_idx" ON "messages" USING btree ("sender_id","client_id");--> statement-breakpoint
CREATE INDEX "messages_search_idx" ON "messages" USING gin (to_tsvector('simple', "body"));

-- ===== 0009_groups.sql =====
CREATE TYPE "public"."group_visibility" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TABLE "group_join_requests" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_join_requests_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "visibility" "group_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "only_admins_send" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "only_admins_edit" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "members_can_add" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "approve_joins" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "invite_code" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_invite_idx" ON "conversations" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "conversations_public_idx" ON "conversations" USING btree ("visibility") WHERE "conversations"."kind" = 'group' and "conversations"."deleted_at" is null;

-- ===== 0010_calls.sql =====
CREATE TYPE "public"."call_media" AS ENUM('voice', 'video');--> statement-breakpoint
CREATE TYPE "public"."call_participant_state" AS ENUM('ringing', 'joined', 'left', 'declined', 'missed', 'busy');--> statement-breakpoint
CREATE TYPE "public"."call_result" AS ENUM('completed', 'missed', 'declined', 'busy', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('ringing', 'active', 'ended');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'call';--> statement-breakpoint
ALTER TYPE "public"."message_kind" ADD VALUE 'call';--> statement-breakpoint
CREATE TABLE "call_participants" (
	"call_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"state" "call_participant_state" DEFAULT 'ringing' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"joined_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	"last_ping_at" timestamp with time zone,
	CONSTRAINT "call_participants_call_id_user_id_pk" PRIMARY KEY("call_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"started_by" uuid,
	"media" "call_media" NOT NULL,
	"status" "call_status" DEFAULT 'ringing' NOT NULL,
	"result" "call_result",
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "calls_from" text DEFAULT 'everyone' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "calls_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "call_participants_user_idx" ON "call_participants" USING btree ("user_id","invited_at");--> statement-breakpoint
CREATE INDEX "calls_conversation_idx" ON "calls" USING btree ("conversation_id","started_at");--> statement-breakpoint
CREATE INDEX "calls_open_idx" ON "calls" USING btree ("status") WHERE "calls"."status" <> 'ended';

-- ===== 0011_library.sql =====
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

-- ===== 0012_live.sql =====
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

-- ===== 0013_payments.sql =====
CREATE TYPE "public"."payment_purpose" AS ENUM('offering', 'tithe', 'seed', 'thanksgiving', 'project', 'welfare', 'publication');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'success', 'failed', 'abandoned', 'refunded');--> statement-breakpoint
ALTER TYPE "public"."level_role" ADD VALUE 'treasurer';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'payment';--> statement-breakpoint
CREATE TABLE "funds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"level" "level" NOT NULL,
	"district_id" uuid,
	"assembly_id" uuid,
	"target_pesewas" integer,
	"ends_on" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"user_id" uuid,
	"purpose" "payment_purpose" NOT NULL,
	"amount_pesewas" integer NOT NULL,
	"currency" text DEFAULT 'GHS' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"channel" text,
	"level" "level" NOT NULL,
	"district_id" uuid,
	"assembly_id" uuid,
	"fund_id" uuid,
	"live_id" uuid,
	"publication_id" uuid,
	"note" text,
	"anonymous" boolean DEFAULT false NOT NULL,
	"provider_data" jsonb,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "payment_id" uuid;--> statement-breakpoint
ALTER TABLE "funds" ADD CONSTRAINT "funds_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funds" ADD CONSTRAINT "funds_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funds" ADD CONSTRAINT "funds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_live_id_lives_id_fk" FOREIGN KEY ("live_id") REFERENCES "public"."lives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_reference_idx" ON "payments" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_paid_idx" ON "payments" USING btree ("status","paid_at");--> statement-breakpoint
CREATE INDEX "payments_purchase_idx" ON "payments" USING btree ("user_id","publication_id") WHERE "payments"."status" = 'success';--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;

-- ===== 0014_resources.sql =====
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

-- ===== 0015_market.sql =====
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

-- ===== 0016_market_sellers.sql =====
ALTER TYPE "public"."notification_type" ADD VALUE 'market_new';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "payout_method" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "payout_provider" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "payout_number" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "payout_name" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
UPDATE "products" SET "published_at" = "created_at" WHERE "status" = 'active';--> statement-breakpoint
UPDATE "shops" SET "terms_accepted_at" = "created_at";

-- ===== 0017_riders_payouts.sql =====
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

-- ===== 0018_auth_identity_rls.sql =====
-- Supabase migration 0018: link application members to auth.users.
-- Apply after 0000_foundation.sql through 0017_riders_payouts.sql.
-- This migration does not delete or rewrite existing users.

alter table public.users
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create index if not exists users_auth_user_id_idx on public.users (auth_user_id);

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id
  from public.users u
  where u.auth_user_id = (select auth.uid())
    and u.status = 'active'
  limit 1
$$;

create or replace function public.is_tech_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.users u
    where u.id = public.current_member_id()
      and u.role = 'tech_admin'
      and u.status = 'active'
  )
$$;

revoke all on function public.current_member_id() from public;
revoke all on function public.is_tech_admin() from public;
grant execute on function public.current_member_id() to anon, authenticated;
grant execute on function public.is_tech_admin() to authenticated;

alter table public.users enable row level security;
alter table public.church_members enable row level security;
alter table public.user_preferences enable row level security;
alter table public.sessions enable row level security;
alter table public.verification_codes enable row level security;
alter table public.backup_codes enable row level security;
alter table public.rate_limits enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists users_select_self_or_admin on public.users;
create policy users_select_self_or_admin on public.users
  for select to authenticated
  using (id = public.current_member_id() or public.is_tech_admin());

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using (id = public.current_member_id())
  with check (id = public.current_member_id());

drop policy if exists church_members_select_authorized on public.church_members;
create policy church_members_select_authorized on public.church_members
  for select to authenticated
  using (
    church_id = (select u.church_id from public.users u where u.id = public.current_member_id())
    or public.is_tech_admin()
  );

drop policy if exists church_members_admin_write on public.church_members;
create policy church_members_admin_write on public.church_members
  for all to authenticated
  using (public.is_tech_admin())
  with check (public.is_tech_admin());

drop policy if exists user_preferences_owner on public.user_preferences;
create policy user_preferences_owner on public.user_preferences
  for all to authenticated
  using (user_id = public.current_member_id())
  with check (user_id = public.current_member_id());

drop policy if exists sessions_owner on public.sessions;
create policy sessions_owner on public.sessions
  for select to authenticated
  using (user_id = public.current_member_id());

drop policy if exists sessions_owner_delete on public.sessions;
create policy sessions_owner_delete on public.sessions
  for delete to authenticated
  using (user_id = public.current_member_id());

drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read on public.audit_log
  for select to authenticated
  using (public.is_tech_admin());

-- Verification codes, backup codes, and rate limits are server-only tables.
-- RLS is enabled deliberately without client policies; service-role operations bypass RLS.

insert into storage.buckets (id, name, public)
values ('papa-media', 'papa-media', false)
on conflict (id) do update set public = false;

drop policy if exists papa_media_read_own on storage.objects;
create policy papa_media_read_own on storage.objects
	for select to authenticated
	using (bucket_id = 'papa-media' and owner_id = (select auth.uid()::text));

drop policy if exists papa_media_upload_own on storage.objects;
create policy papa_media_upload_own on storage.objects
	for insert to authenticated
	with check (bucket_id = 'papa-media' and owner_id = (select auth.uid()::text));

drop policy if exists papa_media_update_own on storage.objects;
create policy papa_media_update_own on storage.objects
	for update to authenticated
	using (bucket_id = 'papa-media' and owner_id = (select auth.uid()::text))
	with check (bucket_id = 'papa-media' and owner_id = (select auth.uid()::text));

drop policy if exists papa_media_delete_own on storage.objects;
create policy papa_media_delete_own on storage.objects
	for delete to authenticated
	using (bucket_id = 'papa-media' and owner_id = (select auth.uid()::text));

-- ===== 0019_post_hydration_rpc.sql =====
create or replace function public.papa_hydrate_posts(
	post_ids uuid[], viewer_id uuid default null, include_deleted boolean default false
)
returns table (
	id uuid, body text, created_at timestamptz, published_at timestamptz, edited_at timestamptz, deleted_at timestamptz,
	reply_to_id uuid, quote_of_id uuid, reply_setting text, link_preview jsonb,
	reply_count integer, like_count integer, repost_count integer, quote_count integer, bookmark_count integer, view_count integer,
	author_id uuid, username text, full_name text, avatar_url text, verified boolean, assembly_name text,
	reply_to_username text, pinned boolean
)
language sql stable security definer set search_path = public
as $$
	select p.id, p.body, p.created_at, p.published_at, p.edited_at, p.deleted_at, p.reply_to_id, p.quote_of_id,
		p.reply_setting::text, p.link_preview, p.reply_count, p.like_count, p.repost_count, p.quote_count, p.bookmark_count, p.view_count,
		u.id, u.username, u.full_name, u.avatar_url, (u.verified_at is not null), a.name, ru.username,
		exists (select 1 from pinned_posts pp where pp.post_id = p.id)
	from posts p join users u on u.id = p.author_id left join user_preferences pr on pr.user_id = p.author_id
		join assemblies a on a.id = u.assembly_id left join posts rp on rp.id = p.reply_to_id left join users ru on ru.id = rp.author_id
	where p.id = any(post_ids) and (
		(p.deleted_at is null and p.is_draft = false and p.published_at <= now() and u.status = 'active' and (
			(viewer_id is null and coalesce(pr.private_profile, false) = false and coalesce(pr.visible_to_guests, true) = true)
			or (viewer_id is not null and not exists (select 1 from blocks b where (b.blocker_id = viewer_id and b.blocked_id = p.author_id) or (b.blocker_id = p.author_id and b.blocked_id = viewer_id))
				and (coalesce(pr.private_profile, false) = false or p.author_id = viewer_id or exists (select 1 from follows f where f.follower_id = viewer_id and f.followee_id = p.author_id)))
		)) or (include_deleted and p.deleted_at is not null and p.is_draft = false)
	)
$$;
revoke all on function public.papa_hydrate_posts(uuid[], uuid, boolean) from public, anon, authenticated;
grant execute on function public.papa_hydrate_posts(uuid[], uuid, boolean) to service_role;

-- ===== 0020_post_compose_rpc.sql =====
create or replace function public.papa_create_post(
	p_author_id uuid, p_body text, p_reply_to_id uuid default null, p_root_id uuid default null, p_quote_of_id uuid default null,
	p_reply_setting text default 'everyone', p_link_preview jsonb default null, p_is_draft boolean default false,
	p_published_at timestamptz default null, p_notified_at timestamptz default null, p_media jsonb default '[]'::jsonb,
	p_poll_options text[] default null, p_poll_ends_at timestamptz default null, p_tags text[] default '{}', p_mention_ids uuid[] default '{}'
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_id uuid;
begin
	insert into posts (author_id, body, reply_to_id, root_id, quote_of_id, reply_setting, link_preview, is_draft, published_at, notified_at)
	values (p_author_id, p_body, p_reply_to_id, p_root_id, p_quote_of_id, p_reply_setting::reply_setting, p_link_preview, p_is_draft, p_published_at, p_notified_at)
	returning id into new_id;
	insert into post_media (post_id, kind, url, alt, width, height, position)
	select new_id, x.kind::media_kind, x.url, nullif(x.alt, ''), x.width, x.height, x.position
	from jsonb_to_recordset(p_media) as x(kind text, url text, alt text, width integer, height integer, position smallint);
	if p_poll_options is not null and cardinality(p_poll_options) > 0 then
		insert into polls (post_id, ends_at) values (new_id, p_poll_ends_at);
		insert into poll_options (post_id, label, position) select new_id, value, ordinality::smallint from unnest(p_poll_options) with ordinality;
	end if;
	insert into post_hashtags (post_id, tag) select new_id, value from unnest(p_tags) as value on conflict do nothing;
	insert into post_mentions (post_id, user_id) select new_id, value from unnest(p_mention_ids) as value on conflict do nothing;
	if not p_is_draft and p_published_at is not null and p_published_at <= now() and p_reply_to_id is not null then update posts set reply_count = reply_count + 1 where id = p_reply_to_id; end if;
	if not p_is_draft and p_published_at is not null and p_published_at <= now() and p_quote_of_id is not null then update posts set quote_count = quote_count + 1 where id = p_quote_of_id; end if;
	return new_id;
end;
$$;
revoke all on function public.papa_create_post(uuid, text, uuid, uuid, uuid, text, jsonb, boolean, timestamptz, timestamptz, jsonb, text[], timestamptz, text[], uuid[]) from public, anon, authenticated;
grant execute on function public.papa_create_post(uuid, text, uuid, uuid, uuid, text, jsonb, boolean, timestamptz, timestamptz, jsonb, text[], timestamptz, text[], uuid[]) to service_role;

-- ===== 0021_messages_groups_rpc.sql =====
create or replace function public.papa_direct_chat(p_me uuid, p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare conversation_id uuid;
declare direct_key_value text := array_to_string(array(select x::text from unnest(array[p_me, p_other]::uuid[]) x order by x), ':');
begin
	select id into conversation_id from conversations where conversations.direct_key = direct_key_value;
	if conversation_id is not null then
		update conversation_members set left_at = null where conversation_members.conversation_id = papa_direct_chat.conversation_id and user_id = p_me;
		return conversation_id;
	end if;
	insert into conversations (kind, direct_key, created_by) values ('direct', direct_key_value, p_me)
		on conflict (direct_key) do update set direct_key = excluded.direct_key returning id into conversation_id;
	insert into conversation_members (conversation_id, user_id) values (conversation_id, p_me), (conversation_id, p_other)
		on conflict (conversation_id, user_id) do nothing;
	return conversation_id;
end;
$$;

create or replace function public.papa_send_message(
	p_conversation_id uuid, p_sender_id uuid, p_kind text, p_body text,
	p_reply_to_id uuid default null, p_forwarded boolean default false,
	p_client_id text default null, p_attachments jsonb default '[]'::jsonb
)
returns table (id uuid, conversation_id uuid, sender_id uuid, kind message_kind, body text,
	reply_to_id uuid, forwarded boolean, client_id text, created_at timestamptz,
	edited_at timestamptz, deleted_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare message_id uuid;
begin
	if p_client_id is not null then
		select m.id into message_id from messages m where m.sender_id = p_sender_id and m.client_id = left(p_client_id, 64);
		if message_id is not null then
			return query select m.id, m.conversation_id, m.sender_id, m.kind, m.body, m.reply_to_id, m.forwarded, m.client_id, m.created_at, m.edited_at, m.deleted_at from messages m where m.id = message_id;
			return;
		end if;
	end if;
	insert into messages (conversation_id, sender_id, kind, body, reply_to_id, forwarded, client_id)
		values (p_conversation_id, p_sender_id, p_kind::message_kind, p_body, p_reply_to_id, p_forwarded, left(p_client_id, 64)) returning messages.id into message_id;
	insert into message_attachments (message_id, kind, url, name, size, mime, width, height, duration)
		select message_id, x.kind::message_kind, x.url, nullif(x.name, ''), x.size, nullif(x.mime, ''), x.width, x.height, x.duration
		from jsonb_to_recordset(coalesce(p_attachments, '[]'::jsonb)) as x(kind text, url text, name text, size integer, mime text, width integer, height integer, duration integer);
	update conversations set last_message_at = now() where conversations.id = p_conversation_id;
	update conversation_members set last_read_at = now(), last_delivered_at = now() where conversation_id = p_conversation_id and user_id = p_sender_id;
	update conversation_members set archived = false where conversation_id = p_conversation_id and left_at is null;
	return query select m.id, m.conversation_id, m.sender_id, m.kind, m.body, m.reply_to_id, m.forwarded, m.client_id, m.created_at, m.edited_at, m.deleted_at from messages m where m.id = message_id;
end;
$$;

create or replace function public.papa_create_group(
	p_creator_id uuid, p_title text, p_description text, p_avatar_url text,
	p_visibility text, p_invite_code text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare conversation_id uuid;
begin
	insert into conversations (kind, title, description, avatar_url, visibility, created_by, invite_code)
		values ('group', p_title, p_description, p_avatar_url, p_visibility::group_visibility, p_creator_id, p_invite_code) returning id into conversation_id;
	insert into conversation_members (conversation_id, user_id, role) values (conversation_id, p_creator_id, 'admin');
	return conversation_id;
end;
$$;

create or replace function public.papa_group_upsert_member(p_conversation_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
	insert into conversation_members (conversation_id, user_id, cleared_at, role, joined_at, last_read_at)
		values (p_conversation_id, p_user_id, now(), 'member', now(), null)
		on conflict (conversation_id, user_id) do update set left_at = null, joined_at = now(), role = 'member', cleared_at = now(), last_read_at = null;
	delete from group_join_requests where conversation_id = p_conversation_id and user_id = p_user_id;
	return true;
end;
$$;

revoke all on function public.papa_direct_chat(uuid, uuid) from public, anon, authenticated;
revoke all on function public.papa_send_message(uuid, uuid, text, text, uuid, boolean, text, jsonb) from public, anon, authenticated;
revoke all on function public.papa_create_group(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.papa_group_upsert_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.papa_direct_chat(uuid, uuid) to service_role;
grant execute on function public.papa_send_message(uuid, uuid, text, text, uuid, boolean, text, jsonb) to service_role;
grant execute on function public.papa_create_group(uuid, text, text, text, text, text) to service_role;
grant execute on function public.papa_group_upsert_member(uuid, uuid) to service_role;

-- ===== 0022_library_publication_rpc.sql =====
create or replace function public.papa_save_publication(
	p_publication_id uuid, p_created_by uuid, p_data jsonb, p_chapters jsonb default '[]'::jsonb
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare saved_id uuid;
begin
	if p_publication_id is null then
		insert into publications (kind, format, title, subtitle, description, author, series_id, edition, language, level, district_id, assembly_id, cover_url, file_url, preview_url, page_count, preview_pages, price_pesewas, status, publish_at, updated_at, created_by)
		values ((p_data->>'kind')::publication_kind, (p_data->>'format')::publication_format, p_data->>'title', nullif(p_data->>'subtitle', ''), coalesce(p_data->>'description', ''), nullif(p_data->>'author', ''), nullif(p_data->>'seriesId', '')::uuid, nullif(p_data->>'edition', ''), coalesce(p_data->>'language', 'en'), (p_data->>'level')::level, nullif(p_data->>'districtId', '')::uuid, nullif(p_data->>'assemblyId', '')::uuid, nullif(p_data->>'coverUrl', ''), nullif(p_data->>'fileUrl', ''), nullif(p_data->>'previewUrl', ''), (p_data->>'pageCount')::integer, (p_data->>'previewPages')::smallint, (p_data->>'pricePesewas')::integer, (p_data->>'status')::content_status, nullif(p_data->>'publish_at', '')::timestamptz, (p_data->>'updated_at')::timestamptz, p_created_by)
		returning id into saved_id;
	else
		update publications set kind = (p_data->>'kind')::publication_kind, format = (p_data->>'format')::publication_format, title = p_data->>'title', subtitle = nullif(p_data->>'subtitle', ''), description = coalesce(p_data->>'description', ''), author = nullif(p_data->>'author', ''), series_id = nullif(p_data->>'seriesId', '')::uuid, edition = nullif(p_data->>'edition', ''), language = coalesce(p_data->>'language', 'en'), level = (p_data->>'level')::level, district_id = nullif(p_data->>'districtId', '')::uuid, assembly_id = nullif(p_data->>'assemblyId', '')::uuid, cover_url = nullif(p_data->>'coverUrl', ''), file_url = nullif(p_data->>'fileUrl', ''), preview_url = nullif(p_data->>'previewUrl', ''), page_count = (p_data->>'pageCount')::integer, preview_pages = (p_data->>'previewPages')::smallint, price_pesewas = (p_data->>'pricePesewas')::integer, status = (p_data->>'status')::content_status, publish_at = nullif(p_data->>'publish_at', '')::timestamptz, updated_at = (p_data->>'updated_at')::timestamptz where id = p_publication_id and deleted_at is null returning id into saved_id;
		if saved_id is null then raise exception 'publication_not_found'; end if;
	end if;
	if (p_data->>'format') = 'article' then
		delete from publication_chapters where publication_id = saved_id;
		insert into publication_chapters (publication_id, position, title, body) select saved_id, x.position, x.title, x.body from jsonb_to_recordset(p_chapters) as x(position smallint, title text, body text);
	end if;
	return saved_id;
end;
$$;
create or replace function public.papa_save_kids_item(p_item_id uuid, p_created_by uuid, p_data jsonb, p_questions jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare saved_id uuid;
begin
	if p_item_id is null then
		insert into kids_items (kind, age_group, title, summary, body, bible_ref, cover_url, audio_url, video_url, file_url, week_of, level, district_id, assembly_id, status, published_at, updated_at, created_by)
		values ((p_data->>'kind')::kids_kind, (p_data->>'ageGroup')::age_group, p_data->>'title', nullif(p_data->>'summary', ''), coalesce(p_data->>'body', ''), nullif(p_data->>'bibleRef', ''), nullif(p_data->>'coverUrl', ''), nullif(p_data->>'audioUrl', ''), nullif(p_data->>'videoUrl', ''), nullif(p_data->>'fileUrl', ''), nullif(p_data->>'weekOf', '')::date, (p_data->>'level')::level, nullif(p_data->>'districtId', '')::uuid, nullif(p_data->>'assemblyId', '')::uuid, (p_data->>'status')::content_status, nullif(p_data->>'published_at', '')::timestamptz, (p_data->>'updated_at')::timestamptz, p_created_by)
		returning id into saved_id;
	else
		update kids_items set kind = (p_data->>'kind')::kids_kind, age_group = (p_data->>'ageGroup')::age_group, title = p_data->>'title', summary = nullif(p_data->>'summary', ''), body = coalesce(p_data->>'body', ''), bible_ref = nullif(p_data->>'bibleRef', ''), cover_url = nullif(p_data->>'coverUrl', ''), audio_url = nullif(p_data->>'audioUrl', ''), video_url = nullif(p_data->>'videoUrl', ''), file_url = nullif(p_data->>'fileUrl', ''), week_of = nullif(p_data->>'weekOf', '')::date, level = (p_data->>'level')::level, district_id = nullif(p_data->>'districtId', '')::uuid, assembly_id = nullif(p_data->>'assemblyId', '')::uuid, status = (p_data->>'status')::content_status, published_at = nullif(p_data->>'published_at', '')::timestamptz, updated_at = (p_data->>'updated_at')::timestamptz where id = p_item_id and deleted_at is null returning id into saved_id;
		if saved_id is null then raise exception 'kids_item_not_found'; end if;
	end if;
	delete from kids_quiz_questions where item_id = saved_id;
	insert into kids_quiz_questions (item_id, position, question, options, answer, explain) select saved_id, x.position, x.question, x.options, x.answer, nullif(x.explain, '') from jsonb_to_recordset(case when (p_data->>'kind') = 'quiz' then p_questions else '[]'::jsonb end) as x(position smallint, question text, options jsonb, answer smallint, explain text);
	return saved_id;
end;
$$;
revoke all on function public.papa_save_publication(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.papa_save_kids_item(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.papa_save_publication(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.papa_save_kids_item(uuid, uuid, jsonb, jsonb) to service_role;

-- ===== 0023_library_publication_mutations_rpc.sql =====
create or replace function public.papa_create_publication_series(
	p_name text, p_slug text, p_kind publication_kind, p_created_by uuid
)
returns uuid language plpgsql security definer set search_path = public as $$
declare saved_id uuid;
begin
	insert into publication_series (name, slug, kind, created_by)
	values (p_name, p_slug, p_kind, p_created_by)
	returning id into saved_id;
	return saved_id;
end;
$$;

create or replace function public.papa_release_publication(p_publication_id uuid)
returns table (id uuid, series_id uuid, created_by uuid)
language sql security definer set search_path = public as $$
	update publications
	set status = 'published', published_at = coalesce(published_at, now()), publish_at = null
	where publications.id = p_publication_id
	returning publications.id, publications.series_id, publications.created_by
$$;

create or replace function public.papa_delete_publication(p_publication_id uuid)
returns boolean language sql security definer set search_path = public as $$
	with deleted as (
		update publications set deleted_at = now()
		where id = p_publication_id and deleted_at is null
		returning 1
	)
	select exists (select 1 from deleted)
$$;

create or replace function public.papa_save_publication_progress(
	p_user_id uuid, p_publication_id uuid, p_position integer, p_percent smallint
)
returns void language plpgsql security definer set search_path = public as $$
declare inserted_count integer;
begin
	insert into reading_progress (user_id, publication_id, position, percent)
	values (p_user_id, p_publication_id, p_position, p_percent)
	on conflict (user_id, publication_id) do nothing;
	get diagnostics inserted_count = row_count;
	if inserted_count = 1 then
		update publications set read_count = read_count + 1 where id = p_publication_id;
	else
		update reading_progress
		set position = p_position, percent = p_percent, updated_at = now()
		where user_id = p_user_id and publication_id = p_publication_id;
	end if;
end;
$$;

create or replace function public.papa_set_publication_saved(
	p_user_id uuid, p_publication_id uuid, p_on boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
	if p_on then
		insert into publication_saves (user_id, publication_id)
		values (p_user_id, p_publication_id) on conflict do nothing;
	else
		delete from publication_saves where user_id = p_user_id and publication_id = p_publication_id;
	end if;
end;
$$;

create or replace function public.papa_set_series_follow(
	p_user_id uuid, p_series_id uuid, p_on boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
	if p_on then
		insert into series_follows (user_id, series_id)
		values (p_user_id, p_series_id) on conflict do nothing;
	else
		delete from series_follows where user_id = p_user_id and series_id = p_series_id;
	end if;
end;
$$;

revoke all on function public.papa_create_publication_series(text, text, publication_kind, uuid) from public, anon, authenticated;
revoke all on function public.papa_release_publication(uuid) from public, anon, authenticated;
revoke all on function public.papa_delete_publication(uuid) from public, anon, authenticated;
revoke all on function public.papa_save_publication_progress(uuid, uuid, integer, smallint) from public, anon, authenticated;
revoke all on function public.papa_set_publication_saved(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.papa_set_series_follow(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.papa_create_publication_series(text, text, publication_kind, uuid) to service_role;
grant execute on function public.papa_release_publication(uuid) to service_role;
grant execute on function public.papa_delete_publication(uuid) to service_role;
grant execute on function public.papa_save_publication_progress(uuid, uuid, integer, smallint) to service_role;
grant execute on function public.papa_set_publication_saved(uuid, uuid, boolean) to service_role;
grant execute on function public.papa_set_series_follow(uuid, uuid, boolean) to service_role;

-- ===== 0024_payments_transaction_rpc.sql =====
create or replace function public.papa_create_payment(
	p_user_id uuid, p_reference text, p_purpose payment_purpose, p_amount_pesewas integer,
	p_currency text, p_provider text, p_level level, p_district_id uuid default null,
	p_assembly_id uuid default null, p_fund_id uuid default null, p_live_id uuid default null,
	p_publication_id uuid default null, p_resource_order_id uuid default null,
	p_market_checkout_id uuid default null, p_note text default null, p_anonymous boolean default false
)
returns uuid language sql security definer set search_path = public as $$
	insert into payments (user_id, reference, purpose, amount_pesewas, currency, provider, level, district_id, assembly_id,
		fund_id, live_id, publication_id, resource_order_id, market_checkout_id, note, anonymous)
	values (p_user_id, p_reference, p_purpose, p_amount_pesewas, p_currency, p_provider, p_level, p_district_id, p_assembly_id,
		p_fund_id, p_live_id, p_publication_id, p_resource_order_id, p_market_checkout_id, p_note, p_anonymous)
	returning id
$$;

create or replace function public.papa_set_payment_status(
	p_payment_id uuid, p_expected_status payment_status, p_status payment_status,
	p_channel text default null, p_paid_at timestamptz default null, p_provider_data jsonb default null
)
returns table (id uuid, resource_order_id uuid, market_checkout_id uuid)
language sql security definer set search_path = public as $$
	update payments
	set status = p_status, channel = p_channel, paid_at = p_paid_at, provider_data = p_provider_data
	where payments.id = p_payment_id and payments.status = p_expected_status
	returning payments.id, payments.resource_order_id, payments.market_checkout_id
$$;

revoke all on function public.papa_create_payment(uuid, text, payment_purpose, integer, text, text, level, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.papa_set_payment_status(uuid, payment_status, payment_status, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.papa_create_payment(uuid, text, payment_purpose, integer, text, text, level, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, boolean) to service_role;
grant execute on function public.papa_set_payment_status(uuid, payment_status, payment_status, text, timestamptz, jsonb) to service_role;

-- ===== 0025_market_transaction_rpc.sql =====
-- Supabase migration 0025: Market order state mutations.
create or replace function public.papa_market_cancel_order(p_order_id uuid, p_by text, p_actor_id uuid, p_reason text)
returns table (id uuid, buyer_id uuid, seller_id uuid, coupon_id uuid, total_pesewas integer, refunded_pesewas integer, checkout_id uuid)
language plpgsql security definer set search_path = public as $$
begin
	update market_orders set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason where id = p_order_id and status in ('paid', 'accepted', 'packed', 'shipped');
	if not found then return; end if;
	insert into market_order_events (order_id, kind, actor_id, note) values (p_order_id, 'cancelled_by_' || p_by, p_actor_id, p_reason);
	update deliveries set status = 'cancelled', cancelled_at = now() where order_id = p_order_id and status in ('open', 'accepted', 'picked_up');
	update market_orders set rider_fee_pesewas = 0 where id = p_order_id;
	update product_variants v set stock = v.stock + i.qty from market_order_items i where i.order_id = p_order_id and i.variant_id = v.id;
	update coupons c set used_count = greatest(c.used_count - 1, 0) from market_orders o where o.id = p_order_id and o.coupon_id = c.id;
	update products p set sold_count = greatest(p.sold_count - i.qty, 0) from (select product_id, sum(qty)::int qty from market_order_items where order_id = p_order_id group by 1) i where p.id = i.product_id;
	return query select o.id, o.buyer_id, o.seller_id, o.coupon_id, o.total_pesewas, o.refunded_pesewas, o.checkout_id from market_orders o where o.id = p_order_id;
end; $$;
create or replace function public.papa_market_apply_refund(p_order_id uuid, p_amount integer, p_fee integer, p_seller_net integer)
returns table (id uuid, buyer_id uuid, checkout_id uuid, refunded_pesewas integer, total_pesewas integer)
language sql security definer set search_path = public as $$
	update market_orders set refunded_pesewas = refunded_pesewas + p_amount, fee_pesewas = p_fee, seller_net_pesewas = greatest(0, p_seller_net), escrow = case when refunded_pesewas + p_amount = total_pesewas then 'refunded' else escrow end
	where id = p_order_id and paid_at is not null and escrow <> 'released' and p_amount > 0 and p_amount <= total_pesewas - refunded_pesewas
	returning market_orders.id, market_orders.buyer_id, market_orders.checkout_id, market_orders.refunded_pesewas, market_orders.total_pesewas
$$;
revoke all on function public.papa_market_cancel_order(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.papa_market_apply_refund(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.papa_market_cancel_order(uuid, text, uuid, text) to service_role;
grant execute on function public.papa_market_apply_refund(uuid, integer, integer, integer) to service_role;

-- ===== 0026_chat_notifications_rpc.sql =====
-- Supabase migration 0026: read-heavy chat/group queries and notification persistence.
-- The server keeps the Drizzle branches for non-Supabase deployments.

create or replace function public.papa_list_chats(p_user_id uuid, p_filter text default 'all', p_query text default null)
returns table (
  id uuid, kind conversation_kind, title text, avatar_url text, last_at timestamptz, pinned_at timestamptz,
  archived boolean, muted boolean, o_id uuid, o_username text, o_name text, o_avatar text, o_verified boolean,
  o_seen timestamptz, o_show_seen boolean, o_read timestamptz, o_delivered timestamptz, o_receipts boolean,
  my_receipts boolean, m_body text, m_kind message_kind, m_sender uuid, m_sender_name text, m_deleted boolean,
  m_at timestamptz, unread integer
)
language sql security definer set search_path = public as $$
  select c.id, c.kind, c.title, c.avatar_url, c.last_message_at, me.pinned_at, me.archived,
    (me.muted_until is not null and me.muted_until > now()),
    o.id, o.username, o.full_name, o.avatar_url, o.verified_at is not null,
    o.last_seen_at, coalesce(op.show_last_seen, true), om.last_read_at, om.last_delivered_at,
    coalesce(op.read_receipts, true), coalesce(mp.read_receipts, true),
    lm.body, lm.kind, lm.sender_id, ls.full_name, lm.deleted_at is not null, lm.created_at,
    (select count(*)::int from messages x where x.conversation_id = c.id and x.sender_id is distinct from p_user_id
      and x.deleted_at is null and x.kind <> 'system'
      and x.created_at > coalesce(me.last_read_at, me.joined_at - interval '1 second')
      and x.created_at > coalesce(me.cleared_at, 'epoch'))
  from conversation_members me
  join conversations c on c.id = me.conversation_id
  left join conversation_members om on c.kind = 'direct' and om.conversation_id = c.id and om.user_id <> p_user_id
  left join users o on o.id = om.user_id
  left join user_preferences op on op.user_id = o.id
  left join user_preferences mp on mp.user_id = p_user_id
  left join lateral (select * from messages m where m.conversation_id = c.id and m.created_at > coalesce(me.cleared_at, 'epoch')
    and not exists (select 1 from message_hidden h where h.message_id = m.id and h.user_id = p_user_id)
    order by m.created_at desc limit 1) lm on true
  left join users ls on ls.id = lm.sender_id
  where me.user_id = p_user_id and me.left_at is null and c.deleted_at is null
    and (c.kind = 'group' or om.user_id is not null)
    and (c.last_message_at is not null or c.kind = 'group' or c.created_by = p_user_id)
    and (p_filter = 'archived' and me.archived or p_filter <> 'archived' and not me.archived)
    and (p_query is null or coalesce(c.title, o.full_name) ilike '%' || replace(replace(p_query, '%', ''), '_', '') || '%'
      or o.username ilike '%' || replace(replace(p_query, '%', ''), '_', '') || '%')
  order by me.pinned_at desc nulls last, coalesce(c.last_message_at, c.created_at) desc
  limit 200
$$;

create or replace function public.papa_unread_chats(p_user_id uuid)
returns integer language sql security definer set search_path = public as $$
  select count(*)::int from conversation_members me
  where me.user_id = p_user_id and me.left_at is null and not me.archived
    and (me.muted_until is null or me.muted_until < now())
    and exists (select 1 from messages x where x.conversation_id = me.conversation_id
      and x.sender_id is distinct from p_user_id and x.deleted_at is null and x.kind <> 'system'
      and x.created_at > coalesce(me.last_read_at, me.joined_at - interval '1 second')
      and x.created_at > coalesce(me.cleared_at, 'epoch'))
$$;

create or replace function public.papa_list_message_rows(p_conversation_id uuid, p_user_id uuid, p_before uuid default null, p_after uuid default null)
returns table (id uuid, conversation_id uuid, sender_id uuid, kind message_kind, body text, reply_to_id uuid, forwarded boolean,
  client_id text, created_at timestamptz, edited_at timestamptz, deleted_at timestamptz)
language sql security definer set search_path = public as $$
  select m.id, m.conversation_id, m.sender_id, m.kind, m.body, m.reply_to_id, m.forwarded, m.client_id, m.created_at, m.edited_at, m.deleted_at
  from messages m join conversation_members me on me.conversation_id = m.conversation_id and me.user_id = p_user_id and me.left_at is null
  where m.conversation_id = p_conversation_id and m.created_at > coalesce(me.cleared_at, 'epoch')
    and m.created_at >= me.joined_at - interval '1 second'
    and not exists (select 1 from message_hidden h where h.message_id = m.id and h.user_id = p_user_id)
    and (p_after is null or (m.created_at, m.id) > (select x.created_at, x.id from messages x where x.id = p_after and x.conversation_id = p_conversation_id))
    and (p_before is null or (m.created_at, m.id) < (select x.created_at, x.id from messages x where x.id = p_before and x.conversation_id = p_conversation_id))
  order by case when p_after is null then m.created_at end desc, case when p_after is null then m.id end desc,
    case when p_after is not null then m.created_at end asc, case when p_after is not null then m.id end asc
  limit 201
$$;

create or replace function public.papa_group_members(p_conversation_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'username', u.username, 'fullName', u.full_name,
    'avatarUrl', u.avatar_url, 'verified', u.verified_at is not null, 'role', cm.role, 'assemblyName', a.name)
    order by (cm.role = 'admin') desc, u.full_name), '[]'::jsonb)
  from conversation_members cm join users u on u.id = cm.user_id join assemblies a on a.id = u.assembly_id
  where cm.conversation_id = p_conversation_id and cm.left_at is null
$$;

create or replace function public.papa_group_requests(p_conversation_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'username', u.username, 'fullName', u.full_name,
    'avatarUrl', u.avatar_url, 'assemblyName', a.name) order by r.created_at), '[]'::jsonb)
  from group_join_requests r join users u on u.id = r.user_id join assemblies a on a.id = u.assembly_id
  where r.conversation_id = p_conversation_id
$$;

create or replace function public.papa_discover_groups(p_viewer_id uuid, p_query text, p_page integer default 1)
returns table (id uuid, title text, description text, avatar_url text, members integer, approve_joins boolean, member boolean, requested boolean)
language sql security definer set search_path = public as $$
  select c.id, c.title, c.description, c.avatar_url, (select count(*)::int from conversation_members m where m.conversation_id = c.id and m.left_at is null), c.approve_joins,
    case when p_viewer_id is null then false else exists (select 1 from conversation_members m where m.conversation_id = c.id and m.user_id = p_viewer_id and m.left_at is null) end,
    case when p_viewer_id is null then false else exists (select 1 from group_join_requests r where r.conversation_id = c.id and r.user_id = p_viewer_id) end
  from conversations c where c.kind = 'group' and c.visibility = 'public' and c.deleted_at is null
    and (p_query is null or c.title ilike '%' || replace(replace(p_query, '%', ''), '_', '') || '%' or c.description ilike '%' || replace(replace(p_query, '%', ''), '_', '') || '%')
  order by coalesce(c.last_message_at, c.created_at) desc limit 21 offset greatest(p_page - 1, 0) * 20
$$;

create or replace function public.papa_my_groups(p_user_id uuid)
returns table (id uuid, title text, avatar_url text, description text, members integer, role conversation_role)
language sql security definer set search_path = public as $$
  select c.id, c.title, c.avatar_url, c.description,
    (select count(*)::int from conversation_members m where m.conversation_id = c.id and m.left_at is null), cm.role
  from conversation_members cm join conversations c on c.id = cm.conversation_id
  where cm.user_id = p_user_id and cm.left_at is null and c.kind = 'group' and c.deleted_at is null
  order by c.last_message_at desc nulls last
$$;

create or replace function public.papa_notification_prefs(p_user_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(prefs, '{}'::jsonb) from notification_settings where user_id = p_user_id
$$;

create or replace function public.papa_persist_notification(p_user_id uuid, p_type notification_type, p_actor_id uuid, p_post_id uuid,
  p_announcement_id uuid, p_event_id uuid, p_prayer_id uuid, p_testimony_id uuid, p_publication_id uuid, p_live_id uuid,
  p_payment_id uuid, p_resource_order_id uuid, p_market_order_id uuid, p_product_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare existing_id uuid;
begin
  select n.id into existing_id from notifications n where n.user_id = p_user_id and n.type = p_type
    and n.actor_id is not distinct from p_actor_id and n.post_id is not distinct from p_post_id
    and n.announcement_id is not distinct from p_announcement_id and n.event_id is not distinct from p_event_id
    and n.prayer_id is not distinct from p_prayer_id and n.testimony_id is not distinct from p_testimony_id
    and n.publication_id is not distinct from p_publication_id and n.live_id is not distinct from p_live_id
    and n.payment_id is not distinct from p_payment_id and n.resource_order_id is not distinct from p_resource_order_id
    and n.market_order_id is not distinct from p_market_order_id and n.product_id is not distinct from p_product_id limit 1;
  if existing_id is not null then update notifications set read_at = null, created_at = now() where id = existing_id;
  else insert into notifications (user_id, type, actor_id, post_id, announcement_id, event_id, prayer_id, testimony_id, publication_id, live_id, payment_id, resource_order_id, market_order_id, product_id)
    values (p_user_id, p_type, p_actor_id, p_post_id, p_announcement_id, p_event_id, p_prayer_id, p_testimony_id, p_publication_id, p_live_id, p_payment_id, p_resource_order_id, p_market_order_id, p_product_id);
  end if;
  return true;
end;
$$;

create or replace function public.papa_unread_notification_count(p_user_id uuid)
returns integer language sql security definer set search_path = public as $$
  select count(*)::int from notifications where user_id = p_user_id and read_at is null
$$;

create or replace function public.papa_mark_notifications_read(p_user_id uuid)
returns void language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = p_user_id and read_at is null
$$;

revoke all on function public.papa_list_chats(uuid, text, text) from public, anon, authenticated;
revoke all on function public.papa_unread_chats(uuid) from public, anon, authenticated;
revoke all on function public.papa_list_message_rows(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.papa_group_members(uuid) from public, anon, authenticated;
revoke all on function public.papa_group_requests(uuid) from public, anon, authenticated;
revoke all on function public.papa_discover_groups(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.papa_my_groups(uuid) from public, anon, authenticated;
revoke all on function public.papa_notification_prefs(uuid) from public, anon, authenticated;
revoke all on function public.papa_persist_notification(uuid, notification_type, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.papa_unread_notification_count(uuid) from public, anon, authenticated;
revoke all on function public.papa_mark_notifications_read(uuid) from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- ===== 0027_notifications_list_rpc.sql =====
-- Supabase migration 0027: notification list, notify-context and push-subscription helpers.
-- Service-role only (security definer, execute revoked from public/anon/authenticated).

create or replace function public.papa_list_notifications(p_user_id uuid, p_filter text default 'all', p_limit integer default 60)
returns table (
  grp text, type text, post_id text, at timestamptz, unread boolean, total integer,
  announcement_id text, event_id text, prayer_id text, testimony_id text, publication_id text, live_id text,
  payment_ref text, order_id text, market_order_id text, product_id text,
  market_order_title text, market_order_status text, product_title text, order_title text, payment_title text,
  live_title text, publication_title text, prayer_body text, testimony_title text, post_body text,
  announcement_title text, event_title text, event_starts timestamptz, actors jsonb
)
language sql stable security definer set search_path = public as $$
  with n as (
    select n.*, case when n.type in ('like', 'repost', 'follow', 'prayed', 'testimony_praise')
        then n.type || ':' || coalesce(n.post_id::text, n.prayer_id::text, n.testimony_id::text, date_trunc('day', n.created_at)::text)
        else n.id::text end as grp
    from notifications n left join users u on u.id = n.actor_id
    where n.user_id = p_user_id and (n.actor_id is null or u.status = 'active')
      and (p_filter <> 'mentions' or n.type in ('reply', 'quote', 'mention'))
  )
  select n.grp, min(n.type::text), min(n.post_id::text), max(n.created_at), bool_or(n.read_at is null), count(*)::int,
    min(n.announcement_id::text), min(n.event_id::text), min(n.prayer_id::text), min(n.testimony_id::text), min(n.publication_id::text), min(n.live_id::text),
    (select p.reference from payments p where p.id = min(n.payment_id::text)::uuid),
    min(n.resource_order_id::text),
    min(n.market_order_id::text), min(n.product_id::text),
    (select o.number || ' · ' || o.shop_name from market_orders o where o.id = min(n.market_order_id::text)::uuid),
    (select o.status::text from market_orders o where o.id = min(n.market_order_id::text)::uuid),
    (select p.title from products p where p.id = min(n.product_id::text)::uuid and p.deleted_at is null),
    (select r.title || coalesce(' · ' || o.size, '') || ' × ' || o.qty from resource_orders o join resources r on r.id = o.resource_id where o.id = min(n.resource_order_id::text)::uuid),
    (select 'GHS ' || trim(to_char(p.amount_pesewas / 100.0, 'FM999,999,990.00')) || ' · ' || initcap(p.purpose::text) from payments p where p.id = min(n.payment_id::text)::uuid),
    (select l.title from lives l where l.id = min(n.live_id::text)::uuid and l.deleted_at is null),
    (select p.title || coalesce(' · ' || p.edition, '') from publications p where p.id = min(n.publication_id::text)::uuid and p.deleted_at is null and p.status = 'published'),
    (select left(p.body, 140) from prayer_requests p where p.id = min(n.prayer_id::text)::uuid and p.deleted_at is null),
    (select t.title from testimonies t where t.id = min(n.testimony_id::text)::uuid and t.deleted_at is null),
    (select left(p.body, 140) from posts p where p.id = min(n.post_id::text)::uuid and p.deleted_at is null),
    (select a.title from announcements a where a.id = min(n.announcement_id::text)::uuid and a.deleted_at is null),
    (select e.title from events e where e.id = min(n.event_id::text)::uuid and e.deleted_at is null),
    (select e.starts_at from events e where e.id = min(n.event_id::text)::uuid),
    (select jsonb_agg(jsonb_build_object('username', x.username, 'fullName', x.full_name, 'avatarUrl', x.avatar_url, 'verified', x.verified))
       from (select u.username, u.full_name, u.avatar_url, (u.verified_at is not null) as verified
             from notifications m join users u on u.id = m.actor_id
             where m.user_id = p_user_id and m.id in (select id from n n2 where n2.grp = n.grp)
             order by m.created_at desc limit 5) x)
  from n group by n.grp order by max(n.created_at) desc limit p_limit
$$;

-- One round-trip for everything notify() needs before deciding to deliver.
create or replace function public.papa_notify_context(p_user_id uuid, p_actor_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'blocked', p_actor_id is not null and exists (select 1 from blocks b
      where (b.blocker_id = p_user_id and b.blocked_id = p_actor_id) or (b.blocker_id = p_actor_id and b.blocked_id = p_user_id)),
    'muted', p_actor_id is not null and exists (select 1 from mutes m where m.muter_id = p_user_id and m.muted_id = p_actor_id),
    'prefs', coalesce((select s.prefs from notification_settings s where s.user_id = p_user_id), '{}'::jsonb),
    'actorName', (select u.full_name from users u where u.id = p_actor_id),
    'subs', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from push_subscriptions s where s.user_id = p_user_id), '[]'::jsonb)
  )
$$;

create or replace function public.papa_set_notification_pref(p_user_id uuid, p_prefs jsonb)
returns void language sql security definer set search_path = public as $$
  insert into notification_settings (user_id, prefs) values (p_user_id, p_prefs)
  on conflict (user_id) do update set prefs = excluded.prefs, updated_at = now()
$$;

create or replace function public.papa_unnotify(p_user_id uuid, p_type notification_type, p_actor_id uuid, p_post_id uuid,
  p_prayer_id uuid, p_testimony_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from notifications n where n.user_id = p_user_id and n.type = p_type and n.actor_id = p_actor_id
    and n.post_id is not distinct from p_post_id
    and (p_prayer_id is null or n.prayer_id = p_prayer_id)
    and (p_testimony_id is null or n.testimony_id = p_testimony_id)
$$;

revoke all on function public.papa_list_notifications(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.papa_notify_context(uuid, uuid) from public, anon, authenticated;
revoke all on function public.papa_set_notification_pref(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.papa_unnotify(uuid, notification_type, uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.papa_list_notifications(uuid, text, integer) to service_role;
grant execute on function public.papa_notify_context(uuid, uuid) to service_role;
grant execute on function public.papa_set_notification_pref(uuid, jsonb) to service_role;
grant execute on function public.papa_unnotify(uuid, notification_type, uuid, uuid, uuid, uuid) to service_role;

-- ===== 0028_group_mutations_rpc.sql =====
-- Supabase migration 0028: transactional group mutations.
-- These privileged RPCs are only executable by the server-side service_role.

create or replace function public.papa_update_group(p_actor_id uuid, p_conversation_id uuid,
  p_update_title boolean, p_title text, p_update_description boolean, p_description text,
  p_update_avatar boolean, p_avatar_url text)
returns boolean language plpgsql security definer set search_path = public as $$
declare c conversations%rowtype; r conversation_role;
begin
  select * into c from conversations where id = p_conversation_id and kind = 'group' and deleted_at is null for update;
  if not found then return false; end if;
  select role into r from conversation_members where conversation_id = p_conversation_id and user_id = p_actor_id and left_at is null;
  if not found or (c.only_admins_edit and r <> 'admin') then return false; end if;
  if p_update_title then update conversations set title = p_title where id = p_conversation_id; end if;
  if p_update_description then update conversations set description = p_description where id = p_conversation_id; end if;
  if p_update_avatar then update conversations set avatar_url = p_avatar_url where id = p_conversation_id; end if;
  return true;
end $$;

create or replace function public.papa_update_group_settings(p_actor_id uuid, p_conversation_id uuid, p_settings jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare r conversation_role;
begin
  select role into r from conversation_members where conversation_id = p_conversation_id and user_id = p_actor_id and left_at is null;
  if not found or r <> 'admin' then return false; end if;
  update conversations set
    visibility = case when p_settings ? 'visibility' then (p_settings->>'visibility')::group_visibility else visibility end,
    only_admins_send = case when p_settings ? 'onlyAdminsSend' then (p_settings->>'onlyAdminsSend')::boolean else only_admins_send end,
    only_admins_edit = case when p_settings ? 'onlyAdminsEdit' then (p_settings->>'onlyAdminsEdit')::boolean else only_admins_edit end,
    members_can_add = case when p_settings ? 'membersCanAdd' then (p_settings->>'membersCanAdd')::boolean else members_can_add end,
    approve_joins = case when p_settings ? 'approveJoins' then (p_settings->>'approveJoins')::boolean else approve_joins end
  where id = p_conversation_id and kind = 'group' and deleted_at is null;
  return found;
end $$;

create or replace function public.papa_remove_group_member(p_actor_id uuid, p_conversation_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare c conversations%rowtype; r conversation_role;
begin
  select * into c from conversations where id = p_conversation_id and kind = 'group' and deleted_at is null;
  if not found then return false; end if;
  select role into r from conversation_members where conversation_id = p_conversation_id and user_id = p_actor_id and left_at is null;
  if not found or r <> 'admin' or (p_user_id = c.created_by and p_actor_id <> c.created_by) then return false; end if;
  update conversation_members set left_at = now(), role = 'member' where conversation_id = p_conversation_id and user_id = p_user_id and left_at is null;
  return found;
end $$;

create or replace function public.papa_set_group_admin(p_actor_id uuid, p_conversation_id uuid, p_user_id uuid, p_on boolean)
returns text language plpgsql security definer set search_path = public as $$
declare c conversations%rowtype; r conversation_role; n integer;
begin
  select * into c from conversations where id = p_conversation_id and kind = 'group' and deleted_at is null;
  if not found then return 'not_found'; end if;
  select role into r from conversation_members where conversation_id = p_conversation_id and user_id = p_actor_id and left_at is null;
  if not found or r <> 'admin' then return 'not_admin'; end if;
  if not p_on and p_user_id = c.created_by and p_actor_id <> c.created_by then return 'creator'; end if;
  if not p_on and p_user_id = p_actor_id then
    select count(*) into n from conversation_members where conversation_id = p_conversation_id and role = 'admin' and left_at is null;
    if n <= 1 then return 'last_admin'; end if;
  end if;
  update conversation_members set role = case when p_on then 'admin'::conversation_role else 'member'::conversation_role end
    where conversation_id = p_conversation_id and user_id = p_user_id and left_at is null;
  if not found then return 'not_found'; end if;
  return 'ok';
end $$;

create or replace function public.papa_leave_group(p_user_id uuid, p_conversation_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare promoted uuid; remaining integer;
begin
  if not exists(select 1 from conversations where id = p_conversation_id and kind = 'group' and deleted_at is null)
    or not exists(select 1 from conversation_members where conversation_id = p_conversation_id and user_id = p_user_id and left_at is null) then
    return jsonb_build_object('status','not_found');
  end if;
  update conversation_members set left_at = now(), role = 'member' where conversation_id = p_conversation_id and user_id = p_user_id and left_at is null;
  select count(*) into remaining from conversation_members where conversation_id = p_conversation_id and left_at is null;
  if remaining = 0 then
    update conversations set deleted_at = now() where id = p_conversation_id;
    return jsonb_build_object('status','closed');
  end if;
  if not exists(select 1 from conversation_members where conversation_id = p_conversation_id and left_at is null and role = 'admin') then
    select user_id into promoted from conversation_members where conversation_id = p_conversation_id and left_at is null order by joined_at asc limit 1;
    update conversation_members set role = 'admin' where conversation_id = p_conversation_id and user_id = promoted;
  end if;
  return jsonb_build_object('status','left','promoted',promoted);
end $$;

create or replace function public.papa_reset_group_invite(p_actor_id uuid, p_conversation_id uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from conversation_members where conversation_id = p_conversation_id and user_id = p_actor_id and left_at is null and role = 'admin') then return false; end if;
  update conversations set invite_code = p_code where id = p_conversation_id and kind = 'group' and deleted_at is null;
  return found;
end $$;

create or replace function public.papa_cancel_group_request(p_user_id uuid, p_conversation_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from group_join_requests where user_id = p_user_id and conversation_id = p_conversation_id
$$;

create or replace function public.papa_answer_group_request(p_actor_id uuid, p_conversation_id uuid, p_user_id uuid, p_accept boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from conversation_members where conversation_id = p_conversation_id and user_id = p_actor_id and left_at is null and role = 'admin') then return false; end if;
  delete from group_join_requests where conversation_id = p_conversation_id and user_id = p_user_id;
  return found;
end $$;

create or replace function public.papa_close_group(p_conversation_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update conversations set deleted_at = now() where id = p_conversation_id and kind = 'group' and deleted_at is null;
  return found;
end $$;

revoke all on function public.papa_update_group(uuid,uuid,boolean,text,boolean,text,boolean,text) from public, anon, authenticated;
revoke all on function public.papa_update_group_settings(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.papa_remove_group_member(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.papa_set_group_admin(uuid,uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.papa_leave_group(uuid,uuid) from public, anon, authenticated;
revoke all on function public.papa_reset_group_invite(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.papa_cancel_group_request(uuid,uuid) from public, anon, authenticated;
revoke all on function public.papa_answer_group_request(uuid,uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.papa_close_group(uuid) from public, anon, authenticated;
grant execute on function public.papa_update_group(uuid,uuid,boolean,text,boolean,text,boolean,text) to service_role;
grant execute on function public.papa_update_group_settings(uuid,uuid,jsonb) to service_role;
grant execute on function public.papa_remove_group_member(uuid,uuid,uuid) to service_role;
grant execute on function public.papa_set_group_admin(uuid,uuid,uuid,boolean) to service_role;
grant execute on function public.papa_leave_group(uuid,uuid) to service_role;
grant execute on function public.papa_reset_group_invite(uuid,uuid,text) to service_role;
grant execute on function public.papa_cancel_group_request(uuid,uuid) to service_role;
grant execute on function public.papa_answer_group_request(uuid,uuid,uuid,boolean) to service_role;
grant execute on function public.papa_close_group(uuid) to service_role;

-- ===== 0029_moderation_reports_rpc.sql =====
create or replace function public.papa_file_report(
  p_reporter_id uuid, p_target jsonb, p_reason text, p_details text default ''
) returns text language plpgsql security definer set search_path = public as $$
declare
  n integer;
  v_post uuid := nullif(p_target->>'postId','')::uuid;
  v_user uuid := nullif(p_target->>'userId','')::uuid;
  v_announcement uuid := nullif(p_target->>'announcementId','')::uuid;
  v_event uuid := nullif(p_target->>'eventId','')::uuid;
  v_prayer uuid := nullif(p_target->>'prayerId','')::uuid;
  v_testimony uuid := nullif(p_target->>'testimonyId','')::uuid;
  v_conversation uuid := nullif(p_target->>'conversationId','')::uuid;
  v_product uuid := nullif(p_target->>'productId','')::uuid;
  v_shop uuid := nullif(p_target->>'shopId','')::uuid;
  v_target_user uuid;
  v_kind text;
begin
  select count(*) into n from jsonb_each_text(p_target) e where nullif(e.value,'') is not null;
  if n <> 1 or p_reason not in ('spam','abuse','false_info','inappropriate','impersonation','other') then return 'invalid'; end if;
  if v_post is not null then select author_id into v_target_user from posts where id=v_post;
  elsif v_user is not null then v_target_user := v_user;
  elsif v_announcement is not null then select author_id into v_target_user from announcements where id=v_announcement;
  elsif v_event is not null then select author_id into v_target_user from events where id=v_event;
  elsif v_prayer is not null then select author_id into v_target_user from prayer_requests where id=v_prayer;
  elsif v_testimony is not null then select author_id into v_target_user from testimonies where id=v_testimony;
  elsif v_product is not null then select s.owner_id into v_target_user from products p join shops s on s.id=p.shop_id where p.id=v_product and p.deleted_at is null;
  elsif v_shop is not null then select owner_id into v_target_user from shops where id=v_shop;
  elsif v_conversation is not null then
    select created_by into v_target_user from conversations c where c.id=v_conversation and c.kind='group' and c.deleted_at is null
      and (c.visibility='public' or exists(select 1 from conversation_members m where m.conversation_id=c.id and m.user_id=p_reporter_id and m.left_at is null));
    if not found then return 'invalid'; end if;
    if v_target_user = p_reporter_id then v_target_user := null; end if;
  end if;
  if v_target_user is null and v_conversation is null then return 'invalid'; end if;
  if v_target_user = p_reporter_id then return 'self'; end if;
  if exists(select 1 from reports r where r.reporter_id=p_reporter_id and r.status='open'
    and ((v_post is not null and r.post_id=v_post) or (v_user is not null and r.post_id is null and r.announcement_id is null and r.event_id is null and r.prayer_id is null and r.testimony_id is null and r.conversation_id is null and r.product_id is null and r.shop_id is null and r.target_user_id=v_user)
    or (v_announcement is not null and r.announcement_id=v_announcement) or (v_event is not null and r.event_id=v_event)
    or (v_prayer is not null and r.prayer_id=v_prayer) or (v_testimony is not null and r.testimony_id=v_testimony)
    or (v_conversation is not null and r.conversation_id=v_conversation) or (v_product is not null and r.product_id=v_product) or (v_shop is not null and r.shop_id=v_shop))) then return 'duplicate'; end if;
  insert into reports(reporter_id,post_id,announcement_id,event_id,prayer_id,testimony_id,conversation_id,product_id,shop_id,target_user_id,reason,details)
  values(p_reporter_id,v_post,v_announcement,v_event,v_prayer,v_testimony,v_conversation,v_product,v_shop,v_target_user,p_reason::report_reason,nullif(left(trim(coalesce(p_details,'')),500),''));
  return 'ok';
end $$;

create or replace function public.papa_list_reports(p_status text default 'open') returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id',r.id,'reason',r.reason,'details',r.details,'status',r.status,'createdAt',r.created_at,'resolution',r.resolution,
    'postId',r.post_id,'postBody',p.body,'postDeleted',(p.deleted_at is not null),
    'announcementId',r.announcement_id,'eventId',r.event_id,'prayerId',r.prayer_id,'testimonyId',r.testimony_id,'conversationId',r.conversation_id,
    'productId',r.product_id,'shopId',r.shop_id,'shopSlug',(select s.slug from shops s where s.id=r.shop_id),
    'itemTitle',coalesce((select a.title from announcements a where a.id=r.announcement_id),(select e.title from events e where e.id=r.event_id),
      (select left(pr.body,200) from prayer_requests pr where pr.id=r.prayer_id),(select t.title from testimonies t where t.id=r.testimony_id),
      (select c.title || ' · ' || (select count(*) from conversation_members m where m.conversation_id=c.id and m.left_at is null) || ' 👥' from conversations c where c.id=r.conversation_id),
      (select pr.title from products pr where pr.id=r.product_id),(select s.name from shops s where s.id=r.shop_id)),
    'itemDeleted',coalesce((select a.deleted_at is not null from announcements a where a.id=r.announcement_id),(select e.deleted_at is not null from events e where e.id=r.event_id),
      (select pr.deleted_at is not null from prayer_requests pr where pr.id=r.prayer_id),(select t.deleted_at is not null from testimonies t where t.id=r.testimony_id),
      (select c.deleted_at is not null from conversations c where c.id=r.conversation_id),(select pr.deleted_at is not null or pr.status='removed' from products pr where pr.id=r.product_id),
      (select s.deleted_at is not null or s.status='suspended' from shops s where s.id=r.shop_id),false),
    'reporterUsername',reporter.username,'targetId',target.id,'targetUsername',target.username,'targetName',target.full_name,'targetStatus',target.status,
    'sameTarget',(select count(*)::int from reports r2 where r2.status='open' and coalesce(r2.post_id::text,r2.announcement_id::text,r2.event_id::text,r2.prayer_id::text,r2.testimony_id::text,r2.conversation_id::text,r2.product_id::text,r2.shop_id::text,r2.target_user_id::text)
      =coalesce(r.post_id::text,r.announcement_id::text,r.event_id::text,r.prayer_id::text,r.testimony_id::text,r.conversation_id::text,r.product_id::text,r.shop_id::text,r.target_user_id::text)))
  from reports r join users reporter on reporter.id=r.reporter_id left join users target on target.id=r.target_user_id left join posts p on p.id=r.post_id
  where r.status=p_status::report_status order by r.created_at desc limit 100
$$;

create or replace function public.papa_resolve_reports(p_report_id uuid,p_admin_id uuid,p_status text,p_resolution text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r reports%rowtype;
begin
  if p_status not in ('actioned','dismissed') then raise exception 'invalid_report_status'; end if;
  select * into r from reports where id=p_report_id;
  if not found then return null; end if;
  update reports x set status=p_status::report_status,handled_by=p_admin_id,handled_at=now(),resolution=left(coalesce(p_resolution,''),1000)
  where x.status='open' and coalesce(x.post_id::text,x.announcement_id::text,x.event_id::text,x.prayer_id::text,x.testimony_id::text,x.conversation_id::text,x.product_id::text,x.shop_id::text,x.target_user_id::text)
    =coalesce(r.post_id::text,r.announcement_id::text,r.event_id::text,r.prayer_id::text,r.testimony_id::text,r.conversation_id::text,r.product_id::text,r.shop_id::text,r.target_user_id::text);
  return to_jsonb(r);
end $$;

create or replace function public.papa_open_report_count() returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from reports where status='open'
$$;

revoke all on function public.papa_file_report(uuid,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.papa_list_reports(text) from public,anon,authenticated;
revoke all on function public.papa_resolve_reports(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.papa_open_report_count() from public,anon,authenticated;
grant execute on function public.papa_file_report(uuid,jsonb,text,text) to service_role;
grant execute on function public.papa_list_reports(text) to service_role;
grant execute on function public.papa_resolve_reports(uuid,uuid,text,text) to service_role;
grant execute on function public.papa_open_report_count() to service_role;

-- ===== 0030_market_payout_rpc.sql =====
-- Supabase migration 0030: atomic Market payout settlement and retry operations.
create or replace function public.papa_release_due_market_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with due as (
    update market_orders o set status='completed',completed_at=now(),
      released_at=case when o.escrow='held' then now() else o.released_at end,
      escrow=case when o.escrow='held' then 'released'::escrow_state else o.escrow end
    from shops s where s.id=o.shop_id and o.status='delivered' and o.escrow in ('held','refunded')
      and o.delivered_at < now()-make_interval(hours=>greatest(s.return_days*24,24))
      and not exists(select 1 from market_requests r where r.order_id=o.id and (r.status in ('open','escalated') or (r.status='declined' and r.resolved_at>now()-interval '7 days')))
    returning o.id
  ), ev as (
    insert into market_order_events(order_id,kind,actor_id,note) select id,'completed',null,null from due returning id
  ) select count(*) into n from due;
  return coalesce(n,0);
end $$;

create or replace function public.papa_create_market_payouts()
returns integer language plpgsql security definer set search_path = public as $$
declare s record; r record; pid uuid; n integer:=0; ref text;
begin
  perform pg_advisory_xact_lock(hashtext('papa_market_payout_creation'));
  for s in select sh.id shop_id,sh.owner_id,sum(o.seller_net_pesewas)::int total,sh.payout_method method,sh.payout_provider provider,sh.payout_number number,sh.payout_name name,array_agg(o.id) ids
    from market_orders o join shops sh on sh.id=o.shop_id where o.escrow='released' and o.seller_payout_id is null and o.seller_net_pesewas>0 and sh.payout_method is not null group by sh.id loop
    ref:='PAPA-PO-S'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
    insert into payouts(reference,kind,user_id,shop_id,amount_pesewas,method,provider,number,name) values(ref,'seller',s.owner_id,s.shop_id,s.total,s.method,s.provider,s.number,s.name) returning id into pid;
    update market_orders set seller_payout_id=pid where id=any(s.ids) and seller_payout_id is null; n:=n+1;
  end loop;
  for r in select ri.id rider_id,ri.user_id,sum(d.fee_pesewas)::int total,ri.payout_provider provider,ri.payout_number number,ri.payout_name name,array_agg(d.id) ids
    from deliveries d join riders ri on ri.id=d.rider_id join market_orders o on o.id=d.order_id where d.status='delivered' and d.payout_id is null and o.status='completed' and ri.payout_number is not null group by ri.id loop
    ref:='PAPA-PO-R'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
    insert into payouts(reference,kind,user_id,rider_id,amount_pesewas,method,provider,number,name) values(ref,'rider',r.user_id,r.rider_id,r.total,'momo',r.provider,r.number,r.name) returning id into pid;
    update deliveries set payout_id=pid where id=any(r.ids) and payout_id is null; n:=n+1;
  end loop;
  return n;
end $$;

create or replace function public.papa_claim_market_payouts(p_ids uuid[] default null)
returns setof payouts language sql security definer set search_path = public as $$
  update payouts p set status='processing',attempts=p.attempts+1
  where p.status in ('pending','failed') and (p_ids is not null and p.id=any(p_ids) or p_ids is null and (p.status='pending' or (p.status='failed' and p.attempts<5 and p.created_at<now()-make_interval(mins=>30*p.attempts))))
  returning p.*
$$;

create or replace function public.papa_finish_market_payout(p_id uuid,p_status text,p_provider_ref text,p_reason text)
returns uuid language sql security definer set search_path = public as $$
  update payouts set status=p_status::payout_status,provider_ref=left(p_provider_ref,200),failure_reason=nullif(left(p_reason,500),''),paid_at=case when p_status='paid' then now() else paid_at end
  where id=p_id and status='processing' and p_status in ('paid','failed') returning id
$$;

create or replace function public.papa_market_payout_result(p_reference text,p_status text,p_reason text)
returns uuid language sql security definer set search_path = public as $$
  update payouts set status=p_status::payout_status,failure_reason=case when p_status='failed' then left(p_reason,500) else null end,paid_at=case when p_status='paid' then now() else paid_at end
  where status='processing' and p_status in ('paid','failed') and reference in (p_reference,regexp_replace(p_reference,'-[0-9]+$','')) returning id
$$;

create or replace function public.papa_retry_market_payout(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$ begin update payouts set status='failed',attempts=0 where id=p_id and status='failed'; return found; end $$;
create or replace function public.papa_mark_market_payout_paid(p_id uuid,p_admin_id uuid,p_note text)
returns uuid language sql security definer set search_path = public as $$
  update payouts set status='paid',paid_at=now(),provider_ref=left(p_note,100),handled_by=p_admin_id,failure_reason=null where id=p_id and status in ('manual','failed') returning id
$$;

create or replace function public.papa_my_market_payouts(p_user_id uuid)
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id',p.id,'reference',p.reference,'kind',p.kind,'amount_pesewas',p.amount_pesewas,'status',p.status,'method',p.method,'provider',p.provider,'number',p.number,'name',p.name,'failure_reason',p.failure_reason,'created_at',p.created_at,'paid_at',p.paid_at,
    'count',(select count(*)::int from market_orders o where o.seller_payout_id=p.id)+(select count(*)::int from deliveries d where d.payout_id=p.id))
  from payouts p where p.user_id=p_user_id order by p.created_at desc limit 200
$$;
create or replace function public.papa_admin_market_payouts(p_status text default null)
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id',p.id,'reference',p.reference,'kind',p.kind,'amount_pesewas',p.amount_pesewas,'status',p.status,'method',p.method,'provider',p.provider,'number',p.number,'name',p.name,'failure_reason',p.failure_reason,'created_at',p.created_at,'paid_at',p.paid_at,
    'count',(select count(*)::int from market_orders o where o.seller_payout_id=p.id)+(select count(*)::int from deliveries d where d.payout_id=p.id),
    'payee',coalesce((select s.name from shops s where s.id=p.shop_id),(select u.full_name from users u where u.id=p.user_id)),'payee_username',(select u.username from users u where u.id=p.user_id))
  from payouts p where p_status is null or p.status::text=p_status order by (p.status in ('failed','manual')) desc,p.created_at desc limit 300
$$;
create or replace function public.papa_waiting_market_payout_details()
returns setof jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('kind','seller','name',s.name,'username',u.username,'total',sum(o.seller_net_pesewas)::int) from market_orders o join shops s on s.id=o.shop_id join users u on u.id=s.owner_id
  where o.escrow='released' and o.seller_payout_id is null and s.payout_method is null group by s.id,u.username
  union all
  select jsonb_build_object('kind','rider','name',u.full_name,'username',u.username,'total',sum(d.fee_pesewas)::int) from deliveries d join riders r on r.id=d.rider_id join users u on u.id=r.user_id join market_orders o on o.id=d.order_id
  where d.status='delivered' and d.payout_id is null and o.status='completed' and r.payout_number is null group by u.id
$$;
create or replace function public.papa_market_account_blockers(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'buying',(select count(*)::int from market_orders where buyer_id=p_user_id and status in ('paid','accepted','packed','shipped')),
    'selling',(select count(*)::int from market_orders where seller_id=p_user_id and status in ('paid','accepted','packed','shipped')),
    'held',(select count(*)::int from market_orders where seller_id=p_user_id and status='delivered' and escrow='held'),
    'delivering',(select count(*)::int from deliveries d join riders r on r.id=d.rider_id where r.user_id=p_user_id and d.status in ('accepted','picked_up')),
    'owed',(select count(*)::int from payouts where user_id=p_user_id and status in ('pending','processing','failed','manual')))
$$;

revoke all on function public.papa_release_due_market_orders() from public,anon,authenticated;
revoke all on function public.papa_create_market_payouts() from public,anon,authenticated;
revoke all on function public.papa_claim_market_payouts(uuid[]) from public,anon,authenticated;
revoke all on function public.papa_finish_market_payout(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.papa_market_payout_result(text,text,text) from public,anon,authenticated;
revoke all on function public.papa_retry_market_payout(uuid) from public,anon,authenticated;
revoke all on function public.papa_mark_market_payout_paid(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.papa_my_market_payouts(uuid) from public,anon,authenticated;
revoke all on function public.papa_admin_market_payouts(text) from public,anon,authenticated;
revoke all on function public.papa_waiting_market_payout_details() from public,anon,authenticated;
revoke all on function public.papa_market_account_blockers(uuid) from public,anon,authenticated;
grant execute on function public.papa_release_due_market_orders() to service_role;
grant execute on function public.papa_create_market_payouts() to service_role;
grant execute on function public.papa_claim_market_payouts(uuid[]) to service_role;
grant execute on function public.papa_finish_market_payout(uuid,text,text,text) to service_role;
grant execute on function public.papa_market_payout_result(text,text,text) to service_role;
grant execute on function public.papa_retry_market_payout(uuid) to service_role;
grant execute on function public.papa_mark_market_payout_paid(uuid,uuid,text) to service_role;
grant execute on function public.papa_my_market_payouts(uuid) to service_role;
grant execute on function public.papa_admin_market_payouts(text) to service_role;
grant execute on function public.papa_waiting_market_payout_details() to service_role;
grant execute on function public.papa_market_account_blockers(uuid) to service_role;

-- ===== 0031_rate_limit_audit_rpc.sql =====
-- Supabase server-only RPCs for fixed-window rate limiting and admin audit queries.
create or replace function public.papa_hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_key is null or length(p_key) < 1 or length(p_key) > 250 or p_max < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then raise exception 'invalid_rate_limit_arguments'; end if;
  insert into rate_limits(key,count,reset_at) values(p_key,1,now()+make_interval(secs=>p_window_seconds))
  on conflict(key) do update set count=case when rate_limits.reset_at<now() then 1 else rate_limits.count+1 end,
  reset_at=case when rate_limits.reset_at<now() then now()+make_interval(secs=>p_window_seconds) else rate_limits.reset_at end returning count into n;
  return n<=p_max;
end $$;
create or replace function public.papa_clear_rate_limit(p_key text) returns void language sql security definer set search_path=public as $$ delete from rate_limits where key=p_key $$;
create or replace function public.papa_list_audit_log(p_action text default null,p_actor text default null,p_from timestamptz default null,p_to timestamptz default null,p_page integer default 1,p_page_size integer default 50)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_page integer:=greatest(1,coalesce(p_page,1)); v_size integer:=least(100,greatest(1,coalesce(p_page_size,50))); v_total bigint; v_rows jsonb;
begin
 select count(*) into v_total from audit_log a left join users u on u.id=a.actor_id
 where (nullif(p_action,'') is null or a.action ilike replace(replace(replace(p_action,'\','\\'),'%','\%'),'_','\_')||'%' escape '\')
 and (nullif(p_actor,'') is null or lower(coalesce(u.username,''))=lower(ltrim(p_actor,'@')))
 and (p_from is null or a.created_at>=p_from) and (p_to is null or a.created_at<=p_to);
 select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt" desc),'[]'::jsonb) into v_rows from (
 select a.id,a.action,a.target,a.meta,a.ip,a.created_at as "createdAt",u.username,u.full_name as "fullName" from audit_log a left join users u on u.id=a.actor_id
 where (nullif(p_action,'') is null or a.action ilike replace(replace(replace(p_action,'\','\\'),'%','\%'),'_','\_')||'%' escape '\')
 and (nullif(p_actor,'') is null or lower(coalesce(u.username,''))=lower(ltrim(p_actor,'@')))
 and (p_from is null or a.created_at>=p_from) and (p_to is null or a.created_at<=p_to)
 order by a.created_at desc limit v_size offset (v_page-1)*v_size) x;
 return jsonb_build_object('rows',v_rows,'total',v_total,'page',v_page,'pages',greatest(1,ceil(v_total::numeric/v_size)::integer));
end $$;
create or replace function public.papa_audit_action_names() returns text[] language sql stable security definer set search_path=public as $$ select coalesce(array_agg(distinct action order by action),array[]::text[]) from audit_log $$;
revoke all on function public.papa_hit_rate_limit(text,integer,integer) from public,anon,authenticated;
revoke all on function public.papa_clear_rate_limit(text) from public,anon,authenticated;
revoke all on function public.papa_list_audit_log(text,text,timestamptz,timestamptz,integer,integer) from public,anon,authenticated;
revoke all on function public.papa_audit_action_names() from public,anon,authenticated;
grant execute on function public.papa_hit_rate_limit(text,integer,integer) to service_role;
grant execute on function public.papa_clear_rate_limit(text) to service_role;
grant execute on function public.papa_list_audit_log(text,text,timestamptz,timestamptz,integer,integer) to service_role;
grant execute on function public.papa_audit_action_names() to service_role;

-- ===== 0032_market_payout_transfer_status.sql =====
-- Preserve all provider outcomes; bank transfers remain manual and pending provider transfers remain processing.
create or replace function public.papa_finish_market_payout(
  p_id uuid, p_status text, p_provider_ref text, p_reason text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_status text; v_id uuid;
begin
  if p_status not in ('paid','failed','manual','processing') then
    raise exception 'invalid_payout_result';
  end if;
  v_status := p_status;
  update payouts set
    status = v_status::payout_status,
    provider_ref = nullif(left(coalesce(p_provider_ref,''),200),''),
    failure_reason = case when v_status='failed' then nullif(left(coalesce(p_reason,''),500),'') else null end,
    paid_at = case when v_status='paid' then now() else paid_at end
  where id=p_id and status='processing'
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.papa_finish_market_payout(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.papa_finish_market_payout(uuid,text,text,text) to service_role;

-- ===== 0033_post_interaction_rpc.sql =====
-- Atomic post interactions and view counters, exposed only to the trusted server client.
create or replace function public.papa_react_post(p_user_id uuid,p_post_id uuid,p_kind text,p_on boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_author uuid; v_changed integer:=0;
begin
  if p_kind not in ('like','repost','bookmark') then raise exception 'invalid_reaction_kind'; end if;
  select author_id into v_author from posts where id=p_post_id and deleted_at is null and is_draft=false and published_at<=now();
  if not found then return jsonb_build_object('ok',false,'changed',false,'author_id',null); end if;
  if p_kind='repost' and v_author=p_user_id then return jsonb_build_object('ok',false,'changed',false,'author_id',v_author); end if;
  if p_kind='like' then
    if p_on then insert into likes(user_id,post_id) values(p_user_id,p_post_id) on conflict do nothing; get diagnostics v_changed=row_count;
    else delete from likes where user_id=p_user_id and post_id=p_post_id; get diagnostics v_changed=row_count; end if;
    if v_changed>0 then update posts set like_count=greatest(0,like_count+case when p_on then 1 else -1 end) where id=p_post_id; end if;
  elsif p_kind='repost' then
    if p_on then insert into reposts(user_id,post_id) values(p_user_id,p_post_id) on conflict do nothing; get diagnostics v_changed=row_count;
    else delete from reposts where user_id=p_user_id and post_id=p_post_id; get diagnostics v_changed=row_count; end if;
    if v_changed>0 then update posts set repost_count=greatest(0,repost_count+case when p_on then 1 else -1 end) where id=p_post_id; end if;
  else
    if p_on then insert into bookmarks(user_id,post_id) values(p_user_id,p_post_id) on conflict do nothing; get diagnostics v_changed=row_count;
    else delete from bookmarks where user_id=p_user_id and post_id=p_post_id; get diagnostics v_changed=row_count; end if;
    if v_changed>0 then update posts set bookmark_count=greatest(0,bookmark_count+case when p_on then 1 else -1 end) where id=p_post_id; end if;
  end if;
  return jsonb_build_object('ok',true,'changed',v_changed>0,'author_id',v_author);
end $$;

create or replace function public.papa_vote_post(p_user_id uuid,p_post_id uuid,p_option_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_end timestamptz; v_changed integer;
begin
  select po.ends_at into v_end from polls po where po.post_id=p_post_id;
  if v_end is null then return 'invalid'; end if;
  if not exists(select 1 from poll_options where id=p_option_id and post_id=p_post_id) then return 'invalid'; end if;
  if v_end<=now() then return 'ended'; end if;
  if not exists(select 1 from posts where id=p_post_id and deleted_at is null and is_draft=false and published_at<=now()) then return 'invalid'; end if;
  insert into poll_votes(post_id,user_id,option_id) values(p_post_id,p_user_id,p_option_id) on conflict do nothing;
  get diagnostics v_changed=row_count;
  if v_changed=0 then return 'already'; end if;
  update poll_options set votes=votes+1 where id=p_option_id and post_id=p_post_id;
  return 'ok';
end $$;

create or replace function public.papa_pin_post(p_user_id uuid,p_post_id uuid,p_on boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_author uuid; v_reply uuid; v_deleted timestamptz; v_draft boolean;
begin
  if not p_on then delete from pinned_posts where user_id=p_user_id and post_id=p_post_id; return true; end if;
  select author_id,reply_to_id,deleted_at,is_draft into v_author,v_reply,v_deleted,v_draft from posts where id=p_post_id;
  if not found or v_author<>p_user_id or v_reply is not null or v_deleted is not null or v_draft then return false; end if;
  insert into pinned_posts(user_id,post_id) values(p_user_id,p_post_id) on conflict(user_id) do update set post_id=excluded.post_id;
  return true;
end $$;

create or replace function public.papa_set_favorite(p_user_id uuid,p_favorite_id uuid,p_on boolean)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if p_user_id=p_favorite_id then return false; end if;
  if p_on then insert into favorites(user_id,favorite_id) values(p_user_id,p_favorite_id) on conflict do nothing;
  else delete from favorites where user_id=p_user_id and favorite_id=p_favorite_id; end if;
  return true;
end $$;

create or replace function public.papa_increment_post_views(p_post_ids uuid[])
returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin update posts set view_count=view_count+1 where id=any(coalesce(p_post_ids,'{}'::uuid[])); get diagnostics n=row_count; return coalesce(n,0); end $$;

revoke all on function public.papa_react_post(uuid,uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.papa_vote_post(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.papa_pin_post(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.papa_set_favorite(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.papa_increment_post_views(uuid[]) from public,anon,authenticated;
grant execute on function public.papa_react_post(uuid,uuid,text,boolean) to service_role;
grant execute on function public.papa_vote_post(uuid,uuid,uuid) to service_role;
grant execute on function public.papa_pin_post(uuid,uuid,boolean) to service_role;
grant execute on function public.papa_set_favorite(uuid,uuid,boolean) to service_role;
grant execute on function public.papa_increment_post_views(uuid[]) to service_role;

-- ===== 0034_post_mutation_rpc.sql =====
-- Transactional edit/publish/delete/scheduled-release operations for posts.
create or replace function public.papa_edit_post(
  p_author_id uuid,p_post_id uuid,p_body text,p_link_preview jsonb,p_tags text[],p_mention_ids uuid[]
) returns boolean language plpgsql security definer set search_path=public as $$
declare p posts%rowtype; v_pending boolean;
begin
  select * into p from posts where id=p_post_id and author_id=p_author_id and deleted_at is null for update;
  if not found then return false; end if;
  v_pending:=p.is_draft or (p.published_at is not null and p.published_at>now());
  if not v_pending and p.published_at < now()-interval '30 minutes' then return false; end if;
  if p.body=p_body then return true; end if;
  if not v_pending then insert into post_edits(post_id,body) values(p_post_id,p.body); end if;
  update posts set body=p_body,link_preview=p_link_preview,edited_at=case when v_pending then null else now() end where id=p_post_id;
  delete from post_hashtags where post_id=p_post_id;
  delete from post_mentions where post_id=p_post_id;
  insert into post_hashtags(post_id,tag) select p_post_id,x from unnest(coalesce(p_tags,'{}'::text[])) x on conflict do nothing;
  insert into post_mentions(post_id,user_id) select p_post_id,x from unnest(coalesce(p_mention_ids,'{}'::uuid[])) x on conflict do nothing;
  return true;
end $$;

create or replace function public.papa_publish_draft(p_author_id uuid,p_post_id uuid,p_publish_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p posts%rowtype; v_live boolean; v_at timestamptz;
begin
  select * into p from posts where id=p_post_id and author_id=p_author_id and deleted_at is null for update;
  if not found or (not p.is_draft and not (p.published_at is not null and p.published_at>now())) then return null; end if;
  if p_publish_at is not null and p_publish_at<now()-interval '1 minute' then raise exception 'schedule_past'; end if;
  v_at:=coalesce(p_publish_at,now()); v_live:=v_at<=now();
  update posts set is_draft=false,published_at=v_at,notified_at=case when v_live then now() else null end where id=p_post_id;
  if v_live and p.reply_to_id is not null then update posts set reply_count=reply_count+1 where id=p.reply_to_id; end if;
  if v_live and p.quote_of_id is not null then update posts set quote_count=quote_count+1 where id=p.quote_of_id; end if;
  return jsonb_build_object('id',p.id,'author_id',p.author_id,'reply_to_id',p.reply_to_id,'quote_of_id',p.quote_of_id,'live',v_live);
end $$;

create or replace function public.papa_delete_post(p_user_id uuid,p_post_id uuid,p_as_admin boolean default false)
returns boolean language plpgsql security definer set search_path=public as $$
declare p posts%rowtype; v_live boolean;
begin
  select * into p from posts where id=p_post_id and deleted_at is null for update;
  if not found or (p.author_id<>p_user_id and not p_as_admin) then return false; end if;
  v_live:=not p.is_draft and p.published_at is not null and p.published_at<=now();
  if not v_live then delete from posts where id=p_post_id; return true; end if;
  update posts set deleted_at=now(),body='',link_preview=null where id=p_post_id;
  delete from post_media where post_id=p_post_id;
  delete from post_hashtags where post_id=p_post_id;
  delete from pinned_posts where post_id=p_post_id;
  if p.reply_to_id is not null then update posts set reply_count=greatest(reply_count-1,0) where id=p.reply_to_id; end if;
  if p.quote_of_id is not null then update posts set quote_count=greatest(quote_count-1,0) where id=p.quote_of_id; end if;
  return true;
end $$;

create or replace function public.papa_release_scheduled_posts()
returns table(id uuid,author_id uuid,reply_to_id uuid,quote_of_id uuid)
language plpgsql security definer set search_path=public as $$
declare p posts%rowtype;
begin
  for p in select * from posts where notified_at is null and is_draft=false and deleted_at is null and published_at is not null and published_at<=now() for update skip locked loop
    update posts set notified_at=now() where posts.id=p.id;
    if p.reply_to_id is not null then update posts set reply_count=reply_count+1 where posts.id=p.reply_to_id; end if;
    if p.quote_of_id is not null then update posts set quote_count=quote_count+1 where posts.id=p.quote_of_id; end if;
    id:=p.id; author_id:=p.author_id; reply_to_id:=p.reply_to_id; quote_of_id:=p.quote_of_id; return next;
  end loop;
end $$;

revoke all on function public.papa_edit_post(uuid,uuid,text,jsonb,text[],uuid[]) from public,anon,authenticated;
revoke all on function public.papa_publish_draft(uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.papa_delete_post(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.papa_release_scheduled_posts() from public,anon,authenticated;
grant execute on function public.papa_edit_post(uuid,uuid,text,jsonb,text[],uuid[]) to service_role;
grant execute on function public.papa_publish_draft(uuid,uuid,timestamptz) to service_role;
grant execute on function public.papa_delete_post(uuid,uuid,boolean) to service_role;
grant execute on function public.papa_release_scheduled_posts() to service_role;

-- ===== 0035_discovery_search_rpc.sql =====
-- Server-only full-text post search with the same visibility rules used by the feed.
create or replace function public.papa_search_post_ids(
  p_query text,
  p_viewer_id uuid default null,
  p_media_only boolean default false,
  p_top boolean default false,
  p_limit integer default 30
) returns table(id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from posts p
  join users u on u.id = p.author_id
  left join user_preferences pr on pr.user_id = p.author_id
  where p.deleted_at is null and p.is_draft = false and p.published_at <= now()
    and u.status = 'active'
    and to_tsvector('simple', coalesce(p.body,'')) @@ to_tsquery('simple', p_query)
    and (not p_media_only or exists(select 1 from post_media pm where pm.post_id = p.id))
    and (p_viewer_id is not null or (coalesce(pr.private_profile,false)=false and coalesce(pr.visible_to_guests,true)=true))
    and (p_viewer_id is null or (
      not exists(select 1 from blocks b where (b.blocker_id=p_viewer_id and b.blocked_id=p.author_id) or (b.blocker_id=p.author_id and b.blocked_id=p_viewer_id))
      and (coalesce(pr.private_profile,false)=false or p.author_id=p_viewer_id or exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=p.author_id))
      and not exists(select 1 from mutes m where m.muter_id=p_viewer_id and m.muted_id=p.author_id)
    ))
  order by
    case when p_top then (p.like_count + 2*p.repost_count + p.reply_count)::bigint else 0::bigint end desc,
    p.published_at desc
  limit least(100,greatest(1,coalesce(p_limit,30)))
$$;
revoke all on function public.papa_search_post_ids(text,uuid,boolean,boolean,integer) from public, anon, authenticated;
grant execute on function public.papa_search_post_ids(text,uuid,boolean,boolean,integer) to service_role;

-- ===== 0036_discovery_feed_rpc.sql =====
-- Stable cursor-paged feed IDs for list membership and saved-post folders.
create or replace function public.papa_discovery_feed_ids(
 p_mode text, p_user_id uuid, p_list_id uuid default null, p_folder_id text default null,
 p_cursor_at timestamptz default null, p_cursor_id uuid default null, p_limit integer default 20
) returns table(id uuid, at timestamptz, folder_id uuid)
language plpgsql stable security definer set search_path=public as $$
begin
 if p_mode not in ('list','saved') then raise exception 'invalid_mode'; end if;
 if p_mode='list' and p_list_id is null then raise exception 'list_required'; end if;
 if p_mode='saved' and p_user_id is null then raise exception 'user_required'; end if;
 return query
 select p.id, case when p_mode='saved' then b.created_at else p.published_at end,
   case when p_mode='saved' then b.folder_id else null::uuid end
 from posts p join users u on u.id=p.author_id
 left join user_preferences pr on pr.user_id=p.author_id
 left join bookmarks b on p_mode='saved' and b.post_id=p.id and b.user_id=p_user_id
 where p.deleted_at is null and p.is_draft=false and p.published_at<=now() and u.status='active'
  and (p_mode='list' and p.author_id in(select lm.user_id from list_members lm where lm.list_id=p_list_id)
    or p_mode='saved' and b.post_id is not null
      and (p_folder_id is null or p_folder_id='all' or (p_folder_id='none' and b.folder_id is null) or b.folder_id::text=p_folder_id))
  and (coalesce(pr.private_profile,false)=false or p.author_id=p_user_id or exists(select 1 from follows f where f.follower_id=p_user_id and f.followee_id=p.author_id))
  and not exists(select 1 from blocks bl where (bl.blocker_id=p_user_id and bl.blocked_id=p.author_id) or (bl.blocker_id=p.author_id and bl.blocked_id=p_user_id))
  and not exists(select 1 from mutes m where m.muter_id=p_user_id and m.muted_id=p.author_id)
  and (p_cursor_at is null or (case when p_mode='saved' then b.created_at else p.published_at end,p.id)<(p_cursor_at,p_cursor_id))
 order by case when p_mode='saved' then b.created_at else p.published_at end desc,p.id desc
 limit least(100,greatest(1,coalesce(p_limit,20)));
end $$;
revoke all on function public.papa_discovery_feed_ids(text,uuid,uuid,text,timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.papa_discovery_feed_ids(text,uuid,uuid,text,timestamptz,uuid,integer) to service_role;

-- ===== 0037_discovery_explore_rpc.sql =====
create or replace function public.papa_trending_tags(p_viewer_id uuid default null,p_limit integer default 8)
returns table(tag text,posts integer) language sql stable security definer set search_path=public as $$
 select h.tag,count(*)::integer
 from post_hashtags h join posts p on p.id=h.post_id join users u on u.id=p.author_id left join user_preferences pr on pr.user_id=p.author_id
 where p.published_at>now()-interval '3 days' and p.published_at<=now() and p.deleted_at is null and p.is_draft=false and u.status='active'
 and (p_viewer_id is not null or (coalesce(pr.private_profile,false)=false and coalesce(pr.visible_to_guests,true)))
 and (p_viewer_id is null or (not exists(select 1 from blocks b where (b.blocker_id=p_viewer_id and b.blocked_id=p.author_id) or (b.blocker_id=p.author_id and b.blocked_id=p_viewer_id)) and (not coalesce(pr.private_profile,false) or p.author_id=p_viewer_id or exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=p.author_id))))
 group by h.tag order by sum(1.0/(extract(epoch from now()-p.published_at)/3600+2)) desc,count(*) desc limit least(50,greatest(1,coalesce(p_limit,8)))
$$;
create or replace function public.papa_popular_post_ids(p_viewer_id uuid default null,p_limit integer default 20)
returns table(id uuid) language sql stable security definer set search_path=public as $$
 select p.id from posts p join users u on u.id=p.author_id left join user_preferences pr on pr.user_id=p.author_id
 where p.deleted_at is null and not p.is_draft and p.published_at>now()-interval '7 days' and p.published_at<=now() and p.reply_to_id is null and u.status='active'
 and (p_viewer_id is not null or (coalesce(pr.private_profile,false)=false and coalesce(pr.visible_to_guests,true)))
 and (p_viewer_id is null or (not exists(select 1 from blocks b where (b.blocker_id=p_viewer_id and b.blocked_id=p.author_id) or (b.blocker_id=p.author_id and b.blocked_id=p_viewer_id)) and not exists(select 1 from mutes m where m.muter_id=p_viewer_id and m.muted_id=p.author_id) and (not coalesce(pr.private_profile,false) or p.author_id=p_viewer_id or exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=p.author_id))))
 order by (p.like_count+2*p.repost_count+p.reply_count+p.quote_count) desc,p.published_at desc limit least(100,greatest(1,coalesce(p_limit,20)))
$$;
create or replace function public.papa_who_to_follow(p_viewer_id uuid default null,p_limit integer default 5)
returns table(id uuid,username text,full_name text,avatar_url text,verified boolean,bio text,assembly_name text,reason text)
language sql stable security definer set search_path=public as $$
 select u.id,u.username,u.full_name,u.avatar_url,(u.verified_at is not null),u.bio,a.name,
 case when u.assembly_id=me.assembly_id then 'assembly' when a.district_id=me.district_id then 'district' else 'popular' end
 from users u join assemblies a on a.id=u.assembly_id left join user_preferences pr on pr.user_id=u.id
 left join lateral (select mu.assembly_id,ma.district_id from users mu left join assemblies ma on ma.id=mu.assembly_id where mu.id=p_viewer_id) me on true
 where u.status='active' and u.onboarded_at is not null and (p_viewer_id is null or u.id<>p_viewer_id)
 and (p_viewer_id is not null or coalesce(pr.visible_to_guests,true))
 and (p_viewer_id is null or (not exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=u.id) and not exists(select 1 from follow_requests fr where fr.requester_id=p_viewer_id and fr.target_id=u.id) and not exists(select 1 from blocks b where (b.blocker_id=p_viewer_id and b.blocked_id=u.id) or (b.blocker_id=u.id and b.blocked_id=p_viewer_id))))
 order by (u.assembly_id=me.assembly_id) desc nulls last,(a.district_id=me.district_id) desc nulls last,(select count(*) from follows f2 where f2.followee_id=u.id) desc,u.verified_at desc nulls last,u.created_at desc limit least(50,greatest(1,coalesce(p_limit,5)))
$$;
revoke all on function public.papa_trending_tags(uuid,integer) from public,anon,authenticated;
revoke all on function public.papa_popular_post_ids(uuid,integer) from public,anon,authenticated;
revoke all on function public.papa_who_to_follow(uuid,integer) from public,anon,authenticated;
grant execute on function public.papa_trending_tags(uuid,integer) to service_role;
grant execute on function public.papa_popular_post_ids(uuid,integer) to service_role;
grant execute on function public.papa_who_to_follow(uuid,integer) to service_role;

-- ===== 0038_post_feed_rpc.sql =====
-- Server-only post feed entry selector. Authorization is enforced here, not in the client.
create or replace function public.papa_post_feed_entries(
 p_mode text,p_viewer_id uuid default null,p_author_id uuid default null,p_post_id uuid default null,p_tag text default null,
 p_cursor_at timestamptz default null,p_cursor_id uuid default null,p_page integer default 0,p_limit integer default 20
) returns table(post_id uuid,at timestamptz,reposter_username text,reposter_name text)
language plpgsql stable security definer set search_path=public as $$
begin
 if p_mode not in ('for_you','following','favorites','profile_posts','profile_replies','profile_media','profile_likes','hashtag','bookmarks','thread_replies') then raise exception 'invalid_feed_mode'; end if;
 if p_mode in ('following','favorites','profile_likes','bookmarks') and p_viewer_id is null then return; end if;
 if p_mode like 'profile_%' and p_author_id is null then raise exception 'author_required'; end if;
 return query
 with candidates as (
  select p.id as pid,p.published_at as ts,null::text as ru,null::text as rn,p.author_id,p.reply_to_id,p.is_draft,p.deleted_at,p.published_at,p.like_count,p.repost_count,p.reply_count,p.quote_count
  from posts p join users u on u.id=p.author_id left join user_preferences pr on pr.user_id=p.author_id
  where p.published_at is not null and p.published_at<=now() and not p.is_draft and p.deleted_at is null and u.status='active'
   and (p_viewer_id is not null or (coalesce(pr.private_profile,false)=false and coalesce(pr.visible_to_guests,true)))
   and (p_viewer_id is null or (not exists(select 1 from blocks b where (b.blocker_id=p_viewer_id and b.blocked_id=p.author_id) or (b.blocker_id=p.author_id and b.blocked_id=p_viewer_id)) and (not coalesce(pr.private_profile,false) or p.author_id=p_viewer_id or exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=p.author_id))))
   and case p_mode
    when 'for_you' then p.reply_to_id is null and p.published_at>now()-interval '21 days' and (p_viewer_id is null or not exists(select 1 from mutes m where m.muter_id=p_viewer_id and m.muted_id=p.author_id))
    when 'following' then p.reply_to_id is null and (p.author_id=p_viewer_id or exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=p.author_id)) and (p_viewer_id is null or not exists(select 1 from mutes m where m.muter_id=p_viewer_id and m.muted_id=p.author_id))
    when 'favorites' then p.reply_to_id is null and exists(select 1 from favorites fa where fa.user_id=p_viewer_id and fa.favorite_id=p.author_id)
    when 'profile_posts' then p.author_id=p_author_id and p.reply_to_id is null and not exists(select 1 from pinned_posts pp where pp.post_id=p.id)
    when 'profile_replies' then p.author_id=p_author_id and p.reply_to_id is not null
    when 'profile_media' then p.author_id=p_author_id and exists(select 1 from post_media pm where pm.post_id=p.id)
    when 'profile_likes' then p_viewer_id=p_author_id and exists(select 1 from likes l where l.user_id=p_author_id and l.post_id=p.id)
    when 'hashtag' then exists(select 1 from post_hashtags h where h.post_id=p.id and h.tag=lower(p_tag)) and (p_viewer_id is null or not exists(select 1 from mutes m where m.muter_id=p_viewer_id and m.muted_id=p.author_id))
    when 'bookmarks' then exists(select 1 from bookmarks b where b.user_id=p_viewer_id and b.post_id=p.id)
    when 'thread_replies' then p.reply_to_id=p_post_id and (p_viewer_id is null or not exists(select 1 from mutes m where m.muter_id=p_viewer_id and m.muted_id=p.author_id))
    else false end
  union all
  select p.id,r.created_at,ru.username,ru.full_name,p.author_id,p.reply_to_id,p.is_draft,p.deleted_at,p.published_at,p.like_count,p.repost_count,p.reply_count,p.quote_count
  from reposts r join users ru on ru.id=r.user_id join posts p on p.id=r.post_id join users u on u.id=p.author_id left join user_preferences pr on pr.user_id=p.author_id
  where p_mode in ('following','profile_posts') and (
    (p_mode='following' and r.user_id<>p_viewer_id and exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=r.user_id))
    or (p_mode='profile_posts' and r.user_id=p_author_id)
   )
   and p.deleted_at is null and not p.is_draft and p.published_at<=now() and u.status='active'
   and (p_viewer_id is not null or (coalesce(pr.private_profile,false)=false and coalesce(pr.visible_to_guests,true)))
   and (p_viewer_id is null or (not exists(select 1 from blocks b where (b.blocker_id=p_viewer_id and b.blocked_id=p.author_id) or (b.blocker_id=p.author_id and b.blocked_id=p_viewer_id)) and (not coalesce(pr.private_profile,false) or p.author_id=p_viewer_id or exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=p.author_id))))
   and (p_mode<>'following' or not exists(select 1 from mutes m where m.muter_id=p_viewer_id and m.muted_id=p.author_id))
 )
 select c.pid,c.ts,c.ru,c.rn from candidates c
 where (p_cursor_at is null or (c.ts,c.pid)<(p_cursor_at,p_cursor_id))
 order by
  case when p_mode='for_you' then (
    (c.like_count*2+c.repost_count*3+c.reply_count*2+c.quote_count*2+1)::numeric
    * (1
      + case when p_viewer_id is not null and exists(select 1 from follows f where f.follower_id=p_viewer_id and f.followee_id=c.author_id) then 1.5 else 0 end
      + case when p_viewer_id is not null and (select assembly_id from users where id=c.author_id)=(select assembly_id from users where id=p_viewer_id) then 0.8 else 0 end
      + case when p_viewer_id is not null and (select district_id from assemblies where id=(select assembly_id from users where id=c.author_id))=(select district_id from assemblies where id=(select assembly_id from users where id=p_viewer_id)) then 0.4 else 0 end
      + case when exists(select 1 from users uu where uu.id=c.author_id and uu.verified_at is not null) then 0.3 else 0 end)
    / power(extract(epoch from (now()-c.published_at))/3600+2,1.5)
  ) else 0 end desc,
  case when p_mode='thread_replies' and c.author_id=(select author_id from posts where id=p_post_id) then 1 else 0 end desc,
  case when p_mode='thread_replies' then c.like_count else 0 end desc,
  case when p_mode='thread_replies' then c.published_at end asc nulls last,
  case when p_mode<>'thread_replies' then c.ts end desc,c.pid desc
 limit least(100,greatest(1,coalesce(p_limit,20))) offset case when p_mode='for_you' then greatest(0,p_page)*least(100,greatest(1,coalesce(p_limit,20))) else 0 end;
end $$;

create or replace function public.papa_post_engagers(p_post_id uuid,p_kind text,p_viewer_id uuid default null)
returns table(id uuid,username text,full_name text,avatar_url text,bio text,assembly_name text,verified boolean)
language plpgsql stable security definer set search_path=public as $$
begin
 if p_kind not in ('likes','reposts') then raise exception 'invalid_engager_kind'; end if;
 return query execute format('select u.id,u.username,u.full_name,u.avatar_url,u.bio,a.name,(u.verified_at is not null) from %I x join users u on u.id=x.user_id join assemblies a on a.id=u.assembly_id where x.post_id=$1 and u.status=''active'' and ($2 is null or not exists(select 1 from blocks b where (b.blocker_id=$2 and b.blocked_id=u.id) or (b.blocker_id=u.id and b.blocked_id=$2))) order by x.created_at desc limit 100',p_kind) using p_post_id,p_viewer_id;
end $$;
revoke all on function public.papa_post_feed_entries(text,uuid,uuid,uuid,text,timestamptz,uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.papa_post_engagers(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.papa_post_feed_entries(text,uuid,uuid,uuid,text,timestamptz,uuid,integer,integer) to service_role;
grant execute on function public.papa_post_engagers(uuid,text,uuid) to service_role;

-- ===== 0039_church_member_sync_rpc.sql =====
-- Atomically synchronize an external church register row and its district/assembly parents.
create or replace function public.papa_sync_church_member(
 p_church_id text,p_full_name text,p_phone text,p_active boolean,p_date_of_birth date,
 p_district_external_id text,p_district_name text,p_district_slug text,
 p_assembly_external_id text,p_assembly_name text,p_assembly_town text,p_assembly_slug text
) returns uuid language plpgsql security definer set search_path=public as $$
declare d_id uuid; a_id uuid;
begin
 insert into districts(external_id,name,slug) values(p_district_external_id,p_district_name,p_district_slug)
 on conflict(external_id) do update set name=excluded.name,slug=excluded.slug returning id into d_id;
 insert into assemblies(external_id,district_id,name,town,slug) values(p_assembly_external_id,d_id,p_assembly_name,p_assembly_town,p_assembly_slug)
 on conflict(external_id) do update set district_id=excluded.district_id,name=excluded.name,town=excluded.town,slug=excluded.slug returning id into a_id;
 insert into church_members(church_id,full_name,phone,assembly_id,active,date_of_birth,synced_at)
 values(p_church_id,p_full_name,p_phone,a_id,p_active,p_date_of_birth,now())
 on conflict(church_id) do update set full_name=excluded.full_name,phone=excluded.phone,assembly_id=excluded.assembly_id,active=excluded.active,date_of_birth=excluded.date_of_birth,synced_at=now();
 return a_id;
end $$;
revoke all on function public.papa_sync_church_member(text,text,text,boolean,date,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.papa_sync_church_member(text,text,text,boolean,date,text,text,text,text,text,text,text) to service_role;

-- ===== 0040_scope_notifications_rpc.sql =====
create or replace function public.papa_notify_scope(
 p_key text,p_type text,p_actor_id uuid,p_announcement_id uuid default null,p_event_id uuid default null,p_live_id uuid default null
) returns table(user_id uuid) language plpgsql security definer set search_path=public as $$
begin
 if p_type not in ('announcement','event','live') then raise exception 'invalid_notification_type'; end if;
 if p_key<>'national' and p_key !~ '^[da]:[0-9a-fA-F-]{36}$' then raise exception 'invalid_scope_key'; end if;
 return query insert into notifications(user_id,type,actor_id,announcement_id,event_id,live_id)
 select u.id,p_type::notification_type,p_actor_id,p_announcement_id,p_event_id,p_live_id
 from users u left join notification_settings ns on ns.user_id=u.id
 where u.status='active' and u.id<>p_actor_id
 and coalesce((select ls.on from level_subscriptions ls where ls.user_id=u.id and ls.scope=p_key),
   case when p_key='national' then true when left(p_key,2)='d:' then exists(select 1 from assemblies a where a.id=u.assembly_id and a.district_id=substring(p_key from 3)::uuid) else u.assembly_id=substring(p_key from 3)::uuid end)
 and coalesce((ns.prefs->p_type->>'inApp')::boolean,true)
 and not exists(select 1 from blocks b where (b.blocker_id=u.id and b.blocked_id=p_actor_id) or (b.blocker_id=p_actor_id and b.blocked_id=u.id))
 and not exists(select 1 from mutes m where m.muter_id=u.id and m.muted_id=p_actor_id)
 returning notifications.user_id;
end $$;

create or replace function public.papa_scope_push_subscriptions(p_key text,p_type text,p_actor_id uuid)
returns table(id uuid,endpoint text,p256dh text,auth text)
language sql stable security definer set search_path=public as $$
 select s.id,s.endpoint,s.p256dh,s.auth from push_subscriptions s join users u on u.id=s.user_id
 left join notification_settings ns on ns.user_id=u.id
 where u.status='active' and u.id<>p_actor_id
 and coalesce((select ls.on from level_subscriptions ls where ls.user_id=u.id and ls.scope=p_key),
   case when p_key='national' then true when left(p_key,2)='d:' then exists(select 1 from assemblies a where a.id=u.assembly_id and a.district_id=substring(p_key from 3)::uuid) else u.assembly_id=substring(p_key from 3)::uuid end)
 and coalesce((ns.prefs->p_type->>'push')::boolean,true)
 and not exists(select 1 from blocks b where (b.blocker_id=u.id and b.blocked_id=p_actor_id) or (b.blocker_id=p_actor_id and b.blocked_id=u.id))
 and not exists(select 1 from mutes m where m.muter_id=u.id and m.muted_id=p_actor_id)
$$;
revoke all on function public.papa_notify_scope(text,text,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.papa_scope_push_subscriptions(text,text,uuid) from public,anon,authenticated;
grant execute on function public.papa_notify_scope(text,text,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.papa_scope_push_subscriptions(text,text,uuid) to service_role;

-- ===== 0041_announcements_rpc.sql =====
create or replace function public.papa_create_announcement(
 p_author_id uuid,p_level text,p_district_id uuid,p_assembly_id uuid,p_title text,p_body text,p_important boolean,p_media jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v jsonb;
begin
 if p_level not in ('national','district','local') then raise exception 'invalid_level'; end if;
 if (p_level='national' and (p_district_id is not null or p_assembly_id is not null)) or (p_level='district' and (p_district_id is null or p_assembly_id is not null)) or (p_level='local' and p_assembly_id is null) then raise exception 'invalid_scope'; end if;
 insert into announcements(author_id,level,district_id,assembly_id,title,body,important)
 values(p_author_id,p_level::level,p_district_id,p_assembly_id,p_title,p_body,p_important) returning id into v_id;
 for v in select value from jsonb_array_elements(coalesce(p_media,'[]'::jsonb)) loop
  insert into announcement_media(announcement_id,url,alt,width,height,position)
  values(v_id,v->>'url',nullif(v->>'alt',''),nullif(v->>'width','')::integer,nullif(v->>'height','')::integer,coalesce((v->>'position')::smallint,0));
 end loop;
 return v_id;
end $$;

create or replace function public.papa_edit_announcement(p_author_id uuid,p_id uuid,p_title text,p_body text,p_important boolean,p_media jsonb default '[]'::jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
 update announcements set title=p_title,body=p_body,important=p_important,edited_at=now()
 where id=p_id and author_id=p_author_id and deleted_at is null;
 if not found then return false; end if;
 delete from announcement_media where announcement_id=p_id;
 for v in select value from jsonb_array_elements(coalesce(p_media,'[]'::jsonb)) loop
  insert into announcement_media(announcement_id,url,alt,width,height,position)
  values(p_id,v->>'url',nullif(v->>'alt',''),nullif(v->>'width','')::integer,nullif(v->>'height','')::integer,coalesce((v->>'position')::smallint,0));
 end loop;
 return true;
end $$;

create or replace function public.papa_delete_announcement(p_user_id uuid,p_id uuid,p_as_admin boolean default false)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update announcements set deleted_at=now() where id=p_id and deleted_at is null and (p_as_admin or author_id=p_user_id);
 if not found then return false; end if;
 delete from notifications where announcement_id=p_id;
 return true;
end $$;
create or replace function public.papa_increment_announcement_view(p_id uuid)
returns integer language sql security definer set search_path=public as $$
 update announcements set view_count=view_count+1 where id=p_id and deleted_at is null returning view_count
$$;
create or replace function public.papa_list_announcement_ids(
 p_level text default null,p_district_id uuid default null,p_assembly_id uuid default null,p_author_id uuid default null,
 p_query text default null,p_keys text[] default null,p_page integer default 1,p_page_size integer default 20
) returns table(id uuid) language sql stable security definer set search_path=public as $$
 select a.id from announcements a
 where a.deleted_at is null
 and (p_level is null or a.level=p_level::level)
 and (p_district_id is null or a.district_id=p_district_id)
 and (p_assembly_id is null or a.assembly_id=p_assembly_id)
 and (p_author_id is null or a.author_id=p_author_id)
 and (p_query is null or (a.title ilike '%'||replace(replace(replace(p_query,'\\','\\\\'),'%','\\%'),'_','\\_')||'%' escape '\\') or to_tsvector('simple',a.title||' '||a.body) @@ plainto_tsquery('simple',p_query))
 and (p_keys is null or (case a.level when 'national' then 'national' when 'district' then 'd:'||a.district_id else 'a:'||a.assembly_id end)=any(p_keys))
 order by case when p_level is not null and a.important and a.created_at>now()-interval '7 days' then 1 else 0 end desc,a.created_at desc
 limit least(101,greatest(1,coalesce(p_page_size,20))+1) offset (greatest(1,coalesce(p_page,1))-1)*least(100,greatest(1,coalesce(p_page_size,20)))
$$;
revoke all on function public.papa_create_announcement(uuid,text,uuid,uuid,text,text,boolean,jsonb) from public,anon,authenticated;
revoke all on function public.papa_edit_announcement(uuid,uuid,text,text,boolean,jsonb) from public,anon,authenticated;
revoke all on function public.papa_delete_announcement(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.papa_increment_announcement_view(uuid) from public,anon,authenticated;
revoke all on function public.papa_list_announcement_ids(text,uuid,uuid,uuid,text,text[],integer,integer) from public,anon,authenticated;
grant execute on function public.papa_create_announcement(uuid,text,uuid,uuid,text,text,boolean,jsonb) to service_role;
grant execute on function public.papa_edit_announcement(uuid,uuid,text,text,boolean,jsonb) to service_role;
grant execute on function public.papa_delete_announcement(uuid,uuid,boolean) to service_role;
grant execute on function public.papa_increment_announcement_view(uuid) to service_role;
grant execute on function public.papa_list_announcement_ids(text,uuid,uuid,uuid,text,text[],integer,integer) to service_role;

-- ===== 0042_prayer_mutations_rpc.sql =====
create or replace function public.papa_set_prayed(p_user_id uuid,p_prayer_id uuid,p_on boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_author uuid; v_count integer;
begin
 select author_id into v_author from prayer_requests where id=p_prayer_id and deleted_at is null;
 if v_author is null then return null; end if;
 if p_on then insert into prayer_prayed(prayer_id,user_id) values(p_prayer_id,p_user_id) on conflict do nothing;
 else delete from prayer_prayed where prayer_id=p_prayer_id and user_id=p_user_id; end if;
 select count(*)::integer into v_count from prayer_prayed where prayer_id=p_prayer_id;
 update prayer_requests set prayed_count=v_count where id=p_prayer_id;
 return jsonb_build_object('author_id',v_author,'prayed_count',v_count);
end $$;
create or replace function public.papa_mark_prayer_answered(p_author_id uuid,p_prayer_id uuid,p_note text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_anonymous boolean; v_people uuid[];
begin
 update prayer_requests set answered_at=now(),answer_note=p_note where id=p_prayer_id and author_id=p_author_id and deleted_at is null and answered_at is null returning anonymous into v_anonymous;
 if not found then return null; end if;
 select coalesce(array_agg(user_id),array[]::uuid[]) into v_people from prayer_prayed where prayer_id=p_prayer_id;
 return jsonb_build_object('anonymous',v_anonymous,'prayed_by',to_jsonb(v_people));
end $$;
create or replace function public.papa_delete_prayer(p_user_id uuid,p_prayer_id uuid,p_as_admin boolean default false)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update prayer_requests set deleted_at=now() where id=p_prayer_id and deleted_at is null and (p_as_admin or author_id=p_user_id);
 if not found then return false; end if;
 delete from notifications where prayer_id=p_prayer_id;return true;
end $$;
revoke all on function public.papa_set_prayed(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.papa_mark_prayer_answered(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.papa_delete_prayer(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.papa_set_prayed(uuid,uuid,boolean) to service_role;
grant execute on function public.papa_mark_prayer_answered(uuid,uuid,text) to service_role;
grant execute on function public.papa_delete_prayer(uuid,uuid,boolean) to service_role;

-- ===== 0043_testimony_mutations_rpc.sql =====
create or replace function public.papa_create_testimony(p_author_id uuid,p_title text,p_body text,p_prayer_id uuid,p_media jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v jsonb;
begin
 if p_prayer_id is not null and not exists(select 1 from prayer_requests where id=p_prayer_id and author_id=p_author_id and deleted_at is null) then return null; end if;
 insert into testimonies(author_id,title,body,prayer_id) values(p_author_id,p_title,p_body,p_prayer_id) returning id into v_id;
 for v in select value from jsonb_array_elements(coalesce(p_media,'[]'::jsonb)) loop
  insert into testimony_media(testimony_id,url,alt,width,height,position) values(v_id,v->>'url',nullif(v->>'alt',''),nullif(v->>'width','')::integer,nullif(v->>'height','')::integer,coalesce((v->>'position')::smallint,0));
 end loop;return v_id;
end $$;
create or replace function public.papa_edit_testimony(p_author_id uuid,p_id uuid,p_title text,p_body text,p_media jsonb default '[]'::jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
 update testimonies set title=p_title,body=p_body,edited_at=now() where id=p_id and author_id=p_author_id and deleted_at is null;
 if not found then return false;end if;delete from testimony_media where testimony_id=p_id;
 for v in select value from jsonb_array_elements(coalesce(p_media,'[]'::jsonb)) loop
  insert into testimony_media(testimony_id,url,alt,width,height,position) values(p_id,v->>'url',nullif(v->>'alt',''),nullif(v->>'width','')::integer,nullif(v->>'height','')::integer,coalesce((v->>'position')::smallint,0));
 end loop;return true;
end $$;
create or replace function public.papa_delete_testimony(p_user_id uuid,p_id uuid,p_as_admin boolean default false)
returns boolean language plpgsql security definer set search_path=public as $$
begin update testimonies set deleted_at=now() where id=p_id and deleted_at is null and (p_as_admin or author_id=p_user_id);if not found then return false;end if;delete from notifications where testimony_id=p_id;return true;end $$;
create or replace function public.papa_set_testimony_praise(p_user_id uuid,p_testimony_id uuid,p_on boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_author uuid;v_count integer;
begin select author_id into v_author from testimonies where id=p_testimony_id and deleted_at is null;if v_author is null then return null;end if;
 if p_on then insert into testimony_praises(testimony_id,user_id) values(p_testimony_id,p_user_id) on conflict do nothing;else delete from testimony_praises where testimony_id=p_testimony_id and user_id=p_user_id;end if;
 select count(*)::integer into v_count from testimony_praises where testimony_id=p_testimony_id;update testimonies set praise_count=v_count where id=p_testimony_id;return jsonb_build_object('author_id',v_author,'praise_count',v_count);
end $$;
revoke all on function public.papa_create_testimony(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.papa_edit_testimony(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.papa_delete_testimony(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.papa_set_testimony_praise(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.papa_create_testimony(uuid,text,text,uuid,jsonb) to service_role;
grant execute on function public.papa_edit_testimony(uuid,uuid,text,text,jsonb) to service_role;
grant execute on function public.papa_delete_testimony(uuid,uuid,boolean) to service_role;
grant execute on function public.papa_set_testimony_praise(uuid,uuid,boolean) to service_role;

-- ===== 0044_events_rpc.sql =====
create or replace function public.papa_create_event(p_author_id uuid,p_level text,p_district_id uuid,p_assembly_id uuid,p_event jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if p_level not in ('national','district','local') then raise exception 'invalid_level';end if;
 insert into events(author_id,level,district_id,assembly_id,title,description,starts_at,ends_at,venue,address,lat,lng,online_url,cover_url)
 values(p_author_id,p_level::level,p_district_id,p_assembly_id,p_event->>'title',coalesce(p_event->>'description',''),(p_event->>'starts_at')::timestamptz,nullif(p_event->>'ends_at','')::timestamptz,p_event->>'venue',p_event->>'address',nullif(p_event->>'lat','')::double precision,nullif(p_event->>'lng','')::double precision,p_event->>'online_url',p_event->>'cover_url') returning id into v_id;
 insert into event_rsvps(event_id,user_id,status) values(v_id,p_author_id,'going');
 update events set going_count=1 where id=v_id;return v_id;
end $$;
create or replace function public.papa_update_event(p_author_id uuid,p_event_id uuid,p_event jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_old timestamptz;v_new timestamptz;
begin
 v_new:=(p_event->>'starts_at')::timestamptz;
 update events set title=p_event->>'title',description=coalesce(p_event->>'description',''),starts_at=v_new,ends_at=nullif(p_event->>'ends_at','')::timestamptz,venue=p_event->>'venue',address=p_event->>'address',lat=nullif(p_event->>'lat','')::double precision,lng=nullif(p_event->>'lng','')::double precision,online_url=p_event->>'online_url',cover_url=p_event->>'cover_url',updated_at=now(),reminded_day_at=case when starts_at is distinct from v_new then null else reminded_day_at end,reminded_hour_at=case when starts_at is distinct from v_new then null else reminded_hour_at end
 where id=p_event_id and author_id=p_author_id and deleted_at is null and cancelled_at is null;
 return found;
end $$;
create or replace function public.papa_cancel_event(p_author_id uuid,p_event_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_users uuid[];
begin update events set cancelled_at=now(),updated_at=now() where id=p_event_id and author_id=p_author_id and cancelled_at is null and deleted_at is null;if not found then return null;end if;
 select coalesce(array_agg(user_id),array[]::uuid[]) into v_users from event_rsvps where event_id=p_event_id;return jsonb_build_object('users',to_jsonb(v_users));end $$;
create or replace function public.papa_delete_event(p_user_id uuid,p_event_id uuid,p_as_admin boolean default false)
returns boolean language plpgsql security definer set search_path=public as $$
begin update events set deleted_at=now(),updated_at=now() where id=p_event_id and deleted_at is null and (p_as_admin or author_id=p_user_id);if not found then return false;end if;delete from notifications where event_id=p_event_id;return true;end $$;
create or replace function public.papa_set_event_rsvp(p_user_id uuid,p_event_id uuid,p_status text)
returns text language plpgsql security definer set search_path=public as $$
declare v events%rowtype;
begin select * into v from events where id=p_event_id and deleted_at is null; if not found then return 'not_found';end if;if v.cancelled_at is not null then return 'cancelled';end if;if coalesce(v.ends_at,v.starts_at)<now() then return 'ended';end if;
 if p_status is null then delete from event_rsvps where event_id=p_event_id and user_id=p_user_id;
 elsif p_status in ('going','interested') then insert into event_rsvps(event_id,user_id,status) values(p_event_id,p_user_id,p_status::rsvp_status) on conflict(event_id,user_id) do update set status=excluded.status;
 else raise exception 'invalid_rsvp';end if;
 update events set going_count=(select count(*)::integer from event_rsvps where event_id=p_event_id and status='going'),interested_count=(select count(*)::integer from event_rsvps where event_id=p_event_id and status='interested') where id=p_event_id;return 'ok';end $$;
create or replace function public.papa_list_event_ids(
 p_filter text default 'all',p_viewer_id uuid default null,p_home_district_id uuid default null,p_home_assembly_id uuid default null,p_district_id uuid default null,p_assembly_id uuid default null,p_from timestamptz default null,p_to timestamptz default null,p_query text default null,p_page integer default 1,p_page_size integer default 20
) returns table(id uuid) language sql stable security definer set search_path=public as $$
 select e.id from events e where e.deleted_at is null
 and (p_from is not null or p_to is not null or case when p_filter='past' then coalesce(e.ends_at,e.starts_at+interval '3 hours')<now() else coalesce(e.ends_at,e.starts_at+interval '3 hours')>=now() end)
 and (p_from is null or e.starts_at>=p_from) and (p_to is null or e.starts_at<p_to)
 and (p_filter not in ('national') or e.level='national')
 and (p_filter<>'district' or (p_home_district_id is not null and (e.district_id=p_home_district_id or e.assembly_id in(select a.id from assemblies a where a.district_id=p_home_district_id))))
 and (p_filter<>'local' or (p_home_assembly_id is not null and e.assembly_id=p_home_assembly_id))
 and (p_filter<>'going' or (p_viewer_id is not null and exists(select 1 from event_rsvps r where r.event_id=e.id and r.user_id=p_viewer_id)))
 and (p_filter<>'hosting' or (p_viewer_id is not null and e.author_id=p_viewer_id))
 and (p_district_id is null or e.district_id=p_district_id or e.assembly_id in(select a.id from assemblies a where a.district_id=p_district_id))
 and (p_assembly_id is null or e.assembly_id=p_assembly_id)
 and (p_query is null or position(lower(p_query) in lower(e.title))>0 or position(lower(p_query) in lower(coalesce(e.venue,'')))>0)
 order by case when p_filter='past' and p_from is null then 1 else 0 end desc,case when p_filter='past' and p_from is null then e.starts_at end desc,case when not(p_filter='past' and p_from is null) then e.starts_at end asc
 limit least(101,greatest(1,coalesce(p_page_size,20))+1) offset (greatest(1,coalesce(p_page,1))-1)*least(100,greatest(1,coalesce(p_page_size,20)))
$$;
create or replace function public.papa_claim_event_reminders(p_kind text)
returns table(id uuid,author_id uuid) language plpgsql security definer set search_path=public as $$
begin
 if p_kind='day' then return query update events e set reminded_day_at=now() where reminded_day_at is null and deleted_at is null and cancelled_at is null and starts_at>now()+interval '2 hours' and starts_at<=now()+interval '24 hours' returning e.id,e.author_id;
 elsif p_kind='hour' then return query update events e set reminded_hour_at=now() where reminded_hour_at is null and deleted_at is null and cancelled_at is null and starts_at>now() and starts_at<=now()+interval '1 hour' returning e.id,e.author_id;
 else raise exception 'invalid_reminder_kind';end if;
end $$;
revoke all on function public.papa_create_event(uuid,text,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.papa_update_event(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.papa_cancel_event(uuid,uuid) from public,anon,authenticated;
revoke all on function public.papa_delete_event(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.papa_set_event_rsvp(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.papa_list_event_ids(text,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,integer,integer) from public,anon,authenticated;
revoke all on function public.papa_claim_event_reminders(text) from public,anon,authenticated;
grant execute on function public.papa_create_event(uuid,text,uuid,uuid,jsonb) to service_role;
grant execute on function public.papa_update_event(uuid,uuid,jsonb) to service_role;
grant execute on function public.papa_cancel_event(uuid,uuid) to service_role;
grant execute on function public.papa_delete_event(uuid,uuid,boolean) to service_role;
grant execute on function public.papa_set_event_rsvp(uuid,uuid,text) to service_role;
grant execute on function public.papa_list_event_ids(text,uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,text,integer,integer) to service_role;
grant execute on function public.papa_claim_event_reminders(text) to service_role;

-- ===== 0045_cli_admin_rpc.sql =====
create or replace function public.papa_cli_grant_admin(p_username text,p_remove boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_name text;
begin
 update users set role=case when p_remove then 'member'::user_role else 'tech_admin'::user_role end,updated_at=now()
 where lower(username)=lower(ltrim(p_username,'@')) returning id,full_name into v_id,v_name;
 if not found then return null;end if;
 insert into audit_log(actor_id,action,target,meta) values(null,case when p_remove then 'admin.revoked_cli' else 'admin.granted_cli' end,lower(ltrim(p_username,'@')),jsonb_build_object('source','cli'));
 return jsonb_build_object('name',v_name,'user_id',v_id);
end $$;
revoke all on function public.papa_cli_grant_admin(text,boolean) from public,anon,authenticated;
grant execute on function public.papa_cli_grant_admin(text,boolean) to service_role;

-- ===== 0046_market_admin_rpc.sql =====
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

-- ===== 0047_resource_order_rpc.sql =====
-- Atomic stock reservation and resource-order settlement for the Supabase JS backend.
create or replace function public.papa_place_resource_order(p_resource_id uuid,p_buyer_id uuid,p_size text,p_qty integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r resources%rowtype; o resource_orders%rowtype; found_size boolean:=false;
begin
 if p_qty is null or p_qty<1 or p_qty>20 then return null; end if;
 select * into r from resources where id=p_resource_id and active and deleted_at is null for update;
 if not found then return null; end if;
 if r.kind='uniform' then
   if p_size is null then return null; end if;
   select exists(select 1 from jsonb_array_elements(r.sizes) s where s->>'size'=p_size and coalesce((s->>'stock')::integer,0)>=p_qty) into found_size;
   if not found_size then return null; end if;
   update resources set sizes=(select coalesce(jsonb_agg(case when s->>'size'=p_size then jsonb_set(s,'{stock}',to_jsonb((s->>'stock')::integer-p_qty)) else s end),'[]'::jsonb) from jsonb_array_elements(r.sizes) s) where id=p_resource_id;
 else
   p_size:=null; p_qty:=1;
 end if;
 insert into resource_orders(resource_id,buyer_id,size,qty,total_pesewas,status)
 values(r.id,p_buyer_id,p_size,p_qty,r.price_pesewas*p_qty,'pending_payment') returning * into o;
 return jsonb_build_object('id',o.id,'total_pesewas',o.total_pesewas,'resource_id',o.resource_id,'size',o.size,'qty',o.qty,'status',o.status);
end $$;

create or replace function public.papa_set_resource_order_payment(p_order_id uuid,p_success boolean,p_collection_code text)
returns boolean language plpgsql security definer set search_path=public as $$
declare o resource_orders%rowtype; k resource_kind;
begin
 select * into o from resource_orders where id=p_order_id for update;
 if not found or o.status<>'pending_payment' then return false; end if;
 if p_success then
   select kind into k from resources where id=o.resource_id;
   update resource_orders set status=case when k='study_guide' then 'collected'::resource_order_status else 'paid'::resource_order_status end,
     paid_at=now(),collection_code=p_collection_code,collected_at=case when k='study_guide' then now() else null end where id=o.id;
 else
   update resource_orders set status='cancelled' where id=o.id;
   if o.size is not null then
     update resources set sizes=(select coalesce(jsonb_agg(case when s->>'size'=o.size then jsonb_set(s,'{stock}',to_jsonb(coalesce((s->>'stock')::integer,0)+o.qty)) else s end),'[]'::jsonb) from jsonb_array_elements(sizes) s) where id=o.resource_id;
   end if;
 end if;
 return true;
end $$;

create or replace function public.papa_manage_resource_order(p_order_id uuid,p_action text,p_actor_id uuid,p_code text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare o resource_orders%rowtype;
begin
 select * into o from resource_orders where id=p_order_id for update;
 if not found then return false; end if;
 if p_action='ready' and o.status='paid' then
   update resource_orders set status='ready',ready_at=now(),handled_by=p_actor_id where id=o.id; return true;
 elsif p_action='collected' and o.status in ('paid','ready') and p_code is not null and p_code=o.collection_code then
   update resource_orders set status='collected',collected_at=now(),handled_by=p_actor_id where id=o.id; return true;
 elsif p_action='cancel' and o.status in ('paid','ready') then
   update resource_orders set status='cancelled',handled_by=p_actor_id where id=o.id;
   update payments set status='refunded' where resource_order_id=o.id and status='success';
   if o.size is not null then
     update resources set sizes=(select coalesce(jsonb_agg(case when s->>'size'=o.size then jsonb_set(s,'{stock}',to_jsonb(coalesce((s->>'stock')::integer,0)+o.qty)) else s end),'[]'::jsonb) from jsonb_array_elements(sizes) s) where id=o.resource_id;
   end if;
   return true;
 end if;
 return false;
end $$;
revoke all on function public.papa_place_resource_order(uuid,uuid,text,integer) from public,anon,authenticated;
revoke all on function public.papa_set_resource_order_payment(uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.papa_manage_resource_order(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.papa_place_resource_order(uuid,uuid,text,integer) to service_role;
grant execute on function public.papa_set_resource_order_payment(uuid,boolean,text) to service_role;
grant execute on function public.papa_manage_resource_order(uuid,text,uuid,text) to service_role;

-- ===== 0048_audit_log_created_at_order.sql =====
-- Correct the audit JSON aggregation order to reference its quoted camelCase alias.
create or replace function public.papa_list_audit_log(p_action text default null,p_actor text default null,p_from timestamptz default null,p_to timestamptz default null,p_page integer default 1,p_page_size integer default 50)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_page integer:=greatest(1,coalesce(p_page,1)); v_size integer:=least(100,greatest(1,coalesce(p_page_size,50))); v_total bigint; v_rows jsonb;
begin
 select count(*) into v_total from audit_log a left join users u on u.id=a.actor_id
 where (nullif(p_action,'') is null or a.action ilike replace(replace(replace(p_action,'\','\\'),'%','\%'),'_','\_')||'%' escape '\')
 and (nullif(p_actor,'') is null or lower(coalesce(u.username,''))=lower(ltrim(p_actor,'@')))
 and (p_from is null or a.created_at>=p_from) and (p_to is null or a.created_at<=p_to);
 select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt" desc),'[]'::jsonb) into v_rows from (
 select a.id,a.action,a.target,a.meta,a.ip,a.created_at as "createdAt",u.username,u.full_name as "fullName" from audit_log a left join users u on u.id=a.actor_id
 where (nullif(p_action,'') is null or a.action ilike replace(replace(replace(p_action,'\','\\'),'%','\%'),'_','\_')||'%' escape '\')
 and (nullif(p_actor,'') is null or lower(coalesce(u.username,''))=lower(ltrim(p_actor,'@')))
 and (p_from is null or a.created_at>=p_from) and (p_to is null or a.created_at<=p_to)
 order by a.created_at desc limit v_size offset (v_page-1)*v_size) x;
 return jsonb_build_object('rows',v_rows,'total',v_total,'page',v_page,'pages',greatest(1,ceil(v_total::numeric/v_size)::integer));
end $$;
