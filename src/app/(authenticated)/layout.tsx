import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthError, requireParent } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

// force-dynamic is required: this layout reads cookies on every request, so it
// cannot be statically pre-rendered. The CI gate (scripts/lint-force-dynamic.sh)
// enforces this on every (authenticated)/**/layout.tsx file in the tree.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient(await cookies());

  try {
    await requireParent(supabase);
  } catch (err) {
    if (err instanceof AuthError && err.reason === 'UNAUTHENTICATED') redirect('/sign-in');
    if (err instanceof AuthError && err.reason === 'UNVERIFIED') redirect('/verify-email');
    throw err;
  }

  return <>{children}</>;
}
