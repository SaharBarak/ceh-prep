# 16 — WebVM: A Full Linux CLI Inside the Browser Tab

- **Source:** Facebook reel — https://www.facebook.com/share/r/1Fw9Z6xUvy/ (redirects to `facebook.com/reel/943302395000213/`)
- **Author:** Niyitech (FB page)
- **Posted:** 2026-05-15 (timestamp 1777993901)
- **Duration:** 18.8s
- **GitHub repo:** **[leaningtech/webvm](https://github.com/leaningtech/webvm)** (Apache-2.0)
- **Live demo:** [webvm.io](https://webvm.io) · graphical Alpine/Xorg/i3 variant: [webvm.io/alpine.html](https://webvm.io/alpine.html)
- **Underlying engine:** [CheerpX](https://leaningtech.com/cheerpx/) — Leaning Technologies' x86→WebAssembly JIT + virtual block-based filesystem + Linux syscall emulator
- **Curriculum mapping:** **CEH v13 Day 01 — Foundations & Lab Setup** (with day-wise drill-fitness table below)

## Caption (from FB)

> This one is actually cool 🔥
>
> WebVM is a fully functional Linux virtual machine that runs entirely inside your browser — no installation, no server, no setup whatsoever.
>
> → run a real Debian Linux environment from any browser tab
> → supports native development toolchains out of the box
> → connect to your private network via Tailscale integration
> → graphical desktop environment available with Alpine and i3
> → powered by WebAssembly — everything runs on your own device
>
> If you've ever needed a quick Linux environment and didn't want to spin up a VM or mess with dual boot setups, this loads in seconds and just works :))
>
> Source 🔗 //webvm.io

`#linux #webassembly #opensource #coding #webdevelopment #programming`

## Audio transcript

> What if you could run a full Linux terminal right inside your browser tab? WebVM is a real Debian Linux environment. No installation, no server, nothing to set up. Open the link and you're already inside a terminal. Run commands, build projects, connect to your network — all from your browser. Share and follow for more.

## On-screen content (frames + GitHub README)

The reel intercuts a webvm.io demo terminal with the `github.com/leaningtech/webvm` README. Recovered fragments:

- Repo: `leaningtech/webvm`, Apache-2.0 license, 220 in Discord chat, 12 open issues
- README headline: *"This repository hosts the source code for [webvm.io](https://webvm.io), a Linux virtual machine that runs in your browser."*
- "Try out the new Alpine / Xorg / i3 graphical environment: webvm.io/alpine.html"
- Side-by-side screenshots: left = terminal with Welcome banner + cowsay, right = full graphical i3 desktop on Alpine
- Architecture bullets:
  - x86-to-WebAssembly JIT compiler (CheerpX)
  - Virtual block-based file system
  - Linux syscall emulator
  - Safe, sandboxed client-side execution
- README ToC: Networking · Development & Customization · Local Serving & Image Configuration · Deploy to GitHub Pages · Claude AI Integration · Community & Support · License
- Networking section: *"WebVM supports **Tailscale** integration. So your browser VM can reach your private network and, with an exit node, the public internet."* (4 steps: Click "Connect" → log in via interactive auth or URL `https://webvm.io/#authKey=<your-ephemeral-key>` → green dot = global/internet, orange dot = local network)
- Welcome banner examples shown on the live demo:
  ```
  python3 examples/python3/fibonacci.py
  gcc -o helloworld examples/c/helloworld.c && ./helloworld
  objdump -d ./helloworld | less -M
  vim examples/c/helloworld.c
  curl --max-time 15 parrot.live   # requires networking
  user@:~$ cowsay "Welcome to WebVM!"
  ```

## What it actually is

WebVM is a **real x86 Linux** — not a re-implementation. It runs unmodified Debian binaries via CheerpX, which JIT-compiles x86 to WebAssembly inside the browser tab. Filesystem state persists in IndexedDB. The whole thing is client-side; nothing leaves the user's device except network calls (which are tunneled through Tailscale, optionally with an exit node for public internet).

Practical implications:
- No raw kernel access (no kernel modules, no `SOCK_RAW`)
- All networking goes through CheerpX → Tailscale; there is no bare BSD sockets escape
- Filesystem is read/write and persists across reloads
- Native toolchains: `gcc`, `python3`, `vim`, `curl`, `objdump`, `cowsay`, `apt` are all available; more can be `apt install`'d
- Disk image is customizable — you can fork the repo, build a Dockerfile-based image, and self-host on GitHub Pages

---

## Drill-fitness assessment for CEH prep

**Verdict: Yes — for a major slice of CEH drills, WebVM is an excellent embed.** It eliminates the "set up VirtualBox + Kali" friction (see [item 15](./15-build-hacking-lab-30min.md)) for any drill that does **not** need raw sockets, packet capture, wireless hardware, or kernel-level primitives.

### What works well (✅ embed directly)

| Drill family | Why WebVM fits |
|--------------|----------------|
| **Linux fundamentals** (file perms, processes, signals, find/grep/awk/sed, pipes, regex) | Native Debian — every drill is a real shell command. |
| **Scripting drills** (bash one-liners, Python exploit scripts, payload generators) | Full `python3` + `bash` toolchain. |
| **Static SQLi / XSS payload construction** | Build/edit payloads in `vim`, validate with `python -c '...'`. Send via `curl` (Tailscale-gated, but works against in-app drill targets). |
| **File / binary analysis** (`file`, `strings`, `xxd`, `objdump`, `readelf`, `gdb`) | All available via `apt`. |
| **Reverse engineering basics** (disasm, signatures, ELF anatomy) | Same — and the disk image can ship pre-loaded sample binaries per drill. |
| **Crypto labs** (Day 13: `openssl` modes, hash cracking concept demos, base64/hex transforms) | `openssl` works fully. Hashcat CPU-mode runs but slowly. |
| **Command-flag memorization** (Nmap, SQLMap, Hydra, John flags) | These binaries are `apt`-installable; flag-parsing drills don't need to hit a real target. |
| **CTF-style intro** (text-extraction, encoded payloads, simple RE) | Fits perfectly — these are exactly the constraints PicoCTF / OverTheWire run under. |

### What works with caveats (⚠️ requires our infra)

| Drill family | What's needed |
|--------------|--------------|
| **Live Nmap against a target** | Drill target must be reachable via Tailscale exit node (we host it) or via a `curl`-style HTTP probe. Real SYN scans are blocked — but Nmap `-sT` (TCP connect) works through user-space sockets, and `nmap -sn` ping-sweep does not. |
| **SQLMap end-to-end** | Same — point at an in-app deliberately-vulnerable HTTP target we host. SQLMap is HTTP-only and does not need raw sockets, so it works inside WebVM. |
| **Web app exploitation** (ffuf, dirb, Hydra HTTP, Burp-like manual probes) | All HTTP-only — fine through Tailscale exit node. |
| **Recon scripting** (`whois`, `dig`, OSINT API queries) | Works via Tailscale exit node. |

### What does NOT fit (❌ keep on the VirtualBox path from item 15)

| Drill family | Why not |
|--------------|---------|
| **Packet sniffing** (Wireshark, tcpdump capture) | No promiscuous interface; no kernel pcap. |
| **Raw-socket attacks** (Scapy SYN floods, ARP spoofing, custom L2/L3 packets) | No `SOCK_RAW` in browser sandbox. |
| **Wireless** (aircrack-ng, Wi-Fi handshake capture, Bluetooth) | No radio hardware exposed to the browser. |
| **MITM / DoS / session hijack at the network layer** | Same as above — no L2 access. |
| **Metasploit reverse shells / pivoting** | Listener can't bind a public port from the browser. (You could pivot *into* the user's Tailnet, but that's outside CEH lab scope.) |
| **Kernel exploitation** (LPE drills, kmod loading) | Linux *syscall emulator*, not a real kernel — exploits don't target real kernel structs. |

### Our deployment

**Live:** [https://saharbarak.github.io/ceh-webvm/](https://saharbarak.github.io/ceh-webvm/) — fork at [`SaharBarak/ceh-webvm`](https://github.com/SaharBarak/ceh-webvm).

Custom Debian/i386 disk image baked with:
- `nmap`, `sqlmap`, `hydra`, `john`, `dirb`, `gobuster`, `ffuf`, `whois`, `dnsutils`, `gdb`, `strace`/`ltrace`, `openssl`, `python3` + apt-prebuilt `cryptography`/`impacket`/`requests`/`bs4`/`lxml`
- `/home/user/cehprep/drills/` — 4 graded drills (day 01 / 03 / 10 / 13)
- `/usr/local/bin/drill` — local CLI runner

Build/deploy details, build gotchas, and re-trigger recipe are in [`SaharBarak/ceh-webvm`](https://github.com/SaharBarak/ceh-webvm) and the project memory (`webvm-fork.md`).

### Recommended app integration

1. **Embed a "Practice Terminal" widget** on every day's lesson page — `<iframe src="https://saharbarak.github.io/ceh-webvm/" />`. Each lesson can pass a query/fragment that the WebVM page can read to deep-link into a specific drill.
2. **Per-drill seed state**: the disk image ships under `/drills/dayNN/<slug>/` so a drill can `cd /drills/day10/sqli-1 && cat README` to bootstrap context. Persistence is IndexedDB, so user state is per-browser-profile.
3. **Drill verification**: each drill ends with `./check` (a local script that grades the user's work) plus an optional `submit` that POSTs a one-line hash to our backend so the user's progress (Pro tier) syncs across devices. The check script is local, so the user can run it offline and Tailscale isn't required.
4. **Network-bound drills**: when a drill needs network (SQLMap against a target), bind it to an in-app endpoint we host. The browser tab can fetch our endpoint via the WebVM-side `curl` once a Tailscale-style exit node is wired up *or* via a simpler fetch shim we expose to the WASM guest. Document this clearly so the user understands the network rules.
5. **Day 1 onboarding**: present WebVM as the **default** lab, and [VirtualBox + Kali from item 15](./15-build-hacking-lab-30min.md) as the **graduate** lab for drills that need raw sockets / wireless / sniffing. This is the right asymmetric default — most students never finish the VirtualBox setup, and WebVM means they don't have to in order to start drilling.

### Open questions to validate before shipping

- **License compatibility** for embedding a self-hosted WebVM disk image alongside our Pro-tier paywalled lessons — Apache-2.0 on the WebVM source is permissive, but any pre-installed proprietary tooling we add to the disk image needs its own license review.
- **CheerpX commercial-use terms** — CheerpX (the WASM JIT) is dual-licensed; verify the Apache-2.0 path covers our use or whether the Pro tier crosses into commercial-licensing territory.
- **Tailscale exit-node cost / scaling** — every drill that needs network goes through our exit node. If we hit 1000 Pro users, we need a sized Tailscale plan or our own exit-node fleet.

## Tools / keywords

WebVM · CheerpX · Leaning Technologies · WebAssembly · x86→WASM JIT · Debian-in-browser · Alpine/Xorg/i3 graphical variant · Tailscale exit node · IndexedDB-backed virtual disk · GitHub Pages self-host · Apache-2.0 · client-side sandboxed Linux · MCP "Claude AI Integration" (README section name, not yet detailed in our notes)
