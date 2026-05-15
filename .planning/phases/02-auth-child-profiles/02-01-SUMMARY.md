---
phase: 02-auth-child-profiles
plan: 01
slice_name: auth-foundation
status: complete
completed_date: "2026-05-15"
tasks_completed: 6
tasks_total: 6
key_decisions:
  - Service Layer purity preserved by injecting SupabaseClient + cookie value into Service functions (Service never imports next/*)
  - getSession ban implemented as Vitest source-scan, allow-listing only src/utils/supabase/client.ts
  - Lazy parent-row upsert via onConflictDoNothing on every requireParent call (avoids DB trigger maintenance burden)
  - Stub /sign-in + /verify-email pages added so Next 16 typedRoutes accepts the layout redirects
  - All Service functions (createChildProfile, updateChildProfile, deleteChildProfile, getChildProfile, requireActiveChild) implemented in this slice — Phases 4/5/6 wire only the UI on top
---

# Slice 1 Summary

Foundation: hard email-verification gate, getSession ban CI test, Service Layer bodies for the whole profiles surface (requireParent / requireActiveChild / list / get / create / update / delete), and 8 shadcn primitives.

Key invariants enforced:
- `auth-getsession-ban` Vitest scans src/ and allow-lists only src/utils/supabase/client.ts (29+ tests, one per source file).
- `(authenticated)/layout.tsx` calls requireParent → redirects UNAUTHENTICATED → /sign-in, UNVERIFIED → /verify-email.
- `parents.id` mirror row is lazy-upserted on every authenticated request.

113 total Vitest tests passing across the project after this slice (was 30 at end of Phase 1).
