#!/usr/bin/env tsx
/**
 * One-off helper: capture 3 landing screenshots to disk so parallel agents
 * can Read() them. Not part of the nightly harness — that lives in icp-funnel-sim.ts.
 *
 * Outputs:
 *   /tmp/ceh-qa-hero.png
 *   /tmp/ceh-qa-mid.png
 *   /tmp/ceh-qa-footer.png
 */

import { chromium } from "playwright";

const URL = process.env.QA_TARGET_URL ?? "http://localhost:3000";

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.goto(URL, { waitUntil: "networkidle", timeout: 30_000 });

  await page.screenshot({ path: "/tmp/ceh-qa-hero.png", fullPage: false });
  process.stderr.write("hero captured\n");

  const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), totalHeight / 2);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/ceh-qa-mid.png", fullPage: false });
  process.stderr.write("mid captured\n");

  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), totalHeight);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/ceh-qa-footer.png", fullPage: false });
  process.stderr.write("footer captured\n");

  await browser.close();
}

main().catch((e) => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
