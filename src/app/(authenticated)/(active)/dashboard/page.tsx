import { cookies } from 'next/headers';
import { ArabicText } from '@/components/arabic-text';
import { ACTIVE_CHILD_COOKIE } from '@/lib/active-child-cookie';
import { requireActiveChild } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const active = await requireActiveChild(supabase, cookieStore.get(ACTIVE_CHILD_COOKIE)?.value);

  return (
    <main className="min-h-screen px-4 py-16">
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <ArabicText as="h1" size="reader" className="text-4xl block">
          مرحباً {active.displayName}!
        </ArabicText>
        <ArabicText size="ui" className="block text-muted-foreground">
          الكتب والقصص ستظهر هنا قريباً. سنقيّم مستواك أوّلاً ثم نختار لك قصصاً مناسبة.
        </ArabicText>
      </div>
    </main>
  );
}
