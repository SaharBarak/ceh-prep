#!/usr/bin/env tsx
/**
 * Track B MVP — nightly ICP funnel simulation
 *
 * For each persona in personas.json:
 *   1. Playwright opens the landing page (3 scroll positions → 3 screenshots)
 *   2. Sonnet 4.6 vision pass — judges first-3-second impression, motion, headline,
 *      trust signals, CTA pull, bail risk. Persona context is cached via ephemeral
 *      cache_control so repeated personas reuse the prefix.
 *   3. Haiku 4.5 chain-of-critique — re-reads its own notes to catch second-order
 *      observations, then aggregates into ranked friction points + conversion verdict.
 *
 * Budget-capped via CLAUDE_QA_MAX_USD (default $2/run). The harness exits cleanly
 * if ANTHROPIC_API_KEY is missing so it can be wired into CI without secrets.
 *
 * Output: .planning/qa-reports/YYYY-MM-DD-landing.md
 */

import Anthropic from "@anthropic-ai/sdk";
import { chromium, type Browser, type Page } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Config ──────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const PERSONAS_PATH = path.join(__dirname, "personas.json");
const REPORT_DIR = path.join(REPO_ROOT, ".planning", "qa-reports");
const TARGET_URL = process.env.QA_TARGET_URL ?? "http://localhost:3000";
const MAX_USD = Number(process.env.CLAUDE_QA_MAX_USD ?? "2");

const VISION_MODEL = "claude-sonnet-4-6";
const SYNTHESIS_MODEL = "claude-haiku-4-5";

// Pricing per 1M tokens (Jan 2026). Source: claude-api skill / platform.claude.com.
//   input — full-price uncached tokens
//   output — generated tokens
//   cache_write — 1.25× input (5-minute TTL)
//   cache_read  — ~0.1× input
const PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  "claude-sonnet-4-6": { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-haiku-4-5":  { input: 1.0, output: 5.0,  cacheWrite: 1.25, cacheRead: 0.1 },
};

// ── Types ───────────────────────────────────────────────────────────────────

interface Persona {
  id: string;
  name: string;
  age: number;
  role: string;
  situation: string;
  pain_points: string[];
  what_would_convert: string[];
  what_would_make_them_bail: string[];
  voice: string;
}

interface PersonasFile {
  version: string;
  description: string;
  personas: Persona[];
}

interface Screenshot {
  label: string;
  data: string; // base64
  mediaType: "image/png";
}

interface PersonaResult {
  persona: Persona;
  visionNotes: string;
  synthesis: string;
  verdict: "would_convert" | "would_consider" | "would_bail";
  costUsd: number;
}

// ── Cost tracker ────────────────────────────────────────────────────────────

class CostTracker {
  private totalUsd = 0;
  private readonly capUsd: number;
  private readonly log: Array<{ step: string; model: string; usd: number }> = [];

  constructor(capUsd: number) {
    this.capUsd = capUsd;
  }

  record(step: string, model: string, usage: Anthropic.Messages.Usage): number {
    const p = PRICING[model];
    if (!p) throw new Error(`No pricing for model ${model}`);

    const usd =
      (usage.input_tokens * p.input) / 1_000_000 +
      (usage.output_tokens * p.output) / 1_000_000 +
      ((usage.cache_creation_input_tokens ?? 0) * p.cacheWrite) / 1_000_000 +
      ((usage.cache_read_input_tokens ?? 0) * p.cacheRead) / 1_000_000;

    this.totalUsd += usd;
    this.log.push({ step, model, usd });

    process.stderr.write(
      `  [cost] ${step} (${model}): input=${usage.input_tokens} ` +
        `cache_w=${usage.cache_creation_input_tokens ?? 0} ` +
        `cache_r=${usage.cache_read_input_tokens ?? 0} ` +
        `output=${usage.output_tokens} → $${usd.toFixed(4)} ` +
        `(total $${this.totalUsd.toFixed(4)} / $${this.capUsd.toFixed(2)})\n`,
    );

    return usd;
  }

  assertUnderCap(): void {
    if (this.totalUsd >= this.capUsd) {
      throw new Error(
        `Budget cap exceeded: $${this.totalUsd.toFixed(4)} >= $${this.capUsd.toFixed(2)}. ` +
          `Halting before next call. Raise CLAUDE_QA_MAX_USD to continue.`,
      );
    }
  }

  total(): number {
    return this.totalUsd;
  }
}

// ── Playwright capture ──────────────────────────────────────────────────────

async function captureLanding(browser: Browser): Promise<Screenshot[]> {
  const page: Page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  try {
    await page.goto(TARGET_URL, { waitUntil: "networkidle", timeout: 30_000 });

    const shots: Screenshot[] = [];

    const grabViewport = async (label: string): Promise<void> => {
      const buf = await page.screenshot({ type: "png", fullPage: false });
      shots.push({ label, data: buf.toString("base64"), mediaType: "image/png" });
    };

    const grabFullPage = async (label: string): Promise<void> => {
      const buf = await page.screenshot({ type: "png", fullPage: true });
      shots.push({ label, data: buf.toString("base64"), mediaType: "image/png" });
    };

    // The 4 viewport captures simulate what a first-time visitor literally sees
    // at four scroll-stop points. The full-page capture catches sections that
    // fall between fixed offsets (we discovered the 2026-05-20 first run missed
    // the mock-terminal section entirely with only 3 captures at 0/0.5/1.0).
    await grabViewport("hero");

    const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);

    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), totalHeight * 0.33);
    await page.waitForTimeout(400);
    await grabViewport("upper-mid");

    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), totalHeight * 0.66);
    await page.waitForTimeout(400);
    await grabViewport("lower-mid");

    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), totalHeight);
    await page.waitForTimeout(400);
    await grabViewport("footer");

    // Full-page as a safety net for any section that falls between fixed offsets.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(300);
    await grabFullPage("fullpage");

    return shots;
  } finally {
    await page.close();
  }
}

// ── Claude calls ────────────────────────────────────────────────────────────

function buildPersonaSystemPrompt(persona: Persona): string {
  return `You are simulating a specific person evaluating a SaaS landing page. Adopt this persona completely — read with their voice, react with their priors, judge with their criteria.

# Persona

**Name:** ${persona.name}
**Age:** ${persona.age}
**Role:** ${persona.role}

**Situation:**
${persona.situation}

**Pain points:**
${persona.pain_points.map((p) => `- ${p}`).join("\n")}

**What would convert you:**
${persona.what_would_convert.map((p) => `- ${p}`).join("\n")}

**What would make you bail:**
${persona.what_would_make_them_bail.map((p) => `- ${p}`).join("\n")}

**Voice:** ${persona.voice}

# Product context

You are looking at the landing page for "CEH Prep" — a 14-day CEH v13 (Certified Ethical Hacker) exam prep SaaS. Pricing is $30/month for Pro, with 3 days free trial. The product centers on day-by-day curriculum, hands-on labs (browser-based VM), drill-style practice questions, and a Day-14 exam simulator. The target buyer is the kind of person you are — someone considering CEH for career reasons (career switch, mandated by manager, lateral move into security, etc).

# Your job

You will be given screenshots of the landing page at three scroll positions: hero (top), mid-scroll (middle), and footer (bottom). For each screenshot, react AS THIS PERSONA. Do not perform "balanced analysis" — react with the persona's actual priors, biases, voice, and pain.

Be specific. Quote copy you see. Name the visual things that caught or repelled you. Cite which of your pain points / convert criteria / bail criteria the page hits or misses.

End with a verdict in this exact format:
VERDICT: <would_convert | would_consider | would_bail>
ONE_LINE: <one-sentence summary in this persona's voice>`;
}

async function visionPass(
  client: Anthropic,
  persona: Persona,
  screenshots: Screenshot[],
  cost: CostTracker,
): Promise<string> {
  cost.assertUnderCap();

  const systemPrompt = buildPersonaSystemPrompt(persona);

  const imageContent: Anthropic.Messages.ImageBlockParam[] = screenshots.map((s) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: s.mediaType,
      data: s.data,
    },
  }));

  // Interleave label hints with the images so Claude knows which scroll position each one is.
  const userContent: Anthropic.Messages.ContentBlockParam[] = [];
  screenshots.forEach((s, i) => {
    userContent.push({ type: "text", text: `Screenshot ${i + 1} of 3 — scroll position: **${s.label}**` });
    userContent.push(imageContent[i]!);
  });
  userContent.push({
    type: "text",
    text: "Now react to all three screenshots in sequence, as this persona. Give your raw, specific, in-voice notes per screenshot, then your verdict.",
  });

  const response = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 4096,
    // Cache the persona system prompt — it's deterministic per persona, and at >1k tokens
    // it crosses the Sonnet 4.6 minimum cache prefix (2048 tokens). On the second persona
    // onward, this won't help (different persona = different prefix), but the system
    // prompt + image blocks are also reused across the synthesis pass via the chain.
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userContent }],
  });

  cost.record(`vision[${persona.id}]`, VISION_MODEL, response.usage);

  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return text;
}

async function synthesisPass(
  client: Anthropic,
  persona: Persona,
  visionNotes: string,
  cost: CostTracker,
): Promise<string> {
  cost.assertUnderCap();

  // Chain-of-critique: Haiku re-reads the Sonnet notes, asks what was missed, and ranks.
  // No images here — that's why we drop to Haiku.
  const systemPrompt = `You are a critique-of-critique agent. You will be given the raw evaluation notes that a target persona wrote about a SaaS landing page. Your job is THREE passes:

1. **Pass 1 — Re-read.** Re-read the persona's notes carefully. Are there observations the persona STARTED to make but didn't finish? Hints they noticed something but didn't name it? Surface them.
2. **Pass 2 — Missed.** What would this persona have noticed if they'd looked one more time? Specifically: animation/motion judgment, headline clarity, trust signals, mobile-readability cues, pricing-visibility — was any of these ignored?
3. **Pass 3 — Aggregate.** Produce a ranked list of FRICTION POINTS (most-likely-to-cost-conversion first) and a ranked list of CONVERSION DRIVERS (what's working). Then restate the verdict.

# Persona context (for your reference — do NOT impersonate them)

Name: ${persona.name} — ${persona.role}
Voice: ${persona.voice}
Top bail criteria: ${persona.what_would_make_them_bail.slice(0, 3).join("; ")}
Top convert criteria: ${persona.what_would_convert.slice(0, 3).join("; ")}

# Output format

## Pass 1 — Re-read
<bullets>

## Pass 2 — Missed
<bullets>

## Pass 3 — Aggregate

### Friction points (ranked)
1. ...
2. ...

### Conversion drivers (ranked)
1. ...
2. ...

### Final verdict
VERDICT: <would_convert | would_consider | would_bail>
CONFIDENCE: <low | medium | high>
RATIONALE: <one sentence>`;

  const response = await client.messages.create({
    model: SYNTHESIS_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Here are the persona's raw notes:\n\n---\n${visionNotes}\n---\n\nRun the three passes.`,
          },
        ],
      },
    ],
  });

  cost.record(`synthesis[${persona.id}]`, SYNTHESIS_MODEL, response.usage);

  return response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// ── Verdict extraction ──────────────────────────────────────────────────────

function extractVerdict(synthesis: string): PersonaResult["verdict"] {
  const match = synthesis.match(/VERDICT:\s*(would_convert|would_consider|would_bail)/i);
  if (match && match[1]) {
    return match[1].toLowerCase() as PersonaResult["verdict"];
  }
  return "would_consider";
}

// ── Report ──────────────────────────────────────────────────────────────────

function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function renderReport(results: PersonaResult[], totalCostUsd: number, targetUrl: string): string {
  const date = todayIsoDate();
  const counts = {
    would_convert: results.filter((r) => r.verdict === "would_convert").length,
    would_consider: results.filter((r) => r.verdict === "would_consider").length,
    would_bail: results.filter((r) => r.verdict === "would_bail").length,
  };

  const header =
    `# Landing page — ICP funnel review\n\n` +
    `**Date:** ${date} (UTC)\n` +
    `**Target:** \`${targetUrl}\`\n` +
    `**Personas:** ${results.length}\n` +
    `**Verdict distribution:** ${counts.would_convert} would convert · ` +
    `${counts.would_consider} would consider · ${counts.would_bail} would bail\n` +
    `**Total cost:** $${totalCostUsd.toFixed(4)}\n\n` +
    `> Advisory only. Never blocks merges. See \`.planning/phases/12-testing-and-llm-quality-review/\`.\n\n` +
    `---\n\n`;

  const sections = results.map((r) => {
    const badge =
      r.verdict === "would_convert" ? "✅ would convert" :
      r.verdict === "would_consider" ? "🤔 would consider" :
      "❌ would bail";

    return (
      `## ${r.persona.name} — ${r.persona.role}\n\n` +
      `**Verdict:** ${badge}  ·  **Cost:** $${r.costUsd.toFixed(4)}\n\n` +
      `### Persona walkthrough (Sonnet 4.6 vision pass)\n\n` +
      `${r.visionNotes}\n\n` +
      `### Chain-of-critique synthesis (Haiku 4.5)\n\n` +
      `${r.synthesis}\n\n` +
      `---\n\n`
    );
  });

  return header + sections.join("");
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    process.stderr.write(
      "ANTHROPIC_API_KEY not set — skipping QA run. (Build/typecheck unaffected.)\n",
    );
    process.exit(0);
  }

  process.stderr.write(`[icp-funnel-sim] target=${TARGET_URL} budget_cap=$${MAX_USD}\n`);

  const personasRaw = await fs.readFile(PERSONAS_PATH, "utf8");
  const { personas } = JSON.parse(personasRaw) as PersonasFile;
  process.stderr.write(`[icp-funnel-sim] loaded ${personas.length} personas\n`);

  const client = new Anthropic({ apiKey });
  const cost = new CostTracker(MAX_USD);

  process.stderr.write(`[icp-funnel-sim] launching chromium...\n`);
  const browser = await chromium.launch({ headless: true });

  const results: PersonaResult[] = [];

  try {
    process.stderr.write(`[icp-funnel-sim] capturing landing screenshots...\n`);
    const screenshots = await captureLanding(browser);
    process.stderr.write(`[icp-funnel-sim] captured ${screenshots.length} screenshots\n`);

    for (const persona of personas) {
      process.stderr.write(`\n[icp-funnel-sim] persona: ${persona.name} (${persona.id})\n`);
      const costBefore = cost.total();

      try {
        const visionNotes = await visionPass(client, persona, screenshots, cost);
        const synthesis = await synthesisPass(client, persona, visionNotes, cost);
        const verdict = extractVerdict(synthesis);

        results.push({
          persona,
          visionNotes,
          synthesis,
          verdict,
          costUsd: cost.total() - costBefore,
        });
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Budget cap exceeded")) {
          process.stderr.write(`\n[icp-funnel-sim] ${err.message}\n`);
          break;
        }
        throw err;
      }
    }
  } finally {
    await browser.close();
  }

  if (results.length === 0) {
    process.stderr.write("[icp-funnel-sim] no results — nothing to write\n");
    process.exit(1);
  }

  await fs.mkdir(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, `${todayIsoDate()}-landing.md`);
  const report = renderReport(results, cost.total(), TARGET_URL);
  await fs.writeFile(reportPath, report, "utf8");

  process.stderr.write(`\n[icp-funnel-sim] report written: ${reportPath}\n`);
  process.stderr.write(`[icp-funnel-sim] total cost: $${cost.total().toFixed(4)}\n`);
}

main().catch((err) => {
  process.stderr.write(`[icp-funnel-sim] fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
