/**
 * Service Layer module — parent and child profile operations.
 *
 * RULES (enforced by tests/invariants/service-layer-purity.test.ts):
 *   - NO `next/*` imports. The Service Layer must remain framework-agnostic
 *     so Phase 5's /api/v1/* Route Handlers can call through the same surface.
 *   - All Zod validation lives here, not in the calling Server Action.
 *   - All authorization checks live here — RLS is defense-in-depth, not a substitute.
 *
 * Callers (Server Actions / Route Handlers) inject the `SupabaseClient` so
 * this module never imports `cookies()` from `next/headers`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { nfc } from '@/db/normalize';
import { childProfiles, parents } from '@/db/schema';
import {
  CreateChildProfileInput as CreateChildProfileInputSchema,
  UpdateChildProfileInput as UpdateChildProfileInputSchema,
} from '@/lib/auth-schemas';

export type ParentId = string & { readonly __brand: 'ParentId' };
export type ChildId = string & { readonly __brand: 'ChildId' };

export interface ParentSession {
  parentId: ParentId;
  email: string;
}

export interface ChildProfile {
  id: ChildId;
  parentId: ParentId;
  displayName: string;
  age: number;
  gradeBand: 'k' | '1-2' | '3-4' | '5-6';
  assignedLevel: number | null;
}

export type CreateChildProfileInput = {
  displayName: string;
  age: number;
  gradeBand: ChildProfile['gradeBand'];
};
export type UpdateChildProfileInput = CreateChildProfileInput;

/** Typed error so callers can branch on the failure reason. */
export class AuthError extends Error {
  constructor(public reason: 'UNAUTHENTICATED' | 'UNVERIFIED' | 'NO_ACTIVE_CHILD') {
    super(reason);
    this.name = 'AuthError';
  }
}

const brandedParentId = (id: string): ParentId => id as ParentId;
const brandedChildId = (id: string): ChildId => id as ChildId;

/**
 * Returns the authenticated, email-verified parent. Throws AuthError otherwise.
 * Lazy-upserts the public.parents row mirroring auth.users so downstream queries
 * always find the parent.
 */
export async function requireParent(supabase: SupabaseClient): Promise<ParentSession> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new AuthError('UNAUTHENTICATED');
  if (!data.user.email_confirmed_at) throw new AuthError('UNVERIFIED');

  const parentId = brandedParentId(data.user.id);
  await db
    .insert(parents)
    .values({ id: parentId, email: data.user.email ?? '' })
    .onConflictDoNothing({ target: parents.id });

  return { parentId, email: data.user.email ?? '' };
}

/**
 * Returns the active child (per the qira_active_child cookie). The cookie value
 * is injected by the caller (a Server Action that read it from next/headers
 * cookies()) so this Service remains framework-agnostic.
 */
export async function requireActiveChild(
  supabase: SupabaseClient,
  activeChildCookieValue: string | undefined,
): Promise<ChildProfile> {
  const parent = await requireParent(supabase);

  // Lazy import to avoid pulling next/* indirectly via barrel files.
  const { parseActiveChildCookie } = await import('@/lib/active-child-cookie');
  const childId = parseActiveChildCookie(activeChildCookieValue);
  if (!childId) throw new AuthError('NO_ACTIVE_CHILD');

  const [row] = await db
    .select()
    .from(childProfiles)
    .where(and(eq(childProfiles.id, childId), eq(childProfiles.parentId, parent.parentId)))
    .limit(1);

  if (!row) throw new AuthError('NO_ACTIVE_CHILD');

  return rowToProfile(row, parent.parentId);
}

export async function listChildProfiles(supabase: SupabaseClient): Promise<ChildProfile[]> {
  const parent = await requireParent(supabase);
  const rows = await db
    .select()
    .from(childProfiles)
    .where(eq(childProfiles.parentId, parent.parentId))
    .orderBy(childProfiles.createdAt);
  return rows.map((row) => rowToProfile(row, parent.parentId));
}

export async function getChildProfile(
  supabase: SupabaseClient,
  childId: ChildId,
): Promise<ChildProfile | null> {
  const parent = await requireParent(supabase);
  const [row] = await db
    .select()
    .from(childProfiles)
    .where(and(eq(childProfiles.id, childId), eq(childProfiles.parentId, parent.parentId)))
    .limit(1);
  return row ? rowToProfile(row, parent.parentId) : null;
}

export async function createChildProfile(
  supabase: SupabaseClient,
  input: CreateChildProfileInput,
): Promise<ChildProfile> {
  const parent = await requireParent(supabase);
  const parsed = CreateChildProfileInputSchema.parse(input);
  const normalized = nfc(parsed, ['displayName']);

  const [row] = await db
    .insert(childProfiles)
    .values({
      parentId: parent.parentId,
      displayName: normalized.displayName,
      age: normalized.age,
      gradeBand: normalized.gradeBand,
    })
    .returning();

  if (!row) throw new Error('createChildProfile: insert returned no row');
  return rowToProfile(row, parent.parentId);
}

export async function updateChildProfile(
  supabase: SupabaseClient,
  childId: ChildId,
  input: UpdateChildProfileInput,
): Promise<ChildProfile> {
  const parent = await requireParent(supabase);
  const parsed = UpdateChildProfileInputSchema.parse(input);
  const normalized = nfc(parsed, ['displayName']);

  const [row] = await db
    .update(childProfiles)
    .set({
      displayName: normalized.displayName,
      age: normalized.age,
      gradeBand: normalized.gradeBand,
    })
    .where(and(eq(childProfiles.id, childId), eq(childProfiles.parentId, parent.parentId)))
    .returning();

  if (!row) throw new AuthError('UNAUTHENTICATED');
  return rowToProfile(row, parent.parentId);
}

export async function deleteChildProfile(
  supabase: SupabaseClient,
  args: { childId: ChildId; confirmName: string },
): Promise<void> {
  const parent = await requireParent(supabase);

  const [child] = await db
    .select()
    .from(childProfiles)
    .where(and(eq(childProfiles.id, args.childId), eq(childProfiles.parentId, parent.parentId)))
    .limit(1);
  if (!child) throw new AuthError('UNAUTHENTICATED');

  if (child.displayName.normalize('NFC') !== args.confirmName.normalize('NFC')) {
    throw new Error('DELETE_NAME_MISMATCH');
  }

  await db
    .delete(childProfiles)
    .where(and(eq(childProfiles.id, args.childId), eq(childProfiles.parentId, parent.parentId)));
  // attempts + attempt_answers cascade via Drizzle schema onDelete: 'cascade'.
}

function rowToProfile(row: typeof childProfiles.$inferSelect, parentId: ParentId): ChildProfile {
  return {
    id: brandedChildId(row.id),
    parentId,
    displayName: row.displayName,
    age: row.age,
    gradeBand: row.gradeBand as ChildProfile['gradeBand'],
    assignedLevel: null, // Populated by Phase 3 from child_profiles.current_level_id.
  };
}
