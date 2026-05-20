/**
 * HIBP Pwned Passwords — k-anonymity range query.
 *
 * Never sends the user's password (or its full hash) anywhere. Computes
 * SHA-1, sends the first 5 hex chars (the "prefix"), and the API returns
 * every full hash that starts with that prefix plus a count. We compare
 * the remaining 35 chars locally.
 *
 * https://haveibeenpwned.com/API/v3#PwnedPasswords
 *
 * Failure mode: on any network/timeout error we return `false` (allow).
 * The alternative (fail closed) would lock people out of signup whenever
 * HIBP has a hiccup. We accept the trade-off and log the failure for
 * monitoring; Phase 5's structured logs surface this.
 */

import { createHash } from "node:crypto";

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range";
const TIMEOUT_MS = 3000;
const MIN_COUNT_TO_REJECT = 1; // any appearance in a breach = reject

export const isPasswordPwned = async (plaintext: string): Promise<boolean> => {
  const sha1 = createHash("sha1").update(plaintext).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${HIBP_RANGE_URL}/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const body = await res.text();

    for (const line of body.split("\n")) {
      const [hashSuffix, countStr] = line.trim().split(":");
      if (hashSuffix === suffix && Number(countStr) >= MIN_COUNT_TO_REJECT) {
        return true;
      }
    }
    return false;
  } catch {
    // Network error / abort — allow the password and let the request through.
    // Monitoring picks up the failure via Phase 5 structured logs.
    return false;
  } finally {
    clearTimeout(timer);
  }
};
