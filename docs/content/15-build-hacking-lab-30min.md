# 15 — Build Your Hacking Lab in 30 Minutes

- **Source:** Instagram carousel — https://www.instagram.com/p/DYWweo0CZoT/
- **Author:** [@trickyhash](https://instagram.com/trickyhash) — [hackproofhacks.com](https://hackproofhacks.com)
- **Posted:** 2026-05-15
- **Media:** 9-slide image carousel (no audio)
- **GitHub repos:** none (canonical project URLs below)
- **External links:**
  - VirtualBox — https://www.virtualbox.org/wiki/Downloads
  - Kali Linux — https://www.kali.org/get-kali/ (and `#kali-virtual-machines` for the pre-built VBox image)
  - Metasploitable 2 — https://sourceforge.net/projects/metasploitable
  - Author's video walkthrough — https://youtube.com/@trickyhash (full step-by-step)
- **Curriculum mapping:** **CEH v13 Day 01 — Foundations & Lab Setup** (see [CURRICULUM-MAP.md](./CURRICULUM-MAP.md))

## Caption

> 😅 You don't need a huge setup to start hacking… you just need to start.
>
> Build your own hacking lab in 30 minutes and begin practicing ethical hacking, cybersecurity, and pentesting the right way. 💻
>
> Comment **LAB** if you want the setup guide 👇

`#ethicalhacking #cybersecurity #hackinglab #pentesting #infosec`

## Slide-by-slide

### Slide 1/9 — Cover

> **BUILD YOUR HACKING LAB IN 30 MINTS**

Four pillars highlighted on the cover:
- **Free** — all tools
- **Kali** — Linux distro
- **VBox** — VirtualBox
- **Safe** — isolated

### Slide 2/9 — Prep: What You Need

> *Minimum specs to run a full hacking lab*

You don't need a beast machine. A mid-range laptop from 2018 onwards is enough. The entire lab runs inside virtual machines — isolated from your host OS.

| Requirement | Value | Note |
|-------------|-------|------|
| RAM | **8 GB minimum** | 16 GB ideal — lets you run 2 VMs at once for attack/defense labs |
| Disk | **50 GB free** | Kali ISO is 4 GB, the installed VM takes ~25 GB |
| BIOS | **Virtualisation enabled** | Intel VT-x or AMD-V — usually on by default on modern machines |
| Host OS | **Windows, macOS, or Linux** | VirtualBox runs on all three — your current OS stays untouched |

### Slide 3/9 — Step 1: Install VirtualBox

> *The engine that runs your virtual machines — 100% free*

VirtualBox is an open-source hypervisor. It lets you run an entire operating system inside a window on your screen. What happens in the VM stays in the VM — your host machine is safe.

- **Tool:** VirtualBox 7.x — https://www.virtualbox.org/wiki/Downloads
- **Size:** ~110 MB · **Platforms:** Windows / macOS / Linux

Verify virtualisation is enabled and check version:

```bash
# Verify virtualisation is enabled (any number above 0 means you're good)
egrep -c '(vmx|svm)' /proc/cpuinfo
# → 4

# After install — check version
VBoxManage --version
# → 7.0.12r159484
```

Tags on the slide: `~5 minutes` · `Free forever` · `All platforms`

### Slide 4/9 — Step 2: Download Kali

> *The hacker's operating system — 600+ preinstalled tools*

Kali Linux is built by Offensive Security specifically for penetration testing. It comes with every tool you need — Nmap, Burp Suite, Metasploit, Wireshark — preinstalled and ready.

- **Tool:** Kali Linux 2024.x (Installer) — https://www.kali.org/get-kali (Installer AMD64)
- **Size:** 4.0 GB — verify SHA256 after download

```bash
# Pro tip: use the pre-built VirtualBox image
# No manual install — just import and boot
# https://www.kali.org/get-kali/#kali-virtual-machines

# Verify the download (always!)
sha256sum kali-linux-2024.3.iso
# a8f2c94e... ← compare with official site
```

Tags: `~10 min download` · `600+ tools` · `Debian-based`

### Slide 5/9 — Step 3: Create the VM Config

> *Set it up right the first time — these settings matter*

The right VM settings ensure Kali runs smoothly and stays isolated from your network. Use these exact values — copy them directly.

```
New VM Settings:
Name      : KaliLab-2024
Type      : Linux — Debian (64-bit)
RAM       : 4096 MB (min) — 8192 MB (ideal)
CPU Cores : 2 (or half your total cores)
Disk      : 50 GB — dynamically allocated
Network 1 : NAT       ← internet access
Network 2 : Host-Only ← lab isolation
```

Tags: `NAT = internet` · `Host-Only = lab network` · `~5 min`

### Slide 6/9 — Step 4: Boot & Install Kali

> *Follow these settings exactly during installation*

Attach the ISO to the VM, boot it, and follow the installer. These are the only settings you actually need to make a decision on — everything else can stay default.

- Select **Graphical Install** — easiest for beginners
- Language: **English** — keeps terminal commands consistent
- Hostname: **kali** — keep it simple, shows in terminal prompt
- Username: **anything you want** — don't use your real name
- Partition: **Guided — use entire disk** — no dual-boot complexity
- Desktop: **XFCE** — lightest on RAM, preferred by professionals

Tags: `~10–15 min install` · `XFCE = fastest`

### Slide 7/9 — Step 5: First Boot Setup

> *Run these commands immediately after installation*

First thing after booting — update everything. Then add the target machine. This is the essential setup every pentester does before starting any lab work.

```bash
# 1. Update all packages — always do this first
┌──(kali㉿kali)-[~]
└─$ sudo apt update && sudo apt upgrade -y

# 2. Install VirtualBox Guest Additions (fullscreen)
└─$ sudo apt install -y virtualbox-guest-x11

# 3. Verify key tools are ready
└─$ nmap --version
Nmap 7.94 — ready!
└─$ msfconsole --version
Framework 6.4.0-dev — ready!
```

Tags: `~5 min` · `Lab is live after this`

### Slide 8/9 — Bonus: Add a Target (Metasploitable 2)

> *A purposely vulnerable VM to attack safely — legally*

Metasploitable 2 is a virtual machine built to be hacked. It runs dozens of intentionally vulnerable services. Set it on your Host-Only network and your lab is complete.

- **Tool:** Metasploitable 2 — https://sourceforge.net/projects/metasploitable
- **Size:** ~900 MB — import as existing VM in VirtualBox

```
┌──────────────┐   Host-Only    ┌──────────────┐
│ KALI LINUX   │ ↔ 192.168.56.x ↔│ METASPLOITABLE│
│   Attacker   │                │   Target VM   │
└──────────────┘                └──────────────┘
```

Tags: `Legal to attack` · `Isolated network` · `30+ vulnerabilities`

### Slide 9/9 — Full Video Walkthrough

> Comment **LAB** in the comments for the complete YouTube video link.

- Full video walkthrough: *"Set Up Your Hacking Lab — Full Step by Step Guide"* — `youtube.com/@trickyhash`
- Watch the entire lab built from scratch — VirtualBox setup, Kali installation, Metasploitable targeting — in real time with no cuts.
- Slide closes with: `FULL VIDEO · ALL LINKS · CHECKLIST · FREE` and CTAs to *Follow @trickyhash* / *Save this post*.

## Tools / keywords

VirtualBox · Kali Linux 2024.x · Kali pre-built VBox image · Metasploitable 2 · NAT vs Host-Only networking · VBoxManage · Intel VT-x · AMD-V · XFCE · `sudo apt update && upgrade` · `virtualbox-guest-x11` · Nmap · Metasploit Framework (`msfconsole`) · Burp Suite · Wireshark · isolated attack/target topology · CEH v13 Module 01 prep
