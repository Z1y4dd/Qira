'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

// Handles Supabase implicit-flow auth tokens that land in the URL hash
// (e.g. #access_token=...&type=recovery). The server never sees hash fragments,
// so this client component detects them and redirects to the right page after
// the browser Supabase client exchanges and stores the session in cookies.
export function HashAuthHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!window.location.hash.includes('access_token')) return;

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/reset-password');
      } else if (event === 'SIGNED_IN') {
        router.replace('/choose-child');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
