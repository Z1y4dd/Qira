import Link from 'next/link';
import { ArabicText } from '@/components/arabic-text';
import { SignUpForm } from './sign-up-form';

export default function SignUpPage() {
  return (
    <>
      <div className="mb-6 space-y-2 text-center">
        <ArabicText as="h1" size="reader" className="text-2xl block">
          إنشاء حساب
        </ArabicText>
        <ArabicText size="caption" className="block text-muted-foreground">
          أنشئ حساب الوالد لإدارة ملفات أطفالك
        </ArabicText>
      </div>

      <SignUpForm />

      <div className="mt-6 text-center">
        <ArabicText size="caption" className="block text-muted-foreground">
          لديك حساب بالفعل؟{' '}
          <Link href="/sign-in" className="text-primary underline-offset-4 hover:underline">
            <ArabicText size="caption">تسجيل الدخول</ArabicText>
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
