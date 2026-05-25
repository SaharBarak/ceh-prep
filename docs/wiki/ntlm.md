---
title: NTLM
slug: ntlm
category: protocols
summary: NTLM (NT LAN Manager) is Microsoft's legacy challenge-response authentication protocol. It pre-dates Kerberos in Windows networks and remains active for compatibility — making NTLM relay and pass-the-hash some of the most consequential attack primitives in Active Directory.
related: [kerberos, active-directory, pass-the-hash, mimikatz, bloodhound, smb, ldap]
aliases: [NT LAN Manager, NTLMv1, NTLMv2]
updated: 2026-05-24
---

**NTLM** (NT LAN Manager) is a suite of Microsoft challenge-response authentication protocols. It pre-dates [Kerberos](/wiki/kerberos) on Windows but remains active in modern domains for compatibility with non-domain-joined hosts, workgroup environments, and legacy applications.

NTLM is the basis of two of the most consequential offensive primitives in Windows networks: **[Pass-the-Hash](/wiki/pass-the-hash)** (replaying a captured NTLM hash without cracking it) and **NTLM relay** (forwarding captured NTLM authentication to a different service).

## How NTLM authentication works

The three-step challenge-response flow:

1. **Negotiate.** Client tells the server it wants to authenticate with NTLM and what flags it supports.
2. **Challenge.** Server returns an 8-byte random nonce.
3. **Response.** Client encrypts the challenge with the user's NT hash (`MD4(UTF-16-LE(password))`) and returns the result. Server forwards the response to a domain controller, which performs the same computation and compares.

The user's password never leaves their machine; only the response — derived from the hash — does. The DC accepts the response as proof of identity.

## NTLMv1 vs NTLMv2

- **NTLMv1** uses a single-pass DES-encrypted challenge response. Crackable offline in minutes on modern hardware. Should be disabled in every environment.
- **NTLMv2** adds a client-side challenge, HMAC-MD5 of the user's NT hash, and an authentication target (domain + username) — much harder to crack but still possible with a wordlist if the password is weak.

The default on modern Windows is NTLMv2-only via `LmCompatibilityLevel`. Confirm via `Group Policy → Network Security: LAN Manager authentication level`.

## Pass-the-Hash — replaying without cracking

Because NTLM authentication uses the *hash* (not the plaintext password) as the input to the response, an attacker who captures an NT hash from one machine can use it to authenticate as that user to any other machine that accepts NTLM. The hash IS the credential.

Tools like `psexec.py -hashes :HASH user@target`, `crackmapexec`, or `evil-winrm -H HASH` consume hashes directly. Cracking the password is unnecessary — though attackers crack anyway to enable interactive logon (RDP) which requires plaintext.

See **[Pass-the-Hash](/wiki/pass-the-hash)** for the full pattern.

## NTLM relay

A more powerful primitive than Pass-the-Hash: the attacker positions in the middle of an authentication exchange and *forwards* the authentication to a different service.

```
  victim ─── NTLM auth ──→  attacker  ─── forwards auth ──→  target service
```

If the victim is a privileged account and the target accepts NTLM (SMB, LDAP, HTTP), the attacker authenticates *as the victim* on the target without ever knowing the victim's password.

Tools: `ntlmrelayx.py` (Impacket) is the standard.

Coercion techniques (forcing a privileged target to authenticate to the attacker):

- **`Responder`** — LLMNR/NBT-NS/mDNS poisoning. Standard layer for credential capture on multicast-noisy networks.
- **PetitPotam** — RPC call (`EfsRpcOpenFileRaw`) that forces a target to authenticate to an attacker-controlled host.
- **PrinterBug** — `RprnRpcAsyncOpenPrinter`. Similar coercion via Print Spooler.
- **DFSCoerce** — DFS-protocol-based coercion.

The dominant 2022-2024 finding pattern: PetitPotam + ntlmrelayx → LDAP-with-signing-disabled → grant your account `Cert Publishers` via AD CS → request a Domain Admin certificate → done.

## Disabling NTLM

The aspirational state for modern AD: Kerberos-only, NTLM fully disabled. Realistic obstacles:

- Legacy applications hard-coded to NTLM.
- Workgroup-joined machines (non-domain).
- Cross-trust scenarios where Kerberos doesn't work.

Microsoft's current guidance is to *audit* NTLM usage (`Group Policy → Network Security: Restrict NTLM`), classify each remaining usage, then *block* progressively. EventID 8001 on the DC logs every NTLM auth attempt.

## Hashcat modes

| Hash type | Hashcat mode | Where you capture it |
|---|---|---|
| NTLM (NT hash) | `1000` | `secretsdump.py` from SAM/NTDS.dit |
| NTLMv1 (NetNTLMv1) | `5500` | Responder capture from a v1-allowing client |
| NTLMv2 (NetNTLMv2) | `5600` | Responder capture from a v2-only client |

NTLMv1 cracks in minutes; NTLMv2 takes longer but is feasible for weak passwords.

## Mitigation

- **Disable NTLMv1 immediately.** No legitimate modern use case.
- **Enforce SMB signing + LDAP signing + LDAP channel binding.** Defeats most ntlmrelayx scenarios.
- **Disable WPAD / LLMNR / NBT-NS.** Responder's primary capture vectors.
- **Patch the coercion CVEs** (PetitPotam KB5005413, PrinterBug, etc.).
- **Use Kerberos.** Where possible, configure services to require Kerberos auth.

## Further reading

- [Microsoft: NTLM Overview](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/b38c36ed-2804-4868-a9ff-8dd3182128e4).
- [SpecterOps: NTLM Relaying](https://posts.specterops.io/relayx-pass-thru-attack-walkthrough).
- [The Hacker Recipes: NTLM](https://www.thehacker.recipes/a-d/movement/ntlm).
