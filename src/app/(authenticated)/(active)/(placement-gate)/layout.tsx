// (placement-gate) — nested inside (active); routes children through placement assessment.
//
// Gate logic: if the active child's placement_state is 'not_started' or 'in_progress',
// redirect to /placement/start. 'completed' and 'escape_hatched' pass through.
//
// D-03 takes precedence over D-06: escape_hatched children received a grade-prior fallback
// level and are not 'unplaced' — they pass the gate. Parent can force a retake via
// /profiles/[childId]/manage reset.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACTIVE_CHILD_COOKIE } from '@/lib/active-child-cookie';
import { getPlacementState } from '@/services/placement';
import { AuthError, requireActiveChild } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PlacementGateLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let active: Awaited<ReturnType<typeof requireActiveChild>>;
  try {
    active = await requireActiveChild(supabase, cookieStore.get(ACTIVE_CHILD_COOKIE)?.value);
  } catch (err) {
    if (err instanceof AuthError && err.reason === 'NO_ACTIVE_CHILD') redirect('/choose-child');
    throw err;
  }

  const state = await getPlacementState(active.id);

  // D-03 takes precedence over D-06: escape_hatched children received a grade-prior fallback level
  // and are not 'unplaced' — they pass the gate. Parent can force a retake via
  // /profiles/[childId]/manage reset.
  if (state === 'not_started' || state === 'in_progress') {
    redirect('/placement/start');
  }

  // 'completed' and 'escape_hatched' both pass through
  return <>{children}</>;
}
