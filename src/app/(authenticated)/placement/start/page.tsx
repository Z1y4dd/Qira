import { cookies } from 'next/headers';
import { ArabicText } from '@/components/arabic-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { startPlacementAction } from '@/app/(authenticated)/placement/actions';
import { ACTIVE_CHILD_COOKIE } from '@/lib/active-child-cookie';
import { requireActiveChild } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Placement start screen — the entry point for unplaced children.
 * Shows a friendly Arabic intro and the "ابدأ التقييم" CTA.
 *
 * PLAC-01: this is the start screen the gate from Plan 06 routes to.
 */
export default async function PlacementStartPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const active = await requireActiveChild(supabase, cookieStore.get(ACTIVE_CHILD_COOKIE)?.value);

  return (
    <div className="space-y-6 text-center" dir="rtl">
      <ArabicText as="h1" size="reader" className="text-3xl block text-center">
        مرحباً {active.displayName}!
      </ArabicText>

      <ArabicText size="ui" className="block text-center text-muted-foreground">
        سنطرح عليك بعض الأسئلة لنختار لك أفضل المستوى لقراءتك.
      </ArabicText>

      <Card className="p-6">
        <form action={startPlacementAction}>
          <Button type="submit" size="lg" className="w-full">
            <ArabicText size="ui">ابدأ التقييم</ArabicText>
          </Button>
        </form>
      </Card>
    </div>
  );
}
