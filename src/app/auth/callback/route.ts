import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

// OAuth + email-link landing. Exchanges the ?code= for a session, then sends
// the parent to /choose-child. On failure, sends them back to /sign-in with
// an error hint in the query.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/sign-in?error=missing_code', request.url));
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/sign-in?error=callback_failed', request.url));
  }

  return NextResponse.redirect(new URL('/choose-child', request.url));
}
