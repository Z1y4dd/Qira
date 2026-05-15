'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseErrorAr } from '@/lib/supabase-error-ar';
import { createClient } from '@/utils/supabase/server';

export async function resendVerificationAction(): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient(await cookies());
  const { data, error: userErr } = await supabase.auth.getUser();
  if (userErr || !data.user?.email) {
    return { error: 'لم نتمكّن من تحديد البريد — سجّل الدخول من جديد' };
  }
  const { error } = await supabase.auth.resend({ type: 'signup', email: data.user.email });
  if (error) return { error: supabaseErrorAr(error) };
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = createClient(await cookies());
  await supabase.auth.signOut();
  redirect('/');
}
