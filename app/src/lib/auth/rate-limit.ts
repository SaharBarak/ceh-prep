/**
 * In-process LRU-cache rate limiter — Phase 1's v1 limiter.
 *
 * Swap to Upstash Redis (sliding window) in Phase 5 — the function signature
 * stays the same so call sites don't churn. This implementation is per-process
 * and resets on dyno restart; that's fine for a single-Vercel-region MVP and
 * documented as a known limitation in PROJECT.md.
 *
 * Algorithm: fixed-window counter keyed by `${bucket}:${key}`. When the count
 * exceeds `max` within `windowMs`, subsequent calls return ok:false until the
 * window expires.
 */

import { LRUCache } from "lru-cache";

type Bucket = {
  count: number;
  resetAt: number;
};

// Single cache shared by every bucket. Auto-evicts the least-recently-touched
// entries when full — a million keys at ~80 bytes is ~80 MB; 50k is plenty for
// a v1 limiter that exists primarily to slow attackers, not to be exact.
const cache = new LRUCache<string, Bucket>({
  max: 50_000,
});

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; remaining: 0; retryAfterMs: number };

/**
 * Allow up to `max` requests per `windowMs` for (bucket, key).
 *
 * Example: rateLimit("login", clientIp, 10, 60_000)
 *   → 10 login attempts per minute per IP.
 *
 * The bucket prefix lets multiple limiters share the same key (e.g. IP) without
 * collision: "login:1.2.3.4" and "signup:1.2.3.4" are independent buckets.
 */
export const rateLimit = (
  bucket: string,
  key: string,
  max: number,
  windowMs: number,
): RateLimitResult => {
  const cacheKey = `${bucket}:${key}`;
  const now = Date.now();
  const existing = cache.get(cacheKey);

  if (!existing || existing.resetAt <= now) {
    cache.set(cacheKey, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1 };
  }

  if (existing.count >= max) {
    return { ok: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { ok: true, remaining: max - existing.count };
};
