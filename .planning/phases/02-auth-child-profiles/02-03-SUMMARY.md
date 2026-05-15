---
phase: 02-auth-child-profiles
plan: 03
slice_name: password-reset
status: complete
completed_date: "2026-05-15"
tasks_completed: 2
tasks_total: 2
key_decisions:
  - /reset-password/request returns ok:true even on Supabase error to prevent email-enumeration
  - /reset-password page does the exchangeCodeForSession on initial render — Server Component side — then renders the new-password form
  - applyResetAction signs the user out after updateUser so they re-authenticate fresh with new password
  - ResetApplyInput.refine() enforces password === confirmPassword with Arabic error path 'confirmPassword'
---

# Slice 3 Summary

Two-page reset flow: /reset-password/request (email entry → resetPasswordForEmail) and /reset-password (?code= exchange → updateUser → signOut → /sign-in?reset=ok with success banner already wired in Slice 2).
