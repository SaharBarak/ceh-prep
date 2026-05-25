---
title: Zero Trust
slug: zero-trust
category: defenses
summary: Zero Trust is a security architecture model that removes implicit trust from the network — every request to a resource must be authenticated, authorized, and continuously verified, regardless of whether the requester is "inside" the corporate network. It is the modern replacement for perimeter-based security.
related: [active-directory, principle-of-least-privilege, defense-in-depth, jwt, oauth-2]
aliases: [Zero Trust Architecture, ZTA, Zero Trust Network Access, ZTNA, BeyondCorp]
updated: 2026-05-25
---

**Zero Trust** is a security architecture model where no request is trusted by default — every access to a resource must be authenticated, authorized, and continuously verified, regardless of where the request originates. It replaces the older "castle and moat" model where the corporate VPN created an implicit trust boundary inside which traffic flowed freely.

The model was popularized by Google's **BeyondCorp** initiative (published 2014) after the Aurora attacks of 2010 demonstrated that one compromised endpoint inside the corporate network defeated the perimeter entirely. NIST formalized the concepts in **SP 800-207 (2020)**, which is the canonical reference for the term.

## The core thesis

Three propositions:

1. **Network location implies no trust.** A request from inside the office and a request from a coffee-shop Wi-Fi are evaluated the same way.
2. **Every request is authenticated and authorized.** No "I already proved who I was, let me through unchallenged" — even within a session, ongoing access checks happen.
3. **Access is least-privilege by default.** A user gets only the specific resources their role requires, not "all of `\\fileserver\share`."

The implementation slogan: **"Never trust, always verify."**

## The reference architecture (NIST SP 800-207)

```
                          ┌─────────────────────────────┐
user/device ──request──►  │  Policy Enforcement Point   │ ──verified request──► resource
                          │           (PEP)             │
                          └─────────────────────────────┘
                                       │
                                       ▼
                          ┌─────────────────────────────┐
                          │   Policy Decision Point     │
                          │           (PDP)             │
                          │   ┌────────┐  ┌──────────┐  │
                          │   │ Policy │  │ Trust    │  │
                          │   │ Engine │  │ Algo     │  │
                          │   └────────┘  └──────────┘  │
                          └─────────────────────────────┘
                                       │
                          inputs: identity, device posture,
                                  threat intel, user behavior,
                                  resource sensitivity, time of day
```

- **PEP** — the gate every request flows through. Implementations: identity-aware proxy, sidecar, service mesh.
- **PDP** — evaluates "should this request be allowed?" against a policy engine that consumes signals from many sources.
- **Trust algorithm** — the function that turns identity + device posture + context into an allow/deny decision.

## What changes in practice

| Old (perimeter) | Zero Trust |
|---|---|
| VPN gives broad network access | Per-application access broker (ZTNA gateway) |
| Trust = inside the firewall | Trust = recent authentication + device posture + resource policy |
| Authentication once, at login | Continuous re-evaluation — MFA challenges step up on risk |
| Flat internal network | Microsegmentation — each workload's network access is scoped |
| Long-lived service accounts | Short-lived [JWT](/wiki/jwt) tokens, workload identity (SPIFFE) |
| Domain-joined PCs implicitly trusted | Device posture (patch level, EDR present, disk encrypted) checked per request |

## The building blocks

A real Zero Trust deployment integrates several products:

- **Identity provider (IdP)** — [Active Directory](/wiki/active-directory) / Entra ID / Okta / Auth0 — authoritative source of users and groups.
- **MFA** — phishing-resistant by preference (FIDO2 / Passkeys); push-prompt MFA accepted as table-stakes.
- **Single Sign-On (SSO)** — [OAuth 2.0](/wiki/oauth-2) / [SAML](/wiki/saml) / [OpenID Connect](/wiki/openid-connect) to federate access to every app from the IdP.
- **Device management (MDM)** — Intune, Jamf, Workspace ONE — enforce posture (FileVault on, EDR running, OS patched).
- **Identity-aware proxy / ZTNA gateway** — Cloudflare Access, Zscaler Private Access, Tailscale, AWS Verified Access, Google IAP — the PEP for app access.
- **Service mesh** — Istio, Linkerd — workload-to-workload mTLS and authorization within the cluster.
- **Microsegmentation** — Illumio, Cisco Tetration, native cloud security groups — workload-level network policy.

## Common pitfalls

| Pitfall | Effect |
|---|---|
| **"We bought ZTNA, we're Zero Trust now"** | The product is a building block. Without policy work and device posture, it's a fancy VPN. |
| **Static permissions tied to AD groups forever** | Defeats least-privilege; one over-broad group leaks. Use just-in-time access (PIM) for sensitive groups. |
| **Trust the device on login, never re-check** | An infected laptop that posture-checked clean at 9am can be compromised by noon. Continuous evaluation required. |
| **Service accounts exempted from MFA** | Service-to-service auth bypasses ZT. Use workload identity (SPIFFE / managed identity / OIDC tokens) instead. |
| **No backup access path** | When the IdP outage hits, business stops. Plan a documented break-glass. |

## How Zero Trust intersects related concepts

- **[Principle of Least Privilege](/wiki/principle-of-least-privilege)** — Zero Trust is the architectural pattern; PoLP is the policy stance the architecture enforces.
- **[Defense in Depth](/wiki/defense-in-depth)** — Zero Trust does not replace layered defenses; it complements them. EDR + WAF + ZT all stack.
- **[Active Directory](/wiki/active-directory)** — most Zero Trust deployments still keep AD as the identity source; the network-trust boundary moves to the IdP layer.

## Maturity models

Common references:

- **CISA Zero Trust Maturity Model** — 5 pillars (Identity, Devices, Networks, Applications & Workloads, Data) × 4 maturity stages (Traditional, Initial, Advanced, Optimal).
- **DOD Zero Trust Reference Architecture** — defense-industry-targeted version of the same idea.
- **Forrester ZTX** — the original Zero Trust eXtended framework.

## Further reading

- [NIST SP 800-207 — Zero Trust Architecture](https://csrc.nist.gov/publications/detail/sp/800-207/final).
- [Google BeyondCorp papers](https://www.beyondcorp.com/).
- [CISA Zero Trust Maturity Model v2](https://www.cisa.gov/zero-trust-maturity-model).
- [DOD Zero Trust Strategy](https://dodcio.defense.gov/Library/).
