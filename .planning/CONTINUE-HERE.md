---
session_handoff: true
last_session_ended: 2026-05-25
git_head: 356cf5c
working_tree: clean
build: green
typecheck: green
tests: 59/59 passing
---

# Continue here — fresh session pickup

This session shipped **10 commits across 4 major workstreams** since the
last handoff (c82fea9). The product moved from "ready for production
wiring" to "review-driven shipping cycle complete + cyber wiki launched."

## What's live now

### Account self-service (commit `47de507`)
- `GET /api/account/export` — GDPR Article 15 JSON archive
- `POST /api/account/delete` — Article 17 cascade with audit-log retention
- `/account/settings` — display name, password change, revoke sessions, marketing flags, export, delete

### SEO basics (commit `e446f20`)
- OG images (homepage / day / bonus)
- sitemap.xml + robots.txt + Schema.org JSON-LD
- Per-page `generateMetadata`

### Audit + Day-14 exam simulator (commits `76b656e` + `741db1d`)
- Caught + fixed two silent regressions: `$addToSet: { $eq }` CastError on completion + saveAnswer never updating `User.completedDays`
- Shipped real `/exam` route: Pro-gated, 4-hour timer, 64+ question full-bank, per-domain readiness chart

### Reviewer agents + their fixes (commits `56c5986` + `7ce6c8b` + `2101bb4` + `5ce45d8`)
- Two reviewer agents (red-teamer + CEH alumni) audited site/curriculum
- Closed every finding: hashcat false claim, whisper artifact, EternalBlue CVSS, "125 q" lie, "strongest predictor" claim, "practitioner writeups" framing, +18 questions (bank 52 → 81), per-domain readiness, flag-for-review UX, pre-submit confirm, AD bonus article, LOLBins article, HTTP smuggling article, /exam/runs/[id] review-wrong-answers page, past-attempts list on /account/settings

### Cyber Wiki — Wikipedia-style SEO/AEO knowledge base (commits `b586021` + `356cf5c`)
- File-based content layer: `docs/wiki/*.md` with YAML frontmatter
- Routes: `/wiki`, `/wiki/[slug]`, `/wiki/category/[name]`
- All static-rendered (`force-static` + 1h revalidate)
- Dual Schema.org JSON-LD: `DefinedTerm` (AEO surface) + `TechArticle` (Google Rich Results)
- 37 seed articles across 7 categories (attacks/defenses/protocols/tools/concepts/standards/certifications)
- Auto-included in sitemap; "Wiki" added to SiteNav

## What to do first in the next session

### Highest priority — wiki cross-link pass (~30 min)

The 37 articles exist. The cross-link graph between them is **partially
populated** — the 20 new articles in `356cf5c` reference each other, but
the original 17 (in `b586021`) still have their original `related:` arrays
that don't know about the new articles. Update each of these:

```
Original article         Should now also reference
─────────────────────    ──────────────────────────
sql-injection            sqlmap, idor
cross-site-scripting     content-security-policy
csrf                     oauth-2 (state param), idor
ssrf                     xxe (sibling fetch-bug class)
active-directory         bloodhound, mimikatz, kerberoasting, as-rep-roasting
kerberos                 kerberoasting, as-rep-roasting, bloodhound
ntlm                     mimikatz, bloodhound
pass-the-hash            mimikatz, bloodhound
owasp-top-10             idor, xxe, http-request-smuggling, sqlmap
mitre-attck              phishing, ransomware
jwt                      oauth-2, openid-connect, saml
nmap                     wireshark
burp-suite               sqlmap, xxe, idor, http-request-smuggling
tls                      oauth-2, saml
ceh                      oscp, bloodhound
metasploit               bloodhound
```

Edit each article's frontmatter `related: [...]` line only — no body
changes needed. The route auto-renders the "See also" footer from
frontmatter.

### Second priority — bank growth to 50-60 articles

Specific gaps from the existing categories:

- **Defenses bare:** HSTS, LAPS, Zero Trust, EDR, WAF, SIEM, Defense in Depth
- **Concepts thin:** Defense in Depth, Principle of Least Privilege, Threat Model, Risk
- **Protocols thin:** DNS, SMB, LDAP, HTTPS
- **Standards thin:** NIST CSF, ISO 27001, GDPR, HIPAA, CVE
- **Roles empty:** Pentester, Red Team Operator, SOC Analyst, Threat Hunter, Security Engineer
- **Certifications thin:** PNPT, CISSP, Security+

Article voice is set; reference any existing article (e.g. `sql-injection.md`)
for the canonical pattern. Each article is ~400-700 words, opens with a
bolded one-sentence definition, has structural H2 headings, links
internally with `[Title](/wiki/slug)`.

### Third priority — editor UX (optional, larger)

The current author loop is "edit markdown on disk + Vercel redeploy." A
`/admin/wiki` editor would speed publication. Requires auth-gated route,
markdown editor component (Toast UI, Milkdown, or a stripped textarea),
file-write API. Not urgent — markdown-on-disk is fine.

## Where the wiki content lives

```
docs/wiki/                                    37 articles (was 0 last session)
├── attacks/                                  (no subfolder — flat layout)
├── sql-injection.md  csrf.md  xxe.md  etc.
├── ...

app/src/lib/content/wiki.ts                   Parser + types
app/src/app/wiki/page.tsx                     /wiki index
app/src/app/wiki/[slug]/page.tsx              /wiki/<slug>
app/src/app/wiki/category/[name]/page.tsx     /wiki/category/<name>
app/src/components/site-nav.tsx               Nav now includes "Wiki"
app/src/app/sitemap.ts                        Auto-includes wiki routes
```

## What this session deliberately did NOT do

- **Wiki cross-link pass** — deferred (see above). Quick win for the
  next session.
- **Internal wiki search** — no search UI exists yet. With 37+ articles,
  alphabetical category lists work; at 100+ articles a search box becomes
  necessary.
- **Wiki content imports from other locations** — the curriculum (`days.ts`)
  and bonus articles (`docs/content/`) have wiki-relevant material that
  could be cross-cited. No work done on this front.
- **Production go-live** — same as last handoff. Env vars + Paddle
  submission + Resend domain verification still pending.
- **Bank growth to 125** — currently 81 questions; not all the way there.
  Deferred per the alumni's "diminishing returns past quality threshold"
  note.

## Quick orientation commands

```bash
# Recent commits
git log --oneline -15

# Build + test + lint
cd app
npm run typecheck       # green
npm test                # 59/59 passing
npm run build           # green; ~61 static pages

# Dev server
npm run dev             # http://localhost:3000

# Wiki content
ls docs/wiki/           # 37 articles

# QA reports + reviews from this session
ls .planning/qa-reports/
```

## Key file locations (additions to prior handoff)

```
/wiki routes              app/src/app/wiki/
ExamRun review            app/src/app/(app)/exam/runs/[id]/
ExamRun model             app/src/lib/db/models/exam-run.ts
Exam builder              app/src/lib/exam/builder.ts
Exam server action        app/src/lib/actions/exam.ts
Wiki parser               app/src/lib/content/wiki.ts
Wiki content              docs/wiki/*.md
Domain enum               app/src/lib/content/types.ts (CehDomain, DOMAIN_META)
Account self-service      app/src/app/(app)/account/settings/ + api/account/{export,delete}
```

Good luck.
