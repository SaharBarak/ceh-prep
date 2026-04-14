# Phase 1: Stabilization — Research

**Researched:** 2026-04-13
**Domain:** Next.js 15 App Router server actions + Mongoose 8 schema hardening + local Mongo dev story
**Confidence:** HIGH (Context7-equivalent: registry-verified versions, official Mongoose docs, official Next.js docs, project-internal pitfalls research already cross-referenced)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Signup 500 fix (STAB-01):**
- Refactor, don't patch. Root cause is `headers()` being re-called inside `audit()` after a Mongoose await — the AsyncLocalStorage request scope is gone.
- Introduce a `ClientMeta` type (`{ ip: string; ua: string; origin: string }`) collected ONCE at the top of every server action, passed explicitly to `audit()`, `rateLimit()`, and anything else that needs request context.
- `audit()` loses its `headers()` call entirely — becomes a pure function of its inputs.
- Same pattern applied retroactively to login and logout actions.
- Verification: integration test that signs up with Mongo offline (simulated timeout) still returns a structured error, never 500.

**Mongoose duplicate index warnings (STAB-02):**
- Remove the explicit `userSchema.index({ email: 1 }, { unique: true })` — field-level `unique: true, index: true` already creates it.
- Remove the explicit `auditSchema.index({ at: 1 }, ...)` — field-level `index: true` on `at` already creates it.
- Keep the TTL behavior — but prefer the field-level `expires` shortcut (see Architecture Patterns) over an explicit `index()` call.
- Verification: `npm run dev` boots with zero `[MONGOOSE] Warning` lines.

**Page-level tier gate (STAB-03):**
- Server-side check in `course/[day]/page.tsx` BEFORE any content renders.
- Free users hitting day 4+ are redirected to `/pricing?from=day-{n}` (so pricing knows to show contextual upgrade copy).
- Use `redirect()` from `next/navigation` (NOT `router.push`).
- The `canAccessDay(tier, day)` pure function in `lib/billing/entitlements.ts` is the source of truth (Phase 1 stub: `tier === "free" ? day <= 3 : true`).
- Same function imported by both the existing `saveAnswer` action AND the new page gate — single source of truth.

**Version pin policy (STAB-04, STAB-05):**
- Exact pins on `next` and `mongoose` (CVE-sensitive). Caret on everything else.
- Pin `next@15.2.3` (CVE-2025-29927 minimum) and `mongoose@8.9.5` (CVE-2025-23061 minimum).
- Verification: `npm ls next` and `npm ls mongoose` show exact pins.

**Local dev Mongo path (STAB-06):**
- Default = `mongodb-memory-server` so `npm run dev` "just works" with zero setup.
- On dev boot, if `MONGO_URI` is absent OR starts with `memory://`, spin up an in-process Mongo via `MongoMemoryServer.create()` and swap the URI at runtime.
- Docker Compose at `app/docker-compose.yml` for developers who want a persistent dev Mongo.
- Tests (Phase 5) reuse the same `mongodb-memory-server` dependency via `globalSetup`.
- `.env.example` documents all three options (memory-server default, docker compose, Atlas production).

**Atlas production wiring (STAB-07):**
- No secrets in this commit. Deploy guide (Phase 5) walks through Atlas setup.
- Update `connectDB` options: `maxPoolSize: 5`, `maxIdleTimeMS: 30_000`, `serverSelectionTimeoutMS: 8_000`, `minPoolSize: 0`, `bufferCommands: false`.
- Connection cache across hot reloads already exists — keep it, extend options only.

**Folder stubs (STAB-08):**
- Each of `lib/infra/`, `lib/guards/`, `lib/billing/` gets a `README.md` (boundary doc) + `index.ts` (typed re-export, initially empty).
- `lib/infra/README.md`: "Vendor SDKs live here. Domain layers NEVER import from infra/ directly."
- `lib/guards/README.md`: "Guards compose `requireSession()` with additional authorization checks. Every guard returns `Result<GuardedContext, GuardError>`. Called at BOTH page render AND server action entry."
- `lib/billing/README.md`: "Pure domain rules. No SDK imports. No I/O. `canAccessDay(tier, day)` is the single source of truth."

**User schema extension (STAB-09):**
- All new fields nullable (`default: null`), sparse-indexed where applicable, additive only.
- New fields:
  - `emailVerifiedAt: Date | null`
  - `googleSub: string | null` (sparse unique index)
  - `paddleCustomerId: string | null` (sparse unique index)
  - `role: "user" | "admin"` (default `"user"`)
  - `emailVerifyTokenHash: string | null`
  - `passwordResetTokenHash: string | null`
  - `emailVerifyTokenExpiresAt: Date | null`
  - `passwordResetTokenExpiresAt: Date | null`
- DTO mapper extended to expose `emailVerifiedAt` + `role` publicly. NEVER exposes `googleSub`, `paddleCustomerId`, or any token hash.
- The existing `tier` field's default flips from `"pro"` to `"free"` so new signups correctly enter the free tier.

### Claude's Discretion

- Exact error codes for the `ClientMeta` refactor (extend the existing `ActionState.error` discriminated union).
- The `MongoMemoryServer.create()` cache behavior across hot reloads (must match the existing `connectDB` global cache pattern so a single in-process Mongo survives reloads).
- README tone for the three `lib/` READMEs (match the taste-skill aesthetic of the existing PLAN.md: tight, declarative, no fluff).
- Whether to add a `scripts/check-no-eq.sh` linter stub now or defer to Phase 5 CI (recommendation: stub now, wire into CI in Phase 5).

### Deferred Ideas (OUT OF SCOPE)

None surfaced. Every "what about X" idea belongs to Phases 2-5 and is already mapped in REQUIREMENTS.md. Notably out of scope for Phase 1:
- Email sending / Resend (Phase 2)
- Token primitive `lib/auth/tokens.ts` (Phase 2)
- Google OAuth (Phase 3)
- Paddle integration (Phase 4)
- Production CSP rewrite, pino wiring, Upstash rate limit (Phase 5)
- Tests + CI (Phase 5)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STAB-01 | Signup POST completes without 500 — collect client meta once, pass to audit as parameters | `ClientMeta` pattern + Pitfall 20 (headers-after-await); §"Architecture Pattern 1: ClientMeta Capture-Once" |
| STAB-02 | Mongoose boots without duplicate-index warnings on `user.email` and `audit.at` | Mongoose v8 docs confirm field-level `unique: true` AND `expires: '90d'` are sufficient; §"Architecture Pattern 2: Mongoose Index De-duplication" |
| STAB-03 | Tier gate at page render — free users redirected to `/pricing` for day 4+ | Next.js 15 `redirect()` is safe inside async server components when called BEFORE returning JSX; §"Architecture Pattern 4: Page-Level Server Redirect" |
| STAB-04 | Next.js pinned to ≥15.2.3 (CVE-2025-29927) | Registry-verified: 15.2.3 is the CVE-fix floor; latest stable 15.x is 15.5.15. Exact pin per decision. |
| STAB-05 | Mongoose pinned to ≥8.9.5 (CVE-2025-23061) | Registry-verified: 8.9.5 is the CVE-fix floor; latest 8.x is 8.23.0; Mongoose 9.x is breaking and out of scope. |
| STAB-06 | Local dev works without live Mongo — `mongodb-memory-server` OR Docker Compose | mongodb-memory-server v11.0.1 is current; supports `MongoMemoryServer.create()` static factory; §"Architecture Pattern 3: Conditional connectDB w/ memory-server fallback" |
| STAB-07 | Atlas M0 wired with `maxPoolSize: 5`, `maxIdleTimeMS: 30000` | Verified against MongoDB Atlas service limits docs (M0 = 100 total connection cap); existing `connectDB` cache survives hot reloads — extend options only. |
| STAB-08 | `lib/infra/`, `lib/guards/`, `lib/billing/` scaffolded with README + `index.ts` | Boundary doc pattern; existing DDD layering in CONVENTIONS.md is the source of truth. |
| STAB-09 | User schema extended with 8 new additive fields | Mongoose 8 sparse-unique-index pattern; all new fields are `default: null` so existing docs auto-migrate; §"Architecture Pattern 5: Sparse Unique on Optional Identity Fields" |
</phase_requirements>

## Summary

Phase 1 is a surgical bug-fix + scaffold pass on an existing Next.js 15 + Mongoose 8 SaaS. Zero new user-facing features ship — the entire purpose is unblocking Phases 2-5 by killing the four bugs corrupting the integration baseline (signup 500, duplicate Mongo indexes, broken local dev, soft tier gate), pinning the two CVE-patched versions (`next@15.2.3`, `mongoose@8.9.5`), and laying down the `lib/infra/` + `lib/guards/` + `lib/billing/` folder boundaries so Phases 2-5 don't fight the same surface.

The technical hard parts are all known and verified: (1) the `headers()`-after-await bug is fixed by the **ClientMeta capture-once** pattern (collect IP/UA/Origin synchronously at the top of every server action, before any `await`, then pass as a plain object to `audit()`); (2) the Mongoose duplicate index warning is fixed by **picking a single index source per field** — for `user.email` keep field-level `unique: true` and drop the schema-level `.index()`, and for `audit.at` use the field-level `expires: '90d'` shortcut and drop both the field-level `index: true` and the schema-level `.index()`; (3) `mongodb-memory-server` integrates into the existing `globalThis.__mongooseCache` pattern by adding a parallel `globalThis.__memoryMongo` cache that survives Next.js dev HMR and rewrites `process.env.MONGO_URI` exactly once before `mongoose.connect()`; (4) `redirect()` from `next/navigation` is safe in async server components as long as it's called outside any `try/catch` (it throws an internal Next.js error to trigger the redirect).

**Primary recommendation:** Implement in five surgical steps in this order — (1) `ClientMeta` refactor first because it unblocks every other test; (2) `connectDB` extension with `mongodb-memory-server` second because every other change needs a working Mongo; (3) Mongoose model cleanup + User schema extension third (single PR, both models, additive only); (4) `lib/billing/entitlements.ts` + `lib/guards/` + `lib/infra/` scaffolding fourth (parallel-safe with #3); (5) page-level tier gate in `course/[day]/page.tsx` last, importing the entitlements function from #4.

## Standard Stack

### Core (already locked, version-pinned this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | `15.2.3` (exact) | Framework | CVE-2025-29927 minimum-fix floor; exact pin prevents accidental drift past known-safe range |
| `mongoose` | `8.9.5` (exact) | ODM | CVE-2025-23061 (`$or`-nested NoSQLi) minimum-fix floor; exact pin per decision |
| `react` | `19.0.0` (existing) | UI runtime | Already locked |
| `iron-session` | `^8.0.4` (existing) | Session cookies | Already locked |
| `zod` | `^3.24.1` (existing) | Boundary validation | Already locked |
| `@node-rs/argon2` | `^2.0.2` (existing) | Password hashing | Already locked |

### Supporting (new this phase)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `mongodb-memory-server` | `^11.0.1` (devDependency) | In-process MongoDB for dev + Phase 5 tests | Default dev path when `MONGO_URI` is absent or starts with `memory://`; reused by Vitest `globalSetup` in Phase 5 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `mongodb-memory-server` (in-process) | Docker Compose w/ `mongo:7` only | Docker is more "real" but requires the developer to remember `docker compose up`. Memory-server boots in ~2s with zero setup. **Decision: ship both. Memory-server is default; Docker Compose is documented as the persistent alternative.** |
| Field-level `expires: '90d'` shortcut on `audit.at` | Explicit `auditSchema.index({ at: 1 }, { expireAfterSeconds: 60*60*24*90 })` | Both produce the same MongoDB TTL index. Field-level shortcut is one less line and removes the duplicate-index warning entirely. **Decision: use the shortcut.** |
| Pinning `next@15.5.15` (latest stable) | Exact pin at the CVE floor `15.2.3` | Latest stable has more features and bug fixes but bigger blast radius if a regression slips. **Decision per CONTEXT.md: pin at `15.2.3` (the minimum CVE-safe version) and bump deliberately.** |
| Pinning `mongoose@8.23.0` (latest 8.x) | Exact pin at `8.9.5` | Same tradeoff. **Decision per CONTEXT.md: pin at `8.9.5`.** Note: Mongoose 9.x exists but is a breaking release — out of scope for Phase 1. |

**Installation:**
```bash
cd app
npm install --save-exact next@15.2.3 mongoose@8.9.5
npm install --save-dev mongodb-memory-server@^11.0.1
```

**Version verification:**
```bash
cd app
npm view next version           # latest stable line
npm view mongoose version       # latest stable line
npm view mongodb-memory-server version
npm ls next mongoose mongodb-memory-server
```

Confirmed against the npm registry on 2026-04-13:
- `next` latest stable: `15.5.15` (we pin to `15.2.3` per CVE floor decision)
- `mongoose` latest 8.x: `8.23.0` (we pin to `8.9.5` per CVE floor decision)
- `mongoose` latest overall: `9.4.1` (out of scope — Mongoose 9 is breaking)
- `mongodb-memory-server` latest: `11.0.1` (current; matches Mongoose 8 contract)

## Architecture Patterns

### Recommended Project Structure (additions only — existing layout is locked)

```
app/
├── docker-compose.yml                 # NEW (STAB-06) — persistent dev Mongo path
├── .env.example                       # UPDATED (STAB-06) — three-option comment block
├── package.json                       # UPDATED (STAB-04, STAB-05, STAB-06)
└── src/
    └── lib/
        ├── actions/
        │   └── auth.ts                # REFACTORED (STAB-01) — ClientMeta pattern
        ├── db/
        │   ├── mongo.ts               # EXTENDED (STAB-06, STAB-07) — memory-server fork + pool tuning
        │   └── models/
        │       ├── user.ts            # EXTENDED (STAB-02, STAB-09) — drop dup index, add 8 fields, flip tier default
        │       └── audit.ts           # FIXED (STAB-02) — drop dup index, use `expires` shortcut
        ├── dto/
        │   └── user.ts                # EXTENDED (STAB-09) — expose emailVerifiedAt + role
        ├── billing/                   # NEW (STAB-08)
        │   ├── README.md
        │   ├── index.ts
        │   └── entitlements.ts        # canAccessDay stub (Phase 4 fully populates)
        ├── guards/                    # NEW (STAB-08)
        │   ├── README.md
        │   └── index.ts
        ├── infra/                     # NEW (STAB-08)
        │   ├── README.md
        │   └── index.ts
        └── content/
            └── (untouched — existing isFreeDay() will be replaced by canAccessDay)
    └── app/
        └── (app)/
            └── course/
                └── [day]/
                    └── page.tsx       # EXTENDED (STAB-03) — server-side tier redirect
```

### Pattern 1: ClientMeta Capture-Once (STAB-01)

**What:** Capture all request-scoped metadata (`ip`, `ua`, `origin`) synchronously at the very top of a server action, before any `await`, then pass the resulting plain object explicitly to every helper that needs it (`audit`, `rateLimit`, `verifyOrigin`). The helpers stop calling `headers()` themselves.

**When to use:** Every server action that performs DB work AND audit logging. Currently: `signup`, `login`, `logout`. Future: every action added in Phases 2-4.

**Why it works:** Next.js 15's `headers()` reads from AsyncLocalStorage that's tied to the inbound HTTP request. The storage is reliable on the synchronous path from the action entry point, but is NOT guaranteed across `await` boundaries — particularly when the awaited operation (like `mongoose.connect()` against a dead host) holds the event loop long enough for the request scope to be torn down. By reading `headers()` exactly once, synchronously, and stashing the values into a plain object, we sever the dependency on AsyncLocalStorage for the entire async tail of the action.

**Example:**
```typescript
// app/src/lib/actions/auth.ts
"use server";

import { headers } from "next/headers";

export type ClientMeta = {
  readonly ip: string;
  readonly ua: string;
  readonly origin: string;
};

/**
 * MUST be called synchronously at the top of every server action,
 * BEFORE any `await connectDB()` or other long-running operation.
 *
 * The returned ClientMeta is then passed explicitly to audit() and
 * rateLimit() — neither helper calls headers() internally anymore.
 */
const captureClientMeta = async (): Promise<ClientMeta> => {
  const h = await headers(); // Next 15: headers() is async
  return {
    ip:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      "unknown",
    ua: h.get("user-agent")?.slice(0, 256) ?? "unknown",
    origin: h.get("origin") ?? "",
  };
};

const audit = async (
  meta: ClientMeta,
  event: string,
  outcome: "ok" | "deny" | "error",
  payload: Record<string, unknown>,
  userId?: string,
): Promise<void> => {
  // PURE — no headers() call. All request data comes in via `meta`.
  try {
    await AuditModel.create({
      event,
      outcome,
      ip: meta.ip,
      ua: meta.ua,
      meta: payload,
      userId: userId ?? null,
    });
  } catch {
    // Audit failures must never break the auth flow.
  }
};

export const signup = async (
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> => {
  // STEP 1 (sync-ish): capture meta BEFORE any DB await
  const meta = await captureClientMeta();

  if (!verifyOrigin(meta.origin)) {
    await audit(meta, "signup", "deny", { reason: "origin_mismatch" });
    return { error: "forbidden_origin" };
  }

  const limit = rateLimit("signup", meta.ip, 5, 60_000);
  if (!limit.ok) {
    await audit(meta, "signup", "deny", { reason: "rate_limit" });
    return { error: "rate_limited" };
  }

  // ... validation ...

  try {
    await connectDB(); // safe — headers() is no longer needed past this point

    // ... user lookup, create, session, etc ...

    await audit(meta, "signup", "ok", { email }, doc._id.toString());
  } catch (e) {
    await audit(meta, "signup", "error", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return { error: "server_error" };
  }

  redirect("/dashboard");
};
```

Source: `.planning/research/PITFALLS.md` Pitfall 20; verified against Next.js 15 docs on `headers()` request-scope semantics.

### Pattern 2: Mongoose Index De-duplication (STAB-02)

**What:** Pick **exactly one** source of truth for each MongoDB index. Field-level `unique: true` and `index: true` MUST NOT coexist with a `schema.index()` call covering the same key. For TTL indexes, prefer the field-level `expires: '<duration>'` shortcut over a schema-level call.

**When to use:** Every Mongoose model. Audit on every PR.

**Why it works:** Mongoose translates field-level `unique: true` into an internal `schema.index({ field: 1 }, { unique: true })` call at schema build time. If the developer ALSO writes an explicit `schema.index({ field: 1 }, { unique: true })`, Mongoose's index syncer detects two definitions of the same index spec, MongoDB only creates one, and Mongoose emits the noisy `[MONGOOSE] Warning: Duplicate schema index on {"field":1}` to stderr on every boot. The TTL warning is the same bug — `auditSchema.index({ at: 1 }, { expireAfterSeconds: ... })` collides with the field-level `index: true` on `at`.

**The `expires` shortcut:** Mongoose's `SchemaDateOptions` supports `expires`, which is syntactic sugar that creates a TTL index on a Date field with no separate `schema.index()` call. Setting `expires: '90d'` (or `expires: 60*60*24*90`) on the field automatically creates `{ expireAfterSeconds: 7776000 }` and removes the need for any explicit index call. **It also obsoletes the field-level `index: true`** — the TTL index IS the index.

**Example — User model fix:**
```typescript
// app/src/lib/db/models/user.ts (excerpt)
const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,        // <-- creates the unique index
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    // ... other fields ...
  },
  { versionKey: false, collection: "users" },
);

// REMOVED: userSchema.index({ email: 1 }, { unique: true });
// Field-level `unique: true` already creates this index.
// Sparse-unique indexes for new identity fields are declared at the field level too:
//   googleSub:        { type: String, default: null, unique: true, sparse: true },
//   paddleCustomerId: { type: String, default: null, unique: true, sparse: true },
```

**Example — Audit model fix:**
```typescript
// app/src/lib/db/models/audit.ts (excerpt)
const auditSchema = new Schema(
  {
    at: {
      type: Date,
      default: Date.now,
      expires: "90d",   // <-- TTL shortcut. Creates the only index `at` needs.
                        //     REPLACES BOTH the field-level `index: true`
                        //     AND the schema-level .index() call.
    },
    event:   { type: String, required: true, maxlength: 64 },
    outcome: { type: String, enum: ["ok", "deny", "error"], required: true },
    userId:  { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    ip:      { type: String, default: "", maxlength: 64 },
    ua:      { type: String, default: "", maxlength: 256 },
    meta:    { type: Schema.Types.Mixed, default: {} },
  },
  { versionKey: false, collection: "audit" },
);

// REMOVED: auditSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });
```

**Migration note:** Existing collections in dev/Atlas may already have BOTH indexes defined (one from each source). On first boot after this fix, Mongoose's `syncIndexes()` won't drop the orphan — you have to drop it manually. Document this in the deploy guide (Phase 5):
```javascript
// In a one-off Atlas shell session, after deploying:
db.users.dropIndex("email_1");   // only if a duplicate exists alongside the new auto-index
db.audit.dropIndex("at_1");
// Then restart the app — Mongoose recreates them with the correct definition.
```

For local dev, this is a non-issue — `mongodb-memory-server` starts fresh on every boot.

Source: Mongoose v9 docs on `SchemaDateOptions.expires` (API stable since v6); GitHub issue Automattic/mongoose#2459 confirms the duplicate-warning behavior.

### Pattern 3: Conditional `connectDB` with Memory-Server Fallback (STAB-06, STAB-07)

**What:** Extend the existing `globalThis.__mongooseCache` pattern in `app/src/lib/db/mongo.ts` with a parallel `globalThis.__memoryMongo` cache that holds a single `MongoMemoryServer` instance across Next.js dev HMR. On `connectDB()`, branch on `env.MONGO_URI`: if it's missing or starts with `memory://`, lazily start (or reuse) the in-process Mongo, swap the URI, and proceed to `mongoose.connect()` exactly as before. Add the Atlas-tuned options unconditionally — they're safe for both real and in-memory connections.

**When to use:** Every dev environment by default. CI tests reuse the same code path via the `MONGO_URI=memory://` sentinel value (Phase 5 wires this up in `vitest.globalSetup.ts`, no code changes needed in `mongo.ts`).

**Why it works:** Next.js dev mode re-imports modules on every file change (HMR), but does NOT restart the Node process — `globalThis` persists across reloads. The existing connection cache already exploits this. Adding a parallel `globalThis.__memoryMongo` cache means the in-process Mongo lives for the entire `next dev` session, not just one request.

**Hot-reload safety:** This is the single trickiest detail in Phase 1. The order of operations matters:
1. Check `globalThis.__memoryMongo` — if set, reuse its URI.
2. If not set AND `env.MONGO_URI` indicates memory mode, call `MongoMemoryServer.create()`, store the instance on `globalThis`, and set the URI.
3. Pass the resolved URI to `mongoose.connect()`.
4. The mongoose connection cache (already present) persists the connection across HMR.
5. Never call `mongo.stop()` from inside `connectDB()` — the memory server lives until the dev process dies. Process exit handlers can clean it up if needed, but they're not required (the OS reclaims the port and disk on process exit).

**Example — `app/src/lib/db/mongo.ts`:**
```typescript
import "server-only";
import mongoose from "mongoose";
import type { MongoMemoryServer } from "mongodb-memory-server";
import { env } from "@/lib/env";

/**
 * Connection caching across Next.js hot reloads.
 *
 * - `__mongooseCache`  : holds the single Mongoose connection promise so HMR
 *                       doesn't open dozens of sockets to Atlas.
 * - `__memoryMongo`    : holds the single MongoMemoryServer instance so HMR
 *                       doesn't spin up dozens of in-process Mongo daemons.
 *
 * Both caches must outlive any module reload but die with the dev process.
 */

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

type MemoryMongoCache = {
  instance: MongoMemoryServer | null;
  uri: string | null;
};

const g = globalThis as unknown as {
  __mongooseCache?: MongooseCache;
  __memoryMongo?: MemoryMongoCache;
};

g.__mongooseCache ??= { conn: null, promise: null };
g.__memoryMongo ??= { instance: null, uri: null };

const cache = g.__mongooseCache;
const memCache = g.__memoryMongo;

const MEMORY_SCHEME = "memory://";

const isMemoryMode = (uri: string | undefined): boolean =>
  !uri || uri.startsWith(MEMORY_SCHEME);

const resolveUri = async (): Promise<string> => {
  if (!isMemoryMode(env.MONGO_URI)) return env.MONGO_URI;

  if (memCache.uri) return memCache.uri;

  // Lazy-import so production bundles don't pull in the dev-only package.
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const server = await MongoMemoryServer.create({
    instance: { dbName: "ceh-prep" },
  });

  memCache.instance = server;
  memCache.uri = server.getUri();

  // Single-line dev signal so the developer knows what's running.
  // (Replace with pino in Phase 5 once the logger boundary lands.)
  // eslint-disable-next-line no-console
  console.log(`[mongo] in-process MongoMemoryServer at ${memCache.uri}`);

  return memCache.uri;
};

export const connectDB = async (): Promise<typeof mongoose> => {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const uri = await resolveUri();
    cache.promise = mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8_000,
      maxPoolSize: 5,           // STAB-07: down from 10 for Atlas M0
      minPoolSize: 0,           // Don't hold connections idle on M0
      maxIdleTimeMS: 30_000,    // Free M0 slots after 30s idle
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
};
```

**Required env.ts change:** `MONGO_URI` becomes optional in the Zod schema (or accepts the `memory://` sentinel):
```typescript
// app/src/lib/env.ts (excerpt)
const ServerEnvSchema = z.object({
  // ... other vars ...
  MONGO_URI: z
    .string()
    .min(1)
    .default("memory://")
    .refine(
      (v) => v.startsWith("memory://") || v.startsWith("mongodb://") || v.startsWith("mongodb+srv://"),
      { message: "MONGO_URI must be memory://, mongodb://, or mongodb+srv://" }
    ),
});
```

**`.env.example` template:**
```
# ─────────────────────────────
# MongoDB
# ─────────────────────────────
# Three options:
#
# 1. (DEFAULT) In-process via mongodb-memory-server. Zero setup. Boots in ~2s.
#    Either omit MONGO_URI or set it to:
#      MONGO_URI=memory://
#
# 2. Local Docker Compose. Run `docker compose up -d` from app/, then:
#      MONGO_URI=mongodb://localhost:27017/ceh-prep
#
# 3. MongoDB Atlas (production). Get the SRV string from the Atlas UI:
#      MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/ceh-prep?retryWrites=true&w=majority
#
MONGO_URI=memory://
```

**`docker-compose.yml`:**
```yaml
services:
  mongo:
    image: mongo:7
    container_name: ceh-prep-mongo
    ports:
      - "27017:27017"
    volumes:
      - ceh-prep-mongo-data:/data/db
    restart: unless-stopped
volumes:
  ceh-prep-mongo-data:
```

Source: official `mongodb-memory-server` README (v11.0.1) confirms `MongoMemoryServer.create()` is the canonical static factory; vercel/next.js Discussion #26427 confirms the `globalThis` HMR-survival pattern; mongoose Next.js integration guide confirms the connection cache pattern.

### Pattern 4: Page-Level Server Redirect (STAB-03)

**What:** In an async server component (`page.tsx`), call `redirect()` from `next/navigation` immediately after the tier check, BEFORE any JSX is returned. Do not wrap it in `try/catch`. Do not `return redirect(...)` — `redirect()` has the TypeScript `never` return type and throws an internal Next.js redirect signal.

**When to use:** Every page-level authorization gate that needs to short-circuit rendering and send the user to a different route. Phase 1 uses it once (`course/[day]/page.tsx`); Phases 2-5 will reuse the pattern in admin layouts and verify-required gates.

**Why it works:** `redirect()` works by throwing a special `NEXT_REDIRECT` error that Next.js's request pipeline catches at the boundary of the React render tree. Wrapping it in `try/catch` swallows that error and the redirect silently fails. Calling it after a `return` is unreachable. The correct pattern is "check, redirect-or-fall-through, render."

**Example:**
```tsx
// app/src/app/(app)/course/[day]/page.tsx (excerpt)
import { redirect, notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";  // existing helper
import { connectDB } from "@/lib/db/mongo";
import { UserModel } from "@/lib/db/models/user";
import { canAccessDay } from "@/lib/billing/entitlements";
import { getDay, DAYS } from "@/lib/content";
import { getDayAnswers } from "@/lib/actions/progress";

export default async function CourseDayPage({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const { day: dayParam } = await params;
  const n = Number.parseInt(dayParam, 10);
  if (!Number.isFinite(n) || n < 1 || n > 14) notFound();

  // STEP 1: re-verify session (defense-in-depth — never trust middleware)
  const session = await requireSession();

  // STEP 2: page-level tier gate (NEW — STAB-03)
  await connectDB();
  const user = await UserModel
    .findOne({ _id: { $eq: session.userId } })
    .select("tier")
    .lean();

  if (!user || !canAccessDay(user.tier, n)) {
    redirect(`/pricing?from=day-${n}`);
    // unreachable — redirect() throws
  }

  // STEP 3: render (unchanged from current implementation)
  const day = getDay(n);
  if (!day) notFound();
  const answers = await getDayAnswers(n);
  // ... rest of the existing JSX ...
}
```

**Critical:** the `redirect()` call lives OUTSIDE any `try/catch`. If you must wrap DB calls, wrap only the DB call:
```typescript
let user;
try {
  user = await UserModel.findOne({ _id: { $eq: session.userId } }).lean();
} catch {
  user = null;
}
if (!user || !canAccessDay(user.tier, n)) {
  redirect(`/pricing?from=day-${n}`);  // outside the try
}
```

Source: Next.js 15 official docs on `redirect()`; confirms the `never` return type and the throw-based mechanism.

### Pattern 5: Sparse Unique on Optional Identity Fields (STAB-09)

**What:** For nullable identity fields that must be unique when present (`googleSub`, `paddleCustomerId`), use Mongoose's `sparse: true` index option in combination with `unique: true`. A sparse-unique index only enforces the uniqueness constraint on documents where the field is non-null, so existing users (with `null`) don't all collide on the unique key.

**When to use:** Every optional identity field added in Phases 2-5. Phase 1 sets up two of them (`googleSub`, `paddleCustomerId`); Phase 2 adds none; Phase 3 populates `googleSub`; Phase 4 populates `paddleCustomerId`.

**Why it works:** Without `sparse: true`, MongoDB's unique index treats `null` as a value, so the second user with a `null googleSub` violates the uniqueness constraint and signup fails. `sparse: true` says "only index documents where this field is set" — exactly the semantics you want for optional identity links.

**Example — User schema additions:**
```typescript
// app/src/lib/db/models/user.ts (additive fields only)
const userSchema = new Schema(
  {
    // ── existing fields (unchanged) ────────
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, maxlength: 60, default: "" },
    tier: { type: String, enum: ["free", "pro"], default: "free" }, // ⚠ default flipped from "pro" to "free" (STAB-09)
    failedLoginCount: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },
    createdAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date, default: null },

    // ── new fields (STAB-09) ───────────────
    emailVerifiedAt: { type: Date, default: null },

    // Sparse-unique identity links — null until linked, unique once set
    googleSub: { type: String, default: null, unique: true, sparse: true },
    paddleCustomerId: { type: String, default: null, unique: true, sparse: true },

    // Role for admin gating (Phase 5 promotes via CLI script)
    role: { type: String, enum: ["user", "admin"], default: "user" },

    // Email verification token (Phase 2 populates / consumes)
    emailVerifyTokenHash: { type: String, default: null, select: false },
    emailVerifyTokenExpiresAt: { type: Date, default: null, select: false },

    // Password reset token (Phase 2 populates / consumes)
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetTokenExpiresAt: { type: Date, default: null, select: false },
  },
  { versionKey: false, collection: "users" },
);

// NO schema.index() calls — every index above is field-level.
```

**DTO mapper extension (`app/src/lib/dto/user.ts`):**
```typescript
// Extend the existing allowlist — DO NOT replace it.
// Allowlist semantics: the DTO mapper STARTS with an empty object
// and only copies fields that are explicitly in the allowlist.
// Token hashes and Paddle/Google IDs MUST NOT appear in this list.
export const PUBLIC_USER_FIELDS = [
  "_id",
  "email",
  "displayName",
  "tier",
  "createdAt",
  "lastLoginAt",
  // STAB-09 additions:
  "emailVerifiedAt",
  "role",
] as const;
```

Source: Mongoose v8 docs on sparse indexes; existing CONVENTIONS.md DTO allowlist pattern.

### Anti-Patterns to Avoid

- **Calling `headers()` inside a helper that runs after `await`.** This is the entire reason signup is broken. Capture once, pass explicitly.
- **Wrapping `redirect()` in `try/catch`.** Swallows the internal `NEXT_REDIRECT` throw, silently breaks the redirect.
- **Defining the same Mongoose index twice (field-level + schema-level).** Triggers the duplicate-index warning on every boot. Pick one.
- **Using `connectDB()` from a client component.** The whole module is `server-only` — adding `import "server-only"` at the top causes Next.js to throw a build error if a client file imports it (which is exactly what you want).
- **Calling `MongoMemoryServer.create()` inside a per-request scope without a global cache.** Spawns a new Mongo daemon on every HMR reload, leaks ports, exhausts file descriptors within minutes.
- **Using `lookup` semantics in `connectDB` that mutate `process.env`.** Read `env.MONGO_URI` once via the Zod-validated `env` module; do NOT write back to `process.env`. The resolved URI lives only in the in-memory cache.
- **Putting `tier: "pro"` as the User model default.** Phase 1 explicitly flips this to `"free"`. New signups MUST land in the free tier so Phase 4's paywall is meaningful.
- **Adding a non-sparse unique index on a nullable identity field.** Two users with `null googleSub` collide on the unique key. Always pair `unique: true` with `sparse: true` for optional identity links.
- **Importing `mongodb-memory-server` at the top of `mongo.ts`.** It's a devDependency; production bundles MUST NOT pull it in. Use the lazy `await import(...)` pattern shown in Pattern 3.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| In-memory Mongo for dev/tests | A custom mock layer over Mongoose | `mongodb-memory-server` v11.0.1 | Real Mongo binaries, real query semantics, real index behavior. Mocks drift from production within weeks. |
| TTL index for audit logs | Manual `setInterval` cleanup or cron job | Mongoose field-level `expires: '90d'` | MongoDB's TTL monitor runs every 60s server-side. Zero application code, zero failure modes. |
| Server-side redirect from a page | `useRouter().push()` in a client component or `Response.redirect()` | `redirect()` from `next/navigation` | Page-level gates MUST be server-side — otherwise the gated content reaches the client briefly, defeating the gate. |
| Connection pooling across HMR | New `mongoose.connect()` on every request | The existing `globalThis.__mongooseCache` pattern | Mongoose's official Next.js integration guide. Already in the codebase — extend, don't replace. |
| Header capture timing | Race-prone re-entry into `headers()` after `await` | The `ClientMeta` capture-once pattern (Pattern 1) | The async storage scope is gone after long awaits. Capture sync, pass explicit. |
| Free-tier day check | Inline `day <= 3` literals scattered across action + page | A single `canAccessDay(tier, day)` pure function in `lib/billing/entitlements.ts` | Single source of truth. Phase 4 extends with subscription-status awareness; if the rule is inlined in two places they will drift. |

**Key insight:** Phase 1 is a discipline phase. Every "I'll just inline this for now" decision creates a Phase 2-5 conflict. The folder scaffolding and the `canAccessDay` function exist specifically so the next four phases have stable insertion points and never need to refactor each other's code.

## Common Pitfalls

### Pitfall 1: `headers()` called outside request scope (Pitfall 20 in PITFALLS.md)

**What goes wrong:** Calling `headers()` from `next/headers` after a long `await` (especially `mongoose.connect()` against a dead host) returns "called outside a request scope" because Next.js 15's AsyncLocalStorage has been torn down. The action returns a 500 instead of a structured error. **This is the bug currently breaking signup in dev.**

**Why it happens:** Next.js 15 tightened request-scope rules. The bug is invisible in dev when Mongo is running because the `await` is fast enough; it manifests only when the await crosses ~5 seconds (Mongo timeout territory).

**How to avoid:** Implement the `ClientMeta` capture-once pattern (Architecture Pattern 1). Read `headers()` exactly once, synchronously, at the top of every action, before any `await`. Pass the resulting plain object explicitly to every helper.

**Warning signs:** `[next] Error: headers was called outside a request scope` in stderr. Any helper that takes no arguments but reads `headers()` internally is suspect.

### Pitfall 2: Mongoose duplicate-index warning resurfaces on schema edits

**What goes wrong:** A future PR adds a new field with `unique: true` AND a developer adds a "matching" `schema.index()` call out of habit. The warning returns, dev experience degrades, and the verification step in CI doesn't catch it because nobody added a test for it.

**Why it happens:** The two-source pattern is the default in older Mongoose tutorials. Muscle memory.

**How to avoid:** Document the "exactly one source of truth" rule in the model file with a top-of-file comment AND in the Phase 1 verification step (Wave 0 / Validation Architecture below). Optionally: a test that boots the app, captures stderr, and asserts no `[MONGOOSE] Warning: Duplicate schema index` line appears.

**Warning signs:** Any `auditSchema.index(` or `userSchema.index(` line in the model files. Phase 1 should leave both files with ZERO `.index()` calls.

### Pitfall 3: `redirect()` swallowed by try/catch

**What goes wrong:** Developer wraps the entire page render in a defensive try/catch. The `redirect()` call inside the gate throws its internal `NEXT_REDIRECT` signal, the catch swallows it, the page renders the gated content anyway.

**Why it happens:** "Add try/catch to make it robust" is a common reflex on async pages.

**How to avoid:** Keep `redirect()` calls at the top level of the component, OUTSIDE any try/catch. If you must catch a DB error, catch only the DB call and let the redirect throw freely.

**Warning signs:** A `try { ... redirect(...) ... }` block in any page component. A page that renders gated content even though the gate condition is false.

### Pitfall 4: Sparse unique on a non-null default

**What goes wrong:** Developer adds `googleSub: { type: String, default: "", unique: true, sparse: true }`. The first user is fine. The second user has `googleSub === ""` (the default) and the unique index treats empty string as a value — collision, signup fails.

**Why it happens:** `sparse: true` only excludes documents where the field is **missing or null**, not where it's an empty string or zero.

**How to avoid:** Always use `default: null` (not `default: ""` or `default: 0`) on sparse-unique fields. Verify by inserting two test users with no `googleSub` set — both must succeed.

**Warning signs:** `default: ""` or `default: 0` on any field marked `unique: true, sparse: true`.

### Pitfall 5: `mongodb-memory-server` reused across processes

**What goes wrong:** Vitest's parallel workers each call `MongoMemoryServer.create()` against the same global cache. The cache only exists per-process, so each worker spins up its own instance — fine. But if a developer copy-pastes the dev cache pattern into a Vitest `globalSetup` without scoping it per worker, two workers end up writing to the same in-memory Mongo and tests interfere.

**Why it happens:** Phase 1 ships the dev pattern; Phase 5 reuses it for tests and the `globalThis` cache semantics differ between `next dev` (single process) and Vitest (worker pool).

**How to avoid:** Phase 1's `mongo.ts` is fine as-is — it's a single dev process. Phase 5 will use `MongoMemoryServer.create()` per worker via Vitest's `globalSetup` (or `beforeAll` per file). The `globalThis` pattern in `mongo.ts` works in both contexts because each Vitest worker is its own Node process.

**Warning signs:** Tests that pass in isolation but fail when run in parallel. Test isolation issues that go away with `--threads=1`.

### Pitfall 6: Forgetting to flip `tier` default from `"pro"` to `"free"`

**What goes wrong:** STAB-09 includes a single line — flipping the User model's `tier` default from `"pro"` to `"free"`. Easy to miss because it's mixed in with eight new field additions. Without the flip, Phase 4's paywall is a no-op for new signups (they all start as Pro).

**Why it happens:** The original scaffold seeded `default: "pro"` because that was the only tier at the time. The flip is load-bearing for Phase 4 but invisible from the test surface in Phase 1.

**How to avoid:** Explicit verification step in Wave 0: `User.create({ email, passwordHash, displayName }).then(u => expect(u.tier).toBe("free"))`. Add to the validation criteria below.

**Warning signs:** Brand-new test users in dev have `tier: "pro"`.

## Code Examples

Verified patterns from official sources, project research, and the existing codebase.

### Reading user with `$eq` wrap (CONVENTIONS.md rule + CVE-2025-23061 defense)

```typescript
// Source: existing `app/src/lib/actions/auth.ts` line 128 — the existing pattern
// is correct; new code in Phase 1 follows it.
const user = await UserModel
  .findOne({ _id: { $eq: session.userId } })
  .select("tier emailVerifiedAt")
  .lean();
```

### Audit call after the ClientMeta refactor

```typescript
// Source: Pattern 1 above — distilled.
const meta: ClientMeta = await captureClientMeta();
// ... validation ...
try {
  await connectDB();
  // ... DB work ...
  await audit(meta, "signup", "ok", { email }, doc._id.toString());
} catch (e) {
  await audit(meta, "signup", "error", { message: errorMessage(e) });
  return { error: "server_error" };
}
```

### `canAccessDay` stub (lives in `lib/billing/entitlements.ts`)

```typescript
// Source: CONTEXT.md decision — Phase 1 stub, Phase 4 fully populates.
export type Tier = "free" | "pro";
export const FREE_DAY_LIMIT = 3 as const;

/**
 * Pure domain rule. NO SDK imports. NO I/O. Single source of truth for
 * day-level tier gating. Imported by:
 *   - `app/src/lib/actions/progress.ts` (saveAnswer guard, replaces inline isFreeDay)
 *   - `app/src/app/(app)/course/[day]/page.tsx` (page-level redirect gate)
 *
 * Phase 4 will extend this to consult Subscription state (e.g., active
 * subscription with currentPeriodEnd in the future). Phase 1 implements the v1
 * rule only.
 */
export const canAccessDay = (tier: Tier, day: number): boolean =>
  tier === "free" ? day <= FREE_DAY_LIMIT : true;
```

### `index.ts` re-export stub for new lib folders

```typescript
// app/src/lib/billing/index.ts
// Public surface of the billing domain. Add exports here as Phase 4 lands.
export { canAccessDay, FREE_DAY_LIMIT, type Tier } from "./entitlements";

// app/src/lib/guards/index.ts
// Public surface of the guards layer. Phase 2-5 will populate.
// Intentionally empty in Phase 1.
export {};

// app/src/lib/infra/index.ts
// Vendor SDK surface. Domain layers MUST NOT import directly from here —
// they import the typed wrappers in lib/billing, lib/auth, etc.
// Intentionally empty in Phase 1.
export {};
```

### `lib/billing/README.md` (skeleton — match existing PLAN.md aesthetic)

```markdown
# lib/billing

Pure domain rules for tier and entitlement decisions. No SDK imports. No I/O.
No state.

## What lives here

- `entitlements.ts` — `canAccessDay(tier, day)`, `canAccessExam(tier)`,
  `FREE_DAY_LIMIT`. Pure functions, total, deterministic.
- (Phase 4) Subscription-state extensions — still pure, take state as
  arguments instead of reaching for it.

## What does NOT live here

- Paddle SDK calls — those live in `lib/infra/paddle/`.
- Database reads — callers fetch the user/subscription doc and pass the
  derived state in.
- HTTP boundary code — server actions and route handlers live in
  `lib/actions/` and `app/api/`.

## Why

`canAccessDay` is called from BOTH the `saveAnswer` server action AND the
`course/[day]/page.tsx` render gate. Single source of truth, two enforcement
points. If the rule lived in two places, they would drift within a release.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `headers()` reachable from any sync stack | Async `headers()` (returns Promise) + AsyncLocalStorage scope tightening | Next.js 15 (Oct 2024) | The signup 500 bug class. Capture-once pattern is the only safe approach. |
| Field-level `index: true` AND `schema.index()` for the same field | Pick one; `expires: '<duration>'` shortcut for TTL | Mongoose 8 (and earlier) — but the warning got noisier in 8.x | Cleaner schemas, no boot warnings, same Mongo behavior. |
| Local Mongo via `mongod` install or Docker only | `mongodb-memory-server` for zero-setup dev + tests | Stable since v6, current is v11.0.1 | New developers onboard in `npm install && npm run dev` flat. |
| `next-auth` for everything | Hand-rolled auth + own the OAuth flow | Project-locked (CVE-2025-29927 lesson + CONVENTIONS.md) | Smaller dep surface, full control over the session and audit story. |
| In-memory `lru-cache` rate limiting | Upstash Redis (Phase 5) | Pitfall 17 — distributed bypass | **Out of scope for Phase 1. The current `lru-cache` rate limiter stays.** |

**Deprecated/outdated:**
- `mongoose@9.x` — breaking release (Nov 2025); incompatible with our existing schema patterns. Phase 1 explicitly stays on `8.9.5`.
- `next@<15.2.3` — vulnerable to CVE-2025-29927. Phase 1 forces the upgrade.
- `mongoose@<8.9.5` — vulnerable to CVE-2025-23061. Phase 1 forces the upgrade.
- The `auditSchema.index({ at: 1 }, { expireAfterSeconds: ... })` pattern — replaced by field-level `expires: '90d'`.
- The `userSchema.index({ email: 1 }, { unique: true })` pattern — redundant with field-level `unique: true`.

## Open Questions

1. **Do we need to drop orphan indexes on Atlas after the duplicate-removal fix?**
   - What we know: dev (memory-server) starts fresh on every boot, no orphan possible.
   - What's unclear: Atlas already has BOTH indexes (the field-level and the schema-level) from previous deployments. Mongoose's `syncIndexes()` does not drop indexes that don't appear in the schema by default.
   - Recommendation: Phase 5 deploy guide includes a one-line manual `db.users.dropIndex(...)` step, executed once during the first Atlas deploy. Phase 1 doesn't touch Atlas, so this is purely a documentation note. **No code change needed in Phase 1.**

2. **Should `connectDB()` print a friendly banner when running against memory-server?**
   - What we know: the current code uses `console.log` for the URL announcement.
   - What's unclear: this conflicts with the future pino logging story (Phase 5).
   - Recommendation: keep the `console.log` for Phase 1 with an `eslint-disable-next-line no-console` comment and a TODO pointing at Phase 5. Replacing with pino in Phase 1 means importing the logger from a Phase 5 module that doesn't exist yet.

3. **Are README files inside `lib/` subfolders idiomatic in Next.js projects?**
   - What we know: there's no Next.js convention for or against this; it's a project style choice.
   - What's unclear: the existing project doesn't already use this pattern (the `app/src/lib/` tree has no README files today).
   - Recommendation: this is greenfield project style. The CONTEXT.md decision is to ship them as boundary docs — they double as architectural enforcement (any reviewer can point at the README and say "this PR violates the boundary"). Match the tight, declarative tone of the existing PLAN.md aesthetic.

4. **Does Phase 1 need a `scripts/check-no-eq.sh` linter stub?**
   - What we know: CONVENTIONS.md mandates `$eq` wrap on every Mongo query; Phase 5 wires the check into CI.
   - What's unclear: whether to ship the script in Phase 1 or wait until Phase 5 has the CI to run it.
   - Recommendation per CONTEXT.md: stub the script in Phase 1 (so the rule is documented), wire it into CI in Phase 5. The Phase 1 stub is a 10-line bash file at `scripts/check-no-eq.sh` that exits 1 if it finds an unwrapped query — runnable manually, not yet enforced.

## Validation Architecture

> **Status:** `workflow.nyquist_validation = true` in `.planning/config.json`. This section is REQUIRED.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **None installed yet.** Vitest is locked for Phase 5 (per STACK.md §5a) but Phase 1 ships before any test infra. |
| Config file | None — see Wave 0 |
| Quick run command | `cd app && npm run typecheck && npm run lint && npm run dev` (manual reproduction of the four bugs against the criteria below) |
| Full suite command | Same — Phase 1 has no automated test suite. Phase 5 introduces Vitest + Playwright; Phase 1's validation criteria become Phase 5's first test cases. |

**Implication for Phase 1:** validation runs **manually** against the criteria below. Each criterion is observable from outside the code (HTTP status, console output, redirect URL, schema introspection) — no white-box assertions. Phase 5 will lift these criteria into automated Vitest cases as part of TEST-01 and TEST-02.

### Phase Requirements → Validation Criteria

Each criterion is an **observable outcome** (Nyquist-style) — what the developer or a future test asserts at the boundary, not what the implementation looks like inside.

| Req ID | Behavior | Validation Type | Manual Verification (Phase 1) | Future Test (Phase 5) |
|--------|----------|-----------------|-------------------------------|----------------------|
| **STAB-01** | Signup with Mongo unreachable returns a structured error, never 500 | smoke | Stop docker mongo (or set `MONGO_URI=mongodb://localhost:1/dead`), restart `npm run dev`, POST signup → response is `{ error: "server_error" }`, HTTP 200, NO `headers was called outside a request scope` in stderr | `tests/integration/auth-signup.test.ts` — mock `connectDB` to reject, assert structured error |
| **STAB-01** | Signup against working memory-server completes and creates user | smoke | `npm run dev` (no env vars set → memory mode), POST signup with valid input → redirect to `/dashboard`, user exists in memory Mongo | `tests/integration/auth-signup.test.ts` — happy path |
| **STAB-01** | `audit()` is a pure function (no `headers()` call inside) | static | Grep `app/src/lib/actions/auth.ts` for `headers(` → exactly 1 occurrence, inside `captureClientMeta` | `tests/unit/auth-purity.test.ts` — `audit` accepts `ClientMeta` parameter, no `next/headers` import |
| **STAB-02** | `npm run dev` boot has zero `[MONGOOSE] Warning: Duplicate schema index` lines | smoke | `npm run dev` 2>&1 \| grep -i "Warning: Duplicate" → no output | `tests/integration/mongoose-boot.test.ts` — capture stderr during connect, assert no warnings |
| **STAB-02** | `users.email` index is unique exactly once in the live schema | introspection | Connect to running mongo, `db.users.getIndexes()` → exactly one `email_1` index with `unique: true` | Same as manual, in test |
| **STAB-02** | `audit.at` index has TTL exactly once | introspection | `db.audit.getIndexes()` → exactly one `at_1` index with `expireAfterSeconds: 7776000` | Same |
| **STAB-03** | Free user navigating to `/course/4` is redirected to `/pricing?from=day-4` | smoke | Sign up → user is `tier: "free"` → navigate to `/course/4` → browser ends up at `/pricing?from=day-4`, HTTP 307, no day-4 content in network tab | `tests/e2e/tier-gate.spec.ts` (Playwright) |
| **STAB-03** | Pro user navigating to `/course/4` renders day 4 normally | smoke | Manually flip a test user's `tier` to `"pro"` in the DB, navigate to `/course/4` → page renders normally | `tests/e2e/tier-gate.spec.ts` |
| **STAB-03** | Free user navigating to `/course/3` (boundary) renders day 3 | smoke | Free user → `/course/3` → renders normally (day 3 is the last free day) | `tests/e2e/tier-gate.spec.ts` boundary case |
| **STAB-03** | `canAccessDay` is the only place the rule lives | static | Grep for `day <= 3` in `app/src/` → only inside `lib/billing/entitlements.ts` | `tests/unit/entitlements.test.ts` |
| **STAB-04** | `next` is exact-pinned to `15.2.3` in package.json | static | `cat app/package.json \| grep '"next"'` → `"next": "15.2.3"` (no caret) | `tests/unit/package-pins.test.ts` — read package.json, assert exact pin |
| **STAB-04** | Installed `next` version is ≥ 15.2.3 | static | `cd app && npm ls next` → shows `15.2.3` | Same |
| **STAB-05** | `mongoose` is exact-pinned to `8.9.5` | static | `cat app/package.json \| grep '"mongoose"'` → `"mongoose": "8.9.5"` | `tests/unit/package-pins.test.ts` |
| **STAB-05** | Installed `mongoose` is ≥ 8.9.5 | static | `cd app && npm ls mongoose` → shows `8.9.5` | Same |
| **STAB-06** | `npm run dev` with no `MONGO_URI` boots successfully and prints memory-server URL | smoke | Unset `MONGO_URI` (or `rm app/.env.local`), `npm run dev` → boots without error, console shows `[mongo] in-process MongoMemoryServer at mongodb://127.0.0.1:NNNN/...` | `tests/integration/connect-memory.test.ts` |
| **STAB-06** | Setting `MONGO_URI=memory://` explicitly also boots in memory mode | smoke | Set `MONGO_URI=memory://`, restart, same outcome as above | Same |
| **STAB-06** | Setting `MONGO_URI=mongodb://localhost:27017/ceh-prep` connects to docker-compose | smoke | `docker compose up -d`, set the URI, restart → console shows no memory-server line, signup persists across restarts | Manual / E2E only |
| **STAB-06** | HMR survives — editing a file does not spawn a second memory-server | smoke | Boot dev, note the printed memory-server URL, edit `auth.ts`, save → `next dev` reloads, NO new `[mongo] in-process MongoMemoryServer at ...` line, queries still work | Hard to automate — manual only in Phase 1 |
| **STAB-06** | `mongodb-memory-server` is in `devDependencies`, not `dependencies` | static | `grep -A2 '"devDependencies"' app/package.json` → contains `mongodb-memory-server` | `tests/unit/package-pins.test.ts` |
| **STAB-06** | Production build (`npm run build`) succeeds without `mongodb-memory-server` available | smoke | `npm install --omit=dev && npm run build` → succeeds (proves the lazy `await import` keeps it out of the prod bundle) | CI step in Phase 5 |
| **STAB-07** | `connectDB` passes `maxPoolSize: 5`, `maxIdleTimeMS: 30000`, `minPoolSize: 0`, `serverSelectionTimeoutMS: 8000` | static | Read `app/src/lib/db/mongo.ts`, confirm the four options literal | `tests/unit/connect-db.test.ts` |
| **STAB-07** | The hot-reload connection cache still works | smoke | Boot dev, signup once, edit a file, signup again → second signup is fast (no new connection log line) | Manual |
| **STAB-08** | `lib/infra/`, `lib/guards/`, `lib/billing/` exist and contain README.md + index.ts | static | `ls app/src/lib/infra app/src/lib/guards app/src/lib/billing` → each has README.md and index.ts | `tests/unit/lib-scaffold.test.ts` |
| **STAB-08** | `lib/billing/entitlements.ts` exports `canAccessDay` and `FREE_DAY_LIMIT` | static | `grep -E 'export.*canAccessDay\|FREE_DAY_LIMIT' app/src/lib/billing/entitlements.ts` | `tests/unit/entitlements.test.ts` |
| **STAB-08** | `canAccessDay("free", 3) === true && canAccessDay("free", 4) === false && canAccessDay("pro", 14) === true` | unit | Manual: `node -e "console.log(require('./app/src/lib/billing/entitlements').canAccessDay('free', 4))"` → false | `tests/unit/entitlements.test.ts` — full truth table |
| **STAB-08** | Existing `saveAnswer` action imports `canAccessDay` from `lib/billing/entitlements` (not inline `isFreeDay`) | static | Grep `app/src/lib/actions/progress.ts` → imports `canAccessDay`, no `isFreeDay` reference | `tests/unit/no-rule-drift.test.ts` |
| **STAB-09** | New User created via `UserModel.create({ email, passwordHash })` has `tier === "free"` | smoke | Sign up a new user, inspect the doc → `tier: "free"`, NOT `"pro"` | `tests/integration/user-defaults.test.ts` |
| **STAB-09** | New User has `emailVerifiedAt: null`, `googleSub: null`, `paddleCustomerId: null`, `role: "user"` | introspection | Inspect a freshly-created user doc → all eight new fields present, all `null` (or `"user"` for role) | `tests/integration/user-defaults.test.ts` |
| **STAB-09** | Two users with `googleSub: null` can coexist (sparse-unique behavior) | smoke | Create two users without setting `googleSub` → both succeed | `tests/integration/user-sparse-unique.test.ts` |
| **STAB-09** | Two users with the same non-null `googleSub` violate the unique constraint | smoke | Create user A with `googleSub: "abc"`, then user B with `googleSub: "abc"` → B fails with E11000 | `tests/integration/user-sparse-unique.test.ts` |
| **STAB-09** | DTO mapper exposes `emailVerifiedAt` and `role` but NOT `googleSub`, `paddleCustomerId`, or any token hash | static | Read `app/src/lib/dto/user.ts`, confirm the allowlist contains the public fields and excludes the secrets | `tests/unit/dto-allowlist.test.ts` |

### Sampling Rate

- **Per task commit:** Manual smoke against the relevant criterion above (typically `npm run dev` + the specific repro)
- **Per wave merge:** Full manual sweep of all criteria for that wave's STAB-* IDs
- **Phase gate:** All 31 criteria above pass manually before `/gsd:verify-work` runs. Phase 5 will lift them into automated Vitest + Playwright cases (TEST-01, TEST-02, TEST-03).

### Wave 0 Gaps

Phase 1 has **no automated test infrastructure to install**. Phase 5 owns that work. The Wave 0 list for Phase 1 is therefore short:

- [ ] No vitest config — deferred to Phase 5 (TEST-01)
- [ ] No playwright config — deferred to Phase 5 (TEST-03)
- [ ] No `tests/` directory — deferred to Phase 5
- [ ] **Action item for Phase 1:** Document the 31 validation criteria above in a new file `app/.planning/phases/01-stabilization/01-VALIDATION.md` (auto-derived by `/gsd:plan-phase` from this section) so Phase 5's test author has a checklist of every behavior to lift into automation.
- [ ] **Action item for Phase 1:** No code-level test framework, but the manual reproductions MUST be runnable. Add a `scripts/verify-phase-1.sh` bash file that runs the static checks (grep rules, `npm ls`, package.json reads) automatically — leaves the smoke checks as documented manual steps.

## Sources

### Primary (HIGH confidence)

- **CONTEXT.md** (`/Users/saharbarak/ceh-prep/.planning/phases/01-stabilization/01-CONTEXT.md`) — locked decisions, the source of truth for this phase
- **REQUIREMENTS.md** §STAB (`/Users/saharbarak/ceh-prep/.planning/REQUIREMENTS.md`) — the 9 STAB-* requirements
- **PITFALLS.md** Pitfalls 14, 16, 17, 20 (`/Users/saharbarak/ceh-prep/.planning/research/PITFALLS.md`) — CVE-2025-29927, CVE-2025-23061, in-process rate limit (out of scope), headers-after-await
- **STACK.md** §4 + §"Runtime Compatibility Matrix" (`/Users/saharbarak/ceh-prep/.planning/research/STACK.md`) — Atlas M0 connection tuning, runtime requirements
- **CONCERNS.md** #1, #2, #3, #6 (`/Users/saharbarak/ceh-prep/.planning/codebase/CONCERNS.md`) — root cause diagnoses
- **Existing code** — `app/src/lib/actions/auth.ts`, `app/src/lib/db/mongo.ts`, `app/src/lib/db/models/user.ts`, `app/src/lib/db/models/audit.ts`, `app/src/app/(app)/course/[day]/page.tsx` — the actual surfaces being modified
- **npm registry** (verified 2026-04-13) — `next@15.5.15` latest stable, `mongoose@8.23.0` latest 8.x, `mongoose@9.4.1` latest overall, `mongodb-memory-server@11.0.1` latest

### Secondary (MEDIUM-HIGH confidence — official docs)

- [Next.js 15 `redirect()` API reference](https://nextjs.org/docs/app/api-reference/functions/redirect) — confirms `never` return type, throw-based mechanism, must not be inside try/catch
- [Mongoose v9.4.1 `SchemaDateOptions`](https://mongoosejs.com/docs/api/schemadateoptions.html) — `expires` shortcut documentation (API stable since v6)
- [Mongoose Next.js integration guide](https://mongoosejs.com/docs/nextjs.html) — official `globalThis` connection cache pattern
- [mongodb-memory-server README](https://www.npmjs.com/package/mongodb-memory-server) — `MongoMemoryServer.create()` static factory
- [typegoose/mongodb-memory-server GitHub](https://github.com/typegoose/mongodb-memory-server) — singleton patterns and binary cache behavior
- [MongoDB Atlas service limits](https://www.mongodb.com/docs/atlas/reference/atlas-limits/) — M0 = 100 connections, the basis for `maxPoolSize: 5`

### Tertiary (MEDIUM confidence — community + cross-verified)

- [vercel/next.js Discussion #26427](https://github.com/vercel/next.js/discussions/26427) — confirms `globalThis` HMR-survival pattern for DB connections
- [vercel/next.js Issue #7811](https://github.com/vercel/next.js/issues/7811) — same topic from the bug-report angle
- [Automattic/mongoose Issue #2459](https://github.com/Automattic/mongoose/issues/2459) — confirms duplicate-index warning behavior
- [Datadog Security Labs: CVE-2025-29927 Next.js middleware bypass](https://securitylabs.datadoghq.com/articles/nextjs-middleware-auth-bypass/) — CVE-2025-29927 details (already cited in PITFALLS.md)

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every package version verified against npm registry on 2026-04-13; `mongodb-memory-server@11.0.1` confirmed compatible with `mongoose@8.9.5`.
- Architecture patterns: **HIGH** — every pattern is either in the existing codebase, in the project's own research docs, or in current official docs.
- Pitfalls: **HIGH** — Pitfalls 1-6 above are either documented in PITFALLS.md or directly observed in the existing code.
- Code examples: **HIGH** — all examples are translations of existing code or distillations of patterns from official Mongoose / Next.js docs.
- Validation criteria: **HIGH** — each criterion is observable from outside the code; the breakdown into static / smoke / introspection / unit categories follows Nyquist-style validation discipline.

**Research date:** 2026-04-13
**Valid until:** ~2026-05-13 (30 days — Next.js + Mongoose ship security patches monthly; check for new CVEs before the next phase plan)

---

*Phase: 01-stabilization*
*Researcher: gsd-researcher (Claude Opus 4.6)*
*Spawned by: /gsd:plan-phase 1*
