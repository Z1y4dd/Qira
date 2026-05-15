'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ProfileFormState } from '@/components/profiles/profile-form';
import { UpdateChildProfileInput } from '@/lib/auth-schemas';
import { AuthError, type ChildId, updateChildProfile } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

// Receives childId via a hidden form input (Next.js Server Actions cannot be
// curried at module scope when inside a 'use server' file).
export async function editProfileAction(
  _prev: ProfileFormState | undefined,
  formData: FormData,
): Promise<ProfileFormState> {
  const childIdRaw = formData.get('childId');
  if (typeof childIdRaw !== 'string' || childIdRaw.length === 0) {
    return { error: { _form: ['معرّف الطفل مفقود'] } };
  }

  const parsed = UpdateChildProfileInput.safeParse({
    displayName: formData.get('displayName'),
    age: formData.get('age'),
    gradeBand: formData.get('gradeBand'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = createClient(await cookies());
  try {
    await updateChildProfile(supabase, childIdRaw as ChildId, parsed.data);
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: { _form: ['الجلسة منتهية أو الملف غير موجود'] } };
    }
    return { error: { _form: ['حدث خطأ، حاول مرة أخرى'] } };
  }

  redirect('/choose-child');
}
