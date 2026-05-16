'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { resetPlacement } from '@/services/placement';
import { AuthError, type ChildId, deleteChildProfile, getChildProfile } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

export interface DeleteActionState {
  error?: string;
}

export interface ResetActionState {
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

export async function resetPlacementAction(
  _prev: ResetActionState | undefined,
  formData: FormData,
): Promise<ResetActionState> {
  const childId = formData.get('childId');
  const confirmName = formData.get('confirmName');

  if (typeof childId !== 'string' || childId.length === 0) {
    return { error: 'معرّف الطفل مفقود' };
  }
  if (typeof confirmName !== 'string' || confirmName.length === 0) {
    return { error: 'اكتب اسم الطفل للتأكيد' };
  }

  const supabase = createClient(await cookies());
  let child: Awaited<ReturnType<typeof getChildProfile>>;
  try {
    child = await getChildProfile(supabase, childId as ChildId);
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'الجلسة منتهية أو الملف غير موجود' };
    }
    return { error: 'حدث خطأ، حاول مرة أخرى' };
  }

  if (!child) {
    return { error: 'الجلسة منتهية أو الملف غير موجود' };
  }

  if (child.displayName.normalize('NFC') !== confirmName.normalize('NFC')) {
    return { error: 'الاسم الذي كتبته لا يطابق اسم الطفل' };
  }

  try {
    await resetPlacement(childId as ChildId);
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'الجلسة منتهية أو الملف غير موجود' };
    }
    return { error: 'حدث خطأ، حاول مرة أخرى' };
  }

  redirect(`/profiles/${childId}/manage`);
}
