---
phase: 02-auth-child-profiles
plan: 05
slice_name: active-child-picker
status: complete
completed_date: "2026-05-15"
tasks_completed: 6
tasks_total: 6
key_decisions:
  - (authenticated) split into two sub-groups: (picker) — no active child needed, used by /choose-child + /profiles/*; (active) — requires active child cookie, used by /dashboard and (later) /placement and /library
  - Active-child cookie is unsigned — RLS is the trust boundary; forging the cookie to another parent's child UUID returns zero rows and trips AuthError('NO_ACTIVE_CHILD')
  - ActiveChildChip is rendered in the (active) layout (not the page) so it's always visible without per-page duplication
  - DropdownMenu uses rtl:rotate-180 on the chevron icon (shadcn --rtl baseline) so it visually flips in RTL
  - setActiveChildAction calls requireActiveChild for ownership validation before setting the cookie (defense-in-depth)
---

# Slice 5 Summary

/choose-child picker + avatar nav chip + /dashboard personalized greeting. The (picker)/(active) layout split is the architectural piece — every later phase route lives under (active) and gets the active child cookie for free.
