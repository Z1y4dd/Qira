CREATE TYPE "public"."escape_hatch_reason" AS ENUM('too_hard', 'too_easy');--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD COLUMN "choice_order" jsonb;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "escape_hatched" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "escape_hatched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "escape_hatched_reason" "escape_hatch_reason";--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "placement_bank_version" integer;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "is_placeholder" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "texts" ADD COLUMN "is_placeholder" boolean DEFAULT false NOT NULL;