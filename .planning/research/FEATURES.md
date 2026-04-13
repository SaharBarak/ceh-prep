# Feature Research — CEH Prep SaaS Monetization

**Domain:** Paid certification exam prep SaaS (B2C, single-cert vertical — CEH v13)
**Researched:** 2026-04-13
**Scope:** Gap analysis vs mature paid competitors. The app already has: 14-day typed curriculum, 70 domain-tagged quiz questions, dashboard, course runner, 125Q/4h exam simulator, progress tracking, Argon2id local auth. This file covers only what's MISSING to make it a credible paid product.
**Confidence:** HIGH for table stakes (cross-verified across Boson, Pocket Prep, CertMaster, Brainscape, RevenueCat, Paddle docs); MEDIUM for differentiators (depends on positioning); HIGH for anti-features (consistent cautionary patterns across sources).

---

## Competitive Baseline (what we're measured against)

| Competitor | Positioning | Price | Key feature we lack |
|------------|-------------|-------|---------------------|
| **Boson ExSim-Max for CEH** | Harder-than-real questions with best-in-class explanations | $99–$199 one-time | Deep per-question explanations, domain heatmap, review mode |
| **CompTIA CertMaster-style** | Official, adaptive, curriculum-aligned | $149/cert | Adaptive difficulty, structured learning paths |
| **Pocket Prep** | Mobile-first, gamified, community leaderboards | $19.99/mo or $79.99/yr | Mobile UX, spaced repetition, leaderboards, weakness detection |
| **Brainscape** | Confidence-based repetition flashcards | Subscription | Flashcards, confidence self-rating, deep sync |
| **OpenExamPrep** | Free + AI tutor CEH questions | Free | AI explanations (deliberately deferred in our scope) |
| **Skillcertpro / ExamCert / ExamTopics** | Question banks / dumps | Varies | Volume of questions (we have 70; they have 500–3000+) |

**Verdict:** We compete on (1) curated 14-day sprint structure, (2) taste-skill UX, (3) security-first architecture (defensible against the audience). We must not try to out-question-bank Pocket Prep or out-explain Boson. We must avoid feeling like a "half-built app" relative to those products.

---

## Feature Landscape

### Table Stakes (Users Leave or Refuse to Pay If Missing)

Features users assume exist in any paid cert-prep product. Missing any of these is a conversion killer or churn driver.

| # | Feature | Why Expected | Complexity | Touches |
|---|---------|--------------|------------|---------|
| **Billing & Monetization** |
| 1 | Paddle overlay checkout with client-side tokenization | User-expected friction-free purchase; Paddle handles VAT/sales tax globally | M | New: `lib/billing/paddle.ts`, `app/(app)/pricing/checkout`, `components/CheckoutButton` |
| 2 | Webhook handler with signature verification + idempotency (event-id dedupe in Mongo) | Without this, double-charges / missed upgrades / webhook replays break billing | M | New: `app/api/webhooks/paddle/route.ts`, `db/models/billing-event.ts` |
| 3 | Self-serve customer portal link (Paddle Customer Portal) for cancel / update payment / invoices | Forcing users to email support to cancel is now a dark-pattern red flag; Paddle ships this for free | S | New: `app/(app)/settings/billing/page.tsx` — just a redirect + link |
| 4 | Subscription status sync (active / past_due / canceled / paused) into User doc | Tier gate must reflect real billing state, not intent | M | Extend: `db/models/user.ts` adds `subscription: { status, paddleId, currentPeriodEnd }`, webhook writes it |
| 5 | Pricing page with recommended tier highlighted + monthly/annual toggle | UX studies show unhighlighted pricing pages convert 22% worse; annual default lifts annual adoption 19% | S | Extend existing `/pricing` — add annual toggle, highlight Pro, add per-day price math |
| 6 | Paywall redirect with clear "why upgrade" messaging on locked days + exam simulator | Hard paywalls convert 5x better than soft, but only when the value pitch is obvious at the wall | S | Extend tier gate: `course/[day]/page.tsx` and `exam/page.tsx` redirect to `/pricing?locked=day-4` with context banner |
| 7 | Post-checkout success page that confirms upgrade + deep-links to first locked day | Without it, users wonder "did my payment go through?" | S | New: `app/(app)/welcome/page.tsx` reads webhook-synced tier |
| 8 | Receipt / invoice email on successful charge | Users expect + legally required in most jurisdictions (Paddle sends these automatically as MoR — but we still must surface "view invoices" in settings) | XS | None (Paddle sends; just link to portal) |
| **Account / Identity** |
| 9 | Google OAuth sign-in | 60%+ of B2C SaaS signups are OAuth now; password-only signup is a friction tax | M | Already scoped in PROJECT.md Active — New: `lib/auth/google.ts` |
| 10 | Password reset via emailed token | Not having this means locked-out users churn silently | M | New: `lib/actions/password-reset.ts`, `db/models/password-reset-token.ts`, Resend integration |
| 11 | Email verification on signup | Blocks junk emails that can't receive notifications; reduces "I forgot my email" support | M | New: token gen + verification action, gate tier-changes on verified |
| 12 | Settings page: change email, change password, delete account | Account deletion is GDPR-required in EU; others are baseline hygiene | M | New: `app/(app)/settings/page.tsx` + server actions |
| 13 | "Resend verification email" button | Users who miss the first email and have no way to retrigger churn | XS | Same settings page |
| **Onboarding** |
| 14 | First-session flow: signup → "start day 1" CTA, skip dashboard scan | SaaS "aha moment" should arrive inside 5 minutes; products that do this get +40% 30-day retention | S | Extend signup action: redirect to `/course/1` not `/dashboard` on first login |
| 15 | Welcome email (day 0) with 14-day roadmap and study tips | Sets cadence expectation, kicks off email relationship | S | New: Resend template + post-signup trigger |
| 16 | Activation-moment tracking (first quiz answered, first day completed) | You can't improve what you don't measure; these are the funnel metrics | S | Extend audit log: add `first_quiz_answered`, `first_day_completed` events; new `ActivationModel` or query on existing progress |
| **Study Experience** |
| 17 | "Retake wrong questions only" mode on each day | Boson, Pocket Prep, every major cert app has this; without it, studying is linear-only | S | New: `course/[day]/wrong-only/page.tsx` reads progress.answers map, filters incorrect, reuses CoursePlayer with a filtered question set |
| 18 | Flag / bookmark a question for later review | Standard since Boson shipped it in 2005; users flag tricky questions during study | S | Extend `ProgressModel`: add `flagged: Set<number>` per day; new action `toggleFlag(day, idx)`; dashboard card "N flagged across all days" |
| 19 | Per-question explanation shown after answer (right or wrong) | Every competitor does this; the `why` is where learning happens; Boson explicitly markets this as their moat | M | Extend `days.ts` content type: every Question gets `explanation: string` field; backfill 70 existing + new questions; CoursePlayer renders after submit |
| 20 | Exam simulator review mode (post-exam walkthrough of every question with correct answer + explanation) | This is THE feature of Boson ExSim; without it, the exam simulator is a scoring machine not a learning tool | M | New: `exam/[attemptId]/review/page.tsx`; new `ExamAttemptModel { userId, questions[], answers[], score, finishedAt }` to persist attempts (currently appears to be ephemeral) |
| 21 | Exam attempt history with score trend | Users want to see "am I improving?" across multiple attempts | S | Same `ExamAttemptModel`; dashboard widget reads last N attempts |
| 22 | Domain breakdown heatmap (score per CEH v13 module on each exam attempt + on aggregate progress) | Every serious competitor has this; the CEH exam has 20 modules, and identifying weak domains is the #1 study optimization | M | Tag each question with `domain: CehDomain`; aggregate in a selector; new `DomainHeatmap` component on dashboard + exam review |
| **Analytics / Dashboard** |
| 23 | Progress dashboard that shows: days completed, current streak, accuracy %, time spent, weakest domain | Pocket Prep / Brainscape have these as cards on their home screen; it's the "progress visible" loop that makes learning feel rewarding | S | Extend existing dashboard — add cards; most data is already in ProgressModel |
| 24 | Exam readiness indicator (pass probability estimate based on accuracy on recent 125Q mock) | Users want a number that tells them "ready / not ready"; competitors use simple heuristics (`avg last 3 mocks ≥ 80%` etc.) | S | Pure function over ExamAttemptModel; render as gauge |
| **Support / Help** |
| 25 | Help / FAQ page with common questions (billing, cancellation, exam day, technical) | Every paid product has one; users check it before emailing | S | New: `app/(marketing)/help/page.tsx` with MDX or static content |
| 26 | Contact / support email link (`support@ceh-prep.app`) in footer + settings | Users must have a way to reach you; absence signals "scam" | XS | Resend + inbox; just a mailto link for v1 |
| 27 | Visible refund policy on pricing page | Paddle requires it; users won't pay without knowing the out | XS | Add section to `/pricing` |
| **Trust / Legal** |
| 28 | Terms of Service + Privacy Policy pages, linked from signup + footer | Legally required (GDPR, CCPA); Paddle won't approve your account without them | S | New: `app/(marketing)/terms/page.tsx`, `/privacy/page.tsx` |
| 29 | Cookie consent banner for EU visitors (if analytics added) | GDPR; if you track, you must ask | S | Only needed if analytics added — defer if skipping analytics in v1 |
| **Mobile / Responsive** |
| 30 | Fully responsive layouts (≥360px up) — course runner, exam simulator, dashboard all usable on phone | Mobile is 50%+ of web traffic; a broken phone layout is an instant close | M | Audit + fix existing pages; CoursePlayer and Exam are the highest risk |

---

### Differentiators (Worth Shipping in v1 If Cheap)

These are where we can win on taste and curation without blowing scope. Ordered by value/cost ratio.

| # | Feature | Value Proposition | Complexity | Touches |
|---|---------|-------------------|------------|---------|
| D1 | **Leitner-style spaced repetition over flagged + wrong questions** (5-box system, cards resurface per the classic Leitner intervals: 1d, 2d, 4d, 8d, 16d) | Every research source flagged SRS as the single highest-ROI study technique; we already have the data (wrong answers in progress doc); wrapping it in a Leitner queue turns a linear 14-day sprint into an ongoing review habit that brings users back daily even after they finish day 14 | M | New: `lib/srs/leitner.ts` (pure fn), `db/models/srs-card.ts`, `app/(app)/review/page.tsx`; reuse CoursePlayer shell |
| D2 | **Study streak + "streak freeze" (2 free/month)** | Duolingo's data: 7-day streak → 3.6× retention; streak freeze cuts churn 21%; cheap to build with a daily cron + user field; huge emotional pull, matches the "14-day sprint" narrative | S | Extend User model: `streak: { count, lastActiveDate, freezes }`; daily cron (Vercel Cron) to decrement or freeze; dashboard widget |
| D3 | **Domain-tagged quiz filtering** ("give me 10 questions from Module 5: System Hacking") | Lets users drill weak domains identified by the heatmap; reuses existing questions with new presentation | S | New: `app/(app)/practice/page.tsx`; domain filter + random sampler from `days.ts`; requires questions to have `module` tag (backfill) |
| D4 | **Email drip: 14-day nudges + weekly "your weakest domain" summary** | Retention research shows 2–3 nudges/week with deep links significantly lifts week-2 and week-4 activity; we can customize each day's email with "you scored X on day Y yesterday, day Y+1 is waiting" | M | New: `lib/email/drip.ts`, Vercel Cron, Resend templates; needs unsubscribe compliance |
| D5 | **"Exam mode" toggle on regular practice** (hides explanations until all answered, enforces time per question, randomizes order) | Forces harder practice than the default "answer → see result" loop; closer to real exam conditions | S | CoursePlayer prop `mode: "study" \| "exam"`; already partly built in the 125Q simulator — extract logic |
| D6 | **Keyboard shortcuts** (1–4 for answer, Enter to submit, F to flag, ← → to navigate) | Power-user feature that serious learners love; trivial with React; differentiator vs. mobile-only competitors | XS | `useEffect` in CoursePlayer, visible "?" key opens shortcut overlay |
| D7 | **Export progress as PDF certificate of completion** (not an EC-Council cert, obviously — just "I finished the sprint") | Emotional closer; share-worthy on LinkedIn; drives referrals | M | New: `lib/pdf/certificate.ts` with `@react-pdf/renderer` or server-side Chromium; gated to pro + 100% completion |
| D8 | **Public progress badge URL** (`/u/[handle]/badge`) that shows anon progress count and streak | Social proof / referral surface; users can share without divulging PII | S | New page + slug on User model; opt-in |
| D9 | **Dark/light theme toggle (defaults to dark; current design is dark-only)** | Accessibility requirement for some users; trivial with CSS custom properties already in use | S | Extend existing design tokens; localStorage persistence |
| D10 | **Estimated time remaining per day** (e.g., "~22 min left on Day 4 based on your pace") | Users love effort visibility; reduces decision friction ("do I have time to start Day 5?") | S | Compute from avg time-per-question from past progress; client-side |

**Deliberately NOT listed as differentiators (defer):**
- AI tutor / Claude explanations — already out of scope per PROJECT.md
- Labs / sandboxes — CEH-specific hands-on would be cool but massively scope-expanding; competitors' labs are expensive and we don't ship infrastructure for it
- Community / leaderboards / forum — PROJECT.md explicitly excludes
- Multi-cert expansion (Sec+, OSCP, etc.) — scope creep before PMF
- Adaptive difficulty (CAT-style) — requires significant question-bank expansion AND an IRT model; premature optimization

---

### Anti-Features (Do NOT Build — Common Traps)

Features that look attractive but consistently damage cert-prep products. Each row is backed by specific failure patterns observed in competitors or cited in sources.

| # | Anti-Feature | Why It Looks Good | Why It's a Trap | What to Do Instead |
|---|--------------|-------------------|-----------------|---------------------|
| A1 | **Scraped question dumps / "exam dumps" content** | Easy way to inflate question count to 1000+ and compete with ExamTopics | Legally questionable (EC-Council aggressively DMCAs dumps); ethically problematic; killed Whizlabs' reputation; users just memorize answers; Google penalizes dump sites | Write original questions with original explanations; 150 high-quality > 3000 low-quality |
| A2 | **Unlimited retakes of the same mock exam until 100%** | Feels like a feature ("keep practicing!") | Users memorize question IDs instead of concepts; actually harms exam readiness; measurable anti-learning pattern | Randomize question order and pools on each attempt; track distinct-question accuracy separately from session score |
| A3 | **Live chat support widget (Intercom/Crisp)** | Looks professional | For a $30/mo product run by one person, it's a support-ticket firehose; users expect realtime response; most of what they ask is already in FAQ | `support@` mailto + FAQ page; add live chat only when you have a support team |
| A4 | **Native mobile app (iOS/Android)** | Competitors have them (Pocket Prep, Brainscape) | Already out of scope per PROJECT.md; App Store 15% cut on billing; two more platforms to maintain; responsive web covers 95% of the use case for a 14-day desktop-friendly sprint | Excellent mobile web + PWA install prompt on iOS/Android for "add to home screen" — 0 code, same UX |
| A5 | **Offline mode (IndexedDB content caching + bg sync)** | Feels like a quality signal | Enormous complexity (content sync, conflict resolution, stale progress state); almost no user actually needs it for a 30-min/day desktop study session; WiFi is ubiquitous where CEH students study | Accept online-only; future PWA with service worker cache is the lightweight upgrade path |
| A6 | **Forced 7+ day free trial with credit card up front** | Converts 66% when CC is captured | For a $30/mo product targeting students, CC-gating the trial kills top-of-funnel; PROJECT.md already decided on 3-day free *content* (days 1–3) without CC, which is the right move: prove value in 3 days, then hard paywall at day 4 | 3-day free content tier (already scoped), hard paywall at day 4, highlight "cancel anytime" on pricing |
| A7 | **Leaderboards / public score rankings** | Gamification lift | Competitive pressure discourages beginners who are already anxious about a hard exam; drives "rank farming" behavior that displaces actual learning; privacy concerns for security-industry users | Personal streaks + private progress; opt-in public badge (D8) for those who want visibility |
| A8 | **"AI explains this wrong answer" on every question (via LLM API)** | Differentiator language; users love AI | Cost per explanation (~$0.02) × high volume × $30/mo tier = margin destruction; explanations drift from authoritative sources; ethical + accuracy concerns for a security cert; PROJECT.md explicitly defers this | Ship human-written explanations (see table stakes #19); add AI *after* validating core product |
| A9 | **Referral rewards / discount codes / "get $5 for a friend"** | Growth hack | Adds billing complexity (Paddle supports discounts but you have to build the issuance flow), invites abuse (fake accounts for referral credit), and the audience (pro cybersecurity students) is not viral | Free tier as the referral vector; if you ship a public badge (D8), that's the share surface |
| A10 | **Multiple subscription tiers** ("Basic $15, Pro $30, Elite $75") | Price anchoring | For a one-cert product, tiering creates decision paralysis and makes the product feel enterprise-y; two tiers (Free / Pro) is the optimal shape for a single-cert vertical; higher tiers invite feature bloat | Free + Pro only (already scoped). Annual discount is the "tier" expansion |
| A11 | **"Pause subscription" flow in cancel UX** | Paddle supports it | Users who try to cancel should cancel; pause flows add complexity and rarely save churn; if they come back, they re-subscribe | Just offer resume-any-time as a re-entry; don't build the pause state machine |
| A12 | **Confetti animation / XP points / collectibles / mascots** | Duolingo's playbook | Duolingo's audience is casual language learners; CEH students are adults preparing for a $1200 professional exam; gamification that feels childish is a taste failure that will get ridiculed on r/CEH | Streaks + subtle progress indicators (we already have the taste-skill design system; don't break it with confetti) |
| A13 | **Forced onboarding quiz ("let's assess your level!") before first content** | Personalization signal | Adds friction before the aha moment; for a 14-day sprint, the sprint IS the path; assessment belongs at end of day 1 as a real quiz, not before any content | Signup → Day 1 CTA direct (see table stakes #14) |
| A14 | **"Save for later" notes-taking / personal note per question** | Users ask for it | Notes become an orphaned feature nobody maintains; users already have Obsidian/Notion for notes; scope expansion with no real differentiation | Flag/bookmark (D18) is the 95% solution; no notes |

---

## Feature Dependencies

```
Paddle Checkout (#1)
    └──requires──> Pricing Page w/ Checkout button (#5)
    └──requires──> User.subscription field (#4)
Webhook Handler (#2)
    └──requires──> User.subscription field (#4)
    └──requires──> BillingEvent model (dedupe)
    └──enables───> Subscription status sync (#4)
Customer Portal link (#3)
    └──requires──> Paddle Checkout (#1) [user must have a customer ID]
Settings page (#12)
    └──contains──> Change email/password, Delete account, Billing link (#3)
    └──enables───> Resend verification (#13)

Google OAuth (#9) ── independent ── can ship before/after billing
Password Reset (#10)
    └──requires──> Email sender (Resend config)
    └──requires──> PasswordResetToken model

Exam Attempt Model (new)
    └──enables───> Exam Review Mode (#20)
    └──enables───> Exam Attempt History (#21)
    └──enables───> Exam Readiness Indicator (#24)
    └──enables───> Domain Heatmap from mock exams (#22)

Per-question explanation field on Question type (#19)
    └──requires──> Backfill existing 70 questions with explanations
    └──enables───> Exam Review Mode (#20) [reviews need explanations]
    └──enables───> Retake Wrong mode being useful (#17)

Flag/Bookmark (#18)
    └──requires──> ProgressModel.flagged field
    └──enables───> Leitner SRS over flagged (D1)
    └──enables───> "Review flagged" mode

Domain tag on every Question
    └──requires──> Content type extension (CehDomain enum)
    └──enables───> Domain heatmap (#22)
    └──enables───> Domain-filtered practice (D3)

Email verification (#11)
    └──requires──> Resend
    └──requires──> EmailVerificationToken model
    └──enables───> Welcome email (#15)
    └──enables───> Email drip (D4)
    └──enables───> Password reset (#10) [share token infra]

Streak (D2)
    └──requires──> User.streak field
    └──requires──> Daily cron (Vercel Cron)
    └──enhances──> Dashboard (#23)
    └──enhances──> Email drip (D4) [send on streak-risk day]

Leitner SRS (D1)
    └──requires──> Flag/Bookmark (#18) [source material]
    └──requires──> Wrong-answer history (already in progress)
    └──requires──> SrsCard model
```

### Critical Dependency Notes

- **Per-question explanations (#19) gate three other table-stakes features** — exam review mode, retake-wrong mode, and ultimately learning value itself. This is the single highest-leverage content task. Must happen before or during the billing phase or the paid product is hollow.
- **ExamAttemptModel is net-new persistence** — current architecture implies the 125Q simulator is in-memory only. Multiple features (review, history, readiness indicator, aggregated heatmap) all branch from it. Ship the model early so features can stack on it.
- **Resend integration is shared infrastructure** — password reset, email verification, welcome email, drip, and transactional receipts all need it. Set up once, use everywhere.
- **Domain tags on questions are a content-layer refactor** — touches `lib/content/days.ts` types, all 70 existing questions, and the CoursePlayer/exam renderers. Cheap in code, but must be done carefully so validation doesn't drop any existing question.
- **Vercel Cron is a new runtime dep** — streaks, drip emails, "deactivate expired trials" all depend on it. Free tier covers a daily job.

---

## MVP Definition (Monetization Milestone)

### Launch With (v1 of the paid product)

The minimum set that makes this a credible $30/mo purchase. Ordered by build order.

**Phase α — Content integrity (unblocks everything else)**
- [ ] #19 Per-question explanations backfilled on all 70 existing questions — *without this, the paid product is "free but with more days"; explanations are the table stakes of cert prep*
- [ ] Domain tagging on every Question — *gates heatmap + filtered practice*
- [ ] ExamAttemptModel — *persistence for everything exam-simulator related*

**Phase β — Auth + account**
- [ ] #9 Google OAuth — *reduces signup friction*
- [ ] #11 Email verification + Resend config — *shared infra*
- [ ] #10 Password reset — *reuses token infra*
- [ ] #12 Settings page — *change email/password, delete account*

**Phase γ — Billing (the actual monetization)**
- [ ] #1 Paddle overlay checkout
- [ ] #2 Webhook handler with signature verification + idempotency
- [ ] #4 User.subscription sync
- [ ] #5 Pricing page update — highlight Pro, annual toggle, refund policy link
- [ ] #6 Hard paywall with "why upgrade" banner at locked days + exam
- [ ] #3 Customer portal link in settings
- [ ] #7 Post-checkout welcome page
- [ ] #27 Refund policy
- [ ] #28 Terms + Privacy pages

**Phase δ — Study UX parity with competitors**
- [ ] #17 Retake wrong questions mode
- [ ] #18 Flag/bookmark questions
- [ ] #20 Exam review mode (per-question walkthrough with explanations)
- [ ] #21 Exam attempt history
- [ ] #22 Domain heatmap (on dashboard + per exam attempt)
- [ ] #23 Dashboard widgets (streak, accuracy, weakest domain)
- [ ] #24 Exam readiness indicator

**Phase ε — Onboarding + retention**
- [ ] #14 Signup → Day 1 direct flow
- [ ] #15 Welcome email
- [ ] #25 Help/FAQ page
- [ ] #26 Support email link
- [ ] #30 Mobile responsive audit + fixes

### Add After Validation (v1.x)

Ship only if v1 has paying customers and feedback demands them.

- [ ] D1 Leitner SRS (high value but M complexity — defer until we see day-15+ return sessions dropping)
- [ ] D2 Streak + streak freeze — *low cost; could actually ship in ε if there's time*
- [ ] D3 Domain-filtered practice page
- [ ] D4 Email drip (weekly weakest-domain summary)
- [ ] D5 Exam mode toggle on practice
- [ ] D6 Keyboard shortcuts
- [ ] D10 Estimated time remaining per day
- [ ] D9 Light theme (only if users ask — current dark is a brand signal)

### Future Consideration (v2+)

Only after PMF is clear and you have more than one person working on this.

- [ ] D7 PDF certificate of completion
- [ ] D8 Public progress badge URL
- [ ] Adaptive CAT-style question selection (requires IRT model + larger question bank)
- [ ] Multi-cert expansion (Sec+, OSCP — new verticals, not features)
- [ ] AI explanations (only after human ones are ubiquitous and rated)
- [ ] Offline PWA (service worker caching, not a native app)

---

## Feature Prioritization Matrix

Sorted P1 → P3.

| # | Feature | User Value | Impl. Cost | Priority |
|---|---------|------------|------------|----------|
| 19 | Per-question explanations | HIGH | M (content work) | **P1** |
| 1 | Paddle overlay checkout | HIGH | M | **P1** |
| 2 | Webhook + idempotency | HIGH | M | **P1** |
| 4 | Subscription status sync | HIGH | M | **P1** |
| 6 | Paywall redirect w/ pitch | HIGH | S | **P1** |
| 20 | Exam review mode | HIGH | M | **P1** |
| 22 | Domain heatmap | HIGH | M | **P1** |
| 9 | Google OAuth | HIGH | M | **P1** |
| 10 | Password reset | HIGH | M | **P1** |
| 11 | Email verification | HIGH | M | **P1** |
| 12 | Settings page | HIGH | M | **P1** |
| 17 | Retake wrong questions | HIGH | S | **P1** |
| 18 | Flag/bookmark | MEDIUM | S | **P1** |
| 21 | Exam attempt history | MEDIUM | S | **P1** |
| 23 | Dashboard widgets | MEDIUM | S | **P1** |
| 5 | Pricing page updates | HIGH | S | **P1** |
| 3 | Customer portal link | HIGH | S | **P1** |
| 7 | Post-checkout page | MEDIUM | S | **P1** |
| 14 | Signup → Day 1 flow | MEDIUM | S | **P1** |
| 15 | Welcome email | MEDIUM | S | **P1** |
| 24 | Exam readiness indicator | MEDIUM | S | **P1** |
| 25 | Help/FAQ page | MEDIUM | S | **P1** |
| 26 | Support email | LOW | XS | **P1** |
| 27 | Refund policy | LOW | XS | **P1** |
| 28 | Terms + Privacy | LOW | S | **P1** |
| 30 | Mobile responsive audit | HIGH | M | **P1** |
| 8 | Receipt emails (Paddle auto) | MEDIUM | XS | **P1** |
| 13 | Resend verification button | LOW | XS | **P1** |
| 16 | Activation tracking | MEDIUM | S | **P1** |
| D2 | Streaks + freeze | HIGH | S | **P2** |
| D1 | Leitner SRS | HIGH | M | **P2** |
| D3 | Domain practice filter | MEDIUM | S | **P2** |
| D4 | Email drip | HIGH | M | **P2** |
| D5 | Exam mode on practice | MEDIUM | S | **P2** |
| D6 | Keyboard shortcuts | LOW | XS | **P2** |
| D10 | Time remaining estimate | LOW | S | **P2** |
| 29 | Cookie consent banner | LOW | S | **P2** (only if analytics added) |
| D7 | PDF certificate | MEDIUM | M | **P3** |
| D8 | Public badge URL | LOW | S | **P3** |
| D9 | Light theme | LOW | S | **P3** |

**Priority key:**
- **P1**: Required for the paid product to not feel broken; ship before charging money
- **P2**: Ships in v1.x once v1 is in production and we see usage data
- **P3**: Future consideration; don't plan for it now

---

## Competitor Feature Analysis

| Feature | Boson ExSim | Pocket Prep | CertMaster | Our Approach |
|---------|-------------|-------------|------------|--------------|
| Per-question explanations | Yes — best-in-class, their moat | Yes — shorter | Yes — official | Yes (#19) — original, concise, linked to CEH module |
| Exam review mode | Yes — full walkthrough | Yes | Yes | Yes (#20) — same pattern |
| Domain heatmap | Yes — on exam reports | Yes — on dashboard | Yes — adaptive | Yes (#22) — both on dashboard and exam attempts |
| Flag/bookmark | Yes | Yes | Yes | Yes (#18) — per-question flag on progress doc |
| Retake wrong only | Yes | Yes | Yes (adaptive) | Yes (#17) — explicit mode, not adaptive |
| Spaced repetition | No (they're one-shot practice) | Yes | No (adaptive instead) | Yes — Leitner (D1, v1.x) |
| Streaks | No | Yes (leaderboard-style) | No | Yes — personal only, no leaderboard (D2) |
| Leaderboards | No | Yes | No | **Deliberately no** (A7) — wrong for audience |
| Mobile native app | No | Yes (iOS/Android) | Yes | **No** — responsive web only (A4) |
| Adaptive CAT difficulty | No | No | Yes | **No in v1** — needs larger question bank first |
| AI tutor | No | No | No | **No in v1** (A8) — cost + accuracy concerns |
| Structured curriculum path | No (pure question bank) | Partial | Yes (modules) | **Yes — our differentiator** (14-day sprint already shipped) |
| Curated < unlimited question count | 300–500 questions/cert | ~1000 questions/cert | 500+ | **Yes — 70 curated, growing to ~150–200 with explanations** (quality over count) |
| Taste-skill design | No (functional/dated) | OK (gamified) | Dated | **Yes — our differentiator** (already shipped) |
| One-time purchase option | Yes ($99–199) | No (subscription) | No (one-time per cert) | **No** — subscription only ($30/mo per PROJECT.md) |
| Self-serve cancel | Varies | Yes | Yes | Yes (#3) — Paddle customer portal |

**Our positioning:** "Curated 14-day CEH sprint with the best explanations and the cleanest UI — not a question-bank firehose." Compete on curation, taste, and the sprint-narrative rhythm. Do not try to beat Boson on question count or CertMaster on adaptive algorithms.

---

## Billing / Checkout UX — Specific Call-Outs

Because the question explicitly asked about billing UX, pulling this section out for emphasis.

### Pricing page patterns to implement
- **Highlight Pro tier visibly** — accent border, "Most Popular" badge, slightly larger card. CXL data: unhighlighted tiers lose 22% conversion.
- **Annual toggle with discount math shown** — `$30/mo` vs `$25/mo billed annually ($300/yr — save $60)`. Default to annual if user arrives via an annual-intent marketing link; otherwise default monthly (3-day trial audience is budget-conscious).
- **Three bullets per tier max** — don't pile a 15-item feature matrix on a $30/mo product. Free: "3 days, 15 questions". Pro: "All 14 days, exam simulator, domain heatmap".
- **Visible refund policy line** — "14-day refund, no questions asked" (or whatever you actually commit to). Paddle requires a policy anyway; surfacing it builds trust.
- **Visible "cancel anytime" line** directly next to the CTA. Kills the #1 objection.
- **FAQ section below the tiers** — 5 questions: "what if I fail the exam?", "can I get a refund?", "how do I cancel?", "is this the real exam?", "who is this for?". Each answer 2–3 sentences.

### Paywall pattern when a free user hits day 4 or exam
- **Hard paywall** (RevenueCat 2026: 5× better than soft for subscription apps).
- **Full-screen takeover, not a modal** — modal-dismiss kills intent.
- **Content preview behind the wall** — show a blurred preview of Day 4 headline + the first question stem so they see what they're missing.
- **Upgrade CTA copy context-aware**: "Unlock Day 4: Scanning Networks — $30/mo, cancel anytime" (not just "Upgrade"). On exam: "Unlock the 125-question simulator".
- **"Back to free content" escape link** — don't trap them; aggressive patterns damage brand.

### Checkout flow
- **Paddle overlay (not inline)** — ships in days not weeks; Paddle handles VAT, currency, fraud, refunds.
- **Checkout button on pricing page triggers overlay directly** — no intermediate "select plan" page; reduce clicks.
- **Post-checkout webhook must upgrade tier server-side** — don't trust the client success callback. Webhook is the source of truth.
- **Post-checkout: redirect to `/welcome?attempt=X` which polls for webhook completion** — show spinner "Unlocking your account..." → auto-redirect to first locked day (Day 4) once user.tier === "pro".
- **Receipt**: Paddle as merchant-of-record sends these automatically. Do not build your own receipt email.

### Cancellation flow
- **Self-serve via Paddle Customer Portal link in Settings** (#3) — Paddle 2026 ships Cancellation Flows with dynamic save-offers for free in the portal; we inherit that.
- **Never make users email to cancel** — dark pattern, damages trust, generates negative reviews, doesn't actually reduce churn.
- **On cancel: access persists until current period end** — standard Paddle behavior; webhook downgrades tier at period end.
- **Re-subscribe = one-click resume via portal** — Paddle API supports `resume_subscription`; we don't need to build it.

---

## Sources

**Competitor & feature research:**
- [ExSim-Max for Ethical Hacking — Boson](https://boson.com/product/exsim-max-for-ethical-hacking/)
- [CompTIA CertMaster Practice + Boson ExSim comparison — Prep For Certs](https://prepforcerts.org/professor-messer-alternatives)
- [Pocket Prep features + pricing 2026 — Prep For Certs review](https://prepforcerts.org/pocket-prep-review)
- [IT Certification Exam Prep Platforms 2026 — BenchPrep / Context Memo](https://ai.benchprep.com/resources/the-ultimate-guide-to-it-certification-exam-prep-p)
- [Best CompTIA Study Apps 2026 — SecuSpark](https://www.secuspark.com/blog/best-comptia-study-apps-2026)
- [Free CISSP Exam Simulator features — ExamCert](https://www.examcert.app/blog/cissp-exam-simulator-free/)
- [Certification exam prep anti-patterns — Global Knowledge](https://www.globalknowledge.com/us-en/resources/resource-library/articles/six-certification-exam-mistakes-to-avoid/)
- [Best Apps for CISSP Exam Prep — DestCert](https://destcert.com/resources/best-apps-for-preparing-for-cissp-exam/)

**Study techniques (SRS, flashcards, Leitner):**
- [Leitner Box Flashcards — system mechanics](https://leitner-box.com/)
- [Best Spaced Repetition Apps 2026 — StudyGlen](https://studyglen.com/guides/best-spaced-repetition-apps)
- [Leitner System for Studying — Pocket Prep](https://www.pocketprep.com/posts/how-to-use-the-leitner-system-for-studying/)
- [Spaced Repetition Explained — okti Blog](https://okti.app/en/blog/spaced-repetition-explained/)

**Gamification & retention:**
- [Duolingo Gamification Secrets (streaks +60% commitment) — Orizon](https://www.orizon.co/blog/duolingos-gamification-secrets)
- [Duolingo Customer Retention 2026 — TryPropel](https://www.trypropel.ai/resources/duolingo-customer-retention-strategy)
- [Why Duolingo's Gamification Works (And When It Doesn't) — DEV](https://dev.to/pocket_linguist/why-duolingos-gamification-works-and-when-it-doesnt-1d4)
- [Course & Coaching App Retention Benchmarks — Passion.io](https://passion.io/blog/mobile-app-retention-benchmarks-for-creators-course-coaching-apps)
- [Email Cadence That Works in 2026 — Sparkle](https://sparkle.io/blog/email-cadence/)

**Paywalls, pricing, conversion:**
- [Hard vs Soft Paywalls — RevenueCat (2026 data: hard=10.7%, soft=2.1%)](https://www.revenuecat.com/blog/growth/hard-paywall-vs-soft-paywall/)
- [Subscription App Trends 2026 — RevenueCat](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026/)
- [Hard Paywall vs Soft Paywall vs Freemium — Airbridge](https://www.airbridge.io/en/blog/hard-vs-soft-paywalls)
- [SaaS Pricing Page Best Practices 2026 — InfluenceFlow](https://influenceflow.io/resources/saas-pricing-page-best-practices-complete-guide-for-2026/)
- [SaaS Stripe Integration Guide 2026 — DesignRevision](https://designrevision.com/blog/saas-stripe-integration)
- [Stripe vs Paddle fees and handling — DesignRevision](https://designrevision.com/blog/stripe-vs-paddle)
- [Best practices for SaaS billing — Stripe Resources](https://stripe.com/resources/more/best-practices-for-saas-billing)

**Onboarding & activation:**
- [SaaS User Activation Onboarding Strategies — SaaSFactor](https://www.saasfactor.co/blogs/saas-user-activation-proven-onboarding-strategies-to-increase-retention-and-mrr)
- [11 SaaS Onboarding Best Practices 2026 — Encharge](https://encharge.io/saas-onboarding-best-practices/)
- [SaaS User Onboarding Funnel 101 — Userpilot](https://userpilot.com/blog/saas-user-onboarding-funnel/)
- [2026 B2B SaaS Funnel Benchmarks — CausalFunnel](https://www.causalfunnel.com/blog/b2b-saas-funnel-conversion-benchmarks-2026-data-insights/)

**Paddle Billing specifics (authoritative):**
- [Paddle Customer Portal — Developer Docs](https://developer.paddle.com/concepts/customer-portal)
- [Paddle Checkout (overlay + inline) — Developer Docs](https://developer.paddle.com/concepts/sell/self-serve-checkout)
- [Paddle Cancellation Flows in Customer Portal (2026) — Changelog](https://developer.paddle.com/changelog/2026/cancellation-flows-customer-portal)
- [Paddle Subscription Pause/Resume — Developer Docs](https://developer.paddle.com/build/lifecycle/subscription-pause-resume)
- [Paddle Update Payment Details — Developer Docs](https://developer.paddle.com/build/subscriptions/update-payment-details)
- [Paddle Refund Handling — Help Center](https://www.paddle.com/help/manage/your-customers/how-do-i-issue-refunds)

**CEH-specific:**
- [CEH v13 Exam Info + Format — ExamTopics](https://www.examtopics.com/exams/eccouncil/312-50v13/)
- [CEH v13 Practice Test 2026 — ExamCert](https://www.examcert.app/blog/ceh-v13-practice-test-2026/)
- [Free CEH v13 Practice + AI Tutor — OpenExamPrep](https://open-exam-prep.com/practice/ceh)

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Table stakes (billing, auth, study modes, explanations) | **HIGH** | Cross-verified across Boson, Pocket Prep, CertMaster, RevenueCat 2026 data, Paddle official docs |
| Differentiators (Leitner SRS, streaks, keyboard shortcuts) | **MEDIUM** | Value is real per source data, but tradeoffs depend on whether we position as "sprint completion tool" vs "ongoing study companion" — founder decision |
| Anti-features | **HIGH** | Consistent warnings across multiple sources (Whizlabs decline, ExamTopics dumps, Duolingo gamification mismatch for adult learners) |
| Billing UX specifics | **HIGH** | Paddle 2026 developer docs are authoritative; RevenueCat 2026 benchmarks from 115k+ apps |
| Onboarding funnel numbers | **MEDIUM** | Industry benchmarks cited but vary by category; 5-min aha moment is well-documented |
| Mobile responsive importance | **HIGH** | Consistent across all sources; 50%+ traffic on mobile is industry baseline |

---

*Feature research for: CEH Prep paid monetization milestone*
*Researched: 2026-04-13*
