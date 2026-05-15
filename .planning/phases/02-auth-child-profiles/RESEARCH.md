# Phase 2 Research: Auth & Child Profiles

> Focused on Phase-2-specific patterns. Cross-phase invariants (RTL, fonts, schema, RLS, NFC, ArabicText, Service Layer purity, SDK allow-list) live in `01-foundation/RESEARCH.md` and are not re-explained here.

## Summary

Phase 2 delivers parent authentication (email/password + Google OAuth feature-flag) with mandatory email verification, child profile CRUD with cascade delete, an always-shown active-child picker, signed active-child cookies, and the parent-data-rights surfaces (Arabic privacy notice + per-child JSON export + type-the-name delete confirmation). The phase closes 14 requirements and the four ROADMAP Phase 2 success criteria. Every CI gate from Phase 1 (RTL, force-dynamic, RLS coverage, Service Layer purity, NFC, SDK allow-list) must stay green; a new gate (`getSession` ban) lands in Slice 1.

## A. Supabase SSR Auth on Next.js 16 App Router

### `getUser()` vs `getSession()` — the load-bearing invariant (Pitfall #14)

`supabase.auth.getUser()` issues an HTTP request to Supabase's `/auth/v1/user` endpoint with the JWT from cookies; the server validates the JWT signature + expiration against its own keys. **Trusted.**

`supabase.auth.getSession()` returns whatever is in the cookies *without re-validating*. A spoofed or tampered cookie reads back as a valid session. **Forbidden in server code.**

The CI gate: Vitest unit test under `tests/invariants/auth-getsession-ban.test.ts` greps `src/app/**/*.{ts,tsx}` and `src/utils/supabase/server.ts` for the regex `\bgetSession\b` and fails the build if any occurrence is found. Allowed locations: `src/utils/supabase/client.ts` (browser code, where `getSession()` is fine because the JWT lives in `localStorage` which is the trust boundary for SPA-style code), and inside `node_modules`.

### The middleware-then-layout pattern

`src/proxy.ts` (Next 16 renames the export from `middleware` → `proxy`) → `updateSession` → calls `supabase.auth.getUser()` to refresh the JWT cookie on every request. **The exact pattern is already in `src/utils/supabase/middleware.ts`** — Phase 2 does not modify it.

Every `(authenticated)/layout.tsx` calls `supabase.auth.getUser()` again. If `data.user === null`, redirect to `/sign-in`. If `data.user.email_confirmed_at === null`, redirect to `/verify-email`. Both redirects happen via `next/navigation`'s `redirect()` (which throws a `NEXT_REDIRECT` signal — the layout returns nothing after it).

### `parents` row creation — lazy upsert is the right pattern

When the parent first authenticates, the `auth.users` row exists but the Drizzle-managed `parents` row does not. Two options:

1. **Database trigger** — `CREATE TRIGGER` on `auth.users` AFTER INSERT that inserts into `public.parents`. Supabase docs recommend this.
2. **Lazy upsert from Server code** — the `requireParent()` Service does `db.insert(parents).values({ id, email }).onConflictDoNothing({ target: parents.id })` on every authenticated request. Idempotent. Adds one row-level lookup per request (~1ms).

**Recommendation: lazy upsert (#2).** Reasons: (a) Phase 1 already ships the `parents` table with `references(() => authUsers.id, { onDelete: 'cascade' })` — the cleanup half of the FK is in place. (b) Trigger lives in DB and is invisible from the repo, harder to evolve. (c) `onConflictDoNothing` makes the insert effectively a no-op after the first call. **Confidence: HIGH.**

### Password reset flow

Supabase Auth `resetPasswordForEmail(email, { redirectTo })` sends an email containing a `?code=...` link. The user clicks → lands at `/reset-password?code=...` → call `supabase.auth.exchangeCodeForSession(code)` server-side → if successful the user has a temporary session for password change → call `supabase.auth.updateUser({ password })` → redirect to `/sign-in?reset=ok`.

Token expiration: Supabase default is 24 hours. Sufficient for the use case.

### Google OAuth (feature-flagged)

`supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '<origin>/auth/callback' } })`. The callback route exchanges the code-grant for a session: `/auth/callback/route.ts` → `supabase.auth.exchangeCodeForSession(code)` → redirect to `/choose-child`.

Feature flag: `process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true'`. The button on `/sign-in` and `/sign-up` only renders when this env var is set. The `/auth/callback` route still ships (no harm idle) so flipping the flag at runtime doesn't require a new deploy.

## B. Active-child cookie

### Cookie shape

- **Name:** `qira_active_child`
- **Value:** the child's UUID (no encryption needed — RLS is the trust boundary, the cookie is just a server-side preference)
- **Flags:** `httpOnly: true`, `secure: true` (in prod), `sameSite: 'lax'`, `path: '/'`, `maxAge: undefined` (session cookie — clears on browser close)
- **Scope:** parent session lifetime. Set by a Server Action when the parent picks a child on `/choose-child`. Re-validated on every authenticated request by `requireActiveChild()` Service, which:
  1. Reads `cookies().get('qira_active_child')?.value`
  2. If absent or not a valid UUID → throw / redirect to `/choose-child`
  3. Queries `SELECT * FROM child_profiles WHERE id = $1 AND parent_id = $parentId` — if no row returned, the cookie is stale (child belongs to another parent or was deleted) → clear cookie + redirect to `/choose-child`

### Why signing isn't required

The parent-id-bound RLS on `child_profiles` (Phase 1's `pgPolicy('child_profiles_select', ..., using: sql`(SELECT auth.uid()) = ${table.parentId}`)`) means a parent literally cannot SELECT a child profile they don't own — even if they spoofed the cookie value to another parent's child UUID, the query returns zero rows. The cookie is a *preference indicator*, not a credential. Signing it adds key-management complexity for negligible benefit.

## C. Server Actions + RHF + Zod

### The pattern

```ts
// app/(auth)/sign-up/actions.ts
'use server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { SignUpInput } from './schema';
import { redirect } from 'next/navigation';

export async function signUpAction(formData: FormData) {
  const parsed = SignUpInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });
  if (error) return { error: { _form: [error.message] } };
  redirect('/verify-email');
}
```

The page is a Server Component that imports the Server Action and passes it to a Client Component form. The form is a Client Component (`'use client'`) using RHF + `zodResolver(SignUpInput)`.

### Arabic Zod error messages

```ts
const SignUpInput = z.object({
  email: z.string().email('أدخل بريداً إلكترونياً صحيحاً'),
  password: z.string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .regex(/[A-Za-z]/, 'يجب أن تحتوي على حرف لاتيني واحد على الأقل')
    .regex(/[0-9]/, 'يجب أن تحتوي على رقم واحد على الأقل'),
});
```

Latin chars + numbers requirement is intentional — Arabic-script-only passwords are technically valid but break common keyboard layouts and OS password managers, harming UX. Both Arabic and English speakers can type Latin + digits.

## D. Cross-user E2E with the admin API

### The pattern

`@supabase/supabase-js` `createClient(supabaseUrl, SUPABASE_SERVICE_ROLE_KEY)` exposes `auth.admin.createUser(...)` and `auth.admin.deleteUser(userId)`. The Playwright test fixture:

1. Before all: create two parents via admin API (`parentA@qira-test.local`, `parentB@qira-test.local`) with `email_confirm: true` so they skip the verification gate.
2. Each test: log in as Parent A in `browserA`, log in as Parent B in `browserB` (fresh context), perform actions, assert no data bleed.
3. After all: delete both parents via admin API.

The admin client must NEVER ship to the browser. It lives only in `tests/e2e/_helpers/test-parents.ts` and is read from `process.env.SUPABASE_SERVICE_ROLE_KEY` (already in `.env.local` from Phase 1). CI receives the key via GitHub Secret.

### Cross-user no-bleed assertion shape

Parent A creates child "Ahmad". Parent B logs in fresh — their `/choose-child` shows ZERO profiles (Parent B has no children). Switching `qira_active_child` cookie manually to Ahmad's UUID does NOT make Ahmad visible (RLS blocks the SELECT). Asserting on the rendered DOM is sufficient.

## E. shadcn primitives needed

Already shipped in Phase 1: `Button`.

Phase 2 adds (via `npx shadcn@latest add ...`):
- `Input` — email, password, display name fields
- `Label` — paired with every input
- `Card` — child profile picker cards, manage-page sections
- `Dialog` — type-the-name delete confirmation modal
- `Form` (RHF wrapper) — every form
- `Separator` — visual divider on /sign-in between password fields and Google button

All shadcn components carry RTL-correct icon flipping (`rtl:rotate-180` on chevrons) by default since the project was init'd with `--rtl` in Phase 1.

## F. Privacy notice — Arabic placeholder copy

The page is a Server Component at `app/privacy/page.tsx`. Public route (no auth gate). Content in Fusha:

```
# سياسة الخصوصية

(محتوى مبدئي — يجب مراجعته من قبل متخصص قانوني قبل الإطلاق العام.)

## ما الذي نجمعه؟

**عن الوالد/الوالدية:**
- البريد الإلكتروني (للتسجيل وإعادة تعيين كلمة المرور).
- لا نجمع رقم الهاتف، ولا الاسم، ولا العنوان.

**عن الطفل:**
- الاسم الظاهر (مثل "أحمد") — أنت من تختار، ولا يلزم أن يكون الاسم الكامل.
- العمر (بين 5 و12).
- الصف الدراسي التقريبي.
- النصوص التي قرأها وإجاباته على أسئلة الفهم.

## مع من نشاركها؟

لا نشاركها. لا نستخدم أي خدمات تتبع أو إعلانات على صفحات الأطفال.

## كيف يمكنك الحذف؟

من صفحة "إدارة الملف" لأي طفل، يمكنك تصدير بياناته كملف JSON أو حذفها بالكامل. الحذف فوري ولا يمكن التراجع عنه.

## التواصل

[بريد إلكتروني للتواصل سيُضاف لاحقاً]
```

The user will replace this with finalized copy before public launch.

## G. Out-of-band actions (user must do post-execution)

1. **Supabase Dashboard → Authentication → Providers → Email** — confirm enabled (default on).
2. **Supabase Dashboard → Authentication → URL Configuration** — set Site URL to the Vercel deploy URL (`https://qira-*.vercel.app`). Add `http://localhost:3000` to "Additional Redirect URLs" for local dev.
3. **Supabase Dashboard → Authentication → Email Templates** — paste the four Arabic templates (Phase 2 plan provides drafts).
4. **(Optional) Google OAuth** — create a Google Cloud project, add OAuth client ID, paste into Supabase Auth → Providers → Google. Then set `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true` in Vercel env vars.

## H. Decisions locked

All 12 Phase 2 implementation decisions (D-01 through D-12) are in `02-CONTEXT.md`. No decision deferred.

## I. Phase 1 invariants Phase 2 must preserve

Cumulative CI gates Phase 2 must keep green:

| Gate | Source | Phase 2 risk |
|------|--------|--------------|
| RTL (no physical-direction Tailwind) | `scripts/lint-rtl.sh` | New shadcn primitives MUST use logical utilities. Verify after every `shadcn add`. |
| Force-dynamic on authenticated layouts | `scripts/lint-force-dynamic.sh` | Every new `(authenticated)/*/layout.tsx` declares `export const dynamic = 'force-dynamic'`. |
| RLS coverage on all pgTables | `tests/invariants/rls-coverage.test.ts` | Phase 2 does not add new tables. |
| Service Layer purity (no `next/*` imports in `src/services/*`) | `tests/invariants/service-layer-purity.test.ts` | Phase 2 service implementations MUST use `cookies()`/`redirect()` ONLY in Server Actions, never in `src/services/*`. |
| NFC normalization | `src/lib/zod.ts` + `src/db/normalize.ts` | Every `createChildProfile` / `updateChildProfile` Server Action calls `nfc({ ...input }, ['displayName'])`. |
| SDK allow-list (network audit) | `tests/e2e/network-audit.spec.ts` | No new external SDKs. |
| `getSession` ban (NEW IN PHASE 2) | `tests/invariants/auth-getsession-ban.test.ts` (Slice 1) | The whole point. |
