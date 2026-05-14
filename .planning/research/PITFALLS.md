# Pitfalls Research

**Domain:** Arabic-first leveled-reading EdTech web app for children ages 5–12 (Qira)
**Researched:** 2026-05-14
**Confidence:** HIGH (most pitfalls cross-confirmed by official docs + community sources; a few LOW-confidence callouts flagged inline)

Six pitfall clusters specific to Qira:

1. Arabic + RTL pitfalls
2. Children's-product / compliance pitfalls
3. Leveled-reading-platform pitfalls
4. Web-first → mobile-later pitfalls
5. Solo / small-team EdTech-MVP pitfalls
6. Vercel + Supabase/Neon pitfalls

Each pitfall has: what goes wrong, why, prevention, warning signs, phase to address. Read alongside `STACK.md` and `ARCHITECTURE.md` — many preventions are upstream architectural choices that get expensive to retrofit.

---

## Critical Pitfalls

### Pitfall 1: LTR-built UI patched with `direction: rtl` after the fact

**What goes wrong:**
The team builds layouts using physical CSS (`margin-left`, `padding-right`, `text-align: left`, `left: 0`, flex/grid with hardcoded left-to-right assumptions), then "adds RTL" later via stylesheet overrides or a `dir="rtl"` flip. Result: dozens of subtle bugs — icons on the wrong side of inputs, progress bars filling the wrong direction, modal close buttons in the wrong corner, swipe/transition animations going backward, drop-shadows offset wrong, scroll bars on the wrong side, focus rings asymmetric. Each one is a one-line fix. There are hundreds of them.

**Why it happens:**
Default Tailwind/CSS muscle memory is `ml-4`, `pr-2`, `text-left`. Component libraries (shadcn, Radix, MUI) ship LTR-default examples. Designers mock in LTR-thinking Figma. The cost of each shortcut is invisible until you flip `dir="rtl"`.

**How to avoid:**
- Set `dir="rtl"` on `<html>` from commit #1. There is no LTR mode for v1 — do not build one.
- **Enforce CSS logical properties everywhere**: `margin-inline-start`, `padding-inline-end`, `border-inline-start`, `inset-inline-start`, `text-align: start`. Ban physical `left`/`right` properties via lint rule (`stylelint-use-logical`) or Tailwind config that removes/aliases `ml-*`, `pr-*` in favor of `ms-*`, `pe-*` (Tailwind v3.3+ ships logical-property utilities).
- For icons that have inherent direction (arrows, chevrons, back buttons): use a single source of truth that flips automatically. Either CSS `transform: scaleX(-1)` under `:dir(rtl)`, or maintain two icon variants and pick based on direction.
- Audit any third-party component before adopting it. Radix and shadcn handle RTL well; many drag/swipe carousel libraries do not.
- **The HTML mockups (`qira-mvp-v2.html`, `qira-mvp-v3.html`) are useful design references but they are single-file prototypes** — do not assume their CSS is RTL-correct. Treat the production design pass as the contract.

**Warning signs:**
- Anyone writes `ml-`/`pr-`/`text-left` in a PR — block at lint.
- A component "looks fine" in dev but breaks when you toggle direction. (You should not be toggling — this means someone built LTR-first.)
- Designs come in from Figma with a "left sidebar." Reframe as "start sidebar."

**Phase to address:**
**UI foundations phase** (the first phase that produces real components). Cost of retrofit grows roughly linearly with components shipped. Set the lint rule on day 1.

---

### Pitfall 2: Tashkeel rendering breaks (overlap, missing glyphs, line-height clipping)

**What goes wrong:**
Qira is a *reading* app for children — diacritical marks (Tashkeel: fatha, kasra, damma, sukun, shadda) matter enormously because children read voweled text. Three failure modes:
1. **Glyphs overlap adjacent lines** when `line-height` is too tight (the default 1.2–1.5 from a Latin-first reset).
2. **Diacritics get cut off** by tight container heights, `overflow: hidden`, or letter-spacing rules.
3. **The chosen font has incomplete Tashkeel coverage** — many free Arabic fonts ship the consonants but render Tashkeel as boxed-tofu or stacked-incorrectly glyphs. Cairo, Tajawal, and several "modern" sans-Arabic fonts have known Tashkeel quality issues.

**Why it happens:**
Latin-first CSS resets, web designers picking fonts by looks-without-Tashkeel-on, copy-pasting test text without diacritics so the bug stays invisible until real content lands.

**How to avoid:**
- **Pick fonts validated against fully-voweled Arabic text.** For children's reading apps, strong candidates: Amiri (excellent Tashkeel, slightly traditional look), Noto Naskh Arabic / Noto Kufi Arabic (Google, complete Unicode coverage, well-tested), Cairo (modern, but verify your specific weights render Tashkeel correctly), Markazi Text.
- Set `line-height: 1.8` minimum for body text, `2.0` for any fully-voweled passage. Do not use Latin defaults.
- **Always test with fully-vocalized strings in dev**, not unvocalized prose. Add a fixture like `بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ` plus a passage with shadda + kasra + fatha to your component playground. Tashkeel bugs are invisible without Tashkeel in the test data.
- **Never set `letter-spacing` on Arabic text.** Arabic is a connected script; letter-spacing breaks the ligatures and makes text unreadable.
- **Never set `hyphens: auto`** — Arabic does not hyphenate.
- Self-host fonts (WOFF2 + `font-display: swap`) so Tashkeel glyphs are guaranteed available. Do not rely on a system font fallback during font load; the fallback font may not have Tashkeel coverage and FOUT will be visibly broken.

**Warning signs:**
- Tester reports "the dots are touching" or "I can't see the small marks."
- Designs use placeholder text without Tashkeel.
- A new font is being adopted and nobody has tested it with `َ ُ ِ ّ ْ ـً ـٌ ـٍ` over a real Arabic word.

**Phase to address:**
**UI foundations phase** (font pick) and **reader-component phase** (line-height, container heights for passages).

---

### Pitfall 3: Bidi (bidirectional) rendering bugs in mixed Arabic + Latin content

**What goes wrong:**
Qira will inevitably mix scripts. Examples:
- A child's profile name typed in English ("Adam") inside an Arabic UI.
- Reading levels labeled "المستوى 5" (Level 5) — Latin digit inside Arabic.
- Comprehension question references like "السؤال 3 من 10" (Question 3 of 10).
- Punctuation around numbers (`( ) , .`) — these are *neutral* characters and inherit direction from neighbors.

The Unicode Bidi algorithm decides direction at the character level and gets it wrong in predictable ways:
- "iOS 17" inside Arabic flips to "71 SOi" or sits on the wrong side of its sentence.
- A phone number "965-2221-6656" in a form may render as "6656-2221-965."
- Parentheses around an English word inside Arabic flip orientation.
- A pasted ID like "user@example.com" inside Arabic chat-style UI ends up at a wrong horizontal position.

**Why it happens:**
Devs assume browsers "just handle" Bidi. Browsers do, but the algorithm's defaults often produce nonsense for mixed strings. Without explicit Bidi marks (`U+200E LRM`, `U+200F RLM`, or `<bdi>`), the browser guesses by context.

**How to avoid:**
- Wrap any user-generated or variable-direction content in `<bdi>` (Bidi Isolation). Example: `<bdi>{childName}</bdi>` inside an Arabic sentence. This is what `<bdi>` exists for.
- For UI strings that interpolate numbers ("Question {n} of {total}"), wrap the numerals in `<bdi>` or `<span dir="ltr">`.
- For form inputs where the user will type Latin (email, phone, URL): set `dir="ltr"` on the input explicitly. Do *not* inherit RTL from the parent. Email fields, phone fields, password fields with Latin-only content should all be `dir="ltr"` (Jotform's documented phone-field bug is the canonical example).
- For inputs that accept either Arabic or Latin (name field, free-text answer): use `dir="auto"` which lets the browser detect per-input.
- **Decide on digits:** Latin digits (0–9) vs Arabic-Indic digits (٠–٩) vs Eastern Arabic-Indic (۰–۹). Pick ONE for the app and document it. Mixing causes Bidi confusion and looks unprofessional. For diaspora children (US/UK/Canada/Australia primary market), Latin digits are typically the right call — kids see them in math class. Confirm with target users; do not assume.

**Warning signs:**
- A QA test with an English child name (e.g., "Adam," "Sara") shows the name in the wrong position in Arabic UI.
- Parentheses or commas appear "on the wrong side" of mixed content.
- Phone or email input fields right-align Latin text or scramble it.

**Phase to address:**
**UI foundations phase** — establish `<bdi>` and `dir` conventions in the component library. Catch the rest in **content authoring and forms phase**.

---

### Pitfall 4: Wrong placement on day 1 → child rage-quits

**What goes wrong:**
This is **the** failure mode of leveled-reading apps. A 7-year-old takes the placement quiz, gets put at Level 8 because they guessed well, opens the first text, can't read it, closes the app, never opens it again. Or the reverse: a strong 9-year-old gets placed at Level 2, reads three baby-text passages in 4 minutes, decides "this app is for babies," and never opens it again. Parent watches over the shoulder, sees the kid quit, churns the subscription.

Even Raz-Kids — the category leader with 20+ years of refinement and millions of users — explicitly tells teachers "the Reading Placement Tool is *not* an assessment. It helps students start reading content at an appropriate level until the teacher can assess their reading behavior through other means." (Raz-Kids treats placement as a *starting hint*, not a verdict, and provides a "reset placement" button as a first-class feature.)

For Qira this is doubly hard because **Arabic has no Lexile / no Guided Reading Levels** — no validated psychometric framework exists. Even well-funded English platforms have shaky placement validity; we are building the framework from scratch.

**Why it happens:**
- Founder over-confidence in their leveling algorithm.
- No "I want to read something easier/harder" escape hatch in the UI.
- Placement test is treated as a one-shot exam instead of a continuous signal.
- Hand-authored placement test items aren't piloted on real children before launch (the items might not actually discriminate level the way the designer thinks).

**How to avoid:**
- **Bias placement *down* on uncertainty.** A child reading slightly-too-easy text builds confidence; a child reading slightly-too-hard text builds avoidance. The asymmetry is large. Pick the lower level when the algorithm is between two options.
- **Make level changes one-click, visible, non-judgmental.** Every passage screen has a "this is too easy" / "this is too hard" button. Not buried in settings. The parent or child can move level any time without consulting the algorithm.
- **Recalibrate continuously, not just once.** Track comprehension-question success rate per session. Auto-suggest level changes after 3+ texts at very high (>95%) or very low (<40%) accuracy.
- **Pilot the placement test on real kids before public launch.** Do not ship the v1 placement test based on the founder's intuition alone. Even 10 supervised sessions with real 5–12-year-olds will surface 80% of the catastrophic items ("the picture answer is too obvious," "the dialect word is wrong for our audience," "the font is too small for a 6yo").
- **Have parents pre-set an "approximate grade/age" so placement starts in the right neighborhood.** A 6-year-old should never start the placement at Level 10. Use parental grade input as a strong prior; placement just refines within ±2 levels.
- Consider deferring the full placement test to v1.5. **For the absolute thinnest slice**, parents pick the level explicitly ("My child can read words like X, full sentences like Y, paragraphs like Z — pick one") and the app calibrates after the first few texts. This skips the entire psychometric-validity problem for v1.

**Warning signs:**
- Placement-test session-completion rate < 90%. (Kids abandoning mid-quiz means the quiz is too long / too hard.)
- First-text-after-placement: comprehension < 50% or > 95% in aggregate (level distribution wrong).
- High drop-off on session 1 reading vs session 1 placement (the level felt wrong).
- Parents email asking "how do I change my child's level?" — the UI doesn't expose it well enough.

**Phase to address:**
**Placement & leveling phase** (design the system) and **piloting phase before public launch** (validate with real kids). This is the #1 thing to validate with the wedge audience before scaling acquisition. Research is unambiguous: the literature on instructional/frustration reading levels shows even the *concept* of "the right level" has questionable psychometric grounding (Shanahan, Treptow et al., ScienceDirect 2015), so over-engineering algorithmic precision is wasted effort. Build the escape hatch instead.

---

### Pitfall 5: Comprehension questions test memorization, not understanding

**What goes wrong:**
The child reads the passage, then sees questions like "What color was the cat?" — they scan back, find "أصفر" in the text, click "yellow," get the points, learn nothing about comprehension. The app's signal ("90% comprehension!") is meaningless because the kid is doing a search-and-match exercise, not reading-for-meaning. Parents eventually notice their kid is "scoring well" but still can't explain what they read.

This is the dominant failure mode of auto-generated comprehension questions, and pre-authored questions are not immune — it's easy to write "factual recall" questions that look like comprehension.

**Why it happens:**
Factual-recall questions are the easiest kind to author at scale. They have unambiguous right answers, easy distractors, and the metric "% correct" feels rigorous. Inference and gist questions require pedagogical skill to write well, and they often have defensibly-multiple correct answers, which is harder to grade automatically.

**How to avoid:**
- **Mix question types deliberately.** A solid comprehension item bank includes: literal recall (~30%, fine in moderation), vocabulary in context (~20%, valuable), main idea / gist (~25%), inference (~15%), and connection to prior knowledge (~10%). Track per-question-type accuracy separately — a kid acing recall but failing inference is signal.
- **Author from the question type backward, not the passage forward.** Don't take a passage and ask "what factual questions can I write?" Decide "I need an inference item at level 5" and then write or pick the passage to support it.
- **Avoid questions answerable by ctrl-F.** A good test: if the question's keyword appears verbatim in the passage and the answer is the word right after it, the question is recall-only. Rewrite.
- **For v1's hand-authored banks: have one literacy specialist (not the engineer-founder) write or review every question.** Bad questions in v1 are unrecoverable signal noise that pollutes leveling decisions and parent trust. This is worth the budget line.
- **Limit "score" as the surfaced metric.** Showing children a per-passage 0–100% score reinforces test-taking mode. Show "did you get it?" / "let's review one" — qualitative framing that emphasizes the learning, not the grade.

**Warning signs:**
- A literacy specialist reviewing the question bank says "these are mostly recall."
- Children's accuracy is very high (>90%) but parent observation reports the child "can't tell me what the story was about."
- Question authoring rate is suspiciously fast (5+ questions per passage in 10 minutes) — quality probably below acceptable.

**Phase to address:**
**Content & question-authoring phase.** Set the question-type distribution policy *before* authoring begins, not after. Re-audit at the first content-batch review.

---

### Pitfall 6: Third-party SDKs leak child data despite the parent-account model

**What goes wrong:**
The PROJECT decision to use parent-owned accounts elegantly sidesteps the verifiable-parental-consent requirement under COPPA / UK-AADC / GDPR-K. **It does not exempt the product from data-minimization rules**, because the child still uses the product, and "child users of a child-directed service" still trigger most of the obligations. Common landmines:

- **Analytics SDKs** (Google Analytics, Mixpanel, PostHog, Amplitude) by default collect IP address, device IDs, advertising IDs, sometimes precise location, and persist them as "persistent identifiers" — which are **personal information under COPPA**. The FTC has prosecuted child-directed services where the operator's own code was clean but a third-party SDK collected data without consent (Apitor 2024 enforcement; new COPPA rule effective April 22, 2026 explicitly limits monetization-via-third-party of children's data).
- **UK-AADC requires "high privacy by default."** Analytics that build behavioral profiles to "incentivize engagement" (streaks, time-on-app push notifications) are specifically called out as restricted. Settings must default off, not opt-out.
- **Error/crash reporting (Sentry, LogRocket)** can capture URLs, query strings, sometimes form contents. A LogRocket-style session replay on a child profile is almost certainly non-compliant.
- **Embedded fonts and CSS from third-party CDNs** (Google Fonts hot-linked) transmit IP+UA to a third party. EU regulators have ruled this requires consent.
- **Retargeting pixels** (Meta Pixel, Google Ads conversion) on the *marketing* site that then carry to a logged-in parent dashboard can sweep up child-profile context. Common landmine.
- **Retention policies.** Holding child placement-test responses for "as long as the account exists" is not data minimization. UK-AADC and GDPR-K both demand explicit retention schedules.
- **Parental access rights.** Parents must be able to *view* and *delete* their child's data on request, including any inferred level/profile data — not just account-level data.

**Why it happens:**
"We use parent accounts so we're fine" is a misread of the regulations. The compliance regime cares about *what data exists* and *what flows where*, not who clicked the signup button. Default analytics setups are designed for adult web products and ship with permissive defaults.

**How to avoid:**
- **Maintain an SDK inventory document** from the first deployed dependency. Every third-party script, npm package that makes network calls, embedded service: name, purpose, what data it sees, retention, sub-processors. Treat any "we'll figure this out later" item as a blocker on launch.
- **Default-disable third-party advertising IDs, behavioral tracking, retargeting on any path that touches a child profile.** Analytics on the *child-facing* surfaces should be first-party, server-side, aggregated, and free of persistent device identifiers.
- **Self-host fonts.** No Google Fonts CDN hotlinking. Bundle WOFF2 with the app.
- **Sentry / error reporting: scrub PII and disable session replay for authenticated child sessions.** Configure `beforeSend` to strip URLs containing child profile IDs.
- **Retention policy in writing**, before launch: placement responses (12 months), comprehension responses (12 months), level history (lifetime of account or 24 months after last activity), inferred profile (deleted on account close).
- **Parent-data-access UI** built into the parent dashboard from v1: view child profile, view what data exists for that child, delete child profile (hard delete, cascades). This is not optional under UK-AADC. It's also good product.
- **Marketing surfaces** (landing page, signup funnel) can use standard analytics, **but** any page that an authenticated parent visits while a child is logged in (or any child-facing route) must not. Segment the script tags by route.
- **Read the actual texts** — at minimum: FTC COPPA 2025 final rule, UK-AADC 15 standards, GDPR Article 8. They are short and unambiguous; secondhand summaries miss specifics.

**Warning signs:**
- The team can't name every SDK loaded on the child reader page.
- A network tab inspection on the child reader page shows requests to domains other than your own + Supabase + a CDN.
- Retention policy doesn't exist or says "we keep data as long as needed."
- The parent dashboard does not have a "delete child profile" button.

**Phase to address:**
**Auth & accounts phase** (parent-data-access UI scaffolding), **analytics phase** (SDK inventory + first-party analytics decision), and **pre-launch compliance review phase**. The April 22, 2026 COPPA effective date is past by the time Qira launches; the rules are live.

---

### Pitfall 7: "Wrong answer, you lose" — discouragement loops break kid motivation

**What goes wrong:**
Child picks wrong answer on a comprehension question. App shows a big red X, plays a sad sound, says "Wrong! Try again." Repeat 2–3 times in a session. Kid associates the app with failure. App opens become a chore. Parent notices avoidance behavior.

This is a UX problem that orthogonal to compliance — it's about how feedback is framed for the age group.

**Why it happens:**
Adult-product muscle memory ("correct/incorrect" feedback) ported into kid product. Designers under-test on actual children. The metric mindset of "track accuracy" leaks into UI ("you got 60%").

**How to avoid:**
- **Frame all feedback as forward motion, not verdict.** "Let's look at that one again" instead of "Wrong." Highlight the relevant part of the passage on a miss, ask the kid to re-read that sentence, then offer the question again. The child *gets the answer right on the second look* — this is a feature, not a bug.
- **Never penalize a wrong first attempt.** Score (if shown at all) is success-after-review, not first-attempt accuracy.
- **No streak-break punishment.** If you do streaks (v2 per PROJECT.md), missing a day cannot vaporize a 30-day streak with a sad animation. Streak design for kids should compound, not punish.
- **Audio/animation tone matters more than copy.** A small encouraging chime on miss + a "let's try together" animation is the entire UX. Don't use a buzzer sound. Don't use a red X graphic.
- **Test with at least 3 real children in the target age band** before locking the feedback pattern. Watch them miss a question. Note their face. Iterate the UX on observed reaction, not assumed reaction.

**Warning signs:**
- Sad/punitive sound effects or red-X visuals on miss feedback.
- Session retention drops after a kid hits 2+ misses in a row.
- Parent feedback: "my child says the app is mean / says they're bad at it."

**Phase to address:**
**Reader & comprehension UX phase.** Decide the miss-feedback pattern as a v1 design lock before building.

---

### Pitfall 8: Web-v1 choices that block the v2 mobile port

**What goes wrong:**
The web app ships with assumptions that don't translate to mobile, forcing a partial rewrite when the mobile port begins:

- **Mouse-hover-only affordances** (tooltips, hover-to-reveal controls) — there is no hover on touch.
- **Tiny click targets** (< 44px) that work fine with a mouse but fail Apple HIG and Google Material on touch. Comprehension-question answer buttons sized for cursor precision will be miserable on a phone.
- **Fixed pixel layouts** instead of fluid/responsive. A reader passage at a fixed 720px column breaks on a 375px phone screen.
- **Heavy desktop assets** — illustrations, decorative images, background videos shipped without mobile-optimized variants. Slow LCP on a kid's mom's older Android.
- **Browser-only auth flows** (popup OAuth windows, redirect URLs that assume a specific origin) — these need rework for a webview-wrapped or native shell.
- **Coupling business logic into Next.js Server Components / route handlers** instead of behind a clear HTTP API. When the mobile app shows up, you either re-expose the logic as an API (forking the architecture) or you keep mobile dependent on Next.js routes (a brittle coupling).
- **Server-rendered UI that the mobile app can't reuse.** If 60% of the reader page is HTML rendered by Next.js, the React Native rewrite is from scratch.

**Why it happens:**
"Mobile is later" gets interpreted as "ignore mobile considerations." Web-first is a sequencing decision, not a "design only for desktop" decision.

**How to avoid:**
- **Mobile-responsive from v1**, even though native mobile is deferred. Web on a phone browser must work. Most parents will check Qira on their phone before sharing it with the kid.
- **Touch-target minimum 44×44px everywhere** — for buttons, comprehension answer choices, profile-picker tiles. Padding-extends the hit area if visual design is smaller.
- **No hover-only interactions.** Anything revealed by hover must also be accessible by tap/focus.
- **Design the API layer with a "could this be called by a mobile app?" mental check.** All business logic that produces a level recommendation, fetches a passage, scores a comprehension submission, etc. should live behind HTTP endpoints — not be inlined into a Server Component. Next.js Route Handlers (app/api) are a clean place to put this. The web frontend calls them just like a future mobile app would.
- **Fluid typography (`clamp()`) and CSS container queries** for the reader. Passage text needs to look right at 360px and 1440px width.
- **Asset budget per page < 1MB on the reader screen.** Mobile-friendly even on web.
- **OAuth redirects parameterized**, not hardcoded. Supabase auth callbacks already support this — use it.

**Warning signs:**
- A team member opens the dev URL on their phone and the layout is unusable.
- A new feature is being built as a Server Component with no equivalent JSON endpoint.
- Click targets pass design review at 32px because "the cursor is precise."

**Phase to address:**
**UI foundations phase** (touch targets, responsive, no-hover-only rule) and **API design phase** (clean HTTP boundary). Cheap to do day 1; expensive to retrofit.

---

### Pitfall 9: Building the CMS before there is content

**What goes wrong:**
The team builds a rich content-authoring system — passage editor with Tashkeel insertion tools, level-tagging interface, question-bank UI, draft/review/publish workflow, content versioning — before there are any actual passages. Three months of engineering on a CMS, and v1 ships with the same handful of seed passages it would have shipped with anyway. The CMS will be useful in v1.5 when there's a content team, but right now it's pure waste; worse, the engineers built it without real workflows, so when the content team arrives they ask for changes that invalidate half the CMS work.

**Why it happens:**
Engineers like building tools more than authoring content. Building a CMS feels productive. A spreadsheet-import path feels embarrassingly low-tech.

**How to avoid:**
- **v1 content authoring is plain Markdown/MDX files (or a single Google Sheet) committed to the repo or imported via script.** Passages are content; commit them like content. Question banks are JSON or rows in a sheet.
- **Defer the CMS until there is a paid content author who cannot use the developer workflow.** When the bottleneck is "we have a literacy specialist whose only way to publish is to file a GitHub PR," then build the CMS — for that specific specialist's workflow, with their actual feedback.
- **The PROJECT.md decision is "placeholder content for v1." Honor it.** Hand-author 20–50 passages across levels 1–10 for v1. That's a content task, not an engineering task.

**Warning signs:**
- A "content management" feature appears in the roadmap before the content team exists.
- An engineer is building a passage editor.
- Content authoring is blocked on "the CMS isn't ready."

**Phase to address:**
**Roadmap planning phase** — explicitly exclude CMS from v1. Re-evaluate at v1.5 milestone.

---

### Pitfall 10: Building dashboards & gamification before validating the loop

**What goes wrong:**
PROJECT.md explicitly defers parent dashboards, gamification, badges, and streaks to v2. The trap: scope creep at execution time. "It would be so easy to add a stars-earned counter…" "Parents will ask for at least a basic dashboard…" Two months later, v1 has half-finished dashboards and gamification but the core reading loop is still buggy. Then v1 ships with the wrong things polished.

**Why it happens:**
- Dashboards feel like "real product." Reading-loop polishing feels like detail work.
- Gamification is fun to build.
- "Parents will ask" is a real concern, but it's an objection to be tested, not a feature to pre-build.

**How to avoid:**
- **Treat the PROJECT.md "Out of Scope (v1)" list as load-bearing.** Any deviation requires explicit decision-logging via `/gsd-transition` or PROJECT.md update — not silent scope creep in a PR.
- **The phase exit criteria for v1 should be 100% about the core loop**: placement works, reader works, questions work, profile picker works, accounts work. Nothing else.
- When a "but we should add X" thought arises, write it in a `BACKLOG.md` and keep building. Most of those ideas turn out wrong after real-user contact.

**Warning signs:**
- Engineering hours spent on dashboards while the reader still has Tashkeel rendering bugs.
- "Just a small badge system" appearing in a sprint.
- v1 launch slipping because a v2 feature is half-built.

**Phase to address:**
**All phases**, enforced by sticking to roadmap exit criteria. Mention explicitly at every phase kickoff.

---

### Pitfall 11: Supabase RLS misconfigured → child data exposed or app silently broken

**What goes wrong:**
Two opposing failure modes, both common:
1. **RLS disabled on a table** (the default) → the table is fully readable by anyone with the anon API key, which is shipped to every browser. Child profiles, placement responses, comprehension answers — public. This is the #1 cause of Supabase data leaks (vibeappscanner reports 83% of exposed Supabase databases involve RLS misconfigurations).
2. **RLS enabled but no policy** → queries return zero rows with no error. The app appears mysteriously broken in production but works in dev (where the developer uses the service role key).

Specific to Qira:
- **`child_profiles` table** must enforce that a parent can only see their own children. Easy to write `USING (parent_id = auth.uid())` and forget the `WITH CHECK` clause on UPDATE — letting an attacker re-parent a child profile to a different account.
- **`placement_responses`, `comprehension_responses`** must scope by parent_id (since children don't have auth.uid() — they're sub-profiles, not auth users).
- **Auth.uid() inside an anon policy** silently returns null, breaking the intended check.
- **Storing sensitive flags in user_metadata** (e.g., subscription tier) and using them in RLS — user_metadata is end-user-writable, so the user can grant themselves access.

**Why it happens:**
RLS is opt-in and not enforced by Supabase by default. Policies are easy to write *almost* correctly. The "looks fine in dev with service_role" trap is universal.

**How to avoid:**
- **Default-deny posture**: enable RLS on every table at creation time. Add a migration check (CI script or pre-commit) that fails if any table in `public` schema has RLS disabled.
- **Every UPDATE policy has BOTH `USING` and `WITH CHECK`** — the USING clause filters which rows you can target; WITH CHECK filters what the row may become after update.
- **Never put sensitive flags in user_metadata.** Subscription tier, parent role, anything authorization-relevant goes in a separate table with service_role-only write access. Read via a SECURITY DEFINER function in policies.
- **Test policies via the anon client SDK, not the SQL Editor.** SQL Editor uses the service role and bypasses RLS — passing there proves nothing.
- **Index any column referenced in a policy.** `parent_id`, `child_profile_id`, `level` — these will be in every query's WHERE clause via the policy. Missing index = N+1-style perf collapse at scale.
- For child sub-profiles (which are not Supabase auth users): include `parent_id` on every child-scoped row and reference it directly. Do not try to make children into auth.users — they shouldn't have logins under the parent-account model.
- **Pair every UPDATE policy with a matching SELECT policy.** Updating a row you can't read produces silent UI bugs.

**Warning signs:**
- A new table merged without an RLS migration.
- An RLS policy without `WITH CHECK` on a writable table.
- A query "works in the SQL editor but not in the app."
- The migration directory has no RLS test fixtures.

**Phase to address:**
**Data model & auth phase.** Set the CI lint for "RLS enabled on every public table" before the first table ships.

---

### Pitfall 12: Supabase SSR session caching on Vercel → user A logged in as user B

**What goes wrong:**
This is a known and severe Supabase + Next.js App Router + Vercel pitfall. Specifically:

- When `@supabase/ssr` refreshes an expired JWT server-side, it writes the new token to the response as a `Set-Cookie` header.
- If the response is cached (Vercel Edge cache, ISR, `dynamic = 'auto'` route, or any cached fetch in the route), the `Set-Cookie` header is cached *with the page*.
- Subsequent visitors get served the cached response, their browser stores the cached cookie, and **they are now authenticated as the previous user**.

For Qira this means: parent A's session token could end up in parent B's browser. They'd see parent A's child profiles. This is a catastrophic privacy + compliance breach under COPPA/UK-AADC because child data is involved.

Additionally:
- `supabase.auth.getSession()` inside server code does NOT revalidate the token against the Supabase server. It trusts the cookie. **Always use `supabase.auth.getUser()` or `getClaims()` in middleware/server components** for any auth check, because those revalidate against Supabase.

**Why it happens:**
Next.js App Router's caching defaults are aggressive (force-cache by default for many fetches). The cookie write in SSR isn't visible in the route handler code — it's hidden inside `@supabase/ssr`. The intersection of "edge caching" + "auth state in cookies" is non-obvious.

**How to avoid:**
- **`export const dynamic = 'force-dynamic'`** on every route that touches auth (any authenticated page, any API route that reads the user). Better: enforce this via a default layout / middleware-level configuration.
- **Never call `auth.getSession()` in server code.** Use `auth.getUser()` (round-trip to Supabase Auth) or `auth.getClaims()` (verifies JWT signature locally and is much faster). Make this a lint rule.
- **Audit every `fetch()` in server code** for inadvertent caching. Authenticated fetches use `cache: 'no-store'` or `next: { revalidate: 0 }`.
- **Middleware refreshes the session and rewrites cookies on every request**, per the official `@supabase/ssr` middleware pattern. Use the canonical template; do not roll your own session refresh.
- **Add an end-to-end test**: log in as user A, hit an authenticated page; log in as user B in a fresh browser, hit the same page, assert that user B does not see user A's data. Run this in CI.
- **Vercel preview deployments**: add wildcard redirect URLs in Supabase Auth settings (e.g., `https://*.vercel.app/auth/callback`) or OAuth flows will silently fail in preview branches.

**Warning signs:**
- Any authenticated page that doesn't have `dynamic = 'force-dynamic'` or equivalent.
- `getSession()` appearing in server-side code.
- Cookies appear in cached response bodies during local testing.

**Phase to address:**
**Auth & SSR setup phase.** This is a "must be right on day 1 of auth" item. The pattern is documented in Supabase's SSR Advanced Guide — follow it literally.

---

### Pitfall 13: Vercel cold-start latency on the placement-test critical path

**What goes wrong:**
A 6-year-old taking the placement test taps "Start" and waits 2 seconds for the first item to load. The kid loses attention, looks away, plays with their sibling, returns 30s later and has lost context. This is age-specific: adult users tolerate 2s; 6-year-olds do not. The first request after a quiet period hits a cold serverless function (500ms–2s on Node.js runtime per Vercel benchmarks); compounded with Supabase connection establishment, the placement-test "Start" tap can feel like 3+ seconds.

**Why it happens:**
Serverless functions on Vercel scale to zero. Combined with Supabase's PgBouncer pool (which is fine at warm scale but each function invocation makes a fresh connection), the cold-path latency stacks.

**How to avoid:**
- **Use Vercel Edge Runtime** for read-heavy routes where possible (passage fetch, level recommendation read). Edge has near-zero cold start. Caveat: Edge Runtime has limited Node API surface — check Supabase-js compatibility before committing.
- **Preload the next placement item while the child is on the current item.** Don't wait until they submit answer N to fetch item N+1. The reader passage can prefetch its comprehension questions during the read.
- **Supabase Transaction-mode pooling** (PgBouncer transaction pool) instead of session-mode for serverless workloads. Use the connection-pool URL (`...pooler.supabase.com:6543`), not the direct connection.
- **Cache the level-1-through-20 passage metadata at the edge.** Passages don't change per-user; they can be statically generated or edge-cached aggressively.
- **Avoid round-trips on the child reader screen** — bundle the passage + its questions + the next-passage hint into a single response.
- **Watch p95 latency, not p50.** The cold-start tax is invisible at p50 (warm) and brutal at p95.

**Warning signs:**
- p95 of `/api/placement/start` > 800ms.
- A "First time loading" experience that visibly stutters.
- Sentry/observability dashboard shows latency spikes on the first request of each minute.

**Phase to address:**
**API design phase** (Edge vs Node runtime choice) and **performance baseline phase** (set p95 budgets). Re-test before any pilot launch.

---

### Pitfall 14: No content variety → child sees the same passages repeatedly → churn

**What goes wrong:**
v1 ships with a handful of placeholder passages per level. A child who reads daily exhausts level 5's available content in two sessions. Now they see the same passages again. They get bored. They quit. The parent quits.

Even when a content library exists, leveled-reader libraries notoriously skew toward predictable, low-quality passages because such passages are easy to author and easy to level. Children notice. Engagement research confirms boring leveled content is the dominant driver of disengagement in this category.

**Why it happens:**
v1 ambition is loop validation, not library scale — sensible. But "the loop" includes "the child wants to come back tomorrow," and that requires *enough content variety to come back to*.

**How to avoid:**
- **Even at "placeholder content" scope, target a minimum of 5–10 distinct passages per level for levels 1–10.** That's 50–100 passages for the v1 reader to feel non-repetitive. Less is too little.
- **Diverse topics within a level.** A level-3 reader should not see five passages all about animals. Mix narrative, expository, poems, dialogues. Pull from cultural traditions kids will recognize (stories from across the Arab world, not only Levantine or only Gulf — diaspora kids come from everywhere).
- **Surface "you haven't read this yet" prominently.** Track per-child read state and prioritize unread over re-reads in the library view.
- **Plan content sourcing as a parallel workstream**, not blocked by engineering. While the engineering team builds the loop, a contracted Arabic literacy specialist authors passages. This work fits inside a single contractor-month for ~50 passages.
- **Do not generate passages with an LLM in v1.** PROJECT.md correctly defers LLM use. Hand-authored quality at small scale beats LLM-authored slop at large scale, especially in Arabic where LLM output quality is uneven and Fusha grammar mistakes will undermine trust with parents.

**Warning signs:**
- A child finishes their level in < 1 hour of total reading.
- Re-read rate > 30% (children re-reading because there is nothing new).
- Content sourcing is "going to happen later" with no owner identified.

**Phase to address:**
**Content sourcing phase** — must run in parallel with engineering, not after. Set a 50-passage minimum bar as the v1 launch gate.

---

### Pitfall 15: Vendor lock-in to Supabase Auth makes future migration painful

**What goes wrong:**
Supabase Auth is excellent for shipping fast at MVP scale. But it stores users in `auth.users` with Supabase-specific UUIDs, and RLS policies reference `auth.uid()` everywhere. If v2 needs to migrate to a different auth provider (Clerk, WorkOS, custom), every RLS policy must be rewritten, every row's user-id reference is now ambiguous, and password hashes are non-portable across providers.

This is a real risk if Qira hits scale and Supabase's per-MAU pricing becomes uncomfortable, or if enterprise B2B contracts (per business plan, Year 2) demand SSO/SAML which Supabase's free/pro tier may not cover.

**Why it happens:**
"Use the platform's auth" is the right call for shipping speed; the lock-in cost is invisible until you want to leave.

**How to avoid (without over-engineering):**
- **Use a `users` (or `profiles`) table in the public schema with a 1:1 foreign key to `auth.users(id)`.** All app-level joins reference `users.id`, not `auth.users.id`. If you ever migrate auth, you keep the `users` table and just swap the FK source.
- **Don't expose `auth.uid()` directly to app code** — read the current user's `users.id` via a thin helper. Easier to mock in tests, easier to refactor.
- **Avoid Supabase-Auth-specific features** in user-facing flows (e.g., Supabase's built-in magic link templates) — they're hard to migrate. Build email flows on top of a portable email provider (Resend, Postmark) and use Supabase only as the auth backbone.
- **Don't actually migrate prematurely.** The above precautions cost ~zero. Actually replacing Supabase Auth is a v2 decision driven by real cost/feature pressure, not v1 anxiety.

**Warning signs:**
- App code references `auth.users` directly.
- A new feature relies on Supabase-Auth-specific functionality (built-in email templates, third-party-OAuth-provider-lock-in).

**Phase to address:**
**Data model & auth phase.** Cheap to do day 1.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode `dir="ltr"` everywhere during early dev "to ship a working layout first" | Faster initial component dev | Every RTL bug per Pitfall 1; weeks of cleanup | Never — RTL from commit 1 |
| Use physical CSS properties (`margin-left` etc.) "just for this one component" | Familiar syntax | Lint exceptions accumulate; mixed codebase is worse than fully physical or fully logical | Never — enforce logical-only via lint |
| Skip `<bdi>` on user-generated content "we'll add it if it's a problem" | Less markup | Bidi bugs appear with first non-Arabic child name; retrofit touches every user-data surface | Never — apply at template level |
| Author comprehension questions as recall-only "we'll write better ones in v2" | Faster bank build-out | Polluted leveling signal, parent-trust loss, full re-authoring later | Never on the critical path; acceptable for filler if mixed with real comprehension items |
| Skip RLS on internal tables "we'll add policies later" | Faster schema iteration | One missed table = data leak; impossible to verify after the fact | Only on tables that have zero PII *and* zero relationships to PII tables — and even then, just enable RLS with a deny-all policy |
| Use `getSession()` in server code "because getUser() is slower" | ~50ms saved per request | Auth bypass risk (cookie spoofing); see Pitfall 12 | Never — use `getClaims()` which is both fast and safe |
| Hardcode Vercel domain in OAuth redirect URLs | One less env var | Preview deployments break; staging requires manual Supabase config edits | Never — parameterize from env |
| Build a placement test "good enough" and ship without piloting | Faster to v1 launch | High day-1 churn from wrong placements; reputation damage | Never on the placement engine specifically; OK on lower-stakes flows |
| Mix Latin and Arabic-Indic digits "for variety" | None really | Bidi confusion, inconsistent UX, unprofessional feel | Never — pick one |
| Use Google Fonts CDN for Arabic fonts | Easy embed | EU privacy issue + Tashkeel fallback risk during font load | Never for child-facing surfaces — self-host |
| Ship gamification before validating the loop "because parents will ask" | Feels like more product | Polishes the wrong thing; PROJECT.md OOS violated | Never in v1 per PROJECT.md |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Supabase Auth + Next.js App Router** | Use `getSession()` in middleware/RSCs | Use `getUser()` or `getClaims()`; follow the canonical SSR middleware pattern |
| **Supabase Auth + Vercel** | Hardcoded redirect URLs break preview deployments | Use Vercel system env (`VERCEL_URL`) + wildcard entries in Supabase Auth dashboard |
| **Supabase Postgres + serverless** | Use direct connection (`db.supabase.co:5432`) from Vercel functions | Use pooler URL (`pooler.supabase.com:6543`) with transaction-mode |
| **Google OAuth (parent signup)** | Forget to configure consent screen for production verification; OAuth approval delays launch | Submit OAuth consent screen for verification ≥2 weeks before pilot launch; use "Internal" or test-user list during dev |
| **Google Fonts** | Hot-link from `fonts.googleapis.com` on child-facing pages | Self-host WOFF2 via `next/font/local`; eliminates third-party data transfer and Tashkeel-during-load gaps |
| **Sentry / error reporting** | Capture full URLs/bodies containing child profile data | Configure `beforeSend` to redact; disable session replay on authenticated routes |
| **Stripe / billing (when added v2)** | Use Stripe Customer email = parent email but accidentally store child identifiers in Stripe metadata | Store only parent-account-level data in Stripe; child data never leaves Supabase |
| **Resend / Postmark (transactional email)** | Send email to a child's email address (none should exist) | Parent email only; child profiles have no email field by design |
| **Posthog / Mixpanel / GA4** | Default-config tracking on authenticated routes capturing IDFA, IP, device fingerprint | Disable on child-facing routes; first-party event aggregation only with no persistent identifiers |
| **Supabase Storage** | Store passage assets with public-read but enforce RLS only on metadata table | Bucket-level policies must match table-level policies; assets are bytes, not rows |
| **CDN / Vercel Edge cache** | Authenticated content cached at edge → cross-user leakage (Pitfall 12) | `dynamic = 'force-dynamic'` + `Cache-Control: private, no-store` on authenticated routes |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **RLS policy with no index on policy column** | Queries get slower as data grows; CPU spikes on Supabase dashboard | Index every column in WHERE / JOIN of any RLS policy (especially `parent_id`, `child_profile_id`) | Noticeable at ~10K rows per scoped table; painful at 100K |
| **Cold-start latency on placement-test entry** | First placement-item load is slow; user-perceived stutter; bad p95 | Edge runtime where possible; preload next item; transaction-mode pooling | First user of each warm window; high-bounce age group (6yo) feels it immediately |
| **Loading full passage library on level page** | Slow level page; bandwidth bloat | Paginate; only fetch passage *metadata* (title, level, est. read time), defer body until passage open | At ~50+ passages per level |
| **No image optimization on illustrations** | Slow reader page; mobile churn | `next/image` with explicit sizes; WOFF2 for fonts; webp/avif for art; lazy-load below fold | Always on mobile; <1MB per page budget |
| **Synchronous comprehension scoring** | Submit hangs while DB writes happen | Score client-side (multiple-choice has known answer); persist async; show next item immediately | Painful at any scale on the kid's screen |
| **`auth.uid()` recomputed inside every RLS policy** | Slow queries when policies are complex | Wrap as `(SELECT auth.uid())` so Postgres caches; documented Supabase pattern | Becomes painful at scale + complex policies |
| **Loading every comprehension question for a level upfront** | Slow first paint; wasted bandwidth | Fetch only the question(s) for the current passage | At ~100+ questions per level |

---

## Security Mistakes

Domain-specific security issues beyond OWASP basics.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing child data with subscription/role flags in `user_metadata` | User can grant themselves access to other children's data (user_metadata is end-user-writable) | Use separate `subscriptions` and `parental_roles` tables with service_role-only writes |
| Service-role key reachable from client code | Total RLS bypass = full data breach | Service role key only in server runtime env; never in `NEXT_PUBLIC_*`; rotate immediately if exposed |
| `auth.users` exposed via a view without RLS | Email enumeration; signup-confirmation bypass | Wrap with SECURITY DEFINER views; expose only safe columns; never expose `auth.users.email` directly |
| Child profile IDs guessable / sequential | Authenticated parent could read other parents' children by ID enumeration | Use UUIDs for child_profile_id (Supabase default for `gen_random_uuid()`) |
| Comprehension-answer endpoint trusts client-submitted correctness | Cheating; metric pollution | Server-side scoring against authoritative answer key; client never sees the right answer until after submit (don't ship it in the page bundle) |
| OAuth state parameter not validated | CSRF on signup flow | Supabase Auth handles this if you use the canonical flow; do not roll custom OAuth |
| Logging includes child profile names / placement responses | PII in logs (long-retention) | Redact at log layer; never `console.log(childProfile)` |
| Parent-facing "delete child" is soft-delete only | GDPR-K / UK-AADC violation; right to erasure | Hard delete child profile + cascade to all related rows; document retention in privacy policy |
| Password reset email links not scoped or expire too slowly | Account takeover via leaked email | Supabase default reset link expiry (1 hour) is fine; do not extend |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Wrong-answer feedback uses red X + sad sound | Discouragement → quit | "Let's look at that one again" + soft chime + highlight passage; first miss not penalized (Pitfall 7) |
| Placement-test level is visible/celebrated as a label | Kid feels "level 3" is a bad grade if peers are at 6 | Internal level number; child sees only "your books"; level shown to parent only |
| Comprehension score shown as 0–100% | Frames learning as testing | Qualitative: "great reading today!"; surface the next passage, not the score |
| No "this is too hard / too easy" escape hatch | Wrong-level kid is stuck; parent can't intervene without going to settings | One-click on every passage screen (Pitfall 4) |
| Long placement test (> 5 minutes for 5–7yo) | Abandonment mid-quiz | Cap at ~5 min for younger; allow pause/resume; trust short signal + recalibrate-as-you-go |
| Child profile picker shows other children's names visible to a child user | Sibling rivalry, comparison | Profile picker shows only the child's own avatar/name when in child mode; parent toggle to see all |
| English-default UI strings that "haven't been translated yet" | Breaks immersion; parents lose trust in Arabic-first promise | Arabic UI from commit 1; treat any English string in the UI as a bug; copy review by native Fusha speaker before launch |
| Tashkeel toggle absent or hard to find | Older/stronger readers want unvoweled; younger need voweled; one-size fails both | Per-passage Tashkeel on/off toggle; default-on for levels 1–10, default-off for levels 11+ |
| No audio for younger levels | Pre-readers can't engage; missed market | Even pre-recorded human audio (not AI) for levels 1–5 dramatically improves engagement; defer if must, but plan for it |
| Hover-only affordances on reader controls | Doesn't work on touch / fails kid muscle memory | Tap-visible always; no hover-only state |
| Streak punishment on missed day (when v2 ships streaks) | Parent guilt; kid avoidance | Streaks compound, never break punitively; show "your record" instead of "current streak lost" |
| Untranslated error messages ("Auth error: invalid_grant") | Parent doesn't understand; support burden | Arabic error copy for every user-facing failure; technical messages logged but not shown |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **RTL layout:** Verify every route under `dir="rtl"` with real Arabic + interspersed Latin (an English name in the profile, a Latin number in a question). Don't trust "it looks fine" with placeholder LTR text.
- [ ] **Tashkeel rendering:** Visually inspect fully-vocalized text in every reader passage; check that diacritics aren't clipped at line breaks or container edges.
- [ ] **Bidi correctness:** Open dev tools, find a mixed-script string ("سؤال 3 من 10"), confirm rendering order is correct; same for child names like "Adam" inside an Arabic sentence.
- [ ] **Placement test:** Bias-down on uncertainty verified; one-click level-change escape hatch on the very first text-reading screen.
- [ ] **Comprehension question bank:** A literacy specialist (not the developer) has reviewed every question type distribution; recall questions ≤ 40% of items.
- [ ] **RLS:** Every public-schema table has RLS enabled; CI test confirms; every UPDATE policy has WITH CHECK; index exists on every policy-referenced column.
- [ ] **Auth correctness:** No `getSession()` in server code; `dynamic = 'force-dynamic'` on every authenticated route; cross-user end-to-end test passes.
- [ ] **SDK inventory:** Document exists; every third-party network call accounted for; no analytics SDK on child-facing routes captures persistent identifiers.
- [ ] **Parent-data-access UI:** Parent can view and hard-delete their child's profile + all derived data from the dashboard (or for v1, from a documented support flow if no dashboard).
- [ ] **Retention policy:** Written; cron/scheduled function that deletes expired placement and comprehension responses; tested.
- [ ] **Touch targets:** Every interactive element ≥ 44px tap target (verify on phone in browser, not just resized desktop window).
- [ ] **Mobile responsive:** Reader works at 360px viewport width; comprehension answer buttons aren't cut off; profile picker is usable.
- [ ] **Cold-start budget:** p95 latency on `/api/placement/start` and `/api/reader/passage/[id]` < 800ms after a 5-minute idle period (simulate real cold start).
- [ ] **Content variety:** ≥ 5 distinct passages per level for levels 1–10 before public availability.
- [ ] **OAuth redirects:** Tested in a Vercel preview deployment (not just local + production); Supabase Auth dashboard has wildcard or env-driven redirect URL.
- [ ] **Error copy in Arabic:** Every user-visible error string is in Arabic, reviewed by a native Fusha speaker; English error logs OK in Sentry, not in UI.
- [ ] **Font self-hosted:** No requests to `fonts.googleapis.com` or `fonts.gstatic.com` on any authenticated route.
- [ ] **Privacy policy + terms:** Written, age-appropriate plain-language version exists for parents, AADC-compliant; published before any pilot signups.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| LTR-built layout retrofitted to RTL | **HIGH** (weeks) | Switch lint rule to fail; convert components one feature-area at a time; track via grep counts of physical properties remaining |
| Tashkeel font bug | LOW (hours) | Swap font; QA-pass voweled fixtures; deploy |
| Bidi rendering bug found late | MEDIUM (days) | Audit all user-data-rendering components for `<bdi>`; template-level fix; test with non-Arabic name fixtures |
| Wrong-placement causing churn | MEDIUM | Add visible level-change UI; reduce placement test length; add bias-down; ship as a hotfix |
| Comprehension questions reveal as recall-only | HIGH (re-author) | Literacy-specialist audit; rewrite worst 30% of questions; flag question-type distribution in admin |
| Third-party SDK leaked child data | **CRITICAL** | Disable SDK; document data flow; consult counsel; consider FTC notification (mandatory under updated COPPA); audit all SDKs |
| RLS policy hole exposed data | **CRITICAL** | Add policy + index; rotate any leaked credentials; review access logs (Supabase log retention is short — check fast); user notification per GDPR Article 33 if applicable |
| Supabase SSR session leak (cross-user auth) | **CRITICAL** | Force-dynamic everywhere; switch `getSession` → `getUser`; invalidate all sessions (force re-login); log review for cross-user data reads |
| CMS over-built but no content | MEDIUM | Park CMS in a feature flag; route engineering to content tooling improvements only as requested by actual authors |
| Mobile port reveals tight desktop coupling | HIGH | Extract route handlers behind clean JSON API; React Native consumes the same endpoints; web frontend migrates to the new API |
| Vercel cold-start hurting placement-test | LOW–MEDIUM | Move read paths to Edge; pre-warm via cron-ping; switch to transaction-mode pooling |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls. (Phase names are suggestive — the roadmap consumer will pick canonical names.)

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. LTR-patched-to-RTL | UI foundations | Lint rule active; manual RTL pass on every route |
| 2. Tashkeel rendering | UI foundations (font) + reader UI | Voweled-text fixture in component tests; line-height ≥ 1.8 |
| 3. Bidi mixed-content bugs | UI foundations + forms | `<bdi>` in templates; dir-attribute audit |
| 4. Wrong placement | Placement & leveling + piloting | Pilot test with ≥10 real kids; bias-down rule; one-click level change in UI |
| 5. Recall-only questions | Content & question authoring | Literacy specialist review; question-type distribution policy |
| 6. Third-party SDK data leaks | Auth & accounts + analytics + pre-launch compliance | SDK inventory doc; first-party analytics only on child routes |
| 7. Punitive feedback UX | Reader & comprehension UX | Real-kid testing; no red-X / sad-sound |
| 8. Mobile-port blockers | UI foundations + API design | Touch-target lint; responsive QA on 360px; clean HTTP API boundary |
| 9. Premature CMS | Roadmap planning | Explicit OOS for v1 in PROJECT.md; content authored via Markdown/sheet |
| 10. Premature dashboards/gamification | All phases (discipline) | Phase exit criteria reference loop-only scope; deviations require `/gsd-transition` |
| 11. RLS misconfig | Data model & auth | CI test: RLS on every public table; policy lint; anon-client integration tests |
| 12. SSR session cache leak | Auth & SSR setup | `dynamic = 'force-dynamic'` audit; `getUser`/`getClaims` enforcement; cross-user E2E test |
| 13. Vercel cold-start | API design + perf baseline | p95 budget set; cold-path benchmarked after idle period |
| 14. Content staleness | Content sourcing (parallel workstream) | ≥ 50 passages across levels 1–10 by v1 launch |
| 15. Auth vendor lock-in | Data model & auth | `users` table separate from `auth.users`; no app code references `auth.users` directly |

---

## Tradeoffs of Locked PROJECT.md Decisions

These decisions are locked; flagging the pitfall side of each so the roadmap can mitigate.

| Locked Decision | Pitfall Surface | Mitigation in Roadmap |
|-----------------|-----------------|------------------------|
| Web-first, mobile later | Pitfall 8 — choices that block mobile | Touch targets, responsive, clean API boundary from v1 |
| Thin-slice MVP (no dashboards/gamification v1) | Pitfall 10 — scope creep pressure | Phase exit criteria audit; backlog for deferred ideas |
| Rules-based v1, LLM deferred | Pitfall 5 — hand-authored question quality risk | Literacy-specialist review on question banks |
| Parent-owned account model | Pitfall 6 — SDK and retention rules still apply | SDK inventory; first-party analytics; data-access UI |
| Vercel + Supabase | Pitfalls 11, 12, 13, 15 — platform-specific gotchas | RLS lint, SSR pattern, Edge runtime, abstract user table |
| Email + Google OAuth | OAuth verification delays (Integration Gotchas table) | Submit consent screen ≥ 2 weeks before pilot |
| Fusha-only, RTL-first | Pitfalls 1, 2, 3 — RTL & Tashkeel correctness | Day-1 lint + font pick + bidi templates |
| Placeholder content v1 | Pitfall 14 — content staleness | ≥ 50 passages bar; content sourcing as parallel workstream |

---

## Sources

**Arabic / RTL / Tashkeel / Bidi:**
- [W3C Internationalization: BiDi in HTML](https://www.w3.org/International/geo/html-tech/tech-bidi.html) — HIGH confidence, authoritative
- [W3C Arabic & Persian Layout Requirements](https://www.w3.org/International/alreq/) — HIGH confidence
- [MDN: CSS Logical Properties and Values](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Logical_properties_and_values) — HIGH confidence
- [RTL Styling 101](https://rtlstyling.com/posts/rtl-styling/) — MEDIUM confidence, well-cited community resource
- [Stop fixing Numbers — RTL in a web platform](https://dev.to/pffigueiredo/stop-fixing-numbers-rtl-in-a-web-platform-6-6-29ne) — MEDIUM, practical examples
- [Jotform: Phone field stays RTL when it should be LTR](https://www.jotform.com/answers/2585125-mutilingual-forms-arabic-phone-field-stays-on-rtl-when-it-should-be-ltr) — MEDIUM, canonical example
- [UAE Design System 2.0 Typography Guidelines](https://designsystem.gov.ae/guidelines/typography) — HIGH, government design system

**Children's product compliance:**
- [FTC: COPPA Rule Final 2025 Amendments](https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule) — HIGH, primary source
- [FTC Press Release: COPPA Rule Changes Limiting Monetization](https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data) — HIGH
- [ICO: Age Appropriate Design Code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/) — HIGH, primary source UK
- [BigID: Top 6 COPPA Compliance Pitfalls](https://bigid.com/blog/top-6-coppa-compliance-pitfalls-and-how-to-avoid-them/) — MEDIUM
- [COPPA Compliance in 2025: Practical Guide for EdTech](https://blog.promise.legal/startup-central/coppa-compliance-in-2025-a-practical-guide-for-tech-edtech-and-kids-apps/) — MEDIUM
- [SuperAwesome: AADC explainer](https://www.superawesome.com/blog/the-age-appropriate-design-code-everything-you-need-to-know-about-the-uks-new-guidelines-for-kids-digital-experiences/) — MEDIUM

**Leveled reading pedagogy:**
- [Raz-Kids Placement Tool FAQ](https://help.learninga-z.com/en/articles/7025885-reading-placement-tool-faq) — HIGH (vendor's own framing — note that placement is a hint, not an assessment)
- [Reading Rockets: New Evidence on Teaching Reading at Frustration Levels](https://www.readingrockets.org/blogs/shanahan-on-literacy/new-evidence-teaching-reading-frustration-levels) — HIGH, Shanahan
- [Shanahan on Literacy: Rejecting Instructional Level Theory](https://www.shanahanonliteracy.com/blog/rejecting-instructional-level-theory) — MEDIUM, opinion from prominent literacy researcher
- [ScienceDirect: Accuracy of Student Performance at Reading Inventory Instructional Level](https://www.sciencedirect.com/science/article/abs/pii/S0022440515000709) — HIGH, peer-reviewed
- [Teach Like a Champion: Reading Comprehension Problems Are Usually Knowledge Problems](https://teachlikeachampion.org/blog/reading-comprehension-problems-are-usually-knowledge-problems-disguised-as-skill-problems-an-example/) — MEDIUM
- [Reading Engagement Scale (Wiley, 2024)](https://ila.onlinelibrary.wiley.com/doi/full/10.1002/trtr.2267) — HIGH

**Vercel / Supabase / Next.js:**
- [Supabase Docs: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH, official
- [Supabase Docs: SSR Advanced Guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide) — HIGH, official; covers cache leak warnings
- [Supabase Docs: Setting Up SSR Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — HIGH
- [Supabase Best Practices (Leanware)](https://www.leanware.co/insights/supabase-best-practices) — MEDIUM
- [Fixing RLS Misconfigurations in Supabase](https://prosperasoft.com/blog/database/supabase/supabase-rls-issues/) — MEDIUM
- [Supabase RLS Best Practices for Multi-Tenant Apps (Makerkit)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — MEDIUM
- [Vercel Supabase: What Works and What Breaks in 2026 (Kuberns)](https://kuberns.com/blogs/vercel-supabase/) — MEDIUM
- [Mastering Serverless and Scalable Backends (Medium)](https://anqubit.medium.com/mastering-serverless-and-scalable-backends-a-guide-to-vercel-supabase-and-aws-in-2025-09df01701c91) — LOW–MEDIUM

**Mobile / responsive / EdTech MVP discipline:**
- [Camelback Ventures: EdTech Founders — The Good, Bad, and Ugly](https://www.camelbackventures.org/blog-posts/2018-1-23-edtech-founders-the-good-bad-and-how-to-avoid-the-ugly/) — MEDIUM
- [MDN: Responsive Web Design](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design) — HIGH

---
*Pitfalls research for: Qira, Arabic-first leveled-reading web app for children 5–12*
*Researched: 2026-05-14*
