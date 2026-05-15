'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACTIVE_CHILD_COOKIE, activeChildCookieOptions } from '@/lib/active-child-cookie';
import { requireActiveChild } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

export async function setActiveChildAction(childId: string): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // requireActiveChild validates that THIS parent owns the child (RLS gate).
  // Throwing inside the Service surfaces as a runtime error here; the user is
  // already authenticated so reaching this with a forged childId is the only
  // way it errors — the RLS query returns zero rows and AuthError fires.
  await requireActiveChild(supabase, childId);

  cookieStore.set(ACTIVE_CHILD_COOKIE, childId, activeChildCookieOptions());
  redirect('/dashboard');
}
