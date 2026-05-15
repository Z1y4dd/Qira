import type { NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export const proxy = async (request: NextRequest) => {
  return await updateSession(request);
};

export const config = {
  matcher: [
    // Skip Next internals, static assets, and the favicon. Adjust as needed.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
