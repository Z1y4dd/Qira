# Qira

## What This Is

Qira is an Arabic-first web reading app for children ages 5–12 that places a child at a reading level, serves them leveled Arabic texts, and quizzes their comprehension. It's the Arabic-language equivalent of Raz-Kids / Reading A-Z — a category that doesn't yet exist for the 50M+ school-age Arabic-speaking children worldwide.

## Core Value

A child reads a passage at their actual level and we can tell whether they understood it. Everything else (auth, profiles, dashboards, gamification, content scale) exists to serve this one loop.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Reading loop (the core)**
- [ ] Child can take a placement assessment that assigns a reading level (Levels 1–20)
- [ ] Child can browse texts available at their assigned level
- [ ] Child can read a leveled Arabic text in a kid-friendly reader (RTL, Arabic typography)
- [ ] Child sees comprehension questions after each text and gets immediate feedback

**Accounts**
- [ ] Parent can sign up with email/password or Google OAuth
- [ ] Parent can create one or more child profiles under their account
- [ ] Child can pick their profile and the app remembers progress under that profile

### Out of Scope (v1)

- **Parent/teacher dashboards** — defer to v2; the loop must work before reporting matters
- **Gamification (stars, badges, streaks)** — defer to v2; engagement features layer on top of a working loop
- **AI-driven placement or AI-generated comprehension questions** — v1 uses pre-authored question banks and a deterministic placement algorithm; defer LLM-based content to v2 to avoid Arabic prompt-engineering, moderation, and per-user-cost problems before the loop is validated
- **Native mobile apps (iOS / Android)** — web-first MVP; mobile is a deliberate post-v1 step
- **AI read-aloud / pronunciation correction** — Phase 2 feature in the business plan, not v1
- **School management portal / B2B licensing** — Year-2 plan per business plan, not v1
- **Multilingual content (English, French, Urdu)** — Arabic-only for v1
- **Diglossia handling (Ammiyya / dialect variants)** — v1 is Fusha-only
- **Large content library** — v1 ships with a handful of placeholder/seed texts; content sourcing strategy is a separate decision
- **Subscription billing / payments** — defer; v1 validates the product, not the monetization
- **Verifiable parental consent flow for kid-led signup** — sidestepped by parent-owned account model

## Context

**Domain background.** Arabic literacy among children is widely reported as below grade level, but there is no standardized Arabic reading-level framework (no Lexile, no Guided Reading Levels). Existing Arabic learning apps (Noon Academy, Abwaab) focus on alphabet and vocabulary, not leveled reading comprehension. The business plan (`qira-business-plan.md`) cites a preliminary teacher survey (n=47) where 70% of teachers report more than half their students read below grade level, and 85% say their school has no system for measuring reading level. Qira's wedge is being the only Arabic-native platform combining leveled assessment, adaptive content, and progress tracking.

**Target user.** v1 primary user is the *child reader* (5–12). The *paying user* is the parent. The app is built for the kid's experience but gated by a parent account for legal and trust reasons.

**Prior artifacts in repo.**
- `qira-business-plan.md` — full company-strategy business plan (problem, market, GTM, financials, team, funding ask)
- `qira-mvp-v2.html` and `qira-mvp-v3.html` — single-file HTML prototypes of the reader experience. No auth, no backend — single-user demos. RTL Arabic, Fusha. They establish design intent (color palette, typography, screen flow: home → story → result → dashboard) but are not the final UI contract. v1 UI will be designed formally via `/gsd-ui-phase` taking both as reference.

**Legal context.** Target diaspora markets (US, UK, Canada, Australia) have strict under-13 data regimes (COPPA, UK Age-Appropriate Design Code, EU GDPR-K). v1 sidesteps the heavy verifiable-parental-consent requirement by making the *parent* the account holder and the child a profile under that account — the lawful default for kid-targeted products.

## Constraints

- **Tech stack — frontend**: Web app. Likely Next.js / React. RTL-first layout (not LTR with RTL patched on). Arabic web typography matters (Tashkeel rendering, line-height, font choice).
- **Tech stack — hosting**: Vercel + managed Postgres (Supabase or Neon). Chosen for shipping speed at MVP scale; ops burden is near-zero.
- **Tech stack — auth**: Email/password + Google OAuth for parent accounts. Provider TBD (Supabase Auth, Clerk, or NextAuth) — decide in phase planning.
- **Tech stack — AI**: None in runtime path for v1. AI strategy reopens in v2 once content scaling demands it.
- **Platform**: Web-first. Mobile is a deliberate later step, not parallel work.
- **Language**: Arabic UI and content, Fusha (Modern Standard Arabic), RTL throughout. No multilingual v1.
- **Compliance**: Parent-owned account model. No collection of personal data from under-13s beyond what the parent provides for the child profile (name, age, grade band).
- **Budget**: Solo/small-team build. Bias hard toward managed services and hosted infra over self-hosted. No expensive third-party AI in the v1 critical path.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build web first, mobile later | Faster shipping, single codebase, lower compliance surface than native kids' apps. Mobile is intentional v2 work | — Pending |
| Thin-slice MVP (loop only, no dashboards/gamification) | Validate the *core reading + comprehension loop* before layering engagement features. Avoid building reporting for a product that hasn't proven the learning model | — Pending |
| Rules-based v1, defer LLM to v2 | Skips Arabic LLM prompt engineering, content moderation, and per-user AI cost modeling. Hand-authored placement + comprehension banks for v1 are tractable at thin-slice scale | — Pending |
| Parent-owned account with child profiles | Lawful by default under COPPA / UK-AADC / GDPR-K for under-13 users. Matches business plan family-plan revenue model. Avoids verifiable-parental-consent UX work | — Pending |
| Vercel + managed Postgres (Supabase/Neon) | Fastest path to a deployed app. Generous free tier at MVP scale. Solved-problem ops | — Pending |
| Email + Google OAuth (parent auth) | Email/password is table stakes; Google sign-in lowers friction for diaspora parents who already use Google accounts | — Pending |
| Mockups v2/v3 as reference, not contract | Single-file HTML prototypes are good design north-stars but not production-grade. Formalize the design via `/gsd-ui-phase` before the UI build phase | — Pending |
| Fusha-only, RTL-first | Diglossia (Fusha vs. Ammiyya) is a v2+ problem. RTL is non-negotiable architecturally from day one — patching it on later is a known anti-pattern | — Pending |
| Placeholder content for v1 | Content sourcing (hand-author vs license vs AI-generate) is a separate workstream from the product build. v1 ships with a handful of seed texts to prove the loop | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-14 after initialization*
