# lib/billing

Pure domain rules for free/pro entitlement gating. **No I/O. No SDK imports. No `await`.**

## What lives here

- `entitlements.ts` — `canAccessDay(tier, day)` and `canAccessExam(tier)`. The single source
  of truth every gate consults. v1 rule: free users get days 1..3, pro users get all 14, exam
  simulator is Pro-only.
- `index.ts` — public re-export barrel. Import from `@/lib/billing`, not from
  `./entitlements` directly, except inside the billing folder itself.

## What does NOT live here

- Paddle SDK calls — those live in `lib/infra/paddle/` (Phase 4).
- `requireSession` composition — that's the guards folder's job (`lib/guards/require-tier.ts`,
  Phase 4). Entitlements is the rule; guards apply the rule.
- Database queries. Pure functions only. If you find yourself needing to `await` something
  from inside this folder, you are writing a guard, not an entitlement.

## Who imports from here

- `lib/actions/progress.ts` — `saveAnswer` action gates day access via `canAccessDay`.
- `app/(app)/course/[day]/page.tsx` — render-layer redirect via the same `canAccessDay`.
- `lib/guards/require-tier.ts` (Phase 4) — wraps `canAccessExam` in a Result-returning guard.
- `lib/guards/require-day-access.ts` (Phase 4) — wraps `canAccessDay`.

Every gate uses the same function. Single source of truth, two enforcement points.
