import { Plus } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { signOutAction } from '@/app/(auth)/sign-in/actions';
import { ArabicText } from '@/components/arabic-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { listChildProfiles, requireParent } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';
import { setActiveChildAction } from './actions';

export const dynamic = 'force-dynamic';

const GRADE_LABELS: Record<'k' | '1-2' | '3-4' | '5-6', string> = {
  k: 'التمهيدي',
  '1-2': 'الصف 1–2',
  '3-4': 'الصف 3–4',
  '5-6': 'الصف 5–6',
};

export default async function ChooseChildPage() {
  const supabase = createClient(await cookies());
  const parent = await requireParent(supabase);
  const profiles = await listChildProfiles(supabase);

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 space-y-2 text-center">
          <ArabicText as="h1" size="reader" className="text-3xl block">
            من سيقرأ اليوم؟
          </ArabicText>
          <ArabicText size="caption" className="block text-muted-foreground">
            اختر طفلاً للمتابعة، أو أضف ملفاً جديداً
          </ArabicText>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((child) => (
            <Card key={child.id} className="p-6">
              <div className="space-y-3 text-center">
                <ArabicText as="h2" size="reader" className="block text-xl">
                  {child.displayName}
                </ArabicText>
                <ArabicText size="caption" className="block text-muted-foreground">
                  العمر <bdi dir="ltr">{child.age}</bdi> · {GRADE_LABELS[child.gradeBand]}
                </ArabicText>
                <form action={setActiveChildAction.bind(null, child.id)}>
                  <Button type="submit" size="lg" className="w-full">
                    <ArabicText size="ui">اختيار</ArabicText>
                  </Button>
                </form>
                <Link
                  href={{
                    pathname: '/profiles/[childId]/edit',
                    query: { childId: child.id },
                  }}
                  className="block text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  <ArabicText size="caption">تعديل</ArabicText>
                </Link>
              </div>
            </Card>
          ))}

          <Link href="/profiles/new">
            <Card className="flex h-full min-h-44 flex-col items-center justify-center gap-2 border-dashed p-6 transition-colors hover:bg-accent">
              <Plus className="size-6 text-muted-foreground" aria-hidden="true" />
              <ArabicText size="ui" className="text-muted-foreground">
                إضافة طفل
              </ArabicText>
            </Card>
          </Link>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2">
          <ArabicText size="caption" className="block text-muted-foreground">
            <bdi dir="ltr">{parent.email}</bdi>
          </ArabicText>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              <ArabicText size="caption">تسجيل الخروج</ArabicText>
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
