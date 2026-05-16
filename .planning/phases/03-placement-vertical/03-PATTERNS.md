# Phase 3: Placement Vertical — Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 26 new/modified files
**Analogs found:** 24 / 26 (2 have no close codebase analog — flagged below)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `src/services/placement.ts` | service | CRUD + pure-fn | `src/services/profiles.ts` | role-match |
| `src/services/placement.test.ts` | test (unit) | — | `tests/unit/profiles-service.test.ts` | role-match |
| `src/services/placement.integration.test.ts` | test (integration) | — | `tests/unit/profiles-service.test.ts` | role-match |
| `src/db/schema.ts` | migration (additive) | — | `src/db/schema.ts` (self — additive columns) | exact |
| `src/db/seed/placement-placeholder.ts` | script (seed) | batch | `src/db/seed/index.ts` | exact |
| `src/db/seed/placement-placeholder.test.ts` | test (unit) | — | `tests/unit/profiles-service.test.ts` | role-match |
| `src/app/(authenticated)/placement/layout.tsx` | layout (RSC) | request-response | `src/app/(authenticated)/(active)/layout.tsx` | exact |
| `src/app/(authenticated)/placement/start/page.tsx` | page (RSC) | request-response | `src/app/(authenticated)/(active)/dashboard/page.tsx` | exact |
| `src/app/(authenticated)/placement/[attemptId]/page.tsx` | page (RSC) | request-response | `src/app/(authenticated)/(picker)/choose-child/page.tsx` | role-match |
| `src/app/(authenticated)/placement/[attemptId]/result/page.tsx` | page (RSC) | request-response | `src/app/(authenticated)/(active)/dashboard/page.tsx` | role-match |
| `src/app/(authenticated)/placement/actions.ts` | server action | request-response | `src/app/(authenticated)/(picker)/profiles/[childId]/manage/actions.ts` | exact |
| `src/app/(authenticated)/(placement-gate)/layout.tsx` | layout (RSC, gate) | request-response | `src/app/(authenticated)/(active)/layout.tsx` | exact |
| `src/components/placement/escape-hatch.tsx` | component (client) | event-driven | `src/app/(authenticated)/(picker)/profiles/[childId]/manage/delete-dialog.tsx` | role-match |
| `src/components/placement/choice-card.tsx` | component (RSC) | request-response | `src/app/(authenticated)/(picker)/choose-child/page.tsx` (card+form pattern) | role-match |
| `src/components/placement/progress-dots.tsx` | component (RSC) | — | `src/components/arabic-text.tsx` (simple presentational) | partial |
| `src/components/placement/passage-screen.tsx` | component (RSC) | request-response | `src/app/(authenticated)/(active)/dashboard/page.tsx` | role-match |
| `src/components/placement/question-screen.tsx` | component (RSC) | request-response | `src/app/(authenticated)/(picker)/choose-child/page.tsx` | role-match |
| `src/app/(authenticated)/(picker)/profiles/[childId]/manage/page.tsx` (modified) | page (RSC) | request-response | self — additive card block | exact |
| `src/services/profiles.ts` (possibly modified) | service | CRUD | self | exact |
| `tests/e2e/placement-cross-parent.spec.ts` | test (E2E) | — | `tests/e2e/auth-cross-user.spec.ts` | exact |
| `tests/e2e/placement-escape-hatch.spec.ts` | test (E2E) | — | `tests/e2e/auth-flow.spec.ts` | role-match |
| `tests/invariants/placement-bundle-leak.test.ts` | test (invariant) | — | `tests/invariants/auth-getsession-ban.test.ts` | exact |
| `scripts/db-verify-columns.ts` | script (verification) | — | `scripts/db-verify.ts` | exact |

---

## Pattern Assignments

### `src/services/placement.ts` (service, CRUD + pure-fn)

**Analog:** `src/services/profiles.ts`

**Imports pattern** (lines 1–20):
```typescript
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { nfc } from '@/db/normalize';
import {
  attemptAnswers,
  attempts,
  choices,
  levels,
  questions,
  texts,
} from '@/db/schema';
import type { ChildId } from './profiles';
```
Rules: no `next/*` imports. DB access only via `db` proxy from `@/db/client`. Types imported from Drizzle schema or local branded types.

**Branded-type pattern** (`src/services/profiles.ts` lines 24–26):
```typescript
export type ParentId = string & { readonly __brand: 'ParentId' };
export type ChildId = string & { readonly __brand: 'ChildId' };
// Placement adds:
export type AttemptId = string & { readonly __brand: 'AttemptId' };
export type QuestionId = string & { readonly __brand: 'QuestionId' };
export type ChoiceId   = string & { readonly __brand: 'ChoiceId' };
```

**Drizzle query pattern** (`src/services/profiles.ts` lines 93–103):
```typescript
const [row] = await db
  .select()
  .from(childProfiles)
  .where(and(eq(childProfiles.id, childId), eq(childProfiles.parentId, parent.parentId)))
  .limit(1);
if (!row) throw new AuthError('NO_ACTIVE_CHILD');
```
`getPlacementState()` follows the same single-row pattern with `.orderBy(desc(attempts.startedAt)).limit(1)`.

**Error class pattern** (`src/services/profiles.ts` lines 49–54):
```typescript
export class AuthError extends Error {
  constructor(public reason: 'UNAUTHENTICATED' | 'UNVERIFIED' | 'NO_ACTIVE_CHILD') {
    super(reason);
    this.name = 'AuthError';
  }
}
```
`placement.ts` reuses `AuthError` from `profiles.ts` — do not redeclare.

**Pure-function shape** (RESEARCH.md §A — reference implementation):
```typescript
// No DB access, no async, no side effects
export function assignLevel(input: AssignLevelInput): AssignLevelOutput {
  const prior = GRADE_PRIOR[input.gradeBand];
  const passing = input.passageResults
    .filter(r => r.totalQuestions > 0 && r.correctAnswers / r.totalQuestions >= 0.6)
    .map(r => r.level);
  const highestPassingLevel = passing.length > 0 ? Math.max(...passing) : null;
  const raw    = highestPassingLevel ?? prior.center;
  const biased = raw - 1;                          // bias-down BEFORE clamping (D-01)
  const assignedLevel = Math.max(prior.min, Math.min(prior.max, biased));
  return { assignedLevel, algorithmOutput: biased, highestPassingLevel };
}
```

**Lazy import pattern** (needed for Node.js `crypto` inside a framework-agnostic service, from `src/services/profiles.ts` line 89):
```typescript
// Lazy import to avoid pulling next/* indirectly via barrel files.
const { parseActiveChildCookie } = await import('@/lib/active-child-cookie');
```
Same pattern used in `deterministicShuffle` via `import { createHash } from 'node:crypto'` at the top — Node built-ins are fine.

---

### `src/services/placement.test.ts` (unit test, pure-fn)

**Analog:** `tests/unit/profiles-service.test.ts`

**Test file structure** (`tests/unit/profiles-service.test.ts` lines 1–10):
```typescript
import { describe, expect, test } from 'vitest';
import { AuthError } from '@/services/profiles';

describe('AuthError', () => {
  test('carries a typed reason', () => {
    const err = new AuthError('UNAUTHENTICATED');
    expect(err).toBeInstanceOf(Error);
    expect(err.reason).toBe('UNAUTHENTICATED');
  });
});
```
Placement unit tests follow the same structure: pure TypeScript imports, no DB, describe/test/expect. The unit tests for `assignLevel()` have ZERO external dependencies — no Supabase client, no `db`, no cookies.

**No-DB invariant:** `src/services/placement.ts` functions that are pure (`assignLevel`, `deterministicShuffle`) must be tested without mocking anything. If a test file needs mocking, it's testing an impure function and belongs in `placement.integration.test.ts`.

---

### `src/services/placement.integration.test.ts` (integration test)

**Analog:** `tests/unit/profiles-service.test.ts` + `tests/e2e/_helpers/test-parents.ts`

The integration test pattern for `getPlacementState`, `startPlacement`, `resetPlacement` follows the seed-then-query shape used in Playwright helpers: create a parent + child via admin API, run service functions against the live DB, assert state. See `tests/e2e/_helpers/test-parents.ts` for the admin-client bootstrap pattern (lines 19–29):

```typescript
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY required');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
```

---

### `src/db/schema.ts` — additive columns (migration)

**Analog:** self (`src/db/schema.ts`) — copy the existing column and pgEnum patterns.

**Existing pgEnum pattern** (lines 32–33 of `src/db/schema.ts`):
```typescript
export const attemptKind    = pgEnum('attempt_kind',    ['placement', 'reading']);
export const questionKind   = pgEnum('question_kind',   ['placement', 'comprehension']);
// Phase 3 adds:
export const escapeHatchReason = pgEnum('escape_hatch_reason', ['too_hard', 'too_easy']);
```

**Existing nullable column pattern** (`attempts` table, lines 299–302):
```typescript
textId:          uuid('text_id').references(() => texts.id),
assignedLevelId: uuid('assigned_level_id').references(() => levels.id),  // existing FK — do NOT add a redundant integer
score:           integer('score'),
finishedAt:      timestamp('finished_at', { withTimezone: true }),
```
All new columns on `attempts` are nullable (no `.notNull()` except where noted). New imports to add to the `import` block at line 17–27:
```typescript
import { boolean, jsonb } from 'drizzle-orm/pg-core';
```

**Boolean column pattern** (not in `attempts` yet, but used in `childProfiles`-style tables):
```typescript
// On texts table:
isPlaceholder: boolean('is_placeholder').default(false).notNull(),
// On questions table:
isPlaceholder: boolean('is_placeholder').default(false).notNull(),
// On attempts table:
escapeHatched:       boolean('escape_hatched').default(false).notNull(),
escapeHatchedAt:     timestamp('escape_hatched_at', { withTimezone: true }),
escapeHatchedReason: escapeHatchReason('escape_hatched_reason'),
placementBankVersion: integer('placement_bank_version'),
// On attempt_answers table:
choiceOrder: jsonb('choice_order'),
```

**Critical:** `assignedLevelId` UUID FK already exists on `attempts` (line 298 in schema.ts). The RESEARCH.md explicitly says: "use existing `assignedLevelId`, do NOT add a redundant `assigned_level` integer column."

**RLS note:** no new tables → no new RLS policies needed. New columns inherit table-level RLS automatically. The `texts`, `questions` tables have `withCheck: sql\`false\`` on INSERT — the placeholder seed script must use `DIRECT_DATABASE_URL` to bypass RLS.

---

### `src/db/seed/placement-placeholder.ts` (seed script)

**Analog:** `src/db/seed/index.ts` — exact match.

**Full seed script pattern** (`src/db/seed/index.ts` lines 1–50):
```typescript
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { levels } from '../schema';

config({ path: '.env.local' });

async function main() {
  const url = process.env.DIRECT_DATABASE_URL;
  if (!url) throw new Error('DIRECT_DATABASE_URL is not set');  // Guard — see Anti-pitfall 5

  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client);

  // ... insert rows ...

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Key differences for placement seed:
1. Imports `texts`, `questions`, `choices`, `levels` from schema.
2. Uses `DIRECT_DATABASE_URL` — never `DATABASE_URL` (pooler). Without this, the `withCheck: false` RLS on `texts` and `questions` silently rejects inserts.
3. All Arabic literals `.normalize('NFC')` inline (same as seed/index.ts line 29).
4. Uses `onConflictDoNothing()` for idempotency.
5. After insert, runs a follow-up count query to confirm rows were actually written (same pattern as seed/index.ts lines 40–41).

---

### `src/db/seed/placement-placeholder.test.ts` (seed correctness test)

**Analog:** `tests/unit/profiles-service.test.ts` structure + Vitest describe/test/expect pattern.

The test imports `db` and queries `texts.isPlaceholder = true` and `questions.isPlaceholder = true` after seeding, asserting counts of 5 and 15 respectively. See RESEARCH.md §F Pillar 6 for the exact query shape.

---

### `src/app/(authenticated)/placement/layout.tsx` (RSC layout)

**Analog:** `src/app/(authenticated)/layout.tsx` — exact match.

**Full layout pattern** (`src/app/(authenticated)/layout.tsx` lines 1–24):
```typescript
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthError, requireParent } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

// CI gate: scripts/lint-force-dynamic.sh enforces this on every layout.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient(await cookies());
  try {
    await requireParent(supabase);
  } catch (err) {
    if (err instanceof AuthError && err.reason === 'UNAUTHENTICATED') redirect('/sign-in');
    if (err instanceof AuthError && err.reason === 'UNVERIFIED') redirect('/verify-email');
    throw err;
  }
  return <>{children}</>;
}
```
`placement/layout.tsx` is a **minimal** layout — it does NOT gate on placement state (that's the `(placement-gate)` sibling group's job). It just provides a wrapper div for placement-specific chrome (e.g., a progress indicator strip at the top). No additional guards needed — the parent `(authenticated)/layout.tsx` already runs `requireParent()`.

**Mandatory:** `export const dynamic = 'force-dynamic'` on every `(authenticated)/**/layout.tsx` or `scripts/lint-force-dynamic.sh` CI gate will fail.

---

### `src/app/(authenticated)/(placement-gate)/layout.tsx` (RSC gate layout)

**Analog:** `src/app/(authenticated)/(active)/layout.tsx` — exact match for the gate pattern.

**Full (active) layout** (`src/app/(authenticated)/(active)/layout.tsx` lines 1–36):
```typescript
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACTIVE_CHILD_COOKIE } from '@/lib/active-child-cookie';
import { AuthError, listChildProfiles, requireActiveChild } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ActiveChildLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let active: Awaited<ReturnType<typeof requireActiveChild>>;
  try {
    active = await requireActiveChild(supabase, cookieStore.get(ACTIVE_CHILD_COOKIE)?.value);
  } catch (err) {
    if (err instanceof AuthError && err.reason === 'NO_ACTIVE_CHILD') redirect('/choose-child');
    throw err;
  }
  // ... render children
}
```
The `(placement-gate)/layout.tsx` follows the exact same shape but calls `getPlacementState(active.id)` and redirects to `/placement/start` if the state is `'not_started'` or `'in_progress'`. The parent `(active)/layout.tsx` already ran `requireActiveChild()` so the `active` child is available — but the placement-gate layout must re-call `requireActiveChild()` (it is a sibling group, not a child, so it does not inherit the parent layout's computed values).

---

### `src/app/(authenticated)/placement/start/page.tsx` (RSC page)

**Analog:** `src/app/(authenticated)/(active)/dashboard/page.tsx` — same simple RSC page structure.

**Simple RSC page pattern** (`dashboard/page.tsx` lines 1–26):
```typescript
import { cookies } from 'next/headers';
import { ArabicText } from '@/components/arabic-text';
import { ACTIVE_CHILD_COOKIE } from '@/lib/active-child-cookie';
import { requireActiveChild } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const active = await requireActiveChild(supabase, cookieStore.get(ACTIVE_CHILD_COOKIE)?.value);

  return (
    <main className="min-h-screen px-4 py-16">
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <ArabicText as="h1" size="reader" className="text-4xl block">
          مرحباً {active.displayName}!
        </ArabicText>
      </div>
    </main>
  );
}
```
`placement/start/page.tsx` replaces the greeting with an intro card + "ابدأ التقييم" CTA button that submits `startPlacementAction`. The Server Action is bound with `.bind(null, childId)` pattern — no client JS needed.

---

### `src/app/(authenticated)/placement/[attemptId]/page.tsx` (RSC page — current item)

**Analog:** `src/app/(authenticated)/(picker)/choose-child/page.tsx` — best match for the "list of form-per-item cards" pattern.

**Form-per-card Server Action pattern** (`choose-child/page.tsx` lines 49–52):
```typescript
<form action={setActiveChildAction.bind(null, child.id)}>
  <Button type="submit" size="lg" className="w-full">
    <ArabicText size="ui">اختيار</ArabicText>
  </Button>
</form>
```
For placement choice cards, the same pattern applies with the choice bound into the action:
```typescript
// In [attemptId]/page.tsx (Server Component):
const submitAnswer = recordPlacementAnswerAction.bind(null, {
  attemptId,
  questionId,
  chosenChoiceId: choice.id,
});
// Rendered as:
<form action={submitAnswer}>
  <button type="submit" className="w-full min-h-14 text-start ps-4 pe-4 ...">
    <ArabicText size="ui">{choice.labelAr}</ArabicText>
  </button>
</form>
```
**Key:** `chosenChoiceId` is baked into the action at server render time — it never comes from the client. This satisfies PLAC-04 (server-authoritative scoring).

**Dynamic segment params pattern** (from `manage/page.tsx` lines 21–25):
```typescript
export default async function ManageProfilePage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
```
`[attemptId]/page.tsx` follows the same `params: Promise<{ attemptId: string }>` pattern.

---

### `src/app/(authenticated)/placement/[attemptId]/result/page.tsx` (RSC page)

**Analog:** `src/app/(authenticated)/(active)/dashboard/page.tsx`

Same simple RSC page structure. Reads `assignedLevel` from `getPlacementState()` and renders the "aخترنا لك المستوى X" result. Uses `<ArabicText size="reader">` for the level announcement.

---

### `src/app/(authenticated)/placement/actions.ts` (Server Actions)

**Analog:** `src/app/(authenticated)/(picker)/profiles/[childId]/manage/actions.ts` — exact match for Server Action shape.

**Complete Server Action pattern** (`manage/actions.ts` lines 1–40):
```typescript
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthError, type ChildId, deleteChildProfile } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

export interface DeleteActionState {
  error?: string;
}

export async function deleteChildAction(
  _prev: DeleteActionState | undefined,
  formData: FormData,
): Promise<DeleteActionState> {
  const childId = formData.get('childId');
  if (typeof childId !== 'string' || childId.length === 0) {
    return { error: 'معرّف الطفل مفقود' };
  }

  const supabase = createClient(await cookies());
  try {
    await deleteChildProfile(supabase, { childId: childId as ChildId, confirmName });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'الجلسة منتهية أو الملف غير موجود' };
    }
    return { error: 'حدث خطأ، حاول مرة أخرى' };
  }

  redirect('/choose-child');
}
```

For placement, `startPlacementAction` uses the simpler bound-args pattern (no `formData`):
```typescript
'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACTIVE_CHILD_COOKIE } from '@/lib/active-child-cookie';
import { AuthError, requireActiveChild } from '@/services/profiles';
import { startPlacement } from '@/services/placement';
import { createClient } from '@/utils/supabase/server';

export async function startPlacementAction(): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const active = await requireActiveChild(supabase, cookieStore.get(ACTIVE_CHILD_COOKIE)?.value);
  const attemptId = await startPlacement(active.id);
  redirect(`/placement/${attemptId}`);
}
```

For `recordPlacementAnswerAction`, the `.bind(null, args)` pattern (from `choose-child/actions.ts`):
```typescript
export async function recordPlacementAnswerAction(args: {
  attemptId: string;
  questionId: string;
  chosenChoiceId: string;
}): Promise<void> {
  // args are pre-bound server-side — no client input
  const result = await recordPlacementAnswer(args);
  if (result.finalResult) {
    redirect(`/placement/${args.attemptId}/result`);
  } else {
    // revalidatePath to re-render current question page
    redirect(`/placement/${args.attemptId}`);
  }
}
```

**Error string convention:** Arabic-only error strings (`'الجلسة منتهية أو الملف غير موجود'`), following `supabase-error-ar.ts` pattern. No English errors surface to the UI.

---

### `src/components/placement/escape-hatch.tsx` (Client Component)

**Analog:** `src/app/(authenticated)/(picker)/profiles/[childId]/manage/delete-dialog.tsx` — closest match for the "client component + Dialog trigger + Server Action call" pattern.

**Client component with Dialog + useActionState pattern** (`delete-dialog.tsx` lines 1–85):
```typescript
'use client';

import { useActionState, useState } from 'react';
import { ArabicText } from '@/components/arabic-text';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

export function DeleteChildDialog({ childId, childName }: { childId: string; childName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<DeleteActionState | undefined, FormData>(
    deleteChildAction,
    undefined,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="lg" className="w-full">
          <ArabicText size="ui">حذف الملف الشخصي</ArabicText>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle><ArabicText size="reader">...</ArabicText></DialogTitle>
          <DialogDescription><ArabicText size="ui">...</ArabicText></DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            <ArabicText size="ui">إلغاء</ArabicText>
          </Button>
          <Button type="submit" variant="destructive" disabled={pending}>
            <ArabicText size="ui">{pending ? 'جارٍ…' : 'تأكيد'}</ArabicText>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Escape-hatch differences from this analog:
1. Uses `AlertDialog` (not `Dialog`) — requires Wave 0 install: `npx shadcn@latest add alert-dialog`. The `AlertDialog` component does not exist yet in `src/components/ui/`. The existing `dialog.tsx` is a `Dialog` — not the same component.
2. Has `mode: 'placement' | 'reader'` prop that controls which Server Action fires.
3. Uses `useTransition` + async Server Action call (no `formData`, no `useActionState`):
```typescript
'use client';
import { useTransition } from 'react';
import { abortPlacementAction } from '../placement/actions';

export function EscapeHatch({ attemptId, mode }: EscapeHatchProps) {
  const [isPending, startTransition] = useTransition();

  function handleAbort(reason: 'too_hard' | 'too_easy') {
    startTransition(async () => {
      await abortPlacementAction({ attemptId, reason });
    });
  }
}
```
4. RTL float positioning via Tailwind v4 logical properties: `fixed end-4 bottom-4 z-50` (see `dialog.tsx` line 47 for the `end-4 top-4` usage — same convention):
```typescript
// From src/components/ui/dialog.tsx line 47:
className="absolute end-4 top-4 rounded-sm ..."
// Escape hatch floating position:
<div className="fixed end-4 bottom-4 z-50 flex flex-col gap-2">
```

---

### `src/components/placement/choice-card.tsx` (RSC component)

**Analog:** `src/app/(authenticated)/(picker)/choose-child/page.tsx` (form-per-card pattern) + `src/components/ui/card.tsx` (Card primitive).

**Card primitive** (`src/components/ui/card.tsx` lines 5–13):
```typescript
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}
      {...props}
    />
  ),
);
```

**Button primitive** (`src/components/ui/button.tsx` lines 35–53) — `variant="ghost"` for the card's internal button:
```typescript
function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
```

`ChoiceCard` wraps a hidden `<form>` with a `<button type="submit">` that IS the card face. Min-height ≥ 56px (`min-h-14` in Tailwind). Letter glyph (`أ/ب/ج/د`) on the `ps-4` side, choice text on the `pe-4` side. Vertical stack (`flex flex-col gap-3`), NOT a 2×2 grid (CONTEXT §Specific Ideas).

---

### `src/components/placement/progress-dots.tsx` (RSC component)

**Analog:** `src/components/arabic-text.tsx` — simple presentational component, no interaction.

**Presentational component pattern** (`arabic-text.tsx` lines 37–52):
```typescript
export function ArabicText({ children, as: Tag = 'span', size = 'ui', diacritics = 'show', className }: ArabicTextProps) {
  return (
    <Tag lang="ar" className={cn(sizeClasses[size], diacritics === 'hide' && diacriticsHideClass, className)}>
      <bdi>{children}</bdi>
    </Tag>
  );
}
```
`ProgressDots` is similarly pure: receives `total`, `current` props, renders N dots with Tailwind classes for filled/pulsing/empty states. No `'use client'` needed. No interactivity.

---

### `src/components/placement/passage-screen.tsx` (RSC component)

**Analog:** `src/app/(authenticated)/(active)/dashboard/page.tsx` — RSC with `<ArabicText>` and a CTA form.

**ArabicText size="reader" usage** (dashboard page lines 17–20):
```typescript
<ArabicText as="h1" size="reader" className="text-4xl block">
  مرحباً {active.displayName}!
</ArabicText>
```
Passage body uses `<ArabicText size="reader">` with `as="p"`. Tashkeel ON for passages at Level 2/6/10 (default `diacritics="show"`); OFF for Level 14/18 (`diacritics="hide"`).

The "أنا جاهز" CTA is a bare form wrapping a submit button:
```typescript
<form action={advanceToFirstQuestionAction.bind(null, { attemptId, textId })}>
  <Button type="submit" size="lg" className="w-full mt-8">
    <ArabicText size="ui">أنا جاهز</ArabicText>
  </Button>
</form>
```

---

### `src/components/placement/question-screen.tsx` (RSC component)

**Analog:** `src/app/(authenticated)/(picker)/choose-child/page.tsx` — RSC that composes `<Card>` + `<ArabicText>` + form-per-item pattern.

Composes `<PassageHeader>` (question prompt in `size="ui"`), four `<ChoiceCard>` components, `<ProgressDots>`, and `<EscapeHatch mode="placement">`. All RSC except `<EscapeHatch>` (which is a client component embedded via RSC island pattern — no special treatment needed, Next.js handles it).

---

### `src/app/(authenticated)/(picker)/profiles/[childId]/manage/page.tsx` (modified)

**Analog:** self — additive card block. Copy the existing Card pattern (lines 61–83):

```typescript
<Card className="p-6 space-y-3">
  <ArabicText as="h2" size="ui" className="text-lg font-semibold block">
    بياناتك
  </ArabicText>
  <ArabicText size="caption" className="block text-muted-foreground">
    ...description...
  </ArabicText>
  <a href={...} download>
    <Button variant="outline" size="lg" className="w-full">
      <ArabicText size="ui">تصدير بيانات الطفل</ArabicText>
    </Button>
  </a>
</Card>
```
Phase 3 adds a "حالة التقييم" card between the data-export card and the danger-zone card. The card has three display states and a "إعادة التقييم" reset button that calls `resetPlacementAction` as a Server Action. The reset button's form is identical in shape to the data export section.

---

### `tests/e2e/placement-cross-parent.spec.ts` (E2E, cross-user isolation)

**Analog:** `tests/e2e/auth-cross-user.spec.ts` — exact match.

**Full cross-user spec structure** (`auth-cross-user.spec.ts` lines 1–108):
- `test.describe.serial` wrapper
- `beforeAll`/`afterAll` with `createTestParent()` / `deleteTestParent()` from `_helpers/test-parents.ts`
- Two browser contexts (`browser.newContext()`) — one per parent
- `signIn(context, parent)` helper that fills sign-in form and asserts redirect
- Cookie-forging test: grab `qira_active_child` cookie from ctxA, inject into ctxB, assert redirect to `/choose-child`

Placement cross-user test adds:
- Parent A completes placement → assert `attempts` row exists for A's child
- Parent B queries `attempts` for A's child UUID → assert zero rows (RLS isolation)
- Parent B forges `qira_active_child` to A's child UUID → assert redirect (same as existing cookie-forge test)

---

### `tests/e2e/placement-escape-hatch.spec.ts` (E2E)

**Analog:** `tests/e2e/auth-flow.spec.ts` — happy-path E2E structure with `page.goto`, `expect(page).toHaveURL`, `expect(locator).toBeVisible`.

No excerpt needed — the pattern is: `page.goto('/placement/start')`, `page.click(...)`, `expect(page.getByRole('button', { name: /هذا صعب/ })).toBeVisible()`. Same fill-click-assert pattern as `auth-flow.spec.ts`.

---

### `tests/invariants/placement-bundle-leak.test.ts` (invariant, grep-based)

**Analog:** `tests/invariants/auth-getsession-ban.test.ts` — exact match.

**Full invariant grep pattern** (`auth-getsession-ban.test.ts` lines 1–47):
```typescript
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { globSync } from 'tinyglobby';
import { describe, expect, test } from 'vitest';

const REPO_ROOT = process.cwd();
const ALLOW_LIST = new Set(['src/utils/supabase/client.ts']);
const PATTERN = /\bgetSession\b/;

const files = globSync(['src/**/*.{ts,tsx}'], {
  cwd: REPO_ROOT,
  ignore: ['**/node_modules/**', '**/.next/**', 'tests/**'],
});

describe('auth getSession() ban', () => {
  test('source tree is non-empty (sanity)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    if (ALLOW_LIST.has(file)) continue;
    test(`${file} contains no getSession() call`, () => {
      const contents = readFileSync(join(REPO_ROOT, file), 'utf8');
      const match = contents.match(PATTERN);
      expect(match, `...`).toBeNull();
    });
  }
});
```

Placement bundle-leak invariant changes only:
- `ALLOW_LIST = new Set([])` — no file is allowed to contain `isCorrect`
- `PATTERN = /\bisCorrect\b/`
- `globSync` target: `['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}']`
- Describe label: `'placement bundle leak'`

---

### `scripts/db-verify-columns.ts` (verification script)

**Analog:** `scripts/db-verify.ts` — exact match.

**Full script pattern** (`scripts/db-verify.ts` lines 1–44):
```typescript
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

async function main() {
  const url = process.env.DIRECT_DATABASE_URL;
  if (!url) throw new Error('DIRECT_DATABASE_URL is not set');

  const sql = postgres(url, { max: 1, prepare: false });

  // Query information_schema.columns for Phase 3 columns
  const cols = await sql`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'attempts'
      AND column_name IN ('escape_hatched', 'escape_hatched_at',
                          'escape_hatched_reason', 'placement_bank_version')
    ORDER BY column_name
  `;
  console.log(`Phase 3 attempt columns (expected 4):`, cols);
  if (cols.length !== 4) process.exit(1);

  await sql.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
```

---

## Shared Patterns

### Authentication / Supabase Client
**Source:** `src/utils/supabase/server.ts` (used via `createClient`)
**Apply to:** All placement layout.tsx, page.tsx, and actions.ts files
```typescript
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
// In every server-side function:
const cookieStore = await cookies();
const supabase = createClient(cookieStore);
```

### Active-Child Cookie Read
**Source:** `src/app/(authenticated)/(active)/layout.tsx` lines 20–21 and `src/lib/active-child-cookie.ts`
**Apply to:** All placement Server Actions and gate layout
```typescript
import { ACTIVE_CHILD_COOKIE } from '@/lib/active-child-cookie';
// In server action / layout:
cookieStore.get(ACTIVE_CHILD_COOKIE)?.value
```

### Arabic Error Strings
**Source:** `src/lib/supabase-error-ar.ts` + `src/app/(authenticated)/(picker)/profiles/new/actions.ts` lines 26–32
**Apply to:** All placement Server Actions
```typescript
try {
  await somePlacementServiceCall(...);
} catch (err) {
  if (err instanceof AuthError) {
    return { error: 'الجلسة منتهية أو الملف غير موجود' };
  }
  return { error: 'حدث خطأ، حاول مرة أخرى' };
}
```

### `force-dynamic` Export
**Source:** Every existing `(authenticated)/**/layout.tsx` and most page.tsx files
**Apply to:** Every new placement layout.tsx and page.tsx under `(authenticated)/`
```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```
CI gate: `scripts/lint-force-dynamic.sh` enforces this. Adding a layout that omits it will fail CI.

### ArabicText Sizing Convention
**Source:** `src/components/arabic-text.tsx` + usage across multiple pages
**Apply to:** All placement page and component files
```typescript
// Passage body text (large, Noto Naskh, full Tashkeel):
<ArabicText size="reader" as="p">...</ArabicText>
// Buttons, labels, choice text:
<ArabicText size="ui">...</ArabicText>
// Secondary / metadata:
<ArabicText size="caption" className="text-muted-foreground">...</ArabicText>
// Tashkeel off for Level 14/18 passages:
<ArabicText size="reader" diacritics="hide">...</ArabicText>
```

### RTL Logical Properties (Tailwind v4)
**Source:** `src/components/ui/dialog.tsx` lines 41, 47 + CONTEXT.md §Specific Ideas
**Apply to:** All placement component layout classes
```
Use:  ps-4 pe-4 ms-auto text-start border-s end-4 start-4
NOT: pl-4 pr-4 ml-auto text-left border-l right-4 left-4
```
`fixed end-4 bottom-4` is the canonical positioning for the floating escape-hatch buttons.

### Service Layer Purity (No `next/*` imports)
**Source:** `tests/invariants/service-layer-purity.test.ts`
**Apply to:** `src/services/placement.ts`
```typescript
// FORBIDDEN in src/services/placement.ts:
// import { redirect } from 'next/navigation';
// import { cookies } from 'next/headers';
// import { revalidatePath } from 'next/cache';
// All next/* calls belong in actions.ts, not the service layer.
```

### RLS + Write via DIRECT_DATABASE_URL
**Source:** `src/db/seed/index.ts` lines 18–22 + RESEARCH.md §B
**Apply to:** `src/db/seed/placement-placeholder.ts`
```typescript
const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error('DIRECT_DATABASE_URL is not set');
const client = postgres(url, { max: 1, prepare: false });
```
`texts` and `questions` tables have `withCheck: sql\`false\`` — seeding via anon or pooler role silently fails. DIRECT_DATABASE_URL (port 5432, postgres superuser) bypasses RLS.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/ui/alert-dialog.tsx` | component (shadcn) | event-driven | AlertDialog is NOT in the codebase yet. `src/components/ui/dialog.tsx` exists but is a plain Dialog, not AlertDialog. **Wave 0 install required:** `npx shadcn@latest add alert-dialog`. The escape-hatch component imports from this file — it cannot be written until the component exists. |
| `src/app/(authenticated)/(placement-gate)/dashboard/...` and `library/...` | route restructure | — | These are existing routes being moved INTO a new route group. The move is mechanical (file rename / directory restructure) — no analog needed. The pages themselves are unchanged; only their parent layout changes. See RESEARCH.md §D for the route-group nesting diagram. |

---

## Metadata

**Analog search scope:** `src/app/`, `src/components/`, `src/services/`, `src/db/`, `tests/`, `scripts/`
**Files scanned:** 53 TypeScript/TSX source files + 4 SQL/JSON migration files
**Pattern extraction date:** 2026-05-16

---

## PATTERN MAPPING COMPLETE

Phase 3 has 26 files classified across 9 roles. 24/26 have codebase analogs. The 2 analog-less items are: (1) `alert-dialog` shadcn component — Wave 0 install task required before EscapeHatch can be written; (2) dashboard/library route-group restructure — mechanical file move, no analog needed. The dominant patterns are the service-layer shape from `profiles.ts`, the Server Action shape from `manage/actions.ts`, the gate-layout shape from `(active)/layout.tsx`, and the form-per-card shape from `choose-child/page.tsx`.
