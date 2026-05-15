// Active-child cookie helpers — framework-agnostic.
//
// The cookie indicates which child profile is currently "active" for the parent.
// It carries no credential value: every authenticated read of child data goes
// through `requireActiveChild()` which re-validates the cookie value against
// the DB via RLS (the parent literally cannot SELECT a child they don't own,
// regardless of what cookie value is set). Spoofing the cookie value to another
// parent's child UUID returns zero rows and trips `AuthError('NO_ACTIVE_CHILD')`.

export const ACTIVE_CHILD_COOKIE = 'qira_active_child' as const;

export interface ActiveChildCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
}

export function activeChildCookieOptions(): ActiveChildCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
}

// RFC 4122 UUID (any version) — used to validate the cookie value before
// feeding it into a SQL WHERE clause. Defense against malformed cookies.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns the cookie value if it's a syntactically valid UUID, otherwise null.
 */
export function parseActiveChildCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  return UUID_RE.test(raw) ? raw.toLowerCase() : null;
}
