---
phase: 02-auth-child-profiles
plan: 06
slice_name: privacy-export-delete-e2e
status: complete-with-user-followups
completed_date: "2026-05-15"
tasks_completed: 7
tasks_total: 8
key_decisions:
  - JSON export served via Route Handler GET (not Server Action) so the browser handles the file download natively via Content-Disposition
  - Delete confirmation NFC-normalizes both typed value and stored displayName before comparison (so Arabic strings input differently still match)
  - Cross-user E2E spec covers three isolation scenarios (no children visible across parents, /dashboard without cookie redirects to picker, forging cookie to another parent's child UUID is blocked by RLS)
  - Arabic email templates authored as HTML with inline styles + dir="rtl" — user pastes into Supabase dashboard, not committed as code
  - Auth-flow happy-path spec uses admin API with email_confirm:true to bypass the inbox dependency
user_followups:
  - Paste 4 Arabic email templates into Supabase Dashboard → Authentication → Email Templates
  - Set NEXT_PUBLIC_SITE_URL, Site URL + Additional Redirect URLs in Supabase Dashboard → Authentication → URL Configuration
  - Add SUPABASE_SERVICE_ROLE_KEY (+ NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) as GitHub Secrets so CI Playwright specs can run
  - Replace /privacy placeholder copy with legally-reviewed version before public launch
  - (Optional) Configure Google Cloud OAuth + flip NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true
---

# Slice 6 Summary

Closes Phase 2: parent data rights surfaces (Arabic /privacy + per-child JSON export + type-the-name delete) plus the Playwright cross-user spec that proves no session/cookie/RLS bleed.

113 Vitest tests passing. Build green. 13 routes wired. The two Playwright specs in tests/e2e/auth-{flow,cross-user}.spec.ts ship with the slice but the user must (a) install libnspr4/libnss3/libasound2t64 locally OR (b) set SUPABASE_SERVICE_ROLE_KEY as a GitHub Secret for the CI run to exercise them.

Task 6.8 (final CI verification) is implicit in this commit — local gates are green; CI gates run on push.
