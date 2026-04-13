# Technology Stack

**Analysis Date:** 2026-04-13

## Languages

**Primary:**
- TypeScript 5.7.3 - All application code, strict mode, no JavaScript allowed
- HTML/CSS - Static free tier product (`/free/index.html`)

**Secondary:**
- Node.js (runtime)

## Runtime

**Environment:**
- Node.js >=20.0.0 (enforced in `app/package.json`)

**Package Manager:**
- npm
- Lockfile: `app/package-lock.json` (present, 263KB)

## Frameworks

**Core:**
- Next.js 15.1.4 - Full-stack React framework with SSR, API routes, middleware
- React 19.0.0 - UI component library
- React DOM 19.0.0 - DOM rendering

**Styling:**
- Tailwind CSS 4.0.0 - Utility-first CSS framework (PostCSS-based)
- @tailwindcss/postcss 4.0.0 - PostCSS plugin for Tailwind v4

**Session & Auth:**
- iron-session 8.0.4 - Stateless session management (sealed JWTs in cookies)
- @node-rs/argon2 2.0.2 - Native Argon2id password hashing (OWASP 2024 tuned: 64MB memory, 3 iterations, parallelism 4)

**Animations & Interactions:**
- Framer Motion 11.15.0 - React animation library
- @phosphor-icons/react 2.1.7 - Icon library

**Data & Validation:**
- Mongoose 8.9.3 - MongoDB ODM with schema validation
- Zod 3.24.1 - TypeScript-first schema validation

**Security:**
- isomorphic-dompurify 2.19.0 - DOM sanitization (XSS prevention)
- zxcvbn 4.4.2 - Password strength meter (entropy check)
- @types/zxcvbn 4.4.5 - TypeScript types for zxcvbn

**Performance & Utilities:**
- lru-cache 11.0.2 - In-memory caching for rate limiting
- pino 9.5.0 - Structured JSON logging (installed but not actively used)

## Build & Development Tools

**Bundler:**
- Next.js built-in webpack (transparent, no custom config needed)

**Code Quality:**
- ESLint 9.18.0 - Linting
- @typescript-eslint/eslint-plugin 8.19.1 - TypeScript-specific rules
- @typescript-eslint/parser 8.19.1 - TypeScript parser
- eslint-config-next 15.1.4 - Next.js ESLint rules
- Prettier 3.4.2 - Code formatter (single-quote: false, semi: true, trailingComma: all)

**Type Checking:**
- TypeScript 5.7.3 - Compiler with strict mode
- tsc --noEmit - Type checking without emit

**Development Server:**
- Next.js dev server (next dev)

## Key Dependencies

**Critical:**
- mongoose 8.9.3 - Why it matters: Bridges MongoDB to the application; handles connection pooling in Next.js hot reload environment via global cache in `app/src/lib/db/mongo.ts`
- @node-rs/argon2 2.0.2 - Why it matters: Password hashing; CPU-bound work offloaded to native module (~100ms per hash)
- iron-session 8.0.4 - Why it matters: Stateless session management; sealed JWTs prevent tampering without server-side store

**Infrastructure:**
- zod 3.24.1 - Runtime type validation at borders (env vars, API inputs)
- isomorphic-dompurify 2.19.0 - DOM sanitization for user-generated content
- zxcvbn 4.4.2 - Client-side password entropy validation before server hash

## Configuration

**Environment:**
- Configuration via Zod-validated env schema in `app/src/lib/env.ts`
- Validation happens at boot; app refuses to start with missing/weak secrets
- Required env vars: `MONGO_URI`, `SESSION_SECRET` (min 32 chars), `SESSION_COOKIE_NAME`, `NEXT_PUBLIC_APP_URL`
- Example: `app/.env.example`

**Build & Runtime:**
- `app/next.config.ts` - CSP headers, security headers, typed routes enabled
- `app/tsconfig.json` - Strict TypeScript config with `@/*` path alias
- `app/postcss.config.mjs` - PostCSS with Tailwind plugin
- `app/.eslintrc.json` - Next.js + TypeScript rules, no-console warn, no any, prefer const
- `app/.prettierrc` - 2-space tabs, 100 char line width, trailing commas

## Scripts

**Development:**
```bash
npm run dev       # Next.js dev server with hot reload
npm run build     # Next.js production build
npm run start     # Production server
npm run lint      # ESLint with zero warnings
npm run typecheck # tsc type checking
npm run format    # Prettier format all files
```

## Platform Requirements

**Development:**
- Node.js >=20.0.0
- npm (any version that ships with Node 20+)
- MongoDB (local dev: mongodb://localhost:27017/ceh-prep, or Atlas)

**Production:**
- Node.js >=20.0.0 runtime
- MongoDB connection (Atlas recommended)
- SSL/TLS (enforced via CSP, STS headers)

## Security & Headers

**Content Security Policy (CSP):**
- script-src: self, unsafe-inline (required for Next.js)
- style-src: self, unsafe-inline, https://api.fontshare.com, https://fonts.googleapis.com
- font-src: self, https://cdn.fontshare.com, https://fonts.gstatic.com, data:
- connect-src: self only (no external API calls except font CDNs)

**Security Headers Applied:**
- Strict-Transport-Security: max-age 63072000, includeSubDomains, preload
- X-Frame-Options: DENY (no framing)
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera, microphone, geolocation, interest-cohort disabled
- Cross-Origin-Opener-Policy: same-origin
- Cross-Origin-Resource-Policy: same-origin

---

*Stack analysis: 2026-04-13*
