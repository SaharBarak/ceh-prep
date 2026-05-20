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

  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), totalHeight * 0.33);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/ceh-qa-upper-mid.png", fullPage: false });
  process.stderr.write("upper-mid captured\n");

  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), totalHeight * 0.66);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/ceh-qa-lower-mid.png", fullPage: false });
  process.stderr.write("lower-mid captured\n");

  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), totalHeight);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/ceh-qa-footer.png", fullPage: false });
  process.stderr.write("footer captured\n");

  // Full-page safety net — catches sections that fall between fixed offsets.
  // Before snapping, scroll the entire page top→bottom in steps so any
  // `whileInView` IntersectionObserver triggers fire (Framer Motion's stagger
  // reveals stay in their `hidden` state otherwise). Then return to top
  // and wait for any settle frames before capturing.
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      window.scrollTo({ top: (h * i) / steps, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 80));
    }
  });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: "/tmp/ceh-qa-fullpage.png", fullPage: true });
  process.stderr.write("fullpage captured\n");

  await browser.close();
}

main().catch((e) => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
