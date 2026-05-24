---
title: Active Directory
slug: active-directory
category: protocols
summary: Active Directory (AD) is Microsoft's directory service for Windows networks — a centralized database of users, groups, computers, and policies that authenticates and authorizes nearly every action on a Windows domain.
related: [kerberos, ntlm, pass-the-hash, nmap]
aliases: [AD, Microsoft Active Directory]
updated: 2026-05-24
---

**Active Directory** (AD) is Microsoft's directory service for Windows-centric enterprise networks. It stores users, groups, computers, and policies in a hierarchical LDAP-backed database, and uses [Kerberos](/wiki/kerberos) (with [NTLM](/wiki/ntlm) as fallback) to authenticate every login, file access, and service request inside the domain.

AD is the single most consequential system for offensive security on internal Windows networks. The phrase "domain admin" — full control of an AD environment — is shorthand for "the engagement is over."

## Core concepts

- **Domain.** The root namespace (e.g. `corp.contoso.local`). Every user, computer, and group belongs to exactly one domain.
- **Domain Controller (DC).** A Windows Server running the AD services. Holds the writable copy of the directory database (`NTDS.dit`).
- **Forest.** A collection of one or more domains sharing a schema and a trust topology. Multi-domain enterprises live in a forest.
- **Organizational Unit (OU).** Subtree of the directory used to apply Group Policy Objects (GPOs) to a scoped set of objects.
- **Security Principal.** Any entity that can authenticate — users, computers, and groups. Each carries a Security Identifier (SID).

## Why offensive security cares

A foothold on a single domain-joined workstation puts you inside the AD attack surface. From there, the chain of escalation is well-documented:

1. **Enumerate the domain.** LDAP queries (often anonymous-bindable, see [LDAP](/wiki/active-directory)) give you usernames, group memberships, and OU structure.
2. **Identify roastable accounts.** [Pass-the-Hash](/wiki/pass-the-hash), Kerberoasting, and AS-REP roasting let you crack credentials without authenticated foothold escalation.
3. **Path-find with BloodHound.** Tools like [BloodHound](https://github.com/SpecterOps/BloodHound) ingest the AD graph and surface shortest paths from your current identity to Domain Admin.
4. **Walk the path.** Each abuse edge (`GenericAll`, `WriteDACL`, `ForceChangePassword`, `AllowedToDelegate`) has a documented exploitation technique.

The dominant 2024-2025 internal pentest finding has been **AD CS abuse** — misconfigured Active Directory Certificate Services templates that let any domain user request a certificate authenticating as a domain admin. The Certipy tool catalogs eight ESC1-ESC8 abuse patterns.

## Protocols AD uses

- **[Kerberos](/wiki/kerberos)** — primary authentication. Tickets, KDC, TGT/TGS.
- **[NTLM](/wiki/ntlm)** — legacy challenge-response auth. Still active for compatibility and is the basis of [Pass-the-Hash](/wiki/pass-the-hash).
- **LDAP** — directory queries (read, search, sometimes write).
- **SMB** — file sharing + remote management. The transport for `psexec`-style lateral movement.
- **DNS** — AD relies on DNS heavily; the SRV record `_ldap._tcp.contoso.local` locates the DC.

## Hardening fundamentals

- **Tier-0 isolation.** Domain admin accounts should only log into DCs, never workstations. A compromise of any non-tier-0 host should not give a path to tier-0.
- **LAPS.** Local Administrator Password Solution randomizes the local admin password on every workstation, stores it in AD, and rotates it. Prevents one cracked local-admin hash from working everywhere.
- **Disable NTLM where possible.** Force Kerberos-only authentication on modern segments. NTLM relay attacks (`ntlmrelayx.py`) are a recurring chain.
- **AD CS audit.** Run Certipy in audit mode against your environment. Most environments have at least one ESC1-ESC8 misconfiguration on first scan.
- **Sensitive-group monitoring.** Alert on changes to Domain Admins, Enterprise Admins, Schema Admins, Account Operators.

## Tools

| Tool | Purpose |
|---|---|
| `BloodHound` / `SharpHound` | Path-find from foothold to Domain Admin. |
| `Impacket` | Python library of every AD attack primitive — `secretsdump`, `psexec`, `GetUserSPNs`, `GetNPUsers`, `ntlmrelayx`. |
| `Rubeus` | Windows-native Kerberos toolkit (Kerberoasting, AS-REP roasting, ticket manipulation). |
| `mimikatz` | Credential extraction from memory (`sekurlsa::logonpasswords`). |
| `Certipy` | AD CS abuse — the ESC1-ESC8 family. |
| `Responder` | LLMNR / NBT-NS poisoning + NTLM hash capture. |

## Practice environments

- **[GOAD](https://github.com/Orange-Cyberdefense/GOAD)** — Game of Active Directory. A free Vagrant-deployable vulnerable AD lab with multiple domains.
- **HackTheBox** — boxes like Resolute, Forest, Cascade, Sauna, Hutch all chain canonical AD attacks.
- **TryHackMe "Attacktive Directory"** — beginner walkthrough of the AS-REP / kerberoast / BloodHound trio.

## Further reading

- [SpecterOps blog (BloodHound and AD CS research)](https://posts.specterops.io/).
- [ADSecurity.org](https://adsecurity.org/) — Sean Metcalf's deep AD attack/defense reference.
- [HackTricks: Active Directory Methodology](https://book.hacktricks.xyz/windows-hardening/active-directory-methodology).
