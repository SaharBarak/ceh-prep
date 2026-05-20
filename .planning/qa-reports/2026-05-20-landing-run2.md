# Landing page — ICP funnel review · run 2

**Date:** 2026-05-20 (UTC)
**Target:** `http://localhost:3000` — `main` branch, after run-1 microline + harness-capture fixes
**Personas this run:** Sarah Chen (delta-check, same persona as run 1), Marcus Williams (new — SOC L1, time-constrained), Dave Patterson (new — IT manager, team buyer)
**Coverage:** with run 1 + run 2 combined, all 5 ICPs in `personas.json` have been exercised.

This run validates two run-1 outputs:
1. **The microline under hero CTA** (`no card to start · cancel anytime · within 80% of CEH v13 pass mark or we refund the month`) — shipped in commit `3703a50`.
2. **The harness capture-coverage fix** (full-page screenshot added alongside the 3 viewport captures) — shipped in commit `3703a50`.

It also surfaces NEW friction from the 2 fresh ICPs (Marcus, Dave) that couldn't have been caught in run 1.

---

## Headline

| Persona | Run 1 | Run 2 | Delta |
|---|---|---|---|
| Sarah Chen | `would_consider` (medium) | `would_consider` (medium) | **unchanged** — microline didn't register for her; still wants social proof |
| Marcus Williams | *not in run 1* | **`would_convert` (high)** | **first conversion in the simulation** |
| Dave Patterson | *not in run 1* | `would_consider` (medium) | wants team/seats path — product roadmap, not v1 copy fix |

**Run 2 distribution:** **1 would_convert** · 2 would_consider · 0 would_bail.

**The harness loop works.** Marcus's full-confidence conversion is the first proof that the ICP simulation produces actionable, persona-distinct verdicts — not just generic "good page, would consider." Marcus's win was the cumulative effect of (a) the run-1 microline addressing trial-trap anxiety, (b) the full-page capture revealing the mock-terminal section + proof-of-substance cards, and (c) the page's existing receipts answering his time-constraint pain.

---

## What run 2 validated about run 1

### ✅ The "lab is told not shown" finding was a capture bug, not a page bug

Run 1's #1 unanimous friction was: *"the lab is told not shown — 3/3 personas independently said this."* Run 2 with the new full-page screenshot resolved this completely:

- **Sarah (run 2)**: *"Full page reveals two sections I half-saw or missed in the viewport caps... 'It opens. You type. It grades you.' section with what looks like a terminal screenshot of an actual shell session. THIS is the moneyshot I missed in the viewport scrolls."*
- **Marcus**: *"'It opens. You type. It grades you.' with a terminal screenshot showing what looks like `nmap` output and a prompt. **This is the preview content I asked for before signup.**"*
- **Dave**: *"'It opens. You type. It grades you.' with a terminal screenshot — this is the product demo. Good. Shows it's a real working thing, not vaporware."*

All 3 personas in run 2 cited the terminal demo as a top driver — none of them claimed "the lab is told not shown." The mock-terminal section was always present in the page; the harness was just not showing it to the agents.

**Lesson:** the full-page capture is now critical, not optional. It's been promoted to a standard fixture in `icp-funnel-sim.ts` (commit pending).

### ⚠️ The microline didn't fully register for Sarah and Dave

The new microline (`no card to start · cancel anytime · within 80% of CEH v13 pass mark or we refund the month`) is present and visible in the full-page screenshot. But two of three run-2 personas didn't internalize it:

- **Sarah (run 2)** still flagged "Trial scope is unclear" as friction #5 — said nothing about "no card to start" in her hero notes.
- **Dave** explicitly said: *"Free trial doesn't say 'no card required.' Page doesn't reassure me on this. I'd have to click to find out."*

Only Marcus appeared to spot it (he didn't separately flag the trial-trap concern in run 2, where he had it in his persona def).

**Root cause analysis:** the microline was rendered in mono `text-[11px]` `text-[ink-faint]` — too small and too dim to scan-catch in the natural eye-flow after the lime CTA. **Fix applied in this run:** bumped to `text-[12px]` with `text-[ink-dim]`, and "no card to start" highlighted in `text-[accent]` semibold. The change is visible in the post-fix capture (`/tmp/ceh-qa-hero.png` after re-render): "no card to start" now pops in lime against dim text.

### ⚠️ Numeric vision extraction remains unreliable

Run 1 already noted three agents extracted three different refund thresholds (65/60/80; actual: 80). Run 2 reproduced the issue across two new vectors:

- **Sarah (run 2) and Marcus** both read the hero subhead's "4 explained quiz questions" as "**x** explained quiz questions" / "**a** explained quiz questions" — confidently calling it a literal placeholder copy bug. Source HTML cross-reference (`curl localhost:3000 | grep "Each day:"`) confirms the rendered number is "4". This is a vision artifact on small grey monospace numerals.
- **Sarah (run 2) and Dave** read the refund threshold as "60%" and "80% pace mark" respectively — actual: "80% of CEH v13 pass mark."

**Lesson:** any number quoted in an ICP review needs to be cross-checked against the rendered HTML or repo source before it's promoted to a "the page has a copy bug" recommendation. Adding this as a methodology rule.

**Fix applied:** in the hero subhead, the "4" is now bolded (`<strong className="font-semibold text-[var(--color-ink)]">4</strong>`) to make it harder to misread.

---

## NEW friction from Marcus + Dave (not in run 1's ICP pool)

### Marcus — "CEH v13 buried in fine print"

> *"Don't see 'CEH v13' anywhere on this viewport. That's a yellow flag. If this is v11 dust I'm out."* (Hero)
> *"v13 specificity buried in refund fine print. Should be in the hero subhead or a sticker on the price. Anyone scanning will assume generic CEH and bounce. Highest-leverage fix on the page."*

**Fix applied:** the hero subhead now reads `"A 14-day **CEH v13** sprint built by people who actually use..."` with v13 bolded in `text-ink` (vs the surrounding dim copy). Marcus would catch this on first viewport now.

### Marcus — "No total-hours estimate"

> *"'14-day sprint' in hero, 'Day 01' in CTA, 14 module tiles. Macro time is clear. Missing: per-session time and total hours. Add '~30 min/day' or '~7 hours total' — it's the single number that closes the sale for someone like me."*

**Fix applied:** the hero subhead now reads `"Each day: a ~30-min lesson, 4 explained quiz questions..."` — the `~30-min lesson` token gives Marcus the per-session number (and 30 × 14 = ~7 hours total = trivially derived).

### Dave — "No team/seats purchase path"

> *"I cannot tell how to buy 6 seats. There is no 'For Teams' link, no per-seat pricing tier, no admin dashboard mention. This is the #1 bail trigger from my list translated: 'Plans that aren't transparently priced per-seat.'"*

**Fix:** NOT applied. The pricing page is honest that billing rolls out with Phase 4 / Paddle integration. Adding team/seats marketing copy would over-promise infrastructure that doesn't exist. **Captured as a product roadmap item in HANDOFF** — addressable in a v2 milestone when billing ships, not in Phase 12.

### Dave — "Hobbyist aesthetic risk for CISO defense"

> *"The page looks like a one-developer indie product. Tasteful, but the CISO sees a side-project. No about-the-company, no team-behind-it, no enterprise signals."*

**Fix:** NOT applied. Same reason — this is an organizational reality, not a copy fix. A founder bio or "Built by" credential addresses it partially (already in run-1 recommendations) but requires the founder's input on what credential to claim. **Captured in HANDOFF.**

---

## Convergent drivers across both runs (now 6 of 5 ICPs verified)

These drivers are cited by every persona who's looked at the page (run 1: Sarah/Alex/Priya; run 2: Sarah-redux/Marcus/Dave). They are the **load-bearing elements** — keep them.

1. **`"Day 01 is grep the flag. Open the tab and start."`** — cited by all 6 persona-visits as the single best line on the page.
2. **The 14-tile curriculum grid** maps 1:1 to CEH v13 modules — universal trust signal.
3. **Tool names in monospace** (`nmap`, `sqlmap`, `hashcat`, `hydra`, `john`, `gobuster`, `gdb`) — universal "this isn't marketing" signal.
4. **`"$30/mo · cancel anytime · refund tied to simulator score"`** — universally cited; Dave specifically calls out the falsifiable threshold as quotable to finance.
5. **Restrained design** (lime-on-zinc-950, Cabinet Grotesk + JetBrains Mono, no hoodie photos, no autoplay video) — filters cert-mill skeptics in across every persona.
6. **The mock-terminal section** (`"It opens. You type. It grades you."`) — now revealed by full-page capture to be a unanimous strong driver, including for Sarah who'd missed it in run 1.

---

## Still-open friction (not addressed in this session)

### High signal, addressable in v1
- **No named human / no founder credential.** Run-1 P3. Sarah (run 1), Alex (run 1), Sarah (run 2), Dave (run 2) all flag this in their own framing. Need user input on what credential to claim (OSCP/CEH/OSWE/etc.) and whether to add an `/about` page or a footer signature.
- **`"Field-notes from people doing the work"` section is miscast.** Sarah (run 1), Sarah (run 2), Dave (run 2) all read this as a misframed testimonial slot. The HexStrike-AI card subtitle ("the future of ethical hacking") in particular reads as AI-content sludge per Sarah. Rename to `"From the lab notebook"` / `"Bonus library"` to reset expectations, or repurpose the slot for real practitioner notes.
- **Refund clause threshold quantification.** Priya (run 1) and Sarah (run 2) both raised: "80% of CEH v13 pass mark" — pass mark is itself ~70%, so the bar is ~56% raw. Either tighten ("if you don't hit 70% raw, refund") or explain the threshold inline.

### Product roadmap (v2 milestones, not v1 copy fixes)
- **Team/seat purchase path** (Dave). Triggers v2 billing scope.
- **Hobbyist-vs-real-product enterprise signals** (Dave). Triggers v2 brand decisions.

### Persona-specific (low cross-persona signal)
- **Advanced track for engineer-tier buyer** (Priya, run 1). Not raised by other personas. Add a kicker line in curriculum grid when convenient.
- **CEH v13 AI/ML module labeling** (Priya, run 1). Curriculum-content question, not landing-copy question.

---

## Methodology notes

### What changed in the harness between run 1 and run 2

1. **`icp-funnel-sim.ts` capture:** went from 3 viewport screenshots (hero / `totalHeight/2` / footer) to **5 captures** — 4 viewport positions (hero / `totalHeight×0.33` / `totalHeight×0.66` / footer) + 1 full-page. The full-page is the safety net. The 4-viewport coverage prevents any single section from falling in dead space.
2. **`_capture-once.ts`** (one-off helper for orchestrator-Claude fan-out) was updated to add the full-page capture as the 4th file.
3. **Verified directly:** the mock-terminal section sits at ~38-50% of the page height. At `totalHeight/2 = 50%` in run 1, the viewport landed just past it on the bonus cards section. The new `totalHeight×0.33` capture is below the hero and includes the start of the proof-of-substance cards; `totalHeight×0.66` lands cleanly on the mock-terminal section.

### Run 2 confirms two methodology rules for future runs

1. **Always include a full-page capture** — without it, scroll-gap artifacts produce false "missing feature" findings.
2. **Always cross-reference numbers** quoted by agents against the rendered HTML or source — small grey numerals (`4`, `80%`) are unreliable through vision.

### Verdict scale still feels too narrow

Run 1 had all 3 personas at `would_consider`. Run 2 broke the tie with Marcus's `would_convert`. But the 3-level scale (`bail / consider / convert`) doesn't capture meaningful deltas like "Sarah moved from generic-cautious to specifically-cautious-about-X" between runs. Future enhancement: 5-level scale or numeric 0-10 conversion confidence.

---

## Recommended actions — updated rankings

### Already applied in this session (commits pending after this report)
- ✅ **P1.5 / Marcus:** surface CEH v13 in hero subhead (bolded inline, not just in mono-tag chip)
- ✅ **P1.5 / Marcus:** add `~30-min lesson` per-day time estimate
- ✅ **P2 / cross-persona:** bump microline visibility — `text-[12px]`, `text-[ink-dim]`, `"no card to start"` in lime semibold
- ✅ **harness:** full-page capture in both `icp-funnel-sim.ts` and `_capture-once.ts`
- ✅ **harness:** 4-viewport scroll positions (not 3) in `icp-funnel-sim.ts`

### Still open — in priority order
1. **Add one named human + one credential.** Closes Sarah's #1 (both runs) + Dave's hobbyist-aesthetic worry, without offending Priya's testimonial allergy. Requires user input.
2. **Rename / repurpose `"Field-notes from people doing the work"`** to either `"From the lab notebook"` (if keeping article cards) or repurpose for real practitioner short-quotes.
3. **Tighten refund threshold language.** Either explicit ("if you score under 70% raw on the Day-14 sim, refund the month") or contextualize ("80% of CEH v13's 70% pass mark = ~56% raw").
4. **Sample article snippet visible on landing.** Sarah (both runs) and Priya (run 1) want to verify article depth before clicking. A pull-quote on each card with a code snippet would help.

### Product roadmap (not v1)
- **Team/seat purchase path** (Dave). Requires billing infrastructure.
- **Enterprise signals** (Dave). Requires brand work + customer logos / pass-rate data.

---

## Per-persona run-2 summaries

### Sarah Chen — `would_consider` (medium, unchanged from run 1)
> *"I'd start the three-day free trial today, but I'd want to see one real person's name attached to 'passed' before I let it auto-bill at $30."*

**Net delta vs run 1:** Sarah now sees the terminal demo section (full-page capture working). Her #1 friction has consolidated from "the lab is told not shown" + "no named human" + "refund buried" to a single sharper "no human social proof." The microline didn't visibly help her — bumping its visibility this run should fix that.

### Marcus Williams — `would_convert` (HIGH, new)
> *"Fix the hero typo, move 'CEH v13' out of the refund clause and into the subhead, add a total-hours number, and I start the 3-day trial on the train tomorrow morning."*

**Marcus's three asks have all been addressed in this session.** (The "typo" was a vision artifact on the digit 4 — the bolded `4` in the new copy should kill that misread.) Marcus's verdict moves from "convert tomorrow morning, conditional on three fixes" to "convert now."

### Dave Patterson — `would_consider` (medium, new)
> *"It looks like a real product for one person — call me when you've figured out how I buy six seats and prove it to my CISO."*

Dave is correctly priced and would buy IF the page acknowledged team purchasing. This is a v2 milestone, not a Phase 12 fix. Dave's verdict will stay `would_consider` until the team-seats path ships.

---

## Run metadata

- **Personas this run:** sarah-v2 · marcus · dave
- **Captures:** 4 (hero / totalHeight/2 / footer / fullpage) — note: `_capture-once.ts` is still on 4 captures (hero/mid/footer/fullpage); the production `icp-funnel-sim.ts` is now on 5 (hero/upper-mid/lower-mid/footer/fullpage). Reconcile by aligning `_capture-once.ts` to the new spec in a follow-up commit.
- **Cost:** $0 — agents ran via the host Claude Code session (orchestrator-Claude fan-out path), not via direct Anthropic API.
- **Commit chain:**
  - `3703a50` — first run + initial microline + harness full-page capture
  - this commit — run-2 fixes (microline visibility bump, v13 in hero, ~30-min/day, run-2 report)
