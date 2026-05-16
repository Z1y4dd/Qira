import type { Route } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { ArabicText } from '@/components/arabic-text';
import { EscapeHatch } from '@/components/placement/escape-hatch';
import { Button } from '@/components/ui/button';
import { db } from '@/db/client';
import { attempts, levels } from '@/db/schema';
import { ACTIVE_CHILD_COOKIE } from '@/lib/active-child-cookie';
import { AuthError, requireActiveChild } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

interface PlacementResultPageProps {
  params: Promise<{ attemptId: string }>;
}

/**
 * Placement result screen — shown after all 15 questions are answered.
 *
 * PLAC-05: renders "اخترنا لك المستوى X" with the assigned level number.
 * SC4 / PLAC-06: EscapeHatch is embedded here so it's visible AFTER placement too.
 *
 * If the attempt isn't finished yet (finishedAt is null), redirect back to the
 * item page — the kid arrived here too early (e.g., directly typed the URL).
 *
 * RLS cross-check: requireActiveChild verifies the parent owns the active child;
 * the attempt query WHERE clause checks childId matches — so cross-child access
 * is blocked at both the app layer and DB layer (RLS on attempts).
 */
export default async function PlacementResultPage({ params }: PlacementResultPageProps) {
  const { attemptId } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let active;
  try {
    active = await requireActiveChild(supabase, cookieStore.get(ACTIVE_CHILD_COOKIE)?.value);
  } catch (err) {
    if (err instanceof AuthError) redirect('/choose-child');
    throw err;
  }

  // Load the attempt — childId cross-check (defense in depth beyond RLS)
  const [attemptRow] = await db
    .select({
      finishedAt: attempts.finishedAt,
      assignedLevelId: attempts.assignedLevelId,
      childId: attempts.childId,
    })
    .from(attempts)
    .where(eq(attempts.id, attemptId))
    .limit(1);

  // Attempt not found or not owned by active child
  if (!attemptRow || attemptRow.childId !== active.id) {
    redirect('/placement/start' as Route);
  }

  // Not finished yet — redirect back to item page
  if (!attemptRow.finishedAt) {
    redirect(`/placement/${attemptId}` as Route);
  }

  // Look up the assigned level number
  let levelNumber: number | null = null;
  if (attemptRow.assignedLevelId) {
    const [levelRow] = await db
      .select({ number: levels.number })
      .from(levels)
      .where(eq(levels.id, attemptRow.assignedLevelId))
      .limit(1);
    levelNumber = levelRow?.number ?? null;
  }

  return (
    <div className="space-y-6 text-center" dir="rtl">
      <ArabicText as="h1" size="reader" className="text-4xl block text-center">
        اخترنا لك المستوى{' '}
        <bdi dir="ltr" className="font-cairo">
          {levelNumber ?? '—'}
        </bdi>
      </ArabicText>

      <ArabicText size="reader" className="block text-center text-muted-foreground">
        هيا نقرأ معاً قصصاً ممتعة!
      </ArabicText>

      <div className="flex flex-col gap-3 mt-6">
        <Link href={'/library' as Route}>
          <Button size="lg" className="w-full">
            <ArabicText size="ui">اذهب إلى المكتبة</ArabicText>
          </Button>
        </Link>

        <Link href={`/profiles/${active.id}/manage` as Route}>
          <Button variant="outline" size="lg" className="w-full">
            <ArabicText size="ui">إعادة التقييم؟</ArabicText>
          </Button>
        </Link>
      </div>

      {/* SC4 / PLAC-06: escape hatch visible AFTER placement — Plan 05 wires the abort action */}
      <EscapeHatch mode="placement" attemptId={attemptId} />
    </div>
  );
}
