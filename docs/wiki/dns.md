---
title: DNS
slug: dns
category: protocols
summary: The Domain Name System (DNS) translates human-readable hostnames into the IP addresses computers route packets to. Nearly every internet interaction begins with a DNS query, which makes DNS one of the most valuable surfaces for both attackers (data exfiltration, C2 channels) and defenders (detection, sinkholing).
related: [tls, phishing, ransomware, siem, mitre-attck]
aliases: [Domain Name System, DNS Protocol, DNS Resolution]
updated: 2026-05-25
---

The **Domain Name System** (DNS) is the distributed naming system that translates human-readable hostnames (`example.com`) into the IP addresses (`93.184.216.34`) computers actually route packets to. Defined by RFCs 1034 and 1035 (1987), DNS is the protocol nearly every other internet interaction begins with — which makes it disproportionately valuable both as an attack surface and as a detection surface.

DNS queries traditionally travel unencrypted over UDP port 53, which means *every device on the path* sees which domains a host is looking up. That visibility is the foundation of much of modern threat detection and equally the reason DNS over HTTPS (DoH) is changing the threat-detection landscape.

## How a resolution happens

```
your laptop ──► local resolver ──► root server ──► .com TLD server ──► example.com authoritative ──► IP
                  (recursive)         (".")              (".com")            (NS for example.com)
                       │
                       └─► cached responses returned to subsequent queries within TTL
```

A recursive resolver iteratively walks the DNS hierarchy:

1. Ask a root server "who handles `.com`?" → get NS records for `.com`.
2. Ask a `.com` server "who handles `example.com`?" → get NS records for `example.com`.
3. Ask `example.com`'s authoritative servers "what's the A record for `example.com`?" → get the IP.
4. Return the IP to the client and cache the answer for the TTL.

In practice the local resolver caches aggressively, so most queries resolve from cache in microseconds.

## Common record types

| Record | Purpose |
|---|---|
| **A** | IPv4 address. |
| **AAAA** | IPv6 address. |
| **CNAME** | Alias to another hostname. |
| **MX** | Mail exchange — where email for the domain is delivered. |
| **TXT** | Free-form text. Used for SPF, DKIM, DMARC, domain ownership verification. |
| **NS** | Name servers authoritative for this zone. |
| **SOA** | Start of Authority — zone metadata (primary, contact, serial number, refresh intervals). |
| **PTR** | Reverse DNS — IP-to-hostname. |
| **SRV** | Service records — used by [Active Directory](/wiki/active-directory) ("where is the KDC for this domain?"). |
| **CAA** | Certificate Authority Authorization — which CAs may issue certs for this domain. |

## DNS as an attack surface

| Attack | Mechanism |
|---|---|
| **Cache poisoning (Kaminsky 2008)** | Inject malicious responses into a recursive resolver's cache before the legitimate response arrives. Mitigated by source-port randomization and DNSSEC. |
| **DNS hijacking / NSchanger** | Compromise the resolver settings on a host, router, or domain registrar; redirect all lookups to an attacker-controlled resolver. |
| **Domain registrar compromise** | Take over the domain's NS records; serve any IP for the victim domain. Modern registrar lock + 2FA hardens this. |
| **Subdomain takeover** | Dangling CNAME pointing at a cloud resource the original owner released; an attacker re-claims the resource and inherits subdomain. |
| **DNS amplification DDoS** | Spoof source IP, send small DNS queries, get large responses returned to the victim. |
| **Phishing via lookalike domains** | `examp1e.com`, `exampó.com` (homoglyph), `example-secure-login.com` — defeats human eyeballing. |

## DNS as a detection surface

DNS query logs are some of the most cost-effective detection telemetry available:

- **Domain reputation lookups** — most C2 domains, phishing kits, and malware update servers reside on cheap or newly-registered domains; reputation feeds score them.
- **Newly-registered domain (NRD) detection** — flag queries to domains registered in the last 7-30 days.
- **DGA detection** — Domain Generation Algorithms produce high volumes of queries to algorithmically-generated, non-resolving domains. The pattern stands out in logs.
- **DNS tunneling detection** — exfiltrating data inside DNS queries produces unusually long TXT lookups or high-volume queries to a small set of NS-controlled domains.
- **Beacon detection** — periodic queries to the same domain at regular intervals (300s, 3600s) suggest C2 callbacks.

A [SIEM](/wiki/siem) that ingests recursive-resolver query logs is one of the highest-yield detection sources.

## DoH, DoT, DoQ — encrypting DNS

The historical visibility-of-everything model of DNS is changing:

| Protocol | Transport | Default port | Notes |
|---|---|---|---|
| **DNS-over-HTTPS (DoH)** | HTTPS | 443 | Hidden in normal web traffic; the dominant encryption mode for client OSes. |
| **DNS-over-TLS (DoT)** | TLS | 853 | Distinct port — easier to block at the firewall than DoH. |
| **DNS-over-QUIC (DoQ)** | QUIC | 853 | The newest, used in some mobile contexts. |

Encrypted DNS protects users from on-path eavesdropping (good for privacy) but blinds enterprise resolvers from per-query inspection (bad for detection). The defender's response: force enterprise endpoints to use the corporate resolver via Group Policy / MDM, block public DoH endpoints (Cloudflare 1.1.1.1, Google 8.8.8.8) at the egress firewall, and run [EDR](/wiki/edr) for host-level visibility.

## DNSSEC

DNS Security Extensions (DNSSEC) cryptographically signs DNS records so a recursive resolver can verify that responses are authentic and not forged en route. It defeats cache-poisoning attacks and provides a chain of trust from the root down.

Adoption is partial. Most TLDs are signed; the second-level domain owner has to opt in. Operational cost (key rotation, DS record management) keeps adoption uneven.

## Hosts file

A small but real implementation detail: every OS consults a local `hosts` file before DNS resolution.

- Linux/macOS: `/etc/hosts`
- Windows: `C:\Windows\System32\drivers\etc\hosts`

The hosts file is a frequent target of malware (redirect `bank.example` to attacker IP) and a frequent debugging tool ("force `staging.example.com` to point at `127.0.0.1` for local testing").

## Why DNS appears on so many security questions

DNS sits at the seam between every layer: the network layer needs to resolve names, the application layer requests them, the identity layer relies on SRV records ([Active Directory](/wiki/active-directory) authentication discovers domain controllers via DNS), and the email layer's anti-spam controls (SPF, DKIM, DMARC) all live in DNS TXT records.

A misconfigured DNS record is rarely just a routing problem; it is often the path from one vulnerability into another.

## Further reading

- [RFC 1034 — Domain Names Concepts](https://datatracker.ietf.org/doc/html/rfc1034).
- [RFC 8484 — DNS over HTTPS (DoH)](https://datatracker.ietf.org/doc/html/rfc8484).
- [SANS — DNS as a Defensive Tool](https://www.sans.org/white-papers/).
- [Cloudflare — DNS deep dives](https://blog.cloudflare.com/tag/dns/).
