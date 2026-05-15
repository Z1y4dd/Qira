/**
 * Service Layer module — parent and child profile operations.
 *
 * RULES (enforced by tests/invariants/service-layer-purity.test.ts):
 *   - NO `next/*` imports. The Service Layer must remain framework-agnostic
 *     so Phase 5's /api/v1/* Route Handlers can call through the same surface.
 *   - All Zod validation lives here, not in the calling Server Action.
 *   - All authorization checks live here — RLS is defense-in-depth, not a substitute.
 *
 * Functions throw until Phase 2 lands real auth + Drizzle queries.
 */

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

/** Throws if no authenticated parent session is found. */
export function requireParent(): Promise<ParentSession> {
  throw new Error('profiles.requireParent: not implemented until Phase 2');
}

/** Throws if no active-child cookie is set or the child does not belong to the parent. */
export function requireActiveChild(): Promise<ChildProfile> {
  throw new Error('profiles.requireActiveChild: not implemented until Phase 2');
}

export function listChildProfiles(_parentId: ParentId): Promise<ChildProfile[]> {
  throw new Error('profiles.listChildProfiles: not implemented until Phase 2');
}

export interface CreateChildProfileInput {
  parentId: ParentId;
  displayName: string;
  age: number;
  gradeBand: ChildProfile['gradeBand'];
}

export function createChildProfile(_input: CreateChildProfileInput): Promise<ChildProfile> {
  throw new Error('profiles.createChildProfile: not implemented until Phase 2');
}

export function deleteChildProfile(_args: { parentId: ParentId; childId: ChildId }): Promise<void> {
  throw new Error('profiles.deleteChildProfile: not implemented until Phase 2');
}
