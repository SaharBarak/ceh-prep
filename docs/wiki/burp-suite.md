---
title: Burp Suite
slug: burp-suite
category: tools
summary: Burp Suite is a web application security testing platform by PortSwigger. Its core component — an intercepting proxy — sits between the browser and the target server, letting the tester inspect and modify every HTTP request and response. It is the industry-standard tool for web application penetration testing.
related: [sql-injection, cross-site-scripting, csrf, ssrf, jwt, owasp-top-10]
aliases: [Burp, BurpSuite, PortSwigger Burp]
updated: 2026-05-24
---

**Burp Suite** is a web application security testing platform developed by PortSwigger. At its core is an intercepting proxy that sits between the tester's browser and the target web server, letting the tester inspect and modify every HTTP request and response in flight. Around the proxy is a suite of complementary tools — Repeater, Intruder, Scanner, Extender, Collaborator — that together cover almost every web pentest workflow.

Burp is the de-facto standard tool for web application penetration testing. Most web-app pentest job descriptions assume Burp fluency; most web-app vulnerability research happens through Burp.

## The three editions

| Edition | Cost | Use case |
|---|---|---|
| **Community** | Free | Learning, basic manual testing. Throttles Intruder; no Scanner. |
| **Professional** | ~$475/year/user | Industry standard. Full Intruder speed, Scanner, Collaborator, Extender. |
| **Enterprise** | Quote-based | Scheduled scanning at scale; CI/CD-integrated. Different product line. |

Professional is what working pentesters use. Community is sufficient for learning and small bug bounty work; Intruder throttling is the main limit you'll hit.

## The proxy — Burp's core

Every other Burp feature is built on the proxy. The flow:

```
  Browser  ←→  Burp Proxy (127.0.0.1:8080)  ←→  Target server
```

Configure the browser to use Burp as its HTTP proxy. Install Burp's CA certificate in the browser so HTTPS traffic decrypts. Now every request the browser makes shows up in Burp's HTTP history, and (if intercept is on) Burp holds the request until you forward it — letting you tamper before it reaches the server.

The HTTP history is the foundation of every pentest workflow. You browse the application normally; Burp records every endpoint, parameter, cookie, and header.

## The five other core tools

### Repeater

Single-request manual tester. Send a request from HTTP history to Repeater, tweak it, resend, see the response. The bread-and-butter tool for hand-crafting payloads:

- Test SQL injection by toggling characters in one parameter.
- Walk an IDOR by incrementing a user ID.
- Validate JWT manipulation (change algorithm, claims, signature) and watch the server's reaction.

Repeater is the most-used tool in every pentest.

### Intruder

Multi-request fuzzer. Mark *insertion points* in a request, supply a *payload list*, fire the request once per payload, sort the results by status / length / time. Use cases:

- **Sniper** mode — one insertion point, one payload list. Brute-force a password field, fuzz a parameter for SQLi.
- **Battering Ram** — multiple insertion points, same payload at each.
- **Pitchfork** — multiple insertion points, parallel payload lists (`user1+pass1`, `user2+pass2`, ...).
- **Cluster Bomb** — multiple insertion points, every combination of payloads (`user1+pass1`, `user1+pass2`, `user2+pass1`, ...).

The throttle limit in Community Edition makes Intruder painfully slow for bigger fuzzing jobs — that's the main reason serious testers buy Pro.

### Scanner

Active vulnerability scanner. Crawls the target, identifies parameters, fires payloads, classifies findings. Pro only. Findings flow into the Issues panel with severity, confidence, and a description.

Scanner is fast at catching the OWASP Top 10 mechanically — SQLi, reflected XSS, command injection, open redirects. It's bad at logic flaws, broken access control, and chains that require understanding the application.

Use Scanner as a baseline catch-all, then hand-test for the things it can't see.

### Collaborator

Out-of-band interaction server. Every Burp Pro instance gets a unique `*.burpcollaborator.net` subdomain. Inject the subdomain into URL parameters, header values, anywhere; if the target makes an outbound HTTP / DNS / SMTP request to it, Burp captures the event.

This is the canonical tool for **blind SSRF detection** and **blind out-of-band SQL injection**: you can't see the response, but you can see the callback.

### Extender (BApp Store)

Burp's plugin marketplace. Hundreds of community extensions. The high-leverage ones:

- **Logger++** — exhaustive HTTP logging beyond Burp's default.
- **Autorize** — multi-account authorization testing (catches IDOR / privilege escalation).
- **JWT Editor** — JWT manipulation primitives baked into a Burp tab.
- **Turbo Intruder** — Intruder replacement for speed and complex flow control.
- **Active Scan++** — extra scanner checks beyond the built-in set.

## Workflow — a typical web pentest

1. Configure browser proxy. Browse the entire application as an authenticated user. Burp records HTTP history.
2. Right-click the target host in HTTP history → "Add to scope." Reduces noise from third-party hosts.
3. Skim history for interesting endpoints — anything that takes parameters or modifies state.
4. Drag each interesting request into Repeater. Tamper. Look for SQLi, IDOR, deserialization, authentication bypass.
5. Use Intruder for brute-force / fuzzing jobs (credential stuffing, parameter discovery, password reset token enumeration).
6. Run Scanner in the background to catch the obvious.
7. Use Collaborator for blind SSRF / OOB SQLi.
8. Document findings in Burp's Issues panel; export as report.

## Alternatives

- **OWASP ZAP** — free, open-source, similar feature set. Less polished UX; the Scanner is weaker than Burp's. Good for budget-constrained or fully open-source environments.
- **Caido** — newer commercial alternative. Rust-based, faster, modern UI. Growing community.
- **mitmproxy** — Python-based, scriptable, terminal-first. Different shape — better for automation; weaker for manual exploration.

## Further reading

- [PortSwigger Web Security Academy](https://portswigger.net/web-security) — free interactive labs. Built around Burp. The single best place to learn web app testing.
- [Burp Suite documentation](https://portswigger.net/burp/documentation).
- [PortSwigger blog (research)](https://portswigger.net/research) — James Kettle's HTTP request smuggling work, web cache poisoning, etc.
