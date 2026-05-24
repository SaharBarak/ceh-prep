---
title: Kerberos
slug: kerberos
category: protocols
summary: Kerberos is a network authentication protocol that uses tickets — short-lived cryptographic tokens — to let users prove their identity to services without sending a password over the wire. It is the primary authentication protocol for Microsoft Active Directory.
related: [active-directory, ntlm, pass-the-hash]
aliases: [Kerberos Protocol, MIT Kerberos]
updated: 2026-05-24
---

**Kerberos** is a network authentication protocol where a trusted third party — the Key Distribution Center (KDC) — vouches for users to services using time-limited tickets. The protocol replaces password-based authentication with ticket-based authentication, eliminating the need for services to handle user passwords and making credential replay much harder.

Kerberos is the default authentication protocol in [Microsoft Active Directory](/wiki/active-directory). On any modern Windows domain, almost every login, file access, and service request is mediated by Kerberos tickets.

## The three roles

| Role | What it does |
|---|---|
| **Client** | The user (or service) requesting authentication. |
| **KDC** | Key Distribution Center — splits into the Authentication Service (AS) and Ticket Granting Service (TGS). Stores all principals' long-term keys. |
| **Service** | The resource the client wants to access (file server, mail server, application). Has its own long-term key. |

In AD, every Domain Controller runs a KDC. The long-term key of a user is derived from their password; the long-term key of a service is the password hash of the account that runs it.

## The protocol in three rounds

1. **AS-REQ / AS-REP** — Client sends an Authentication Service Request. KDC responds with a *Ticket Granting Ticket* (TGT) encrypted with the user's key. Only someone who knows the user's password can decrypt it.

2. **TGS-REQ / TGS-REP** — Client presents the TGT to the KDC and requests a service ticket for a specific service (identified by its Service Principal Name, SPN). KDC returns a *service ticket* encrypted with the service's key.

3. **AP-REQ** — Client presents the service ticket to the service. The service decrypts it with its own key. The ticket contains the user's identity and group memberships (in the PAC, Privilege Attribute Certificate). The service trusts the ticket because only the KDC could have created it.

The user's password never leaves their machine; the user's long-term key never leaves the KDC. The service never holds any user-specific secret.

## What "kerberoasting" actually attacks

Kerberos's beauty is also its biggest offensive surface in AD. Any authenticated user can request a service ticket (TGS) for any service. The TGS is encrypted with the *service account's* password-derived key.

The attacker:

1. Requests TGS for a service running as a domain account (e.g. SQL Server's service account).
2. Captures the encrypted ticket.
3. Brute-forces the encryption key *offline* against a wordlist. The KDC doesn't know this happened — the attack is silent.

If the service account has a weak password, the attacker recovers it without ever touching the service. Service accounts are notorious for weak passwords because they're typically set once and forgotten. This is **Kerberoasting**.

Hashcat mode `13100` cracks Kerberos 5 TGS-REP hashes. Tools: `GetUserSPNs.py` (Impacket) or `Rubeus.exe kerberoast`.

## AS-REP roasting

A second offensive technique: accounts with `Do not require Kerberos preauthentication` set will receive a TGT *without* sending an authenticated AS-REQ. The TGT is encrypted with the user's key — which the attacker can then crack offline.

This is rare on modern AD but common on environments older than 5 years. `GetNPUsers.py` enumerates roastable accounts; hashcat mode `18200` cracks the resulting hashes.

## Golden Ticket

The KDC's identity is bound to a special account called `KRBTGT`. If an attacker obtains the KRBTGT password hash (typically via DCSync after Domain Admin compromise), they can forge TGTs for any user — including non-existent users — with any group membership. This is a **Golden Ticket**.

Golden tickets are detection-resistant because the KDC doesn't issue them — the attacker forges them locally. The only reliable defense is to *rotate* the KRBTGT password twice (twice, to invalidate even cached tickets), an expensive operation that requires downtime.

## Common terms

| Term | Meaning |
|---|---|
| **TGT** | Ticket Granting Ticket — the user's "I have authenticated" token. |
| **TGS** | Ticket Granting Service — the service that issues service tickets. (Also: TGS, the ticket itself.) |
| **SPN** | Service Principal Name — `<service>/<host>` identifier for a ticket target. |
| **PAC** | Privilege Attribute Certificate — group-membership data baked into a ticket. |
| **S4U2Self / S4U2Proxy** | Constrained delegation primitives — a service requests a ticket on behalf of another user. |
| **DCSync** | An attacker with replication rights pulls password hashes from a DC by impersonating another DC. |

## Mitigation

- **Strong passwords on service accounts.** A 30-character random password is computationally infeasible to crack from a TGS hash.
- **gMSA / dMSA (Group Managed Service Accounts).** AD-managed service-account passwords that rotate automatically. Removes the "service account password is `Welcome1`" problem entirely.
- **Detect roasting via Event ID 4769.** Unusual TGS request volumes from one principal — especially encryption-type 23 (RC4-HMAC) — are the canonical kerberoast signature.
- **Audit pre-auth-disabled accounts.** `Get-ADUser -Filter {DoesNotRequirePreAuth -eq $True}`. There should be zero.

## Further reading

- [MIT Kerberos documentation](https://web.mit.edu/kerberos/krb5-latest/doc/) — the canonical RFC-level reference.
- [SpecterOps "Roasting AS-REPs"](https://blog.harmj0y.net/activedirectory/roasting-as-reps/) — Will Schroeder's original write-up.
- [Microsoft: How the Kerberos Version 5 Authentication Protocol Works](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-kile/2a32282e-dd48-4ad9-a542-609804b02cc9).
