import { and, desc, eq } from 'drizzle-orm';
import type { Route } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArabicText } from '@/components/arabic-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { db } from '@/db/client';
import { attempts, levels } from '@/db/schema';
import { getPlacementState } from '@/services/placement';
import { type ChildId, getChildProfile } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';
import { DeleteChildDialog } from './delete-dialog';
import { ResetPlacementForm } from './reset-placement-form';

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

  // Placement status for the status card
  const placementState = await getPlacementState(profile.id);

  // Resolve assigned level number if placement is completed or escape_hatched
  let assignedLevelNumber: number | null = null;
  if (placementState === 'completed' || placementState === 'escape_hatched') {
    const [latestAttempt] = await db
      .select({ assignedLevelId: attempts.assignedLevelId })
      .from(attempts)
      .where(and(eq(attempts.childId, profile.id), eq(attempts.kind, 'placement')))
      .orderBy(desc(attempts.startedAt))
      .limit(1);

    if (latestAttempt?.assignedLevelId) {
      const [levelRow] = await db
        .select({ number: levels.number })
        .from(levels)
        .where(eq(levels.id, latestAttempt.assignedLevelId))
        .limit(1);
      assignedLevelNumber = levelRow?.number ?? null;
    }
  }

  function PlacementStatusText() {
    if (placementState === 'not_started') {
      return (
        <ArabicText size="ui" className="block">
          لم يبدأ بعد
        </ArabicText>
      );
    }
    if (placementState === 'in_progress') {
      return (
        <ArabicText size="ui" className="block">
          جاري التقييم
        </ArabicText>
      );
    }
    if (placementState === 'completed') {
      return (
        <ArabicText size="ui" className="block">
          المستوى المُعيَّن: <bdi dir="ltr">{assignedLevelNumber ?? '—'}</bdi>
        </ArabicText>
      );
    }
    // escape_hatched
    return (
      <ArabicText size="ui" className="block">
        تم تخطي التقييم — المستوى التقريبي: <bdi dir="ltr">{assignedLevelNumber ?? '—'}</bdi>
      </ArabicText>
    );
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
            <Link href={`/profiles/${profile.id}/edit` as Route}>
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
          <a href={`/api/profiles/${profile.id}/export`} download>
            <Button variant="outline" size="lg" className="w-full">
              <ArabicText size="ui">تصدير بيانات الطفل</ArabicText>
            </Button>
          </a>
        </Card>

        <Card className="p-6 space-y-3">
          <ArabicText as="h2" size="ui" className="text-lg font-semibold block">
            حالة التقييم
          </ArabicText>
          <PlacementStatusText />
          <ResetPlacementForm
            childId={profile.id}
            childName={profile.displayName}
            state={placementState}
          />
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
