---
phase: 02-auth-child-profiles
plan: 02
slice_name: sign-up-sign-in-verify
status: complete
completed_date: "2026-05-15"
tasks_completed: 6
tasks_total: 6
key_decisions:
  - useActionState pattern (Next 16 / React 19.2) for all form Server Actions — no third-party form-state library
  - Supabase error codes translated via src/lib/supabase-error-ar.ts (single source of truth for Arabic auth UX strings)
  - /verify-email is a force-dynamic Server Component that reads getUser() and self-redirects (already verified → /choose-child, no session → /sign-in)
  - /auth/callback uses exchangeCodeForSession (NOT getSession — stays compliant with the AUTH-06 ban)
  - Google button is a Client Component that no-ops via early return when NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED !== 'true'
---

# Slice 2 Summary

Public auth surface: /sign-up, /sign-in, /verify-email, /auth/callback, plus feature-flagged Google OAuth button. All Arabic, all RTL via logical-property utilities.

Demo gate hit:
- Sign-up form → Supabase email arrives → /verify-email page renders with parent's email + resend action.
- Sign-in → /choose-child redirect on success; on email_not_confirmed surfaces an inline "resend verification" affordance.
- /auth/callback handles both OAuth and email-link code exchange.
