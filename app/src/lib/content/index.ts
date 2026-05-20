/**
 * Curriculum module — single source of truth for the 14-day CEH v13 sprint.
 *
 * Public API:
 *   DAYS         — Readonly array of Day, exactly 14 entries, ordered 1..14
 *   getDay(n)    — Lookup helper; returns undefined for out-of-range n
 *   isFreeDay(n) — Cosmetic check for the "free tier" badge (NOT a gate;
 *                  the real gate is canAccessDay in lib/billing/entitlements)
 *
 * Note on `isFreeDay`: this is a *display* helper. Authorization for the
 * lesson body is enforced by canAccessDay() at the page level (STAB-03).
 * Never let this function become the only thing standing between a free
 * user and gated content — they're orthogonal concerns.
 */

import type { Day } from "./types";
import { DAYS } from "./days";

export type { Day, QuizQuestion, Concept, Exercise } from "./types";
export { DAYS };

export const getDay = (n: number): Day | undefined => {
  if (!Number.isInteger(n) || n < 1 || n > 14) return undefined;
  return DAYS[n - 1];
};

/** Free tier covers days 1..3 — matches FREE_DAY_LIMIT in entitlements.ts. */
export const isFreeDay = (n: number): boolean => n >= 1 && n <= 3;
