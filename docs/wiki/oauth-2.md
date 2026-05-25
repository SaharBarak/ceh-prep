---
title: OAuth 2.0
slug: oauth-2
category: protocols
summary: OAuth 2.0 is an authorization framework that lets a third-party application obtain limited access to a user's account on a service, without ever seeing the user's password. It is the de-facto standard for "Sign in with Google / GitHub / etc." flows and underpins most modern API authorization.
related: [openid-connect, jwt, saml, tls, csrf]
aliases: [OAuth, OAuth2, RFC 6749]
updated: 2026-05-25
---

**OAuth 2.0** is an authorization framework (RFC 6749) that lets a third-party application obtain limited access to a user's account on another service, without that application ever seeing the user's password. The flow involves a *resource owner* (the user), a *client* (the third-party app), an *authorization server* (the identity provider), and a *resource server* (the API holding the data). Instead of sharing credentials, the user grants the client a scoped *access token*.

OAuth 2.0 is the de-facto standard for "Sign in with Google / GitHub / Apple / Microsoft" flows, and underpins most modern API authorization. It is *not* an authentication protocol — that's what [OpenID Connect](/wiki/openid-connect) (OIDC), built on top of OAuth, is for.

## The flow that matters — Authorization Code with PKCE

Of OAuth 2.0's multiple grant types, the one that should be used today is **Authorization Code with PKCE** (Proof Key for Code Exchange):

1. **User clicks "Sign in with Google"** in the client app.
2. Client redirects the browser to Google's `/authorize` endpoint with: client ID, requested scopes, redirect URI, a random `code_challenge` (the PKCE bit).
3. **User authenticates with Google** + consents to the scopes.
4. Google redirects back to the client's `redirect_uri` with a short-lived `authorization code`.
5. Client's backend exchanges the code (plus the original `code_verifier` for PKCE) for an `access_token` (and optionally a `refresh_token`).
6. Client uses the access token to call the resource server's APIs.

PKCE defeats authorization code interception attacks where a malicious app on the same device might intercept the redirect. It started as a mobile-only protection and is now mandated for all client types in OAuth 2.1.

## Deprecated flows you might still see

- **Implicit flow** — the access token came back in the URL fragment instead of via a code exchange. Vulnerable to token theft via browser history, server logs, and referrer leakage. Deprecated; modern apps must not use it.
- **Resource Owner Password Credentials** — the client collects the user's password and sends it to the auth server. Defeats the entire point of OAuth. Deprecated.
- **Implicit + ROPC** are both removed in OAuth 2.1.

## Scopes

A scope is a string-keyed permission. `read:user`, `repo`, `email`, `https://www.googleapis.com/auth/drive.readonly`. The auth server attaches granted scopes to the access token. The resource server enforces them.

Scopes are NOT a security boundary by themselves — if the access token is leaked, the attacker has every scope it carries. They're a *least-privilege* mechanism: a calendar app should request only `calendar.events`, not `mail`.

## Common attacks

### `redirect_uri` manipulation

An attacker registers a malicious client app with a similar name and a redirect URI on a domain they control. They trick the user into authenticating; the auth code comes back to them.

Defense: auth servers must require *exact* registration of `redirect_uri` (no wildcards, no subdomain wildcards) and refuse mismatches.

### Authorization code interception

Without PKCE, an attacker who can read the redirect URL (via a malicious app sharing the URL scheme on mobile, or a referer leak) can exchange the code for a token. PKCE binds the code to a per-session secret that only the legitimate client knows.

### Token leakage

Access tokens are bearer credentials — whoever holds one can use it until it expires. Common leak sources:

- Logged in server-side request logs.
- Cached in browser history (when in a URL).
- Exposed via [XSS](/wiki/cross-site-scripting) when stored in `localStorage`.

Defense: short token lifetimes (15-60 minutes), refresh tokens stored more carefully, `HttpOnly` cookies, no tokens in URLs.

### State parameter omitted ([CSRF](/wiki/csrf) on the callback)

OAuth's `state` parameter is a CSRF token for the authorization flow. The client generates a random value, includes it in the `/authorize` request, and verifies it on the callback. Without `state`, an attacker can trick the user's browser into completing the flow with the *attacker's* code, linking the user's account to the attacker's third-party identity.

Every OAuth client must verify `state` matches.

### Open redirect chains

If the client's `redirect_uri` accepts user-controlled query parameters and forwards them as a redirect, an attacker can chain that into a token leak. Defense: validate `redirect_uri` exact-match against the registered list; never reflect user data into a redirect.

## Tokens

OAuth 2.0 deliberately doesn't specify the access token format. In practice:

- **Opaque random strings** — the resource server validates them by introspection against the auth server. Privacy-preserving (the client never sees the user's actual identity).
- **JWT** ([see JWT](/wiki/jwt)) — self-contained, validated locally by the resource server using the auth server's public key. Faster (no introspection round-trip) but harder to revoke.

Most modern auth servers (Auth0, Okta, AWS Cognito, Keycloak) issue JWT access tokens by default.

## OAuth 2.1 — the consolidation

OAuth 2.1 (still in draft as of 2026) consolidates the 13+ years of OAuth 2.0 extensions and best-practice guidance into a single specification:

- Authorization Code with PKCE is the *only* flow for confidential and public clients.
- Implicit and ROPC are removed.
- Exact-match `redirect_uri` is mandatory.
- Refresh tokens are sender-constrained (each refresh rotates the token).

For new implementations: target OAuth 2.1 from day one; avoid the deprecated flows even though many libraries still support them.

## Further reading

- [RFC 6749 — The OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749).
- [OAuth 2.0 Security Best Current Practice (RFC 8252 + RFC 8628 + ongoing IETF drafts)](https://datatracker.ietf.org/doc/draft-ietf-oauth-security-topics/).
- [OAuth 2.1 draft](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/).
- [PortSwigger Web Security Academy: OAuth 2.0](https://portswigger.net/web-security/oauth) — interactive labs.
