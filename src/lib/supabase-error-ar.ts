// Translate common Supabase Auth error codes to Arabic UX copy.
// Unknown error codes fall back to a generic message so the parent never sees
// a raw English Supabase error.

import type { AuthError } from '@supabase/supabase-js';

export function supabaseErrorAr(err: AuthError | Error | null | undefined): string {
  if (!err) return 'حدث خطأ، حاول مرة أخرى';
  const code = 'code' in err ? (err as AuthError).code : undefined;
  const msg = err.message ?? '';

  if (code === 'email_address_invalid' || msg.includes('invalid email')) {
    return 'بريد إلكتروني غير صالح';
  }
  if (code === 'user_already_exists' || msg.includes('User already registered')) {
    return 'هذا البريد مسجّل بالفعل — جرّب تسجيل الدخول';
  }
  if (code === 'invalid_credentials' || msg.includes('Invalid login credentials')) {
    return 'البريد أو كلمة المرور غير صحيحة';
  }
  if (code === 'email_not_confirmed' || msg.includes('Email not confirmed')) {
    return 'تحقّق من بريدك الإلكتروني لتأكيد الحساب أوّلاً';
  }
  if (code === 'over_email_send_rate_limit' || msg.includes('rate limit')) {
    return 'محاولات كثيرة — انتظر دقيقة ثم حاول مرة أخرى';
  }
  if (code === 'same_password' || msg.includes('New password should be different')) {
    return 'يجب أن تختار كلمة مرور مختلفة';
  }
  if (code === 'weak_password') {
    return 'كلمة المرور ضعيفة جدّاً';
  }

  return 'حدث خطأ، حاول مرة أخرى';
}
