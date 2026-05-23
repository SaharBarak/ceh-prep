# Audit — marketing promises vs. reality (2026-05-23)

Session-13 audit per handoff open task #13. Three areas inspected:
Day-14 exam simulator, day-completion flow, WebVM drill-pass postMessage.
Two real bugs found and fixed this session; one promise-vs-reality gap
documented for a future session.

## TL;DR

| Promise | Reality | Status |
|---|---|---|
| Quiz completion → user progresses through curriculum | Was silently broken (CastError on every "Mark done" click + quiz-finish never bumped `user.completedDays`) | **Fixed** |
| WebVM drill-pass postMessage → drill recorded | Same CastError | **Fixed** |
| Phase 11 streak email fires after 3 days done | Never fired — `completedDays` always empty | **Fixed (root cause)** |
| Day 14 "125-question timed exam simulator" | No `/exam` route, no timer UI, no quiz-bank aggregator | **Shipped v1** — full-bank simulator, copy reconciled |

## Bug 1 — `$addToSet` with `$eq` was throwing CastError

**Location:** `src/lib/actions/completion.ts`

```ts
// Before — both setLessonComplete and setDrillComplete:
{ $addToSet: { completedDays: { $eq: day } } }
```

`$eq` is a query operator. Inside an update value, mongoose tried to cast
`{ $eq: 3 }` (an object) to a `Number`, threw `CastError`, and the action
500'd. The `"Mark done"` button on every `/course/N` page, the WebVM
drill-pass message handler, and the "I solved it" button were all dead.

Reproduced under the existing `mongodb-memory-server` stack — confirmed
the cast fails and `completedDays` stays empty.

**Fix:** drop the `$eq` from the update side (it belongs only in query
filters). Schema's `completedDays: [Number]` enforces type; the action's
`Number.isInteger(day)` already gates input.

Tests: `src/lib/actions/completion.test.ts` (9 tests) cover the regression
+ idempotency + invalid-input rejection + the streak cron's `$all` filter
matching after the fix.

## Bug 2 — quiz completion never wrote to `user.completedDays`

**Location:** `src/lib/actions/progress.ts` (`saveAnswer`)

The dashboard reads `ProgressModel.completedAt` to count days done; the
streak/winback crons in `api/cron/engagement` read `User.completedDays`.
`saveAnswer` set the first but never touched the second. Source-of-truth
divergence: dashboard could say "Day 3 done" while the streak email
sat blocked behind `completedDays: { $all: [1,2,3] }`.

**Fix:** when `saveAnswer` detects the day's last answer landed, also
`$addToSet` to `User.completedDays`. Idempotent.

Tests: `src/lib/actions/progress.test.ts` (4 tests) cover partial vs.
complete cases, the streak `$all` filter matching after days 1+2+3, and
idempotency on re-answering.

## Bug 3 — defensive `$eq` wrapping inconsistency (new code)

The codebase enforces `{ field: { $eq: value } }` on every Mongoose
filter via the `scripts/check-no-eq.sh` tripwire (CVE-2025-23061
defense). Last session's `lib/account/{export-builder,delete-cascade}.ts`
used object shorthand (`.find({ userId })`) which the tripwire's regex
heuristic can miss but the policy still applies to.

**Fix:** wrap `userId`/`email` filters in `lib/account/*` with `{ $eq: ... }`
consistently with `lib/actions/progress.ts:110`.

## RESOLVED — Day 14 exam simulator shipped

Update (commit follows this report): the simulator now exists and is
wired end-to-end. See `## Resolution — exam simulator v1` below.

## Open — Day 14 exam simulator gap (original finding)

**Promise:**
- Landing (`src/app/page.tsx:175`): _"Day 14 runs a domain-weighted
  125-question simulator that mirrors the real CEH v13 exam pacing."_
- Day-14 content (`src/lib/content/days.ts:1110+`): describes a
  full-bank weighted simulator, references an `/exam` route, and the
  lab body instructs users to "navigate to /exam (Pro tier)".

**Reality:**
- No `/exam` route exists. No file matches `simulator*` or `exam*` under
  `src/app/`.
- `/course/14` renders like every other day: lesson + quiz + (no) lab.
  The quiz has 5 questions, not 125.
- A Pro-tier user reaching Day 14 expecting the simulator will hit a
  dead link.

**Severity:** High for credibility (concrete functional promise unfulfilled
on the conversion-critical "this is what you pay for" day).

**Scope to ship the promise (~1-2 days):**
1. `src/app/(app)/exam/page.tsx` — Pro-gated; pulls N questions from
   all 14 days' quiz banks weighted by CEH v13 domain percentages.
2. Timer UI (4-hour countdown, pause-disabled per the lesson copy).
3. Per-domain results breakdown on submit + per-question "why" reveal
   in review mode.
4. Wire from `/course/14` lab section to `/exam`.
5. Persist exam runs (new model — `ExamRun`) so the cron mail
   "trained N analysts" claim can become honest later.

**Cheaper option (~1 hour):** soften the marketing copy on the landing
page and Day-14 lesson body to describe a "Day-14 full-bank review quiz"
that doesn't promise the timer + 125-question count. Less impressive but
honest until the real simulator ships.

## Resolution — exam simulator v1

Shipped in the same session:

- `src/lib/exam/builder.ts` — pure exam builder + grader (Mulberry32-seeded
  shuffle for deterministic tests, full-bank by default, configurable cap
  for when the bank reaches 125+). 14 tests.
- `src/lib/db/models/exam-run.ts` — ExamRun model persists every submitted
  attempt (userId, durationSeconds, score, perDay breakdown).
- `src/lib/actions/exam.ts` — submitExam server action with tier gate,
  CSRF-safe shape (zod), server-side answer-key re-derivation (client
  can never lie about correctness). 7 tests.
- `src/app/(app)/exam/page.tsx` — Pro-gated server component that builds
  the exam and ships the stripped (no-answer-key) shape to the runner.
- `src/app/(app)/exam/exam-runner.tsx` — client runner with useReducer
  state machine (idle → running → submitting → done), 4-hour countdown
  timer with auto-submit at zero, prev/next + jump-to-question grid,
  per-module results breakdown on submission.
- `/course/14` lab section now renders an "Open exam simulator →" CTA
  (Pro) or the upgrade card (free) instead of the misleading
  "browser lab coming soon" placeholder.

### Copy reconciliation

The original marketing said "125-question timed simulator" and
"domain-weighted readiness report." Two honest gaps to close:

- The quiz bank currently holds ~52 questions (every quiz across all 14
  days). Pulling 125 would require either content growth or
  duplication; both worse than honesty.
- Questions don't carry domain tags yet, so "domain-weighted" is
  aspirational not implemented.

Resolution: landing copy + Day-14 lesson body now say "full-bank timed
exam simulator" with explicit transparency that "the question bank
grows as the curriculum does — today's simulator uses every question
we've published, not yet the full 125-question count of the real exam.
Treat it as exam-format pacing practice." 4-hour ceiling and 70% pass
threshold remain unchanged (those are both real and shipped).

### What still belongs in v2

- Domain tagging on every quiz question + a per-domain readiness card.
- Bank growth to 125+ questions (content work).
- Resume-mid-run via ExamRun-as-draft (currently no mid-run persistence;
  refresh loses progress and the page header warns the user).
- "Review wrong answers" mode that walks the user through every missed
  question with the `why` explanation visible. ExamRunModel.answers
  already stores per-question correctness so this is mostly a UI add.
- Past-attempts list on /account/settings (data is in ExamRun; just
  needs a section).

## What this audit deliberately didn't do

- **Day 14 simulator build** — too large for the audit window; flagged
  as an open task for the next session.
- **Landing copy revision** — also deferred; the audit's job is to
  surface the gap, not pick the resolution (build vs. soften).
- **Tier-gating regression test for `/exam`** — moot until the route
  exists.

## Status at audit end

```
Tests:     57/57 passing (was 22 → added 35: 13 regression-fix + 22 simulator)
Typecheck: green
Build:     green
```
