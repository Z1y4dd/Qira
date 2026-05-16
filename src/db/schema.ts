// Drizzle schema — Qira v1
//
// Eight v1 entities with co-located Row Level Security policies. The Drizzle
// 0.45.2 build of `drizzle-orm/supabase` does NOT export `crudPolicy` (verified
// at Plan 01-03 Task 3.1), so policies are authored via `pgPolicy()` directly
// with four explicit entries per table:
//
//   • SELECT  USING (<read>)
//   • INSERT  WITH CHECK (<modify>)
//   • UPDATE  USING (<modify>) WITH CHECK (<modify>)   ← Pitfall 11 invariant
//   • DELETE  USING (<read>)
//
// Pitfall 11 ("every UPDATE-bearing policy has both USING and WITH CHECK") is
// satisfied by construction here: the UPDATE policy below always emits both.

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase';

// Enums --------------------------------------------------------------------

export const attemptKind = pgEnum('attempt_kind', ['placement', 'reading']);
export const questionKind = pgEnum('question_kind', ['placement', 'comprehension']);
export const escapeHatchReason = pgEnum('escape_hatch_reason', ['too_hard', 'too_easy']);

// 1. parents — 1:1 with auth.users (vendor lock-in insulation per Pitfall 15)
export const parents = pgTable(
  'parents',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    pgPolicy('parents_select', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`(SELECT auth.uid()) = ${table.id}`,
    }),
    pgPolicy('parents_insert', {
      as: 'permissive',
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(SELECT auth.uid()) = ${table.id}`,
    }),
    pgPolicy('parents_update', {
      as: 'permissive',
      for: 'update',
      to: authenticatedRole,
      using: sql`(SELECT auth.uid()) = ${table.id}`,
      withCheck: sql`(SELECT auth.uid()) = ${table.id}`,
    }),
    pgPolicy('parents_delete', {
      as: 'permissive',
      for: 'delete',
      to: authenticatedRole,
      using: sql`(SELECT auth.uid()) = ${table.id}`,
    }),
  ],
);

// 2. child_profiles — owned by a parent
export const childProfiles = pgTable(
  'child_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentId: uuid('parent_id')
      .notNull()
      .references(() => parents.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    age: smallint('age').notNull(),
    gradeBand: text('grade_band').notNull(),
    currentLevelId: uuid('current_level_id').references(() => levels.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('child_profiles_age_range', sql`${table.age} BETWEEN 5 AND 12`),
    pgPolicy('child_profiles_select', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`(SELECT auth.uid()) = ${table.parentId}`,
    }),
    pgPolicy('child_profiles_insert', {
      as: 'permissive',
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(SELECT auth.uid()) = ${table.parentId}`,
    }),
    pgPolicy('child_profiles_update', {
      as: 'permissive',
      for: 'update',
      to: authenticatedRole,
      using: sql`(SELECT auth.uid()) = ${table.parentId}`,
      withCheck: sql`(SELECT auth.uid()) = ${table.parentId}`,
    }),
    pgPolicy('child_profiles_delete', {
      as: 'permissive',
      for: 'delete',
      to: authenticatedRole,
      using: sql`(SELECT auth.uid()) = ${table.parentId}`,
    }),
  ],
);

// 3. levels — global reference table, authenticated SELECT only
export const levels = pgTable(
  'levels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: smallint('number').notNull().unique(),
    // NFC-normalized via Zod ArabicText schema + nfc() helper at DB boundary — see src/lib/zod.ts and src/db/normalize.ts (Slice 4).
    nameAr: text('name_ar').notNull(),
    // NFC-normalized via Zod ArabicText schema + nfc() helper at DB boundary — see src/lib/zod.ts and src/db/normalize.ts (Slice 4).
    descriptionAr: text('description_ar'),
  },
  (_table) => [
    pgPolicy('levels_select', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
    pgPolicy('levels_insert', {
      as: 'permissive',
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`false`,
    }),
    pgPolicy('levels_update', {
      as: 'permissive',
      for: 'update',
      to: authenticatedRole,
      using: sql`false`,
      withCheck: sql`false`,
    }),
    pgPolicy('levels_delete', {
      as: 'permissive',
      for: 'delete',
      to: authenticatedRole,
      using: sql`false`,
    }),
  ],
);

// 4. texts — leveled passages, global read for authenticated users
export const texts = pgTable(
  'texts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    levelId: uuid('level_id')
      .notNull()
      .references(() => levels.id),
    // NFC-normalized via Zod ArabicText schema + nfc() helper at DB boundary — see src/lib/zod.ts and src/db/normalize.ts (Slice 4).
    titleAr: text('title_ar').notNull(),
    // NFC-normalized via Zod ArabicText schema + nfc() helper at DB boundary — see src/lib/zod.ts and src/db/normalize.ts (Slice 4).
    bodyAr: text('body_ar').notNull(),
    wordCount: integer('word_count').notNull(),
    genre: text('genre'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    isPlaceholder: boolean('is_placeholder').default(false).notNull(),
  },
  (_table) => [
    pgPolicy('texts_select', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
    pgPolicy('texts_insert', {
      as: 'permissive',
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`false`,
    }),
    pgPolicy('texts_update', {
      as: 'permissive',
      for: 'update',
      to: authenticatedRole,
      using: sql`false`,
      withCheck: sql`false`,
    }),
    pgPolicy('texts_delete', {
      as: 'permissive',
      for: 'delete',
      to: authenticatedRole,
      using: sql`false`,
    }),
  ],
);

// 5. questions — placement or comprehension, text- or level-scoped
export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: questionKind('kind').notNull(),
    textId: uuid('text_id').references(() => texts.id),
    levelId: uuid('level_id').references(() => levels.id),
    // NFC-normalized via Zod ArabicText schema + nfc() helper at DB boundary — see src/lib/zod.ts and src/db/normalize.ts (Slice 4).
    promptAr: text('prompt_ar').notNull(),
    questionType: text('question_type').notNull(),
    position: integer('position').notNull(),
    isPlaceholder: boolean('is_placeholder').default(false).notNull(),
  },
  (_table) => [
    pgPolicy('questions_select', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
    pgPolicy('questions_insert', {
      as: 'permissive',
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`false`,
    }),
    pgPolicy('questions_update', {
      as: 'permissive',
      for: 'update',
      to: authenticatedRole,
      using: sql`false`,
      withCheck: sql`false`,
    }),
    pgPolicy('questions_delete', {
      as: 'permissive',
      for: 'delete',
      to: authenticatedRole,
      using: sql`false`,
    }),
  ],
);

// 6. choices — answer options. correct_index lives here but RLS read is open.
// Service Layer code MUST NOT select isCorrect into UI props. See src/services/comprehension.ts (Phase 4). The hide-from-UI invariant is enforced by code review + a CI grep against src/services/, not by RLS.
export const choices = pgTable(
  'choices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    // NFC-normalized via Zod ArabicText schema + nfc() helper at DB boundary — see src/lib/zod.ts and src/db/normalize.ts (Slice 4).
    textAr: text('text_ar').notNull(),
    position: smallint('position').notNull(),
    isCorrect: integer('is_correct').notNull().default(0),
  },
  (_table) => [
    pgPolicy('choices_select', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`true`,
    }),
    pgPolicy('choices_insert', {
      as: 'permissive',
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`false`,
    }),
    pgPolicy('choices_update', {
      as: 'permissive',
      for: 'update',
      to: authenticatedRole,
      using: sql`false`,
      withCheck: sql`false`,
    }),
    pgPolicy('choices_delete', {
      as: 'permissive',
      for: 'delete',
      to: authenticatedRole,
      using: sql`false`,
    }),
  ],
);

// 7. attempts — unified placement + reading; parent-owned via child_id chain
export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => childProfiles.id, { onDelete: 'cascade' }),
    kind: attemptKind('kind').notNull(),
    textId: uuid('text_id').references(() => texts.id),
    assignedLevelId: uuid('assigned_level_id').references(() => levels.id),
    score: integer('score'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    escapeHatched: boolean('escape_hatched').default(false).notNull(),
    escapeHatchedAt: timestamp('escape_hatched_at', { withTimezone: true }),
    escapeHatchedReason: escapeHatchReason('escape_hatched_reason'),
    placementBankVersion: integer('placement_bank_version'),
  },
  (table) => [
    pgPolicy('attempts_select', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = ${table.childId} AND cp.parent_id = (SELECT auth.uid()))`,
    }),
    pgPolicy('attempts_insert', {
      as: 'permissive',
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = ${table.childId} AND cp.parent_id = (SELECT auth.uid()))`,
    }),
    pgPolicy('attempts_update', {
      as: 'permissive',
      for: 'update',
      to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = ${table.childId} AND cp.parent_id = (SELECT auth.uid()))`,
      withCheck: sql`EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = ${table.childId} AND cp.parent_id = (SELECT auth.uid()))`,
    }),
    pgPolicy('attempts_delete', {
      as: 'permissive',
      for: 'delete',
      to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = ${table.childId} AND cp.parent_id = (SELECT auth.uid()))`,
    }),
  ],
);

// 8. attempt_answers — one row per question answer
export const attemptAnswers = pgTable(
  'attempt_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    chosenChoiceId: uuid('chosen_choice_id')
      .notNull()
      .references(() => choices.id),
    isCorrect: integer('is_correct').notNull(),
    answeredAt: timestamp('answered_at', { withTimezone: true }).defaultNow().notNull(),
    choiceOrder: jsonb('choice_order'),
  },
  (table) => [
    pgPolicy('attempt_answers_select', {
      as: 'permissive',
      for: 'select',
      to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM attempts a JOIN child_profiles cp ON cp.id = a.child_id WHERE a.id = ${table.attemptId} AND cp.parent_id = (SELECT auth.uid()))`,
    }),
    pgPolicy('attempt_answers_insert', {
      as: 'permissive',
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`EXISTS (SELECT 1 FROM attempts a JOIN child_profiles cp ON cp.id = a.child_id WHERE a.id = ${table.attemptId} AND cp.parent_id = (SELECT auth.uid()))`,
    }),
    pgPolicy('attempt_answers_update', {
      as: 'permissive',
      for: 'update',
      to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM attempts a JOIN child_profiles cp ON cp.id = a.child_id WHERE a.id = ${table.attemptId} AND cp.parent_id = (SELECT auth.uid()))`,
      withCheck: sql`EXISTS (SELECT 1 FROM attempts a JOIN child_profiles cp ON cp.id = a.child_id WHERE a.id = ${table.attemptId} AND cp.parent_id = (SELECT auth.uid()))`,
    }),
    pgPolicy('attempt_answers_delete', {
      as: 'permissive',
      for: 'delete',
      to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM attempts a JOIN child_profiles cp ON cp.id = a.child_id WHERE a.id = ${table.attemptId} AND cp.parent_id = (SELECT auth.uid()))`,
    }),
  ],
);
