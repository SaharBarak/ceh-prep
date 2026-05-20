#!/usr/bin/env tsx
/**
 * Funnel-wide screenshot capture. Walks the public conversion path:
 *
 *   /          (landing)
 *   /signup    (the form a converted visitor hits next)
 *   /pricing   (alternative info-seeking path)
 *   /bonus     (advanced track, now signposted from landing)
 *
 * For each page captures hero viewport + full-page. Outputs to /tmp/ceh-qa-*.
 * Used by the orchestrator-fan-out flow (parallel agents review the full
 * funnel rather than just landing).
 */

import { chromium, type Page } from "playwright";

const URL = process.env.QA_TARGET_URL ?? "http://localhost:3000";
const PAGES: ReadonlyArray<{ slug: string; path: string }> = [
  { slug: "landing", path: "/" },
  { slug: "signup", path: "/signup" },
  { slug: "pricing", path: "/pricing" },
  { slug: "bonus", path: "/bonus" },
];

async function capturePage(page: Page, slug: string, path: string): Promise<void> {
  await page.goto(URL + path, { waitUntil: "networkidle", timeout: 30_000 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(300);

  await page.screenshot({ path: `/tmp/ceh-qa-${slug}-hero.png`, fullPage: false });
  await page.screenshot({ path: `/tmp/ceh-qa-${slug}-fullpage.png`, fullPage: true });

  process.stderr.write(`${slug}: captured hero + fullpage\n`);
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  try {
    for (const p of PAGES) {
      await capturePage(page, p.slug, p.path);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
