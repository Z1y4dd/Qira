# Feature Research

**Domain:** Kid-focused Arabic-first leveled reading platform (Raz-Kids equivalent for Arabic, ages 5–12)
**Researched:** 2026-05-14
**Confidence:** MEDIUM-HIGH (HIGH on English-equivalent category features and Arabic typography; MEDIUM on Arabic leveling — only one production framework exists, Miqyas Al Dhad; MEDIUM on Arabic comprehension QG — limited academic work)

---

## Reading-First Note on Scope

Qira v1 is intentionally a **thin slice**: only the reading-and-comprehension loop. The categorization below is structured around that explicitly:

- **Tier A — Thin-slice v1 table stakes**: features the loop *literally cannot work* without. Missing one = no product.
- **Tier B — Category table stakes (v2+)**: features users of *generic* kid-leveled-reading apps expect (Raz-Kids, Epic!, Lexia). Missing them at thin-slice is acceptable because v1's customer is the validation test, not the consumer market. They become table stakes the moment Qira charges money.
- **Tier C — Differentiators**: bets that distinguish Qira from "yet another Arabic learning app." Arabic-specific moves live here.
- **Tier D — Anti-features**: deliberately *not* built. Includes both classic kid-app dark patterns and category features that look obvious but conflict with v1 thesis.

This three-tier table-stakes split is critical because the downstream `REQUIREMENTS.md` consumer must distinguish "ship-blocker" from "deferred-but-expected" from "differentiation bet."

---

## Feature Landscape

### Tier A — Thin-Slice v1 Table Stakes (the loop cannot run without these)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Parent email/password signup + Google OAuth** | Lawful basis for under-13 service; child can't legally sign up themselves | LOW | Supabase Auth / Clerk / NextAuth — pick one. Google OAuth specifically lowers friction for diaspora parents. Required by COPPA / UK-AADC / GDPR-K. |
| **Child profile creation under parent account** | The whole product targets the child, but the *account* must belong to the parent. Profile holds name, age, grade band, level. | LOW | Multiple profiles per parent (mirrors Netflix/YouTube Kids/Epic! model). One paying user, multiple children. |
| **Child profile picker on app entry** | After parent signs in (or app remembers session), child taps their own face/name. Pattern from YouTube Kids, Epic!, Netflix. | LOW | Big tap targets, avatars or initials. **Not** a separate login — child profile is a *selection*, not authenticated. |
| **Initial placement assessment (Levels 1–20)** | Without placement, every child reads the same text — kills the core value prop ("at their actual level"). | HIGH | See "Arabic placement design" section below. Rules-based / deterministic for v1 (per PROJECT.md). ~10–20 mins. Reference: Raz-Kids placement = ~20 min; Lexia Core5 = ~11 min average. |
| **Leveled text library browse (filtered to child's level)** | Child must see *something to read*; library must auto-filter so the child doesn't accidentally pick text out of range. | LOW (v1) | "Library" can be a list of 8–15 seed texts in v1. Each text has level metadata. Filtering UI is trivial; *content sourcing* is the hard problem (separate workstream, per PROJECT.md). |
| **Kid-friendly Arabic reader (RTL, Fusha, age-appropriate typography)** | This is the actual reading surface. Bad typography = unreadable = whole product fails for 5–9-year-olds. | MEDIUM | Specific demands documented below in "Arabic typography" section. |
| **Comprehension questions after each text (multiple-choice)** | "We can tell whether they understood it" is the Core Value (PROJECT.md). Without questions, app is just a digital book. | MEDIUM | Hand-authored question bank in v1 — typically 4–6 questions per text. MCQ is universal in kid-reading platforms (Raz-Kids uses 5–10 Qs). |
| **Immediate per-question feedback (correct/incorrect)** | Kids 5–12 need closed feedback loops to learn. Delayed feedback = no learning signal. | LOW | Show right answer, optionally show why. Don't let child re-attempt the same question (gameable). |
| **Session result screen ("you got X of Y")** | Closes the loop. Without it, the child has no sense of completion. | LOW | Simple. No badges, no streaks (v1) — just "you finished, you got X right." |
| **Progress persistence (child returns, finds where they left off)** | If child has to redo placement every session, the loop fails. Account = continuity. | LOW | Database-backed. Last-read state, current level, completed texts list. |

### Tier B — Category Table Stakes (deferred to v2+, but expected in mature product)

| Feature | Why Expected (eventually) | Complexity | Defer Rationale |
|---------|---------------------------|------------|-----------------|
| **Parent dashboard (progress, level history, weak areas)** | Every competitor has this — it's how the *paying* user (parent) sees value. Raz-Kids, Lexia, Epic! all ship this. | MEDIUM | Per PROJECT.md: "the loop must work before reporting matters." If learning model doesn't actually teach, dashboards make it visible. Defer to v2. |
| **Gamification (stars, badges, streaks, levels-up animation)** | Raz-Kids' "robots" rewards, Lalilo's progress map, Epic!'s reading goals. Kids expect *some* extrinsic motivation. | MEDIUM | Per PROJECT.md, deliberate defer. Add only *after* the reading model proves it teaches. Easier to add engagement to working learning than to fix learning under shipped engagement. |
| **Audio narration / read-aloud** | Raz-Kids' core feature is narrated books with word-highlighting. Foundational for pre-readers / struggling readers. | HIGH | Phase 2 in business plan. v1 ships text-only. Audio means voice actors (cost) or TTS (Arabic TTS quality for kids is uneven). |
| **Word-tap definitions / vocabulary popovers** | Lexia, Raz-Kids, Epic! all let kids tap unknown words for help. Key affordance for "stretch" reading. | MEDIUM | Genuinely useful but not loop-critical. Adds a per-word dictionary asset. Defer to v2 once a real content library demands it. |
| **Mobile native apps (iOS / Android)** | Reading apps are heavily used on tablets at home. Industry norm. | HIGH | Per PROJECT.md: deliberate post-v1. Web-first cuts compliance surface (no kids' app store reviews). |
| **Subscription billing / family plan** | Business plan revenue model. Parents won't long-term use a free product they don't trust to persist. | MEDIUM | Per PROJECT.md: "v1 validates the product, not the monetization." |
| **Larger content library (50–100+ texts per level)** | Mature product needs library breadth — kid burns through 8 stories in a day. | HIGH (content) / LOW (eng) | Engineering ships level upload. Content sourcing is the real cost. |
| **Constructed-response / open-ended comprehension** | Raz-Kids includes a constructed-response Q on theme. Higher-fidelity comprehension signal than pure MCQ. | HIGH | Requires teacher review or AI grading — neither is v1 scope. MCQ is sufficient for thin-slice validation. |
| **Running-record / oral reading recording** | Raz-Kids' three-part assessment (read aloud → retell → MCQ). Gold standard for reading-behavior measurement. | HIGH | Requires audio recording + storage + (eventually) teacher review or ASR. v2+. |
| **Verifiable parental consent flow for under-13 standalone child accounts** | If product ever lets children sign up directly, COPPA-required. | HIGH | Per PROJECT.md, sidestepped entirely by parent-owned account model. Only revisit if business model changes. |

### Tier C — Differentiators (Qira's competitive bets)

These are features where Qira can *specifically* be better than (a) English-equivalent competitors that don't speak Arabic, and (b) generic Arabic learning apps that don't do leveled reading.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Native RTL-first architecture (not LTR with RTL patched on)** | Every Arabic learning app suffers from "LTR mirror" feel — directional icons wrong, line-height too tight, fonts not designed for Arabic body text. Qira gets this right from day one. | MEDIUM | Per PROJECT.md decision: architectural, not a feature. Affects layout, icon mirroring, scroll direction, hit zones, animation directionality. Already de-risked at decision level. |
| **Tashkeel-on-by-default, with toggle for advanced readers** | Children's Arabic education *requires* tashkeel (harakat/diacritics) for correct pronunciation; advanced readers find it cluttering. No English-equivalent has this concept. | MEDIUM | Source content is authored with tashkeel; CSS / display layer can strip on toggle. Default ON for early levels, optional from Level ~12+. |
| **Arabic-native leveling scale (Qira Levels 1–20)** | No standardized framework exists (Lexile has Miqyas Al Dhad, but it's licensed via MetaMetrics × Alef Education and not openly available). Qira owns its own scale calibrated to its own content. | HIGH (research / pedagogy) / LOW (eng) | See "Arabic placement design" section. Defining the scale = head of content's job; engineering only assigns levels to texts and children. v1 fixes Levels 1–20 as a metadata field — refinements can re-level texts later. |
| **Kid-readable Arabic typography system (font + size + line-height + tashkeel rendering)** | Arabic body text needs 1.6–1.8× line-height vs 1.4–1.5× for Latin; many Arabic fonts render tashkeel poorly at body sizes. Qira commits to a vetted font stack for children. | MEDIUM | See "Arabic typography" section. Likely Noto Sans Arabic, IBM Plex Sans Arabic, Cairo, or Tajawal — needs designer review with tashkeel test cases. |
| **Comprehension questions written *for Arabic*, not translated from English** | Most Arabic edtech uses translated English questions, which often have stilted phrasing or culturally-off content. Qira authors natively in Fusha. | HIGH (content) | Engineering scope: question bank schema. Content scope: actually writing them. Distinguish from generic translated content the way Khan Academy Arabic differs from Khan Kids translated. |
| **Fusha-only commitment (no diglossia mixing)** | Avoids the trap most Arabic-language products fall into: Ammiyya UI labels, Fusha body content. Confuses learners and undermines literacy. | LOW | Architectural commitment, not feature. UI strings and content both Fusha. |
| **Deterministic placement (no AI black box)** | Parents distrust opaque AI placement, especially for Arabic where they doubt the model speaks it well. Rules-based placement is *explicable*: "child got X/Y at Level N, so we placed them at Level N." | LOW (vs HIGH for AI) | Per PROJECT.md decision. Inverse-differentiator: every English competitor is leaning AI; Qira leans the other way intentionally for v1. |

### Tier D — Anti-Features (Deliberately Not Built)

| Anti-Feature | Why Requested / Tempting | Why Problematic | Alternative |
|--------------|-------------------------|-----------------|-------------|
| **Daily streak counter (Duolingo-style)** | Massive proven retention lever; 7-day streaks 3.6× completion in Duolingo data. | Streaks on children = guilt manipulation. Duolingo is named in the "Deceptive Patterns" registry for streak-shame design. UK Age-Appropriate Design Code explicitly calls out "nudge settings" that exploit children. Streaks teach kids to read for the streak, not for understanding — the *opposite* of Qira's value prop. | If engagement signal is needed in v2: *reading goals* the parent sets, not streaks the app enforces. Or weekly summaries, not daily guilt. |
| **AI-generated comprehension questions in v1** | "Auto-generate at scale" sounds like product magic. | Arabic LLM question generation is academically nascent (limited Arabic QG training data per Frontiers / arXiv). Hallucinated questions = teaching kids wrong things in Arabic. Per-user inference cost destroys unit economics before product is validated. | Hand-author questions for the seed library. Revisit AI-QG in v2 when content needs scale AND moderation pipeline exists. |
| **AI placement quiz / adaptive engine in v1** | Lexia and Raz-Kids both do this; sounds modern. | Same Arabic-LLM problem + opacity. Parents and teachers can't audit "why was my child placed at Level 4?" if the answer is "model said so." | Deterministic rules: child takes a fixed-form pre-test, score → level. Explicable. Auditable. Wrong-but-fixable. |
| **Ads / ad-supported tier** | "Free version" is industry standard in kid apps. | Ads to under-13s violate COPPA's behavioral-advertising provisions; UK AADC explicitly bars exploitative ads. Reputation damage in a parent-trust-driven market. | Family-plan freemium model (per business plan): N free texts, paid for full library. No ads ever. |
| **In-app purchases for cosmetic items (skins, themes, characters)** | Lucrative in kid games. | Dark Patterns of Cuteness research (ResearchGate, 2024) identifies cute-character IAP as autonomy-harming for children. Confuses learning product with game. | None. Just don't. |
| **Endless-scroll content feed / autoplay next text** | Increases session time. | Attention-trap pattern; UK AADC discourages. Reading should end at the end of the story, not pull the child to the next one. | Explicit "what's next?" prompt with parent-visible reading goal. |
| **Push notifications nagging the child to return** | Drives DAU. | Targeting under-13s with notifications is restricted under UK AADC and ICO guidance. Also: phone-pinging children is socially unacceptable to most parents in the diaspora-parent target segment. | Email summaries to *parents*, not children. Once weekly max. |
| **Voice/video chat, social features, leaderboards between children** | Engagement / community. | COPPA + AADC compliance nightmare. Comparison stress on struggling readers. | None for v1. If ever, sibling-only or family-only ranking — never public. |
| **Animated mascot that emotionally reacts to performance (cry/sad)** | Duolingo owl, Khan Kids — proven engagement. | "Dark Patterns of Cuteness" (Hundley & Tulu 2024) flags emotional-character manipulation as risk to child autonomy. Sad mascots teach kids that *missing a session = hurting someone*. | Neutral progress indicator. A character is fine — a *guilting* character is not. |
| **Difficulty selector ("easy mode")** | Sounds kid-friendly. | Conflicts with the whole product premise: child is at the level the placement assigned, full stop. Letting them pick "easy" defeats leveling. | Re-take placement if level feels wrong (parent-initiated). |
| **Cancel-flow friction / hidden subscription cancel** | Epic! is explicitly flagged in Screenwise / Common Sense Media reviews for hard-to-cancel subscriptions. | Dark pattern. Reputation poison. UK AADC adjacent. | Cancel in one tap from account settings. Even when monetization ships in v2+. |
| **Account merge across providers (email + Google linking)** | "Power-user" feature. | Adds significant auth complexity for ~0 v1 user benefit. Single-provider per parent is fine. | Parent picks one. If they pick wrong, support email. |

---

## Arabic-Specific Layer (called out separately)

This section exists because the question explicitly asked for it — these are demands a *Raz-Kids-equivalent in English* doesn't have.

### Arabic Typography Requirements (children-specific)

| Concern | Decision | Source |
|---------|----------|--------|
| **Tashkeel (diacritics) on text** | ON by default for Levels 1–10; toggle to OFF available from Level 11+. Children's Arabic books universally include tashkeel; adult/advanced texts drop it. | Multiple Arabic typography sources confirm tashkeel is essential for child readers; matches publishing convention for kids' books. |
| **Line-height for body text** | Minimum 1.8× (vs ~1.5× for English). | Multiple RTL design guides (aivensoft, conveythis, codeguru) converge on 1.6–1.8 for Arabic body, especially with diacritics. |
| **Font weight floor** | 400 minimum for body, 600+ for headings. Light weights (300) are unreadable in Arabic on screens. | Arabic typography guides agree; Latin can go lighter, Arabic cannot. |
| **Font size baseline** | Arabic glyphs are smaller than Latin at same px size — start ~10–15% larger than equivalent English app. | RTL design sources. |
| **Font choice (candidates)** | Noto Sans Arabic, IBM Plex Sans Arabic, Cairo, Tajawal — all have good tashkeel rendering. Avoid display fonts (Amiri, Reem Kufi) for body. | Designer review needed; vetted by Arabic font handle/tashkeel correctness test. |
| **Tashkeel rendering quality** | Some fonts collide diacritics with letters at body sizes — must be QA'd with actual children's content samples. | Typography sources note this as a known issue requiring per-font verification. |
| **Numeric digits** | Decide: Eastern Arabic numerals (٠١٢٣) or Western Arabic numerals (0123). Conventional in modern children's Arabic education is Western Arabic numerals; Eastern is older/regional. | Design decision; flag in UI phase. |

### Arabic Placement Design (without a pre-existing Lexile)

The challenge: English has Lexile / Guided Reading Levels / DRA. Arabic does not have a freely available equivalent. Miqyas Al Dhad (MetaMetrics × Alef Education, 2024) is the only production framework and it's licensed/proprietary.

**Implication for Qira:** Qira must *define its own* Levels 1–20 scale calibrated to its own content. This is fine — it's how Raz-Kids' "AA→Z" levels work too (they're proprietary to Learning A-Z, not Lexile).

**Recommended v1 approach (rules-based, per PROJECT.md):**

1. **Content side:** Head of content (or first contractor) defines what each of Levels 1–20 *looks like* via text-complexity markers:
   - Sentence length (mean words per sentence)
   - Vocabulary frequency band (high-frequency Fusha vs. literary Fusha)
   - Sentence structures (simple subject-verb-object → embedded clauses → metaphor)
   - Topical complexity (concrete familiar → abstract unfamiliar)
   - Tashkeel density (full → partial → none)
   - Text length (50 words → 800+ words)
2. **Placement quiz side:** Child reads short calibration passages at staggered levels and answers 2–3 MCQ comprehension per passage. Adaptive *only in the discrete sense* — score determines next passage band. ~15 questions total over 4–6 passages.
3. **Final level assignment:** Rule like "highest level at which child scored ≥66%" — mirrors Lexia Core5's threshold (66–89% = "moderate proficiency, place here"; ≥90% = "advance"; ≤65% = "step down").

**What NOT to do in v1:**
- Don't claim Lexile-equivalence ("our Level 8 = Lexile 600L"). You don't have the psychometric calibration to back that.
- Don't expose the Level numbers without anchoring them to *grade bands* parents understand ("Level 6 = roughly end of Grade 1").
- Don't make the placement so long it bores a 6-year-old. Lexia caps at ~11 min for K-5; aim for ~10–15 min.

### Arabic Comprehension Question Categories

Standard reading-comprehension research recognizes three levels (Lexia, Reading Rockets, Read Naturally): **literal**, **inferential**, **evaluative**. Plus two cross-cutting categories: **vocabulary** and **prediction**.

**All five translate to Arabic, but with weighting shifts:**

| Category | English Weight | Recommended Arabic Weight | Why the Shift |
|----------|----------------|----------------------------|---------------|
| **Literal / Recall** | ~30–40% | ~30% | Same. "What did X do?" works identically. |
| **Vocabulary** | ~15–20% | **~25–30%** (bump up) | Research (Frontiers 2024, Arabic vocabulary studies) shows vocabulary is the **strongest predictor** of Arabic reading comprehension — stronger than in English, because of diglossia (child knows the word in spoken dialect, must confirm Fusha form). Lean into this. |
| **Inferential** | ~25–30% | ~25% | Same — universal cognitive skill. Cultural framing of inferences must be Arab-context (not "the snowman melted in spring" — the kid may have never seen snow). |
| **Prediction** | ~10% | ~10% | Same. "What do you think happens next?" works the same way. |
| **Evaluative / Theme** | ~10% | ~10% | Same; but moral/cultural framing of stories may be more central in Arabic-language children's literature (didactic tradition). |

**v1 recommendation:** Stick to **literal, vocabulary, inferential** (the three most pedagogically defensible). Add prediction and evaluative in v2 when constructed-response is supported. MCQ format for all v1 questions; vocab questions = "what does the word X mean?" with 4 options.

**Sample question shapes for v1 question bank:**
- *Literal:* "Where did Sara go?" (4 options drawn from text)
- *Vocabulary:* "What does the word [مفردة] mean in this story?" (4 synonyms/glosses)
- *Inferential:* "How was Ahmad feeling at the end?" (4 emotion options, none stated explicitly in text)

---

## Feature Dependencies

```
[Parent Auth (email+OAuth)]
    └──requires──> nothing else; everything depends on it
         |
         v
[Child Profile under Parent]
    └──requires──> Parent Auth
         |
         v
[Profile Picker]
    └──requires──> Child Profile
         |
         v
[Placement Assessment]
    └──requires──> Child Profile (to write the level back to)
    └──requires──> Calibration passages + question bank (CONTENT)
    └──requires──> Arabic Reader component (passages displayed in it)
         |
         v
[Level assigned to Child Profile]
         |
         v
[Library Browse, filtered by level]
    └──requires──> Level on profile
    └──requires──> Texts in DB tagged by level (CONTENT)
         |
         v
[Reader experience (text display, RTL, typography)]
    └──requires──> Library text selection
    └──requires──> Arabic typography decisions made
         |
         v
[Comprehension Question Flow]
    └──requires──> Text completion
    └──requires──> Per-text question bank (CONTENT)
         |
         v
[Per-question Feedback + Result Screen]
    └──requires──> Question answers
         |
         v
[Progress Persistence]
    └──requires──> Child Profile + completed-texts table
```

### Dependency Notes

- **The Arabic Reader component is reused by both the placement assessment and the regular reading flow.** Build it once, not twice. Both display Arabic Fusha text with tashkeel and the same typography rules.
- **The content workstream is in the critical path of three features:** placement passages, library texts, and per-text question banks. Engineering can ship empty containers; product cannot demo until content exists. Treat content as a parallel deliverable, not an afterthought.
- **Tashkeel toggle conflicts with v1 scope** if Levels 11+ aren't in the seed library. Build the *infrastructure* for the toggle (data + rendering) but the toggle UI itself can be hidden until levels 11+ exist.
- **Parent dashboard depends on data already being collected.** v1 must *persist* level history, completed texts, and quiz scores even though it doesn't *display* them. This is the cheapest way to make v2 dashboards possible without retroactive backfill.

---

## MVP Definition

### Launch With (v1 — thin slice)

These map 1:1 to PROJECT.md's Active requirements:

- [ ] **Parent email/password + Google OAuth signup** — lawful basis under COPPA / GDPR-K
- [ ] **Parent creates child profile(s)** — one parent, N children
- [ ] **Child profile picker on entry** — kid selects "their face"
- [ ] **Rules-based placement assessment** — 4–6 staggered passages, ~15 MCQ, places Level 1–20
- [ ] **Library browse filtered to child's level** — seed library of ~8–15 texts (engineering ships the surface; content team fills it)
- [ ] **Kid-friendly Arabic reader (RTL, Fusha, tashkeel-on, vetted typography)** — the actual reading surface
- [ ] **Hand-authored comprehension MCQs (literal + vocab + inferential)** — 4–6 per text
- [ ] **Per-question feedback + session result screen** — closes the loop
- [ ] **Progress persistence** — child returns to same profile, same level, last-read state

### Add After Validation (v1.x — between MVP and v2)

Triggered by "loop is validated, learning model demonstrably works":

- [ ] **Parent-facing weekly email summary** — low-effort signal-of-value to the paying user without building a full dashboard
- [ ] **Re-take placement flow** — for the inevitable "level feels wrong" feedback
- [ ] **Content library expansion to 30+ texts** — bigger seed library at top-N most-used levels
- [ ] **Tashkeel toggle (UI surface)** — turn on the existing infrastructure once high-level content exists
- [ ] **Reading goal setting (parent picks)** — explicitly *not* streaks; weekly text counts

### Future Consideration (v2+)

Per PROJECT.md Out-of-Scope and business plan Phase 2:

- [ ] **Parent / teacher dashboards** — full progress reporting
- [ ] **Gamification (badges, level-up animations)** — *if and only if* the loop is proven to teach
- [ ] **Audio narration with word-highlighting** — Raz-Kids' anchor feature
- [ ] **AI read-aloud / pronunciation correction** — Phase 2 in business plan
- [ ] **AI question generation + Arabic content moderation pipeline** — once content scale demands it
- [ ] **Word-tap dictionary / vocabulary popovers**
- [ ] **Constructed-response questions** (open-ended retell)
- [ ] **Native mobile apps (iOS / Android)**
- [ ] **Subscription billing + family plan**
- [ ] **School / B2B portal** — Year-2 per business plan
- [ ] **Multilingual content** (English, French, Urdu) — Year-2+
- [ ] **Diglossia / Ammiyya support** — explicit v2+ problem

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Parent auth + Google OAuth | HIGH | LOW | **P1** |
| Child profile + picker | HIGH | LOW | **P1** |
| Rules-based placement assessment | HIGH | HIGH (rules + content) | **P1** |
| Arabic Reader component (RTL, typography, tashkeel) | HIGH | MEDIUM | **P1** |
| Library browse (filtered) | HIGH | LOW | **P1** |
| Comprehension MCQ flow + feedback | HIGH | MEDIUM | **P1** |
| Result screen | MEDIUM | LOW | **P1** |
| Progress persistence | HIGH | LOW | **P1** |
| Tashkeel toggle UI | MEDIUM | LOW | P2 (infra in P1) |
| Parent weekly email | MEDIUM | LOW | P2 |
| Re-take placement | MEDIUM | LOW | P2 |
| Parent dashboard | HIGH (eventually) | HIGH | P3 |
| Gamification system | MEDIUM | MEDIUM | P3 |
| Audio narration | HIGH | HIGH | P3 |
| AI question generation | MEDIUM | HIGH | P3 |
| Native mobile apps | HIGH | HIGH | P3 |
| Subscription billing | HIGH (revenue) | MEDIUM | P3 |

**Priority key:**
- **P1**: Required for v1 launch — without these the loop doesn't work
- **P2**: Add after v1 validates; low cost / medium value
- **P3**: v2+ — deferred per PROJECT.md decisions or business plan phasing

---

## Competitor Feature Analysis

| Feature | Raz-Kids | Lexia Core5 | Epic! | Lalilo | Qira (planned) |
|---------|----------|-------------|-------|--------|----------------|
| **Language** | English | English | English | English (K-2) | **Arabic (Fusha)** |
| **Leveling scale** | 29 proprietary levels (AA → Z2) | Proprietary level grid | Age-band filter (no fine leveling) | Phonics-skill-based, K-2 | **20 proprietary levels, grade-aligned** |
| **Placement** | "Reading Placement Tool" ~20 min; *not* an assessment per their docs — initial seeding only | Auto Placement ~11–20 min; 90%/66%/65% thresholds | Age at signup only | Adaptive diagnostic | **Rules-based, ~10–15 min, deterministic scoring** |
| **Comprehension Qs** | 5–10 MCQ per book + 1 constructed-response | Embedded in lessons | Per-book quizzes (Reading Eggs partnership) | Phonics-checks, not deep comprehension | **4–6 MCQ per text, literal+vocab+inferential** |
| **Audio narration** | Yes, with word-highlighting | Yes | Yes (read-to-me) | Yes | **No (v2+)** |
| **Gamification** | Star/robot rewards, avatar | Mascot, level-up | Reading streaks, badges | Map progression, monster mascot | **None in v1 (deliberate)** |
| **Parent/teacher dashboard** | Yes (teacher-focused) | Heavy reporting (school-focused) | Parent dashboard | Teacher dashboard | **None in v1 (deliberate)** |
| **Pricing model** | School license + home subscription | School-license-dominant | $9.99/mo + family plan | Free school version + Renaissance bundle | **Family plan $9.99–14.99/mo (v2+)** |
| **Mobile apps** | iOS + Android (Kids A-Z) | iOS | iOS + Android | Web + iOS | **Web only v1; mobile v2+** |
| **Dark patterns flagged** | Hard-to-cancel reported | Less B2C, less flagged | Cancel-friction repeatedly flagged | Minimal | **Explicitly avoided** |
| **Right-to-left text** | N/A | N/A | Limited (some Arabic books listed) | N/A | **Native RTL architecture** |
| **Tashkeel handling** | N/A | N/A | N/A | N/A | **Toggle, default ON for low levels** |

**Qira's distinctive shape:** The *only* row in this table where Arabic is the leveled, comprehension-focused first-class language. Competitors that have *any* Arabic content (Epic!) treat it as a translated-content add-on, not an architecture choice.

---

## Open Questions for Downstream Phases

These could not be resolved at research time and should be flagged for later phases:

1. **Which specific Arabic font** passes the tashkeel-rendering / child-readability test? Designer evaluation needed in UI phase. (Top candidates: Noto Sans Arabic, IBM Plex Sans Arabic, Cairo, Tajawal.)
2. **Eastern (٠١٢٣) vs Western (0123) numerals** in UI and content — convention varies by region; diaspora preference may be Western. Decide in UI phase.
3. **Exact text-complexity dimensions** that define each of Levels 1–20 — head-of-content / pedagogy work, not engineering. v1 can ship with a working draft; refinements re-level texts later.
4. **Question bank size for v1 placement assessment** — minimum count of calibration passages needed for the rules to discriminate accurately. Likely 4–6 passages × 2–3 Qs = ~15 Qs total, but should be piloted.
5. **Whether to allow child re-attempts** on comprehension Qs — pedagogically valuable but gameable. Default: no re-attempts within a session; can re-read the text.
6. **Whether the placement assessment displays tashkeel** — it should, because v1 placement is over the early-levels range. Confirm.

---

## Sources

### English-language competitor analysis (HIGH confidence — official docs and reviews)
- [Raz-Kids Reading Placement Tool & Assessment](https://help.learninga-z.com/en/articles/7025909-determining-a-student-s-reading-level-in-raz-kids) — Reading Placement Tool ~20 min; three-part assessment (read-aloud, retell, MCQ); 5–10 Qs per book
- [Raz-Kids vs Reading A-Z product differences](https://help.learninga-z.com/en/articles/12454042-what-are-the-differences-between-reading-a-z-raz-kids-raz-plus-and-foundations-a-z)
- [Lexia Core5 Auto Placement specs](https://www.lexialearningresources.com/core5/licensed/mylexia_reports_references/Core5AutoPlacement.pdf) — Six reading instruction aspects; ~11 min average placement; 90%/66%/65% thresholds
- [Lexia Core5 Common Sense Education review](https://www.commonsense.org/education/reviews/lexia-core5-reading)
- [Epic! Common Sense Media review and dark-pattern flags](https://www.commonsensemedia.org/app-reviews/epic-kids-books-and-videos)
- [Epic! Screenwise review — cancel-friction dark pattern](https://screenwiseapp.com/media/epic-kids-books-and-videos-app)
- [Lalilo product description (Renaissance)](https://www.renaissance.com/products/practice-instruction/lalilo/) — Adaptive phonics K–2

### Arabic-specific (MEDIUM-HIGH confidence)
- [Miqyas Al Dhad Arabic reading scale announcement](https://metametricsinc.com/about-us/news/metametrics-and-alef-education-expand-leadership-of-arabic-literacy-initiative-powered-by-the-lexile-framework-for-reading/) — First Lexile-equivalent for Arabic, licensed/proprietary via MetaMetrics × Alef Education
- [RTL Arabic web design — line height 1.6–1.8 for body](https://aivensoft.com/en/blog/rtl-arabic-website-design-guide)
- [Arabic Web Design UX considerations (extradigital.co.uk)](https://www.extradigital.co.uk/articles/design/elements-arabic-web-design/)
- [Arabic Diacritics for Children — necessity in children's materials](https://typeforyou.org/diacritics-in-the-arabic-script-and-typography/)
- [Tashkeel guide — diacritics essential for child/non-native readers](https://kalimah-center.com/arabic-harakat-tashkeel-diacritics/)
- [Vocabulary as strongest predictor of Arabic reading comprehension](https://www.frontiersin.org/journals/communication/articles/10.3389/fcomm.2022.984340/full)
- [Lexico-phonological and diglossic distance impact on Arabic kindergartener comprehension](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2024.1394024/full)
- [Limitations of reading Fusha to young children](https://www.academypublication.com/issues2/tpls/vol09/02/01.pdf)

### Comprehension question pedagogy (HIGH confidence)
- [Lexia: 3 Types of Reading Comprehension (literal, inferential, evaluative)](https://www.lexialearning.com/blog/3-types-of-reading-comprehension-compared-inferential-literal-and-evaluative)
- [Reading Rockets — Inferencing for children](https://www.readingrockets.org/classroom/classroom-strategies/inferencing)
- [Read Naturally — Comprehension five components](https://www.readnaturally.com/research/5-components-of-reading/comprehension)

### Dark patterns & kid-app ethics (HIGH confidence on regulatory framing, MEDIUM on specific products)
- [UK ICO Age-Appropriate Design Code (Children's Code)](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/) — Bars dark patterns and exploitative nudges for children
- [IAPP — Reconciling AADC with COPPA](https://iapp.org/news/a/reconciling-the-age-appropriate-design-code-with-coppa)
- [Deceptive Patterns registry — Duolingo](https://www.deceptive.design/brands/duolingo) — Streak-shame and IAP currency obfuscation flagged
- [Dark Patterns of Cuteness — Popular Learning App Design as a Risk to Children's Autonomy (Hundley & Tulu, 2024)](https://www.researchgate.net/publication/378448656_Dark_Patterns_of_Cuteness_Popular_Learning_App_Design_as_a_Risk_to_Children's_Autonomy)
- [UX Magazine — Hot Streak Game Design](https://uxmag.com/articles/the-psychology-of-hot-streak-game-design-how-to-keep-players-coming-back-every-day-without-shame) — Even pro-streak source acknowledges shame-design risk

### Child profile / kid-login UX patterns (HIGH confidence)
- [YouTube Kids profile picker model](https://support.google.com/youtubekids/answer/7554914?hl=en) — Parent-created profiles, child taps avatar to enter

---

*Feature research for: Qira — Arabic-first kid leveled reading platform (v1 thin-slice)*
*Researched: 2026-05-14*
