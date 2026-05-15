'use server';

import { cookies } from 'next/headers';
import { ResetRequestInput } from '@/lib/auth-schemas';
import { supabaseErrorAr } from '@/lib/supabase-error-ar';
import { createClient } from '@/utils/supabase/server';

export interface ResetRequestActionState {
  error?: { _form?: string[]; email?: string[] };
  ok?: boolean;
}

export async function requestResetAction(
  _prev: ResetRequestActionState | undefined,
  formData: FormData,
): Promise<ResetRequestActionState> {
  const parsed = ResetRequestInput.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/reset-password`,
  });
  // Supabase returns success even for non-existent emails (prevents enumeration).
  // We surface ok: true in both cases.
  if (error) return { error: { _form: [supabaseErrorAr(error)] } };
  return { ok: true };
}
