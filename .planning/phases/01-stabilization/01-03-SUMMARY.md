---
phase: 01-stabilization
plan: 03
subsystem: database
tags: [mongoose, schema, dto, ttl-index, sparse-unique, allowlist, security]

# Dependency graph
requires:
  - phase: 01-stabilization
    provides: 01-02 mongo connection + memory-server fallback (needed so schema mutations actually exercise a running Mongoose)
provides:
  - Extended User schema with 8 additive identity/role/token fields (emailVerifiedAt, googleSub, paddleCustomerId, role, emailVerifyTokenHash, emailVerifyTokenExpiresAt, passwordResetTokenHash, passwordResetTokenExpiresAt)
  - Sparse-unique indexes on googleSub + paddleCustomerId (enable many-null states pre-link)
  - tier schema default flipped from "pro" to "free" (load-bearing for Phase 4 paywall)
  - Audit TTL index consolidated to single source of truth via field-level expires:"90d" shortcut
  - User email index de-duplicated (field-level unique:true is the only definition)
  - toPublicUser DTO exposes emailVerifiedAt + role; server-only fields remain hidden by allowlist construction
affects:
  - phase-02-email-identity  # consumes emailVerifyTokenHash, passwordResetTokenHash, emailVerifiedAt
  - phase-03-google-oauth    # writes googleSub via sparse-unique index
  - phase-04-paddle-billing  # writes paddleCustomerId; tier=free default is load-bearing for paywall
  - phase-05-hardening       # CLI promotes role="admin"

# Tech tracking
tech-stack:
  added: []  # no new runtime deps; uses existing mongoose v8 SchemaDateOptions.expires
  patterns:
    - "Mongoose TTL via field-level `expires: '<duration>'` shortcut (single source of truth — obsoletes schema.index call AND field-level index:true)"
    - "Sparse-unique identity fields: `{ default: null, unique: true, sparse: true }` — MongoDB only indexes non-null docs, many-null state is allowed"
    - "DTO allowlist-by-construction: mapper starts from empty object literal, copies only explicitly-listed fields — leakage impossible by structure, not by comment"
    - "Token hashes + expirations use `select: false` so they never leak via default projections or `.lean()`"

key-files:
  created: []
  modified:
    - app/src/lib/db/models/audit.ts
    - app/src/lib/db/models/user.ts
    - app/src/lib/dto/user.ts

key-decisions:
  - "Used `expires: '90d'` on audit.at field (Mongoose sugar for expireAfterSeconds: 7776000) instead of schema.index call — kills the [MONGOOSE] Warning duplicate AND obsoletes field-level index:true"
  - "Every new User field defaults to null (or 'user'/'free') — additive, zero migration needed, existing documents keep working"
  - "googleSub and paddleCustomerId use `sparse: true` alongside `unique: true` — without sparse, the second user with null googleSub would collide on the unique constraint"
  - "Token hashes + their paired expiration timestamps all marked `select: false` so Mongoose default projections never leak them even accidentally via `.lean()`"
  - "DTO allowlist JSDoc rewritten to describe the by-construction guarantee without enumerating forbidden field names — the structure (empty literal → explicit copies) is the contract, not a comment listing what's excluded"
  - "tier fallback in toPublicUser flipped from ?? 'pro' to ?? 'free' in lockstep with schema default — legacy docs missing tier must not appear as Pro in the UI"

patterns-established:
  - "Mongoose TTL de-duplication: field-level `expires: '<duration>'` is the canonical shortcut, replaces BOTH field-level index:true AND schema-level .index() call"
  - "Sparse-unique identity link: `{ default: null, unique: true, sparse: true }` — use for every nullable identity field added in Phases 2-5"
  - "DTO allowlist-by-construction: mapper literal enumerates allowed fields, omission is the enforcement mechanism"

requirements-completed: [STAB-02, STAB-09]

# Metrics
duration: 4 min
completed: 2026-04-14
---

# Phase 01 Plan 03: User Schema Extension + Index De-duplication Summary

**Extended User schema with 8 nullable identity/role/token fields (sparse-unique googleSub + paddleCustomerId, select:false token hashes, tier default flipped to free), de-duplicated Mongoose TTL/unique indexes on audit.at + user.email via field-level expires:"90d" and unique:true, and opened DTO allowlist to emailVerifiedAt + role while keeping every secret server-side.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-14T06:22:09Z
- **Completed:** 2026-04-14T06:26:01Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- **STAB-02 half-fix**: Audit.at TTL index now has exactly one source of truth (field-level `expires: "90d"`), and User.email has exactly one (field-level `unique: true`). Both schema-level `.index()` calls are gone. `[MONGOOSE] Warning: Duplicate schema index` is dead on both keys — end-to-end zero-warnings check happens after Plan 01-05 once the complete boot path runs against a live Mongo.
- **STAB-09 schema surface**: User schema now carries all 8 additive fields every downstream phase writes to: `emailVerifiedAt`, `googleSub` (sparse-unique), `paddleCustomerId` (sparse-unique), `role` (user/admin), and the four token/expiration pairs for email verify + password reset. Every new field is `default: null` (or `"user"`/`"free"`) — existing docs auto-migrate silently.
- **Security posture preserved**: `select: false` on passwordHash, failedLoginCount, lockedUntil, emailVerifyTokenHash, emailVerifyTokenExpiresAt, passwordResetTokenHash, passwordResetTokenExpiresAt (7 fields). Default Mongoose projections will never surface them; `.lean()` queries will never leak them.
- **Load-bearing tier default flip**: `tier` schema default and `toPublicUser` fallback both flipped from `"pro"` to `"free"` in lockstep. Without this pair, every new Phase 2 signup would skip Phase 4's paywall entirely.
- **DTO allowlist opened by 2 (and only 2)**: `UserPublic` now carries `emailVerifiedAt: string | null` and `role: "user" | "admin"` — enough for Phase 2's email-verify conditionals and Phase 5's admin-link rendering. `googleSub`, `paddleCustomerId`, `passwordHash`, and all four token hashes remain strictly server-side via allowlist omission.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix audit model duplicate index via `expires` shortcut** — `fdfa678` (fix)
2. **Task 2: Extend User schema with 8 additive fields, drop duplicate email index, flip tier default to free** — `5e6da96` (feat)
3. **Task 3: Extend toPublicUser DTO with emailVerifiedAt + role** — `ad8a771` (feat)

Plan metadata commit pending (SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md + deferred-items.md).

## Files Created/Modified

- `app/src/lib/db/models/audit.ts` — `at` field uses `expires: "90d"` (TTL shortcut, creates the only index `at` needs); `auditSchema.index({ at: 1 }, ...)` call removed; `userId` field-level `index: true` untouched (only definition, no duplication).
- `app/src/lib/db/models/user.ts` — 8 new additive fields added after `lastLoginAt` in logical groupings (identity → role → tokens); `tier` default flipped `"pro"` → `"free"`; `userSchema.index({ email: 1 }, { unique: true })` removed (field-level `unique: true` already creates it); zero schema-level `.index()` calls remain.
- `app/src/lib/dto/user.ts` — `UserPublic` type extended with `emailVerifiedAt: string | null` and `role: "user" | "admin"`; `toPublicUser` populates both via `doc.emailVerifiedAt?.toISOString() ?? null` and `(doc.role ?? "user") as ...`; `tier` fallback flipped `?? "pro"` → `?? "free"` to match schema default; JSDoc refined to describe allowlist-by-construction guarantee without enumerating forbidden field names.

## Final UserDoc Field Inventory (downstream-phase reference)

| Field | Type | Default | select | Index | Set by phase |
|-------|------|---------|--------|-------|--------------|
| `email` | string | (required) | true | unique (field-level) | 01 (signup) |
| `passwordHash` | string | (required) | false | — | 01 (signup) |
| `displayName` | string | `""` | true | — | 01 (signup, optional) |
| `tier` | `"free"\|"pro"` | `"free"` ⚠ | true | — | 04 (on Paddle activation) |
| `failedLoginCount` | number | `0` | false | — | 01 (login/lockout flow) |
| `lockedUntil` | Date \| null | `null` | false | — | 01 (login/lockout flow) |
| `createdAt` | Date | `Date.now` | true | — | 01 (signup) |
| `lastLoginAt` | Date \| null | `null` | true | — | 01 (login) |
| `emailVerifiedAt` | Date \| null | `null` | true | — | 02 (email verify consume) |
| `googleSub` | string \| null | `null` | true | sparse unique | 03 (OAuth link) |
| `paddleCustomerId` | string \| null | `null` | true | sparse unique | 04 (first checkout) |
| `role` | `"user"\|"admin"` | `"user"` | true | — | 05 (CLI promote script) |
| `emailVerifyTokenHash` | string \| null | `null` | false | — | 02 (issue + consume) |
| `emailVerifyTokenExpiresAt` | Date \| null | `null` | false | — | 02 (issue + check) |
| `passwordResetTokenHash` | string \| null | `null` | false | — | 02 (issue + consume) |
| `passwordResetTokenExpiresAt` | Date \| null | `null` | false | — | 02 (issue + check) |

⚠ **Load-bearing default flip**: `tier` must default to `"free"` for the Phase 4 paywall to engage on new signups.

## Final UserPublic Shape (UI reference)

```typescript
export type UserPublic = {
  id: string;
  email: string;
  displayName: string;
  tier: "free" | "pro";
  emailVerifiedAt: string | null;  // ISO-8601 or null
  role: "user" | "admin";
  createdAt: string;                // ISO-8601
};
```

**Never exposed via DTO** (allowlist omission, strictly server-side):
`passwordHash`, `failedLoginCount`, `lockedUntil`, `lastLoginAt`, `googleSub`, `paddleCustomerId`, `emailVerifyTokenHash`, `emailVerifyTokenExpiresAt`, `passwordResetTokenHash`, `passwordResetTokenExpiresAt`.

## Index Topology (post-plan)

**User collection** — every index declared at the field level, zero `.index()` calls:

- `email_1` — unique (from `unique: true` on email field)
- `googleSub_1` — unique sparse (from `unique: true, sparse: true` on googleSub)
- `paddleCustomerId_1` — unique sparse (from `unique: true, sparse: true` on paddleCustomerId)
- `_id_` — default Mongoose ObjectId index

**Audit collection** — field-level only, zero `.index()` calls:

- `at_1` — TTL index with `expireAfterSeconds: 7776000` (from `expires: "90d"` on at field)
- `userId_1` — standard index (from `index: true` on userId field)
- `_id_` — default Mongoose ObjectId index

Confirmation: `grep -rE "userSchema\.index|auditSchema\.index" app/src/lib/db/models/` → zero matches.

## Tier Default Flip (lockstep pair — do not unsync)

Both the schema AND the DTO fallback must agree on `"free"` as the tier default. If only the schema flips, legacy documents missing the `tier` field will still appear as Pro in the UI (because the DTO fallback was `?? "pro"`). The flip is now in both places:

| Location | Old | New |
|----------|-----|-----|
| `models/user.ts` schema default | `default: "pro"` | `default: "free"` |
| `dto/user.ts` toPublicUser fallback | `doc.tier ?? "pro"` | `doc.tier ?? "free"` |

## Decisions Made

- **TTL via `expires` shortcut on audit.at**: preferred over `auditSchema.index({ at: 1 }, { expireAfterSeconds: ... })` because the shortcut is a single-source-of-truth (the TTL index IS the index — it also obsoletes the old field-level `index: true`). Research Pattern 2 confirmed this matches Mongoose v8 docs.
- **All new fields additive with `default: null`**: chosen over a migration script because Phase 1's whole point is unblocking Phase 2-5 with zero data migrations. Existing docs keep working; new docs get the fields.
- **Sparse unique on googleSub + paddleCustomerId**: required because without `sparse: true`, MongoDB treats `null` as a value — the second user with `null googleSub` would violate the unique constraint and signup would fail. `sparse: true` means "only index documents where the field is set".
- **`select: false` on all 4 token fields + their expiration timestamps**: defense in depth. Even if a future `.lean()` query forgets to exclude these fields, Mongoose's default projection drops them. The caller must explicitly `.select("+emailVerifyTokenHash")` to fetch them.
- **JSDoc rewritten for allowlist-by-construction**: the original comment literally enumerated forbidden fields (`"Prevents accidental leakage of passwordHash, failedLoginCount, etc."`), which meant the plan's acceptance-criteria grep `grep -c 'passwordHash' app/src/lib/dto/user.ts == 0` failed on a COMMENT, not an actual code leak. The fix is structural: the mapper starts from `({ ... })` with explicit keys, so leakage is impossible by construction — the comment describes the mechanism without enumerating exclusions. Both acceptance criterion AND reader comprehension improved.
- **`tier` fallback paired flip in DTO**: the schema flip is ineffective without the DTO flip. Documented as a lockstep pair so Phase 5's deploy guide can verify both together.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSDoc in `dto/user.ts` literally contained the word `passwordHash`, failing the plan's allowlist-exclusion grep**

- **Found during:** Task 3 acceptance-criterion verification
- **Issue:** Plan acceptance criterion stated `grep -c 'passwordHash' app/src/lib/dto/user.ts` must return 0 (to enforce the "never exposed" invariant). The pre-existing JSDoc comment on `UserPublic` said `"Prevents accidental leakage of passwordHash, failedLoginCount, etc."` — literally mentioning `passwordHash`. Semantically the allowlist was already correct (passwordHash is nowhere in the runtime mapper), but the criterion's grep was strict on the string.
- **Fix:** Rewrote the JSDoc to describe the allowlist-by-construction mechanism without enumerating specific forbidden fields. The new comment says: "The mapper starts from an empty object literal and only copies fields listed here — any server-only field (credentials, token hashes, identity links, internal counters) is impossible to leak by construction." This is both clearer (structure is the contract) AND satisfies the literal grep.
- **Files modified:** `app/src/lib/dto/user.ts`
- **Verification:** `grep -c 'passwordHash' app/src/lib/dto/user.ts` now returns 0; `grep -c 'TokenHash' .../user.ts` returns 0; `grep -c 'googleSub\|paddleCustomerId' .../user.ts` returns 0. All other Task 3 acceptance criteria still pass.
- **Committed in:** `ad8a771` (folded into Task 3 commit — same file, same task boundary)

---

**Total deviations:** 1 auto-fixed (1 bug / interpretation fix).
**Impact on plan:** Zero scope creep. The fix tightened the comment to match the structural guarantee. No runtime behavior changed.

## Issues Encountered

**1. Pre-existing lint warning in `src/app/layout.tsx:20:9` (`@next/next/no-page-custom-font`)**

- `npm run lint` exits with code 1 because of `--max-warnings=0` and a pre-existing warning in `layout.tsx` (custom `<link>` font declaration in App Router root layout — should migrate to `next/font`).
- `layout.tsx` is currently **untracked** in git (no prior commit history) and is NOT modified by this plan. Plan 01-03's scope is schema + DTO only.
- Per SCOPE BOUNDARY rule: "Only auto-fix issues DIRECTLY caused by the current task's changes. Pre-existing warnings, linting errors, or failures in unrelated files are out of scope."
- **Action:** Declined to fix. Updated `deferred-items.md` to re-route ownership (the prior note guessed Plan 01-03 was a "UI surface" plan — it isn't). Re-assigned to Phase 5 hardening or a dedicated font-migration plan before Phase 2 UI work begins.
- **Effect on plan verification:** `npx tsc --noEmit` exits 0 (success criterion #1 passes). `npm run lint` exits 1 on a pre-existing unrelated warning (success criterion #2 fails strictly on exit code, but the only offender is untouched by this plan).

**2. Existing Atlas/dev DBs may carry orphan `email_1` or `at_1` indexes from previous duplicate definitions**

- Not encountered in this plan's execution (local `mongodb-memory-server` starts fresh on every boot, per 01-02's fallback), but documented in the plan's `<output>` section as a deploy-time concern.
- **Action:** Phase 5 deploy guide will document the manual `db.users.dropIndex("email_1")` / `db.audit.dropIndex("at_1")` steps if the duplicates exist alongside the new auto-indexes.

## Authentication Gates

None — this plan touches schema and DTO code only, no external auth flows.

## User Setup Required

None — no external service configuration required. All changes are local code modifications to Mongoose models and DTO mappers. Existing `MONGO_URI=memory://` fallback (from 01-02) continues to work.

## Next Phase Readiness

**Ready for Plan 01-04** (already executed — this plan was reordered to run after 01-04 per wave dependencies).

**Ready for Plan 01-05** (final boot-path verification):
- Schema side of STAB-02 is fully delivered (zero `.index()` calls on user.email or audit.at).
- 01-05 should do the end-to-end "zero warnings" check by booting `npm run dev` against the memory-server and `grep -c "Duplicate schema index"` on stdout (expected: 0).

**Ready for Phase 2 (email identity)**:
- `emailVerifyTokenHash`, `emailVerifyTokenExpiresAt`, `passwordResetTokenHash`, `passwordResetTokenExpiresAt` are all present, nullable, `select: false`, awaiting Phase 2's issue/consume flow.
- `emailVerifiedAt` is present on `UserDoc` AND exposed via `UserPublic.emailVerifiedAt` — Phase 2's email-verify UI conditionals have what they need.

**Ready for Phase 3 (Google OAuth)**:
- `googleSub` sparse-unique field is present on `UserDoc`. Phase 3's `decideLink` gate can safely write `doc.googleSub = sub` under the documented "email verified AND googleSub null" precondition without any schema work.

**Ready for Phase 4 (Paddle billing + tier gate)**:
- `paddleCustomerId` sparse-unique field is present.
- **Critical**: `tier` schema default is now `"free"` AND the DTO fallback is now `?? "free"`. Phase 4's paywall will actually engage for new signups — without this plan's flip, the paywall would have been a no-op for 100% of new users.

**Ready for Phase 5 (production hardening)**:
- `role: "user" | "admin"` field is present on `UserDoc` AND exposed via `UserPublic.role`. The CLI promote-to-admin script can write `doc.role = "admin"` and the admin-link UI conditional `{user.role === "admin" && <AdminLink />}` works end-to-end.

## Self-Check: PASSED

- File `app/src/lib/db/models/audit.ts` — FOUND
- File `app/src/lib/db/models/user.ts` — FOUND
- File `app/src/lib/dto/user.ts` — FOUND
- File `.planning/phases/01-stabilization/01-03-SUMMARY.md` — FOUND
- Commit `fdfa678` (Task 1 audit fix) — FOUND
- Commit `5e6da96` (Task 2 user schema extension) — FOUND
- Commit `ad8a771` (Task 3 DTO extension) — FOUND

---

*Phase: 01-stabilization*
*Completed: 2026-04-14*
