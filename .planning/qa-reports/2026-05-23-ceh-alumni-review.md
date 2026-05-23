# CEH v13 Alumni Review — CEH Prep

**Reviewer perspective:** Recent CEH v13 pass (~6 months ago), reviewing through the lens of the Skills.sh ethical-hacking-methodology framing — a 5-phase pen-test lifecycle, authorization-first, systematic enumeration, and reporting.

**Reviewed:** 2026-05-23
**Artifacts:** curriculum `days.ts` (1202 lines, 14 days, 52 quiz qs), landing `page.tsx`, exam runner + builder, live dev server at `http://localhost:3000`.

---

## TL;DR — pass/fail verdict

**Verdict: Useful supplement, not a standalone replacement.** As a $30/mo *complement* to Boson ExSim-Max or the official iLabs, CEH Prep is sharply written, technically accurate, and a genuinely better lesson experience than the EC-Council courseware. As the *only* prep, it is **not yet sufficient** to clear the v13 exam for the average IT-background candidate — the question bank is ~40% the size of the real exam, ~14% the size of what serious candidates drill, and the difficulty curve is flatter than what EC-Council ships.

I would have bought this in week 1 of my own prep as the "lesson-and-vocabulary" layer, then moved to Boson + iLabs for the last 10 days before the exam. The product is honest enough about that (the Day-14 footnote calls it out), but the headline "14 days to certified" is rounded down from reality. For most candidates it's "14 days of focused lessons, then 1-2 more weeks of question drilling elsewhere."

The refund guarantee (70% on the Day-14 simulator) is a clever pressure-relief mechanism for the buyer, but mechanically it's a guarantee against the *internal* simulator — not against the real exam — so it doesn't carry the risk that the marketing implies.

**Top three things I'd change:**
1. Grow the question bank to 125+ and stratify it by domain weight before the simulator can honestly stand in for exam-day practice.
2. Add a per-domain readiness dashboard (not just per-day) — the real CEH is scored against 9 official domains, and that's what candidates need to see weakness in.
3. Re-word the refund guarantee so it doesn't read like a real-exam guarantee. Right now "hit 70% on the Day-14 sim or we refund the month" plus "70% is the CEH v13 pass threshold" lets a fast reader conclude you're guaranteeing the *real* exam.

---

## Domain coverage matrix

CEH v13 official blueprint splits into 9 domains. Mapping what this curriculum covers against the published weights:

| # | Domain (official weight) | Mapped Days | Questions | Coverage verdict |
|---|--------------------------|-------------|-----------|------------------|
| 1 | **Information Security & Ethical Hacking Overview (~6%)** | Day 01 | 5 | **Solid.** Five phases, color hats, scope/authorization, lab setup. Slightly underweighted on legal/compliance frameworks (no PCI/HIPAA/GDPR mention — CEH historically asks at least one). |
| 2 | **Reconnaissance Techniques (~21%)** | Day 02, Day 04 | 8 | **Under-covered for the weight.** Footprinting + enumeration get 8 questions combined (15% of bank) vs. 21% of the real exam. Day 02 is strong (WHOIS, CT logs, Shodan filters, GreyNoise). Day 04 is thin — 3 questions for the entire enumeration phase (SMB, SNMP, LDAP, NTP, SMTP, DNS-AXFR). Should be ~11 questions to match weight. |
| 3 | **System Hacking Phases & Attack Techniques (~17%)** | Day 05, Day 06, Day 07 (partial) | 9 | **Under-covered.** Vuln analysis (Day 5), system hacking proper (Day 6), and malware classification (half of Day 7) ~= 17% of bank vs. 17% of exam — proportionally fine, but Day 6 only ships 3 questions to cover password attacks, hash dumping, Linux privesc, Windows privesc, *and* lateral movement. That's a sprint, not a curriculum. Steg + alternate data streams missing entirely; CEH loves both. |
| 4 | **Network & Perimeter Hacking (~14%)** | Day 03, Day 07 (partial), Day 08 | 11 | **Adequately covered.** Nmap (Day 3) is the best-written day in the curriculum — flag fluency is exam-realistic. Sniffing + MITM (half Day 7) and DoS + session hijacking (Day 8) round it out. Missing: firewall/IDS evasion specifics (Nmap `--data-length`, fragmentation, decoys `-D`). CEH asks about evasion flags. |
| 5 | **Web Application Hacking (~16%)** | Day 09, Day 10 | 8 | **Under-covered.** Web servers + OWASP Top 10 (Day 9, 3 qs) and SQLi (Day 10, 5 qs) = 15% of bank vs. 16% of exam — close on proportion but absolutely thin. XSS gets *zero* dedicated questions. CSRF, file upload, deserialization, XXE all absent from the quiz bank. CEH v13 hits all of these. The prompt-injection concept card (LLM-INJ on Day 9) is excellent v13-current content but no quiz question tests it. |
| 6 | **Wireless Network Hacking (~6%)** | Day 11 (partial) | 1 | **Under-covered.** The wireless content lives in Day 11 alongside mobile and IoT/OT. Out of 3 Day-11 questions, only 1 is wireless (WPA2/3/WEP). Should be ~3 dedicated wireless questions to match weight. Missing: Evil Twin, KARMA, captive portal MITM, Bluetooth basics. |
| 7 | **Mobile, IoT & OT Hacking (~8%)** | Day 11 (partial) | 2 | **Under-covered.** Two Day-11 questions cover mobile + IoT + OT combined. Should be ~4. Missing: specific mobile platform questions (iOS keychain, Android intents/exported activities), MQTT/CoAP IoT-specific protocols. The OT question (Modbus, no auth) is good but stands alone. |
| 8 | **Cloud Computing (~6%)** | Day 12 | 3 | **Adequate.** Shared responsibility, IMDS abuse, Kubernetes privileged-pod escape. Matches weight. Missing: Azure-specific (managed identities), GCP-specific (workload identity). CEH v13 is AWS-heavy in practice but asks at least one cross-cloud question. |
| 9 | **Cryptography (~6%)** | Day 13 | 5 | **Over-covered (in a good way).** Strongest day on quiz-bank density. AES modes, TLS 1.3, password hashing (Argon2id), RSA vs ECC sizing, Base64 expansion. The ECB-penguin reference is exactly the framing CEH uses. Could trim 1 question and redistribute. |
| — | **Exam mechanics / pacing** | Day 14 | 3 | Three questions about the exam itself — useful priming, not domain content. |

**Summary:** Reconnaissance (#2), System Hacking (#3), Web App (#5), Wireless (#6), and Mobile/IoT/OT (#7) are all under-weighted relative to the blueprint. Crypto and Cloud are weighted correctly. The "Foundations" and "Exam mechanics" overhead consumes ~16% of the bank, which is fine for week-1 of study but should shrink proportionally as the bank grows toward 125.

---

## Question quality — exam-realism assessment

The questions are **better written than EC-Council's own practice material** in voice and clarity, but **easier than the real exam** in difficulty distribution. The real CEH v13 leans heavily on:
- Two-plausible-answer trap questions where both are technically correct but one is "more correct" by EC-Council's preferred-tool/framework bias.
- Scenario questions ("An attacker has X, wants Y, what tool/technique?") that test command knowledge under stress.
- Occasional dated content (still references some things EC-Council taught in v11).
- Cringey wording — passive voice, misplaced commas, the occasional non-native-English construction.

### Specific question audit

**Exam-realistic and well-built:**
- Day 3, Nmap timing template Q (`-T0/T1/T3/T5`) — exact format of a real exam question. Single-word distractor differences. (`days.ts:319-322`)
- Day 10, SQLi auth-bypass payload (`' OR '1'='1' --`) — classic CEH muscle-memory question. (`days.ts:837-846`)
- Day 13, ECB-mode-broken question — the "patterns visible" framing is precisely how CEH asks it. (`days.ts:1072-1075`)
- Day 12, IMDS endpoint (`169.254.169.254`) — verbatim CEH-style. (`days.ts:1004-1014`)

**Too easy / too clinical:**
- Day 1, the OSINT-only question (`days.ts:73-82`) gives away the answer in the parenthetical. Real CEH would say "Which phase is purely passive when conducted properly?" and force the candidate to infer.
- Day 14, "How long is the real CEH v13 exam?" (`days.ts:1156-1161`) — trivia, not skill. Should test pacing decisions instead ("Question 80, two hours left, 30 unanswered — what's the right move?").
- Day 8, "Why is voice phishing growing?" (`days.ts:691-700`) — open-ended-feeling, but only one answer is plausible (the "bypasses email security gateways" choice). The other three distractors aren't even tempting.

**Missing question types CEH heavily uses:**
- **Tool-output reading questions.** "Here's an nmap output snippet — which service is the most exploitable target?" CEH v13 ships several of these. This curriculum has zero.
- **Command-syntax fill-in questions.** "To perform X with tool Y, the correct flag is ___?" Day 3 has flag-fluency in the *concepts* card but no quiz question tests it.
- **Order-of-operations questions.** "A pentester is about to run Z. What should they have completed first?" The 5-phases scaffolding sets up these perfectly but no quiz tests them.
- **Defender-side questions.** CEH always asks ~10-15% defender questions (incident response, log analysis, control selection). This curriculum is almost entirely attacker-side.

**One subtle technical concern:** Day 5 says "CVE-2017-0144 (EternalBlue) is still 8.1 critical even though it's old" (`days.ts:432`). CVE-2017-0144 has a CVSS v3 score of 8.1 (per NVD), which is "High" not "Critical" — CVSS 9.0-10.0 is the Critical band. Minor exam-pedantry but CEH absolutely asks about CVSS band thresholds and this could mislead a student.

---

## Simulator readiness

**Current state:** 52-question, 4-hour timer, 70% pass, per-day breakdown, server-side grading, sticky timer header, jump-grid navigation, randomized per attempt.

**As exam-day pacing practice: useful right now.** The 4-hour container is correct. The flag-and-return UX (`QuestionGrid`) maps to the real Pearson VUE interface fairly well. Server-side grading without exposing the answer key during the run is the correct architecture.

**As exam-content practice: not yet sufficient.**
- 52 questions can be memorized inside 3-4 attempts. Real CEH has a question pool of thousands; randomization on a 52-question bank just reshuffles, it doesn't simulate.
- The per-day breakdown is the wrong lens. Candidates need *per-domain* breakdown that matches the official CEH blueprint, because that's what shows on the score report and tells them where to focus reading.
- No marked/flagged-for-review functionality (only "jump to question"). Real exam has a flag button.
- No "review unanswered before submitting" warning. A candidate who clicks Submit with 12 blanks gets no second-chance prompt.
- The "Pass / Below threshold" framing on the results screen is binary; the real exam returns a score and a per-domain bar chart. The product already has the per-day data — it should ship a chart, not a list.

**To be worth $30/mo on the simulator alone:** needs 125 questions minimum (ideally 200+ with weighting), per-domain breakdown, three-state question marking (answered / flagged / unanswered), and a pre-submit confirmation.

---

## Compared to the existing prep ecosystem

What people who actually pass CEH v13 typically use:

| Resource | Cost | Role | This product replaces? |
|----------|------|------|------------------------|
| **EC-Council official courseware / iLabs** | $1,899 voucher bundle | Labs + slides + question bank | **No.** iLabs is the only thing with the official EC-Council branding the exam writers think with. CEH Prep replaces the *lessons* portion competently but not the labs or the official question bank. |
| **Boson ExSim-Max for CEH** | ~$99 | The gold-standard practice exam. Most alumni cite this as the single most predictive resource. | **No, not at 52 questions.** Boson ships ~600 weighted questions. The simulator here is the right *shape* but a quarter of the *scale*. |
| **Hari Pukhrambam / Udemy CEH v13 videos** | $15 (sale) - $120 | Video walkthroughs of each module | **Yes.** This product's lessons are better written, more concise, and don't require sitting through 30+ hours of video. Genuine replacement. |
| **CodeRed (EC-Council subscription)** | $300/yr | Skill paths + on-demand labs | **Partially.** WebVM + 4 graded drills cover ~80% of the CodeRed lab use-case for CEH-specific content. Doesn't cover post-CEH paths. |
| **Daniel Lowrie / Cybrary** | $59/mo Cybrary | Video + study groups | **Yes, mostly.** Same replacement logic as Udemy. |
| **PortSwigger Web Security Academy** | Free | Web app deep-dive | **No.** PortSwigger is hands-on training for actual XSS/SQLi/SSRF; CEH Prep teaches the *concepts* but doesn't have the practice surface PortSwigger has. |

**What CEH Prep uniquely replaces:** the "boring lesson + slide deck + Udemy lecture marathon" layer. The written prose is markedly better than what EC-Council ships, the explanations on each quiz answer are genuinely useful (the `why` field is the strongest UX choice in the product), and the WebVM-in-browser story removes the friction of standing up a Kali VM.

**What it doesn't replace:** Boson ExSim-Max for exam-day prediction, and iLabs for the "tools-EC-Council-tests-on" muscle memory.

**Honest positioning:** This is the *lessons + concept reinforcement* layer of a $250-400 prep stack. Priced at $30/mo, three months of subscription ($90) plus a Boson license ($99) gets you to ~$190 — much cheaper than CodeRed at $300 and infinitely better than the $1,899 EC-Council bundle for the prep portion. That's a real value position the marketing doesn't make explicit.

---

## The "14 days to certified" claim

**Honest answer: optimistic-but-defensible, with an asterisk.**

- For an experienced IT/security practitioner (3+ years, already comfortable with nmap, Linux, basic web app concepts): **14 days is realistic** if they're disciplined about ~2 hours/day and pair the lessons with at least one external question bank. Pass-on-first-attempt is achievable.
- For a junior IT person (1-3 years experience): **21-28 days** is more honest. The lessons can be consumed in 14, but the question drilling and lab muscle-memory take longer.
- For a career switcher with no IT background: **2-3 months minimum.** The curriculum assumes a non-trivial baseline (the SUID question on Day 6 assumes familiarity with Linux file modes; the IMDS question on Day 12 assumes the candidate already knows what an instance is).

The product's own copy hedges this reasonably ("~30 min/day · self-paced" and "14-day sprint" rather than "14 days guaranteed pass"). The closing CTA says "Day 01 is grep the flag" which is a great honest signal — if grep'ing for a regex pattern feels easy, you're at the right baseline.

**The headline should probably say "14 days of focused prep" rather than "Pass the CEH" as the primary verb.** The current phrasing reads as a pass promise; the refund mechanism is anchored to the internal simulator, not the real exam.

---

## Would-I-have-bought-it answer

**Yes — in week 1 of a 4-week prep timeline, as my lesson layer.**

Six months ago when I was preparing, I spent ~$280 on the EC-Council exam voucher (already mandatory), $99 on Boson, ~$30 on a Udemy course I half-watched at 1.5x, and burned ~80 hours of evenings. If CEH Prep had existed I would have:

1. Subscribed to Pro in week 1 ($30).
2. Worked through all 14 days in 8-10 sessions across week 1 and the first half of week 2.
3. Used the explained quiz answers as my "did I actually understand that?" check.
4. Cancelled the subscription after one month and switched entirely to Boson for the last 10-day exam push.

Total cost reduction vs. what I actually did: ~$0 (the Udemy spend is the same), but **time savings of ~15-20 hours** of video I wouldn't have had to skim through. That's real value.

**What would have made me *not* buy:** if the lessons were a thin wrapper over the EC-Council courseware (they aren't — they're independently written and often sharper), or if the bonus content was filler (it isn't — the WebVM fork is a meaningful artifact, not a marketing prop).

**What would convert me to a 3-month subscription rather than 1-month:** the simulator at 125+ questions with per-domain breakdowns, plus more drilled lab content (currently 4 drills; I'd want 14, one per day). Right now the simulator is a "nice to have once" rather than a "drill it daily for two weeks" tool.

---

## Final notes

The thing that's most encouraging about this product is the *voice*. The curriculum is written by someone who knows the material — the asides ("Hydra hammering an SSH service generates 10/sec and triggers lockouts"), the practical bias toward what actually works (Hashcat over Hydra, parameterized queries over WAF rules), the AI-augmented and prompt-injection concept cards aligned to CEH v13's new modules — all of this signals real practitioner authorship. That's hard to fake and rare in the certification-prep space.

The technical execution is also solid: server-side answer-key separation in the exam builder, deterministic seedable shuffling for tests, three-state question UI, sticky timer with low-time visual treatment. Production-grade for what it is.

The gaps are scope and depth, not quality. If the question bank grows to 200+ with domain stratification and the simulator gains per-domain reporting, this becomes a credible standalone option for the "Boson + Udemy" segment of the market — at one-third the cost.

**Reviewer's $30/mo verdict: worth the first month for the lessons; subscribe again for month 2 only if the question bank has grown.**

---

## Re-review — after fix commit 56c5986

**Re-reviewed:** 2026-05-23 (same day as original review). The product owner read the original review, accepted the findings, and shipped commit `56c5986` — claimed scope: copy honesty fixes, per-domain readiness chart, submit confirm dialog, +12 quiz questions, AD bonus article. I walked the diff and the working tree. Below is what I found vs. what I asked for.

### Verdict delta — short version

**Would-buy moved from "1 month, then leave" → "1 month plus a likely month 2."** Not yet a 3-month subscription, but the gap closed by roughly half. The per-domain chart was the single highest-leverage change asked for, and it shipped competently. The bank-growth ask is partially honored (+12, but still 49% short of the 125 target). The refund wording is materially fixed.

### Recommendation scorecard

| # | Original ask | Outcome | Evidence |
|---|--------------|---------|----------|
| 1 | **Grow question bank to 125+ with domain stratification** | **PARTIAL.** 52 → 64 (+12, +23%). Still 49% short of 125. Stratification logic landed (DOMAIN_META, defaultDomain, override resolution, perDomain rollup). The +12 hit exactly the under-covered domains I flagged. | `app/src/lib/content/days.ts` (64 questions); `app/src/lib/content/types.ts` (DOMAIN_META lines 28-44); `app/src/lib/exam/builder.ts:170-228` |
| 2 | **Per-domain readiness dashboard** | **PASS.** Primary results view is now a per-domain chart with the official CEH v13 weight printed for each domain, 3-band color scale (pass / amber / red), and per-day data demoted to a `<details>` drill-down. Matches how the real CEH score report reads. | `app/src/app/(app)/exam/exam-runner.tsx:429-479` (chart) + `app/src/lib/exam/builder.ts:111-129` (PerDomainResult type) |
| 3 | **Re-word refund guarantee so it doesn't read like a real-exam guarantee** | **PASS.** Closing CTA now says explicitly "*not a guarantee against the real EC-Council exam, which has its own question pool and psychometrics*." The hero microcopy still ties refund to the Day-14 sim but no longer co-locates the "70% matches CEH pass threshold" framing with the guarantee in a way that misleads. | `app/src/app/page.tsx:454-464` |

**3 of 3 needles moved.** One full pass, one partial (bank size), one full (refund wording). The product owner did the work.

### Updated domain coverage matrix

Resolved per-question domain distribution after this commit (Day 7 q0 overrides to system-hacking; Day 11 q2 overrides to mobile-iot-ot; everything else inherits the day's defaultDomain):

| # | Domain (official weight) | Questions before | Questions after | Δ | Match to weight |
|---|--------------------------|------------------|-----------------|---|-----------------|
| 1 | Info Security & Overview (~6%) | 5 (9.6%) | 5 (7.8%) | – | Slightly over still, normalizing as bank grows |
| 2 | **Reconnaissance (~21%)** | 8 (15.4%) | **10 (15.6%)** | **+2** | Still ~5% under-weighted. CT-logs + GreyNoise additions were correctly targeted |
| 3 | **System Hacking (~17%)** | 9 (17.3%) | **8 (12.5%)** | **−1 share** | Worse on share. Lost ground because Day-7-q0 reclassified to system-hacking (correct) but other days grew faster. CVSS-band q is exam-realistic |
| 4 | Network & Perimeter (~14%) | 11 (21.2%) | 10 (15.6%) | – | Now closer to weight (was over-shared). Normalization is in the right direction |
| 5 | **Web App (~16%)** | 8 (15.4%) | **13 (20.3%)** | **+5** | **Now over-weighted** (a good problem). XSS + CSRF + XXE + file-upload + IDOR — all the gaps I flagged got filled |
| 6 | **Wireless (~6%)** | 1 (1.9%) | **6 (9.4%)** | **+5** (∗ see note) | **Looks fixed on share, but tagging bug — see below** |
| 7 | **Mobile · IoT · OT (~8%)** | 2 (3.8%) | **1 (1.6%)** | **−1** (∗ see note) | **Worse on share due to tagging bug — see below** |
| 8 | Cloud (~6%) | 3 (5.8%) | 3 (4.7%) | – | Still matches weight |
| 9 | Crypto (~6%) | 5 (9.6%) | 5 (7.8%) | – | Slightly over-shared, normalizing as bank grows |
| – | Exam mechanics (~0%) | 3 (5.8%) | 3 (4.7%) | – | Day 14 priming — fine to keep |

#### (∗) Tagging bug found during re-review — Day 11 mis-buckets 2 of 3 new IoT/Mobile questions

`days.ts:1027-1030` correctly overrides the Modbus question to `mobile-iot-ot`. But the two genuinely-IoT-and-mobile questions added in this commit — the MQTT broker (`days.ts:1050-1058`) and the Android exported-activity (`days.ts:1061-1069`) — inherit Day 11's `defaultDomain: "wireless"`. Both are clearly mobile-iot-ot content (one is an IoT protocol, one is Android app security). Either tag both with `domain: "mobile-iot-ot"` or split Day 11 into wireless-default + IoT-and-mobile overrides on the relevant 3 questions.

This is a 10-minute fix and matters because the per-domain chart will tell candidates "you're strong on wireless" when they're actually being graded on mostly-mobile/IoT content. **Highest-leverage remaining nit.**

If you correct the bucketing, the real numbers become wireless = 4 (6.2%, matches weight) and mobile-iot-ot = 3 (4.7%, closes 60% of the gap). Better picture than the raw counts show.

### Question quality — spot-check on the 12 new questions

I drilled the new questions individually. Notes:

| Q | Domain | Verdict |
|---|--------|---------|
| Day 2: CT logs subdomain enum (`days.ts:228-238`) | recon | **Exam-realistic.** Tests passive-vs-active distinction. Distractors are well-chosen (AXFR is the trap answer for someone who half-remembers DNS recon). |
| Day 2: GreyNoise vs Shodan/Censys/VT (`days.ts:239-244`) | recon | **Exam-realistic.** Tool-classification q. CEH asks these. |
| Day 5: CVSS 8.1 band (`days.ts:508-513`) | system-hacking | **Exam-realistic.** Directly tests the lesson-copy fix. Why field cites the exact thresholds. Pure CEH muscle-memory question. |
| Day 9: Stored vs reflected XSS (`days.ts:819-824`) | web-app | **Exam-realistic.** Scenario form ("alert fires for every user who later views"). Trap distractor (Reflected) requires reading carefully. |
| Day 9: CSRF Origin header (`days.ts:826-835`) | web-app | **Exam-realistic, mild concern.** Origin-allowlist is the right modern answer, but `X-Requested-With` is sometimes accepted by EC-Council legacy material. The `why` field handles this correctly (calls out browser-set ≠ defense). Could mislead a candidate cross-referencing older study guides — not a fault, but worth a footnote. |
| Day 9: XXE payload (`days.ts:836-846`) | web-app | **Exam-realistic.** Tests payload-recognition, not just terminology. The `<!ENTITY %>` parameter-entity distractor is the right one to include — that's the OOB exfil variant. |
| Day 9: File upload double-extension (`days.ts:847-857`) | web-app | **Exam-realistic.** Apache mod_mime quirk. CEH has asked this exact pattern. |
| Day 9: IDOR/A01 (`days.ts:858-863`) | web-app | **Exam-realistic.** Tests OWASP categorization, which CEH leans on. |
| Day 11: Evil Twin (`days.ts:1032-1037`) | wireless | **Exam-realistic.** Karma is a strong distractor — Karma probes for known SSIDs rather than impersonating a specific one, the question wording disambiguates correctly. |
| Day 11: Captive portal cred harvest (`days.ts:1038-1048`) | wireless | **Exam-realistic.** Tests the *follow-on* attack after Evil Twin. Good chaining test. |
| Day 11: MQTT no-TLS (`days.ts:1049-1059`) | mis-tagged (should be mobile-iot-ot, inherits wireless) | **Technically excellent.** Distractor with Modbus function code is a nice trap for someone in keyword-matching mode. **But mis-tagged — see bug above.** |
| Day 11: Android exported activity (`days.ts:1060-1070`) | mis-tagged (should be mobile-iot-ot, inherits wireless) | **Exam-realistic.** Real Android intent-bypass scenario. Distractors are weak (one is implausible), could tighten one of them. **Mis-tagged — see bug above.** |

**Net assessment of new questions:** quality is on par with the strongest pre-commit questions (Day 3 Nmap, Day 13 ECB). No technical errors. Difficulty is exam-realistic — none are giveaways. The XXE, IDOR, and Evil Twin questions are the strongest of the batch.

### Active Directory bonus article — quality check

`docs/content/17-active-directory-attack-chain.md` is **the real thing.** 189 lines, original write-up. Covers the AS-REP → Kerberoast → BloodHound → abuse-edge chain end-to-end with command snippets for both Impacket (Linux) and Rubeus (Windows), hashcat modes 18200/13100 with exact reasoning, BloodHound abuse-edge examples (GenericAll, AddSelf, WriteDACL, ForceChangePassword, AllowedToDelegate), and an explicit honest framing at the end: "*This article is not on the CEH v13 exam. You don't need it to pass.*"

It also names the post-CEH path correctly: PNPT for AD-heavy practical, HTB Academy CRTP/Bug Bounty Hunter, OSCP only if a hiring manager requires it. That framing is what an alumni would say if asked off the record.

This is the **single best piece of content in the product** by a wide margin. It addresses the gap I named ("CEH Prep teaches the concepts but not the real-world AD tradecraft") *without* pretending to be exam material. Genuinely closes the "is this product for cert or for work?" framing question by drawing the line in writing.

**Style is right too:** opinionated ("Don't do this on a real engagement without a written report-clause covering it"), reference-rich (SpecterOps, fortra, GhostPack, GOAD), and the GOAD lab pointer is exactly the right "if you want to actually drill this, here's the free lab" close. That's senior-practitioner voice.

If this article is the template for what bonus content looks like going forward, the bonus library becomes a real value driver, not a marketing prop.

### Simulator readiness — does the chart change the verdict?

**Yes, it changes it materially.** Original verdict was "useful for pacing but not for exam-content prep because the per-day breakdown is the wrong lens." That's now resolved.

What's right about the implementation:
- The chart leads (primary view), per-day drill-down is in a `<details>`. That's the correct hierarchy — domain weakness is what a candidate triages on after a mock exam, not which day they got the question from.
- The official weight is printed alongside each domain ("~21% on real exam"). Lets a candidate see *not just what they missed* but *how much it costs them in real points.*
- Three-band color scale (pass/amber/red) is correct for at-a-glance triage. Two-band (pass/fail) would have been weaker.
- The submit confirm dialog (`exam-runner.tsx:534-584`) is well-built — counts blank questions, explains penalty, offers cancel-and-keep-going. Timeout auto-submit correctly *bypasses* the dialog (running out of time IS the implicit confirmation, as the code comment notes).
- The dialog has proper `role="dialog"` + `aria-modal` + `aria-labelledby` — accessibility is not an afterthought.

What's still missing for full exam-day fidelity:
- **No flag-for-review button.** The real Pearson VUE interface has a flag button alongside next/back. This product has jump-grid navigation but no marked-for-review state. Should add a third state to the question UI (answered / flagged / unanswered).
- **No tool-output reading questions.** Still no nmap-output or wireshark-snippet questions. These are CEH staples.
- **No order-of-operations questions.** "What should the pentester have done first?" — easy to test with the 5-phases scaffolding but the curriculum still doesn't.
- **No defender-side questions.** Still all attacker-perspective. Real CEH allocates ~10-15% to incident response / log analysis / control selection.

**Net:** the simulator went from "useful but wrong lens" to "useful with the right lens, still bank-limited." The chart fixes the headline UX issue. Bank size is what's left.

### What's still on the table (priority order)

1. **Fix the Day 11 domain tagging bug** (10 minutes). MQTT and Android exported-activity questions need `domain: "mobile-iot-ot"`. Without this, the per-domain chart actively misleads candidates about their wireless vs mobile-IoT readiness.
2. **Grow the bank to ~100, then to 125.** +36 to hit 100, +61 to hit 125. Priority targets: tool-output reading (5-8 questions across days 3, 4, 6, 9, 10), defender-side (5-8 across days 5, 6, 7, 8), order-of-operations (3-5 leveraging the 5-phases scaffolding), mobile/IoT (3 more after fixing the tagging bug), Reconnaissance (3-4 to close to 21% weight).
3. **Add a flag-for-review state to the question UI** (~half day of engineering). The submit confirm dialog handles the "didn't answer" case; flag-for-review handles the "answered but want to revisit" case. Real exam has both.
4. **Add 2-3 more bonus articles in the AD article's voice.** Suggestions: an Azure attack-path article (managed identities, Storage Account SAS abuse, AAD device code phishing) and a web-pentest-meta article (Burp Pro workflow, methodology, what JavaScript review actually looks like). At the level of the AD article, two of these would justify the $30/mo on bonus content alone for the post-cert reader.

### Updated would-buy verdict

**One-month: still yes, more strongly.** The lesson layer + the per-domain chart + the AD bonus article is now genuinely the best $30 in the CEH prep market for the price segment. Three weeks ago it was "useful supplement"; today it's "useful supplement that's clearly going to get there."

**Three-month: not yet, but the trajectory points that way.** The bank needs to reach ~100 questions and 2-3 more articles in the AD article's voice need to ship. At that point the simulator is drill-it-daily material and the bonus library is a real second value-driver beyond the lessons. If both happen, I'd subscribe for the full 3-month prep window — and that's $90 vs. the $30 first-month spend, which is the lift the product needs to clear to be a healthy SaaS.

**Behavior I'd predict from a current-day buyer:** subscribe in week 1 for the lessons → finish the lessons in days 1-10 → drill the simulator for days 11-13 (it'll feel tight at 64 questions but the per-domain chart will keep them learning from each run) → read the AD article on day 14 as the "what's next after CEH" anchor → cancel by week 4. Subscribe again 2-3 months later only if the bank has clearly grown.

**The product is shippable.** The remaining gaps are content debt, not foundation debt. That's the right kind of debt for a 2-week-old product.

**Updated $30/mo verdict: month 1 is a clear yes; month 2 is the new "if the bank grows" bet — the product owner has demonstrated they ship to review, which materially raises the probability that month 2 happens.**
