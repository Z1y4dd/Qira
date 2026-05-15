'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ProfileFormState } from '@/components/profiles/profile-form';
import { CreateChildProfileInput } from '@/lib/auth-schemas';
import { AuthError, createChildProfile } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

export async function createProfileAction(
  _prev: ProfileFormState | undefined,
  formData: FormData,
): Promise<ProfileFormState> {
  const parsed = CreateChildProfileInput.safeParse({
    displayName: formData.get('displayName'),
    age: formData.get('age'),
    gradeBand: formData.get('gradeBand'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = createClient(await cookies());
  try {
    await createChildProfile(supabase, parsed.data);
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: { _form: ['الجلسة منتهية — سجّل الدخول من جديد'] } };
    }
    return { error: { _form: ['حدث خطأ، حاول مرة أخرى'] } };
  }

  redirect('/choose-child');
}
