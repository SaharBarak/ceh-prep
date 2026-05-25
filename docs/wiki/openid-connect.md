---
title: OpenID Connect
slug: openid-connect
category: protocols
summary: OpenID Connect (OIDC) is an authentication layer built on top of OAuth 2.0. Where OAuth grants access to APIs, OIDC additionally tells the client *who the user is* — making OIDC the standard for "Sign in with X" identity flows.
related: [oauth-2, jwt, saml, tls]
aliases: [OIDC, OpenID, OpenID Connect 1.0]
updated: 2026-05-25
---

**OpenID Connect** (OIDC) is an authentication layer built on top of [OAuth 2.0](/wiki/oauth-2). OAuth 2.0 grants access to APIs but doesn't tell the client *who* the user is. OIDC fills that gap by adding an **`id_token`** — a [JWT](/wiki/jwt) containing the user's identity claims — alongside the OAuth access token.

OIDC is what powers most "Sign in with Google / Microsoft / Apple" flows that you see across the web. The user authenticates once at the identity provider; downstream applications consume the resulting `id_token` to know who they're talking to.

## OIDC vs OAuth 2.0

| Concern | OAuth 2.0 | OIDC |
|---|---|---|
| Question answered | "What can this client do?" | "Who is the user?" |
| Primary output | `access_token` for APIs | `id_token` (JWT) describing the user |
| Identity guarantee | None (the user is implicit) | Cryptographically signed claims about the user |
| Use case | API authorization (read calendar, post on behalf of) | Login / SSO |

OIDC reuses OAuth's flows — Authorization Code with PKCE is the canonical one for OIDC just as for OAuth. The OIDC additions:

- A new scope, `openid`, that triggers issuance of the `id_token`.
- A `userinfo` endpoint that returns claims about the authenticated user given a valid access token.
- Discovery via `/.well-known/openid-configuration` — every OIDC provider publishes its endpoints and signing keys at a predictable URL.

## The `id_token`

The `id_token` is a [JWT](/wiki/jwt) with standard claims defined by OIDC:

| Claim | Purpose |
|---|---|
| `iss` | Issuer — the OIDC provider's URL. |
| `sub` | Subject — the unique stable user identifier inside the provider. |
| `aud` | Audience — the client ID the token was issued *for*. |
| `exp` | Expiration timestamp. |
| `iat` | Issued at. |
| `nonce` | Echo of the client's per-request nonce (prevents replay). |
| `email`, `name`, `picture`, `email_verified`, `locale`, etc. | Profile claims, gated by scopes (`email`, `profile`). |

A receiving application validates the JWT signature against the issuer's published JWK set (fetched from `/.well-known/jwks.json`), verifies `iss`, `aud`, `exp`, and `nonce`, and then trusts the user-identity claims.

## Common attacks specific to OIDC

OIDC inherits all OAuth 2.0 attack classes ([redirect_uri manipulation](/wiki/oauth-2), [CSRF](/wiki/csrf) via missing `state`, token leakage). It adds two OIDC-specific concerns:

### `nonce` not validated

OIDC's `nonce` is a per-request value the client generates, includes in the `/authorize` request, and verifies inside the returned `id_token`. Missing the verification step allows replay of a captured `id_token`. The client must enforce `nonce` matching, not just receive it.

### `aud` confusion

An `id_token` issued for client A and accepted by client B is dangerous: client B trusts identity claims that weren't intended for it. Every client must verify the token's `aud` claim matches its own client ID.

This is a common bug in code that "just decodes the JWT" without checking the audience — particularly in libraries that don't enforce `aud` validation by default.

### Algorithm confusion (HS256 vs RS256)

Same attack surface as in [JWT](/wiki/jwt) — if the verifier accepts the algorithm from the token's header without checking, an attacker can forge tokens. OIDC providers should publish only their RS256/ES256 public key; clients must enforce the expected algorithm explicitly.

## Discovery and the JWKS

The single defining productivity feature of OIDC is **discovery**: every provider publishes its configuration at `https://provider.example/.well-known/openid-configuration`. The discovery document contains:

```json
{
  "issuer": "https://accounts.example.com",
  "authorization_endpoint": "https://accounts.example.com/o/oauth2/v2/auth",
  "token_endpoint": "https://accounts.example.com/o/oauth2/token",
  "userinfo_endpoint": "https://accounts.example.com/userinfo",
  "jwks_uri": "https://accounts.example.com/jwks.json",
  "response_types_supported": ["code", "id_token", "token id_token"],
  "id_token_signing_alg_values_supported": ["RS256"],
  ...
}
```

Clients fetch this once at startup (and re-fetch periodically for key rotation), then route OAuth/OIDC requests to the listed endpoints. No hardcoding of vendor-specific URLs.

The `jwks_uri` points at the provider's signing keys — a JSON Web Key Set (JWKS). When verifying a token, the client matches the token's `kid` (key ID) header against the JWKS and uses that key.

## SSO via OIDC

A typical enterprise SSO setup:

1. The company's IdP (Okta, Auth0, Azure AD, Google Workspace, Keycloak) is an OIDC provider.
2. Every internal application is an OIDC client, configured with its own client ID + redirect URI.
3. Users authenticate once at the IdP. The browser holds an IdP session cookie.
4. When the user visits any internal app, that app redirects to the IdP's `/authorize`. Because the user has an active IdP session, no password prompt — the IdP issues the auth code immediately.
5. The app exchanges code for `id_token` and `access_token`.

This is what "Single Sign-On" actually means at the protocol level on modern stacks. [SAML](/wiki/saml) achieves the same thing with a different (older, XML-based) wire format.

## OIDC vs SAML — quick comparison

| | OIDC | [SAML](/wiki/saml) |
|---|---|---|
| Wire format | JSON + JWT | XML |
| Year introduced | 2014 | 2005 |
| Mobile / SPA support | Native | Painful |
| Enterprise B2B SSO | Growing | Dominant (legacy) |
| Discovery | `/.well-known/openid-configuration` | Per-provider metadata XML |

For new applications: OIDC. For integrating with legacy enterprise identity providers that don't speak OIDC: SAML.

## Further reading

- [OpenID Connect Core 1.0 (the spec)](https://openid.net/specs/openid-connect-core-1_0.html).
- [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html).
- [PortSwigger Web Security Academy: OAuth and OpenID](https://portswigger.net/web-security/oauth).
