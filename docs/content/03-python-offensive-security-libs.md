# 03 — 7 Python Libraries Every Security Engineer Should Know

- **Source:** Instagram reel — https://www.instagram.com/reel/DWlc0ZdjMI6/
- **Author:** [@kerem.tech](https://instagram.com/kerem.tech)
- **Shared:** 2026-04-15
- **Duration:** 8s
- **GitHub repos:** none directly linked (libraries listed below have well-known repos)
- **External links:** none

## Caption

Python is the most widely used language in offensive security, not because it's trendy, but because it gives you full control over every layer of an attack or defense workflow.

7 libraries every security engineer should have in their toolkit:

1. **Scapy** — craft, send, and sniff raw network packets at any protocol layer. Used for recon, fuzzing, and building custom scanners.
2. **Impacket** — interact with Windows protocols (SMB, MSRPC, LDAP). Essential for credential dumping, Pass-the-Hash, and AD attacks.
3. **python-nmap** — drive Nmap directly from your Python scripts. Automate port scanning and service enumeration.
4. **Paramiko** — pure-Python SSH2 client. Automate remote command execution, file transfers, port tunneling.
5. **Shodan** — query the internet's largest index of exposed devices via API.
6. **pwntools** — the go-to framework for CTF and binary exploitation. Simplifies buffer overflows, ROP chains, shellcode.
7. **Cryptography** — production-safe primitives for encryption, hashing, key management.

`#cybersecurity #python #ethicalhacking #redteam #infosec`

## Audio transcript

Music only — no spoken content.

## On-screen code samples (OCR)

- **Scapy** — `sniff(filter="tcp port 443", count=10, prn=process_pkt)`; callback prints `src -> dst [dport]`.
- **python-nmap** — `nm = nmap.PortScanner()`; iterates `nm[host]["tcp"]` and prints `host:port svc`. Sample output: `192.168.1.1:22 ssh`, `192.168.1.5:80 http`, `192.168.1.5:443 https`.
- **pwntools** — `context.arch = "amd64"`, "Connect to remote CTF challenge service", `[+] Opening connection to challenge.ctf.io:4444`, `[+] Sending payload (72 bytes)`, `[*] Switching to interactive mode`. Buffer-overflow payload construction shown in `exploit.py`.

## Canonical repos (reference)

- Scapy — https://github.com/secdev/scapy
- Impacket — https://github.com/fortra/impacket
- python-nmap — https://github.com/nmmapper/python3-nmap
- Paramiko — https://github.com/paramiko/paramiko
- Shodan — https://github.com/achillean/shodan-python
- pwntools — https://github.com/Gallopsled/pwntools
- cryptography — https://github.com/pyca/cryptography

## Tools / keywords

Python · packet crafting · AD attacks · Pass-the-Hash · SSH automation · CTF · ROP · shellcode · cryptographic primitives
