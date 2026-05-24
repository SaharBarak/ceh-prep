---
title: OWASP Top 10
slug: owasp-top-10
category: standards
summary: The OWASP Top 10 is a periodically-updated awareness document by the Open Web Application Security Project listing the most critical web application security risks. It is the de-facto industry reference for application security and the framework most web pentest reports map findings against.
related: [sql-injection, cross-site-scripting, csrf, ssrf, jwt]
aliases: [OWASP Top Ten, OWASP T10]
updated: 2026-05-24
---

The **OWASP Top 10** is an awareness document published by the **Open Web Application Security Project** (OWASP) listing the most critical web application security risks. First published in 2003 and revised every 3-4 years, it is the most widely referenced application-security framework in industry — appearing in pentest reports, secure-SDLC training, and most compliance frameworks that touch application security.

The current version is **OWASP Top 10:2021**. The 2025 revision is in draft.

## OWASP Top 10:2021

| # | Category | What it covers |
|---|---|---|
| **A01** | Broken Access Control | IDOR, path traversal, missing function-level authorization. The most common high-impact bug class. |
| **A02** | Cryptographic Failures | Storing passwords with weak hashing, insecure TLS configurations, leaking sensitive data in transit or at rest. |
| **A03** | Injection | [SQL injection](/wiki/sql-injection), command injection, LDAP injection, [XSS](/wiki/cross-site-scripting) (moved here from a separate category in 2021). |
| **A04** | Insecure Design | Threat-model-level failures — features that are architecturally vulnerable regardless of implementation. |
| **A05** | Security Misconfiguration | Default credentials, verbose errors, missing headers, exposed admin endpoints. |
| **A06** | Vulnerable and Outdated Components | Using a library with a known CVE. Log4Shell falls here. |
| **A07** | Identification and Authentication Failures | Weak passwords, missing MFA, predictable session IDs, [JWT](/wiki/jwt) algorithm confusion. |
| **A08** | Software and Data Integrity Failures | Supply-chain attacks, unsigned updates, deserialization vulnerabilities. |
| **A09** | Security Logging and Monitoring Failures | Missing audit logs that prevent incident detection. |
| **A10** | Server-Side Request Forgery ([SSRF](/wiki/ssrf)) | New category in 2021 — recognized as a distinct risk class after a string of cloud-related breaches. |

## How findings map

A web pentest report that says "we found 12 high-severity findings" almost always categorizes each finding by Top 10 entry. The mapping is rough — many bugs span multiple categories — but it gives non-security stakeholders a stable vocabulary.

Example mappings:

- **An IDOR on `/orders/123`** → A01 Broken Access Control.
- **A reflected XSS in the search box** → A03 Injection.
- **The app uses Log4j 2.14** → A06 Vulnerable Components.
- **An admin endpoint accepts `Authorization: Bearer x` with `alg=none`** → A07 Auth Failures + A02 Crypto Failures.

## Common misuse — "we passed OWASP Top 10 testing"

The Top 10 is a *risk awareness* document, not a test plan. "We tested for the OWASP Top 10" usually means the tester ran a Burp scan and checked off the categories — a vastly incomplete assessment. A real test:

- Uses the Top 10 as a structural framework, not a checklist.
- Tests for each category's full surface (A03 is not "we checked one SQL field," it's the entire injection surface).
- Goes beyond the Top 10 — HTTP request smuggling, cache poisoning, race conditions, and SSO-flow flaws are not in any Top 10 category and frequently land high-severity findings.

## OWASP API Security Top 10

A separate publication, the **OWASP API Top 10** (latest: 2023), targets API-specific risks. The categories differ from the web Top 10:

- **API1** Broken Object Level Authorization (BOLA — API-specific IDOR)
- **API2** Broken Authentication
- **API3** Broken Object Property Level Authorization
- **API4** Unrestricted Resource Consumption
- **API5** Broken Function Level Authorization
- **API6** Unrestricted Access to Sensitive Business Flows
- **API7** Server-Side Request Forgery
- **API8** Security Misconfiguration
- **API9** Improper Inventory Management
- **API10** Unsafe Consumption of APIs

For modern microservices-heavy environments, the API Top 10 is often more useful than the web Top 10 — APIs ship more bugs per LOC than monolithic web apps.

## Related OWASP projects

- **[OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)** — implementation-level guidance for each Top 10 category. The single most useful OWASP project for developers.
- **[OWASP ZAP](https://www.zaproxy.org/)** — open-source web app scanner; usable as a free alternative to Burp Suite Pro for basic testing.
- **[OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)** — Application Security Verification Standard. More detailed than the Top 10; useful for SDLC integration.
- **[OWASP Top 10 LLM](https://owasp.org/www-project-top-10-for-large-language-model-applications/)** — analogous Top 10 for LLM-integrated applications. Includes prompt injection, training-data poisoning, model DoS.

## Further reading

- [OWASP Top 10:2021 (official site)](https://owasp.org/Top10/).
- [OWASP API Security Top 10 (2023)](https://owasp.org/API-Security/editions/2023/en/0x11-t10/).
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/).
