# lib/guards

Authorization composition. Every guard returns `Result<GuardedContext, GuardError>` and is
called at **both** page render AND server action entry — defense in depth, never trust
middleware (CVE-2025-29927 lesson).

## What lives here

- `require-session.ts` (existing, lives in `lib/auth/session.ts` for now — Phase 4 may move it).
- `require-tier.ts` (Phase 4) — composes `requireSession` + `canAccessExam` from `lib/billing/`.
- `require-day-access.ts` (Phase 4) — composes `requireSession` + `canAccessDay` from `lib/billing/`.
- `require-role.ts` (Phase 5) — composes `requireSession` + role check; returns `Result<{user}, ForbiddenError>`.

## The contract

Every guard:
1. Re-verifies the session (never trusts middleware).
2. Pulls the user record fresh from Mongo (never trusts cookie payload alone).
3. Applies the rule from `lib/billing/` (entitlements is the source of truth, never inlined).
4. Returns `Result<GuardedContext, GuardError>` — callers `.match` or destructure, no exceptions.

## What does NOT live here

- Pure rules (`canAccessDay`, `canAccessExam`) — those live in `lib/billing/entitlements.ts`.
- Database queries unrelated to the guarded user — those live in domain action files.
- SDK calls — Vendor SDKs live in `lib/infra/`.

## Who imports from here

- Server actions in `lib/actions/*.ts` — call guards at the top, before any work.
- Page server components in `app/(app)/**/page.tsx` — call guards before rendering.
- Layout server components — same pattern.

The same guard runs at render AND action — single source of truth, two enforcement points.
