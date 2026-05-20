# Security Content — Premium Bonus Library

Curated security content sourced from the "Security LLM" WhatsApp group and other channels, each analyzed into one markdown file: caption, audio transcript, on-screen text (OCR + visual review), GitHub repos, and external links. Surfaced as Pro-tier bonus material on top of the 14-day CEH v13 core curriculum.

## Source

- WhatsApp Chat – Security LLM (`_chat.txt`, 14 URLs) — items 01–14
- Direct shares — items 15+

For the CEH v13 day mapping see [CURRICULUM-MAP.md](./CURRICULUM-MAP.md).

## Index

| # | Date | Source | Author | Topic | Repo / Link |
|---|------|--------|--------|-------|-------------|
| 01 | 2026-04-08 | IG reel | @kerem.tech | 7 Claude prompts for cybersecurity engineers | — |
| 02 | 2026-04-09 | IG reel | @lky_112l | 32 OSINT / recon search engines | — |
| 03 | 2026-04-15 | IG reel | @kerem.tech | 7 Python libraries for offensive security | — |
| 04 | 2026-04-18 | IG reel | @kerem.tech | SQLMap workflow (SQLi exploitation) | — |
| 05 | 2026-04-22 | IG post | (login-walled) | — | — |
| 06 | 2026-04-29 | IG post | (login-walled) | — | — |
| 07 | 2026-05-01 | IG reel | @kerem.tech | 7 bug bounty platforms | — |
| 08 | 2026-05-03 | IG reel | @marc.kaz | SigDigger SDR signal analyzer | [BatchDrake/SigDigger](https://github.com/BatchDrake/SigDigger) |
| 09 | 2026-05-03 | IG reel | @rgsecurityteam | HexStrike-AI MCP cybersecurity platform | [0x4m4/hexstrike-ai](https://github.com/0x4m4/hexstrike-ai) |
| 10 | 2026-05-11 | IG reel | @github_unpacked | GhostTrack OSINT CLI | [HunxByts/GhostTrack](https://github.com/HunxByts/GhostTrack) |
| 11 | 2026-05-11 | IG post | @cyberv1k1ng | Apocalypse AI — local-LLM pentesting | — |
| 12 | 2026-05-13 | FB share | (login-walled excerpt) | Server hardening / config security | — |
| 13 | 2026-05-16 | IG reel | @github_unpacked | hackingtool — 185+ pentest tool launcher | [Z4nzu/hackingtool](https://github.com/Z4nzu/hackingtool) |
| 14 | 2026-05-18 | IG reel | @someonenamenicky | Bug bounty day 105 — SQLi cheatsheet usage | — |
| 15 | 2026-05-15 | IG carousel (9 slides) | @trickyhash | Build your hacking lab in 30 minutes (VirtualBox + Kali + Metasploitable 2) | — |
| 16 | 2026-05-15 | FB reel | Niyitech | WebVM — full Debian Linux CLI inside a browser tab | [leaningtech/webvm](https://github.com/leaningtech/webvm) |

## Pipeline

Each video was processed with:
- **yt-dlp** — video + caption + metadata
- **ffmpeg** — audio extraction + keyframe sampling
- **whisper.cpp (ggml-base)** — audio transcription
- **tesseract** — frame OCR
- **Claude (vision)** — frame review to recover URLs the OCR mangled
