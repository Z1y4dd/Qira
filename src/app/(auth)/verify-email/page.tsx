import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArabicText } from '@/components/arabic-text';
import { createClient } from '@/utils/supabase/server';
import { VerifyEmailActions } from './verify-actions';

// This page reads cookies, so it MUST be dynamic.
export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage() {
  const supabase = createClient(await cookies());
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect('/sign-in');
  if (data.user.email_confirmed_at) redirect('/choose-child');

  return (
    <div className="space-y-6 text-center">
      <ArabicText as="h1" size="reader" className="text-2xl block">
        تحقّق من بريدك الإلكتروني
      </ArabicText>
      <ArabicText size="ui" className="block text-muted-foreground">
        أرسلنا لك رسالة تأكيد إلى <bdi dir="ltr">{data.user.email}</bdi>. اضغط الرابط في الرسالة
        لتفعيل حسابك.
      </ArabicText>
      <VerifyEmailActions />
    </div>
  );
}
