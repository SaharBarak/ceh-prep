---
title: SAML
slug: saml
category: protocols
summary: SAML (Security Assertion Markup Language) is an XML-based standard for exchanging authentication and authorization data between an identity provider and a service provider. It remains the dominant federated-SSO protocol in enterprise B2B environments despite OIDC's growing share.
related: [oauth-2, openid-connect, tls, jwt]
aliases: [SAML 2.0, Security Assertion Markup Language]
updated: 2026-05-25
---

**SAML** (Security Assertion Markup Language) is an XML-based open standard for exchanging authentication and authorization data between an *identity provider* (IdP) and a *service provider* (SP). SAML 2.0 (ratified in 2005) is the dominant federated-SSO protocol in enterprise B2B environments — the protocol most large-enterprise "SSO into our SaaS app" integrations actually use.

[OIDC](/wiki/openid-connect) is the modern alternative for new web/mobile applications. SAML's footprint is enterprise/legacy: Okta, Active Directory Federation Services, Ping Identity, OneLogin, and most enterprise IdPs implement both protocols, with SAML preferred by the buyer side because that's what their existing identity infrastructure speaks.

## The flow

SAML SP-initiated flow (the common case):

1. **User visits the service provider's URL** (e.g. `salesforce.com/loginto/acme`).
2. SP redirects the browser to the IdP's SSO endpoint with a **SAML AuthnRequest** — an XML document describing what the SP wants.
3. **User authenticates with the IdP** (or has a valid IdP session already).
4. IdP redirects back to the SP's Assertion Consumer Service (ACS) with a **SAML Response** in a form POST body.
5. SP validates the SAML Response's signature, extracts the user's identity (and any included attributes), and logs them in.

The SAML Response is an XML document signed by the IdP. Critical structure:

```xml
<saml:Response ...>
  <saml:Issuer>https://idp.example/saml/idp</saml:Issuer>
  <ds:Signature>...</ds:Signature>
  <saml:Assertion>
    <saml:Subject>
      <saml:NameID>alice@example.com</saml:NameID>
    </saml:Subject>
    <saml:Conditions NotBefore="..." NotOnOrAfter="..." />
    <saml:AttributeStatement>
      <saml:Attribute Name="groups">
        <saml:AttributeValue>admins</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</saml:Response>
```

The SP trusts the assertion because of the digital signature on it — only the IdP's private key could have produced that signature.

## Common attacks

### Signature wrapping (XSW)

Multiple variants. The general shape: the attacker takes a legitimately-signed SAML assertion and wraps it inside a manipulated XML document such that the SP's XML parser reads the *attacker's* injected claims (e.g. group memberships) while the signature validator validates the *original* assertion. The two see different views of the same document.

The defense: validate that the signed element is the one whose data the application actually uses. Modern SAML libraries do this correctly; legacy hand-rolled XML parsing is the bug. The 2024 GitHub Enterprise SAML CVE (CVE-2024-9487) was an XSW variant.

### Missing signature validation

A staggering number of bugs across the SAML deployment world have been "the SP didn't actually validate the signature." A response is well-formed XML so the SP code reads the assertion, extracts the claims, logs the user in. Then the security review notices the verification step is missing or returns true on parse failure.

Defense: validate the signature first, with strict failure on any error. Reject responses with no signature.

### Replay attacks

A captured SAML response can be replayed against the SP within its validity window. Defense: SAML's `Conditions/NotOnOrAfter` provides an expiration; the SP must enforce it. Additionally, the `InResponseTo` attribute should match a request the SP recently sent.

### Unsigned assertions inside signed responses

A response can be signed without the assertion inside being signed (or vice versa). The defense: validate the signature on whichever element you trust. Most SAML libraries default to signing the assertion; some configurations sign only the response. Match your verification to your signing policy.

## SP-initiated vs IdP-initiated

- **SP-initiated** (the flow described above) is the safer default. The SP issues a tracked AuthnRequest and verifies the response's `InResponseTo`.
- **IdP-initiated** — the user starts at the IdP's app catalog ("here are your SaaS apps"), clicks one, and is sent to the SP with an unsolicited SAML response. There's no `InResponseTo` to verify because there was no request.

IdP-initiated is more user-friendly but more vulnerable to XSRF-style attacks. Many SPs disable it entirely.

## SAML vs OIDC

| | SAML | [OIDC](/wiki/openid-connect) |
|---|---|---|
| Wire format | XML | JSON + [JWT](/wiki/jwt) |
| Mobile support | Painful | Native |
| Spec age | 2005 | 2014 |
| Token validation complexity | High (XML signature) | Low (JWT signature) |
| Enterprise B2B | Dominant | Growing |
| Greenfield consumer / mobile | Rare | Standard |

For new integrations between cloud services: OIDC. For integrating with an enterprise IdP that only speaks SAML: SAML. Most modern IdPs speak both.

## Tools

- **SAML-tracer (browser extension)** — captures and decodes SAML exchanges in the browser. Essential for debugging.
- **Burp Suite SAML extensions** — for active penetration testing of SAML flows.
- **OneLogin's SAML libraries (Python, PHP, Ruby, Go, Java)** — the canonical reference implementations.

## Further reading

- [OASIS SAML 2.0 specification](https://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf).
- [SAML technical overview (OASIS)](https://docs.oasis-open.org/security/saml/Post2.0/sstc-saml-tech-overview-2.0.html).
- [Duo Labs SAML guides](https://duo.com/blog/the-beer-drinkers-guide-to-saml).
- [SAML Raider (Burp extension)](https://github.com/CompassSecurity/SAMLRaider).
