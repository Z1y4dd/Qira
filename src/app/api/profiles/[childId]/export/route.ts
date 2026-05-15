import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { exportChildData } from '@/services/data-export';
import { AuthError, type ChildId } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

// JSON download endpoint — browser handles the file download natively via the
// Content-Disposition header. The Service Layer is the trust boundary: it
// re-verifies parent ownership of the child before returning data.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ childId: string }> },
) {
  const { childId } = await params;
  const supabase = createClient(await cookies());

  try {
    const { filename, json } = await exportChildData(supabase, childId as ChildId);
    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (err instanceof AuthError && err.reason === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    if (err instanceof AuthError && err.reason === 'UNVERIFIED') {
      return NextResponse.json({ error: 'unverified' }, { status: 403 });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
