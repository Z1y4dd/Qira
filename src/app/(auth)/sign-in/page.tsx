import Link from 'next/link';
import { ArabicText } from '@/components/arabic-text';
import { SignInForm } from './sign-in-form';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const params = await searchParams;
  const resetOk = params.reset === 'ok';

  return (
    <>
      <div className="mb-6 space-y-2 text-center">
        <ArabicText as="h1" size="reader" className="text-2xl block">
          تسجيل الدخول
        </ArabicText>
        <ArabicText size="caption" className="block text-muted-foreground">
          ادخل إلى حسابك لإدارة ملفات الأطفال
        </ArabicText>
      </div>

      <SignInForm resetOk={resetOk} />

      <div className="mt-6 space-y-2 text-center">
        <ArabicText size="caption" className="block">
          <Link
            href="/reset-password/request"
            className="text-primary underline-offset-4 hover:underline"
          >
            <ArabicText size="caption">نسيت كلمة المرور؟</ArabicText>
          </Link>
        </ArabicText>
        <ArabicText size="caption" className="block text-muted-foreground">
          ليس لديك حساب؟{' '}
          <Link href="/sign-up" className="text-primary underline-offset-4 hover:underline">
            <ArabicText size="caption">إنشاء حساب جديد</ArabicText>
          </Link>
        </ArabicText>
        <ArabicText size="caption" className="mt-4 block text-muted-foreground">
          <Link href="/privacy" className="hover:underline">
            <ArabicText size="caption">سياسة الخصوصية</ArabicText>
          </Link>
        </ArabicText>
      </div>
    </>
  );
}
