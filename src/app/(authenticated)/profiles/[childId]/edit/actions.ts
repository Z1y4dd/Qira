'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ProfileFormState } from '@/components/profiles/profile-form';
import { UpdateChildProfileInput } from '@/lib/auth-schemas';
import { AuthError, type ChildId, updateChildProfile } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

export function editProfileAction(childId: ChildId) {
  return async (
    _prev: ProfileFormState | undefined,
    formData: FormData,
  ): Promise<ProfileFormState> => {
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
      await updateChildProfile(supabase, childId, parsed.data);
    } catch (err) {
      if (err instanceof AuthError) {
        return { error: { _form: ['الجلسة منتهية أو الملف غير موجود'] } };
      }
      return { error: { _form: ['حدث خطأ، حاول مرة أخرى'] } };
    }

    redirect('/choose-child');
  };
}
