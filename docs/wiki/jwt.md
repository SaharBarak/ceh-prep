---
title: JSON Web Token
slug: jwt
category: protocols
summary: A JSON Web Token (JWT) is a compact, URL-safe credential format consisting of a JSON header and payload, base64url-encoded and signed with a key. JWTs are the dominant token format for stateless authentication on modern web APIs.
related: [tls, cross-site-scripting, csrf, owasp-top-10]
aliases: [JWT, JSON Web Tokens, JWS]
updated: 2026-05-24
---

A **JSON Web Token** (JWT, pronounced "jot") is a compact, URL-safe credential format defined by **RFC 7519**. JWTs encode a JSON header and a JSON payload, base64url-encoded, separated by dots, and signed (or encrypted) with a key. They are the dominant token format for stateless authentication on modern web APIs.

The signed variant — JSON Web Signature (JWS) — is what almost everyone calls "a JWT." The encrypted variant (JWE) is rarer in practice.

## Structure

A JWT looks like:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTcwMDAwMDAwMH0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

Three base64url-encoded parts separated by dots:

1. **Header** — `{"alg":"HS256","typ":"JWT"}` — declares the signing algorithm.
2. **Payload** — the actual claims. Standard claims: `sub` (subject — the user ID), `exp` (expiration timestamp), `iat` (issued at), `iss` (issuer), `aud` (audience). Plus any custom claims the issuer adds.
3. **Signature** — HMAC or signature over `base64url(header) + "." + base64url(payload)`.

The header and payload are base64-encoded JSON — anyone with the token can read them. JWTs are *not* encrypted by default; they're *signed*. Don't store secrets in the payload.

## Why apps use JWTs

The pitch: JWTs are stateless. The server doesn't need to look up a session in a database to validate the token — it just verifies the signature and reads the claims. This scales horizontally without a shared session store.

The reality: this works fine for short-lived access tokens. Revoking a JWT before its `exp` is hard — you either accept the window (the token remains valid until expiration), maintain a server-side revocation list (defeating the stateless pitch), or rotate signing keys (which logs out *everyone*).

Practical pattern: short-lived access JWT (15 min - 1 hour) + long-lived opaque refresh token stored server-side. Best of both — fast verification on the API path, real revocation on session termination.

## Common attacks

### `alg=none` algorithm confusion

The header declares the signing algorithm. Some libraries trust this declaration. An attacker can rewrite the header to `{"alg":"none"}` and remove the signature entirely — and a vulnerable library accepts the token as valid because the algorithm says "no signature required."

**Defense:** enforce a server-side algorithm allowlist. Never let the token tell the verifier how to verify it.

### Key confusion (HS256 / RS256 mix-up)

A more subtle variant. RS256 (RSA) tokens are verified with a *public* key; HS256 (HMAC) tokens with a *secret* key. If the verifier accepts the algorithm from the header without checking it matches the expected scheme, an attacker can:

1. Take the server's RS256 public key (often exposed at `/.well-known/jwks.json`).
2. Rewrite the JWT header to `alg=HS256`.
3. Sign the token using the public key bytes as the HMAC secret.
4. The verifier sees `alg=HS256`, retrieves the "secret" key (which it stored as the RSA public key), and validates the signature. Attacker now has a token signed as the server.

**Defense:** enforce expected algorithm explicitly. `jwt.verify(token, key, { algorithms: ['RS256'] })`. Never accept `alg` from the header.

### Weak HS256 secret

HS256 tokens are HMAC-signed with a shared secret. If the secret is short (e.g. `secret`, `changeme`, `1234`), the attacker can crack it offline given any valid token. Tools: `hashcat -m 16500` for JWT HS256.

**Defense:** secrets must be 256-bit minimum random values. Use RS256 (asymmetric) for any token that crosses a trust boundary so the secret isn't held by every verifier.

### `kid` injection

The `kid` header field (key ID) is a hint about which key to use. Some implementations build a file path or SQL query from `kid` directly — leading to path traversal or SQL injection in the kid resolution layer.

**Defense:** validate `kid` against an allowlist before using it as a lookup key.

### JWT-in-URL leakage

Tokens in URLs land in browser history, server logs, and Referer headers when navigating to third-party sites. The token is now exposed to anyone with log access.

**Defense:** never put JWTs in URLs. Always in `Authorization: Bearer <token>` header or in `HttpOnly` cookies.

## Storage on the client

Where you store a JWT determines what attacks reach it:

- **`localStorage`** — readable by any JavaScript on the same origin. Susceptible to [XSS](/wiki/cross-site-scripting) credential theft.
- **`HttpOnly` cookie** — not readable by JavaScript; protected from XSS but susceptible to [CSRF](/wiki/csrf). Mitigation: `SameSite=Lax` + CSRF tokens.
- **In memory only** (e.g. JavaScript variable cleared on tab close) — survives XSS poorly (script reads memory) but limits exposure to the page lifetime.

Industry consensus has shifted toward `HttpOnly` cookies + CSRF tokens + `SameSite=Lax` as the safer default.

## Further reading

- [RFC 7519 (JWT specification)](https://datatracker.ietf.org/doc/html/rfc7519).
- [jwt.io](https://jwt.io/) — interactive decoder. Useful, but never paste production tokens.
- [PortSwigger Web Security Academy: JWT attacks](https://portswigger.net/web-security/jwt).
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html).
