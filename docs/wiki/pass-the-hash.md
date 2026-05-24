---
title: Pass-the-Hash
slug: pass-the-hash
category: attacks
summary: Pass-the-Hash (PtH) is an authentication-replay attack where an attacker uses a captured NTLM password hash to authenticate to a remote service without cracking the password — because the hash, not the plaintext, is what the NTLM protocol actually verifies.
related: [ntlm, kerberos, active-directory]
aliases: [PtH, Hash Replay]
updated: 2026-05-24
---

**Pass-the-Hash** (PtH) is an authentication-replay attack against the [NTLM](/wiki/ntlm) protocol. An attacker who obtains a user's NT password hash — from memory, a SAM database, NTDS.dit, or a sniffed authentication — can use it to authenticate as that user to any service that accepts NTLM, *without ever cracking the password*.

The technique is over 20 years old and remains one of the highest-impact primitives in [Active Directory](/wiki/active-directory) attacks. The phrase "the hash IS the credential" captures the core: when the protocol verifies a derived value, possessing the derived value is equivalent to possessing the password.

## Why it works

NTLM authentication is challenge-response. The client encrypts the server's challenge with the user's NT hash and returns the result. The server (via a domain controller) performs the same computation and compares.

Notably, the protocol never asks the client to demonstrate knowledge of the *plaintext password* — it only requires the client to demonstrate access to the hash. An attacker with the hash performs the same computation as the legitimate client.

Kerberos has an equivalent attack — **Pass-the-Ticket** — but the chain is different: there, the attacker replays an already-issued Kerberos ticket. Kerberos itself isn't password-equivalent at the hash level, but PtH-style logic (replay derived material) maps to PtT.

## Capturing hashes

Common sources:

| Source | Tool |
|---|---|
| SAM database (local accounts on a workstation) | `secretsdump.py LOCAL -sam SAM -system SYSTEM`, `mimikatz lsadump::sam` |
| LSASS memory (cached domain creds) | `mimikatz sekurlsa::logonpasswords`, `procdump` + offline parse |
| NTDS.dit (every domain account on a DC) | `secretsdump.py -just-dc`, `ntdsutil ifm` |
| Wire capture (Responder MITM) | `Responder.py -wrf -I eth0` |
| Domain Controller via DCSync (replication RPC) | `secretsdump.py -just-dc-user TargetUser` |

LSASS dumps are blocked by Credential Guard on modern Windows. DCSync requires Replicating Directory Changes privileges (typically Domain Admin or equivalent).

## Using the hash

Once you have `username:HASH`, the tools that consume it:

```bash
# Impacket family
psexec.py user@target -hashes :HASH
smbexec.py user@target -hashes :HASH
wmiexec.py user@target -hashes :HASH

# CrackMapExec / NetExec
nxc smb 10.0.0.0/24 -u user -H HASH
nxc smb 10.0.0.5 -u user -H HASH -x "whoami /priv"

# Evil-WinRM (PowerShell over WinRM)
evil-winrm -i target -u user -H HASH

# RDP requires plaintext (CredSSP) — RDP is the one common service PtH doesn't cover
```

The hash format Impacket expects is `:NTHASH` (the leading colon is the empty LM hash, retained for historical compatibility).

## Lateral movement pattern

A typical PtH chain:

1. Compromise one machine, dump local credentials.
2. Find a domain-cached credential in LSASS (an admin who logged in recently).
3. Test that credential against every other workstation via SMB.
4. Find a machine where another, higher-privileged admin is logged in.
5. Dump LSASS on that machine, repeat.

[BloodHound](https://github.com/SpecterOps/BloodHound) automates this — point its `Outbound Sessions` query at your current foothold and it surfaces every machine where a more-privileged user has an active session.

## Why local admin matters

PtH only works against services that accept your hash. The local-admin hash on one workstation is only useful for *that* workstation — unless other workstations share the same local admin password. Which they almost always do in environments that didn't deploy LAPS.

**The single biggest PtH mitigation is LAPS** (Local Administrator Password Solution): a Microsoft tool that randomizes the local administrator password on every workstation, stores it in AD, and rotates it. With LAPS enabled, cracking one local admin hash is worth one machine — not a lateral movement primer.

## Mitigation

In priority order:

1. **LAPS.** Randomize and rotate local admin passwords.
2. **Credential Guard.** Hardware-backed isolation of LSASS secrets. Blocks LSASS dumps on supported hosts.
3. **Tier-0 isolation.** Domain admin accounts should not log into non-tier-0 hosts. If they don't log in, their hash is never in LSASS to capture.
4. **Disable cached creds where reasonable.** `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon\CachedLogonsCount = 0`. Trade-off: users can't log in when offline.
5. **Monitor for Event 4624 with logon type 3 + NTLM auth.** Lateral movement via PtH leaves this signature.

## Pass-the-Hash vs. Overpass-the-Hash

A related technique: **Overpass-the-Hash** uses the NT hash to obtain a Kerberos TGT (via `Rubeus.exe asktgt /user:X /rc4:HASH`). The attacker gets a Kerberos ticket without knowing the plaintext password, defeating Kerberos-only environments.

## Real-world examples

- **NotPetya (2017)** — Mimikatz harvested credentials from LSASS, then PtH/Mimikatz-lateral spread laterally. Used the Windows MS17-010 RCE for initial exploitation but PtH for spread.
- **The vast majority of internal pentests** — PtH is the canonical lateral-movement primitive on any internal engagement before AD CS abuse became the dominant 2024 finding.

## Further reading

- [Microsoft: Mitigating Pass-the-Hash Attacks (2014, still relevant)](https://www.microsoft.com/en-us/download/details.aspx?id=36036).
- [Microsoft LAPS deployment docs](https://learn.microsoft.com/en-us/windows-server/identity/laps/laps-overview).
- [BloodHound documentation](https://bloodhound.specterops.io/).
