# Phase 2: Auth & Child Profiles - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 2-auth-child-profiles
**Areas discussed:** Auth flow shape, Child profile picker UX, Privacy + data rights surfaces, Email verification + SMTP

---

## Auth flow shape

### Sign-up + sign-in page layout?

| Option | Description | Selected |
|--------|-------------|----------|
| Two pages: /sign-in and /sign-up | Separate routes. Each shows email/password fields + Google button + link to the other. | ✓ |
| One combined page with toggle | Single /auth route, tab or toggle switches between modes. | |
| Modal on landing page | Landing / stays the welcome screen; clicking "ابدأ" opens an auth modal. | |

**User's choice:** Two pages. Cleaner deep-linking from verification + reset emails, easier to test, communicates trust.

### Email verification — hard gate or soft gate?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard gate | Until verified, no access to /dashboard or profile creation. | ✓ |
| Soft gate | Browse + create profiles allowed; placement blocked until verified. | |

**User's choice:** Hard gate. Clean data model + matches AUTH-03 spirit.

### Password reset — where does the email link land?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated /reset-password page | Email link → /reset-password?token=... with new password field. | ✓ |
| Auto-login + force password change on next screen | Email link logs them in temporarily, routes to interstitial. | |

**User's choice:** Dedicated page. Standard pattern, easy to localize, plays nicely with Supabase's recovery flow.

---

## Child profile picker UX

### After parent signs in, what shows first?

| Option | Description | Selected |
|--------|-------------|----------|
| Always show picker | /choose-child shown on every sign-in — explicit choice every time. | ✓ |
| Auto-select last active if only 1 child | Single-child families skip the picker; appears only when 2+ exist. | |
| Auto-select last active always | Picker only via switch button in nav. | |

**User's choice:** Always show. Best for shared devices and consistency.

### Switch active child — where's the entry point?

| Option | Description | Selected |
|--------|-------------|----------|
| Avatar button in top-right nav | Always-visible chip showing active child + menu of others. | ✓ |
| Dedicated /profiles page | Navigate to /profiles, tap a card to switch. | |

**User's choice:** Avatar chip. Standard kid-app pattern, low-friction switching.

### Delete child profile — confirmation friction?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal with type-the-name confirmation | "Type [child name] to confirm." | ✓ |
| Simple OK / Cancel modal | Standard confirmation. | |
| Re-enter parent password | Strongest friction. | |

**User's choice:** Type-the-name. Friction proportionate to cascade-deleting all attempt history.

---

## Privacy + data rights surfaces

### Privacy notice — who writes the Arabic copy?

| Option | Description | Selected |
|--------|-------------|----------|
| Claude drafts placeholder, user edits | Plain-language Arabic; user reviews + edits before launch. | ✓ |
| User drafts later | Scaffolds /privacy route with TODO. | |
| Skip the page; link to external doc | Page hosts only a link to a Google Doc/PDF. | |

**User's choice:** Claude drafts placeholder. Best for forward progress; user owns final wording before public launch.

### Data export format + button location?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-child JSON from /profiles/[childId]/manage | Page with both export + delete buttons; server-streamed JSON download. | ✓ |
| Parent-account-level export (all children at once) | One button bundles ALL children. | |
| Email me the export | Email with JSON attachment. | |

**User's choice:** Per-child JSON. Matches COMP-LEGAL-04 surgical scope.

### Hard delete cascade scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Child + all child-attributable data | Drizzle onDelete:cascade: child_profiles → attempts → attempt_answers. | ✓ |
| Cascade + anonymize analytics | Above + first-party event log anonymization (Phase 5 dep). | |

**User's choice:** Schema-level cascade. Phase 5 analytics work doesn't exist yet.

---

## Email verification + SMTP

### Email sender — Supabase built-in or own SMTP?

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase built-in for v1 | Rate-limited ~4/hr free, ~30/hr Pro. Fine for dev + alpha. | ✓ |
| Wire Resend / Postmark now | User provides SMTP creds; Supabase configured to use them. | |

**User's choice:** Supabase built-in for v1. Tracked as "swap before public launch" item.

### Email template language — Arabic only or AR+EN?

| Option | Description | Selected |
|--------|-------------|----------|
| Arabic only | All four templates in Fusha. Matches Arabic-only v1 stance. | ✓ |
| AR + EN bilingual | Each email contains both languages. | |

**User's choice:** Arabic only. Consistent with v1 language posture.

### Google OAuth setup — do you have a Google Cloud project ready?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, configure in Supabase dashboard | User has / will create Google Cloud OAuth client. | |
| No, defer to Phase 2.5 | Ship without Google; track as inserted phase. | |
| Scaffold both, make Google opt-in via env flag | Code in main, button hidden unless NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true. | ✓ |

**User's choice:** Feature-flag scaffold. User finishes Google Cloud setup post-Phase-2 and flips the flag.

---

## Claude's Discretion

- shadcn primitives for new form components (Input, Label, Card, Dialog, Form). React Hook Form + Zod resolver.
- Active-child cookie name `qira_active_child`, signed via parent's Supabase session JWT, `httpOnly`, `secure`, `sameSite: 'lax'`.
- Vitest unit test `auth-getsession-ban.test.ts` greps for `getSession` in `src/app/` + `src/utils/supabase/server.ts` and fails the build on any hit.
- Playwright cross-user E2E uses `SUPABASE_SERVICE_ROLE_KEY` to create disposable test parents via the admin API.
- New `(auth)` route group for public auth routes (sign-in, sign-up, verify-email, reset-password).

## Deferred Ideas

- Parent account deletion (whole-account cascade) — separate flow, not Phase 2.
- Magic-link sign-in (passwordless) — not in v1 requirements.
- Two-factor auth (TOTP / SMS) — future hardening.
- Real SMTP provider (Resend / Postmark) — Phase 5 pre-launch checklist.
- Account-level data export (all children at once) — Phase 2 ships per-child path.
- Anonymized analytics blank-out on delete — depends on Phase 5 event logging.
- Profile avatars / illustrations — Phase 4 polish or post-MVP.
