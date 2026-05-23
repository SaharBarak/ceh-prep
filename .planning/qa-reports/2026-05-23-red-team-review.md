# Red-Team Review — CEH Prep (14-day v13 sprint)

**Reviewer:** Working red-teamer, evaluated 2026-05-23 against live dev server + repo.
**Scope reviewed:** landing page, `app/src/lib/content/days.ts` in full (1203 lines, 14 days, ~52 quiz questions), four bonus articles (HexStrike-AI, SQLMap workflow, OSINT engines, hackingtool launcher, WebVM, day-105 SQLi cheatsheet, Python libs, Apocalypse AI), the `ceh-webvm` Dockerfile + four drill scripts, the exam runner (`app/src/app/(app)/exam/exam-runner.tsx`), the pricing page, and the curriculum map (`docs/content/CURRICULUM-MAP.md`).

---

## TL;DR — Verdict

**Soft no for a junior who wants to "pass CEH and get into red-teaming."**

- **As a CEH-pass aid:** decent. Well-structured exam-vocabulary trainer; the `why` field on every quiz answer is genuinely above the bar for prep products. Probably gets you over the 70% mark if you do the work.
- **As "the bridge from CEH to red-teaming":** no. The curriculum is faithful CEH v13 boilerplate. CEH content is already 5+ years behind real tradecraft; this product mirrors it faithfully instead of fixing it. A junior who finishes this will still need a separate path (HTB Academy CRTP/CRTE, TCM PNPT, OffSec PEN-200) before they can do an internal AD engagement without embarrassing themselves.
- **The lab is a real strength but it's oversold.** It is a Debian shell in a tab with `nmap` + `sqlmap` apt-installed. It is **not** a place where you "do real exploitation" — no raw sockets (so no SYN scans, no real Nmap, no Scapy, no ARP, no MITM), no kernel access (so no LPE drills), no listener binding (so no payloads, no shells back, no Metasploit). The 4 drills are paper exercises that grade `answers.txt` text. The product narrative implies more than what's shipping.
- **Marketing is mostly honest, with three specific overpromises** flagged below.

If the product owner shipped two things — (a) a single AD-attack module with BloodHound and a Kerberoast/AS-REP drill, and (b) cut the "real nmap, sqlmap, hashcat" line down to "real CLI muscle memory for exam fluency" — I'd flip to soft-yes for CEH passers. To recommend for red-team aspirants you need a different curriculum entirely.

---

## Technical Accuracy — what's right, what's dated, what's wrong

### What's actually correct and well-written

These are not throwaway compliments — they're the parts I'd defend to a peer:

- **`days.ts:73-87`** — the "color hat" question is framed exactly right: authorized + scope-respecting = white-hat *regardless of how aggressive the technique looks*. Most prep products parrot the textbook lie that white-hat means "non-destructive." This one doesn't.
- **`days.ts:131-141`** — the recon lesson opens with "do as much as possible without sending the target a single packet." That's a real-engagement instinct, not a textbook line.
- **`days.ts:282-336`** — the Nmap module correctly explains that `-sS` needs raw sockets and won't work in user-space (which is exactly why WebVM can't run it). The drill (`day03-scanning/01-nmap-flags/README.md:25-30`) is honest about this: "the kernel does not expose raw sockets, so SYN scans will not actually fire packets — but the flags are still the right answer for the exam." That's the right disclosure.
- **`days.ts:739`** — calling out SSRF → IMDS at `169.254.169.254` → IAM creds → full account compromise. That chain is the single most realistic cloud finding of the last 5 years and it's named explicitly with the right path (`/latest/meta-data/iam/security-credentials/`).
- **`days.ts:594-597`** — the AI-augmented malware concept card (polymorphic per-compile binaries, automated phishing-lure authoring, signature → behavior detection shift) is a current-as-of-2024 framing, not a 2018 one.
- **`days.ts:746-750`** — prompt injection split into direct vs indirect, with the right mitigation framing ("defense-in-depth — sandbox tool calls, content-type isolation of retrieved data, output filtering"). Most CEH prep products either ignore LLM threats or hand-wave them. This one names the real attack surfaces.
- **`days.ts:1052-1062`** — the crypto module recommends AES-GCM as default, Argon2id for password hashing, and ephemeral DH for PFS. That's the modern answer set; many prep products still teach CBC + bcrypt-only.

### What's dated, sanitized, or textbook-flavored

These are the gaps a working red-teamer notices in the first pass:

- **No Active Directory tradecraft. At all.** `days.ts` mentions NTLM and pass-the-hash exactly once (Day 6, `days.ts:519-522`) as a one-line concept card. There is no Kerberos, no Kerberoasting, no AS-REP roasting, no BloodHound, no DCSync, no constrained/unconstrained delegation, no resource-based constrained delegation (RBCD), no ADCS abuse (the ESC1–ESC8 family is the dominant 2023–2025 finding in real internals), no NTLM relay. This is by far the biggest gap. CEH v13 itself underweights AD, but a product positioning as a bridge to red-teaming should not. ([curriculum gap analysis](#curriculum-gap-analysis) below.)
- **`days.ts:489-558` — System Hacking is stuck in 2015.** PtH, SUID, LinPEAS, WinPEAS, GTFOBins. All correct, all useful, none of it touches what actually matters on a 2025 engagement: AMSI bypass classes, ETW patching, parent-PID spoofing, syscall-direct calls (Syswhispers/Halos Gate), unhooking ntdll, BOFs, Cobalt Strike alternatives (Sliver, Havoc, Mythic, Brute Ratel), or even named-pipe impersonation. The exam doesn't ask any of this; the world does. If the product is just exam prep, fine. If it's a red-team on-ramp, this is the cliff.
- **`days.ts:563-598` — "Malware Threats & Sniffing" conflates two unrelated modules and the malware half is pure taxonomy.** Virus/worm/trojan/RAT definitions are 1998 content. Modern malware analysis is YARA + sandboxing + EDR telemetry chains. There's nothing here about modern loader patterns (DLL sideloading + side-by-side assembly abuse, COM hijacking, signed-binary proxy execution / "LOLBins"). LOLBins are not mentioned anywhere in the curriculum. That's a striking omission — `lolbas-project.github.io` is a primary daily reference for any red-teamer.
- **`days.ts:702-786` — Web app module is OWASP-Top-10-shaped, which is the canonical textbook framing.** It's fine for the exam. Missing from a red-team lens: modern auth-bypass classes (OAuth open-redirect chains, JWT alg-confusion / `none` algorithm / kid path traversal, SAML signature wrapping, OIDC redirect_uri abuse), HTTP request smuggling (CL.TE, TE.CL, TE.TE — the most consequential web class of the last 5 years), prototype pollution, JS sink → DOM XSS chains, GraphQL introspection abuse. The `LLM-INJ` card (`days.ts:746-750`) is good; the rest is 2017.
- **`days.ts:891-952` — Wireless/mobile/IoT/OT.** WEP is dead, WPA2 PMKID + handshake, WPA3 SAE + Dragonblood — that's all correct. But OT/SCADA in 2025 means Modbus over TCP/IP exposed on internet via Shodan, S7comm replay, and **the ransomware story**: Industroyer2, INCONTROLLER/PIPEDREAM. The module mentions Modbus has no auth — true — but doesn't surface that *the operational reality is that pentesters in OT engagements are mostly recon-only because actually probing kills SCADA processes*. That's the load-bearing lesson; "Modbus has no auth" is trivia.
- **`days.ts:954-1027` — Cloud module is the strongest of the dated modules.** IMDS at 169.254.169.254 is correctly named, S3 misconfig is correctly named, K8s pod-priv-true escape is correctly named. Missing: cross-account assumed-role lateral movement, GCP impersonation chains (often more potent than IAM misconfig because GCP impersonation is per-call rather than session-based), Azure AD device code phishing, the "Pacu vs scoutsuite" tooling distinction, IAM Access Analyzer abuse. The cloud module is the easiest one to bring forward — a single bonus article on **cloud lateral movement (assume_role → IMDS → cross-tenant)** would close half the gap.
- **`days.ts:421-433` — CVSS lesson includes the line "CVSS scores age. CVE-2017-0144 (EternalBlue) is still 8.1 critical even though it's old."** Minor: this is a subtle teaching error. CVSS *base* score doesn't decay by design — that's the right thing to say. But "still critical even though it's old" misframes the issue: the right framing is *temporal* and *environmental* scores exist precisely to capture decay (exploit availability, remediation level). The current text is exam-correct but conceptually muddled.
- **`days.ts:170-228` — Footprinting module names crt.sh, Shodan, GreyNoise — good — but omits the modern free-tier recon stack** that any junior actually uses on day one: `subfinder`, `httpx`, `nuclei`, `katana`, `gau` (ProjectDiscovery's stack); `amass`; `chaos-client`; `getJS`. The bonus article (#02 OSINT search engines, `docs/content/02-osint-search-engines.md`) lists 32 search sites but none of the CLI-driven recon framework. That's exactly backwards from what a working recon operator does — search engines are the slowest path; pipeline tools are the fast path.

### What's overstated or misleading

- **Marketing claim:** "real `nmap`, `sqlmap`, `hashcat`" (`app/src/app/page.tsx:81-83`). **Reality:** `sqlmap`, `nmap`, `hydra`, `john`, `dirb`, `gobuster` are apt-installed (verified in `~/personal/ceh-webvm/dockerfiles/cehprep:36-42`). `hashcat` is **explicitly cut** from the disk image (`dockerfiles/cehprep:33`: "hashcat — ~100 MB. john alone covers the crypto drills for now"). Listing it on the landing page is false. Also dropped: `tshark`/wireshark, `radare2`, `binwalk`, `nikto`, `pwntools`. The same landing block calls out `hashcat` by name; the pricing page (`/pricing`) lists "nmap, sqlmap, hydra, john, gobuster, gdb" without hashcat — pricing is honest, landing is not. **Fix:** strip `hashcat` from the hero copy.
- **Marketing claim:** "exam simulator that mirrors the real CEH v13 pacing — 4-hour ceiling, 70% pass threshold" (`page.tsx:175`) and "125-question timed exam simulator" (`pricing` page, `/pricing` text dump line "Domain-weighted timed exam simulator (125 q · 4 h)"). **Reality:** the simulator pulls from the actual bank of ~52 questions across days 1-13 (`days.ts:1119-1121` says so explicitly: "the question bank grows as the curriculum does — today's simulator uses every question we've published, not yet the full 125-question count"). The simulator UI shows the count but the underlying pool is ~52. That disclosure on the lesson page is honest. The pricing page is **not** — "125 q · 4 h" reads as "125 questions" when it's "up to 125, sourced from a 52-question bank." Domain-weighting is also implied but I don't see weighting logic in `app/src/lib/exam/builder.ts` from the runner side (would need to verify; the per-day breakdown in `exam-runner.tsx:402-435` shows uniform sampling output). **Fix:** the pricing-page line "125 q · 4 h" should read "current bank: ~52 q · 4 h timer" until the bank is genuinely larger.
- **Marketing claim:** "hit 70% on the Day-14 sim or we refund the month" (`page.tsx:117-119`, `/about` page also). **Reality:** this is a defensible pass-rate guarantee for a self-graded simulator drawing from the same content the user just studied. The simulator IS the post-test of the curriculum. Hitting 70% on it is highly predictable for any student who completed the modules; it does *not* strongly predict 70% on the real CEH (different question pool, different psychometrics, different stress). The claim "clearing it on our simulator is the strongest predictor of clearing it for real" (`page.tsx:443-446`) is unsubstantiated — there's no data behind "strongest." **Fix:** soften to "a useful predictor" or "the closest practice you can do," not "the strongest predictor." Best in class would be a small published correlation study after first 100 paying customers.
- **Marketing claim:** "Pass the CEH without the course-ware slog" (`page.tsx:71-75`). **Reality:** the curriculum is ~30 min/day × 14 days = ~7 hours of lesson reading plus quiz time. The official EC-Council courseware is ~40 hours. *This claim is the strongest part of the marketing.* Defensible and probably true.

### The four "graded drills" — what they actually are

Verified contents:

- **`day01-foundations/01-grep-the-flag`** — `grep -rE 'FLAG\{[^}]+\}' challenge/` against decoy files. Legitimate beginner Linux exercise. Honest.
- **`day03-scanning/01-nmap-flags`** — paper drill, 8 scenarios, user writes commands into `answers.txt`, grader compares text. README is explicit that "the kernel does not expose raw sockets, so SYN scans will not actually fire packets — but the flags are still the right answer for the exam." Honest, but it's *flag fluency*, not scanning practice.
- **`day10-sqli/01-payload-anatomy`** — six SQLi fragments, user writes payloads into `answers.txt`, grader normalizes whitespace and accepts equivalents (e.g. `' OR 1=1 --` ≈ `' OR '1'='1' --`). Solid for muscle memory; not exploitation.
- **`day13-crypto/01-rot-and-base`** — ROT/Base/Hex decode drill. Fine for CTF intro; not crypto attack practice.

The drills are **CEH-exam-pattern drills**, not hacking labs. The landing page calls them "graded lab drills" (`page.tsx:131`) which is technically true but reads as "you'll attack things." You won't.

---

## Curriculum Gap Analysis — what's missing that a junior pentester actually needs

Ordered by "what makes a junior unhireable" → "nice to have":

### Tier 1 — load-bearing gaps for any pentest job, missing entirely

1. **Active Directory attack tradecraft.** Kerberos (TGT/TGS), Kerberoasting (`GetUserSPNs.py`), AS-REP roasting (`GetNPUsers.py`), AD CS abuse (Certipy: ESC1, ESC4, ESC8 — the dominant 2024 internal finding), DCSync (secretsdump), unconstrained/constrained delegation, RBCD, LAPS extraction, BloodHound (collection → analysis → path enumeration). Currently: one line about NTLM PtH. **Cost to add: one well-written day, or a 3-article bonus track.** Without this, the product is not a red-team on-ramp.
2. **LOLBins / living-off-the-land binaries.** `lolbas-project.github.io` is the daily reference. `rundll32`, `regsvr32`, `mshta`, `wmic`, `certutil`, `bitsadmin`, `installutil`, signed-binary proxy execution. Not mentioned anywhere in `days.ts`. This is *the* defining shift in offensive tradecraft post-2015.
3. **EDR / behavioral detection awareness.** Modern Windows systems run Defender for Endpoint, CrowdStrike, SentinelOne, Carbon Black. A junior pentester who doesn't know what AMSI is, what ETW is, what the hashing-of-known-malicious-binaries pipeline does, will get burned on every engagement. The curriculum has zero EDR content. Even a single "what defenders see" page would help.
4. **Command & Control basics.** Cobalt Strike's licensing changes pushed practitioners to Sliver, Havoc, Mythic, Brute Ratel. The curriculum doesn't mention C2 frameworks at all (the closest is one line about Metasploit reverse shells in `days.ts:107`). For a learner, the question "what does a beacon do, why isn't it just a reverse shell" is a defining one.

### Tier 2 — present in the curriculum but treated as trivia rather than tradecraft

5. **Privilege escalation on Windows is one paragraph.** `days.ts:502-504` mentions unquoted service paths, AlwaysInstallElevated, DLL hijacking. No example. No drill. PowerUp/PrivescCheck/WinPEAS are name-dropped without explanation. *PrintNightmare, PetitPotam, the certificate-coercion family* — all dated by CVE but conceptually critical — aren't there.
6. **HTTP request smuggling.** The single most consequential web class since 2019. Not mentioned.
7. **JWT / OAuth / SAML auth bypasses.** Not mentioned. The Day 9 web module references "credential stuffing" and "weak session management" but not modern auth-token attacks.
8. **Container escapes.** Day 12 mentions K8s `privileged: true` escape in one bullet. No mention of Docker socket exposure, capabilities (`CAP_SYS_ADMIN`), runc CVEs, K8s namespace traversal via service-account tokens beyond a one-line allusion.
9. **Process injection techniques.** Classic DLL injection, reflective DLL injection, process hollowing, APC injection, NtMapViewOfSection. Zero coverage. This is the core "after I have a shell, how do I stay" topic.

### Tier 3 — present and well-handled, no gap

10. SQLi (Day 10) — solid coverage, including blind/time-based/UNION classes and the right defense (parameterization, not escaping).
11. Recon (Day 2) — solid, modulo the gap on CLI-driven recon frameworks noted above.
12. Crypto (Day 13) — current and correctly weighted.
13. Cloud (Day 12) — best-positioned of the dated modules. Has the right primitives, just needs one tier-up on lateral movement.

### What's present but useless for red-team work

- **Day 8 — DoS amplification factor trivia.** "Memcached is 50,000x, NTP monlist is 556x." Correct, exam-relevant, completely irrelevant to a pentester's daily work. (DoS isn't in scope on 99% of engagements.) Fine for the exam; should not be sold as red-team prep.
- **Day 1 — the "five phases" framing.** CEH treats this as gospel. In practice, an engagement is a loop, not a pipeline. The curriculum *does* call this out (`days.ts:46-48`: "the five phases are a checklist, not a timeline; a real engagement loops through recon → scan → exploit dozens of times"). Credit for that; most prep products don't.
- **The "color hats" question class.** Black/white/gray/red-hat are pedagogically useless taxonomy questions. They're on the exam, so they're in the bank. Mark this as exam-only filler, don't claim it teaches a mindset.

---

## Marketing vs Reality — line-by-line

| Marketing claim (location) | Reality | Verdict |
|---|---|---|
| "real `nmap`, `sqlmap`, `hashcat`, not screenshots" (`page.tsx:81-83`) | `nmap`, `sqlmap`, `hydra`, `john`, `dirb`, `gobuster`, `ffuf` are real on the WebVM. `hashcat` is **cut** from the image (`dockerfiles/cehprep:33`). | **Overstated** — strip `hashcat`. |
| "A graded Debian shell in your tab" (`page.tsx:161`) | True. Real Debian, real shell, drills exist. | **Honest.** |
| "4 graded lab drills" (`page.tsx:131`) | True. The drills are paper-equivalents — text grading, not exploitation. The README on `day03` is honest about this. The marketing page implies "lab" in the hacking sense; it's actually "drill with `./check` script." | **Half-honest.** |
| "125-question timed exam simulator" (`/pricing`) | Bank is ~52 questions today (`days.ts` totals: 5+5+5+3+3+3+3+3+3+5+3+3+5+3 = 51 questions in 14 days). The Day 14 module text (`days.ts:1119-1121`) discloses this honestly inside the course. The pricing page does not. | **Pricing-page line is misleading; lesson copy is honest.** Fix the pricing line. |
| "70% pass guarantee — clearing it on our simulator is the strongest predictor of clearing it for real" (`page.tsx:443-446`) | The simulator IS the post-test of the same content. Hitting 70% on it is high. Whether it predicts the actual CEH is unsubstantiated. | **The guarantee structure is fine; the "strongest predictor" claim is not.** |
| "$30/mo Pro · cancel anytime" (`/pricing`) | True per the pricing page. Paddle integration is gated ("Billing opens once Paddle integration ships (Phase 4). Sign up free now; we'll email when Pro checkout is live.") | **Honest about not-yet-shipping.** |
| "Built by Sahar Barak — solo. No marketing team writing the copy, no SEO contractor stuffing keywords, no AI generating the curriculum." (`/about`) | The curriculum quality varies but the strongest sections (the `why` fields, the PtH-IS-the-credential line, the IMDS chain, the LLM injection card) read as human-written and informed. I would believe this claim. | **Plausible.** |
| "Pass the CEH without the course-ware slog" (hero) | 7 hours vs 40 hours, with structured quiz + explanations. Defensible. | **Honest.** |

---

## Bonus library — quality spread

I read 8 of the 16 markdown bonus articles. The set is wildly inconsistent:

- **Genuinely strong:** `docs/content/16-webvm-browser-linux.md` (the drill-fitness assessment is honest and complete — every column matters, the "what does NOT fit" section is exactly the right framing); `docs/content/04-sqlmap-workflow.md` (real workflow, real flags, useful for bug-bounty triage); `docs/content/02-osint-search-engines.md` (the link list is solid even if it omits CLI tools); `docs/content/03-python-offensive-security-libs.md` (Scapy, Impacket, pwntools, paramiko — these are the right 7 picks).
- **Marketing-pitched but thin on real engineering:** `docs/content/13-hackingtool-menu-launcher.md` (the tool is a menu launcher; the article reads like marketing for someone else's repo); `docs/content/09-hexstrike-ai.md` (HexStrike-AI is a real project, but the article is mostly OCR-recovered IG content rather than a working assessment of whether it's actually useful on engagements).
- **Filler:** `docs/content/11-apocalypse-ai-local-llm-pentest.md` reads almost entirely as quoted IG caption with a book-plug at the end. The actual technical content is "I built a Python orchestrator for local LLMs to call pentest tools." That's 2026 LinkedIn-thought-leadership in tone, not technical content. **Cut.**
- **Hostile to the brand:** `docs/content/14-bug-bounty-day-105-sqli-cheatsheet.md`. Whisper transcript includes the line "in the ID notification, if you're on the 18 you don't have to do it, you just need your parents to sign it" — clearly an OCR/whisper artifact from someone reading random text on screen. That sentence is *unedited* in the published article. **Embarrassing — fix before any external review.**

The bonus library is sold as "curated practitioner writeups" (`page.tsx:323`). The reality is "OCR of TikTok/IG/FB reels, lightly annotated, organized by curriculum day." It's free content the author found on social — not original writeups by practitioners. The framing as "practitioner writeups" is generous.

---

## Lab Realism

A line-by-line on "do the labs mirror what you'd do on an engagement":

| Lab | What it teaches | What an engagement looks like | Honest? |
|---|---|---|---|
| Day 01 grep-the-flag | `grep -rE` against decoys | First-day Linux familiarity. | Yes — taught as Linux fluency. |
| Day 03 nmap-flags (paper) | Map intent → flag combo | You'd actually run nmap, parse XML into Metasploit's db, iterate. Paper drill is exam-style. | Yes — disclosed as "flag correctness, not execution" in the README. |
| Day 10 SQLi payload anatomy | Write payloads from intent | Real SQLi is iterative — probe, fingerprint DBMS, escalate. Paper drill is exam-style. | Acceptable — disclosed in README ("You can't really 'do' SQLi without a vulnerable backend"). |
| Day 13 crypto rot-and-base | Identify + decode transforms | Useful for CTF. Not for engagement work. | Honest scope — this is a CTF transform drill. |

There are **no live-target labs**, no DVWA-like deliberately-vulnerable services in the WebVM, no Burp-equivalent proxy capture, no Metasploitable-style internal network. The product hints at these (the WebVM article describes embedding "deliberately-vulnerable HTTP targets we host") but they're not shipped.

**For a CEH-pass aid:** this is fine and honest. CEH is a vocabulary exam; flag-fluency drills are the right shape.

**For "the bridge to red-teaming":** this is not. A junior who finishes these drills has memorized command flags. They have not exploited anything.

---

## Would I Recommend?

**To a junior on my team who said "should I buy this to pass CEH and get into red-teaming?":**

> "Buy it if you specifically want to pass the CEH and you're tired of reading EC-Council courseware. The `why` field on every quiz question is genuinely better than what other prep products ship, and the lessons are written by someone who reads as a real practitioner. Set your expectation: this is exam prep with a Debian shell, not a hacking lab.
>
> Do not buy it as your bridge to red-teaming. After CEH, you need an AD-focused track. Start with TCM PNPT (cheap, AD-heavy, runs you through Kerberoasting end-to-end), then HTB Academy Bug Bounty Hunter or CRTP/CRTE depending on whether you're going web or internal. Skip OSCP unless you have a hiring manager who specifically asks for it.
>
> If money's tight: HackTheBox Starting Point + free TryHackMe content covers ~80% of what this does, slower, with less polish, but with live targets. The differentiator is the `why` explanations and the time saved by not setting up VirtualBox. Pay for that or don't — your call."

That's the honest, no-BS, would-tell-a-friend version.

---

## What I'd change before launching

In priority order:

1. **Strip `hashcat` from the landing hero copy** (`page.tsx:81-83`). It's not on the image. This is the single false claim that an attentive reader will catch in 30 seconds.
2. **Fix the pricing-page exam-simulator line.** "125 q · 4 h" should be "current bank: ~52 q · 4 h timer" until the bank grows. Add a `target: 125q by [date]` if you want to keep the ambition signal.
3. **Edit `docs/content/14-bug-bounty-day-105-sqli-cheatsheet.md`.** The "in the ID notification, if you're on the 18 you don't have to do it…" sentence is an unedited OCR/whisper artifact. Cuttable in 60 seconds.
4. **Add one Active Directory bonus article** to close the largest curriculum gap. Suggested scope: Kerberoasting workflow (GetUserSPNs → hashcat mode 13100) + BloodHound collection (`SharpHound.exe -c All` / `bloodhound-python`) + one path-enumeration query. This single article would move the product from "CEH prep" to "CEH prep that doesn't lie about red-team relevance."
5. **Soften "strongest predictor" → "closest practice"** on the pass guarantee (`page.tsx:443-446`). The structure of the guarantee is fine; the linguistic claim isn't.
6. **Reframe "practitioner writeups" → "curated tool walkthroughs"** for the bonus library (`page.tsx:322-326`). What's there is curated tool content from social media. That's a valid product; it's just not "practitioner writeups."
7. **Optional** — add a single "what you're not getting" page or footnote. Something like: *"This is CEH v13 prep. It is not OSCP prep, not PEN-200 prep, not a red-team bootcamp. For those, see [TCM PNPT / HTB Academy / OffSec]. We will not pretend our 14-day sprint replaces those."* That kind of honesty is a moat in a market full of $30/mo "become a hacker in 14 days" products.

---

## File Citations Summary

- `app/src/lib/content/days.ts` — entire curriculum, especially:
  - `:46-48` — phases-as-checklist framing (good)
  - `:73-87` — color-hat question (good)
  - `:421-433` — CVSS lesson (minor framing issue)
  - `:489-558` — System Hacking (dated)
  - `:563-598` — Malware & Sniffing (no LOLBins)
  - `:594-597` — AI-augmented malware card (good, current)
  - `:739-744` — SSRF → IMDS chain (good)
  - `:746-750` — Prompt injection card (good, current)
  - `:1052-1062` — Crypto recommendations (good, current)
  - `:1119-1121` — Honest disclosure of exam-sim bank size (good)
- `app/src/app/page.tsx:81-83` — `hashcat` overclaim
- `app/src/app/page.tsx:443-446` — "strongest predictor" overclaim
- `app/src/app/(app)/exam/exam-runner.tsx` — solid implementation; bank-size honesty depends on `app/src/lib/exam/builder.ts` (not read in this pass)
- `app/src/lib/content/bonus.ts:64-67` — code-level honesty: explicit filter for placeholder titles from inaccessible IG/FB posts. The author has actually scrubbed bad data; the day-105 SQLi transcript artifact slipped through.
- `~/personal/ceh-webvm/dockerfiles/cehprep:33-42` — actual apt-installed tool list; ground truth for the "real X, Y, Z" marketing claim
- `~/personal/ceh-webvm/cehprep/drills/day03-scanning/01-nmap-flags/README.md:25-30` — honest "this is flag fluency, not scanning" disclosure
- `docs/content/14-bug-bounty-day-105-sqli-cheatsheet.md:16` — unedited OCR artifact, ship-blocker for external review

---

**Reviewer's final note:** The product is more honest than 80% of the "$30/mo become a hacker" market. The author is clearly a working practitioner, not a course-mill operator. That's the moat. The fixes above are mostly trim-and-correct work, not rewrites. The single product decision that matters is whether to position as "CEH pass aid" (current shape is fine) or "bridge to red-teaming" (then close the AD/EDR/LOLBin gaps before launch). Pick one.

---

## Re-review — after fix commit `56c5986`

**Delta verdict: improved — soft yes for CEH-pass positioning.** The product owner pulled every priority-1 lever and shipped the single hardest one (a credible AD article) on top. The marketing-vs-reality gap is now small enough that I'd let this product go to external launch as **CEH v13 prep with a curated post-cert track**. The "bridge to red-teaming" framing is no longer in the copy — it's been replaced with explicit scope-drawing on `/about`, which is the right call.

### Scorecard against the prior "What I'd change before launching" list

| # | Prior recommendation | Status | Evidence |
|---|---|---|---|
| 1 | Strip `hashcat` from landing hero | **PASS** | `page.tsx:80-82` now reads `nmap, sqlmap, john`. `hashcat` no longer appears anywhere in `app/src/app/page.tsx`. Live curl confirms. |
| 2 | Fix the pricing-page "125 q · 4 h" claim | **PASS** | `pricing/page.tsx:99,103` now reads `${totalQuestions}` (resolves to 64 today) followed by `bank growing toward 125` and `questions today (target: 125)`. Honest and ambition-signaling. |
| 3 | Edit `14-bug-bounty-...sqli-cheatsheet.md` whisper artifact | **PASS** | The off-topic "ID notification … parents to sign it" sentence is gone. The edit goes further than asked — adds a transparent disclosure note at line 18 explaining the trim. Reader confidence intact. |
| 4 | Add one Active Directory bonus article | **PASS** | `docs/content/17-active-directory-attack-chain.md` (190 lines). Original write-up by the product owner, not OCR. Technically sharp — see section below. Auto-indexed via `bonus.ts`'s filesystem-driven loader; live on `/bonus`. |
| 5 | Soften "strongest predictor" → "closest practice" | **PASS** | `page.tsx:454-464` rewritten end-to-end. The guarantee is now explicit: "if you finish the 14-day sprint and don't score at least 70% on our internal Day-14 simulator, email us and we'll refund the month." Followed by an inline disclaimer that this is "not a guarantee against the real EC-Council exam, which has its own question pool and psychometrics." That's exactly the right amount of honesty. |
| 6 | Reframe "practitioner writeups" → "curated tool walkthroughs" | **PARTIAL** | Landing (`page.tsx:337-340`) and pricing (`pricing/page.tsx:101`) both rewritten. **Residual:** newsletter confirmation email template `app/src/lib/infra/resend/templates/NewsletterConfirm.tsx:64` still says "a roughly-weekly digest of practitioner writeups." Minor, low-volume surface, but should be unified for consistency. |
| 7 | Optional — "what you're not getting" footnote | **PASS** | `about/page.tsx:105-133` ships a full "What this is not" section. Names OSCP, PNPT, PEN-200 as different products; explicitly states "no live exploitation, no Active Directory attack chain, no Cobalt Strike / Sliver / Mythic C2 content." This is the strongest fix in the commit. It draws the scope line in writing rather than relying on the reader to infer it. |

**Net: 6 PASS, 1 PARTIAL, 0 NO.** Every priority-1 fix landed.

### New Active Directory article (`17-active-directory-attack-chain.md`) — technical review

Read end-to-end. This is original, practitioner-grade content. Specific checks:

- **The 4-step chain framing (lines 25-42)** — AS-REP → Kerberoast → BloodHound → abuse-edge. This is the load-bearing modern internal-pentest chain. Sequencing is correct.
- **AS-REP roast (Step 1, lines 46-70)** — `UF_DONT_REQUIRE_PREAUTH` flag is correctly named. `GetNPUsers.py` unauth'd-with-userlist is correctly described. `hashcat -m 18200` is the correct mode for AS-REP etype 23 (RC4). The legacy-app-compat framing for *why* this exists is honest practitioner context, not textbook-stuff.
- **Kerberoast (Step 2, lines 74-94)** — `GetUserSPNs.py` with `-request` flag is correct. `hashcat -m 13100` with `best64.rule` is the correct mode and the right rule-file choice for SPN cracking. "Service accounts notorious for weak passwords because they're set once and forgotten" — accurate field truth.
- **BloodHound (Step 3, lines 98-127)** — `bloodhound-python -c All` for Linux + `SharpHound.exe -c All` for Windows is the correct collector pair. The shortest-path Cypher query is real BloodHound syntax. The 5 abuse-edge examples (GenericAll on OU, AddSelf, WriteDACL, ForceChangePassword, AllowedToDelegate) are the right top-5 to highlight — they cover the bulk of post-collection attack paths.
- **DCSync caveat (line 153)** — "Don't do this on a real engagement without a written report-clause covering it." Good ethics framing for a junior reader; matches what a senior would say.
- **The "what this opens up" list (lines 161-165)** — names AD CS (Certipy, ESC1-ESC11), S4U2Self/S4U2Proxy, ntlmrelayx, PetitPotam/DFSCoerce/PrinterBug, RBCD. This is exactly the right "where to go next" list for a junior. The ordering — AD CS first as "highest-frequency internal finding industry-wide" — matches what every red-team team I've worked with has said since 2022.
- **Post-CEH path (lines 167-171)** — PNPT first, HTB Academy second, OSCP only-if-required. Same recommendation I'd give a junior. Good.
- **GOAD as a local lab (line 179)** — correct project name (Orange-Cyberdefense/GOAD), correct framing as a free local AD lab.
- **The honest framing (lines 187-189)** — "This article is not on the CEH v13 exam. You don't need it to pass." Excellent scope-drawing.

**Verdict on the AD article:** I'd put my name on this. It's not a watered-down summary — it's the chain as practitioners actually run it. One nit: the article mentions `pwsafe.py` (line 137) but the canonical Impacket name is `samrdump.py` for SAM enumeration; `net rpc password` from Linux is correct via `samba-tool`/`rpcclient`. The shown `net rpc password` invocation is the right shape but typically requires `samba-common-bin`. Minor — a reader copy-pasting will figure it out from the error. Not a ship-blocker.

### Spot-check of the 12 new questions

Read each new question end-to-end against current exam blueprint and real engagement reality.

**Day 9 web-app (+5) — all PASS:**
- **Stored XSS classification** (line 820-823) — "alert fires for every user who later views" is a textbook-correct stored-vs-reflected discriminator.
- **CSRF Origin header** (line 825-834) — distractors are the right red herrings (X-Requested-With is a 2010-era pattern not a defense; HSTS protects transport, not CSRF). The `why` correctly bundles Origin + SameSite=Strict + token as the modern combo.
- **XXE payload** (line 836-845) — the correct answer is a real working external-entity payload. The wrong-answer entity declaration (line 842) is syntactically malformed in a recognizably wrong way (the `PUBLIC "yes"` form is parameter-entity syntax with bad placement) — that's the right kind of distractor for an exam question because a student who has seen real DTDs can spot it.
- **File-upload double-extension** (line 847-856) — `shell.php.jpg`/`shell.jpg.php` is the canonical mod_mime bypass. The `why` correctly diagnoses "extension-based allowlist vs handler resolution gap."
- **IDOR/A01** (line 858-862) — IDOR mapping to A01 Broken Access Control is the current OWASP Top 10 2021 placement. Correctly framed.

**Day 11 wireless/mobile-IoT (+4) — all PASS:**
- **Evil Twin** (line 1032-1036) — "same SSID + higher transmit power → clients auto-roam" is the canonical Evil Twin definition. Distractor list (WPS PIN, Karma, Deauth) is the right pool — Karma is the close-but-wrong distractor because it's the rogue-AP-with-arbitrary-SSID variant, not the same-SSID-impersonation case.
- **Captive portal credential type** (line 1038-1047) — correctly nails that the captured creds are typically AD domain creds (because the fake portal mimics corporate SSO), not the WPA2 PSK. This is a thing students get wrong.
- **MQTT without TLS** (line 1049-1058) — "subscribe to the device's topic" is the most direct attack. The `why` mentions Shodan finding tens of thousands of unauth'd brokers — real number, real attack pattern.
- **Android exported activity** (line 1060-1069) — `android:exported="true"` without permission gating IS the dominant Android client-side bug class. "Callable via intent from any other app" is the right answer.

**Day 2 recon (+2) — both PASS:**
- **Certificate Transparency for subdomain enum** (line 228-237) — correctly described as "purely passive" (no packet to target). Names crt.sh. Distractors include nmap (touches target) and AXFR (usually fails on hardened DNS) — accurate framing.
- **GreyNoise classification** (line 239-243) — correctly distinguishes GreyNoise (mass-scanning classification) from Shodan/Censys (banner search) and VirusTotal (file hash reputation). The `why` is precise.

**Day 5 system-hacking (+1) — PASS:**
- **CVSS 8.1 band** (line 508-513) — correct answer "High". The `why` lists the exact CVSS v3 band thresholds (0.1-3.9 / 4.0-6.9 / 7.0-8.9 / 9.0-10.0) and names EternalBlue as the canonical example. This question directly tests the lesson copy fix flagged in the original review.

**All 12 new questions are exam-realistic, technically correct, and distractor-engineered properly.** A junior who learns to answer these will read better on the real CEH.

### Exam simulator domain readiness — quality of the new UX

The per-domain readiness chart (`exam-runner.tsx:429-479`) and the `ConfirmSubmitDialog` (`exam-runner.tsx:534-584`) are the right shape:

- The official CEH v13 domain weights (`types.ts:62-73`) match the EC-Council blueprint reasonably (~6/21/17/14/16/6/8/6/6 = 100). The Reconnaissance domain is correctly the biggest at 21% — that aligns with the published v13 blueprint.
- The 3-band color scale (green ≥ 70%, amber 50-69%, red < 50%) matches how the real CEH score report visualizes domain performance.
- The per-day breakdown is now collapsed into a `<details>` element rather than being the primary view — a small but right UX call.
- The `ConfirmSubmitDialog` honestly tells the user "blank answers grade as wrong — the real CEH penalizes them the same way" before letting them submit with blanks. That's correct exam behavior, taught at submit time.
- Test coverage: `builder.test.ts:181-194` specifically asserts the domain-resolution logic (`question.domain ?? day.defaultDomain ?? "meta"`) and validates the Day-7 mixed-day per-question override case. 59/59 tests pass.

This isn't a band-aid fix — it's a structural feature shipped at production quality.

### CVSS lesson fix (Day 5)

`days.ts:453` was rewritten:

> Before: "CVE-2017-0144 (EternalBlue) is still 8.1 critical even though it's old."
> After: "CVE-2017-0144 (EternalBlue) is still rated 8.1 High in CVSS v3 — Critical is the 9.0+ band."

Correct fix. The new copy explicitly teaches the band threshold (which is exam material) and is paired with the matching new quiz question on line 509-513. Clean cross-reference.

### New issues introduced by the fixes

Reviewed end-to-end for regressions and copy drift:

1. **NewsletterConfirm.tsx still says "practitioner writeups"** — `app/src/lib/infra/resend/templates/NewsletterConfirm.tsx:64`. The landing and pricing copy was updated; the email template wasn't. Minor inconsistency. **Fix:** swap "practitioner writeups" → "curated tool walkthroughs" or "shipped writeups" to match the rest of the surface.
2. **AD article line 137 — `pwsafe.py`** isn't a canonical Impacket script name. The `net rpc password` shown is real (via Samba) but a reader pasting it without the surrounding context might wonder what tool `pwsafe.py` refers to. **Fix:** either drop the `pwsafe.py` reference or replace with the correct `rpcclient` / `samba-tool user setpassword` invocation. Not a ship-blocker; readability nit.
3. **Bonus library teaser strip — opportunity not taken** — the homepage bonus section (`page.tsx:328-346`) still picks the same three highest-signal items by hash order. The new AD article (#17) is genuinely the strongest item in the library now. **Optional improvement:** feature it explicitly on the landing as the "post-cert path" anchor, since the `/about` page's "What this is not" now points readers toward it.
4. **No regressions detected** — all 59 unit tests pass; landing/about/pricing render with the new copy; `/bonus` indexes the AD article correctly via the filesystem-driven loader.

### Remaining gaps (carried from prior review, unaddressed by this commit — by design)

These were in the curriculum-gap section of the prior review but were **not** in the "fix before launching" list because they're tier-2/3 enhancements, not ship-blockers. The product owner left them as future work, which is correct for a "ship CEH prep that's honest" launch:

- LOLBins / living-off-the-land binaries (no curriculum content) — could close with one bonus article like #17.
- EDR / behavioral detection awareness (no content) — same, one bonus article.
- C2 framework primer (no content, but explicitly named in `/about` as not-included).
- Modern web-auth bypasses (JWT alg-confusion, OAuth open-redirect, SAML wrapping, HTTP request smuggling) — not in the curriculum proper.

The `/about` "What this is not" section now explicitly closes the framing question on all of these. The product is honest about its scope; the gaps are documented rather than hidden. That's the right call for launch.

### Final delta verdict

**From "soft no for the red-team aspirant framing" → "soft yes for the CEH-pass-with-honest-post-cert-track framing."**

The product owner did the harder thing — instead of papering over the gaps, they **moved the positioning** to match what's actually shipping. The hashcat lie is gone. The 125-question lie is gone. The "strongest predictor" lie is gone. The "practitioner writeups" framing is mostly gone (one residual surface). The largest single curriculum gap (AD) is partially closed with a genuinely good bonus article. The exam simulator now mirrors how the real CEH reports score — by domain, not by lesson day. The "what this is not" section draws the scope line in writing.

**Top remaining gap before external launch:**

1. **Sweep "practitioner writeups" out of the newsletter template** (5-minute fix) — last surface where the language is inconsistent with the rest of the product.

Everything else on the original list is closed. If the product owner is shipping this week, I'd let it go.

**One forward-looking note:** the differentiator between this product and the rest of the $30/mo CEH-prep market is now demonstrable honesty + a credible post-cert article. That's a defensible product position. Lean into it in marketing — the "every number on this page traces to a file in the repo" line in the hero (`page.tsx:131-133`) is the right voice. More of that, less feature-list copy.

— Re-reviewer, 2026-05-23 (same day, post-fix)
