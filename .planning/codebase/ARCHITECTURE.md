# Architecture

**Analysis Date:** 2026-04-13

## Pattern Overview

**Overall:** Next.js 15 App Router with React Server Components (RSC) + Server Actions. DDD-inspired layering under `app/src/lib/` separates domain logic (auth, content, validation) from persistence and infrastructure. Defense-in-depth security: no auth in middleware (CVE-2025-29927 defense), every server action re-verifies session and checks permissions.

**Key Characteristics:**
- **RSC-first**: Pages are async server components; client interactivity via "use client" boundaries only where needed
- **Server Actions**: Form submissions and mutations routed through `"use server"` functions with full session/auth validation
- **No middleware auth**: Middleware (`app/src/middleware.ts`) handles only security headers and CSRF spoofing defense; all auth checks happen at request time in server actions and layouts
- **Explicit error handling**: Result<T, E> monad for chainable, exception-free workflows
- **Tier-gated content**: Free tier restricted to days 1–3; pro tier unlocks all 14 days
- **Type safety**: Strict TypeScript (noUncheckedIndexedAccess, exactOptionalPropertyTypes); Zod schemas for all input validation

## Layers

**Presentation (Routes & Components):**
- Purpose: Render UI, handle client interactivity, delegate mutations to server actions
- Location: `app/src/app/`
- Contains: Pages (`.tsx`), client components (marked "use client"), route groups `(auth)` and `(app)`
- Depends on: Server actions, auth session, content types
- Used by: Browser / Next.js renderer

**Server Actions (Command Layer):**
- Purpose: Validate input, enforce business rules, call persistence layer, handle redirects
- Location: `app/src/lib/actions/` — files: `auth.ts`, `progress.ts`
- Contains: Exported async functions marked "use server"; return explicit result types or throw
- Depends on: Models, schemas, auth session, rate limiting, audit
- Used by: Client components, server-side layouts

**Domain/Business Logic:**
- Purpose: Encapsulate rules independent of persistence or presentation
- Location: `app/src/lib/auth/`, `app/src/lib/validation/`, `app/src/lib/content/`
- Contains:
  - `auth/`: Password hashing (Argon2id), session management (iron-session), rate limiting (LRU), HIBP checks, credential verification
  - `validation/`: Zod schemas for signup, login, answer submission
  - `content/`: 14-day curriculum types and lookups (static data)
- Depends on: External APIs (HIBP), types
- Used by: Server actions, models

**Persistence (Models & Data Access):**
- Purpose: Mongoose schemas, indexing, type inference; enforce data constraints
- Location: `app/src/lib/db/`
- Contains:
  - `mongo.ts`: Global connection pooling with hot-reload safety
  - `models/user.ts`: User schema (email, password hash, tier, lockout counters)
  - `models/progress.ts`: Quiz progress per (user, day) pair; userId-based ownership checks
  - `models/audit.ts`: Event logging (signup, login, logout, access denies)
- Depends on: Mongoose, database
- Used by: Server actions

**Data Transfer Objects (DTOs):**
- Purpose: Explicit mapping from Mongoose docs to client-safe shapes
- Location: `app/src/lib/dto/user.ts`
- Contains: `UserPublic` type; `toPublicUser()` mapper
- Pattern: Allowlist approach — only fields safe to expose to client
- Used by: Server actions to shape responses

**Infrastructure:**
- Purpose: Environment variables, secrets, external API clients
- Location: `app/src/lib/env.ts`
- Contains: Zod-validated env config; parsed at boot; no direct process.env references elsewhere
- Depends on: process.env, Zod
- Used by: All layers for config values

**Utilities:**
- Purpose: Pure functions without side effects
- Location: `app/src/lib/result.ts`
- Contains: Result<T, E> monad with ok, err, map, flatMap, all, fromPromise
- Pattern: Chainable error handling without exceptions
- Used by: Rate limiter, HIBP, action results

## Data Flow

**Signup Flow:**

1. Client submits form with email + password via `<form action={signup}>`
2. Server action `signup()` runs:
   - Extracts and validates headers (origin, IP, user-agent)
   - Verifies Origin header matches NEXT_PUBLIC_APP_URL (CSRF defense)
   - Checks rate limit: 5 attempts per IP per 60s
   - Parses FormData against SignupSchema (Zod)
   - Checks password strength (zxcvbn score ≥3)
   - Checks HIBP for pwned passwords (k-anonymity via SHA1 prefix)
   - Connects to MongoDB (pooled)
   - Looks up existing email with lean query (no password hash selected)
   - Hashes plain password with Argon2id (OWASP 2024 tuning: 64MB, 3 iters, 4 parallel)
   - Creates UserDoc; defaults tier to "pro"
   - Sets iron-session with userId + email + timestamp
   - Audits event with IP + UA + outcome
   - Redirects to /dashboard on success
3. Protected layout `(app)/layout.tsx` re-checks session; redirects to /login if missing

**Login Flow:**

1. Client submits form via LoginForm component
2. Server action `login()` runs:
   - Same origin/rate-limit/parse checks as signup
   - Queries UserModel with email; selects passwordHash + lockout fields
   - Runs password verify against stored hash even if user not found (constant-time defense against email enumeration)
   - Checks lockedUntil timestamp; rejects if account locked
   - Increments failedLoginCount and sets lockedUntil (progressive backoff) on wrong password
   - Updates lastLoginAt and resets counters on success
   - Sets iron-session identical to signup
   - Audits with userId on success or email on deny
   - Redirects to /dashboard

**Quiz Answer Flow:**

1. Client picks answer in CoursePlayer component; calls `saveAnswer()`
2. Server action `saveAnswer()` runs:
   - Calls `requireSession()` — throws if not authenticated
   - Validates day + questionIndex + choice against SaveAnswerSchema
   - Looks up day in static content; 404 if invalid
   - Connects to MongoDB
   - Queries UserModel; checks tier; returns "locked" error if free tier && day > 3
   - Upserts ProgressDoc: { userId, day, answers (Map), correctCount, updatedAt, completedAt }
   - Revalidates `/course/${day}` and `/dashboard` caches
   - Returns { ok: true, correctCount, completed }
3. CoursePlayer updates local state on success

**State Management:**

- **Session state**: iron-session HttpOnly, SameSite=Strict, 24h max-age
- **Data mutations**: Server actions return typed results; client updates local state on .ok
- **Cache invalidation**: `revalidatePath()` in server actions; ISR with generateStaticParams for `/course/[day]`
- **Client state**: useState for quiz answers, UI toggles; always synced via server action returns

## Key Abstractions

**Result<T, E> Monad:**
- Purpose: Chainable error handling without exceptions
- Examples: `app/src/lib/result.ts`, rate limiter return type
- Pattern:
  ```typescript
  export type Result<T, E> = Ok<T> | Err<E>;
  export const ok = <T>(v: T): Ok<T> => ({ ok: true, value: v });
  export const flatMap = <T, U, E>(r: Result<T, E>, fn: (v: T) => Result<U, E>) => 
    r.ok ? fn(r.value) : r;
  ```

**Zod Schemas for Input Validation:**
- Purpose: Parse and validate FormData, query params, JSON at boundaries
- Examples: `SignupSchema`, `LoginSchema`, `SaveAnswerSchema` in `app/src/lib/validation/schemas.ts`
- Pattern: Define single "email" schema; reuse across signup/login; coerce types (day: z.coerce.number)

**DTOs (Data Transfer Objects):**
- Purpose: Explicit mapping from Mongoose docs to client-safe shapes
- Example: `UserPublic` type excludes passwordHash, failedLoginCount, lockedUntil
- Pattern: One mapper per entity (toPublicUser); server action uses mapper before returning

**Mongoose Models with Ownership Checks:**
- Purpose: Schema definition + index management; enforce domain constraints at data layer
- Example: ProgressModel upserts by { userId, day } unique index; queries always include userId to prevent cross-user access
- Pattern: InferSchemaType for full doc typing; refs for document relationships

**Rate Limiter (Slide Window):**
- Purpose: Defend against brute force and DDoS
- Location: `app/src/lib/auth/rate-limit.ts`
- Pattern: In-process LRU cache per namespace (signup, login) with expiring buckets; compatible with Redis swap
- Used by: signup (5/min), login (10/min)

## Entry Points

**App Root Layout:**
- Location: `app/src/app/layout.tsx`
- Triggers: Every page load
- Responsibilities: Define metadata, load fonts, wrap children in html/body

**Middleware:**
- Location: `app/src/middleware.ts`
- Triggers: On every request (except static files, images)
- Responsibilities: Strip x-middleware-subrequest header (CVE-2025-29927); append security headers via next.config.ts
- Auth: NEVER — deferred to layouts and server actions

**Protected App Layout:**
- Location: `app/src/app/(app)/layout.tsx`
- Triggers: When entering /dashboard, /course/*, /exam
- Responsibilities: Check session.userId exists; redirect to /login if missing; render header with logout button

**Auth Layouts:**
- Location: `app/src/app/(auth)/layout.tsx`
- Triggers: When entering /login, /signup
- Responsibilities: Allow unauthenticated access; render minimal layout

**Server Actions:**
- `signup()`: `app/src/lib/actions/auth.ts`
- `login()`: `app/src/lib/actions/auth.ts`
- `logout()`: `app/src/lib/actions/auth.ts`
- `saveAnswer()`: `app/src/lib/actions/progress.ts`
- `getUserProgress()`: `app/src/lib/actions/progress.ts`
- `getDayAnswers()`: `app/src/lib/actions/progress.ts`

## Error Handling

**Strategy:** Multi-layered:
1. Zod schema validation returns { success: false, error } on parse failure
2. Server actions return typed result objects (e.g., `{ ok: false, error: "rate_limited" }`) instead of throwing
3. Critical ops (password verify, HIBP) fail gracefully: HIBP 404 → assume not pwned; password verify exception → assume invalid
4. Audit layer catches and logs errors without breaking auth flow
5. Unexpected errors fall through as "server_error" after audit

**Patterns:**
- Signup/login: return `{ error: ActionErrorCode }` on validation, rate limit, or business logic failure
- Progress actions: return discriminated union `{ ok: true/false; error? }` with typed results
- No throw in happy path; throw only in `requireSession()` when intentional redirect needed

## Cross-Cutting Concerns

**Logging:** Pino logger (dependency listed but not yet integrated). Currently audit layer logs to MongoDB.

**Validation:** Zod at all boundaries:
- Signup: email (max 254), password (min 12, max 128), displayName (max 60)
- Login: email, password
- Answer: day (1–14), questionIndex (0–199), choice (0–9)

**Authentication:** iron-session HttpOnly cookie:
- Set on signup/login with userId + email + createdAt
- Verified on every server action call via `requireSession()`
- Destroyed on logout via `session.destroy()`
- 24h expiration; refreshed on each action

**Authorization:** Tier-gated access:
- Free tier: access days 1–3 only (checked in `saveAnswer()`)
- Pro tier: access all 14 days
- Check enforced at action time, not route time

---

*Architecture analysis: 2026-04-13*
