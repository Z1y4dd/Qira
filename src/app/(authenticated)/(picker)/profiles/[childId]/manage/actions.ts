'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthError, type ChildId, deleteChildProfile } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

export interface DeleteActionState {
  error?: string;
}

export async function deleteChildAction(
  _prev: DeleteActionState | undefined,
  formData: FormData,
): Promise<DeleteActionState> {
  const childId = formData.get('childId');
  const confirmName = formData.get('confirmName');

  if (typeof childId !== 'string' || childId.length === 0) {
    return { error: 'معرّف الطفل مفقود' };
  }
  if (typeof confirmName !== 'string' || confirmName.length === 0) {
    return { error: 'اكتب اسم الطفل للتأكيد' };
  }

  const supabase = createClient(await cookies());
  try {
    await deleteChildProfile(supabase, { childId: childId as ChildId, confirmName });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'الجلسة منتهية أو الملف غير موجود' };
    }
    if (err instanceof Error && err.message === 'DELETE_NAME_MISMATCH') {
      return { error: 'الاسم الذي كتبته لا يطابق اسم الطفل' };
    }
    return { error: 'حدث خطأ، حاول مرة أخرى' };
  }

  redirect('/choose-child');
}
