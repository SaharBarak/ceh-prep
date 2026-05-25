---
title: HTTP Request Smuggling
slug: http-request-smuggling
category: attacks
summary: HTTP Request Smuggling (HRS) is a web vulnerability that exploits parsing inconsistencies between a frontend HTTP server (proxy or CDN) and a backend HTTP server, letting an attacker inject a smuggled request that gets prepended to another user's legitimate request.
related: [sql-injection, cross-site-scripting, csrf, ssrf, burp-suite, owasp-top-10]
aliases: [HRS, HTTP Desync, Request Smuggling, CL.TE, TE.CL]
updated: 2026-05-25
---

**HTTP Request Smuggling** (HRS) is a web vulnerability that exploits parsing inconsistencies between two HTTP servers in a request chain — typically a frontend (load balancer, CDN, reverse proxy) and a backend (application server). When the two servers disagree on where one request ends and the next begins, an attacker can inject a "smuggled" request that prepends to the next legitimate user's request on the same connection.

HRS earned its current notoriety from James Kettle's 2019 BlackHat talk "HTTP Desync Attacks: Request Smuggling Reborn" — research that exposed the bug class across nearly every major load balancer + origin server combination at the time. A 2022 follow-up demonstrated equivalent attacks on HTTP/2-to-HTTP/1 downgrades.

## How it works — the core mechanism

A request's body length on the wire is communicated two ways:

- **`Content-Length: N`** — explicit byte count.
- **`Transfer-Encoding: chunked`** — read chunks until a `0\r\n\r\n` terminator.

Per RFC 7230, when both headers appear, `Transfer-Encoding` takes precedence. But two HTTP servers in a chain sometimes disagree on this:

| Variant | Frontend uses | Backend uses | Name |
|---|---|---|---|
| **CL.TE** | `Content-Length` | `Transfer-Encoding` | The classic. |
| **TE.CL** | `Transfer-Encoding` | `Content-Length` | The mirror. |
| **TE.TE** | Both parse `Transfer-Encoding`, but parse the *header* differently (one accepts `Transfer-Encoding: chunked`, the other rejects `Transfer-Encoding : chunked` with a space). | Subtler. |

When the frontend and backend disagree, the backend's interpretation of "where this request ends" doesn't match the frontend's. The backend reads *past* what the frontend thought was one request, treating leftover bytes as the start of the next user's request.

## A concrete CL.TE example

```
POST / HTTP/1.1
Host: target.example
Content-Length: 13
Transfer-Encoding: chunked

0

SMUGGLED
```

- **Frontend** uses `Content-Length: 13`. Reads 13 bytes of body, which equals `0\r\n\r\nSMUGGLED`. Forwards the entire 13-byte body to the backend as one request.
- **Backend** uses `Transfer-Encoding: chunked`. Reads `0\r\n\r\n` as the chunked terminator, declares the body finished after 0 bytes. The remaining `SMUGGLED` is now sitting in the connection buffer, treated as the start of the next request.

When the *next* legitimate user's request arrives on that same persistent connection, `SMUGGLED` gets prepended:

```
SMUGGLEDGET /home HTTP/1.1
Host: target.example
Cookie: session=victim_session_token
...
```

The smuggled bytes interfere with the legitimate request — most usefully, they let the attacker manipulate how the backend routes or processes the victim's request.

## Impact classes

What HRS actually buys an attacker:

| Impact | How |
|---|---|
| **Bypass frontend security rules** | The frontend thinks the request goes to `/safe`; the backend sees the smuggled `/admin`. Restrictions enforced at the frontend (e.g. "block external access to /admin") are bypassed. |
| **Cache poisoning** | The smuggled response gets cached at the frontend against the victim's URL. Now every user receiving that URL gets the poisoned response. |
| **Credential capture** | The smuggled request can be shaped so the backend's response includes the victim's session-bound data in a way the attacker can read. |
| **Internal request hijack** | Smuggle a request to an internal admin endpoint behind the frontend; the response goes back to the smuggling attacker, not the victim. |
| **Bypass authentication** | The smuggled request inherits the victim's cookies on the next stage of the connection, executing privileged actions. |

## Detection

You can't easily detect HRS from black-box scanning the way you'd find [SQL injection](/wiki/sql-injection). The reliable detection is **differential timing**:

1. Send a baseline request, note response time `T1`.
2. Send a CL.TE-shaped request with a body that *should* hang the backend (e.g. `Content-Length: 100` but only 10 bytes of body). The backend hangs waiting for more chunked data while the frontend already sent everything.
3. If `T2 - T1` is ≥ 5 seconds (or whatever the backend's read timeout is), you've created a desync.

Tools that automate this:

- **[Burp Suite](/wiki/burp-suite) Repeater + manual probes** — the canonical hand-test path.
- **`smuggler.py` (Defparam)** — automated CL.TE / TE.CL / TE.TE variant fuzzer with timing-based detection.
- **Turbo Intruder (Burp extension)** — fires timed payloads at scale, useful for fuzzing header variants.

## A taste of the impact

The PortSwigger lab "Exploiting HTTP request smuggling to bypass front-end security controls" shows the canonical case: a frontend that blocks `/admin` but accepts `/api`. The smuggler:

```
POST /api HTTP/1.1
Host: vulnerable.example
Content-Length: 49
Transfer-Encoding: chunked

0

GET /admin HTTP/1.1
Host: vulnerable.example


```

The frontend sees one POST to `/api` (allowed). The backend processes the POST, then reads the smuggled `GET /admin` as a separate request, responds, and (depending on the connection's lifecycle) the response can be returned to the attacker via the next request on the connection.

## Why this isn't a single CVE

HRS isn't bound to one parser. Every major proxy has shipped multiple HRS-vulnerable releases:

- **Nginx** — at least 3 HRS-related CVEs between 2019 and 2024.
- **AWS ELB / ALB** — major CL.TE in 2019.
- **Akamai / Cloudflare / Fastly** — all had findings in 2019-2020.
- **Apache mod_proxy** — TE.CL variants.
- **Spring Boot embedded Tomcat** — TE.CL in 2021.
- **Squid** — multiple parser issues.

The 2022 HTTP/2 desync research extended this to HTTP/2-to-HTTP/1 downgrades — when a CDN speaks HTTP/2 to clients but HTTP/1 to origin, the conversion introduces a new ambiguity surface.

## Mitigation

For the defender:

1. **Reject ambiguous requests.** Modern proxies have flags to refuse requests with both `Content-Length` and `Transfer-Encoding`. Enable them.
2. **Front-back consistency.** The frontend and backend should use the *same* HTTP parser (ideally the same library version). Most modern CDN/origin combos are fine; bespoke proxy chains are dangerous.
3. **HTTP/2 end-to-end.** Eliminates the HTTP/1 ambiguity surface entirely. Introduces HTTP/2-specific desync surfaces (per Kettle 2022), so this is defense-in-depth.
4. **Update both layers regularly.** HRS bugs are still being discovered. Last year's "I checked, we're not vulnerable" doesn't transfer to this year's parser.
5. **Disable HTTP keep-alive on the frontend↔backend hop.** Each request opens a fresh connection — no shared connection means no shared buffer means no smuggling. Heavy throughput cost.

## Real-world bounties

HRS has been a frequent six-figure bug bounty payout class. Bounty programs that pay HRS:

- **HackerOne** — most major programs classify HRS as P1 / Critical.
- **Bugcrowd** — similar.
- **PortSwigger's research blog** lists dozens of published HRS findings with payouts.

## Practice

The single best learning track:

- **[PortSwigger Web Security Academy: HTTP request smuggling](https://portswigger.net/web-security/request-smuggling)** — 14 free interactive labs, escalating difficulty. Doable in one weekend.

If you've never done HRS, finish those labs before going anywhere near a live bounty target.

## Further reading

- [James Kettle: HTTP Desync Attacks (2019)](https://portswigger.net/research/http-desync-attacks-request-smuggling-reborn).
- [James Kettle: HTTP/2 Desync (2022)](https://portswigger.net/research/http2).
- [PortSwigger Web Security Academy: HRS labs](https://portswigger.net/web-security/request-smuggling).
- [smuggler.py (Defparam)](https://github.com/defparam/smuggler).
