# Coding Conventions

**Analysis Date:** 2026-04-13

## TypeScript Strict Mode

**Compiler Options:**
- `strict: true` — Full strict mode enabled
- `noUncheckedIndexedAccess: true` — No implicit any on indexed access
- `noImplicitOverride: true` — Override keyword required on overridden methods
- `noImplicitReturns: true` — All code paths must return a value
- `noFallthroughCasesInSwitch: true` — Switch cases must not fall through
- `exactOptionalPropertyTypes: true` — Optional properties cannot be undefined without explicit union
- `noUnusedLocals: true` — Unused local variables are errors
- `noUnusedParameters: true` — Unused function parameters are errors (use leading `_` to suppress)

**Type Imports:**
- All types must use `import type { ... }` syntax
- ESLint enforces `@typescript-eslint/consistent-type-imports` with `prefer: "type-imports"`
- Example: `import type { UserDoc } from "@/lib/db/models/user"`

## ESLint Rules

**Enforced Rules:**
- `@typescript-eslint/no-unused-vars` — Error; allows `argsIgnorePattern: "^_"` for intentionally unused parameters
- `@typescript-eslint/no-explicit-any` — Error; no `any` types allowed
- `@typescript-eslint/consistent-type-imports` — Error; always use type-imports for types
- `no-console` — Warn; only `console.warn()` and `console.error()` allowed (disable with `eslint-disable-next-line no-console` if necessary)
- `prefer-const` — Error; must use `const`, not `let` for non-reassigned variables
- `eqeqeq` — Error; always use `===` and `!==`, never `==` or `!=`
- `no-var` — Error; use `const`/`let`, never `var`

**ESLint Config Location:** `app/.eslintrc.json`

## Prettier Formatting

**Configuration:**
- **Print width:** 100 columns
- **Tab width:** 2 spaces (no tabs)
- **Trailing comma:** `all` — Include trailing commas in arrays, objects, and parameters
- **Semicolons:** `true` — Required
- **Single quote:** `false` — Double quotes required
- **Arrow parentheses:** `always` — Always include parens, even for single params: `(x) => x`

**Run:** `npm run format` from `app/` directory

**Config Location:** `app/.prettierrc`

## Naming Conventions

**Files:**
- `camelCase` for most files: `passwordHash.ts`, `userModel.ts`
- Route segments with brackets for dynamic routes: `[day].tsx`, `[slug].tsx`
- Layout files and route groups follow Next.js conventions: `layout.tsx`, `page.tsx`, `(auth)`, `(app)`
- Component files: `PascalCase` for exported React components: `LoginForm.tsx`, `CoursePlayer.tsx`
- Utility/helper files: `camelCase`: `password.ts`, `session.ts`, `rate-limit.ts`

**Functions:**
- `camelCase` for all functions: `hashPassword()`, `verifyPassword()`, `getClientMeta()`
- Async functions must use `async` keyword: `async function getSession()`
- Factory functions or constructors: `camelCase`: `ok()`, `err()`, `createUser()`
- Private/internal helpers: Prefix with nothing (just camelCase); rely on file structure for encapsulation

**Variables:**
- `camelCase` for all variables and constants: `const userEmail`, `let failedCount`
- Constants that are never reassigned still use `const` (not `UPPER_CASE`)
- Exception: Environment variables and schema validation use uppercase: `MONGO_URI`, `NODE_ENV`

**Types and Interfaces:**
- `PascalCase` for all types, interfaces, and unions: `UserDoc`, `ActionState`, `Result<T, E>`, `UserPublic`
- Generic parameters: Single uppercase letters: `<T>`, `<U>`, `<E>`
- Type unions for discriminated types: `type Ok<T> = { readonly ok: true; readonly value: T }` (see Result monad)

## Import Organization

**Import Order:**
1. External packages (React, Next.js, third-party): `import { useState } from "react"`
2. Type imports from external: `import type { Metadata } from "next"`
3. Internal absolute imports using `@/`: `import { UserModel } from "@/lib/db/models/user"`
4. Internal type imports: `import type { UserDoc } from "@/lib/db/models/user"`
5. Relative imports (if necessary): `import { utils } from "../utils"`

**Blank lines:** One blank line between import groups

**Path Aliases:**
- `@/*` maps to `app/src/*` in `tsconfig.json`
- Always use absolute imports with `@/` prefix: `import { ok } from "@/lib/result"`
- Do not use relative imports like `../../lib/result`

**Example:**
```typescript
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { UserModel } from "@/lib/db/models/user";
import type { UserDoc } from "@/lib/db/models/user";
import { hashPassword } from "@/lib/auth/password";
```

## Error Handling via Result Monad

**Pattern:** Explicit error handling without exceptions. Defined in `app/src/lib/result.ts`.

**Types:**
- `Result<T, E>` — Success or error, never throws
- `Ok<T>` — Success variant with value
- `Err<E>` — Error variant with error

**Factory Functions:**
```typescript
import { ok, err } from "@/lib/result";

// Create success
const result = ok(userData);

// Create error
const result = err("email_taken");
```

**Type Guards:**
```typescript
import { isOk, isErr } from "@/lib/result";

if (isOk(result)) {
  const value = result.value; // TypeScript narrows to Ok<T>
} else {
  const error = result.error; // TypeScript narrows to Err<E>
}
```

**Chainable Operations:**
```typescript
import { map, flatMap, mapErr } from "@/lib/result";

// Transform success value
const doubled = map(result, (x) => x * 2);

// Flatmap for chaining operations that return Result
const chained = flatMap(userResult, (user) => validateUser(user));

// Transform error
const withMsg = mapErr(result, (e) => `Error: ${e}`);
```

**Async Helper:**
```typescript
import { fromPromise } from "@/lib/result";

const result = await fromPromise(
  fetchUser(),
  (e) => `Fetch failed: ${e instanceof Error ? e.message : "unknown"}`
);
```

**Aggregation (all-or-nothing):**
```typescript
import { all } from "@/lib/result";

const results = await Promise.all([op1(), op2(), op3()]);
const aggregated = all(results); // First error short-circuits, else returns array
```

**Action Return Type:** Server actions and handlers return explicit `Result<SuccessType, ErrorType>` or discriminated union like `ActionState`:
```typescript
export type ActionErrorCode = "invalid_input" | "rate_limited" | "server_error";
export type ActionState = { error?: ActionErrorCode };

export const signup = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
  // Return { error: code } on failure or success without error property
};
```

## Zod Validation at Boundaries

**Pattern:** All external inputs (form data, API params, env vars) validated with Zod at the entry point.

**Locations:**
- `app/src/lib/validation/schemas.ts` — All input schemas
- `app/src/lib/env.ts` — Environment validation
- Form handlers and server actions — Call `.safeParse()` immediately

**Example (Form Validation):**
```typescript
import { SignupSchema } from "@/lib/validation/schemas";

const parsed = SignupSchema.safeParse({
  email: formData.get("email"),
  password: formData.get("password"),
  displayName: formData.get("displayName") || undefined,
});

if (!parsed.success) return { error: "invalid_input" };
const { email, password, displayName } = parsed.data;
```

**Example (Environment Validation):**
```typescript
// app/src/lib/env.ts
const EnvSchema = z.object({
  MONGO_URI: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) throw new Error("Environment validation failed");
export const env = parsed.data;
```

**Never reference `process.env` directly** outside `app/src/lib/env.ts`. Always import from `@/lib/env`:
```typescript
import { env } from "@/lib/env";
const url = env.MONGO_URI; // Already validated, typed
```

## DTO Pattern (No Mongoose Doc Leakage)

**Purpose:** Prevent accidental leakage of sensitive fields (passwordHash, failedLoginCount, etc.) to clients.

**Location:** `app/src/lib/dto/` — All conversion functions live here

**Pattern:**
1. Database model exports `Doc` type: `UserDoc` with private fields
2. DTO file exports `Public` type: `UserPublic` with only safe fields
3. Conversion function maps Doc → Public

**Example:**
```typescript
// app/src/lib/db/models/user.ts
export type UserDoc = {
  _id: ObjectId;
  email: string;
  passwordHash: string; // PRIVATE
  displayName: string;
  tier: "free" | "pro";
  failedLoginCount: number; // PRIVATE
  lockedUntil: Date | null; // PRIVATE
};

// app/src/lib/dto/user.ts
export type UserPublic = {
  id: string;
  email: string;
  displayName: string;
  tier: "free" | "pro";
  createdAt: string;
};

export const toPublicUser = (doc: UserDoc): UserPublic => ({
  id: doc._id.toString(),
  email: doc.email,
  displayName: doc.displayName ?? "",
  tier: (doc.tier ?? "pro") as "free" | "pro",
  createdAt: (doc.createdAt ?? new Date()).toISOString(),
});
```

**Rule:** Never return database documents directly to clients. Always convert via DTO function.

## Server Action Conventions

**Location:** `app/src/lib/actions/` — All server actions live here

**Pattern:**
- Directive: `"use server"` at file top
- Return type: `Promise<ActionState>` or explicit `Promise<Result<T, E>>`
- First parameter: `_prev: ActionState` (for use with `useActionState`)
- Second parameter: `formData: FormData` or specific typed parameter
- Never throw; always return error code via Result/ActionState

**Example:**
```typescript
"use server";

import { redirect } from "next/navigation";
import { LoginSchema } from "@/lib/validation/schemas";

export type ActionErrorCode = "invalid_input" | "invalid_credentials" | "server_error";
export type ActionState = { error?: ActionErrorCode };

export const login = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  try {
    // Business logic
    return {}; // Success: no error property
  } catch (e) {
    return { error: "server_error" };
  }
};
```

## Route Group Organization

**Pattern:** Route groups in parentheses do not create URL segments. Used to organize layouts and concerns.

**Structure:**
```
app/src/app/
├── (auth)/
│   ├── layout.tsx          # Shared auth layout (wider, centered)
│   ├── login/
│   │   ├── page.tsx
│   │   └── login-form.tsx
│   └── signup/
│       ├── page.tsx
│       └── signup-form.tsx
├── (app)/
│   ├── layout.tsx          # Protected shell (checks session)
│   ├── dashboard/
│   │   └── page.tsx
│   ├── course/
│   │   └── [day]/
│   │       ├── page.tsx
│   │       └── course-player.tsx
│   └── exam/
│       ├── page.tsx
│       └── exam-runner.tsx
├── layout.tsx              # Root layout (fonts, metadata)
├── page.tsx                # Home page (public)
└── pricing/
    └── page.tsx            # Pricing (public)
```

**Purpose:**
- `(auth)/` — Authentication flows (signup, login), uses simple centered layout
- `(app)/` — Protected routes requiring session, uses header nav layout
- Root and public routes at top level

## Design Tokens via Tailwind v4 `@theme`

**Location:** `app/src/app/globals.css` — All design tokens defined in `@theme` block

**Pattern:**
```css
@theme {
  --color-bg: #0a0a0b;
  --color-surface: #0f1012;
  --color-line: rgba(255, 255, 255, 0.07);
  --color-accent: #bef264;         /* Desaturated lime, not AI purple */
  --color-danger: #f87171;

  --font-display: "Cabinet Grotesk", "Satoshi", system-ui, sans-serif;
  --font-body: "Satoshi", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);  /* Spring easing for taste-skill */
}
```

**Usage in HTML/JSX:**
```jsx
<div className="border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink)]">
  {/* Tailwind + CSS variables for design tokens */}
</div>

<input className="focus:border-[var(--color-accent)]" />
```

**Fonts:**
- Display: Cabinet Grotesk (heavy, 800/900)
- Body: Satoshi (regular, 400/500/700/900)
- Mono: JetBrains Mono
- Loaded via fontshare and Google Fonts in `app/src/app/layout.tsx`

**Easing:** Spring cubic-bezier for motion (taste-skill principle: non-linear, alive motion)

## Comments and Documentation

**JSDoc:** Use for public exports and complex logic:
```typescript
/**
 * Result<T, E> — explicit success/failure without exceptions.
 * Chainable via map/flatMap. Inspired by Rust / neverthrow but zero deps.
 */
export type Result<T, E> = Ok<T> | Err<E>;
```

**Inline Comments:** Use for non-obvious security, performance, or business logic:
```typescript
// Uniform timing: always run verify even when user missing, against a
// throwaway hash, so an observer can't tell if the email exists.
const storedHash = user?.passwordHash ?? DUMMY_HASH;
```

**Section Comments:** Use for logical groupings in files:
```typescript
/* ─────────────────────────────
   Security helpers
   ───────────────────────────── */
```

**When NOT to comment:** Self-documenting code (clear function names, type names) needs no comment.

## Variable Declaration

**Always use `const` for non-reassigned values:**
```typescript
const email = formData.get("email");  // ✓ Good
let count = 0;                         // ✓ Only if reassigned
```

**No `var`:** ESLint forbids `var`. Use `const` or `let` only.

## Readonly Properties

**Use `readonly` for immutable object shapes:**
```typescript
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
```

**Benefits:** Prevents accidental mutation, clearer intent

---

*Convention analysis: 2026-04-13*
