# CEH Prep

## What This Is

CEH Prep is an industrial SaaS for ethical hacking exam preparation — a
14-day curriculum with domain-tagged quiz questions, hands-on lab exercises,
and a 125-question timed exam simulator modeled on the real CEH v13 test.
Two products share one repo: `/free` is a zero-dependency static HTML v0 that
stays untouched, and `/app` is a Next.js 15 + TypeScript + Mongoose SaaS that
becomes the production offering.

## Core Value

A student can go from zero to passing the CEH v13 exam in fourteen 30-minute
sessions, with every quiz, lab, and exam-simulator run synced across their
devices — free for the first 3 days, then $30/mo for the full curriculum and
exam simulator.

## Requirements

### Validated

<!-- Shipped and confirmed valuable (inferred from existing codebase via .planning/codebase/). -->

- ✓ **v0**: Static HTML CEH prep at `/free/index.html` — 14 days, 70 questions, local progress, no accounts — existing
- ✓ **Curriculum**: Typed 14-day CEH v13 curriculum in `app/src/lib/content/days.ts` with 70 domain-tagged quiz questions — existing
- ✓ **Landing page**: Asymmetric hero + metrics + bento curriculum + closer, taste-skill aesthetic — existing
- ✓ **Pricing page**: Two-tier (Free / Pro) with FAQ — existing (Pro price needs update from $0 → $30)
- ✓ **Security scaffolding**: Argon2id, iron-session, HIBP, Zod-at-boundary, $eq wrapping, CSP/HSTS/X-Frame headers, rate limiting, audit log schema, DTO mappers — existing
- ✓ **Pages scaffolded**: login, signup, dashboard, course/[day], exam simulator — existing (some broken, see CONCERNS.md)

### Active

<!-- v1 scope. Building toward these. -->

#### Bug fixes (from .planning/codebase/CONCERNS.md)

- [x] ~~Fix signup 500~~ — **Validated in Phase 1** (ClientMeta capture-once refactor)
- [x] ~~Fix Mongoose duplicate index warnings~~ — **Validated in Phase 1** (field-level shortcuts, dropped explicit `.index()` calls)
- [x] ~~Fix content tier gate at page level~~ — **Validated in Phase 1** (page-level `redirect()` via `canAccessDay` single source of truth)

#### Data plane

- [x] ~~Mongo Atlas connection tuning~~ — **Validated in Phase 1** (maxPoolSize 5, maxIdleTimeMS 30_000). Atlas SRV paste-in documented in `.env.example`.
- [x] ~~Local dev Mongo path~~ — **Validated in Phase 1** (mongodb-memory-server default + docker-compose.yml alternate)

#### Identity

- [ ] Google OAuth 2.0 sign-in via `google-auth-library` (no NextAuth — own the flow for security posture)
- [ ] Link-to-existing-account flow when a Google email matches a password account
- [ ] Password reset via email token (Resend as SMTP provider)
- [ ] Email verification on signup
- [ ] Optional TOTP MFA for pro users (deferred to v2 unless simple)

#### Billing

- [ ] Paddle Billing v2 integration: client checkout overlay + webhook signature verification + subscription sync
- [ ] Pro tier at $30/mo — unlocks all 14 days, exam simulator, analytics
- [ ] Free tier limited to first 3 days of content + 15 quiz questions
- [ ] Content tier gate enforced at page level (course/[day] redirects free users to /pricing on day 4+)
- [ ] Webhook retry / idempotency via event-id dedupe in Mongo

#### Production hardening

- [ ] Nonce-based CSP in production (drop `'unsafe-inline'` from script-src)
- [ ] Audit log admin view (only for user with `role === "admin"`)
- [ ] Structured logging via pino (JSON, no PII in logs)
- [ ] Deploy guide: Vercel + MongoDB Atlas + Paddle webhook URL wiring

#### Tests & CI

- [ ] Vitest unit tests: Result monad, auth domain, tier gate, content types
- [ ] Playwright E2E: signup, login, Google OAuth redirect, paywall redirect, exam simulator finish flow
- [ ] CI pipeline: lint + typecheck + test + `npm audit` + secret scan (GitHub Actions)

### Out of Scope

<!-- Explicit boundaries with reasoning. -->

- **Native mobile app** — web is responsive enough; study sessions happen on laptops
- **Chat/community forum** — scope creep, not core to exam prep
- **AI tutor via Claude API** — defer until core product is validated; adds cost/complexity and needs a feature gate
- **Team / multi-seat billing** — individual B2C only; enterprise plans are v2+
- **Certificate issuance on-chain / NFTs** — zero value, signal chasing
- **Multi-language curriculum** — English only; translation is a separate project
- **Live proctoring / webcam exam** — CEH real exam is proctored by EC-Council; we're a prep tool, not a testing center

## Context

**Codebase state** (see `.planning/codebase/*.md` for full map):
- Monorepo layout: `/free` (static HTML) and `/app` (Next.js 15 App Router).
- `/app` uses DDD-inspired layering under `src/lib/` — `result.ts` (Result monad), `env.ts` (Zod env), `db/` (Mongoose), `auth/` (Argon2id + iron-session), `validation/` (Zod), `actions/` (server actions), `content/` (typed curriculum), `dto/` (mappers).
- Middleware sets security headers only — never auth (CVE-2025-29927 defense, auth is re-verified at every protected layout and every server action).
- All Mongo queries wrap user input in `$eq` to neuter operator injection.

**Known critical bugs** (from CONCERNS.md):
1. Signup 500 — `headers()` context loss after Mongo timeout
2. Mongoose duplicate index warnings on boot
3. Tier gate only blocks write, not read
4. No local Mongo running in dev → every DB-touching route 500s

**Taste-skill design tokens already applied:**
Cabinet Grotesk + Satoshi display/body, JetBrains Mono metrics, desaturated
lime accent on zinc-950 base, asymmetric layouts, grain overlay, spring
easing, no Inter, no AI-purple, no centered-hero cliché.

**User profile** (from global `~/.claude/CLAUDE.md`):
Solution architect. Strict lint, functional, Result monads, DDD, clean code,
1-responsibility. Never hardcode credentials. Never hand off to third parties
without consent. Research best practices first. No Claude/Anthropic co-author
tags on commits. Never SSH to EC2 (use AWS SSM).

**Threat model:**
This product is literally for ethical hacking students. Assume they will
attempt every attack they learn on the platform itself. Every new surface
gets a security review before shipping.

## Constraints

- **Tech stack**: Next.js 15 App Router, TypeScript strict, Mongoose 8, Zod 3, iron-session 8, @node-rs/argon2, Tailwind v4, Framer Motion, @phosphor-icons/react — locked by existing scaffold
- **Billing vendor**: Paddle Billing v2 — user choice
- **Auth**: Own the auth flow (iron-session + Argon2id + Google OAuth via `google-auth-library`) — no NextAuth, no third-party auth service
- **Email**: Resend — simple API, generous free tier, no account mgmt overhead
- **DB**: MongoDB Atlas free tier in production; local dev via docker or memory-server
- **Hosting**: Vercel (matches Next.js 15 app router + server actions)
- **Budget**: Everything must be runnable on free tiers (Atlas M0, Vercel Hobby, Resend free, Paddle takes % of revenue)
- **License**: MIT
- **Commits**: No Claude/Anthropic co-author tags (per global CLAUDE.md)
- **Security**: Every external input goes through Zod. Every Mongo query wraps user input in `$eq`. Every DAL call filters by `userId` from session. No stack traces to clients. Structured error codes only.
- **Fonts**: Banned — Inter, Roboto, Arial (per taste-skill)
- **Colors**: Banned — AI purple/blue gradients, pure black `#000` (per taste-skill)
- **Timeline**: No fixed deadline, but ship incrementally — every phase produces a working app

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Two products in one repo (`/free` + `/app`) | `/free` is a trust signal and zero-friction entry; `/app` is the SaaS | ✓ Validated — already shipping |
| iron-session over NextAuth | Own the auth surface fully — better security posture control; students will attack this | — Pending |
| Paddle over Stripe | Merchant-of-record — they handle sales tax/VAT globally; user explicitly chose it | — Pending |
| Google OAuth via `google-auth-library` (no NextAuth) | Consistency with own-the-auth stance; ~200 lines of code not worth a framework | — Pending |
| Resend for transactional email | Clean API, no SMTP credentials in code, generous free tier | — Pending |
| MongoDB Atlas free M0 for prod | User explicitly chose it; fits budget constraint | — Pending |
| Zod-validated env at boot | Refuse to start on missing/weak secrets — no silent production misconfig | ✓ Good — already in place |
| Middleware = headers only, auth re-verified at every data access | Defense-in-depth; CVE-2025-29927 taught everyone why | ✓ Good — already in place |
| In-proc rate limit via `lru-cache` for v1 | No Redis dep until horizontal scale is needed; swap later | — Pending |
| No AI tutor / Claude API in v1 | Adds cost, complexity, and a feature gate to reason about before core product is even validated | — Pending |

## Current State

**Phase 1: Stabilization — Complete** (2026-04-14, 6/6 plans, 9/9 STAB requirements validated, verification passed)

The app boots clean: signup 500 dead, Mongoose warnings silenced, version pins neutralize CVE-2025-29927 + CVE-2025-23061, local dev works with zero setup via mongodb-memory-server, page-level tier gate is a hard wall, User schema extended with 8 additive identity/role/token fields. `lib/billing/`, `lib/guards/`, `lib/infra/` scaffolded so Phases 2-5 never fight the surface.

**Next:** Phase 2 — Email Identity (Resend + Verify + Reset).

---
*Last updated: 2026-04-14 after Phase 1 completion*
