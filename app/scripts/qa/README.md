# Track B — ICP Funnel Simulation (Phase 12)

Nightly Claude-driven QA harness. Five ICP personas walk the CEH Prep landing
page; Sonnet 4.6 reacts to screenshots as each persona; Haiku 4.5 re-reads its
own notes and produces ranked friction reports under `.planning/qa-reports/`.

**Advisory only.** Never blocks merges. See
[`.planning/phases/12-testing-and-llm-quality-review/`](../../../.planning/phases/12-testing-and-llm-quality-review/)
for scope, decisions, and Track A (deterministic suite, deferred until B
proves valuable).

## Files

| File                     | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `personas.json`          | 5 ICPs (Sarah / Marcus / Alex / Priya / Dave) with voice   |
| `icp-funnel-sim.ts`      | Playwright + Anthropic SDK harness                         |

## Run it

```sh
# 1. Make sure dev server is up
npm run dev                       # in one terminal

# 2. Set the key, then run the harness
export ANTHROPIC_API_KEY=sk-ant-…
npm run qa:icp                    # in another terminal
```

Output: `.planning/qa-reports/YYYY-MM-DD-landing.md`.

If `ANTHROPIC_API_KEY` is unset, the script exits cleanly with a log message —
this is intentional so CI without secrets won't break.

## Environment

| Var                  | Default                  | Purpose                                              |
| -------------------- | ------------------------ | ---------------------------------------------------- |
| `ANTHROPIC_API_KEY`  | _(required)_             | Anthropic SDK auth. No key → no-op exit.             |
| `QA_TARGET_URL`      | `http://localhost:3000`  | Landing page URL Playwright loads.                   |
| `CLAUDE_QA_MAX_USD`  | `2`                      | Hard budget cap (USD). Run halts before next call.   |

## Cost expectations

Sonnet 4.6 vision pass (3 images + persona system prompt) typically lands at
**~$0.05–0.10 per persona**. Haiku 4.5 synthesis adds **~$0.005 per persona**.
For 5 personas the report comes in around **$0.30–0.55**.

At 3 personas nightly that's ~$0.20/run × 30 = **~$6/mo**. The $2/run default
cap is ~3× headroom in case Sonnet generates unusually long notes.

Pricing source: `claude-api` skill (Jan 2026). Cache writes are 1.25× input;
cache reads are ~0.1×. The persona system prompt is marked
`cache_control: ephemeral` but **does not cache across personas** (different
content). Caching here is defensive — useful if the same persona is re-run
inside the 5-minute TTL.

## Architecture (MVP)

```
personas.json
     │
     ▼
┌─────────────────────────────────────┐
│  Playwright (chromium, headless)    │
│  → http://localhost:3000            │
│  → 3 screenshots: hero, mid, footer │
└─────────────┬───────────────────────┘
              │ base64-encoded PNGs
              ▼
       per persona ×5
       ┌─────────────────────────────────┐
       │ Sonnet 4.6 vision pass          │
       │  system: persona (cached)       │
       │  user:  3 screenshots + prompt  │
       │  out:   in-voice notes + verdict│
       └────────────────┬────────────────┘
                        ▼
       ┌─────────────────────────────────┐
       │ Haiku 4.5 synthesis pass        │
       │  - re-read                      │
       │  - missed observations          │
       │  - aggregate + rank             │
       │  out:   friction points + rank  │
       └────────────────┬────────────────┘
                        ▼
       .planning/qa-reports/YYYY-MM-DD-landing.md
```

Budget tracker counts tokens × pricing per call and halts before the next
call if the cap would be crossed.

## Roadmap (follow-up phases — not this MVP)

1. Expand harness surface — signup form, curriculum days 1/3/10/13, lab iframe load, exam simulator.
2. Track A — Vitest + Playwright + MSW + supertest deterministic suite.
3. Nightly cron at 03:00 UTC (decision logged in HANDOFF.json).

## Decisions (locked in scope phase)

- Trigger: nightly whole-repo, not per-PR
- Severity: advisory only
- Self-review: chain-of-critique (multi-pass), not single-pass
- Models: Sonnet vision + Haiku synthesis (vision needs Sonnet; re-reading is cheap)
- Provider: direct `@anthropic-ai/sdk` (we own prompt + budget)
