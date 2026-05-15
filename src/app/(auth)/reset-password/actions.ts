'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ResetApplyInput } from '@/lib/auth-schemas';
import { supabaseErrorAr } from '@/lib/supabase-error-ar';
import { createClient } from '@/utils/supabase/server';

export interface ResetApplyActionState {
  error?: { _form?: string[]; password?: string[]; confirmPassword?: string[] };
}

export async function applyResetAction(
  _prev: ResetApplyActionState | undefined,
  formData: FormData,
): Promise<ResetApplyActionState> {
  const parsed = ResetApplyInput.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = createClient(await cookies());
  // Code exchange already ran in the Server Component on page load. By the time
  // this action fires the user has a temporary recovery session in cookies, so
  // updateUser writes against that.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: { _form: [supabaseErrorAr(error)] } };

  // updateUser invalidates other sessions; force a sign-out + redirect so the
  // parent re-authenticates with the new password.
  await supabase.auth.signOut();
  redirect('/sign-in?reset=ok');
}
