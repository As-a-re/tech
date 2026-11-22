-- Generated from supabase/all-migrations.sql; keep both copies synchronized.
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
