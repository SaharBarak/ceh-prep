# External Integrations

**Analysis Date:** 2026-04-13

## APIs & External Services

**Password Security (Have I Been Pwned):**
- HaveIBeenPwned (HIBP) - k-anonymity password breach checking
  - Endpoint: `https://api.pwnedpasswords.com/range/{prefix}`
  - Implementation: `app/src/lib/auth/hibp.ts`
  - Method: SHA1 hash of password, send first 5 chars only (k-anonymity)
  - Never sends plaintext or full hash to HIBP
  - Fallback: fail-open on network error (zxcvbn still gates signup)
  - Timeout: 3000ms AbortSignal

## Data Storage

**Databases:**
- MongoDB - Primary data store
  - Connection string: Environment variable `MONGO_URI`
  - Client: Mongoose 8.9.3
  - URL pattern: mongodb://localhost:27017/ceh-prep (local dev) or Atlas connection string (production)
  - Connection pooling: Global cache in `app/src/lib/db/mongo.ts` to prevent connection leaks during Next.js hot reload
  - Pool size: maxPoolSize 10
  - Server selection timeout: 8000ms
  - Buffer commands disabled (bufferCommands: false)

**Schemas (Mongoose Models):**
- User: `app/src/lib/db/models/user.ts`
- Progress: `app/src/lib/db/models/progress.ts`
- Audit: `app/src/lib/db/models/audit.ts`

**File Storage:**
- Not applicable - no file upload feature yet

**Caching:**
- In-memory LRU cache (lru-cache 11.0.2) for rate limiting
- Location: `app/src/lib/auth/rate-limit.ts`
- No Redis or external cache system

## Authentication & Identity

**Auth Provider:**
- Custom implementation (no OAuth yet)
- Framework: iron-session 8.0.4 (stateless sealed JWTs)
- Session storage: HTTP-only cookies (encrypted, cannot be tampered with client-side)
- Cookie name: Environment variable `SESSION_COOKIE_NAME` (default: ceh_session)
- Session secret: Environment variable `SESSION_SECRET` (min 32 chars, validated at boot)

**Password Hashing:**
- Algorithm: Argon2id (via @node-rs/argon2 2.0.2)
- Parameters (OWASP 2024 tuned):
  - Memory cost: 64 MB (1 << 16)
  - Time cost: 3 iterations
  - Parallelism: 4
  - Hash duration: ~100ms on modern hardware
- Location: `app/src/lib/auth/password.ts`
- Functions: `hashPassword(plain)`, `verifyPassword(plain, storedHash)`

**Password Strength Validation:**
- Library: zxcvbn 4.4.2 (entropy/crack-time analysis)
- HIBP integration: Check for breached passwords via k-anonymity API
- Location: Signup form uses both zxcvbn and HIBP checks before hashing

**Auth Actions:**
- Location: `app/src/lib/actions/auth.ts`
- Endpoints: Signup, login, logout (server actions)

**Planned but NOT YET IMPLEMENTED:**
- Google OAuth (identified in prompt as future phase)
- Paddle billing (identified in prompt as future phase)

## Font Content Delivery

**Font Provider 1: Fontshare (Monotype)**
- Fonts: Satoshi (400, 500, 700, 900 weights), Cabinet Grotesk (800, 900 weights)
- CDN: https://api.fontshare.com, https://cdn.fontshare.com
- Preconnect: Both app and free tier use preconnect for performance
- Implementation: HTML link tags in `app/src/app/layout.tsx` and `free/index.html`

**Font Provider 2: Google Fonts**
- Fonts: JetBrains Mono (400, 500, 700 weights) - monospace for code blocks and terminal-style UI
- CDN: https://fonts.googleapis.com, https://fonts.gstatic.com
- Preconnect: Yes
- Implementation: HTML link tags in `app/src/app/layout.tsx` and `free/index.html`

**CSP Allowances:**
- style-src includes both: https://api.fontshare.com, https://fonts.googleapis.com
- font-src includes both: https://cdn.fontshare.com, https://fonts.gstatic.com, data: (for fallbacks)

## Monitoring & Observability

**Error Tracking:**
- Not integrated - no Sentry, Rollbar, etc.

**Logging:**
- pino 9.5.0 installed but not actively integrated into code
- Future consideration for structured JSON logging
- Currently relies on console.warn/console.error (allowed by ESLint)

**Audit Trail:**
- Audit model exists: `app/src/lib/db/models/audit.ts`
- Implementation details not yet populated (future phase)

## CI/CD & Deployment

**Hosting:**
- Not yet specified (Next.js-capable platforms: Vercel, Netlify, self-hosted Node)

**CI Pipeline:**
- Not detected (no GitHub Actions, GitLab CI, or similar)

**Build Output:**
- Next.js standalone build output in `.next/` directory

## Environment Configuration

**Required env vars (validated with Zod):**
- `MONGO_URI` - MongoDB connection string (required, no default)
- `SESSION_SECRET` - JWT sealing secret, min 32 chars (required, validated at boot)
- `SESSION_COOKIE_NAME` - Cookie name (optional, default: ceh_session)
- `NEXT_PUBLIC_APP_URL` - Public URL for metadata base (optional, default: http://localhost:3000)
- `NODE_ENV` - development|test|production (optional, default: development)

**Secrets location:**
- `.env` file (present but NOT committed; listed in .gitignore)
- `.env.example` provided for reference

**Validation:**
- Zod schema in `app/src/lib/env.ts`
- Enforced at boot (app refuses to start if validation fails)
- Example values rejected: SESSION_SECRET cannot remain as example value

## API Routes & Endpoints

**Current Status:**
- No API routes detected in codebase (no app/src/app/api/ directory)
- All data operations use Mongoose directly in server actions

**Server Actions:**
- Located in `app/src/lib/actions/` directory
- auth.ts - User signup, login, logout
- progress.ts - Track user learning progress through course

**Planned Integrations (Future Phases):**
- Paddle billing API (payment processing, not yet wired)
- Google OAuth (authentication, not yet wired)
- Webhook endpoints for Paddle (billing events)

## Summary: Integration Readiness

**Production-Ready:**
- MongoDB + Mongoose (working, tested connection pooling)
- Session management with iron-session
- Argon2id password hashing
- HIBP k-anonymity password checking
- Font CDNs (Fontshare, Google Fonts)
- CSP and security headers

**Planned (Not Yet Integrated):**
- Paddle billing (SDK: needs npm install, API keys needed, webhook routes needed)
- Google OAuth (SDK: next-auth or @auth/core, callback endpoints needed)

---

*Integration audit: 2026-04-13*
