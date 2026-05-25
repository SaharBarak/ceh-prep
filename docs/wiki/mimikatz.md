---
title: Mimikatz
slug: mimikatz
category: tools
summary: Mimikatz is a Windows-credential extraction tool developed by Benjamin Delpy that recovers passwords, hashes, Kerberos tickets, and other secrets from memory and the registry. It is the canonical credential-access tool in Active Directory attacks and one of the most-detected pieces of software on Earth.
related: [pass-the-hash, ntlm, kerberos, active-directory, bloodhound, laps, edr]
aliases: [mimikatz, kiwi, sekurlsa]
updated: 2026-05-25
---

**Mimikatz** is an open-source post-exploitation tool developed by Benjamin Delpy ("gentilkiwi") that extracts passwords, password hashes, Kerberos tickets, certificates, and other secrets from a Windows host. First released in 2007, it became the canonical credential-access tool in Active Directory attacks and remains, by detection volume, one of the most-detected pieces of software on Earth.

Mimikatz's most-cited capability is dumping cleartext passwords from `lsass.exe` memory — until 2015, Windows cached every interactively-logged-in user's password in cleartext in LSASS for the `wdigest` provider. Mimikatz extracted them in one command. The exposure was so consequential that Microsoft retroactively disabled wdigest cleartext caching in subsequent Windows updates. Mimikatz then evolved.

## The commands that matter

Mimikatz operates as an interactive shell. The commonly-used commands:

```
privilege::debug                                 # Acquire SeDebugPrivilege

sekurlsa::logonpasswords                         # Dump every cached credential from LSASS:
                                                 # NT hashes, Kerberos tickets, sometimes cleartext

sekurlsa::pth /user:USER /domain:DOMAIN /ntlm:HASH /run:cmd.exe
                                                 # Pass-the-Hash — spawn cmd.exe with stolen hash

sekurlsa::tickets /export                        # Export every Kerberos ticket on the host

kerberos::list                                   # List the Kerberos tickets in the current session

kerberos::ptt ticket.kirbi                       # Pass-the-Ticket — inject a stolen ticket

kerberos::golden /user:USER /domain:DOMAIN /sid:SID /krbtgt:KRBTGT_HASH /ticket:golden.kirbi
                                                 # Forge a Golden Ticket

lsadump::sam                                     # Dump local account hashes from SAM

lsadump::dcsync /user:DOMAIN\krbtgt              # Pull a hash via replication (the DCSync attack)

vault::cred                                      # Dump Windows Credential Vault (browser passwords, etc.)

token::elevate                                   # Impersonate an existing token on the host

misc::cmd                                        # Spawn cmd.exe via Mimikatz's bypasses
```

The modules `sekurlsa`, `kerberos`, `lsadump`, and `vault` are the load-bearing ones for AD post-exploitation.

## What Mimikatz does NOT do

- **Crack passwords.** Mimikatz extracts the hashes that [hashcat](/wiki/hashcat) cracks; it doesn't crack them itself.
- **Get a foothold.** Mimikatz runs *after* the attacker has code execution on the host. Initial access is something else's job.
- **Persist by itself.** The output (hashes, tickets) is what enables persistence elsewhere — Mimikatz itself is a one-shot tool.

## Why it gets detected on contact

Mimikatz has been studied by every AV/EDR vendor for over a decade. Default Mimikatz binaries:

- Match dozens of static AV signatures.
- Pop EDR hooks the moment they touch LSASS.
- Trigger AMSI scans on PowerShell variants.
- Generate ETW events that map directly to MITRE technique T1003.001 (LSASS Memory).

A direct `mimikatz.exe sekurlsa::logonpasswords exit` runs for milliseconds before being killed and quarantined on any modern host with Defender for Endpoint, CrowdStrike, or SentinelOne.

Operators bypass this with:

- **Custom-compiled Mimikatz** — building from source with renamed symbols and modified imports. Defeats static signatures; not behavioral signatures.
- **Memory injection from a different process** — load mimikatz functionality as a DLL via process hollowing or reflective loading.
- **PowerShell variants** — `Invoke-Mimikatz` (PowerShell port). Heavily flagged by AMSI; works only with an AMSI bypass.
- **Procdump LSASS, parse offline** — `procdump.exe -ma lsass.exe` (signed Microsoft tool, less suspicious) then run Mimikatz against the dump on the attacker's host. Defeats EDR's process-touching detection but `procdump`-of-LSASS is itself a high-fidelity behavioral signature now.
- **Direct syscalls** — bypass user-mode EDR hooks with `SysWhispers`-style direct syscall invocation.
- **C2 framework built-ins** — Cobalt Strike's `mimikatz` command, Sliver's equivalents, ship hardened versions with at least the static-signature problem solved.

## Mitigation

Defenders' counter-stack:

| Control | What it does |
|---|---|
| **Credential Guard** | Hardware-backed VBS isolation of LSASS secrets. Blocks Mimikatz's LSASS reads on supported hosts. **The single most effective control.** |
| **Disable WDigest cleartext caching** | Already off by default since Windows 8.1 / Server 2012 R2. Verify `HKLM\SYSTEM\CurrentControlSet\Control\SecurityProviders\WDigest\UseLogonCredential = 0`. |
| **PPL on LSASS** (Protected Process Light) | Makes LSASS a protected process; only kernel-signed code can read its memory. Configurable via `RunAsPPL`. |
| **Restricted Admin Mode for RDP** | RDP sessions don't pass credentials to the remote host — limits what's in LSASS to capture there. |
| **LAPS** (Local Administrator Password Solution) | Even if Mimikatz dumps a local admin hash, [LAPS](/wiki/active-directory) rotates it per-host so the hash is worth one machine. |
| **Tier-0 isolation** | Domain admins should not log into non-tier-0 hosts. If they don't log in, their hash is never in LSASS to capture. |
| **EDR with kernel-mode visibility** | Detects the behavioral signature of LSASS-reading processes — including `procdump`-of-LSASS, suspicious cross-process reads. |

## Real-world usage

Mimikatz appears in nearly every public APT report involving Windows networks. Notable:

- **NotPetya (2017)** — embedded a Mimikatz-equivalent credential harvester to pivot laterally before destruction.
- **MITRE ATT&CK technique T1003.001** (LSASS Memory) is essentially defined by Mimikatz behavior.
- **Every published red-team report** that touches Windows credentials cites Mimikatz or a variant.

## Further reading

- [Mimikatz GitHub (Benjamin Delpy)](https://github.com/gentilkiwi/mimikatz).
- [Mimikatz wiki — full module reference](https://github.com/gentilkiwi/mimikatz/wiki).
- [ADSecurity: Unofficial Mimikatz Guide](https://adsecurity.org/?page_id=1821).
- [Microsoft Credential Guard documentation](https://learn.microsoft.com/en-us/windows/security/identity-protection/credential-guard/).
