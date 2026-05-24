---
title: Transport Layer Security
slug: tls
category: protocols
summary: Transport Layer Security (TLS) is the cryptographic protocol that secures most communication on the internet, including HTTPS. It authenticates servers (and optionally clients) and encrypts the channel between them, defending against eavesdropping and tampering.
related: [jwt, tls-handshake]
aliases: [TLS, SSL, HTTPS, SSL/TLS]
updated: 2026-05-24
---

**Transport Layer Security** (TLS) is the cryptographic protocol that secures most communication on the internet. TLS authenticates the server (and optionally the client), establishes a shared symmetric key, and encrypts the resulting channel — defending against eavesdropping, tampering, and impersonation. TLS is the security layer underneath HTTPS, SMTPS, IMAPS, and most modern application-protocol-over-TCP traffic.

TLS is the successor to **SSL** (Secure Sockets Layer). The two terms are still used interchangeably in casual conversation, but every actively-used version today is TLS — SSL 3.0 and earlier are deprecated and vulnerable.

## Version timeline

| Version | Year | Status |
|---|---|---|
| SSL 1.0 | (never released) | — |
| SSL 2.0 | 1995 | Deprecated. Vulnerable. |
| SSL 3.0 | 1996 | Deprecated. POODLE-vulnerable. |
| TLS 1.0 | 1999 | Deprecated. BEAST-vulnerable. |
| TLS 1.1 | 2006 | Deprecated. |
| **TLS 1.2** | 2008 | Active. Still used; ~30% of traffic. |
| **TLS 1.3** | 2018 | Active. Default for modern browsers; ~70% of traffic. |

Modern hardening: disable TLS 1.0 and 1.1; allow only TLS 1.2 and TLS 1.3. Most PCI-DSS-compliant environments did this in 2018-2020.

## What TLS 1.3 changed

TLS 1.3 was a major redesign of the protocol. Key changes from TLS 1.2:

- **Removed insecure primitives.** No more RC4, no more 3DES, no more SHA-1, no more MD5, no more static-RSA key exchange, no more CBC modes that needed careful padding. The cipher suite list shrank from hundreds in 1.2 to five in 1.3.
- **Forward secrecy is enforced.** Every TLS 1.3 handshake uses an ephemeral (EC)DHE key exchange. Even if the server's long-term key is later compromised, captured past traffic can't be decrypted.
- **1-RTT handshake by default** (one round trip). TLS 1.2 needed two. **0-RTT** is supported for resumed connections — at the cost of replay-attack risk for those early-data requests.
- **Encrypted handshake** (after the initial ServerHello). The bulk of the handshake is encrypted, which limits what eavesdroppers can learn about the connection.

## The handshake (TLS 1.3)

A simplified flow:

```
Client                                Server
─────                                 ─────
ClientHello       ─────────────→
                                      ServerHello
                                      EncryptedExtensions
                                      Certificate
                                      CertificateVerify
                                      Finished
                  ←─────────────
Finished          ─────────────→
                                      [Application data flows]
```

The client opens with a `ClientHello` that includes its supported cipher suites, a random nonce, and an (EC)DHE key share. The server picks one cipher, sends its own (EC)DHE key share, its certificate, a signature over the handshake, and `Finished`. The client verifies the certificate, derives the shared key from the two key shares, and sends `Finished`. Application data flows.

## Certificate validation

Server authentication works through the **public key infrastructure** (PKI). The server presents an X.509 certificate signed by a Certificate Authority (CA) the client already trusts.

The chain that has to hold:

1. The certificate's `Subject Alternative Name` (SAN) field matches the hostname the client connected to.
2. The certificate's signature was made by a CA whose certificate is in the client's trust store.
3. The CA's own certificate, if not root, chains up to a root CA in the trust store.
4. The certificate has not expired.
5. The certificate has not been revoked (OCSP / OCSP stapling / CRL).

A single broken link in that chain produces a TLS handshake failure (the browser's "Your connection is not private" page).

## Common attacks and weaknesses

- **MITM via untrusted CA.** Corporate proxies that inspect TLS traffic install their own root CA on managed devices. Same primitive, used hostilely, is how nation-state TLS interception works.
- **Downgrade attacks.** A network attacker tries to force the connection to a weaker version (TLS 1.0, SSL 3.0) where exploits exist. Modern clients refuse to downgrade below their minimum supported version.
- **Heartbleed (CVE-2014-0160).** A buffer-overread in OpenSSL's TLS heartbeat extension that leaked server memory. Devastating because it exposed long-term private keys. Patched in days; the affected OpenSSL versions need to be retired everywhere.
- **POODLE / BEAST / CRIME / BREACH / Lucky 13.** Historical TLS 1.0/1.1 attacks against specific CBC-mode constructions. TLS 1.2 mitigations exist; TLS 1.3 eliminates the surface entirely.
- **Weak ciphers.** Using a deprecated cipher suite (RC4, 3DES, CBC modes with short keys) when TLS 1.2 is negotiated. Modern best practice: AES-GCM or ChaCha20-Poly1305 only.

## mTLS — mutual TLS

Most TLS deployments authenticate only the server; the client is authenticated at a higher layer (passwords, OAuth, [JWT](/wiki/jwt)). **mTLS** (mutual TLS) authenticates both sides at the TLS layer — the client presents its own certificate.

Common use cases:

- **Service-to-service auth** in zero-trust microservice architectures (Istio, Linkerd, AWS App Mesh).
- **API access** for highly-regulated industries (banking, healthcare).
- **VPN replacements** like Cloudflare Access, Tailscale.

mTLS removes the "shared secret" problem of API keys — there's nothing to leak; the client's private key never leaves it.

## Inspecting TLS traffic

Working tools for TLS inspection (with appropriate authorization):

- **Wireshark** — packet-level. Decode TLS handshakes; with the server's private key (RSA cipher suites only) or pre-master secrets logged via `SSLKEYLOGFILE`, decrypt the full session.
- **mitmproxy** — application-level. Install mitmproxy's CA cert on the client; mitmproxy decrypts and re-encrypts on the fly.
- **Burp Suite** ([Burp Suite](/wiki/burp-suite)) — same model as mitmproxy, focused on HTTP.

## Hardening

For a modern web server:

- Disable SSL 2.0, SSL 3.0, TLS 1.0, TLS 1.1.
- Prefer TLS 1.3; allow TLS 1.2 as fallback only.
- Allow only AEAD ciphers (AES-GCM, ChaCha20-Poly1305).
- Use HSTS (`Strict-Transport-Security`) to prevent downgrade-to-HTTP.
- Use OCSP stapling for fast revocation checking.
- Renew certificates with adequate margin. Free auto-renewing certs via Let's Encrypt + ACME (`certbot`).

[SSL Labs' Server Test](https://www.ssllabs.com/ssltest/) grades a server's TLS configuration end-to-end.

## Further reading

- [RFC 8446 (TLS 1.3)](https://datatracker.ietf.org/doc/html/rfc8446).
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/) — copy-paste configs for nginx, Apache, HAProxy, etc.
- [Let's Encrypt](https://letsencrypt.org/) — free, automated, trusted certificates.
- [The Illustrated TLS 1.3 Connection](https://tls13.xargs.org/) — byte-by-byte walkthrough.
