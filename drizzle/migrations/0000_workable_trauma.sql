CREATE TYPE "public"."attempt_kind" AS ENUM('placement', 'reading');--> statement-breakpoint
CREATE TYPE "public"."question_kind" AS ENUM('placement', 'comprehension');--> statement-breakpoint
CREATE TABLE "attempt_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"chosen_choice_id" uuid NOT NULL,
	"is_correct" integer NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempt_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"kind" "attempt_kind" NOT NULL,
	"text_id" uuid,
	"assigned_level_id" uuid,
	"score" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "child_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"age" smallint NOT NULL,
	"grade_band" text NOT NULL,
	"current_level_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "child_profiles_age_range" CHECK ("child_profiles"."age" BETWEEN 5 AND 12)
);
--> statement-breakpoint
ALTER TABLE "child_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "choices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"text_ar" text NOT NULL,
	"position" smallint NOT NULL,
	"is_correct" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "choices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" smallint NOT NULL,
	"name_ar" text NOT NULL,
	"description_ar" text,
	CONSTRAINT "levels_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "levels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "parents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "question_kind" NOT NULL,
	"text_id" uuid,
	"level_id" uuid,
	"prompt_ar" text NOT NULL,
	"question_type" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "texts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level_id" uuid NOT NULL,
	"title_ar" text NOT NULL,
	"body_ar" text NOT NULL,
	"word_count" integer NOT NULL,
	"genre" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "texts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_chosen_choice_id_choices_id_fk" FOREIGN KEY ("chosen_choice_id") REFERENCES "public"."choices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_text_id_texts_id_fk" FOREIGN KEY ("text_id") REFERENCES "public"."texts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assigned_level_id_levels_id_fk" FOREIGN KEY ("assigned_level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_current_level_id_levels_id_fk" FOREIGN KEY ("current_level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "choices" ADD CONSTRAINT "choices_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parents" ADD CONSTRAINT "parents_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_text_id_texts_id_fk" FOREIGN KEY ("text_id") REFERENCES "public"."texts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "texts" ADD CONSTRAINT "texts_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "attempt_answers_select" ON "attempt_answers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM attempts a JOIN child_profiles cp ON cp.id = a.child_id WHERE a.id = "attempt_answers"."attempt_id" AND cp.parent_id = (SELECT auth.uid())));--> statement-breakpoint
CREATE POLICY "attempt_answers_insert" ON "attempt_answers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (SELECT 1 FROM attempts a JOIN child_profiles cp ON cp.id = a.child_id WHERE a.id = "attempt_answers"."attempt_id" AND cp.parent_id = (SELECT auth.uid())));--> statement-breakpoint
CREATE POLICY "attempt_answers_update" ON "attempt_answers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (SELECT 1 FROM attempts a JOIN child_profiles cp ON cp.id = a.child_id WHERE a.id = "attempt_answers"."attempt_id" AND cp.parent_id = (SELECT auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM attempts a JOIN child_profiles cp ON cp.id = a.child_id WHERE a.id = "attempt_answers"."attempt_id" AND cp.parent_id = (SELECT auth.uid())));--> statement-breakpoint
CREATE POLICY "attempt_answers_delete" ON "attempt_answers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (SELECT 1 FROM attempts a JOIN child_profiles cp ON cp.id = a.child_id WHERE a.id = "attempt_answers"."attempt_id" AND cp.parent_id = (SELECT auth.uid())));--> statement-breakpoint
CREATE POLICY "attempts_select" ON "attempts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = "attempts"."child_id" AND cp.parent_id = (SELECT auth.uid())));--> statement-breakpoint
CREATE POLICY "attempts_insert" ON "attempts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = "attempts"."child_id" AND cp.parent_id = (SELECT auth.uid())));--> statement-breakpoint
CREATE POLICY "attempts_update" ON "attempts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = "attempts"."child_id" AND cp.parent_id = (SELECT auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = "attempts"."child_id" AND cp.parent_id = (SELECT auth.uid())));--> statement-breakpoint
CREATE POLICY "attempts_delete" ON "attempts" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = "attempts"."child_id" AND cp.parent_id = (SELECT auth.uid())));--> statement-breakpoint
CREATE POLICY "child_profiles_select" ON "child_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((SELECT auth.uid()) = "child_profiles"."parent_id");--> statement-breakpoint
CREATE POLICY "child_profiles_insert" ON "child_profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((SELECT auth.uid()) = "child_profiles"."parent_id");--> statement-breakpoint
CREATE POLICY "child_profiles_update" ON "child_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((SELECT auth.uid()) = "child_profiles"."parent_id") WITH CHECK ((SELECT auth.uid()) = "child_profiles"."parent_id");--> statement-breakpoint
CREATE POLICY "child_profiles_delete" ON "child_profiles" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((SELECT auth.uid()) = "child_profiles"."parent_id");--> statement-breakpoint
CREATE POLICY "choices_select" ON "choices" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "choices_insert" ON "choices" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "choices_update" ON "choices" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "choices_delete" ON "choices" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "levels_select" ON "levels" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "levels_insert" ON "levels" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "levels_update" ON "levels" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "levels_delete" ON "levels" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "parents_select" ON "parents" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((SELECT auth.uid()) = "parents"."id");--> statement-breakpoint
CREATE POLICY "parents_insert" ON "parents" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((SELECT auth.uid()) = "parents"."id");--> statement-breakpoint
CREATE POLICY "parents_update" ON "parents" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((SELECT auth.uid()) = "parents"."id") WITH CHECK ((SELECT auth.uid()) = "parents"."id");--> statement-breakpoint
CREATE POLICY "parents_delete" ON "parents" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((SELECT auth.uid()) = "parents"."id");--> statement-breakpoint
CREATE POLICY "questions_select" ON "questions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "questions_insert" ON "questions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "questions_update" ON "questions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "questions_delete" ON "questions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "texts_select" ON "texts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "texts_insert" ON "texts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "texts_update" ON "texts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "texts_delete" ON "texts" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);