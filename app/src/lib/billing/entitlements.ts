/**
 * Entitlements — pure domain rules for free/pro gating.
 *
 * Single source of truth. Imported by:
 *   - `saveAnswer` server action  (action layer  — replaces inline `isFreeDay` check)
 *   - `course/[day]/page.tsx`     (render layer — replaces no check at all)
 *   - Phase 4 `lib/guards/require-day-access.ts` (Phase 4)
 *   - Phase 4 `lib/guards/require-tier.ts`       (Phase 4)
 *
 * Every gate that asks "can this tier touch this day?" calls `canAccessDay`.
 * Every gate that asks "can this tier touch the exam simulator?" calls `canAccessExam`.
 *
 * No I/O. No SDK imports. No async, no Promises. Pure functions only.
 */

export const FREE_DAY_LIMIT = 3 as const;

export type Tier = "free" | "pro";

/**
 * v1 rule: free users get days 1..FREE_DAY_LIMIT inclusive; pro users get all 14.
 * Returns false for out-of-range days as a defensive default — callers must
 * also validate the day index, but this function will never accidentally allow
 * day 0 or day 15.
 */
export const canAccessDay = (tier: Tier, day: number): boolean => {
  if (!Number.isInteger(day) || day < 1 || day > 14) return false;
  if (tier === "pro") return true;
  return day <= FREE_DAY_LIMIT;
};

/**
 * Exam simulator (TIER-04 in Phase 4) is Pro-only.
 * Stubbed here so Phase 4 imports the same module — no churn at the call site.
 */
export const canAccessExam = (tier: Tier): boolean => tier === "pro";
