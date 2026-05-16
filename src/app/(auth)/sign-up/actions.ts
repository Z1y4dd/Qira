'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignUpInput } from '@/lib/auth-schemas';
import { supabaseErrorAr } from '@/lib/supabase-error-ar';
import { createClient } from '@/utils/supabase/server';

export interface SignUpActionState {
  error?: {
    _form?: string[];
    email?: string[];
    password?: string[];
  };
}

export async function signUpAction(
  _prev: SignUpActionState | undefined,
  formData: FormData,
): Promise<SignUpActionState> {
  const parsed = SignUpInput.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`,
    },
  });

  if (error) {
    return { error: { _form: [supabaseErrorAr(error)] } };
  }

  // Supabase silently succeeds for existing emails (prevents enumeration) but
  // returns an empty identities array — surface it as a clear error.
  if (data.user && data.user.identities?.length === 0) {
    return { error: { _form: ['هذا البريد مسجّل بالفعل — جرّب تسجيل الدخول'] } };
  }

  redirect('/verify-email');
}
