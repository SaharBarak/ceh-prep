# Curriculum Map — Premium Content ↔ CEH v13 Curriculum

Each premium-content item in `docs/content/` is mapped to the most relevant day of the 14-day CEH v13 core curriculum. When the app-side curriculum module (`app/src/lib/content/days.ts`, planned in `.planning/PROJECT.md`) is built, it should read `bonusContent` slugs from this map.

> Mapping is **advisory** — most items enrich multiple days. The "Primary day" column is the canonical anchor; "Also relevant on" lists secondary days where the content can be surfaced as related material.

## CEH v13 Day Reference

The 14-day curriculum aligns with CEH v13 modules:

| Day | Module / Theme |
|-----|----------------|
| 01 | Foundations · Lab setup · Hacking phases |
| 02 | Footprinting & reconnaissance |
| 03 | Scanning networks (Nmap) |
| 04 | Enumeration |
| 05 | Vulnerability analysis |
| 06 | System hacking · privilege escalation |
| 07 | Malware threats · sniffing |
| 08 | Social engineering · DoS · session hijacking |
| 09 | Web servers · web applications |
| 10 | SQL injection |
| 11 | Wireless networks · mobile · IoT/OT |
| 12 | Cloud computing |
| 13 | Cryptography |
| 14 | Exam simulator · review |

## Mapping Table

| # | Item | Primary day | Also relevant on |
|---|------|-------------|------------------|
| 01 | [Claude prompts for cybersecurity](./01-claude-prompts-cybersecurity.md) | 14 (review / workflows) | 01, 06, 09, 12 |
| 02 | [32 OSINT search engines](./02-osint-search-engines.md) | **02 (footprinting & recon)** | 03, 05 |
| 03 | [Python offensive-security libs](./03-python-offensive-security-libs.md) | **06 (system hacking)** | 03, 07, 10 |
| 04 | [SQLMap workflow](./04-sqlmap-workflow.md) | **10 (SQL injection)** | 09 |
| 05 | [IG post DWX1Jk1k-UK](./05-ig-post-DWX1Jk1k-UK.md) | *(login-walled — to map after recovery)* | — |
| 06 | [IG post DXqo18qlCRm](./06-ig-post-DXqo18qlCRm.md) | *(login-walled — to map after recovery)* | — |
| 07 | [Bug bounty platforms](./07-bug-bounty-platforms.md) | 14 (career / next steps) | — |
| 08 | [SigDigger SDR analyzer](./08-sigdigger-sdr.md) | **11 (wireless · IoT/OT)** | 02 |
| 09 | [HexStrike-AI MCP platform](./09-hexstrike-ai.md) | 14 (AI-augmented workflows) | 05, 06, 09, 10 |
| 10 | [GhostTrack OSINT CLI](./10-ghosttrack-osint.md) | **02 (footprinting & recon)** | 08 (social engineering) |
| 11 | [Apocalypse AI — local LLM pentesting](./11-apocalypse-ai-local-llm-pentest.md) | 14 (AI-augmented workflows) | 06, 09 |
| 12 | [FB share — server hardening](./12-fb-server-hardening.md) | 09 (web servers) | 01, 05 |
| 13 | [hackingtool — 185+ tool launcher](./13-hackingtool-menu-launcher.md) | **01 (lab setup)** | every day (tool reference) |
| 14 | [Bug bounty day 105 — SQLi cheatsheet](./14-bug-bounty-day-105-sqli-cheatsheet.md) | **10 (SQL injection)** | 09, 14 |
| 15 | [Build hacking lab in 30 minutes](./15-build-hacking-lab-30min.md) | **01 (foundations & lab setup)** | — |
| 16 | [WebVM — Linux CLI in browser](./16-webvm-browser-linux.md) | **01 (foundations & lab setup)** | every day where the drill is HTTP/script-only (02, 03 flag-drill, 05, 06, 09, 10, 13, 14) |

## WebVM drills available

The companion fork [`SaharBarak/ceh-webvm`](https://github.com/SaharBarak/ceh-webvm) ships a custom Debian/i386 disk image with these drills preloaded under `/home/user/cehprep/drills/`. Each is graded locally by `./check` (no network required).

| Day | Drill slug | What it teaches |
|-----|------------|-----------------|
| 01 | `day01-foundations/01-grep-the-flag` | `grep -r` / `find` against decoy noise to locate `FLAG{...}` |
| 03 | `day03-scanning/01-nmap-flags` | Map scan-intent to the right `nmap` flag combinations (8 questions) |
| 10 | `day10-sqli/01-payload-anatomy` | Authentication bypass / blind / time-based / UNION SQLi payloads (6 questions) |
| 13 | `day13-crypto/01-rot-and-base` | Identify + decode ROT13, ROT47, Base64, Base32, hex (randomized each run) |

Inside the WebVM, the runner is:

```
drill list                        # show every drill
drill start day10 01              # open a specific drill
drill check                       # grade your current drill
drill next                        # advance to the next drill
drill status                      # passed N / total M
```

When the app embeds the WebVM, the per-day lesson page should deep-link to the matching drill, e.g. an iframe pointing at `https://saharbarak.github.io/ceh-webvm/#cmd=drill%20start%20day10%2001`.

## Consumption shape (for the app)

When `days.ts` is built, each `Day` should grow a `bonusContent` array of slugs:

```ts
// app/src/lib/content/days.ts (planned)
import type { BonusContentRef } from "./types";

export const days = [
  {
    id: 1,
    title: "Foundations & Lab Setup",
    // ...quiz, lab, etc.
    bonusContent: [
      { slug: "15-build-hacking-lab-30min", primary: true },
      { slug: "13-hackingtool-menu-launcher", primary: false },
    ] satisfies BonusContentRef[],
  },
  // ...
];
```

The build pipeline should:
1. Read each `docs/content/NN-*.md`
2. Parse the top-of-file frontmatter / "Curriculum mapping" line for the primary day
3. Generate `bonusContent` arrays automatically — no manual sync needed
