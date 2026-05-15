// (active) subtree — authenticated routes that REQUIRE an active child cookie.
// /dashboard and (Phase 3) the placement flow and (Phase 4) reader live here.
// On NO_ACTIVE_CHILD this layout redirects to /choose-child.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ActiveChildChip } from '@/components/nav/active-child-chip';
import { ACTIVE_CHILD_COOKIE } from '@/lib/active-child-cookie';
import { AuthError, listChildProfiles, requireActiveChild } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ActiveChildLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let active: Awaited<ReturnType<typeof requireActiveChild>>;
  try {
    active = await requireActiveChild(supabase, cookieStore.get(ACTIVE_CHILD_COOKIE)?.value);
  } catch (err) {
    if (err instanceof AuthError && err.reason === 'NO_ACTIVE_CHILD') redirect('/choose-child');
    throw err;
  }

  const all = await listChildProfiles(supabase);
  const others = all.filter((c) => c.id !== active.id);

  return (
    <>
      <ActiveChildChip active={active} others={others} />
      {children}
    </>
  );
}
