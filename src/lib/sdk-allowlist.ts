/**
 * Single source of truth for third-party origins authorized on child-facing
 * routes. COMP-LEGAL-01: nothing outside this list may receive a request
 * from any Qira surface.
 *
 * Adding to this list requires:
 *   1. Documenting WHY in this file (purpose, data sent, retention, sub-processors).
 *   2. Updating the privacy notice to disclose the new sub-processor.
 *   3. A literacy/compliance reviewer's eyeball on the PR.
 *
 * Enforcement:
 *   - tests/invariants/sdk-allowlist.test.ts pins the runtime shape.
 *   - tests/e2e/network-audit.spec.ts asserts at runtime that no request
 *     fires outside this list (plus same-origin).
 */

export const ALLOWED_HOST_PATTERNS: readonly RegExp[] = [
  // Supabase production project URLs (Auth, Postgres REST, Storage, Realtime).
  // Purpose: backend platform. Data sent: child profile + attempt payloads.
  // Retention: governed by Supabase project settings + Qira retention policy.
  /\.supabase\.co$/,
  // Supabase staging region.
  /\.supabase\.in$/,
] as const;

/**
 * Returns true if the given URL's host matches any allowed pattern OR is the
 * page's own origin (same-origin is implicitly allowed for `/_next/*` assets,
 * Server Action POSTs, etc).
 */
export function isAllowedHost(url: string, pageOrigin: string): boolean {
  try {
    const u = new URL(url);
    if (u.origin === pageOrigin) return true;
    return ALLOWED_HOST_PATTERNS.some((re) => re.test(u.host));
  } catch {
    // Unparseable URLs are always disallowed.
    return false;
  }
}
