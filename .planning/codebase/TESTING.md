# Testing Patterns

**Analysis Date:** 2026-04-13

## Current State: No Tests Exist

**Gap:** This codebase has **zero test files**. No unit tests, integration tests, or E2E tests are present.

**Status:** The following is a recommended testing approach for future implementation.

## Test Framework Recommendation

**Unit & Integration Tests:**
- **Framework:** Vitest
- **Why:** Fast, ESM-first, TypeScript support out-of-box, pytest-like API, drop-in replacement for Jest
- **Assertion Library:** Vitest built-in or Chai
- **To install:**
  ```bash
  npm install -D vitest @vitest/ui happy-dom # happy-dom for DOM testing
  ```

**E2E Tests:**
- **Framework:** Playwright
- **Why:** Cross-browser support, excellent for testing Next.js app routes, server actions, sessions
- **To install:**
  ```bash
  npm install -D @playwright/test
  ```

## Current Package Setup

**From `app/package.json`:**
- TypeScript: `^5.7.3`
- React 19, Next 15.1.4
- Zod, Mongoose, Iron-session
- Pino logger available (not currently used)
- No test runner scripts defined

## Recommended Test File Organization

**Location Pattern:** Co-located with source files

**Structure:**
```
app/src/
├── lib/
│   ├── result.ts
│   ├── result.test.ts           # Test the Result monad
│   ├── validation/
│   │   ├── schemas.ts
│   │   └── schemas.test.ts      # Test Zod validation
│   ├── auth/
│   │   ├── password.ts
│   │   └── password.test.ts     # Test Argon2 hashing
│   └── actions/
│       ├── auth.ts
│       └── auth.test.ts         # Test server actions (signup, login)
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       ├── login-form.tsx
│   │       └── login-form.test.tsx   # Component tests
└── __tests__/                   # E2E tests (Playwright)
    ├── auth.spec.ts
    └── dashboard.spec.ts
```

## Recommended Test Scripts

**Add to `app/package.json`:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:watch": "vitest --watch"
  }
}
```

## Vitest Configuration

**File: `app/vitest.config.ts`**
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**File: `app/vitest.setup.ts`**
```typescript
import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock console methods as per ESLint rules
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
};
```

## Testing Patterns by Area

### Result Monad Tests

**File:** `app/src/lib/result.test.ts`

**Pattern:**
```typescript
import { describe, it, expect } from "vitest";
import { ok, err, map, flatMap, isOk, isErr, all } from "@/lib/result";

describe("Result monad", () => {
  it("ok creates success variant", () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    expect(result.value).toBe(42);
  });

  it("err creates error variant", () => {
    const result = err("not_found");
    expect(isErr(result)).toBe(true);
    expect(result.error).toBe("not_found");
  });

  it("map transforms success value", () => {
    const result = map(ok(2), (x) => x * 3);
    expect(isOk(result)).toBe(true);
    expect(result.value).toBe(6);
  });

  it("map passes through error", () => {
    const result = map(err("fail"), (x) => x * 3);
    expect(isErr(result)).toBe(true);
    expect(result.error).toBe("fail");
  });

  it("flatMap chains operations", () => {
    const add = (x: number) => (x < 10 ? ok(x + 1) : err("too_big"));
    const result = flatMap(ok(5), add);
    expect(isOk(result)).toBe(true);
  });

  it("all short-circuits on first error", () => {
    const results = [ok(1), ok(2), err("fail"), ok(3)];
    const result = all(results);
    expect(isErr(result)).toBe(true);
  });
});
```

### Validation Schema Tests

**File:** `app/src/lib/validation/schemas.test.ts`

**Pattern:**
```typescript
import { describe, it, expect } from "vitest";
import { SignupSchema, LoginSchema, SaveAnswerSchema } from "@/lib/validation/schemas";

describe("SignupSchema", () => {
  it("accepts valid signup data", () => {
    const data = {
      email: "user@example.com",
      password: "a-secure-password-12",
      displayName: "John Doe",
    };
    const result = SignupSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects weak password", () => {
    const data = {
      email: "user@example.com",
      password: "short",
    };
    const result = SignupSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("normalizes email to lowercase", () => {
    const data = {
      email: "User@EXAMPLE.com",
      password: "a-secure-password-12",
    };
    const result = SignupSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("trims displayName", () => {
    const data = {
      email: "user@example.com",
      password: "a-secure-password-12",
      displayName: "  John  ",
    };
    const result = SignupSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBe("John");
    }
  });
});

describe("LoginSchema", () => {
  it("accepts valid login data", () => {
    const data = {
      email: "user@example.com",
      password: "any-password",
    };
    const result = LoginSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const data = { password: "any" };
    const result = LoginSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe("SaveAnswerSchema", () => {
  it("accepts valid answer submission", () => {
    const data = {
      day: "5",      // coerced to number
      questionIndex: "10",
      choice: "2",
    };
    const result = SaveAnswerSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.day).toBe(5);
      expect(result.data.questionIndex).toBe(10);
    }
  });

  it("rejects day outside range 1-14", () => {
    const data = { day: "15", questionIndex: "0", choice: "0" };
    const result = SaveAnswerSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
```

### Password Hashing Tests

**File:** `app/src/lib/auth/password.test.ts`

**Pattern:**
```typescript
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("Password hashing", () => {
  it("hashes password consistently", async () => {
    const password = "super-secret-password-123";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    // Hashes differ due to random salt
    expect(hash1).not.toBe(hash2);

    // Both verify against original
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });

  it("rejects incorrect password", async () => {
    const password = "correct-password";
    const hash = await hashPassword(password);
    const result = await verifyPassword("wrong-password", hash);
    expect(result).toBe(false);
  });

  it("uses Argon2id with correct parameters", async () => {
    const password = "test-password";
    const hash = await hashPassword(password);

    // Hash should contain Argon2id signature and OWASP parameters
    expect(hash).toContain("$argon2id$");
    expect(hash).toContain("v=19");
    expect(hash).toContain("m=65536"); // 64 MB memory
    expect(hash).toContain("t=3");     // 3 iterations
    expect(hash).toContain("p=4");     // 4 parallelism
  });
});
```

### Server Action Tests

**File:** `app/src/lib/actions/auth.test.ts`

**Important:** Server action tests require:
1. Mock database layer
2. Mock environment variables
3. Mock Next.js `headers()` and `redirect()` functions
4. Test the validation and logic paths

**Pattern:**
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { signup, login, type ActionState } from "@/lib/actions/auth";

// Mock dependencies
vi.mock("@/lib/db/mongo", () => ({
  connectDB: vi.fn(),
}));
vi.mock("@/lib/db/models/user", () => ({
  UserModel: {
    findOne: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
  },
}));
vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("Signup action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error on invalid input", async () => {
    const formData = new FormData();
    formData.set("email", "not-an-email");
    formData.set("password", "short");

    const result = await signup({}, formData);
    expect(result.error).toBe("invalid_input");
  });

  it("returns error on weak password", async () => {
    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("password", "weak123");

    const result = await signup({}, formData);
    expect(result.error).toBe("weak_password");
  });
});

describe("Login action", () => {
  it("returns error on invalid input", async () => {
    const formData = new FormData();
    formData.set("email", "not-an-email");
    formData.set("password", "");

    const result = await login({}, formData);
    expect(result.error).toBe("invalid_input");
  });

  it("returns error on invalid credentials", async () => {
    const formData = new FormData();
    formData.set("email", "unknown@example.com");
    formData.set("password", "any-password");

    const result = await login({}, formData);
    expect(result.error).toBe("invalid_credentials");
  });
});
```

### Component Tests

**File:** `app/src/app/(auth)/login/login-form.test.tsx`

**Pattern:**
```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/app/(auth)/login/login-form";

// Mock the server action
vi.mock("@/lib/actions/auth", () => ({
  login: vi.fn(),
}));

describe("LoginForm", () => {
  it("renders email and password fields", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("shows error message on failed login", async () => {
    render(<LoginForm />);
    const form = screen.getByRole("form");

    // Simulate form submission with error
    // (requires proper useActionState mock setup)
    // This is a simplified example
  });

  it("disables submit button while pending", async () => {
    render(<LoginForm />);
    const button = screen.getByRole("button", { name: /log in/i });
    expect(button).not.toBeDisabled();
    // After form submission, button should be disabled (pending state)
  });
});
```

## Playwright E2E Test Example

**File: `app/__tests__/auth.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000");
  });

  test("signup form displays", async ({ page }) => {
    await page.goto("http://localhost:3000/signup");
    await expect(page.locator('text="Create account"')).toBeVisible();
  });

  test("shows validation error on weak password", async ({ page }) => {
    await page.goto("http://localhost:3000/signup");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "weak");
    await page.click('button:has-text("Create account")');

    await expect(
      page.locator("text=Password too predictable")
    ).toBeVisible();
  });

  test("successful signup redirects to dashboard", async ({ page }) => {
    // Requires valid test environment setup
    // In practice, use test database fixtures and cleanup
  });

  test("login persists session cookie", async ({ page }) => {
    // Test that session cookie is set and persists across navigations
  });
});
```

## Mocking Strategy

**What to Mock:**
- Database calls (`UserModel`, `ProgressModel`, etc.)
- External APIs (`isPasswordPwned()`, HIBP service)
- Next.js functions (`redirect()`, `headers()`)
- Crypto operations (for speed — or use real if fast enough)

**What NOT to Mock:**
- Zod validation (test the real schemas)
- Result monad operations (test the real implementation)
- Password hashing (Argon2 is fast enough for tests)
- Type guards (`isOk()`, `isErr()`)

**Mock Database Example:**
```typescript
import { vi } from "vitest";
import { UserModel } from "@/lib/db/models/user";

vi.mock("@/lib/db/models/user", () => ({
  UserModel: {
    findOne: vi.fn((query) => ({
      lean: vi.fn().mockResolvedValue(null), // User not found
    })),
    create: vi.fn((data) =>
      Promise.resolve({
        _id: "mock-id",
        ...data,
      })
    ),
    updateOne: vi.fn(),
  },
}));
```

## Environment Setup for Tests

**Vitest Setup File (`app/vitest.setup.ts`):**
```typescript
import { config } from "dotenv";

// Load .env.test if it exists
config({ path: ".env.test" });

// Set test defaults
process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/ceh-test";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret-32-chars-minimum-xxx";
```

## Running Tests Locally

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# With UI
npm run test:ui

# Coverage report
npm run test:coverage

# E2E tests
npm run test:e2e

# E2E with UI
npm run test:e2e:ui
```

## GitHub Actions CI Pipeline Recommendation

**File: `.github/workflows/test.yml`**
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:7
        options: >-
          --health-cmd mongosh
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 27017:27017

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci --prefix app
      - run: npm run test --prefix app
      - run: npm run test:e2e --prefix app
```

## Coverage Goals

**Recommended Targets:**
- **Statements:** 80%
- **Branches:** 75%
- **Functions:** 80%
- **Lines:** 80%

**Critical Paths to Prioritize:**
- All Result monad operations
- All Zod schemas (validation at boundaries)
- Authentication actions (signup, login, logout)
- Password hashing
- DTO conversions (prevent data leakage)

## Testing Gaps & Priority

**Current Coverage:** 0%

**Immediate Priority (MVP):**
1. Result monad tests (`result.test.ts`)
2. Zod schema tests (`schemas.test.ts`)
3. Password hashing tests (`password.test.ts`)
4. Server action tests (`actions/auth.test.ts`)

**Secondary Priority:**
1. E2E tests (signup → login → dashboard flow)
2. Component tests (LoginForm, SignupForm)
3. DTO conversion tests
4. Rate limiting tests

---

*Testing analysis: 2026-04-13*
