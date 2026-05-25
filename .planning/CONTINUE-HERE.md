---
session_handoff: true
last_session_ended: 2026-05-25
git_head: 15ed5bc
working_tree: clean (except pre-existing .planning/marketing/)
build: green
typecheck: green
tests: 59/59 passing
wiki_articles: 55
---

# Continue here — fresh session pickup

The prior session's top-priority items (cross-link pass + bank growth)
are done. This file picks up from there.

## What this session shipped (commit `15ed5bc`)

### Wiki cross-link pass — 22 articles
Updated `related:` arrays on the original 17 + 5 round-2 articles to
reference round-2 additions. Dropped two dead links (`tls-handshake`,
`cloud-imds`). Verified zero dangling references across all 55 articles.

### Wiki bank growth — 18 new articles (37 → 55)
- **defenses (+6)**: hsts, waf, siem, edr, zero-trust, laps
- **concepts (+2)**: defense-in-depth, principle-of-least-privilege
- **protocols (+3)**: dns, smb, ldap
- **standards (+3)**: cve, nist-csf, gdpr
- **roles (+2)**: pentester, soc-analyst
- **certifications (+2)**: security-plus, pnpt

Reverse cross-links added to ad, mimikatz, mitre-attck, owasp-top-10,
cvss, bloodhound, kerberos, ntlm, pass-the-hash, ransomware, phishing,
ceh, oscp, tls, content-security-policy.

## What's left

### Highest priority — wiki internal search (~1-2 hr)

The wiki has 55 articles across 8 categories. Alphabetical category
pages still work, but a search box is becoming necessary. Two options:

1. **Client-side fuse.js** — bundle the article catalog (title +
   summary + slug + aliases) as a static JSON, ship a small autocomplete
   on the wiki nav. Simplest; ~3KB extra bundle.
2. **Pagefind static search** — production-quality static search via
   <https://pagefind.app>. Heavier setup; better quality at scale.

Recommend option 1 first — it covers the 55-article case well.

### Second priority — bank growth to ~75 (optional)

Remaining gaps from the original handoff:

- **Defenses still missing:** Network Segmentation, IDS/IPS, DLP
- **Concepts still thin:** CIA Triad (already exists), Threat Model, Risk Assessment, AAA
- **Protocols still missing:** HTTPS (covered by tls.md), RDP, FTP/SFTP, SSH
- **Standards still missing:** ISO 27001, HIPAA, PCI DSS, SOC 2
- **Roles still missing:** Red Team Operator, Threat Hunter, Security Engineer, GRC Analyst, Incident Responder
- **Certifications still thin:** CISSP, CySA+, GSEC, CASP+, GIAC

Article voice is locked in. Reference any existing article (e.g.
`siem.md`, `pentester.md`) for the canonical pattern. Each article
~400-900 words, opens with bolded one-sentence definition, structural
H2 headings, internal links via `[Title](/wiki/slug)`, footer "Further
reading" section with 3-4 external links.

### Third priority — editor UX `/admin/wiki` (larger)

Same as last handoff. The author loop is "edit markdown on disk +
Vercel redeploy." A `/admin/wiki` editor would speed publication.
Requires auth-gated route, markdown editor component, file-write API.
Not urgent — markdown-on-disk works.

### Fourth priority — cross-cite from curriculum

The day-by-day curriculum (`docs/curriculum/days.ts`) and bonus
articles (`docs/content/*.md`) reference concepts that now have
dedicated wiki pages. Adding `[Term](/wiki/slug)` links from those
surfaces compounds internal-link density (SEO + AEO benefit) and
helps users discover the wiki organically.

## Production readiness — still pending

Unchanged from last handoff:

- Env vars in Vercel (MongoDB URI, Paddle keys, Resend domain)
- Paddle subscription product submission
- Resend domain verification (DKIM, SPF, DMARC)
- `NEXTAUTH_URL` for the production domain

## Where the wiki content lives

```
docs/wiki/                                    55 articles
├── (flat layout, one .md file per article)
└── *.md

app/src/lib/content/wiki.ts                   Parser + types
app/src/app/wiki/page.tsx                     /wiki index
app/src/app/wiki/[slug]/page.tsx              /wiki/<slug>
app/src/app/wiki/category/[name]/page.tsx     /wiki/category/<name>
app/src/components/site-nav.tsx               Nav includes "Wiki"
app/src/app/sitemap.ts                        Auto-includes wiki routes
```

## Quick orientation commands

```bash
git log --oneline -15           # Recent commits

cd app
npm run typecheck               # green
npm test                        # 59/59 passing
npm run build                   # green; 79 static pages
npm run dev                     # http://localhost:3000

# Wiki content
ls docs/wiki/ | wc -l           # 55
ls docs/wiki/                   # browse articles

# Sanity check for dangling related: references
cd docs/wiki
grep -h "^related:" *.md | sed -E 's/related: ?\[//; s/\]//' \
  | tr ',' '\n' | tr -d ' ' | sort -u > /tmp/r.txt
ls *.md | sed 's/\.md$//' | sort > /tmp/f.txt
comm -23 /tmp/r.txt /tmp/f.txt  # should be empty
```

## Wiki article count by category (current state)

```
attacks:           12   (no change this session)
defenses:           7   (was 1; +6 this session)
protocols:         11   (was 8; +3 this session: dns, smb, ldap)
tools:             10   (no change this session)
concepts:           3   (was 1; +2 this session)
standards:          6   (was 3; +3 this session: cve, nist-csf, gdpr)
certifications:     4   (was 2; +2 this session: security-plus, pnpt)
roles:              2   (was 0; +2 this session: pentester, soc-analyst)
total:             55   (was 37)
```

Good luck.
