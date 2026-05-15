import Link from 'next/link';
import { ArabicText } from '@/components/arabic-text';
import { ResetRequestForm } from './request-form';

export default function ResetRequestPage() {
  return (
    <>
      <div className="mb-6 space-y-2 text-center">
        <ArabicText as="h1" size="reader" className="text-2xl block">
          نسيت كلمة المرور؟
        </ArabicText>
        <ArabicText size="caption" className="block text-muted-foreground">
          أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة التعيين
        </ArabicText>
      </div>

      <ResetRequestForm />

      <div className="mt-6 text-center">
        <ArabicText size="caption" className="block text-muted-foreground">
          تذكّرتها؟{' '}
          <Link href="/sign-in" className="text-primary underline-offset-4 hover:underline">
            <ArabicText size="caption">العودة لتسجيل الدخول</ArabicText>
          </Link>
        </ArabicText>
      </div>
    </>
  );
}
