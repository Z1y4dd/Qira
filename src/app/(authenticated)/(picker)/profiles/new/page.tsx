import Link from 'next/link';
import { ArabicText } from '@/components/arabic-text';
import { ProfileForm } from '@/components/profiles/profile-form';
import { Card } from '@/components/ui/card';
import { createProfileAction } from './actions';

export default function NewProfilePage() {
  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <Card className="p-8">
          <div className="mb-6 space-y-2 text-center">
            <ArabicText as="h1" size="reader" className="text-2xl block">
              إضافة طفل
            </ArabicText>
            <ArabicText size="caption" className="block text-muted-foreground">
              أنشئ ملفاً لكلّ طفل لمتابعة تقدّمه بشكل منفصل
            </ArabicText>
          </div>

          <ProfileForm
            action={createProfileAction}
            submitLabelAr="إضافة"
            pendingLabelAr="جارٍ الإضافة…"
          />

          <div className="mt-6 text-center">
            <Link href="/choose-child" className="text-primary underline-offset-4 hover:underline">
              <ArabicText size="caption">إلغاء والعودة للقائمة</ArabicText>
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
