-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
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
