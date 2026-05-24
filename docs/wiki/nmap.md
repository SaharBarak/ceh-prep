---
title: Nmap
slug: nmap
category: tools
summary: Nmap (Network Mapper) is an open-source network scanning tool used to discover hosts and services on a computer network. It is the canonical reconnaissance and scanning tool in offensive security, used to enumerate open ports, identify running services, fingerprint operating systems, and run scripted vulnerability checks.
related: [active-directory, cvss, burp-suite]
aliases: [Network Mapper, nmap.org]
updated: 2026-05-24
---

**Nmap** (Network Mapper) is an open-source network scanning tool created by Gordon "Fyodor" Lyon in 1997. It is the canonical reconnaissance and scanning tool in offensive security, used to discover live hosts, enumerate open TCP/UDP ports, identify running services, fingerprint operating systems, and run a scripting engine (NSE) for vulnerability checks and follow-up enumeration.

Nmap is free, cross-platform, and shipped on every major Linux distribution. The companion GUI is **Zenmap**.

## Core scan types

The flag that selects the TCP scan technique:

| Flag | Name | What it does | When to use |
|---|---|---|---|
| `-sS` | SYN (half-open) | Sends a SYN, waits for SYN/ACK, sends RST. Doesn't complete the handshake. | Default for root scans. Faster than `-sT`, less visible to legacy IDS. Requires raw socket access. |
| `-sT` | TCP Connect | Full TCP three-way handshake. Uses the OS connect() syscall. | Required when raw sockets aren't available (unprivileged scans, in-browser sandboxes). |
| `-sU` | UDP | Sends a UDP packet, classifies based on response. Slower because no handshake. | When the target's interesting services are UDP (DNS, SNMP, NTP, NetBIOS). |
| `-sA` | ACK | Sends ACK packets. Doesn't find open ports — finds firewall state. | Mapping which ports are filtered vs unfiltered. |
| `-sN`/`-sF`/`-sX` | Null / FIN / Xmas | Sends packets with unusual flag combinations. Some firewalls miss these. | Stealth / IDS evasion. Less common today. |

## Service + OS detection

- **`-sV`** — Service version detection. Sends probes to open ports, matches responses against an extensive signature database (`nmap-service-probes`). Tells you not just "port 22 is open" but "OpenSSH 8.4p1 Debian 5+deb11u1."
- **`-O`** — OS fingerprinting. Analyzes TCP/IP stack quirks to guess the operating system.
- **`-A`** — Aggressive. Enables `-sV`, `-O`, default NSE scripts, and traceroute. The "tell me everything you can" flag.

## Timing templates

Nmap's `-T` flag sets a timing profile:

| Template | Name | Use case |
|---|---|---|
| `-T0` | Paranoid | One probe every 5 minutes. Designed to slip under legacy IDS. Real engagements use this when explicitly required. |
| `-T1` | Sneaky | One probe every 15 seconds. |
| `-T2` | Polite | Slow but won't overwhelm a fragile target. |
| `-T3` | Normal | Default. |
| `-T4` | Aggressive | Faster timeouts. Standard for internal pentests. |
| `-T5` | Insane | Assumes a fast, reliable network. Loses accuracy on flaky links. |

## Common scan recipes

```bash
# Top 1000 TCP ports on a single host, default
nmap target.example

# All 65535 TCP ports with service + OS detection
nmap -p- -sV -O target.example

# Top 100 ports across a /24 — first-pass network survey
nmap -F 10.0.0.0/24

# UDP scan of the common UDP services
nmap -sU --top-ports 50 target.example

# Stealthy SYN scan, no DNS, slow timing
nmap -sS -n -T2 target.example

# All ports, all detections, save to file in three formats
nmap -p- -A -oA scan-results target.example
```

The `-oA` output writes `.nmap` (human), `.xml` (parser-friendly), and `.gnmap` (grepable) variants simultaneously. Always use `-oA` on real engagements — re-running a scan is expensive in time and network noise.

## NSE — Nmap Scripting Engine

NSE is Nmap's scripting layer. Scripts run against open ports and produce service-specific output: vulnerability checks, brute-force credentials, banner grabs, enumeration.

```bash
# Run a category of scripts
nmap --script=vuln target.example
nmap --script=default target.example
nmap --script=auth target.example
nmap --script=brute target.example

# A specific script
nmap --script=smb-vuln-ms17-010 -p 445 target.example
```

NSE has ~600 scripts shipped. Useful subsets:

- `vuln` — known-vulnerability checks (SMB-MS17-010 EternalBlue, HTTP-Heartbleed, etc.).
- `default` — safe enumeration scripts that run with `-A`.
- `discovery` — additional host and service discovery.
- `brute` — credential brute-force against the service.
- `auth` — authentication-related checks.

Combine with `--script-args` to pass parameters to scripts.

## Firewall and IDS evasion

Nmap ships several evasion features. They're often what CEH and similar exams ask about:

| Flag | Effect |
|---|---|
| `-f` | Fragment packets — split SYN across multiple IP fragments. |
| `--mtu N` | Custom fragment size. |
| `-D RND:10` | Decoy scan — add 10 random source IPs in addition to yours. |
| `-S spoofed_ip` | Spoof the source IP. |
| `--source-port 53` | Use a specific source port (some firewalls allow port 53 outbound). |
| `--data-length N` | Pad packets to a specific length. |

These were effective against late-1990s stateful firewalls and are less so against modern IDS — but the exam will ask about them.

## Practice and ethics

Nmap is dual-use. Scanning networks you don't own without authorization is illegal in most jurisdictions (CFAA in the US, Computer Misuse Act in the UK).

Legal practice targets:

- **`scanme.nmap.org`** — Fyodor's official "go ahead and scan me" host.
- **Your own local lab** — VirtualBox VMs, GOAD, Metasploitable.
- **HackTheBox / TryHackMe** — explicitly authorized scanning ranges.

## Further reading

- [Nmap Network Scanning (Fyodor's book, free online)](https://nmap.org/book/).
- [Nmap.org reference guide](https://nmap.org/book/man.html).
- [NSE script documentation](https://nmap.org/nsedoc/).
