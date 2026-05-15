# Phase 2: Auth & Child Profiles - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

A parent can create an account, sign in, create / edit / delete child profiles, pick which child is active, and exercise their COPPA-flavored data rights (Arabic privacy notice, JSON export, hard delete). The Supabase SSR cookie-leak pitfall is provably impossible (force-dynamic + `getUser()` + cross-user E2E test).

**In scope:**
- Email/password sign-up + sign-in with mandatory email verification
- Google OAuth sign-in (code scaffolded but feature-flagged behind `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`)
- Password reset via email link → `/reset-password` form
- Child profile CRUD (create / read / edit / delete) with cascade delete
- Always-shown `/choose-child` picker on every parent sign-in; switch-child via avatar nav chip
- Signed "active child" cookie set by a Server Action
- Privacy notice page (Arabic) — placeholder copy authored by Claude, user edits before launch
- Per-child JSON export from `/profiles/[childId]/manage`
- CI gates: ban `supabase.auth.getSession()` in server code; assert every authenticated route layout sets `force-dynamic`; Playwright cross-user E2E

**Out of scope (deferred to later phases):**
- Placement assessment surface (Phase 3)
- Reader + comprehension flows (Phase 4)
- Real SMTP provider (Resend / Postmark) — Phase 2 ships with Supabase built-in sender; swap before public launch
- Multi-tenant orgs / schools (post-v1)
- Scheduled retention cleanup job (Phase 5 COMP-LEGAL-05)
- Mobile-ready `/api/v1/*` surface (Phase 5)

**Requirements covered:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06, COMP-LEGAL-03, COMP-LEGAL-04

</domain>

<decisions>
## Implementation Decisions

### Auth flow shape
- **D-01:** Two separate pages, `/sign-in` and `/sign-up`. Each shows email/password fields, Google button (feature-flagged), and a link to the other. Server Components for the shell; Client Component only for the form interactivity.
- **D-02:** **Hard email verification gate.** After sign-up the parent sees `/verify-email` ("check your inbox"). Until `auth.users.email_confirmed_at` is non-null, every authenticated route redirects to `/verify-email`. This keeps the data model clean — no half-verified accounts walking around — and matches AUTH-03's spirit.
- **D-03:** **Password reset → dedicated `/reset-password` page.** The Supabase recovery-token email link lands at `/reset-password?token=...`. One field ("new password") + confirm field. Standard pattern, fully localizable.
- **D-04:** Google OAuth: scaffold the button + the `/auth/callback` route, but hide the button unless `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true'`. User finishes Google Cloud OAuth client setup post-Phase-2 and flips the flag.

### Child profile picker UX
- **D-05:** After every parent sign-in, route to `/choose-child`. Always-shown — even with 1 child — to keep behavior consistent on shared devices. Picker is a grid of profile cards plus an "إضافة طفل" (add child) card.
- **D-06:** Switching the active child is an avatar **chip in the top-right nav** (which renders as top-left in RTL via Tailwind logical properties). Tapping the chip opens a small menu listing other profiles + "إدارة الملفات" (manage profiles). Implemented as a Server Action that resets the signed `active_child_id` cookie and reloads.
- **D-07:** Delete child profile = **modal with type-the-name confirmation.** Parent must type the child's display name exactly before the Delete button enables. Friction proportionate to the permanence of cascade-deleting all attempt history.

### Privacy + data rights
- **D-08:** Claude drafts a **placeholder Arabic Privacy Notice** at `/privacy`. Content: what's collected for parent (email only), what's collected for child (display name, age 5–12, grade band, reading attempts, answers), how the parent can export, how the parent can delete, "no third-party tracking or analytics on child-facing routes" statement. User reviews + edits Arabic copy before public launch (tracked as a Phase 5 / pre-launch checklist item).
- **D-09:** **Per-child JSON export** from `/profiles/[childId]/manage`. The page hosts two buttons: "تصدير بيانات الطفل" (export) and "حذف الملف الشخصي" (delete). Export is a Server Action returning a JSON blob (`Content-Type: application/json`, `Content-Disposition: attachment`) bundling parent email + this child profile + all `attempts` + all `attempt_answers`. Server-streamed via `Response` body so client memory stays small even on heavy histories.
- **D-10:** Hard delete cascade = **child row + all attempts + all attempt_answers.** Drizzle's `onDelete: 'cascade'` already enforces this at the schema level (Phase 1 — see `src/db/schema.ts` for `child_profiles → attempts → attempt_answers`). Parent's own account is NOT deleted by this flow; that's a separate "delete account" path explicitly out of scope for Phase 2.

### Email verification + SMTP
- **D-11:** **Supabase built-in email sender** for v1. No own SMTP provider. Acknowledged limitation: ~4 emails/hour rate limit on free tier, ~30/hour on Pro. Fine for dev + early users; tracked as a "swap before public launch" item.
- **D-12:** **Arabic-only email templates.** All four Supabase Auth templates (Confirm Sign-up, Magic Link, Change Email Address, Reset Password) authored in Fusha. Claude provides placeholder Arabic copy in the CONTEXT/plan; user pastes finalized versions into the Supabase dashboard (templates live in the Supabase project config, not in the repo).

### Claude's discretion
- Component library: continue using shadcn primitives (`Button`, plus new `Input`, `Label`, `Card`, `Dialog`, `Form` to be copy-pasted in via shadcn CLI). Forms use React Hook Form + Zod resolver per CLAUDE.md stack.
- Session enforcement pattern: every route under `(authenticated)/` uses `export const dynamic = 'force-dynamic'` (gate already exists from Phase 1) AND calls `supabase.auth.getUser()` (NEVER `getSession()`). A Vitest unit test under `tests/invariants/auth-getsession-ban.test.ts` greps `src/` and `src/app/` for the substring `\\bgetSession\\b` and fails the build if it finds any occurrence inside `src/app/` or `src/utils/supabase/server.ts`.
- Active-child cookie: signed via Supabase's session JWT (parent ID is the salt), name `qira_active_child`, `httpOnly`, `secure`, `sameSite: 'lax'`, scoped to the parent session lifetime.
- Cross-user E2E: Playwright spec that creates two test parents (using a `tests/e2e/_helpers/test-parents.ts` factory that hits the Supabase admin REST API with `SUPABASE_SERVICE_ROLE_KEY`), signs in as Parent A in one context, signs in as Parent B in a fresh context, and asserts no data bleed via the `/api/internal/whoami`-style probe (also new).
- shadcn `Form` field labels go in Arabic; error messages also in Arabic. Zod schemas use `z.string().min(8).regex(...)` with Arabic error messages via `{ message: '...' }`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — north-star pitfalls (esp. Pitfall #5 server-authoritative scoring, Pitfall #11 RLS USING+WITH CHECK, Pitfall #13 driver, Pitfall #15 vendor-lock-in insulation)
- `.planning/REQUIREMENTS.md` §Auth, §Child Profiles, §Compliance/Legal — locked requirement text for AUTH-01..06, PROF-01..06, COMP-LEGAL-03/04
- `.planning/ROADMAP.md` Phase 2 section — five success criteria the phase must satisfy at exit
- `CLAUDE.md` — Technology Stack table (specifically: Supabase Auth + `@supabase/ssr` + shadcn + React Hook Form + Zod 4 decision)

### Phase 1 outputs that Phase 2 builds on
- `src/db/schema.ts` — `parents`, `child_profiles` tables + RLS policies are already live (lines defining `parents`, `childProfiles` pgTables + their 4-entry pgPolicy blocks)
- `src/db/client.ts` — Proxy-wrapped lazy `db` export; Phase 2 services import from here
- `src/utils/supabase/server.ts`, `src/utils/supabase/client.ts`, `src/utils/supabase/middleware.ts` — `@supabase/ssr` scaffolding already in place
- `src/proxy.ts` — Next.js middleware (named `proxy` per Next 16 convention) already wired to call `updateSession`
- `src/app/(authenticated)/layout.tsx` — already declares `force-dynamic`; Phase 2 adds the `getUser()` + redirect logic inside it
- `src/services/profiles.ts` — service stubs (`requireParent`, `requireActiveChild`, `listChildProfiles`, `createChildProfile`, `deleteChildProfile`) — Phase 2 fills in real bodies
- `src/lib/zod.ts` — `ArabicText` schema; reused for child `displayName`
- `src/db/normalize.ts` — `nfc()` helper applied at every Server Action boundary
- `src/lib/sdk-allowlist.ts` — `ALLOWED_HOST_PATTERNS` (only Supabase). Phase 2's Playwright network audit will continue to enforce this against the auth pages
- `scripts/lint-force-dynamic.sh` — CI gate already runs; Phase 2 must keep this green
- `.planning/phases/01-foundation/01-04-SUMMARY.md` D2 — `requireParent()`/`requireActiveChild()` are the Service Layer entry points

### External docs (Supabase / Next.js / shadcn)
- `@supabase/ssr` docs (already installed; see `node_modules/@supabase/ssr/README.md`) — `createServerClient` + `createBrowserClient` patterns
- Supabase Auth UI patterns — `https://supabase.com/docs/guides/auth/server-side/nextjs` (App Router specific)
- Supabase Auth Email Templates dashboard — `https://supabase.com/dashboard/project/[ref]/auth/templates` (user configures here)
- Supabase Auth Providers dashboard — `https://supabase.com/dashboard/project/[ref]/auth/providers` (user enables Email + Google here)
- shadcn `Form` component — `https://ui.shadcn.com/docs/components/form` (RHF + Zod resolver pattern)

### Compliance posture
- `.planning/PROJECT.md` Pitfall #6 — "single SDK on a child-facing route is an instant compliance failure"
- `src/lib/sdk-allowlist.ts` — the only allowed third-party origin is Supabase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`<ArabicText>`** (`src/components/arabic-text.tsx`) — every Arabic literal in sign-in/sign-up/picker/profile-manage screens goes through this. `size="ui"` for buttons/labels, `size="caption"` for helper text, `size="reader"` for the privacy notice body.
- **`<Button>`** (`src/components/ui/button.tsx`) — shadcn primitive. Use `variant="default"` for primary CTAs, `variant="destructive"` for delete confirmations.
- **`db`** Proxy (`src/db/client.ts`) — Phase 2 services import from `@/db/client` and call `db.select().from(parents)` etc.
- **`nfc()`** + **`ArabicText` Zod schema** — every Server Action that accepts Arabic input (child display name) runs through both.
- **Supabase server/client/middleware helpers** (`src/utils/supabase/*.ts`) — three files already in place. Phase 2 wires `getUser()` into every authenticated layout.
- **`force-dynamic` CI gate** (`scripts/lint-force-dynamic.sh`) — already enforces the invariant.

### Established patterns
- **App Router** with src/app and route groups: `(authenticated)` group for parent-only routes. Phase 2 adds an `(auth)` group for `/sign-in`, `/sign-up`, `/verify-email`, `/reset-password` (public).
- **Service Layer purity** (`tests/invariants/service-layer-purity.test.ts`) — no `next/*` imports allowed in `src/services/*`. Phase 2 services follow the same rule.
- **Pure-form Server Actions** — call into `src/services/*`. Server Actions live in route files (`app/sign-in/actions.ts`, etc.) as a thin layer that calls `await profiles.requireParent()` + service-layer business logic.
- **Logical RTL utilities** — Tailwind v4 `ps-*`, `pe-*`, `text-start`, `border-s`. Bash gate enforces no physical-direction utilities.

### Integration points
- **Drizzle `parents` table** — the post-signup hook (or first authenticated request) inserts a row mirroring `auth.users.id`. Use `db.insert(parents).values({...}).onConflictDoNothing({ target: parents.id })` for idempotency.
- **Drizzle `child_profiles` table** — `createChildProfile` Service inserts here. `deleteChildProfile` calls `db.delete(childProfiles).where(eq(childProfiles.id, ...))` and the FK cascade does the rest.
- **`updateSession` middleware** — already refreshes the auth token on every request. Phase 2 layouts read the refreshed cookie via `createServerClient(...).auth.getUser()`.
- **Next.js middleware exports `proxy`, not `middleware`** — Next 16 renamed the export. Already wired in `src/proxy.ts`.

</code_context>

<specifics>
## Specific Ideas

- Sign-in / sign-up screens follow a calm, minimal kid-app aesthetic from the v2/v3 mockups: large input fields (min-height ~52px for tap target), generous padding, Cairo for labels + Naskh nowhere (since these are non-passage surfaces).
- "إضافة طفل" (add child) flow form fields: Display name (ArabicText), age (number input 5–12 with validation Arabic message), grade band (radio group: التمهيدي / ١–٢ / ٣–٤ / ٥–٦).
- Avatar chip pattern reference: think Netflix profile switcher but smaller and one-line.
- Privacy notice tone: "we collect X, we never share Y, here's how to delete everything" — short paragraphs, no marketing fluff.

</specifics>

<deferred>
## Deferred Ideas

- **Parent account deletion** (deletes the whole account + cascade) — explicitly out of Phase 2 scope. Belongs in a later compliance pass; the per-child path is the COMP-LEGAL-04 commitment.
- **Magic-link sign-in** (passwordless alternative to email/password) — not in v1 requirements. Could be a Phase 5 polish or a later experiment.
- **Two-factor auth (TOTP / SMS)** — not in v1. Future hardening once user base grows.
- **Real SMTP provider (Resend / Postmark)** — Phase 5 pre-launch checklist item. Phase 2 uses Supabase's built-in sender.
- **Account-level data export** (all children at once) — Phase 2 ships the per-child path which is what COMP-LEGAL-04 requires. Account-level export can layer on later.
- **Anonymized analytics blank-out on delete** — depends on Phase 5 first-party event logging existing first.
- **Profile avatars / illustrations** — child profiles in Phase 2 have display names only. Visual customization is a Phase 4 polish or post-MVP delight.

</deferred>

---

*Phase: 2-Auth & Child Profiles*
*Context gathered: 2026-05-15*
