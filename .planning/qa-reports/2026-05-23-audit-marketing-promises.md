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
| Day 14 "125-question timed exam simulator" | No `/exam` route, no timer UI, no quiz-bank aggregator | **Open** — needs build |

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

## Open — Day 14 exam simulator gap

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

## What this audit deliberately didn't do

- **Day 14 simulator build** — too large for the audit window; flagged
  as an open task for the next session.
- **Landing copy revision** — also deferred; the audit's job is to
  surface the gap, not pick the resolution (build vs. soften).
- **Tier-gating regression test for `/exam`** — moot until the route
  exists.

## Status at audit end

```
Tests:     35/35 passing (was 22 → added 13 regression-fix tests)
Typecheck: green
Build:     green
```
