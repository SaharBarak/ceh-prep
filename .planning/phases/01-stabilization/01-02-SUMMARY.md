---
phase: 01-stabilization
plan: 02
subsystem: database

tags:
  - mongoose
  - mongodb-memory-server
  - atlas
  - zod
  - env
  - hmr
  - lazy-import

# Dependency graph
requires:
  - phase: 01-stabilization
    provides: "01-01 ClientMeta refactor establishes the server-action auth baseline this plan's connectDB feeds"
provides:
  - "connectDB() transparently spins up an in-process MongoDB when MONGO_URI is unset or starts with memory://"
  - "globalThis.__memoryMongo HMR cache mirroring the existing __mongooseCache pattern (single memory-server per dev process)"
  - "Atlas M0-tuned pool options: maxPoolSize 5, minPoolSize 0, maxIdleTimeMS 30_000, serverSelectionTimeoutMS 8_000, bufferCommands false"
  - "env.ts MONGO_URI accepts memory://, mongodb://, or mongodb+srv:// and defaults to memory://"
  - "Lazy dynamic import of mongodb-memory-server so production bundles never pull the dev-only package"
affects:
  - "01-03 (duplicate-index cleanup) — will verify against this plan's memory-server on boot"
  - "01-05 (User schema extension) — writes through this connectDB"
  - "01-06 (version pins + docker-compose + .env.example) — doc side of STAB-06, builds on code here"
  - "05-testing (Vitest integration harness) — reuses same MongoMemoryServer + globalThis cache pattern in vitest.globalSetup.ts"

# Tech tracking
tech-stack:
  added:
    - "mongodb-memory-server@^11.0.1 (devDependency)"
  patterns:
    - "Lazy dynamic import (await import('...')) for dev-only packages to keep production bundle clean"
    - "Parallel globalThis caches with ??= logical-nullish-assignment for HMR survival"
    - "Zod .refine() with scheme whitelist for environment-variable validation"
    - "import 'server-only' guard on DB-layer modules"

key-files:
  created:
    - "app/src/lib/db/mongo.ts (rewritten from in-place)"
  modified:
    - "app/src/lib/env.ts"
    - "app/package.json"
    - "app/package-lock.json"

key-decisions:
  - "Pass dbName explicitly to server.getUri('ceh-prep') — getUri() with no args drops the db segment and mongoose falls back to 'test'"
  - "memory:// is the default MONGO_URI, not an opt-in — zero friction for new contributors; Atlas strings are explicit overrides"
  - "Keep bufferCommands: false — fast-fail is better than silent queueing when the memory server is still booting"
  - "No SIGINT cleanup — OS reclaims the port and disk on process exit; explicit .stop() only complicates error paths"
  - "Use underscore-separated numeric literals (8_000, 30_000) for readability; already project-idiomatic post-01-01"

patterns-established:
  - "Lazy-import pattern: `const { Pkg } = await import('pkg')` + `import type { Pkg } from 'pkg'` — the type import is erased at compile time, the value import is code-split by Next.js/webpack"
  - "Dual-cache HMR pattern: mirror any long-lived resource (connection, daemon, client) on globalThis with its own cache type, init via ??="
  - "Scheme-sentinel pattern: use `prefix://` as a sentinel to branch runtime behavior (memory://) rather than boolean env flags"

requirements-completed:
  - STAB-06
  - STAB-07

# Metrics
duration: 4min
completed: 2026-04-14
---

# Phase 01 Plan 02: Local Dev Mongo + Atlas Pool Tuning Summary

**Zero-setup local dev via in-process mongodb-memory-server plus Atlas M0-tuned Mongoose pool options (maxPoolSize 5, maxIdleTimeMS 30s), lazy-imported so production bundles stay clean.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-14T06:14:23Z
- **Completed:** 2026-04-14T06:18:10Z
- **Tasks:** 2
- **Files modified:** 4 (env.ts, mongo.ts, package.json, package-lock.json)

## Accomplishments

- `npm run dev` now boots with zero setup when `MONGO_URI` is unset — `connectDB()` starts an in-process MongoDB and wires it into mongoose on demand
- Atlas-tuned connection pool sized for M0's 100-connection envelope: 5 max, 0 min, 30s idle reap, 8s server selection, no command buffering
- `globalThis.__memoryMongo` cache keeps a single memory server alive across Next.js HMR reloads, mirroring the existing `__mongooseCache` pattern
- `env.ts` gained a scheme-whitelist refinement (`memory://`, `mongodb://`, `mongodb+srv://`) with `memory://` as the safe default
- `mongodb-memory-server@11.0.1` lives under `devDependencies` only and is reached via `await import(...)` — it cannot leak into the production bundle

## Task Commits

Each task was committed atomically:

1. **Task 1: Install mongodb-memory-server and update env.ts to accept memory:// scheme** — `2e40c62` (chore)
2. **Task 2: Extend connectDB with memory-server fallback and Atlas-tuned pool options** — `6532369` (feat)

**Plan metadata commit:** (pending — added after self-check + state updates)

## Final `connectDB` Call Signature

Unchanged from the previous plan — still `export const connectDB = async (): Promise<typeof mongoose>`.

## Exact Options Passed to `mongoose.connect()`

```typescript
mongoose.connect(uri, {
  bufferCommands: false,
  serverSelectionTimeoutMS: 8_000,
  maxPoolSize: 5, // STAB-07: down from 10 for Atlas M0 (100-conn cap)
  minPoolSize: 0, // Don't hold connections idle on M0
  maxIdleTimeMS: 30_000, // Free M0 slots after 30s idle
});
```

The `uri` argument is the output of `resolveUri()`: either `env.MONGO_URI` (for `mongodb://` / `mongodb+srv://` schemes) or the in-process memory server's URI (for `memory://` / unset).

## `globalThis.__memoryMongo` Cache Shape

Phase 5 Vitest `globalSetup.ts` will reuse this exact shape — keep it locked:

```typescript
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
```

- `instance` is the `MongoMemoryServer` object (for introspection, e.g. `instanceInfo.dbName`)
- `uri` is the string returned by `server.getUri('ceh-prep')` — includes the db segment so mongoose targets `ceh-prep`, not `test`
- Both fields mutate; no `readonly`

## Production-Bundle Safety

`mongodb-memory-server` is reached only via `await import("mongodb-memory-server")` inside `resolveUri()`, and the sole top-level reference is a type-only import (erased at compile time):

```typescript
import type { MongoMemoryServer } from "mongodb-memory-server";
```

Next.js + webpack code-split the dynamic import. In a production build with `MONGO_URI=mongodb+srv://...`, `isMemoryMode(...)` returns `false` before the import is reached, so the split chunk is never loaded at runtime. The devDependency classification in `package.json` is the second line of defense — `npm install --production` won't ship it.

**Deferred verification:** The full `NODE_ENV=production npm run build && grep -r "mongodb-memory-server" .next/server/` check was not executed in this execution session due to sandbox restrictions on piped `npm run build` commands. The architectural guarantee (type-only + dynamic-import + devDependency) is bulletproof on paper; run the grep check manually during Plan 06's deploy-docs pass.

## Known Limitations

- The memory-server boot line uses `console.log` with an `eslint-disable-next-line no-console` escape hatch. Phase 5 will replace this with pino once the logger boundary lands. The disable comment is load-bearing — the project's `lint --max-warnings=0` script treats bare `console.log` as a failing warning.
- Unlike the existing Atlas connection, the memory server is NOT cleaned up on process signal — the OS reclaims the port and disk on exit. If future code needs deterministic teardown (e.g. CI harness), add a `process.on('SIGINT', ...)` that calls `memCache.instance?.stop()`. Not needed for `next dev`.

## Decisions Made

- **Explicit `getUri('ceh-prep')` dbName:** The no-arg `getUri()` returns `mongodb://host:port/` without the db segment, causing mongoose to default to `test`. Passing `'ceh-prep'` makes the URI `mongodb://host:port/ceh-prep` so the app talks to the intended database. Caught via runtime smoke test.
- **`memory://` as the default, not a fallback:** Zod `.default('memory://')` means a missing env var produces the memory scheme rather than a boot-time error. Zero friction for new contributors cloning the repo.
- **No SIGINT cleanup:** OS reclaims port and disk on process exit; explicit `.stop()` only complicates error paths and isn't required for correctness.
- **`??=` over `?? + reassignment`:** More idiomatic and matches research Pattern 3 target exactly.
- **Underscore-separated numeric literals:** `8_000`, `30_000` — improves readability at the cost of zero bytes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `getUri()` no-arg drops dbName; URI falls back to mongoose default 'test'**
- **Found during:** Task 2 (post-write smoke test against the memory server)
- **Issue:** Research Pattern 3 as written calls `server.getUri()` with no argument after `MongoMemoryServer.create({ instance: { dbName: 'ceh-prep' } })`. I validated with a node smoke test that this returns `mongodb://host:port/` (no db segment) and that mongoose then connects to database name `test`, not `ceh-prep`. This contradicts the `dbName` intent and will cause subtle test/dev confusion — collections appear in the wrong DB namespace.
- **Fix:** Call `server.getUri('ceh-prep')` (string arg) so the URI includes `/ceh-prep` and mongoose targets the intended database. Added an inline comment explaining the quirk so the next reader doesn't revert it.
- **Files modified:** `app/src/lib/db/mongo.ts`
- **Verification:** Smoke test (node -e) confirmed `conn.connection.name === 'ceh-prep'` after the fix, vs `test` before. `npx tsc --noEmit` still clean.
- **Committed in:** `6532369` (part of Task 2 commit — caught before commit, not a follow-up)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix applied silently before commit. No scope creep — pure correctness. The PLAN.md acceptance criteria do not grep for db name so the original code would have passed the checks, which is exactly why runtime smoke testing matters.

## Issues Encountered

- **Sandbox blocks `npm run dev` with env-var prefix:** The environment denied the `SESSION_SECRET=... MONGO_URI= timeout 25 npm run dev` form, as well as background variants. Workaround: exercised the critical runtime path via `node -e` invoking `MongoMemoryServer.create()` + `mongoose.connect()` with the exact Atlas pool options the code uses. The smoke test output matched what `connectDB()` would produce in-process. Deferred the full `next dev` boot log check to Plan 06.

## User Setup Required

None — the whole point of STAB-06 is zero-setup dev. Plan 06 will ship the `.env.example`, `docker-compose.yml`, and README updates that document the three Mongo options for developers who want alternatives.

## Next Phase Readiness

- Every subsequent Plan 01-XX task that needs a working Mongo can now just call `connectDB()` and it will work in dev with zero setup.
- Plan 01-03 (duplicate-index cleanup) will verify against this plan's memory-server the moment it runs — expect clean boot with zero `[MONGOOSE] Warning` lines.
- Plan 01-05 (User schema extension) writes through this same `connectDB()` — nothing additional to wire.
- Phase 5 Vitest integration harness should import nothing from this file; it should replicate the `__memoryMongo` cache pattern in `vitest.globalSetup.ts` so tests get the same single-instance-per-process guarantee.

## Self-Check: PASSED

- FOUND: `app/src/lib/db/mongo.ts`
- FOUND: `app/src/lib/env.ts`
- FOUND: `app/package.json`
- FOUND: `app/package-lock.json`
- FOUND: `.planning/phases/01-stabilization/01-02-SUMMARY.md`
- FOUND commit `2e40c62` (Task 1 — chore install + env)
- FOUND commit `6532369` (Task 2 — feat memory fallback + pool)

---
*Phase: 01-stabilization*
*Completed: 2026-04-14*
