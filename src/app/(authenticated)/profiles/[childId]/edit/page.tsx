import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArabicText } from '@/components/arabic-text';
import { ProfileForm } from '@/components/profiles/profile-form';
import { Card } from '@/components/ui/card';
import { type ChildId, getChildProfile } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';
import { editProfileAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const supabase = createClient(await cookies());
  const profile = await getChildProfile(supabase, childId as ChildId);

  if (!profile) {
    redirect('/choose-child');
  }

  const action = editProfileAction(profile.id);

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <Card className="p-8">
          <div className="mb-6 space-y-2 text-center">
            <ArabicText as="h1" size="reader" className="text-2xl block">
              تعديل ملف الطفل
            </ArabicText>
          </div>

          <ProfileForm
            action={action}
            defaults={{
              displayName: profile.displayName,
              age: profile.age,
              gradeBand: profile.gradeBand,
            }}
            submitLabelAr="حفظ التغييرات"
            pendingLabelAr="جارٍ الحفظ…"
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
