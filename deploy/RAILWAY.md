# Production deployment — Railway + MongoDB Atlas + Resend + Paddle + Cloudflare

End-to-end runbook for taking the app from a local dev tree to a live
production deployment. Order matters — each step's output feeds the next.

> **Time budget**: ~90 minutes if every external account is fresh.
> ~30 minutes if accounts already exist.

## What you'll end up with

```
                 user browser
                       │
              ┌────────▼─────────┐
              │   Cloudflare     │  DNS, TLS, optional proxy + WAF
              └────────┬─────────┘
                       │
              ┌────────▼─────────┐
              │     Railway      │  Next.js standalone container
              │   (web service)  │  built from repo Dockerfile
              └─┬──────┬──────┬──┘
                │      │      │
        ┌───────▼──┐ ┌─▼────┐ ┌▼──────────┐
        │  Mongo   │ │Resend│ │  Paddle   │
        │  Atlas   │ │  API │ │ webhooks  │
        └──────────┘ └──────┘ └───────────┘
                       ▲
                       │
              ┌────────┴─────────┐
              │ GitHub Actions   │  Hourly + daily cron triggers
              │  cron-* workflows│  hitting /api/cron/* with Bearer
              └──────────────────┘
```

## Prerequisites

- A domain you own (Cloudflare will host the DNS).
- GitHub account with this repo pushed to it.
- Credit card for Railway ($5/mo Hobby plan minimum for production
  workloads) and Paddle verification.

---

## 1. MongoDB Atlas — create the database

1. Sign up at <https://www.mongodb.com/cloud/atlas/register>.
2. **Create a new project** ("CEH Sprint").
3. **Build a new cluster**:
   - Provider: any (AWS US-East-1 keeps round-trip latency low for Railway US).
   - Tier: **M0 (free)** is enough for launch. Upgrade later if you hit
     the 512MB cap. The app's connection pool (`maxPoolSize=5`) is
     already sized for M0's 100-connection ceiling.
4. **Security → Database Access** → add a database user:
   - Username: `ceh-prep-app`
   - Password: generate, copy it — you'll need it for `MONGO_URI`.
   - Role: `readWrite` on the `ceh-prep` database.
5. **Security → Network Access** → add IP allowlist:
   - For Railway, the safest minimum is `0.0.0.0/0` because Railway's
     egress IPs rotate. If you want to lock down, ask Railway support
     for the current egress range and allowlist only those.
6. **Connect → Drivers → Node.js** → copy the connection string:
   ```
   mongodb+srv://ceh-prep-app:PASSWORD@cluster0.xxxxx.mongodb.net/ceh-prep?retryWrites=true&w=majority
   ```
   Save this — it's the `MONGO_URI` env var.

---

## 2. Resend — set up transactional + marketing email

1. Sign up at <https://resend.com>.
2. **Domains** → **Add Domain** → enter your sending domain (e.g.
   `mail.your-domain.com` is the recommended subdomain pattern so
   Resend's DNS doesn't conflict with your apex MX records).
3. Resend shows three DNS records to publish (SPF, DKIM × 2). Keep this
   tab open — you'll add the records in Cloudflare in step 5.
4. **API Keys** → **Create API Key** → scope: `Full access` (or
   `Sending access` if you want to scope tighter; the app only sends).
   Copy the key — it's `RESEND_API_KEY` and starts with `re_`.
5. (Optional) **Audiences** → **Create Audience** → "CEH Sprint
   Newsletter" → copy the Audience ID (`aud_...`). That's
   `RESEND_AUDIENCE_ID`.

`RESEND_FROM_ADDRESS` will be `"CEH Sprint <noreply@mail.your-domain.com>"`
once the domain is verified.

---

## 3. Paddle — set up the Pro subscription product

> **Tip**: do this in Paddle Sandbox first (<https://sandbox.paddle.com>),
> wire it end-to-end, then repeat in production.

1. Sign up at <https://vendors.paddle.com> (production) or
   <https://sandbox.paddle.com> (testing).
2. **Catalog → Products → Create product**:
   - Name: "CEH Sprint Pro"
   - Type: Subscription
   - Tax category: Software / SaaS
3. **Pricing** → add a price:
   - Amount: your Pro tier price.
   - Billing: monthly or annual.
   - Copy the **Price ID** (`pri_...`). That's `PADDLE_PRO_PRICE_ID`.
4. **Developer Tools → Authentication → API Keys → Create**:
   - Copy the key — it's `PADDLE_API_KEY`.
5. **Developer Tools → Authentication → Client-side tokens → Create**:
   - Copy the token — it's `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`.
6. **Developer Tools → Notifications → Endpoints → Add destination**:
   - URL: `https://your-domain.com/api/paddle/webhook`
     (you'll fill the real domain after Railway deploys.)
   - Subscribe to: `subscription.created`, `subscription.updated`,
     `subscription.canceled`, `transaction.completed`, `transaction.paid`.
   - On save, copy the **Signing Secret** — it's `PADDLE_WEBHOOK_SECRET`.
7. Set `NEXT_PUBLIC_PADDLE_ENV` to `"sandbox"` (testing) or
   `"production"` (live). Mismatches between this and which dashboard
   the keys came from will cause silent failures.

---

## 4. Railway — deploy the app

1. Sign up at <https://railway.app> and connect your GitHub.
2. **New Project → Deploy from GitHub repo** → pick this repo.
3. Railway auto-detects `Dockerfile` at the repo root and starts a
   build. The first build will fail because env vars aren't set yet —
   that's expected.
4. **Variables tab → Raw editor** → paste:

   ```dotenv
   NODE_ENV=production
   NEXT_PUBLIC_APP_URL=https://your-domain.com

   MONGO_URI=mongodb+srv://ceh-prep-app:PASSWORD@cluster0.xxxxx.mongodb.net/ceh-prep?retryWrites=true&w=majority

   SESSION_SECRET=<openssl rand -base64 48>
   CRON_SECRET=<openssl rand -base64 32>
   UNSUB_SECRET=<openssl rand -base64 32>

   RESEND_API_KEY=re_xxxxxxxx
   RESEND_FROM_ADDRESS=CEH Sprint <noreply@mail.your-domain.com>
   RESEND_AUDIENCE_ID=aud_xxxxxxxx-xxxx-...

   PADDLE_API_KEY=pdl_live_apikey_xxxxx
   PADDLE_WEBHOOK_SECRET=pdl_ntfset_xxxxx
   PADDLE_PRO_PRICE_ID=pri_xxxxx
   NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=live_xxxxx
   NEXT_PUBLIC_PADDLE_ENV=production

   NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
   ```

   Generate strong secrets with:
   ```bash
   openssl rand -base64 48   # SESSION_SECRET
   openssl rand -base64 32   # CRON_SECRET, UNSUB_SECRET
   ```

5. **Settings → Networking → Generate Domain** to get a
   `your-app.up.railway.app` URL. Use this temporarily until DNS
   propagates in step 6.
6. **Deploys tab**: redeploy. Wait for green. The healthcheck at
   `/api/health` must return 200 for Railway to flip traffic over.
7. Smoke test:
   ```bash
   curl https://your-app.up.railway.app/api/health
   # {"ok":true}
   curl -I https://your-app.up.railway.app/wiki/sql-injection
   # HTTP/2 200
   ```

---

## 5. Cloudflare — DNS + TLS

1. Sign up at <https://cloudflare.com> and **Add a Site** → enter your
   domain.
2. Cloudflare shows two nameservers. Update them at your domain
   registrar (Namecheap, Google Domains, Porkbun, etc.). Propagation
   takes minutes to hours.
3. Once Cloudflare detects your domain → **DNS → Records**:

   ```
   Type    Name                Content                         Proxy
   CNAME   @                   your-app.up.railway.app         ✓ proxied
   CNAME   www                 your-app.up.railway.app         ✓ proxied
   ```

   (If your domain doesn't allow CNAME on apex, use `A` records
   pointing to Railway's IP — get from Railway settings → networking.)

4. **Add the Resend DNS records from step 2**:

   ```
   Type    Name                                     Content                         Proxy
   TXT     mail                                     v=spf1 include:_spf.resend.com ~all     DNS only
   TXT     resend._domainkey.mail                   <long DKIM key from Resend>             DNS only
   TXT     _dmarc.mail                              v=DMARC1; p=none; ...                   DNS only
   ```

   The exact values come from the Resend dashboard. `Proxy: DNS only`
   (gray cloud) is critical — proxied records would break email auth.

5. **SSL/TLS → Overview** → set encryption mode to **Full (strict)**.
   Railway terminates TLS at the edge with a Let's Encrypt cert; Full
   strict tells Cloudflare to verify the upstream cert.

6. **Railway → Settings → Networking → Custom Domain** → add
   `your-domain.com` and `www.your-domain.com`. Railway will issue a
   cert; once it succeeds, your domain serves the app.

7. **Optional hardening**:
   - **SSL/TLS → Edge Certificates → Always Use HTTPS** → On.
   - **SSL/TLS → Edge Certificates → HSTS** → enable with `max-age=63072000`,
     `includeSubDomains`, `preload`. (The app also sets HSTS, this is
     belt-and-suspenders.)
   - **Security → WAF → Managed Rules** → enable the Cloudflare
     Managed Ruleset.
   - **Caching → Cache Rules** → leave defaults — Next.js sets its
     own cache headers and Cloudflare's defaults respect them.

---

## 6. Loop back: update the integrations with the real domain

Now that `https://your-domain.com` is live:

1. **Paddle dashboard → Webhook endpoint** → update URL from the
   `up.railway.app` placeholder to `https://your-domain.com/api/paddle/webhook`.
2. **Railway env vars** → update `NEXT_PUBLIC_APP_URL` to
   `https://your-domain.com`, then redeploy (the value is baked into
   the client bundle).
3. **Resend** → verify domain status is `Verified` (green dot). If
   still pending, propagation may not be complete — wait, then
   re-trigger the Resend verification.

---

## 7. GitHub Actions — wire the cron jobs

The repo includes two workflows in `.github/workflows/cron-*.yml`:

- `cron-drip.yml` — hourly, hits `/api/cron/drip`.
- `cron-engagement.yml` — daily 09:00 UTC, hits `/api/cron/engagement`.

1. **GitHub → repo → Settings → Secrets and variables → Actions →
   New repository secret**:
   - `APP_URL` = `https://your-domain.com`
   - `CRON_SECRET` = (same value as Railway env)
2. **Actions tab → Cron · drip emails → Run workflow** (manual trigger)
   to verify it works. Expect `{"ok":true,"sentCount":0,"errorCount":0,...}`
   on a fresh deployment.

---

## 8. End-to-end smoke test

Run through the user flow on the live domain:

| Check | What to verify |
|---|---|
| `https://your-domain.com` | Loads, no console errors, mid-load no FOUC |
| `https://your-domain.com/wiki` | All 55 articles listed by category |
| `https://your-domain.com/wiki/sql-injection` | Renders, "See also" footer populated |
| `https://your-domain.com/api/health` | `{"ok":true}` |
| `https://your-domain.com/signup` | Account creation works, email arrives within ~30s |
| `https://your-domain.com/pricing` | Paddle overlay opens; checkout completes (sandbox card) |
| Paddle webhook | Check Paddle dashboard → webhook log: each event delivered with 2xx response |
| `https://your-domain.com/account/settings` | Export downloads JSON; delete deactivates account |
| GitHub Actions → cron-drip | Manual trigger returns `{"ok":true,...}` |

If any step fails, check:
- Railway → Deploys → Logs (server-side errors)
- Browser DevTools → Network (client-side errors)
- Resend dashboard → Logs (delivery failures)
- Paddle dashboard → Webhook log (signature failures, 4xx responses)

---

## Common pitfalls

| Symptom | Cause |
|---|---|
| Build fails on `Environment validation failed` | An env var the schema requires in production is missing or stuck at the default placeholder. |
| Healthcheck flips between 200 and 503 | Mongo connection is slow or IP allowlist doesn't include Railway egress IPs. |
| Emails send in dev but not prod | `RESEND_FROM_ADDRESS` uses an unverified domain — Resend rejects sends. |
| Paddle checkout overlay never opens | `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` or `NEXT_PUBLIC_PADDLE_ENV` mismatch — token from sandbox dashboard with `PADDLE_ENV=production` (or vice versa). |
| Paddle webhook returns 401 | `PADDLE_WEBHOOK_SECRET` mismatch between dashboard and Railway env var. |
| Cron workflow returns 401 | `CRON_SECRET` in GitHub secrets doesn't match Railway env. |
| Cloudflare → 525 / 526 | SSL mode set higher than Railway can satisfy. Use "Full (strict)". |
| Cloudflare → 521 | Railway hostname not added as Custom Domain, or DNS hasn't propagated. |

---

## Rollback

If a deploy goes bad:

1. **Railway → Deploys** → previous green deployment → **Rollback**.
   Reverts in seconds; Mongo schema changes are not rolled back
   automatically.
2. **Paddle webhook** keeps delivering to your URL; the route is
   idempotent and signature-verified, so duplicate replays are safe.
3. **GitHub Actions cron** — disable the workflow via Actions tab if a
   bad code path is sending malformed emails.
