/**
 * Service Layer module — per-child data export.
 *
 * RULES (see profiles.ts):
 *   - NO `next/*` imports.
 *   - The export is pure data: no HTML, no markup, no rendering hints.
 *   - Parent ownership is enforced via requireParent + the WHERE clause
 *     (defense-in-depth; RLS also enforces at the DB level).
 *
 * Returned shape is stable — downstream consumers (a parent who imports it
 * into another reading service later, a compliance auditor) can rely on it.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { attemptAnswers, attempts, childProfiles } from '@/db/schema';
import { AuthError, type ChildId, requireParent } from './profiles';

export interface ChildExport {
  exportedAt: string;
  parent: { email: string };
  child: {
    id: string;
    displayName: string;
    age: number;
    gradeBand: string;
    createdAt: string;
  };
  attempts: Array<{
    id: string;
    kind: 'placement' | 'reading';
    textId: string | null;
    assignedLevelId: string | null;
    score: number | null;
    startedAt: string;
    finishedAt: string | null;
  }>;
  attemptAnswers: Array<{
    id: string;
    attemptId: string;
    questionId: string;
    chosenChoiceId: string;
    isCorrect: number;
    answeredAt: string;
  }>;
}

export interface ChildExportFile {
  filename: string;
  json: string;
}

export async function exportChildData(
  supabase: SupabaseClient,
  childId: ChildId,
): Promise<ChildExportFile> {
  const parent = await requireParent(supabase);

  const [child] = await db
    .select()
    .from(childProfiles)
    .where(and(eq(childProfiles.id, childId), eq(childProfiles.parentId, parent.parentId)))
    .limit(1);
  if (!child) throw new AuthError('UNAUTHENTICATED');

  const childAttempts = await db.select().from(attempts).where(eq(attempts.childId, child.id));

  const attemptIds = childAttempts.map((a) => a.id);
  const childAnswers =
    attemptIds.length > 0
      ? await db.select().from(attemptAnswers).where(inArray(attemptAnswers.attemptId, attemptIds))
      : [];

  const data: ChildExport = {
    exportedAt: new Date().toISOString(),
    parent: { email: parent.email },
    child: {
      id: child.id,
      displayName: child.displayName,
      age: child.age,
      gradeBand: child.gradeBand,
      createdAt: child.createdAt.toISOString(),
    },
    attempts: childAttempts.map((a) => ({
      id: a.id,
      kind: a.kind,
      textId: a.textId,
      assignedLevelId: a.assignedLevelId,
      score: a.score,
      startedAt: a.startedAt.toISOString(),
      finishedAt: a.finishedAt ? a.finishedAt.toISOString() : null,
    })),
    attemptAnswers: childAnswers.map((a) => ({
      id: a.id,
      attemptId: a.attemptId,
      questionId: a.questionId,
      chosenChoiceId: a.chosenChoiceId,
      isCorrect: a.isCorrect,
      answeredAt: a.answeredAt.toISOString(),
    })),
  };

  const slug = child.displayName.replace(/\s+/g, '-').slice(0, 40);
  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `qira-export-${slug}-${dateSlug}.json`;

  return { filename, json: JSON.stringify(data, null, 2) };
}
