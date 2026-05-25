---
title: AS-REP Roasting
slug: as-rep-roasting
category: attacks
summary: AS-REP Roasting is an Active Directory attack against user accounts configured with "Do not require Kerberos preauthentication." The attacker requests a TGT for such a user, receives the response encrypted with the user's password-derived key, and cracks it offline.
related: [kerberos, active-directory, kerberoasting, hashcat, ntlm]
aliases: [AS-REP Roast, AS-REP Roasting Attack]
updated: 2026-05-25
---

**AS-REP Roasting** is an [Active Directory](/wiki/active-directory) attack that targets user accounts configured with `DONT_REQUIRE_PREAUTH` — the `UF_DONT_REQUIRE_PREAUTH` flag in `userAccountControl`. For such accounts, an attacker can request a Ticket Granting Ticket (TGT) without authenticating first, receive the response encrypted with the user's password-derived key, and crack it offline.

The attack is to [Kerberoasting](/wiki/kerberoasting) what AS-REQ is to TGS-REQ: same offline-crack pattern, different Kerberos message exchange. AS-REP roasting requires no authentication, just a username list and network access to a Domain Controller.

## What "no preauthentication" actually means

[Kerberos](/wiki/kerberos) preauthentication is a check that the user knows their password *before* the KDC issues a TGT. Without preauth, the KDC returns the TGT to anyone who requests one for a given username. The TGT is encrypted with the user's long-term key (derived from the password) — which means anyone who has the TGT can attempt to derive that key offline.

The `DONT_REQUIRE_PREAUTH` flag exists for legacy compatibility — early Kerberos clients (Unix MIT Kerberos, pre-2000 Windows) didn't support preauth. In 2026, the flag should be set on zero accounts in any modern AD. Reality is that 1-5% of environments still have at least one account with the flag set, usually a forgotten legacy service or test account.

## The attack — three steps

**Step 1: Find AS-REP-roastable users.**

The killer feature of this attack: enumeration requires *no credentials at all*. You only need:

- A username list (LinkedIn scraping + corporate naming convention guess).
- Network access to a Domain Controller on Kerberos port 88.

```bash
# Impacket — unauthenticated enumeration if you have a username file
GetNPUsers.py contoso.local/ -no-pass -usersfile /tmp/users.txt -outputfile /tmp/asrep.hash

# Rubeus — Windows-native, requires authenticated context to enumerate
Rubeus.exe asreproast /nowrap /outfile:asrep.hash
```

`GetNPUsers.py` is the right tool when you don't have credentials. It tests each username in the file; users without preauth required return a hash, users with preauth return a Kerberos error. The unauthenticated path is what makes AS-REP roasting valuable even at the absolute start of an engagement.

**Step 2: Crack offline.**

```bash
# hashcat mode 18200 for Kerberos 5 AS-REP, etype 23 (RC4)
hashcat -m 18200 asrep.hash /usr/share/wordlists/rockyou.txt --rules-file /usr/share/hashcat/rules/best64.rule

# John the Ripper equivalent
john --format=krb5asrep --wordlist=rockyou.txt asrep.hash
```

Weak passwords drop in seconds. Strong passwords are computationally infeasible.

**Step 3: Authenticate.**

Once you have the user's password, you can authenticate to anything as that user — request real TGTs, log in to workstations they have access to, pivot into the network from their identity.

A common chain: AS-REP roast a forgotten test account → use that account's credentials to do an authenticated [LDAP](/wiki/ldap) enumeration → identify [Kerberoasting](/wiki/kerberoasting) targets → roast service accounts → use service-account credentials to find higher-privilege paths via [BloodHound](/wiki/bloodhound) → Domain Admin.

## How to find pre-auth-disabled accounts as a defender

PowerShell against a DC:

```powershell
Get-ADUser -Filter {DoesNotRequirePreAuth -eq $True} -Properties DoesNotRequirePreAuth |
  Select-Object SamAccountName,Enabled,LastLogonDate
```

Or via LDAP filter (`userAccountControl:1.2.840.113556.1.4.803:=4194304`):

```bash
ldapsearch -x -H ldap://dc.contoso.local -D 'user@contoso.local' -w 'password' \
  -b 'dc=contoso,dc=local' \
  '(userAccountControl:1.2.840.113556.1.4.803:=4194304)'
```

There should be zero accounts in the output of either query. If there are, investigate why — and disable the flag unless there's a documented technical reason (there almost never is in 2026).

## Detection

The defender side:

- **Event ID 4768** (Kerberos Authentication Service Granted Ticket Granted) — request volume from a single source against many accounts is the AS-REP-enumeration signature.
- **Honeypot accounts with `DONT_REQUIRE_PREAUTH`** set — any TGT request against them is a high-fidelity attack signal.
- **Detection lag** is the issue — the offline crack itself is invisible. Detection is at the request step, which an attacker can rate-limit to under threshold alerts.

## Mitigation

Two-line fix:

1. **Disable `DONT_REQUIRE_PREAUTH` everywhere.** Run the PowerShell audit above; for every account with the flag, clear it:

   ```powershell
   Set-ADAccountControl -Identity 'username' -DoesNotRequirePreAuth $False
   ```

2. **Strong passwords for the remaining edge cases.** If an account legitimately needs the flag (rare — typically legacy Unix Kerberos clients), enforce a 30-character random password on it. The flag stops mattering when the underlying password is uncrackable.

## Compared to Kerberoasting

| | AS-REP Roasting | [Kerberoasting](/wiki/kerberoasting) |
|---|---|---|
| **Requires authenticated user** | No (with username list) | Yes (any low-priv user) |
| **Target population** | Accounts with `DONT_REQUIRE_PREAUTH` (rare in modern AD) | Accounts with SPN set (common — every service account) |
| **Hashcat mode** | 18200 (AS-REP) | 13100 (TGS-REP) |
| **Frequency in real-world wins** | Low — rare to find vulnerable accounts | High — almost every domain has roastable service accounts |
| **Best initial-access tool** | When you have no creds at all | After getting any authenticated user |

Both belong in the standard internal-pentest opening playbook.

## Further reading

- [Will Schroeder: Roasting AS-REPs (the original write-up)](https://blog.harmj0y.net/activedirectory/roasting-as-reps/).
- [HackTricks: AS-REP Roasting](https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/asreproast).
- [SpecterOps "Roasting As-REPs" follow-up](https://posts.specterops.io/).
