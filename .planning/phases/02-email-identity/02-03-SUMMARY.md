---
phase: 02-email-identity
plan: 03
subsystem: infra
tags: [resend, react-email, email, transactional-email, server-only, jsx-email]

# Dependency graph
requires:
  - phase: 01-stabilization
    provides: "lib/infra/ scaffold + typed empty barrel + boundary README"
  - phase: 02-email-identity/02-01
    provides: "RESEND_API_KEY + RESEND_FROM_ADDRESS in env schema (Zod)"
provides:
  - "getMailClient() singleton with dev-stub + prod Resend path"
  - "Typed MailClient / SendInput / SendResult exports"
  - "VerifyEmail React Email template (24h expiry copy)"
  - "ResetPassword React Email template (1h expiry + single-use footer)"
  - "Welcome React Email template (post-verify Day 01 CTA)"
  - "Vendor-isolated resend SDK boundary: Resend imported in exactly one file"
affects:
  - "02-04 send.ts narrow wrappers (consumes getMailClient + all three templates)"
  - "02-05 signup flow (calls sendVerifyEmail which will call the wrapper)"
  - "02-06 password reset flow (calls sendResetEmail which will call the wrapper)"
  - "Future welcome/drip-email work (templates folder is the single authoring surface)"

# Tech tracking
tech-stack:
  added:
    - "resend@^6.11.0"
    - "@react-email/components@^0.5.7"
    - "@react-email/render@^1.4.0"
  patterns:
    - "Vendor isolation via lib/infra/{vendor}/ subfolder (Resend is the first populate)"
    - "server-only guard at top of every infra file that holds a real SDK"
    - "Dev-stub fallback for vendors that can boot without credentials (log-and-return-fake-id)"
    - "React Email templates use inline styles only (email client CSS is broken)"
    - "as const on style objects to preserve narrow literal types"
    - "No tracking pixels, no utm parameters, no preview-text dark patterns (ethical-hacking audience)"

key-files:
  created:
    - "app/src/lib/infra/resend/client.ts"
    - "app/src/lib/infra/resend/templates/VerifyEmail.tsx"
    - "app/src/lib/infra/resend/templates/ResetPassword.tsx"
    - "app/src/lib/infra/resend/templates/Welcome.tsx"
  modified:
    - "app/package.json (three runtime deps added to dependencies)"
    - "app/package-lock.json (transitive tree refreshed)"

key-decisions:
  - "Dev stub is triggered on NODE_ENV === development OR missing RESEND_API_KEY, so local dev never needs a real Resend key"
  - "Prod client.emails.send returns { data, error }; we unwrap to { id } and throw with resend_send_failed: { message } on error, matching the error code union the action layer will extend"
  - "Templates use system-ui fallback stack rather than Satoshi/Cabinet Grotesk because email clients (Gmail, Outlook, Apple Mail) don't load web fonts reliably"
  - "Single shared styles literal duplicated across three templates (not extracted) — React Email authoring convention is self-contained files; dedup extraction adds indirection with no real gain"
  - "Render smoke test scaffolding (render-smoke.mjs + render-smoke-tsconfig.json) deleted after verification — it was a one-shot dev helper, not production tooling"

patterns-established:
  - "lib/infra/{vendor}/client.ts is the single SDK sink for that vendor; dev stub and prod path live side-by-side with a single getter (mirrored later by lib/infra/google/client.ts and lib/infra/paddle/client.ts)"
  - "React Email template files self-contain their styles const as { ... } as const — keeps each template auditable in isolation and defeats accidental CSS cross-pollination"
  - "Always run TSX render smoke tests with jsx: react-jsx override via a throwaway tsconfig — Next.js uses jsx: preserve which tsx can't execute standalone"

requirements-completed: [EMAIL-01, EMAIL-02]

# Metrics
duration: 9min
completed: 2026-04-14
---

# Phase 2 Plan 03: Resend + React Email Vendor Boundary Summary

**Vendor-isolated Resend client with dev-stub fallback and three inline-styled React Email templates (VerifyEmail / ResetPassword / Welcome) rendering cleanly at 3.3-3.7KB per template.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-14T12:56:17Z
- **Completed:** 2026-04-14T13:05:47Z
- **Tasks:** 2 of 2
- **Files created:** 4 (client.ts + 3 templates)
- **Files modified:** 2 (package.json, package-lock.json)

## Accomplishments

- `resend@6.11.0`, `@react-email/components@0.5.7`, `@react-email/render@1.4.0` installed as runtime deps
- `lib/infra/resend/client.ts` shipped with typed `MailClient`, `SendInput`, `SendResult` and `getMailClient()` singleton
- Dev stub returns a fake id and logs `[resend:dev] to=xxxx*** subject="..."` — local dev boots with zero Resend credentials
- Production path unwraps `client.emails.send` `{ data, error }` and throws `resend_send_failed: {msg}` on error
- `server-only` guard at top of client.ts blocks the Resend SDK from ever entering a client bundle
- Three React Email templates (VerifyEmail, ResetPassword, Welcome) in `lib/infra/resend/templates/` with inline-only styles and taste-skill voice
- Template palette locked: `#0a0a0b` bg / `#f4f4f6` text / `#bef264` accent / `#8b8c94` dim / `#5a5b62` footer
- Zero tracking pixels, zero utm parameters, zero `className`, zero external CSS
- Render smoke test verified: VerifyEmail 3469 chars, ResetPassword 3709 chars, Welcome 3382 chars — all include expected heading text
- Vendor isolation holds: `grep -rn 'from "resend"' app/src/` returns exactly one line (client.ts)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install resend + @react-email/components + @react-email/render + create client.ts** — `8611f21` (feat)
2. **Task 2: Create VerifyEmail + ResetPassword + Welcome React Email templates** — `ae4c867` (feat)

## Exports Shipped

**`app/src/lib/infra/resend/client.ts`:**
- `getMailClient(): MailClient` — returns dev stub or real Resend-backed client
- `type MailClient = { send: (input: SendInput) => Promise<SendResult> }`
- `type SendInput = { to: string; subject: string; react: ReactElement }`
- `type SendResult = { id: string }`

**`app/src/lib/infra/resend/templates/VerifyEmail.tsx`:**
- `VerifyEmail(props: VerifyEmailProps): ReactElement`
- `type VerifyEmailProps = { link: string }`

**`app/src/lib/infra/resend/templates/ResetPassword.tsx`:**
- `ResetPassword(props: ResetPasswordProps): ReactElement`
- `type ResetPasswordProps = { link: string }`

**`app/src/lib/infra/resend/templates/Welcome.tsx`:**
- `Welcome(props: WelcomeProps): ReactElement`
- `type WelcomeProps = { displayName: string; dashboardUrl: string }`

## Render Smoke Output

Verified via `@react-email/render` with a throwaway `jsx: react-jsx` tsconfig override:

| Template | HTML length | Contains heading text |
| --- | --- | --- |
| VerifyEmail | 3469 chars | `Verify` present |
| ResetPassword | 3709 chars | `Reset` present |
| Welcome | 3382 chars | `Welcome` present |

Smoke test scaffolding files (`render-smoke.mjs`, `render-smoke-tsconfig.json`) were deleted after verification — they are one-shot dev helpers, not production tooling.

## Vendor Isolation Check

```
grep -rn 'from "resend"' app/src/
app/src/lib/infra/resend/client.ts:2:import { Resend } from "resend";
```

Exactly one line. Resend SDK is imported in exactly one file. The boundary contract from `lib/infra/README.md` holds.

## Decisions Made

- **Dev stub trigger:** `NODE_ENV === "development" OR !RESEND_API_KEY` — local dev never needs a real Resend key; the action layer still writes audit events on top of the stub id so local dev matches prod audit cardinality.
- **Error surface:** Prod path throws `Error(resend_send_failed: {message})` on Resend API error; plan 02-04's `send.ts` wrapper catches and maps to the `email_send_failed` ActionErrorCode the auth union already has.
- **Typography:** System-ui stack (`system-ui, -apple-system, sans-serif`) instead of Satoshi/Cabinet Grotesk because email clients don't load web fonts reliably — keeps the brand coherent on rendering platforms we can't control.
- **Style duplication:** Each template carries its own `const styles = { ... } as const` literal even though the three are nearly identical. Extracting a shared file adds indirection and makes each template less auditable in isolation; React Email authoring convention is self-contained files.
- **Plan 02-01 coordination:** Env schema additions (`RESEND_API_KEY`, `RESEND_FROM_ADDRESS`) landed in parallel wave 1 via plan 02-01's commit `74f125b` and were already in HEAD when this plan started client.ts. No env.ts edit was made in this plan's commits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Parallel-wave race on env.ts RESEND fields (auto-resolved)**
- **Found during:** Task 1 (client.ts creation depends on `env.RESEND_API_KEY` + `env.RESEND_FROM_ADDRESS`)
- **Issue:** Plan 02-01 adds these fields in parallel wave 1; if this executor raced ahead of 02-01, tsc would fail on client.ts's env imports.
- **Fix:** Initial mitigation added the fields to env.ts myself using the exact Zod shape from plan 02-01 Task 2. It turned out plan 02-01 had already committed the identical edit to env.ts (commit `74f125b`) before this plan's tsc check ran, so the edit was a no-op merge and env.ts was never touched in this plan's commits.
- **Files modified:** none (no-op merge with 02-01's work)
- **Verification:** `tsc --noEmit` passes clean; `git log -- app/src/lib/env.ts` shows only the 02-01 commit as the RESEND-field source.
- **Committed in:** n/a — no env.ts changes attributable to this plan

**2. [Rule 3 - Blocking] tsx smoke-test JSX runtime mismatch**
- **Found during:** Task 2 (render smoke verification of three templates)
- **Issue:** Templates pass `tsc --noEmit` cleanly under the Next.js-controlled `jsx: preserve` tsconfig, but the standalone `npx tsx render-smoke.mjs` loader defaults to classic JSX (`React.createElement`), throwing `React is not defined` at runtime. Template code is correct; only the harness was wrong.
- **Fix:** Created a throwaway `render-smoke-tsconfig.json` extending the app tsconfig with `{ jsx: "react-jsx", jsxImportSource: "react" }`, pointed tsx at it via `TSX_TSCONFIG_PATH=./render-smoke-tsconfig.json`, re-ran. All three templates rendered 3.3-3.7KB HTML on the first pass.
- **Files modified:** `app/render-smoke.mjs` + `app/render-smoke-tsconfig.json` (both deleted after successful smoke run — one-shot dev helpers)
- **Verification:** `VerifyEmail: true true`, `ResetPassword: true true`, `Welcome: true true`, `LENGTHS: 3469 3709 3382`.
- **Committed in:** n/a — files deleted before Task 2 commit

### Pre-existing (out of scope, logged to deferred-items.md)

**Critical next.js CVEs (12 advisories) reported by `npm audit` during `npm install`** — pre-existing issue with `next@15.2.3` pinned in Phase 1. Per STATE.md decision log: "CVE-2025-66478 (next.js) deferred to Phase 5. Locked floor at 15.2.3 per 01-CONTEXT version-pin policy; mid-phase floor bump would break downstream 01-03/01-05 contracts and needs fresh CVE research." Logged to `.planning/phases/02-email-identity/deferred-items.md` for Phase 5 DEPLOY-01 to pick up.

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking — env race and tsx JSX runtime), 1 pre-existing deferred (next.js CVE floor)
**Impact on plan:** Both auto-fixes were orchestration-level only. No source edits to templates, no shape change to client.ts, no scope creep. Plan 02-03 executed exactly as authored at the code level.

## Issues Encountered

- **Parallel-wave commit attribution drift** — Before plan 02-01's executor finished its cleanup, one of its intermediate commits (`9cdf0ef` in an earlier rebase state) had temporarily attributed my Task 1 files (client.ts, package.json, deferred-items.md) to an 02-01 commit message. When 02-01 rewound and re-committed cleanly as `ec1e0d8`, those files became untracked and this plan committed them under the correct 02-03 attribution. No data loss; the git history now reflects one clean commit per task per plan.

## User Setup Required

No new user-setup artifacts in this plan. Plan 02-01 already documented the Resend dashboard setup (`RESEND_API_KEY` creation, sender domain verification for deploy time). Local dev continues to work without touching Resend at all — the dev stub handles the zero-key path.

## Next Phase Readiness

**Plan 02-04 (`send.ts` narrow wrappers) can now:**
- Import `getMailClient`, `type MailClient`, `type SendInput`, `type SendResult` from `@/lib/infra/resend/client`
- Import `VerifyEmail`, `ResetPassword`, `Welcome` (and their `Props` types) from `@/lib/infra/resend/templates/*`
- Build `sendVerifyEmail(meta, { to, link })`, `sendResetEmail(meta, { to, link })`, `sendWelcomeEmail(meta, { to, displayName, dashboardUrl })` on top of the client singleton
- Call the `audit()` sink on every send (`event: "email_send"` with `meta.kind = "verify" | "reset" | "welcome"`) — client.ts intentionally does NOT audit; that's the wrapper's job

**Plan 02-05 (signup enqueue)** and **Plan 02-06 (reset flow)** are unblocked once 02-04 ships `send.ts`.

**No blockers.** Vendor isolation holds, tsc clean, templates render, dev fallback works without credentials.

## Self-Check: PASSED

- [x] `app/src/lib/infra/resend/client.ts` exists
- [x] `app/src/lib/infra/resend/templates/VerifyEmail.tsx` exists
- [x] `app/src/lib/infra/resend/templates/ResetPassword.tsx` exists
- [x] `app/src/lib/infra/resend/templates/Welcome.tsx` exists
- [x] `.planning/phases/02-email-identity/02-03-SUMMARY.md` exists
- [x] `.planning/phases/02-email-identity/deferred-items.md` exists (logged pre-existing next CVE)
- [x] Task 1 commit `8611f21` present in git log
- [x] Task 2 commit `ae4c867` present in git log
- [x] Vendor isolation: `grep -rn 'from "resend"' app/src/` returns exactly one line (client.ts)
- [x] `cd app && npx tsc --noEmit` exits 0
- [x] No Co-Authored-By: Claude tags on any commit in this plan

---
*Phase: 02-email-identity*
*Completed: 2026-04-14*
