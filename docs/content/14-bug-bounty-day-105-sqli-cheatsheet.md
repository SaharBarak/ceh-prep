# 14 — Day 105 of Bug Bounty: SQLi Cheatsheet & AI Prompt

- **Source:** Instagram reel — https://www.instagram.com/reel/DVT_YVYklNR/
- **Author:** [@someonenamenicky](https://instagram.com/someonenamenicky)
- **Shared:** 2026-05-18
- **Duration:** 58s
- **GitHub repos:** the creator references "my GitHub" for an AI prompt — handle not on-screen in the sampled frames (creator's profile bio likely holds the link)
- **External links:** none captured directly

## Caption

> Day 105 of doing bug bounty

## Audio transcript (whisper, lightly cleaned)

> Day 105 of doing bug bounty. I found this insane bug-bounty cheatsheet made by this guy "Cyrex Maximus" — the cheatsheet is super detailed. If you want to know about SQL injection you can see they also provide types of SQL and how to find it — it's really useful. So today I found another vulnerability in a blockchain company by using this AI prompt that I have made — you can check it out in my GitHub. I did a lot of finance stuff so… in the ID notification, if you're on the 18 you don't have to do it, you just need your parents to sign it. But tomorrow I'm going to explain the bug in the blockchain company — in another blockchain company — so you can learn from it maybe. So yeah, see you guys in day 106.

Whisper transcribed "Cyrex Maximus" — likely a community-maintained pentest/SQLi cheatsheet author (no canonical mapping confirmed in this content alone).

## On-screen content (OCR)

The reel screen-shares a SQL-injection cheatsheet that includes blind / time-based payload templates. Recovered fragments:

- Vulnerability categories visible in the table of contents:
  - **SQL** (with sub-types — error-based, blind, time-based)
  - **File Upload**
  - **DoS**
  - **Reset Password vulnerability**
  - **Rate-limit bypass**
  - **Signup Page (firstname / lastname)**, **Login (username parameter)** — vector locations
- Payload snippets (time-delay SQLi probes):
  ```
  ');waitfor delay '0:0:5'--
  ');waitfor delay '0:0:5'--
  ));waitfor delay '0:0:5'--
  or sleep(5)=...
  (SLEEP(99*(14-(5-2))))
  pg_sleep(12)
  ```
- Operational tip recovered: `Use --random-agent` (an SQLMap flag — see [04](./04-sqlmap-workflow.md))
- Workflow note: *"Save file with this name and upload it to site"* (file-upload bypass section)

## Tools / keywords

Bug bounty journaling · SQL injection cheatsheet (`UNION` / time-based / blind) · `WAITFOR DELAY` · `pg_sleep` · `SLEEP()` · file-upload bypass · rate-limit bypass · password-reset abuse · custom AI prompt for vuln discovery · blockchain / DeFi pentesting target
