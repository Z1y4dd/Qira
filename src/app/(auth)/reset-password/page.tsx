import { cookies } from 'next/headers';
import Link from 'next/link';
import { ArabicText } from '@/components/arabic-text';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/server';
import { ResetForm } from './reset-form';

// Reads + writes cookies via exchangeCodeForSession. Must be dynamic.
export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token_hash?: string; type?: string }>;
}) {
  const params = await searchParams;
  const supabase = createClient(await cookies());

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) return <ResetError />;
  } else if (params.token_hash && params.type === 'recovery') {
    // Supabase sends token_hash when the PKCE verifier cookie is absent
    // (e.g. user opened the email on a different device/browser).
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: 'recovery',
    });
    if (error) return <ResetError />;
  } else {
    return <ResetError />;
  }

  return (
    <>
      <div className="mb-6 space-y-2 text-center">
        <ArabicText as="h1" size="reader" className="text-2xl block">
          اختر كلمة مرور جديدة
        </ArabicText>
        <ArabicText size="caption" className="block text-muted-foreground">
          أدخل كلمة مرور قويّة جديدة لحسابك
        </ArabicText>
      </div>

      <ResetForm />
    </>
  );
}

function ResetError() {
  return (
    <div className="space-y-4 text-center">
      <ArabicText as="h1" size="reader" className="text-2xl block">
        الرابط غير صالح أو منتهي الصلاحية
      </ArabicText>
      <ArabicText size="ui" className="block text-muted-foreground">
        قد يكون الرابط استُخدم بالفعل أو انتهت مدّته. اطلب رابطاً جديداً.
      </ArabicText>
      <Link href="/reset-password/request">
        <Button variant="default" size="lg" className="w-full">
          <ArabicText size="ui">اطلب رابطاً جديداً</ArabicText>
        </Button>
      </Link>
    </div>
  );
}
