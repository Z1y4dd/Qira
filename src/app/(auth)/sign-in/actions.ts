'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignInInput } from '@/lib/auth-schemas';
import { supabaseErrorAr } from '@/lib/supabase-error-ar';
import { createClient } from '@/utils/supabase/server';

export interface SignInActionState {
  error?: {
    _form?: string[];
    email?: string[];
    password?: string[];
  };
  /** Set when the sign-in failed because the email is unverified.
   * The form renders a "resend verification" button when this is true. */
  unverifiedEmail?: string;
}

export async function signInAction(
  _prev: SignInActionState | undefined,
  formData: FormData,
): Promise<SignInActionState> {
  const parsed = SignInInput.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    const isUnverified =
      ('code' in error && (error as { code?: string }).code === 'email_not_confirmed') ||
      error.message.includes('Email not confirmed');
    return {
      error: { _form: [supabaseErrorAr(error)] },
      ...(isUnverified ? { unverifiedEmail: parsed.data.email } : {}),
    };
  }

  redirect('/choose-child');
}

export async function resendFromSignInAction(
  email: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) return { error: supabaseErrorAr(error) };
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = createClient(await cookies());
  await supabase.auth.signOut();
  redirect('/');
}
