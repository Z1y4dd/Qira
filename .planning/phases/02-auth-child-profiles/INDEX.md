---
phase: phase-2-auth-child-profiles
plan: index
type: execute
wave: 0
depends_on: []
files_modified: []
autonomous: false
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
  - AUTH-05
  - AUTH-06
  - PROF-01
  - PROF-02
  - PROF-03
  - PROF-04
  - PROF-05
  - PROF-06
  - COMP-LEGAL-03
  - COMP-LEGAL-04
mode: mvp
ui_hint: yes
---

# Phase 2 Auth & Child Profiles — Plan Index

## Phase summary

Phase 2 ships parent auth (email/password + feature-flagged Google OAuth) with mandatory email verification, child profile CRUD with schema-level cascade delete, the always-shown active-child picker, signed-by-RLS active-child cookies, and the parent-data-rights surfaces (Arabic privacy notice + per-child JSON export + type-the-name delete). It closes 14 requirements (AUTH-01..06, PROF-01..06, COMP-LEGAL-03/04) and the four ROADMAP Phase 2 success criteria. A new CI gate — `auth-getsession-ban` — lands in Slice 1 and stays green from then on.

## Phase goal (user story)

**As a** parent of an Arabic-speaking 5–12 year old, **I want to** create an account, sign in securely, manage one or more child profiles, and have a clear way to export or delete my child's data, **so that** my child has a personal reading account I can manage with confidence and the Supabase SSR cookie-leak pitfall is provably impossible.

## Requirement coverage

| Req ID | Requirement (paraphrased) | Slice(s) | Verification |
|--------|---------------------------|----------|--------------|
| AUTH-01 | Email/password sign-up via Supabase Auth | 2 | E2E: sign up + see /verify-email |
| AUTH-02 | Google OAuth sign-up/sign-in via Supabase | 2 (scaffold, feature-flag) | Code path exists; button hidden unless env flag set |
| AUTH-03 | Email verification after email/password sign-up | 2 | E2E: hard gate redirects unverified to /verify-email |
| AUTH-04 | Password reset via email link | 3 | E2E: request reset + open mocked email + reset |
| AUTH-05 | Session persists across browser refresh, enforced server-side | 1 + 2 | Playwright: refresh while signed in, still authenticated |
| AUTH-06 | force-dynamic + getUser() (never getSession) on every authed route; cross-user E2E proves no bleed | 1 (gate) + 6 (E2E) | Vitest `auth-getsession-ban.test.ts` + Playwright cross-user spec |
| PROF-01 | Parent creates child profile (display name, age 5–12, grade band) | 4 | E2E: create + appears on /choose-child |
| PROF-02 | Parent edits child profile | 4 | E2E: edit name + age + grade band |
| PROF-03 | Parent deletes child profile (cascade) | 4 + 6 | E2E: type-the-name delete + DB row + cascade attempts/answers gone |
| PROF-04 | /choose-child picker on entry; active-child cookie | 5 | E2E: pick → cookie set → enter app |
| PROF-05 | Switch active child via Server Action; no client-side leak | 5 | E2E: switch → cookie updated → other child's data not visible |
| PROF-06 | All authenticated queries filter by parent_id AND child_id; RLS enforces | 4 + 5 (Service Layer) | Cross-user E2E + Service Layer code review |
| COMP-LEGAL-03 | Arabic privacy notice page | 6 | Route exists at /privacy with Fusha placeholder copy |
| COMP-LEGAL-04 | Parent can export or delete child data from one screen | 6 | E2E: download JSON + delete with type-the-name |

## Success-criteria coverage (ROADMAP lines 47–51)

| # | Success criterion (paraphrased) | Slice(s) | Concrete verification |
|---|---------------------------------|----------|----------------------|
| 1 | Sign up email/password (receive verification), sign in Google OAuth, password reset, session persists across refresh | 1 + 2 + 3 | Playwright spec covers all four flows; OAuth covered by mocked callback test |
| 2 | Create / edit / delete child profiles; delete cascades through attempt history | 4 + 6 | Playwright + Vitest service test asserts cascade |
| 3 | /choose-child on entry; active-child cookie; switch via Server Action with no client-side data leak | 5 | Cross-user E2E asserts switching never reveals other child's data |
| 4 | Playwright cross-user E2E (Parent A then Parent B fresh context, no session bleed) + Vitest fails build if any server file references getSession() or any authenticated route missing force-dynamic | 1 (gate) + 6 (E2E) | Both tests live and gating |
| 5 | Privacy notice page; from profile screen, parent can JSON-export child data or hard-delete (with cascade) | 6 | Routes exist; E2E exercises both flows |

## Slice list (linear execution: 1 → 2 → 3 → 4 → 5 → 6)

| Slice | File | One-line description |
|-------|------|----------------------|
| 1 | `02-01-PLAN.md` | Auth foundation: getUser/email_confirmed_at gate in (authenticated) layout, `requireParent` Service Layer body with lazy upsert, Vitest `getSession` ban CI gate, RHF + shadcn Form deps |
| 2 | `02-02-PLAN.md` | Public `(auth)` routes: `/sign-up`, `/sign-in`, `/verify-email`, `/auth/callback` + Server Actions + Google OAuth feature-flag scaffold |
| 3 | `02-03-PLAN.md` | Password reset: `resetPasswordForEmail` Server Action + `/reset-password` page with token exchange |
| 4 | `02-04-PLAN.md` | Child profile CRUD: real `profiles.ts` Service bodies + `/profiles/new` + `/profiles/[childId]/edit` pages + RHF forms with Arabic Zod errors |
| 5 | `02-05-PLAN.md` | Active-child picker: `/choose-child` page + signed cookie helper + avatar nav chip + switch Server Action + `requireActiveChild` Service body |
| 6 | `02-06-PLAN.md` | Privacy + data rights: `/privacy` placeholder Arabic copy + `/profiles/[childId]/manage` page + JSON export Server Action + type-the-name delete Dialog + Playwright cross-user E2E + Arabic Supabase email template drafts |

## Execution order and dependencies

```
Slice 1 (Auth foundation: gate + Service bodies + CI gate)
   ↓ (foundation must exist before any auth surface route is meaningful)
Slice 2 (Public auth pages + Google OAuth scaffold)
   ↓ (sign-in must work before password reset can be tested)
Slice 3 (Password reset)
   ↓ (a parent must be able to sign in before child profile CRUD is testable)
Slice 4 (Child profile CRUD)
   ↓ (profiles must exist before the picker has something to pick from)
Slice 5 (Active-child picker + nav chip)
   ↓ (full sign-in→pick→app flow must work before privacy/export gates fire)
Slice 6 (Privacy + export + delete + cross-user E2E + email templates)
```

Linear order is non-negotiable in MVP-mode. Each slice's demo gate must pass before the next slice begins.

## Decisions locked (from 02-CONTEXT.md D-01 through D-12)

| Decision | Value | Source |
|----------|-------|--------|
| Sign-in/up layout | Two pages: `/sign-in` + `/sign-up` | D-01 |
| Email verification | Hard gate (no app access until verified) | D-02 |
| Password reset landing | Dedicated `/reset-password` page | D-03 |
| Google OAuth scaffold | Code in main, button feature-flagged via `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED` | D-04 |
| Picker behavior | Always show `/choose-child` on every sign-in | D-05 |
| Switch UX | Avatar chip in top-right nav (top-left in RTL) | D-06 |
| Delete confirmation | Type-the-name modal | D-07 |
| Privacy notice copy | Claude drafts Fusha placeholder; user edits before launch | D-08 |
| Export format | Per-child JSON download from `/profiles/[childId]/manage`, server-streamed | D-09 |
| Delete cascade | Schema-level: `child_profiles → attempts → attempt_answers` | D-10 |
| Email sender | Supabase built-in for v1; swap before public launch | D-11 |
| Email template language | Arabic only (Fusha) | D-12 |

## Out of scope for Phase 2

Parent account deletion, magic-link sign-in, two-factor auth, real SMTP provider (Resend / Postmark), account-level data export, anonymized analytics blank-out on delete, profile avatars, placement assessment (Phase 3), reader/comprehension flows (Phase 4), `/api/v1/*` (Phase 5), scheduled retention cleanup job (Phase 5).

## Task and commit estimates

| Metric | Estimate |
|--------|----------|
| Total task count (across 6 slices) | **~34** |
| Atomic commits expected | **~34** (1:1) |
| Wall-clock for solo executor + AI | **8–12 working hours** |
| Context budget per slice | **~30–40%** (each slice is bounded) |

## Per-slice plans

See:
- `02-01-PLAN.md`
- `02-02-PLAN.md`
- `02-03-PLAN.md`
- `02-04-PLAN.md`
- `02-05-PLAN.md`
- `02-06-PLAN.md`

## Out-of-band actions (user must do post-execution)

1. Supabase Dashboard → Authentication → URL Configuration → add the Vercel deploy URL + `http://localhost:3000` to Site URL / Additional Redirect URLs.
2. Supabase Dashboard → Authentication → Email Templates → paste the four Arabic drafts from Slice 6.
3. (Optional) Google Cloud Console → create OAuth client → paste into Supabase Auth → Providers → Google → set `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true`.

## Recommended next step

`/gsd-execute-phase 2` to run all slices in linear order with atomic commits per task.
