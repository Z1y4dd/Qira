import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArabicText } from '@/components/arabic-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { type ChildId, getChildProfile } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';
import { DeleteChildDialog } from './delete-dialog';

export const dynamic = 'force-dynamic';

const GRADE_LABELS: Record<'k' | '1-2' | '3-4' | '5-6', string> = {
  k: 'التمهيدي',
  '1-2': 'الصف 1–2',
  '3-4': 'الصف 3–4',
  '5-6': 'الصف 5–6',
};

export default async function ManageProfilePage({
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

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="space-y-2 text-center">
          <ArabicText as="h1" size="reader" className="text-3xl block">
            إدارة ملف {profile.displayName}
          </ArabicText>
        </div>

        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <ArabicText size="ui" className="block font-semibold">
                {profile.displayName}
              </ArabicText>
              <ArabicText size="caption" className="block text-muted-foreground">
                العمر <bdi dir="ltr">{profile.age}</bdi> · {GRADE_LABELS[profile.gradeBand]}
              </ArabicText>
            </div>
            <Link
              href={{
                pathname: '/profiles/[childId]/edit',
                query: { childId: profile.id },
              }}
            >
              <Button variant="outline" size="sm">
                <ArabicText size="ui">تعديل</ArabicText>
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="p-6 space-y-3">
          <ArabicText as="h2" size="ui" className="text-lg font-semibold block">
            بياناتك
          </ArabicText>
          <ArabicText size="caption" className="block text-muted-foreground">
            صدّر كلّ بيانات هذا الطفل (سجلّ القراءة، الإجابات، المستوى) كملفّ JSON.
          </ArabicText>
          <Link
            href={{
              pathname: '/api/profiles/[childId]/export',
              query: { childId: profile.id },
            }}
            prefetch={false}
          >
            <Button variant="outline" size="lg" className="w-full">
              <ArabicText size="ui">تصدير بيانات الطفل</ArabicText>
            </Button>
          </Link>
        </Card>

        <Card className="p-6 space-y-3 border-destructive/50">
          <ArabicText as="h2" size="ui" className="text-lg font-semibold block text-destructive">
            منطقة الخطر
          </ArabicText>
          <ArabicText size="caption" className="block text-muted-foreground">
            حذف الملف سيمسح كلّ سجلّ القراءة والإجابات. لا يمكن التراجع.
          </ArabicText>
          <DeleteChildDialog childId={profile.id} childName={profile.displayName} />
        </Card>

        <div className="text-center">
          <Link href="/choose-child" className="text-primary underline-offset-4 hover:underline">
            <ArabicText size="caption">العودة للقائمة</ArabicText>
          </Link>
        </div>
      </div>
    </main>
  );
}
