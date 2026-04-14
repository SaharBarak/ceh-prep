---
phase: 02-email-identity
plan: 01
subsystem: auth
tags: [tokens, crypto, sha256, base64url, zod, mongoose, resend, env, session-epoch]

# Dependency graph
requires:
  - phase: 01-stabilization
    provides: "User schema token hash fields (emailVerifyTokenHash + expiresAt, passwordResetTokenHash + expiresAt) from STAB-09, lib/auth/ directory, lib/env.ts Zod schema, node:crypto import convention from auth/password.ts"
provides:
  - "lib/auth/tokens.ts: createToken(purpose), hashToken(plaintext), isExpired(date|null|undefined), TokenPurpose type, Token type"
  - "lib/env.ts: RESEND_API_KEY (optional) and RESEND_FROM_ADDRESS (prod-refined) env fields"
  - "lib/db/models/user.ts: sessionEpoch field (Number, default 0, select:false) — backfill-safe"
affects: [02-02-resend-client, 02-03-templates, 02-04-session-drift, 02-05-verify-flow, 02-06-reset-flow, 03-oauth, 04-paddle, 05-hardening]

# Tech tracking
tech-stack:
  added: [] # zero new runtime deps — node:crypto is Node built-in
  patterns:
    - "Single-use token primitive: 32 random bytes -> base64url (43 chars, 256 bits) + SHA-256 hex hash stored at rest"
    - "Purpose-scoped TTL table via Readonly<Record<TokenPurpose, number>> for exhaustive narrowing"
    - "Pure isExpired(null|undefined|Date) runs AFTER hash match to defeat timing oracles"
    - "Env refinement predicate uses process.env.NODE_ENV guard to enforce prod-only rules while keeping dev defaults"
    - "Schema-additive migration pattern: default:0 + select:false = implicit backfill, zero migration script"

key-files:
  created:
    - app/src/lib/auth/tokens.ts
  modified:
    - app/src/lib/env.ts
    - app/src/lib/db/models/user.ts

key-decisions:
  - "Node-native node:crypto + base64url (43 chars) — zero userland hash/random deps; matches Phase 1 password.ts import convention"
  - "SHA-256 hex for token at-rest, not Argon2id — single-use short-lived tokens don't need memory-hard hashing and would add ~100ms latency to every reset click (PITFALLS.md #9)"
  - "TTL_MS table typed Readonly<Record<TokenPurpose, number>> so exhaustive switches over purposes are compiler-enforced downstream"
  - "isExpired is null-safe and pure — null/undefined counts as expired — and is called AFTER hash match so timing cannot distinguish expired from wrong (PITFALLS.md #10)"
  - "RESEND_API_KEY left optional in dev (Phase 2 plans a [resend:dev] console stub). Production refinement on RESEND_FROM_ADDRESS blocks the 'localhost' default from ever shipping"
  - "sessionEpoch default:0 + select:false is backfill-safe — existing User docs read back as 0 (or undefined on .lean(), which session.epoch ?? 0 handles identically). No migration script needed"
  - "Only 3 files touched; zero side-effects outside node:crypto randomBytes/createHash. Blast radius on rollback is a single revert"

patterns-established:
  - "Token primitive: 32-byte base64url plaintext (43 chars, 256 bits) + 64-char SHA-256 hex hash; plaintext goes in URL, hash goes in Mongo"
  - "TTL table indexed by TokenPurpose union with exhaustive compiler check"
  - "Env refinement uses process.env.NODE_ENV guard to enforce prod-only rules while keeping dev defaults ergonomic"
  - "Schema-additive migration: default + select:false = implicit backfill, zero migration script"

requirements-completed: [EMAIL-04]

# Metrics
duration: 5min
completed: 2026-04-14
---

# Phase 02 Plan 01: Token Primitive + Env Patch + Session Epoch Summary

**Shipped the pure foundation for Phase 2 — node:crypto-based single-use token primitive (createToken / hashToken / isExpired), Zod env extension for RESEND_API_KEY + RESEND_FROM_ADDRESS with production localhost-refusal refinement, and a backfill-safe sessionEpoch field on the User schema.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-14T12:55:00Z
- **Completed:** 2026-04-14T12:59:57Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- **`lib/auth/tokens.ts`** — createToken/hashToken/isExpired primitive with TokenPurpose union, 32-byte base64url plaintext (43 chars, 256 bits entropy), SHA-256 hex hash (64 chars), purpose-scoped TTL (24h verify / 1h reset), null-safe pure isExpired
- **`lib/env.ts`** — RESEND_API_KEY optional, RESEND_FROM_ADDRESS with `CEH Sprint <no-reply@localhost>` dev default plus production refinement that rejects the literal string `localhost`
- **`lib/db/models/user.ts`** — additive `sessionEpoch: { type: Number, default: 0, select: false }` field, Phase 1 fields and indexes untouched, UserDoc type auto-re-inferred via InferSchemaType

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tokens.ts primitive** - `4c686cd` (feat)
2. **Task 2: Add RESEND_API_KEY + RESEND_FROM_ADDRESS to env schema** - `74f125b` (feat)
3. **Task 3: Add sessionEpoch field to User schema** - `ec1e0d8` (feat)

## Files Created/Modified

- `app/src/lib/auth/tokens.ts` **(created, 62 lines)** — exports `createToken(purpose: TokenPurpose): Token`, `hashToken(plaintext: string): string`, `isExpired(expiresAt: Date | null | undefined): boolean`, plus `TokenPurpose` and `Token` types. Uses `node:crypto` (`randomBytes`, `createHash`). Zero `any`. TTL_MS table: `verify_email = 86_400_000` ms, `reset_password = 3_600_000` ms.
- `app/src/lib/env.ts` **(modified, +14 lines)** — added two fields to `EnvSchema`:
  ```ts
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_ADDRESS: z
    .string()
    .default("CEH Sprint <no-reply@localhost>")
    .refine(
      (v) => process.env.NODE_ENV !== "production" || !v.includes("localhost"),
      "RESEND_FROM_ADDRESS must be a real verified sender in production",
    ),
  ```
  and the matching two lines in the `safeParse` object: `RESEND_API_KEY: process.env.RESEND_API_KEY` and `RESEND_FROM_ADDRESS: process.env.RESEND_FROM_ADDRESS`. Pre-existing fields untouched; `Env` type re-inferred automatically via `z.infer<typeof EnvSchema>`.
- `app/src/lib/db/models/user.ts` **(modified, +3 lines)** — added one line after `passwordResetTokenExpiresAt`:
  ```ts
  // ── Session epoch (Phase 2 — bumped on password reset to invalidate stale sessions) ─
  sessionEpoch: { type: Number, default: 0, select: false },
  ```
  Pre-existing Phase 1 fields (emailVerifyTokenHash/ExpiresAt, passwordResetTokenHash/ExpiresAt, googleSub, paddleCustomerId, role, emailVerifiedAt, tier, failedLoginCount, lockedUntil) all untouched. Schema options `{ versionKey: false, collection: "users" }` unchanged. No new `.index()` calls.

## Verification Results

**TSC clean:** `cd app && npx tsc --noEmit` exits 0 after every task.

**Runtime sanity (dev smoke):**
```
plaintext.len = 43          (32 bytes -> base64url always 43 chars)
hash.len = 64               (SHA-256 hex always 64 chars)
verify.ttl_delta_ms = -1    (within 2s of 86400000 target)
reset.ttl_delta_ms = 0      (within 2s of 3600000 target)
isExpired(null) = true      (null-safe)
isExpired(future) = false   (valid)
hashToken("abc") deterministic = true
env.RESEND_API_KEY type = "undefined"  (optional in dev)
env.RESEND_FROM_ADDRESS = "CEH Sprint <no-reply@localhost>"
```

**Production refinement test:** Running with `NODE_ENV=production` and no override of RESEND_FROM_ADDRESS correctly throws `Environment validation failed` with the exact message `"RESEND_FROM_ADDRESS must be a real verified sender in production"`. The dev default can never accidentally ship to prod.

**EMAIL-04 acceptance:** `grep -q "randomBytes(32)"` and `grep -q "sha256"` both pass on `tokens.ts` — the validation-arch tripwire for this plan's single requirement is satisfied.

**sessionEpoch backfill-safety:** Because the field has `default: 0` at the Mongoose layer, existing User docs read back as `0` when the field is requested with `.select("+sessionEpoch")`. With `.lean()` and without explicit select, the field is `undefined` (select:false), which the Phase 2 drift check will compare as `sessionEpoch ?? 0` per 02-RESEARCH.md §3 — an existing doc with `undefined` and a new session with `epoch: undefined` both coerce to `0` and do not trigger revocation. Zero migration needed.

## Decisions Made

- **No new runtime dependencies** — node:crypto is a Node built-in. Every other token library (nanoid, uuid, crypto-js) was rejected as a net-negative in supply-chain surface for no security benefit on a token that lives ~60 seconds (reset) to 24 hours (verify).
- **SHA-256, not Argon2id** — Argon2's whole design (memory-hard, slow) is about defeating offline brute force of *stored password hashes*. A single-use, 256-bit, time-limited token is used once, within a bounded window, and discarded. Using Argon2 would add ~100ms to every reset click for zero marginal security. SHA-256 hex is the correct primitive (PITFALLS.md #9).
- **Purpose-scoped TTL table** typed as `Readonly<Record<TokenPurpose, number>>` so any future addition to the `TokenPurpose` union (e.g. `"magic_link"` in v2) is a compile error at every `createToken` call site until the TTL table is updated. Union-exhaustive by construction.
- **`isExpired` runs AFTER hash match** (documented in the doc-comment and enforced by downstream consume actions in 02-05/02-06). This blocks timing oracles that could distinguish "hash not found" from "hash found but expired" — an attacker scanning for valid hashes would otherwise get a side-channel signal on which hashes exist.
- **RESEND_FROM_ADDRESS dev default uses `localhost`** precisely because it makes the production refinement a load-bearing safety belt: the default itself would fail prod boot, so forgetting to set the env var in production is a loud, immediate crash rather than a silent "emails from localhost" deliverability failure.
- **`sessionEpoch` as a Number counter**, not a `sessionRevokedAt` timestamp. Counter semantics make the drift check a simple integer compare (`session.epoch < user.sessionEpoch`), are immune to clock skew between app instances, and let us increment atomically with `$inc` in the reset action. Timestamps would require careful UTC handling and would drift on clock resync. (Decision locked in 02-CONTEXT.md §"Session/session-invalidation on reset".)

## Deviations from Plan

None — plan executed exactly as written. All three tasks landed with the exact code blocks specified in the `<action>` sections; no auto-fixes, no architectural changes, no scope changes.

## Issues Encountered

**One process issue (not a code issue):** the Task 3 git commit initially swept in pre-staged files from the pre-session index state (`deferred-items.md`, `app/package.json` + lockfile, `lib/infra/resend/client.ts`, `lib/validation/schemas.ts`) that had been staged by a prior plan-checker fix commit but never committed. These files are outside plan 02-01's scope.

**Resolution:** A non-destructive `git reset --soft HEAD~1` followed by `git restore --staged` on the out-of-scope files, then a re-commit of Task 3 with only `app/src/lib/db/models/user.ts`. All three plan commits are now atomic, scope-clean, and reviewable in isolation. No code changes were lost; the previously-staged files remain in the working tree untouched for future plans (02-02 onwards) to pick up and commit under their own plan IDs.

**Follow-up for Plan 02-02 and later:** the `lib/infra/resend/client.ts` stub currently in the working tree may or may not match what Plan 02-02 wants to ship. Plan 02-02 should Read it first before writing, not blindly overwrite.

## User Setup Required

None — all three changes are code-only. No new env vars are required for dev (RESEND_API_KEY is optional; RESEND_FROM_ADDRESS has a working localhost default). Production deployment in Phase 5 will need to set both `RESEND_API_KEY` (from Resend dashboard) and `RESEND_FROM_ADDRESS` (verified sender on the project's DKIM/SPF/DMARC-configured domain) — that's Phase 5's deploy guide, not this plan's concern.

## Next Phase Readiness

**Wave 1 (this plan)** — COMPLETE. Ready for parallel kickoff:

- **Plan 02-02 (Resend SDK client wrapper)** — can start; imports from `lib/env.ts` (has `RESEND_API_KEY`/`RESEND_FROM_ADDRESS`) and will live in `lib/infra/resend/`. No dependency on tokens or user-schema work.
- **Plan 02-03 (React Email templates)** — can start in parallel with 02-02; pure UI, no runtime dependency on 02-01 at all.

**Wave 2:**

- **Plan 02-04 (session epoch drift check in session.ts)** — unblocked. Will import the `sessionEpoch` field from `UserDoc` and extend `SessionData` with `epoch?: number`, calling `UserModel.findOne({_id:{$eq:session.userId}}).select("sessionEpoch")` inside `requireSession`.

**Wave 3:**

- **Plan 02-05 (verify flow)** and **Plan 02-06 (reset flow)** — both unblocked from the token side; will import `createToken`, `hashToken`, `isExpired` from `lib/auth/tokens.ts` verbatim. Plan 02-06 will also `$inc sessionEpoch` on successful reset.

**No blockers. No concerns.** The foundation is as small, pure, and additive as planned. Rollback is a single `git revert` of three clean commits.

---

## Self-Check: PASSED

Verified claims:

- [x] `app/src/lib/auth/tokens.ts` exists — commit `4c686cd` in `git log`
- [x] `app/src/lib/env.ts` contains `RESEND_API_KEY` and `RESEND_FROM_ADDRESS` — commit `74f125b`
- [x] `app/src/lib/db/models/user.ts` contains `sessionEpoch: { type: Number, default: 0, select: false }` — commit `ec1e0d8`
- [x] `cd app && npx tsc --noEmit` exits 0
- [x] Runtime smoke: plaintext.length === 43, hash.length === 64, isExpired null-safe, env defaults correct
- [x] EMAIL-04 grep acceptance passes (`randomBytes(32)` and `sha256` both present in tokens.ts)
- [x] Production refinement tested: `NODE_ENV=production` with default FROM throws with the exact refinement error message
- [x] All three commits exist in `git log` and contain ONLY the files named in their commit messages

---
*Phase: 02-email-identity*
*Completed: 2026-04-14*
