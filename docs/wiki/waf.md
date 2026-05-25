---
title: Web Application Firewall
slug: waf
category: defenses
summary: A Web Application Firewall (WAF) is a security control that inspects HTTP traffic between clients and a web application, blocking requests that match attack signatures or behavioral patterns. WAFs sit in front of vulnerable code and buy time — they are a compensating control, not a substitute for fixing the underlying bug.
related: [sql-injection, cross-site-scripting, owasp-top-10, burp-suite, content-security-policy]
aliases: [WAF, Web App Firewall, Web Application Firewalls]
updated: 2026-05-25
---

A **Web Application Firewall** (WAF) is a security control that inspects HTTP requests and responses for an application and blocks ones that match attack signatures, anomaly thresholds, or custom rules. WAFs sit in the request path between the client and the application — typically at the CDN edge, in front of a load balancer, or as a reverse-proxy layer.

A WAF is a **compensating control**. It is the layer that catches the [SQL Injection](/wiki/sql-injection), [XSS](/wiki/cross-site-scripting), or path-traversal payload the developer forgot to filter, and it buys time to ship a real fix. It does not replace fixing the underlying vulnerability.

## How a WAF works

A WAF parses the HTTP request before it reaches the application:

```
client ──► WAF ──► load balancer ──► app servers
              │
              └─► block? log? challenge?
```

For each request, the WAF evaluates a ruleset:

- **Signature rules** — regex or pattern matches against known attack payloads (`UNION SELECT`, `<script>`, `../../etc/passwd`).
- **Anomaly scoring** — accumulate a score from multiple suspicious features (long URL, encoded payload, unexpected `Content-Type`); block at a threshold.
- **Behavioral rules** — rate limiting, bot detection, geo-blocking, request-method restrictions.
- **Custom rules** — written by the security team for site-specific protection (`block any request with X-Original-URL` to defend a known CVE).

Common rulesets:

| Ruleset | Notes |
|---|---|
| **OWASP Core Rule Set (CRS)** | Open-source ruleset for ModSecurity. The industry baseline. |
| **Cloud-vendor managed rules** | AWS WAF managed rules, Cloudflare Managed Rulesets, Azure Application Gateway WAF — vendor-curated lists. |
| **Vendor-bundled rules** | F5 ASM, Imperva, Akamai bundle proprietary rules. |

## Deployment modes

| Mode | Where it runs |
|---|---|
| **Cloud / CDN WAF** | Cloudflare, AWS WAF, Akamai, Fastly — runs at edge POPs, no infrastructure to operate. |
| **Reverse proxy** | Nginx + ModSecurity, F5, Imperva on-prem — runs in front of your app servers. |
| **Host-based** | ModSecurity as an Apache or IIS module on the app server itself. |
| **API gateway** | Kong, Apigee, AWS API Gateway with WAF integration — purpose-built for API endpoints. |

The trend has been toward **edge WAFs** (Cloudflare, AWS WAF) because they scale and absorb attack traffic before it touches your origin.

## What a WAF catches well

- Generic injection payloads matching public signatures.
- Known-CVE exploit traffic (Log4Shell, Spring4Shell, ProxyShell, etc. — WAF vendors ship rules within hours).
- Bot traffic at the credential-stuffing / scraping threshold.
- Geographic or ASN-based filtering of obvious abuse sources.
- High-RPS attacks against specific endpoints (rate limiting).

## What a WAF misses

| Class of issue | Why |
|---|---|
| **Logic flaws** | [IDOR](/wiki/idor), broken access control, race conditions — the request looks normal. |
| **Custom-encoded payloads** | Sufficient mutation defeats signature matching ("filter evasion"). |
| **Server-side vulnerabilities behind the WAF** | [SSRF](/wiki/ssrf), deserialization — the WAF inspected the request; the bug is in the response path. |
| **Bypasses via second-channel input** | If a parameter reaches the database via a queue or webhook the WAF didn't inspect, signatures don't apply. |
| **HTTP/2 + HTTP/1.1 desynchronization** | [HTTP Request Smuggling](/wiki/http-request-smuggling) often slips past WAFs by exploiting parser differences. |

The fundamental WAF limitation: it is **pattern matching on the request, blind to the application's semantics**. The same request that says "delete account 42" is benign from user 42 and an attack from user 7 — the WAF can't tell.

## False positives — the real operational cost

Production WAFs generate false positives. A user with an unusual name, a developer paste of a JSON sample, a webhook with a JWT containing `<script>` in a claim — all common false-positive sources. The standard rollout pattern:

1. Deploy in **monitor-only mode** for 2-4 weeks.
2. Review every block — tune away legitimate-traffic matches.
3. Switch to **enforcing mode** with paranoia level 1 (most permissive ruleset).
4. Gradually increase paranoia level as false-positive volume drops.

A WAF that blocks 0.1% of legitimate traffic is unusable. Spend the tuning budget upfront.

## WAF in compliance

Many compliance frameworks list WAFs as an acceptable compensating control:

- **PCI DSS 6.4.2** — public-facing web apps must have either a code review process *or* an automated technical solution (a WAF).
- **HIPAA / HITRUST** — WAF is a common control mapped to network-protection requirements.
- **SOC 2** — frequently asked about during vendor security questionnaires.

Auditors love WAFs because they produce easy-to-read logs.

## Bypass techniques (for defenders' awareness)

- **Encoding variation** — URL-encode the payload, double-encode, Unicode-encode, mix cases. Defeats naive signature matches.
- **Chunked encoding tricks** — split a payload across chunked HTTP body fragments.
- **Parameter pollution** — submit the same parameter twice; WAF inspects one copy, app reads the other.
- **HTTP method override** — sneak via a `_method` parameter or `X-HTTP-Method-Override` header.
- **Direct origin access** — find the origin server's IP and bypass the WAF entirely. Most cloud WAFs leak the origin IP via DNS history.

The defender's response: lock origin firewalls to the CDN's IP ranges only.

## Further reading

- [OWASP CRS — Core Rule Set](https://coreruleset.org/).
- [ModSecurity reference](https://github.com/SpiderLabs/ModSecurity).
- [AWS WAF documentation](https://docs.aws.amazon.com/waf/).
- [Cloudflare WAF docs](https://developers.cloudflare.com/waf/).
